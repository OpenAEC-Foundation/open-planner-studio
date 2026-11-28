import { readFileSync } from 'node:fs';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML, writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { exportP6TruncatedNotice } from '@/state/slices/fileSlice';
import type { ImportResult } from '@/services/importTypes';
import type { Sequence } from '@/types/sequence';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

function write(r: ImportResult): string {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return writeP6XML(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.resourceCalendars ?? [], r.customTaskTypes ?? []);
  } finally { console.warn = warn; }
}

const src = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
const halfHour = { start: 450, end: 720 };
const afternoon = { start: 750, end: 960 };
src.calendar.workTime = { byWeekday: { 1: [halfHour, afternoon], 2: [halfHour, afternoon], 3: [halfHour, afternoon], 4: [halfHour, afternoon], 5: [halfHour, afternoon], 6: [], 7: [] } };
src.calendar.holidays = [{ name: 'Bouwvak', startDate: '2026-07-27', endDate: '2026-07-29' }];
src.calendar.workingExceptions = [{ name: 'Zaterdag', startDate: '2026-05-09', endDate: '2026-05-09', bands: [{ start: 480, end: 750 }] }];
const b1010 = src.tasks.find(t => t.wbsCode === 'B1010')!;
b1010.description = 'Balken storten <let op> & controleren';
b1010.time.durationUnit = 'hours';
const dayTask = src.tasks.find(t => t.childIds.length === 0 && t !== b1010)!;
dayTask.time.durationUnit = 'days';
const ss = src.sequences[0] as Sequence;
ss.type = 'START_START';
const xml = write(src);

const projectBlock = /<Project>([\s\S]*)<\/Project>/.exec(xml)?.[1] ?? '';
const outside = xml.replace(/<Project>[\s\S]*<\/Project>/, '');
for (const tag of ['WBS', 'Activity', 'Relationship', 'ResourceAssignment', 'ActivityNote']) {
  eq(`1 <${tag}> alleen binnen <Project>`, [projectBlock.includes(`<${tag}>`), outside.includes(`<${tag}>`)], [true, false]);
}
eq('1 geen losse <UDFValue> meer', xml.includes('<UDFValue>'), false);

eq('2a <StandardWorkHours> (meervoud), nooit enkelvoud', [xml.includes('<StandardWorkHours>'), /<StandardWorkHour>/.test(xml)], [true, false]);
eq('2b eindtijd = laatste minuut (16:00 ⇒ 15:59:00)', xml.includes('<Finish>15:59:00</Finish>') && !xml.includes('<Finish>16:00:00</Finish>'), true);
eq('2c niet-werkdag: <WorkTime xsi:nil="true" />', /<DayOfWeek>Saturday<\/DayOfWeek>\s*<WorkTime xsi:nil="true" \/>/.test(xml), true);

const exceptionDates = [...xml.matchAll(/<HolidayOrException>\s*<Date>([^<]+)<\/Date>/g)].map(m => m[1].slice(0, 10));
eq('3a één element per datum (bouwvak = 3 dagen + 1 werkende zaterdag)', exceptionDates, ['2026-05-09', '2026-07-27', '2026-07-28', '2026-07-29']);
eq('3b geen <Name>/<FinishDate> in een uitzondering', /<HolidayOrException>[\s\S]*?(<Name>|<FinishDate>)[\s\S]*?<\/HolidayOrException>/.test(xml), false);

