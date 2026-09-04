import './domStub';
import { createAppStore, type AppState } from '@/state/appStore';
import { capturePayload, freshPayload, type RecoveryDocInput } from '@/state/documentContract';
import { materializeLibraryBoundary, prepareLoadedPayload } from '@/state/documentActivation';
import type { ImportResult } from '@/services/importTypes';
import { computeCalendarHash } from '@/services/library/libraryOps';
import { createSnapshot } from '@/state/snapshot';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function taskRowNames(state: AppState): string[] {
  return state.viewRows.flatMap(row => row.kind === 'task' ? [row.task.name] : []);
}

// De pure bibliotheekgrens ververst uitsluitend behind, telt open-boundarysignalen vóór die
// verversing en muteert zijn invoer niet.
{
  const store = createAppStore();
  const companyId = store.getState().addCompany('Activatiebibliotheek BV');
  store.getState().bindProjectToCompany(companyId);
  const behindPoolId = store.getState().promoteResourceToPool(companyId, {
    id: 'behind', name: 'Behind', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1,
  })!;
  const deviatedPoolId = store.getState().promoteResourceToPool(companyId, {
    id: 'deviated', name: 'Deviated', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1,
  })!;
  const removedPoolId = store.getState().promoteResourceToPool(companyId, {
    id: 'removed', name: 'Removed', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 1,
  })!;
  const behindProjectId = store.getState().addLibraryResourceToProject(companyId, behindPoolId).resourceId!;
  const deviatedProjectId = store.getState().addLibraryResourceToProject(companyId, deviatedPoolId).resourceId!;
  const removedProjectId = store.getState().addLibraryResourceToProject(companyId, removedPoolId).resourceId!;
  store.setState(state => {
    state.pools[companyId].resources.find(resource => resource.id === behindPoolId)!.costPerHour = 2;
    state.pools[companyId].resources.find(resource => resource.id === deviatedPoolId)!.costPerHour = 5;
    state.resources.find(resource => resource.id === deviatedProjectId)!.costPerHour = 4;
    state.pools[companyId].resources = state.pools[companyId].resources
      .filter(resource => resource.id !== removedPoolId);
    state.isDirty = false;
  });
  const input = capturePayload(store.getState());
  const inputBefore = JSON.stringify(input);
  const open = materializeLibraryBoundary({
    payload: input,
    companies: store.getState().companies,
    pools: store.getState().pools,
    mode: 'open-boundary',
  });
  eq('Open-boundary retourneert alle vijf signalen exact', open.signals, {
    refreshed: 1,
    deviated: 1,
    removed: 1,
    showLibraryLinkDialog: true,
    libraryRefreshNotice: 1,
  });
  eq('Behind wordt naar de poolwaarde ververst',
    open.payload.resources.find(resource => resource.id === behindProjectId)?.costPerHour, 2);
  eq('Deviated blijft ongemoeid',
    open.payload.resources.find(resource => resource.id === deviatedProjectId)?.costPerHour, 4);
  eq('Removed blijft als projectkopie bestaan',
    open.payload.resources.some(resource => resource.id === removedProjectId), true);
  eq('Een echte refresh vraagt scopegerichte redo-invalidatie', open.invalidateRedoScope, true);
  eq('De pure materializer muteert zijn input niet', JSON.stringify(input), inputBefore);
  eq('De pure materializer verandert dirty niet', open.payload.isDirty, false);
  eq('De pure materializer leidt resourcebelasting af', open.resourceLoadResult === null, false);

  const silent = materializeLibraryBoundary({
    payload: input,
    companies: store.getState().companies,
    pools: store.getState().pools,
    mode: 'silent-switch',
  });
  eq('Silent-switch ververst wel maar onderdrukt afwijkingssignalen', silent.signals, {
    refreshed: 1,
    deviated: 0,
    removed: 0,
    showLibraryLinkDialog: false,
    libraryRefreshNotice: 1,
  });
}

