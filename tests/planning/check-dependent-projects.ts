// Stap 1.11 (keuze 7 en keuze 3 zonder cloud, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md` §7.3
// en §7.4): *Afhankelijke projecten zoeken…* en de waarschuwing vóór opslaan bij de bron.
//
// Wat deze check vastlegt:
// 1. `findDependentLinks`: match op project-id (niet op pad), het eigen project telt niet mee, een
//    geopend document wint van zijn bestand, één project telt één keer, koppelingen naar een ander
//    project tellen niet.
// 2. `isAnchorTighter`: bij een externe voorganger (onze taak is hun voorganger) is een later anker te
//    krap, bij een externe opvolger een vroeger anker. Meer ruimte of gelijk ⇒ geen waarschuwing.
// 3. Diezelfde richting volgt uit de rekenmotor van het afhankelijke project (`solveProject`): een later
//    voorganger-anker duwt hun taak later, een vroeger opvolger-anker geeft de melding van stap 1.4.
// 4. `tightDependentAnchors` rekent het nieuwe anker met `sourceAnchorDate` (voorganger: vroege datum,
//    opvolger: late datum) uit de huidige taken; een eigen taak die weg is, geeft geen regel.
// 5. Kandidaten: een IFC-bestand alleen-lezen (ook de koppelingen uit `OPS_ExternalLink`), een bestand
//    dat geen planning is ⇒ overgeslagen; geopende documenten zonder het actieve document.
// 6. `withDependentResult` vervangt het resultaat van een document en laat gesloten documenten weg.
// 7. De opslaanroute: alleen met een zoekresultaat én een te krap anker vraagt Opslaan het; *Annuleren*
//    slaat niets op; een ander project-id (resultaat van vóór *Opslaan als* kopie) telt niet.
// 8. De route zit alleen in Opslaan en Opslaan als: AutoSave, crashherstel en MCP vragen niets.
import { readFileSync } from 'node:fs';
import { createAppStoreContext } from '@/state/appStore';
import {
  findDependentLinks, isAnchorTighter, summarizeDependentLinks, tightDependentAnchors,
  type DependentCandidate, type DependentLink,
} from '@/engine/dependentProjects';
import { candidateFromIfcText, candidatesFromOpenDocuments, withDependentResult } from '@/state/dependentCandidates';
import { resetDependentAnchorAsker, setDependentAnchorAsker } from '@/state/dependentAnchorQuestion';
import { solveProject } from '@/engine/scheduler/solveProject';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ExternalLink, Task } from '@/types/task';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const OWN = 'installateur';
const link = (id: string, projectId: string, taskId: string, direction: ExternalLink['direction'], anchorDate: string): ExternalLink => ({
  id, direction, relType: 'FS', lagDays: 0, anchorDate, sourceMissing: false,
  sourceRef: { projectId, projectName: 'Installateur', taskId, taskName: 'Installatie', filePath: '/p/Installateur.ifc' },
});
const cand = (projectId: string, opened: boolean, tasks: DependentCandidate['tasks'], fileName?: string): DependentCandidate => ({
  projectId, projectName: projectId.toUpperCase(), opened, tasks, ...(fileName ? { fileName } : {}),
});

