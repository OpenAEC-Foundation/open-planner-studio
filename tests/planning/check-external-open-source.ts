// Stap 1.7 (keuze 5, Ethan 2026-11-03; vinkje als vaste projectinstelling, Ethan 2026-11-10;
// `docs/relaties-tussen-projecten.md` §5.1, §7.1 en §9): verversen terwijl de bron ook als document open staat in
// deze app.
//
// Wat deze check vastlegt:
// 1. Herkennen (`openSourceDocument`): met pad op het genormaliseerde pad, op de site op `siteFileId`, zonder pad
//    op project-id bij een document uit een bestand (geen variant zonder bestand, geen document van de site). Het
//    actieve document telt nooit; twee passende documenten ⇒ geen.
// 2. Een schoon geopend document ⇒ alles zoals nu: het anker uit het bestand, geen melding.
// 3. Vinkje *Ankers uit geopende documenten halen* uit: het anker uit het opgeslagen bestand (met zijn versie) en
//    een gewone melding zonder knop; de automatische controle geeft geen balk uit het geopende document.
// 4. Vinkje aan, zelf vernieuwen (*Alle externe relaties vernieuwen*, *Bron vernieuwen*): het anker uit het geopende
//    document, op een kopie, zonder melding; één undo-stap met herberekening; geen versie, wel een leestijd. Het
//    brondocument verandert niet en rekent niet.
// 5. Vinkje aan, automatische controle: wijken de ankers af, dan de balk (zonder versie, `openDocumentId`); het
//    document verandert niets zonder klik. *Bekijken* leest het geopende document; *Accepteren* is één undo-stap,
//    daarna geen balk. Gelijke ankers ⇒ geen balk. Geen tweede balk voor de opgeslagen versie.
// 6. *Later*: dezelfde voorgestelde ankers (vingerafdruk) ⇒ geen nieuwe balk; andere ankers ⇒ wel.
// 7. `externalSourceFromOpenDocument` per soort bron: met pad het pad van de koppeling, op de site het site-id,
//    zonder pad geen pad; nooit een versie. De vingerafdruk hangt alleen af van de voorgestelde ankers.
// 8. Opslaan na een anker uit het geopende document: blijven de ankers gelijk, dan geen balk en de koppeling houdt
//    "versie onbekend" (besluit Ethan 2026-11-10); een latere opgeslagen datumwijziging geeft de gewone balk, en
//    *Accepteren* legt de versie vast.
// 9. *Bronbestanden kiezen…*: vinkje uit ⇒ de melding; vinkje aan ⇒ het anker uit het geopende document.
// 11. Het vinkje zelf: `projectInfoPatch`, Toepassen als één undo-stap, en het IFC-bestand (alleen wanneer aan).
// 12. De teller per document en bron (review #860 ronde 3): een controle die een oudere versie las, publiceert
//    niets als een route de bron intussen veranderde, met pad en op de site, ook met het vinkje aan (14, 15); en een
//    controle tijdens *Later* of *Accepteren* (16, 17).
import { createAppStoreContext } from '@/state/appStore';
import { externalAnchorChanges } from '@/engine/externalRefreshPreview';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { refreshExternalAnchors, type ExternalSourceLocator } from '@/engine/externalLinks';
import { readExternalSource, type ExternalSourceRead } from '@/state/externalSource';
import {
  externalSourceFromOpenDocument, proposalFingerprint, openSourceDocument, unsavedOpenSources,
} from '@/state/openSourceDocument';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { capturePayload, type DocumentPayload } from '@/state/documentContract';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { projectInfoPatch } from '@/state/projectInfoPatch';
import { readIFC } from '@/services/ifc/ifcReader';
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
    [{ key: normalizeExternalSourcePath(PATH), fileName: 'Installateur.ifc' }]);
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
  // De vingerafdruk: alleen de voorgestelde ankers tellen, niet de volgorde of het vorige anker.
  const task = (anchor: string, missing = false): Task => ({
    id: 'A', name: 'A', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2027-03-01', 1, 'days'),
    externalLinks: [
      { id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: anchor, sourceMissing: missing, sourceRef: { projectId: 'p', taskId: 't' } },
      { id: 'y', direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: anchor, sourceMissing: missing, sourceRef: { projectId: 'p', taskId: 'u' } },
    ],
  });
  const fp = (from: string, to: string, missing = false) => proposalFingerprint(externalAnchorChanges([task(from)], [task(to, missing)]));
  const reversed = proposalFingerprint(externalAnchorChanges([task('d1')], [task('d2')]).reverse());
  eq('7d de vingerafdruk: gelijk bij hetzelfde voorstel (ook in een andere volgorde of vanaf een ander anker)',
    [fp('d1', 'd2') === fp('d0', 'd2'), fp('d1', 'd2') === reversed, fp('d1', 'd2').startsWith('open:')], [true, true, true]);
  eq('7e de vingerafdruk: anders bij een ander voorstel of bij brontaak ontbreekt',
    [fp('d1', 'd2') === fp('d1', 'd3'), fp('d1', 'd2') === fp('d1', 'd2', true)], [false, false]);
}

