import { isDraft, original } from 'immer';
import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import type { TaskGridSurfaceId, TaskGridSurfacePreferences } from '@/types/taskGrid';
import type { LayoutOverlays, ViewState } from '@/types/view';
import type { AppState } from './appStore';
import { deriveViewRows } from './viewRows';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { ViewRow } from '@/engine/view/visibleRows';

export const MAX_SESSION_HISTORY_EVENTS_PER_SCOPE = 100;

/**
 * Geheugenplafond voor de hele sessiehistorie (eigenaarsbesluit 2026-09-28): boven deze GESCHATTE
 * omvang vallen de oudste stappen weg, ook binnen de honderd per scope. De nieuwste
 * `MIN_SESSION_HISTORY_EVENTS_PER_SCOPE` van elke scope blijven altijd staan, zodat een grote
 * bewerking nooit de laatste stappen onbereikbaar maakt. Daardoor is het GEEN harde bovengrens: met
 * veel open documenten of één stap groter dan het plafond blijft er meer staan; en één zware stap in
 * het ene document knipt de historie van de andere documenten terug tot hun nieuwste tien.
 */
export const MAX_SESSION_HISTORY_BYTES = 200 * 1024 * 1024;
export const MIN_SESSION_HISTORY_EVENTS_PER_SCOPE = 10;

/**
 * Schatting per gewijzigd element, gemeten (Node, 2000 taken, 20 stappen): een naam op alle taken
 * ≈ 280 B per taak; een bewerking met herberekening ≈ 1550 B per taak (nieuwe taakobjecten plus een
 * nieuw `cpmResult`); een baseline ≈ 176 B per vastgelegde taak (review 2026-09-28). Overige
 * elementen zijn niet gemeten en krijgen de taakschatting; `recordedDates` en de contourperiodes op
 * een taak tellen niet apart mee en worden dus onderschat.
 */
const BYTES_PER_CHANGED_ITEM = 300;
const BYTES_PER_CPM_TASK = 1250;
const BYTES_PER_BASELINE_TASK = 176;
const BYTES_PER_ARRAY_SLOT = 8;
const BYTES_PER_OTHER_CHANGE = 1024;

function snapshotChangeBytes(before: Snapshot, after: Snapshot): number {
  let bytes = 0;
  for (const key of Object.keys(after) as (keyof Snapshot)[]) {
    const a = after[key];
    const b = before[key];
    if (a === b) continue;
    if (Array.isArray(a)) {
      // Alleen elementen die niet al (als hetzelfde object) in de vorige versie zaten tellen als nieuw.
      // (Het echte vasthouden is ruimer: `after` komt uit `current()` en deelt voor gewijzigde objecten
      // niets met de volgende `before`; de geijkte constanten hierboven vangen dat op.)
      const old = new Set<unknown>(Array.isArray(b) ? b : []);
      let changed = 0;
      let baselineTasks = 0;
      for (const item of a) {
        if (old.has(item)) continue;
        changed++;
        if (key === 'baselines') baselineTasks += (item as { tasks?: unknown[] }).tasks?.length ?? 0;
      }
      bytes += a.length * BYTES_PER_ARRAY_SLOT + changed * BYTES_PER_CHANGED_ITEM + baselineTasks * BYTES_PER_BASELINE_TASK;
    } else if (key === 'cpmResult' && a) {
      bytes += ((a as NonNullable<Snapshot['cpmResult']>).tasks?.size ?? 0) * BYTES_PER_CPM_TASK;
    } else {
      bytes += BYTES_PER_OTHER_CHANGE;
    }
  }
  return bytes;
}

const eventBytesCache = new WeakMap<SessionHistoryEvent, number>();
/** Geschatte geheugenomvang die dit event vasthoudt bovenop zijn buren (events zijn onveranderlijk). */
export function estimateSessionHistoryEventBytes(draftOrEvent: SessionHistoryEvent): number {
  // Binnen een producer is het event een Immer-proxy: elke producer een nieuwe (de cache mist dan
  // altijd) en elke lezing een trap. Events zelf veranderen nooit, dus het origineel volstaat.
  const event = isDraft(draftOrEvent) ? (original(draftOrEvent) as SessionHistoryEvent) : draftOrEvent;
  const cached = eventBytesCache.get(event);
  if (cached !== undefined) return cached;
  let bytes = 0;
  for (const delta of event.deltas) {
    bytes += delta.kind === 'document-data' ? snapshotChangeBytes(delta.before, delta.after) : BYTES_PER_OTHER_CHANGE;
  }
  eventBytesCache.set(event, bytes);
  return bytes;
}

