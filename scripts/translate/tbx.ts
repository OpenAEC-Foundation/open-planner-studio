// Microsoft Terminology Collection (TBX) lezen en per concept kandidaat-termen zoeken (§4.3).
// De TBX blijft lokaal (build/cache/msterms, licentie §13); hier alleen pure functies.
import { containsTerm, textsOf, unitsOf, type Concept, type LangTermbase, type Style } from './common';
import type { JsonObject } from '../i18n-tools';

export interface TbxTarget {
  term: string;
  partOfSpeech?: string;
  gender?: string;
  number?: string;
}

export interface TbxEntry {
  id: string;
  definition?: string;
  en: string[];
  target: TbxTarget[];
}

const decode = (s: string): string => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const TERM_GRP_RE = /<termGrp>([\s\S]*?)<\/termGrp>/g;
const TERM_RE = /<term(?:\s[^>]*)?>([\s\S]*?)<\/term>/;
const NOTE_RE = /<termNote type="([A-Za-z]+)">([\s\S]*?)<\/termNote>/g;

function termsOf(langSet: string): TbxTarget[] {
  const out: TbxTarget[] = [];
  for (const g of langSet.matchAll(TERM_GRP_RE)) {
    const t = g[1].match(TERM_RE);
    if (!t) continue;
    const entry: TbxTarget = { term: decode(t[1]).trim() };
    for (const n of g[1].matchAll(NOTE_RE)) {
      const v = decode(n[2]).trim();
      if (!v || v === 'NotSelected') continue;
      if (n[1] === 'partOfSpeech') entry.partOfSpeech = v;
      else if (n[1] === 'grammaticalGender') entry.gender = v;
      else if (n[1] === 'grammaticalNumber') entry.number = v;
    }
    if (entry.term) out.push(entry);
  }
  return out;
}

/**
 * Lees een TBX-export (één lange XML-regel, tot 45 MB). Per `<termEntry>`: de Engelse definitie en
 * termen uit de `en-US`-langSet, en de termen (met grammaticanoten) uit de andere langSet.
 */
export function parseTbx(xml: string): TbxEntry[] {
  const out: TbxEntry[] = [];
  const entryRe = /<termEntry(?:\s+id="([^"]*)")?[^>]*>([\s\S]*?)<\/termEntry>/g;
  const langSetRe = /<langSet xml:lang="([^"]+)">([\s\S]*?)<\/langSet>/g;
  for (const m of xml.matchAll(entryRe)) {
    const entry: TbxEntry = { id: m[1] ?? '', en: [], target: [] };
    for (const ls of m[2].matchAll(langSetRe)) {
      if (ls[1].toLowerCase() === 'en-us') {
        const def = ls[2].match(/<descrip type="definition">([\s\S]*?)<\/descrip>/);
        if (def) entry.definition = decode(def[1]).trim();
        entry.en.push(...termsOf(ls[2]).map(t => t.term));
      } else {
        entry.target.push(...termsOf(ls[2]));
      }
    }
    if (entry.en.length > 0 && entry.target.length > 0) out.push(entry);
  }
  return out;
}

/** Index: Engelse term (kleine letters) → entries. */
export function indexTbx(entries: TbxEntry[]): Map<string, TbxEntry[]> {
  const idx = new Map<string, TbxEntry[]>();
  for (const e of entries) {
    for (const en of new Set(e.en.map(s => s.toLowerCase()))) {
      const list = idx.get(en);
      if (list) list.push(e); else idx.set(en, [e]);
    }
  }
  return idx;
}

export interface TermCandidate extends TbxTarget { en: string; definition?: string }

/**
 * Alle kandidaten voor één concept: elke TBX-entry waarvan een en-US-term exact (hoofdletter-
 * ongevoelig) gelijk is aan één van de `en`-synoniemen. Dubbele (zelfde term + definitie) vallen weg.
 */