// Twee documenten in één app: eerst de bron *Installateur* (Installatie, 5 werkdagen vanaf 1 maart), dan het
// afhankelijke project *Aannemer* (A wacht FS op Installatie, B volgt A). De bron "ligt" op `PATH`: de lezer van
// de store krijgt de opgeslagen tekst (`disk.text`), met de versie `disk.version`. `on`: het vinkje *Ankers uit
// geopende documenten halen* staat aan in *Aannemer*.
const app = async (kind: 'path' | 'project' = 'path', on = false) => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Installateur' });
  const install = S().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  S().runCPM();
  store.setState({ filePath: kind === 'path' ? PATH : 'Installateur.ifc', isDirty: false });
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
    sourceRef: {
      projectId: sourceProjectId, projectName: 'Installateur', taskId: install, taskName: 'Installatie',
      ...(kind === 'path' ? { filePath: PATH } : {}),
    },
    sourceVersion: 'v1', anchorReadAt: '2027-01-01T00:00:00.000Z',
  };
  S().updateTask(a, { externalLinks: [ext] });
  if (on) S().setProject({ anchorsFromOpenDocuments: true });
  S().runCPM();
  store.setState({ filePath: '/projecten/Aannemer.ifc' });
  return { store, S, a, b, install, sourceDocumentId, targetDocumentId: S().activeDocumentId, disk };
};
type App = Awaited<ReturnType<typeof app>>;

const linkOf = (S: App['S'], a: string) => S().tasks.find(t => t.id === a)!.externalLinks![0];
const unsavedNotices = (S: App['S']) => S().ui.notifications.filter(n => n.messageKey === 'notifications.externalOpenSourceUnsaved');
const applied = (S: App['S']) => S().historyEvents.filter(e => e.state === 'applied').length;
const sourcePayload = (s: App) => s.S().documents.find(d => d.id === s.sourceDocumentId)!.payload!;
const bars = (S: App['S']) => S().ui.externalSourceUpdates;

// Wijzigt de bron in haar eigen tabblad zonder op te slaan en zonder te rekenen: de duur van Installatie maal
// `factor` (standaard 5 → 8 werkdagen, anker 10 maart).
const editSource = (s: App, factor = 8 / 5) => {
  const { S } = s;
  S().switchDocument(s.sourceDocumentId);
  const task = S().tasks.find(t => t.id === s.install)!;
  S().updateTask(s.install, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration * factor } });
  S().switchDocument(s.targetDocumentId);
};
// Wijzigt alleen de naam van de brontaak (de ankers blijven gelijk), zonder op te slaan.
const renameSource = (s: App, name: string) => {
  const { S } = s;
  S().switchDocument(s.sourceDocumentId);
  S().updateTask(s.install, { name });
  S().switchDocument(s.targetDocumentId);
};
// Slaat de bron op: de tekst op de "schijf" wordt het brondocument, met deze versie; het document is daarna schoon.
const saveSource = (s: App, version: string) => {
  const { S } = s;
  S().switchDocument(s.sourceDocumentId);
  S().runCPM();
  s.disk.text = writeIFC(buildWriteIFCInput(S()));
  s.disk.version = version;
  S().markAutoSaveVersionSaved(s.sourceDocumentId, S());
  S().switchDocument(s.targetDocumentId);
};