export type HistoryScopeKey = `document:${string}` | `grid:${TaskGridSurfaceId}`;

export type ViewLayoutHistoryState = Pick<
  ViewState,
  'filter' | 'group' | 'sort' | 'zoom' | 'scrollX' | 'timeScale' | 'collapsedGroupKeys'
  | 'showRelations' | 'layoutSession'
>;

export type SessionHistoryDelta =
  | {
      kind: 'document-data';
      documentId: string;
      before: Snapshot;
      after: Snapshot;
      /** Het event was GEEN bewerking (F5 of "toon opgeslagen datums" in de modus): undo/redo ervan
       *  laat `isDirty` en `importPristine` staan. Afwezig ⇒
       *  een gewone bewerking, en undo/redo markeert het document als bewerkt. */
      nonEdit?: true;
    }
  | {
      kind: 'document-view';
      documentId: string;
      before: ViewLayoutHistoryState;
      after: ViewLayoutHistoryState;
      /** Een layoutklik die ook de app-brede overlays zette. */
      overlays?: { before: LayoutOverlays; after: LayoutOverlays };
    }
  | {
      kind: 'grid-preference';
      surface: TaskGridSurfaceId;
      before: TaskGridSurfacePreferences;
      after: TaskGridSurfacePreferences;
    };

export type DocumentDataHistoryDelta = Extract<SessionHistoryDelta, { kind: 'document-data' }>;

export interface SessionHistoryEvent {
  id: string;
  sequence: number;
  label: string;
  state: 'applied' | 'undone';
  deltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]];
  /**
   * Herkomst binnen een BEWERKSESSIE (de taakdialoog, `historyMark`). Alleen de
   * interactieve UI-route (`finishUndoable` buiten batch en MCP-lease) stempelt hem; een MCP-,
   * batch- of extensie-event dat tijdens de open dialoog landt blijft ongestempeld, zodat
   * `revertHistorySince`/`squashHistorySince` het nooit meenemen.
   */
  sessionKey?: string;
}

export type HistoryTargetSide = 'before' | 'after';

export interface SessionHistoryDepths {
  undoDepth: number;
  redoDepth: number;
}

export type MaterializedHistoryTarget =
  | {
      kind: 'document-data';
      documentId: string;
      snapshot: Snapshot;
      viewRows: ViewRow[];
      resourceLoadResult: ResourceLoadResult | null;
      isDirty: true;
      /** `false` alleen voor een `nonEdit`-delta: dan wist het toepassen "ongewijzigd sinds import" niet. */
      clearImportPristine: boolean;
    }
  | {
      kind: 'document-view';
      documentId: string;
      view: ViewLayoutHistoryState;
      overlays?: LayoutOverlays;
      viewRows: ViewRow[];
      isDirty: false;
    }
  | {
      kind: 'grid-preference';
      surface: TaskGridSurfaceId;
      preferences: TaskGridSurfacePreferences;
      isDirty: false;
    };

/** Leg uitsluitend de undoable viewsubset vast; tijdelijke focus-/fit-/scrollY-state blijft erbuiten. */
export function captureViewLayoutHistoryState(view: Readonly<ViewState>): ViewLayoutHistoryState {
  return {
    filter: view.filter == null ? null : JSON.parse(JSON.stringify(view.filter)) as ViewState['filter'],
    group: view.group.map(level => ({ ...level, field: { ...level.field } })),
    sort: view.sort.map(level => ({ ...level, field: { ...level.field } })),
    zoom: view.zoom,
    scrollX: view.scrollX,
    timeScale: view.timeScale,
    collapsedGroupKeys: [...view.collapsedGroupKeys],
    // Beide sleutels staan er ALTIJD (ook als `undefined`), zodat undo van een layoutklik
    // ze via Object.assign terugzet; rauw overgenomen, zodat een ontbrekend veld ontbrekend blijft.
    showRelations: view.showRelations,
    layoutSession: view.layoutSession,
  };
}

/**
 * Bouw het volledige doel buiten de live store. Datahistory herstelt eerst alle snapshotbronnen en
 * de kalendercache op een ondiepe geïsoleerde state; pas daarna worden rijen en belasting afgeleid.
 * De handmatig berekende CPM-uitkomst en stale-vlag komen letterlijk uit het snapshot.
 */
