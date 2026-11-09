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

/* ------------------------------------------------------------------------------------------------
 * Automatische inpassing (Office-lintpatroon): zoveel mogelijk labels, per knop degraderen
 * ------------------------------------------------------------------------------------------------
 * De lint-HOOGTE ligt vast (94px). Past de inhoud van de actieve tab niet op die ene rij, dan
 * degradeert niet de hele balk (dat gooit álle labels tegelijk weg en knippert zichtbaar), maar
 * knop-vóór-knop van rechts naar links: een grote
 * knop (icoon boven, label eronder, 66px hoog) wordt een kleine icoon-only knop van 20px, en drie
 * van die kleintjes stapelen zich binnen dezelfde lint-hoogte in één kolom. Knoppen die nog passen
 * houden gewoon hun label.
 *
 * Twee mechanismen dragen dat:
 *  1. `data-ribbon-mini` op de knop zelf   → CSS krimpt hem tot een icoon (label verborgen).
 *  2. `data-ribbon-grid` op de groepsinhoud + `data-ribbon-mini-item` op het directe kind
 *     → CSS zet die groep om in een 3-rijen-grid met kolomvulling, waardoor de mini-knoppen
 *       vanzelf per drie boven elkaar komen en de rest een hele kolom blijft vullen.
 *
 * GEEN GEKNIPPER: het aantal te degraderen knoppen wordt in één `useLayoutEffect` (vóór de
 * schilderbeurt) uitgerekend met een binaire zoektocht — attribuut zetten, `scrollWidth` lezen,
 * herhalen. De browser schildert pas ná het effect, dus de gebruiker ziet alleen het eindresultaat.
 * Er is bewust GEEN React-state bij betrokken: het effect schrijft alleen `data-*`-attributen die
 * React niet beheert, dus een herberekening kan nooit een re-render of een lus veroorzaken.
 *
 * Groepen met invoervelden (`RibbonCollapsible`) kunnen niet per knop krimpen: een datumveld of
 * keuzelijst heeft geen icoonvorm. Zo'n groep klapt als geheel in tot één knop met popover
 * (`data-ribbon-collapsed` op de groep). Volgorde: eerst worden gewone knoppen mini, behalve die van
 * de eerste groep (de hoofdacties, zoals Bereken). Is dat niet genoeg, dan klapt de veldengroep in
 * en wordt de knoppenstand opnieuw gezocht, zodat de vrijgekomen ruimte terug gaat naar labels.
 * Een veld als de statusdatum blijft zo lang mogelijk direct bruikbaar, zonder dat er een gat valt.
 * Een groep met de focus in een veld of met een open popover blijft in zijn stand (zie
 * `collectFitItems`).
 *
 * De handmatige inklap-knop (`ui.ribbonCompact`) blijft daarbuiten: die maakt van het lint een
 * platte 40px-strip via de `.ribbon-container.compact`-CSS. In die stand degradeert de
 * automaat niets (alle markeringen worden gewist) en blijft horizontale scroll het vangnet.
 */

const MINI_ATTR = 'data-ribbon-mini';
const MINI_ITEM_ATTR = 'data-ribbon-mini-item';
const GRID_ATTR = 'data-ribbon-grid';
const AUTOTITLE_ATTR = 'data-ribbon-autotitle';
const FULLY_MINI_ATTR = 'data-ribbon-fully-mini';
const COLLAPSED_ATTR = 'data-ribbon-collapsed';
/** Op de twee vormen van een `RibbonCollapsible` (`full` en `collapsed`). */
const COLLAPSE_PART_ATTR = 'data-ribbon-collapse-part';

/** Past de inhoud horizontaal binnen de zichtbare breedte? */
const fitsWidth = (scroll: HTMLElement) => scroll.scrollWidth <= scroll.clientWidth + 1;

/**
 * Alle knoppen die veilig tot icoon mogen degraderen, in DOM-volgorde (links → rechts).
 * Een knop zonder icoon zou als leeg stompje overblijven en doet dus niet mee; een knop zonder
 * label heeft niets te winnen. Popover-panelen leven via een portal in `document.body` en zitten
 * dus per definitie niet in deze subboom.
 */
