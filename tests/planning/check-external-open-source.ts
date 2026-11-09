// Stap 1.7 (keuze 5, vorm 1; Ethan 2026-11-03; `docs/relaties-tussen-projecten.md` §5.1, §7.1 en §9): verversen
// terwijl de bron ook als document open staat in deze app.
//
// Wat deze check vastlegt:
// 1. Herkennen (`openSourceDocument`): met pad op het genormaliseerde pad, op de site op `siteFileId`, zonder pad
//    op project-id bij een document uit een bestand (geen variant zonder bestand, geen document van de site). Het
//    actieve document telt nooit; twee passende documenten ⇒ geen.
// 2. Een schoon geopend document ⇒ alles zoals nu: het anker uit het bestand, geen melding.
// 3. Niet-opgeslagen wijzigingen ⇒ het anker uit het opgeslagen bestand (met zijn versie) en een melding met de
//    knop *Rekenen met het geopende document* (ook bij *Bron vernieuwen* van één bron).
// 4. De knop ⇒ het anker uit het geopende document met de wijzigingen, gelezen op een kopie zoals een opgeslagen
//    bestand (geschreven, gelezen en doorgerekend): één undo-stap, met herberekening; alleen de koppelingen naar
//    die bron. Het brondocument verandert niet en rekent niet. Geen `sourceVersion`, wel `anchorReadAt`.
// 5. Daarna slaat de bron op ⇒ de balk (stap 1.5) meldt die versie, ook als het anker gelijk blijft;
//    *Accepteren* zet de echte versie (`externalVersionOnlyChanges`).
// 6. Gesloten, opgeslagen of een ander actief document ⇒ niets, met een melding.
// 7. `externalSourceFromOpenDocument` per soort bron: met pad het pad van de koppeling, op de site het site-id,
//    zonder pad geen pad; nooit een versie.
import { createAppStoreContext } from '@/state/appStore';
import { externalVersionOnlyChanges } from '@/engine/externalRefreshPreview';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import type { ExternalSourceLocator } from '@/engine/externalLinks';
import { readExternalSource, type ExternalSourceRead } from '@/state/externalSource';
import { externalSourceFromOpenDocument, openSourceDocument, unsavedOpenSources } from '@/state/openSourceDocument';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { capturePayload, type DocumentPayload } from '@/state/documentContract';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { NotificationAction } from '@/state/slices/types';
import type { ExternalLink, Task } from '@/types/task';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const PATH = '/projecten/Installateur.ifc';

// (1) Herkennen, per soort bron.
{
  const doc = (id: string, payload: { filePath?: string | null; siteFileId?: string | null; projectId: string; isDirty?: boolean }) => ({
    id,
    payload: {
      filePath: payload.filePath ?? null,
      siteFileId: payload.siteFileId ?? null,
      project: { id: payload.projectId } as DocumentPayload['project'],
      isDirty: payload.isDirty ?? true,
    },
  });
  const path: ExternalSourceLocator = { kind: 'path', filePath: '/projecten/./Installateur.ifc' };
  const docs = [
    doc('actief', { filePath: PATH, projectId: 'p1' }),
    doc('bron', { filePath: '/projecten/Installateur.ifc', projectId: 'p1' }),
    doc('kopie', { filePath: '/archief/Installateur.ifc', projectId: 'p1' }),
    doc('variant', { projectId: 'p1' }),
    doc('site', { filePath: 'Installateur.ifc', siteFileId: 's1', projectId: 'p1' }),
  ];
  eq('1a met pad: het genormaliseerde pad, niet het actieve document', openSourceDocument(path, docs, 'actief')?.id, 'bron');
  eq('1b met pad: het actieve document zelf telt niet', openSourceDocument(path, docs, 'bron')?.id, 'actief');
  eq('1c met pad: een ander pad met hetzelfde project-id telt niet',
    openSourceDocument({ kind: 'path', filePath: '/elders/Installateur.ifc' }, docs, 'actief'), null);
  eq('1d op de site: hetzelfde site-id', openSourceDocument({ kind: 'site', siteFileId: 's1' }, docs, 'actief')?.id, 'site');
  eq('1e op de site: een ander site-id telt niet', openSourceDocument({ kind: 'site', siteFileId: 's2' }, docs, 'actief'), null);
  // Zonder pad: hetzelfde project-id, uit een bestand en niet van de site. Hier passen 'bron' en 'kopie' (en het
  // actieve document, dat niet telt): twee documenten ⇒ niet te zeggen welke de bron is.
  eq('1f zonder pad: twee documenten met dit project-id ⇒ geen', openSourceDocument({ kind: 'project', projectId: 'p1' }, docs, 'actief'), null);
  const one = [doc('actief', { filePath: 'Aannemer.ifc', projectId: 'p0' }), doc('bron', { filePath: 'Installateur.ifc', projectId: 'p1' }),
    doc('variant', { projectId: 'p1' }), doc('site', { filePath: 'Installateur.ifc', siteFileId: 's1', projectId: 'p1' })];
  eq('1g zonder pad: het ene document uit een bestand; geen variant en geen document van de site',
    openSourceDocument({ kind: 'project', projectId: 'p1' }, one, 'actief')?.id, 'bron');
  // Alleen niet-opgeslagen wijzigingen geven een melding.
  const clean = [doc('actief', { filePath: 'Aannemer.ifc', projectId: 'p0' }), doc('bron', { filePath: PATH, projectId: 'p1', isDirty: false })];
  eq('1h een schoon geopend document ⇒ geen melding', unsavedOpenSources([{ kind: 'path', filePath: PATH }], clean, 'actief'), []);
  const dirty = [doc('actief', { filePath: 'Aannemer.ifc', projectId: 'p0' }), doc('bron', { filePath: PATH, projectId: 'p1' })];
  eq('1i niet-opgeslagen wijzigingen ⇒ één melding met de bestandsnaam (ook bij twee keer dezelfde bron)',
    unsavedOpenSources([{ kind: 'path', filePath: PATH }, { kind: 'path', filePath: '/projecten//Installateur.ifc' }], dirty, 'actief'),
    [{ key: normalizeExternalSourcePath(PATH), locator: { kind: 'path', filePath: PATH }, sourceDocumentId: 'bron', fileName: 'Installateur.ifc' }]);
}

