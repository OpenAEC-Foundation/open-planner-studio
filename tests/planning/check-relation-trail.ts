import './domStub';
// Terug en vooruit in het relatiepaneel (issue #888, eigenaarsbesluit 2026-11-14 "3").
//
// Alleen sprongen via het paneel (het nummer van een voorganger of opvolger) tellen. Een eigen keuze
// in de tabel of de Gantt telt niet mee en wist het spoor ook niet: na 3.1 → 2.4 → 1.7 en een klik op
// 5.2 brengt terug je naar 2.4. Het spoor hoort bij het document en leeft alleen in de sessie. Een
// verwijderde taak wordt overgeslagen, en ook de taak waar je al op staat.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { jumpToRelatedTask, relationTrailTarget, stepRelationTrail } from '@/state/relationTrail';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const name = (id: string | null | undefined) => S().tasks.find(t => t.id === id)?.name ?? null;
const active = () => name(S().activeTaskId);
const target = (dir: 'back' | 'forward') => name(relationTrailTarget(S(), dir));

S().newProject();
const t31 = S().addTask({ name: '3.1' });
const t24 = S().addTask({ name: '2.4' });
const t17 = S().addTask({ name: '1.7' });
const t52 = S().addTask({ name: '5.2' });
const t99 = S().addTask({ name: '9.9' });

// ── 1. Zonder sprong zijn beide knoppen grijs ────────────────────────────────────────────────
S().selectTask(t31);
eq('1.1 geen terug', target('back'), null);
eq('1.2 geen vooruit', target('forward'), null);
eq('1.3 terug doet niets', stepRelationTrail('back'), false);
eq('1.4 nog op 3.1', active(), '3.1');

// ── 2. Het voorbeeld uit het besluit ─────────────────────────────────────────────────────────
jumpToRelatedTask(t24);
jumpToRelatedTask(t17);
eq('2.1 sprong selecteert de taak', active(), '1.7');
eq('2.2 en vraagt de Gantt erheen', S().view.pendingFocusTaskId, t17);
eq('2.3 terug wijst naar 2.4', target('back'), '2.4');
eq('2.4 vooruit is grijs', target('forward'), null);
S().selectTask(t52); // eigen keuze in de tabel
eq('2.5 na een klik op 5.2 wijst terug nog naar 2.4', target('back'), '2.4');
stepRelationTrail('back');
eq('2.6 terug brengt je naar 2.4', active(), '2.4');
eq('2.7 vooruit wijst naar 1.7', target('forward'), '1.7');
stepRelationTrail('back');
eq('2.8 nog eens terug: 3.1', active(), '3.1');
eq('2.9 begin van het spoor', target('back'), null);
stepRelationTrail('forward');
stepRelationTrail('forward');
eq('2.10 twee keer vooruit: 1.7', active(), '1.7');
eq('2.11 einde van het spoor', target('forward'), null);

// ── 3. Een nieuwe sprong midden in het spoor vervangt wat vooruit lag (zoals een browser) ─────
stepRelationTrail('back'); // 2.4
jumpToRelatedTask(t99);
eq('3.1 vooruit is weg', target('forward'), null);
eq('3.2 terug wijst naar 2.4', target('back'), '2.4');

// ── 4. Een sprong vanaf een zelf gekozen taak neemt die taak als vertrekpunt mee ──────────────
S().selectTask(t52);
jumpToRelatedTask(t17);
eq('4.1 terug wijst naar het vertrekpunt 5.2', target('back'), '5.2');
stepRelationTrail('back');
stepRelationTrail('back');
eq('4.2 en daarvoor het oude spoor', active(), '9.9');

// ── 5. Een verwijderde taak en de taak waar je al staat worden overgeslagen ───────────────────
S().newProject();
const a = S().addTask({ name: 'A' });
const b = S().addTask({ name: 'B' });
const c = S().addTask({ name: 'C' });
S().selectTask(a);
jumpToRelatedTask(b);
jumpToRelatedTask(c);
S().deleteTask(b);
eq('5.1 terug slaat de verwijderde B over', target('back'), 'A');
S().undo();
eq('5.2 na ongedaan maken is B er weer', target('back'), 'B');
S().selectTask(b); // zelf op B gaan staan
eq('5.3 terug slaat de taak over waar je al staat', target('back'), 'A');

// ── 6. Het spoor hoort bij het document ──────────────────────────────────────────────────────
const firstDoc = S().activeDocumentId;
S().selectTask(c);
S().newDocument();
eq('6.1 een ander document heeft een eigen (leeg) spoor', relationTrailTarget(S(), 'back'), null);
S().switchDocument(firstDoc);
eq('6.2 terug in het eerste document is het spoor er nog', target('back'), 'B');

if (diffs.length > 0) {
  console.log(`XX  relation-trail: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   - ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-trail: alle checks groen (${checks})`);
