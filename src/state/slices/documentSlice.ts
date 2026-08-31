import type { Project } from '@/types/project';
import type { AppState } from '../appStore';
import type { AppSliceFactory } from './types';
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
import { documentTitle, untitledOrdinals } from '@/utils/documents';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import {
  invalidateUndoneHistoryForScopes,
  removeSessionHistoryForDocumentFromState,
  replaceSessionHistoryState,
  type HistoryScopeKey,
} from '../sessionHistory';
import {
  materializeLibraryBoundary,
  prepareLoadedPayload,
  type DocumentActivationMaterialization,
} from '../documentActivation';

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

/**
 * `ui` is app-globaal (zie `AppGlobalKey` in documentContract), maar een handvol vélden erin
 * verwijst naar iets uit het *uitgaande* document. Die moeten bij elke wissel mee, anders overleeft
 * een verwijzing naar document A de sprong naar B.
 *
 * Dit stond eerder twee keer met de hand uitgeschreven in `newDocument` en `closeDocument` — en
 * `switchDocument` deed het weer nét anders. Precies het patroon dat het documentcontract elders al
 * heeft opgeruimd, dus hier één plek van gemaakt. Voeg je een `ui`-veld toe dat een taak-, resource-
 * of documentverwijzing vasthoudt, dan hoort het hier.
 *
 * `editingTaskId` is het scherpste geval: hij komt uit `TaskDialog` en wees na een tabwissel naar
 * een taak die in het nieuwe document niet bestaat. Vandaag ving de dialoog dat nog op met een
 * vangnetpad, maar dat is geluk, geen ontwerp — daarom gaat de dialoog hier ook dicht.
 */
function resetDocumentScopedUI(s: AppState): void {
  s.ui.showTaskDialog = false;
  s.ui.editingTaskId = null;
  // Bibliotheek-afwijkingen horen bij het document dat ze opleverde: de activatiegrens zet deze
  // twee alléén AAN, dus zonder reset toont een volgend document het scherm van zijn voorganger.
  s.ui.showLibraryLinkDialog = false;
  s.ui.libraryRefreshNotice = null;
}

function publishActivation(s: AppState, activation: DocumentActivationMaterialization): void {
  hydratePayload(s, activation.payload);
  s.viewRows = [...activation.viewRows];
  s.resourceLoadResult = activation.resourceLoadResult;
  s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
  s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
}

function invalidateActivationRedo(s: AppState, documentId: string): void {
  const scope: HistoryScopeKey = `document:${documentId}`;
  s.historyEvents = invalidateUndoneHistoryForScopes(s.historyEvents, new Set([scope]));
}

/** Lichtgewicht weergave voor consumenten (bv. een toekomstige FileTabBar). */
export interface DocumentInfo {
  id: string;
  title: string;
  isDirty: boolean;
  isActive: boolean;
  /** Volgnummer onder de NAAMLOZE documenten (`title === ''`), of `undefined` wanneer dit document
   *  een echte titel heeft of het enige/eerste naamloze is. De weergavelaag plakt het achter het
   *  vertaalde `common:project.untitled`-label; zie `untitledOrdinals` in `@/utils/documents`. */
  untitledOrdinal?: number;
}

