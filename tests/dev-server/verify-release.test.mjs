import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  evaluateRelease,
  hasMacCodeSignature,
  keyIdHex,
  parsePublicKey,
  renderReport,
  checkUpdaterUrl,
  draftError,
  EXPECTED_PLATFORMS,
  parseArgs,
  pubDateError,
  tarGzEntryNames,
  verifyMinisign,
} from '../../scripts/verify-release.mjs';

// Een eigen Ed25519-sleutel in minisign-formaat, zoals `tauri signer` hem schrijft:
// pubkey en .sig zijn allebei base64 van de minisign-tekst.
function makeKey(keyId = randomBytes(8)) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const keyLine = Buffer.concat([Buffer.from('Ed'), keyId, raw]).toString('base64');
  const text = `untrusted comment: minisign public key: ${keyIdHex(keyId)}\n${keyLine}\n`;
  return { keyId, privateKey, pubkey: Buffer.from(text).toString('base64') };
}

function minisign(key, data, { alg = 'ED', keyId = key.keyId, trusted = 'timestamp:1788331608\tfile:test.bin' } = {}) {
  const message = alg === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  const signature = sign(null, message, key.privateKey);
  const globalSig = sign(null, Buffer.concat([signature, Buffer.from(trusted)]), key.privateKey);
  const sigLine = Buffer.concat([Buffer.from(alg), keyId, signature]).toString('base64');
  const text = `untrusted comment: signature from tauri secret key\n${sigLine}\ntrusted comment: ${trusted}\n${globalSig.toString('base64')}\n`;
  return Buffer.from(text).toString('base64');
}

const DATA = Buffer.from('Open Planner Studio installer bytes\n'.repeat(100));

test('parsePublicKey leest de echte pubkey uit tauri.conf.json', async () => {
  const { readFileSync } = await import('node:fs');
  const conf = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(keyIdHex(parsePublicKey(conf.plugins.updater.pubkey).keyId), '28AC8F08A87C90CD');
});

test('verifyMinisign keurt een geldige ED-handtekening (BLAKE2b-prehash) goed', () => {
  const key = makeKey();
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: minisign(key, DATA), data: DATA });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.alg, 'ED');
  assert.equal(r.keyId, keyIdHex(key.keyId));
});

test('verifyMinisign keurt een geldige legacy Ed-handtekening (ruwe bytes) goed', () => {
  const key = makeKey();
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: minisign(key, DATA, { alg: 'Ed' }), data: DATA });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.alg, 'Ed');
});

test('mutatie: één byte anders in het bestand wordt afgekeurd (ED en Ed)', () => {
  const key = makeKey();
  for (const alg of ['ED', 'Ed']) {
    const mutated = Buffer.from(DATA);
    mutated[1234] ^= 0x01;
    const r = verifyMinisign({ publicKey: key.pubkey, signatureText: minisign(key, DATA, { alg }), data: mutated });
    assert.equal(r.ok, false, alg);
    assert.match(r.reason, /past niet/);
  }
});

test('een verkeerde sleutel-id wordt afgekeurd, ook als de handtekening zelf klopt', () => {
  const key = makeKey(Buffer.from('0102030405060708', 'hex'));
  const sig = minisign(key, DATA, { keyId: Buffer.from('0807060504030201', 'hex') });
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: sig, data: DATA });
  assert.equal(r.ok, false);
  assert.match(r.reason, /sleutel-id 0102030405060708 is niet 0807060504030201/);
});

test('een andere sleutel met dezelfde id wordt afgekeurd', () => {
  const key = makeKey();
  const other = makeKey(key.keyId);
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: minisign(other, DATA), data: DATA });
  assert.equal(r.ok, false);
});

test('een aangepaste trusted comment faalt op de globale handtekening', () => {
  const key = makeKey();
  const text = Buffer.from(minisign(key, DATA), 'base64').toString('utf8').replace('timestamp:1788331608', 'timestamp:1999999999');
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: Buffer.from(text).toString('base64'), data: DATA });
  assert.equal(r.ok, false);
  assert.match(r.reason, /globale handtekening/);
});

test('onzin als handtekening geeft een FOUT-uitkomst, geen exceptie', () => {
  const key = makeKey();
  const r = verifyMinisign({ publicKey: key.pubkey, signatureText: 'geen handtekening', data: DATA });
  assert.equal(r.ok, false);
});

