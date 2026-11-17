// #804 fase 1c: een bestaand doel is alleen vrij als dezelfde indeling als bij openen geen C, A of V vindt.
// De bestaande stroomscanner houdt zijn vroege modelweigering en de strengere grammatica. Daarna gebruikt de controle
// scanForeign; er staat hier geen tweede herkenning van vreemde psets of eigenaars naast classify.
//
// Opslaan in de achtergrond, stap 2: de indeling kost bij 10.000 taken ruim een seconde. De asynchrone ingangen van de
// app laten haar daarom in de scanworker van het openen draaien (`runForeignScan`, één Worker per scan). De synchrone
// `scanForeignTargetBytes` blijft voor de headless kern en de headless MCP-server (Node, geen Worker). Beide wegen
// vertalen de uitkomst met dezelfde functie (`targetOf`).
import { scanForeign, IFC_FOREIGN_SCAN_MAX_BYTES, type ForeignScanOutcome } from './foreignScan';
import { ForeignScanFailure, runForeignScan, type ForeignScanRunOptions } from './foreignScanRunner';
import { scanTargetBytes, scanTargetSource, type TargetModelScan, type TargetSource } from './targetModelScan';

export type TargetForeignScan = TargetModelScan | 'foreign';

/** De indeling naar een doeluitkomst: een weigering van de scanner is 'unreadable', een C, A of V is 'foreign'. */
function targetOf(scan: ForeignScanOutcome): TargetForeignScan {
  if (!scan.ok) return 'unreadable';
  const { C, A, V } = scan.counts;
  return C + A + V > 0 ? 'foreign' : 'no-model';
}

/**
 * De indeling in de scanworker. Ook een inhoudelijke fout uit de Worker rekent de hoofdthread opnieuw: zo is de
 * uitkomst in elk geval die van de synchrone weg bij dezelfde bytes (een echte fout gooit daar opnieuw). Een fout van de
 * Worker is nooit 'no-model'.
 */
async function classifyTarget(bytes: Uint8Array, opts: ForeignScanRunOptions): Promise<TargetForeignScan> {
  try {
    return targetOf(await runForeignScan(bytes, opts));
  } catch (error) {
    if (!(error instanceof ForeignScanFailure)) throw error;
    return targetOf(scanForeign(bytes));
  }
}

/** Het model en de grens vóór de indeling; `null` als de indeling moet beslissen. */
function beforeClassify(bytes: Uint8Array): TargetForeignScan | null {
  const model = scanTargetBytes(bytes);
  if (model !== 'no-model') return model;
  return bytes.length > IFC_FOREIGN_SCAN_MAX_BYTES ? 'unreadable' : null;
}

/** Bytes binnen de bestaande 300 MiB-scangrens; geen scanuitkomst is nooit toestemming om te overschrijven. Synchroon,
 *  zonder Worker: voor de headless kern (`src/core/`) en de headless MCP-server. */
export function scanForeignTargetBytes(bytes: Uint8Array): TargetForeignScan {
  return beforeClassify(bytes) ?? targetOf(scanForeign(bytes));
}

/** Als `scanForeignTargetBytes`, met de indeling in de scanworker: voor de app. */
export async function scanForeignTargetBytesAsync(bytes: Uint8Array, opts: ForeignScanRunOptions = {}): Promise<TargetForeignScan> {
  return beforeClassify(bytes) ?? classifyTarget(bytes, opts);
}

/** Model eerst als stroom, daarna de volledige indeling in de scanworker. Sluit de bron ook bij fouten of een te groot
 *  doel. */
export async function scanForeignTargetSource(source: TargetSource, opts: ForeignScanRunOptions = {}): Promise<TargetForeignScan> {
  try {
    const model = await scanTargetSource({ next: () => source.next(), seek: n => source.seek(n) });
    if (model !== 'no-model') return model;
    await source.seek(0);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await source.next();
      if (chunk === null) break;
      size += chunk.length;
      if (size > IFC_FOREIGN_SCAN_MAX_BYTES) return 'unreadable';
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    return await classifyTarget(bytes, opts);
  } finally { await source.close?.(); }
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
