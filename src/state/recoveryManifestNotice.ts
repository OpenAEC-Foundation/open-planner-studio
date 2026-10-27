import { IndexedDbUpgradeBlockedError } from '@/utils/idb';
import type { NotificationMessageKey, NotifyInput } from './slices/types';
import { RECOVERY_HELP_ARTICLE_ID } from './helpArticles';
import { RecoveryManifestError } from '@/services/recovery/recoveryManifest';
import { RecoveryStorageUnavailableError } from '@/services/recovery/recoveryStore';

// Startup, uitstellen en de ~10s-schrijfrondes delen per foutsoort één melding, ook na wegklikken.
const notified = new Set<NotificationMessageKey>();

/** `true` betekent afgehandeld, ook als deze sessie al eerder een melding gaf. */
export function notifyRecoveryError(error: unknown, notify: (notice: NotifyInput) => void): boolean {
  // Geweigerde opslag (sandbox-iframe zonder `allow-same-origin`, issue #582): crashherstel staat
  // stil uit voor deze sessie. Afgehandeld, bewust zonder melding.
  if (error instanceof RecoveryStorageUnavailableError) return true;
  const messageKey = error instanceof RecoveryManifestError ? 'notifications.recoveryManifestBlocked'
    : error instanceof IndexedDbUpgradeBlockedError ? 'notifications.recoveryStorageBlocked' : null;
  if (!messageKey) return false;
  if (!notified.has(messageKey)) {
    notified.add(messageKey);
    notify({
      severity: 'error', messageKey,
      dedupeKey: error instanceof RecoveryManifestError ? 'recovery-manifest' : 'recovery-storage',
      helpArticleId: RECOVERY_HELP_ARTICLE_ID,
    });
  }
  return true;
}
