/**
 * De rekenopties van een P6 XML-project (`<ScheduleOptions>` en twee projectvelden) via DEZELFDE afleiding als
 * een XER (`deriveXerScheduleOptions`), zodat een P6 XML en een XER van hetzelfde project met dezelfde regels
 * rekenen (issue #775). De lezer zet de P6 XML-waarden hier om naar de XER-tokens; de schrijver gebruikt de
 * labels hieronder. Een onbekende waarde gaat ongewijzigd door, zodat de XER-afleiding hem als terugval meldt.
 *
 * Labels: zoals P6 ze schrijft in echte exports (corpus `crawl-pmxml/OZB-14_3rd_Update_eh.xml`,
 * `CartaGantt_Exportacion_P6_es.xml`, `pmxml-samples/*`) en in het P6-schema (`ScheduleOptionsType`, via MPXJ
 * `org.mpxj.primavera.schema` als gedragsreferentie; geen code overgenomen). De corpusbestanden dragen alleen de
 * P6-standaard; de andere labels komen uit het schema. `24-Hour Calendar` en `24 Hour Calendar` gelden allebei.
 */
import type { BuiltInProfileId, EffectiveSchedulingOptions, Project } from '@/types/project';
import type { XerRow, XerTable } from '@/services/xer/xerTables';
import {
  deriveXerScheduleOptions, indexXerScheduleOptions, type XerScheduleOptionsResult,
} from '@/services/xer/xerScheduleOptions';

/** De labels die de schrijver gebruikt (en de lezer terugleest). */
export const P6XML_LAG_CALENDAR = {
  predecessor: 'Predecessor Activity Calendar',
  successor: 'Successor Activity Calendar',
  '24hour': '24-Hour Calendar',
  projectDefault: 'Project Default Calendar',
} as const;
export const P6XML_FLOAT_TYPE = {
  start: 'Start Float = Late Start - Early Start',
  finish: 'Finish Float = Late Finish - Early Finish',
  smallest: 'Smallest of Start Float and Finish Float',
} as const;
export const P6XML_CRITICAL_PATH = { totalFloat: 'Critical Float', longestPath: 'Longest Path' } as const;
export const P6XML_OUT_OF_SEQUENCE = { RETAINED_LOGIC: 'Retained Logic', PROGRESS_OVERRIDE: 'Progress Override' } as const;

/** Een P6 XML-project opent met hetzelfde rekenprofiel als een XER. */
export const P6XML_PROFILE_ID: BuiltInProfileId = 'p6';

const key = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function flagToken(raw: string): string {
  const value = key(raw);
  if (value === '') return '';
  if (value === '1' || value === 'true' || value === 'y' || value === 'yes') return 'Y';
  if (value === '0' || value === 'false' || value === 'n' || value === 'no') return 'N';
  return raw.trim();
}

function mapped(raw: string, tokens: Readonly<Record<string, string>>): string {
  const value = key(raw);
  if (value === '') return '';
  return tokens[value] ?? raw.trim();
}

const LAG_CALENDAR_TOKENS: Readonly<Record<string, string>> = {
  predecessoractivitycalendar: 'rcal_Predecessor',
  successoractivitycalendar: 'rcal_Successor',
  '24hourcalendar': 'rcal_24Hour',
  projectdefaultcalendar: 'rcal_ProjDefault',
};
const CRITICAL_PATH_TOKENS: Readonly<Record<string, string>> = {
  criticalfloat: 'CT_TotFloat',
  longestpath: 'CT_DrivPath',
};
const START_TO_START_TOKENS: Readonly<Record<string, string>> = {
  '1': 'Y', true: 'Y', earlystart: 'Y',
  '0': 'N', false: 'N', actualstart: 'N',
};

function floatTypeToken(raw: string): string {
  const value = key(raw);
  if (value === '') return '';
  if (value.startsWith('startfloat')) return 'FT_SS';
  if (value.startsWith('finishfloat')) return 'FT_FF';
  if (value.startsWith('smallest')) return 'FT_Min';
  return raw.trim();
}

