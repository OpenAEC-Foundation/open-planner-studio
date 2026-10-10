// Docs-straat: werkpakketten voor de in-app gidsen (§5.2, §5.3), samenvoegen (§9), bijhouden (C2, C3)
// en status. Pure functies; de CLI (cli.ts) leest en schrijft de bestanden. De sectie- en
// structuurregels komen uit het gedeelde contract C1 (`scripts/lib/docs-structure.ts`).
import { sectionHash, splitSections, structureHash, type DocSection } from '../lib/docs-structure';
import {
  countToken, placeholders, nestings, termEntries, textsOf, unitMap, unitsOf,
  type Concept, type LangTermbase, type Style,
} from './common';
import { avoidHitsIn, isTranslated, type AvoidRule, type NsInput, type ReleaseGap, type UiSources } from './ui';

// ── Typen ────────────────────────────────────────────────────────────────────────────────────

/** `i18n/docs-literal.json`. */
export interface DocsLiteral {
  /** Labelsoort c uit code: bestand → namen die daar als tekst staan. */
  sources: Record<string, string[]>;
  /** Labelsoort c met de hand. */
  manual: string[];
  /** Per taal: keep-namen die de taal in lopende tekst wel vertaalt (zacht in plaats van hard). */
  keepTranslated?: Record<string, string[]>;
  /** Per artikel: inline code die de app per taal anders toont (niet byte-gelijk geëist). */
  display?: Record<string, string[]>;
  /**
   * Per taal: avoid-woorden die ook een gewoon woord met een andere betekenis zijn (cs "konec" = het eind
   * van een lijst, "důležitý" = belangrijk). Daar is een treffer in de docs-poort geen harde fout maar een
   * waarschuwing die de nalezer naloopt. Alleen toevoegen na een gemeten valse treffer.
   */
  avoidSoft?: Record<string, string[]>;
}

export const literalNames = (lit: DocsLiteral): string[] =>
  [...new Set([...Object.values(lit.sources).flat(), ...lit.manual])];

// ── Voorbeeldnamen (labelsoort c) uit het tutorialproject en de voorbeeldprojecten ───────────

const unescapeTs = (x: string): string => x.replace(/\\(.)/g, '$1');

/**
 * De project-, kalender-, fase-, taak- en resourcenamen van het tutorialproject (`scripts/tutorial-project.ts`):
 * elke `name: n('nl', 'en')` plus `PROJECT_NAME` en `CALENDAR_NAME`, nl en en, in bestandsvolgorde, uniek.
 * De naam van de basislijn telt niet (dat is geen voorbeeldnaam in een gids).
 */
export function tutorialNames(ts: string): string[] {
  const re = /(?:\bname:\s*|\b(?:PROJECT|CALENDAR)_NAME\s*=\s*)n\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g;
  const out: string[] = [];
  for (const m of ts.matchAll(re)) out.push(unescapeTs(m[1]), unescapeTs(m[2]));
  return [...new Set(out)];
}

