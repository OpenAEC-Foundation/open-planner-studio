import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { isTauri } from '@/utils/platform';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import {
  checkForUpdates,
  downloadAndInstall,
  getInstallKind,
  RELEASES_PAGE_URL,
  type InstallKind,
  type UpdateStatus,
} from '@/services/updater/updaterService';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { UPDATE_HELP_ARTICLE_ID } from '@/state/helpArticles';

const DEB_INSTALL_COMMAND =
  "url=$(curl -s https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest | grep browser_download_url | grep 'amd64\\.deb\"' | cut -d '\"' -f4); curl -L -o /tmp/ops.deb \"$url\" && sudo apt install -y /tmp/ops.deb";

export function UpdateDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const showUpdateDialog = useAppStore(s => s.ui.showUpdateDialog);

  const [currentVersion, setCurrentVersion] = useState<string>(__APP_VERSION__);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [installKind, setInstallKind] = useState<InstallKind | null>(null);
  const { copiedKey, copy } = useCopyFeedback(2000);
  const copied = copiedKey !== null;

  const close = () => setUI({ showUpdateDialog: false });

  useEffect(() => {
    if (!showUpdateDialog) return;
    let cancelled = false;
    void (async () => {
      if (!isTauri()) return;
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled) setCurrentVersion(v);
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, [showUpdateDialog]);

  useEffect(() => {
    if (!showUpdateDialog) return;
    let cancelled = false;
    setInstallKind(null);
    void getInstallKind().then(kind => { if (!cancelled) setInstallKind(kind); });
    return () => { cancelled = true; };
  }, [showUpdateDialog]);

  const runCheck = useCallback(() => {
    setBusy(true);
    setStatus({ kind: 'upToDate' });
    checkForUpdates(false, setStatus)
      .catch(() => { })
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!showUpdateDialog) return;
    runCheck();
  }, [showUpdateDialog, runCheck]);

  const handleInstall = () => {
    setBusy(true);
    setStatus({ kind: 'downloading', progress: 0, indeterminate: false });
    void downloadAndInstall(setStatus).finally(() => setBusy(false));
  };

  const handleCopyCommand = () => { void copy(DEB_INSTALL_COMMAND); };

  const handleOpenDownloads = () => {
    if (!isTauri()) {
      window.open(RELEASES_PAGE_URL, '_blank', 'noopener');
      return;
    }
    void (async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(RELEASES_PAGE_URL);
      } catch {
      }
    })();
  };

  if (!showUpdateDialog) return null;

  const isDownloading = status?.kind === 'downloading';
  const progress = isDownloading ? status.progress : 0;
  const indeterminate = isDownloading && status.indeterminate;
  const isReadyToInstall = status?.kind === 'readyToInstall';
  const isInstalling = status?.kind === 'installing';
  const isRestarting = status?.kind === 'restarting';
  const isUpdating = isDownloading || isReadyToInstall || isInstalling || isRestarting;
  const isSnap = installKind === 'snap';
  const isAur = installKind === 'aur';
  const isDeb = installKind === 'deb';
  const canAutoInstall = installKind !== null && !isSnap && !isAur;

  return (
    <Dialog
      onBackdropClick={isUpdating ? undefined : close}
      onCancel={isUpdating ? undefined : close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-h-[90vh] flex flex-col overflow-hidden"
    >
        <DialogHeader title={t('updates.dialogTitle')} onClose={close} closeDisabled={isUpdating} help={{ articleId: UPDATE_HELP_ARTICLE_ID }} />

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-small leading-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-text-secondary font-medium">{t('updates.currentVersion')}</span>
              <span className="text-text-primary font-semibold text-body leading-5">{currentVersion}</span>
            </div>
            {status?.kind === 'available' && (
              <div className="flex flex-col gap-0.5">
                <span className="text-text-secondary font-medium">{t('updates.newVersion')}</span>
                <span className="text-accent font-semibold text-body leading-5">{status.info.version}</span>
              </div>
            )}
          </div>

          {busy && status?.kind === 'upToDate' && (
            <div className="flex items-center gap-2 text-text-secondary">
              <Icon id="status.busy" size={14} className="animate-spin" />
              <span>{t('updates.checking')}</span>
            </div>
          )}

          {!busy && status?.kind === 'upToDate' && (
            <div className="flex items-center gap-2 text-text-secondary">
              <Icon id="status.success" size={14} />
              <span>{t('updates.upToDate')}</span>
            </div>
          )}

          {status?.kind === 'available' && (
            <>
              <div className="flex items-center gap-2 text-text-primary font-medium">
                <Icon id="status.update-available" size={14} className="text-text-secondary" />
                <span>{t('updates.available')}</span>
              </div>
              {status.info.body.trim().length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-text-secondary font-medium">{t('updates.releaseNotes')}</span>
                  <pre className="whitespace-pre-wrap break-words bg-surface-hover border border-border rounded-[8px] p-3 text-text-primary max-h-[180px] overflow-y-auto font-sans">
                    {status.info.body}
                  </pre>
                </div>
              )}

              {isSnap && (
                <div className="flex items-start gap-2 text-text-secondary bg-surface-hover border border-border rounded-[8px] p-3">
                  <Icon id="status.info" size={14} className="mt-0.5 shrink-0" />
                  <span>{t('updates.snapNotice')}</span>
                </div>
              )}

              {isAur && (
                <div className="flex items-start gap-2 text-text-secondary bg-surface-hover border border-border rounded-[8px] p-3" data-ops-update-package-manager-notice>
                  <Icon id="status.info" size={14} className="mt-0.5 shrink-0" />
                  <span>{t('updates.packageManagerNotice')}</span>
                </div>
              )}

            </>
          )}

          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span>{t('updates.downloading')}</span>
                {!indeterminate && <span className="tabular-nums">{progress}%</span>}
              </div>
              <div
                role="progressbar"
                aria-label={t('updates.downloading')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indeterminate ? undefined : progress}
                className="h-2 rounded-full bg-surface-hover overflow-hidden border border-border"
              >
                {indeterminate ? (
                  <div className="h-full w-1/3 bg-accent rounded-full ops-indeterminate-bar" />
                ) : (
                  <div
                    className="h-full bg-accent transition-[width] duration-150"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {(isReadyToInstall || isInstalling || isRestarting) && (
            <div role="status" className="flex items-center gap-2 text-text-secondary">
              <Icon id="status.busy" size={14} className="animate-spin" />
              <span>{isReadyToInstall ? t('updates.preparingInstall') : isInstalling ? t('updates.installing') : t('updates.restarting')}</span>
            </div>
          )}

          {status?.kind === 'error' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[var(--theme-danger,#e81123)] font-medium">
                <Icon id="status.error" size={14} />
                <span>{t('updates.error')}</span>
              </div>
              <span className="text-text-secondary break-words">{status.message}</span>
            </div>
          )}

          {status?.kind === 'error' && isDeb && (
            <div className="flex flex-col gap-2">
              <span className="text-text-secondary">{t('updates.debExplanation')}</span>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary font-medium">{t('updates.debCommandLabel')}</span>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="btn btn--sm btn--secondary flex items-center gap-1.5"
                  >
                    {copied ? <Icon id="status.success" size={13} /> : <Icon id="edit.copy" size={13} />}
                    {copied ? t('updates.copied') : t('updates.copyCommand')}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-all bg-surface-hover border border-border rounded-[8px] p-3 text-text-primary max-h-[140px] overflow-y-auto font-mono !text-body select-all">
                  {DEB_INSTALL_COMMAND}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button
            onClick={close}
            disabled={isUpdating}
            className="btn btn--sm btn--secondary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('close')}
          </button>

          {status?.kind === 'error' && (
            <button
              onClick={runCheck}
              disabled={busy}
              className="btn btn--sm btn--secondary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon id="ui.check-updates" size={13} />
              {t('updates.retry')}
            </button>
          )}

          {status?.kind === 'error' && isDeb && (
            <button
              onClick={handleOpenDownloads}
              className="btn btn--sm btn--secondary flex items-center gap-1.5"
            >
              <Icon id="link.open-external" size={13} />
              {t('updates.openDownloads')}
            </button>
          )}

          {status?.kind === 'available' && canAutoInstall && (
            <button
              onClick={handleInstall}
              disabled={busy}
              className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon id="update.install" size={13} />
              {t('updates.downloadInstall')}
            </button>
          )}
        </div>
    </Dialog>
  );
}
