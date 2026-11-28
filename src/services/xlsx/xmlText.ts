const ALLOWED_CONTROL = new Set([0x09, 0x0a, 0x0d]);

const toXChar = (code: number): string => `_x${code.toString(16).toUpperCase().padStart(4, '0')}_`;

function escapeXStringSpecials(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const code = s.charCodeAt(i);
    if (ch === '_' && /^_x[0-9A-Fa-f]{4}_/.test(s.slice(i))) {
      out += toXChar(0x5f);
      continue;
    }
    if ((code < 0x20 && !ALLOWED_CONTROL.has(code)) || code === 0x7f) {
      out += toXChar(code);
      continue;
    }
    out += ch;
  }
  return out;
}

export function escapeXmlText(s: string): string {
  return escapeXStringSpecials(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function unescapeXml(s: string): string {
  return s.replace(
    /&(amp|lt|gt|quot|apos);|&#(\d+);|&#[xX]([0-9a-fA-F]+);|_x([0-9a-fA-F]{4})_/g,
    (whole, name?: string, dec?: string, hex?: string, xhex?: string): string => {
      if (name !== undefined) return ENTITIES[name] ?? whole;
      if (dec !== undefined) {
        const code = Number.parseInt(dec, 10);
        return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      if (hex !== undefined) {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return String.fromCharCode(Number.parseInt(xhex!, 16));
    },
  );
}
