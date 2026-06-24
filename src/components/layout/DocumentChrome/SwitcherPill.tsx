import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useDocumentCards, useDocumentActions } from './useDocumentCards';
import './DocumentChrome.css';

/** C · Wisselaar — minimale projectpil in de titelbalk. */
export function SwitcherPill() {
  const { t } = useTranslation('common');
  const cards = useDocumentCards();
  const { openOverview } = useDocumentActions();
  const active = cards.find((c) => c.isActive) ?? cards[0];
  if (!active) return null;

  return (
    <button
      className="ops-pill"
      onClick={openOverview}
      title={t('documents.allProjects')}
      data-ops-pill
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <span className="ops-dot" style={{ ['--doc-color' as string]: active.color } as React.CSSProperties} />
      <span className="ops-pill-name">{active.title}</span>
      {active.isDirty && <span className="ops-dirty-dot" />}
      <ChevronDown size={12} style={{ opacity: 0.7 }} />
      <span className="ops-pill-badge">{t('documents.openBadge', { count: cards.length })}</span>
    </button>
  );
}
