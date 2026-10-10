// UI-straat: werkpakketten maken (§5.1), samenvoegen (§9), basislijn en status. Pure functies.
import {
  containsTerm, countToken, hasUiBaseline, hashUnit, isComplete, pluralExamples, termEntries, textsOf, unitMap,
  unitsOf, type Concept, type LangTermbase, type Style, type Unit, type UnitText,
} from './common';
import { orderLike, setTranslation, type JsonObject, type Namespace } from '../i18n-tools';

/** Hashes van de nl-bron per namespace en sleutel: `i18n/ui-sources/<taal>.json`. */
export type UiSources = Record<string, Record<string, string>>;

export interface UiItem {
  key: string;
  plural?: true;
  nl: UnitText;
  en: UnitText;
  /** Bij --stale: de huidige (verouderde) vertaling. */
  previous?: UnitText;
}

export interface UiTerm { id: string; nl: string; en: string[]; target: string; forms: string[]; avoid?: string[] }

export interface UiPackage {
  kind: 'ui';
  lang: string;
  namespace: string;
  id: string;
  mode: 'missing' | 'stale' | 'all';
  style?: Style;
  terms: UiTerm[];
  tokens: string[];
  keep: string[];
  plural?: Record<string, number[]>;
  items: UiItem[];
}

/** Per namespace: de nl-, en- en (eventueel lege) doeltekst. */
export interface NsInput { ns: Namespace | string; nl: JsonObject; en: JsonObject; target: JsonObject }

export type Selection = 'missing' | 'stale' | 'all';

/**
 * Is de eenheid in de doeltaal vertaald? Compleet (alle CLDR-categorieën), en in een taal zonder
 * basislijn (`hasUiBaseline`) ook met een bron-hash: daar is tekst zonder hash Engelse vulling.
 */
function isTranslated(t: Unit | undefined, u: Unit, lang: string, hashes: Record<string, string>): boolean {
  return isComplete(t, u, lang) && (hasUiBaseline(lang) || hashes[u.key] !== undefined);
}

/**
 * Welke eenheden moeten vertaald worden? Zie §9 (--missing, --stale). `--stale` neemt ook een vertaalde
 * eenheid zonder bron-hash mee (met de oude tekst als `previous`): `i18n:add` haalt de hash weg in elke
 * taal die het niet schrijft (besluit B5), en in een taal met basislijn blijft de oude tekst dan staan.
 */
export function selectUnits(input: NsInput, lang: string, mode: Selection, sources: UiSources): { unit: Unit; previous?: UnitText }[] {
  const target = unitMap(input.target);
  const hashes = sources[input.ns] ?? {};
  const out: { unit: Unit; previous?: UnitText }[] = [];
  for (const u of unitsOf(input.nl)) {
    const t = target.get(u.key);
    const complete = isTranslated(t, u, lang, hashes);
    if (mode === 'all') { out.push({ unit: u }); continue; }
    if (mode === 'missing') { if (!complete) out.push({ unit: u }); continue; }
    const h = hashes[u.key];
    if (complete && (h === undefined || h !== hashUnit(u.text))) out.push({ unit: u, previous: t!.text });
  }
  return out;
}

/** Termen die in de items voorkomen (nl- of en-term, woordgrens, hoofdletterongevoelig). */
export function termsFor(items: UiItem[], concepts: Concept[], tb: LangTermbase | undefined): UiTerm[] {
  if (!tb) return [];
  const entries = new Map(termEntries(tb));
  const out: UiTerm[] = [];
  for (const c of concepts) {
    if (c.kind !== 'term') continue;
    const e = entries.get(c.id);
    if (!e) continue;
    const hit = items.some(it => textsOf(it.nl).some(t => containsTerm(t, c.nl))
      || textsOf(it.en).some(t => c.en.some(s => containsTerm(t, s))));
    if (hit) out.push({ id: c.id, nl: c.nl, en: c.en, target: e.term, forms: e.forms, ...(e.avoid ? { avoid: e.avoid } : {}) });
  }
  return out;
}

/** Tokens (en `keep`-namen) die letterlijk in de nl-tekst van de items staan. */
export function literalsFor(items: UiItem[], concepts: Concept[], kind: 'token' | 'keep'): string[] {
  const found = new Set<string>();
  for (const c of concepts) {
    if (c.kind !== kind) continue;
    for (const lit of new Set([...c.en, c.nl])) {
      if (items.some(it => textsOf(it.nl).some(t => countToken(t, lit) > 0))) found.add(lit);
    }
  }
  return [...found].sort();
}

