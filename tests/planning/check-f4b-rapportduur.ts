// F4b (spec "alleen uren" §3.12, B8): de duren in de tabelrapporten staan in de maat van de taak.
//
// In het OPS-profiel staat een dagenmaat-taak in d ("2,5d") en een urenmaat-taak in u ("40u"); onder P6
// en MSP volgt de duur Duurweergave, zoals de kolom Duur van de tabel. De rest staat altijd in de eigen
// maat, zoals de kolom Resterende duur. Eén regel voor tabel en rapport: `formatMeasuredDurationText`.
// Een verzamelrij van de WBS-samenvatting heeft geen eigen maat en toont werkdagen.
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useAppStore } from '@/state/appStore';
import {
  computeWbsSummary, durationMeasure, remainingDays, remainingMeasure, taskHoursPerDay, type ReportContext,
} from '@/engine/reports';
import {
  formatMeasuredDurationText, formatRemainingDurationText, formatTaskDurationText, taskMeasuredDuration,
  type DurationTextFormat,
} from '@/utils/taskDuration';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

const S = () => useAppStore.getState();
const nl: DurationTextFormat = { suffixes: { day: 'd', hour: 'u', minute: 'm' }, locale: 'nl' };

// ── 1. De tekst van een duur in zijn maat ────────────────────────────────────────────────────────
same('dagenmaat met een breuk: "2,5d"', formatMeasuredDurationText({ unit: 'days', days: 2.5 }, 8, nl), '2,5d');
same('urenmaat: "40u"', formatMeasuredDurationText({ unit: 'hours', minutes: 2400 }, 8, nl), '40u');
same('urenmaat met minuten: "12u 30m"', formatMeasuredDurationText({ unit: 'hours', minutes: 750 }, 8, nl), '12u 30m');
same('Duurweergave Altijd dagen (P6/MSP): "5d(40u)"', formatMeasuredDurationText({ unit: 'hours', minutes: 2400 }, 8, { ...nl, display: 'days' }), '5d(40u)');
same('Duurweergave Altijd uren (P6/MSP): "20u(2,5d)"', formatMeasuredDurationText({ unit: 'days', days: 2.5 }, 8, { ...nl, display: 'hours' }), '20u(2,5d)');
same('Duurweergave in de eigen maat: geen haakjes', formatMeasuredDurationText({ unit: 'days', days: 3 }, 8, { ...nl, display: 'days' }), '3d');

// ── 2. Een project met een dagenmaat- en een urenmaat-taak ───────────────────────────────────────
S().newProject();
S().setProject({ name: 'Rapportduur', startDate: '2026-06-01' });
const fase = S().addTask({ name: 'Fase' });
const dag = S().addTask({ name: 'Dagenmaat', parentId: fase });
const uur = S().addTask({ name: 'Urenmaat', parentId: fase });
{
  const d = S().tasks.find(t => t.id === dag)!;
  S().updateTask(dag, { time: { ...d.time, durationUnit: 'days', scheduleDuration: 2.5 } });
  const u = S().tasks.find(t => t.id === uur)!;
  S().updateTask(uur, { time: { ...u.time, durationUnit: 'hours', durationMinutes: 2400 } });
}
S().runCPM();
S().setStatusDate('2026-06-03');
S().setActualStart(dag, '2026-06-01');
S().setTaskProgress(dag, 0.4);
S().setActualStart(uur, '2026-06-01');
S().setTaskProgress(uur, 0.25);
S().runCPM();
const byId = (id: string) => S().tasks.find(t => t.id === id)!;
same('opzet: de maten van de taken', [byId(dag).time.durationUnit, byId(uur).time.durationUnit], ['days', 'hours']);

const s = S();
const ctx: ReportContext = {
  tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
  calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult, baseline: null,
  statusDate: s.project.statusDate, today: '2026-06-03',
};

