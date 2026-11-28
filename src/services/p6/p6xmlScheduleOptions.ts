// Bron: MPXJ `org.mpxj.primavera.schema` (`ScheduleOptionsType`) als gedragsreferentie, geen code overgenomen (LGPL-2.1, github.com/joniles/mpxj).
import type { BuiltInProfileId } from '@/types/project';
import type { XerRow, XerTable } from '@/services/xer/xerTables';
import { deriveXerScheduleOptions, indexXerScheduleOptions, type XerScheduleOptionsResult } from '@/services/xer/xerScheduleOptions';

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

function outOfSequenceTokens(raw: string): { sched_retained_logic: string; sched_progress_override: string } {
  switch (key(raw)) {
    case '': return { sched_retained_logic: '', sched_progress_override: '' };
    case 'retainedlogic': return { sched_retained_logic: 'Y', sched_progress_override: 'N' };
    case 'progressoverride': return { sched_retained_logic: 'N', sched_progress_override: 'Y' };
    case 'actualdates': return { sched_retained_logic: 'N', sched_progress_override: 'N' };
    default: return { sched_retained_logic: raw.trim(), sched_progress_override: '' };
  }
}

function numberToken(raw: string): string {
  const value = raw.trim();
  return /^-?\d+(\.\d+)?$/.test(value) ? value : '';
}

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
  project: (field: string) => string;
  schedule: ((field: string) => string) | null;
}

export function deriveP6XmlScheduleOptions(
  source: P6XmlScheduleOptionsSource,
  context: Parameters<typeof deriveXerScheduleOptions>[2] = {},
): XerScheduleOptionsResult {
  const projectId = '1';
  const schedule = source.schedule;
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
