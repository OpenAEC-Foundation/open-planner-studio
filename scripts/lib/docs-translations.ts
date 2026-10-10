// De poort voor de optionele docstalen (alles behalve nl en en), deel van `npm run verify:docs`.
// Ontwerp: `docs/superpowers/specs/2026-10-09-vertaalstraat-design.md` §9/§10, contracten C1–C3.
//
// nl en en zijn de bron: verplicht en streng (zie verify-docs.ts). Een andere taal is optioneel: wat er
// staat, moet kloppen, maar wat ontbreekt of verouderd is, is een RAPPORT (exit 0) — anders blokkeert
// elk nieuw Engels artikel elke PR. Wat een FOUT is:
//  - een artikel zonder regel in `<taal>/index.json`, of een indexregel zonder artikel;
//  - een indextitel die niet gelijk is aan de H1 van het artikel;
//  - parser-subset, lege bestanden, dubbele koppen (zoals voor nl/en);
//  - de structuur (`structureHash`, C1) wijkt af van wat `i18n/docs-sources/<taal>.json` (C3) bewaarde:
//    de vertaling is niet meer de vorm van de Engelse tekst waaruit ze kwam;
//  - een bestaand manifestartikel zonder regel in `i18n/docs-sources/<taal>.json`.
// Een RAPPORT: ontbrekend, verouderd (de bewaarde structuur ≠ die van de huidige en), een wees (artikel
// zonder manifest-id) en een `docs://`/`examples://`-link naar een onbekend doel. Ankers controleert de
// poort alleen in nl/en: een anker volgt de koptekst, en de app gebruikt geen ankers.
//
// Puur op het bestandssysteem dat je meegeeft (geen `process.cwd()`), zodat
// `tests/planning/check-docs-translations.ts` het op een tijdelijke fixture-map kan draaien.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripCode, structureHash, subsetErrors } from './docs-structure';

export interface OptionalLangInput {
  /** `public/docs`. */
  docsDir: string;
  /** `i18n/docs-sources` (contract C3, buiten het package). */
  sourcesDir: string;
  lang: string;
  /** Manifest-id's in manifestvolgorde. */
  manifestIds: readonly string[];
  /** Bestaat een `docs://`-doel (id of alias)? */
  isKnownDocTarget: (id: string) => boolean;
  /** Bestanden uit `public/examples/manifest.json`. */
  exampleFiles: ReadonlySet<string>;
  /** Vult `{lang}` in een afbeeldingspad in (`resolveHelpImagePath`). */
  resolveImagePath: (src: string, lang: string) => string;
}

export interface OptionalLangResult {
  lang: string;
  errors: string[];
  /** Manifestartikelen met een vertaling. */
  translated: number;
  /** Manifestartikelen zonder vertaling. */
  missing: number;
  /** Id's waarvan de bewaarde structuur niet meer die van de huidige en-tekst is. */
  stale: string[];
  /** Artikelen (of indexregels) zonder manifest-id. */
  orphans: string[];
  /** `docs://`/`examples://`-links naar een onbekend doel, als `<id>: <doel>`. */
  unknownLinks: string[];
}

interface DocsSourceEntry { structure?: unknown }

const H1_RE = /^#\s+(.*)$/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;

/** De H1 van een artikel (eerste `# `-kop buiten code), of `null`. */
export function articleH1(md: string): string | null {
  for (const line of stripCode(md).split('\n')) {
    const m = H1_RE.exec(line);
    if (m) return m[1].trim();
  }
  return null;
}

