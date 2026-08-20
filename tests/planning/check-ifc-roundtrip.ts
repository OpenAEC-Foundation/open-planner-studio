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
//   2. COMPILE-AFDWINGING, op TWEE plekken (bevinding K10a — één was niet genoeg):
//      (2a) de kern-fixtures zijn `satisfies Required<...>` — een nieuw domeinveld moet een WAARDE
//           krijgen. Twee types kunnen NIET direct `satisfies Required<>` (mutueel-exclusieve
//           velden) → type-only getuige, zie WITNESS hieronder.
//      (2b) de VERGELIJKING (`canon`) is sleutel-gedreven: `satisfies CanonSpec<X>` =
//           `Record<keyof X, ...>` per domeintype — een nieuw veld moet ook een EXPLICIETE keuze
//           krijgen (meedoen of gemotiveerd overslaan). Zonder (2b) was de batterij NIET
//           zelf-uitbreidend: een nieuw veld kreeg wel een fixture-waarde maar stond in geen enkele
//           hand-opgesomde canon-literal, en round-tripte dus stil nul bytes. Zie het blok boven
//           `canon` voor de meting.
//      Beide leunen op tests/planning/tsconfig.check.json, want de hoofd-tsconfig sluit tests/ uit.
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
//   project.startDate/endDate was hier ook zo'n (b)-normalisatie (→taak-span). Dat is GEDICHT: de
//   contractuele datums hebben nu eigen opslag in het OPS_ProjectSettings-pset en lopen door de
//   echte round-trip-vergelijking; de fixture kiest ze bewust LOS van de taak-span, zodat de
//   vergelijking het verschil ook echt kan zien. IFCWORKPLAN.StartTime/FinishTime blijft de
//   AFGELEIDE plan-omvang dragen. Zie blok (4) onderaan voor leeg-geval en legacy-terugval.
//   Overige bewuste (b)-normalisaties die de fixture al in genormaliseerde vorm kiest (dus GEEN
//   afwijking geven): ids regenereren (→ natuurlijke sleutels), project.calendarId→'cal-default',
//   ASAP-constraint niet geschreven, shift FIRST→undefined,
//   lagUnit WORKTIME→undefined, curve UNIFORM→undefined, progressMode RETAINED_LOGIC→undefined,
//   dag-duren integer, priority 500 niet geschreven.
//   M3 (eindreview T16c, GEDICHT): `completion` rondde vóór deze fix af op 1 decimaal (10%-stappen;
//   ≥0,955 werd zelfs "1.0" = 100%, een stille VOLTOOID-gedragswisseling in CPMSolver.ts) — nu
//   2 decimalen (1%-stappen, MSP se eigen PercentComplete-granulariteit). Deze fixture se eigen
//   completion-waarden (0/1) waren toevallig al ongevoelig voor die afronding; zie blok (9)
//   hieronder voor het gerichte precisie-bewijs met een niet-decielwaarde (0.38/0.955).
//   Bugfix B2 (gebruikstest 2026-08, GEDICHT): `hoursPerDay ≠ eind−startuur` (een impliciet
//   lunchuur, zoals de echte standaard "Bouwkalender NL" 07-16/hoursPerDay 8) round-trippt nu via
//   een `HoursPerDay`-property op het `OPS_Calendar`-pset i.p.v. stilzwijgend te normaliseren naar
//   de afgeleide span — zie `projCal` hieronder (workEndHour 16, hoursPerDay 8: 16−7=9 ≠ 8).

import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { ALL_RECORDED_SLOT_KEYS, IFC_TASKTIME_SLOTS, TASKTIME_SLOT, IFC_TASK_SLOTS, TASK_SLOT } from '@/services/ifc/ifcTaskSlots';
import type { Task, TaskTime, ExternalLink, TaskSplitGap, TaskTimephasedContour } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project, SchedulingOptions } from '@/types/project';
import type { WorkCalendar, CalendarGeneration, Holiday, WorkingException } from '@/types/calendar';
import type { ActivityCodeType, ActivityCodeValue, CustomFieldDef } from '@/types/structure';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';
import type { ExtTaskTime } from '@/extensions/extTypes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/ valt buiten de hoofd-tsconfig; process is niet via @types/node beschikbaar in de
// dedicated round-trip-tsconfig (types:[]). Minimale, botsingvrije declaratie.
declare const process: { exit(code: number): never };

// `import.meta.url`-relatief i.p.v. `process.cwd()` (zelfde conventie/reviewbevinding als
// check-adapters-hours.ts): dit bestand draait via `bash tests/planning/run.sh`, dat NOOIT naar de
// repo-root `cd`'t — de child-`node`'s cwd is die van de AANROEPER, niet gegarandeerd de repo-root.
// De bundel wordt door `run.sh` altijd in `tests/planning/` zelf geschreven, dus `HERE` is
// cwd-onafhankelijk stabiel op die map.
const HERE = fileURLToPath(new URL('.', import.meta.url));

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
  generation: PROJ_GEN, shift: 'SECOND',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-projcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime'>;
const libCal = {
  id: 'libcal', name: 'Sublokatie kalender', description: 'Ma-za 07-15',
  workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [{ name: 'Bouwvakdag', startDate: '2026-07-27', endDate: '2026-07-31' }],
  workingExceptions: [
    { name: 'Overwerkdag', startDate: '2026-08-08', endDate: '2026-08-08', bands: [{ start: 360, end: 720 }] },
    { name: 'Verschoven werkdag', startDate: '2026-08-15', endDate: '2026-08-15' },
  ],
  generation: LIB_GEN, shift: 'THIRD',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-libcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime'>;

// Type-only VOLLEDIGHEIDSGETUIGE voor WorkCalendar: `workTime` aanwezig ⇒ UUR-kalender, wat de
// dag-modus-round-trip zou ontsporen (durationMinutes/echte tijden). De veld-volledigheid van
// WorkCalendar bewaken we daarom hier op typeniveau; de round-trip-fixtures blijven dag-modus. De
// uur-modus-round-trip (workTime/banden) is gedekt door check-adapters-hours.ts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CALENDAR_FIELD_WITNESS = {
  id: 'w', name: 'w', description: 'w', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workingExceptions: [{ name: 'w', startDate: '2026-01-01', endDate: '2026-01-01', bands: [{ start: 0, end: 60 }] }],
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
  mandatory: true, priority: 700, levelingDelay: 3,
  // Z14: de vier Z0-typecontractvelden round-trippen nu écht via ifcPsets.ts (zie TASK_CANON
  // hieronder). `levelingDelayElapsed` staat hier BEWUST op `true` (niet `false`): de writer
  // schrijft `LevelingDelayElapsed` alleen bij een truthy waarde (golden rule, byte-identiek voor
  // bestaande bestanden) — `false` zou dus stil normaliseren naar `undefined` terug en deze cel
  // niets bewijzen (dezelfde valkuil als `shift: 'FIRST'`/ASAP-constraint hierboven in het bestand).
  levelingDelayMinutes: 45, levelingDelayElapsed: true,
  splitGaps: [{ afterMinutes: 120, gapMinutes: 60 } satisfies TaskSplitGap],
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
  // X0 (XER-etappeplan, 2026-08-20) — drie nieuwe .xer-importvelden, nog GEEN IFC-pset (zie
  // TASK_CANON hieronder: skip, reden X9). Alleen hier gevuld voor de `Required<Task>`-volledigheid.
  p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Rsrc', p6SuspendResume: true,
  parentId: 't-p', childIds: [],
  resourceIds: [], // milestone zonder assignments ⇒ afgeleide resourceIds is leeg (H2-fix)
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
    sourceRef: { projectId: 'p2', projectName: 'Ander project', taskId: 't9', taskName: 'Levering', filePath: '/x/ander.ifc' },
    sourceMissing: false,
  } satisfies Required<ExternalLink>],
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
    resume: '2026-07-24', stop: '2026-07-24', // Z14: round-tript sinds OPS_Resume, zie TIME_CANON
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
void _SEQUENCE_FIELD_WITNESS;

// ── Resources: alle types + ploeg-nesting + capaciteit/tarief/eenheid/tijd-gefaseerd ─────────────
const RCrew: Resource = { id: 'r-crew', name: 'Ploeg Alpha', type: 'CREW', description: 'Hoofdploeg', maxUnits: 1 };
const RMember = {
  id: 'r-mem', name: 'Timmerman Jan', type: 'LABOR', description: 'Ervaren timmerman',
  costPerHour: 42.5, availability: 0.9, // availability: (b) deprecated gap
  maxUnits: 3, calendarId: 'libcal',
  availabilitySteps: [{ from: '2026-07-06', maxUnits: 3 }, { from: '2026-07-20', maxUnits: 2 }],
  unitOfMeasure: 'uur', parentId: 'r-crew',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-res1', poolVersion: 4 },
} satisfies Required<Resource>;
const REquip: Resource = { id: 'r-eq', name: 'Torenkraan', type: 'EQUIPMENT', description: 'Liebherr 200', maxUnits: 2 };
const RMat: Resource = { id: 'r-mat', name: 'Beton C30', type: 'MATERIAL', description: 'Stortbeton', maxUnits: 1, unitOfMeasure: 'm3' };
const RSub: Resource = { id: 'r-sub', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: 'Onderaannemer', maxUnits: 1 };
const resources: Resource[] = [RCrew, RMember, REquip, RMat, RSub];

