// Holiday-generator-checks (fase 2.8a, ontwerp §10.2). Onafhankelijk narekenen van de
// feestdagen-engine: Pasen-jaartabel, Koningsdag-zondagregel, Bevrijdingsdag-lustrum,
// UK-substituties, Buß- und Bettag (weekday-before), nth-weekday (last/first Monday),
// US federale feestdagen (nth-weekday, zaterdag/zondag-substitutie, Juneteenth vanaf 2021),
// Bolivia 2026 (#992) en de landensets ES/IT/PL/PT/CZ/SE/DK/NO/FI (volledige 2026-lijsten,
// weekday-on-after, untilYear DK Store bededag, fromYear PL/SE/PT).
//
// Draait via run.sh (esbuild-bundel, zoals harness.ts). Exit 0 = alles groen.
import {
  easterSunday, generateHolidays, HOLIDAY_COUNTRIES, HOLIDAY_SETS,
  NL_SET, DE_SET, UK_SET, US_SET, type HolidayCountry,
} from '@/engine/calendar/holidays';
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

// Bolivia: de landelijke kalender van 2026, inclusief de tijdelijke decreten,
// en de drie departementen uit #992.
{
  const bolivia = Object.values(HOLIDAY_SETS).find(set => String(set.country) === 'BO');
  eq('Bolivia beschikbaar in de feestdagengenerator', Boolean(bolivia), true);
  if (bolivia) {
    const dates = (year: number, region?: string) => generateHolidays(bolivia, region, year, year)
      .map(h => h.startDate === h.endDate ? h.startDate : `${h.startDate}/${h.endDate}`)
      .sort();
    const national2026 = [
      '2026-01-01', '2026-01-02', '2026-01-23', '2026-02-16/2026-02-17', '2026-04-03',
      '2026-05-01', '2026-06-04', '2026-06-05', '2026-06-22', '2026-08-06', '2026-08-07',
      '2026-11-02', '2026-12-25',
    ];
    const regional = (year: number, region: string) => dates(year, region).filter(date => !dates(year).includes(date));
    eq('BO 2026: volledig landelijk', dates(2026).join(','), national2026.join(','));
    eq('BO La Paz 2026: 16 juli', regional(2026, 'L').join(','), '2026-07-16');
    eq('BO Potosí 2026: 10 november', regional(2026, 'P').join(','), '2026-11-10');
    eq('BO Santa Cruz 2026: 24 én 25 september', regional(2026, 'S').join(','), '2026-09-24,2026-09-25');
    eq('BO Santa Cruz 2027: alleen 24 september', regional(2027, 'S').join(','), '2027-09-24');
    eq('BO La Paz 2028: zondag 16 juli verschuift naar maandag', regional(2028, 'L').join(','), '2028-07-17');
    eq('BO 2027: weer 22 januari en Kerst blijft zaterdag', dates(2027).join(','), [
      '2027-01-01', '2027-01-22', '2027-02-08/2027-02-09', '2027-03-26', '2027-05-01',
      '2027-05-27', '2027-06-21', '2027-08-06', '2027-11-02', '2027-12-25',
    ].join(','));
  }
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

// 9) US federale feestdagen 2026: 11 stuks; nth-weekday-dagen en de vaste dagen met substitutie.
{
  const us = generateHolidays(US_SET, undefined, 2026, 2026);
  eq('us 2026 aantal', us.length, 11);
  eq('us mlk 2026 (3e ma jan)', startOf(us, 'Martin Luther King Jr. Day'), '2026-01-19');
  eq('us presidents 2026 (3e ma feb)', startOf(us, "Washington's Birthday (Presidents' Day)"), '2026-02-16');
  eq('us memorial 2026 (laatste ma mei)', startOf(us, 'Memorial Day'), '2026-05-25');
  eq('us juneteenth 2026 (vr)', startOf(us, 'Juneteenth'), '2026-06-19');
  eq('us independence 2026 (4/7=za→vr 3/7)', startOf(us, 'Independence Day'), '2026-07-03');
  eq('us labor 2026 (1e ma sep)', startOf(us, 'Labor Day'), '2026-09-07');
  eq('us columbus 2026 (2e ma okt)', startOf(us, 'Columbus Day'), '2026-10-12');
  eq('us veterans 2026 (11/11=wo)', startOf(us, 'Veterans Day'), '2026-11-11');
  eq('us thanksgiving 2026 (4e do nov)', startOf(us, 'Thanksgiving Day'), '2026-11-26');
  eq('us christmas 2026 (vr)', startOf(us, 'Christmas Day'), '2026-12-25');
}

// 10) US substitutie in 2022: 1/1 op zaterdag hoort bij 31/12/2021 (en dus niet in 2022);
//     Juneteenth 19/6/2022 (zo) → ma 20/6; Christmas 25/12/2022 (zo) → ma 26/12.
{
  const us2021 = generateHolidays(US_SET, undefined, 2021, 2021);
  const newYears2021 = us2021.filter((h) => h.name === "New Year's Day").map((h) => h.startDate);
  eq('us new year 2021: 1/1/2021 (vr) en observed 31/12/2021', newYears2021.join(','), '2021-01-01,2021-12-31');
  const us2022 = generateHolidays(US_SET, undefined, 2022, 2022);
  eq('us new year 2022 afwezig (za→vorig jaar)', has(us2022, "New Year's Day"), false);
  eq('us juneteenth 2022 (zo→ma)', startOf(us2022, 'Juneteenth'), '2022-06-20');
  eq('us christmas 2022 (zo→ma)', startOf(us2022, 'Christmas Day'), '2022-12-26');
  eq('us 2022 aantal (New Year valt in 2021)', us2022.length, 10);
  // Meerjaarsspanne 2021–2022 herhaalt niets: 31/12/2021 telt één keer, 2022 voegt geen nieuwjaar toe.
  const span = generateHolidays(US_SET, undefined, 2021, 2022);
  eq('us spanne nieuwjaar-dagen', span.filter((h) => h.name === "New Year's Day").length, 2);
}

// 11) US Juneteenth bestaat pas vanaf 2021; 1/1 op zondag (2023) → ma 2/1.
{
  eq('us juneteenth 2020 afwezig', has(generateHolidays(US_SET, undefined, 2020, 2020), 'Juneteenth'), false);
  eq('us juneteenth 2021 (za→vr 18/6)', startOf(generateHolidays(US_SET, undefined, 2021, 2021), 'Juneteenth'), '2021-06-18');
  eq('us new year 2023 (zo→ma)', startOf(generateHolidays(US_SET, undefined, 2023, 2023), "New Year's Day"), '2023-01-02');
}

// 12) Nieuwe landensets (ES, IT, PL, PT, CZ, SE, DK, NO, FI): de VOLLEDIGE lijst van 2026
//     narekenen (Pasen 2026 = 5 april; Hemelvaart 14/5, Pinksteren 24/5, 2e pinksterdag 25/5,
//     Corpus Christi 4/6, Store bededag = 1/5 maar afgeschaft, Midsommar = vr 19/6,
//     Juhannuspäivä = za 20/6, Alla helgons dag / Pyhäinpäivä = za 31/10).
{
  const dates = (country: HolidayCountry, year: number) =>
    generateHolidays(HOLIDAY_SETS[country], undefined, year, year)
      .map(h => h.startDate === h.endDate ? h.startDate : `${h.startDate}/${h.endDate}`)
      .sort();
  const list = (xs: string[]) => xs.sort().join(',');
  eq('ES 2026', dates('ES', 2026).join(','), list([
    '2026-01-01', '2026-01-06', '2026-04-03', '2026-05-01', '2026-08-15', '2026-10-12',
    '2026-11-01', '2026-12-06', '2026-12-08', '2026-12-25',
  ]));
  eq('IT 2026', dates('IT', 2026).join(','), list([
    '2026-01-01', '2026-01-06', '2026-04-05/2026-04-06', '2026-04-25', '2026-05-01', '2026-06-02',
    '2026-08-15', '2026-11-01', '2026-12-08', '2026-12-25/2026-12-26',
  ]));
  eq('PL 2026', dates('PL', 2026).join(','), list([
    '2026-01-01', '2026-01-06', '2026-04-05/2026-04-06', '2026-05-01', '2026-05-03', '2026-06-04',
    '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25/2026-12-26',
  ]));
  eq('PT 2026', dates('PT', 2026).join(','), list([
    '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-25', '2026-05-01', '2026-06-04', '2026-06-10',
    '2026-08-15', '2026-10-05', '2026-11-01', '2026-12-08', '2026-12-25',
  ]));
  eq('CZ 2026', dates('CZ', 2026).join(','), list([
    '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-08', '2026-07-05', '2026-07-06',
    '2026-09-28', '2026-10-28', '2026-11-17', '2026-12-24', '2026-12-25/2026-12-26',
  ]));
  eq('SE 2026', dates('SE', 2026).join(','), list([
    '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-05/2026-04-06', '2026-05-01', '2026-05-14',
    '2026-05-24', '2026-06-06', '2026-06-19', '2026-10-31', '2026-12-25/2026-12-26',
  ]));
  eq('DK 2026 (zonder Store bededag, mét Grundlovsdag)', dates('DK', 2026).join(','), list([
    '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-05/2026-04-06', '2026-05-14', '2026-05-24',
    '2026-05-25', '2026-06-05', '2026-12-25/2026-12-26',
  ]));
  eq('NO 2026', dates('NO', 2026).join(','), list([
    '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-05/2026-04-06', '2026-05-01', '2026-05-14',
    '2026-05-17', '2026-05-24', '2026-05-25', '2026-12-25/2026-12-26',
  ]));
  eq('FI 2026', dates('FI', 2026).join(','), list([
    '2026-01-01', '2026-01-06', '2026-04-03', '2026-04-05/2026-04-06', '2026-05-01', '2026-05-14',
    '2026-06-20', '2026-10-31', '2026-12-06', '2026-12-25/2026-12-26',
  ]));
}

// 13) weekday-on-after in 2027 (Pasen 2027 = 28 maart): 19/6/2027 = za → Midsommar vr 25/6;
//     31/10/2027 = zo → Alla helgons dag za 6/11; 20/6/2027 = zo → Juhannuspäivä za 26/6.
{
  const se2027 = generateHolidays(HOLIDAY_SETS.SE, undefined, 2027, 2027);
  eq('SE midsommar 2027', startOf(se2027, 'Midsommar'), '2027-06-25');
  eq('SE alla helgons dag 2027', startOf(se2027, 'Alla helgons dag'), '2027-11-06');
  const fi2027 = generateHolidays(HOLIDAY_SETS.FI, undefined, 2027, 2027);
  eq('FI juhannuspäivä 2027', startOf(fi2027, 'Juhannuspäivä'), '2027-06-26');
  eq('FI pyhäinpäivä 2027', startOf(fi2027, 'Pyhäinpäivä'), '2027-11-06');
  // 2026 ter controle: 19/6 en 20/6 en 31/10 vallen zelf op de gezochte weekdag.
  const se2026 = generateHolidays(HOLIDAY_SETS.SE, undefined, 2026, 2026);
  eq('SE midsommar 2026 (19/6=vr)', startOf(se2026, 'Midsommar'), '2026-06-19');
  eq('FI juhannuspäivä 2026 (20/6=za)', startOf(generateHolidays(HOLIDAY_SETS.FI, undefined, 2026, 2026), 'Juhannuspäivä'), '2026-06-20');
}

// 14) DK Store bededag: t/m 2023 (2023: Pasen 9/4 + 26 = 5/5), afgeschaft vanaf 2024.
eq('DK store bededag 2023 aanwezig', startOf(generateHolidays(HOLIDAY_SETS.DK, undefined, 2023, 2023), 'Store bededag'), '2023-05-05');
eq('DK store bededag 2024 afwezig', has(generateHolidays(HOLIDAY_SETS.DK, undefined, 2024, 2024), 'Store bededag'), false);

// 15) fromYear-grenzen: PL Driekoningen pas vanaf 2011, SE nationaldag vanaf 2005,
//     PT Corpo de Deus / 1-11 / 8-12 pas vanaf 2016 (Pasen 2016 = 27/3 → Corpus 26/5).
eq('PL Trzech Króli 2010 afwezig', has(generateHolidays(HOLIDAY_SETS.PL, undefined, 2010, 2010), 'Trzech Króli'), false);
eq('PL Trzech Króli 2011 aanwezig', startOf(generateHolidays(HOLIDAY_SETS.PL, undefined, 2011, 2011), 'Trzech Króli'), '2011-01-06');
eq('SE nationaldag 2004 afwezig', has(generateHolidays(HOLIDAY_SETS.SE, undefined, 2004, 2004), 'Sveriges nationaldag'), false);
eq('SE nationaldag 2005 aanwezig', startOf(generateHolidays(HOLIDAY_SETS.SE, undefined, 2005, 2005), 'Sveriges nationaldag'), '2005-06-06');
eq('PT Corpo de Deus 2015 afwezig', has(generateHolidays(HOLIDAY_SETS.PT, undefined, 2015, 2015), 'Corpo de Deus'), false);
eq('PT Corpo de Deus 2016 aanwezig', startOf(generateHolidays(HOLIDAY_SETS.PT, undefined, 2016, 2016), 'Corpo de Deus'), '2016-05-26');
eq('PT Todos os Santos 2016 aanwezig', startOf(generateHolidays(HOLIDAY_SETS.PT, undefined, 2016, 2016), 'Todos os Santos'), '2016-11-01');

// 16) HOLIDAY_COUNTRIES dekt HOLIDAY_SETS exact (geen set zonder code, geen code zonder set).
eq('HOLIDAY_COUNTRIES = sleutels van HOLIDAY_SETS',
  [...HOLIDAY_COUNTRIES].sort().join(','), Object.keys(HOLIDAY_SETS).sort().join(','));
eq('aantal ondersteunde landen', HOLIDAY_COUNTRIES.length, 18);

if (diffs.length === 0) {
  console.log('OK  holidays-check: alle checks groen');
  process.exit(0);
} else {
  console.log(`XX  holidays-check: ${diffs.length} afwijking(en)`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
