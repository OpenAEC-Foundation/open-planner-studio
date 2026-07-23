// Documentcontract-checks (audit P10, F1/F3) — headless tegen de ECHTE Zustand-store (zelfde
// `useAppStore.getState()`-patroon als harness.ts/check-move-task.ts). Bewijst met echte code dat
// het key-gedreven documentcontract sluit:
//
//  (a) VELD-LEK-TEST: een rijk gevuld document 1 (elk contract-veld afwijkend) round-tript via
//      switchDocument zonder verlies, en lekt niets naar een vers document 2. De asserties LOOPEN
//      over `DOCUMENT_FIELDS`, dus een nieuw contract-veld wordt automatisch mee-getest.
//  (b) UNDO/REDO-RESTORE over de snapshot-subset — óók key-gedreven over de 'clone'/'ref'-velden.
//  (c) B3-REGRESSIE: setWbsAutoNumber(aan) → undo → vlag ÉN nummering terug.
//  (d) RECOVERY-ROUND-TRIP via payloadFromInput/restoreDocuments (incl. resourceCalendars→calendars).
//  (h) PROJECT-MUTATORS (pakket H): elke project-mutator pusht precies één undo-stap bij een echte
//      wijziging en géén bij een no-op; undo/redo herstelt project + kalender-cache consistent, en
//      een undo van een taakbewerking laat de statusdatum staan (de oude B3-reden, omgekeerd).
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import {
  DOCUMENT_FIELDS,
  capturePayload,
  payloadFromInput,
  type DocumentPayload,
  type RecoveryDocInput,
} from '@/state/documentContract';
import { createSnapshot, type Snapshot } from '@/state/snapshot';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseFlexibleDate } from '@/components/common/DateTextInput';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const ne = (label: string, got: unknown, notWant: unknown) => {
  checks++;
  if (J(got) === J(notWant)) diffs.push(`${label}: had NIET ${J(notWant)} mogen zijn`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

const task = (id: string): Task | undefined => S().tasks.find(t => t.id === id);
const flat = (p: DocumentPayload) => p as unknown as Record<string, unknown>;

// ══ (a) VELD-LEK-TEST ═══════════════════════════════════════════════════════════════════════════
// Bouw document 1 rijk gevuld via ECHTE store-acties (valide data — recomputeViewRows bij een swap
// mag niet crashen), raak zo veel mogelijk contract-velden aan, en round-trip via switchDocument.
S().newProject();
const doc1Id = S().activeDocumentId;

const t1 = S().addTask({ name: 'Hoofdfase' });
const t2 = S().addTask({ name: 'Deeltaak', parentId: t1 });
const r1 = S().addResource({ name: 'Ploeg A', type: 'LABOR', description: '', maxUnits: 2 });
S().assignResource(t2, r1, 1);
S().addCalendar({ ...createDefaultCalendar(), name: 'Bibliotheek-kalender' });
S().addActivityCodeType('Bouwdeel');
S().addCustomField('Kostencode', 'text');
S().setStatusDate('2030-06-01');       // project.statusDate
S().setWbsAutoNumber(false);            // project.wbsAutoNumber
S().runCPM();                           // cpmResult + resourceLoadResult
S().saveBaseline('Nulmeting');          // baselines (+ evt. activeBaselineId)
S().selectTask(t1);                     // selectedTaskIds
S().toggleCollapse(t1);                 // collapsedTaskIds (woont in ui — de contract-uitzondering)
S().setZoom(42);                        // view
S().setFilePath('/tmp/doc1.ifc');       // filePath (+ isDirty al true door de mutaties)

// Momentopname van document 1 zoals het NU op top-level staat.
const expected = flat(capturePayload(S()));

// Open document 2 (vers). newDocument bewaart doc1 in de registry en hydrateert een verse payload.
const doc2Id = S().newDocument();
const doc2 = flat(capturePayload(S()));

// (a1) Geen lek naar document 2: elk veld dat we in doc1 afwijkend zetten, mag in doc2 niet opduiken.
for (const key of ['tasks', 'resources', 'assignments', 'activityCodeTypes', 'customFieldDefs',
  'selectedTaskIds', 'collapsedTaskIds', 'baselines', 'cpmResult', 'filePath', 'calendars'] as const) {
  ne(`a1 geen lek naar doc2: ${key}`, doc2[key], expected[key]);
}
truthy('a1 doc2 verse tasks leeg', S().tasks.length === 0);
truthy('a1 doc2 verse selectie leeg', S().selectedTaskIds.length === 0);
truthy('a1 doc2 verse undo-stack leeg', S().undoStack.length === 0);
eq('a1 doc2 vers filePath null', S().filePath, null);

// (a2) Round-trip terug naar document 1: ELK contract-veld exact terug (loop over de key-lijst).
S().switchDocument(doc1Id);
const got = flat(capturePayload(S()));
for (const f of DOCUMENT_FIELDS) {
  eq(`a2 round-trip behoudt veld '${f.key}'`, got[f.key], expected[f.key]);
}

// ══ (b) UNDO/REDO-RESTORE OVER DE SNAPSHOT-SUBSET ═══════════════════════════════════════════════
// Zet de snapshot-velden in toestand A, simuleer een muterende actie (push snapshot + muteer naar B),
// en controleer key-gedreven dat undo A herstelt en redo B. project.calendarId houden we in A én B op
// dezelfde bibliotheek-entry zodat syncProjectCalendar geen bijwerking geeft.
S().newProject();
const calX = { ...createDefaultCalendar(), id: 'cal-x', name: 'X' };
const snapKeys = DOCUMENT_FIELDS.filter(f => f.snapshot !== 'none').map(f => f.key);
// `project` en `calendar` doen sinds pakket H VOLLEDIG mee in de snapshot; ze horen dus ook in deze
// A/B-tabellen. `calendarId` wijst in beide toestanden naar `cal-x` (die in A én B in de bibliotheek
// zit), zodat de syncProjectCalendar-stap ná de restore de cache op precies `calX` zet — anders zou
// de vergelijking op `calendar` de sync-bijwerking meten i.p.v. de restore.
const projA = { id: 'proj-ab', name: 'ProjA', description: '', startDate: '2030-01-01', endDate: '', calendarId: 'cal-x', createdAt: '2030-01-01T00:00:00.000Z', modifiedAt: '2030-01-01T00:00:00.000Z', author: '', company: '', wbsAutoNumber: true };
const projB = { ...projA, name: 'ProjB', startDate: '2030-02-02', statusDate: '2030-03-03' };
const valuesA: Record<string, unknown> = {
  project: projA,
  calendar: calX,
  tasks: [{ id: 'ta', name: 'A', parentId: null, childIds: [] }],
  sequences: [],
  resources: [{ id: 'ra', name: 'RA', type: 'LABOR', description: '', maxUnits: 1 }],
  assignments: [],
  calendars: [calX],
  activityCodeTypes: [],
  customFieldDefs: [{ id: 'cfa', name: 'CFA', type: 'text', values: {} }],
  cpmResult: { marker: 'A' },
  resourceLoadResult: null,
  scheduleStale: false,
  baselines: [],
  activeBaselineId: null,
};
const valuesB: Record<string, unknown> = {
  project: projB,
  calendar: calX,
  tasks: [{ id: 'ta', name: 'A', parentId: null, childIds: [] }, { id: 'tb', name: 'B', parentId: null, childIds: [] }],
  sequences: [{ id: 'sb', predecessorId: 'ta', successorId: 'tb', type: 'FS', lag: 0 }],
  resources: [],
  assignments: [{ id: 'asb', taskId: 'tb', resourceId: 'ra', unitsPerDay: 1 }],
  calendars: [calX, { ...createDefaultCalendar(), id: 'cal-y', name: 'Y' }],
  activityCodeTypes: [{ id: 'acb', name: 'ACB', values: [] }],
  customFieldDefs: [],
  cpmResult: { marker: 'B' },
  resourceLoadResult: { marker: 'B' },
  scheduleStale: true,
  baselines: [{ id: 'blb', name: 'BL', createdAt: '2030-01-01', tasks: [] }],
  activeBaselineId: 'blb',
};
const setSnapshotFields = (vals: Record<string, unknown>) => {
  useAppStore.setState((s) => {
    // `project` (incl. calendarId 'cal-x') komt uit de tabel zelf — zie de opmerking hierboven.
    for (const f of DOCUMENT_FIELDS) {
      if (f.snapshot === 'none') continue;
      (f.set as (st: typeof s, v: unknown) => void)(s, vals[f.key]);
    }
  });
};

setSnapshotFields(valuesA);
eq('b setup: geen undo-stack', S().undoStack.length, 0);
// Simuleer een muterende actie: snapshot van A pushen, dan naar B muteren.
useAppStore.setState((s) => {
  s.undoStack.push(createSnapshot(s));
  s.redoStack = [];
});
setSnapshotFields(valuesB);
for (const key of snapKeys) eq(`b vóór undo: ${key} == B`, flat(capturePayload(S()))[key], valuesB[key]);

S().undo();
for (const key of snapKeys) eq(`b na undo: ${key} hersteld naar A`, flat(capturePayload(S()))[key], valuesA[key]);
truthy('b na undo: isDirty', S().isDirty === true);

S().redo();
for (const key of snapKeys) eq(`b na redo: ${key} weer B`, flat(capturePayload(S()))[key], valuesB[key]);

// ══ (c) B3-REGRESSIE: setWbsAutoNumber(aan) → undo herstelt vlag ÉN nummering ════════════════════
S().newProject();
const c1 = S().addTask({ name: 'Root C' });
S().setWbsAutoNumber(false);                 // vlag uit
S().updateTask(c1, { wbsCode: 'CUSTOM-9' }); // eigen nummering (eigen undo-snapshot)
eq('c setup: vlag uit', S().project.wbsAutoNumber, false);
eq('c setup: eigen wbsCode', task(c1)?.wbsCode, 'CUSTOM-9');

S().setWbsAutoNumber(true);                   // vlag aan → hernummert de boom
eq('c na aanzetten: vlag aan', S().project.wbsAutoNumber, true);
ne('c na aanzetten: wbsCode hernummerd', task(c1)?.wbsCode, 'CUSTOM-9');

S().undo();
eq('c B3: undo herstelt de vlag (was de bug — bleef true)', S().project.wbsAutoNumber, false);
eq('c B3: undo herstelt de eigen nummering', task(c1)?.wbsCode, 'CUSTOM-9');

// ══ (d) RECOVERY-ROUND-TRIP via payloadFromInput / restoreDocuments ══════════════════════════════
// Twee herstelde documenten: de actieve wordt direct gehydrateerd, de inactieve gaat via de registry
// (payloadFromInput) en moet ná switchDocument identiek terugkomen. Test tevens de resourceCalendars
// → calendars-lees-alias van het recovery-contract.
const recCalendars = [{ ...createDefaultCalendar(), id: 'cal-rec', name: 'Recovery-kalender' }];
const mkInput = (id: string, name: string): RecoveryDocInput => ({
  id,
  project: { id: `proj-${id}`, name, description: '', startDate: '2031-01-01', endDate: '', calendarId: 'cal-rec', createdAt: '', modifiedAt: '', author: '', company: '', wbsAutoNumber: true },
  calendar: recCalendars[0],
  // `time` moet erin: sinds pakket K rekent `restoreDocuments` het herstelde document dóór (runCPM),
  // net als élk ander laadpad. Een stub zónder `time` was een via `as unknown` langs het
  // typesysteem geforceerd, ongeldig Task-object — echte recovery-documenten komen uit de
  // IFC-parser en hebben altijd een volledig `time`. De stub loopt nu gewoon door de solver.
  tasks: [{ id: `task-${id}`, name: `Taak ${name}`, parentId: null, childIds: [], time: createDefaultTaskTime('2031-01-01') } as unknown as Task],
  sequences: [],
  resources: [],
  assignments: [],
  resourceCalendars: recCalendars,              // pre-2.8a-naam — moet als `calendars` landen
  activityCodeTypes: [{ id: `act-${id}`, name: 'Herstel-code', values: [] }],
  customFieldDefs: [],
  baselines: [{ id: `bl-${id}`, name: 'Herstel-BL', createdAt: '2031-01-01', tasks: [] } as never],
  activeBaselineId: `bl-${id}`,
  filePath: `/tmp/${id}.ifc`,
  isDirty: true,
});
const inA = mkInput('rec-a', 'DocA');
const inB = mkInput('rec-b', 'DocB');
S().restoreDocuments([inA, inB], 'rec-b');

// Actief = rec-b, direct gehydrateerd.
eq('d recovery: actief document is rec-b', S().activeDocumentId, 'rec-b');
eq('d recovery: project overgenomen', S().project.name, 'DocB');
eq('d recovery: tasks overgenomen', S().tasks.map(t => t.id), ['task-rec-b']);
eq('d recovery: resourceCalendars → calendars (alias)', S().calendars.map(c => c.id), ['cal-rec']);
eq('d recovery: activityCodeTypes overgenomen', S().activityCodeTypes.map(a => a.id), ['act-rec-b']);
eq('d recovery: activeBaselineId overgenomen', S().activeBaselineId, 'bl-rec-b');
eq('d recovery: filePath overgenomen', S().filePath, '/tmp/rec-b.ifc');
truthy('d recovery: isDirty', S().isDirty === true);
// Vers opgebouwde velden.
// cpmResult is sinds pakket K juist NIET meer null: `restoreDocuments` rekent het herstelde
// actieve document door, net als élk ander laadpad (openFile/openRecentFile/openExampleFromString
// gaan via applyLoadedProject met `recompute: true`). Dat is nodig omdat de writer de afgeleide
// `OPS_Analysis`-pset niet meer schrijft — zonder deze runCPM zouden bijna-kritiek-kleuring,
// float-path-tint en InterferingFloat na crashherstel leeg blijven tot de gebruiker F5 drukt.
truthy('d recovery: cpmResult doorgerekend (niet null)', S().cpmResult !== null);
eq('d recovery: cpmResult beslaat het herstelde document', S().cpmResult?.criticalPath, ['task-rec-b']);
eq('d recovery: selectedTaskIds vers leeg', S().selectedTaskIds, []);
eq('d recovery: undoStack vers leeg', S().undoStack.length, 0);

// Inactief document rec-a kwam via de registry (payloadFromInput) — switch en controleer.
S().switchDocument('rec-a');
eq('d recovery: switch naar rec-a laadt zijn project', S().project.name, 'DocA');
eq('d recovery: rec-a tasks correct', S().tasks.map(t => t.id), ['task-rec-a']);
eq('d recovery: rec-a calendars (alias)', S().calendars.map(c => c.id), ['cal-rec']);
eq('d recovery: rec-a filePath', S().filePath, '/tmp/rec-a.ifc');

// Direct payloadFromInput-eenheidscheck: alias + verse defaults.
const p = payloadFromInput(inA);
eq('d payloadFromInput: calendars uit resourceCalendars', p.calendars.map(c => c.id), ['cal-rec']);
eq('d payloadFromInput: cpmResult vers null', p.cpmResult, null);
eq('d payloadFromInput: undoStack vers leeg', p.undoStack.length, 0);

// Snapshot-vorm sanity: undoStack draagt `Snapshot`-objecten met het VOLLEDIGE project (pakket H).
S().newProject();
S().addTask({ name: 'X' });
const snap: Snapshot = S().undoStack[S().undoStack.length - 1];
truthy('d snapshot draagt het volledige project (id + naam + vlag)',
  typeof snap.project.id === 'string' && snap.project.id.length > 0 &&
  typeof snap.project.name === 'string' &&
  typeof snap.project.wbsAutoNumber === 'boolean');
truthy('d snapshot draagt de projectkalender-cache', typeof snap.calendar?.id === 'string');

// ══ (e) IN-PLACE LOAD via loadState → applyLoadedProject (key-gedreven reset-pad) ════════════════
// loadState vervangt de projectdata IN-PLACE: geen nieuw tabblad, view/inklap behouden, filePath
// ongemoeid (load-semantiek). Bewijst dat het gedeelde reset-pad (payloadFromImport + hydrate) de
// projectdata overneemt zonder view/pad te resetten.
S().newProject();
S().setZoom(77);
S().setFilePath('/tmp/behouden.ifc');
S().loadState({
  project: { id: 'proj-load', name: 'Ingeladen', description: '', startDate: '2032-01-01', endDate: '', calendarId: 'cal-default', createdAt: '', modifiedAt: '', author: '', company: '', wbsAutoNumber: true },
  calendar: createDefaultCalendar(),
  tasks: [{ id: 'task-load', name: 'Ingeladen taak', parentId: null, childIds: [] } as unknown as Task],
  sequences: [],
  resources: [],
  assignments: [],
  activityCodeTypes: [{ id: 'act-load', name: 'Code', values: [] }],
});
eq('e loadState: project overgenomen', S().project.name, 'Ingeladen');
eq('e loadState: tasks overgenomen', S().tasks.map(t => t.id), ['task-load']);
eq('e loadState: activityCodeTypes overgenomen', S().activityCodeTypes.map(a => a.id), ['act-load']);
eq('e loadState: view (zoom) BEHOUDEN', S().view.zoom, 77);
eq('e loadState: filePath ONGEMOEID', S().filePath, '/tmp/behouden.ifc');
eq('e loadState: undo-stack vers leeg', S().undoStack.length, 0);
truthy('e loadState: isDirty false na in-place load', S().isDirty === false);

// ══ (f) FROZEN-ARRAY-REGRESSIE (switchDocument na recovery, 2026-07-16) ══════════════════════════
// Een IFC-round-trip stript de projectkalender uit resourceCalendars, dus een via recovery
// hersteld NIET-ACTIEF document heeft calendars=[] terwijl project.calendarId ernaar wijst.
// switchDocument → hydratePayload wijst dan de door Immer BEVROREN payload-array toe en
// promoteProjectCalendarToLibrary moest er vervolgens in schrijven — dat gooide
// "Cannot add property 0, object is not extensible". De fix (geen .push maar een verse array)
// moet dit pad crashvrij houden én de kalender alsnog promoveren.
S().newProject();
const frozenA = mkInput('froz-a', 'FrozenA');
const frozenB: RecoveryDocInput = { ...mkInput('froz-b', 'FrozenB'), resourceCalendars: undefined };
S().restoreDocuments([frozenA, frozenB], 'froz-a');
let switchThrew: string | null = null;
try {
  S().switchDocument('froz-b');
} catch (e) {
  switchThrew = e instanceof Error ? e.message : String(e);
}
eq('f switchDocument naar hersteld doc zonder kalenderbibliotheek gooit NIET', switchThrew, null);
truthy('f projectkalender is gepromoveerd naar de bibliotheek', S().calendars.some(c => c.id === S().project.calendarId));
eq('f actief document is gewisseld', S().activeDocumentId, 'froz-b');

// ══ (g) NO-OP-UNDO-REGRESSIE (pakket R/R3) ══════════════════════════════════════════════════════
// Een AFGEWEZEN mutatie mag GEEN undo-snapshot achterlaten (anders doet Ctrl+Z één keer "niets").
// De snapshot hoort ná de validatie-guards te worden gepusht, niet ervoor.
S().newProject();
const gA = S().addTask({ name: 'GA' });
const gB = S().addTask({ name: 'GB' });
const gBase = S().undoStack.length;
S().updateTask('bestaat-niet', { name: 'X' }); // afgewezen: onbekend id
eq('g updateTask(onbekend id): geen loze undo-snapshot', S().undoStack.length, gBase);
S().addSequence({ predecessorId: gA, successorId: gB, type: 'FINISH_START' }); // geldig
eq('g addSequence geldig: undo +1', S().undoStack.length, gBase + 1);
S().addSequence({ predecessorId: gA, successorId: gB, type: 'FINISH_START' }); // exact duplicaat
eq('g addSequence(duplicaat): geen loze undo-snapshot', S().undoStack.length, gBase + 1);
// Geldige mutatie ná een afgewezen: één undo herstelt direct de juiste staat (geen no-op-stap).
S().updateTask(gA, { name: 'GA2' });
S().updateTask('ook-niet', { name: 'Y' }); // afgewezen
S().updateTask(gA, { name: 'GA3' });
S().undo();
eq('g één undo na afgewezen mutatie herstelt de juiste naam', S().tasks.find(t => t.id === gA)?.name, 'GA2');

// Zelfde bewaking voor de vijf remove/delete-acties (pakket C, TODO "Existentie-guard vóór snapshot
// in de remove*-acties"): een aanroep met een onbekend id mag GEEN undo-snapshot pushen én de
// betrokken state-array niet aanraken (nieuwe array-referentie of niet — lengte/inhoud ongewijzigd).
const gSeqCountBase = S().sequences.length;
const gUndoBaseSeq = S().undoStack.length;
S().removeSequence('seq-bestaat-niet');
eq('g removeSequence(onbekend id): geen loze undo-snapshot', S().undoStack.length, gUndoBaseSeq);
eq('g removeSequence(onbekend id): sequences ongewijzigd', S().sequences.length, gSeqCountBase);

const gTaskCountBase = S().tasks.length;
const gUndoBaseTask = S().undoStack.length;
S().deleteTask('taak-bestaat-niet');
eq('g deleteTask(onbekend id): geen loze undo-snapshot', S().undoStack.length, gUndoBaseTask);
eq('g deleteTask(onbekend id): tasks ongewijzigd', S().tasks.length, gTaskCountBase);

S().addResource({ name: 'GRes', type: 'LABOR', description: '', maxUnits: 1 });
const gResCountBase = S().resources.length;
const gUndoBaseRes = S().undoStack.length;
S().removeResource('resource-bestaat-niet');
eq('g removeResource(onbekend id): geen loze undo-snapshot', S().undoStack.length, gUndoBaseRes);
eq('g removeResource(onbekend id): resources ongewijzigd', S().resources.length, gResCountBase);

S().addCalendar({ ...createDefaultCalendar(), name: 'GCal' });
const gCalCountBase = S().calendars.length;
const gUndoBaseCal = S().undoStack.length;
S().removeCalendar('calendar-bestaat-niet');
eq('g removeCalendar(onbekend id): geen loze undo-snapshot', S().undoStack.length, gUndoBaseCal);
eq('g removeCalendar(onbekend id): calendars ongewijzigd', S().calendars.length, gCalCountBase);

S().saveBaseline('GBaseline');
const gBaselineCountBase = S().baselines.length;
const gUndoBaseBaseline = S().undoStack.length;
S().deleteBaseline('baseline-bestaat-niet');
eq('g deleteBaseline(onbekend id): geen loze undo-snapshot', S().undoStack.length, gUndoBaseBaseline);
eq('g deleteBaseline(onbekend id): baselines ongewijzigd', S().baselines.length, gBaselineCountBase);

// Andere richting van hetzelfde vangnet: met een BESTAAND id pusht elke actie WÉL precies één
// undo-stap én verkleint de betrokken array met één. Zo betrapt de check niet alleen een
// ontbrekende guard (loze stap), maar óók een guard die per ongeluk de geldige tak zou blokkeren.
// Volgorde: eerst de relatie weg (anders sleept deleteTask(gB) hem mee), dan de rest.
const gSeqValidId = S().sequences.find(
  (sq) => sq.predecessorId === gA && sq.successorId === gB && sq.type === 'FINISH_START',
)!.id;
const gUndoPreSeqDel = S().undoStack.length;
const gSeqLenPre = S().sequences.length;
S().removeSequence(gSeqValidId);
eq('g removeSequence(bestaand id): undo +1', S().undoStack.length, gUndoPreSeqDel + 1);
eq('g removeSequence(bestaand id): sequences -1', S().sequences.length, gSeqLenPre - 1);

const gUndoPreTaskDel = S().undoStack.length;
const gTaskLenPre = S().tasks.length;
S().deleteTask(gB);
eq('g deleteTask(bestaand id): undo +1', S().undoStack.length, gUndoPreTaskDel + 1);
eq('g deleteTask(bestaand id): tasks -1', S().tasks.length, gTaskLenPre - 1);

const gResValidId = S().resources.find((r) => r.name === 'GRes')!.id;
const gUndoPreResDel = S().undoStack.length;
const gResLenPre = S().resources.length;
S().removeResource(gResValidId);
eq('g removeResource(bestaand id): undo +1', S().undoStack.length, gUndoPreResDel + 1);
eq('g removeResource(bestaand id): resources -1', S().resources.length, gResLenPre - 1);

const gCalValidId = S().calendars.find((c) => c.name === 'GCal')!.id;
const gUndoPreCalDel = S().undoStack.length;
const gCalLenPre = S().calendars.length;
S().removeCalendar(gCalValidId);
eq('g removeCalendar(bestaand id): undo +1', S().undoStack.length, gUndoPreCalDel + 1);
eq('g removeCalendar(bestaand id): calendars -1', S().calendars.length, gCalLenPre - 1);

const gBaseValidId = S().baselines.find((b) => b.name === 'GBaseline')!.id;
const gUndoPreBaseDel = S().undoStack.length;
const gBaseLenPre = S().baselines.length;
S().deleteBaseline(gBaseValidId);
eq('g deleteBaseline(bestaand id): undo +1', S().undoStack.length, gUndoPreBaseDel + 1);
eq('g deleteBaseline(bestaand id): baselines -1', S().baselines.length, gBaseLenPre - 1);

// ══ (h) PROJECT VOLLEDIG IN DE SNAPSHOT (pakket H) ══════════════════════════════════════════════
// Sinds pakket H staat het HELE `project` in de undo-snapshot; voorwaarde is dat élke
// project-mutator zelf een snapshot pusht (invariant, zie de kop van snapshot.ts). Per mutator:
//   (1) een ECHTE wijziging pusht precies één undo-stap en undo herstelt de oude waarde;
//   (2) dezelfde waarde nogmaals zetten pusht GEEN stap (anders is elke "opslaan" een undo-stap —
//       `modifiedAt` verandert immers altijd en telt daarom niet mee in de vergelijking).

// (h1) setProject — echte wijziging, no-op, en undo/redo-heen-en-weer.
S().newProject();
const hBase0 = S().undoStack.length;                       // = 0 na newProject
eq('h1 setup: verse undo-stack', hBase0, 0);
const hOrigName = S().project.name;
S().setProject({ name: 'Project H-A' });
eq('h1 setProject(echte wijziging): undo +1', S().undoStack.length, hBase0 + 1);
eq('h1 setProject: naam gezet', S().project.name, 'Project H-A');
const hModified = S().project.modifiedAt;
S().setProject({ name: 'Project H-A' });                   // identieke waarde
eq('h1 setProject(identiek): GEEN undo-stap', S().undoStack.length, hBase0 + 1);
eq('h1 setProject(identiek): modifiedAt onaangeroerd', S().project.modifiedAt, hModified);
S().setProject({ name: 'Project H-A', description: '' });  // alle velden identiek
eq('h1 setProject(alle velden identiek): GEEN undo-stap', S().undoStack.length, hBase0 + 1);
S().setProject({ name: 'Project H-B' });
eq('h1 tweede wijziging: undo +2', S().undoStack.length, hBase0 + 2);
S().undo();
eq('h1 undo 1×: terug naar H-A', S().project.name, 'Project H-A');
S().undo();
eq('h1 undo 2×: terug naar de oorspronkelijke naam', S().project.name, hOrigName);
// Redo pusht een VERSE snapshot op de undo-stack — die moet het volledige project dragen.
S().redo();
eq('h1 redo 1×: weer H-A', S().project.name, 'Project H-A');
const hRedoSnap: Snapshot = S().undoStack[S().undoStack.length - 1];
truthy('h1 redo-snapshot draagt het volledige project', typeof hRedoSnap.project.id === 'string' && hRedoSnap.project.name === hOrigName);
S().redo();
eq('h1 redo 2×: weer H-B (juiste eindstand)', S().project.name, 'Project H-B');

// (h2) setStatusDate.
S().newProject();
const hSdBase = S().undoStack.length;
S().setStatusDate('2030-06-01');
eq('h2 setStatusDate(nieuw): undo +1', S().undoStack.length, hSdBase + 1);
eq('h2 setStatusDate: waarde gezet', S().project.statusDate, '2030-06-01');
S().setStatusDate('2030-06-01');
eq('h2 setStatusDate(identiek): GEEN undo-stap', S().undoStack.length, hSdBase + 1);
S().undo();
eq('h2 undo herstelt "geen statusdatum"', S().project.statusDate, undefined);
S().setStatusDate(undefined);
eq('h2 setStatusDate(undefined) terwijl er geen is: GEEN undo-stap', S().undoStack.length, hSdBase);

// (h3) setProgressMode.
S().newProject();
const hPmBase = S().undoStack.length;
S().setProgressMode('PROGRESS_OVERRIDE');
eq('h3 setProgressMode(nieuw): undo +1', S().undoStack.length, hPmBase + 1);
eq('h3 setProgressMode: waarde gezet', S().project.progressMode, 'PROGRESS_OVERRIDE');
S().setProgressMode('PROGRESS_OVERRIDE');
eq('h3 setProgressMode(identiek): GEEN undo-stap', S().undoStack.length, hPmBase + 1);
S().undo();
eq('h3 undo herstelt de default (undefined)', S().project.progressMode, undefined);

// (h4) setProjectCalendar — undo moet `project.calendarId` ÉN de gedenormaliseerde cache
// (`s.calendar`) samen terugzetten; halve state is precies wat deze golf moet uitbannen.
S().newProject();
const hCalOldId = S().project.calendarId;
const hCalNewId = S().addCalendar({ ...createDefaultCalendar(), name: 'H-kalender', hoursPerDay: 6 });
const hPcBase = S().undoStack.length;
S().setProjectCalendar(hCalNewId);
eq('h4 setProjectCalendar(nieuw): undo +1', S().undoStack.length, hPcBase + 1);
eq('h4 project.calendarId gezet', S().project.calendarId, hCalNewId);
eq('h4 cache volgt de nieuwe projectkalender', S().calendar.id, hCalNewId);
S().setProjectCalendar(hCalNewId);
eq('h4 setProjectCalendar(zelfde id): GEEN undo-stap', S().undoStack.length, hPcBase + 1);
S().setProjectCalendar('cal-bestaat-niet');
eq('h4 setProjectCalendar(onbekend id): GEEN undo-stap', S().undoStack.length, hPcBase + 1);
S().undo();
eq('h4 undo herstelt project.calendarId', S().project.calendarId, hCalOldId);
eq('h4 undo herstelt de cache CONSISTENT met het id', S().calendar.id, hCalOldId);
truthy('h4 invariant: cache == bibliotheek-entry van project.calendarId',
  J(S().calendar) === J(S().calendars.find(c => c.id === S().project.calendarId)));

// (h5) setCalendar — muteert de cache én (indien aanwezig) de bibliotheek-entry.
S().newProject();
const hScBase = S().undoStack.length;
const hCalBefore = S().calendar;
S().setCalendar({ ...hCalBefore, hoursPerDay: hCalBefore.hoursPerDay + 1 });
eq('h5 setCalendar(echte wijziging): undo +1', S().undoStack.length, hScBase + 1);
eq('h5 cache bijgewerkt', S().calendar.hoursPerDay, hCalBefore.hoursPerDay + 1);
eq('h5 bibliotheek-entry meegetrokken', S().calendars.find(c => c.id === hCalBefore.id)?.hoursPerDay, hCalBefore.hoursPerDay + 1);
S().setCalendar({ ...S().calendar });                       // identieke inhoud, nieuwe referentie
eq('h5 setCalendar(identieke inhoud): GEEN undo-stap', S().undoStack.length, hScBase + 1);
S().undo();
eq('h5 undo herstelt de cache', S().calendar.hoursPerDay, hCalBefore.hoursPerDay);
eq('h5 undo herstelt de bibliotheek-entry', S().calendars.find(c => c.id === hCalBefore.id)?.hoursPerDay, hCalBefore.hoursPerDay);

// (h6) B3-REGRESSIE OMGEKEERD — de reden dat `project` ooit BUITEN de snapshot bleef: een undo van
// een ONGERELATEERDE taakbewerking mag een eerder gezette statusdatum NIET terugdraaien. Dat werkt
// nu omdat setStatusDate zelf een snapshot pusht: de snapshot van de taakbewerking bevat de
// statusdatum al.
S().newProject();
S().setStatusDate('2030-09-09');
const hB3Task = S().addTask({ name: 'Taak na statusdatum' });
S().undo();                                   // maakt alleen de taak ongedaan
eq('h6 undo van de taakbewerking verwijdert de taak', S().tasks.find(t => t.id === hB3Task), undefined);
eq('h6 B3: statusdatum blijft staan na undo van een taakbewerking', S().project.statusDate, '2030-09-09');
S().redo();
eq('h6 redo brengt de taak terug', S().tasks.find(t => t.id === hB3Task)?.name, 'Taak na statusdatum');
eq('h6 redo laat de statusdatum staan', S().project.statusDate, '2030-09-09');
// En één undo verder ligt de statusdatum zelf wél op de stack.
S().undo();                                   // taak weg
S().undo();                                   // statusdatum weg
eq('h6 undo van setStatusDate zelf wist de statusdatum', S().project.statusDate, undefined);

// (h6b) De OMGEKEERDE volgorde is de check die echt bijt: eerst een taakbewerking, DAN de
// statusdatum. Pusht setStatusDate geen eigen snapshot, dan valt de undo terug op de snapshot van de
// taakbewerking en draait die de taakbewerking ÉN de statusdatum terug (dubbele schade — precies de
// reden dat `project` ooit buiten de snapshot bleef). Met een eigen snapshot maakt undo exact één
// stap ongedaan: de statusdatum, terwijl de taakbewerking staan blijft.
S().newProject();
const hRevTask = S().addTask({ name: 'T' });
S().updateTask(hRevTask, { name: 'T2' });
S().setStatusDate('2031-01-01');
S().undo();
eq('h6b undo maakt alleen de statusdatum ongedaan', S().project.statusDate, undefined);
eq('h6b undo laat de eerdere taakbewerking staan', S().tasks.find(t => t.id === hRevTask)?.name, 'T2');

// (h7) BESTAANDE BUG die deze golf gratis repareert: `removeCalendar` pusht wél een snapshot en
// muteert `s.project.calendarId` naar een fallback als de verwijderde kalender de projectdefault was
// (resourceSlice §9.2). Zolang `project` BUITEN de snapshot stond herstelde undo de bibliotheek maar
// NIET de projectdefault, waarna `syncProjectCalendar` de cache op de verkeerde kalender zette.
S().newProject();
const hRcOldId = S().project.calendarId;
const hRcExtra = S().addCalendar({ ...createDefaultCalendar(), id: 'cal-extra', name: 'Extra' });
S().removeCalendar(hRcOldId);                       // verwijdert de PROJECTDEFAULT
eq('h7 na removeCalendar: projectdefault viel terug op de fallback', S().project.calendarId, hRcExtra);
S().undo();
eq('h7 undo herstelt project.calendarId', S().project.calendarId, hRcOldId);
eq('h7 undo herstelt de kalender-cache consistent', S().calendar.id, hRcOldId);
truthy('h7 invariant: cache == bibliotheek-entry van project.calendarId',
  J(S().calendar) === J(S().calendars.find(c => c.id === S().project.calendarId)));

// (h8) Zelfde bestaande bug via `commitCalendarLibrary` (de kalenderdialoog-commit): die zet de
// projectdefault expliciet en pusht één snapshot voor de hele dialoogsessie.
S().newProject();
const hClOldId = S().project.calendarId;
const hClNew = { ...createDefaultCalendar(), id: 'cal-dialoog', name: 'Dialoogkalender', hoursPerDay: 6 };
S().commitCalendarLibrary([hClNew], hClNew.id);
eq('h8 na commitCalendarLibrary: nieuwe projectdefault', S().project.calendarId, hClNew.id);
eq('h8 na commitCalendarLibrary: cache volgt', S().calendar.id, hClNew.id);
S().undo();
eq('h8 undo herstelt project.calendarId', S().project.calendarId, hClOldId);
eq('h8 undo herstelt de kalender-cache consistent', S().calendar.id, hClOldId);
truthy('h8 invariant: cache == bibliotheek-entry van project.calendarId',
  J(S().calendar) === J(S().calendars.find(c => c.id === S().project.calendarId)));

// ══ (i) LIVE-COMMIT-COALESCING (pakket H) ═══════════════════════════════════════════════════════
// `DateTextInput` committeert LIVE per toetsaanslag (`handleChange` → `commitFrom`), en
// `parseFlexibleDate` accepteert een jaar van 2 én 3 cijfers. Het intypen van "01062030" levert
// daardoor DRIE geldige commits op ("2020-06-01", "0203-06-01", "2030-06-01"). Nu setStatusDate een
// undo-snapshot pusht, zou dat zonder coalescing drie undo-stappen met onzin-tussenwaarden geven.
// `typeDate` repliceert handleChange/commitFrom toetsaanslag voor toetsaanslag (die helpers zijn niet
// geëxporteerd; de échte `parseFlexibleDate` wordt wél gebruikt).
type SegKind = 'day' | 'month' | 'year';
const SEG_ORDER: { kind: SegKind; maxLen: number }[] = [
  { kind: 'day', maxLen: 2 }, { kind: 'month', maxLen: 2 }, { kind: 'year', maxLen: 4 },
];
const typeDate = (raw: string, onCommit: (iso: string) => void): string[] => {
  const seg: Record<SegKind, string> = { day: '', month: '', year: '' };
  const commits: string[] = [];
  let i = 0;
  let last = '';
  for (const ch of raw) {
    const def = SEG_ORDER[i];
    const digits = (seg[def.kind] + ch).replace(/\D/g, '').slice(0, def.maxLen);
    seg[def.kind] = digits;
    if ([seg.day, seg.month, seg.year].every(v => v !== '')) {
      const iso = parseFlexibleDate(`${seg.day}-${seg.month}-${seg.year}`);
      if (iso && iso !== last) { last = iso; commits.push(iso); onCommit(iso); }
    }
    if (digits.length >= def.maxLen && i < SEG_ORDER.length - 1) i++;
  }
  return commits;
};

S().newProject();
const iBase = S().undoStack.length;
const iCommits = typeDate('01062030', (iso) => S().setStatusDate(iso));
eq('i één ingetypte datum = drie live-commits', iCommits, ['2020-06-01', '0203-06-01', '2030-06-01']);
eq('i statusdatum: drie commits = ÉÉN undo-stap', S().undoStack.length - iBase, 1);
eq('i eindwaarde is de laatst getypte datum', S().project.statusDate, '2030-06-01');
S().undo();
eq('i één undo wist de hele ingetypte datum (geen onzin-tussenwaarde)', S().project.statusDate, undefined);

// Coalescing mag NIET over een andere mutatie heen lopen: statusdatum → taak → statusdatum = 3 stappen.
S().newProject();
const iBase2 = S().undoStack.length;
typeDate('01062030', (iso) => S().setStatusDate(iso));
S().addTask({ name: 'tussendoor' });
typeDate('02072031', (iso) => S().setStatusDate(iso));
eq('i coalescing loopt niet over een andere mutatie heen', S().undoStack.length - iBase2, 3);
// …en niet over een undo heen: na een undo moet de volgende reeks een VERSE stap pushen.
S().newProject();
typeDate('01062030', (iso) => S().setStatusDate(iso));   // stap 1
S().undo();                                              // stack 0, redo 1
const iAfterUndo = S().undoStack.length;
typeDate('02072031', (iso) => S().setStatusDate(iso));
eq('i coalescing loopt niet over een undo heen', S().undoStack.length - iAfterUndo, 1);
eq('i mutatie na undo wist de redo-stack', S().redoStack.length, 0);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  document-contract-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  document-contract-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
