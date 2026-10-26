import './domStub';
// Eén dag is de werktijd van de taakkalender (eigenaarsbesluit 2026-10-15, optie 2).
//
// Een P6-kalender draagt een los getal "uren per dag" (`hoursPerDay`, XER `day_hr_cnt`). P6 gebruikt dat
// alleen om uren voor het scherm om te rekenen. De werktijdblokken kunnen langer zijn: in
// Roads_Project_TEC.xer staat 8 u/dag bij blokken van 10 u. Een urentaak bewaart haar duur in
// `durationMinutes`; het verborgen dagengetal `scheduleDuration` is overal werkminuten ÷ de werktijd per
// dag van de taakkalender (`hourTaskScheduleDuration`). Een taak van 1870 u is dus 187 dagen, niet 233,75.
// De 8 blijft op de kalender en gaat ongewijzigd mee in de export. Bron:
// docs/superpowers/plans/2026-10-07-review-pr109-uitkomsten.md op `claude/review-pr109-log` ("een dag", #354).
//
// Fixture: een kleine XER met kalender "Lange dagen" (day_hr_cnt 8, ma–vr 07:00–17:00 = 10 u) en een
// urentaak van 1870 u, plus een dagkalender met een dagtaak van 40 u (5 d).
//  §1 XER-import: dagengetal 187; de kalender houdt 8; de dagtaak blijft 5 d.
//  §2 IFC-round-trip (lezer en schrijver): 187 en 8; de geschreven duur blijft 1870 u.
//  §3 de echte openroute, een rasterbewerking (1870 u en 1880 u), daarna opslaan als IFC en heropenen.
//  §4 export: P6 XML `HoursPerDay` 8 en `PlannedDuration` 1870; MSPDI `MinutesPerDay` 480, `<Duration>` en
//     `<Work>` (terugval duur × inzet) 1870 u; heropenen van die exports geeft weer 187.
//  §5 resourcebelasting: de taak belast 187 werkdagen (1870 u), tot en met haar vroegste einde.
//  §6 kalenderwissel: blokken naar 8 u ⇒ dagengetal 233,75; de uren per dag blijven 8; de restduur volgt.
//  §7 materiaal uit XER (TASKRSRC, tempo per uur): totaal = tempo × uren, ook als de resourcekalender
//     een andere dag heeft dan de taakkalender (Roads: 85 toewijzingen, 8 daarvan zo); de dagtaak blijft.
//  §8 MSPDI-baseline van een urentaak: `<Baseline><Duration>` 1870 u, heropend weer 187 d; ook als de kalender
//     na heropenen 8 u/dag houdt (#366, §8b); een oude baseline (233,75 d) gaat als 1870 u (§8c); een nieuwe
//     baseline van een taak die daarna × 0,8 korter werd, blijft 10 u / 100 u en krijgt geen ⚠ (§8d); een oude
//     baseline van een taak die daarna × 1,25 langer werd, houdt ⚠ en gaat als 1870 u (§8e).
import { readXER } from '@/services/xer/xerReader';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { mspdiBaselineDays, readMSPDI } from '@/services/msproject/mspdiReader';
import { createBaselineOldDayCheck } from '@/engine/baselineOldDay';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { isMultiDocumentImport, type ImportResult, type OpenedImport } from '@/services/importTypes';
import type { DocumentPayload } from '@/state/documentContract';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import { effHoursPerDay } from '@/utils/taskDuration';
import { installDOMParser } from './xmldom-shim';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

declare const process: { exit(code: number): never };

// De P6 XML- en MSPDI-lezer gebruiken de browser-`DOMParser`; in Node via de minimale shim.
installDOMParser();

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want).slice(0, 400)}\n        kreeg    ${JSON.stringify(got).slice(0, 400)}`);
  }
}
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Fixture
// ════════════════════════════════════════════════════════════════════════════════════════════════
// P6-weekdagen: 1 = zondag … 7 = zaterdag. Ma–vr 07:00–17:00.
const tenHours = (d: number) => (d >= 2 && d <= 6 ? `(0||${d}()((0||0(s|07:00|f|17:00)())))` : `(0||${d}()())`);
const CAL10 = `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(tenHours).join('')}))(0||Exceptions()())))`;
const XER = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tDag is werktijd\tC1\t2026-08-03',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tLange dagen\tP1\tCA_Project\t8\t40\t${CAL10}`,
  '%R\tC2\tDagkalender\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tA\tP1\tC1\tA\tLange urentaak\tTT_Task\tTK_NotStart\tCP_Drtn\t0\t\t1870\t1870\t2026-08-03 07:00\t2027-04-20 17:00',
  '%R\tD\tP1\tC2\tD\tDagtaak\tTT_Task\tTK_NotStart\tCP_Drtn\t0\t\t40\t40\t2026-08-03\t2026-08-07',
  '%E',
].join('\n');
const XER_BYTES = new TextEncoder().encode(XER);