// ── Toewijzingen: incl. twee assignments van DEZELFDE resource op één taak (M3-uniciteit) + curve ─
const A1 = {
  id: 'a1', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 2, curve: 'BELL',
  // Z14: round-tript sinds OPS_Timephased — zie de KEEP-cel in ASSIGNMENT_CANON hieronder. Nog
  // ONGEVULD door de mpp-lezer (Z8, aparte taak); dit test alleen de opslag-/round-trip-laag.
  workWindowStart: '2026-07-06', workWindowFinish: '2026-07-08',
} satisfies Required<ResourceAssignment>;
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
  resumeFromActualElapsed: true, // T9 (voortgangsafronding): rondt lossless mee als deel van het JSON-blob
  unstartedIgnoresStatusDate: true, // B1 (dossier (c)4-herdiagnose): idem, rondt mee als deel van het JSON-blob
} satisfies Required<SchedulingOptions>;
const project = {
  id: 'proj-1', name: 'Nieuwbouw Testtoren', description: 'Beschrijving X', // description: (a) gap
  // CONTRACTUELE project-datums, bewust LOS van de taak-span (die loopt 2026-07-06 … 2026-07-24).
  // Vielen ze samen — zoals vóór deze fixture-fix — dan bewees de vergelijking hieronder NIETS:
  // de afgeleide planningsdatum uit IFCWORKPLAN was per constructie gelijk aan de contractuele.
  startDate: '2026-06-15', endDate: '2026-09-30', calendarId: 'projcal',
  createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-06-01T00:00:00.000Z', // (a) gaps
  author: 'Ir. Testz', company: 'Bouw BV',                                       // (a) gaps
  wbsAutoNumber: true, statusDate: '2026-07-25', progressMode: 'PROGRESS_OVERRIDE',
  companyId: 'c-fixture', companyName: 'Fixture Bouw BV',
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
//  bewijzen we los in blok (3)). Levert een puur, vergelijkbaar objectboom.
//
//  SLEUTEL-GEDREVEN (bevinding K10a). De kop van dit bestand claimde dat de batterij ZELF-UITBREIDEND
//  is: een nieuw domeinveld geeft een compile-fout, dus de round-trip bewaakt het automatisch. Dat
//  klopte maar half — de FIXTURE was afgedwongen (`satisfies Required<...>`), de VERGELIJKING niet.
//  `canon` bouwde met de hand opgesomde object-literals; een nieuw veld stond daar simpelweg niet in
//  en werd dus nooit vergeleken. Gemeten (het onderzoek achter K10a): een veld toevoegen aan `Task`,
//  de twee compile-fouten oplossen die dat gaf (`src/engine/moveProject.ts` + de fixture hierboven)
//  en reader/writer NIET aanraken gaf gewoon `OK ifc-roundtrip: alle checks groen`, exit 0. Het veld
//  round-tripte nul bytes en geen enkele poort merkte het — exact de bugklasse (stil veldverlies)
//  waarvoor deze batterij bestaat.
//
//  Daarom is élke projectie hieronder een `satisfies CanonSpec<X>`-tabel, d.w.z.
//  `Record<keyof X, ...>`: dezelfde compile-time volledigheidstruc als `TASK_VERDICTS` in
//  `src/engine/moveProject.ts` en `DOCUMENT_FIELDS` in `src/state/documentContract.ts`. Elke sleutel
//  draagt een EXPLICIETE keuze — meedoen zoals hij is (`KEEP`), meedoen in geprojecteerde vorm
//  (`{ get, as? }`), of bewust niet vergelijken (`{ skip: '<reden>' }`, reden verplicht). Een nieuw
//  veld zonder cel geeft een compile-fout onder tests/planning/tsconfig.check.json.
// ════════════════════════════════════════════════════════════════════════════════════════════════

type Any = Record<string, unknown>;
const def = <T>(v: T | undefined): v is T => v !== undefined;

/** Volatiele id → leesbare, stabiele sleutel. Ids regenereren bij het inlezen, dus élke verwijzing
 *  naar een ander object wordt via deze kaarten naar een natuurlijke sleutel herschreven. */
interface Keys {
  /** kalender-id → kalendernaam (undefined blijft undefined: "projectkalender"). */
  cal(id: string | undefined): string | undefined;
  /** taak-id → wbsCode. */
  task(id: string): string;
  /** resource-id → resourcenaam. */
  res(id: string): string;
  /** activity-code-TYPE-id → typenaam. */
  codeType(id: string): string;
  /** activity-code-WAARDE-id → code. */
  codeValue(id: string): string;
  /** custom-field-definitie-id → veldnaam. */
  fieldDef(id: string): string;
}

/** "Doe mee aan de vergelijking, ongewijzigd, onder je eigen naam." */
const KEEP = { keep: true } as const;

/** Eén cel in een canon-tabel. De drie vormen zijn de enige toegestane keuzes per veld. */
type CanonCell<T> =
  | typeof KEEP
  | { readonly skip: string }                                     // reden verplicht
  | { readonly as?: string; readonly get: (o: T, k: Keys) => unknown };

/** DE tabelvorm: één cel per sleutel van het domeintype — geen sleutel mag ontbreken. */
type CanonSpec<T> = Record<keyof T, CanonCell<T>>;

/** Bouw het vergelijkbare object sleutel-voor-sleutel uit de tabel. */
function canonize<T extends object>(spec: CanonSpec<T>, o: T, k: Keys): Any {
  const src = o as unknown as Any;
  const out: Any = {};
  for (const key of Object.keys(spec) as (keyof T & string)[]) {
    const cell = spec[key];
    if ('skip' in cell) continue;
    if ('keep' in cell) out[key] = src[key];
    else out[cell.as ?? key] = cell.get(o, k);
  }
  return out;
}

// ── De veldtabellen ─────────────────────────────────────────────────────────────────────────────

const HOLIDAY_CANON = {
  name: KEEP, startDate: KEEP, endDate: KEEP,
} satisfies CanonSpec<Holiday>;

// T5 (fase 3.8): `bands` KEEP volstaat — `collectDiffs` behandelt een afwezig array-veld als `[]`
// (zie het array-blok in `collectDiffs`), dus een fixture-uitzondering zonder `bands` (default
// bandengelden) vergelijkt gelijk aan de teruggelezen `bands: undefined`.
const WORKING_EXCEPTION_CANON = {
  name: KEEP, startDate: KEEP, endDate: KEEP, bands: KEEP,
} satisfies CanonSpec<WorkingException>;

const CALENDAR_CANON = {
  id: { skip: 'regenereert bij inlezen; de NAAM is de natuurlijke sleutel (Keys.cal)' },
  name: KEEP, description: KEEP,
  workDays: { get: (c: WorkCalendar) => [...c.workDays] },
  workStartHour: KEEP, workEndHour: KEEP, hoursPerDay: KEEP,
  holidays: {
    get: (c: WorkCalendar, k: Keys) => [...c.holidays]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(h => canonize(HOLIDAY_CANON, h, k)),
  },
  workingExceptions: {
    get: (c: WorkCalendar, k: Keys) => [...(c.workingExceptions ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => canonize(WORKING_EXCEPTION_CANON, e, k)),
  },
  generation: KEEP,
  workTime: { skip: 'aanwezig ⇒ UUR-kalender; deze fixture is dag-modus. Uur-round-trip: check-adapters-hours.ts' },
  shift: KEEP,
  libraryOrigin: KEEP,   // B1.1: herkomststempel round-trippt via OPS_LibraryOrigin
} satisfies CanonSpec<WorkCalendar>;

const TIME_CANON = {
  durationType: KEEP, scheduleDuration: KEEP,
  durationMinutes: { skip: '(b) UUR-modus-veld, n.v.t. in dag-modus; gedekt door check-adapters-hours.ts' },
  scheduleStart: KEEP, scheduleFinish: KEEP,
  earlyStart: KEEP, earlyFinish: KEEP, lateStart: KEEP, lateFinish: KEEP,
  freeFloat: KEEP, totalFloat: KEEP, isCritical: KEEP,
  // De drie analyse-velden round-trippen sinds pakket K BEWUST niet meer mee: de writer schrijft
  // `OPS_Analysis` niet langer omdat het pure runCPM-uitvoer is die élk laadpad herberekent (zie
  // ifcWriter.WRITTEN_PER_TASK_PSETS). Ze staan als (a)-gap in KNOWN_GAPS; het verlies zelf wordt
  // in blok (3) apart geassserteerd. De LEESkant blijft bestaande bestanden gewoon accepteren.
  interferingFloat: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  isNearCritical: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  floatPath: { skip: '(a) afgeleid; OPS_Analysis wordt sinds pakket K niet meer geschreven' },
  actualStart: KEEP, actualFinish: KEEP, actualDuration: KEEP, remainingTime: KEEP,
  remainingMinutes: { skip: '(b) UUR-modus-veld, n.v.t. in dag-modus (zie durationMinutes)' },
  completion: KEEP,
  // Z14 (Z12-herwerk-signaal): resume/stop round-trippen sinds Z14 via het `OPS_Resume`-pset
  // (ifcPsets.ts) — echte KEEP-vergelijking i.p.v. de vroegere skip-cel. MSPDI/P6-export blijven
  // ze WEL warnen-en-weglaten (native `<Resume>`/`<Stop>` zonder terugleesbaarheid, zelfde
  // ELAPSEDTIME-precedent) — dat is een aparte, bewuste exportrand, geen IFC-gat.
  resume: KEEP, stop: KEEP,
} satisfies CanonSpec<TaskTime>;

const TASK_CANON = {
  id: { skip: 'regenereert bij inlezen; wbsCode is de natuurlijke sleutel (Keys.task)' },
  name: KEEP, description: KEEP, wbsCode: KEEP, taskType: KEEP, status: KEEP,
  isMilestone: KEEP, milestoneKind: KEEP, mandatory: KEEP, priority: KEEP, levelingDelay: KEEP,
  // Z14: de vier Z0-typecontractvelden round-trippen nu écht (ifcPsets.ts: `OPS_Leveling`
  // uitgebreid met LevelingDelayMinutes/-Elapsed, `OPS_TaskSplits` en `OPS_ManualScheduling` nieuw)
  // — echte KEEP-vergelijking i.p.v. de vroegere skip-cellen.
  levelingDelayMinutes: KEEP, levelingDelayElapsed: KEEP, splitGaps: KEEP, manuallyScheduled: KEEP,
  // Z14b — het Z8-venster round-trippt nu écht via `OPS_TimephasedWindow` (ifcPsets.ts): echte
  // KEEP/get-vergelijking i.p.v. de vroegere skip-cellen (Z8-nataak, plan-Z14 regel ~464).
  timephasedFinishFloor: KEEP, timephasedStartAnchor: KEEP,
  // `resourceCalendarId` is een KALENDER-VERWIJZING (regenereert bij inlezen) — spiegelt
  // `calendarId` hieronder: via `k.cal(...)` naar de natuurlijke sleutel (kalendernaam) herschreven,
  // net als elke andere cross-object-verwijzing in dit bestand.
  // Z19-reviewbevinding M1: `workMinutes` MOET meevergelijken — vóór deze correctie ontbrak het
  // hier volledig, waardoor een writer/reader-bug op precies dit veld nooit rood zou gaan (de
  // vergelijking zag alleen `anchor`/`resourceCalendarId`, altijd gelijk gebleven).
  timephasedDurationWalks: {
    get: (t: Task, k: Keys) => (t.timephasedDurationWalks ?? []).map(w => ({
      anchor: w.anchor, resourceCalendarId: k.cal(w.resourceCalendarId), workMinutes: w.workMinutes ?? null,
    })),
  },
  // Z14b — rauwe contourperiodes (`OPS_TimephasedContours`): `resourceUid` is een MSP-eigen rauw
  // getal, GEEN verwijzing naar iets in deze fixture-graaf (zie `TaskTimephasedContour`'s eigen
  // docblok — puur herkomst/traceability) — dus geen `Keys`-vertaling nodig, plain KEEP volstaat.
  timephasedContours: KEEP,
  // Z14b — MSP's eigen task-type/effort-driven-vlag (`OPS_MspTaskType`), puur data, geen verwijzing.
  mspTaskType: KEEP, effortDriven: KEEP,
  // X0 (XER-etappeplan, 2026-08-20) — drie nieuwe .xer-importvelden: typecontract-only deze etappe
  // (X0 raakt src/services/ifc/ NIET aan). Geen IFC-pset ⇒ geen echte round-trip-vergelijking
  // mogelijk; de daadwerkelijke IFC-round-trip-wiring is XER-etappe se X9-taak (documentcontract/
  // round-trip). Zelfde taxonomie als `interferingFloat`/`isNearCritical`/`floatPath` hierboven.
  p6DurationType: { skip: 'nog geen IFC-pset — typecontract-only, X0 (XER-etappeplan); wiring volgt in X9' },
  p6ActivityType: { skip: 'nog geen IFC-pset — typecontract-only, X0 (XER-etappeplan); wiring volgt in X9' },
  p6SuspendResume: { skip: 'nog geen IFC-pset — typecontract-only, X0 (XER-etappeplan); wiring volgt in X9' },
  parentId: { as: 'parent', get: (t: Task, k: Keys) => (t.parentId ? k.task(t.parentId) : null) },
  childIds: { as: 'children', get: (t: Task, k: Keys) => t.childIds.map(c => k.task(c)).sort() },
  time: { get: (t: Task, k: Keys) => canonize(TIME_CANON, t.time, k) },
  // color + resourceIds round-trippen sinds H2 (OPS_TaskAppearance resp. herbouw uit assignments).
  // resourceIds naar natuurlijke sleutels (resourcenaam) + gesorteerd (volgorde-onafhankelijk).
  resourceIds: { get: (t: Task, k: Keys) => [...t.resourceIds].map(id => k.res(id)).sort() },
  color: KEEP,
  activityCodes: {
    get: (t: Task, k: Keys) => t.activityCodes
      ? Object.fromEntries(Object.entries(t.activityCodes).map(([ty, va]) => [k.codeType(ty), k.codeValue(va)]))
      : undefined,
  },
  customFields: {
    get: (t: Task, k: Keys) => t.customFields
      ? Object.fromEntries(Object.entries(t.customFields).map(([d, v]) => [k.fieldDef(d), v]))
      : undefined,
  },
  constraint: KEEP, constraint2: KEEP, isHammock: KEEP, externalLinks: KEEP, deadline: KEEP,
  calendarId: { as: 'calendar', get: (t: Task, k: Keys) => k.cal(t.calendarId) },
  notes: KEEP,
} satisfies CanonSpec<Task>;

const SEQUENCE_CANON = {
  id: { skip: 'regenereert bij inlezen; de relatie is identificeerbaar via pred/succ/type' },
  predecessorId: { as: 'pred', get: (s: Sequence, k: Keys) => k.task(s.predecessorId) },
  successorId: { as: 'succ', get: (s: Sequence, k: Keys) => k.task(s.successorId) },
  type: KEEP, lagDays: KEEP, lagMinutes: KEEP, lagUnit: KEEP, lagPercent: KEEP,
} satisfies CanonSpec<Sequence>;

const RESOURCE_CANON = {
  id: { skip: 'regenereert bij inlezen; de NAAM is de natuurlijke sleutel (Keys.res)' },
  name: KEEP, type: KEEP, description: KEEP, costPerHour: KEEP,
  availability: { skip: '(b) @deprecated migratieveld; de writer schrijft het bewust niet (KNOWN_GAPS)' },
  maxUnits: KEEP,
  calendarId: { as: 'calendar', get: (r: Resource, k: Keys) => k.cal(r.calendarId) },
  availabilitySteps: KEEP, unitOfMeasure: KEEP,
  parentId: { as: 'parent', get: (r: Resource, k: Keys) => (r.parentId ? k.res(r.parentId) : undefined) },
  libraryOrigin: KEEP,   // B1.1: herkomststempel round-trippt via OPS_LibraryOrigin
} satisfies CanonSpec<Resource>;

const ASSIGNMENT_CANON = {
  id: { skip: 'regenereert bij inlezen; taak+resource+units identificeren de toewijzing' },
  taskId: { as: 'task', get: (a: ResourceAssignment, k: Keys) => k.task(a.taskId) },
  resourceId: { as: 'resource', get: (a: ResourceAssignment, k: Keys) => k.res(a.resourceId) },
  unitsPerDay: KEEP, curve: KEEP,
  // Z14: het timephased-venster round-trippt nu écht via het nieuwe `OPS_Timephased`-JSON-pset
  // (ifcWriter.writeTimephasedMeta / ifcReader.extractAssignments) — echte KEEP-vergelijking.
  // Nog ONGEVULD door de mpp-lezer (Z8, aparte taak) — dit is puur de opslag-/round-trip-laag.
  workWindowStart: KEEP, workWindowFinish: KEEP,
} satisfies CanonSpec<ResourceAssignment>;

const PROJECT_CANON = {
  id: { skip: 'documentinterne id; de reader genereert een eigen id, geen contractuele data' },
  name: KEEP,
  // description/author/company/createdAt/modifiedAt round-trippen sinds H2.
  description: KEEP, startDate: KEEP, endDate: KEEP,
  calendarId: { as: 'calendar', get: (p: Project, k: Keys) => k.cal(p.calendarId) },
  createdAt: KEEP, modifiedAt: KEEP, author: KEEP, company: KEEP,
  wbsAutoNumber: KEEP, statusDate: KEEP, progressMode: KEEP, schedulingOptions: KEEP,
  // B1.1: bedrijfsbinding round-trippt via OPS_CompanyBinding.
  companyId: KEEP, companyName: KEEP,
} satisfies CanonSpec<Project>;

const BASELINE_TASK_CANON = {
  taskId: { as: 'task', get: (bt: BaselineTask, k: Keys) => k.task(bt.taskId) },
  start: KEEP, finish: KEEP, duration: KEEP, isMilestone: KEEP, milestoneKind: KEEP,
} satisfies CanonSpec<BaselineTask>;

const BASELINE_CANON = {
  id: KEEP,   // baseline-ids round-trippen letterlijk mee (OPS_Baselines-JSON)
  name: KEEP, createdAt: KEEP,
  tasks: {
    get: (b: Baseline, k: Keys) => (b.tasks ?? []).map(bt => canonize(BASELINE_TASK_CANON, bt, k))
      .sort((x, y) => String(x.task).localeCompare(String(y.task))),
  },
  projectEnd: KEEP, projectDuration: KEEP,
} satisfies CanonSpec<Baseline>;

const CODE_VALUE_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de CODE is hier de natuurlijke sleutel' },
  code: KEEP, description: KEEP, color: KEEP,
} satisfies CanonSpec<ActivityCodeValue>;

const CODE_TYPE_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de NAAM is hier de natuurlijke sleutel' },
  name: KEEP,
  values: {
    get: (t: ActivityCodeType, k: Keys) => [...t.values]
      .sort((x, y) => x.code.localeCompare(y.code))
      .map(v => canonize(CODE_VALUE_CANON, v, k)),
  },
} satisfies CanonSpec<ActivityCodeType>;

