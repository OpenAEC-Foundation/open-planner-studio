import { readMSPDI } from '@/services/msproject/mspdiReader';
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

if (failures.length) {
  console.error(`XX mspdi-baseline-kloktijden: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK mspdi-baseline-kloktijden: ${checks}/${checks}`);