function single(opened: OpenedImport): ImportResult {
  if (isMultiDocumentImport(opened)) throw new Error('fixture gaf meerdere documenten');
  return opened;
}
const calendarsOf = (r: Pick<ImportResult, 'calendar' | 'resourceCalendars'>): WorkCalendar[] =>
  [r.calendar, ...(r.resourceCalendars ?? [])];
const calNamed = (cals: readonly WorkCalendar[], name: string) => cals.find((c) => c.name === name);
const taskCoded = (tasks: readonly Task[], code: string) => tasks.find((t) => t.wbsCode === code);
/** Het taakbeeld dat deze check toetst: eenheid, minuten, dagengetal. */
const shape = (t: Task | undefined) => t && ({ unit: t.time.durationUnit, min: t.time.durationMinutes ?? null, sd: t.time.scheduleDuration });
const HOUR_TASK = { unit: 'hours', min: 112200, sd: 187 };
const DAY_TASK = { unit: 'days', min: null, sd: 5 };

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 XER-import
// ════════════════════════════════════════════════════════════════════════════════════════════════
const imported = quiet(() => single(readXER(XER_BYTES)));
{
  const long = calNamed(calendarsOf(imported), 'Lange dagen');
  same('§1 testvoorwaarde: "Lange dagen" is een blokkenkalender van 10 u met 8 u/dag',
    long && { hpd: long.hoursPerDay, blocks: effHoursPerDay(long) }, { hpd: 8, blocks: 10 });
  same('§1 XER-import: urentaak 1870 u ⇒ dagengetal 187 (1870 ÷ 10), niet 233,75 (1870 ÷ 8)',
    shape(taskCoded(imported.tasks, 'A')), HOUR_TASK);
  same('§1 XER-import: de dagtaak blijft 5 d (40 ÷ 8, de bronomrekening)', shape(taskCoded(imported.tasks, 'D')), DAY_TASK);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 IFC-round-trip (schrijver + lezer)
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const ifc = quiet(() => writeIFC(imported));
  const back = quiet(() => readIFC(ifc));
  same('§2 IFC-round-trip: urentaak 187', shape(taskCoded(back.tasks, 'A')), HOUR_TASK);
  same('§2 IFC-round-trip: dagtaak 5', shape(taskCoded(back.tasks, 'D')), DAY_TASK);
  same('§2 IFC-round-trip: "Lange dagen" houdt 8 u/dag', calNamed(calendarsOf(back), 'Lange dagen')?.hoursPerDay, 8);
  same('§2 IFC-bestand: de urentaak staat er als 1870 u (de geschreven uren veranderen niet)',
    /'PT1870H0M0S'/.test(ifc), true);
  same('§2 IFC-bestand: HoursPerDay 8 apart bewaard bij de blokkenkalender', /'HoursPerDay',\$,IFCREAL\(8\.\)/.test(ifc), true);
  const twice = quiet(() => readIFC(writeIFC(back)));
  same('§2 tweede IFC-round-trip: nog steeds 187 en 8',
    [shape(taskCoded(twice.tasks, 'A')), calNamed(calendarsOf(twice), 'Lange dagen')?.hoursPerDay], [HOUR_TASK, 8]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 De echte openroute, een rasterbewerking, opslaan als IFC en heropenen
// ════════════════════════════════════════════════════════════════════════════════════════════════
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openInStore(parsed: OpenedImport) {
  const ctx = createAppStoreContext();
  quiet(() => ctx.store.getState().applyOpenedImport(parsed, OPEN));
  return ctx;
}
type Ctx = ReturnType<typeof openInStore>;
const payloadOf = (ctx: Ctx): DocumentPayload => {
  const s = ctx.store.getState();
  return s.getOpenDocumentPayloads().find((d) => d.payload.project.id === s.project.id)!.payload;
};
const taskIn = (ctx: Ctx, code: string) => taskCoded(ctx.store.getState().tasks, code)!;
function gridDuration(ctx: Ctx, code: string, text: string): void {
  const cell: CellEditIntent = {
    kind: 'cell-edit', taskId: taskIn(ctx, code).id, columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'],
    route: 'task-schedule', value: parseTaskDurationInput(text, 'hours'),
  };
  const res = quiet(() => ctx.store.getState().runGridMutation([cell]));
  if (!(res as { ok: boolean }).ok) failures.push(`§3 rasterbewerking ${text} geweigerd: ${JSON.stringify(res).slice(0, 300)}`);
  checks++;
}
async function reopenAsIfc(ctx: Ctx): Promise<Ctx> {
  const ifc = quiet(() => writeIFC(buildWriteIFCInput(payloadOf(ctx))));
  return openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.ifc', text: ifc }));
}
const ctx = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.xer', bytes: XER_BYTES }));
{
  same('§3 geopend via de openroute: 187', shape(taskIn(ctx, 'A')), HOUR_TASK);
  gridDuration(ctx, 'A', '1870h');
  same('§3 rasterbewerking (dezelfde 1870 u): 187', shape(taskIn(ctx, 'A')), HOUR_TASK);
  const reopened = await reopenAsIfc(ctx);
  same('§3 rasterbewerking + IFC: 187, zelfde datums',
    [shape(taskIn(reopened, 'A')), taskIn(reopened, 'A').time.earlyFinish],
    [HOUR_TASK, taskIn(ctx, 'A').time.earlyFinish]);
  gridDuration(ctx, 'A', '1880h');
  same('§3 rasterbewerking 1880 u: 188', shape(taskIn(ctx, 'A')), { unit: 'hours', min: 112800, sd: 188 });
  const reopened2 = await reopenAsIfc(ctx);
  same('§3 rasterbewerking 1880 u + IFC: 188 en de kalender houdt 8',
    [shape(taskIn(reopened2, 'A')), calNamed(reopened2.store.getState().calendars, 'Lange dagen')?.hoursPerDay],
    [{ unit: 'hours', min: 112800, sd: 188 }, 8]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 Export: de 8 en de uren gaan ongewijzigd mee; heropenen geeft weer 187
// ════════════════════════════════════════════════════════════════════════════════════════════════
const loadCtx = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.xer', bytes: XER_BYTES }));
{
  const s = loadCtx.store.getState();
  const resId = s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
  loadCtx.store.getState().assignResource(taskIn(loadCtx, 'A').id, resId, 1);
  loadCtx.store.getState().runCPM();
  const p = payloadOf(loadCtx);
  const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, 'g'))].map((m) => m[1]);

  const p6 = quiet(() => writeP6XMLWithReport(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.customTaskTypes).xml);
  const p6Cal = [...p6.matchAll(/<Calendar>([\s\S]*?)<\/Calendar>/g)].map((m) => m[1]).find((b) => b.includes('<Name>Lange dagen</Name>'));
  same('§4 P6 XML: "Lange dagen" HoursPerDay 8', p6Cal && tag(p6Cal, 'HoursPerDay')[0], '8');
  const p6Act = [...p6.matchAll(/<Activity>([\s\S]*?)<\/Activity>/g)].map((m) => m[1]).find((b) => b.includes('<Name>Lange urentaak</Name>'));
  same('§4 P6 XML: PlannedDuration van de urentaak 1870 u', p6Act && tag(p6Act, 'PlannedDuration')[0], '1870');
  const p6Back = quiet(() => readP6XML(p6));
  same('§4 P6 XML heropend: urentaak 187', shape(p6Back.tasks.find((t) => t.name === 'Lange urentaak')), HOUR_TASK);

  const msp = quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars));
  same('§4 MSPDI: MinutesPerDay 480 (de projectkalender "Lange dagen" houdt 8 u/dag)', tag(msp, 'MinutesPerDay')[0], '480');
  const mspTask = [...msp.matchAll(/<Task>([\s\S]*?)<\/Task>/g)].map((m) => m[1]).find((b) => b.includes('<Name>Lange urentaak</Name>'));
  same('§4 MSPDI: <Duration> van de urentaak 1870 u', mspTask && tag(mspTask, 'Duration')[0], 'PT1870H0M0S');
  const mspAsg = [...msp.matchAll(/<Assignment>([\s\S]*?)<\/Assignment>/g)].map((m) => m[1]);
  same('§4 MSPDI: <Work> van de toewijzing (terugval duur × inzet) 1870 u, niet 187 × 8 = 1496 u',
    mspAsg.map((b) => tag(b, 'Work')[0]), ['PT1870H0M0S']);
  const mspBack = quiet(() => readMSPDI(msp));
  same('§4 MSPDI heropend: urentaak 187', shape(mspBack.tasks.find((t) => t.name === 'Lange urentaak')), HOUR_TASK);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 Resourcebelasting: 187 werkdagen van 10 u, niet 234
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const s = loadCtx.store.getState();
  const a = taskIn(loadCtx, 'A');
  const res = computeResourceLoad(s.resources, s.assignments, s.tasks, s.calendar, s.calendars, effectiveSchedulingOptions(s.project));
  const bucket = Object.values(res.load)[0] ?? {};
  const days = Object.keys(bucket).sort();
  same('§5 belasting: 187 belaste dagen, 187 eenheden, 1870 u',
    { days: days.length, units: Object.values(bucket).reduce((x, y) => x + y, 0), hours: Object.values(res.hours)[0] },
    { days: 187, units: 187, hours: 1870 });
  same('§5 belasting: de laatste belaste dag is het vroegste einde van de taak',
    days[days.length - 1], a.time.earlyFinish.slice(0, 10));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §6 Kalenderwissel: het dagengetal volgt de nieuwe werktijd per dag
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const c = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.xer', bytes: XER_BYTES }));
  const cal = calNamed(c.store.getState().calendars, 'Lange dagen')!;
  const eight = [{ start: 420, end: 900 }];
  const workTime: WorkTimeBands = { byWeekday: { 1: eight, 2: eight, 3: eight, 4: eight, 5: eight, 6: [], 7: [] } };
  // Een gestarte urentaak: haar restduur in dagen heeft de vorm van het dagengetal.
  c.store.setState((s) => {
    const t = s.tasks.find((x) => x.wbsCode === 'A')!;
    t.time.remainingMinutes = 56100;
    t.time.remainingTime = 93.5;
  });
  quiet(() => c.store.getState().updateCalendar(cal.id, { workTime, workEndHour: 15 }));
  const t = taskIn(c, 'A');
  same('§6 blokken naar 8 u: 1870 u ⇒ 233,75 d, restduur 56100 min ⇒ 116,875 d; de kalender houdt 8 u/dag',
    [shape(t), t.time.remainingMinutes, t.time.remainingTime, calNamed(c.store.getState().calendars, 'Lange dagen')?.hoursPerDay],
    [{ unit: 'hours', min: 112200, sd: 233.75 }, 56100, 116.875, 8]);
  same('§6 de dagtaak op de andere kalender blijft 5 d', shape(taskIn(c, 'D')), DAY_TASK);
  c.store.getState().undo();
  same('§6 ongedaan maken: weer 187 en 93,5', [shape(taskIn(c, 'A')), taskIn(c, 'A').time.remainingTime], [HOUR_TASK, 93.5]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §7 Materiaal uit XER: tempo per uur × uren, niet × 8 × 187
// ════════════════════════════════════════════════════════════════════════════════════════════════
// TASKRSRC geeft materiaal als tempo per uur (`target_qty_per_hr`). De lezer maakt er een tempo per dag
// van; de belasting is dat tempo × de dagen van de taak. Bij een urentaak zijn dat 187 dagen van 10 u, dus
// moet het tempo per dag × 10 zijn — ook als de resource op een kalender van 8 u staat (Wapening, zoals 8
// van de 85 materiaaltoewijzingen in Roads). Zand op de dagtaak is de bewaking: zijn resourcekalender heeft
// blokken van 10 u, maar een dagtaak houdt de opgeslagen 8 van de resourcekalender (3 × 8 × 5 d = 3 × 40 u).
{
  const XER_MAT = [
    ...XER.split('\n').filter((l) => l !== '%E'),
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr\tunit_id\trole_id',
    '%R\tM1\tBeton\tRT_Mat\tC1\t1\t\t',
    '%R\tM2\tWapening\tRT_Mat\tC2\t1\t\t',
    '%R\tM3\tZand\tRT_Mat\tC1\t1\t\t',
    '%T\tTASKRSRC',
    '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty',
    '%R\tTR1\tP1\tA\tM1\t\t1\t1\t1870\t1870',
    '%R\tTR2\tP1\tA\tM2\t\t2\t2\t3740\t3740',
    '%R\tTR3\tP1\tD\tM3\t\t3\t3\t120\t120',
    '%E',
  ].join('\n');
  const m = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd-materiaal.xer', bytes: new TextEncoder().encode(XER_MAT) }));
  const s = m.store.getState();
  const perDay = Object.fromEntries(s.assignments.map((a) => [a.resourceId, a.unitsPerDay]));
  same('§7 tempo per dag: Beton 1 × 10, Wapening 2 × 10 (taakdag, niet de 8 u van zijn eigen kalender), Zand 3 × 8 (dagtaak; niet × 10 van zijn blokken)',
    perDay, { 'xer-resource:M1': 10, 'xer-resource:M2': 20, 'xer-resource:M3': 24 });
  const res = computeResourceLoad(s.resources, s.assignments, s.tasks, s.calendar, s.calendars, effectiveSchedulingOptions(s.project));
  const total = (rid: string) => Math.round(Object.values(res.load[rid] ?? {}).reduce((x, y) => x + y, 0) * 1000) / 1000;
  same('§7 materiaaltotaal = tempo × uren: 1 × 1870, 2 × 1870, 3 × 40',
    [total('xer-resource:M1'), total('xer-resource:M2'), total('xer-resource:M3')], [1870, 3740, 120]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §8 MSPDI-baseline van een urentaak: 1870 u, heropend 187 d
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const b = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.xer', bytes: XER_BYTES }));
  quiet(() => b.store.getState().saveBaseline('Basis'));
  const st = b.store.getState();
  same('§8 testvoorwaarde: de baseline van de urentaak is 187 d', st.baselines[0]?.tasks.find((x) => x.taskId === taskIn(b, 'A').id)?.duration, 187);
  const msp = quiet(() => writeMSPDI(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars,
    st.baselines, st.activeBaselineId));
  const mspTask = (name: string) => [...msp.matchAll(/<Task>([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((x) => x.includes(`<Name>${name}</Name>`));
  const baselineDuration = (block: string | undefined) => block?.match(/<Baseline>[\s\S]*?<Duration>([^<]*)<\/Duration>/)?.[1];
  same('§8 MSPDI: <Baseline><Duration> van de urentaak 1870 u (187 × 10), niet 1496 u (187 × 8); de dagtaak 40 u',
    [baselineDuration(mspTask('Lange urentaak')), baselineDuration(mspTask('Dagtaak'))], ['PT1870H0M0S', 'PT40H0M0S']);
  const back = quiet(() => readMSPDI(msp));
  const backA = back.tasks.find((t) => t.name === 'Lange urentaak');
  const backBaseline = back.baselines?.[0]?.tasks.find((x) => x.taskId === backA?.id)?.duration;
  same('§8 MSPDI heropend: taak 187 d en baseline 187 d (geen afwijking)', [backA?.time.scheduleDuration, backBaseline], [187, 187]);

  // §8b Zoals na #366: de kalender houdt na heropenen zijn eigen 8 u/dag (`MinutesPerDay` 480) naast
  // blokken van 10 u. De lezer moet de baseline dan nog steeds in de werktijd per dag lezen (187 d), net
  // als de taak en als de schrijver; met de opgeslagen 8 werd het 234 d, een nep-afwijking van −47 d.
  const long = calNamed(calendarsOf(imported), 'Lange dagen')!;
  same('§8b lezer met 8 u/dag en blokken van 10 u: <Baseline><Duration> PT1870H0M0S ⇒ 187 d; dagtaak PT40H0M0S op 8 u ⇒ 5 d',
    [long.hoursPerDay, mspdiBaselineDays('PT1870H0M0S', true, long, long.hoursPerDay), mspdiBaselineDays('PT40H0M0S', false, long, 8)],
    [8, 187, 5]);

  // §8c Een baseline met de oude dagtelling (fixture gemaakt met main: 233,75 d = 1870 u ÷ 8) gaat in de
  // opgeslagen uren per dag naar MSPDI: 1870 u, zoals main schreef — niet 233,75 × 10 = 2337,5 u.
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const oldIfc = readFileSync(join(ROOT, 'tests', 'browser', 'fixtures', 'ifc', 'oude-baseline.ifc'), 'utf8');
  const o = openInStore(await parseOpenedFile({ name: 'oude-baseline.ifc', text: oldIfc }));
  const os = o.store.getState();
  const oldA = taskIn(o, 'A');
  same('§8c testvoorwaarde: taak 187 d, oude baseline 233,75 d',
    [oldA.time.scheduleDuration, os.baselines[0]?.tasks.find((x) => x.taskId === oldA.id)?.duration], [187, 233.75]);
  const oldMsp = quiet(() => writeMSPDI(os.project, os.calendar, os.tasks, os.sequences, os.resources, os.assignments, os.calendars,
    os.baselines, os.activeBaselineId));
  const oldTask = [...oldMsp.matchAll(/<Task>([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((x) => x.includes('<Name>Lange urentaak</Name>'));
  same('§8c MSPDI: oude baseline van de urentaak 1870 u (233,75 × 8), niet 2337,5 u', baselineDuration(oldTask), 'PT1870H0M0S');
  const oldBack = quiet(() => readMSPDI(oldMsp));
  const oldBackA = oldBack.tasks.find((t) => t.name === 'Lange urentaak');
  same('§8c MSPDI heropend: 1870 u is in de werktijd per dag 187 d, net als de taak',
    [oldBackA?.time.scheduleDuration, oldBack.baselines?.[0]?.tasks.find((x) => x.taskId === oldBackA?.id)?.duration], [187, 187]);

  // §8d Een NIEUWE baseline, daarna wordt de taak korter met precies de factor opgeslagen ÷ werktijd
  // (8 ÷ 10). De baseline past dan via de huidige minuten bij de oude telling, maar via haar span nog
  // bij de nieuwe: geen ⚠, en de echte afwijking blijft in MS Project (baseline 10 u, niet 8 u).
  for (const [before, after, wantDays, wantMsp] of [['10h', '8h', 1, 'PT10H0M0S'], ['100h', '80h', 10, 'PT100H0M0S']] as const) {
    const c = openInStore(await parseOpenedFile({ name: 'dag-is-werktijd.xer', bytes: XER_BYTES }));
    gridDuration(c, 'A', before);
    quiet(() => c.store.getState().runCPM());
    quiet(() => c.store.getState().saveBaseline('Basis'));
    gridDuration(c, 'A', after);
    quiet(() => c.store.getState().runCPM());
    const st = c.store.getState();
    const a = taskIn(c, 'A');
    const bt = st.baselines[0]!.tasks.find((x) => x.taskId === a.id)!;
    const warn = createBaselineOldDayCheck(st.calendar, st.calendars)(a, bt);
    const out = quiet(() => writeMSPDI(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars,
      st.baselines, st.activeBaselineId));
    const block = [...out.matchAll(/<Task>([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((x) => x.includes('<Name>Lange urentaak</Name>'));
    same(`§8d nieuwe baseline ${before}, daarna ${after}: baseline ${wantDays} d, geen ⚠, MSPDI-baseline ${wantMsp}`,
      [bt.duration, a.time.durationMinutes, warn, baselineDuration(block)],
      [wantDays, Number.parseInt(after, 10) * 60, false, wantMsp]);
  }

  // §8e De spiegel van §8d: een OUDE baseline (233,75 d), daarna wordt de taak langer met precies de factor
  // werktijd ÷ opgeslagen (10 ÷ 8): 1870 u → 2337,5 u = 233,75 × 600 min. De huidige minuten passen dan bij
  // de nieuwe telling, maar de span van de baseline past bij de oude en beslist: ⚠, en de MSPDI-baseline
  // blijft 1870 u (233,75 × 8). Zonder span-voorrang verdween de afwijking in MS Project (PT2337H30M0S).
  {
    const e = openInStore(await parseOpenedFile({ name: 'oude-baseline.ifc', text: oldIfc }));
    gridDuration(e, 'A', '2337.5h');
    quiet(() => e.store.getState().runCPM());
    const st = e.store.getState();
    const a = taskIn(e, 'A');
    const bt = st.baselines[0]!.tasks.find((x) => x.taskId === a.id)!;
    const warn = createBaselineOldDayCheck(st.calendar, st.calendars)(a, bt);
    const out = quiet(() => writeMSPDI(st.project, st.calendar, st.tasks, st.sequences, st.resources, st.assignments, st.calendars,
      st.baselines, st.activeBaselineId));
    const block = [...out.matchAll(/<Task>([\s\S]*?)<\/Task>/g)].map((x) => x[1]).find((x) => x.includes('<Name>Lange urentaak</Name>'));
    same('§8e oude baseline 233,75 d, daarna 1870 u → 2337,5 u: ⚠ blijft, MSPDI-baseline PT1870H0M0S',
      [bt.duration, a.time.durationMinutes, warn, baselineDuration(block)], [233.75, 140250, true, 'PT1870H0M0S']);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  dag-is-werktijd: ${f}`);
  console.log(`XX  dag-is-werktijd: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  dag-is-werktijd: alle ${checks} checks groen`);
