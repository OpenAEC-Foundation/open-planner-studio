import './domStub';
import {
  detachFromParent, attachToParent, isSelfOrDescendant, collectSubtreeIds, siblingIds, removeTaskSubtrees,
} from '@/state/taskTree';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const t = (id: string, parentId: string | null, childIds: string[]): Task =>
  ({ id, parentId, childIds } as unknown as Task);

const tree = (): Task[] => [
  t('root1', null, ['a', 'b']),
  t('a', 'root1', ['a1', 'a2']),
  t('a1', 'a', []),
  t('a2', 'a', []),
  t('b', 'root1', []),
  t('root2', null, []),
];

{
  const ts = tree();
  detachFromParent(ts, 'a1');
  eq('01 detach: uit de childIds van de ouder', ts.find(x => x.id === 'a')?.childIds, ['a2']);
  eq('02 detach: laat parentId met rust (de aanroeper zet die)', ts.find(x => x.id === 'a1')?.parentId, 'a');
}
{
  const ts = tree();
  detachFromParent(ts, 'root1');
  eq('03 detach: een root-taak zonder ouder is een no-op', ts.map(x => x.id).length, 6);
}
{
  const ts = tree();
  detachFromParent(ts, 'bestaatniet');
  eq('04 detach: onbekend id verandert niets', ts.find(x => x.id === 'a')?.childIds, ['a1', 'a2']);
}
{
  const ts = tree().filter(x => x.id !== 'a');
  detachFromParent(ts, 'a1');
  eq('05 detach: verdwenen ouder crasht niet', ts.length, 5);
}

{
  const ts = tree();
  attachToParent(ts, 'root2', 'a', 1);
  eq('06 attach: op de gevraagde index', ts.find(x => x.id === 'a')?.childIds, ['a1', 'root2', 'a2']);
  eq('07 attach: parentId gezet', ts.find(x => x.id === 'root2')?.parentId, 'a');
}
{
  const ts = tree();
  attachToParent(ts, 'root2', 'a');
  eq('08 attach zonder index: achteraan', ts.find(x => x.id === 'a')?.childIds, ['a1', 'a2', 'root2']);
}
{
  const ts = tree();
  attachToParent(ts, 'root2', 'a', 99);
  eq('09 attach: index te groot ⇒ geklemd naar achteraan', ts.find(x => x.id === 'a')?.childIds, ['a1', 'a2', 'root2']);
  const ts2 = tree();
  attachToParent(ts2, 'root2', 'a', -1);
  eq('10 attach: negatieve index ⇒ geklemd naar vooraan, niet vanaf het eind geteld',
    ts2.find(x => x.id === 'a')?.childIds, ['root2', 'a1', 'a2']);
}
{
  const ts = tree();
  attachToParent(ts, 'a1', null);
  eq('11 attach naar root: parentId null', ts.find(x => x.id === 'a1')?.parentId, null);
  eq('12 attach naar root: er is geen lijst om in te voegen', ts.find(x => x.id === 'a')?.childIds, ['a1', 'a2']);
}
{
  const ts = tree();
  detachFromParent(ts, 'a2');
  attachToParent(ts, 'a2', 'a', 0);
  eq('13 verplaatsen binnen dezelfde ouder: geen duplicaat', ts.find(x => x.id === 'a')?.childIds, ['a2', 'a1']);
}

{
  for (const source of [tree(), [...tree(), t('a', 'root2', ['dubbel'])], tree().filter(task => task.id !== 'a')]) {
    const plain = structuredClone(source);
    const indexed = structuredClone(source);
    const byId = new Map<string, Task>();
    for (const task of indexed) if (!byId.has(task.id)) byId.set(task.id, task);
    for (const id of ['a1', 'onbekend', 'root2', 'a2', 'a1']) {
      detachFromParent(plain, id);
      attachToParent(plain, id, 'a');
      detachFromParent(indexed, id, byId);
      attachToParent(indexed, id, 'a', undefined, byId);
    }
    eq('index: losmaken en vastmaken blijven gelijk bij dubbele/ontbrekende ids en ouders', indexed, plain);
  }
}

{
  const ts = tree();
  eq('14 cyklus: een taak is zichzelf', isSelfOrDescendant(ts, 'a', 'a'), true);
  eq('15 cyklus: een kind is een afstammeling', isSelfOrDescendant(ts, 'a1', 'a'), true);
  eq('16 cyklus: een kleinkind ook', isSelfOrDescendant(ts, 'a1', 'root1'), true);
  eq('17 cyklus: een sibling niet', isSelfOrDescendant(ts, 'b', 'a'), false);
  eq('18 cyklus: een losse root niet', isSelfOrDescendant(ts, 'root2', 'root1'), false);
  eq('19 cyklus: omgekeerde richting niet', isSelfOrDescendant(ts, 'a', 'a1'), false);
}
{
  const ts = [t('x', 'y', ['y']), t('y', 'x', ['x'])];
  eq('20 cyklus: bestaande lus in de data eindigt (geen oneindige loop)', isSelfOrDescendant(ts, 'x', 'z'), false);
  eq('21 cyklus: bestaande lus vindt de gezochte voorouder wel', isSelfOrDescendant(ts, 'x', 'y'), true);
}

