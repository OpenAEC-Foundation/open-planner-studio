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
import { externalSourceFromImport, readExternalSource } from '@/state/externalSource';
import { createAppStoreContext } from '@/state/appStore';
import { refreshExternalAnchors, sourceAnchorDate } from '@/engine/externalLinks';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readIFC } from '@/services/ifc/ifcReader';
import { IFC_TASKTIME_SLOTS, TASKTIME_SLOT } from '@/services/ifc/ifcTaskSlots';
import { taskArgs } from '../fixtures/recordedDatesIfc';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { computedFinish, computedStart } from '@/utils/taskDates';
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

/** Leest `text` als bron via het laadpad van de app (`readExternalSource`), vanaf `path`. */
const memorySource = (path: string, text: string) => readExternalSource(path, {
  readTextFile: async () => text,
  readFile: async () => new TextEncoder().encode(text),
});
/** Eigen planning: Ruwbouw (20 d) en Afbouw (40 d, begrenst het projecteinde niet), met de
 *  koppelingen `links` op de ruwbouw. Ververst uit `path` en rekent; geeft de ruwbouw terug. */
async function refreshShell(path: string, text: string, links: ExternalLink[]) {
  const own = createAppStoreContext().store;
  const o = () => own.getState();
  own.setState({ parseExternalSource: async () => memorySource(path, text) });
  o().newProject();
  o().setProject({ startDate: '2027-02-01' });
  const shell = o().addTask({ name: 'Ruwbouw', time: createDefaultTaskTime('2027-02-01', 20, 'days') });
  o().addTask({ name: 'Afbouw', time: createDefaultTaskTime('2027-02-01', 40, 'days') });
  o().updateTask(shell, { externalLinks: links });
  const result = await o().refreshExternalAnchorsFrom(path);
  o().runCPM();
  const task = o().tasks.find(t => t.id === shell)!;
  return { result, task, anchors: Object.fromEntries(task.externalLinks!.map(l => [l.id, l.anchorDate])) };
}