export interface DocumentSlice {
  documents: DocumentEntry[];
  activeDocumentId: string;
  /** Open een nieuw, leeg document in een eigen tab en maak het actief. Geeft het nieuwe id terug. */
  newDocument: () => string;
  /** Dupliceer het actieve document naar een nieuwe, actieve kopie (wat-als/variant, MCP-WP4). De
   *  kopie krijgt genulde `filePath`/`fileHandle` (zodat Ctrl+S het bronbestand niet overschrijft),
   *  `isDirty = true`, lege selectie en diep gekloonde muteerbare payloadvelden. De sessiehistorie
   *  blijft app-globaal en wordt niet met de documentpayload gekopieerd.
   *  worden diep gekloond (geen enkele array/object gedeeld met de bron). Naam: `name` indien
   *  meegegeven, anders `"<projectnaam> (variant N)"`. Geeft het nieuwe document-id terug. */
  duplicateDocument: (name?: string) => string;
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
  /** Reken elk NIET-ACTIEF geopend document met een verouderde planning (`payload.scheduleStale`)
   *  écht door en schrijf de uitkomst in zijn payload terug — het terugschrijfbesluit van B1b
   *  §4.3b. Geeft het aantal bijgewerkte documenten terug (0 ⇒ er is niets gemuteerd).
   *
   *  Wordt uitsluitend aangeroepen wanneer de gebruiker "Automatisch berekenen"
   *  (`ui.autoCalcCPM`) aan heeft staan: dan mag een leesvenster zijn documenten bijwerken. In de
   *  handmatige modus (de default, kernontwerp "manual, not reactive") blijft het bezettings-
   *  overzicht efemeer doorrekenen en raakt het geen enkele payload aan.
   *
   *  Semantiek spiegelt `runCPM`: géén undo-snapshot en `isDirty` blijft ongemoeid (een
   *  doorrekening is afgeleide data, geen bewerking). Het ACTIEVE document valt hier bewust buiten
   *  — dat heeft zijn eigen pad (`useAutoCalcCPM` → `runCPM`, ~100 ms). */
  recalculateStaleSleepingDocuments: () => number;
}

/**
 * Titel-afleiding voor `getOpenDocuments()`. Dezelfde regel als de tabbladen — daarom letterlijk
 * dezelfde pure helper uit `@/utils/documents` (er stond hier een tweede, licht afwijkende kopie).
 *
 * Een naamloos project levert bewust een LEGE titel: de store is een datalaag, geen weergavelaag,
 * en hier stond eerder een hardgecodeerd Nederlands 'Naamloos'. De weergaveplekken vullen de
 * vertaalde `common:project.untitled` in.
 */
function docTitle(filePath: string | null, project: Project): string {
  return documentTitle(filePath, project.name);
}

/** Diepe JSON-kloon — zelfde precedent als `snapshot.ts` (de projectdata is JSON-veilig). */
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** `"Basis (variant 3)"` → `"Basis"`; een naam zonder variant-suffix blijft ongewijzigd. Zo blijft de
 *  basisnaam stabiel wanneer je een variant-document opnieuw dupliceert (varianten-van-varianten). */
const VARIANT_RE = /^(.*) \(variant (\d+)\)$/;
function variantBaseName(name: string): string {
  const m = VARIANT_RE.exec(name);
  return m ? m[1] : name;
}

/** `"<basis> (variant N)"` met N = laagste vrije nummer ≥ 2 over de open document-projectnamen met
 *  dezelfde basisnaam. Zo krijgen achtereenvolgende duplicaten variant 2, 3, 4, … en kan
 *  `list_documents` de varianten onderscheiden. */
function nextVariantName(sourceName: string, openNames: string[]): string {
  const base = variantBaseName(sourceName);
  const used = new Set<number>();
  for (const nm of openNames) {
    const m = VARIANT_RE.exec(nm);
    if (m && m[1] === base) used.add(parseInt(m[2], 10));
  }
  let n = 2;
  while (used.has(n)) n++;
  return `${base} (variant ${n})`;
}

/** Projectnamen van álle open documenten (actief live top-level, rest uit de registry). */
function openProjectNames(s: AppState): string[] {
  return s.documents.map((d) => (d.id === s.activeDocumentId ? s.project.name : d.payload!.project.name));
}

const INITIAL_DOC_ID = generateId('doc');

