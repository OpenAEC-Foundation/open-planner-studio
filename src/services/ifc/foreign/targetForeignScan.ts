// #804 fase 1c: een bestaand doel is alleen vrij als dezelfde indeling als bij openen geen C, A of V vindt.
// De bestaande stroomscanner houdt zijn vroege modelweigering en de strengere grammatica. Daarna gebruikt de controle
// scanForeign; er staat hier geen tweede herkenning van vreemde psets of eigenaars naast classify.
//
// Opslaan in de achtergrond, stap 2 en knownbug 1758: bij 10.000 taken kost de modelscan ongeveer 0,7 s en de
// indeling ongeveer 0,4 s. De asynchrone ingangen van de app laten allebei in de scanworker draaien (`withScanWorker`,
// één Worker per scan). De hoofdthread leest alleen de stukken en stuurt ze één voor één; de Worker houdt de scanner en
// antwoordt per stuk met de stap (verder, terugspoelen of de uitkomst). Zo blijven de vroege stop bij een
// modelentiteit, het terugspoelen en de grens van 300 MiB precies zoals op de hoofdthread. De synchrone
// `scanForeignTargetBytes` blijft voor de headless kern en de headless MCP-server (Node, geen Worker). Alle wegen
// vertalen de uitkomst met dezelfde functie (`targetOf`).
import { scanForeign, IFC_FOREIGN_SCAN_MAX_BYTES, type ForeignScanOutcome } from './foreignScan';
import { ForeignScanFailure, withScanWorker, type ForeignScanRunOptions } from './foreignScanRunner';
import { driveTargetScan, scanTargetBytes, targetScanPush, type TargetModelScan, type TargetScanStep, type TargetSource } from './targetModelScan';
import { StepScanError, utf8BomLength, type StepIndex } from './stepScanner';
import { scanForeignStep } from './oldOwnHeader';
import { classify, hasOwnOrigin } from './classify';
import { IFC_SLOT_TABLES, type IfcSlotTable } from '../ifcSlotTables';
import { IFC_BASELINE_SCHEDULE_SLOTS, IFC_LIVE_SCHEDULE_SLOTS, workControlSlots } from '../ifcWorkControlSlots';
import type { SlotPositions } from '../ifcSlotSoort';
import { OPS_LEGACY_LITERAL_APP_VERSION } from '../ifcPsets';
import { decodeStepText } from '../stepText';

export type TargetForeignScan = TargetModelScan | 'foreign';

/** De indeling naar een doeluitkomst: een weigering van de scanner is 'unreadable', een C, A of V is 'foreign'. */
function targetOf(scan: ForeignScanOutcome): TargetForeignScan {
  if (!scan.ok) return 'unreadable';
  const { C, A, V } = scan.counts;
  return C + A + V > 0 ? 'foreign' : 'no-model';
}

function planningOnly(bytes: Uint8Array): Exclude<TargetForeignScan, 'no-model'> | StepIndex {
  const model = scanTargetBytes(bytes);
  if (model !== 'no-model') return model;
  if (bytes.length > IFC_FOREIGN_SCAN_MAX_BYTES || utf8BomLength(bytes) > 0) return 'unreadable';
  let index: StepIndex;
  try {
    index = scanForeignStep(bytes);
  } catch (error) {
    if (error instanceof StepScanError) return 'unreadable';
    throw error;
  }
  const { C, A, V } = classify(index).counts;
  return C + A + V > 0 ? 'foreign' : index;
}

/** Bytes binnen de bestaande 300 MiB-scangrens; geen scanuitkomst is nooit toestemming om te overschrijven. Synchroon,
 *  zonder Worker: voor de headless kern (`src/core/`) en de headless MCP-server. */
export function scanForeignTargetBytes(bytes: Uint8Array): TargetForeignScan {
  const scan = planningOnly(bytes);
  return typeof scan === 'string' ? scan : 'no-model';
}

export type TextWriteRefusal = Exclude<TargetForeignScan, 'no-model' | 'not-ifc'>;

export type TextWriteCheck = TextWriteRefusal | ((written: string) => TextWriteRefusal | null);

export function textWriteCheck(text: string): TextWriteCheck {
  const scan = planningOnly(new TextEncoder().encode(text.replace(/^\uFEFF/, '').trimStart()));
  if (scan === 'not-ifc') return () => null;
  if (typeof scan === 'string') return scan;
  return (written) => (writerKeepsEverySlot(scan, scanForeignStep(new TextEncoder().encode(written))) ? null : 'foreign');
}

