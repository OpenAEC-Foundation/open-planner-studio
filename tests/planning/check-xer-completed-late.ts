/**
 * Corpusloze regressie voor `p6CompletedLateFromRemainingWindow` (diagnose laag 1, klasse (i),
 * rehab-2: 2.036 voltooide taken, 99,9% dekking). P6 zet een voltooide activiteit ook aan de late
 * zijde neer als een taak met nul restduur op de statusdatum in plaats van op haar historische
 * actual-venster: `LF = prevWorkInstant(LS)`, `LS` = de vroegste van de door haar opvolgers
 * toegestane late finishen, geklemd op de statusdatum — waarbij de relatie-lag NIET meetelt tussen
 * twee voltooide activiteiten maar WEL zolang de opvolger nog restwerk heeft. Zie
 * `CPMSolver.backwardPass` (de `backwardActualPin.eligible`-tak) en `scheduleAnalysis.ts`
 * (`pinLateToActualWindow`) voor de implementatie, en `docs/superpowers/plans/2026-08-20-plan-xer-
 * p6-lezer.md` §5 (X-O7) voor het besluit.
 *
 * Ketting A→B→C→E (kalender ma–vr 07:00–15:00, 8 u/dag):
 *  - A, B: voltooid, ver vóór de statusdatum. A→B is FS met een NIET-nul lag (8 u) — de gemeten
 *    uitzondering zegt dat die lag NIET meetelt omdat B (de opvolger) zelf ook voltooid is.
 *  - B→C is FS met lag 16 u; C is NIET gestart (5 dagen) — hier telt de lag WEL mee, want C heeft
 *    nog restwerk. C→E (lag 0) verankert C's late zijde aan de mijlpaal E.
 *  - G: een geïsoleerde voltooide taak zonder relaties — de klem-op-de-statusdatum-vorm zonder
 *    opvolgerdruk.
 *
 * Mutatiebewijs (handmatig uitgevoerd, zie het baanrapport): de lag-uitzondering tussen twee
 * voltooide activiteiten weghalen (`succWindowCompleted ? {...lagDays:0,...} : seq` vervangen door
 * kaal `seq`) laat de eerste assertie hieronder ROOD zien (A.lateStart schuift 8 u terug t.o.v.
 * B.lateStart); de `LF = prevWorkInstant(LS)`-regel weghalen (`progressCal.prevWorkInstant(ls)`
 * vervangen door `ls` zelf) laat de derde assertie ROOD zien zodra `windowEs` op een bandgrens valt
 * (G's geïsoleerde geval).
 */
import { solveProject } from '@/engine/scheduler/solveProject';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import { parseInstant } from '@/utils/dateUtils';
import { explainP6CompletedDataDateWindow } from '@/utils/p6CompletedTargetWindow';
import type { SchedulingOptions } from '@/types/project';

const diffs: string[] = [];
let checks = 0;

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

// Kalender ma–vr 07:00–15:00, 8 u/dag — exact het patroon uit de andere completed-XER-fixtures
// (check-xer-completed-suspend-resume-window.ts, check-xer-backward-float-trace.ts).
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
    // E is bewust GEEN mijlpaal: een verbonden open TT_FinMile is z'n eigen contracteindpunt
    // (`p6FinishMilestoneBoundaryWindow`) en zou de klem hieronder juist onttrekken van L's
    // projecteindedruk — een gewone taak volgt wel de normale projecteinde-backward-regel.
    '%R\tE\tP1\tC1\tE\tOpvolger E\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t8\t8\t2026-09-21 07:00\t2026-09-21 15:00\t\t',
    // L: geïsoleerde, niet-gestarte taak ver in de toekomst — puur om het projecteinde (max vroege
    // finish) ruim voorbij E's eigen vroege finish te tillen, zodat E/C/B/A allemaal reële,
    // positieve speling krijgen en de klem op de statusdatum (hieronder) niet toevallig alles
    // plat drukt — anders zou de lag-uitzondering tussen A en B onzichtbaar worden (beide
    // waarden zouden toch al op de vloer landen, met of zonder lag).
    '%R\tL\tP1\tC1\tL\tLange, losse taak L\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t80\t80\t2026-11-02 07:00\t2026-11-13 15:00\t\t',
    '%R\tG\tP1\tC1\tG\tVoltooid geïsoleerd G\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t8\t0\t2026-07-06 07:00\t2026-07-06 15:00\t2026-07-06 07:00\t2026-07-06 15:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR-AB\tB\tA\tP1\tP1\tPR_FS\t8',
    '%R\tR-BC\tC\tB\tP1\tP1\tPR_FS\t16',
    '%R\tR-CE\tE\tC\tP1\tP1\tPR_FS\t0',
    '%E',
  ].join('\n'));
}

function importFixture(): ImportResult {
  const opened = readXER(fixtureBytes());
  if (isMultiDocumentImport(opened)) throw new Error('completed-late fixture moet precies één project openen');
  return opened;
}

function solveWith(overrides?: Partial<SchedulingOptions>) {
  const imported = structuredClone(importFixture());
  if (overrides) {
    imported.project.schedulingOptions = { ...imported.project.schedulingOptions, ...overrides };
  }
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
  });
  if (result.error) throw new Error(result.error);
  return { imported, result };
}

