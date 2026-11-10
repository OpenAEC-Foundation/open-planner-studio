// Knownbug 1026: wat eenmaal letterlijk in het bestand stond, blijft letterlijk (besluit Trias, wrakko 10 november 2026).
// `DocumentPayload.ifcLiteralCalendarIds` krijgt de kalenders die het bestand bij het openen letterlijk had, en daarbij
// elke kalender die de app in deze sessie letterlijk naar het eigen bestand van het document schreef (Opslaan, Opslaan
// als, AutoSave naar het bestand). Anders kwam 1026 binnen één sessie terug: opslaan met `LiteralTimes`, de taak wissen
// die het nodig had, en bij de volgende opslag schoven de eindtijden toch naar `T07:00:00`. Een kalender die letterlijk
// werd maar nooit zo is opgeslagen, telt niet: het bestand had hem nooit letterlijk.
import { writeIFCWithChoices } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput, type IFCSaveSource } from './ifcSaveInput';

/** Per momentopname die naar het eigen bestand ging: de kalenders die de writer letterlijk schreef. */
const written = new WeakMap<object, readonly string[]>();

/** De IFC-tekst van een opslag naar het eigen bestand. Onthoudt welke kalenders letterlijk werden, voor het vastleggen
 *  van die opslag (`literalCalendarIdsWritten`). */
export function serializeForSave(source: IFCSaveSource): string {
  const { content, literalCalendarIds } = writeIFCWithChoices(buildWriteIFCInput(source));
  written.set(source, literalCalendarIds);
  return content;
}

/** De kalenders die de opslag van `source` letterlijk schreef; leeg als `source` niet via `serializeForSave` ging. */
export function literalCalendarIdsWritten(source: IFCSaveSource): readonly string[] {
  return written.get(source) ?? [];
}

/** `current` met `add` erbij. Dezelfde referentie als er niets bijkomt: de lijst wordt nooit kleiner. */
export function mergeLiteralCalendarIds(current: string[] | null, add: readonly string[] | null | undefined): string[] | null {
  const extra = [...new Set(add ?? [])].filter(id => !(current ?? []).includes(id));
  return extra.length === 0 ? current : [...(current ?? []), ...extra];
}
