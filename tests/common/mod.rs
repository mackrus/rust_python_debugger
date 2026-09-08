#![allow(dead_code)]

use rust_python_debugger::DebuggerEngine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ValueInfo {
    pub r#type: String,
    pub repr: String,
    #[serde(default)]
    pub val: Option<serde_json::Value>,
    #[serde(default)]
    pub children: Option<Vec<ValueInfo>>,
    #[serde(default)]
    pub entries: Option<HashMap<String, ValueInfo>>,
    #[serde(default)]
    pub len: Option<usize>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct StackEntry {
    pub func: String,
    pub line: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Step {
    pub step: usize,
    pub event: String,
    pub line: usize,
    pub func: String,
    pub stack: Vec<StackEntry>,
    pub locals: HashMap<String, ValueInfo>,
    pub globals: HashMap<String, ValueInfo>,
    pub return_value: Option<ValueInfo>,
    pub exception: Option<String>,
    pub stdout: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TraceOutput {
    pub steps: Vec<Step>,
    pub stdout: String,
    pub total_steps: usize,
    pub truncated: bool,
    pub error: Option<String>,
}

pub fn run_code(code: &str) -> TraceOutput {
    run_code_with_limit(code, 2500)
}

pub fn run_code_with_limit(code: &str, max_steps: usize) -> TraceOutput {
    let engine = DebuggerEngine::new(max_steps);
    let json_str = engine
        .trace(code, Some(max_steps))
        .expect("Debugger trace execution failed");
    serde_json::from_str::<TraceOutput>(&json_str)
        .unwrap_or_else(|err| panic!("Failed to parse trace JSON: {}\nRaw JSON: {}", err, json_str))
}

pub fn step_in(steps: &[Step], current: usize) -> usize {
    if current + 1 < steps.len() {
        current + 1
    } else {
        current
    }
}

pub fn step_back(current: usize) -> usize {
    if current > 0 {
        current - 1
    } else {
        0
    }
}

pub fn step_over(steps: &[Step], current: usize) -> usize {
    if current >= steps.len() {
        return steps.len().saturating_sub(1);
    }
    let curr = &steps[current];
    let current_depth = curr.stack.len().max(1);

    for i in (current + 1)..steps.len() {
        let step = &steps[i];
        let depth = step.stack.len().max(1);
        if depth <= current_depth && step.line != curr.line {
            return i;
        }
    }
    steps.len().saturating_sub(1)
}

pub fn step_out(steps: &[Step], current: usize) -> usize {
    if current >= steps.len() {
        return steps.len().saturating_sub(1);
    }
    let curr = &steps[current];
    let current_depth = curr.stack.len().max(1);

    for i in (current + 1)..steps.len() {
        let step = &steps[i];
        let depth = step.stack.len().max(1);
        if depth < current_depth {
            return i;
        }
    }
    steps.len().saturating_sub(1)
}

pub fn continue_to_breakpoint(steps: &[Step], current: usize, breakpoints: &[usize]) -> usize {
    for i in (current + 1)..steps.len() {
        if breakpoints.contains(&steps[i].line) {
            return i;
        }
    }
    steps.len().saturating_sub(1)
}
