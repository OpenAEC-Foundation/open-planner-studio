import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { ImportResult } from '@/services/importTypes';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
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

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Geneste velden</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>${inner}</Project>`;

const task = (uid: number, name: string, extra = '', withDuration = true) => `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name>
  <OutlineLevel>1</OutlineLevel><Start>2026-03-02T08:00:00</Start><Finish>2026-03-03T17:00:00</Finish>${withDuration ? `
  <Duration>PT16H0M0S</Duration>` : ''}${extra}</Task>`;

const link = (predUid: number, type: number) => `<PredecessorLink><PredecessorUID>${predUid}</PredecessorUID>
  <Type>${type}</Type><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;

const baseline = (duration: string) => `<Baseline><Number>0</Number><Start>2026-03-09T08:00:00</Start>
  <Finish>2026-03-13T17:00:00</Finish><Duration>${duration}</Duration></Baseline>`;

const read = (tasksXml: string): ImportResult => readMSPDI(wrap(`<Tasks>${tasksXml}</Tasks>`));
const byName = (r: ImportResult, name: string) => r.tasks.find(t => t.name === name);

{
  const r = read(`${task(1, 'Voor')}${task(2, 'Na', link(1, 2))}`);
  eq('1a taak zonder eigen Type krijgt geen mspTaskType uit de link', byName(r, 'Na')?.mspTaskType, undefined);
  eq('1b de relatie leest haar Type uit haar eigen element', r.sequences.map(s => s.type), ['START_FINISH']);
}

{
  const r = read(`${task(1, 'Baseline-alleen', baseline('PT40H0M0S'), false)}`);
  const t = byName(r, 'Baseline-alleen');
  eq('2a taak zonder eigen Duration leest de duur net als op main (uit de baseline: 2400 min)', t?.time.durationMinutes, 2400);
  eq('2b idem voor de planningduur', t?.time.scheduleDuration, 4.444444444444445);
  eq('2c de baseline leest haar Duration uit haar eigen element', r.baselines?.[0]?.tasks[0]?.duration,
    hourTaskScheduleDuration(2400, r.calendar));
}

{
  const r = read(`${task(1, 'Voor', '<Type>1</Type>')}${task(2, 'Na', `<Type>1</Type>${link(1, 2)}${baseline('PT40H0M0S')}`)}`);
  eq('4a eigen Type op de taak wint van de link-Type', byName(r, 'Na')?.mspTaskType, 'FIXED_DURATION');
  eq('4b de relatie houdt haar eigen Type', r.sequences.map(s => s.type), ['START_FINISH']);
  eq('4c eigen Duration op de taak wint van de baseline-Duration', byName(r, 'Na')?.time.durationMinutes, 960);
  eq('4d de baseline houdt haar eigen Duration', r.baselines?.[0]?.tasks[0]?.duration,
    hourTaskScheduleDuration(2400, r.calendar));
}

{
  const r = readMSPDI(wrap(`<Tasks>${task(1, 'Werk', baseline('PT2H0M0S'), false)}</Tasks>
    <Resources><Resource><UID>1</UID><ID>1</ID><Name>Kraan</Name><Type>1</Type></Resource></Resources>
    <Assignments><Assignment><UID>1</UID><TaskUID>1</TaskUID><ResourceUID>1</ResourceUID><Units>1</Units><Work>PT1M</Work></Assignment></Assignments>`));
  const t = byName(r, 'Werk');
  const a = r.assignments.find(x => x.taskId === t?.id);
  eq('5a taak zonder eigen duur (alleen baselineduur) houdt expliciet positief toewijzingswerk', a?.plannedWorkMinutes, 1);
  const out = writeMSPDI(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments,
    r.resourceCalendars ?? [], r.baselines ?? [], r.activeBaselineId ?? null);
  eq('5b na herexport is <Work> één minuut (PT0H1M0S), niet PT0H0M0S', /<Work>([^<]*)<\/Work>/.exec(out)?.[1], 'PT0H1M0S');
}

{
  const r = readMSPDI(wrap(`<Tasks>${task(1, 'Werk3', baseline('PT2H0M0S'), false)}</Tasks>
    <Resources><Resource><UID>1</UID><ID>1</ID><Name>Kraan</Name><Type>1</Type></Resource></Resources>
    <Assignments><Assignment><UID>1</UID><TaskUID>1</TaskUID><ResourceUID>1</ResourceUID><ActualWork>PT1M</ActualWork><RemainingWork>PT0M</RemainingWork><Units>1</Units><Work>PT1M</Work></Assignment></Assignments>`));
  const t = byName(r, 'Werk3');
  const a = r.assignments.find(x => x.taskId === t?.id);
  eq('6a taak zonder eigen duur houdt alle drie de werkvelden (net als op main)', [a?.plannedWorkMinutes, a?.actualWorkMinutes, a?.remainingWorkMinutes], [1, 1, 0]);
  const out = writeMSPDI(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments,
    r.resourceCalendars ?? [], r.baselines ?? [], r.activeBaselineId ?? null);
  eq('6b na herexport staan Work, ActualWork en RemainingWork er alle drie',
    [/<Work>([^<]*)<\/Work>/.exec(out)?.[1], /<ActualWork>([^<]*)<\/ActualWork>/.exec(out)?.[1], /<RemainingWork>([^<]*)<\/RemainingWork>/.exec(out)?.[1]],
    ['PT0H1M0S', 'PT0H1M0S', 'PT0H0M0S']);
}

if (failures.length) {
  console.error(`XX mspdi-geneste-velden: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-geneste-velden: ${checks}/${checks}`);
