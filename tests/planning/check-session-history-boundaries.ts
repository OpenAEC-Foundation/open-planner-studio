import './domStub';
import { useAppStore } from '@/state/appStore';
import { withTransaction } from '@/state/batchTransaction';
import { runInMcpTransaction } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';
import { scopeKeysOf } from '@/state/sessionHistory';
import type { TaskGridSurfacePreferences } from '@/types/taskGrid';

const S = () => useAppStore.getState();
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

function resetActiveProject(): void {
  S().newProject();
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.isDirty = false;
  });
}

// Een geneste bulk gebruikt uitsluitend de buitenste grens.
resetActiveProject();
withTransaction(() => {
  S().addTask({ name: 'Buiten' });
  withTransaction(() => {
    S().addTask({ name: 'Binnen' });
  });
});
eq('Geneste withTransaction registreert precies één event', S().historyEvents.length, 1);
S().undo();
eq('Eén undo draait zowel de buitenste als binnenste mutatie terug', S().tasks.length, 0);

// withTransaction belooft geen rollback. Ook bij een throw moet de werkelijk bereikte tussenstand
// met één event ongedaan te maken zijn en mag de suppressiediepte niet blijven hangen.
resetActiveProject();
let threw = false;
try {
  withTransaction(() => {
    S().addTask({ name: 'Blijft na throw A' });
    S().addTask({ name: 'Blijft na throw B' });
    throw new Error('verwachte grensfout');
  });
} catch {
  threw = true;
}
ok('withTransaction geeft de callbackthrow door', threw);
eq('withTransaction rolt de reeds toegepaste mutaties niet terug',
  S().tasks.map(task => task.name), ['Blijft na throw A', 'Blijft na throw B']);
eq('Een throw registreert toch precies één werkelijk before/after-event', S().historyEvents.length, 1);
S().undo();
eq('Het ene event maakt de gedeeltelijke bulk volledig ongedaan', S().tasks.length, 0);
S().addTask({ name: 'Na throw' });
eq('Na de throw registreert een gewone mutatie weer zelfstandig history',
  S().historyEvents.filter(event => event.state === 'applied').length, 1);

// MCP heeft juist wél rollbacksemantiek: data en sessieledger blijven exact staan zoals ervoor.
resetActiveProject();
const historyBeforeMcp = JSON.stringify(S().historyEvents);
const mcpResult = runInMcpTransaction(() => {
  S().addTask({ name: 'Moet terugrollen' });
  throw new Error('mcp rollback');
});
eq('MCP meldt de callbackfout als geweigerde transactie', mcpResult.ok, false);
eq('MCP-rollback laat geen taak achter', S().tasks.length, 0);
eq('MCP-rollback laat geen history-event achter', JSON.stringify(S().historyEvents), historyBeforeMcp);

// Een niet-undoable bibliotheekrefresh wist alleen redo dat met het geraakte document botst.
resetActiveProject();
const documentA = S().activeDocumentId;
const companyId = S().addCompany('Historygrens BV');
S().bindProjectToCompany(companyId);
const poolResourceId = S().promoteResourceToPool(companyId, {
  id: 'historygrens-resource', name: 'Historygrens resource', type: 'LABOR',
  description: '', maxUnits: 1, costPerHour: 1,
})!;
const projectResourceId = S().addLibraryResourceToProject(companyId, poolResourceId).resourceId!;
useAppStore.setState(state => {
  state.historyEvents = [];
  state.nextHistorySequence = 1;
});
S().addTask({ name: 'Redo A' });
S().undo();

const documentB = S().newDocument();
S().addTask({ name: 'Redo B' });
S().undo();
S().switchDocument(documentA);
useAppStore.setState(state => {
  const poolResource = state.pools[companyId].resources.find(resource => resource.id === poolResourceId)!;
  poolResource.costPerHour = 7;
});
ok('Bibliotheekgrens-setup levert werkelijk een behind-item op',
  S().diffProjectResource(projectResourceId)?.status === 'changed');
ok('Bibliotheekrefresh past de behind-resource in A toe', S().refreshBehindItems(companyId) >= 1);
const undoneAfterRefresh = S().historyEvents.filter(event => event.state === 'undone');
eq('Bibliotheekrefresh verwijdert alleen het botsende redo-event van A',
  undoneAfterRefresh.flatMap(event => scopeKeysOf(event)), [`document:${documentB}`]);
S().switchDocument(documentB);
S().redo();
eq('Het bewaarde redo-event van B blijft werkelijk toepasbaar',
  S().tasks.map(task => task.name), ['Redo B']);

// Sluiten van A verwijdert ieder event dat A raakt. Een data+grid-compound mag niet als half
// globaal event achterblijven; een los grid-event blijft wel bestaan.
S().switchDocument(documentA);
const beforeCompound = createSnapshot(S());
S().addTask({ name: 'Compound A' });
const afterCompound = createSnapshot(S());
const gridBefore: TaskGridSurfacePreferences = {
  columns: S().taskGridSurfaces['full-task-grid'].columns.map(column => ({ ...column })),
  scrollX: S().taskGridSurfaces['full-task-grid'].scrollX,
};
const gridAfter: TaskGridSurfacePreferences = {
  columns: gridBefore.columns.map(column => ({ ...column })),
  scrollX: gridBefore.scrollX + 10,
};
const looseGridBefore: TaskGridSurfacePreferences = {
  columns: S().taskGridSurfaces['gantt-task-grid'].columns.map(column => ({ ...column })),
  scrollX: S().taskGridSurfaces['gantt-task-grid'].scrollX,
};
const looseGridAfter: TaskGridSurfacePreferences = {
  columns: looseGridBefore.columns.map(column => ({ ...column })),
  scrollX: looseGridBefore.scrollX + 20,
};
useAppStore.setState(state => {
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.taskGridSurfaces['full-task-grid'] = gridAfter;
});
S().recordSessionHistoryEvent('compound A', [
  { kind: 'document-data', documentId: documentA, before: beforeCompound, after: afterCompound },
  { kind: 'grid-preference', surface: 'full-task-grid', before: gridBefore, after: gridAfter },
]);
useAppStore.setState(state => {
  state.taskGridSurfaces['gantt-task-grid'] = looseGridAfter;
});
S().recordSessionHistoryEvent('los grid', [
  {
    kind: 'grid-preference', surface: 'gantt-task-grid',
    before: looseGridBefore, after: looseGridAfter,
  },
]);
S().switchDocument(documentB);
S().closeDocument(documentA);
eq('Sluiten van A verwijdert het volledige compoundevent maar behoudt los gridhistory',
  S().historyEvents.map(event => event.label), ['los grid']);
ok('Na sluiten verwijst geen enkele historydelta nog naar A',
  S().historyEvents.every(event => event.deltas.every(delta =>
    delta.kind === 'grid-preference' || delta.documentId !== documentA)));

if (diffs.length > 0) {
  console.error(`FAIL session-history-boundaries: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  session-history-boundaries: ${checks}/${checks}`);
}
