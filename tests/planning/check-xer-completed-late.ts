import { solveProject } from '@/engine/scheduler/solveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainBackwardActualPinEligibility,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
} from '@/engine/scheduler/p6CompletedRouteTrace';
import type { SchedulingOptions } from '@/types/project';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { setConvention } from './p6SemanticsOff';

const diffs: string[] = [];
let checks = 0;
const LAG_PINS_START_SIDE = {
  ssl: ['2026-11-08T07:00', '2026-11-05T15:00'], fsl: ['2026-11-08T07:00', '2026-11-05T15:00'],
  ssp: ['2026-11-08T07:00', '2026-11-05T15:00'], fsp: ['2026-11-08T07:00', '2026-11-05T15:00'],
};
const LAG_PINS_FINISH_SIDE = { sfl: ['2026-11-12T15:00', '2026-11-12T15:00'], ffl: ['2026-11-15T07:00', '2026-11-12T15:00'] };

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean, detail: string): void {
  checks++;
  if (!condition) diffs.push(`${label}: ${detail}`);
}

const earlyShiftCalendar = '(0||CalendarData()(    (0||DaysOfWeek()(      (0||1()(        (0||0(s|07:00|f|15:00)())))      (0||2()(        (0||0(s|07:00|f|15:00)())))      (0||3()(        (0||0(s|07:00|f|15:00)())))      (0||4()(        (0||0(s|07:00|f|15:00)())))      (0||5()(        (0||0(s|07:00|f|15:00)())))      (0||6()())      (0||7()())))    (0||Exceptions()())))';

function fixtureBytes(): Uint8Array {
  return new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-09-10\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tVroege ploeg\tP1\tCA_Project\t8\t40\t${earlyShiftCalendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tCompleted late window\tC1\t2026-09-10 07:00\t2026-07-01 07:00\t2026-09-25 15:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP1\tC1\tA\tVoltooid A\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tB\tP1\tC1\tB\tVoltooid B\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-10 07:00\t2026-08-11 15:00\t2026-08-10 07:00\t2026-08-11 15:00',
    '%R\tC\tP1\tC1\tC\tNiet gestart C\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t40\t40\t2026-09-14 07:00\t2026-09-18 15:00\t\t',
    '%R\tE\tP1\tC1\tE\tOpvolger E\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-09-21 07:00\t2026-09-21 15:00\t\t',
    '%R\tL\tP1\tC1\tL\tLange, losse taak L\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t80\t80\t2026-11-02 07:00\t2026-11-13 15:00\t\t',
    '%R\tG\tP1\tC1\tG\tVoltooid geïsoleerd G\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-07-06 07:00\t2026-07-06 15:00\t2026-07-06 07:00\t2026-07-06 15:00',
    '%R\tNS\tP1\tC1\tNS\tOnafhankelijke open opvolger NS\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t40\t40\t2026-09-14 07:00\t2026-09-18 15:00\t\t',
    '%R\tSSA\tP1\tC1\tSSA\tVoltooid via SS\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFSA\tP1\tC1\tFSA\tVoltooid via FS\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tSFA\tP1\tC1\tSFA\tVoltooid via SF\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFFA\tP1\tC1\tFFA\tVoltooid via FF\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tNX\tP1\tC1\tNX\tVoltooid zonder act_end_date NX\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t',
    '%R\tNL\tP1\tC1\tNL\tOnafhankelijke open opvolger NL\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t40\t40\t2026-09-14 07:00\t2026-09-18 15:00\t\t',
    '%R\tSSL\tP1\tC1\tSSL\tVoltooid via SS+lag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFSL\tP1\tC1\tFSL\tVoltooid via FS+lag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tSFL\tP1\tC1\tSFL\tVoltooid via SF+lag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFFL\tP1\tC1\tFFL\tVoltooid via FF+lag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tSSP\tP1\tC1\tSSP\tVoltooid via SS+procentlag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFSP\tP1\tC1\tFSP\tVoltooid via FS+procentlag\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-AB\tB\tA\tP1\tP1\tPR_FS\t8',
    '%R\tR-BC\tC\tB\tP1\tP1\tPR_FS\t16',
    '%R\tR-CE\tE\tC\tP1\tP1\tPR_FS\t0',
    '%R\tR-SSA-NS\tNS\tSSA\tP1\tP1\tPR_SS\t0',
    '%R\tR-FSA-NS\tNS\tFSA\tP1\tP1\tPR_FS\t0',
    '%R\tR-SFA-NS\tNS\tSFA\tP1\tP1\tPR_SF\t0',
    '%R\tR-FFA-NS\tNS\tFFA\tP1\tP1\tPR_FF\t0',
    '%R\tR-SSL-NL\tNL\tSSL\tP1\tP1\tPR_SS\t8',
    '%R\tR-FSL-NL\tNL\tFSL\tP1\tP1\tPR_FS\t8',
    '%R\tR-SFL-NL\tNL\tSFL\tP1\tP1\tPR_SF\t8',
    '%R\tR-FFL-NL\tNL\tFFL\tP1\tP1\tPR_FF\t8',
    '%R\tR-SSP-NL\tNL\tSSP\tP1\tP1\tPR_SS\t0',
    '%R\tR-FSP-NL\tNL\tFSP\tP1\tP1\tPR_FS\t0',
    '%E',
  ].join('\n'));
}

