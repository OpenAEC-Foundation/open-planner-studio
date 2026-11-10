// Gedeelde projecten voor de IFC-schemapoort (`check-ifc-schema.ts`), de ariteitscheck in de drie
// schema's (`check-ifc-arity.ts`) en de lezerscheck van de oude en de nieuwe indeling
// (`check-ifc-schema-reader.ts`). Geen check: dit bestand draait niets.
//
// RIJK project: de enige rijke fixture. Basis: de showcase met alle vijf resourcetypen, een ploeg, twee
// kalenders en twee baselines (examples/showcase-appartementencomplex.ifc). Daarop twee lagen:
//  1. Breedte van de writer (vroeger `fixtures/ifc-arity-rich.ts`): een werkende uitzondering met banden
//     op de projectkalender, bibliotheekkalenders met de ploegen SECOND/THIRD/USERDEFINED (een
//     tweeploegen-uurkalender), extra resources van alle zes soorten (ook kosten, #815) (een ploeg met leden,
//     capaciteitsstap, bibliotheekstempel), toewijzingen met curves, werkvelden en een timephased-
//     venster, een eigen taaktype, activity codes met kleur, een constraint, deadline en notitie, een
//     kalenderwandeling, voortgang, alle vier relatiesoorten met elke lag-vorm, een extra baseline, een
//     eigen rekenprofiel, en een NEGATIEVE speling (`-P0Y0M2D`: het minteken vóór de P).
//  2. Randgevallen van het schema: bibliotheekkalenders (dag met werkende uitzonderingen en een
//     HoursPerDay-afwijking, uur met blokken), alle eigen-veldtypen met hele en gebroken getallen en een
//     lege tekst, procent-lag van 0/37,5/100 %, minuten- en negatieve lag, voortgang (0,38 en 1), een
//     statusdatum met tijd, een USERDEFINED-taak zonder eigen taaktype, een naamloze taak, dezelfde
//     resource twee keer op één taak, heropen-herkomst, een codetype zonder waarden en een baseline
//     zonder taken (aanmaakmoment zonder seconden: IfcDateTime moet ze toch krijgen).
// Laag 1 raakt andere taken dan laag 2 (de eerste vier bladtaken zijn van laag 2).
//
// XER-IMPORT met bronarchief: een kleine echte XER (twee taken, een relatie, een resource met
// toewijzing, codes, een UDF, een onbekende tabel van ruim 500 kB), zodat `OPS_XerSourceArchive` met
// meer brokken in de poort meedoet.
//
// LEEG project: geen naam, auteur, bedrijf, omschrijving of datums, en geen taken.
//
// RANDGEVALLEN van de kalender: geen werkdagen, en een uurkalender zonder blokken.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readIFC } from '@/services/ifc/ifcReader';
import { activeImportResult, type ImportResult } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type { CustomFieldDef } from '@/types/structure';

/** De negatieve speling die laag 1 zet (dagen), voor de vormtoets in de poort (`-P0Y0M2D`). */
export const RICH_NEGATIVE_TOTAL_FLOAT = -2;

const WEEK_6_TO_22 = { start: 360, end: 840 };
const WEEK_14_TO_22 = { start: 840, end: 1320 };

/**
 * Laag 1 (zie de kop): de breedte van de writer, op een kopie van `base`. Raakt alleen bladtaken die
 * geen mijlpaal zijn en niet bij de eerste vier bladtaken horen (die zijn van laag 2).
 */
