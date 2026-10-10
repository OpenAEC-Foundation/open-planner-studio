// UI-straat: werkpakketten maken (§5.1), samenvoegen (§9), basislijn en status. Pure functies.
import {
  containsTerm, countToken, findAvoid, hasUiBaseline, hashUnit, isComplete, nestings, placeholders, pluralExamples,
  termEntries, textsOf, uiStyle, unitMap,
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
  /** Bij --stale, --avoid en --keys: de huidige vertaling. */
  previous?: UnitText;
  /** Bij --avoid: de avoid-varianten (uit `terms[].avoid`) die in `previous` staan. */
  avoidHits?: string[];
  /** Bij --avoid: de nl-tekst veranderde ook sinds `previous` (of er is geen bron-hash). */
  stale?: true;
  /** Andere UI-teksten die letterlijk in `nl` staan (een knop, tab of blok): zie `labelsFor`. */
  labels?: UiLabel[];
}

/**
 * Een UI-naam in een tekst: de nl-tekst van één of meer andere sleutels (`ns:pad`), met hun huidige
 * doeltekst(en). De poort eist dat één van `targets` letterlijk in de vertaling staat; is er nog geen
 * doeltekst, dan alleen een waarschuwing.
 */
export interface UiLabel { nl: string; keys: string[]; targets: string[] }

export interface UiTerm { id: string; nl: string; en: string[]; target: string; forms: string[]; avoid?: string[] }

