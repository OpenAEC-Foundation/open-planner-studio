import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, Plus } from 'lucide-react';
import { useDocumentCards, useDocumentActions, type DocumentCard } from './useDocumentCards';
import './DocumentChrome.css';

interface HoverState { card: DocumentCard; top: number; }

/** B · Projectbalk — verticale balk links (VS Code activity-bar-stijl). */
export function ProjectRail() {
  const { t } = useTranslation('common');
  const cards = useDocumentCards();
  const { switchTo, openProject, openOverview } = useDocumentActions();
  const [hover, setHover] = useState<HoverState | null>(null);

  return (
    <div className="ops-rail" data-ops-rail>
      <button className="ops-iconbtn ops-rail-grid" title={t('documents.allProjects')} onClick={openOverview}>
        <LayoutGrid size={20} />
      </button>
      <div className="ops-rail-sep" />

      {cards.map((card) => (
        <div
          key={card.id}
          className={`ops-rail-item${card.isActive ? ' active' : ''}`}
          style={{ ['--doc-color' as string]: card.color } as React.CSSProperties}
          onClick={() => switchTo(card.id)}
          onMouseEnter={(e) => setHover({ card, top: e.currentTarget.getBoundingClientRect().top })}
          onMouseLeave={() => setHover((h) => (h?.card.id === card.id ? null : h))}
          data-ops-rail-item={card.id}
        >
          {card.code}
          {card.isDirty && <span className="ops-rail-dirty" />}
        </div>
      ))}

      <button className="ops-rail-add" title={t('documents.openProject')} onClick={openProject}>
        <Plus size={16} />
      </button>

      {hover && (
        <div className="ops-flyout" style={{ left: 64, top: hover.top }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="ops-dot" style={{ ['--doc-color' as string]: hover.card.color } as React.CSSProperties} />
            <span className="ops-flyout-name">{hover.card.title}</span>
          </div>
          {hover.card.fileName && (
            <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginBottom: 10 }}>{hover.card.fileName}</div>
          )}
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--theme-text-dim)' }}>
            <span><b style={{ color: 'var(--theme-text)', fontWeight: 600 }}>{hover.card.taskCount}</b> {t('documents.tasksWord')}</span>
            <span><b style={{ color: 'var(--theme-critical-text)', fontWeight: 600 }}>{hover.card.criticalCount}</b> {t('documents.criticalWord')}</span>
            {hover.card.endDate && <span style={{ color: 'var(--theme-text)', fontWeight: 600 }}>{hover.card.endDate}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
