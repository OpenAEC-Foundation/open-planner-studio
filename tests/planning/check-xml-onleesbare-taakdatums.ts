// Knownbugs 153/154: onleesbare taakdatums mogen MSPDI/P6 XML niet laten crashen.
// Vergelijk ieder veld met hetzelfde bestand waarin alleen die datum ontbreekt. Een aparte,
// geldige taak houdt de uurkalender actief, ook als de onderzochte start/finish onleesbaar is.
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import type { ImportResult } from '@/services/importTypes';
import { installDOMParser } from './xmldom-shim';

installDOMParser();
let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

type Format = 'mspdi' | 'p6xml';
const fields = {
  mspdi: ['Start', 'Finish', 'ActualStart', 'ActualFinish', 'ConstraintDate', 'Deadline',
    'EarlyStart', 'EarlyFinish', 'LateStart', 'LateFinish'],
  p6xml: ['PlannedStartDate', 'PlannedFinishDate', 'ActualStartDate', 'ActualFinishDate',
    'PrimaryConstraintDate', 'SecondaryConstraintDate', 'EarlyStartDate', 'EarlyFinishDate',
    'StartDate', 'FinishDate', 'LateStartDate', 'LateFinishDate'],
} satisfies Record<Format, string[]>;

function fixture(format: Format, hour: boolean, changed: string, value: string, completion = 0): string {
  const start = `2015-01-07T${hour ? '09:00' : '08:00'}:00`;
  const finish = `2015-01-07T${hour ? '12:00' : '08:00'}:00`;
  const date = (tag: string, raw: string) => `<${tag}>${tag === changed ? value : raw}</${tag}>`;
  if (format === 'mspdi') {
    return `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project">
      <Name>Onleesbare datums</Name><StartDate>2015-01-05T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
      <Tasks><Task><UID>1</UID><ID>1</ID><Name>Onderzocht</Name><OutlineLevel>1</OutlineLevel>
        <Duration>${hour ? 'PT3H0M0S' : 'PT8H0M0S'}</Duration><PercentComplete>${completion}</PercentComplete>
        ${date('Start', start)}${date('Finish', finish)}${date('ActualStart', '')}${date('ActualFinish', '')}
        <ConstraintType>4</ConstraintType>${date('ConstraintDate', start)}${date('Deadline', finish)}
        ${date('EarlyStart', start)}${date('EarlyFinish', finish)}${date('LateStart', start)}${date('LateFinish', finish)}
      </Task><Task><UID>2</UID><ID>2</ID><Name>Modusanker</Name><OutlineLevel>1</OutlineLevel>
        <Duration>${hour ? 'PT3H0M0S' : 'PT8H0M0S'}</Duration><Start>${start}</Start><Finish>${finish}</Finish>
      </Task></Tasks></Project>`;
  }
  return `<?xml version="1.0"?><APIBusinessObjects><Project><ObjectId>1</ObjectId><Id>P</Id>
    <Name>Onleesbare datums</Name><PlannedStartDate>2015-01-05T08:00:00</PlannedStartDate>
    <Activity><ObjectId>1</ObjectId><Id>A</Id><Name>Onderzocht</Name><Type>Task Dependent</Type>
      <PlannedDuration>${hour ? 3 : 8}</PlannedDuration><Status>In Progress</Status>
      <PercentCompleteType>Physical</PercentCompleteType><PhysicalPercentComplete>${completion / 100}</PhysicalPercentComplete>
      ${date('PlannedStartDate', start)}${date('PlannedFinishDate', finish)}
      ${date('ActualStartDate', '')}${date('ActualFinishDate', '')}
      <PrimaryConstraintType>Start On or After</PrimaryConstraintType>${date('PrimaryConstraintDate', start)}
      <SecondaryConstraintType>Finish On or Before</SecondaryConstraintType>${date('SecondaryConstraintDate', finish)}
      ${date('EarlyStartDate', start)}${date('EarlyFinishDate', finish)}
      ${date('StartDate', start)}${date('FinishDate', finish)}${date('LateStartDate', start)}${date('LateFinishDate', finish)}
    </Activity><Activity><ObjectId>2</ObjectId><Id>B</Id><Name>Modusanker</Name><Type>Task Dependent</Type>
      <PlannedDuration>${hour ? 3 : 8}</PlannedDuration><PlannedStartDate>${start}</PlannedStartDate>
      <PlannedFinishDate>${finish}</PlannedFinishDate>
    </Activity></Project></APIBusinessObjects>`;
}

