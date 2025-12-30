/* GameLISP
 * GameLISP VM
 */

"use strict";

const KERNEL = `
(while true (
  (if (__needs_update) (
    (update)
  ))
  (if (__needs_draw) (
    (clear)
    (draw)
  ))
))
`;

const UPDATE_INTERVAL = 2;
const DRAW_INTERVAL = 1000.0 / 60.0;

const VMStatus = {
  STOPPED: 0,
  PAUSED: 1,
  RUNNING: 2,
};

class VM {
  #updateIntervalID = -1;
  #drawIntervalID = -1;

  #status = VMStatus.STOPPED;

  #frames = [];
  #frameIdx = 0;
  #fp = 0;

  #needsUpdate = true;
  #needsDraw = true;

  #constants = [];
  #libraries = {};
  #envs = [];
  #stack = [];

  #handlers = null;

  constructor() {
    this.#initHandlers();
    this.#initGlobalEnv();
  }

  /* Adds an importable library */
  addLibrary(modName, mod) {
    this.#libraries[modName] = mod;
  }

  /* Loads source code */
  load(source) {
    this.stop();

    source += KERNEL;

    const compiler = new Compiler(source);
    compiler.compile();

    this.#frames = [compiler.getOpcodes()];
    this.#frameIdx = 0;
    this.#fp = 0;

    this.#constants = compiler.getConstants();

    this.#initGlobalEnv();
  }

  /* Performs a step */
  step() {
    if (this.isStopped()) {
      return;
    }

    if (this.isRunning()) {
      this.pause();
    }

    this.#step();
  }