// Een expliciete laadprepare mag alleen solven wanneer de aanroeper dat vraagt en er nog geen
// berekenstand beschikbaar is. De invoer blijft in beide gevallen onaangeroerd.
{
  const payload = freshPayload();
  const untouched = prepareLoadedPayload(payload, { recompute: false });
  eq('Prepare zonder recompute behoudt cpmResult exact', untouched.cpmResult, null);
  eq('Prepare zonder recompute behoudt scheduleStale exact', untouched.scheduleStale, false);
  const prepared = prepareLoadedPayload(payload, { recompute: true });
  eq('Prepare met recompute vult cpmResult vóór publicatie', prepared.cpmResult === null, false);
  eq('Prepare met recompute publiceert een verse planningstoestand', prepared.scheduleStale, false);
  eq('Prepare muteert de oorspronkelijke berekenstand niet', payload.cpmResult, null);
  const preserved = prepareLoadedPayload(prepared, { recompute: true });
  eq('Prepare behoudt een reeds beschikbare berekenstand exact', preserved.cpmResult === prepared.cpmResult, true);

  const errored = freshPayload();
  errored.cpmResult = { error: 'kring' } as NonNullable<typeof errored.cpmResult>;
  const erroredActivation = materializeLibraryBoundary({
    payload: errored, companies: [], pools: {}, mode: 'silent-switch',
  });
  eq('Activatie publiceert geen schijnbelasting bij een solverfout', erroredActivation.resourceLoadResult, null);
}

// Een echte kalender-refresh maakt de planning alleen stale wanneer de gebruiker niet bewust de
// opgeslagen datums bekijkt. Datums-als-opgeslagen blijft dus ook aan de activatiegrens leidend.
{
  const payload = freshPayload();
  const companyId = 'calendar-boundary-company';
  const poolCalendarId = 'calendar-boundary-pool';
  const projectCalendar = {
    ...payload.calendar,
    libraryOrigin: {
      companyId,
      libraryItemId: poolCalendarId,
      poolVersion: 1,
      syncedHash: computeCalendarHash(payload.calendar),
    },
  };
  payload.project = { ...payload.project, companyId, companyName: 'Kalendergrens BV' };
  payload.calendar = projectCalendar;
  payload.calendars = [projectCalendar];
  payload.scheduleStale = false;
  const poolCalendar = { ...payload.calendar, id: poolCalendarId, workStartHour: payload.calendar.workStartHour + 1 };
  const companies = [{ id: companyId, name: 'Kalendergrens BV' }];
  const pools = {
    [companyId]: {
      companyId,
      companyName: 'Kalendergrens BV',
      poolVersion: 2,
      modifiedAt: '2026-08-25T00:00:00.000Z',
      calendars: [poolCalendar],
      resources: [],
    },
  };
  const normal = materializeLibraryBoundary({ payload, companies, pools, mode: 'silent-switch' });
  eq('Behind-kalender zet de normale planning stale', normal.payload.scheduleStale, true);
  const recorded = materializeLibraryBoundary({
    payload: { ...payload, datesAsRecorded: true }, companies, pools, mode: 'silent-switch',
  });
  eq('Behind-kalender respecteert datums-als-opgeslagen', recorded.payload.scheduleStale, false);
}

// Nieuw document: nooit één render met de rijen van het uitgaande document.
{
  const store = createAppStore();
  store.getState().addTask({ name: 'Oud document' });
  const states: AppState[] = [];
  let newId = '';
  const unsubscribe = store.subscribe(state => {
    if (state.activeDocumentId !== store.getInitialState().activeDocumentId) {
      newId = state.activeDocumentId;
      states.push(state);
    }
  });
  const returnedId = store.getState().newDocument();
  unsubscribe();
  eq('newDocument retourneert het gepubliceerde document-id', returnedId, newId);
  eq('newDocument publiceert het doel exact één keer', states.length, 1);
  eq('newDocument publiceert direct de lege doelrijen', states.map(taskRowNames), [[]]);
  eq('newDocument start geen stille solver', states.map(state => state.cpmResult), [null]);
}

// Dupliceren: brondata en afgeleiden horen in dezelfde publicatie bij de nieuwe kopie.
{
  const store = createAppStore();
  store.getState().addTask({ name: 'Bron voor kopie' });
  store.getState().runCPM();
  const sourceCpm = store.getState().cpmResult;
  const sourceId = store.getState().activeDocumentId;
  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => {
    if (state.activeDocumentId !== sourceId) states.push(state);
  });
  store.getState().duplicateDocument();
  unsubscribe();
  eq('duplicateDocument publiceert het doel exact één keer', states.length, 1);
  eq('duplicateDocument publiceert direct de doelrijen', states.map(taskRowNames), [['Bron voor kopie']]);
  eq('duplicateDocument behoudt de berekenstand en start geen solver', states[0]?.cpmResult === sourceCpm, true);
}