const act = (code: string) => {
  const at = xml.indexOf(`<Id>${code}</Id>`);
  return xml.slice(xml.lastIndexOf('<Activity>', at), xml.indexOf('</Activity>', at));
};
eq('4a PercentCompleteType + fractie', [act('B1010').includes('<PercentCompleteType>Physical</PercentCompleteType>'), /<PhysicalPercentComplete>0\.5<\/PhysicalPercentComplete>/.test(act('B1010'))], [true, true]);
eq('4b status volgt de voortgang', /<Status>In Progress<\/Status>/.test(act('B1010')), true);
eq('4c relatietype als label', xml.includes('<Type>Start to Start</Type>') && !xml.includes('PR_'), true);
eq('4d UDF-waarde in de activiteit', /<UDF>\s*<TypeObjectId>1<\/TypeObjectId>\s*<TextValue>(days|hours)<\/TextValue>\s*<\/UDF>/.test(act('B1010')), true);
eq('4e beschrijving als <ActivityNote>, geen <Description> op de activiteit', [xml.includes('<ActivityNote>'), act('B1010').includes('<Description>')], [true, false]);

const ACTIVITY_ORDER = ['ActualFinishDate', 'ActualStartDate', 'CalendarObjectId', 'DurationType', 'Id', 'Name', 'ObjectId',
  'PercentCompleteType', 'PhysicalPercentComplete', 'PlannedDuration', 'PlannedFinishDate', 'PlannedStartDate',
  'PrimaryConstraintDate', 'PrimaryConstraintType', 'ProjectObjectId', 'RemainingDuration', 'SecondaryConstraintDate',
  'SecondaryConstraintType', 'Status', 'Type', 'WBSObjectId', 'UDF'];
for (const block of xml.match(/<Activity>[\s\S]*?<\/Activity>/g) ?? []) {
  const tags = [...block.replace(/<UDF>[\s\S]*?<\/UDF>/g, '<UDF></UDF>').matchAll(/^\s{6}<(\w+)/gm)].map(m => m[1]);
  const ranks = tags.map(t => ACTIVITY_ORDER.indexOf(t));
  eq(`5 Activity-volgorde (${tags.join(',')})`, ranks.every((r, i) => r >= 0 && (i === 0 || r >= ranks[i - 1])), true);
}

const back = readP6XML(xml);
eq('6a aantallen', [back.tasks.length, back.sequences.length, back.assignments.length, back.resources.length],
  [src.tasks.length, src.sequences.length, src.assignments.length, src.resources.length]);
eq('6b werkbanden (halve uren) exact terug', back.calendar.workTime?.byWeekday[1], [halfHour, afternoon]);
eq('6c bouwvak komt terug als één reeks (naam gaat verloren: P6 kent er geen)', back.calendar.holidays.map(h => [h.name, h.startDate, h.endDate]), [['Holiday', '2026-07-27', '2026-07-29']]);
eq('6d werkende uitzondering met banden terug', (back.calendar.workingExceptions ?? []).map(w => [w.startDate, w.bands]), [['2026-05-09', [{ start: 480, end: 750 }]]]);
eq('6e voortgang terug', back.tasks.find(t => t.wbsCode === 'B1010')?.time.completion, 0.5);
eq('6f relatietype terug', back.sequences.map(s => s.type).sort(), src.sequences.map(s => s.type).sort());
eq('6g beschrijving terug (ge-escapete tekens)', back.tasks.find(t => t.wbsCode === 'B1010')?.description, 'Balken storten <let op> & controleren');
eq('6j duureenheid (UDF in de activiteit) terug', [back.tasks.find(t => t.wbsCode === 'B1010')?.time.durationUnit, back.tasks.find(t => t.wbsCode === dayTask.wbsCode)?.time.durationUnit], ['hours', 'days']);
eq('6h taakkalenders terug', back.tasks.filter(t => t.calendarId).length, src.tasks.filter(t => t.calendarId).length);
const maskIds = (x: string) => x.replace(/<Id>[^<]*-[a-z0-9]{10,}<\/Id>/g, '<Id>*</Id>');
const second = maskIds(write(back));
const third = maskIds(write(readP6XML(write(back))));
if (second !== third) {
  const a = second.split('\n'), b = third.split('\n');
  const i = a.findIndex((l, k) => l !== b[k]);
  console.log(`diff r.${i}: ${a.slice(i - 3, i + 3).join(' | ')} <> ${b.slice(i - 3, i + 3).join(' | ')}`);
}
eq('6i tweede ronde schrijft hetzelfde bestand', second === third, true);

