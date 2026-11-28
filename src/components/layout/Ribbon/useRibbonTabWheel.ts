import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import type { RibbonTab } from '@/state/slices/types';
import { isBlockingDialogOpen } from '@/state/blockingDialogs';

const STEP_PX = 50;
const LINE_PX = 40;
const IDLE_RESET_MS = 300;

export function ribbonTabAfterWheel(tabs: readonly RibbonTab[], active: RibbonTab, direction: 1 | -1): RibbonTab | null {
  const index = tabs.indexOf(active);
  if (index < 0) return null;
  return tabs[index + direction] ?? null;
}

export function useRibbonTabWheel(
  ribbonRef: RefObject<HTMLElement | null>,
  tabs: readonly RibbonTab[],
  setActiveTab: (tab: RibbonTab) => void,
): void {
  const latest = useRef({ tabs, setActiveTab });
  useLayoutEffect(() => {
    latest.current = { tabs, setActiveTab };
  });

  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;
    let accumulated = 0;
    let lastAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (!useAppStore.getState().ui.ribbonWheelSwitchesTabs) return;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      if (e.timeStamp - lastAt > IDLE_RESET_MS) accumulated = 0;
      lastAt = e.timeStamp;
      const px = e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaMode === 2 ? Math.sign(e.deltaY) * STEP_PX : e.deltaY;
      if (Math.sign(px) !== Math.sign(accumulated)) accumulated = 0;
      accumulated += px;
      if (Math.abs(accumulated) < STEP_PX) return;
      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      const next = ribbonTabAfterWheel(latest.current.tabs, useAppStore.getState().ui.activeRibbonTab, direction);
      if (!next) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
      if (isBlockingDialogOpen(useAppStore.getState().ui)) return;
      latest.current.setActiveTab(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ribbonRef]);
}
