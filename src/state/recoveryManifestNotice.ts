import { IndexedDbUpgradeBlockedError } from '@/utils/idb';
import type { NotificationMessageKey, NotifyInput } from './slices/types';
import { RECOVERY_HELP_ARTICLE_ID } from './helpArticles';
import { RecoveryManifestError } from '@/services/recovery/recoveryManifest';
import { RecoveryStorageUnavailableError } from '@/services/recovery/recoveryStore';

const notified = new Set<NotificationMessageKey>();

export function notifyRecoveryError(error: unknown, notify: (notice: NotifyInput) => void): boolean {
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
