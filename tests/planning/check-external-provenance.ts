// De herkomst van een extern anker (keuze 4, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md` 5.4):
// drie optionele velden per koppeling. `sourceRef.siteFileId` (het vaste id op de site), `sourceVersion`
// (het versienummer op de site, of de wijzigingstijd van het bestand) en `anchorReadAt` (wanneer OPS het
// anker las). De tooltip toont ze als "Herkomst anker".
//
// Wat deze check vastlegt:
// 1. Verversen schrijft de versie en de leestijd van de bron. Dezelfde versie en hetzelfde anker ⇒ geen
//    wijziging (zelfde objecten), ook niet van de leestijd. Een nieuwe versie ⇒ nieuwe versie en leestijd,
//    ook als het anker gelijk bleef. Een bron zonder versie wist een oude versie.
// 2. De dialoog (handmatige route) houdt de herkomst alleen als het anker uit de bron blijft staan.
// 3. Een opgeslagen bestand houdt de velden; een veld dat geen tekst is, valt weg.
// 4. De weergave: site-versie, bestandstijd, alleen leestijd of niets.
// 5. De relatiecel (review Sol op #809): alleen de lag wijzigen houdt versie, leestijd en site-id, in de store
//    en na opslaan en openen. Dezelfde tokens ⇒ geen wijziging. Een ander anker ⇒ geen versie en leestijd meer.
import './domStub';
import { refreshExternalAnchors, storedExternalLinks, externalAnchorProvenance, type ExternalSourceDoc } from '@/engine/externalLinks';
import { buildManualExternalLinkSubmission } from '@/components/dialogs/ExternalLinkDialog';
import { buildTaskRelationIndex, taskRelations } from '@/engine/taskGrid/relationIndex';
import { buildRelationCellItems } from '@/engine/taskGrid/relationCell';
import type { ParsedRelationToken } from '@/engine/taskGrid/relationPlan';
import { createAppStoreContext } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ExternalLink, Task } from '@/types/task';
import type { RelationSetIntent, TaskColumnContext } from '@/types/taskGrid';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const task = (id: string, start: string, links?: ExternalLink[]): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime(start, 5, 'days'), earlyStart: `${start}T08:00`, earlyFinish: '2027-03-05T16:00' },
  ...(links ? { externalLinks: links } : {}),
});
const link: ExternalLink = {
  id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-05T16:00',
  sourceMissing: false, sourceRef: { projectId: 'bron', taskId: 'b1', taskName: 'b1', filePath: '/p/bron.ifc', projectName: 'Bron' },
};
const source = (extra: Partial<ExternalSourceDoc>): ExternalSourceDoc => ({
  projectId: 'bron', projectName: 'Bron', filePath: '/p/bron.ifc', tasks: [task('b1', '2027-03-01')], ...extra,
});

