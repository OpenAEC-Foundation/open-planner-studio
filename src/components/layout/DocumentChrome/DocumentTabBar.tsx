import { useTranslation } from 'react-i18next';
import { Menu, Plus, X } from 'lucide-react';
import { useDocumentCards, useDocumentActions } from './useDocumentCards';
import './DocumentChrome.css';

/** A · Documenttabs — horizontale tabstrip onder het lint. */
export function DocumentTabBar() {
  const { t } = useTranslation('common');
  const cards = useDocumentCards();
  const { switchTo, closeWithGuard, openProject, openOverview } = useDocumentActions();

  return (
    <div className="ops-tabstrip" data-ops-tabstrip>
      <button
        className="ops-iconbtn ops-tabstrip-menu"
        title={t('documents.allProjects')}
        onClick={openOverview}
      >
        <Menu size={17} />
      </button>

      {cards.map((card) => (
        <div
          key={card.id}
          className={`ops-tab${card.isActive ? ' active' : ''}`}
          style={{ ['--doc-color' as string]: card.color } as React.CSSProperties}
          title={card.fileName ?? card.title}
          onClick={() => switchTo(card.id)}
          data-ops-tab={card.id}
        >
          <span className="ops-dot" />
          <span className="ops-tab-name">{card.title}</span>
          {card.isDirty && <span className="ops-dirty-dot" />}
          <button
            className="ops-tab-close"
            title={t('close')}
            onClick={(e) => { e.stopPropagation(); closeWithGuard(card); }}
          >
            <X size={11} />
          </button>
        </div>
      ))}

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