/** Een IFC-tekst (STEP) terug naar gewone tekst: `''` → `'`, `\X2\…\X0\` (UTF-16, hex) en `\X\hh`. */
export function decodeIfcString(x: string): string {
  return x.replace(/''/g, "'")
    .replace(/\\X2\\((?:[0-9A-F]{4})+)\\X0\\/gi, (_, hex: string) => String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map(h => parseInt(h, 16))))
    .replace(/\\X\\([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** IFC-entiteiten waarvan de naam (derde attribuut) een voorbeeldnaam is: project, taak, kalender, resource. */
const IFC_NAMED = /^#\d+\s*=\s*(IFCPROJECT|IFCTASK|IFCWORKCALENDAR|IFC[A-Z]*RESOURCE)\('[^']*',[^,]*,'((?:[^']|'')*)'/gm;

/** De project-, taak-, kalender- en resourcenamen van een voorbeeldproject (`public/examples/*.ifc`), uniek. */
export function ifcNames(ifc: string): string[] {
  return [...new Set([...ifc.matchAll(IFC_NAMED)].map(m => decodeIfcString(m[2]).trim()).filter(n => /\p{L}/u.test(n)))];
}

/**
 * Voorbeeldnamen die soort c mogen zijn: geen en-UI-tekst (die is soort a) en minstens twee tekens.
 * `uiTexts` zijn de genormaliseerde en-UI-teksten (`normLabel`).
 */
export const literalCandidates = (names: string[], uiTexts: ReadonlySet<string>): string[] =>
  names.filter(n => n.length >= 2 && !uiTexts.has(normLabel(n)));

/**
 * Eén label in een sectie (§5.3). `a`: UI-label, één van `targets` moet letterlijk in de vertaling;
 * `b`: UI-patroon, één van `targets` (met `{{…}}` als open plek) moet passen; `c`: letterlijk, `en` byte-gelijk.
 * `keys` alleen als de doelteksten verschillen (dubbelzinnig).
 */
export interface DocsLabel {
  section: number;
  kind: 'a' | 'b' | 'c';
  en: string;
  targets?: string[];
  keys?: string[];
  /**
   * `tab`: het label staat op een tabbladplek (eerste deel van een pad `*A › B*`, of "tab *X*" / "*X* tab")
   * en `targets` zijn alleen de tabbladnamen (lint of instellingenvenster). De poort eist er precies één
   * als eigen cursief (pad)deel; "Plánování" telt dan niet voor "Plán".
   */
  role?: 'tab';
  /** Bij `role: 'tab'`: zo vaak staat het label op een tabbladplek in de bronsectie. */
  count?: number;
}

/** Een term in een pakket; `definition` (uit concepts.json) zegt welke betekenis de term draagt. */
export interface DocsTerm { id: string; en: string[]; target: string; forms: string[]; avoid?: string[]; definition?: string }

/**
 * Metadata van één sectie in een pakket: de hash van de en-sectie, en `labels` = één hash over de gebruikte
 * UI-sleutels met hun doeltekst-hash (`labelsDigest`). `apply docs` rekent die opnieuw uit en schrijft de
 * sleutels per stuk in C3; zo hoeft de agent geen lijst sleutel-hashes te lezen.
 */
export interface DocsSectionMeta { index: number; heading: string | null; hash: string; words: number; labels: string }

/** Eén hash over de sleutels van een sectie met hun doeltekst-hash (gesorteerd). */
export const labelsDigest = (keys: Record<string, string>): string =>
  sectionHash(Object.keys(keys).sort().map(k => `${k}=${keys[k]}`).join('\n'));

export type DocsMode = 'missing' | 'stale' | 'ids';

export interface DocsPackage {
  kind: 'docs';
  lang: string;
  id: string;
  article: string;
  part: number;
  parts: number;
  mode: DocsMode;
  style?: Style;
  terms: DocsTerm[];
  tokens: string[];
  keep: string[];
  /** Keep-namen die deze taal mag vertalen: alleen een waarschuwing. */
  keepSoft?: string[];
  /** Inline code die per taal anders mag (display-voorbeelden). */
  display?: string[];
  /** Avoid-woorden die in deze taal ook een gewoon woord zijn: alleen een waarschuwing, de nalezer kijkt. */
  avoidSoft?: string[];
  labels: DocsLabel[];
  /** Bij --stale (en --ids op een vertaald artikel): de huidige vertaling per sectie-index. */
  previous?: Record<string, string>;
  sections: DocsSectionMeta[];
}

/** C3: `i18n/docs-sources/<taal>.json`. */
export interface DocsSourceEntry { structure: string; sections: { hash: string; labels: Record<string, string> }[] }
export type DocsSources = Record<string, DocsSourceEntry>;

// ── Markdown: inline-tokens en blokken, zoals src/utils/miniMarkdown.tsx ─────────────────────

/** Dezelfde inline-regex als miniMarkdown (afbeelding, link, vet, cursief, code). */
const INLINE_RE = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
const FENCE_RE = /^```/;

function inlineMatches(md: string, group: number): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE_RE.test(line.trim())) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of line.matchAll(INLINE_RE)) if (m[group] !== undefined) out.push(m[group]);
  }
  return out;
}

/** De cursieve stukken (`*…*`), in volgorde. */
export const italicsOf = (md: string): string[] => inlineMatches(md, 6);
/** De inline-codestukken (`` `…` ``), in volgorde. */
export const codesOf = (md: string): string[] => inlineMatches(md, 7);

export type BlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'img' | 'code';
export interface Block { kind: BlockKind; line: number; items: number; text: string }

const HEADER_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/** De blokken van een tekst, met dezelfde regels als `renderMiniMarkdown` (regelnummers vanaf 1). */
export function blocksOf(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const start = i + 1;
    if (FENCE_RE.test(line.trim())) {
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i].trim())) i++;
      i++;
      out.push({ kind: 'code', line: start, items: 0, text: line });
      continue;
    }
    const h = HEADER_RE.exec(line);
    if (h) { out.push({ kind: `h${h[1].length}` as BlockKind, line: start, items: 0, text: h[2] }); i++; continue; }
    if (IMAGE_LINE_RE.test(line.trim())) { out.push({ kind: 'img', line: start, items: 0, text: line }); i++; continue; }
    for (const [kind, re] of [['ul', UL_RE], ['ol', OL_RE]] as const) {
      if (!re.test(line)) continue;
      let n = 0;
      while (i < lines.length && re.test(lines[i])) { n++; i++; }
      out.push({ kind, line: start, items: n, text: line });
    }
    if (out.length && out[out.length - 1].line === start) continue;
    while (i < lines.length && lines[i].trim() !== '' && !HEADER_RE.test(lines[i]) && !FENCE_RE.test(lines[i].trim())
      && !UL_RE.test(lines[i]) && !OL_RE.test(lines[i]) && !IMAGE_LINE_RE.test(lines[i].trim())) i++;
    out.push({ kind: 'p', line: start, items: 0, text: line });
  }
  return out;
}

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** De H1 van een artikel als platte tekst (zonder `*`, `` ` `` en linkopmaak). */
export function titleOf(md: string): string | undefined {
  const m = /^#\s+(.*)$/m.exec(md.replace(/\r\n/g, '\n'));
  if (!m) return undefined;
  return m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').trim();
}

// ── Tekst zoeken op stam ─────────────────────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Schriften zonder spaties tussen woorden: daar zoeken we de hele woordgroep als deeltekst. */
const NO_SPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}]/u;
const ARABIC = /\p{Script=Arabic}/u;
const L = '\\p{L}\\p{M}\\p{N}';

/** De stam van één woord: korte woorden heel, langere zonder hun laatste ±30 %. */
function stem(word: string): string {
  const chars = Array.from(word);
  if (chars.length <= 4) return word;
  return chars.slice(0, Math.max(4, Math.ceil(chars.length * 0.7))).join('');
}

