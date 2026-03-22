/**
 * ERP-V2 Desktop — Preload Script
 *
 * Exposes minimal, safe APIs to the renderer process via contextBridge.
 * NO direct access to Node.js, fs, path, or child_process.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  getServerPort: () => ipcRenderer.invoke("get-server-port"),

  // Platform
  platform: process.platform,

  // Printing
  print: (options) => ipcRenderer.invoke("print-page", options),
  printToPDF: () => ipcRenderer.invoke("print-to-pdf"),
});