/** Retained Logic ⇒ Y/N, Progress Override ⇒ N/Y, Actual Dates ⇒ N/N (de XER-paren). */
function outOfSequenceTokens(raw: string): { sched_retained_logic: string; sched_progress_override: string } {
  switch (key(raw)) {
    case '': return { sched_retained_logic: '', sched_progress_override: '' };
    case 'retainedlogic': return { sched_retained_logic: 'Y', sched_progress_override: 'N' };
    case 'progressoverride': return { sched_retained_logic: 'N', sched_progress_override: 'Y' };
    case 'actualdates': return { sched_retained_logic: 'N', sched_progress_override: 'N' };
    default: return { sched_retained_logic: raw.trim(), sched_progress_override: '' };
  }
}

/** Een getal zoals P6 XML het schrijft (punt als decimaalteken); anders leeg, zodat de XER-standaard geldt. */
function numberToken(raw: string): string {
  const value = raw.trim();
  return /^-?\d+(\.\d+)?$/.test(value) ? value : '';
}

/**
 * `PriorityList` (`(0||priority_type(sort_type|ASC)())`, mogelijk meerdere achter elkaar) ⇒ de XER-vorm
 * `veld,/ASC` met het DEL-DEL-scheidingsteken. Past een stuk niet, dan gaat de ruwe tekst door en meldt de
 * XER-afleiding hem als terugval.
 */
function priorityListToken(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const entries = [...value.matchAll(/\(\d+\|\|([A-Za-z0-9_]+)\(sort_type\|(ASC|DESC)\)\(\)\)/g)];
  if (entries.length === 0 || entries.map(match => match[0]).join('') !== value) return value;
  return entries.map(match => `${match[1]},/${match[2]}\u007f\u007f`).join('');
}

const row = (cells: Record<string, string>): XerRow => ({
  line: 0,
  cells: Object.fromEntries(Object.entries(cells).filter(([, value]) => value !== '')),
});
const table = (name: string, rows: XerRow[]): XerTable => ({
  name, fields: [...new Set(rows.flatMap(r => Object.keys(r.cells)))], rows,
});

export interface P6XmlScheduleOptionsSource {
  /** De tekst van een direct kindelement van `<Project>`, of `''`. */
  project: (field: string) => string;
  /** De tekst van een direct kindelement van `<ScheduleOptions>`, of `''`; `null` zonder dat element. */
  schedule: ((field: string) => string) | null;
}

/**
 * De voortgangsmodus en projectopties van een P6 XML-project, afgeleid zoals bij een XER. Zonder
 * `<ScheduleOptions>` gelden de P6-standaarden, net als bij een XER zonder SCHEDOPTIONS-rij.
 */