// (5) Review #794 ronde 1, punt 1: een bronbestand ZONDER late datums, via het laadpad van de app.
// Het laadpad rekent de bron door, dus de brontaak heeft daarna wél late datums. Die komen dan uit
// onze berekening, niet uit het bestand; het anker moet de vroege datum blijven (het besluit).
// Bron: een IFC uit een ander pakket (vaste id's, dus "Bron vernieuwen" vindt de taak terug), met
// Installatie 1–5 maart en een langere Leidingwerk 1–19 maart, beide vóór Oplevering op 22 maart.
// De datums kloppen met de berekening, dus de bron opent niet in "datums zoals opgeslagen".
// (Een MSPDI-bron kan dit niet tonen: die lezer geeft bij elk inlezen nieuwe taak-id's, knownbug 837.)
{
  const tt = (o: { start: string; finish: string; days: number; lateStart?: string; lateFinish?: string }) => {
    const a: string[] = new Array(IFC_TASKTIME_SLOTS.length).fill('$');
    a[TASKTIME_SLOT.name] = "'T'";
    a[TASKTIME_SLOT.dataOrigin] = '.PREDICTED.';
    a[TASKTIME_SLOT.durationType] = '.WORKTIME.';
    a[TASKTIME_SLOT.scheduleDuration] = `'P${o.days}D'`;
    a[TASKTIME_SLOT.scheduleStart] = `'${o.start}'`;
    a[TASKTIME_SLOT.scheduleFinish] = `'${o.finish}'`;
    a[TASKTIME_SLOT.earlyStart] = `'${o.start}'`;
    a[TASKTIME_SLOT.earlyFinish] = `'${o.finish}'`;
    if (o.lateStart) a[TASKTIME_SLOT.lateStart] = `'${o.lateStart}'`;
    if (o.lateFinish) a[TASKTIME_SLOT.lateFinish] = `'${o.lateFinish}'`;
    return a.join(',');
  };
  const foreignIfc = (late: { start: boolean; finish: boolean }) => {
    const rows = [
      { n: 2, name: 'Installatie', start: '2027-03-01', finish: '2027-03-05', days: 5, ls: '2027-03-15', lf: '2027-03-19' },
      { n: 3, name: 'Leidingwerk', start: '2027-03-01', finish: '2027-03-19', days: 15, ls: '2027-03-01', lf: '2027-03-19' },
      { n: 4, name: 'Oplevering', start: '2027-03-22', finish: '2027-03-22', days: 1, ls: '2027-03-22', lf: '2027-03-22' },
    ];
    return [
      'ISO-10303-21;', 'HEADER;', "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');", 'ENDSEC;', 'DATA;',
      "#1=IFCPROJECT('gInstProj',$,'Installateur',$,$,$,$,$,$);",
      ...rows.flatMap(r => [
        `#${r.n + 10}=IFCTASKTIME(${tt({ start: r.start, finish: r.finish, days: r.days,
          ...(late.start ? { lateStart: r.ls } : {}), ...(late.finish ? { lateFinish: r.lf } : {}) })});`,
        `#${r.n}=IFCTASK(${taskArgs({ guid: `gInst${r.n}`, name: r.name, wbs: `1.${r.n}`, taskTimeRef: `#${r.n + 10}` })});`,
      ]),
      "#20=IFCRELSEQUENCE('gSeqA',$,$,$,#2,#4,$,.FINISH_START.,$);",
      "#21=IFCRELSEQUENCE('gSeqB',$,$,$,#3,#4,$,.FINISH_START.,$);",
      'ENDSEC;', 'END-ISO-10303-21;',
    ].join('\n');
  };
  const path = '/projecten/installateur-extern.ifc';
  const run = async (late: { start: boolean; finish: boolean }) => {
    const text = foreignIfc(late);
    const source = await memorySource(path, text);
    const inst = source.tasks.find(t => t.name === 'Installatie')!;
    const ref = { projectId: source.projectId, taskId: inst.id, filePath: path };
    const links = TYPES.map(relType => ({ ...link('successor', relType), sourceRef: ref }));
    return { inst, ...(await refreshShell(path, text, links)) };
  };

  const none = await run({ start: false, finish: false });
  eq('5a zonder late datums in het bestand rekent het laadpad ze toch uit (de val)',
    [none.inst.time.lateStart, none.inst.time.lateFinish], ['2027-03-15T07:00', '2027-03-19T16:00']);
  eq('5b "Bron vernieuwen": vier koppelingen gevonden', none.result, { refreshed: 4, missing: 0 });
  eq('5c zonder late datums in het bestand: opvolger FS/SS/FF/SF op de vroege datum', none.anchors, {
    'successor-FS': '2027-03-01T07:00', 'successor-SS': '2027-03-01T07:00',
    'successor-FF': '2027-03-05T16:00', 'successor-SF': '2027-03-05T16:00',
  });
  eq('5d ...en de ruwbouw (alleen de FS-grens telt hier) krijgt 0 werkdagen speling, niet 10',
    none.task.time.totalFloat, 0);

  const both = await run({ start: true, finish: true });
  eq('5e met late datums in het bestand: de late datums', both.anchors, {
    'successor-FS': '2027-03-15T07:00', 'successor-SS': '2027-03-15T07:00',
    'successor-FF': '2027-03-19T16:00', 'successor-SF': '2027-03-19T16:00',
  });
  eq('5f ...en de ruwbouw krijgt 10 werkdagen speling', both.task.time.totalFloat, 10);
  const onlyStart = await run({ start: true, finish: false });
  eq('5g alleen een late start in het bestand: FS/SS laat, FF/SF vroeg', onlyStart.anchors, {
    'successor-FS': '2027-03-15T07:00', 'successor-SS': '2027-03-15T07:00',
    'successor-FF': '2027-03-05T16:00', 'successor-SF': '2027-03-05T16:00',
  });

  // Het andere kanaal (`recordedTimes`: XER, P6 XML, MSPDI, `.mpp`, CSV) volgt dezelfde regel: een
  // ontbrekende late as in de vastlegging ⇒ de vroege datum.
  const viaTimes = (record: Record<string, string>) => {
    const parsed = readIFC(foreignIfc({ start: false, finish: false }));
    const instId = parsed.tasks.find(t => t.name === 'Installatie')!.id;
    const source = externalSourceFromImport({ ...parsed, recordedTimes: { [instId]: { start: '2027-03-01', finish: '2027-03-05', ...record } } }, path);
    const inst = source.tasks.find(t => t.name === 'Installatie')!;
    return [sourceAnchorDate(link('successor', 'FS'), inst, source), sourceAnchorDate(link('successor', 'FF'), inst, source)];
  };
  eq('5h vastlegging zonder late as: FS/FF vroeg', viaTimes({}), ['2027-03-01T07:00', '2027-03-05T16:00']);
  eq('5i vastlegging met late as: FS/FF laat', viaTimes({ lateStart: '2027-03-15', lateFinish: '2027-03-19' }),
    ['2027-03-15T07:00', '2027-03-19T16:00']);
}

