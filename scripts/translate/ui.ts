import {
  containsTerm, countToken, avoidWords, escapeRe, hasUiBaseline, hashUnit, isComplete, nestings, placeholders, pluralExamples,
  termEntries, textsOf, uiStyle, unitMap,
  unitsOf, type Concept, type LangTermbase, type Style, type Unit, type UnitText,
} from './common';
import { orderLike, setTranslation, type JsonObject, type Namespace } from '../i18n-tools';

export type UiSources = Record<string, Record<string, string>>;

export interface UiItem {
  key: string;
  plural?: true;
  nl: UnitText;
  en: UnitText;
  previous?: UnitText;
  avoidHits?: string[];
  stale?: true;
  labels?: UiLabel[];
  fixedText?: string;
}

export interface UiLabel { nl: string; keys: string[]; targets: string[] }

export interface UiTerm { id: string; nl: string; en: string[]; target: string; forms: string[]; avoid?: string[]; definition?: string }

export interface UiPackage {
  kind: 'ui';
  lang: string;
  namespace: string;
  id: string;
  mode: Selection | 'avoid' | 'keys';
  reason?: 'avoid';
  style?: Style;
  terms: UiTerm[];
  tokens: string[];
  keep: string[];
  plural?: Record<string, number[]>;
  items: UiItem[];
}

export interface NsInput { ns: Namespace | string; nl: JsonObject; en: JsonObject; target: JsonObject }

export function fixedUiText(lang: string, ns: string, key: string): string | undefined {
  return (lang === 'ar' || lang === 'fa') && ns === 'menu' && key === 'ribbon.calendarDialog.hoursValue'
    ? '{{hours}}h' : undefined;
}

export function uiFixedTextError(lang: string, ns: string, key: string, text: unknown): string | undefined {
  const fixed = fixedUiText(lang, ns, key);
  return fixed !== undefined && text !== fixed
    ? `${ns}:${key}: vaste tekst voor ${lang} moet byte-gelijk ${JSON.stringify(fixed)} zijn; kreeg ${JSON.stringify(text)}`
    : undefined;
}

export type Selection = 'missing' | 'stale' | 'open' | 'all';

export function isTranslated(t: Unit | undefined, u: Unit, lang: string, hashes: Record<string, string>): boolean {
  return isComplete(t, u, lang) && (hasUiBaseline(lang) || hashes[u.key] !== undefined);
}

export function selectUnits(input: NsInput, lang: string, mode: Selection, sources: UiSources): { unit: Unit; previous?: UnitText }[] {
  const target = unitMap(input.target);
  const hashes = sources[input.ns] ?? {};
  const out: { unit: Unit; previous?: UnitText }[] = [];
  for (const u of unitsOf(input.nl)) {
    const t = target.get(u.key);
    const complete = isTranslated(t, u, lang, hashes);
    if (mode === 'all') { out.push({ unit: u }); continue; }
    if (mode === 'missing' || mode === 'open') {
      if (!complete) { out.push({ unit: u }); continue; }
      if (mode === 'missing') continue;
    }
    const h = hashes[u.key];
    if (complete && (h === undefined || h !== hashUnit(u.text))) out.push({ unit: u, previous: t!.text });
  }
  return out;
}

export interface Selected { unit: Unit; previous?: UnitText; avoidHits?: string[]; stale?: true }

export interface AvoidRule { id: string; forms: string[]; avoid: string[] }

export function avoidRules(concepts: Concept[], tb: LangTermbase | undefined): AvoidRule[] {
  if (!tb) return [];
  const isTerm = new Set(concepts.filter(c => c.kind === 'term').map(c => c.id));
  return termEntries(tb)
    .filter(([id, e]) => isTerm.has(id) && (e.avoid?.length ?? 0) > 0)
    .map(([id, e]) => ({ id, forms: e.forms.length ? e.forms : [e.term], avoid: e.avoid! }));
}

export function avoidHitsIn(text: UnitText, rules: AvoidRule[]): { hits: string[]; ids: string[] } {
  const hits: string[] = [];
  const ids: string[] = [];
  for (const r of rules) {
    const found = textsOf(text).flatMap(t => avoidWords(t, r.forms, r.avoid));
    if (found.length === 0) continue;
    ids.push(r.id);
    for (const a of r.avoid) if (found.includes(a) && !hits.includes(a)) hits.push(a);
  }
  return { hits, ids };
}

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

export function selectKeys(input: NsInput, lang: string, keys: Set<string>): Selected[] {
  const target = unitMap(input.target);
  return unitsOf(input.nl).filter(u => keys.has(u.key)).map(u => {
    const t = target.get(u.key);
    return isComplete(t, u, lang) ? { unit: u, previous: t!.text } : { unit: u };
  });
}

export interface LabelEntry extends UiLabel { re: RegExp }

export const LABEL_COMMON_WORD_MAX = 5;

