// check-work-rule-library.ts — H6 (R1-rest, eigenaarsbesluit 2026-09-26 "zelfde regel als de dialoog"):
// een bibliotheekverversing van een kalender volgt de werkregel, net als de kalenderdialoog
// (`commitCalendarLibrary`, #170). Per route: Vast werk 4 d × 8 u = 32 u; de (effectieve) kalender van
// de taak gaat via de bibliotheek van 8 naar 6 u/d ⇒ 6 d, werk blijft 32 u, melding "1 taak".
//
// Routes (alle via `captureCalendarLibraryChange`/`settleCalendarLibraryChange`, state/calendarTasks.ts):
//   (a) `refreshAllDocumentsFromPool` — actief document (bibliotheekkalender bewerken ⇒ `updatePoolCalendar`)
//   (b) idem — SLAPEND document: settle op de payload, melding bij activeren
//   (c) `updateProjectCalendarFromLibrary` — expliciet gebaar, settle in DEZELFDE undo-stap
//   (d) `linkRecognizedItems` — expliciet gebaar, settle in dezelfde undo-stap
//   (e) `resolveDeviation('company')` — afwijkingenscherm "Bibliotheekwaarden gebruiken", niet-undoable
//   (f) `materializeBehindOnlyRefresh` — openen van een bestand dat 'behind' is, en activeren
//   (g) idempotentie: heropenen zonder opslaan ⇒ dezelfde verversing + settle ⇒ dezelfde duur
// Niet-undoable routes: geen undo-stap, geen isDirty, wel scheduleStale — zoals de verversing zelf.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { materializeBehindOnlyRefresh } from '@/state/documentActivation';
import { capturePayload } from '@/state/documentContract';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: kreeg ${g}, verwachtte ${w}`);
}

type Store = ReturnType<typeof createAppStore>;
const DUR_KEY = 'notifications.workRuleDurationsChanged';
const LOST_KEY = 'notifications.mppTimephasedSteeringLost';

interface Fixture {
  store: Store;
  S: () => ReturnType<Store['getState']>;
  /** Vast werk op de gekoppelde projectkalender. */
  t: string;
  r: string;
  /** Standaardregel op dezelfde kalender (duur blijft). */
  q: string;
  /** Urentaak op dezelfde kalender (buiten de regel); '' zonder urentaak. */
  h: string;
  cid: string;
  poolId: string;
}

/** Project met een gekoppelde projectkalender (8 u, gepromoveerd naar de bibliotheek).
 *  `hourTask: false` voor de IFC-scenario's: een urentaak in het bestand laat de lezer de
 *  projectkalender als werktijdbanden teruglezen (uur-modus-post-pass), waarna de kopie 'wijkt af'
 *  in plaats van 'loopt achter' — los van H6, en dan ververst de open-grens terecht niets. */
function fixture(opts: { link?: boolean; hourTask?: boolean } = {}): Fixture {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  S().ensureProjectCalendarInLibrary();
  const t = S().addTask({ name: 'Vast werk', time: createDefaultTaskTime('2026-06-01', 4) });
  const r = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
  S().assignResource(t, r, 1);
  S().setTaskWorkRule(t, 'FIXED_WORK'); // 4 d × 8 u = 32 u vastgelegd
  const q = S().addTask({ name: 'Standaard', time: createDefaultTaskTime('2026-06-01', 4) });
  S().assignResource(q, S().addResource({ name: 'Ploeg q', type: 'LABOR', description: '', maxUnits: 1 }), 1);
  let h = '';
  if (opts.hourTask !== false) {
    h = S().addTask({ name: 'Uren', time: createDefaultTaskTime('2026-06-01', 10, 'hours', S().calendar) });
    S().assignResource(h, S().addResource({ name: 'Ploeg h', type: 'LABOR', description: '', maxUnits: 1 }), 1);
    S().setTaskWorkRule(h, 'FIXED_WORK');
  }
  S().runCPM();
  let cid = '';
  let poolId = '';
  if (opts.link !== false) {
    cid = S().addCompany('Bouwbedrijf');
    S().bindProjectToCompany(cid);
    const pid = S().project.calendarId;
    poolId = S().promoteCalendarToPool(cid, S().calendars.find((c) => c.id === pid)!)!;
  }
  quiet(store);
  return { store, S, t, r, q, h, cid, poolId };
}
/** Schone lei: geen meldingen, niet gewijzigd — zodat de routes zelf zichtbaar worden. */
function quiet(store: Store): void {
  store.setState((s) => { s.ui.notifications = []; s.isDirty = false; });
}
const sixHours = (c: WorkCalendar): WorkCalendar => ({ ...structuredClone(c), workEndHour: 13, hoursPerDay: 6 });
const poolCal = (f: Fixture) => f.S().pools[f.cid].calendars.find((c) => c.id === f.poolId)!;
const taskOf = (f: Fixture, id: string): Task => f.S().tasks.find((x) => x.id === id)!;
const asgOf = (f: Fixture, id: string): ResourceAssignment => f.S().assignments.find((a) => a.taskId === id)!;
const dur = (f: Fixture, id: string) => taskOf(f, id).time.scheduleDuration;
const msgs = (f: Fixture, key: string) => f.S().ui.notifications.filter((n) => n.messageKey === key).map((n) => n.params?.count);
const appliedEvents = (f: Fixture) => f.S().historyEvents.filter((e) => e.state === 'applied').length;
/** De afwijkende kopie: pool 6 u, projectkopie lokaal terug naar 8 u (Vast werk ⇒ weer 4 d). */
function deviatedToEight(f: Fixture): void {
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  f.S().updateCalendar(f.S().project.calendarId, { workEndHour: 16, hoursPerDay: 8 });
  f.S().runCPM();
  quiet(f.store);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) refreshAllDocumentsFromPool, actief document --');
{
  const f = fixture();
  const hBefore = JSON.stringify({ time: taskOf(f, f.h).time, asg: asgOf(f, f.h) });
  const qWorkBefore = asgOf(f, f.q).remainingWorkMinutes;
  const ev0 = appliedEvents(f);
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  eq('a0 voorwaarde: projectkopie ververst naar 6 u', f.S().calendar.hoursPerDay, 6);
  eq('a1 Vast werk 32 u, kalender 8→6 u/d ⇒ 6 d, werk blijft 32 u', [dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes], [6, 32 * 60]);
  eq('a2 standaardregel op dezelfde kalender: duur blijft 4, geen werkveld', [dur(f, f.q), asgOf(f, f.q).remainingWorkMinutes], [4, qWorkBefore]);
  eq('a3 urentaak: byte-identiek', JSON.stringify({ time: taskOf(f, f.h).time, asg: asgOf(f, f.h) }), hBefore);
  eq('a4 niet-undoable zoals de verversing: geen undo-stap, geen isDirty, wel stale', [appliedEvents(f) - ev0, f.S().isDirty, f.S().scheduleStale], [0, false, true]);
  eq('a5 één melding "1 taak" (dezelfde als de kalenderdialoog)', msgs(f, DUR_KEY), [1]);
  // Een tweede poolbewerking die de kalender NIET raakt (resource) ⇒ geen settle, geen melding.
  quiet(f.store);
  const pr = f.S().addPoolResource(f.cid, { name: 'Los', type: 'LABOR', description: '', maxUnits: 1 })!;
  f.S().updatePoolResource(f.cid, pr, { maxUnits: 2 });
  eq('a6 poolbewerking zonder kalenderwijziging: duur blijft 6, geen melding', [dur(f, f.t), msgs(f, DUR_KEY)], [6, []]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a-lost) verlies van tijdgefaseerde sturing: dezelfde melding als de dialoog --');
{
  const f = fixture();
  f.S().updateTask(f.t, { timephasedFinishFloor: '2026-06-04T17:00', timephasedStartAnchor: '2026-06-01T08:00' });
  quiet(f.store);
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  eq('al1 Z8-venster gewist bij de duurwijziging uit de werkregel', [dur(f, f.t), taskOf(f, f.t).timephasedFinishFloor], [6, undefined]);
  eq('al2 melding "sturing verloren" voor 1 taak', msgs(f, LOST_KEY), [1]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) refreshAllDocumentsFromPool, SLAPEND document --');
{
  const f = fixture();
  const docA = f.S().activeDocumentId;
  f.S().newDocument();
  quiet(f.store);
  const payloadOf = () => f.S().documents.find((d) => d.id === docA)!.payload!;
  const ev0 = f.S().historyEvents.length;
  f.S().updatePoolCalendar(f.cid, f.poolId, { ...sixHours(poolCal(f)), workEndHour: 14, hoursPerDay: 7 });
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  const pt = payloadOf().tasks.find((x) => x.id === f.t)!;
  const pa = payloadOf().assignments.find((a) => a.taskId === f.t)!;
  eq('b1 slapende payload: settle op zijn eigen taken (8→7→6 u ⇒ 6 d, werk 32 u)', [payloadOf().calendar.hoursPerDay, pt.time.scheduleDuration, pa.remainingWorkMinutes], [6, 6, 32 * 60]);
  eq('b2 …niet-undoable en niet gewijzigd: geen history, isDirty blijft false, wel stale', [f.S().historyEvents.length - ev0, payloadOf().isDirty, payloadOf().scheduleStale], [0, false, true]);
  eq('b3 geen melding zolang het document slaapt (het actieve document is niet geraakt)', msgs(f, DUR_KEY), []);
  f.S().switchDocument(docA);
  eq('b4 bij activeren: één samenvattende melding voor het document, de taak één keer geteld', msgs(f, DUR_KEY), [1]);
  eq('b5 …en de taak staat op 6 d', dur(f, f.t), 6);
  quiet(f.store);
  const docB = f.S().documents.find((d) => d.id !== docA)!.id;
  f.S().switchDocument(docB);
  f.S().switchDocument(docA);
  eq('b6 opnieuw wisselen: de melding komt niet nog eens', msgs(f, DUR_KEY), []);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) updateProjectCalendarFromLibrary: settle in dezelfde undo-stap --');
{
  const f = fixture();
  deviatedToEight(f);
  eq('c0 voorwaarde: afwijkende kopie 8 u, taak 4 d', [f.S().calendar.hoursPerDay, dur(f, f.t)], [8, 4]);
  const ev0 = appliedEvents(f);
  f.S().updateProjectCalendarFromLibrary(f.S().project.calendarId);
  eq('c1 bijwerken vanuit de bibliotheek 8→6 u ⇒ 6 d, werk 32 u', [f.S().calendar.hoursPerDay, dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes], [6, 6, 32 * 60]);
  eq('c2 één undo-stap, melding "1 taak"', [appliedEvents(f) - ev0, msgs(f, DUR_KEY)], [1, [1]]);
  f.S().undo();
  eq('c3 undo zet kalender én duur in één stap terug', [f.S().calendar.hoursPerDay, dur(f, f.t)], [8, 4]);
  f.S().redo();
  eq('c4 redo: weer 6 u en 6 d', [f.S().calendar.hoursPerDay, dur(f, f.t)], [6, 6]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) linkRecognizedItems: settle in dezelfde undo-stap --');
{
  const f = fixture({ link: false });
  const cid = f.S().addCompany('Bouwbedrijf');
  const poolId = f.S().promoteCalendarToPool(cid, { ...sixHours(f.S().calendar), id: 'bron', name: f.S().calendar.name })!;
  f.S().bindProjectToCompany(cid);
  quiet(f.store);
  const ev0 = appliedEvents(f);
  f.S().linkRecognizedItems([{ kind: 'calendar', projectId: f.S().project.calendarId, poolId }]);
  eq('d1 koppelen aan de 6-u-bibliotheekkalender ⇒ 6 d, werk 32 u', [f.S().calendar.hoursPerDay, dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes], [6, 6, 32 * 60]);
  eq('d2 één undo-stap, melding "1 taak"', [appliedEvents(f) - ev0, msgs(f, DUR_KEY)], [1, [1]]);
  f.S().undo();
  eq('d3 undo zet kalender, koppeling én duur in één stap terug', [f.S().calendar.hoursPerDay, f.S().calendar.libraryOrigin, dur(f, f.t)], [8, undefined, 4]);
  // Alleen resources koppelen: geen kalenderwijziging, dus geen settle en geen melding.
  quiet(f.store);
  const pr = f.S().addPoolResource(cid, { name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 })!;
  f.S().linkRecognizedItems([{ kind: 'resource', projectId: f.r, poolId: pr }]);
  eq('d4 alleen een resource koppelen: duur blijft 4, geen melding', [dur(f, f.t), msgs(f, DUR_KEY)], [4, []]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) resolveDeviation(company): "Bibliotheekwaarden gebruiken", niet-undoable --');
{
  const f = fixture();
  deviatedToEight(f);
  const ev0 = appliedEvents(f);
  f.S().resolveDeviation({ kind: 'calendar', projectId: f.S().project.calendarId }, 'company');
  eq('e1 bibliotheekwaarden 6 u ⇒ 6 d, werk 32 u', [f.S().calendar.hoursPerDay, dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes], [6, 6, 32 * 60]);
  eq('e2 geen undo-stap, geen isDirty, wel stale; melding "1 taak"', [appliedEvents(f) - ev0, f.S().isDirty, f.S().scheduleStale, msgs(f, DUR_KEY)], [0, false, true, [1]]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (f) activatiegrens: openen van een bestand dat achterloopt, en wisselen naar een achterlopend document --');
{
  const f = fixture({ hourTask: false });
  const ifc = writeIFC(buildWriteIFCInput(f.S()));
  // Bibliotheek intussen naar 6 u terwijl het document niet gekoppeld open is: los maken, pool wijzigen.
  f.S().newProject();
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  quiet(f.store);
  f.S().applyLoadedProject(readIFC(ifc), { linkedOpen: true, recompute: true, filePath: null });
  eq('f1 openen: kalender ververst naar 6 u en Vast werk ⇒ 6 d, werk 32 u', [f.S().calendar.hoursPerDay, dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes], [6, 6, 32 * 60]);
  eq('f2 …standaardregel blijft 4 d; melding "1 taak"; niet gewijzigd', [dur(f, f.q), msgs(f, DUR_KEY), f.S().isDirty], [4, [1], false]);
}
{
  // Wisselen: `replacePool` ververst alleen het ACTIEVE document; het slapende gekoppelde document
  // loopt achter en settelt bij zijn activering (materializeBehindOnlyRefresh).
  const f = fixture();
  const docA = f.S().activeDocumentId;
  const pool6 = structuredClone(f.S().pools[f.cid]);
  pool6.calendars = pool6.calendars.map((c) => (c.id === f.poolId ? sixHours(c) : c));
  pool6.poolVersion += 1;
  f.S().newDocument();
  f.S().replacePool(f.cid, pool6);
  const pt = f.S().documents.find((d) => d.id === docA)!.payload!.tasks.find((x) => x.id === f.t)!;
  eq('f3 voorwaarde: slapend document nog niet ververst (4 d)', pt.time.scheduleDuration, 4);
  quiet(f.store);
  f.S().switchDocument(docA);
  eq('f4 activeren: ververst naar 6 u en Vast werk ⇒ 6 d; melding "1 taak"', [f.S().calendar.hoursPerDay, dur(f, f.t), msgs(f, DUR_KEY)], [6, 6, [1]]);
  eq('f5 …activeren is geen bewerking: niet gewijzigd', f.S().isDirty, false);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (g) idempotentie: heropenen zonder opslaan geeft hetzelfde resultaat --');
{
  const f = fixture({ hourTask: false });
  const ifc = writeIFC(buildWriteIFCInput(f.S())); // opgeslagen met 8 u, synchroon met de bibliotheek
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  const snap = () => ({
    hpd: f.S().calendar.hoursPerDay,
    t: [dur(f, f.t), asgOf(f, f.t).remainingWorkMinutes, asgOf(f, f.t).unitsPerDay],
    q: [dur(f, f.q), asgOf(f, f.q).remainingWorkMinutes, asgOf(f, f.q).unitsPerDay],
  });
  const afterRefresh = snap();
  eq('g1 voorwaarde: verversing gaf 6 d en liet het document ongewijzigd', [afterRefresh.t[0], f.S().isDirty], [6, false]);
  // Nog een keer dezelfde grens over het al-ververste document: niets meer te doen.
  const again = materializeBehindOnlyRefresh({ payload: capturePayload(f.S()), companies: f.S().companies, pools: f.S().pools });
  eq('g2 dezelfde grens nogmaals: 0 kalenders ververst, taken ongemoeid', [again.calendarsChanged, again.payload.tasks === f.S().tasks], [0, true]);
  // Heropenen van het niet-opgeslagen bestand (8 u, oude duur): de open-grens ververst en settelt opnieuw.
  f.S().applyLoadedProject(readIFC(ifc), { linkedOpen: true, recompute: true, filePath: null });
  eq('g3 heropend zonder opslaan ⇒ hetzelfde resultaat als na de verversing', snap(), afterRefresh);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (g2) idempotentie over alle vier de regels, een gestarte taak en twee verversingen in de sessie --');
{
  // In de sessie ververst de bibliotheek in TWEE stappen (8 → 7 → 6 u/d); het niet-opgeslagen bestand
  // heropenen ververst in ÉÉN stap (8 → 6). De settle mag daar niet van afhangen.
  const f = fixture({ hourTask: false });
  const S = f.S;
  const mk = (name: string, rule: 'FIXED_WORK' | 'FIXED_RATE' | 'FIXED_DURATION_WORK' | 'FIXED_DURATION_RATE', days: number): string => {
    const t = S().addTask({ name, time: createDefaultTaskTime('2026-06-01', days) });
    S().assignResource(t, S().addResource({ name: `r-${name}`, type: 'LABOR', description: '', maxUnits: 2 }), 1);
    S().setTaskWorkRule(t, rule);
    return t;
  };
  const ids = [
    mk('vast-werk', 'FIXED_WORK', 5),
    mk('vaste-inzet', 'FIXED_RATE', 5),
    mk('vaste-duur-werk', 'FIXED_DURATION_WORK', 5),
    mk('standaard', 'FIXED_DURATION_RATE', 5),
  ];
  // Gestarte taak onder Vast werk: 10 d, 40 % gereed op de statusdatum.
  const started = mk('gestart', 'FIXED_WORK', 10);
  S().setStatusDate('2026-06-05');
  S().setActualStart(started, '2026-06-01');
  S().setTaskProgress(started, 0.4);
  ids.push(started, f.t, f.q);
  S().runCPM();
  const ifc = writeIFC(buildWriteIFCInput(S()));
  const snap = () => ids.map((id) => {
    const t = taskOf(f, id);
    const a = asgOf(f, id);
    return [t.name, t.time.scheduleDuration, t.time.remainingTime ?? null, t.time.completion, a.unitsPerDay, a.remainingWorkMinutes ?? null];
  });
  const seven = (c: WorkCalendar): WorkCalendar => ({ ...structuredClone(c), workEndHour: 15, hoursPerDay: 7 });
  f.S().updatePoolCalendar(f.cid, f.poolId, seven(poolCal(f)));
  f.S().updatePoolCalendar(f.cid, f.poolId, sixHours(poolCal(f)));
  const stepwise = snap();
  f.S().applyLoadedProject(readIFC(ifc), { linkedOpen: true, recompute: true, filePath: null });
  eq('g4 twee verversingen in de sessie ⇔ één verversing bij heropenen: zelfde duur, rest, %, inzet en werk', snap(), stepwise);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${checks} checks, ${diffs.length} afwijkingen`);
for (const d of diffs) console.log(`XX ${d}`);
if (diffs.length > 0) process.exit(1);
console.log('OK  check-work-rule-library: bibliotheekverversing van een kalender volgt de werkregel op elke route');
