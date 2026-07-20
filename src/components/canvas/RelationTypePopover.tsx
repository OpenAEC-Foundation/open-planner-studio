import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useAppStore } from '@/state/appStore';
import { SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';

export interface RelationTypePopoverProps {
  /** Id van de zojuist aangemaakte sequence (FS + lag 0 default — zie GanttCanvas). */
  sequenceId: string;
  /** Drop-positie (`e.clientX/clientY` van de mouseup die de relatie aanmaakte). */
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Fase 2.10 (item 3): kleine zwevende popover die verschijnt direct na het slepen van een
 * afhankelijkheid, zodat het relatietype (FS/SS/FF/SF) en de lag meteen te corrigeren zijn zonder
 * eerst het eigenschappenpaneel te openen. De sequence bestaat al (FS+lag0, aangemaakt door de
 * aanroeper) — een keuze hier is een `updateSequence`-patch; niets kiezen (klik-buiten/Escape)
 * laat de FS-default gewoon staan (geen regressie t.o.v. het oude hardcoded gedrag).
 *
 * Positionering/sluitgedrag naar `ContextMenu`-patroon: viewport-clamping, gedeferde
 * mousedown/Escape-listener (zodat de openende mouseup-klik het menu niet meteen weer sluit), en
 * dezelfde `--z-contextmenu`-laag.
 */
export function RelationTypePopover({ sequenceId, x, y, onClose }: RelationTypePopoverProps) {
  const { t } = useTranslation('task');
  const sequence = useAppStore(s => s.sequences.find(seq => seq.id === sequenceId));
  const updateSequence = useAppStore(s => s.updateSequence);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Kleine defer, zelfde reden als ContextMenu: de mouseup die deze popover opent mag 'm niet
  // meteen weer sluiten via dezelfde event-cyclus. Escape sluit ook (hook houdt `onClose` actueel).
  useClickOutside(popoverRef, onClose, true, { escape: true, defer: true });

  // Sequence kan (in theorie) al verwijderd zijn vóór de popover sluit — niets te tonen dan.
  if (!sequence) return null;

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
            blijft de vaste `w-16`. */}
        <select
          autoFocus
          value={sequence.type}
          onChange={e => updateSequence(sequence.id, { type: e.target.value as SequenceType })}
          className="input !text-[11px] !px-1.5 !py-1"
        >
          {SEQUENCE_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <SequenceLagInput
          seq={sequence}
          title={t('properties.lag')}
          className="input !text-[11px] !px-1.5 !py-1 w-16 text-right"
          onCommit={patch => updateSequence(sequence.id, patch)}
        />
      </div>
    </div>
  );
}
