// Een relatie naar een OPVOLGER in een ander project rekent met de laatst toelaatbare datum van de
// brontaak: de late start (FS, SS) of de late finish (FF, SF), niet de geplande (vroege) datum.
// Besluit van Ethan, 2026-11-02 (voorstel 1 uit #792): zo rekent P6 als twee projecten samen open
// zijn (External Late Finish). Wie toch aan de geplande datum vast wil houden, zet een gewone
// datumbeperking.
//
// Terugval: heeft de brontaak geen late datum (een vers MSPDI-bestand zonder herberekening), dan
// telt de vroege datum, zoals vroeger. Staat de gebruikte kant van de brontaak al vast als werkelijke
// datum (gestart, of klaar), dan is er daar geen speling meer en telt de rekendatum, ook zoals vroeger.
// Een externe VOORGANGER verandert niet: die rekent met de vroege datum van de brontaak.
//
// Voorbeeld uit het besluit (sectie 4): Installatie staat gepland op 1 maart en mag uiterlijk op
// 15 maart beginnen. De ruwbouw krijgt dan 10 werkdagen speling, niet 0.
import { readExternalSource } from '@/state/externalSource';
import { createAppStoreContext } from '@/state/appStore';
import { refreshExternalAnchors, sourceAnchorDate } from '@/engine/externalLinks';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { computedStart } from '@/utils/taskDates';
import type { FormatIO } from '@/services/formatRegistry';
import type { ExternalLink, Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const TYPES = ['FS', 'SS', 'FF', 'SF'] as const;
const link = (direction: ExternalLink['direction'], relType: ExternalLink['relType'], taskId = 'bron-1',
  anchorDate = '2020-01-01T07:00'): ExternalLink => ({
  id: `${direction}-${relType}`, direction, relType, anchorDate, lagDays: 0, sourceMissing: false,
  sourceRef: { projectId: 'bron', taskId },
});
const sourceTask = (time: Partial<Task['time']>): Task => ({
  id: 'bron-1', name: 'Installatie', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2027-03-01', 5, 'days'), ...time },
});
const planned = {
  earlyStart: '2027-03-01T07:00', earlyFinish: '2027-03-05T16:00',
  lateStart: '2027-03-15T07:00', lateFinish: '2027-03-19T16:00',
};
const anchors = (task: Task, direction: ExternalLink['direction']) =>
  TYPES.map(relType => sourceAnchorDate(link(direction, relType), task));

// (1) Opvolger: de laatst toelaatbare datum. Voorganger: ongewijzigd de vroege datum.
{
  const task = sourceTask(planned);
  eq('1a opvolger FS/SS/FF/SF: late start, late start, late finish, late finish', anchors(task, 'successor'),
    ['2027-03-15T07:00', '2027-03-15T07:00', '2027-03-19T16:00', '2027-03-19T16:00']);
  eq('1b voorganger FS/SS/FF/SF: ongewijzigd vroege finish, vroege start, vroege finish, vroege start',
    anchors(task, 'predecessor'), ['2027-03-05T16:00', '2027-03-01T07:00', '2027-03-05T16:00', '2027-03-01T07:00']);
  // Negatieve speling in de bron: de late datum ligt vóór de vroege. Ook dan telt de late datum.
  const tight = sourceTask({ ...planned, lateStart: '2027-02-22T07:00', lateFinish: '2027-02-26T16:00' });
  eq('1c bron met negatieve speling: de late datum, ook als die vóór de geplande ligt', anchors(tight, 'successor'),
    ['2027-02-22T07:00', '2027-02-22T07:00', '2027-02-26T16:00', '2027-02-26T16:00']);
}

// (2) Terugval zonder late datums: de vroege datum, zoals vroeger.
{
  const task = sourceTask({ ...planned, lateStart: '', lateFinish: '' });
  eq('2a zonder late datums: opvolger valt terug op de vroege datum', anchors(task, 'successor'),
    ['2027-03-01T07:00', '2027-03-01T07:00', '2027-03-05T16:00', '2027-03-05T16:00']);
  const onlyStart = sourceTask({ ...planned, lateFinish: '' });
  eq('2b alleen een late start: FS/SS de late start, FF/SF terug op de vroege finish', anchors(onlyStart, 'successor'),
    ['2027-03-15T07:00', '2027-03-15T07:00', '2027-03-05T16:00', '2027-03-05T16:00']);

  // Een vers MSPDI-bestand zonder LateStart/LateFinish, ingelezen met de kale lezer. De lezer vult de
  // late datums dan met de geplande (`mspdiReader.ts`: `lateStart: start`), dus ook hier wordt het
  // anker de geplande start.
  const mspdi = readMSPDI(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Installateur</Name>
  <StartDate>2027-03-01T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay><Tasks>
  <Task><UID>1</UID><ID>1</ID><Name>Installatie</Name><OutlineLevel>1</OutlineLevel>
    <Start>2027-03-01T08:00:00</Start><Finish>2027-03-05T17:00:00</Finish><Duration>PT40H0M0S</Duration></Task>
  </Tasks></Project>`);
  const fresh = mspdi.tasks.find(task => task.name === 'Installatie')!;
  eq('2c het verse MSPDI-bestand: late datums = de geplande datums', [fresh.time.lateStart, fresh.time.lateFinish],
    [fresh.time.earlyStart, fresh.time.earlyFinish]);
  const owner: Task = { ...sourceTask({}), id: 'eigen', name: 'Ruwbouw',
    externalLinks: [{ ...link('successor', 'FS', fresh.id), sourceRef: { projectId: mspdi.project.id, taskId: fresh.id } }] };
  const refreshed = refreshExternalAnchors([owner], { projectId: mspdi.project.id, tasks: mspdi.tasks });
  eq('2d verversen uit dat bestand: het anker is de geplande start', refreshed.tasks[0].externalLinks![0].anchorDate,
    computedStart(fresh));
}

// (3) Een kant die al gebeurd is, heeft geen speling meer: de rekendatum, zoals vroeger.
{
  const started = sourceTask({ ...planned, actualStart: '2027-03-01T07:00', completion: 0.4 });
  eq('3a gestarte brontaak: FS/SS de rekendatum van de start, FF/SF de late finish', anchors(started, 'successor'),
    ['2027-03-01T07:00', '2027-03-01T07:00', '2027-03-19T16:00', '2027-03-19T16:00']);
  const done = sourceTask({
    ...planned, actualStart: '2027-03-01T07:00', actualFinish: '2027-03-05T16:00', completion: 1,
  });
  eq('3b voltooide brontaak: overal de rekendatum', anchors(done, 'successor'),
    ['2027-03-01T07:00', '2027-03-01T07:00', '2027-03-05T16:00', '2027-03-05T16:00']);
}

// (4) "Bron vernieuwen" uit een echt bronbestand, met het voorbeeld uit het besluit.
{
  // Het bronproject van de installateur: Installatie (5 d) en Leidingwerk (15 d) gaan beide vooraf
  // aan Oplevering. Installatie start op maandag 1 maart en mag uiterlijk op maandag 15 maart starten.
  const src = createAppStoreContext().store;
  const s = () => src.getState();
  s().newProject();
  s().setProject({ startDate: '2027-03-01', name: 'Installateur' });
  const inst = s().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  const pipes = s().addTask({ name: 'Leidingwerk', time: createDefaultTaskTime('2027-03-01', 15, 'days') });
  const handover = s().addTask({ name: 'Oplevering', time: createDefaultTaskTime('2027-03-01', 1, 'days') });
  s().addSequence({ predecessorId: inst, successorId: handover, type: 'FINISH_START', lagDays: 0 });
  s().addSequence({ predecessorId: pipes, successorId: handover, type: 'FINISH_START', lagDays: 0 });
  s().runCPM();
  const sourceText = writeIFC(buildWriteIFCInput(s()));
  const sourcePath = '/projecten/installateur.ifc';
  const io: FormatIO = {
    readTextFile: async () => sourceText,
    readFile: async () => new TextEncoder().encode(sourceText),
  };
  const source = await readExternalSource(sourcePath, io);
  const installatie = source.tasks.find(task => task.name === 'Installatie')!;
  eq('4a de bron: Installatie gepland 1–5 maart, uiterlijk 15–19 maart',
    [installatie.time.earlyStart, installatie.time.earlyFinish, installatie.time.lateStart, installatie.time.lateFinish],
    ['2027-03-01T07:00', '2027-03-05T16:00', '2027-03-15T07:00', '2027-03-19T16:00']);

  // De eigen planning: Ruwbouw (20 d, 1–26 februari) en Afbouw (40 d) zonder onderlinge relatie, zodat
  // het projecteinde de speling van de ruwbouw niet begrenst.
  const own = createAppStoreContext().store;
  const o = () => own.getState();
  own.setState({ parseExternalSource: async () => readExternalSource(sourcePath, io) });
  o().newProject();
  o().setProject({ startDate: '2027-02-01' });
  const shell = o().addTask({ name: 'Ruwbouw', time: createDefaultTaskTime('2027-02-01', 20, 'days') });
  o().addTask({ name: 'Afbouw', time: createDefaultTaskTime('2027-02-01', 40, 'days') });
  const ref = { projectId: source.projectId, taskId: installatie.id, filePath: sourcePath };
  // Zo zette de app het anker vóór dit besluit: de geplande start van Installatie.
  o().updateTask(shell, {
    externalLinks: TYPES.map(relType => ({ ...link('successor', relType), sourceRef: ref,
      anchorDate: relType[1] === 'S' ? '2027-03-01T07:00' : '2027-03-05T16:00' }))
      .concat([{ ...link('predecessor', 'SS'), sourceRef: ref, anchorDate: '2027-02-01T07:00' }]),
  });
  o().runCPM();
  const shellTask = () => o().tasks.find(task => task.id === shell)!;
  eq('4b met het anker op de geplande start: 0 werkdagen speling', shellTask().time.totalFloat, 0);

  const result = await o().refreshExternalAnchorsFrom(sourcePath);
  eq('4c "Bron vernieuwen" vindt alle vijf koppelingen', result, { refreshed: 5, missing: 0 });
  eq('4d opvolger FS/SS/FF/SF en voorganger SS na verversen', shellTask().externalLinks!.map(l => [l.id, l.anchorDate]), [
    ['successor-FS', '2027-03-15T07:00'],
    ['successor-SS', '2027-03-15T07:00'],
    ['successor-FF', '2027-03-19T16:00'],
    ['successor-SF', '2027-03-19T16:00'],
    ['predecessor-SS', '2027-03-01T07:00'],
  ]);
  // Alleen de FS-opvolger begrenst nu de ruwbouw; de andere koppelingen gaan eraf.
  o().updateTask(shell, { externalLinks: shellTask().externalLinks!.filter(l => l.id === 'successor-FS') });
  o().runCPM();
  eq('4e met het anker op de laatst toelaatbare start: 10 werkdagen speling, laatste einde 12 maart',
    [shellTask().time.totalFloat, shellTask().time.lateFinish], [10, '2027-03-12T16:00']);
}

if (failures.length) {
  console.error(`XX external-successor-late: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-successor-late: ${checks}/${checks}`);
