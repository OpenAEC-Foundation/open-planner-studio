// Issue #27 etappe 2 (T4, baan B — bestandskant): de id-kolom in de CSV-writer, de ruime maar
// strenge datumherkenning (A5.1), de dag/maand-detectie per bestand (A5.2), dat Start/Finish
// uitsluitend detectiemateriaal zijn (A5.4), de percentage-semantiek (E6/A5.6) en de
// bestandsgrenzen (hardening-checklist: limits vóór allocaties, weigering i.p.v. afkapping).
//
// Draait standalone via esbuild (zie het commando in het plan, T2); geregistreerd in run.sh doet
// T11. Exit 0 = alles groen — de tail van dit script kan "alles groen" tonen bij een gefaalde
// BUNDEL; alleen de exitcode telt.

import { formatCompletionPercent, writeCSV, writeProgressSheetCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { detectDateOrder, finalizeProgressRows, parseSheetDate, parseSheetPercent } from '@/services/progressImport/sheetValues';
import { PROGRESS_IMPORT_LIMITS, type DateOrder, type DateOrderDetection, type RawDateCell } from '@/services/progressImport/types';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

// ── Task-fabriek — puur zodat detectDateOrder z'n ijkpuntregel tegen echte taakdatums kan draaien.
let taskSeq = 0;
function baseTask(id: string, start: string, durationDays: number): Task {
  taskSeq++;
  return {
    id,
    name: `Taak ${taskSeq}`,
    description: '',
    wbsCode: String(taskSeq),
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 0,
    parentId: null,
    childIds: [],
    time: createDefaultTaskTime(start, durationDays),
    resourceIds: [],
  };
}
/** Een taak met EXACT de gewenste geplande start/finish (los van de duur-afleiding hierboven) —
 *  de ijkpuntregel vergelijkt tegen `earlyStart`/`earlyFinish`. */
function taskWithDates(id: string, earlyStart: string, earlyFinish: string): Task {
  const task = baseTask(id, earlyStart, 1);
  task.time.earlyStart = earlyStart;
  task.time.earlyFinish = earlyFinish;
  task.time.scheduleStart = earlyStart;
  task.time.scheduleFinish = earlyFinish;
  return task;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 1 — writer: de id-kolom
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const task = baseTask('task-abc-123', '2026-06-01', 5);
  const csvText = writeCSV({} as Project, {} as WorkCalendar, [task], [], [], []);
  const lines = csvText.split('\r\n');
  const header = lines[0];
  const firstRow = lines[1];

  ok('kop draagt de id-kolom', header.includes('OPS Task ID'));
  eq('…als eerste kolom', header.split(';')[0].replace(/^﻿/, ''), 'OPS Task ID');
  eq('…en de rij draagt het echte id', firstRow.split(';')[0], task.id);
  ok('de bestaande kolommen staan er nog', header.includes('OPS Custom Task Type ID') && header.includes('Actual Start'));
  ok('vervang-import mint een eigen id', readCSV(csvText).tasks[0].id !== task.id);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 2 — datumformaten (A5.1)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function d(raw: string, order: DateOrder = 'dmy') {
    return parseSheetDate(raw, order);
  }
  function iso(value: ReturnType<typeof parseSheetDate>): string {
    if (!value || value.kind !== 'value') throw new Error(`verwachtte een geldige datum, kreeg ${JSON.stringify(value)}`);
    return value.iso;
  }
  function kindOf(value: ReturnType<typeof parseSheetDate>): string {
    if (!value) throw new Error('verwachtte een waarde, kreeg undefined');
    return value.kind;
  }
  function rawOf(value: ReturnType<typeof parseSheetDate>): string {
    if (!value || value.kind !== 'unreadable') throw new Error(`verwachtte 'unreadable', kreeg ${JSON.stringify(value)}`);
    return value.raw;
  }

  eq('leeg veld ⇒ afwezig, geen fout', d(''), undefined);
  eq('ISO', iso(d('2026-06-09')), '2026-06-09');
  eq('ISO met T-tijd blijft datetime', iso(d('2026-06-09T08:30')), '2026-06-09T08:30');
  eq('ISO met SPATIE-tijd ook', iso(d('2026-06-09 08:30')), '2026-06-09T08:30');
  eq('zonder voorloopnullen', iso(d('9-6-2026', 'dmy')), '2026-06-09');
  eq('punt als scheidingsteken', iso(d('9.6.2026', 'dmy')), '2026-06-09');
  eq('slash als scheidingsteken', iso(d('9/6/2026', 'dmy')), '2026-06-09');
  eq('spatie-datetime zonder nullen', iso(d('9-6-2026 8:30', 'dmy')), '2026-06-09T08:30');
  eq('…met seconden', iso(d('9-6-2026 8:30:15', 'dmy')), '2026-06-09T08:30:15');
  eq('mdy leest dezelfde cel anders', iso(d('9-6-2026', 'mdy')), '2026-09-06');
  eq('2026-02-30 bestaat niet', kindOf(d('2026-02-30')), 'unreadable');
  eq('31-2-2026 bestaat niet', kindOf(d('31-2-2026', 'dmy')), 'unreadable');
  eq('tekst is onleesbaar', kindOf(d('volgende week')), 'unreadable');
  eq('…en NIET vandaag', rawOf(d('volgende week')), 'volgende week');

  // Besluit 2026-09-05 (gebruikstest): tweecijferig jaar (`YY`) ⇒ `20YY`, in alle drie de
  // scheiders en beide ordes — de gebruikstest-casus was letterlijk "03-01-27" (MM-DD-YY).
  eq('MM-DD-YY (mdy): 03-01-27 ⇒ 1 mrt 2027 (maand-eerst)', iso(d('03-01-27', 'mdy')), '2027-03-01');
  eq('DD-MM-YY (dmy): dezelfde cel anders gelezen ⇒ 3 jan 2027', iso(d('03-01-27', 'dmy')), '2027-01-03');
  eq('D/M/YY met slash', iso(d('3/1/27', 'dmy')), '2027-01-03');
  eq('D.M.YY met punt', iso(d('1.3.27', 'mdy')), '2027-01-03');
  eq('YY met tijd erachter', iso(d('3-1-27 8:30', 'dmy')), '2027-01-03T08:30');
  eq('YY blijft geldigheid controleren: 31-2-27 bestaat niet', kindOf(d('31-2-27', 'dmy')), 'unreadable');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 3 — datumvolgorde-detectie (A5.2)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function det(cells: readonly RawDateCell[], tasks: readonly Task[] = []): DateOrderDetection {
    return detectDateOrder(cells, tasks);
  }
  function sampleOf(detection: DateOrderDetection): string {
    if (detection.order !== 'ambiguous') throw new Error(`verwachtte 'ambiguous', kreeg ${JSON.stringify(detection)}`);
    return detection.sample;
  }
  function alternativesOf(detection: DateOrderDetection): [string, string] {
    if (detection.order !== 'ambiguous') throw new Error(`verwachtte 'ambiguous', kreeg ${JSON.stringify(detection)}`);
    return detection.sampleAlternatives;
  }
  function evidenceOf(detection: DateOrderDetection): string {
    if (detection.order === 'ambiguous') throw new Error(`verwachtte bewijs, kreeg ambiguous: ${JSON.stringify(detection)}`);
    return detection.evidence;
  }

  const isoOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '2026-06-01' },
    { rowNumber: 3, field: 'actualFinish', raw: '2026-06-05' },
  ];
  eq('alleen ISO ⇒ geen dubbelzinnigheid', evidenceOf(det(isoOnly)), 'noAmbiguity');

  const has25: RawDateCell[] = [{ rowNumber: 2, field: 'actualStart', raw: '25-6-2026' }];
  eq('een component > 12 beslist dmy', det(has25).order, 'dmy');

  const hasMonth25: RawDateCell[] = [{ rowNumber: 2, field: 'actualStart', raw: '6-25-2026' }];
  eq('…en andersom mdy', det(hasMonth25).order, 'mdy');

  // Fixronde-bevinding 4b: `25-6-2026` stemt dmy (a=25>12), `6-25-2026` stemt mdy (b=25>12) — dat
  // is tegenstrijdig bewijs, maar GEEN van beide cellen is zelf een eerlijk voorbeeld: onder de
  // "verkeerde" lezing levert elke cel een ONGELDIGE datum op (maand 25 bestaat niet — vóór de fix
  // rolde dat via `Date.UTC` stil door naar januari 2028, een onmogelijke "keuze"). Zonder een
  // derde, wél eerlijke cel is er dus NIETS dubbelzinnigs te tónen. Opus-hercheck N-D/N-E: dat
  // betekent NIET dat het bestand `noAmbiguity` is — het IS tegenstrijdig gebleken, alleen zonder
  // tónbaar voorbeeld. `noAmbiguity` zou dat verzwijgen (een écht mdy-bestand met één dmy-vormige
  // typefout krijgt dan een muur van `unreadableDate`-weigeringen zonder diagnose); het eerlijke
  // label is `contradictoryNoSample`. De orde blijft `dmy` (een kant moet gekozen worden).
  const contradictoryNoGenuineCell: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '25-6-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '6-25-2026' },
  ];
  eq('tegenstrijdig bewijs zonder eerlijk voorbeeld ⇒ orde blijft dmy', det(contradictoryNoGenuineCell).order, 'dmy');
  eq(
    '…maar het bewijssoort verzwijgt de tegenstrijdigheid niet (N-D/N-E)',
    evidenceOf(det(contradictoryNoGenuineCell)),
    'contradictoryNoSample',
  );

  // Dezelfde tegenstrijdigheid, nu MET een derde cel die wél onder beide ordes een geldige,
  // verschillende datum oplevert — dat blijft `ambiguous`, met die derde cel als sample.
  const contradictoryWithGenuineCell: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '25-6-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '6-25-2026' },
    { rowNumber: 4, field: 'actualStart', raw: '9-6-2026' },
  ];
  eq('tegenstrijdig bewijs MET een eerlijk voorbeeld ⇒ ambiguous', det(contradictoryWithGenuineCell).order, 'ambiguous');
  eq('…en de sample is de eerlijke cel, niet de kapotte', sampleOf(det(contradictoryWithGenuineCell)), '9-6-2026');
  eq(
    '…met de twee lezingen als ISO-datums (bevinding 5 — geen geformatteerde tekst meer)',
    alternativesOf(det(contradictoryWithGenuineCell)),
    ['2026-06-09', '2026-09-06'],
  );

  // Fixronde-bevinding 4a: dag === maand (`12-12-2026`) levert onder BEIDE lezingen dezelfde datum
  // op — dat is geen dubbelzinnigheid, dus zo'n bestand hoort al bij regel 1 als `noAmbiguity` te
  // eindigen, vóór er ook maar een vraag in beeld komt.
  const equalDayMonthOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-12-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '5-5-2026' },
  ];
  eq('dag===maand is nooit dubbelzinnig', evidenceOf(det(equalDayMonthOnly)), 'noAmbiguity');

  // Ijkpuntkalibratie: alleen id-matches, alleen start/finish, alleen a≠b (A5.2 regel 3).
  const calibTask1 = taskWithDates('t-calib-1', '2026-06-09', '2026-06-09');
  const calibTask2 = taskWithDates('t-calib-2', '2026-05-08', '2026-05-08');
  const calibTask3 = taskWithDates('t-calib-3', '2026-04-07', '2026-04-07');

  const calib2: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-6-2026' }, // geen taskId: geen ijkpunt, wél sample-kandidaat
    { rowNumber: 3, field: 'start', raw: '9-6-2026', taskId: 't-calib-1' },
    { rowNumber: 4, field: 'finish', raw: '8-5-2026', taskId: 't-calib-2' },
  ];
  const calib2Tasks = [calibTask1, calibTask2];

  const calib3: RawDateCell[] = [
    ...calib2,
    { rowNumber: 5, field: 'start', raw: '7-4-2026', taskId: 't-calib-3' },
  ];
  const calib3Tasks = [calibTask1, calibTask2, calibTask3];

  eq('ijkpunt met 3 treffers beslist', det(calib3, calib3Tasks).order, 'dmy');
  eq('…met bewijssoort calibration', evidenceOf(det(calib3, calib3Tasks)), 'calibration');

  // Opus-hercheck N-C: het a!==b-filter in regel 1 is DRAGEND voor de kalibratie zelf, niet alleen
  // voor de sample-keuze. Een dag==maand-cel (bv. `3-3-2026`) levert onder BEIDE lezingen dezelfde
  // datum op — zonder het filter zou zo'n cel, bij een id-match op een taak met precies die
  // geplande datum, VOOR BEIDE tellers (dmyHits ÉN mdyHits) meetellen en zo de 3×-ratio breken.
  // Vóór deze fixture liet het filter weghalen de suite ongewijzigd groen.
  const ddTask1 = taskWithDates('t-calib-dd-1', '2026-03-03', '2026-03-03');
  const ddTask2 = taskWithDates('t-calib-dd-2', '2026-06-06', '2026-06-06');
  const ddTask3 = taskWithDates('t-calib-dd-3', '2026-10-10', '2026-10-10');
  const calib3WithDayEqualsMonth: RawDateCell[] = [
    ...calib3,
    { rowNumber: 6, field: 'start', raw: '3-3-2026', taskId: 't-calib-dd-1' },
    { rowNumber: 7, field: 'start', raw: '6-6-2026', taskId: 't-calib-dd-2' },
    { rowNumber: 8, field: 'start', raw: '10-10-2026', taskId: 't-calib-dd-3' },
  ];
  const calib3WithDayEqualsMonthTasks = [...calib3Tasks, ddTask1, ddTask2, ddTask3];
  eq(
    'dag==maand-ijkpunten mogen de kalibratie niet vervuilen',
    det(calib3WithDayEqualsMonth, calib3WithDayEqualsMonthTasks).order,
    'dmy',
  );
  eq(
    '…en de 3 echte treffers blijven een echte kalibratie-beslissing (niet toevallig ambiguous)',
    evidenceOf(det(calib3WithDayEqualsMonth, calib3WithDayEqualsMonthTasks)),
    'calibration',
  );

  eq('2 treffers is te weinig', det(calib2, calib2Tasks).order, 'ambiguous');
  eq('ambiguous draagt een echt voorbeeld', sampleOf(det(calib2, calib2Tasks)), '12-6-2026');
  eq(
    '…als ISO-datumparen, niet als geformatteerde tekst (bevinding 5)',
    alternativesOf(det(calib2, calib2Tasks)),
    ['2026-06-12', '2026-12-06'],
  );

  // Gelijkspel: 3 cellen stemmen dmy, 3 andere stemmen mdy — geen van beide wint (CALIBRATION_RATIO).
  const tieDmy1 = taskWithDates('t-tie-dmy-1', '2026-06-09', '2026-06-09');
  const tieDmy2 = taskWithDates('t-tie-dmy-2', '2026-05-08', '2026-05-08');
  const tieDmy3 = taskWithDates('t-tie-dmy-3', '2026-04-07', '2026-04-07');
  const tieMdy1 = taskWithDates('t-tie-mdy-1', '2026-03-11', '2026-03-11');
  const tieMdy2 = taskWithDates('t-tie-mdy-2', '2026-02-10', '2026-02-10');
  const tieMdy3 = taskWithDates('t-tie-mdy-3', '2026-01-09', '2026-01-09');
  const calibTie: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '9-6-2026', taskId: 't-tie-dmy-1' },
    { rowNumber: 3, field: 'start', raw: '8-5-2026', taskId: 't-tie-dmy-2' },
    { rowNumber: 4, field: 'start', raw: '7-4-2026', taskId: 't-tie-dmy-3' },
    { rowNumber: 5, field: 'start', raw: '3-11-2026', taskId: 't-tie-mdy-1' },
    { rowNumber: 6, field: 'start', raw: '2-10-2026', taskId: 't-tie-mdy-2' },
    { rowNumber: 7, field: 'start', raw: '1-9-2026', taskId: 't-tie-mdy-3' },
  ];
  const calibTieTasks = [tieDmy1, tieDmy2, tieDmy3, tieMdy1, tieMdy2, tieMdy3];
  eq('gelijkspel beslist niet', det(calibTie, calibTieTasks).order, 'ambiguous');

  // WBS-matches zijn te zwak: dezelfde ijkpuntcellen zonder taskId tellen niet mee.
  const calibWbsOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '9-6-2026' },
    { rowNumber: 3, field: 'finish', raw: '8-5-2026' },
    { rowNumber: 4, field: 'start', raw: '7-4-2026' },
  ];
  eq('WBS-rijen tellen niet als ijkpunt', det(calibWbsOnly, calib3Tasks).order, 'ambiguous');

  // Besluit 2026-09-05 (gebruikstest): tweecijferig jaar moet door dezelfde kalibratie/ambiguous-
  // machinerie heen werken als een viercijferig jaar — het is precies de MM-DD-YY-vorm uit het
  // teruggestuurde blad. Mutatiebewijs: haal `toFullYear`/de YY-tak van `NUMERIC_DATE` weg en deze
  // twee cases vallen om (de calibratietaken bestaan dan niet meer als geldige datums, resp. de
  // ambiguous-sample wordt niet meer herkend).
  const yyCalibTask1 = taskWithDates('t-yy-calib-1', '2027-01-03', '2027-01-03');
  const yyCalibTask2 = taskWithDates('t-yy-calib-2', '2027-02-04', '2027-02-04');
  const yyCalibTask3 = taskWithDates('t-yy-calib-3', '2027-03-05', '2027-03-05');
  const yyCalibCells: RawDateCell[] = [
    { rowNumber: 2, field: 'start', raw: '01-03-27', taskId: 't-yy-calib-1' },
    { rowNumber: 3, field: 'start', raw: '02-04-27', taskId: 't-yy-calib-2' },
    { rowNumber: 4, field: 'start', raw: '03-05-27', taskId: 't-yy-calib-3' },
  ];
  const yyCalibTasks = [yyCalibTask1, yyCalibTask2, yyCalibTask3];
  eq('YY-datums (MM-DD-YY) kalibreren net als YYYY', det(yyCalibCells, yyCalibTasks).order, 'mdy');
  eq('…met bewijssoort calibration', evidenceOf(det(yyCalibCells, yyCalibTasks)), 'calibration');

  const yyAmbiguousOnly: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '12-6-27' },
  ];
  eq('alleen dubbelzinnige YY-datums ⇒ ambiguous', det(yyAmbiguousOnly).order, 'ambiguous');
  eq(
    '…met de twee lezingen als ISO-samples (20YY, geen 4-cijferig jaar in de brontekst)',
    alternativesOf(det(yyAmbiguousOnly)),
    ['2027-06-12', '2027-12-06'],
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 4 — Start/Finish zijn detectie-only (A5.4)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const sfSheet = parseProgressCsv('OPS Task ID;Start;Finish;Completion (%)\r\ntask-1;9-6-2026;20-6-2026;50');
  eq(
    'Start/Finish komen niet in de rijen',
    Object.keys(sfSheet.rawRows[0]).some(k => /start|finish/i.test(k) && !/actual/i.test(k)),
    false,
  );

  // Structurele garantie (geen conventie): `ProgressRow` heeft geen veld dat een Start-waarde zou
  // kunnen dragen, dus twee bladen die ALLEEN in hun Start-kolom verschillen finaliseren naar
  // byte-identieke rijen — bewezen op het niveau dat T4 bezit. De volledige eind-tot-eind-proof
  // (een `ProgressImportPlan` met ongewijzigde `appliedCount`) hoort in T3's `buildPlan`-batterij
  // (baan A, `check-progress-import.ts`), niet hier: `buildProgressImportPlan` is geen bestand van
  // deze baan.
  const startBaseline = parseProgressCsv('OPS Task ID;Start;Completion (%)\r\ntask-1;9-6-2026;50');
  const startChanged = parseProgressCsv('OPS Task ID;Start;Completion (%)\r\ntask-1;25-12-2099;50');
  eq(
    'een gewijzigde Start-kolom verandert niets aan de gefinaliseerde rij',
    JSON.stringify(finalizeProgressRows(startChanged, 'dmy')),
    JSON.stringify(finalizeProgressRows(startBaseline, 'dmy')),
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 5 — percentages (E6/A5.6)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function pct(raw: string): number {
    const value = parseSheetPercent(raw);
    if (!value || value.kind !== 'value') throw new Error(`verwachtte een geldig percentage, kreeg ${JSON.stringify(value)}`);
    return value.value;
  }
  function percentKind(raw: string): string {
    const value = parseSheetPercent(raw);
    if (!value) throw new Error('verwachtte een waarde, kreeg undefined');
    return value.kind;
  }

  eq('100 ⇒ 1.0', pct('100'), 1);
  eq('45 ⇒ 0.45', pct('45'), 0.45);
  eq('45,5 ⇒ 0.455', pct('45,5'), 0.455);
  eq('45.5 ⇒ 0.455', pct('45.5'), 0.455);
  eq('1 ⇒ 0.01', pct('1'), 0.01);
  eq('0,5 ⇒ 0.005', pct('0,5'), 0.005);
  eq('100% ⇒ 1.0', pct('100%'), 1);
  // Besluit 2026-09-05 (gebruikstest): een numeriek leesbare waarde buiten [0, 100] krijgt zijn
  // EIGEN uitkomst (`outOfRange`), apart van `unreadable` (tekst/geen match) — de valkuil is
  // typisch een decimaalteken dat een spreadsheet met een andere landinstelling als
  // duizendtalscheider las ("8,38" ⇒ 838).
  eq('150 ⇒ buiten bereik (niet onleesbaar)', percentKind('150'), 'outOfRange');
  eq('-1 ⇒ buiten bereik (niet onleesbaar)', percentKind('-1'), 'outOfRange');
  eq('838 ⇒ buiten bereik (de gebruikstest-casus)', percentKind('838'), 'outOfRange');
  eq('tekst ⇒ onleesbaar', percentKind('bijna klaar'), 'unreadable');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 6 — bestandsgrenzen (hardening-checklist)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  eq('blad zonder sleutelkolom', parseProgressCsv('Name;Completion (%)\r\nFoo;50').fileIssue, 'noKeyColumn');
  eq('blad zonder voortgangskolommen', parseProgressCsv('OPS Task ID;Name\r\ntask-1;Foo').fileIssue, 'noProgressColumns');

  const tinyLimits = { ...PROGRESS_IMPORT_LIMITS, maxRows: 2 };
  const bigCsv = ['OPS Task ID;Completion (%)', ...Array.from({ length: 5 }, (_, i) => `task-${i};50`)].join('\r\n');
  eq('te veel rijen wordt geweigerd', parseProgressCsv(bigCsv, tinyLimits).fileIssue, 'tooManyRows');

  const longId = 'x'.repeat(300);
  const rows9 = parseProgressCsv(`OPS Task ID;Completion (%)\r\n${longId};50`).rawRows;
  eq('te lang id wordt geweigerd', rows9[0].taskId, undefined);

  const controlId = 'task\x01abc';
  const rows10 = parseProgressCsv(`OPS Task ID;Completion (%)\r\n${controlId};50`).rawRows;
  eq('id met stuurteken telt niet', rows10[0].taskId, undefined);

  const rows11 = parseProgressCsv('OPS Task ID;Name;Completion (%)\r\ntask-1;"Fase 1; deel ""A""";50').rawRows;
  ok('quotes en delimiters in namen overleven', rows11[0].name === 'Fase 1; deel "A"');
  eq('rowNumber telt de kopregel mee', rows11[0].rowNumber, 2);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 7 — fixronde-bevinding 3: quote-bewuste recordsplitsing + bevinding 9: echte regelnummers
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // (a) Round-trip met een taaknaam ÉN een omschrijving die allebei een letterlijke regeleinde
  // dragen — `writeCSV` quote't zulke velden RFC4180-gewijs (Name staat vroeg in de rij, vóór
  // Completion; Description staat helemaal achteraan, dus dit dekt "de scheuring zit vroeg" én
  // "er zit ook verderop nog een quote-veld met een newline"). Vóór de fix verloor de ECHTE rij
  // alles ná de scheuring (Completion incluis) en ontstond er een rommelrij.
  const multilineTask = baseTask('task-multiline', '2026-06-01', 5);
  multilineTask.name = 'Regel1\nRegel2';
  multilineTask.description = 'Beschrijving1\nBeschrijving2';
  multilineTask.time.completion = 0.4;
  const multilineCsv = writeCSV({} as Project, {} as WorkCalendar, [multilineTask], [], [], []);
  const multilineSheet = parseProgressCsv(multilineCsv);
  eq('multiline naam/omschrijving scheurt de rij niet in tweeën', multilineSheet.rawRows.length, 1);
  eq('…de naam blijft compleet (met de letterlijke regeleinde)', multilineSheet.rawRows[0]?.name, 'Regel1\nRegel2');
  eq('…en de Completion-kolom overleeft (stond ná de multiline naam)', multilineSheet.rawRows[0]?.rawCompletion, '40');
  eq('…en het echte task-id blijft aan deze ene rij gekoppeld', multilineSheet.rawRows[0]?.taskId, multilineTask.id);

  // (b) Een aanhalingsteken dat nooit sluit maakt GEEN kolomgrens in het bestand nog betrouwbaar —
  // het hele blad wordt geweigerd, nooit een halfgelezen resultaat.
  const unterminated = parseProgressCsv('OPS Task ID;Name;Completion (%)\r\ntask-1;"Nooit gesloten;50');
  eq('niet-gesloten aanhalingsteken weigert het HELE blad', unterminated.fileIssue, 'unreadable');
  eq('…geen enkele halfgelezen rij', unterminated.rawRows.length, 0);
  eq('…en geen halfgelezen detectiecellen', unterminated.detectionCells.length, 0);

  // Bevinding 9: een lege regel telt mee in de regelnummering — vóór de fix kreeg de rij ná een
  // lege regel het verkeerde (te lage) nummer, omdat lege regels vóór het nummeren werden weggefilterd.
  const withBlankLine = parseProgressCsv('OPS Task ID;Completion (%)\r\na;10\r\n\r\nb;20');
  eq('lege regel wordt overgeslagen als datarij', withBlankLine.rawRows.length, 2);
  eq('eerste datarij op fysieke regel 2', withBlankLine.rawRows[0]?.rowNumber, 2);
  eq('tweede datarij op regel 4 — de lege regel 3 telt mee', withBlankLine.rawRows[1]?.rowNumber, 4);

  // En de twee bevindingen samen: een gequote meerregelig record beslaat zelf meerdere fysieke
  // regels, dus de rij DAARNA moet daarmee rekenen — niet met "één record is één regel".
  const multilineThenPlain = parseProgressCsv(
    'OPS Task ID;Name;Completion (%)\r\ntask-1;"Regel1\nRegel2";40\r\ntask-2;Normaal;60',
  );
  eq('twee rijen, geen rommelrij erbij', multilineThenPlain.rawRows.length, 2);
  eq('eerste (meerregelige) rij begint op regel 2', multilineThenPlain.rawRows[0]?.rowNumber, 2);
  eq(
    'tweede rij op regel 4 (regels 2+3 zijn door de eerste, meerregelige rij gebruikt)',
    multilineThenPlain.rawRows[1]?.rowNumber,
    4,
  );
  eq('…en draagt gewoon zijn eigen task-id', multilineThenPlain.rawRows[1]?.taskId, 'task-2');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Writer — voortgangsblad (E7, eigenaarsbesluit 2026-09-05; percentage-ronde 3 zelfde dag):
// `writeProgressSheetCSV` is een tweede SCHRIJVER op dezelfde helpers
// (escapeCSV/formatCompletionPercent/BOM/CRLF) uit csvWriter.ts — geen tweede lezer. Exacte
// 8-koloms kop, correcte veldvolgorde, een fractioneel percentage AFGEROND naar een heel procent
// (geen decimalen meer — een spreadsheet met een andere landinstelling leest "8,38" anders als
// 838), en een round-trip terug door de bestaande lezer/planner (STUB-planner, zoals
// check-progress-import.ts Deel 2) die op een ongewijzigd blad NUL wijzigingen mag opleveren.
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  function stubPlanEdits(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
      else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
      else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDeps: ProgressPlanDeps = { planEdits: stubPlanEdits };

  const taskA = baseTask('task-a', '2026-01-05', 5);
  taskA.wbsCode = '1';
  taskA.name = 'Fundering';
  taskA.time.completion = 0.335;
  const taskB = baseTask('task-b', '2026-01-12', 3);
  taskB.wbsCode = '2';
  taskB.time.completion = 1;
  taskB.time.actualStart = '2026-01-12';
  taskB.time.actualFinish = '2026-01-16';

  const csv = writeProgressSheetCSV([taskA, taskB]);

  ok('begint met de BOM', csv.startsWith('﻿'));
  const withoutBom = csv.slice(1);
  const lines = withoutBom.split('\r\n');
  eq(
    'exacte 8-koloms kop, in die volgorde',
    lines[0],
    'OPS Task ID;WBS;Name;Start;Finish;Completion (%);Actual Start;Actual Finish',
  );
  const fieldsA = lines[1]?.split(';') ?? [];
  eq('rij 1: 8 velden', fieldsA.length, 8);
  eq('rij 1 draagt het echte taak-id', fieldsA[0], 'task-a');
  eq('rij 1 draagt de WBS', fieldsA[1], '1');
  eq('rij 1 draagt de naam', fieldsA[2], 'Fundering');
  eq('rij 1 draagt Start', fieldsA[3], taskA.time.earlyStart || taskA.time.scheduleStart);
  eq('rij 1 draagt Finish', fieldsA[4], taskA.time.earlyFinish || taskA.time.scheduleFinish);
  eq('rij 1: fractioneel percentage afgerond naar heel procent (33,5% ⇒ "34")', fieldsA[5], '34');
  eq('rij 1: geen actuals ⇒ lege cellen', fieldsA[6], '');
  eq('rij 1: geen actuals ⇒ lege cellen', fieldsA[7], '');

  const fieldsB = lines[2]?.split(';') ?? [];
  eq('rij 2: 100% blijft "100"', fieldsB[5], '100');
  eq('rij 2 draagt Actual Start', fieldsB[6], '2026-01-12');
  eq('rij 2 draagt Actual Finish', fieldsB[7], '2026-01-16');

  // Geen predecessors/duration/type/status/critical/float/description — de volle CSV-export heeft
  // die kolommen wel, dit slanke blad bewust niet.
  ok('geen "Predecessors"-kolom in het slanke blad', !lines[0]?.includes('Predecessors'));
  ok('geen "Duration (days)"-kolom in het slanke blad', !lines[0]?.includes('Duration'));

  // Round-trip: een ONGEWIJZIGD, écht geschreven en teruggelezen blad ⇒ nul wijzigingen.
  const sheet = parseProgressCsv(csv);
  const rows = finalizeProgressRows(sheet, 'dmy');
  const plan = buildProgressImportPlan(rows, [taskA, taskB], stubDeps);
  eq('round-trip van het slanke blad ⇒ nul wijzigingen', plan.appliedCount, 0);
  ok('…en dus ook geen enkele rij die als apply doorliep', plan.rows.every((row) => row.outcome !== 'apply'));

  // besluit 2026-09-05 (gebruikstest): geen decimalen meer, wat de landinstelling ook is.
  eq('formatCompletionPercent: 0.0838 ⇒ heel procent "8" (geen "8.38")', formatCompletionPercent(0.0838), '8');
  eq('formatCompletionPercent: 0.5 ⇒ "50"', formatCompletionPercent(0.5), '50');
  eq('formatCompletionPercent: 0.995 ⇒ "100" (rondt naar boven)', formatCompletionPercent(0.995), '100');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Writer/lezer — invulinstructies in de kolomkoppen (punt D, besluit 2026-09-05, letterlijke
// gebruikerswens: "er moet ook in de headers van de kolommen komen te staan wat je in mag voeren
// en waar je af moet blijven"; aanleiding: OnlyOffice met NL-instellingen las "8,38" als 838).
// `writeProgressSheetCSV` krijgt `headerNotes` mee; `parseProgressCsv` moet de sleutel VÓÓR de
// instructiemarker (` — `, ` - ` of `(`) blijven herkennen, in élke taal — de sleutel zelf is
// altijd het letterlijke Engelse kolomwoord, alleen de instructie erachter varieert.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function stubPlanEditsD(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
      else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
      else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDepsD: ProgressPlanDeps = { planEdits: stubPlanEditsD };

  const taskD = baseTask('task-d', '2026-01-05', 5);
  taskD.wbsCode = '1';
  taskD.name = 'Fundering';
  taskD.time.completion = 0.335;

  const headerNotes = {
    'OPS Task ID': 'niet wijzigen',
    WBS: 'niet wijzigen',
    Name: 'niet wijzigen',
    Start: 'gepland, niet wijzigen',
    Finish: 'gepland, niet wijzigen',
    'Completion (%)': 'invullen: 0 t/m 100, hele getallen',
    'Actual Start': 'invullen: werkelijke startdatum (dd-mm-jjjj)',
    'Actual Finish': 'invullen: werkelijke einddatum (dd-mm-jjjj)',
  } as const;
  const csvWithNotes = writeProgressSheetCSV([taskD], headerNotes);
  const headerLine = csvWithNotes.slice(1).split('\r\n')[0];
  ok('elke kolom draagt " — " gevolgd door de instructie', headerLine.split(';').every(cell => cell.includes(' — ')));
  eq(
    '…en de sleutel zelf blijft vooraan, letterlijk Engels',
    headerLine,
    [
      'OPS Task ID — niet wijzigen', 'WBS — niet wijzigen', 'Name — niet wijzigen',
      'Start — gepland, niet wijzigen', 'Finish — gepland, niet wijzigen',
      'Completion (%) — invullen: 0 t/m 100, hele getallen',
      'Actual Start — invullen: werkelijke startdatum (dd-mm-jjjj)',
      'Actual Finish — invullen: werkelijke einddatum (dd-mm-jjjj)',
    ].join(';'),
  );

  // Round-trip: een ONGEWIJZIGD blad MET instructiekoppen ⇒ nul wijzigingen — de lezer moet de
  // instructie negeren en gewoon de kolom vinden.
  const sheetD = parseProgressCsv(csvWithNotes);
  const rowsD = finalizeProgressRows(sheetD, 'dmy');
  const planD = buildProgressImportPlan(rowsD, [taskD], stubDepsD);
  eq('round-trip MET instructiekoppen ⇒ nul wijzigingen', planD.appliedCount, 0);
  eq('…en de taak werd wel degelijk gevonden (niet als "geen kolommen" geweigerd)', planD.rows[0]?.taskId, taskD.id);

  // Fixture: een kop met NEDERLANDSE instructies en één met "DUITSE" (verzonnen tekst) — alle acht
  // kolommen moeten in beide gevallen herkend worden. Mutatiebewijs: haal de prefix-match-terugval
  // in `matchColumnKey` weg en dit blok kleurt rood (`fileIssue` zou `noProgressColumns` worden).
  const nlHeader = 'OPS Task ID — niet wijzigen;WBS — niet wijzigen;Name — niet wijzigen;'
    + 'Start — gepland, niet wijzigen;Finish — gepland, niet wijzigen;'
    + 'Completion (%) — invullen: 0 t/m 100, hele getallen;'
    + 'Actual Start — invullen: werkelijke startdatum (dd-mm-jjjj);'
    + 'Actual Finish — invullen: werkelijke einddatum (dd-mm-jjjj)';
  const deHeader = 'OPS Task ID — nicht ändern;WBS — nicht ändern;Name — nicht ändern;'
    + 'Start — geplant, nicht ändern;Finish — geplant, nicht ändern;'
    + 'Completion (%) — ausfüllen: 0 bis 100, ganze Zahlen;'
    + 'Actual Start — ausfüllen: tatsächliches Startdatum (TT-MM-JJJJ);'
    + 'Actual Finish — ausfüllen: tatsächliches Enddatum (TT-MM-JJJJ)';
  const dataLine = 'task-d;1;Fundering;2026-01-05;2026-01-09;40;;';

  const nlSheet = parseProgressCsv(`${nlHeader}\r\n${dataLine}`);
  ok('NL-instructiekop: alle acht kolommen herkend (geen fileIssue)', nlSheet.fileIssue === undefined);
  eq('…taskId gevonden', nlSheet.rawRows[0]?.taskId, 'task-d');
  eq('…completion gevonden', nlSheet.rawRows[0]?.rawCompletion, '40');

  const deSheet = parseProgressCsv(`${deHeader}\r\n${dataLine}`);
  ok('DE-instructiekop: alle acht kolommen herkend (geen fileIssue)', deSheet.fileIssue === undefined);
  eq('…taskId gevonden', deSheet.rawRows[0]?.taskId, 'task-d');
  eq('…completion gevonden', deSheet.rawRows[0]?.rawCompletion, '40');

  // Losse kop-string ⇒ completion-kolom, expliciet genoemd in de opdracht.
  const completionOnlySheet = parseProgressCsv(
    'OPS Task ID;Completion (%) — invullen: 0 t/m 100, hele getallen\r\ntask-d;40',
  );
  eq('…gevonden als completion-kolom', completionOnlySheet.rawRows[0]?.rawCompletion, '40');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Deel 8 — reason `percentOutOfRange` (besluit 2026-09-05, gebruikstest): een numeriek leesbare
// waarde buiten [0, 100] ("838", "-5") krijgt zijn eigen reden, apart van `unreadableNumber`
// (tekst zoals "abc"). Via een echt CSV-blad, net als Deel 5 in check-progress-import.ts.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function stubPlanEdits2(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDeps2: ProgressPlanDeps = { planEdits: stubPlanEdits2 };

  const taskX = baseTask('task-x', '2026-01-05', 5);
  const taskY = baseTask('task-y', '2026-01-05', 5);
  const taskZ = baseTask('task-z', '2026-01-05', 5);

  const csv = [
    'OPS Task ID;Completion (%)',
    `${taskX.id};838`,
    `${taskY.id};-5`,
    `${taskZ.id};abc`,
  ].join('\r\n');
  const sheet = parseProgressCsv(csv);
  const rows = finalizeProgressRows(sheet, 'dmy');
  const plan = buildProgressImportPlan(rows, [taskX, taskY, taskZ], stubDeps2);
  const rowFor = (id: string) => plan.rows.find(r => r.taskId === id);

  eq('838 ⇒ reason percentOutOfRange', rowFor(taskX.id)?.reason, 'percentOutOfRange');
  eq('-5 ⇒ reason percentOutOfRange', rowFor(taskY.id)?.reason, 'percentOutOfRange');
  eq('abc blijft reason unreadableNumber', rowFor(taskZ.id)?.reason, 'unreadableNumber');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Writer/lezer — verzameltaken dragen hun eigen markering IN het blad (gebruikstest 2026-09-11,
// fix 1). Letterlijke wens van de eigenaar: "hij zegt dat summary tasks geen progress kunnen
// krijgen uit een spreadsheet, waarom staat dat ook niet gewoon in dat veld in de spreadsheet?".
// De drie INVULcellen van een verzameltaak (`childIds.length > 0`) krijgen een gelokaliseerde
// markeertekst die met een em-dash (U+2014) begint; de lezer telt een cel die met `—` begint als
// AFWEZIG (niet als onleesbaar), zodat een ongewijzigd teruggestuurd blad nul weigeringen geeft.
// Mutatiebewijs: haal de em-dash-terugval in `finalizeProgressRows` weg ⇒ de round-trip hieronder
// levert `refusedCount > 0` (onleesbare datum/percentage) en dit blok kleurt rood.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  function stubPlanEditsS(
    task: Task,
    edits: readonly CellEditIntent[],
  ): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
    const next: Task = { ...task, time: { ...task.time } };
    for (const edit of edits) {
      const id = String(edit.columnId);
      if (id === 'task.time.completion') next.time.completion = edit.value as number;
      else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
      else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
    }
    return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
  }
  const stubDepsS: ProgressPlanDeps = { planEdits: stubPlanEditsS };

  const parent = baseTask('task-parent', '2026-01-05', 5);
  parent.wbsCode = '1';
  parent.name = 'Ruwbouw';
  parent.childIds = ['task-child'];
  parent.time.completion = 0.4;
  const child = baseTask('task-child', '2026-01-05', 5);
  child.wbsCode = '1.1';
  child.name = 'Fundering';
  child.parentId = parent.id;
  child.time.completion = 0.4;

  const SUMMARY_NOTE = '— verzameltaak: niet invullen';
  const csvS = writeProgressSheetCSV([parent, child], undefined, SUMMARY_NOTE);
  const linesS = csvS.slice(1).split('\r\n');
  const parentFields = linesS[1]?.split(';') ?? [];
  const childFields = linesS[2]?.split(';') ?? [];

  eq('verzameltaak: Completion draagt de markering', parentFields[5], SUMMARY_NOTE);
  eq('verzameltaak: Actual Start draagt de markering', parentFields[6], SUMMARY_NOTE);
  eq('verzameltaak: Actual Finish draagt de markering', parentFields[7], SUMMARY_NOTE);
  eq('verzameltaak: de leescellen blijven gewoon gevuld', parentFields[1], '1');
  eq('bladtaak houdt zijn echte percentage', childFields[5], '40');
  eq('bladtaak krijgt GEEN markering', childFields[6], '');

  // Round-trip: het geëxporteerde blad ongewijzigd terug ⇒ niets toegepast, niets geweigerd.
  const sheetS = parseProgressCsv(csvS);
  const rowsS = finalizeProgressRows(sheetS, 'dmy');
  const planS = buildProgressImportPlan(rowsS, [parent, child], stubDepsS);
  eq('round-trip met verzameltaak ⇒ niets toegepast', planS.appliedCount, 0);
  eq('…en NIETS geweigerd', planS.refusedCount, 0);
  eq('…de verzameltaakrij is gewoon ongewijzigd', planS.rows[0]?.outcome, 'noop');
  eq('…net als de bladtaakrij', planS.rows[1]?.outcome, 'noop');

  // Zonder markeertekst blijft het blad exact zoals het was (de parameter is optioneel).
  const csvPlain = writeProgressSheetCSV([parent, child]);
  const plainParent = csvPlain.slice(1).split('\r\n')[1]?.split(';') ?? [];
  eq('zonder markeertekst: verzameltaak schrijft gewoon zijn eigen percentage', plainParent[5], '40');

  // De lezer zelf: een cel die met een em-dash begint is AFWEZIG, niet onleesbaar.
  const markedSheet = parseProgressCsv(
    'OPS Task ID;Completion (%);Actual Start\r\n'
    + `task-child;${SUMMARY_NOTE};${SUMMARY_NOTE}`,
  );
  const markedRows = finalizeProgressRows(markedSheet, 'dmy');
  eq('em-dash-cel ⇒ completion afwezig', markedRows[0]?.completion, undefined);
  eq('em-dash-cel ⇒ actualStart afwezig', markedRows[0]?.actualStart, undefined);
}


if (diffs.length > 0) {
  console.error(`FAIL progress-import-csv: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import-csv: ${checks}/${checks}`);
}
