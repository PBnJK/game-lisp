/* GameLISP
 * The GameLISP game library
 */

"use strict";

/* This library comprises the "game engine"
 *
 * All of the functions here are automatically serialized into an Env (see the
 * function *createLibrary* below) which is exposed to the user
 */
class GameLib {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  /* @fn fill_color
   * Sets the fill color
   *
   * @param r: number = Red
   * @param g: number = Green
   * @param b: number = Blue
   */
  fillColor(r, g, b) {
    this.ctx.fillStyle = `rgb(${r.getValue()} ${g.getValue()} ${b.getValue()})`;
  }

  /* @fn fill_color_css
   * Sets the fill color with a CSS color string
   *
   * @param css: string = CSS color string
   */
  fillColor(css) {
    this.ctx.fillStyle = css.getValue();
  }

  /* @fn draw_rect
   * Draws a rectangle
   *
   * @param x: number = X position of the rectangle
   * @param y: number = Y position of the rectangle
   * @param w: number = Width of the rectangle
   * @param h: number = Height of the rectangle
   */
  drawRect(x, y, w, h) {
    this.ctx.fillRect(x.getValue(), y.getValue(), w.getValue(), h.getValue());
  }

  /* @fn clear
   * Clears the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function createLibrary(canvas) {
  const lib = new GameLib(canvas);
  const env = new Env();

  const methods = Object.getOwnPropertyNames(GameLib.prototype);
  for (const methodName of methods) {
    const method = lib[methodName].bind(lib);
    env.setIdentifier(
      toSnakeCase(methodName),
      new NativeFunctionValue(method, method.length),
    );
  }

  return env;
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (upper) => {
    return `_${upper.toLowerCase()}`;
  });
}