// (1) Match op project-id.
{
  const aannemer = cand('aannemer', false, [
    { id: 'a1', name: 'Afbouw', externalLinks: [link('x', OWN, 'b1', 'predecessor', '2027-03-05T16:00')] },
    { id: 'a2', name: 'Oplevering', externalLinks: [link('y', 'ander-project', 'q', 'predecessor', '2027-03-05T16:00')] },
  ], 'Aannemer.ifc');
  const aannemerOpen = cand('aannemer', true, [
    { id: 'a1', name: 'Afbouw', externalLinks: [link('x', OWN, 'b1', 'predecessor', '2027-03-09T16:00')] },
  ]);
  const eigen = cand(OWN, false, [{ id: 'b1', name: 'Installatie', externalLinks: [link('z', OWN, 'b1', 'predecessor', '2027-01-01')] }]);
  const sloper = cand('sloper', false, [
    { id: 's1', name: 'Sloop', externalLinks: [link('w', ` ${OWN} `, 'b2', 'successor', '2027-02-01T07:00')] },
  ], 'Sloper.ifc');

  const found = findDependentLinks([aannemer, eigen, sloper], OWN);
  eq('1a koppelingen naar dit project, niet naar een ander, niet uit het eigen bestand',
    found.map(l => [l.projectId, l.taskId, l.ownTaskId, l.linkId, l.direction, l.anchorDate]),
    [['aannemer', 'a1', 'b1', 'x', 'predecessor', '2027-03-05T16:00'], ['sloper', 's1', 'b2', 'w', 'successor', '2027-02-01T07:00']]);
  eq('1b bestandsnaam en projectnaam reizen mee', [found[0].fileName, found[0].projectName, found[0].taskName], ['Aannemer.ifc', 'AANNEMER', 'Afbouw']);
  eq('1c geopend document wint van zijn bestand (ook als het later komt)',
    findDependentLinks([aannemer, aannemerOpen], OWN).map(l => l.anchorDate), ['2027-03-09T16:00']);
  eq('1d twee bestanden van hetzelfde project tellen één keer',
    findDependentLinks([aannemer, { ...aannemer, fileName: 'kopie.ifc' }], OWN).map(l => l.fileName), ['Aannemer.ifc']);
  eq('1e leeg eigen project-id ⇒ niets', findDependentLinks([aannemer], '  '), []);
  eq('1f samenvatting telt projecten en koppelingen', summarizeDependentLinks(found), { projects: 2, links: 2 });
}

// (2) De richtingsregel.
{
  eq('2a voorganger: later anker ⇒ te krap', isAnchorTighter('predecessor', '2027-03-05T16:00', '2027-03-08T16:00'), true);
  eq('2b voorganger: vroeger anker ⇒ meer ruimte', isAnchorTighter('predecessor', '2027-03-05T16:00', '2027-03-04T16:00'), false);
  eq('2c opvolger: vroeger anker ⇒ te krap', isAnchorTighter('successor', '2027-03-05T07:00', '2027-03-04T07:00'), true);
  eq('2d opvolger: later anker ⇒ meer ruimte', isAnchorTighter('successor', '2027-03-05T07:00', '2027-03-08T07:00'), false);
  eq('2e gelijk ⇒ niets', [isAnchorTighter('predecessor', '2027-03-05T16:00', '2027-03-05T16:00'),
    isAnchorTighter('successor', '2027-03-05', '2027-03-05')], [false, false]);
  eq('2f datum en datum-met-tijd vergelijken als moment', isAnchorTighter('predecessor', '2027-03-05', '2027-03-05T07:00'), true);
  eq('2g onleesbaar of leeg ⇒ niets', [isAnchorTighter('predecessor', '', '2027-03-05'),
    isAnchorTighter('successor', 'onzin', '2027-03-05')], [false, false]);
}

// (3) De regel tegen de rekenmotor van het afhankelijke project.
{
  const depTask = (links: ExternalLink[]): Task => ({
    id: 'a1', name: 'Afbouw', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime('2027-03-01', 3, 'days'), externalLinks: links,
  });
  const solveDep = (l: ExternalLink) => {
    const { store } = createAppStoreContext();
    const S = () => store.getState();
    S().newProject();
    S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
    S().addTask({ ...depTask([l]) });
    S().runCPM();
    return S();
  };
  const startOf = (anchor: string) => solveDep(link('x', OWN, 'b1', 'predecessor', anchor)).tasks[0].time.earlyStart;
  const early = startOf('2027-03-05T16:00');
  const late = startOf('2027-03-10T16:00');
  eq('3a voorganger: een later anker duwt hun taak later (motor) en heet te krap (regel)',
    [late > early, isAnchorTighter('predecessor', '2027-03-05T16:00', '2027-03-10T16:00')], [true, true]);
  const violated = (anchor: string) => (solveDep(link('y', OWN, 'b1', 'successor', anchor)).cpmResult?.externalSuccessorViolations ?? []).length;
  // Hun taak loopt 1–3 maart; een opvolger-anker op 10 maart laat ruimte, op 2 maart niet.
  eq('3b opvolger: een vroeger anker geeft de melding van stap 1.4 (motor) en heet te krap (regel)',
    [violated('2027-03-10T07:00'), violated('2027-03-02T07:00'), isAnchorTighter('successor', '2027-03-10T07:00', '2027-03-02T07:00')],
    [0, 1, true]);
  void solveProject;
}