/**
 * Regex die een woordgroep op stam per woord vindt: elk woord met zijn stam en een vrije uitgang
 * ("relation" ⇒ "relations", cs "následník" ⇒ "následníka"). Zonder spaties (zh, ja): de hele groep
 * als deeltekst. Arabisch schrift: zonder woordgrens vooraan (lidwoord en voorzetsels plakken vast).
 */
export function stemRe(phrase: string): RegExp {
  const p = phrase.trim();
  if (NO_SPACE.test(p)) return new RegExp(escapeRe(p), 'iu');
  const body = p.split(/\s+/).map(w => `${escapeRe(stem(w))}[${L}\\-]*`).join('[\\s\\-]+');
  return new RegExp(`${ARABIC.test(p) ? '' : `(?<![${L}])`}${body}`, 'iu');
}

export const hasStem = (text: string, phrase: string): boolean => phrase.trim() !== '' && stemRe(phrase).test(text);

/** Komt `word` als los woord voor (hoofdletterongevoelig)? Zonder spaties: als deeltekst. */
export function hasWord(text: string, word: string): boolean {
  const w = word.trim();
  if (w === '') return false;
  if (NO_SPACE.test(w)) return text.toLocaleLowerCase().includes(w.toLocaleLowerCase());
  return new RegExp(`(?<![${L}])${escapeRe(w)}(?![${L}])`, 'iu').test(text);
}

/**
 * De avoid-varianten die als los woord in `text` staan, nadat de vormen van de term zelf zijn
 * weggestreept (een avoid-variant kan in de eigen term zitten). Een vorm verdwijnt alleen als los woord
 * (anders maakt "na" van "nakonec" een los "konec"); in schriften zonder spaties en in Arabisch schrift
 * (voorvoegsels plakken vast) als deeltekst.
 */
export function avoidWords(text: string, forms: string[], avoid: string[]): string[] {
  const rest = forms.map(f => f.trim()).filter(f => f !== '').sort((a, b) => b.length - a.length)
    .reduce((s, f) => (NO_SPACE.test(f) || ARABIC.test(f)
      ? s.split(f.toLocaleLowerCase()).join(' \u0000 ')
      : s.replace(new RegExp(`(?<![${L}])${escapeRe(f.toLocaleLowerCase())}(?![${L}])`, 'gu'), ' \u0000 ')), text.toLocaleLowerCase());
  return avoid.filter(a => hasWord(rest, a));
}

// ── Labelkaart (§5.3) ────────────────────────────────────────────────────────────────────────

/** Normaliseer een labeltekst: zonder ▾ en zonder afsluitend …, ..., : of punt. */
export function normLabel(s: string): string {
  return s.replace(/\s*▾\s*/g, ' ').trim().replace(/(?:\s*(?:…|\.\.\.|:|\.))+$/u, '').trim();
}

interface LabelHit { key: string; target?: string }
interface LabelPattern { re: RegExp; lit: string; hits: LabelHit[] }

export interface EnLabelIndex {
  /** Genormaliseerde en-tekst → sleutels met hun (bruikbare) doeltekst. */
  exact: Map<string, LabelHit[]>;
  /** En-teksten met `{{…}}`: een regex op de genormaliseerde en-tekst. */
  patterns: LabelPattern[];
  /** Per sleutel (`ns:pad`) de hash van de huidige doeltekst (`sectionHash('')` zonder bruikbare vertaling). */
  hashes: Map<string, string>;
}

/** Minimaal aantal letters buiten de invulplekken voor een patroon (anders past het op alles). */
const PATTERN_MIN_LETTERS = 8;

function patternRe(text: string, anchored: boolean): { re: RegExp; lit: string } | null {
  const parts = text.split(/\{\{\s*[\w.-]+\s*\}\}/);
  const letters = parts.join('').replace(/[^\p{L}]/gu, '').length;
  if (parts.length < 2 || letters < PATTERN_MIN_LETTERS) return null;
  const lit = [...parts].sort((a, b) => b.length - a.length)[0];
  const body = parts.map(escapeRe).join('(.+?)');
  return { re: new RegExp(anchored ? `^${body}$` : body, 'u'), lit };
}

/**
 * De labelindex over alle namespaces, op de en-tekst. Een doeltekst telt alleen als de eenheid in
 * de doeltaal vertaald is (`isTranslated`) en geen avoid-variant uit de termbase bevat (zoals de
 * UI-labelpoort). Meervoudsfamilies: elke vorm.
 */