export function deriveP6XmlScheduleOptions(
  source: P6XmlScheduleOptionsSource,
  context: Parameters<typeof deriveXerScheduleOptions>[2] = {},
): XerScheduleOptionsResult {
  const projectId = '1';
  const schedule = source.schedule;
  // Het kritiek-criterium staat in P6 XML op het project (zoals PROJECT.critical_path_type in een XER) en,
  // in echte exports, nog eens in <ScheduleOptions>. Het project wint.
  const criticalType = source.project('CriticalActivityPathType') || (schedule?.('CriticalActivityPathType') ?? '');
  const criticalHours = source.project('CriticalActivityFloatLimit') || (schedule?.('CriticalActivityFloatThreshold') ?? '');
  const projectRow = row({
    proj_id: projectId,
    critical_path_type: mapped(criticalType, CRITICAL_PATH_TOKENS),
    critical_drtn_hr_cnt: numberToken(criticalHours),
  });
  const scheduleRows = schedule ? [row({
    schedoptions_id: '1',
    proj_id: projectId,
    sched_calendar_on_relationship_lag: mapped(schedule('RelationshipLagCalendar'), LAG_CALENDAR_TOKENS),
    sched_float_type: floatTypeToken(schedule('ComputeTotalFloatType')),
    sched_open_critical_flag: flagToken(schedule('MakeOpenEndedActivitiesCritical')),
    sched_use_expect_end_flag: flagToken(schedule('UseExpectedFinishDates')),
    sched_lag_early_start_flag: mapped(schedule('StartToStartLagCalculationType'), START_TO_START_TOKENS),
    sched_use_project_end_date_for_float: flagToken(schedule('CalculateFloatBasedOnFinishDate')),
    ...outOfSequenceTokens(schedule('OutOfSequenceScheduleType')),
    enable_multiple_longest_path_calc: flagToken(schedule('MultipleFloatPathsEnabled')),
    use_total_float_multiple_longest_paths: flagToken(schedule('MultipleFloatPathsUseTotalFloat')),
    max_multiple_longest_path: numberToken(schedule('MaximumMultipleFloatPaths')),
    level_all_rsrc_flag: flagToken(schedule('LevelAllResources')),
    level_keep_sched_date_flag: flagToken(schedule('PreserveScheduledEarlyAndLateDates')),
    levelprioritylist: priorityListToken(schedule('PriorityList')),
  })] : [];
  const index = indexXerScheduleOptions({
    tables: new Map([['PROJECT', table('PROJECT', [projectRow])], ['SCHEDOPTIONS', table('SCHEDOPTIONS', scheduleRows)]]),
    numberFormat: { decimal: '.', group: null, source: 'default', currencyCode: '' },
  });
  return deriveXerScheduleOptions(index, projectId, context);
}

/** De rekenopties zoals de P6 XML-schrijver ze schrijft: de projectvelden en de kinderen van `<ScheduleOptions>`. */
export function p6XmlScheduleOptionFields(
  project: Pick<Project, 'progressMode' | 'endDate'>,
  options: EffectiveSchedulingOptions,
  hoursPerDay: number,
): { project: Array<[string, string]>; schedule: Array<[string, string]> } {
  const crit = options.criticalDefinition;
  const critHours = crit?.mode === 'totalFloat' ? crit.thresholdHours ?? (crit.threshold ?? 0) * hoursPerDay : 0;
  const flag = (value: boolean) => (value ? '1' : '0');
  const floatPaths = options.floatPaths;
  return {
    project: [
      ['CriticalActivityFloatLimit', String(critHours)],
      ['CriticalActivityPathType', P6XML_CRITICAL_PATH[crit?.mode === 'longestPath' ? 'longestPath' : 'totalFloat']],
    ],
    schedule: [
      ['CalculateFloatBasedOnFinishDate', flag(options.useProjectEndDateForFloat === true && !!project.endDate)],
      ['ComputeTotalFloatType', P6XML_FLOAT_TYPE[options.totalFloatMode ?? 'finish']],
      ['MakeOpenEndedActivitiesCritical', flag(options.makeOpenEndedCritical ?? false)],
      ...(floatPaths ? [
        ['MaximumMultipleFloatPaths', String(floatPaths.maxPaths)],
        ['MultipleFloatPathsEnabled', flag(floatPaths.enabled)],
        ['MultipleFloatPathsUseTotalFloat', flag(floatPaths.method === 'TOTAL_FLOAT')],
      ] as Array<[string, string]> : []),
      ['OutOfSequenceScheduleType', P6XML_OUT_OF_SEQUENCE[project.progressMode === 'PROGRESS_OVERRIDE' ? 'PROGRESS_OVERRIDE' : 'RETAINED_LOGIC']],
      ['RelationshipLagCalendar', P6XML_LAG_CALENDAR[options.lagCalendar ?? 'predecessor']],
      ['StartToStartLagCalculationType', flag((options.startToStartLagFrom ?? 'earlyStart') === 'earlyStart')],
      ['UseExpectedFinishDates', flag(options.useExpectedFinishDates ?? false)],
    ],
  };
}
