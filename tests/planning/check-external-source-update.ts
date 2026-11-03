// Stap 1.5 (keuze 1 en het vangnet van keuze 6, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md`):
// een nieuwe versie van een bron geeft een balk, *Bekijken* toont de gevolgen, *Accepteren* zet ze als één
// undo-stap, *Later* laat het plan staan. De app neemt niets vanzelf over.
//
// Wat deze check vastlegt:
// 1. `externalAnchorChanges` telt alleen een ander anker of een andere status *brontaak ontbreekt*; een
//    nieuwe herkomst alleen telt niet.
// 2. `previewExternalRefresh` rekent het voorstel op een kopie: de taken die verschuiven, het einde en de duur.
//    Het plan zelf verandert niet.
// 3. De store-route: dezelfde versie ⇒ niets lezen; een nieuwe versie zonder wijziging ⇒ één keer lezen en
//    geen balk; een nieuwe versie met wijziging ⇒ een balk met versie, auteur en aantal; *Later* ⇒ weg tot
//    de volgende versie; *Accepteren* ⇒ één undo-stap, de balk weg, het venster dicht; *Alle externe
//    relaties vernieuwen* haalt de balk ook weg. Een kopie met hetzelfde project-id op een ander pad telt
//    niet mee. Een bron die niet te lezen is, of een relatief pad, geeft geen balk.
// 4. Review #811: het venster vergelijkt het voorstel met wat de planner nu ziet (de getoonde datums en het
//    projecteinde van de statusbalk), ook als het plan verouderd is. Accepteren geeft precies het voorstel.
// 5. Hetzelfde in de weergave *Datums zoals opgeslagen*: de beginstand zijn de datums uit het bestand.
import { createAppStoreContext } from '@/state/appStore';
import { externalAnchorChanges, previewExternalRefresh } from '@/engine/externalRefreshPreview';
import { refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { ExternalSourceRead } from '@/state/externalSource';
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
const COPY = '/archief/Installateur-kopie.ifc';
const sourceTask = (finish: string): Task => ({
  id: 'b1', name: 'Installatie', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2027-03-01', 5, 'days'), earlyStart: '2027-03-01T07:00', earlyFinish: finish },
});
const link = (id: string, filePath: string, anchorDate: string, sourceVersion?: string): ExternalLink => ({
  id, direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate, sourceMissing: false,
  sourceRef: { projectId: 'installateur', projectName: 'Installateur', taskId: 'b1', taskName: 'Installatie', filePath },
  ...(sourceVersion ? { sourceVersion } : {}),
});

// (1) Wat telt als wijziging.
{
  const a = sourceTask('2027-03-05T16:00');
  const own: Task = { ...sourceTask('2027-03-05T16:00'), id: 'A', externalLinks: [link('x', PATH, '2027-03-05T16:00', 'v1')] };
  const same = refreshExternalAnchors([own], { projectId: 'installateur', filePath: PATH, tasks: [a], version: 'v2', readAt: 'r' });
  eq('1a alleen een nieuwe herkomst ⇒ wel gewijzigd voor verversen', same.changed, true);
  eq('1b … maar geen wijziging voor de balk', externalAnchorChanges([own], same.tasks), []);
  const moved = refreshExternalAnchors([own], { projectId: 'installateur', filePath: PATH, tasks: [sourceTask('2027-03-10T16:00')] });
  eq('1c een ander anker telt', externalAnchorChanges([own], moved.tasks).map(c => [c.taskId, c.linkId, c.before.anchorDate, c.link.anchorDate]),
    [['A', 'x', '2027-03-05T16:00', '2027-03-10T16:00']]);
  const gone = refreshExternalAnchors([own], { projectId: 'installateur', filePath: PATH, tasks: [] });
  eq('1d een brontaak die ontbreekt telt', externalAnchorChanges([own], gone.tasks).map(c => [c.before.sourceMissing, c.link.sourceMissing]),
    [[false, true]]);
}

// Het eigen plan: A (5 dagen) wacht FS op Installatie; B (3 dagen) volgt A. Een losse taak Z houdt de
// projectstart op maandag 1 maart.
const plan = () => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
  const z = S().addTask({ name: 'Z', time: createDefaultTaskTime('2027-03-01', 1, 'days') });
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2027-03-01', 3, 'days') });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().updateTask(a, { externalLinks: [link('x', PATH, '2027-03-05T16:00', 'v1')] });
  S().runCPM();
  return { store, S, z, a, b };
};

