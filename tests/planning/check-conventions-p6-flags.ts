// Rekenprofielen — de vijf groep-B-conventies (spec 2026-09-22, §3.5 punt 4, bijlage A).
//
// Tot baan B stonden deze vijf P6-rekenregels uitsluitend achter de XER-bronmarkering van het
// project. Sinds baan B is elk een eigen vlag; sinds C3 komen de vlaggen uitsluitend uit het
// rekenprofiel (`project.schedulingProfile` ⇒ `solveOptionsFor`) en bestaat er geen bronmarkering
// of vertaallaag meer.
//
// Wat deze check bewijst, per conventie, op een kleine synthetische XER-fixture waarvan de
// P6-uitkomst vooraf uit de regel zelf volgt (niet uit de implementatie afgelezen):
//   1. XER-import zoals gelezen (P6-profiel)                          ⇒ de P6-uitkomst (AAN);
//   2. dezelfde import met ALLEEN deze conventie uit                  ⇒ de generieke uitkomst (UIT);
//   3. OPS-basis met de A-conventies van het bestand en ALLEEN deze
//      B-conventie aan (de andere vier uit)                           ⇒ AAN — de vlag schakelt, niet de basis;
//   4. alle P6-gepoorte conventies uit (`withoutP6Semantics`)         ⇒ UIT;
//   5. P6-profiel met alle vijf B-conventies uit                      ⇒ UIT — de basis alleen doet niets.
// Daarna, over alle vijf fixtures: een verdwaalde bronmarkering in de projectopties is zesassig
// inert, en de basis van het profiel lekt niet (P6-basis met B uit = OPS-basis met dezelfde
// waarden). Verder: B3/B4 zonder A19 ⇒ UIT, de guardvolgorde van de redencodes, en een bronscan dat
// `p6Source` nergens meer onder `src/engine/` staat.
//
// MUTATIEBEWIJS. Baan B (2026-09-22, 26 mutanten op src/engine, toen tegen de armen met testhaak):
// B1–B5 altijd aan/uit, de `p6Source`-poort terug, de guardvolgorde-mutanten. Opnieuw gemeten ná de
// C3-omzetting tegen déze armen: B1 nooit strippen ⇒ rood (B1 arm 2 en 4); B3-guard altijd open ⇒
// rood (B3 arm 2 en 5); een `p6Source`-vermelding in scheduleAnalysis.ts ⇒ rood (bronscan).
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { diffAgainstBase, resolveConventions } from '@/engine/scheduler/conventions/registry';
import { setConvention, withoutP6Semantics } from './p6SemanticsOff';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainCompletedXerLoeActualFinishEligibilityResolved,
  explainP6CompletedLateRemainingWindowEligibilityResolved,
} from '@/engine/scheduler/p6CompletedRouteTrace';
import { explainOpenXerLoeTargetSpanEligibilityResolved } from '@/engine/scheduler/p6OpenLoeTargetSpanTrace';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { ConventionKey, EffectiveSchedulingOptions, ProjectSchedulingOptions, SchedulingConventions } from '@/types/project';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

/** XER-`clndr_data` met werkdagen maandag–vrijdag (P6-dagnummers 2–6; 1 = zondag) en de
 *  meegegeven klokbanden per werkdag. */
function calendarData(bands: ReadonlyArray<readonly [string, string]>): string {
  const day = (n: number) => {
    const works = n >= 2 && n <= 6;
    const inner = works
      ? bands.map(([start, finish], i) => `(0||${i}(s|${start}|f|${finish})())`).join('')
      : '';
    return `(0||${n}()(${inner}))`;
  };
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}

const SPLIT_DAY = calendarData([['08:00', '12:00'], ['13:00', '17:00']]);

function importXer(lines: string[]): ImportResult {
  const opened = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(opened)) throw new Error('conventiefixture moet één project openen');
  return opened;
}

interface Axes { es: string; ef: string; ls: string; lf: string; tf: number; ff: number }

/** De vijf groep-B-conventies (bijlage A), in fixturevolgorde. */
const GROUP_B = [
  'p6RelationFinishBoundary', 'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish', 'p6OpenLoeTargetSpan',
] as const satisfies readonly ConventionKey[];
type GroupBKey = typeof GROUP_B[number];

function solveAxes(input: ImportResult, taskId: string): Axes {
  const imported = structuredClone(input);
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
  const solved = result.tasks.get(taskId);
  if (!solved) throw new Error(`solver mist taak ${taskId}`);
  return {
    es: solved.earlyStart, ef: solved.earlyFinish,
    ls: solved.lateStart, lf: solved.lateFinish,
    tf: solved.totalFloat, ff: solved.freeFloat,
  };
}

/** Alle zes assen van ALLE taken — voor de inertheidsvergelijking zonder vertaling. */
function solveAllAxes(input: ImportResult): Record<string, Axes> {
  const out: Record<string, Axes> = {};
  for (const task of input.tasks) out[task.id] = solveAxes(input, task.id);
  return out;
}

/** Een kopie waarvan het profiel door `mutate` is aangepast (setConvention/withoutP6Semantics). */
function withProfile(input: ImportResult, mutate: (copy: ImportResult) => void): ImportResult {
  const copy = structuredClone(input);
  mutate(copy);
  return copy;
}

/** Een kopie met een expliciet profiel op `baseId` waarvan de opgeloste waarden `values` zijn. */
function withConventions(input: ImportResult, baseId: 'p6' | 'ops', values: SchedulingConventions): ImportResult {
  const copy = structuredClone(input);
  copy.project.schedulingProfile = { baseId, id: `test-${baseId}`, name: 'test', overrides: diffAgainstBase(baseId, values) };
  return copy;
}

interface ConventionFixture {
  flag: GroupBKey;
  label: string;
  input: ImportResult;
  taskId: string;
  /** Welke assen de conventie verandert; de overige assen worden niet geclaimd. */
  pick: (axes: Axes) => Partial<Axes>;
  on: Partial<Axes>;
  off: Partial<Axes>;
}

const fixtures: ConventionFixture[] = [];

// ── B1 `p6RelationFinishBoundary` ──────────────────────────────────────────────────────────────
// Eén band 08:00–17:00. De geplande opvolger start op het geplande einde van de voorganger
// (ma 17:00), dus de lezer zet de relatievlag. P6: FS+0 op die gedeelde grens ⇒ opvolger start
// ma 17:00. Generiek (half-open band): de volgende werkminuut is di 08:00.
fixtures.push({
  flag: 'p6RelationFinishBoundary',
  label: 'B1 FS-nul-lag op gedeelde finishgrens',
  input: importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x9\tCA_Base\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB1-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tB\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t9\t9\t2026-01-05 17:00\t2026-01-06 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ]),
  taskId: 'B',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-05T17:00' },
  off: { es: '2026-01-06T08:00' },
});

// B1, late kant (X12 brok 6). Eén band 08:00–16:00 ma–vr. T (ma 5 jan) —FS0→ S (8 u, gepland vanaf T's
// finishgrens ma 16:00: een voorgangerfinishgrens-relatie); een losse X (5 dagen, tot vr 9 jan 16:00)
// legt het projecteinde vast. S.LF = vr 16:00, dus S.LS = vr 08:00: P6 toont die als bandSTART (Hotel
// HCSWB1Z1240 LS 03-04 08:00), niet als finishgrens do 16:00. De finishgrens hoort bij de relatie: T.LF =
// do 16:00 (Hotel HCSWB1Z1230 03-03 16:00). Mutanten "LS-spiegel terug in subDuration" (S.LS do 16:00)
// en "relatie geeft de rauwe LS door" (T.LF vr 08:00) ⇒ rood.
{
  const b1 = importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB1-laat\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tX\tP\tC1\tX100\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t40\t40\t2026-01-05 08:00\t2026-01-09 16:00',
    '%R\tT\tP\tC1\tT100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tS\tP\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 16:00\t2026-01-06 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP\tP\tPR_FS\t0',
    '%E',
  ]);
  eq('B1-laat fixture: de relatie staat op de voorgangerfinishgrens', b1.sequences[0].p6StartAtPredecessorFinishBoundary, true);
  eq('B1-laat: de opvolger toont haar late start als bandstart', (({ ls, lf }) => ({ ls, lf }))(solveAxes(b1, 'S')),
    { ls: '2026-01-09T08:00', lf: '2026-01-09T16:00' });
  eq('B1-laat: de voorganger krijgt de finishgrens ervóór', solveAxes(b1, 'T').lf, '2026-01-08T16:00');
}

// ── B2 `p6BackwardLagFinishBoundary` ───────────────────────────────────────────────────────────
// Eén band 08:00–16:00 (8 u). A (ma) —FF+16u→ B (wo). B eindigt wo 16:00 = projecteinde, dus
// B.LF = wo 16:00, een exact bandeinde. Backward: A.LF = wo 16:00 − 16 werkuren = precies de
// bandstart di 08:00. P6 (WORKTIME-lag als grensafstand) geeft dan de complementaire vorige
// finishgrens ma 16:00; generiek blijft het di 08:00.
fixtures.push({
  flag: 'p6BackwardLagFinishBoundary',
  label: 'B2 backward WORKTIME-lag vanaf finishgrens',
  input: importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB2-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tB\tP\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-07 08:00\t2026-01-07 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FF\t16',
    '%E',
  ]),
  taskId: 'A',
  pick: axes => ({ lf: axes.lf }),
  on: { lf: '2026-01-05T16:00' },
  off: { lf: '2026-01-06T08:00' },
});

// B2 bij lag 0 (X12 brok 6). Eén band 08:00–16:00 ma–vr. A (ma) —FF+0→ B (ma) —FS+0→ C (1 dag); een
// losse X van 5 dagen (ma 5 – vr 9 jan) legt het projecteinde vast. C.LS = vr 08:00 ⇒ B.LF = de
// finishgrens do 8 jan 16:00. P6 (Hotel HMMOAZ040 —FF0→ HMMOAZ000, ashspace A1050 —FF0→ EM01): A.LF =
// die finishgrens zelf. Zonder B2 normaliseert de lag-0-verschuiving naar de volgende bandstart, vr
// 08:00. Mutant "lag-0-tak weg" ⇒ rood.
{
  const ff0 = importXer([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t${calendarData([['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tB2-lag0\tC1\t2026-01-05 08:00\t2026-01-05 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tX\tP\tC1\tX100\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t40\t40\t2026-01-05 08:00\t2026-01-09 16:00',
    '%R\tA\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tB\tP\tC1\tB100\tMidden\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-05 08:00\t2026-01-05 16:00',
    '%R\tC\tP\tC1\tC100\tSlot\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-01-06 08:00\t2026-01-06 16:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP\tP\tPR_FF\t0',
    '%R\tR2\tC\tB\tP\tP\tPR_FS\t0',
    '%E',
  ]);
  eq('B2 lag 0 fixture: B.LF op de finishgrens do 8 jan 16:00', solveAxes(ff0, 'B').lf, '2026-01-08T16:00');
  eq('B2 FF+0 vanaf een bandeinde ⇒ de finishgrens zelf', solveAxes(ff0, 'A').lf, '2026-01-08T16:00');
  eq('B2 uit ⇒ FF+0 normaliseert naar de volgende bandstart',
    solveAxes(withProfile(ff0, copy => setConvention(copy, 'p6BackwardLagFinishBoundary', false)), 'A').lf, '2026-01-09T08:00');
}

// ── B3 `p6CompletedDataDateWindow` ─────────────────────────────────────────────────────────────
// Een voltooide TT_Task (DT_FixedDUR2, CP_Drtn, expliciet targetvenster, rem_target_link_flag=Y)
// die op ma 5 jan werkte; statusdatum wo 14 jan 17:00. P6 toont een voltooide activiteit met
// ES = eerste werkminuut op/na de statusdatum (do 15 jan 08:00) en EF = de werkgrens daarvóór
// (wo 14 jan 17:00). Generiek houdt ze haar eigen actual-venster (ma 08:00–17:00).
fixtures.push({
  flag: 'p6CompletedDataDateWindow',
  label: 'B3 voltooide taak op statusdatumvenster',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tB3-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-01-30 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%E',
  ]),
  taskId: 'C',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-15T08:00', ef: '2026-01-14T17:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-05T17:00' },
});

// ── B4 `p6CompletedLoeActualFinish` ────────────────────────────────────────────────────────────
// Een voltooide LOE (5 jan – 6 mrt) met alleen een SS-ingang en geen opvolger; statusdatum
// 30 jun 17:00. P6 houdt het actual-venster (ES 5 jan 08:00, EF 6 mrt 17:00). Generiek valt de
// LOE in de hammockroute zonder finish-driver en landt als nulspan op de statusdatum
// (1 jul 08:00) — dezelfde uitkomst die `check-xer-completed-loe-actual-finish.ts` voor elke
// afgewezen vorm pint.
fixtures.push({
  flag: 'p6CompletedLoeActualFinish',
  label: 'B4 voltooide LOE via actual-finishroute',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tB4-fixture\tC1\t2026-06-30 17:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tP\tP1\tC1\tPRED\tSS voorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00\t\t',
    '%R\tL\tP1\tC1\tLOE\tVoltooide LOE\tTT_LOE\tDT_FixedDrtn\tTK_Complete\tCP_Drtn\t352\t0\t2026-01-05 08:00\t2026-03-06 17:00\t2026-01-05 08:00\t2026-03-06 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    '%E',
  ]),
  taskId: 'L',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-05T08:00', ef: '2026-03-06T17:00' },
  off: { es: '2026-07-01T08:00', ef: '2026-07-01T08:00' },
});

// ── B5 `p6OpenLoeTargetSpan` ───────────────────────────────────────────────────────────────────
// Een niet-gestarte LOE met targetvenster 5–16 jan, nul-lag SS-ingang en nul-lag FF-uitgang.
// P6 neemt het targetvenster als span (EF 16 jan 17:00). Generiek heeft de hammock geen
// finish-driver (de FF gaat UIT, niet in) en blijft een nulspan op zijn start (5 jan 08:00).
fixtures.push({
  flag: 'p6OpenLoeTargetSpan',
  label: 'B5 open LOE neemt targetvenster als span',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${SPLIT_DAY}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tB5-fixture\tC1\t2025-12-31 17:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tP\tP1\tC1\tPRED\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tL\tP1\tC1\tLOE\tOpen LOE\tTT_LOE\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t80\t80\t2026-01-05 08:00\t2026-01-16 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t8\t8\t2026-01-16 08:00\t2026-01-16 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-SS\tL\tP\tP1\tP1\tPR_SS\t0',
    '%R\tR-FF\tS\tL\tP1\tP1\tPR_FF\t0',
    '%E',
  ]),
  taskId: 'L',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-05T08:00', ef: '2026-01-16T17:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-05T08:00' },
});

