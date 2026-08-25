// Het publieke extensie-contract — volledigheid van de mappers, in beide richtingen.
//
// AANLEIDING (K-item 37). `extTypes.ts` bestaat om het interne domeinmodel NIET aan extensies te
// lekken, en `extMappers.ts` is de enige grensovergang. De kop van die mapper-module zegt het zelf
// al: verplichte velden vangt de compiler, maar **optionele velden niet** — een veld weglaten uit
// een object-literal is legaal TypeScript. Voeg je dus `ExtTask.deadline` toe en vergeet je hem in
// `toExtTask`, dan compileert alles en zien extensies het veld simpelweg nooit. Precies de klasse
// fout die stil blijft tot een gebruiker hem meldt.
//
// WAT HIER STAAT, EN WAAROM IN DEZE VORM.
//
//   (a) Per DTO een SLEUTELLIJST op waardeniveau, met een compile-time assertie in beide richtingen
//       tegen `keyof Required<Ext*>`. Een nieuw (ook optioneel) veld in het contract geeft dus een
//       COMPILEERFOUT hier, niet een stille lacune. Dit is hetzelfde patroon als
//       `_assertPickCoversRoles` in `state/snapshot.ts`.
//   (b) Een MAXIMALE fixture per interne vorm — élk optioneel veld gevuld — met `satisfies` tegen
//       het interne type. Een nieuw INTERN veld breekt de fixture pas als het verplicht is; voor
//       optionele interne velden doet de sleutellijst in (c) het werk.
//   (c) Voor de terugrichting een expliciete lijst interne velden die BEWUST niet oversteken. Dat
//       is het waardevolste deel: "wat stellen we niet bloot" was tot nu toe nergens vastgelegd en
//       dus niet te onderscheiden van "vergeten".
//   (d) De isolatie-eigenschap waar de hele mapper-laag om draait: een extensie krijgt een VERSE,
//       diepe kopie en kan de (Immer-bevroren) store niet via zijn kopie raken.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type {
  ExtProject, ExtCalendar, ExtTask, ExtTaskTime, ExtSequence, ExtResource, ExtAssignment,
  ExtRibbonTab, ExtFontProvider,
} from '@/extensions/extTypes';
import { EXTENSION_API_VERSION, checkApiCompatibility } from '@/extensions/apiVersion';
import {
  toExtProject, fromExtProject,
  toExtCalendar, fromExtCalendar,
  toExtTask, fromExtTask,
  toExtTaskTime, fromExtTaskTime,
  toExtSequence, fromExtSequence,
  toExtResource, fromExtResource,
  toExtAssignment, fromExtAssignment,
  fromExtTaskInput, fromExtTaskUpdates,
  fromExtRibbonTab, fromExtFontProvider,
} from '@/extensions/extMappers';
import { getExtensionSdk } from '@/extensions/sdk';
import { createExtensionApi } from '@/extensions/extensionApi';
import { useAppStore } from '@/state/appStore';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── (a) Sleutellijsten, compile-time vastgeklonken aan de types ──────────────
//
// `keys<T>()(lijst)` faalt te compileren zodra de lijst en `keyof Required<T>` uit elkaar lopen —
// in BEIDE richtingen. Een vergeten sleutel geeft "mist:", een verzonnen sleutel geeft "te veel:".
function keys<T>() {
  return <K extends readonly (keyof Required<T>)[]>(
    lijst: K & ([keyof Required<T>] extends [K[number]] ? unknown : ['mist:', Exclude<keyof Required<T>, K[number]>]),
  ): readonly (keyof Required<T>)[] => lijst;
}

const EXT_PROJECT_KEYS = keys<ExtProject>()([
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt',
  'author', 'company', 'wbsAutoNumber', 'statusDate', 'progressMode', 'schedulingOptions',
] as const);

const EXT_CALENDAR_KEYS = keys<ExtCalendar>()([
  'id', 'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'holidays', 'workTime', 'shift', 'workingExceptions',
] as const);

