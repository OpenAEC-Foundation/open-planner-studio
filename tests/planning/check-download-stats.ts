/**
 * Contract-check voor de leeskant van de stats-pijplijn (services/stats/downloadStats.ts):
 * parser tegen de echte JSON-vorm van `downloads.json`, schema-poort, en de cache-/fetch-
 * volgorde met een geïnjecteerde fetch en opslag. Puur → headless. Exit 1 bij een afwijking.
 */
import {
  DOWNLOAD_STATS_CACHE_MS,
  DOWNLOAD_STATS_URL,
  isFresh,
  loadDownloadStats,
  parseDownloadStats,
  readCachedStats,
  totalDownloads,
  userDownloads,
  type StatsStorage,
} from '@/services/stats/downloadStats';

let failures = 0;
let checks = 0;
function check(name: string, cond: boolean): void {
  checks++;
  if (!cond) {
    failures++;
    console.log(`   XX ${name}`);
  }
}

// De vorm zoals `download-stats.mjs --format=json` hem schrijft (stand 2026-09-07, ingekort).
const bucket = (install: number, update: number, both: number, byKind: Record<string, number>) => ({ install, update, both, byKind });
const FIXTURE = {
  schemaVersion: 1,
  source: 'github-releases',
  repo: 'OpenAEC-Foundation/open-planner-studio',
  generatedAt: '2026-09-07T13:54:32.273Z',
  releases: [
    { tag: 'v2026.9.0', publishedAt: '2026-09-02T06:59:30Z', prerelease: false, polls: 119,
      os: { windows: bucket(72, 8, 0, { exe: 72, 'nsis.zip': 8 }), macos: bucket(5, 1, 0, { dmg: 5 }), linux: bucket(0, 0, 30, { deb: 15, AppImage: 13, rpm: 2 }) } },
    { tag: 'v2026.8.1', publishedAt: '2026-08-19T09:48:18Z', prerelease: false, polls: 237,
      os: { windows: bucket(98, 20, 0, { exe: 98 }), macos: bucket(10, 4, 0, { dmg: 10 }), linux: bucket(2, 0, 48, { snap: 2, deb: 30, AppImage: 18 }) } },
  ],
  totals: { windows: bucket(358, 87, 0, { exe: 358, 'nsis.zip': 87 }), macos: bucket(59, 24, 0, { dmg: 59 }), linux: bucket(13, 0, 256, { snap: 13, deb: 145, AppImage: 91, rpm: 18 }) },
  polls: 1061,
  unknown: [],
};

// ── Parser ──
{
  const r = parseDownloadStats(FIXTURE);
  check('fixture parseert', r.ok);
  if (r.ok) {
    check('totaal = installers + Linux-mengvorm, zonder updater-pakketten', totalDownloads(r.value) === 358 + 59 + 13 + 256);
    check('userDownloads(windows) telt de nsis.zip niet mee', userDownloads(r.value.totals.windows) === 358);
    check('polls komen door', r.value.polls === 1061);
    check('releases in volgorde', r.value.releases.map(x => x.tag).join(',') === 'v2026.9.0,v2026.8.1');
    check('onbekende extra velden (source/repo/unknown) storen niet', r.value.releases[1].os.linux.byKind.snap === 2);
  }
  check('schemaVersion 2 wordt geweigerd', !parseDownloadStats({ ...FIXTURE, schemaVersion: 2 }).ok);
  check('ontbrekende generatedAt wordt geweigerd', !parseDownloadStats({ ...FIXTURE, generatedAt: 'gisteren' }).ok);
  check('ontbrekend OS in totals wordt geweigerd', !parseDownloadStats({ ...FIXTURE, totals: { windows: bucket(1, 0, 0, {}) } }).ok);
  check('release zonder tag wordt geweigerd', !parseDownloadStats({ ...FIXTURE, releases: [{ os: FIXTURE.totals }] }).ok);
  check('negatieve of niet-numerieke tellingen worden 0', (() => {
    const r2 = parseDownloadStats({ ...FIXTURE, polls: -5, totals: { ...FIXTURE.totals, macos: { install: 'x', update: null } } });
    return r2.ok && r2.value.polls === 0 && r2.value.totals.macos.install === 0 && r2.value.totals.macos.both === 0;
  })());
  check('geen object ⇒ nette fout', !parseDownloadStats('nee').ok && !parseDownloadStats(null).ok);
}

