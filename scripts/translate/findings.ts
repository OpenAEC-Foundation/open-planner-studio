// `translate apply-findings <taal> <bestand>`: gecontroleerde verbeteringen direct in een locale zetten.
// Pure functies: elke regel gaat door dezelfde harde poorten als `check` (via een pakket van één item);
// een rode regel wordt overgeslagen en gemeld. De nl-bron verandert niet, dus de bron-hashes ook niet.
import { isComplete, unitMap, type Concept, type LangTermbase, type UnitText } from './common';
import { checkUi } from './gates';
import { literalsFor, termsFor, type UiItem, type UiPackage } from './ui';
import { orderLike, setTranslation, type JsonObject } from '../i18n-tools';

/** Eén regel uit het bestand: `{ "key": "ns:pad", "fix": "<tekst>" | { "<categorie>": "<tekst>" } }`. */
export interface Finding { key: string; fix: UnitText; category?: string }

export interface FindingsResult {
  /** Bijgewerkte doelobjecten per namespace, in nl-volgorde (alleen namespaces die iets kregen). */
  targets: Map<string, JsonObject>;
  applied: string[];
  skipped: { key: string; reasons: string[] }[];
  /** Zachte waarschuwingen van de toegepaste regels (term, avoid, lengte), voor het rapport. */
  warnings: string[];
}

const CATS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lees meervoudsvormen die als tekst binnenkomen, zoals reviewers ze soms schrijven:
 * `{"one": "…", "few": "…"}` (JSON) of `{one: "…", few: '…'}`. Geeft null als de tekst geen
 * volledig leesbaar object van categorie → tekst is.
 */
export function parsePluralText(text: string): Record<string, string> | null {
  const s = text.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  try {
    const v = JSON.parse(s) as unknown;
    if (isRecord(v) && Object.keys(v).length > 0 && Object.values(v).every(x => typeof x === 'string')) {
      return v as Record<string, string>;
    }
    return null;
  } catch { /* geen JSON: hieronder de losse schrijfwijze */ }
  const re = /(["']?)(zero|one|two|few|many|other)\1\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
  const out: Record<string, string> = {};
  let rest = s;
  for (const m of s.matchAll(re)) {
    if (m[2] in out) return null;
    const raw = m[3] ?? m[4] ?? '';
    let val: string;
    try { val = m[3] !== undefined ? JSON.parse(`"${raw}"`) as string : raw.replace(/\\(['\\])/g, '$1'); } catch { return null; }
    out[m[2]] = val;
    rest = rest.replace(m[0], '');
  }
  // Alles buiten de paren moet opmaak zijn: accolades, komma's, witruimte.
  if (Object.keys(out).length === 0 || !/^[\s{},]*$/.test(rest)) return null;
  return out;
}

/**
 * Pas de regels toe. `readTarget` levert het huidige doelobject van een namespace. Een regel wordt
 * overgeslagen als hij niet te lezen is, de sleutel niet in nl staat, er nog geen vertaling is (dat is
 * werk voor `prepare ui`), of de nieuwe tekst een harde poort niet haalt. Een meervoudsfix met een deel
 * van de categorieën (of met `category`, of op `ns:pad_few`) vult de bestaande vormen aan.
 */
export function applyFindings(opts: {
  lang: string;
  findings: unknown;
  nl: Record<string, JsonObject>;
  en: Record<string, JsonObject>;
  readTarget: (ns: string) => JsonObject;
  concepts: Concept[];
  termbase?: LangTermbase;
}): FindingsResult {
  const res: FindingsResult = { targets: new Map(), applied: [], skipped: [], warnings: [] };
  if (!Array.isArray(opts.findings)) {
    res.skipped.push({ key: '(bestand)', reasons: ['verwacht een JSON-lijst [{ "key": "ns:pad", "fix": … }]'] });
    return res;
  }
  const skip = (key: string, ...reasons: string[]) => { res.skipped.push({ key, reasons }); };
  (opts.findings as unknown[]).forEach((f, i) => {
    const label = isRecord(f) && typeof f.key === 'string' ? f.key : `regel ${i + 1}`;
    if (!isRecord(f) || typeof f.key !== 'string') return skip(label, 'verwacht { "key": "ns:pad", "fix": … }');
    const m = f.key.match(/^([a-z]+):(.+)$/);
    if (!m) return skip(label, 'sleutel moet "ns:pad" zijn');
    const [, ns, path] = m;
    const nlNs = opts.nl[ns];
    if (!nlNs) return skip(label, `onbekende namespace "${ns}"`);
    const nlUnits = unitMap(nlNs);
    let key = path;
    let category = typeof f.category === 'string' ? f.category : undefined;
    if (!nlUnits.has(key)) {
      const cm = path.match(/_(zero|one|two|few|many|other)$/);
      const stem = cm ? path.slice(0, -cm[0].length) : '';
      if (!cm || !nlUnits.get(stem)?.plural) return skip(label, 'sleutel staat niet in nl');
      key = stem;
      category = cm[1];
    }
    const src = nlUnits.get(key)!;
    const target = res.targets.get(ns) ?? opts.readTarget(ns);
    const current = unitMap(target).get(key);
    if (!isComplete(current, src, opts.lang)) return skip(label, 'nog geen (volledige) vertaling; gebruik prepare ui');

    let value: unknown = f.fix;
    if (src.plural) {
      if (typeof value === 'string') {
        if (category) value = { [category]: value };
        else {
          const parsed = parsePluralText(value);
          if (!parsed) return skip(label, 'meervoudssleutel: fix is geen { categorie: tekst } en niet als zodanig te lezen');
          value = parsed;
        }
      } else if (isRecord(value) && category) return skip(label, '"category" naast een fix met categorieën');
      if (!isRecord(value)) return skip(label, 'fix moet tekst of { categorie: tekst } zijn');
      const unknownCat = Object.keys(value).filter(c => !CATS.includes(c));
      if (unknownCat.length) return skip(label, `onbekende categorie(ën): ${unknownCat.join(', ')}`);
      value = { ...(current!.text as Record<string, string>), ...value };
    } else if (category) return skip(label, '"category" bij een sleutel zonder meervoud');

    const item: UiItem = {
      key, ...(src.plural ? { plural: true as const } : {}), nl: src.text,
      en: unitMap(opts.en[ns] ?? {}).get(key)?.text ?? src.text,
    };
    const items = [item];
    const pkg: UiPackage = {
      kind: 'ui', lang: opts.lang, namespace: ns, id: 'findings', mode: 'keys',
      ...(opts.termbase?._style ? { style: opts.termbase._style } : {}),
      terms: termsFor(items, opts.concepts, opts.termbase),
      tokens: literalsFor(items, opts.concepts, 'token'),
      keep: literalsFor(items, opts.concepts, 'keep'),
      items,
    };
    const r = checkUi(pkg, { [key]: value });
    if (r.errors.length) return skip(label, ...r.errors);
    setTranslation(target, key, value as UnitText);
    res.targets.set(ns, target);
    res.applied.push(`${ns}:${key}`);
    res.warnings.push(...r.warnings.map(w => `${ns}:${w}`));
  });
  for (const [ns, t] of res.targets) res.targets.set(ns, orderLike(t, opts.nl[ns]));
  return res;
}
