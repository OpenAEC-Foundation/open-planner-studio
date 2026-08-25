// De store-factory: wat een tweede instantie wél en niet kan (K-item 41).
//
// AANLEIDING. De store was één `create(...)`-expressie op moduleniveau. Daarmee is een tweede
// instantie niet alleen onhandig maar onmogelijk — en het rapport noemt die tweede instantie de
// sleutel tot split-view met twee documenten, cross-project rekenen en een gedeelde resourcepool.
// `createAppStore()` maakt hem mogelijk; de singleton wordt er nu uit gebouwd.
//
// WAAROM DEZE BATTERIJ TWEE SOORTEN CHECKS HEEFT. Een factory die een tweede instantie oplevert die
// stiekem de undo-coalescing, de batch-diepte en de bulk-transacties van de eerste deelt, is erger
// dan geen factory: hij ziet eruit alsof hij werkt. Dus:
//
//   DEEL 1-3 — wat écht onafhankelijk is. Positief getoetst, want dát is de opbrengst.
//   DEEL 4   — wat NOG GEDEELD is, vastgepind zoals `KNOWN_GAPS` in de round-trip-test: elke check
//              bewijst dat de koppeling er nog is. Lost iemand er één op, dan wordt deze batterij
//              ROOD en herinnert hij eraan de vastpinning weg te halen. Zonder deze helft zou een
//              lezer denken dat de factory af is.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStore, useAppStore } from '@/state/appStore';
import { withTransaction } from '@/state/batchTransaction';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── 1. Twee instanties zijn echt twee ───────────────────────────────────────
const A = createAppStore();
const B = createAppStore();

eq('1 de factory levert twee verschillende stores', A === B, false);
eq('1a en geen van beide is de singleton', A === useAppStore || B === useAppStore, false);
eq('1b de singleton is ook een factory-instantie (zelfde vorm)', typeof useAppStore.getState().addTask, 'function');

// Verse instanties starten leeg en gelijk.
eq('2 A start zonder taken', A.getState().tasks.length, 0);
eq('2a B ook', B.getState().tasks.length, 0);
eq('2b maar niet met hetzelfde state-object', A.getState() === B.getState(), false);