// ── Cache + fetch ──
function memStorage(): StatsStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
}
function fakeFetch(log: string[], body: unknown, status = 200): typeof fetch {
  return (async (url: string | URL | Request) => {
    log.push(String(url));
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as typeof fetch;
}

await (async () => {
  const storage = memStorage();
  const log: string[] = [];
  const T0 = 1_000_000;

  const first = await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, FIXTURE), now: T0 });
  check('eerste load fetcht de vaste raw-URL', log.length === 1 && log[0] === DOWNLOAD_STATS_URL);
  check('eerste load komt niet uit cache', !first.fromCache && first.fetchedAt === T0);
  check('cache is geschreven onder de ops-prefix', storage.map.has('ops-downloadStats'));

  const second = await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, FIXTURE), now: T0 + 60_000 });
  check('binnen 30 min: geen tweede fetch', log.length === 1 && second.fromCache);

  const forced = await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, FIXTURE), now: T0 + 60_000, force: true });
  check('force negeert de verse cache', log.length === 2 && !forced.fromCache);

  // De geforceerde fetch hierboven stempelde T0 + 60 s als fetchedAt, dus dáárvandaan rekenen.
  const later = await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, FIXTURE), now: T0 + 60_000 + DOWNLOAD_STATS_CACHE_MS + 1 });
  check('na 30 min: opnieuw fetchen', log.length === 3 && !later.fromCache);

  const cached = readCachedStats(storage);
  check('verlopen cache blijft leesbaar als terugval', cached !== null && !isFresh(cached, T0 + 3 * DOWNLOAD_STATS_CACHE_MS));

  let threw = '';
  try {
    await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, {}, 503), now: T0 + 2 * DOWNLOAD_STATS_CACHE_MS, force: true });
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
  }
  check('HTTP 503 gooit en laat de oude cache staan', threw === 'HTTP 503' && readCachedStats(storage)?.stats.polls === 1061);

  threw = '';
  try {
    await loadDownloadStats({ storage, fetchImpl: fakeFetch(log, { ...FIXTURE, schemaVersion: 9 }), force: true });
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e);
  }
  check('onbekend schema gooit en overschrijft de cache niet', /schemaVersion 9/.test(threw) && readCachedStats(storage)?.stats.schemaVersion === 1);

  {
    const st = memStorage();
    const l: string[] = [];
    const [a, b] = await Promise.all([
      loadDownloadStats({ storage: st, fetchImpl: fakeFetch(l, FIXTURE), now: T0 }),
      loadDownloadStats({ storage: st, fetchImpl: fakeFetch(l, FIXTURE), now: T0 }),
    ]);
    check('twee gelijktijdige loads delen één fetch (StrictMode-dubbeleffect)', l.length === 1 && a.stats.polls === 1061 && b.stats.polls === 1061);
  }

  const bad = memStorage();
  bad.map.set('ops-downloadStats', '{"fetchedAt": 1, "stats": {"schemaVersion": 1}}');
  check('corrupte cache-inhoud wordt genegeerd', readCachedStats(bad) === null);
  check('zonder opslag werkt laden ook', (await loadDownloadStats({ storage: null, fetchImpl: fakeFetch([], FIXTURE) })).stats.polls === 1061);
})();

if (failures === 0) {
  console.log(`OK  download-stats: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  download-stats: ${failures} afwijking(en) van ${checks}`);
  process.exit(1);
}
