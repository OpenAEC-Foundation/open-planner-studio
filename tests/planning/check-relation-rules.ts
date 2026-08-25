// Regressie voor de relatieregels. Twee generaties bewijs staan hier naast elkaar:
//
//   1. Een relatie MET een mijlpaal als eindpunt werd door de Gantt-hittest geweigerd, terwijl de
//      solver mijlpalen volledig ondersteunt (spec 2026-08-14). Dit bestand verankert dat de regels
//      ze toestaan — ONGEWIJZIGD sinds 2026-08-14.
//   2. Een relatie MET een verzameltaak als eindpunt werd tot het eigenaarsbesluit van 2026-08-15
//      ALTIJD geweigerd (spec 2026-08-14, §spookrelaties). Sinds `expandSummaryRelations`
//      (`src/engine/scheduler/expandSummaryRelations.ts`) zulke relaties naar bladtaken doorrekent
//      (MS Project-semantiek), is dat te grofmazig — alleen een relatie tussen een taak en zijn
//      EIGEN (voor)ouder-samenvatting blijft geweigerd (`isAncestorRelation`), want die zou de
//      expansie een directe cyclus (A→B én B→A) laten genereren. Dit bestand verankert de OMGEKEERDE
//      uitkomst t.o.v. de oorspronkelijke spec: een gewoon verzameltaak-eindpunt MOET nu slagen.
//
// Draait via run.sh. Exit 0 = alles groen.

import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { relationVerdict, isSummaryTask, isAncestorRelation, type TaskLookup } from '@/state/relationRules';
import { useAppStore } from '@/state/appStore';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ── Minimale taak-stubs: de regels lezen alleen `id`, `childIds` en `parentId`. ──────────
function task(id: string, childIds: string[] = [], parentId: string | null = null): Task {
  return { id, name: id, childIds, parentId } as unknown as Task;
}

// Boom voor de meeste checks:
//   s
//   ├── a   (leaf, gewoon kind van s)
//   └── a2  (leaf, sibling van a — "cousin"-check: geen van beiden is voorouder van de ander)
const leafA = task('a', [], 's');
const leafA2 = task('a2', [], 's');
const leafB = task('b'); // volledig los, geen ouder
const milestone = { ...task('m'), isMilestone: true } as Task;
const summary = task('s', ['a', 'a2']);

// Aparte, geneste boom voor de "kleinkind"-check, losstaand zodat hij de boom hierboven niet
// door elkaar haalt:
//   s3
//   └── mid  (zelf ook een verzameltaak)
//       └── g  (leaf, kleinkind van s3)
const grandKind = task('g', [], 'mid');
const mid = task('mid', ['g'], 's3');
const summary3 = task('s3', ['mid']);

const byId = new Map<string, Task>([
  [leafA.id, leafA], [leafA2.id, leafA2], [leafB.id, leafB], [milestone.id, milestone],
  [summary.id, summary], [grandKind.id, grandKind], [mid.id, mid], [summary3.id, summary3],
]);

const noSeqs: Sequence[] = [];
const FS = 'FINISH_START' as const;

const lookup: TaskLookup = (id) => byId.get(id);

// ── isSummaryTask ────────────────────────────────────────────────────────────
ok('blad is geen verzameltaak', !isSummaryTask(leafA));
ok('taak met kinderen is een verzameltaak', isSummaryTask(summary));
ok('onbekende taak (undefined) is geen verzameltaak', !isSummaryTask(undefined));

// ── isAncestorRelation ───────────────────────────────────────────────────────
ok('blad→blad: geen voorouder-relatie', !isAncestorRelation(lookup, { predecessorId: 'a', successorId: 'b' }));
ok('MIJLPAAL als voorganger: geen voorouder-relatie', !isAncestorRelation(lookup, { predecessorId: 'm', successorId: 'b' }));
ok('gewoon verzameltaak-eindpunt (niet de eigen ouder): GEEN voorouder-relatie',
  !isAncestorRelation(lookup, { predecessorId: 's', successorId: 'b' }));
ok('kind→eigen-ouder-samenvatting: WEL een voorouder-relatie',
  isAncestorRelation(lookup, { predecessorId: 'a', successorId: 's' }));
