#!/usr/bin/env node
/**
 * Real CLI smoke test: verify the pinned artifact, spawn it with a deliberately
 * invalid provider token against a closed loopback port, and prove the adapter
 * reports confirmed teardown without leaving a child behind.
 *
 * This never opens a public tunnel. It requires the locally acquired artifact in
 * electron/tunnel/bin/<platform-arch>/.
 */

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { verifyArtifact } = require('../electron/tunnel/cli-artifact.js');
const { createCliAdapter } = require('../electron/tunnel/cli-adapter.js');

const artifact = verifyArtifact({
  isPackaged: false,
  appPath: process.cwd(),
  manifestPath: path.join(process.cwd(), 'electron', 'tunnel', 'ngrok-artifact.json'),
});
if (!artifact.ok) {
  console.error('Artifact verification failed:', artifact);
  process.exit(1);
}
console.log(`verified ${artifact.version} ${artifact.sha256}`);

const adapter = createCliAdapter({ readinessMs: 12_000 });
try {
  await adapter.start({
    executablePath: artifact.path,
    target: '127.0.0.1:9',
    providerToken: 'invalid-smoke-token-not-a-secret',
    env: {},
  });
  console.error('Unexpected success: the smoke test must not open a tunnel.');
  process.exit(1);
} catch (error) {
  console.log(JSON.stringify({
    code: error.code,
    spawned: error.spawned,
    confirmedClosure: error.confirmedClosure,
    message: String(error.message).slice(0, 200),
  }, null, 2));
  if (error.spawned !== true || error.confirmedClosure !== true) {
    console.error('Real-process smoke did not prove confirmed closure.');
    process.exit(1);
  }
  console.log('PASS: real CLI spawned and was confirmed closed; no tunnel opened.');
}