export function materializeHistoryTarget(
  state: Readonly<AppState>,
  delta: SessionHistoryDelta,
  side: HistoryTargetSide,
): MaterializedHistoryTarget {
  if (delta.kind === 'document-data') {
    const isolated = { ...state } as AppState;
    restoreSnapshot(isolated, delta[side]);
    const snapshot = createSnapshot(isolated);
    return {
      kind: 'document-data',
      documentId: delta.documentId,
      snapshot,
      viewRows: deriveViewRows(isolated),
      resourceLoadResult: computeReliableResourceLoad(
        isolated.cpmResult,
        isolated.resources,
        isolated.assignments,
        isolated.tasks,
        isolated.calendar,
        isolated.calendars,
      ),
      isDirty: true,
      clearImportPristine: delta.nonEdit !== true,
    };
  }

  if (delta.kind === 'document-view') {
    const view = delta[side];
    const isolated = { ...state, view: { ...state.view, ...view } } as AppState;
    return {
      kind: 'document-view',
      documentId: delta.documentId,
      view,
      ...(delta.overlays ? { overlays: delta.overlays[side] } : {}),
      viewRows: deriveViewRows(isolated),
      isDirty: false,
    };
  }

  return {
    kind: 'grid-preference',
    surface: delta.surface,
    preferences: delta[side],
    isDirty: false,
  };
}

/**
 * Een event is de kleinste undo-eenheid. Twee documenten in hetzelfde event zouden nooit atomair
 * toepasbaar zijn wanneer maar één document actief kan zijn, en zijn daarom ongeldige input.
 */
export function assertValidSessionHistoryEvent(event: SessionHistoryEvent): void {
  if (event.deltas.length === 0) {
    throw new Error(`History-event ${event.id || '<zonder id>'} bevat geen deltas`);
  }
  // `sequence` is een oplopende sessieteller, geen willekeurig ranggetal. Met NaN zouden zowel
  // hoogste-undo als laagste-redo stil afhankelijk worden van arrayvolgorde; onveilige integers
  // kunnen bij het ophogen bovendien gelijk gaan lijken door IEEE-754-afronding.
  if (!Number.isSafeInteger(event.sequence) || event.sequence <= 0) {
    throw new Error(
      `History-event ${event.id || '<zonder id>'} heeft een ongeldige sequence: ${String(event.sequence)}`,
    );
  }

  const documentIds = new Set<string>();
  for (const delta of event.deltas) {
    if (delta.kind !== 'grid-preference') documentIds.add(delta.documentId);
  }
  if (documentIds.size > 1) {
    throw new Error(
      `History-event ${event.id || '<zonder id>'} raakt meerdere documenten: ${[...documentIds].join(', ')}`,
    );
  }
}

/** De enige afleiding van scopes. Events bewaren bewust geen tweede scopes-array. */
export function scopeKeysOf(event: SessionHistoryEvent): HistoryScopeKey[] {
  assertValidSessionHistoryEvent(event);
  const seen = new Set<HistoryScopeKey>();
  const scopes: HistoryScopeKey[] = [];

  for (const delta of event.deltas) {
    const scope: HistoryScopeKey = delta.kind === 'grid-preference'
      ? `grid:${delta.surface}`
      : `document:${delta.documentId}`;
    if (seen.has(scope)) continue;
    seen.add(scope);
    scopes.push(scope);
  }
  return scopes;
}

/** Grid-only events zijn globaal; ieder event met documentdata hoort bij het actieve document. */
export function isSessionHistoryEventApplicable(
  event: SessionHistoryEvent,
  activeDocumentId: string | null,
): boolean {
  assertValidSessionHistoryEvent(event);
  for (const delta of event.deltas) {
    if (delta.kind !== 'grid-preference' && delta.documentId !== activeDocumentId) return false;
  }
  return true;
}

export function selectUndoHistoryEvent(
  events: readonly SessionHistoryEvent[],
  activeDocumentId: string | null,
): SessionHistoryEvent | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'applied' || !isSessionHistoryEventApplicable(event, activeDocumentId)) continue;
    if (selected === null || event.sequence > selected.sequence) selected = event;
  }
  return selected;
}

