/**
 * Motorrun van de dertien P6-23.12-geverifieerde casussen (review-bevinding 7).
 *
 * `check-p6-verified-cases.ts` pint `cases-p6-verified.json` uitsluitend als DATA: schema,
 * herkomst, digests en de losse cellen. Niets in de repo haalde die casussen ooit door
 * `solveProject`, waardoor een corpusloze X12-assertie stilzwijgend het tegenovergestelde kon
 * beweren van P6's eigen opname zonder dat één poort dat meldde. Deze check sluit dat gat: elke
 * casus wordt als XER-fixture opgebouwd uit de INVOERzijde van het publieke
 * `cpp-cpm-engine`-vergelijkingsraamwerk (activiteiten, relaties, kalenders, statusdatum), door de
 * echte lezer + solver gehaald, en per cel vergeleken met de gecommitte P6-uitvoer.
 *
 * Eerlijkheid boven groen: de uitkomst is NIET naar P6 toe geschreven. De check pint per casus en
 * per as of wij het eens zijn met P6 (`agreement`), zodat zowel een verbetering als een
 * verslechtering mechanisch opvalt. Gemeten stand (brongetrouwe transcriptie, 2026-09-07): elf van
 * de dertien casussen kloppen volledig, 156 van de 160 door P6 vastgelegde cellen; de vier
 * verschillen (casus 08 en 10, bezig zijnde taken rond de statusdatum) stonden cel voor cel gepind
 * onder punt 5. De ECHTE bytes (sectie 7) gaven 77/160 zoals gelezen door de projecteinde-fout;
 * sinds X12-brok 1 (2026-09-23) 156/160 zoals gelezen — exact deze transcriptie.
 *
 * Sinds 2026-10-27 (#690, fase 1 punt 2) staat het op 160/160: 152 rekencellen plus 8 cellen met
 * het achtervoegsel " A". Zo'n cel is een WERKELIJKE datum, geen rekendatum: het capturescript van de
 * bron zet bij een gestarte taak de werkelijke start in ES én LS, en bij een voltooide het werkelijke
 * einde in EF én LF (sectie 5). Zo'n cel gaat tegen de datum die de app toont
 * (`shownStart`/`shownFinish`, `utils/taskDates.ts`, eigenaarsbesluit 2026-10-12); elke andere cel
 * blijft tegen de rekendatum (`earlyStart` enz.). De vier vroegere verschillen vergeleken dus twee
 * verschillende velden, geen motorfout; de rekendatums zelf blijven gepind in 5b/5c.
 *
 * BRONGETROUWHEID (her-review 2026-09-07, bevinding 1). De transcriptie volgt de ÉCHTE P6-export
 * van precies deze dertien casussen — `cpp-cpm-engine/validation/p6-comparison/cases-import.xer`,
 * de invoer die het raamwerk aan P6 gaf en waar `cases-p6-verified.json` de uitvoer van is — op de
 * vier poortdiscriminatoren: `rem_target_link_flag = Y` op élk project, `duration_type =
 * DT_FixedDrtn` (niet `DT_FixedDUR2`), `target_start_date` = de projectstart en een LEEG
 * `target_end_date`. Een eerdere versie van dit bestand verzon `DT_FixedDUR2` en liet
 * `rem_target_link_flag` weg — twee elkaar opheffende afwijkingen die de poort op de verkeerde
 * reden dicht lieten staan. Wat hier bewust WEL wordt weggelaten is de SCHEDOPTIONS-tabel van de
 * bron: die zet `sched_use_project_end_date_for_float = Y` terwijl geen enkele taak een
 * `target_end_date` heeft. Dat raakte een productfout (het taak-afgeleide projecteinde viel terug op
 * de projectSTART, waarna de late zijde daarop verankerde); sinds X12-brok 1 zet de lezer de optie
 * dan gerapporteerd uit (`deriveXerScheduleOptions`, `hasUsableProjectEnd`). Sectie 7 draait de
 * ECHTE bytes, corpusgebonden, en pint dat zichtbaar.
 *
 * Gevolg voor casus 09: `explainP6CompletedDataDateWindow` blijft daar GESLOTEN — maar op
 * `wrongDurationType`/`missingExplicitTargetWindow`, een toevallige nauwte van de poort en géén
 * semantische verzoening. Sectie 3 laat zien wat er gebeurt zodra de poort op diezelfde topologie
 * opengaat: zeven van de twaalf P6-cellen gaan verloren en de open voorganger krijgt tf −5 waar P6 0
 * opnam. Dat is onverklaard tegenbewijs tegen de completed-late-regel en staat als zodanig in plan
 * §5 (X-O7 laag 1) en in het docblok van `p6CompletedLateFromRemainingWindow`.
 */
