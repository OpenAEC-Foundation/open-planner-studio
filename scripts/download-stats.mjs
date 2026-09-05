#!/usr/bin/env node
// Downloadcijfers per besturingssysteem uit de GitHub Releases-API.
//
// GitHub telt per release-asset hoe vaak het gedownload is (`download_count`),
// en omdat elk asset OS-specifiek is, is "hoe vaak en op welk OS" daaruit af te
// leiden zónder één regel app-code en zónder iets van gebruikers te verzamelen.
// Dit script haalt alle releases op, deelt de assets in en telt op.
//
// Wat de cijfers WEL en NIET zeggen — lees dit vóór je conclusies trekt:
//
// - Windows en macOS: de installer (`-setup.exe`, `.dmg`) en het updater-
//   pakket (`.nsis.zip`, `.app.tar.gz`) zijn verschillende bestanden, dus
//   verse installaties en in-app updates zijn daar wél te scheiden.
// - Linux: `latest.json` verwijst voor de updater naar hetzelfde `.deb`/
//   `.rpm`/`.AppImage` dat mensen ook handmatig downloaden. Die tellingen zijn
//   dus install + update samen, niet te scheiden. Gemeten 2026-09-05 op de
//   `platforms`-map van latest.json.
// - De Snap Store loopt níét via GitHub: het `.snap`-asset hier is alleen de
//   directe GitHub-download. Snap-installs staan in de Snapcraft-metrics.
// - `latest.json` wordt bij elke opstart-check door de updater opgehaald; die
//   telling is een ruwe maat voor "actieve desktopinstallaties × starts", geen
//   download. Hij staat er los bij.
// - `.sig`-bestanden worden overgeslagen: die download de updater erbij en
//   tellen dus dubbel.
//
// Gebruik:
//   node scripts/download-stats.mjs                 # tekstrapport
//   node scripts/download-stats.mjs --format=markdown
//   node scripts/download-stats.mjs --format=json
//   node scripts/download-stats.mjs --repo owner/repo
//
// Zet `GITHUB_TOKEN` om de ratelimiet van 60 ongeauthenticeerde calls/uur te
// vermijden; de Actions-workflow `download-stats.yml` doet dat automatisch.

import { pathToFileURL } from 'node:url';

export const DEFAULT_REPO = 'OpenAEC-Foundation/open-planner-studio';

/** Vaste kolomvolgorde in alle rapporten. */
export const OS_ORDER = Object.freeze(['windows', 'macos', 'linux']);

/**
 * Deel één asset in op bestandsnaam.
 *
 * `role`:
 *   - `install`  — het bestand dat een mens downloadt om te installeren
 *   - `update`   — het pakket dat uitsluitend de in-app updater ophaalt
 *   - `both`     — Linux: hetzelfde bestand voor beide (zie kop)
 *   - `poll`     — `latest.json`, de updater-check
 *   - `ignore`   — handtekeningen en onbekende bestanden
 */
export function classifyAsset(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.sig')) return { os: null, role: 'ignore', kind: 'signature' };
  if (n === 'latest.json') return { os: null, role: 'poll', kind: 'latest.json' };
  if (n.endsWith('.nsis.zip')) return { os: 'windows', role: 'update', kind: 'nsis.zip' };
  if (n.endsWith('-setup.exe') || n.endsWith('.exe')) return { os: 'windows', role: 'install', kind: 'exe' };
  if (n.endsWith('.msi')) return { os: 'windows', role: 'install', kind: 'msi' };
  if (n.endsWith('.app.tar.gz')) return { os: 'macos', role: 'update', kind: 'app.tar.gz' };
  if (n.endsWith('.dmg')) return { os: 'macos', role: 'install', kind: 'dmg' };
  if (n.endsWith('.appimage')) return { os: 'linux', role: 'both', kind: 'AppImage' };
  if (n.endsWith('.deb')) return { os: 'linux', role: 'both', kind: 'deb' };
  if (n.endsWith('.rpm')) return { os: 'linux', role: 'both', kind: 'rpm' };
  if (n.endsWith('.snap')) return { os: 'linux', role: 'install', kind: 'snap' };
  return { os: null, role: 'ignore', kind: 'unknown' };
}

function emptyOs() {
  return { install: 0, update: 0, both: 0, byKind: {} };
}

/**
 * Tel de assets van een lijst releases (vorm van de GitHub-API) op.
 * Drafts worden overgeslagen; pre-releases tellen mee maar zijn gemarkeerd.
 */
export function aggregate(releases) {
  const totals = { windows: emptyOs(), macos: emptyOs(), linux: emptyOs() };
  let polls = 0;
  const unknown = [];
  const perRelease = [];

  for (const rel of releases) {
    if (rel.draft) continue;
    const row = {
      tag: rel.tag_name,
      publishedAt: rel.published_at ?? null,
      prerelease: Boolean(rel.prerelease),
      os: { windows: emptyOs(), macos: emptyOs(), linux: emptyOs() },
      polls: 0,
    };
    for (const asset of rel.assets ?? []) {
      const c = classifyAsset(asset.name);
      const count = Number(asset.download_count) || 0;
      if (c.role === 'poll') { row.polls += count; polls += count; continue; }
      if (c.role === 'ignore') {
        if (c.kind === 'unknown') unknown.push(`${rel.tag_name}: ${asset.name}`);
        continue;
      }
      for (const bucket of [row.os[c.os], totals[c.os]]) {
        bucket[c.role] += count;
        bucket.byKind[c.kind] = (bucket.byKind[c.kind] ?? 0) + count;
      }
    }
    perRelease.push(row);
  }

  perRelease.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return { repo: undefined, generatedAt: undefined, releases: perRelease, totals, polls, unknown };
}

