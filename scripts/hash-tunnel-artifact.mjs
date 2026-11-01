#!/usr/bin/env node
/**
 * Safely hash a candidate tunnel CLI artifact for owner review.
 *
 * This script does NOT install, execute, trust or copy the binary, and it does
 * not edit the manifest. It prints the size, SHA-256, detected executable magic
 * and a ready-to-paste manifest entry for one platform. The owner must still
 * confirm acquisition provenance before recording the digest.
 *
 * Usage:
 *   node scripts/hash-tunnel-artifact.mjs <path> <version> [platform-arch]
 * Example:
 *   node scripts/hash-tunnel-artifact.mjs ~/Downloads/ngrok 3.30.0 linux-x64
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [, , fileArg, versionArg, keyArg] = process.argv;
if (!fileArg || !versionArg) {
  console.error('Usage: node scripts/hash-tunnel-artifact.mjs <path> <version> [platform-arch]');
  process.exit(2);
}

const file = path.resolve(fileArg);
const info = await stat(file);
if (!info.isFile()) {
  console.error('Not a regular file.');
  process.exit(2);
}

const bytes = await readFile(file);
const digest = createHash('sha256').update(bytes).digest('hex');
const head = bytes.subarray(0, 4);
const isElf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46;
const isPE = head[0] === 0x4d && head[1] === 0x5a;
const isMachO = (head[0] === 0xcf && head[1] === 0xfa) || (head[0] === 0xfe && head[1] === 0xed);
const magic = isElf ? 'ELF' : isPE ? 'PE' : isMachO ? 'Mach-O' : 'unknown/text';

const key = keyArg || `${process.platform === 'win32' ? 'win32' : process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
const entry = {
  [key]: {
    version: versionArg,
    sha256: digest,
    bytes: info.size,
    executableMagic: magic,
    acquisition: '<record trusted source URL/copy path and access date>',
  },
};

console.log(JSON.stringify({
  file,
  bytes: info.size,
  sha256: digest,
  executableMagic: magic,
  manifestEntry: entry,
  warning: magic === 'unknown/text'
    ? 'This file does not look like a native executable. Do not record it as a tunnel CLI.'
    : 'Digest identifies bytes only; it does not prove publisher identity. Verify provenance independently.',
}, null, 2));