// (2) Een schoon geopend document ⇒ alles zoals nu, ook met het vinkje aan.
for (const on of [false, true]) {
  const s = await app('path', on);
  const { S, a } = s;
  const result = await S().refreshAllExternalAnchors();
  eq(`2a schoon (vinkje ${on ? 'aan' : 'uit'}): geen melding, het anker uit het bestand`,
    [result.refreshed, unsavedNotices(S).length, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, s.disk.reads],
    [1, 0, '2027-03-05T16:00', 'v1', 1]);
}

// (3) Vinkje uit: het anker uit het opgeslagen bestand, met een gewone melding zonder knop.
{
  const s = await app();
  const { S, a } = s;
  editSource(s);
  await S().checkExternalSources();
  eq('3a de automatische controle: geen balk uit het geopende document', bars(S).length, 0);
  s.disk.version = 'v2';
  await S().refreshAllExternalAnchors();
  eq('3b het anker uit het opgeslagen bestand, met de versie', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], ['2027-03-05T16:00', 'v2']);
  eq('3c één gewone melding, zonder knop', unsavedNotices(S).map(n => [n.params, n.action, n.sticky, n.severity]),
    [[{ file: 'Installateur.ifc' }, undefined, undefined, 'info']]);
  await S().refreshAllExternalAnchors();
  eq('3d nog eens vernieuwen ⇒ nog steeds één melding', unsavedNotices(S).length, 1);
  for (const n of S().ui.notifications) S().dismissNotification(n.id);
  const one = await S().refreshExternalAnchorsFrom(PATH);
  eq('3e Bron vernieuwen: dezelfde melding', [one?.refreshed, unsavedNotices(S).length], [1, 1]);
}

// (4) Vinkje aan, zelf vernieuwen: het anker uit het geopende document.
{
  const s = await app('path', true);
  const { S, a, b } = s;
  editSource(s);
  s.disk.version = 'v2';
  const reads = s.disk.reads;
  const sourceBefore = sourcePayload(s);
  const sourceTasksBefore = sourceBefore.tasks;
  const steps = applied(S);
  const endBefore = S().cpmResult?.projectEnd;
  const result = await S().refreshAllExternalAnchors();
  eq('4a het anker uit het geopende document, met de wijziging (8 werkdagen)', [result.refreshed, linkOf(S, a).anchorDate], [1, '2027-03-10T16:00']);
  eq('4b geen versie, wel een leestijd', [linkOf(S, a).sourceVersion, typeof linkOf(S, a).anchorReadAt], [undefined, 'string']);
  eq('4c geen melding en het opgeslagen bestand niet gelezen', [unsavedNotices(S).length, s.disk.reads - reads], [0, 0]);
  eq('4d één undo-stap, met herberekening', [applied(S) - steps, S().scheduleStale, S().cpmResult?.projectEnd !== endBefore], [1, false, true]);
  eq('4e B schuift mee', S().tasks.find(t => t.id === b)!.time.earlyStart! > '2027-03-15', true);
  eq('4f het brondocument is niet veranderd en niet herberekend',
    [sourcePayload(s) === sourceBefore, sourcePayload(s).tasks === sourceTasksBefore, sourcePayload(s).isDirty, sourcePayload(s).scheduleStale],
    [true, true, true, true]);
  S().undo();
  eq('4g Ctrl+Z ⇒ het oude anker terug', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], ['2027-03-05T16:00', 'v1']);
  const one = await S().refreshExternalAnchorsFrom(PATH);
  eq('4h Bron vernieuwen: ook uit het geopende document, zonder melding',
    [one?.refreshed, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, unsavedNotices(S).length, s.disk.reads - reads],
    [1, '2027-03-10T16:00', undefined, 0, 0]);
}

