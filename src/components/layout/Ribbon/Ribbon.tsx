import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { POPOVER_REPOSITION_EVENT } from '@/components/common/Popover';
import { saveRibbonCompact } from '@/utils/settingsStore';
import { RibbonTab } from '@/state/slices/types';
import { RibbonTabContent } from './RibbonTabContent';
import { useRibbonTabWheel } from './useRibbonTabWheel';
import { ExtensionRibbonGroups } from './ribbonWidgets';
import { AI_MODE_AVAILABLE, EXTENSIONS_ENABLED } from '@/utils/buildFlags';
import { RibbonDensity, RibbonDensityContext } from './ribbonDensity';
import './Ribbon.css';
import { applySetting } from '@/components/settings/applySetting';

const MINI_ATTR = 'data-ribbon-mini';
const MINI_ITEM_ATTR = 'data-ribbon-mini-item';
const GRID_ATTR = 'data-ribbon-grid';
const AUTOTITLE_ATTR = 'data-ribbon-autotitle';
const FULLY_MINI_ATTR = 'data-ribbon-fully-mini';
const COLLAPSED_ATTR = 'data-ribbon-collapsed';
const COLLAPSE_PART_ATTR = 'data-ribbon-collapse-part';

const fitsWidth = (scroll: HTMLElement) => scroll.scrollWidth <= scroll.clientWidth + 1;

function collectRibbonButtons(scroll: HTMLElement): HTMLElement[] {
  return Array.from(scroll.querySelectorAll<HTMLElement>('.ribbon-btn')).filter(btn => {
    if (btn.closest(`[${COLLAPSE_PART_ATTR}]`)) return false;
    const icon = btn.querySelector('.ribbon-btn-icon');
    if (!icon || icon.childElementCount === 0) return false;
    const label = btn.querySelector('.ribbon-btn-label');
    return !!label && (label.textContent ?? '').trim().length > 0;
  });
}

const POPOVER_OPEN_ATTR = 'data-ribbon-popover-open';

function collectCollapsibleGroups(scroll: HTMLElement): HTMLElement[] {
  return Array.from(scroll.querySelectorAll<HTMLElement>('.ribbon-group'))
    .filter(group => group.querySelector(`[${COLLAPSE_PART_ATTR}="full"]`) !== null);
}

function collapsedTrigger(group: HTMLElement): HTMLElement | null {
  return group.querySelector<HTMLElement>(`[${COLLAPSE_PART_ATTR}="collapsed"] .ribbon-btn`);
}

interface FitItems {
  buttons: HTMLElement[];
  protectedCount: number;
  groups: HTMLElement[];
  keepCollapsed: HTMLElement[];
  keepOpen: HTMLElement[];
  signature: string;
}

function collectFitItems(scroll: HTMLElement): FitItems {
  const buttons = collectRibbonButtons(scroll);
  const firstGroup = buttons[0]?.closest('.ribbon-group');
  let protectedCount = 0;
  while (protectedCount < buttons.length && buttons[protectedCount].closest('.ribbon-group') === firstGroup) protectedCount++;
  const groups: HTMLElement[] = [];
  const keepCollapsed: HTMLElement[] = [];
  const keepOpen: HTMLElement[] = [];
  const active = document.activeElement;
  const pins = collectCollapsibleGroups(scroll).map(group => {
    const collapsedPart = group.querySelector(`[${COLLAPSE_PART_ATTR}="collapsed"]`);
    if (collapsedPart?.hasAttribute(POPOVER_OPEN_ATTR) || (active && collapsedPart?.contains(active))) {
      keepCollapsed.push(group);
      return 'c';
    }
    const full = group.querySelector(`[${COLLAPSE_PART_ATTR}="full"]`);
    if (active && full?.contains(active)) {
      keepOpen.push(group);
      return 'o';
    }
    groups.push(group);
    return '-';
  });
  return {
    buttons, protectedCount, groups, keepCollapsed, keepOpen,
    signature: `${buttons.length}/${pins.join('')}`,
  };
}

