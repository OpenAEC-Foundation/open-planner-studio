import './domStub';
// Datums in een property: één regel voor elke schrijver en lezer (`ifcDateValue` / `readIfcDate` in
// ifcPsets.ts). Zie docs/ifc-round-trip.md, "Datums in een property".
//
// De writer schreef `ConstraintDate`, `ConstraintDate2`, `Deadline` en een eigen datumveld als
// `IFCDATE('<waarde>')`, ook met een tijd erin (`IFCDATE('2013-04-27T00:00')`): een schemafout (IfcDate kent
// geen tijd). Gemeten op main 8db05a95c: 47 waarden in 22 van de 88 corpusdocumenten (10 bestanden),
// waarvan 4 in Roads. `StatusDate` schreef bij een onleesbare tijd `IFCDATETIME('2026-03-02T7:00')`, ook
// een schemafout. Nu typt de writer alleen de vormen van de store met een datum die bestaat:
// `YYYY-MM-DD` ⇒ IFCDATE, `YYYY-MM-DDTHH:mm` ⇒ IFCDATETIME met `:00`. Al het andere (seconden, een zone,
// een onmogelijke datum, een onleesbare tijd) gaat letterlijk als IFCTEXT. De lezer neemt bij IFCDATETIME
// de store-vorm `YYYY-MM-DDTHH:mm`; al het andere leest hij per veld precies zoals main.
//
//  §1 de helper: de vorm per soort waarde.
//  §2 per veld (StatusDate, ProjectStartDate, ConstraintDate, ConstraintDate2, Deadline, eigen datumveld):
//     de vorm in het bestand en de round-trip, voor een datum, een tijd, een onleesbare tijd, een spatie,
//     seconden, een zone en een onmogelijke datum.
//  §3 oude bestanden (de vorm van main) lezen zoals main ze las, ook IFCDATE met een tijd.
//  §4 IFCDATETIME van een ander pakket: een onleesbare tijd geeft de datum, een zone de kloktijd.
//  §5 de echte open- en opslaanroute: een urentaak met SNET 10:00 rekent na heropenen gelijk, ook met een
//     SNET met zone (start blijft 08:00), met seconden, en op een onmogelijke datum (blijft genegeerd).
//  §6 schemapoort in IFC4X3_ADD2, IFC4X3 en IFC4: 0 fouten.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcDateValue } from '@/services/ifc/ifcPsets';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { DocumentPayload } from '@/state/documentContract';
import type { ImportResult, OpenedImport } from '@/services/importTypes';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import { checkIfcSchema } from './ifcSchemaCheck';

