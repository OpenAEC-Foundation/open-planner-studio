import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import {
  leftRecordedDatesMode,
  needsExitRecompute,
  type RecordedDatesObservation,
} from '@/state/recordedDatesExit';

/**
 * Rekent één keer door zodra "datums zoals opgeslagen" via een BEWERKING is verlaten (issue #63).
 *
 * `finishMutation` zet de modus uit en `scheduleStale` aan, maar rekent zelf niet — dat mag het ook
 * niet, want het draait binnen een Immer-producer. Zonder deze hook zou de gebruiker met "Automatisch
 * berekenen" uit (de default) achterblijven met half-opgeslagen, half-bewerkte datums.
 *
 * Bewust los van `useAutoCalcCPM`: die respecteert de instelling, deze negeert hem juist — het
 * verlaten van de modus moet áltijd doorrekenen, anders bestaat de mengvorm alsnog.
 *
 * De F5-route heeft dit niet nodig: die roept `runCPM` al aan.
 *
 * Het BESLUIT staat in `@/state/recordedDatesExit` (pure functies, headless getoetst); deze hook
 * neemt alleen waar en voert uit. De uitgestelde uitvoering (`setTimeout` 0) is géén
 * prestatie-truc maar een correctheidseis — zie `needsExitRecompute` voor de vier gevallen die
 * hem nodig hebben (bulk-transacties, zelf-herrekenende acties, undo, documentwissel).
 */
export function useExitRecordedDates(): void {
  useEffect(() => {
    const observe = (): RecordedDatesObservation => {
      const s = useAppStore.getState();
      return {
        documentId: s.activeDocumentId,
        inMode: s.datesAsRecorded,
        scheduleStale: s.scheduleStale,
      };
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    let scheduledFor: string | null = null;
    let prev = observe();

    const unsub = useAppStore.subscribe(() => {
      const next = observe();
      const left = leftRecordedDatesMode(prev, next);
      prev = next;
      if (!left) return;
      scheduledFor = next.documentId;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const doc = scheduledFor;
        scheduledFor = null;
        if (doc === null) return;
        const s = useAppStore.getState();
        if (!needsExitRecompute(doc, observe())) return;
        s.runCPM();
      }, 0);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
