import { useAppStore, test, assert, assertEq, run } from './harness';
import type { Baseline } from '@/types/baseline';
import { displayDocumentTitle } from '@/utils/documents';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

function seedSource(name: string, taskNames: string[] = ['Alpha', 'Beta']): string[] {
  useAppStore.getState().newDocument();
  useAppStore.setState((s) => {
    s.documents = [{ id: s.activeDocumentId, payload: null }];
    s.project = { ...s.project, name };
  });
  const ids = taskNames.map((n) => useAppStore.getState().addTask({ name: n }));
  const baseline: Baseline = {
    id: 'bl1',
    name: 'BL',
    createdAt: '2026-01-01T00:00:00.000Z',
    tasks: [],
    projectEnd: '2026-06-01',
    projectDuration: 100,
  };
  useAppStore.setState((s) => {
    s.filePath = '/tmp/source.ifc';
    s.fileHandle = { name: 'fake-handle' } as unknown as FileSystemFileHandle;
    s.baselines = [baseline];
    s.activeBaselineId = 'bl1';
    s.selectedTaskIds = [ids[0]];
    s.isDirty = false;
    s.historyEvents = [];
    s.nextHistorySequence = 1;
  });
  return ids;
}

function sourceEntry(newId: string) {
  return useAppStore.getState().documents.find((d) => d.id !== newId)!;
}

test('1 — kopie is actief en zowel bron als kopie zijn open', () => {
  seedSource('Project X');
  assertEq(useAppStore.getState().getOpenDocuments().length, 1, 'setup: precies 1 document');
  const newId = useAppStore.getState().duplicateDocument();
  const s = useAppStore.getState();
  assertEq(s.activeDocumentId, newId, 'nieuwe kopie is het actieve document');
  const docs = s.getOpenDocuments();
  assertEq(docs.length, 2, 'twee documenten open (bron + kopie)');
  assert(docs.some((d) => d.id === newId && d.isActive), 'kopie staat als actief in de lijst');
  assert(docs.some((d) => d.id !== newId && !d.isActive), 'bron staat als inactief in de lijst');
});

test('2 — filePath/fileHandle van de kopie zijn null; de bron behoudt ze', () => {
  seedSource('Project X');
  const newId = useAppStore.getState().duplicateDocument();
  const s = useAppStore.getState();
  assertEq(s.filePath, null, 'kopie filePath is null');
  assertEq(s.fileHandle, null, 'kopie fileHandle is null');
  const src = sourceEntry(newId).payload!;
  assertEq(src.filePath, '/tmp/source.ifc', 'bron filePath onveranderd');
  assert(src.fileHandle != null, 'bron fileHandle onveranderd');
});

test('3 — de kopie is dirty', () => {
  seedSource('Project X');
  useAppStore.getState().duplicateDocument();
  assertEq(useAppStore.getState().isDirty, true, 'kopie isDirty is true');
});

test('4 — geen gedeelde arrays: muteren in de kopie raakt de bron niet (+ !==-bewijs)', () => {
  seedSource('Project X', ['Alpha', 'Beta']);
  const s0 = useAppStore.getState();
  const srcTasksRef = s0.tasks;
  const srcFirstName = s0.tasks[0].name;
  const newId = s0.duplicateDocument();
  const s1 = useAppStore.getState();
  const src = sourceEntry(newId).payload!;

  assert(src.tasks === srcTasksRef, 'bron-tasks-referentie behouden in de registry');
  assert(s1.tasks !== src.tasks, 'kopie-tasks is een ander array-object (!==)');
  assert(s1.tasks[0] !== src.tasks[0], 'kopie-taak-object is niet de bron-taak (!==)');
  assert(s1.project !== src.project, 'kopie-project is een ander object (!==)');
  assert(s1.baselines !== src.baselines, 'kopie-baselines is een ander array-object (!==)');

  const copyFirstId = s1.tasks[0].id;
  useAppStore.getState().updateTask(copyFirstId, { name: 'GEWIJZIGD' });
  const s2 = useAppStore.getState();
  assertEq(s2.tasks[0].name, 'GEWIJZIGD', 'kopie-taaknaam gewijzigd');
  assertEq(sourceEntry(newId).payload!.tasks[0].name, srcFirstName, 'bron-taaknaam onveranderd');

  const srcLen = sourceEntry(newId).payload!.tasks.length;
  const copyLen = useAppStore.getState().tasks.length;
  useAppStore.getState().addTask({ name: 'Extra' });
  assertEq(useAppStore.getState().tasks.length, copyLen + 1, 'kopie kreeg een extra taak');
  assertEq(sourceEntry(newId).payload!.tasks.length, srcLen, 'bron-tasklengte ongewijzigd');
});