interface SlotRow {
  readonly chunk: number;
  readonly table: IfcSlotTable;
  readonly args: readonly string[];
  readonly at: SlotPositions<string>;
}

const isRootTable = (table: IfcSlotTable) => table.slots.some(slot => slot.key === 'ownerHistory');

export function slotTableOf(type: string, args: readonly string[]): IfcSlotTable | undefined {
  const baseline = type === 'IFCWORKSCHEDULE' && (args[workControlSlots(args).predefinedType] ?? '').includes('BASELINE');
  return IFC_SLOT_TABLES.find(table => table.entities.includes(type)
    && (type !== 'IFCWORKSCHEDULE' || (table.slots === IFC_BASELINE_SCHEDULE_SLOTS) === baseline));
}

function slotRows(index: StepIndex): { rows: SlotRow[]; keyOf: Map<number, string>; ownerOf: Map<number, number> } {
  const rows: SlotRow[] = [];
  const byChunk = new Map<number, SlotRow>();
  for (let i = 0; i < index.count; i++) {
    const args = index.isEntity(i) ? index.argTokens(i) : undefined;
    const table = args && slotTableOf(index.type(i), args);
    if (!args || !table) continue;
    const row = { chunk: i, table, args, at: table.positions(args) };
    rows.push(row);
    byChunk.set(i, row);
  }
  const keyOf = new Map<number, string>();
  const ownerOf = new Map<number, number>();
  for (const row of rows) {
    if (!isRootTable(row.table)) continue;
    const guid = `${row.table.naam}:${index.globalId(row.chunk)}`;
    if (!keyOf.has(row.chunk)) keyOf.set(row.chunk, guid);
    for (const slot of row.table.slots) {
      if (slot.soort !== 'verwijzing' || slot.key === 'ownerHistory') continue;
      for (const part of index.refsAt(row.chunk, row.at[slot.key])) {
        const partRow = byChunk.get(part);
        if (!partRow || isRootTable(partRow.table) || keyOf.has(part)) continue;
        keyOf.set(part, `${guid}/${slot.key}`);
        ownerOf.set(part, row.chunk);
      }
    }
  }
  return { rows, keyOf, ownerOf };
}

const isEmpty = (token: string | undefined) => token === undefined || token === '$';

function readsLiterally(index: StepIndex): boolean {
  let opsPset = false;
  for (let i = 0; i < index.count; i++) {
    const app = index.application(i);
    if (app?.identifier === 'OPS') return app.version === OPS_LEGACY_LITERAL_APP_VERSION;
    opsPset ||= index.type(i) === 'IFCPROPERTYSET' && (index.argTokens(i)?.[2] ?? '').startsWith("'OPS_");
  }
  return opsPset;
}

function valueOf(row: SlotRow, key: string, text: (row: SlotRow, token: string) => string): string {
  const token = row.args[row.at[key]];
  if (isEmpty(token)) return '$';
  return token!.startsWith("'") ? `'${text(row, token!)}` : token!;
}

const LIVE_SCHEDULE_NAME_SLOT = `${IFC_SLOT_TABLES.find(table => table.slots === IFC_LIVE_SCHEDULE_SLOTS)!.naam}.name`;
const EARLIER_LIVE_SCHEDULE_NAME = "'Bouwplanning v1.0";

function writerKeepsEverySlot(source: StepIndex, written: StepIndex): boolean {
  const out = slotRows(written);
  const writtenText = (row: SlotRow, token: string) => written.tokenText(row.chunk, token);
  const literal = readsLiterally(source);
  const sourceText = (_row: SlotRow, token: string) => {
    const body = token.slice(1, -1).replace(/''/g, "'");
    return literal ? body : decodeStepText(body);
  };
  const constants = new Map<string, Set<string>>([[LIVE_SCHEDULE_NAME_SLOT, new Set([EARLIER_LIVE_SCHEDULE_NAME])]]);
  const twins = new Map<string, SlotRow>();
  for (const row of out.rows) {
    const key = out.keyOf.get(row.chunk);
    if (key !== undefined && !twins.has(key)) twins.set(key, row);
    for (const slot of row.table.slots) {
      const name = `${row.table.naam}.${slot.key}`;
      const values = constants.get(name) ?? new Set<string>();
      values.add(valueOf(row, slot.key, writtenText));
      constants.set(name, values);
    }
  }
  const src = slotRows(source);
  for (const row of src.rows) {
    const root = src.ownerOf.get(row.chunk) ?? (isRootTable(row.table) ? row.chunk : -1);
    const foreign = root < 0 || !hasOwnOrigin(source, root);
    const covered = new Set(Object.values(row.at));
    if (row.args.some((token, k) => !covered.has(k) && !isEmpty(token))) return false;
    const twinKey = src.keyOf.get(row.chunk);
    const twin = twinKey === undefined ? undefined : twins.get(twinKey);
    for (const slot of row.table.slots) {
      const value = valueOf(row, slot.key, sourceText);
      if (value === '$') continue;
      const soort = foreign ? slot.soortVreemd ?? slot.soort : slot.soort;
      if (soort === 'verwijzing' || soort === 'afgeleid') continue;
      if (soort === 'constant') {
        if (slot.bronverwijzing || !constants.get(`${row.table.naam}.${slot.key}`)?.has(value)) return false;
      } else if (foreign && (twin === undefined || valueOf(twin, slot.key, writtenText) !== value)) {
        return false;
      }
    }
  }
  return true;
}

