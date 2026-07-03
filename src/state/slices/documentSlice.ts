import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Snapshot } from '../snapshot';
import type { ViewState, AppSlice } from './types';
import type { AppState } from '../appStore';
import { generateId } from '@/utils/id';
import { createDefaultProject } from './projectSlice';
import { createDefaultView } from './viewSlice';
import { emitExtensionEvent, HOST_EVENTS } from '@/extensions/eventBus';

/**
 * Multi-document back-end.
 *
 * Het *actieve* document leeft gewoon op top-level in de store (project, tasks,
 * …) zodat alle bestaande slices, componenten en de renderer ongewijzigd blijven
 * werken. De andere geopende documenten worden als losse `DocumentPayload`
 * bewaard in de `documents`-registry. Wisselen = de top-level-velden in de
 * payload van het uitgaande document opslaan en die van het inkomende
 * inladen.
 *
 * Bewust NIET per-document (blijft app-globaal): de rest van `ui` (ribbon,
 * panelen, thema) en `taskClipboard` — zo kun je takken tussen documenten
 * kopiëren/plakken.
 */
export interface DocumentPayload {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  resourceCalendars: WorkCalendar[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  selectedTaskIds: string[];
  cpmResult: CPMResult | null;
  view: ViewState;
  collapsedTaskIds: string[];
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  filePath: string | null;
  isDirty: boolean;
}

export interface DocumentEntry {
  id: string;
  /** null wanneer dit het actieve document is — zijn data leeft dan op top-level. */
  payload: DocumentPayload | null;
}

/** Lichtgewicht weergave voor consumenten (bv. een toekomstige FileTabBar). */
export interface DocumentInfo {
  id: string;
  title: string;
  isDirty: boolean;
  isActive: boolean;
}

/** Per-document projectdata + metadata om bij crash-recovery te herstellen.
 *  Alleen de IFC-round-trip-velden + identiteit; view/undo/cpm worden vers
 *  opgebouwd (zijn niet kritiek na een crash). */
export interface RecoveryDocInput {
  id: string;
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  resourceCalendars?: WorkCalendar[];
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  filePath: string | null;
  isDirty: boolean;
}

export interface DocumentSlice {
  documents: DocumentEntry[];
  activeDocumentId: string;
  /** Open een nieuw, leeg document in een eigen tab en maak het actief. Geeft het nieuwe id terug. */
  newDocument: () => string;
  /** Wissel naar een ander geopend document. */
  switchDocument: (id: string) => void;
  /** Sluit een document; het laatste sluiten reset naar één leeg document. */
  closeDocument: (id: string) => void;
  /** Lijst van geopende documenten met afgeleide titel + dirty/active-status. */
  getOpenDocuments: () => DocumentInfo[];
  /** Alle geopende documenten als payload (actief live, rest uit de registry) —
   *  voor crash-recovery-serialisatie. */
  getOpenDocumentPayloads: () => { id: string; payload: DocumentPayload }[];
  /** Herstel meerdere documenten na een crash; vervangt de huidige set volledig. */
  restoreDocuments: (docs: RecoveryDocInput[], activeId: string | null) => void;
}

/** Lees de actieve (top-level) projectdata uit als losstaande payload. */
function capturePayload(s: AppState): DocumentPayload {
  return {
    project: s.project,
    calendar: s.calendar,
    tasks: s.tasks,
    sequences: s.sequences,
    resources: s.resources,
    assignments: s.assignments,
    resourceCalendars: s.resourceCalendars,
    activityCodeTypes: s.activityCodeTypes,
    customFieldDefs: s.customFieldDefs,
    selectedTaskIds: s.selectedTaskIds,
    cpmResult: s.cpmResult,
    view: s.view,
    collapsedTaskIds: s.ui.collapsedTaskIds,
    undoStack: s.undoStack,
    redoStack: s.redoStack,
    filePath: s.filePath,
    isDirty: s.isDirty,
  };
}

/** Schrijf een payload terug naar de top-level (actieve) state. */
function hydratePayload(s: AppState, p: DocumentPayload): void {
  s.project = p.project;
  s.calendar = p.calendar;
  s.tasks = p.tasks;
  s.sequences = p.sequences;
  s.resources = p.resources;
  s.assignments = p.assignments;
  s.resourceCalendars = p.resourceCalendars ?? [];
  s.activityCodeTypes = p.activityCodeTypes ?? [];
  s.customFieldDefs = p.customFieldDefs ?? [];
  s.selectedTaskIds = p.selectedTaskIds;
  s.cpmResult = p.cpmResult;
  s.view = p.view;
  s.ui.collapsedTaskIds = p.collapsedTaskIds;
  s.undoStack = p.undoStack;
  s.redoStack = p.redoStack;
  s.filePath = p.filePath;
  s.isDirty = p.isDirty;
}

/** Verse, lege document-payload (nieuw project). */
function freshPayload(): DocumentPayload {
  return {
    project: createDefaultProject(),
    calendar: createDefaultCalendar(),
    tasks: [],
    sequences: [],
    resources: [],
    assignments: [],
    resourceCalendars: [],
    activityCodeTypes: [],
    customFieldDefs: [],
    selectedTaskIds: [],
    cpmResult: null,
    view: createDefaultView(),
    collapsedTaskIds: [],
    undoStack: [],
    redoStack: [],
    filePath: null,
    isDirty: false,
  };
}

/** Verse payload uit herstelde projectdata (view/undo/cpm worden vers opgebouwd). */
function payloadFromInput(d: RecoveryDocInput): DocumentPayload {
  return {
    project: d.project,
    calendar: d.calendar,
    tasks: d.tasks,
    sequences: d.sequences,
    resources: d.resources,
    assignments: d.assignments,
    resourceCalendars: d.resourceCalendars ?? [],
    activityCodeTypes: d.activityCodeTypes ?? [],
    customFieldDefs: d.customFieldDefs ?? [],
    selectedTaskIds: [],
    cpmResult: null,
    view: createDefaultView(),
    collapsedTaskIds: [],
    undoStack: [],
    redoStack: [],
    filePath: d.filePath,
    isDirty: d.isDirty,
  };
}

function documentTitle(filePath: string | null, project: Project): string {
  if (filePath) {
    const base = filePath.split(/[\\/]/).pop() || filePath;
    return base.replace(/\.[^.]+$/, '');
  }
  return project.name || 'Naamloos';
}

const INITIAL_DOC_ID = generateId('doc');

export const createDocumentSlice: AppSlice<DocumentSlice> = (set, get) => ({
  documents: [{ id: INITIAL_DOC_ID, payload: null }],
  activeDocumentId: INITIAL_DOC_ID,

  newDocument: () => {
    const outgoing = capturePayload(get());
    const newId = generateId('doc');
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = outgoing;
      s.documents.push({ id: newId, payload: null });
      s.activeDocumentId = newId;
      hydratePayload(s, freshPayload());
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
    return newId;
  },

  switchDocument: (id) => {
    const state = get();
    if (id === state.activeDocumentId) return;
    const target = state.documents.find((d) => d.id === id);
    if (!target || !target.payload) return;
    const outgoing = capturePayload(state);
    const incoming = target.payload;
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = outgoing;
      hydratePayload(s, incoming);
      const inc = s.documents.find((d) => d.id === id);
      if (inc) inc.payload = null;
      s.activeDocumentId = id;
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: incoming.tasks.length,
      sequences: incoming.sequences.length,
      resources: incoming.resources.length,
    });
  },

