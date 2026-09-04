// `formatDate` tegen zijn eigen vorige implementatie — een characterization-test.
//
// AANLEIDING. `formatDate` was `d.toISOString().split('T')[0]`: per aanroep een string van 24
// tekens plus een array van twee, om er één van 10 over te houden. Dat is duur op de plek waar hij
// echt draait — de werkdagen-enumeraties in de solver en de resourcebelasting roepen hem per DAG
// per taak aan. Op 5.000 taken/toewijzingen scheelde de handmatige opbouw `runCPM` 677 → 604 ms,
// `recomputeResourceLoad` 126 → 90 ms en `assignResource` 133 → 106 ms.
//
// Zo'n herschrijving is precies het soort wijziging dat aan de RANDEN stukgaat en in het midden
// niets laat zien. Daarom is de oude implementatie hier letterlijk overgetypt als ORAKEL (zelfde
// aanpak als `oldGanttCanvasRevealX` in `check-axis-consolidation.ts`): niet "wat vind ik dat eruit
// moet komen", maar "geeft de nieuwe versie exact hetzelfde als de oude".
//
// De hele suite draait bovendien onder een tijdzone-matrix (zie run.sh). Dat is voor deze functie
// geen bijvangst maar de kern: `formatDate` gebruikt UTC-getters juist omdat lokale getters bij een
// negatieve offset een dag terugschuiven, en die val is met een herschrijving zo weer gegraven.
// Gemeten: van de zeven sabotages die ik hierop losliet is er precies één — UTC-getters vervangen
// door lokale — die in UTC GROEN blijft en pas onder America/New_York omvalt. Deze batterij op
// zichzelf dekt die dus niet; de matrix doet dat.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { formatDate, parseDate } from '@/utils/dateUtils';
import { formatGridDate, parseGridDate } from '@/engine/taskGrid/editors';

/** De implementatie van vóór de herschrijving, letterlijk. Dit is het orakel. */
function oudFormatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── 1. Gelijkheid over een breed bereik ──────────────────────────────────────
// Jaar 1 t/m 9999, met een stap die niet op een week- of maandgrens valt zodat alle
// dag-/maandcombinaties langskomen.
{
  let ongelijk = 0;
  let eerste = '';
  let n = 0;
  const VAN = Date.UTC(1, 0, 1);
  const TOT = Date.UTC(9999, 11, 31);
  for (let t = VAN; t <= TOT; t += 86400000 * 997) {
    const d = new Date(t);
    n++;
    if (formatDate(d) !== oudFormatDate(d)) {
      ongelijk++;
      if (!eerste) eerste = `${d.toISOString()} → nieuw ${formatDate(d)}, oud ${oudFormatDate(d)}`;
    }
  }
  eq(`1 gelijk over ${n} datums (jaar 1 t/m 9999)${eerste ? ` — eerste afwijking: ${eerste}` : ''}`, ongelijk, 0);
}

// Elke dag van een schrikkeljaar én van een gewoon jaar, dag voor dag — de stap hierboven slaat
// nu eenmaal dagen over, en 29 februari is precies zo'n dag om mis te lopen.
for (const jaar of [2024, 2025, 2000, 1900]) {
  let ongelijk = 0;
  for (let t = Date.UTC(jaar, 0, 1); t < Date.UTC(jaar + 1, 0, 1); t += 86400000) {
    const d = new Date(t);
    if (formatDate(d) !== oudFormatDate(d)) ongelijk++;
  }
  eq(`2 [${jaar}] elke dag van het jaar gelijk`, ongelijk, 0);
}

// ── 3. De randen van de snelle tak ───────────────────────────────────────────
// Precies op en net buiten de grenzen waar de implementatie omschakelt naar `toISOString`.
for (const iso of [
  '0000-01-01T00:00:00Z', '0000-12-31T23:59:59Z',
  '0001-01-01T00:00:00Z', '0099-06-15T12:00:00Z', '0999-12-31T00:00:00Z',
  '1000-01-01T00:00:00Z', '9999-12-31T00:00:00Z',
]) {
  const d = new Date(iso);
  eq(`3 [${iso}] gelijk aan het orakel`, formatDate(d), oudFormatDate(d));
}

