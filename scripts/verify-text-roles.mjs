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
// schaalt wel mee, maar is een maat buiten de rollen om. De `}` vangt een template-literal
// (`${n}px`), waar geen cijfer vóór de eenheid staat.
const ABSOLUTE_UNIT = /(?:\d|\})\s*(?:px|rem|pt|pc|cm|mm|in|q)\b/i;

// CSS werkt met een WITTE lijst: alleen een rol, een relatieve maat of een overervingswoord. Een
// zwarte lijst ("geen px") liet `var(--eigen-maat)`, `clamp()` en alles wat nog bedacht wordt door.
const CSS_FONT_SIZE_OK = new RegExp(
  '^(?:var\\(--text-(?:' + ROLES.join('|') + ')\\)|[\\d.]+(?:em|%)|inherit|initial|unset|revert|smaller|larger)(?:\\s*!important)?$',
);

/**
 * Haalt commentaar weg met een scanner die strings respecteert, en behoudt elke newline zodat
 * regelnummers kloppen. Regel-voor-regel strippen kan dit niet: één `/*` binnen een CSS-string
 * (`content: "/*"`) zette de rest van het bestand uit, en `//` in een URL at de regel op.
 * @param {string} text @param {boolean} isCss
 */
function stripComments(text, isCss) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (!isCss && c === '/' && next === '/' && text[i - 1] !== ':') {
      // `://` is een URL in JSX-tekst, geen commentaar — anders at hij de rest van de regel op.
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (c === '"' || c === "'" || (!isCss && c === '`')) {
      // Stringinhoud blijft staan: klassen en inline-maten ZITTEN in strings. Een gewone string
      // eindigt uiterlijk op de regel (een apostrof in JSX-tekst mag niet de rest opslokken).
      let j = i + 1;
      while (j < n && text[j] !== c) {
        if (text[j] === '\\') j++;
        else if (text[j] === '\n' && c !== '`') break;
        j++;
      }
      out += text.slice(i, Math.min(j + 1, n));
      i = Math.min(j + 1, n);
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Regels die op de regel zelf per regex worden gekeurd (na het strippen van commentaar). */
/** @type {{ name: string, css: boolean, code: boolean, test: (line: string) => boolean }[]} */
const LINE_RULES = [
  {
    name: 'font-shorthand in CSS — zet font-size apart via var(--text-<rol>)',
    css: true, code: false,
    // `font: inherit` (form controls) erft de rol van de ouder en is dus juist goed.
    test: line => {
      const m = /(?:^|[;{\s])font\s*:\s*([^;}]*)/i.exec(line);
      return m !== null && !/^(?:inherit|initial|unset|revert)(?:\s*!important)?$/.test(m[1].trim());
    },
  },
  {
    name: '@apply met een tekstmaat die geen rol is',
    css: true, code: false,
    test: line => /@apply\b/.test(line) && /(?:^|[\s:!])text-(?:xs|sm|base|lg|[2-9]?xl|\[[^\]]*\])(?![\w-])/.test(line),
  },
  {
    name: 'Tailwind arbitrary text-[…] met absolute maat — gebruik text-<rol>',
    css: false, code: true,
    test: line => /\btext-\[[^\]]*(?:\d|\})(?:px|rem|pt)[^\]]*\]/.test(line),
  },
  {
    name: 'Tailwind-standaardmaat (text-xs/sm/base/lg/…) — bestaat niet meer, gebruik text-<rol>',
    css: false, code: true,
    test: line => /(?:^|[\s"'`:!])text-(?:xs|sm|base|lg|[2-9]?xl)(?![\w-])/.test(line),
  },
  {
    name: 'ops-text-N — vervangen door text-<rol>',
    css: true, code: true,
    test: line => /\bops-text-\d/.test(line),
  },
  {
    name: 'fontSize met absolute maat (style-object of el.style.fontSize) — gebruik className text-<rol>',
    css: false, code: true,
    test: line => {
      const m = /\bfontSize\s*[:=]\s*(['"`])((?:(?!\1).)*)\1/.exec(line);
      return m !== null && ABSOLUTE_UNIT.test(m[2]);
    },
  },
  {
    name: 'fontSize samengesteld met een eenheid (n + \'px\') — gebruik className text-<rol>',
    css: false, code: true,
    test: line => /\bfontSize\s*[:=][^,;}]*\+\s*['"`](?:px|rem|pt)\b/.test(line),
  },
  {
    name: 'font-size via setProperty/cssText/inline font-shorthand — gebruik className text-<rol>',
    css: false, code: true,
    test: line =>
      /setProperty\(\s*['"`]font(?:-size)?['"`]/.test(line)
      || (/\bcssText\b/.test(line) && /font(?:-size)?\s*:/.test(line))
      || (() => { const m = /\bfont\s*:\s*(['"`])((?:(?!\1).)*)\1/.exec(line); return m !== null && ABSOLUTE_UNIT.test(m[2]); })(),
  },
  {
    name: 'Tailwind text-[length:…] — een maat buiten de rollen om, gebruik text-<rol>',
    css: false, code: true,
    test: line => /\btext-\[length:/.test(line),
  },
  {
    name: 'fontSize als kaal getal in een style-object — gebruik className text-<rol>',
    // `fontSize: 12` in een style-object is 12px. SVG-attributen (`fontSize={9}`, viewBox-eenheden) en
    // getypeerde velden (`fontSize: number`) vallen hier bewust buiten.
    css: false, code: true,
    test: line => /\bfontSize\s*:\s*\d+(?:\.\d+)?\s*[,}]/.test(line),
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
let filesChecked = 0;
let declarationsChecked = 0;
for (const file of walk(srcDir)) {
  if (OUT_OF_SCOPE.some(prefix => file.startsWith(prefix))) continue;
  filesChecked++;
  const isCss = file.endsWith('.css');
  const rawText = readFileSync(file, 'utf8');
  const rawLines = rawText.split(/\r?\n/);
  const text = stripComments(rawText, isCss);
  const lines = text.split(/\r?\n/);
  // De markering telt alleen IN COMMENTAAR: wel in de rauwe regel, niet in de gestripte (waar
  // strings blijven staan) — een string `"text-roles: …"` mag geen overtreding maskeren.
  const escaped = i => ESCAPE.test(rawLines[i] ?? '') && !ESCAPE.test(lines[i] ?? '');
  const report = (i, name) => {
    if (escaped(i)) return;
    violations.push(`${relative(root, file)}:${i + 1}  ${name}\n      ${(rawLines[i] ?? '').trim().slice(0, 140)}`);
  };

  if (isCss) {
    // Declaraties over het hele bestand, zodat `font-size:` met de waarde op de vólgende regel meetelt.
    for (const m of text.matchAll(/(?<![\w-])font-size\s*:\s*([^;}]*)/gi)) {
      declarationsChecked++;
      const value = m[1].trim().replace(/\s+/g, ' ');
      if (CSS_FONT_SIZE_OK.test(value)) continue;
      const lineNo = text.slice(0, m.index).split('\n').length - 1;
      report(lineNo, `font-size: ${value} — alleen var(--text-<rol>), em/% of inherit`);
    }
  }
  lines.forEach((line, i) => {
    if (line.trim() === '') return;
    for (const rule of LINE_RULES) {
      if ((isCss ? rule.css : rule.code) && rule.test(line)) report(i, rule.name);
    }
  });
}
// Een poort die niets gekeurd heeft mag niet groen melden.
if (filesChecked < 50 || declarationsChecked < 50) {
  violations.push(`poort keurde verdacht weinig: ${filesChecked} bestanden, ${declarationsChecked} font-size-declaraties`);
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
    for (const m of raw.matchAll(/var\(--text-([a-z0-9-]+)\)/g)) {
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
console.log(`verify:text-roles — schoon (${ROLES.length} rollen; ${filesChecked} bestanden, ${declarationsChecked} font-size-declaraties gekeurd).`);