function collectRibbonButtons(scroll: HTMLElement): HTMLElement[] {
  return Array.from(scroll.querySelectorAll<HTMLElement>('.ribbon-btn')).filter(btn => {
    // Knoppen in een inklapbare veldengroep krimpen niet los: die groep klapt als geheel in.
    if (btn.closest(`[${COLLAPSE_PART_ATTR}]`)) return false;
    const icon = btn.querySelector('.ribbon-btn-icon');
    if (!icon || icon.childElementCount === 0) return false;
    const label = btn.querySelector('.ribbon-btn-label');
    return !!label && (label.textContent ?? '').trim().length > 0;
  });
}

/** Op de ingeklapte vorm zolang zijn popover open is (gezet door `RibbonCollapsible`). */
const POPOVER_OPEN_ATTR = 'data-ribbon-popover-open';

/** Groepen met een `RibbonCollapsible`, in DOM-volgorde (links → rechts). */
function collectCollapsibleGroups(scroll: HTMLElement): HTMLElement[] {
  return Array.from(scroll.querySelectorAll<HTMLElement>('.ribbon-group'))
    .filter(group => group.querySelector(`[${COLLAPSE_PART_ATTR}="full"]`) !== null);
}

/** De knop van de ingeklapte vorm (groot icoon, label en ▾). */
function collapsedTrigger(group: HTMLElement): HTMLElement | null {
  return group.querySelector<HTMLElement>(`[${COLLAPSE_PART_ATTR}="collapsed"] .ribbon-btn`);
}

/**
 * Alles wat de automaat kan verkleinen.
 *  - `buttons`: gewone knoppen, links → rechts.
 *  - `protectedCount`: de eerste zoveel knoppen horen bij de eerste groep van de tab (de hoofdacties,
 *    zoals Bereken). Die worden pas mini als er geen veldengroep meer open kan blijven.
 *  - `groups`: veldengroepen die de automaat vrij mag inklappen, links → rechts.
 *  - `keepCollapsed`: veldengroepen met een open popover of met de focus op hun ingeklapte knop.
 *    Die blijven ingeklapt tot de popover dicht is en de focus weg is; anders verdween het paneel
 *    (met een halve invoer) bij een breder venster, of de knop met de focus erop (na Escape).
 *  - `keepOpen`: veldengroepen met de focus in een veld. Die klappen niet in: een veld dat midden in
 *    het typen `display: none` krijgt, verliest focus en invoer. Na het verlaten volgt een meting.
 *  - `signature`: telling plus deze vastgezette standen; verschilt hij, dan is opnieuw meten nodig.
 */
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

/**
 * Een stand van de automaat:
 *  - `g`: zoveel vrije veldengroepen (rechts → links) zijn ingeklapt;
 *  - `k`: zoveel gewone knoppen (rechts → links) zijn mini;
 *  - `t`: zoveel knoppen van ingeklapte groepen (rechts → links) zijn óók mini. Alleen als zelfs
 *    alles daarvoor niet past.
 */
interface FitPlan { g: number; k: number; t: number }

const EMPTY_PLAN: FitPlan = { g: 0, k: 0, t: 0 };

/**
 * Het directe kind van de groepsinhoud dat *uitsluitend* deze knop bevat (de knop zelf, of een
 * dunne wrapper zoals de `position: relative`-div van een Popover). Alleen zo'n element mag in het
 * grid één rij hoog worden. Zit de knop in een wrapper die óók andere dingen bevat (bv. de
 * Layout-groep: select + knoppenrij), dan geeft dit `null` — die knop krimpt dan wél tot icoon,
 * maar herschikt niet, want dat zou de rest van die wrapper meesleuren.
 */
function soleGridItem(btn: HTMLElement, groupContent: Element): HTMLElement | null {
  let el: HTMLElement = btn;
  while (el.parentElement && el.parentElement !== groupContent) {
    if (el.parentElement.childElementCount !== 1) return null;
    el = el.parentElement;
  }
  return el.parentElement === groupContent ? el : null;
}