/**
 * Maak de UI-pakketten voor één taal: per namespace pakketten van ±`size` items (een meervouds-
 * familie is één item), met alleen de termen/tokens die erin voorkomen.
 */
export function buildUiPackages(opts: {
  lang: string;
  inputs: NsInput[];
  mode: Selection;
  sources: UiSources;
  concepts: Concept[];
  termbase?: LangTermbase;
  size?: number;
  /** Bovengrens voor de tekst van alle items samen (≈ tokens × 3,5); een item wordt nooit geknipt. */
  maxChars?: number;
}): UiPackage[] {
  const size = opts.size ?? 150;
  const maxChars = opts.maxChars ?? 24000;
  const packs: UiPackage[] = [];
  const examples = pluralExamples(opts.lang);
  for (const input of opts.inputs) {
    const en = unitMap(input.en);
    const all: UiItem[] = selectUnits(input, opts.lang, opts.mode, opts.sources).map(({ unit, previous }) => ({
      key: unit.key,
      ...(unit.plural ? { plural: true as const } : {}),
      nl: unit.text,
      en: en.get(unit.key)?.text ?? unit.text,
      ...(previous !== undefined ? { previous } : {}),
    }));
    const groups: UiItem[][] = [];
    let cur: UiItem[] = [];
    let chars = 0;
    for (const it of all) {
      const len = JSON.stringify(it).length;
      if (cur.length > 0 && (cur.length >= size || chars + len > maxChars)) { groups.push(cur); cur = []; chars = 0; }
      cur.push(it);
      chars += len;
    }
    if (cur.length > 0) groups.push(cur);
    groups.forEach((items, i) => {
      const hasPlural = items.some(it => it.plural);
      packs.push({
        kind: 'ui',
        lang: opts.lang,
        namespace: input.ns,
        id: `ui-${input.ns}-${String(i + 1).padStart(2, '0')}`,
        mode: opts.mode,
        ...(opts.termbase?._style ? { style: opts.termbase._style } : {}),
        terms: termsFor(items, opts.concepts, opts.termbase),
        tokens: literalsFor(items, opts.concepts, 'token'),
        keep: literalsFor(items, opts.concepts, 'keep'),
        ...(hasPlural ? { plural: examples } : {}),
        items,
      });
    });
  }
  return packs;
}

/**
 * Bestandstekst van een pakket: velden op eigen regels, maar elk item en elke term op één regel.
 * Scheelt ±30 % witruimte ten opzichte van gewone JSON-opmaak, en blijft leesbaar per sleutel.
 */
