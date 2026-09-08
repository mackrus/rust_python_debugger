mod common;
use common::*;

#[test]
fn test_basic_class_and_instances() {
    let code = r#"
class Car:
    wheels = 4

    def __init__(self, make, model):
        self.make = make
        self.model = model

c1 = Car("Tesla", "Model 3")
c2 = Car("Toyota", "Corolla")
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("Car").unwrap().r#type, "type");
    assert_eq!(g.get("c1").unwrap().r#type, "Car");
    assert_eq!(g.get("c2").unwrap().r#type, "Car");
}

#[test]
fn test_class_and_static_methods() {
    let code = r#"
class MathUtils:
    factor = 10

    @staticmethod
    def add(a, b):
        return a + b

    @classmethod
    def scale(cls, val):
        return val * cls.factor

s1 = MathUtils.add(5, 7)
s2 = MathUtils.scale(4)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("s1").unwrap().repr, "12");
    assert_eq!(g.get("s2").unwrap().repr, "40");
}

#[test]
fn test_property_getter_setter() {
    let code = r#"
class Temperature:
    def __init__(self, celsius):
        self._celsius = celsius

    @property
    def fahrenheit(self):
        return self._celsius * 9 / 5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value):
        self._celsius = (value - 32) * 5 / 9

t = Temperature(0)
f_val = t.fahrenheit
t.fahrenheit = 212
c_val = t._celsius
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("f_val").unwrap().repr, "32.0");
    assert_eq!(g.get("c_val").unwrap().repr, "100.0");
}

#[test]
fn test_inheritance_and_super() {
    let code = r#"
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} makes a noise"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)
        self.breed = breed

    def speak(self):
        return f"{self.name} barks"

dog = Dog("Buddy", "Golden Retriever")
msg = dog.speak()
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("dog").unwrap().r#type, "Dog");
    assert_eq!(g.get("msg").unwrap().repr, "'Buddy barks'");
}

#[test]
fn test_multiple_inheritance() {
    let code = r#"
class A:
    def greet(self):
        return "A"

class B:
    def greet(self):
        return "B"

class C(A, B):
    pass

class D(B, A):
    pass

c_greet = C().greet()
d_greet = D().greet()
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("c_greet").unwrap().repr, "'A'");
    assert_eq!(g.get("d_greet").unwrap().repr, "'B'");
}

#[test]
fn test_dunder_methods() {
    let code = r#"
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __len__(self):
        return 2

    def __getitem__(self, idx):
        if idx == 0: return self.x
        if idx == 1: return self.y
        raise IndexError("Out of bounds")

    def __call__(self, factor):
        return Vector(self.x * factor, self.y * factor)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v = Vector(3, 4)
v_len = len(v)
v_x = v[0]
v_y = v[1]
v2 = v(2)
v2_repr = repr(v2)
"#;
    let output = run_code(code);
    assert_eq!(output.error, None);
    let last = output.steps.last().unwrap();
    let g = &last.globals;

    assert_eq!(g.get("v_len").unwrap().repr, "2");
    assert_eq!(g.get("v_x").unwrap().repr, "3");
    assert_eq!(g.get("v_y").unwrap().repr, "4");
    assert_eq!(g.get("v2_repr").unwrap().repr, "'Vector(6, 8)'");
}
