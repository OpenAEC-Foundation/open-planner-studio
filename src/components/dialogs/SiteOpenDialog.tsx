import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import { useAppStore } from '@/state/appStore';
import { formatLocalDateTime } from '@/utils/displayTime';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { answerSiteOpen } from '@/state/siteDialogBridge';
import { listSiteFiles, listSiteVersions } from '@/services/fileAccess/siteBackend';
import { siteErrorMessage, type SiteFileInfo, type SiteVersionInfo } from '@/services/fileAccess/siteHost';

/** Laadtoestand van een lijst van de site: laden, fout (met de tekst van de site) of klaar. */
type Loaded<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: T[] };

/** Bestandsnaam zonder extensie, voor de naam van een kopie van een oudere versie. */
function baseName(name: string): string {
  return name.replace(/\.[^.\\/]+$/, '');
}

/**
 * "Openen van de site" (issue #309). Rendert alleen bij `ui.pendingSiteOpen`; het antwoord gaat via
 * `answerSiteOpen` (`state/siteDialogBridge.ts`). Toont de bestanden van de site, per bestand een
 * uitklapbare lijst met versies, en "Van deze pc…" voor de gewone bestandskiezer.
 *
 * Laden, een lege lijst en een laadfout zijn alle drie zichtbaar: een site die (even) niet antwoordt
 * mag er nooit uitzien als "er staat niets".
 */
export function SiteOpenDialog() {
  const pending = useAppStore((s) => s.ui.pendingSiteOpen);
  if (!pending) return null;
  return <SiteOpenDialogBody extensions={pending.extensions} />;
}