/** De hele bron vanaf het begin; `null` boven de grens van 300 MiB (zonder verder te lezen). */
async function readWhole(source: Pick<TargetSource, 'next' | 'seek'>): Promise<Uint8Array | null> {
  await source.seek(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await source.next();
    if (chunk === null) break;
    size += chunk.length;
    if (size > IFC_FOREIGN_SCAN_MAX_BYTES) return null;
    chunks.push(chunk);
  }
  if (chunks.length === 1) return chunks[0];
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return bytes;
}

/** Model eerst als stroom, daarna de volledige indeling; `push` en `classify` op de hoofdthread of in de Worker. */
async function scanSource(
  source: Pick<TargetSource, 'next' | 'seek'>,
  push: (chunk: Uint8Array | null) => TargetScanStep | Promise<TargetScanStep>,
  classify: (bytes: Uint8Array) => Promise<ForeignScanOutcome> | ForeignScanOutcome,
): Promise<TargetForeignScan> {
  const model = await driveTargetScan(source, push);
  if (model !== 'no-model') return model;
  const bytes = await readWhole(source);
  return bytes && utf8BomLength(bytes) === 0 ? targetOf(await classify(bytes)) : 'unreadable';
}

/**
 * Model eerst als stroom, daarna de volledige indeling, allebei in de scanworker. Zonder Worker, bij een fout van het
 * transport en ook bij een inhoudelijke fout uit de Worker rekent de hoofdthread het opnieuw vanaf het begin: zo is de
 * uitkomst in elk geval die van de synchrone weg (een echte fout gooit daar opnieuw). Een fout van de Worker is nooit
 * 'no-model'. Sluit de bron ook bij fouten of een te groot doel.
 */
export async function scanForeignTargetSource(source: TargetSource, opts: ForeignScanRunOptions = {}): Promise<TargetForeignScan> {
  try {
    let read = false;
    const tracked = { next: () => { read = true; return source.next(); }, seek: (n: number) => source.seek(n) };
    const onMain = async () => {
      if (read) await source.seek(0);
      return scanSource(source, targetScanPush(), scanForeign);
    };
    try {
      return await withScanWorker(opts, session => scanSource(tracked, session.step, session.outcome), onMain);
    } catch (error) {
      if (!(error instanceof ForeignScanFailure)) throw error;
      return await onMain();
    }
  } finally { await source.close?.(); }
}

/** Als `scanForeignTargetBytes`, in de scanworker: voor de app (de siteroute). De bytes zijn een bron met één stuk;
 *  terugspoelen geeft het stuk vanaf die positie, zoals `scanTargetBytes`. */
export function scanForeignTargetBytesAsync(bytes: Uint8Array, opts: ForeignScanRunOptions = {}): Promise<TargetForeignScan> {
  let at: number | null = 0;
  return scanForeignTargetSource({
    next: async () => {
      if (at === null) return null;
      const chunk = bytes.subarray(at);
      at = null;
      return chunk;
    },
    seek: async (offset) => { at = offset; },
  }, opts);
}

/** FSA-bestand; een lege, door de kiezer aangemaakte file blijft een normaal nieuw doel. */
export async function scanForeignTargetBlob(blob: Blob, opts: ForeignScanRunOptions = {}): Promise<TargetForeignScan> {
  if (blob.size > IFC_FOREIGN_SCAN_MAX_BYTES) return 'unreadable';
  let reader = blob.stream().getReader();
  const cancel = async () => { try { await reader.cancel(); } catch { /* al dicht */ } };
  return scanForeignTargetSource({
    next: async () => { const r = await reader.read(); return r.done ? null : r.value; },
    seek: async offset => { await cancel(); reader = blob.slice(offset).stream().getReader(); },
    close: cancel,
  }, opts);
}
