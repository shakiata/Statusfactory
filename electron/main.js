/**
 * Statusfactory Electron main process.
 *
 * Owns the window, the single connection profile, sharing authorization and
 * the one tunnel process. Renderer input is untrusted on every channel.
 *
 * Contracts: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 7–11;
 * docs/security/03_ARCHITECTURE_AND_REPOSITORY.md section 4.
 */

const { app, BrowserWindow, nativeTheme, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const { createSenderGuard, validateConnectionSelect, validateShareAuthorize, validateTunnelStart, validateEmpty } = require("./ipc-guards");
const { parseOrigin, upstreamAddress } = require("./tunnel/endpoint-policy");
const { createPermitRegistry } = require("./tunnel/permit-registry");
const { createOwnershipMarker } = require("./tunnel/ownership-marker");
const { createCliAdapter } = require("./tunnel/cli-adapter");
const { createSimulatorAdapter } = require("./tunnel/simulator-adapter");
const { createTunnelService } = require("./tunnel/service");
const { verifyArtifact } = require("./tunnel/cli-artifact");
const { loadProviderToken } = require("./provider-credentials");
const { probeSharing } = require("./frm-probe");
const { authorizeShare } = require("./share-authorization");
const { getSharingPolicy } = require("./sharing-policy");

// Follow the OS dark/light mode preference.
nativeTheme.themeSource = "system";

let mainWindow = null;
let tunnelService = null;
let permits = null;
let senderGuard = null;
let quitting = false;

/** Main-owned selected profile. Never includes an FRM or provider token. */
let profile = null;
/** Monotonic connection generation. */
let connectionGeneration = 0;
/** Profiles with an in-flight authorization probe. */
const probesInFlight = new Set();
/** Serializes connection selection and tunnel teardown. */
let connectionQueue = Promise.resolve();

// Development trust is never enabled in a packaged build: a stray NODE_ENV or
// --dev argument must not make main trust http://localhost:3000.
const isDev = !app.isPackaged && (process.env.NODE_ENV === "development" || process.argv.includes("--dev"));
// Dev-only simulation of tunnel lifecycle. Packaged builds ignore the flag and
// no network tunnel or process is created by the simulator adapter.
const simulationEnabled =
  !app.isPackaged && process.env.STATUSFACTORY_TUNNEL_SIMULATOR === "1";
const indexPath = path.join(__dirname, "../out/index.html");
const expectedDocument = pathToFileURL(indexPath).href;

/** Resolves the app icon path for Electron, handling dev vs packaged paths. */
function getIconPath() {
  const devIcon = path.join(__dirname, "../public/icon.png");
  const prodIcon = path.join(__dirname, "../out/icon.png");
  return fs.existsSync(devIcon) ? devIcon : prodIcon;
}

/** Serializes async connection operations so permits cannot race a target change. */
function withConnectionLock(task) {
  const run = connectionQueue.then(task, task);
  connectionQueue = run.then(() => undefined, () => undefined);
  return run;
}

/** Sends the authoritative tunnel state to the renderer, if it still exists. */
function sendTunnelState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("tunnel:state", { ...state, simulated: simulationEnabled });
  }
}

/** Builds the restricted child environment (no user PATH, no app secrets). */
function buildCliEnvironment() {
  const env = { HOME: app.getPath("userData"), TMPDIR: app.getPath("temp") };
  if (process.platform === "win32") {
    env.SystemRoot = process.env.SystemRoot;
    env.WINDIR = process.env.WINDIR;
    env.TEMP = app.getPath("temp");
    env.TMP = app.getPath("temp");
  }
  return env;
}

