/* GameLISP
 * GameLISP compiler
 */

"use strict";

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

  DOT: 25,
  IS: 26,

  IMPORT: 27,
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
    printToConsole("Starting compilation...");

    while (true) {
      this.#next();
      if (this.#token.isError()) {
        printToConsole(this.#token.toString());
        break;
      }

      if (this.#peek().isEOF()) {
        break;
      }

      try {
        this.#sExpression();
      } catch (error) {
        printToConsole(error);
        console.log(error);
        break;
      }
    }

    this.#emit(Opcode.RETURN);

    printToConsole("Finished compiling!");
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
      [TokenType.PLUS_EQUAL]: () => {
        this.#binaryAssign(Opcode.ADD);
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

      [TokenType.MINUS_EQUAL]: () => {
        this.#binaryAssign(Opcode.SUB);
      },
      [TokenType.STAR]: () => {
        this.#binary(Opcode.MUL);
      },
      [TokenType.STAR_EQUAL]: () => {
        this.#binaryAssign(Opcode.MUL);
      },
      [TokenType.SLASH]: () => {
        this.#binary(Opcode.DIV);
      },
      [TokenType.SLASH_EQUAL]: () => {
        this.#binaryAssign(Opcode.DIV);
      },
      [TokenType.PERCENT]: () => {
        this.#binary(Opcode.MOD);
      },
      [TokenType.PERCENT_EQUAL]: () => {
        this.#binaryAssign(Opcode.MOD);
      },
      [TokenType.DOT]: () => {
        this.#binary(Opcode.DOT);
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
      [TokenType.IS]: () => {
        this.#binary(Opcode.IS);
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
      [TokenType.WHILE]: () => {
        const fpCondition = this.#getFP();
        this.step();

        /* Zero is temporary, will be patched later down */
        this.#emit(Opcode.JUMP_IF_FALSE, 0);
        const fpPatch = this.#getFP();

        this.#next();
        this.#block();

        const fpCurrent = this.#getFP();
        this.#opcodes[fpPatch] = fpCurrent - fpPatch + 2;

        this.#emit(Opcode.JUMP, fpCondition - fpCurrent - 2);
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

        const fnIdx = this.#defineConstant(fn);
        const nameIdx = this.#defineConstant(name);

        this.#emit(Opcode.GET_CONST, fnIdx, Opcode.DEF_VARIABLE, nameIdx);
      },
      [TokenType.IF]: () => {
        this.step();

        /* Zero is temporary, will be patched later down */
        this.#emit(Opcode.JUMP_IF_FALSE, 0);
        const fpIfPatch = this.#getFP();

        this.#next();
        this.#block();

        const fpElse = this.#getFP();

        if (this.#peek().getType() == TokenType.LPAREN) {
          this.#opcodes[fpIfPatch] = fpElse - fpIfPatch + 2;

          this.#emit(Opcode.JUMP, 0);
          const fpElsePatch = this.#getFP();

          this.#next();
          this.#block();

          const fpEnd = this.#getFP();
          this.#opcodes[fpElsePatch] = fpEnd - fpElse - 2;
        } else {
          this.#opcodes[fpIfPatch] = fpElse - fpIfPatch + 2;
        }
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
      [TokenType.IMPORT]: () => {
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected module",
        );

        const modIdx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.IMPORT, modIdx);
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
      this.#next();
      if (this.#token.getType() === TokenType.RPAREN) {
        break;
      }

      this.#sExpression();
    }
  }

  #sExpression() {
    switch (this.#token.getType()) {
      case TokenType.LPAREN:
        this.#next();
        this.#expression();
        break;
      case TokenType.IDENTIFIER:
        this.#identifier();
        break;
      case TokenType.STRING:
        this.#string();
        break;
      case TokenType.NUMBER:
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
    const handler = this.#handlers[this.#token.getType()];
    handler();

    this.#expect(TokenType.RPAREN, "expected closing parenthesis ')'");
  }

  #binary(op) {
    this.step();
    this.step();

    this.#emit(op);
  }

  #binaryAssign(op) {
    const identifier = this.#expect(
      TokenType.IDENTIFIER,
      "expected identifier",
    );

    const idx = this.#defineConstant(identifier.getLexeme());

    this.#emit(Opcode.GET_VARIABLE, idx);
    this.step();

    this.#emit(op, Opcode.SET_VARIABLE, idx);
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
    const idx = this.#constants.findIndex((v) => {
      return v === value;
    });
    if (idx === -1) {
      return this.#constants.push(value) - 1;
    }

    return idx;
  }

  #getFP() {
    return this.#opcodes.length - 1;
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
    throw new Error(`at ${line}:${char}: ${msg}`);
  }
}
