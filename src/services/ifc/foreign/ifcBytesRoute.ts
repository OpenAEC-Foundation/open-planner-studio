/**
 * De IFC-bytes-route (#804 fase 1a, ontwerp "Gebouwmodel behouden" §4.9): openen van een IFC-bestand met of zonder
 * gebouwmodel, achter de flag `ifcForeignContent`. `formatRegistry` laadt deze module pas met de flag (lui), zodat
 * scanner en indeling zonder flag niet in de hoofdbundel komen en niets veranderen.
 *
 * Stappen:
 *  1. Scanner en indeling op de bytes, in een Worker (`foreignScanRunner.ts`).
 *  2. De lezer krijgt de tekst van de stukken P, C en A, met kop, `DATA;` en staart (§4.9 punt 4). Het model (V) zit er
 *     niet in, op het enige `IfcProject` na: dat leest de lezer altijd als context (§4.2, Gevolgen). De lezer volgt de keuze van `selectPlanning` voor de taken (§4.2 stap 1) en de codering per stuk (§4.9
 *     punt 5).
 *  3. De lezer legt de kaart domein-id → `#id` vast; een controle eist dat taken, resources, kalenders, werkplan en
 *     werkschema precies de keuze van `selectPlanning` zijn.
 *  4. Het `ImportResult` krijgt `ifcSource` (§4.8).
 *
 * Terugval naar de huidige route (tekst, de modelweigering, geen `ifcSource`), dus hetzelfde als zonder flag:
 *  - de bron is groter dan `IFC_BYTES_ROUTE_MAX_BYTES`;
 *  - de scanner weigert de bytes, ook als `readIFC` het bestand wel opent (afwijking 7, spec §4.9 "v21, fase 1a");
 *  - het schema in de kop is geen IFC4 of IFC4X3 (§4.11: IFC2X3 met model blijft geweigerd, zoals nu);
 *  - de lezer kiest andere objecten dan `selectPlanning` (de controle van stap 3).
 */
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { readIFCWithXerReconstruction, type IfcReadWithXerOptions } from '../ifcReadWithXer';
import { readFileSchemaName } from '../ifcReader';
import { ifcObjectSeed } from '../ifcWriter';
import type { ForeignScanResult } from './foreignScan';
import { runForeignScan, type ForeignScanRunOptions } from './foreignScanRunner';
import type { IfcSource } from './ifcSource';
import type { StepScanReason } from './stepScanner';

/** Grootste bron voor de bytes-route: 300 MiB. De meting van fase 0 (vraag 4) liep tot 300 MB zonder harde grens;
 *  daarboven blijft de huidige route, met dezelfde uitkomst als zonder flag. */
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

/** De Worker-keuze voor tests, en de herstelnaad voor een XER-archiefverwijzing (crashherstel, zoals de huidige route). */
export type IfcBytesRouteOptions = ForeignScanRunOptions & Pick<IfcReadWithXerOptions, 'resolveXerArchiveReference'>;

/** Open IFC-bytes via de bytes-route (`readIfcBytesDetailed`); de open-routes gebruiken deze vorm. */
export async function readIfcBytes(bytes: Uint8Array, labels: ImportLabels = {}, opts: IfcBytesRouteOptions = {}): Promise<ImportResult> {
  return (await readIfcBytesDetailed(bytes, labels, opts)).result;
}

/** De huidige route: de bytes als UTF-8-tekst (zoals `readTextFile` en `File.text()`), met de modelweigering. */
async function currentRoute(
  bytes: Uint8Array, labels: ImportLabels, opts: IfcBytesRouteOptions, fallback: IfcBytesFallback,
): Promise<IfcBytesRead> {
  const text = new TextDecoder('utf-8').decode(bytes);
  return { result: await readIFCWithXerReconstruction(text, labels, xerOptions(opts)), fallback };
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
  if (bytes.length > IFC_BYTES_ROUTE_MAX_BYTES) return currentRoute(bytes, labels, opts, { kind: 'te-groot', size: bytes.length });
  const scan = await runForeignScan(bytes, opts);
  if (!scan.ok) return currentRoute(bytes, labels, opts, { kind: 'scanner', reason: scan.reason, message: scan.message });

  const readerText = new TextDecoder('utf-8').decode(readerBytes(bytes, scan));
  const schemaName = readFileSchemaName(readerText);
  if (schemaName === undefined || !FOREIGN_CONTENT_SCHEMAS.has(schemaName)) {
    return currentRoute(bytes, labels, opts, { kind: 'schema', schemaName });
  }

  const idOf = (chunk: number) => String(scan.chunkIds[chunk]);
  const literalStepIds = new Set<string>();
  for (let i = 0; i < scan.literal.length; i++) if (scan.literal[i] === 1) literalStepIds.add(idOf(i));
  const planningTaskStepIds = new Set(Array.from(scan.selection.tasks, idOf));
  const stepIdsOut: Record<string, string> = {};
  const result = await readIFCWithXerReconstruction(readerText, labels, {
    ...xerOptions(opts), literalStepIds, planningTaskStepIds, skipBuildingModelGuard: true, stepIdsOut,
  });
  const mismatch = selectionMismatch(scan, stepIdsOut, result.project.id);
  if (mismatch) return currentRoute(bytes, labels, opts, { kind: 'selectie', field: mismatch });

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

/** De bytes van de stukken die de lezer krijgt: kop, `DATA;`, staart (klasse 0), P, C en A, en het `IfcProject` als
 *  context als dat V is (§4.2, Gevolgen; `projectContext`). Zonder V is dat de bron zelf (geen kopie). Stukgrenzen vallen
 *  op ASCII-bytes, dus het knippen breekt nooit een UTF-8-teken. */
function readerBytes(bytes: Uint8Array, scan: ForeignScanResult): Uint8Array {
  const { classes, chunkStarts, projectContext } = scan;
  if (scan.counts.V === 0) return bytes;
  const skip = (i: number) => classes[i] === 4 && i !== projectContext;
  let size = 0;
  for (let i = 0; i < classes.length; i++) if (!skip(i)) size += chunkStarts[i + 1] - chunkStarts[i];
  const out = new Uint8Array(size);
  let at = 0;
  for (let i = 0; i < classes.length; i++) {
    if (skip(i)) continue;
    out.set(bytes.subarray(chunkStarts[i], chunkStarts[i + 1]), at);
    at += chunkStarts[i + 1] - chunkStarts[i];
  }
  return out;
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