// Een echte .tar.gz via de systeem-tar (bevinding 7: geen eigen tar-parser meer).
function tarGz(names) {
  const dir = mkdtempSync(join(tmpdir(), 'tar-'));
  const src = join(dir, 'src');
  for (const n of names) {
    const p = join(src, n);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, '');
  }
  return execFileSync('tar', ['-czf', '-', '-C', src, ...names]);
}

test('tarGzEntryNames en hasMacCodeSignature herkennen een gecodesignde app', () => {
  const signed = tarGzEntryNames(tarGz(['A B.app/Contents/Info.plist', 'A B.app/Contents/_CodeSignature/CodeResources']));
  assert.ok(signed.includes('A B.app/Contents/_CodeSignature/CodeResources'));
  assert.equal(hasMacCodeSignature(signed), true);
  assert.equal(hasMacCodeSignature(tarGzEntryNames(tarGz(['A.app/Contents/Info.plist']))), false);
  assert.throws(() => tarGzEntryNames(Buffer.from('geen tar')));
});

const REPO = 'OpenAEC-Foundation/open-planner-studio';
const TAG = 'v2026.9.0';
const LATEST = `https://github.com/${REPO}/releases/latest/download/`;
const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;

const APP_TAR = tarGz(['A.app/Contents/Info.plist']);
const ASSET_FOR = { '.nsis.zip': 'app.nsis.zip', '.AppImage': 'app.AppImage', '.deb': 'app.deb', '.rpm': 'app.rpm', '.app.tar.gz': 'app.app.tar.gz' };

/**
 * Een kleine, volledige release: per soort één asset met .sig, en latest.json met alle
 * platforms uit EXPECTED_PLATFORMS. `entry` overschrijft windows-x86_64, `sigFile` de
 * zip-.sig, `mutate(manifest)` past het manifestobject aan, `manifest` vervangt de JSON-tekst.
 */
function release(key, { manifest, entry, sigFile, mutate, extra = [] } = {}) {
  const files = new Map();
  const sigs = {};
  for (const [kind, name] of Object.entries(ASSET_FOR)) {
    const data = kind === '.app.tar.gz' ? APP_TAR : Buffer.from(name);
    sigs[kind] = minisign(key, data);
    files.set(name, data);
    files.set(`${name}.sig`, Buffer.from(sigs[kind]));
  }
  if (sigFile !== undefined) files.set('app.nsis.zip.sig', Buffer.from(sigFile));
  for (const [n, d] of extra) files.set(n, d);
  const platforms = Object.fromEntries(Object.entries(EXPECTED_PLATFORMS).map(([k, kind]) => [k, { url: `${LATEST}${ASSET_FOR[kind]}`, signature: sigs[kind] }]));
  platforms['windows-x86_64'] = { ...platforms['windows-x86_64'], ...entry };
  const obj = { version: '2026.9.0', notes: 'tekst', pub_date: '2026-09-02T06:49:44.677Z', platforms };
  if (mutate) mutate(obj);
  files.set('latest.json', Buffer.from(manifest ?? JSON.stringify(obj)));
  const assets = [...files.keys()].map((name) => ({ name, digest: sha(files.get(name)) }));
  return { assets, read: (n) => files.get(n), sig: sigs['.nsis.zip'], platforms };
}

function evaluate(key, opts, ctx = {}) {
  const r = release(key, opts);
  return evaluateRelease({ publicKey: key.pubkey, assets: r.assets, read: r.read, repo: REPO, tag: TAG, isLatest: true, ...ctx });
}

function fails(key, opts, ctx = {}) {
  return evaluate(key, opts, ctx).filter((x) => x.status === 'FOUT').map((x) => `${x.item}: ${x.detail}`);
}

test('een geldige release met alle platforms heeft nul FOUT-regels', () => {
  assert.deepEqual(fails(makeKey()), []);
});

test('releaseverificatie accepteert ISO-week 53, grote volgnummers en de jaarovergang', () => {
  for (const version of ['2026.43.0', '2026.53.100', '2027.1.0']) {
    assert.deepEqual(fails(makeKey(), { mutate: manifest => { manifest.version = version; } }, { tag: `v${version}` }), [], version);
  }
});

