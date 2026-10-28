const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
let server;
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});
const origin = "http://127.0.0.1:4310";
app.setName("HEARTH");
app.whenReady().then(async () => {
  const root = path.join(__dirname, "../..");
  require("node:fs").mkdirSync(app.getPath("userData"), { recursive: true });
  const instanceId = require("node:crypto").randomUUID();
  const env = {
    ...process.env,
    HEARTH_INSTANCE_ID: instanceId,
    HEARTH_STATIC_DIR: path.join(root, "dist"),
    HEARTH_DATA_DIR: path.join(app.getPath("userData"), "data"),
    HEARTH_HOST: "127.0.0.1",
    HEARTH_PORT: "4310",
    ELECTRON_RUN_AS_NODE: "1",
  };
  // Bundle server for packaged builds. Dev uses the project's pinned tsx runtime.
  server = app.isPackaged
    ? spawn(process.execPath, [path.join(root, "dist-server/index.js")], {
        cwd: app.getPath("userData"),
        env,
        stdio: "ignore",
      })
    : spawn(
        process.execPath,
        ["--import", "tsx", path.join(root, "apps/server/src/index.ts")],
        { cwd: root, env, stdio: "ignore" },
      );
  server.on("error", () => {});
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(origin + "/api/health");
      if (r.ok && (await r.json()).instanceId === instanceId) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    require("electron").dialog.showErrorBox(
      "HEARTH could not start",
      "Check the host port (4310) and the data directory. Run npm start from a terminal to view diagnostics.",
    );
    app.quit();
    return;
  }
  function window() {
    const w = new BrowserWindow({
      width: 1360,
      height: 920,
      minWidth: 860,
      minHeight: 650,
      title: "HEARTH",
      backgroundColor: "#f7f5ef",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    w.loadURL(origin);
    w.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    w.webContents.on("will-navigate", (e, url) => {
      if (new URL(url).origin !== origin) {
        e.preventDefault();
        if (url.startsWith("https://")) shell.openExternal(url);
      }
    });
  }
  window();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) window();
  });
  ipcMain.handle("hearth:login-item", (event, enable) => {
    if (
      event.senderFrame.url.startsWith(origin + "/") &&
      typeof enable === "boolean" &&
      process.platform === "darwin"
    ) {
      app.setLoginItemSettings({ openAtLogin: enable });
      return app.getLoginItemSettings().openAtLogin;
    }
    return false;
  });
});
app.on("before-quit", () => {
  if (server) server.kill();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
