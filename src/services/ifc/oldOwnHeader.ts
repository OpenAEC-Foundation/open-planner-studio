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
const enc = new TextEncoder();
/** Main telde de hele UTF-8-prefix t/m de LF na FILE_NAME, niet alleen de vrije tekst. */
export const OLD_OWN_HEADER_PREFIX_MAX = 64 << 10;
export interface OldOwnHeader {
  /** Positie van de D van DATA;, in bytes of UTF-16-code-eenheden volgens de invoer. */
  readonly dataStart: number;
  readonly fields: ReadonlyArray<readonly [number, number]>;
}

/** Een vrij veld met een scheidingsstuk maakt de ontleding dubbelzinnig. */
function uniqueAt(line: string, part: string): number {
  const at = line.indexOf(part);
  return at >= 0 && line.indexOf(part, at + 1) < 0 ? at : -1;
}

/** Exacte herkenning: object = maskeren/vaste DATA-grens; null = anders; undefined = nog onvolledig.
 * 'main' = de vaste buitenvorm klopt, maar vrije tekst mag niet worden gemaskeerd of overgeslagen. Alleen de
 * doelcontrole behoudt dan de oude leeslus van main; scan en lezer gebruiken hun gewone route.
 * De ene 64-KiB-grens is die van main, voor alle drie gebruikers gelijk.
 */
export function recognizeOldOwnHeader(content: string | Uint8Array, complete = true): OldOwnHeader | 'main' | null | undefined {
  const codeAt = (i: number) => typeof content === 'string' ? content.charCodeAt(i) : content[i];
  const match = (at: number, fixed: string): boolean | undefined => {
    const n = Math.min(fixed.length, content.length - at);
    for (let i = 0; i < n; i++) if (codeAt(at + i) !== fixed.charCodeAt(i)) return false;
    return n === fixed.length ? true : complete ? false : undefined;
  };
  const prefix = match(0, PREFIX);
  if (prefix !== true) return prefix === false ? null : undefined;
  const endLine = typeof content === 'string' ? content.indexOf('\n', PREFIX.length) : content.indexOf(0x0a, PREFIX.length);
  if (endLine < 0) {
    const size = typeof content === 'string' ? enc.encode(content.slice(0, OLD_OWN_HEADER_PREFIX_MAX)).length : content.length;
    return complete || size >= OLD_OWN_HEADER_PREFIX_MAX ? null : undefined;
  }
  if (endLine >= OLD_OWN_HEADER_PREFIX_MAX) return null;
  const prefixBytes = typeof content === 'string' ? enc.encode(content.slice(0, endLine + 1)).length : endLine + 1;
  if (prefixBytes > OLD_OWN_HEADER_PREFIX_MAX) return null;
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
  let mainOnly = false;
  for (const [start, end] of fields) {
    const value = line.slice(start, end);
    const text = typeof content === 'string' ? value : utf8.decode(content.subarray(PREFIX.length + start, PREFIX.length + end));
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Main beëindigt de FILE_NAME-regel bij CR/LF. Andere stuurtekens krijgen geen kopuitzondering,
      // maar behouden wel de bestaande doelroute van main binnen dezelfde bytegrens.
      if (code === 0x0d || code === 0x0a) return null;
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) mainOnly = true;
    }
    // readEntity (ifcReader.ts) leest #\w+[ASCII-witruimte]*=; die private regel heeft geen gedeelde export.
    // Zo'n begin kan voor main echte inhoud zijn en mag dus nooit verdwijnen achter maskering of een latere DATA-grens.
    // Commentaar kan ids samenvoegen of de rest verbergen; ook dat blijft volledig op de main-route.
    if (/#\w+[ \t\r\n\v\f]*=/.test(value) || value.includes('/*') || value.includes('*/')) mainOnly = true;
    // Een losse apostrof en een puntkomma mogen; quote/veldgrenzen, ook met tussenruimte, zijn geen vrije tekst.
    if (/'\s*[,)]|[(,]\s*'/.test(value)) mainOnly = true;
  }
  if (mainOnly) return 'main';
  const end = endLine + AFTER_LINE.length;
  return { dataStart: end - 'DATA;\n'.length, fields: fields.map(([a, b]) => [PREFIX.length + a, PREFIX.length + b]) };
}
