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
import {
  explainBackwardActualPinEligibility,
  explainP6CompletedLateRemainingWindowEligibility,
} from '@/engine/scheduler/p6CompletedRouteTrace';
import type { SchedulingOptions } from '@/types/project';

const diffs: string[] = [];
let checks = 0;
// Gemeten 2026-09-07 (her-review bevindingen 4/5). Let op: de fixturekalender heeft banden op
// P6-dagindex 1–5 = ZONDAG t/m donderdag (P6 telt 1 = zondag), dus 2026-11-08 (zondag) is hier een
// werkdag — één werkdag vóór SSA/FSA's 2026-11-09T07:00 (lag 0). SF landt op de finish-rand
// (LS == LF), FF via `nextWorkInstant` op de start-rand: bevinding 5, ongewijzigd gepind.
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
    // Review-bevinding 3 (SS/SF-rekenfout): NS is een tweede, onafhankelijke open taak (dangling,
    // krijgt via L dezelfde projecteinde-speling als C/E) met vier voltooide voorgangers — één per
    // relatietype, allemaal lag 0. SSA/FSA delen dezelfde SS/FS-startanker (NS's eigen late start);
    // SFA/FFA delen hetzelfde SF/FF-finishanker (NS's eigen late finish). Zonder de nulrestduur-
    // conversie voor SS/SF (die vóór deze fix de volle taakduur van SSA/SFA dubbel optelde) wijken
    // SSA/SFA af van hun FS/FF-tegenhanger; met de fix vallen ze exact samen.
    '%R\tNS\tP1\tC1\tNS\tOnafhankelijke open opvolger NS\tTT_Task\tDT_FixedDUR\tTK_NotStart\tCP_Drtn\t40\t40\t2026-09-14 07:00\t2026-09-18 15:00\t\t',
    '%R\tSSA\tP1\tC1\tSSA\tVoltooid via SS\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFSA\tP1\tC1\tFSA\tVoltooid via FS\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tSFA\tP1\tC1\tSFA\tVoltooid via SF\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    '%R\tFFA\tP1\tC1\tFFA\tVoltooid via FF\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t2026-08-04 15:00',
    // Review-bevinding 4 (poortdivergentie): NX is `TK_Complete` ZONDER `act_end_date` — de lezer
    // zet daarvoor wél `completion = 1` (status_code) maar GEEN `time.actualFinish`. Zo'n taak komt
    // dus wel door `explainP6CompletedDataDateWindow` (de CP_Drtn-route eist geen actual-finish)
    // maar NIET door `explainBackwardActualPinEligibility`. Zonder de gedeelde poort liep de
    // weergavelaag hier vooruit op een solvertak die niet draaide.
    '%R\tNX\tP1\tC1\tNX\tVoltooid zonder act_end_date NX\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t16\t0\t2026-08-03 07:00\t2026-08-04 15:00\t2026-08-03 07:00\t',
    // Her-review bevindingen 4/5 (lag op SS/SF): NL is een derde onafhankelijke open taak met zes
    // voltooide voorgangers — SS/FS/SF/FF met 8 u lag (SSL/FSL/SFL/FFL), en SS/FS met een
    // PROCENTUELE lag (SSP/FSP, 50% van 16 u = 8 u, gezet ná de import want XER kent geen
    // procentlag). Vóór de fix verdween de procentlag op SS/SF stil (de nulrestduur-kloon zette de
    // voorgangerduur op 0 en de lag werd daartegen opgelost); FS/FF hielden 'm wél.
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
  return opened;
}

