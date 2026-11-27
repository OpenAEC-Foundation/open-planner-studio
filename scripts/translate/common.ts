import { createHash } from 'node:crypto';
import { pluralCategories, type Json, type JsonObject } from '../i18n-tools';

export { pluralCategories };

export type ConceptKind = 'term' | 'token' | 'keep';
export const CONCEPT_KINDS: readonly ConceptKind[] = ['term', 'token', 'keep'];

export interface Concept {
  id: string;
  kind: ConceptKind;
  nl: string;
  en: string[];
  enBySource?: Record<string, string>;
  definition: string;
  seeAlso?: string[];
}

export type TermStatus = 'tbx' | 'tbx-chosen' | 'existing-ui' | 'model' | 'arbitrated';
export const TERM_STATUSES: readonly TermStatus[] = ['tbx', 'tbx-chosen', 'existing-ui', 'model', 'arbitrated'];

export interface TermEntry {
  term: string;
  forms: string[];
  avoid?: string[];
  source: string;
  status: TermStatus;
}

export interface Style {
  address: 'formal' | 'informal';
  note?: string;
  commands?: string;
  quotes?: string;
  docs?: string;
}

export type LangTermbase = { _style?: Style } & { [conceptId: string]: TermEntry | Style | undefined };

export function uiStyle(s: Style | undefined): Style | undefined {
  if (!s) return undefined;
  const { docs: _docs, ...rest } = s;
  return rest;
}

export const termEntries = (tb: LangTermbase): [string, TermEntry][] =>
  Object.entries(tb).filter(([k]) => k !== '_style') as [string, TermEntry][];

export const EXISTING_TARGETS = ['fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'lo', 'fa'] as const;

export const UI_BASELINE = [
  ...EXISTING_TARGETS, 'ru', 'uk', 'cs', 'sk', 'sr', 'hr', 'bg', 'hu', 'ro', 'sv', 'nb', 'da', 'fi',
] as const;

export const hasUiBaseline = (lang: string): boolean =>
  lang === 'en' || (UI_BASELINE as readonly string[]).includes(lang);

export const TBX_FILES: Record<string, string> = {
  fr: 'FRENCH.tbx', de: 'GERMAN.tbx', es: 'SPANISH.tbx', zh: 'CHINESE (SIMPLIFIED).tbx', it: 'ITALIAN.tbx',
  pt: 'PORTUGUESE (PORTUGAL).tbx', pl: 'POLISH.tbx', tr: 'TURKISH.tbx', ar: 'ARABIC.tbx', ja: 'JAPANESE.tbx',
  ko: 'KOREAN.tbx', fa: 'PERSIAN.tbx', ru: 'RUSSIAN.tbx', uk: 'UKRAINIAN.tbx', cs: 'CZECH.tbx', sk: 'SLOVAK.tbx',
  sr: 'SERBIAN (CYRILLIC).tbx', hr: 'CROATIAN.tbx', bg: 'BULGARIAN.tbx', hu: 'HUNGARIAN.tbx', ro: 'ROMANIAN.tbx',
  sv: 'SWEDISH.tbx', nb: 'NORWEGIAN BOKMÅL.tbx', da: 'DANISH.tbx', fi: 'FINNISH.tbx', lo: 'LAO.tbx', nl: 'DUTCH.tbx',
};

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
export const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

export type UnitText = string | Record<string, string>;

export interface Unit { key: string; plural: boolean; text: UnitText }

export const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function unitsOf(obj: JsonObject, prefix = ''): Unit[] {
  const out: Unit[] = [];
  const families = new Map<string, Unit>();
  for (const [k, v] of Object.entries(obj)) {
    if (isObject(v)) { out.push(...unitsOf(v, `${prefix}${k}.`)); continue; }
    if (typeof v !== 'string') continue;
    const m = k.match(PLURAL_SUFFIX);
    if (m) {
      const key = `${prefix}${k.slice(0, -m[0].length)}`;
      let fam = families.get(key);
      if (!fam) { fam = { key, plural: true, text: {} }; families.set(key, fam); out.push(fam); }
      (fam.text as Record<string, string>)[m[1]] = v;
      continue;
    }
    out.push({ key: `${prefix}${k}`, plural: false, text: v });
  }
  return out;
}

export const unitMap = (obj: JsonObject): Map<string, Unit> => new Map(unitsOf(obj).map(u => [u.key, u]));

export const textsOf = (t: UnitText): string[] => typeof t === 'string' ? [t] : Object.values(t);

export function hashUnit(t: UnitText): string {
  const canon = typeof t === 'string'
    ? `s:${t}`
    : `p:${JSON.stringify(CATEGORY_ORDER.filter(c => c in t).map(c => [c, t[c]]))}`;
  return createHash('sha256').update(canon, 'utf8').digest('hex').slice(0, 16);
}

export function isComplete(target: Unit | undefined, src: Unit, lang: string): boolean {
  if (!target || target.plural !== src.plural) return false;
  if (!src.plural) return typeof target.text === 'string';
  const t = target.text as Record<string, string>;
  return pluralCategories(lang).every(c => typeof t[c] === 'string');
}

const INTEGER_PROBES = [...Array.from({ length: 201 }, (_, i) => i), 1000, 10000, 100000, 1000000, 2000000];
const DECIMAL_PROBES = [0.5, 1.5, 2.5, 3.5, 5.5, 10.5, 0.1, 1.1, 2.1, 1.25];

export function pluralExamples(lang: string): Record<string, number[]> {
  const rules = new Intl.PluralRules(lang);
  const out: Record<string, number[]> = {};
  for (const cat of pluralCategories(lang)) {
    const ints = INTEGER_PROBES.filter(n => rules.select(n) === cat).slice(0, 4);
    out[cat] = ints.length > 0 ? ints : DECIMAL_PROBES.filter(n => rules.select(n) === cat).slice(0, 2);
  }
  return out;
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function containsTerm(text: string, term: string): boolean {
  if (term.trim() === '') return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?:s|es|en|n)?(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(text);
}

export const NO_SPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}]/u;
export const ARABIC = /\p{Script=Arabic}/u;
export const L = '\\p{L}\\p{M}\\p{N}';

