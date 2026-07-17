/**
 * ÉÉN declaratieve bron voor de permissie-afdwinging van de extensie-API (audit P16/D3).
 *
 * Vóór dit pakket zaten `requirePermission`-aanroepen verspreid door `extensionApi.ts` en dekten ze
 * maar 2 van de 6 gedeclareerde permissies. Nu staat élk API-methode-pad hier met zijn vereiste
 * permissie (of `null` voor de kern-API), en past één generieke wrapper (`applyPermissionGuards`)
 * de checks toe. Wil je het permissiegedrag van een methode weten of wijzigen, dan is dit de enige plek.
 */
import type { ExtensionPermission } from './types';
import { appLog } from '@/services/debug/appLog';

/**
 * Afdwing-modus per guard:
 *   • 'throw' — ontbrekende permissie ⇒ gooi een fout naar de extensie (harde grens).
 *   • 'warn'  — ontbrekende permissie ⇒ appLog-warn, mét doorlaten (compat-modus, zie hieronder).
 */
export type PermissionMode = 'throw' | 'warn';

export interface PermissionCheck {
  perm: ExtensionPermission;
  mode: PermissionMode;
}

/**
 * API-methode-pad → vereiste permissie, of `null` voor de kern-API (altijd toegestaan).
 *
 * Toewijzingen (ontwerp P16):
 *   • events.*            → 'events'    (throw)
 *   • ui.addRibbonButton  → 'ribbon'    (throw)
 *   • importers.*         → 'backstage' (WARN) — compat: de gepubliceerde referentie-extensie
 *       registreert een importer zonder 'backstage' te declareren. Hard afdwingen zou bestaande,
 *       geïnstalleerde extensies breken; daarom nu warn-modus (deprecatiepad). Zie docs/extensions.md.
 *   • data.*, settings.*, ui.showNotification → null (kern-API, gedocumenteerd).
 *
 * 'filesystem'/'network' staan bewust NIET in deze tabel: ze hebben geen API-oppervlak en zijn in
 * same-context JS niet technisch afdwingbaar. Ze zijn puur installatie-informatief (getoonde intentie),
 * niet een sandbox-garantie — zie de permissie-uitleg in docs/extensions.md.
 */
export const API_PERMISSIONS: Record<string, PermissionCheck | null> = {
  // Importers — compat-warn (zie hierboven).
  'importers.register': { perm: 'backstage', mode: 'warn' },
  'importers.unregister': { perm: 'backstage', mode: 'warn' },

  // Event-bus — hard.
  'events.on': { perm: 'events', mode: 'throw' },
  'events.off': { perm: 'events', mode: 'throw' },
  'events.emit': { perm: 'events', mode: 'throw' },

  // UI — ribbon hard, notificatie is kern.
  'ui.addRibbonButton': { perm: 'ribbon', mode: 'throw' },
  'ui.showNotification': null,

  // Data — kern-API.
  'data.getProject': null,
  'data.getCalendar': null,
  'data.getTasks': null,
  'data.getSequences': null,
  'data.getResources': null,
  'data.getAssignments': null,
  'data.addTask': null,
  'data.updateTask': null,
  'data.addSequence': null,
  'data.loadProject': null,
  'data.recalculate': null,

  // Settings — kern-API.
  'settings.get': null,
  'settings.set': null,
};

/** Alle permissie-strings die deze app-versie kent (bron van waarheid voor validatie + SDK). */
export const KNOWN_PERMISSIONS: readonly ExtensionPermission[] = [
  'ribbon',
  'backstage',
  'events',
  'filesystem',
  'network',
];

/**
 * Filter een (mogelijk uit een nieuwere extensie afkomstige) permissie-lijst tot wat deze
 * app-versie kent. Onbekende strings worden weggelaten met een appLog-warn — forward-compat:
 * een extensie voor een latere versie installeert/activeert nog steeds, ze verliest alleen de
 * onbekende permissie(s). Legt géén dubbele waarden of niet-string-invoer door.
 */
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

/** Voer de permissie-check voor één guarded pad uit: gooi (throw-modus) of waarschuw (warn-modus). */
function enforce(
  extensionId: string,
  permissions: ExtensionPermission[],
  path: string,
  check: PermissionCheck,
): void {
  if (permissions.includes(check.perm)) return;
  if (check.mode === 'throw') {
    throw new Error(`Extensie "${extensionId}" mist permissie: ${check.perm}`);
  }
  // warn-modus: doorlaten, maar loggen (deprecatiepad).
  appLog.emit(
    'warn',
    `ext:${extensionId}`,
    `mist permissie '${check.perm}' voor ${path} — nu nog toegestaan, in een toekomstige versie geweigerd`,
  );
}

/**
 * Wikkel de guarded methodes van een reeds opgebouwde API-instantie in één keer in permissie-checks.
 * Alleen paden met een niet-`null` entry in {@link API_PERMISSIONS} worden ingepakt; kern-API
 * (`null`) blijft ongewijzigd. De methode wordt aan zijn groep gebonden zodat `this` klopt.
 */
export function applyPermissionGuards(
  api: Record<string, unknown>,
  extensionId: string,
  permissions: ExtensionPermission[],
): void {
  for (const [path, check] of Object.entries(API_PERMISSIONS)) {
    if (!check) continue; // kern-API — geen guard
    const dot = path.indexOf('.');
    const group = path.slice(0, dot);
    const method = path.slice(dot + 1);
    const target = api[group] as Record<string, unknown> | undefined;
    const original = target?.[method];
    if (typeof original !== 'function') continue; // pad bestaat niet (defensief)
    const bound = (original as (...a: unknown[]) => unknown).bind(target);
    target![method] = (...args: unknown[]) => {
      enforce(extensionId, permissions, path, check);
      return bound(...args);
    };
  }
}
