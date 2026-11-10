/**
 * STEP-tekst terug naar gewone tekst (ISO 10303-21 §6.4.3). Een eigen bladmodule (#804 fase 1a): de lezer
 * (`ifcReader.ts`) en de scanner (`foreign/stepScanner.ts`) delen deze functie, en de scanner draait in een
 * Worker die zo niet de hele lezer hoeft te laden. `ifcReader.ts` exporteert haar opnieuw.
 */
const HEX4 = /^[0-9A-Fa-f]{4}$/;
const HEX8 = /^[0-9A-Fa-f]{8}$/;

/**
 * STEP-stringinhoud (zonder de omsluitende quotes, `''` al samengevoegd) terug naar tekst:
 * `\\` → `\`, `\X2\hhhh…\X0\` (UTF-16), `\X4\hhhhhhhh…\X0\` (codepunten), `\X\hh` (ISO 8859-1)
 * en `\S\c` (teken + 128). `\Px\` (codetabelkeuze) wordt weggelaten; de lezer neemt voor `\S\`
 * altijd ISO 8859-1 aan. Een onbekende reeks blijft letterlijk staan. Tegenhanger van
 * `encodeStepText` (ifcPsets).
 */
export function decodeStepText(s: string): string {
  if (s.indexOf('\\') < 0) return s;
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const b = s.indexOf('\\', i);
    if (b < 0) { out += s.slice(i); break; }
    out += s.slice(i, b);
    i = b;
    if (s.startsWith('\\\\', i)) { out += '\\'; i += 2; continue; }
    if (s.startsWith('\\X2\\', i) || s.startsWith('\\X4\\', i)) {
      const width = s[i + 2] === '2' ? 4 : 8;
      const end = s.indexOf('\\X0\\', i + 4);
      const hexRun = end >= 0 ? s.slice(i + 4, end) : '';
      const pattern = width === 4 ? HEX4 : HEX8;
      let decoded = '';
      let valid = end >= 0 && hexRun.length % width === 0;
      for (let k = 0; valid && k < hexRun.length; k += width) {
        const h = hexRun.slice(k, k + width);
        if (!pattern.test(h)) { valid = false; break; }
        const v = parseInt(h, 16);
        if (width === 8 && v > 0x10FFFF) { valid = false; break; }
        decoded += width === 4 ? String.fromCharCode(v) : String.fromCodePoint(v);
      }
      if (valid) { out += decoded; i = end + 4; continue; }
    } else if (s.startsWith('\\X\\', i) && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 3, i + 5))) {
      out += String.fromCharCode(parseInt(s.slice(i + 3, i + 5), 16));
      i += 5;
      continue;
    } else if (s.startsWith('\\S\\', i) && i + 3 < n) {
      out += String.fromCharCode(s.charCodeAt(i + 3) + 128);
      i += 4;
      continue;
    } else if (s[i + 1] === 'P' && s[i + 3] === '\\' && /[A-I]/.test(s[i + 2] ?? '')) {
      i += 4;
      continue;
    }
    out += '\\';
    i++;
  }
  return out;
}
