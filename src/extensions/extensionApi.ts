/**
 * Maakt per extensie een scoped API-instantie met permissie-checks.
 * Alle registraties worden bijgehouden in cleanupFns zodat disable ze terugdraait.
 */
import type {
  ExtensionApi,
  ExtensionPermission,
  ImporterDefinition,
  RibbonButtonRegistration,
  ImportResult,
} from './types';
import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';

type ExtEventListener = (data: unknown) => void;

// Globale event-bus voor extensies
const eventListeners = new Map<string, Set<ExtEventListener>>();

export function emitExtensionEvent(event: string, data?: unknown) {
  eventListeners.get(event)?.forEach((fn) => fn(data));
}

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
): ExtensionApi {
  const cleanupFns: (() => void)[] = [];

  function requirePermission(perm: ExtensionPermission) {
    if (!permissions.includes(perm)) {
      throw new Error(`Extensie "${extensionId}" mist permissie: ${perm}`);
    }
  }

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

    data: {
      getProject: () => useAppStore.getState().project,
      getCalendar: () => useAppStore.getState().calendar,
      getTasks: () => useAppStore.getState().tasks,
      getSequences: () => useAppStore.getState().sequences,
      getResources: () => useAppStore.getState().resources,
      getAssignments: () => useAppStore.getState().assignments,
      addTask: (task) => useAppStore.getState().addTask(task),
      updateTask: (id, updates) => useAppStore.getState().updateTask(id, updates),
      addSequence: (seq) => useAppStore.getState().addSequence(seq),
      loadProject: (result: ImportResult) => {
        const store = useAppStore.getState();
        store.loadState(result);
        store.runCPM();
      },
      recalculate: () => useAppStore.getState().runCPM(),
    },

    events: {
      on(event: string, listener: ExtEventListener) {
        requirePermission('events');
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(listener);
        const unsub = () => eventListeners.get(event)?.delete(listener);
        cleanupFns.push(unsub);
        return unsub;
      },
      off(event: string, listener: ExtEventListener) {
        eventListeners.get(event)?.delete(listener);
      },
      emit(event: string, data?: unknown) {
        requirePermission('events');
        emitExtensionEvent(event, data);
      },
    },

    ui: {
      addRibbonButton(reg: RibbonButtonRegistration) {
        requirePermission('ribbon');
        useAppStore.getState().addExtensionRibbonButton({ ...reg, extensionId });
        cleanupFns.push(() => {
          useAppStore.getState().removeExtensionRibbonButton(extensionId, reg.label);
        });
      },
      showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
        // Zichtbaar in de debug-terminal én de console.
        // LogLevel: 'log' | 'info' | 'warn' | 'error' | 'event'
        // 'warning' is geen geldige LogLevel; map naar 'warn'.
        const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        appLog.emit(level, `ext:${extensionId}`, message);
        console.log(`[${extensionId}] ${message}`);
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

    _cleanup() {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
      useAppStore.getState().removeAllExtensionUI(extensionId);
    },
  };

  return api;
}
