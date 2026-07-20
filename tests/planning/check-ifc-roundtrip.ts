// IFC-ROUND-TRIP-CONTRACT (fase 3, eerste helft van P11 uit docs/superpowers/modulariteit-audit.md,
// bevinding A2/F2). IFC 4.3 is het NATIVE bestandsformaat: opslaan = writeIFC, laden = readIFC. Het
// impliciete contract "alle domeindata moet door de IFC-laag round-trippen" had géén test — twee
// dataverlies-bugs (B4: IFCPanel schreef zonder baselines; F6: open-paden namen structuur niet over)
// waren daardoor onzichtbaar. Deze batterij maakt dat contract expliciet en bewaakt het permanent.
//
// AANPAK
//   1. Eén MAXIMAAL bevolkte fixture: elk veld van elk domeintype met een niet-default,
//      onderscheidende waarde (Task/TaskTime incl. constraints/actuals/notes/hammock/externalLinks/
//      activity-codes/custom-fields, Sequence alle 4 types + lag-varianten, Resource alle types +
//      curves + capaciteit, WorkCalendar + generation + shift + holidays, Project incl.
//      schedulingOptions/statusDate/progressMode, ActivityCode/CustomField-definities, Baselines).
//   2. COMPILE-AFDWINGING: de kern-fixtures zijn `satisfies Required<...>` — een nieuw domeinveld
//      geeft een compile-fout hier (via tests/planning/tsconfig.roundtrip.json, want de hoofd-
//      tsconfig sluit tests/ uit). Zo is de batterij ZELF-UITBREIDEND: nieuw veld → fixture MOET
//      bijgewerkt → de round-trip bewaakt het automatisch. Twee types kunnen NIET direct
//      `satisfies Required<>` (mutueel-exclusieve velden) → type-only getuige, zie WITNESS hieronder.
//   3. writeIFC(fixture) → readIFC → diepe, veld-voor-veld-vergelijking van de HELE ImportResult.
//      Gegenereerde ids (task/resource/sequence/kalender regenereren bij inlezen) worden
//      genormaliseerd via NATUURLIJKE SLEUTELS (wbsCode/naam) i.p.v. letterlijk vergeleken; alle
//      kruisverwijzingen (parentId/childIds/pred/succ/calendarId/taskId/resourceId/activityCodes)
//      worden naar die sleutels herschreven. Datum-normalisaties (het 07:00-anker) round-trippen
//      naar dag-datums en zijn in de fixture al in dag-vorm gekozen.
//   4. IDEMPOTENTIE: een TWEEDE round-trip (write→read→write→read) moet byte-stabiel zijn t.o.v. de
//      eerste (canon(rt1) === canon(rt2)).
//   5. KNOWN_GAPS: velden die NIET overleven, expliciet geclassificeerd + getest-als-bekend (elke
//      gap-assertie bewijst dat het verlies er NOG steeds is; verdwijnt het verlies — iemand fixt de
//      writer/reader — dan FAALT de assertie en herinnert die eraan de gap uit KNOWN_GAPS te halen).
//      GEEN productiecode-fix in dit pakket; de gaps zijn gerapporteerd aan de opdrachtgever.
//
// KNOWN_GAPS (write→read verlies), classificatie (b) bewuste normalisatie. De acht (a)-gaps
// (project.author/company/description/createdAt/modifiedAt, task.color/resourceIds,
// task.time.interferingFloat/isNearCritical/floatPath) zijn in werkpakket H2 GEDICHT — ze lopen nu
// door de echte round-trip-vergelijking. author/company via de IFCPERSON/IFCORGANIZATION-keten;
// description via de IFCWORKPLAN/IFCPROJECT.Description-slot; createdAt/modifiedAt via het
// OPS_ProjectSettings-pset; color via OPS_TaskAppearance; resourceIds herbouwd uit de assignments
// (enige bron van waarheid, geen dubbele opslag); de drie analyse-velden via OPS_Analysis. Wat
// bewust NIET round-trippt:
//   (b) resource.availability — @deprecated migratie-alleen veld; writer schrijft 'm bewust niet.
//   (b) task.time.durationMinutes / remainingMinutes — UUR-modus-velden; niet van toepassing in dag-modus
//                             (deze fixture is dag-modus). hun uur-round-trip is gedekt door
//                             tests/planning/check-adapters-hours.ts.
//   (b) resourceCalendars: de projectkalender-entry wordt bewust NIET in de bibliotheek gedupliceerd
//                             (writer filtert 'm eruit; reader geeft de bibliotheek zonder projectkalender).
//   Overige bewuste (b)-normalisaties die de fixture al in genormaliseerde vorm kiest (dus GEEN
//   afwijking geven): ids regenereren (→ natuurlijke sleutels), project.calendarId→'cal-default',
//   project.startDate/endDate→taak-span, ASAP-constraint niet geschreven, shift FIRST→undefined,
//   lagUnit WORKTIME→undefined, curve UNIFORM→undefined, progressMode RETAINED_LOGIC→undefined,
//   completion→1 decimaal, dag-duren integer, hoursPerDay=eind−startuur, priority 500 niet geschreven.

