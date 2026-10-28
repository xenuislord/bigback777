import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const data = mkdtempSync(join(tmpdir(), "hearth-electron-smoke-"));
const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: "1",
  HEARTH_PORT: "4312",
  HEARTH_HOST: "127.0.0.1",
  HEARTH_DATA_DIR: data,
  HEARTH_STATIC_DIR: resolve("dist"),
};
let child;
let logs = "";
async function start() {
  child = spawn(
    (await import("electron")).default,
    [resolve("dist-server/index.js")],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error("Server exited: " + logs);
    try {
      const r = await fetch("http://127.0.0.1:4312/api/health");
      if (r.ok) {
        assert.equal((await r.json()).database, true);
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Runtime did not become ready: " + logs);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await ended;
}
try {
  await start();
  const shell = await fetch("http://127.0.0.1:4312/");
  assert.match(await shell.text(), /HEARTH/);
  const setup = await fetch("http://127.0.0.1:4312/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hearth-request": "1" },
    body: JSON.stringify({
      password: "runtime-smoke-passphrase",
      names: ["One", "Two", "Three"],
    }),
  });
  assert.equal(setup.status, 200);
  const cookie = setup.headers.get("set-cookie").split(";")[0];
  const state = await fetch("http://127.0.0.1:4312/api/state", {
    headers: { cookie },
  });
  assert.equal((await state.json()).recipes.length, 60);
  await stop();
  await start();
  const auth = await fetch("http://127.0.0.1:4312/api/auth/status");
  assert.equal((await auth.json()).setup, true);
  console.log(
    "Electron Node runtime: bundled server, SQLite, static frontend, sign-in and persistence passed.",
  );
} finally {
  await stop();
  rmSync(data, { recursive: true, force: true });
}