/** Creates the main BrowserWindow with explicit isolation and sandboxing. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Statusfactory",
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
  });

  if (isDev) {
    const devUrl = "http://localhost:3000";
    const loadDev = (retries = 10) => {
      mainWindow.loadURL(devUrl).catch(() => {
        if (retries > 0) setTimeout(() => loadDev(retries - 1), 1000);
      });
    };
    loadDev();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(indexPath);
  }

  const webContents = mainWindow.webContents;
  // Block unexpected top-level navigation and all window creation.
  webContents.on("will-navigate", (event, url) => {
    const allowed = isDev ? url.startsWith("http://localhost:3000") : url === expectedDocument;
    if (!allowed) event.preventDefault();
  });
  webContents.on("will-redirect", (event, url) => {
    const allowed = isDev ? url.startsWith("http://localhost:3000") : url === expectedDocument;
    if (!allowed) event.preventDefault();
  });
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  webContents.on("will-attach-webview", (event) => event.preventDefault());

  // A reload or same-window navigation is renderer loss for sharing purposes:
  // invalidate permits and start teardown independently of the renderer.
  webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) {
      permits?.invalidateAll();
      void tunnelService?.stop();
    }
  });

  // Renderer loss independently invalidates permits and starts teardown.
  const onRendererLost = () => {
    permits?.invalidateAll();
    void tunnelService?.stop();
  };
  webContents.on("render-process-gone", onRendererLost);
  webContents.on("destroyed", onRendererLost);

  webContents.on("did-finish-load", () => {
    webContents.insertCSS(`:root { color-scheme: dark; }`);
    // Dev-only visual smoke hook: capture the loaded window and exit. It is
    // ignored in packaged builds and never runs unless the env var is set.
    const capturePath = process.env.STATUSFACTORY_SMOKE_SCREENSHOT;
    if (capturePath && !app.isPackaged) {
      setTimeout(async () => {
        try {
          const image = await webContents.capturePage();
          fs.writeFileSync(capturePath, image.toPNG());
          console.log(`[smoke] screenshot written to ${capturePath}`);
        } catch (error) {
          console.error("[smoke] capture failed", error.message);
        } finally {
          app.quit();
        }
      }, 1200);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    onRendererLost();
  });
}

/** Applies a deny-by-default permission policy to the default session. */
function applySessionPolicy() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

app.whenReady().then(() => {
  const marker = createOwnershipMarker({
    filePath: path.join(app.getPath("userData"), "tunnel-ownership.json"),
  });
  const adapter = simulationEnabled ? createSimulatorAdapter() : createCliAdapter();
  tunnelService = createTunnelService({ adapter, marker, onState: sendTunnelState });
  tunnelService.init();
  permits = createPermitRegistry();
  senderGuard = createSenderGuard({ getWindow: () => mainWindow, isDev, indexPath });
  applySessionPolicy();
  createWindow();
});

// ─── Connection profile IPC ─────────────────────────────────────

ipcMain.handle("connection:select", async (event, input) => {
  try {
    senderGuard.assertTrusted(event);
    const { origin, endpoint, expectedGeneration } = validateConnectionSelect(input);
    return await withConnectionLock(async () => {
      if (expectedGeneration !== connectionGeneration) {
        return { ok: false, code: "generation-conflict", generation: connectionGeneration };
      }
      permits.invalidateAll();
      const current = tunnelService.getStatus();
      if (current.state !== "idle" && current.state !== "failed_closed") {
        const stopped = await tunnelService.stop();
        if (!stopped.confirmed) {
          return { ok: false, code: "recovery-required", state: stopped.state };
        }
      }
      if (origin === null) {
        profile = null;
        connectionGeneration += 1;
        return { ok: true, generation: connectionGeneration, origin: null };
      }
      connectionGeneration += 1;
      profile = {
        id: `p${connectionGeneration}`,
        origin: endpoint.origin,
        generation: connectionGeneration,
        target: upstreamAddress(endpoint),
      };
      return { ok: true, generation: connectionGeneration, profileId: profile.id, origin: profile.origin };
    });
  } catch (error) {
    return { ok: false, code: error.code || "invalid-input", error: error.message };
  }
});

// ─── Sharing authorization and tunnel IPC ──────────────────────

