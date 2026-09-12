/**
 * Tekst-escaping voor SpreadsheetML (issue #27, etappe 3).
 *
 * Bladmodule: geen imports, geen state, geen module-level muteerbare singletons.
 *
 * Waarom een eigen escaper naast `mspdiWriter.escapeXML`: XLSX is strenger dan MSPDI. XML 1.0 kent
 * geen enkele manier om een stuurteken (U+0000–U+001F, m.u.v. tab/newline/carriage return) letterlijk
 * in een document te zetten — ook niet als numerieke entiteit. OOXML lost dat op met de
 * `_xHHHH_`-notatie (ECMA-376 deel 1, §22.9.2.19 `ST_Xstring`): het teken wordt geschreven als een
 * onderstrepingsteken, een `x`, vier hexcijfers en nog een onderstrepingsteken.
 *
 * Dat maakt `_` gevoelig: een gebruiker die letterlijk `_x0041_` in een taaknaam typt, zou bij het
 * teruglezen een `A` krijgen. Daarom wordt zo'n reeks zélf ontsnapt — het eerste onderstrepingsteken
 * wordt `_x005F_` (U+005F is `_`). Dat is exact wat Excel doet, en de test bewijst de round-trip.
 */

/** Stuurtekens die XML 1.0 wél toestaat en die dus onaangeroerd blijven. */
const ALLOWED_CONTROL = new Set([0x09, 0x0a, 0x0d]);

const toXChar = (code: number): string => `_x${code.toString(16).toUpperCase().padStart(4, '0')}_`;

/**
 * Ontsnapt stuurtekens en de `_xHHHH_`-notatie zelf. Gedeeld door tekst- en attribuutvorm, want in
 * beide gevallen zou een rauw stuurteken het bestand ongeldig maken.
 */
function escapeXStringSpecials(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const code = s.charCodeAt(i);
    if (ch === '_' && /^_x[0-9A-Fa-f]{4}_/.test(s.slice(i))) {
      // Zelfontsnapping: alleen het onderstrepingsteken wordt vervangen; de rest van de reeks blijft
      // letterlijk staan en is daarmee geen geldige `_xHHHH_`-notatie meer.
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

/** Escapet een string voor gebruik als XML-tekstinhoud (`<t>…</t>`). */
export function escapeXmlText(s: string): string {
  // `&` eerst — anders worden de ampersands van de zojuist ingevoegde entiteiten nog eens ontsnapt.
  return escapeXStringSpecials(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapet een string voor gebruik als XML-attribuutwaarde (quotes erbij). */
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

/**
 * Keert `escapeXmlText`/`escapeXmlAttr` om, plus de numerieke entiteiten die een andere schrijver
 * geproduceerd kan hebben.
 *
 * Eén links-naar-rechts pass, bewust: bij twee passes zou `&amp;lt;` (de ontsnapte tekst `&lt;`) na de
 * eerste pass `&lt;` worden en na de tweede `<`. Zo blijft er precies één laag af gaan. Om dezelfde
 * reden zit de `_xHHHH_`-omkering in dezelfde pass: `_x005F_x0041_` levert `_` en daarna blijft
 * `x0041_` gewoon letterlijk staan, omdat de scanner al voorbij dat punt is.
 */
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
