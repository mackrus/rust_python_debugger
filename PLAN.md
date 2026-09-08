# Execution Plan: RustPython Debugger Testing & UI Redesign

This document outlines the two-part execution plan:
1. **Exhaustive Testing & Verification**: Ensuring the debugger engine and stepping logic correctly handle all Python 3 constructs, data types, classes, functions, and stepping operations (`step_into`, `step_over`, `step_out`, `step_back`, breakpoints).
2. **Visual Overhaul (Pure Visuals)**: Redesigning the web interface to be cleaner, simpler, and more cohesive without altering any underlying runtime or stepping logic.

---

## Part 1: Comprehensive & Exhaustive Testing of Debugger Logic

### 1.1 Test Architecture & Harness Design
Because `DebuggerEngine` in [`src/lib.rs`](file:///home/mac/Projects/rust_python_debugger/src/lib.rs) is written in Rust and uses `rustpython-vm`, all core debugging and tracing logic can be tested directly on the host using standard Rust unit/integration tests (`cargo test`) without needing a browser or WebAssembly runtime.

- **Rust Test Harness (`tests/debugger_tests.rs`)**:
  - Direct invocation of `DebuggerEngine::trace(user_code, max_steps)`.
  - JSON deserialization of the trace output into typed Rust structures (`TraceResult`, `TraceStep`, `StackFrame`, `VariableValue`).
  - Validation of step counts, event ordering (`call`, `line`, `return`, `exception`), call stack depth, captured variables, and terminal stdout.
- **Stepping Simulator Test Suite (`tests/stepping_tests.rs`)**:
  - Port the stepping algorithms from [`web/app.js`](file:///home/mac/Projects/rust_python_debugger/web/app.js) (`stepOver`, `stepOut`, `stepIn`, `stepBack`, `continueToBreakpoint`) into an automated test validator.
  - Verify every stepping operation against recorded traces across all language constructs.

---

### 1.2 Python Language & Data Type Coverage Matrix

Tests must verify that values are accurately inspected, typed, formatted, and tracked across steps for every Python construct:

#### A. Primitives & Standard Data Types
- **Primitives**: `int` (small, negative, arbitrarily large), `float` (regular, scientific, `inf`, `-inf`, `nan`), `bool` (`True`, `False`), `NoneType` (`None`).
- **Strings & Textual Types**: ASCII, Unicode, multiline, empty strings, escaped characters, format strings (`f-strings`).
- **Binary Data**: `bytes`, `bytearray`.
- **Collections & Sequences**:
  - `list`: empty, single-element, homogenous, mixed types, nested lists.
  - `tuple`: single-element `(x,)`, empty, nested.
  - `dict`: empty, string keys, int/tuple keys, nested dictionaries, dynamic key insertions/deletions.
  - `set` & `frozenset`: empty, populated, set operations.
- **Special Types & Edge Cases**:
  - `range` objects, `slice` objects.
  - Deeply nested structures exceeding depth threshold (`depth > 2`).
  - Large collections exceeding preview limits (> 50 items).
  - Circular / self-referencing structures (`l = []; l.append(l)`).
  - Objects with custom or throwing `__repr__` / `__str__`.

#### B. Functions, Closures & Recursion
- **Function Definitions**:
  - Positional arguments, default parameters, variable args (`*args`), keyword arguments (`**kwargs`), keyword-only arguments.
  - Return statements: implicit return (`None`), explicit return, tuple returns, early returns.
- **Closures & Scope**:
  - Nested functions capturing outer lexical variables (`nonlocal`).
  - Higher-order functions (passing functions as arguments, returning functions).
  - Lambdas and inline anonymous functions.
- **Recursion**:
  - Direct recursion (e.g., recursive factorial, Fibonacci).
  - Deep recursion approaching stack limits.
  - Mutual recursion (e.g., `is_even(n)` calls `is_odd(n-1)`).

#### C. Classes, Object-Oriented Programming & Metadata
- **Class Declarations**:
  - Class definitions and class-level attributes.
  - Instance instantiation (`__init__`, `self` assignment).
  - Instance attributes vs class attributes.
- **Methods**:
  - Instance methods (`self`).
  - Class methods (`@classmethod`, `cls`).
  - Static methods (`@staticmethod`).
  - Property getters and setters (`@property`, `@attr.setter`).
- **Inheritance & Polymorphism**:
  - Single inheritance, method overriding, `super()` calls.
  - Multiple inheritance and method resolution order (`MRO`).
- **Special / Dunder Methods**:
  - `__str__`, `__repr__`, `__len__`, `__getitem__`, `__iter__`, `__call__`.
  - User-defined dataclass-like structures and custom containers.

#### D. Control Flow, Exceptions & Advanced Constructs
- **Branching & Loops**:
  - `if`, `elif`, `else` blocks.
  - `while` loops, `for` loops (over ranges, lists, dicts, generators).
  - `break`, `continue`, `pass`, nested loops.
- **Exception Handling**:
  - `try` / `except` (specific exceptions and generic `Exception`).
  - `try` / `except` / `else` / `finally` execution order.
  - Re-raising exceptions (`raise`).
  - User-defined custom exception classes.
  - Uncaught exceptions terminating trace with clean error representation.
- **Comprehensions & Generators**:
  - List comprehensions, set comprehensions, dict comprehensions.
  - Generator expressions and generator functions (`yield`, `yield from`).
- **Context Managers**:
  - `with` statements and `__enter__` / `__exit__` transitions.

---

### 1.3 Stepping Mechanics Verification (`step_in`, `step_over`, `step_out`, `step_back`)

For each test scenario, stepping algorithms must satisfy strict operational contracts:

1. **Step In (`F11`)**:
   - Must advance precisely by 1 trace step (`currentStepIndex + 1`).
   - If paused on a function call line, must enter the first line of the callee function.
2. **Step Over (`F10`)**:
   - If paused on a function call line, must run until control returns to the same call frame at the next line (depth <= currentDepth) without stopping inside child calls.
   - **Edge Case - Recursion**: Must not incorrectly halt inside deeper recursive activations of the same function.
   - **Edge Case - Return from Frame**: If on the final line of a function, step over must cleanly exit to the caller frame.
   - **Edge Case - Loops**: Stepping over a loop header or body line must step to the next iteration or the line following the loop.
3. **Step Out (`Shift+F11`)**:
   - Must execute until the current function returns and execution resumes in the parent caller frame (`depth < currentDepth`).
   - If already in the root module frame, must jump to the final step of the program.
4. **Step Back (`F9` / `Alt+Left`)**:
   - Must step backwards to the previous execution state (`currentStepIndex - 1`), perfectly restoring call stack, local variables, and stdout up to that moment.
5. **Breakpoints & Continue (`F5`)**:
   - Multiple breakpoints across functions, classes, and loops.
   - Continuing from a breakpoint must advance to the next hit line matching the breakpoint set, or to program termination if no further breakpoints match.
   - Conditional / loop breakpoints hit repeatedly on distinct iterations.

---

### 1.4 Test Automation & Verification Plan
- **Cargo Test Suite**:
  - `tests/test_types.rs`: Every Python data type serialization.
  - `tests/test_functions.rs`: Functions, arguments, closures, recursion.
  - `tests/test_classes.rs`: Classes, instances, inheritance, properties.
  - `tests/test_control_flow.rs`: Loops, comprehensions, exceptions.
  - `tests/test_stepping.rs`: Stepping invariants (`step_over`, `step_out`, `step_in`, `step_back`, breakpoints).
- **Execution**: Run with `cargo test` to ensure instant sub-second verification during any engine modification.

---

## Part 2: UI Visual Redesign (Simpler, Cleaner, Pure Visuals)

### 2.1 Design Goals & Principles
- **Tasteful Minimalism**: Remove clutter, excess borders, garish badge colors, and visual noise. Adopt a clean, focused, modern dark developer aesthetic (inspired by Zed, Linear, and VS Code minimal).
- **Zero Logic Modification**:
  - Keep all existing DOM IDs, data attributes, element hierarchies, and JavaScript event bindings untouched (`#btn-run`, `#btn-step-over`, `#variables-tree-container`, `#monaco-editor-container`, etc.).
  - No changes to `web/app.js` or `web/worker.js` logic.
- **Improved Information Hierarchy**:
  - Stepper controls grouped cleanly with unified visual weights.
  - Clear distinction between primary actions (Run / Step) and secondary controls (speed, presets).
  - Consistent typography, subtle muted borders, and restrained accent colors.

---

### 2.2 Component-by-Component Visual Plan

#### A. Top Header
- **Current State**: Heavy brand banner, redundant subtitle, bulky select inputs.
- **Redesign**:
  - Slim down header height.
  - Refined, minimal brand mark: clean monospace title with subtle version/engine indicator.
  - Group preset selector and loop guard limit into sleek, borderless or subtle segmented selects with consistent dark dropdown styling.
  - Streamlined engine status indicator (subtle glowing dot + unobtrusive status text).

#### B. Stepper Control Bar & Timeline
- **Current State**: Jarring contrast between Run button, control buttons, dropdown, and raw native range slider.
- **Redesign**:
  - Unified toolbar styling with consistent button sizing (32px), subtle hover states, and crisp SVG icon alignment.
  - Distinct primary "Run" action with a calm accent color (sleek emerald or muted indigo instead of loud saturated button).
  - Cohesive Stepping Button Group: `[⏮ Back] [▶ Play] [⤵ Into] [↷ Over] [⤴ Out] [⏭ Breakpoint]` styled as a connected toolbar cluster with clean dividers.
  - Redesigned timeline scrubber: custom CSS styled track and thumb with smooth hover states, clean monospace step counter (`Step 01 / 42`).

#### C. Code Editor Pane
- **Current State**: Cluttered header with conflicting badges ("VIM ON", "Clear Breakpoints").
- **Redesign**:
  - Clean pane header with minimalist title and discreet toggle buttons.
  - Subtle breakpoint indicators (sleek red ring/circle in gutter) and crisp active-line highlight (subtle background tint and thin left accent border, eliminating jarring flashes).
  - Modernized Monaco container styling with clean border separation.

#### D. Inspector Panels (Call Stack, Variables, Terminal)
- **Current State**: Two cramped top columns with rigid percentage headers, jarring return/exception banners, and raw monospace dump.
- **Redesign**:
  - **Call Stack**: Clean item cards or rows with subtle depth indicators, highlighting the active frame with a soft accent pill instead of heavy borders.
  - **Variables Inspector**:
    - Sleek tab toggle between `Locals` and `Globals`.
    - Modern tree/table layout with improved column spacing and subtle type pills.
    - Subtle, tasteful mutation indicator (soft green highlight on updated variables that fades naturally).
    - Refined, non-intrusive Return Value and Exception banner ribbons.
  - **Terminal / Output**:
    - Clean dark slate terminal panel with crisp JetBrains Mono output.
    - Minimalist header with discrete clear button.

#### E. Status Bar (Footer)
- **Current State**: Busy bottom bar with multiple disparate badge types.
- **Redesign**:
  - Slim, unobtrusive status bar anchored at the bottom.
  - Clean monospace indicators for current line, function context, active breakpoints, and execution time (`⚡ 4ms`).

---

## Part 3: Execution Steps

1. **Step 1: Write Exhaustive Rust Tests**
   - Implement `tests/` covering all data types, functions, classes, control flow, exceptions, and stepping logic.
   - Run `cargo test` and verify that all current engine logic passes or identify bugs to fix.
2. **Step 2: Inspect & Polish Visual Assets**
   - Audit `web/index.html` and `web/style.css` without modifying element IDs.
   - Restyle `web/style.css` using modern CSS variables, subtle palettes, refined spacing, and sleek typography.
3. **Step 3: Verification & Review**
   - Verify `cargo test` passes.
   - Check local web rendering via `serve.sh` to confirm visual appeal and full interactive stepping functionality.
