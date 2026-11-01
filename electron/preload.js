/**
 * Narrow preload bridge.
 *
 * Only the selected methods are exposed; raw ipcRenderer, filesystem and
 * process capabilities stay in main.
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md section 10.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /** Selects the nonsecret connection profile; null disconnects. */
  connectionSelect: (input) => ipcRenderer.invoke("connection:select", input),
  /** Requests a single-use share permit after main verifies FRM authentication. */
  shareAuthorize: (input) => ipcRenderer.invoke("share:authorize", input),
  /** Starts the owned tunnel using a permit only. */
  tunnelStart: (input) => ipcRenderer.invoke("tunnel:start", input),
  /** Stops the owned tunnel and reports confirmed/unknown closure. */
  tunnelStop: (input) => ipcRenderer.invoke("tunnel:stop", input),
  /** Returns the current authoritative tunnel state. */
  tunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
  /**
   * Subscribes to authoritative tunnel state events.
   * @returns {() => void} unsubscribe function
   */
  onTunnelState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("tunnel:state", listener);
    return () => ipcRenderer.removeListener("tunnel:state", listener);
  },
});
