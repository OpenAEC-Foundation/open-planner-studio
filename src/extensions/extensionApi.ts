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
  toExtProject,
  toExtCalendar,
  toExtTask,
  toExtSequence,
  toExtResource,
  toExtAssignment,
  fromExtTaskInput,
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
   * WBS-ouder vanuit `data.addTask`/`data.updateTask` toetsen VÓÓR er iets gemuteerd wordt.
   * Voorheen ging `parentId` rauw via `fromExtTaskUpdates` + `updateTask` (Object.assign) de store
   * in: `kind.parentId` wees dan naar de ouder terwijl diens `childIds` van niets wist — na `runCPM`
   * werd de ouder zo géén samenvattingstaak — en een onbekende ouder werd gewoon aangenomen. De
   * guards zijn die van de store-route (`moveTaskTo`/`planTaskPlacement`: onbekende ouder, taak
   * onder zichzelf of een eigen afstammeling), maar de store weigert stil; een extensie krijgt hier
   * een fout, in dezelfde vorm als de `customTaskType`-weigeringen hierboven. `taskId` ontbreekt
   * bij `addTask`: een nieuwe taak heeft nog geen afstammelingen, dus een kring kan daar niet.
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
      addTask: (task) => {
        // Een bestaande ouder hangt de store-`addTask` zelf aan beide kanten op; alleen een
        // onbekende ouder liet hij als bungelende `parentId` staan. `''` ⇒ wortel, net als daar
        // (`partial.parentId || null`).
        if (task.parentId) assertParentAllowed(undefined, task.parentId);
        const materialize = customTaskTypeToMaterialize(task.customTaskType);
        if (!materialize) return document.store.getState().addTask(fromExtTaskInput(task));
        // Catalogus + toewijzing vormen voor de gebruiker één wijziging en dus één undo-stap.
        return batch.withTransaction(() => {
          document.store.getState().ensureProjectTaskType(materialize);
          return document.store.getState().addTask(fromExtTaskInput(task));
        });
      },
      updateTask: (id, updates) => {
        // Bestaand API-gedrag voor een onbekend taak-id is een stille no-op; materialiseer in dat
        // geval ook geen los catalogusitem waar uiteindelijk geen taaktoewijzing tegenover staat.
        const current = document.store.getState().tasks.find(task => task.id === id);
        if (!current) {
          document.store.getState().updateTask(id, fromExtTaskUpdates(updates));
          return;
        }
        // Een ouderwijziging is een VERPLAATSING, geen veld: ze loopt via dezelfde store-actie als
        // rij-slepen (`moveTaskTo`), die `parentId`, beide `childIds` en de rauwe takenvolgorde
        // samen bijwerkt. Daarom nooit mee in de kale veldpatch. Dezelfde ouder (ook een
        // `getTasks()`-object dat ongewijzigd terugkomt) is geen verplaatsing; `''` ⇒ wortel.
        const { parentId: requestedParentId, ...fieldUpdates } = updates;
        const move = requestedParentId !== undefined
          && (requestedParentId || null) !== (current.parentId || null)
          ? { parentId: requestedParentId || null }
          : null;
        if (move?.parentId) assertParentAllowed(id, move.parentId);
        const materialize = customTaskTypeToMaterialize(updates.customTaskType);
        const patch = fromExtTaskUpdates(fieldUpdates);
        if (!materialize && !move) {
          document.store.getState().updateTask(id, patch);
          return;
        }
        // Catalogus, verplaatsing en veldwijziging vormen voor de gebruiker één wijziging en dus
        // één undo-stap. Eerst verplaatsen: met WBS-autonummering hernummert `moveTaskTo`, en een
        // `wbsCode` uit dezelfde aanroep blijft dan net als voorheen staan.
        batch.withTransaction(() => {
          if (materialize) document.store.getState().ensureProjectTaskType(materialize);
          // Index voorbij het einde wordt in de store geklemd ⇒ achteraan bij de nieuwe ouder, zoals
          // het wijzigen van de ouder in het taakvenster (`moveTask` zonder positie).
          if (move) document.store.getState().moveTaskTo(id, { parentId: move.parentId, childIndex: Number.MAX_SAFE_INTEGER });
          if (!move || Object.keys(patch).length > 0) document.store.getState().updateTask(id, patch);
        });
      },
      addSequence: (seq) => document.store.getState().addSequence(fromExtSequenceInput(seq)),
      loadProject: (result: ExtImportResult) => {
        const store = document.store.getState();
        store.loadState(fromExtImportResult(result));
        store.runCPM();
      },
      recalculate: () => document.store.getState().runCPM(),
      // K-item 32: één snapshot voor de hele reeks i.p.v. één per mutatie — lineair in plaats van
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
  // importers.*, pdfFonts.register) in checks volgens de tabel in permissions.ts. Kern-API
  // (data.*, settings.*, assets.get, ui.showNotification) blijft ongewijzigd.
  applyPermissionGuards(api as unknown as Record<string, unknown>, extensionId, permissions);

  return api;
}
