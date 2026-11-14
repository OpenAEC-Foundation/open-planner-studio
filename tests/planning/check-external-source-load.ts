// Knownbug 336: het bronbestand van een externe relatie leest de app zoals ze het opent.
//
// Vroeger las `parseExternalSource` het bestand met de kale lezer. Een eigen IFC geeft dan een
// datum zonder tijd, en de eigen taak maakte daar de verkeerde kant van de dag van: FS naar een
// startmijlpaal werd 16:00 (bron 07:00), SS naar een eindmijlpaal 07:00 (bron 16:00). Een koppeling
// die al klopte, kreeg zo bij "Bron vernieuwen" toch een nieuw anker en een undo-stap.
//
// Bron: `examples/showcase-groot-terrein-onderaannemer.ifc` (het meegeleverde bronproject van
// De Vaart). De check leest het bestand via dezelfde `readExternalSource` als de app, met Node-fs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createAppStoreContext } from '@/state/appStore';
import { readExternalSource } from '@/state/externalSource';
import { computedFinish, computedStart } from '@/utils/taskDates';
import type { FormatIO } from '@/services/formatRegistry';
import type { ExternalLink } from '@/types/task';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { externIfc } from '../fixtures/recordedDatesIfc';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

// `run.sh` schrijft de bundel in `tests/planning/`, dus de repo-root ligt twee mappen hoger.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'examples/showcase-groot-terrein-onderaannemer.ifc');
const nodeIo: FormatIO = {
  readTextFile: async path => readFileSync(path, 'utf8'),
  readFile: async path => new Uint8Array(readFileSync(path)),
};

const source = await readExternalSource(sourcePath, nodeIo);
const startMilestone = source.tasks.find(task => task.name === 'Start of subcontractor site works');
const endMilestone = source.tasks.find(task => task.name === 'Site ready for main contractor paving');
if (!startMilestone || !endMilestone) {
  console.error('XX external-source-load: de twee mijlpalen ontbreken in het bronvoorbeeld');
  process.exit(1);
}

// (1) De bron draagt de momenten die de app bij openen toont (D7: één moment per mijlpaal).
eq('1a startmijlpaal: start 07:00', computedStart(startMilestone), '2027-03-01T07:00');
eq('1b eindmijlpaal: einde 16:00', computedFinish(endMilestone), '2027-04-06T16:00');

// (2) Verversen via de store: het anker volgt de bron, aan de goede kant van de dag.
const { store } = createAppStoreContext();
const S = () => store.getState();
store.setState({
  parseExternalSource: async (filePath: string) => readExternalSource(filePath, nodeIo),
});
S().newProject();
const taskId = S().addTask({ name: 'Bestrating parkeerterrein' });
const link = (id: string, relType: ExternalLink['relType'], sourceTaskId: string, anchorDate: string): ExternalLink => ({
  id, direction: 'predecessor', relType, anchorDate, lagDays: 0, sourceMissing: false,
  sourceRef: { projectId: source.projectId, taskId: sourceTaskId, filePath: sourcePath },
});
S().updateTask(taskId, {
  externalLinks: [
    link('fs-start', 'FS', startMilestone.id, '2020-01-01T07:00'),
    link('ss-end', 'SS', endMilestone.id, '2020-01-01T07:00'),
  ],
});
const first = await S().refreshExternalAnchorsFrom(sourcePath);
const anchors = () => S().tasks.find(task => task.id === taskId)!.externalLinks!.map(l => [l.id, l.anchorDate]);
eq('2a beide koppelingen zijn ververst', first, { refreshed: 2, missing: 0 });
eq('2b FS naar de startmijlpaal: 07:00; SS naar de eindmijlpaal: 16:00', anchors(), [
  ['fs-start', '2027-03-01T07:00'],
  ['ss-end', '2027-04-06T16:00'],
]);

// (3) Een tweede verversing op een ongewijzigde bron verandert niets en maakt geen undo-stap.
const applied = () => S().historyEvents.filter(event => event.state === 'applied').length;
const before = applied();
const second = await S().refreshExternalAnchorsFrom(sourcePath);
eq('3a de tweede verversing vindt dezelfde koppelingen', second, { refreshed: 2, missing: 0 });
eq('3b het anker blijft gelijk', anchors(), [
  ['fs-start', '2027-03-01T07:00'],
  ['ss-end', '2027-04-06T16:00'],
]);
eq('3c geen nieuwe undo-stap bij een actuele koppeling', applied(), before);
eq('3d het document blijft rekenkundig actueel', S().scheduleStale, false);

