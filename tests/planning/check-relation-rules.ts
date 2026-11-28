import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { saveBranchAsWbsTemplate, listWbsTemplates, type WbsTemplate } from '@/utils/wbsTemplates';
import {
  relationStructureVerdict, relationVerdict, isSummaryTask, isAncestorRelation, type TaskLookup,
} from '@/state/relationRules';
import { useAppStore } from '@/state/appStore';
import { produce } from 'immer';
import { insertRemappedRelations } from '@/state/insertedBranch';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

function task(id: string, childIds: string[] = [], parentId: string | null = null): Task {
  return { id, name: id, childIds, parentId } as unknown as Task;
}

const leafA = task('a', [], 's');
const leafA2 = task('a2', [], 's');
const leafB = task('b');
const milestone = { ...task('m'), isMilestone: true } as Task;
const summary = task('s', ['a', 'a2']);

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

ok('blad is geen verzameltaak', !isSummaryTask(leafA));
ok('taak met kinderen is een verzameltaak', isSummaryTask(summary));
ok('onbekende taak (undefined) is geen verzameltaak', !isSummaryTask(undefined));

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

const verdict = (p: string, s: string, seqs: Sequence[] = noSeqs) =>
  relationVerdict(lookup, seqs, { predecessorId: p, successorId: s, type: FS });

ok('blad→blad wordt toegestaan', verdict('a', 'b').ok);
ok('mijlpaal→blad wordt toegestaan (regressie-anker, ongewijzigd sinds 2026-08-14)', verdict('m', 'b').ok);
ok('blad→mijlpaal wordt toegestaan (regressie-anker, ongewijzigd sinds 2026-08-14)', verdict('a', 'm').ok);

const summaryPredV = verdict('s', 'b');
ok('verzameltaak als voorganger (naar een niet-verwante taak) wordt sinds 2026-08-15 TOEGESTAAN', summaryPredV.ok);
const cousinsV = verdict('a', 'a2');
ok('verzameltaak-EINDPUNT via een cousin-relatie blijft ook toegestaan (a2 is geen voorouder van a)', cousinsV.ok);

const summaryAncestorV = verdict('a', 's');
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
ok('structurele plannerregel laat bestaand exact paar door voor finale-setvalidatie',
  relationStructureVerdict(lookup, existing[0]).ok);
const structuralAncestor = relationStructureVerdict(lookup, { predecessorId: 'a', successorId: 's' });
ok('structurele plannerregel handhaaft ancestor zonder duplicaatcheck',
  !structuralAncestor.ok && structuralAncestor.reason === 'ancestor');
ok('ander type tussen hetzelfde paar blijft toegestaan (bv. SS+FF-ladder)',
  relationVerdict(lookup, existing, { predecessorId: 'a', successorId: 'b', type: 'START_START' }).ok);
ok('ander PAAR met hetzelfde type blijft toegestaan',
  relationVerdict(lookup, existing, { predecessorId: 'a', successorId: 'm', type: FS }).ok);
ok('ander PAAR met dezelfde opvolger blijft toegestaan',
  verdict('m', 'b', existing).ok);

const both: Sequence[] = [
  { id: 'seq2', predecessorId: 'a', successorId: 's', type: FS, lagDays: 0 },
];
const bothV = verdict('a', 's', both);
ok('voorouder+duplicaat meldt de voorouder-reden i.p.v. het duplicaat',
  !bothV.ok && bothV.reason === 'ancestor');

const S = () => useAppStore.getState();

S().newProject();
const fase = S().addTask({ name: 'Fase' });
const kind = S().addTask({ name: 'Kind', parentId: fase });
const los = S().addTask({ name: 'Los' });
const mp = S().addTask({ name: 'Mijlpaal', isMilestone: true });

ok('addTask met parentId gaf de ouder GEEN childIds-vermelding — dan is Fase geen verzameltaak en toetst de rest hieronder niets',
  S().tasks.find((t) => t.id === fase)?.childIds.includes(kind) === true);