export const createDocumentSlice: AppSliceFactory<DocumentSlice> = (runtime) => (set, get) => ({
  documents: [{ id: INITIAL_DOC_ID, payload: null }],
  activeDocumentId: INITIAL_DOC_ID,

  newDocument: () => {
    const state = get();
    const outgoing = capturePayload(state);
    const newId = generateId('doc');
    const activation = materializeLibraryBoundary({
      payload: freshPayload(), companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = outgoing;
      s.documents.push({ id: newId, payload: null });
      s.activeDocumentId = newId;
      // Een vers leeg document heeft geen open-boundary (er is niets aan gekoppeld), dus zonder
      // deze reset blijft de ui-toestand van het vorige document hangen.
      resetDocumentScopedUI(s);
      publishActivation(s, activation);
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
    return newId;
  },

  duplicateDocument: (name) => {
    // Een documentwissel breekt een lopende coalesce-reeks af (zie switchDocument): de kopie mag niet
    // stilzwijgend verdergaan op de undo-stap van de bron.
    runtime.resetUndoCoalescing();
    const source = get();
    // `outgoing` = de bron per referentie (wordt zo in de registry geparkeerd — identiek aan wat
    // newDocument/switchDocument doen). `src` lezen we ook als de bron van de kloon.
    const src = capturePayload(source);
    // Een naamloze bron blijft naamloos: `nextVariantName('')` zou letterlijk ' (variant 2)' in de
    // projectdata (en dus in het IFC) stempelen. Onderscheidbaar blijven ze wél — `getOpenDocuments()`
    // geeft naamloze documenten een `untitledOrdinal` mee, waarmee de weergavelaag er
    // "Nieuwe planning" / "Nieuwe planning (2)" van maakt. Het volgnummer is taalonafhankelijk en
    // raakt de data niet; alleen het label eromheen wordt vertaald.
    const copyName = name ?? (src.project.name ? nextVariantName(src.project.name, openProjectNames(source)) : '');
    const newId = generateId('doc');

    // Bouw de kopie-payload EXPLICIET — geen stilzwijgende afhankelijkheid van Immer-copy-on-write.
    // 'clone'-rolvelden + view/collapsedTaskIds worden diep gekloond; selectie start vers;
    // filePath/fileHandle genuld; cpmResult/resourceLoadResult ('ref') mogen per referentie mee.
    const copy: DocumentPayload = {
      project: { ...deepClone(src.project), name: copyName },
      calendar: deepClone(src.calendar),
      tasks: deepClone(src.tasks),
      sequences: deepClone(src.sequences),
      resources: deepClone(src.resources),
      assignments: deepClone(src.assignments),
      calendars: deepClone(src.calendars),
      activityCodeTypes: deepClone(src.activityCodeTypes),
      customFieldDefs: deepClone(src.customFieldDefs),
      customTaskTypes: deepClone(src.customTaskTypes),
      baselines: deepClone(src.baselines),
      activeBaselineId: src.activeBaselineId,
      cpmResult: src.cpmResult,
      resourceLoadResult: src.resourceLoadResult,
      scheduleStale: src.scheduleStale,
      // Issue #63 — 'ref' net als cpmResult/scheduleStale hierboven: een kopie deelt de bron-
      // vastlegging/modus tot de kopie zelf een bewerking of berekening krijgt.
      recordedDates: src.recordedDates,
      datesAsRecorded: src.datesAsRecorded,
      selectedTaskIds: [],
      activeTaskId: null,
      view: deepClone(src.view),
      collapsedTaskIds: deepClone(src.collapsedTaskIds),
      filePath: null,
      fileHandle: null,
      isDirty: true,
    };
    const activation = materializeLibraryBoundary({
      payload: copy, companies: source.companies, pools: source.pools, mode: 'silent-switch',
    });

    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = src; // bron parkeren (per referentie, net als newDocument/switchDocument)
      s.documents.push({ id: newId, payload: null });
      s.activeDocumentId = newId;
      resetDocumentScopedUI(s);
      publishActivation(s, activation);
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: copy.tasks.length,
      sequences: copy.sequences.length,
      resources: copy.resources.length,
    });
    return newId;
  },

  switchDocument: (id) => {
    const state = get();
    if (id === state.activeDocumentId) return;
    // Een documentwissel breekt een lopende coalesce-reeks af (pakket H): terugswitchen mag niet
    // stilzwijgend verdergaan op de undo-stap van vóór de wissel.
    runtime.resetUndoCoalescing();
    const target = state.documents.find((d) => d.id === id);
    if (!target || !target.payload) return;
    const outgoing = capturePayload(state);
    const incoming = target.payload;
    const activation = materializeLibraryBoundary({
      payload: incoming, companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = outgoing;
      const inc = s.documents.find((d) => d.id === id);
      if (inc) inc.payload = null;
      s.activeDocumentId = id;
      resetDocumentScopedUI(s);
      if (activation.invalidateRedoScope) invalidateActivationRedo(s, id);
      publishActivation(s, activation);
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
      const activation = materializeLibraryBoundary({
        payload: freshPayload(), companies: state.companies, pools: state.pools, mode: 'silent-switch',
      });
      set((s) => {
        removeSessionHistoryForDocumentFromState(s, id);
        s.documents = [{ id: newId, payload: null }];
        s.activeDocumentId = newId;
        // Zie newDocument(): deze tak levert net zo'n vers, ongekoppeld document op.
        resetDocumentScopedUI(s);
        publishActivation(s, activation);
      });
      emitExtensionEvent(HOST_EVENTS.projectNew);
      return;
    }

    // Inactief document: gewoon verwijderen.
    if (id !== state.activeDocumentId) {
      set((s) => {
        removeSessionHistoryForDocumentFromState(s, id);
        s.documents = s.documents.filter((d) => d.id !== id);
      });
      return;
    }

    // Actief document: eerst naar een buur wisselen, dan verwijderen.
    const idx = state.documents.findIndex((d) => d.id === id);
    const neighbor = state.documents[idx + 1] ?? state.documents[idx - 1];
    const incoming = neighbor.payload!;
    const activation = materializeLibraryBoundary({
      payload: incoming, companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      removeSessionHistoryForDocumentFromState(s, id);
      s.documents = s.documents.filter((d) => d.id !== id);
      const n = s.documents.find((d) => d.id === neighbor.id);
      if (n) n.payload = null;
      s.activeDocumentId = neighbor.id;
      resetDocumentScopedUI(s);
      if (activation.invalidateRedoScope) invalidateActivationRedo(s, neighbor.id);
      publishActivation(s, activation);
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: incoming.tasks.length,
      sequences: incoming.sequences.length,
      resources: incoming.resources.length,
    });
  },

  getOpenDocuments: () => {
    const s = get();
    const rows = s.documents.map((d) => {
      const active = d.id === s.activeDocumentId;
      const filePath = active ? s.filePath : d.payload!.filePath;
      const project = active ? s.project : d.payload!.project;
      const isDirty = active ? s.isDirty : d.payload!.isDirty;
      return { id: d.id, title: docTitle(filePath, project), isDirty, isActive: active };
    });
    // Naamloze documenten krijgen een volgnummer mee, zodat twee lege tabbladen (bv. na
    // `duplicateDocument` van een naamloos project) onderscheidbaar blijven zónder dat er een
    // taalgebonden naam in de projectdata belandt.
    const ordinals = untitledOrdinals(rows.map((r) => r.title));
    return rows.map((r, i) => (ordinals[i] === undefined ? r : { ...r, untitledOrdinal: ordinals[i] }));
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
    const state = get();
    const active = docs.find((d) => d.id === activeId) ?? docs[0];
    const prepared = prepareLoadedPayload(payloadFromInput(active), { recompute: true });
    const activation = materializeLibraryBoundary({
      payload: prepared, companies: state.companies, pools: state.pools, mode: 'open-boundary',
    });
    set((s) => {
      replaceSessionHistoryState(s, [], 1);
      s.documents = docs.map((d) => ({
        id: d.id,
        payload: d.id === active.id ? null : payloadFromInput(d),
      }));
      s.activeDocumentId = active.id;
      resetDocumentScopedUI(s);
      if (activation.invalidateRedoScope) invalidateActivationRedo(s, active.id);
      publishActivation(s, activation);
    });
    // De solve gebeurde al op de geïsoleerde actieve payload. Herstel nu alleen dezelfde zichtbare
    // foutmelding en extension-eventsemantiek als een gewone runCPM, ná de atomaire publicatie.
    const cpm = activation.payload.cpmResult;
    if (cpm?.error) {
      get().notify({
        severity: 'error',
        messageKey: 'notifications.scheduleFailed',
        detail: cpm.error,
        dedupeKey: 'cpm-error',
      });
    }
    emitExtensionEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: activation.payload.tasks.filter(task => task.time.isCritical).length,
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: active.tasks.length,
      sequences: active.sequences.length,
      resources: active.resources.length,
    });
  },

  recalculateStaleSleepingDocuments: () => {
    const state = get();
    // Fase 1 — rekenen BUITEN de producer. `solveProject` muteert de takenlijst die het krijgt, dus
    // het rekent op een KLOON van de payload-taken (`cloneTasksForSolve` kopieert precies het
    // `time`-blok dat solver en `applyCpmResult` schrijven). Die kloon is ook wat we straks
    // terugschrijven: de payload-taken zelf blijven tot dat moment onaangeraakt, zodat een mislukte
    // solve niets halfs achterlaat.
    const updates: { id: string; payload: DocumentPayload }[] = [];
    for (const entry of state.documents) {
      if (entry.id === state.activeDocumentId) continue; // eigen pad (useAutoCalcCPM → runCPM).
      const payload = entry.payload;
      if (!payload || !payload.scheduleStale) continue;

      let next: DocumentPayload;
      try {
        const tasks = cloneTasksForSolve(payload.tasks);
        // Exact dezelfde reken-kern (en dezelfde opties) die `runCPM` op het actieve document
        // draait — pariteit by construction, geen tweede implementatie (A3/M3).
        const result = solveProject({
          tasks,
          sequences: payload.sequences,
          calendar: payload.calendar,
          calendars: payload.calendars,
          dataDate: payload.project.statusDate,
          progressMode: payload.project.progressMode,
          schedulingOptions: payload.project.schedulingOptions,
        });
        // Cyclus/solverfout: dit document volledig ONAANGERAAKT laten (het vangnet van §4.3 blijft
        // dan gelden — het overzicht toont zijn boeking ongeteld met de ⚠) en doorgaan met de rest.
        if (result.error) continue;
        // Spread over het volledige contract: elk (ook toekomstig) payload-veld rijdt automatisch
        // mee, alleen de vier doorrekenvelden worden vervangen. `resourceLoadResult: null` omdat
        // `switchDocument` bij activering tóch onvoorwaardelijk `recomputeResourceLoad()` draait —
        // een hier berekende belasting zou dubbel werk zijn dat alleen kan verouderen.
        // `isDirty` blijft letterlijk staan. De app-globale sessiehistorie wordt hier niet geraakt:
        // dit is geen gebruikersbewerking maar alleen een afleiding voor een slapend document.
        //
        // `datesAsRecorded`/`recordedDates` MOETEN hier mee gewist worden (issue #63): de spread
        // draagt ze anders ongewijzigd mee, waarna dit document belooft "dit zijn de datums zoals
        // opgeslagen" terwijl de zojuist berekende datums op het scherm staan zodra je het
        // activeert — precies de mengvorm die de modus moet voorkomen. Dat er geen undo-stap
        // tegenover staat is hier consistent: deze functie herschrijft `tasks`/`cpmResult` óók
        // zonder history-event; bestaande events voor het slapende document blijven bij hun
        // eigen, oudere toestand horen.
        //
        // BACKSTOP, geen dagelijks pad: `markScheduleStale` (transaction.ts) houdt `scheduleStale`
        // uit zolang de modus aanstaat, dus een payload met modus-aan hoort hier niet eens langs te
        // komen. Deze twee velden staan er voor het geval een toekomstige schrijver die regel mist —
        // stil herberekenen mét de modus aan is de duurste manier om daarachter te komen.
        next = {
          ...payload, tasks, cpmResult: result, scheduleStale: false, resourceLoadResult: null,
          datesAsRecorded: false, recordedDates: null,
        };
      } catch {
        continue; // net als de efemere solve in het overzicht: nooit de hele actie laten omvallen.
      }
      updates.push({ id: entry.id, payload: next });
    }

    // Fase 2 — pas muteren als er écht iets te schrijven is. Die vroege uitgang is wat de
    // aanroepende weergave-effect-lus dooft: zonder wijziging geen nieuwe `documents`-referentie,
    // dus geen nieuwe render en geen herhaalde aanroep.
    if (updates.length === 0) return 0;
    set((s) => {
      for (const u of updates) {
        const entry = s.documents.find((d) => d.id === u.id);
        if (!entry || entry.payload === null) continue; // tussentijds gesloten/geactiveerd.
        entry.payload = u.payload;
      }
    });
    return updates.length;
  },
});
