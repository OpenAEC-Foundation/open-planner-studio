/**
 * Maakt per extensie een scoped API-instantie. De publieke datavormen zijn de `Ext*`-DTO's
 * (extTypes.ts) — interne domeintypes lekken nooit naar extensie-code; alle conversie loopt via
 * extMappers. Permissie-checks zijn NIET meer verspreid door de methodes maar gecentraliseerd in
 * `permissions.ts`: één tabel (pad → permissie) + één generieke wrapper (`applyPermissionGuards`).
 * Alle registraties worden bijgehouden in cleanupFns zodat disable ze terugdraait.
 */
import type {
  ExtensionApi,
  ExtensionPermission,
  ImporterDefinition,
  RibbonButtonRegistration,
} from './types';
import type { ExtImportResult, ExtFontProvider } from './extTypes';
import type { AppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import { isSelfOrDescendant } from '@/state/taskTree';
import { registerCjkFontProvider } from '@/services/pdf/fontRegistry';
import {
  subscribeExtensionEvent,
  unsubscribeExtensionEvent,
  emitExtensionEvent,
  type ExtEventListener,
} from '@/services/extensionEvents';
import { applyPermissionGuards } from './permissions';
import {
  assertNoImportSourceDrift,
  getExtImportSourceCatalogPage,
  getExtImportSourceChunk,
  toExtImportSourceInfo,
} from './extImportSource';
import {
  toExtProject,
  toExtCalendar,
  toExtTask,
  toExtSequence,
  toExtResource,
  toExtAssignment,
  fromExtTaskAddInput,
  fromExtTaskUpdates,
  fromExtSequenceInput,
  fromExtImportResult,
  fromExtRibbonTab,
  fromExtFontProvider,
} from './extMappers';

// Re-export zodat bestaande importers (index.ts) ongewijzigd blijven werken.
export { emitExtensionEvent };

/** Appbrede binding voor extensie-UI en meldingen; documentdata loopt hier bewust niet doorheen. */
export interface ExtensionHostBinding {
  app: AppStoreContext;
  showNotification(
    extensionId: string,
    message: string,
    type: 'info' | 'warning' | 'error',
  ): void;
}

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
  assets: Record<string, Uint8Array> | undefined,
  document: AppStoreContext,
  host: ExtensionHostBinding,
): ExtensionApi {
  const cleanupFns: (() => void)[] = [];
  const batch = createBatchTransactions(document);

  const customTaskTypeToMaterialize = (
    type: { id: string; name?: string } | undefined,
  ): { id: string; name: string } | undefined => {
    if (!type) return undefined;
    const id = type.id.trim();
    if (!id) throw new Error(`Extensie "${extensionId}": customTaskType.id mag niet leeg zijn`);
    const state = document.store.getState();
    const existing = state.customTaskTypes.find(candidate => candidate.id === id);
    const name = type.name?.trim();
    if (existing) {
      if (name && existing.name !== name) {
        throw new Error(`Extensie "${extensionId}": customTaskType-id '${id}' heeft al projectsnapshot '${existing.name}'`);
      }
      return undefined;
    }
    if (!name) {
      throw new Error(`Extensie "${extensionId}": onbekend customTaskType-id '${id}' vereist ook een naam`);
    }
    const sameName = state.customTaskTypes.find(candidate => candidate.name.localeCompare(
      name, undefined, { sensitivity: 'accent' },
    ) === 0);
    if (sameName) {
      throw new Error(`Extensie "${extensionId}": customTaskType-naam '${name}' bestaat al met id '${sameName.id}'`);
    }
    return { id, name };
  };

  /**
   * WBS-ouder vanuit `data.addTask`/`data.updateTask` toetsen VÓÓR er iets gemuteerd wordt. Rauw
   * via `fromExtTaskUpdates` + `updateTask` (Object.assign) zou `kind.parentId` naar de ouder wijzen
   * terwijl diens `childIds` van niets weet — na `runCPM` wordt de ouder zo géén samenvattingstaak —
   * en een onbekende ouder zou gewoon aangenomen worden. De guards zijn die van de store-route
   * (`moveTaskTo`/`planTaskPlacement`: onbekende ouder, taak onder zichzelf of een eigen
   * afstammeling), maar de store weigert stil; een extensie krijgt hier een fout, in dezelfde vorm
   * als de `customTaskType`-weigeringen hierboven. `taskId` ontbreekt bij `addTask`: een nieuwe taak
   * heeft nog geen afstammelingen, dus een kring kan daar niet.
   */
  const assertParentAllowed = (taskId: string | undefined, parentId: string): void => {
    const tasks = document.store.getState().tasks;
    if (!tasks.some(task => task.id === parentId)) {
      throw new Error(`Extensie "${extensionId}": onbekende ouder '${parentId}'`);
    }
    if (taskId !== undefined && isSelfOrDescendant(tasks, parentId, taskId)) {
      throw new Error(
        `Extensie "${extensionId}": taak '${taskId}' kan niet onder zichzelf of een eigen afstammeling ('${parentId}') worden geplaatst`,
      );
    }
  };

  /**
   * `resourceIds` van een taak is een AFGELEIDE van de toewijzingen (`assignResource` houdt hem bij,
   * de lezers reconstrueren hem uit de toewijzingen en hij wordt niet los opgeslagen). Rauw
   * doorgegeven lijkt de taak toegewezen, maar zonder toewijzing is er geen belasting, en na opslaan
   * is het weg. MCP weigert het veld ook. Zelfde vorm als de ouderwijziging (`parentId`): gelijk aan
   * de huidige waarde — een ongewijzigd `getTasks()`-object, of `[]` bij een nieuwe taak — wordt
   * genegeerd; een andere waarde gooit een fout vóór er iets gewijzigd is, met de route die wél
   * toewijst. De volgorde telt niet (het is een verzameling).
   */
  const assertResourceIdsUnchanged = (
    taskLabel: string,
    current: readonly string[],
    requested: readonly string[] | undefined,
  ): void => {
    if (requested === undefined) return;
    const a = [...requested].sort();
    const b = [...current].sort();
    if (a.length === b.length && a.every((id, i) => id === b[i])) return;
    throw new Error(
      `Extensie "${extensionId}": \`resourceIds\` van ${taskLabel} volgt uit de toewijzingen en is niet los te zetten; ` +
      'toewijzingen lees je met data.getAssignments() en zet je mee via data.loadProject({ ..., assignments }) — of de gebruiker wijst toe in de app',
    );
  };

  const settingsPrefix = `ops-ext:${extensionId}:`;

  const api: ExtensionApi = {
    extensionId,

    importers: {
      register(def: ImporterDefinition) {
        host.app.store.getState().addExtensionImporter({ ...def, extensionId });
        cleanupFns.push(() => {
          host.app.store.getState().removeExtensionImporter(extensionId, def.id);
        });
      },
      unregister(id: string) {
        host.app.store.getState().removeExtensionImporter(extensionId, id);
      },
    },

    /** Lees-/schrijftoegang tot planningsdata. `get*` levert VERSE, MUTEERBARE Ext*-kopieën
     *  (gemapt uit de Immer-bevroren store) — muteren ervan raakt de store niet. Schrijf via
     *  addTask/updateTask/addSequence en roep daarna recalculate() aan. */
    data: {
      getProject: () => toExtProject(document.store.getState().project),
      getCalendar: () => toExtCalendar(document.store.getState().calendar),
      getTasks: () => {
        const state = document.store.getState();
        return state.tasks.map(task => toExtTask(task, task.customTaskTypeId
          ? state.customTaskTypes.find(type => type.id === task.customTaskTypeId)
          : undefined));
      },
      getSequences: () => document.store.getState().sequences.map(toExtSequence),
      getResources: () => document.store.getState().resources.map(toExtResource),
      getAssignments: () => document.store.getState().assignments.map(toExtAssignment),
      getImportSourceInfo: () => {
        const state = document.store.getState();
        return state.xerSourceArchive
          ? toExtImportSourceInfo(state.xerSourceArchive, state.xerImportMetadata, state.xerSourceProjectId)
          : null;
      },
      getImportSourceIssue: () => {
        const state = document.store.getState();
        // Alleen als er GEEN archief is: een bruikbaar archief heeft per definitie geen issue, en
        // een verse kopie van de code (geen referentie naar store-state).
        return !state.xerSourceArchive && state.xerArchiveIssue
          ? { code: state.xerArchiveIssue.code }
          : null;
      },
      getImportSourceChunk: (index) => {
        const archive = document.store.getState().xerSourceArchive;
        return archive ? getExtImportSourceChunk(archive, index) : null;
      },
      getImportSourceCatalogPage: (collection, options) => {
        const state = document.store.getState();
        // `getExtImportSourceCatalogPage` bewaakt de drift zelf zodra er een archief is — maar als
        // het actieve document NA een `switchDocument` helemaal geen XER-bron meer heeft, wordt die
        // functie hier onder nooit aangeroepen (er is geen `archive` om aan door te geven). Zonder
        // deze losse check zou een `expectedSourceProjectId` dan stil een `null` terugkrijgen i.p.v.
        // de bedoelde `ExtImportSourceDriftError`.
        if (!state.xerSourceArchive) {
          assertNoImportSourceDrift(options?.expectedSourceProjectId, null);
          return null;
        }
        return getExtImportSourceCatalogPage(
          state.xerSourceArchive, state.xerImportMetadata, state.xerSourceProjectId, collection, options,
        );
      },
      // ÁLLE `data.*`-schrijfroutes lopen via
      // `batch.withTransaction` — één undo-stap per call, en nooit via `finishUndoable` buiten batch.
      // Die route stempelt tijdens een open bewerksessie (taakdialoog) de `sessionKey`, en dan zou
      // Annuleren in de dialoog extensiewerk stil terugdraaien (docblok `SessionHistoryEvent.sessionKey`).
      addTask: (task) => {
        // Een nieuwe taak heeft nog geen toewijzingen: alleen `[]` (bv. uit de SDK-taakfabriek) mag mee.
        const { resourceIds: requestedResourceIds, ...input } = task;
        assertResourceIdsUnchanged('een nieuwe taak', [], requestedResourceIds);
        // De store-`addTask` weigert (met melding, `''` als id) een mijlpaal als eerste kind van een
        // taak met toewijzingen: die toewijzingen zouden nergens heen kunnen. Een
        // extensie krijgt dan een fout in plaats van een id dat niet bestaat.
        const added = (id: string): string => {
          if (!id) {
            throw new Error(`Extensie "${extensionId}": taak '${task.name}' niet toegevoegd — de ouder heeft `
              + 'toewijzingen die niet naar deze nieuwe subtaak kunnen (zie de melding in de app)');
          }
          return id;
        };
        // Een bestaande ouder hangt de store-`addTask` zelf aan beide kanten op; alleen een
        // onbekende ouder liet hij als bungelende `parentId` staan. `''` ⇒ wortel, net als daar
        // (`partial.parentId || null`).
        if (input.parentId) assertParentAllowed(undefined, input.parentId);
        const materialize = customTaskTypeToMaterialize(input.customTaskType);
        // Catalogus + toewijzing vormen voor de gebruiker één wijziging en dus één undo-stap.
        return batch.withTransaction(() => {
          if (materialize) document.store.getState().ensureProjectTaskType(materialize);
          return added(document.store.getState().addTask(fromExtTaskAddInput(input)));
        });
      },
      updateTask: (id, updates) => {
        // `resourceIds` nooit mee in de veldpatch: afgeleid van de toewijzingen (zie
        // `assertResourceIdsUnchanged`).
        const { resourceIds: requestedResourceIds, ...withoutResourceIds } = updates;
        // Bestaand API-gedrag voor een onbekend taak-id is een stille no-op; materialiseer in dat
        // geval ook geen los catalogusitem waar uiteindelijk geen taaktoewijzing tegenover staat.
        const current = document.store.getState().tasks.find(task => task.id === id);
        if (!current) {
          batch.withTransaction(() => document.store.getState().updateTask(id, fromExtTaskUpdates(withoutResourceIds)));
          return;
        }
        assertResourceIdsUnchanged(`taak '${id}'`, current.resourceIds, requestedResourceIds);
        // Een ouderwijziging is een VERPLAATSING, geen veld: ze loopt via dezelfde store-actie als
        // rij-slepen (`moveTaskTo`), die `parentId`, beide `childIds` en de rauwe takenvolgorde
        // samen bijwerkt. Daarom nooit mee in de kale veldpatch. Dezelfde ouder (ook een
        // `getTasks()`-object dat ongewijzigd terugkomt) is geen verplaatsing; `''` ⇒ wortel.
        const { parentId: requestedParentId, ...fieldUpdates } = withoutResourceIds;
        const move = requestedParentId !== undefined
          && (requestedParentId || null) !== (current.parentId || null)
          ? { parentId: requestedParentId || null }
          : null;
        if (move?.parentId) assertParentAllowed(id, move.parentId);
        const materialize = customTaskTypeToMaterialize(fieldUpdates.customTaskType);
        const patch = fromExtTaskUpdates(fieldUpdates);
        // Niets over (bv. alleen een ongewijzigde `resourceIds` of ouder): geen lege undo-stap.
        if (!materialize && !move && Object.keys(patch).length === 0) return;
        // Catalogus, verplaatsing en veldwijziging vormen voor de gebruiker één wijziging en dus
        // één undo-stap. Eerst verplaatsen: met WBS-autonummering hernummert `moveTaskTo`, en een
        // `wbsCode` uit dezelfde aanroep blijft dan staan.
        batch.withTransaction(() => {
          if (materialize) document.store.getState().ensureProjectTaskType(materialize);
          // Index voorbij het einde wordt in de store geklemd ⇒ achteraan bij de nieuwe ouder, zoals
          // het wijzigen van de ouder in het taakvenster (`moveTask` zonder positie).
          if (move) document.store.getState().moveTaskTo(id, { parentId: move.parentId, childIndex: Number.MAX_SAFE_INTEGER });
          if (!move || Object.keys(patch).length > 0) document.store.getState().updateTask(id, patch);
        });
      },
      addSequence: (seq) => batch.withTransaction(
        () => document.store.getState().addSequence(fromExtSequenceInput(seq)),
      ),
      loadProject: (result: ExtImportResult) => {
        const store = document.store.getState();
        store.loadState(fromExtImportResult(result));
        store.runCPM();
      },
      recalculate: () => document.store.getState().runCPM(),
      // Eén snapshot voor de hele reeks i.p.v. één per mutatie — lineair in plaats van
      // kwadratisch, en één undo-stap voor wat de gebruiker als één handeling ziet.
      batch: <T,>(fn: () => T): T => batch.withTransaction(fn),
    },

    events: {
      on(event: string, listener: ExtEventListener) {
        const unsub = subscribeExtensionEvent(event, listener);
        cleanupFns.push(unsub);
        return unsub;
      },
      off(event: string, listener: ExtEventListener) {
        unsubscribeExtensionEvent(event, listener);
      },
      emit(event: string, data?: unknown) {
        emitExtensionEvent(event, data);
      },
    },

    ui: {
      addRibbonButton(reg: RibbonButtonRegistration) {
        // Grensvertaling: ext-facing tabblad-id → intern tabblad-id (zie extMappers).
        host.app.store.getState().addExtensionRibbonButton({
          ...reg,
          tab: fromExtRibbonTab(reg.tab),
          extensionId,
        });
        cleanupFns.push(() => {
          host.app.store.getState().removeExtensionRibbonButton(extensionId, reg.label);
        });
      },
      showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
        host.showNotification(extensionId, message, type);
      },
    },

    settings: {
      get<T>(key: string, defaultValue: T): T {
        try {
          const raw = localStorage.getItem(settingsPrefix + key);
          return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
        } catch {
          return defaultValue;
        }
      },
      set<T>(key: string, value: T) {
        localStorage.setItem(settingsPrefix + key, JSON.stringify(value));
      },
    },

    pdfFonts: {
      register(provider: ExtFontProvider) {
        // Valideer de provider-vorm vóór registratie — een extensie-fout mag de export-registry
        // niet met een half object vervuilen.
        if (!provider || typeof provider !== 'object') {
          throw new Error(`Extensie "${extensionId}": pdfFonts.register vereist een provider-object`);
        }
        if (typeof provider.id !== 'string' || provider.id.length === 0) {
          throw new Error(`Extensie "${extensionId}": font-provider mist een geldige 'id'`);
        }
        if (typeof provider.covers !== 'function') {
          throw new Error(`Extensie "${extensionId}": font-provider mist 'covers(codepoint)'`);
        }
        if (typeof provider.getRegularBytes !== 'function') {
          throw new Error(`Extensie "${extensionId}": font-provider mist 'getRegularBytes()'`);
        }
        if (provider.getBoldBytes !== undefined && typeof provider.getBoldBytes !== 'function') {
          throw new Error(`Extensie "${extensionId}": font-provider 'getBoldBytes' moet een functie zijn`);
        }
        // registerCjkFontProvider geeft een uitschrijf-functie terug; hang 'm aan cleanupFns zodat
        // disable/unload de provider automatisch verwijdert (net als importers/ribbon-knoppen).
        // Grensvertaling: ext-facing provider → interne provider (zie extMappers).
        const unregister = registerCjkFontProvider(fromExtFontProvider(provider));
        cleanupFns.push(unregister);
      },
    },

    assets: {
      get(name: string): Uint8Array | undefined {
        const bytes = assets?.[name];
        // Kopie: de extensie mag het resultaat niet in de opgeslagen bytes muteren.
        return bytes ? bytes.slice() : undefined;
      },
    },

    _cleanup() {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
      host.app.store.getState().removeAllExtensionUI(extensionId);
    },
  };

  // Centrale permissie-afdwinging: wikkel de guarded methodes (events.*, ui.addRibbonButton,
  // importers.*, pdfFonts.register, data.getImportSource*) in checks volgens de tabel in
  // permissions.ts. De rest van data.*, settings.*, assets.get en ui.showNotification blijven
  // ongewijzigd kern-API.
  applyPermissionGuards(api as unknown as Record<string, unknown>, extensionId, permissions);

  return api;
}
