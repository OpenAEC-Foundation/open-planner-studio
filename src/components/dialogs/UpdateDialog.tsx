import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Download, RefreshCw, AlertTriangle, CheckCircle2, RotateCw, Copy, Check, ExternalLink, PackageOpen } from 'lucide-react';
import { isTauri } from '@/utils/platform';
import {
  checkForUpdates,
  downloadAndInstall,
  getInstallKind,
  RELEASES_PAGE_URL,
  type InstallKind,
  type UpdateStatus,
} from '@/services/updater/updaterService';

// Copy-paste-commando voor handmatige .deb-installatie: zoekt zelf de juiste
// amd64.deb-asset op via de GitHub-release-API en installeert die.
// NB: de grep matcht op de afsluitende quote (amd64.deb") zodat het bijhorende
// amd64.deb.sig-asset niet óók matcht — anders bevat $url twee URL's en faalt
// curl met "URL rejected: Malformed input to a URL function".
const DEB_INSTALL_COMMAND =
  "url=$(curl -s https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest | grep browser_download_url | grep 'amd64\\.deb\"' | cut -d '\"' -f4); curl -L -o /tmp/ops.deb \"$url\" && sudo apt install -y /tmp/ops.deb";

/**
 * Software-update-dialog.
 *
 * Toont de huidige versie vs. de beschikbare versie + release-notes, een
 * voortgangsbalk tijdens het downloaden, en foutafhandeling met "Opnieuw
 * proberen". `downloadAndInstall` herstart de app zelf na installatie.
 *
 * KRITIEK: alle `@tauri-apps/*`-imports zijn DYNAMISCH en gegate achter
 * `isTauri()` (zie `getCurrentVersion`). In de web-build no-opt de updater:
 * de status komt direct op `upToDate` te staan.
 */