function importFixture(): ImportResult {
  const opened = readXER(fixtureBytes());
  if (isMultiDocumentImport(opened)) throw new Error('completed-late fixture moet precies één project openen');
  setConvention(opened, 'p6CompletedDataDateWindow', true);
  setConvention(opened, 'p6CompletedLoeActualFinish', true);
  return opened;
}

function solveWith(overrides?: Partial<SchedulingOptions>, remainingLag = false) {
  const imported = structuredClone(importFixture());
  if (overrides) {
    imported.project.schedulingOptions = { ...imported.project.schedulingOptions, ...overrides };
  }
  setConvention(imported, 'p6CompletedRemainingLag', remainingLag);
  for (const seq of imported.sequences) {
    if (seq.predecessorId === 'SSP' || seq.predecessorId === 'FSP') {
      seq.lagDays = 0;
      seq.lagMinutes = undefined;
      seq.lagPercent = 50;
    }
  }
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(result.error);
  return { imported, result };
}

{
  const { imported } = solveWith();
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  for (const id of ['A', 'B', 'G']) {
    const task = imported.tasks.find(t => t.id === id);
    if (!task) throw new Error(`fixture mist taak ${id}`);
    const decision = explainP6CompletedDataDateWindow(task, dataDate, solveOptionsFor(imported.project).schedulingOptions);
    eq(`completed-late fixture: taak ${id} zit in de completedWindow-poort`, decision, { eligible: true, reason: 'eligible' });
  }
}

