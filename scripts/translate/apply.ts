// Samenvoegen van UI-pakketten (§9), als pure functie: alleen pakketten waarvan de poort groen is.
import type { JsonObject } from '../i18n-tools';
import { checkPackage, formatResult } from './gates';
import { applyUiPackage, type UiOut, type UiPackage, type UiSources } from './ui';

export interface BatchResult {
  /** Bijgewerkte doelobjecten per namespace (alleen namespaces die iets kregen). */
  targets: Map<string, JsonObject>;
  applied: string[];
  red: { id: string; lines: string[] }[];
}

/**
 * Voeg de pakketten één voor één toe. Een rood pakket wordt overgeslagen (met zijn foutregels);
 * een groen pakket gaat via `applyUiPackage` in het doelobject en werkt `sources` bij (muteert).
 * `readTarget` levert het huidige doelobject van een namespace (`{}` als het nog niet bestaat).
 */
export function applyUiBatch(
  batch: { pkg: UiPackage; out: unknown }[],
  readTarget: (ns: string) => JsonObject,
  nl: Record<string, JsonObject>,
  sources: UiSources,
): BatchResult {
  const targets = new Map<string, JsonObject>();
  const applied: string[] = [];
  const red: { id: string; lines: string[] }[] = [];
  for (const { pkg, out } of batch) {
    const r = checkPackage(pkg, out);
    if (r.errors.length) {
      red.push({ id: pkg.id, lines: formatResult(pkg.id, r).filter(l => !l.startsWith('WW')) });
      continue;
    }
    const ns = pkg.namespace;
    const nlNs = nl[ns];
    if (!nlNs) { red.push({ id: pkg.id, lines: [`XX onbekende namespace ${ns}`] }); continue; }
    const target = targets.get(ns) ?? readTarget(ns);
    targets.set(ns, applyUiPackage(pkg, out as UiOut, target, nlNs, sources));
    applied.push(pkg.id);
  }
  return { targets, applied, red };
}
