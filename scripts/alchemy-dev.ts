import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import killTree from "tree-kill";

const killTreeAsync = promisify(killTree);
const processTreeShutdownError = "Could not stop the Alchemy process tree.";

const nodeExecutable = Bun.which("node");

if (nodeExecutable === null) {
  throw new Error("Could not find the Node.js executable on PATH.");
}

const cliPath = fileURLToPath(
  new URL("../node_modules/alchemy/bin/cli.js", import.meta.url)
);

const environment = { ...process.env };

delete environment.npm_execpath;

const child = spawn(nodeExecutable, [cliPath, ...process.argv.slice(2)], {
  env: environment,
  stdio: "inherit",
});

let shutdownStarted = false;

const stopProcessTree = async () => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  if (child.pid === undefined) {
    process.exitCode = 1;

    return;
  }

  try {
    await killTreeAsync(child.pid);
  } catch (error) {
    console.error(processTreeShutdownError, error);
    process.exitCode = 1;
  }
};

const handleShutdownSignal = () => {
  void stopProcessTree();
};

process.on("SIGINT", handleShutdownSignal);

process.on("SIGTERM", handleShutdownSignal);

child.on("error", (error) => {
  console.error("Could not start the Alchemy CLI.", error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  if (!shutdownStarted) {
    process.exitCode = code ?? 1;
  }
});