import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { Task, TaskTime, ExternalLink } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project, SchedulingOptions } from '@/types/project';
import type { WorkCalendar, CalendarGeneration } from '@/types/calendar';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';

// tests/ valt buiten de hoofd-tsconfig; process is niet via @types/node beschikbaar in de
// dedicated round-trip-tsconfig (types:[]). Minimale, botsingvrije declaratie.
declare const process: { exit(code: number): never };

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  FIXTURE — maximaal bevolkt, dag-modus. Kern-objecten zijn `satisfies Required<...>` zodat een
//  nieuw domeinveld hier een compile-fout geeft.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── Kalenders ───────────────────────────────────────────────────────────────────────────────────
// Dag-kalenders: hoursPerDay = workEndHour − workStartHour (anders normaliseert de reader het weg),
// generation volledig (ruleSetId/region/breakChoice/jaren), niet-default shift, ≥1 holiday (anders
// houdt de reader de default-NL-holidays van createDefaultCalendar).
const PROJ_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'NL', region: 'NB', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028,
};
const LIB_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'DE', region: 'BY', breakChoice: 'noord', generatedFromYear: 2024, generatedToYear: 2027,
};
const projCal = {
  id: 'projcal', name: 'Projectkalender', description: 'Ma-vr 07-15 dag',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
    { name: 'Nieuwjaar', startDate: '2027-01-01', endDate: '2027-01-01' },
  ],
  generation: PROJ_GEN, shift: 'SECOND',
} satisfies Omit<Required<WorkCalendar>, 'workTime'>;
const libCal = {
  id: 'libcal', name: 'Sublokatie kalender', description: 'Ma-za 07-15',
  workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [{ name: 'Bouwvakdag', startDate: '2026-07-27', endDate: '2026-07-31' }],
  generation: LIB_GEN, shift: 'THIRD',
} satisfies Omit<Required<WorkCalendar>, 'workTime'>;

// Type-only VOLLEDIGHEIDSGETUIGE voor WorkCalendar: `workTime` aanwezig ⇒ UUR-kalender, wat de
// dag-modus-round-trip zou ontsporen (durationMinutes/echte tijden). De veld-volledigheid van
// WorkCalendar bewaken we daarom hier op typeniveau; de round-trip-fixtures blijven dag-modus. De
// uur-modus-round-trip (workTime/banden) is gedekt door check-adapters-hours.ts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CALENDAR_FIELD_WITNESS = {
  id: 'w', name: 'w', description: 'w', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  generation: PROJ_GEN, shift: 'FIRST',
  workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
} satisfies Required<WorkCalendar>;

