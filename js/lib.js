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
  #keys = {};

  #fontSize = 16;
  #fontFamily = "Facade-Ouest";
  #fontStyle = "";

  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.ctx.fillStyle = "rgb(0, 0, 0)";
    this.ctx.font = "16px Facade-Ouest";
    console.log("start");

    window.addEventListener("keydown", (e) => {
      this.#keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.#keys[e.code] = false;
    });
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
  fillColorCss(css) {
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

  /* @fn draw_text
   * Draws text
   *
   * @param x: number = X position of the text
   * @param y: number = Y position of the text
   * @param text: str = Text to be drawn
   */
  drawText(x, y, text) {
    this.ctx.fillText(text.getValue(), x.getValue(), y.getValue());
  }

  /* @fn set_font_size
   * Sets the font size used when drawing text
   *
   * @param fontSize: string = CSS font size string
   */
  setFontSize(fontSize) {
    const v = fontSize.getValue();
    if (v !== this.#fontSize) {
      this.#fontSize = v;
      this.#updateFont();
    }
  }

  /* @fn set_font_family
   * Sets the font family used when drawing text
   *
   * @param fontFamily: string = CSS font family string
   */
  setFontFamily(fontFamily) {
    const v = fontFamily.getValue();
    if (v !== this.#fontFamily) {
      this.#fontFamily = v;
      this.#updateFont();
    }
  }

  /* @fn set_font_style
   * Sets the font style used when drawing text
   *
   * @param fontStyle: string = CSS font style string
   */
  setFontStyle(fontStyle) {
    const v = fontStyle.getValue();
    if (v !== this.#fontStyle) {
      this.#fontStyle = v;
      this.#updateFont();
    }
  }

  /* @fn clear
   * Clears the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /* @fn is_key_pressed
   * Checks if a key is pressed
   *
   * @param key: string = Key being checked
   * @return bool
   */
  isKeyPressed(key) {
    return new BoolValue(this.#keys[key] === true);
  }

  #updateFont() {
    this.ctx.font = `${this.#fontSize}px ${this.#fontFamily} ${this.#fontStyle}`;
    console.log(this.ctx.font);
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