// (2) De gevolgen, op een kopie.
{
  const { S, a, b } = plan();
  const before = S().tasks;
  const refreshed = refreshExternalAnchors(S().tasks, { projectId: 'installateur', filePath: PATH, tasks: [sourceTask('2027-03-10T16:00')] }, 'file-path');
  const preview = previewExternalRefresh(S(), refreshed.tasks);
  eq('2a één koppeling verandert', preview.changes.length, 1);
  eq('2b A en B verschuiven', [...preview.shiftedTaskIds].sort(), [a, b].sort());
  eq('2c het einde gaat van 17 naar 22 maart', [preview.endBefore, preview.endAfter], ['2027-03-17T16:00', '2027-03-22T16:00']);
  eq('2d drie werkdagen later', preview.durationAfter - preview.durationBefore, 3);
  eq('2e geen fout', preview.failed, undefined);
  eq('2f het plan zelf is niet veranderd', S().tasks === before, true);
}

// (3) De store-route met een nep-bron per pad.
{
  const { store, S, a, b } = plan();
  // C wijst naar een kopie van dezelfde bron (zelfde project-id) op een ander pad.
  const c = S().addTask({ name: 'C', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
  S().updateTask(c, { externalLinks: [link('y', COPY, '2027-03-05T16:00', 'v1')] });
  // D heeft een relatief bronpad: dat kan de app nooit lezen.
  const d = S().addTask({ name: 'D', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
  S().updateTask(d, { externalLinks: [link('z', 'relatief/Installateur.ifc', '2027-03-05T16:00', 'v1')] });
  S().runCPM();
  void b;

  const versions = new Map<string, string | undefined>([[PATH, 'v1'], [COPY, 'v1']]);
  const finishes = new Map<string, string>([[PATH, '2027-03-05T16:00'], [COPY, '2027-03-05T16:00']]);
  const reads: string[] = [];
  const read = async (filePath: string): Promise<ExternalSourceRead | null> => {
    reads.push(filePath);
    const version = versions.get(filePath);
    return {
      projectId: 'installateur', projectName: 'Installateur', filePath, author: 'Anna de Vries',
      tasks: [sourceTask(finishes.get(filePath)!)], ...(version ? { version } : {}), readAt: '2026-11-03T10:00:00.000Z',
    };
  };
  store.setState({
    externalSourceVersion: async (filePath: string) => versions.get(filePath),
    parseExternalSource: read,
  });
  const updates = () => S().ui.externalSourceUpdates.map(u => ({ ...u, documentId: u.documentId === S().activeDocumentId ? 'actief' : u.documentId }));
  const anchorOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];
  const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;

  await S().checkExternalSources();
  eq('3a dezelfde versie ⇒ niets gelezen, geen balk', [reads.length, updates()], [0, []]);

  versions.set(PATH, 'v2');
  await S().checkExternalSources();
  eq('3b nieuwe versie zonder wijziging ⇒ één keer gelezen, geen balk', [reads, updates()], [[PATH], []]);
  await S().checkExternalSources();
  eq('3c die versie leest de app niet opnieuw', reads.length, 1);

  versions.set(PATH, 'v3');
  finishes.set(PATH, '2027-03-10T16:00');
  const dirtyBefore = S().isDirty;
  await S().checkExternalSources();
  eq('3d nieuwe versie met wijziging ⇒ een balk', updates(), [{
    documentId: 'actief', path: PATH, filePath: PATH, fileName: 'Installateur.ifc', version: 'v3',
    author: 'Anna de Vries', changedLinks: 1,
  }]);
  eq('3e de kopie op een ander pad telt niet mee, het relatieve pad wordt niet gelezen', reads, [PATH, PATH]);
  eq('3f de controle verandert het plan niet', [anchorOf(a).anchorDate, S().isDirty], ['2027-03-05T16:00', dirtyBefore]);
  await S().checkExternalSources();
  eq('3g dezelfde balk ⇒ niet opnieuw gelezen', reads.length, 2);

  S().dismissExternalSourceUpdate(PATH);
  eq('3h Later ⇒ de balk is weg', updates(), []);
  await S().checkExternalSources();
  eq('3i … en komt niet terug bij dezelfde versie', [reads.length, updates()], [2, []]);

  versions.set(PATH, 'v4');
  await S().checkExternalSources();
  eq('3j een volgende versie ⇒ weer een balk', updates().map(u => [u.version, u.changedLinks]), [['v4', 1]]);

  // Accepteren, zoals het venster dat doet: de bron opnieuw lezen en doorgeven.
  S().setUI({ externalSourceReview: PATH });
  const source = (await read(PATH))!;
  const steps = applied();
  eq('3k Accepteren verandert het plan', S().acceptExternalSourceUpdate(source), true);
  eq('3l het nieuwe anker, met de versie', [anchorOf(a).anchorDate, anchorOf(a).sourceVersion], ['2027-03-10T16:00', 'v4']);
  eq('3m één undo-stap', applied(), steps + 1);
  eq('3n herberekend: A begint donderdag 11 maart', S().tasks.find(t => t.id === a)!.time.earlyStart, '2027-03-11T07:00');
  eq('3o de balk is weg en het venster dicht', [updates(), S().ui.externalSourceReview], [[], null]);
  eq('3p de kopie is niet ververst', anchorOf(c).anchorDate, '2027-03-05T16:00');
  const readsAfterAccept = reads.length;
  await S().checkExternalSources();
  eq('3q na accepteren klopt de versie ⇒ niets gelezen', [reads.length, updates()], [readsAfterAccept, []]);

  S().undo();
  eq('3r undo zet het oude anker terug', anchorOf(a).anchorDate, '2027-03-05T16:00');
  await S().checkExternalSources();
  eq('3s na undo komt de balk terug bij de volgende controle', updates().map(u => u.version), ['v4']);
  await S().refreshAllExternalAnchors();
  eq('3t Alle externe relaties vernieuwen haalt de balk weg', updates(), []);

  // Een bron die niet te lezen is (geen versie): geen balk, geen lezen.
  versions.set(PATH, undefined);
  S().undo();
  const readsBefore = reads.length;
  await S().checkExternalSources();
  eq('3u een bron zonder versie ⇒ niets gelezen, geen balk', [reads.length, updates()], [readsBefore, []]);
}

// De bron met de verschoven brontaak (anker 10 maart), en de getoonde datums van elke taak.
const movedSource: ExternalSourceDoc = { projectId: 'installateur', filePath: PATH, tasks: [sourceTask('2027-03-10T16:00')] };
type StoreGet = ReturnType<typeof plan>['S'];
const shown = (S: StoreGet) => new Map(S().tasks.map(t => [t.id, `${shownStart(t)} – ${shownFinish(t)}`] as const));
/** Het voorstel van het venster tegen wat Accepteren echt doet. */
const proposalAndAccept = (tag: string, S: StoreGet) => {
  const preview = previewExternalRefresh(S(), refreshExternalAnchors(S().tasks, movedSource, 'file-path').tasks);
  const seen = { end: S().cpmResult?.projectEnd, duration: S().cpmResult?.projectDuration, dates: shown(S) };
  eq(`${tag} het voorstel begint bij het einde dat de planner nu ziet`, preview.endBefore, seen.end);
  eq(`${tag} … en bij de duur die de planner nu ziet`, preview.durationBefore, seen.duration);
  eq(`${tag} Accepteren verandert het plan`, S().acceptExternalSourceUpdate(movedSource), true);
  eq(`${tag} na Accepteren: het einde van het voorstel`, [S().cpmResult?.projectEnd, S().cpmResult?.projectDuration],
    [preview.endAfter, preview.durationAfter]);
  const after = shown(S);
  const moved = [...after].filter(([id, dates]) => seen.dates.get(id) !== dates).map(([id]) => id).sort();
  eq(`${tag} na Accepteren: precies de taken uit het voorstel verschoven`, moved, [...preview.shiftedTaskIds].sort());
  return { preview, seen };
};

// (4) Review #811, het scenario letterlijk: B duurt 10 dagen in plaats van 3, zonder F5. Het plan houdt
// projecteinde 17 maart. Het bronanker schuift naar 10 maart; na Accepteren eindigt het plan op 2 april. Het
// venster zei "30 maart → 2 april" (twee nieuwe berekeningen); het moet "17 maart → 2 april" zeggen.
{
  const { S, z, a, b } = plan();
  const timeB = S().tasks.find(t => t.id === b)!.time;
  S().updateTask(b, { time: { ...timeB, scheduleDuration: 10 } });
  eq('4 opzet: het plan is verouderd en toont nog einde 17 maart', [S().scheduleStale, S().cpmResult?.projectEnd],
    [true, '2027-03-17T16:00']);
  const { preview } = proposalAndAccept('4', S);
  eq('4 het venster: van 17 maart naar 2 april', [preview.endBefore, preview.endAfter], ['2027-03-17T16:00', '2027-04-02T16:00']);
  eq('4 het venster: tien werkdagen later (Goede Vrijdag en tweede paasdag zijn vrij)', preview.durationAfter - preview.durationBefore, 10);
  eq('4 het venster: A en B verschuiven, Z niet', [...preview.shiftedTaskIds].sort(), [a, b].sort());
  void z;
}

// (5) De weergave *Datums zoals opgeslagen*: het bestand legt voor B 17 t/m 19 maart vast; de app zou 15 t/m
// 17 maart rekenen. De planner ziet einde 19 maart. Het voorstel begint daar, niet bij een nieuwe berekening.
{
  const { S } = plan();
  const parsed = readIFC(writeIFC(buildWriteIFCInput(S())));
  const times = captureRecordedDates(parsed.tasks, parsed.recordedFields).times;
  const idB = parsed.tasks.find(t => t.name === 'B')!.id;
  times[idB] = { ...times[idB], start: '2027-03-17T07:00', finish: '2027-03-19T16:00' };
  S().newProject();
  S().applyLoadedProject(
    { ...parsed, recordedFields: undefined, recordedTimes: times, recordedTimesOrigin: 'xer' },
    { filePath: null, recompute: true },
  );
  const idOf = (name: string) => S().tasks.find(t => t.name === name)!.id;
  eq('5 opzet: de weergave staat aan en toont einde 19 maart', [S().datesAsRecorded, S().cpmResult?.projectEnd],
    [true, '2027-03-19T16:00']);
  const { preview } = proposalAndAccept('5', S);
  eq('5 het venster: van 19 maart naar 22 maart', [preview.endBefore, preview.endAfter], ['2027-03-19T16:00', '2027-03-22T16:00']);
  eq('5 het venster: één werkdag later', preview.durationAfter - preview.durationBefore, 1);
  eq('5 het venster: A en B verschuiven, Z niet', [...preview.shiftedTaskIds].sort(), [idOf('A'), idOf('B')].sort());
  eq('5 Accepteren verlaat de weergave', S().datesAsRecorded, false);
}

if (failures.length) {
  console.error(`XX external-source-update: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-source-update: ${checks} checks`);