// Wisselen: een bewust ongeldige slapende resourceLoad-cache mag nooit gezaghebbend worden en de
// rijen van A mogen niet zichtbaar zijn nadat B al actief is.
{
  const store = createAppStore();
  store.getState().addTask({ name: 'Document A' });
  const documentA = store.getState().activeDocumentId;
  const documentB = store.getState().newDocument();
  store.getState().addTask({ name: 'Document B' });
  store.getState().runCPM();
  const documentBCpm = store.getState().cpmResult;
  store.getState().switchDocument(documentA);
  store.setState(state => {
    const sleepingB = state.documents.find(document => document.id === documentB)?.payload;
    if (sleepingB) sleepingB.resourceLoadResult = null;
  });

  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => {
    if (state.activeDocumentId === documentB) states.push(state);
  });
  store.getState().switchDocument(documentB);
  unsubscribe();
  eq('switchDocument publiceert het doel exact één keer', states.length, 1);
  eq('switchDocument publiceert nooit rijen van A onder document-id B',
    states.map(taskRowNames), [['Document B']]);
  eq('switchDocument leidt de resourcebelasting vóór publicatie opnieuw af',
    states.map(state => state.resourceLoadResult === null), [false]);
  eq('switchDocument behoudt cpmResult exact en start geen solver', states[0]?.cpmResult === documentBCpm, true);
}

// Sluiten van het actieve document naar zijn buur gebruikt dezelfde activatiegrens.
{
  const store = createAppStore();
  store.getState().addTask({ name: 'Te sluiten A' });
  const documentA = store.getState().activeDocumentId;
  const documentB = store.getState().newDocument();
  store.getState().addTask({ name: 'Buur B' });
  store.getState().switchDocument(documentA);
  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => {
    if (state.activeDocumentId === documentB) states.push(state);
  });
  store.getState().closeDocument(documentA);
  unsubscribe();
  eq('closeDocument publiceert de buur exact één keer', states.length, 1);
  eq('closeDocument publiceert direct de rijen van de buur', states.map(taskRowNames), [['Buur B']]);
}

// Recovery: ook de parse-/herstelroute mag niet eerst brondata, dan rijen en daarna CPM publiceren.
{
  const store = createAppStore();
  store.getState().addTask({ name: 'Voor recovery' });
  const base = freshPayload();
  const recovery: RecoveryDocInput = {
    id: 'recovery-activation',
    project: { ...base.project, id: 'recovery-project', name: 'Recoverydoel' },
    calendar: base.calendar,
    tasks: [],
    sequences: [],
    resources: [],
    assignments: [],
    resourceCalendars: base.calendars,
    activityCodeTypes: [],
    customFieldDefs: [],
    baselines: [],
    activeBaselineId: null,
    filePath: null,
    isDirty: false,
  };
  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => {
    if (state.activeDocumentId === recovery.id) states.push(state);
  });
  store.getState().restoreDocuments([recovery], recovery.id);
  unsubscribe();
  eq('restoreDocuments publiceert het recoverydoel exact één keer', states.length, 1);
  eq('restoreDocuments publiceert direct lege doelrijen', states.map(taskRowNames), [[]]);
  eq('restoreDocuments publiceert direct een afgeleide resourcebelasting',
    states.map(state => state.resourceLoadResult === null), [false]);
}

// De gedeelde open/importgrens rekent op de geïsoleerde payload en publiceert brondata, CPM en
// afgeleiden in één keer.
{
  const source = createAppStore();
  source.getState().setProject({ name: 'Ingelezen project' });
  source.getState().addTask({ name: 'Ingelezen taak' });
  const payload = capturePayload(source.getState());
  const parsed: ImportResult = {
    project: payload.project,
    calendar: payload.calendar,
    tasks: payload.tasks,
    sequences: payload.sequences,
    resources: payload.resources,
    assignments: payload.assignments,
    resourceCalendars: payload.calendars,
    activityCodeTypes: payload.activityCodeTypes,
    customFieldDefs: payload.customFieldDefs,
    baselines: payload.baselines,
    activeBaselineId: payload.activeBaselineId,
  };
  const store = createAppStore();
  store.getState().addTask({ name: 'Oude live taak' });
  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => states.push(state));
  store.getState().applyLoadedProject(parsed, {
    filePath: null,
    fileHandle: null,
    recompute: true,
    fit: false,
    hourDataNotice: false,
    linkedOpen: false,
  });
  unsubscribe();
  eq('applyLoadedProject publiceert het ingelezen document exact één keer', states.length, 1);
  eq('applyLoadedProject publiceert direct de ingelezen rijen', states.map(taskRowNames), [['Ingelezen taak']]);
  eq('applyLoadedProject publiceert CPM vóór de ene storepublicatie',
    states.map(state => state.cpmResult === null), [false]);
  eq('applyLoadedProject publiceert resourcebelasting vóór de ene storepublicatie',
    states.map(state => state.resourceLoadResult === null), [false]);
}

