const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("hearthDesktop", {
  setLaunchAtLogin: (enabled) =>
    ipcRenderer.invoke("hearth:login-item", enabled),
});