// Buiten 0…9999: negatieve en uitgebreide jaren. `toISOString` schrijft die met teken en zes
// cijfers; de snelle tak mag daar niet aan komen.
for (const t of [Date.UTC(-1, 0, 1), Date.UTC(-12345, 5, 5), 253402300800000, 8.64e15, -8.64e15]) {
  const d = new Date(t);
  eq(`4 [${d.toISOString()}] buiten bereik → orakel`, formatDate(d), oudFormatDate(d));
}
// `Date.UTC(-1, ...)` levert géén jaar -1 op maar 1901 (het twee-cijferige-jaar-gedrag van `Date`).
// Expliciet dus ook een écht negatief jaar, via setUTCFullYear.
{
  const d = new Date(0);
  d.setUTCFullYear(-44, 2, 15);
  eq('4a echt negatief jaar → orakel', formatDate(d), oudFormatDate(d));
  eq('4b en dat is ook echt de trage tak', d.getUTCFullYear() < 0, true);
}

// ── 5. Een ongeldige datum gooit nog steeds ──────────────────────────────────
// De oude versie gooide een RangeError uit `toISOString`. Stil "NaN-NaN-NaN" teruggeven zou een
// kapotte datum ongemerkt in een IFC-bestand laten belanden.
{
  const kapot = new Date('geen datum');
  let nieuwGooide = false, oudGooide = false;
  try { formatDate(kapot); } catch { nieuwGooide = true; }
  try { oudFormatDate(kapot); } catch { oudGooide = true; }
  eq('5 een Invalid Date gooit nog steeds', nieuwGooide, true);
  eq('5a net als voorheen', nieuwGooide, oudGooide);
}

// ── 6. Round-trip met parseDate ──────────────────────────────────────────────
// De twee horen elkaars inverse te zijn op dag-granulariteit; dat is wat de hele planningslaag
// aanneemt.
{
  let fout = 0;
  for (const iso of ['2026-01-01', '2026-02-29', '2024-02-29', '2026-12-31', '1999-07-04', '0001-01-01']) {
    if (formatDate(parseDate(iso)) !== oudFormatDate(parseDate(iso))) fout++;
  }
  eq('6 formatDate(parseDate(x)) gelijk aan het orakel', fout, 0);
  eq('6a en round-trip klopt voor een gewone datum', formatDate(parseDate('2026-06-15')), '2026-06-15');
  // 29 februari 2026 bestaat niet; `parseDate` rolt door naar 1 maart. Dat is bestaand gedrag en
  // staat hier zodat een toekomstige "verbetering" van parseDate niet stil door deze test glipt.
  eq('6b een niet-bestaande datum rolt door (bestaand gedrag)', formatDate(parseDate('2026-02-29')), '2026-03-01');
}

// ── 7. Persoonlijke gridnotatie blijft een verliesloze rand rond ISO ─────────
// Deze parser wordt door losse edits én TSV-paste gedeeld. Hij mag de historische, permissieve
// parseDate dus niet aanroepen: 31 februari moet hier een zichtbare invoerfout blijven.
eq('7 dmy-gridinvoer naar ISO', parseGridDate('31-12-2026', 'dmy'), '2026-12-31');
eq('7a mdy-gridinvoer naar ISO', parseGridDate('12/31/2026', 'mdy'), '2026-12-31');
eq('7b ymd-gridinvoer naar ISO', parseGridDate('2026.12.31', 'ymd'), '2026-12-31');
eq('7c ISO blijft in iedere persoonlijke notatie geldig', parseGridDate('2024-02-29', 'mdy'), '2024-02-29');
eq('7d twee-cijferig jaar gebruikt de afgesproken 20xx-grens', parseGridDate('31-12-26', 'dmy'), '2026-12-31');
eq('7e niet-bestaande datum wordt niet doorgeschoven', parseGridDate('31-02-2026', 'dmy'), null);
eq('7f niet-schrikkeljaar wordt geweigerd', parseGridDate('02/29/2026', 'mdy'), null);
eq('7g ISO formatteert terug naar persoonlijke mdy-notatie', formatGridDate('2026-12-31', 'mdy'), '12-31-2026');
eq('7h persoonlijke dmy-roundtrip bewaart dezelfde ISO-dag',
  parseGridDate(formatGridDate('2024-02-29', 'dmy'), 'dmy'), '2024-02-29');

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: formatDate — ${checks} checks groen`);
} else {
  console.log(`XX formatDate — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
