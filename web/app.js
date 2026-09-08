// Python Visual Debugger Client (Rust + WASM)

const PRESETS = {
  fibonacci: `# Recursive Fibonacci Demonstration
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print("Computing fib(4)...")
res = fib(4)
print(f"Result: {res}")
`,

  bubblesort: `# Bubble Sort with In-Place Mutation
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                # Swap elements
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

numbers = [64, 34, 25, 12, 22]
print("Initial array:", numbers)
sorted_arr = bubble_sort(numbers)
print("Sorted array:", sorted_arr)
`,

  binarysearch: `# Binary Search Algorithm
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    
    while low <= high:
        mid = (low + high) // 2
        guess = arr[mid]
        
        if guess == target:
            return mid
        elif guess > target:
            high = mid - 1
        else:
            low = mid + 1
            
    return -1

items = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target = 23
print(f"Searching for {target}...")
idx = binary_search(items, target)
print(f"Found {target} at index {idx}")
`,

  nested: `# Complex Nested Structures & Dictionaries
user = {
    "id": 1042,
    "name": "Alice",
    "roles": ["admin", "editor"],
    "profile": {
        "score": 98.5,
        "active": True,
        "metadata": { "region": "eu-west", "tier": 3 }
    }
}

tags = {"python", "rust", "wasm"}
items = [user["name"], user["profile"]["score"]]
print("User score:", user["profile"]["score"])
`,

  exceptions: `# Exception Catching & Finally Flow
def divide(a, b):
    try:
        print(f"Dividing {a} / {b}...")
        return a / b
    except ZeroDivisionError as e:
        print("Caught zero division!")
        return None
    finally:
        print("Cleanup block executed.")

val1 = divide(10, 2)
val2 = divide(5, 0)
print(f"Results: {val1}, {val2}")
`,

  loopguard: `# Safety Demonstration: Infinite Loop Guard
# RustPython debugger halts safely at step limit!
counter = 0
items = []

while True:
    counter += 1
    items.append(counter)
    if counter % 100 == 0:
        print(f"Counter reached {counter}")
`
};

class DebuggerApp {
  constructor() {
    this.editor = null;
    this.worker = null;
    this.breakpoints = new Set();
    this.breakpointDecorations = [];
    this.activeLineDecorations = [];
    
    this.traceData = null;
    this.currentStepIndex = 0;
    this.selectedFrameIndex = 0;
    this.activeScope = "locals"; // "locals" | "globals"
    this.durationMs = 0;
    this.startTime = 0;

    this.isPlaying = false;
    this.playInterval = null;
    this.expandedVars = new Set();

    this.isVimEnabled = false;
    this.vimMode = null;
    this.cachedClipboardText = "";
    this.vimRegisterController = null;
    this.vimClipboardReg = null;

    this.initElements();
    this.initWorker();
    this.initMonaco();
    this.bindEvents();
  }

  initElements() {
    this.statusDot = document.getElementById("status-dot");
    this.statusText = document.getElementById("status-text");
    this.presetSelect = document.getElementById("preset-select");
    this.stepLimit = document.getElementById("step-limit");

    this.btnRun = document.getElementById("btn-run");
    this.btnRunText = document.getElementById("btn-run-text");
    this.iconRunPlay = document.getElementById("icon-run-play");
    this.iconRunSpin = document.getElementById("icon-run-spin");

    this.btnJumpStart = document.getElementById("btn-jump-start");
    this.btnStepBack = document.getElementById("btn-step-back");
    this.btnPlay = document.getElementById("btn-play");
    this.iconPlayToggle = document.getElementById("icon-play-toggle");
    this.btnStepIn = document.getElementById("btn-step-in");
    this.btnStepOver = document.getElementById("btn-step-over");
    this.btnStepOut = document.getElementById("btn-step-out");
    this.btnContinue = document.getElementById("btn-continue");
    this.btnJumpEnd = document.getElementById("btn-jump-end");
    this.btnReset = document.getElementById("btn-reset");

    this.playbackSpeed = document.getElementById("playback-speed");
    this.scrubberCurrent = document.getElementById("scrubber-current");
    this.scrubberTotal = document.getElementById("scrubber-total");
    this.stepScrubber = document.getElementById("step-scrubber");

    this.btnVimMode = document.getElementById("btn-vim-mode");
    this.vimStatusBadge = document.getElementById("vim-status-badge");
    this.btnCopyCode = document.getElementById("btn-copy-code");
    this.btnCopyText = document.getElementById("btn-copy-text");
    this.btnPasteCode = document.getElementById("btn-paste-code");
    this.btnPasteText = document.getElementById("btn-paste-text");
    this.btnClearBps = document.getElementById("btn-clear-bps");
    this.vimStatusBar = document.getElementById("vim-status-bar");

    this.pasteModal = document.getElementById("paste-modal");
    this.pasteModalTextarea = document.getElementById("paste-modal-textarea");
    this.btnClosePasteModal = document.getElementById("btn-close-paste-modal");
    this.btnCancelPasteModal = document.getElementById("btn-cancel-paste-modal");
    this.btnConfirmPasteModal = document.getElementById("btn-confirm-paste-modal");

    this.callStackList = document.getElementById("call-stack-list");
    this.stackCount = document.getElementById("stack-count");
    this.selectedFrameLabel = document.getElementById("selected-frame-label");

    this.tabLocals = document.getElementById("tab-locals");
    this.tabGlobals = document.getElementById("tab-globals");
    this.returnAlert = document.getElementById("return-alert");
    this.returnValText = document.getElementById("return-val-text");
    this.exceptionAlert = document.getElementById("exception-alert");
    this.exceptionValText = document.getElementById("exception-val-text");
    this.variablesContainer = document.getElementById("variables-tree-container");

    this.stdoutContent = document.getElementById("stdout-content");
    this.terminalStepMsg = document.getElementById("terminal-step-msg");
    this.btnClearConsole = document.getElementById("btn-clear-console");

    this.statusEventBox = document.getElementById("status-event-box");
    this.statusLineFunc = document.getElementById("status-line-func");
    this.statusStepSummary = document.getElementById("status-step-summary");
    this.statusBpCount = document.getElementById("status-bp-count");
    this.statusDurationBox = document.getElementById("status-duration-box");
    this.statusDurationVal = document.getElementById("status-duration-val");
  }