export function selectRedoHistoryEvent(
  events: readonly SessionHistoryEvent[],
  activeDocumentId: string | null,
): SessionHistoryEvent | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'undone' || !isSessionHistoryEventApplicable(event, activeDocumentId)) continue;
    if (selected === null || event.sequence < selected.sequence) selected = event;
  }
  return selected;
}

type SessionHistoryProjectionState = Pick<AppState, 'historyEvents' | 'activeDocumentId'>;

/** Puur beschikbaarheidssignaal voor lint, titelbalk en sneltoetsen. */
export function canUndo(state: SessionHistoryProjectionState): boolean {
  return selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

/** Puur beschikbaarheidssignaal voor lint, titelbalk en sneltoetsen. */
export function canRedo(state: SessionHistoryProjectionState): boolean {
  return selectRedoHistoryEvent(state.historyEvents, state.activeDocumentId) !== null;
}

/** Alleen werkelijk toepasbare events tellen mee; history van slapende documenten blijft buiten beeld. */
export function historyDepthsForActiveScope(
  state: SessionHistoryProjectionState,
): SessionHistoryDepths {
  let undoDepth = 0;
  let redoDepth = 0;
  for (const event of state.historyEvents) {
    if (!isSessionHistoryEventApplicable(event, state.activeDocumentId)) continue;
    if (event.state === 'applied') undoDepth++;
    else redoDepth++;
  }
  return { undoDepth, redoDepth };
}

/** Laatste toegepaste documentdatasprong voor gerichte contract-/sharingtests. */
export function latestAppliedDocumentDataDelta(
  state: SessionHistoryProjectionState,
): DocumentDataHistoryDelta | null {
  let selected: { sequence: number; delta: DocumentDataHistoryDelta } | null = null;
  for (const event of state.historyEvents) {
    if (event.state !== 'applied' || !isSessionHistoryEventApplicable(event, state.activeDocumentId)) continue;
    const delta = event.deltas.find((candidate): candidate is DocumentDataHistoryDelta =>
      candidate.kind === 'document-data' && candidate.documentId === state.activeDocumentId);
    if (delta && (selected === null || event.sequence > selected.sequence)) {
      selected = { sequence: event.sequence, delta };
    }
  }
  return selected?.delta ?? null;
}

/**
 * Een nieuwe wijziging wist alleen undone events met een overlappende scope. Bij een botsing
 * verdwijnt het hele oude event, zodat een compound nooit half opnieuw toepasbaar wordt.
 */
export function invalidateUndoneHistoryForEvent(
  events: readonly SessionHistoryEvent[],
  newEvent: SessionHistoryEvent,
): SessionHistoryEvent[] {
  const newScopes = new Set(scopeKeysOf(newEvent));
  return events.filter(event => {
    if (event.state !== 'undone') {
      assertValidSessionHistoryEvent(event);
      return true;
    }
    return !scopeKeysOf(event).some(scope => newScopes.has(scope));
  });
}

/**
 * Behoud de nieuwste honderd events per scope. Een compound blijft staan zolang het nog tot de
 * nieuwste honderd van minimaal één eigen scope behoort; pas buiten al zijn scopes valt het weg.
 *
 * Daarbovenop het geheugenplafond: van nieuw naar oud opgeteld, valt alles vanaf het eerste event
 * dat `maxBytes` zou overschrijden weg (één snede in de tijd, zodat binnen een scope geen gat ontstaat;
 * een compound-event over meerdere scopes kan, net als bij de honderd-regel, blijven staan terwijl
 * oudere events van een andere scope wegvallen: dan ontbreken tussentoestanden, geen foute toestand),
 * behalve de nieuwste `MIN_SESSION_HISTORY_EVENTS_PER_SCOPE` van elke scope en alles vanaf het eerste
 * event van een open bewerkingssessie.
 * De geretourneerde array behoudt de oorspronkelijke opslagvolgorde.
 */
export function pruneSessionHistory(
  events: readonly SessionHistoryEvent[],
  maxBytes: number = MAX_SESSION_HISTORY_BYTES,
): SessionHistoryEvent[] {
  const ranked = events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => right.event.sequence - left.event.sequence || right.index - left.index);
  const seenPerScope = new Map<HistoryScopeKey, number>();
  const keep = new Set<number>();
  let bytes = 0;
  let overBudget = false;
  // Een open bewerkingssessie (de taakdialoog, `historyMark`) moet bij Annuleren terug kunnen: alles
  // vanaf haar eerste event blijft buiten de geheugensnede (de honderd-per-scope-regel hierboven geldt
  // wel). Alleen een open sessie draagt `sessionKey`: afsluiten, annuleren, opslaan en een nieuwe mark
  // halen hem weg (`historySlice`).
  let sessionFloor = Infinity;
  for (const event of events) {
    if (event.sessionKey !== undefined && event.sequence < sessionFloor) sessionFloor = event.sequence;
  }

  for (const { event, index } of ranked) {
    const scopes = scopeKeysOf(event);
    const within = (limit: number) => scopes.some(scope => (seenPerScope.get(scope) ?? 0) < limit);
    if (within(MAX_SESSION_HISTORY_EVENTS_PER_SCOPE)) {
      const eventBytes = estimateSessionHistoryEventBytes(event);
      if (!overBudget && bytes + eventBytes > maxBytes) overBudget = true;
      if (!overBudget || within(MIN_SESSION_HISTORY_EVENTS_PER_SCOPE) || event.sequence >= sessionFloor) {
        keep.add(index);
        bytes += eventBytes;
      }
    }
    for (const scope of scopes) seenPerScope.set(scope, (seenPerScope.get(scope) ?? 0) + 1);
  }

  return events.filter((_event, index) => keep.has(index));
}

