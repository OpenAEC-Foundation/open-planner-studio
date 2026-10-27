// Issue #405 deel 5 — "Bestaande Excel/CSV-voortgangsronde veilig afronden". Bewijs op bestaand
// gedrag, geen nieuwe importmodule. Vier delen:
//
//   Deel A — ALLEEN voortgangsvelden. Een rijk project (de IFC-schemafixture: twee+ kalenders,
//            relaties met elke lag-vorm, resources met toewijzingen en werkvelden, baselines,
//            notities, eigen velden) krijgt een CSV-blad dat voltooiing, werkelijke start en
//            werkelijk einde wijzigt, plus kolommen met een afwijkende naam, geplande start/einde en
//            duur. Daarna wordt ELK `DOCUMENT_FIELDS`-veld, en per taak en per toewijzing elk veld,
//            met het origineel vergeleken. Alleen de lijst `TOEGESTANE_TAAKPADEN` (+ de
//            toewijzingswerkvelden en de documentvlaggen) mag verschillen.
//   Deel B — annuleren en opnieuw inlezen op store-niveau: preview + annuleren laat het HELE
//            document ongewijzigd (isDirty gelijk, geen undo-stap); hetzelfde blad twee keer
//            toepassen geeft de tweede keer nul wijzigingen en geen extra undo-stap; één Ctrl+Z
//            herstelt het HELE document exact (niet alleen `completion`, zoals check-progress-import
//            Deel 4 toetst).
//   Deel C — Nederlandse notatie in CSV: dd-mm-jjjj naast ISO en de decimale komma, door de echte
//            lezer → detectie → finalizer → store. (XLSX: zie check-progress-import-xlsx.ts.)
//   Deel D — onbekende id, dubbele rij en dubbelzinnige WBS in de preview: elk een eigen `reason`,
//            en welke ervan onder "Wacht op koppeling" (`needsLinkCount`) vallen.
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import { useAppStore } from '@/state/appStore';
import { capturePayload, DOCUMENT_FIELDS, hydratePayload, payloadFromImport } from '@/state/documentContract';
import { parseProgressCsv } from '@/services/progressImport/parseProgressCsv';
import { detectDateOrder, finalizeProgressRows } from '@/services/progressImport/sheetValues';
import type { ProgressRow } from '@/services/progressImport/types';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { Task } from '@/types/task';
import { buildRichSchemaProject } from './ifcSchemaFixture';

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

/** Diepe kopie die ook Map/Set vergelijkbaar maakt (cpmResult draagt kaarten). */
function plain(value: unknown): unknown {
  if (value instanceof Map) return { __map: [...value.entries()].map(([k, v]) => [plain(k), plain(v)]) };
  if (value instanceof Set) return { __set: [...value].map(plain) };
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = plain(v);
    }
    return out;
  }
  return value;
}

/** Alle paden waarop `a` en `b` verschillen (bladniveau). */
function diffPaths(a: unknown, b: unknown, path: string, out: string[]): void {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  const isObj = (v: unknown) => v !== null && typeof v === 'object';
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const key of keys) {
      diffPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, out);
    }
    return;
  }
  out.push(path);
}

type Snapshot = Record<string, unknown>;
/** Het HELE document volgens het contract: elk `DOCUMENT_FIELDS`-veld, met taken en toewijzingen per
 *  id (een volgorde-onafhankelijke vergelijking: de import vervangt een taak op dezelfde index). */
function documentSnapshot(): Snapshot {
  const payload = capturePayload(S()) as unknown as Record<string, unknown>;
  const out: Snapshot = {};
  for (const field of DOCUMENT_FIELDS) {
    const value = payload[field.key];
    if (field.key === 'tasks' || field.key === 'assignments') {
      out[field.key] = plain(Object.fromEntries((value as { id: string }[]).map(item => [item.id, item])));
    } else {
      out[field.key] = plain(value);
    }
  }
  return out;
}

function documentDiff(before: Snapshot, after: Snapshot): string[] {
  const out: string[] = [];
  for (const field of DOCUMENT_FIELDS) diffPaths(before[field.key], after[field.key], field.key, out);
  return out;
}

/** Leest een CSV-blad zoals de dialoog: lezer → datumvolgorde → finalizer. */
function rowsFromCsv(csv: string, tasks: readonly Task[]): { rows: readonly ProgressRow[]; order: string } {
  const sheet = parseProgressCsv(csv);
  if (sheet.fileIssue) throw new Error(`testblad geweigerd: ${sheet.fileIssue}`);
  const detection = detectDateOrder(sheet.detectionCells, tasks);
  const order = detection.order === 'ambiguous' ? 'ambiguous' : detection.order;
  return { rows: finalizeProgressRows(sheet, detection.order === 'ambiguous' ? 'dmy' : detection.order), order };
}

