/**
 * Pariteit P6 XML ↔ XER (issue #775): hetzelfde project, één keer als P6 XML en één keer als XER geopend,
 * rekent met dezelfde regels en geeft na `solveProject()` dezelfde datums.
 *
 * Route: een project in OPS (de voorbeeldprojecten en een synthetisch project met voortgang en afwijkende
 * rekenopties) → `writeXER` én `writeP6XML` → `readXER` én `readP6XML` → de laadgrens van de app
 * (`payloadFromImport`) → `solveProject`. Vergeleken worden de twee GEOPENDE kanten, niet het origineel:
 *  P1  rekenprofiel, voortgangsmodus en projectopties;
 *  P2  per activiteit vroege en late start en einde, totale en vrije speling, kritiek en de werkregel;
 *  P3  P6-eigen waarden in `<ScheduleOptions>` (zoals P6 ze schrijft) geven dezelfde opties als de
 *      overeenkomstige SCHEDOPTIONS-tokens in een XER;
 *  P4  een P6 XML zonder `<ScheduleOptions>` rekent met de P6-standaard, zoals een XER zonder SCHEDOPTIONS.
 */
import './domStub';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXER } from '@/services/xer/xerReader';
import { writeXER } from '@/services/xer/xerWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { payloadFromImport } from '@/state/documentContract';
import { isLeafTask } from '@/utils/taskHierarchy';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { seedScalarWorkTime } from '@/utils/effectiveWorkTime';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project, ProjectSchedulingOptions } from '@/types/project';
import { installDOMParser } from './xmldom-shim';

declare const process: { exit(code: number): never };
installDOMParser();

const failures: string[] = [];
const notes: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Doc {
  project: Project;
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

function docOf(result: ImportResult): Doc {
  const payload = payloadFromImport(result, null);
  return {
    project: payload.project, calendar: payload.calendar, calendars: payload.calendars, tasks: payload.tasks,
    sequences: payload.sequences, resources: payload.resources, assignments: payload.assignments,
  };
}

function solve(doc: Doc): string | undefined {
  return solveProject(solveInputFor(doc.project, doc.tasks, doc.sequences, doc.calendar, doc.calendars)).error;
}

function xerText(doc: Doc): string {
  const bytes = writeXER({ ...doc, exportDate: '2026-11-02' }).bytes;
  return new TextDecoder('windows-1252').decode(bytes);
}

function xmlText(doc: Doc): string {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return writeP6XML(doc.project, doc.calendar, doc.tasks, doc.sequences, doc.resources, doc.assignments, doc.calendars);
  } finally { console.warn = warn; }
}

function openXer(text: string): Doc {
  const result = readXER(new TextEncoder().encode(text));
  if (isMultiDocumentImport(result)) throw new Error('XER gaf meerdere projecten');
  return docOf(result);
}

function openXml(text: string): Doc {
  const warn = console.warn;
  console.warn = () => {};
  try { return docOf(readP6XML(text)); } finally { console.warn = warn; }
}

/** De projectopties zonder de sleutels die alleen de XER-lezer kent (bronarchief e.d. staan niet in de opties). */
function optionsOf(doc: Doc): { profile: string | undefined; progressMode: string | undefined; options: ProjectSchedulingOptions } {
  return {
    profile: doc.project.schedulingProfile?.id,
    progressMode: doc.project.progressMode,
    options: doc.project.schedulingOptions ?? {},
  };
}

/** Een instant of datum als milliseconden; zo telt "2026-03-05" gelijk aan dezelfde dag in een andere vorm niet mee. */
function at(iso: string | undefined): string {
  if (!iso) return '-';
  return iso.length >= 16 ? new Date(parseInstant(iso).getTime()).toISOString() : iso;
}

const FIELDS = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish'] as const;

/** Per activiteit de rekenuitkomst; samenvattingen (WBS, projectknoop) tellen niet. */
function schedule(doc: Doc): Map<string, string> {
  const out = new Map<string, string>();
  for (const task of doc.tasks) {
    if (!isLeafTask(task)) continue;
    const t = task.time;
    out.set(task.name, [
      ...FIELDS.map(field => at(t[field])),
      t.totalFloat.toFixed(4), t.freeFloat.toFixed(4), String(t.isCritical), task.workRule ?? 'erft',
    ].join(' | '));
  }
  return out;
}

