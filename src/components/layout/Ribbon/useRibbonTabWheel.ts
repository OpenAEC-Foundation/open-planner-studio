import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import type { RibbonTab } from '@/state/slices/types';
import { isBlockingDialogOpen } from '@/state/blockingDialogs';

/* ------------------------------------------------------------------------------------------------
 * Muiswiel boven het lint wisselt van tab (issue #688, Office-patroon)
 * ------------------------------------------------------------------------------------------------
 * Boven het hele lint: de rij met tabs (Bestand, Start, …) én de knoppen eronder. Een lijst in het
 * lint die zelf kan scrollen, houdt het wiel voor zichzelf. Wiel omlaag = volgende tab (naar
 * rechts), wiel omhoog = vorige tab. Aan het begin en het einde stopt het; het loopt niet rond. Bestand doet niet mee: dat is geen lint-tab maar de
 * Backstage. Staat de Backstage open, dan doet het wiel niets.
 *
 * Instelling `ui.ribbonWheelSwitchesTabs` (standaard aan) zet het uit.
 *
 * Eén wielklik geeft één tab. Een touchpad stuurt veel kleine stapjes; die tellen we op tot één
 * wielklik, zodat een kleine veeg niet door alle tabs heen schiet.
 */

/** Opgetelde wielafstand (px) voor één tabstap. Een wielklik is in Chromium 100 px, in Firefox
 *  3 regels; beide halen dit in één keer. */
const STEP_PX = 50;
/** Px per regel bij `deltaMode` 1 (Firefox); een pagina telt als een volle stap. */
const LINE_PX = 40;
/** Na zo lang zonder wielbeweging begint het optellen opnieuw. */
const IDLE_RESET_MS = 300;

/** De volgende tab in `tabs` bij een wielstap, of `null` aan de rand of buiten de lijst. */
export function ribbonTabAfterWheel(tabs: readonly RibbonTab[], active: RibbonTab, direction: 1 | -1): RibbonTab | null {
  const index = tabs.indexOf(active);
  if (index < 0) return null;
  return tabs[index + direction] ?? null;
}

/** Zit tussen `target` en `root` een element dat zelf verticaal kan scrollen in de wielrichting? */
function scrollsItself(target: EventTarget | null, root: HTMLElement, deltaY: number): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== root; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY !== 'auto' && overflowY !== 'scroll') || node.scrollHeight <= node.clientHeight) continue;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if (deltaY < 0 ? !atTop : !atBottom) return true;
  }
  return false;
}

export function useRibbonTabWheel(
  ribbonRef: RefObject<HTMLElement | null>,
  tabs: readonly RibbonTab[],
  setActiveTab: (tab: RibbonTab) => void,
): void {
  // De listener hangt één keer; hij leest de actuele lijst en actie via een ref.
  const latest = useRef({ tabs, setActiveTab });
  useLayoutEffect(() => {
    latest.current = { tabs, setActiveTab };
  });

  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;
    let accumulated = 0;
    let lastAt = 0;
    // Niet passief: anders kan preventDefault de pagina- of elementscroll niet tegenhouden.
    const onWheel = (e: WheelEvent) => {
      if (!useAppStore.getState().ui.ribbonWheelSwitchesTabs) return;
      // Ctrl/⌘ + wiel blijft van de browser (zoomen); horizontaal vegen doet niets.
      if (e.ctrlKey || e.metaKey || e.deltaY === 0) return;
      if (scrollsItself(e.target, el, e.deltaY)) return;
      e.preventDefault();
      if (e.timeStamp - lastAt > IDLE_RESET_MS) accumulated = 0;
      lastAt = e.timeStamp;
      const px = e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaMode === 2 ? Math.sign(e.deltaY) * STEP_PX : e.deltaY;
      // Draait de gebruiker terug, dan telt de oude richting niet meer mee.
      if (Math.sign(px) !== Math.sign(accumulated)) accumulated = 0;
      accumulated += px;
      if (Math.abs(accumulated) < STEP_PX) return;
      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      const next = ribbonTabAfterWheel(latest.current.tabs, useAppStore.getState().ui.activeRibbonTab, direction);
      if (!next) return;
      // Net als een klik op een tab: eerst verlaat de focus het actieve veld, zodat dat zijn
      // getypte waarde bewaart (onBlur). Anders verdwijnt die als de wissel het veld weghaalt.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
      // Opende het bewaren een vraag, dan wisselt het wiel niet (een klik zou op die vraag landen).
      if (isBlockingDialogOpen(useAppStore.getState().ui)) return;
      latest.current.setActiveTab(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ribbonRef]);
}