// (5) Vinkje aan, automatische controle: de balk uit het geopende document; niets verandert zonder klik.
{
  const s = await app('path', true);
  const { S, a } = s;
  editSource(s);
  const steps = applied(S);
  const reads = s.disk.reads;
  await S().checkExternalSources();
  const bar = bars(S);
  eq('5a de balk: uit het geopende document, zonder versie of auteur, één koppeling',
    bar.map(u => [u.key, u.openDocumentId, u.version.startsWith('open:'), u.changedLinks, u.fileName, u.author, u.siteVersionLabel]),
    [[normalizeExternalSourcePath(PATH), s.sourceDocumentId, true, 1, 'Installateur.ifc', undefined, undefined]]);
  eq('5b het plan verandert niet zonder klik', [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, applied(S) - steps, s.disk.reads - reads],
    ['2027-03-05T16:00', 'v1', 0, 0]);
  const src = bar[0] ? await S().readExternalSourceUpdate(bar[0]) : null;
  const preview = src ? externalAnchorChanges(S().tasks, refreshExternalAnchors(S().tasks, src, 'file-path').tasks) : [];
  eq('5c Bekijken leest het geopende document', [src?.version, preview.map(c => [c.before.anchorDate, c.link.anchorDate])],
    [undefined, [['2027-03-05T16:00', '2027-03-10T16:00']]]);
  const before = applied(S);
  eq('5d Accepteren: één undo-stap, met herberekening, zonder versie',
    [src ? S().acceptExternalSourceUpdate(src) : false, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion,
      typeof linkOf(S, a).anchorReadAt, applied(S) - before, S().scheduleStale, bars(S).length],
    [true, '2027-03-10T16:00', undefined, 'string', 1, false, 0]);
  await S().checkExternalSources();
  eq('5e daarna geen balk zolang de bron niet verder verandert', bars(S).length, 0);
  S().undo();
  await S().checkExternalSources();
  eq('5f Ctrl+Z ⇒ het oude anker terug, en de balk weer', [linkOf(S, a).anchorDate, bars(S).length], ['2027-03-05T16:00', 1]);
  S().closeDocument(s.sourceDocumentId);
  eq('5g de bron is gesloten ⇒ Bekijken leest niets meer uit het geopende document',
    bars(S)[0] ? await S().readExternalSourceUpdate(bars(S)[0]) : 'geen balk', null);
}
{
  // Gelijke ankers ⇒ geen balk.
  const s = await app('path', true);
  renameSource(s, 'Installatie (nieuw)');
  await s.S().checkExternalSources();
  eq('5h een wijziging zonder ander anker ⇒ geen balk', [sourcePayload(s).isDirty, bars(s.S).length], [true, 0]);
}
{
  // Geen tweede balk voor de opgeslagen versie: de bron is opgeslagen met 8 werkdagen (v2), en daarna in het
  // geopende document terug op 5 werkdagen, zonder op te slaan. Het geopende document geeft dezelfde ankers.
  const s = await app('path', true);
  const { S } = s;
  editSource(s);
  saveSource(s, 'v2');
  editSource(s, 5 / 8);
  await S().checkExternalSources();
  eq('5i vinkje aan, de bron open met wijzigingen ⇒ geen balk voor de opgeslagen versie', bars(S).length, 0);
  S().setProject({ anchorsFromOpenDocuments: undefined });
  await S().checkExternalSources();
  eq('5j vinkje uit ⇒ wel de balk voor de opgeslagen versie', bars(S).map(u => [u.version, u.openDocumentId]), [['v2', undefined]]);
}

// (6) *Later*: dezelfde voorgestelde ankers geven geen nieuwe balk, andere wel.
{
  const s = await app('path', true);
  const { S } = s;
  editSource(s);
  await S().checkExternalSources();
  const first = bars(S)[0]?.version;
  S().dismissExternalSourceUpdate(bars(S)[0]?.key ?? '');
  await S().checkExternalSources();
  eq('6a Later ⇒ geen balk bij hetzelfde voorstel', [first?.startsWith('open:'), bars(S).length], [true, 0]);
  renameSource(s, 'Installatie (nieuw)');
  await S().checkExternalSources();
  eq('6b een wijziging in de bron met dezelfde ankers ⇒ nog steeds geen balk', bars(S).length, 0);
  editSource(s, 10 / 8);
  await S().checkExternalSources();
  eq('6c andere ankers ⇒ wel weer een balk', bars(S).map(u => [u.openDocumentId !== undefined, u.version !== first]), [[true, true]]);
}