/** P1 + P2 voor één bronproject; geeft het aantal afwijkende activiteiten terug. */
/** Een P6-kalender heeft altijd eigen werktijden. Een kalender van OPS zonder eigen werkblokken krijgt hier de
 *  blokken die uit begin, einde en uren per dag volgen: de XER-lezer leest elke kalender met werkblokken
 *  (knownbug 466), de P6 XML-lezer een eigen export zonder die blokken niet. Dat verschil zit in de rondgang via
 *  OPS, niet in een P6-bestand, en valt buiten deze toets. */
function withWorkBlocks(cal: WorkCalendar): WorkCalendar {
  if (cal.workTime) return cal;
  return { ...cal, workTime: seedScalarWorkTime(cal.workDays, cal.workStartHour, cal.workEndHour, cal.hoursPerDay,
    cal.simpleBreakStartMinute, cal.simpleBreakDurationMinutes) };
}

function compare(label: string, input: Doc): number {
  const source: Doc = { ...input, calendar: withWorkBlocks(input.calendar), calendars: input.calendars.map(withWorkBlocks) };
  // Zoals `exportAs`: eerst doorrekenen, zodat beide schrijvers dezelfde rekenuitkomst meekrijgen.
  eq(`P2s ${label}: bron rekent`, solve(source), undefined);
  const viaXer = openXer(xerText(source));
  const viaXml = openXml(xmlText(source));
  eq(`P1 ${label}: zelfde profiel, voortgangsmodus en opties`, optionsOf(viaXml), optionsOf(viaXer));
  eq(`P2a ${label}: XER rekent`, solve(viaXer), undefined);
  eq(`P2b ${label}: P6 XML rekent`, solve(viaXml), undefined);
  const a = schedule(viaXer);
  const b = schedule(viaXml);
  eq(`P2c ${label}: zelfde activiteiten`, [...b.keys()].sort(), [...a.keys()].sort());
  const differing: string[] = [];
  for (const [name, value] of a) {
    if (b.get(name) !== value) differing.push(`'${name}': XER ${value} ≠ XML ${b.get(name) ?? '(ontbreekt)'}`);
  }
  eq(`P2 ${label}: zelfde datums, speling en kritiek (${a.size} activiteiten)`, differing.slice(0, 3), []);
  notes.push(`${label}: ${a.size} activiteiten, ${differing.length} wijken af`);
  return differing.length;
}

// ── Synthetisch project: voortgang, een relatie op een andere kalender en afwijkende opties ──────

function synthetic(options: ProjectSchedulingOptions, progressMode: Project['progressMode']): Doc {
  const project = {
    id: 'proj-775', name: 'Pariteit 775', description: '', startDate: '2026-03-02T07:00', endDate: '',
    calendarId: 'cal-a', createdAt: '2026-03-02', modifiedAt: '2026-03-02', author: '', company: '',
    statusDate: '2026-03-11T07:00', progressMode, schedulingProfile: builtInProfile('p6'), schedulingOptions: options,
  } as Project;
  const five: WorkCalendar = {
    id: 'cal-a', name: 'Vijf dagen', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8, holidays: [{ name: 'Vrij', startDate: '2026-03-16', endDate: '2026-03-16' }],
  };
  const four: WorkCalendar = {
    id: 'cal-b', name: 'Vier dagen', description: '', workDays: [1, 2, 3, 4], workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8, holidays: [],
  };
  const task = (id: string, name: string, days: number, extra: Partial<Task> = {}, time: Partial<Task['time']> = {}): Task => ({
    id, name, description: '', wbsCode: id.toUpperCase(), taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2026-03-02', days), ...time },
    ...extra,
  });
  const tasks: Task[] = [
    // Gestart, uit volgorde: de opvolger D is begonnen voordat zijn voorganger C klaar is (voortgangsmodus telt).
    task('a', 'Fundering', 5, { status: 'COMPLETED' }, { actualStart: '2026-03-02T07:00', actualFinish: '2026-03-06T16:00', completion: 1 }),
    task('b', 'Kelder', 6, { status: 'STARTED' }, { actualStart: '2026-03-09T07:00', completion: 0.5 }),
    task('c', 'Casco', 8, { calendarId: 'cal-b' }),
    task('d', 'Gevel', 4, { status: 'STARTED' }, { actualStart: '2026-03-10T07:00', completion: 0.25 }),
    task('e', 'Dak', 3, { calendarId: 'cal-b' }),
    task('f', 'Open einde', 2),
    task('g', 'Oplevering', 0, { isMilestone: true }),
  ];
  const seq = (id: string, from: string, to: string, type: Sequence['type'], lagMinutes = 0): Sequence =>
    ({ id, predecessorId: from, successorId: to, type, lagDays: lagMinutes / 480, lagMinutes });
  const sequences: Sequence[] = [
    seq('s1', 'a', 'b', 'FINISH_START'),
    seq('s2', 'b', 'c', 'START_START', 960),
    seq('s3', 'c', 'd', 'FINISH_START', 480),
    seq('s4', 'c', 'e', 'FINISH_FINISH', 240),
    seq('s5', 'd', 'g', 'FINISH_START'),
    seq('s6', 'e', 'g', 'FINISH_START'),
    seq('s7', 'a', 'f', 'FINISH_START'),
  ];
  return { project, calendar: five, calendars: [four], tasks, sequences, resources: [], assignments: [] };
}

