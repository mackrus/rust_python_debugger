# Spec & Implementation Guide: In-Browser Python Debugger via Rust + WebAssembly

## 1. Overview & Architecture

The goal is to build an ultra-fast, zero-server Python visual debugger running entirely client-side in the browser, powered by **RustPython** compiled to **WebAssembly (WASM)**.

Unlike the heavy Pyodide / CPython runtime (~35MB+ download, several seconds of initialization, Emscripten glue), this implementation leverages a lean Rust-native Python 3 virtual machine (`rustpython-vm`) compiled directly with `wasm-bindgen` and `wasm-pack` (~3–6MB, near-instant load time).

Furthermore, the frontend eliminates heavy bundlers like Vite, Webpack, or Node.js. The entire application is built using a **single shell script (`build.sh`)** and served via modern ES modules and standard web APIs.

### System Topology

```
+-----------------------------------------------------------------+
| Browser Main Thread (UI)                                        |
|  - Monaco / CodeMirror Editor (Loaded via native ESM CDN)       |
|  - Stepper Controls: [Step Over] [Step Into] [Step Out] [Rewind]|
|  - Time-Travel Scrubber Slider & Auto-Play                      |
|  - Panels: Call Stack, Scope / Locals Inspector, Console Output |
+--------------------------------+--------------------------------+
                                 | postMessage (Async RPC)
                                 v
+-----------------------------------------------------------------+
| Dedicated Web Worker                                            |
|  - RustPython WASM Engine (compiled via wasm-pack)              |
|  - Execution Harness & Trace Recorder Engine                    |
|  - Structured TraceStep[] serialization via serde-wasm-bindgen  |
|  - Infinite loop & execution timeout guards                     |
+-----------------------------------------------------------------+
```

---

## 2. Advantages over Pyodide

| Dimension | Pyodide (CPython + Emscripten) | RustPython + WASM |
|---|---|---|
| **Binary Size** | ~30–40 MB (CPython runtime + stdlib) | ~4–7 MB (WASM + JS glue) |
| **Cold Startup Time** | 2.5s – 6.0s in browser | ~150ms – 400ms |
| **Build Tooling** | Node.js, npm, Vite, rollup plugins | `cargo`, `wasm-pack`, plain `build.sh` |
| **VM Inspectability** | Restricted to Python-level `sys.settrace` | Direct VM hook access & native Rust types |
| **Dependencies** | Hundreds of npm packages in `node_modules` | Zero npm dependencies; pure web standards |

---

## 3. Core Stepping Architecture: Record & Replay

To deliver a flawless time-travel debugging experience with zero race conditions, the engine utilizes the **Record-and-Replay Trace Model**:

1. **User Submits Code**: UI dispatches a `RUN` message with user code and breakpoint lines to the Web Worker.
2. **Sandboxed Execution**: Worker initializes the RustPython WASM instance and runs the script under a tracer.
3. **Trace Step Capture**: On each line, function call, return, and exception:
   - Line number and event type (`line`, `call`, `return`, `exception`).
   - Active call stack (function name, line number, scope depth).
   - Scoped local variables and global variables (serialized safely with recursion depth guards).
   - Return values (on function returns) and exception info (on errors).
   - Incremental stdout/stderr output synced to the exact step.
4. **Safety & Loop Limits**:
   - Trace step limiter (e.g. 2,000 steps) halts runaway infinite loops cleanly.
   - Worker execution watchdog terminates if execution exceeds time limits.
5. **Timeline Navigation**:
   - The worker returns an array of `TraceStep` snapshots to the main thread.
   - The UI scrubs backwards and forwards instantly (`stepIndex +/- 1`), enabling instant undo, replay, step-over, step-out, and continuous slider scrubbing.

---

## 4. Rust Engine Implementation (`crate: rust_python_debugger`)

### `Cargo.toml`
```toml
[package]
name = "rust_python_debugger"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
rustpython-vm = { version = "0.5.0", default-features = false, features = ["compiler", "wasmbind", "parser", "codegen", "gc"] }
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
serde_json = "1.0"
```