const seqCountBefore = S().sequences.length;
const summaryId = S().addSequence({ predecessorId: fase, successorId: los, type: FS, lagDays: 0 });
ok('addSequence MAAKT een verzameltaak-relatie aan sinds 2026-08-15 (verwacht een id, geen weigering)',
  summaryId !== null);
ok('… en de relatie staat echt in de store',
  S().sequences.length === seqCountBefore + 1
  && S().sequences.some((e) => e.id === summaryId && e.predecessorId === fase && e.successorId === los));

const seqCountAfterSummary = S().sequences.length;
const ancestorId = S().addSequence({ predecessorId: kind, successorId: fase, type: FS, lagDays: 0 });
ok('addSequence weigert een voorouder-relatie (kind → eigen ouder-samenvatting)', ancestorId === null);
ok('… geen extra relatie erbij', S().sequences.length === seqCountAfterSummary);

const undoDepth = S().historyEvents.filter(event => event.state === 'applied').length;
S().addSequence({ predecessorId: kind, successorId: fase, type: 'START_START', lagDays: 0 });
ok('geweigerde (voorouder-)relatie duwt geen undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length === undoDepth);

const msId = S().addSequence({ predecessorId: mp, successorId: los, type: FS, lagDays: 0 });
ok('addSequence staat een MIJLPAAL als voorganger toe (regressie-anker, ongewijzigd)', msId !== null);
ok('mijlpaal-relatie staat echt in de store',
  S().sequences.some((e) => e.id === msId && e.predecessorId === mp && e.successorId === los));

const los2 = S().addTask({ name: 'Los 2' });
const msSuccId = S().addSequence({ predecessorId: los2, successorId: mp, type: FS, lagDays: 0 });
ok('addSequence staat een MIJLPAAL als opvolger toe (regressie-anker, ongewijzigd)', msSuccId !== null);

const kindId = S().addSequence({ predecessorId: kind, successorId: los, type: FS, lagDays: 0 });
ok('addSequence staat een SUBTAAK zonder eigen kinderen toe (gewoon een bladtaak)', kindId !== null);

S().newProject();
const pOuder = S().addTask({ name: 'Ouder' });
const pKind = S().addTask({ name: 'Kind', parentId: pOuder });
const pSibling = S().addTask({ name: 'Sibling', parentId: pOuder });
const pElders = S().addTask({ name: 'Elders' });

const pValidSeqId = S().addSequence({ predecessorId: pKind, successorId: pSibling, type: FS, lagDays: 0 });
ok('plak-fixture: geldige Kind→Sibling-relatie is aangemaakt', pValidSeqId !== null);

useAppStore.setState((s) => {
  s.sequences.push({ id: 'ghost-seq-paste', predecessorId: pKind, successorId: pOuder, type: FS, lagDays: 0 });
});
ok('plak-fixture: spookrelatie staat in de store (buiten relationVerdict om)',
  S().sequences.some(e => e.id === 'ghost-seq-paste'));

S().copyTasks([pOuder]);
ok('plak-fixture: klembord bevat de hele tak', S().taskClipboard?.tasks.length === 3);
ok('plak-fixture: klembord bevat beide interne relaties (copyTasks filtert niet op geldigheid)',
  S().taskClipboard?.sequences.length === 2);

S().selectTask(pElders);
const seqCountBeforePaste = S().sequences.length;
const pasteRootIds = S().pasteTasks();
ok('pasteTasks levert precies één nieuwe root op (Ouder)', pasteRootIds.length === 1);

const newOuderId = pasteRootIds[0];
const newOuderTask = S().tasks.find(t => t.id === newOuderId);
const newKindId = newOuderTask?.childIds[0];
const newSiblingId = newOuderTask?.childIds[1];
ok('geplakte Ouder heeft twee nieuwe kinderen (Kind, Sibling)', newOuderTask?.childIds.length === 2);

ok('pasteTasks maakt PRECIES ÉÉN nieuwe relatie aan (de geldige, niet de spookrelatie)',
  S().sequences.length === seqCountBeforePaste + 1);
ok('de geldige Kind→Sibling-relatie is meegeplakt met de nieuwe ids',
  !!newKindId && !!newSiblingId
  && S().sequences.some(e => e.predecessorId === newKindId && e.successorId === newSiblingId));
ok('de spookrelatie (Kind→eigen Ouder) is NIET opnieuw aangemaakt onder de nieuwe ids',
  !!newKindId && !S().sequences.some(e => e.predecessorId === newKindId && e.successorId === newOuderId));

S().newProject();
const template: WbsTemplate = {
  id: 'tmpl-1',
  name: 'Testsjabloon',
  createdAt: new Date().toISOString(),
  tasks: [
    { id: 'tRoot', parentId: null, name: 'Root', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 5 },
    { id: 'tChild', parentId: 'tRoot', name: 'Child', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 2 },
    { id: 'tSibling', parentId: 'tRoot', name: 'Sibling', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 2 },
  ],
  sequences: [
    { predecessorId: 'tChild', successorId: 'tRoot', type: FS, lagDays: 0 },
    { predecessorId: 'tChild', successorId: 'tSibling', type: FS, lagDays: 0 },
  ],
};

const seqCountBeforeTemplate = S().sequences.length;
const newTemplateRootId = S().insertWbsTemplate(template, null);
ok('insertWbsTemplate levert een nieuwe root op', newTemplateRootId !== null);

const newTemplateRootTask = S().tasks.find(t => t.id === newTemplateRootId);
ok('sjabloon-root heeft twee kinderen (Child, Sibling)', newTemplateRootTask?.childIds.length === 2);
const newTemplateChildId = newTemplateRootTask?.childIds[0];
const newTemplateSiblingId = newTemplateRootTask?.childIds[1];

ok('insertWbsTemplate maakt PRECIES ÉÉN nieuwe relatie aan (de geldige, niet de spookrelatie)',
  S().sequences.length === seqCountBeforeTemplate + 1);
ok('de geldige Child→Sibling-relatie is mee ingevoegd met de nieuwe ids',
  !!newTemplateChildId && !!newTemplateSiblingId
  && S().sequences.some(e => e.predecessorId === newTemplateChildId && e.successorId === newTemplateSiblingId));
ok('de spookrelatie (Child→eigen Root) is NIET aangemaakt onder de nieuwe ids',
  !!newTemplateChildId && !S().sequences.some(e => e.predecessorId === newTemplateChildId && e.successorId === newTemplateRootId));

const sourceTasks = S().tasks;
const sourceRelation = S().sequences[0];
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const templateStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => templateStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { templateStorage.set(key, value); },
  },
});
try {
  for (const minutes of [240, -90, 0, undefined]) {
    for (const unit of ['WORKTIME', 'ELAPSEDTIME'] as const) {
      templateStorage.clear();
      const relation: Sequence = {
        ...sourceRelation, lagDays: minutes === undefined ? 2 : 0, lagUnit: unit,
        ...(minutes !== undefined ? { lagMinutes: minutes } : {}),
      };
      saveBranchAsWbsTemplate('Lag bewaren', newTemplateRootId!, sourceTasks, [relation]);
      const loaded = listWbsTemplates()[0];
      ok(`sjabloonopslag bewaart ${minutes} minuten (${unit})`, loaded.sequences[0].lagMinutes === minutes);
      ok(`oude dagsjablonen krijgen geen minutenveld (${unit}, ${minutes})`,
        ('lagMinutes' in loaded.sequences[0]) === (minutes !== undefined));
      S().newProject();
      const insertedRoot = S().insertWbsTemplate(loaded, null);
      const inserted = S().sequences[0];
      ok(`opnieuw invoegen bewaart alle lagvelden (${unit}, ${minutes})`,
        !!insertedRoot && S().sequences.length === 1 && inserted.lagMinutes === minutes
        && inserted.lagDays === relation.lagDays && inserted.lagUnit === unit);
      ok(`invoegen remapt beide eindpunten (${unit}, ${minutes})`,
        inserted.predecessorId !== relation.predecessorId && inserted.successorId !== relation.successorId);
    }
  }
  templateStorage.clear();
  saveBranchAsWbsTemplate('Percentage bewaren', newTemplateRootId!, sourceTasks,
    [{ ...sourceRelation, lagDays: 0, lagPercent: 25 }]);
  const percentTemplate = listWbsTemplates()[0];
  S().newProject();
  S().insertWbsTemplate(percentTemplate, null);
  ok('procentuele lag doorstaat opslag en invoegen zonder minutenveld',
    S().sequences[0].lagPercent === 25 && !('lagMinutes' in S().sequences[0]));
} finally {
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

{
  const base = { tasks: [
    task('root', ['a']), task('a', [], 'root'), task('a', [], 'b'), task('b'),
    task('c', [], 'd'), task('d', [], 'c'), task(''),
  ], sequences: [] as Sequence[] };
  const ids = new Map(base.tasks.map(t => [t.id, t.id]));
  const run = (legacy: boolean) => {
    let skipped: string[] = [];
    const result = produce(base, s => {
      const seq = (p: string, n: string): Omit<Sequence, 'id'> => ({
        predecessorId: p, successorId: n, type: FS, lagDays: 0, lagMinutes: -90, lagUnit: 'ELAPSEDTIME',
      });
      const relations = [
        seq('a', 'b'), seq('a', 'b'), seq('a', 'root'), seq('root', 'a'), seq('a', 'a'),
        seq('a', 'ontbreekt'), seq('c', 'b'), seq('b', 'a'), seq('', 'b'),
        { ...seq('a', 'b'), type: 'START_START' as const },
        { ...seq('a', 'root'), get lagDays() {
          s.tasks[1].parentId = null; s.tasks[1].name = 'Live gewijzigd'; return 0;
        } },
        seq('a', 'a'),
        { ...seq('a', 'a'), get lagDays() {
          Reflect.deleteProperty(s.tasks[1], 'name'); return 0;
        } },
      ];
      if (!legacy) { skipped = insertRemappedRelations(s, relations, ids); return; }
      const lookup = (id: string) => s.tasks.find(t => t.id === id);
      for (const relation of relations) {
        const candidate = { ...relation, predecessorId: ids.get(relation.predecessorId)!,
          successorId: ids.get(relation.successorId)! };
        if (!relationVerdict(lookup, s.sequences, candidate).ok) {
          skipped.push(`${lookup(candidate.predecessorId)?.name ?? '?'} → ${lookup(candidate.successorId)?.name ?? '?'}`);
        } else s.sequences.push({ ...candidate, id: 'alleen-test-id' });
      }
    });
    return { skipped, tasks: result.tasks, sequences: result.sequences.map(({ id: _id, ...rest }) => rest) };
  };
  const actual = run(false);
  ok('ingevoegde relaties: volledige find-pariteit met levende draftvelden',
    JSON.stringify(actual) === JSON.stringify(run(true)));
  ok('ingevoegde relaties: overslagvolgorde en namen blijven exact', JSON.stringify(actual.skipped) === JSON.stringify([
    'a → b', 'a → root', 'root → a', 'a → a', 'a → ?', 'Live gewijzigd → Live gewijzigd', '? → ?',
  ]));
  ok('ingevoegde relaties: bestaande kringsemantiek blijft gelijk (geen nieuwe per-relatie-kringcheck)',
    actual.sequences.some(r => r.predecessorId === 'b' && r.successorId === 'a'));
}

if (diffs.length === 0) {
  console.log(`OK  relation-rules: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  relation-rules: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
