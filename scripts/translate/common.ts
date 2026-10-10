// Gedeelde kern van de vertaalstraat (ontwerp: docs/superpowers/specs/2026-10-09-vertaalstraat-design.md).
// Alleen pure functies en typen, zonder bestands-I/O: de tests in tests/planning/check-translate-*.ts
// toetsen ze rechtstreeks, en check.ts bundelt ze tot een zelfstandig bestand (geen node_modules).
import { createHash } from 'node:crypto';
import { pluralCategories, type Json, type JsonObject } from '../i18n-tools';

export { pluralCategories };

// ── Termbase-datamodel (§4.1) ────────────────────────────────────────────────────────────────

export type ConceptKind = 'term' | 'token' | 'keep';
export const CONCEPT_KINDS: readonly ConceptKind[] = ['term', 'token', 'keep'];

export interface Concept {
  id: string;
  kind: ConceptKind;
  nl: string;
  /** Synoniemen: MS Project zegt "slack", P6 en de app zeggen "float". */
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
  /** De aanhalingstekens van de taal voor UI-namen in een zin, bv. `„…“` of `«…»`. */
  quotes?: string;
}

/** Eén taalbestand `i18n/termbase/<taal>.json`: `_style` plus per concept-id een regel. */
export type LangTermbase = { _style?: Style } & { [conceptId: string]: TermEntry | Style | undefined };

export const termEntries = (tb: LangTermbase): [string, TermEntry][] =>
  Object.entries(tb).filter(([k]) => k !== '_style') as [string, TermEntry][];

// ── Talen ────────────────────────────────────────────────────────────────────────────────────

