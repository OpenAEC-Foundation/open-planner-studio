import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { isTreeMode } from '@/engine/view/visibleRows';
import { clearViewArrangement } from '@/state/viewArrangement';
import { NoticeStrip } from './NoticeStrip';

/**
 * Weigering (eigenaarsbesluit 2026-10-17: rood, `role="alert"`, blijft tot het kruisje): een structuurmutatie (in-/uitspringen, doorlopend invoeren)
 * is geweigerd omdat de weergave niet in pure boommodus staat — er wordt gefilterd, gegroepeerd of
 * gesorteerd. Deze strook vertelt waaróm (in plaats van stil niets te doen) en biedt aan
 * de drie view-standen te wissen. `ui.structureLockedNotice` is een TELLER: elke nieuwe poging hoogt
 * hem op, zodat de melding ook opnieuw verschijnt als hij weggeklikt was. Geen verdwijn-timer: een
 * weigering die vanzelf weggaat, is te missen.
 *
 * Wel weg na een undo- of redo-stap en bij een documentwissel, net als elke andere weigering
 * (eigenaarsbesluit 2026-10-19 5b, `clearRefusals` in state/refusalNotice.ts).
 *
 * *Taak* met een selectie gebruikt deze strook NIET meer (eigenaarsbesluit 2026-10-19 5a): die taak
 * komt er wél, achteraan, en meldt dat met een rode toast. De strook blijft voor wat echt geweigerd
 * wordt: in-/uitspringen, rijslepen, *Invoegen boven/onder* (Insert, Ctrl+I).
 */
export function StructureLockedNotice() {
  const { t } = useTranslation('common');
  const seq = useAppStore((s) => s.ui.structureLockedNotice);
  const clearedAt = useAppStore((s) => s.ui.structureLockedClearedAt);
  // De strook zelf is app-globaal (`ui.structureLockedNotice` wordt niet per document geswapt),
  // maar de standen die "Wissen" opruimt zijn dat WÉL. Daarom hangen we hem aan het actieve
  // document en aan de boommodus.
  const activeDocumentId = useAppStore((s) => s.activeDocumentId);
  const treeMode = useAppStore((s) => isTreeMode(s.view));
  const [visible, setVisible] = useState(false);

  // Documentwissel ⇒ meteen verbergen. Anders blijft de strook boven een ANDER document
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

  // Elke opgehoogde teller toont de strook; hij blijft tot het kruisje, "Wissen", een
  // documentwissel of de terugkeer naar boommodus.
  useEffect(() => {
    if (seq === 0) return;
    setVisible(true);
  }, [seq]);

  // Undo, redo of documentwissel ⇒ `clearRefusals` zet `clearedAt` op de huidige teller ⇒ weg.
  // BEWUST ná het teller-effect en met de vergelijking `clearedAt === seq`: een poging die ná het
  // wissen kwam, hoogde de teller daarboven op en blijft staan (eerst wissen, dan melden), ook als
  // React beide wijzigingen in één commit verwerkt.
  useEffect(() => {
    if (clearedAt === seq) setVisible(false);
  }, [clearedAt, seq]);

  if (!visible) return null;

  const clearView = () => {
    clearViewArrangement(useAppStore.getState());
    setVisible(false);
  };

  return (
    <NoticeStrip
      icon="status.structure-locked"
      text={t('view.structureLockedHint')}
      actionLabel={t('view.filter.clear')}
      onAction={clearView}
      onDismiss={() => setVisible(false)}
      role="alert"
      tone="error"
      stripProps={{ 'data-ops-structure-locked': true }}
      actionProps={{ 'data-ops-structure-locked-clear': true }}
    />
  );
}
