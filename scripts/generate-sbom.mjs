#!/usr/bin/env node
/**
 * Generates a CycloneDX SBOM for the locked dependency graph.
 * Writes dist/sbom.cdx.json. Read-only with respect to the project.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.cwd(), 'dist/sbom.cdx.json');
await mkdir(path.dirname(output), { recursive: true });
const json = execFileSync('npm', ['sbom', '--sbom-format=cyclonedx'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
// Validate that npm produced JSON before writing release evidence.
JSON.parse(json);
await writeFile(output, json);
console.log(`SBOM written to ${output}`);