/** Zet of wist de mini-markering van één knop. */
function setMini(btn: HTMLElement, mini: boolean): void {
  if (mini) {
    if (btn.hasAttribute(MINI_ATTR)) return;
    btn.setAttribute(MINI_ATTR, '');
    // Vangnet voor de handvol knoppen die zelf geen `title` meegeven: zonder label draagt de
    // tooltip de betekenis. Alleen bij de overgang naar mini zetten — Tooltip.tsx haalt het
    // `title` tijdens hover tijdelijk weg, dus elke render opnieuw "aanvullen" zou de native
    // tooltip terugbrengen bovenop de eigen tooltip.
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

/** Markeer groepen waarvan alle automatisch verkleinbare knoppen mini zijn geworden. Een ingeklapte
 *  veldengroep telt pas als volledig mini als ook zijn eigen knop klein is; dan staat het label
 *  gedraaid naast die knop. */
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

/** Past een stand toe op de DOM, inclusief de grid-markeringen en de gedraaide groepslabels. */
function applyFitPlan(scroll: HTMLElement, items: FitItems, { g, k, t }: FitPlan): void {
  const { buttons, groups, keepCollapsed, keepOpen } = items;
  const collapsed = [...groups.slice(groups.length - g), ...keepCollapsed];
  for (const group of [...groups, ...keepCollapsed, ...keepOpen]) {
    if (collapsed.includes(group)) group.setAttribute(COLLAPSED_ATTR, '');
    else group.removeAttribute(COLLAPSED_ATTR);
  }
  // Een groep die geen inklapbare vorm meer heeft (handmatig compact) houdt geen oude markering.
  scroll.querySelectorAll<HTMLElement>(`[${COLLAPSED_ATTR}]`).forEach(group => {
    if (!collapsed.includes(group)) group.removeAttribute(COLLAPSED_ATTR);
  });

  // Knoppen van ingeklapte groepen: in DOM-volgorde, de laatste `t` klein.
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
  // Het groepslabel mag alleen verticaal worden als de hele groep zijn knoppen kwijt is. Dit moet
  // al tijdens de binaire meetstappen gebeuren: de smallere labelkolom kan bepalen hoeveel knoppen
  // uiteindelijk naar mini moeten degraderen.
  syncFullyMiniGroups(scroll);
}

/** Kleinste waarde in `[lo, hi]` waarbij `fits(waarde)` waar is; bij `hi` past het al. Binair:
 *  meer verkleinen maakt de inhoud nooit breder, dus is "past het?" monotoon in die ene waarde. */
function smallestFitting(lo: number, hi: number, fits: (n: number) => boolean): number {
  let best = hi;
  while (lo < best) {
    const mid = (lo + best - 1) >> 1;
    if (fits(mid)) best = mid; else lo = mid + 1;
  }
  return best;
}

/**
 * Zoekt de stand met de meeste labels die past:
 *  1. Zonder ingeklapte groep: zoveel knoppen mini als nodig, maar niet die van de eerste groep.
 *  2. Past het zo niet, dan klapt de meest rechtse vrije veldengroep in, en wordt de knoppenstand
 *     opnieuw gezocht. De ruimte die het inklappen vrijmaakt, gaat zo terug naar labels: er blijft
 *     nooit meer ruimte leeg dan één knop terug op volle grootte zou kosten.
 *  3. Pas als alle veldengroepen dicht zijn, mogen ook de knoppen van de eerste groep mini worden,
 *     en daarna de knoppen van de ingeklapte groepen zelf.
 * Past ook dat niet, dan blijft alles zo klein mogelijk staan en is horizontale scroll het vangnet.
 */
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

/** Een meting kan knoppen verschuiven; een open popover (bijv. van een ingeklapte veldengroep) moet
 *  dan onder zijn knop blijven. Draait vóór de schilderbeurt, dus het paneel springt niet zichtbaar. */
const repositionPopovers = () => window.dispatchEvent(new Event(POPOVER_REPOSITION_EVENT));

/**
 * Meet en past de knop-degradatie toe. Retourneert niets: alles gebeurt imperatief op de DOM,
 * vóór de schilderbeurt.
 */
function useRibbonAutoFit(
  containerRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  activeTab: RibbonTab,
  manualCompact: boolean,
  language: string,
  fontScale: number,
): void {
  // Het toegepaste plan, met de signatuur van de inhoud waarvoor het gold (de goedkope check of
  // de inhoud of een vastgezette groep tussentijds veranderd is).
  const plan = useRef<{ signature: string; plan: FitPlan; fitted: boolean }>({ signature: '', plan: EMPTY_PLAN, fitted: true });

  const measure = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const items = collectFitItems(scroll);
    plan.current = { signature: items.signature, plan: EMPTY_PLAN, fitted: true };
    applyFitPlan(scroll, items, EMPTY_PLAN);
    // Handmatig compact = platte 40px-strip; die stand blijft ongemoeid (en degradeert niet).
    if (manualCompact || fitsWidth(scroll)) { repositionPopovers(); return; }
    const best = findFitPlan(scroll, items);
    applyFitPlan(scroll, items, best);
    repositionPopovers();
    // `fitted: false`: zelfs de kleinste stand past niet (horizontale scroll). Dan heeft opnieuw
    // meten na een render geen zin.
    plan.current = { signature: items.signature, plan: best, fitted: fitsWidth(scroll) };
  }, [scrollRef, manualCompact]);

  // Herberekenen bij tabwissel (andere inhoud), bij het omzetten van de handmatige knop, bij een
  // taalwissel en bij een tekengrootte-wissel (`ui.uiFontScale`) — beide veranderen labelbreedtes
  // bij gelijk aantal knoppen, en geen van beide raakt de containerbreedte, dus de ResizeObserver
  // hieronder vangt dit niet vanzelf op.
  useLayoutEffect(() => { measure(); }, [measure, activeTab, language, fontScale]);

  // Breedtewijziging van het lint (venster/paneel). Alleen op breedte reageren — de hoogte ligt
  // vast, maar een hoogte-trigger zou hoe dan ook een lus riskeren.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - lastWidth) > 0.5) {
        lastWidth = w;
        // ResizeObserver-callbacks draaien ná layout maar vóór de schilderbeurt: het resultaat is
        // in dezelfde frame zichtbaar, zonder tussenstand.
        measure();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  // Een vastgezette veldengroep (zie `keepOpen` en `keepCollapsed`) wordt weer vrij als de focus
  // de groep verlaat of als zijn popover sluit. Geen van beide rendert het lint zelf (de popover
  // leeft in de groep), dus de controle na elke render hieronder ziet het niet:
  //  - focus: in de volgende animatieframe staat de nieuwe focus vast; dat draait vóór de
  //    schilderbeurt;
  //  - popover: een MutationObserver op alleen `data-ribbon-popover-open`. De automaat schrijft dat
  //    attribuut nooit zelf, dus dit kan geen lus worden.
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

  // Na elke render het plan opnieuw toepassen. Nieuw gemonteerde knoppen (conditionele knoppen,
  // extensies) dragen nog geen markering; verandert de signatuur, dan volgt een volledige meting.
  // Anders alleen een goedkope controle of het nog past.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const items = collectFitItems(scroll);
    if (items.signature !== plan.current.signature) { measure(); return; }
    // In de handmatige compacte strip degradeert de automaat niets (defensief: het plan staat daar
    // al leeg omdat het omzetten van de knop een hermeting triggert).
    const current = manualCompact ? EMPTY_PLAN : plan.current.plan;
    applyFitPlan(scroll, items, current);
    if (!manualCompact && plan.current.fitted && !fitsWidth(scroll)) measure();
  });
}

