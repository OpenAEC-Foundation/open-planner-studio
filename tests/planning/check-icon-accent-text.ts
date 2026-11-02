/**
 * Iconen: nooit helemaal oranje door de kleur van de plek (review van Sol op #765, ronde 1, 2 november 2026).
 *
 * Grijs is de basis, oranje het accent (regel van Ethan, 2 november 2026; Blueprint `docs/iconen.md`, "Grijs en
 * oranje"). `Icon` tekent de hoofdkleur in `currentColor` en het accent in `--icon-accent` (oranje). Geeft een plek
 * het icoon de oranje tekstkleur, dan zijn beide oranje en is het hele icoon oranje.
 * `tests/browser/icon-orange.spec.ts` meet dat op het scherm, maar komt niet bij elke plek (bijvoorbeeld Herstellen,
 * een beschikbare update of een hover). Deze check leest de broncode:
 *  1. Geen `<Icon …>` met `text-accent` of `var(--theme-accent)` in zijn eigen attributen.
 *  2. Geen element met `text-accent` (ook `hover:text-accent`) of `color: … var(--theme-accent)` in zijn eigen
 *     attributen dat een `<Icon …>` zonder eigen kleur bevat.
 *  3. Geen CSS-regel die de tekst oranje maakt (`color: var(--theme-accent)`) op een klasse die in de code op een
 *     `<Icon …>` staat, of op een element dat een `<Icon …>` zonder eigen kleur bevat.
 * Eigen kleur: een `text-…`-klasse of `color` in `style` op het icoon, of een statuskleur (`semantic`) in de tekening.
 */
import fs from 'node:fs';
import path from 'node:path';
import { B2_ICONS } from '@/components/icons/b2/icons.generated';

const root = process.cwd();
const ACCENT_CLASS = /(?<![\w-])text-accent(?![\w-])/;
const ACCENT_STYLE = /color:\s*[^,}]*var\(--theme-accent\)/;
const ACCENT_CSS = /(?:^|[;{\s])color:\s*var\(--theme-accent(?:-hover)?\s*[,)]/;

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };

function walk(dir: string, ext: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, ext);
    return entry.name.endsWith(ext) ? [full] : [];
  });
}

interface Tag { name: string; start: number; openEnd: number; end: number; open: string }

/** Einde van de openingstag die op `start` begint (het teken na `>`), met accolades en strings overgeslagen. */
function openingEnd(text: string, start: number): number {
  let depth = 0;
  let quote = '';
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (depth === 0 && (c === '"' || c === "'")) { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i + 1;
  }
  return text.length;
}

function tagAt(text: string, start: number): Tag | null {
  const m = /^<([A-Za-z][\w.]*)/.exec(text.slice(start, start + 80));
  if (!m) return null;
  const name = m[1];
  const openEnd = openingEnd(text, start);
  const open = text.slice(start, openEnd);
  if (open.endsWith('/>')) return { name, start, openEnd, end: openEnd, open };
  const pattern = new RegExp(`<(/?)${name.replace('.', '\\.')}(?=[\\s>/])`, 'g');
  pattern.lastIndex = openEnd;
  let depth = 1;
  for (let m2 = pattern.exec(text); m2; m2 = pattern.exec(text)) {
    if (m2[1]) { depth--; if (depth === 0) return { name, start, openEnd, end: m2.index, open }; }
    else if (!text.slice(m2.index, openingEnd(text, m2.index)).endsWith('/>')) depth++;
  }
  return { name, start, openEnd, end: text.length, open };
}

/** De tag waarvan de openingstag `index` bevat. */
function enclosingTag(text: string, index: number): Tag | null {
  for (let i = text.lastIndexOf('<', index); i >= 0; i = text.lastIndexOf('<', i - 1)) {
    const tag = tagAt(text, i);
    if (tag && tag.openEnd > index) return tag;
    if (index - i > 4000) return null;
  }
  return null;
}

