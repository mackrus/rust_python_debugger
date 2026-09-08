mod common;
use common::*;

#[test]
fn test_basic_pipeline() {
    let output = run_code("x = 10\ny = 20\nz = x + y\nprint(z)");
    assert_eq!(output.error, None);
    assert!(!output.truncated);
    assert!(output.steps.len() >= 4);
    assert_eq!(output.stdout, "30\n");

    let last_step = output.steps.last().unwrap();
    assert_eq!(last_step.globals.get("z").unwrap().repr, "30");
    assert_eq!(last_step.globals.get("z").unwrap().r#type, "int");
}

#[test]
fn test_main_guard() {
    let code = r#"
called = False
def run():
    global called
    called = True

if __name__ == "__main__":
    run()
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last_step = output.steps.last().unwrap();
    assert_eq!(last_step.globals.get("called").unwrap().repr, "True");
    assert!(output.steps.iter().any(|s| s.func == "run"));
}