// (1) Verversen.
{
  const own = [task('L', '2027-03-08', [link])];
  const first = refreshExternalAnchors(own, source({ version: '2026-11-02T14:05:00.000Z', readAt: '2026-11-02T14:10:00.000Z' }));
  const l1 = first.tasks[0].externalLinks![0];
  eq('1a verversen schrijft de versie', l1.sourceVersion, '2026-11-02T14:05:00.000Z');
  eq('1b verversen schrijft de leestijd', l1.anchorReadAt, '2026-11-02T14:10:00.000Z');
  eq('1c het anker bleef gelijk, maar de herkomst is nieuw ⇒ gewijzigd', first.changed, true);

  const again = refreshExternalAnchors(first.tasks, source({ version: '2026-11-02T14:05:00.000Z', readAt: '2026-11-03T09:00:00.000Z' }));
  eq('1d dezelfde versie en hetzelfde anker ⇒ niets gewijzigd', again.changed, false);
  eq('1e en dezelfde takenlijst (geen nieuw object)', again.tasks === first.tasks, true);
  eq('1f de oude leestijd blijft', again.tasks[0].externalLinks![0].anchorReadAt, '2026-11-02T14:10:00.000Z');

  const newer = refreshExternalAnchors(first.tasks, source({ version: '2026-11-03T08:00:00.000Z', readAt: '2026-11-03T09:00:00.000Z' }));
  const l3 = newer.tasks[0].externalLinks![0];
  eq('1g een nieuwe versie met hetzelfde anker ⇒ nieuwe versie', l3.sourceVersion, '2026-11-03T08:00:00.000Z');
  eq('1h en nieuwe leestijd', l3.anchorReadAt, '2026-11-03T09:00:00.000Z');
  eq('1i het anker zelf is niet veranderd', l3.anchorDate, '2027-03-05T16:00');

  const moved = source({ tasks: [{ ...task('b1', '2027-03-01'), time: { ...task('b1', '2027-03-01').time, earlyFinish: '2027-03-12T16:00' } }], readAt: '2026-11-04T10:00:00.000Z' });
  const unknown = refreshExternalAnchors(newer.tasks, moved);
  const l4 = unknown.tasks[0].externalLinks![0];
  eq('1j een bron zonder versie: het nieuwe anker telt', l4.anchorDate, '2027-03-12T16:00');
  eq('1k en de oude versie is weg (het anker komt niet meer uit die versie)', 'sourceVersion' in l4, false);
  eq('1l de leestijd is de nieuwe', l4.anchorReadAt, '2026-11-04T10:00:00.000Z');

  const plain = refreshExternalAnchors(own, source({}));
  eq('1m een bron zonder versie en leestijd, anker gelijk ⇒ niets gewijzigd (zoals voorheen)', plain.changed, false);

  // Een oudere koppeling zonder herkomst, een bron zonder versie: de leestijd komt er één keer bij.
  const readOnce = refreshExternalAnchors(own, source({ readAt: '2026-11-05T08:00:00.000Z' }));
  const l5 = readOnce.tasks[0].externalLinks![0];
  eq('1p geen versie bekend, nog geen leestijd ⇒ de leestijd komt erbij', [readOnce.changed, l5.anchorReadAt, 'sourceVersion' in l5],
    [true, '2026-11-05T08:00:00.000Z', false]);
  const readTwice = refreshExternalAnchors(readOnce.tasks, source({ readAt: '2026-11-06T08:00:00.000Z' }));
  eq('1q een volgende lezing zonder versie en met hetzelfde anker ⇒ niets gewijzigd', readTwice.changed, false);

  // Een koppeling naar een andere bron houdt haar herkomst.
  const other: ExternalLink = { ...link, id: 'y', sourceRef: { projectId: 'ander', taskId: 'z', filePath: '/p/ander.ifc' }, sourceVersion: '7', anchorReadAt: '2026-10-01T00:00:00.000Z' };
  const mixed = refreshExternalAnchors([task('L', '2027-03-08', [link, other])], source({ version: 'v9', readAt: '2026-11-02T00:00:00.000Z' }));
  eq('1n een koppeling naar een andere bron blijft ongemoeid', mixed.tasks[0].externalLinks![1], other);
  // De site-id blijft staan bij verversen.
  const site: ExternalLink = { ...link, sourceRef: { ...link.sourceRef, siteFileId: 'site-1' } };
  const siteRefresh = refreshExternalAnchors([task('L', '2027-03-08', [site])], source({ version: '12', readAt: '2026-11-02T00:00:00.000Z' }));
  eq('1o de site-id blijft staan', siteRefresh.tasks[0].externalLinks![0].sourceRef.siteFileId, 'site-1');
}

