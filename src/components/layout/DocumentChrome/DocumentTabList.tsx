import type { Ref } from 'react';
import type { DocumentCard } from './useDocumentCards';
import { DocumentTabControl } from './DocumentTabControl';
import {
  handleDocumentTabKeyDown,
  type DocumentTabDirection,
} from './documentTabNavigation';

interface DocumentTabListProps {
  cards: DocumentCard[];
  direction: DocumentTabDirection;
  tablistLabel: string;
  closeLabel: string;
  tabRef: (documentId: string, element: HTMLButtonElement | null) => void;
  switchTo: (documentId: string) => void;
  focusTab: (documentId: string) => void;
  closeWithGuard: (card: Pick<DocumentCard, 'id' | 'isDirty'>) => void;
}

/** De werkelijk gebruikte, prop-gedreven eventroute voor alle zichtbare documenttabs. */
export function DocumentTabList({
  cards,
  direction,
  tablistLabel,
  closeLabel,
  tabRef,
  switchTo,
  focusTab,
  closeWithGuard,
}: DocumentTabListProps) {
  const documentIds = cards.map(card => card.id);
  return (
    <div className="ops-tabstrip-tabs" role="tablist" aria-label={tablistLabel}>
      {cards.map((card, index) => (
        <DocumentTabControl
          key={card.id}
          card={card}
          index={index}
          closeLabel={closeLabel}
          tabRef={((element) => { tabRef(card.id, element); }) as Ref<HTMLButtonElement>}
          onSelect={(event) => { switchTo(card.id); event.currentTarget.focus(); }}
          onKeyDown={(event) => {
            handleDocumentTabKeyDown(event, documentIds, card.id, direction, { switchTo, focusTab });
          }}
          onClose={(event) => { event.stopPropagation(); closeWithGuard(card); }}
        />
      ))}
    </div>
  );
}
