#!/usr/bin/env node
// Controleert dat de app-iconen horen bij het goedgekeurde logo (issue #820), zonder Python.
// - de bron-PNG heeft de vastgelegde SHA-256 en is vierkant;
// - elk bestand uit docs/branding/icons.json bestaat, heeft het juiste formaat en is niet leeg;
// - de web-iconen die index.html en het manifest noemen, staan in die lijst.
// Opnieuw maken: `python3 scripts/generate-approved-icons.py` (Pillow).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PNG_MAGIC = '89504e470d0a1a0a';
const problems = [];
const fail = (msg) => problems.push(msg);

const pngSize = (buf) => (buf.subarray(0, 8).toString('hex') === PNG_MAGIC
  ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);

const apps = JSON.parse(readFileSync(join(ROOT, 'docs/branding/icons.json'), 'utf8'));
const listed = new Set();
for (const app of apps) {
  const source = readFileSync(join(ROOT, app.source));
  if (createHash('sha256').update(source).digest('hex') !== app.sha256) fail(`${app.source}: SHA-256 wijkt af van icons.json`);
  const dims = pngSize(source);
  if (!dims || dims[0] !== dims[1]) fail(`${app.source}: geen vierkante PNG`);
  for (const out of app.outputs) {
    listed.add(out.path);
    const file = join(ROOT, out.path);
    if (!existsSync(file)) { fail(`${out.path}: ontbreekt`); continue; }
    const buf = readFileSync(file);
    const ext = out.path.slice(out.path.lastIndexOf('.')).toLowerCase();
    if (ext === '.png') {
      const d = pngSize(buf);
      const [w, h] = out.size ?? [512, 512];
      if (!d) fail(`${out.path}: geen PNG`);
      else if (d[0] !== w || d[1] !== h) fail(`${out.path}: ${d[0]}x${d[1]} in plaats van ${w}x${h}`);
    } else if (ext === '.ico') {
      if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1 || buf.readUInt16LE(4) < 6) fail(`${out.path}: ICO mist maten`);
    } else if (ext === '.icns') {
      if (buf.subarray(0, 4).toString('latin1') !== 'icns') fail(`${out.path}: geen ICNS`);
    } else if (buf.length === 0) fail(`${out.path}: leeg`);
  }
}

const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/manifest.webmanifest'), 'utf8'));
const used = [
  ...[...index.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="\/([^"]+)"/g)].map((m) => m[1]),
  ...manifest.icons.map((i) => i.src),
].map((p) => `public/${p}`);
for (const p of used) if (!listed.has(p)) fail(`${p}: wordt gebruikt maar staat niet in docs/branding/icons.json`);
if (!/<link rel="manifest" href="\/manifest\.webmanifest"/.test(index)) fail('index.html verwijst niet naar manifest.webmanifest');

if (problems.length) {
  console.error('verify:icons ROOD\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`verify:icons groen: ${listed.size} bestanden, bron-hash klopt`);
