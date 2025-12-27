/* GameLISP
 * GameLISP evaluator
 */

"use strict";

const ValueType = {
  BOOL: 0,
  NUMBER: 1,
  STRING: 2,
  FUNCTION: 3,
  NATIVE_FUNCTION: 4,
  ARRAY: 5,
  DICT: 6,
  NONE: 7,
  TYPE: 8,
  ERROR: 255,
};

function valueTypeToString(type) {
  switch (type) {
    case ValueType.BOOL:
      return "bool";
    case ValueType.NUMBER:
      return "number";
    case ValueType.STRING:
      return "string";
    case ValueType.FUNCTION:
      return "function";
    case ValueType.NATIVE_FUNCTION:
      return "native_function";
    case ValueType.ARRAY:
      return "array";
    case ValueType.DICT:
      return "dict";
    case ValueType.NONE:
      return "none";
    case ValueType.TYPE:
      return "type";
    case ValueType.ERROR:
      return "error";
  }
}

class Value {
  #type = ValueType.ERROR;

  constructor(type) {
    if (this.constructor === Value) {
      throw new Error("base class 'Value' cannot be instantiated");
    }

    if (this.getValue === undefined) {
      throw new Error("method 'getValue' must be implemented");
    }

    this.#type = type;
  }

  add(rhs) {
    return new ErrorValue(`cannot perform ${this} + ${rhs}`);
  }

  sub(rhs) {
    return new ErrorValue(`cannot perform ${this} - ${rhs}`);
  }

  mul(rhs) {
    return new ErrorValue(`cannot perform ${this} * ${rhs}`);
  }

  div(rhs) {
    return new ErrorValue(`cannot perform ${this} / ${rhs}`);
  }

  fdiv(rhs) {
    return new ErrorValue(`cannot perform ${this} // ${rhs}`);
  }

  mod(rhs) {
    return new ErrorValue(`cannot perform ${this} % ${rhs}`);
  }

  negate() {
    return new ErrorValue(`cannot perform -${this}`);
  }

  not() {
    return new ErrorValue(`cannot perform !${this}`);
  }

  eq(_) {
    return new BoolValue(false);
  }

  neq(rhs) {
    return this.eq(rhs).not();
  }

  lt(rhs) {
    return new ErrorValue(`cannot perform ${this} < ${rhs}`);
  }

  lteq(rhs) {
    const less = this.gt(rhs);
    if (less.getType() === ValueType.ERROR) {
      return less;
    }

    return less.not();
  }

  gt(rhs) {
    return new ErrorValue(`cannot perform ${this} > ${rhs}`);
  }

  gteq(rhs) {
    const greater = this.lt(rhs);
    if (greater.getType() === ValueType.ERROR) {
      return greater;
    }

    return greater.not();
  }

  is(rhs) {
    if (rhs.getType() === ValueType.TYPE) {
      return rhs.is(this);
    }

    return new ErrorValue(`cannot perform ${this} is ${rhs}`);
  }

  call() {
    return new ErrorValue(`cannot call ${this}`);
  }

  dot(rhs) {
    return new ErrorValue(`cannot acces ${this}.${rhs}`);
  }

  getType() {
    return this.#type;
  }

  toString() {
    return `Value(${this.#type}, ${this.getValue()})`;
  }
}

class BoolValue extends Value {
  #value = false;

  constructor(value) {
    super(ValueType.BOOL);
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  not() {
    return new BoolValue(!this.getValue());
  }

  eq(rhs) {
    if (rhs.getType() == ValueType.BOOL) {
      return new BoolValue(this.getValue() == rhs.getValue());
    }

    return super.eq(rhs);
  }

  toString() {
    return this.getValue() ? "true" : "false";
  }
}

class NumberValue extends Value {
  #value = 0;

  constructor(value) {
    super(ValueType.NUMBER);
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  add(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new NumberValue(this.getValue() + rhs.getValue());
    }

    return super.add(rhs);
  }

  sub(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new NumberValue(this.getValue() - rhs.getValue());
    }

    return super.sub(rhs);
  }

  mul(rhs) {
    const value = this.getValue();

    const rhsType = rhs.getType();
    const rhsValue = rhs.getValue();

    switch (rhsType) {
      case ValueType.NUMBER:
        return new NumberValue(value * rhsValue);
      case ValueType.STRING:
        return new StringValue(rhsValue.repeat(value));
    }

    return super.mul(rhs);
  }

