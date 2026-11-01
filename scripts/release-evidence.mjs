#!/usr/bin/env node
/**
 * Collects release-candidate evidence: source identity, exact tool versions,
 * artifact hashes, SBOM/native inventory and residual status.
 *
 * Writes docs/security/release/RELEASE_EVIDENCE.json and NATIVE_INVENTORY.json.
 * It does not publish, sign or upload anything.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const releaseDir = path.join(cwd, 'docs', 'security', 'release');
await mkdir(releaseDir, { recursive: true });

/** SHA-256 of a file. */
async function digest(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

/** Returns {path, bytes, sha256} or null when the file is absent. */
async function fileRecord(file) {
  try {
    const info = await stat(file);
    return { path: path.relative(cwd, file), bytes: info.size, sha256: await digest(file) };
  } catch {
    return null;
  }
}

/** Runs a command and returns trimmed stdout, or null on failure. */
function capture(command, args, env = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', env: { ...process.env, ...env } }).trim();
  } catch {
    return null;
  }
}

const pkg = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
const electronBinary = path.join(cwd, 'node_modules', 'electron', 'dist', 'electron');
const runtime = capture(electronBinary, ['-e', 'console.log(JSON.stringify(process.versions))'], {
  ELECTRON_RUN_AS_NODE: '1',
});

const appImage = path.join(cwd, 'dist', `Statusfactory-${pkg.version}.AppImage`);
const artifacts = {
  appImage: await fileRecord(appImage),
  appAsar: await fileRecord(path.join(cwd, 'dist', 'linux-unpacked', 'resources', 'app.asar')),
  sbom: await fileRecord(path.join(cwd, 'dist', 'sbom.cdx.json')),
  lockfile: await fileRecord(path.join(cwd, 'package-lock.json')),
  packageJson: await fileRecord(path.join(cwd, 'package.json')),
};

let tunnelResources = [];
try {
  tunnelResources = await readdir(path.join(cwd, 'dist', 'linux-unpacked', 'resources', 'tunnel'));
} catch {
  tunnelResources = [];
}

const lock = JSON.parse(await readFile(path.join(cwd, 'package-lock.json'), 'utf8'));
const nativeInventory = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: { head: capture('git', ['rev-parse', 'HEAD']), branch: capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) },
  build: { node: process.version, npm: capture('npm', ['--version']), platform: process.platform, arch: process.arch },
  electron: {
    declared: pkg.devDependencies.electron,
    resolved: lock.packages?.['node_modules/electron']?.version ?? null,
    runtime: runtime ? JSON.parse(runtime) : null,
  },
  tunnelCli: JSON.parse(await readFile(path.join(cwd, 'electron', 'tunnel', 'ngrok-artifact.json'), 'utf8')),
  packagedResources: tunnelResources,
  artifacts,
};

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  registerRevision: JSON.parse(await readFile(path.join(cwd, 'docs', 'security', 'data', 'security_plan.json'), 'utf8')).revision,
  source: {
    head: capture('git', ['rev-parse', 'HEAD']),
    branch: capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    // Release evidence files are generated after the candidate commit; excluding
    // them keeps `dirty` meaningful for the source/artifact pair.
    dirty: capture('git', ['status', '--porcelain', '--', '.', ':(exclude)docs/security/release']) || '',
  },
  build: { node: process.version, npm: capture('npm', ['--version']), os: capture('uname', ['-srmo']) },
  artifacts,
  notes: [
    'Linux AppImage built and hashed locally. Windows was not built or executed on this host.',
    'The Electron runtime version was read with ELECTRON_RUN_AS_NODE; a sandboxed GUI launch is blocked on this host because chrome-sandbox is not root-owned mode 4755.',
    'The tunnel CLI artifact is not bundled; the manifest records owner-input-required and sharing fails closed.',
    'Artifacts are unsigned; a checksum identifies bytes but not publisher identity.',
    'A dev-only tunnel simulation and loopback FRM fixture exist; they do not verify ACT-002, a real provider tunnel, Windows execution or sandboxed runtime.',
  ],
};

await writeFile(path.join(releaseDir, 'RELEASE_EVIDENCE.json'), JSON.stringify(evidence, null, 2));
await writeFile(path.join(releaseDir, 'NATIVE_INVENTORY.json'), JSON.stringify(nativeInventory, null, 2));
if (artifacts.sbom) {
  await cp(path.join(cwd, 'dist', 'sbom.cdx.json'), path.join(releaseDir, 'sbom.cdx.json'));
}

console.log(JSON.stringify({ version: pkg.version, appImage: artifacts.appImage, runtime: nativeInventory.electron.runtime }, null, 2));
