/* GameLISP
 * Main script
 */

const creditsDialog = document.getElementById("credits-dialog");

const codeEditor = document.getElementById("editor-code-editor");

const canvas = document.getElementById("runner-canvas");
const runnerPlayPauseIcon = document.getElementById("runner-play-pause-icon");
const runnerConsole = document.getElementById("runner-console");

const vm = new VM();

let cachedHash = null;

/* Entry-point */
function main() {
  loadGameLibrary();

  hookEditorCallbacks();
  hookRunnerCallbacks();
  hookConsoleCallbacks();
}

/* Loads the main game library */
function loadGameLibrary() {
  const lib = createLibrary(canvas);
  vm.addLibrary("game", lib);
}
/* Hooks up the editor callbacks */
function hookEditorCallbacks() {
  const editorExamples = document.getElementById("editor-examples");
  for (const gameName of Object.keys(BUILTIN_GAMES)) {
    const option = document.createElement("option");

    option.text = gameName;
    option.setAttribute("value", gameName);

    editorExamples.appendChild(option);
  }

  editorExamples.addEventListener("change", (e) => {
    if (e.target.value === "none") {
      return;
    }

    codeEditor.value = BUILTIN_GAMES[e.target.value];
  });

  const editorCredits = document.getElementById("editor-credits-button");
  editorCredits.addEventListener("click", () => {
    creditsDialog.showModal();
  });
}

/* Hooks up the runner callbacks */
function hookRunnerCallbacks() {
  const runnerStep = document.getElementById("runner-step-button");
  runnerStep.addEventListener("click", () => {
    vm.step();
    switchToPlayIcon();
  });

  const runnerPlayPause = document.getElementById("runner-play-pause-button");
  runnerPlayPause.addEventListener("click", () => {
    if (vm.isRunning()) {
      vm.pause();
    } else {
      loadIfNeeded();
      vm.run();
      switchToPauseIcon();

      canvas.focus();
    }
  });

  const runnerStop = document.getElementById("runner-stop-button");
  runnerStop.addEventListener("click", () => {
    vm.stop();
    switchToPlayIcon();
  });
}

/* Hooks up the console callbacks */
function hookConsoleCallbacks() {
  const consoleTrash = document.getElementById("runner-trash-button");
  consoleTrash.addEventListener("click", () => {
    runnerConsole.value = "";
  });
}

/* Sets the pause/play icon to paused */
function switchToPauseIcon() {
  runnerPlayPauseIcon.setAttribute("src", "assets/icons/icn_pause.svg");
  runnerPlayPauseIcon.setAttribute("alt", "Pause");
}

/* Sets the pause/play icon to play */
function switchToPlayIcon() {
  runnerPlayPauseIcon.setAttribute("src", "assets/icons/icn_play.svg");
  runnerPlayPauseIcon.setAttribute("alt", "Play");
}

/* Loads code into the VM if needed */
function loadIfNeeded() {
  const source = codeEditor.value.trim();
  if (!vm.isStopped()) {
    if (cachedHash !== null) {
      const hashed = cyrb53(source);
      if (hashed === cachedHash) {
        return;
      }
    }
  }

  vm.load(source);
  cachedHash = cyrb53(source);
}

/* Prints a string to the console with a newline */
function printToConsole(str) {
  printToConsoleRaw(str);
  printToConsoleRaw("\n");
}

/* Prints a string to the console as-is */
function printToConsoleRaw(str) {
  runnerConsole.value += str;
}

/* Fast hashing function for strings
 *
 * Very lightly adapted from:
 *   https://stackoverflow.com/a/52171480
 *
 * Thank you to byrc!
 */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);

  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

main();
