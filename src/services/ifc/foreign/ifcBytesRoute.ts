/**
 * De IFC-bytes-route (#804 fase 1a, ontwerp "Gebouwmodel behouden" §4.9): openen van een IFC-bestand met of zonder
 * gebouwmodel, achter de flag `ifcForeignContent`. `formatRegistry` laadt deze module pas met de flag (lui), zodat
 * scanner en indeling zonder flag niet in de hoofdbundel komen en niets veranderen.
 *
 * Stappen:
 *  1. Scanner en indeling op de bytes, in een Worker (`foreignScanRunner.ts`).
 *  2. De lezer krijgt de tekst van de stukken P, C en A, met kop, `DATA;` en staart (§4.9 punt 4). Het model (V) zit er
 *     niet in, op het enige `IfcProject` na: dat leest de lezer altijd als context (§4.2, Gevolgen). De lezer volgt de keuze van `selectPlanning` voor de taken (§4.2 stap 1) en de codering per stuk (§4.9
 *     punt 5). De lezer houdt de modelweigering op die tekst: een modeltype buiten V weigert openen (knownbug 1151).
 *  3. De lezer legt de kaart domein-id → `#id` vast; een controle eist dat taken, resources, kalenders, werkplan en
 *     werkschema precies de keuze van `selectPlanning` zijn.
 *  4. Het `ImportResult` krijgt `ifcSource` (§4.8).
 *
 * Een terugval zonder bron is alleen veilig als de volledige indeling geen vreemd deel vindt. Bij een onzekere
 * indeling weigert openen. IFC2X3 zonder model houdt de expliciete uitzondering uit §4.11, met verliesmelding.
 */
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { readIFCWithXerReconstruction, type IfcReadWithXerOptions } from '../ifcReadWithXer';
import { readFileSchemaName } from '../ifcReader';
import { ifcObjectSeed } from '../ifcWriter';
import { readerBytes, readerOptions, type ForeignScanResult, type ForeignScanOutcome } from './foreignScan';
import { runForeignScan, type ForeignScanRunOptions } from './foreignScanRunner';
import type { IfcSource } from './ifcSource';
import type { StepScanReason } from './stepScanner';

/** Grootste bron voor de bytes-route: 300 MiB. De meting van fase 0 (vraag 4) liep tot 300 MB zonder harde grens;
 *  daarboven alleen de gewone route als bewezen is dat er geen vreemd deel is. Geen nieuwe grens zonder meting. */
export const IFC_BYTES_ROUTE_MAX_BYTES = 300 * 1024 * 1024;

/** De kopnamen waarvoor de bytes-route een vreemd deel bewaart (§4.11). */
const FOREIGN_CONTENT_SCHEMAS: ReadonlySet<string> = new Set(['IFC4', 'IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2', 'IFC4X3_TC1']);

/** Waarom de bytes-route terugviel op de huidige route. */
export type IfcBytesFallback =
  | { kind: 'te-groot'; size: number }
  | { kind: 'scanner'; reason: StepScanReason; message: string }
  | { kind: 'schema'; schemaName: string | undefined }
  | { kind: 'selectie'; field: string };

export interface IfcBytesRead {
  result: ImportResult;
  /** Gezet als de bytes-route terugviel; dan heeft `result` geen `ifcSource`. */
  fallback?: IfcBytesFallback;
}

/** Een geweigerde terugval: geen document activeren dat zijn vreemde deel zou kunnen verliezen. */
export class IfcForeignOpenError extends Error {
  readonly code = 'IFC_FOREIGN_OPEN_REFUSED';
  constructor(readonly fallback: IfcBytesFallback) {
    super(`IFC open refused: unsafe ${fallback.kind} fallback`);
    this.name = 'IfcForeignOpenError';
  }
}

/** De Worker-keuze voor tests, en de herstelnaad voor een XER-archiefverwijzing (crashherstel, zoals de huidige route). */
export type IfcBytesRouteOptions = ForeignScanRunOptions & Pick<IfcReadWithXerOptions, 'resolveXerArchiveReference'> & {
  /** Proefnaad binnen de bestaande leesopties: alleen lager dan de productiegrens, nooit hoger. */
  maxBytes?: number;
};

/** Open IFC-bytes via de bytes-route (`readIfcBytesDetailed`); de open-routes gebruiken deze vorm. */
export async function readIfcBytes(bytes: Uint8Array, labels: ImportLabels = {}, opts: IfcBytesRouteOptions = {}): Promise<ImportResult> {
  return (await readIfcBytesDetailed(bytes, labels, opts)).result;
}

/** De gewone lezer houdt zijn modelweigering. Alleen een bewezen eigen deel mag daarna zonder bron verder.
 * De gedeelde herkenning van oude eigen koppen draait vóór de indeling (`foreignScan`); deze terugval voegt
 * geen eigen kopherkenning of reparatie toe. */
