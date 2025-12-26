/* GameLISP
 * GameLISP lexer
 */

"use strict";

/**
 * Token types
 *
 * @readonly
 * @enum {number}
 */
const TokenType = {
  LPAREN: 0,
  RPAREN: 1,
  LBRACKET: 2,
  RBRACKET: 3,
  LBRACE: 4,
  RBRACE: 5,

  DOLLAR: 6,
  HASH: 7,

  COMMA: 8,
  DOT: 9,
  SEMICOLON: 10,

  PLUS: 11,
  PLUS_EQUAL: 12,
  MINUS: 13,
  MINUS_EQUAL: 14,
  STAR: 15,
  STAR_EQUAL: 16,
  SLASH: 17,
  SLASH_EQUAL: 18,
  SLASH_SLASH: 19,
  SLASH_SLASH_EQUAL: 20,
  PERCENT: 21,
  PERCENT_EQUAL: 22,

  BANG: 23,
  BANG_EQUAL: 24,
  EQUAL: 25,
  EQUAL_EQUAL: 26,
  LESS: 27,
  LESS_EQUAL: 28,
  GREATER: 29,
  GREATER_EQUAL: 30,
  IS: 31,

  IDENTIFIER: 32,
  STRING: 33,
  INTERPOLATION: 34,
  NUMBER: 35,

  OR: 36,
  AND: 37,

  PIPE: 38,
  AMPERSAND: 39,
  CARET: 40,

  TRUE: 41,
  FALSE: 42,
  UNDEFINED: 43,

  FOR: 44,
  WHILE: 45,
  BREAK: 46,
  CONTINUE: 47,

  FUN: 48,
  RETURN: 49,

  IF: 50,
  ELSE: 51,
  COLON: 52,
  QUESTION: 53,

  LET: 54,
  CONST: 55,

  IMPORT: 56,

  ERROR: 254,
  EOF: 255,
};

/** Class representing a token */
class Token {
  #type = TokenType.ERROR;
  #lexeme = null;

  #line = 0;
  #char = 0;

  constructor(tokenType, tokenLexeme, tokenLine, tokenChar) {
    this.#type = tokenType;
    this.#lexeme = tokenLexeme;
    this.#line = tokenLine;
    this.#char = tokenChar;
  }

  getType() {
    return this.#type;
  }

  getLexeme() {
    return this.#lexeme;
  }

  getLine() {
    return this.#line;
  }

  getChar() {
    return this.#char;
  }

  isError() {
    return this.getType() == TokenType.ERROR;
  }

  isEOF() {
    return this.getType() == TokenType.EOF;
  }

  toString() {
    return `"${this.#lexeme}" (${this.#type})`;
  }
}

class Lexer {
  #source = "";
  #idx = 0;

  #prev = null;
  #curr = null;

  #line = 1;
  #char = 1;

  constructor(source) {
    this.#source = source;

    this.#curr = this.#nextToken();
    this.#prev = this.#curr;
  }

  reset() {
    this.#source = "";
    this.#idx = 0;

    this.#line = 1;
    this.#char = 1;
  }

  peek() {
    return this.#curr;
  }

  nextToken() {
    this.#prev = this.#curr;
    this.#curr = this.#nextToken();
    return this.#prev;
  }

  /* Wrapper for creating a new error token */
  createError(msg) {
    return this.createToken(TokenType.ERROR, msg);
  }

  /* Wrapper for creating a new Token */
  createToken(type, value) {
    return new Token(type, value, this.#line, this.#char);
  }

  #nextToken() {
    this.#skipSpaces();
    if (this.#reachedEndOfSource()) {
      return this.createToken(TokenType.EOF, "EOF");
    }

    const char = this.#advance();

    if (this.#isAlpha(char)) {
      return this.#lexIdentifier();
    }

    if (this.#isDigit(char)) {
      return this.#lexNumber(char);
    }

    if (char === '"') {
      return this.#lexString();
    }

    switch (char) {
      case "(":
        return this.createToken(TokenType.LPAREN, char);
      case ")":
        return this.createToken(TokenType.RPAREN, char);
      case "[":
        return this.createToken(TokenType.LBRACKET, char);
      case "]":
        return this.createToken(TokenType.RBRACKET, char);
      case "{":
        return this.createToken(TokenType.LBRACE, char);
      case "}":
        return this.createToken(TokenType.RBRACE, char);
      case "$":
        return this.createToken(TokenType.DOLLAR, char);
      case "#":
        return this.createToken(TokenType.HASH, char);
      case ",":
        return this.createToken(TokenType.COMMA, char);
      case ".":
        return this.createToken(TokenType.DOT, char);
      case ";":
        return this.createToken(TokenType.SEMICOLON, char);
      case "+":
        return this.createToken(
          this.#match("=") ? TokenType.PLUS_EQUAL : TokenType.PLUS,
          char,
        );
      case "-":
        return this.createToken(
          this.#match("=") ? TokenType.MINUS_EQUAL : TokenType.MINUS,
          char,
        );
      case "*":
        return this.createToken(
          this.#match("=") ? TokenType.STAR_EQUAL : TokenType.STAR,
          char,
        );
      case "/":
        if (this.#match("/")) {
          return this.createToken(
            this.#match("=")
              ? TokenType.SLASH_SLASH_EQUAL
              : TokenType.SLASH_SLASH,
            char,
          );
        }
        return this.createToken(
          this.#match("=") ? TokenType.SLASH_EQUAL : TokenType.SLASH,
          char,
        );
      case "%":
        return this.createToken(
          this.#match("=") ? TokenType.PERCENT_EQUAL : TokenType.PERCENT,
          char,
        );
      case "?":
        return this.createToken(TokenType.QUESTION, char);
      case ":":
        return this.createToken(TokenType.COLON, char);
      case "!":
        return this.createToken(
          this.#match("=") ? TokenType.BANG_EQUAL : TokenType.BANG,
          char,
        );
      case "=":
        return this.createToken(
          this.#match("=") ? TokenType.EQUAL_EQUAL : TokenType.EQUAL,
          char,
        );
      case "<":
        return this.createToken(
          this.#match("=") ? TokenType.LESS_EQUAL : TokenType.LESS,
          char,
        );
      case ">":
        return this.createToken(
          this.#match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER,
          char,
        );
      case "|":
        return this.createToken(
          this.#match("|") ? TokenType.OR : TokenType.PIPE,
          char,
        );
      case "&":
        return this.createToken(
          this.#match("&") ? TokenType.AND : TokenType.AMPERSAND,
          char,
        );
      case "^":
        return this.createToken(TokenType.CARET, char);
    }

    return this.createError(`invalid/unexpected character '${char}'`);
  }

