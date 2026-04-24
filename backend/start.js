const { spawnSync } = require("child_process");
const path = require("path");

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

try {
  run("npx", ["prisma", "migrate", "deploy"], "Prisma migrate deploy");

  if (String(process.env.RUN_SEED || "").toLowerCase() === "true") {
    run("node", [path.join("scripts", "seed-ramex.js")], "Ramex seed");
  }

  require("./index");
} catch (error) {
  console.error("[start] Failed to start production runtime:", error.message);
  process.exit(1);
}
