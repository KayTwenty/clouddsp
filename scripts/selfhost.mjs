// Run all of cloudDSP on this machine: the website and a GPU worker using the
// local GPU. No cloud accounts needed: files and jobs are stored under .data/.
//
//   npm run selfhost            build if needed, then start both
//   npm run selfhost -- --port 8080
//
// Set DATABASE_URL or S3_* / R2_* in .env.local to use Postgres or object
// storage instead; everything else stays the same.

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const port = process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : "3000";
const isWindows = process.platform === "win32";

const log = (message) => console.log(`\x1b[35m[selfhost]\x1b[0m ${message}`);

// Production mode refuses workers without a token, so make one and keep it.
function workerToken() {
  if (process.env.WORKER_TOKEN) return process.env.WORKER_TOKEN;
  const file = path.join(root, ".data", "worker-token");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(path.dirname(file), { recursive: true });
  const token = randomBytes(32).toString("hex");
  writeFileSync(file, token);
  log("created a worker token in .data/worker-token");
  return token;
}

function needsBuild() {
  return !existsSync(path.join(root, ".next", "BUILD_ID"));
}

const env = { ...process.env, WORKER_TOKEN: workerToken(), PORT: port };

if (needsBuild()) {
  log("building the website (first run only)...");
  const build = spawnSync(isWindows ? "npm.cmd" : "npm", ["run", "build"], { cwd: root, env, stdio: "inherit", shell: isWindows });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const children = [];

function run(name, color, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const relay = (stream) => (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => stream.write(prefix + line + "\n"));
  child.stdout.on("data", relay(process.stdout));
  child.stderr.on("data", relay(process.stderr));
  child.on("exit", (code) => {
    log(`${name} stopped (exit ${code}); shutting down`);
    shutdown(code ?? 1);
  });
  children.push(child);
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) {
      if (isWindows) spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

log(`starting cloudDSP on http://localhost:${port}`);
run("web", "36", isWindows ? "npx.cmd" : "npx", ["next", "start", "-p", port]);
// The worker talks to the site over localhost, exactly like a remote GPU would.
run("gpu", "33", "uv", ["run", "--no-project", "worker/start.py"], {
  CLOUDDSP_URL: `http://localhost:${port}`,
});