function solveWith(overrides?: Partial<SchedulingOptions>) {
  const imported = structuredClone(importFixture());
  if (overrides) {
    imported.project.schedulingOptions = { ...imported.project.schedulingOptions, ...overrides };
  }
  // Procentlag bestaat niet in XER (TASKPRED kent alleen `lag_hr_cnt`); een gebruiker/MCP/IFC kan
  // hem op een XER-project wél zetten. Hier ná de import op de SSP/FSP-relaties: 50% van 16 u.
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

// ── Vlag AAN: SS/SF/FF-rekenfout (review-bevinding 3). ──────────────────────────────────────────
// `backwardConstraint` geeft voor SS/SF de late START van de voorganger terug via
// `finishFromStart(pe, predLS, predTask)` — vóór de fix telde die de VOLLE geplande duur van de
// voltooide voorganger een tweede keer mee (de nulrestduur-klem hierboven behandelde het resultaat
// dan óók nog als finish). Met de fix delen SSA/FSA (beide ankeren op NS's eigen late START) en
// SFA/FFA (beide op NS's eigen late FINISH) exact dezelfde afgeleide late start — dat is geen
// tautologie: vóór de fix week SSA/SFA een volle taakduur (16 werkuur = 2 werkdagen) af van hun
// FS/FF-tegenhanger.
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
  // Absolute ankers (review-bevinding 9: geen kale tautologie op de eigen formule) — vastgesteld
  // via de motor zelf en hier bevroren; de mutatietest hieronder bewijst dat ze zonder de fix
  // uiteenlopen.
  eq('completed-late AAN: SSA/FSA absolute late start', { ssa: ssa.lateStart, fsa: fsa.lateStart }, {
    ssa: '2026-11-09T07:00', fsa: '2026-11-09T07:00',
  });
  eq('completed-late AAN: SFA/FFA absolute late start', { sfa: sfa.lateStart, ffa: ffa.lateStart }, {
    sfa: '2026-11-16T07:00', ffa: '2026-11-16T07:00',
  });
}

// ── Vlag AAN: lag op SS/SF uit een voltooide voorganger (her-review bevindingen 4 en 5). ─────────
// Bevinding 4: een PROCENTUELE lag werd op SS/SF tegen de nulrestduur-kloon opgelost en verdween.
// Sinds de fix wordt hij vóór de kloon tegen de ongewijzigde taak vastgezet, dus SS+50% (= 8 u)
// valt exact samen met SS+8 u én met FS+8 u en FS+50%. MUTATIEBEWIJS: haal `percentResolvedSeq`
// weg (gebruik `seq`) ⇒ SSP wijkt 8 u af van SSL/FSL/FSP.
// Bevinding 5 (karakterisering, geen doel): SF/FF met lag leveren hun late start op een andere
// bandrand dan FS/SS zodra de aftrek exact op een bandeind landt — SF geeft de finish-instant terug
// (LS == LF), FS via `nextWorkInstant` de start-instant. Welke conventie P6 hier hanteert is niet
// gemeten (rehab-2 is FS-gedomineerd, geen orakelcel dekt SS/SF-met-lag); de absolute waarden
// staan hieronder gepind zodat een bewuste symmetrisering zichtbaar is en een stille niet.
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

// ── Poortpariteit solver ↔ weergave (review-bevinding 4). ──────────────────────────────────────
// NX is `TK_Complete` zonder `act_end_date`. De brede completedWindow-poort laat 'm door, de
// completed-actual-pin niet — precies de spleet waarin de weergavelaag vóór deze fix wél meebewoog
// (ls/lf verschoven naar het statusdatumvenster en de float ging tegen dat venster meten) terwijl
// `CPMSolver.backwardPass` zijn nieuwe tak oversloeg. De gedeelde poort
// `explainP6CompletedLateRemainingWindowEligibility` sluit beide kanten tegelijk; het bewijs is dat
// NX met vlag AAN byte-identiek is aan NX met vlag UIT.
{
  const { imported } = solveWith();
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const so = imported.project.schedulingOptions;
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
    explainP6CompletedLateRemainingWindowEligibility(nx, dataDate, so),
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

if (diffs.length > 0) {
  console.error(`XER COMPLETED LATE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER COMPLETED LATE GREEN: ${checks} checks groen`);