export function hasWord(text: string, word: string): boolean {
  const w = word.trim();
  if (w === '') return false;
  if (NO_SPACE.test(w)) return text.toLocaleLowerCase().includes(w.toLocaleLowerCase());
  return new RegExp(`(?<![${L}])${escapeRe(w)}(?![${L}])`, 'iu').test(text);
}

export function avoidWords(text: string, forms: string[], avoid: string[]): string[] {
  const rest = forms.map(f => f.trim()).filter(f => f !== '').sort((a, b) => b.length - a.length)
    .reduce((s, f) => (NO_SPACE.test(f) || ARABIC.test(f)
      ? s.split(f.toLocaleLowerCase()).join(' \u0000 ')
      : s.replace(new RegExp(`(?<![${L}])${escapeRe(f.toLocaleLowerCase())}(?![${L}])`, 'gu'), ' \u0000 ')), text.toLocaleLowerCase());
  return avoid.filter(a => hasWord(rest, a));
}

export function countToken(text: string, token: string): number {
  const edge = (c: string) => /\p{Script=Latin}/u.test(c) ? '\\p{Script=Latin}\\p{N}' : '\\p{L}\\p{N}';
  const re = new RegExp(`(?<![${edge(token[0] ?? '')}])${escapeRe(token)}(?![${edge(token.at(-1) ?? '')}])`, 'gu');
  return (text.match(re) ?? []).length;
}

export const placeholders = (text: string): string[] =>
  [...new Set([...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(m => m[1]))].sort();

export const nestings = (text: string): string[] =>
  [...text.matchAll(/\$t\((?:[^()]|\([^()]*\))*\)/g)].map(m => m[0]).sort();

export const toJson = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