export function packageText(pkg: object): string {
  const lines = Object.entries(pkg).map(([k, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
    ? `  ${JSON.stringify(k)}: [\n${v.map(x => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`
    : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** Uitvoer van een UI-agent: per sleutel een tekst of { categorie: tekst }. */
export type UiOut = Record<string, UnitText>;

/**
 * Zet één (groen gekeurd) pakket in het doelobject van zijn namespace (muteert `target`) en werk de
 * bron-hashes bij. Sleutels buiten het pakket blijven onaangeroerd. Geeft het geordende object terug
 * (volgorde van nl).
 */
export function applyUiPackage(pkg: UiPackage, out: UiOut, target: JsonObject, nl: JsonObject, sources: UiSources): JsonObject {
  const hashes = sources[pkg.namespace] ?? (sources[pkg.namespace] = {});
  for (const item of pkg.items) {
    const v = out[item.key];
    if (v === undefined) continue;
    setTranslation(target, item.key, v);
    hashes[item.key] = hashUnit(item.nl);
  }
  return orderLike(target, nl);
}

/** Werk de bron-hash van één sleutel bij (muteert); gebruikt door `i18n:add` voor elke taal die het schrijft. */
export function setSourceHash(sources: UiSources, ns: string, key: string, nlText: UnitText): void {
  (sources[ns] ?? (sources[ns] = {}))[key] = hashUnit(nlText);
}

/**
 * Wat `i18n:add` met de bron-hash van taal `lang` doet. Een taal met basislijn krijgt de nieuwe hash.
 * Een taal zonder basislijn (`hasUiBaseline`) verliest de hash: de tekst komt dan niet uit de straat
 * (vaak Engelse vulling), dus `prepare ui --missing` moet hem opnieuw oppakken. Muteert; geeft terug
 * of er iets veranderde.
 */
export function updateSourceHashForAdd(sources: UiSources, lang: string, ns: string, key: string, nlText: UnitText): boolean {
  if (hasUiBaseline(lang)) { setSourceHash(sources, ns, key, nlText); return true; }
  const h = sources[ns];
  if (!h || h[key] === undefined) return false;
  delete h[key];
  return true;
}

/** Zet de bron-hashes in nl-volgorde (stabiel bestand, conflictarm). */
export function orderSources(sources: UiSources, nlByNs: Record<string, JsonObject>): UiSources {
  const out: UiSources = {};
  for (const [ns, nl] of Object.entries(nlByNs)) {
    const h = sources[ns];
    if (!h) continue;
    const o: Record<string, string> = {};
    for (const u of unitsOf(nl)) if (h[u.key] !== undefined) o[u.key] = h[u.key];
    for (const k of Object.keys(h)) if (!(k in o)) o[k] = h[k];
    out[ns] = o;
  }
  for (const ns of Object.keys(sources)) if (!(ns in out)) out[ns] = sources[ns];
  return out;
}

/** Basislijn (§9): de huidige nl-hash voor elke eenheid die in de doeltaal compleet is. */
export function seedSources(lang: string, inputs: NsInput[]): UiSources {
  const out: UiSources = {};
  for (const { ns, nl, target } of inputs) {
    const t = unitMap(target);
    const h: Record<string, string> = {};
    for (const u of unitsOf(nl)) if (isComplete(t.get(u.key), u, lang)) h[u.key] = hashUnit(u.text);
    out[ns] = h;
  }
  return out;
}

export interface NsStatus { ns: string; total: number; missing: number; stale: number; current: number; unhashed: number }

/** Toestand van één eenheid in de doeltaal: wat de straat (en de releasepoort) ervan vindt. */
export type UnitState = 'missing' | 'stale' | 'unhashed' | 'current';

/**
 * Toestand per eenheid, in nl-volgorde. `missing`: niet (volledig) vertaald, of in een taal zonder
 * basislijn (`hasUiBaseline`) tekst zonder hash (Engelse vulling). `stale`: de nl-hash veranderde.
 * `unhashed`: vertaald, maar zonder bron-hash (bv. een sleutel die `i18n:add` niet schreef, besluit B5).
 */
export function uiUnitStates(lang: string, input: NsInput, sources: UiSources): { key: string; state: UnitState }[] {
  const t = unitMap(input.target);
  const hashes = sources[input.ns] ?? {};
  return unitsOf(input.nl).map(u => {
    if (!isTranslated(t.get(u.key), u, lang, hashes)) return { key: u.key, state: 'missing' as const };
    const h = hashes[u.key];
    if (h === undefined) return { key: u.key, state: 'unhashed' as const };
    return { key: u.key, state: h !== hashUnit(u.text) ? 'stale' as const : 'current' as const };
  });
}

/**
 * Status per namespace. `unhashed` = vertaald, maar zonder bron-hash; die telt als actueel, maar wordt
 * apart genoemd: `prepare ui --stale` pakt hem op, en de releasepoort (`status --strict`) laat hem niet
 * door. In een taal zonder basislijn telt tekst zonder hash als ontbrekend (Engelse vulling).
 */
export function uiStatus(lang: string, inputs: NsInput[], sources: UiSources): NsStatus[] {
  return inputs.map(input => {
    const s: NsStatus = { ns: input.ns, total: 0, missing: 0, stale: 0, current: 0, unhashed: 0 };
    for (const { state } of uiUnitStates(lang, input, sources)) {
      s.total++;
      if (state === 'missing') s.missing++;
      else if (state === 'stale') s.stale++;
      else { s.current++; if (state === 'unhashed') s.unhashed++; }
    }
    return s;
  });
}

/** Eén gat voor de releasepoort: een UI-eenheid (en later een docssectie) die niet bij is. */
export interface ReleaseGap { lang: string; where: string; state: Exclude<UnitState, 'current'> }

/** Alle UI-gaten van één taal voor de releasepoort (`translate status --strict`, besluit B5). */
export function uiReleaseGaps(lang: string, inputs: NsInput[], sources: UiSources): ReleaseGap[] {
  return inputs.flatMap(input => uiUnitStates(lang, input, sources)
    .filter((u): u is { key: string; state: ReleaseGap['state'] } => u.state !== 'current')
    .map(u => ({ lang, where: `${input.ns}:${u.key}`, state: u.state })));
}
