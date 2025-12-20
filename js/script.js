const runnerConsole = document.getElementById("runner-console");

const vm = new VM();

function main() {
  const runnerStep = document.getElementById("runner-step-button");
  runnerStep.addEventListener("click", (e) => {});

  const runnerPlayPause = document.getElementById("runner-play-pause-button");
  runnerPlayPause.addEventListener("click", (e) => {});

  const runnerStop = document.getElementById("runner-stop-button");
  runnerStop.addEventListener("click", (e) => {});

  const runnerTrash = document.getElementById("runner-trash-button");
  runnerTrash.addEventListener("click", () => {
    runnerConsole.value = "";
  });

  runnerConsole.value = "asfasfasfafs";
}

function printToConsole(str) {
  printToConsoleRaw(str);
  printToConsoleRaw("\n");
}

function printToConsoleRaw(str) {
  runnerConsole.value += str;
}

main();