// ── Structuurdefinities (round-trippen verliesloos via OPS_StructureMeta-JSON, incl. ids/kleuren) ─
const activityCodeTypes = [
  {
    id: 'act-loc', name: 'Locatie', values: [
      { id: 'v-b1', code: 'B1', description: 'Blok 1', color: '#ff0000' },
      { id: 'v-b2', code: 'B2', description: 'Blok 2', color: '#00ff00' },
    ],
  },
  {
    id: 'act-dis', name: 'Discipline', values: [
      { id: 'v-ruw', code: 'RUW', description: 'Ruwbouw', color: '#0000ff' },
      { id: 'v-afb', code: 'AFB', description: 'Afbouw', color: '#ffff00' },
    ],
  },
] satisfies ActivityCodeType[];
const customFieldDefs = [
  { id: 'cf-text', name: 'Tekstveld', type: 'text' },
  { id: 'cf-num', name: 'Getalveld', type: 'number' },
  { id: 'cf-int', name: 'Integerveld', type: 'integer' },
  { id: 'cf-cost', name: 'Kostenveld', type: 'cost' },
  { id: 'cf-date', name: 'Datumveld', type: 'date' },
  { id: 'cf-bool', name: 'Booleanveld', type: 'boolean' },
] satisfies CustomFieldDef[];

// ── Taken ─────────────────────────────────────────────────────────────────────────────────────
// TP: summary-parent (childIds). TM: KITCHEN-SINK milestone (`satisfies Required<Task>` +
// Required<TaskTime>) — draagt élk Task/TaskTime-veld. Een milestone omdat milestoneKind/mandatory
// alleen voor milestones geschreven worden; scheduleDuration is dan per definitie 0. TX/TY: gewone
// leaf-taken (duur>0, relaties, assignments).
const plainTime = (start: string, finish: string, dur: number): TaskTime => ({
  durationType: 'WORKTIME', scheduleDuration: dur,
  scheduleStart: start, scheduleFinish: finish,
  earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
});

const TP: Task = {
  id: 't-p', name: 'Fasering', description: 'Hoofdfase', wbsCode: '1',
  taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: null, childIds: ['t-m', 't-x', 't-y'], resourceIds: [],
  time: plainTime('2026-07-06', '2026-07-24', 14),
};

const TM = {
  id: 't-m', name: 'Oplevering', description: 'Contractuele opleverdatum', wbsCode: '1.1',
  taskType: 'INSTALLATION', status: 'COMPLETED', isMilestone: true, milestoneKind: 'FINISH',
  mandatory: true, priority: 700, levelingDelay: 3, parentId: 't-p', childIds: [],
  resourceIds: [], // milestone zonder assignments ⇒ afgeleide resourceIds is leeg (H2-fix)
  color: '#abcdef', // round-trippt via OPS_TaskAppearance (H2-fix)
  isHammock: true,
  activityCodes: { 'act-loc': 'v-b1', 'act-dis': 'v-ruw' },
  customFields: {
    'cf-text': 'hallo', 'cf-num': 3.14, 'cf-int': 7, 'cf-cost': 1250.5, 'cf-date': '2026-08-01', 'cf-bool': true,
  },
  constraint: { type: 'MSO', date: '2026-07-15', hard: true },
  constraint2: { type: 'FNLT', date: '2026-07-20' },
  externalLinks: [{
    id: 'e1', direction: 'predecessor', relType: 'FS', lagDays: 2, lagMinutes: 120,
    anchorDate: '2026-07-01',
    sourceRef: { projectId: 'p2', projectName: 'Ander project', taskId: 't9', taskName: 'Levering', filePath: '/x/ander.ifc' },
    sourceMissing: false,
  }],
  deadline: '2026-07-22',
  calendarId: 'libcal',
  notes: [{ id: 'n1', text: 'Keuring', done: true }, { id: 'n2', text: 'Sleuteloverdracht', done: false }],
  time: {
    durationType: 'WORKTIME', scheduleDuration: 0,
    durationMinutes: 480,           // (b) uur-modus-gap
    scheduleStart: '2026-07-24', scheduleFinish: '2026-07-24',
    earlyStart: '2026-07-24', earlyFinish: '2026-07-24', lateStart: '2026-07-24', lateFinish: '2026-07-24',
    freeFloat: 2, totalFloat: 3, isCritical: true,
    interferingFloat: 1.5, isNearCritical: true, floatPath: 1, // (a) analyse-gaps
    actualStart: '2026-07-24', actualFinish: '2026-07-24', actualDuration: 0,
    remainingTime: 0, remainingMinutes: 0, // remainingMinutes: (b) uur-modus-gap
    completion: 1,
  },
} satisfies Required<Task> & { time: Required<TaskTime> };

