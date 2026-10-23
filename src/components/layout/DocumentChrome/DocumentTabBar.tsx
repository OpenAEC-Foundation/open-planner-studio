import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import { useAppStore } from '@/state/appStore';
import { useDocumentCards, useDocumentActions } from './useDocumentCards';
import { DocumentTabList } from './DocumentTabList';
import {
  documentTabCloseFocusTarget,
  focusDocumentTab,
  revealDocumentTab,
} from './documentTabNavigation';
import {
  documentTabNeedsArrows,
  documentTabScrollEdges,
  documentTabScrollTarget,
  wheelDeltaInPixels,
  type DocumentTabScrollEdges,
} from './documentTabScroll';
import { documentTabFocusTargetOutsideOverview } from './projectOverviewFocus';
import './DocumentChrome.css';

/** Zo lang telt een volgende pijlklik vanaf het doel van de vorige (duur van een vloeiende scroll). */
const PENDING_SCROLL_MS = 600;

/** A · Documenttabs — horizontale tabstrip onder het lint. */
export function DocumentTabBar() {
  const { t, i18n } = useTranslation('common');
  const cards = useDocumentCards();
  const { switchTo, closeWithGuard, chooseNewOrOpenProject, openOverview } = useDocumentActions();
  const projectOverviewOpen = useAppStore((state) => state.ui.showProjectOverview);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousDocumentIds = useRef(cards.map(card => card.id));
  const activeId = cards.find(card => card.isActive)?.id;
  const direction = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';
  const stripRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Doel van een lopende vloeiende klik. Een tweede klik tijdens het schuiven telt vanaf dat doel,
  // anders zou hij vanaf een halve positie rekenen en minder ver schuiven. Het doel vervalt zodra het
  // bereikt is, bij het scrollwiel, en uiterlijk na PENDING_SCROLL_MS (ook zonder 'scrollend'-event,
  // dat WebKit niet kent).
  const pendingOffset = useRef<{ offset: number; until: number } | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [edges, setEdges] = useState<DocumentTabScrollEdges>({ atStart: true, atEnd: true });
  const overflowingRef = useRef(false);

  // Overloop meten bij elke maatwijziging van strook of tabbladen (venster, tab erbij/eraf, langere
  // naam), randen ook bij scrollen. De overloop vergelijkt de tabbladen met de ruimte die ze zónder
  // pijlen krijgen; die maat hangt niet af van de pijlen zelf, dus de pijlen kunnen hun eigen
  // verschijnen niet terugdraaien. Vaste CSS-maten (padding, gap) lezen we één keer per opbouw.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const strip = stripRef.current;
    const tabs = viewport?.firstElementChild as HTMLElement | null | undefined;
    if (!viewport || !strip || !tabs) return;
    const stripStyle = getComputedStyle(strip);
    const gap = Number.parseFloat(stripStyle.columnGap) || 0;
    const padding = (Number.parseFloat(stripStyle.paddingLeft) || 0) + (Number.parseFloat(stripStyle.paddingRight) || 0);

    const measureEdges = () => {
      if (pendingOffset.current && Math.abs(Math.abs(viewport.scrollLeft) - pendingOffset.current.offset) < 1) {
        pendingOffset.current = null;
      }
      const next = documentTabScrollEdges(viewport.scrollLeft, viewport.scrollWidth, viewport.clientWidth);
      setEdges(previous => (previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next));
    };

    const measureOverflow = () => {
      // Vaste knoppen (menu, "+"): alles in de strook behalve de viewport en de pijlen.
      let fixedWidth = 0;
      let fixedCount = 0;
      for (const child of strip.children) {
        if (child === viewport || child.hasAttribute('data-ops-tabstrip-scroll')) continue;
        const style = getComputedStyle(child);
        fixedWidth += (child as HTMLElement).offsetWidth
          + (Number.parseFloat(style.marginLeft) || 0) + (Number.parseFloat(style.marginRight) || 0);
        fixedCount += 1;
      }
      const available = strip.clientWidth - padding - fixedWidth - gap * fixedCount;
      const shown = overflowingRef.current;
      const next = documentTabNeedsArrows(tabs.scrollWidth, available, shown);
      if (next !== shown) {
        overflowingRef.current = next;
        setOverflowing(next);
      }
      measureEdges();
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(strip);
    observer.observe(viewport);
    observer.observe(tabs);
    viewport.addEventListener('scroll', measureEdges, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', measureEdges);
    };
  }, [direction]);

  // Het verticale scrollwiel schuift de tabbladen horizontaal (zoals in een browser). Een
  // horizontale touchpadbeweging laat de browser zelf afhandelen, en Ctrl+wiel blijft zoomen.
  // Non-passive: anders mag preventDefault niet en scrolt de browser alsnog verticaal mee.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !overflowing) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      pendingOffset.current = null;
      const amount = wheelDeltaInPixels(event.deltaY, event.deltaMode);
      // Wiel omlaag = richting het eind, in LTR en RTL.
      viewport.scrollBy({ left: direction === 'rtl' ? -amount : amount, behavior: 'instant' });
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [direction, overflowing]);

  // Iedere route kan een document activeren; alleen hier kennen we de horizontale viewport. Ook
  // als de pijlknoppen verschijnen of verdwijnen: dan verandert de breedte van de viewport en kan
  // het actieve tabblad er net buiten vallen. En als het overzicht sluit: wie daar het al actieve
  // project kiest, verwacht dat tabblad ook te zien, ook als hij het eerder weg had geschoven.
  useEffect(() => {
    if (!activeId || projectOverviewOpen) return;
    const tab = tabRefs.current.get(activeId);
    if (tab) revealDocumentTab(tab);
  }, [activeId, overflowing, projectOverviewOpen]);

  const scrollTabs = useCallback((towards: 'start' | 'end') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rtl = direction === 'rtl';
    const viewportRect = viewport.getBoundingClientRect();
    const current = Math.abs(viewport.scrollLeft);
    // Logische beginpositie van elk tabblad binnen de inhoud, gemeten vanaf de beginrand.
    const tabStarts = [...viewport.querySelectorAll<HTMLElement>('.ops-tab-group')].map(group => {
      const rect = group.getBoundingClientRect();
      return (rtl ? viewportRect.right - rect.right : rect.left - viewportRect.left) + current;
    });
    const maxOffset = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const pending = pendingOffset.current;
    const base = pending && performance.now() < pending.until ? pending.offset : current;
    const target = documentTabScrollTarget(tabStarts, base, maxOffset, towards);
    pendingOffset.current = { offset: target, until: performance.now() + PENDING_SCROLL_MS };
    viewport.scrollTo({ left: rtl ? -target : target, behavior: 'smooth' });
  }, [direction]);

  // Focus verschuift uitsluitend na een echte verwijdering uit de gecommitteerde kaartenlijst. Dit
  // dekt schoon sluiten én de twee effectieve dirty-routes (opslaan/niet opslaan), ook wanneer een
  // sluiting vanuit het projectoverzicht komt; annuleren laat de bestaande focus ongemoeid.
  useLayoutEffect(() => {
    const currentDocumentIds = cards.map(card => card.id);
    const requestedDocumentId = previousDocumentIds.current.find(id => !currentDocumentIds.includes(id)) ?? null;
    const focusTarget = documentTabFocusTargetOutsideOverview(
      projectOverviewOpen,
      documentTabCloseFocusTarget(previousDocumentIds.current, cards, requestedDocumentId),
    );
    previousDocumentIds.current = currentDocumentIds;
    if (focusTarget) tabRefs.current.get(focusTarget)?.focus({ preventScroll: true });
  }, [cards, projectOverviewOpen]);


  const focusTab = useCallback((id: string) => {
    focusDocumentTab(tabRefs.current, id);
  }, []);

  return (
    <div className="ops-tabstrip" data-ops-tabstrip ref={stripRef}>
      <button
        className="ops-iconbtn ops-tabstrip-menu"
        title={t('documents.allProjects')}
        onClick={openOverview}
      >
        <B2Icon name="documents.overview" size={17} />
      </button>

      <div className="ops-tabstrip-viewport" data-ops-tabstrip-viewport ref={viewportRef}>
        <DocumentTabList
          cards={cards}
          direction={direction}
          tablistLabel={t('documents.overviewTitle')}
          closeLabel={t('close')}
          tabRef={(documentId, element) => {
            if (element) tabRefs.current.set(documentId, element);
            else tabRefs.current.delete(documentId);
          }}
          switchTo={switchTo}
          focusTab={focusTab}
          closeWithGuard={closeWithGuard}
        />
      </div>

      {/* Pijlknoppen alleen bij overloop. Ze staan bewust niet in de tabvolgorde (tabIndex -1):
          het WAI-ARIA-tabspatroon geeft de tablist één tabstop, en met de pijltoetsen, Home en End
          schuift het actieve tabblad al vanzelf in beeld. Voor muis, touch en spraakbediening
          houden ze wel een naam en tooltip. */}
      {overflowing && (
        <div className="ops-tabstrip-scroll" data-ops-tabstrip-scroll>
          <button
            type="button"
            tabIndex={-1}
            className="ops-iconbtn ops-tabstrip-scroll-button"
            title={t('documents.scrollTabsStart')}
            aria-label={t('documents.scrollTabsStart')}
            disabled={edges.atStart}
            onClick={() => scrollTabs('start')}
            data-ops-tabstrip-scroll-start
          >
            <B2Icon name="tabs.scroll-start" size={16} flip={direction === 'rtl'} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="ops-iconbtn ops-tabstrip-scroll-button"
            title={t('documents.scrollTabsEnd')}
            aria-label={t('documents.scrollTabsEnd')}
            disabled={edges.atEnd}
            onClick={() => scrollTabs('end')}
            data-ops-tabstrip-scroll-end
          >
            <B2Icon name="tabs.scroll-end" size={16} flip={direction === 'rtl'} />
          </button>
        </div>
      )}

      <button
        className="ops-iconbtn ops-tabstrip-add"
        title={t('documents.newOrOpenTitle')}
        onClick={chooseNewOrOpenProject}
      >
        <B2Icon name="documents.new-or-open" size={15} />
      </button>
    </div>
  );
}
