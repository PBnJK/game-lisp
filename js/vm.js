/* WALL
 * WALL VM
 */

"use strict";

const VMStatus = {
  STOPPED: 0,
  PAUSED: 1,
  RUNNING: 2,
};

class VM {
  #eval = null;
  #status = VMStatus.STOPPED;

  constructor() {}

  load(source) {
    this.stop();
    this.#eval = new Eval(source);
  }

  step() {
    switch (this.getStatus()) {
      case VMStatus.STOPPED:
        break;
      case VMStatus.PAUSED:
        this.#eval.eval();
        break;
      case VMStatus.RUNNING:
        this.#eval.pause();
        break;
    }
  }

  play() {}

  pause() {}

  stop() {}

  setStatus(to) {
    this.#status = to;
  }

  getStatus() {
    return this.#status;
  }
}