// (7) Een geopend document als bron, per soort: nooit een versie, wel een leestijd.
{
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Installateur' });
  S().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  S().runCPM();
  store.setState({ filePath: 'Installateur.ifc' });
  const payload = capturePayload(S());
  const at = () => new Date('2027-01-01T00:00:00.000Z');
  const withPath = await externalSourceFromOpenDocument(payload, { kind: 'path', filePath: PATH }, undefined, at);
  eq('7a met pad: het pad van de koppeling, geen versie, wel een leestijd',
    [withPath.filePath, withPath.siteFileId, withPath.version, withPath.readAt, withPath.fileName, withPath.projectId],
    [PATH, undefined, undefined, '2027-01-01T00:00:00.000Z', 'Installateur.ifc', S().project.id]);
  const onSite = await externalSourceFromOpenDocument(payload, { kind: 'site', siteFileId: 's1' }, undefined, at);
  eq('7b op de site: het site-id, geen pad', [onSite.filePath, onSite.siteFileId, onSite.version], [undefined, 's1', undefined]);
  const noPath = await externalSourceFromOpenDocument(payload, { kind: 'project', projectId: S().project.id }, undefined, at);
  eq('7c zonder pad: geen pad', [noPath.filePath, noPath.siteFileId, noPath.version], [undefined, undefined, undefined]);
}

// Twee documenten in één app: eerst de bron *Installateur* (Installatie, 5 werkdagen vanaf 1 maart), dan het
// afhankelijke project *Aannemer* (A wacht FS op Installatie, B volgt A). De bron "ligt" op `PATH`: de lezer van
// de store krijgt de opgeslagen tekst (`saved`), met de versie `savedVersion`.
const app = async () => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Installateur' });
  const install = S().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  S().runCPM();
  store.setState({ filePath: PATH, isDirty: false });
  const sourceDocumentId = S().activeDocumentId;
  const sourceProjectId = S().project.id;
  const disk = { text: writeIFC(buildWriteIFCInput(S())), version: 'v1', reads: 0 };
  const readDisk = async (filePath: string): Promise<ExternalSourceRead | null> => {
    disk.reads++;
    const read = await readExternalSource(filePath, { readTextFile: async () => disk.text, readFile: async () => new Uint8Array() });
    return { ...read, version: disk.version, readAt: new Date().toISOString() };
  };
  store.setState({
    parseExternalSource: readDisk,
    externalSourceVersion: async () => disk.version,
  });

  S().newDocument();
  S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2027-03-01', 3, 'days') });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const ext: ExternalLink = {
    id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-05T16:00', sourceMissing: false,
    sourceRef: { projectId: sourceProjectId, projectName: 'Installateur', taskId: install, taskName: 'Installatie', filePath: PATH },
    sourceVersion: 'v1', anchorReadAt: '2027-01-01T00:00:00.000Z',
  };
  S().updateTask(a, { externalLinks: [ext] });
  S().runCPM();
  store.setState({ filePath: '/projecten/Aannemer.ifc' });
  return { store, S, a, b, install, sourceDocumentId, targetDocumentId: S().activeDocumentId, disk };
};
type App = Awaited<ReturnType<typeof app>>;

