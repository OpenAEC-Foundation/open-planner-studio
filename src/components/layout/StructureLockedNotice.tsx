import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTree } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { isTreeMode } from '@/engine/view/visibleRows';
import { NoticeStrip } from './NoticeStrip';

/**
 * Niet-blokkerende melding: een structuurmutatie (in-/uitspringen, doorlopend invoeren)
 * is geweigerd omdat de weergave niet in pure boommodus staat — er wordt gefilterd, gegroepeerd of
 * gesorteerd. Deze strook vertelt waaróm (in plaats van stil niets te doen) en biedt aan
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
    <NoticeStrip
      icon={ListTree}
      text={t('view.structureLockedHint')}
      actionLabel={t('view.filter.clear')}
      onAction={clearView}
      onDismiss={() => setVisible(false)}
      stripProps={{ 'data-ops-structure-locked': true }}
      actionProps={{ 'data-ops-structure-locked-clear': true }}
    />
  );
}
