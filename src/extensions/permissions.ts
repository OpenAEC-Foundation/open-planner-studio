import type { ExtensionPermission } from './types';
import { appLog } from '@/services/debug/appLog';
import i18next from 'i18next';

export type PermissionMode = 'throw' | 'warn';

export interface PermissionCheck {
  perm: ExtensionPermission;
  mode: PermissionMode;
}

export const API_PERMISSIONS: Record<string, PermissionCheck | null> = {
  'importers.register': { perm: 'backstage', mode: 'warn' },
  'importers.unregister': { perm: 'backstage', mode: 'warn' },

  'events.on': { perm: 'events', mode: 'throw' },
  'events.off': { perm: 'events', mode: 'throw' },
  'events.emit': { perm: 'events', mode: 'throw' },

  'ui.addRibbonButton': { perm: 'ribbon', mode: 'throw' },
  'ui.showNotification': null,

  'pdfFonts.register': { perm: 'pdf-fonts', mode: 'throw' },

  'assets.get': null,

  'data.getProject': null,
  'data.getCalendar': null,
  'data.getTasks': null,
  'data.getSelectedTaskIds': null,
  'data.getSequences': null,
  'data.getResources': null,
  'data.getAssignments': null,
  'data.addTask': null,
  'data.updateTask': null,
  'data.addSequence': null,
  'data.loadProject': null,
  'data.recalculate': null,
  'data.batch': null,

  'data.getImportSourceInfo': { perm: 'importSource', mode: 'throw' },
  'data.getImportSourceIssue': { perm: 'importSource', mode: 'throw' },
  'data.getImportSourceChunk': { perm: 'importSource', mode: 'throw' },
  'data.getImportSourceCatalogPage': { perm: 'importSource', mode: 'throw' },

  'help.registerArticles': { perm: 'help', mode: 'throw' },
  'help.unregisterArticles': { perm: 'help', mode: 'throw' },
  'help.openBundledProject': { perm: 'help', mode: 'throw' },
  'help.startGuide': { perm: 'help', mode: 'throw' },
  'help.stopGuide': { perm: 'help', mode: 'throw' },

  'settings.get': null,
  'settings.set': null,
};

export const KNOWN_PERMISSIONS: readonly ExtensionPermission[] = [
  'ribbon',
  'backstage',
  'events',
  'filesystem',
  'network',
  'pdf-fonts',
  'importSource',
  'help',
];

export function sanitizeManifestPermissions(
  raw: unknown,
  extensionId: string,
): ExtensionPermission[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<string>(KNOWN_PERMISSIONS);
  const out: ExtensionPermission[] = [];
  for (const p of raw) {
    if (typeof p !== 'string') continue;
    if (known.has(p)) {
      if (!out.includes(p as ExtensionPermission)) out.push(p as ExtensionPermission);
    } else {
      appLog.emit(
        'warn',
        `ext:${extensionId}`,
        `onbekende permissie "${p}" genegeerd (niet ondersteund door deze app-versie)`,
      );
    }
  }
  return out;
}

function enforce(
  extensionId: string,
  permissions: ExtensionPermission[],
  path: string,
  check: PermissionCheck,
): void {
  if (permissions.includes(check.perm)) return;
  if (check.mode === 'throw') {
    throw new Error(i18next.t('extensions.missingPermission', {
      ns: 'menu', extensionId, permission: check.perm,
    }));
  }
  appLog.emit(
    'warn',
    `ext:${extensionId}`,
    `mist permissie '${check.perm}' voor ${path} — nu nog toegestaan, in een toekomstige versie geweigerd`,
  );
}

export function applyPermissionGuards(
  api: Record<string, unknown>,
  extensionId: string,
  permissions: ExtensionPermission[],
): void {
  for (const [path, check] of Object.entries(API_PERMISSIONS)) {
    if (!check) continue;
    const dot = path.indexOf('.');
    const group = path.slice(0, dot);
    const method = path.slice(dot + 1);
    const target = api[group] as Record<string, unknown> | undefined;
    const original = target?.[method];
    if (typeof original !== 'function') continue;
    const bound = (original as (...a: unknown[]) => unknown).bind(target);
    target![method] = (...args: unknown[]) => {
      enforce(extensionId, permissions, path, check);
      return bound(...args);
    };
  }
}
