/** Barrel voor de XLSX-laag (issue #27, etappe 3). Puur en injecteerbaar, net als `services/zip`:
 *  geen store, geen React, geen `@tauri-apps/*`, geen module-level muteerbare state — en geen i18n,
 *  want alle gebruikerszichtbare tekst komt bij de schrijver van BUITEN binnen (`ProgressXlsxText`).
 *
 *  Let op: importeer in app-code bij voorkeur de losse module achter een dynamic import
 *  (`import('@/services/xlsx/writeProgressXlsx')`) — deze barrel trekt lezer én schrijver samen en
 *  hoort daarmee niet in de hoofdbundel. Hij bestaat voor de tests en voor afnemers die beide
 *  kanten nodig hebben. */
export { escapeXmlAttr, escapeXmlText, unescapeXml } from './xmlText';
export { MIN_READABLE_SERIAL_1900, isoToSerial, serialToIso } from './serialDate';
export {
  buildProgressXlsxParts,
  writeProgressSheetXLSX,
  type ProgressXlsxText,
} from './writeProgressXlsx';
export {
  XLSX_LIMITS,
  XLSX_METADATA_PARTS,
  XlsxReadError,
  columnFromCellRef,
  readXlsxSheet,
  readXlsxSheetWith,
  scanXml,
  type XlsxCell,
  type XlsxLimits,
  type XlsxReadIssue,
  type XlsxRow,
  type XlsxSheet,
  type XlsxZipReader,
  type XmlEvent,
} from './readXlsxSheet';
