// #804 fase 1c: een bestaand doel is alleen vrij als dezelfde indeling als bij openen geen C, A of V vindt.
// De bestaande stroomscanner houdt zijn vroege modelweigering en de strengere grammatica. Daarna gebruikt de controle
// scanForeign; er staat hier geen tweede herkenning van vreemde psets of eigenaars naast classify.
import { scanForeign, IFC_FOREIGN_SCAN_MAX_BYTES } from './foreignScan';
import { scanTargetBytes, scanTargetSource, type TargetModelScan, type TargetSource } from './targetModelScan';

export type TargetForeignScan = TargetModelScan | 'foreign';

function classifyTarget(bytes: Uint8Array): TargetForeignScan {
  const scan = scanForeign(bytes);
  if (!scan.ok) return 'unreadable';
  const { C, A, V } = scan.counts;
  return C + A + V > 0 ? 'foreign' : 'no-model';
}

/** Bytes binnen de bestaande 300 MiB-scangrens; geen scanuitkomst is nooit toestemming om te overschrijven. */
export function scanForeignTargetBytes(bytes: Uint8Array): TargetForeignScan {
  const model = scanTargetBytes(bytes);
  if (model !== 'no-model') return model;
  if (bytes.length > IFC_FOREIGN_SCAN_MAX_BYTES) return 'unreadable';
  return classifyTarget(bytes);
}

/** Model eerst als stroom, daarna de volledige indeling. Sluit de bron ook bij fouten of een te groot doel. */
export async function scanForeignTargetSource(source: TargetSource): Promise<TargetForeignScan> {
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
    return classifyTarget(bytes);
  } finally { await source.close?.(); }
}

/** FSA-bestand; een lege, door de kiezer aangemaakte file blijft een normaal nieuw doel. */
export async function scanForeignTargetBlob(blob: Blob): Promise<TargetForeignScan> {
  if (blob.size > IFC_FOREIGN_SCAN_MAX_BYTES) return 'unreadable';
  let reader = blob.stream().getReader();
  const cancel = async () => { try { await reader.cancel(); } catch { /* al dicht */ } };
  return scanForeignTargetSource({
    next: async () => { const r = await reader.read(); return r.done ? null : r.value; },
    seek: async offset => { await cancel(); reader = blob.slice(offset).stream().getReader(); },
    close: cancel,
  });
}
