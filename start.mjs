// start.mjs — Production launcher
// Usage:  node start.mjs [--port 3000]

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse --port
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const PORT = portIdx !== -1 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 3000;

const apiEntry = path.resolve(__dirname, "artifacts/api-server/dist/index.mjs");

if (!fs.existsSync(apiEntry)) {
  console.error("Build not found. Run first:  pnpm run build");
  process.exit(1);
}

const child = spawn(process.execPath, [apiEntry], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));