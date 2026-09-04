import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { saveRibbonCompact } from '@/utils/settingsStore';
import { RibbonTab } from '@/state/slices/types';
import { RibbonTabContent } from './RibbonTabContent';
import { ExtensionRibbonGroups } from './ribbonWidgets';
import { RibbonDensity, RibbonDensityContext } from './ribbonDensity';
import './Ribbon.css';

/* ------------------------------------------------------------------------------------------------
 * Automatische inpassing (Office-lintpatroon): zoveel mogelijk labels, per knop degraderen
 * ------------------------------------------------------------------------------------------------
 * De lint-HOOGTE ligt vast (94px). Past de inhoud van de actieve tab niet op die ene rij, dan
 * degradeert niet de hele balk (dat was de oude vol → compact → icoon-ladder, die álle labels
 * tegelijk weggooide en zichtbaar knipperde), maar knop-vóór-knop van rechts naar links: een grote
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
 * De handmatige inklap-knop (`ui.ribbonCompact`) blijft daarbuiten: die maakt van het lint een
 * platte 40px-strip via de bestaande `.ribbon-container.compact`-CSS. In die stand degradeert de
 * automaat niets (alle markeringen worden gewist) en blijft horizontale scroll het vangnet — precies
 * zoals vóór deze wijziging.
 */

const MINI_ATTR = 'data-ribbon-mini';
const MINI_ITEM_ATTR = 'data-ribbon-mini-item';
const GRID_ATTR = 'data-ribbon-grid';
const AUTOTITLE_ATTR = 'data-ribbon-autotitle';
const FULLY_MINI_ATTR = 'data-ribbon-fully-mini';

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
    const icon = btn.querySelector('.ribbon-btn-icon');
    if (!icon || icon.childElementCount === 0) return false;
    const label = btn.querySelector('.ribbon-btn-label');
    return !!label && (label.textContent ?? '').trim().length > 0;
  });
}

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

/** Markeer groepen waarvan alle automatisch verkleinbare knoppen mini zijn geworden. */
function syncFullyMiniGroups(scroll: HTMLElement): void {
  scroll.querySelectorAll<HTMLElement>('.ribbon-group').forEach(group => {
    const buttons = Array.from(group.querySelectorAll<HTMLElement>('.ribbon-btn'));
    const fullyMini = buttons.length > 0 && buttons.every(btn => btn.hasAttribute(MINI_ATTR));
    if (fullyMini) group.setAttribute(FULLY_MINI_ATTR, '');
    else group.removeAttribute(FULLY_MINI_ATTR);
  });
}

