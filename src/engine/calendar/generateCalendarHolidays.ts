import type { Holiday, CalendarGeneration } from '@/types/calendar';
import {
  HOLIDAY_SETS, generateHolidays, generateRegionalBreak, generateWinterStop,
  type HolidayCountry,
} from './holidays';

/** NL-bouwvak-keuze; `'geen'` (default, harde eis TODO.md r192-194) genereert geen bouwvak. */
export type BouwvakChoice = 'geen' | 'noord' | 'midden' | 'zuid';

/** Land-keuze voor de generator, plus `'none'` ("Geen feestdagen" — geen enkele set toepassen). */
export type GeneratorCountry = HolidayCountry | 'none';

export interface HolidayGenParams {
  country: GeneratorCountry;
  /** Bundesland/landsdeel/kanton; undefined = landelijk (of n.v.t. bij landen zonder regio's). */
  region?: string;
  /** Alleen relevant bij `country === 'NL'`; default `'geen'`. */
  bouwvak: BouwvakChoice;
  winterStop: boolean;
}

export const DEFAULT_GEN_PARAMS: HolidayGenParams = {
  country: 'NL',
  region: undefined,
  bouwvak: 'geen', // harde eis: default GEEN bouwvak
  winterStop: false,
};

/**
 * Materialiseer generator-parameters naar concrete `Holiday[]` + `CalendarGeneration`-metadata
 * (ontwerp §2.1/§4.4). `country: 'none'` levert een lege lijst en GEEN generation-metadata terug
 * (equivalent aan een letterlijke/lege kalender — nooit stil hergenereren, §4.3).
 */
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
  if (params.winterStop) {
    holidays.push(...generateWinterStop(fromYear, toYear));
  }
  holidays.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const generation: CalendarGeneration = {
    ruleSetId: params.country,
    region: params.region,
    breakChoice: bouwvakActive ? (params.bouwvak as 'noord' | 'midden' | 'zuid') : undefined,
    winterStop: params.winterStop || undefined,
    generatedFromYear: fromYear,
    generatedToYear: toYear,
  };
  return { holidays, generation };
}

/**
 * Standaard generatie-spanne (ontwerp §4.4): bij aanmaak (geen bekend projecteinde)
 * `startjaar−1 t/m startjaar+3`; bij een bekend projecteinde `projectstart−1 t/m projecteinde+1`.
 */
export function computeGenerateSpan(startDate: string, endDate: string | undefined): { from: number; to: number } {
  const startYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  if (endDate) {
    const endYear = new Date(endDate).getFullYear();
    return { from: startYear - 1, to: Math.max(endYear + 1, startYear - 1) };
  }
  return { from: startYear - 1, to: startYear + 3 };
}