const VARIANTS: Array<{ label: string; options: ProjectSchedulingOptions; progressMode: Project['progressMode'] }> = [
  { label: 'P6-standaard', progressMode: 'RETAINED_LOGIC', options: {} },
  {
    label: 'afwijkend A', progressMode: 'PROGRESS_OVERRIDE',
    options: { lagCalendar: 'successor', totalFloatMode: 'smallest', makeOpenEndedCritical: true, startToStartLagFrom: 'actualStart', criticalDefinition: { mode: 'totalFloat', thresholdHours: 16 } },
  },
  {
    label: 'afwijkend B', progressMode: 'RETAINED_LOGIC',
    options: { lagCalendar: '24hour', totalFloatMode: 'start', makeOpenEndedCritical: false, criticalDefinition: { mode: 'longestPath' } },
  },
  {
    label: 'afwijkend C', progressMode: 'RETAINED_LOGIC',
    options: { lagCalendar: 'projectDefault', totalFloatMode: 'finish', useExpectedFinishDates: false, floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 3 } },
  },
];

/** Een geplande planning zoals een planner hem uit P6 krijgt: de geplande datums zijn de berekende vroege datums
 *  (een gestarte activiteit begint op haar werkelijke start). */
function planned(input: Doc): Doc {
  const doc: Doc = { ...input, calendar: withWorkBlocks(input.calendar), calendars: input.calendars.map(withWorkBlocks) };
  eq(`P2s ${doc.project.name}: bron rekent`, solve(doc), undefined);
  for (const task of doc.tasks) {
    task.time.scheduleStart = task.time.actualStart ?? task.time.earlyStart;
    task.time.scheduleFinish = task.time.actualFinish ?? task.time.earlyFinish;
  }
  return doc;
}

let differingTotal = 0;
for (const variant of VARIANTS) {
  differingTotal += compare(`synthetisch, ${variant.label}`, planned(synthetic(variant.options, variant.progressMode)));
}

// ── Voorbeeldprojecten, met het P6-profiel ───────────────────────────────────────────────────────
{
  const dir = join(ROOT, 'public/examples');
  const files = readdirSync(dir).filter(f => f.endsWith('.ifc')).sort();
  eq('P0 voorbeeldprojecten gevonden', files.length >= 5, true);
  for (const file of files) {
    const doc = docOf(readIFC(readFileSync(join(dir, file), 'utf8')));
    doc.project = { ...doc.project, schedulingProfile: builtInProfile('p6') };
    differingTotal += compare(file, doc);
  }
}