/** Wat een gebruiker "downloads" noemt: installers plus de Linux-mengvorm, zonder updater-pakketten. */
export function userDownloads(bucket) {
  return bucket.install + bucket.both;
}

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : '?';
}

function osLabel(os) {
  return { windows: 'Windows', macos: 'macOS', linux: 'Linux' }[os];
}

export function renderMarkdown(stats) {
  const lines = [];
  lines.push(`## Downloads per besturingssysteem — ${stats.repo ?? DEFAULT_REPO}`);
  lines.push('');
  lines.push(`_Bron: GitHub Releases-API, ${stats.releases.length} releases, gegenereerd ${fmtDate(stats.generatedAt)}._`);
  lines.push('');
  lines.push('| OS | downloads | waarvan installers | waarvan updates | per pakket |');
  lines.push('|---|---:|---:|---:|---|');
  let grand = 0;
  for (const os of OS_ORDER) {
    const b = stats.totals[os];
    const dl = userDownloads(b);
    grand += dl;
    const kinds = Object.entries(b.byKind).map(([k, v]) => `${k} ${v}`).join(', ');
    const installers = os === 'linux' ? `${b.install} (snap-asset)` : String(b.install);
    const updates = os === 'linux' ? `${b.both} install+update samen` : String(b.update);
    lines.push(`| ${osLabel(os)} | ${dl} | ${installers} | ${updates} | ${kinds} |`);
  }
  lines.push(`| **totaal** | **${grand}** | | | |`);
  lines.push('');
  lines.push(`Updater-checks (\`latest.json\`-downloads, geen installaties): ${stats.polls}`);
  lines.push('');
  lines.push('Linux-cijfers zijn installaties en in-app updates samen: de updater haalt daar hetzelfde');
  lines.push('`.deb`/`.rpm`/`.AppImage` op dat mensen ook handmatig downloaden. Snap Store-installs staan');
  lines.push('niet in GitHub; alleen de directe download van het `.snap`-asset telt hier mee.');
  lines.push('');
  lines.push('### Per release');
  lines.push('');
  lines.push('| release | datum | Windows | macOS | Linux | updater-checks |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const r of stats.releases) {
    const tag = r.prerelease ? `${r.tag} (pre)` : r.tag;
    lines.push(`| ${tag} | ${fmtDate(r.publishedAt)} | ${userDownloads(r.os.windows)} | ${userDownloads(r.os.macos)} | ${userDownloads(r.os.linux)} | ${r.polls} |`);
  }
  if (stats.unknown.length) {
    lines.push('');
    lines.push('Niet ingedeeld (niet meegeteld):');
    for (const u of stats.unknown) lines.push(`- ${u}`);
  }
  return lines.join('\n') + '\n';
}

export function renderText(stats) {
  const lines = [];
  lines.push(`Downloads per OS — ${stats.repo ?? DEFAULT_REPO} (${stats.releases.length} releases)`);
  lines.push('');
  let grand = 0;
  for (const os of OS_ORDER) {
    const b = stats.totals[os];
    const dl = userDownloads(b);
    grand += dl;
    const kinds = Object.entries(b.byKind).map(([k, v]) => `${k} ${v}`).join(', ');
    const extra = os === 'linux' ? '  (install+update samen)' : `  (installers ${b.install}, updates ${b.update})`;
    lines.push(`${osLabel(os).padEnd(8)} ${String(dl).padStart(7)}${extra}  [${kinds}]`);
  }
  lines.push(`${'totaal'.padEnd(8)} ${String(grand).padStart(7)}`);
  lines.push(`updater-checks (latest.json): ${stats.polls}`);
  lines.push('');
  lines.push('release           datum       win    mac  linux  checks');
  for (const r of stats.releases) {
    const tag = (r.prerelease ? `${r.tag} (pre)` : r.tag).padEnd(17);
    lines.push(`${tag} ${fmtDate(r.publishedAt)} ${String(userDownloads(r.os.windows)).padStart(6)} ${String(userDownloads(r.os.macos)).padStart(6)} ${String(userDownloads(r.os.linux)).padStart(6)} ${String(r.polls).padStart(7)}`);
  }
  if (stats.unknown.length) {
    lines.push('');
    lines.push('niet ingedeeld (niet meegeteld): ' + stats.unknown.join(', '));
  }
  return lines.join('\n') + '\n';
}

/** Alle releases ophalen, gepagineerd (100 per pagina). */
export async function fetchAllReleases(repo, { token = process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'ops-download-stats' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const all = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`;
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} voor ${url}: ${(await res.text()).slice(0, 200)}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function parseArgs(argv) {
  const opts = { format: 'text', repo: DEFAULT_REPO };
  for (const a of argv) {
    if (a.startsWith('--format=')) opts.format = a.slice('--format='.length);
    else if (a.startsWith('--repo=')) opts.repo = a.slice('--repo='.length);
    else if (a === '--repo') opts.repo = null; // volgende arg
    else if (opts.repo === null) opts.repo = a;
    else throw new Error(`Onbekend argument: ${a}`);
  }
  if (!['text', 'markdown', 'json'].includes(opts.format)) throw new Error(`Onbekend formaat: ${opts.format}`);
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const releases = await fetchAllReleases(opts.repo);
  const stats = aggregate(releases);
  stats.repo = opts.repo;
  stats.generatedAt = new Date().toISOString();
  if (opts.format === 'json') process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
  else if (opts.format === 'markdown') process.stdout.write(renderMarkdown(stats));
  else process.stdout.write(renderText(stats));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
