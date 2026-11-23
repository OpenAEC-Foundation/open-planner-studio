// Knownbug 1026: wat eenmaal letterlijk in het bestand stond, blijft letterlijk (besluit Trias, wrakko 10 november 2026).
// `DocumentPayload.ifcLiteralCalendarIds` krijgt de kalenders die het bestand bij het openen letterlijk had, en daarbij
// elke kalender die de app in deze sessie letterlijk naar het eigen bestand van het document schreef (Opslaan, Opslaan
// als, AutoSave naar het bestand, een IFC-export over dat bestand). Anders kwam 1026 binnen één sessie terug: opslaan met `LiteralTimes`, de taak wissen
// die het nodig had, en bij de volgende opslag schoven de eindtijden toch naar `T07:00:00`. Een kalender die letterlijk
// werd maar nooit zo is opgeslagen, telt niet: het bestand had hem nooit letterlijk.
import type { FileRef } from '@/services/fileAccess';
import { compareFilePaths, type FileIdentityComparison, type FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import type { IFCSaveSource } from './ifcSaveInput';

/** Per momentopname die naar het eigen bestand ging: de kalenders die de writer letterlijk schreef. */
const written = new WeakMap<object, readonly string[]>();

/** Onthoud welke kalenders de gewone writer letterlijk schreef (Opslaan, Opslaan als, AutoSave; in de opslagworker of op
 *  deze thread), voor de latere documentcommit (`literalCalendarIdsWritten`); exports roepen dit niet aan. */
export function rememberLiteralCalendarsWritten(source: IFCSaveSource, ids: readonly string[]): void {
  written.set(source, ids);
}

/** De kalenders die de opslag van `source` letterlijk schreef; leeg als niemand ze voor `source` onthield. */
export function literalCalendarIdsWritten(source: IFCSaveSource): readonly string[] {
  return written.get(source) ?? [];
}

/**
 * Review #872 ronde 3 (Terra): een IFC-export (Exporteren, `planner_export_ifc`) over het eigen bestand van het document
 * schrijft dat bestand ook. Dan legt de export de letterlijke kalenders vast, net als Opslaan. Alleen een aantoonbaar
 * ander bestand telt niet. Bij twijfel (geen identiteit te lezen) telt het: hooguit een kalender te veel letterlijk, de
 * veilige richting.
 */
export function exportHitsOwnFile(match: FileIdentityComparison): boolean {
  return match !== 'different';
}

export async function exportTargetMatch(
  own: FileRef | null, target: FileRef | null | undefined, identity?: FileIdentityFs,
): Promise<FileIdentityComparison> {
  if (!own || !target) return 'different';
  if (own.kind === 'site') return target.kind === 'site' && target.id === own.id ? 'same' : 'different';
  if (own.kind === 'handle') {
    if (target.kind !== 'handle') return 'different';
    try { return await target.handle.isSameEntry(own.handle) ? 'same' : 'different'; } catch { return 'unknown'; }
  }
  if (target.kind !== 'path') return 'different';
  if (!identity) return target.path === own.path ? 'same' : 'different';
  return compareFilePaths(identity, target.path, own.path);
}

/** `current` met `add` erbij. Dezelfde referentie als er niets bijkomt: de lijst wordt nooit kleiner. */
export function mergeLiteralCalendarIds(current: string[] | null, add: readonly string[] | null | undefined): string[] | null {
  const extra = [...new Set(add ?? [])].filter(id => !(current ?? []).includes(id));
  return extra.length === 0 ? current : [...(current ?? []), ...extra];
}