/** Gemeenschappelijke pure registratiegrens. */
export function appendSessionHistoryEvent(
  events: readonly SessionHistoryEvent[],
  newEvent: SessionHistoryEvent,
): SessionHistoryEvent[] {
  assertValidSessionHistoryEvent(newEvent);
  if (newEvent.state !== 'applied') {
    throw new Error(`Nieuw history-event ${newEvent.id || '<zonder id>'} moet toegepast zijn`);
  }
  if (events.some(event => event.id === newEvent.id)) {
    // Alleen de actuele ledger hoeft uniek te zijn: een gepruned event is niet meer selecteerbaar
    // en heeft nergens een blijvende verwijzing. Ids komen van de sessiegenerator;
    // `nextHistorySequence` blijft juist onafhankelijk van pruning oplopen.
    throw new Error(`History-event-id bestaat al: ${newEvent.id}`);
  }
  if (events.some(event => event.sequence === newEvent.sequence)) {
    throw new Error(`History-sequence bestaat al: ${newEvent.sequence}`);
  }
  const highestSequence = events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
  if (newEvent.sequence <= highestSequence) {
    throw new Error(
      `Nieuw history-event ${newEvent.id || '<zonder id>'} heeft geen oplopende sequence`,
    );
  }

  return pruneSessionHistory([
    ...invalidateUndoneHistoryForEvent(events, newEvent),
    newEvent,
  ]);
}

/**
 * Storegerichte maar synchrone registratieprimitief. De teller blijft oplopen wanneer pruning oude
 * events verwijdert; ids zijn daardoor sessie-uniek zonder een tweede moduleglobale generator.
 */
export function recordSessionHistoryDeltas(
  state: AppState,
  label: string,
  deltas: readonly SessionHistoryDelta[],
  sessionKey?: string,
): SessionHistoryEvent | null {
  if (deltas.length === 0) return null;
  const sequence = state.nextHistorySequence;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error(`Ongeldige volgende history-sequence: ${String(sequence)}`);
  }
  const event: SessionHistoryEvent = {
    id: `history-${sequence}`,
    sequence,
    label: label.trim() || 'Wijziging',
    state: 'applied',
    deltas: deltas as [SessionHistoryDelta, ...SessionHistoryDelta[]],
    ...(sessionKey ? { sessionKey } : {}),
  };
  state.historyEvents = appendSessionHistoryEvent(state.historyEvents, event);
  state.nextHistorySequence = sequence + 1;
  return event;
}

function cloneGridSurfacePreferences(
  preferences: Readonly<TaskGridSurfacePreferences>,
): TaskGridSurfacePreferences {
  return {
    columns: preferences.columns.map(column => ({ ...column })),
    scrollX: preferences.scrollX,
  };
}

function sameGridSurfacePreferences(
  left: Readonly<TaskGridSurfacePreferences>,
  right: Readonly<TaskGridSurfacePreferences>,
): boolean {
  return left.scrollX === right.scrollX
    && left.columns.length === right.columns.length
    && left.columns.every((column, index) => {
      const candidate = right.columns[index];
      return candidate !== undefined
        && column.id === candidate.id
        && column.width === candidate.width
        && column.pinned === candidate.pinned;
    });
}

