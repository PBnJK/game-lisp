/* GameLISP
 * GameLISP environments
 */

class Env {
  #env = null;

  constructor() {
    this.#env = new Map();
  }

  /* Returns the Env map */
  getEnv() {
    return this.#env;
  }

  /* Adds identifiers to the Env from an iterable Javascript object */
  addFromObject(kv) {
    for (const [k, v] of Object.entries(kv)) {
      this.setIdentifier(k, v);
    }
  }

  /* Adds identifiers to the Env from another env */
  addFromEnv(env) {
    const kv = env.getEnv();
    for (const [k, v] of kv) {
      this.setIdentifier(k, v);
    }
  }

  /* Sets the value of an identifier */
  setIdentifier(k, v) {
    this.#env.set(k, v);
  }

  /* Returns the value of an identifier */
  getIdentifier(k) {
    return this.#env.get(k);
  }

  /* Checks if the Env has an identifier */
  hasIdentifier(identifier) {
    return this.#env.has(identifier);
  }
}