{
  const ts = tree();
  eq('22 subtree: pre-order vanaf de wortel', collectSubtreeIds(ts, 'root1'), ['root1', 'a', 'a1', 'a2', 'b']);
  eq('23 subtree: een blad is zichzelf', collectSubtreeIds(ts, 'a1'), ['a1']);
  eq('24 subtree: onbekend id geeft alleen dat id', collectSubtreeIds(ts, 'weg'), ['weg']);
}
{
  const ts = [t('x', null, ['y']), t('y', 'x', ['x'])];
  eq('25 subtree: een lus in childIds eindigt en dupliceert niet', collectSubtreeIds(ts, 'x'), ['x', 'y']);
}

{
  const ts = tree();
  eq('26 kinderen van een ouder: de childIds in volgorde', siblingIds(ts, 'a'), ['a1', 'a2']);
  eq('27 kinderen van de root: de root-taken in ARRAY-volgorde (niet childIds)', siblingIds(ts, null), ['root1', 'root2']);
  eq('28 kinderen van een onbekende ouder: leeg', siblingIds(ts, 'weg'), []);
  eq('29 kinderen van een kinderloze ouder: leeg', siblingIds(ts, 'b'), []);
}

{
  const S = () => useAppStore.getState();
  S().newProject();
  const p1 = S().addTask({ name: 'Ouder1' });
  const p2 = S().addTask({ name: 'Ouder2' });
  const kind = S().addTask({ name: 'Kind', parentId: p1 });
  S().moveTask(kind, p2);
  eq('30 store: childIds van de oude ouder is leeg', S().tasks.find(x => x.id === p1)?.childIds, []);
  eq('30 store: childIds van de nieuwe ouder bevat het kind', S().tasks.find(x => x.id === p2)?.childIds, [kind]);
  eq('31 store: parentId wijst naar de nieuwe ouder', S().tasks.find(x => x.id === kind)?.parentId, p2);
  const before = JSON.stringify(S().tasks.map(x => [x.id, x.parentId, x.childIds]));
  S().moveTask(p2, kind);
  eq('32 store: een cyklische move wordt geweigerd, zonder halve mutatie',
    JSON.stringify(S().tasks.map(x => [x.id, x.parentId, x.childIds])), before);
}

{
  const staat = {
    tasks: tree(), sequences: [], assignments: [],
    selectedTaskIds: ['a1', 'b'], activeTaskId: 'a1' as string | null,
  };
  const weg = removeTaskSubtrees(staat, ['a']);
  eq('38 removeTaskSubtrees: de hele deelboom weg', [...weg].sort(), ['a', 'a1', 'a2']);
  eq('38a de selectie verliest de verwijderde taak', staat.selectedTaskIds, ['b']);
  eq('38b de actieve taak valt terug op de eerste resterende selectie', staat.activeTaskId, 'b');

  const S = () => useAppStore.getState();
  S().newProject();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  S().addTask({ name: 'Z' });
  S().selectTasks([x, y], false);
  useAppStore.setState({ activeTaskId: x });
  S().deleteTasksBulk([x, y]);
  eq('39 store: deleteTasksBulk laat geen actieve taak achter die niet meer bestaat',
    S().tasks.find(t => t.id === S().activeTaskId)?.name ?? null, 'Z');
}

{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);

  const paden = {
    taskSlice: join(root, 'src/state/slices/taskSlice.ts'),
    wbsTemplates: join(root, 'src/utils/wbsTemplates.ts'),
  };
  checks++;
  if (!existsSync(paden.taskSlice) || !existsSync(paden.wbsTemplates)) {
    diffs.push('33 bron-assert overgeslagen: bronbestanden niet gevonden vanaf de bundelplek');
  } else {
    const taskSlice = readFileSync(paden.taskSlice, 'utf8');
    const wbs = readFileSync(paden.wbsTemplates, 'utf8');

    eq('33 taskSlice gebruikt de gedeelde cyklusguard', /isSelfOrDescendant\(/.test(taskSlice), true);
    eq('34 taskSlice heeft geen eigen cyklus-walk meer',
      /let cur: Task \| undefined/.test(taskSlice), false);
    eq('35 taskSlice heeft geen overgetypte klem-en-splice meer',
      /Math\.min\(position, [a-zA-Z]+\.childIds\.length\)/.test(taskSlice), false);
    eq('35b taskSlice detacht uitsluitend via de gedeelde functie',
      /\w+\.childIds\s*=\s*\w+\.childIds\.filter\(/.test(taskSlice), false);
    eq('35c taskSlice roept detachFromParent daadwerkelijk aan',
      /detachFromParent\(/.test(taskSlice), true);
    eq('36 wbsTemplates gebruikt de gedeelde deelboom-verzamelaar',
      /collectSubtreeIds\(/.test(wbs), true);
    eq('37 wbsTemplates heeft geen eigen recursieve verzamelaar meer',
      /for \(const childId of task\.childIds\) collect\(childId\)/.test(wbs), false);
  }
}

if (diffs.length === 0) {
  console.log(`OK  task-tree: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  task-tree: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
