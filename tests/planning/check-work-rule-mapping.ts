// check-work-rule-mapping.ts — taaktypes-etappe, bouwstap 2 (ontwerp 2026-09-04 §4.2/§4.3/§4.4):
// de importvertaling van de werkregel en de drie werkvelden, headless tegen de echte adapters.
//   (a) de pure vertaaltabellen (`workRuleMapping.ts`): MSP-type+vlag ↔ werkregel, MSPDI-codes,
//       P6-labels ↔ werkregel (tolerant voor "&"), XER-tokens ↔ werkregel, en de importregel
//       "afwezig ⇒ afgeleid" voor de werkvelden;
//   (b) `deriveImportedWorkRules`: MSP-velden gaan voor, een bestaande regel blijft, geen bron ⇒ geen veld;
//   (c) MSPDI: writer → reader round-trip van <Type>/<EffortDriven> en de werkvelden op de toewijzing,
//       inclusief beslispunt 8-B (Fixed Units zonder effort-driven) en de byte-identieke tak;
//   (d) P6 XML: <DurationType>-labels beide kanten (Oracle-datamap) en de units-velden in uren;
//   (e) XER: `duration_type` → werkregel en TASKRSRC-hoeveelheden → werkvelden, alleen bij afwijking.
// Draait via run.sh. Exit 0 = groen.
import {
  MSPDI_TASK_TYPE_CODE, P6_DURATION_TYPE_NAME, XER_DURATION_TYPE_TOKEN, importedWorkFields, mspFromWorkRule,
  mspTaskTypeFromCode, workRuleFromMsp, workRuleFromP6DurationType, workRuleFromXerDurationType,
} from '@/engine/work/workRuleMapping';
import { WORK_RULES } from '@/types/workRule';
import { deriveImportedWorkRules } from '@/services/importNormalize';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { createDefaultProject } from '@/state/slices/projectSlice';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

