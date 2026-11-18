/**
 * Ingang van het Rust-commando `place_file_exclusive` (#804, knownbug 1131, stap 3):
 * één bestand exclusief onder een nieuwe naam in dezelfde map plaatsen. Faalt als er op de nieuwe
 * naam al iets staat, in één systeemstap; nooit een terugval (`src-tauri/src/commands/place_file.rs`).
 *
 * Het commando weigert tenzij beide paden absoluut zijn, in dezelfde map staan, precies één van beide
 * namen een eigen hulpbestand is (`save-<id>.ops-save.tmp` of `<naam>.ops-vorige-<id>`) en plugin-fs
 * `rename` beide paden voor deze webview toelaat, en de bron een gewoon bestand met precies één naam is (een harde
 * link weigert het met `hard-linked`, besluit van de technisch beslisser van 18 november 2026: anders lopen de twee
 * namen na een vervanging stil uiteen; het commando leest het aantal van de open bron, ook op Windows, waar
 * plugin-fs `nlink: null` geeft). Buiten Tauri: altijd `unsupported`.
 *
 * De grens van het commando (besluit van de technisch beslisser, 16 november 2026):
 * - nooit een bestaand doel vervangen;
 * - nooit een pad toelaten dat plugin-fs weigert (de oorspronkelijke `from`/`to`-tekst plus de echte map);
 * - een fout van de stap blijft een fout (`EEXIST` is `target-exists`, ook bij hetzelfde inode);
 * - na de stap hoogstens één verplaatsing, geen herstel.
 * Buiten de grens (knownbug 1799): op Unix kan een partij met hernoemrechten in die map tussen controle
 * en stap een ander object onder de hulpnaam zetten. Het commando meldt `source-changed` als het dat
 * achteraf ziet, en kan het missen bij een wissel-terug. Op Windows speelt dit niet.
 *
 * Gebruikt door de nieuwe-naamroute `writeNewUserBytes` in `atomicWrite.ts` (Opslaan als, Exporteren → IFC en
 * `planner_export_ifc` op de desktop; knownbug 1131 stap 4). Ctrl+S op de desktop (stap 5) bouwt erop.
 */

import { isTauri } from '@/utils/platform';

/** Welke controle van het commando weigerde. Gelijk aan `RefusalReason` in `place_file.rs`. */
export type PlaceFileRefusal = 'path-shape' | 'helper-name' | 'scope' | 'not-regular-file' | 'hard-linked';

/**
 * Elke uitkomst, op `code`. Gelijk aan `PlaceOutcome` en `PlaceError` in `place_file.rs`; de proef
 * `place_file_uitkomsten_hebben_vaste_codes` legt de Rust-kant vast.
 * - `placed`: geplaatst en de map vastgelegd.
 * - `dir-not-synced`: geplaatst, maar de fsync van de map mislukte. Het bestand ís verplaatst.
 * - `target-exists`: op het doel stond al iets; beide bestanden onaangeroerd.
 * - `unsupported`: het bestandssysteem of platform kent de exclusieve stap niet; niets verplaatst.
 * - `refused`: een controle weigerde vóór elke wijziging.
 * - `source-changed`: na de stap stond op het doel niet de gecontroleerde bron; het commando raakte
 *   daarna niets meer aan. Belooft geen stand op schijf: leid er geen eigendom of opruimen uit af.
 * - `io`: een andere systeemfout; niets verplaatst, behalve op een netwerkschijf die de fout pas na de
 *   hernoeming meldt (knownbug 1795).
 */
export type PlaceFileOutcome =
  | { code: 'placed' }
  | { code: 'dir-not-synced'; message: string }
  | { code: 'target-exists' }
  | { code: 'unsupported'; message: string }
  | { code: 'refused'; reason: PlaceFileRefusal }
  | { code: 'source-changed' }
  | { code: 'io'; message: string };

const REFUSALS: readonly string[] = ['path-shape', 'helper-name', 'scope', 'not-regular-file', 'hard-linked'] satisfies PlaceFileRefusal[];

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

/** Lees de waarde die het commando teruggaf (of waarmee het weigerde); al het andere is `io`. */
function toPlaceFileOutcome(value: unknown): PlaceFileOutcome {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? record.message : describe(value);
  switch (record.code) {
    case 'placed':
    case 'target-exists':
    case 'source-changed':
      return { code: record.code };
    case 'dir-not-synced':
    case 'unsupported':
    case 'io':
      return { code: record.code, message };
    case 'refused':
      if (typeof record.reason === 'string' && REFUSALS.includes(record.reason)) {
        return { code: 'refused', reason: record.reason as PlaceFileRefusal };
      }
      break;
  }
  return { code: 'io', message };
}

/** Verplaats `from` exclusief naar `to` (beide absolute paden in dezelfde map). */
export async function placeFileExclusive(from: string, to: string): Promise<PlaceFileOutcome> {
  if (!isTauri()) return { code: 'unsupported', message: 'not-tauri' };
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return toPlaceFileOutcome(await invoke('place_file_exclusive', { from, to }));
  } catch (error) {
    return toPlaceFileOutcome(error);
  }
}