// ── 2. Projectdata is per instantie ─────────────────────────────────────────
{
  const a1 = A.getState().addTask({ name: 'alleen in A' });
  eq('3 A heeft de taak', A.getState().tasks.length, 1);
  eq('3a B niet', B.getState().tasks.length, 0);
  eq('3b en de singleton ook niet geraakt', useAppStore.getState().tasks.some(t => t.id === a1), false);

  const b1 = B.getState().addTask({ name: 'alleen in B' });
  B.getState().addTask({ name: 'en nog een in B' });
  eq('4 B heeft er nu twee', B.getState().tasks.length, 2);
  eq('4a A nog steeds één', A.getState().tasks.length, 1);

  A.getState().updateTask(a1, { name: 'hernoemd in A' });
  eq('5 de naam in A veranderde', A.getState().tasks[0]?.name, 'hernoemd in A');
  eq('5a die in B niet', B.getState().tasks.find(t => t.id === b1)?.name, 'alleen in B');

  // Projectkop, resources, relaties: zelfde verhaal.
  A.getState().setProject({ name: 'Project A' });
  B.getState().setProject({ name: 'Project B' });
  eq('6 projectnaam A', A.getState().project.name, 'Project A');
  eq('6a projectnaam B', B.getState().project.name, 'Project B');

  const ra = A.getState().addResource({ name: 'Kraan A', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  eq('7 resource in A', A.getState().resources.length, 1);
  eq('7a niet in B', B.getState().resources.length, 0);
  void ra;
}

// ── 3. Undo/redo is per instantie ───────────────────────────────────────────
{
  const diepteA = A.getState().undoStack.length;
  const diepteB = B.getState().undoStack.length;
  eq('8 beide hebben een eigen undo-stack met eigen diepte', diepteA === diepteB, false);

  const naamVoor = B.getState().tasks[0]?.name;
  B.getState().addTask({ name: 'derde in B' });
  eq('9 B groeide', B.getState().tasks.length, 3);
  eq('9a A niet', A.getState().tasks.length, 1);

  B.getState().undo();
  eq('10 undo op B draaide B terug', B.getState().tasks.length, 2);
  eq('10a en liet A met rust', A.getState().tasks.length, 1);
  eq('10b en de eerste taak van B is ongemoeid', B.getState().tasks[0]?.name, naamVoor);

  // Undo op A raakt B niet, ook niet nu B een redo-stack heeft.
  const redoB = B.getState().redoStack.length;
  A.getState().undo();
  eq('11 undo op A liet de redo-stack van B staan', B.getState().redoStack.length, redoB);
}

// ── 4. VASTGEPIND: wat een tweede instantie NOG NIET kan ────────────────────
// Deze checks beschrijven de huidige beperking. Ze horen ROOD te worden zodra iemand hem oplost —
// dat is het signaal om de vastpinning hier weg te halen en de kop van `createAppStore` bij te
// werken.
{
  // (a) `withTransaction` importeert de singleton hard. Een bulk op instantie B landt op de
  //     SINGLETON, niet op B. Dat is precies waarom split-view hier nog niet op kan leunen.
  const takenBvoor = B.getState().tasks.length;
  const takenSingletonVoor = useAppStore.getState().tasks.length;
  withTransaction(() => {
    B.getState().addTask({ name: 'bulk in B' });
    B.getState().addTask({ name: 'bulk in B 2' });
  });
  eq('12 de taken landen wél in B (de mutators zelf zijn store-gebonden)',
    B.getState().tasks.length, takenBvoor + 2);
  // Maar de SNAPSHOT die withTransaction vooraf neemt, is die van de singleton.
  eq('12a VASTGEPIND: withTransaction pusht zijn snapshot op de SINGLETON, niet op B',
    useAppStore.getState().undoStack.length > 0, true);
  eq('12b en de singleton kreeg er geen taken bij (alleen een undo-stap)',
    useAppStore.getState().tasks.length, takenSingletonVoor);

  // (b) De batch-diepte is module-state. Tijdens een `withTransaction` onderdrukt hij de
  //     per-mutatie-snapshots van ÉLKE instantie, niet alleen die van de store waar de bulk voor is.
  const bStackVoor = B.getState().undoStack.length;
  const aStackVoor = A.getState().undoStack.length;
  withTransaction(() => {
    A.getState().addTask({ name: 'A tijdens een batch die niet van A is' });
  });
  eq('13 VASTGEPIND: A kreeg géén eigen undo-stap tijdens de batch (gedeelde batch-diepte)',
    A.getState().undoStack.length, aStackVoor);
  eq('13a en B ook niet, want de bulk was niet van B', B.getState().undoStack.length, bStackVoor);
  eq('13b de taak zelf staat er wél in', A.getState().tasks.some(t => t.name.startsWith('A tijdens')), true);
}

// ── 5. De singleton blijft de singleton ─────────────────────────────────────
// Klein maar wezenlijk: de factory mag de bestaande app niet van vorm veranderen.
{
  eq('14 useAppStore heeft de bekende zustand-vorm',
    ['getState', 'setState', 'subscribe'].every(k => typeof (useAppStore as unknown as Record<string, unknown>)[k] === 'function'), true);
  eq('14a en levert een volledige AppState',
    ['project', 'tasks', 'sequences', 'resources', 'assignments', 'ui', 'view', 'undoStack']
      .every(k => k in useAppStore.getState()), true);

  // Twee aanroepen van de factory delen geen enkel state-object.
  const C = createAppStore();
  const D = createAppStore();
  for (const veld of ['tasks', 'sequences', 'resources', 'assignments', 'undoStack', 'redoStack'] as const) {
    eq(`15 "${veld}" is niet gedeeld tussen twee verse instanties`,
      (C.getState() as unknown as Record<string, unknown>)[veld] === (D.getState() as unknown as Record<string, unknown>)[veld],
      false);
  }
}

// ── 6. Partial<Task>-constructor bewaart expliciete lege-summarysemantiek ─────────────────────
// Breuk die dit vangt: `addTask` accepteert publiek `Partial<Task>`, maar vergeet `isSummary` in
// zijn object-literal. De taak lijkt dan opgeslagen, maar belandt als gewone leaf in de solver.
{
  const E = createAppStore();
  const summaryId = E.getState().addTask({ name: 'Store lege summary', isSummary: true });
  E.getState().runCPM();
  eq('16 store addTask bewaart expliciet true',
    E.getState().tasks.find(task => task.id === summaryId)?.isSummary, true);
  eq('16a store addTask houdt de lege summary buiten CPMResult.tasks',
    E.getState().cpmResult?.tasks.has(summaryId), false);

  E.getState().updateTask(summaryId, { isSummary: false });
  E.getState().runCPM();
  eq('16b store updateTask kan de marker bewust terugzetten',
    E.getState().tasks.find(task => task.id === summaryId)?.isSummary, false);
  eq('16c de teruggezette taak wordt weer een solvertaak',
    E.getState().cpmResult?.tasks.has(summaryId), true);

  const regularId = E.getState().addTask({ name: 'Store gewone taak' });
  E.getState().runCPM();
  eq('16d store addTask maakt een gewone invoer niet per ongeluk summary',
    E.getState().tasks.find(task => task.id === regularId)?.isSummary, undefined);
  eq('16e de gewone taak blijft een solvertaak', E.getState().cpmResult?.tasks.has(regularId), true);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: store-factory — ${checks} checks groen`);
} else {
  console.log(`XX store-factory — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
