import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { documentTitle } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import type { RecoveryEntry } from '@/components/dialogs/RecoveryDialog';
import { type RecoveryDocInput } from '@/state/documentContract';
import { loadRecovery, clearRecovery, holdRecoveryForLater } from '@/services/recovery/recoveryStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';
import { remnantNotices } from '@/state/ownFileReplace';
import { settlePendingReplaces } from '@/services/fileAccess/replaceRecords';

export interface RecoveryState {
  entries: RecoveryEntry[];
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export interface RecoveryRestore {
  recovery: RecoveryState | null;
  recoveryResolved: boolean;
  autoSaveEnabled: MutableRefObject<boolean>;
}

export function useRecoveryRestore(): RecoveryRestore {
  const { t } = useTranslation('common');
  const startupTRef = useRef(t);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [recoveryResolved, setRecoveryResolved] = useState(false);
  const autoSaveEnabled = useRef(false);

  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    void (async () => {
      const finish = () => { autoSaveEnabled.current = true; setRecoveryResolved(true); };
      try {
        for (const notice of remnantNotices(await settlePendingReplaces())) useAppStore.getState().notify(notice);
      } catch (error) {
        console.error('Onafgeronde vervangingen niet afgehandeld:', error);
      }
      try {
        const loaded = await loadRecovery();
        const readFailures = loaded.readFailures ?? [];
        if (loaded.docs.length === 0 && readFailures.length === 0) { finish(); return; }
        for (const failure of readFailures) {
          useAppStore.getState().notify({
            severity: 'error', messageKey: 'notifications.recoveryReadFailed',
            detail: failure.detail, dedupeKey: 'recovery-read',
          });
        }

        const restored: RecoveryDocInput[] = [];
        const entries: RecoveryEntry[] = [];
        let failed = readFailures.length;
        for (const d of loaded.docs) {
          try {
            const input = await readRecoveryDocument(d, loaded.archives,
              ifcForeignContentEnabled(useAppStore.getState().ui.featureFlags), buildImportLabels(startupTRef.current));
            restored.push(input);
            entries.push({
              id: d.id,
              name: documentTitle(d.filePath, input.project.name, documentProjectCode(input.project, input.xer)),
              filePath: d.filePath,
              taskCount: input.tasks.length,
              mtime: d.mtime,
            });
          } catch (err) {
            failed++;
            console.error('Failed to read recovery document:', d.id, err);
            useAppStore.getState().notify({
              severity: 'error',
              messageKey: 'notifications.recoveryReadFailed',
              detail: (err as Error).message,
              dedupeKey: 'recovery-read',
            });
          }
        }

        if (entries.length === 0 && failed === 0) {
          await clearRecovery();
          finish();
          return;
        }

        setRecovery({
          entries,
          onRestore: () => {
            void (async () => {
              try {
                const skipped = restored.length > 0
                  ? useAppStore.getState().restoreDocuments(restored, loaded.activeDocumentId).skippedIds
                  : [];
                setRecovery(null);
                if (failed === 0 && skipped.length === 0) await clearRecovery();
                else await holdRecoveryForLater(restored.filter(doc => !skipped.includes(doc.id)).map(doc => doc.id));
              } catch (err) {
                console.error('Recovery: herstellen mislukt — snapshots blijven staan:', err);
                if (!notifyRecoveryError(err, useAppStore.getState().notify)) useAppStore.getState().notify({
                  severity: 'error',
                  messageKey: 'notifications.recoveryRestoreFailed',
                  detail: (err as Error).message,
                });
                try {
                  await holdRecoveryForLater();
                } catch (holdErr) {
                  console.error('Recovery: snapshots vasthouden na mislukt herstel mislukt:', holdErr);
                }
              } finally {
                setRecovery(null);
                finish();
              }
            })();
          },
          onDiscard: () => {
            void clearRecovery().catch((err: unknown) => {
              if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
                console.error('Recovery: verwerpen mislukt:', err);
              }
            });
            setRecovery(null);
            finish();
          },
          onClose: () => {
            setRecovery(null);
            void holdRecoveryForLater()
              .catch((err: unknown) => {
                if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
                  console.error('Recovery: uitstellen kon de snapshots niet vasthouden:', err);
                }
              })
              .finally(finish);
          },
        });
      } catch (err) {
        if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
          console.error('Recovery check failed:', err);
        }
        finish();
      }
    })();
  }, []);

  return { recovery, recoveryResolved, autoSaveEnabled };
}