declare const process: { exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 De helper
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const [value, want] of [
  ['2026-03-02', "IFCDATE('2026-03-02')"],
  ['2026-03-02T07:00', "IFCDATETIME('2026-03-02T07:00:00')"],
  ['2026-03-02T00:00', "IFCDATETIME('2026-03-02T00:00:00')"],
  ['2026-03-02T23:59', "IFCDATETIME('2026-03-02T23:59:00')"],
  ['2028-02-29', "IFCDATE('2028-02-29')"],
  ['2028-02-29T12:00', "IFCDATETIME('2028-02-29T12:00:00')"],
  // Geen vorm van de store, of een datum die niet bestaat: tekst, letterlijk. Als IFCDATETIME zou de
  // lezer seconden en zone wegnemen en een onmogelijke datum doorrollen (2026-13-45 ⇒ 2027-02-14).
  ['2026-03-02T07:00:30', "IFCTEXT('2026-03-02T07:00:30')"],
  ['2026-03-02T07:00:00', "IFCTEXT('2026-03-02T07:00:00')"],
  ['2026-03-02T07:00:30.5', "IFCTEXT('2026-03-02T07:00:30.5')"],
  ['2026-03-02T07:00Z', "IFCTEXT('2026-03-02T07:00Z')"],
  ['2026-03-02T07:00:00+02:00', "IFCTEXT('2026-03-02T07:00:00+02:00')"],
  ['2026-03-02+02:00', "IFCTEXT('2026-03-02+02:00')"],
  ['2026-13-45', "IFCTEXT('2026-13-45')"],
  ['2026-13-45T10:00', "IFCTEXT('2026-13-45T10:00')"],
  ['2026-02-29', "IFCTEXT('2026-02-29')"],
  ['2026-02-29T10:00', "IFCTEXT('2026-02-29T10:00')"],
  ['2026-04-31', "IFCTEXT('2026-04-31')"],
  ['2026-00-10', "IFCTEXT('2026-00-10')"],
  ['0050-01-01', "IFCTEXT('0050-01-01')"],
  ['2026-03-02T7:00', "IFCTEXT('2026-03-02T7:00')"],
  ['2026-03-02T24:00', "IFCTEXT('2026-03-02T24:00')"],
  ['2026-03-02T07:60', "IFCTEXT('2026-03-02T07:60')"],
  ['2026-03-02 07:00', "IFCTEXT('2026-03-02 07:00')"],
  ['2026-03-02T', "IFCTEXT('2026-03-02T')"],
  ["morgen 'vroeg'", "IFCTEXT('morgen ''vroeg''')"],
  ['', "IFCTEXT('')"],
] as const) {
  same(`§1 ifcDateValue(${JSON.stringify(value)})`, ifcDateValue(value), want);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Testproject: één urentaak met constraint, tweede constraint, deadline en een eigen datumveld.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const bands = (s: number, e: number) => [{ start: s, end: e }];
const WEEK: WorkTimeBands = { byWeekday: { 1: bands(420, 960), 2: bands(420, 960), 3: bands(420, 960), 4: bands(420, 960), 5: bands(420, 960), 6: [], 7: [] } };
const CAL: WorkCalendar = {
  id: 'cal-uur', name: 'Uur 07-16', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 9, holidays: [], workTime: WEEK,
};
const FIELD = { id: 'cf-datum', name: 'Keuring', type: 'date' as const };

interface Dates { status: string; start: string; constraint: string; constraint2: string; deadline: string; field: string }
function buildProject(d: Dates, schema?: 'IFC4X3_ADD2' | 'IFC4X3' | 'IFC4'): ImportResult {
  const time = createDefaultTaskTime('2026-03-02T07:00', 9, 'hours', CAL);
  time.durationMinutes = 540;
  time.scheduleDuration = 1;
  const task = {
    id: 't1', name: 'Urentaak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time,
    constraint: { type: 'SNET', date: d.constraint },
    constraint2: { type: 'FNLT', date: d.constraint2 },
    deadline: d.deadline,
    customFields: { [FIELD.id]: d.field },
  } as Task;
  return {
    project: {
      ...createDefaultProject(), id: 'proj-datumvorm', calendarId: CAL.id, startDate: d.start, endDate: '',
      statusDate: d.status, ...(schema ? { ifcSchema: schema } : {}),
    },
    calendar: CAL, tasks: [task], sequences: [], resources: [], assignments: [], customFieldDefs: [FIELD],
  } as ImportResult;
}
const allAs = (v: string): Dates => ({ status: v, start: v, constraint: v, constraint2: v, deadline: v, field: v });

const PROPS = ['StatusDate', 'ProjectStartDate', 'ConstraintDate', 'ConstraintDate2', 'Deadline', FIELD.name] as const;
/** De ruwe STEP-waarde per property. */
function propValues(ifc: string): Record<string, string | undefined> {
  return Object.fromEntries(PROPS.map((name) =>
    [name, new RegExp(`IFCPROPERTYSINGLEVALUE\\('${name}',\\$,(.*),\\$\\);$`, 'm').exec(ifc)?.[1]]));
}
function readBack(r: ImportResult): Record<string, unknown> {
  const t = r.tasks[0];
  return {
    StatusDate: r.project.statusDate, ProjectStartDate: r.project.startDate, ConstraintDate: t?.constraint?.date,
    ConstraintDate2: t?.constraint2?.date, Deadline: t?.deadline, [FIELD.name]: t?.customFields?.[r.customFieldDefs?.[0]?.id ?? ''],
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 Per veld: vorm in het bestand en round-trip
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const [value, typed, back] of [
  // [waarde in de store, waarde in het bestand, terug per veld (StatusDate, ProjectStartDate, rest)]
  ['2026-03-04', "IFCDATE('2026-03-04')", ['2026-03-04', '2026-03-04', '2026-03-04']],
  ['2026-03-04T10:00', "IFCDATETIME('2026-03-04T10:00:00')", ['2026-03-04T10:00', '2026-03-04T10:00', '2026-03-04T10:00']],
  ['2026-03-04T00:00', "IFCDATETIME('2026-03-04T00:00:00')", ['2026-03-04T00:00', '2026-03-04T00:00', '2026-03-04T00:00']],
  // Onleesbare tijd en spatie: tekst. StatusDate en de projectdatums nemen er de datum uit, zoals main;
  // de andere velden houden de tekst letterlijk, zoals main.
  ['2026-03-04T7:00', "IFCTEXT('2026-03-04T7:00')", ['2026-03-04', '2026-03-04', '2026-03-04T7:00']],
  ['2026-03-04 10:00', "IFCTEXT('2026-03-04 10:00')", ['2026-03-04', '2026-03-04', '2026-03-04 10:00']],
  // Seconden of zone: tekst. StatusDate neemt er de kloktijd uit (zoals main, die hier IFCDATETIME
  // schreef), de projectdatums de datum, de rest blijft letterlijk.
  ['2026-03-04T10:00:30', "IFCTEXT('2026-03-04T10:00:30')", ['2026-03-04T10:00', '2026-03-04', '2026-03-04T10:00:30']],
  ['2026-03-04T10:00:00+02:00', "IFCTEXT('2026-03-04T10:00:00+02:00')", ['2026-03-04T10:00', '2026-03-04', '2026-03-04T10:00:00+02:00']],
  // Een datum die niet bestaat: tekst, letterlijk. StatusDate en de projectdatums lezen hem zoals main.
  ['2026-13-45', "IFCTEXT('2026-13-45')", ['2026-13-45', '2026-13-45', '2026-13-45']],
] as const) {
  const ifc = writeIFC(buildProject(allAs(value)));
  same(`§2 ${value}: vorm per veld`, propValues(ifc), Object.fromEntries(PROPS.map((p) => [p, typed])));
  const want = Object.fromEntries(PROPS.map((p, i) => [p, i < 2 ? back[i] : back[2]]));
  const once = readIFC(ifc);
  same(`§2 ${value}: terug per veld`, readBack(once), want);
  const twice = readIFC(writeIFC({ ...buildProject(allAs(value)), project: once.project, tasks: once.tasks, customFieldDefs: once.customFieldDefs }));
  same(`§2 ${value}: tweede round-trip`, readBack(twice), want);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 Oude bestanden: de vorm van main leest zoals main hem las
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const ifc = writeIFC(buildProject(allAs('2026-03-04T10:00')));
  /** Zet de waarde van één property terug naar een oude vorm. */
  const withOld = (text: string, name: string, oldValue: string) => {
    const re = new RegExp(`(IFCPROPERTYSINGLEVALUE\\('${name}',\\$,)(.*)(,\\$\\);)$`, 'm');
    if (!re.test(text)) throw new Error(`property ${name} niet gevonden`);
    return text.replace(re, `$1${oldValue}$3`);
  };
  // Main 8db05a95c schreef ConstraintDate/-2, Deadline en het eigen veld als IFCDATE('<waarde>'), en de
  // projectstart vóór #344 als IFCDATE met tijd. StatusDate mét tijd uit IFCDATE las main mét tijd.
  let old = ifc;
  for (const name of PROPS) old = withOld(old, name, "IFCDATE('2026-03-04T10:00')");
  same('§3 controle: geen IFCDATETIME meer in het oude bestand', old.includes('IFCDATETIME('), false);
  same('§3 IFCDATE met tijd: per veld zoals main', readBack(readIFC(old)), {
    StatusDate: '2026-03-04T10:00', ProjectStartDate: '2026-03-04', ConstraintDate: '2026-03-04T10:00',
    ConstraintDate2: '2026-03-04T10:00', Deadline: '2026-03-04T10:00', [FIELD.name]: '2026-03-04T10:00',
  });
  let oddOld = ifc;
  for (const name of PROPS) oddOld = withOld(oddOld, name, "IFCDATE('2026-03-04 10:00')");
  same('§3 IFCDATE met spatie: per veld zoals main', readBack(readIFC(oddOld)), {
    StatusDate: '2026-03-04', ProjectStartDate: '2026-03-04', ConstraintDate: '2026-03-04 10:00',
    ConstraintDate2: '2026-03-04 10:00', Deadline: '2026-03-04 10:00', [FIELD.name]: '2026-03-04 10:00',
  });
  let seconds = ifc;
  for (const name of PROPS) seconds = withOld(seconds, name, "IFCDATE('2026-03-04T10:00:00')");
  same('§3 IFCDATE met seconden: per veld zoals main', readBack(readIFC(seconds)), {
    StatusDate: '2026-03-04T10:00', ProjectStartDate: '2026-03-04', ConstraintDate: '2026-03-04T10:00:00',
    ConstraintDate2: '2026-03-04T10:00:00', Deadline: '2026-03-04T10:00:00', [FIELD.name]: '2026-03-04T10:00:00',
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 IFCDATETIME van een ander pakket
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const ifc = writeIFC(buildProject(allAs('2026-03-04T10:00')));
  for (const [value, want] of [
    ['2026-03-04T7:00:00', '2026-03-04'],
    ['2026-03-04T25:00:00', '2026-03-04'],
    ['2026-03-04T10:00:00+02:00', '2026-03-04T10:00'],
    ['2026-03-04T10:00:30', '2026-03-04T10:00'],
  ] as const) {
    const foreign = ifc.split("IFCDATETIME('2026-03-04T10:00:00')").join(`IFCDATETIME('${value}')`);
    same(`§4 IFCDATETIME('${value}'): alle velden`, readBack(readIFC(foreign)), Object.fromEntries(PROPS.map((p) => [p, want])));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 De echte open- en opslaanroute: de motor rekent met de constraint
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
  const openInStore = (parsed: OpenedImport): DocumentPayload => {
    const store = createAppStoreContext().store;
    store.getState().applyOpenedImport(parsed, OPEN);
    return store.getState().getOpenDocumentPayloads()[0].payload;
  };
  const dates: Dates = { status: '', start: '2026-03-02', constraint: '2026-03-04T10:00', constraint2: '2026-03-06T16:00', deadline: '2026-03-06T12:00', field: '2026-03-05' };
  const before = openInStore(buildProject(dates));
  const t0 = before.tasks[0].time;
  same('§5 controle: de SNET 10:00 zet de start', [t0.earlyStart, t0.earlyFinish], ['2026-03-04T10:00', '2026-03-05T10:00']);
  const after = openInStore(await parseOpenedFile({ name: 'rondgang.ifc', text: writeIFC(buildWriteIFCInput(before)) }));
  const t1 = after.tasks[0];
  same('§5 constraint, tweede constraint, deadline en eigen veld na heropenen',
    [t1.constraint, t1.constraint2, t1.deadline, Object.values(t1.customFields ?? {})],
    [before.tasks[0].constraint, before.tasks[0].constraint2, before.tasks[0].deadline, Object.values(before.tasks[0].customFields ?? {})]);
  same('§5 datums, speling en kritiek na heropenen',
    [t1.time.earlyStart, t1.time.earlyFinish, t1.time.lateStart, t1.time.lateFinish, t1.time.totalFloat, t1.time.isCritical],
    [t0.earlyStart, t0.earlyFinish, t0.lateStart, t0.lateFinish, t0.totalFloat, t0.isCritical]);

  // Waarden die niet in de vorm van de store staan (uit een extensie of MCP) blijven letterlijk, en de
  // motor rekent er na heropenen hetzelfde mee. Gemeten vóór deze regel: een SNET met zone startte na
  // de rondgang om 10:00 in plaats van 08:00, en een onmogelijke datum werd een actieve SNET.
  for (const [label, constraint, field, start] of [
    // De motor leest de zone: 10:00+02:00 is 08:00.
    ['SNET met zone', '2026-03-04T10:00:00+02:00', '2026-03-05T10:00:00+02:00', '2026-03-04T08:00'],
    ['SNET met zone zonder seconden', '2026-03-04T10:00+02:00', '2026-03-05T10:00Z', '2026-03-04T08:00'],
    ['SNET met seconden', '2026-03-04T10:00:30', '2026-03-05T10:00:30', '2026-03-04T10:00'],
    // Een datum die niet bestaat: de motor negeert de SNET, de taak start op de projectstart.
    ['SNET op een onmogelijke datum', '2026-13-45T10:00', '2026-13-45', '2026-03-02T07:00'],
  ] as const) {
    const odd = openInStore(buildProject({ ...dates, constraint, field }));
    const o0 = odd.tasks[0];
    same(`§5 ${label}: controle, de start vóór opslaan`, o0.time.earlyStart, start);
    const back = openInStore(await parseOpenedFile({ name: 'rondgang.ifc', text: writeIFC(buildWriteIFCInput(odd)) }));
    const o1 = back.tasks[0];
    same(`§5 ${label}: constraint en eigen veld letterlijk`, [o1.constraint?.date, Object.values(o1.customFields ?? {})], [constraint, [field]]);
    same(`§5 ${label}: datums, speling en kritiek na heropenen`,
      [o1.time.earlyStart, o1.time.earlyFinish, o1.time.lateStart, o1.time.lateFinish, o1.time.totalFloat, o1.time.isCritical],
      [o0.time.earlyStart, o0.time.earlyFinish, o0.time.lateStart, o0.time.lateFinish, o0.time.totalFloat, o0.time.isCritical]);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §6 Schemapoort in de drie schema's
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const schema of ['IFC4X3_ADD2', 'IFC4X3', 'IFC4'] as const) {
  for (const value of ['2026-03-04', '2026-03-04T10:00', '2026-03-04T7:00', '2026-03-04 10:00', '2026-03-04T10:00:00+02:00', '2026-13-45T10:00', '']) {
    const dates = { ...allAs(value), start: value || '2026-03-04', status: value };
    const r = checkIfcSchema(`datumvorm ${JSON.stringify(value)}`, writeIFC(buildProject(dates, schema)), undefined, schema);
    checks += r.checks;
    failures.push(...r.failures.map((f) => `§6 ${f}`));
  }
}

if (failures.length) {
  console.log(`XX  ifc-datumvorm: ${failures.length} van ${checks} checks faalden`);
  for (const f of failures) console.log(`    - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-datumvorm: ${checks} checks`);