// ── Sanity: alle drie voltooide taken (A, B, G) komen door de completedWindow-poort — anders test
//    deze fixture niet wat hij claimt te testen. ──────────────────────────────────────────────────
{
  const { imported } = solveWith();
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  for (const id of ['A', 'B', 'G']) {
    const task = imported.tasks.find(t => t.id === id);
    if (!task) throw new Error(`fixture mist taak ${id}`);
    const decision = explainP6CompletedDataDateWindow(task, dataDate, imported.project.schedulingOptions);
    eq(`completed-late fixture: taak ${id} zit in de completedWindow-poort`, decision, { eligible: true, reason: 'eligible' });
  }
}

// ── Vlag AAN (XER-default): de gemeten P6-regel. ────────────────────────────────────────────────
{
  const { imported, result } = solveWith();
  const cal = new CalendarEngine(imported.calendar);
  const a = result.tasks.get('A')!;
  const b = result.tasks.get('B')!;
  const c = result.tasks.get('C')!;
  const g = result.tasks.get('G')!;
  const dataDate = parseInstant(imported.project.statusDate!);

  // Lag vervalt tussen twee voltooide activiteiten (A→B, lag 8 u, B zelf ook voltooid): A's late
  // start volgt B's late start EXACT, ondanks de niet-nul lag op de relatie.
  eq('completed-late AAN: lag tussen twee voltooide activiteiten vervalt (A.lateStart = B.lateStart)',
    a.lateStart, b.lateStart);

  // Lag telt WEL mee zolang de opvolger nog restwerk heeft (B→C, lag 16 u, C niet voltooid):
  // B.lateStart ligt exact 16 werkuur vóór C.lateStart op de (gedeelde) taakkalender.
  const bLateStart = parseInstant(b.lateStart);
  const cLateStart = parseInstant(c.lateStart);
  eq('completed-late AAN: lag tussen voltooid en niet-voltooid telt mee (16 werkuur)',
    cal.subtractWorkMinutes(cLateStart, 16 * 60).toISOString(), bLateStart.toISOString());
  ok('completed-late AAN: B.lateStart ligt vóór C.lateStart (de lag is niet toevallig nul)',
    bLateStart.getTime() < cLateStart.getTime(), `b=${b.lateStart} c=${c.lateStart}`);

  // LF = prevWorkInstant(LS) op de taakkalender, voor zowel A als B.
  eq('completed-late AAN: A.lateFinish = prevWorkInstant(A.lateStart)',
    cal.prevWorkInstant(parseInstant(a.lateStart)).toISOString(), parseInstant(a.lateFinish).toISOString());
  eq('completed-late AAN: B.lateFinish = prevWorkInstant(B.lateStart)',
    cal.prevWorkInstant(parseInstant(b.lateStart)).toISOString(), parseInstant(b.lateFinish).toISOString());

  // A en B delen dezelfde late-anker-keten (A erft B's late start ongewijzigd) ⇒ dezelfde
  // totale float — gemeten tegen hetzelfde statusdatumvenster aan de vroege kant (niet de rauwe
  // historische actual-finish, die voor A en B verschilt), anders zou de formule uitsluitend de
  // historische afstand tussen A en B se eigen actuals meten.
  eq('completed-late AAN: A en B hebben dezelfde totale float (zelfde late-ankerketen)',
    a.totalFloat, b.totalFloat);
  // Diagnose-formule H-i-B (op de finish-zijde, want totalFloatMode default 'finish'): TF =
  // werkminuten(statusdatumvenster-EF → LF), exact de `p6XerProjectedWorkMinutesBetween`-primitief
  // die `CPMSolver.signedFloat` zelf ook gebruikt voor een XER-project.
  const windowEs = cal.nextWorkInstant(dataDate);
  const windowEf = cal.prevWorkInstant(windowEs);
  const expectedTf = cal.p6XerProjectedWorkMinutesBetween(windowEf, parseInstant(a.lateFinish)) / (cal.hoursPerDay * 60);
  eq('completed-late AAN: A.totalFloat = werkminuten(statusdatumvenster-EF → A.lateFinish)',
    a.totalFloat, expectedTf);

  // G: geïsoleerde voltooide taak zonder opvolgers ⇒ de statusdatumklem zelf.
  eq('completed-late AAN: G.lateStart = nextWorkInstant(statusdatum)',
    parseInstant(g.lateStart).toISOString(), windowEs.toISOString());
  eq('completed-late AAN: G.lateFinish = prevWorkInstant(G.lateStart)',
    parseInstant(g.lateFinish).toISOString(), cal.prevWorkInstant(windowEs).toISOString());
  eq('completed-late AAN: G heeft nul totale float (klem, geen opvolgerdruk)', g.totalFloat, 0);
}

// ── Vlag UIT: byte-identiek aan het bestaande gedrag (rauwe actual-pin). ────────────────────────
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
}

if (diffs.length > 0) {
  console.error(`XER COMPLETED LATE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER COMPLETED LATE GREEN: ${checks} checks groen`);