const EXT_TASK_TIME_KEYS = keys<ExtTaskTime>()([
  'durationType', 'scheduleDuration', 'durationMinutes', 'scheduleStart', 'scheduleFinish',
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'isCritical',
  'interferingFloat', 'isNearCritical', 'floatPath', 'actualStart', 'actualFinish',
  'actualDuration', 'remainingTime', 'remainingMinutes', 'completion', 'resume', 'stop',
] as const);

const EXT_TASK_KEYS = keys<ExtTask>()([
  'id', 'name', 'description', 'wbsCode', 'taskType', 'status', 'isMilestone', 'milestoneKind',
  'mandatory', 'priority', 'levelingDelay', 'parentId', 'childIds', 'isSummary', 'time', 'resourceIds', 'color',
  'activityCodes', 'customFields', 'constraint', 'constraint2', 'isHammock', 'externalLinks',
  'deadline', 'calendarId', 'notes',
  // fase 3.8 (.mpp-datumgetrouwheid): leeskant-velden uit de import, zie extTypes.ts
  'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'manuallyScheduled',
  'mspTaskType', 'effortDriven', 'timephasedContours',
  'timephasedFinishFloor', 'timephasedStartAnchor', 'timephasedDurationWalks',
  // X0 (XER-etappeplan, 2026-08-20): drie nieuwe .xer-importvelden, zelfde behandeling als de
  // .mpp-velden hierboven.
  'p6DurationType', 'p6ActivityType', 'p6SuspendResume',
] as const);

const EXT_SEQUENCE_KEYS = keys<ExtSequence>()([
  'id', 'predecessorId', 'successorId', 'type', 'lagDays', 'lagMinutes', 'lagUnit', 'lagPercent',
] as const);

const EXT_RESOURCE_KEYS = keys<ExtResource>()([
  'id', 'name', 'type', 'description', 'costPerHour', 'maxUnits', 'calendarId',
  'availabilitySteps', 'unitOfMeasure', 'parentId',
] as const);

const EXT_ASSIGNMENT_KEYS = keys<ExtAssignment>()([
  'id', 'taskId', 'resourceId', 'unitsPerDay', 'curve', 'workWindowStart', 'workWindowFinish',
] as const);

// ── (c) Interne velden die BEWUST niet oversteken ────────────────────────────
//
// Elke entry is een BESLISSING, geen omissie. Staat een intern veld hier niet én niet in het
// ext-contract, dan valt het onder deel 2 hieronder rood.
const NIET_PUBLIEK = {
  // Bibliotheekbinding (spec B1): de bibliotheek is app-globaal en wordt buiten het document
  // beheerd. Een extensie die deze stempels kon zetten zou een projectkopie kunnen laten dóén
  // alsof hij uit een bibliotheek komt.
  project: ['companyId', 'companyName'] as readonly string[],
  calendar: ['generation', 'libraryOrigin'] as readonly string[],
  resource: ['availability', 'libraryOrigin'] as readonly string[],
  task: [] as readonly string[],
  taskTime: [] as readonly string[],
  sequence: [] as readonly string[],
  assignment: [] as readonly string[],
};

// ── (b) Maximale fixtures — élk optioneel veld gevuld ────────────────────────

const VOL_TIME = {
  durationType: 'WORKTIME',
  scheduleDuration: 5,
  durationMinutes: 2400,
  scheduleStart: '2026-06-01',
  scheduleFinish: '2026-06-05',
  earlyStart: '2026-06-01',
  earlyFinish: '2026-06-05',
  lateStart: '2026-06-02',
  lateFinish: '2026-06-08',
  freeFloat: 1,
  totalFloat: 2,
  isCritical: false,
  interferingFloat: 1,
  isNearCritical: true,
  floatPath: 3,
  actualStart: '2026-06-01',
  actualFinish: '2026-06-04',
  actualDuration: 3,
  remainingTime: 2,
  remainingMinutes: 960,
  completion: 0.6,
  resume: '2026-06-05T10:00',
  stop: '2026-06-04T14:00',
} satisfies Required<TaskTime>;