  initWorker() {
    this.setStatus("loading", "Initializing Rust WASM...");
    this.worker = new Worker("./worker.js", { type: "module" });

    this.worker.onmessage = (e) => {
      const { type, payload, error } = e.data || {};
      if (type === "READY") {
        this.setStatus("ready", "RustPython WASM Ready");
      } else if (type === "TRACE_COMPLETE") {
        this.onTraceComplete(payload);
      } else if (type === "TRACE_ERROR") {
        this.onTraceError(error);
      } else if (type === "INIT_ERROR") {
        this.setStatus("error", "WASM Init Failed");
        console.error("WASM Init Error:", error);
      }
    };
  }

  initMonaco() {
    if (typeof require === "undefined") {
      setTimeout(() => this.initMonaco(), 100);
      return;
    }

    require.config({
      paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" }
    });

    require(["vs/editor/editor.main"], () => {
      const container = document.getElementById("monaco-editor-container");
      this.editor = monaco.editor.create(container, {
        value: PRESETS.fibonacci,
        language: "python",
        theme: "vs-dark",
        fontSize: 13,
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        lineHeight: 20,
        automaticLayout: true,
        minimap: { enabled: false },
        glyphMargin: true,
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        tabSize: 4
      });

      this.editor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const line = e.target.position.lineNumber;
          this.toggleBreakpoint(line);
        }
      });

