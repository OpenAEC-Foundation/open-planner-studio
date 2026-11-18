import { useAppStore, type AppState } from '@/state/appStore';
import { uniqueTaskIds, type ViewRow } from '@/engine/view/visibleRows';
import { relationAddVerdict, type RelationAddRejection } from '@/state/relationRules';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { NotificationMessageKey, RelationAssignDirection } from '@/state/slices/types';
import { cycleLabel } from '@/state/notificationLabels';
import { refusalNotice } from '@/state/refusalNotice';
import { withTransaction } from '@/state/batchTransaction';

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
 * (eigenaarsbesluit 2026-10-12): die is in de Gantt en de tabel al te zien. Elke route die een
 * relatie legt (de Gantt-popover, het relatiepaneel, de keten van de lintknop en Ctrl+F2) gaat via
 * {@link createRelationDraftWithFeedback} door één deur, met het meldingenkanaal als uitgang; deze
 * variant is de korte vorm voor één relatie zonder lag.
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

/**
 * Meerdere relaties in één gebaar (issue #888, het relatiepaneel): elke relatie gaat door dezelfde
 * deur als {@link createRelationDraftWithFeedback}, op volgorde, zodat ook een kring met een eerdere
 * relatie uit dezelfde reeks geweigerd wordt. Wat mag komt erbij als ÉÉN undo-stap; een weigering
 * meldt zich en houdt de rest niet tegen. Bij één relatie geen batch: dan maakt een weigering geen
 * lege undo-stap en heet de stap zoals elke losse relatie.
 *
 * @returns per relatie de nieuwe id, of `null` wanneer zij geweigerd is.
 */
export function createRelationsWithFeedback(relations: readonly Omit<Sequence, 'id'>[]): (string | null)[] {
  if (relations.length <= 1) return relations.map(createRelationDraftWithFeedback);
  const st = useAppStore.getState();
  // Vooraf toetsen of er iets doorkomt: een batch waarin alles geweigerd wordt laat anders een lege
  // undo-stap achter. De echte toets blijft per relatie in `addSequence`.
  const anyAllowed = relations.some(rel => relationAddVerdict(st.tasks, st.sequences, rel).ok);
  if (!anyAllowed) return relations.map(createRelationDraftWithFeedback);
  return withTransaction(() => relations.map(createRelationDraftWithFeedback), 'Relaties toevoegen');
}

/**
 * Staat elke geselecteerde taak in een rij op het scherm? Een filter of een ingeklapte fase kan een
 * taak verbergen nadat hij gekozen is; koppelen zou dan een keten leggen die de planner niet ziet
 * (review #1004). Lint en Ctrl+F2 koppelen alleen als dit klopt.
 */
export function selectionInView(state: Pick<AppState, 'selectedTaskIds' | 'viewRows'>): boolean {
  const visible = new Set(uniqueTaskIds(state.viewRows));
  return state.selectedTaskIds.every(taskId => visible.has(taskId));
}

/**
 * De gekozen taken in de volgorde OP HET SCHERM (filter, sortering, groepering), of `null` als die
 * volgorde niet vastligt. Bij groeperen op resource staat een taak in elke ploeg; staat ze dan zowel
 * vóór als na een andere gekozen taak, dan is elke keuze een gok die een relatie kan omdraaien
 * (review #1004, ronde 6). Vast is de volgorde als de rijen van elke gekozen taak samen een blok
 * vormen dat niet overlapt met dat van een andere. Taken die niet in beeld staan vallen weg.
 */
export function chainOrder(rows: readonly ViewRow[], taskIds: readonly string[]): string[] | null {
  const chosen = new Set(taskIds);
  // Per taak de eerste en laatste plaats in de lijst; een mijlpalenreeks telt elk lid apart.
  const span = new Map<string, { first: number; last: number }>();
  let position = 0;
  for (const taskId of rows.flatMap(row => uniqueTaskIds([row]))) {
    if (chosen.has(taskId)) {
      const seen = span.get(taskId);
      if (seen) seen.last = position; else span.set(taskId, { first: position, last: position });
    }
    position++;
  }
  // `span` staat al in de volgorde van het eerste voorkomen.
  const ordered = [...span];
  return ordered.every(([, at], index) => index === 0 || ordered[index - 1][1].last < at.first)
    ? ordered.map(([taskId]) => taskId)
    : null;
}

/**
 * Koppel taken als keten, Eind-Start zonder lag (issue #1000): Ctrl+F2 in MS Project, "Link
 * Activities" in Primavera. De keten volgt de volgorde op het scherm ({@link chainOrder}), niet die
 * van klikken: de klikvolgorde liep tussen tijdlijn en takenlijst uiteen (review #1004, ronde 5).
 * Ligt die volgorde niet vast, dan geen keten maar een melding. De aanroepers koppelen alleen als
 * alles in beeld staat ({@link selectionInView}). Elke schakel gaat door
 * {@link createRelationsWithFeedback}: één undo-stap, en een bestaande of verboden schakel meldt zich
 * zonder de rest tegen te houden.
 */
export function linkTasksInChain(taskIds: readonly string[]): (string | null)[] {
  const st = useAppStore.getState();
  const ordered = chainOrder(st.viewRows, taskIds);
  if (!ordered) {
    st.notify(refusalNotice({
      messageKey: 'notifications.relationChainOrderUnclear',
      dedupeKey: 'relation-chain-order-unclear',
    }));
    return [];
  }
  return createRelationsWithFeedback(ordered.slice(1).map((successorId, index) => ({
    predecessorId: ordered[index],
    successorId,
    type: 'FINISH_START' as const,
    lagDays: 0,
  })));
}

/**
 * Open het toewijzen van voorgangers of opvolgers voor één taak (issue #1000, "Assign" in
 * Primavera): de taak wordt de selectie, het eigenschappenpaneel gaat open (`setUI` klapt de rail
 * dan ook uit) en de relatiesectie opent haar keuzerij met deze richting. Verandert het document niet.
 */
export function requestRelationAssign(taskId: string, direction: RelationAssignDirection, rowKey?: string): void {
  const st = useAppStore.getState();
  // Een selectie kan na Ongedaan naar een verdwenen taak wijzen (`selectedTaskIds` zit niet in de
  // undo-snapshot); dan geen verzoek dat blijft hangen tot Opnieuw de taak terugbrengt.
  if (!st.tasks.some(task => task.id === taskId)) return;
  // Met de rij van het rechtsklikmenu: de taak op die rij, ook als ze al gekozen was op een andere rij
  // (review #1004, ronde 8). Zonder rij (lint) een taak die al de selectie is niet opnieuw kiezen: dat
  // zou het Shift-anker en de gekozen rij wissen (ronde 7).
  const alreadySelected = st.activeTaskId === taskId && st.selectedTaskIds.length === 1 && st.selectedTaskIds[0] === taskId;
  if (rowKey !== undefined) st.selectTask(taskId, false, false, { rowKey });
  else if (!alreadySelected) st.selectTask(taskId, false);
  st.setUI({ showPropertiesPanel: true, pendingRelationAssign: { taskId, direction } });
}
