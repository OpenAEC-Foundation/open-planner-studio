// De nachtvertaling (plan: docs/superpowers/plans/2026-11-17-nachtvertalingen.md): welke UI-teksten zijn
// "af", en is main tijdens de nacht aan de selectie-invoer gekomen? Git loopt via een meegegeven `git`,
// zodat de check dezelfde code op een tijdelijke repo draait.
import type { JsonObject } from '../i18n-tools';
import { NAMESPACES } from '../i18n-tools';
import { hashUnit, unitsOf } from './common';

/** Een nl-tekst telt pas als af als hij zo lang ongewijzigd op main staat. */
export const NIGHT_MIN_AGE_MS = 48 * 60 * 60 * 1000;
/** Raakt een commit na de start een van deze paden, dan vervalt de nacht (§3 stap 6). */
export const NIGHT_GUARD_PATHS = [
  'src/i18n/locales', 'i18n/ui-sources', 'i18n/termbase', 'src/utils/featureFlags.ts', 'scripts/translate',
  'scripts/i18n-tools.ts', 'scripts/run-ts.mjs', 'package.json', 'package-lock.json',
] as const;
const NL_DIR = 'src/i18n/locales/nl';

/** stdout van `git <args>`; gooit bij een fout. */
export type Git = (args: string[]) => string;
export type NlByNs = Record<string, JsonObject>;

interface FlagTexts { id: string; nameKey: string; descriptionKey?: string; texts: readonly string[] }

/**
 * De eenheden (`ns:pad`) die bij een flag horen: `nameKey`/`descriptionKey` (namespace common) en de
 * items uit `texts`, exact of als voorvoegsel `ns:pad.*`. Een item zonder treffer is een fout: dan
 * klopt de lijst niet meer met nl.
 */
export function flagUnitKeys(flags: readonly FlagTexts[], nl: NlByNs): { keys: Set<string>; errors: string[] } {
  const units = new Map(Object.entries(nl).map(([ns, obj]) => [ns, unitsOf(obj).map(u => u.key)]));
  const keys = new Set<string>();
  const errors: string[] = [];
  for (const flag of flags) {
    const entries = [`common:${flag.nameKey}`, ...(flag.descriptionKey ? [`common:${flag.descriptionKey}`] : []), ...flag.texts];
    for (const entry of entries) {
      const m = entry.match(/^([a-z]+):(.+)$/);
      const nsUnits = m ? units.get(m[1]) : undefined;
      if (!m || !nsUnits) { errors.push(`flag ${flag.id}: ongeldig item "${entry}" (verwacht "ns:pad" of "ns:pad.*")`); continue; }
      const [, ns, path] = m;
      const prefix = path.endsWith('.*') ? path.slice(0, -1) : undefined;
      const hits = nsUnits.filter(k => prefix ? k.startsWith(prefix) : k === path);
      if (hits.length === 0) errors.push(`flag ${flag.id}: "${entry}" staat niet in nl`);
      for (const k of hits) keys.add(`${ns}:${k}`);
    }
  }
  return { keys, errors };
}

export interface Settled {
  /** `ns:pad` in nl-volgorde: rustig en niet van een flag. */
  keys: string[];
  /** Eenheden die te nieuw zijn of in het venster veranderden. */
  moving: number;
  /** Rustige eenheden die bij een flag horen. */
  flagged: number;
}

/**
 * Welke eenheden van `snapshots.at(-1)` (de huidige nl) zijn af? Een eenheid moet in elke momentopname
 * (de basis van vóór het venster, elke commit erin, de huidige) bestaan met dezelfde hash. `excluded`
 * zijn de flag-eenheden. Zonder momentopnames is niets af.
 */
export function settledUnits(snapshots: readonly NlByNs[], excluded: ReadonlySet<string>): Settled {
  const out: Settled = { keys: [], moving: 0, flagged: 0 };
  const current = snapshots[snapshots.length - 1];
  if (!current) return out;
  const hashes = snapshots.map(s => new Map<string, string>(Object.entries(s).flatMap(([ns, obj]) =>
    unitsOf(obj).map(u => [`${ns}:${u.key}`, hashUnit(u.text)] as const))));
  for (const ns of Object.keys(current)) {
    for (const u of unitsOf(current[ns])) {
      const key = `${ns}:${u.key}`;
      const h = hashUnit(u.text);
      if (!hashes.every(m => m.get(key) === h)) { out.moving++; continue; }
      if (excluded.has(key)) { out.flagged++; continue; }
      out.keys.push(key);
    }
  }
  return out;
}

function nlAt(git: Git, sha: string): NlByNs {
  const out: NlByNs = {};
  for (const ns of NAMESPACES) {
    let text: string;
    try { text = git(['show', `${sha}:${NL_DIR}/${ns}.json`]); } catch { out[ns] = {}; continue; }
    out[ns] = JSON.parse(text) as JsonObject;
  }
  return out;
}

const lines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);

/**
 * De nl-momentopnames voor `settledUnits` op `ref`: de laatste first-parent-commit van vóór
 * `nowMs − NIGHT_MIN_AGE_MS` (de basis), elke first-parent-commit daarna die nl raakte, en `ref`.
 * Zonder basis (repo jonger dan het venster) is niets af: dan alleen `[]`.
 */
export function nlHistory(git: Git, ref: string, nowMs: number): NlByNs[] {
  const before = new Date(nowMs - NIGHT_MIN_AGE_MS).toISOString();
  const base = git(['rev-list', '-1', '--first-parent', `--before=${before}`, ref]).trim();
  if (!base) return [];
  const between = lines(git(['rev-list', '--first-parent', '--reverse', `${base}..${ref}`, '--', NL_DIR]));
  return [base, ...between, ref].map(sha => nlAt(git, sha));
}

/** De first-parent-commits van `ref` na `base` die een beschermd pad raken; leeg = de nacht mag door. */
export function guardCommits(git: Git, base: string, ref: string): string[] {
  return lines(git(['rev-list', '--first-parent', `${base}..${ref}`, '--', ...NIGHT_GUARD_PATHS]));
}

/**
 * Pakketten per taal in bundels voor één vertaal- en naleesrun, op volgorde. Een bundel blijft onder
 * `maxChars` pakkettekst; een pakket dat er alleen al boven zit, krijgt een eigen bundel.
 */
export function bundlePackages(packs: readonly { lang: string; id: string; chars: number }[], maxChars: number): [string, string[]][] {
  const out: [string, string[]][] = [];
  let lang = '';
  let chars = 0;
  for (const p of packs) {
    const last = out[out.length - 1];
    if (!last || p.lang !== lang || chars + p.chars > maxChars) {
      out.push([p.lang, [p.id]]);
      lang = p.lang;
      chars = p.chars;
    } else {
      last[1].push(p.id);
      chars += p.chars;
    }
  }
  return out;
}
