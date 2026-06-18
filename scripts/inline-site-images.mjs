#!/usr/bin/env node
// scripts/inline-site-images.mjs
//
// Base64-inline every <img src="images/..."> in the built partner site so that
// StatiCrypt's HTML encryption also covers the screenshots. StatiCrypt encrypts
// HTML only — linked asset files (images/, CSS) are otherwise served publicly on
// Pages, which would leak the product screenshots past the passphrase. Inlining
// folds the images into the (encrypted) HTML; afterwards the now-unreferenced
// images/ dir and internal-only files are removed from the build output.
//
// PNG → WebP (quality 80) when `sharp` is available (CI installs it); otherwise
// falls back to inlining the original bytes so the build never breaks locally.
//
// Usage: node scripts/inline-site-images.mjs [buildDir]   (default: _site)

import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';

const buildDir = process.argv[2] || '_site';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not installed — inlining original image bytes (larger, but correct).');
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

async function dataUri(imgPath) {
  const ext = extname(imgPath).toLowerCase();
  const raw = await readFile(imgPath);
  if (sharp && (ext === '.png' || ext === '.jpg' || ext === '.jpeg')) {
    try {
      const webp = await sharp(raw).webp({ quality: 80 }).toBuffer();
      return `data:image/webp;base64,${webp.toString('base64')}`;
    } catch {
      /* fall through to raw bytes */
    }
  }
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${raw.toString('base64')}`;
}

const htmlFiles = (await readdir(buildDir)).filter((f) => f.endsWith('.html'));
const cache = new Map(); // ref -> data URI, so a shared image is converted once
let inlined = 0;

for (const file of htmlFiles) {
  const path = join(buildDir, file);
  let html = await readFile(path, 'utf8');
  const refs = [...new Set([...html.matchAll(/src="(images\/[^"]+)"/g)].map((m) => m[1]))];
  for (const ref of refs) {
    if (!cache.has(ref)) cache.set(ref, await dataUri(join(buildDir, ref)));
    html = html.replaceAll(`src="${ref}"`, `src="${cache.get(ref)}"`);
    inlined++;
  }
  await writeFile(path, html);
}

// Remove assets that must not be served publicly: the inlined images, and the
// internal-only template/manifest/build docs.
await rm(join(buildDir, 'images'), { recursive: true, force: true });
for (const internal of ['_template.html', 'SHOTS.md', 'BUILD.md']) {
  await rm(join(buildDir, internal), { force: true });
}

console.log(
  `Inlined ${inlined} image reference(s) across ${htmlFiles.length} page(s); ` +
    `removed images/ + internal files from ${buildDir}.`,
);