/* ------------------------------------------------------------------------------------------------
 * Generieke ankers voor component-items
 * ------------------------------------------------------------------------------------------------
 * Knoppen en groepen krijgen hun `data-tour-anchor` rechtstreeks van het render-pad
 * (RibbonTabContent). Een component-item (popover, invoerveld, samengestelde widget) rendert zijn
 * eigen DOM; daarvoor zet het render-pad een onzichtbare `<template data-ribbon-anchor="…">` vóór en
 * een `<template data-ribbon-anchor-end>` ná het component. Deze hook zet dat anker op elk element
 * tussen die twee — dus op precies de elementen van dat ene component, hoeveel het er ook zijn, en
 * nooit op een knop die erna komt.
 *
 * Een component kan zijn eigen wortel opnieuw renderen zonder dat het lint rendert (eigen
 * store-selectors); een MutationObserver op `childList` vangt dat op. Het zetten van een attribuut
 * is geen `childList`-mutatie, dus er ontstaat geen lus.
 */
const ANCHOR_MARKER_ATTR = 'data-ribbon-anchor';
/** Sluitmarkering direct ná het component: wat daarna komt (bv. een gewone knop met een eigen,
 *  door React gezet anker) hoort niet meer bij dit component. */
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
  // De scrollcontainer is niet vast: op de tab Bestand (Backstage) verdwijnt hij en daarna komt er
  // een nieuwe. De waarnemer volgt daarom het element zelf, niet de ref; een waarnemer op de oude,
  // losgekoppelde container ziet niets meer, en een component dat zichzelf daarna opnieuw rendert
  // (Toewijzen ▾ bij een taakselectie) verloor dan zijn anker (knownbugs 52).
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
  // Het AI-tabblad verschijnt alleen bij ingeschakelde AI-modus (conditioneel, net als de
  // debug-terminal een paneel toont). Uitzetten verwijdert de tab; de reducer valt dan terug op
  // 'start' als dit tabblad actief was.
  const aiMode = useAppStore(s => s.ui.aiMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useRibbonAutoFit(containerRef, scrollRef, activeTab, ribbonCompact, i18n.language, uiFontScale);
  useRibbonAnchorMarkers(scrollRef);
  // De dichtheid is puur de handmatige keuze: 'compact' is de platte 40px-strip die de gebruiker
  // zelf aanzet. De automaat werkt niet met een globale dichtheidsladder, maar degradeert per knop
  // van rechts naar links binnen dezelfde
  // lint-hoogte — zie {@link useRibbonAutoFit}. De groep-componenten die zelf een compacte vorm
  // renderen (TimeScale/Layout/Baselines/AI) lezen deze waarde via {@link RibbonDensityContext} en
  // blijven dus exact op de handmatige knop reageren.
  // Puur afgeleid uit bestaande state — geen eigen setState, dus geen renderlus mogelijk.
  const density: RibbonDensity = ribbonCompact ? 'compact' : 'full';

  // Vanuit Backstage via de wegnavigeerbewaking: een niet-toegepaste Projectinfo-draft gaat
  // dan niet stil verloren. Buiten Backstage is er geen bewaker geregistreerd en is dit een no-op.
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
      {/* Tabs — 'file' is de speciale amber backstage-tab links. */}
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

      {/* Content — verborgen wanneer File-tab actief is (Backstage neemt de hele body over) */}
      {activeTab !== 'file' && (
        <div className="ribbon-content">
          <RibbonDensityContext.Provider value={density}>
            <div ref={scrollRef} className="ribbon-content-scroll">
              <RibbonTabContent tab={activeTab} />
              {EXTENSIONS_ENABLED && <ExtensionRibbonGroups tab={activeTab} />}
            </div>
          </RibbonDensityContext.Provider>
          {/* Compacte-modus-toggle rechtsonder (Word-web-stijl): ↑ = inklappen, ↓ = uitklappen.
              Sibling van .ribbon-content-scroll (niet erin) zodat position:absolute t.o.v.
              .ribbon-content de knop een vaste plek in de hoek geeft, los van scroll/inhoud —
              en in élke dichtheid (ook 'icon') zichtbaar en klikbaar blijft. */}
          <button
            className="ribbon-collapse-toggle"
            title={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
            aria-label={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
            onClick={() => applySetting('ribbonCompact', !ribbonCompact, saveRibbonCompact)}
          >
            <Icon id={ribbonCompact ? 'workspace.ribbon-expand' : 'workspace.ribbon-collapse'} size={16} lucide={{ size: 14 }} />
          </button>
        </div>
      )}
    </div>
  );
}
