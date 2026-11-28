import { useEffect } from 'react';
import { createFailedSolveGate } from '@/state/failedSolveGate';
import { useAppStore } from '@/state/appStore';
import { isAutoCalcHeld, onAutoCalcReleased } from '@/state/editHold';

export function useAutoCalcCPM(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const failedSolve = createFailedSolveGate(useAppStore.getState());
    const maybeScheduleRun = () => {
      const state = useAppStore.getState();
      if (failedSolve.blocks(state) || !state.ui.autoCalcCPM || !state.scheduleStale) return;
      if (timer) clearTimeout(timer);
      if (isAutoCalcHeld()) { timer = null; return; }
      timer = setTimeout(() => {
        timer = null;
        if (failedSolve.blocks(useAppStore.getState())) return;
        const s = useAppStore.getState();
        if (s.ui.autoCalcCPM && s.scheduleStale && !isAutoCalcHeld()) s.runCPM();
      }, 100);
    };
    const unsub = useAppStore.subscribe(maybeScheduleRun);
    const unsubRelease = onAutoCalcReleased(maybeScheduleRun);
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      unsubRelease();
    };
  }, []);
}