function addWriterBreadth(base: ImportResult): ImportResult {
  const r = structuredClone(base);
  const reserved = new Set(r.tasks.filter(t => t.childIds.length === 0).slice(0, 4).map(t => t.id));
  const leaves = r.tasks.filter(t => t.childIds.length === 0 && !t.isMilestone && !reserved.has(t.id));
  if (leaves.length < 8) throw new Error(`ifcSchemaFixture: te weinig bladtaken voor laag 1 (${leaves.length})`);
  const leaf = (i: number): Task => leaves[i];

  // ── Kalenders ────────────────────────────────────────────────────────────────────────────────
  // Projectkalender: een werkende uitzondering mét banden (DAILY-recurrence in ExceptionTimes).
  r.calendar.workingExceptions = [
    ...(r.calendar.workingExceptions ?? []),
    { name: 'Inhaalzaterdag', startDate: '2027-06-12', endDate: '2027-06-12', bands: [{ start: 420, end: 720 }] },
  ];
  const day = (id: string, name: string, shift: WorkCalendar['shift']): WorkCalendar => ({
    id, name, description: `${name} (rijk testproject)`,
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'Kerst', startDate: '2027-12-25', endDate: '2027-12-26' }],
    ...(shift ? { shift } : {}),
  });
  const twoShift: WorkCalendar = {
    ...day('cal-rich-tweeploegen', 'Tweeploegen', 'SECOND'),
    workStartHour: 6, workEndHour: 22, hoursPerDay: 16,
    workTime: {
      byWeekday: {
        1: [WEEK_6_TO_22, WEEK_14_TO_22], 2: [WEEK_6_TO_22, WEEK_14_TO_22], 3: [WEEK_6_TO_22, WEEK_14_TO_22],
        4: [WEEK_6_TO_22, WEEK_14_TO_22], 5: [WEEK_6_TO_22, WEEK_14_TO_22], 6: [], 7: [],
      },
    },
    workingExceptions: [
      { name: 'Zaterdagdienst', startDate: '2027-06-19', endDate: '2027-06-19', bands: [{ start: 420, end: 900 }] },
    ],
  };
  const night = day('cal-rich-nacht', 'Nachtploeg', 'THIRD');
  const unused = day('cal-rich-eigen', 'Eigen rooster', 'USERDEFINED');
  r.resourceCalendars = [...(r.resourceCalendars ?? []), twoShift, night, unused];

  // ── Resources: alle zes soorten (ook kosten), ploeg met leden, kalender, capaciteitsstap, bibliotheekstempel ──
  const extra: Resource[] = [
    {
      id: 'res-rich-kraan', name: 'Torenkraan', type: 'EQUIPMENT', description: 'Kraan met capaciteitsstap',
      maxUnits: 1, costPerHour: 85.5, unitOfMeasure: 'h', color: '#aa5500', calendarId: twoShift.id,
      availabilitySteps: [{ from: '2027-06-01', maxUnits: 2 }],
    },
    {
      id: 'res-rich-beton', name: 'Beton C30/37', type: 'MATERIAL', description: 'Betonlevering',
      maxUnits: 40, costPerHour: 120, unitOfMeasure: 'm3',
    },
    {
      id: 'res-rich-installateur', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: '',
      maxUnits: 1, costPerHour: 72.25,
      libraryOrigin: { companyId: 'bib-rich', libraryItemId: 'item-installateur', poolVersion: 3, syncedHash: 'h-rich' },
    },
    { id: 'res-rich-ploeg', name: 'Afbouwploeg', type: 'CREW', description: 'Ploeg met twee leden', maxUnits: 1 },
    {
      id: 'res-rich-stukadoor', name: 'Stukadoor (ploeg)', type: 'LABOR', description: '', maxUnits: 1,
      parentId: 'res-rich-ploeg', calendarId: twoShift.id,
    },
    { id: 'res-rich-schilder', name: 'Schilder (ploeg)', type: 'LABOR', description: '', maxUnits: 2, parentId: 'res-rich-ploeg' },
    // Kostenresource (#815): IFCCONSTRUCTIONMATERIALRESOURCE met ObjectType 'COST' en .USERDEFINED.
    { id: 'res-rich-leges', name: 'Leges', type: 'COST', description: 'Vast bedrag', maxUnits: 1 },
  ];
  r.resources = [...r.resources, ...extra];

  // Toewijzingen met curves, timephased-venster en werkvelden.
  const assign = (id: string, task: Task, resourceId: string, more: Partial<ResourceAssignment> = {}): ResourceAssignment => {
    task.resourceIds = [...new Set([...task.resourceIds, resourceId])];
    return { id, taskId: task.id, resourceId, unitsPerDay: 1, ...more };
  };
  r.assignments = [
    ...r.assignments,
    assign('asg-rich-1', leaf(0), 'res-rich-kraan', { unitsPerDay: 0.5, curve: 'BELL' }),
    assign('asg-rich-2', leaf(1), 'res-rich-beton', {
      unitsPerDay: 12, curve: 'FRONT_LOADED', plannedWorkMinutes: 960, actualWorkMinutes: 480, remainingWorkMinutes: 480,
    }),
    assign('asg-rich-3', leaf(2), 'res-rich-installateur', {
      workWindowStart: leaf(2).time.scheduleStart, workWindowFinish: leaf(2).time.scheduleFinish,
    }),
    assign('asg-rich-4', leaf(3), 'res-rich-stukadoor', { curve: 'BACK_LOADED' }),
    assign('asg-rich-5', leaf(3), 'res-rich-schilder', { unitsPerDay: 2 }),
    assign('asg-rich-6', leaf(3), 'res-rich-leges', { costAmount: 1250.5 }),
  ];

  // ── Structuur: eigen velden (alle zes soorten), activity codes, eigen taaktype ────────────────────
  r.customFieldDefs = [
    ...(r.customFieldDefs ?? []),
    { id: 'cf-rich-tekst', name: 'Opmerking', type: 'text' },
    { id: 'cf-rich-getal', name: 'Factor', type: 'number' },
    { id: 'cf-rich-geheel', name: 'Aantal', type: 'integer' },
    { id: 'cf-rich-kosten', name: 'Budget', type: 'cost' },
    { id: 'cf-rich-datum', name: 'Keuringsdatum', type: 'date' },
    { id: 'cf-rich-vlag', name: 'Vergunning nodig', type: 'boolean' },
  ];
  leaf(0).customFields = {
    'cf-rich-tekst': 'Let op: "aanvoer" via achterom', 'cf-rich-getal': 6.5, 'cf-rich-geheel': 4,
    'cf-rich-kosten': 1250.75, 'cf-rich-datum': '2027-06-15', 'cf-rich-vlag': true,
  };
  leaf(1).customFields = { 'cf-rich-geheel': 2, 'cf-rich-vlag': false };
  r.activityCodeTypes = [...(r.activityCodeTypes ?? []), {
    id: 'ac-rich-fase', name: 'Fase',
    values: [{ id: 'ac-rich-ruw', code: 'RUW', description: 'Ruwbouw', color: '#884400' }, { id: 'ac-rich-afb', code: 'AFB' }],
  }];
  leaf(0).activityCodes = { ...leaf(0).activityCodes, 'ac-rich-fase': 'ac-rich-ruw' };
  leaf(4).activityCodes = { ...leaf(4).activityCodes, 'ac-rich-fase': 'ac-rich-afb' };
  r.customTaskTypes = [...(r.customTaskTypes ?? []), { id: 'ctt-rich-keuring', name: 'Keuring' }];
  leaf(5).customTaskTypeId = 'ctt-rich-keuring';
  leaf(5).taskType = 'USERDEFINED';

  // ── Taakeigenschappen: kalender, constraint, deadline, notities, kalenderwandeling ──────────────
  leaf(6).calendarId = night.id;
  leaf(6).constraint = { type: 'SNET', date: leaf(6).time.scheduleStart };
  leaf(6).deadline = leaf(7).time.scheduleFinish;
  leaf(6).notes = [{ id: 'note-rich-1', text: 'Nachtwerk aanvragen', done: false }];
  leaf(0).timephasedDurationWalks = [
    { anchor: leaf(0).time.scheduleStart, resourceCalendarId: twoShift.id, workMinutes: 480 },
  ];
  // Negatieve speling (achter op schema): de writer zet het minteken vóór de P (`-P0Y0M2D`), niet bij
  // het getal (`P0Y0M-2D`, zoals v2026.9.0). Een gebroken waarde toetst ook het afronden.
  leaf(7).time.totalFloat = RICH_NEGATIVE_TOTAL_FLOAT;
  leaf(7).time.freeFloat = -0.25;

  // ── Voortgang: twee taken klaar, één bezig ──────────────────────────────────────────────────────
  for (const t of [leaf(0), leaf(1)]) {
    t.time.actualStart = t.time.scheduleStart;
    t.time.actualFinish = t.time.scheduleFinish;
    t.time.completion = 1;
    t.status = 'COMPLETED';
  }
  leaf(2).time.actualStart = leaf(2).time.scheduleStart;
  leaf(2).time.completion = 0.4;
  leaf(2).time.remainingTime = 2;
  leaf(2).status = 'STARTED';

  // ── Relaties: alle vier soorten en elke lag-vorm (dagen, lead, procent, minuten, verstreken tijd) ──
  const seq = (id: string, p: number, s: number, more: Partial<Sequence>): Sequence => ({
    id, predecessorId: leaf(p).id, successorId: leaf(s).id, type: 'FINISH_START', lagDays: 0, ...more,
  });
  r.sequences = [
    ...r.sequences,
    seq('seq-rich-sf', 2, 7, { type: 'START_FINISH' }),
    seq('seq-rich-procent', 3, 7, { lagPercent: 50 }),
    seq('seq-rich-minuten', 4, 7, { type: 'START_START', lagMinutes: 90 }),
    seq('seq-rich-verstreken', 5, 7, { type: 'FINISH_FINISH', lagDays: 2, lagUnit: 'ELAPSEDTIME' }),
    seq('seq-rich-lead', 6, 7, { lagDays: -1 }),
  ];

  // ── Baselines: een extra (elk een eigen .BASELINE.-werkschema), en die is actief ─────────────────
  const first = r.baselines?.[0];
  if (!first) throw new Error('ifcSchemaFixture: het basisproject heeft geen baseline');
  r.baselines = [...(r.baselines ?? []), {
    ...structuredClone(first), id: 'bl-rich-herplanning', name: 'Herplanning', createdAt: '2027-05-20T10:00:00.000Z',
  }];
  r.activeBaselineId = 'bl-rich-herplanning';

  // ── Project: eigen rekenprofiel en -opties ───────────────────────────────────────────────────────
  r.project.schedulingProfile = { baseId: 'msproject', id: 'msproject', name: '', overrides: {} };
  r.project.schedulingOptions = { ...(r.project.schedulingOptions ?? {}), nearCriticalThreshold: 2 };
  return r;
}

