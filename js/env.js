/* GameLISP
 * GameLISP environments
 */

class Env {
  #env = null;

  constructor() {
    this.#env = new Map();
  }

  addFromObject(kv) {
    for (const [k, v] of Object.entries(kv)) {
      this.setIdentifier(k, v);
    }
  }

  setIdentifier(k, v) {
    this.#env.set(k, v);
  }

  getIdentifier(k) {
    return this.#env.get(k);
  }

  hasIdentifier(identifier) {
    return this.#env.has(identifier);
  }
}