import { setConvention } from './p6SemanticsOff';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult, isMultiDocumentImport } from '@/services/importTypes';
import type { ProjectSchedulingOptions } from '@/types/project';
import { parseInstant } from '@/utils/dateUtils';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { Task } from '@/types/task';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import { explainP6CompletedLateRemainingWindowEligibilityResolved } from '@/engine/scheduler/p6CompletedRouteTrace';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// ── De invoerzijde, letterlijk overgenomen uit validation/p6-comparison/cases/*/input.json ──────
// (publieke bron `cpp-cpm-engine`, commit c279a5c4, dezelfde herkomst als cases-p6-verified.json).
// Deze transcriptie is de enige handmatige stap; ze bevat GEEN uitvoer, alleen invoer.
type RelType = 'FS' | 'SS' | 'FF' | 'SF';
interface CaseCalendar { workDays: number[]; holidays?: string[] }
interface CaseActivity {
  code: string;
  durationDays: number;
  calendar: string;
  actualStart?: string;
  actualFinish?: string;
  remainingDuration?: number;
  constraint?: { type: string; date: string };
  constraint2?: { type: string };
}
interface EngineCase {
  id: string;
  dataDate: string;
  projectStart: string;
  calendars: Record<string, CaseCalendar>;
  activities: CaseActivity[];
  relationships: { from: string; to: string; type: RelType; lagDays: number }[];
}
const MONFRI: Record<string, CaseCalendar> = { MONFRI: { workDays: [1, 2, 3, 4, 5] } };
const CASES: EngineCase[] = [
  {
    id: '01-fs-chain', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 3, calendar: 'MONFRI' },
      { code: 'C', durationDays: 2, calendar: 'MONFRI' },
    ],
    relationships: [
      { from: 'A', to: 'B', type: 'FS', lagDays: 0 },
      { from: 'B', to: 'C', type: 'FS', lagDays: 0 },
    ],
  },
  {
    id: '02-ss-with-lag', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'SS', lagDays: 5 }],
  },
  {
    id: '03-ff-with-lag', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FF', lagDays: 3 }],
  },
  {
    id: '04-sf-edge-case', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 3, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'SF', lagDays: 0 }],
  },
  {
    id: '05-negative-float', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 8, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-01-12' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '06-multiple-calendars', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: { MONFRI: { workDays: [1, 2, 3, 4, 5] }, SIXDAY: { workDays: [1, 2, 3, 4, 5, 6] } },
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 10, calendar: 'SIXDAY' },
    ],
    relationships: [],
  },
  {
    id: '07-ontario-holidays', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: {
      CA_ON: {
        workDays: [1, 2, 3, 4, 5],
        holidays: [
          '2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01', '2026-08-03',
          '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-28', '2027-01-01', '2027-02-15',
          '2027-03-26', '2027-05-24', '2027-07-01', '2027-08-02', '2027-09-06', '2027-10-11',
          '2027-12-27', '2027-12-28',
        ],
      },
    },
    activities: [{ code: 'A', durationDays: 90, calendar: 'CA_ON' }],
    relationships: [],
  },
  {
    id: '08-in-progress-retained-logic', dataDate: '2026-01-12', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI', actualStart: '2026-01-06', remainingDuration: 7 },
      { code: 'B', durationDays: 5, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '09-completed-successor', dataDate: '2026-01-05', projectStart: '2025-12-01',
    calendars: MONFRI,
    activities: [
      {
        code: 'B', durationDays: 11, calendar: 'MONFRI',
        actualStart: '2025-12-15', actualFinish: '2025-12-30',
      },
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '10-out-of-sequence-progress', dataDate: '2026-01-12', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', actualStart: '2026-01-08', remainingDuration: 3 },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '11-mandatory-start-finish', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MSO', date: '2026-01-12' } },
      { code: 'B', durationDays: 4, calendar: 'MONFRI', constraint: { type: 'CS_MEO', date: '2026-01-30' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '12-snet-fnlt', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MSOA', date: '2026-01-20' } },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-02-13' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '13-alap', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', constraint2: { type: 'CS_ALAP' } },
      { code: 'C', durationDays: 3, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-02-28' } },
    ],
    relationships: [
      { from: 'A', to: 'B', type: 'FS', lagDays: 0 },
      { from: 'B', to: 'C', type: 'FS', lagDays: 0 },
    ],
  },
];

// ── XER-serialisatie van die invoer ─────────────────────────────────────────────────────────────
const HOURS_PER_DAY = 8;
const P6_EPOCH_UTC = Date.UTC(1899, 11, 30);

function p6DaySerial(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(year!, month! - 1, day!) - P6_EPOCH_UTC) / 86_400_000);
}

/** ISO-weekdag (1 = maandag … 7 = zondag) → P6-index (1 = zondag … 7 = zaterdag). */
function p6WeekdayIndex(isoWeekday: number): number {
  return isoWeekday === 7 ? 1 : isoWeekday + 1;
}

function calendarData(calendar: CaseCalendar): string {
  const days = [1, 2, 3, 4, 5, 6, 7].map(iso => {
    const index = p6WeekdayIndex(iso);
    const bands = calendar.workDays.includes(iso)
      ? '(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())'
      : '';
    return `(0||${index}()(${bands}))`;
  }).join('');
  const exceptions = (calendar.holidays ?? [])
    .map(date => `(0||${p6DaySerial(date)}(d|${p6DaySerial(date)})())`).join('');
  return `(0||CalendarData()((0||DaysOfWeek()(${days}))(0||Exceptions()(${exceptions}))))`;
}

function statusCode(activity: CaseActivity): string {
  if (activity.actualFinish) return 'TK_Complete';
  if (activity.actualStart) return 'TK_Active';
  return 'TK_NotStart';
}

