#!/usr/bin/env node
/**
 * Queries the OSV batch API for every locked package/version and writes a dated
 * evidence file. This is a read-only scanner run; it never installs or fixes.
 *
 * Usage: node scripts/osv-scan.mjs [output.json]
 * Network: POST https://api.osv.dev/v1/querybatch (dependency metadata only).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const lockPath = path.resolve(process.cwd(), 'package-lock.json');
const output = path.resolve(process.argv[2] || 'docs/security/evidence/osv-scan.json');
const lock = JSON.parse(await readFile(lockPath, 'utf8'));

/** Collects unique name@version pairs from lockfile v2/v3 `packages`. */
function collect(lockfile) {
  const pairs = new Map();
  for (const [key, entry] of Object.entries(lockfile.packages || {})) {
    if (!key || !entry || entry.link) continue;
    if (!entry.name && !entry.version) continue;
    const name = entry.name || key.split('node_modules/').pop();
    if (!name || !entry.version) continue;
    pairs.set(`${name}@${entry.version}`, { name, version: entry.version });
  }
  return [...pairs.values()];
}

const packages = collect(lock);
const queries = packages.map((pkg) => ({ package: { ecosystem: 'npm', name: pkg.name }, version: pkg.version }));

const response = await fetch('https://api.osv.dev/v1/querybatch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ queries }),
});
if (!response.ok) {
  console.error(`OSV query failed: ${response.status}`);
  process.exit(1);
}
const body = await response.json();
const results = body.results || [];
const findings = [];
results.forEach((result, index) => {
  for (const vuln of result.vulns || []) {
    findings.push({
      package: queries[index].package.name,
      version: queries[index].version,
      id: vuln.id,
      aliases: vuln.aliases || [],
      modified: vuln.modified || null,
      summary: vuln.summary || null,
    });
  }
});

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  scanner: 'osv.dev querybatch',
  endpoint: 'https://api.osv.dev/v1/querybatch',
  retrievedAt: new Date().toISOString(),
  lockfileSha256: (await import('node:crypto')).createHash('sha256').update(await readFile(lockPath)).digest('hex'),
  queried: queries.length,
  advisoryRecords: findings.length,
  uniqueAdvisories: [...new Set(findings.map((finding) => finding.id))].sort(),
  findings,
}, null, 2));

console.log(`OSV: ${queries.length} packages queried, ${findings.length} advisory records, ${new Set(findings.map((f) => f.id)).size} unique IDs.`);
console.log(`Evidence: ${output}`);