// (4) Knownbug 509: de koppeling in De Vaart wijst naar het meegeleverde bronbestand. Verversen
// vindt haar op project- en taak-id, en het bevroren anker klopt al.
{
  const grootPath = resolve(root, 'examples/showcase-appartementencomplex.ifc');
  const groot = createAppStoreContext().store;
  const parsedGroot = await readExternalSource(grootPath, nodeIo);
  const linked = parsedGroot.tasks.filter(task => (task.externalLinks?.length ?? 0) > 0);
  eq('4a De Vaart heeft één taak met een externe koppeling', linked.map(task => task.name), ['Car park paving']);
  groot.setState({ parseExternalSource: async (filePath: string) => readExternalSource(filePath, nodeIo) });
  groot.getState().newProject();
  const own = groot.getState().addTask({ name: 'Car park paving' });
  const original = linked[0].externalLinks![0];
  groot.getState().updateTask(own, {
    externalLinks: [{ ...original, sourceRef: { ...original.sourceRef, filePath: sourcePath } }],
  });
  const result = await groot.getState().refreshExternalAnchorsFrom(sourcePath);
  eq('4b verversen vindt de koppeling op id', result, { refreshed: 1, missing: 0 });
  eq('4c het opgeslagen anker is al het actuele anker',
    groot.getState().tasks.find(task => task.id === own)!.externalLinks![0].anchorDate, original.anchorDate);
}

// (5) Review PR #792 ronde 1: de bron houdt de modus "datums zoals opgeslagen" aan, zoals openen.
// Bron: de fixture van issue #63. Taak B staat in het bestand op 16–20 maart 2026; de berekening
// geeft 9–13 maart. Een eigen IFC dat IN de modus is opgeslagen, opent weer in de modus, met B op
// 20 maart 16:00. De bronlezer gaf eerst B op 13 maart (de berekening), en dan schoof het
// gekoppelde werk na "Bron vernieuwen" van 23 naar 16 maart.
{
  const memoryIo = (text: string): FormatIO => ({
    readTextFile: async () => text,
    readFile: async () => new TextEncoder().encode(text),
  });
  const bFinish = (tasks: readonly { name: string }[]) => {
    const b = tasks.find(task => task.name === 'B') as Parameters<typeof computedFinish>[0] | undefined;
    return b ? computedFinish(b) : null;
  };
  const opener = createAppStoreContext().store;
  opener.getState().newProject();
  opener.getState().applyLoadedProject(readIFC(externIfc('ext5')), { filePath: null, recompute: true });
  eq('5a de verse import opent in de modus, met B op 20 maart', [opener.getState().datesAsRecorded, bFinish(opener.getState().tasks)],
    [true, '2026-03-20T16:00']);
  const savedInMode = writeIFC(buildWriteIFCInput(opener.getState(), 'planOnly'));
  opener.getState().newProject();
  opener.getState().applyLoadedProject(readIFC(savedInMode), { filePath: null, recompute: true });
  eq('5b het eigen IFC, opgeslagen in de modus, opent weer met B op 20 maart',
    [opener.getState().datesAsRecorded, bFinish(opener.getState().tasks)], [true, '2026-03-20T16:00']);

  const ownPath = '/projecten/bron-in-modus.ifc';
  const ownSource = await readExternalSource(ownPath, memoryIo(savedInMode));
  eq('5c de bronlezer geeft B dezelfde datum als openen', bFinish(ownSource.tasks), '2026-03-20T16:00');
  const foreignSource = await readExternalSource('/projecten/extern.ifc', memoryIo(externIfc('ext5')));
  eq('5d ook een verse import als bron: B op 20 maart', bFinish(foreignSource.tasks), '2026-03-20T16:00');

  const linked = createAppStoreContext().store;
  linked.setState({ parseExternalSource: async (filePath: string) => readExternalSource(filePath, memoryIo(savedInMode)) });
  linked.getState().newProject();
  linked.getState().setProject({ startDate: '2026-03-02' });
  const own = linked.getState().addTask({ name: 'Bestrating' });
  const sourceB = ownSource.tasks.find(task => task.name === 'B')!;
  linked.getState().updateTask(own, {
    externalLinks: [{
      id: 'fs-b', direction: 'predecessor', relType: 'FS', anchorDate: '2026-03-20T16:00', lagDays: 0, sourceMissing: false,
      sourceRef: { projectId: ownSource.projectId, taskId: sourceB.id, filePath: ownPath },
    }],
  });
  linked.getState().runCPM();
  const ownStart = () => computedStart(linked.getState().tasks.find(task => task.id === own)!);
  eq('5e het gekoppelde werk start na B, op maandag 23 maart', ownStart(), '2026-03-23T07:00');
  const result = await linked.getState().refreshExternalAnchorsFrom(ownPath);
  linked.getState().runCPM();
  eq('5f "Bron vernieuwen" vindt de koppeling', result, { refreshed: 1, missing: 0 });
  eq('5g het anker blijft 20 maart 16:00', linked.getState().tasks.find(task => task.id === own)!.externalLinks![0].anchorDate,
    '2026-03-20T16:00');
  eq('5h het gekoppelde werk blijft op 23 maart', ownStart(), '2026-03-23T07:00');
}

if (failures.length) {
  console.error(`XX external-source-load: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-source-load: ${checks}/${checks}`);