{
  // P1 (review na de ombouw): *Later* op een gewone balk (opgeslagen versie v2) geldt ook voor het voorstel. Een
  // wijziging in de bron met dezelfde ankers, nog niet opgeslagen, geeft geen balk uit het geopende document.
  const s = await app('path', true);
  const { S } = s;
  editSource(s);
  saveSource(s, 'v2');
  await S().checkExternalSources();
  const bar = bars(S).map(u => [u.version, u.openDocumentId]);
  S().dismissExternalSourceUpdate(bars(S)[0]?.key ?? '');
  renameSource(s, 'Installatie (nieuw)');
  await S().checkExternalSources();
  eq('6d Later op de gewone balk ⇒ geen balk uit het geopende document met dezelfde ankers', [bar, bars(S).length], [[['v2', undefined]], 0]);
}
{
  // P2: *Later* op een balk uit het geopende document; de bron wordt daarna opgeslagen (v2) en wijkt nog af ⇒ de
  // gewone balk komt terug (de regel van stap 1.5: een nieuwe opgeslagen versie).
  const s = await app('path', true);
  const { S } = s;
  editSource(s);
  await S().checkExternalSources();
  S().dismissExternalSourceUpdate(bars(S)[0]?.key ?? '');
  saveSource(s, 'v2');
  await S().checkExternalSources();
  eq('6e Later, daarna opgeslagen en nog afwijkend ⇒ de balk bij die versie', bars(S).map(u => [u.version, u.openDocumentId]), [['v2', undefined]]);
}

// (8) Opslaan na een anker uit het geopende document (besluit Ethan 2026-11-10): geen balk als alleen de versie
// verandert; de koppeling houdt "versie onbekend" tot een opgeslagen datumwijziging, en dan zet Accepteren de versie.
{
  const s = await app('path', true);
  const { S, a } = s;
  editSource(s);
  await S().refreshAllExternalAnchors();
  saveSource(s, 'v3');
  await S().checkExternalSources();
  eq('8a opgeslagen met dezelfde ankers ⇒ geen balk; de koppeling houdt "versie onbekend"',
    [sourcePayload(s).isDirty, bars(S).length, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], [false, 0, '2027-03-10T16:00', undefined]);
  await S().checkExternalSources();
  eq('8b ook een volgende controle niet', [bars(S).length, linkOf(S, a).sourceVersion], [0, undefined]);
  editSource(s, 10 / 8);
  saveSource(s, 'v4');
  await S().checkExternalSources();
  const bar = bars(S);
  eq('8c een latere opgeslagen datumwijziging ⇒ de gewone balk', bar.map(u => [u.version, u.openDocumentId, u.changedLinks]), [['v4', undefined, 1]]);
  const src = bar[0] ? await S().readExternalSourceUpdate(bar[0]) : null;
  eq('8d Accepteren legt de versie vast', [src ? S().acceptExternalSourceUpdate(src) : false, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion],
    [true, '2027-03-12T16:00', 'v4']);
}
{
  // P5: na een anker uit het geopende document en opslaan zonder andere datum legt zelf vernieuwen uit het opgeslagen
  // bestand de versie vast (één undo-stap).
  const s = await app('path', true);
  const { S, a } = s;
  editSource(s);
  await S().refreshAllExternalAnchors();
  saveSource(s, 'v3');
  const steps = applied(S);
  await S().refreshAllExternalAnchors();
  eq('8e zelf vernieuwen uit het opgeslagen bestand legt de versie vast',
    [linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, applied(S) - steps], ['2027-03-10T16:00', 'v3', 1]);
}

// (9) *Bronbestanden kiezen…* (browser, een bron zonder pad, geen onthouden handvat).
for (const on of [false, true]) {
  const s = await app('project', on);
  const { S, a } = s;
  editSource(s);
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const hadWindow = 'window' in g;
  const before = g.window;
  g.window = {
    ...(before ?? {}),
    showOpenFilePicker: async () => [{
      kind: 'file', name: 'Installateur.ifc',
      getFile: async () => new File([s.disk.text], 'Installateur.ifc', { lastModified: Date.parse('2027-01-02T00:00:00.000Z') }),
    }],
  };
  try {
    const result = await S().refreshExternalAnchorsFromChosenFiles();
    eq(on ? '9b vinkje aan: het anker uit het geopende document, zonder melding' : '9a vinkje uit: het anker uit het gekozen bestand, met de melding',
      [result?.sources, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion, unsavedNotices(S).length],
      on ? [1, '2027-03-10T16:00', undefined, 0] : [1, '2027-03-05T16:00', '2027-01-02T00:00:00.000Z', 1]);
  } finally {
    if (hadWindow) g.window = before; else delete g.window;
  }
}

