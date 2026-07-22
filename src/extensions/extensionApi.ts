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
import type { ExtImportResult } from './extTypes';
import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { registerCjkFontProvider, type CjkFontProvider } from '@/services/pdf/fontRegistry';
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
} from './extMappers';

// Re-export zodat bestaande importers (index.ts) ongewijzigd blijven werken.
export { emitExtensionEvent };

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
  assets?: Record<string, Uint8Array>,
): ExtensionApi {
  const cleanupFns: (() => void)[] = [];

  const settingsPrefix = `ops-ext:${extensionId}:`;

  const api: ExtensionApi = {
    extensionId,

    importers: {
      register(def: ImporterDefinition) {
        useAppStore.getState().addExtensionImporter({ ...def, extensionId });
        cleanupFns.push(() => {
          useAppStore.getState().removeExtensionImporter(extensionId, def.id);
        });
      },
      unregister(id: string) {
        useAppStore.getState().removeExtensionImporter(extensionId, id);
      },
    },

    /** Lees-/schrijftoegang tot planningsdata. `get*` levert VERSE, MUTEERBARE Ext*-kopieën
     *  (gemapt uit de Immer-bevroren store) — muteren ervan raakt de store niet. Schrijf via
     *  addTask/updateTask/addSequence en roep daarna recalculate() aan. */
    data: {
      getProject: () => toExtProject(useAppStore.getState().project),
      getCalendar: () => toExtCalendar(useAppStore.getState().calendar),
      getTasks: () => useAppStore.getState().tasks.map(toExtTask),
      getSequences: () => useAppStore.getState().sequences.map(toExtSequence),
      getResources: () => useAppStore.getState().resources.map(toExtResource),
      getAssignments: () => useAppStore.getState().assignments.map(toExtAssignment),
      addTask: (task) => useAppStore.getState().addTask(fromExtTaskInput(task)),
      updateTask: (id, updates) =>
        useAppStore.getState().updateTask(id, fromExtTaskUpdates(updates)),
      addSequence: (seq) => useAppStore.getState().addSequence(fromExtSequenceInput(seq)),
      loadProject: (result: ExtImportResult) => {
        const store = useAppStore.getState();
        store.loadState(fromExtImportResult(result));
        store.runCPM();
      },
      recalculate: () => useAppStore.getState().runCPM(),
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
        useAppStore.getState().addExtensionRibbonButton({ ...reg, extensionId });
        cleanupFns.push(() => {
          useAppStore.getState().removeExtensionRibbonButton(extensionId, reg.label);
        });
      },
      showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
        // Zichtbaar in de debug-terminal via de app-log-bus.
        // LogLevel: 'log' | 'info' | 'warn' | 'error' | 'event'
        // 'warning' is geen geldige LogLevel; map naar 'warn'.
        const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        appLog.emit(level, `ext:${extensionId}`, message);
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
      register(provider: CjkFontProvider) {
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
        const unregister = registerCjkFontProvider(provider);
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
      useAppStore.getState().removeAllExtensionUI(extensionId);
    },
  };

  // Centrale permissie-afdwinging: wikkel de guarded methodes (events.*, ui.addRibbonButton,
  // importers.*, pdfFonts.register) in checks volgens de tabel in permissions.ts. Kern-API
  // (data.*, settings.*, assets.get, ui.showNotification) blijft ongewijzigd.
  applyPermissionGuards(api as unknown as Record<string, unknown>, extensionId, permissions);

  return api;
}