const VOL_TASK = {
  id: 't1',
  name: 'Fundering',
  description: 'beschrijving',
  wbsCode: '1.2',
  taskType: 'CONSTRUCTION',
  status: 'STARTED',
  isMilestone: false,
  milestoneKind: 'FINISH',
  mandatory: true,
  priority: 400,
  levelingDelay: 2,
  // fase 3.8 (.mpp-datumgetrouwheid): de import-tijd-velden, allemaal gevuld — in de VOLGORDE van
  // `fromExtTask` (de round-trip-check vergelijkt via JSON.stringify en is dus volgorde-gevoelig).
  levelingDelayMinutes: 90,
  levelingDelayElapsed: true,
  splitGaps: [{ afterMinutes: 480, gapMinutes: 960 }],
  manuallyScheduled: true,
  mspTaskType: 'FIXED_WORK',
  effortDriven: true,
  // X0 (XER-etappeplan): drie nieuwe .xer-importvelden, allemaal gevuld — zelfde volgorde-eis als
  // de .mpp-velden hierboven (de round-trip-check vergelijkt via JSON.stringify).
  p6DurationType: 'DT_FixedDUR2',
  p6ActivityType: 'TT_Rsrc',
  p6SuspendResume: true,
  timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 240, kind: 'remaining' }] }],
  timephasedFinishFloor: '2026-06-10T17:00',
  timephasedStartAnchor: '2026-06-01T08:00',
  timephasedDurationWalks: [{ anchor: '2026-06-01T08:00', resourceCalendarId: 'cal2', workMinutes: 480 }],
  parentId: 'p1',
  childIds: ['c1', 'c2'],
  isSummary: true,
  time: VOL_TIME,
  resourceIds: ['r1'],
  color: '#abcdef',
  activityCodes: { ct1: 'cv1' },
  customFields: { f1: 'waarde' },
  constraint: { type: 'SNET', date: '2026-06-01', hard: true },
  constraint2: { type: 'FNLT', date: '2026-06-30', hard: false },
  isHammock: true,
  externalLinks: [{
    id: 'x1', direction: 'predecessor', relType: 'FS', lagDays: 1, lagMinutes: 480,
    anchorDate: '2026-05-30',
    sourceRef: { projectId: 'p9', projectName: 'Ander', taskId: 't9', taskName: 'Taak 9', filePath: '/a.ifc' },
    sourceMissing: false,
  }],
  deadline: '2026-07-01',
  calendarId: 'cal2',
  notes: [{ id: 'n1', text: 'let op', done: false }],
} satisfies Required<Task>;

