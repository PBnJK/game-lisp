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

  #eval = null;
  #status = VMStatus.STOPPED;

  constructor() {}

  load(source) {
    this.stop();
    this.#eval = new Eval(source);
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

    vm.setStatus(VMStatus.RUNNING);
    this.#intervalID = setInterval(this.#step.bind(this));
  }

  pause() {
    if (this.#intervalID !== -1) {
      clearInterval(this.#intervalID);
      this.#intervalID = -1;
    }

    vm.setStatus(VMStatus.PAUSED);
  }

  stop() {
    if (this.#intervalID !== -1) {
      clearInterval(this.#intervalID);
      this.#intervalID = -1;
    }

    vm.setStatus(VMStatus.STOPPED);
  }

  #step() {
    console.log(this.#eval.step());
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
}