function remainingHours(activity: CaseActivity): number {
  if (activity.actualFinish) return 0;
  if (activity.remainingDuration !== undefined) return activity.remainingDuration * HOURS_PER_DAY;
  return activity.durationDays * HOURS_PER_DAY;
}

function caseBytes(item: EngineCase): Uint8Array {
  const calendarIds = Object.keys(item.calendars);
  const lines: string[] = [
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    ...calendarIds.map(id => {
      const calendar = item.calendars[id]!;
      const weekHours = calendar.workDays.length * HOURS_PER_DAY;
      return `%R\t${id}\t${id}\tCA_Base\t${HOURS_PER_DAY}\t${weekHours}\t${calendarData(calendar)}`;
    }),
    '%T\tPROJECT',
    // Brongetrouw (`cases-import.xer`): `rem_target_link_flag = Y`, `plan_end_date` leeg.
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    `%R\tP\t${item.id}\t${calendarIds[0]}\t${item.dataDate} 00:00\t${item.projectStart} 08:00\t\tY`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date'
      + '\tact_start_date\tact_end_date\tcstr_type\tcstr_date\tcstr_type2',
    ...item.activities.map(activity => [
      '%R', activity.code, 'P', activity.calendar, activity.code, activity.code,
      // Brongetrouw: `DT_FixedDrtn`, `target_start_date` = projectstart, `target_end_date` leeg.
      'TT_Task', 'DT_FixedDrtn', statusCode(activity), 'CP_Drtn',
      String(activity.durationDays * HOURS_PER_DAY), String(remainingHours(activity)),
      `${item.projectStart} 08:00`, '',
      activity.actualStart ? `${activity.actualStart} 08:00` : '',
      activity.actualFinish ? `${activity.actualFinish} 17:00` : '',
      activity.constraint?.type ?? '',
      activity.constraint ? `${activity.constraint.date} 08:00` : '',
      activity.constraint2?.type ?? '',
    ].join('\t')),
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    ...item.relationships.map((relation, index) =>
      `%R\tR${index}\t${relation.to}\t${relation.from}\tP\tP\tPR_${relation.type}`
      + `\t${relation.lagDays * HOURS_PER_DAY}`),
    '%E',
  ];
  return new TextEncoder().encode(lines.join('\n'));
}

// ── De gecommitte P6-uitvoer ────────────────────────────────────────────────────────────────────
interface P6Row extends Record<string, string> {
  activity_code: string;
  ES_p6: string; EF_p6: string; LS_p6: string; LF_p6: string; TF_p6: string; FF_p6: string;
}
const oracle = JSON.parse(readFileSync(join(HERE, 'cases-p6-verified.json'), 'utf-8')) as {
  cases: { id: string; activities: P6Row[] }[];
};

