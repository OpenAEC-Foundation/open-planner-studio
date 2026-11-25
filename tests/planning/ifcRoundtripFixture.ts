import type { Task, TaskTime, ExternalLink, TaskSplitGap, TaskTimephasedContour } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project, ProjectSchedulingOptions } from '@/types/project';
import type { WorkCalendar, CalendarGeneration } from '@/types/calendar';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  FIXTURE — maximaal bevolkt, dag-modus. Kern-objecten zijn `satisfies Required<...>` zodat een
//  nieuw domeinveld hier een compile-fout geeft.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── Kalenders ───────────────────────────────────────────────────────────────────────────────────
// Dag-kalenders: generation volledig (ruleSetId/region/breakChoice/jaren), niet-default shift,
// ≥1 holiday (anders houdt de reader de default-NL-holidays van createDefaultCalendar).
// `projCal` kiest BEWUST hoursPerDay 8 ≠ workEndHour−workStartHour (16−7=9, een impliciet lunchuur
// — precies zoals de echte standaard "Bouwkalender NL") om bugfix B2 te bewaken: die afwijking
// moet het `OPS_Calendar`-pset in (`HoursPerDay`) en round-trippen, niet stil normaliseren naar 9.
// `libCal` blijft bewust GELIJK (8-8=... nee: 15−7=8, dus GEEN afwijking) om het byte-identieke
// pad (geen extra pset-property nodig) mee te dekken.
const PROJ_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'NL', region: 'NB', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028,
};
const LIB_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'DE', region: 'BY', breakChoice: 'noord', generatedFromYear: 2024, generatedToYear: 2027,
};
// T5 (fase 3.8): `projCal` blijft BEWUST zonder werkende uitzonderingen — dat is de golden-rule-
// getuige (acceptatie 4: `verify:examples` byte-identiek zonder regeneratie). `libCal` draagt de
// twee werkende-uitzondering-vormen: (a) met eigen banden (override-uren) en (b) zonder banden
// (de weekdag-standaardbanden gelden — de "leeg ⇒ default"-clausule in `WorkingException.bands`,
// calendar.ts). Data-only fixture: de datums/weekdag-samenhang is hier niet relevant — dat is
// engine-semantiek, gedekt door tests/planning/check-calendar-hours.ts (T2).
const projCal = {
  id: 'projcal', name: 'Projectkalender', description: 'Ma-vr 07-16 dag (lunchuur)',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  holidays: [
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
    { name: 'Nieuwjaar', startDate: '2027-01-01', endDate: '2027-01-01' },
  ],
  workingExceptions: [],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: ['2026-12-27'],
  p6NonWorkPenaltyDatesState: 'VALID_VALUES',
  generation: PROJ_GEN, shift: 'SECOND',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-projcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
const libCal = {
  id: 'libcal', name: 'Sublokatie kalender', description: 'Ma-za 07-15',
  workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [{ name: 'Bouwvakdag', startDate: '2026-07-27', endDate: '2026-07-31' }],
  workingExceptions: [
    { name: 'Overwerkdag', startDate: '2026-08-08', endDate: '2026-08-08', bands: [{ start: 360, end: 720 }] },
    { name: 'Verschoven werkdag', startDate: '2026-08-15', endDate: '2026-08-15' },
  ],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: LIB_GEN, shift: 'THIRD',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-libcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;

// B7 (rapport-ifc): een UUR-bibliotheekkalender met werkblokken die per weekdag verschillen — een
// korte vrijdag. Geen taak gebruikt hem, dus de taken blijven dag-modus; `workTime` loopt wél door de
// echte vergelijking (`CALENDAR_CANON.workTime`). Vóór B7 schreef de writer alleen de blokken van de
// eerste werkdag en kwam vrijdag terug als 07:00–12:00 + 12:30–15:30. `workEndHour` 15.5 ≠ het einde
// van de eerste periode (12): de `WorkEndHour`-property moet hem dragen. `hoursPerDay` 8 = de modale
// dagsom (ma–do 8 u, vr 4 u), zoals de kalenderdialoog hem bij een uurkalender afleidt.
const MA_DO = [{ start: 420, end: 720 }, { start: 750, end: 930 }];
const hourCal = {
  id: 'hourcal', name: 'Uurkalender korte vrijdag', description: 'Ma-do 07:00-12:00 + 12:30-15:30, vr 07:00-11:00',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8,
  holidays: [{ name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' }],
  workingExceptions: [],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: LIB_GEN, shift: 'USERDEFINED',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-hourcal', poolVersion: 4 },
  workTime: { byWeekday: { 1: MA_DO, 2: MA_DO, 3: MA_DO, 4: MA_DO, 5: [{ start: 420, end: 660 }], 6: [], 7: [] } },
} satisfies Omit<Required<WorkCalendar>, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;

// Type-only VOLLEDIGHEIDSGETUIGE voor WorkCalendar: het eenvoudige pauzepatroon
// (`simpleBreakStartMinute`/`simpleBreakDurationMinutes`) hoort bij een SCALAIRE kalender, `workTime`
// bij een UURkalender — geen echte fixture draagt beide. De veld-volledigheid van WorkCalendar bewaken
// we daarom hier op typeniveau. `workTime` zelf round-tript wél echt: zie `hourCal` hierboven.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CALENDAR_FIELD_WITNESS = {
  id: 'w', name: 'w', description: 'w', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30,
  workingExceptions: [{ name: 'w', startDate: '2026-01-01', endDate: '2026-01-01', bands: [{ start: 0, end: 60 }] }],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: PROJ_GEN, shift: 'FIRST',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-witness', poolVersion: 1 },
  workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
} satisfies Required<WorkCalendar>;
// `void`: de getuige bestaat puur op typeniveau, maar telt zo ook onder `noUnusedLocals` als
// gebruikt (tsconfig.tests.json checkt dit bestand mét die vlag).
void _CALENDAR_FIELD_WITNESS;

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
export const plainTime = (start: string, finish: string, dur: number): TaskTime => ({
  durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: dur,
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

export const TM = {
  id: 't-m', name: 'Oplevering', description: 'Contractuele opleverdatum', wbsCode: '1.1',
  taskType: 'INSTALLATION', status: 'COMPLETED', isMilestone: true, milestoneKind: 'FINISH',
  customTaskTypeId: '',
  mandatory: true, priority: 700, levelingDelay: 3,
  // Z14: de vier Z0-typecontractvelden round-trippen nu écht via ifcPsets.ts (zie TASK_CANON
  // hieronder). `levelingDelayElapsed` staat hier BEWUST op `true` (niet `false`): de writer
  // schrijft `LevelingDelayElapsed` alleen bij een truthy waarde (golden rule, byte-identiek voor
  // bestaande bestanden) — `false` zou dus stil normaliseren naar `undefined` terug en deze cel
  // niets bewijzen (dezelfde valkuil als `shift: 'FIRST'`/ASAP-constraint hierboven in het bestand).
  levelingDelayMinutes: 45, levelingDelayElapsed: true,
  // B1c-plan-2 taak 7: het herkomstveld op een werkonderbreking. Twee gaten in ÉÉN taak — het
  // eerste (bestaand fixture-gegeven) zonder `source` (importsplit — byte-identiek gedrag), het
  // tweede MET `source: 'leveling'` (een door de verdeler ingevoegde pauzedag), het derde MET
  // `source: 'user'` (issue #146: een door de gebruiker gemaakte onderbreking) — zodat de gewone
  // whole-fixture round-trip hierboven ALLE DRIE de vormen in één keer bewijst.
  splitGaps: [
    { afterMinutes: 120, gapMinutes: 60 } satisfies TaskSplitGap,
    { afterMinutes: 480, gapMinutes: 480, source: 'leveling' } satisfies TaskSplitGap,
    { afterMinutes: 1440, gapMinutes: 480, source: 'user' } satisfies TaskSplitGap,
  ],
  manuallyScheduled: true,
  // Z14b: het Z8-venster round-trippt nu écht via `OPS_TimephasedWindow` (zie TASK_CANON hieronder
  // — echte KEEP-vergelijking i.p.v. de vroegere skip-cellen).
  timephasedFinishFloor: '2026-07-24T17:00', timephasedStartAnchor: '2026-07-24T08:00',
  // Z19-reviewbevinding M1: het EERSTE item (geen `workMinutes`) dekt de bestaande PRECIES-1-
  // toewijzing-vorm (byte-identiek, ongewijzigd sinds Z14b); het TWEEDE item draagt WEL
  // `workMinutes` (Z19-apportionering, mpp14resource-dossier) — beide vormen moeten in ÉÉN taak
  // door de round-trip komen, anders bewijst dit alleen de helft.
  timephasedDurationWalks: [
    { anchor: '2026-07-24T08:00', resourceCalendarId: 'libcal' },
    { anchor: '2026-07-24T09:00', resourceCalendarId: 'libcal', workMinutes: 1440 },
  ],
  // Z14b — rauwe contourperiodes (`OPS_TimephasedContours`), eigenaarsprincipe-voedingsdata.
  // Twee toewijzingen om te bewijzen dat de per-toewijzing-groepering ook echt meerdere entries
  // draagt (niet gedegenereerd tot één samengevoegde lijst).
  timephasedContours: [
    { resourceUid: 501, periods: [
      { afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' },
      { afterMinutes: 240, minutes: 60, workMinutes: 0, kind: 'actual' }, // het gat
    ] },
    { resourceUid: null, periods: [
      { afterMinutes: 300, minutes: 180, workMinutes: 180, kind: 'remaining' },
    ] },
  ] satisfies TaskTimephasedContour[],
  // Z14b — MSP's eigen task-type/effort-driven-vlag (eigenaarsbesluit 2026-08-18, punt 1).
  mspTaskType: 'FIXED_WORK', effortDriven: true,
  // Taaktypes-etappe (spec §4.1): de neutrale werkregel (`OPS_WorkRule`) — bewust een ANDERE waarde
  // dan wat uit mspTaskType zou volgen, zodat de round-trip het eigen veld bewijst.
  workRule: 'FIXED_DURATION_WORK',
  // X0/X7 (XER-etappeplan, 2026-08-20) — duration/activity blijven tot X9 zonder IFC-pset;
  // de vijf X7-firewall-/bronvelden hieronder round-trippen al wel exact via OPS_P6Progress.
  p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Rsrc',
  p6ProjectId: 'P1', p6TaskId: 'T1', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2026-07-31T17:00',
  p6SuspendResume: true,
  isSummary: false,
  parentId: 't-p', childIds: [],
  resourceIds: ['r-cost'], // kostenresource op de mijlpaal (#815, a5); afgeleid uit de assignments (H2-fix)
  color: '#abcdef', // round-trippt via OPS_TaskAppearance (H2-fix)
  isHammock: true,
  activityCodes: { 'act-loc': 'v-b1', 'act-dis': 'v-ruw' },
  customFields: {
    'cf-text': 'hallo', 'cf-num': 3.14, 'cf-int': 7, 'cf-cost': 1250.5, 'cf-date': '2026-08-01', 'cf-bool': true,
  },
  constraint: { type: 'MSO', date: '2026-07-15', hard: true },
  constraint2: { type: 'FNLT', date: '2026-07-20' },
  // `satisfies Required<ExternalLink>`: dezelfde volledigheids-afdwinging als de andere getuigen in
  // dit bestand — een nieuw veld op ExternalLink geeft hier een compile-fout i.p.v. stil buiten de
  // round-trip te vallen. (De `ExternalLink`-import stond er al, maar werd nergens gebruikt.)
  externalLinks: [{
    id: 'e1', direction: 'predecessor', relType: 'FS', lagDays: 2, lagMinutes: 120,
    anchorDate: '2026-07-01',
    sourceRef: { projectId: 'p2', projectName: 'Ander project', taskId: 't9', taskName: 'Levering', filePath: '/x/ander.ifc', siteFileId: 'site-b7c1' },
    sourceMissing: false,
    // Herkomst (keuze 4, Ethan 2026-11-03): versie van de bron en het moment van lezen.
    sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z',
  } satisfies Required<ExternalLink>],
  deadline: '2026-07-22',
  calendarId: 'libcal',
  notes: [{ id: 'n1', text: 'Keuring', done: true }, { id: 'n2', text: 'Sleuteloverdracht', done: false }],
  time: {
    durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 1,
    durationMinutes: 480,           // (b) uur-modus-gap
    scheduleStart: '2026-07-24T00:00', scheduleFinish: '2026-07-24T00:00',
    earlyStart: '2026-07-24T00:00', earlyFinish: '2026-07-24T00:00', lateStart: '2026-07-24T00:00', lateFinish: '2026-07-24T00:00',
    freeFloat: 2, totalFloat: 3, isCritical: true,
    totalFloatMinutes: 1440, freeFloatMinutes: 960, // alleen uren §3.4, T5: OPS_Analysis.ExactFloat (F3c)
    interferingFloat: 1.5, isNearCritical: true, floatPath: 1, // (a) analyse-gaps
    actualStart: '2026-07-24T00:00', actualFinish: '2026-07-24T00:00', actualDuration: 0,
    remainingTime: 0, remainingMinutes: 0, // remainingMinutes: (b) uur-modus-gap
    completion: 1,
    progressBeforeRecalculation: { status: 'STARTED', completion: 0.2, actualStart: '2026-07-24T00:00' },
    resume: '2026-07-24', stop: '2026-07-24', // Z14: round-tript sinds OPS_Resume, zie TIME_CANON
  },
} satisfies Required<Task> & { time: Required<TaskTime> };

export const TX: Task = {
  id: 't-x', name: 'Ruwbouw', description: 'Casco', wbsCode: '1.2',
  taskType: 'DEMOLITION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-mem', 'r-cost'], // afgeleid uit a1/a2/a4 (H2-fix)
  time: plainTime('2026-07-06', '2026-07-10', 5),
};
const TY: Task = {
  id: 't-y', name: 'Installaties', description: 'E+W', wbsCode: '1.3',
  taskType: 'LOGISTIC', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-eq', 'r-cost'], // afgeleid uit a3/a6 (H2-fix)
  time: plainTime('2026-07-13', '2026-07-17', 5),
};
const tasks: Task[] = [TP, TM, TX, TY];

// ── Relaties: alle 4 types + lag-varianten (vaste dagen / ELAPSEDTIME / procent / geen lag) ──────
// `Sequence` kan NIET direct `satisfies Required<Sequence>`: lagDays/lagMinutes/lagPercent zijn
// mutueel exclusief (lagPercent wint altijd in de writer en zou lagDays overschrijven). De
// veld-volledigheid bewaken we via een type-only getuige; de round-trip-relaties zijn realistisch.
const sequences: Sequence[] = [
  { id: 's1', predecessorId: 't-x', successorId: 't-m', type: 'FINISH_START', lagDays: 2, lagUnit: 'ELAPSEDTIME', p6StartAtPredecessorFinishBoundary: true },
  { id: 's2', predecessorId: 't-x', successorId: 't-y', type: 'START_START', lagDays: 0, lagPercent: 50 },
  { id: 's3', predecessorId: 't-y', successorId: 't-m', type: 'FINISH_FINISH', lagDays: 1 },
  { id: 's4', predecessorId: 't-x', successorId: 't-m', type: 'START_FINISH', lagDays: 0 },
];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SEQUENCE_FIELD_WITNESS = {
  id: 'w', predecessorId: 'a', successorId: 'b', type: 'FINISH_START',
  lagDays: 1, lagMinutes: 60, lagUnit: 'WORKTIME', lagPercent: 25,
  p6StartAtPredecessorFinishBoundary: false,
} satisfies Required<Sequence>;
void _SEQUENCE_FIELD_WITNESS;

// ── Resources: alle types + ploeg-nesting + capaciteit/tarief/eenheid/tijd-gefaseerd ─────────────
const RCrew: Resource = { id: 'r-crew', name: 'Ploeg Alpha', type: 'CREW', description: 'Hoofdploeg', maxUnits: 1 };
export const RMember = {
  id: 'r-mem', name: 'Timmerman Jan', type: 'LABOR', description: 'Ervaren timmerman',
  costPerHour: 42.5, availability: 0.9, // availability: (b) deprecated gap
  maxUnits: 3, calendarId: 'libcal',
  availabilitySteps: [{ from: '2026-07-06', maxUnits: 3 }, { from: '2026-07-20', maxUnits: 2 }],
  unitOfMeasure: 'uur', parentId: 'r-crew', color: '#0EA5E9',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-res1', poolVersion: 4 },
} satisfies Required<Resource>;
const REquip: Resource = { id: 'r-eq', name: 'Torenkraan', type: 'EQUIPMENT', description: 'Liebherr 200', maxUnits: 2 };
const RMat: Resource = { id: 'r-mat', name: 'Beton C30', type: 'MATERIAL', description: 'Stortbeton', maxUnits: 1, unitOfMeasure: 'm3' };
const RSub: Resource = { id: 'r-sub', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: 'Onderaannemer', maxUnits: 1 };
// Kostenresource (#815): IFCCONSTRUCTIONMATERIALRESOURCE met ObjectType 'COST' + .USERDEFINED.
const RCost: Resource = { id: 'r-cost', name: 'Leges vergunning', type: 'COST', description: 'Vast bedrag', maxUnits: 1 };
const RCrewBeta: Resource = { ...RCrew, id: 'r-beta', name: 'Ploeg Beta' };
const RCrewEmpty: Resource = { ...RCrew, id: 'r-empty', name: 'Lege ploeg' };
const resources: Resource[] = [
  { ...RMember, id: 'r-beta-lid', name: 'Lid Beta', parentId: RCrewBeta.id }, RCrewBeta,
  RMember, RCrewEmpty, RCrew, REquip, RMat, RSub, RCost,
  { ...RMember, id: 'r-alpha-tweede', name: 'Tweede lid Alpha' },
];
/** Namen van de kostenresources: alleen daar is `costAmount` data (zie ASSIGNMENT_CANON). */
export const COST_RESOURCE_NAMES = new Set([RCost.name]);

// ── Toewijzingen: incl. twee assignments van DEZELFDE resource op één taak (M3-uniciteit) + curve ─
const A1 = {
  id: 'a1', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 2, curve: 'BELL',
  // Resttempo-besluit (2026-10-15): het begrote tempo naast een P6-resttempo, onderscheidend van
  // `unitsPerDay` (een writer die de inzet terugschrijft, wordt zo niet stil goedgekeurd).
  plannedUnitsPerDay: 1.111,
  // Z14: round-tript sinds OPS_Timephased — zie de KEEP-cel in ASSIGNMENT_CANON hieronder. Nog
  // ONGEVULD door de mpp-lezer (Z8, aparte taak); dit test alleen de opslag-/round-trip-laag.
  workWindowStart: '2026-07-06', workWindowFinish: '2026-07-08',
  // Contour-engine (2026-09): exacte 21-punts curve (P6/MSPDI) reist in hetzelfde JSON-pset mee.
  curveValues: [0, 1.3, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5, 2.5, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5],
  // Taaktypes-etappe (spec §4.3): drie werkvelden in minuten, onderscheidend (begroot ≠ verricht + rest,
  // zodat een writer die één veld uit de andere afleidt niet stil goedgekeurd wordt).
  plannedWorkMinutes: 9600, actualWorkMinutes: 4800, remainingWorkMinutes: 7200,
  // Kostenresource (#815): een bedrag op een WERKresource is geen data; de lezer laat het vallen
  // (`normalizeCostResources`). De cel in ASSIGNMENT_CANON vergelijkt het daarom alleen op een
  // kostenresource; a4–a6 dragen het echte bedrag, de check onder "#815" toetst het wegvallen hier.
  costAmount: 99,
} satisfies Required<ResourceAssignment>;
const assignments: ResourceAssignment[] = [
  A1,
  { id: 'a2', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 1, curve: 'LATE_PEAK' },
  { id: 'a3', taskId: 't-y', resourceId: 'r-eq', unitsPerDay: 1 }, // geen curve → UNIFORM-normalisatie
  // Kostenresource (#815): bedrag met centen, 0 op de mijlpaal, en zonder bedrag.
  { id: 'a4', taskId: 't-x', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 1250.55 },
  { id: 'a5', taskId: 't-m', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 0 },
  { id: 'a6', taskId: 't-y', resourceId: 'r-cost', unitsPerDay: 1 },
];

// ── Project incl. schedulingOptions/statusDate/progressMode/wbsAutoNumber ─────────────────────────
// Rekenprofielen C2: het optieblok draagt alleen de elf projectopties (waarden ongewijzigd); de
// conventies reizen via het profiel hieronder (OPS_SchedulingProfile).
const SCHED_OPTS = {
  lagCalendar: 'successor',
  criticalDefinition: { mode: 'longestPath', threshold: -1, thresholdHours: -8 },
  totalFloatMode: 'finish',
  makeOpenEndedCritical: true,
  useExpectedFinishDates: false,
  p6CompletedLateFromRemainingWindow: true,
  useProjectEndDateForFloat: true,
  nearCriticalThreshold: 3,
  floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
  // Niet-default (P6 "Calculate Start-to-Start lag from: Actual Start"), zodat de round-trip iets bewijst.
  startToStartLagFrom: 'actualStart',
  // Nivelleerfundament: alleen data, zonder aan/uit-veld (eigenaarsbeslissing 1 open). Resource-ids worden bij het lezen
  // uit het GlobalId afgeleid en via de GlobalId teruggemapt (canon hieronder vergelijkt op naam); een id zonder
  // resource ('r-verwijderd') blijft letterlijk staan.
  leveling: {
    preserveScheduledDates: false, levelAllResources: false,
    priority: [{ field: 'priority_type', direction: 'DESC' }, { field: 'task_code', direction: 'ASC' }],
    resources: [{ resourceId: 'r-mem', maxUnitsPerHour: 1 }, { resourceId: 'r-eq' }, { resourceId: 'r-verwijderd', maxUnitsPerHour: 0.5 }],
  },
} satisfies Required<ProjectSchedulingOptions>;
const project = {
  id: 'proj-1', name: 'Nieuwbouw Testtoren', description: 'Beschrijving X', // description: (a) gap
  // CONTRACTUELE project-datums, bewust LOS van de taak-span (die loopt 2026-07-06 … 2026-07-24).
  // Vielen ze samen — zoals vóór deze fixture-fix — dan bewees de vergelijking hieronder NIETS:
  // de afgeleide planningsdatum uit IFCWORKPLAN was per constructie gelijk aan de contractuele.
  startDate: '2026-06-15', endDate: '2026-09-30', calendarId: 'projcal',
  createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-06-01T00:00:00.000Z', // (a) gaps
  author: 'Ir. Testz', company: 'Bouw BV',                                       // (a) gaps
  wbsAutoNumber: true, statusDate: '2026-07-25', progressMode: 'PROGRESS_OVERRIDE',
  defaultTaskDurationUnit: 'days',
  defaultWorkRule: 'FIXED_RATE', // taaktypes-etappe: OPS_ProjectSettings/DefaultWorkRule
  companyId: 'c-fixture', companyName: 'Fixture Bouw BV',
  p6ProjectCode: 'OZB-14 1st Update', // P6 XML-projectcode: OPS_ProjectSettings/P6ProjectCode
  dependentProjectsFolder: '/projecten/Zuidas \\ fase \'2\'', // stap 1.11: OPS_ProjectSettings/DependentProjectsFolder
  anchorsFromOpenDocuments: true, // stap 1.7: OPS_ProjectSettings/AnchorsFromOpenDocuments, alleen wanneer aan
  schedulingOptions: SCHED_OPTS,
  // Rekenprofiel (C2): een EIGEN profiel op p6-basis met twee afwijkingen (één uit, één per-bestand
  // aan) — onderscheidend van de default (afwezig ≡ ops) én van de kale p6-basis.
  schedulingProfile: {
    baseId: 'p6', id: 'prof-fixture', name: 'Fixtureprofiel',
    overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true },
  },
  // Issue #292: niet de standaard (IFC4X3), zodat de round-trip via FILE_SCHEMA iets bewijst.
  ifcSchema: 'IFC4',
  // Een open schemavraag (bijv. door automatisch opslaan bewaard) blijft open na opslaan + openen.
  ifcSchemaUnconfirmed: 'IFC4',
} satisfies Required<Project> & { schedulingOptions: Required<ProjectSchedulingOptions> };

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
  resourceCalendars: [projCal, libCal, hourCal], // projCal-entry wordt door de writer eruit gefilterd (b)
  activityCodeTypes, customFieldDefs, baselines, activeBaselineId: 'bl-1',
  // OPS_ImportProvenance (heropen-beleid optie B + eigenaarsbesluit 2026-09-24 "beperken"). Beide
  // onderscheidend: de defaults zijn `false`/afwezig, en een writer die niets schrijft valt zo op.
  importPristine: true,
  recordedSourceFormat: 'mspdi',
};