async function currentRoute(
  bytes: Uint8Array, labels: ImportLabels, opts: IfcBytesRouteOptions, fallback: IfcBytesFallback,
  knownScan?: ForeignScanOutcome,
): Promise<IfcBytesRead> {
  const text = new TextDecoder('utf-8').decode(bytes);
  const result = await readIFCWithXerReconstruction(text, labels, xerOptions(opts));
  if (fallback.kind === 'schema' && fallback.schemaName === 'IFC2X3') {
    return { result: { ...result, ifcLegacySchemaLoss: true }, fallback };
  }
  const scan = knownScan ?? await runForeignScan(bytes, opts);
  if (!scan.ok || scan.counts.C + scan.counts.A + scan.counts.V > 0) throw new IfcForeignOpenError(fallback);
  return { result, fallback };
}

/** Alleen de herstelnaad gaat naar de lezer; de Worker-keuze niet. */
function xerOptions(opts: IfcBytesRouteOptions): IfcReadWithXerOptions {
  return opts.resolveXerArchiveReference ? { resolveXerArchiveReference: opts.resolveXerArchiveReference } : {};
}

export async function readIfcBytesDetailed(
  bytes: Uint8Array,
  labels: ImportLabels = {},
  opts: IfcBytesRouteOptions = {},
): Promise<IfcBytesRead> {
  if (bytes.length > Math.min(opts.maxBytes ?? IFC_BYTES_ROUTE_MAX_BYTES, IFC_BYTES_ROUTE_MAX_BYTES)) return currentRoute(bytes, labels, opts, { kind: 'te-groot', size: bytes.length });
  const scan = await runForeignScan(bytes, opts);
  if (!scan.ok) return currentRoute(bytes, labels, opts, { kind: 'scanner', reason: scan.reason, message: scan.message }, scan);

  const readerText = new TextDecoder('utf-8').decode(readerBytes(bytes, scan));
  const schemaName = readFileSchemaName(readerText);
  if (schemaName === undefined || !FOREIGN_CONTENT_SCHEMAS.has(schemaName)) {
    return currentRoute(bytes, labels, opts, { kind: 'schema', schemaName }, scan);
  }

  const stepIdsOut: Record<string, string> = {};
  // Knownbug 1151: de modelweigering draait ook hier, op de tekst van de lezer (zonder V). Ziet de grammatica daar een
  // modeltype dat de scanner niet als V telde (bijv. een wand na `*⏎/`, voor de scanner commentaar), dan weigert
  // openen zoals zonder flag. Anders zou opslaan in een later fase dat stuk herschrijven en de wand wissen.
  const result = await readIFCWithXerReconstruction(readerText, labels, {
    ...xerOptions(opts), ...readerOptions(scan), stepIdsOut,
  });
  const mismatch = selectionMismatch(scan, stepIdsOut, result.project.id);
  if (mismatch) return currentRoute(bytes, labels, opts, { kind: 'selectie', field: mismatch }, scan);

  const { C, A, V } = scan.counts;
  const foreignObjectCount = C + A + V;
  const stepIds: Record<string, number> = {};
  for (const [key, id] of Object.entries(stepIdsOut)) stepIds[key] = Number(id);
  const ifcSource: IfcSource = {
    bytes,
    sha256: await precomputeSha256(bytes),
    schemaName,
    chunkStarts: scan.chunkStarts,
    chunkIds: scan.chunkIds,
    classes: scan.classes,
    stepIds,
    foreignMembers: Array.from(scan.foreignMembers),
    foreign: foreignObjectCount > 0,
    foreignObjectCount,
    lineEnding: scan.lineEnding,
  };
  return { result: { ...result, ifcSource } };
}

/**
 * Kiest de lezer dezelfde objecten als `selectPlanning`? Taken, resources, kalenders, werkplan en werkschema moeten gelijk
 * zijn; de relaties die de lezer las, moeten in de keuze staan (de lezer laat een ongeldige relatie weg, zoals nu).
 * Geeft het eerste veld dat verschilt, of `undefined`.
 */
function selectionMismatch(scan: ForeignScanResult, stepIds: Readonly<Record<string, string>>, projectId: string): string | undefined {
  const ids = (chunks: Int32Array) => new Set(Array.from(chunks, c => String(scan.chunkIds[c])));
  const read = (prefix: string) => {
    const out = new Set<string>();
    for (const [key, id] of Object.entries(stepIds)) if (key.startsWith(prefix)) out.add(id);
    return out;
  };
  const same = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(x => b.has(x));
  const sel = scan.selection;
  if (!same(read('task:'), ids(sel.tasks))) return 'taken';
  if (!same(read('res:'), ids(sel.resources))) return 'resources';
  if (!same(read('cal:'), ids(sel.calendars))) return 'kalenders';
  const sequences = ids(sel.sequences);
  if (![...read('seq:')].every(id => sequences.has(id))) return 'relaties';
  const one = (chunk: number) => (chunk >= 0 ? String(scan.chunkIds[chunk]) : undefined);
  if (stepIds[ifcObjectSeed('wp', projectId)] !== one(sel.workPlan)) return 'werkplan';
  if (stepIds[ifcObjectSeed('ws', projectId)] !== one(sel.liveSchedule)) return 'werkschema';
  return undefined;
}
