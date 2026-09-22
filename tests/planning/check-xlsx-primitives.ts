// XLSX-bladprimitieven (issue #27, etappe 3 — taak T3). Twee bladmodules zonder afhankelijkheden:
//   1. `xmlText.ts` — de escaper voor SpreadsheetML-tekst en -attributen, inclusief de
//      `_xHHHH_`-ontsnapping van stuurtekens en de zelfontsnapping van een letterlijke `_xHHHH_`.
//   2. `serialDate.ts` — de seriële datums van Excel (1900-stelsel mét de bekende schrikkelbug,
//      1904-stelsel, tijddeel), uitsluitend met `Date.UTC`-arithmetiek zodat de uitkomst
//      tijdzone-onafhankelijk is. De suite draait deze check ook onder de tijdzone-matrix.
// De verwachte waarden komen van buiten de implementatie: uit wat Excel/OOXML voorschrijft.
import { escapeXmlText, escapeXmlAttr, unescapeXml } from '@/services/xlsx/xmlText';
import { isoToSerial, serialToIso } from '@/services/xlsx/serialDate';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ── escaper ──────────────────────────────────────────────────────────────────
eq('ampersand eerst',            escapeXmlText('a & <b>'), 'a &amp; &lt;b&gt;');
eq('attribuut ontsnapt quotes',  escapeXmlAttr('zeg "hoi"'), 'zeg &quot;hoi&quot;');
eq('stuurteken wordt _xHHHH_',   escapeXmlText('a\u0001b'), 'a_x0001_b');
eq('tab/nl/cr blijven staan',    escapeXmlText('a\tb\nc'), 'a\tb\nc');
eq('een letterlijke _x0041_ wordt zelf ontsnapt', escapeXmlText('_x0041_'), '_x005F_x0041_');
eq('…en komt onbeschadigd terug', unescapeXml(escapeXmlText('_x0041_')), '_x0041_');
eq('round-trip over alles',      unescapeXml(escapeXmlText('a&<>"\'_x0041_')), 'a&<>"\'_x0041_');
eq('attribuut round-trip',       unescapeXml(escapeXmlAttr('a&<>"\'_x0041_')), 'a&<>"\'_x0041_');
eq('stuurteken round-trip',      unescapeXml(escapeXmlText('a\u0001b')), 'a\u0001b');
ok('attribuut laat geen rauwe < of & staan', !/[<]|&(?!(?:amp|lt|gt|quot|apos);)/.test(escapeXmlAttr('a & <b> "c"')));

// ── seriële datums ───────────────────────────────────────────────────────────
eq('1900-03-01 is 61',           isoToSerial('1900-03-01'), 61);
eq('1901-01-01 is 367',          isoToSerial('1901-01-01'), 367);
eq('2026-06-09 round-trip',      serialToIso(isoToSerial('2026-06-09')!), '2026-06-09');
eq('tijddeel overleeft',         serialToIso(isoToSerial('2026-06-09T08:30')!), '2026-06-09T08:30');
eq('middernacht is datum-only',  serialToIso(isoToSerial('2026-06-09T00:00')!), '2026-06-09');
eq('onder 61 is onleesbaar',     serialToIso(59), undefined);
eq('1904-stelsel leest anders',  serialToIso(1, true), '1904-01-02');
eq('geen datum in een datumcel', isoToSerial('volgende week'), undefined);

// ── Uitkomst ─────────────────────────────────────────────────────────────────
if (diffs.length) {
  for (const d of diffs) console.log(`   XX ${d}`);
  console.log(`XX xlsx-primitieven (#27): ${diffs.length} afwijking(en) van ${checks} checks`);
  process.exit(1);
}
console.log(`OK xlsx-primitieven (#27): ${checks} checks groen`);
