// @ts-check
// Versie-sync: trekt alle app-versie-bronnen gelijk vanuit één commando.
//
//   node scripts/bump-version.js 2026.7.0
//   npm run bump 2026.7.0
//
// Werkt deze versievelden bij (CalVer: jaar.maand.patch):
//   - package.json            top-level "version"
//   - src-tauri/tauri.conf.json  "version"
//   - package-lock.json       beide root "version"-velden (regels ~3 en ~9)
//
// RAAKT NIET: src-tauri/Cargo.toml (Rust-crate, blijft 0.1.0) en
//             .github/workflows/release.yml.
//
// Alleen Node-ingebouwde modules; behoudt JSON-opmaak (2 spaties + trailing
// newline) zodat de diff minimaal blijft.
//
// Dit bestand draait als ESM (package.json heeft "type": "module").

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const VERSION_RE = /^\d{4}\.\d+\.\d+$/;

function usage(message) {
  if (message) console.error(`Fout: ${message}\n`);
  console.error('Gebruik: node scripts/bump-version.js <X.Y.Z>');
  console.error('         npm run bump <X.Y.Z>');
  console.error('');
  console.error('  <X.Y.Z>  CalVer-versie jaar.maand.patch, bv. 2026.7.0');
  process.exit(1);
}

const newVersion = process.argv[2];

if (!newVersion) {
  usage('geen versie-argument opgegeven.');
}
if (!VERSION_RE.test(newVersion)) {
  usage(`"${newVersion}" is geen geldige CalVer-versie (verwacht jaar.maand.patch, bv. 2026.7.0).`);
}

/**
 * Vervangt een specifiek "version": "..."-veld in JSON-brontekst, zonder de
 * rest van de opmaak aan te tasten. Werkt op de ruwe tekst i.p.v. parse/stringify
 * om de exacte indentatie/whitespace te behouden.
 *
 * @param {string} relPath  pad t.o.v. repo-root
 * @param {object} opts
 * @param {number} [opts.expected]  verwacht aantal vervangingen (default 1)
 * @param {RegExp} [opts.matcher]   regex met 3 capture-groepen (pre, oude waarde,
 *                                  post) waarvan de middelste de versie is. Default
 *                                  matcht het eerste/elk "version"-veld in het bestand.
 */
function bumpJsonVersionField(relPath, opts = {}) {
  const expected = opts.expected ?? 1;
  const absPath = join(repoRoot, relPath);
  const original = readFileSync(absPath, 'utf8');

  // Matcht  "version": "1.2.3"  met behoud van omliggende whitespace.
  const fieldRe = opts.matcher ?? /("version"\s*:\s*")([^"]*)(")/g;

  const oldValues = [];
  const updated = original.replace(fieldRe, (match, pre, oldVal, post) => {
    oldValues.push(oldVal);
    return `${pre}${newVersion}${post}`;
  });

  if (oldValues.length !== expected) {
    console.error(
      `Fout: ${relPath} — verwachtte ${expected} "version"-veld(en), vond er ${oldValues.length}.`
    );
    process.exit(1);
  }

  const oldDisplay = [...new Set(oldValues)].join(', ');
  if (updated !== original) {
    writeFileSync(absPath, updated);
  }
  console.log(`  ${relPath.padEnd(28)} ${oldDisplay} -> ${newVersion}`);
}

console.log(`Versie gelijktrekken naar ${newVersion}:`);
bumpJsonVersionField('package.json', { expected: 1 });
bumpJsonVersionField('src-tauri/tauri.conf.json', { expected: 1 });

// package-lock.json bevat een "version"-veld voor ELKE dependency; de twee root-
// versies (regels ~3 en ~9) zijn de enige die direct vooraf worden gegaan door
// het eigen pakketnaam-veld. Anker daarop zodat we de transitieve dep-versies
// met rust laten.
bumpJsonVersionField('package-lock.json', {
  expected: 2,
  matcher: /("name"\s*:\s*"open-planner-studio",\s*\n\s*"version"\s*:\s*")([^"]*)(")/g,
});
console.log('Klaar.');