const legacy = `<?xml version="1.0"?><APIBusinessObjects>
  <Project><ObjectId>1</ObjectId><Name>Oud</Name><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate></Project>
  <UDFType><ObjectId>1</ObjectId><SubjectArea>Activity</SubjectArea><Title>OPS_TaskDurationUnit</Title><DataType>Text</DataType></UDFType>
  <Calendar><ObjectId>1</ObjectId><Name>Oud</Name><Type>Global</Type><HoursPerDay>8</HoursPerDay>
    <StandardWorkWeek><StandardWorkHour><DayOfWeek>Monday</DayOfWeek><WorkTime><Start>08:00:00</Start><Finish>16:30:00</Finish></WorkTime></StandardWorkHour></StandardWorkWeek></Calendar>
  <Activity><ObjectId>1</ObjectId><Id>A</Id><Name>A</Name><ProjectObjectId>1</ProjectObjectId><Status>Not Started</Status>
    <PlannedDuration>16</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-03T17:00:00</PlannedFinishDate>
    <PhysicalPercentComplete>1</PhysicalPercentComplete><ActualStartDate>2026-03-02T08:00:00</ActualStartDate><Description>Oude beschrijving</Description></Activity>
  <Activity><ObjectId>2</ObjectId><Id>B</Id><Name>B</Name><ProjectObjectId>1</ProjectObjectId>
    <PlannedDuration>8</PlannedDuration><PlannedStartDate>2026-03-04T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-04T17:00:00</PlannedFinishDate></Activity>
  <UDFValue><ProjectObjectId>1</ProjectObjectId><ForeignObjectId>2</ForeignObjectId><UDFTypeObjectId>1</UDFTypeObjectId><Text>hours</Text></UDFValue>
  <Relationship><ObjectId>1</ObjectId><PredecessorActivityObjectId>1</PredecessorActivityObjectId><SuccessorActivityObjectId>2</SuccessorActivityObjectId><Type>PR_SS</Type><Lag>0</Lag><ProjectObjectId>1</ProjectObjectId></Relationship>
</APIBusinessObjects>`;
const old = readP6XML(legacy);
eq('7a oud: taken en relatie', [old.tasks.length, old.sequences[0]?.type], [2, 'START_START']);
eq('7b oud: exacte eindtijd (16:30 blijft 16:30 in de enkelvoudsvorm van een OPS-export)', old.calendar.workTime?.byWeekday[1], [{ start: 480, end: 990 }]);
eq('7c oud: procent 1 = 1 % (niet 100 %)', old.tasks.find(t => t.wbsCode === 'A')?.time.completion, 0.01);
eq('7d oud: losse UDFValue (urentaak)', old.tasks.find(t => t.wbsCode === 'B')?.time.durationUnit, 'hours');
eq('7e oud: <Description>', old.tasks.find(t => t.wbsCode === 'A')?.description, 'Oude beschrijving');