function readJson(path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Controleert `public/docs/<lang>/` voor één optionele taal. Bestaat de map niet, dan is alles "ontbrekend". */
export function checkOptionalDocLang(input: OptionalLangInput): OptionalLangResult {
  const { docsDir, sourcesDir, lang, manifestIds, exampleFiles } = input;
  const manifestSet = new Set(manifestIds);
  const result: OptionalLangResult = {
    lang, errors: [], translated: 0, missing: manifestIds.length, stale: [], orphans: [], unknownLinks: [],
  };
  const dir = join(docsDir, lang);
  if (!existsSync(dir)) return result;
  const err = (msg: string) => result.errors.push(msg);
  const where = `public/docs/${lang}`;

  // Bestanden in de taalmap: alleen .md-artikelen en index.json.
  const mdIds: string[] = [];
  let hasIndex = false;
  for (const file of readdirSync(dir)) {
    if (file === 'index.json') { hasIndex = true; continue; }
    if (!file.endsWith('.md')) { err(`${where}/${file}: alleen .md-artikelen en index.json horen in een taalmap`); continue; }
    mdIds.push(file.slice(0, -3));
  }

  // index.json (contract C2): { "<id>": { "title": "<vertaalde H1>" } }.
  const index: Record<string, { title: string }> = Object.create(null) as Record<string, { title: string }>;
  if (hasIndex) {
    const parsed = readJson(join(dir, 'index.json'));
    if (!parsed.ok) err(`${where}/index.json is geen geldige JSON: ${parsed.error}`);
    else if (!isObject(parsed.value)) err(`${where}/index.json moet een object zijn ({ "<id>": { "title": … } })`);
    else {
      for (const [id, entry] of Object.entries(parsed.value)) {
        if (!isObject(entry) || typeof entry.title !== 'string' || !entry.title.trim()) {
          err(`${where}/index.json: "${id}" heeft geen (niet-lege) title`);
          continue;
        }
        index[id] = { title: entry.title };
      }
    }
  } else if (mdIds.length > 0) {
    err(`${where}/index.json ontbreekt, maar de map heeft ${mdIds.length} artikel(en) — de straat genereert hem`);
  }

  // Bestand ↔ indexregel, in beide richtingen.
  const mdSet = new Set(mdIds);
  if (hasIndex) {
    for (const id of mdIds) if (!Object.prototype.hasOwnProperty.call(index, id)) err(`${where}/${id}.md heeft geen regel in index.json`);
  }
  for (const id of Object.keys(index)) {
    if (!mdSet.has(id)) err(`${where}/index.json: regel "${id}" zonder artikel ${id}.md`);
  }
  for (const id of new Set([...mdIds, ...Object.keys(index)])) {
    if (!manifestSet.has(id)) result.orphans.push(id);
  }

  // De structuurhashes van de straat (contract C3).
  const sourcesPath = join(sourcesDir, `${lang}.json`);
  let sources: Record<string, DocsSourceEntry> | null = null;
  const translatedIds = mdIds.filter((id) => manifestSet.has(id));
  if (existsSync(sourcesPath)) {
    const parsed = readJson(sourcesPath);
    if (!parsed.ok) err(`i18n/docs-sources/${lang}.json is geen geldige JSON: ${parsed.error}`);
    else if (!isObject(parsed.value)) err(`i18n/docs-sources/${lang}.json moet een object zijn`);
    else sources = parsed.value as Record<string, DocsSourceEntry>;
  } else if (translatedIds.length > 0) {
    err(`i18n/docs-sources/${lang}.json ontbreekt, maar ${where}/ heeft ${translatedIds.length} artikel(en) — zonder die bron is "verouderd" niet te meten`);
  }

  for (const id of mdIds.slice().sort((a, b) => a.localeCompare(b))) {
    const label = `${lang}/${id}`;
    const text = readFileSync(join(dir, `${id}.md`), 'utf8');
    if (!text.trim()) { err(`${label}: bestand is leeg`); continue; }

    // Parser-subset; een afbeelding valt zonder eigen beeldmap terug op en (`resolveImagePath`).
    const imageCheck = (path: string): string | null => {
      const resolved = input.resolveImagePath(path, lang);
      return existsSync(join(docsDir, resolved)) ? null : `afbeelding bestaat niet: public/docs/${resolved}`;
    };
    for (const e of subsetErrors(text, imageCheck)) err(`${label}:${e}`);

    // Dubbele koppen.
    const seen = new Set<string>();
    for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
      const m = HEADING_RE.exec(line);
      if (!m) continue;
      const h = m[2].trim();
      if (seen.has(h)) err(`${label}: dubbele kop "${h}"`);
      seen.add(h);
    }

    // Indextitel = H1.
    const h1 = articleH1(text);
    if (h1 === null) err(`${label}: geen H1 (# Titel)`);
    else if (index[id] && index[id].title.trim() !== h1) {
      err(`${label}: indextitel "${index[id].title}" ≠ H1 "${h1}" — de straat neemt de titel uit de H1`);
    }

    // Links naar een onbekend doel: een rapport (de en-bron bepaalt de links; die toetst nl/en hard).
    const code = stripCode(text);
    for (const m of code.matchAll(/docs:\/\/([a-zA-Z0-9_-]+)/g)) {
      if (!input.isKnownDocTarget(m[1])) result.unknownLinks.push(`${id}: docs://${m[1]}`);
    }
    for (const m of text.matchAll(/examples:\/\/([^\s)\]]+)/g)) {
      if (!exampleFiles.has(m[1])) result.unknownLinks.push(`${id}: examples://${m[1]}`);
    }

    // Structuur tegen de en-bron waaruit de vertaling kwam (alleen voor manifestartikelen).
    if (!manifestSet.has(id) || !existsSync(sourcesPath)) continue;
    if (!sources) continue; // ongeldige bron: al gemeld
    const entry = sources[id];
    if (!isObject(entry) || typeof entry.structure !== 'string') {
      err(`${label}: geen regel (met structure) in i18n/docs-sources/${lang}.json`);
      continue;
    }
    if (structureHash(text) !== entry.structure) {
      err(`${label}: structuur (koppen, links, beelden, lijstitems) wijkt af van de en-tekst waaruit de vertaling kwam`);
      continue;
    }
    const enPath = join(docsDir, 'en', `${id}.md`);
    if (existsSync(enPath) && structureHash(readFileSync(enPath, 'utf8')) !== entry.structure) result.stale.push(id);
  }

  result.translated = translatedIds.length;
  result.missing = manifestIds.length - translatedIds.length;
  return result;
}

/** Eén rapportregel per taal, met aantallen. */
export function optionalLangReportLine(r: OptionalLangResult, total: number): string {
  const parts = [`${r.translated}/${total} vertaald`];
  if (r.missing) parts.push(`${r.missing} ontbreken`);
  if (r.stale.length) parts.push(`${r.stale.length} verouderd`);
  if (r.orphans.length) parts.push(`${r.orphans.length} wees`);
  if (r.unknownLinks.length) parts.push(`${r.unknownLinks.length} link(s) naar een onbekend doel`);
  return `${r.lang}: ${parts.join(' · ')}`;
}