eq('inventaris: één fixture per groep-B-conventie',
  fixtures.map(fixture => fixture.flag), [...GROUP_B]);

for (const fixture of fixtures) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt het P6-profiel`, input.project.schedulingProfile?.baseId, 'p6');
  // Vooraf: de fixture moet de conventie echt kunnen onderscheiden, anders bewijst niets hieronder iets.
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);

  const asRead = resolveConventions(input.project.schedulingProfile);
  eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ AAN`,
    pick(solveAxes(input, taskId)), fixture.on);
  eq(`${label}: 2. alleen ${flag} uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  const onlyThisB = { ...asRead };
  for (const key of GROUP_B) onlyThisB[key] = key === flag;
  eq(`${label}: 3. OPS-basis, A-waarden van het bestand, alleen ${flag} aan ⇒ AAN (de vlag schakelt, niet de basis)`,
    pick(solveAxes(withConventions(input, 'ops', onlyThisB), taskId)), fixture.on);
  eq(`${label}: 4. alle P6-gepoorte conventies uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, withoutP6Semantics), taskId)), fixture.off);
  const noB = { ...asRead };
  for (const key of GROUP_B) noB[key] = false;
  eq(`${label}: 5. P6-basis met alle vijf B-conventies uit ⇒ UIT (de basis alleen doet niets)`,
    pick(solveAxes(withConventions(input, 'p6', noB), taskId)), fixture.off);
}

// ── Geen bron- of basislek ──────────────────────────────────────────────────────────────────────
// (a) Een verdwaalde XER-bronmarkering in de projectopties (bv. een extensie of een oude payload)
// is zesassig inert: de motor leest haar nergens. (b) De basis van het profiel lekt niet: P6-basis
// met alle B-conventies uit rekent zesassig gelijk aan OPS-basis met exact dezelfde opgeloste waarden.
for (const fixture of fixtures) {
  const plain = solveAllAxes(fixture.input);
  const stray = structuredClone(fixture.input);
  stray.project.schedulingOptions = {
    ...stray.project.schedulingOptions, p6Source: 'XER',
  } as unknown as ProjectSchedulingOptions; // R8(rekenprofielen): vijandige invoer draagt bewust p6Source
  eq(`${fixture.label}: verdwaalde bronmarkering is zesassig inert`, solveAllAxes(stray), plain);
  const noB = { ...resolveConventions(fixture.input.project.schedulingProfile) };
  for (const key of GROUP_B) noB[key] = false;
  eq(`${fixture.label}: P6-basis = OPS-basis bij gelijke opgeloste waarden (zesassig)`,
    solveAllAxes(withConventions(fixture.input, 'p6', noB)), solveAllAxes(withConventions(fixture.input, 'ops', noB)));
}

// ── B3/B4 hebben A19 nodig ──────────────────────────────────────────────────────────────────────
// B3 en B4 hebben A19 (`p6UseRemainingStartForProgress`) en B4 ook A18 nodig: met A19 uit geeft
// zelfs de B-conventie aan UIT (zo rekende een bestand zonder bronmarkering vroeger ook).
for (const fixture of fixtures.filter(f => f.flag === 'p6CompletedDataDateWindow' || f.flag === 'p6CompletedLoeActualFinish')) {
  eq(`${fixture.label}: ${fixture.flag} aan, A19 uit ⇒ UIT`,
    fixture.pick(solveAxes(withProfile(fixture.input, copy => setConvention(copy, 'p6UseRemainingStartForProgress', false)), fixture.taskId)),
    fixture.off);
}

// ── Guardvolgorde van de redencodes ─────────────────────────────────────────────────────────────
// De conventie-check staat exact op de plek van de vroegere bron-check: ná de statusdatum-checks,
// vóór elke andere vlag- of taakcheck. Wie de volgorde verschuift, verandert stil de gerapporteerde
// reden (en daarmee de diagnose-traces).
{
  const b3 = fixtures.find(f => f.flag === 'p6CompletedDataDateWindow')!.input;
  const b4 = fixtures.find(f => f.flag === 'p6CompletedLoeActualFinish')!.input;
  const done = b3.tasks.find(task => task.id === 'C')!;
  const loe = b4.tasks.find(task => task.id === 'L')!;
  const b3Date = parseInstant(b3.project.statusDate!);
  const b4Date = parseInstant(b4.project.statusDate!);
  const so = (input: ImportResult, patch: Partial<EffectiveSchedulingOptions>): EffectiveSchedulingOptions =>
    ({ ...solveOptionsFor(input.project).schedulingOptions, ...patch });
  const loeIn = b4.sequences.filter(sequence => sequence.successorId === loe.id);
  const loeOut = b4.sequences.filter(sequence => sequence.predecessorId === loe.id);

  eq('guardvolgorde B3: statusdatum ontbreekt én conventie uit ⇒ missingDataDate',
    explainP6CompletedDataDateWindow(done, null, so(b3, { p6CompletedDataDateWindow: false })).reason, 'missingDataDate');
  eq('guardvolgorde B3: conventie uit én A19 uit ⇒ conventionOff',
    explainP6CompletedDataDateWindow(done, b3Date, so(b3, { p6CompletedDataDateWindow: false, p6UseRemainingStartForProgress: false })).reason,
    'conventionOff');
  eq('guardvolgorde B3: conventie aan, A19 uit ⇒ remainingStartOff',
    explainP6CompletedDataDateWindow(done, b3Date, so(b3, { p6UseRemainingStartForProgress: false })).reason, 'remainingStartOff');

  eq('guardvolgorde B4: statusdatum ontbreekt én conventie uit ⇒ missingDataDate',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, null, so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'missingDataDate');
  eq('guardvolgorde B4: ongeldige statusdatum én conventie uit ⇒ invalidDataDate',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, new Date(Number.NaN), so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'invalidDataDate');
  eq('guardvolgorde B4: conventie uit én A19 uit ⇒ conventionOff',
    explainCompletedXerLoeActualFinishEligibilityResolved(loe, b4Date, so(b4, { p6CompletedLoeActualFinish: false, p6UseRemainingStartForProgress: false }), loeIn, loeOut).reason,
    'conventionOff');

  eq('guardvolgorde A21: A21-vlag uit én B3 uit ⇒ conventionOff (B3 vóór de vlag)',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false, p6CompletedDataDateWindow: false })).reason,
    'conventionOff');
  eq('guardvolgorde A21: A21-vlag uit, B3 aan ⇒ flagOff',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false })).reason,
    'flagOff');
  eq('guardvolgorde A21: statusdatum ontbreekt én B3 uit ⇒ missingDataDate (actual-pin eerst)',
    explainP6CompletedLateRemainingWindowEligibilityResolved(done, null, so(b3, { p6CompletedDataDateWindow: false })).reason,
    'missingDataDate');

  const openLoeArgs = [[], [], b3Date, 0, 0] as const;
  eq('guardvolgorde B5: conventie uit op een niet-LOE ⇒ conventionOff (vóór de taakchecks)',
    explainOpenXerLoeTargetSpanEligibilityResolved(done, so(b3, { p6OpenLoeTargetSpan: false }), ...openLoeArgs).reason, 'conventionOff');
  eq('guardvolgorde B5: conventie aan op een niet-LOE ⇒ wrongActivityType',
    explainOpenXerLoeTargetSpanEligibilityResolved(done, so(b3, { p6OpenLoeTargetSpan: true }), ...openLoeArgs).reason, 'wrongActivityType');
}

// ── Bronscan: `p6Source` staat nergens meer onder src/engine/ ──────────────────────────────────
{
  const here = fileURLToPath(new URL('.', import.meta.url));
  const engineRoot = join(here, '..', '..', 'src', 'engine');
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && readFileSync(full, 'utf8').includes('p6Source')) {
        hits.push(relative(engineRoot, full).split('\\').join('/'));
      }
    }
  };
  walk(engineRoot);
  eq('bronscan: p6Source komt nergens onder src/engine/ voor', hits.sort(), []);
}

// ── Groep C (X12 naar nul, brok 2): C1 `p6CompletedPredecessorAtDataDate`, C2 `p6FreeFloatOnOwnCalendar`,
// C3 `p6CompletedRemainingLag`; brok 3: C4 `p6CompletedOutOfSequenceWindow`, C5 `p6CompletedPhysicalAtDataDate`,
// C6 `p6InProgressStartLagElapsed`; brok 4: C7 `p6FinishFinishStartMilestoneLateFinish`, C8
// `p6StartedTaskIgnoresPlannedStartFloor`; brok 6: C9 `p6LateFinishOnOwnCalendar`; brok 8: C11
// `p6ProgressOverrideIgnoresStartedSuccessor`, C12 `p6FinishNotBeforeFinishFinishBound` (C10 = de geparkeerde
// ALAP-conventie, niet in het register) ──
// Zelfde bewijsvorm, per conventie: zoals gelezen (P6-profiel) ⇒ AAN; alleen deze conventie uit ⇒
// UIT; OPS-basis met alleen deze conventie aan ⇒ AAN; OPS- en MS Project-profiel ⇒ UIT. De
// verwachtingen volgen uit de regel (docblok in `types/project.ts`), niet uit de implementatie.
const GROUP_C = [
  'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag', 'p6CompletedOutOfSequenceWindow',
  'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
  'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor', 'p6LateFinishOnOwnCalendar',
  'p6ProgressOverrideIgnoresStartedSuccessor', 'p6FinishNotBeforeFinishFinishBound',
] as const satisfies readonly ConventionKey[];

/** Als `calendarData`, met een eigen set werkdagen (P6-dagnummers; 2 = maandag). */
function calendarDataOn(workDays: readonly number[], bands: ReadonlyArray<readonly [string, string]>): string {
  const day = (n: number) => {
    const inner = workDays.includes(n)
      ? bands.map(([s, f]) => `(0||0(s|${s}|f|${f})())`).join('')
      : '';
    return `(0||${n}()(${inner}))`;
  };
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}

interface GroupCFixture {
  flag: typeof GROUP_C[number];
  label: string;
  input: ImportResult;
  taskId: string;
  pick: (axes: Axes) => Partial<Axes>;
  on: Partial<Axes>;
  off: Partial<Axes>;
  /** Uitkomst onder de ingebouwde OPS/MS Project-profielen, als die niet `off` is (C3 rekent op de
   *  B3-route; zonder B3 staat de voltooide taak op haar generieke actual-pin, met eigen duur). */
  builtInOff?: Partial<Axes>;
  /** Als `builtInOff`, maar per ingebouwd profiel (wanneer OPS en MS Project zelf verschillen). */
  builtInOffByBase?: Record<'ops' | 'msproject', Partial<Axes>>;
  /** Besluit 2026-09-23 (populatie = P6-doorgerekende orakels): C1 en C4 staan in het ingebouwde
   *  P6-profiel UIT — op de P6-doorgerekende bestanden 0 effect, alleen rehab-2 (P3-uitvoer) droeg ze.
   *  (C3 bleef aan: C5 leunt erop.)
   *  `input` is dan de import MET de conventie expliciet aan (zodat de regel zelf getoetst blijft);
   *  zoals gelezen staat ze uit. */
  p6BuiltInOff?: true;
}
const groupC: GroupCFixture[] = [];

/** De import met `flag` als expliciete afwijking aan op het P6-profiel (C1/C4, zie `p6BuiltInOff`). */
function enabledOverP6(flag: typeof GROUP_C[number], input: ImportResult): ImportResult {
  return withProfile(input, copy => setConvention(copy, flag, true));
}

// C1: band 08:00–17:00 ma–vr. Statusdatum wo 7 jan 00:00. Voltooide A met werkelijk einde wo 7 jan
// 17:00 (ná de statusdatum). P6: de opvolger B (FS+0, niet gestart) begint op de statusdatum, wo
// 08:00; generiek pas ná het werkelijke einde, do 08:00.
groupC.push({
  flag: 'p6CompletedPredecessorAtDataDate',
  label: 'C1 voltooide voorganger met einde ná de statusdatum',
  input: enabledOverP6('p6CompletedPredecessorAtDataDate', importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC1-fixture\tC1\t2026-01-07 00:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t27\t0\t2026-01-05 08:00\t2026-01-07 17:00\t2026-01-05 08:00\t2026-01-07 17:00',
    '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-08 08:00\t2026-01-08 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_FS\t0',
    '%E',
  ])),
  p6BuiltInOff: true,
  taskId: 'B',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-07T08:00' },
  off: { es: '2026-01-08T08:00' },
});

// C2: taak T op een ma–vr-kalender (08:00–17:00), opvolger S op een ma–do-kalender. T eindigt do 8
// jan 17:00; S (FS+0) kan pas ma 12 jan 08:00 beginnen. Op de kalender van T ligt daartussen één
// werkdag (vr 9 jan) ⇒ P6-FF 1 dag; op de kalender van S niets ⇒ generiek 0.
groupC.push({
  flag: 'p6FreeFloatOnOwnCalendar',
  label: 'C2 vrije speling in de eigen kalender',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-fixture\tC5\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t36\t36\t2026-01-05 08:00\t2026-01-08 17:00',
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%E',
  ]),
  taskId: 'T',
  pick: axes => ({ ef: axes.ef, ff: axes.ff }),
  on: { ef: '2026-01-08T17:00', ff: 1 },
  off: { ef: '2026-01-08T17:00', ff: 0 },
});

// C3: band 08:00–17:00 ma–vr, statusdatum wo 14 jan 17:00, rem_target_link_flag=Y (de B3-route).
// Voltooide C (ma 5 jan) —FS+45 u (5 werkdagen)→ open S (1 dag). Een losse open X van 20 werkdagen
// bepaalt het projecteinde (wo 11 feb 17:00), dus S.LS = wo 11 feb 08:00. Tussen het werkelijke einde
// van C (ma 5 jan 17:00) en de statusdatum liggen 7 werkdagen (63 u) > 45 u: de lag is verstreken.
// P6: C.LS = S.LS = wo 11 feb 08:00, C.LF = de werkgrens daarvóór, di 10 feb 17:00. Generiek (volle
// lag): 5 werkdagen eerder, LS wo 4 feb 08:00 en LF di 3 feb 17:00.
groupC.push({
  flag: 'p6CompletedRemainingLag',
  label: 'C3 verstreken lag uit een voltooide voorganger',
  input: importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC3-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%R\tX\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tC\tP1\tP1\tPR_FS\t45',
    '%E',
  ]),
  taskId: 'C',
  pick: axes => ({ ls: axes.ls, lf: axes.lf }),
  on: { ls: '2026-02-11T08:00', lf: '2026-02-10T17:00' },
  off: { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' },
  // Generiek: LF = S.LS − 45 u = di 3 feb 17:00, LS = LF − de eigen 9 u = di 3 feb 08:00.
  builtInOff: { ls: '2026-02-03T08:00', lf: '2026-02-03T17:00' },
});

