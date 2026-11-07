// Lettertype van het rapport (issue #770): rapportvoorkeur in ops-reportSettings, alleen op dit
// apparaat (besluit Ethan, 7 november 2026: niets in het IFC-bestand). Bewaakt de default (Inter,
// de letter van vóór de keuzelijst), de round-trip door de echte opslagroute — dus de keuze blijft
// na een herstart — en de tolerantie voor een ontbrekende of onbekende waarde (per veld terug op
// Inter; een opslag van vóór deze optie verliest niets).
import './domStub';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, saveReportSettings } from '@/utils/reportSettings';
import { REPORT_FONT_IDS } from '@/services/pdf/reportFont';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

expect('standaard is de rapportletter Inter', DEFAULT_REPORT_SETTINGS.reportFontFamily, 'inter');

localStorage.removeItem('ops-reportSettings');
expect('verse installatie ⇒ Inter', (await loadReportSettings()).reportFontFamily, 'inter');

// Elke keuze uit de lijst overleeft opslaan en opnieuw laden (zoals bij een herstart van de app).
for (const id of REPORT_FONT_IDS) {
  await saveReportSettings({ ...DEFAULT_REPORT_SETTINGS, reportFontFamily: id });
  const raw = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}') as Record<string, unknown>;
  expect(`'${id}' staat als id in ops-reportSettings`, raw.reportFontFamily, id);
  expect(`'${id}' overleeft een herstart`, (await loadReportSettings()).reportFontFamily, id);
}

localStorage.setItem('ops-reportSettings', JSON.stringify({ reportFontScale: 125, showLegend: false }));
const ouder = await loadReportSettings();
expect('opslag van vóór de optie ⇒ Inter', ouder.reportFontFamily, 'inter');
expect('… en de overige voorkeuren blijven staan', ouder.reportFontScale, 125);

for (const rommel of ['Comic Sans', 'Inter', 42, null, ['carlito']]) {
  localStorage.setItem('ops-reportSettings', JSON.stringify({ reportFontFamily: rommel, showLegend: false }));
  const geladen = await loadReportSettings();
  expect(`onbekende waarde ${JSON.stringify(rommel)} ⇒ Inter`, geladen.reportFontFamily, 'inter');
  expect(`… zonder de rest weg te vegen (${JSON.stringify(rommel)})`, geladen.showLegend, false);
}

if (failures.length > 0) {
  console.log(`XX report-font-setting: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK report-font-setting: de rapportletter blijft bewaard en laadt tolerant');
