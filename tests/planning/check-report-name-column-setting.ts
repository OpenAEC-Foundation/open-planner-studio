// De naamkolom-opties van het rapport (afkappen aan/uit + sliderbreedte) zijn rapportvoorkeuren in
// ops-reportSettings. Deze batterij bewaakt de defaults (byte-identiek aan het oude gedrag), de
// round-trip door de echte opslagroute en het klemmen van een geprutste breedte.
import './domStub';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, saveReportSettings } from '@/utils/reportSettings';
import { NAME_COLUMN_WIDTH_DEFAULT, NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN } from '@/services/print/printPreview';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

expect('standaard worden taaknamen afgekapt (oud gedrag)', DEFAULT_REPORT_SETTINGS.truncateTaskNames, true);
expect('standaardbreedte is de oude vaste kolombreedte', DEFAULT_REPORT_SETTINGS.taskNameColumnWidth, NAME_COLUMN_WIDTH_DEFAULT);

localStorage.setItem('ops-reportSettings', JSON.stringify({ truncateTaskNames: false, taskNameColumnWidth: 220 }));
const loaded = await loadReportSettings();
expect('opgeslagen afkap-keuze wordt geladen', loaded.truncateTaskNames, false);
expect('opgeslagen kolombreedte wordt geladen', loaded.taskNameColumnWidth, 220);

localStorage.setItem('ops-reportSettings', JSON.stringify({ taskNameColumnWidth: 5 }));
expect('te kleine breedte klemt op MIN', (await loadReportSettings()).taskNameColumnWidth, NAME_COLUMN_WIDTH_MIN);
localStorage.setItem('ops-reportSettings', JSON.stringify({ taskNameColumnWidth: 99999 }));
expect('te grote breedte klemt op MAX', (await loadReportSettings()).taskNameColumnWidth, NAME_COLUMN_WIDTH_MAX);
localStorage.setItem('ops-reportSettings', JSON.stringify({ taskNameColumnWidth: 'breed', truncateTaskNames: 'nee' }));
const junk = await loadReportSettings();
expect('rommel in de breedte valt terug op de default', junk.taskNameColumnWidth, NAME_COLUMN_WIDTH_DEFAULT);
expect('rommel in de afkap-keuze valt terug op de default', junk.truncateTaskNames, true);

await saveReportSettings({ ...DEFAULT_REPORT_SETTINGS, truncateTaskNames: false, taskNameColumnWidth: 300 });
const saved = await loadReportSettings();
expect('afkap-keuze overleeft een round-trip', saved.truncateTaskNames, false);
expect('kolombreedte overleeft een round-trip', saved.taskNameColumnWidth, 300);

if (failures.length > 0) {
  console.log(`XX report-name-column-setting: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK report-name-column-setting: naamkolom-opties blijven bewaard en geklemd');
