import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import {
  leftRecordedDatesMode,
  needsExitRecompute,
  type RecordedDatesObservation,
} from '@/state/recordedDatesExit';

export function useExitRecordedDates(): void {
  useEffect(() => {
    const observe = (): RecordedDatesObservation => {
      const s = useAppStore.getState();
      return {
        documentId: s.activeDocumentId,
        inMode: s.datesAsRecorded,
        scheduleStale: s.scheduleStale,
        history: s.historyEvents,
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
        s.runCPM({ withinEvent: true });
      }, 0);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