interface FitPlan { g: number; k: number; t: number }

const EMPTY_PLAN: FitPlan = { g: 0, k: 0, t: 0 };

function soleGridItem(btn: HTMLElement, groupContent: Element): HTMLElement | null {
  let el: HTMLElement = btn;
  while (el.parentElement && el.parentElement !== groupContent) {
    if (el.parentElement.childElementCount !== 1) return null;
    el = el.parentElement;
  }
  return el.parentElement === groupContent ? el : null;
}

function setMini(btn: HTMLElement, mini: boolean): void {
  if (mini) {
    if (btn.hasAttribute(MINI_ATTR)) return;
    btn.setAttribute(MINI_ATTR, '');
    if (!btn.hasAttribute('title')) {
      const text = btn.querySelector('.ribbon-btn-label')?.textContent?.trim();
      if (text) {
        btn.setAttribute('title', text);
        btn.setAttribute(AUTOTITLE_ATTR, '');
      }
    }
  } else if (btn.hasAttribute(MINI_ATTR)) {
    btn.removeAttribute(MINI_ATTR);
    if (btn.hasAttribute(AUTOTITLE_ATTR)) {
      btn.removeAttribute(AUTOTITLE_ATTR);
      btn.removeAttribute('title');
    }
  }
}

function syncFullyMiniGroups(scroll: HTMLElement): void {
  scroll.querySelectorAll<HTMLElement>('.ribbon-group').forEach(group => {
    let fullyMini: boolean;
    if (group.querySelector(`[${COLLAPSE_PART_ATTR}]`)) {
      const trigger = collapsedTrigger(group);
      fullyMini = group.hasAttribute(COLLAPSED_ATTR) && !!trigger && trigger.hasAttribute(MINI_ATTR);
    } else {
      const buttons = Array.from(group.querySelectorAll<HTMLElement>('.ribbon-btn'));
      fullyMini = buttons.length > 0 && buttons.every(btn => btn.hasAttribute(MINI_ATTR));
    }
    if (fullyMini) group.setAttribute(FULLY_MINI_ATTR, '');
    else group.removeAttribute(FULLY_MINI_ATTR);
  });
}

function applyFitPlan(scroll: HTMLElement, items: FitItems, { g, k, t }: FitPlan): void {
  const { buttons, groups, keepCollapsed, keepOpen } = items;
  const collapsed = [...groups.slice(groups.length - g), ...keepCollapsed];
  for (const group of [...groups, ...keepCollapsed, ...keepOpen]) {
    if (collapsed.includes(group)) group.setAttribute(COLLAPSED_ATTR, '');
    else group.removeAttribute(COLLAPSED_ATTR);
  }
  scroll.querySelectorAll<HTMLElement>(`[${COLLAPSED_ATTR}]`).forEach(group => {
    if (!collapsed.includes(group)) group.removeAttribute(COLLAPSED_ATTR);
  });

  const collapsedTriggers = collectCollapsibleGroups(scroll)
    .map(group => (collapsed.includes(group) ? collapsedTrigger(group) : null))
    .filter((btn): btn is HTMLElement => btn !== null);
  scroll.querySelectorAll<HTMLElement>(`[${COLLAPSE_PART_ATTR}] .ribbon-btn[${MINI_ATTR}]`).forEach(btn => {
    if (!collapsedTriggers.includes(btn)) setMini(btn, false);
  });
  collapsedTriggers.forEach((btn, i) => setMini(btn, i >= collapsedTriggers.length - t));

  const firstMini = buttons.length - k;
  const grids = new Set<Element>();
  const gridItems = new Set<Element>();
  buttons.forEach((btn, i) => {
    const mini = i >= firstMini;
    setMini(btn, mini);
    if (!mini) return;
    const groupContent = btn.closest('.ribbon-group-content');
    const item = groupContent ? soleGridItem(btn, groupContent) : null;
    if (groupContent && item) {
      grids.add(groupContent);
      gridItems.add(item);
    }
  });

  scroll.querySelectorAll(`[${MINI_ITEM_ATTR}]`).forEach(el => {
    if (!gridItems.has(el)) el.removeAttribute(MINI_ITEM_ATTR);
  });
  scroll.querySelectorAll(`[${GRID_ATTR}]`).forEach(el => {
    if (!grids.has(el)) el.removeAttribute(GRID_ATTR);
  });
  gridItems.forEach(el => el.setAttribute(MINI_ITEM_ATTR, ''));
  grids.forEach(el => el.setAttribute(GRID_ATTR, ''));
  syncFullyMiniGroups(scroll);
}

