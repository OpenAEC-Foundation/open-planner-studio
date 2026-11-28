import {
  materializeHolidays,
  computeGenerateSpan,
  type HolidayGenParams,
} from '@/engine/calendar/generateCalendarHolidays';
import type { Holiday, WorkCalendar } from '@/types/calendar';

export interface CalendarHolidayInput {
  generate?: HolidayGenParams;
  rawHolidays?: Holiday[];
}

export interface CalendarHolidayResult {
  holidays: Holiday[];
  generation?: WorkCalendar['generation'];
  becameLiteral: boolean;
}

const rangeKey = (h: Holiday): string => `${h.startDate}|${h.endDate}`;

function dedupMerge(base: Holiday[], extra: Holiday[]): Holiday[] {
  const seen = new Set<string>();
  const out: Holiday[] = [];
  for (const h of [...base, ...extra]) {
    const key = rangeKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}

export function resolveCalendarHolidays(
  input: CalendarHolidayInput,
  span: { projectStart: string; projectEnd: string },
  existing?: Pick<WorkCalendar, 'holidays' | 'generation'>,
): CalendarHolidayResult {
  const hasRaw = (input.rawHolidays?.length ?? 0) > 0;
  const rawHolidays = input.rawHolidays ?? [];

  if (input.generate) {
    const { from, to } = computeGenerateSpan(span.projectStart, span.projectEnd);
    const mat = materializeHolidays(input.generate, from, to);
    if (hasRaw) {
      return {
        holidays: dedupMerge(mat.holidays, rawHolidays),
        becameLiteral: true,
      };
    }
    return {
      holidays: mat.holidays,
      generation: mat.generation,
      becameLiteral: false,
    };
  }

  const base = existing?.holidays ?? [];
  if (hasRaw) {
    const hadGeneration = existing?.generation != null;
    return {
      holidays: dedupMerge(base, rawHolidays),
      becameLiteral: hadGeneration,
    };
  }

  return {
    holidays: base,
    generation: existing?.generation,
    becameLiteral: false,
  };
}