const VOL_PROJECT = {
  id: 'proj', name: 'Project', description: 'omschrijving',
  startDate: '2026-01-05', endDate: '2026-12-31', calendarId: 'cal1',
  createdAt: '2026-01-01T00:00:00', modifiedAt: '2026-01-02T00:00:00',
  author: 'Auteur', company: 'Bedrijf',
  wbsAutoNumber: true, statusDate: '2026-06-01', progressMode: 'PROGRESS_OVERRIDE',
  schedulingOptions: {
    lagCalendar: 'successor',
    criticalDefinition: { mode: 'longestPath', threshold: -1 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: true,
    nearCriticalThreshold: 3,
    floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
  },
  companyId: 'bedrijf-1', companyName: 'Bibliotheek BV',
} satisfies Required<Project>;

const VOL_CALENDAR = {
  id: 'cal1', name: 'Kalender', description: 'omschrijving',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  holidays: [{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }],
  generation: { ruleSetId: 'NL', generatedFromYear: 2026, generatedToYear: 2028, region: 'noord', breakChoice: 'noord' },
  workTime: { byWeekday: { 1: [{ start: 420, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
  shift: 'SECOND',
  workingExceptions: [{ name: 'Inhaaldag', startDate: '2026-06-06', endDate: '2026-06-06' }],
  libraryOrigin: { companyId: 'b1', libraryItemId: 'i1', poolVersion: 2, syncedHash: 'h1' },
} satisfies Required<WorkCalendar>;

const VOL_SEQUENCE = {
  id: 's1', predecessorId: 'a', successorId: 'b', type: 'START_START',
  lagDays: 2, lagMinutes: 960, lagUnit: 'ELAPSEDTIME', lagPercent: 50,
} satisfies Required<Sequence>;

const VOL_RESOURCE = {
  id: 'r1', name: 'Kraan', type: 'EQUIPMENT', description: 'omschrijving',
  costPerHour: 120, availability: 1, maxUnits: 2, calendarId: 'cal2',
  availabilitySteps: [{ from: '2026-03-01', maxUnits: 3 }],
  unitOfMeasure: 'stuks', parentId: 'crew1',
  libraryOrigin: { companyId: 'b1', libraryItemId: 'i2', poolVersion: 1, syncedHash: 'h2' },
} satisfies Required<Resource>;

const VOL_ASSIGNMENT = {
  id: 'a1', taskId: 't1', resourceId: 'r1', unitsPerDay: 0.5, curve: 'BELL',
  workWindowStart: '2026-06-01T08:00', workWindowFinish: '2026-06-10T17:00',
} satisfies Required<ResourceAssignment>;

// ── 1. `toExt*` laat geen contractveld vallen ────────────────────────────────
const aanwezig = (o: object, k: readonly (string | number | symbol)[]) => k.filter(x => !(x in o));

eq('1 toExtProject vult elk ExtProject-veld', aanwezig(toExtProject(VOL_PROJECT), EXT_PROJECT_KEYS), []);
eq('2 toExtCalendar vult elk ExtCalendar-veld', aanwezig(toExtCalendar(VOL_CALENDAR), EXT_CALENDAR_KEYS), []);
eq('3 toExtTaskTime vult elk ExtTaskTime-veld', aanwezig(toExtTaskTime(VOL_TIME), EXT_TASK_TIME_KEYS), []);
eq('4 toExtTask vult elk ExtTask-veld', aanwezig(toExtTask(VOL_TASK), EXT_TASK_KEYS), []);
eq('5 toExtSequence vult elk ExtSequence-veld', aanwezig(toExtSequence(VOL_SEQUENCE), EXT_SEQUENCE_KEYS), []);
eq('6 toExtResource vult elk ExtResource-veld', aanwezig(toExtResource(VOL_RESOURCE), EXT_RESOURCE_KEYS), []);
eq('7 toExtAssignment vult elk ExtAssignment-veld', aanwezig(toExtAssignment(VOL_ASSIGNMENT), EXT_ASSIGNMENT_KEYS), []);

// De waarden moeten óók echt overkomen, niet alleen de sleutels — een mapper die overal
// `undefined` neerzet zou de check hierboven passeren.
for (const k of EXT_TASK_KEYS) {
  if (k === 'time') continue; // apart, hieronder
  eq(`8 toExtTask draagt "${String(k)}" over`,
    (toExtTask(VOL_TASK) as unknown as Record<string, unknown>)[k as string],
    (VOL_TASK as unknown as Record<string, unknown>)[k as string]);
}
for (const k of EXT_TASK_TIME_KEYS) {
  eq(`9 toExtTaskTime draagt "${String(k)}" over`,
    (toExtTaskTime(VOL_TIME) as unknown as Record<string, unknown>)[k as string],
    (VOL_TIME as unknown as Record<string, unknown>)[k as string]);
}
for (const [naam, ext, bron, sleutels] of [
  ['project', toExtProject(VOL_PROJECT), VOL_PROJECT, EXT_PROJECT_KEYS],
  ['calendar', toExtCalendar(VOL_CALENDAR), VOL_CALENDAR, EXT_CALENDAR_KEYS],
  ['sequence', toExtSequence(VOL_SEQUENCE), VOL_SEQUENCE, EXT_SEQUENCE_KEYS],
  ['resource', toExtResource(VOL_RESOURCE), VOL_RESOURCE, EXT_RESOURCE_KEYS],
  ['assignment', toExtAssignment(VOL_ASSIGNMENT), VOL_ASSIGNMENT, EXT_ASSIGNMENT_KEYS],
] as [string, object, object, readonly (string | number | symbol)[]][]) {
  for (const k of sleutels) {
    eq(`10 ${naam}: "${String(k)}" komt over`,
      (ext as Record<string, unknown>)[k as string],
      (bron as Record<string, unknown>)[k as string]);
  }
}

// ── 2. `fromExt*` laat geen intern veld vallen (op de bewuste uitzonderingen na) ──
{
  const controle = (
    label: string,
    intern: object,
    bron: object,
    nietPubliek: readonly string[],
  ) => {
    const verwacht = Object.keys(bron).filter(k => !nietPubliek.includes(k));
    eq(label, verwacht.filter(k => !(k in intern)), []);
  };
  controle('11 fromExtProject vult elk intern Project-veld',
    fromExtProject(toExtProject(VOL_PROJECT)), VOL_PROJECT, NIET_PUBLIEK.project);
  controle('12 fromExtCalendar vult elk intern WorkCalendar-veld',
    fromExtCalendar(toExtCalendar(VOL_CALENDAR)), VOL_CALENDAR, NIET_PUBLIEK.calendar);
  controle('13 fromExtTask vult elk intern Task-veld',
    fromExtTask(toExtTask(VOL_TASK)), VOL_TASK, NIET_PUBLIEK.task);
  controle('14 fromExtTaskTime vult elk intern TaskTime-veld',
    fromExtTaskTime(toExtTaskTime(VOL_TIME)), VOL_TIME, NIET_PUBLIEK.taskTime);
  controle('15 fromExtSequence vult elk intern Sequence-veld',
    fromExtSequence(toExtSequence(VOL_SEQUENCE)), VOL_SEQUENCE, NIET_PUBLIEK.sequence);
  controle('16 fromExtResource vult elk intern Resource-veld',
    fromExtResource(toExtResource(VOL_RESOURCE)), VOL_RESOURCE, NIET_PUBLIEK.resource);
  controle('17 fromExtAssignment vult elk intern ResourceAssignment-veld',
    fromExtAssignment(toExtAssignment(VOL_ASSIGNMENT)), VOL_ASSIGNMENT, NIET_PUBLIEK.assignment);

  // En de keerzijde: de niet-publieke velden moeten óók echt WEG zijn aan de ext-kant. Zonder deze
  // check zou "niet publiek" een lijst worden die je vult zodra iets rood wordt.
  for (const k of NIET_PUBLIEK.project) {
    eq(`18 project-veld "${k}" lekt niet naar het contract`, k in toExtProject(VOL_PROJECT), false);
  }
  for (const k of NIET_PUBLIEK.calendar) {
    eq(`18a kalenderveld "${k}" lekt niet naar het contract`, k in toExtCalendar(VOL_CALENDAR), false);
  }
  for (const k of NIET_PUBLIEK.resource) {
    eq(`18b resourceveld "${k}" lekt niet naar het contract`, k in toExtResource(VOL_RESOURCE), false);
  }
}

// ── 3. Round-trip behoudt de waarden ─────────────────────────────────────────
{
  const stripNietPubliek = (o: object, weg: readonly string[]) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !weg.includes(k)));
  eq('19 project round-trip',
    fromExtProject(toExtProject(VOL_PROJECT)), stripNietPubliek(VOL_PROJECT, NIET_PUBLIEK.project));
  eq('20 kalender round-trip',
    fromExtCalendar(toExtCalendar(VOL_CALENDAR)), stripNietPubliek(VOL_CALENDAR, NIET_PUBLIEK.calendar));
  eq('21 taak round-trip', fromExtTask(toExtTask(VOL_TASK)), VOL_TASK);
  eq('22 relatie round-trip', fromExtSequence(toExtSequence(VOL_SEQUENCE)), VOL_SEQUENCE);
  eq('23 resource round-trip',
    fromExtResource(toExtResource(VOL_RESOURCE)), stripNietPubliek(VOL_RESOURCE, NIET_PUBLIEK.resource));
  eq('24 toewijzing round-trip', fromExtAssignment(toExtAssignment(VOL_ASSIGNMENT)), VOL_ASSIGNMENT);
}

// ── 4. Isolatie: de extensie krijgt een verse, DIEPE kopie ───────────────────
// Dit is de belofte in de kop van extMappers: een extensie mag zijn kopie muteren zonder de store
// te raken. De store is Immer-bevroren, dus een gedeelde geneste referentie zou hier gooien in
// plaats van stil te corrumperen — maar een test die pas in productie afgaat is geen test.
{
  const bevroren = JSON.parse(JSON.stringify(VOL_TASK)) as Task;
  Object.freeze(bevroren);
  Object.freeze(bevroren.time);
  Object.freeze(bevroren.childIds);
  Object.freeze(bevroren.resourceIds);
  if (bevroren.constraint) Object.freeze(bevroren.constraint);
  if (bevroren.externalLinks) { Object.freeze(bevroren.externalLinks); bevroren.externalLinks.forEach(l => { Object.freeze(l); Object.freeze(l.sourceRef); }); }
  if (bevroren.notes) { Object.freeze(bevroren.notes); bevroren.notes.forEach(n => Object.freeze(n)); }

  const kopie = toExtTask(bevroren);
  let gooide = false;
  try {
    kopie.childIds.push('nieuw');
    kopie.time.totalFloat = 99;
    kopie.resourceIds.push('r9');
    if (kopie.constraint) kopie.constraint.date = '2099-01-01';
    if (kopie.externalLinks?.[0]) kopie.externalLinks[0].sourceRef.taskName = 'gewijzigd';
    if (kopie.notes?.[0]) kopie.notes[0].done = true;
  } catch { gooide = true; }
  eq('25 de ext-kopie is muteerbaar (geen gedeelde bevroren referentie)', gooide, false);
  eq('25a en de bron is onaangeroerd', bevroren.childIds.length, 2);
  eq('25b idem de geneste tijd', bevroren.time.totalFloat, 2);
  eq('25c idem de geneste sourceRef', bevroren.externalLinks?.[0]?.sourceRef.taskName, 'Taak 9');
  eq('25d idem de notities', bevroren.notes?.[0]?.done, false);

  // Kalender: holidays en de weekdag-banden zijn de geneste gevallen daar.
  const bevrorenCal = JSON.parse(JSON.stringify(VOL_CALENDAR)) as WorkCalendar;
  Object.freeze(bevrorenCal); Object.freeze(bevrorenCal.holidays);
  bevrorenCal.holidays.forEach(h => Object.freeze(h));
  Object.freeze(bevrorenCal.workTime);
  const calKopie = toExtCalendar(bevrorenCal);
  let calGooide = false;
  try {
    calKopie.holidays[0].name = 'Anders';
    calKopie.workDays.push(6);
  } catch { calGooide = true; }
  eq('26 de kalender-kopie is muteerbaar', calGooide, false);
  eq('26a en de bron-feestdag is onaangeroerd', bevrorenCal.holidays[0].name, 'Kerst');
  eq('26b en de bron-werkdagen ook', bevrorenCal.workDays.length, 5);
}

// ── 5. De twee nieuwe UI-grenzen ─────────────────────────────────────────────
{
  const TABS: readonly ExtRibbonTab[] = [
    'file', 'start', 'planning', 'resources', 'relations',
    'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai',
  ];
  for (const t of TABS) {
    eq(`27 ribbontabblad "${t}" mapt naar iets`, typeof fromExtRibbonTab(t), 'string');
  }
  eq('27a en vandaag is dat één-op-één', TABS.map(fromExtRibbonTab), TABS.slice());

  // Font-provider: de host mag NIET het object van de extensie bewaren, en `getBoldBytes` mag niet
  // als `undefined`-sleutel doorlekken (de pagineerder test op aanwezigheid).
  const bytes = new Uint8Array([1, 2, 3]);
  const zonderBold: ExtFontProvider = {
    id: 'p1',
    covers: (cp) => cp === 65,
    getRegularBytes: () => Promise.resolve(bytes),
  };
  const gemapt = fromExtFontProvider(zonderBold);
  eq('28 de provider is een NIEUW object', gemapt === (zonderBold as unknown), false);
  eq('28a id komt over', gemapt.id, 'p1');
  eq('28b covers werkt', gemapt.covers(65), true);
  eq('28c en zegt nee waar het hoort', gemapt.covers(66), false);
  eq('28d geen getBoldBytes-sleutel als de bron hem niet heeft', 'getBoldBytes' in gemapt, false);

  const metBold: ExtFontProvider = {
    id: 'p2',
    covers: () => true,
    getRegularBytes: () => Promise.resolve(bytes),
    getBoldBytes: () => Promise.resolve(new Uint8Array([9])),
  };
  const gemapt2 = fromExtFontProvider(metBold);
  eq('28e getBoldBytes komt wél mee als hij bestaat', typeof gemapt2.getBoldBytes, 'function');

  // `this`-binding: een provider met interne state moet blijven werken door de mapper heen.
  class Provider implements ExtFontProvider {
    id = 'p3';
    private hits = 0;
    covers() { this.hits++; return true; }
    getRegularBytes() { return Promise.resolve(new Uint8Array([this.hits])); }
    getBoldBytes() { return Promise.resolve(new Uint8Array([this.hits + 100])); }
  }
  const inst = new Provider();
  const gemapt3 = fromExtFontProvider(inst);
  let bindGooide = false;
  try { gemapt3.covers(65); void gemapt3.getBoldBytes?.(); } catch { bindGooide = true; }
  eq('29 een class-provider overleeft de mapping (this blijft gebonden)', bindGooide, false);
}

// ── 6. Publieke create-/updatepaden bewaren expliciete samenvattingsidentiteit ────────────────
// Breuk die dit vangt: `ExtTask.isSummary` staat in het publieke type, maar één van de input- of
// updatemappers, de SDK-factory of `api.data.addTask/updateTask` laat true/false stil vallen. Een
// lege summary zou dan als gewone CPM-knoop terugkomen.
{
  const mappedInput = fromExtTaskInput({ name: 'Mapper-summary', isSummary: true });
  const mappedRegular = fromExtTaskInput({ name: 'Mapper-gewoon' });
  eq('30 fromExtTaskInput draagt expliciet true', mappedInput.isSummary, true);
  eq('30a fromExtTaskInput maakt invoer zonder marker niet per ongeluk summary',
    'isSummary' in mappedRegular, false);
  eq('30b fromExtTaskUpdates draagt expliciet true', fromExtTaskUpdates({ isSummary: true }).isSummary, true);
  eq('30c fromExtTaskUpdates draagt expliciet false als bewuste reset',
    fromExtTaskUpdates({ isSummary: false }).isSummary, false);
  eq('30d fromExtTaskUpdates voegt bij een ongenoemde marker geen update toe',
    'isSummary' in fromExtTaskUpdates({ name: 'Alleen naam' }), false);

  useAppStore.getState().newProject();
  const sdkSummary = getExtensionSdk().factory.createTask({ name: 'SDK lege summary', isSummary: true });
  eq('31 SDK-factory bewaart de expliciete lege summary', sdkSummary.isSummary, true);

  const api = createExtensionApi('x4a-summary-contract', []);
  const id = api.data.addTask(sdkSummary);
  api.data.recalculate();
  eq('31a extension addTask bewaart de marker in de store',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, true);
  eq('31b extension addTask houdt de lege summary buiten CPMResult.tasks',
    useAppStore.getState().cpmResult?.tasks.has(id), false);

  api.data.updateTask(id, { isSummary: false });
  api.data.recalculate();
  eq('31c extension updateTask kan de marker bewust naar false terugzetten',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, false);
  eq('31d een bewust teruggezette lege summary wordt weer een solvertaak',
    useAppStore.getState().cpmResult?.tasks.has(id), true);

  api.data.updateTask(id, { isSummary: true });
  api.data.recalculate();
  eq('31e extension updateTask kan de samenvattingsidentiteit opnieuw aanzetten',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, true);
  eq('31f opnieuw aangezette summary blijft buiten CPMResult.tasks',
    useAppStore.getState().cpmResult?.tasks.has(id), false);
  api._cleanup();
}

// ── 7. De contract-versiepoort (los van minAppVersion) ───────────────────────
// CalVer draagt geen breaking-change-signaal; `apiVersion` doet dat wel. De poort moet in BEIDE
// richtingen dicht: een extensie voor een oudere major mist de brekende wijziging, een voor een
// nieuwere rekent op iets dat er niet is.
{
  eq('32 de host-API-versie is een geldige semver', /^\d+\.\d+\.\d+$/.test(EXTENSION_API_VERSION), true);

  // Legacy: geen apiVersion ⇒ toegestaan, maar herkenbaar als legacy.
  eq('31 geen apiVersion ⇒ toegestaan', checkApiCompatibility(undefined, '1.2.0').ok, true);
  eq('31a en gemarkeerd als legacy', checkApiCompatibility(undefined, '1.2.0').legacy, true);
  eq('31b lege string telt als geen', checkApiCompatibility('', '1.2.0').legacy, true);
  eq('31c spaties ook', checkApiCompatibility('   ', '1.2.0').legacy, true);

  // Zelfde major.
  eq('32 gelijke versie mag', checkApiCompatibility('1.2.0', '1.2.0').ok, true);
  eq('32a oudere minor mag (toevoegingen zijn achterwaarts compatibel)', checkApiCompatibility('1.0.0', '1.2.0').ok, true);
  eq('32b nieuwere minor mag NIET', checkApiCompatibility('1.3.0', '1.2.0').ok, false);
  eq('32c patch doet niet mee — hoger', checkApiCompatibility('1.2.9', '1.2.0').ok, true);
  eq('32d patch doet niet mee — lager', checkApiCompatibility('1.2.0', '1.2.9').ok, true);
  eq('32e major.minor zonder patch mag', checkApiCompatibility('1.2', '1.2.0').ok, true);

  // Andere major — beide richtingen dicht.
  eq('33 oudere major mag niet', checkApiCompatibility('0.9.0', '1.2.0').ok, false);
  eq('33a nieuwere major mag niet', checkApiCompatibility('2.0.0', '1.2.0').ok, false);

  // Onzin is geen "0.0.0". Stil naar nul afronden zou een typefout laten passeren als
  // "compatibel met alles" — precies de stille modus die dit item wil wegnemen.
  for (const onzin of ['abc', '1.x', 'v1.0.0', '1', '1..0', '-1.0.0']) {
    eq(`34 onzin-apiVersion "${onzin}" wordt geweigerd`, checkApiCompatibility(onzin, '1.2.0').ok, false);
  }

  // Elke weigering moet een reden meegeven — een lege foutmelding in de extensielijst helpt niemand.
  for (const slecht of ['0.9.0', '2.0.0', '1.3.0', 'abc']) {
    const r = checkApiCompatibility(slecht, '1.2.0');
    eq(`35 weigering van "${slecht}" draagt een reden`, typeof r.reason === 'string' && r.reason.length > 10, true);
  }
  eq('35a een toestemming draagt géén reden', checkApiCompatibility('1.0.0', '1.2.0').reason, undefined);

  // En tegen de ECHTE hostversie: de huidige waarde moet zichzelf accepteren.
  eq('36 de host accepteert zijn eigen versie', checkApiCompatibility(EXTENSION_API_VERSION).ok, true);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-contract — ${checks} checks groen`);
} else {
  console.log(`XX extensie-contract — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