{
  const big = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
  const leaf = big.tasks.find(t => t.childIds.length === 0)!;
  const wbs = big.tasks.find(t => t.childIds.length > 0)!;
  leaf.name = 'N'.repeat(130);
  leaf.wbsCode = 'C'.repeat(45);
  wbs.name = 'W'.repeat(110);
  big.project.name = 'P'.repeat(105);
  const out = write(big);
  eq('8a activiteitnaam ingekort tot 120', out.includes(`<Name>${'N'.repeat(120)}</Name>`) && !out.includes('N'.repeat(121)), true);
  eq('8b activiteit-Id ingekort tot 40', out.includes(`<Id>${'C'.repeat(40)}</Id>`) && !out.includes('C'.repeat(41)), true);
  eq('8c WBS-naam ingekort tot 100', out.includes(`<Name>${'W'.repeat(100)}</Name>`) && !out.includes('W'.repeat(101)), true);
  eq('8d projectnaam ingekort tot 100', out.includes(`<Name>${'P'.repeat(100)}</Name>`) && !out.includes('P'.repeat(101)), true);
  const counted = (r: ImportResult) => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      return writeP6XMLWithReport(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.resourceCalendars ?? [], r.customTaskTypes ?? []).truncated;
    } finally { console.warn = warn; }
  };
  eq('8e telling = 4 (de render telt zelf)', counted(big), 4);
  eq('8f melding alleen bij P6-export', [exportP6TruncatedNotice('p6', 4)?.params, exportP6TruncatedNotice('mspdi', 4), exportP6TruncatedNotice('p6', 0)],
    [{ count: 4 }, null, null]);
  eq('8g geen telling bij korte namen', counted(src), 0);
  const emptyWbs = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
  const summary = emptyWbs.tasks.find(t => t.childIds.length > 0)!;
  const lonely = { ...structuredClone(summary), id: 'wbs-leeg', isSummary: true, childIds: [], name: 'L'.repeat(110), wbsCode: 'LEEG', parentId: null };
  emptyWbs.tasks.push(lonely);
  const lonelyXml = write(emptyWbs);
  eq('8h lege WBS-regel gaat als WBS, naam tot 100, telling 1', [/<WBS>\s*<Code>LEEG<\/Code>\s*<Name>L{100}<\/Name>/.test(lonelyXml), counted(emptyWbs)], [true, 1]);
  const clash = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
  const leaves2 = clash.tasks.filter(t => t.childIds.length === 0);
  leaves2[0].wbsCode = `${'X'.repeat(40)}-1`;
  leaves2[1].wbsCode = `${'X'.repeat(40)}-2`;
  leaves2[2].wbsCode = 'X'.repeat(40);
  const clashXml = write(clash);
  const actIds = [...clashXml.matchAll(/<Activity>[\s\S]*?<Id>([^<]*)<\/Id>/g)].map(m => m[1]);
  const xIds = actIds.filter(id => id.startsWith('XXXX'));
  eq('8j unieke activiteit-Id\'s na inkorten, ≤ 40 tekens', [xIds.length, new Set(xIds).size, xIds.every(id => id.length <= 40)], [3, 3, true]);
  eq('8k volgnummer als achtervoegsel', xIds.filter(id => /-\d+$/.test(id)).sort(), [`${'X'.repeat(38)}-2`, `${'X'.repeat(38)}-3`]);
  eq('8l telling = 2 (beide ingekort)', counted(clash), 2);
}

{
  const types = [...xml.matchAll(/<Calendar>[\s\S]*?<Name>([^<]*)<\/Name>[\s\S]*?<Type>([^<]*)<\/Type>/g)].map(m => [m[1], m[2]]);
  const taskCalNames = new Set(src.tasks.map(t => t.calendarId).filter(Boolean).map(id => (src.resourceCalendars ?? []).find(c => c.id === id)?.name));
  eq('9a taakkalender = Global, de rest Resource (behalve de projectkalender)',
    types.every(([name, type]) => name === src.calendar.name ? type === 'Global' : type === (taskCalNames.has(name) ? 'Global' : 'Resource')), true);
  eq('9b er is minstens één taakkalender getest', taskCalNames.size > 0, true);
}

{
  const scopeAct = (cols: string) => `<?xml version="1.0"?><APIBusinessObjects><Project><Id>S</Id><ObjectId>1</ObjectId><Name>S</Name>
    <Activity><Id>S1</Id><Name>s</Name><ObjectId>1</ObjectId><PercentCompleteType>Scope</PercentCompleteType>${cols}
      <PlannedDuration>40</PlannedDuration><PlannedStartDate>2026-03-02T08:00:00</PlannedStartDate><PlannedFinishDate>2026-03-06T17:00:00</PlannedFinishDate><Status>In Progress</Status>
      <ActualStartDate>2026-03-02T08:00:00</ActualStartDate></Activity></Project></APIBusinessObjects>`;
  const warns: string[] = [];
  const warn = console.warn;
  console.warn = (m: string) => { warns.push(String(m)); };
  try {
    eq('10a Scope leest ScopePercentComplete', readP6XML(scopeAct('<DurationPercentComplete>0.2</DurationPercentComplete><ScopePercentComplete>0.4</ScopePercentComplete>')).tasks[0]?.time.completion, 0.4);
    eq('10b Scope zonder eigen kolom = Duration', readP6XML(scopeAct('<DurationPercentComplete>0.2</DurationPercentComplete>')).tasks[0]?.time.completion, 0.2);
  } finally { console.warn = warn; }
  eq('10c geen waarschuwing over een onbekende soort', warns.some(w => w.includes('PercentCompleteType')), false);
}