// C4: band 08:00–17:00 ma–vr, statusdatum wo 14 jan 17:00 (het restwerk begint do 15 jan 08:00),
// rem_target_link_flag=Y (de B3-route). Open P (3 dagen, niet gestart) —FS0→ voltooide C (werkelijk
// ma 5 jan) —FS0→ open S (1 dag). P loopt do 15 t/m ma 19 jan 17:00. P6 (Retained Logic): het
// nul-restvenster van C ligt ná P — ES di 20 jan 08:00, EF ma 19 jan 17:00 — en S start di 20 jan.
// Zonder C4: het venster op de statusdatum (ES do 15 jan 08:00, EF wo 14 jan 17:00).
groupC.push({
  flag: 'p6CompletedOutOfSequenceWindow',
  label: 'C4 voltooide taak buiten volgorde',
  input: enabledOverP6('p6CompletedOutOfSequenceWindow', importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC4-fixture\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float\tsched_retained_logic',
    '%R\tP1\tN\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-15 08:00\t2026-01-19 17:00\t\t',
    '%R\tC\tP1\tC1\tDONE\tVoltooid buiten volgorde\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-05 08:00\t2026-01-05 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tC\tP\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tS\tC\tP1\tP1\tPR_FS\t0',
    '%E',
  ])),
  p6BuiltInOff: true,
  taskId: 'C',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-20T08:00', ef: '2026-01-19T17:00' },
  off: { es: '2026-01-15T08:00', ef: '2026-01-14T17:00' },
  // Zonder B3 (OPS/MS Project) toont een voltooide taak haar werkelijke datums.
  builtInOff: { es: '2026-01-05T08:00', ef: '2026-01-05T17:00' },
});

// C5: band 08:00–17:00 ma–vr, statusdatum wo 14 jan 00:00 (buiten de werktijd), rem_target_link_flag=Y
// (A19). Voltooide CP_Phys-taak D (DT_FixedDrtn, werkelijk ma 5 – di 6 jan) —FS0→ open S (1 dag).
// P6: D staat als één punt op het RAUWE statusdatum-instant — ES = EF = wo 14 jan 00:00, niet gesnapt
// op 08:00 — en haar late kant is één punt op de LS van S (wo 14 jan 08:00). Zonder C5: de werkelijke
// datums (ma 5 jan 08:00 – di 6 jan 17:00), ook onder OPS en MS Project.
function c5Fixture(extraTasks: string[] = [], extraRelations: string[] = []): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC5-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tD\tP1\tC1\tDONE\tVoltooid fysiek\tTT_Task\tDT_FixedDrtn\tTK_Complete\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-06 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    ...extraTasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tD\tP1\tP1\tPR_FS\t0',
    ...extraRelations,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6CompletedPhysicalAtDataDate',
  label: 'C5 voltooide CP_Phys-taak op de statusdatum',
  input: c5Fixture(),
  taskId: 'D',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-14T00:00', ef: '2026-01-14T00:00' },
  off: { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' },
});

// C5, vrije-spelingkant (X12 brok 8; Roads OCEC18201 → de voltooide CP_Phys-OCEC18381 met punt 06-23 17:00:
// P6 ff 3000 min = 50 h van EF 06-16 17:00 tot dat punt). Twee open voorgangers van D: O (9 u, wo 14 jan
// 08:00–17:00) en Q (27 u, wo 14 – vr 16 jan 17:00). D's punt is de laatste rauwe relatiegrens, vr 16 jan
// 17:00. De vrije speling van O telt tot dat punt: do + vr = 18 u = 2 dagen; zonder deze kant heeft de
// relatie naar de voltooide D geen grens en valt ze terug op 0. Mutant "ff-kant weg" ⇒ rood.
{
  const input = c5Fixture([
    '%R\tO\tP1\tC1\tOPEN1\tKorte voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    '%R\tQ\tP1\tC1\tOPEN2\tLange voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR2\tD\tO\tP1\tP1\tPR_FS\t0', '%R\tR3\tD\tQ\tP1\tP1\tPR_FS\t0']);
  eq('C5 ff-kant fixture: het punt van D ligt op de grens van Q', (({ es, ef }) => ({ es, ef }))(solveAxes(input, 'D')),
    { es: '2026-01-16T17:00', ef: '2026-01-16T17:00' });
  eq('C5 ff-kant: vrije speling van O tot het punt van D', solveAxes(input, 'O').ff, 2);
  eq('C5 uit ⇒ geen punt, vrije speling 0',
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'O').ff, 0);
  // Randgeval (ongemeten ⇒ terugval zoals vóór brok 8): een FS-relatie MET lag (O —FS+9 u→ D).
  // Mutant "FS/lag-0-poort weg" ⇒ rood. (Een voltooide voorganger bereikt deze tak niet: met A12 wist de
  // motor haar relatiegrens maar zet A12 haar vrije speling op 0, zonder A12 heeft ze een eigen grens.)
  const lagged = structuredClone(input);
  const rel = lagged.sequences.find(seq => seq.predecessorId === 'O')!;
  rel.lagMinutes = 540;
  rel.lagDays = 1;
  eq('C5 ff-kant niet bij een FS-relatie met lag', solveAxes(lagged, 'O').ff, 0);
  // Randgeval (bewuste beperking, niet gemeten): een SS- of FF-relatie naar het punt geeft géén vrije
  // speling tot het punt. Mutant "FS-poort weg" ⇒ rood.
  for (const type of ['START_START', 'FINISH_FINISH'] as const) {
    const typed = structuredClone(input);
    typed.sequences.find(seq => seq.predecessorId === 'O')!.type = type;
    eq(`C5 ff-kant niet bij een ${type}-relatie naar het punt`, solveAxes(typed, 'O').ff, 0);
  }
  // Voltooiingspoort (integratieronde 2, reviewfix brok 8): een VOLTOOIDE voorganger van D krijgt geen
  // vrije speling tot het punt. O voltooid (werkelijk wo 7 jan). Onder P6 (A12 aan) wist de motor haar
  // relatiegrens en zet A12 haar vrije speling op 0; met A12 uit heeft de relatie een eigen grens (ff 7)
  // en bereikt ze deze tak niet. De mutant "voltooiingspoort weg" is daardoor EQUIVALENT (bewezen: de tak
  // vraagt ff === undefined, dat kan alleen met A12 aan, en A12 zet voltooid werk met statusdatum — die
  // een punt vereist — altijd op 0); deze regels pinnen het gedrag, niet de poort.
  const donePred = c5Fixture([
    '%R\tO\tP1\tC1\tDONE1\tVoltooide voorganger\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-07 08:00\t2026-01-07 17:00\t2026-01-07 08:00\t2026-01-07 17:00',
    '%R\tQ\tP1\tC1\tOPEN2\tLange voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR2\tD\tO\tP1\tP1\tPR_FS\t0', '%R\tR3\tD\tQ\tP1\tP1\tPR_FS\t0']);
  eq('C5 ff-kant: voltooide voorganger van het punt heeft vrije speling 0', solveAxes(donePred, 'O').ff, 0);
  eq('C5 ff-kant: voltooide voorganger, A12 uit ⇒ eigen relatiegrens (ff 7)',
    solveAxes(withProfile(donePred, copy => setConvention(copy, 'preserveActualDatesInBackwardPass', false)), 'O').ff, 7);
}

// C6: band 08:00–17:00 ma–vr, statusdatum wo 14 jan 00:00, rem_target_link_flag=Y (A19). Lopende A
// (werkelijk gestart ma 5 jan 08:00, 18 h restwerk vanaf de statusdatum: wo 14 jan 08:00) —SS+18 h→
// niet-gestarte S. Sinds de werkelijke start is op de statusdatum 7 × 9 = 63 h werktijd verstreken,
// dus niets van de lag blijft over: S start met A's restwerk, wo 14 jan 08:00. Zonder C6: de volle
// lag vanaf A's restwerkstart, wo 14 jan 08:00 + 18 h = do 15 jan 17:00 ⇒ vr 16 jan 08:00.
function c6Fixture(
  actualStart = '2026-01-05 08:00', extraTasks: string[] = [], extraRelations: string[] = [],
  /** `SCHEDOPTIONS.sched_lag_early_start_flag`; afwezig ⇒ geen SCHEDOPTIONS-tabel (P6-standaard Y). */
  ssLagEarlyStartFlag?: 'Y' | 'N',
): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC6-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    ...(ssLagEarlyStartFlag
      ? ['%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_lag_early_start_flag', `%R\tP1\t${ssLagEarlyStartFlag}`]
      : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    `%R\tA\tP1\tC1\tRUN\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t45\t18\t2026-01-05 08:00\t2026-01-15 17:00\t${actualStart}\t`,
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    ...extraTasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tA\tP1\tP1\tPR_SS\t18',
    ...extraRelations,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6InProgressStartLagElapsed',
  label: 'C6 verstreken SS-lag uit een lopende voorganger',
  input: c6Fixture(),
  taskId: 'S',
  pick: axes => ({ es: axes.es }),
  on: { es: '2026-01-14T08:00' },
  off: { es: '2026-01-16T08:00' },
  // Zonder A19 is de vroege start van A haar werkelijke start (ma 5 jan 08:00); + 18 h = di 6 jan 17:00
  // ⇒ wo 7 jan 08:00. OPS legt een niet-gestarte taak op de statusdatum (wo 14 jan 08:00), MS Project niet.
  builtInOffByBase: { ops: { es: '2026-01-14T08:00' }, msproject: { es: '2026-01-07T08:00' } },
});

// C7: band 08:00–17:00 ma–vr, geen statusdatumvoortgang. Open A (1 dag, ma 5 jan) —FF0→
// startmijlpaal M (`TT_Mile`) —FF0→ open Z (1 dag). Een losse open X van 10 werkdagen legt het
// projecteinde op vr 16 jan 17:00, dus Z.LF = M.LF = vr 16 jan 17:00. P6 (Roads, B08): A.LF = de
// late finish van M zelf, vr 16 jan 17:00, dus A.LS = vr 16 jan 08:00. Zonder C7 is M een dagbegin-
// anker: A.LF = het begin van de mijlpaaldag, vr 16 jan 08:00 (werktijd-gelijk aan do 15 jan 17:00),
// dus A.LS = do 15 jan 08:00 — één werkdag (9 u) minder totale speling. Voorwaarts: een open Y
// (3 dagen, ma 5 – wo 7 jan) —FS0→ M zet M op do 8 jan 08:00. P6 telt de vrije speling van A tot
// M zelf: di 6 en wo 7 jan = 2 dagen; zonder C7 vanaf de werkgrens ná het dagbegin-anker: 1 dag.
function c7Fixture(milestoneType: 'TT_Mile' | 'TT_FinMile', withDriver = true): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC6-fixture\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP1\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00',
    `%R\tM\tP1\tC1\tM100\tMijlpaal\t${milestoneType}\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-06 08:00\t2026-01-06 08:00`,
    '%R\tZ\tP1\tC1\tZ100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-06 08:00\t2026-01-06 17:00',
    '%R\tY\tP1\tC1\tY100\tDrijver\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-05 08:00\t2026-01-07 17:00',
    '%R\tX\tP1\tC1\tX100\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-01-05 08:00\t2026-01-16 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tM\tA\tP1\tP1\tPR_FF\t0',
    '%R\tR2\tZ\tM\tP1\tP1\tPR_FF\t0',
    ...(withDriver ? ['%R\tR3\tM\tY\tP1\tP1\tPR_FS\t0'] : []),
    '%E',
  ]);
}
groupC.push({
  flag: 'p6FinishFinishStartMilestoneLateFinish',
  label: 'C7 FF-relatie naar een startmijlpaal',
  input: c7Fixture('TT_Mile'),
  taskId: 'A',
  pick: axes => ({ ls: axes.ls, lf: axes.lf, tf: axes.tf, ff: axes.ff }),
  on: { ls: '2026-01-16T08:00', lf: '2026-01-16T17:00', tf: 9, ff: 2 },
  // Zonder C7 onder P6 blijft de FF0-grens do 15 jan 17:00 staan (B2 bij lag 0, X12 brok 6) — werktijd-
  // gelijk aan vr 08:00, dus dezelfde ls/tf; OPS en MS Project (zonder B2) normaliseren naar vr 08:00.
  // De vrije speling blijft onder P6 zonder C7 toch 2: C12 (brok 8) telt over een FF0-relatie tot de
  // vroege finish van de opvolger, hier de mijlpaal zelf — dezelfde P6-waarde langs een tweede weg.
  off: { ls: '2026-01-15T08:00', lf: '2026-01-15T17:00', tf: 8, ff: 2 },
  builtInOff: { ls: '2026-01-15T08:00', lf: '2026-01-16T08:00', tf: 8, ff: 1 },
});

// C8: band 08:00–17:00 ma–vr, statusdatum ma 12 jan 08:00, rem_target_link_flag=Y (A19: de
// getoonde ES van een lopende taak is de start van het restwerk). Lopende Q (9 u rest) eindigt ma 12
// jan 17:00 —FS0→ lopende T (werkelijke start ma 5 jan, 27 u gepland, 18 u rest) met een gepland
// venster ma 19 – wo 21 jan: ruim ná de netwerkgrens (di 13 jan 08:00), dus A16 zou het als vloer
// gebruiken. P6 (OZB, B11, OZ1030 → OZ1040): het restwerk begint direct ná de voorganger — ES di 13
// jan 08:00, EF wo 14 jan 17:00 — en opvolger S (FS0) op do 15 jan 08:00. Zonder C8: ES ma 19 jan
// 08:00, EF di 20 jan 17:00, S wo 21 jan.
function c8Fixture(started: boolean): ImportResult {
  const task = started
    ? '%R\tT\tP1\tC1\tT100\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t27\t18\t2026-01-19 08:00\t2026-01-21 17:00\t2026-01-05 08:00\t'
    : '%R\tT\tP1\tC1\tT100\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-19 08:00\t2026-01-21 17:00\t\t';
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC7-fixture\tC1\t2026-01-12 08:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tQ\tP1\tC1\tQ100\tLopende voorganger\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t9\t2026-01-12 08:00\t2026-01-12 17:00\t2026-01-05 08:00\t',
    task,
    '%R\tS\tP1\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tT\tQ\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
}
groupC.push({
  flag: 'p6StartedTaskIgnoresPlannedStartFloor',
  label: 'C8 geplande-startvloer niet voor een lopende taak',
  input: c8Fixture(true),
  taskId: 'T',
  pick: axes => ({ es: axes.es, ef: axes.ef }),
  on: { es: '2026-01-13T08:00', ef: '2026-01-14T17:00' },
  off: { es: '2026-01-19T08:00', ef: '2026-01-20T17:00' },
  // OPS/MS Project kennen de vloer (A16) niet en tonen de werkelijke start (geen A19); het restwerk
  // loopt daar ook ná Q: EF wo 14 jan 17:00.
  builtInOff: { es: '2026-01-05T08:00', ef: '2026-01-14T17:00' },
});

