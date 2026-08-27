import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Plus } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDocumentCards, useDocumentActions } from './useDocumentCards';
import { DocumentTabList } from './DocumentTabList';
import {
  documentTabCloseFocusTarget,
  focusDocumentTab,
  revealDocumentTab,
} from './documentTabNavigation';
import { documentTabFocusTargetOutsideOverview } from './projectOverviewFocus';
import './DocumentChrome.css';

/** A · Documenttabs — horizontale tabstrip onder het lint. */
export function DocumentTabBar() {
  const { t, i18n } = useTranslation('common');
  const cards = useDocumentCards();
  const { switchTo, closeWithGuard, openProject, openOverview } = useDocumentActions();
  const projectOverviewOpen = useAppStore((state) => state.ui.showProjectOverview);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousDocumentIds = useRef(cards.map(card => card.id));
  const activeId = cards.find(card => card.isActive)?.id;
  const direction = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';

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

  // Iedere route kan een document activeren; alleen hier kennen we de horizontale viewport.
  useEffect(() => {
    if (!activeId) return;
    const tab = tabRefs.current.get(activeId);
    if (tab) revealDocumentTab(tab);
  }, [activeId]);

  const focusTab = useCallback((id: string) => {
    focusDocumentTab(tabRefs.current, id);
  }, []);

  return (
    <div className="ops-tabstrip" data-ops-tabstrip>
      <button
        className="ops-iconbtn ops-tabstrip-menu"
        title={t('documents.allProjects')}
        onClick={openOverview}
      >
        <Menu size={17} />
      </button>

      <div className="ops-tabstrip-viewport" data-ops-tabstrip-viewport>
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

      <button
        className="ops-iconbtn ops-tabstrip-add"
        title={t('documents.openProject')}
        onClick={openProject}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
