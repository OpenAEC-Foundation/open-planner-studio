#!/usr/bin/env node
// Poort: tekstgroottes in de interface lopen uitsluitend via de tekstrollen.
//
// Waarom dit bestaat. De app kende negen losse pixelmaten, verspreid over ~70 bestanden en in drie
// schrijfwijzen door elkaar: `calc(Npx * var(--ui-font-scale, 1))`, Tailwinds `text-[Npx]` en een
// kale `font-size: Npx`. Alleen de eerste volgde de tekengrootte-instelling (`ui.uiFontScale`); de
// andere twee negeerden hem stil, en niets hield iemand tegen om er morgen weer één bij te typen
// (PR #151 repareerde het symptoom, dit is de oorzaak). De rollen staan op één plek — het
// `@theme`-blok in `src/styles/globals.css`:
//
//   caption 9 · small 10 · body 11 · large 12 · heading 14 · title 20   (px × --ui-font-scale)
//
// Toegestaan: `text-<rol>` (eventueel `!`/variant ervoor) in klassen, `font-size: var(--text-<rol>)`
// in CSS, en relatieve waarden (`em`, `%`, `inherit`, …) — die erven van een rol en schalen dus
// vanzelf mee. Afgekeurd: elke absolute maat (px/rem/pt, ook binnen calc), `text-[…px]`, Tailwinds
// eigen schaal (`text-xs` … — bestaat door `--text-*: initial` niet eens meer, de klasse zou stil
// niets doen) en een inline `fontSize` met een absolute maat.
//
// Buiten bereik: `src/engine/` en `src/services/` (Canvas-, PDF- en printtekst rekent in eigen
// eenheden en krijgt de schaal als getal mee) en SVG-`fontSize={n}` (viewBox-eenheden, geen CSS-px).
// Een bewuste uitzondering krijgt op dezelfde regel de markering `text-roles: <reden>`.
//
//   node scripts/verify-text-roles.mjs     # exit 0 = schoon, 1 = minstens één overtreding
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(root, 'src');

const ROLES = ['caption', 'small', 'body', 'large', 'heading', 'title'];
const OUT_OF_SCOPE = ['engine', 'services'].map(d => join(srcDir, d) + sep);
const ESCAPE = /text-roles:\s*\S/;

// Absolute lengte-eenheden; `em`/`%` zijn relatief en dus toegestaan. `rem` telt als absoluut: het
// schaalt wel mee, maar is een maat buiten de rollen om.
const ABSOLUTE_UNIT = /\d(?:px|rem|pt|pc|cm|mm|in|q)\b/i;

/** @type {{ name: string, test: (line: string, isCss: boolean) => boolean }[]} */
const RULES = [
  {
    name: 'absolute font-size in CSS — gebruik var(--text-<rol>)',
    test: (line, isCss) => {
      if (!isCss) return false;
      const m = /(?:^|[;{\s])font-size\s*:\s*([^;}]+)/i.exec(line);
      return m !== null && ABSOLUTE_UNIT.test(m[1]);
    },
  },
  {
    name: 'font-shorthand met absolute maat in CSS — zet font-size apart via var(--text-<rol>)',
    test: (line, isCss) => {
      if (!isCss) return false;
      const m = /(?:^|[;{\s])font\s*:\s*([^;}]+)/i.exec(line);
      return m !== null && ABSOLUTE_UNIT.test(m[1]);
    },
  },
  {
    name: 'Tailwind arbitrary text-[…] met absolute maat — gebruik text-<rol>',
    test: line => /\btext-\[[^\]]*\d(?:px|rem|pt)[^\]]*\]/.test(line),
  },
  {
    name: 'Tailwind-standaardmaat (text-xs/sm/base/lg/…) — bestaat niet meer, gebruik text-<rol>',
    test: (line, isCss) => !isCss && /(?:^|[\s"'`:!])text-(?:xs|sm|base|lg|[2-9]?xl)(?![\w-])/.test(line),
  },
  {
    name: 'ops-text-N — vervangen door text-<rol>',
    test: line => /\bops-text-\d/.test(line),
  },
  {
    name: 'inline fontSize met absolute maat — gebruik className text-<rol>',
    test: (line, isCss) => {
      if (isCss) return false;
      const m = /\bfontSize\s*:\s*(['"`])([^'"`]*)\1/.exec(line);
      return m !== null && ABSOLUTE_UNIT.test(m[2]);
    },
  },
  {
    name: 'inline fontSize als kaal getal in een style-object — gebruik className text-<rol>',
    // `fontSize: 12` in een style-object is 12px. SVG-attributen (`fontSize={9}`) en
    // objectvelden met een type (`fontSize: number`) vallen hier bewust buiten.
    test: (line, isCss) => !isCss && /\bfontSize\s*:\s*\d+(?:\.\d+)?\s*[,}]/.test(line),
  },
];

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(srcDir)) {
  if (OUT_OF_SCOPE.some(prefix => file.startsWith(prefix))) continue;
  const isCss = file.endsWith('.css');
  let inBlockComment = false;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    // Commentaar telt niet mee: daar mág uitgelegd worden wat vroeger fout ging.
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end < 0) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const escaped = ESCAPE.test(raw);
    line = line.replace(/\/\*.*?\*\//g, '');
    const open = line.indexOf('/*');
    if (open >= 0) { line = line.slice(0, open); inBlockComment = true; }
    if (!isCss) line = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (escaped || line.trim() === '') return;
    for (const rule of RULES) {
      if (rule.test(line, isCss)) {
        violations.push(`${relative(root, file)}:${i + 1}  ${rule.name}\n      ${raw.trim().slice(0, 140)}`);
      }
    }
  });
}

// De rollen zelf moeten bestaan — anders keurt deze poort alles goed wat naar een lege variabele wijst.
const globals = readFileSync(join(srcDir, 'styles', 'globals.css'), 'utf8');
for (const role of ROLES) {
  if (!new RegExp(`--text-${role}\\s*:`).test(globals)) {
    violations.push(`src/styles/globals.css  tekstrol --text-${role} ontbreekt in het @theme-blok`);
  }
}
if (!/--text-\*\s*:\s*initial/.test(globals)) {
  violations.push('src/styles/globals.css  `--text-*: initial` ontbreekt — Tailwinds eigen schaal lekt dan weer naar binnen');
}

// Omgekeerd: een `var(--text-<iets>)` dat géén rol is, levert stil een lege font-size op.
const roleSet = new Set(ROLES);
for (const file of walk(srcDir)) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    for (const m of raw.matchAll(/var\(--text-([a-z]+)\)/g)) {
      if (!roleSet.has(m[1])) violations.push(`${relative(root, file)}:${i + 1}  onbekende tekstrol var(--text-${m[1]})`);
    }
  });
}

if (violations.length > 0) {
  console.error(`verify:text-roles — ${violations.length} overtreding(en):\n`);
  for (const v of violations) console.error(`  XX ${v}`);
  console.error(`\nRollen: ${ROLES.map(r => `text-${r}`).join(', ')} — zie het @theme-blok in src/styles/globals.css.`);
  process.exit(1);
}
console.log(`verify:text-roles — schoon (${ROLES.length} rollen, geen losse tekstmaten in src/).`);