const TX: Task = {
  id: 't-x', name: 'Ruwbouw', description: 'Casco', wbsCode: '1.2',
  taskType: 'DEMOLITION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-mem'], // afgeleid uit a1/a2 (H2-fix)
  time: plainTime('2026-07-06', '2026-07-10', 5),
};
const TY: Task = {
  id: 't-y', name: 'Installaties', description: 'E+W', wbsCode: '1.3',
  taskType: 'LOGISTIC', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-eq'], // afgeleid uit a3 (H2-fix)
  time: plainTime('2026-07-13', '2026-07-17', 5),
};
const tasks: Task[] = [TP, TM, TX, TY];

// ── Relaties: alle 4 types + lag-varianten (vaste dagen / ELAPSEDTIME / procent / geen lag) ──────
// `Sequence` kan NIET direct `satisfies Required<Sequence>`: lagDays/lagMinutes/lagPercent zijn
// mutueel exclusief (lagPercent wint altijd in de writer en zou lagDays overschrijven). De
// veld-volledigheid bewaken we via een type-only getuige; de round-trip-relaties zijn realistisch.
const sequences: Sequence[] = [
  { id: 's1', predecessorId: 't-x', successorId: 't-m', type: 'FINISH_START', lagDays: 2, lagUnit: 'ELAPSEDTIME' },
  { id: 's2', predecessorId: 't-x', successorId: 't-y', type: 'START_START', lagDays: 0, lagPercent: 50 },
  { id: 's3', predecessorId: 't-y', successorId: 't-m', type: 'FINISH_FINISH', lagDays: 1 },
  { id: 's4', predecessorId: 't-x', successorId: 't-m', type: 'START_FINISH', lagDays: 0 },
];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SEQUENCE_FIELD_WITNESS = {
  id: 'w', predecessorId: 'a', successorId: 'b', type: 'FINISH_START',
  lagDays: 1, lagMinutes: 60, lagUnit: 'WORKTIME', lagPercent: 25,
} satisfies Required<Sequence>;

// ── Resources: alle types + ploeg-nesting + capaciteit/tarief/eenheid/tijd-gefaseerd ─────────────
const RCrew: Resource = { id: 'r-crew', name: 'Ploeg Alpha', type: 'CREW', description: 'Hoofdploeg', maxUnits: 1 };
const RMember = {
  id: 'r-mem', name: 'Timmerman Jan', type: 'LABOR', description: 'Ervaren timmerman',
  costPerHour: 42.5, availability: 0.9, // availability: (b) deprecated gap
  maxUnits: 3, calendarId: 'libcal',
  availabilitySteps: [{ from: '2026-07-06', maxUnits: 3 }, { from: '2026-07-20', maxUnits: 2 }],
  unitOfMeasure: 'uur', parentId: 'r-crew',
} satisfies Required<Resource>;
const REquip: Resource = { id: 'r-eq', name: 'Torenkraan', type: 'EQUIPMENT', description: 'Liebherr 200', maxUnits: 2 };
const RMat: Resource = { id: 'r-mat', name: 'Beton C30', type: 'MATERIAL', description: 'Stortbeton', maxUnits: 1, unitOfMeasure: 'm3' };
const RSub: Resource = { id: 'r-sub', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: 'Onderaannemer', maxUnits: 1 };
const resources: Resource[] = [RCrew, RMember, REquip, RMat, RSub];

