// Undo-grens-checks (bevinding uit het onderhoudbaarheidsonderzoek, prioriteitsitem 8) — headless
// tegen de ECHTE Zustand-store, zelfde patroon als de andere check-scripts.
//
// Waarom deze batterij bestaat: de undo-stack was ONBEGRENSD, terwijl `createSnapshot` toen bij
// élke bewerking de projectdata deep-cloonde en de stacks ÍN het documentcontract zitten (dus élk
// geopend document houdt zijn volledige historie vast). Die kloon is er sinds 2026-08-17 uit — de
// snapshot deelt nu per referentie (zie `snapshot.ts`) — maar de grens blijft, en de coalescing
// erachter net zo goed. De grens `MAX_UNDO` lost dat op, maar
// raakt tegelijk de undo-COALESCING: die gebruikte `undoStack.length` als identiteit van een
// lopende bewerkingsreeks, en die lengte is bij een volle stack constant. De identiteit is daarom
// een monotoon volgnummer geworden. Geen enkele bestaande case duwt 100+ stappen door de stack,
// dus zonder deze batterij is beide wijzigingen ongedekt.
//
// Draait via run.sh. Exit 0 = alles groen.
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

// ── 1. De grens houdt ────────────────────────────────────────────────────────
S().newProject();
const id = S().addTask({ name: 'grens-0' });
eq('1 opzet: één bewerking op de stack', S().historyEvents.filter(event => event.state === 'applied').length, 1);

const OVER = 25; // ruim voorbij het plafond
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id, { name: `grens-${i}` });

eq('2 stack blijft op MAX_UNDO', S().historyEvents.filter(event => event.state === 'applied').length, MAX_UNDO);
eq('3 huidige naam is de laatste bewerking', S().tasks.find(t => t.id === id)?.name, `grens-${MAX_UNDO + OVER}`);

// ── 2. Undo blijft werken tot aan de grens, en stopt daarna netjes ───────────
for (let i = 0; i < MAX_UNDO; i++) S().undo();
eq('4 na MAX_UNDO keer undo is de stack leeg', S().historyEvents.filter(event => event.state === 'applied').length, 0);
// De oudste stappen zijn eruit gevallen: we komen NIET terug op 'grens-0'.
const naUndo = S().tasks.find(t => t.id === id)?.name;
eq('5 oudste stappen zijn afgekapt (niet terug bij het begin)', naUndo, `grens-${OVER}`);
truthy('6 taak bestaat nog na alle undos', !!S().tasks.find(t => t.id === id));

// Eén undo te veel mag niet klappen en niets veranderen.
S().undo();
eq('7 undo op een lege stack is een no-op', S().tasks.find(t => t.id === id)?.name, naUndo);
eq('8 stack blijft leeg', S().historyEvents.filter(event => event.state === 'applied').length, 0);

// ── 3. Coalescing werkt nog ALS de stack op de grens staat ───────────────────
// Dit is de kern: met de oude lengte-identiteit is `undoStack.length` bij een volle stack
// constant. Een gebaar met één coalesceKey (bv. één balk-sleep) moet ÉÉN undo-stap blijven,
// ook op de grens — anders levert één sleep straks honderd stappen op.
S().newProject();
const id2 = S().addTask({ name: 'coal-0' });
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id2, { name: `coal-${i}` });
eq('9 opzet: stack staat op de grens', S().historyEvents.filter(event => event.state === 'applied').length, MAX_UNDO);

const voorGebaar = S().historyEvents.filter(event => event.state === 'applied').length;
for (let i = 0; i < 20; i++) {
  S().updateTask(id2, { name: `sleep-${i}` }, { coalesceKey: 'sleep:1' });
}
eq('10 één gebaar = één undo-stap, ook op de grens',
  S().historyEvents.filter(event => event.state === 'applied').length - voorGebaar + 1, 1); // stack zit op het plafond: +1 push, -1 afgekapt
eq('11 het gebaar heeft wel gewerkt', S().tasks.find(t => t.id === id2)?.name, 'sleep-19');

// Eén undo moet het HELE gebaar terugdraaien, niet één toetsaanslag.
S().undo();
eq('12 undo draait het hele gebaar terug', S().tasks.find(t => t.id === id2)?.name, `coal-${MAX_UNDO + OVER}`);

// ── 4. Twee VERSCHILLENDE keys mogen niet samenvallen ────────────────────────
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

// ── 5. Redo loopt ook via de begrensde push ──────────────────────────────────
S().newProject();
const id4 = S().addTask({ name: 'r-0' });
for (let i = 1; i <= MAX_UNDO + OVER; i++) S().updateTask(id4, { name: `r-${i}` });
S().undo();
const naEersteUndo = S().tasks.find(t => t.id === id4)?.name;
S().redo();
eq('16 redo herstelt de bewerking', S().tasks.find(t => t.id === id4)?.name, `r-${MAX_UNDO + OVER}`);
eq('17 redo laat de stack niet over de grens groeien', S().historyEvents.filter(event => event.state === 'applied').length <= MAX_UNDO, true);
truthy('18 undo na redo werkt nog', (S().undo(), S().tasks.find(t => t.id === id4)?.name === naEersteUndo));

// ── withTransaction: één bulk = één undo-stap (K-item 32) ─────────────────────
// Elke mutator pusht normaal zijn eigen deep-clone-snapshot. Een lus van n toevoegingen kloont dus
// 1 + 2 + … + n taken én laat n undo-stappen achter voor wat de gebruiker als één handeling ziet.
// `api.data.batch` (extensies) draait hierop.
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

  // Die ene stap moet de HELE reeks terugdraaien — anders is "één undo-stap" een lege belofte.
  S().undo();
  eq('bt4 undo draait de hele bulk in één keer terug', S().tasks.filter(t => t.name.startsWith('met-')).length, 0);

  // Nesten is veilig: de binnenste transactie mag de buitenste niet voortijdig opheffen.
  S().newProject();
  const beforeNest = S().historyEvents.filter(event => event.state === 'applied').length;
  withTransaction(() => {
    S().addTask({ name: 'buiten' });
    withTransaction(() => { S().addTask({ name: 'binnen-1' }); S().addTask({ name: 'binnen-2' }); });
    S().addTask({ name: 'buiten-2' });
  });
  eq('bt5 geneste batch levert nog steeds één undo-stap', S().historyEvents.filter(event => event.state === 'applied').length - beforeNest, 1);
  eq('bt6 geneste batch: alle vier de taken staan er', S().tasks.length, 4);

  // Gooit de callback, dan mag de suppressie NIET blijven hangen — anders levert elke volgende
  // mutatie in de app stilzwijgend geen undo-stap meer op.
  S().newProject();
  try {
    withTransaction(() => { S().addTask({ name: 'voor-de-fout' }); throw new Error('boem'); });
  } catch { /* verwacht */ }
  const afterThrow = S().historyEvents.filter(event => event.state === 'applied').length;
  S().addTask({ name: 'na-de-fout' });
  eq('bt7 na een throw in de batch pusht een gewone mutatie weer een undo-stap',
    S().historyEvents.filter(event => event.state === 'applied').length - afterThrow, 1);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  undo-bound-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  undo-bound-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
