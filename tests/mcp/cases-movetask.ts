import { useAppStore, test, assert, assertEq, run } from './harness';

(globalThis as any).document.documentElement = (globalThis as any).document.documentElement || {};

function reset(): void {
  useAppStore.getState().newProject();
}
function add(name: string, parentId: string | null = null): string {
  return useAppStore.getState().addTask({ name, parentId });
}
function arrNames(): string[] {
  return useAppStore.getState().tasks.map(t => t.name);
}
function childNames(parentId: string): string[] {
  const st = useAppStore.getState();
  const p = st.tasks.find(t => t.id === parentId)!;
  return p.childIds.map(cid => st.tasks.find(t => t.id === cid)!.name);
}
function wbs(id: string): string {
  return useAppStore.getState().tasks.find(t => t.id === id)!.wbsCode;
}
function parentOf(id: string): string | null {
  return useAppStore.getState().tasks.find(t => t.id === id)!.parentId;
}

test('zonder positie ⇒ append: childIds achteraan + rauwe array ongemoeid', () => {
  reset();
  const p = add('P');
  const a = add('A', p);
  const b = add('B', p);
  const c = add('C', p);
  const x = add('X');
  const arrBefore = arrNames();

  useAppStore.getState().moveTask(x, p);

  assertEq(childNames(p), ['A', 'B', 'C', 'X'], 'append: X hoort achteraan in childIds');
  assertEq(arrNames(), arrBefore, 'append laat de rauwe s.tasks-array onaangeroerd');
  assertEq([wbs(a), wbs(b), wbs(c), wbs(x)], ['1.1', '1.2', '1.3', '1.4'], 'WBS na append klopt');
});

test('positie 0 ⇒ vooraan in childIds ÉN in de rauwe array (beide asserten)', () => {
  reset();
  const p = add('P');
  const a = add('A', p);
  const b = add('B', p);
  const c = add('C', p);
  const x = add('X');

  useAppStore.getState().moveTask(x, p, 0);

  assertEq(childNames(p), ['X', 'A', 'B', 'C'], 'positie 0: X vooraan in childIds');
  assertEq(arrNames(), ['P', 'X', 'A', 'B', 'C'], 'positie 0: X vóór A in de rauwe array');
  assertEq([wbs(x), wbs(a), wbs(b), wbs(c)], ['1.1', '1.2', '1.3', '1.4'], 'WBS na positie-0 klopt');
});

test('positie midden ⇒ WBS klopt ondanks kleinkind tussen de siblings in de array', () => {
  reset();
  const p = add('P');
  const a = add('A', p);
  const a1 = add('A1', a);
  const b = add('B', p);
  const x = add('X');

  useAppStore.getState().moveTask(x, p, 1);

  assertEq(childNames(p), ['A', 'X', 'B'], 'positie 1: X tussen A en B in childIds');
  assertEq(arrNames(), ['P', 'A', 'A1', 'X', 'B'], 'kleinkind A1 staat tussen de siblings in de array');
  assertEq(
    [wbs(p), wbs(a), wbs(a1), wbs(x), wbs(b)],
    ['1', '1.1', '1.1.1', '1.2', '1.3'],
    'WBS-nummering klopt ondanks het interspersed kleinkind',
  );
});

test('out-of-range positie klemt (te hoog ⇒ achteraan, negatief ⇒ vooraan)', () => {
  reset();
  const p = add('P');
  add('A', p);
  add('B', p);
  const x = add('X');
  const y = add('Y');

  useAppStore.getState().moveTask(x, p, 999);
  assertEq(childNames(p), ['A', 'B', 'X'], 'te hoge positie klemt naar achteraan (childIds)');
  assertEq(arrNames(), ['P', 'A', 'B', 'X', 'Y'], 'te hoge positie: X achter B in de rauwe array');

  useAppStore.getState().moveTask(y, p, -5);
  assertEq(childNames(p), ['Y', 'A', 'B', 'X'], 'negatieve positie klemt naar vooraan (childIds)');
  assertEq(arrNames(), ['P', 'Y', 'A', 'B', 'X'], 'negatieve positie: Y vóór A in de rauwe array');
});

test('guard: taak naar eigen afstammeling blijft geweigerd (met én zonder positie)', () => {
  reset();
  const p = add('P');
  const a = add('A', p);
  const a1 = add('A1', a);
  const arrBefore = arrNames();

  useAppStore.getState().moveTask(p, a1);
  assertEq(parentOf(p), null, 'guard weigert P → afstammeling (parentId ongewijzigd)');
  assertEq(childNames(a1), [], 'guard: A1 kreeg P niet als kind');

  useAppStore.getState().moveTask(p, a1, 0);
  assertEq(parentOf(p), null, 'guard weigert P → afstammeling ook mét positie');
  assertEq(arrNames(), arrBefore, 'geweigerde move laat de rauwe array onaangeroerd');

  useAppStore.getState().moveTask(a, a, 0);
  assertEq(parentOf(a), p, 'guard weigert zelf-parent (mét positie)');
});

test('positie op rootniveau ⇒ root-volgorde (array) klopt', () => {
  reset();
  const rootA = add('A');
  const rootB = add('B');
  const p = add('P');
  const d = add('D', p);

  useAppStore.getState().moveTask(d, null, 1);

  assertEq(parentOf(d), null, 'D is nu een root');
  assertEq(childNames(p), [], 'D is uit P.childIds verwijderd');
  assertEq(arrNames(), ['A', 'D', 'B', 'P'], 'D op root-index 1 in de rauwe array');
  assertEq(
    [wbs(rootA), wbs(d), wbs(rootB), wbs(p)],
    ['1', '2', '3', '4'],
    'WBS op rootniveau volgt de array-volgorde',
  );
});

test('hasBlockingDialogOpen: importeerbaar + true bij gezette dialoog-vlag', async () => {
  const { hasBlockingDialogOpen } = await import('@/hooks/keyboard/shortcutRegistry');
  useAppStore.setState((s) => { s.ui.showNewProjectDialog = false; });
  assert(hasBlockingDialogOpen() === false, 'geen dialoog open ⇒ false');

  useAppStore.setState((s) => { s.ui.showNewProjectDialog = true; });
  assert(hasBlockingDialogOpen() === true, 'showNewProjectDialog gezet ⇒ true');

  useAppStore.setState((s) => { s.ui.showNewProjectDialog = false; });
});

await run();
