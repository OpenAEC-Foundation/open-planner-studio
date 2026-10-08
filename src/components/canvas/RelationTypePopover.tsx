import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { SequenceType, SEQUENCE_TYPE_OPTIONS, type Sequence } from '@/types/sequence';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { RelationSentence, relationSentenceName } from '@/components/common/RelationSentence';
import { Select } from '@/components/common/Select';
import { useAppStore } from '@/state/appStore';

export interface RelationTypePopoverProps {
  /** Eindpunten van de nog niet vastgelegde relatie. */
  sourceTaskId: string;
  targetTaskId: string;
  /** Drop-positie (`e.clientX/clientY` van de mouseup die de relatie aanmaakte). */
  x: number;
  y: number;
  /** Normaal sluiten bewaart de samengestelde relatie als één projectmutatie. */
  onCommit: (relation: Omit<Sequence, 'id'>) => void;
  /** Escape laat de projectstaat en de undo-geschiedenis ongemoeid. */
  onCancel: () => void;
}

/**
 * Kleine zwevende popover die verschijnt direct na het slepen van een
 * afhankelijkheid, zodat het relatietype (FS/SS/FF/SF) en de lag meteen te corrigeren zijn zonder
 * eerst het eigenschappenpaneel te openen. De relatie is hier nog een lokaal concept: Enter of
 * klik-buiten bewaart de default of correctie als één mutatie, Escape gooit het concept volledig weg.
 *
 * Positionering/sluitgedrag naar `ContextMenu`-patroon: viewport-clamping, gedeferde
 * mousedown/Escape-listener (zodat de openende mouseup-klik het menu niet meteen weer sluit), en
 * dezelfde `--z-contextmenu`-laag.
 */
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

  // Vastleggen loopt via een vlag en een effect: bij Enter in het lagveld zet dat veld zijn waarde
  // in dezelfde toetsaanslag nog in het concept, en het effect leest pas het concept ná die render.
  // De vlag voorkomt ook een tweede relatie wanneer Enter en een klik-buiten samenvallen.
  const [committing, setCommitting] = useState(false);
  const committed = useRef(false);
  const commit = () => setCommitting(true);
  useEffect(() => {
    if (!committing || committed.current) return;
    committed.current = true;
    onCommit(draft);
  }, [committing, draft, onCommit]);

  // Kleine defer, zelfde reden als ContextMenu: de mouseup die deze popover opent mag 'm niet
  // meteen weer sluiten via dezelfde event-cyclus. Een klik-buiten bevestigt het bestaande
  // standaardgedrag; Escape is expliciet annuleren en krijgt daarom een eigen capture-listener.
  useClickOutside(popoverRef, commit, true, { defer: true });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      // Enter = klaar (in plaats van ernaast te moeten klikken). Op documentniveau, net als
      // Escape: na het slepen staat de
      // focus niet altijd in de popover. Bewust zonder stopPropagation: het lagveld zet bij Enter zijn
      // waarde nog in het concept, en `commit` leest dat pas na de render (zie hierboven).
      // Staat de keuzelijst van het type open, dan zijn Enter en Escape van die lijst: kiezen of
      // alleen de lijst sluiten. Pas daarna betekenen ze weer "vastleggen" of "annuleren".
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

  // Na het slepen staat de focus op de typekeuze, zodat pijltjes en Enter meteen werken. Uitgesteld:
  // de klik die bij de loslatende mouseup hoort, zet de focus anders terug op het canvas.
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
        {/* De typekeuze is de gedeelde `Select`, geen native `<select>` (review 2026-10-06). De
            lag-input houdt `!w-16` en niet `w-16`: `.input` staat in `globals.css` buiten elke
            cascade-layer met `width: 100%`, en unlayered CSS wint van de Tailwind-utilities. */}
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