ok('eigen-ouder-samenvatting→kind (de spiegeling): WEL een voorouder-relatie',
  isAncestorRelation(lookup, { predecessorId: 's', successorId: 'a' }));
ok('kleinkind→(voor)ouder-samenvatting (geneste boom): WEL een voorouder-relatie',
  isAncestorRelation(lookup, { predecessorId: 'g', successorId: 's3' }));
ok('kleinkind→directe ouder (die zelf ook een verzameltaak is): WEL een voorouder-relatie',
  isAncestorRelation(lookup, { predecessorId: 'g', successorId: 'mid' }));
ok('twee ONGERELATEERDE siblings onder dezelfde ouder ("cousins"): GEEN voorouder-relatie',
  !isAncestorRelation(lookup, { predecessorId: 'a', successorId: 'a2' }));
ok('onbekend eindpunt: geen voorouder-relatie (er is niets om voorouder van te zijn)',
  !isAncestorRelation(lookup, { predecessorId: 'a', successorId: 'bestaat-niet' }));

// ── relationVerdict ──────────────────────────────────────────────────────────
const verdict = (p: string, s: string, seqs: Sequence[] = noSeqs) =>
  relationVerdict(lookup, seqs, { predecessorId: p, successorId: s, type: FS });

ok('blad→blad wordt toegestaan', verdict('a', 'b').ok);
ok('mijlpaal→blad wordt toegestaan (regressie-anker, ongewijzigd sinds 2026-08-14)', verdict('m', 'b').ok);
ok('blad→mijlpaal wordt toegestaan (regressie-anker, ongewijzigd sinds 2026-08-14)', verdict('a', 'm').ok);

// Mutatiebewijs (uitgevoerd): met de VORIGE `relationVerdict` (die `isSummaryTask(pred) ||
// isSummaryTask(succ)` nog als blokkerende voorwaarde had, vóór het eigenaarsbesluit van
// 2026-08-15) gaven de volgende asserts `ok: false, reason: 'summary-endpoint'` — het exacte
// tegenovergestelde van wat hier nu gepind staat.
const summaryPredV = verdict('s', 'b');
ok('verzameltaak als voorganger (naar een niet-verwante taak) wordt sinds 2026-08-15 TOEGESTAAN', summaryPredV.ok);
const cousinsV = verdict('a', 'a2');
ok('verzameltaak-EINDPUNT via een cousin-relatie blijft ook toegestaan (a2 is geen voorouder van a)', cousinsV.ok);

const summaryAncestorV = verdict('a', 's'); // a is HIER een kind van s
ok('taak→eigen-ouder-samenvatting wordt geweigerd (dit ÍS de voorouder-relatie)', !summaryAncestorV.ok);
ok('… met de voorouder-reden', !summaryAncestorV.ok && summaryAncestorV.reason === 'ancestor');
const summaryAncestorMirrorV = verdict('s', 'a');
ok('eigen-ouder-samenvatting→kind wordt eveneens geweigerd (de spiegeling)', !summaryAncestorMirrorV.ok);
ok('… met de voorouder-reden', !summaryAncestorMirrorV.ok && summaryAncestorMirrorV.reason === 'ancestor');

const selfV = verdict('a', 'a');
ok('zelfrelatie wordt geweigerd', !selfV.ok);
ok('… met de zelf-reden', !selfV.ok && selfV.reason === 'self');

const unknownV = verdict('a', 'bestaat-niet');
ok('onbekende taak wordt geweigerd', !unknownV.ok);
ok('… met de onbekende-taak-reden', !unknownV.ok && unknownV.reason === 'unknown-task');

const unknownPredV = verdict('bestaat-niet', 'b');
ok('onbekende voorganger wordt geweigerd', !unknownPredV.ok);
ok('… met de onbekende-taak-reden', !unknownPredV.ok && unknownPredV.reason === 'unknown-task');

const existing: Sequence[] = [
  { id: 'seq1', predecessorId: 'a', successorId: 'b', type: FS, lagDays: 0 },
];
const dupV = verdict('a', 'b', existing);
ok('duplicaat wordt geweigerd', !dupV.ok);
ok('… met de duplicaat-reden', !dupV.ok && dupV.reason === 'duplicate');
ok('ander type tussen hetzelfde paar blijft toegestaan (bv. SS+FF-ladder)',
  relationVerdict(lookup, existing, { predecessorId: 'a', successorId: 'b', type: 'START_START' }).ok);
