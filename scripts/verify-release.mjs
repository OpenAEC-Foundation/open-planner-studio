#!/usr/bin/env node
// Bron: tauri-plugin-updater 2.10.1 als referentie voor hoe de updater latest.json en, via minisign-verify 0.2.5, handtekeningen leest (Apache-2.0 OR MIT, github.com/tauri-apps/plugins-workspace).

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function decodeBase64Strict(text, label) {
  if (typeof text !== 'string' || text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    throw new Error(`${label}: geen geldige base64`);
  }
  const buf = Buffer.from(text, 'base64');
  if (buf.toString('base64') !== text) throw new Error(`${label}: geen canonieke base64`);
  return buf;
}

function utf8Strict(buf, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw new Error(`${label}: geen geldige UTF-8`);
  }
}

function rustLines(text) {
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function parsePublicKey(input) {
  const text = utf8Strict(decodeBase64Strict(input, 'pubkey'), 'pubkey');
  const lines = rustLines(text);
  if (lines.length < 2) throw new Error('pubkey: geen minisign-formaat (2 regels)');
  const raw = decodeBase64Strict(lines[1], 'pubkey-sleutelregel');
  if (raw.length !== 42 || raw.subarray(0, 2).toString('latin1') !== 'Ed') {
    throw new Error(`pubkey: verwacht 42 bytes met 'Ed', kreeg ${raw.length} bytes`);
  }
  return { keyId: raw.subarray(2, 10), key: raw.subarray(10, 42) };
}

export function parseSignature(input) {
  const text = utf8Strict(decodeBase64Strict(input, 'handtekening'), 'handtekening');
  const lines = rustLines(text);
  if (lines.length < 4) throw new Error('handtekening: geen minisign-formaat (4 regels)');
  const sig = decodeBase64Strict(lines[1], 'handtekeningregel');
  if (sig.length !== 74) throw new Error(`handtekening: verwacht 74 bytes, kreeg ${sig.length}`);
  const prefix = 'trusted comment: ';
  if (!lines[2].startsWith(prefix)) throw new Error('handtekening: regel 3 is geen trusted comment');
  const globalSig = decodeBase64Strict(lines[3], 'globale handtekening');
  if (globalSig.length !== 64) throw new Error(`globale handtekening: verwacht 64 bytes, kreeg ${globalSig.length}`);
  return {
    alg: sig.subarray(0, 2).toString('latin1'),
    keyId: sig.subarray(2, 10),
    signature: sig.subarray(10, 74),
    trustedComment: lines[2].slice(prefix.length),
    globalSignature: globalSig,
  };
}

export function keyIdHex(buf) {
  return Buffer.from(buf).reverse().toString('hex').toUpperCase();
}

function ed25519Key(raw32) {
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw32]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

export function verifyMinisign({ publicKey, signatureText, data }) {
  const pub = typeof publicKey === 'string' ? parsePublicKey(publicKey) : publicKey;
  let sig;
  try {
    sig = parseSignature(signatureText);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  const base = { alg: sig.alg, keyId: keyIdHex(sig.keyId), trustedComment: sig.trustedComment };
  if (!sig.keyId.equals(pub.keyId)) {
    return { ...base, ok: false, reason: `sleutel-id ${keyIdHex(sig.keyId)} is niet ${keyIdHex(pub.keyId)}` };
  }
  let message;
  if (sig.alg === 'ED') message = createHash('blake2b512').update(data).digest();
  else if (sig.alg === 'Ed') message = data;
  else return { ...base, ok: false, reason: `onbekend algoritme '${sig.alg}'` };
  const key = ed25519Key(pub.key);
  if (!cryptoVerify(null, message, key, sig.signature)) {
    return { ...base, ok: false, reason: 'handtekening past niet bij het bestand' };
  }
  const globalMessage = Buffer.concat([sig.signature, Buffer.from(sig.trustedComment, 'utf8')]);
  if (!cryptoVerify(null, globalMessage, key, sig.globalSignature)) {
    return { ...base, ok: false, reason: 'globale handtekening (trusted comment) klopt niet' };
  }
  return { ...base, ok: true, reason: '' };
}

export function tarGzEntryNames(buf) {
  return execFileSync('tar', ['-tzf', '-'], { input: buf, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
}

export function hasMacCodeSignature(names) {
  return names.some((n) => /\.app\/Contents\/_CodeSignature\/CodeResources$/.test(n));
}

export const TAG_PATTERN = /^v[0-9][0-9A-Za-z.-]*$/;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @returns {string|null} */
export function pubDateError(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[\x00-\x7f](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return 'geen RFC 3339-tijdstip';
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const offH = m[8] === undefined ? 0 : Number(m[8]);
  const offM = m[9] === undefined ? 0 : Number(m[9]);
  const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const dim = (y, mo) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (month < 1 || month > 12) return 'maand bestaat niet';
  if (day < 1 || day > dim(year, month)) return 'dag bestaat niet';
  if (hour > 23 || minute > 59 || second > 60) return 'tijd bestaat niet';
  if (offH > 23 || offM > 59) return 'offset buiten bereik';
  if (second === 60) {
    const sign = m[7] === '-' ? -1 : 1;
    let minutes = hour * 60 + minute - sign * (offH * 60 + offM);
    let [y, mo, d] = [year, month, day];
    if (minutes < 0) {
      minutes += 1440;
      d -= 1;
      if (d === 0) { mo -= 1; if (mo === 0) { mo = 12; y -= 1; } d = dim(y, mo); }
    } else if (minutes >= 1440) {
      minutes -= 1440;
      d += 1;
      if (d > dim(y, mo)) { d = 1; mo += 1; if (mo === 13) { mo = 1; y += 1; } }
    }
    if (minutes !== 23 * 60 + 59 || d !== dim(y, mo)) return 'seconde 60 is hier geen schrikkelseconde';
  }
  return null;
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export const EXPECTED_PLATFORMS = {
  'linux-x86_64': '.AppImage',
  'linux-x86_64-appimage': '.AppImage',
  'linux-x86_64-deb': '.deb',
  'linux-x86_64-rpm': '.rpm',
  'darwin-aarch64': '.app.tar.gz',
  'darwin-aarch64-app': '.app.tar.gz',
  'darwin-x86_64': '.app.tar.gz',
  'darwin-x86_64-app': '.app.tar.gz',
  'windows-x86_64': '.nsis.zip',
  'windows-x86_64-nsis': '.nsis.zip',
};

function textStrict(buf) {
  return new TextDecoder('utf-8', { fatal: true }).decode(buf);
}

/** @returns {{asset?:string, error?:string}} */
export function checkUpdaterUrl(url, { repo, tag, isLatest }) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { error: `geen geldige URL: ${url}` };
  }
  if (u.protocol !== 'https:') return { error: `protocol ${u.protocol} is geen https` };
  if (u.hostname !== 'github.com' || u.port || u.username || u.password) return { error: `host ${u.host} is niet github.com` };
  if (u.search || u.hash) return { error: 'URL heeft een query of fragment' };
  const prefix = `/${repo}/releases/`;
  if (!u.pathname.startsWith(prefix)) return { error: `pad ${u.pathname} hoort niet bij ${repo}/releases` };
  const rest = u.pathname.slice(prefix.length).split('/');
  let encodedAsset;
  if (rest.length === 3 && rest[0] === 'latest' && rest[1] === 'download') {
    if (!isLatest) return { error: `releases/latest/download wijst naar de nieuwste release, niet naar ${tag}` };
    encodedAsset = rest[2];
  } else if (rest.length === 3 && rest[0] === 'download' && decodeURIComponent(rest[1]) === tag) {
    encodedAsset = rest[2];
  } else {
    return { error: `pad ${u.pathname} is geen releases/latest/download/<asset> of releases/download/${tag}/<asset>` };
  }
  let asset;
  try {
    asset = decodeURIComponent(encodedAsset);
  } catch {
    return { error: `assetnaam ${encodedAsset} is ongeldig gecodeerd` };
  }
  if (!asset) return { error: 'assetnaam ontbreekt' };
  return { asset };
}

/**
 * @param {object} o
 * @param {string} o.publicKey
 * @param {{name:string, digest?:string|null}[]} o.assets
 * @param {(name:string)=>Buffer} o.read
 * @param {string} o.repo
 * @param {string} o.tag
 * @param {boolean} o.isLatest
 * @returns {{group:string, item:string, status:'OK'|'FOUT'|'INFO', detail:string}[]}
 */
export function evaluateRelease({ publicKey, assets, read, repo, tag, isLatest }) {
  const rows = [];
  const add = (group, item, status, detail = '') => rows.push({ group, item, status, detail });
  const pub = parsePublicKey(publicKey);
  const names = new Set(assets.map((a) => a.name));
  const readText = (name) => textStrict(read(name));

  for (const asset of assets) {
    const actual = createHash('sha256').update(read(asset.name)).digest('hex');
    if (!asset.digest) {
      add('sha256 = GitHub-digest', asset.name, 'INFO', `geen digest in de API; sha256 ${actual}`);
    } else if (asset.digest === `sha256:${actual}`) {
      add('sha256 = GitHub-digest', asset.name, 'OK', actual);
    } else {
      add('sha256 = GitHub-digest', asset.name, 'FOUT', `API ${asset.digest}, gedownload sha256:${actual}`);
    }
  }

  for (const sigName of [...names].filter((n) => n.endsWith('.sig')).sort()) {
    const target = sigName.slice(0, -4);
    if (!names.has(target)) {
      add('updater-handtekening (.sig)', sigName, 'FOUT', `asset ${target} ontbreekt`);
      continue;
    }
    let sigText;
    try {
      sigText = readText(sigName);
    } catch {
      add('updater-handtekening (.sig)', target, 'FOUT', `${sigName} is geen geldige UTF-8`);
      continue;
    }
    const r = verifyMinisign({ publicKey: pub, signatureText: sigText, data: read(target) });
    const detail = [r.alg && `alg ${r.alg}`, r.keyId && `sleutel ${r.keyId}`, r.trustedComment && `"${r.trustedComment}"`, r.reason]
      .filter(Boolean).join('; ');
    add('updater-handtekening (.sig)', target, r.ok ? 'OK' : 'FOUT', detail);
  }

  const G = 'latest.json';
  let latest;
  if (!names.has('latest.json')) {
    add(G, 'latest.json', 'FOUT', 'asset ontbreekt');
  } else {
    try {
      latest = JSON.parse(readText('latest.json'));
    } catch (err) {
      add(G, 'latest.json', 'FOUT', `geen geldige JSON: ${err.message}`);
    }
  }
  if (latest !== undefined && !isPlainObject(latest)) {
    add(G, 'manifest', 'FOUT', `manifest is geen object maar ${latest === null ? 'null' : Array.isArray(latest) ? 'een array' : typeof latest}`);
  } else if (latest !== undefined) {
    const want = tag.replace(/^v+/, '');
    const version = latest.version ?? latest.name;
    if (typeof version !== 'string') add(G, 'version', 'FOUT', 'veld version ontbreekt of is geen tekst');
    else if (!SEMVER.test(version.replace(/^v+/, ''))) add(G, 'version', 'FOUT', `version ${version} is geen semver`);
    else if (version.replace(/^v+/, '') !== want) add(G, 'version', 'FOUT', `version ${version} hoort bij een andere release dan ${tag}`);
    else add(G, 'version', 'OK', `${version} = ${tag}`);
    if (latest.notes !== undefined && latest.notes !== null && typeof latest.notes !== 'string') {
      add(G, 'notes', 'FOUT', `notes is ${Array.isArray(latest.notes) ? 'een array' : typeof latest.notes}, geen tekst; de updater weigert het manifest`);
    }
    if (latest.pub_date !== undefined && latest.pub_date !== null) {
      const err = typeof latest.pub_date === 'string' ? pubDateError(latest.pub_date) : 'geen tekst';
      if (err) add(G, 'pub_date', 'FOUT', `pub_date ${JSON.stringify(latest.pub_date)}: ${err}; de updater weigert het manifest`);
    }
    const platforms = latest.platforms;
    if (!isPlainObject(platforms) || Object.keys(platforms).length === 0) {
      add(G, 'platforms', 'FOUT', 'platforms ontbreekt, is geen object of is leeg');
    } else {
      for (const [key, kind] of Object.entries(EXPECTED_PLATFORMS)) {
        const e = platforms[key];
        if (e === undefined) {
          add(G, `dekking: ${key}`, 'FOUT', 'platform ontbreekt; een installatie die deze sleutel zoekt, vindt geen update');
        } else if (isPlainObject(e) && typeof e.url === 'string' && !e.url.endsWith(kind)) {
          add(G, `dekking: ${key}`, 'FOUT', `wijst niet naar een ${kind}-asset: ${e.url}`);
        }
      }
      for (const key of Object.keys(platforms)) {
        if (!(key in EXPECTED_PLATFORMS)) add(G, `dekking: ${key}`, 'INFO', 'platform staat niet in de verwachte lijst');
      }
      for (const [platform, entry] of Object.entries(platforms).sort(([a], [b]) => a.localeCompare(b))) {
        if (!isPlainObject(entry) || typeof entry.url !== 'string' || typeof entry.signature !== 'string') {
          add(G, platform, 'FOUT', 'entry is geen object met url en signature als tekst');
          continue;
        }
        const u = checkUpdaterUrl(entry.url, { repo, tag, isLatest });
        if (u.error) {
          add(G, platform, 'FOUT', u.error);
          continue;
        }
        const assetName = u.asset;
        if (!names.has(assetName)) {
          add(G, platform, 'FOUT', `URL ${entry.url} wijst niet naar een asset van ${tag}`);
          continue;
        }
        const sigAsset = `${assetName}.sig`;
        let sigText = null;
        try {
          sigText = names.has(sigAsset) ? readText(sigAsset) : null;
        } catch {
          sigText = null;
        }
        const same = sigText !== null && entry.signature === sigText;
        const r = verifyMinisign({ publicKey: pub, signatureText: entry.signature, data: read(assetName) });
        if (same && r.ok) add(G, platform, 'OK', `${assetName}; signature = ${sigAsset}, verifieert`);
        else add(G, platform, 'FOUT',
          `${assetName}; ${sigText === null ? `${sigAsset} ontbreekt of is onleesbaar` : same ? 'signature = asset-.sig' : 'signature ≠ asset-.sig'}; ${r.ok ? 'verifieert' : r.reason}`);
      }
    }
  }

  for (const name of [...names].filter((n) => n.endsWith('.app.tar.gz')).sort()) {
    let entries;
    try {
      entries = tarGzEntryNames(read(name));
    } catch (err) {
      add('macOS app.tar.gz (informatief)', name, 'FOUT', `tar niet leesbaar: ${String(err.message).split('\n')[0]}`);
      continue;
    }
    add('macOS app.tar.gz (informatief)', name, 'INFO',
      hasMacCodeSignature(entries)
        ? 'bevat Contents/_CodeSignature/CodeResources (app is gecodesigned)'
        : 'GEEN Contents/_CodeSignature/CodeResources: app is niet gecodesigned');
  }
  return rows;
}

export function renderReport({ tag, repo, keyId, rows }) {
  const fails = rows.filter((r) => r.status === 'FOUT').length;
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const out = [`## Releaseverificatie ${tag} (${repo})`, '',
    `Updater-pubkey uit src-tauri/tauri.conf.json, sleutel-id ${keyId}.`, '',
    fails === 0 ? '**Oordeel: OK** — geen enkele controle faalde.' : `**Oordeel: FOUT** — ${fails} controle(s) faalden.`, ''];
  const groups = [...new Set(rows.map((r) => r.group))];
  for (const g of groups) {
    out.push(`### ${g}`, '', '| asset / platform | uitkomst | detail |', '|---|---|---|');
    for (const r of rows.filter((x) => x.group === g)) out.push(`| ${esc(r.item)} | ${r.status} | ${esc(r.detail)} |`);
    out.push('');
  }
  return out.join('\n');
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function parseArgs(argv) {
  const o = { tag: null, repo: process.env.GITHUB_REPOSITORY || 'OpenAEC-Foundation/open-planner-studio', dir: null, out: null, draftId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') o.repo = argv[++i];
    else if (a === '--dir') o.dir = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--draft-id') o.draftId = argv[++i];
    else if (a.startsWith('--')) throw new Error(`onbekende optie ${a}`);
    else o.tag = a;
  }
  if (o.draftId !== null) {
    if (!/^[1-9][0-9]*$/.test(o.draftId ?? '')) throw new Error(`ongeldig draft-id ${JSON.stringify(o.draftId)}`);
    if (!o.tag) throw new Error('--draft-id vraagt ook de tag');
  }
  return o;
}

/** @returns {string|null} */
export function draftError(release, { tag, draftId }) {
  if (String(release?.id) !== String(draftId)) return `release-id ${release?.id} is niet ${draftId}`;
  if (release.draft !== true) return `release ${draftId} is geen draft (meer)`;
  if (release.tag_name !== tag) return `draft ${draftId} heeft tag ${release.tag_name}, niet ${tag}`;
  if (release.prerelease) return `draft ${draftId} is een prerelease; die wordt niet de nieuwste release`;
  return null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.tag) opts.tag = gh(['release', 'view', '--repo', opts.repo, '--json', 'tagName', '--jq', '.tagName']).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(opts.repo)) throw new Error(`ongeldige repo ${JSON.stringify(opts.repo)}`);
  if (!TAG_PATTERN.test(opts.tag)) throw new Error(`ongeldige tag ${JSON.stringify(opts.tag)}`);
  const release = JSON.parse(gh(['api', opts.draftId
    ? `repos/${opts.repo}/releases/${opts.draftId}`
    : `repos/${opts.repo}/releases/tags/${opts.tag}`]));
  if (opts.draftId) {
    const err = draftError(release, opts);
    if (err) throw new Error(err);
  }
  const assets = release.assets.map((a) => ({ name: a.name, digest: a.digest ?? null }));
  if (assets.length === 0) throw new Error(`release ${opts.tag} heeft geen assets`);
  const dir = opts.dir ?? mkdtempSync(join(tmpdir(), 'ops-release-'));
  const missing = assets.filter((a) => !existsSync(join(dir, a.name)));
  if (missing.length > 0) {
    process.stderr.write(`download ${missing.length} asset(s) van ${opts.tag} naar ${dir}\n`);
    gh(['release', 'download', opts.tag, '--repo', opts.repo, '--dir', dir, '--skip-existing']);
  }
  const conf = JSON.parse(readFileSync(join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  const publicKey = conf?.plugins?.updater?.pubkey;
  if (!publicKey) throw new Error('geen plugins.updater.pubkey in tauri.conf.json');
  const cache = new Map();
  const read = (name) => {
    if (!cache.has(name)) cache.set(name, readFileSync(join(dir, name)));
    return cache.get(name);
  };
  let isLatest;
  if (opts.draftId) {
    isLatest = true;
    process.stderr.write(`draft ${opts.draftId} (${opts.tag}) wordt bij publicatie de nieuwste release\n`);
  } else {
    const latestTag = gh(['api', `repos/${opts.repo}/releases/latest`, '--jq', '.tag_name']).trim();
    isLatest = latestTag === opts.tag;
    process.stderr.write(`nieuwste release: ${latestTag}; ${opts.tag} is ${isLatest ? '' : 'NIET '}de nieuwste\n`);
  }
  const rows = evaluateRelease({ publicKey, assets, read, repo: opts.repo, tag: opts.tag, isLatest });
  const report = renderReport({ tag: opts.tag, repo: opts.repo, keyId: keyIdHex(parsePublicKey(publicKey).keyId), rows });
  process.stdout.write(`${report}\n`);
  if (opts.out) writeFileSync(opts.out, `${report}\n`);
  return rows.some((r) => r.status === 'FOUT') ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`verify-release: CRASH: ${err?.stack ?? err}\n`);
    process.exitCode = 2;
  }
}
