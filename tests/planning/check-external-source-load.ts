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

if (failures.length) {
  console.error(`XX external-source-load: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-source-load: ${checks}/${checks}`);