// De compatibele loadState-ingang draagt dezelfde recompute-intentie zelf. UI- en extensiecallers
// hoeven dus geen tweede, live runCPM-publicatie meer achter de load aan te zetten.
{
  const source = createAppStore();
  source.getState().addTask({ name: 'LoadState-doel' });
  const payload = capturePayload(source.getState());
  const parsed: ImportResult = {
    project: payload.project,
    calendar: payload.calendar,
    tasks: payload.tasks,
    sequences: payload.sequences,
    resources: payload.resources,
    assignments: payload.assignments,
    resourceCalendars: payload.calendars,
    activityCodeTypes: payload.activityCodeTypes,
    customFieldDefs: payload.customFieldDefs,
    baselines: payload.baselines,
    activeBaselineId: payload.activeBaselineId,
  };
  const store = createAppStore();
  store.getState().setZoom(77); // normale producer maakt de actuele view diep bevroren
  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => states.push(state));
  let threw = false;
  try {
    store.getState().loadState(parsed, { viewStartDate: '2035-04-06' });
  } catch {
    threw = true;
  }
  unsubscribe();
  eq('loadState met viewStartDate muteert geen bevroren live view', threw, false);
  eq('loadState publiceert brondata en berekening exact één keer', states.length, 1);
  eq('loadState publiceert direct de juiste rijen', states.map(taskRowNames), [['LoadState-doel']]);
  eq('loadState publiceert direct een CPM-resultaat', states.map(state => state.cpmResult === null), [false]);
  eq('loadState publiceert viewStartDate in dezelfde doelstaat', states.map(state => state.view.viewStartDate), ['2035-04-06']);
}

// Pool vervangen is zelf de externe open-boundary. De nieuwe pool en een achterlopende kopie in
// het actieve document mogen niet als twee achtereenvolgende storetoestanden zichtbaar worden.
{
  const store = createAppStore();
  const companyId = store.getState().addCompany('Poolactivatie BV');
  store.getState().bindProjectToCompany(companyId);
  const poolResourceId = store.getState().promoteResourceToPool(companyId, {
    id: 'pool-source', name: 'Poolbron', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 10,
  })!;
  const projectResourceId = store.getState().addLibraryResourceToProject(companyId, poolResourceId).resourceId!;
  const imported = structuredClone(store.getState().pools[companyId]);
  imported.resources.find(resource => resource.id === poolResourceId)!.costPerHour = 25;

  const states: AppState[] = [];
  const unsubscribe = store.subscribe(state => states.push(state));
  store.getState().replacePool(companyId, imported);
  unsubscribe();
  eq('replacePool publiceert pool en actieve documentgrens exact één keer', states.length, 1);
  eq('replacePool publiceert direct de ververste projectkopie',
    states.map(state => state.resources.find(resource => resource.id === projectResourceId)?.costPerHour), [25]);
  eq('replacePool publiceert direct de ververste resourcebelasting',
    states.map(state => state.resourceLoadResult === null), [false]);
}

// Een stille behind-refresh is niet undoable, maar moet een botsende redo van precies dit document
// wissen. Dat gebeurt in dezelfde brondata/afgeleiden-commit.
{
  const store = createAppStore();
  const companyId = store.getState().addCompany('Redo-activatie BV');
  store.getState().bindProjectToCompany(companyId);
  const poolResourceId = store.getState().promoteResourceToPool(companyId, {
    id: 'redo-source', name: 'Redo-bron', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 10,
  })!;
  store.getState().addLibraryResourceToProject(companyId, poolResourceId);
  const snapshot = createSnapshot(store.getState());
  store.getState().recordSessionHistoryEvent('redo-fixture', [{
    kind: 'document-data', documentId: store.getState().activeDocumentId, before: snapshot, after: snapshot,
  }]);
  store.getState().undo();
  store.setState(state => {
    state.pools[companyId].resources.find(resource => resource.id === poolResourceId)!.costPerHour = 30;
  });
  eq('Redo-setup bevat één undone documentevent',
    store.getState().historyEvents.filter(event => event.state === 'undone').length, 1);
  store.getState().refreshBehindItems(companyId);
  eq('Behind-refresh wist het botsende redo-event scopegericht',
    store.getState().historyEvents.filter(event => event.state === 'undone').length, 0);
}

if (diffs.length > 0) {
  console.error(`FAIL document-activation: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  document-activation: ${checks}/${checks}`);
}
