import { useAppStore } from '@/state/appStore';
import { relationAddVerdict, type RelationAddRejection } from '@/state/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { NotificationMessageKey } from '@/state/slices/types';
import { cycleLabel } from '@/state/notificationLabels';
import { refusalNotice } from '@/state/refusalNotice';

/** Welke melding hoort bij een weigering? `self` is via de UI niet te maken: de selectie is een
 *  Set-unie en de Gantt-sleep guardt op een ander doel. `unknown-task` is wél bereikbaar, maar
 *  alleen via een randgeval — `selectedTaskIds` staat op `snapshot: 'none'`, dus redo kan een
 *  selectie achterlaten die naar een verwijderde taak wijst. Beide vallen op de duplicaat-tekst
 *  terug: een eigen sleutel voor een toestand die de gebruiker niet kan begrijpen of herstellen
 *  helpt niemand. */
const REJECTION_MESSAGE: Record<RelationAddRejection, NotificationMessageKey> = {
  duplicate: 'notifications.relationDuplicate',
  ancestor: 'notifications.relationAncestorEndpoint',
  cycle: 'notifications.relationCycle',
  self: 'notifications.relationDuplicate',
  'unknown-task': 'notifications.relationDuplicate',
};

/**
 * Relatie aanmaken MÉT gebruikerszichtbare terugkoppeling.
 *
 * Waarom deze wrapper bestaat: `addSequence` weigert stil (geen mutatie, geen undo-stap), dus zonder
 * wrapper gebeurt er bij een weigering zichtbaar niets. Een geslaagde relatie meldt zich bewust niet
 * (eigenaarsbesluit 2026-10-12): die is in de Gantt en de tabel al te zien. Alle callsites die met één gebaar een
 * Eind-Start-relatie leggen (de lint-knop bij 2 selecties, de knop in het Relaties-paneel, het
 * slepen in de Gantt) gaan hier door één deur, met het meldingenkanaal als uitgang.
 *
 * De REDEN komt uit `relationAddVerdict`, dezelfde pure functie die `addSequence` zelf gebruikt als
 * handhavingsgrens. Twee aanroepen van een pure functie is goedkoper dan de reden door het
 * retourtype van de store-actie heen vlechten — dat zou het extensie-API-oppervlak onnodig
 * ingewikkeld maken. De REGEL staat op één plek; alleen de aanroep staat er twee keer.
 *
 * @returns de id van de nieuwe relatie, of `null` wanneer hij geweigerd is.
 */
export function createRelationWithFeedback(
  predecessorId: string,
  successorId: string,
  type: SequenceType = 'FINISH_START',
): string | null {
  return createRelationDraftWithFeedback({ predecessorId, successorId, type, lagDays: 0 });
}

/**
 * Zelfde validatie en terugkoppeling als {@link createRelationWithFeedback}, maar voor een relatie
 * die de Gantt-popover eerst lokaal heeft samengesteld. Daardoor wordt type én lag als één
 * undoable projectmutatie vastgelegd en kan Escape de conceptrelatie weggooien zonder herstelwerk.
 */
export function createRelationDraftWithFeedback(relation: Omit<Sequence, 'id'>): string | null {
  const st = useAppStore.getState();
  const verdict = relationAddVerdict(st.tasks, st.sequences, relation);
  if (!verdict.ok) {
    st.notify(refusalNotice({
      messageKey: REJECTION_MESSAGE[verdict.reason],
      // Een kring noemt zijn taken: "Fundering → Grondwerk → Fundering" zegt meteen welke bestaande
      // relatie de gebruiker eerst moet omdraaien of weghalen.
      ...(verdict.reason === 'cycle'
        ? { params: { cycle: cycleLabel(st.tasks, verdict.cycle) } }
        : {}),
      // Samenvouwen: herhaald op dezelfde knop rammen levert één regel met een teller op.
      dedupeKey: `relation-rejected-${verdict.reason}`,
    }));
    return null;
  }

  // Een geslaagde relatie meldt zich niet: de pijl in de Gantt en de kolom Voorgangers tonen hem al
  // (eigenaarsbesluit 2026-10-12, toast "Relatie aangemaakt" weg). Alleen een weigering meldt zich.
  return st.addSequence(relation);
}
