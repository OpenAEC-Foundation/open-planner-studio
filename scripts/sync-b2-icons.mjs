#!/usr/bin/env node
// Kopieert de B2-iconen die de app gebruikt uit een checkout van de OpenAEC Style Repo naar
// `public/icons/b2/{16,24}/` en schrijft `public/icons/b2/manifest.json` (herkomst, revisie,
// hashes). De lijst van gebruikte iconen is `src/components/common/b2IconNames.ts`: voeg daar een
// id toe en draai dit script opnieuw. Iconen die niet meer in die lijst staan worden verwijderd.
//
//   node scripts/sync-b2-icons.mjs --source ../OpenAEC-Style-Repo
//
// Bron: https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo, `design/icon-set-b2/svg/<maat>/<id>.svg`.
// De masters worden bytegelijk overgenomen (geen afronding, geen optimalisatie); zie docs/b2-iconen.md.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
if (sourceIndex < 0 || !args[sourceIndex + 1]) {
  console.error('Gebruik: node scripts/sync-b2-icons.mjs --source <pad naar OpenAEC-Style-Repo>');
  process.exit(2);
}
const source = resolve(args[sourceIndex + 1]);
const svgRoot = join(source, 'design', 'icon-set-b2', 'svg');
if (!existsSync(svgRoot)) {
  console.error(`Geen B2-masters gevonden in ${svgRoot}`);
  process.exit(2);
}

const namesFile = join(root, 'src', 'components', 'common', 'b2IconNames.ts');
const names = [...readFileSync(namesFile, 'utf8').matchAll(/^\s*'([a-z0-9.-]+)',?\s*$/gm)].map((m) => m[1]).sort();
if (names.length === 0) {
  console.error(`Geen icoon-id's gevonden in ${namesFile}`);
  process.exit(2);
}

function git(cwd, ...argv) {
  try { return execFileSync('git', argv, { cwd, encoding: 'utf8' }).trim(); } catch { return null; }
}
const sourceCommit = git(source, 'rev-parse', 'HEAD');
const sourceDirty = git(source, 'status', '--porcelain', '--', 'design/icon-set-b2/svg');
const revisionMatch = /B2 revision (\d+)/.exec(readFileSync(join(source, 'crates', 'openaec-icons', 'src', 'generated.rs'), 'utf8'));
const revision = revisionMatch ? Number(revisionMatch[1]) : null;

const target = join(root, 'public', 'icons', 'b2');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const icons = [];
for (const size of [16, 24]) {
  const dir = join(target, String(size));
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.svg') && !names.includes(file.slice(0, -4))) rmSync(join(dir, file));
  }
}
for (const name of names) {
  const entry = { id: name, files: {} };
  for (const size of [16, 24]) {
    const from = join(svgRoot, String(size), `${name}.svg`);
    if (!existsSync(from)) {
      console.error(`Master ontbreekt: ${from}`);
      process.exit(1);
    }
    const bytes = readFileSync(from);
    writeFileSync(join(target, String(size), `${name}.svg`), bytes);
    entry.files[size] = { path: `${size}/${name}.svg`, bytes: bytes.length, sha256: sha256(bytes) };
  }
  icons.push(entry);
}
const manifest = {
  family: 'OpenAEC B2',
  revision,
  source: {
    repository: 'https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo',
    path: 'design/icon-set-b2/svg/{16,24}/<id>.svg',
    commit: sourceCommit,
    working_tree_clean: sourceDirty === '',
  },
  colors: { primary: 'currentColor', accent: 'var(--icon-accent, currentColor)' },
  icon_count: icons.length,
  icons,
};
writeFileSync(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${icons.length} B2-iconen (revisie ${revision ?? '?'}, commit ${sourceCommit ?? '?'}) naar ${target}`);
