mod common;
use common::*;

#[test]
fn test_step_over_function_call_primitives() {
    let code = r#"
def compute(a, b):
    temp = a * 2
    res = temp + b
    return res

x = 10
y = compute(x, 5)
z = y + 1
"#;
    let output = run_code(code);
    let steps = &output.steps;

    // Find step on line 8 (`y = compute(x, 5)`)
    let call_step_idx = steps.iter().position(|s| s.line == 8 && s.func == "<module>").unwrap();
    assert_eq!(steps[call_step_idx].stack.len(), 1);

    // Step over should jump directly to line 9 (`z = y + 1`), skipping lines 2, 3, 4 of compute
    let next_idx = step_over(steps, call_step_idx);
    assert_eq!(steps[next_idx].line, 9);
    assert_eq!(steps[next_idx].func, "<module>");
    assert_eq!(steps[next_idx].globals.get("y").unwrap().repr, "25");
}

#[test]
fn test_step_over_collections_and_mutations() {
    let code = r#"
def mutate_data(lst, d):
    lst.append(999)
    d["key"] = "modified"
    return len(lst)

items = [1, 2, 3]
info = {"key": "original"}
count = mutate_data(items, info)
print(count)
"#;
    let output = run_code(code);
    let steps = &output.steps;

    let call_idx = steps.iter().position(|s| s.line == 9 && s.func == "<module>").unwrap();
    let next_idx = step_over(steps, call_idx);

    assert_eq!(steps[next_idx].line, 10);
    assert_eq!(steps[next_idx].func, "<module>");
    assert_eq!(steps[next_idx].globals.get("count").unwrap().repr, "4");
    assert_eq!(steps[next_idx].globals.get("items").unwrap().len, Some(4));
    let info = steps[next_idx].globals.get("info").unwrap();
    assert_eq!(info.entries.as_ref().unwrap().get("key").unwrap().repr, "'modified'");
}

#[test]
fn test_step_over_class_instantiation_and_methods() {
    let code = r#"
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

acc = Account("Alice", 100)
new_bal = acc.deposit(50)
done = True
"#;
    let output = run_code(code);
    let steps = &output.steps;

    // Step over class instantiation line 11
    let init_call_idx = steps.iter().position(|s| s.line == 11 && s.func == "<module>").unwrap();
    let after_init = step_over(steps, init_call_idx);
    assert_eq!(steps[after_init].line, 12);
    assert_eq!(steps[after_init].func, "<module>");
    assert_eq!(steps[after_init].globals.get("acc").unwrap().r#type, "Account");

    // Step over method deposit line 12
    let after_deposit = step_over(steps, after_init);
    assert_eq!(steps[after_deposit].line, 13);
    assert_eq!(steps[after_deposit].func, "<module>");
    assert_eq!(steps[after_deposit].globals.get("new_bal").unwrap().repr, "150");
}

#[test]
fn test_step_out_of_function() {
    let code = r#"
def helper(x):
    y = x * 2
    z = y + 3
    return z

def caller():
    val = helper(5)
    return val

res = caller()
"#;
    let output = run_code(code);
    let steps = &output.steps;

    // Find a step inside helper (depth 3: <module>, caller, helper)
    let inside_helper = steps.iter().position(|s| s.func == "helper" && s.line == 3).unwrap();
    assert_eq!(steps[inside_helper].stack.len(), 3);

    // Step out of helper should return to caller (depth 2)
    let stepped_out = step_out(steps, inside_helper);
    assert_eq!(steps[stepped_out].stack.len(), 2);
    assert_eq!(steps[stepped_out].func, "caller");

    // Step out of caller should return to module (depth 1)
    let stepped_out_root = step_out(steps, stepped_out);
    assert_eq!(steps[stepped_out_root].stack.len(), 1);
    assert_eq!(steps[stepped_out_root].func, "<module>");
}

#[test]
fn test_step_out_from_root_module() {
    let code = r#"
a = 1
b = 2
c = 3
"#;
    let output = run_code(code);
    let steps = &output.steps;

    // Stepping out from root frame jumps to end
    let stepped_out = step_out(steps, 1);
    assert_eq!(stepped_out, steps.len() - 1);
}

#[test]
fn test_step_in_enters_functions() {
    let code = r#"
def greet(name):
    msg = "Hello " + name
    return msg

val = greet("World")
"#;
    let output = run_code(code);
    let steps = &output.steps;

    let call_line_idx = steps.iter().position(|s| s.line == 6 && s.func == "<module>").unwrap();
    let stepped_in = step_in(steps, call_line_idx);

    // Should enter greet function
    assert_eq!(steps[stepped_in].func, "greet");
    assert_eq!(steps[stepped_in].stack.len(), 2);
}

#[test]
fn test_step_back_time_travel() {
    let code = r#"
x = 1
x = 2
x = 3
"#;
    let output = run_code(code);
    let steps = &output.steps;

    let at_3 = steps.iter().position(|s| s.line == 4).unwrap();
    assert_eq!(steps[at_3].globals.get("x").unwrap().repr, "2");

    let at_2 = step_back(at_3);
    assert_eq!(steps[at_2].globals.get("x").unwrap().repr, "1");

    let at_1 = step_back(at_2);
    assert!(steps[at_1].globals.get("x").is_none());
}

#[test]
fn test_continue_to_breakpoint() {
    let code = r#"
def work(n):
    total = 0
    for i in range(n):
        total += i
    return total

r1 = work(3)
r2 = work(5)
"#;
    let output = run_code(code);
    let steps = &output.steps;

    let breakpoints = vec![5]; // line `total += i` inside loop
    let mut hit_count = 0;
    let mut current = 0;

    loop {
        let next = continue_to_breakpoint(steps, current, &breakpoints);
        if next == current || next == steps.len() - 1 {
            break;
        }
        assert_eq!(steps[next].line, 5);
        hit_count += 1;
        current = next;
    }

    // Loop runs 3 times in work(3) + 5 times in work(5) = 8 hits
    assert_eq!(hit_count, 8);
}
