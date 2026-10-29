import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAsset, aggregate, userDownloads, renderMarkdown, renderText } from '../../scripts/download-stats.mjs';

// De echte assetnamen van v2026.9.0 (GitHub Releases-API, 2026-09-05).
const V2026_9_0 = [
  ['latest.json', 73],
  ['open-planner-studio_2026.9.0_amd64.snap', 0],
  ['Open.Planner.Studio-2026.9.0-1.x86_64.rpm', 2],
  ['Open.Planner.Studio-2026.9.0-1.x86_64.rpm.sig', 0],
  ['Open.Planner.Studio_2026.9.0_amd64.AppImage', 9],
  ['Open.Planner.Studio_2026.9.0_amd64.AppImage.sig', 0],
  ['Open.Planner.Studio_2026.9.0_amd64.deb', 8],
  ['Open.Planner.Studio_2026.9.0_amd64.deb.sig', 0],
  ['Open.Planner.Studio_2026.9.0_universal.dmg', 2],
  ['Open.Planner.Studio_2026.9.0_x64-setup.exe', 43],
  ['Open.Planner.Studio_2026.9.0_x64-setup.exe.sig', 0],
  ['Open.Planner.Studio_2026.9.0_x64-setup.nsis.zip', 6],
  ['Open.Planner.Studio_2026.9.0_x64-setup.nsis.zip.sig', 0],
  ['Open.Planner.Studio_universal.app.tar.gz', 1],
  ['Open.Planner.Studio_universal.app.tar.gz.sig', 0],
];

function release(tag, assets, extra = {}) {
  return {
    tag_name: tag,
    published_at: '2026-09-02T06:59:30Z',
    draft: false,
    prerelease: false,
    assets: assets.map(([name, download_count]) => ({ name, download_count })),
    ...extra,
  };
}

