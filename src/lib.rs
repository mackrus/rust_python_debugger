use wasm_bindgen::prelude::*;
use rustpython_vm as vm;
use vm::Interpreter;

const HARNESS_PREFIX: &str = r#"
import sys

def _json_escape_str(s):
    out = []
    for c in s:
        if c == '"': out.append(r'\"')
        elif c == '\\': out.append(r'\\')
        elif c == '\n': out.append(r'\n')
        elif c == '\r': out.append(r'\r')
        elif c == '\t': out.append(r'\t')
        elif ord(c) < 32: out.append(f"\\u{ord(c):04x}")
        else: out.append(c)
    return '"' + ''.join(out) + '"'

def _to_json(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, str): return _json_escape_str(v)
    if isinstance(v, list): return "[" + ",".join(_to_json(x) for x in v) + "]"
    if isinstance(v, dict): return "{" + ",".join(_json_escape_str(k) + ":" + _to_json(val) for k, val in v.items()) + "}"
    return _json_escape_str(str(v))

class _StdoutCapture:
    def __init__(self):
        self.chunks = []
    def write(self, s):
        self.chunks.append(str(s))
    def flush(self):
        pass

class _Tracer:
    def __init__(self, max_steps):
        self.steps = []
        self.max_steps = max_steps
        self.step_count = 0
        self.truncated = False
        self.stdout_cap = _StdoutCapture()

    def serialize_val(self, val, depth=0, seen=None):
        try:
            if seen is None:
                seen = set()
            val_id = id(val)
            if val_id in seen:
                return {"type": type(val).__name__, "repr": "<circular>"}
            t = type(val).__name__
            if depth > 2:
                return {"type": t, "repr": repr(val)}
            if val is None:
                return {"type": "NoneType", "repr": "None", "val": None}
            if isinstance(val, bool):
                return {"type": "bool", "repr": "True" if val else "False", "val": val}
            if isinstance(val, (int, float)):
                return {"type": t, "repr": str(val), "val": val}
            if isinstance(val, str):
                return {"type": "str", "repr": repr(val), "val": val}
            new_seen = seen | {val_id}
            if isinstance(val, (list, tuple)):
                items = [self.serialize_val(x, depth + 1, new_seen) for x in val[:50]]
                return {"type": t, "repr": repr(val), "children": items, "len": len(val)}
            if isinstance(val, dict):
                entries = {str(k): self.serialize_val(v, depth + 1, new_seen) for k, v in list(val.items())[:50]}
                return {"type": "dict", "repr": repr(val), "entries": entries, "len": len(val)}
            if isinstance(val, set):
                items = [self.serialize_val(x, depth + 1, new_seen) for x in list(val)[:50]]
                return {"type": "set", "repr": repr(val), "children": items, "len": len(val)}
            return {"type": t, "repr": repr(val)}
        except Exception as e:
            return {"type": "error", "repr": f"<unprintable: {e}>"}

    def trace(self, frame, event, arg):

        if frame.f_code.co_filename != "<user_code>":
            return self.trace

        if self.step_count >= self.max_steps:
            self.truncated = True
            raise RuntimeError(f"Step limit reached ({self.max_steps} steps)")

        self.step_count += 1

        stack = []
        curr = frame
        while curr and curr.f_code.co_filename == "<user_code>":
            stack.append({
                "func": curr.f_code.co_name,
                "line": curr.f_lineno
            })
            curr = curr.f_back
        stack.reverse()

        locals_snap = {}
        for k, v in frame.f_locals.items():
            if not k.startswith("__") and k != "_tracer":
                locals_snap[k] = self.serialize_val(v)

        globals_snap = {}
        for k, v in frame.f_globals.items():
            if not k.startswith("__") and k not in ("_tracer", "_StdoutCapture", "sys"):
                globals_snap[k] = self.serialize_val(v)

        ret_val = None
        if event == "return":
            ret_val = self.serialize_val(arg)

        exc_val = None

        if event == "exception":
            try:
                exc_type, exc_value, _ = arg
                exc_val = f"{getattr(exc_type, '__name__', 'Exception')}: {exc_value}"
            except Exception:
                exc_val = "Exception"

        stdout_str = "".join(self.stdout_cap.chunks)

        self.steps.append({
            "step": self.step_count,
            "event": event,
            "line": frame.f_lineno,
            "func": frame.f_code.co_name,
            "stack": stack,
            "locals": locals_snap,
            "globals": globals_snap,
            "return_value": ret_val,
            "exception": exc_val,
            "stdout": stdout_str
        })
        return self.trace

_tracer = _Tracer(MAX_STEPS_PLACEHOLDER)
_old_stdout = sys.stdout
sys.stdout = _tracer.stdout_cap
_user_error = None

_compiled_code = compile(USER_CODE_PLACEHOLDER, "<user_code>", "exec")
sys.settrace(_tracer.trace)
try:
    exec(_compiled_code, {"__name__": "__main__"})
except Exception as _e:
    if not _tracer.truncated:
        _user_error = f"{type(_e).__name__}: {str(_e)}"
finally:
    sys.settrace(None)
    sys.stdout = _old_stdout

_final_stdout = "".join(_tracer.stdout_cap.chunks)
_result_obj = {
    "steps": _tracer.steps,
    "stdout": _final_stdout,
    "total_steps": len(_tracer.steps),
    "truncated": _tracer.truncated,
    "error": _user_error
}
_FINAL_JSON = _to_json(_result_obj)
"#;

#[wasm_bindgen]
pub struct DebuggerEngine {
    default_max_steps: usize,
}

#[wasm_bindgen]
impl DebuggerEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(default_max_steps: usize) -> Self {
        Self { default_max_steps }
    }

    #[wasm_bindgen]
    pub fn trace(&self, user_code: &str, max_steps: Option<usize>) -> Result<String, JsValue> {
        let limit = max_steps.unwrap_or(self.default_max_steps);
        let escaped_user_code = serde_json::to_string(user_code)
            .map_err(|e| JsValue::from_str(&format!("JSON encode error: {}", e)))?;

        let harness = HARNESS_PREFIX
            .replace("MAX_STEPS_PLACEHOLDER", &limit.to_string())
            .replace("USER_CODE_PLACEHOLDER", &escaped_user_code);

        let interp = Interpreter::without_stdlib(Default::default());
        interp.enter(|vm| {
            let scope = vm.new_scope_with_builtins();
            vm.run_string(scope.clone(), &harness, "<debugger_harness>".to_string())
                .map_err(|exc| {
                    let mut s = String::new();
                    let _ = vm.write_exception(&mut s, &exc);
                    JsValue::from_str(&s)
                })?;

            let final_json = scope.globals.get_item("_FINAL_JSON", vm).map_err(|e| {
                let mut s = String::new();
                let _ = vm.write_exception(&mut s, &e);
                JsValue::from_str(&s)
            })?;

            let py_str = final_json.str(vm).map_err(|e| {
                let mut s = String::new();
                let _ = vm.write_exception(&mut s, &e);
                JsValue::from_str(&s)
            })?;

            Ok(format!("{py_str}"))
        })
    }
}