const day = (iso: string) => iso.slice(0, 10);
const toDmy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

function resetHistory(): void {
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.isDirty = false; });
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel A — alleen voortgangsvelden
// ════════════════════════════════════════════════════════════════════════════════════════════
/**
 * Taakvelden die de import mag veranderen, met de bron:
 *  - `time.completion`, `time.actualStart`, `time.actualFinish`: de drie invulkolommen
 *    (gids `howto-voortgang-importeren.md` §2: "De app leest daaruit alleen drie waarden per taak";
 *    `buildPlan.ts` stap 5 maakt alleen voor deze drie een `CellEditIntent`).
 *  - `status`: `applyProgressInvariants` (`src/engine/taskMutationRules.ts`) leidt hem af uit de
 *    drie velden (NOT_STARTED/STARTED/COMPLETED).
 *  - `time.remainingTime`, `time.remainingMinutes`: idem, via `applyRemainingDuration` — restduur
 *    volgt uit de voltooiing.
 *  - `time.actualStart`/`time.actualFinish` worden ook AFGELEID als het blad ze niet geeft (een
 *    percentage > 0 zet een start, 100 % een einde) — zelfde invariant, zelfde velden.
 *  - `splitGaps`: alleen nivelleerpauzes (`source: 'leveling'`) vallen weg (`clearLevelingGaps` in
 *    `planTaskCellEdits`, taskEditPlan.ts) — een voortgangsboeking maakt de nivellering ongeldig.
 */
const TOEGESTANE_TAAKPADEN = new Set([
  'time.completion', 'time.actualStart', 'time.actualFinish',
  'status', 'time.remainingTime', 'time.remainingMinutes',
]);
/**
 * Toewijzingsvelden die mogen veranderen: `settleProgressWork` (`src/engine/work/workRuleApply.ts`)
 * schuift werk van rest naar verricht voor een toewijzing MET een opgeslagen restveld; het totaal
 * blijft gelijk (`applyProgressImport` in taskSlice.ts, "Zelfde werkverplaatsing als setTaskProgress").
 */
const TOEGESTANE_TOEWIJZINGSPADEN = new Set(['remainingWorkMinutes', 'actualWorkMinutes']);
/**
 * Documentvlaggen die elke mutatie zet (`finishMutation` met `stale: true`, storeRuntime.ts):
 * `isDirty` (markDocumentEdited), `importPristine` (gewist bij elke bewerking), `scheduleStale`
 * (markDateMutation: "Het inlezen rekent zelf niet door", gids §5), en in de modus "datums zoals
 * opgeslagen" ook `datesAsRecorded`/`recordedDates`.
 */
const TOEGESTANE_DOCUMENTVLAGGEN = new Set(['isDirty', 'importPristine', 'scheduleStale', 'datesAsRecorded', 'recordedDates']);

let partA: {
  rows: readonly ProgressRow[];
  ids: { pct: string; dates: string; full: string; noProgress: string };
} | undefined;