// (11) Het vinkje in *Projectinstellingen*: Toepassen is één undo-stap; het IFC-bestand schrijft het veld alleen
// als het aan staat, en leest het terug.
{
  const s = await app();
  const { S } = s;
  const form = { ...S().project, anchorsFromOpenDocuments: false };
  eq('11a ongewijzigd (afwezig ≡ uit) ⇒ lege patch', projectInfoPatch(S().project, form), {});
  eq('11b aan ⇒ alleen het vinkje', projectInfoPatch(S().project, { ...form, anchorsFromOpenDocuments: true }), { anchorsFromOpenDocuments: true });
  eq('11c zonder het veld in het formulier (de wizard) ⇒ niets', projectInfoPatch(S().project, { ...S().project, anchorsFromOpenDocuments: undefined }), {});
  const off = writeIFC(buildWriteIFCInput(S()));
  const steps = applied(S);
  S().applyProjectInfo(projectInfoPatch(S().project, { ...form, anchorsFromOpenDocuments: true }), undefined);
  const on = writeIFC(buildWriteIFCInput(S()));
  eq('11d Toepassen: één undo-stap, het document gewijzigd', [S().project.anchorsFromOpenDocuments, applied(S) - steps, S().isDirty], [true, 1, true]);
  eq('11e het IFC-bestand: alleen wanneer aan, en het leest terug',
    [off.includes('AnchorsFromOpenDocuments'), on.includes(`'AnchorsFromOpenDocuments',$,IFCBOOLEAN(.T.)`),
      readIFC(on).project.anchorsFromOpenDocuments, readIFC(off).project.anchorsFromOpenDocuments],
    [false, true, true, undefined]);
  const offPatch = projectInfoPatch(S().project, { ...S().project, anchorsFromOpenDocuments: false });
  eq('11f uit ⇒ het veld wordt leeg', ['anchorsFromOpenDocuments' in offPatch, offPatch.anchorsFromOpenDocuments], [true, undefined]);
  S().undo();
  eq('11g Ctrl+Z ⇒ het vinkje weer uit', S().project.anchorsFromOpenDocuments, undefined);
}