export function buildEnLabelIndex(inputs: NsInput[], lang: string, sources: UiSources, rules: AvoidRule[] = []): EnLabelIndex {
  const exact = new Map<string, LabelHit[]>();
  const byPattern = new Map<string, LabelPattern>();
  const hashes = new Map<string, string>();
  for (const input of inputs) {
    const en = unitMap(input.en);
    const target = unitMap(input.target);
    const srcHashes = sources[input.ns] ?? {};
    for (const u of unitsOf(input.nl)) {
      const key = `${input.ns}:${u.key}`;
      const e = en.get(u.key);
      const t = target.get(u.key);
      const usable = isTranslated(t, u, lang, srcHashes) && avoidHitsIn(t!.text, rules).hits.length === 0;
      const tTexts = usable ? textsOf(t!.text) : [];
      hashes.set(key, sectionHash(tTexts.join('\n')));
      if (!e) continue;
      const eTexts = textsOf(e.text);
      // Meervoud: de categorieën van en en de doeltaal vallen niet samen (en one/other, ar zes vormen,
      // en de ar-vorm `one` schrijft het getal uit). Elke doelvorm is dan een geldige kandidaat.
      const plural = eTexts.length > 1 || tTexts.length > 1;
      const add = (list: LabelHit[], tt: string | undefined) => {
        const target = tt !== undefined ? normLabel(tt) : undefined;
        if (!list.some(h => h.key === key && h.target === target)) list.push({ key, ...(target !== undefined ? { target } : {}) });
      };
      eTexts.forEach((et, i) => {
        if (nestings(et).length || et.length > 200) return;
        const tts: (string | undefined)[] = plural ? (tTexts.length ? tTexts : [undefined]) : [tTexts[Math.min(i, tTexts.length - 1)]];
        if (placeholders(et).length === 0) {
          const n = normLabel(et);
          if (!/\p{L}/u.test(n)) return;
          const list = exact.get(n) ?? [];
          for (const tt of tts) add(list, tt);
          exact.set(n, list);
          return;
        }
        const n = normLabel(et);
        const pr = patternRe(n, true);
        if (!pr) return;
        const p = byPattern.get(n) ?? { ...pr, hits: [] };
        for (const tt of tts) add(p.hits, tt);
        byPattern.set(n, p);
      });
    }
  }
  return { exact, patterns: [...byPattern.values()], hashes };
}

/**
 * De sleutels van de tabbladnamen: de linttabbladen (`RibbonTab` in `src/state/slices/types.ts`; Ribbon.tsx
 * toont `menu:ribbon.<tab>`, met `beeld` → `view` en `instellingen` → `settings`) en de tabbladen van het
 * instellingenvenster (`SettingsPanelContent.tsx`). check-translate-docs.ts bewaakt dat deze lijst de code volgt.
 */
export const RIBBON_TABS = ['file', 'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai'] as const;
export const ribbonTabKey = (tab: string): string => `menu:ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`;
export const SETTINGS_TAB_KEYS = ['common:settings.appearanceTab', 'common:settings.planningTab', 'common:settings.advancedTab'] as const;
export const TAB_KEYS: ReadonlySet<string> = new Set([...RIBBON_TABS.map(ribbonTabKey), ...SETTINGS_TAB_KEYS]);

interface Classified {
  kind: 'a' | 'b' | 'c';
  en: string;
  /** Alle sleutels met dit en-label (voor C3: de sectie hangt van al die teksten af). */
  hits: LabelHit[];
  /** Op een tabbladplek: alleen de tabbladsleutels; die geven de `targets`. */
  role?: 'tab';
  tabHits?: LabelHit[];
}

/**
 * Soort a/b/c van één cursief stuk; een pad (`A › B`) of een paar (`A → B`) per deel. Vrij (d) = [].
 * `tab`: het stuk staat op een tabbladplek; het eerste deel van een pad met `›` staat er altijd. Heeft
 * een a-label dan een tabbladsleutel, dan krijgt het `role: 'tab'` met alleen die sleutels als kandidaat.
 */
export function classifyItalic(span: string, index: EnLabelIndex, literals: ReadonlySet<string>, tab = false): Classified[] {
  const n = normLabel(span);
  if (n === '') return [];
  const a = index.exact.get(n);
  if (a) {
    const tabHits = tab ? a.filter(h => TAB_KEYS.has(h.key)) : [];
    return [{ kind: 'a', en: n, hits: a, ...(tabHits.length ? { role: 'tab' as const, tabHits } : {}) }];
  }
  const b = index.patterns.filter(p => n.includes(p.lit) && p.re.test(n));
  if (b.length) {
    // De ingevulde plekken van een patroon kunnen zelf letterlijk zijn (taaknamen van het tutorialproject).
    const filled = (b[0].re.exec(n) ?? []).slice(1).flatMap(v => v.split(' → ')).map(v => v.trim()).filter(v => literals.has(v));
    return [{ kind: 'b', en: n, hits: b.flatMap(p => p.hits) }, ...filled.map(v => ({ kind: 'c' as const, en: v, hits: [] }))];
  }
  if (literals.has(span.trim()) || literals.has(n)) return [{ kind: 'c', en: literals.has(span.trim()) ? span.trim() : n, hits: [] }];
  for (const sep of [' › ', ' → ']) {
    if (n.includes(sep)) return n.split(sep).flatMap((part, i) => classifyItalic(part, index, literals, sep === ' › ' ? i === 0 : false));
  }
  return [];
}

/** Staat een cursief stuk op een tabbladplek: "tab *X*", "*X* tab", "on the *X* tab"? */
export const TAB_BEFORE = /(?<![\p{L}])tab\s*$/iu;
export const TAB_AFTER = /^\s*tab(?![\p{L}])/iu;

/** De cursieve stukken van een tekst met hun tabbladplek (buiten codeblokken). */
function italicsWithPlace(md: string): { span: string; tab: boolean }[] {
  const out: { span: string; tab: boolean }[] = [];
  let fence = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE_RE.test(line.trim())) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of line.matchAll(INLINE_RE)) {
      if (m[6] === undefined) continue;
      const before = line.slice(0, m.index);
      const after = line.slice(m.index + m[0].length);
      out.push({ span: m[6], tab: TAB_BEFORE.test(before) || TAB_AFTER.test(after) });
    }
  }
  return out;
}

