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
 *  3. Geen CSS-regel die de tekst oranje maakt op een klasse die in de code op een `<Icon …>` staat, of op een
 *     element dat een `<Icon …>` zonder eigen kleur bevat.
 *  4. Geen CSS-regel die het icoon zelf oranje maakt: een selector die op `svg`, `path` of `.oa-icon` eindigt, met
 *     `color`, `fill` of `stroke` in oranje. Zo'n regel wint ook van een eigen kleur of een statuskleur (ronde 2:
 *     `.ops-note > svg` maakte `status.info` helemaal oranje).
 * Oranje is elke kleur die via `var()` op de accentkleur uitkomt: `--oa-accent`, `--theme-accent` (en hun hover- en
 * pressed-tint), een eigen variabele die daarop uitkomt (zoals `--icon-accent` of `--theme-active`), en ook een
 * accentkleur als terugvalwaarde (`var(--ops-note-accent, var(--theme-accent))`).
 * Eigen kleur: een `text-…`-klasse of `color` in `style` op het icoon, of een statuskleur (`semantic`) in de tekening.
 */
import fs from 'node:fs';
import path from 'node:path';
import { B2_ICONS } from '@/components/icons/b2/icons.generated';

const root = process.cwd();
const ACCENT_CLASS = /(?<![\w-])text-(?:accent(?:-hover)?|\[var\(--[\w-]*accent[\w-]*\)\])(?![\w-])/;

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

/** Iconen binnen `tag` zonder `color` in een eigen `style`. */
function styledOrNot(text: string, tag: Tag): string[] {
  const out: string[] = [];
  const inner = /<Icon\b/g;
  inner.lastIndex = tag.openEnd;
  for (let m = inner.exec(text); m && m.index < tag.end; m = inner.exec(text)) {
    const open = text.slice(m.index, openingEnd(text, m.index));
    if (!/style=\{\{[^}]*\bcolor:/.test(open)) out.push(/\bid=(?:"([^"]+)"|\{([^}]+)\})/.exec(open)?.slice(1).find(Boolean) ?? '?');
  }
  return out;
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
const styles = walk(path.join(root, 'src'), '.css').map(file => ({
  file: path.relative(root, file), text: fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
}));

// Welke variabelen op de accentkleur uitkomen: de accenttokens, en elke eigen variabele die er (ook via een andere
// variabele) naar wijst.
const accentVars = new Set(['--oa-accent', '--oa-accent-hover', '--oa-accent-pressed', '--theme-accent', '--theme-accent-hover']);
const varsIn = (value: string) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]);
const isAccent = (value: string) => varsIn(value).some(name => accentVars.has(name));
for (let grown = true; grown;) {
  grown = false;
  for (const { text } of styles) {
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
      if (!accentVars.has(m[1]) && isAccent(m[2])) { accentVars.add(m[1]); grown = true; }
    }
  }
}

/** Oranje als tekstkleur in een inline `style`: `color: '…var(--theme-accent)…'`, ook als terugvalwaarde. */
function accentStyle(open: string): boolean {
  for (const m of open.matchAll(/\bcolor:\s*((?:(?!,\s*['"]?[\w-]+['"]?\s*:)[^}\n])*)/g)) {
    if (isAccent(m[1])) return true;
  }
  return false;
}

// 1 en 2: oranje in de code zelf.
let checked = 0;
for (const { file, text } of sources) {
  const tags = /<([A-Za-z][\w.]*)\b/g;
  for (let m = tags.exec(text); m; m = tags.exec(text)) {
    const end = openingEnd(text, m.index);
    const open = text.slice(m.index, end);
    if (!ACCENT_CLASS.test(open) && !accentStyle(open)) continue;
    checked++;
    if (m[1] === 'Icon') { fail(`${file}:${line(text, m.index)}: <Icon> met de oranje tekstkleur`); continue; }
    const tag = tagAt(text, m.index);
    const bare = tag ? bareIcons(text, tag) : [];
    if (bare.length) fail(`${file}:${line(text, m.index)}: <${m[1]}> met de oranje tekstkleur om ${bare.join(', ')}; geef het icoon een grijze tekstkleur`);
  }
}

// 3 en 4: oranje uit een CSS-regel.
interface CssRule { cls: string; rule: string; onIcon: boolean }
const cssRules: CssRule[] = [];
const ICON_TAIL = /^(?:svg|path|\.oa-icon)(?![\w-])/;
for (const { file, text } of styles) {
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = [...rule[2].matchAll(/(?:^|;)\s*(color|fill|stroke)\s*:\s*([^;]+)/g)].filter(d => isAccent(d[2]));
    if (!decls.length) continue;
    for (const selector of rule[1].split(',')) {
      const compounds = selector.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
      const last = compounds[compounds.length - 1] ?? '';
      const onIcon = ICON_TAIL.test(last) || /\.oa-icon(?![\w-])/.test(last) || compounds.slice(0, -1).some(c => ICON_TAIL.test(c));
      // Alleen `color` erft door naar het icoon; `fill` en `stroke` tellen alleen op het icoon zelf.
      if (!onIcon && !decls.some(d => d[1] === 'color')) continue;
      // De klasse van de plek: de laatste samengestelde selector met een klasse die niet `oa-icon` is.
      const cls = [...compounds].reverse().map(c => [...c.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]).find(n => n !== 'oa-icon' && !n.startsWith('oa-icon--')))
        .find(Boolean);
      if (cls) cssRules.push({ cls, rule: `${file}: ${selector.trim()}`, onIcon });
      else if (onIcon) fail(`${file}: ${selector.trim()} maakt elk icoon oranje`);
    }
  }
}
for (const { cls, rule, onIcon } of cssRules) {
  const word = new RegExp(`(?<![\\w-])${cls}(?![\\w-])`, 'g');
  for (const { file, text } of sources) {
    for (let m = word.exec(text); m; m = word.exec(text)) {
      const tag = enclosingTag(text, m.index);
      if (!tag || !/className=/.test(tag.open)) continue;
      if (tag.name === 'Icon') { fail(`${file}:${line(text, tag.start)}: <Icon className="${cls}"> wordt oranje door ${rule}`); continue; }
      // Een regel op het icoon zelf wint van een eigen tekstkleur en van een statuskleur; alleen `style` gaat voor.
      const icons = onIcon ? styledOrNot(text, tag) : bareIcons(text, tag);
      if (icons.length) fail(`${file}:${line(text, tag.start)}: .${cls} (${rule}) maakt ${icons.join(', ')} helemaal oranje`);
    }
  }
}
const cssClasses = new Set(cssRules.map(r => r.cls));

if (checked < 5 || cssClasses.size < 5) fail(`de check vond te weinig oranje plekken om na te lopen (${checked} in de code, ${cssClasses.size} in CSS); klopt het zoekpatroon nog?`);

if (failures === 0) {
  console.log(`OK  iconen: geen icoon helemaal oranje door de plek (${checked} oranje plekken in de code, ${cssClasses.size} CSS-klassen nagelopen)`);
  process.exit(0);
} else {
  console.log(`XX  iconen: ${failures} plek(ken) maken een icoon helemaal oranje`);
  process.exit(1);
}