  /* Starts running the VM */
  run() {
    if (this.#updateIntervalID !== -1) {
      this.stop();
    }

    switchToPauseIcon();

    this.setStatus(VMStatus.RUNNING);
    this.#updateIntervalID = setInterval(
      this.#multiStep.bind(this),
      UPDATE_INTERVAL,
    );
    this.#drawIntervalID = setInterval(() => {
      this.#needsDraw = true;
    }, DRAW_INTERVAL);

    printToConsole("Running VM...");
  }

  /* Pauses the VM */
  pause() {
    printToConsole("VM paused!");
    this.#stopIntervals();

    switchToPlayIcon();
    this.setStatus(VMStatus.PAUSED);
  }

  /* Stops running the VM */
  stop() {
    printToConsole("VM stopped!");
    this.#stopIntervals();

    switchToPlayIcon();
    this.setStatus(VMStatus.STOPPED);
  }

  /* Checks if the VM is running */
  isRunning() {
    return this.getStatus() === VMStatus.RUNNING;
  }

  /* Checks if the VM is paused */
  isPaused() {
    return this.getStatus() === VMStatus.PAUSED;
  }

  /* Checks if the VM is stopped */
  isStopped() {
    return this.getStatus() === VMStatus.STOPPED;
  }

  /* Sets the current state of the VM (see VMStatus above) */
  setStatus(to) {
    this.#status = to;
  }

  /* Returns the current state of the VM */
  getStatus() {
    return this.#status;
  }

  /* Initializes the handlers table (table of functions that deal with opcodes) */
  #initHandlers() {
    this.#handlers = {
      /* Pushes a constant to the stack */
      [Opcode.GET_CONST]: () => {
        const idx = this.#next();
        this.#push(this.#constants[idx]);
      },
      /* Creates a new variable, its value is popped from the stack */
      [Opcode.DEF_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#pop();
        this.#addIdentifier(identifier, value);
      },
      /* Pushes the value of a variable to the stack */
      [Opcode.GET_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#getIdentifier(identifier);
        this.#push(value);
      },
      /* Sets the value of a variable to one popped from the stack */
      [Opcode.SET_VARIABLE]: () => {
        const idx = this.#next();
        const identifier = this.#constants[idx];

        const value = this.#pop();
        this.#setIdentifier(identifier, value);
      },
      /* Pushes a true boolean value to the stack */
      [Opcode.TRUE]: () => {
        const t = new BoolValue(true);
        this.#push(t);
      },
      /* Pushes a false boolean value to the stack */
      [Opcode.FALSE]: () => {
        const f = new BoolValue(false);
        this.#push(f);
      },
      /* Pushes an undefined value to the stack */
      [Opcode.UNDEFINED]: () => {
        const u = new UndefinedValue();
        this.#push(u);
      },
      /* Pops a value from the stack, discarding it */
      [Opcode.POP]: () => {
        this.#pop();
      },
      /* Pops two values from the stack and compares them for equality
       * The result is pushed to the stack
       */
      [Opcode.EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.eq(b));
      },
      /* Pops two values from the stack and compares them for inequality
       * The result is pushed to the stack
       */
      [Opcode.NOT_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.neq(b));
      },
      /* Pops two values from the stack and checks if one is greater than the
       * other
       *
       * The result is pushed to the stack
       */
      [Opcode.GREATER]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.gt(b));
      },
      /* Pops two values from the stack and checks if one is greater than or
       * equal to the other
       *
       * The result is pushed to the stack
       */
      [Opcode.GREATER_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.gteq(b));
      },
      /* Pops two values from the stack and checks if one is less than the other
       * The result is pushed to the stack
       */
      [Opcode.LESS]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.lt(b));
      },
      /* Pops two values from the stack and checks if one is less than or equal
       * to the other
       *
       * The result is pushed to the stack
       */
      [Opcode.LESS_EQUAL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.lteq(b));
      },
      /* Pops two values from the stack and adds them together
       * The result is pushed to the stack
       */
      [Opcode.ADD]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.add(b));
      },
      /* Pops two values from the stack and subtracts one from the other
       * The result is pushed to the stack
       */
      [Opcode.SUB]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.sub(b));
      },
      /* Pops two values from the stack and multiplies them
       * The result is pushed to the stack
       */
      [Opcode.MUL]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.mul(b));
      },
      /* Pops two values from the stack and divides one by the other
       * The result is pushed to the stack
       */
      [Opcode.DIV]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.div(b));
      },
      /* Pops two values from the stack and floor-divides one by the other
       * The result is pushed to the stack
       */
      [Opcode.FLOOR_DIV]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.fdiv(b));
      },
      /* Pops two values from the stack and gets the module of one by the other
       * The result is pushed to the stack
       */
      [Opcode.MOD]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.mod(b));
      },
      /* Pops two values from the stack and checks if either is true
       * The result is pushed to the stack
       */
      [Opcode.OR]: () => {
        const b = this.#pop();
        const a = this.#pop();

        const aTruthy = a.truthy();
        if (aTruthy.getValue() === true) {
          this.#push(aTruthy);
          return;
        }

        this.#push(b.truthy());
      },
      /* Pops two values from the stack and checks if both are true
       * The result is pushed to the stack
       */
      [Opcode.AND]: () => {
        const b = this.#pop();
        const a = this.#pop();

        const aTruthy = a.truthy();
        if (aTruthy.getValue() === false) {
          this.#push(aTruthy);
          return;
        }

        this.#push(b.truthy());
      },
      /* Pops a value from the stack and negates it (-VALUE)
       * The result is pushed to the stack
       */
      [Opcode.NEGATE]: () => {
        const a = this.#pop();
        this.#push(a.negate());
      },
      /* Pops a value from the stack and NOTs them (!VALUE)
       * The result is pushed to the stack
       */
      [Opcode.NOT]: () => {
        const a = this.#pop();
        this.#push(a.not());
      },
      /* Moves the program counter by a signed offset (forwards or backwards) */
      [Opcode.JUMP]: () => {
        const offset = this.#next();
        this.#fp += offset;
      },
      /* Moves the program counter by a signed offset (forwards or backwards)
       * if the value at the top of the stack is false
       */
      [Opcode.JUMP_IF_FALSE]: () => {
        const offset = this.#next();

        const condition = this.#pop().not();
        if (condition.getValue()) {
          this.#fp += offset;
        }
      },
      /* Duplicates the value at the top of the stack */
      [Opcode.DUP]: () => {
        this.#push(this.#peek());
      },
      /* Calls a function
       *   ARG 1: number of function arguments
       *   ARG 2: function name (index of constant with function name)
       *
       * Arguments are popped from the stack
       */
      [Opcode.CALL]: () => {
        const argCount = this.#next();

        const idx = this.#next();
        const identifier = this.#constants[idx];
        const fn = this.#getIdentifier(identifier);

        /* Since native functions don't run in the VM, we treat them as a special case */
        if (fn.getType() === ValueType.NATIVE_FUNCTION) {
          const args = Array(argCount);
          for (let i = argCount - 1; i >= 0; --i) {
            args[i] = this.#pop();
          }

          const value = fn.getValue();

          const returnValue = value(...args);
          if (returnValue !== undefined) {
            this.#push(returnValue);
          }

          return;
        }

        /* Check if arguments match */
        if (fn.getArity() !== argCount) {
          return;
        }

        const localEnv = new Env();

        const args = fn.getArgs();
        for (let i = 0; i < args.length; ++i) {
          const arg = args[i];
          const value = this.#pop();
          localEnv.setIdentifier(arg, value);
        }

        this.#pushEnv(localEnv);

        const frame = fn.getValue();
        this.#pushFrame(frame);
      },
      /* Returns from a function
       * Outside of functions, ends the program
       */
      [Opcode.RETURN]: () => {
        if (this.#frameIdx === 0) {
          this.stop();
          return;
        }

        const returnValue = this.#pop();
        this.#fp = this.#pop();

        this.#frames.pop();
        --this.#frameIdx;

        this.#push(returnValue);
        this.#popEnv();
      },
      /* Accesses a member/index B of A, both popped from the stack
       * The result is pushed to the stack
       */
      [Opcode.DOT]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.dot(b));
      },
      /* Pops two values from the stack and check if A is of type B
       * The result is pushed to the stack
       */
      [Opcode.IS]: () => {
        const b = this.#pop();
        const a = this.#pop();

        this.#push(a.is(b));
      },
      /* Imports a module/library/whatever */
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

  /* Initializes the global environment
   * It contains all the global functions and variables accessible to the user
   */
  #initGlobalEnv() {
    const globalEnv = new Env();

    /* Types */
    globalEnv.addFromObject({
      bool: new TypeValue(ValueType.BOOL, (value) => {
        return value.truthy();
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
      __needs_update: new NativeFunctionValue(() => {
        if (this.#needsUpdate === true) {
          this.#needsUpdate = false;
          return new BoolValue(true);
        }

        return new BoolValue(false);
      }, 0),
      __needs_draw: new NativeFunctionValue(() => {
        if (this.#needsDraw === true) {
          this.#needsDraw = false;
          return new BoolValue(true);
        }

        return new BoolValue(false);
      }, 0),
      print: new NativeFunctionValue((...args) => {
        const str = args.join(" ");

        printToConsole(str);
      }, -1),
    });

    this.#envs = [globalEnv];
  }

  #stopIntervals() {
    if (this.#updateIntervalID !== -1) {
      clearInterval(this.#updateIntervalID);
      this.#updateIntervalID = -1;
    }

    if (this.#drawIntervalID !== -1) {
      clearInterval(this.#drawIntervalID);
      this.#drawIntervalID = -1;
    }
  }

  /* Performs a bunch of steps at once
   *
   * TODO: figure out what's a reasonable number to use here. Should allow for
   * fast code execution, but also without slowing down the browser...
   * This function is called every UPDATE_INTERVAL ms, so it should also not
   * run for longer than that
   */
  #multiStep() {
    this.#needsUpdate = true;
    for (let i = 0; i < 160; ++i) {
      this.#step();
    }
  }

  /* Executes a step (fetches op, runs it) */
  #step() {
    const op = this.#next();

    try {
      const fn = this.#handlers[op];
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

  /* Fetches the next op */
  #next() {
    return this.#frames[this.#frameIdx][this.#fp++];
  }
}