const linkOf = (S: App['S'], a: string) => S().tasks.find(t => t.id === a)!.externalLinks![0];
const actionsOf = (S: App['S']) => S().ui.notifications
  .flatMap(n => (n.action?.kind === 'refreshFromOpenDocument' ? [{ message: n.messageKey, params: n.params, action: n.action }] : []));
const messagesOf = (S: App['S']) => S().ui.notifications.map(n => n.messageKey);
const applied = (S: App['S']) => S().historyEvents.filter(e => e.state === 'applied').length;
const sourcePayload = (s: App) => s.S().documents.find(d => d.id === s.sourceDocumentId)!.payload!;

// Wijzigt de bron in haar eigen tabblad zonder op te slaan en zonder te rekenen: Installatie duurt 8 werkdagen.
const editSource = (s: App) => {
  const { S } = s;
  S().switchDocument(s.sourceDocumentId);
  const task = S().tasks.find(t => t.id === s.install)!;
  S().updateTask(s.install, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration * 8 / 5 } });
  S().switchDocument(s.targetDocumentId);
};

// (2) Een schoon geopend document ⇒ alles zoals nu.
{
  const s = await app();
  const { S, a } = s;
  const result = await S().refreshAllExternalAnchors();
  eq('2a schoon: geen melding, het anker uit het bestand', [result.unsavedOpenSources, actionsOf(S).length, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion],
    [[], 0, '2027-03-05T16:00', 'v1']);
}

// (3)–(5) Niet-opgeslagen wijzigingen, de knop en daarna opslaan.
{
  const s = await app();
  const { S, a, b } = s;
  editSource(s);
  eq('3a de bron heeft niet-opgeslagen wijzigingen en is niet herberekend',
    [sourcePayload(s).isDirty, sourcePayload(s).scheduleStale], [true, true]);
  const sourceBefore = sourcePayload(s);
  const sourceTasksBefore = sourceBefore.tasks;

  // *Alle externe relaties vernieuwen*: het anker uit het opgeslagen bestand, met zijn versie; een melding.
  s.disk.version = 'v2';
  const result = await S().refreshAllExternalAnchors();
  eq('3b het anker uit het opgeslagen bestand, met de versie', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], ['2027-03-05T16:00', 'v2']);
  eq('3c de uitslag noemt de bron', result.unsavedOpenSources.map(u => [u.key, u.sourceDocumentId, u.fileName]),
    [[normalizeExternalSourcePath(PATH), s.sourceDocumentId, 'Installateur.ifc']]);
  const notes = actionsOf(S);
  eq('3d één melding met de knop', notes.map(n => [n.message, n.params, n.action.labelKey]),
    [['notifications.externalOpenSourceUnsaved', { file: 'Installateur.ifc' }, 'notifications.actions.useOpenDocument']]);
  // Nog eens vernieuwen ⇒ dezelfde melding, niet twee.
  await S().refreshAllExternalAnchors();
  eq('3e nog eens vernieuwen ⇒ nog steeds één melding', actionsOf(S).length, 1);
  // *Bron vernieuwen* van één bron geeft dezelfde melding.
  for (const n of S().ui.notifications) S().dismissNotification(n.id);
  const one = await S().refreshExternalAnchorsFrom(PATH);
  eq('3f Bron vernieuwen: dezelfde melding', [one?.unsavedOpenSources.length, actionsOf(S).length], [1, 1]);

  // De knop.
  const action = actionsOf(S)[0].action as Extract<NotificationAction, { kind: 'refreshFromOpenDocument' }>;
  const steps = applied(S);
  const endBefore = S().cpmResult?.projectEnd;
  const { kind: _k, labelKey: _l, ...request } = action;
  void _k; void _l;
  const used = await S().refreshExternalAnchorsFromOpenDocument(request);
  eq('4a het anker uit het geopende document, met de wijziging (8 werkdagen)', [used?.refreshed, linkOf(S, a).anchorDate], [1, '2027-03-10T16:00']);
  eq('4b geen versie, wel een leestijd', [linkOf(S, a).sourceVersion, typeof linkOf(S, a).anchorReadAt], [undefined, 'string']);
  eq('4c één undo-stap, met herberekening', [applied(S) - steps, S().scheduleStale, S().cpmResult?.projectEnd !== endBefore],
    [1, false, true]);
  eq('4d B schuift mee', S().tasks.find(t => t.id === b)!.time.earlyStart! > '2027-03-15', true);
  eq('4e een melding dat het gelukt is', messagesOf(S).includes('notifications.externalOpenSourceUsed'), true);
  eq('4f het brondocument is niet veranderd en niet herberekend',
    [sourcePayload(s) === sourceBefore, sourcePayload(s).tasks === sourceTasksBefore, sourcePayload(s).isDirty, sourcePayload(s).scheduleStale],
    [true, true, true, true]);
  S().undo();
  eq('4g Ctrl+Z ⇒ het anker uit het opgeslagen bestand terug', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], ['2027-03-05T16:00', 'v2']);
  S().redo();
  eq('4h Ctrl+Y ⇒ weer het anker uit het geopende document', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], ['2027-03-10T16:00', undefined]);

  // (5) De planner slaat de bron op (dezelfde inhoud) ⇒ de balk meldt die versie, ook al blijft het anker gelijk.
  S().switchDocument(s.sourceDocumentId);
  s.disk.text = writeIFC(buildWriteIFCInput(S()));
  s.disk.version = 'v3';
  S().markAutoSaveVersionSaved(s.sourceDocumentId, S());
  S().switchDocument(s.targetDocumentId);
  await S().checkExternalSources();
  const bar = S().ui.externalSourceUpdates;
  eq('5a de balk bij de opgeslagen versie, met één koppeling', bar.map(u => [u.key, u.version, u.changedLinks]),
    [[normalizeExternalSourcePath(PATH), 'v3', 1]]);
  const saved = await S().readExternalSourceAt(bar[0].locator);
  eq('5b alleen de herkomst verandert', externalVersionOnlyChanges(S().tasks, (await import('@/engine/externalLinks'))
    .refreshExternalAnchors(S().tasks, saved!, 'file-path').tasks).map(c => [c.before.anchorDate, c.link.anchorDate, c.link.sourceVersion]),
  [['2027-03-10T16:00', '2027-03-10T16:00', 'v3']]);
  const beforeAccept = applied(S);
  eq('5c Accepteren zet de echte versie', [S().acceptExternalSourceUpdate(saved!), linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, applied(S) - beforeAccept],
    [true, '2027-03-10T16:00', 'v3', 1]);
  eq('5d de balk is weg', S().ui.externalSourceUpdates.length, 0);
  await S().checkExternalSources();
  eq('5e geen nieuwe balk bij dezelfde versie', S().ui.externalSourceUpdates.length, 0);
}