/** Zet de laatste `k` knoppen (rechts → links) op mini en synchroniseert de grid-markeringen. */
function applyMiniPlan(scroll: HTMLElement, buttons: HTMLElement[], k: number): void {
  const firstMini = buttons.length - k;
  const grids = new Set<Element>();
  const items = new Set<Element>();

  buttons.forEach((btn, i) => {
    if (i >= firstMini) {
      if (!btn.hasAttribute(MINI_ATTR)) {
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
      }
      const groupContent = btn.closest('.ribbon-group-content');
      const item = groupContent ? soleGridItem(btn, groupContent) : null;
      if (groupContent && item) {
        grids.add(groupContent);
        items.add(item);
      }
    } else if (btn.hasAttribute(MINI_ATTR)) {
      btn.removeAttribute(MINI_ATTR);
      if (btn.hasAttribute(AUTOTITLE_ATTR)) {
        btn.removeAttribute(AUTOTITLE_ATTR);
        btn.removeAttribute('title');
      }
    }
  });

  scroll.querySelectorAll(`[${MINI_ITEM_ATTR}]`).forEach(el => {
    if (!items.has(el)) el.removeAttribute(MINI_ITEM_ATTR);
  });
  scroll.querySelectorAll(`[${GRID_ATTR}]`).forEach(el => {
    if (!grids.has(el)) el.removeAttribute(GRID_ATTR);
  });
  items.forEach(el => el.setAttribute(MINI_ITEM_ATTR, ''));
  grids.forEach(el => el.setAttribute(GRID_ATTR, ''));
  // Het groepslabel mag alleen verticaal worden als de hele groep zijn knoppen kwijt is. Dit moet
  // al tijdens de binaire meetstappen gebeuren: de smallere labelkolom kan bepalen hoeveel knoppen
  // uiteindelijk naar mini moeten degraderen.
  syncFullyMiniGroups(scroll);
}

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
): void {
  // Het toegepaste plan: hoeveel knoppen mini staan, en over hoeveel knoppen dat ging (die telling
  // is de goedkope check of de inhoud tussentijds veranderd is).
  const plan = useRef({ count: -1, k: 0 });

  const measure = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const buttons = collectRibbonButtons(scroll);
    plan.current = { count: buttons.length, k: 0 };
    applyMiniPlan(scroll, buttons, 0);
    // Handmatig compact = platte 40px-strip; die stand blijft ongemoeid (en degradeert niet).
    if (manualCompact || buttons.length === 0 || fitsWidth(scroll)) return;

    // Kleinste k waarbij het past. Meer knoppen op mini maakt de inhoud nooit breder, dus is de
    // "past het?"-functie monotoon en mag de zoektocht binair: ~log2(n) metingen i.p.v. n.
    let lo = 1;
    let hi = buttons.length;
    let best = buttons.length; // past het zelfs met alles op icoon niet → horizontale scroll
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      applyMiniPlan(scroll, buttons, mid);
      if (fitsWidth(scroll)) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    applyMiniPlan(scroll, buttons, best);
    plan.current = { count: buttons.length, k: best };
  }, [scrollRef, manualCompact]);

  // Herberekenen bij tabwissel (andere inhoud), bij het omzetten van de handmatige knop en bij een
  // taalwissel (andere labelbreedtes bij gelijk aantal knoppen).
  useLayoutEffect(() => { measure(); }, [measure, activeTab, language]);

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

  // Na elke render het plan opnieuw toepassen. Nieuw gemonteerde knoppen (conditionele knoppen,
  // extensies) dragen nog geen markering; verandert de telling, dan volgt een volledige meting.
  // Anders alleen een goedkope controle of het nog past.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const buttons = collectRibbonButtons(scroll);
    const { count, k } = plan.current;
    if (buttons.length !== count) { measure(); return; }
    // In de handmatige compacte strip degradeert de automaat niets (defensief: het plan staat daar
    // al op 0 omdat het omzetten van de knop een hermeting triggert).
    const target = manualCompact ? 0 : Math.min(k, buttons.length);
    applyMiniPlan(scroll, buttons, target);
    if (!manualCompact && target < buttons.length && !fitsWidth(scroll)) measure();
  });
}

export function Ribbon() {
  const { t: tMenu, i18n } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const ribbonCompact = useAppStore(s => s.ui.ribbonCompact);
  // T14: het AI-tabblad verschijnt alleen bij ingeschakelde AI-modus (conditioneel, net als de
  // debug-terminal een paneel toont). Uitzetten verwijdert de tab; de reducer valt dan terug op
  // 'start' als dit tabblad actief was.
  const aiMode = useAppStore(s => s.ui.aiMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useRibbonAutoFit(containerRef, scrollRef, activeTab, ribbonCompact, i18n.language);
  // De dichtheid is nu puur de handmatige keuze: 'compact' is de platte 40px-strip die de gebruiker
  // zelf aanzet. De automaat werkt niet meer met een globale dichtheidsladder (die gooide álle
  // labels tegelijk weg), maar degradeert per knop van rechts naar links binnen dezelfde
  // lint-hoogte — zie {@link useRibbonAutoFit}. De groep-componenten die zelf een compacte vorm
  // renderen (TimeScale/Layout/Baselines/AI) lezen deze waarde via {@link RibbonDensityContext} en
  // blijven dus exact op de handmatige knop reageren.
  // Puur afgeleid uit bestaande state — geen eigen setState, dus geen renderlus mogelijk.
  const density: RibbonDensity = ribbonCompact ? 'compact' : 'full';

  const setActiveTab = useCallback((tab: RibbonTab) => {
    setUI({ activeRibbonTab: tab });
  }, [setUI]);

  const tabs: RibbonTab[] = [
    'start', 'planning', 'resources', 'beeld', 'instellingen', 'table', 'ifc', 'report',
    ...(aiMode ? (['ai'] as RibbonTab[]) : []),
  ];

  const densityClass = density === 'compact' ? ' compact' : '';

  return (
    <div ref={containerRef} className={`ribbon-container${densityClass}`}>
      {/* Tabs — 'file' is de speciale amber backstage-tab links. */}
      <div className="ribbon-tabs" data-tour-anchor="ribbon-tabs">
        <button
          key="file"
          className={`ribbon-tab ribbon-tab--file ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          {tMenu('ribbon.file')}
        </button>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
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
              <ExtensionRibbonGroups tab={activeTab} />
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
            onClick={() => {
              const next = !ribbonCompact;
              setUI({ ribbonCompact: next });
              void saveRibbonCompact(next);
            }}
          >
            {ribbonCompact ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
