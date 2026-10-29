import './domStub';
// MSPDI-export: drie contracten tussen OPS en het XML-bestand (issues #555, #556, #561).
//
//  §1 #555 kalendertijd: een ELAPSEDTIME-taak schrijft klokminuten (24 u per dag), op elke kalender gelijk;
//     een dagtaak en een urentaak met dezelfde kalenderduur geven dezelfde XML-duur. WORKTIME telt in de
//     werktijd per dag van de taakkalender. Orakel: `elapsedMinutesOf` van de motor, los van de writer.
//  §2 #556 tijdsafhankelijke capaciteit: `availabilitySteps` gaan als `<AvailabilityPeriods>` mee, sluitend
//     over de hele tijdlijn (vóór de eerste stap de vlakke waarde, na de laatste een open einde), en de
//     lezer zet ze terug. Gelijke ingangsdatum: de laatste in de lijst wint, zoals `maxUnitsOn`.
//  §3 #561 kritiek-drempel: met `thresholdHours` (die wint in de motor) schrijft de writer de dagdrempel
//     niet als `CriticalSlackLimit`; de verliesdetector zegt in dat geval ook dat het verlies is.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { availabilityFromPeriods } from '@/services/msproject/mspdiAvailability';
import { elapsedMinutesOf } from '@/engine/scheduler/duration';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { effHoursPerDay } from '@/utils/taskDuration';
import { detectXerExportLoss } from '@/services/xerExportLoss';
import {
  createEmptyXerArchiveDiagnostics, createEmptyXerArchiveReadModel, createXerSourceArchive,
} from '@/services/xerSourceArchive';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { Resource } from '@/types/resource';
import { installDOMParser } from './xmldom-shim';

declare const process: { exit(code: number): never };

installDOMParser();

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}
function quiet<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
}

const project = (extra: Partial<Project> = {}): Project => ({ ...createDefaultProject(), startDate: '2026-11-02', ...extra });
const calendarOf = (start: number, end: number, hoursPerDay: number): WorkCalendar => ({
  ...createDefaultCalendar(2026), holidays: [], workStartHour: start, workEndHour: end, hoursPerDay,
});
const task = (id: string, time: Partial<Task['time']>): Task => ({
  id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: { ...createDefaultTaskTime('2026-11-02', 3), ...time },
});
const write = (p: Project, cal: WorkCalendar, tasks: Task[], resources: Resource[] = []) =>
  quiet(() => writeMSPDI(p, cal, tasks, [], resources, []));
