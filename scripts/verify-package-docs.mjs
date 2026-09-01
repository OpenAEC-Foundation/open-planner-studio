#!/usr/bin/env node
// Verifieert de door Tauri in de Linux-binary ingesloten Help-assets. Tauri bundelt `frontendDist`
// in de executable; daarom zijn docs niet als losse bestanden zichtbaar in de deb/Snap-bestandslijst.
// Deze poort leest de echte executable bytes en zoekt elke bronasset als Tauri asset-pad op.
//
//   node scripts/verify-package-docs.mjs --binary /pad/naar/open-planner-studio
//   node scripts/verify-package-docs.mjs --snap /pad/naar/open-planner-studio.snap
//
// `--docs-root` is alleen voor forensische controle van een historisch package tegen zijn exacte
// bronboom; de CI gebruikt altijd de huidige `public/docs` uit dezelfde checkout.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

function usage(message) {
  if (message) console.error(`Fout: ${message}`);
  console.error('Gebruik: node scripts/verify-package-docs.mjs (--binary <pad> | --snap <pad>) [--docs-root <public/docs>]');
  process.exit(2);
}

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const binaryArg = valueOf('--binary');
const snapArg = valueOf('--snap');
const docsRoot = resolve(valueOf('--docs-root') ?? 'public/docs');
if ((binaryArg ? 1 : 0) + (snapArg ? 1 : 0) !== 1) usage('geef precies één van --binary of --snap op');
if (!existsSync(docsRoot)) usage(`docs-map bestaat niet: ${docsRoot}`);

function packageBinary() {
  if (binaryArg) {
    const path = resolve(binaryArg);
    if (!existsSync(path)) usage(`binary bestaat niet: ${path}`);
    return readFileSync(path);
  }

  const snap = resolve(snapArg);
  if (!existsSync(snap)) usage(`Snap bestaat niet: ${snap}`);
  const extracted = spawnSync('unsquashfs', ['-cat', snap, 'usr/bin/open-planner-studio'], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (extracted.error) usage(`unsquashfs kon niet starten: ${extracted.error.message}`);
  if (extracted.status !== 0) usage(`unsquashfs kon de executable niet lezen (exit ${extracted.status}): ${String(extracted.stderr)}`);
  return extracted.stdout;
}

const manifestPath = resolve(docsRoot, 'manifest.json');
if (!existsSync(manifestPath)) usage(`manifest ontbreekt: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.articles)) usage(`manifest bevat geen articles-array: ${manifestPath}`);

const localeDirs = Object.keys(manifest.articles[0]?.title ?? {}).sort();
if (localeDirs.length === 0) usage('manifest bevat geen taalset in article-titels');
const expected = ['/docs/manifest.json'];
const perLocale = new Map();
for (const locale of localeDirs) {
  const folder = resolve(docsRoot, locale);
  if (!existsSync(folder)) usage(`docs-map voor ${locale} ontbreekt: ${folder}`);
  const paths = manifest.articles
    .map(article => `${locale}/${article.id}.md`)
    .filter(relative => existsSync(resolve(docsRoot, relative)));
  if (paths.length === 0) usage(`docs-map voor ${locale} bevat geen manifest-artikelen`);
  perLocale.set(locale, paths);
  expected.push(...paths.map(relative => `/docs/${relative}`));
}

const binary = packageBinary();
const missing = expected.filter(asset => !binary.includes(Buffer.from(asset)));
console.log(`Controleer ${expected.length} Help-assets in ${snapArg ? `Snap ${resolve(snapArg)}` : `binary ${resolve(binaryArg)}`}`);
for (const [locale, paths] of perLocale) {
  const embedded = paths.filter(relative => binary.includes(Buffer.from(`/docs/${relative}`))).length;
  console.log(`  ${embedded === paths.length ? 'OK' : 'XX'} ${locale}: ${embedded}/${paths.length} artikelen ingesloten`);
}
console.log(`  ${binary.includes(Buffer.from('/docs/manifest.json')) ? 'OK' : 'XX'} manifest.json`);

if (missing.length > 0) {
  console.error(`\nXX ${missing.length} Help-assets ontbreken in het package:`);
  for (const asset of missing) console.error(`   - ${asset}`);
  process.exit(1);
}
console.log(`\nAlles groen: ${expected.length} Help-assets zijn in het package ingesloten.`);
