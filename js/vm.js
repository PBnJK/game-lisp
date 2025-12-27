/* GameLISP
 * GameLISP VM
 */

"use strict";

const VMStatus = {
  STOPPED: 0,
  PAUSED: 1,
  RUNNING: 2,
};

class VM {
  #intervalID = -1;

  #status = VMStatus.STOPPED;

  #frames = [];
  #frameIdx = 0;
  #fp = 0;

  #constants = [];
  #libraries = {};
  #envs = [];
  #stack = [];

  #handlers = null;

  constructor() {
    this.#initHandlers();
    this.#initGlobalEnv();
  }

  addLibrary(modName, mod) {
    this.#libraries[modName] = mod;
  }

  load(source) {
    this.stop();

    const compiler = new Compiler(source);
    compiler.compile();

    this.#frames = [compiler.getOpcodes()];
    this.#frameIdx = 0;
    this.#fp = 0;

    this.#constants = compiler.getConstants();

    this.#initGlobalEnv();
  }

  step() {
    if (this.isStopped()) {
      return;
    }

    if (this.isRunning()) {
      this.pause();
    }

    this.#step();
  }

  run() {
    if (this.#intervalID !== -1) {
      this.stop();
    }

    switchToPauseIcon();

    this.setStatus(VMStatus.RUNNING);
    this.#intervalID = setInterval(this.#multiStep.bind(this), 5);

    printToConsole("Running VM...");
  }

