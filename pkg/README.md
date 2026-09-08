# RustPython Visual Debugger (WASM)

A zero-server, client-side Python visual debugger powered by **RustPython** compiled to **WebAssembly (WASM)**.

Zero Node.js build tooling, zero Vite, zero server execution. Built with pure Cargo + `wasm-pack`, native browser ES modules, and a single shell script.

---

## Features

- **Blazing Fast & Lightweight**:
  - ~7 MB optimized WASM bundle (compared to Pyodide's ~35 MB+ runtime).
  - Sub-second cold startup in browser.
- **Time-Travel Debugging (Record & Replay)**:
  - Step Into (`F11`), Step Back / Undo (`F9` / `Alt+Left`).
  - Step Over (`F10`), Step Out (`Shift+F11`).
  - Continue to Breakpoint (`F5`).
  - Jump to Start (`Home`) & End (`End`).
  - Interactive Scrubber Slider and Auto-play (0.5x, 1x, 2x, 4x speeds).
- **Monaco Code Editor & VIM Mode**:
  - Full Python syntax highlighting and dark theme.
  - **VIM Mode Toggle (`VIM MODE: ON/OFF`)**: Full modal editing with standard Vim keybinds (`hjkl`, `w`, `b`, `e`, `0`, `$`, `gg`, `G`, `dd`, `yy`, `p`, `u`, `/` search, visual mode, etc.) and responsive status bar.
  - Interactive gutter breakpoints (click line margin to toggle red dots).
  - Active line execution indicator.
- **Variables & Scope Inspector**:
  - Scoped `Locals` and `Globals` tabs.
  - Variable type pills (`int`, `str`, `list`, `dict`, `set`, etc.).
  - Automatic green mutation badges highlighting values modified in the current step.
  - Expandable nested objects (lists, tuples, dicts).
  - Return value and exception banners.
- **Call Stack Navigation**:
  - Visual stack frame list (`func()` at line `N`).
  - Top frame highlighted, active execution context tracking.
- **Synchronized Console Output**:
  - Live stdout replay strictly synchronized to current step index.
- **Safety Loop Guard**:
  - Configurable step limiter (1,000 to 5,000 steps) protecting against infinite loops.
- **Built-In Presets**:
  - Recursive Fibonacci (call stack demonstration)
  - Bubble Sort (in-place list mutations)
  - Binary Search (algorithmic pointer inspection)
  - Nested Dictionaries & Lists
  - Exception Handling (`try` / `except` / `finally`)
  - Infinite Loop Guard Demonstration

---

## Quick Start

### 1. Build WASM Bundle
```bash
./build.sh
```
This runs `wasm-pack build --target web --out-dir web/pkg --release` to generate the optimized WebAssembly binary and JavaScript bindings.

### 2. Serve Application
```bash
./serve.sh
```
Serves the static application locally at `http://localhost:8000` using `uv run python -m http.server`.

---

## Architecture

```
+-----------------------------------------------------------------+
| Browser Main Thread (UI)                                        |
|  - Monaco Editor (via ESM CDN)                                  |
|  - Stepper Controls: [Step Over] [Step Into] [Step Out] [Rewind]|
|  - Scrubber Slider & Auto-Play (0.5x - 4x)                      |
|  - Panels: Call Stack, Scope / Locals Inspector, Console Output |
+--------------------------------+--------------------------------+
                                 | postMessage (Async RPC)
                                 v
+-----------------------------------------------------------------+
| Dedicated Web Worker (web/worker.js)                            |
|  - RustPython WASM Engine (compiled via wasm-pack)              |
|  - Execution Harness & Trace Recorder Engine                    |
|  - Structured TraceStep[] serialization                         |
|  - Step limiter & runaway loop protection                       |
+-----------------------------------------------------------------+
```

## Directory Structure

```
rust_python_debugger/
├── build.sh             # Compiles Rust to WASM via wasm-pack
├── serve.sh             # Serves static web site via uv
├── Cargo.toml           # Rust crate config (rustpython-vm, wasm-bindgen)
├── INSTRUCTIONS.md      # Detailed spec & implementation guide
├── README.md            # Quick start & documentation
├── src/
│   └── lib.rs           # RustPython tracer engine & WASM export
└── web/
    ├── index.html       # Single-page UI with Monaco Editor
    ├── style.css        # Modern dark theme UI styles
    ├── app.js           # Client debugger controller & timeline replay
    ├── worker.js        # Sandboxed Web Worker running WASM engine
    └── pkg/             # Generated wasm-pack artifacts
```
