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
      getTasks: () => document.store.getState().tasks.map(toExtTask),
      getSequences: () => document.store.getState().sequences.map(toExtSequence),
      getResources: () => document.store.getState().resources.map(toExtResource),
      getAssignments: () => document.store.getState().assignments.map(toExtAssignment),
      addTask: (task) => document.store.getState().addTask(fromExtTaskInput(task)),
      updateTask: (id, updates) =>
        document.store.getState().updateTask(id, fromExtTaskUpdates(updates)),
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
