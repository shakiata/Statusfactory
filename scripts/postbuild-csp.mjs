#!/usr/bin/env node
/**
 * Injects a hash-based Content-Security-Policy into every static-export HTML
 * file after `next build`.
 *
 * Next's static export emits small inline bootstrap scripts. Rather than
 * allowing `unsafe-inline` or `unsafe-eval`, this script hashes the exact inline
 * script bodies and lists them in `script-src`. Remote executable sources stay
 * disabled (`'self'` plus those hashes).
 *
 * Residual allowances (documented in docs/security/IMPLEMENTATION_LOG.md):
 * - `style-src 'unsafe-inline'`: React inline style objects and Tailwind runtime
 *   style attributes; no remote stylesheets remain.
 * - `frame-ancestors` is omitted from the meta policy because browsers ignore it
 *   in a <meta> tag; a browser host must send it as a header. Electron does not
 *   embed the app in a frame.
 * - `connect-src http: https:`: the user selects an arbitrary FRM endpoint, so a
 *   narrow allowlist is impossible; origin binding and redirect rejection are
 *   enforced in the shared client instead.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'out');

/** Recursively lists files under a directory. */
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

/** Returns base64 SHA-256 hashes for inline script bodies. */
function inlineScriptHashes(html) {
  const hashes = new Set();
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const body = match[1];
    if (body.length === 0) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

/** Builds the policy string for one document. */
function buildPolicy(hashes) {
  const scriptSources = ["'self'", ...hashes].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    'connect-src http: https:',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

/** Injects or replaces the policy meta tag. */
function inject(html, policy) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const existing = /<meta http-equiv="Content-Security-Policy"[^>]*>/i;
  if (existing.test(html)) return html.replace(existing, meta);
  return html.replace(/<head>/i, `<head>${meta}`);
}

const files = (await walk(OUT_DIR)).filter((file) => file.endsWith('.html'));
if (files.length === 0) {
  console.error('CSP: no HTML files found in out/. Run next build first.');
  process.exit(1);
}

let totalHashes = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const hashes = inlineScriptHashes(html);
  totalHashes += hashes.length;
  await writeFile(file, inject(html, buildPolicy(hashes)), 'utf8');
}

console.log(`CSP injected into ${files.length} HTML file(s) with ${totalHashes} inline script hash(es).`);