  closeDocument: (id) => {
    const state = get();
    if (!state.documents.some((d) => d.id === id)) return;

    // Laatste document sluiten → reset naar één vers, leeg document.
    if (state.documents.length === 1) {
      const newId = generateId('doc');
      set((s) => {
        s.documents = [{ id: newId, payload: null }];
        s.activeDocumentId = newId;
        hydratePayload(s, freshPayload());
      });
      emitExtensionEvent(HOST_EVENTS.projectNew);
      return;
    }

    // Inactief document: gewoon verwijderen.
    if (id !== state.activeDocumentId) {
      set((s) => {
        s.documents = s.documents.filter((d) => d.id !== id);
      });
      return;
    }

    // Actief document: eerst naar een buur wisselen, dan verwijderen.
    const idx = state.documents.findIndex((d) => d.id === id);
    const neighbor = state.documents[idx + 1] ?? state.documents[idx - 1];
    const incoming = neighbor.payload!;
    set((s) => {
      hydratePayload(s, incoming);
      s.documents = s.documents.filter((d) => d.id !== id);
      const n = s.documents.find((d) => d.id === neighbor.id);
      if (n) n.payload = null;
      s.activeDocumentId = neighbor.id;
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: incoming.tasks.length,
      sequences: incoming.sequences.length,
      resources: incoming.resources.length,
    });
  },

  getOpenDocuments: () => {
    const s = get();
    return s.documents.map((d) => {
      const active = d.id === s.activeDocumentId;
      const filePath = active ? s.filePath : d.payload!.filePath;
      const project = active ? s.project : d.payload!.project;
      const isDirty = active ? s.isDirty : d.payload!.isDirty;
      return { id: d.id, title: documentTitle(filePath, project), isDirty, isActive: active };
    });
  },

  getOpenDocumentPayloads: () => {
    const s = get();
    return s.documents.map((d) => ({
      id: d.id,
      payload: d.id === s.activeDocumentId ? capturePayload(s) : d.payload!,
    }));
  },

  restoreDocuments: (docs, activeId) => {
    if (docs.length === 0) return;
    const active = docs.find((d) => d.id === activeId) ?? docs[0];
    set((s) => {
      s.documents = docs.map((d) => ({
        id: d.id,
        payload: d.id === active.id ? null : payloadFromInput(d),
      }));
      s.activeDocumentId = active.id;
      hydratePayload(s, payloadFromInput(active));
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: active.tasks.length,
      sequences: active.sequences.length,
      resources: active.resources.length,
    });
  },
});