// ── 3. De rest in de maat van de taak (B3 exact, B8) ─────────────────────────────────────────────
same('rest dagenmaat 2,5 d op 40 %: 1,5 d', remainingMeasure(byId(dag)), { unit: 'days', days: 1.5 });
same('rest urenmaat 40 u op 25 %: 30 u', remainingMeasure(byId(uur)), { unit: 'hours', minutes: 1800 });
same('rest als tekst, zoals de tabel', [
  formatMeasuredDurationText(remainingMeasure(byId(dag)), 1, nl),
  formatMeasuredDurationText(remainingMeasure(byId(uur)), 1, nl),
], [formatRemainingDurationText(byId(dag), nl), formatRemainingDurationText(byId(uur), nl)]);
same('rest als tekst: "1,5d" en "30u"', [
  formatRemainingDurationText(byId(dag), nl), formatRemainingDurationText(byId(uur), nl),
], ['1,5d', '30u']);
same('het getal remainingDays blijft voor tellingen', remainingDays(ctx, byId(dag)), 1.5);
{
  const done = { ...byId(uur), time: { ...byId(uur).time, completion: 1, actualFinish: '2026-06-05T16:00', remainingMinutes: 600 } };
  same('voltooid: rest 0 in de eigen maat', remainingMeasure(done), { unit: 'hours', minutes: 0 });
  // Een gelezen bestand kan een oude rest naast een werkelijk einde hebben: het rapport toont dan 0,
  // zoals het getal remainingDays.
  const doneDays = { ...byId(dag), time: { ...byId(dag).time, completion: 1, actualFinish: '2026-06-03T12:00', remainingTime: 0.5 } };
  same('voltooid met een oude rest: 0 d', [remainingMeasure(doneDays), remainingDays(ctx, doneDays)], [{ unit: 'days', days: 0 }, 0]);
}

// ── 4. De duur in de WBS-samenvatting ────────────────────────────────────────────────────────────
const wbs = computeWbsSummary(ctx, { maxLevel: 0, includeActivities: true });
const row = (id: string) => wbs.rows.find(r => r.taskId === id);
same('activiteit dagenmaat: duur in haar maat', row(dag)?.duration, { unit: 'days', days: 2.5 });
same('activiteit urenmaat: duur in haar maat', row(uur)?.duration, { unit: 'hours', minutes: 2400 });
same('verzamelrij: geen eigen maat', row(fase)?.duration, undefined);
same('werktijd per dag van de taakkalender', row(uur)?.hoursPerDay, taskHoursPerDay(ctx, byId(uur)));
same('rapportduur = tabelduur (OPS: eigen maat)', [
  formatMeasuredDurationText(row(dag)!.duration!, row(dag)!.hoursPerDay, nl),
  formatMeasuredDurationText(row(uur)!.duration!, row(uur)!.hoursPerDay, nl),
], [
  formatTaskDurationText(byId(dag), taskHoursPerDay(ctx, byId(dag)), nl),
  formatTaskDurationText(byId(uur), taskHoursPerDay(ctx, byId(uur)), nl),
]);
same('durationMeasure = de maat van de tabel', durationMeasure(byId(uur)), taskMeasuredDuration(byId(uur)));

// ── 5. De rapportkolommen gebruiken deze regel ───────────────────────────────────────────────────
const root = resolvePath(fileURLToPath(new URL('.', import.meta.url)), '../../src');
const spec = readFileSync(resolvePath(root, 'components', 'panels', 'reports', 'useTableReportSpec.tsx'), 'utf8');
same('kolom Rest: de rest in de maat van de taak', /key: 'remaining',[^\n]*text: r => dd\.remaining\(r\.remaining\)/.test(spec), true);
same('kolom Duur (WBS): de duur in haar maat, een verzamelrij in werkdagen',
  /key: 'duration',[^\n]*text: r => \(r\.duration \? dd\.duration\(r\.duration, r\.hoursPerDay\) : dd\.workDays\(r\.durationDays\)\)/.test(spec), true);
same('Duurweergave volgt het profiel (B9: OPS altijd de eigen maat)', /useEffectiveDurationDisplay\(\)/.test(spec), true);
const nlReport = JSON.parse(readFileSync(resolvePath(root, 'i18n', 'locales', 'nl', 'report.json'), 'utf8'));
const enReport = JSON.parse(readFileSync(resolvePath(root, 'i18n', 'locales', 'en', 'report.json'), 'utf8'));
same('kop zonder "(wd)": de eenheid staat in de waarde', [
  nlReport.tableReports.common.remaining, enReport.tableReports.common.remaining,
  nlReport.tableReports.wbsSummary.duration, enReport.tableReports.wbsSummary.duration,
], ['Rest', 'Rem.', 'Duur', 'Duration']);

if (failures.length > 0) {
  for (const f of failures) console.log(`   XX ${f}`);
  console.error(`\nTOTAAL: ${failures.length}/${checks} afwijking(en)`);
  process.exit(1);
}
console.log(`   OK ${checks} controles op de rapportduren (F4b, B8)`);
console.log('\nTOTAAL: alles groen');
process.exit(0);
