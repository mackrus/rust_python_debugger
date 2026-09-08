import init, { DebuggerEngine } from "./pkg/rust_python_debugger.js";

let engine = null;
let isReady = false;

async function setup() {
  try {
    await init();
    engine = new DebuggerEngine(3000);
    isReady = true;
    self.postMessage({ type: "READY" });
  } catch (err) {
    self.postMessage({ type: "INIT_ERROR", error: String(err) });
  }
}

self.onmessage = async (e) => {
  const { type, code, maxSteps, id } = e.data || {};
  if (type === "RUN") {
    if (!isReady) {
      await setup();
    }
    try {
      const rawJson = engine.trace(code, maxSteps || 3000);
      const parsed = JSON.parse(rawJson);
      self.postMessage({ type: "TRACE_COMPLETE", id, payload: parsed });
    } catch (err) {
      self.postMessage({ type: "TRACE_ERROR", id, error: err?.message || String(err) });
    }
  }
};

setup();
