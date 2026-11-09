// Stap 1.6 (keuze 6, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md` 7.2): de desktop-app bewaakt de
// map van elk bronbestand. Deze check legt de pure delen vast (`src/engine/externalSourceWatch.ts`):
// 1. `parentDir`: de map van een pad op Linux/macOS, Windows en een netwerkpad.
// 2. `externalSourceWatchTargets`: elk bronbestand één keer, elke map één keer, een vaste sleutel; geen pad
//    of een relatief pad telt niet mee.
// 3. `watchEventTouchesSource`: een melding over het bronbestand telt, ook met een andere schrijfwijze van
//    het pad (backslash, hoofdletters op Windows); lezen (`access`) en een ander bestand tellen niet.
import { externalSourceWatchTargets, parentDir, watchEventTouchesSource } from '@/engine/externalSourceWatch';
import type { ExternalLink, Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

// (1) De map van een pad.
eq('1a Linux', parentDir('/home/anna/projecten/Installateur.ifc'), '/home/anna/projecten');
eq('1b in de root', parentDir('/Installateur.ifc'), '/');
eq('1c Windows', parentDir('C:\\Projecten\\Installateur.ifc'), 'C:\\Projecten');
eq('1d Windows, in de root van de schijf', parentDir('D:\\Installateur.ifc'), 'D:\\');
eq('1e netwerkpad', parentDir('\\\\server\\deel\\Installateur.ifc'), '\\\\server\\deel');

// (2) De doelen.
const link = (id: string, filePath: string | undefined): ExternalLink => ({
  id, direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-05T16:00', sourceMissing: false,
  sourceRef: { projectId: 'p', taskId: 't', ...(filePath ? { filePath } : {}) },
});
const task = (id: string, links: ExternalLink[]): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime('2027-03-01', 1, 'days'), externalLinks: links,
});
const tasks = [
  task('A', [link('a1', '/projecten/Installateur.ifc'), link('a2', '/projecten/Terrein.ifc')]),
  task('B', [link('b1', '/projecten/./Installateur.ifc'), link('b2', undefined), link('b3', 'relatief/Elders.ifc')]),
  task('C', [link('c1', '/archief/Oud.ifc')]),
  task('D', []),
];
const targets = externalSourceWatchTargets(tasks);
eq('2a elk bestand één keer, genormaliseerd', [...targets.files], ['/archief/Oud.ifc', '/projecten/Installateur.ifc', '/projecten/Terrein.ifc']);
eq('2b elke map één keer', targets.dirs, ['/projecten', '/archief']);
eq('2c dezelfde bronnen in een andere volgorde ⇒ dezelfde sleutel',
  externalSourceWatchTargets([...tasks].reverse()).key, targets.key);
eq('2d zonder koppelingen ⇒ niets te bewaken', externalSourceWatchTargets([task('X', [])]), { dirs: [], files: {}, key: '' });

// (3) Raakt een melding een bron?
const files = targets.files;
eq('3a wijziging van het bronbestand', watchEventTouchesSource({ type: { modify: { kind: 'data', mode: 'any' } }, paths: ['/projecten/Installateur.ifc'] }, files), true);
eq('3b hernoemd op zijn plek (opslaan via een tijdelijk bestand)',
  watchEventTouchesSource({ type: { rename: { mode: 'both' } }, paths: ['/projecten/.Installateur.ifc.tmp', '/projecten/Installateur.ifc'] }, files), true);
eq('3c een ander bestand in dezelfde map', watchEventTouchesSource({ type: { create: { kind: 'file' } }, paths: ['/projecten/notities.txt'] }, files), false);
eq('3d alleen lezen telt niet', watchEventTouchesSource({ type: { access: { kind: 'open', mode: 'read' } }, paths: ['/projecten/Installateur.ifc'] }, files), false);
eq('3e soort onbekend (any) telt wel', watchEventTouchesSource({ type: 'any', paths: ['/projecten/Terrein.ifc'] }, files), true);
const windows = externalSourceWatchTargets([task('W', [link('w', 'C:/Projecten/Installateur.ifc')])]).files;
eq('3f Windows: backslash en hoofdletters tellen als hetzelfde pad',
  watchEventTouchesSource({ type: { modify: { kind: 'any' } }, paths: ['c:\\projecten\\INSTALLATEUR.IFC'] }, windows), true);

if (failures.length) {
  console.error(`XX external-source-watch: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-source-watch: ${checks} checks`);