{
  const { imported, result } = solveWith();
  const cal = new CalendarEngine(imported.calendar);
  const a = result.tasks.get('A')!;
  const b = result.tasks.get('B')!;
  const c = result.tasks.get('C')!;
  const g = result.tasks.get('G')!;
  const dataDate = parseInstant(imported.project.statusDate!);

  eq('completed-late AAN: lag tussen twee voltooide activiteiten vervalt (A.lateStart = B.lateStart)',
    a.lateStart, b.lateStart);

  const bLateStart = parseInstant(b.lateStart);
  const cLateStart = parseInstant(c.lateStart);
  eq('completed-late AAN: lag tussen voltooid en niet-voltooid telt mee (16 werkuur)',
    cal.subtractWorkMinutes(cLateStart, 16 * 60).toISOString(), bLateStart.toISOString());
  ok('completed-late AAN: B.lateStart ligt vóór C.lateStart (de lag is niet toevallig nul)',
    bLateStart.getTime() < cLateStart.getTime(), `b=${b.lateStart} c=${c.lateStart}`);

  eq('completed-late AAN: A.lateFinish = prevWorkInstant(A.lateStart)',
    cal.prevWorkInstant(parseInstant(a.lateStart)).toISOString(), parseInstant(a.lateFinish).toISOString());
  eq('completed-late AAN: B.lateFinish = prevWorkInstant(B.lateStart)',
    cal.prevWorkInstant(parseInstant(b.lateStart)).toISOString(), parseInstant(b.lateFinish).toISOString());

  eq('completed-late AAN: A en B hebben dezelfde totale float (zelfde late-ankerketen)',
    a.totalFloat, b.totalFloat);
  const windowEs = cal.nextWorkInstant(dataDate);
  const windowEf = cal.prevWorkInstant(windowEs);
  const expectedTf = cal.workMinutesBetween(windowEf, parseInstant(a.lateFinish)) / (cal.hoursPerDay * 60);
  eq('completed-late AAN: A.totalFloat = werkminuten(statusdatumvenster-EF → A.lateFinish)',
    a.totalFloat, expectedTf);

  eq('completed-late AAN: G.lateStart = nextWorkInstant(statusdatum)',
    parseInstant(g.lateStart).toISOString(), windowEs.toISOString());
  eq('completed-late AAN: G.lateFinish = prevWorkInstant(G.lateStart)',
    parseInstant(g.lateFinish).toISOString(), cal.prevWorkInstant(windowEs).toISOString());
  eq('completed-late AAN: G heeft nul totale float (klem, geen opvolgerdruk)', g.totalFloat, 0);
}

{
  const { result } = solveWith();
  const ssa = result.tasks.get('SSA')!;
  const fsa = result.tasks.get('FSA')!;
  const sfa = result.tasks.get('SFA')!;
  const ffa = result.tasks.get('FFA')!;
  eq('completed-late AAN: SS en FS naar dezelfde opvolger met lag 0 geven dezelfde late start',
    ssa.lateStart, fsa.lateStart);
  eq('completed-late AAN: SF en FF naar dezelfde opvolger met lag 0 geven dezelfde late start',
    sfa.lateStart, ffa.lateStart);
  eq('completed-late AAN: SSA/FSA absolute late start', { ssa: ssa.lateStart, fsa: fsa.lateStart }, {
    ssa: '2026-11-09T07:00', fsa: '2026-11-09T07:00',
  });
  eq('completed-late AAN: SFA/FFA absolute late start', { sfa: sfa.lateStart, ffa: ffa.lateStart }, {
    sfa: '2026-11-16T07:00', ffa: '2026-11-16T07:00',
  });
}

{
  const { result } = solveWith();
  const ls = (id: string) => result.tasks.get(id)!.lateStart;
  const lf = (id: string) => result.tasks.get(id)!.lateFinish;
  eq('completed-late AAN: SS+8u en FS+8u naar dezelfde opvolger geven dezelfde late start',
    ls('SSL'), ls('FSL'));
  eq('completed-late AAN: SS+50% (=8u) valt samen met SS+8u — de procentlag verdwijnt niet meer',
    ls('SSP'), ls('SSL'));
  eq('completed-late AAN: FS+50% valt samen met FS+8u (was al zo; blijft zo)',
    ls('FSP'), ls('FSL'));
  eq('completed-late AAN: de lag telt echt mee (SS+8u ligt 8 werkuur vóór SS zonder lag)',
    ls('SSL') < ls('SSA'), true);
  eq('completed-late AAN: absolute pins SS/FS met lag (start-rand)', {
    ssl: [ls('SSL'), lf('SSL')], fsl: [ls('FSL'), lf('FSL')], ssp: [ls('SSP'), lf('SSP')], fsp: [ls('FSP'), lf('FSP')],
  }, LAG_PINS_START_SIDE);
  eq('completed-late AAN: absolute pins SF/FF met lag (bevinding 5: bandrand-karakterisering)', {
    sfl: [ls('SFL'), lf('SFL')], ffl: [ls('FFL'), lf('FFL')],
  }, LAG_PINS_FINISH_SIDE);
}