// C9: startmijlpaal M (`TT_Mile`) op een ma–do-kalender (08:00–17:00, vrijdag vrij, zoals Hotel
// kalender 844) —FS0→ S (1 u, ma–vr) —FS0→ Z (5 dagen, ma–vr); een losse X (ma–vr, 15 werkdagen, tot vr 23
// jan 17:00) legt het projecteinde vast. Z.LS = ma 19 jan 08:00 ⇒ S.LF = vr 16 jan 17:00, S.LS = vr 16 jan
// 16:00, en die grens komt ongesnapt als late finish bij M: een vrijdag, buiten M's werktijd. P6 (Hotel
// HCMEF6Z5565: opvolger-LS vr 12-27 16:00 ⇒ do 12-26 17:00; twaalf zulke startmijlpalen): de late finish
// is het einde van de vorige werkperiode op de eigen kalender, do 15 jan 17:00. Zonder C9 blijft vr 16
// jan 16:00 staan.
function c9Fixture(): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC9-fixture\tC5\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC5\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t135\t135\t2026-01-05 08:00\t2026-01-23 17:00\t\t',
    '%R\tM\tP1\tC4\tM100\tStartmijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-05 08:00\t2026-01-05 08:00\t\t',
    '%R\tS\tP1\tC5\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t1\t1\t2026-01-05 08:00\t2026-01-05 09:00\t\t',
    '%R\tZ\tP1\tC5\tZ100\tSlot\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-01-05 09:00\t2026-01-12 09:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tM\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tZ\tS\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
}
groupC.push({
  flag: 'p6LateFinishOnOwnCalendar',
  label: 'C9 late finish op de eigen kalender',
  input: c9Fixture(),
  taskId: 'M',
  pick: axes => ({ lf: axes.lf }),
  on: { lf: '2026-01-15T17:00' },
  off: { lf: '2026-01-16T16:00' },
});

// C9, bronvoorwaarde (critreview brok 6 landing 3–5): C9 snapt alleen als de OPVOLGERgrens ook ná de
// late-zijde-constraints de late finish bepaalt. Dezelfde fixture, nu met een strakkere FNLT op M van vr 16
// jan 12:00 — óók buiten M's werktijd (vrijdag vrij). De bound wint en blijft staan; C9 mag hem niet naar
// do 15 jan 17:00 trekken. Mutant `true || lateFinish === successorBound` ⇒ rood.
{
  const input = c9Fixture();
  input.tasks.find(task => task.id === 'M')!.constraint = { type: 'FNLT', date: '2026-01-16T12:00' };
  eq('C9 bronvoorwaarde: een strakkere FNLT buiten de werktijd wint en wordt niet gesnapt',
    (({ lf }) => ({ lf }))(solveAxes(input, 'M')), { lf: '2026-01-16T12:00' });
}

// C11: kalender ma–vr 08:00–17:00 (9 u), statusdatum ma 12 jan 08:00, Progress Override (zoals OZB
// project 10093: `sched_progress_override = Y`, `sched_retained_logic = N`). A is lopend (werkelijke start
// ma 5 jan, rest 9 u) en heeft twee FS0-opvolgers: B, al buiten volgorde gestart op di 6 jan (rest 18 u),
// en de niet-gestarte C (27 u), die ook op de niet-gestarte D (27 u) wacht. Een losse X (72 u) legt het
// projecteinde op wo 21 jan 17:00.
// Met de hand, Progress Override zonder logica naar B: A's restwerk ma 12 jan 08:00–17:00. D wo 14 jan 17:00,
// dus C do 15 jan 08:00 – ma 19 jan 17:00 (vroeg); laat eindigt C op het projecteinde wo 21 jan 17:00 en
// start ze ma 19 jan 08:00, dus A.LF = vr 16 jan 17:00: tf = 4 werkdagen (di–vr). Vrije speling tot
// C's vroege start do 15 jan 08:00: 2 werkdagen (di, wo). P6 (OZ1030): LF 12-31 16:00 = de dag vóór de LS
// van de niet-gestarte opvolger, ff 24 h tot diens ES; de relatie naar de gestarte OZ1040 telt nergens.
// Zonder C11 telt B achterwaarts (A12 houdt B's LS op haar werkelijke start) en in de vrije speling.
function c11Fixture(successorStarted = true, predecessorCompleted = false): ImportResult {
  const a = predecessorCompleted
    ? '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-09 17:00'
    : '%R\tA\tP1\tC1\tA100\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t9\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t';
  const b = successorStarted
    ? '%R\tB\tP1\tC1\tB100\tGestarte opvolger\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t27\t18\t2026-01-06 08:00\t2026-01-08 17:00\t2026-01-06 08:00\t'
    : '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-13 08:00\t2026-01-14 17:00\t\t';
  const input = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC11-fixture\tC1\t2026-01-12 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC1\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t72\t72\t2026-01-12 08:00\t2026-01-21 17:00\t\t',
    a,
    b,
    '%R\tC\tP1\tC1\tC100\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-15 08:00\t2026-01-19 17:00\t\t',
    '%R\tD\tP1\tC1\tD100\tAndere voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-12 08:00\t2026-01-14 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tC\tA\tP1\tP1\tPR_FS\t0',
    '%R\tR3\tC\tD\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
  input.project.progressMode = 'PROGRESS_OVERRIDE';
  return input;
}
groupC.push({
  flag: 'p6ProgressOverrideIgnoresStartedSuccessor',
  label: 'C11 Progress Override negeert de gestarte opvolger ook achterwaarts',
  input: c11Fixture(),
  taskId: 'A',
  pick: axes => ({ lf: axes.lf, tf: axes.tf, ff: axes.ff }),
  on: { lf: '2026-01-16T17:00', tf: 4, ff: 2 },
  // Zonder C11: A12 houdt B's LS op haar werkelijke start di 6 jan 08:00, dus A.LF = ma 5 jan 17:00 en
  // tf = −5 werkdagen; de vrije speling naar B is negatief en A13 klemt hem op 0.
  off: { lf: '2026-01-05T17:00', tf: -5, ff: 0 },
  // OPS/MS Project: geen A12 (B's LS volgt uit haar restwerk, dus de late kant van A toevallig gelijk)
  // en geen A13 (de negatieve vrije speling naar B blijft staan): het onderscheid zit in ff.
  builtInOff: { lf: '2026-01-16T17:00', tf: 4, ff: -5 },
});

// C11, randgevallen (docblok): alleen onder Progress Override, alleen naar een gestarte opvolger.
{
  const pickA = (axes: Axes) => ({ ls: axes.ls, lf: axes.lf, tf: axes.tf, ff: axes.ff });
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6ProgressOverrideIgnoresStartedSuccessor', false));
  // (a) Retained Logic: de relatie naar B telt gewoon; C11 aan = C11 uit. Mutant "PO-poort weg" ⇒ rood.
  const retained = c11Fixture();
  retained.project.progressMode = 'RETAINED_LOGIC';
  eq('C11 onder Retained Logic ⇒ geen effect', pickA(solveAxes(retained, 'A')), pickA(solveAxes(off(retained), 'A')));
  // (b) een niet-gestarte B is gewone logica, ook onder Progress Override. Mutant "startpoort weg" ⇒ rood.
  const unstarted = c11Fixture(false);
  eq('C11 naar een niet-gestarte opvolger ⇒ geen effect', pickA(solveAxes(unstarted, 'A')), pickA(solveAxes(off(unstarted), 'A')));
  // (c) een voltooide voorganger valt erbuiten (historie; P6: "without delay" gaat over de lopende
  // opvolger). Mutant "voorgangerpoort weg" ⇒ rood.
  const completed = c11Fixture(true, true);
  eq('C11 vanuit een voltooide voorganger ⇒ geen effect', pickA(solveAxes(completed, 'A')), pickA(solveAxes(off(completed), 'A')));
  const opsOnly = (input: ImportResult, on: boolean) => withProfile(input, copy => {
    copy.project.schedulingProfile = { baseId: 'ops', id: 'test-ops', name: 'test', overrides: on ? { p6ProgressOverrideIgnoresStartedSuccessor: true } : {} };
  });
  eq('C11 vanuit een voltooide voorganger, OPS-basis ⇒ geen effect',
    pickA(solveAxes(opsOnly(completed, true), 'A')), pickA(solveAxes(opsOnly(completed, false), 'A')));
  // (d) de lopende opvolger zelf verandert niet (de voorwaartse kant negeerde de relatie al).
  const input = c11Fixture();
  eq('C11 laat de gestarte opvolger zelf ongemoeid', solveAxes(input, 'B'), solveAxes(off(input), 'B'));
}

