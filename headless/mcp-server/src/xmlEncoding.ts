// Alleen de byte→tekst-grens voor XML-bestanden; geen decoderwijziging voor IFC, CSV, XER of MPP.
// XML 1.0 §4.3.3 en Appendix F: https://www.w3.org/TR/xml/#sec-guessing
import { FileTextDecodingError } from '@/services/mcp/fileTextError';

export function decodeXmlBytes(bytes: Uint8Array): string {
  const starts = (...prefix: number[]) => prefix.every((value, i) => bytes[i] === value);
  // UTF-32 eerst herkennen: de LE-BOM begint net als UTF-16 met FF FE.
  if (starts(0xff, 0xfe, 0, 0) || starts(0, 0, 0xfe, 0xff)
    || starts(0, 0, 0, 0x3c) || starts(0x3c, 0, 0, 0)) {
    throw new FileTextDecodingError('UTF-32 XML is not supported. Export as UTF-8 or UTF-16.');
  }
  let encoding = 'utf-8';
  let bom = false;
  if (starts(0xff, 0xfe)) { encoding = 'utf-16le'; bom = true; }
  else if (starts(0xfe, 0xff)) { encoding = 'utf-16be'; bom = true; }
  else if (starts(0x3c, 0, 0x3f, 0)) encoding = 'utf-16le';
  else if (starts(0, 0x3c, 0, 0x3f)) encoding = 'utf-16be';

  let text: string;
  try {
    // Geen stil ingevoegde vervangtekens bij een afgebroken bytepaar of surrogate.
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new FileTextDecodingError(`Invalid ${encoding.toUpperCase()} XML byte sequence.`);
  }
  const declaration = /^<\?xml[\t\r\n ]+([\s\S]*?)\?>/.exec(text)?.[1];
  const declared = declaration?.match(/(?:^|[\t\r\n ])encoding[\t\r\n ]*=[\t\r\n ]*(['"])([^'"]+)\1/)?.[2].toLowerCase();
  if (declared && !['utf-8', 'utf-16', 'utf-16le', 'utf-16be'].includes(declared)) {
    throw new FileTextDecodingError(`Unsupported XML encoding '${declared}'. Export as UTF-8 or UTF-16.`);
  }
  if (declared && declared !== encoding && !(declared === 'utf-16' && encoding.startsWith('utf-16'))) {
    throw new FileTextDecodingError(`XML encoding '${declared}' conflicts with the detected ${encoding.toUpperCase()} bytes.`);
  }
  if (encoding !== 'utf-8' && !bom && declared !== encoding) {
    throw new FileTextDecodingError('UTF-16 XML without a BOM must declare UTF-16LE or UTF-16BE.');
  }
  return text;
}