test('bevinding 2: een updater-URL buiten de bedoelde release is FOUT', () => {
  const key = makeKey();
  for (const url of [
    'https://example.invalid/does-not-exist/app.nsis.zip',
    `http://github.com/${REPO}/releases/latest/download/app.nsis.zip`,
    `https://github.com/ander/repo/releases/latest/download/app.nsis.zip`,
    `https://github.com.evil.example/${REPO}/releases/latest/download/app.nsis.zip`,
    `https://github.com/${REPO}/releases/download/v2026.8.1/app.nsis.zip`,
    `https://github.com/${REPO}/releases/latest/download/app.nsis.zip?x=1`,
    `https://github.com/${REPO}/releases/latest/download/sub/app.nsis.zip`,
  ]) {
    const f = fails(key, { entry: { url } }).filter((x) => x.startsWith('windows-x86_64:'));
    assert.equal(f.length, 1, `${url}: ${f.join(' | ')}`);
  }
  assert.ok(fails(key, { entry: { url: 'geen url' } }).some((x) => x.startsWith('windows-x86_64:')));
  assert.deepEqual(fails(key, { entry: { url: `https://github.com/${REPO}/releases/download/${TAG}/app.nsis.zip` } }), []);
  const old = fails(key, {}, { isLatest: false });
  assert.equal(old.length, Object.keys(EXPECTED_PLATFORMS).length);
  assert.ok(old.every((x) => /nieuwste release, niet naar v2026\.9\.0/.test(x)));
});

test('checkUpdaterUrl geeft de gedecodeerde assetnaam', () => {
  assert.deepEqual(checkUpdaterUrl(`${LATEST}Open.Planner.Studio%20x.zip`, { repo: REPO, tag: TAG, isLatest: true }), { asset: 'Open.Planner.Studio x.zip' });
});

test('bevinding 3: een onbruikbaar manifest is FOUT', () => {
  const key = makeKey();
  const { platforms, sig } = release(key);
  const m = (o) => JSON.stringify({ version: '2026.9.0', platforms, ...o });
  const cases = {
    null: 'null',
    array: '[]',
    getal: '42',
    'geen JSON': '{',
    'zonder version': JSON.stringify({ platforms }),
    'andere version': m({ version: '2026.8.1' }),
    'version geen tekst': m({ version: 2026 }),
    'version geen semver': m({ version: '2026.9' }),
    'pub_date onzin': m({ pub_date: 'gisteren' }),
    'pub_date 30 februari (ronde 2)': m({ pub_date: '2026-02-30T06:49:44.677Z' }),
    'pub_date geen tekst': m({ pub_date: 1788332248 }),
    'pub_date offset-uur 24': m({ pub_date: '2026-09-02T06:49:44+24:00' }),
    'pub_date seconde 60 midden in de maand': m({ pub_date: '2016-12-30T23:59:60Z' }),
    'pub_date tekst erachter': m({ pub_date: '2026-09-02T06:49:44Zx' }),
    'notes object (ronde 2)': m({ notes: { nl: 'tekst' } }),
    'notes getal': m({ notes: 1 }),
    'zonder platforms': JSON.stringify({ version: '2026.9.0' }),
    'platforms array': m({ platforms: [] }),
    'lege platforms': m({ platforms: {} }),
    'entry null': m({ platforms: { ...platforms, 'windows-x86_64': null } }),
    'url geen tekst': m({ platforms: { ...platforms, 'windows-x86_64': { url: 1, signature: sig } } }),
  };
  for (const [label, manifest] of Object.entries(cases)) {
    assert.ok(fails(key, { manifest }).length >= 1, label);
  }
  // Wat de updater wél accepteert, mag geen FOUT geven (VERVOLG ronde 2).
  for (const [label, o] of Object.entries({
    "'v'-voorvoegsel": { version: 'v2026.9.0' },
    'pub_date null': { pub_date: null },
    'pub_date zonder': { pub_date: undefined },
    'pub_date kleine t en z': { pub_date: '2026-09-02t06:49:44.677z' },
    'pub_date spatie als scheiding': { pub_date: '2026-09-02 06:49:44Z' },
    'pub_date offset': { pub_date: '2026-09-02T08:49:44.1+02:00' },
    'pub_date echte schrikkelseconde': { pub_date: '2016-12-31T23:59:60Z' },
    'pub_date schrikkelseconde met offset': { pub_date: '2017-01-01T00:59:60+01:00' },
    'notes null': { notes: null },
    'notes zonder': { notes: undefined },
  })) {
    assert.deepEqual(fails(key, { mutate: (x) => Object.assign(x, o) }), [], label);
  }
});

test('pubDateError volgt time 0.3.47 (Rfc3339) in randgevallen', () => {
  assert.equal(pubDateError('2024-02-29T00:00:00Z'), null);
  assert.notEqual(pubDateError('2023-02-29T00:00:00Z'), null);
  assert.notEqual(pubDateError('2026-13-01T00:00:00Z'), null);
  assert.notEqual(pubDateError('2026-09-02T06:49:44.Z'), null);
  assert.notEqual(pubDateError('2026-09-02T06:49:44'), null);
  assert.equal(pubDateError('2026-09-02X06:49:44Z'), null);
  assert.notEqual(pubDateError('2026-09-02é06:49:44Z'), null);
});