/** De tekst van `<tag>` in het `<Task>`-blok van taak `name`. */
function taskField(xml: string, name: string, tag: string): string | undefined {
  const block = xml.split('<Task>').find(b => b.includes(`<Name>${name}</Name>`));
  return block?.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
}
const isoHours = (minutes: number) => `PT${Math.floor(minutes / 60)}H${minutes % 60}M0S`;

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 #555 — kalendertijd in klokuren
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const calendars: [string, WorkCalendar][] = [
    ['7,5 u', calendarOf(8, 16, 7.5)],
    ['8 u', calendarOf(7, 16, 8)],
    ['10 u', calendarOf(7, 17, 10)],
    ['24 u', calendarOf(0, 24, 24)],
  ];
  for (const [label, cal] of calendars) {
    const elapsedDay = task('KD', { durationType: 'ELAPSEDTIME', scheduleDuration: 3, remainingTime: 2, completion: 1 / 3 });
    const elapsedHour = task('KU', { durationType: 'ELAPSEDTIME', durationUnit: 'hours', scheduleDuration: 3, durationMinutes: 3 * 1440, remainingMinutes: 2 * 1440, completion: 1 / 3 });
    const elapsedZero = task('KN', { durationType: 'ELAPSEDTIME', scheduleDuration: 0, remainingTime: 0 });
    const work = task('WD', { durationType: 'WORKTIME', scheduleDuration: 3, remainingTime: 2 });
    const xml = write(project(), cal, [elapsedDay, elapsedHour, elapsedZero, work]);
    const oracle = elapsedMinutesOf(elapsedDay, { isHourMode: false, hoursPerDay: cal.hoursPerDay });
    same(`§1 ${label}: orakel elapsedMinutesOf`, oracle, 4320);
    same(`§1 ${label}: dagtaak kalendertijd Duration`, taskField(xml, 'KD', 'Duration'), isoHours(oracle));
    same(`§1 ${label}: dagtaak kalendertijd RemainingDuration`, taskField(xml, 'KD', 'RemainingDuration'), isoHours(2 * 1440));
    same(`§1 ${label}: dagtaak kalendertijd DurationFormat`, taskField(xml, 'KD', 'DurationFormat'), '8');
    same(`§1 ${label}: urentaak kalendertijd Duration = dagtaak`, taskField(xml, 'KU', 'Duration'), taskField(xml, 'KD', 'Duration'));
    same(`§1 ${label}: urentaak kalendertijd RemainingDuration = dagtaak`, taskField(xml, 'KU', 'RemainingDuration'), taskField(xml, 'KD', 'RemainingDuration'));
    same(`§1 ${label}: urentaak kalendertijd DurationFormat`, taskField(xml, 'KU', 'DurationFormat'), '6');
    same(`§1 ${label}: nulduur kalendertijd`, [taskField(xml, 'KN', 'Duration'), taskField(xml, 'KN', 'RemainingDuration')], ['PT0H0M0S', 'PT0H0M0S']);
    const hpd = effHoursPerDay(cal);
    same(`§1 ${label}: WORKTIME telt in de werktijd van de kalender`,
      [taskField(xml, 'WD', 'Duration'), taskField(xml, 'WD', 'RemainingDuration'), taskField(xml, 'WD', 'DurationFormat')],
      [isoHours(3 * hpd * 60), isoHours(2 * hpd * 60), '7']);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 #556 — tijdsafhankelijke capaciteit
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const cal = calendarOf(7, 16, 8);
  const res = (id: string, extra: Partial<Resource>): Resource =>
    ({ id, name: id, type: 'LABOR', description: '', maxUnits: 1, ...extra });
  const resources: Resource[] = [
    // Ongeordend, fractioneel en met een nul-periode.
    res('R', { availabilitySteps: [{ from: '2026-11-09', maxUnits: 0.5 }, { from: '2026-11-02', maxUnits: 2 }, { from: '2026-11-16', maxUnits: 0 }] }),
    // Gelijke ingangsdatum: de laatste in de lijst wint (maxUnitsOn).
    res('D', { maxUnits: 3, availabilitySteps: [{ from: '2026-11-05', maxUnits: 1 }, { from: '2026-11-05', maxUnits: 4 }] }),
    res('V', { maxUnits: 2 }),
  ];
  const xml = write(project(), cal, [task('T', {})], resources);
  const resBlock = (name: string) => xml.split('<Resource>').find(b => b.includes(`<Name>${name}</Name>`)) ?? '';
  // De writer zet elk element op een eigen regel; voor de vergelijking de witruimte eruit.
  const flat = (s: string) => s.replace(/>\s+</g, '><');
  const periodsFlat = (name: string) => {
    const block = flat(resBlock(name));
    return [...block.matchAll(
      /<AvailabilityPeriod><AvailableFrom>([^<]*)<\/AvailableFrom><AvailableTo>([^<]*)<\/AvailableTo><AvailableUnits>([^<]*)<\/AvailableUnits><\/AvailabilityPeriod>/g,
    )].map(m => [m[1], m[2], Number(m[3])]);
  };
  same('§2 R: periodes sluitend over de hele tijdlijn', periodsFlat('R'), [
    ['1984-01-01T00:00:00', '2026-11-01T23:59:00', 1],
    ['2026-11-02T00:00:00', '2026-11-08T23:59:00', 2],
    ['2026-11-09T00:00:00', '2026-11-15T23:59:00', 0.5],
    ['2026-11-16T00:00:00', '2049-12-31T23:59:00', 0],
  ]);
  same('§2 R: MaxUnits blijft de vlakke waarde', flat(resBlock('R')).match(/<MaxUnits>([^<]*)</)?.[1], '1');
  same('§2 D: gelijke datum, de laatste wint', periodsFlat('D'), [
    ['1984-01-01T00:00:00', '2026-11-04T23:59:00', 3],
    ['2026-11-05T00:00:00', '2049-12-31T23:59:00', 4],
  ]);
  same('§2 V: vlakke resource zonder periodes', resBlock('V').includes('AvailabilityPeriod'), false);

  // Terug inlezen: dezelfde capaciteit vóór, op en na elke grens.
  const back = quiet(() => readMSPDI(xml));
  const byName = new Map(back.resources.map(r => [r.name, r]));
  const days = ['2026-10-30', '2026-11-01', '2026-11-02', '2026-11-08', '2026-11-09', '2026-11-15', '2026-11-16', '2027-06-01'];
  for (const r of resources) {
    const got = byName.get(r.name);
    same(`§2 ${r.name}: capaciteitscurve na terug inlezen`,
      got ? days.map(d => maxUnitsOn(got, d)) : null, days.map(d => maxUnitsOn(r, d)));
  }
  same('§2 V: terug ingelezen zonder stappen', byName.get('V')?.availabilitySteps, undefined);

  // Een tabel uit MS Project zelf: één standaardrij NA–NA geeft geen stappen; een gat en een einde vóór NA
  // tellen als 0 (niet beschikbaar).
  same('§2 lezer: standaardrij NA–NA is vlak',
    availabilityFromPeriods(1, [{ from: '1984-01-01', to: '2049-12-31', units: 1 }]), { maxUnits: 1 });
  same('§2 lezer: gat en einde vóór NA tellen als 0',
    availabilityFromPeriods(1, [
      { from: '1984-01-01', to: '2026-11-06', units: 1.5 },
      { from: '2026-11-16', to: '2026-11-20', units: 2 },
    ]), { maxUnits: 1.5, availabilitySteps: [
      { from: '2026-11-07', maxUnits: 0 }, { from: '2026-11-16', maxUnits: 2 }, { from: '2026-11-21', maxUnits: 0 },
    ] });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 #561 — kritiek-drempel met thresholdHours
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const cal = calendarOf(7, 16, 8);
  const slack = (cd: NonNullable<NonNullable<Project['schedulingOptions']>['criticalDefinition']>) =>
    write(project({ schedulingOptions: { criticalDefinition: cd } }), cal, [task('T', {})]).match(/<CriticalSlackLimit>([^<]*)</)?.[1];
  same('§3 alleen hele dagdrempel: CriticalSlackLimit blijft', slack({ mode: 'totalFloat', threshold: 2 }), '2');
  same('§3 dagdrempel én thresholdHours: geen CriticalSlackLimit', slack({ mode: 'totalFloat', threshold: 1, thresholdHours: 4 }), undefined);
  same('§3 alleen thresholdHours: geen CriticalSlackLimit', slack({ mode: 'totalFloat', thresholdHours: 16 }), undefined);
  // Writer en verliesdetector zijn het eens: wat de writer niet schrijft, meldt de detector als verlies.
  const lossFor = (cd: NonNullable<NonNullable<Project['schedulingOptions']>['criticalDefinition']>) =>
    detectXerExportLoss('mspdi', {
      sourceArchive: createXerSourceArchive(new Uint8Array(), {
        encoding: 'utf-8', bom: 'none', newline: 'none',
        diagnostics: createEmptyXerArchiveDiagnostics(),
        readModel: createEmptyXerArchiveReadModel(),
      }),
      importMetadata: null,
      project: { schedulingOptions: { criticalDefinition: cd }, schedulingProfile: undefined } as never,
      tasks: [], sequences: [], assignments: [], activityCodeTypes: [], customFieldDefs: [], baselines: [], activeBaselineId: null,
    })[0]?.categories.includes('schedule-options-and-provenance') ?? false;
  same('§3 detector: hele dagdrempel is geen verlies', lossFor({ mode: 'totalFloat', threshold: 2 }), false);
  same('§3 detector: thresholdHours is verlies', lossFor({ mode: 'totalFloat', threshold: 1, thresholdHours: 4 }), true);
}

console.log(`check-mspdi-export-klok-capaciteit-drempel: ${checks} controles, ${failures.length} fout`);
for (const f of failures) console.log(`XX ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