ipcMain.handle("share:authorize", async (event, input) => {
  try {
    senderGuard.assertTrusted(event);
    const { profileId, generation, frmToken } = validateShareAuthorize(input);
    // Unknown FRM authentication coverage (ACT-002) blocks sharing entirely.
    // The dev-only simulator reports a labelled simulated policy instead.
    const policy = getSharingPolicy({ simulate: simulationEnabled });
    if (!policy.verified) {
      return { ok: false, code: "auth-contract-unverified" };
    }
    // Snapshot the profile: `connection:select` may change the global while the
    // probe is in flight. A permit must never bind an authenticated probe on one
    // profile to a different current profile.
    const snapshot = profile;
    if (!snapshot || snapshot.id !== profileId || snapshot.generation !== generation) {
      return { ok: false, code: "profile-conflict" };
    }
    if (probesInFlight.has(snapshot.id)) return { ok: false, code: "probe-in-flight" };
    probesInFlight.add(snapshot.id);
    let result;
    try {
      result = await authorizeShare({
        snapshot,
        readCurrentProfile: () => profile,
        probe: () => probeSharing({ origin: snapshot.origin, token: frmToken }),
        issuePermit: (binding) => permits.issue(binding),
        senderId: event.sender.id,
      });
    } finally {
      probesInFlight.delete(snapshot.id);
    }
    if (!result.ok) return { ok: false, code: result.code };
    return {
      ok: true,
      permitId: result.permitId,
      expiresAt: result.expiresAt,
      profileId: snapshot.id,
      generation: snapshot.generation,
    };
  } catch (error) {
    return { ok: false, code: error.code || "invalid-input", error: error.message };
  }
});

ipcMain.handle("tunnel:start", async (event, input) => {
  try {
    senderGuard.assertTrusted(event);
    const { permitId } = validateTunnelStart(input);
    // Consume before validating the target: a permit is single-use even on failure.
    const binding = {
      senderId: event.sender.id,
      profileId: profile ? profile.id : null,
      origin: profile ? profile.origin : null,
      generation: profile ? profile.generation : null,
    };
    const consumed = permits.consume(permitId, binding);
    if (!consumed.ok) return { ok: false, code: consumed.reason };
    if (!profile) return { ok: false, code: "no-profile" };

    let artifact = { ok: true, path: "simulated", sha256: null };
    let provider = { ok: true, token: null };
    if (!simulationEnabled) {
      artifact = verifyArtifact({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        appPath: app.getAppPath(),
      });
      if (!artifact.ok) {
        return { ok: false, code: "artifact-unverified", reason: artifact.reason, detail: artifact.detail };
      }
      provider = loadProviderToken({ userDataPath: app.getPath("userData") });
      if (!provider.ok) return { ok: false, code: provider.reason };
    }

    return await tunnelService.start({
      profile: { id: profile.id, target: profile.target, executableDigest: artifact.sha256 },
      generation: profile.generation,
      executablePath: artifact.path,
      providerToken: provider.token,
      env: simulationEnabled ? {} : buildCliEnvironment(),
    });
  } catch (error) {
    return { ok: false, code: error.code || "invalid-input", error: error.message };
  }
});

ipcMain.handle("tunnel:stop", async (event, input) => {
  try {
    senderGuard.assertTrusted(event);
    validateEmpty(input);
    permits.invalidateAll();
    // "Retry Stop" after a manual close: attempt verified recovery first so a
    // stale marker can be cleared when the recorded process is gone.
    if (tunnelService.getStatus().state === "closure_unknown") {
      const recovery = await tunnelService.recoverOwnedProcess();
      if (!recovery.ok) {
        return { ok: false, confirmed: false, code: "recovery-required", hint: recovery.hint };
      }
    }
    return await tunnelService.stop();
  } catch (error) {
    return { ok: false, code: error.code || "invalid-input", error: error.message };
  }
});

ipcMain.handle("tunnel:status", async (event, input) => {
  try {
    senderGuard.assertTrusted(event);
    validateEmpty(input);
    return {
      ok: true,
      state: tunnelService.getStatus(),
      sharing: getSharingPolicy({ simulate: simulationEnabled }),
    };
  } catch (error) {
    return { ok: false, code: error.code || "invalid-input", error: error.message };
  }
});

// ─── Lifecycle ─────────────────────────────────────────────────

app.on("window-all-closed", async () => {
  permits?.invalidateAll();
  await tunnelService?.shutdown();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  permits?.invalidateAll();
  const finish = () => app.quit();
  const timeout = new Promise((resolve) => setTimeout(resolve, 13_000));
  Promise.race([tunnelService ? tunnelService.shutdown() : Promise.resolve(), timeout]).finally(finish);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
