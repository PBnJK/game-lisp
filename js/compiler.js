/* GameLISP
 * GameLISP compiler
 */

const Opcode = {
  GET_CONST: 0,

  DEF_VARIABLE: 1,
  GET_VARIABLE: 2,
  SET_VARIABLE: 3,

  TRUE: 4,
  FALSE: 5,

  POP: 6,

  EQUAL: 7,
  NOT_EQUAL: 8,
  GREATER: 9,
  GREATER_EQUAL: 10,
  LESS: 11,
  LESS_EQUAL: 12,

  ADD: 13,
  SUB: 14,
  MUL: 15,
  DIV: 16,
  MOD: 17,

  NEGATE: 18,
  NOT: 19,

  JUMP: 20,
  JUMP_IF_FALSE: 21,

  DUP: 22,

  CALL: 23,
  RETURN: 24,
};

class Compiler {
  #token = null;
  #lexer = null;

  #handlers = null;

  #constants = [];
  #opcodes = [];

  constructor(source) {
    this.#lexer = new Lexer(source);
    this.#initHandlers();
  }

  addConstants(constants) {
    this.#constants.push.apply(this.#constants, constants);
  }

  compile() {
    while (true) {
      this.step();
      if (this.#token.isError()) {
        printToConsole(this.#token.toString());
        break;
      }

      if (this.#peek().isEOF()) {
        break;
      }
    }

    this.#emit(Opcode.RETURN);
  }

  step() {
    this.#next();
    this.#sExpression();
  }

  getConstants() {
    return this.#constants;
  }

  getOpcodes() {
    return this.#opcodes;
  }

  #initHandlers() {
    this.#handlers = {
      [TokenType.LPAREN]: () => {
        this.#next();
        this.#expression();
      },
      [TokenType.RPAREN]: () => {
        this.#throw("unbalanced parenthesis (extra ')')");
      },
      [TokenType.PLUS]: () => {
        this.#binary(Opcode.ADD);
      },
      [TokenType.MINUS]: () => {
        this.step();
        if (this.#peek().getType() === TokenType.RPAREN) {
          this.#emit(Opcode.NEGATE);
        } else {
          this.step();
          this.#emit(Opcode.SUB);
        }
      },
      [TokenType.STAR]: () => {
        this.#binary(Opcode.MUL);
      },
      [TokenType.SLASH]: () => {
        this.#binary(Opcode.DIV);
      },
      [TokenType.PERCENT]: () => {
        this.#binary(Opcode.MOD);
      },
      [TokenType.EQUAL]: () => {
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );

        this.step();

        const idx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.SET_VARIABLE, idx);
      },
      [TokenType.EQUAL_EQUAL]: () => {
        this.#binary(Opcode.EQUAL);
      },
      [TokenType.BANG]: () => {
        this.step();
        this.#emit(Opcode.NOT);
      },
      [TokenType.BANG_EQUAL]: () => {
        this.#binary(Opcode.NOT_EQUAL);
      },
      [TokenType.LESS]: () => {
        this.#binary(Opcode.LESS);
      },
      [TokenType.LESS_EQUAL]: () => {
        this.#binary(Opcode.LESS_EQUAL);
      },
      [TokenType.GREATER]: () => {
        this.#binary(Opcode.GREATER);
      },
      [TokenType.GREATER_EQUAL]: () => {
        this.#binary(Opcode.GREATER_EQUAL);
      },
      [TokenType.IDENTIFIER]: () => {
        const lexeme = this.#token.getLexeme();
        const idx = this.#defineConstant(lexeme);

        let argCount = 0;
        while (true) {
          if (this.#peek().getType() === TokenType.RPAREN) {
            break;
          }

          this.step();
          ++argCount;
        }

        this.#emit(Opcode.CALL, argCount, idx);
      },
      [TokenType.FUN]: () => {
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );

        this.#expect(TokenType.LPAREN);

        const args = [];
        while (true) {
          if (this.#peek().getType() !== TokenType.IDENTIFIER) {
            break;
          }

          const arg = this.#next();
          args.push(arg.getLexeme());
        }

        this.#expect(TokenType.RPAREN, "expected closing parenthesis ')'");

        const fp = this.#getFP() + 1;
        this.#next();
        this.#block();

        const name = identifier.getLexeme();
        const code = this.#opcodes.slice(fp);
        this.#opcodes.splice(fp);

        code.push(Opcode.RETURN);
        const fn = new FunctionValue(name, args, code);

        const nameIdx = this.#defineConstant(name);
        const fnIdx = this.#defineConstant(fn);

        this.#emit(Opcode.GET_CONST, fnIdx, Opcode.DEF_VARIABLE, nameIdx);
      },
      [TokenType.LET]: () => {
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );

        this.step();

        const idx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.DEF_VARIABLE, idx);
      },
      [TokenType.ERROR]: () => {
        this.#throw(this.#token.getLexeme());
      },
      [TokenType.EOF]: () => {
        this.#throw(`unexpected EOF`);
      },
    };

    Object.keys(this.#handlers, (k) => {
      this.#handlers[k].bind(this);
    });
  }

  #block() {
    while (true) {
      console.log(`BLOCK ${this.#token} ${this.#peek()}`);
      if (this.#peek().getType() === TokenType.RPAREN) {
        break;
      }

      this.step();
    }
  }

  #sExpression() {
    console.log(`SEXPR ${this.#token} ${this.#peek()}`);

    switch (this.#token.getType()) {
      case TokenType.LPAREN:
        this.#next();
        this.#expression();
        break;
      case TokenType.IDENTIFIER:
        console.log("SEXPR identifier");
        this.#identifier();
        break;
      case TokenType.STRING:
        console.log("SEXPR str");
        this.#string();
        break;
      case TokenType.NUMBER:
        console.log("SEXPR number");
        this.#number();
        break;
      case TokenType.TRUE:
        this.#emit(Opcode.TRUE);
        break;
      case TokenType.FALSE:
        this.#emit(Opcode.FALSE);
        break;
      default:
        this.#throw(`unexpected token ${this.#token}`);
    }
  }

  #expression() {
    console.log(` EXPR ${this.#token} ${this.#peek()}`);

    const handler = this.#handlers[this.#token.getType()];
    handler();

    this.#expect(TokenType.RPAREN, "expected closing parenthesis ')'");
  }

  #binary(op) {
    this.step();
    this.step();

    this.#emit(op);
  }

  #identifier() {
    const value = this.#token.getLexeme();
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_VARIABLE, idx);
  }

  #string() {
    const value = new StringValue(this.#token.getLexeme());
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_CONST, idx);
  }

  #number() {
    const value = new NumberValue(this.#token.getLexeme());
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_CONST, idx);
  }

  #defineConstant(value) {
    const idx = this.#constants.findIndex((v) => v === value);
    if (idx === -1) {
      return this.#constants.push(value) - 1;
    }

    return idx;
  }

  #getFP() {
    return this.#constants.length - 1;
  }

  #emit(...ops) {
    for (const op of ops) {
      this.#opcodes.push(op);
    }
  }

  #expect(type, msg) {
    this.#next();
    if (this.#token.getType() != type) {
      this.#throw(msg);
    }

    return this.#token;
  }

  #peek() {
    return this.#lexer.peek();
  }

  #next() {
    this.#token = this.#lexer.nextToken();
    return this.#token;
  }

  #throw(msg) {
    const line = this.#token.getLine();
    const char = this.#token.getChar();
    throw new Error(`${line}:${char}:${msg}`);
  }
}