      // Shortcut for Ctrl+Shift+V (familiar terminal paste)
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV, () => {
        this.pasteFromClipboard();
      });

      // Synchronize clipboard text when editor gains text focus or pointer down
      this.editor.onDidFocusEditorText(() => this.syncClipboard());
      container.addEventListener("pointerdown", () => this.syncClipboard());

      // Preload Monaco Vim so registers and clipboard bridges are configured early
      this.initMonacoVim();
    });
  }

  toggleBreakpoint(line) {
    if (this.breakpoints.has(line)) {
      this.breakpoints.delete(line);
    } else {
      this.breakpoints.add(line);
    }
    this.renderBreakpoints();
    this.updateBreakpointCount();
  }

  renderBreakpoints() {
    if (!this.editor) return;
    const currentStep = this.traceData?.steps?.[this.currentStepIndex];
    const currentLine = currentStep?.line;

    const decorations = Array.from(this.breakpoints).map((line) => {
      const isCurrentLine = line === currentLine;
      return {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: isCurrentLine ? "debug-breakpoint-active-glyph" : "debug-breakpoint-glyph"
        }
      };
    });

    this.breakpointDecorations = this.editor.deltaDecorations(
      this.breakpointDecorations,
      decorations
    );
  }

  clearBreakpoints() {
    this.breakpoints.clear();
    this.renderBreakpoints();
    this.updateBreakpointCount();
  }

  updateBreakpointCount() {
    const c = this.breakpoints.size;
    this.statusBpCount.textContent = `${c} breakpoint${c === 1 ? "" : "s"}`;
  }

  setStatus(state, text) {
    this.statusDot.className = `status-dot status-${state}`;
    this.statusText.textContent = text;
  }

  async initMonacoVim() {
    if (window.MonacoVim) {
      this.setupVimClipboard(window.MonacoVim);
      return window.MonacoVim;
    }
    try {
      const res = await fetch("./monaco-vim.js");
      const code = await res.text();
      const fn = new Function("exports", "module", "require", "define", "self", "window", code);
      fn(undefined, undefined, undefined, undefined, window, window);
      this.setupVimClipboard(window.MonacoVim);
      return window.MonacoVim;
    } catch (err) {
      console.error("Failed to load monaco-vim:", err);
      return null;
    }
  }

  setupVimClipboard(mv) {
    if (!mv || !mv.VimMode || !mv.VimMode.Vim) return;
    const Vim = mv.VimMode.Vim;

    // 1. Unmap Ctrl-v and Ctrl-c so browser native paste & copy pass through to Monaco
    try {
      Vim.unmap("<C-v>");
      Vim.unmap("<C-v>", "insert");
      Vim.unmap("<C-v>", "visual");
    } catch {}

    try {
      Vim.unmap("<C-c>");
      Vim.unmap("<C-c>", "insert");
      Vim.unmap("<C-c>", "visual");
    } catch {}

    const rc = Vim.getRegisterController();
    this.vimRegisterController = rc;

    // 2. Define "+" and "*" registers if not already defined
    if (!rc.isValidRegister("+")) {
      const self = this;
      const clipboardReg = {
        keyBuffer: [this.cachedClipboardText || ""],
        insertModeChanges: [],
        searchQueries: [],
        linewise: (this.cachedClipboardText || "").endsWith("\n"),
        blockwise: false,
        setText: function(text, linewise, blockwise) {
          this.keyBuffer = [text || ""];
          this.linewise = !!linewise;
          this.blockwise = !!blockwise;
          self.cachedClipboardText = text || "";
          if (text && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
        },
        pushText: function(text, linewise) {
          if (linewise) {
            if (!this.linewise) this.keyBuffer.push("\n");
            this.linewise = true;
          }
          this.keyBuffer.push(text);
          const full = this.keyBuffer.join("");
          self.cachedClipboardText = full;
          if (full && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(full).catch(() => {});
          }
        },
        pushInsertModeChanges: function() {},
        pushSearchQuery: function() {},
        clear: function() {
          this.keyBuffer = [];
          this.linewise = false;
          this.blockwise = false;
        },
        toString: function() {
          return this.keyBuffer.join("");
        }
      };

      Vim.defineRegister("+", clipboardReg);
      Vim.defineRegister("*", clipboardReg);
      this.vimClipboardReg = clipboardReg;
    }

    // 3. Hook pushText to write to system clipboard automatically on unnamed yank/delete (unnamedplus)
    if (!rc._systemClipboardHooked) {
      rc._systemClipboardHooked = true;
      const origPushText = rc.pushText;
      const self = this;
      rc.pushText = function(registerName, operator, text, linewise, isBlock) {
        origPushText.call(this, registerName, operator, text, linewise, isBlock);
        if (text && (!registerName || registerName === "+" || registerName === "*")) {
          self.cachedClipboardText = text;
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
          if (self.vimClipboardReg) {
            self.vimClipboardReg.keyBuffer = [text];
            self.vimClipboardReg.linewise = !!linewise;
          }
        }
      };
    }

    // 4. Wrap Vim paste action so p, P, "+p, "*p read the latest system clipboard
    if (!Vim._pasteActionHooked && Vim._actions?.paste) {
      Vim._pasteActionHooked = true;
      const origPaste = Vim._actions.paste;
      const self = this;
      Vim.defineAction("paste", async function(cm, actionArgs, vimState) {
        const reg = actionArgs.registerName;
        if (!reg || reg === "+" || reg === "*") {
          try {
            if (navigator.clipboard?.readText) {
              const clip = await navigator.clipboard.readText();
              if (typeof clip === "string" && clip.length > 0) {
                self.updateVimClipboard(clip);
              }
            }
          } catch {}
        }
        return origPaste(cm, actionArgs, vimState);
      });
    }

    this.syncClipboard();
  }

  async syncClipboard() {
    if (!navigator.clipboard?.readText) return null;
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === "string" && text.length > 0) {
        this.updateVimClipboard(text);
        return text;
      }
    } catch {
      // Focus or permission restricted
    }
    return null;
  }

  updateVimClipboard(text) {
    if (typeof text !== "string") return;
    this.cachedClipboardText = text;
    const isLinewise = text.endsWith("\n");
    if (this.vimClipboardReg) {
      this.vimClipboardReg.keyBuffer = [text];
      this.vimClipboardReg.linewise = isLinewise;
    }
    if (this.vimRegisterController?.unnamedRegister) {
      this.vimRegisterController.unnamedRegister.keyBuffer = [text];
      this.vimRegisterController.unnamedRegister.linewise = isLinewise;
    }
  }

  async pasteFromClipboard() {
    if (!this.editor) return;
    let pasted = false;
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (typeof text === "string" && text.length > 0) {
          this.insertTextAtCursor(text);
          this.updateVimClipboard(text);
          this.showActionFeedback(this.btnPasteText, "Pasted!", "Paste");
          pasted = true;
        }
      }
    } catch (err) {
      console.warn("Direct clipboard read unavailable:", err);
    }
    if (!pasted) {
      this.openPasteModal();
    }
  }

  async copyToClipboard() {
    if (!this.editor) return;
    const selection = this.editor.getSelection();
    let text = "";
    if (selection && !selection.isEmpty()) {
      text = this.editor.getModel().getValueInRange(selection);
    } else {
      text = this.editor.getValue();
    }
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.updateVimClipboard(text);
        this.showActionFeedback(this.btnCopyText, "Copied!", "Copy");
        return;
      }
    } catch {}

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      this.updateVimClipboard(text);
      this.showActionFeedback(this.btnCopyText, "Copied!", "Copy");
    } finally {
      document.body.removeChild(ta);
    }
  }

  insertTextAtCursor(text) {
    if (!this.editor) return;
    const selection = this.editor.getSelection();
    if (selection && !selection.isEmpty()) {
      this.editor.executeEdits("paste-handler", [{
        range: selection,
        text: text,
        forceMoveMarkers: true
      }]);
    } else {
      const pos = this.editor.getPosition() || { lineNumber: 1, column: 1 };
      const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
      this.editor.executeEdits("paste-handler", [{
        range: range,
        text: text,
        forceMoveMarkers: true
      }]);
    }
    this.editor.focus();
  }

  openPasteModal() {
    if (!this.pasteModal) return;
    this.pasteModal.classList.remove("hidden");
    if (this.pasteModalTextarea) {
      this.pasteModalTextarea.value = "";
      setTimeout(() => this.pasteModalTextarea.focus(), 50);
    }
  }

  closePasteModal() {
    if (!this.pasteModal) return;
    this.pasteModal.classList.add("hidden");
    if (this.editor) this.editor.focus();
  }

  confirmPasteModal() {
    const text = this.pasteModalTextarea?.value;
    if (text) {
      this.insertTextAtCursor(text);
      this.updateVimClipboard(text);
      this.showActionFeedback(this.btnPasteText, "Pasted!", "Paste");
    }
    this.closePasteModal();
  }

  showActionFeedback(el, feedbackText, defaultText) {
    if (!el) return;
    el.textContent = feedbackText;
    const btn = el.closest(".btn-header-action");
    if (btn) btn.classList.add("action-success");
    setTimeout(() => {
      el.textContent = defaultText;
      if (btn) btn.classList.remove("action-success");
    }, 1500);
  }

  async toggleVimMode() {
    if (this.isVimEnabled) {
      this.disableVimMode();
    } else {
      await this.enableVimMode();
    }
  }

  async enableVimMode() {
    if (!this.editor) return;
    const mv = await this.initMonacoVim();
    if (!mv) return;

    this.vimStatusBar.classList.remove("hidden");
    this.vimMode = mv.initVimMode(this.editor, this.vimStatusBar);
    this.isVimEnabled = true;

    this.btnVimMode.classList.add("active");
    this.vimStatusBadge.textContent = "ON";
    this.vimStatusBadge.className = "vim-badge on";
    this.setupVimClipboard(mv);
    this.editor.focus();
  }

  disableVimMode() {
    if (this.vimMode) {
      this.vimMode.dispose();
      this.vimMode = null;
    }
    this.vimStatusBar.classList.add("hidden");
    this.vimStatusBar.innerHTML = "";
    this.isVimEnabled = false;

    this.btnVimMode.classList.remove("active");
    this.vimStatusBadge.textContent = "OFF";
    this.vimStatusBadge.className = "vim-badge off";
    if (this.editor) this.editor.focus();
  }

  bindEvents() {
    this.btnRun.addEventListener("click", () => this.runTrace());
    this.btnVimMode.addEventListener("click", () => this.toggleVimMode());
    this.btnCopyCode?.addEventListener("click", () => this.copyToClipboard());
    this.btnPasteCode?.addEventListener("click", () => this.pasteFromClipboard());
    this.btnClearBps.addEventListener("click", () => this.clearBreakpoints());
    this.btnClearConsole.addEventListener("click", () => {
      this.stdoutContent.innerHTML = `<span class="term-greeting">Console cleared.</span>`;
    });

    // Paste Modal events
    this.btnClosePasteModal?.addEventListener("click", () => this.closePasteModal());
    this.btnCancelPasteModal?.addEventListener("click", () => this.closePasteModal());
    this.btnConfirmPasteModal?.addEventListener("click", () => this.confirmPasteModal());
    this.pasteModal?.addEventListener("click", (e) => {
      if (e.target === this.pasteModal) this.closePasteModal();
    });
    this.pasteModalTextarea?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.confirmPasteModal();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closePasteModal();
      }
    });

    // Global clipboard listeners for continuous sync
    window.addEventListener("focus", () => this.syncClipboard());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.syncClipboard();
    });
    window.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        this.updateVimClipboard(text);
      }
    });
    window.addEventListener("copy", () => {
      setTimeout(() => this.syncClipboard(), 60);
    });

    this.presetSelect.addEventListener("change", (e) => {
      const code = PRESETS[e.target.value];
      if (code && this.editor) {
        this.editor.setValue(code);
        this.resetPlayback();
      }
    });

    // Stepping controls
    this.btnJumpStart.addEventListener("click", () => this.jumpToStep(0));
    this.btnStepBack.addEventListener("click", () => this.stepBack());
    this.btnPlay.addEventListener("click", () => this.togglePlay());
    this.btnStepIn.addEventListener("click", () => this.stepIn());
    this.btnStepOver.addEventListener("click", () => this.stepOver());
    this.btnStepOut.addEventListener("click", () => this.stepOut());
    this.btnContinue.addEventListener("click", () => this.continueToBreakpoint());
    this.btnJumpEnd.addEventListener("click", () => this.jumpToEnd());
    this.btnReset.addEventListener("click", () => this.resetPlayback());

    this.stepScrubber.addEventListener("input", (e) => {
      this.jumpToStep(parseInt(e.target.value, 10));
    });

    // Scope tabs
    this.tabLocals.addEventListener("click", () => {
      this.activeScope = "locals";
      this.tabLocals.classList.add("active");
      this.tabGlobals.classList.remove("active");
      this.renderVariables();
    });

    this.tabGlobals.addEventListener("click", () => {
      this.activeScope = "globals";
      this.tabGlobals.classList.add("active");
      this.tabLocals.classList.remove("active");
      this.renderVariables();
    });

    // Global keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.runTrace();
        return;
      }
      if (!this.traceData || !this.traceData.steps?.length) return;

      const inEditor = document.activeElement && document.activeElement.closest(".editor-pane");

      if (e.key === "F5") {
        e.preventDefault();
        this.continueToBreakpoint();
      } else if (e.key === "F9" || (e.altKey && e.key === "ArrowLeft")) {
        e.preventDefault();
        this.stepBack();
      } else if (e.key === "F10") {
        e.preventDefault();
        this.stepOver();
      } else if (e.key === "F11" && !e.shiftKey) {
        e.preventDefault();
        this.stepIn();
      } else if (e.key === "F11" && e.shiftKey) {
        e.preventDefault();
        this.stepOut();
      } else if (e.key === "Home" && !inEditor) {
        e.preventDefault();
        this.jumpToStep(0);
      } else if (e.key === "End" && !inEditor) {
        e.preventDefault();
        this.jumpToEnd();
      } else if (e.code === "Space" && !inEditor) {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  runTrace() {
    if (!this.editor) return;
    const code = this.editor.getValue();
    const maxSteps = parseInt(this.stepLimit.value, 10) || 2500;

    this.stopPlay();
    this.setStatus("running", "Tracing execution in WASM...");
    this.btnRun.disabled = true;
    this.btnRunText.textContent = "Tracing...";
    this.iconRunPlay.classList.add("hidden");
    this.iconRunSpin.classList.remove("hidden");
    this.startTime = performance.now();

    this.worker.postMessage({
      type: "RUN",
      code,
      maxSteps,
      id: Date.now()
    });
  }

  onTraceComplete(payload) {
    this.durationMs = Math.round(performance.now() - this.startTime);
    this.btnRun.disabled = false;
    this.btnRunText.textContent = "Retrace";
    this.iconRunPlay.classList.remove("hidden");
    this.iconRunSpin.classList.add("hidden");

    this.traceData = payload;

    if (!payload.steps || payload.steps.length === 0) {
      this.setStatus("ready", "Execution complete (0 steps)");
      this.resetPlayback();
      return;
    }

    const count = payload.steps.length;
    let statusMsg = `Recorded ${count} steps in ${this.durationMs}ms`;
    if (payload.truncated) {
      statusMsg += " [Limit Reached]";
    } else if (payload.error) {
      statusMsg += ` [Error: ${payload.error}]`;
    }

    this.setStatus("paused", statusMsg);
    this.stepScrubber.max = count - 1;
    this.stepScrubber.disabled = false;
    this.scrubberTotal.textContent = count;
    this.enableControls(true);

    this.statusDurationBox.classList.remove("hidden");
    this.statusDurationVal.textContent = this.durationMs;

    this.jumpToStep(0);
  }

  onTraceError(err) {
    this.btnRun.disabled = false;
    this.btnRunText.textContent = "Run & Trace";
    this.iconRunPlay.classList.remove("hidden");
    this.iconRunSpin.classList.add("hidden");

    this.setStatus("error", "Execution Failed");
    this.stdoutContent.innerHTML = `<span style="color: var(--accent-rose);">Execution Error:\n${this.escapeHtml(err)}</span>`;
  }

  enableControls(enabled) {
    this.btnJumpStart.disabled = !enabled;
    this.btnStepBack.disabled = !enabled;
    this.btnPlay.disabled = !enabled;
    this.btnStepIn.disabled = !enabled;
    this.btnStepOver.disabled = !enabled;
    this.btnStepOut.disabled = !enabled;
    this.btnContinue.disabled = !enabled;
    this.btnJumpEnd.disabled = !enabled;
    this.btnReset.disabled = !enabled;
  }

  resetPlayback() {
    this.stopPlay();
    this.traceData = null;
    this.currentStepIndex = 0;
    this.selectedFrameIndex = 0;
    this.stepScrubber.value = 0;
    this.stepScrubber.max = 0;
    this.stepScrubber.disabled = true;
    this.scrubberCurrent.textContent = "0";
    this.scrubberTotal.textContent = "0";
    this.btnRunText.textContent = "Run & Trace";
    this.enableControls(false);

    if (this.editor) {
      this.activeLineDecorations = this.editor.deltaDecorations(this.activeLineDecorations, []);
    }

    this.callStackList.innerHTML = `<li class="empty-notice">Stack is empty</li>`;
    this.stackCount.textContent = "0 frames";
    this.selectedFrameLabel.textContent = "global";
    this.variablesContainer.innerHTML = `<div class="empty-notice">No variables in scope</div>`;
    this.returnAlert.classList.add("hidden");
    this.exceptionAlert.classList.add("hidden");
    this.statusEventBox.classList.add("hidden");
    this.statusLineFunc.textContent = "Ready";
    this.statusStepSummary.textContent = "";
    this.statusDurationBox.classList.add("hidden");
    this.terminalStepMsg.textContent = "— Ready";
    this.renderBreakpoints();
  }

  jumpToStep(index) {
    if (!this.traceData || !this.traceData.steps || index < 0 || index >= this.traceData.steps.length) {
      return;
    }

    this.currentStepIndex = index;
    this.stepScrubber.value = index;
    const step = this.traceData.steps[index];
    
    // Auto-select topmost frame on step change
    if (step && step.stack && step.stack.length > 0) {
      this.selectedFrameIndex = step.stack.length - 1;
    } else {
      this.selectedFrameIndex = 0;
    }

    this.updateUIForCurrentStep();
  }

  stepIn() {
    if (!this.traceData) return;
    if (this.currentStepIndex < this.traceData.steps.length - 1) {
      this.jumpToStep(this.currentStepIndex + 1);
    } else {
      this.stopPlay();
    }
  }

  stepBack() {
    if (!this.traceData) return;
    if (this.currentStepIndex > 0) {
      this.jumpToStep(this.currentStepIndex - 1);
    }
  }

  stepOver() {
    if (!this.traceData) return;
    const steps = this.traceData.steps;
    const current = steps[this.currentStepIndex];
    const currentDepth = current.stack ? current.stack.length : 1;

    for (let i = this.currentStepIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      const depth = step.stack ? step.stack.length : 1;
      if (depth <= currentDepth && step.line !== current.line) {
        this.jumpToStep(i);
        return;
      }
    }
    this.jumpToEnd();
  }

  stepOut() {
    if (!this.traceData) return;
    const steps = this.traceData.steps;
    const current = steps[this.currentStepIndex];
    const currentDepth = current.stack ? current.stack.length : 1;

    for (let i = this.currentStepIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      const depth = step.stack ? step.stack.length : 1;
      if (depth < currentDepth) {
        this.jumpToStep(i);
        return;
      }
    }
    this.jumpToEnd();
  }

  continueToBreakpoint() {
    if (!this.traceData) return;
    const steps = this.traceData.steps;

    for (let i = this.currentStepIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      if (this.breakpoints.has(step.line)) {
        this.jumpToStep(i);
        return;
      }
    }
    this.jumpToEnd();
  }

  jumpToEnd() {
    if (!this.traceData || !this.traceData.steps) return;
    this.jumpToStep(this.traceData.steps.length - 1);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  }

  startPlay() {
    if (!this.traceData) return;
    if (this.currentStepIndex >= this.traceData.steps.length - 1) {
      this.jumpToStep(0);
    }

    this.isPlaying = true;
    this.iconPlayToggle.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
    this.btnPlay.title = "Pause Auto-Step (Space)";

    const delay = parseInt(this.playbackSpeed.value, 10) || 600;
    this.playInterval = setInterval(() => {
      if (this.currentStepIndex < this.traceData.steps.length - 1) {
        this.stepIn();
      } else {
        this.stopPlay();
      }
    }, delay);
  }

  stopPlay() {
    this.isPlaying = false;
    this.iconPlayToggle.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
    this.btnPlay.title = "Auto-play Stepper (Space)";
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  updateUIForCurrentStep() {
    const steps = this.traceData.steps;
    const step = steps[this.currentStepIndex];
    const total = steps.length;

    this.scrubberCurrent.textContent = this.currentStepIndex + 1;

    // Highlight active line in Monaco
    if (this.editor && step.line) {
      this.activeLineDecorations = this.editor.deltaDecorations(this.activeLineDecorations, [
        {
          range: new monaco.Range(step.line, 1, step.line, 1),
          options: {
            isWholeLine: true,
            className: "debug-active-line",
            glyphMarginClassName: "debug-active-gutter"
          }
        }
      ]);
      this.editor.revealLineInCenterIfOutsideViewport(step.line);
    }

    this.renderBreakpoints();
    this.renderCallStack(step);
    this.renderVariables(step);
    this.renderStdout(step);
    this.updateBottomStatusBar(step, total);
  }

  updateBottomStatusBar(step, total) {
    this.statusEventBox.classList.remove("hidden");
    this.statusEventBox.textContent = step.event;

    // Color event badge
    if (step.event === "line") {
      this.statusEventBox.style.background = "rgba(59, 130, 246, 0.3)";
      this.statusEventBox.style.color = "#93c5fd";
    } else if (step.event === "call") {
      this.statusEventBox.style.background = "rgba(168, 85, 247, 0.3)";
      this.statusEventBox.style.color = "#d8b4fe";
    } else if (step.event === "return") {
      this.statusEventBox.style.background = "rgba(16, 185, 129, 0.3)";
      this.statusEventBox.style.color = "#6ee7b7";
    } else if (step.event === "exception") {
      this.statusEventBox.style.background = "rgba(244, 63, 94, 0.3)";
      this.statusEventBox.style.color = "#fda4af";
    }

    const topFrame = step.stack ? step.stack[step.stack.length - 1] : null;
    const funcName = topFrame && topFrame.func !== "<module>" ? `${topFrame.func}()` : "global";
    this.statusLineFunc.textContent = `Line ${step.line} in ${funcName}`;
    this.statusStepSummary.textContent = `(Step ${this.currentStepIndex + 1} / ${total})`;
    this.terminalStepMsg.textContent = `— Step ${this.currentStepIndex + 1} of ${total}`;
  }

  renderCallStack(step) {
    const stack = step.stack || [];
    this.stackCount.textContent = `${stack.length} frame${stack.length === 1 ? "" : "s"}`;

    if (stack.length === 0) {
      this.callStackList.innerHTML = `<li class="empty-notice">Stack is empty</li>`;
      return;
    }

    const rows = stack.map((frame, idx) => {
      const isSelected = this.selectedFrameIndex === idx;
      const isTop = idx === stack.length - 1;
      const frameName = frame.func === "<module>" ? "Global / <module>" : `${frame.func}()`;

      return `
        <li class="stack-row ${isSelected ? "selected" : ""}" data-index="${idx}">
          <div class="stack-name-box">
            <span class="stack-index">#${stack.length - idx}</span>
            <span class="stack-func-name">${this.escapeHtml(frameName)}</span>
            ${isTop ? '<span class="active-pill">Active</span>' : ""}
          </div>
          <span class="stack-line-tag">:${frame.line}</span>
        </li>
      `;
    }).reverse();

    this.callStackList.innerHTML = rows.join("");

    this.callStackList.querySelectorAll(".stack-row").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        this.selectedFrameIndex = idx;
        this.renderCallStack(step);
        this.renderVariables(step);
      });
    });
  }

  renderVariables(step = null) {
    if (!step && this.traceData && this.traceData.steps) {
      step = this.traceData.steps[this.currentStepIndex];
    }
    if (!step) return;

    const stack = step.stack || [];
    const selectedFrame = stack[this.selectedFrameIndex] || stack[stack.length - 1];
    const frameName = selectedFrame ? (selectedFrame.func === "<module>" ? "global" : `${selectedFrame.func}()`) : "global";
    this.selectedFrameLabel.textContent = frameName;

    const currentVars = this.activeScope === "locals" ? (step.locals || {}) : (step.globals || {});
    
    // Previous step comparison for mutated badge
    let prevVars = {};
    if (this.currentStepIndex > 0) {
      const prevStep = this.traceData.steps[this.currentStepIndex - 1];
      prevVars = this.activeScope === "locals" ? (prevStep.locals || {}) : (prevStep.globals || {});
    }

    // Return & Exception alerts
    if (step.event === "return" && step.return_value) {
      this.returnAlert.classList.remove("hidden");
      this.returnValText.textContent = `-> ${step.return_value.repr}`;
    } else {
      this.returnAlert.classList.add("hidden");
    }

    if (step.exception) {
      this.exceptionAlert.classList.remove("hidden");
      this.exceptionValText.textContent = step.exception;
    } else {
      this.exceptionAlert.classList.add("hidden");
    }

    const varKeys = Object.keys(currentVars);
    if (varKeys.length === 0) {
      this.variablesContainer.innerHTML = `<div class="empty-notice">No ${this.activeScope} variables in scope</div>`;
      return;
    }

    const html = varKeys.map((k) => {
      const cur = currentVars[k];
      const prev = prevVars[k];
      const isMutated = !prev || prev.repr !== cur.repr;
      const typeClass = `type-${cur.type || "unknown"}`;
      const hasChildren = (cur.children && cur.children.length > 0) || (cur.entries && Object.keys(cur.entries).length > 0);
      const isExpanded = this.expandedVars.has(k);

      let childrenHtml = "";
      if (hasChildren && isExpanded) {
        if (cur.children) {
          const items = cur.children.map((c, i) => `
            <div class="child-row">
              <span class="child-key">[${i}]</span>
              <span class="child-val">${this.escapeHtml(c.repr)}</span>
            </div>
          `).join("");
          childrenHtml = `<div class="var-children-box">${items}</div>`;
        } else if (cur.entries) {
          const items = Object.entries(cur.entries).map(([key, val]) => `
            <div class="child-row">
              <span class="child-key">${this.escapeHtml(key)}:</span>
              <span class="child-val">${this.escapeHtml(val.repr)}</span>
            </div>
          `).join("");
          childrenHtml = `<div class="var-children-box">${items}</div>`;
        }
      }

      return `
        <div class="var-item ${isMutated ? "is-mutated" : ""}">
          <div class="var-main-row">
            <div class="var-name-col">
              ${hasChildren ? `
                <button class="caret-btn" data-toggle="${this.escapeHtml(k)}">
                  ${isExpanded ? "▼" : "▶"}
                </button>
              ` : '<span style="width: 14px;"></span>'}
              <span class="var-name-text">${this.escapeHtml(k)}</span>
              ${isMutated ? '<span class="changed-badge">changed</span>' : ""}
            </div>
            <div class="var-type-col">
              <span class="${typeClass}">${this.escapeHtml(cur.type || "obj")}</span>
            </div>
            <div class="var-val-col" title="${this.escapeHtml(cur.repr)}">
              ${this.escapeHtml(cur.repr)}
            </div>
          </div>
          ${childrenHtml}
        </div>
      `;
    }).join("");

    this.variablesContainer.innerHTML = html;

    // Bind caret expand clicks
    this.variablesContainer.querySelectorAll(".caret-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.getAttribute("data-toggle");
        if (this.expandedVars.has(key)) {
          this.expandedVars.delete(key);
        } else {
          this.expandedVars.add(key);
        }
        this.renderVariables(step);
      });
    });
  }

  renderStdout(step) {
    const text = step.stdout || "";
    if (!text.trim()) {
      this.stdoutContent.innerHTML = `<span class="term-greeting">RustPython 3.12 WebAssembly Environment\n<span style="color: #4b5563;">(No output generated up to this step)</span></span>`;
    } else {
      this.stdoutContent.textContent = text;
    }
    this.stdoutContent.parentElement.scrollTop = this.stdoutContent.parentElement.scrollHeight;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Mount application
window.addEventListener("DOMContentLoaded", () => {
  window.debuggerApp = new DebuggerApp();
});
