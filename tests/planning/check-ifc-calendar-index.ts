import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { IFC_SCHEMAS } from '@/types/project';
import { ifcCalendarIndexFixture } from './ifcCalendarIndexFixture';
import { parseStep } from './ifcSchemaCheck';

let checks = 0;
const failures: string[] = [];
function same(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(label);
}

for (const schema of IFC_SCHEMAS) {
  const data = ifcCalendarIndexFixture(40, 7);
  data.project.ifcSchema = schema;
  // Een kalender zonder gebruikers schrijft geen lege control-relatie.
  data.resourceCalendars!.push({ ...data.calendar, id: 'ongebruikt', name: 'Ongebruikte kalender' });
  const before = JSON.stringify(data);
  const ifc = writeIFC(data);
  same(`${schema}: schrijven muteert de invoer niet`, JSON.stringify(data), before);

  // Onafhankelijke STEP-parser: toets de relatievolgorde én de doelvolgorde aan de invoer.
  const entities = parseStep(ifc);
  const calendars = entities.filter(e => e.type === 'IFCWORKCALENDAR');
  const tasks = entities.filter(e => e.type === 'IFCTASK');
  const resources = entities.filter(e => /IFC(?:CREW|LABOR|CONSTRUCTIONEQUIPMENT|SUBCONTRACT|CONSTRUCTIONMATERIAL)RESOURCE/.test(e.type));
  same(`${schema}: elke taak heeft één STEP-entiteit`, tasks.length, data.tasks.length);
  same(`${schema}: elke resource heeft één STEP-entiteit`, resources.length, data.resources.length);
  const controls = entities.filter(e => e.type === 'IFCRELASSIGNSTOCONTROL');
  for (const [i, cal] of data.resourceCalendars!.entries()) {
    if (cal.id === data.project.calendarId) continue;
    const stepId = calendars[i].id;
    const actual = controls.filter(e => e.args[6]?.k === 'ref' && e.args[6].id === stepId)
      .map(e => e.args[4].k === 'list' ? e.args[4].items.map(v => v.k === 'ref' ? v.id : null) : []);
    const expected = [
      data.resources.flatMap((r, index) => r.calendarId === cal.id ? [resources[index].id] : []),
      data.tasks.flatMap((t, index) => t.calendarId === cal.id ? [tasks[index].id] : []),
    ].filter(refs => refs.length > 0);
    same(`${schema}: kalender ${cal.id} behoudt relatie- en doelvolgorde`, actual, expected);
  }

  const read = readIFC(ifc);
  const names = new Map((read.resourceCalendars ?? []).map(c => [c.id, c.name]));
  const written = new Map(data.resourceCalendars!.map(c => [c.id, c.name]));
  const readTasks = new Map(read.tasks.map(t => [t.id, t]));
  for (const task of data.tasks) {
    const expected = task.calendarId && task.calendarId !== data.project.calendarId
      ? written.get(task.calendarId) : undefined;
    same(`${schema}: kalender van ${task.id} na heropenen`, names.get(readTasks.get(task.id)?.calendarId ?? ''), expected);
  }
}

// Tel de echte kalenderlezingen in de volledige schrijver; geen tijdsgrens die van de runner afhangt.
// De oude lus deed bij 64 kalenders meer dan 64 lezingen per taak/resource.
for (const calendarCount of [0, 1, 64]) {
  const data = ifcCalendarIndexFixture(512, calendarCount);
  let reads = 0;
  const observe = <T extends { calendarId?: string }>(item: T): T => new Proxy(item, {
    get(target, key, receiver) {
      if (key === 'calendarId') reads++;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  data.tasks = data.tasks.map(observe);
  data.resources = data.resources.map(observe);
  writeIFC(data);
  const limit = 12 * (data.tasks.length + data.resources.length);
  same(`${calendarCount} kalenders: kalenderlezingen ${reads} blijven binnen lineair budget ${limit}`, reads <= limit, true);
}

// Een nieuwe schrijfronde moet nieuwe toewijzingen zien; er blijft geen index tussen saves hangen.
{
  const data = ifcCalendarIndexFixture(20, 2);
  writeIFC(data);
  data.tasks[0].calendarId = 'kalender-1';
  data.resources[0].calendarId = 'kalender-1';
  const parsed = readIFC(writeIFC(data));
  const calendarNames = new Map((parsed.resourceCalendars ?? []).map(c => [c.id, c.name]));
  same('Volgende save leest gewijzigde taakkalender', calendarNames.get(parsed.tasks[0].calendarId ?? ''), 'Ploegkalender 1');
  same('Volgende save leest gewijzigde resourcekalender', calendarNames.get(parsed.resources[0].calendarId ?? ''), 'Ploegkalender 1');
}

for (const failure of failures) console.log(`XX ${failure}`);
console.log(`IFC-kalenderindex: ${checks - failures.length}/${checks} controles geslaagd`);
if (failures.length > 0) process.exit(1);
