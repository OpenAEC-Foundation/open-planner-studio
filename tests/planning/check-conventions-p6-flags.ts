// Rekenprofielen baan B — de vijf groep-B-conventies (spec 2026-09-22, §3.5 punt 4, bijlage A).
//
// Tot baan B stonden deze vijf P6-rekenregels uitsluitend achter de XER-bronmarkering van het
// project (`schedulingOptions.p6Source === 'XER'`). Nu is elk een eigen vlag in
// `SchedulingOptions`, en leest de motor de bronmarkering nergens meer; alleen de TIJDELIJKE
// vertaling `engine/scheduler/conventions/legacyP6Source.ts` zet de vijf vlaggen nog aan voor een
// XER-project dat ze niet expliciet zet.
//
// Wat deze check bewijst, per conventie, op een kleine synthetische XER-fixture waarvan de
// P6-uitkomst vooraf uit de regel zelf volgt (niet uit de implementatie afgelezen):
//   1. XER-import zoals gelezen (vertaling aan)                   ⇒ de P6-uitkomst (AAN);
//   2. dezelfde import met ALLEEN deze vlag expliciet `false`     ⇒ de generieke uitkomst (UIT) —
//      de negatieve arm: een expliciete `false` wint van de vertaling;
//   3. bron weg, testhaak uit, ALLEEN deze vlag `true`            ⇒ AAN — de vlag schakelt, niet de bron;
//   4. bron weg, vertaling aan, vlag afwezig                      ⇒ UIT;
//   5. bron blijft, testhaak uit, vlag expliciet `true`           ⇒ AAN;
//   6. bron blijft, testhaak uit, vlag afwezig                    ⇒ UIT — de bron alleen doet niets.
// (Arm 3 draait met de testhaak uit omdat de vertaling zonder bron A15–A20 uitzet, zoals vóór
// baan B; B3/B4 hebben A18/A19 nodig. Zie de sectie "vertaling zonder bron" hieronder.)
// Daarna, over alle vijf fixtures: met de testhaak uit is een project MÉT bronmarkering zesassig
// identiek aan hetzelfde project ZONDER. Verder: de guardvolgorde van de redencodes, en een
// bronscan dat `p6Source` onder `src/engine/` alleen nog in de tijdelijke vertaling staat.
//
// MUTATIEBEWIJS (2026-09-22, 26 mutanten, elk afzonderlijk toegepast op src/engine ⇒ deze check
// exit 1; tussen haakjes de eerste rode regel):
//   B1 altijd strippen / nooit strippen        ⇒ rood (B1 arm 1 / arm 2)
//   B2 `if (false` / `if (true`                ⇒ rood (B2 arm 1 / arm 2)
//   B3 guard altijd open / altijd dicht        ⇒ rood (B3 arm 2 / arm 1)
//   B4 guard altijd open / altijd dicht        ⇒ rood (B4 arm 2 / arm 1)
//   B5 beide poorten open                      ⇒ rood (B5 arm 2)
//   B5 guard dicht / alleen solverpoort dicht  ⇒ rood (B5 arm 1)
//   `p6Source === 'XER'` terug naast B1…B5 (elk apart) ⇒ rood (o.a. arm 2)
//   A17-poort `so?.p6Source === 'XER' &&` terug in scheduleAnalysis ⇒ rood (bronscan)
//   vertaling negeert een expliciete false    ⇒ rood (arm 2 van B1–B5)
//   vertaling negeert de testhaak             ⇒ rood (o.a. arm 6)
//   vertaling zet A15–A20 zonder bron niet uit ⇒ rood ("vertaling zonder bron")
//   guardvolgorde: B3 vóór dataDate / B3 ná A19 / B4 vóór de dataDate-checks / B4 ná A19 /
//     in A21 B3 ná de vlag / B5 ná de taakchecks ⇒ rood (de bijbehorende "guardvolgorde"-regel)
import { solveProject } from '@/engine/scheduler/solveProject';
import {
  LEGACY_P6_SOURCE_CONVENTION_KEYS,
  type LegacyP6SourceConventionKey,
} from '@/engine/scheduler/conventions/legacyP6Source';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import {
  explainCompletedXerLoeActualFinishEligibility,
  explainP6CompletedLateRemainingWindowEligibility,
} from '@/engine/scheduler/p6CompletedRouteTrace';
import { explainOpenXerLoeTargetSpanEligibility } from '@/engine/scheduler/p6OpenLoeTargetSpanTrace';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { SchedulingOptions } from '@/types/project';
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

