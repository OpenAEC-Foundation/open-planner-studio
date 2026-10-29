#!/usr/bin/env node
// @ts-check
// Vult packaging/aur/PKGBUILD in voor één stabiele release (aangeroepen door .github/workflows/aur.yml).
//
//   node scripts/aur/render-pkgbuild.mjs --template <PKGBUILD> --version <X.Y.Z> --sha256 <hex> --out <pad>
//   node scripts/aur/render-pkgbuild.mjs --compare-srcinfo <.SRCINFO in de AUR> --srcinfo <nieuwe .SRCINFO>
//
// Invullen: `pkgver`, `pkgrel` en `sha256sums_x86_64`. pkgrel blijft die uit het sjabloon als de
// versie gelijk is aan de pkgver in het sjabloon (een pakketwijziging bij dezelfde release), en wordt
// anders 1. Voor een pakketreparatie: zet het sjabloon eerst op de release-pkgver en verhoog
// daarna pkgrel. Alleen pkgrel verhogen bij een oudere sjabloonversie heeft dus geen effect.
// De workflow controleert dat de release gepubliceerd is en geen prerelease is.
//
// Vergelijken: drukt `push`, `same` of `older` af. `older` = de AUR heeft al een hogere
// pkgver/pkgrel (nooit terugzetten); `same` = zelfde pkgver-pkgrel (de aanroeper kijkt of de inhoud
// gelijk is).

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * @param {string} template
 * @param {{ version: string, sha256: string }} o
 */
export function renderPkgbuild(template, { version, sha256 }) {
  const m = VERSION_RE.exec(version);
  if (!m) throw new Error(`Geen stabiele versie X.Y.Z: ${JSON.stringify(version)}`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Geen sha256: ${JSON.stringify(sha256)}`);

  /** @param {RegExp} re */
  const one = (re) => {
    const hits = template.match(new RegExp(re.source, 'gm')) ?? [];
    if (hits.length !== 1) throw new Error(`Sjabloon: verwacht precies één regel ${re}, gevonden ${hits.length}`);
    return hits[0];
  };
  const verLine = one(/^pkgver=.*$/);
  const relLine = one(/^pkgrel=.*$/);
  one(/^sha256sums_x86_64=\('[0-9a-f]{64}'\)$/);

  const templateVersion = verLine.slice('pkgver='.length);
  const templateRel = relLine.slice('pkgrel='.length);
  if (!/^[1-9]\d*$/.test(templateRel)) throw new Error(`Sjabloon: pkgrel is geen positief geheel getal: ${templateRel}`);
  const pkgrel = templateVersion === version ? templateRel : '1';

  return template
    .replace(/^pkgver=.*$/m, `pkgver=${version}`)
    .replace(/^pkgrel=.*$/m, `pkgrel=${pkgrel}`)
    .replace(/^sha256sums_x86_64=\('[0-9a-f]{64}'\)$/m, `sha256sums_x86_64=('${sha256}')`);
}

/** @param {string} srcinfo @returns {{ pkgver: string, pkgrel: number }} */
export function srcinfoVersion(srcinfo) {
  const ver = /^\tpkgver = (.+)$/m.exec(srcinfo)?.[1];
  const rel = /^\tpkgrel = (.+)$/m.exec(srcinfo)?.[1];
  if (!ver || !VERSION_RE.test(ver)) throw new Error(`.SRCINFO: geen leesbare pkgver (${ver})`);
  if (!rel || !/^[1-9]\d*$/.test(rel)) throw new Error(`.SRCINFO: geen leesbare pkgrel (${rel})`);
  return { pkgver: ver, pkgrel: Number(rel) };
}

/**
 * @param {string} existing  .SRCINFO in de AUR-git
 * @param {string} next      nieuwe .SRCINFO
 * @returns {'push' | 'same' | 'older'}
 */
export function comparePackages(existing, next) {
  const a = srcinfoVersion(existing);
  const b = srcinfoVersion(next);
  const pa = a.pkgver.split('.').map(Number);
  const pb = b.pkgver.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pb[i] > pa[i]) return 'push';
    if (pb[i] < pa[i]) return 'older';
  }
  if (b.pkgrel > a.pkgrel) return 'push';
  if (b.pkgrel < a.pkgrel) return 'older';
  return 'same';
}

function main() {
  const { values } = parseArgs({
    options: {
      template: { type: 'string' },
      version: { type: 'string' },
      sha256: { type: 'string' },
      out: { type: 'string' },
      'compare-srcinfo': { type: 'string' },
      srcinfo: { type: 'string' },
    },
    strict: true,
  });
  if (values['compare-srcinfo']) {
    if (!values.srcinfo) throw new Error('--srcinfo ontbreekt');
    console.log(comparePackages(readFileSync(values['compare-srcinfo'], 'utf8'), readFileSync(values.srcinfo, 'utf8')));
    return;
  }
  const { template, version, sha256, out } = values;
  if (!template || !version || !sha256 || !out) throw new Error('Gebruik: --template --version --sha256 --out');
  writeFileSync(out, renderPkgbuild(readFileSync(template, 'utf8'), { version, sha256 }));
  console.log(`${out}: pkgver=${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
