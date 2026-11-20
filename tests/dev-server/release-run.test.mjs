// Tests voor het releasescript (scripts/release/): de stappen en de stopcodes, tegen een nagebootst GitHub.
// Elke aanroep die een test niet voorziet, faalt hard; zo ziet een test ook een onverwachte schrijfstap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DroogStop, ReleaseStop, ReleaseTaak, slotregel } from '../../scripts/release/uitkomst.mjs';
import { BEGIN, EIND, inWeekendstop, volgRun, verslagTekst } from '../../scripts/release/github.mjs';
import {
  ciCheck, controleerOrigin, gewijzigdePaden, isAfgeschreven, kiesKandidaat, lever, vervolgRun, originTags, release, teksten, vergelijk, vervangBlok, wachtOpReparatie, websiteBlokkenLive, zetCijfers,
} from '../../scripts/release/stappen.mjs';
import { claudeArgs, maakContext, neemSlot } from '../../scripts/release/run.mjs';
import { execFileSync } from 'node:child_process';

const REPO = 'OpenAEC-Foundation/open-planner-studio';
const SHA_TAG = 'a'.repeat(40);
const SHA_MAIN = 'b'.repeat(40);
const MAANDAG_0900 = Date.parse('2026-11-23T08:00:00Z');

/** Een nep-omgeving. `gh`/`git`/`run` zijn lijsten [patroon, antwoord]; het eerste passende patroon wint. */
function nep({ gh = [], git = [], run = [], http = {}, bestanden = {}, droog = false, claude } = {}) {
  const klok = { t: MAANDAG_0900 };
  const spoor = { acts: [], gh: [], claude: 0, meldingen: [] };
  const zoek = (lijst, args, wat) => {
    const tekst = args.join(' ');
    const hit = lijst.find(([p]) => (p instanceof RegExp ? p.test(tekst) : tekst.includes(p)));
    if (!hit) throw new Error(`onverwachte ${wat}-aanroep: ${tekst}`);
    return typeof hit[1] === 'function' ? hit[1](args) : hit[1];
  };
  const ctx = {
    repo: REPO, root: '/repo', scriptRoot: '/script', home: '/home/x', droog, acties: 0, npmGedaan: new Set(), meldingen: [],
    meld: (code, tekst) => { ctx.meldingen.push(code); spoor.meldingen.push(`${code}: ${tekst}`); },
    now: () => klok.t,
    sleep: ms => { klok.t += ms; },
    log: () => {},
    act(stap, fn) {
      spoor.acts.push(stap);
      if (droog) throw new DroogStop(stap);
      ctx.acties += 1;
      return fn();
    },
    gh: args => { spoor.gh.push(args.join(' ')); const a = zoek(gh, args, 'gh'); return typeof a === 'string' ? a : JSON.stringify(a); },
    ghJson: args => { spoor.gh.push(args.join(' ')); const a = zoek(gh, args, 'gh'); if (a instanceof Error) throw a; return a; },
    git: args => String(zoek(git, args, 'git')),
    gitOk: args => zoek(git, args, 'git') !== false,
    run: (cmd, args) => zoek(run, [cmd, ...args], 'run'),
    claude: (prompt, opts) => { spoor.claude += 1; return claude(prompt, opts); },
    httpStatus: url => (url in http ? 200 : 404),
    httpText: url => http[url] ?? null,
    httpJson: url => (url in http ? JSON.parse(http[url]) : null),
    fs: {
      exists: p => p in bestanden,
      read: p => { if (!(p in bestanden)) throw new Error(`geen bestand ${p}`); return bestanden[p]; },
      readOrNull: p => bestanden[p] ?? null,
      write: (p, t) => { bestanden[p] = t; },
      mtimeMs: () => null,
      rm: () => {},
      copyDir: () => {},
    },
  };
  return { ctx, spoor, klok, bestanden };
}

const run = (over = {}) => ({
  id: 1, status: 'completed', conclusion: 'success', run_attempt: 1, head_sha: SHA_TAG, head_branch: 'v2026.47.0',
  event: 'push', created_at: '2026-11-17T04:00:00Z', updated_at: '2026-11-17T04:29:30Z', html_url: 'https://github.com/x/actions/runs/1', ...over,
});

const assets = versie => ['Open.Planner.Studio_<v>_amd64.deb', 'Open.Planner.Studio_<v>_x64-setup.exe', 'latest.json', 'open-planner-studio-<v>.mcpb']
  .map(n => ({ name: n.replace('<v>', versie) }));

