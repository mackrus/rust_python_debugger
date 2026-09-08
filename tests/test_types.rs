mod common;
use common::*;

#[test]
fn test_primitive_types() {
    let code = r#"
a = 42
b = -100
c = 10**30
d = 3.14159
e = -0.001
f = True
g = False
h = None
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("a").unwrap().r#type, "int");
    assert_eq!(g.get("a").unwrap().repr, "42");

    assert_eq!(g.get("b").unwrap().r#type, "int");
    assert_eq!(g.get("b").unwrap().repr, "-100");

    assert_eq!(g.get("c").unwrap().r#type, "int");
    assert_eq!(g.get("c").unwrap().repr, "1000000000000000000000000000000");

    assert_eq!(g.get("d").unwrap().r#type, "float");
    assert_eq!(g.get("d").unwrap().repr, "3.14159");

    assert_eq!(g.get("f").unwrap().r#type, "bool");
    assert_eq!(g.get("f").unwrap().repr, "True");
    assert_eq!(g.get("g").unwrap().repr, "False");

    assert_eq!(g.get("h").unwrap().r#type, "NoneType");
    assert_eq!(g.get("h").unwrap().repr, "None");
}

#[test]
fn test_string_types_and_escaping() {
    let code = r#"
s1 = "hello world"
s2 = "quote \" and backslash \\ and newline \n and tab \t"
s3 = "emoji: 🦀 🐍"
s4 = ""
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("s1").unwrap().r#type, "str");
    assert_eq!(g.get("s1").unwrap().repr, "'hello world'");

    assert_eq!(g.get("s3").unwrap().r#type, "str");
    assert!(g.get("s3").unwrap().repr.contains("🦀"));

    assert_eq!(g.get("s4").unwrap().r#type, "str");
    assert_eq!(g.get("s4").unwrap().repr, "''");
}

#[test]
fn test_bytes_and_bytearray() {
    let code = r#"
b1 = b"hello"
ba1 = bytearray(b"world")
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("b1").unwrap().r#type, "bytes");
    assert_eq!(g.get("b1").unwrap().repr, "b'hello'");

    assert_eq!(g.get("ba1").unwrap().r#type, "bytearray");
    assert_eq!(g.get("ba1").unwrap().repr, "bytearray(b'world')");
}

#[test]
fn test_collections_list_tuple() {
    let code = r#"
empty_list = []
nums = [1, 2, 3]
mixed_list = [10, "two", 3.0, [4, 5]]

empty_tuple = ()
single_tuple = (42,)
coords = (10, 20, "z")
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    let nums = g.get("nums").unwrap();
    assert_eq!(nums.r#type, "list");
    assert_eq!(nums.len, Some(3));
    assert_eq!(nums.children.as_ref().unwrap().len(), 3);
    assert_eq!(nums.children.as_ref().unwrap()[0].repr, "1");

    let coords = g.get("coords").unwrap();
    assert_eq!(coords.r#type, "tuple");
    assert_eq!(coords.len, Some(3));
    assert_eq!(coords.children.as_ref().unwrap().len(), 3);
}

#[test]
fn test_collections_dict() {
    let code = r#"
empty_d = {}
simple_d = {"a": 1, "b": "val"}
nested_d = {"user": {"id": 100, "name": "Alice"}}
int_keys = {1: "one", 2: "two"}
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    let simple = g.get("simple_d").unwrap();
    assert_eq!(simple.r#type, "dict");
    assert_eq!(simple.len, Some(2));
    let entries = simple.entries.as_ref().unwrap();
    assert_eq!(entries.get("a").unwrap().repr, "1");
    assert_eq!(entries.get("b").unwrap().repr, "'val'");

    let int_k = g.get("int_keys").unwrap();
    assert_eq!(int_k.r#type, "dict");
    let int_entries = int_k.entries.as_ref().unwrap();
    assert_eq!(int_entries.get("1").unwrap().repr, "'one'");
}

#[test]
fn test_collections_set_and_frozenset() {
    let code = r#"
empty_s = set()
s = {1, 2, 3}
fs = frozenset([4, 5, 6])
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    let s_val = g.get("s").unwrap();
    assert_eq!(s_val.r#type, "set");
    assert_eq!(s_val.len, Some(3));

    let fs_val = g.get("fs").unwrap();
    assert_eq!(fs_val.r#type, "frozenset");
}

#[test]
fn test_range_and_slice() {
    let code = r#"
r = range(5)
sl = slice(1, 10, 2)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("r").unwrap().r#type, "range");
    assert_eq!(g.get("sl").unwrap().r#type, "slice");
}

#[test]
fn test_circular_reference() {
    let code = r#"
l = []
l.append(l)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let l_val = last.globals.get("l").unwrap();
    assert_eq!(l_val.r#type, "list");
}

#[test]
fn test_large_collection_truncation() {
    let code = r#"
big_list = list(range(100))
big_dict = {f"k{i}": i for i in range(100)}
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    let bl = g.get("big_list").unwrap();
    assert_eq!(bl.len, Some(100));
    // Tracer caps children preview to 50
    assert_eq!(bl.children.as_ref().unwrap().len(), 50);

    let bd = g.get("big_dict").unwrap();
    assert_eq!(bd.len, Some(100));
    assert_eq!(bd.entries.as_ref().unwrap().len(), 50);
}

#[test]
fn test_custom_class_instance_and_repr() {
    let code = r#"
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __repr__(self):
        return f"Person({self.name}, {self.age})"

p = Person("Bob", 30)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let p_val = last.globals.get("p").unwrap();
    assert_eq!(p_val.r#type, "Person");
    assert_eq!(p_val.repr, "Person(Bob, 30)");
}
