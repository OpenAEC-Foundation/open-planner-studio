import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ListTree } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { isTreeMode } from '@/engine/view/visibleRows';

/**
 * Niet-blokkerende melding (issue #26): een structuurmutatie (in-/uitspringen, doorlopend invoeren)
 * is geweigerd omdat de weergave niet in pure boommodus staat — er wordt gefilterd, gegroepeerd of
 * gesorteerd. Voorheen gebeurde er in dat geval stil niets; deze strook vertelt waaróm en biedt aan
 * de drie view-standen te wissen. `ui.structureLockedNotice` is een TELLER: elke nieuwe poging hoogt
 * hem op, zodat de melding ook opnieuw verschijnt (en de verdwijn-timer herstart) als hij al stond.
 */
export function StructureLockedNotice() {
  const { t } = useTranslation('common');
  const seq = useAppStore((s) => s.ui.structureLockedNotice);
  const setFilter = useAppStore((s) => s.setFilter);
  const setGroup = useAppStore((s) => s.setGroup);
  const setSort = useAppStore((s) => s.setSort);
  // De strook zelf is app-globaal (`ui.structureLockedNotice` wordt niet per document geswapt),
  // maar de standen die "Wissen" opruimt zijn dat WÉL. Daarom hangen we hem aan het actieve
  // document en aan de boommodus.
  const activeDocumentId = useAppStore((s) => s.activeDocumentId);
  const treeMode = useAppStore((s) => isTreeMode(s.view));
  const [visible, setVisible] = useState(false);

  // Documentwissel ⇒ meteen verbergen. Anders blijft de strook (6 s lang) boven een ANDER document
  // hangen en wist "Wissen" daar filter/groepering/sortering — en dat is niet terug te draaien,
  // want de view-standen zitten niet in de undo-stack (`snapshot: 'none'`).
  // Bewust vóór het teller-effect gedeclareerd: bij mount lopen effecten in volgorde, en dit mag
  // een zojuist getoonde strook niet alsnog wegdrukken.
  useEffect(() => {
    setVisible(false);
  }, [activeDocumentId]);

  // Staat de weergave weer in pure boommodus, dan klopt de melding niet meer (de gebruiker heeft
  // het filter zelf al opgeheven, of het document eronder is een ander) — dus weg ermee.
  useEffect(() => {
    if (treeMode) setVisible(false);
  }, [treeMode]);

  // Elke opgehoogde teller toont de strook en (her)start de verdwijn-timer van 6 s.
  useEffect(() => {
    if (seq === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [seq]);

  if (!visible) return null;

  const clearView = () => {
    // Drie losse setters — er is geen gecombineerde clear-actie. Elk van deze roept intern al
    // recomputeViewRows() aan.
    setFilter(null);
    setGroup([]);
    setSort([]);
    setVisible(false);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-small leading-4 border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      data-ops-structure-locked
    >
      <ListTree size={14} className="shrink-0 text-accent" />
      <span className="flex-1">{t('view.structureLockedHint')}</span>
      <button onClick={clearView} className="btn btn--sm btn--primary" data-ops-structure-locked-clear>
        {t('view.filter.clear')}
      </button>
      <button
        onClick={() => setVisible(false)}
        className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
        title={t('close')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
