mod common;
use common::*;

#[test]
fn test_function_args_and_kwargs() {
    let code = r#"
def add(a, b, c=10, *args, **kwargs):
    s = a + b + c
    for x in args:
        s += x
    for k, v in kwargs.items():
        s += v
    return s

res = add(1, 2, 3, 4, 5, extra=6)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("res").unwrap().repr, "21");

    // Check that inside the function call, locals contain parameters
    let in_func = output.steps.iter().find(|s| s.func == "add" && s.event == "line");
    assert!(in_func.is_some());
    let locals = &in_func.unwrap().locals;
    assert_eq!(locals.get("a").unwrap().repr, "1");
    assert_eq!(locals.get("b").unwrap().repr, "2");
    assert_eq!(locals.get("c").unwrap().repr, "3");
}

#[test]
fn test_recursion_factorial_and_fibonacci() {
    let code = r#"
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

f5 = factorial(5)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("f5").unwrap().repr, "120");

    // Max stack depth should be >= 6 (<module> + 5 frames of factorial)
    let max_depth = output.steps.iter().map(|s| s.stack.len()).max().unwrap_or(0);
    assert!(max_depth >= 6, "Expected max stack depth >= 6, got {}", max_depth);
}

#[test]
fn test_mutual_recursion() {
    let code = r#"
def is_even(n):
    if n == 0:
        return True
    return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    return is_even(n - 1)

res = is_even(4)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("res").unwrap().repr, "True");
}

#[test]
fn test_closures_and_lexical_scoping() {
    let code = r#"
def make_multiplier(factor):
    def multiply(x):
        return x * factor
    return multiply

double = make_multiplier(2)
val = double(10)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("val").unwrap().repr, "20");
}

#[test]
fn test_lambdas_and_higher_order_functions() {
    let code = r#"
ops = [lambda x: x + 1, lambda x: x * 2, lambda x: x ** 2]
acc = 5
for op in ops:
    acc = op(acc)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    // 5 -> 6 -> 12 -> 144
    assert_eq!(last.globals.get("acc").unwrap().repr, "144");
}

#[test]
fn test_return_events_and_call_resolution() {
    let code = r#"
def calc(x):
    return x * 3

ans = calc(7)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);

    // Verify caller gets the computed value
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("ans").unwrap().repr, "21");

    // Verify return event occurs for calc
    let ret_step = output.steps.iter().find(|s| s.func == "calc" && s.event == "return");
    assert!(ret_step.is_some());
    assert_eq!(ret_step.unwrap().line, 3);
}
