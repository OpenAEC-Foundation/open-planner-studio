// De kern achter `npm run i18n:fmt`, `i18n:add` en `i18n:resolve` — pure functies, zonder bestands-I/O,
// zodat tests/planning/check-i18n-tools.ts ze rechtstreeks kan toetsen.
//
// Waarom dit bestaat: elke zichtbare tekst moet in dezelfde wijziging in alle 14 locales (besluit
// werkwijze 2026-09). Met de hand betekende dat 14 bestanden openen, in 25 van de 56 met een andere
// sleutelvolgorde dan het Nederlands, en in zes talen 70 kolomnamen op één regel van ~2.600 tekens
// — waar twee gelijktijdige wijzigingen altijd een conflict over de hele regel gaven.
//
// Twee afspraken, allebei afgeleid van `nl` (de bron):
//  1. OPMAAK — één sleutel per regel (JSON met twee spaties inspringing), in precies de volgorde van
//     `nl`; een meervoudsfamilie staat op de plek van haar `nl`-familie, met de categorieën van de
//     eigen taal in CLDR-volgorde (zero, one, two, few, many, other). Sleutels die `nl` niet kent,
//     blijven achteraan in hun object staan (verify:i18n meldt ontbrekende, dit script gooit niets weg).
//  2. TOEVOEGEN — een tekst gaat in één handeling in alle 14 locales, met per taal de CLDR-
//     categorieën en dezelfde {{invulplekken}} als `nl`; anders weigert het script.

export const NAMESPACES = ['common', 'task', 'report', 'menu'] as const;
export type Namespace = typeof NAMESPACES[number];

export const LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;
export type Locale = typeof LOCALES[number];

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const isObject = (v: Json | undefined): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** De CLDR-meervoudscategorieën van een taal, in vaste volgorde. */
export function pluralCategories(locale: string): string[] {
  const cats = new Set<string>(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  return CATEGORY_ORDER.filter(c => cats.has(c));
}

const stemOf = (key: string): string | null => {
  const m = key.match(PLURAL_SUFFIX);
  return m ? key.slice(0, -m[0].length) : null;
};

/**
 * Orden `target` naar de sleutelvolgorde van `order` (de nl-bron), recursief. Meervoudsfamilies
 * worden per stam gegroepeerd; wat `order` niet kent, komt achteraan in de volgorde van `target`.
 */
export function orderLike(target: JsonObject, order: JsonObject): JsonObject {
  const out: JsonObject = {};
  const emittedStems = new Set<string>();
  const familyOf = (stem: string) => Object.keys(target)
    .filter(k => stemOf(k) === stem)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.slice(stem.length + 1) as never)
      - CATEGORY_ORDER.indexOf(b.slice(stem.length + 1) as never));

  for (const key of Object.keys(order)) {
    const stem = stemOf(key);
    if (stem !== null) {
      if (emittedStems.has(stem)) continue;
      emittedStems.add(stem);
      for (const k of familyOf(stem)) out[k] = target[k];
      continue;
    }
    if (!has(target, key)) continue;
    const value = target[key];
    const ref = order[key];
    out[key] = isObject(value) && isObject(ref) ? orderLike(value, ref) : value;
  }
  for (const key of Object.keys(target)) {
    if (has(out, key)) continue;
    const stem = stemOf(key);
    if (stem !== null && emittedStems.has(stem)) continue;
    out[key] = target[key];
  }
  return out;
}

/** De canonieke bestandstekst: één sleutel per regel, twee spaties, afsluitende regeleinde. */
export function serialize(obj: JsonObject): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Canonieke tekst van één locale-bestand, geordend naar de nl-versie van dezelfde namespace. */
export function formatLocale(source: string, nlSource: string): string {
  return serialize(orderLike(JSON.parse(source) as JsonObject, JSON.parse(nlSource) as JsonObject));
}

