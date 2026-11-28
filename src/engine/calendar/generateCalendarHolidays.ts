import type { Holiday, CalendarGeneration } from '@/types/calendar';
import {
  HOLIDAY_SETS, generateHolidays, generateRegionalBreak,
  type HolidayCountry,
} from './holidays';
import { parseDate } from '@/utils/dateUtils';

export type BouwvakChoice = 'geen' | 'noord' | 'midden' | 'zuid';

export type GeneratorCountry = HolidayCountry | 'none';

export interface HolidayGenParams {
  country: GeneratorCountry;
  region?: string;
  bouwvak: BouwvakChoice;
}

export const DEFAULT_GEN_PARAMS: HolidayGenParams = {
  country: 'NL',
  region: undefined,
  bouwvak: 'geen',
};

export function materializeHolidays(
  params: HolidayGenParams,
  fromYear: number,
  toYear: number,
): { holidays: Holiday[]; generation: CalendarGeneration | undefined } {
  if (params.country === 'none') {
    return { holidays: [], generation: undefined };
  }
  const set = HOLIDAY_SETS[params.country];
  const holidays = generateHolidays(set, params.region, fromYear, toYear);
  const bouwvakActive = params.country === 'NL' && params.bouwvak !== 'geen';
  if (bouwvakActive) {
    holidays.push(...generateRegionalBreak(params.bouwvak as 'noord' | 'midden' | 'zuid', fromYear, toYear));
  }
  holidays.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const generation: CalendarGeneration = {
    ruleSetId: params.country,
    region: params.region,
    breakChoice: bouwvakActive ? (params.bouwvak as 'noord' | 'midden' | 'zuid') : undefined,
    generatedFromYear: fromYear,
    generatedToYear: toYear,
  };
  return { holidays, generation };
}

export function computeGenerateSpan(
  startDate: string,
  endDate: string | undefined,
  calculatedEnd?: string,
): { from: number; to: number } {
  const yearOf = (iso: string | undefined): number | undefined => {
    if (!iso) return undefined;
    const year = parseDate(iso).getUTCFullYear();
    return Number.isFinite(year) ? year : undefined;
  };
  const startYear = yearOf(startDate) ?? new Date().getFullYear();
  const endYears = [yearOf(endDate), yearOf(calculatedEnd)]
    .filter((year): year is number => year !== undefined);
  if (endYears.length > 0) {
    const endYear = Math.max(...endYears);
    return { from: startYear - 1, to: Math.max(endYear + 1, startYear - 1) };
  }
  return { from: startYear - 1, to: startYear + 3 };
}
