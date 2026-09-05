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
 * verslechtering mechanisch opvalt. Gemeten stand vandaag: twaalf van de dertien casussen kloppen
 * volledig (157 van de 160 door P6 vastgelegde cellen); het enige verschil is casus 10, cel voor
 * cel gepind mét reden onder punt 5 hieronder.
 *
 * Wat de invoerzijde NIET bevat, verzinnen we niet: er staan géén `target_start_date`/
 * `target_end_date`-kolommen en géén `rem_target_link_flag` in deze fixtures, want het bronmateriaal
 * legt die niet vast. Gevolg — en dat is precies het antwoord op review-bevinding 7 — is dat
 * `explainP6CompletedDataDateWindow` voor casus 09 GESLOTEN blijft
 * (`remainingStartOff`/`missingExplicitTargetWindow`) en `p6CompletedLateFromRemainingWindow` daar
 * dus inert is. De X12-fixture "A→FS→B(completed) legt normale backwarddruk op open A" heeft wél een
 * expliciet targetvenster én een `act_end_date` NA de statusdatum, en is daarmee een andere
 * bronvorm — geen tegenspraak, maar een ander poortstandpunt. De assertie hieronder legt beide
 * kanten vast.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult } from '@/services/importTypes';
import { parseInstant } from '@/utils/dateUtils';
import { explainP6CompletedDataDateWindow } from '@/utils/p6CompletedTargetWindow';
import { explainP6CompletedLateRemainingWindowEligibility } from '@/engine/scheduler/p6CompletedRouteTrace';

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
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    `%R\tP\t${item.id}\t${calendarIds[0]}\t${item.dataDate} 00:00\t${item.projectStart} 08:00`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\tact_start_date\tact_end_date'
      + '\tcstr_type\tcstr_date\tcstr_type2',
    ...item.activities.map(activity => [
      '%R', activity.code, 'P', activity.calendar, activity.code, activity.code,
      'TT_Task', 'DT_FixedDUR2', statusCode(activity), 'CP_Drtn',
      String(activity.durationDays * HOURS_PER_DAY), String(remainingHours(activity)),
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

interface Measured { es?: string; ef?: string; ls?: string; lf?: string; tf: number; ff: number }

function solveCase(item: EngineCase): { measured: Map<string, Measured>; gate: Record<string, string> } {
  const imported = activeImportResult(readXER(caseBytes(item)));
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(`${item.id}: ${result.error}`);
  const measured = new Map<string, Measured>();
  for (const activity of item.activities) {
    const solved = result.tasks.get(activity.code);
    if (!solved) throw new Error(`${item.id}: taak ${activity.code} ontbreekt in de uitkomst`);
    measured.set(activity.code, {
      es: solved.earlyStart, ef: solved.earlyFinish,
      ls: solved.lateStart, lf: solved.lateFinish,
      tf: solved.totalFloat, ff: solved.freeFloat,
    });
  }
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const gate: Record<string, string> = {};
  for (const task of imported.tasks) {
    gate[task.id] = explainP6CompletedDataDateWindow(
      task, dataDate, imported.project.schedulingOptions,
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
      if (axis === 'tf' || axis === 'ff') {
        const want = p6Number(raw);
        perAxis[axis] = want === null ? null : ours[axis] === want;
      } else {
        const want = p6Instant(raw);
        perAxis[axis] = want === null ? null : ours[axis] === want;
      }
    }
    agreement[item.id]![row.activity_code] = perAxis;
  }
}

// ── 1. De poortstand per casus: nergens opent het completed-statusdatumvenster ──────────────────
// De invoerzijde van het vergelijkingsraamwerk kent geen targetvenster en geen
// `rem_target_link_flag`; `p6CompletedLateFromRemainingWindow` is hier dus overal inert. Dat is de
// harde verzoening met de X12-fixture uit review-bevinding 7.
eq('1 completed-statusdatumvenster blijft in alle dertien casussen gesloten',
  [...new Set(Object.values(gates).flatMap(entry => Object.values(entry)))].sort(),
  ['remainingStartOff']);

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
  eq('2b casus 09: B komt niet door het completed-statusdatumvenster (geen targetvenster in de bron)',
    gate.B, 'remainingStartOff');
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
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const b = imported.tasks.find(task => task.id === 'B')!;
  eq('3 dezelfde topologie MET targetvenster opent de poort wél', {
    window: explainP6CompletedDataDateWindow(b, dataDate, imported.project.schedulingOptions).reason,
    shared: explainP6CompletedLateRemainingWindowEligibility(
      b, dataDate, imported.project.schedulingOptions,
    ).eligible,
  }, { window: 'eligible', shared: true });
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
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
  '08-in-progress-retained-logic': { cellen: 12, eens: 12 },
  '09-completed-successor': { cellen: 10, eens: 10 },
  // Enige casus met een bekend verschil; de drie cellen staan hieronder cel voor cel gepind.
  '10-out-of-sequence-progress': { cellen: 12, eens: 9 },
  '11-mandatory-start-finish': { cellen: 12, eens: 12 },
  '12-snet-fnlt': { cellen: 12, eens: 12 },
  '13-alap': { cellen: 18, eens: 18 },
});

// ── 5. Het enige bekende verschil, cel voor cel ────────────────────────────────────────────────
// Casus 10 (out-of-sequence voortgang): B is op 2026-01-08 gestart terwijl haar FS-VOORGANGER A nog
// niet begonnen is. P6 23.12 geeft A daar `LS = ES = 2026-01-12` en `TF = 0`; wij trekken A's late
// zijde wél terug door B's historische actual start (`LS 2025-12-25`, `LF 2026-01-07`, `TF −12`).
// Drie cellen, allemaal op A — B zelf klopt volledig.
//
// Belangrijk voor review-bevinding 7: dit verschil is NIET door deze etappe veroorzaakt. Het
// completed-statusdatumvenster staat in alle dertien casussen dicht (assertie 1), dus
// `p6CompletedLateFromRemainingWindow` is hier inert en de uitkomst is byte-identiek aan vóór de
// vlag. Wat de casus wél laat zien is dat P6 een reeds bezig zijnde opvolger géén backwarddruk door
// haar historische actual-datums heen laat leggen — hetzelfde familielid als de X12-vraag hierboven,
// maar dan buiten de poort. Dat is klasse (ii)-materiaal voor een latere etappe; deze pin legt het
// verschil vast zodat het niet stil verdwijnt en niet stil groeit.
{
  const rows = agreement['10-out-of-sequence-progress']!;
  eq('5 casus 10: precies drie cellen wijken af, alle drie op activiteit B',
    Object.fromEntries(Object.entries(rows).map(([code, axes]) => [
      code, Object.entries(axes).filter(([, value]) => value === false).map(([axis]) => axis),
    ])), { A: ['ls', 'lf', 'tf'], B: [] });
  const { measured } = solveCase(CASES.find(item => item.id === '10-out-of-sequence-progress')!);
  eq('5a casus 10: onze A tegenover P6 (P6: LS 2026-01-12T08:00, LF 2026-01-23T17:00, TF 0)',
    { ls: measured.get('A')!.ls, lf: measured.get('A')!.lf, tf: measured.get('A')!.tf },
    { ls: '2025-12-25T08:00', lf: '2026-01-07T17:00', tf: -12 });
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

if (diffs.length > 0) {
  console.error(`P6 VERIFIED CASES ENGINE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`P6 VERIFIED CASES ENGINE GREEN: ${checks} checks groen`);