// ── Toewijzingen: incl. twee assignments van DEZELFDE resource op één taak (M3-uniciteit) + curve ─
const A1 = { id: 'a1', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 2, curve: 'BELL' } satisfies Required<ResourceAssignment>;
const assignments: ResourceAssignment[] = [
  A1,
  { id: 'a2', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 1, curve: 'LATE_PEAK' },
  { id: 'a3', taskId: 't-y', resourceId: 'r-eq', unitsPerDay: 1 }, // geen curve → UNIFORM-normalisatie
];

// ── Project incl. schedulingOptions/statusDate/progressMode/wbsAutoNumber ─────────────────────────
const SCHED_OPTS = {
  lagCalendar: 'successor',
  criticalDefinition: { mode: 'longestPath', threshold: -1 },
  totalFloatMode: 'finish',
  makeOpenEndedCritical: true,
  nearCriticalThreshold: 3,
  floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
} satisfies Required<SchedulingOptions>;
const project = {
  id: 'proj-1', name: 'Nieuwbouw Testtoren', description: 'Beschrijving X', // description: (a) gap
  startDate: '2026-07-06', endDate: '2026-07-24', calendarId: 'projcal',
  createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-06-01T00:00:00.000Z', // (a) gaps
  author: 'Ir. Testz', company: 'Bouw BV',                                       // (a) gaps
  wbsAutoNumber: true, statusDate: '2026-07-25', progressMode: 'PROGRESS_OVERRIDE',
  schedulingOptions: SCHED_OPTS,
} satisfies Required<Project> & { schedulingOptions: Required<SchedulingOptions> };

// ── Baselines (round-trippen verliesloos via OPS_Baselines-JSON; taskId remapt via GlobalId) ──────
const baselines = [{
  id: 'bl-1', name: 'Nulmeting', createdAt: '2026-07-01T09:00:00.000Z',
  tasks: [
    { taskId: 't-m', start: '2026-07-24', finish: '2026-07-24', duration: 0, isMilestone: true, milestoneKind: 'FINISH' },
    { taskId: 't-x', start: '2026-07-06', finish: '2026-07-10', duration: 5, isMilestone: false, milestoneKind: 'START' },
  ],
  projectEnd: '2026-07-24', projectDuration: 14,
}] satisfies Baseline[];

export const fixture: ImportResult = {
  project, calendar: projCal, tasks, sequences, resources, assignments,
  resourceCalendars: [projCal, libCal], // projCal-entry wordt door de writer eruit gefilterd (b)
  activityCodeTypes, customFieldDefs, baselines, activeBaselineId: 'bl-1',
};

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  CANONICALISATIE — vervang volatiele ids door natuurlijke sleutels, herschrijf kruisverwijzingen,
//  strip de KNOWN_GAPS-velden (aan BEIDE zijden, zodat ze geen mismatch geven; het VERLIES zelf
//  bewijzen we los in assertGaps). Levert een puur, vergelijkbaar objectboom.
// ════════════════════════════════════════════════════════════════════════════════════════════════

type Any = Record<string, unknown>;
const def = <T>(v: T | undefined): v is T => v !== undefined;

