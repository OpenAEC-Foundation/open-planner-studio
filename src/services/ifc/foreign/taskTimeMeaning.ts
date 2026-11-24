import type { TaskTime } from '@/types/task';
import { parseImportedInstant } from '@/services/importDates';
import { formatInstant } from '@/utils/dateUtils';
import { IFC_TIME_ANCHOR } from '../ifcConstants';
import { ALL_RECORDED_SLOT_KEYS, IFC_TASKTIME_SLOTS, TASKTIME_SLOT, type TaskTimeReadHelpers } from '../ifcTaskSlots';
import { parseIfcDuration } from '../isoDuration';

const PRESENCE = new Set<number>(ALL_RECORDED_SLOT_KEYS.map(key => TASKTIME_SLOT[key]));
const absent = (token: string | undefined): token is undefined => !token || token === '$';
const unquoted = (token: string) => token.replace(/^'(.*)'$/, '$1');

function instant(token: string | undefined): string | undefined {
  if (absent(token)) return undefined;
  const raw = unquoted(token);
  try {
    return formatInstant(parseImportedInstant(raw.length === 10 ? `${raw}T${IFC_TIME_ANCHOR}` : raw), 'hour');
  } catch {
    return raw;
  }
}

function days(token: string | undefined, hoursPerDay: number): number | string | undefined {
  if (absent(token)) return undefined;
  try {
    const { days: whole, timeMinutes } = parseIfcDuration(unquoted(token));
    return whole + (timeMinutes ?? 0) / (hoursPerDay * 60);
  } catch {
    return token;
  }
}

export function taskTimeSlotMeaning(slot: number, token: string | undefined, hoursPerDay: number): string | undefined {
  if (PRESENCE.has(slot) && absent(token)) return '$';
  if (slot === TASKTIME_SLOT.statusTime) return instant(token) ?? '$';
  const read = IFC_TASKTIME_SLOTS[slot]?.read;
  if (!read) return undefined;
  const time = {} as TaskTime;
  const helpers = {
    parseDate: arg => instant(arg) ?? '$',
    parseDur: arg => days(arg, hoursPerDay) ?? 0,
    optDate: instant,
    optDur: arg => days(arg, hoursPerDay),
  } as TaskTimeReadHelpers;
  read(time, token, helpers);
  return JSON.stringify(time);
}