// C12: P op een zevendaagse kalender C7 (08:00–17:00) eindigt do 8 jan 12:00 (31 u vanaf ma 5 jan) en
// is via FF0 voorganger van S (9 u) op kalender C3, die alleen ma–wo werkt (zoals Roads A10650 op kal. 1474
// → A10660 op kal. 1473, en Hotel HCSWB4Z4240 → HCSWB3Z2190). De FF-grens do 12:00 valt in vrije tijd van
// S. Zonder C12: S eindigt op het laatste bandeinde ervóór, wo 7 jan 17:00 (nul werktijd verschil, maar in
// kloktijd vóór de grens). P6 (FF: "cannot finish until its predecessor finishes"): de eerste werkgrens
// ná de grens, ma 12 jan 08:00. De vrije speling van P over die relatie telt dan in P's eigen kalender tot
// die finish: do 12:00–17:00 plus vr, za, zo = 5 + 27 = 32 u = 32/9 dag (P6 A10650: 960 min = 16 u op
// kal. 1474 tot A10660-EF); zonder C12 volgt ze uit de afgeleide startgrens: 0.
function c12Fixture(opts: { predMilestone?: boolean; sameCalendar?: boolean; predHours?: number; lagHours?: number } = {}): ImportResult {
  const hours = opts.predHours ?? 31;
  const succCal = opts.sameCalendar ? 'C7' : 'C3';
  const pred = opts.predMilestone
    ? '%R\tP\tP1\tC7\tP100\tStartmijlpaal\tTT_Mile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-01-08 08:00\t2026-01-08 08:00\t\t'
    : `%R\tP\tP1\tC7\tP100\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${hours}\t${hours}\t2026-01-05 08:00\t2026-01-08 12:00\t\t`;
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC7\tZevendaags\tP1\tCA_Project\t9\t63\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '17:00']])}`,
    `%R\tC3\tMa-wo\tP1\tCA_Project\t9\t27\t${calendarDataOn([2, 3, 4], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC12-fixture\tC7\t2026-01-05 08:00\t2026-01-05 08:00\t2026-03-31 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC7\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-05 08:00\t2026-01-24 17:00\t\t',
    pred,
    `%R\tS\tP1\t${succCal}\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00\t\t`,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tP\tP1\tP1\tPR_FF\t${opts.lagHours ?? 0}`,
    '%E',
  ]);
}
groupC.push({
  flag: 'p6FinishNotBeforeFinishFinishBound',
  label: 'C12 vroege finish niet vóór de FF-grens',
  input: c12Fixture(),
  taskId: 'S',
  pick: axes => ({ ef: axes.ef }),
  on: { ef: '2026-01-12T08:00' },
  off: { ef: '2026-01-07T17:00' },
});

// C12, de andere vormen en randgevallen (docblok).
{
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishNotBeforeFinishFinishBound', false));
  // (a) De vrije-spelingkant: P telt tot S' vroege finish. Mutant "ff-kant weg" ⇒ rood.
  const base = c12Fixture();
  eq('C12 vrije speling van de FF-voorganger tot de vroege finish van de opvolger', solveAxes(base, 'P').ff, 32 / 9);
  eq('C12 uit ⇒ vrije speling via de afgeleide startgrens', solveAxes(off(base), 'P').ff, 0);
  // (b) FF vanaf een open STARTmijlpaal (Roads OCEC12101 → OCEC9761: P6 EF 01-15 07:00 = de start van de
  // mijlpaal, OPS het bandeinde ervóór). Mijlpaal P do 8 jan 08:00, S op dezelfde zevendaagse kalender:
  // zonder C12 wo 7 jan 17:00, met C12 do 8 jan 08:00. Mutant "startmijlpaal-uitzondering weg" (grens ook
  // hier naar het vorige bandeinde) ⇒ rood.
  const milestone = c12Fixture({ predMilestone: true, sameCalendar: true });
  eq('C12 FF vanaf een startmijlpaal: EF op de start van de mijlpaal', solveAxes(milestone, 'S').ef, '2026-01-08T08:00');
  eq('C12 uit, FF vanaf een startmijlpaal: het bandeinde ervóór', solveAxes(off(milestone), 'S').ef, '2026-01-07T17:00');
  // (c) Gewone FF op dezelfde kalender, grens op een bandeinde (P 27 u: wo 7 jan 17:00): de motor draagt
  // die grens intern als de volgende bandstart. Zonder de normalisatie naar de finish-kant sprong de EF een
  // dag vooruit, naar do 08:00 (restant-onderzoek 284: 82 cellen slechter). Met C12 ⇒ geen effect.
  // Mutant "normalisatie weg" ⇒ rood.
  const plain = c12Fixture({ sameCalendar: true, predHours: 27 });
  eq('C12 fixture: gewone FF eindigt op het bandeinde van de voorganger', solveAxes(plain, 'S').ef, '2026-01-07T17:00');
  eq('C12 gewone FF op dezelfde kalender ⇒ geen effect', solveAxes(plain, 'S'), solveAxes(off(plain), 'S'));
  // (c2) Lopende opvolger (Roads A10660, lopend op kal. 1473): S gestart ma 5 jan 08:00, rest 9 u (de volle
  // duur), statusdatum ma 5 jan 13:00, Retained Logic. De FF-grens schuift het restwerk naar wo 7 jan
  // 08:00–17:00; C12 legt de finish op ma 12 jan 08:00. Mutant "lopende tak niet aangeroepen" ⇒ rood.
  const running = c12Fixture();
  const r = running.tasks.find(task => task.id === 'S')!;
  r.time.actualStart = '2026-01-05T08:00';
  r.time.completion = 0.01;
  r.time.remainingMinutes = 540;
  running.project.statusDate = '2026-01-05T13:00';
  eq('C12 lopende opvolger: restwerk eindigt niet vóór de FF-grens', solveAxes(running, 'S').ef, '2026-01-12T08:00');
  eq('C12 uit, lopende opvolger: het bandeinde ervóór', solveAxes(off(running), 'S').ef, '2026-01-07T17:00');
  // (d) Een grens die met werktijd ná de EF ligt (hier: Progress Override, de lopende S negeert P) wordt
  // niet opgelegd: C12 is een kloktijdcorrectie, geen extra relatielogica. Mutant "nul-werktijd-eis weg" ⇒ rood.
  const started = c12Fixture({ sameCalendar: true });
  const s = started.tasks.find(task => task.id === 'S')!;
  s.time.actualStart = '2026-01-05T08:00';
  s.time.completion = 0.5;
  s.time.remainingMinutes = 270;
  started.project.statusDate = '2026-01-05T13:00';
  started.project.progressMode = 'PROGRESS_OVERRIDE';
  eq('C12 legt geen grens met werktijd ertussen op', solveAxes(started, 'S').ef, solveAxes(off(started), 'S').ef);
  // (e) Lagpoort van de vrije-spelingkant: FF+4 u (grens do 16:00, nog steeds in vrije tijd van S, dus EF
  // ma 12 jan 08:00). De C12-kant springt NIET van P's vroege einde naar S' vroege finish (zou 32/9 geven).
  // Sinds brok 9 telt C2 (verbreed: FF met werktijdlag op de voorgangerkalender, niet-gestarte taak) deze
  // relatie zelf: van de grens do 16:00 tot S' vroege finish = 1 + 27 u = 28/9 dag (integratieronde 2).
  // De C12-lagpoort zelf wordt daarom met C2 uit bewaakt: dan volgt de vrije speling de afgeleide
  // startgrens, gelijk aan C12 uit. Mutant "lagpoort weg" ⇒ 32/9 ⇒ rood.
  const lagged = c12Fixture({ lagHours: 4 });
  const c2off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', false));
  eq('C12 FF+4 u: grens nog in vrije tijd van S', solveAxes(lagged, 'S').ef, '2026-01-12T08:00');
  eq('C12 FF+4 u (C2 uit): vrije speling springt niet naar de vroege finish van S', solveAxes(c2off(lagged), 'P').ff, 0);
  eq('C12 FF+4 u (C2 uit): vrije speling gelijk aan C12 uit', solveAxes(c2off(lagged), 'P').ff, solveAxes(off(c2off(lagged)), 'P').ff);
  eq('C12 FF+4 u onder P6: C2 telt vanaf de grens tot de vroege finish van S (28/9)', solveAxes(lagged, 'P').ff, 28 / 9);
  // (f) Lopende opvolger onder Progress Override met de FF-grens in vrije tijd (ongemeten, geen P6-orakel):
  // de lopende tak kent geen PO-poort, dus C12 legt de grens nog steeds op. Restwerk 22 u vanaf ma 13:00
  // eindigt zonder voorgangerdruk op wo 7 jan 17:00; C12 legt de finish op ma 12 jan 08:00. Pint het
  // huidige gedrag; mutant "PO-poort in de lopende tak" ⇒ rood.
  const runningPo = structuredClone(running);
  runningPo.project.progressMode = 'PROGRESS_OVERRIDE';
  runningPo.tasks.find(task => task.id === 'S')!.time.remainingMinutes = 1320;
  eq('C12 lopende opvolger onder Progress Override: grens in vrije tijd wordt opgelegd', solveAxes(runningPo, 'S').ef, '2026-01-12T08:00');
  eq('C12 uit, lopende opvolger onder Progress Override: het bandeinde', solveAxes(off(runningPo), 'S').ef, '2026-01-07T17:00');
  // (g) Voltooiingspoort van de vrije-spelingkant (integratieronde 2, reviewfix brok 8): vanuit een
  // VOLTOOIDE voorganger telt de vrije speling niet tot de vroege finish van de opvolger. P voltooid
  // (werkelijk ma 5 jan 08:00 – do 8 jan 12:00), statusdatum vr 9 jan 08:00. Onder P6 zet A12 de vrije
  // speling van voltooid werk toch op 0 (de poort is daar onzichtbaar); daarom A12 uit: dan volgt ze de
  // afgeleide startgrens (1 dag), gelijk aan C12 uit. Mutant "voltooiingspoort weg" telt tot S' vroege
  // finish ma 12 jan 17:00 (41/9 dag) ⇒ rood.
  const a12off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'preserveActualDatesInBackwardPass', false));
  const donePred = c12Fixture();
  const dp = donePred.tasks.find(task => task.id === 'P')!;
  dp.time.actualStart = '2026-01-05T08:00';
  dp.time.actualFinish = '2026-01-08T12:00';
  dp.time.completion = 1;
  dp.time.remainingMinutes = 0;
  donePred.project.statusDate = '2026-01-09T08:00';
  eq('C12 voltooide FF-voorganger (A12 uit): vrije speling via de afgeleide startgrens', solveAxes(a12off(donePred), 'P').ff, 1);
  eq('C12 voltooide FF-voorganger (A12 uit): gelijk aan C12 uit',
    solveAxes(a12off(donePred), 'P').ff, solveAxes(off(a12off(donePred)), 'P').ff);
  eq('C12 voltooide FF-voorganger onder P6 (A12 aan): vrije speling 0', solveAxes(donePred, 'P').ff, 0);
}

eq('inventaris: één fixture per groep-C-conventie', groupC.map(fixture => fixture.flag), [...GROUP_C]);
for (const fixture of groupC) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt het P6-profiel`, input.project.schedulingProfile?.baseId, 'p6');
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);
  const asRead = resolveConventions(input.project.schedulingProfile);
  if (fixture.p6BuiltInOff) {
    // Zoals gelezen = het P6-profiel zonder afwijking op deze conventie (de per-bestand-A19 blijft) ⇒
    // UIT; `input` draagt de conventie als afwijking aan.
    const asImported = withProfile(input, copy => setConvention(copy, flag, false));
    eq(`${label}: 0. ingebouwd P6-profiel ⇒ ${flag} staat uit`,
      resolveConventions({ baseId: 'p6', id: 'p6', name: '', overrides: {} })[flag], false);
    eq(`${label}: 0b. zoals gelezen draagt geen afwijking op ${flag}`,
      asImported.project.schedulingProfile?.overrides?.[flag], undefined);
    eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ UIT`, pick(solveAxes(asImported, taskId)), fixture.off);
    eq(`${label}: 1b. P6-profiel met ${flag} als afwijking aan ⇒ AAN`, pick(solveAxes(input, taskId)), fixture.on);
  } else {
    eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ AAN`, pick(solveAxes(input, taskId)), fixture.on);
  }
  eq(`${label}: 2. alleen ${flag} uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  const onlyThis = { ...asRead };
  for (const key of GROUP_C) onlyThis[key] = key === flag;
  eq(`${label}: 3. OPS-basis, overige waarden van het bestand, alleen ${flag} aan ⇒ AAN`,
    pick(solveAxes(withConventions(input, 'ops', onlyThis), taskId)), fixture.on);
  for (const baseId of ['ops', 'msproject'] as const) {
    const plain = structuredClone(input);
    plain.project.schedulingProfile = { baseId, id: baseId, name: '', overrides: {} };
    eq(`${label}: 4. ingebouwd profiel ${baseId} ⇒ UIT`, pick(solveAxes(plain, taskId)), fixture.builtInOffByBase?.[baseId] ?? fixture.builtInOff ?? fixture.off);
  }
}

// C6, de max(0)-vloer: een niet-gestarte B (18 h) —FS→ A schuift A's restwerkstart ná de statusdatum,
// naar vr 16 jan 08:00. De lag (18 h) is sinds A's werkelijke start (63 h verstreken) volledig op, dus de
// rest-lag is 0 en S start op A's restwerkstart. Zonder de vloer (−45 h) zou S vóór die restwerkstart
// landen, op de statusdatumgrens wo 14 jan 08:00.
{
  const floor = c6Fixture('2026-01-05 08:00',
    ['%R\tB\tP1\tC1\tPRE\tVoorganger A\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t'],
    ['%R\tR2\tA\tB\tP1\tP1\tPR_FS\t0']);
  eq('C6-vloer fixture: A\'s restwerkstart ligt ná de statusdatum', solveAxes(floor, 'A').es, '2026-01-16T08:00');
  eq('C6-vloer: volledig verstreken lag ⇒ rest-lag 0, S op A\'s restwerkstart', solveAxes(floor, 'S').es, '2026-01-16T08:00');
}

// C4, relatiekant en voortgangsmodus: de opvolger S van het verschoven venster start direct erna
// (di 20 jan 08:00, zonder C4 op de statusdatum); onder Progress Override geldt C4 niet.
{
  const c4 = groupC.find(fixture => fixture.flag === 'p6CompletedOutOfSequenceWindow')!;
  eq('C4 opvolger start ná het verschoven venster', solveAxes(c4.input, 'S').es, '2026-01-20T08:00');
  eq('C4 uit ⇒ opvolger op de statusdatum',
    solveAxes(withProfile(c4.input, copy => setConvention(copy, 'p6CompletedOutOfSequenceWindow', false)), 'S').es,
    '2026-01-15T08:00');
  const override = structuredClone(c4.input);
  override.project.progressMode = 'PROGRESS_OVERRIDE';
  eq('C4 onder Progress Override ⇒ venster op de statusdatum',
    (({ es, ef }) => ({ es, ef }))(solveAxes(override, 'C')), c4.off);
  // Wat C4 NIET raakt (docblok): een FF- of SF-relatie naar de voltooide taak (ankert op haar
  // finish; ongemeten) en een LOE/hammock-voorganger. Met C4 aan blijft het venster dan op de
  // statusdatum, en de late kant van C verandert in geen van de gevallen.
  for (const type of ['FINISH_FINISH', 'START_FINISH'] as const) {
    const variant = structuredClone(c4.input);
    variant.sequences.find(seq => seq.successorId === 'C')!.type = type;
    eq(`C4 raakt geen ${type}-relatie naar de voltooide taak`,
      (({ es, ef }) => ({ es, ef }))(solveAxes(variant, 'C')), c4.off);
  }
  // LOE/hammock: P wordt een hammock die via SS+FF de open taak Q (do 15 – ma 19 jan) overspant,
  // zodat haar eigen einde ná de statusdatum ligt; C4 negeert die relatie toch.
  const hammock = structuredClone(c4.input);
  const hammockP = hammock.tasks.find(task => task.id === 'P')!;
  hammock.tasks.push({ ...structuredClone(hammockP), id: 'Q', wbsCode: 'SPAN', name: 'Overspannen', p6TaskId: 'Q' });
  hammockP.isHammock = true;
  hammock.sequences.push(
    { id: 'H-SS', predecessorId: 'Q', successorId: 'P', type: 'START_START', lagDays: 0 },
    { id: 'H-FF', predecessorId: 'Q', successorId: 'P', type: 'FINISH_FINISH', lagDays: 0 },
  );
  eq('C4 hammock-fixture: de hammock eindigt ná de statusdatum', solveAxes(hammock, 'P').ef, '2026-01-19T17:00');
  eq('C4 raakt geen LOE/hammock-voorganger', (({ es, ef }) => ({ es, ef }))(solveAxes(hammock, 'C')), c4.off);
  // Late kant: met een losse lange taak X die het projecteinde vastlegt (anders schuift het
  // projecteinde mee met S), is de late kant van C met en zonder C4 gelijk.
  const anchored = structuredClone(c4.input);
  const s = anchored.tasks.find(task => task.id === 'S')!;
  anchored.tasks.push({
    ...structuredClone(s), id: 'X', wbsCode: 'LONG', name: 'Lang', p6TaskId: 'X',
    time: { ...structuredClone(s.time), durationMinutes: 180 * 60, remainingMinutes: 180 * 60, scheduleDuration: 20, scheduleFinish: '2026-02-11T17:00' },
  });
  const lateOn = solveAxes(anchored, 'C');
  const lateOff = solveAxes(withProfile(anchored, copy => setConvention(copy, 'p6CompletedOutOfSequenceWindow', false)), 'C');
  eq('C4 laat de late kant ongemoeid', [lateOn.ls, lateOn.lf], [lateOff.ls, lateOff.lf]);
  eq('C4 late kant fixture: X legt het projecteinde vast', solveAxes(anchored, 'X').ef, '2026-02-11T17:00');
}

// C5, voorgangerskant en randgevallen. Een open voorganger P (2 dagen, wo 14 – do 15 jan 17:00) —FS→ D
// legt het punt op zijn RAUWE relatiegrens: FS0 ⇒ do 15 jan 17:00 (niet vr 08:00); FS+4 h ⇒ vr 16 jan
// 12:00; FS+9 h landt exact op een band-eind en blijft vr 16 jan 17:00 (niet ma 19 jan 08:00). De
// opvolger S rekent vanaf het punt: FS0 ⇒ de eerstvolgende werkstart.
{
  const c5 = groupC.find(fixture => fixture.flag === 'p6CompletedPhysicalAtDataDate')!;
  eq('C5 late kant: één punt op de LS van de opvolger',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(c5.input, 'D')), { ls: '2026-01-14T08:00', lf: '2026-01-14T08:00' });
  eq('C5 uit ⇒ late kant op de werkelijke datums (A12)',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(withProfile(c5.input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'D')),
    { ls: '2026-01-05T08:00', lf: '2026-01-06T17:00' });
  const openPred = '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t';
  const point = (lagHours: number) => {
    const input = c5Fixture([openPred], [`%R\tR0\tD\tP\tP1\tP1\tPR_FS\t${lagHours}`]);
    const d = solveAxes(input, 'D');
    return { es: d.es, ef: d.ef, s: solveAxes(input, 'S').es };
  };
  eq('C5 open voorganger FS0 ⇒ punt op zijn rauwe einde', point(0),
    { es: '2026-01-15T17:00', ef: '2026-01-15T17:00', s: '2026-01-16T08:00' });
  eq('C5 open voorganger FS+4 h ⇒ punt na de volle lag', point(4),
    { es: '2026-01-16T12:00', ef: '2026-01-16T12:00', s: '2026-01-16T12:00' });
  eq('C5 lag die op een band-eind landt blijft op dat eind (rand)', point(9),
    { es: '2026-01-16T17:00', ef: '2026-01-16T17:00', s: '2026-01-19T08:00' });
  eq('C5 uit ⇒ werkelijke datums, ook met een open voorganger',
    (({ es, ef }) => ({ es, ef }))(solveAxes(withProfile(c5Fixture([openPred], ['%R\tR0\tD\tP\tP1\tP1\tPR_FS\t0']),
      copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'D')),
    { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' });
  // Poort (docblok): CP_Drtn valt erbuiten (dat is B3), net als suspend/resume en een werkelijk einde
  // ná de statusdatum; zonder A19 (rem_target_link_flag) ook.
  const gated = (mutate: (task: Task, input: ImportResult) => void) => {
    const input = structuredClone(c5.input);
    mutate(input.tasks.find(task => task.id === 'D')!, input);
    return solveAxes(input, 'D').es;
  };
  eq('C5 poort: CP_Drtn doet niet mee', gated(task => { task.p6CompletePctType = 'CP_Drtn'; }), '2026-01-05T08:00');
  eq('C5 poort: suspend/resume doet niet mee', gated(task => { task.p6SuspendResume = true; }), '2026-01-05T08:00');
  eq('C5 poort: werkelijk einde ná de statusdatum doet niet mee',
    gated(task => { task.time.actualFinish = '2026-01-14T09:00'; }), '2026-01-05T08:00');
  eq('C5 poort: zonder A19 geen punt',
    gated((_task, input) => setConvention(input, 'p6UseRemainingStartForProgress', false)), '2026-01-05T08:00');
  // Zonder opvolger: de late kant is het projecteinde (HarbourPointe EC1040/EC1050).
  const lone = c5Fixture();
  lone.sequences = [];
  eq('C5 zonder opvolger ⇒ late kant op het projecteinde',
    (({ ls, lf }) => ({ ls, lf }))(solveAxes(lone, 'D')), { ls: '2026-01-14T17:00', lf: '2026-01-14T17:00' });
}

// C5-vangnet (critreview manifest-etappe 2026-09-23): vervangt het corpusvangnet dat DCP-03 As-Built
// was (216 verslechteringen bij een naïeve brede B07-poort; As-Built is sinds het populatiebesluit
// geen orakel meer). Voltooide taken met werkelijke datums vóór de statusdatum en een ANDER
// targetvenster (wo 7 – do 8 jan), in vormen die niet onder B3 vallen. As-Built zelf kent alleen
// CP_Drtn + DT_FixedDrtn (op TT_Task, mijlpalen en LOE): dat is V1. V2 (CP_Units + DT_FixedDUR2) en V3
// (CP_Units + DT_FixedDrtn) komen in As-Built niet voor; de casus dekt ze bewust, zodat het
// CP_Phys-filter ook tegen CP_Units getoetst is. Onder het P6-profiel houden die hun
// werkelijke datums (ma 5 jan 08:00 – di 6 jan 17:00); alleen de CP_Phys-tegenhanger D schuift naar
// het statusdatumpunt (wo 14 jan 00:00). Mutant "C5-poort zonder CP_Phys-filter"
// (`explainP6CompletedPhysicalPoint` zonder de `completePctType !== 'CP_Phys'`-regel) ⇒ V1–V3 op
// wo 14 jan 00:00 ⇒ rood.
{
  const completed = (id: string, pctType: string, durationType: string) =>
    `%R\t${id}\tP1\tC1\t${id}00\tVoltooid ${pctType}/${durationType}\tTT_Task\t${durationType}\tTK_Complete\t${pctType}\t18\t0\t2026-01-07 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t2026-01-06 17:00`;
  const net = c5Fixture([
    completed('V1', 'CP_Drtn', 'DT_FixedDrtn'),
    completed('V2', 'CP_Units', 'DT_FixedDUR2'),
    completed('V3', 'CP_Units', 'DT_FixedDrtn'),
  ]);
  eq('C5-vangnet fixture draagt het P6-profiel', net.project.schedulingProfile?.baseId, 'p6');
  const actuals = { es: '2026-01-05T08:00', ef: '2026-01-06T17:00' };
  for (const id of ['V1', 'V2', 'V3']) {
    eq(`C5-vangnet: voltooide ${id} (geen CP_Phys) houdt haar werkelijke datums onder P6`,
      (({ es, ef }) => ({ es, ef }))(solveAxes(net, id)), actuals);
  }
  eq('C5-vangnet: de CP_Phys-tegenhanger staat op het statusdatumpunt',
    (({ es, ef }) => ({ es, ef }))(solveAxes(net, 'D')), { es: '2026-01-14T00:00', ef: '2026-01-14T00:00' });
}

// C6, randgevallen: een deels verstreken lag (werkelijk gestart di 13 jan 08:00: 9 h verstreken, 9 h
// over ⇒ wo 14 jan 17:00 ⇒ do 15 jan 08:00); een FS-relatie blijft ongemoeid (C6 geldt alleen voor SS).
{
  const partial = solveAxes(c6Fixture('2026-01-13 08:00'), 'S').es;
  eq('C6 deels verstreken lag ⇒ alleen de rest telt', partial, '2026-01-15T08:00');
  const fs = c6Fixture();
  fs.sequences[0].type = 'FINISH_START';
  eq('C6 raakt geen FS-relatie',
    solveAxes(fs, 'S').es,
    solveAxes(withProfile(fs, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'S').es);
}

// Projectoptie `startToStartLagFrom` — P6 "Calculate Start-to-Start lag from" (Oracle P6 Help 99348),
// de VARIANT van C6, gelezen uit `sched_lag_early_start_flag` (Y ⇒ earlyStart, N ⇒ actualStart). Met de
// hand afgeleid op de C6-fixture (band 08:00–17:00 ma–vr, statusdatum wo 14 jan 00:00, A19 aan):
//  (a) volledig verstreken lag, B —FS→ A duwt A's restwerkstart naar vr 16 jan 08:00. Early Start:
//      S = A's restwerkstart + rest-lag 0 = vr 16 jan 08:00. Actual Start: S = statusdatum + 0 = wo 14
//      jan 00:00 ⇒ de eerste werkstart, wo 14 jan 08:00;
//  (b) deels verstreken (werkelijk gestart di 13 jan 08:00: 9 h verstreken, 9 h rest) mét B. Early
//      Start: vr 16 jan 08:00 + 9 h = vr 16 jan 17:00 ⇒ ma 19 jan 08:00. Actual Start: wo 14 jan
//      00:00 + 9 h werktijd = wo 14 jan 17:00 ⇒ do 15 jan 08:00;
//  (c) zonder B valt A's restwerkstart op de statusdatumgrens: beide varianten gelijk;
//  (d) C6 uit ⇒ de optie is inert (de volle lag vanaf A's vroege start, beide varianten gelijk);
//  (e) spiegel: Actual Start begrenst de lopende voorganger achterwaarts niet (anders onechte
//      negatieve speling, reviewer-tegenvoorbeeld); ongemeten tegen P6, zie docblok.
// Mutanten (2026-09-23, tegen `CPMSolver.inProgressStartLagAnchor` en de lezer): "anker negeert de
// optie" ⇒ rood op (a), (b) en de readerregels; "anker zonder C6-poort" ⇒ rood op (d); "lezer N ⇒
// earlyStart" ⇒ rood op (a) en (b) (en in check-xer-schedule-options.ts).
{
  const B_TASK = '%R\tB\tP1\tC1\tPRE\tVoorganger A\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t';
  const B_REL = '%R\tR2\tA\tB\tP1\tP1\tPR_FS\t0';
  const floorEs = c6Fixture('2026-01-05 08:00', [B_TASK], [B_REL], 'Y');
  const floorAs = c6Fixture('2026-01-05 08:00', [B_TASK], [B_REL], 'N');
  eq('SS-lag-variant: Y ⇒ projectoptie earlyStart, N ⇒ actualStart', [
    floorEs.project.schedulingOptions?.startToStartLagFrom, floorAs.project.schedulingOptions?.startToStartLagFrom,
  ], ['earlyStart', 'actualStart']);
  eq('SS-lag-variant (a): Early Start ⇒ S op A\'s restwerkstart', solveAxes(floorEs, 'S').es, '2026-01-16T08:00');
  eq('SS-lag-variant (a): Actual Start ⇒ S op de statusdatum + rest-lag 0', solveAxes(floorAs, 'S').es, '2026-01-14T08:00');
  eq('SS-lag-variant (a): de voorganger zelf verschuift niet mee', solveAxes(floorAs, 'A').es, '2026-01-16T08:00');
  eq('SS-lag-variant (b): Early Start ⇒ restwerkstart + 9 h rest-lag',
    solveAxes(c6Fixture('2026-01-13 08:00', [B_TASK], [B_REL], 'Y'), 'S').es, '2026-01-19T08:00');
  eq('SS-lag-variant (b): Actual Start ⇒ statusdatum + 9 h rest-lag',
    solveAxes(c6Fixture('2026-01-13 08:00', [B_TASK], [B_REL], 'N'), 'S').es, '2026-01-15T08:00');
  eq('SS-lag-variant (c): restwerkstart op de statusdatumgrens ⇒ beide varianten gelijk',
    [solveAxes(c6Fixture(undefined, [], [], 'Y'), 'S').es, solveAxes(c6Fixture(undefined, [], [], 'N'), 'S').es],
    ['2026-01-14T08:00', '2026-01-14T08:00']);
  const c6Off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false));
  eq('SS-lag-variant (d): C6 uit ⇒ optie inert (volle lag vanaf A\'s vroege start)',
    [solveAxes(c6Off(floorEs), 'S').es, solveAxes(c6Off(floorAs), 'S').es], ['2026-01-20T08:00', '2026-01-20T08:00']);
  for (const baseId of ['ops', 'msproject'] as const) {
    const plain = (input: ImportResult) => withProfile(input, copy => {
      copy.project.schedulingProfile = { baseId, id: baseId, name: '', overrides: {} };
    });
    eq(`SS-lag-variant (d): ingebouwd profiel ${baseId} ⇒ optie inert`,
      solveAxes(plain(floorAs), 'S'), solveAxes(plain(floorEs), 'S'));
  }
  // (e) spiegel achterwaarts: lange opvolger L (S —FS→ L, 180 h) maakt S kritiek. Actual Start: de
  // SS-relatie begrenst de lopende A achterwaarts niet (vóór de fix: A en B tf −2). A (EF ma 19 jan
  // 17:00) en haar voorganger B hangen dan alleen aan het projecteinde (L: wo 11 feb 17:00) ⇒ tf 17
  // werkdagen, niet 0: A drijft S onder Actual Start per definitie niet. S zelf blijft kritiek (tf 0).
  const L_TASK = '%R\tL\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t';
  const L_REL = '%R\tR3\tL\tS\tP1\tP1\tPR_FS\t0';
  const critAs = c6Fixture('2026-01-05 08:00', [B_TASK, L_TASK], [B_REL, L_REL], 'N');
  const critEs = c6Fixture('2026-01-05 08:00', [B_TASK, L_TASK], [B_REL, L_REL], 'Y');
  eq('SS-lag-variant (e): Actual Start ⇒ S kritiek (tf 0)', solveAxes(critAs, 'S').tf, 0);
  eq('SS-lag-variant (e): Actual Start ⇒ lopende A niet door S begrensd (tf 17, geen −2)', solveAxes(critAs, 'A').tf, 17);
  eq('SS-lag-variant (e): Actual Start ⇒ B niet via A door S begrensd (tf 17, geen −2)', solveAxes(critAs, 'B').tf, 17);
  eq('SS-lag-variant (e): Early Start ⇒ A, B, S kritiek (tf 0)',
    ['A', 'B', 'S'].map(id => solveAxes(critEs, id).tf), [0, 0, 0]);
}

// X12 brok 6 — de late kant van de B07-keten (ratchet-schuld 2026-09-23). Band 08:00–17:00 ma–vr,
// statusdatum wo 14 jan 00:00, rem_target_link_flag=Y (A19). Een losse open X van 10 werkdagen (wo 14 –
// di 27 jan 17:00) legt het projecteinde vast.
function lateSideFixture(tasks: string[], relations: string[]): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tLaat-fixture\tC1\t2026-01-14 00:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tX\tP1\tC1\tLANG\tProjecteinde\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-01-14 08:00\t2026-01-27 17:00\t\t',
    ...tasks,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    ...relations,
    '%E',
  ]);
}
const lateSideOf = (input: ImportResult, id: string) => (({ ls, lf }) => ({ ls, lf }))(solveAxes(input, id));

// C5, late kant van een OPEN voorganger (Roads B2911 → OCEC11361, A33 → A65, OCEC10851 —SS→ OCEC10791):
// een voltooide CP_Phys-opvolger met een statusdatumpunt legt gewone backward-druk op haar open
// voorganger. Open P (2 dagen, wo 14 – do 15 jan) —FS0→ voltooide CP_Phys D —FS0→ open S (1 dag).
// S.LS = di 27 jan 08:00 ⇒ D.LS = D.LF = di 27 jan 08:00 ⇒ P.LF = de werkgrens daarvóór, ma 26 jan
// 17:00, P.LS = vr 23 jan 08:00. Zonder deze regel sloeg de backward pass D over en viel P op het
// projecteinde (di 27 jan 17:00 / ma 26 jan 08:00) — in Roads was dat de bron van de schuldcellen
// A15112/B2921/B2922 (hun punt volgt de opvolger-LS). Mutant "C5-opvolger weer overslaan" ⇒ rood.
{
  const input = lateSideFixture([
    '%R\tP\tP1\tC1\tPRED\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t18\t18\t2026-01-14 08:00\t2026-01-15 17:00\t\t',
    '%R\tD\tP1\tC1\tDONE\tVoltooid fysiek\tTT_Task\tDT_FixedDrtn\tTK_Complete\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t2026-01-06 17:00',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-16 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR0\tD\tP\tP1\tP1\tPR_FS\t0', '%R\tR1\tS\tD\tP1\tP1\tPR_FS\t0']);
  eq('C5 late kant fixture: D staat op het punt van haar voorganger', solveAxes(input, 'D').es, '2026-01-15T17:00');
  eq('C5 late kant fixture: het punt volgt de LS van S', lateSideOf(input, 'D'), { ls: '2026-01-27T08:00', lf: '2026-01-27T08:00' });
  eq('C5 late kant: het punt legt backward-druk op de open voorganger', lateSideOf(input, 'P'),
    { ls: '2026-01-23T08:00', lf: '2026-01-26T17:00' });
  eq('C5 uit ⇒ de open voorganger valt op het projecteinde (voltooide opvolger is historie)',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6CompletedPhysicalAtDataDate', false)), 'P'),
    { ls: '2026-01-26T08:00', lf: '2026-01-27T17:00' });
}

// C6, late kant (Roads OCEC10311 —SS+70 h→ OCEC10851; de tf-schuldcellen OCEC11741 e.a.): ook
// achterwaarts telt van de SS-lag uit een LOPENDE voorganger alleen de rest-lag. Lopende A (werkelijk
// gestart ma 5 jan 08:00, 18 h rest = de geplande duur, zoals OCEC10311: 140 h / 140 h) —SS+18 h→ open S
// (3 dagen). S.LF = di 27 jan 17:00, S.LS = vr
// 23 jan 08:00. De lag is op de statusdatum verstreken (63 h ≥ 18 h) ⇒ A.LS = vr 23 jan 08:00, A.LF =
// ma 26 jan 17:00. Zonder de late kant trok de volle lag A 18 h naar voren (wo 21 jan 08:00 / do 22 jan
// 17:00) terwijl de vroege kant de lag al kwijt was: 18 h te veel totale speling. Mutant "C6 alleen
// voorwaarts" ⇒ rood.
{
  const input = lateSideFixture([
    '%R\tA\tP1\tC1\tRUN\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t18\t18\t2026-01-05 08:00\t2026-01-15 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t27\t27\t2026-01-14 08:00\t2026-01-16 17:00\t\t',
  ], ['%R\tR1\tS\tA\tP1\tP1\tPR_SS\t18']);
  eq('C6 late kant fixture: S op A\'s restwerkstart', solveAxes(input, 'S').es, '2026-01-14T08:00');
  eq('C6 late kant fixture: S op het projecteinde', lateSideOf(input, 'S'), { ls: '2026-01-23T08:00', lf: '2026-01-27T17:00' });
  eq('C6 late kant: verstreken SS-lag telt ook achterwaarts niet', lateSideOf(input, 'A'),
    { ls: '2026-01-23T08:00', lf: '2026-01-26T17:00' });
  eq('C6 uit ⇒ de volle lag, voorwaarts én achterwaarts',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'A'),
    { ls: '2026-01-21T08:00', lf: '2026-01-22T17:00' });
  const fs = structuredClone(input);
  fs.sequences[0].type = 'FINISH_START';
  eq('C6 late kant raakt geen FS-relatie', lateSideOf(fs, 'A'),
    lateSideOf(withProfile(fs, copy => setConvention(copy, 'p6InProgressStartLagElapsed', false)), 'A'));
}

// A19, late kant (X12 brok 6; Roads OCEC11731 —SS+70 h→ OCEC12121). Band 08:00–17:00 ma–vr,
// statusdatum wo 14 jan 00:00, rem_target_link_flag=Y. Lopende A (CP_Phys 50 %, 18 u gepland, rest 0)
// —SS+0→ open S (1 dag); een losse X (10 werkdagen, wo 14 – di 27 jan) legt het projecteinde vast.
// S.LS = di 27 jan 08:00. P6: A is achterwaarts een nulduur, LS = LF = di 27 jan 08:00. Zonder de regel
// telt de SS-grens de volle 18 u erbij, dus kapt het projecteinde af: A.LF = di 27 jan 17:00. Mutant
// "rest-0-tak weg" ⇒ rood; zonder A19 (per bestand) geen effect.
{
  const input = lateSideFixture([
    '%R\tA\tP1\tC1\tRUN\tLopend fysiek\tTT_Task\tDT_FixedDrtn\tTK_Active\tCP_Phys\t18\t0\t2026-01-05 08:00\t2026-01-06 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-14 08:00\t2026-01-14 17:00\t\t',
  ], ['%R\tR1\tS\tA\tP1\tP1\tPR_SS\t0']);
  input.tasks.find(task => task.id === 'A')!.time.completion = 0.5;
  eq('A19-laat fixture: A is lopend met rest 0', (({ completion, remainingMinutes }) => ({ completion, remainingMinutes }))(input.tasks.find(task => task.id === 'A')!.time), { completion: 0.5, remainingMinutes: 0 });
  eq('A19-laat fixture: S.LS di 27 jan 08:00', lateSideOf(input, 'S').ls, '2026-01-27T08:00');
  eq('A19-laat: lopende taak met rest 0 is achterwaarts een nulduur', lateSideOf(input, 'A'), { ls: '2026-01-27T08:00', lf: '2026-01-27T08:00' });
  eq('A19 uit ⇒ geen effect van deze regel op de late finish',
    lateSideOf(withProfile(input, copy => setConvention(copy, 'p6UseRemainingStartForProgress', false)), 'A').lf, '2026-01-27T17:00');
}

// C7, randgevallen (docblok): de startmijlpaal zelf staat met en zonder C7 gelijk (ES do 8 jan door
// Y), en een FF-relatie naar een EINDmijlpaal (`TT_FinMile`, 34× in het corpus, nu exact) verandert
// op geen enkele as van geen enkele taak.
{
  const c7 = groupC.find(fixture => fixture.flag === 'p6FinishFinishStartMilestoneLateFinish')!;
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishFinishStartMilestoneLateFinish', false));
  eq('C7 fixture: Y zet de startmijlpaal op do 8 jan', solveAxes(c7.input, 'M').es, '2026-01-08T08:00');
  eq('C7 laat de startmijlpaal zelf ongemoeid', solveAxes(c7.input, 'M'), solveAxes(off(c7.input), 'M'));
  const finMile = c7Fixture('TT_FinMile');
  eq('C7 fixture: de eindmijlpaal is een FINISH-mijlpaal', finMile.tasks.find(task => task.id === 'M')?.milestoneKind, 'FINISH');
  eq('C7 raakt geen FF-relatie naar een eindmijlpaal (alle assen, alle taken)', solveAllAxes(finMile), solveAllAxes(off(finMile)));
}

// C7, drijvend geval (fixronde critreview): zonder Y is de FF van A de bindende relatie van M. P6-orakel
// ontbreekt in het corpus, dus C7 mag de voorwaartse pass hier niet raken: M.es blijft de gewone
// grens (wo 7 jan 08:00, beide snaps van `forwardHour`), en de vroege datums van alle taken zijn met
// en zonder C7 gelijk. Mutant "C7-grens ook voor de bindende relatie" ⇒ M.es di 6 jan ⇒ rood.
{
  const floating = c7Fixture('TT_Mile', false);
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6FinishFinishStartMilestoneLateFinish', false));
  eq('C7 drijvend: M.es blijft wo 7 jan 08:00', solveAxes(floating, 'M').es, '2026-01-07T08:00');
  const early = (input: ImportResult) => Object.fromEntries(['A', 'M', 'Z', 'X'].map(id => {
    const axes = solveAxes(input, id);
    return [id, { es: axes.es, ef: axes.ef }];
  }));
  eq('C7 drijvend: vroege datums van alle taken ongewijzigd', early(floating), early(off(floating)));
  eq('C7 drijvend: de bindende FF blijft driving (ff A = 0)', solveAxes(floating, 'A').ff, solveAxes(off(floating), 'A').ff);
}

// C8, relatiekant en randgeval (docblok): de opvolger volgt het restwerk (do 15 jan 08:00, zonder C8
// wo 21 jan); een NIET-gestarte taak houdt de vloer van A16 — met en zonder C8 gelijk op alle assen.
{
  const c8 = groupC.find(fixture => fixture.flag === 'p6StartedTaskIgnoresPlannedStartFloor')!;
  const off = (input: ImportResult) => withProfile(input, copy => setConvention(copy, 'p6StartedTaskIgnoresPlannedStartFloor', false));
  eq('C8 opvolger volgt het restwerk', solveAxes(c8.input, 'S').es, '2026-01-15T08:00');
  eq('C8 uit ⇒ opvolger ná het geplande venster', solveAxes(off(c8.input), 'S').es, '2026-01-21T08:00');
  const unstarted = c8Fixture(false);
  eq('C8 fixture: niet-gestarte taak staat op de vloer van A16', solveAxes(unstarted, 'T').es, '2026-01-19T08:00');
  eq('C8 raakt geen niet-gestarte taak', solveAllAxes(unstarted), solveAllAxes(off(unstarted)));
}

// ── Groep C: randgevallen (critreview brok 2) ────────────────────────────────────────────────────
// Elk geval pint een bewering uit het docblok die de aan/uit-fixtures hierboven niet onderscheiden.
// Verwachtingen volgen uit de regel, met de werkdagen uitgeteld in het commentaar.

/** C3-variant: de B3-route (rem_target_link_flag=Y), band 08:00–17:00 ma–vr, statusdatum wo 14 jan
 *  17:00, projecteinde via losse X op wo 11 feb 17:00 (dus S.LS = wo 11 feb 08:00). */
function c3Variant(actStart: string, actEnd: string, lagHours: number): ImportResult {
  return importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    '%R\tP1\tC3-variant\tC1\t2026-01-14 17:00\t2026-01-05 08:00\t2026-03-31 17:00\tY',
    '%T\tSCHEDOPTIONS',
    '%F\tproj_id\tsched_use_project_end_date_for_float',
    '%R\tP1\tN',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    `%R\tC\tP1\tC1\tDONE\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t${actStart}\t${actEnd}\t${actStart}\t${actEnd}`,
    '%R\tS\tP1\tC1\tSUCC\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-15 08:00\t2026-01-15 17:00\t\t',
    '%R\tX\tP1\tC1\tLONG\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t180\t180\t2026-01-15 08:00\t2026-02-11 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tC\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
}
const lateOf = (input: ImportResult, id: string) => {
  const axes = solveAxes(input, id);
  return { ls: axes.ls, lf: axes.lf };
};
{
  // C3 DEELS verstreken: einde ma 5 jan 17:00, statusdatum wo 14 jan 17:00 ⇒ 7 werkdagen (63 u)
  // verstreken; lag 81 u (9 werkdagen) ⇒ rest 18 u = 2 werkdagen. C.LS = wo 11 feb 08:00 − 2
  // werkdagen = ma 9 feb 08:00, LF = vr 6 feb 17:00. Volle lag (C3 uit): 9 werkdagen terug =
  // do 29 jan 08:00, LF wo 28 jan 17:00. Mutant "alle lag weg" gaf wo 11 feb.
  const partial = c3Variant('2026-01-05 08:00', '2026-01-05 17:00', 81);
  eq('C3 deels verstreken: alleen de rest-lag (18 u) telt', lateOf(partial, 'C'),
    { ls: '2026-02-09T08:00', lf: '2026-02-06T17:00' });
  eq('C3 deels verstreken, C3 uit: de volle lag (81 u)',
    lateOf(withProfile(partial, copy => setConvention(copy, 'p6CompletedRemainingLag', false)), 'C'),
    { ls: '2026-01-29T08:00', lf: '2026-01-28T17:00' });
  // C3 NIET verstreken: einde wo 14 jan 17:00 = de statusdatum ⇒ 0 u verstreken ⇒ de volle 45 u
  // (5 werkdagen): LS wo 4 feb 08:00, LF di 3 feb 17:00 — met én zonder C3.
  const fresh = c3Variant('2026-01-14 08:00', '2026-01-14 17:00', 45);
  eq('C3 niet verstreken: de volle lag blijft', lateOf(fresh, 'C'), { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' });
  eq('C3 niet verstreken, C3 uit: identiek',
    lateOf(withProfile(fresh, copy => setConvention(copy, 'p6CompletedRemainingLag', false)), 'C'),
    { ls: '2026-02-04T08:00', lf: '2026-02-03T17:00' });
}
{
  // C1 met SS-opvolger: A voltooid, werkelijke START wo 7 jan 10:00 én einde wo 17:00, allebei ná de
  // statusdatum (wo 7 jan 00:00). C1 begrenst alleen het EINDE; SS rekent op de start en blijft dus
  // ongemoeid: B (SS+0) begint op A's werkelijke start, wo 10:00 — niet op de statusdatum (wo 08:00).
  const ss = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC1-SS\tC1\t2026-01-07 00:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    // Geplande start ma 5 jan: anders legt A's eigen planning (de enige wortel) de projectstartvloer
    // op wo 10:00 en is de SS-grens niet meer waarneembaar.
    '%R\tA\tP1\tC1\tA100\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t7\t0\t2026-01-05 08:00\t2026-01-05 16:00\t2026-01-07 10:00\t2026-01-07 17:00',
    '%R\tB\tP1\tC1\tB100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-07 08:00\t2026-01-07 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tB\tA\tP1\tP1\tPR_SS\t0',
    '%E',
  ]);
  eq('C1 met SS-opvolger: de start wordt niet begrensd (B.ES = A\'s werkelijke start)',
    solveAxes(ss, 'B').es, '2026-01-07T10:00');
}
{
  // C2 zonder de vroegere deeltak "voltooide opvolger ⇒ ff = 0" (verwijderd 2026-09-23: alleen in
  // rehab-2 = P3-uitvoer gemeten, 0 cellen effect op de P6-populatie). Open T (1 dag vanaf ma 5 jan)
  // —FS+0→ open S en —FS+0→ voltooide K (buiten volgorde, 2 jan). S wacht ook op X (5 dagen) en
  // begint ma 12 jan 08:00, dus via S heeft T 4 werkdagen speling. K levert geen grens
  // (`preserveActualDatesInBackwardPass` wist die), met én zonder C2 ⇒ ff 4. Komt de deeltak terug,
  // dan wordt de eerste regel rood (ff 0).
  const withDone = importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-voltooid\tC1\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tT\tP1\tC1\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-05 08:00\t2026-01-05 17:00\t\t',
    '%R\tX\tP1\tC1\tX100\tLang\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-01-05 08:00\t2026-01-09 17:00\t\t',
    '%R\tS\tP1\tC1\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%R\tK\tP1\tC1\tK100\tAl voltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t9\t0\t2026-01-02 08:00\t2026-01-02 17:00\t2026-01-02 08:00\t2026-01-02 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\tS\tT\tP1\tP1\tPR_FS\t0',
    '%R\tR2\tS\tX\tP1\tP1\tPR_FS\t0',
    '%R\tR3\tK\tT\tP1\tP1\tPR_FS\t0',
    '%E',
  ]);
  eq('C2 aan, voltooide opvolger: geen deeltak meer, ff via S = 4 werkdagen', solveAxes(withDone, 'T').ff, 4);
  eq('C2 uit: de voltooide opvolger telt niet, ff via S = 4 werkdagen',
    solveAxes(withProfile(withDone, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', false)), 'T').ff, 4);
}

{
  // C2-grenzen (critreview her-check, M8/M9). Opbouw als de C2-fixture: T op ma–vr, S op ma–do.
  // Op T's eigen kalender ligt vr 9 jan tussen T en S (1 dag), op die van S niets (0).
  const c2Variant = (tRow: string, lagHours: number, statusDate: string) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    `%R\tP1\tC2-grens\tC5\t${statusDate}\t2026-01-05 08:00\t2026-01-30 17:00`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    tRow,
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
  const ffOf = (input: ImportResult, on: boolean, a12 = true) =>
    solveAxes(withProfile(input, copy => {
      setConvention(copy, 'p6FreeFloatOnOwnCalendar', on);
      setConvention(copy, 'preserveActualDatesInBackwardPass', a12);
    }), 'T').ff;
  // M8: een VOLTOOIDE T (werkelijk ma 5 – do 8 jan 17:00, statusdatum do 8 jan 17:00) valt buiten C2:
  // met en zonder C2 dezelfde vrije speling (de bestaande berekening, op de kalender van S). A12
  // (`preserveActualDatesInBackwardPass`) staat hier UIT: met A12 aan zet P6 de ff van elke
  // voltooide taak toch op 0 en is de grens onzichtbaar (daarom ving het corpus M8 niet).
  const done = c2Variant(
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t36\t0\t2026-01-05 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t2026-01-08 17:00',
    0, '2026-01-08 17:00');
  eq('C2 geldt niet voor een voltooide taak (A12 uit): ff met C2 = ff zonder C2', ffOf(done, true, false), ffOf(done, false, false));
  // M9 (brok 9: C2 verbreed naar elke lag, `docs/superpowers/plans/2026-09-24-x12-hotel-ff-60min.md`):
  // FS+4 u. De grens ligt op T's eigen kalender (= de lagkalender, voorganger) op vr 9 jan 12:00; S
  // (ma–do) begint ma 12 jan 08:00. Eigen kalender: vr 12:00–17:00 = 5 u = 5/9 dag; op de kalender van
  // S ligt er niets tussen ⇒ 0.
  const lagged = c2Variant(
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t36\t36\t2026-01-05 08:00\t2026-01-08 17:00\t\t',
    4, '2026-01-05 08:00');
  eq('C2 verbreed, FS+4 u: ff = vr 12:00–17:00 op de eigen kalender = 5/9 dag', ffOf(lagged, true), 300 / 540);
  eq('C2 uit, FS+4 u: ff op de kalender van S = 0', ffOf(lagged, false), 0);
}

{
  // C2 verbreed (X12 brok 9, Hotel ff 60 min): de relatie-vrije-speling telt voor ALLE relatietypes en
  // elke lag op de eigen kalender van de taak, van de ongesnapte relatiegrens (anker + lag) tot de vroege
  // opvolgerdatum (ES bij FS/SS, EF bij FF/SF). Opbouw naar Hotel (kal. 3196 tegen 3195): T op K17 (alle
  // zeven dagen 08:00–17:00, 9 u), S op K16 (alle zeven dagen 08:00–16:00, 8 u). De grens valt in het uur
  // 16:00–17:00: werktijd voor T, vrij voor S, dus S begint pas de volgende ochtend.
  const hotel = (rows: { t: string; s: string; x?: string; rel: string; xrel?: string; sCal?: string; lagCal?: string }) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tK17\tTot vijf\tP1\tCA_Project\t9\t63\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '17:00']])}`,
    `%R\tK16\tTot vier\tP1\tCA_Project\t8\t56\t${calendarDataOn([1, 2, 3, 4, 5, 6, 7], [['08:00', '16:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-breed\tK17\t2026-01-05 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    ...(rows.lagCal ? ['%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_calendar_on_relationship_lag', `%R\tP1\t${rows.lagCal}`] : []),
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    `%R\tT\tP1\tK17\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.t}`,
    `%R\tS\tP1\t${rows.sCal ?? 'K16'}\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.s}`,
    ...(rows.x ? [`%R\tX\tP1\tK16\tX100\tDrijver\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t${rows.x}`] : []),
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\t${rows.rel}`,
    ...(rows.xrel ? [`%R\tR2\tS\tX\tP1\tP1\t${rows.xrel}`] : []),
    '%E',
  ]);
  const ffWith = (input: ImportResult, on: boolean) =>
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', on)), 'T').ff;

  // SS+8 u (HEPSS00020-vorm): T start ma 5 jan 08:00; grens = 08:00 + 8 u = ma 16:00 op K17. S kan op
  // K16 pas di 6 jan 08:00 beginnen. Eigen kalender: ma 16:00–17:00 = 60 min = 1/9 dag; op K16 niets.
  const ssLag = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-06 08:00\t2026-01-06 16:00', rel: 'PR_SS\t8' });
  eq('C2 verbreed, SS+8 u: ff = ma 16:00–17:00 op de eigen kalender = 60 min', ffWith(ssLag, true), 60 / 540);
  eq('C2 uit, SS+8 u: ff op de opvolgerkalender = 0', ffWith(ssLag, false), 0);

  // FF+1 u (HCSWB2Z2240-vorm, zonder C12-afhankelijkheid): T (34 u) eindigt do 8 jan 15:00; grens = do
  // 16:00 op K17. S (4 u) wacht op X (FS, 32 u, t/m do 8 jan 16:00) en loopt vr 9 jan 08:00–12:00, dus
  // haar vroege EF is vr 12:00. Eigen kalender: do 16:00–17:00 + vr 08:00–12:00 = 5 u = 5/9 dag. Zonder
  // C2 (opvolgerkalender, via de afgeleide startgrens do 16:00 − 4 u = do 12:00 op K16, tot S.ES vr
  // 08:00): 4 u van 8 = 0,5 dag — het uur do 16:00–17:00 telt daar niet.
  const ffLag = hotel({
    t: '34\t34\t2026-01-05 08:00\t2026-01-08 15:00', s: '4\t4\t2026-01-09 08:00\t2026-01-09 12:00',
    x: '32\t32\t2026-01-05 08:00\t2026-01-08 16:00', rel: 'PR_FF\t1', xrel: 'PR_FS\t0',
  });
  eq('FF+1 u-fixture: S loopt vr 9 jan 08:00–12:00', [solveAxes(ffLag, 'S').es, solveAxes(ffLag, 'S').ef], ['2026-01-09T08:00', '2026-01-09T12:00']);
  eq('C2 verbreed, FF+1 u: ff = do 16:00 → vr 12:00 op de eigen kalender = 5/9 dag', ffWith(ffLag, true), 300 / 540);
  eq('C2 uit, FF+1 u: ff op de opvolgerkalender = 0,5 dag', ffWith(ffLag, false), 0.5);

  // Gemengde kalenders als voorwaarde: S op T's eigen kalender (K17) ⇒ SS+8 u begint S ma 16:00 zelf en
  // is er met en zonder C2 niets te winnen (ff 0).
  const sameCal = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-05 16:00\t2026-01-06 15:00', rel: 'PR_SS\t8', sCal: 'K17' });
  eq('C2 verbreed, zelfde kalender: ff met C2 = ff zonder C2 = 0', [ffWith(sameCal, true), ffWith(sameCal, false)], [0, 0]);

  // Uitsluitingen (ongemeten, docblok C2): ELAPSEDTIME-lag, procentlag en een lagkalender die niet de
  // voorganger is houden de bestaande berekening ⇒ ff met C2 = ff zonder C2.
  const elapsed = withProfile(ssLag, copy => { for (const q of copy.sequences) q.lagUnit = 'ELAPSEDTIME'; });
  eq('C2 niet bij een ELAPSEDTIME-lag: ff met C2 = ff zonder C2', ffWith(elapsed, true), ffWith(elapsed, false));
  const percent = withProfile(ssLag, copy => { for (const q of copy.sequences) { q.lagPercent = 25; q.lagMinutes = undefined; q.lagDays = 0; } });
  eq('C2 niet bij een procentlag: ff met C2 = ff zonder C2', ffWith(percent, true), ffWith(percent, false));
  const succLagCal = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-06 08:00\t2026-01-06 16:00', rel: 'PR_SS\t8', lagCal: 'rcal_Successor' });
  eq('lagkalender = opvolger zit in de fixture', solveOptionsFor(succLagCal.project).schedulingOptions.lagCalendar, 'successor');
  eq('C2 niet bij een lag op de opvolgerkalender: ff met C2 = ff zonder C2', ffWith(succLagCal, true), ffWith(succLagCal, false));

  // Fixronde brok 9. Lag 0 onder `rcal_Successor` (M10): zonder lag doet de lagkalender er niet toe, dus
  // C2 geldt wel. T (35,5 u) eindigt do 8 jan 16:30 op K17; S (K16) begint vr 08:00. Eigen kalender:
  // do 16:30–17:00 = 30 min; op K16 niets.
  const lag0SuccCal = hotel({ t: '35.5\t35.5\t2026-01-05 08:00\t2026-01-08 16:30', s: '8\t8\t2026-01-09 08:00\t2026-01-09 16:00', rel: 'PR_FS\t0', lagCal: 'rcal_Successor' });
  eq('lag 0 onder rcal_Successor: C2 geldt, ff = 30 min op de eigen kalender', [ffWith(lag0SuccCal, true), ffWith(lag0SuccCal, false)], [30 / 540, 0]);
  // Het lagDays-pad (M8): een lag zonder `lagMinutes` telt via `lagDays × uren/dag` van de eigen kalender.
  // SS 8/9 dag op K17 = 8 u ⇒ dezelfde grens ma 16:00 als de SS+8 u-fixture ⇒ ff 60 min.
  const ssLagDays = withProfile(ssLag, copy => { for (const q of copy.sequences) { q.lagMinutes = undefined; q.lagDays = 8 / 9; } });
  eq('C2 verbreed, SS-lag via lagDays (8/9 dag): ff = 60 min op de eigen kalender', ffWith(ssLagDays, true), 60 / 540);
  // Negatieve lag: gekozen gedrag = de eigen-kalenderregel (EXTRAPOLATIE via Boyle, niet gemeten in het
  // corpus). FS −1 u: T eindigt do 8 jan 17:00; grens do 16:00 op K17; S (K16) begint vr 08:00. Eigen
  // kalender: do 16:00–17:00 = 60 min.
  const negLag = hotel({ t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '8\t8\t2026-01-09 08:00\t2026-01-09 16:00', rel: 'PR_FS\t-1' });
  eq('C2 verbreed, FS −1 u (extrapolatie): ff = do 16:00–17:00 op de eigen kalender = 60 min', ffWith(negLag, true), 60 / 540);
  // SF valt buiten C2 (ongemeten, fixronde brok 9). SF +8 u: grens ma 16:00 op K17. S (1 u, K16) wacht op
  // X (FS0, 9 u op K16, t/m di 09:00) en loopt di 09:00–10:00. De eigen-kalenderformule zou ma 16:00 →
  // di 10:00 = 3 u = 1/3 dag geven; met SF buiten C2 blijft de opvolgerkalenderwaarde staan.
  const sfLag = hotel({
    t: '36\t36\t2026-01-05 08:00\t2026-01-08 17:00', s: '1\t1\t2026-01-06 09:00\t2026-01-06 10:00',
    x: '9\t9\t2026-01-05 08:00\t2026-01-06 09:00', rel: 'PR_SF\t8', xrel: 'PR_FS\t0',
  });
  eq('SF-fixture: S loopt di 6 jan 09:00–10:00', [solveAxes(sfLag, 'S').es, solveAxes(sfLag, 'S').ef], ['2026-01-06T09:00', '2026-01-06T10:00']);
  eq('C2 niet bij SF: ff met C2 = ff zonder C2 ≠ 1/3 dag (eigen-kalenderformule)', [ffWith(sfLag, true) === ffWith(sfLag, false), ffWith(sfLag, true) === 3 / 9], [true, false]);
}