/** Een vorige tag die helemaal is uitgeleverd: alle runs groen, AUR met het bewezen ontbrekende secret. */
function uitgeleverd({ snapLog = '  HEAD_BRANCH: v2026.47.0\n', snapStappen, snap = run({ id: 30, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z' }), snapStap = 'success', aurStap = 'skipped', aurNotice = true } = {}) {
  return [
    [/releases\/tags\/v2026\.47\.0$/, { draft: false, prerelease: false, published_at: '2026-11-17T04:29:30Z', assets: assets('2026.47.0'), body: '- a\n\n### Downloads' }],
    [/workflows\/release\.yml\/runs/, { workflow_runs: [run({ id: 10 })] }],
    [/actions\/runs\/10$/, run({ id: 10 })],
    [/workflows\/release-verify\.yml\/runs/, { workflow_runs: [run({ id: 20, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z' })] }],
    [/actions\/runs\/20$/, run({ id: 20, event: 'workflow_run' })],
    [/actions\/runs\/20\/jobs/, { jobs: [{ id: 200, name: 'resolve', conclusion: 'success' }] }],
    [/actions\/jobs\/200\/logs/, '  HEAD_BRANCH: v2026.47.0\n'],
    [/workflows\/snap\.yml\/runs/, { workflow_runs: [snap] }],
    [/actions\/runs\/30$/, snap],
    [/actions\/runs\/30\/jobs/, { jobs: [{ id: 300, name: 'build-snap', conclusion: snap.conclusion, steps: snapStappen ?? [{ name: 'Publish to Snap Store', conclusion: snapStap }] }] }],
    [/actions\/jobs\/300\/logs/, snapLog],
    [/workflows\/aur\.yml\/runs/, { workflow_runs: [run({ id: 40, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z' })] }],
    [/actions\/runs\/40$/, run({ id: 40, event: 'workflow_run' })],
    [/actions\/runs\/40\/jobs/, { jobs: [{ id: 400, name: 'aur', conclusion: 'success', steps: [{ name: 'Push to AUR', conclusion: aurStap }] }] }],
    [/check-runs\/400\/annotations/, aurNotice ? [{ annotation_level: 'notice', message: 'AUR-push overgeslagen: secret AUR_SSH_PRIVATE_KEY ontbreekt.' }] : []],
    [/actions\/jobs\/400\/logs/, '2026-11-17T04:29:52.07Z   VERSION: v2026.47.0\nx Open.Planner.Studio_2026.47.0_amd64.deb: 123'],
    [/releases\?per_page=30/, [{ tag_name: 'v2026.45.0', draft: false, prerelease: false, published_at: '2026-11-09', assets: assets('2026.45.0') }]],
    ['release download v2026.47.0', { version: '2026.47.0', notes: '- a', platforms: { 'linux-x86_64': { url: 'https://dl/1' }, 'windows-x86_64': { url: 'https://dl/1' }, 'darwin-aarch64': { url: 'https://dl/1' } } }],
  ];
}

const HTTP = {
  'https://dl/1': '',
  [`https://github.com/${REPO}/releases/latest/download/latest.json`]: '{"version":"2026.47.0"}',
  'https://raw.githubusercontent.com/wiki/OpenAEC-Foundation/open-planner-studio/Changelog.md': '# Changelog\n\n## v2026.47.0 — 2026-11-16\n',
  'https://open-aec.com/open-planner-studio/': '<section id="whats-new">New in v2026.47.0</section><!-- rn:start -->v2026.47.0<!-- rn:end -->',
};

const GIT_BASIS = [
  ['remote get-url', `https://github.com/${REPO}.git`],
  ['fetch', ''],
  ['rev-parse origin/main', SHA_MAIN],
  ['ls-remote --tags', `${SHA_TAG}\trefs/tags/v2026.47.0\n${'c'.repeat(40)}\trefs/tags/v2026.45.0\n`],
  ['show origin/main:package.json', '{"version":"2026.47.0"}'],
  ['merge-base --is-ancestor', true],
];

const GH_BASIS = [
  ['api graphql', { data: { repository: { issues: { nodes: [] } } } }],
  [/pr list .*--head vertalingen\//, []],
  [/pr list .*--state merged .*Release v2026\.47\.0/, [{ number: 969, title: 'Release v2026.47.0', body: 'x', url: 'u', headRefName: 'r', headRefOid: 'h' }]],
  [/pr list .*--state open/, []],
  [/website\/contents\/shared\/translations/, JSON.stringify({ whatsnew: { label: 'New in v2026.47.0' } })],
  [/website\/actions\/workflows\/deploy\.yml\/runs/, { workflow_runs: [run({ id: 50, event: 'push', head_branch: 'main', head_sha: 'd'.repeat(40) })] }],
];

const RUN_BASIS = [[/release-ci-check\.mjs --browser/, { status: 0, stdout: 'OK\nBROWSERRUN=9\n', stderr: '' }]];

// ---------------------------------------------------------------------------------------------------

test('uitkomst: vaste slotregels en exitcodes', () => {
  assert.deepEqual(slotregel('v1 uitgebracht'), { regel: 'RELEASE-KLAAR v1 uitgebracht', exit: 0 });
  assert.deepEqual(slotregel(new ReleaseStop('snap-mislukt', 'rood\nna rerun')), { regel: 'RELEASE-STOP snap-mislukt: rood na rerun', exit: 2 });
  assert.deepEqual(slotregel(new ReleaseTaak('vertalen', 'rood')), { regel: 'RELEASE-TAAK vertalen: rood', exit: 3 });
  assert.deepEqual(slotregel(new DroogStop('push')), { regel: 'RELEASE-DROOG push', exit: 0 });
  assert.equal(slotregel(new Error('kapot')).regel, 'RELEASE-STOP onverwacht: kapot');
  assert.throws(() => new ReleaseStop('verzonnen', 'x'), /onbekende stopcode/);
});

test('weekendstop: zaterdag 23:00 tot maandag 01:00 Nederlandse tijd', () => {
  assert.equal(inWeekendstop(Date.parse('2026-11-21T21:59:00Z')), false); // za 22:59
  assert.equal(inWeekendstop(Date.parse('2026-11-21T22:00:00Z')), true); // za 23:00
  assert.equal(inWeekendstop(Date.parse('2026-11-22T12:00:00Z')), true); // zondag
  assert.equal(inWeekendstop(Date.parse('2026-11-22T23:59:00Z')), true); // ma 00:59
  assert.equal(inWeekendstop(Date.parse('2026-11-23T00:00:00Z')), false); // ma 01:00
  assert.equal(inWeekendstop(Date.parse('2026-07-04T21:00:00Z')), true); // za 23:00 zomertijd
});

test('versies: numeriek vergelijken en stabiele origin-tags, gepeld en nieuwste eerst', () => {
  assert.equal(vergelijk('2026.47.0', '2026.9.3'), 1);
  assert.equal(vergelijk('2026.47.0', '2026.47.0'), 0);
  assert.equal(vergelijk('2026.53.0', '2027.1.0'), -1);
  assert.throws(() => vergelijk('2026.99.0', '2026.47.0'), e => e.code === 'kandidaat');
  const { ctx } = nep({ git: [['ls-remote', `1\trefs/tags/v2026.9.0\n2\trefs/tags/v2026.47.0\n3\trefs/tags/v2026.47.0^{}\n4\trefs/tags/v2026.48.0-rc1\n`]] });
  assert.deepEqual(originTags(ctx), [{ tag: 'v2026.47.0', sha: '3' }, { tag: 'v2026.9.0', sha: '1' }]);
});

test('origin: alleen OpenAEC-Foundation/open-planner-studio op github.com', () => {
  for (const url of ['https://github.com/OpenAEC-Foundation/open-planner-studio.git', 'git@github.com:OpenAEC-Foundation/open-planner-studio.git']) {
    assert.doesNotThrow(() => controleerOrigin(nep({ git: [['remote', url]] }).ctx));
  }
  assert.throws(() => controleerOrigin(nep({ git: [['remote', 'https://github.com/iemand/open-planner-studio.git']] }).ctx),
    e => e instanceof ReleaseStop && e.code === 'origin');
});

test('reparatie: wacht op een open issue, stopt bij REPARATIE GEBLOKKEERD', () => {
  let rondes = 0;
  const issues = nodes => ({ data: { repository: { issues: { nodes } } } });
  const open = issues([{ number: 7, comments: { nodes: [{ body: 'bezig' }] } }]);
  const { ctx, klok, spoor } = nep({ gh: [['api graphql', () => (rondes++ < 2 ? open : issues([]))]] });
  wachtOpReparatie(ctx);
  assert.equal(klok.t - MAANDAG_0900, 2 * 5 * 60_000);
  assert.match(spoor.gh[0], /labels: \["browsertests-reparatie"\].*comments\(last: 1\)/);
  const geblokkeerd = nep({ gh: [['api graphql', issues([{ number: 7, comments: { nodes: [{ body: 'REPARATIE GEBLOKKEERD: rood' }] } }])]] });
  assert.throws(() => wachtOpReparatie(geblokkeerd.ctx), e => e.code === 'reparatie-geblokkeerd');
});

test('ciCheck: rode browserrun is een taak, een gh-fout een stop', () => {
  const met = stdout => nep({ run: [[/release-ci-check/, { status: 1, stdout, stderr: '' }]] }).ctx;
  assert.throws(() => ciCheck(met('::error::release-ci-check: laatste browserrun run 5 (schedule, x): conclusie failure\nBROWSERRUN=5\n'), SHA_MAIN, { alleenBrowser: true }),
    e => e instanceof ReleaseTaak && e.code === 'browserreparatie' && /BROWSERRUN=5/.test(e.reden));
  assert.throws(() => ciCheck(met('::error::release-ci-check: gh api repos/x faalde: HTTP 502\nBROWSERRUN=\n'), SHA_MAIN, { alleenBrowser: true }),
    e => e instanceof ReleaseStop && e.code === 'onverwacht');
  assert.throws(() => ciCheck(met('::error::release-ci-check: ci.yml-pushrun 3 op x is niet groen (conclusie failure)\nOK  release-ci-check: browserrun ok\nBROWSERRUN=5\n'), SHA_MAIN, { alleenBrowser: false }),
    e => e instanceof ReleaseStop && e.code === 'main-ci-rood');
});

test('volgRun: rood in poging 1 krijgt één rerun, rood in poging 2 stopt', () => {
  const toestanden = [run({ conclusion: 'failure' }), run({ run_attempt: 2, status: 'in_progress', conclusion: null }), run({ run_attempt: 2, conclusion: 'success' })];
  let i = 0;
  const { ctx, spoor } = nep({ gh: [[/actions\/runs\/1$/, () => toestanden[Math.min(i++, 2)]], ['run rerun 1 --failed', '']] });
  const groen = volgRun(ctx, { label: 'release.yml', stopcode: 'release-rood', zoek: () => run({ conclusion: 'failure' }) });
  assert.equal(groen.conclusion, 'success');
  assert.equal(spoor.acts.filter(a => a.startsWith('rerun')).length, 1);

  const al = nep({ gh: [[/actions\/runs\/1$/, run({ run_attempt: 2, conclusion: 'failure' })]] });
  assert.throws(() => volgRun(al.ctx, { label: 'snap', stopcode: 'snap-mislukt', zoek: () => run() }), e => e.code === 'snap-mislukt');
  assert.deepEqual(al.spoor.acts, []);

  const droog = nep({ droog: true, gh: [[/actions\/runs\/1$/, run({ conclusion: 'failure' })]] });
  assert.throws(() => volgRun(droog.ctx, { label: 'x', stopcode: 'release-rood', zoek: () => run() }), e => e instanceof DroogStop && /rerun/.test(e.stap));
});

test('volgRun: een run die blijft lopen stopt na de grens', () => {
  const { ctx } = nep({ gh: [[/actions\/runs\/1$/, run({ status: 'in_progress', conclusion: null })]] });
  assert.throws(() => volgRun(ctx, { label: 'x', stopcode: 'release-rood', zoek: () => run(), maxMs: 60 * 60_000 }), e => e.code === 'wacht-te-lang');
});

test('kandidaat: open release-PR, ongetagde versie op main, botsingen en te lage versies', () => {
  const tags = [{ tag: 'v2026.47.0', sha: SHA_TAG }];
  const met = (mainVersie, prs, prVersie) => nep({
    git: [['show origin/main:package.json', JSON.stringify({ version: mainVersie })]],
    gh: [['pr list', prs], [/contents\/package\.json/, JSON.stringify({ version: prVersie })]],
  }).ctx;
  const pr = { number: 1, title: 'Release v2026.48.0', headRefName: 'release/v2026.48.0', headRefOid: 'h', url: 'u' };
  assert.deepEqual(kiesKandidaat(met('2026.47.0', [], ''), { prev: 'v2026.47.0', tags }), { mode: 'nieuw' });
  assert.equal(kiesKandidaat(met('2026.47.0', [pr], '2026.48.0'), { prev: 'v2026.47.0', tags }).mode, 'pr');
  assert.deepEqual(kiesKandidaat(met('2026.48.0', [], ''), { prev: 'v2026.47.0', tags }), { mode: 'main', versie: '2026.48.0' });
  assert.throws(() => kiesKandidaat(met('2026.47.0', [pr, { ...pr, number: 2 }], '2026.48.0'), { prev: 'v2026.47.0', tags }), e => e.code === 'kandidaat');
  assert.throws(() => kiesKandidaat(met('2026.47.0', [pr], '2026.48.1'), { prev: 'v2026.47.0', tags }), /titel en pakketversie/);
  assert.throws(() => kiesKandidaat(met('2026.46.0', [], ''), { prev: 'v2026.47.0', tags }), /niet hoger/);
  assert.throws(() => kiesKandidaat(met('2026.48.0', [pr], '2026.48.1'), { prev: 'v2026.47.0', tags }), e => e.code === 'kandidaat');
});

test('afschrijving: alleen een volledige, exacte regel in de PR "Release <tag>" telt', () => {
  const tag = 'v2026.43.0';
  for (const [body, title, verwacht] of [
    ['Nog onafgerond', `Release ${tag}`, false],
    ['Afgeschreven tag: v2026.42.0', `Release ${tag}`, false],
    [`Afgeschreven tag: ${tag}`, 'Gewone fix-PR', false],
    [`Reden: fout in getagde code\r\nAfgeschreven tag: ${tag}\r\nFix-PR: #8`, `Release ${tag}`, true],
    [`Afgeschreven tag: ${tag}`, `Release ${tag}`, true],
    [`Afgeschreven tag: ${tag} (bijna)`, `Release ${tag}`, false],
  ]) {
    const { ctx, spoor } = nep({ gh: [['pr list', [{ number: 7, title, body }]]] });
    assert.equal(isAfgeschreven(ctx, tag), verwacht, `${title}: ${body}`);
    assert.match(spoor.gh[0], /pr list --repo .* --state merged --search "Release v2026\.43\.0" in:title/);
  }
  const fout = nep({ gh: [['pr list', () => { throw new Error('gh faalde'); }]] });
  assert.throws(() => isAfgeschreven(fout.ctx, tag), /gh faalde/, 'een leesfout geeft geen opvolgroute vrij');
});

test('cijfers: alleen de stats van het eigen blok', () => {
  const tekst = "x({\n  '2026.48.0': {\n    primary: {},\n    stats: { daysSincePrevious: 0, commitsSincePrevious: 0, addedCodeLines: 0 },\n  },\n  '2026.47.0': {\n    stats: { daysSincePrevious: 7, commitsSincePrevious: 712, addedCodeLines: 86292 },\n  },\n})";
  const nieuw = zetCijfers(tekst, '2026.48.0', { daysSincePrevious: 7, commitsSincePrevious: 300, addedCodeLines: 1234 });
  assert.match(nieuw, /'2026\.48\.0': \{\n {4}primary: \{\},\n {4}stats: \{ daysSincePrevious: 7, commitsSincePrevious: 300, addedCodeLines: 1234 \},/);
  assert.match(nieuw, /daysSincePrevious: 7, commitsSincePrevious: 712, addedCodeLines: 86292/);
  assert.throws(() => zetCijfers(tekst, '2026.49.0', { daysSincePrevious: 1, commitsSincePrevious: 1, addedCodeLines: 1 }), e => e.code === 'tekst-checks');
});

test('website: beide unieke liveblokken moeten de exacte versie noemen', () => {
  const nieuw = '<section class="x" id="whats-new">Nieuw v2026.47.0</section>';
  const tijdlijn = '<!-- rn:start -->v2026.47.0<!-- rn:end -->';
  assert.equal(websiteBlokkenLive(nieuw + tijdlijn, '2026.47.0'), true);
  assert.equal(websiteBlokkenLive('<footer>v2026.47.0</footer>', '2026.47.0'), false);
  assert.equal(websiteBlokkenLive(nieuw + '<footer>v2026.47.0</footer>', '2026.47.0'), false);
  assert.equal(websiteBlokkenLive(tijdlijn + '<footer>v2026.47.0</footer>', '2026.47.0'), false);
  assert.equal(websiteBlokkenLive(nieuw + tijdlijn.replace('v2026.47.0', 'v2026.47.01'), '2026.47.0'), false);
  assert.equal(websiteBlokkenLive(nieuw + nieuw + tijdlijn, '2026.47.0'), false);
  assert.equal(websiteBlokkenLive(nieuw + tijdlijn + tijdlijn, '2026.47.0'), false);
});

test('website: precies één blok vervangen, anders een fout', () => {
  const doel = '<a><!-- rn:start x -->oud<!-- rn:end --></a>';
  const bron = '<b><!-- rn:start y -->nieuw<!-- rn:end --></b>';
  assert.equal(vervangBlok(doel, bron, /<!-- rn:start[\s\S]*?<!-- rn:end -->/g, 'rn'), '<a><!-- rn:start y -->nieuw<!-- rn:end --></a>');
  assert.throws(() => vervangBlok(doel + doel, bron, /<!-- rn:start[\s\S]*?<!-- rn:end -->/g, 'rn'), /precies één blok/);
});

test('teksten: de agent mag niet buiten zijn bestanden schrijven', () => {
  const pad = '/repo/.claude/worktrees/release-werk';
  const opzet = (status, claude) => nep({
    bestanden: { [`${pad}/docs/CHANGELOG.md`]: '# Changelog', [`${pad}/src/services/updater/releaseHighlights.ts`]: '' },
    git: [['log --oneline', 'abc een commit'], ['status --porcelain', status]],
    claude,
  });
  const info = { versie: '2026.48.0', prev: 'v2026.47.0', base: SHA_MAIN, pad };
  const buiten = opzet('1 .M N... 100644 100644 100644 a b src/App.tsx\0', () => ({ ok: true, result: 'klaar' }));
  assert.throws(() => teksten(buiten.ctx, pad, info), e => e.code === 'tekst-grens' && /src\/App\.tsx/.test(e.reden));
  const mislukt = opzet('', () => ({ ok: false, fout: 'claude -p faalde: budget' }));
  assert.throws(() => teksten(mislukt.ctx, pad, info), e => e.code === 'tekst-agent');
  const leeg = opzet('', () => ({ ok: true, result: 'niets gedaan' }));
  assert.throws(() => teksten(leeg.ctx, pad, info), e => e.code === 'tekst-agent' && /ontbreekt/.test(e.reden));
});

test('release: vorige tag helemaal uitgeleverd en niets veranderd: klaar zonder één schrijfstap', () => {
  const { ctx, spoor } = nep({
    git: [...GIT_BASIS, ['rev-list --count', '0']],
    gh: [...GH_BASIS, ...uitgeleverd()],
    run: RUN_BASIS,
    http: HTTP,
  });
  assert.equal(release(ctx), 'niets veranderd sinds v2026.47.0');
  assert.deepEqual(spoor.acts, []);
  assert.equal(spoor.claude, 0);
});

test('release: mislukte Snap-publicatie na de rerun stopt, met het verslag bijgewerkt', () => {
  const snap = run({ id: 30, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z', run_attempt: 2, conclusion: 'failure' });
  const { ctx, spoor } = nep({
    git: GIT_BASIS,
    gh: [...GH_BASIS, ...uitgeleverd({ snap }), [/issues\/969\/comments\?per_page/, []], [/-X POST .*issues\/969\/comments/, '']],
    run: RUN_BASIS,
    http: HTTP,
  });
  assert.throws(() => release(ctx), e => e.code === 'snap-mislukt' && /44017547538|runs\/30/.test(e.reden));
  assert.deepEqual(spoor.acts, ['hervatverslag v2026.47.0 op PR #969 bijwerken']);
});

test('release: een verlopen Snap Store-login is een melding en geen stop; elke andere Snap-fout wel', () => {
  const rood = run({ id: 30, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z', run_attempt: 2, conclusion: 'failure' });
  const log = '  HEAD_BRANCH: v2026.47.0\n2026-11-17T04:38:36.25Z Exported credentials are no longer valid for the Snap Store.\n';
  const alleenPublish = [{ name: 'Build snap', conclusion: 'success' }, { name: 'Publish to Snap Store', conclusion: 'failure' }];
  const { ctx, spoor } = nep({
    git: [...GIT_BASIS, ['rev-list --count', '0']],
    gh: [...GH_BASIS, ...uitgeleverd({ snap: rood, snapLog: log, snapStappen: alleenPublish }), [/issues\/969\/comments\?per_page/, []], [/-X POST .*issues\/969\/comments/, '']],
    run: RUN_BASIS,
    http: HTTP,
  });
  assert.equal(release(ctx), 'niets veranderd sinds v2026.47.0; meldingen: snap-login');
  assert.equal(spoor.meldingen.length, 1);
  assert.match(spoor.meldingen[0], /^snap-login: Snap v2026\.47\.0: .*verlopen login \(https:\/\/.*\); de Snap Store kreeg v2026\.47\.0 niet\.$/);
  assert.deepEqual(spoor.acts, ['hervatverslag v2026.47.0 op PR #969 bijwerken'], 'geen rerun, wel het verslag');

  const anders = (snapLog, snapStappen) => nep({
    git: GIT_BASIS, gh: [...GH_BASIS, ...uitgeleverd({ snap: rood, snapLog, snapStappen }), [/issues\/969\/comments/, []]], run: RUN_BASIS, http: HTTP, droog: true,
  }).ctx;
  assert.throws(() => release(anders('  HEAD_BRANCH: v2026.47.0\nError: upload timed out\n', alleenPublish)), e => e.code === 'snap-mislukt', 'andere publicatiefout');
  assert.throws(() => release(anders(log, [{ name: 'Build snap', conclusion: 'failure' }, { name: 'Publish to Snap Store', conclusion: 'failure' }])), e => e.code === 'snap-mislukt', 'ook de bouw faalde');
});

test('release: Snap groen maar de Store-stap overgeslagen is geen uitlevering', () => {
  const { ctx } = nep({ git: GIT_BASIS, gh: [...GH_BASIS, ...uitgeleverd({ snapStap: 'skipped' }), [/issues\/969\/comments/, []]], run: RUN_BASIS, http: HTTP, droog: true });
  assert.throws(() => release(ctx), e => e instanceof ReleaseStop && e.code === 'snap-mislukt');
});

test('release: AUR overgeslagen zonder de notice van het ontbrekende secret stopt', () => {
  const { ctx } = nep({ git: GIT_BASIS, gh: [...GH_BASIS, ...uitgeleverd({ aurNotice: false }), [/issues\/969\/comments/, []]], run: RUN_BASIS, http: HTTP, droog: true });
  assert.throws(() => release(ctx), e => e instanceof ReleaseStop && e.code === 'aur-mislukt');
});

test('release (droog): ontbrekende release zonder run stopt vóór de dispatch', () => {
  const gh = [...GH_BASIS, [/releases\/tags\/v2026\.47\.0$/, Object.assign(new Error('HTTP 404'), { stderr: 'gh: Not Found (HTTP 404)' })],
    [/workflows\/release\.yml\/runs/, { workflow_runs: [] }]];
  const { ctx, spoor } = nep({ git: GIT_BASIS, gh, run: RUN_BASIS, http: HTTP, droog: true });
  assert.throws(() => release(ctx), e => e instanceof DroogStop && e.stap === 'release.yml starten voor de bestaande tag v2026.47.0');
  assert.equal(spoor.gh.some(a => a.startsWith('workflow run')), false);
});

test('lever: vlak na de tagpush wacht het script op de release-run en start geen tweede', () => {
  let rondes = 0;
  const gh = [
    [/workflows\/release\.yml\/runs/, () => ({ workflow_runs: rondes++ < 2 ? [] : [run({ id: 10 })] })],
    ...uitgeleverd().filter(([p]) => !String(p).includes('release\\.yml')),
  ];
  const { ctx, spoor } = nep({ gh, http: HTTP });
  const regels = [];
  lever(ctx, { tag: 'v2026.47.0', sha: SHA_TAG }, regels);
  assert.deepEqual(spoor.acts, []);
  assert.equal(regels.length, 6);
});

test('release: een draft zonder release-run is een stop, geen dispatch', () => {
  const gh = [...GH_BASIS, [/releases\/tags\/v2026\.47\.0$/, { draft: true, prerelease: false, published_at: null, assets: [] }],
    [/workflows\/release\.yml\/runs/, { workflow_runs: [] }], [/issues\/969\/comments/, []]];
  const { ctx } = nep({ git: GIT_BASIS, gh, run: RUN_BASIS, http: HTTP, droog: true });
  assert.throws(() => release(ctx), e => e instanceof ReleaseStop && e.code === 'release-ontbreekt');
});

test('release: een afgeschreven vorige tag wordt niet uitgeleverd', () => {
  const gh = [[/pr list .*--state merged .*Release v2026\.47\.0/, [{ number: 969, title: 'Release v2026.47.0', body: 'x\nAfgeschreven tag: v2026.47.0\n' }]], ...GH_BASIS];
  const { ctx, spoor } = nep({ git: [...GIT_BASIS, ['rev-list --count', '0']], gh, run: RUN_BASIS, http: HTTP });
  assert.equal(release(ctx), 'niets veranderd sinds v2026.47.0');
  assert.equal(spoor.gh.some(a => /releases\/tags/.test(a)), false);
});

test('release: nieuwe commits en een rode main-CI na de rerun stopt vóór de werkplek', () => {
  const rood = run({ id: 60, head_sha: SHA_MAIN, head_branch: 'main', run_attempt: 2, conclusion: 'failure' });
  const gh = [...GH_BASIS, ...uitgeleverd(), [/workflows\/ci\.yml\/runs/, { workflow_runs: [rood] }], [/actions\/runs\/60$/, rood]];
  const { ctx, spoor } = nep({ git: [...GIT_BASIS, ['rev-list --count', '12']], gh, run: RUN_BASIS, http: HTTP });
  assert.throws(() => release(ctx), e => e.code === 'main-ci-rood');
  assert.deepEqual(spoor.acts, []);
});

test('release (droog): nieuwe commits en groene main: de eerste schrijfstap is de werkplek', () => {
  const groen = run({ id: 60, head_sha: SHA_MAIN, head_branch: 'main' });
  const gh = [...GH_BASIS, ...uitgeleverd(), [/workflows\/ci\.yml\/runs/, { workflow_runs: [groen] }], [/actions\/runs\/60$/, groen]];
  const { ctx } = nep({ git: [...GIT_BASIS, ['rev-list --count', '12']], gh, run: RUN_BASIS, http: HTTP, droog: true });
  assert.throws(() => release(ctx), e => e instanceof DroogStop && e.stap === 'werkplek release-werk maken');
});

test('verslag: het script schrijft alleen zijn eigen blok en vult zijn regels aan', () => {
  const eerste = verslagTekst({ tag: 'v1', kop: 'PR groen', regels: ['PR-head groen.', 'Basis x.'], bestaand: '<!-- ops-release:v1 -->\nhandwerk van een agent' });
  assert.ok(eerste.startsWith(`<!-- ops-release:v1 -->\n${BEGIN}\n**v1: PR groen**`));
  assert.ok(eerste.endsWith(`${EIND}\n\nhandwerk van een agent`));
  // De thread zet er een fix-PR en een review onder; het volgende verslag met een kortere lijst wist niets.
  const metNotitie = `${eerste}\n\nFix-PR #1234, review-taak ABC, VERVOLG: 1801.`;
  const tweede = verslagTekst({ tag: 'v1', kop: 'klaar voor de tag', regels: ['Te taggen SHA y.', 'Basis x.'], bestaand: metNotitie });
  assert.match(tweede, /\*\*v1: klaar voor de tag\*\*\n\n- PR-head groen\.\n- Basis x\.\n- Te taggen SHA y\.\n/);
  assert.match(tweede, /handwerk van een agent\n\nFix-PR #1234, review-taak ABC, VERVOLG: 1801\.$/);
  assert.equal(tweede.split('<!-- ops-release:v1 -->').length, 2);
  assert.equal(tweede.split(BEGIN).length, 2);
});

test('gewijzigdePaden: echte git-status via de echte adapter, ook het eerste pad en vreemde namen', () => {
  const map = mkdtempSync(join(tmpdir(), 'ops-release-git-'));
  try {
    const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: map, encoding: 'utf8' });
    git('init', '-q');
    for (const f of ['headless/a.json', 'docs/CHANGELOG.md', 'oud.txt', 'weg.txt']) {
      execFileSync('mkdir', ['-p', join(map, f, '..')]);
      writeFileSync(join(map, f), 'x\n');
    }
    git('add', '.');
    git('commit', '-qm', 'begin');
    writeFileSync(join(map, 'headless/a.json'), 'y\n');
    writeFileSync(join(map, 'docs/CHANGELOG.md'), 'y\n');
    writeFileSync(join(map, 'nieuw met spatie.md'), 'n\n');
    git('mv', 'oud.txt', 'nieuw.txt');
    git('rm', '-q', 'weg.txt');
    const ctx = maakContext({ droog: true, scriptRoot: map, root: map, log: () => {} });
    assert.deepEqual(gewijzigdePaden(ctx, map).sort(), ['docs/CHANGELOG.md', 'headless/a.json', 'nieuw met spatie.md', 'nieuw.txt', 'oud.txt', 'weg.txt']);
  } finally {
    rmSync(map, { recursive: true, force: true });
  }
});

test('vervolgRun: workflow_run op de SHA van main; een overgeslagen run van een mislukte poging telt niet', () => {
  // v2026.45.0: release op fb617899, Snap op 2a66df33 (de SHA van main op dat moment).
  const release = run({ id: 42683918392, head_sha: 'fb617899c39dcd08089856f43b9a38df434741ad', created_at: '2026-11-09T19:30:02Z' });
  const snap = run({ id: 42688429475, event: 'workflow_run', head_branch: 'main', head_sha: '2a66df33c8854e296b638a3f0d39379280d1afb6', created_at: '2026-11-09T19:58:20Z' });
  const pr = run({ id: 2, event: 'pull_request', head_branch: 'x', created_at: '2026-11-09T19:59:00Z' });
  const volgendeRelease = run({ id: 44017547538, event: 'workflow_run', head_branch: 'main', created_at: '2026-11-17T04:29:37Z' });
  const { ctx, spoor } = nep({ gh: [[/snap\.yml\/runs/, { workflow_runs: [volgendeRelease, pr, snap] }]] });
  assert.equal(vervolgRun(ctx, 'snap.yml', { tag: 'v2026.45.0', releaseRun: release })?.id, 42688429475);
  assert.match(spoor.gh[0], /created=%3E%3D2026-11-09T19%3A30%3A02/);
  // Poging 1 van de release faalde (vervolgrun 201 overgeslagen), de rerun slaagde (vervolgrun 30 hoort erbij).
  const overgeslagen = run({ id: 201, event: 'workflow_run', head_branch: 'main', created_at: '2026-11-17T04:27:00Z', conclusion: 'skipped' });
  const goed = run({ id: 30, event: 'workflow_run', head_branch: 'main', created_at: '2026-11-17T04:29:37Z' });
  const rerun = nep({ gh: [[/snap\.yml\/runs/, { workflow_runs: [goed, overgeslagen] }]] });
  assert.equal(vervolgRun(rerun.ctx, 'snap.yml', { tag: 'v2026.47.0', releaseRun: run({ run_attempt: 2 }) })?.id, 30);
  // Vlak na de rerun bestaat run 30 nog niet: dan is er nog geen kandidaat (het script wacht), niet run 201.
  const nogNiet = nep({ gh: [[/snap\.yml\/runs/, { workflow_runs: [overgeslagen] }]] });
  assert.equal(vervolgRun(nogNiet.ctx, 'snap.yml', { tag: 'v2026.47.0', releaseRun: run({ run_attempt: 2 }) }), null);
  const later = run({ id: 3, event: 'workflow_dispatch', head_branch: 'v2026.45.0', created_at: '2026-11-10T08:00:00Z' });
  const alleenDispatch = nep({ gh: [[/aur\.yml\/runs/, { workflow_runs: [later] }]] });
  assert.equal(vervolgRun(alleenDispatch.ctx, 'aur.yml', { tag: 'v2026.45.0', releaseRun: release })?.id, 3);
});

test('lever: een vervolgrun zonder HEAD_BRANCH van de tag in zijn log wordt niet gevolgd en krijgt geen rerun', () => {
  const vreemd = run({ id: 20, event: 'workflow_run', head_branch: 'main', head_sha: SHA_MAIN, created_at: '2026-11-17T04:29:37Z', conclusion: 'failure' });
  const gh = [[/actions\/runs\/20$/, vreemd], [/actions\/jobs\/200\/logs/, '  HEAD_BRANCH: v2026.46.0\n'], ...uitgeleverd()];
  const { ctx, spoor } = nep({ gh, http: HTTP });
  assert.throws(() => lever(ctx, { tag: 'v2026.47.0', sha: SHA_TAG }, []), e => e.code === 'uitlevering' && /niet aan de tag te koppelen/.test(e.reden));
  assert.deepEqual(spoor.acts, []);
});

test('slot: één run tegelijk; een dood proces laat geen slot achter', () => {
  const map = mkdtempSync(join(tmpdir(), 'ops-release-slot-'));
  try {
    const pad = join(map, 'slot');
    const laat = neemSlot(pad, 111, () => true);
    assert.throws(() => neemSlot(pad, 222, () => true), e => e.code === 'al-actief');
    laat();
    writeFileSync(pad, '333');
    assert.doesNotThrow(() => neemSlot(pad, 444, () => false)());
  } finally {
    rmSync(map, { recursive: true, force: true });
  }
});

test('claude -p: Opus 5.5 high, zonder vragen, met alleen de genoemde tools', () => {
  const args = claudeArgs('doe het', { tools: ['Read', 'Bash'], toegestaan: ['Read', 'Bash(git log:*)'] });
  const waarde = vlag => args[args.indexOf(vlag) + 1];
  assert.equal(waarde('--model'), 'claude-opus-5-5');
  assert.equal(waarde('--effort'), 'high');
  assert.equal(waarde('--permission-mode'), 'dontAsk');
  assert.equal(waarde('--tools'), 'Read,Bash');
  assert.deepEqual(args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--strict-mcp-config')), ['Read', 'Bash(git log:*)']);
});
