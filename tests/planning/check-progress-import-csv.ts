// Issue #27 etappe 2 (T4, baan B — bestandskant): de id-kolom in de CSV-writer, de ruime maar
// strenge datumherkenning (A5.1), de dag/maand-detectie per bestand (A5.2), dat Start/Finish
// uitsluitend detectiemateriaal zijn (A5.4), de percentage-semantiek (E6/A5.6) en de
// bestandsgrenzen (hardening-checklist: limits vóór allocaties, weigering i.p.v. afkapping).
//
// Draait standalone via esbuild (zie het commando in het plan, T2); geregistreerd in run.sh doet
// T11. Exit 0 = alles groen — de tail van dit script kan "alles groen" tonen bij een gefaalde
// BUNDEL; alleen de exitcode telt.

import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { detectDateOrder, finalizeProgressRows, parseSheetDate, parseSheetPercent } from '@/services/progressImport/sheetValues';
import { PROGRESS_IMPORT_LIMITS, type DateOrder, type DateOrderDetection, type RawDateCell } from '@/services/progressImport/types';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';

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
  // derde, wél eerlijke cel is er dus NIETS dubbelzinnigs te tónen — het bestand valt terug op
  // `noAmbiguity` in plaats van de gebruiker een kapotte vraag voor te leggen.
  const contradictoryNoGenuineCell: RawDateCell[] = [
    { rowNumber: 2, field: 'actualStart', raw: '25-6-2026' },
    { rowNumber: 3, field: 'actualFinish', raw: '6-25-2026' },
  ];
  eq('tegenstrijdig bewijs zonder eerlijk voorbeeld ⇒ toch geen vraag', det(contradictoryNoGenuineCell).order, 'dmy');
  eq('…met bewijssoort noAmbiguity', evidenceOf(det(contradictoryNoGenuineCell)), 'noAmbiguity');

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
  eq('150 ⇒ onleesbaar', percentKind('150'), 'unreadable');
  eq('-1 ⇒ onleesbaar', percentKind('-1'), 'unreadable');
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

if (diffs.length > 0) {
  console.error(`FAIL progress-import-csv: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import-csv: ${checks}/${checks}`);
}
