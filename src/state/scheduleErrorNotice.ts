import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { scheduleErrorMessage } from '@/i18n/scheduleErrors';
import type { NotifyInput } from './slices/types';

/**
 * De gebruikersmelding voor een mislukte berekening — één definitie voor de drie plekken die hem
 * tonen: `runCPM`, de documentwissel en het openen van een bestand. De reden gaat mee als sleutel +
 * parameters (TB), zodat `NotificationHost` hem in de UI-taal toont; alleen een resultaat zonder
 * `errorInfo` valt terug op de vaste `error`-tekst. Samenvouwen op `cpm-error`: een herhaalde fout
 * wordt één regel met een teller. Geen fout ⇒ `null`.
 */
export function scheduleFailedNotice(cpm: Pick<CPMResult, 'error' | 'errorInfo'> | null | undefined): NotifyInput | null {
  if (!cpm?.error) return null;
  const reason = cpm.errorInfo ? scheduleErrorMessage(cpm.errorInfo) : null;
  return {
    severity: 'error',
    messageKey: 'notifications.scheduleFailed',
    ...(reason ? { detailKey: reason.key, detailParams: reason.params } : { detail: cpm.error }),
    dedupeKey: 'cpm-error',
  };
}