{
  const rich = buildRichSchemaProject(process.cwd());
  useAppStore.setState((s) => { hydratePayload(s, payloadFromImport(rich, null)); });
  S().runCPM();

  const leaves = S().tasks.filter(t => t.childIds.length === 0 && !t.isMilestone
    && t.time.completion === 0 && !t.time.actualStart && !t.time.actualFinish);
  ok(`A0 de rijke fixture heeft minstens vier ongestarte bladtaken (${leaves.length})`, leaves.length >= 4);
  // Bij voorkeur taken mét toewijzing, zodat de werkverplaatsing echt meedoet.
  const withAssignment = leaves.filter(t => S().assignments.some(a => a.taskId === t.id));
  const pick = [...withAssignment, ...leaves.filter(t => !withAssignment.includes(t))];
  const [tPct, tDates, tFull, tNone] = pick;
  // Geef de toewijzingen van de percentagetaak opgeslagen werkvelden (rest = alles, verricht = 0):
  // alleen dan schrijft `settleProgressWork` iets, en moet de vergelijking die schrijfactie toestaan.
  useAppStore.setState((s) => {
    for (const a of s.assignments) {
      if (a.taskId !== tPct.id && a.taskId !== tFull.id) continue;
      a.remainingWorkMinutes = 2400;
      a.actualWorkMinutes = 0;
    }
  });
  ok('A0 de percentagetaak heeft een toewijzing met restwerk (werkverplaatsing doet mee)',
    S().assignments.some(a => a.taskId === tPct.id && a.remainingWorkMinutes === 2400));
  ok('A0 het project heeft relaties met lag', S().sequences.some(q => (q.lagDays ?? 0) !== 0 || (q.lagMinutes ?? 0) !== 0));
  ok('A0 het project heeft minstens twee kalenders', S().calendars.length >= 1);
  ok('A0 het project heeft baselines', S().baselines.length >= 2);
  ok('A0 het project heeft notities', S().tasks.some(t => (t.notes ?? []).length > 0));
  ok('A0 het project heeft eigen velden', S().customFieldDefs.length > 0 && S().tasks.some(t => t.customFields && Object.keys(t.customFields).length > 0));

  // Statusdatum ná alle gebruikte datums, zodat geen rij om `actualAfterStatusDate` sneuvelt.
  const latestFinish = S().tasks.map(t => day(shownFinish(t))).sort().at(-1)!;
  S().setStatusDate(latestFinish);
  S().runCPM();
  resetHistory();

  const startOf = (t: Task) => day(shownStart(S().tasks.find(x => x.id === t.id)!));
  const finishOf = (t: Task) => day(shownFinish(S().tasks.find(x => x.id === t.id)!));

  // Kolommen die de import MOET negeren: een afwijkende naam, een verschoven geplande start/einde en
  // een duurkolom (die kent het blad niet eens). `Name`/`Start`/`Finish` bestaan wel als kolom, maar
  // dienen alleen voor herkenning en datumvolgorde (rules `import-export.md`).
  const header = 'OPS Task ID;WBS;Name;Start;Finish;Duration;Completion (%);Actual Start;Actual Finish';
  const line = (t: Task, completion: string, actualStart: string, actualFinish: string) =>
    [t.id, t.wbsCode, `ANDERE NAAM ${t.id}`, '2031-03-17', '2031-04-18', '99', completion, actualStart, actualFinish].join(';');
  const csv = [
    header,
    line(tPct, '40', '', ''),                                   // alleen een percentage
    line(tDates, '', startOf(tDates), finishOf(tDates)),         // alleen werkelijke datums (ISO)
    line(tFull, '45,5', startOf(tFull), ''),                     // percentage met komma + start
    line(tNone, '', '', ''),                                     // geen voortgang, wel "gewijzigde" naam/start/duur
  ].join('\r\n');
  const { rows } = rowsFromCsv(csv, S().tasks);
  partA = { rows, ids: { pct: tPct.id, dates: tDates.id, full: tFull.id, noProgress: tNone.id } };

  const before = documentSnapshot();
  const historyBefore = S().historyEvents.length;
  const plan = S().applyProgressImport(rows);
  eq('A1 drie rijen toegepast, één ongewijzigd', [plan.appliedCount, plan.noopCount, plan.refusedCount], [3, 1, 0]);
  eq('A1 één undo-stap', S().historyEvents.length, historyBefore + 1);
  const after = documentSnapshot();

  const changed = documentDiff(before, after);
  const touched = new Set([tPct.id, tDates.id, tFull.id]);
  const unexpected: string[] = [];
  const taskPaths = new Map<string, string[]>();
  for (const path of changed) {
    const [field, id, ...rest] = path.split('.');
    const sub = rest.join('.');
    if (field === 'tasks') {
      taskPaths.set(id, [...(taskPaths.get(id) ?? []), sub]);
      const leveling = sub.startsWith('splitGaps');
      if (!touched.has(id) || !(TOEGESTANE_TAAKPADEN.has(sub) || leveling)) unexpected.push(path);
    } else if (field === 'assignments') {
      const assignment = S().assignments.find(a => a.id === id);
      if (!assignment || !touched.has(assignment.taskId) || !TOEGESTANE_TOEWIJZINGSPADEN.has(sub)) unexpected.push(path);
    } else if (!TOEGESTANE_DOCUMENTVLAGGEN.has(field)) {
      unexpected.push(path);
    }
  }
  if (process.env.OPS_DEBUG_RONDE) console.log(changed.join('\n'));
  ok('A2 sanity: de vergelijking ziet de voortgangswijzigingen wel', changed.some(p => p.endsWith('.time.completion')));
  ok('A2 sanity: …en de werkverplaatsing', changed.some(p => p.startsWith('assignments.') && p.endsWith('remainingWorkMinutes')));
  eq('A2 buiten de voortgangsvelden en hun afleidingen verandert NIETS in het document', unexpected, []);
  ok('A2 de taak zonder voortgang (wel andere naam/start/duur in het blad) is onaangeroerd', !taskPaths.has(tNone.id));

  const get = (id: string) => S().tasks.find(t => t.id === id)!;
  eq('A3 naam blijft die van het document', get(tPct.id).name, before.tasks && (before.tasks as Record<string, Task>)[tPct.id].name);
  eq('A3 percentage 40 geschreven', get(tPct.id).time.completion, 0.4);
  eq('A3 status afgeleid (STARTED)', get(tPct.id).status, 'STARTED');
  ok('A3 werkelijke start afgeleid uit het percentage', get(tPct.id).time.actualStart !== undefined);
  eq('A3 werkelijke datums uit het blad', [day(get(tDates.id).time.actualStart!), day(get(tDates.id).time.actualFinish!)], [startOf(tDates), finishOf(tDates)]);
  eq('A3 werkelijk einde ⇒ 100 % en COMPLETED (invariant)', [get(tDates.id).time.completion, get(tDates.id).status], [1, 'COMPLETED']);
  eq('A3 "45,5" met komma ⇒ 0,455', get(tFull.id).time.completion, 0.455);

  // Werk: het totaal per toewijzing blijft gelijk; alleen de verdeling rest/verricht schuift.
  const assignmentsBefore = before.assignments as Record<string, { remainingWorkMinutes?: number; actualWorkMinutes?: number; taskId: string }>;
  for (const a of S().assignments.filter(x => touched.has(x.taskId) && x.remainingWorkMinutes !== undefined)) {
    const b = assignmentsBefore[a.id];
    const doneBefore = b.actualWorkMinutes;
    if (doneBefore === undefined) continue; // zonder verricht-veld wordt het verrichte afgeleid; het totaal is dan niet uit de velden te lezen
    ok(`A4 toewijzing ${a.id}: totaal werk gelijk (${b.remainingWorkMinutes}+${doneBefore} → ${a.remainingWorkMinutes}+${a.actualWorkMinutes})`,
      Math.abs((b.remainingWorkMinutes! + doneBefore) - (a.remainingWorkMinutes! + (a.actualWorkMinutes ?? 0))) < 1e-6);
  }

  // Deel B3: één Ctrl+Z herstelt het HELE document, niet alleen `completion`.
  S().undo();
  const undone = documentSnapshot();
  const residue = documentDiff(before, undone).filter(p => !['isDirty', 'importPristine'].includes(p.split('.')[0]));
  eq('B3 één Ctrl+Z herstelt het hele document exact (taken, toewijzingen, project, statusdatum)', residue, []);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel B — annuleren en opnieuw inlezen op store-niveau
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  const { rows } = partA!;
  useAppStore.setState((s) => { s.isDirty = false; });
  resetHistory();
  const before = documentSnapshot();

  // B1: preview bouwen en dan annuleren. Annuleren is in de dialoog "het venster sluiten zonder
  // `applyProgressImport`" — er bestaat geen eigen store-actie voor; de dialoog houdt het plan in
  // eigen React-state (ProgressImportDialog). Dus: preview, en daarna niets.
  const preview = S().previewProgressImport(rows);
  eq('B1 sanity: de preview zou drie rijen toepassen', preview.appliedCount, 3);
  eq('B1 preview + annuleren: document exact gelijk (ook isDirty)', documentDiff(before, documentSnapshot()), []);
  eq('B1 …en geen undo-stap', S().historyEvents.length, 0);

  // B2: hetzelfde blad twee keer.
  const first = S().applyProgressImport(rows);
  eq('B2 eerste keer: drie toegepast', first.appliedCount, 3);
  const afterFirst = documentSnapshot();
  const historyAfterFirst = S().historyEvents.length;
  useAppStore.setState((s) => { s.isDirty = false; });
  const afterFirstClean = documentSnapshot();
  const second = S().applyProgressImport(rows);
  eq('B2 tweede keer: nul toegepast, alles ongewijzigd',
    [second.appliedCount, second.noopCount, second.refusedCount], [0, rows.length, 0]);
  eq('B2 …geen extra undo-stap', S().historyEvents.length, historyAfterFirst);
  eq('B2 …en het document is exact gelijk (ook isDirty blijft false)', documentDiff(afterFirstClean, documentSnapshot()), []);
  ok('B2 sanity: de eerste keer veranderde wel iets', documentDiff(before, afterFirst).length > 0);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel C — Nederlandse notatie (CSV), door de echte lezer en de store
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  S().newProject();
  S().setProject({ startDate: '2026-02-16' });
  const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-02-16', 5) });
  const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-02-16', 5) });
  const idC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-02-16', 5) });
  S().setStatusDate('2026-02-27');
  S().runCPM();
  resetHistory();

  // dd-mm-jjjj (dag > 12 ⇒ eenduidig), ISO ernaast in hetzelfde blad, en een decimale komma.
  const csv = [
    'OPS Task ID;Completion (%);Actual Start;Actual Finish',
    `${idA};33,3;${toDmy('2026-02-17')};`,
    `${idB};;2026-02-18;2026-02-24`,
    `${idC};12.5;17-2-2026;`,
  ].join('\r\n');
  const { rows, order } = rowsFromCsv(csv, S().tasks);
  eq('C1 datumvolgorde dag-eerst (een dag > 12 beslist)', order, 'dmy');
  const plan = S().applyProgressImport(rows);
  eq('C1 drie rijen toegepast', [plan.appliedCount, plan.refusedCount], [3, 0]);
  const t = (id: string) => S().tasks.find(x => x.id === id)!.time;
  ok(`C2 "33,3" (komma) ⇒ 0,333 (kreeg ${t(idA).completion})`, Math.abs(t(idA).completion - 0.333) < 1e-9);
  // F2 (spec §3.6, invoer; §4.2 D1/D2): een datum uit het blad wordt een moment; de start het begin,
  // het einde het einde van de werkdag (07:00–16:00). Het lezen van het datumformaat zelf blijft
  // getoetst. Fixronde 1 deel B, B1.
  eq('C2 "17-02-2026" ⇒ 2026-02-17', t(idA).actualStart, '2026-02-17T07:00');
  eq('C3 ISO naast dd-mm-jjjj in hetzelfde blad', [t(idB).actualStart, t(idB).actualFinish], ['2026-02-18T07:00', '2026-02-24T16:00']);
  eq('C4 "12.5" (punt) ⇒ 0,125 en "17-2-2026" zonder voorloopnul', [t(idC).completion, t(idC).actualStart], [0.125, '2026-02-17T07:00']);

  // De valkuil uit de gids: een komma die een andere landinstelling als duizendtalscheider las.
  const { rows: outRows } = rowsFromCsv(`OPS Task ID;Completion (%)\r\n${idA};838`, S().tasks);
  eq('C5 "838" ⇒ percentOutOfRange (eigen reden, niet "onleesbaar")', S().previewProgressImport(outRows).rows[0]?.reason, 'percentOutOfRange');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel D — onbekende id's, dubbele rijen en dubbelzinnige WBS in de preview
// ════════════════════════════════════════════════════════════════════════════════════════════
{
  S().newProject();
  const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-02-16', 5) });
  const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-02-16', 5) });
  const idC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-02-16', 5) });
  // B en C delen een WBS-code (bv. uit een ander pakket).
  useAppStore.setState((s) => {
    s.tasks.find(x => x.id === idB)!.wbsCode = '9.9';
    s.tasks.find(x => x.id === idC)!.wbsCode = '9.9';
  });
  S().runCPM();
  const wbsA = S().tasks.find(x => x.id === idA)!.wbsCode;
  resetHistory();
  const csv = [
    'OPS Task ID;WBS;Completion (%)',
    `onbekend-id;;10`,        // onbekende id, geen WBS
    `onbekend-id-2;77.77;10`, // onbekende id en onbekende WBS
    `${idA};;20`,              // eerste claim op A
    `${idA};;30`,              // tweede claim op A
    `;${wbsA};40`,             // derde claim op A, via WBS
    `;9.9;50`,                 // WBS met twee dragers
  ].join('\r\n');
  const { rows } = rowsFromCsv(csv, S().tasks);
  const plan = S().previewProgressImport(rows);
  eq('D1 elke soort krijgt een eigen reden',
    plan.rows.map(r => [r.rowNumber, r.outcome, r.reason ?? null]),
    [[2, 'refused', 'unmatched'], [3, 'refused', 'unmatched'], [4, 'apply', null],
      [5, 'refused', 'duplicateRow'], [6, 'refused', 'duplicateRow'], [7, 'refused', 'ambiguousWbs']]);
  // "Wacht op koppeling" (needsLinkCount) telt ALLEEN unmatched + ambiguousWbs (buildPlan.ts stap 1);
  // de dubbele rijen tellen als geweigerd, niet als wachtend.
  eq('D2 Wacht op koppeling = onbekende id + dubbelzinnige WBS', plan.needsLinkCount, 3);
  eq('D2 Geweigerd telt alle vijf', plan.refusedCount, 5);
  eq('D3 de preview muteert niets', [S().historyEvents.length, S().isDirty], [0, false]);
}

if (diffs.length > 0) {
  console.error(`FAIL progress-import-ronde: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  progress-import-ronde: ${checks}/${checks}`);
}