ok('ander PAAR met hetzelfde type blijft toegestaan',
  relationVerdict(lookup, existing, { predecessorId: 'a', successorId: 'm', type: FS }).ok);
ok('ander PAAR met dezelfde opvolger blijft toegestaan',
  verdict('m', 'b', existing).ok);

// Volgorde van de regels: een voorouder-relatie die óók een duplicaat is meldt het inhoudelijke
// probleem, niet het duplicaat.
const both: Sequence[] = [
  { id: 'seq2', predecessorId: 'a', successorId: 's', type: FS, lagDays: 0 },
];
const bothV = verdict('a', 's', both);
ok('voorouder+duplicaat meldt de voorouder-reden i.p.v. het duplicaat',
  !bothV.ok && bothV.reason === 'ancestor');

// ── Store-integratie: de slice-actie handhaaft dezelfde regels ────────────────
const S = () => useAppStore.getState();

S().newProject();
const fase = S().addTask({ name: 'Fase' });
const kind = S().addTask({ name: 'Kind', parentId: fase });
const los = S().addTask({ name: 'Los' });
const mp = S().addTask({ name: 'Mijlpaal', isMilestone: true });

ok('addTask met parentId gaf de ouder GEEN childIds-vermelding — dan is Fase geen verzameltaak en toetst de rest hieronder niets',
  S().tasks.find((t) => t.id === fase)?.childIds.includes(kind) === true);

// Mutatiebewijs (uitgevoerd): met de VORIGE `relationVerdict` gaf `addSequence(fase, los)` hier
// `null` (summary-endpoint) — de asserts hieronder waren dan `summaryId === null` i.p.v. `!== null`.
// Zie de git-geschiedenis van dit bestand vóór het eigenaarsbesluit van 2026-08-15.
const seqCountBefore = S().sequences.length;
const summaryId = S().addSequence({ predecessorId: fase, successorId: los, type: FS, lagDays: 0 });
ok('addSequence MAAKT een verzameltaak-relatie aan sinds 2026-08-15 (verwacht een id, geen weigering)',
  summaryId !== null);
ok('… en de relatie staat echt in de store',
  S().sequences.length === seqCountBefore + 1
  && S().sequences.some((e) => e.id === summaryId && e.predecessorId === fase && e.successorId === los));

// Voorouder-relatie: Kind is de EIGEN bladafstammeling van Fase — dit blijft geweigerd.
const seqCountAfterSummary = S().sequences.length;
const ancestorId = S().addSequence({ predecessorId: kind, successorId: fase, type: FS, lagDays: 0 });
ok('addSequence weigert een voorouder-relatie (kind → eigen ouder-samenvatting)', ancestorId === null);
ok('… geen extra relatie erbij', S().sequences.length === seqCountAfterSummary);

// Een geweigerde relatie (hier: de voorouder-relatie, ander type dan hierboven) mag geen undo-stap
// achterlaten (zelfde regel als bij duplicaten, R3).
const undoDepth = S().historyEvents.filter(event => event.state === 'applied').length;
S().addSequence({ predecessorId: kind, successorId: fase, type: 'START_START', lagDays: 0 });
ok('geweigerde (voorouder-)relatie duwt geen undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length === undoDepth);

const msId = S().addSequence({ predecessorId: mp, successorId: los, type: FS, lagDays: 0 });
ok('addSequence staat een MIJLPAAL als voorganger toe (regressie-anker, ongewijzigd)', msId !== null);
ok('mijlpaal-relatie staat echt in de store',
  S().sequences.some((e) => e.id === msId && e.predecessorId === mp && e.successorId === los));

const msSuccId = S().addSequence({ predecessorId: los, successorId: mp, type: FS, lagDays: 0 });
ok('addSequence staat een MIJLPAAL als opvolger toe (regressie-anker, ongewijzigd)', msSuccId !== null);

const kindId = S().addSequence({ predecessorId: kind, successorId: los, type: FS, lagDays: 0 });
ok('addSequence staat een SUBTAAK zonder eigen kinderen toe (gewoon een bladtaak)', kindId !== null);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  relation-rules: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  relation-rules: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