declare const process: { exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const CAL: WorkCalendar = {
  id: 'cal-wr', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
function task(id: string, start: string, finish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}
const res = (id: string): Resource => ({ id, name: id, type: 'LABOR', description: '', maxUnits: 1 });
const assign = (id: string, taskId: string, resourceId: string, unitsPerDay: number, extra?: Partial<ResourceAssignment>): ResourceAssignment =>
  ({ id, taskId, resourceId, unitsPerDay, ...extra });

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) vertaaltabellen --');
{
  eq('a1 MSP → werkregel (vijf combinaties, spec §2.3)', [
    workRuleFromMsp('FIXED_UNITS', true), workRuleFromMsp('FIXED_UNITS', false), workRuleFromMsp('FIXED_UNITS', undefined),
    workRuleFromMsp('FIXED_DURATION', false), workRuleFromMsp('FIXED_DURATION', true), workRuleFromMsp('FIXED_WORK', false),
    workRuleFromMsp(undefined, true),
  ], ['FIXED_RATE', 'FIXED_RATE', 'FIXED_RATE', 'FIXED_DURATION_RATE', 'FIXED_DURATION_WORK', 'FIXED_WORK', undefined]);
  eq('a2 werkregel → MSP zonder bewaarde vlag (P6-lezing)', WORK_RULES.map((r) => mspFromWorkRule(r, undefined)), [
    { type: 'FIXED_DURATION', effortDriven: false }, { type: 'FIXED_DURATION', effortDriven: true },
    { type: 'FIXED_WORK', effortDriven: true }, { type: 'FIXED_UNITS', effortDriven: true },
  ]);
  eq('a3 werkregel → MSP mét bewaarde vlag (8-B: de vlag wint, behalve bij Fixed Work)', [
    mspFromWorkRule('FIXED_RATE', false), mspFromWorkRule('FIXED_DURATION_WORK', true), mspFromWorkRule('FIXED_WORK', false),
  ], [{ type: 'FIXED_UNITS', effortDriven: false }, { type: 'FIXED_DURATION', effortDriven: true }, { type: 'FIXED_WORK', effortDriven: true }]);
  ok('a4 MSP heen-en-terug is stabiel voor elke regel', WORK_RULES.every((r) => {
    const m = mspFromWorkRule(r, undefined);
    return workRuleFromMsp(m.type, m.effortDriven) === r;
  }));
  eq('a5 MSPDI-codes 0/1/2 (Microsoft Learn: Fixed units / Fixed duration / Fixed work)', [
    MSPDI_TASK_TYPE_CODE.FIXED_UNITS, MSPDI_TASK_TYPE_CODE.FIXED_DURATION, MSPDI_TASK_TYPE_CODE.FIXED_WORK,
    mspTaskTypeFromCode(0), mspTaskTypeFromCode(1), mspTaskTypeFromCode(2), mspTaskTypeFromCode(3), mspTaskTypeFromCode(-1), mspTaskTypeFromCode(undefined),
  ], [0, 1, 2, 'FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK', undefined, undefined, undefined]);
  eq('a6 P6-labels ↔ werkregel (P6 EPPM REST-enum), beide kanten', WORK_RULES.map((r) => workRuleFromP6DurationType(P6_DURATION_TYPE_NAME[r])), WORK_RULES);
  eq('a7 P6-label tolerant voor "&" en hoofdletters; onbekend ⇒ undefined', [
    workRuleFromP6DurationType('Fixed Duration & Units'), workRuleFromP6DurationType('fixed units/time'), workRuleFromP6DurationType('Fixed Whatever'), workRuleFromP6DurationType(''),
  ], ['FIXED_DURATION_WORK', 'FIXED_RATE', undefined, undefined]);
  eq('a8 XER-tokens ↔ werkregel (Oracle XER-datamap: Drtn = Duration & Units/Time, DUR2 = Duration & Units)', [
    XER_DURATION_TYPE_TOKEN.FIXED_DURATION_RATE, XER_DURATION_TYPE_TOKEN.FIXED_DURATION_WORK, XER_DURATION_TYPE_TOKEN.FIXED_WORK, XER_DURATION_TYPE_TOKEN.FIXED_RATE,
    workRuleFromXerDurationType('DT_FixedDrtn'), workRuleFromXerDurationType('DT_FixedDUR2'), workRuleFromXerDurationType('DT_FixedQty'), workRuleFromXerDurationType('DT_FixedRate'),
    workRuleFromXerDurationType('DT_FixedDUR'), workRuleFromXerDurationType(undefined),
  ], ['DT_FixedDrtn', 'DT_FixedDUR2', 'DT_FixedQty', 'DT_FixedRate', 'FIXED_DURATION_RATE', 'FIXED_DURATION_WORK', 'FIXED_WORK', 'FIXED_RATE', undefined, undefined]);
  ok('a9 XER-token en P6-label van dezelfde regel beschrijven hetzelfde type (spec §4.2-tabel)',
    workRuleFromXerDurationType('DT_FixedDrtn') === workRuleFromP6DurationType('Fixed Duration and Units/Time')
    && workRuleFromXerDurationType('DT_FixedDUR2') === workRuleFromP6DurationType('Fixed Duration and Units'));

  // "Afwezig ⇒ afgeleid" bij import.
  eq('a10 niets in de bron ⇒ niets', importedWorkFields({}, 2400), {});
  eq('a11 bron gelijk aan de afleiding (binnen 1 min) ⇒ niets', importedWorkFields({ plannedMinutes: 2400.5, remainingMinutes: 2400 }, 2400), {});
  eq('a12 begroot wijkt af ⇒ alle aanwezige velden', importedWorkFields({ plannedMinutes: 3000, remainingMinutes: 3000 }, 2400), { plannedWorkMinutes: 3000, remainingWorkMinutes: 3000 });
  eq('a13 verricht werk > 0 ⇒ alle aanwezige velden, ook als begroot klopt', importedWorkFields({ plannedMinutes: 2400, actualMinutes: 600, remainingMinutes: 1800 }, 2400), { plannedWorkMinutes: 2400, actualWorkMinutes: 600, remainingWorkMinutes: 1800 });
  eq('a14 resterend wijkt af van begroot − verricht ⇒ velden', importedWorkFields({ plannedMinutes: 2400, remainingMinutes: 1800 }, 2400), { plannedWorkMinutes: 2400, remainingWorkMinutes: 1800 });
  eq('a15 ongeldige bronwaarden gelden als afwezig', importedWorkFields({ plannedMinutes: Number.NaN, actualMinutes: -5, remainingMinutes: Number.POSITIVE_INFINITY }, 2400), {});
  eq('a16 alleen resterend, afwijkend van de afleiding ⇒ veld', importedWorkFields({ remainingMinutes: 1200 }, 2400), { remainingWorkMinutes: 1200 });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) deriveImportedWorkRules --');
{
  const tasks: Task[] = [
    task('msp', '2026-06-01', '2026-06-05', 5, { mspTaskType: 'FIXED_DURATION', effortDriven: true, p6DurationType: 'DT_FixedQty' }),
    task('p6', '2026-06-01', '2026-06-05', 5, { p6DurationType: 'DT_FixedRate' }),
    task('kept', '2026-06-01', '2026-06-05', 5, { workRule: 'FIXED_WORK', mspTaskType: 'FIXED_UNITS' }),
    task('none', '2026-06-01', '2026-06-05', 5),
  ];
  deriveImportedWorkRules(tasks);
  eq('b1 MSP-velden gaan vóór het P6-token; P6 alleen; bestaande regel blijft; geen bron ⇒ geen veld',
    tasks.map((t) => t.workRule), ['FIXED_DURATION_WORK', 'FIXED_RATE', 'FIXED_WORK', undefined]);
  ok('b2 de importvelden zelf blijven onaangeraakt', tasks[0].mspTaskType === 'FIXED_DURATION' && tasks[0].effortDriven === true && tasks[0].p6DurationType === 'DT_FixedQty');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) MSPDI round-trip --');
{
  const project = createDefaultProject();
  const tFixedWork = task('fw', '2026-06-01', '2026-06-05', 5, { workRule: 'FIXED_WORK' });
  // Beslispunt 8-B: een MSP-taak "Fixed Units, niet effort-driven" — bewaard `mspTaskType` zonder
  // `effortDriven` ⇒ de export schrijft EffortDriven 0 (de vlag wint van de P6-lezing van FIXED_RATE).
  const tFuNoEd = task('fu', '2026-06-01', '2026-06-05', 5, { workRule: 'FIXED_RATE', mspTaskType: 'FIXED_UNITS' });
  const tFdEd = task('fd', '2026-06-01', '2026-06-05', 5, { workRule: 'FIXED_DURATION_WORK' });
  const tPlain = task('plain', '2026-06-01', '2026-06-05', 5);
  const r1 = res('r1');
  const assignments = [
    // 5 d × 8 u × 1,0 = 40 u afgeleid; bron zegt 60 u begroot, 20 verricht, 40 rest ⇒ velden.
    assign('a1', 'fw', 'r1', 1, { plannedWorkMinutes: 3600, actualWorkMinutes: 1200, remainingWorkMinutes: 2400 }),
    assign('a2', 'plain', 'r1', 1), // niets ⇒ Work = duur × units, komt zonder velden terug
  ];
  const xml = writeMSPDI(project, CAL, [tFixedWork, tFuNoEd, tFdEd, tPlain], [], [r1], assignments, []);
  const taskXml = (name: string): string => xml.slice(xml.indexOf(`<Name>${name}</Name>`), xml.indexOf('</Task>', xml.indexOf(`<Name>${name}</Name>`)));
  ok('c1 Fixed Work ⇒ <Type>2</Type> + <EffortDriven>1</EffortDriven>', taskXml('fw').includes('<Type>2</Type>') && taskXml('fw').includes('<EffortDriven>1</EffortDriven>'));
  ok('c2 FIXED_RATE met bewaard MSP-type zonder vlag ⇒ <Type>0</Type> + <EffortDriven>0</EffortDriven> (8-B)', taskXml('fu').includes('<Type>0</Type>') && taskXml('fu').includes('<EffortDriven>0</EffortDriven>'));
  ok('c3 FIXED_DURATION_WORK zonder MSP-herkomst ⇒ <Type>1</Type> + <EffortDriven>1</EffortDriven>', taskXml('fd').includes('<Type>1</Type>') && taskXml('fd').includes('<EffortDriven>1</EffortDriven>'));
  ok('c4 taak zonder regel of MSP-type ⇒ geen <Type>/<EffortDriven> (golden rule)', !taskXml('plain').includes('<Type>') && !taskXml('plain').includes('<EffortDriven>'));
  ok('c5 toewijzing met werkvelden ⇒ ActualWork/RemainingWork vóór Units en Work = begroot',
    /<ActualWork>PT20H0M0S<\/ActualWork>\s*<RemainingWork>PT40H0M0S<\/RemainingWork>\s*<Units>1<\/Units>\s*<Work>PT60H0M0S<\/Work>/.test(xml));
  const back = readMSPDI(xml);
  const byName = (n: string) => back.tasks.find((t) => t.name === n)!;
  eq('c6 lezer: mspTaskType/effortDriven/workRule terug', [
    [byName('fw').mspTaskType, byName('fw').effortDriven, byName('fw').workRule],
    [byName('fu').mspTaskType, byName('fu').effortDriven, byName('fu').workRule],
    [byName('fd').mspTaskType, byName('fd').effortDriven, byName('fd').workRule],
    [byName('plain').mspTaskType, byName('plain').effortDriven, byName('plain').workRule],
  ], [
    ['FIXED_WORK', true, 'FIXED_WORK'], ['FIXED_UNITS', undefined, 'FIXED_RATE'], ['FIXED_DURATION', true, 'FIXED_DURATION_WORK'], [undefined, undefined, undefined],
  ]);
  const backA1 = back.assignments.find((a) => a.taskId === byName('fw').id)!;
  const backA2 = back.assignments.find((a) => a.taskId === byName('plain').id)!;
  eq('c7 lezer: werkvelden terug in minuten', [backA1.plannedWorkMinutes, backA1.actualWorkMinutes, backA1.remainingWorkMinutes], [3600, 1200, 2400]);
  eq('c8 lezer: toewijzing zonder afwijking krijgt geen werkvelden (byte-identiek)', [backA2.plannedWorkMinutes, backA2.actualWorkMinutes, backA2.remainingWorkMinutes], [undefined, undefined, undefined]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) P6 XML round-trip --');
{
  const project = createDefaultProject();
  const tasks = WORK_RULES.map((r) => task(r, '2026-06-01', '2026-06-05', 5, { workRule: r }));
  const tToken = task('token', '2026-06-01', '2026-06-05', 5, { p6DurationType: 'DT_FixedDUR2' });
  const tPlain = task('plain', '2026-06-01', '2026-06-05', 5);
  const r1 = res('r1');
  const assignments = [
    assign('a1', 'FIXED_WORK', 'r1', 1, { plannedWorkMinutes: 3600, actualWorkMinutes: 1200, remainingWorkMinutes: 2400 }),
    assign('a2', 'plain', 'r1', 0.5),
  ];
  const xml = writeP6XML(project, CAL, [...tasks, tToken, tPlain], [], [r1], assignments, []);
  const actXml = (name: string): string => xml.slice(xml.indexOf(`<Name>${name}</Name>`), xml.indexOf('</Activity>', xml.indexOf(`<Name>${name}</Name>`)));
  eq('d1 writer: <DurationType>-label per regel', WORK_RULES.map((r) => (actXml(r).match(/<DurationType>([^<]*)<\/DurationType>/) ?? [])[1]), WORK_RULES.map((r) => P6_DURATION_TYPE_NAME[r]));
  ok('d2 writer: bewaard XER-token zonder regel ⇒ label via de datamap', actXml('token').includes('<DurationType>Fixed Duration and Units</DurationType>'));
  ok('d3 writer: geen regel/token ⇒ geen <DurationType>', !actXml('plain').includes('<DurationType>'));
  ok('d4 writer: units in uren op hun alfabetische plek', /<ActualUnits>20<\/ActualUnits>[\s\S]*<PlannedUnits>60<\/PlannedUnits>\s*<PlannedUnitsPerTime>1<\/PlannedUnitsPerTime>[\s\S]*<RemainingUnits>40<\/RemainingUnits>/.test(xml));
  const back = readP6XML(xml);
  const byName = (n: string) => back.tasks.find((t) => t.name === n)!;
  eq('d5 lezer: label → p6DurationType → werkregel, voor alle vier', WORK_RULES.map((r) => [byName(r).p6DurationType, byName(r).workRule]),
    WORK_RULES.map((r) => [XER_DURATION_TYPE_TOKEN[r], r]));
  eq('d6 lezer: verwisselde labels van vóór 2026-09-05 zijn weg (Drtn ⇔ Units/Time, DUR2 ⇔ Units)', [byName('FIXED_DURATION_RATE').p6DurationType, byName('FIXED_DURATION_WORK').p6DurationType], ['DT_FixedDrtn', 'DT_FixedDUR2']);
  const backA1 = back.assignments.find((a) => a.taskId === byName('FIXED_WORK').id)!;
  const backA2 = back.assignments.find((a) => a.taskId === byName('plain').id)!;
  eq('d7 lezer: units (uren) → werkvelden (minuten)', [backA1.plannedWorkMinutes, backA1.actualWorkMinutes, backA1.remainingWorkMinutes], [3600, 1200, 2400]);
  eq('d8 lezer: zonder afwijking geen werkvelden', [backA2.plannedWorkMinutes, backA2.remainingWorkMinutes], [undefined, undefined]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) XER --');
{
  const lines = [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tdef_duration_type\tlast_recalc_date',
    '%R\tP1\tWerkregels\tCP\tDT_FixedDUR2\t2026-01-01',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tclndr_data',
    '%R\tCP\tProject\tCA_Project\t8\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_name\ttask_code\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
    '%R\tT1\tP1\tMetselen\tA1\t2026-01-05\t2026-01-09\t40\tTT_Task\tDT_FixedQty\tTK_NotStart',
    '%R\tT2\tP1\tStellen\tA2\t2026-01-05\t2026-01-09\t40\tTT_Task\tDT_FixedDrtn\tTK_NotStart',
    // Niet-standaard token: de XER-lezer valt gerapporteerd terug op de projectstandaard
    // (def_duration_type, hier DT_FixedDUR2) — de werkregel volgt dus die standaard.
    '%R\tT3\tP1\tVreemd\tA3\t2026-01-05\t2026-01-09\t40\tTT_Task\tDT_FixedDUR\tTK_NotStart',
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
    '%R\tR1\tMetselaar\tRT_Labor\tCP\t1',
    '%T\tTASKRSRC',
    '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tact_reg_qty\tact_ot_qty',
    // T1: 40 u × 1,0 = 40 u afgeleid; bron zegt 60 begroot, 10 + 2 verricht, 48 rest ⇒ velden.
    '%R\tA1\tP1\tT1\tR1\t1\t1\t48\t60\t10\t2',
    // T2: bron consistent (40 u × 0,5 = 20 begroot = 20 rest, niets verricht) ⇒ geen velden.
    '%R\tA2\tP1\tT2\tR1\t0.5\t0.5\t20\t20\t0\t0',
    '%E',
  ];
  const parsed = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(parsed)) {
    diffs.push('e0 XER-fixture gaf een meervoudige import terug');
  } else {
    const byId = (id: string) => parsed.tasks.find((t) => t.id === id);
    eq('e1 duration_type → p6DurationType → werkregel; niet-standaard token ⇒ de (gerapporteerde) projectstandaard', [
      [byId('T1')?.p6DurationType, byId('T1')?.workRule], [byId('T2')?.p6DurationType, byId('T2')?.workRule], [byId('T3')?.p6DurationType, byId('T3')?.workRule],
    ], [['DT_FixedQty', 'FIXED_WORK'], ['DT_FixedDrtn', 'FIXED_DURATION_RATE'], ['DT_FixedDUR2', 'FIXED_DURATION_WORK']]);
    const a1 = parsed.assignments.find((a) => a.taskId === 'T1')!;
    const a2 = parsed.assignments.find((a) => a.taskId === 'T2')!;
    eq('e2 TASKRSRC-hoeveelheden (uren) → werkvelden (minuten), verricht = regulier + overwerk', [a1.plannedWorkMinutes, a1.actualWorkMinutes, a1.remainingWorkMinutes], [3600, 720, 2880]);
    eq('e3 consistente bron ⇒ geen werkvelden (afspraak met de XER-etappe)', [a2.plannedWorkMinutes, a2.actualWorkMinutes, a2.remainingWorkMinutes], [undefined, undefined, undefined]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
if (diffs.length > 0) {
  console.log(`XX  check-work-rule-mapping: ${checks} checks, ${diffs.length} afwijking(en):`);
  for (const d of diffs) console.log(`    ${d}`);
  process.exit(1);
}
console.log(`OK  check-work-rule-mapping: ${checks} checks groen`);
