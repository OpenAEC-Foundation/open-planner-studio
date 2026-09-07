import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate } from '@/i18n/dateFormat';
import {
  STATS_OS_ORDER,
  isFresh,
  loadDownloadStats,
  readCachedStats,
  totalDownloads,
  userDownloads,
  type CachedStats,
  type StatsOs,
} from '@/services/stats/downloadStats';

/** Merknamen, geen vertaalsleutels. */
const OS_LABEL: Record<StatsOs, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };

/** Zoveel releases staan standaard open; de rest achter "Alle … tonen", zodat de tab in de popup past. */
const RELEASES_COLLAPSED = 6;

/**
 * Tabblad Statistieken in het gedeelde instellingenpaneel: hoe vaak Open Planner Studio is
 * gedownload, per besturingssysteem en per release. Leest `downloads.json` van de stats-branch
 * (zie `services/stats/downloadStats.ts`); toont bij een fout de laatst bekende stand uit de cache.
 * Draait via `SettingsPanelContent` op alle drie de ingangen (tandwiel, ribbontab, Backstage).
 */
export function DownloadStatsSection() {
  const { t, i18n } = useTranslation('common');
  const [entry, setEntry] = useState<CachedStats | null>(() => readCachedStats());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadDownloadStats({ force });
      setEntry({ fetchedAt: result.fetchedAt, stats: result.stats });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCachedStats();
    if (cached && isFresh(cached, Date.now())) return;
    void load(false);
  }, [load]);

  const fmt = new Intl.NumberFormat(i18n.language);
  const n = (v: number) => fmt.format(v);
  const stats = entry?.stats ?? null;
  const releases = stats ? (showAll ? stats.releases : stats.releases.slice(0, RELEASES_COLLAPSED)) : [];
  const hiddenCount = stats ? stats.releases.length - RELEASES_COLLAPSED : 0;

  return (
    <div className="settings-section-list" data-ops-download-stats>
      <div className="settings-section">
        <h3>{t('settings.statsDownloadsSection')}</h3>
        <p className="scrollzoom-hint" style={{ marginTop: 0, marginBottom: 8 }}>{t('settings.statsIntro')}</p>

        {loading && !stats && <div className="settings-row">{t('settings.statsLoading')}</div>}
        {error && (
          <div className="settings-row settings-stats-error" role="alert">
            {t('settings.statsError')}
          </div>
        )}

        {stats && (
          <>
            <table className="settings-stats-table">
              <thead>
                <tr>
                  <th>{t('settings.statsColOs')}</th>
                  <th className="num">{t('settings.statsColDownloads')}</th>
                  <th className="num">{t('settings.statsColInstallers')}</th>
                  <th className="num">{t('settings.statsColUpdates')}</th>
                </tr>
              </thead>
              <tbody>
                {STATS_OS_ORDER.map(os => {
                  const b = stats.totals[os];
                  return (
                    <tr key={os}>
                      <td>{OS_LABEL[os]}</td>
                      <td className="num">{n(userDownloads(b))}</td>
                      <td className="num">{os === 'linux' ? `${n(b.install)} *` : n(b.install)}</td>
                      <td className="num">{os === 'linux' ? '–' : n(b.update)}</td>
                    </tr>
                  );
                })}
                <tr className="total">
                  <td>{t('settings.statsTotal')}</td>
                  <td className="num">{n(totalDownloads(stats))}</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="scrollzoom-hint">{t('settings.statsLinuxHint')}</p>
            <div className="settings-row" style={{ marginTop: 6 }}>
              {t('settings.statsUpdaterChecks', { n: n(stats.polls) })}
            </div>
          </>
        )}
      </div>

      {stats && (
        <div className="settings-section">
          <h3>{t('settings.statsPerRelease')}</h3>
          <table className="settings-stats-table">
            <thead>
              <tr>
                <th>{t('settings.statsColRelease')}</th>
                <th>{t('settings.statsColDate')}</th>
                <th className="num">Windows</th>
                <th className="num">macOS</th>
                <th className="num">Linux</th>
              </tr>
            </thead>
            <tbody>
              {releases.map(r => (
                <tr key={r.tag}>
                  <td>{r.tag}{r.prerelease ? ' (pre)' : ''}</td>
                  <td>{r.publishedAt ? formatDisplayDate(new Date(r.publishedAt), i18n.language) : '–'}</td>
                  <td className="num">{n(userDownloads(r.os.windows))}</td>
                  <td className="num">{n(userDownloads(r.os.macos))}</td>
                  <td className="num">{n(userDownloads(r.os.linux))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <button className="settings-link" onClick={() => setShowAll(v => !v)}>
              {showAll ? t('settings.statsShowLess') : t('settings.statsShowAll', { n: n(stats.releases.length) })}
            </button>
          )}
        </div>
      )}

      <div className="settings-section">
        <h3>{t('settings.statsSourceSection')}</h3>
        <div className="settings-row">
          {stats
            ? t('settings.statsSource', { date: formatDisplayDate(new Date(stats.generatedAt), i18n.language) })
            : t('settings.statsSourceNone')}
        </div>
        <button className="settings-link" disabled={loading} onClick={() => { void load(true); }}>
          {loading ? t('settings.statsLoading') : t('settings.statsRefresh')}
        </button>
        <p className="scrollzoom-hint">{t('settings.statsSnapHint')}</p>
      </div>
    </div>
  );
}
