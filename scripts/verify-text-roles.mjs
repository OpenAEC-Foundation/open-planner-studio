#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(root, 'src');

const ROLES = ['caption', 'small', 'body', 'large', 'heading', 'title'];
const roleSet = new Set(ROLES);
const OUT_OF_SCOPE = ['engine', 'services'].map(d => join(srcDir, d) + sep);
const ESCAPE = /text-roles:\s*\S/;

const ABSOLUTE_UNIT = /(?:\d|\})\s*(?:px|rem|pt|pc|cm|mm|in|q)\b/i;

const CSS_FONT_SIZE_OK = new RegExp(
  '^(?:var\\(--text-(?:' + ROLES.join('|') + ')\\)|[\\d.]+(?:em|%)|inherit|initial|unset|revert|smaller|larger)(?:\\s*!important)?$',
);

/** @param {string} text @param {boolean} isCss */
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
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (c === '"' || c === "'" || (!isCss && c === '`')) {
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

/** @type {{ name: string, css: boolean, code: boolean, test: (line: string) => boolean }[]} */
const LINE_RULES = [
  {
    name: 'font-shorthand in CSS — zet font-size apart via var(--text-<rol>)',
    css: true, code: false,
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
  const escaped = i => ESCAPE.test(rawLines[i] ?? '') && !ESCAPE.test(lines[i] ?? '');
  const report = (i, name) => {
    if (escaped(i)) return;
    violations.push(`${relative(root, file)}:${i + 1}  ${name}\n      ${(rawLines[i] ?? '').trim().slice(0, 140)}`);
  };

  if (isCss) {
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
if (filesChecked < 50 || declarationsChecked < 50) {
  violations.push(`poort keurde verdacht weinig: ${filesChecked} bestanden, ${declarationsChecked} font-size-declaraties`);
}

const globals = readFileSync(join(srcDir, 'styles', 'globals.css'), 'utf8');
for (const role of ROLES) {
  if (!new RegExp(`--text-${role}\\s*:`).test(globals)) {
    violations.push(`src/styles/globals.css  tekstrol --text-${role} ontbreekt in het @theme-blok`);
  }
}
{
  const cssPx = new Map();
  for (const m of globals.matchAll(/--text-([a-z]+)\s*:\s*calc\(\s*([\d.]+)px\s*\*\s*var\(--ui-font-scale/g)) cssPx.set(m[1], Number(m[2]));
  const mirrorFile = join(srcDir, 'engine', 'renderer', 'textRoles.ts');
  const mirror = readFileSync(mirrorFile, 'utf8');
  const block = /TEXT_ROLE_PX\s*=\s*\{([^}]*)\}/.exec(mirror);
  const tsPx = new Map();
  if (block) for (const m of block[1].matchAll(/([a-z]+)\s*:\s*([\d.]+)/g)) tsPx.set(m[1], Number(m[2]));
  if (tsPx.size === 0) violations.push(`${relative(root, mirrorFile)}  TEXT_ROLE_PX niet gevonden of leeg`);
  for (const role of ROLES) {
    if (cssPx.get(role) === undefined) violations.push(`src/styles/globals.css  --text-${role} heeft geen herkenbare \`calc(Npx * var(--ui-font-scale…))\``);
    else if (tsPx.get(role) !== cssPx.get(role)) {
      violations.push(`${relative(root, mirrorFile)}  TEXT_ROLE_PX.${role} = ${tsPx.get(role)}, globals.css zegt ${cssPx.get(role)}px`);
    }
  }
  for (const role of tsPx.keys()) if (!roleSet.has(role)) violations.push(`${relative(root, mirrorFile)}  onbekende rol ${role} in TEXT_ROLE_PX`);
}
if (!/--text-\*\s*:\s*initial/.test(globals)) {
  violations.push('src/styles/globals.css  `--text-*: initial` ontbreekt — Tailwinds eigen schaal lekt dan weer naar binnen');
}

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
