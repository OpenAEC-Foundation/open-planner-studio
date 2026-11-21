// #804, knownbug 1131 stap 1: staat op het eigen doel van een document nog precies de bron die de app in handen heeft
// (`ifcSource.bytes`)? Vóór een vervanging mag de app alleen schrijven als het antwoord "gelijk" is; anders zette een
// ander programma (Bonsai, een synchronisatiemap) er intussen een eigen versie neer.
//
// Eerst de grootte, dan in stukken van 1 MiB byte voor byte vergelijken. Nooit het hele doel in één buffer en geen
// sha256 van het doel: de verwachte bytes staan al in het geheugen, dus de vergelijking is exact, sneller en vraagt een
// vast klein geheugen (besluit van de technisch beslisser, 16 november 2026). De sha256 blijft voor het herstel, waar
// de bytes niet in het geheugen staan.
//
// Alleen een pad (desktop) en een bestandshandle (browser) hebben een doel om te vergelijken. Een site-bestand
// (de host bewaakt de basisversie) en een download (vervangt niets) hebben er geen; daar bestaat deze controle niet.

/** gelijk / gewijzigd / weg / onleesbaar (bestaat of onzeker, maar niet volledig te lezen). */
export type SourceTargetContent = 'same' | 'changed' | 'missing' | 'unreadable';

/** De stukgrootte van de vergelijking, gelijk aan de stukken van de doelscan (`scanTargetPathTauri`). */
export const TARGET_CHUNK_BYTES = 1 << 20;

/**
 * Vergelijk een stroom stukken met de verwachte bytes. `next` geeft `null` aan het eind; een leesfout gooit. Elk stuk
 * wordt na de vergelijking losgelaten: het geheugen groeit niet mee met het bestand.
 */
export async function compareTargetChunks(
  next: () => Promise<Uint8Array | null>, expected: Uint8Array,
): Promise<'same' | 'changed'> {
  let offset = 0;
  for (let chunk = await next(); chunk !== null; chunk = await next()) {
    if (offset + chunk.length > expected.length) return 'changed';
    for (let i = 0; i < chunk.length; i++) if (chunk[i] !== expected[offset + i]) return 'changed';
    offset += chunk.length;
  }
  return offset === expected.length ? 'same' : 'changed';
}

/** Browser: de handle via `getFile()` en `File.slice()`. Een verdwenen bestand geeft `NotFoundError`. */
export async function sourceTargetContentOfHandle(
  handle: FileSystemFileHandle, expected: Uint8Array,
): Promise<SourceTargetContent> {
  let file: File;
  try {
    file = await handle.getFile();
  } catch (error) {
    return (error as { name?: unknown } | null)?.name === 'NotFoundError' ? 'missing' : 'unreadable';
  }
  if (file.size !== expected.length) return 'changed';
  let offset = 0;
  try {
    return await compareTargetChunks(async () => {
      if (offset >= file.size) return null;
      const end = Math.min(offset + TARGET_CHUNK_BYTES, file.size);
      const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      if (chunk.length === 0) return null;
      offset += chunk.length;
      return chunk;
    }, expected);
  } catch {
    // Chromium geeft `NotReadableError` als het bestand na `getFile()` veranderde; elke leesfout is onleesbaar.
    return 'unreadable';
  }
}