const FIELD_DEF_CANON = {
  id: { skip: 'de meta-JSON bewaart de id letterlijk; de NAAM is hier de natuurlijke sleutel' },
  name: KEEP, type: KEEP,
} satisfies CanonSpec<CustomFieldDef>;

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

  const k: Keys = {
    cal: id => (id ? calNameById.get(id) ?? id : undefined),
    task: id => taskKeyById.get(id) ?? id,
    res: id => resNameById.get(id) ?? id,
    codeType: id => typeNameById.get(id) ?? id,
    codeValue: id => codeById.get(id) ?? id,
    fieldDef: id => defNameById.get(id) ?? id,
  };

  return {
    project: canonize(PROJECT_CANON, r.project, k),
    calendar: canonize(CALENDAR_CANON, r.calendar, k),
    resourceCalendars: (r.resourceCalendars ?? []).map(c => canonize(CALENDAR_CANON, c, k))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    tasks: [...r.tasks].sort((a, b) => a.wbsCode.localeCompare(b.wbsCode)).map(t => canonize(TASK_CANON, t, k)),
    sequences: [...r.sequences].map(s => canonize(SEQUENCE_CANON, s, k))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    resources: [...r.resources].sort((a, b) => a.name.localeCompare(b.name)).map(res => canonize(RESOURCE_CANON, res, k)),
    assignments: [...r.assignments].map(a => canonize(ASSIGNMENT_CANON, a, k))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    activityCodeTypes: [...(r.activityCodeTypes ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => canonize(CODE_TYPE_CANON, t, k)),
    customFieldDefs: [...(r.customFieldDefs ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => canonize(FIELD_DEF_CANON, d, k)),
    baselines: [...(r.baselines ?? [])].map(b => canonize(BASELINE_CANON, b, k))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
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

  // (1b) De aanwezigheidsregistratie (§9r, uitgebreid in taak 2/MOET 1 met de twee invoerslots) rust
  // op de writer-conventie "altijd een waarde, nooit `$`" voor zowel de zeven rekenslots als
  // ScheduleStart/ScheduleFinish. Een door OPS zelf geschreven bestand moet dus alle NEGEN slots
  // als aanwezig melden — schrijft de writer later ooit "alleen wat gezet is" over deze slots heen,
  // dan zakt "datums zoals opgeslagen" stil terug op herberekenen, met een verder groene suite.
  assert(rt1.tasks.every(t => (rt1.recordedFields?.[t.id] ?? []).length === ALL_RECORDED_SLOT_KEYS.length),
    '(1b) een door OPS zelf geschreven bestand moet ALLE negen slots (7 rekenslots + 2 invoerslots) als aanwezig melden');
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

// (4) B1 (§6) — projectbinding + herkomststempels expliciet: round-trippen door het project-IFC.
{
  assert(rt1.project.companyId === 'c-fixture', 'project.companyId round-trip');
  assert(rt1.project.companyName === 'Fixture Bouw BV', 'project.companyName round-trip');
  const rMem = rt1.resources.find(r => r.name === 'Timmerman Jan')!;
  assert(rMem.libraryOrigin?.companyId === 'c-fixture'
    && rMem.libraryOrigin?.libraryItemId === 'lib-res1'
    && rMem.libraryOrigin?.poolVersion === 4, 'resource.libraryOrigin round-trip');
  const rtProjCal = rt1.calendar;
  assert(rtProjCal.libraryOrigin?.companyId === 'c-fixture'
    && rtProjCal.libraryOrigin?.libraryItemId === 'lib-projcal'
    && rtProjCal.libraryOrigin?.poolVersion === 4, 'projectkalender.libraryOrigin round-trip');
  const rtLibCal = (rt1.resourceCalendars ?? []).find(c => c.name === 'Sublokatie kalender')!;
  assert(rtLibCal.libraryOrigin?.companyId === 'c-fixture'
    && rtLibCal.libraryOrigin?.libraryItemId === 'lib-libcal'
    && rtLibCal.libraryOrigin?.poolVersion === 4, 'bibliotheekkalender.libraryOrigin round-trip');
}

// (5) Contractuele projectdatums — de drie gevallen van de OPS_ProjectSettings-opslag. Het GEVULDE
//     geval loopt al door de vergelijking in (1) (fixture: 2026-06-15 … 2026-09-30, bewust los van
//     de taak-span 2026-07-06 … 2026-07-24). Hier de twee andere:
{
  // (4a) Een bewust LEEG gelaten einddatum moet leeg terugkomen. Zou de writer 'm — volgens de
  //      golden rule "alleen schrijven wat gezet is" — weglaten, dan viel de lezer terug op
  //      IFCWORKPLAN.FinishTime en stond de AFGELEIDE datum 2026-07-24 er alsnog in: dezelfde bug,
  //      alleen verplaatst naar het lege geval.
  const emptyEnd: ImportResult = { ...fixture, project: { ...fixture.project, endDate: '' } };
  const rtEmpty = readIFC(writeIFC(emptyEnd));
  assert(rtEmpty.project.endDate === '', `lege endDate moet leeg terugkomen — kreeg ${JSON.stringify(rtEmpty.project.endDate)}`);
  assert(rtEmpty.project.startDate === '2026-06-15', `gevulde startDate naast een lege endDate — kreeg ${JSON.stringify(rtEmpty.project.startDate)}`);

  // (4b) Terugval voor bestanden ZONDER de nieuwe pset-velden (vóór deze versie, of van een ander
  //      tool): die moeten zich exact gedragen als voorheen — de afgeleide plan-omvang uit
  //      IFCWORKPLAN. Gesimuleerd door precies die twee property-regels uit het bestand te knippen;
  //      de pset houdt dan losse verwijzingen over, die de lezer al negeert.
  const legacy = writeIFC(fixture).split('\n')
    .filter(l => !/IFCPROPERTYSINGLEVALUE\('Project(Start|End)Date'/.test(l)).join('\n');
  const rtLegacy = readIFC(legacy);
  assert(rtLegacy.project.startDate === '2026-07-06', `zonder pset-veld terugvallen op IFCWORKPLAN.StartTime — kreeg ${JSON.stringify(rtLegacy.project.startDate)}`);
  assert(rtLegacy.project.endDate === '2026-07-24', `zonder pset-veld terugvallen op IFCWORKPLAN.FinishTime — kreeg ${JSON.stringify(rtLegacy.project.endDate)}`);

  // (4c) De IFCWORKPLAN-slots zelf blijven ONGEWIJZIGD de afgeleide plan-omvang dragen (semantisch
  //      juist; andere IFC-tools lezen die slots). Dat is precies waarom de contractuele datums een
  //      eigen plek nodig hadden in plaats van dit slot over te nemen.
  const wpLine = writeIFC(fixture).split('\n').find(l => l.includes('IFCWORKPLAN('))!;
  assert(wpLine.includes("'2026-07-06") && wpLine.includes("'2026-07-24"),
    `IFCWORKPLAN moet de AFGELEIDE taak-span houden (2026-07-06 … 2026-07-24) — kreeg: ${wpLine}`);
  assert(!wpLine.includes('2026-06-15') && !wpLine.includes('2026-09-30'),
    `IFCWORKPLAN mag de CONTRACTUELE datums niet dragen — kreeg: ${wpLine}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (5) B8 — GlobalId-uitgifte: uniciteit, en de ONTKOPPELING van de baseline-remap.
//
// `ifcGuid` is een 32-bits hash, geen UUID. Twee dingen zijn nu geborgd, en de volgorde waarin ze
// zijn aangepakt is wezenlijk: eerst de ontkoppeling (de writer schrijft wég welk GlobalId hij per
// baseline-taak gebruikte), pas daarna de botsingscheck. Andersom zou een gesuffixt GlobalId de
// remap breken, omdat de reader de hash dan nog zelf herberekende.
{
  const ifc = writeIFC(fixture);

  // (5a) Elk ENTITY-GlobalId komt precies één keer voor. Let op de ankering op `#N=`: een naïeve
  //      scan op `IFC…('…')` telt ook `IFCTEXT('<guid>')` mee, en dat zijn juist de bedoelde
  //      VERWIJZINGEN naar een GlobalId (ParentGuid, en de resource-GUID als property-naam van een
  //      toewijzing). Die horen te herhalen; entity-id's niet.
  const entityGuids = [...ifc.matchAll(/^#\d+=IFC[A-Z]+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  const dupes = entityGuids.filter((g, i) => entityGuids.indexOf(g) !== i);
  assert(entityGuids.length > 20, `verwachtte een flink aantal entity-GlobalIds — kreeg ${entityGuids.length}`);
  assert(dupes.length === 0, `entity-GlobalIds moeten uniek zijn — dubbel: ${[...new Set(dupes)].join(', ')}`);

  // (5b) De writer schrijft de taak→GlobalId-map expliciet weg, zodat de reader niets hoeft te
  //      herberekenen.
  assert(ifc.includes("'TaskGuids'"), 'writeBaselineMeta moet een TaskGuids-map schrijven zolang er baselines zijn');

  const baseRt = readIFC(ifc);
  const bt0 = baseRt.baselines![0].tasks[0];
  assert(baseRt.tasks.some(t => t.id === bt0.taskId),
    'basisgeval: de baseline-taak moet normaal op een bestaande taak worden geremapt');

  // (5c) En de reader GEBRUIKT die map. Bewijs: wijs in de map de eerste baseline-taak naar het
  //      GlobalId van een ÁNDERE taak. Herberekende de reader nog zelf, dan verandert er niets;
  //      volgt hij de map, dan landt de baseline-taak op die andere taak.
  const other = baseRt.tasks.find(t => t.id !== bt0.taskId)!;
  const otherLine = ifc.split('\n').find(l => l.includes('=IFCTASK(') && l.includes(`'${other.name}'`))!;
  const otherGuid = /=IFCTASK\('([0-9A-Za-z_$]{22})'/.exec(otherLine)![1];
  const mapLine = ifc.split('\n').find(l => l.includes("'TaskGuids'"))!;
  const origGuid = /IFCTEXT\('.*?:.*?([0-9A-Za-z_$]{22})/.exec(mapLine)?.[1];
  assert(!!origGuid, 'kon het eerste GlobalId in de TaskGuids-map niet uitlezen');
  const tampered = ifc.replace(mapLine, mapLine.replace(origGuid!, otherGuid));
  const rtTampered = readIFC(tampered);
  // NB: `readIFC` genereert per leesbeurt NIEUWE taak-id's, dus vergelijken met een id uit een
  //     eerdere leesbeurt kan niet — we identificeren de doeltaak op naam binnen dezelfde beurt.
  const otherInTampered = rtTampered.tasks.find(t => t.name === other.name)!;
  assert(rtTampered.baselines![0].tasks.some(bt => bt.taskId === otherInTampered.id),
    'de reader moet de expliciete TaskGuids-map volgen, niet de hash herberekenen (B8-ontkoppeling)');

  // (5d) Terugval voor bestanden van vóór deze wijziging: haal de map weg en de remap moet nog
  //      steeds werken via de herberekende hash.
  const legacy = ifc.split('\n').filter(l => !l.includes("'TaskGuids'")).join('\n');
  const rtLegacyGuids = readIFC(legacy);
  assert(rtLegacyGuids.tasks.some(t => t.id === rtLegacyGuids.baselines![0].tasks[0].taskId),
    'zonder TaskGuids-map (oud bestand) moet de remap terugvallen op het herberekenen van de hash');
}

// (6) Aanwezigheidsregistratie (issue #63). Taak 1 ("Aanwezigheid van rekenslots vastleggen in de
// IFC-lezer") registreerde de zeven REKENSLOTS: `$` telt NIET als opgeslagen datum, want
// parseDateFromIFC maakt van `$` de datum van VANDAAG. Taak 2 (kwaliteitsreview MOET 1) breidde dit
// uit met de twee INVOERSLOTS ScheduleStart/ScheduleFinish: zonder hún aanwezigheid apart te
// registreren kon `captureRecordedDates` (recordedDates.ts) een `$`-ScheduleStart niet onderscheiden
// van een écht geëxporteerde datum, en zou een IFCTASK zonder IfcTaskTime (of met `$` op
// ScheduleStart) alsnog als "vandaag opgeslagen" worden voorgesteld — precies de kritieke bevinding.
{
  const TT_LEEG = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    // IfcTaskTime met alleen ScheduleStart/ScheduleFinish; alle rekenslots (EarlyStart t/m
    // IsCritical) op `$`.
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Extern A',$,$,'1.1',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    // Taak ZONDER IfcTaskTime-referentie (taskTime-slot op `$`) — moet ook een lege lijst geven,
    // niet een ontbrekende entry (het contract in extractTasks: "geen slot gevuld" ≠ "onbekend").
    "#3=IFCTASK('g3',$,'Zonder tijd',$,$,'1.2',$,$,$,.F.,$,$,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtLeeg = readIFC(TT_LEEG);
  assert(rtLeeg.tasks.length === 2, `9r fixture moet precies twee taken opleveren — kreeg ${rtLeeg.tasks.length}`);
  const leegId = rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.id;
  // Geen enkel REKENSLOT is aanwezig, maar ScheduleStart/ScheduleFinish WEL — sinds taak 2/MOET 1
  // meldt recordedFields dat nu, precies zodat captureRecordedDates hier de schedule-laag mag kiezen
  // (zie check-recorded-dates.ts, de MOET-4-laagkeuze) in plaats van niets te kunnen zeggen.
  assert(JSON.stringify(rtLeeg.recordedFields?.[leegId]) === JSON.stringify(['scheduleStart', 'scheduleFinish']),
    `9r geen rekenslot, wel de twee invoerslots aanwezig gemeld — kreeg ${JSON.stringify(rtLeeg.recordedFields?.[leegId])}`);
  assert(rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.time.scheduleStart === '2026-03-02',
    `9r scheduleStart moet gewoon gelezen worden — kreeg ${rtLeeg.tasks.find(t => t.wbsCode === '1.1')!.time.scheduleStart}`);
  const zonderTijdId = rtLeeg.tasks.find(t => t.wbsCode === '1.2')!.id;
  // Taak ZONDER IfcTaskTime-entiteit: er is niets om uit te lezen, dus ook de twee invoerslots
  // blijven afwezig — de lege lijst is hier terecht leeg (i.p.v. ['scheduleStart','scheduleFinish']
  // zoals hierboven), wat `captureRecordedDates` straks laat concluderen "geen uitspraak" i.p.v. de
  // `createDefaultTaskTime`-"vandaag"-default als een echte datum te lezen (kritieke bevinding).
  assert(JSON.stringify(rtLeeg.recordedFields?.[zonderTijdId]) === JSON.stringify([]),
    `9r taak zonder IfcTaskTime moet een lege lijst geven (niet ontbrekend, en niet de twee invoerslots) — kreeg ${JSON.stringify(rtLeeg.recordedFields?.[zonderTijdId])}`);

  // Tegenproef: mét gevulde rekenslots én invoerslots worden ze allemaal gemeld (freeFloat blijft
  // bewust `$`, dus die hoort NIET in de lijst — bewijst dat het per-slot en niet per-IfcTaskTime
  // wordt geregistreerd).
  const TT_VOL = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06','2026-03-02','2026-03-06','2026-03-04','2026-03-10',$,'P2D',.T.,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Extern A',$,$,'1.1',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtVol = readIFC(TT_VOL);
  assert(rtVol.tasks.length === 1, `9r VOL-fixture moet precies één taak opleveren — kreeg ${rtVol.tasks.length}`);
  const wantVol = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'isCritical', 'scheduleStart', 'scheduleFinish'];
  assert(JSON.stringify(rtVol.recordedFields?.[rtVol.tasks[0].id]) === JSON.stringify(wantVol),
    `9r gevulde reken- én invoerslots wél gemeld — kreeg ${JSON.stringify(rtVol.recordedFields?.[rtVol.tasks[0].id])}`);

  // De kritieke bevinding zelf, expliciet vastgelegd (hercontrole kwaliteitsreview): een IfcTaskTime
  // MET `$` op ScheduleStart (maar ScheduleFinish gevuld) mag ScheduleStart NIET als aanwezig melden.
  // `recordedSlotsOf` gebruikt één lus over alle negen sleutels met dezelfde `arg && arg !== '$'`-
  // check per slot; zonder deze assertie zou een latere "vereenvoudiging" die de `$`-check op de twee
  // invoerslots overslaat (want "invoer is er toch altijd") zowel TT_LEEG als TT_VOL hierboven groen
  // laten staan — precies de regressie die deze hele taak moest voorkomen.
  const TT_HALF_SCHEDULE = [
    'ISO-10303-21;', 'HEADER;',
    "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
    // ScheduleStart op `$`, ScheduleFinish gevuld; alle rekenslots ook `$`.
    "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,$,'2026-03-06',$,$,$,$,$,$,$,$,$,$,$,$,$);",
    "#2=IFCTASK('g2',$,'Half schedule',$,$,'1.3',$,$,$,.F.,$,#9,.CONSTRUCTION.);",
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const rtHalf = readIFC(TT_HALF_SCHEDULE);
  assert(rtHalf.tasks.length === 1, `9r HALF-fixture moet precies één taak opleveren — kreeg ${rtHalf.tasks.length}`);
  const halfId = rtHalf.tasks[0].id;
  assert(JSON.stringify(rtHalf.recordedFields?.[halfId]) === JSON.stringify(['scheduleFinish']),
    `9r $-ScheduleStart telt niet mee als aanwezig, ScheduleFinish wel — kreeg ${JSON.stringify(rtHalf.recordedFields?.[halfId])}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (6) T5-HERZIENING (2026-08-15, spec-reviewbevinding — zie het plandocument §T5) — extern-stijl
//     fragment: een spec-conforme externe IFC 4.3-tool mag een RECURRENTE FEESTDAG ("elke 25
//     december") schrijven als `IFCWORKTIME` met een GEVULDE `RecurrencePattern`-ref (args[3]),
//     zonder de OPS-pset-markering die alleen ONZE writer zet. Vóór de herziening zou zo'n ref op
//     zichzelf al "werkende uitzondering" betekenen (het oorspronkelijke, foutieve ontwerp) — deze
//     case bewijst dat de reader nu conservatief blijft: geen OPS-markering ⇒ feestdag, ook met een
//     gevulde recurrence. We bouwen het fragment door de "Kerst"-feestdagregel uit de echte
//     `writeIFC`-uitvoer te patchen (geen losse hand-geschreven STEP-file nodig — dat zou het risico
//     lopen zelf een ongeldig fragment te zijn) en een YEARLY-recurrence toe te voegen die de writer
//     zelf nooit voor een feestdag zou schrijven.
{
  const ifc = writeIFC(fixture);
  const lines = ifc.split('\n');
  const ids = lines.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const newRecId = Math.max(...ids) + 1;

  const kerstIdx = lines.findIndex(l => l.includes("IFCWORKTIME('Kerst',.PREDICTED.,$,$,"));
  assert(kerstIdx >= 0, 'kon de ongepatchte Kerst-feestdagregel niet vinden (verwacht args[3]=$)');
  const patchedLine = lines[kerstIdx].replace(
    "IFCWORKTIME('Kerst',.PREDICTED.,$,$,",
    `IFCWORKTIME('Kerst',.PREDICTED.,$,#${newRecId},`,
  );
  assert(patchedLine !== lines[kerstIdx], 'kon de RecurrencePattern-ref niet inpatchen in de Kerst-regel');
  lines[kerstIdx] = patchedLine;

  // Vóór de DATA-sluitende `ENDSEC;` (de HEADER-sectie heeft er ook één, vandaar `lastIndexOf` i.p.v.
  // de eerste treffer — anders belandt de nieuwe entiteit vóór `DATA;` en is het fragment ongeldig).
  const dataEndIdx = lines.lastIndexOf('ENDSEC;');
  assert(dataEndIdx > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden');
  lines.splice(dataEndIdx, 0, `#${newRecId}=IFCRECURRENCEPATTERN(.YEARLY.,$,$,(25),(12),$,$,$);`);

  const rt = readIFC(lines.join('\n'));
  const kerstAsHoliday = rt.calendar.holidays.find(h => h.name === 'Kerst');
  const kerstAsException = (rt.calendar.workingExceptions ?? []).find(e => e.name === 'Kerst');
  assert(!!kerstAsHoliday, 'extern-fragment: "Kerst" met gevulde-maar-ongemarkeerde RecurrencePattern moet als feestdag teruglezen');
  assert(!kerstAsException, 'extern-fragment: "Kerst" mag NIET als werkende uitzondering teruglezen — dat was precies de spec-reviewregressie');

  // Mutatiebewijs (uitgevoerd, zie commitbericht): de oude discriminator ("recurrence-ref gevuld
  // ⇒ werkende uitzondering") teruggezet in de reader maakt precies déze twee asserties ROOD.
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (7) T5-HERZIENING her-check-afronding (hardening-§7): rode-pad-fixture voor de `try { JSON.parse }
//     catch` in `extractWorkingExceptionStepIds`, plus de reviewer-suggestie — een tweede
//     extern-fragment-variant MET gevulde TimePeriods (block 6 dekte alleen de lege vorm).
{
  // (7a) Corrupte JSON in de `WorkingExceptionIds`-property. `libCal` heeft echte werkende
  //      uitzonderingen in de fixture, dus zijn `OPS_Calendar`-pset draagt een reële property —
  //      die corrumperen we naar onparseerbare tekst. Verwacht: geen crash, terugval op "alles in
  //      ExceptionTimes is een feestdag" (dezelfde conservatieve terugval als "geen markering",
  //      block 6).
  const ifc7a = writeIFC(fixture);
  const lines7a = ifc7a.split('\n');
  const wexcIdx = lines7a.findIndex(l => l.includes("'WorkingExceptionIds'"));
  assert(wexcIdx >= 0, 'kon de WorkingExceptionIds-property niet vinden (verwacht op libCal, die heeft werkende uitzonderingen)');
  const corruptedLine = lines7a[wexcIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedLine !== lines7a[wexcIdx], 'kon de WorkingExceptionIds-waarde niet corrumperen');
  lines7a[wexcIdx] = corruptedLine;

  let rt7a: ImportResult | undefined;
  let threw: unknown;
  try {
    rt7a = readIFC(lines7a.join('\n'));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `corrupte WorkingExceptionIds-JSON mag niet crashen — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  const libCalOut = (rt7a?.resourceCalendars ?? []).find(c => c.name === 'Sublokatie kalender');
  assert(!!libCalOut, 'kon libCal niet terugvinden ná de corrupte-JSON-fallback');
  assert((libCalOut?.workingExceptions ?? []).length === 0,
    `corrupte JSON moet terugvallen op "alles is feestdag" — workingExceptions moet leeg zijn, kreeg ${libCalOut?.workingExceptions?.length ?? 'n.v.t.'}`);
  const holidayNames = (libCalOut?.holidays ?? []).map(h => h.name).sort();
  assert(holidayNames.includes('Overwerkdag') && holidayNames.includes('Verschoven werkdag'),
    `corrupte JSON: de twee werkende uitzonderingen moeten als feestdag teruglezen — kreeg holidays: ${JSON.stringify(holidayNames)}`);

  // Mutatiebewijs (uitgevoerd, zie commitbericht): de `catch { /* corrupte JSON: negeren */ }` in
  // `extractWorkingExceptionStepIds` tijdelijk laten rethrowen ⇒ deze case ROOD op
  // `assert(!threw, ...)` hierboven (een echte crash i.p.v. de bedoelde terugval).
}

{
  // (7b) Reviewer-suggestie: een tweede extern-fragment-variant met een ongemarkeerde YEARLY-
  //      recurrence die WEL gevulde TimePeriods draagt (06:00–12:00) — block 6 testte alleen de
  //      lege-TimePeriods-vorm. We hergebruiken "Nieuwjaar" (de tweede feestdag in de fixture) zodat
  //      dit los staat van block 6's "Kerst"-fragment.
  const ifc7b = writeIFC(fixture);
  const lines7b = ifc7b.split('\n');
  const ids7b = lines7b.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const newTpId = Math.max(...ids7b) + 1;
  const newRecId = newTpId + 1;

  const nieuwjaarIdx = lines7b.findIndex(l => l.includes("IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,$,"));
  assert(nieuwjaarIdx >= 0, 'kon de ongepatchte Nieuwjaar-feestdagregel niet vinden (verwacht args[3]=$)');
  const patchedLine = lines7b[nieuwjaarIdx].replace(
    "IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,$,",
    `IFCWORKTIME('Nieuwjaar',.PREDICTED.,$,#${newRecId},`,
  );
  assert(patchedLine !== lines7b[nieuwjaarIdx], 'kon de RecurrencePattern-ref niet inpatchen in de Nieuwjaar-regel');
  lines7b[nieuwjaarIdx] = patchedLine;

  const dataEndIdx7b = lines7b.lastIndexOf('ENDSEC;');
  assert(dataEndIdx7b > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden');
  lines7b.splice(dataEndIdx7b, 0,
    `#${newTpId}=IFCTIMEPERIOD('06:00:00','12:00:00');`,
    `#${newRecId}=IFCRECURRENCEPATTERN(.YEARLY.,$,$,(1),(1),$,$,(#${newTpId}));`,
  );

  const rt7b = readIFC(lines7b.join('\n'));
  const nieuwjaarAsHoliday = rt7b.calendar.holidays.find(h => h.name === 'Nieuwjaar');
  const nieuwjaarAsException = (rt7b.calendar.workingExceptions ?? []).find(e => e.name === 'Nieuwjaar');
  assert(!!nieuwjaarAsHoliday,
    'extern-fragment-met-TimePeriods: "Nieuwjaar" moet als feestdag teruglezen, ook met daadwerkelijke banden op de ongemarkeerde recurrence');
  assert(!nieuwjaarAsException,
    'extern-fragment-met-TimePeriods: "Nieuwjaar" mag NIET als werkende uitzondering teruglezen — de OPS-markering ontbreekt, TimePeriods alleen is geen signaal');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (8) T14b (gebruikstestbevinding, ernst hoog — dataverlies): een taak met `time.completion ===
//     undefined` liet ELKE `writeIFC` crashen (`TypeError` op `w.task.time.completion.toFixed(1)`,
//     ifcTaskSlots.ts) — dat trof auto-save (faalt stil elke 10s), Opslaan/Opslaan-als, én
//     `planner_export_ifc`. Drieledige verdediging, elk apart mutatie-bewezen:
//       (8a) BRON — `taskSlice.addTask`: een meegegeven, onvolledig `time`-object wordt nu
//            veld-voor-veld gemerged (`mergeTaskTime`) i.p.v. ongewijzigd overgenomen.
//       (8b) BRON — `mcpTransaction.ts` `draft.addTask`: zelfde regel, MCP-pad.
//       (8c) EXTENSIE-RAND — `extMappers.ts` `fromExtTaskTime`: een extensie draait ongetypeerd, dus
//            de TS-`Required<>`-garantie van `ExtTaskTime` geldt niet op runtime; ontbrekende
//            velden krijgen hier al een terugval, los van de bronlaag.
//       (8d) VANGNET — `ifcTaskSlots.ts`: de writer crasht nooit meer op een ontbrekende
//            `completion`, ONGEACHT hoe de taak tot stand kwam (rechtstreeks gevoede, kunstmatig-
//            kapotte fixture — bronlaag en extensie-rand blijven hier bewust ongebruikt).
// ════════════════════════════════════════════════════════════════════════════════════════════════

// (8a) BRON — directe reproductie van de bugmelding via de ECHTE store: `addTask({..., time: {...
//      zonder completion}})`. Bewijst taskSlice.ts' `mergeTaskTime`-toepassing.
{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const S = () => useAppStore.getState();
  S().newProject();
  S().addTask({
    name: 'T14b-bron-store',
    time: { scheduleStart: '2026-08-10', scheduleDuration: 3, durationType: 'WORKTIME' } as TaskTime,
  });

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S()));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8a) writeIFC mag niet crashen na addTask zonder time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-bron-store');
    assert(out?.time.completion === 0, `(8a) completion moet via de merge-default op 0 uitkomen — kreeg ${out?.time.completion}`);
    // Het completion-vangnet in ifcTaskSlots.ts (8d) zou een crash hier ALSNOG voorkomen zelfs
    // zonder de merge — deze regel isoleert dus specifiek de BRON-fix: freeFloat/totalFloat hebben
    // géén eigen vangnet, dus een ongemergede (nog altijd `undefined`) waarde interpoleert letterlijk
    // de string "undefined" in de STEP-uitvoer (geverifieerd: `'P0Y0MundefinedD'`).
    assert(!ifcOut.includes('undefined'), `(8a) writeIFC-uitvoer mag nooit de tekst "undefined" bevatten — bewijst dat ALLE gemergede time-velden gevuld zijn, niet alleen completion`);
  }
  // Mutatiebewijs (uitgevoerd): `mergeTaskTime(createDefaultTaskTime(...), partial.time)` in
  // taskSlice.ts `addTask` teruggezet naar `partial.time || createDefaultTaskTime(...)` maakt de
  // laatste assertie hierboven ROOD (freeFloat/totalFloat blijven `undefined` → `'P0Y0MundefinedD'`
  // in de STEP-tekst), óók al voorkomt het completion-vangnet in ifcTaskSlots.ts (8d) hier nog
  // steeds een echte crash — precies het bewijs dat de bron-fix ONAFHANKELIJK meetelt.
}

// (8b) BRON — zelfde reproductie via het MCP-pad (`mcpTransaction.ts` `draft.addTask`, bypassed de
//      extensie-mapper volledig). Bewijst dat de MCP-implementatie apart is gefixt.
{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { draft } = await import('@/state/mcpTransaction');
  const S = () => useAppStore.getState();
  S().newProject();
  draft.addTask({
    name: 'T14b-bron-mcp',
    time: { scheduleStart: '2026-08-11', scheduleDuration: 2, durationType: 'WORKTIME' } as TaskTime,
  });

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S()));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8b) writeIFC mag niet crashen na draft.addTask zonder time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-bron-mcp');
    assert(out?.time.completion === 0, `(8b) completion moet via de merge-default op 0 uitkomen — kreeg ${out?.time.completion}`);
    // Zelfde isolatie-redenering als (8a): freeFloat/totalFloat hebben geen eigen vangnet.
    assert(!ifcOut.includes('undefined'), `(8b) writeIFC-uitvoer mag nooit de tekst "undefined" bevatten — bewijst dat ALLE gemergede time-velden gevuld zijn, niet alleen completion`);
  }
  // Mutatiebewijs (uitgevoerd): dezelfde terugdraai-mutatie in mcpTransaction.ts' `draft.addTask`
  // maakt de laatste assertie hierboven ROOD, terwijl (8a) groen blijft — bewijst dat de twee
  // bron-call-sites onafhankelijk gefixt zijn (geen gedeelde code die één mutatie allebei zou raken).
}

// (8c) EXTENSIE-RAND — `fromExtTaskTime` in isolatie: een `ExtTaskTime`-achtig object dat op
//      RUNTIME niet aan zijn eigen `Required<>`-belofte voldoet (zoals een JS-extensie kan opsturen),
//      moet toch een geldige `TaskTime` opleveren — geen crash, geen `undefined`-lek naar de bronlaag.
{
  const { fromExtTaskTime } = await import('@/extensions/extMappers');
  const brokenExtTime = {
    durationType: 'WORKTIME',
    scheduleStart: '2026-08-12',
    scheduleFinish: '2026-08-14',
    // scheduleDuration/earlyStart/earlyFinish/lateStart/lateFinish/freeFloat/totalFloat/isCritical/
    // completion bewust WEGGELATEN — `ExtTaskTime` typeert ze als verplicht, maar een ongetypeerde
    // extensie kan ze gewoon weglaten.
  } as unknown as Parameters<typeof fromExtTaskTime>[0];

  const mapped = fromExtTaskTime(brokenExtTime);
  assert(mapped.completion === 0, `(8c) fromExtTaskTime zonder completion moet op 0 terugvallen — kreeg ${mapped.completion}`);
  assert(mapped.scheduleDuration === 0, `(8c) fromExtTaskTime zonder scheduleDuration moet op 0 terugvallen — kreeg ${mapped.scheduleDuration}`);
  assert(mapped.isCritical === false, `(8c) fromExtTaskTime zonder isCritical moet op false terugvallen — kreeg ${mapped.isCritical}`);
  assert(mapped.earlyStart === '2026-08-12' && mapped.lateStart === '2026-08-12',
    `(8c) ontbrekende early/lateStart moeten op scheduleStart terugvallen — kreeg earlyStart=${mapped.earlyStart}, lateStart=${mapped.lateStart}`);
  assert(mapped.earlyFinish === '2026-08-14' && mapped.lateFinish === '2026-08-14',
    `(8c) ontbrekende early/lateFinish moeten op scheduleFinish terugvallen — kreeg earlyFinish=${mapped.earlyFinish}, lateFinish=${mapped.lateFinish}`);

  // Bewijs dat het resultaat ook echt een GELDIGE taak oplevert (niet alleen "geen crash hier"):
  // door writeIFC/readIFC heen, zoals een `api.data.addTask`-aanroep 'm verderop zou voeren.
  const asTask: Task = {
    id: 't-8c', name: 'T14b-mapper-rand', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: mapped,
  };
  const rt8c = readIFC(writeIFC({ ...fixture, tasks: [...fixture.tasks, asTask] }));
  const out8c = rt8c.tasks.find(t => t.name === 'T14b-mapper-rand');
  assert(out8c?.time.completion === 0, `(8c) de gemapte taak moet ook door writeIFC/readIFC heen completion 0 houden — kreeg ${out8c?.time.completion}`);

  // Mutatiebewijs (uitgevoerd): elke `?? <default>` in `fromExtTaskTime` teruggezet naar de kale
  // doorgifte (`tt.completion`, `tt.scheduleDuration`, …) maakt de bijbehorende assertie hierboven
  // ROOD (bv. `mapped.completion === 0` faalt met `undefined` i.p.v. `0`).
}

// (8d) VANGNET — een kunstmatig-kapotte taak wordt RECHTSTREEKS aan `writeIFC` gevoed, bronlaag en
//      extensie-rand volledig omzeild (geen addTask, geen fromExtTaskTime). Bewijst dat de derde
//      verdedigingslinie in ifcTaskSlots.ts onafhankelijk van de andere twee lagen werkt.
{
  const brokenTask: Task = {
    id: 't-8d-vangnet', name: 'T14b-vangnet', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-08-15', '2026-08-17', 2), completion: undefined as unknown as number },
  };
  const brokenFixture: ImportResult = { ...fixture, tasks: [...fixture.tasks, brokenTask] };

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(brokenFixture);
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(8d) writeIFC mag nooit crashen op een kunstmatig-kapotte time.completion — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-vangnet');
    assert(out?.time.completion === 0, `(8d) completion moet via het vangnet op 0 terugkomen — kreeg ${out?.time.completion}`);
  }
  // Mutatiebewijs (uitgevoerd): `(w.task.time.completion ?? 0)` in ifcTaskSlots.ts teruggezet naar
  // `w.task.time.completion` maakt precies déze twee asserties ROOD — ONAFHANKELIJK van (8a)/(8b)/
  // (8c), die hier bewust ongebruikt blijven (de kapotte taak wordt buiten addTask/fromExtTaskTime om
  // rechtstreeks in de fixture gezet).
}

// (8e) F5 (spec-review-fixronde op 526af9f9, plan-Z14 regel ~470) — `toExtTask` moet de drie NIEUWE
//      Z14b-leeskant-velden (mspTaskType/effortDriven/timephasedContours) doorgeven, en ZWIJGEN als
//      ze niet gezet zijn (compact-optioneel, spiegelt hoe de rest van `toExtTask` met
//      `manuallyScheduled`/`splitGaps` omgaat).
{
  const { toExtTask } = await import('@/extensions/extMappers');
  const withFields: Task = {
    id: 't-8e', name: '(8e)-met-velden', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: plainTime('2026-08-18', '2026-08-20', 2),
    mspTaskType: 'FIXED_DURATION', effortDriven: true,
    timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 60, workMinutes: 60, kind: 'actual' }] }],
    // X0 (XER-etappeplan, 2026-08-20): drie nieuwe .xer-importvelden, zelfde compact-optionele
    // doorgifte als de drie Z14b-velden hierboven.
    p6DurationType: 'DT_FixedQty', p6ActivityType: 'TT_LOE', p6SuspendResume: true,
  };
  const mapped8e = toExtTask(withFields);
  assert(mapped8e.mspTaskType === 'FIXED_DURATION', `(8e) toExtTask moet mspTaskType doorgeven — kreeg ${mapped8e.mspTaskType}`);
  assert(mapped8e.effortDriven === true, `(8e) toExtTask moet effortDriven doorgeven — kreeg ${mapped8e.effortDriven}`);
  assert(
    JSON.stringify(mapped8e.timephasedContours) === JSON.stringify(withFields.timephasedContours),
    `(8e) toExtTask moet timephasedContours doorgeven — kreeg ${JSON.stringify(mapped8e.timephasedContours)}`,
  );
  assert(mapped8e.p6DurationType === 'DT_FixedQty', `(8e) toExtTask moet p6DurationType doorgeven — kreeg ${mapped8e.p6DurationType}`);
  assert(mapped8e.p6ActivityType === 'TT_LOE', `(8e) toExtTask moet p6ActivityType doorgeven — kreeg ${mapped8e.p6ActivityType}`);
  assert(mapped8e.p6SuspendResume === true, `(8e) toExtTask moet p6SuspendResume doorgeven — kreeg ${mapped8e.p6SuspendResume}`);

  const withoutFields: Task = {
    id: 't-8e-neg', name: '(8e)-zonder-velden', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [], time: plainTime('2026-08-18', '2026-08-20', 2),
  };
  const mapped8eNeg = toExtTask(withoutFields);
  assert(mapped8eNeg.mspTaskType === undefined, `(8e) zonder mspTaskType blijft toExtTask.mspTaskType undefined — kreeg ${mapped8eNeg.mspTaskType}`);
  assert(mapped8eNeg.effortDriven === undefined, `(8e) zonder effortDriven blijft toExtTask.effortDriven undefined — kreeg ${mapped8eNeg.effortDriven}`);
  assert(mapped8eNeg.timephasedContours === undefined, `(8e) zonder timephasedContours blijft toExtTask.timephasedContours undefined — kreeg ${mapped8eNeg.timephasedContours}`);
  assert(mapped8eNeg.p6DurationType === undefined, `(8e) zonder p6DurationType blijft toExtTask.p6DurationType undefined — kreeg ${mapped8eNeg.p6DurationType}`);
  assert(mapped8eNeg.p6ActivityType === undefined, `(8e) zonder p6ActivityType blijft toExtTask.p6ActivityType undefined — kreeg ${mapped8eNeg.p6ActivityType}`);
  assert(mapped8eNeg.p6SuspendResume === undefined, `(8e) zonder p6SuspendResume blijft toExtTask.p6SuspendResume undefined — kreeg ${mapped8eNeg.p6SuspendResume}`);

  // Mutatiebewijs (uitgevoerd): de drie nieuwe regels in `toExtTask` tijdelijk verwijderd maakt de
  // eerste drie asserties hierboven ROOD (undefined i.p.v. de gezette waarde).
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (9) T14b-vervolg (buiten-scope-vondst uit de eerste T14b-ronde, alsnog gedicht): `updateTask` deed
//     `Object.assign(task, updates)` — een meegegeven `updates.time` verving de HELE `time`-tak in
//     plaats van 'm aan te vullen. Een PARTIËLE time-update (bv. alleen `scheduleStart`, via de
//     publieke `api.data.updateTask`) wiste zo stil `completion`/floats/etc. — dezelfde schadeklasse
//     als (8), nu via UPDATE i.p.v. ADD, en zonder crash: de waarden verdwenen gewoon.
//       (9a) BRON — `taskSlice.updateTask`: `mergeTaskTime` met de BESTAANDE taaktijd als basis
//            (nooit een verse default — zie de docstring bij `mergeTaskTime`).
//       (9b) BRON — `mcpTransaction.ts` `draft.updateTaskFields`: zelfde regel op de MCP-vangrail.
//       (9c) EXTENSIE-RAND — het volledige `api.data.updateTask`-pad: `fromExtTaskUpdates` gebruikt
//            nu `fromExtTaskTimePatch` (geen fallback-fabricage) zodat (9a)'s merge de ECHTE
//            bestaande waarden kan terugvinden i.p.v. gefabriceerde generieke defaults.
//       (9d) `fromExtTaskUpdates` in isolatie: bewijst dat er NIET meer gefabriceerd wordt.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// (9a) BRON — taskSlice.updateTask: een partiële time-update mag completion niet wissen.
{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-update-store' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, completion: 0.4 } }); // volledige update: de VEILIGE weg, zet completion.

  // De KWETSBARE aanroep: een partiële time-update die completion niet meestuurt.
  S().updateTask(id, {
    time: { scheduleStart: '2026-09-01', scheduleDuration: 4, durationType: 'WORKTIME' } as TaskTime,
  });

  const afterPartial = S().tasks.find(t => t.id === id)!.time;
  assert(afterPartial.completion === 0.4, `(9a) een partiële time-update mag completion niet wissen — kreeg ${afterPartial.completion}`);
  assert(afterPartial.scheduleStart === '2026-09-01', `(9a) de daadwerkelijk opgegeven scheduleStart moet wél doorkomen — kreeg ${afterPartial.scheduleStart}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S()));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9a) writeIFC mag niet crashen na een partiële time-update — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-store');
    assert(out?.time.completion === 0.4, `(9a) completion moet 0.4 blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
  // Mutatiebewijs (uitgevoerd): `mergeTaskTime(s.tasks[idx].time, time)` in taskSlice.ts `updateTask`
  // teruggezet naar de kale `Object.assign(s.tasks[idx], updates)` (`time` dus wholesale vervangen)
  // maakt de EERSTE assertie hierboven al ROOD, vóór writeIFC zelfs aan bod komt (`afterPartial.
  // completion` wordt dan `undefined`, niet 0.4) — de meest directe, in-memory bewezen mutatie.
}

// (9b) BRON — mcpTransaction.ts draft.updateTaskFields: zelfde regel, MCP-vangrail.
{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { draft } = await import('@/state/mcpTransaction');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = draft.addTask({ name: 'T14b-update-mcp' });
  const full = S().tasks.find(t => t.id === id)!.time;
  draft.updateTaskFields(id, { time: { ...full, completion: 0.4 } });

  // `completion` hier bewust als EXPLICIETE `undefined`-sleutel (niet gewoon weggelaten): dat is
  // precies het residuele gat dat een kale `Object.assign(task.time, partial)` niet dekte — een
  // ONTBREKENDE sleutel liet `Object.assign` de bestaande waarde met rust, maar een AANWEZIGE sleutel
  // met waarde `undefined` (zoals een ongetypeerde aanroeper kan opsturen) werd alsnog gekopieerd en
  // wiste zo de bestaande completion. `mergeTaskTime`s `??` behandelt beide gevallen gelijk.
  draft.updateTaskFields(id, {
    time: { scheduleStart: '2026-09-02', scheduleDuration: 3, durationType: 'WORKTIME', completion: undefined } as unknown as TaskTime,
  });

  const afterPartial = S().tasks.find(t => t.id === id)!.time;
  assert(afterPartial.completion === 0.4, `(9b) draft.updateTaskFields mag completion niet wissen bij een partiële time-update — kreeg ${afterPartial.completion}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S()));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9b) writeIFC mag niet crashen na een partiële time-update via draft.updateTaskFields — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-mcp');
    assert(out?.time.completion === 0.4, `(9b) completion moet 0.4 blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
  // Mutatiebewijs (uitgevoerd): `mergeTaskTime(s.tasks[idx].time, time)` in mcpTransaction.ts' `draft.
  // updateTaskFields` teruggezet naar de kale `Object.assign(s.tasks[idx].time, time)` maakt de
  // completion-assertie hierboven ROOD — specifiek dankzij de EXPLICIETE `completion: undefined` in de
  // partial hierboven (een kale `Object.assign` liet een simpelweg ONTBREKENDE sleutel al met rust;
  // dit isoleert het residuele gat dat `mergeTaskTime`s `??` daarbovenop dicht). (9a) blijft groen —
  // bewijst dat de twee update-call-sites onafhankelijk gefixt zijn.
}

// (9c) EXTENSIE-RAND — het volledige `api.data.updateTask`-pad: fromExtTaskUpdates + de
//      store-updateTask-merge samen. Een extensie die alleen `scheduleStart` opgeeft, mag de rest
//      van de taak-tijd niet fabriceren/wissen.
{
  const { useAppStore } = await import('@/state/appStore');
  const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-update-ext' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, completion: 0.4 } });

  // Exact het `api.data.updateTask`-pad: een ONVOLLEDIG ExtTaskTime (zoals een ongetypeerde extensie
  // op runtime kan opsturen), enkel scheduleStart.
  S().updateTask(id, fromExtTaskUpdates({
    time: { scheduleStart: '2026-09-03' } as unknown as ExtTaskTime,
  }));

  const afterExt = S().tasks.find(t => t.id === id)!.time;
  assert(afterExt.completion === 0.4, `(9c) api.data.updateTask-pad mag completion niet wissen bij een partiële time-update — kreeg ${afterExt.completion}`);
  assert(afterExt.scheduleStart === '2026-09-03', `(9c) de daadwerkelijk opgegeven scheduleStart moet wél doorkomen — kreeg ${afterExt.scheduleStart}`);

  let threw: unknown;
  let ifcOut = '';
  try {
    ifcOut = writeIFC(buildWriteIFCInput(S()));
  } catch (e) {
    threw = e;
  }
  assert(!threw, `(9c) writeIFC mag niet crashen ná het volledige api.data.updateTask-pad — kreeg: ${threw instanceof Error ? threw.message : String(threw)}`);
  if (!threw) {
    const out = readIFC(ifcOut).tasks.find(t => t.name === 'T14b-update-ext');
    assert(out?.time.completion === 0.4, `(9c) completion moet 0.4 blijven ná writeIFC/readIFC — kreeg ${out?.time.completion}`);
  }
  // Mutatiebewijs (uitgevoerd): `fromExtTaskTimePatch` in `fromExtTaskUpdates` teruggezet naar
  // `fromExtTaskTime` (de fabricerende ADD-variant) maakt de completion-assertie hierboven ROOD —
  // ONAFHANKELIJK van (9a): taskSlice.updateTask's merge blijft daarbij ongewijzigd gefixt, maar
  // krijgt dan een reeds-VOLLEDIG (met generieke defaults gefabriceerd) object aangeleverd en kan de
  // echte 0.4 niet meer terugvinden.
}

// (9d) fromExtTaskUpdates in isolatie: bewijst dat er GEEN fallback-fabricage meer gebeurt voor een
//      veld dat de aanroeper niet opgaf (dat zou (9c)'s merge om de tuin leiden).
{
  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const patch = fromExtTaskUpdates({ time: { scheduleStart: '2026-09-04' } as unknown as ExtTaskTime });
  assert(patch.time?.scheduleStart === '2026-09-04', `(9d) fromExtTaskUpdates moet de opgegeven scheduleStart doorgeven — kreeg ${patch.time?.scheduleStart}`);
  assert(patch.time?.completion === undefined, `(9d) fromExtTaskUpdates mag GEEN completion fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.completion}`);
  assert(patch.time?.isCritical === undefined, `(9d) fromExtTaskUpdates mag GEEN isCritical fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.isCritical}`);
  assert(patch.time?.freeFloat === undefined, `(9d) fromExtTaskUpdates mag GEEN freeFloat fabriceren voor een niet-opgegeven veld — kreeg ${patch.time?.freeFloat}`);
  // Mutatiebewijs (uitgevoerd): `fromExtTaskTimePatch` in `fromExtTaskUpdates` teruggezet naar
  // `fromExtTaskTime` maakt alle drie de laatste asserties hierboven ROOD (completion/isCritical/
  // freeFloat worden dan 0/false/0 gefabriceerd i.p.v. ontbrekend te blijven).
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (10) T14b-spec-review-fixronde (2026-08-17): blok (9) sloot het gat voor de 12 VERPLICHTE velden,
//      maar voor de 9 OPTIONELE velden bewees de reviewer dat de toenmalige "1-op-1 uit partial,
//      geen terugval"-vorm hetzelfde soort dataverlies gaf — een partiële `api.data.updateTask`-
//      aanroep die alleen `scheduleStart` noemde, wiste stil `durationMinutes`/`actualStart`/
//      `actualFinish`/`remainingTime`/`remainingMinutes`. `mergeTaskTime` gebruikt voor die 9 velden
//      nu de SLEUTEL-AANWEZIGHEID-conventie (`'veld' in partial ? partial.veld : base.veld`) i.p.v.
//      een waarde-check — dat is de enige vorm die "bewust gewist" (sleutel aanwezig, `undefined`)
//      kan onderscheiden van "nooit genoemd" (sleutel afwezig). `TaskDialog.tsx` is aangepast van
//      `delete time.durationMinutes` naar `time.durationMinutes = undefined`, want een `delete` laat
//      de sleutel weer verdwijnen vóórdat de merge 'm ziet.
//        (10a) `mergeTaskTime` in isolatie — alle 9 optionele velden, beide scenario's.
//        (10b) het reviewer-scenario op alle drie de update-paden (taskSlice/draft/api.data).
//        (10c) de clear-conventie op store-niveau (TaskDialog-stijl payload).
//        (10d) TaskDialog.tsx-bronguard — dit repo heeft geen React-rendertest-harnas (CLAUDE.md:
//              "Er is geen vitest/jest"), dus dit is een bewuste, lichte bronvorm-check: bewijst dat
//              de daadwerkelijke `delete`→`= undefined`-mutatie in TaskDialog.tsx zelf is doorgevoerd.
//        (10e) mspdiWriter.ts-vangnet (spec-review-bevinding): `Math.round(completion * 100)` gaf
//              `NaN` in de MSPDI-export bij een undefined completion — zelfde diepteverdediging als
//              de IFC-writer.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// (10a) mergeTaskTime in isolatie: sleutel-aanwezigheid voor alle 9 optionele velden.
{
  const { mergeTaskTime, createDefaultTaskTime } = await import('@/utils/taskDefaults');
  const base: TaskTime = {
    ...createDefaultTaskTime('2026-08-01', 5),
    completion: 0.4,
    durationMinutes: 240,
    interferingFloat: 1.5,
    isNearCritical: true,
    floatPath: 2,
    actualStart: '2026-08-01',
    actualFinish: '2026-08-03',
    actualDuration: 2,
    remainingTime: 1,
    remainingMinutes: 60,
  };

  // Scenario 1: partial noemt GEEN van de 9 optionele velden (alleen scheduleStart) ⇒ allemaal behouden.
  const notMentioned = mergeTaskTime(base, { scheduleStart: '2026-08-10' });
  assert(notMentioned.durationMinutes === 240, `(10a) ontbrekende sleutel moet durationMinutes behouden — kreeg ${notMentioned.durationMinutes}`);
  assert(notMentioned.interferingFloat === 1.5, `(10a) ontbrekende sleutel moet interferingFloat behouden — kreeg ${notMentioned.interferingFloat}`);
  assert(notMentioned.isNearCritical === true, `(10a) ontbrekende sleutel moet isNearCritical behouden — kreeg ${notMentioned.isNearCritical}`);
  assert(notMentioned.floatPath === 2, `(10a) ontbrekende sleutel moet floatPath behouden — kreeg ${notMentioned.floatPath}`);
  assert(notMentioned.actualStart === '2026-08-01', `(10a) ontbrekende sleutel moet actualStart behouden — kreeg ${notMentioned.actualStart}`);
  assert(notMentioned.actualFinish === '2026-08-03', `(10a) ontbrekende sleutel moet actualFinish behouden — kreeg ${notMentioned.actualFinish}`);
  assert(notMentioned.actualDuration === 2, `(10a) ontbrekende sleutel moet actualDuration behouden — kreeg ${notMentioned.actualDuration}`);
  assert(notMentioned.remainingTime === 1, `(10a) ontbrekende sleutel moet remainingTime behouden — kreeg ${notMentioned.remainingTime}`);
  assert(notMentioned.remainingMinutes === 60, `(10a) ontbrekende sleutel moet remainingMinutes behouden — kreeg ${notMentioned.remainingMinutes}`);

  // Scenario 2: partial noemt ALLE 9 optionele velden EXPLICIET als `undefined` (bewuste clear) ⇒ allemaal gewist.
  const explicitlyCleared = mergeTaskTime(base, {
    scheduleStart: '2026-08-10',
    durationMinutes: undefined,
    interferingFloat: undefined,
    isNearCritical: undefined,
    floatPath: undefined,
    actualStart: undefined,
    actualFinish: undefined,
    actualDuration: undefined,
    remainingTime: undefined,
    remainingMinutes: undefined,
  });
  assert(explicitlyCleared.durationMinutes === undefined, `(10a) expliciete undefined-sleutel moet durationMinutes wissen — kreeg ${explicitlyCleared.durationMinutes}`);
  assert(explicitlyCleared.interferingFloat === undefined, `(10a) expliciete undefined-sleutel moet interferingFloat wissen — kreeg ${explicitlyCleared.interferingFloat}`);
  assert(explicitlyCleared.isNearCritical === undefined, `(10a) expliciete undefined-sleutel moet isNearCritical wissen — kreeg ${explicitlyCleared.isNearCritical}`);
  assert(explicitlyCleared.floatPath === undefined, `(10a) expliciete undefined-sleutel moet floatPath wissen — kreeg ${explicitlyCleared.floatPath}`);
  assert(explicitlyCleared.actualStart === undefined, `(10a) expliciete undefined-sleutel moet actualStart wissen — kreeg ${explicitlyCleared.actualStart}`);
  assert(explicitlyCleared.actualFinish === undefined, `(10a) expliciete undefined-sleutel moet actualFinish wissen — kreeg ${explicitlyCleared.actualFinish}`);
  assert(explicitlyCleared.actualDuration === undefined, `(10a) expliciete undefined-sleutel moet actualDuration wissen — kreeg ${explicitlyCleared.actualDuration}`);
  assert(explicitlyCleared.remainingTime === undefined, `(10a) expliciete undefined-sleutel moet remainingTime wissen — kreeg ${explicitlyCleared.remainingTime}`);
  assert(explicitlyCleared.remainingMinutes === undefined, `(10a) expliciete undefined-sleutel moet remainingMinutes wissen — kreeg ${explicitlyCleared.remainingMinutes}`);
  // Required velden blijven ondertussen ongemoeid door beide scenario's (regressiebewijs op de T9-fix).
  assert(notMentioned.completion === 0.4 && explicitlyCleared.completion === 0.4, '(10a) completion (verplicht veld) mag door dit blok niet geraakt worden');

  // Mutatiebewijs (uitgevoerd): elk `'veld' in partial ? partial.veld : base.veld` teruggezet naar de
  // vorige `partial.veld` (kale doorgifte, geen terugval) maakt ALLE 9 `notMentioned.*`-asserties ROOD
  // (kreeg `undefined` i.p.v. de bestaande waarde), terwijl de `explicitlyCleared.*`-asserties GROEN
  // bleven (kale doorgifte geeft toevallig ook `undefined` terug voor het clear-scenario) — precies
  // hoe de reviewer het gat vond: alleen het "niet genoemd"-scenario was stuk.
}

// (10b) Reviewer-scenario, op alle drie de update-paden: een partiële time-update die ALLEEN
//       scheduleStart noemt, mag durationMinutes/completion/actualStart/actualFinish/remainingTime/
//       remainingMinutes niet wissen.
{
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();

  const setFullProgress = (id: string) => {
    const full = S().tasks.find(t => t.id === id)!.time;
    S().updateTask(id, {
      time: {
        ...full,
        completion: 0.4,
        durationMinutes: 240,
        actualStart: '2026-08-01',
        actualFinish: '2026-08-03',
        remainingTime: 1,
        remainingMinutes: 60,
        // Z14 (sleutel-conventie-testgat, Z12-her-check L1): resume/stop volgen dezelfde
        // sleutel-aanwezigheid-conventie in mergeTaskTime als actualStart/actualFinish hierboven —
        // vóór deze twee regels was dat ONGETEST (mutatie `resume: partial.resume` i.p.v. de
        // `'resume' in partial`-guard bleef hier stil groen).
        resume: '2026-08-02',
        stop: '2026-08-02',
      },
    });
  };
  const assertPreserved = (label: string, id: string) => {
    const t = S().tasks.find(x => x.id === id)!.time;
    assert(t.completion === 0.4, `${label} completion moet 0.4 blijven — kreeg ${t.completion}`);
    assert(t.durationMinutes === 240, `${label} durationMinutes moet 240 blijven — kreeg ${t.durationMinutes}`);
    assert(t.actualStart === '2026-08-01', `${label} actualStart moet blijven — kreeg ${t.actualStart}`);
    assert(t.actualFinish === '2026-08-03', `${label} actualFinish moet blijven — kreeg ${t.actualFinish}`);
    assert(t.remainingTime === 1, `${label} remainingTime moet blijven — kreeg ${t.remainingTime}`);
    assert(t.remainingMinutes === 60, `${label} remainingMinutes moet blijven — kreeg ${t.remainingMinutes}`);
    // Z14 — de twee nieuwe cases (zie setFullProgress hierboven).
    assert(t.resume === '2026-08-02', `${label} resume moet blijven — kreeg ${t.resume}`);
    assert(t.stop === '2026-08-02', `${label} stop moet blijven — kreeg ${t.stop}`);
  };

  // Pad 1: taskSlice.updateTask rechtstreeks.
  S().newProject();
  const id1 = S().addTask({ name: 'T14b-10b-taskslice' });
  setFullProgress(id1);
  S().updateTask(id1, { time: { scheduleStart: '2026-09-10', scheduleDuration: 4, durationType: 'WORKTIME' } as TaskTime });
  assertPreserved('(10b/taskSlice)', id1);

  // Pad 2: mcpTransaction.draft.updateTaskFields.
  const { draft } = await import('@/state/mcpTransaction');
  const id2 = draft.addTask({ name: 'T14b-10b-mcp' });
  setFullProgress(id2);
  draft.updateTaskFields(id2, { time: { scheduleStart: '2026-09-11', scheduleDuration: 3, durationType: 'WORKTIME' } as TaskTime });
  assertPreserved('(10b/draft.updateTaskFields)', id2);

  // Pad 3: het volledige api.data.updateTask-pad (fromExtTaskUpdates + store-updateTask).
  const { fromExtTaskUpdates } = await import('@/extensions/extMappers');
  const id3 = S().addTask({ name: 'T14b-10b-ext' });
  setFullProgress(id3);
  S().updateTask(id3, fromExtTaskUpdates({ time: { scheduleStart: '2026-09-12' } as unknown as ExtTaskTime }));
  assertPreserved('(10b/api.data.updateTask)', id3);

  // Mutatiebewijs (uitgevoerd): elk `'veld' in partial ? partial.veld : base.veld` in `mergeTaskTime`
  // teruggezet naar de kale `partial.veld` maakt ALLE DRIE de paden hierboven ROOD (elk 6 asserties) —
  // exact het reviewer-scenario, nu structureel gedekt.
  //
  // Tweede, apart uitgevoerd mutatiebewijs (bevinding TIJDENS deze fixronde, niet door de reviewer
  // gemeld maar wél door dit blok gevangen): `fromExtTaskTimePatch` (extMappers.ts) teruggezet van
  // de `'veld' in tt`-vorm naar een object-LITERAL met elke sleutel expliciet genoemd (`{
  // durationMinutes: tt.durationMinutes, ... }`) maakt UITSLUITEND pad 3 ((10b/api.data.updateTask),
  // 5 asserties) ROOD — pad 1/2 blijven groen, want die gaan niet door `fromExtTaskTimePatch`. Een
  // object-literal zet een sleutel altijd als eigen property, ook met een `undefined`-waarde; dat
  // liet élk optioneel veld dat de aanroeper niet noemde alsnog als "bewust gewist" overkomen.
}

// (10c) Clear-conventie op store-niveau: een TaskDialog-stijl update (expliciete `undefined`-sleutel,
//       niet weggelaten) moet het veld daadwerkelijk wissen.
{
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();
  S().newProject();
  const id = S().addTask({ name: 'T14b-10c-clear' });
  const full = S().tasks.find(t => t.id === id)!.time;
  S().updateTask(id, { time: { ...full, durationMinutes: 240 } });
  assert(S().tasks.find(t => t.id === id)!.time.durationMinutes === 240, '(10c) opzet: durationMinutes moet eerst gezet zijn');

  // Exact het TaskDialog-patroon: spread de bestaande tijd, zet de te wissen sleutel EXPLICIET op
  // `undefined` (geen `delete`).
  const current = S().tasks.find(t => t.id === id)!.time;
  const cleared = { ...current, durationMinutes: undefined };
  S().updateTask(id, { time: cleared });

  assert(S().tasks.find(t => t.id === id)!.time.durationMinutes === undefined,
    `(10c) een expliciete undefined-sleutel moet durationMinutes daadwerkelijk wissen — kreeg ${S().tasks.find(t => t.id === id)!.time.durationMinutes}`);

  // Mutatiebewijs: dit blok blijft groen onder ZOWEL de oude ("1-op-1 uit partial") als de nieuwe
  // ("sleutel-aanwezigheid") vorm van mergeTaskTime — het bewijst dus specifiek de CONVENTIE die
  // TaskDialog.tsx nu volgt (`= undefined`), niet de (10a/10b)-fix zelf. Zie (10d) voor het
  // mutatiebewijs op TaskDialog.tsx's eigen bronregels.
}

// (10d) TaskDialog.tsx-bronguard: geen `delete time.durationMinutes` meer, wél de twee `=
//       undefined`-toewijzingen (mijlpaal-tak + dag-modus-tak). Dit repo heeft geen React-
//       rendertest-harnas, dus dit is een bewuste, lichte bronvorm-check i.p.v. een component-test.
{
  const taskDialogPath = join(HERE, '..', '..', 'src', 'components', 'dialogs', 'TaskDialog.tsx');
  const src = readFileSync(taskDialogPath, 'utf8');
  assert(!src.includes('delete time.durationMinutes'),
    '(10d) TaskDialog.tsx mag geen `delete time.durationMinutes` meer bevatten (zou de merge-sleutel weer laten verdwijnen)');
  const assignCount = (src.match(/time\.durationMinutes = undefined;/g) ?? []).length;
  assert(assignCount === 2,
    `(10d) TaskDialog.tsx moet precies 2× \`time.durationMinutes = undefined;\` bevatten (mijlpaal-tak + dag-modus-tak) — kreeg ${assignCount}`);

  // Mutatiebewijs (uitgevoerd): één van de twee `time.durationMinutes = undefined;`-regels in
  // TaskDialog.tsx tijdelijk teruggezet naar `delete time.durationMinutes;` maakte BEIDE asserties
  // hierboven ROOD (de `delete`-check ziet 'm weer, de telling zakt naar 1).
}

// (10e) mspdiWriter.ts-vangnet: een kunstmatig-kapotte `time.completion` mag geen "NaN" in de
//       MSPDI-export opleveren.
{
  const { writeMSPDI } = await import('@/services/msproject/mspdiWriter');
  const brokenTask: Task = {
    id: 't-10e-mspdi-vangnet', name: 'T14b-mspdi-vangnet', description: '', wbsCode: '',
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
    parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-09-05', '2026-09-07', 2), completion: undefined as unknown as number },
  };
  const xmlOut = writeMSPDI(
    fixture.project, fixture.calendar, [...fixture.tasks, brokenTask], fixture.sequences,
    fixture.resources, fixture.assignments, fixture.resourceCalendars, fixture.baselines,
    fixture.activeBaselineId ?? null,
  );
  assert(!xmlOut.includes('NaN'), '(10e) writeMSPDI-uitvoer mag nooit de tekst "NaN" bevatten (ongeguarde completion × 100)');
  const afterName = xmlOut.slice(xmlOut.indexOf('T14b-mspdi-vangnet'));
  const m = /<PercentComplete>(-?\d+)<\/PercentComplete>/.exec(afterName);
  assert(!!m && m[1] === '0', `(10e) PercentComplete moet via het vangnet 0 zijn — kreeg ${m?.[1] ?? 'GEEN MATCH'}`);

  // Mutatiebewijs (uitgevoerd): `(task.time.completion ?? 0)` in mspdiWriter.ts teruggezet naar de
  // kale `task.time.completion` maakt de eerste assertie hierboven ROOD (`PercentComplete>NaN<` komt
  // dan letterlijk in de uitvoer voor).
}

// (11) M3 (eindreview T16c): completion-precisie in IFC. `ifcTaskSlots.ts` schreef vóór deze fix
//      `.toFixed(1)` (10%-stappen) — een taak op 38% werd bij elke IFC-save stil 40%, en ≥0,955
//      rondde helemaal naar 100% (VOLTOOID-gedragswisseling in CPMSolver.ts: andere ES/EF-tak).
{
  const mkCompl = (id: string, completion: number): Task => ({
    id, name: `M3-${id}`, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...plainTime('2026-08-15', '2026-08-17', 2), completion },
  });
  const t38 = mkCompl('m3-38pct', 0.38);
  const t9955 = mkCompl('m3-9955pct', 0.955);
  const ifcOut = writeIFC({ ...fixture, tasks: [...fixture.tasks, t38, t9955] });
  const back = readIFC(ifcOut);
  const back38 = back.tasks.find((t) => t.name === 'M3-m3-38pct');
  const back9955 = back.tasks.find((t) => t.name === 'M3-m3-9955pct');
  assert(back38?.time.completion === 0.38, `(11a) M3-precisie: 38% blijft 0,38 (niet 0,4 — de oude 10%-afrondbug), kreeg ${back38?.time.completion}`);
  // (`(0.955).toFixed(2)` geeft "0.95", niet "0.96" — 0.955 heeft in IEEE-754-double geen exacte
  // representatie en ligt in werkelijkheid net ónder 0,955, dus `toFixed` rondt naar beneden af.
  // Dat is voor dit bewijs irrelevant: de kern is dat het NIET meer naar 1,0/100% afrondt.)
  assert(back9955?.time.completion === 0.95, `(11b) M3-precisie: 95,5% wordt 0,95 op 2 decimalen (niet 1,0/100% — de VOLTOOID-gedragswisseling), kreeg ${back9955?.time.completion}`);
  assert((back9955?.time.completion ?? 0) < 1, '(11c) M3-precisie: 95,5% mag NIET als 100% (completion===1, VOLTOOID-tak) terugkomen');

  // Backward-compatibiliteit: een bestand geschreven met de OUDE 1-decimaal-precisie (bv. door een
  // andere/oudere OPS-versie of een extern tool) leest nog steeds exact zo in als voorheen —
  // `parseFloat` is formaat-onafhankelijk, geen enkele nieuwe klem raakt bestaande bestanden. De
  // writer schrijft "0.38" (géén trailing nullen — `(0.38).toFixed(2)`), dus een kale
  // string-vervanging naar het OUDE 1-decimaal-formaat ("0.4") volstaat om dat pad te simuleren.
  assert(ifcOut.includes('0.38'), 'setup (11d): writer emitteert "0.38" letterlijk (geen trailing nullen)');
  const legacyText = ifcOut.replace('0.38', '0.4');
  const legacyBack = readIFC(legacyText);
  const legacyTask = legacyBack.tasks.find((t) => t.name === 'M3-m3-38pct');
  assert(legacyTask?.time.completion === 0.4, `(11d) M3-backward-compat: een 1-decimaal-bestand (extern/oud, "0.4") leest gewoon 0,4 — geen nieuwe leesklem, kreeg ${legacyTask?.time.completion}`);

  // Mutatiebewijs (uitgevoerd): `.toFixed(2)` in ifcTaskSlots.ts teruggezet naar `.toFixed(1)` maakt
  // (11a) en (11b)/(11c) ROOD — 0,38 wordt dan 0,4 en 0,955 wordt 1,0 (completion===1).
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (12) Z14 (acceptatie 4, spiegelt het T5-precedent uit blok (6)): extern-stijl IFC zonder de
//      OPS-markering leest CONSERVATIEF — geen fantoom-splits/-manual/-resume/-timephased. Anders
//      dan T5 (een discriminator die een gevulde-maar-neutrale ref verkeerd kon lezen) is de
//      bescherming hier structureel: `PER_TASK_PSET_BY_NAME`/`extractAssignments` dispatchen strikt
//      op EXACTE pset-naam (`OPS_TaskSplits`/`OPS_ManualScheduling`/`OPS_Resume`/`OPS_Timephased`),
//      dus een extern pset met een andere naam — óók als de INHOUD toevallig een geldige
//      splits-JSON-array bevat — wordt nooit als OPS-data gelezen. Bewezen door de writer-uitvoer
//      te patchen (geen losse hand-geschreven STEP-file), zelfde methode als blok (6).
{
  const ifc12 = writeIFC(fixture);
  // TX draagt geen splitGaps in de fixture (alleen TM, de kitchen-sink-taak, wel) — bevestig eerst
  // dat TX zónder patch ook geen splitGaps heeft (golden rule: de writer emitteert OPS_TaskSplits
  // alleen voor TM, niet voor TX — de patch hieronder koppelt het nep-fragment expliciet aan TX).
  const rt12setup = readIFC(ifc12);
  const tx12setup = rt12setup.tasks.find(t => t.wbsCode === '1.2'); // TX
  assert(tx12setup?.splitGaps === undefined, 'setup (12): TX heeft geen splitGaps vóór de patch');

  // Patch: een extern-stijl pset met een ANDERE naam ('EXT_FakeSplits', geen OPS_-prefix) maar
  // met een INHOUD die — als de dispatch op inhoud i.p.v. naam zou letten — als geldige splits
  // gelezen zou worden. Dezelfde IFCPROPERTYSET/IFCRELDEFINESBYPROPERTIES-vorm als een echte
  // OPS_TaskSplits-pset, gekoppeld aan TX (task_t-x).
  const lines12 = ifc12.split('\n');
  const ids12 = lines12.map(l => { const m = /^#(\d+)=/.exec(l); return m ? parseInt(m[1], 10) : 0; });
  const propId = Math.max(...ids12) + 1;
  const setId = propId + 1;
  const relId = setId + 1;
  const dataEndIdx12 = lines12.lastIndexOf('ENDSEC;');
  assert(dataEndIdx12 > 0, 'kon de sluitende ENDSEC; van de DATA-sectie niet vinden (blok 12)');
  // Vind de STEP-#id van task_t-x via zijn IFCTASK-regel (naam 'Ruwbouw', TX se naam in de fixture).
  const txLine = lines12.find(l => /=IFCTASK\(/.test(l) && l.includes("'Ruwbouw'"));
  assert(!!txLine, 'kon de IFCTASK-regel van TX (Ruwbouw) niet vinden');
  const txId = parseInt(/^#(\d+)=/.exec(txLine!)![1], 10);
  const fakeGaps = JSON.stringify([{ afterMinutes: 999, gapMinutes: 999 }]);
  lines12.splice(dataEndIdx12, 0,
    `#${propId}=IFCPROPERTYSINGLEVALUE('Splits',$,IFCTEXT('${fakeGaps}'),$);`,
    `#${setId}=IFCPROPERTYSET('2z14fakesplitspset0000001',#1,'EXT_FakeSplits',$,(#${propId}));`,
    `#${relId}=IFCRELDEFINESBYPROPERTIES('2z14fakesplitsrel00000001',#1,$,$,(#${txId}),#${setId});`,
  );

  const rt12 = readIFC(lines12.join('\n'));
  const tx12 = rt12.tasks.find(t => t.wbsCode === '1.2'); // TX
  assert(tx12?.splitGaps === undefined,
    `(12) extern-fragment: een pset met een NIET-OPS-naam ('EXT_FakeSplits') die toevallig geldige splits-JSON draagt, mag NIET als splitGaps gelezen worden — kreeg ${JSON.stringify(tx12?.splitGaps)}`);

  // Mutatiebewijs (uitgevoerd, zie commitbericht): `PER_TASK_PSET_BY_NAME.get(psetName)` in
  // ifcReader.ts tijdelijk vervangen door `PER_TASK_PSET_BY_NAME.get(psetName) ?? (psetName.includes('Splits')
  // ? PER_TASK_PSET_BY_NAME.get('OPS_TaskSplits') : undefined)` (een fuzzy substring-match op 'Splits'
  // i.p.v. de exacte naamsgelijkheid) maakt precies deze assertie ROOD — `EXT_FakeSplits` matcht de
  // substring, de fantoom-splits worden dan wél gelezen.
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (13) Z14-spec-review-fixronde (§8-punt): rode-pad-fixture voor de `try { JSON.parse } catch` in de
//      OPS_TaskSplits-descriptor (ifcPsets.ts) — TM draagt in de fixture een ECHTE 'Splits'-property
//      (op een GELDIGE OPS_TaskSplits-pset), die we corrumperen naar onparseerbare tekst. Verwacht:
//      geen crash, geen fantoom-splitGaps (de catch doet niets, `task.splitGaps` blijft ongezet —
//      exact het WorkingExceptionIds-precedent uit blok (7a), maar dan voor Splits).
{
  const ifc13 = writeIFC(fixture);
  const lines13 = ifc13.split('\n');
  const splitsIdx = lines13.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('Splits',"));
  assert(splitsIdx >= 0, 'kon de Splits-property niet vinden (verwacht op TM, die heeft splitGaps)');
  const corruptedSplitsLine = lines13[splitsIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedSplitsLine !== lines13[splitsIdx], 'kon de Splits-waarde niet corrumperen');
  lines13[splitsIdx] = corruptedSplitsLine;

  let rt13: ImportResult | undefined;
  let threw13: unknown;
  try {
    rt13 = readIFC(lines13.join('\n'));
  } catch (e) {
    threw13 = e;
  }
  assert(!threw13, `corrupte Splits-JSON mag niet crashen — kreeg: ${threw13 instanceof Error ? threw13.message : String(threw13)}`);
  const tm13 = rt13?.tasks.find(t => t.wbsCode === '1.1'); // TM
  assert(!!tm13, 'kon TM niet terugvinden ná de corrupte-Splits-fallback');
  assert(tm13?.splitGaps === undefined,
    `corrupte Splits-JSON moet terugvallen op "geen splits" (geen fantoomdata) — kreeg ${JSON.stringify(tm13?.splitGaps)}`);

  // Mutatiebewijs (uitgevoerd, zie commitbericht): de `catch { /* corrupte JSON: negeren ... */ }`
  // in de OPS_TaskSplits-descriptor (ifcPsets.ts) tijdelijk laten rethrowen ⇒ deze case ROOD op
  // `assert(!threw13, ...)` hierboven (een echte crash i.p.v. de bedoelde terugval).
}

// (14) Z14-spec-review-fixronde (§8-punt): rode-pad-fixture voor de `try { parsed = JSON.parse(raw) }
//      catch { continue }` in de OPS_Timephased-extractie (ifcReader.ts, extractAssignments) — A1
//      draagt in de fixture een ECHTE 'Windows'-property (op een GELDIGE OPS_Timephased-pset), die
//      we corrumperen naar onparseerbare tekst. Verwacht: geen crash, geen fantoom-workWindow (de
//      catch/continue slaat de hele pset over, `workWindowStart`/`workWindowFinish` blijven ongezet).
{
  const ifc14 = writeIFC(fixture);
  const lines14 = ifc14.split('\n');
  const windowsIdx = lines14.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('Windows',"));
  assert(windowsIdx >= 0, 'kon de Windows-property niet vinden (verwacht op t-x, A1 heeft een workWindow)');
  const corruptedWindowsLine = lines14[windowsIdx].replace(/IFCTEXT\('[^']*'\)/, "IFCTEXT('{niet geldige json')");
  assert(corruptedWindowsLine !== lines14[windowsIdx], 'kon de Windows-waarde niet corrumperen');
  lines14[windowsIdx] = corruptedWindowsLine;

  let rt14: ImportResult | undefined;
  let threw14: unknown;
  try {
    rt14 = readIFC(lines14.join('\n'));
  } catch (e) {
    threw14 = e;
  }
  assert(!threw14, `corrupte Windows-JSON mag niet crashen — kreeg: ${threw14 instanceof Error ? threw14.message : String(threw14)}`);
  // A1: taak t-x (TX, wbsCode 1.2), resource r-mem ('Timmerman Jan'), unitsPerDay 2 (curve BELL) —
  // de meest-specifieke sleutel om de juiste assignment terug te vinden (t-x/r-mem komt twee keer voor).
  const a1Back = rt14?.assignments.find(a => {
    const t = rt14!.tasks.find(tt => tt.id === a.taskId);
    const r = rt14!.resources.find(rr => rr.id === a.resourceId);
    return t?.wbsCode === '1.2' && r?.name === 'Timmerman Jan' && a.unitsPerDay === 2;
  });
  assert(!!a1Back, 'kon A1 (t-x/r-mem, unitsPerDay 2) niet terugvinden ná de corrupte-Windows-fallback');
  assert(a1Back?.workWindowStart === undefined && a1Back?.workWindowFinish === undefined,
    `corrupte Windows-JSON moet terugvallen op "geen venster" (geen fantoomdata) — kreeg start=${a1Back?.workWindowStart} finish=${a1Back?.workWindowFinish}`);

  // Mutatiebewijs (uitgevoerd, zie commitbericht): de `catch { continue }` in de OPS_Timephased-
  // extractie (ifcReader.ts) tijdelijk laten rethrowen ⇒ deze case ROOD op `assert(!threw14, ...)`
  // hierboven (een echte crash i.p.v. de bedoelde terugval).
}

// (15) Z19-reviewbevinding M1 — vijandige fixture voor de `workMinutes`-typebewaking in
//      `extractTimephasedDurationWalksMeta`s `isValidWalk` (ifcReader.ts): ANDERS dan case (14)
//      hierboven is dit GEEN onparseerbare JSON (die crasht niet, valt terug op "niets") — dit is
//      GELDIGE JSON met een SEMANTISCH fout getypeerd veld (`workMinutes` als string i.p.v. getal)
//      op ÉÉN van de TWEE items in TM se `timephasedDurationWalks`-array. `isValidWalk` toetst élk
//      item; `parsed.every(isValidWalk)` faalt dus op de HELE array, niet alleen het ene corrupte
//      item — verwacht gedrag (gepind, niet aangenomen): de VOLLEDIGE walks-lijst valt weg,
//      INCLUSIEF het andere, verder perfect geldige item (geen "gedeeltelijk redden").
{
  const ifc15 = writeIFC(fixture);
  const lines15 = ifc15.split('\n');
  const walksIdx = lines15.findIndex(l => l.includes("IFCPROPERTYSINGLEVALUE('DurationWalks',"));
  assert(walksIdx >= 0, 'kon de DurationWalks-property niet vinden (verwacht op t-m)');
  const corruptedWalksLine = lines15[walksIdx].replace('"workMinutes":1440', '"workMinutes":"oops"');
  assert(corruptedWalksLine !== lines15[walksIdx], 'kon de workMinutes-waarde niet corrumperen (verwacht letterlijk "workMinutes":1440 in de geschreven JSON)');
  lines15[walksIdx] = corruptedWalksLine;

  let rt15: ImportResult | undefined;
  let threw15: unknown;
  try {
    rt15 = readIFC(lines15.join('\n'));
  } catch (e) {
    threw15 = e;
  }
  assert(!threw15, `semantisch-corrupte DurationWalks-JSON mag niet crashen — kreeg: ${threw15 instanceof Error ? threw15.message : String(threw15)}`);
  const tm15 = rt15?.tasks.find(t => t.name === 'Oplevering');
  assert(!!tm15, 'kon TM (Oplevering) niet terugvinden ná de corrupte-workMinutes-fallback');
  assert(tm15?.timephasedDurationWalks === undefined,
    `semantisch-corrupte workMinutes op ÉÉN item laat de HELE walks-lijst wegvallen (geen gedeeltelijke redding) — kreeg ${JSON.stringify(tm15?.timephasedDurationWalks)}`);

  // Mutatiebewijs (uitgevoerd, zie commitbericht): `typeof (w as {workMinutes?:unknown}).workMinutes
  // === 'number'` in `isValidWalk` (ifcReader.ts) tijdelijk verzwakken tot "waarde is aanwezig"
  // (zonder typetoets) ⇒ deze case ROOD op `assert(tm15?.timephasedDurationWalks === undefined, ...)`
  // hierboven (de array zou dan gewoon met de string-waarde intact doorkomen).
}

// (16) Projectstartdatum-contract (critreview v2026.8.1, bevinding 1/4). Drie uitspraken:
//   a. "bewust leeg" (OPS-pset aanwezig, NominalValue $) blijft leeg door de round-trip — de
//      afleiding uit de vroegste taakstart mag een gebruikersuitspraak niet overschrijven;
//   b. ontbreekt élke bron (geen gevuld WORKPLAN-slot, geen pset), dan wordt de start afgeleid
//      uit de vroegste taak-scheduleStart — nooit "vandaag" verzonnen;
//   c. een IFCWORKPLAN met een LEEG StartTime-slot ($) telt als afwezig, niet als "vandaag".
{
  // (16a) leeggemaakte startdatum round-tript leeg.
  const leeg = readIFC(writeIFC({ ...fixture, project: { ...fixture.project, startDate: '' } }));
  assert(leeg.project.startDate === '',
    `(16a) bewust lege ProjectStartDate moet leeg round-trippen — kreeg ${JSON.stringify(leeg.project.startDate)}`);

  // (16b/16c) extern-stijl bestand zonder projectstart: afleiding uit de vroegste taakstart.
  // Slots via de registry (zoals tests/fixtures/recordedDatesIfc.ts) — nooit met de hand tellen.
  const tt = new Array<string>(IFC_TASKTIME_SLOTS.length).fill('$');
  tt[TASKTIME_SLOT.durationType] = '.WORKTIME.';
  tt[TASKTIME_SLOT.scheduleDuration] = "'P5D'";
  tt[TASKTIME_SLOT.scheduleStart] = "'2026-03-02'";
  tt[TASKTIME_SLOT.scheduleFinish] = "'2026-03-06'";
  const tk = new Array<string>(IFC_TASK_SLOTS.length).fill('$');
  tk[TASK_SLOT.globalId] = "'gT'";
  tk[TASK_SLOT.name] = "'A'";
  tk[TASK_SLOT.identification] = "'1.1'";
  tk[TASK_SLOT.isMilestone] = '.F.';
  tk[TASK_SLOT.taskTime] = '#9';
  tk[TASK_SLOT.predefinedType] = '.CONSTRUCTION.';
  const extern = (workplanRegel: string): string => [
    'ISO-10303-21;', 'HEADER;', "FILE_NAME('x.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
    'ENDSEC;', 'DATA;',
    "#1=IFCPROJECT('gP',$,'Extern',$,$,$,$,$,$);",
    ...(workplanRegel ? [workplanRegel] : []),
    `#9=IFCTASKTIME(${tt.join(',')});`,
    `#2=IFCTASK(${tk.join(',')});`,
    'ENDSEC;', 'END-ISO-10303-21;',
  ].join('\n');
  const zonder = readIFC(extern(''));
  assert(zonder.project.startDate === '2026-03-02',
    `(16b) zonder enige projectstart-bron wordt de vroegste taakstart afgeleid — kreeg ${JSON.stringify(zonder.project.startDate)}`);
  const leegSlot = readIFC(extern("#5=IFCWORKPLAN('gW',$,'Plan',$,$,$,$,$,$,$,$,$,$,$,.PLANNED.);"));
  assert(leegSlot.project.startDate === '2026-03-02',
    `(16c) een leeg IFCWORKPLAN-StartTime-slot telt als afwezig (geen "vandaag") — kreeg ${JSON.stringify(leegSlot.project.startDate)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
if (fails === 0) {
  console.log(`OK  ifc-roundtrip: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-roundtrip: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