function hasOwnColour(iconOpen: string): boolean {
  if (/className=[^>]*?(?<![\w-])text-(?!accent(?![\w-]))[a-z]/.test(iconOpen)) return true;
  if (/style=\{\{[^}]*\bcolor:/.test(iconOpen)) return true;
  const id = /\bid="([^"]+)"/.exec(iconOpen)?.[1];
  return !!id && !!(B2_ICONS as Record<string, { semantic?: string }>)[id]?.semantic;
}

/** Iconen binnen `tag` zonder eigen kleur. */
function bareIcons(text: string, tag: Tag): string[] {
  const out: string[] = [];
  const inner = /<Icon\b/g;
  inner.lastIndex = tag.openEnd;
  for (let m = inner.exec(text); m && m.index < tag.end; m = inner.exec(text)) {
    const open = text.slice(m.index, openingEnd(text, m.index));
    if (!hasOwnColour(open)) out.push(/\bid=(?:"([^"]+)"|\{([^}]+)\})/.exec(open)?.slice(1).find(Boolean) ?? '?');
  }
  return out;
}

const line = (text: string, index: number) => text.slice(0, index).split('\n').length;
const sources = walk(path.join(root, 'src'), '.tsx').map(file => ({ file: path.relative(root, file), text: fs.readFileSync(file, 'utf8') }));

// 1 en 2: oranje in de code zelf.
let checked = 0;
for (const { file, text } of sources) {
  const tags = /<([A-Za-z][\w.]*)\b/g;
  for (let m = tags.exec(text); m; m = tags.exec(text)) {
    const end = openingEnd(text, m.index);
    const open = text.slice(m.index, end);
    if (!ACCENT_CLASS.test(open) && !ACCENT_STYLE.test(open)) continue;
    checked++;
    if (m[1] === 'Icon') { fail(`${file}:${line(text, m.index)}: <Icon> met de oranje tekstkleur`); continue; }
    const tag = tagAt(text, m.index);
    const bare = tag ? bareIcons(text, tag) : [];
    if (bare.length) fail(`${file}:${line(text, m.index)}: <${m[1]}> met de oranje tekstkleur om ${bare.join(', ')}; geef het icoon een grijze tekstkleur`);
  }
}

// 3: oranje uit een CSS-regel.
const cssClasses = new Map<string, string>();
for (const file of walk(path.join(root, 'src'), '.css')) {
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!ACCENT_CSS.test(` ${rule[2]}`)) continue;
    for (const selector of rule[1].split(',')) {
      const last = selector.trim().split(/[\s>+~]+/).pop() ?? '';
      const cls = /\.([A-Za-z][\w-]*)/.exec(last)?.[1];
      if (cls) cssClasses.set(cls, `${path.relative(root, file)}: ${selector.trim()}`);
    }
  }
}
for (const [cls, rule] of cssClasses) {
  const word = new RegExp(`(?<![\\w-])${cls}(?![\\w-])`, 'g');
  for (const { file, text } of sources) {
    for (let m = word.exec(text); m; m = word.exec(text)) {
      const tag = enclosingTag(text, m.index);
      if (!tag || !/className=/.test(tag.open)) continue;
      if (tag.name === 'Icon') { fail(`${file}:${line(text, tag.start)}: <Icon className="${cls}"> krijgt de oranje tekstkleur uit ${rule}`); continue; }
      const bare = bareIcons(text, tag);
      if (bare.length) fail(`${file}:${line(text, tag.start)}: .${cls} (${rule}) maakt ${bare.join(', ')} helemaal oranje`);
    }
  }
}

if (checked < 5 || cssClasses.size < 5) fail(`de check vond te weinig oranje plekken om na te lopen (${checked} in de code, ${cssClasses.size} in CSS); klopt het zoekpatroon nog?`);

if (failures === 0) {
  console.log(`OK  iconen: geen icoon helemaal oranje door de plek (${checked} oranje plekken in de code, ${cssClasses.size} CSS-klassen nagelopen)`);
  process.exit(0);
} else {
  console.log(`XX  iconen: ${failures} plek(ken) maken een icoon helemaal oranje`);
  process.exit(1);
}