test('5 — verse lege undo-stack; undo in de kopie raakt de bron niet', () => {
  seedSource('Project X', ['Alpha']);
  const newId = useAppStore.getState().duplicateDocument();
  const s = useAppStore.getState();
  assertEq(historyDepthsForActiveScope(s), { undoDepth: 0, redoDepth: 0 }, 'kopiegeschiedenis is leeg');

  const cid = s.tasks[0].id;
  useAppStore.getState().updateTask(cid, { name: 'K1' });
  assert(historyDepthsForActiveScope(useAppStore.getState()).undoDepth >= 1,
    'mutatie in de kopie maakte een history-event');
  useAppStore.getState().undo();
  const s2 = useAppStore.getState();
  assertEq(s2.tasks[0].name, 'Alpha', 'undo herstelde de kopie-taaknaam');

  const src = sourceEntry(newId).payload!;
  assertEq(src.tasks[0].name, 'Alpha', 'bron ongemoeid door undo in de kopie');
  assert(!('historyEvents' in src), 'bronpayload draagt geen sessiehistorie');
});

test('6 — variantnummering (2, dan 3) en expliciete naam wint', () => {
  seedSource('Gebouw');
  const id1 = useAppStore.getState().duplicateDocument();
  assertEq(useAppStore.getState().project.name, 'Gebouw (variant 2)', 'eerste variant → 2');
  const id2 = useAppStore.getState().duplicateDocument();
  assertEq(useAppStore.getState().project.name, 'Gebouw (variant 3)', 'tweede variant → 3');
  const id3 = useAppStore.getState().duplicateDocument('Mijn eigen naam');
  assertEq(useAppStore.getState().project.name, 'Mijn eigen naam', 'expliciete naam wint');
  assert(id1 !== id2 && id2 !== id3 && id1 !== id3, 'alle nieuwe document-ids zijn uniek');
});

test('7 — baselines + activeBaselineId reizen mee naar de kopie', () => {
  seedSource('Project X');
  const newId = useAppStore.getState().duplicateDocument();
  const s = useAppStore.getState();
  assertEq(s.baselines.length, 1, 'kopie heeft de baseline');
  assertEq(s.baselines[0].id, 'bl1', 'kopie-baseline heeft het juiste id');
  assertEq(s.activeBaselineId, 'bl1', 'kopie behoudt activeBaselineId');
  assert(s.baselines !== sourceEntry(newId).payload!.baselines, 'kopie-baselines is een ander array (!==)');
});

test('8 — naamloze bron: kopie blijft naamloos in de DATA maar krijgt een volgnummer', () => {
  seedSource('');
  useAppStore.setState((s) => { s.filePath = null; s.fileHandle = null; });
  const newId = useAppStore.getState().duplicateDocument();
  const s = useAppStore.getState();
  assertEq(s.project.name, '', 'de kopie hoort naamloos te blijven — geen " (variant 2)" in de projectdata');
  assertEq(sourceEntry(newId).payload!.project.name, '', 'de bron hoort óók naamloos te blijven');

  const docs = s.getOpenDocuments();
  assertEq(docs.length, 2, 'twee documenten open');
  assertEq(docs.map((d) => d.title), ['', ''], 'de store blijft een lege titel leveren (datalaag)');
  assertEq(docs.map((d) => d.untitledOrdinal), [undefined, 2],
    'het eerste naamloze document blijft ongenummerd, het tweede krijgt volgnummer 2');
  assertEq(docs.map((d) => displayDocumentTitle(d.title, d.untitledOrdinal, 'Nieuwe planning')),
    ['Nieuwe planning', 'Nieuwe planning (2)'], 'de twee tabbladen zijn onderscheidbaar');

  const third = useAppStore.getState().duplicateDocument();
  assert(!!third, 'derde document aangemaakt');
  assertEq(useAppStore.getState().getOpenDocuments().map((d) => d.untitledOrdinal), [undefined, 2, 3],
    'een derde naamloos document telt door');
});

test('9 — één naamloos document krijgt géén volgnummer (niets te onderscheiden)', () => {
  seedSource('');
  useAppStore.setState((s) => { s.filePath = null; s.fileHandle = null; });
  const docs = useAppStore.getState().getOpenDocuments();
  assertEq(docs.length, 1, 'precies één document');
  assertEq(docs[0].untitledOrdinal, undefined, 'geen volgnummer bij een enkel naamloos document');
});

test('10 — een document mét naam telt niet mee in de naamloze nummering', () => {
  seedSource('');
  useAppStore.setState((s) => { s.filePath = null; s.fileHandle = null; });
  const copyId = useAppStore.getState().duplicateDocument('Kade 7');
  assert(!!copyId, 'kopie met expliciete naam aangemaakt');
  const docs = useAppStore.getState().getOpenDocuments();
  assertEq(docs.map((d) => d.title), ['', 'Kade 7'], 'één naamloos, één met naam');
  assertEq(docs.map((d) => d.untitledOrdinal), [undefined, undefined],
    'het enige naamloze document blijft ongenummerd');
});

await run();
