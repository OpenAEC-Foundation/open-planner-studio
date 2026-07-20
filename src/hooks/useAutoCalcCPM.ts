import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

// Automatisch berekenen: als de instelling aanstaat, draai runCPM zodra de planning
// verouderd raakt (scheduleStale), i.p.v. te wachten op de gebruiker (F5). Eén centrale
// plek i.p.v. bij elke callsite die scheduleStale zet — hetzelfde patroon als de auto-save:
// een globale store-subscribe + debounce (~100ms) om snelle opeenvolgende mutaties tot één
// run te coalescen. Geen oneindige lus: runCPM zet scheduleStale zelf weer op false, dus de
// volgende subscribe-tick vindt de guard-conditie niet meer waar.
export function useAutoCalcCPM(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const maybeScheduleRun = () => {
      const state = useAppStore.getState();
      if (!state.ui.autoCalcCPM || !state.scheduleStale) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const s = useAppStore.getState();
        if (s.ui.autoCalcCPM && s.scheduleStale) s.runCPM();
      }, 100);
    };
    const unsub = useAppStore.subscribe(maybeScheduleRun);
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