export function buildRichSchemaProject(root: string): ImportResult {
  const showcase = readIFC(readFileSync(join(root, 'examples', 'showcase-appartementencomplex.ifc'), 'utf8'));
  if (showcase.tasks.length < 10 || showcase.resources.length < 5 || showcase.assignments.length === 0 || (showcase.baselines ?? []).length < 2) {
    throw new Error('ifcSchemaFixture: de basis-showcase is verarmd (taken, resources, toewijzingen of baselines)');
  }
  // Laag 1, daarna laag 2 (de rest van deze functie) op de eerste vier bladtaken.
  const base = addWriterBreadth(showcase);

  const libCal: WorkCalendar = {
    id: 'schema-libcal', name: 'Bibliotheek dagkalender', description: 'Ma-za 07-15, 7,5 u netto',
    workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 15, hoursPerDay: 7.5,
    holidays: [{ name: 'Bouwvak', startDate: '2026-07-27', endDate: '2026-07-31' }],
    workingExceptions: [
      { name: 'Overwerkdag', startDate: '2026-08-08', endDate: '2026-08-08', bands: [{ start: 360, end: 720 }] },
      { name: 'Verschoven werkdag', startDate: '2026-08-15', endDate: '2026-08-15' },
    ],
    generation: { ruleSetId: 'NL', region: 'NB', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028 },
    shift: 'THIRD', p6Source: 'XER', p6NonWorkPenaltyDates: ['2026-12-27'], p6NonWorkPenaltyDatesState: 'VALID_VALUES',
    libraryOrigin: { companyId: 'c-schema', libraryItemId: 'lib-cal', poolVersion: 2 },
  };
  const blocks = [{ start: 420, end: 720 }, { start: 750, end: 930 }];
  const hourCal: WorkCalendar = {
    id: 'schema-hourcal', name: 'Bibliotheek uurkalender', description: 'Blokken met lunch',
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8,
    holidays: [], shift: 'USERDEFINED',
    workTime: { byWeekday: { 1: blocks, 2: blocks, 3: blocks, 4: blocks, 5: blocks, 6: [], 7: [] } },
  };
  const fieldDefs: CustomFieldDef[] = [
    { id: 'sf-text', name: 'Schema tekst', type: 'text' },
    { id: 'sf-num', name: 'Schema getal', type: 'number' },
    { id: 'sf-int', name: 'Schema geheel', type: 'integer' },
    { id: 'sf-cost', name: 'Schema kosten', type: 'cost' },
    { id: 'sf-date', name: 'Schema datum', type: 'date' },
    { id: 'sf-bool', name: 'Schema ja/nee', type: 'boolean' },
  ];
  const [t1, t2, t3, t4] = base.tasks.filter(t => t.childIds.length === 0);
  const tasks = base.tasks.map(t => {
    if (t.id === t1.id) {
      return {
        ...t, levelingDelay: 2, calendarId: libCal.id, taskType: 'USERDEFINED' as const, customTaskTypeId: undefined,
        customFields: { 'sf-text': 'tekst', 'sf-num': 3, 'sf-int': 7, 'sf-cost': 1250, 'sf-date': '2026-08-01', 'sf-bool': true },
        time: { ...t.time, completion: 0.38, actualStart: t.time.scheduleStart },
      };
    }
    if (t.id === t2.id) {
      return {
        ...t, name: '', calendarId: hourCal.id,
        customFields: { 'sf-text': '', 'sf-num': 2.5, 'sf-cost': 99.95, 'sf-bool': false },
        time: { ...t.time, completion: 1, actualStart: t.time.scheduleStart, actualFinish: t.time.scheduleFinish },
      };
    }
    return t;
  });
  const extraSeqs: Sequence[] = [
    { id: 'schema-s1', predecessorId: t1.id, successorId: t2.id, type: 'START_START', lagDays: 0, lagPercent: 0 },
    { id: 'schema-s2', predecessorId: t1.id, successorId: t3.id, type: 'START_START', lagDays: 0, lagPercent: 100 },
    { id: 'schema-s3', predecessorId: t2.id, successorId: t3.id, type: 'FINISH_FINISH', lagDays: 0, lagPercent: 37.5 },
    { id: 'schema-s4', predecessorId: t2.id, successorId: t4.id, type: 'FINISH_START', lagDays: 0, lagMinutes: 90 },
    { id: 'schema-s5', predecessorId: t3.id, successorId: t4.id, type: 'START_FINISH', lagDays: -2, lagUnit: 'ELAPSEDTIME' },
  ];
  const resources = base.resources.map((r, i) => (i === 0
    ? { ...r, maxUnits: 1.5, costPerHour: 45, calendarId: libCal.id, unitOfMeasure: 'uur', availabilitySteps: [{ from: '2026-07-06', maxUnits: 2 }] }
    : i === 1 ? { ...r, maxUnits: 2, costPerHour: 37.5, calendarId: hourCal.id } : r));
  const firstAssignment = base.assignments[0];
  return {
    ...base,
    project: { ...base.project, statusDate: '2026-07-25T13:30', progressMode: 'PROGRESS_OVERRIDE' },
    tasks,
    sequences: [...base.sequences, ...extraSeqs],
    resources,
    // Dezelfde resource twee keer op één taak (check-ifc-schema.ts, SET_DUPLICATES_ALLOWED).
    assignments: [...base.assignments, { ...firstAssignment, id: 'schema-a-dup', unitsPerDay: 0.5, curve: 'BELL' }],
    resourceCalendars: [...(base.resourceCalendars ?? []), libCal, hourCal],
    customFieldDefs: [...(base.customFieldDefs ?? []), ...fieldDefs],
    activityCodeTypes: [...(base.activityCodeTypes ?? []), { id: 'schema-act-empty', name: 'Codetype zonder waarden', values: [] }],
    baselines: [...(base.baselines ?? []), {
      id: 'schema-bl-leeg', name: 'Lege baseline', createdAt: '2026-07-01T09:15', tasks: [], projectEnd: '', projectDuration: 0,
    }],
    importPristine: true,
    recordedSourceFormat: 'mspdi',
  };
}