function smallestFitting(lo: number, hi: number, fits: (n: number) => boolean): number {
  let best = hi;
  while (lo < best) {
    const mid = (lo + best - 1) >> 1;
    if (fits(mid)) best = mid; else lo = mid + 1;
  }
  return best;
}

function findFitPlan(scroll: HTMLElement, items: FitItems): FitPlan {
  const { buttons, protectedCount, groups } = items;
  const fits = (plan: FitPlan) => { applyFitPlan(scroll, items, plan); return fitsWidth(scroll); };
  for (let g = 0; g <= groups.length; g++) {
    const kMax = g < groups.length ? buttons.length - protectedCount : buttons.length;
    if (!fits({ g, k: kMax, t: 0 })) continue;
    return { g, k: smallestFitting(0, kMax, k => fits({ g, k, t: 0 })), t: 0 };
  }
  const g = groups.length;
  const k = buttons.length;
  const triggers = [...groups, ...items.keepCollapsed].filter(group => collapsedTrigger(group)).length;
  if (triggers === 0 || !fits({ g, k, t: triggers })) return { g, k, t: triggers };
  return { g, k, t: smallestFitting(0, triggers, t => fits({ g, k, t })) };
}

const repositionPopovers = () => window.dispatchEvent(new Event(POPOVER_REPOSITION_EVENT));