const wordRe = (s: string, flags = 'u') => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(s)}(?![\\p{L}\\p{N}])`, flags);

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
      if (t === '' || t.length > 80 || !/^\p{Lu}/u.test(t) || placeholders(t).length || nestings(t).length) continue;
      const words = t.split(/\s+/).length;
      if (words < 2 && t.length < 10) continue;
      const e = byText.get(t) ?? { keys: [], targets: [] };
      byText.set(t, e);
      e.keys.push(`${input.ns}:${u.key}`);
      const tu = target.get(u.key);
      if (isTranslated(tu, u, lang, hashes) && hashes[u.key] === hashUnit(u.text)
        && typeof tu!.text === 'string' && !e.targets.includes(tu!.text)
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

function midSentence(t: string, re: RegExp): boolean {
  for (const m of t.matchAll(re)) {
    const before = t.slice(0, m.index);
    if (before.trim() !== '' && !/[.!?]\s*$/.test(before)) return true;
  }
  return false;
}

export function labelsFor(key: string, ns: string, nl: UnitText, index: LabelEntry[]): UiLabel[] {
  const texts = textsOf(nl);
  const self = `${ns}:${key}`;
  const found = index.filter(l => !l.keys.includes(self)
    && texts.some(t => t !== l.nl && t.includes(l.nl) && midSentence(t, l.re)));
  return found.filter(l => !found.some(o => o !== l && o.nl.length > l.nl.length && o.nl.includes(l.nl)))
    .map(({ nl: n, keys, targets }) => ({ nl: n, keys, targets }));
}

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
    if (hit) {
      out.push({
        id: c.id, nl: c.nl, en: c.en, target: e.term, forms: e.forms, ...(e.avoid ? { avoid: e.avoid } : {}),
        ...(c.definition ? { definition: c.definition } : {}),
      });
    }
  }
  return out;
}

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

export function buildUiPackages(opts: {
  lang: string;
  inputs: NsInput[];
  mode: Selection;
  sources: UiSources;
  concepts: Concept[];
  termbase?: LangTermbase;
  size?: number;
  maxChars?: number;
  avoid?: boolean;
  keys?: Map<string, Set<string>>;
  only?: Map<string, Set<string>>;
}): UiPackage[] {
  const labelIndex = buildLabelIndex(opts.inputs, opts.lang, opts.sources, avoidRules(opts.concepts, opts.termbase));
  const size = opts.size ?? 150;
  const maxChars = opts.maxChars ?? 24000;
  const packs: UiPackage[] = [];
  const examples = pluralExamples(opts.lang);
  if (opts.avoid && opts.keys) throw new Error('--avoid en --keys gaan niet samen');
  if (opts.only && (opts.keys || opts.avoid)) throw new Error('--only gaat niet samen met --keys of --avoid');
  if (opts.avoid && opts.mode === 'all') throw new Error('--avoid gaat alleen samen met --stale');
  const withStale = opts.avoid === true && opts.mode === 'stale';
  const rules = opts.avoid ? avoidRules(opts.concepts, opts.termbase) : [];
  const mode: UiPackage['mode'] = opts.keys ? 'keys' : opts.avoid && !withStale ? 'avoid' : opts.mode;
  for (const input of opts.inputs) {
    const en = unitMap(input.en);
    const selected: Selected[] = opts.keys
      ? selectKeys(input, opts.lang, opts.keys.get(input.ns) ?? new Set())
      : opts.avoid
        ? selectAvoid(input, opts.lang, opts.sources, rules, withStale)
        : selectUnits(input, opts.lang, opts.mode, opts.sources)
          .filter(s => !opts.only || (opts.only.get(input.ns)?.has(s.unit.key) ?? false));
    const all: UiItem[] = selected.map(({ unit, previous, avoidHits, stale }) => {
      const labels = labelsFor(unit.key, input.ns, unit.text, labelIndex);
      const fixedText = fixedUiText(opts.lang, input.ns, unit.key);
      return {
        key: unit.key,
        ...(unit.plural ? { plural: true as const } : {}),
        nl: unit.text,
        en: en.get(unit.key)?.text ?? unit.text,
        ...(previous !== undefined ? { previous } : {}),
        ...(avoidHits ? { avoidHits } : {}),
        ...(stale ? { stale } : {}),
        ...(labels.length ? { labels } : {}),
        ...(fixedText !== undefined ? { fixedText } : {}),
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

export function packageText(pkg: object): string {
  const lines = Object.entries(pkg).map(([k, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
    ? `  ${JSON.stringify(k)}: [\n${v.map(x => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`
    : `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

export type UiOut = Record<string, UnitText>;

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

export function setSourceHash(sources: UiSources, ns: string, key: string, nlText: UnitText): void {
  (sources[ns] ?? (sources[ns] = {}))[key] = hashUnit(nlText);
}

export function updateSourceHashForAdd(sources: UiSources, lang: string, ns: string, key: string, nlText: UnitText): boolean {
  if (hasUiBaseline(lang)) { setSourceHash(sources, ns, key, nlText); return true; }
  const h = sources[ns];
  if (!h || h[key] === undefined) return false;
  delete h[key];
  return true;
}

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

export interface NsStatus { ns: string; total: number; missing: number; stale: number; current: number; unhashed: number }

export type UnitState = 'missing' | 'stale' | 'unhashed' | 'current';

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

export interface ReleaseGap { lang: string; where: string; state: Exclude<UnitState, 'current'> | 'fixed-text'; detail?: string }

export function uiReleaseGaps(lang: string, inputs: NsInput[], sources: UiSources): ReleaseGap[] {
  return inputs.flatMap(input => {
    const target = unitMap(input.target);
    return uiUnitStates(lang, input, sources).flatMap((u): ReleaseGap[] => {
      const where = `${input.ns}:${u.key}`;
      if (u.state !== 'current') return [{ lang, where, state: u.state }];
      const detail = uiFixedTextError(lang, input.ns, u.key, target.get(u.key)?.text);
      return detail ? [{ lang, where, state: 'fixed-text', detail }] : [];
    });
  });
}