// (4) Het nieuwe anker uit de huidige taken.
{
  const own = (over: Partial<Task['time']>): Task => ({
    id: 'b1', name: 'Installatie', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2027-03-01', 5, 'days'), earlyStart: '2027-03-01T07:00', earlyFinish: '2027-03-08T16:00',
      lateStart: '2027-03-03T07:00', lateFinish: '2027-03-10T16:00', ...over },
  });
  const dl = (linkId: string, direction: ExternalLink['direction'], anchorDate: string, ownTaskId = 'b1'): DependentLink => ({
    projectId: 'aannemer', projectName: 'Aannemer', taskId: 'a1', taskName: 'Afbouw', ownTaskId, linkId,
    direction, relType: 'FS', anchorDate,
  });
  const tight = tightDependentAnchors([
    dl('p-krap', 'predecessor', '2027-03-05T16:00'), // nieuw: vroege finish 8 maart ⇒ later ⇒ te krap
    dl('p-ruim', 'predecessor', '2027-03-09T16:00'), // nieuw 8 maart ⇒ eerder ⇒ ruimer
    dl('s-krap', 'successor', '2027-03-05T07:00'),   // nieuw: late start 3 maart ⇒ eerder ⇒ te krap
    dl('s-ruim', 'successor', '2027-03-01T07:00'),   // nieuw 3 maart ⇒ later ⇒ ruimer
    dl('weg', 'predecessor', '2027-01-01', 'bestaat-niet'),
  ], [own({})]);
  eq('4a alleen de te krappe, met het nieuwe anker uit sourceAnchorDate',
    tight.map(t => [t.linkId, t.anchorDate, t.newAnchorDate, t.ownTaskName]),
    [['p-krap', '2027-03-05T16:00', '2027-03-08T16:00', 'Installatie'], ['s-krap', '2027-03-05T07:00', '2027-03-03T07:00', 'Installatie']]);
  // Een gestarte brontaak valt voor een opvolger terug op de vroege datum (keuze 10), net als bij vernieuwen.
  const started = tightDependentAnchors([dl('s', 'successor', '2027-03-05T07:00')], [own({ actualStart: '2027-03-01T07:00' })]);
  eq('4b gestarte taak: opvolger rekent met de vroege start', started.map(t => t.newAnchorDate), ['2027-03-01T07:00']);
}

// (5) Kandidaten uit bestanden en geopende documenten.
const buildDependent = () => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
  const a = S().addTask({ name: 'Afbouw', time: createDefaultTaskTime('2027-03-01', 3, 'days') });
  S().updateTask(a, { externalLinks: [link('x', OWN, 'b1', 'predecessor', '2027-03-05T16:00')] });
  S().runCPM();
  return { S, a };
};
await (async () => {
  const { S, a } = buildDependent();
  const ifc = writeIFC(buildWriteIFCInput(S()));
  const c = await candidateFromIfcText('/map/Aannemer.ifc', ifc);
  eq('5a een IFC-bestand geeft project-id, naam, bestandsnaam en de koppeling',
    c && [c.projectId === S().project.id, c.projectName, c.fileName, c.opened,
      findDependentLinks([c], OWN).map(l => [l.taskId === a, l.taskName, l.anchorDate])],
    [true, 'Aannemer', 'Aannemer.ifc', false, [[true, 'Afbouw', '2027-03-05T16:00']]]);
  eq('5b een bestand dat geen planning is ⇒ overgeslagen', await candidateFromIfcText('/map/kapot.ifc', 'ISO-10303-21; onzin'), null);
  S().newDocument();
  const docs = S().getOpenDocumentPayloads();
  const opened = candidatesFromOpenDocuments(docs, S().activeDocumentId);
  eq('5c geopende documenten zonder het actieve, met hun koppelingen in het geheugen',
    opened.map(o => [o.projectName, o.opened, findDependentLinks([o], OWN).length]), [['Aannemer', true, 1]]);
})();

