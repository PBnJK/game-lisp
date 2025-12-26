/* GameLISP
 * GameLISP compiler
 */

"use strict";

/* Opcodes
 * These are interpreted by the VM as instructions
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

  DOT: 25,
  IS: 26,

  IMPORT: 27,
};

/* Compiler
 * Responsible for transforming a stream of Tokens into Opcodes
 */
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

  /* Adds a list of constants to the program constants */
  addConstants(constants) {
    this.#constants.push.apply(this.#constants, constants);
  }

  /* Compiles the stream of Tokens */
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

  /* Runs a step (advances then parses an s-expression) */
  step() {
    this.#next();
    this.#sExpression();
  }

  /* Returns the program constants */
  getConstants() {
    return this.#constants;
  }

  /* Returns the compiled program */
  getOpcodes() {
    return this.#opcodes;
  }

  /* Initializes the table of handlers, which emit code based on the current token */
  #initHandlers() {
    this.#handlers = {
      /* (...) */
      [TokenType.LPAREN]: () => {
        this.#next();
        this.#expression();
      },
      /* Extraneous ')' */
      [TokenType.RPAREN]: () => {
        this.#throw("unbalanced parenthesis (extra ')')");
      },
      /* (+ SEXPR SEXPR) */
      [TokenType.PLUS]: () => {
        this.#binary(Opcode.ADD);
      },
      /* (+= VAR SEXPR) */
      [TokenType.PLUS_EQUAL]: () => {
        this.#binaryAssign(Opcode.ADD);
      },
      /* (- SEXPR) OR (- SEXPR SEXPR) */
      [TokenType.MINUS]: () => {
        this.step();
        if (this.#peek().getType() === TokenType.RPAREN) {
          this.#emit(Opcode.NEGATE);
        } else {
          this.step();
          this.#emit(Opcode.SUB);
        }
      },
      /* (-= VAR SEXPR) */
      [TokenType.MINUS_EQUAL]: () => {
        this.#binaryAssign(Opcode.SUB);
      },
      /* (* SEXPR SEXPR) */
      [TokenType.STAR]: () => {
        this.#binary(Opcode.MUL);
      },
      /* (*= VAR SEXPR) */
      [TokenType.STAR_EQUAL]: () => {
        this.#binaryAssign(Opcode.MUL);
      },
      /* (/ SEXPR SEXPR) */
      [TokenType.SLASH]: () => {
        this.#binary(Opcode.DIV);
      },
      /* (/= VAR SEXPR) */
      [TokenType.SLASH_EQUAL]: () => {
        this.#binaryAssign(Opcode.DIV);
      },
      /* (% SEXPR SEXPR) */
      [TokenType.PERCENT]: () => {
        this.#binary(Opcode.MOD);
      },
      /* (%= VAR SEXPR) */
      [TokenType.PERCENT_EQUAL]: () => {
        this.#binaryAssign(Opcode.MOD);
      },
      /* (. VAR SEXPR) */
      [TokenType.DOT]: () => {
        this.#binary(Opcode.DOT);
      },
      /* (= VAR SEXPR) */
      [TokenType.EQUAL]: () => {
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );

        this.step();

        const idx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.SET_VARIABLE, idx);
      },
      /* (== SEXPR SEXPR) */
      [TokenType.EQUAL_EQUAL]: () => {
        this.#binary(Opcode.EQUAL);
      },
      /* (! SEXPR) */
      [TokenType.BANG]: () => {
        this.step();
        this.#emit(Opcode.NOT);
      },
      /* (!= SEXPR SEXPR) */
      [TokenType.BANG_EQUAL]: () => {
        this.#binary(Opcode.NOT_EQUAL);
      },
      /* (< SEXPR SEXPR) */
      [TokenType.LESS]: () => {
        this.#binary(Opcode.LESS);
      },
      /* (<= SEXPR SEXPR) */
      [TokenType.LESS_EQUAL]: () => {
        this.#binary(Opcode.LESS_EQUAL);
      },
      /* (>= SEXPR SEXPR) */
      [TokenType.GREATER]: () => {
        this.#binary(Opcode.GREATER);
      },
      /* (>= SEXPR SEXPR) */
      [TokenType.GREATER_EQUAL]: () => {
        this.#binary(Opcode.GREATER_EQUAL);
      },
      /* (is SEXPR SEXPR) */
      [TokenType.IS]: () => {
        this.#binary(Opcode.IS);
      },
      /* (VAR-FUNC ...SEXPR-ARGS) */
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
      /* (while CONDITION-SEXPR BLOCK) */
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
      /* (fun NAME (...ARGS) BLOCK) */
      [TokenType.FUN]: () => {
        /* Read function name */
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );
        const name = identifier.getLexeme();

        /* Start of arguments list... */
        this.#expect(TokenType.LPAREN);

        /* Read arguments */
        const args = [];
        while (true) {
          if (this.#peek().getType() !== TokenType.IDENTIFIER) {
            break;
          }

          const arg = this.#next();
          args.push(arg.getLexeme());
        }

        /* Arguments will be pushed into the stack when the function needs to
         * be called. Since it's FILO, this ensures they will be in the correct
         * order when we pop them off the stack
         */
        args.reverse();

        /* ...end of arguments list */
        this.#expect(TokenType.RPAREN, "expected closing parenthesis ')'");

        /* Mark start of code block and parse it */
        const fp = this.#getFP() + 1;
        this.#next();
        this.#block();

        /* Extracts the function code from the opcode list into a new array */
        const code = this.#opcodes.slice(fp);
        this.#opcodes.splice(fp);

        /* Always return at the end
         *
         * WARN: Maybe bad, since whatever's on the stack will be treated as
         * the return value? Maybe a separate stack...?
         */
        code.push(Opcode.RETURN);

        /* Create function, save it, and emit code! */
        const fn = new FunctionValue(name, args, code);
        const fnIdx = this.#defineConstant(fn);
        const nameIdx = this.#defineConstant(name);

        this.#emit(Opcode.GET_CONST, fnIdx, Opcode.DEF_VARIABLE, nameIdx);
      },
      /* (if CONDITION-SEXPR TRUE-BLOCK [ELSE-BLOCK]) */
      [TokenType.IF]: () => {
        /* Parse condition sexpr */
        this.step();

        /* Zero is temporary, will be patched later down */
        this.#emit(Opcode.JUMP_IF_FALSE, 0);
        const fpIfPatch = this.#getFP();

        /* Parse true block */
        this.#next();
        this.#block();

        const fpElse = this.#getFP();
        this.#opcodes[fpIfPatch] = fpElse - fpIfPatch + 2;

        /* Check for an "else" */
        if (this.#peek().getType() == TokenType.LPAREN) {
          /* Zero is temporary, will be patched later down */
          this.#emit(Opcode.JUMP, 0);
          const fpElsePatch = this.#getFP();

          /* Parse else block */
          this.#next();
          this.#block();

          const fpEnd = this.#getFP();
          this.#opcodes[fpElsePatch] = fpEnd - fpElse - 2;
        }
      },
      /* (let VAR SEXPR) */
      [TokenType.LET]: () => {
        /* Read variable name */
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected identifier",
        );

        /* Parse declaration SEXPR */
        this.step();

        const idx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.DEF_VARIABLE, idx);
      },
      /* (import MODULE) */
      [TokenType.IMPORT]: () => {
        /* Read module name */
        const identifier = this.#expect(
          TokenType.IDENTIFIER,
          "expected module",
        );

        const modIdx = this.#defineConstant(identifier.getLexeme());
        this.#emit(Opcode.IMPORT, modIdx);
      },
      /* Errors... */
      [TokenType.ERROR]: () => {
        this.#throw(this.#token.getLexeme());
      },
      /* End-of-file... */
      [TokenType.EOF]: () => {
        this.#throw(`unexpected EOF`);
      },
    };

    Object.keys(this.#handlers, (k) => {
      this.#handlers[k].bind(this);
    });
  }

  /* A parenthesis-enclosed block, like the { } blocks of languages like C and
   * JavaScript
   *
   * Can contain multiple s-expressions
   */
  #block() {
    while (true) {
      this.#next();
      if (this.#token.getType() === TokenType.RPAREN) {
        break;
      }

      this.#sExpression();
    }
  }

  /* An s-expression is either:
   * - An atom (number, string, identifier, etc.)
   * - A parenthesized expression
   */
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

  /* A parenthesized expression */
  #expression() {
    const handler = this.#handlers[this.#token.getType()];
    handler();

    this.#expect(TokenType.RPAREN, "expected closing parenthesis ')'");
  }

  /* Emits code for any binary operation of the type (OP SEXPR SEXPR) */
  #binary(op) {
    this.step();
    this.step();

    this.#emit(op);
  }

  /* Emits code for any binary operation of the type (OP VAR SEXPR,) the result
   * of which is stored in VAR
   */
  #binaryAssign(op) {
    /* Must start with a variable */
    const identifier = this.#expect(
      TokenType.IDENTIFIER,
      "expected identifier",
    );

    const idx = this.#defineConstant(identifier.getLexeme());

    this.#emit(Opcode.GET_VARIABLE, idx);
    this.step();

    /* Emit code to perform operation and set the variable to its result */
    this.#emit(op, Opcode.SET_VARIABLE, idx);
  }

  /* Handles identifiers (variable name, function name, etc.) */
  #identifier() {
    const value = this.#token.getLexeme();
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_VARIABLE, idx);
  }

  /* Handles strings */
  #string() {
    const value = new StringValue(this.#token.getLexeme());
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_CONST, idx);
  }

  /* Handles numbers */
  #number() {
    const value = new NumberValue(this.#token.getLexeme());
    const idx = this.#defineConstant(value);

    this.#emit(Opcode.GET_CONST, idx);
  }

  /* Defines a new constant on the program constants list, returning its index
   *
   * NOTE: If the given constant already exists, no new constant is created,
   * and the index of the old constant is returned
   */
  #defineConstant(value) {
    const idx = this.#constants.findIndex((v) => {
      return v === value;
    });
    if (idx === -1) {
      return this.#constants.push(value) - 1;
    }

    return idx;
  }

  /* Returns the "FP" (terrible name...) containing the top index on the
   * compiled program
   */
  #getFP() {
    return this.#opcodes.length - 1;
  }

  /* Emits opcodes and arguments */
  #emit(...ops) {
    for (const op of ops) {
      this.#opcodes.push(op);
    }
  }

  /* Fetches the next token, throwing an error if it doesn't match what we
   * expect
   */
  #expect(type, msg) {
    this.#next();
    if (this.#token.getType() != type) {
      this.#throw(msg);
    }

    return this.#token;
  }

  /* Peeks at the next token without consuming it */
  #peek() {
    return this.#lexer.peek();
  }

  /* Consumes the next token and returns it */
  #next() {
    this.#token = this.#lexer.nextToken();
    return this.#token;
  }

  /* Throws an error */
  #throw(msg) {
    const line = this.#token.getLine();
    const char = this.#token.getChar();
    throw new Error(`at ${line}:${char}: ${msg}`);
  }
}