/** `2026-01-05 08:00:00` en `2025-12-15 08:00:00 A` → `2026-01-05T08:00`; leeg blijft leeg. */
function p6Instant(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]}T${match[2]}` : null;
}
function p6Number(value: string): number | null {
  return value === '' ? null : Number(value);
}

type Axis = 'es' | 'ef' | 'ls' | 'lf' | 'tf' | 'ff';
const AXES: readonly Axis[] = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'];
// Gepinde poortredenen (sectie 1/2b) — gemeten op de brongetrouwe transcriptie.
const GATE_REASONS_PIN = ['missingExplicitTargetWindow'];
const GATE_REASON_CASE_09_B = 'missingExplicitTargetWindow';
// X12-brok 1 (2026-09-23): 77 → 156 zoals gelezen (+79) — het gat met 7b is dicht.
// #690 (2026-10-27): 156 → 160, de vier " A"-cellen van 08 A en 10 B gaan tegen de getoonde start.
const REAL_AS_READ_PIN = { cellen: 160, eens: 160 };
const REAL_WITHOUT_PROJECT_END_PIN = { cellen: 160, eens: 160 };
const REAL_PROJECT_RANGE_PIN = { start: '2026-01-05T08:00', end: '2026-01-05T08:00', flag: false };
// #690 (2026-10-27): leeg. Tot dan `08 A: es, ls` en `10 B: es, ls` — " A"-cellen tegen `earlyStart`.
const DEVIATING_CELLS_PIN: Record<string, Record<string, string[]>> = {};
// De P6-cellen met " A" (werkelijke datum) die tegen de getoonde datum gaan. Gepind zodat de regel
// niet stil verbreedt naar een cel zonder achtervoegsel.
const ACTUAL_CELLS_PIN: Record<string, Record<string, string[]>> = {
  '08-in-progress-retained-logic': { A: ['es', 'ls'] },
  '09-completed-successor': { B: ['es', 'ef', 'ls', 'lf'] },
  '10-out-of-sequence-progress': { B: ['es', 'ls'] },
};
const CASE_10_B_PIN = { es: '2026-01-26T08:00', ls: '2026-01-26T08:00' };
const CASE_08_PIN = {
  A: { es: '2026-01-12T08:00', ef: '2026-01-20T17:00', ls: '2026-01-12T08:00', lf: '2026-01-20T17:00', tf: 0, ff: 0 },
  B: { es: '2026-01-21T08:00', ef: '2026-01-27T17:00', ls: '2026-01-21T08:00', lf: '2026-01-27T17:00', tf: 0, ff: 0 },
};

interface Measured {
  es?: string; ef?: string; ls?: string; lf?: string; tf: number; ff: number;
  /** De getoonde start en het getoonde einde (`shownStart`/`shownFinish`) na deze berekening. */
  shownStart: string; shownFinish: string;
}

/** De rekendatums en de getoonde datums van één taak na de berekening. De getoonde datums lezen de
 *  vroege datums uit de uitkomst, zoals `applyCpmResult` ze terugschrijft. */
function measure(
  task: Task,
  solved: { earlyStart?: string; earlyFinish?: string; lateStart?: string; lateFinish?: string; totalFloat: number; freeFloat: number },
): Measured {
  const view: Task = {
    ...task,
    time: { ...task.time, earlyStart: solved.earlyStart ?? '', earlyFinish: solved.earlyFinish ?? '' },
  };
  return {
    es: solved.earlyStart, ef: solved.earlyFinish, ls: solved.lateStart, lf: solved.lateFinish,
    tf: solved.totalFloat, ff: solved.freeFloat,
    shownStart: shownStart(view), shownFinish: shownFinish(view),
  };
}

/** Is deze P6-cel een werkelijke datum (achtervoegsel " A")? */
function isActualCell(raw: string): boolean {
  return / A$/.test(raw);
}

/** Onze waarde tegenover één P6-cel. Een " A"-cel (werkelijke datum, zie sectie 5) gaat
 *  tegen de getoonde datum: start-assen tegen `shownStart`, einde-assen tegen `shownFinish`. Elke
 *  andere cel gaat tegen de rekendatum van die as. */
function oursForCell(ours: Measured, axis: Axis, raw: string): string | number | undefined {
  if (axis === 'tf' || axis === 'ff') return ours[axis];
  if (isActualCell(raw)) return axis === 'es' || axis === 'ls' ? ours.shownStart : ours.shownFinish;
  return ours[axis];
}

function solveCase(item: EngineCase): { measured: Map<string, Measured>; gate: Record<string, string> } {
  const imported = activeImportResult(readXER(caseBytes(item)));
  // B3/B4 staan sinds 2026-09-23 (eigenaarsvraag §1d-7) in elk ingebouwd profiel uit (0 cellen op de
  // P6-doorgerekende populatie; gebouwd op rehab-2 = P3). Deze fixture toetst de regel zelf: als afwijking aan.
  setConvention(imported, 'p6CompletedDataDateWindow', true);
  setConvention(imported, 'p6CompletedLoeActualFinish', true);
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(`${item.id}: ${result.error}`);
  const measured = new Map<string, Measured>();
  for (const activity of item.activities) {
    const solved = result.tasks.get(activity.code);
    const task = imported.tasks.find(candidate => candidate.id === activity.code);
    if (!solved || !task) throw new Error(`${item.id}: taak ${activity.code} ontbreekt in de uitkomst`);
    measured.set(activity.code, measure(task, solved));
  }
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const gate: Record<string, string> = {};
  for (const task of imported.tasks) {
    gate[task.id] = explainP6CompletedDataDateWindow(
      task, dataDate, solveOptionsFor(imported.project).schedulingOptions,
    ).reason;
  }
  return { measured, gate };
}

/**
 * De agreement-matrix: per casus/activiteit/as `true` (wij zijn het eens met P6), `false` (niet
 * eens) of `null` (P6 legde niets vast). Dit is een KARAKTERISERING, geen doel — hij staat hier
 * zodat elke verschuiving, in beide richtingen, zichtbaar wordt.
 */
const agreement: Record<string, Record<string, Record<string, boolean | null>>> = {};
const actualCells: Record<string, Record<string, string[]>> = {};
const gates: Record<string, Record<string, string>> = {};
for (const item of CASES) {
  const { measured, gate } = solveCase(item);
  gates[item.id] = gate;
  const oracleCase = oracle.cases.find(entry => entry.id === item.id);
  if (!oracleCase) throw new Error(`orakel mist casus ${item.id}`);
  agreement[item.id] = {};
  for (const row of oracleCase.activities) {
    const ours = measured.get(row.activity_code);
    if (!ours) throw new Error(`${item.id}: orakelactiviteit ${row.activity_code} niet gesolved`);
    const perAxis: Record<string, boolean | null> = {};
    for (const axis of AXES) {
      const raw = row[`${axis.toUpperCase()}_p6`]!;
      const want = axis === 'tf' || axis === 'ff' ? p6Number(raw) : p6Instant(raw);
      perAxis[axis] = want === null ? null : oursForCell(ours, axis, raw) === want;
      if (isActualCell(raw)) {
        ((actualCells[item.id] ??= {})[row.activity_code] ??= []).push(axis);
      }
    }
    agreement[item.id]![row.activity_code] = perAxis;
  }
}

// ── 1. De poortstand per casus: nergens opent het completed-statusdatumvenster ──────────────────
// Brongetrouw gemeten (her-review bevinding 1): de bron declareert `rem_target_link_flag = Y`, dus
// `remainingStartOff` is hier NIET de reden. De poort staat dicht op de duurtype-eis
// (`DT_FixedDrtn` ≠ `DT_FixedDUR2`) en het ontbrekende `target_end_date` — een toevallige nauwte,
// geen verzoening. `p6CompletedLateFromRemainingWindow` is daardoor in alle dertien casussen inert.
eq('1 completed-statusdatumvenster blijft in alle dertien casussen gesloten — en om déze redenen',
  [...new Set(Object.values(gates).flatMap(entry => Object.values(entry)))].sort(),
  GATE_REASONS_PIN);

// ── 2. Casus 09 expliciet: wij geven de open voorganger dezelfde LS/TF als P6 23.12 ─────────────
{
  const { measured, gate } = solveCase(CASES.find(item => item.id === '09-completed-successor')!);
  const a = measured.get('A')!;
  const b = measured.get('B')!;
  eq('2 casus 09: open voorganger A krijgt LS = ES en TF = 0, exact zoals P6 23.12 opnam', {
    es: a.es, ef: a.ef, ls: a.ls, lf: a.lf, tf: a.tf, ff: a.ff,
  }, {
    es: '2026-01-05T08:00', ef: '2026-01-09T17:00',
    ls: '2026-01-05T08:00', lf: '2026-01-09T17:00', tf: 0, ff: 0,
  });
  eq('2a casus 09: de voltooide opvolger B blijft op haar historische actual-venster',
    { es: b.es, ef: b.ef, ls: b.ls, lf: b.lf },
    {
      es: '2025-12-15T08:00', ef: '2025-12-30T17:00',
      ls: '2025-12-15T08:00', lf: '2025-12-30T17:00',
    });
  eq('2b casus 09: B komt niet door het completed-statusdatumvenster (poortreden zoals de bron die geeft)',
    gate.B, GATE_REASON_CASE_09_B);
}

// ── 3. Casus 09 tegenover de X12-fixture: hetzelfde patroon, andere bronvorm ────────────────────
// Zelfde topologie (open A → FS → voltooide B), maar mét expliciet targetvenster,
// `rem_target_link_flag=Y` en een `act_end_date` NA de statusdatum. Dan opent de poort wél en legt
// B — net als elke andere opvolger — gewone backwarddruk op A. De twee fixtures spreken elkaar dus
// niet tegen; ze staan aan weerszijden van dezelfde poort. Deze assertie maakt dat mechanisch: hij
// faalt zodra iemand de poort verruimt en casus 09 alsnog binnentrekt.
{
  const calendar = calendarData({ workDays: [1, 2, 3, 4, 5] });
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tP6 5x8\tCA_Base\t8\t40\t${calendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\trem_target_link_flag',
    '%R\tP\tcasus 09 met targetvenster\tC1\t2026-01-05 00:00\t2025-12-01 08:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date'
      + '\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP\tC1\tA\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t40\t40'
      + '\t2026-01-05 08:00\t2026-01-09 17:00\t\t',
    '%R\tB\tP\tC1\tB\tVoltooide opvolger\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t88\t0'
      + '\t2025-12-15 08:00\t2025-12-30 17:00\t2025-12-15 08:00\t2025-12-30 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR0\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = activeImportResult(readXER(bytes));
  // B3/B4 staan sinds 2026-09-23 (eigenaarsvraag §1d-7) in elk ingebouwd profiel uit (0 cellen op de
  // P6-doorgerekende populatie; gebouwd op rehab-2 = P3). Deze fixture toetst de regel zelf: als afwijking aan.
  setConvention(imported, 'p6CompletedDataDateWindow', true);
  setConvention(imported, 'p6CompletedLoeActualFinish', true);
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const b = imported.tasks.find(task => task.id === 'B')!;
  eq('3 dezelfde topologie MET targetvenster opent de poort wél', {
    window: explainP6CompletedDataDateWindow(b, dataDate, solveOptionsFor(imported.project).schedulingOptions).reason,
    shared: explainP6CompletedLateRemainingWindowEligibilityResolved(
      b, dataDate, solveOptionsFor(imported.project).schedulingOptions,
    ).eligible,
  }, { window: 'eligible', shared: true });
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(result.error);
  const a = result.tasks.get('A')!;
  const solvedB = result.tasks.get('B')!;
  // Gemeten uitkomst, niet naar een wens toe geschreven: mét de poort open volgt B het
  // statusdatumvenster en houdt A — die B's start pas ná die klem kan bedienen — géén nulfloat meer.
  eq('3a met de poort open verschuift de late zijde van B naar het statusdatumvenster', {
    ls: solvedB.lateStart, lf: solvedB.lateFinish,
  }, { ls: '2026-01-05T08:00', lf: '2026-01-02T17:00' });
  eq('3b en A verliest daardoor haar nulfloat (zelfde topologie, andere bronvorm dan casus 09)',
    { ls: a.lateStart, lf: a.lateFinish, tf: a.totalFloat },
    { ls: '2025-12-29T08:00', lf: '2026-01-02T17:00', tf: -5 });
}

// ── 3b. De transcriptie kan niet stil terugdrijven van de bron (her-check residu A / mutatie M3) ──
// De vier poortdiscriminatoren staan hier letterlijk gepind op de bytes die `caseBytes` maakt, zoals
// `cases-import.xer` ze draagt: `DT_FixedDrtn` (nooit `DT_FixedDUR2`), `rem_target_link_flag=Y`,
// `target_start_date` = projectstart, leeg `target_end_date`. MUTATIEBEWIJS: zet `DT_FixedDUR2`
// terug in `caseBytes` ⇒ 3b slaat ROOD (de poort bleef daar toevallig even dicht, vandaar deze pin).
{
  const case09 = CASES.find(item => item.id === '09-completed-successor')!;
  const text = new TextDecoder().decode(caseBytes(case09));
  const taskRows = text.split('\n').filter(line => line.startsWith('%R\t') && line.includes('\tTT_Task\t'));
  eq('3b transcriptie draagt de bron-discriminatoren letterlijk', {
    durationTypes: [...new Set(taskRows.map(row => row.split('\t')[7]))],
    remTargetLink: text.includes('\tplan_end_date\trem_target_link_flag\n%R\tP\t09-completed-successor\tMONFRI\t2026-01-05 00:00\t2025-12-01 08:00\t\tY'),
    targetStarts: [...new Set(taskRows.map(row => row.split('\t')[12]))],
    targetEnds: [...new Set(taskRows.map(row => row.split('\t')[13]))],
  }, {
    durationTypes: ['DT_FixedDrtn'],
    remTargetLink: true,
    targetStarts: ['2025-12-01 08:00'],
    targetEnds: [''],
  });
}

// ── 4. De volledige agreement-matrix, eerlijk gepind ────────────────────────────────────────────
const summary = Object.fromEntries(CASES.map(item => {
  const rows = Object.values(agreement[item.id]!);
  const cells = rows.flatMap(row => Object.values(row)).filter(value => value !== null);
  return [item.id, { cellen: cells.length, eens: cells.filter(Boolean).length }];
}));
eq('4 agreement met P6 23.12 per casus (karakterisering, geen doel)', summary, {
  '01-fs-chain': { cellen: 18, eens: 18 },
  '02-ss-with-lag': { cellen: 12, eens: 12 },
  '03-ff-with-lag': { cellen: 12, eens: 12 },
  '04-sf-edge-case': { cellen: 12, eens: 12 },
  '05-negative-float': { cellen: 12, eens: 12 },
  '06-multiple-calendars': { cellen: 12, eens: 12 },
  '07-ontario-holidays': { cellen: 6, eens: 6 },
  // Brongetrouw (her-review bevinding 1): 160 van 160 — exact gelijk aan de echte bytes zoals gelezen
  // (7a) en zónder de projecteinde-fout (7b). Tot #690 (2026-10-27) 156: de " A"-cellen van 08 A en
  // 10 B gingen tegen `earlyStart` in plaats van tegen de getoonde start (sectie 5).
  '08-in-progress-retained-logic': { cellen: 12, eens: 12 },
  '09-completed-successor': { cellen: 10, eens: 10 },
  '10-out-of-sequence-progress': { cellen: 12, eens: 12 },
  '11-mandatory-start-finish': { cellen: 12, eens: 12 },
  '12-snet-fnlt': { cellen: 12, eens: 12 },
  '13-alap': { cellen: 18, eens: 18 },
});

// ── 5. De " A"-cellen en de rekendatum eronder ──────────────────────────────────────────────────
// Casus 08 A en 10 B zijn bezig zijnde taken rond de statusdatum. In het P6-profiel staat A19
// (`p6UseRemainingStartForProgress`) aan; `rem_target_link_flag` stuurt dat niet, die vlag is alleen
// diagnose (`xerScheduleOptions.ts`, `reportRemainingTargetLinkFlag`). Onder A19 is de VROEGE START van
// zo'n taak de reststart (statusdatum, of ná de voorganger): 08 A 2026-01-12, 10 B 2026-01-26.
// De meetset draagt in de ES- én de LS-cel de WERKELIJKE start met " A" (08 A 2026-01-06, 10 B
// 2026-01-08). Dat is geen P6-rekenuitvoer: het capturescript van de bron
// (`cpp-cpm-engine/validation/p6-comparison/db-read-capture.py` r. 188–190, commit `c279a5c4`)
// schrijft bij een gestarte taak `ACT_START_DATE + " A"` in ES en LS, en bij een voltooide
// `ACT_END_DATE + " A"` in EF en LF. P6's eigen `EARLY_START_DATE`/`LATE_START_DATE` staan voor die
// taken niet in de meetset. Een " A"-cel is dus een projectie van de werkelijke datum.
// De vergelijking tot 2026-10-27 legde die cel tegen `earlyStart` en vond vier verschillen; die
// vergeleek twee verschillende velden. Sinds #690 gaat een " A"-cel tegen de getoonde datum
// (`shownStart`/`shownFinish`, eigenaarsbesluit 2026-10-12). Dat toetst alleen dat de app de
// werkelijke datum toont; over P6's Late Start zegt het niets. EF/LF/TF/FF waren al gelijk. De
// rekendatums (Vroegste start) blijven hieronder gepind (5b/5c), zodat een verschuiving in de motor
// niet stil verdwijnt achter de getoonde datum.
// Niet door `p6CompletedLateFromRemainingWindow` veroorzaakt (assertie 1: de poort staat overal dicht).
{
  eq('5 precies deze P6-cellen zijn een werkelijke datum (" A") en gaan tegen de getoonde datum',
    actualCells, ACTUAL_CELLS_PIN);
  const deviating = Object.fromEntries(Object.entries(agreement).map(([id, rows]) => [
    id,
    Object.fromEntries(Object.entries(rows).map(([code, axes]) => [
      code, Object.entries(axes).filter(([, value]) => value === false).map(([axis]) => axis),
    ]).filter(([, axes]) => (axes as string[]).length > 0)),
  ]).filter(([, rows]) => Object.keys(rows).length > 0));
  eq('5 geen enkele cel wijkt af van P6 23.12', deviating, DEVIATING_CELLS_PIN);
  const case10 = solveCase(CASES.find(item => item.id === '10-out-of-sequence-progress')!).measured;
  eq('5a casus 10: onze A is nu gelijk aan P6 (LS 2026-01-12T08:00, LF 2026-01-23T17:00, TF 0)',
    { ls: case10.get('A')!.ls, lf: case10.get('A')!.lf, tf: case10.get('A')!.tf },
    { ls: '2026-01-12T08:00', lf: '2026-01-23T17:00', tf: 0 });
  eq('5b casus 10: B rekent ES/LS op de reststart, toont de werkelijke start (P6: 2026-01-08T08:00 A)',
    { es: case10.get('B')!.es, ls: case10.get('B')!.ls, shownStart: case10.get('B')!.shownStart },
    { ...CASE_10_B_PIN, shownStart: '2026-01-08T08:00' });
  const case08 = solveCase(CASES.find(item => item.id === '08-in-progress-retained-logic')!).measured;
  eq('5c casus 08: de rekendatums van A en B (A rekent op de reststart)', {
    A: { es: case08.get('A')!.es, ef: case08.get('A')!.ef, ls: case08.get('A')!.ls, lf: case08.get('A')!.lf, tf: case08.get('A')!.tf, ff: case08.get('A')!.ff },
    B: { es: case08.get('B')!.es, ef: case08.get('B')!.ef, ls: case08.get('B')!.ls, lf: case08.get('B')!.lf, tf: case08.get('B')!.tf, ff: case08.get('B')!.ff },
  }, CASE_08_PIN);
  eq('5d casus 08: A toont de werkelijke start (P6: 2026-01-06T08:00 A)',
    case08.get('A')!.shownStart, '2026-01-06T08:00');
}

// ── 6. Transcriptiepariteit met de publieke bron (alleen wanneer die gemount is) ────────────────
// De invoertabel hierboven is met de hand overgenomen. Staat het publieke vergelijkingsraamwerk
// beschikbaar — via `OPS_P6_COMPARISON`, of als `cpp-cpm-engine/validation/p6-comparison` binnen
// `OPS_XER_CORPUS` — dan wordt elke casus veld voor veld tegen het bron-`input.json` gelegd. Zo kan
// de transcriptie niet stil afdrijven van de bron waar `cases-p6-verified.json` uit komt.
{
  const explicit = process.env.OPS_P6_COMPARISON;
  const fromCorpus = process.env.OPS_XER_CORPUS
    ? join(process.env.OPS_XER_CORPUS, 'cpp-cpm-engine', 'validation', 'p6-comparison')
    : undefined;
  const root = [explicit, fromCorpus].find(candidate =>
    candidate !== undefined && existsSync(join(candidate, 'cases')));
  if (!root) {
    console.log('OK  p6-verified-cases-engine: bron niet aanwezig (OPS_P6_COMPARISON/OPS_XER_CORPUS)'
      + ' — transcriptiepariteit overgeslagen');
  } else {
    const normalized = CASES.map(item => ({
      id: item.id,
      opts: { dataDate: item.dataDate, projectStart: item.projectStart, cal_map: item.calendars },
      activities: item.activities,
      relationships: item.relationships,
    }));
    const fromSource = CASES.map(item => {
      const raw = JSON.parse(
        readFileSync(join(root, 'cases', item.id, 'input.json'), 'utf-8'),
      ) as {
        activities: Array<Record<string, unknown>>;
        relationships: Array<Record<string, unknown>>;
        opts: {
          dataDate: string;
          projectStart: string;
          cal_map: Record<string, { work_days: number[]; holidays: string[] }>;
        };
      };
      return {
        id: item.id,
        opts: {
          dataDate: raw.opts.dataDate,
          projectStart: raw.opts.projectStart,
          cal_map: Object.fromEntries(Object.entries(raw.opts.cal_map).map(([id, calendar]) => [
            id,
            calendar.holidays.length > 0
              ? { workDays: calendar.work_days, holidays: calendar.holidays }
              : { workDays: calendar.work_days },
          ])),
        },
        activities: raw.activities.map(activity => ({
          code: activity.code as string,
          durationDays: activity.duration_days as number,
          calendar: activity.clndr_id as string,
          ...(activity.actual_start ? { actualStart: activity.actual_start as string } : {}),
          ...(activity.actual_finish ? { actualFinish: activity.actual_finish as string } : {}),
          ...(activity.remaining_duration !== undefined
            ? { remainingDuration: activity.remaining_duration as number } : {}),
          ...(activity.constraint ? { constraint: activity.constraint } : {}),
          ...(activity.constraint2 ? { constraint2: activity.constraint2 } : {}),
        })),
        relationships: raw.relationships.map(relation => ({
          from: relation.from_code as string,
          to: relation.to_code as string,
          type: relation.type as RelType,
          lagDays: relation.lag_days as number,
        })),
      };
    });
    eq('6 de handmatige invoertranscriptie is veld voor veld gelijk aan de publieke bron',
      normalized, fromSource);
  }
}

// ── 7. De ÉCHTE bytes: `cases-import.xer` door dezelfde lezer + solver (alleen mét corpus) ──────
// Her-review bevinding 2: "157/160 eens met P6" was een uitspraak over de transcriptie, niet over
// het bestand dat P6 werkelijk kreeg. Dit pint de echte export — dertien projecten in één XER —
// zoals gelezen, én met `useProjectEndDateForFloat` uitgezet. Het gat ertussen WAS de productfout
// (`docs/TODO.md`, afgevinkt): `sched_use_project_end_date_for_float = Y` + geen enkele
// `target_end_date`/`plan_end_date` ⇒ het taak-afgeleide projecteinde viel terug op de projectSTART
// en de hele late zijde verankerde daarop (77/160). X12-brok 1 zet de optie dan gerapporteerd uit
// (P6 rekent zonder Must Finish By terug vanaf max(EF)); beide tellers staan nu op 156/160 en blijven
// gepind zodat een regressie het gat zichtbaar heropent.
{
  const corpus = process.env.OPS_XER_CORPUS;
  const real = corpus ? join(corpus, 'cpp-cpm-engine', 'validation', 'p6-comparison', 'cases-import.xer') : undefined;
  if (!real || !existsSync(real)) {
    console.log('OK  p6-verified-cases-engine: cases-import.xer niet aanwezig (OPS_XER_CORPUS) — echte-bytes-run overgeslagen');
  } else {
    const opened = readXER(new Uint8Array(readFileSync(real)));
    const results = isMultiDocumentImport(opened) ? opened.results : [opened];
    eq('7 de echte export draagt dertien projecten', results.length, 13);
    const agreeReal = (overrides?: Partial<ProjectSchedulingOptions>) => {
      let cells = 0; let eens = 0;
      const perCase: Record<string, string> = {};
      for (const [index, item] of CASES.entries()) {
        const imported = results.find(candidate => candidate.project.name === `XV${String(index + 1).padStart(2, '0')}`)
          ?? results[index]!;
        // Rekenprofielen C4: de conventies komen uit het profiel van de import, de overrides zijn projectopties.
        const schedulingOptions = effectiveSchedulingOptions({
          schedulingProfile: imported.project.schedulingProfile,
          schedulingOptions: { ...imported.project.schedulingOptions, ...overrides },
        });
        const result = solveProject({
          tasks: imported.tasks, sequences: imported.sequences, calendar: imported.calendar,
          calendars: imported.resourceCalendars ?? [], dataDate: imported.project.statusDate,
          progressMode: imported.project.progressMode, schedulingOptions,
          projectStartDate: imported.project.startDate, projectEndDate: imported.project.endDate,
        });
        if (result.error) throw new Error(`${item.id} (echt): ${result.error}`);
        const oracleCase = oracle.cases.find(entry => entry.id === item.id)!;
        let caseCells = 0; let caseEens = 0;
        for (const row of oracleCase.activities) {
          const task = imported.tasks.find(candidate => candidate.wbsCode === row.activity_code);
          const solved = task ? result.tasks.get(task.id) : undefined;
          if (!task || !solved) throw new Error(`${item.id} (echt): activiteit ${row.activity_code} niet gesolved`);
          const ours = measure(task, solved);
          for (const axis of AXES) {
            const raw = row[`${axis.toUpperCase()}_p6`]!;
            const want = axis === 'tf' || axis === 'ff' ? p6Number(raw) : p6Instant(raw);
            if (want === null) continue;
            caseCells++;
            if (oursForCell(ours, axis, raw) === want) caseEens++;
          }
        }
        cells += caseCells; eens += caseEens;
        perCase[item.id] = `${caseEens}/${caseCells}`;
      }
      return { cells, eens, perCase };
    };
    const asRead = agreeReal();
    const withoutProjectEndFloat = agreeReal({ useProjectEndDateForFloat: false });
    eq('7a echte bytes, zoals gelezen (projecteinde-fout dicht sinds X12-brok 1)',
      { cellen: asRead.cells, eens: asRead.eens }, REAL_AS_READ_PIN);
    eq('7b echte bytes, met useProjectEndDateForFloat uit (het gat is precies die fout)',
      { cellen: withoutProjectEndFloat.cells, eens: withoutProjectEndFloat.eens }, REAL_WITHOUT_PROJECT_END_PIN);
    console.log(`.   p6-verified-cases-engine: echte bytes per casus zoals gelezen ${JSON.stringify(asRead.perCase)}`);
    console.log(`.   p6-verified-cases-engine: echte bytes per casus zonder projecteinde-float ${JSON.stringify(withoutProjectEndFloat.perCase)}`);
    const projectEnd = results[0]!.project.endDate;
    eq('7c de bron heeft geen enkel einde (plan_end_date en target_end_date leeg) ⇒ de optie staat uit (het projecteinde-veld stuurt de late pass niet meer)',
      { start: results[0]!.project.startDate, end: projectEnd, flag: results[0]!.project.schedulingOptions?.useProjectEndDateForFloat },
      REAL_PROJECT_RANGE_PIN);
  }
}

if (diffs.length > 0) {
  console.error(`P6 VERIFIED CASES ENGINE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`P6 VERIFIED CASES ENGINE GREEN: ${checks} checks groen`);
