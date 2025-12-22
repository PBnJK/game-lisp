/* GameLISP
 * GameLISP evaluator
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

  #lexer = null;

  #evalTable = {};
  #envs = [];

  constructor(source) {
    this.load(source);

    this.#initEvalTable();
    this.#initGlobalEnv();
  }

  load(source) {
    this.#lexer = new Lexer(source);
  }

  step() {
    this.#next();
    if (this.#token.isError()) {
      return new ErrorValue(this.#token.toString());
    }

    if (this.#token.isEOF()) {
      return null;
    }

    return this.#eval();
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

      [TokenType.IDENTIFIER]: () => {
        const k = this.#token.getLexeme();
        const envIdx = this.#findIdentifier(k);
        if (envIdx === -1) {
          return new ErrorValue(`unknown identifier "${k}"`);
        }

        const env = this.#envs[envIdx];
        return env.getIdentifier(k);
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

  #initGlobalEnv() {
    const globalEnv = new Env();

    /* Types */
    globalEnv.addFromObject({
      bool: new TypeValue(ValueType.BOOL, (value) => {
        const v = value.getValue();
        switch (value.getType()) {
          case ValueType.BOOL:
            return value;
          case ValueType.NUMBER:
            return new BoolValue(v !== 0);
          case ValueType.STRING:
            return new BoolValue(c.length !== 0);
          case ValueType.NONE:
            return new BoolValue(false);
        }

        return new ErrorValue(`cannot cast ${value} to bool`);
      }),
      number: new TypeValue(ValueType.NUMBER, (value) => {
        const v = value.getValue();
        switch (value.getType()) {
          case ValueType.BOOL:
            return new NumberValue(v ? 1 : 0);
          case ValueType.STRING:
            return new NumberValue(v.parseInt(10));
        }

        return new ErrorValue(`cannot cast ${value} to number`);
      }),
      string: new TypeValue(ValueType.STRING, (value) => {
        const v = value.getValue();
        switch (value.getType()) {
          case ValueType.BOOL:
            return new StringValue(v ? "true" : "false");
          case ValueType.NUMBER:
            return new StringValue(v.toString());
        }

        return new ErrorValue(`cannot cast ${value} to string`);
      }),
      function: new TypeValue(ValueType.FUNCTION, (value) => {
        return new ErrorValue(`cannot cast ${value} to function`);
      }),
    });

    /* Functions */
    globalEnv.addFromObject({
      print: new NativeFunctionValue((...args) => {
        const str = args.join(" ");

        printToConsole(str);
        return new StringValue(str);
      }, -1),
    });

    this.#pushEnv(globalEnv);
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
      case ValueType.NATIVE_FUNCTION:
        return this.#callFunction(result);
      case ValueType.TYPE:
        return this.#callType(result);
    }

    return result;
  }

  /* Evaluates an if statement */
  #evalIf() {}

  /* Evaluates a let statement */
  #evalLet() {
    const identifier = this.#next();
    if (this.#hadError) {
      return identifier;
    }

    const next = this.#next();
    if (this.#hadError) {
      return next;
    }

    if (next.getType() === TokenType.LPAREN) {
      return new ErrorValue("func declarations not yet supported");
    }

    const value = this.#eval();
    if (this.#hadError) {
      return value;
    }

    const err = this.#check(TokenType.RPAREN);
    if (this.#hadError) {
      return err;
    }

    this.#addIdentifier(identifier.getLexeme(), value);
    return value;
  }

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

  #callFunction(func) {
    const args = [];
    while (true) {
      this.#next();
      if (this.#token.getType() === TokenType.EOF) {
        return this.#createError("unexpected EOF mid function call");
      }

      if (this.#token.getType() === TokenType.RPAREN) {
        break;
      }

      args.push(this.#eval());
    }

    return func.call(args);
  }

  #callType(type) {
    const arg = this.#advance();
    const err = this.#check(TokenType.RPAREN);
    if (this.#hadError) {
      return err;
    }

    return type.call(arg);
  }

  #pushEnv(env) {
    if (this.#envs.length === 256) {
      return;
    }

    this.#envs.push(env);
  }

  #popEnv() {
    if (this.#envs.length === 0) {
      return;
    }

    this.#envs.pop();
  }

  #addIdentifier(k, v) {
    const localEnvIdx = this.#envs.length - 1;
    const localEnv = this.#envs[localEnvIdx];
    if (localEnv.hasIdentifier(k)) {
      return this.#createError(`identifier ${k} already exists in local scope`);
    }

    localEnv.setIdentifier(k, v);
  }

  #setIdentifier(k, v) {
    let envIdx = this.#findIdentifier(k);
    if (envIdx === -1) {
      envIdx = this.#envs.length - 1;
    }

    const env = this.#envs[envIdx];
    env.setIdentifier(k, v);
  }

  #getIdentifer(k) {
    const envIdx = this.#findIdentifier(k);
    if (envIdx === -1) {
      return this.#createError(`no such identifier ${k}`);
    }

    const env = this.#envs[envIdx];
    return env.getIdentifier(k);
  }

  #findIdentifier(identifier) {
    for (let i = this.#envs.length - 1; i >= 0; --i) {
      const env = this.#envs[i];
      if (env.hasIdentifier(identifier)) {
        return i;
      }
    }

    return -1;
  }

  #advance() {
    this.#next();
    return this.#eval();
  }

  #next() {
    this.#token = this.#lexer.nextToken();
    return this.#token;
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

  #createError(msg) {
    this.#hadError = true;

    const error = this.#lexer.createError(msg);
    return new ErrorValue(`${error}`);
  }
}