test('classifyAsset deelt elk echt assettype in op OS en rol', () => {
  assert.deepEqual(classifyAsset('Open.Planner.Studio_2026.9.0_x64-setup.exe'), { os: 'windows', role: 'install', kind: 'exe' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio_2026.9.0_x64-setup.nsis.zip'), { os: 'windows', role: 'update', kind: 'nsis.zip' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio_2026.9.0_universal.dmg'), { os: 'macos', role: 'install', kind: 'dmg' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio_universal.app.tar.gz'), { os: 'macos', role: 'update', kind: 'app.tar.gz' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio_2026.9.0_amd64.deb'), { os: 'linux', role: 'both', kind: 'deb' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio-2026.9.0-1.x86_64.rpm'), { os: 'linux', role: 'both', kind: 'rpm' });
  assert.deepEqual(classifyAsset('Open.Planner.Studio_2026.9.0_amd64.AppImage'), { os: 'linux', role: 'both', kind: 'AppImage' });
  assert.deepEqual(classifyAsset('open-planner-studio_2026.9.0_amd64.snap'), { os: 'linux', role: 'install', kind: 'snap' });
  assert.equal(classifyAsset('latest.json').role, 'poll');
});

test('handtekeningen tellen nooit mee — de updater haalt ze bij elk pakket op', () => {
  for (const name of ['x.exe.sig', 'x.nsis.zip.sig', 'x.app.tar.gz.sig', 'x.deb.sig', 'x.AppImage.sig']) {
    assert.equal(classifyAsset(name).role, 'ignore', name);
  }
});

test('aggregate telt v2026.9.0 op zoals de API-cijfers van 2026-09-05', () => {
  const stats = aggregate([release('v2026.9.0', V2026_9_0)]);
  assert.equal(userDownloads(stats.totals.windows), 43);
  assert.equal(stats.totals.windows.update, 6);
  assert.equal(userDownloads(stats.totals.macos), 2);
  assert.equal(stats.totals.macos.update, 1);
  assert.equal(userDownloads(stats.totals.linux), 19); // 8 deb + 9 AppImage + 2 rpm + 0 snap
  assert.equal(stats.totals.linux.both, 19);
  assert.equal(stats.polls, 73);
  // Het README-badgecijfer: zonder latest.json, .sig en updater-pakketten.
  assert.equal(stats.downloads, 43 + 2 + 19);
  assert.deepEqual(stats.unknown, []);
  assert.equal(stats.releases.length, 1);
  assert.equal(stats.schemaVersion, 1);
  assert.equal(stats.source, 'github-releases');
});

test('drafts worden overgeslagen, pre-releases gemarkeerd en niet in de totalen, onbekende assets gemeld maar niet geteld', () => {
  const stats = aggregate([
    release('v1', [['a.exe', 5]], { draft: true }),
    release('v2', [['a.exe', 7], ['a.nsis.zip', 3], ['a.dmg', 5], ['a.app.tar.gz', 2], ['a.deb', 6], ['README.txt', 99], ['latest.json', 4]], { prerelease: true, published_at: '2026-08-01T00:00:00Z' }),
    release('v3', [['a.exe', 1]], { published_at: '2026-09-01T00:00:00Z' }),
  ]);
  assert.equal(stats.releases.length, 2);
  assert.equal(stats.releases[0].tag, 'v3', 'nieuwste eerst');
  assert.equal(stats.releases[1].prerelease, true);
  // De pre-release heeft zijn eigen rij, maar telt niet mee in de totalen of de updater-checks.
  assert.equal(userDownloads(stats.releases[1].os.windows), 7);
  assert.equal(stats.releases[1].polls, 4);
  assert.equal(userDownloads(stats.totals.windows), 1);
  assert.equal(stats.polls, 0);
  assert.equal(stats.downloads, 1, 'pre-releases tellen niet mee in het badgecijfer');
  assert.equal(stats.releases[1].os.windows.update, 3);
  assert.equal(userDownloads(stats.releases[1].os.macos), 5);
  assert.equal(stats.releases[1].os.macos.update, 2);
  assert.equal(userDownloads(stats.releases[1].os.linux), 6);
  assert.equal(stats.totals.windows.update, 0);
  assert.equal(userDownloads(stats.totals.macos), 0);
  assert.equal(stats.totals.macos.update, 0);
  assert.equal(userDownloads(stats.totals.linux), 0);
  assert.deepEqual(stats.totals.windows.byKind, { exe: 1 });
  assert.deepEqual(stats.totals.macos.byKind, {});
  assert.deepEqual(stats.totals.linux.byKind, {});
  assert.match(renderMarkdown(stats), /v2 \(pre\)/);
  assert.match(renderMarkdown(stats), /Pre-releases tellen niet mee in de totalen/);
  assert.match(renderText(stats), /pre-releases \(pre\) tellen niet mee in de totalen/);
  assert.deepEqual(stats.unknown, ['v2: README.txt']);
});

test('de rapporten bevatten de kernregels en de Linux-kanttekening', () => {
  const stats = aggregate([release('v2026.9.0', V2026_9_0)]);
  stats.generatedAt = '2026-09-05T12:00:00Z';
  const md = renderMarkdown(stats);
  assert.match(md, /\| Windows \| 43 \| 43 \| 6 \|/);
  assert.match(md, /\| Linux \| 19 \|/);
  assert.match(md, /\*\*totaal\*\* \| \*\*64\*\*/);
  assert.match(md, /latest\.json`-downloads, geen installaties\): 73/);
  assert.match(md, /installaties en in-app updates samen/);
  const txt = renderText(stats);
  assert.match(txt, /Windows\s+43\s+\(installers 43, updates 6\)/);
  assert.match(txt, /v2026\.9\.0\s+2026-09-02\s+43\s+2\s+19\s+73/);
});

test('fetchAllReleases pagineert tot een pagina kleiner dan 100 en stuurt het token mee', async () => {
  const { fetchAllReleases } = await import('../../scripts/download-stats.mjs');
  const calls = [];
  const page = (n) => Array.from({ length: n }, (_, i) => ({ tag_name: `v${i}`, assets: [] }));
  const fetchImpl = async (url, { headers }) => {
    calls.push({ url, auth: headers.Authorization });
    const p = Number(new URL(url).searchParams.get('page'));
    return { ok: true, json: async () => (p === 1 ? page(100) : page(3)) };
  };
  const all = await fetchAllReleases('o/r', { token: 'tok', fetchImpl });
  assert.equal(all.length, 103);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].auth, 'Bearer tok');
  assert.match(calls[1].url, /repos\/o\/r\/releases\?per_page=100&page=2$/);
});

test('fetchAllReleases faalt hard op een niet-2xx-antwoord', async () => {
  const { fetchAllReleases } = await import('../../scripts/download-stats.mjs');
  const fetchImpl = async () => ({ ok: false, status: 403, text: async () => 'rate limit' });
  await assert.rejects(fetchAllReleases('o/r', { token: undefined, fetchImpl }), /GitHub API 403/);
});

// Assetherkenning mag geen maandbereik of klein patchnummer veronderstellen.
test('weekversies tellen dezelfde assets en sorteren op publicatiedatum', () => {
  const versions = ['2026.43.0', '2026.53.100', '2027.1.0'];
  const stats = aggregate(versions.map((version, i) => release(`v${version}`, V2026_9_0.map(([name, count]) => [name.replaceAll('2026.9.0', version), count]), { published_at: `2027-01-0${i + 1}T00:00:00Z` })));
  assert.deepEqual(stats.releases.map(item => item.tag), ['v2027.1.0', 'v2026.53.100', 'v2026.43.0']);
  assert.equal(userDownloads(stats.totals.windows), 3 * 43);
  assert.equal(userDownloads(stats.totals.linux), 3 * 19);
  assert.deepEqual(stats.unknown, []);
});