  /* Skips all whitespace/useless characters */
  #skipSpaces() {
    while (true) {
      const char = this.#peek();
      switch (char) {
        case " ":
        case "\t":
        case "\r":
          this.#advance();
          break;
        case "\n":
          this.#line++;
          this.#char = 1;
          this.#advance();
          break;
        case "#":
          this.#skipComment();
          break;
        default:
          return;
      }
    }
  }

  /* Skips a comment */
  #skipComment() {
    while (!this.#reachedEndOfSource() && this.#advance() != "\n");

    this.#line++;
    this.#char = 1;
  }

  /* Lexes an identifier */
  #lexIdentifier() {
    this.#rewind();

    const identifier = this.#readIdentifier();
    switch (identifier) {
      case "is":
        return this.createToken(TokenType.IS, identifier);
      case "and":
        return this.createToken(TokenType.AND, identifier);
      case "or":
        return this.createToken(TokenType.OR, identifier);
      case "true":
        return this.createToken(TokenType.TRUE, identifier);
      case "false":
        return this.createToken(TokenType.FALSE, identifier);
      case "undefined":
        return this.createToken(TokenType.UNDEFINED, identifier);
      case "for":
        return this.createToken(TokenType.FOR, identifier);
      case "while":
        return this.createToken(TokenType.WHILE, identifier);
      case "break":
        return this.createToken(TokenType.BREAK, identifier);
      case "continue":
        return this.createToken(TokenType.CONTINUE, identifier);
      case "fun":
        return this.createToken(TokenType.FUN, identifier);
      case "return":
        return this.createToken(TokenType.RETURN, identifier);
      case "if":
        return this.createToken(TokenType.IF, identifier);
      case "else":
        return this.createToken(TokenType.ELSE, identifier);
      case "let":
        return this.createToken(TokenType.LET, identifier);
      case "const":
        return this.createToken(TokenType.CONST, identifier);
      case "import":
        return this.createToken(TokenType.IMPORT, identifier);
    }

    return this.createToken(TokenType.IDENTIFIER, identifier);
  }

  /* Reads the next identifier */
  #readIdentifier() {
    const start = this.#idx;
    while (!this.#reachedEndOfSource() && this.#isIdentifier(this.#peek())) {
      this.#advance();
    }

    return this.#source.substring(start, this.#idx);
  }

  /* Lexes a number */
  #lexNumber(char) {
    if (char === "0") {
      const radix = this.#advance();
      switch (radix) {
        case "x":
          return this.#readHexNumber();
        case "o":
          return this.#readOctalNumber();
        case "b":
          return this.#readBinaryNumber();
      }

      this.#rewind();
    }

    this.#rewind();
    return this.#readDecimalNumber();
  }

  /* Reads a hexadecimal number (0-F) */
  #readHexNumber() {
    if (!this.#isHex(this.#peek())) {
      return this.createError(`expected hex number, got ${this.#peek()}`);
    }

    const start = this.#idx;
    while (!this.#reachedEndOfSource() && this.#isHex(this.#peek())) {
      this.#advance();
    }

    const num = this.#source.substring(start, this.#idx);
    return this.createToken(TokenType.NUMBER, parseInt(num, 16));
  }

  /* Reads an octal number (0-7) */
  #readOctalNumber() {
    if (!this.#isOctal(this.#peek())) {
      return this.createError(`expected octal number, got ${this.#peek()}`);
    }

    const start = this.#idx;
    while (!this.#reachedEndOfSource() && this.#isOctal(this.#peek())) {
      this.#advance();
    }

    const num = this.#source.substring(start, this.#idx);
    return this.createToken(TokenType.NUMBER, parseInt(num, 8));
  }

  /* Reads a binary number (0/1) */
  #readBinaryNumber() {
    if (!this.#isBinary(this.#peek())) {
      return this.createError(`expected binary number, got ${this.#peek()}`);
    }

    const start = this.#idx;
    while (!this.#reachedEndOfSource() && this.#isBinary(this.#peek())) {
      this.#advance();
    }

    const num = this.#source.substring(start, this.#idx);
    return this.createToken(TokenType.NUMBER, parseInt(num, 2));
  }

  /* Reads a decimal number (0-9) */
  #readDecimalNumber() {
    if (!this.#isDigit(this.#peek())) {
      return this.createError(`expected decimal number, got ${this.#peek()}`);
    }

    const start = this.#idx;
    while (!this.#reachedEndOfSource() && this.#isDigit(this.#peek())) {
      this.#advance();
    }

    if (this.#peek() === ".") {
      this.#advance();
      while (!this.#reachedEndOfSource() && this.#isDigit(this.#peek())) {
        this.#advance();
      }
    }

    const num = this.#source.substring(start, this.#idx);
    return this.createToken(TokenType.NUMBER, parseFloat(num));
  }

  /* Lexes a string wrapped in quotes */
  #lexString() {
    let str = "";

    while (!this.#reachedEndOfSource()) {
      const char = this.#peek();

      if (char === "\n") {
        return this.createError("unclosed string");
      }

      if (char == '"') {
        break;
      }

      if (char === "\\") {
        this.#advance();

        const escape = this.#advance();
        switch (escape) {
          case "f":
            str += "\f";
            continue;
          case "n":
            str += "\n";
            continue;
          case "r":
            str += "\r";
            continue;
          case "t":
            str += "\t";
            continue;
          case "v":
            str += "\v";
            continue;
          case "0":
            str += "\0";
            continue;
          case "\\":
            str += "\\";
            continue;
          case "'":
            str += "'";
            continue;
          case '"':
            str += '"';
            continue;
          case "x":
            try {
              str += this.#readHexEscapeSequence();
            } catch ({ name, message }) {
              return this.createError(message);
            }
            continue;
          case "u":
            try {
              str += this.#readUnicodeEscapeSequence();
            } catch ({ name, message }) {
              return this.createError(message);
            }
            continue;
        }

        return this.createError(`invalid escape sequence: '\\${escape}'`);
      }

      str += this.#advance();
    }

    if (this.#reachedEndOfSource()) {
      return this.createError("unclosed string");
    }

    this.#advance();
    return this.createToken(TokenType.STRING, str);
  }

  /* Reads a hex escape sequence (\xXX) */
  #readHexEscapeSequence() {
    let sequence = "";
    for (let i = 0; i < 2; ++i) {
      const c = this.#advance();
      if (!this.#isHex(c)) {
        throw new Error(`expected hex number, got '${c}'`);
      }

      sequence += c;
    }

    return parseInt(sequence, 16);
  }

  /* Reads a unicode escape sequence (\uXXXX) */
  #readUnicodeEscapeSequence() {
    let sequence = "";
    for (let i = 0; i < 4; ++i) {
      const c = this.#advance();
      if (!this.#isHex(c)) {
        throw new Error(`expected hex number, got '${c}'`);
      }

      sequence += c;
    }

    const charcode = parseInt(sequence, 16);
    return String.fromCharCode(charcode);
  }

  /* Consumes the current character if it matches what was expected */
  #match(char) {
    if (this.#reachedEndOfSource() || this.#peek() !== char) {
      return false;
    }

    this.#advance();
    return true;
  }

  /* Returns the current character */
  #peek() {
    return this.#source[this.#idx];
  }

  /* Advances one character forward in the stream and returns it */
  #advance() {
    this.#char++;
    return this.#source[this.#idx++];
  }

  /* Rewinds one character */
  #rewind() {
    if (this.#idx <= 0) {
      return;
    }

    this.#idx--;
    this.#char--;
  }

  /* Checks if a character is a letter */
  #isAlpha(char) {
    return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
  }

  /* Checks if a character is a valid base-16 number */
  #isHex(char) {
    return (
      this.#isDigit(char) ||
      (char >= "A" && char <= "F") ||
      (char >= "a" && char <= "f")
    );
  }

  /* Checks if a character is a valid base-8 number */
  #isOctal(char) {
    return char >= "0" && char <= "7";
  }

  /* Checks if a character is a valid base-2 number */
  #isBinary(char) {
    return char == "0" || char == "1";
  }

  /* Checks if a character is a number */
  #isDigit(char) {
    return char >= "0" && char <= "9";
  }

  /* Checks if a character is a valid identifier */
  #isIdentifier(char) {
    return char == "_" || this.#isAlpha(char) || this.#isDigit(char);
  }

  /* Checks if the lexer has reached the end of the source code */
  #reachedEndOfSource() {
    return this.#idx >= this.#source.length;
  }
}
