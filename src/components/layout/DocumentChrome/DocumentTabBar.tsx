import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Plus, X } from 'lucide-react';
import { useDocumentCards, useDocumentActions } from './useDocumentCards';
import { documentTabKeyDestination, revealDocumentTab } from './documentTabNavigation';
import './DocumentChrome.css';

/** A · Documenttabs — horizontale tabstrip onder het lint. */
export function DocumentTabBar() {
  const { t } = useTranslation('common');
  const cards = useDocumentCards();
  const { switchTo, closeWithGuard, openProject, openOverview } = useDocumentActions();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeId = cards.find(card => card.isActive)?.id;

  // Iedere route kan een document activeren; alleen hier kennen we de horizontale viewport.
  useEffect(() => {
    if (!activeId) return;
    const tab = tabRefs.current.get(activeId);
    if (tab) revealDocumentTab(tab);
  }, [activeId]);

  const focusTab = useCallback((id: string) => {
    requestAnimationFrame(() => tabRefs.current.get(id)?.focus());
  }, []);

  const onTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, cardId: string) => {
    if (event.target !== event.currentTarget) return;
    const nextId = documentTabKeyDestination(cards.map(card => card.id), cardId, event.key);
    if (!nextId) return;
    event.preventDefault();
    switchTo(nextId);
    focusTab(nextId);
  }, [cards, focusTab, switchTo]);

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
        <div className="ops-tabstrip-tabs" role="tablist" aria-label={t('documents.overviewTitle')}>
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="ops-tab-group"
              role="presentation"
            >
              <button
                ref={(element) => {
                  if (element) tabRefs.current.set(card.id, element);
                  else tabRefs.current.delete(card.id);
                }}
                id={`ops-document-tab-${card.id}`}
                type="button"
                role="tab"
                aria-label={card.title}
                aria-selected={card.isActive}
                tabIndex={card.isActive ? 0 : -1}
                className={`ops-tab${card.isActive ? ' active' : ''}`}
                style={{ ['--doc-color' as string]: card.color } as React.CSSProperties}
                title={card.fileName ?? card.title}
                onClick={(event) => { switchTo(card.id); event.currentTarget.focus(); }}
                onKeyDown={(event) => onTabKeyDown(event, card.id)}
                data-ops-tab={card.id}
                data-ops-tab-index={index + 1}
              >
                <span className="ops-dot" aria-hidden="true" />
                <span className="ops-tab-name" aria-hidden="true">{card.title}</span>
                {card.isDirty && <span className="ops-dirty-dot" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="ops-tab-close"
                title={t('close')}
                aria-label={`${t('close')} ${card.title}`}
                onClick={(event) => { event.stopPropagation(); closeWithGuard(card); }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
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