// (6) Review #794 ronde 1, punt 2: een FASE in de bron telt voortgang zoals een bladtaak.
// Fase A met één voltooid kind (Installatie, werkelijk 1–5 maart); fase B met één gestart kind
// (Montage, werkelijk gestart op 1 maart). Een langere Leidingwerk geeft beide fasen een late start
// ná hun vroege start.
{
  const src = createAppStoreContext().store;
  const s = () => src.getState();
  s().newProject();
  s().setProject({ startDate: '2027-03-01', statusDate: '2027-03-08', name: 'Installateur' });
  const phaseA = s().addTask({ name: 'Fase A' });
  const inst = s().addTask({ name: 'Installatie', parentId: phaseA, time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  const phaseB = s().addTask({ name: 'Fase B' });
  const mount = s().addTask({ name: 'Montage', parentId: phaseB, time: createDefaultTaskTime('2027-03-01', 5, 'days') });
  const pipes = s().addTask({ name: 'Leidingwerk', time: createDefaultTaskTime('2027-03-01', 15, 'days') });
  const handover = s().addTask({ name: 'Oplevering', time: createDefaultTaskTime('2027-03-01', 1, 'days') });
  for (const pred of [inst, mount, pipes]) s().addSequence({ predecessorId: pred, successorId: handover, type: 'FINISH_START', lagDays: 0 });
  const timeOf = (id: string) => s().tasks.find(t => t.id === id)!.time;
  s().updateTask(inst, { time: { ...timeOf(inst), actualStart: '2027-03-01T07:00', actualFinish: '2027-03-05T16:00', completion: 1 } });
  s().updateTask(mount, { time: { ...timeOf(mount), actualStart: '2027-03-01T07:00', completion: 0.4 } });
  s().runCPM();
  const text = writeIFC(buildWriteIFCInput(s()));
  const path = '/projecten/installateur-fasen.ifc';
  const source = await memorySource(path, text);
  const byName = (name: string) => source.tasks.find(t => t.name === name)!;
  const [a, b, child] = [byName('Fase A'), byName('Fase B'), byName('Installatie')];
  eq('6a de bron: fase A klaar, fase B gestart, en beide fasen met een late start ná de vroege',
    [a.time.completion, a.time.actualFinish, b.time.actualStart, a.time.lateStart > computedStart(a), b.time.lateStart > computedStart(b)],
    [1, '2027-03-05T16:00', '2027-03-01T07:00', true, true]);
  const to = (task: Task, relType: ExternalLink['relType'], id: string): ExternalLink => ({
    ...link('successor', relType), id, sourceRef: { projectId: source.projectId, taskId: task.id, filePath: path },
  });
  const { anchors } = await refreshShell(path, text, [
    to(child, 'FS', 'kind-FS'), to(child, 'FF', 'kind-FF'),
    to(a, 'FS', 'faseA-FS'), to(a, 'FF', 'faseA-FF'),
    to(b, 'FS', 'faseB-FS'), to(b, 'FF', 'faseB-FF'),
  ]);
  eq('6b voltooid kind en fase A: dezelfde ankers, de werkelijke datums', [
    anchors['kind-FS'], anchors['faseA-FS'], anchors['kind-FF'], anchors['faseA-FF'],
  ], ['2027-03-01T07:00', '2027-03-01T07:00', '2027-03-05T16:00', '2027-03-05T16:00']);
  eq('6c gestarte fase B: FS op de rekendatum van de start, FF op de late finish',
    [anchors['faseB-FS'], anchors['faseB-FF']], [computedStart(b), b.time.lateFinish]);

  // Het kanaal `recordedTimes` (XER, P6 XML, MSPDI, `.mpp`, CSV) bewaart alleen bladtaken
  // (`leafRecordedTimes`). Een fase telt een late as dan als al haar bladen hem droegen.
  const parsed = readIFC(text);
  const montageId = parsed.tasks.find(t => t.name === 'Montage')!.id;
  const phaseFF = (record: Record<string, string>) => {
    const viaTimes = externalSourceFromImport(
      { ...parsed, recordedTimes: { [montageId]: { start: '2027-03-01', finish: '2027-03-05', ...record } } }, path);
    const phase = viaTimes.tasks.find(t => t.name === 'Fase B')!;
    return [sourceAnchorDate(link('successor', 'FF'), phase, viaTimes), phase.time.lateFinish, computedFinish(phase)];
  };
  const [withLate, lateFinish] = phaseFF({ lateStart: '2027-03-15', lateFinish: '2027-03-19' });
  eq('6d fase B, haar blad droeg een late finish: FF op de late finish van de fase', withLate, lateFinish);
  const [withoutLate, , earlyFinish] = phaseFF({});
  eq('6e fase B, haar blad droeg geen late finish: FF op de vroege finish van de fase', withoutLate, earlyFinish);
}

if (failures.length) {
  console.error(`XX external-successor-late: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-successor-late: ${checks}/${checks}`);
