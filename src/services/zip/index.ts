/** Barrel voor de ZIP-laag (issue #27, etappe 3). Puur en injecteerbaar: geen store, geen React,
 *  geen `@tauri-apps/*`, geen module-level muteerbare state — zodat zowel de extensie-installatie
 *  als de `.xlsx`-lezer/-schrijver hem kunnen delen zonder elkaars bundel binnen te trekken. */
export { crc32 } from './crc32';
export {
  EXTENSION_ZIP_LIMITS,
  ZipValidationError,
  inflateRawBounded,
  parseZipEntries,
  type ZipEntry,
  type ZipReadLimits,
} from './zipReader';
export { writeZip, type ZipFileInput } from './zipWriter';
