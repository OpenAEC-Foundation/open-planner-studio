import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { RECOVERY_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { useTimeNotation } from '@/hooks/displayDate';
import { formatLocalDateTime } from '@/utils/displayTime';

export interface RecoveryEntry {
  id: string;
  name: string;
  filePath: string | null;
  taskCount: number;
  mtime: Date | null;
}

interface RecoveryDialogProps {
  entries: RecoveryEntry[];
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
  onHelp: () => void;
}

export function RecoveryDialog({ entries, onRestore, onDiscard, onClose, onHelp }: RecoveryDialogProps) {
  const { t, i18n } = useTranslation('common');
  const timeNotation = useTimeNotation();
  const unreadableOnly = entries.length === 0;


  return (
    <Dialog
      onBackdropClick={onClose}
      onCancel={onClose}
      onConfirm={unreadableOnly ? onClose : onRestore}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-recovery-dialog': true }}
    >
        <DialogHeader
          title={t('recovery.dialogTitle')}
          onClose={onClose}
          help={{ articleId: RECOVERY_HELP_ARTICLE_ID, close: onHelp }}
        />

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-small leading-4">
          <p className="text-text-secondary leading-relaxed">{t(unreadableOnly ? 'recovery.unreadableOnlyExplanation' : 'recovery.explanation')}</p>

          <ul className="flex flex-col gap-2">
            {entries.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-2.5 bg-surface-hover border border-border rounded-[8px] p-3"
              >
                <Icon id="file.type-project" size={15} className="text-text-secondary mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-text-primary font-semibold !text-large truncate">
                    {entry.name || t('project.untitled')}
                  </span>
                  {entry.filePath && (
                    <span className="text-text-secondary truncate" title={entry.filePath}>
                      {entry.filePath}
                    </span>
                  )}
                  <div className="flex items-center gap-3 text-text-secondary mt-0.5">
                    <span>{t('recovery.taskCount', { count: entry.taskCount })}</span>
                    {entry.mtime && (
                      <span>{t('recovery.timeLabel')}: {formatLocalDateTime(entry.mtime, i18n.language, timeNotation)}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onDiscard} className="btn btn--sm btn--secondary">
            {t(unreadableOnly ? 'recovery.deleteCopies' : 'recovery.dontRestore')}
          </button>
          <button
            onClick={unreadableOnly ? onClose : onRestore}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] flex items-center gap-1.5"
          >
            {!unreadableOnly && <Icon id="backup.recover" size={13} />}
            {t(unreadableOnly ? 'recovery.keepCopies' : 'recovery.restore')}
          </button>
        </div>
    </Dialog>
  );
}