function SiteOpenDialogBody({ extensions }: { extensions: string[] }) {
  const { t, i18n } = useTranslation('common');
  const timeNotation = useAppStore((s) => s.ui.timeNotation);
  const [files, setFiles] = useState<Loaded<SiteFileInfo>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [versions, setVersions] = useState<Record<string, Loaded<SiteVersionInfo>>>({});

  useEffect(() => {
    let cancelled = false;
    void listSiteFiles(extensions).then(
      (items) => { if (!cancelled) setFiles({ status: 'ready', items }); },
      (err: unknown) => { if (!cancelled) setFiles({ status: 'error', message: siteErrorMessage(err) }); },
    );
    return () => { cancelled = true; };
  }, [extensions, attempt]);

  const retry = () => {
    setFiles({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  const toggleVersions = (id: string) => {
    if (versions[id]) {
      setVersions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setVersions((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    void listSiteVersions(id).then(
      (items) => setVersions((prev) => (prev[id] ? { ...prev, [id]: { status: 'ready', items } } : prev)),
      (err: unknown) => setVersions((prev) => (
        prev[id] ? { ...prev, [id]: { status: 'error', message: siteErrorMessage(err) } } : prev
      )),
    );
  };

  const cancel = () => answerSiteOpen(null);
  const openLatest = (file: SiteFileInfo) => answerSiteOpen({ kind: 'site', id: file.id });
  const openVersion = (file: SiteFileInfo, version: SiteVersionInfo) => {
    // De nieuwste versie uit de lijst is gewoon "het bestand openen", met de site als opslagdoel.
    if (file.version !== undefined && version.version === file.version) {
      openLatest(file);
      return;
    }
    answerSiteOpen({
      kind: 'site',
      id: file.id,
      version: version.version,
      copyName: t('siteFiles.versionCopyName', { name: baseName(file.name), version: version.label || version.version }),
    });
  };

  const when = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatLocalDateTime(date, i18n.language, timeNotation);
  };

  return (
    <Dialog
      onCancel={cancel}
      // Dezelfde laag als "Opslaan op de site": een vraag van een bestandshandeling ligt boven elke
      // dialoog waaruit die handeling kwam (ook de sluitvraag van een tabblad, z-index 80).
      overlayClassName="bg-black/60 z-[90]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-site-open-dialog': true }}
    >
      <DialogHeader title={t('siteFiles.openTitle')} onClose={cancel} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4" aria-live="polite">
        {files.status === 'loading' && (
          <div className="text-text-secondary" data-ops-site-open-loading>{t('siteFiles.loading')}</div>
        )}

        {files.status === 'error' && (
          <div className="flex flex-col gap-2" data-ops-site-open-error>
            <div className="text-critical">{t('siteFiles.loadFailed')}</div>
            <div className="text-text-secondary break-words">{files.message}</div>
            <div>
              <button className="btn btn--sm btn--secondary flex items-center gap-1.5" onClick={retry}>
                <B2Icon name="ui.refresh" size={13} />
                {t('siteFiles.retry')}
              </button>
            </div>
          </div>
        )}

        {files.status === 'ready' && files.items.length === 0 && (
          <div className="text-text-secondary" data-ops-site-open-empty>{t('siteFiles.empty')}</div>
        )}

        {files.status === 'ready' && files.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-2">
              {files.items.map((file) => {
                const fileVersions = versions[file.id];
                const modified = when(file.modified);
                return (
                  <li
                    key={file.id}
                    className="bg-surface-hover border border-border rounded-[8px] flex flex-col"
                    data-ops-site-file={file.id}
                  >
                    <div className="flex items-stretch">
                      <button
                        className="p-2 hover:bg-surface rounded-l-[8px] text-text-secondary"
                        onClick={() => toggleVersions(file.id)}
                        aria-expanded={!!fileVersions}
                        aria-label={t(fileVersions ? 'siteFiles.hideVersions' : 'siteFiles.showVersions')}
                        title={t(fileVersions ? 'siteFiles.hideVersions' : 'siteFiles.showVersions')}
                        data-ops-site-versions-toggle
                      >
                        {fileVersions ? <B2Icon name="tree.collapse" size={14} /> : <B2Icon name="tree.expand" size={14} />}
                      </button>
                      <button
                        className="flex-1 min-w-0 flex items-start gap-2.5 p-2.5 text-left hover:bg-surface rounded-r-[8px]"
                        onClick={() => openLatest(file)}
                        title={t('siteFiles.open')}
                        data-ops-site-file-open
                      >
                        <B2Icon name="file.type-other" size={15} className="text-accent mt-0.5 shrink-0" />
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-text-primary font-semibold !text-large truncate">{file.name}</span>
                          {modified && <span className="text-text-secondary">{modified}</span>}
                        </span>
                      </button>
                    </div>

                    {fileVersions && (
                      <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5" data-ops-site-versions>
                        {fileVersions.status === 'loading' && (
                          <div className="text-text-secondary">{t('siteFiles.versionsLoading')}</div>
                        )}
                        {fileVersions.status === 'error' && (
                          <div className="flex flex-col gap-1">
                            <div className="text-critical">{t('siteFiles.versionsFailed')}</div>
                            <div className="text-text-secondary break-words">{fileVersions.message}</div>
                          </div>
                        )}
                        {fileVersions.status === 'ready' && fileVersions.items.length === 0 && (
                          <div className="text-text-secondary">{t('siteFiles.versionsEmpty')}</div>
                        )}
                        {fileVersions.status === 'ready' && fileVersions.items.map((version) => {
                          const latest = file.version !== undefined && version.version === file.version;
                          const versionWhen = when(version.modified);
                          return (
                            <div key={version.version} className="flex items-center gap-2" data-ops-site-version={version.version}>
                              <span className="flex-1 min-w-0 flex flex-col">
                                <span className="text-text-primary font-semibold truncate">
                                  {t('siteFiles.versionLabel', { version: version.label || version.version })}
                                  {latest && <span className="text-text-secondary font-normal"> · {t('siteFiles.versionLatest')}</span>}
                                </span>
                                {(versionWhen || version.author) && (
                                  <span className="text-text-secondary truncate">
                                    {[versionWhen, version.author ? t('siteFiles.byAuthor', { author: version.author }) : null]
                                      .filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </span>
                              <button
                                className="btn btn--sm btn--secondary shrink-0"
                                onClick={() => openVersion(file, version)}
                                data-ops-site-version-open
                              >
                                {latest ? t('siteFiles.open') : t('siteFiles.openCopy')}
                              </button>
                            </div>
                          );
                        })}
                        {fileVersions.status === 'ready' && fileVersions.items.length > 0 && (
                          <p className="text-text-secondary">{t('siteFiles.copyHint')}</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="flex justify-between gap-2 px-4 py-3 border-t border-border">
        <button
          className="btn btn--sm btn--secondary flex items-center gap-1.5"
          onClick={() => answerSiteOpen({ kind: 'local' })}
          data-ops-site-open-local
        >
          <B2Icon name="file.open" size={13} />
          {t('siteFiles.fromThisPc')}
        </button>
        <button className="btn btn--sm btn--secondary" onClick={cancel}>{t('cancel')}</button>
      </div>
    </Dialog>
  );
}
