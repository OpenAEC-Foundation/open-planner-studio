// Bron: Terra's gewone-opslagproef bij #886, periode-0730.ifc (zonder bouwmodel).
// Test de echte store-openactie en saveFile, met een geheugenhandle op de bestandsnaad.
import { readFileSync, readdirSync } from 'node:fs';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { readIFC } from '@/services/ifc/ifcReader';
import { readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import { writeIFC } from '@/services/ifc/ifcWriter';

installBrowserStubs();
installDeterminism();
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const source = readFileSync(new URL('./fixtures/periode-0730.ifc', import.meta.url), 'utf8');
const period = "IFCTIMEPERIOD('07:30:00','16:00:00')";
let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}
function memoryFile(initial: string) {
  let content = initial;
  const writes: string[] = [];
  const handle = {
    kind: 'file', name: 'werktijd.ifc',
    isSameEntry: async (other: unknown) => other === handle,
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => new File([content], 'werktijd.ifc'),
    createWritable: async () => {
      let buffer = '';
      return { write: async (s: string) => { buffer = s; }, close: async () => { content = buffer; writes.push(buffer); } };
    },
  } as unknown as FileSystemFileHandle;
  return { handle, writes };
}
for (const [start, end, startHour, endHour] of [
  ['07:30:00', '16:00:00', 7.5, 16], ['07:15:00', '16:45:00', 7.25, 16.75],
  ['07:01:00', '16:59:00', 7 + 1 / 60, 16 + 59 / 60],
  ['00:00:00', '24:00:00', 0, 24], ['7.123456:00:00', '16:00:00', 7.123456, 16], ['7.5:00:00', '16.75:00:00', 7.5, 16.75],
] as const) {
  const input = source.replace(period, `IFCTIMEPERIOD('${start}','${end}')`);
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name: 'werktijd.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
  const hours = () => [store.getState().calendar.workStartHour, store.getState().calendar.workEndHour];
  eq(`${start}: geopend`, hours(), [startHour, endHour]);
  await store.getState().saveFile();
  eq(`${start}: gewone opslag schreef eenmaal`, file.writes.length, 1);
  if (!file.writes[0]) continue;
  const saved = file.writes[0];
  const back = readIFC(saved);
  eq(`${start}: opgeslagen kalender`, [back.calendar.workStartHour, back.calendar.workEndHour], [startHour, endHour]);
  // Controleer ook de standaard-IFC-periode: OPS-metadata mag een verkeerde klok niet maskeren.
  const canonicalStart = start === '7.5:00:00' ? '07:30:00' : start;
  const canonicalEnd = end === '16.75:00:00' ? '16:45:00' : end;
  eq(`${start}: standaardveld`, saved.includes(`IFCTIMEPERIOD('${canonicalStart}','${canonicalEnd}')`), true);
  const reopened = createAppStoreContext().store;
  await reopened.getState().openOpenedFile({ name: 'heropend.ifc', content: saved, ref: null });
  eq(`${start}: opnieuw geopend`, [reopened.getState().calendar.workStartHour, reopened.getState().calendar.workEndHour], [startHour, endHour]);
}