{
  const named = readP6XML(readFileSync(new URL('./fixtures/p6xml-genest-meerdere-projecten.xml', import.meta.url), 'utf8'));
  const idAndName = (name: string, code: string | undefined): [string, string, string, string | undefined] => {
    named.project.name = name;
    if (code === undefined) delete named.project.p6ProjectCode; else named.project.p6ProjectCode = code;
    const out = write(named);
    const project = /<Project>[\s\S]*?<Id>([^<]*)<\/Id>[\s\S]*?<Name>([^<]*)<\/Name>/.exec(out.replace(/<WBS>[\s\S]*<\/ResourceAssignment>/, ''));
    const back = readP6XML(out).project;
    return [project?.[1] ?? '', project?.[2] ?? '', back.name, back.p6ProjectCode];
  };
  eq('11a bewaarde code ⇒ Id; naam letterlijk', idAndName('Kantoor', 'OZB-05'), ['OZB-05', 'Kantoor', 'Kantoor', 'OZB-05']);
  eq('11b code met spatie (OZB) ⇒ Id', idAndName('Bid for Facility Extension', 'OZB-14 1st Update'),
    ['OZB-14 1st Update', 'Bid for Facility Extension', 'Bid for Facility Extension', 'OZB-14 1st Update']);
  const [faseId, faseName, faseBack, faseCode] = idAndName('Nieuwbouw (fase 2)', undefined);
  eq('11c "(fase 2)" zonder code blijft heel; Id = OPS: + intern project-id', [faseName, faseId === `OPS:${named.project.id}`.slice(0, 40), faseBack, faseCode], ['Nieuwbouw (fase 2)', true, 'Nieuwbouw (fase 2)', undefined]);
  const [kantoorId, kantoorName, kantoorBack, kantoorCode] = idAndName('Kantoor (OZB-05)', undefined);
  eq('11d "(OZB-05)" in de naam zonder code wordt niet gesplitst', [kantoorId.startsWith('OPS:'), kantoorName, kantoorBack, kantoorCode], [true, 'Kantoor (OZB-05)', 'Kantoor (OZB-05)', undefined]);
  named.project.id = 'proj-aaa1';
  const [idA] = idAndName('Renovatie', undefined);
  named.project.id = 'proj-bbb2';
  const [idB, , backB] = idAndName('Renovatie', undefined);
  eq('11e zelfde naam zonder code ⇒ uniek Id, naam ongewijzigd terug', [idA !== idB, backB], [true, 'Renovatie']);
}

eq('12a al "Naam (Id)" ⇒ niet nog eens', nameWithProjectCode('Kantoor (OZB-05)', 'OZB-05'), 'Kantoor (OZB-05)');
eq('12b naam = Id ⇒ één keer', nameWithProjectCode('OZB-05', 'OZB-05'), 'OZB-05');
eq('12c anders ⇒ "Naam (Id)"', nameWithProjectCode('Kantoor', 'OZB-05'), 'Kantoor (OZB-05)');

if (fails.length > 0) {
  for (const f of fails) console.log(`XX  p6xml-writer-p6: ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK  p6xml-writer-p6: ${checks} controles groen (P6-vorm, round-trip, oude vorm leesbaar)`);
}
