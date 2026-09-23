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
// C3 `p6CompletedRemainingLag` ──
// Zelfde bewijsvorm, per conventie: zoals gelezen (P6-profiel) ⇒ AAN; alleen deze conventie uit ⇒
// UIT; OPS-basis met alleen deze conventie aan ⇒ AAN; OPS- en MS Project-profiel ⇒ UIT. De
// verwachtingen volgen uit de regel (docblok in `types/project.ts`), niet uit de implementatie.
const GROUP_C = ['p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag'] as const satisfies readonly ConventionKey[];

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
}
const groupC: GroupCFixture[] = [];

// C1: band 08:00–17:00 ma–vr. Statusdatum wo 7 jan 00:00. Voltooide A met werkelijk einde wo 7 jan
// 17:00 (ná de statusdatum). P6: de opvolger B (FS+0, niet gestart) begint op de statusdatum, wo
// 08:00; generiek pas ná het werkelijke einde, do 08:00.
groupC.push({
  flag: 'p6CompletedPredecessorAtDataDate',
  label: 'C1 voltooide voorganger met einde ná de statusdatum',
  input: importXer([
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
  ]),
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

eq('inventaris: één fixture per groep-C-conventie', groupC.map(fixture => fixture.flag), [...GROUP_C]);
for (const fixture of groupC) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt het P6-profiel`, input.project.schedulingProfile?.baseId, 'p6');
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);
  const asRead = resolveConventions(input.project.schedulingProfile);
  eq(`${label}: 1. XER-import zoals gelezen (P6-profiel) ⇒ AAN`, pick(solveAxes(input, taskId)), fixture.on);
  eq(`${label}: 2. alleen ${flag} uit ⇒ UIT`,
    pick(solveAxes(withProfile(input, copy => setConvention(copy, flag, false)), taskId)), fixture.off);
  const onlyThis = { ...asRead };
  for (const key of GROUP_C) onlyThis[key] = key === flag;
  eq(`${label}: 3. OPS-basis, overige waarden van het bestand, alleen ${flag} aan ⇒ AAN`,
    pick(solveAxes(withConventions(input, 'ops', onlyThis), taskId)), fixture.on);
  for (const baseId of ['ops', 'msproject'] as const) {
    const plain = structuredClone(input);
    plain.project.schedulingProfile = { baseId, id: baseId, name: '', overrides: {} };
    eq(`${label}: 4. ingebouwd profiel ${baseId} ⇒ UIT`, pick(solveAxes(plain, taskId)), fixture.builtInOff ?? fixture.off);
  }
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
  // C2, tak "voltooide opvolger": open T (1 dag vanaf ma 5 jan) —FS+0→ open S en —FS+0→ voltooide K
  // (buiten volgorde, 2 jan). S wacht ook op X (5 dagen) en begint ma 12 jan 08:00, dus via S heeft
  // T 4 werkdagen speling. P6 (C2): K laat geen speling ⇒ ff 0. Zonder C2 levert K niets
  // (`preserveActualDatesInBackwardPass` wist die grens) ⇒ ff 4.
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
  eq('C2 voltooide opvolger: ff 0', solveAxes(withDone, 'T').ff, 0);
  eq('C2 uit: de voltooide opvolger telt niet, ff via S = 4 werkdagen',
    solveAxes(withProfile(withDone, copy => setConvention(copy, 'p6FreeFloatOnOwnCalendar', false)), 'T').ff, 4);
}

if (diffs.length > 0) {
  console.error(`conventions-p6-flags RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`OK  conventions-p6-flags: ${checks} checks groen (5 groep-B- en 3 groep-C-conventies, aan/uit + bron- en basisinertheid)`);