export function candidatesFor(concept: Concept, idx: Map<string, TbxEntry[]>): TermCandidate[] {
  const out: TermCandidate[] = [];
  const seen = new Set<string>();
  for (const en of concept.en) {
    for (const e of idx.get(en.toLowerCase()) ?? []) {
      for (const t of e.target) {
        const k = `${t.term}\u0000${e.definition ?? ''}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ en, ...t, ...(e.definition ? { definition: e.definition } : {}) });
      }
    }
  }
  return out;
}

/** Een bestaande UI-tekst als bewijs voor de gebruikte term (§4.4). */
export interface UiExample { key: string; nl: string; en: string; target: string }

/**
 * De UI-sleutels (max `max`) waarvan de nl- of en-tekst het concept bevat, met de doeltekst.
 * `locales` per namespace: { nl, en, target }.
 */
export function uiExamplesFor(
  concept: Concept,
  locales: { ns: string; nl: JsonObject; en: JsonObject; target: JsonObject }[],
  max = 5,
): UiExample[] {
  const out: UiExample[] = [];
  for (const { ns, nl, en, target } of locales) {
    const enUnits = new Map(unitsOf(en).map(u => [u.key, u]));
    const tUnits = new Map(unitsOf(target).map(u => [u.key, u]));
    for (const u of unitsOf(nl)) {
      if (out.length >= max) return out;
      const e = enUnits.get(u.key);
      const t = tUnits.get(u.key);
      if (!e || !t) continue;
      const nlText = textsOf(u.text)[0];
      const enText = textsOf(e.text)[0];
      const hit = containsTerm(nlText, concept.nl) || concept.en.some(s => containsTerm(enText, s));
      if (!hit) continue;
      const tt = typeof t.text === 'string' ? t.text : (t.text.other ?? textsOf(t.text)[0]);
      out.push({ key: `${ns}:${u.key}`, nl: nlText, en: enText, target: tt });
    }
  }
  return out;
}

export interface TermsPackageConcept {
  id: string;
  kind: 'term';
  nl: string;
  en: string[];
  definition: string;
  candidates: TermCandidate[];
  ui?: UiExample[];
}

export interface TermsPackage {
  kind: 'terms';
  lang: string;
  id: string;
  existingUi: boolean;
  style?: Style;
  concepts: TermsPackageConcept[];
}

/**
 * Pakketten van ±`size` term-concepten (`token`/`keep` gaan niet mee; die worden niet vertaald).
 * `skip`: concepten die al een regel in de termbase hebben. `ui`: voorbeeldteksten per concept
 * (alleen voor de twaalf bestaande talen).
 */
export function buildTermsPackages(opts: {
  lang: string;
  concepts: Concept[];
  idx: Map<string, TbxEntry[]>;
  termbase?: LangTermbase;
  ui?: (c: Concept) => UiExample[];
  size?: number;
}): TermsPackage[] {
  const size = opts.size ?? 40;
  const todo = opts.concepts.filter(c => c.kind === 'term' && !(opts.termbase && c.id in opts.termbase));
  const packs: TermsPackage[] = [];
  for (let i = 0; i < todo.length; i += size) {
    const n = packs.length + 1;
    packs.push({
      kind: 'terms',
      lang: opts.lang,
      id: `terms-${String(n).padStart(2, '0')}`,
      existingUi: opts.ui !== undefined,
      ...(opts.termbase?._style ? { style: opts.termbase._style } : {}),
      concepts: todo.slice(i, i + size).map(c => ({
        id: c.id, kind: 'term', nl: c.nl, en: c.en, definition: c.definition,
        candidates: candidatesFor(c, opts.idx),
        ...(opts.ui ? { ui: opts.ui(c) } : {}),
      })),
    });
  }
  return packs;
}

/** Pakket voor de blinde controle (§4.3 stap 3): alleen de doelterm, geen bron of definitie. */
export interface TermsCheckPackage {
  kind: 'terms-check';
  lang: string;
  id: string;
  items: { id: string; term: string }[];
}