// ── P3: P6-eigen waarden in <ScheduleOptions> ↔ XER-tokens ──────────────────────────────────────
{
  const base = synthetic({}, 'RETAINED_LOGIC');
  const xml = xmlText(base);
  const xer = xerText(base);
  /** Vervangt (of zet) velden in het `<ScheduleOptions>` dat de schrijver schreef. */
  const withXml = (fields: Record<string, string>): string => xml.replace(/<ScheduleOptions>([\s\S]*?)<\/ScheduleOptions>/, (_, body: string) => {
    let out = body;
    for (const [name, value] of Object.entries(fields)) {
      const element = `<${name}>${value}</${name}>`;
      out = out.includes(`<${name}>`) ? out.replace(new RegExp(`<${name}>[^<]*</${name}>`), element) : out + element;
    }
    return `<ScheduleOptions>${out}</ScheduleOptions>`;
  });
  /** Zet SCHEDOPTIONS-cellen in de XER-tekst (kolommen per naam). */
  const withXer = (cells: Record<string, string>): string => {
    const lines = xer.split('\r\n');
    const tableAt = lines.findIndex(line => line === '%T\tSCHEDOPTIONS');
    const fields = lines[tableAt + 1].split('\t');
    const row = lines[tableAt + 2].split('\t');
    for (const [name, value] of Object.entries(cells)) {
      const index = fields.indexOf(name);
      if (index < 0) throw new Error(`SCHEDOPTIONS mist ${name}`);
      row[index] = value;
    }
    lines[tableAt + 2] = row.join('\t');
    return lines.join('\r\n');
  };
  const cases: Array<{ label: string; xml: Record<string, string>; xer: Record<string, string> }> = [
    {
      label: 'opvolger, kleinste speling, Progress Override, open einde kritiek',
      xml: {
        ComputeTotalFloatType: 'Smallest of Start Float and Finish Float', MakeOpenEndedActivitiesCritical: '1',
        OutOfSequenceScheduleType: 'Progress Override', RelationshipLagCalendar: 'Successor Activity Calendar',
        StartToStartLagCalculationType: '0', UseExpectedFinishDates: '0',
      },
      xer: {
        sched_float_type: 'FT_MIN', sched_open_critical_flag: 'Y', sched_retained_logic: 'N', sched_progress_override: 'Y',
        sched_calendar_on_relationship_lag: 'rcal_Successor', sched_lag_early_start_flag: 'N', sched_use_expect_end_flag: 'N',
      },
    },
    {
      label: '24 uur, startspeling, Actual Dates',
      xml: { ComputeTotalFloatType: 'Start Float = Late Start - Early Start', OutOfSequenceScheduleType: 'Actual Dates', RelationshipLagCalendar: '24-Hour Calendar' },
      xer: { sched_float_type: 'FT_SS', sched_retained_logic: 'N', sched_progress_override: 'N', sched_calendar_on_relationship_lag: 'rcal_24Hour' },
    },
    {
      label: 'projectkalender, meerdere floatpaden',
      xml: { RelationshipLagCalendar: 'Project Default Calendar', MultipleFloatPathsEnabled: '1', MultipleFloatPathsUseTotalFloat: '0', MaximumMultipleFloatPaths: '4' },
      xer: { sched_calendar_on_relationship_lag: 'rcal_ProjDefault', enable_multiple_longest_path_calc: 'Y', use_total_float_multiple_longest_paths: 'N', limit_multiple_longest_path_calc: 'Y', max_multiple_longest_path: '4' },
    },
  ];
  for (const testCase of cases) {
    const viaXml = openXml(withXml(testCase.xml));
    const viaXer = openXer(withXer(testCase.xer));
    eq(`P3 ${testCase.label}: zelfde opties`, optionsOf(viaXml), optionsOf(viaXer));
  }
}

// ── P4: zonder <ScheduleOptions> de P6-standaard, zoals een XER zonder SCHEDOPTIONS ──────────────
{
  const base = synthetic({}, 'RETAINED_LOGIC');
  const xml = xmlText(base).replace(/<ScheduleOptions>[\s\S]*?<\/ScheduleOptions>/, '');
  const lines = xerText(base).split('\r\n');
  const tableAt = lines.findIndex(line => line === '%T\tSCHEDOPTIONS');
  const xer = [...lines.slice(0, tableAt), ...lines.slice(tableAt + 3)].join('\r\n');
  eq('P4 zonder rekenopties: zelfde opties', optionsOf(openXml(xml)), optionsOf(openXer(xer)));
}

eq('P5 geen enkele activiteit wijkt af', differingTotal, 0);

for (const note of notes) console.log(`   · ${note}`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`XX ${failure}`);
  console.log(`check-p6xml-xer-parity: ${failures.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`check-p6xml-xer-parity: ${checks} checks groen`);
