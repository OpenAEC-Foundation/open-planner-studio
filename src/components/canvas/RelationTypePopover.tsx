import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { SequenceType, SEQUENCE_TYPE_OPTIONS, type Sequence } from '@/types/sequence';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { RelationSentence, relationSentenceName } from '@/components/common/RelationSentence';
import { Select } from '@/components/common/Select';
import { useAppStore } from '@/state/appStore';

export interface RelationTypePopoverProps {
  sourceTaskId: string;
  targetTaskId: string;
  x: number;
  y: number;
  onCommit: (relation: Omit<Sequence, 'id'>) => void;
  onCancel: () => void;
}

export function RelationTypePopover({
  sourceTaskId,
  targetTaskId,
  x,
  y,
  onCommit,
  onCancel,
}: RelationTypePopoverProps) {
  const { t } = useTranslation('task');
  const popoverRef = useRef<HTMLDivElement>(null);
  const predecessor = useAppStore(s => s.tasks.find(task => task.id === sourceTaskId));
  const successor = useAppStore(s => s.tasks.find(task => task.id === targetTaskId));
  const [draft, setDraft] = useState<Omit<Sequence, 'id'>>({
    predecessorId: sourceTaskId,
    successorId: targetTaskId,
    type: 'FINISH_START',
    lagDays: 0,
  });
  const sequence = useMemo<Sequence>(() => ({ id: 'relation-draft', ...draft }), [draft]);

  const [committing, setCommitting] = useState(false);
  const committed = useRef(false);
  const commit = () => setCommitting(true);
  useEffect(() => {
    if (!committing || committed.current) return;
    committed.current = true;
    onCommit(draft);
  }, [committing, draft, onCommit]);

  useClickOutside(popoverRef, commit, true, { defer: true });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if ((event.target as Element | null)?.closest?.('[aria-expanded="true"]')) return;
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        commit();
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onCancel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      popoverRef.current?.querySelector<HTMLButtonElement>('.ops-select__trigger')?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const adjustedX = Math.min(x, window.innerWidth - 300);
  const adjustedY = Math.min(y, window.innerHeight - 130);

  return (
    <div
      ref={popoverRef}
      data-ops-relation-popover
      className="fixed z-[var(--z-contextmenu)] bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] p-2.5 flex flex-col gap-2 min-w-[200px] max-w-[280px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <span className="!text-small font-semibold uppercase tracking-wide text-text-secondary">
        {t('properties.relationPopoverTitle')}
      </span>
      <div className="flex items-center gap-2">
        <Select
          value={sequence.type}
          aria-label={t('properties.relationPopoverTitle')}
          options={SEQUENCE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={value => setDraft(current => ({ ...current, type: value as SequenceType }))}
          className="ops-select__trigger--compact !w-20"
        />
        <SequenceLagInput
          seq={sequence}
          title={t('properties.lag')}
          className="input !text-small !px-1.5 !py-0 !h-6 !w-16 text-right"
          onCommit={patch => setDraft(current => ({ ...current, ...patch }))}
          onDraftChange={patch => setDraft(current => ({ ...current, ...patch }))}
        />
      </div>
      <RelationSentence
        type={sequence.type}
        predecessorName={relationSentenceName(predecessor)}
        successorName={relationSentenceName(successor)}
      />
    </div>
  );
}
