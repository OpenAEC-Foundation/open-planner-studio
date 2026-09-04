import type { KeyboardEvent, MouseEvent, Ref } from 'react';
import type { DocumentCard } from './useDocumentCards';
import { DOCUMENT_TABPANEL_ID, documentTabId } from './documentTabNavigation';

interface DocumentTabControlProps {
  card: DocumentCard;
  index: number;
  closeLabel: string;
  tabRef: Ref<HTMLButtonElement>;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onClose: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Eén semantische tabcontrol met een zuster-sluitknop. De sluitknop is bewust
 * geen descendant van `role=tab`: zijn naam mag de toegankelijke tabnaam niet
 * vervuilen en hij blijft een zelfstandig bedienbaar element.
 */
export function DocumentTabControl({
  card,
  index,
  closeLabel,
  tabRef,
  onSelect,
  onKeyDown,
  onClose,
}: DocumentTabControlProps) {
  return (
    <div className="ops-tab-group" role="presentation">
      <button
        ref={tabRef}
        id={documentTabId(card.id)}
        type="button"
        role="tab"
        aria-label={card.title}
        aria-controls={DOCUMENT_TABPANEL_ID}
        aria-selected={card.isActive}
        tabIndex={card.isActive ? 0 : -1}
        className={`ops-tab${card.isActive ? ' active' : ''}`}
        style={{ ['--doc-color' as string]: card.color } as React.CSSProperties}
        title={card.fileName ?? card.title}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        data-ops-tab={card.id}
        data-ops-tab-index={index + 1}
        data-testid="document-tab"
      >
        <span className="ops-dot" aria-hidden="true" />
        <span className="ops-tab-name" aria-hidden="true">{card.title}</span>
        {card.isDirty && <span className="ops-dirty-dot" aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="ops-tab-close"
        title={closeLabel}
        aria-label={`${closeLabel} ${card.title}`}
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