/** Aanhalingstekens rond een naam: "…", “…”, „…“, ‘…’, «…». */
const QUOTED_RE = /["“„‘«]([^"“”„‘’«»\n]{2,120})["”“’»]/gu;

/**
 * Plekken buiten cursief waar een voorbeeldnaam letterlijk moet blijven: tussen aanhalingstekens, en de
 * linktekst van een `examples://`-link (de lijst *File › Examples* toont de naam in het Engels).
 */
export function quotedNames(md: string, literals: ReadonlySet<string>): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE_RE.test(line.trim())) { fence = !fence; continue; }
    if (fence) continue;
    const plain = line.replace(/`[^`]+`/g, ' ');
    for (const m of plain.matchAll(INLINE_RE)) {
      if (m[3] !== undefined && m[4].startsWith('examples://') && literals.has(m[3].trim())) out.push(m[3].trim());
    }
    for (const m of plain.matchAll(QUOTED_RE)) if (literals.has(m[1].trim())) out.push(m[1].trim());
  }
  return out;
}

/** De labels van één sectie (uniek per soort en tekst) en de gebruikte sleutels met hun hash. */
export function sectionLabels(section: number, text: string, index: EnLabelIndex, literals: ReadonlySet<string>): { labels: DocsLabel[]; keys: Record<string, string> } {
  const labels: DocsLabel[] = [];
  const keys: Record<string, string> = {};
  const seen = new Set<string>();
  const found: Classified[] = [
    ...italicsWithPlace(text).flatMap(({ span, tab }) => classifyItalic(span, index, literals, tab)),
    ...quotedNames(text, literals).map(en => ({ kind: 'c' as const, en, hits: [] })),
  ];
  const tabCount = new Map<string, number>();
  for (const c of found) if (c.role === 'tab') tabCount.set(c.en, (tabCount.get(c.en) ?? 0) + 1);
  for (const c of found) {
    const id = `${c.kind}\u0000${c.role ?? ''}\u0000${c.en}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // C3 houdt alle sleutels van het label bij (ook op een tabbladplek): zo verandert de digest niet.
    for (const h of c.hits) keys[h.key] = index.hashes.get(h.key) ?? sectionHash('');
    if (c.kind === 'c') { labels.push({ section, kind: 'c', en: c.en }); continue; }
    const cand = c.tabHits ?? c.hits;
    const targets = [...new Set(cand.map(h => h.target).filter((t): t is string => t !== undefined && t !== ''))];
    labels.push({
      section, kind: c.kind, en: c.en, targets,
      ...(targets.length > 1 ? { keys: cand.map(h => h.key) } : {}),
      ...(c.role ? { role: c.role, count: tabCount.get(c.en) ?? 1 } : {}),
    });
  }
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(keys).sort()) sorted[k] = keys[k];
  return { labels, keys: sorted };
}

// ── Termen, tokens, keep ─────────────────────────────────────────────────────────────────────

/** Termen uit de termbase waarvan een en-synoniem (op stam per woord) in de tekst staat. */
export function docsTermsFor(text: string, concepts: Concept[], tb: LangTermbase | undefined): DocsTerm[] {
  if (!tb) return [];
  const entries = new Map(termEntries(tb));
  const out: DocsTerm[] = [];
  for (const c of concepts) {
    if (c.kind !== 'term') continue;
    const e = entries.get(c.id);
    if (!e || !c.en.some(s => hasStem(text, s))) continue;
    out.push({
      id: c.id, en: c.en, target: e.term, forms: e.forms, ...(e.avoid?.length ? { avoid: e.avoid } : {}),
      ...(c.definition ? { definition: c.definition } : {}),
    });
  }
  return out;
}

/** Tokens of keep-namen (en-synoniemen en nl, hoofdlettergevoelig, los woord) die in de tekst staan. */
export function docsLiteralsFor(text: string, concepts: Concept[], kind: 'token' | 'keep'): string[] {
  const found = new Set<string>();
  for (const c of concepts) {
    if (c.kind !== kind) continue;
    for (const lit of new Set([...c.en, c.nl])) if (countToken(text, lit) > 0) found.add(lit);
  }
  return [...found].sort();
}

// ── Selectie: ontbreekt / verouderd / actueel ────────────────────────────────────────────────

/**
 * Koppel de secties van de oude en de nieuwe en-versie op inhoud (langste gemeenschappelijke reeks
 * van hashes), niet op positie: een ingevoegde sectie maakt de volgende niet verouderd.
 * Geeft per nieuwe sectie de index van de oude sectie, of null. Zie `pairChanged` voor gewijzigde secties.
 */
