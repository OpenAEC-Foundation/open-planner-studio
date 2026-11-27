import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { ImportResult } from '@/services/importTypes';
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

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>BaselineKloktijden</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  <ExtendedAttributes><ExtendedAttribute><FieldID>188743760</FieldID><FieldName>OPS_TaskDurationUnit</FieldName></ExtendedAttribute></ExtendedAttributes>
  <Tasks><Task><UID>1</UID><ID>1</ID><Name>ZestienUur</Name><OutlineLevel>1</OutlineLevel>
    <Duration>PT16H0M0S</Duration>
    <ExtendedAttribute><FieldID>188743760</FieldID><Value>hours</Value></ExtendedAttribute>
    <Baseline><Number>0</Number><Start>2026-03-02T13:00:00</Start><Finish>2026-03-02T15:00:00</Finish><Duration>PT2H0M0S</Duration></Baseline>
  </Task></Tasks></Project>`;

const r: ImportResult = readMSPDI(XML);
const task = r.tasks.find(t => t.name === 'ZestienUur');
const baseline = r.baselines?.find(b => b.id === r.activeBaselineId);
const bt = baseline?.tasks.find(t => t.taskId === task?.id);

eq('1 duureenheid uit de oude OPS_TaskDurationUnit-markering is hours', task?.time.durationUnit, 'hours');
eq('2 Baseline 0 houdt kloktijden (uurkalender gekozen via Baseline/Start en Baseline/Finish)', [bt?.start, bt?.finish],
  ['2026-03-02T13:00', '2026-03-02T15:00']);
eq('3 taakplanning net als op main: Start/Finish kunnen uit de baseline komen (knownbugs.md 2011)', [task?.time.scheduleStart, task?.time.scheduleFinish, task?.time.durationMinutes],
  ['2026-03-02T13:00', '2026-03-02T15:00', 960]);

const XML2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>KalenderSignaal</Name>
  <StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  <ExtendedAttributes><ExtendedAttribute><FieldID>188743760</FieldID><FieldName>OPS_TaskDurationUnit</FieldName></ExtendedAttribute></ExtendedAttributes>
  <Tasks>
    <Task><UID>1</UID><ID>1</ID><Name>A</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-03-02T08:00:00</Start><Finish>2026-03-02T08:00:00</Finish>
      <ExtendedAttribute><FieldID>188743760</FieldID><Value>hours</Value></ExtendedAttribute>
      <Baseline><Number>0</Number><Duration>PT2H0M0S</Duration></Baseline>
    </Task>
    <Task><UID>2</UID><ID>2</ID><Name>B</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-03-02T08:00:00</Start><Finish>2026-03-03T08:00:00</Finish><Duration>PT8H0M0S</Duration>
      <ExtendedAttribute><FieldID>188743760</FieldID><Value>hours</Value></ExtendedAttribute>
      <Baseline><Number>0</Number><Start>2026-03-02T09:00:00</Start><Finish>2026-03-02T11:00:00</Finish><Duration>PT2H0M0S</Duration></Baseline>
    </Task>
  </Tasks></Project>`;

const r2: ImportResult = readMSPDI(XML2);
const taskA = r2.tasks.find(t => t.name === 'A');
const taskB = r2.tasks.find(t => t.name === 'B');
const baseline2 = r2.baselines?.find(b => b.id === r2.activeBaselineId);
const bB = baseline2?.tasks.find(t => t.taskId === taskB?.id);

eq('4 taak B houdt baseline 09:00-11:00 (uurkalender via de baselineduur van taak A)', [bB?.start, bB?.finish],
  ['2026-03-02T09:00', '2026-03-02T11:00']);
eq('5 taak A zonder eigen duur leest de baselineduur net als op main (120 min)', taskA?.time.durationMinutes, 120);

const export2 = writeMSPDI(r2.project, r2.calendar, r2.tasks, r2.sequences, r2.resources, r2.assignments,
  r2.resourceCalendars ?? [], r2.baselines ?? [], r2.activeBaselineId ?? null);
const bBlocks = [...export2.matchAll(/<Baseline>\s*<Number>0<\/Number>[\s\S]*?<\/Baseline>/g)].map(m => m[0]);
const bBlock = bBlocks.find(b => b.includes('T09:00'));
eq('6 na herexport staat de baseline van B er nog 09:00-11:00', /<Start>([^<]*)<\/Start>\s*<Finish>([^<]*)<\/Finish>/.exec(bBlock ?? '')?.slice(1),
  ['2026-03-02T09:00:00', '2026-03-02T11:00:00']);

if (failures.length) {
  console.error(`XX mspdi-baseline-kloktijden: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-baseline-kloktijden: ${checks}/${checks}`);
