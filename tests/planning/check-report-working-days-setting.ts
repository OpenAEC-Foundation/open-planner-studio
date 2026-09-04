// De werkdagen-as van een rapport is een eigen rapportvoorkeur, niet een afgeleide van de
// scherminstelling. Deze batterij bewaakt de default én de round-trip door de echte opslagroute.
import './domStub';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings, saveReportSettings } from '@/utils/reportSettings';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (got !== want) failures.push(`${label}: verwacht ${String(want)}, kreeg ${String(got)}`);
};

const defaults = DEFAULT_REPORT_SETTINGS as unknown as Record<string, unknown>;
expect('een nieuw rapport toont standaard alle kalenderdagen', defaults.compressNonWorkdays, false);

localStorage.setItem('ops-reportSettings', JSON.stringify({ compressNonWorkdays: true }));
const loaded = await loadReportSettings() as unknown as Record<string, unknown>;
expect('de opgeslagen rapportkeuze voor werkdagen wordt geladen', loaded.compressNonWorkdays, true);

await saveReportSettings({ ...DEFAULT_REPORT_SETTINGS, compressNonWorkdays: true });
const saved = await loadReportSettings() as unknown as Record<string, unknown>;
expect('de rapportkeuze voor werkdagen overleeft een round-trip', saved.compressNonWorkdays, true);

if (failures.length > 0) {
  console.log(`XX report-working-days-setting: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK report-working-days-setting: rapportkeuze blijft zelfstandig bewaard');