/**
 * RANDGEVALLEN van de kalender: een projectkalender zonder werkdagen en een uurkalender zonder blokken.
 * `WeekdayComponent` en `TimePeriods` van IfcRecurrencePattern zijn OPTIONAL SET/LIST [1:?]; leeg moet
 * dus `$` zijn, geen `()`. (Zo'n uurkalender las de lezer vóór de schemafix uit een IfcWorkCalendar
 * met 9 attributen, zoals in het bSI-voorbeeld `construction-scheduling-task`.)
 */
export function buildEdgeCalendarProject(rich: ImportResult): ImportResult {
  const noWorkDays: WorkCalendar = { ...rich.calendar, id: 'schema-geen-werkdagen', name: 'Geen werkdagen', workDays: [], workTime: undefined };
  const noBlocks: WorkCalendar = {
    id: 'schema-geen-blokken', name: 'Uurkalender zonder blokken', description: '',
    workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
  };
  return {
    project: { ...rich.project, calendarId: noWorkDays.id },
    calendar: noWorkDays, resourceCalendars: [noBlocks], tasks: [], sequences: [], resources: [], assignments: [],
  };
}

export function buildEmptySchemaProject(rich: ImportResult): ImportResult {
  return {
    project: { ...rich.project, name: '', description: '', author: '', company: '', startDate: '', endDate: '', statusDate: undefined },
    calendar: rich.calendar, tasks: [], sequences: [], resources: [], assignments: [],
  };
}

