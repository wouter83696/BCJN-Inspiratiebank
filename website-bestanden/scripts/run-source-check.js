#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const scriptsDir = __dirname;

function run(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(scriptsDir, scriptName)], {
      cwd: path.resolve(scriptsDir, "..", ".."),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} stopte met code ${code}`));
    });
  });
}

async function main() {
  await run("update-offers.js");
  await run("publish-auto-agenda-items.js");
  console.log("Broncheck volledig afgerond.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