function snapshot(r: ImportResult): unknown {
  return {
    projectStart: r.project.startDate,
    tasks: r.tasks.map(t => ({ name: t.name, status: t.status, time: t.time, constraint: t.constraint,
      constraint2: t.constraint2, deadline: t.deadline, recorded: r.recordedTimes?.[t.id] })),
  };
}

for (const format of ['mspdi', 'p6xml'] as const) {
  const read = format === 'mspdi' ? readMSPDI : readP6XML;
  for (const hour of [false, true]) {
    const tag = `${format}/${hour ? 'uur' : 'dag'}`;
    const valid = read(fixture(format, hour, '', ''));
    eq(`${tag}: T15 maakt ongemarkeerde taken altijd urenmaat`, valid.tasks.map(t => t.time.durationUnit),
      ['hours', 'hours']);
    eq(`${tag}: geldige geplande datums blijven exact`,
      [valid.tasks[0]?.time.scheduleStart, valid.tasks[0]?.time.scheduleFinish],
      hour ? ['2015-01-07T09:00', '2015-01-07T12:00'] : ['2015-01-07', '2015-01-07']);
    for (const field of fields[format]) {
      const reference = snapshot(read(fixture(format, hour, field, '')));
      for (const raw of ['NA', 'onleesbaar', '2015-13-07T09:00:00', '2015-01-07T25:00:00']) {
        const label = `${tag}/${field}/${raw}`;
        try {
          eq(`${label}: gelijk aan ontbrekend veld`, snapshot(read(fixture(format, hour, field, raw))), reference);
        } catch (error) {
          checks++;
          failures.push(`${label}: import gooit ${String(error)}`);
        }
      }
    }
    // Zonder leesbare plandatums of rekenuitvoer krijgt alleen de invoer haar gewone terugval.
    // Die afleiding mag niet als oorspronkelijke uitvoer in "Datums zoals opgeslagen" belanden.
    const absent = fixture(format, hour, '', '').replace(/<(Task|Activity)>[\s\S]*?<\/\1>/g,
      block => block.replace(
        /<(Start|Finish|PlannedStartDate|PlannedFinishDate|EarlyStart|EarlyFinish|LateStart|LateFinish|EarlyStartDate|EarlyFinishDate|StartDate|FinishDate|LateStartDate|LateFinishDate)>[^<]*<\/\1>/g,
        '<$1></$1>',
      ));
    const noSource = read(absent);
    eq(`${tag}: ontbrekende start gebruikt projectanker`, noSource.tasks[0]?.time.scheduleStart, '2015-01-05');
    eq(`${tag}: afgeleide datums worden geen bronuitvoer`, noSource.recordedTimes?.[noSource.tasks[0]!.id], undefined);
    // Ook met voortgang moeten onleesbare actuals dezelfde invarianten volgen als ontbrekende.
    const actuals = format === 'mspdi' ? ['ActualStart', 'ActualFinish'] : ['ActualStartDate', 'ActualFinishDate'];
    for (const completion of [50, 100]) {
      for (const field of actuals) {
        const label = `${tag}/${field}/${completion}%`;
        try {
          eq(label, snapshot(read(fixture(format, hour, field, 'NA', completion))),
            snapshot(read(fixture(format, hour, field, '', completion))));
        } catch (error) {
          checks++;
          failures.push(`${label}: import gooit ${String(error)}`);
        }
      }
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.log(`XX  xml-onleesbare-taakdatums: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK  xml-onleesbare-taakdatums: ${checks} controles groen`);
}