/** De twaalf bestaande doeltalen naast nl/en: daar volgt de termbase eerst de bestaande UI (§4.4). */
export const EXISTING_TARGETS = ['fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;

/**
 * Heeft deze taal een UI-basislijn (`seed-sources`, §9)? Alleen `en` en de bestaande doeltalen.
 * De nieuwe talen (ru, cs, sv, …) staan in de app eerst met Engels als tijdelijke inhoud; daar is
 * alleen een bron-hash (van `apply ui`) het bewijs van een vertaling. Een sleutel zonder hash telt
 * in zo'n taal dus als ontbrekend, ook als er tekst staat.
 */
export const hasUiBaseline = (lang: string): boolean =>
  lang === 'en' || (EXISTING_TARGETS as readonly string[]).includes(lang);

/**
 * Taal → bestand in de Microsoft Terminology Collection. `pt` = Portugal: de bestaande pt-UI is
 * overwegend Europees-Portugees (ficheiro 77×, Guardar, ecrã, Eliminar; alleen de XER-meldingen
 * zeggen "arquivo"). `sr` = Cyrillisch (voorstel B1, nog niet besloten).
 */
export const TBX_FILES: Record<string, string> = {
  fr: 'FRENCH.tbx', de: 'GERMAN.tbx', es: 'SPANISH.tbx', zh: 'CHINESE (SIMPLIFIED).tbx', it: 'ITALIAN.tbx',
  pt: 'PORTUGUESE (PORTUGAL).tbx', pl: 'POLISH.tbx', tr: 'TURKISH.tbx', ar: 'ARABIC.tbx', ja: 'JAPANESE.tbx',
  ko: 'KOREAN.tbx', fa: 'PERSIAN.tbx', ru: 'RUSSIAN.tbx', uk: 'UKRAINIAN.tbx', cs: 'CZECH.tbx', sk: 'SLOVAK.tbx',
  sr: 'SERBIAN (CYRILLIC).tbx', hr: 'CROATIAN.tbx', bg: 'BULGARIAN.tbx', hu: 'HUNGARIAN.tbx', ro: 'ROMANIAN.tbx',
  sv: 'SWEDISH.tbx', nb: 'NORWEGIAN BOKMÅL.tbx', da: 'DANISH.tbx', fi: 'FINNISH.tbx', lo: 'LAO.tbx', nl: 'DUTCH.tbx',
};

// ── UI-eenheden: een gewone sleutel of een hele meervoudsfamilie ─────────────────────────────

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
export const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** Tekst van één eenheid: een string, of { categorie: tekst } voor een meervoudsfamilie. */
export type UnitText = string | Record<string, string>;

export interface Unit { key: string; plural: boolean; text: UnitText }

export const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Alle eenheden van een locale-object, in bestandsvolgorde. Een meervoudsfamilie (`x_one`, `x_other`)
 * wordt één eenheid `x` met { one, other }.
 */
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

/** Alle teksten van een eenheid (één, of alle meervoudsvormen). */
export const textsOf = (t: UnitText): string[] => typeof t === 'string' ? [t] : Object.values(t);

/** Hash van de nl-bron van één eenheid; een familie = één hash over alle vormen in CLDR-volgorde. */
export function hashUnit(t: UnitText): string {
  const canon = typeof t === 'string'
    ? `s:${t}`
    : `p:${JSON.stringify(CATEGORY_ORDER.filter(c => c in t).map(c => [c, t[c]]))}`;
  return createHash('sha256').update(canon, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Is deze eenheid in de doeltaal compleet? Een gewone sleutel: er staat een tekst. Een familie: elke
 * CLDR-categorie van de doeltaal staat er (een halve familie telt als ontbrekend).
 */
export function isComplete(target: Unit | undefined, src: Unit, lang: string): boolean {
  if (!target || target.plural !== src.plural) return false;
  if (!src.plural) return typeof target.text === 'string';
  const t = target.text as Record<string, string>;
  return pluralCategories(lang).every(c => typeof t[c] === 'string');
}

// ── Meervoud: voorbeeldgetallen per categorie (§5.1) ─────────────────────────────────────────

const INTEGER_PROBES = [...Array.from({ length: 201 }, (_, i) => i), 1000, 10000, 100000, 1000000, 2000000];
const DECIMAL_PROBES = [0.5, 1.5, 2.5, 3.5, 5.5, 10.5, 0.1, 1.1, 2.1, 1.25];

/**
 * Voorbeeldgetallen per CLDR-categorie uit `Intl.PluralRules`: tot vier gehele getallen, en een
 * decimaal als een categorie alleen decimalen heeft (cs/sk `many` = 1.5). Zo ziet de agent wat een
 * categorie in díé taal betekent (ru `many` = 0 en 5–20, ro `few` = 0 en 2–19).
 */
export function pluralExamples(lang: string): Record<string, number[]> {
  const rules = new Intl.PluralRules(lang);
  const out: Record<string, number[]> = {};
  for (const cat of pluralCategories(lang)) {
    const ints = INTEGER_PROBES.filter(n => rules.select(n) === cat).slice(0, 4);
    out[cat] = ints.length > 0 ? ints : DECIMAL_PROBES.filter(n => rules.select(n) === cat).slice(0, 2);
  }
  return out;
}

// ── Tekst zoeken ─────────────────────────────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Komt `term` als los woord (of woordgroep) voor in `text`? Hoofdletterongevoelig, met een
 * woordgrens aan beide kanten; een meervoudsuitgang (s, es, en, n) mag erachter ("baselines",
 * "basislijnen").
 */
export function containsTerm(text: string, term: string): boolean {
  if (term.trim() === '') return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?:s|es|en|n)?(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(text);
}

/**
 * De avoid-varianten van één term die in `text` staan (hoofdletterongevoelig, als deeltekst). Een
 * avoid-variant kan in de eigen term zitten ("fri slakk" ⊃ "slakk"): de vormen van de term worden
 * daarom eerst weggestreept, de langste eerst. Dezelfde regel voor de zachte poort en `prepare --avoid`.
 */
export function findAvoid(text: string, forms: string[], avoid: string[]): string[] {
  const rest = forms.map(f => f.toLocaleLowerCase()).filter(f => f !== '').sort((a, b) => b.length - a.length)
    .reduce((s, f) => s.split(f).join('\u0000'), text.toLocaleLowerCase());
  return avoid.filter(a => a.trim() !== '' && rest.includes(a.toLocaleLowerCase()));
}

/** Aantal keer dat een token (hoofdlettergevoelig, los woord) in de tekst staat. */
export function countToken(text: string, token: string): number {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(token)}(?![\\p{L}\\p{N}])`, 'gu');
  return (text.match(re) ?? []).length;
}

/** De `{{invulplekken}}` van een tekst, uniek en gesorteerd (zelfde regel als i18n-tools). */
export const placeholders = (text: string): string[] =>
  [...new Set([...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(m => m[1]))].sort();

/** De `$t(…)`-nestings van een tekst, letterlijk, gesorteerd. */
export const nestings = (text: string): string[] =>
  [...text.matchAll(/\$t\((?:[^()]|\([^()]*\))*\)/g)].map(m => m[0]).sort();

/** Canonieke JSON-tekst (twee spaties, regeleinde) — dezelfde vorm als `serialize` uit i18n-tools. */
export const toJson = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
