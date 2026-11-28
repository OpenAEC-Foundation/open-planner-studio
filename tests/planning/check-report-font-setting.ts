import './domStub';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, patchReportSettings } from '@/utils/reportSettings';
import { REPORT_FONT_IDS } from '@/services/pdf/reportFont';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

expect('standaard is de rapportletter Inter', DEFAULT_REPORT_SETTINGS.reportFontFamily, 'inter');

localStorage.removeItem('ops-reportSettings');
expect('verse installatie ⇒ Inter', (await loadReportSettings()).reportFontFamily, 'inter');

for (const id of REPORT_FONT_IDS) {
  patchReportSettings({ ...DEFAULT_REPORT_SETTINGS, reportFontFamily: id });
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