const placeholders = (text: string): string[] =>
  [...new Set([...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(m => m[1]))].sort();

/** Eén vertaling: gewone tekst, of een meervoudsfamilie { categorie: tekst }. */
export type Translation = string | Record<string, string>;

/**
 * Controleer een set vertalingen vóór het schrijven. Levert een lijst fouten (leeg = goed):
 * alle 14 locales aanwezig en niets extra; overal hetzelfde soort (tekst óf familie); bij een familie
 * per taal exact de CLDR-categorieën; en overal dezelfde {{invulplekken}} als nl — behalve
 * `{{count}}`, dat een meervoudsvorm in woorden mag uitschrijven (Arabisch "مهمة واحدة").
 */
export function validateTranslations(input: Record<string, Translation>): string[] {
  const errors: string[] = [];
  for (const loc of LOCALES) if (!has(input, loc)) errors.push(`${loc}: ontbreekt`);
  for (const loc of Object.keys(input)) {
    if (!(LOCALES as readonly string[]).includes(loc)) errors.push(`${loc}: onbekende locale`);
  }
  const nl = input.nl;
  if (nl === undefined) return errors;
  const plural = typeof nl !== 'string';
  const nlForms = typeof nl === 'string' ? [nl] : Object.values(nl);
  const nlVars = placeholders(nlForms.join(' '));
  for (const loc of LOCALES) {
    const value = input[loc];
    if (value === undefined) continue;
    if ((typeof value === 'string') === plural) {
      errors.push(`${loc}: ${plural ? 'verwacht meervoudsvormen { categorie: tekst }' : 'verwacht één tekst, geen meervoudsvormen'}`);
      continue;
    }
    if (typeof value === 'string') {
      if (value.trim() === '') errors.push(`${loc}: lege tekst`);
      const got = placeholders(value);
      if (got.join() !== nlVars.join()) errors.push(`${loc}: invulplekken {{${got.join('}}, {{')}}} ≠ nl {{${nlVars.join('}}, {{')}}}`);
      continue;
    }
    const want = pluralCategories(loc);
    const got = Object.keys(value);
    const missing = want.filter(c => !got.includes(c));
    const extra = got.filter(c => !want.includes(c));
    if (missing.length || extra.length) {
      errors.push(`${loc}: meervoudsvormen moeten precies [${want.join(', ')}] zijn`
        + `${missing.length ? ` — ontbreekt ${missing.join(', ')}` : ''}${extra.length ? ` — overbodig ${extra.join(', ')}` : ''}`);
    }
    for (const [cat, text] of Object.entries(value)) {
      if (typeof text !== 'string' || text.trim() === '') { errors.push(`${loc}.${cat}: lege tekst`); continue; }
      const vars = placeholders(text).filter(v => v !== 'count');
      const wantVars = nlVars.filter(v => v !== 'count');
      if (vars.join() !== wantVars.join()) {
        errors.push(`${loc}.${cat}: invulplekken {{${vars.join('}}, {{')}}} ≠ nl {{${wantVars.join('}}, {{')}}} (count mag in woorden)`);
      }
    }
  }
  return errors;
}

/** Bestaat `path` (zonder of met meervoudsfamilie) in dit object? */
export function keyExists(root: JsonObject, path: string): boolean {
  const parts = path.split('.');
  const leaf = parts.pop()!;
  let node: Json | undefined = root;
  for (const p of parts) {
    if (!isObject(node) || !has(node, p)) return false;
    node = node[p];
  }
  return isObject(node) && Object.keys(node).some(k => k === leaf || stemOf(k) === leaf);
}

/**
 * Zet één vertaling op `path` in een locale-object (muteert `root`). Tussenliggende objecten worden
 * aangemaakt; een bestaande tekst of familie op die sleutel wordt vervangen (ook van soort, dus een
 * kale tekst die een familie wordt verliest zijn kale sleutel). `after` plaatst een NIEUWE sleutel
 * direct na een broer in hetzelfde object (anders achteraan) — alleen relevant voor nl, want de
 * andere locales volgen daarna via `orderLike` de nl-volgorde.
 */
export function setTranslation(root: JsonObject, path: string, value: Translation, after?: string): void {
  const parts = path.split('.');
  const leaf = parts.pop()!;
  let node = root;
  for (const p of parts) {
    if (!has(node, p)) node[p] = {};
    const next = node[p];
    if (!isObject(next)) throw new Error(`"${p}" in ${path} is een tekst, geen object`);
    node = next;
  }
  const entries: [string, Json][] = typeof value === 'string'
    ? [[leaf, value]]
    : CATEGORY_ORDER.filter(c => has(value, c)).map(c => [`${leaf}_${c}`, value[c]]);

  const keys = Object.keys(node);
  const oldIdx = keys.findIndex(k => k === leaf || stemOf(k) === leaf);
  let insertAt: number;
  if (oldIdx >= 0) insertAt = oldIdx;
  else if (after !== undefined) {
    const sib = keys.reduce((last, k, i) => (k === after || stemOf(k) === after ? i : last), -1);
    if (sib < 0) throw new Error(`--after: "${after}" bestaat niet naast ${path}`);
    insertAt = sib + 1;
  } else insertAt = keys.length;

  const kept = keys.filter(k => k !== leaf && stemOf(k) !== leaf);
  const beforeCount = keys.slice(0, insertAt).filter(k => k !== leaf && stemOf(k) !== leaf).length;
  const rebuilt: JsonObject = {};
  kept.slice(0, beforeCount).forEach(k => { rebuilt[k] = node[k]; });
  for (const [k, v] of entries) rebuilt[k] = v;
  kept.slice(beforeCount).forEach(k => { rebuilt[k] = node[k]; });
  for (const k of Object.keys(node)) delete node[k];
  Object.assign(node, rebuilt);
}

/** Inhoud zonder volgorde: sleutels recursief gesorteerd, zodat een herschikking geen wijziging is. */
function canonical(v: Json | undefined): string | undefined {
  const sort = (x: Json): Json => {
    if (!isObject(x)) return Array.isArray(x) ? x.map(sort) : x;
    const out: JsonObject = {};
    for (const k of Object.keys(x).sort()) out[k] = sort(x[k]);
    return out;
  };
  return v === undefined ? undefined : JSON.stringify(sort(v));
}
const same = (a: Json | undefined, b: Json | undefined) => canonical(a) === canonical(b);

/** Een echte botsing: dezelfde sleutel is aan beide kanten verschillend gewijzigd (undefined = weg). */
export interface MergeConflict {
  path: string;
  base: Json | undefined;
  ours: Json | undefined;
  theirs: Json | undefined;
}

/**
 * Drieweg-samenvoeging van één locale-object PER SLEUTEL (de kern van `npm run i18n:resolve`).
 * Wat maar één kant wijzigde, toevoegde of verwijderde, gaat mee; wat beide kanten gelijk deden ook.
 * Alleen een sleutel die aan beide kanten anders is gewijzigd, is een botsing: die krijgt voorlopig
 * de waarde van `ours` en staat in `conflicts`. Volgorde en witruimte tellen niet als wijziging —
 * daarom werkt dit wél over de eenmalige herschikking heen, waar git per regel tekst vergelijkt en
 * dan stil fout kan gaan (een sleutel die de ene kant verwijdert en de andere alleen verplaatst,
 * komt bij git ongemerkt terug). Sleutelvolgorde: die van `ours`, met nieuwe sleutels van `theirs`
 * direct na hun voorganger daar (zonder voorganger: vooraan); `formatLocale` zet het resultaat
 * daarna in de nl-volgorde. `chosen` is een eerder gemaakte keuze (de merge-commit zelf): bij een
 * botsing wint dan die waarde in plaats van `ours` — de botsing wordt wel gemeld.
 */
export function mergeLocale(base: JsonObject, ours: JsonObject, theirs: JsonObject, chosen?: JsonObject): {
  merged: JsonObject;
  conflicts: MergeConflict[];
} {
  const conflicts: MergeConflict[] = [];
  const merge = (b: JsonObject, o: JsonObject, t: JsonObject, c: JsonObject | undefined, prefix: string): JsonObject => {
    const order = Object.keys(o);
    const theirKeys = Object.keys(t);
    theirKeys.forEach((k, i) => {
      if (order.includes(k)) return;
      let j = i - 1;
      while (j >= 0 && !order.includes(theirKeys[j])) j--;
      order.splice(j < 0 ? 0 : order.indexOf(theirKeys[j]) + 1, 0, k);
    });
    const out: JsonObject = {};
    for (const k of order) {
      const bv = has(b, k) ? b[k] : undefined;
      const ov = has(o, k) ? o[k] : undefined;
      const tv = has(t, k) ? t[k] : undefined;
      const path = prefix ? `${prefix}.${k}` : k;
      let v: Json | undefined;
      const cv = c === undefined ? undefined : has(c, k) ? c[k] : undefined;
      if (isObject(ov) && isObject(tv)) v = merge(isObject(bv) ? bv : {}, ov, tv, c === undefined ? undefined : isObject(cv) ? cv : {}, path);
      else if (same(ov, tv)) v = ov;
      else if (same(ov, bv)) v = tv;
      else if (same(tv, bv)) v = ov;
      else {
        conflicts.push({ path, base: bv, ours: ov, theirs: tv });
        v = c === undefined ? ov ?? tv : cv;
      }
      if (v !== undefined) out[k] = v;
    }
    return out;
  };
  return { merged: merge(base, ours, theirs, chosen, ''), conflicts };
}