function solveAxes(input: ImportResult, taskId: string, legacyP6SourceTranslation?: boolean): Axes {
  const imported = structuredClone(input);
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
    ...(legacyP6SourceTranslation === false ? { legacyP6SourceTranslation: false } : {}),
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
function solveAllAxes(input: ImportResult, legacyP6SourceTranslation?: boolean): Record<string, Axes> {
  const out: Record<string, Axes> = {};
  for (const task of input.tasks) out[task.id] = solveAxes(input, task.id, legacyP6SourceTranslation);
  return out;
}

function withOptions(
  input: ImportResult,
  mutate: (options: NonNullable<ImportResult['project']['schedulingOptions']>) => void,
): ImportResult {
  const copy = structuredClone(input);
  const options = { ...(copy.project.schedulingOptions ?? {}) };
  mutate(options);
  copy.project.schedulingOptions = options;
  return copy;
}

interface ConventionFixture {
  flag: LegacyP6SourceConventionKey;
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
  fixtures.map(fixture => fixture.flag), [...LEGACY_P6_SOURCE_CONVENTION_KEYS]);

for (const fixture of fixtures) {
  const { flag, label, input, taskId, pick } = fixture;
  eq(`${label}: fixture draagt de XER-bronmarkering en zet de vlag zelf niet`, {
    source: input.project.schedulingOptions?.p6Source,
    flag: input.project.schedulingOptions?.[flag],
  }, { source: 'XER', flag: undefined });
  // Vooraf: de fixture moet de conventie echt kunnen onderscheiden, anders bewijst niets hieronder iets.
  eq(`${label}: AAN en UIT verschillen (fixture is onderscheidend)`,
    JSON.stringify(fixture.on) !== JSON.stringify(fixture.off), true);

  eq(`${label}: 1. XER-import zoals gelezen ⇒ AAN (tijdelijke vertaling)`,
    pick(solveAxes(input, taskId)), fixture.on);
  eq(`${label}: 2. XER met ${flag}: false ⇒ UIT (expliciet wint van de vertaling)`,
    pick(solveAxes(withOptions(input, options => { options[flag] = false; }), taskId)), fixture.off);
  eq(`${label}: 3. zonder bron, testhaak uit, alleen ${flag}: true ⇒ AAN (de vlag schakelt, niet de bron)`,
    pick(solveAxes(withOptions(input, options => { delete options.p6Source; options[flag] = true; }), taskId, false)),
    fixture.on);
  eq(`${label}: 4. zonder bron, vlag afwezig ⇒ UIT`,
    pick(solveAxes(withOptions(input, options => { delete options.p6Source; }), taskId)), fixture.off);
  eq(`${label}: 5. met bron, testhaak uit, ${flag}: true ⇒ AAN`,
    pick(solveAxes(withOptions(input, options => { options[flag] = true; }), taskId, false)), fixture.on);
  eq(`${label}: 6. met bron, testhaak uit, vlag afwezig ⇒ UIT (de bron alleen doet niets)`,
    pick(solveAxes(input, taskId, false)), fixture.off);
}

// ── De motor leest de bronmarkering zelf niet meer ─────────────────────────────────────────────
// Met de tijdelijke vertaling uitgeschakeld moet een project MÉT `p6Source: 'XER'` op alle zes
// assen van alle taken identiek zijn aan hetzelfde project zónder; én identiek aan hetzelfde project
// met alle vijf groep-B-vlaggen expliciet uit. Een overgebleven `p6Source`-lezing in de motor die
// rekengedrag stuurt, maakt minstens één fixture hier rood (elke fixture raakt een andere tak).
for (const fixture of fixtures) {
  const withSource = solveAllAxes(fixture.input, false);
  const withoutSource = solveAllAxes(withOptions(fixture.input, options => { delete options.p6Source; }), false);
  const allOff = solveAllAxes(withOptions(fixture.input, options => {
    for (const key of LEGACY_P6_SOURCE_CONVENTION_KEYS) options[key] = false;
  }));
  eq(`${fixture.label}: zonder vertaling is de bronmarkering zesassig inert`, withSource, withoutSource);
  eq(`${fixture.label}: zonder vertaling = alle groep-B-vlaggen expliciet uit`, withSource, allOff);
  eq(`${fixture.label}: zonder vertaling ⇒ UIT op de geclaimde assen`,
    fixture.pick(withSource[fixture.taskId]!), fixture.off);
}

// ── Vertaling zonder bron: A15–A20 uit, zoals vóór baan B ───────────────────────────────────────
// B3 en B4 hebben A19 (`p6UseRemainingStartForProgress`) en B4 ook A18 nodig. Zonder bron en mét
// de (default) vertaling zet `legacyP6Source.ts` die uit, dus zelfs een expliciete B-vlag `true`
// geeft dan UIT. Dat is precies het oude gedrag: zonder bron waren A15–A20 inert.
for (const fixture of fixtures.filter(f => f.flag === 'p6CompletedDataDateWindow' || f.flag === 'p6CompletedLoeActualFinish')) {
  eq(`${fixture.label}: zonder bron, vertaling aan, ${fixture.flag}: true ⇒ UIT (A19 zonder bron uit)`,
    fixture.pick(solveAxes(withOptions(fixture.input, options => {
      delete options.p6Source;
      options[fixture.flag] = true;
    }), fixture.taskId)), fixture.off);
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
  const so = (input: ImportResult, patch: Partial<SchedulingOptions>): SchedulingOptions =>
    ({ ...input.project.schedulingOptions, ...patch });
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
    explainCompletedXerLoeActualFinishEligibility(loe, null, so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'missingDataDate');
  eq('guardvolgorde B4: ongeldige statusdatum én conventie uit ⇒ invalidDataDate',
    explainCompletedXerLoeActualFinishEligibility(loe, new Date(Number.NaN), so(b4, { p6CompletedLoeActualFinish: false }), loeIn, loeOut).reason,
    'invalidDataDate');
  eq('guardvolgorde B4: conventie uit én A19 uit ⇒ conventionOff',
    explainCompletedXerLoeActualFinishEligibility(loe, b4Date, so(b4, { p6CompletedLoeActualFinish: false, p6UseRemainingStartForProgress: false }), loeIn, loeOut).reason,
    'conventionOff');

  eq('guardvolgorde A21: A21-vlag uit én B3 uit ⇒ conventionOff (B3 vóór de vlag)',
    explainP6CompletedLateRemainingWindowEligibility(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false, p6CompletedDataDateWindow: false })).reason,
    'conventionOff');
  eq('guardvolgorde A21: A21-vlag uit, B3 aan ⇒ flagOff',
    explainP6CompletedLateRemainingWindowEligibility(done, b3Date, so(b3, { p6CompletedLateFromRemainingWindow: false })).reason,
    'flagOff');
  eq('guardvolgorde A21: statusdatum ontbreekt én B3 uit ⇒ missingDataDate (actual-pin eerst)',
    explainP6CompletedLateRemainingWindowEligibility(done, null, so(b3, { p6CompletedDataDateWindow: false })).reason,
    'missingDataDate');

  const openLoeArgs = [[], [], b3Date, 0, 0] as const;
  eq('guardvolgorde B5: conventie uit op een niet-LOE ⇒ conventionOff (vóór de taakchecks)',
    explainOpenXerLoeTargetSpanEligibility(done, so(b3, { p6OpenLoeTargetSpan: false }), ...openLoeArgs).reason, 'conventionOff');
  eq('guardvolgorde B5: conventie aan op een niet-LOE ⇒ wrongActivityType',
    explainOpenXerLoeTargetSpanEligibility(done, so(b3, { p6OpenLoeTargetSpan: true }), ...openLoeArgs).reason, 'wrongActivityType');
}

// ── Bronscan: `p6Source` onder src/engine/ alleen in de tijdelijke vertaling ────────────────────
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
  eq('bronscan: p6Source komt onder src/engine/ alleen in conventions/legacyP6Source.ts voor',
    hits.sort(), ['scheduler/conventions/legacyP6Source.ts']);
}

if (diffs.length > 0) {
  console.error(`conventions-p6-flags RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`OK  conventions-p6-flags: ${checks} checks groen (5 groep-B-conventies, aan/uit + bron-inertheid)`);
