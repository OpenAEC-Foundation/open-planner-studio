import './domStub';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, patchReportSettings } from '@/utils/reportSettings';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

expect('standaard staat de voet op elke pagina', DEFAULT_REPORT_SETTINGS.repeatFooter, true);

localStorage.setItem('ops-reportSettings', JSON.stringify({ repeatFooter: false, repeatHeader: false }));
const loaded = await loadReportSettings();
expect('opgeslagen voetkeuze wordt geladen', loaded.repeatFooter, false);
expect('… onafhankelijk van de kopkeuze', loaded.repeatHeader, false);

localStorage.setItem('ops-reportSettings', JSON.stringify({ repeatHeader: false, showLegend: false }));
const ouder = await loadReportSettings();
expect('opslag van vóór de optie ⇒ default aan', ouder.repeatFooter, true);
expect('… en de overige voorkeuren blijven staan', ouder.showLegend, false);

localStorage.setItem('ops-reportSettings', JSON.stringify({ repeatFooter: 'nee' }));
expect('rommel ⇒ default', (await loadReportSettings()).repeatFooter, true);

patchReportSettings({ ...DEFAULT_REPORT_SETTINGS, repeatFooter: false });
expect('voetkeuze overleeft een round-trip', (await loadReportSettings()).repeatFooter, false);

if (failures.length > 0) {
  console.log(`XX report-footer-setting: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK report-footer-setting: voet-op-elke-pagina blijft bewaard en tolerant geladen');
