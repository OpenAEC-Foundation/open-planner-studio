// Issue #743 — het voortgangsblad en de stand bij de export. De export legt per taak vast wat er in de
// planning stond (`exportState.ts`). Daarna vergelijkt de import per veld drie waarden: de exportstand,
// het blad en de app. Eigenaarsbesluit 2026-10-30: een botsing vraagt per rij een keuze, en Toepassen
// blijft dicht tot elke rij er een heeft.
//
//   Deel A — de cel: heen en terug, en elke afwijkende vorm telt als afwezig.
//   Deel B — de driewegvergelijking op de echte store, per geval.
//   Deel C — botsingen: toepassen geblokkeerd, keuze app en blad, undo, herhalen.
//   Deel D — wanneer de exportstand NIET geldt: geen kolom, WBS-terugval, koppeling aan een andere taak.
//   Deel E — meldingen: plandatums en het exportmoment.
//   Deel F — het echte `.xlsx`: verborgen kolom, verzamelrij, en terug door de echte lezer.
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import { useAppStore } from '@/state/appStore';
import { hydratePayload, payloadFromImport } from '@/state/documentContract';
import { decodeProgressExportState, encodeProgressExportState } from '@/services/progressImport/exportState';
import { parseProgressXlsx } from '@/services/progressImport/parseProgressXlsx';
import { finalizeProgressRows } from '@/services/progressImport/sheetValues';
import type { ProgressConflictChoice, ProgressPlanRow, ProgressRow } from '@/services/progressImport/types';
import { buildProgressXlsxParts, writeProgressSheetXLSX } from '@/services/xlsx/writeProgressXlsx';
import { computedFinish, shownFinish } from '@/utils/taskDates';
import { flattenOrder } from '@/utils/wbs';
import type { Task } from '@/types/task';
import { buildRichSchemaProject } from './ifcSchemaFixture';
import { sheetFromText } from './progressSheetFixture';

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

const S = () => useAppStore.getState();
const EXPORTED_AT = '2026-10-30T12:00:00.000Z';
const live = (id: string): Task => S().tasks.find(t => t.id === id)!;

/** Een vers project met vier ongestarte bladtaken en een statusdatum ná alle datums. */
function freshProject(): [Task, Task, Task, Task] {
  const rich = buildRichSchemaProject(process.cwd());
  useAppStore.setState((s) => { hydratePayload(s, payloadFromImport(rich, null)); });
  S().runCPM();
  S().setStatusDate(S().tasks.map(t => shownFinish(t).slice(0, 10)).sort().at(-1)!);
  S().runCPM();
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.isDirty = false; });
  const leaves = S().tasks.filter(t => t.childIds.length === 0 && !t.isMilestone
    && t.time.completion === 0 && !t.time.actualStart && !t.time.actualFinish);
  ok('fixture: minstens vier ongestarte bladtaken', leaves.length >= 4);
  return [leaves[0], leaves[1], leaves[2], leaves[3]];
}

interface SheetLine {
  task: Task;
  /** De stand bij de export; `null` = geen exportstand in deze rij. */
  state: string | null;
  completion?: string;
  actualStart?: string;
  actualFinish?: string;
}

/** Een blad met de kolom `OPS Export`, zonder ZIP. Het echte `.xlsx` staat in Deel F. */
function readSheet(lines: readonly SheetLine[]): readonly ProgressRow[] {
  const header = 'OPS Task ID;WBS;Completion (%);Actual Start;Actual Finish;OPS Export';
  const body = lines.map(l => [
    l.task.id, l.task.wbsCode, l.completion ?? '', l.actualStart ?? '', l.actualFinish ?? '', l.state ?? '',
  ].join(';'));
  const sheet = sheetFromText([header, ...body].join('\n'));
  if (sheet.fileIssue) throw new Error(`testblad geweigerd: ${sheet.fileIssue}`);
  return finalizeProgressRows(sheet, 'dmy');
}