/** XER-import met bronarchief (zie de kop). Ontleend aan de bronretentiecheck
 *  `check-xer-source-retention.ts`, ingekort tot wat de writer nodig heeft. */
export function buildXerSchemaProject(): ImportResult {
  const unknownPayload = 'onbekende-bronwaarde-'.repeat(24_000);
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2025-12-31\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP-SCH\tSchemapoort\tC-SCH\t2025-12-31 08:00',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC-SCH\tBronkalender\tCA_Base\t\t40\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||3()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||4()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||5()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||6()((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))(0||7()())))(0||Exceptions()((0||0(d|46025)())(0||1(d|46027)())(0||2(d|46028)((0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())))))))',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT-A\tP-SCH\tC-SCH\tA\tVoorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t8\t8\t2025-12-31 08:00\t2025-12-31 17:00',
    '%R\tT-B\tP-SCH\tC-SCH\tB\tOpvolger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t8\t8\t2026-01-01 08:00\t2026-01-01 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tREL-SCH\tT-B\tT-A\tP-SCH\tP-SCH\tPR_FS\t0',
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
    '%R\tR-SCH\tVakman\tRT_Labor\tC-SCH\t1',
    '%T\tTASKRSRC',
    '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
    '%R\tAS-SCH\tP-SCH\tT-B\tR-SCH\t1\t8\t8',
    '%T\tACTVTYPE',
    '%F\tactv_code_type_id\tactv_code_type\tseq_num',
    '%R\tTYPE-SCH\tFase\t1',
    '%T\tACTVCODE',
    '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
    '%R\tVALUE-SCH\tTYPE-SCH\tBouw\t1',
    '%T\tTASKACTV',
    '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
    '%R\tP-SCH\tT-B\tTYPE-SCH\tVALUE-SCH',
    '%T\tUDFTYPE',
    '%F\tudf_type_id\ttable_name\tudf_type_label\tlogical_data_type',
    '%R\tUDF-SCH\tTASK\tBronlabel\tFT_STATICTYPE',
    '%T\tUDFVALUE',
    '%F\tudf_type_id\tproj_id\tfk_id\tudf_text',
    '%R\tUDF-SCH\tP-SCH\tT-B\tNiet verliezen',
    '%T\tVENDOR_UNKNOWN',
    '%F\tvendor_payload',
    '%R\t' + unknownPayload,
    '%E',
  ].join('\r\n'));
  const result = activeImportResult(readXER(bytes));
  if (!result.xerSourceArchive) throw new Error('ifcSchemaFixture: de XER-import draagt geen bronarchief');
  return result;
}