export function UpdateDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const showUpdateDialog = useAppStore(s => s.ui.showUpdateDialog);

  const [currentVersion, setCurrentVersion] = useState<string>(__APP_VERSION__);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // Install-type bepaalt of/hoe we de update installeren (snap/deb/appimage/native).
  const [installKind, setInstallKind] = useState<InstallKind>('native');
  const [copied, setCopied] = useState(false);

  const close = () => setUI({ showUpdateDialog: false });

  // Huidige app-versie ophalen via de Tauri app-API (web: terugval op de
  // build-time versie uit vite-define).
  useEffect(() => {
    if (!showUpdateDialog) return;
    let cancelled = false;
    (async () => {
      if (!isTauri()) return;
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled) setCurrentVersion(v);
      } catch {
        /* terugval op __APP_VERSION__ */
      }
    })();
    return () => { cancelled = true; };
  }, [showUpdateDialog]);

  // Install-type ophalen (web/fout → 'native', dus de bestaande flow blijft).
  useEffect(() => {
    if (!showUpdateDialog) return;
    let cancelled = false;
    void getInstallKind().then(kind => { if (!cancelled) setInstallKind(kind); });
    return () => { cancelled = true; };
  }, [showUpdateDialog]);

  // Bij openen: meteen (niet-stil) controleren op updates.
  const runCheck = () => {
    setBusy(true);
    setStatus({ kind: 'upToDate' }); // tussentijds — UI toont "controleren…" via busy
    checkForUpdates(false, setStatus)
      .catch(() => { /* fout komt via onStatus binnen */ })
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (!showUpdateDialog) return;
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpdateDialog]);

  // Esc sluit dialog (niet tijdens een actieve download).
  useEffect(() => {
    if (!showUpdateDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status?.kind !== 'downloading') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpdateDialog, status]);

  const handleInstall = () => {
    setBusy(true);
    setStatus({ kind: 'downloading', progress: 0, indeterminate: false });
    // downloadAndInstall herstart de app zelf na afloop; faalt het, dan komt
    // er een error-status binnen.
    void downloadAndInstall(setStatus).finally(() => setBusy(false));
  };

  // Het .deb-installeer-commando naar het klembord kopiëren (+ korte "gekopieerd").
  const handleCopyCommand = () => {
    void navigator.clipboard.writeText(DEB_INSTALL_COMMAND)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => { /* klembord niet beschikbaar — stil negeren */ });
  };

  // De GitHub-release-pagina openen in de standaardbrowser.
  // KRITIEK: `@tauri-apps/plugin-shell` dynamisch + `isTauri()`-guarded.
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
        /* openen mislukt — stil negeren */
      }
    })();
  };

  if (!showUpdateDialog) return null;

  const isDownloading = status?.kind === 'downloading';
  const progress = isDownloading ? status.progress : 0;
  const indeterminate = isDownloading && status.indeterminate;
  const isReadyToInstall = status?.kind === 'readyToInstall';
  // Toon de installeer-/handmatige-flow alleen op platforms waar dat zin heeft.
  const isSnap = installKind === 'snap';
  const isDeb = installKind === 'deb';
  const canAutoInstall = !isSnap && !isDeb;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={() => { if (!isDownloading) close(); }}
    >
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('updates.dialogTitle')}
          </span>
          <button
            onClick={close}
            disabled={isDownloading}
            className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {/* Versie-overzicht */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-text-secondary font-medium">{t('updates.currentVersion')}</span>
              <span className="text-text-primary font-semibold text-sm">{currentVersion}</span>
            </div>
            {status?.kind === 'available' && (
              <div className="flex flex-col gap-0.5">
                <span className="text-text-secondary font-medium">{t('updates.newVersion')}</span>
                <span className="text-accent font-semibold text-sm">{status.info.version}</span>
              </div>
            )}
          </div>

          {/* Status-melding */}
          {busy && !isDownloading && (
            <div className="flex items-center gap-2 text-text-secondary">
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('updates.checking')}</span>
            </div>
          )}

          {!busy && status?.kind === 'upToDate' && (
            <div className="flex items-center gap-2 text-text-secondary">
              <CheckCircle2 size={14} className="text-accent" />
              <span>{t('updates.upToDate')}</span>
            </div>
          )}

          {status?.kind === 'available' && (
            <>
              <div className="flex items-center gap-2 text-text-primary font-medium">
                <Download size={14} className="text-accent" />
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

              {/* Snap: snapd/Snap Store werkt zelf bij — geen in-app installatie. */}
              {isSnap && (
                <div className="flex items-start gap-2 text-text-secondary bg-surface-hover border border-border rounded-[8px] p-3">
                  <PackageOpen size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>{t('updates.snapNotice')}</span>
                </div>
              )}

              {/* .deb: handmatig — copy-paste-commando + downloadpagina. */}
              {isDeb && (
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
                        {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                        {copied ? t('updates.copied') : t('updates.copyCommand')}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all bg-surface-hover border border-border rounded-[8px] p-3 text-text-primary max-h-[140px] overflow-y-auto font-mono text-[11px] select-all">
                      {DEB_INSTALL_COMMAND}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}

          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span>{isReadyToInstall ? t('updates.installing') : t('updates.downloading')}</span>
                {!indeterminate && <span className="tabular-nums">{progress}%</span>}
              </div>
              <div className="h-2 rounded-full bg-surface-hover overflow-hidden border border-border">
                {indeterminate ? (
                  // Onbepaalde voortgang: geen totale grootte bekend → lopende balk.
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

          {status?.kind === 'readyToInstall' && (
            <div className="flex items-center gap-2 text-text-secondary">
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('updates.restarting')}</span>
            </div>
          )}

          {status?.kind === 'error' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[var(--theme-danger,#e81123)] font-medium">
                <AlertTriangle size={14} />
                <span>{t('updates.error')}</span>
              </div>
              <span className="text-text-secondary break-words">{status.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button
            onClick={close}
            disabled={isDownloading}
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
              <RotateCw size={13} />
              {t('updates.retry')}
            </button>
          )}

          {status?.kind === 'available' && isDeb && (
            <button
              onClick={handleOpenDownloads}
              className="btn btn--sm btn--secondary flex items-center gap-1.5"
            >
              <ExternalLink size={13} />
              {t('updates.openDownloads')}
            </button>
          )}

          {status?.kind === 'available' && canAutoInstall && (
            <button
              onClick={handleInstall}
              disabled={busy}
              className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={13} />
              {t('updates.downloadInstall')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
