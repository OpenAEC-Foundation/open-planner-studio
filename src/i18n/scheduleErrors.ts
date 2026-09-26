// UI-laag-helper: solverfouten in de UI-taal. De solver levert een code + parameters
// (`CPMResult.errorInfo`); deze module maakt
// daar de sleutel + interpolatie van, en de UI vertaalt. `CPMResult.error` blijft de vaste tekst voor
// MCP-tools, extensies en logs.
//
// Alleen `import type`: na type-erasure een bladmodule, zodat zowel de state-laag (de melding) als de
// componenten hem kunnen gebruiken zonder cyclus (`npm run verify:cycles`).
import type { CPMResult, ScheduleErrorCode, ScheduleErrorInfo } from '@/engine/scheduler/CPMSolver';

/** De sleutel per code in de `common`-namespace. */
export type ScheduleErrorKey = `scheduleErrors.${ScheduleErrorCode}`;

// Een `Record` over de unie: een nieuwe code zonder regel hier is een compile-fout.
const CODES: Record<ScheduleErrorCode, true> = {
  cycle: true, noWorkingDays: true, invalidDayDuration: true, invalidHourDuration: true,
  hourTaskWithoutWorkHours: true, invalidStartDate: true,
};
/** Alle codes — voor de controle dat elke code in elke taal een tekst heeft. */
export const SCHEDULE_ERROR_CODES = Object.keys(CODES) as ScheduleErrorCode[];

/** Sleutel en interpolatieparameters (`task`, `path`) voor één solverfout. */
export function scheduleErrorMessage(info: ScheduleErrorInfo): { key: ScheduleErrorKey; params: Record<string, string> } {
  return {
    key: `scheduleErrors.${info.code}`,
    params: { task: info.taskName ?? '', path: (info.cycleNames ?? []).join(' → ') },
  };
}

/**
 * Minimale vertaalfunctie: sleutel plus opties in, tekst terug. De React-`t` van
 * `useTranslation('common')` voldoet. `any` om dezelfde reden als `ImportLabelT` (`importLabels.ts`):
 * i18next's `TFunction` overloadt op een letterlijke unie van sleutels, niet op `string`.
 */
export type ScheduleErrorT = (key: any, options?: any) => string;

/**
 * De fouttekst in de UI-taal. Zonder `errorInfo` (een resultaat dat niet uit de solver komt) valt hij
 * terug op de vaste `error`-tekst; zonder fout is het een lege string.
 */
export function scheduleErrorText(
  source: Pick<CPMResult, 'error' | 'errorInfo'> | null | undefined,
  t: ScheduleErrorT,
): string {
  if (!source) return '';
  if (source.errorInfo) {
    const { key, params } = scheduleErrorMessage(source.errorInfo);
    return t(key, params);
  }
  return source.error ?? '';
}
