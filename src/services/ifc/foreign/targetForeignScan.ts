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

export type TargetForeignScan = TargetModelScan | 'foreign';

/** De indeling naar een doeluitkomst: een weigering van de scanner is 'unreadable', een C, A of V is 'foreign'. */
function targetOf(scan: ForeignScanOutcome): TargetForeignScan {
  if (!scan.ok) return 'unreadable';
  const { C, A, V } = scan.counts;
  return C + A + V > 0 ? 'foreign' : 'no-model';
}

/** Bytes binnen de bestaande 300 MiB-scangrens; geen scanuitkomst is nooit toestemming om te overschrijven. Synchroon,
 *  zonder Worker: voor de headless kern (`src/core/`) en de headless MCP-server. */
export function scanForeignTargetBytes(bytes: Uint8Array): TargetForeignScan {
  const model = scanTargetBytes(bytes);
  if (model !== 'no-model') return model;
  return bytes.length > IFC_FOREIGN_SCAN_MAX_BYTES ? 'unreadable' : targetOf(scanForeign(bytes));
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
  return bytes ? targetOf(await classify(bytes)) : 'unreadable';
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

/** Alleen de modelscan van bytes in het geheugen (`scanTargetBytes`, zonder de indeling erna), in de scanworker. Zonder
 *  Worker of bij een fout van het transport, en ook bij een inhoudelijke fout uit de Worker, op de hoofdthread: de uitkomst
 *  is altijd die van de synchrone weg. Voor de vraag of een geopend document een gebouwmodel heeft
 *  (`documentHasBuildingModel`, knownbug 1768 en 1740). */
export async function scanTargetModelBytesAsync(bytes: Uint8Array, opts: ForeignScanRunOptions = {}): Promise<TargetModelScan> {
  let at: number | null = 0;
  const source = {
    next: async () => {
      if (at === null) return null;
      const chunk = bytes.subarray(at);
      at = null;
      return chunk;
    },
    seek: async (offset: number) => { at = offset; },
  };
  const onMain = () => scanTargetBytes(bytes);
  try {
    return await withScanWorker(opts, session => driveTargetScan(source, session.step), onMain);
  } catch (error) {
    if (!(error instanceof ForeignScanFailure)) throw error;
    return onMain();
  }
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