// (2) De handmatige route in de dialoog.
{
  const existing: ExternalLink = { ...link, sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z', sourceRef: { ...link.sourceRef, siteFileId: 'site-1' } };
  const base = {
    existing, direction: 'predecessor' as const, relType: 'FS' as const, lag: { lagDays: 1 },
    projectId: 'bron', taskId: 'b1', taskName: 'b1', anchor: '2027-03-05T16:00',
  };
  const kept = buildManualExternalLinkSubmission({ ...base, anchorTouched: false });
  eq('2a anker niet aangeraakt ⇒ herkomst blijft', [kept.sourceVersion, kept.anchorReadAt, kept.sourceRef.siteFileId],
    ['12', '2026-11-02T14:10:00.000Z', 'site-1']);
  const touched = buildManualExternalLinkSubmission({ ...base, anchor: '2027-03-09T16:00', anchorTouched: true });
  eq('2b anker zelf ingevuld ⇒ geen herkomst meer', ['sourceVersion' in touched, 'anchorReadAt' in touched], [false, false]);
  const otherTask = buildManualExternalLinkSubmission({ ...base, taskId: 'b2', anchorTouched: true });
  eq('2c andere brontaak ⇒ geen herkomst en geen site-id', ['sourceVersion' in otherTask, 'siteFileId' in otherTask.sourceRef], [false, false]);
}

// (3) Opgeslagen koppelingen lezen.
{
  const raw = [
    { ...link, sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z', sourceRef: { ...link.sourceRef, siteFileId: 'site-1' } },
    { ...link, id: 'b', sourceVersion: 12, anchorReadAt: null, sourceRef: { ...link.sourceRef, siteFileId: 5 } },
  ];
  const read = storedExternalLinks(JSON.parse(JSON.stringify(raw)))!;
  eq('3a geldige herkomst blijft staan', [read[0].sourceVersion, read[0].anchorReadAt, read[0].sourceRef.siteFileId],
    ['12', '2026-11-02T14:10:00.000Z', 'site-1']);
  eq('3b een herkomstveld dat geen tekst is, valt weg',
    ['sourceVersion' in read[1], 'anchorReadAt' in read[1], 'siteFileId' in read[1].sourceRef], [false, false, false]);
  eq('3c de koppeling zelf blijft', read[1].anchorDate, link.anchorDate);
}

// (4) De weergave.
{
  eq('4a site', externalAnchorProvenance({ sourceRef: { projectId: 'p', taskId: 't', siteFileId: 's' }, sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z' }),
    { kind: 'site', version: '12', readAt: new Date('2026-11-02T14:10:00.000Z') });
  eq('4b bestand', externalAnchorProvenance({ sourceRef: { projectId: 'p', taskId: 't' }, sourceVersion: '2026-11-02T14:05:00.000Z', anchorReadAt: '2026-11-02T14:10:00.000Z' }),
    { kind: 'file', modified: new Date('2026-11-02T14:05:00.000Z'), readAt: new Date('2026-11-02T14:10:00.000Z') });
  eq('4c alleen een leestijd', externalAnchorProvenance({ sourceRef: { projectId: 'p', taskId: 't' }, anchorReadAt: '2026-11-02T14:10:00.000Z' }),
    { kind: 'read', readAt: new Date('2026-11-02T14:10:00.000Z') });
  eq('4d niets bekend', externalAnchorProvenance({ sourceRef: { projectId: 'p', taskId: 't' } }), { kind: 'none' });
  eq('4e een bestandsversie die geen tijd is, zonder leestijd ⇒ niets', externalAnchorProvenance({ sourceRef: { projectId: 'p', taskId: 't' }, sourceVersion: 'onzin' }), { kind: 'none' });
}

// (5) De relatiecel, via dezelfde route als het taakraster: celitems → `runGridMutation` → IFC.
{
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-08', name: 'Eigen' });
  const owner = S().addTask({ name: 'Afbouw', time: createDefaultTaskTime('2027-03-08', 5, 'days') });
  const linkId = S().addExternalLink(owner, {
    direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-05T16:00', sourceMissing: false,
    sourceRef: { ...link.sourceRef, siteFileId: 'site-1' },
    sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z',
  });
  S().runCPM();
  const current = () => S().tasks.find(t => t.id === owner)!.externalLinks!.find(l => l.id === linkId)!;
  const provenanceOf = (l: ExternalLink) => [l.sourceVersion, l.anchorReadAt, l.sourceRef.siteFileId];
  const applied = () => S().historyEvents.filter(e => e.state === 'applied').length;
  /** De tokens van de voorgangerscel, zoals de celeditor ze krijgt. */
  const tokens = (): ParsedRelationToken[] => {
    const st = S();
    const index = buildTaskRelationIndex(st.tasks, st.sequences, st.cpmResult);
    const context: TaskColumnContext = {
      projectId: st.project.id, tasksById: new Map(st.tasks.map(t => [t.id, t])), relationIndex: index,
      assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(), scheduleStale: st.scheduleStale,
    };
    return buildRelationCellItems({
      ownerTaskId: owner, direction: 'predecessor', entries: taskRelations(index, owner, 'predecessor'), context,
    }).map(item => item.parsedToken);
  };
  const setCell = (value: ParsedRelationToken[]) => {
    const intent: RelationSetIntent = { kind: 'relation-set', taskId: owner, direction: 'predecessor', value };
    return S().runGridMutation([intent]).ok;
  };
  const withExternal = (edit: (external: Extract<ParsedRelationToken, { kind: 'external' }>['external']) => object) =>
    tokens().map(token => token.kind === 'external' ? { ...token, external: { ...token.external, ...edit(token.external) } } : token);

  eq('5a opzet: de koppeling draagt versie, leestijd en site-id', provenanceOf(current()), ['12', '2026-11-02T14:10:00.000Z', 'site-1']);

  // Dezelfde tokens terugzetten ⇒ niets gewijzigd, ook met een site-id (het token draagt die niet).
  const steps = applied();
  eq('5b dezelfde tokens ⇒ geslaagd', setCell(tokens()), true);
  eq('5c en geen undo-stap', applied(), steps);
  eq('5d en de herkomst staat er nog', provenanceOf(current()), ['12', '2026-11-02T14:10:00.000Z', 'site-1']);

  // Alleen de lag: 0d → 1d.
  eq('5e lag 0d → 1d ⇒ geslaagd', setCell(withExternal(() => ({ lag: { lagDays: 1 } }))), true);
  eq('5f de lag is 1d', current().lagDays, 1);
  eq('5g het anker is gelijk', current().anchorDate, '2027-03-05T16:00');
  eq('5h de herkomst blijft in de store', provenanceOf(current()), ['12', '2026-11-02T14:10:00.000Z', 'site-1']);

  // Opslaan en weer openen.
  const opened = createAppStoreContext().store;
  opened.getState().applyLoadedProject(readIFC(writeIFC(buildWriteIFCInput(S()))), { filePath: null, recompute: true });
  const reopened = opened.getState().tasks.find(t => t.name === 'Afbouw')!.externalLinks![0];
  eq('5i na opslaan en openen: lag 1d en dezelfde herkomst', [reopened.lagDays, ...provenanceOf(reopened)],
    [1, '12', '2026-11-02T14:10:00.000Z', 'site-1']);

  // Een ander anker in de cel komt niet meer uit de bron: geen versie en leestijd meer, de site-id blijft.
  eq('5j ander anker ⇒ geslaagd', setCell(withExternal(() => ({ anchorDate: '2027-03-09T16:00' }))), true);
  eq('5k ander anker ⇒ geen versie en leestijd meer; de site-id blijft', provenanceOf(current()), [undefined, undefined, 'site-1']);
}

if (failures.length) {
  console.error(`XX external-provenance: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-provenance: ${checks} checks`);
