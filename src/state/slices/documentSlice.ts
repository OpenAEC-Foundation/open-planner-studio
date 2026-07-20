import type { Project } from '@/types/project';
import type { AppSlice } from './types';
import { generateId } from '@/utils/id';
import {
  capturePayload,
  hydratePayload,
  freshPayload,
  payloadFromInput,
  type DocumentPayload,
  type RecoveryDocInput,
} from '../documentContract';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import { resetUndoCoalescing } from '../transaction';

// Het documentcontract (payload-vorm + capture/hydrate/fresh) woont nu in `../documentContract`
// (audit P10). Hier blijft alleen de multi-document back-end (registry, switchen, sluiten,
// recovery). Re-export voor bestaande importers (bv. App.tsx importeert RecoveryDocInput hier).
export type { DocumentPayload, RecoveryDocInput } from '../documentContract';

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
    get().recomputeViewRows();
    emitExtensionEvent(HOST_EVENTS.projectNew);
    return newId;
  },

  switchDocument: (id) => {
    const state = get();
    if (id === state.activeDocumentId) return;
    // Een documentwissel breekt een lopende coalesce-reeks af (pakket H): terugswitchen mag niet
    // stilzwijgend verdergaan op de undo-stap van vóór de wissel.
    resetUndoCoalescing();
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
    get().recomputeViewRows();
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
      get().recomputeViewRows();
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
    get().recomputeViewRows();
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
    get().recomputeViewRows();
    // Doorrekenen na herstel, net als élk ander laadpad (openFile/openRecentFile/
    // openExampleFromString gaan via applyLoadedProject met `recompute: true`). Dit was tot nu toe
    // het énige laadpad zónder runCPM; sinds de writer de afgeleide `OPS_Analysis`-pset niet meer
    // schrijft (interferingFloat/isNearCritical/floatPath) zou de bijna-kritiek-kleuring, de
    // float-path-tint en het InterferingFloat-veld hier anders leeg blijven tot de gebruiker F5
    // drukt. Alleen het ACTIEVE document: de herstelde inactieve documenten krijgen via
    // `payloadFromInput` sowieso een verse (lege) `cpmResult` — dat was al zo — en runCPM werkt
    // uitsluitend op de top-level (actieve) state, dus alles doorrekenen zou per document een
    // hydrate/capture-wissel + volledige CPM-run kosten en de opstart lineair vertragen bij veel
    // herstelde documenten, terwijl de uitkomst pas zichtbaar is als je erheen switcht.
    get().runCPM();
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: active.tasks.length,
      sequences: active.sequences.length,
      resources: active.resources.length,
    });
  },
});
