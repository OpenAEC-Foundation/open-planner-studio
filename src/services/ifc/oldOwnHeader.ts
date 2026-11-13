/** De ene ruwe kopvorm van de 17 tags v2026.2.0 t/m v2026.7.12: LF, IFC4X3, drie vrije FILE_NAME-velden.
 * Geen afhankelijkheid van lezer of scanners: zij delen deze herkenning, met posities in hun eigen invoer.
 */
const PREFIX = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\nFILE_NAME('";
const AFTER_LINE = "\nFILE_SCHEMA(('IFC4X3'));\nENDSEC;\nDATA;\n";
const NAME_DATE = ".ifc','";
const DATE_AUTHOR = "',('";
const AUTHOR_COMPANY = "'),('";
const END_NAME = "'),'Open Planner Studio 0.1','Open Planner Studio','');";
// Alleen ASCII-ankers; één code-eenheid per byte, ook bij UTF-8. Nooit terugcoderen voor een positie.
const byteText = new TextDecoder('latin1');
const utf8 = new TextDecoder();
export interface OldOwnHeader {
  /** Positie van de D van DATA;, in bytes of UTF-16-code-eenheden volgens de invoer. */
  readonly dataStart: number;
  /** Direct na de LF van DATA;. */
  readonly end: number;
  readonly fields: ReadonlyArray<readonly [number, number]>;
}

/** Een vrij veld met een scheidingsstuk maakt de ontleding dubbelzinnig. */
function uniqueAt(line: string, part: string): number {
  const at = line.indexOf(part);
  return at >= 0 && line.indexOf(part, at + 1) < 0 ? at : -1;
}

/** Exacte herkenning: null = anders; undefined = nog onvolledig (alleen bij een stroom, complete=false).
 * Geen grens aan de veldlengte: ook de doelcontrole gebruikt deze regel, voorbij de vroegere 64 KiB.
 */
export function recognizeOldOwnHeader(content: string | Uint8Array, complete = true): OldOwnHeader | null | undefined {
  const codeAt = (i: number) => typeof content === 'string' ? content.charCodeAt(i) : content[i];
  const match = (at: number, fixed: string): boolean | undefined => {
    const n = Math.min(fixed.length, content.length - at);
    for (let i = 0; i < n; i++) if (codeAt(at + i) !== fixed.charCodeAt(i)) return false;
    return n === fixed.length ? true : complete ? false : undefined;
  };
  const prefix = match(0, PREFIX);
  if (prefix !== true) return prefix === false ? null : undefined;
  const endLine = typeof content === 'string' ? content.indexOf('\n', PREFIX.length) : content.indexOf(0x0a, PREFIX.length);
  if (endLine < 0) return complete ? null : undefined;
  const tail = match(endLine, AFTER_LINE);
  if (tail !== true) return tail === false ? null : undefined;
  const line = typeof content === 'string' ? content.slice(PREFIX.length, endLine)
    : byteText.decode(content.subarray(PREFIX.length, endLine));
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
  const fields = [[0, nameEnd], [authorStart, authorEnd], [companyStart, companyEnd]] as const;
  for (const [start, end] of fields) {
    const value = line.slice(start, end);
    const text = typeof content === 'string' ? value : utf8.decode(content.subarray(PREFIX.length + start, PREFIX.length + end));
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return null;
    }
    // Een puntkomma mag: de hele regel tussen de vaste ankers is kop en wordt voor de scan gemaskeerd.
    if (value.includes("',") || value.includes("')") || value.includes("('")) return null;
  }
  const end = endLine + AFTER_LINE.length;
  return { dataStart: end - 'DATA;\n'.length, end, fields: fields.map(([a, b]) => [PREFIX.length + a, PREFIX.length + b]) };
}