/** Registreer één persoonlijke gridwijziging; gelijke voor- en nastaat leveren bewust geen event. */
export function recordGridPreferenceHistoryDelta(
  state: AppState,
  label: string,
  surface: TaskGridSurfaceId,
  before: Readonly<TaskGridSurfacePreferences>,
  after: Readonly<TaskGridSurfacePreferences>,
): SessionHistoryEvent | null {
  if (sameGridSurfacePreferences(before, after)) return null;
  return recordSessionHistoryDeltas(state, label, [{
    kind: 'grid-preference',
    surface,
    before: cloneGridSurfacePreferences(before),
    after: cloneGridSurfacePreferences(after),
  }]);
}

/** Registreer één voorbereide documentdatasprong zonder dat de aanroeper zelf de deltavorm bouwt. */
export function recordDocumentDataHistoryDelta(
  state: AppState,
  label: string,
  documentId: string,
  before: Snapshot,
  after: Snapshot,
): SessionHistoryEvent {
  return recordSessionHistoryDeltas(state, label, [{
    kind: 'document-data', documentId, before, after,
  }])!;
}

/** Wis de redo-historie van één document: een niet-undoable wijziging aan dat document maakt zijn
 *  ongedaan gemaakte events onherstelbaar (ze zouden op een andere toestand terugvallen). */
export function invalidateDocumentRedo(
  state: { historyEvents: SessionHistoryEvent[] },
  documentId: string,
): void {
  const scope: HistoryScopeKey = `document:${documentId}`;
  state.historyEvents = invalidateUndoneHistoryForScopes(state.historyEvents, new Set([scope]));
}

/** Verwijder undone events die één van de opgegeven scopes raken; compounds verdwijnen geheel. */
export function invalidateUndoneHistoryForScopes(
  events: readonly SessionHistoryEvent[],
  scopes: ReadonlySet<HistoryScopeKey>,
): SessionHistoryEvent[] {
  return events.filter(event =>
    event.state !== 'undone' || !scopeKeysOf(event).some(scope => scopes.has(scope)));
}

/** Verwijder ieder atomair event dat naar het document wijst; een compound verdwijnt als geheel. */
export function removeSessionHistoryForDocument(
  events: readonly SessionHistoryEvent[],
  documentId: string,
): SessionHistoryEvent[] {
  return events.filter(event => !event.deltas.some(delta =>
    delta.kind !== 'grid-preference' && delta.documentId === documentId));
}

export function removeSessionHistoryForDocumentFromState(
  state: AppState,
  documentId: string,
): void {
  state.historyEvents = removeSessionHistoryForDocument(state.historyEvents, documentId);
}

export function replaceSessionHistoryState(
  state: AppState,
  events: SessionHistoryEvent[],
  nextHistorySequence: number,
): void {
  state.historyEvents = events;
  state.nextHistorySequence = nextHistorySequence;
}

/**
 * Materialiseer alle deltas in eventvolgorde tegen één geïsoleerd voortschrijdend doel. Dit houdt
 * ook een toekomstig data+view-compound correct: de viewrijen worden dan tegen de herstelde data
 * afgeleid, niet tegen de oude live bron.
 */
export function materializeHistoryEventTargets(
  state: Readonly<AppState>,
  event: SessionHistoryEvent,
  side: HistoryTargetSide,
): MaterializedHistoryTarget[] {
  let isolated = { ...state } as AppState;
  const targets: MaterializedHistoryTarget[] = [];
  for (const delta of event.deltas) {
    const target = materializeHistoryTarget(isolated, delta, side);
    targets.push(target);
    if (target.kind === 'document-data') {
      restoreSnapshot(isolated, target.snapshot);
      isolated.viewRows = target.viewRows;
      isolated.resourceLoadResult = target.resourceLoadResult;
    } else if (target.kind === 'document-view') {
      isolated.view = { ...isolated.view, ...target.view };
      isolated.viewRows = target.viewRows;
    } else {
      isolated.taskGridSurfaces = {
        ...isolated.taskGridSurfaces,
        [target.surface]: {
          columns: target.preferences.columns.map(column => ({ ...column })),
          scrollX: target.preferences.scrollX,
        },
      };
    }
  }
  return targets;
}
