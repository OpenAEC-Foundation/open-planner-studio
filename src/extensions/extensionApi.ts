import type {
  ExtensionApi,
  ExtensionPermission,
  ImporterDefinition,
  RibbonButtonRegistration,
} from './types';
import type { ExtImportResult, ExtFontProvider } from './extTypes';
import type { AppStoreContext } from '@/state/appStore';
import type { ImportLabels } from '@/services/importTypes';
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
import { loadExtensionProject } from './retainActiveDocument';
import { createHelpApi } from './helpApi';
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
  fromExtRibbonTab,
  fromExtFontProvider,
} from './extMappers';

export { emitExtensionEvent };

export interface ExtensionHostBinding {
  app: AppStoreContext;
  showNotification(
    extensionId: string,
    message: string,
    type: 'info' | 'warning' | 'error',
  ): void;
  importLabels?(): ImportLabels;
}

function revokeApi(api: Record<string, unknown>, extensionId: string): void {
  for (const [groupName, group] of Object.entries(api)) {
    if (groupName === '_cleanup' || !group || typeof group !== 'object') continue;
    for (const [name, value] of Object.entries(group as Record<string, unknown>)) {
      if (typeof value !== 'function') continue;
      (group as Record<string, unknown>)[name] = () => {
        throw new Error(`Extensie "${extensionId}" is gedeactiveerd; ${groupName}.${name} is na uitschakelen of verwijderen niet meer beschikbaar`);
      };
    }
  }
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

    data: {
      getSelectedTaskIds: () => [...document.store.getState().selectedTaskIds],
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
        if (!state.xerSourceArchive) {
          assertNoImportSourceDrift(options?.expectedSourceProjectId, null);
          return null;
        }
        return getExtImportSourceCatalogPage(
          state.xerSourceArchive, state.xerImportMetadata, state.xerSourceProjectId, collection, options,
        );
      },
      addTask: (task) => {
        const { resourceIds: requestedResourceIds, ...input } = task;
        assertResourceIdsUnchanged('een nieuwe taak', [], requestedResourceIds);
        const added = (id: string): string => {
          if (!id) {
            throw new Error(`Extensie "${extensionId}": taak '${task.name}' niet toegevoegd — de ouder heeft `
              + 'toewijzingen die niet naar deze nieuwe subtaak kunnen (zie de melding in de app)');
          }
          return id;
        };
        if (input.parentId) assertParentAllowed(undefined, input.parentId);
        const materialize = customTaskTypeToMaterialize(input.customTaskType);
        return batch.withTransaction(() => {
          if (materialize) document.store.getState().ensureProjectTaskType(materialize);
          return added(document.store.getState().addTask(fromExtTaskAddInput(input), { phaseAssignments: 'move' }));
        });
      },
      updateTask: (id, updates) => {
        const { resourceIds: requestedResourceIds, ...withoutResourceIds } = updates;
        const current = document.store.getState().tasks.find(task => task.id === id);
        if (!current) {
          batch.withTransaction(() => document.store.getState().updateTask(id, fromExtTaskUpdates(withoutResourceIds)));
          return;
        }
        assertResourceIdsUnchanged(`taak '${id}'`, current.resourceIds, requestedResourceIds);
        const { parentId: requestedParentId, ...fieldUpdates } = withoutResourceIds;
        const move = requestedParentId !== undefined
          && (requestedParentId || null) !== (current.parentId || null)
          ? { parentId: requestedParentId || null }
          : null;
        if (move?.parentId) assertParentAllowed(id, move.parentId);
        const materialize = customTaskTypeToMaterialize(fieldUpdates.customTaskType);
        const patch = fromExtTaskUpdates(fieldUpdates);
        if (!materialize && !move && Object.keys(patch).length === 0) return;
        batch.withTransaction(() => {
          if (materialize) document.store.getState().ensureProjectTaskType(materialize);
          if (move) {
            document.store.getState().moveTaskTo(
              id, { parentId: move.parentId, childIndex: Number.MAX_SAFE_INTEGER }, { phaseAssignments: 'move' },
            );
          }
          if (!move || Object.keys(patch).length > 0) document.store.getState().updateTask(id, patch);
        });
      },
      addSequence: (seq) => batch.withTransaction(
        () => document.store.getState().addSequence(fromExtSequenceInput(seq)),
      ),
      loadProject: (result: ExtImportResult) => loadExtensionProject(document.store, result),
      recalculate: () => document.store.getState().runCPM(),
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
        if (event.startsWith('host:')) {
          throw new Error('The host: event namespace is reserved for the application.');
        }
        emitExtensionEvent(event, data);
      },
    },

    ui: {
      addRibbonButton(reg: RibbonButtonRegistration) {
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
        const unregister = registerCjkFontProvider(fromExtFontProvider(provider));
        cleanupFns.push(unregister);
      },
    },

    assets: {
      get(name: string): Uint8Array | undefined {
        const bytes = assets?.[name];
        return bytes ? bytes.slice() : undefined;
      },
    },

    help: createHelpApi({
      extensionId,
      assets,
      document,
      host,
      getApi: () => api,
      cleanupFns,
    }),

    _cleanup() {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
      host.app.store.getState().removeAllExtensionUI(extensionId);
      revokeApi(api as unknown as Record<string, unknown>, extensionId);
    },
  };

  applyPermissionGuards(api as unknown as Record<string, unknown>, extensionId, permissions);

  return api;
}