// (5f) Een oudere koppeling zonder leestijd krijgt geen balk als alleen de herkomst zou veranderen.
{
  const before: Task = {
    id: 'A', name: 'A', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2027-03-01', 1, 'days'),
    externalLinks: [{ id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: 'd', sourceMissing: false, sourceRef: { projectId: 'p', taskId: 't' } }],
  };
  const after: Task = { ...before, externalLinks: [{ ...before.externalLinks![0], sourceVersion: 'v', anchorReadAt: 'r' }] };
  eq('5f een koppeling zonder leestijd telt niet', externalVersionOnlyChanges([before], [after]), []);
  const withRead: Task = { ...before, externalLinks: [{ ...before.externalLinks![0], anchorReadAt: 'r0' }] };
  eq('5g een koppeling met leestijd en zonder versie telt wel', externalVersionOnlyChanges([withRead], [after]).length, 1);
}

// (6) Gesloten, opgeslagen of een ander actief document ⇒ niets, met een melding.
{
  const run = async (tag: string, change: (s: App) => void) => {
    const s = await app();
    const { S, a } = s;
    editSource(s);
    await S().refreshAllExternalAnchors();
    const action = actionsOf(S)[0]?.action as Extract<NotificationAction, { kind: 'refreshFromOpenDocument' }> | undefined;
    if (!action) { eq(`${tag} er is een knop`, false, true); return; }
    const anchor = linkOf(S, a).anchorDate;
    change(s);
    const steps = applied(S);
    const { kind: _k, labelKey: _l, ...request } = action;
    void _k; void _l;
    const result = await S().refreshExternalAnchorsFromOpenDocument(request);
    S().switchDocument(s.targetDocumentId);
    eq(`${tag} niets ververst, wel een melding`,
      [result, linkOf(S, a).anchorDate === anchor, applied(S) - steps, messagesOf(S).includes('notifications.externalOpenSourceGone')],
      [null, true, 0, true]);
  };
  await run('6a gesloten:', (s) => s.S().closeDocument(s.sourceDocumentId));
  await run('6b opgeslagen:', (s) => s.S().markAutoSaveVersionSaved(s.sourceDocumentId, sourcePayload(s)));
  await run('6c een ander actief document:', (s) => s.S().switchDocument(s.sourceDocumentId));
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX ${f}`);
  console.log(`XX check-external-open-source: ${failures.length} van ${checks} controles faalden`);
  process.exit(1);
}
console.log(`OK check-external-open-source: ${checks} controles (geopend brondocument, stap 1.7)`);