### Trace Data Structures (`src/trace.rs`)
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableValue {
    pub r#type: String,
    pub repr: String,
    pub val: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackFrame {
    pub func: String,
    pub line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceStep {
    pub step: usize,
    pub event: String, // "line", "call", "return", "exception"
    pub line: usize,
    pub stack: Vec<StackFrame>,
    pub locals: HashMap<String, VariableValue>,
    pub globals: HashMap<String, VariableValue>,
    pub return_value: Option<VariableValue>,
    pub exception: Option<String>,
    pub stdout_offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceResult {
    pub steps: Vec<TraceStep>,
    pub stdout: String,
    pub total_steps: usize,
    pub truncated: bool,
    pub error: Option<String>,
}
```

### Rust Execution & Tracing (`src/lib.rs`)
The tracer registers a trace hook inside RustPython or intercepts bytecode execution:
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DebuggerSession {
    max_steps: usize,
}

#[wasm_bindgen]
impl DebuggerSession {
    #[wasm_bindgen(constructor)]
    pub fn new(max_steps: usize) -> Self {
        Self { max_steps }
    }

    #[wasm_bindgen]
    pub fn execute(&self, source_code: &str) -> Result<JsValue, JsValue> {
        let result = run_traced(source_code, self.max_steps)?;
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
```

---

## 5. Web Worker & IPC Architecture

### Worker Script (`web/worker.js`)
The worker imports the generated WASM bundle using native browser ES module imports:

```javascript
import init, { DebuggerSession } from "./pkg/rust_python_debugger.js";

let initialized = false;
let session = null;

async function setup() {
  await init();
  session = new DebuggerSession(2500);
  initialized = true;
  self.postMessage({ type: "READY" });
}

self.onmessage = async (e) => {
  const { type, code, id } = e.data;
  if (type === "RUN") {
    if (!initialized) await setup();
    try {
      const result = session.execute(code);
      self.postMessage({ type: "TRACE_COMPLETE", id, payload: result });
    } catch (err) {
      self.postMessage({ type: "TRACE_ERROR", id, error: String(err) });
    }
  }
};

setup();
```

---

## 6. Frontend & Zero-Tooling Static UI

### Technology Choice
- **Zero Node / Vite**: Vanilla HTML5, modern CSS, standard browser ES modules.
- **Editor**: Monaco Editor or CodeMirror loaded directly from ESM CDN (e.g. `https://esm.sh/@codemirror/view`).
- **Styling**: Clean dark theme with responsive flexbox/grid layout and CSS variables.

### UI Components
1. **Toolbar & Timeline Controls**:
   - Run / Trace (`Ctrl+Enter`)
   - Step Forward / Step Into (`F11`)
   - Step Backward / Rewind (`F9` or `Alt+Left`)
   - Step Over (`F10`)
   - Step Out (`Shift+F11`)
   - Continue to next Breakpoint (`F5`)
   - Jump to Start (`Home`) / End (`End`)
   - Interactive Scrubber slider and Auto-play (0.5x, 1x, 2x, 4x)
2. **Code Editor**:
   - Gutter breakpoint toggling (red indicator dots)
   - Active execution line highlight (yellow/blue pointer marker)
3. **Variables & Scope Inspector**:
   - Locals and Globals tab views
   - Variable name, type badge (`int`, `str`, `list`, `dict`), and preview value
   - Variable mutation badge (highlights values changed since prior step)
4. **Call Stack Pane**:
   - Active call stack frames (function name, line number)
   - Clicking a frame re-scopes local variable inspection
5. **Synchronized Console Output**:
   - Terminal stdout strictly synchronized with current trace step

---

## 7. Build & Serving Scripts

### `build.sh` (No Vite / No Webpack)
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Building RustPython WASM bundle..."
wasm-pack build --target web --out-dir web/pkg --release

echo "==> Build complete! Output located in web/"
```

### `serve.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Serving client-side debugger on http://localhost:8000"
uv run python -m http.server 8000 --directory web
```

---

## 8. Milestone Roadmap

1. **Milestone 1: Rust Core & WASM Compilation**
   - Create Cargo project with `rustpython-vm`, `wasm-bindgen`, and `serde`.
   - Implement the tracing runner that executes Python scripts and outputs `TraceResult`.
   - Verify `wasm-pack build --target web` generates valid WASM and JS bindings.

2. **Milestone 2: Web Worker Harness**
   - Create `web/worker.js` loading the WASM module.
   - Implement postMessage protocol with timeout watchdog.

3. **Milestone 3: Static Frontend & Code Editor**
   - Build `web/index.html`, `web/style.css`, and `web/app.js`.
   - Integrate editor with gutter breakpoint toggles and line decoration.

4. **Milestone 4: Interactive Stepping & State Inspection**
   - Connect playback controls, scrubber, variables inspector with diff highlights, call stack, and stdout.

5. **Milestone 5: Verification & Presets**
   - Test recursive Fibonacci, sorting algorithms, and error handling presets.