export function linkSections(oldHashes: string[], newHashes: string[]): (number | null)[] {
  const n = oldHashes.length;
  const m = newHashes.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldHashes[i] === newHashes[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: (number | null)[] = new Array<number | null>(m).fill(null);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldHashes[i] === newHashes[j]) { out[j] = i; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return out;
}

/**
 * Gewijzigde secties: tussen twee gekoppelde secties (of aan het begin of eind) staan evenveel
 * ongekoppelde oude als nieuwe secties ⇒ die horen op volgorde bij elkaar (dezelfde sectie, andere
 * tekst). Bij een ongelijk aantal (invoegen én wijzigen) koppelt niets: liever opnieuw vertalen dan
 * de verkeerde oude vertaling als `previous`.
 */
export function pairChanged(link: (number | null)[], oldCount: number): (number | null)[] {
  const out = [...link];
  let prevOld = -1;
  let gapNew: number[] = [];
  const flush = (nextOld: number) => {
    const gapOld = Array.from({ length: nextOld - prevOld - 1 }, (_, k) => prevOld + 1 + k);
    if (gapNew.length > 0 && gapNew.length === gapOld.length) gapNew.forEach((j, k) => { out[j] = gapOld[k]; });
    gapNew = [];
  };
  link.forEach((old, j) => {
    if (old === null) { gapNew.push(j); return; }
    flush(old);
    prevOld = old;
  });
  flush(oldCount);
  return out;
}

export type SectionState = 'missing' | 'stale' | 'current';

export interface ArticleState {
  id: string;
  state: 'missing' | 'stale' | 'current';
  /** Per en-sectie: toestand, en de index van de gekoppelde vertaalde sectie. */
  sections: { state: SectionState; old: number | null; reason?: 'new' | 'text' | 'label' }[];
  /** Vertaalde secties die bij geen en-sectie meer horen (verwijderd of verplaatst). */
  dropped: number;
}

/**
 * Toestand van één artikel in de doeltaal. Ontbreekt: geen vertaling of geen C3-regel. Een sectie is
 * verouderd als zijn en-hash nergens in C3 terugkomt (nieuw of gewijzigd) of als een gebruikt label een
 * andere doeltekst kreeg (`labelHashes`). Past het aantal vertaalde secties niet bij C3, dan is alles verouderd.
 */
export function articleState(
  id: string, enMd: string, translated: string | undefined, entry: DocsSourceEntry | undefined, labelHashes: Map<string, string>,
): ArticleState {
  const en = splitSections(enMd);
  if (translated === undefined || !entry) {
    return { id, state: 'missing', sections: en.map(() => ({ state: 'missing' as const, old: null })), dropped: 0 };
  }
  const tr = splitSections(translated);
  if (tr.length !== entry.sections.length) {
    return { id, state: 'stale', sections: en.map(() => ({ state: 'stale' as const, old: null, reason: 'text' as const })), dropped: tr.length };
  }
  const exact = linkSections(entry.sections.map(s => s.hash), en.map(s => sectionHash(s.text)));
  const link = pairChanged(exact, entry.sections.length);
  const sections = link.map((old, j) => {
    if (old === null) return { state: 'stale' as const, old, reason: 'new' as const };
    if (exact[j] === null) return { state: 'stale' as const, old, reason: 'text' as const };
    const changed = Object.entries(entry.sections[old].labels).some(([k, h]) => (labelHashes.get(k) ?? sectionHash('')) !== h);
    return changed ? { state: 'stale' as const, old, reason: 'label' as const } : { state: 'current' as const, old };
  });
  const used = new Set(link.filter((x): x is number => x !== null));
  const dropped = entry.sections.length - used.size;
  const inOrder = link.filter((x): x is number => x !== null).every((x, i, a) => i === 0 || x > a[i - 1]);
  const state = sections.some(s => s.state !== 'current') || dropped > 0 || !inOrder || entry.structure !== structureHash(enMd)
    ? 'stale' : 'current';
  return { id, state, sections, dropped };
}

// ── Pakketten maken ──────────────────────────────────────────────────────────────────────────

export const DOCS_MAX_WORDS = 2500;

export interface DocsArticleInput {
  id: string;
  /** De en-bron. */
  md: string;
  /** De huidige vertaling, als die er is. */
  translated?: string;
}

/** De tekst van een reeks secties, zoals in `.src.md` en `.out.md`: elke sectie zonder witruimte aan het eind, één lege regel ertussen. */
export const joinSections = (texts: string[]): string => `${texts.map(t => t.trimEnd()).join('\n\n')}\n`;

/**
 * Maak de docs-pakketten voor één taal. `--missing`: artikelen zonder vertaling; `--stale`: de verouderde
 * secties van vertaalde artikelen (met de oude vertaling als `previous`); `--ids`: deze artikelen heel.
 * Per artikel één pakket, of bij meer dan `maxWords` woorden een reeks hele `##`-secties.
 */
export function buildDocsPackages(opts: {
  lang: string;
  articles: DocsArticleInput[];
  mode: DocsMode;
  ids?: string[];
  sources: DocsSources;
  index: EnLabelIndex;
  literal: DocsLiteral;
  concepts: Concept[];
  termbase?: LangTermbase;
  maxWords?: number;
}): { pkg: DocsPackage; src: string }[] {
  const maxWords = opts.maxWords ?? DOCS_MAX_WORDS;
  const literals = new Set(literalNames(opts.literal));
  const keepSoft = opts.literal.keepTranslated?.[opts.lang] ?? [];
  const out: { pkg: DocsPackage; src: string }[] = [];
  const wanted = opts.ids ? new Set(opts.ids) : undefined;
  for (const art of opts.articles) {
    if (wanted && !wanted.has(art.id)) continue;
    const en = splitSections(art.md);
    const st = articleState(art.id, art.md, art.translated, opts.sources[art.id], opts.index.hashes);
    const trSecs = art.translated !== undefined ? splitSections(art.translated) : [];
    let selected: { index: number; previous?: string }[];
    if (opts.mode === 'ids') {
      selected = en.map((_, i) => {
        const old = st.sections[i].old;
        return { index: i, ...(old !== null && trSecs[old] ? { previous: trSecs[old].text.trimEnd() } : {}) };
      });
    } else if (opts.mode === 'missing') {
      if (st.state !== 'missing') continue;
      selected = en.map((_, i) => ({ index: i }));
    } else {
      if (st.state !== 'stale') continue;
      selected = st.sections.flatMap((s, i) => s.state === 'current' ? [] : [{
        index: i, ...(s.old !== null && trSecs[s.old] ? { previous: trSecs[s.old].text.trimEnd() } : {}),
      }]);
      if (selected.length === 0) continue; // alleen verwijderd of verschoven: `apply docs` herschikt zonder agent
    }
    const groups: (typeof selected)[] = [];
    let cur: typeof selected = [];
    let words = 0;
    for (const s of selected) {
      const w = wordCount(en[s.index].text);
      if (cur.length > 0 && words + w > maxWords) { groups.push(cur); cur = []; words = 0; }
      cur.push(s);
      words += w;
    }
    if (cur.length) groups.push(cur);
    groups.forEach((group, gi) => {
      const id = groups.length === 1 ? art.id : `${art.id}-${String(gi + 1).padStart(2, '0')}`;
      const texts = group.map(s => en[s.index].text);
      const src = joinSections(texts);
      const labels: DocsLabel[] = [];
      const sections: DocsSectionMeta[] = group.map(s => {
        const sec: DocSection = en[s.index];
        const r = sectionLabels(s.index, sec.text, opts.index, literals);
        labels.push(...r.labels);
        return { index: s.index, heading: sec.heading, hash: sectionHash(sec.text), words: wordCount(sec.text), labels: labelsDigest(r.keys) };
      });
      const keep = docsLiteralsFor(src, opts.concepts, 'keep');
      const display = (opts.literal.display?.[art.id] ?? []).filter(d => codesOf(src).includes(d));
      const terms = docsTermsFor(src, opts.concepts, opts.termbase);
      const softSet = new Set(opts.literal.avoidSoft?.[opts.lang] ?? []);
      const avoidSoft = [...new Set(terms.flatMap(t => t.avoid ?? []).filter(a => softSet.has(a)))];
      const previous = Object.fromEntries(group.filter(s => s.previous !== undefined).map(s => [String(s.index), s.previous!]));
      const style = opts.termbase?._style;
      out.push({
        src,
        pkg: {
          kind: 'docs', lang: opts.lang, id, article: art.id, part: gi + 1, parts: groups.length, mode: opts.mode,
          ...(style ? { style } : {}),
          terms,
          tokens: docsLiteralsFor(src, opts.concepts, 'token'),
          keep: keep.filter(k => !keepSoft.includes(k)),
          ...(keep.some(k => keepSoft.includes(k)) ? { keepSoft: keep.filter(k => keepSoft.includes(k)) } : {}),
          ...(display.length ? { display } : {}),
          ...(avoidSoft.length ? { avoidSoft } : {}),
          labels,
          ...(Object.keys(previous).length ? { previous } : {}),
          sections,
        },
      });
    });
  }
  return out;
}

// ── Samenvoegen (apply docs) ─────────────────────────────────────────────────────────────────

/**
 * De secties van een `.out.md` bij de secties van zijn pakket: zonder sectie 0 in het pakket moet de
 * uitvoer met een `## `-kop beginnen (een lege sectie 0 valt weg). Null als het aantal niet klopt.
 */
export function outSections(pkg: Pick<DocsPackage, 'sections'>, outMd: string): DocSection[] | { error: string } {
  let secs = splitSections(outMd);
  const hasIntro = pkg.sections.some(s => s.index === 0);
  if (!hasIntro) {
    if (secs[0].text.trim() !== '') return { error: 'tekst vóór de eerste ##-kop: dit pakket begint met een ##-sectie' };
    secs = secs.slice(1);
  }
  if (secs.length !== pkg.sections.length) {
    return { error: `de uitvoer heeft ${secs.length} sectie(s), het pakket ${pkg.sections.length} (laat geen ##-kop weg en voeg er geen toe)` };
  }
  return secs;
}

export interface MergeResult { md: string; entry: DocsSourceEntry; fromPackages: number; kept: number }

/**
 * Voeg de groene pakketten van één artikel samen met de bestaande vertaling. Elke en-sectie komt uit
 * een pakket, of uit de gekoppelde (actuele of nog verouderde) vertaalde sectie; een verouderde sectie
 * zonder pakket houdt zijn oude C3-hash, zodat ze verouderd blijft. Geeft een fout als een sectie
 * nergens vandaan kan komen, of als een pakket op een oudere en-versie gemaakt is.
 */
export function mergeArticle(opts: {
  enMd: string;
  translated?: string;
  entry?: DocsSourceEntry;
  labelHashes: Map<string, string>;
  /** De huidige UI-sleutels met doeltekst-hash van een en-sectie (`sectionLabels(...).keys`). */
  labelsOf: (index: number, text: string) => Record<string, string>;
  packages: { pkg: DocsPackage; out: string }[];
}): MergeResult | { error: string } {
  const en = splitSections(opts.enMd);
  const enHashes = en.map(s => sectionHash(s.text));
  const fromPkg = new Map<number, { text: string; labels: Record<string, string> }>();
  for (const { pkg, out } of opts.packages) {
    const secs = outSections(pkg, out);
    if ('error' in secs) return { error: `${pkg.id}: ${secs.error}` };
    for (const [k, meta] of pkg.sections.entries()) {
      if (enHashes[meta.index] !== meta.hash) return { error: `${pkg.id}: sectie ${meta.index} van de en-bron veranderde na prepare; draai prepare opnieuw` };
      const labels = opts.labelsOf(meta.index, en[meta.index].text);
      if (labelsDigest(labels) !== meta.labels) return { error: `${pkg.id}: een UI-label van sectie ${meta.index} veranderde na prepare; draai prepare opnieuw` };
      fromPkg.set(meta.index, { text: secs[k].text, labels });
    }
  }
  const st = articleState('', opts.enMd, opts.translated, opts.entry, opts.labelHashes);
  const tr = opts.translated !== undefined ? splitSections(opts.translated) : [];
  const texts: string[] = [];
  const sections: DocsSourceEntry['sections'] = [];
  let kept = 0;
  for (let i = 0; i < en.length; i++) {
    const p = fromPkg.get(i);
    if (p) { texts.push(p.text); sections.push({ hash: enHashes[i], labels: p.labels }); continue; }
    const old = st.state === 'missing' ? null : st.sections[i].old;
    if (old === null || !opts.entry || !tr[old]) return { error: `sectie ${i} (${en[i].heading ?? 'inleiding'}) heeft geen vertaling en zit in geen groen pakket` };
    texts.push(tr[old].text);
    sections.push(opts.entry.sections[old]);
    kept++;
  }
  return { md: joinSections(texts), entry: { structure: structureHash(opts.enMd), sections }, fromPackages: fromPkg.size, kept };
}

// ── C2 en C3 ─────────────────────────────────────────────────────────────────────────────────

/** Ids in manifest-volgorde, daarna de rest (wezen) gesorteerd. */
export function orderIds(ids: Iterable<string>, manifestOrder: string[]): string[] {
  const set = new Set(ids);
  const known = manifestOrder.filter(id => set.has(id));
  const rest = [...set].filter(id => !manifestOrder.includes(id)).sort();
  return [...known, ...rest];
}

/** C2: `public/docs/<taal>/index.json`, één regel per artikel in manifest-volgorde, alleen titels. */
export function serializeDocsIndex(titles: Record<string, string>, manifestOrder: string[]): string {
  const ids = orderIds(Object.keys(titles), manifestOrder);
  if (ids.length === 0) return '{}\n';
  return `{\n${ids.map(id => `${JSON.stringify(id)}: {"title": ${JSON.stringify(titles[id])}}`).join(',\n')}\n}\n`;
}

/** Lees C2 terug naar { id: titel }. */
export function parseDocsIndex(text: string): Record<string, string> {
  const raw = JSON.parse(text) as Record<string, { title?: unknown }>;
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(raw)) if (typeof v?.title === 'string') out[id] = v.title;
  return out;
}

