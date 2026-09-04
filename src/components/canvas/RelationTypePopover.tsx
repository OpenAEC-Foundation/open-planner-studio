import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { SequenceType, SEQUENCE_TYPE_OPTIONS, type Sequence } from '@/types/sequence';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';

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
 * Fase 2.10 (item 3): kleine zwevende popover die verschijnt direct na het slepen van een
 * afhankelijkheid, zodat het relatietype (FS/SS/FF/SF) en de lag meteen te corrigeren zijn zonder
 * eerst het eigenschappenpaneel te openen. De relatie is hier nog een lokaal concept: klik-buiten
 * bewaart de default of correctie als één mutatie, Escape gooit het concept volledig weg.
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
  const [draft, setDraft] = useState<Omit<Sequence, 'id'>>({
    predecessorId: sourceTaskId,
    successorId: targetTaskId,
    type: 'FINISH_START',
    lagDays: 0,
  });
  const sequence = useMemo<Sequence>(() => ({ id: 'relation-draft', ...draft }), [draft]);

  const commit = () => onCommit(draft);

  // Kleine defer, zelfde reden als ContextMenu: de mouseup die deze popover opent mag 'm niet
  // meteen weer sluiten via dezelfde event-cyclus. Een klik-buiten bevestigt het bestaande
  // standaardgedrag; Escape is expliciet annuleren en krijgt daarom een eigen capture-listener.
  useClickOutside(popoverRef, commit, true, { defer: true });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onCancel]);

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 100);

  return (
    <div
      ref={popoverRef}
      className="fixed z-[var(--z-contextmenu)] bg-surface border border-border rounded-[8px] shadow-[var(--shadow-pop)] p-2.5 flex flex-col gap-2 min-w-[200px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        {t('properties.relationPopoverTitle')}
      </span>
      <div className="flex items-center gap-2">
        {/* QA-fix (fase 2.10, onderdeel 2, bevinding 2): GEEN `flex-1` op een native `<select>` in
            een flex-rij — dat zet flex-basis op 0%, dus het vakje krimpt tot ~11.75px (tekst
            onzichtbaar). Zelfde patroon als `TaskDependenciesSection` (properties.dependencies-
            rij): het select-vakje krijgt zijn natuurlijke content-breedte, de lag-input ernaast
            blijft de vaste breedte. Die breedte moet `!w-16` zijn en niet `w-16`: `.input` staat
            in `globals.css` buiten elke cascade-layer met `width: 100%`, en unlayered CSS wint van
            de Tailwind-utilities in `@layer utilities` — zonder `!` deed de breedte niets en
            vochten beide vakjes om dezelfde 100%. */}
        <select
          autoFocus
          value={sequence.type}
          onChange={e => setDraft(current => ({ ...current, type: e.target.value as SequenceType }))}
          className="input !text-[11px] !px-1.5 !py-1"
        >
          {SEQUENCE_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <SequenceLagInput
          seq={sequence}
          title={t('properties.lag')}
          className="input !text-[11px] !px-1.5 !py-1 !w-16 text-right"
          onCommit={patch => setDraft(current => ({ ...current, ...patch }))}
          onDraftChange={patch => setDraft(current => ({ ...current, ...patch }))}
        />
      </div>
    </div>
  );
}