{
  const { imported } = solveWith();
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const so = solveOptionsFor(imported.project).schedulingOptions;
  const nx = imported.tasks.find(t => t.id === 'NX');
  if (!nx) throw new Error('fixture mist taak NX');
  eq('poortpariteit: NX heeft completion 1 maar géén actualFinish', {
    completion: nx.time.completion, actualFinish: nx.time.actualFinish ?? null,
  }, { completion: 1, actualFinish: null });
  eq('poortpariteit: NX komt WEL door de brede completedWindow-poort',
    explainP6CompletedDataDateWindow(nx, dataDate, so), { eligible: true, reason: 'eligible' });
  eq('poortpariteit: NX komt NIET door de completed-actual-pin',
    explainBackwardActualPinEligibility(nx, dataDate, so),
    { eligible: false, reason: 'missingActualFinish' });
  eq('poortpariteit: de gedeelde poort weigert NX om diezelfde reden',
    explainP6CompletedLateRemainingWindowEligibilityResolved(nx, dataDate, so),
    { eligible: false, reason: 'missingActualFinish' });

  const on = solveWith().result.tasks.get('NX')!;
  const off = solveWith({ p6CompletedLateFromRemainingWindow: false }).result.tasks.get('NX')!;
  eq('poortpariteit: NX is met vlag AAN byte-identiek aan vlag UIT (solver deed niets, weergave dus ook niet)', {
    lateStart: on.lateStart, lateFinish: on.lateFinish, totalFloat: on.totalFloat,
    earlyStart: on.earlyStart, earlyFinish: on.earlyFinish,
  }, {
    lateStart: off.lateStart, lateFinish: off.lateFinish, totalFloat: off.totalFloat,
    earlyStart: off.earlyStart, earlyFinish: off.earlyFinish,
  });
}

{
  const { result } = solveWith({ p6CompletedLateFromRemainingWindow: false });
  const a = result.tasks.get('A')!;
  const b = result.tasks.get('B')!;
  const g = result.tasks.get('G')!;
  eq('completed-late UIT: A.lateStart/-Finish blijven op de rauwe actual-pin', {
    lateStart: a.lateStart, lateFinish: a.lateFinish,
  }, { lateStart: '2026-08-03T07:00', lateFinish: '2026-08-04T15:00' });
  eq('completed-late UIT: B.lateStart/-Finish blijven op de rauwe actual-pin', {
    lateStart: b.lateStart, lateFinish: b.lateFinish,
  }, { lateStart: '2026-08-10T07:00', lateFinish: '2026-08-11T15:00' });
  eq('completed-late UIT: G.lateStart/-Finish blijven op de rauwe actual-pin', {
    lateStart: g.lateStart, lateFinish: g.lateFinish,
  }, { lateStart: '2026-07-06T07:00', lateFinish: '2026-07-06T15:00' });
  eq('completed-late UIT: A en B hebben (zoals vóór deze etappe) totale float 0', {
    a: a.totalFloat, b: b.totalFloat, g: g.totalFloat,
  }, { a: 0, b: 0, g: 0 });
  const ssa = result.tasks.get('SSA')!;
  const fsa = result.tasks.get('FSA')!;
  const sfa = result.tasks.get('SFA')!;
  const ffa = result.tasks.get('FFA')!;
  eq('completed-late UIT: SSA/FSA/SFA/FFA blijven op de rauwe actual-pin, ongeacht relatietype', {
    ssa: { lateStart: ssa.lateStart, lateFinish: ssa.lateFinish, totalFloat: ssa.totalFloat },
    fsa: { lateStart: fsa.lateStart, lateFinish: fsa.lateFinish, totalFloat: fsa.totalFloat },
    sfa: { lateStart: sfa.lateStart, lateFinish: sfa.lateFinish, totalFloat: sfa.totalFloat },
    ffa: { lateStart: ffa.lateStart, lateFinish: ffa.lateFinish, totalFloat: ffa.totalFloat },
  }, {
    ssa: { lateStart: '2026-08-03T07:00', lateFinish: '2026-08-04T15:00', totalFloat: 0 },
    fsa: { lateStart: '2026-08-03T07:00', lateFinish: '2026-08-04T15:00', totalFloat: 0 },
    sfa: { lateStart: '2026-08-03T07:00', lateFinish: '2026-08-04T15:00', totalFloat: 0 },
    ffa: { lateStart: '2026-08-03T07:00', lateFinish: '2026-08-04T15:00', totalFloat: 0 },
  });
}