/** C3 in manifest-volgorde. */
export function orderDocsSources(src: DocsSources, manifestOrder: string[]): DocsSources {
  const out: DocsSources = {};
  for (const id of orderIds(Object.keys(src), manifestOrder)) out[id] = src[id];
  return out;
}

// ── Hernoemen en verwijderen ─────────────────────────────────────────────────────────────────

/** Vervang `docs://<oud>` (met of zonder `#anker`) door `docs://<nieuw>`. */
export function renameDocLinks(md: string, from: string, to: string): string {
  return md.replace(new RegExp(`docs://${escapeRe(from)}(?=[#)\\s]|$)`, 'g'), `docs://${to}`);
}

/**
 * Werk de C3-hashes bij na een hernoeming: een bewaarde sectiehash die precies de huidige en-sectie
 * is, maar dan met de oude link, wordt de hash van de huidige en-sectie (de vertaling krijgt dezelfde
 * linkwijziging). Ook de structuurhash volgt als die van de oude linkvorm was.
 */
export function renameInEntry(entry: DocsSourceEntry, enMd: string, from: string, to: string): DocsSourceEntry {
  // De en-bron zoals hij vóór de hernoeming was: dezelfde tekst, met de oude link.
  const before = renameDocLinks(enMd, to, from);
  const map = new Map<string, string>();
  const enNow = splitSections(enMd);
  const enOld = splitSections(before);
  if (enNow.length === enOld.length) enNow.forEach((s, i) => map.set(sectionHash(enOld[i].text), sectionHash(s.text)));
  return {
    structure: entry.structure === structureHash(before) ? structureHash(enMd) : entry.structure,
    sections: entry.sections.map(s => ({ ...s, hash: map.get(s.hash) ?? s.hash })),
  };
}

