// `parseXerNumber` bouwt zijn patroon één keer per getalnotatie — prestatiemeting rehab-2 (2026-10-07).
//
// AANLEIDING. De functie maakte voor ELK getal een nieuwe `RegExp` (plus twee `escapeRegExp`-
// aanroepen). Op rehab-2.xer (52.640 toewijzingen met elk een handvol numerieke kolommen) kostte
// dat 1,7 s bij het openen. Nu staat het patroon per notatie (decimaalteken × groepsteken, zes
// mogelijkheden) in een cache.
//
// Wat dit pint: (1) het gedrag per notatie (geldig, ongeldig, groepering) blijft gelijk;
// (2) 30.000 getallen in drie notaties bouwen hoogstens drie `RegExp`-objecten.
//
// Draait via run.sh. Exit 0 = alles groen.
import { parseXerNumber, type XerNumberFormat } from '@/services/xer/xerTables';

const fails: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)}`);
};
const throws = (label: string, fn: () => unknown) => {
  checks++;
  try { fn(); fails.push(`${label}: gooide niet`); } catch (e) {
    if ((e as { xerCode?: string }).xerCode !== 'XER_INVALID_NUMBER') fails.push(`${label}: verkeerde fout ${String(e)}`);
  }
};

const dot: XerNumberFormat = { decimal: '.', group: null, source: 'default', currencyCode: '' };
const commaDot: XerNumberFormat = { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' };
const dotComma: XerNumberFormat = { decimal: '.', group: ',', source: 'currtype', currencyCode: 'USD' };

// ── 1. Gedrag ─────────────────────────────────────────────────────────────────────────────────────
eq('1a punt, geen groep', parseXerNumber('12.5', dot), 12.5);
eq('1b leeg ⇒ null', parseXerNumber('  ', dot), null);
eq('1c teken', parseXerNumber('-3', dot), -3);
throws('1d punt-notatie weigert komma', () => parseXerNumber('1,5', dot));
eq('1e komma-decimaal met puntgroep', parseXerNumber('1.234,5', commaDot), 1234.5);
eq('1f komma-decimaal zonder groep', parseXerNumber('8,25', commaDot), 8.25);
throws('1g foute groepering', () => parseXerNumber('12.34,5', commaDot));
eq('1h punt-decimaal met kommagroep', parseXerNumber('1,234,567.75', dotComma), 1234567.75);
throws('1i punt-decimaal weigert dubbele punt', () => parseXerNumber('1.2.3', dotComma));
// Wisselen tussen notaties mag de cache niet laten lekken.
eq('1j na wissel weer punt', parseXerNumber('7.5', dot), 7.5);
throws('1k na wissel weigert punt-notatie nog steeds groepering', () => parseXerNumber('1,234.5', dot));

// ── 2. Aantal gebouwde patronen ──────────────────────────────────────────────────────────────────
const Native = globalThis.RegExp;
let built = 0;
globalThis.RegExp = new Proxy(Native, {
  construct(target, args, newTarget) { built++; return Reflect.construct(target, args, newTarget) as object; },
}) as RegExpConstructor;
try {
  for (let i = 0; i < 10_000; i++) {
    parseXerNumber(`${i}.25`, dot);
    parseXerNumber(`${i},5`, commaDot);
    parseXerNumber(`${i}.75`, dotComma);
  }
} finally {
  globalThis.RegExp = Native;
}
checks++;
if (built > 3) fails.push(`2 30.000 getallen in drie notaties bouwen ≤ 3 RegExp-objecten: kreeg ${built}`);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`xer-number-pattern-cache: ${fails.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`xer-number-pattern-cache: ${checks} checks groen`);