// (6) Het resultaat per document.
{
  const r = (documentId: string, n: number) => ({ documentId, projectId: OWN, links: new Array(n).fill(null) as DependentLink[] });
  const next = withDependentResult([r('d1', 1), r('d2', 2), r('dicht', 3)], r('d1', 4), new Set(['d1', 'd2']));
  eq('6a vervangt d1, houdt d2, laat een gesloten document weg', next.map(x => [x.documentId, x.links.length]), [['d2', 2], ['d1', 4]]);
}

// (7) De opslaanroute.
await (async () => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Installateur' });
  const b1 = S().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  S().runCPM();
  const finish = S().tasks.find(t => t.id === b1)!.time.earlyFinish;
  const documentId = S().activeDocumentId;
  const projectId = S().project.id;
  const asked: string[][] = [];
  let answer = false;
  setDependentAnchorAsker(async (anchors) => { asked.push(anchors.map(x => `${x.linkId}:${x.anchorDate}→${x.newAnchorDate}`)); return answer; });
  const result = (anchorDate: string, pid = projectId) => S().setUI({ dependentProjects: [{
    documentId, projectId: pid,
    links: [{ projectId: 'aannemer', projectName: 'Aannemer', taskId: 'a1', taskName: 'Afbouw', ownTaskId: b1, linkId: 'x',
      direction: 'predecessor', relType: 'FS', anchorDate }],
  }] });
  // Zonder browser loopt het echte schrijven daarna op een fout (geen `document`); dat is hier niet de
  // vraag. De opslaanroute vangt die fout zelf en meldt hem; de console blijft stil.
  const consoleError = console.error;
  console.error = () => {};
  try {
    await S().saveFile();
    eq('7a zonder zoekresultaat: geen vraag', asked.length, 0);
    result(finish);
    await S().saveFile();
    eq('7b anker gelijk aan de huidige datum: geen vraag', asked.length, 0);
    result('2027-02-01T16:00', 'ander-project-id');
    await S().saveFile();
    eq('7c resultaat van een ander project-id: geen vraag', asked.length, 0);
    result('2027-02-01T16:00');
    const dirtyBefore = S().isDirty;
    await S().saveFileAs();
    eq('7d te krap: Opslaan als vraagt het, met oud en nieuw anker', asked, [[`x:2027-02-01T16:00→${finish}`]]);
    eq('7e Annuleren: het document blijft gewijzigd', S().isDirty, dirtyBefore);
    eq('7f na het antwoord staat er geen vraag meer open', S().ui.pendingDependentAnchorWarning, null);
    answer = true;
    await S().saveFile();
    eq('7g Opslaan vraagt het ook', asked.length, 2);
  } finally {
    console.error = consoleError;
    resetDependentAnchorAsker();
  }
})();

// (8) Alleen Opslaan en Opslaan als.
{
  const read = (p: string) => readFileSync(p, 'utf8');
  const slice = read('src/state/slices/fileSlice.ts');
  eq('8a fileSlice vraagt het op precies twee plekken', (slice.match(/await settleDependentAnchors\(\)/g) ?? []).length, 2);
  const writeStart = slice.indexOf('const writeActiveDocument');
  const asStart = slice.indexOf('const saveActiveDocumentAs');
  const calls = [...slice.matchAll(/await settleDependentAnchors\(\)/g)].map(m => m.index ?? -1);
  eq('8b … in writeActiveDocument en saveActiveDocumentAs',
    [calls[0] > writeStart && calls[0] < asStart, calls[1] > asStart], [true, true]);
  for (const p of ['src/hooks/useAutoSave.ts', 'src/services/recovery/recoveryStore.ts', 'src/services/mcp/tools/fileTools.ts']) {
    eq(`8c ${p} vraagt niets`, /settleDependentAnchors|askDependentAnchors/.test(read(p)), false);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX ${f}`);
  console.log(`check-dependent-projects: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`check-dependent-projects: alle ${checks} checks groen`);
