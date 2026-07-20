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
S().setStatusDate('2030-06-01');       // project.statusDate (niet-snapshot project-veld)
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
const valuesA: Record<string, unknown> = {
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
    s.project.calendarId = 'cal-x';
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
  tasks: [{ id: `task-${id}`, name: `Taak ${name}`, parentId: null, childIds: [] } as unknown as Task],
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
eq('d recovery: cpmResult vers null', S().cpmResult, null);
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

// Snapshot-vorm sanity: undoStack draagt `Snapshot`-objecten met de nauwe project-projectie.
S().newProject();
S().addTask({ name: 'X' });
const snap: Snapshot = S().undoStack[S().undoStack.length - 1];
truthy('d snapshot bevat de nauwe project-projectie (wbsAutoNumber)', typeof snap.project.wbsAutoNumber === 'boolean');

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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  document-contract-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  document-contract-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
