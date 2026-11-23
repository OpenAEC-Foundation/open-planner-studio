/**
 * De productgrens voor het openen van een IFC-bestand met een gebouwmodel of met gegevens van een ander programma
 * (#804, flag `ifcForeignContent`): 150 MiB (binair, 157.286.400 bytes). Besluit van de eigenaar, 21 november 2026: "tot
 * 150 mb, later kunnen we dat nog uitbouwen". Een hogere grens later is deze ene regel.
 *
 * Dit is niet de technische grens van de bytes-route (`IFC_FOREIGN_SCAN_MAX_BYTES` in `foreign/foreignScan.ts`, 300 MiB):
 * die blijft voor de scanner, de doelscan, het crashherstel en headless. Deze grens geldt alleen bij openen door de
 * planner of een assistent (Bestand → Openen, Recent, slepen en het startbestand, de dev-link, de site,
 * `planner_import_schedule`); elk van die routes roept `refuseModelAboveOpenLimit` aan na het lezen. Het crashherstel
 * niet: dat leest zijn eigen, gecontroleerde bron zoals main. Een planning zonder gebouwmodel en zonder vreemde gegevens
 * heeft deze grens niet.
 */
import { isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';

export const IFC_MODEL_OPEN_MAX_BYTES = 150 * 1024 * 1024;

/** Openen geweigerd: een gebouwmodel of vreemde gegevens boven de productgrens. `limit` in bytes. */
export class IfcModelOpenTooLargeError extends Error {
  readonly code = 'IFC_MODEL_OPEN_TOO_LARGE';
  constructor(readonly size: number, readonly limit: number) {
    super(`IFC open refused: ${size} bytes is above the limit of ${limit} bytes for an IFC file with a building model or data from another program`);
    this.name = 'IfcModelOpenTooLargeError';
  }
}

let lowered = Infinity;
/** Proefnaad: alleen lager dan de productgrens, nooit hoger; zonder waarde weer de productgrens. Zo toetsen de proeven de
 *  grens zonder bestand van 150 MiB. Geen productieaanroeper. */
export function lowerModelOpenLimitForTests(bytes?: number): void {
  lowered = bytes ?? Infinity;
}

/**
 * Gooit `IfcModelOpenTooLargeError` als een gelezen IFC-document een bron met een gebouwmodel of vreemde gegevens
 * draagt (`ifcSource.foreign`, de uitkomst van de scan van de bytes-route) die groter is dan de productgrens (`>`).
 * Gebruikt wat de leesroute al weet: geen tweede scan.
 */
export function refuseModelAboveOpenLimit(parsed: OpenedImport): void {
  const limit = Math.min(lowered, IFC_MODEL_OPEN_MAX_BYTES);
  for (const result of isMultiDocumentImport(parsed) ? parsed.results : [parsed]) {
    const source = result.ifcSource;
    if (source?.foreign && source.bytes.length > limit) throw new IfcModelOpenTooLargeError(source.bytes.length, limit);
  }
}