  pause() {
    if (this.#intervalID !== -1) {
      clearInterval(this.#intervalID);
      this.#intervalID = -1;

      printToConsole("VM paused!");
    }

    switchToPlayIcon();
    this.setStatus(VMStatus.PAUSED);
  }

  stop() {
    if (this.#intervalID !== -1) {
      clearInterval(this.#intervalID);
      this.#intervalID = -1;

      printToConsole("VM stopped!");
    }

    switchToPlayIcon();
    this.setStatus(VMStatus.STOPPED);
  }

  isRunning() {
    return this.getStatus() === VMStatus.RUNNING;
  }

  isPaused() {
    return this.getStatus() === VMStatus.PAUSED;
  }

  isStopped() {
    return this.getStatus() === VMStatus.STOPPED;
  }

  setStatus(to) {
    this.#status = to;
  }

  getStatus() {
    return this.#status;
  }

  #initHandlers() {
    this.#handlers = {
      [Opcode.GET_CONST]: () => {
        const idx = this.#next();
        this.#push(this.#constants[idx]);
      },
      [Opcode.DEF_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#pop();
        this.#addIdentifier(identifier, value);
      },
      [Opcode.GET_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#getIdentifier(identifier);
        this.#push(value);
      },
      [Opcode.SET_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#pop();
        this.#setIdentifier(identifier, value);
      },
      [Opcode.TRUE]: () => {
        const t = new BoolValue(true);
        this.#push(this.#constants[t]);
      },
      [Opcode.FALSE]: () => {
        const f = new BoolValue(false);
        this.#push(this.#constants[f]);
      },
      [Opcode.POP]: () => {
        this.#pop();
      },
      [Opcode.EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.eq(b));
      },
      [Opcode.NOT_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.neq(b));
      },
      [Opcode.GREATER]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.gt(b));
      },
      [Opcode.GREATER_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.gteq(b));
      },
      [Opcode.LESS]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.lt(b));
      },
      [Opcode.LESS_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.lteq(b));
      },
      [Opcode.ADD]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.add(b));
      },
      [Opcode.SUB]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.sub(b));
      },
      [Opcode.MUL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.mul(b));
      },
      [Opcode.DIV]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.div(b));
      },
      [Opcode.FLOOR_DIV]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.fdiv(b));
      },
      [Opcode.MOD]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.mod(b));
      },
      [Opcode.NEGATE]: () => {
        const a = this.#pop();
        this.#push(a.negate());
      },
      [Opcode.NOT]: () => {
        const a = this.#pop();
        this.#push(a.not());
      },
      [Opcode.JUMP]: () => {
        const offset = this.#next();
        this.#fp += offset;
      },
      [Opcode.JUMP_IF_FALSE]: () => {
        const offset = this.#next();

        const condition = this.#pop().not();
        if (condition.getValue()) {
          this.#fp += offset;
        }
      },
      [Opcode.DUP]: () => {
        this.#push(this.#peek());
      },
      [Opcode.CALL]: () => {
        const argCount = this.#next();

        const idx = this.#next();
        const identifier = this.#constants[idx];
        const fn = this.#getIdentifier(identifier);

        if (fn.getType() === ValueType.NATIVE_FUNCTION) {
          const args = Array(argCount);
          for (let i = argCount - 1; i >= 0; --i) {
            args[i] = this.#pop();
          }

          const value = fn.getValue();
          return value(...args);
        }

        if (fn.getArity() !== argCount) {
          return;
        }

        const localEnv = new Env();

        const args = fn.getArgs();
        for (let i = args.length - 1; i >= 0; --i) {
          const arg = args[i];
          const value = this.#pop();
          localEnv.setIdentifier(arg, value);
        }

        this.#pushEnv(localEnv);

        const frame = fn.getValue();
        this.#pushFrame(frame);
      },
      [Opcode.RETURN]: () => {
        if (this.#frameIdx === 0) {
          this.stop();
          return;
        }

        this.#frames.pop();
        --this.#frameIdx;

        this.#fp = this.#pop();
        this.#popEnv();
      },
      [Opcode.DOT]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.dot(b));
      },
      [Opcode.IS]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.is(b));
      },
      [Opcode.IMPORT]: () => {
        const modIdx = this.#next();
        const modIdent = this.#constants[modIdx];
        const mod = this.#libraries[modIdent];

        const targetEnv = this.#envs[this.#envs.length - 1];
        targetEnv.addFromEnv(mod);
      },
    };

    Object.keys(this.#handlers, (k) => {
      this.#handlers[k].bind(this);
    });
  }

  #initGlobalEnv() {
    const globalEnv = new Env();

    /* Types */
    globalEnv.addFromObject({
      bool: new TypeValue(ValueType.BOOL, (value) => {
        const v = value.getValue();
        switch (value.getType()) {
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

    this.#envs = [globalEnv];
  }

  #multiStep() {
    for (let i = 0; i < 80 && this.isRunning(); ++i) {
      this.#step();
    }
  }

  #step() {
    const op = this.#next();
    const fn = this.#handlers[op];

    try {
      fn();
    } catch (error) {
      this.stop();
      printToConsole(error);
      console.log(error);
    }
  }

  /* Peeks the top value in the stack */
  #peek() {
    return this.#stack[this.#stack.length - 1];
  }

  /* Pushes a value to the stack */
  #push(value) {
    if (this.#stack.length === 65536) {
      return;
    }

    this.#stack.push(value);
  }

  /* Pops a value from the stack */
  #pop() {
    return this.#stack.pop();
  }

  /* Pushes a new env to the Env stack */
  #pushEnv(env) {
    if (this.#envs.length === 256) {
      return;
    }

    this.#envs.push(env);
  }

  /* Pops the topmost env from the Env stack */
  #popEnv() {
    this.#envs.pop();
  }

  /* Pushes a new frame */
  #pushFrame(frame) {
    this.#push(this.#fp);

    this.#frames.push(frame);
    ++this.#frameIdx;

    this.#fp = 0;
  }

  /* Adds an identifier to the top Env
   * TODO: error checking
   */
  #addIdentifier(k, v) {
    const localEnvIdx = this.#envs.length - 1;
    const localEnv = this.#envs[localEnvIdx];
    if (localEnv.hasIdentifier(k)) {
      // return this.#createError(`identifier ${k} already exists in local scope`);
      return;
    }

    localEnv.setIdentifier(k, v);
  }

  /* Sets the value of an identifier in the top Env */
  #setIdentifier(k, v) {
    let envIdx = this.#findIdentifier(k);
    if (envIdx === -1) {
      envIdx = this.#envs.length - 1;
    }

    const env = this.#envs[envIdx];
    env.setIdentifier(k, v);
  }

  /* Gets the value of an identifier in the top Env
   * TODO: error checking
   */
  #getIdentifier(k) {
    const envIdx = this.#findIdentifier(k);
    if (envIdx === -1) {
      // return this.#createError(`no such identifier ${k}`);
      return;
    }

    const env = this.#envs[envIdx];
    return env.getIdentifier(k);
  }

  /* Finds an identifier in the top Env */
  #findIdentifier(identifier) {
    for (let i = this.#envs.length - 1; i >= 0; --i) {
      const env = this.#envs[i];
      if (env.hasIdentifier(identifier)) {
        return i;
      }
    }

    return -1;
  }

  #next() {
    return this.#frames[this.#frameIdx][this.#fp++];
  }
}
