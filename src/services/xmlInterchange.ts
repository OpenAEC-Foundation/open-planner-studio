import type { CustomTaskType } from '@/types/taskType';
import { importDateTimeOrUndefined, importStatusDate } from '@/services/importDates';
import { hasNonAnchorTime } from '@/services/subdayIo';

const XML_INVALID_CHAR = /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu;

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function replaceInvalidXmlChars(xml: string): { xml: string; replaced: number } {
  let replaced = 0;
  const out = xml.replace(XML_INVALID_CHAR, () => {
    replaced += 1;
    return '\u{FFFD}';
  });
  return { xml: out, replaced };
}

export const DAY_TIME_ANCHOR = '08:00:00';

export function toXmlDateTime(iso: string): string {
  if (!iso) return '';
  if (iso.length === 10) return `${iso}T${DAY_TIME_ANCHOR}`;
  if (iso.length === 16) return `${iso}:00`;
  return iso;
}

export type XmlTimeRule = 'foreign' | 'opsAnchor' | 'opsLiteral';

export function xmlTimeRule(writtenByOps: boolean, literalCalendarsDefined: boolean): XmlTimeRule {
  if (literalCalendarsDefined) return 'opsLiteral';
  return writtenByOps ? 'opsAnchor' : 'foreign';
}

export const OPS_LITERAL_CALENDARS_NAME = 'OPS_LiteralCalendars';

export function literalCalendarsJson(numbers: Iterable<number>): string {
  return JSON.stringify([...new Set(numbers)].sort((a, b) => a - b));
}

export function parseLiteralCalendars(raw: string | undefined): Set<number> | null {
  if (raw === undefined) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(n => Number.isInteger(n))) return null;
    return new Set(value as number[]);
  } catch { return null; }
}

export function xmlTimeSignal(raw: string): boolean {
  return hasNonAnchorTime(raw, DAY_TIME_ANCHOR) && importDateTimeOrUndefined(raw, true) !== undefined;
}

export function xmlTaskDate(raw: string, rule: XmlTimeRule, hourCalendar: boolean): string | undefined {
  return importDateTimeOrUndefined(raw, rule !== 'opsAnchor' || hourCalendar);
}

export function statusDateFromXml(raw: string, rule: XmlTimeRule): string {
  return rule === 'foreign' || hasNonAnchorTime(raw, DAY_TIME_ANCHOR) ? importStatusDate(raw) : raw.substring(0, 10);
}

export const OPS_DURATION_UNIT_NAME = 'OPS_TaskDurationUnit';

export function isTaskDurationUnit(value: string): value is 'days' | 'hours' {
  return value === 'days' || value === 'hours';
}

const OPS_CUSTOM_TASK_TYPE_MARKER = 'OpenPlannerStudio.CustomTaskType.v1';

export function encodeCustomTaskType(id: string, customTaskTypes: readonly CustomTaskType[]): string {
  const type = customTaskTypes.find(candidate => candidate.id === id);
  return JSON.stringify({ ops: OPS_CUSTOM_TASK_TYPE_MARKER, id, ...(type ? { name: type.name } : {}) });
}

export function decodeCustomTaskType(rawText: string): { id: string; name?: string } | undefined {
  try {
    const raw: unknown = JSON.parse(rawText);
    if (!raw || typeof raw !== 'object'
      || (raw as { ops?: unknown }).ops !== OPS_CUSTOM_TASK_TYPE_MARKER
      || typeof (raw as { id?: unknown }).id !== 'string') return undefined;
    const id = (raw as { id: string }).id.trim();
    const name = typeof (raw as { name?: unknown }).name === 'string'
      ? (raw as { name: string }).name.trim()
      : '';
    return id ? { id, ...(name ? { name } : {}) } : undefined;
  } catch { return undefined; }
}