// De andere kalenderlussen moeten dezelfde kloklezing gebruiken.
const shapes = [
  ['pauze', (text: string) => text.replace('(#17));', '(#17,#9001));')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('17:15:00','18:45:00');\nENDSEC;\nEND-ISO")],
  ['weekpatronen', (text: string) => text.replace(',$,$,(#19),', ',$,$,(#19,#9003),')
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('08:15:00','15:45:00');\n#9002=IFCRECURRENCEPATTERN(.WEEKLY.,$,(6),$,$,$,$,(#9001));\n#9003=IFCWORKTIME('Zaterdag',.PREDICTED.,$,#9002,$,$);\nENDSEC;\nEND-ISO")],
  ['uitzondering', (text: string) => text.replace("#20=IFCWORKTIME('New Year''s Day',.PREDICTED.,$,$,", "#20=IFCWORKTIME('New Year''s Day',.PREDICTED.,$,#9002,")
    .replace('ENDSEC;\nEND-ISO', "#9001=IFCTIMEPERIOD('08:15:00','15:45:00');\n#9002=IFCRECURRENCEPATTERN(.DAILY.,$,$,$,$,$,$,(#9001));\nENDSEC;\nEND-ISO")],
] as const;
for (const [shape, transform] of shapes) {
  const input = transform(source);
  eq(`${shape}: fixture gewijzigd`, input !== source, true);
  const imported = readIFC(input);
  eq(`${shape}: startminuten gelezen`, imported.calendar.workTime?.byWeekday[1]?.[0]?.start ?? imported.calendar.workStartHour * 60, 450);
  if (shape !== 'uitzondering') {
    const file = memoryFile(input);
    const { store } = createAppStoreContext();
    await store.getState().openOpenedFile({ name: 'banden.ifc', content: input, ref: { kind: 'handle', handle: file.handle } });
    await store.getState().saveFile();
    eq(`${shape}: gewone opslag behoudt minuten`, file.writes[0]?.includes("IFCTIMEPERIOD('07:30:00','16:00:00')"), true);
    eq(`${shape}: heropenen behoudt banden`, readIFC(file.writes[0]).calendar.workTime, imported.calendar.workTime);
  }
  // Vervang de extra periode, zodat juist de tweede band/patroon/uitzondering wordt getoetst.
  const seconds = input.replace(/(#9001=IFCTIMEPERIOD\('\d\d:\d\d:)00/, '$101');
  eq(`${shape}: secondenfixture gewijzigd`, seconds !== input, true);
  eq(`${shape}: seconden openen`, readIFC(seconds).tasks.length, imported.tasks.length);
}

// Eigen OPS-bestanden blijven zonder plannerbewerking gewoon openen en opslaan.
// Een externe applicatiemarkering doorloopt dezelfde controle.
for (const own of [true, false]) {
 for (const scalarMark of [false, true]) {
 for (const [start, end] of [['07:30:01', '16:00:00'], ['07:15:00', '16:45:30'], ['07:15:00.5', '16:45:00'], ['07:15:00.123', '16:45:00'], ['07:30:01Z', '16:00:00Z'], ['07:30:00.0001+01:00', '16:00:00+01:00'], ['07:30:00.000000001', '16:00:00'], ['07:30:00.000000000000000001', '16:00:00']] as const) {
  const input = source.replace(period, `IFCTIMEPERIOD('${start}','${end}')`)
    .replace("'0.2','Open Planner Studio','OPS'", own ? "'0.2','Open Planner Studio','OPS'" : "'1','External planner','EXT'");
  const markedInput = scalarMark ? input.replace('ENDSEC;\nEND-ISO', "#9900=IFCPROPERTYSINGLEVALUE('IsHourCalendar',$,IFCBOOLEAN(.F.),$);\n#9901=IFCPROPERTYSET('0000000000000000000001',#6,'OPS_Calendar',$,(#9900));\n#9902=IFCRELDEFINESBYPROPERTIES('0000000000000000000002',#6,$,$,(#38),#9901);\nENDSEC;\nEND-ISO") : input;
  const label = `${scalarMark ? 'scalar-markering ' : ''}${own ? 'eigen' : 'extern'} ${start}/${end}`;
  eq(`${label}: tekst opent`, readIFC(markedInput).tasks.length, readIFC(source).tasks.length);
  eq(`${label}: bytes openen`, (await readIfcBytes(new TextEncoder().encode(markedInput))).tasks.length, readIFC(source).tasks.length);
  const { store } = createAppStoreContext();
  const file = memoryFile(markedInput);
  await store.getState().openOpenedFile({ name: 'seconden.ifc', content: markedInput, ref: { kind: 'handle', handle: file.handle } });
  await store.getState().saveFile();
  eq(`${label}: gewone opslag zonder bewerken`, file.writes.length, 1);
  if (!file.writes[0]) continue;
  eq(`${label}: bronseconden in standaardveld`, file.writes[0].includes(`IFCTIMEPERIOD('${start}','${end}')`), true);
  const reopened = createAppStoreContext().store;
  const savedFile = memoryFile(file.writes[0]);
  await reopened.getState().openOpenedFile({ name: 'eigen-opnieuw.ifc', content: file.writes[0], ref: { kind: 'handle', handle: savedFile.handle } });
  eq(`${label}: expliciete banden behouden`, reopened.getState().calendar.workTime, store.getState().calendar.workTime);
  await reopened.getState().saveFile();
  eq(`${label}: eigen opslag weigert nooit zonder bewerking`, savedFile.writes.length, 1);
  eq(`${label}: seconden blijven bij tweede opslag`, savedFile.writes[0]?.includes(`IFCTIMEPERIOD('${start}','${end}')`), true);
  reopened.getState().addTask({ name: 'Werk gewijzigd, kalender gelijk' });
  await reopened.getState().saveFile();
  eq(`${label}: taakbewerking bewaart seconden`, savedFile.writes[1]?.includes(`IFCTIMEPERIOD('${start}','${end}')`), true);
 }
 }
}

for (const name of [...readdirSync(new URL('./fixtures/oude-tags/', import.meta.url)).filter(n => n.endsWith('.ifc')).map(n => `oude-tags/${n}`), 'h7-tijden-oude-writer.ifc']) {
  const input = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const file = memoryFile(input);
  const { store } = createAppStoreContext();
  await store.getState().openOpenedFile({ name, content: input, ref: { kind: 'handle', handle: file.handle } });
  await store.getState().saveFile();
  eq(`${name}: eigen bestand schrijft zonder bewerken`, file.writes.length, 1);
}

// Zonder bijpassende bronwaarde mag een nieuwe, fijnere bewerking niet stil afgerond worden.
const fineImport = readIFC(source);
fineImport.calendar.workingExceptions = [{ name: 'Bewerkt', startDate: '2027-01-02', endDate: '2027-01-02', bands: [{ start: 450 + 0.0001 / 60, end: 960 }] }];
let typed = false;
try { writeIFC(fineImport); } catch (e) { typed = e instanceof IfcCalendarTimePrecisionError; }
eq('nieuwe fijnere bewerking: writer weigert getypeerd', typed, true);
const fineStore = createAppStoreContext().store;
const fineFile = memoryFile(source);
await fineStore.getState().openOpenedFile({ name: 'bewerkt.ifc', content: source, ref: { kind: 'handle', handle: fineFile.handle } });
fineStore.setState(s => { s.calendar.workingExceptions = fineImport.calendar.workingExceptions; });
const active = fineStore.getState().project.id;
const realError = console.error;
console.error = () => {};
try { await fineStore.getState().saveFile(); } finally { console.error = realError; }
eq('geweigerde opslag laat bron intact', fineFile.writes.length, 0);
eq('geweigerde opslag houdt document open', fineStore.getState().project.id, active);
eq('geweigerde opslag gebruikt bestaande melding', fineStore.getState().ui.notifications.some(n => n.severity === 'error'), true);
console.error = () => {};
try { await fineStore.getState().saveFileAs(); } finally { console.error = realError; }
eq('geweigerde Opslaan als laat bron intact', fineFile.writes.length, 0);
eq('geweigerde Opslaan als gebruikt bestaande melding', fineStore.getState().ui.notifications.some(n => n.messageKey === 'notifications.saveFailed'), true);

for (const failure of failures) console.log(`XX ${failure}`);
console.log(`Kalendertijd: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exitCode = 1;
