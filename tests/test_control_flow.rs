mod common;
use common::*;

#[test]
fn test_if_elif_else_branching() {
    let code = r#"
def classify(val):
    if val < 0:
        return "negative"
    elif val == 0:
        return "zero"
    else:
        return "positive"

c1 = classify(-5)
c2 = classify(0)
c3 = classify(10)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("c1").unwrap().repr, "'negative'");
    assert_eq!(g.get("c2").unwrap().repr, "'zero'");
    assert_eq!(g.get("c3").unwrap().repr, "'positive'");
}

#[test]
fn test_loops_with_break_continue() {
    let code = r#"
evens = []
for i in range(10):
    if i % 2 != 0:
        continue
    if i > 6:
        break
    evens.append(i)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let evens = last.globals.get("evens").unwrap();

    assert_eq!(evens.len, Some(4)); // [0, 2, 4, 6]
    assert_eq!(evens.repr, "[0, 2, 4, 6]");
}

#[test]
fn test_nested_loops() {
    let code = r#"
matrix = []
for r in range(3):
    row = []
    for c in range(3):
        row.append(r * c)
    matrix.append(row)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let matrix = last.globals.get("matrix").unwrap();

    assert_eq!(matrix.len, Some(3));
    assert_eq!(matrix.repr, "[[0, 0, 0], [0, 1, 2], [0, 2, 4]]");
}

#[test]
fn test_try_except_else_finally() {
    let code = r#"
events = []

def run_flow(throw):
    try:
        events.append("try")
        if throw:
            raise ValueError("bad val")
    except ValueError:
        events.append("caught")
    else:
        events.append("else")
    finally:
        events.append("finally")

run_flow(False)
run_flow(True)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let events = last.globals.get("events").unwrap();

    assert_eq!(
        events.repr,
        "['try', 'else', 'finally', 'try', 'caught', 'finally']"
    );
}

#[test]
fn test_custom_exception_unwinding() {
    let code = r#"
class CustomError(Exception):
    def __init__(self, code, msg):
        self.code = code
        self.msg = msg

caught_code = None
try:
    raise CustomError(404, "Not Found")
except CustomError as e:
    caught_code = e.code
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    assert_eq!(last.globals.get("caught_code").unwrap().repr, "404");
}

#[test]
fn test_comprehensions() {
    let code = r#"
squares = [x * x for x in range(5)]
even_set = {x for x in range(10) if x % 2 == 0}
index_map = {f"k{i}": i for i in range(3)}
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("squares").unwrap().repr, "[0, 1, 4, 9, 16]");
    assert_eq!(g.get("even_set").unwrap().len, Some(5));
    assert_eq!(g.get("index_map").unwrap().len, Some(3));
}

#[test]
fn test_generators_yield() {
    let code = r#"
def count_up(limit):
    n = 1
    while n <= limit:
        yield n
        n += 1

gen = count_up(3)
a = next(gen)
b = next(gen)
c = next(gen)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("a").unwrap().repr, "1");
    assert_eq!(g.get("b").unwrap().repr, "2");
    assert_eq!(g.get("c").unwrap().repr, "3");
}

#[test]
fn test_infinite_loop_guard_and_truncation() {
    let code = r#"
i = 0
while True:
    i += 1
"#;
    let output = run_code_with_limit(code, 150);
    assert!(output.truncated, "Tracer should be flagged as truncated");
    assert!(output.steps.len() >= 150, "Should have reached limit");
}
