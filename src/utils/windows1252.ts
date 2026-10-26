// Windows-1252 volgens de WHATWG Encoding Standard, onafhankelijk van de ICU-build van Node.
// Bron: https://encoding.spec.whatwg.org/index-windows-1252.txt (2024-09-18).
// Alleen 0x80–0x9F wijkt af van de rechtstreekse byte→Unicode-mapping; de vijf C1-controls blijven staan.
const HIGH_CONTROLS = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
] as const;

export function decodeWindows1252(bytes: Uint8Array): string {
  // Begrens de argumentenlijst: grote XER-bestanden mogen geen call-stack/argumentlimiet raken.
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 8192) {
    const end = Math.min(start + 8192, bytes.length);
    const codes: number[] = [];
    for (let i = start; i < end; i++) {
      const byte = bytes[i];
      codes.push(byte >= 0x80 && byte <= 0x9f ? HIGH_CONTROLS[byte - 0x80] : byte);
    }
    chunks.push(String.fromCharCode(...codes));
  }
  return chunks.join('');
}
