// Holiday-generator-checks (fase 2.8a, ontwerp §10.2). Onafhankelijk narekenen van de
// feestdagen-engine: Pasen-jaartabel, Koningsdag-zondagregel, Bevrijdingsdag-lustrum,
// UK-substituties, Buß- und Bettag (weekday-before), nth-weekday (last/first Monday).
//
// Draait via run.sh (esbuild-bundel, zoals harness.ts). Exit 0 = alles groen.
import { easterSunday, generateHolidays, NL_SET, DE_SET, UK_SET } from '@/engine/calendar/holidays';
import { formatDate } from '@/utils/dateUtils';

const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

/** Zoek de start-datum van de (eerste) feestdag met exact deze naam, of null. */
function startOf(list: { name: string; startDate: string }[], name: string): string | null {
  return list.find((h) => h.name === name)?.startDate ?? null;
}
function has(list: { name: string }[], name: string): boolean {
  return list.some((h) => h.name === name);
}

// 1) Pasen-jaartabel (Meeus/Jones/Butcher, bekende Gregoriaanse jaren).
const easterTable: Record<number, string> = {
  2000: '2000-04-23', 2021: '2021-04-04', 2024: '2024-03-31',
  2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28',
};
for (const [y, want] of Object.entries(easterTable)) {
  eq(`easter ${y}`, formatDate(easterSunday(Number(y))), want);
}

// 2) NL Koningsdag-zondagregel: 27/4 op zondag → 26/4 (2025), anders 27/4 (2026).
eq('koningsdag 2025 (27/4=zo→26/4)', startOf(generateHolidays(NL_SET, undefined, 2025, 2025), 'Koningsdag'), '2025-04-26');
eq('koningsdag 2026 (27/4=ma)', startOf(generateHolidays(NL_SET, undefined, 2026, 2026), 'Koningsdag'), '2026-04-27');

// 3) NL Bevrijdingsdag lustrum-only: aanwezig in 2025 (÷5), afwezig in 2026.
eq('bevrijdingsdag 2025 aanwezig', has(generateHolidays(NL_SET, undefined, 2025, 2025), 'Bevrijdingsdag'), true);
eq('bevrijdingsdag 2026 afwezig', has(generateHolidays(NL_SET, undefined, 2026, 2026), 'Bevrijdingsdag'), false);
eq('bevrijdingsdag 2025 datum', startOf(generateHolidays(NL_SET, undefined, 2025, 2025), 'Bevrijdingsdag'), '2025-05-05');

// 4) NL Kerst (2 dagen) aanwezig — regressie tegen de oude default die Kerst miste.
{
  const kerst = generateHolidays(NL_SET, undefined, 2026, 2026).find((h) => h.name === 'Kerst');
  eq('kerst 2026 start', kerst?.startDate, '2026-12-25');
  eq('kerst 2026 eind (2-daags)', kerst?.endDate, '2026-12-26');
}

// 5) UK-substituties: New Year 1/1/2022 (za) → ma 3/1; Christmas/Boxing 25-26/12/2021 (za/zo) → ma 27/di 28.
{
  const uk2022 = generateHolidays(UK_SET, 'EAW', 2022, 2022);
  eq("new year 2022 (za→ma)", startOf(uk2022, "New Year's Day"), '2022-01-03');
  const uk2021 = generateHolidays(UK_SET, 'EAW', 2021, 2021);
  eq('christmas 2021 (za→ma 27)', startOf(uk2021, 'Christmas Day'), '2021-12-27');
  eq('boxing 2021 (zo→di 28)', startOf(uk2021, 'Boxing Day'), '2021-12-28');
}

// 6) DE Buß- und Bettag (weekday-before 23/11, wo) in Sachsen: 2026 → 18/11 (23/11=ma).
eq('buss- und bettag 2026 (SN)', startOf(generateHolidays(DE_SET, 'SN', 2026, 2026), 'Buß- und Bettag'), '2026-11-18');
// Regionaal: níét landelijk (leeg region → geen Buß- und Bettag).
eq('buss- und bettag landelijk afwezig', has(generateHolidays(DE_SET, undefined, 2026, 2026), 'Buß- und Bettag'), false);

// 7) UK nth-weekday: Early May = 1e maandag mei (2026-05-04); Spring bank = laatste maandag mei (2026-05-25).
{
  const uk = generateHolidays(UK_SET, 'EAW', 2026, 2026);
  eq('early may bank 2026 (1e ma)', startOf(uk, 'Early May bank holiday'), '2026-05-04');
  eq('spring bank 2026 (laatste ma)', startOf(uk, 'Spring bank holiday'), '2026-05-25');
}

// 8) Regio-filter: DE Fronleichnam wél in BY, níét in BE (Berlin).
eq('fronleichnam BY aanwezig', has(generateHolidays(DE_SET, 'BY', 2026, 2026), 'Fronleichnam'), true);
eq('fronleichnam BE afwezig', has(generateHolidays(DE_SET, 'BE', 2026, 2026), 'Fronleichnam'), false);

if (diffs.length === 0) {
  console.log('OK  holidays-check: alle checks groen');
  process.exit(0);
} else {
  console.log(`XX  holidays-check: ${diffs.length} afwijking(en)`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
