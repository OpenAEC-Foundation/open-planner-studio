import { useAppStore } from '@/state/appStore';
import { relationVerdict, type RelationRejection } from '@/state/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { NotificationMessageKey } from '@/state/slices/types';

/** Namen in een melding blijven leesbaar: langere taaknamen worden afgekapt. */
const MAX_NAME = 40;
const shortName = (name: string | undefined) =>
  !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;

/** Welke melding hoort bij een weigering? `self` is via de UI niet te maken: de selectie is een
 *  Set-unie en de Gantt-sleep guardt op een ander doel. `unknown-task` is wél bereikbaar, maar
 *  alleen via een randgeval — `selectedTaskIds` staat op `snapshot: 'none'`, dus redo kan een
 *  selectie achterlaten die naar een verwijderde taak wijst. Beide vallen op de duplicaat-tekst
 *  terug: een eigen sleutel voor een toestand die de gebruiker niet kan begrijpen of herstellen
 *  helpt niemand. */
const REJECTION_MESSAGE: Record<RelationRejection, NotificationMessageKey> = {
  duplicate: 'notifications.relationDuplicate',
  ancestor: 'notifications.relationAncestorEndpoint',
  self: 'notifications.relationDuplicate',
  'unknown-task': 'notifications.relationDuplicate',
};

/**
 * Relatie aanmaken MÉT gebruikerszichtbare terugkoppeling (issue #40).
 *
 * Waarom deze wrapper bestaat: `addSequence` weigert stil (geen mutatie, geen undo-stap). Alle drie
 * de callsites die met één gebaar een Eind-Start-relatie leggen (de lint-knop bij 2 selecties, de
 * knop in het Relaties-paneel, en het slepen in de Gantt) hadden daardoor exact hetzelfde symptoom
 * als de gemelde bug: er gebeurt zichtbaar niets. Hier gaat dat door één deur, met het
 * gecentraliseerde meldingenkanaal (bevinding K8) als uitgang.
 *
 * De REDEN komt uit `relationVerdict`, dezelfde pure functie die `addSequence` zelf gebruikt als
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
  const lookup = (id: string) => st.tasks.find((t) => t.id === id);
  const verdict = relationVerdict(lookup, st.sequences, relation);
  if (!verdict.ok) {
    st.notify({
      severity: 'info',
      messageKey: REJECTION_MESSAGE[verdict.reason],
      // Samenvouwen: herhaald op dezelfde knop rammen levert één regel met een teller op.
      dedupeKey: `relation-rejected-${verdict.reason}`,
    });
    return null;
  }

  const id = st.addSequence(relation);
  if (id === null) return null; // de slice weigerde alsnog: geen succesmelding over een relatie die er niet is.
  const after = useAppStore.getState();
  after.notify({
    severity: 'info',
    messageKey: 'notifications.relationCreated',
    params: {
      predecessor: shortName(after.tasks.find((t) => t.id === relation.predecessorId)?.name),
      successor: shortName(after.tasks.find((t) => t.id === relation.successorId)?.name),
    },
  });
  return id;
}
