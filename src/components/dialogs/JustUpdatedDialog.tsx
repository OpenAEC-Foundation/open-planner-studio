import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, ArrowDown, ArrowUp, ExternalLink, Download, Library, GitBranch, ListTree, Boxes, BookOpen } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { getInstallKind } from '@/services/updater/updaterService';
import { fetchReleaseComparison, type ReleaseComparison } from '@/services/updater/releaseInfo';
import { formatBytes } from '@/utils/formatBytes';
import { getReleaseHighlights, type HighlightIcon, type ReleaseHighlight } from '@/services/updater/releaseHighlights';
import { isTauri } from '@/utils/platform';

const CHANGELOG_URL = 'https://github.com/OpenAEC-Foundation/open-planner-studio/wiki/Changelog';
const ICONS: Record<HighlightIcon, typeof Download> = { import: Download, library: Library, relations: GitBranch, tasks: ListTree, examples: Boxes };

async function openExternal(url: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } else {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) return false;
    }
    return true;
  } catch { return false; }
}

/**
 * "Je bent net geüpdatet"-dialoog. Toont de versiesprong plus drie weetjes over de update:
 * grootteverschil van de installer, dagen sinds de vorige release en de GitHub-release-beschrijving.
 * Verschijnt zodra `ui.justUpdated` gevuld is (gezet door de opstart-detectie in useUpdateCheck, of
 * handmatig via Instellingen → "Wat is er nieuw"). Is `from` `null` (verse installatie / geen
 * eerdere versie bekend), dan tonen we geen pijl maar enkel de huidige versie.
 * Elke weetjes-regel toont zich alléén als de bijbehorende data beschikbaar is — bij offline/fout
 * blijft enkel de versiesprong over. Desktop-only qua trigger; de fetch werkt overal.
 */
export function JustUpdatedDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const justUpdated = useAppStore((s) => s.ui.justUpdated);

  const [comparison, setComparison] = useState<ReleaseComparison | null>(null);
  const [openError, setOpenError] = useState(false);

  const close = () => setUI({ justUpdated: null });

  useEffect(() => {
    if (!justUpdated) return;
    let cancelled = false;
    void (async () => {
      const installKind = await getInstallKind();
      const cmp = await fetchReleaseComparison(justUpdated.to, installKind);
      if (!cancelled) {
        setComparison(cmp);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [justUpdated]);

  if (!justUpdated) return null;

  const sizeDelta = comparison?.sizeDeltaBytes ?? null;
  const showSmaller = sizeDelta !== null && sizeDelta < 0;
  const showLarger = sizeDelta !== null && sizeDelta > 0;
  const days = comparison?.daysBetween ?? null;
  const release = getReleaseHighlights(justUpdated.to);
  const stats = release?.stats;
  const shownDays = stats?.daysSincePrevious ?? days;
  const openLink = (url: string) => { setOpenError(false); void openExternal(url).then(ok => setOpenError(!ok)); };
  const Highlight = ({ item, primary = false }: { item: ReleaseHighlight; primary?: boolean }) => {
    const Icon = ICONS[item.icon];
    return <article className={primary ? 'border border-border bg-surface-hover rounded-[12px] p-5 flex gap-4 items-start' : 'border border-border rounded-[10px] p-3 flex gap-3 items-start'}>
      <Icon aria-hidden="true" size={primary ? 30 : 18} className="text-accent shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1"><p className="text-[10px] tracking-[0.12em] font-semibold text-text-secondary">{item.category}</p><h2 className={primary ? 'text-base font-semibold mt-1' : 'text-sm font-semibold'}>{item.title}</h2><p className="text-xs leading-5 text-text-secondary mt-1">{item.description}</p>{item.docsId && <button onClick={() => useAppStore.getState().openHelpArticle(item.docsId!)} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"><BookOpen size={13} />{t('updates.justUpdated.readGuide')}</button>}</div>
    </article>;
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[min(680px,calc(100vw-2rem))] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-just-updated-dialog': true }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('updates.justUpdated.title')}
        </span>
        <button onClick={close} aria-label={t('close')} className="p-1 hover:bg-surface-hover rounded-[8px]" title={t('close')}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-xs">
        {/* Versiesprong — zonder bekende "van"-versie (verse installatie) alleen de huidige. */}
        {justUpdated.from === null ? (
          <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-3 w-3 rounded-full bg-accent ring-4 ring-accent/20" /><span className="text-accent">{justUpdated.to}</span><span className="text-text-secondary">{t('updates.justUpdated.newVersion')}</span></div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-semibold" aria-label={`${justUpdated.from} naar ${justUpdated.to}`}>
            <span className="text-text-secondary text-right">{justUpdated.from}</span><span className="h-px w-14 bg-border relative before:absolute before:-inset-1 before:m-auto before:h-3 before:w-3 before:rounded-full before:bg-accent before:ring-4 before:ring-accent/20" /><span className="text-accent">{justUpdated.to}</span>
          </div>
        )}
        {release && <><Highlight item={release.primary} primary /><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{release.secondary.map(item => <Highlight key={item.title} item={item} />)}</div></>}
        <button onClick={() => openLink(CHANGELOG_URL)} className="self-start inline-flex items-center gap-1 text-xs text-accent hover:underline">{t('updates.justUpdated.fullNotes')} <ExternalLink size={13} /></button>
        {openError && <p role="alert" className="text-xs text-danger">{t('updates.justUpdated.openFailed')}</p>}
        {(shownDays !== null || stats?.commitsSincePrevious || stats?.addedCodeLines || sizeDelta !== null) && (
          <section className="border-t border-border pt-4">
            <h2 className="text-xs font-semibold mb-3">{t('updates.justUpdated.inNumbers')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              {shownDays !== null && <div><strong className="block text-base">{shownDays}</strong><span className="text-text-secondary">{t('updates.justUpdated.days')}</span></div>}
              {stats?.commitsSincePrevious && <div><strong className="block text-base">{stats.commitsSincePrevious}</strong><span className="text-text-secondary">{t('updates.justUpdated.commits')}</span></div>}
              {stats?.addedCodeLines && <div title={t('updates.justUpdated.codeLinesHint')}><strong className="block text-base">+{stats.addedCodeLines.toLocaleString()}</strong><span className="text-text-secondary">{t('updates.justUpdated.codeLines')}</span></div>}
              {sizeDelta !== null && <div><strong className="block text-base inline-flex gap-1 items-center">{showSmaller ? <ArrowDown size={14} /> : showLarger ? <ArrowUp size={14} /> : null}{formatBytes(Math.abs(sizeDelta))}</strong><span className="text-text-secondary">{showSmaller ? t('updates.justUpdated.smallerLabel') : showLarger ? t('updates.justUpdated.largerLabel') : t('updates.justUpdated.sameSize')}</span></div>}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--primary">
          {t('updates.justUpdated.acknowledge')}
        </button>
      </div>
    </Dialog>
  );
}