{
  // Gestarte taken (fixronde brok 9): de verbreding geldt alleen voor NIET-GESTARTE taken; een gestarte,
  // niet-voltooide taak houdt het oude C2 (alleen FS met lag 0). Opbouw als de C2-grens-fixture (T ma–vr,
  // S ma–do); T gestart ma 5 jan 08:00, 9 u gedaan, statusdatum di 6 jan 08:00, rest 27 u t/m do 17:00.
  const started = (lagHours: number) => importXer([
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC5\tVijfdaags\tP1\tCA_Project\t9\t45\t${calendarData([['08:00', '17:00']])}`,
    `%R\tC4\tVierdaags\tP1\tCA_Project\t9\t36\t${calendarDataOn([2, 3, 4, 5], [['08:00', '17:00']])}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
    '%R\tP1\tC2-gestart\tC5\t2026-01-06 08:00\t2026-01-05 08:00\t2026-01-30 17:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tT\tP1\tC5\tT100\tTaak\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t36\t27\t2026-01-05 08:00\t2026-01-08 17:00\t2026-01-05 08:00\t',
    '%R\tS\tP1\tC4\tS100\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t9\t9\t2026-01-12 08:00\t2026-01-12 17:00\t\t',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    `%R\tR1\tS\tT\tP1\tP1\tPR_FS\t${lagHours}`,
    '%E',
  ]);
  const ffS = (input: ImportResult, on: boolean) =>
    solveAxes(withProfile(input, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', on)), 'T').ff;
  eq('gestarte taak, FS0: oude C2 blijft, ff = vr 9 jan op de eigen kalender = 1 dag', [ffS(started(0), true), ffS(started(0), false)], [1, 0]);
  eq('gestarte taak, FS+4 u: buiten de verbreding, ff met C2 = ff zonder C2', ffS(started(4), true), ffS(started(4), false));
}

if (diffs.length > 0) {
  console.error(`conventions-p6-flags RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`OK  conventions-p6-flags: ${checks} checks groen (5 groep-B- en ${GROUP_C.length} groep-C-conventies, aan/uit + bron- en basisinertheid)`);
