// Resourcediagram (issue #113): het rapporttype en zijn twee opties zijn rapportvoorkeuren in
// ops-reportSettings. Deze batterij bewaakt de defaults (uit/uit — een verse installatie gedraagt
// zich als vóór het bestaan van het type), de round-trip door de echte opslagroute en de
// tolerantie voor een ontbrekend of geprutst `resourceGantt`-blok (per veld terug op de default,
// nooit de rest van de voorkeuren wegvagen).
import './domStub';
import {
  DEFAULT_REPORT_SETTINGS, DEFAULT_RESOURCE_GANTT_OPTIONS, isGanttReportType, loadReportSettings, reportTypeDrawsRelations,
  reportTypeShowsCriticalToggle, saveReportSettings,
} from '@/utils/reportSettings';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

expect('defaults: blad per resource uit, taken zonder resource uit', DEFAULT_REPORT_SETTINGS.resourceGantt, { pageBreakPerResource: false, includeUnassigned: false });
expect('defaults: één bron', DEFAULT_REPORT_SETTINGS.resourceGantt, DEFAULT_RESOURCE_GANTT_OPTIONS);
expect('isGanttReportType: gantt én resourceGantt', [isGanttReportType('gantt'), isGanttReportType('resourceGantt'), isGanttReportType('milestones'), isGanttReportType('resourceAssignments')], [true, true, false, false]);
// Review N6: één predicaat voor "dit type tekent geen relaties" — de forcering van showDeps én het
// verborgen vinkje hangen er allebei aan; showDeps staat standaard aan, dus de forcering is dragend.
expect('reportTypeDrawsRelations: alleen het resourcediagram tekent geen relaties', [reportTypeDrawsRelations('gantt'), reportTypeDrawsRelations('resourceGantt'), reportTypeDrawsRelations('lookAhead')], [true, false, true]);
expect('showDeps staat standaard aan (de forcering doet dus echt iets)', DEFAULT_REPORT_SETTINGS.showDeps, true);
// manuvarkey op #113: het kritiek-pad-vinkje stuurt alleen relatielijnen + legendaregel (de balken volgen
// barColorSelection), dus zonder lijnen is het misleidend — verborgen op hetzelfde predicaat als de relaties.
expect('reportTypeShowsCriticalToggle: verborgen waar geen relaties getekend worden', [reportTypeShowsCriticalToggle('gantt'), reportTypeShowsCriticalToggle('resourceGantt'), reportTypeShowsCriticalToggle('milestones')], [true, false, true]);

localStorage.setItem('ops-reportSettings', JSON.stringify({ reportType: 'resourceGantt', resourceGantt: { pageBreakPerResource: true, includeUnassigned: true } }));
const loaded = await loadReportSettings();
expect('opgeslagen rapporttype resourceGantt wordt geladen', loaded.reportType, 'resourceGantt');
expect('opgeslagen opties worden geladen', loaded.resourceGantt, { pageBreakPerResource: true, includeUnassigned: true });

localStorage.setItem('ops-reportSettings', JSON.stringify({ reportType: 'gantt', showLegend: false }));
const zonderBlok = await loadReportSettings();
expect('ontbrekend resourceGantt-blok (oudere versie) ⇒ defaults', zonderBlok.resourceGantt, DEFAULT_RESOURCE_GANTT_OPTIONS);
expect('… en de overige voorkeuren blijven staan', zonderBlok.showLegend, false);

localStorage.setItem('ops-reportSettings', JSON.stringify({ resourceGantt: { pageBreakPerResource: 'ja', includeUnassigned: true } }));
const rommel = await loadReportSettings();
expect('rommel in één veld ⇒ alleen dat veld terug op de default', rommel.resourceGantt, { pageBreakPerResource: false, includeUnassigned: true });
localStorage.setItem('ops-reportSettings', JSON.stringify({ resourceGantt: 'aan' }));
expect('rommel in het hele blok ⇒ defaults', (await loadReportSettings()).resourceGantt, DEFAULT_RESOURCE_GANTT_OPTIONS);
localStorage.setItem('ops-reportSettings', JSON.stringify({ reportType: 'resourceDiagram' }));
expect('onbekend rapporttype ⇒ default rapporttype', (await loadReportSettings()).reportType, DEFAULT_REPORT_SETTINGS.reportType);

await saveReportSettings({ ...DEFAULT_REPORT_SETTINGS, reportType: 'resourceGantt', resourceGantt: { pageBreakPerResource: true, includeUnassigned: false } });
const saved = await loadReportSettings();
expect('rapporttype overleeft een round-trip', saved.reportType, 'resourceGantt');
expect('opties overleven een round-trip', saved.resourceGantt, { pageBreakPerResource: true, includeUnassigned: false });

if (failures.length > 0) {
  console.log(`XX report-resource-gantt-setting: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK report-resource-gantt-setting: rapporttype en opties blijven bewaard en tolerant geladen');
