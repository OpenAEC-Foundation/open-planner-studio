import './domStub';
import { formatDate, parseDate } from '@/utils/dateUtils';
import { formatGridDate, parseGridDate } from '@/engine/taskGrid/editors';
import { formatDisplayDate, getLocalizedMonths, getLocalizedMonthsShort } from '@/i18n/dateFormat';

function oudFormatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

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

for (const jaar of [2024, 2025, 2000, 1900]) {
  let ongelijk = 0;
  for (let t = Date.UTC(jaar, 0, 1); t < Date.UTC(jaar + 1, 0, 1); t += 86400000) {
    const d = new Date(t);
    if (formatDate(d) !== oudFormatDate(d)) ongelijk++;
  }
  eq(`2 [${jaar}] elke dag van het jaar gelijk`, ongelijk, 0);
}

for (const iso of [
  '0000-01-01T00:00:00Z', '0000-12-31T23:59:59Z',
  '0001-01-01T00:00:00Z', '0099-06-15T12:00:00Z', '0999-12-31T00:00:00Z',
  '1000-01-01T00:00:00Z', '9999-12-31T00:00:00Z',
]) {
  const d = new Date(iso);
  eq(`3 [${iso}] gelijk aan het orakel`, formatDate(d), oudFormatDate(d));
}

for (const t of [Date.UTC(-1, 0, 1), Date.UTC(-12345, 5, 5), 253402300800000, 8.64e15, -8.64e15]) {
  const d = new Date(t);
  eq(`4 [${d.toISOString()}] buiten bereik → orakel`, formatDate(d), oudFormatDate(d));
}
{
  const d = new Date(0);
  d.setUTCFullYear(-44, 2, 15);
  eq('4a echt negatief jaar → orakel', formatDate(d), oudFormatDate(d));
  eq('4b en dat is ook echt de trage tak', d.getUTCFullYear() < 0, true);
}

{
  const kapot = new Date('geen datum');
  let nieuwGooide = false, oudGooide = false;
  try { formatDate(kapot); } catch { nieuwGooide = true; }
  try { oudFormatDate(kapot); } catch { oudGooide = true; }
  eq('5 een Invalid Date gooit nog steeds', nieuwGooide, true);
  eq('5a net als voorheen', nieuwGooide, oudGooide);
}

{
  let fout = 0;
  for (const iso of ['2026-01-01', '2026-02-29', '2024-02-29', '2026-12-31', '1999-07-04', '0001-01-01']) {
    if (formatDate(parseDate(iso)) !== oudFormatDate(parseDate(iso))) fout++;
  }
  eq('6 formatDate(parseDate(x)) gelijk aan het orakel', fout, 0);
  eq('6a en round-trip klopt voor een gewone datum', formatDate(parseDate('2026-06-15')), '2026-06-15');
  eq('6b een niet-bestaande datum rolt door (bestaand gedrag)', formatDate(parseDate('2026-02-29')), '2026-03-01');
}

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

{
  const nonLatinDigits = /[۰-۹٠-٩]/;
  const sep1 = new Date(Date.UTC(2026, 8, 1));
  eq('8a fa: januari is de Gregoriaanse maandnaam', getLocalizedMonths('fa')[0], 'ژانویه');
  eq('8b fa: twaalf verschillende maandnamen', new Set(getLocalizedMonths('fa')).size, 12);
  eq('8c fa: korte maandnamen zijn ook Gregoriaans', getLocalizedMonthsShort('fa')[8],
    new Intl.DateTimeFormat('fa-u-ca-gregory', { month: 'short', timeZone: 'UTC' }).format(sep1));
  eq('8d fa: weergavedatum in het Gregoriaanse jaar', formatDisplayDate(sep1, 'fa').includes('2026'), true);
  eq('8e fa: weergavedatum met Latijnse cijfers', nonLatinDigits.test(formatDisplayDate(sep1, 'fa')), false);
  eq('8f ar: weergavedatum met Latijnse cijfers', nonLatinDigits.test(formatDisplayDate(sep1, 'ar')), false);
  eq('8g nl: maandnaam ongewijzigd', getLocalizedMonths('nl')[0], 'januari');
  eq('8h nl: weergavedatum ongewijzigd', formatDisplayDate(sep1, 'nl'), '1 sep 2026');
}

if (diffs.length === 0) {
  console.log(`OK: formatDate — ${checks} checks groen`);
} else {
  console.log(`XX formatDate — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