{
  const off = solveWith().result.tasks;
  const on = solveWith(undefined, true).result.tasks;
  const w = (tasks: typeof on, id: string) => [tasks.get(id)!.lateStart, tasks.get(id)!.lateFinish];
  eq('completed-late C3 AAN: verstreken lag telt niet — SS/FS/SF/FF+8u en SS/FS+50% = hun lag-0-tegenhanger', {
    ssl: w(on, 'SSL'), fsl: w(on, 'FSL'), sfl: w(on, 'SFL'), ffl: w(on, 'FFL'), ssp: w(on, 'SSP'), fsp: w(on, 'FSP'),
  }, {
    ssl: w(on, 'SSA'), fsl: w(on, 'FSA'), sfl: w(on, 'SFA'), ffl: w(on, 'FFA'), ssp: w(on, 'SSA'), fsp: w(on, 'FSA'),
  });
  eq('completed-late C3 AAN: de lag-0-relaties zelf zijn ongewijzigd', {
    ssa: w(on, 'SSA'), fsa: w(on, 'FSA'), sfa: w(on, 'SFA'), ffa: w(on, 'FFA'),
  }, {
    ssa: w(off, 'SSA'), fsa: w(off, 'FSA'), sfa: w(off, 'SFA'), ffa: w(off, 'FFA'),
  });
  eq('completed-late C3 AAN: de mét-lag-relaties verschuiven echt (fixture is onderscheidend)',
    w(on, 'FSL')[0] !== w(off, 'FSL')[0], true);
}

{
  for (const useWindow of [false, true]) {
    const imported = importFixture();
    setConvention(imported, 'p6CompletedDataDateWindow', useWindow);
    for (const usable of [true, false]) {
      const scalar = (cal: typeof imported.calendar) => ({
        ...cal, workTime: undefined, hoursPerDay: usable ? cal.hoursPerDay : 0,
      });
      const calendar = scalar(imported.calendar);
      const calendars = (imported.resourceCalendars ?? []).map(scalar);
      const label = `knownbug 186 B3=${useWindow} bruikbare werkuren=${usable}`;
      eq(label + ': geen eigen werkblokken', new CalendarEngine(calendar).hasOwnWorkBlocks, false);
      eq(label + ': effectieve urenroute', new CalendarEngine(calendar).isHourMode, usable);
      const result = solveProject({
        tasks: imported.tasks, sequences: imported.sequences, calendar, calendars,
        dataDate: imported.project.statusDate, progressMode: imported.project.progressMode,
        schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
        projectStartDate: imported.project.startDate, projectEndDate: imported.project.endDate,
      });
      const row = result.tasks.get('A');
      const code = result.errorInfo?.code;
      if (usable) {
        eq(label + ': succes', [result.error, result.tasks.size], [undefined, 19]);
        eq(label + ': B3-aan/uit is onderscheidend', row?.earlyStart,
          useWindow ? '2026-09-10T07:00' : '2026-08-03T07:00');
      } else {
        eq(label + ': gecontroleerde stop wegens onbruikbare werkuren',
          code === 'hourTaskWithoutWorkHours' || code === 'taskWithoutWorkHours' || code === 'noWorkingHours', true);
        eq(label + ': geen datums berekend', result.tasks.size, 0);
      }
      console.log('KNOWNBUG186', JSON.stringify({ useWindow, usable, taskCount: result.tasks.size, code }));
    }
  }
}

if (diffs.length > 0) {
  console.error(`XER COMPLETED LATE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER COMPLETED LATE GREEN: ${checks} checks groen`);