function canon(r: ImportResult): Any {
  const cals = [r.calendar, ...(r.resourceCalendars ?? [])];
  const calNameById = new Map(cals.map(c => [c.id, c.name]));
  const taskKeyById = new Map(r.tasks.map(t => [t.id, t.wbsCode]));
  const resNameById = new Map(r.resources.map(res => [res.id, res.name]));
  // activity-code/custom-field-id → leesbare sleutel (naam/code), voor robuustheid ook al bewaart
  // de meta-JSON de ids letterlijk.
  const typeNameById = new Map((r.activityCodeTypes ?? []).map(t => [t.id, t.name]));
  const codeById = new Map<string, string>();
  for (const t of r.activityCodeTypes ?? []) for (const v of t.values) codeById.set(v.id, v.code);
  const defNameById = new Map((r.customFieldDefs ?? []).map(d => [d.id, d.name]));

  const calKey = (id: string | undefined): string | undefined => (id ? calNameById.get(id) ?? id : undefined);

  const canonCal = (c: WorkCalendar): Any => ({
    name: c.name, description: c.description, workDays: [...c.workDays],
    workStartHour: c.workStartHour, workEndHour: c.workEndHour, hoursPerDay: c.hoursPerDay,
    holidays: [...c.holidays].sort((a, b) => a.name.localeCompare(b.name))
      .map(h => ({ name: h.name, startDate: h.startDate, endDate: h.endDate })),
    generation: c.generation, shift: c.shift,
  });

  const canonTime = (t: TaskTime): Any => ({
    // Gestripte (b)-gaps: durationMinutes/remainingMinutes (uur-modus, n.v.t. in dag-modus).
    // interferingFloat/isNearCritical/floatPath round-trippen sinds pakket K BEWUST NIET meer mee:
    // de writer schrijft `OPS_Analysis` niet langer omdat het pure runCPM-uitvoer is die élk
    // laadpad herberekent (zie ifcWriter.WRITTEN_PER_TASK_PSETS). Ze staan daarom weer als
    // (a)-gap in KNOWN_GAPS hieronder — de LEESkant blijft bestaande bestanden gewoon accepteren.
    durationType: t.durationType, scheduleDuration: t.scheduleDuration,
    scheduleStart: t.scheduleStart, scheduleFinish: t.scheduleFinish,
    earlyStart: t.earlyStart, earlyFinish: t.earlyFinish, lateStart: t.lateStart, lateFinish: t.lateFinish,
    freeFloat: t.freeFloat, totalFloat: t.totalFloat, isCritical: t.isCritical,
    actualStart: t.actualStart, actualFinish: t.actualFinish, actualDuration: t.actualDuration,
    remainingTime: t.remainingTime, completion: t.completion,
  });

  const canonTask = (t: Task): Any => ({
    // color + resourceIds round-trippen sinds H2 (OPS_TaskAppearance resp. herbouw uit assignments).
    // resourceIds naar natuurlijke sleutels (resource-naam) + gesorteerd (volgorde-onafhankelijk).
    wbsCode: t.wbsCode, name: t.name, description: t.description, taskType: t.taskType,
    color: t.color,
    resourceIds: [...t.resourceIds].map(id => resNameById.get(id) ?? id).sort(),
    status: t.status, isMilestone: t.isMilestone, milestoneKind: t.milestoneKind, mandatory: t.mandatory,
    priority: t.priority, levelingDelay: t.levelingDelay,
    parent: t.parentId ? taskKeyById.get(t.parentId) ?? t.parentId : null,
    children: t.childIds.map(c => taskKeyById.get(c) ?? c).sort(),
    calendar: calKey(t.calendarId),
    activityCodes: t.activityCodes
      ? Object.fromEntries(Object.entries(t.activityCodes).map(([ty, va]) => [typeNameById.get(ty) ?? ty, codeById.get(va) ?? va]))
      : undefined,
    customFields: t.customFields
      ? Object.fromEntries(Object.entries(t.customFields).map(([d, v]) => [defNameById.get(d) ?? d, v]))
      : undefined,
    constraint: t.constraint, constraint2: t.constraint2, deadline: t.deadline,
    isHammock: t.isHammock, externalLinks: t.externalLinks, notes: t.notes,
    time: canonTime(t.time),
  });

  const canonSeq = (s: Sequence): Any => ({
    pred: taskKeyById.get(s.predecessorId) ?? s.predecessorId,
    succ: taskKeyById.get(s.successorId) ?? s.successorId,
    type: s.type, lagDays: s.lagDays, lagUnit: s.lagUnit, lagPercent: s.lagPercent, lagMinutes: s.lagMinutes,
  });

  const canonRes = (res: Resource): Any => ({
    // Gestript gap: availability.
    name: res.name, type: res.type, description: res.description,
    costPerHour: res.costPerHour, maxUnits: res.maxUnits, unitOfMeasure: res.unitOfMeasure,
    availabilitySteps: res.availabilitySteps, calendar: calKey(res.calendarId),
    parent: res.parentId ? resNameById.get(res.parentId) ?? res.parentId : undefined,
  });

  const canonAsg = (a: ResourceAssignment): Any => ({
    task: taskKeyById.get(a.taskId) ?? a.taskId, resource: resNameById.get(a.resourceId) ?? a.resourceId,
    unitsPerDay: a.unitsPerDay, curve: a.curve,
  });

  const canonBaseline = (b: Baseline): Any => ({
    id: b.id, name: b.name, createdAt: b.createdAt, projectEnd: b.projectEnd, projectDuration: b.projectDuration,
    tasks: (b.tasks ?? []).map(bt => ({
      task: taskKeyById.get(bt.taskId) ?? bt.taskId, start: bt.start, finish: bt.finish,
      duration: bt.duration, isMilestone: bt.isMilestone, milestoneKind: bt.milestoneKind,
    })).sort((x, y) => String(x.task).localeCompare(String(y.task))),
  });

  return {
    project: {
      // author/company/description/createdAt/modifiedAt round-trippen sinds H2.
      name: r.project.name, startDate: r.project.startDate, endDate: r.project.endDate,
      description: r.project.description, author: r.project.author, company: r.project.company,
      createdAt: r.project.createdAt, modifiedAt: r.project.modifiedAt,
      calendar: calKey(r.project.calendarId), wbsAutoNumber: r.project.wbsAutoNumber,
      statusDate: r.project.statusDate, progressMode: r.project.progressMode,
      schedulingOptions: r.project.schedulingOptions,
    },
    calendar: canonCal(r.calendar),
    resourceCalendars: (r.resourceCalendars ?? []).map(canonCal).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    tasks: [...r.tasks].sort((a, b) => a.wbsCode.localeCompare(b.wbsCode)).map(canonTask),
    sequences: [...r.sequences].map(canonSeq).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    resources: [...r.resources].sort((a, b) => a.name.localeCompare(b.name)).map(canonRes),
    assignments: [...r.assignments].map(canonAsg).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    activityCodeTypes: [...(r.activityCodeTypes ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => ({ name: t.name, values: [...t.values].sort((x, y) => x.code.localeCompare(y.code)).map(v => ({ code: v.code, description: v.description, color: v.color })) })),
    customFieldDefs: [...(r.customFieldDefs ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map(d => ({ name: d.name, type: d.type })),
    baselines: [...(r.baselines ?? [])].map(canonBaseline).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    activeBaselineId: r.activeBaselineId ?? null,
  };
}

/** Recursief diepe vergelijking met pad-rapportage; undefined ≡ afwezig (canon dropt gestripte gaps). */
function collectDiffs(path: string, a: unknown, b: unknown, out: string[]): void {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    if (aa.length !== bb.length) out.push(`${path}: array-lengte ${aa.length} ≠ ${bb.length}`);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) collectDiffs(`${path}[${i}]`, aa[i], bb[i], out);
    return;
  }
  const ao = a && typeof a === 'object' ? a as Any : undefined;
  const bo = b && typeof b === 'object' ? b as Any : undefined;
  if (ao || bo) {
    const keys = new Set([...Object.keys(ao ?? {}), ...Object.keys(bo ?? {})]);
    for (const k of [...keys].sort()) {
      const av = ao?.[k];
      const bv = bo?.[k];
      if (av === undefined && bv === undefined) continue;
      collectDiffs(path ? `${path}.${k}` : k, av, bv, out);
    }
    return;
  }
  if (a !== b) out.push(`${path}: verwacht ${JSON.stringify(a)} — kreeg ${JSON.stringify(b)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  DE CHECK
// ════════════════════════════════════════════════════════════════════════════════════════════════

// (1) Round-trip + veld-voor-veld. `expected` = de fixture met de bewuste (b)-normalisaties die het
//     canon-model niet al dekt: de projectkalender-entry uit de bibliotheek filteren (writer dedupt).
const expectedInput: ImportResult = { ...fixture, resourceCalendars: (fixture.resourceCalendars ?? []).filter(c => c.id !== fixture.project.calendarId) };
const rt1 = readIFC(writeIFC(fixture));
const rt2 = readIFC(writeIFC(rt1));

{
  const diffs: string[] = [];
  collectDiffs('', canon(expectedInput), canon(rt1), diffs);
  assert(diffs.length === 0, `round-trip-afwijkingen (${diffs.length}):\n${diffs.map(d => `        - ${d}`).join('\n')}`);
}

// (2) Idempotentie: tweede round-trip byte-stabiel t.o.v. de eerste (normalisatie is stabiel).
{
  const diffs: string[] = [];
  collectDiffs('', canon(rt1), canon(rt2), diffs);
  assert(diffs.length === 0, `idempotentie-afwijkingen (${diffs.length}):\n${diffs.map(d => `        - ${d}`).join('\n')}`);
}

// (3) KNOWN_GAPS — getest-als-bekend: elke assertie bewijst dat het verlies er NOG is. Faalt er één,
//     dan is de gap gedicht → haal 'm uit KNOWN_GAPS en neem 'm op in de round-trip-vergelijking.
{
  const tByWbs = (r: ImportResult, wbs: string) => r.tasks.find(t => t.wbsCode === wbs)!;
  const rMem = rt1.resources.find(r => r.name === 'Timmerman Jan')!;
  const tmOut = tByWbs(rt1, '1.1'); // Oplevering (kitchen-sink)
  const txOut = tByWbs(rt1, '1.2'); // Ruwbouw

  // De gaps author/company/description/createdAt/modifiedAt/color/resourceIds zijn in H2 gedicht —
  // die lopen nu door de echte round-trip-vergelijking hierboven.
  //
  // (a) HEROPEND in pakket K: interferingFloat/isNearCritical/floatPath. De writer schrijft de
  // `OPS_Analysis`-pset bewust niet meer — het is pure runCPM-uitvoer zonder gebruikersinvoer, die
  // élk laadpad direct herberekent (gemeten: 589/589 taken bit-exact identiek na runCPM), en hij
  // kostte ~157 kB over de publieke voorbeeldset plus ~21% van elke auto-save-schrijfactie.
  // Deze drie asserties bewijzen dat het verlies er is én bedoeld is: gaat er één falen, dan
  // schrijft iemand de pset weer en moet dit besluit opnieuw gewogen worden (niet de assert
  // aanpassen). De LEESkant is ongemoeid: bestaande bestanden mét de pset laden gewoon.
  assert(tmOut.time.interferingFloat === undefined && def(TM.time.interferingFloat), '(a) time.interferingFloat — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.isNearCritical === undefined && def(TM.time.isNearCritical), '(a) time.isNearCritical — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.floatPath === undefined && def(TM.time.floatPath), '(a) time.floatPath — afgeleid, OPS_Analysis niet meer geschreven');
  assert(tmOut.time.durationMinutes === undefined && def(TM.time.durationMinutes), '(b) time.durationMinutes n.v.t. in dag-modus');
  assert(tmOut.time.remainingMinutes === undefined && def(TM.time.remainingMinutes), '(b) time.remainingMinutes n.v.t. in dag-modus');
  assert(rMem.availability === undefined && def(RMember.availability), '(b) resource.availability (deprecated) niet geschreven');
  void txOut;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
if (fails === 0) {
  console.log(`OK  ifc-roundtrip: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-roundtrip: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
