/* WALL
 * WALL evaluator
 */

"use strict";

class Local {
  #name = null;
  #depth = -1;
  #isCaptured = false;
  #isConst = false;

  constructor(name, depth, isCaptured, isConst) {
    this.#name = name;
    this.#depth = depth;
    this.#isCaptured = isCaptured;
    this.#isConst = isConst;
  }

  getName() {
    return this.#name;
  }

  getDepth() {
    return this.#depth;
  }

  getIsCaptured() {
    return this.#isCaptured;
  }

  getIsConst() {
    return this.#isConst;
  }
}

class Eval {
  #hadError = false;
  #token = null;

  #locals = [];
  #globalNames = {};
  #globalValues = [];

  #lexer = null;
  #evalTable = {};

  constructor(source) {
    console.log(source);
    this.#lexer = new Lexer(source);

    this.#initEvalTable();
  }

  eval() {
    let value = new ErrorValue("empty script");
    while (true) {
      this.#next();
      if (this.#token.isError()) {
        break;
      }

      if (this.#token.isEOF()) {
        break;
      }

      value = this.#eval();
      console.log(`${value}`);
      if (this.#hadError) {
        break;
      }
    }

    return value;
  }

  #initEvalTable() {
    this.#evalTable = {
      [TokenType.LPAREN]: () => {
        return this.#evalExpression();
      },

      [TokenType.PLUS]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.add(rhs);
      },
      [TokenType.MINUS]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.sub(rhs);
      },
      [TokenType.STAR]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.mul(rhs);
      },
      [TokenType.SLASH]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.div(rhs);
      },

      [TokenType.EQUAL]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.eq(rhs);
      },
      [TokenType.BANG_EQUAL]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.neq(rhs);
      },
      [TokenType.LESS]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.lt(rhs);
      },
      [TokenType.LESS_EQUAL]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.lteq(rhs);
      },
      [TokenType.GREATER]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.gt(rhs);
      },
      [TokenType.GREATER_EQUAL]: () => {
        const [lhs, rhs] = this.#evalBinary();
        if (this.#hadError) {
          return lhs;
        }

        return lhs.gteq(rhs);
      },

      [TokenType.NUMBER]: () => {
        return new NumberValue(this.#token.getLexeme());
      },
      [TokenType.STRING]: () => {
        return new StringValue(this.#token.getLexeme());
      },

      [TokenType.RPAREN]: () => {
        return new ErrorValue("unbalanced parenthesis (extra ')')");
      },
      [TokenType.ERROR]: () => {
        return new ErrorValue(this.#token.getLexeme());
      },
      [TokenType.EOF]: () => {
        return new ErrorValue(`unexpected EOF`);
      },
    };

    Object.keys(this.#evalTable, (k) => {
      this.#evalTable[k].bind(this);
    });
  }

  #eval() {
    const fn = this.#evalTable[this.#token.getType()];
    if (fn === undefined) {
      return new ErrorValue(`unexpected token ${this.#token.getType()}`);
    }

    return fn();
  }

  #evalExpression() {
    this.#next();
    switch (this.#token.getType()) {
      case TokenType.IF:
        return this.#evalIf();
      case TokenType.LET:
        return this.#evalLet();
    }

    const result = this.#eval();
    switch (result.getType()) {
      case ValueType.FUNCTION:
        return this.#callFunction();
      case ValueType.TYPE:
        return this.#callType();
    }

    return result;
  }

  /* Evaluates an if statement */
  #evalIf() {}

  /* Evaluates a let statement */
  #evalLet() {}

  /* Evaluates a binary operation */
  #evalBinary() {
    const lhs = this.#advance();
    if (this.#hadError) {
      return [lhs, null];
    }

    const rhs = this.#advance();
    if (this.#hadError) {
      return [rhs, null];
    }

    const err = this.#check(TokenType.RPAREN);
    if (this.#hadError) {
      return [err, null];
    }

    return [lhs, rhs];
  }

  #callFunction() {}

  #callType() {}

  #advance() {
    this.#next();
    return this.#eval();
  }

  #next() {
    this.#token = this.#lexer.nextToken();
  }

  #check(tokenType) {
    this.#next();
    if (this.#token.getType() != tokenType) {
      return this.#createError(
        `expected ${tokenType}, got ${this.#token.getType()}`,
      );
    }

    return this.#token;
  }

  #eof() {
    return this.#lexer.createToken(TokenType.EOF, "\0");
  }

  #createError(msg) {
    this.#hadError = true;

    const error = this.#lexer.createError(msg);
    return new ErrorValue(`${error}`);
  }
}

const e = new Eval(`(* (+ 3 2) "oi love")`);
e.eval();
