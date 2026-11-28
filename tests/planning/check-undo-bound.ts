import { useAppStore } from '@/state/appStore';
import { MAX_UNDO } from '@/state/transaction';
import { withTransaction } from '@/state/batchTransaction';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

S().newProject();
const id = S().addTask({ name: 'grens-0' });
eq('1 opzet: één bewerking op de stack', S().historyEvents.filter(event => event.state === 'applied').length, 1);

const OVER = 25;
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id, { name: `grens-${i}` });

eq('2 stack blijft op MAX_UNDO', S().historyEvents.filter(event => event.state === 'applied').length, MAX_UNDO);
eq('3 huidige naam is de laatste bewerking', S().tasks.find(t => t.id === id)?.name, `grens-${MAX_UNDO + OVER}`);

for (let i = 0; i < MAX_UNDO; i++) S().undo();
eq('4 na MAX_UNDO keer undo is de stack leeg', S().historyEvents.filter(event => event.state === 'applied').length, 0);
const naUndo = S().tasks.find(t => t.id === id)?.name;
eq('5 oudste stappen zijn afgekapt (niet terug bij het begin)', naUndo, `grens-${OVER}`);
truthy('6 taak bestaat nog na alle undos', !!S().tasks.find(t => t.id === id));

S().undo();
eq('7 undo op een lege stack is een no-op', S().tasks.find(t => t.id === id)?.name, naUndo);
eq('8 stack blijft leeg', S().historyEvents.filter(event => event.state === 'applied').length, 0);

S().newProject();
const id2 = S().addTask({ name: 'coal-0' });
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id2, { name: `coal-${i}` });
eq('9 opzet: stack staat op de grens', S().historyEvents.filter(event => event.state === 'applied').length, MAX_UNDO);

const voorGebaar = S().historyEvents.filter(event => event.state === 'applied').length;
for (let i = 0; i < 20; i++) {
  S().updateTask(id2, { name: `sleep-${i}` }, { coalesceKey: 'sleep:1' });
}
eq('10 één gebaar = één undo-stap, ook op de grens',
  S().historyEvents.filter(event => event.state === 'applied').length - voorGebaar + 1, 1);
eq('11 het gebaar heeft wel gewerkt', S().tasks.find(t => t.id === id2)?.name, 'sleep-19');

S().undo();
eq('12 undo draait het hele gebaar terug', S().tasks.find(t => t.id === id2)?.name, `coal-${MAX_UNDO + OVER}`);

S().newProject();
const id3 = S().addTask({ name: 'k-0' });
const voorTwee = S().historyEvents.filter(event => event.state === 'applied').length;
S().updateTask(id3, { name: 'k-a' }, { coalesceKey: 'gebaar:A' });
S().updateTask(id3, { name: 'k-b' }, { coalesceKey: 'gebaar:B' });
eq('13 twee verschillende keys = twee undo-stappen', S().historyEvents.filter(event => event.state === 'applied').length - voorTwee, 2);
S().undo();
eq('14 eerste undo geeft gebaar A terug', S().tasks.find(t => t.id === id3)?.name, 'k-a');
S().undo();
eq('15 tweede undo geeft de begintoestand terug', S().tasks.find(t => t.id === id3)?.name, 'k-0');

S().newProject();
const id4 = S().addTask({ name: 'r-0' });
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id4, { name: `r-${i}` });
S().undo();
const naEersteUndo = S().tasks.find(t => t.id === id4)?.name;
S().redo();
eq('16 redo herstelt de bewerking', S().tasks.find(t => t.id === id4)?.name, `r-${MAX_UNDO + OVER}`);
eq('17 redo laat de stack niet over de grens groeien', S().historyEvents.filter(event => event.state === 'applied').length <= MAX_UNDO, true);
truthy('18 undo na redo werkt nog', (S().undo(), S().tasks.find(t => t.id === id4)?.name === naEersteUndo));

{
  S().newProject();
  const N = 25;

  const before = S().historyEvents.filter(event => event.state === 'applied').length;
  for (let i = 0; i < N; i++) S().addTask({ name: `zonder-${i}` });
  eq('bt1 zonder batch: n mutaties ⇒ n undo-stappen', S().historyEvents.filter(event => event.state === 'applied').length - before, N);

  S().newProject();
  const beforeBatch = S().historyEvents.filter(event => event.state === 'applied').length;
  withTransaction(() => { for (let i = 0; i < N; i++) S().addTask({ name: `met-${i}` }); });
  eq('bt2 met batch: n mutaties ⇒ precies één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - beforeBatch, 1);
  eq('bt3 met batch: alle taken zijn er wél', S().tasks.filter(t => t.name.startsWith('met-')).length, N);

  S().undo();
  eq('bt4 undo draait de hele bulk in één keer terug', S().tasks.filter(t => t.name.startsWith('met-')).length, 0);

  S().newProject();
  const beforeNest = S().historyEvents.filter(event => event.state === 'applied').length;
  withTransaction(() => {
    S().addTask({ name: 'buiten' });
    withTransaction(() => { S().addTask({ name: 'binnen-1' }); S().addTask({ name: 'binnen-2' }); });
    S().addTask({ name: 'buiten-2' });
  });
  eq('bt5 geneste batch levert nog steeds één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - beforeNest, 1);
  eq('bt6 geneste batch: alle vier de taken staan er', S().tasks.length, 4);

  S().newProject();
  try {
    withTransaction(() => { S().addTask({ name: 'voor-de-fout' }); throw new Error('boem'); });
  } catch { }
  const afterThrow = S().historyEvents.filter(event => event.state === 'applied').length;
  S().addTask({ name: 'na-de-fout' });
  eq('bt7 na een throw in de batch pusht een gewone mutatie weer een undo-stap',
    S().historyEvents.filter(event => event.state === 'applied').length - afterThrow, 1);
}

if (diffs.length === 0) {
  console.log(`OK  undo-bound-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  undo-bound-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
