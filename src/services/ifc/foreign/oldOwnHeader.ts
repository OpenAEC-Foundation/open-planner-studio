/** De ene ruwe kopvorm van OPS v2026.2.0 t/m v2026.7.12 (ook tag 2026.7.12).
 * Alle 17 tags: LF, IFC4X3, dezelfde vaste regels en now = toISOString().split('.')[0]. Vanaf v2026.7.13 zijn de
 * drie vrije velden beschermd. Alleen na een strenge scanfout proberen we deze vorm; DATA blijft ongewijzigd streng.
 */
import { scanStep, StepScanError, type StepIndex } from './stepScanner';

const enc = new TextEncoder();
const PREFIX = enc.encode("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\nFILE_NAME('");
const AFTER_LINE = enc.encode("\nFILE_SCHEMA(('IFC4X3'));\nENDSEC;\nDATA;\n");
const NAME_DATE = ".ifc','";
const DATE_AUTHOR = "',('";
const AUTHOR_COMPANY = "'),('";
const END_NAME = "'),'Open Planner Studio 0.1','Open Planner Studio','');";
// Eén code-eenheid per bronbyte, ook voor UTF-8/Latin-1: alleen ASCII-ankers vergelijken, niets terugcoderen.
const decoder = new TextDecoder('latin1');

function matches(bytes: Uint8Array, at: number, expected: Uint8Array): boolean {
  return at + expected.length <= bytes.length && expected.every((b, i) => bytes[at + i] === b);
}

/** Een scheidingsstuk in een vrij veld maakt de ontleding dubbelzinnig. Er moet precies één voorkomen zijn. */
function uniqueAt(line: string, part: string): number {
  const at = line.indexOf(part);
  return at >= 0 && line.indexOf(part, at + 1) < 0 ? at : -1;
}

/** Even lange scankopie, of null. Geen regeleinden, statements of extra veldsyntaxis in de drie vrije plaatsen. */
function oldHeaderForScan(bytes: Uint8Array): Uint8Array | null {
  if (!matches(bytes, 0, PREFIX)) return null;
  const endLine = bytes.indexOf(0x0a, PREFIX.length);
  if (endLine < 0 || !matches(bytes, endLine, AFTER_LINE)) return null;
  const line = decoder.decode(bytes.subarray(PREFIX.length, endLine));
  if (!line.endsWith(END_NAME)) return null;
  const nameEnd = uniqueAt(line, NAME_DATE);
  if (nameEnd < 0) return null;
  const dateStart = nameEnd + NAME_DATE.length;
  const dateEnd = dateStart + 19;
  const stamp = line.slice(dateStart, dateEnd);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(stamp) || !line.startsWith(DATE_AUTHOR, dateEnd)) return null;
  const time = new Date(`${stamp}Z`);
  if (!Number.isFinite(time.getTime()) || time.toISOString().slice(0, 19) !== stamp) return null;
  const authorStart = dateEnd + DATE_AUTHOR.length;
  const authorEnd = uniqueAt(line, AUTHOR_COMPANY);
  const companyStart = authorEnd + AUTHOR_COMPANY.length;
  const companyEnd = line.length - END_NAME.length;
  if (authorEnd < authorStart || companyEnd < companyStart) return null;
  const fields = [[0, nameEnd], [authorStart, authorEnd], [companyStart, companyEnd]];
  for (const [start, end] of fields) {
    // Losse apostroffen, ook aan beide uiteinden en meer dan één, zijn juist de oude bug. Een quote met aangrenzende
    // veld-/statementsyntaxis is niet eenduidig te onderscheiden van een extra veld of kopregel: dan niet herkennen.
    for (let i = start; i < end; i++) {
      const code = line.charCodeAt(i);
      if (code < 0x20 || code === 0x7f || code === 0x3b) return null;
    }
    const value = line.slice(start, end);
    if (value.includes("',") || value.includes("')") || value.includes("('")) return null;
  }
  // Ook bij Node-buffers een zelfstandige kopie: Buffer.slice() zou de bron delen.
  const safe = new Uint8Array(bytes);
  for (const [start, end] of fields) safe.fill(0x78, PREFIX.length + start, PREFIX.length + end);
  return safe;
}

/** Gedeelde ingang vóór indeling, voor openen en de merge. Een leesbaar bestand behoudt de gewone index/bytes. */
export function scanForeignStep(bytes: Uint8Array): StepIndex {
  try {
    return scanStep(bytes);
  } catch (error) {
    if (!(error instanceof StepScanError)) throw error;
    const safe = oldHeaderForScan(bytes);
    if (!safe) throw error;
    return scanStep(safe);
  }
}