export interface UiPackage {
  kind: 'ui';
  lang: string;
  namespace: string;
  id: string;
  /** De selectie; `avoid` = alleen `--avoid`, `keys` = `--keys <bestand>`. */
  mode: Selection | 'avoid' | 'keys';
  /** `avoid`: herschrijf alleen de woorden in `avoidHits` (opdracht `prompts/ui-termfix.md`). */
  reason?: 'avoid';
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

/** Een geselecteerde eenheid met wat het pakket erover meekrijgt. */
export interface Selected { unit: Unit; previous?: UnitText; avoidHits?: string[]; stale?: true }

export interface AvoidRule { id: string; forms: string[]; avoid: string[] }

/**
 * Per term uit de termbase met `avoid`: het concept-id, de vormen en de avoid-varianten. Alleen
 * concepten van soort `term` (dezelfde verzameling als `termsFor`).
 */
export function avoidRules(concepts: Concept[], tb: LangTermbase | undefined): AvoidRule[] {
  if (!tb) return [];
  const isTerm = new Set(concepts.filter(c => c.kind === 'term').map(c => c.id));
  return termEntries(tb)
    .filter(([id, e]) => isTerm.has(id) && (e.avoid?.length ?? 0) > 0)
    .map(([id, e]) => ({ id, forms: e.forms.length ? e.forms : [e.term], avoid: e.avoid! }));
}

/** De avoid-varianten in een (vertaalde) eenheid, uniek, in termbase-volgorde, met de concept-id's. */
export function avoidHitsIn(text: UnitText, rules: AvoidRule[]): { hits: string[]; ids: string[] } {
  const hits: string[] = [];
  const ids: string[] = [];
  for (const r of rules) {
    const found = textsOf(text).flatMap(t => findAvoid(t, r.forms, r.avoid));
    if (found.length === 0) continue;
    ids.push(r.id);
    for (const a of r.avoid) if (found.includes(a) && !hits.includes(a)) hits.push(a);
  }
  return { hits, ids };
}

/**
 * `--avoid` (eventueel samen met `--stale`): de vertaalde eenheden waarvan de tekst een avoid-variant
 * van een term bevat, met de huidige tekst als `previous` en de gevonden varianten als `avoidHits`.
 * Is zo'n eenheid ook verouderd of zonder hash, dan krijgt hij `stale: true`: de agent past dan ook de
 * nieuwe nl toe, want `apply ui` zet daarna de actuele nl-hash. Met `withStale` komen de verouderde
 * eenheden (zoals bij `--stale`) erbij, in nl-volgorde.
 */
export function selectAvoid(input: NsInput, lang: string, sources: UiSources, rules: AvoidRule[], withStale: boolean): Selected[] {
  const target = unitMap(input.target);
  const hashes = sources[input.ns] ?? {};
  const out: Selected[] = [];
  for (const u of unitsOf(input.nl)) {
    const t = target.get(u.key);
    if (!isTranslated(t, u, lang, hashes)) continue;
    const h = hashes[u.key];
    const stale = h === undefined || h !== hashUnit(u.text);
    const { hits } = avoidHitsIn(t!.text, rules);
    if (hits.length === 0 && !(withStale && stale)) continue;
    out.push({ unit: u, previous: t!.text, ...(hits.length ? { avoidHits: hits } : {}), ...(stale ? { stale: true as const } : {}) });
  }
  return out;
}

/**
 * Lees een `--keys`-lijst (`["ns:pad", …]`) tegen de nl-bron. Een sleutel van een meervoudsvorm
 * (`ns:pad_one`) telt als de hele familie. Geeft per namespace de eenheid-sleutels terug, en de fouten
 * (geen lijst, ongeldige regel, onbekende namespace of sleutel).
 */
export function resolveKeyList(list: unknown, nlByNs: Record<string, JsonObject>): { keys: Map<string, Set<string>>; errors: string[] } {
  const keys = new Map<string, Set<string>>();
  const errors: string[] = [];
  if (!Array.isArray(list)) return { keys, errors: ['--keys: verwacht een JSON-lijst ["ns:sleutel", …]'] };
  const units = new Map(Object.entries(nlByNs).map(([ns, nl]) => [ns, unitMap(nl)]));
  for (const entry of list as unknown[]) {
    const m = typeof entry === 'string' ? entry.match(/^([a-z]+):(.+)$/) : null;
    if (!m) { errors.push(`--keys: ongeldige regel ${JSON.stringify(entry)} (verwacht "ns:sleutel")`); continue; }
    const [, ns, path] = m;
    const nsUnits = units.get(ns);
    if (!nsUnits) { errors.push(`--keys: onbekende namespace "${ns}" in ${String(entry)}`); continue; }
    const key = nsUnits.has(path) ? path : path.replace(/_(zero|one|two|few|many|other)$/, '');
    if (!nsUnits.has(key)) { errors.push(`--keys: ${String(entry)} staat niet in nl`); continue; }
    let set = keys.get(ns);
    if (!set) { set = new Set(); keys.set(ns, set); }
    set.add(key);
  }
  return { keys, errors };
}

/** `--keys`: precies deze eenheden, in nl-volgorde; met de huidige vertaling als `previous` als die er is. */
export function selectKeys(input: NsInput, lang: string, keys: Set<string>): Selected[] {
  const target = unitMap(input.target);
  return unitsOf(input.nl).filter(u => keys.has(u.key)).map(u => {
    const t = target.get(u.key);
    return isComplete(t, u, lang) ? { unit: u, previous: t!.text } : { unit: u };
  });
}

// ── Labels: UI-namen die een andere tekst letterlijk noemt ──────────────────────────────────

/** Eén mogelijk label: een nl-tekst met de sleutels die hem dragen en hun huidige doelteksten. */
export interface LabelEntry extends UiLabel { re: RegExp }

/** Hoe vaak een los woord in andere nl-teksten mag staan voor het nog als label telt. */
export const LABEL_COMMON_WORD_MAX = 5;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (s: string, flags = 'u') => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(s)}(?![\\p{L}\\p{N}])`, flags);

/**
 * Alle mogelijke labels over alle namespaces. Een label is een gewone (geen meervouds)tekst zonder
 * invulplekken of `$t(…)`, die met een hoofdletter begint, van ten minste twee woorden of tien tekens. Eén los woord dat in meer dan
 * `LABEL_COMMON_WORD_MAX` andere nl-teksten staat ("Instellingen") telt niet: dat is gewone taal. De
 * doeltekst telt alleen als de eenheid vertaald is (`isTranslated`; in een nieuwe taal is tekst zonder
 * hash Engelse vulling) en geen avoid-variant uit de termbase bevat (`rules`).
 */
export function buildLabelIndex(inputs: NsInput[], lang: string, sources: UiSources, rules: AvoidRule[] = []): LabelEntry[] {
  const byText = new Map<string, { keys: string[]; targets: string[] }>();
  const allNl: string[] = [];
  for (const input of inputs) {
    const target = unitMap(input.target);
    const hashes = sources[input.ns] ?? {};
    for (const u of unitsOf(input.nl)) {
      allNl.push(...textsOf(u.text));
      if (u.plural || typeof u.text !== 'string') continue;
      const t = u.text.trim();
      // Een UI-naam begint in nl met een hoofdletter; "groter dan" of "niet berekend" is gewone taal.
      if (t === '' || t.length > 80 || !/^\p{Lu}/u.test(t) || placeholders(t).length || nestings(t).length) continue;
      const words = t.split(/\s+/).length;
      if (words < 2 && t.length < 10) continue;
      const e = byText.get(t) ?? { keys: [], targets: [] };
      byText.set(t, e);
      e.keys.push(`${input.ns}:${u.key}`);
      const tu = target.get(u.key);
      // Een doeltekst met een avoid-variant verandert zelf nog (`--avoid`): die eisen we niet af.
      if (isTranslated(tu, u, lang, hashes) && typeof tu!.text === 'string' && !e.targets.includes(tu!.text)
        && avoidHitsIn(tu!.text, rules).hits.length === 0) e.targets.push(tu!.text);
    }
  }
  const out: LabelEntry[] = [];
  for (const [nl, e] of byText) {
    if (!/\s/.test(nl)) {
      const ci = wordRe(nl, 'iu');
      if (allNl.filter(x => x !== nl && ci.test(x)).length > LABEL_COMMON_WORD_MAX) continue;
    }
    out.push({ nl, keys: e.keys, targets: e.targets, re: wordRe(nl, 'gu') });
  }
  return out;
}

/** Staat het label midden in de tekst? Aan het begin van de tekst of een zin is de hoofdletter gewone spelling. */
function midSentence(t: string, re: RegExp): boolean {
  for (const m of t.matchAll(re)) {
    const before = t.slice(0, m.index);
    if (before.trim() !== '' && !/[.!?]\s*$/.test(before)) return true;
  }
  return false;
}

/**
 * De labels die letterlijk (hoofdlettergevoelig, als los woord of woordgroep, niet aan het begin van
 * een zin) in de nl-tekst van een eenheid staan, zonder de eenheid zelf. Valt een gevonden label binnen een langer gevonden label
 * ("Projectinfo" in "Bestand → Projectinfo"), dan telt alleen het langste.
 */
export function labelsFor(key: string, ns: string, nl: UnitText, index: LabelEntry[]): UiLabel[] {
  const texts = textsOf(nl);
  const self = `${ns}:${key}`;
  const found = index.filter(l => !l.keys.includes(self)
    && texts.some(t => t !== l.nl && t.includes(l.nl) && midSentence(t, l.re)));
  return found.filter(l => !found.some(o => o !== l && o.nl.length > l.nl.length && o.nl.includes(l.nl)))
    .map(({ nl: n, keys, targets }) => ({ nl: n, keys, targets }));
}

/** Termen die in de items voorkomen (nl- of en-term, woordgrens, hoofdletterongevoelig). */
export function termsFor(items: UiItem[], concepts: Concept[], tb: LangTermbase | undefined, extraIds: ReadonlySet<string> = new Set()): UiTerm[] {
  if (!tb) return [];
  const entries = new Map(termEntries(tb));
  const out: UiTerm[] = [];
  for (const c of concepts) {
    if (c.kind !== 'term') continue;
    const e = entries.get(c.id);
    if (!e) continue;
    const hit = extraIds.has(c.id) || items.some(it => textsOf(it.nl).some(t => containsTerm(t, c.nl))
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
  /** `--avoid`: alleen eenheden met een avoid-variant (met `mode: 'stale'` ook de verouderde erbij). */
  avoid?: boolean;
  /** `--keys`: per namespace precies deze eenheden (uit `resolveKeyList`); `mode` telt dan niet. */
  keys?: Map<string, Set<string>>;
}): UiPackage[] {
  const labelIndex = buildLabelIndex(opts.inputs, opts.lang, opts.sources, avoidRules(opts.concepts, opts.termbase));
  const size = opts.size ?? 150;
  const maxChars = opts.maxChars ?? 24000;
  const packs: UiPackage[] = [];
  const examples = pluralExamples(opts.lang);
  if (opts.avoid && opts.keys) throw new Error('--avoid en --keys gaan niet samen');
  if (opts.avoid && opts.mode === 'all') throw new Error('--avoid gaat alleen samen met --stale');
  // Bij --avoid zonder --stale telt `mode` niet ('missing' is alleen de standaard van de CLI).
  const withStale = opts.avoid === true && opts.mode === 'stale';
  const rules = opts.avoid ? avoidRules(opts.concepts, opts.termbase) : [];
  const mode: UiPackage['mode'] = opts.keys ? 'keys' : opts.avoid && !withStale ? 'avoid' : opts.mode;
  for (const input of opts.inputs) {
    const en = unitMap(input.en);
    const selected: Selected[] = opts.keys
      ? selectKeys(input, opts.lang, opts.keys.get(input.ns) ?? new Set())
      : opts.avoid
        ? selectAvoid(input, opts.lang, opts.sources, rules, withStale)
        : selectUnits(input, opts.lang, opts.mode, opts.sources);
    const all: UiItem[] = selected.map(({ unit, previous, avoidHits, stale }) => {
      const labels = labelsFor(unit.key, input.ns, unit.text, labelIndex);
      return {
        key: unit.key,
        ...(unit.plural ? { plural: true as const } : {}),
        nl: unit.text,
        en: en.get(unit.key)?.text ?? unit.text,
        ...(previous !== undefined ? { previous } : {}),
        ...(avoidHits ? { avoidHits } : {}),
        ...(stale ? { stale } : {}),
        ...(labels.length ? { labels } : {}),
      };
    });
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
      // Bij --avoid gaan ook de termen mee waarvan alleen de avoid-variant in de vertaling staat.
      const hitIds = new Set(items.flatMap(it => it.previous !== undefined && it.avoidHits ? avoidHitsIn(it.previous, rules).ids : []));
      packs.push({
        kind: 'ui',
        lang: opts.lang,
        namespace: input.ns,
        id: `ui-${input.ns}-${String(i + 1).padStart(2, '0')}`,
        mode,
        ...(opts.avoid ? { reason: 'avoid' as const } : {}),
        ...(opts.termbase?._style ? { style: uiStyle(opts.termbase._style) } : {}),
        terms: termsFor(items, opts.concepts, opts.termbase, hitIds),
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