  div(rhs) {
    const rhsValue = rhs.getValue();
    if (rhs.getType() === ValueType.NUMBER) {
      if (rhsValue === 0) {
        return new ErrorValue("division by zero");
      }

      return new NumberValue(this.getValue() / rhsValue);
    }

    return super.div(rhs);
  }

  fdiv(rhs) {
    const rhsValue = rhs.getValue();
    if (rhs.getType() === ValueType.NUMBER) {
      if (rhsValue === 0) {
        return new ErrorValue("division by zero");
      }

      const result = Math.floor(this.getValue() / rhsValue);
      return new NumberValue(result);
    }

    return super.div(rhs);
  }

  mod(rhs) {
    const rhsValue = rhs.getValue();
    if (rhs.getType() === ValueType.NUMBER) {
      return new NumberValue(this.getValue() % rhsValue);
    }

    return super.mod(rhs);
  }

  negate() {
    return new NumberValue(-this.getValue());
  }

  eq(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() === rhs.getValue());
    }

    return super.eq(rhs);
  }

  lt(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() < rhs.getValue());
    }

    return super.lt(rhs);
  }

  gt(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() > rhs.getValue());
    }

    return super.gt(rhs);
  }

  toString() {
    return this.getValue().toString(10);
  }
}

class StringValue extends Value {
  #value = "";

  constructor(value) {
    super(ValueType.STRING);
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  add(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new StringValue(this.getValue() + rhs.getValue());
    }

    return super.add(rhs);
  }

  eq(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() === rhs.getValue());
    }

    return super.eq(rhs);
  }

  lt(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() < rhs.getValue());
    }

    return super.lt(rhs);
  }

  gt(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() > rhs.getValue());
    }

    return super.gt(rhs);
  }

  dot(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      const str = this.getValue();
      const index = rhs.getValue();

      if (index >= str.length) {
        return new ErrorValue(`"${this}".${index} is out of bounds`);
      }

      return new StringValue(str[index]);
    }

    return super.dot(rhs);
  }

  toString() {
    return this.getValue();
  }
}

class FunctionValue extends Value {
  #name = () => {};
  #args = {};
  #code = [];

  constructor(name, args, code) {
    super(ValueType.FUNCTION);
    this.#name = name;
    this.#args = args;
    this.#code = code;
  }

  getArity() {
    return this.#args.length;
  }

  getName() {
    return this.#name;
  }

  getArgs() {
    return this.#args;
  }

  getValue() {
    return this.#code;
  }

  call(args) {
    return args;
  }

  toString() {
    let asString = this.getName() + "(";
    for (const arg of this.getArgs()) {
      asString += `${arg}, `;
    }
    asString += ")";

    return asString;
  }
}

class NativeFunctionValue extends Value {
  #fn = () => {};
  #arity = -1;

  constructor(fn, arity) {
    super(ValueType.NATIVE_FUNCTION);
    this.#fn = fn;
    this.#arity = arity;
  }

  getArity() {
    return this.#arity;
  }

  getValue() {
    return this.#fn;
  }

  call(args) {
    const arity = this.getArity();
    if (arity !== -1 && args.length !== arity) {
      return new ErrorValue(
        `error calling ${this} (expected ${arity} arguments, received ${args.length})`,
      );
    }

    return this.#fn(...args);
  }

  toString() {
    const name = this.getValue().name;
    const arity = this.getArity();

    return `<native_function ${name}, ${arity === -1 ? arity : "..."} args>`;
  }
}

class ArrayValue extends Value {
  #value = [];

  constructor(value) {
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  dot(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return this.getValue()[rhs.getValue()];
    }

    return super.dot(rhs);
  }
}

class TypeValue extends Value {
  #value = ValueType.NONE;
  #caster = () => {};

  constructor(value, caster) {
    super(ValueType.TYPE);

    this.#value = value;
    this.#caster = caster;
  }

  getValue() {
    return this.#value;
  }

  is(rhs) {
    return new BoolValue(rhs.getType() === this.getValue());
  }

  call(args) {
    const value = args[0];
    if (value.getType() === this.getValue()) {
      return value;
    }

    return this.#caster(value);
  }

  toString() {
    return `<type "${this.getValue()}">`;
  }
}

class ErrorValue extends Value {
  #value = null;

  constructor(value) {
    super(ValueType.ERROR);
    this.#value = value;
  }

  getValue() {
    throw new Error(this.#value);
  }

  toString() {
    return `ERR: ${this.getValue()}`;
  }
}