const stateOf = (task: Task) => encodeProgressExportState(task, EXPORTED_AT);
const rowOf = (rows: readonly ProgressPlanRow[], id: string) => rows.find(r => r.taskId === id)!;
const choices = (entries: readonly [number, ProgressConflictChoice][]) => new Map(entries);

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel A — de cel
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const [task] = freshProject();
  const t: Task = {
    ...task,
    time: { ...task.time, completion: 1 / 3, actualStart: '2026-09-07T07:00', actualFinish: '2026-09-18' },
  };
  const decoded = decodeProgressExportState(stateOf(t));
  ok('A1 een eigen cel leest terug', decoded !== undefined);
  eq('A1 exportmoment', decoded?.exportedAt, EXPORTED_AT);
  eq('A1 voltooiing op vier decimalen in procenten', decoded?.completion, 0.333333);
  eq('A1 werkelijke start', decoded?.actualStart, '2026-09-07T07:00');
  eq('A1 werkelijk einde', decoded?.actualFinish, '2026-09-18');
  eq('A1 berekend einde', decoded?.plannedFinish, computedFinish(t) || undefined);

  const leeg = decodeProgressExportState(`ops1|${EXPORTED_AT}|0||||`);
  eq('A2 lege velden blijven afwezig', leeg, { exportedAt: EXPORTED_AT, completion: 0 });

  for (const bad of [
    'iets anders', '', `ops2|${EXPORTED_AT}|0||||`, `ops1|${EXPORTED_AT}|0|||`, `ops1|${EXPORTED_AT}|0|||||`,
    `ops1|geen-datum|0||||`, `ops1|${EXPORTED_AT}|101||||`, `ops1|${EXPORTED_AT}|-1||||`,
    `ops1|${EXPORTED_AT}|abc||||`, `ops1|${EXPORTED_AT}|0|30-10-2026|||`,
  ]) {
    eq(`A3 afgewezen: ${JSON.stringify(bad)}`, decodeProgressExportState(bad), undefined);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel B — de driewegvergelijking
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  // B1 — het bewezen probleem: een onaangeraakte rij zet voortgang van de planner niet meer terug.
  const [a, b, c, d] = freshProject();
  const lines: SheetLine[] = [
    { task: a, state: stateOf(a), completion: '0' },
    { task: b, state: stateOf(b), completion: '40' },
    { task: c, state: stateOf(c), completion: '50' },
    { task: d, state: stateOf(d), completion: '60' },
  ];
  S().setTaskProgress(a.id, 0.5); // alleen de app
  // b: alleen het blad
  S().setTaskProgress(c.id, 0.5); // beide, dezelfde waarde
  S().setTaskProgress(d.id, 0.3); // beide, verschillend
  const plan = S().previewProgressImport(readSheet(lines));

  const rowA = rowOf(plan.rows, a.id);
  eq('B1 alleen in de app: de rij verandert niets', rowA.outcome, 'noop');
  eq('B1 de melding noemt beide waarden', rowA.keptApp, [{ field: 'completion', exported: 0, app: 0.5 }]);
  eq('B1 geen botsing', rowA.conflicts, undefined);

  const rowB = rowOf(plan.rows, b.id);
  eq('B2 alleen in het blad: gewone wijziging', rowB.outcome, 'apply');
  eq('B2 de wijziging', rowB.changes, [{ field: 'completion', before: 0, after: 0.4 }]);
  eq('B2 geen melding', rowB.keptApp, undefined);

  eq('B3 op beide plekken dezelfde waarde: niets te doen', rowOf(plan.rows, c.id).outcome, 'noop');
  eq('B3 geen botsing', rowOf(plan.rows, c.id).conflicts, undefined);

  const rowD = rowOf(plan.rows, d.id);
  eq('B4 op beide plekken verschillend: wacht op een keuze', rowD.outcome, 'unresolved');
  eq('B4 de drie waarden', rowD.conflicts, [{ field: 'completion', exported: 0, app: 0.3, sheet: 0.6 }]);

  eq('B5 tellers', [plan.conflictCount, plan.unresolvedConflictCount, plan.appNewerCount, plan.appliedCount],
    [1, 1, 1, 1]);
  eq('B5 geen rij zonder exportstand', plan.withoutExportStateCount, 0);
  eq('B5 het exportmoment staat op het plan', plan.exportedAt, EXPORTED_AT);
}
{
  // B6 — datums: een onaangeraakte datum, een botsing, en een botsing vanuit een lege exportstand.
  const [a, b, c] = freshProject();
  S().setActualStart(a.id, '2026-03-02');
  S().setActualStart(b.id, '2026-03-02');
  const aAtExport = live(a.id);
  const bAtExport = live(b.id);
  const cAtExport = live(c.id);
  const lines: SheetLine[] = [
    { task: aAtExport, state: stateOf(aAtExport), actualStart: aAtExport.time.actualStart },
    { task: bAtExport, state: stateOf(bAtExport), actualStart: '2026-03-04' },
    { task: cAtExport, state: stateOf(cAtExport), actualStart: '2026-03-04' },
  ];
  S().setActualStart(a.id, '2026-03-03');
  S().setActualStart(b.id, '2026-03-03');
  S().setActualStart(c.id, '2026-03-03');
  const plan = S().previewProgressImport(readSheet(lines));
  eq('B6 onaangeraakte datum blijft staan', rowOf(plan.rows, a.id).outcome, 'noop');
  eq('B6 de melding draagt het veld', rowOf(plan.rows, a.id).keptApp?.map(k => k.field), ['actualStart']);
  eq('B6 twee verschillende datums botsen', rowOf(plan.rows, b.id).outcome, 'unresolved');
  eq('B6 bij export leeg, nu op beide plekken ingevuld: ook een botsing', rowOf(plan.rows, c.id).outcome, 'unresolved');
  eq('B6 de lege exportwaarde blijft leeg', rowOf(plan.rows, c.id).conflicts?.[0]?.exported, undefined);
}
{
  // B7 — precisie: "nog de exportwaarde" is exact op vier decimalen. 1/3 blijft 1/3, maar 50 → 50,4
  // in de app is een wijziging, ook al rondt het blad daar af.
  const [a, b] = freshProject();
  S().setTaskProgress(a.id, 1 / 3);
  S().setTaskProgress(b.id, 0.5);
  const aAtExport = live(a.id);
  const bAtExport = live(b.id);
  const lines = readSheet([
    { task: aAtExport, state: stateOf(aAtExport), completion: '40' },
    { task: bAtExport, state: stateOf(bAtExport), completion: '40' },
  ]);
  S().setTaskProgress(b.id, 0.504);
  const plan = S().previewProgressImport(lines);
  eq('B7 1/3 is nog de exportwaarde: gewone wijziging', rowOf(plan.rows, a.id).outcome, 'apply');
  eq('B7 50 → 50,4 in de app: botsing met het blad', rowOf(plan.rows, b.id).outcome, 'unresolved');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel C — botsingen
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const [a, b] = freshProject();
  const lines = readSheet([
    { task: a, state: stateOf(a), completion: '40' },
    { task: b, state: stateOf(b), completion: '60' },
  ]);
  S().setTaskProgress(b.id, 0.3);
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; });
  const rowNumber = rowOf(S().previewProgressImport(lines).rows, b.id).rowNumber;

  // C1 — zonder keuze schrijft de actie NIETS, ook niet de rij zonder botsing.
  const blocked = S().applyProgressImport(lines);
  eq('C1 de botsing staat nog open', blocked.unresolvedConflictCount, 1);
  eq('C1 de rij zonder botsing is niet geschreven', live(a.id).time.completion, 0);
  eq('C1 de botsrij is niet geschreven', live(b.id).time.completion, 0.3);
  eq('C1 geen undo-stap', S().historyEvents.length, 0);

  // C2 — keuze app: de app-waarde blijft, de rest gaat door.
  const keep = S().previewProgressImport(lines, undefined, { conflictChoices: choices([[rowNumber, 'app']]) });
  eq('C2 geen open botsing meer', keep.unresolvedConflictCount, 0);
  eq('C2 de rij verandert niets', rowOf(keep.rows, b.id).outcome, 'noop');
  eq('C2 de keuze staat op de rij', rowOf(keep.rows, b.id).conflictChoice, 'app');
  ok('C2 de rij blijft een botsing, dus zichtbaar en wisselbaar', rowOf(keep.rows, b.id).conflicts?.length === 1);

  // C3 — keuze blad: de bladwaarde gaat in één undo-stap mee.
  const take = S().applyProgressImport(lines, undefined, { conflictChoices: choices([[rowNumber, 'sheet']]) });
  eq('C3 twee rijen toegepast', take.appliedCount, 2);
  eq('C3 de wijziging op de botsrij', rowOf(take.rows, b.id).changes, [{ field: 'completion', before: 0.3, after: 0.6 }]);
  eq('C3 het blad staat in de app', live(b.id).time.completion, 0.6);
  eq('C3 de andere rij ook', live(a.id).time.completion, 0.4);
  eq('C3 één undo-stap', S().historyEvents.length, 1);

  // C4 — hetzelfde blad nog een keer: niets meer te doen.
  const again = S().previewProgressImport(lines);
  eq('C4 herhalen: geen wijzigingen', again.appliedCount, 0);
  eq('C4 herhalen: geen botsingen', again.conflictCount, 0);

  S().undo();
  eq('C5 undo zet de botsrij terug', live(b.id).time.completion, 0.3);
  eq('C5 undo zet de andere rij terug', live(a.id).time.completion, 0);
}
{
  // C6 — een rij met een botsing én een gewone wijziging: keuze app houdt alleen de botsing tegen.
  const [a] = freshProject();
  S().setTaskProgress(a.id, 0.1);
  const atExport = live(a.id);
  const lines = readSheet([{ task: atExport, state: stateOf(atExport), completion: '40', actualFinish: '' }]);
  S().setTaskProgress(a.id, 0.3);
  const startAtExport = atExport.time.actualStart!;
  const withStart = readSheet([{
    task: atExport, state: stateOf(atExport), completion: '40', actualStart: '2026-03-04',
  }]);
  const undecided = S().previewProgressImport(withStart);
  eq('C6 de hele rij wacht', rowOf(undecided.rows, a.id).outcome, 'unresolved');
  const rowNumber = rowOf(undecided.rows, a.id).rowNumber;
  const keep = S().previewProgressImport(withStart, undefined, { conflictChoices: choices([[rowNumber, 'app']]) });
  eq('C6 de gewone wijziging gaat door', rowOf(keep.rows, a.id).changes.map(c => c.field), ['actualStart']);
  eq('C6 de voltooiing blijft de app-waarde', rowOf(keep.rows, a.id).plannedTask?.time.completion, 0.3);
  ok('C6 de werkelijke start stond er bij de export al', startAtExport.length > 0);
  eq('C6 het blad zonder datum botst alleen op de voltooiing',
    rowOf(S().previewProgressImport(lines).rows, a.id).conflicts?.map(c => c.field), ['completion']);
}
{
  // C7 — een keuze blad die de planner weigert, blijft zichtbaar als botsing met een reden.
  const [a] = freshProject();
  const lines = readSheet([{ task: a, state: stateOf(a), actualStart: '2026-03-04', actualFinish: '2026-03-02' }]);
  S().setActualStart(a.id, '2026-03-03');
  const undecided = S().previewProgressImport(lines);
  const rowNumber = rowOf(undecided.rows, a.id).rowNumber;
  const refused = rowOf(S().previewProgressImport(lines, undefined, { conflictChoices: choices([[rowNumber, 'sheet']]) }).rows, a.id);
  eq('C7 geweigerd', refused.outcome, 'refused');
  ok('C7 met een reden', refused.reason !== undefined);
  ok('C7 de rij blijft een botsing', refused.conflicts?.length === 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel D — wanneer de exportstand niet geldt
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const [a, b] = freshProject();
  const lines = readSheet([{ task: a, state: null, completion: '0' }]);
  S().setTaskProgress(a.id, 0.5);
  const plan = S().previewProgressImport(lines);
  eq('D1 zonder exportstand: het oude gedrag', rowOf(plan.rows, a.id).changes, [{ field: 'completion', before: 0.5, after: 0 }]);
  eq('D1 de rij telt mee als zonder exportstand', plan.withoutExportStateCount, 1);
  eq('D1 geen exportmoment', plan.exportedAt, undefined);

  // Een rij die de planner aan een ANDERE taak koppelt: de stand zegt niets over die taak.
  const linked = readSheet([{ task: { ...a, id: 'bestaat-niet', wbsCode: 'x.y' }, state: stateOf(a), completion: '40' }]);
  const rowNumber = linked[0].rowNumber;
  const manual = S().previewProgressImport(linked, new Map([[rowNumber, b.id]]));
  eq('D2 koppeling aan een andere taak: geen exportstand', manual.withoutExportStateCount, 1);
  eq('D2 een gewone wijziging', rowOf(manual.rows, b.id).outcome, 'apply');

  // WBS-terugval: de rij wijst niet met zijn eigen id naar deze taak.
  const wbs = readSheet([{ task: { ...b, id: 'bestaat-niet' }, state: stateOf(b), completion: '40' }]);
  const fallback = S().previewProgressImport(wbs);
  eq('D3 WBS-terugval: geen exportstand', fallback.withoutExportStateCount, 1);

  // Een kapotte cel telt als afwezig.
  const kapot = readSheet([{ task: a, state: 'ops1|kapot', completion: '0' }]);
  eq('D4 kapotte cel: geen exportstand', S().previewProgressImport(kapot).withoutExportStateCount, 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel E — plandatums
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const [a] = freshProject();
  const atExport: Task = { ...a, time: { ...a.time, earlyFinish: '2020-01-01', scheduleFinish: '2020-01-01' } };
  const plan = S().previewProgressImport(readSheet([{ task: a, state: stateOf(atExport), completion: '40' }]));
  eq('E1 het einde verschoof sinds de export', rowOf(plan.rows, a.id).plannedShifts?.map(s => s.field), ['finish']);
  eq('E1 teller', plan.plannedShiftCount, 1);
  eq('E1 de rij gaat gewoon door', rowOf(plan.rows, a.id).outcome, 'apply');
  const same = S().previewProgressImport(readSheet([{ task: a, state: stateOf(a), completion: '40' }]));
  eq('E2 niets verschoven: geen melding', rowOf(same.rows, a.id).plannedShifts, undefined);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel F — het echte `.xlsx`
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const [a, b] = freshProject();
  S().setActualStart(a.id, '2026-03-02');
  S().setTaskProgress(a.id, 1 / 3);
  const tasks = [...flattenOrder(S().tasks)];
  const summary = tasks.find(t => t.childIds.length > 0)!;
  const text = { headerNotes: { 'OPS Export': 'niet wijzigen' }, summaryNote: '— verzameltaak: niet invullen' };

  const plain = buildProgressXlsxParts(tasks, text).find(p => p.name === 'xl/worksheets/sheet1.xml')!.xml;
  ok('F1 zonder exportmoment geen negende kolom', !plain.includes('OPS Export') && !plain.includes('hidden="1"'));

  const sheetXml = buildProgressXlsxParts(tasks, text, { exportedAt: EXPORTED_AT })
    .find(p => p.name === 'xl/worksheets/sheet1.xml')!.xml;
  ok('F2 de negende kolom is verborgen', /<col min="9" max="9"[^>]*hidden="1"/.test(sheetXml));
  ok('F2 de kolom is vergrendeld (stijl alleen-lezen tekst)', /<col min="9" max="9"[^>]*style="2"/.test(sheetXml));
  ok('F2 de kopcel draagt de sleutel', sheetXml.includes('>OPS Export — niet wijzigen<'));
  ok('F2 dimension loopt tot kolom I', sheetXml.includes(`<dimension ref="A1:I${tasks.length + 1}"/>`));
  const summaryRow = tasks.indexOf(summary) + 2;
  ok('F3 een verzameltaak heeft geen exportstand', !sheetXml.includes(`r="I${summaryRow}"`));
  const leafRow = tasks.findIndex(t => t.id === a.id) + 2;
  ok('F3 een bladtaak wel', sheetXml.includes(`r="I${leafRow}" s="2" t="inlineStr"`));

  const bytes = await writeProgressSheetXLSX(tasks, text, { exportedAt: EXPORTED_AT });
  const sheet = await parseProgressXlsx(bytes);
  eq('F4 de lezer weigert niets', sheet.fileIssue, undefined);
  const rows = finalizeProgressRows(sheet, 'dmy');
  const noop = S().previewProgressImport(rows);
  eq('F4 export en meteen terug: nul wijzigingen', noop.appliedCount, 0);
  eq('F4 geen botsingen', noop.conflictCount, 0);
  eq('F4 geen meldingen', noop.appNewerCount, 0);
  eq('F4 elke rij met voortgang heeft een exportstand', noop.withoutExportStateCount, 0);
  eq('F4 het exportmoment komt terug', noop.exportedAt, EXPORTED_AT);

  S().setTaskProgress(b.id, 0.5);
  const after = S().previewProgressImport(rows);
  eq('F5 na een wijziging in de app blijft die staan', rowOf(after.rows, b.id).outcome, 'noop');
  eq('F5 met de melding', rowOf(after.rows, b.id).keptApp, [{ field: 'completion', exported: 0, app: 0.5 }]);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  check-progress-sinds-export: ${d}`);
  console.log(`XX  check-progress-sinds-export: ${diffs.length} van ${checks} controles faalden`);
  process.exit(1);
}
console.log(`OK  check-progress-sinds-export: ${checks} controles`);