test('bevinding 4: base64 en UTF-8 zo streng als de updater', () => {
  const key = makeKey();
  const { sig } = release(key);
  const text = Buffer.from(sig, 'base64').toString('utf8');
  for (const [label, bad] of Object.entries({
    '! ervoor': `!${sig}`,
    'regeleinde erachter': `${sig}\n`,
    'spatie ervoor': ` ${sig}`,
    'zonder padding': sig.replace(/=+$/, ''),
    'ruwe minisign-tekst': text,
    'url-safe alfabet': sig.replace(/\+/g, '-').replace(/\//g, '_'),
  })) {
    if (bad === sig) continue;
    // Een kapotte .sig: de .sig-regel faalt, en latest.json (signature ≠ asset-.sig) ook.
    assert.ok(fails(key, { sigFile: bad }).some((f) => /^app\.nsis\.zip: .*base64/.test(f)), `.sig ${label}`);
    assert.equal(fails(key, { entry: { signature: bad } }).length, 1, `latest.json ${label}`);
    assert.equal(verifyMinisign({ publicKey: key.pubkey, signatureText: bad, data: Buffer.from('app.nsis.zip') }).ok, false, label);
  }
  // Ongeldige UTF-8 binnen geldige base64.
  const latin = Buffer.from(text.replace('trusted comment: ', 'trusted comment: é'), 'latin1').toString('base64');
  assert.equal(verifyMinisign({ publicKey: key.pubkey, signatureText: latin, data: Buffer.from('app.nsis.zip') }).ok, false);
  assert.throws(() => parsePublicKey(`!${key.pubkey}`), /base64/);
});

test('bevinding 4 (ronde 2): witruimte in de ingepakte minisign-regels wordt geweigerd, zoals minisign-verify 0.2.5', () => {
  const key = makeKey();
  const { sig } = release(key);
  const lines = Buffer.from(sig, 'base64').toString('utf8').split('\n');
  const wrap = (ls) => Buffer.from(ls.join('\n')).toString('base64');
  const data = Buffer.from('app.nsis.zip');
  assert.equal(verifyMinisign({ publicKey: key.pubkey, signatureText: wrap(lines), data }).ok, true);
  // \r\n is wel goed: Rust lines() haalt een \r aan het eind weg.
  assert.equal(verifyMinisign({ publicKey: key.pubkey, signatureText: wrap(lines.map((l) => (l ? `${l}\r` : l))), data }).ok, true);
  for (const [label, ls] of Object.entries({
    'spatie vóór de handtekeningregel': [lines[0], ` ${lines[1]}`, lines[2], lines[3], ''],
    'tab achter de globale handtekening': [lines[0], lines[1], lines[2], `${lines[3]}\t`, ''],
    'spatie achter de handtekeningregel': [lines[0], `${lines[1]} `, lines[2], lines[3], ''],
  })) {
    const bad = wrap(ls);
    assert.equal(verifyMinisign({ publicKey: key.pubkey, signatureText: bad, data }).ok, false, label);
    assert.ok(fails(key, { sigFile: bad }).some((f) => /^app\.nsis\.zip: /.test(f)), `.sig ${label}`);
    assert.ok(fails(key, { entry: { signature: bad } }).some((f) => /^windows-x86_64: /.test(f)), `latest.json ${label}`);
  }
  // Ook de sleutelregel van de pubkey wordt niet getrimd.
  const pk = Buffer.from(key.pubkey, 'base64').toString('utf8').split('\n');
  assert.throws(() => parsePublicKey(Buffer.from(`${pk[0]}\n ${pk[1]}\n`).toString('base64')), /base64/);
});

test('nieuw (ronde 2): ontbrekende of verkeerde updaterplatforms zijn FOUT', () => {
  const key = makeKey();
  const noWindows = fails(key, { mutate: (x) => { delete x.platforms['windows-x86_64']; delete x.platforms['windows-x86_64-nsis']; } });
  assert.deepEqual(noWindows.map((f) => f.split(':')[0] + ':' + f.split(':')[1]).sort(), ['dekking: windows-x86_64', 'dekking: windows-x86_64-nsis']);
  for (const key2 of Object.keys(EXPECTED_PLATFORMS)) {
    const f = fails(key, { mutate: (x) => { delete x.platforms[key2]; } });
    assert.deepEqual(f.map((x) => x.split(': ')[0] + ': ' + x.split(': ')[1]), [`dekking: ${key2}`], key2);
  }
  // Een deb-installatie die de AppImage krijgt, is ook fout.
  const wrong = fails(key, { mutate: (x) => { x.platforms['linux-x86_64-deb'] = x.platforms['linux-x86_64-appimage']; } });
  assert.ok(wrong.some((f) => f.startsWith('dekking: linux-x86_64-deb: wijst niet naar een .deb-asset')), wrong.join(' | '));
  // Een extra platform is alleen INFO.
  const rows = evaluate(key, { mutate: (x) => { x.platforms['linux-aarch64'] = x.platforms['linux-x86_64']; } });
  assert.ok(rows.some((r) => r.item === 'dekking: linux-aarch64' && r.status === 'INFO'));
});

test('evaluateRelease: .sig, latest.json en digest, met precies de verwachte FOUT-regels', () => {
  const key = makeKey();
  const r = release(key, {
    extra: [
      ['app-setup.exe', Buffer.from('exe-na-authenticode')],
      // .exe.sig van vóór Authenticode: hoort bij andere bytes (zoals in v2026.9.0).
      ['app-setup.exe.sig', Buffer.from(minisign(key, Buffer.from('exe-voor-authenticode')))],
    ],
    mutate: (x) => { x.platforms['linux-x86_64'] = { url: `${LATEST}weg.AppImage`, signature: 'x' }; },
  });
  r.assets.find((a) => a.name === 'app.nsis.zip').digest = 'sha256:' + '0'.repeat(64);
  r.assets.find((a) => a.name === 'latest.json').digest = null;

  const rows = evaluateRelease({ publicKey: key.pubkey, assets: r.assets, read: r.read, repo: REPO, tag: TAG, isLatest: true });
  const failed = rows.filter((x) => x.status === 'FOUT').map((x) => `${x.group}: ${x.item}`).sort();
  assert.deepEqual(failed, [
    'latest.json: linux-x86_64',
    'sha256 = GitHub-digest: app.nsis.zip',
    'updater-handtekening (.sig): app-setup.exe',
  ]);
  assert.ok(rows.some((x) => x.status === 'OK' && x.group === 'latest.json' && x.item === 'windows-x86_64'));
  assert.ok(rows.some((x) => x.status === 'OK' && x.item === 'version'));
  assert.ok(rows.some((x) => x.status === 'INFO' && x.item === 'latest.json'));
  const md = renderReport({ tag: TAG, repo: REPO, keyId: keyIdHex(key.keyId), rows });
  assert.match(md, /\*\*Oordeel: FOUT\*\* — 3 controle\(s\) faalden/);
});

test('renderReport escapet backslash en pipe, zodat een detail de tabel niet breekt', () => {
  const md = renderReport({ tag: 'v0', repo: 'x/y', keyId: 'AA', rows: [{ group: 'g', item: 'C:\\pad|x', status: 'OK', detail: 'a\\|b' }] });
  assert.match(md, /\| C:\\\\pad\\\|x \| OK \| a\\\\\\\|b \|/);
});

test('--draft-id: alleen een positief geheel getal, en alleen samen met de tag', () => {
  assert.equal(parseArgs(['v2026.10.0', '--draft-id', '123']).draftId, '123');
  assert.equal(parseArgs(['v2026.10.0']).draftId, null);
  assert.throws(() => parseArgs(['v2026.10.0', '--draft-id']), /ongeldig draft-id/);
  assert.throws(() => parseArgs(['v2026.10.0', '--draft-id', 'abc']), /ongeldig draft-id/);
  assert.throws(() => parseArgs(['v2026.10.0', '--draft-id', '0']), /ongeldig draft-id/);
  assert.throws(() => parseArgs(['--draft-id', '123']), /vraagt ook de tag/);
});

test('draftError: alleen de bedoelde, nog niet gepubliceerde draft van deze tag is goed', () => {
  const ok = { id: 123, draft: true, tag_name: 'v2026.10.0', prerelease: false };
  const want = { tag: 'v2026.10.0', draftId: '123' };
  assert.equal(draftError(ok, want), null);
  assert.match(draftError({ ...ok, id: 124 }, want), /niet 123/);
  assert.match(draftError({ ...ok, draft: false }, want), /geen draft/);
  assert.match(draftError({ ...ok, tag_name: 'v2026.9.0' }, want), /heeft tag v2026\.9\.0/);
  assert.match(draftError({ ...ok, prerelease: true }, want), /prerelease/);
});