// ── Status en releasepoort ───────────────────────────────────────────────────────────────────

export interface DocsLangStatus { lang: string; missing: number; stale: number; staleSections: number; current: number }

export function docsStatus(lang: string, states: ArticleState[]): DocsLangStatus {
  const s: DocsLangStatus = { lang, missing: 0, stale: 0, staleSections: 0, current: 0 };
  for (const a of states) {
    if (a.state === 'missing') s.missing++;
    else if (a.state === 'stale') { s.stale++; s.staleSections += a.sections.filter(x => x.state !== 'current').length; } else s.current++;
  }
  return s;
}

/** Alle docs-gaten van één taal voor de releasepoort: `docs:<id>` (ontbreekt / alleen herschikt) of `docs:<id>#<sectie>`. */
export function docsReleaseGaps(lang: string, states: ArticleState[]): ReleaseGap[] {
  const gaps: ReleaseGap[] = [];
  for (const a of states) {
    if (a.state === 'current') continue;
    if (a.state === 'missing') { gaps.push({ lang, where: `docs:${a.id}`, state: 'missing' }); continue; }
    const secs = a.sections.flatMap((s, i) => s.state === 'current' ? [] : [i]);
    if (secs.length === 0) gaps.push({ lang, where: `docs:${a.id}`, state: 'stale' });
    for (const i of secs) gaps.push({ lang, where: `docs:${a.id}#${i}`, state: 'stale' });
  }
  return gaps;
}
