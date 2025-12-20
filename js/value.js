/* WALL
 * WALL evaluator
 */

"use strict";

const ValueType = {
  BOOL: 0,
  NUMBER: 1,
  FUNCTION: 2,
  ARRAY: 3,
  DICT: 4,
  NONE: 5,
  TYPE: 6,
  ERROR: 255,
};

function valueTypeToString(type) {
  switch (type) {
    case ValueType.BOOL:
      return "bool";
    case ValueType.NUMBER:
      return "number";
    case ValueType.FUNCTION:
      return "function";
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

  eq(rhs) {
    return new ErrorValue(`cannot perform ${this} == ${rhs}`);
  }

  neq(rhs) {
    const equal = this.eq(rhs);
    if (equal.getType() === ValueType.ERROR) {
      return equal;
    }

    return equal.negate();
  }

  lt(rhs) {
    return new ErrorValue(`cannot perform ${this} < ${rhs}`);
  }

  lteq(rhs) {
    const less = this.gt(rhs);
    if (less.getType() === ValueType.ERROR) {
      return less;
    }

    return less.negate();
  }

  gt(rhs) {
    return new ErrorValue(`cannot perform ${this} > ${rhs}`);
  }

  gteq(rhs) {
    const greater = this.lt(rhs);
    if (greater.getType() === ValueType.ERROR) {
      return greater;
    }

    return greater.negate();
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

  eq(rhs) {
    if (rhs.getType() == ValueType.BOOL) {
      return new BoolValue(this.getValue() == rhs.getValue());
    }

    super.eq(rhs);
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

    super.add(rhs);
  }

  sub(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new NumberValue(this.getValue() - rhs.getValue());
    }

    super.sub(rhs);
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

    super.mul(rhs);
  }

  div(rhs) {
    const rhsValue = rhs.getValue();
    if (rhs.getType() === ValueType.NUMBER) {
      if (rhsValue === 0) {
        return new ErrorValue("division by zero");
      }

      return new NumberValue(this.getValue() / rhsValue);
    }

    super.div(rhs);
  }

  eq(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() === rhs.getValue());
    }

    super.eq(rhs);
  }

  lt(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() < rhs.getValue());
    }

    super.lt(rhs);
  }

  gt(rhs) {
    if (rhs.getType() === ValueType.NUMBER) {
      return new BoolValue(this.getValue() > rhs.getValue());
    }

    super.gt(rhs);
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
      return new NumberValue(this.getValue() + rhs.getValue());
    }

    super.add(rhs);
  }

  eq(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() === rhs.getValue());
    }

    super.eq(rhs);
  }

  lt(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() < rhs.getValue());
    }

    super.lt(rhs);
  }

  gt(rhs) {
    if (rhs.getType() === ValueType.STRING) {
      return new BoolValue(this.getValue() > rhs.getValue());
    }

    super.gt(rhs);
  }

  toString() {
    return `"${this.getValue()}"`;
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

  getName() {
    return this.#name;
  }

  getArgs() {
    return this.#args;
  }

  getValue() {
    return this.#code;
  }

  toString() {
    asString = this.getName() + "(";
    for (const [arg, type] of this.getArgs()) {
      asString += `${arg}: ${valueTypeToString(type)}, `;
    }
    asString += ")";
  }
}

class TypeValue extends Value {
  #value = ValueType.NONE;

  constructor(value) {
    super(ValueType.FUNCTION);
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  toString() {
    return `"${this.getValue()}"`;
  }
}

class ErrorValue extends Value {
  #value = () => {};

  constructor(value) {
    super(ValueType.ERROR);
    this.#value = value;
  }

  getValue() {
    return this.#value;
  }

  toString() {
    return `ERR: "${this.getValue()}"`;
  }
}