// (14)–(17) De teller per document en bron (review #860 ronde 3).
/** Laat de eerste lezing via `read` wachten tot `release()`; `hasStarted` belooft dat ze begonnen is. */
const gateFirstRead = <F extends (...args: never[]) => Promise<unknown>>(read: F) => {
  let first = true;
  let release!: () => void;
  let started!: () => void;
  const hasStarted = new Promise<void>(r => { started = r; });
  const gate = new Promise<void>(r => { release = r; });
  const wrapped = (async (...args: Parameters<F>) => {
    const out = await read(...args);
    if (first) { first = false; started(); await gate; }
    return out;
  }) as unknown as F;
  return { wrapped, hasStarted, release: () => release() };
};
// (14) Een controle leest de opgeslagen versie v2 (8 werkdagen) en wacht. Intussen wijzigt de planner de bron
// zonder op te slaan, en vernieuwt met het vinkje aan uit het geopende document. Daarna komt de oude controle terug:
// geen balk voor v2, en het anker blijft (zonder de teller zette *Accepteren* het terug naar 10 maart).
{
  const s = await app('path', true);
  const { S, store, a } = s;
  editSource(s);
  saveSource(s, 'v2');
  const gated = gateFirstRead(S().parseExternalSource);
  store.setState({ parseExternalSource: gated.wrapped });
  const checking = S().checkExternalSources();
  await gated.hasStarted;
  editSource(s);
  await S().refreshAllExternalAnchors();
  const anchor = linkOf(S, a).anchorDate;
  gated.release();
  await checking;
  eq('14a de oude controle (v2) publiceert geen balk; het anker uit het geopende document blijft',
    [anchor > '2027-03-10T16:00', linkOf(S, a).sourceVersion, bars(S).map(u => u.version), linkOf(S, a).anchorDate === anchor],
    [true, undefined, [], true]);
}
// (15) Hetzelfde op de site.
{
  const s = await app('project', true);
  const { S, store, a } = s;
  S().switchDocument(s.sourceDocumentId);
  store.setState({ siteFileId: 'site-bron', siteFileVersion: 'v1' });
  S().switchDocument(s.targetDocumentId);
  const task = S().tasks.find(t => t.id === a)!;
  S().updateTask(a, { externalLinks: task.externalLinks!.map(l => ({ ...l, sourceRef: { ...l.sourceRef, siteFileId: 'site-bron' } })) });
  const diskRead = S().parseExternalSource;
  const siteRead = async (id: string) => {
    const read = await diskRead(PATH);
    const { filePath: _path, ...rest } = read!;
    void _path;
    return { ...rest, siteFileId: id };
  };
  const gated = gateFirstRead(siteRead);
  store.setState({ parseExternalSiteSource: gated.wrapped, externalSiteSourceVersion: async () => ({ version: s.disk.version }) });
  editSource(s);
  saveSource(s, 'v2');
  const checking = S().checkExternalSources();
  await gated.hasStarted;
  editSource(s);
  await S().refreshAllExternalAnchors();
  const anchor = linkOf(S, a).anchorDate;
  gated.release();
  await checking;
  eq('15a op de site: de oude controle (v2) publiceert geen balk; het anker blijft',
    [anchor > '2027-03-10T16:00', bars(S).map(u => u.version), linkOf(S, a).anchorDate === anchor], [true, [], true]);
}
// (16) Een controle die loopt tijdens *Later* of *Accepteren* (vinkje uit). De bron is opgeslagen met de wijziging
// (v2) ⇒ een balk. Daarna slaat ze dezelfde inhoud nog eens op (v3); een controle leest v3 en wacht.
const savedSource = async () => {
  const s = await app();
  editSource(s);
  saveSource(s, 'v2');
  await s.S().checkExternalSources();
  return s;
};
{
  // *Later* op v2 tijdens de controle: v2 komt niet terug, v3 is een nieuwe versie en krijgt de balk.
  const s = await savedSource();
  const { S, store, a } = s;
  eq('16a voorwaarde: een balk voor v2', bars(S).map(u => u.version), ['v2']);
  s.disk.version = 'v3';
  const gated = gateFirstRead(S().parseExternalSource);
  store.setState({ parseExternalSource: gated.wrapped });
  const checking = S().checkExternalSources();
  await gated.hasStarted;
  S().dismissExternalSourceUpdate(bars(S)[0]?.key ?? '');
  gated.release();
  await checking;
  eq('16b Later tijdens de controle: alleen de nieuwe versie v3, het anker onveranderd',
    [bars(S).map(u => u.version), linkOf(S, a).anchorDate], [['v3'], '2027-03-05T16:00']);
}
{
  // *Accepteren* van v2 tijdens de controle: daarna geen balk, want v3 verandert niets aan het anker.
  const s = await savedSource();
  const { S, store, a } = s;
  const v2 = bars(S)[0] ? await S().readExternalSourceUpdate(bars(S)[0]) : null;
  s.disk.version = 'v3';
  const gated = gateFirstRead(S().parseExternalSource);
  store.setState({ parseExternalSource: gated.wrapped });
  const checking = S().checkExternalSources();
  await gated.hasStarted;
  eq('16c Accepteren tijdens de controle lukt', [v2 ? S().acceptExternalSourceUpdate({ ...v2, version: 'v2' }) : false, bars(S).length], [true, 0]);
  gated.release();
  await checking;
  eq('16d na de controle geen balk; het anker blijft op v2',
    [bars(S).length, linkOf(S, a).anchorDate, linkOf(S, a).sourceVersion], [0, '2027-03-10T16:00', 'v2']);
}
// (17) Vinkje aan: *Later* terwijl een controle het geopende document leest ⇒ daarna geen balk.
{
  const s = await app('path', true);
  const { S } = s;
  editSource(s);
  await S().checkExternalSources();
  const key = bars(S)[0]?.key ?? '';
  const checking = S().checkExternalSources();
  S().dismissExternalSourceUpdate(key);
  await checking;
  eq('17a Later tijdens de controle ⇒ geen balk', [key !== '', bars(S).length], [true, 0]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX ${f}`);
  console.log(`XX check-external-open-source: ${failures.length} van ${checks} controles faalden`);
  process.exit(1);
}
console.log(`OK check-external-open-source: ${checks} controles (geopend brondocument, stap 1.7)`);
