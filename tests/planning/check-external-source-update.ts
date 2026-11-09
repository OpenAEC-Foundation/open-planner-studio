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
// 6. Stap 1.8 (bronbestand kiezen in de browser): een koppeling zonder pad herkent haar bron op project-id.
//    De sleutel in de balk is `project:<id>` (een bron met pad houdt het genormaliseerde pad). De balk en
//    *Accepteren* raken alleen koppelingen zonder pad; *Alle externe relaties vernieuwen* leest zo'n bron met
//    toestemmingsvraag, telt een bron die niet gelezen is, en een niet-gelezen bron houdt haar anker en pad.
//    `readExternalSourceFile` geeft een bron zonder pad, met `lastModified` als versie.
// 8. Review #858: Chromium eist bij elke `requestPermission` een recente klik. Twee bronnen met toestemming
//    `prompt`: beide vragen starten meteen na de klik, niet na het antwoord op de eerste vraag.
// 9. Review #858: na *Bronbestanden kiezen…* met een deel van de bestanden blijven de andere bronnen open.
// 10. Review #858: een geblokkeerde IndexedDB laat vernieuwen niet hangen; een later geopende verbinding sluit.
// 11. Stap 1.9 (een bron op de site): een koppeling met `siteFileId` leest haar bron via de site. De sleutel is
//    `site:<id>`. Een bron op de site raakt alleen koppelingen met datzelfde site-id, nooit een koppeling met
//    een pad of een ander site-id, ook niet bij hetzelfde project-id; andersom raakt geen andere bron een
//    koppeling met een site-id. De balk vergelijkt de nieuwste versie uit `versions(id)` met `sourceVersion`
//    en noemt het label en wie opsloeg. Vernieuwen leest `open(id)`; niet gelezen ⇒ het anker blijft, geteld.
// 12. `readExternalSiteSource` geeft een bron zonder pad, met het site-id en de versie op de site.
import { createAppStoreContext } from '@/state/appStore';
import { externalAnchorChanges, previewExternalRefresh } from '@/engine/externalRefreshPreview';
import {
  externalSourceKey, externalSourceKeyOfDoc, externalSourceLocatorOf, externalSourceScope, externalSourceScopeOf,
  linkMatchesSource, refreshExternalAnchors, refreshFromSources, type ExternalSourceDoc,
} from '@/engine/externalLinks';
import { readExternalSiteSource, readExternalSourceFile } from '@/state/externalSource';
import type { SiteVersionInfo } from '@/services/fileAccess/siteHost';
import { remainingUnreadSources } from '@/engine/externalLinks';
import { idbGetAll } from '@/utils/idb';
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
const link = (id: string, filePath: string | undefined, anchorDate: string, sourceVersion?: string): ExternalLink => ({
  id, direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate, sourceMissing: false,
  sourceRef: {
    projectId: 'installateur', projectName: 'Installateur', taskId: 'b1', taskName: 'Installatie',
    ...(filePath !== undefined ? { filePath } : {}),
  },
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
  eq('3d nieuwe versie met wijziging ⇒ een balk; de sleutel van een bron met pad is het pad', updates(), [{
    documentId: 'actief', key: PATH, locator: { kind: 'path', filePath: PATH }, fileName: 'Installateur.ifc', version: 'v3',
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

// (6) Stap 1.8: een bron zonder pad (gekozen in de browser), herkend op project-id.
{
  // 6a–6e: de pure regels.
  eq('6a sleutel met pad = het genormaliseerde pad', externalSourceKey({ kind: 'path', filePath: PATH }), PATH);
  eq('6b sleutel zonder pad = project:<id>', externalSourceKey({ kind: 'project', projectId: 'installateur' }), 'project:installateur');
  eq('6c plek: pad, project-id, of niets bij een relatief pad of zonder project-id', [
    externalSourceLocatorOf({ projectId: 'installateur', filePath: PATH }),
    externalSourceLocatorOf({ projectId: ' installateur ' }),
    externalSourceLocatorOf({ projectId: 'installateur', filePath: 'relatief/Installateur.ifc' }),
    externalSourceLocatorOf({ projectId: '' }),
  ], [{ kind: 'path', filePath: PATH }, { kind: 'project', projectId: 'installateur' }, null, null]);
  eq('6d sleutel van een gelezen bron', [externalSourceKeyOfDoc({ projectId: 'installateur', filePath: PATH }),
    externalSourceKeyOfDoc({ projectId: 'installateur' })], [PATH, 'project:installateur']);
  const noPathSource: ExternalSourceDoc = { projectId: 'installateur', tasks: [] };
  eq('6e een bron zonder pad raakt alleen koppelingen zonder pad met hetzelfde project-id', [
    externalSourceScope(noPathSource),
    linkMatchesSource(link('p', PATH, 'x'), noPathSource, 'project-without-path'),
    linkMatchesSource(link('n', undefined, 'x'), noPathSource, 'project-without-path'),
    linkMatchesSource({ ...link('o', undefined, 'x'), sourceRef: { ...link('o', undefined, 'x').sourceRef, projectId: 'ander' } }, noPathSource, 'project-without-path'),
  ], ['project-without-path', false, true, false]);

  // De store-route. A wijst zonder pad naar de bron (browser); C met pad naar hetzelfde project (desktop).
  const { store, S, a } = plan();
  S().updateTask(a, { externalLinks: [link('x', undefined, '2027-03-05T16:00', 'v1')] });
  const c = S().addTask({ name: 'C', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
  S().updateTask(c, { externalLinks: [link('y', PATH, '2027-03-05T16:00', 'v1')] });
  S().runCPM();
  let handleVersion: string | undefined = 'v1';
  let handleFinish = '2027-03-05T16:00';
  let handleGranted = true;
  const prompts: boolean[] = [];
  const pathReads: string[] = [];
  const handleSource = (): ExternalSourceRead => ({
    projectId: 'installateur', projectName: 'Installateur', fileName: 'Installateur.ifc',
    tasks: [sourceTask(handleFinish)], ...(handleVersion ? { version: handleVersion } : {}), readAt: '2026-11-09T10:00:00.000Z',
  });
  store.setState({
    // De desktopbron (pad) is in deze test niet te lezen, zoals in de browser.
    externalSourceVersion: async () => undefined,
    parseExternalSource: async (filePath: string) => { pathReads.push(filePath); return null; },
    externalProjectSourceVersion: async (projectId: string) => (projectId === 'installateur' && handleGranted ? handleVersion : undefined),
    // Vernieuwen leest alle bronnen zonder pad in één keer, met toestemmingsvraag (§8 toetst de echte route).
    readExternalProjectSources: async (projectIds: readonly string[]) => {
      prompts.push(true);
      return new Map(projectIds.map(id => [id, id === 'installateur' ? handleSource() : null] as const));
    },
    parseExternalProjectSource: async (projectId: string, opts: { prompt: boolean }) => {
      prompts.push(opts.prompt);
      return projectId === 'installateur' && (handleGranted || opts.prompt) ? handleSource() : null;
    },
  });
  const updates = () => S().ui.externalSourceUpdates.map(u => ({ key: u.key, locator: u.locator, fileName: u.fileName, version: u.version, changedLinks: u.changedLinks }));
  const anchorOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];

  await S().checkExternalSources();
  eq('6f dezelfde versie ⇒ niets gelezen, geen balk', [prompts, updates()], [[], []]);
  handleVersion = 'v2';
  handleFinish = '2027-03-10T16:00';
  await S().checkExternalSources();
  eq('6g nieuwe versie ⇒ gelezen zonder toestemmingsvraag, een balk met sleutel project:installateur', [prompts, updates()], [[false], [{
    key: 'project:installateur', locator: { kind: 'project', projectId: 'installateur' }, fileName: 'Installateur.ifc',
    version: 'v2', changedLinks: 1,
  }]]);
  eq('6h de koppeling met pad telt niet mee en is niet via het pad gelezen', pathReads, []);
  S().dismissExternalSourceUpdate('project:installateur');
  eq('6i Later op de sleutel ⇒ de balk weg', updates(), []);
  handleVersion = 'v3';
  await S().checkExternalSources();
  eq('6j een volgende versie ⇒ weer een balk', updates().map(u => u.version), ['v3']);
  S().setUI({ externalSourceReview: 'project:installateur' });
  eq('6k Accepteren met een bron zonder pad verandert het plan', S().acceptExternalSourceUpdate(handleSource()), true);
  eq('6l alleen de koppeling zonder pad krijgt het nieuwe anker; ze blijft zonder pad', [
    anchorOf(a).anchorDate, anchorOf(a).sourceVersion, anchorOf(a).sourceRef.filePath, anchorOf(c).anchorDate, anchorOf(c).sourceRef.filePath,
  ], ['2027-03-10T16:00', 'v3', undefined, '2027-03-05T16:00', PATH]);
  eq('6m de balk is weg en het venster dicht', [updates(), S().ui.externalSourceReview], [[], null]);

  // Toestemming `prompt` op de achtergrond: geen balk, geen vraag.
  S().undo();
  handleGranted = false;
  prompts.length = 0;
  handleVersion = 'v4';
  await S().checkExternalSources();
  eq('6n zonder toestemming ⇒ het vangnet leest niets en vraagt niets', [prompts, updates()], [[], []]);

  // Alle externe relaties vernieuwen: de klik mag om toestemming vragen.
  const all = await S().refreshAllExternalAnchors();
  eq('6o vernieuwen leest de bron zonder pad met toestemmingsvraag', prompts, [true]);
  eq('6p de uitslag: één bron gelezen, de bron met pad niet', [all.sources, all.unread, all.unreadProjectIds, all.refreshed], [1, 1, [], 1]);
  eq('6q alleen de koppeling zonder pad ververst; de koppeling met pad houdt anker en pad', [
    anchorOf(a).anchorDate, anchorOf(c).anchorDate, anchorOf(c).sourceRef.filePath,
  ], ['2027-03-10T16:00', '2027-03-05T16:00', PATH]);
  S().undo();
  // Geweigerd: niet gelezen, geteld, en het anker blijft.
  store.setState({ readExternalProjectSources: async (projectIds: readonly string[]) => new Map(projectIds.map(id => [id, null] as const)) });
  const refused = await S().refreshAllExternalAnchors();
  eq('6r geweigerd ⇒ beide bronnen niet gelezen, de bron zonder pad kan opnieuw gekozen worden', [
    refused.sources, refused.unread, refused.unreadProjectIds, refused.refreshed,
  ], [0, 2, ['installateur'], 0]);
  eq('6s een niet gelezen bron houdt haar anker', anchorOf(a).anchorDate, '2027-03-05T16:00');
  // Beide bronnen gelezen, met een ander anker (in de app kan dat niet: de desktop leest geen handvat, de browser
  // geen pad). De bron zonder pad mag de koppeling met pad niet raken: die houdt het anker van haar bestand.
  // (Dat de bron met pad een koppeling zonder pad met hetzelfde project-id overneemt, is het gedrag van de
  // desktop voor een handmatige koppeling; zie de gids.)
  store.setState({
    parseExternalSource: async (filePath: string) => ({
      projectId: 'installateur', projectName: 'Installateur', filePath, tasks: [sourceTask('2027-03-08T16:00')], version: 'pad-v2',
    }),
    readExternalProjectSources: async (projectIds: readonly string[]) => new Map(projectIds.map(id => [id, handleSource()] as const)),
  });
  const both = await S().refreshAllExternalAnchors();
  eq('6t beide bronnen gelezen', [both.sources, both.unread], [2, 0]);
  eq('6u de koppeling met pad houdt het anker en de versie van haar bestand', [
    anchorOf(c).anchorDate, anchorOf(c).sourceVersion, anchorOf(c).sourceRef.filePath,
  ], ['2027-03-08T16:00', 'pad-v2', PATH]);
}

// (7) Een bestand dat de planner in de browser koos: geen pad, de versie is `lastModified`.
{
  const { S } = plan();
  S().setProject({ id: 'proj-bron', name: 'Bron' });
  const text = writeIFC(buildWriteIFCInput(S()));
  const lastModified = Date.UTC(2026, 10, 9, 8, 30);
  const read = await readExternalSourceFile({
    name: 'Bron.ifc', lastModified, text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  });
  eq('7a geen pad, wel de bestandsnaam en het project-id', [read.filePath, read.fileName, read.projectId], [undefined, 'Bron.ifc', 'proj-bron']);
  eq('7b de versie is de wijzigingstijd van het bestand', read.version, '2026-11-09T08:30:00.000Z');
  eq('7c een leestijd', typeof read.readAt, 'string');
  eq('7d de taken zijn gelezen', read.tasks.map(t => t.name).sort(), ['A', 'B', 'Z']);
}

// (8) Twee bronnen zonder pad, elk met toestemming `prompt`. Model van Chromium: een vraag later dan
// ACTIVATION_MS na de klik geeft een `SecurityError`; de planner doet ANSWER_MS over elk antwoord.
{
  const ACTIVATION_MS = 60;
  const ANSWER_MS = 150;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const sourceText = (id: string) => {
    const { S } = plan();
    S().setProject({ id, name: id });
    return writeIFC(buildWriteIFCInput(S()));
  };
  const sourceTaskId = (text: string) => readIFC(text).tasks.find(t => t.name === 'B')!.id;
  let clickAt = 0;
  const requests: Array<[string, number, string]> = [];
  const fakeHandle = (id: string, text: string) => ({
    kind: 'file', name: `${id}.ifc`,
    queryPermission: async () => 'prompt',
    requestPermission: async () => {
      const at = Date.now() - clickAt;
      if (at > ACTIVATION_MS) {
        requests.push([id, at, 'SecurityError']);
        throw new DOMException('Must be handling a user gesture to show a permission request.', 'SecurityError');
      }
      requests.push([id, at, 'gevraagd']);
      await sleep(ANSWER_MS);
      return 'granted';
    },
    getFile: async () => ({
      name: `${id}.ifc`, lastModified: Date.UTC(2026, 10, 9, 9, 0),
      text: async () => text, arrayBuffer: async () => new TextEncoder().encode(text).buffer,
    }),
  });
  const textA = sourceText('bron-a');
  const textB = sourceText('bron-b');
  const { store, S, a, b } = plan();
  const old = '2027-01-04T07:00';
  const ext = (projectId: string, taskId: string): ExternalLink => ({
    id: `x-${projectId}`, direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: old, sourceMissing: false,
    sourceRef: { projectId, projectName: projectId, taskId, taskName: 'B' },
  });
  S().updateTask(a, { externalLinks: [ext('bron-a', sourceTaskId(textA))] });
  S().updateTask(b, { externalLinks: [ext('bron-b', sourceTaskId(textB))] });
  store.setState({
    externalSourceHandles: async () => new Map([
      ['bron-a', fakeHandle('bron-a', textA)], ['bron-b', fakeHandle('bron-b', textB)],
    ] as unknown as Array<[string, FileSystemFileHandle]>),
  });
  clickAt = Date.now();
  const result = await S().refreshAllExternalAnchors();
  eq('8a beide vragen binnen de activatietijd', requests.map(([id, , state]) => [id, state]),
    [['bron-a', 'gevraagd'], ['bron-b', 'gevraagd']]);
  eq('8b beide bronnen gelezen', [result.sources, result.unread, result.unreadProjectIds], [2, 0, []]);
  const anchorOfTask = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];
  eq('8c beide ankers ververst', [anchorOfTask(a).anchorDate !== old, anchorOfTask(b).anchorDate !== old], [true, true]);
}

// (9) A en B niet gelezen; de planner kiest alleen A opnieuw ⇒ B blijft open.
{
  eq('9a alleen A gekozen ⇒ B blijft open', remainingUnreadSources(['bron-a', 'bron-b'], ['bron-a']), ['bron-b']);
  eq('9b een gekozen bestand dat niet openstond, verandert niets', remainingUnreadSources(['bron-b'], ['bron-c']), ['bron-b']);
  eq('9c alles gekozen ⇒ niets open', remainingUnreadSources(['bron-a'], ['bron-a']), []);
}

// (10) Een geblokkeerde openaanvraag: `idbGetAll` geeft meteen een lege lijst; opent de verbinding later toch,
// dan sluit de app haar.
{
  const g = globalThis as unknown as { indexedDB?: unknown };
  const before = g.indexedDB;
  const req: { onblocked?: () => void; onsuccess?: () => void; onupgradeneeded?: () => void; onerror?: () => void; result?: unknown } = {};
  g.indexedDB = { open: () => { setTimeout(() => req.onblocked?.(), 0); return req; } };
  try {
    const outcome = await Promise.race([
      idbGetAll('ops-test-geblokkeerd', 'store'),
      new Promise(resolve => setTimeout(() => resolve('hangt'), 1000)),
    ]);
    eq('10a geblokkeerd ⇒ een lege lijst, geen wachten', outcome, []);
    let closed = false;
    req.result = { close: () => { closed = true; } };
    req.onsuccess?.();
    eq('10b een later geopende verbinding sluit', closed, true);
  } finally {
    g.indexedDB = before;
  }
}

// (11) Stap 1.9: een bron op de site, herkend op het site-id.
{
  const siteLink = (id: string, siteFileId: string, anchorDate: string, sourceVersion?: string): ExternalLink => {
    const base = link(id, undefined, anchorDate, sourceVersion);
    return { ...base, sourceRef: { ...base.sourceRef, siteFileId } };
  };
  // 11a–11f: de pure regels.
  eq('11a plek en sleutel: site:<id>; het site-id wint ook boven een pad', [
    externalSourceLocatorOf({ projectId: 'installateur', siteFileId: ' s1 ' }),
    externalSourceLocatorOf({ projectId: 'installateur', filePath: PATH, siteFileId: 's1' }),
    externalSourceLocatorOf({ projectId: 'installateur', siteFileId: '  ' }),
    externalSourceKey({ kind: 'site', siteFileId: 's1' }),
    externalSourceKeyOfDoc({ projectId: 'installateur', siteFileId: 's1' }),
  ], [{ kind: 'site', siteFileId: 's1' }, { kind: 'site', siteFileId: 's1' }, { kind: 'project', projectId: 'installateur' }, 'site:s1', 'site:s1']);
  const siteSource: ExternalSourceDoc = { projectId: 'installateur', siteFileId: 's1', tasks: [sourceTask('2027-03-10T16:00')], version: '3' };
  eq('11b de scope van een bron op de site', [externalSourceScope(siteSource), externalSourceScopeOf({ kind: 'site', siteFileId: 's1' })], ['site-file', 'site-file']);
  eq('11c een bron op de site raakt alleen koppelingen met hetzelfde site-id', [
    linkMatchesSource(siteLink('s', 's1', 'x'), siteSource, 'site-file'),
    linkMatchesSource(siteLink('t', 's2', 'x'), siteSource, 'site-file'),
    linkMatchesSource(link('p', PATH, 'x'), siteSource, 'site-file'),
    linkMatchesSource(link('n', undefined, 'x'), siteSource, 'site-file'),
  ], [true, false, false, false]);
  const pathSource: ExternalSourceDoc = { projectId: 'installateur', filePath: PATH, tasks: [sourceTask('2027-03-08T16:00')] };
  const browserSource: ExternalSourceDoc = { projectId: 'installateur', tasks: [sourceTask('2027-03-08T16:00')] };
  eq('11d geen andere bron raakt een koppeling met een site-id, ook niet bij hetzelfde project-id', [
    linkMatchesSource(siteLink('s', 's1', 'x'), pathSource, 'project-or-path'),
    linkMatchesSource(siteLink('s', 's1', 'x'), pathSource, 'file-path'),
    linkMatchesSource(siteLink('s', 's1', 'x'), browserSource, 'project-without-path'),
  ], [false, false, false]);
  // 8e: refreshFromSources met alle drie de bronnen tegelijk: elke koppeling krijgt het anker van haar eigen bron.
  const tasks: Task[] = ['s1', 's2', 'p', 'n'].map((id, i): Task => ({
    ...sourceTask('2027-03-05T16:00'), id: `own-${id}`, name: `Eigen ${i}`,
    externalLinks: [id === 'p' ? link('p', PATH, '2027-03-05T16:00') : id === 'n' ? link('n', undefined, '2027-03-05T16:00')
      : siteLink(id, id, '2027-03-05T16:00', '2')],
  }));
  const all = refreshFromSources(tasks, [siteSource, pathSource, browserSource]);
  const anchors = (list: Task[]) => list.map(t => `${t.id}:${t.externalLinks![0].anchorDate}:${t.externalLinks![0].sourceVersion ?? '-'}`);
  eq('11e elke koppeling krijgt het anker van haar eigen bron; s2 is niet gelezen en houdt haar anker', anchors(all.tasks), [
    'own-s1:2027-03-10T16:00:3', 'own-s2:2027-03-05T16:00:2', 'own-p:2027-03-08T16:00:-', 'own-n:2027-03-08T16:00:-',
  ]);
  eq('11f het site-id blijft op de koppeling, zonder pad', [all.tasks[0].externalLinks![0].sourceRef.siteFileId, all.tasks[0].externalLinks![0].sourceRef.filePath], ['s1', undefined]);

  // De store-route. A wijst via de site naar s1; C met pad naar hetzelfde project; E naar een andere site-bron s2.
  const { store, S, a } = plan();
  S().updateTask(a, { externalLinks: [siteLink('x', 's1', '2027-03-05T16:00', '1')] });
  const c = S().addTask({ name: 'C', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
  S().updateTask(c, { externalLinks: [link('y', PATH, '2027-03-05T16:00', 'v1')] });
  const e = S().addTask({ name: 'E', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
  S().updateTask(e, { externalLinks: [siteLink('w', 's2', '2027-03-05T16:00', '1')] });
  S().runCPM();
  const site = new Map<string, { versions: SiteVersionInfo[]; finish: string; readable: boolean }>([
    ['s1', { versions: [{ version: '1' }], finish: '2027-03-05T16:00', readable: true }],
    ['s2', { versions: [{ version: '1' }], finish: '2027-03-05T16:00', readable: true }],
  ]);
  const siteReads: string[] = [];
  const pathReads: string[] = [];
  const siteRead = (id: string): ExternalSourceRead => ({
    projectId: 'installateur', projectName: 'Installateur', siteFileId: id, fileName: `${id}.ifc`, author: 'Projectauteur',
    tasks: [sourceTask(site.get(id)!.finish)], version: site.get(id)!.versions[0].version, readAt: '2026-11-09T12:00:00.000Z',
  });
  store.setState({
    externalSourceVersion: async () => undefined,
    parseExternalSource: async (filePath: string) => { pathReads.push(filePath); return null; },
    externalSiteSourceVersion: async (id: string) => site.get(id)?.versions[0],
    parseExternalSiteSource: async (id: string) => {
      siteReads.push(id);
      return site.get(id)?.readable ? siteRead(id) : null;
    },
  });
  const updates = () => S().ui.externalSourceUpdates.map(u => ({
    key: u.key, locator: u.locator, fileName: u.fileName, version: u.version, siteVersionLabel: u.siteVersionLabel,
    author: u.author, changedLinks: u.changedLinks,
  }));
  const anchorOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks![0];

  await S().checkExternalSources();
  eq('11g dezelfde versie op de site ⇒ niets gelezen, geen balk', [siteReads, updates()], [[], []]);
  site.set('s1', { versions: [{ version: '2', label: 'v2', author: 'Anna de Vries' }, { version: '1' }], finish: '2027-03-10T16:00', readable: true });
  await S().checkExternalSources();
  eq('11h nieuwe versie op de site ⇒ één keer gelezen, een balk met sleutel site:s1, label en wie opsloeg', [siteReads, updates()], [['s1'], [{
    key: 'site:s1', locator: { kind: 'site', siteFileId: 's1' }, fileName: 's1.ifc', version: '2', siteVersionLabel: 'v2',
    author: 'Anna de Vries', changedLinks: 1,
  }]]);
  eq('11i de koppeling met pad is niet via het pad gelezen', pathReads, []);
  S().dismissExternalSourceUpdate('site:s1');
  await S().checkExternalSources();
  eq('11j Later ⇒ weg, en niet terug bij dezelfde versie', [siteReads.length, updates()], [1, []]);
  site.set('s1', { versions: [{ version: '3' }], finish: '2027-03-10T16:00', readable: true });
  await S().checkExternalSources();
  eq('11k een volgende versie zonder label en auteur ⇒ het versienummer en de projectauteur', updates().map(u => [u.siteVersionLabel, u.author]), [['3', 'Projectauteur']]);
  S().setUI({ externalSourceReview: 'site:s1' });
  eq('11l Accepteren met een bron op de site verandert het plan', S().acceptExternalSourceUpdate(siteRead('s1')), true);
  eq('11m alleen de koppeling naar s1 krijgt het nieuwe anker en de versie; de andere houden hun anker', [
    anchorOf(a).anchorDate, anchorOf(a).sourceVersion, anchorOf(a).sourceRef.siteFileId, anchorOf(a).sourceRef.filePath,
    anchorOf(c).anchorDate, anchorOf(e).anchorDate,
  ], ['2027-03-10T16:00', '3', 's1', undefined, '2027-03-05T16:00', '2027-03-05T16:00']);
  eq('11n de balk is weg en het venster dicht', [updates(), S().ui.externalSourceReview], [[], null]);

  // Alle externe relaties vernieuwen: s1 is niet meer te lezen (bijv. geen recht of not-found); s2 wel, met een
  // nieuw anker. De bron met pad leest de browser niet.
  S().undo();
  site.set('s1', { versions: [{ version: '3' }], finish: '2027-03-12T16:00', readable: false });
  site.set('s2', { versions: [{ version: '2' }], finish: '2027-03-09T16:00', readable: true });
  siteReads.length = 0;
  const res = await S().refreshAllExternalAnchors();
  eq('11o vernieuwen leest elke bron op de site één keer', [...siteReads].sort(), ['s1', 's2']);
  eq('11p de uitslag: één bron gelezen, de bron op de site en de bron met pad niet', [res.sources, res.unread, res.unreadProjectIds, res.refreshed], [1, 2, [], 1]);
  eq('11q de niet gelezen bron houdt haar anker; s2 krijgt het hare; de koppeling met pad blijft', [
    anchorOf(a).anchorDate, anchorOf(a).sourceVersion, anchorOf(e).anchorDate, anchorOf(e).sourceVersion, anchorOf(c).anchorDate,
  ], ['2027-03-05T16:00', '1', '2027-03-09T16:00', '2', '2027-03-05T16:00']);

  // Zonder host (of in de desktop-app): geen versie, geen balk, en niets gelezen.
  store.setState({ externalSiteSourceVersion: async () => undefined, parseExternalSiteSource: async () => null });
  site.set('s1', { versions: [{ version: '9' }], finish: '2027-03-20T16:00', readable: true });
  await S().checkExternalSources();
  eq('11r zonder site ⇒ geen balk', updates(), []);
  const none = await S().refreshAllExternalAnchors();
  eq('11s zonder site ⇒ de bronnen op de site tellen als niet gelezen, de ankers blijven', [none.sources, none.unread, anchorOf(a).anchorDate], [0, 3, '2027-03-05T16:00']);
}

// (12) Een bron van de site: geen pad, het site-id en de versie op de site.
{
  const { S } = plan();
  S().setProject({ id: 'proj-bron', name: 'Bron' });
  const text = writeIFC(buildWriteIFCInput(S()));
  const read = await readExternalSiteSource({
    id: 'site-7', name: 'Bron.ifc', version: '12', text: async () => text, bytes: async () => new TextEncoder().encode(text),
  });
  eq('12a geen pad, wel het site-id, de bestandsnaam en het project-id', [read.filePath, read.siteFileId, read.fileName, read.projectId], [undefined, 'site-7', 'Bron.ifc', 'proj-bron']);
  eq('12b de versie is de versie op de site, met een leestijd', [read.version, typeof read.readAt], ['12', 'string']);
  eq('12c de sleutel van deze bron is site:<id>', externalSourceKeyOfDoc(read), 'site:site-7');
  const noVersion = await readExternalSiteSource({ id: 'site-7', name: 'Bron.ifc', text: async () => text, bytes: async () => new Uint8Array() });
  eq('12d zonder versie van de site ⇒ geen versie', noVersion.version, undefined);
}

if (failures.length) {
  console.error(`XX external-source-update: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-source-update: ${checks} checks`);