function useRibbonAutoFit(
  containerRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  activeTab: RibbonTab,
  manualCompact: boolean,
  language: string,
  fontScale: number,
): void {
  const plan = useRef<{ signature: string; plan: FitPlan; fitted: boolean }>({ signature: '', plan: EMPTY_PLAN, fitted: true });

  const measure = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const items = collectFitItems(scroll);
    plan.current = { signature: items.signature, plan: EMPTY_PLAN, fitted: true };
    applyFitPlan(scroll, items, EMPTY_PLAN);
    if (manualCompact || fitsWidth(scroll)) { repositionPopovers(); return; }
    const best = findFitPlan(scroll, items);
    applyFitPlan(scroll, items, best);
    repositionPopovers();
    plan.current = { signature: items.signature, plan: best, fitted: fitsWidth(scroll) };
  }, [scrollRef, manualCompact]);

  useLayoutEffect(() => { measure(); }, [measure, activeTab, language, fontScale]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - lastWidth) > 0.5) {
        lastWidth = w;
        measure();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const remeasureIfChanged = () => {
      const scroll = scrollRef.current;
      if (scroll && collectFitItems(scroll).signature !== plan.current.signature) measure();
    };
    let frame = 0;
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[${COLLAPSE_PART_ATTR}]`)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(remeasureIfChanged);
    };
    el.addEventListener('focusout', onFocusOut);
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(remeasureIfChanged);
    observer?.observe(el, { subtree: true, attributes: true, attributeFilter: [POPOVER_OPEN_ATTR] });
    return () => {
      el.removeEventListener('focusout', onFocusOut);
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [containerRef, scrollRef, measure]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const items = collectFitItems(scroll);
    if (items.signature !== plan.current.signature) { measure(); return; }
    const current = manualCompact ? EMPTY_PLAN : plan.current.plan;
    applyFitPlan(scroll, items, current);
    if (!manualCompact && plan.current.fitted && !fitsWidth(scroll)) measure();
  });
}

const ANCHOR_MARKER_ATTR = 'data-ribbon-anchor';
const ANCHOR_END_ATTR = 'data-ribbon-anchor-end';

function applyRibbonAnchorMarkers(root: HTMLElement): void {
  root.querySelectorAll<HTMLTemplateElement>(`template[${ANCHOR_MARKER_ATTR}]`).forEach(marker => {
    const anchor = marker.getAttribute(ANCHOR_MARKER_ATTR);
    if (!anchor) return;
    for (
      let el = marker.nextElementSibling;
      el && !el.hasAttribute(ANCHOR_END_ATTR) && !el.hasAttribute(ANCHOR_MARKER_ATTR);
      el = el.nextElementSibling
    ) {
      if (el.getAttribute('data-tour-anchor') !== anchor) el.setAttribute('data-tour-anchor', anchor);
    }
  });
}

function useRibbonAnchorMarkers(scrollRef: RefObject<HTMLElement | null>): void {
  const observed = useRef<{ root: HTMLElement; observer: MutationObserver } | null>(null);
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (root) applyRibbonAnchorMarkers(root);
    if (observed.current?.root === root) return;
    observed.current?.observer.disconnect();
    observed.current = null;
    if (!root || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => applyRibbonAnchorMarkers(root));
    observer.observe(root, { childList: true, subtree: true });
    observed.current = { root, observer };
  });
  useLayoutEffect(() => () => {
    observed.current?.observer.disconnect();
    observed.current = null;
  }, []);
}

export function Ribbon() {
  const { t: tMenu, i18n } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const ribbonCompact = useAppStore(s => s.ui.ribbonCompact);
  const uiFontScale = useAppStore(s => s.ui.uiFontScale);
  const aiMode = useAppStore(s => s.ui.aiMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useRibbonAutoFit(containerRef, scrollRef, activeTab, ribbonCompact, i18n.language, uiFontScale);
  useRibbonAnchorMarkers(scrollRef);
  const density: RibbonDensity = ribbonCompact ? 'compact' : 'full';

  const setActiveTab = useCallback((tab: RibbonTab) => {
    if (tab === useAppStore.getState().ui.activeRibbonTab) return;
    leaveBackstageGuarded(() => setUI({ activeRibbonTab: tab }));
  }, [setUI]);

  const tabs: RibbonTab[] = [
    'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report',
    ...(AI_MODE_AVAILABLE && aiMode ? (['ai'] as RibbonTab[]) : []),
  ];
  useRibbonTabWheel(containerRef, tabs, setActiveTab);

  const densityClass = density === 'compact' ? ' compact' : '';

  return (
    <div ref={containerRef} className={`ribbon-container${densityClass}`}>
      <div className="ribbon-tabs" data-tour-anchor="ribbon-tabs">
        <button
          key="file"
          className={`ribbon-tab ribbon-tab--file ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
          data-tour-anchor="ribbon-tab:file"
        >
          {tMenu('ribbon.file')}
        </button>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            data-ops-ribbon-tab={tab}
            data-tour-anchor={`ribbon-tab:${tab}`}
          >
            {tMenu(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)}
          </button>
        ))}
      </div>

      {activeTab !== 'file' && activeTab !== 'report' && (
        <div className="ribbon-content">
          <RibbonDensityContext.Provider value={density}>
            <div ref={scrollRef} className="ribbon-content-scroll">
              <RibbonTabContent tab={activeTab} />
              {EXTENSIONS_ENABLED && <ExtensionRibbonGroups tab={activeTab} />}
            </div>
          </RibbonDensityContext.Provider>
          <button
            className="ribbon-collapse-toggle"
            title={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
            aria-label={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
            onClick={() => applySetting('ribbonCompact', !ribbonCompact, saveRibbonCompact)}
          >
            <Icon id={ribbonCompact ? 'workspace.ribbon-expand' : 'workspace.ribbon-collapse'} size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
