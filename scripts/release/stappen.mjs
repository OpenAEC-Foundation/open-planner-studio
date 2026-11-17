// De stappen van de wekelijkse release, in vaste volgorde. Elke stap kijkt eerst op GitHub (of in de
// werkplek) of hij al af is; zo kan het script na elke stop of crash opnieuw beginnen.
// Wat de stappen doen, staat in `.claude/skills/release/SKILL.md` en `referentie.md`.
import { join } from 'node:path';
import { parseVersion } from '../bump-version.js';
import { DroogStop, ReleaseStop, ReleaseTaak } from './uitkomst.mjs';
import { api, runs, volgRun, wacht, wachtOfNull, wachtOpChecks, schrijfVerslag } from './github.mjs';
import { tekstOpdracht, herstelOpdracht, websiteOpdracht, TEKST_PADEN, WEBSITE_TEKST_PADEN, TEKST_TOOLS, WEBSITE_TOOLS } from './agent.mjs';

const MINUUT = 60_000;
const UUR = 60 * MINUUT;
const DAG = 24 * UUR;
const STABIELE_TAG = /^v([1-9]\d{3})\.([1-9]\d?)\.(0|[1-9]\d*)$/;
const WEBSITE = 'OpenAEC-Foundation/website';

// ---------------------------------------------------------------------------------------------------
// Versies

export function versieDelen(versie) {
  try {
    return parseVersion(String(versie).replace(/^v/, ''));
  } catch (err) {
    throw new ReleaseStop('kandidaat', err.message);
  }
}

/** -1, 0 of 1, met jaar, week en volgnummer als getallen. */
export function vergelijk(a, b) {
  const x = versieDelen(a);
  const y = versieDelen(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

const geldig = tag => { try { parseVersion(tag.slice(1)); return true; } catch { return false; } };

/** De stabiele origin-tags met hun commit, nieuwste eerst. */
export function originTags(ctx) {
  const regels = ctx.git(['ls-remote', '--tags', 'origin', 'v*']).split('\n').filter(Boolean);
  const tags = new Map();
  for (const regel of regels) {
    const [sha, ref] = regel.split('\t');
    const naam = ref.replace(/^refs\/tags\//, '');
    const kaal = naam.replace(/\^\{\}$/, '');
    if (!STABIELE_TAG.test(kaal) || !geldig(kaal)) continue;
    // De gepelde regel (^{}) geeft de commit van een geannoteerde tag; die wint.
    if (naam.endsWith('^{}') || !tags.has(kaal)) tags.set(kaal, sha);
  }
  return [...tags].map(([tag, sha]) => ({ tag, sha })).sort((a, b) => vergelijk(b.tag, a.tag));
}

// ---------------------------------------------------------------------------------------------------
// Voorbereiding

const ORIGIN = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)OpenAEC-Foundation\/open-planner-studio(?:\.git)?\/?$/;

export function controleerOrigin(ctx) {
  for (const args of [['remote', 'get-url', 'origin'], ['remote', 'get-url', '--push', 'origin']]) {
    let url;
    try { url = ctx.git(args); } catch { throw new ReleaseStop('origin', 'origin ontbreekt'); }
    if (!ORIGIN.test(url)) throw new ReleaseStop('origin', `origin wijst naar ${url}, niet naar OpenAEC-Foundation/open-planner-studio`);
  }
}

/** Eerst: browsertests. Wacht op een open reparatie-issue; een gemelde blokkade stopt. */
export function wachtOpReparatie(ctx) {
  // Eén vraag met de echt laatste reactie per issue (`gh issue list` leest alleen de eerste honderd).
  const [eigenaar, naam] = ctx.repo.split('/');
  const query = `{ repository(owner: "${eigenaar}", name: "${naam}") { issues(states: OPEN, labels: ["browsertests-reparatie"], first: 20) { nodes { number comments(last: 1) { nodes { body } } } } } }`;
  wacht(ctx, 'het issue Browsertests repareren', () => {
    const open = ctx.ghJson(['api', 'graphql', '-f', `query=${query}`])?.data?.repository?.issues?.nodes;
    if (!Array.isArray(open)) throw new Error('onverwacht antwoord op de vraag naar het reparatie-issue');
    if (open.length === 0) return true;
    const blok = open.find(i => (i.comments.nodes[0]?.body ?? '').startsWith('REPARATIE GEBLOKKEERD'));
    if (blok) throw new ReleaseStop('reparatie-geblokkeerd', `de reparatie meldt een blokkade in issue #${blok.number}`);
    return undefined;
  }, { intervalMs: 5 * MINUUT, maxMs: Infinity });
}

/** De nachtvertaling van maandag moet klaar zijn vóór de werkplek (nachtvertalingen-skill). */
export function wachtOpNacht(ctx, regels) {
  const markering = join(ctx.home, '.local/state/ops-nachtvertalingen/actief');
  let gemeld = false;
  wacht(ctx, 'de nachtvertaling', () => {
    const mtime = ctx.fs.mtimeMs(markering);
    if (mtime !== null && ctx.now() - mtime < DAG) return undefined;
    if (mtime !== null && !gemeld) {
      regels.push(`De markering van de nachtvertaling is ouder dan 24 uur en is genegeerd (${markering}).`);
      gemeld = true;
    }
    const vandaag = amsterdamDatum(ctx.now());
    const prs = ctx.ghJson(['pr', 'list', '--repo', ctx.repo, '--state', 'open', '--head', `vertalingen/${vandaag}`, '--json', 'number']);
    return prs.length === 0 ? true : undefined;
  }, { intervalMs: 5 * MINUUT, maxMs: Infinity });
}

export function amsterdamDatum(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

const GH_FOUT = /gh api .*faalde|lege uitvoer|geen geldige JSON|onverwachte uitvoer|git merge-base/;

/** `release-ci-check.mjs`, met `--browser` of volledig. Rode browserrun = de reparatie (taak). */
export function ciCheck(ctx, sha, { alleenBrowser }) {
  const args = [join(ctx.scriptRoot, 'scripts/release-ci-check.mjs'), ...(alleenBrowser ? ['--browser'] : []), sha];
  const res = ctx.run('node', args, { cwd: ctx.scriptRoot });
  if (res.status === 0) return;
  const fouten = res.stdout.split('\n').filter(r => r.startsWith('::error::')).map(r => r.replace('::error::release-ci-check: ', ''));
  const browserrun = res.stdout.match(/^BROWSERRUN=(\d*)$/m)?.[1] ?? '';
  if (res.status !== 1 || fouten.length === 0 || fouten.some(f => GH_FOUT.test(f))) {
    throw new ReleaseStop('onverwacht', `release-ci-check: ${fouten.join('; ') || res.stderr || `exit ${res.status}`}`);
  }
  if (fouten.some(f => /browserrun/i.test(f))) {
    throw new ReleaseTaak('browserreparatie', `BROWSERRUN=${browserrun}; ${fouten.join('; ')}`);
  }
  throw new ReleaseStop('main-ci-rood', fouten.join('; '));
}

// ---------------------------------------------------------------------------------------------------
// Werkplekken

/** Een eigen worktree onder `.claude/worktrees/`. Bestaat hij al, dan moet hij schoon zijn. */
export function werkplek(ctx, naam, { ref, branch, nieuweBranch }) {
  const pad = join(ctx.root, '.claude/worktrees', naam);
  if (ctx.fs.exists(pad)) {
    if (ctx.git(['status', '--porcelain'], { cwd: pad }) !== '') {
      throw new ReleaseStop('werkplek', `${pad} heeft niet-gecommitte wijzigingen; bekijk en ruim ze op, en start dan opnieuw`);
    }
    const huidig = ctx.git(['branch', '--show-current'], { cwd: pad });
    // Schoon, dus overstappen kost niets.
    if (branch && huidig !== branch) {
      ctx.act(`werkplek ${naam} naar ${branch}`, () => {
        const lokaal = ctx.gitOk(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
        ctx.git(lokaal ? ['switch', '--quiet', branch] : ['switch', '--quiet', '--no-track', '-c', branch, ref], { cwd: pad });
      });
    }
    if (!branch && !nieuweBranch && ref) ctx.act(`werkplek ${naam} naar ${ref}`, () => ctx.git(['switch', '--quiet', '--detach', ref], { cwd: pad }));
    return pad;
  }
  ctx.act(`werkplek ${naam} maken`, () => {
    if (branch) {
      const lokaal = ctx.gitOk(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
      ctx.git(lokaal ? ['worktree', 'add', pad, branch] : ['worktree', 'add', '--no-track', '-b', branch, pad, ref]);
    } else {
      ctx.git(['worktree', 'add', '--detach', pad, ref]);
    }
  });
  return pad;
}

/** Eenmaal per run `npm ci` per werkplek (besluit 9). */
export function npmCi(ctx, pad) {
  if (ctx.npmGedaan.has(pad)) return;
  ctx.act(`npm ci in ${pad}`, () => moet(ctx, 'werkplek', 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: pad }));
  ctx.npmGedaan.add(pad);
}

/** Draait een opdracht; een andere exitcode dan 0 is een stop met `code`. Geeft de uitvoer terug. */
export function moet(ctx, code, cmd, args, opts) {
  const res = ctx.run(cmd, args, opts);
  if (res.status !== 0) {
    const staart = `${res.stdout}\n${res.stderr}`.trim().split('\n').slice(-15).join(' | ');
    throw new ReleaseStop(code, `${cmd} ${args.join(' ')} gaf exit ${res.status}: ${staart}`);
  }
  return res.stdout;
}

// ---------------------------------------------------------------------------------------------------
// Hervatten: de vorige tag (referentie.md, Hervatten)

/** Zoekt de gemergde PR `Release <tag>`; ook voor de afschrijfregel. */
export function releasePr(ctx, tag, state = 'merged') {
  const prs = ctx.ghJson(['pr', 'list', '--repo', ctx.repo, '--base', 'main', '--state', state, '--search', `"Release ${tag}" in:title`,
    '--limit', '100', '--json', 'number,title,body,url,headRefName,headRefOid']);
  return prs.filter(pr => pr.title === `Release ${tag}`);
}

export function isAfgeschreven(ctx, tag) {
  return releasePr(ctx, tag).some(pr => pr.body.split(/\r?\n/).includes(`Afgeschreven tag: ${tag}`));
}

function leesRelease(ctx, tag) {
  try {
    return api(ctx, `repos/${ctx.repo}/releases/tags/${tag}`);
  } catch (err) {
    if (/HTTP 404/.test(String(err.stderr ?? err.message))) return null;
    throw err;
  }
}

const gepubliceerd = rel => rel && rel.draft === false && rel.prerelease === false && Boolean(rel.published_at);

/** Release-run, publicatie, verify, Snap, AUR, assets en wiki voor één tag. Website apart. */
export function lever(ctx, { tag, sha }, regels) {
  const versie = tag.slice(1);
  // 1. release.yml
  const zoekRelease = () => runs(ctx, 'release.yml', { head_sha: sha }).find(r => r.head_branch === tag) ?? null;
  let release = leesRelease(ctx, tag);
  // Vlak na de tagpush verschijnt de run pas na enkele seconden; wacht eerst, anders start er een tweede.
  if (!wachtOfNull(ctx, `release.yml voor ${tag} start`, () => zoekRelease() ?? undefined, { intervalMs: MINUUT, maxMs: 10 * MINUUT })) {
    if (release) throw new ReleaseStop('release-ontbreekt', `${tag}: er is een release (draft=${release.draft}) maar geen release.yml-run`);
    ctx.act(`release.yml starten voor de bestaande tag ${tag}`, () =>
      ctx.gh(['workflow', 'run', 'release.yml', '--repo', ctx.repo, '--ref', tag, '-f', `version=${tag}`]));
    wacht(ctx, `release.yml voor ${tag} start`, () => zoekRelease() ?? undefined, { maxMs: UUR });
  }
  const releaseRun = volgRun(ctx, { label: `release.yml ${tag}`, stopcode: 'release-rood', zoek: zoekRelease, maxMs: 5 * UUR });
  release = leesRelease(ctx, tag);
  if (!gepubliceerd(release)) throw new ReleaseStop('release-ontbreekt', `${tag}: release.yml is groen, maar de release is niet gepubliceerd`);
  regels.push(`Release: [release.yml ${releaseRun.id}](${releaseRun.html_url}) groen, gepubliceerd ${release.published_at}.`);

  // 2. De vervolgworkflows die op release.yml wachten.
  // Een vervolgrun die na een uur nog niet bestaat, is een stop: een dispatch van snap.yml publiceert niet,
  // en release-verify hoort vanzelf te starten.
  const vervolg = (workflow, label, stopcode, groen, ontbreekt = stopcode) => {
    const zoek = () => vervolgRun(ctx, workflow, { tag, releaseRun });
    const gevonden = wachtOfNull(ctx, `${label} voor ${tag} start`, () => zoek() ?? undefined, { maxMs: UUR });
    if (!gevonden) throw new ReleaseStop(ontbreekt, `${tag}: geen ${workflow}-run na release.yml`);
    return volgRun(ctx, { label: `${label} ${tag}`, stopcode, zoek: () => zoek() ?? gevonden, maxMs: 3 * UUR, groen, bewijs: run => hoortBijTag(ctx, run, tag) });
  };
  const verify = vervolg('release-verify.yml', 'release-verify.yml', 'release-verify-rood');
  regels.push(`Verify Release: [${verify.id}](${verify.html_url}) groen.`);

  const stapVan = (run, naam) => {
    const jobs = api(ctx, `repos/${ctx.repo}/actions/runs/${run.id}/jobs?per_page=100`).jobs ?? [];
    return jobs.flatMap(j => j.steps ?? []).find(s => s.name === naam)?.conclusion ?? 'ontbreekt';
  };
  const snap = vervolg('snap.yml', 'snap.yml', 'snap-mislukt',
    run => (run.conclusion === 'success' && stapVan(run, 'Publish to Snap Store') === 'success') || snapLoginVerlopen(ctx, run),
    'snap-ontbreekt');
  if (snap.conclusion === 'success') {
    regels.push(`Snap: [${snap.id}](${snap.html_url}) groen, Publish to Snap Store gelukt.`);
  } else {
    // Besluit wrakko, 2026-11-17: een verlopen Store-login is geen stop (zoals het AUR-secret); melden en door.
    const tekst = `Snap ${tag}: de .snap is gebouwd, maar de Snap Store weigert de verlopen login (${snap.html_url}); de Snap Store kreeg ${tag} niet.`;
    regels.push(tekst);
    ctx.meld('snap-login', tekst);
  }

  regels.push(aur(ctx, { tag, versie, releaseRun }));
  regels.push(controleerAssets(ctx, { tag, versie, release }));
  regels.push(wiki(ctx, { tag, sha, versie }));
}

/**
 * De run van een vervolgworkflow voor deze tag. Een `workflow_run`-run staat op de SHA van main op dat moment,
 * niet op de tag (v2026.45.0: release op fb617899, Snap en Verify op 2a66df33), en er is geen veld dat naar de
 * release-run wijst. Kandidaat: de oudste niet-overgeslagen run sinds de start van de release-run (een mislukte
 * releasepoging geeft alleen overgeslagen vervolgruns). Bewijs: `hoortBijTag`. Anders: een dispatch op de tag.
 */
export function vervolgRun(ctx, workflow, { tag, releaseRun }) {
  const vanaf = Date.parse(releaseRun.created_at);
  const lijst = runs(ctx, workflow, { created: `>=${new Date(vanaf).toISOString()}` });
  // De oudste: een latere release (een week verder) geeft nieuwere vervolgruns. `lijst` is nieuwste eerst.
  return lijst.filter(r => r.event === 'workflow_run' && Date.parse(r.created_at) >= vanaf && r.conclusion !== 'skipped').at(-1)
    ?? lijst.find(r => r.event === 'workflow_dispatch' && r.head_branch === tag) ?? null;
}

/** De log van één job. `gh` 2.102 wil `--allow-escape-sequences`, `gh` 2.45 op aia kent die vlag niet. */
export function jobLog(ctx, id) {
  const pad = `repos/${ctx.repo}/actions/jobs/${id}/logs`;
  try { return ctx.gh(['api', pad, '--allow-escape-sequences']); } catch { return ctx.gh(['api', pad]); }
}

/**
 * Een afgeronde vervolgrun hoort bij de tag als een gedraaide job de tag logt zoals de workflow hem uit
 * `workflow_run.head_branch` haalt: `HEAD_BRANCH: <tag>` (snap.yml, release-verify.yml) of `VERSION: <tag>` (aur.yml).
 */
export function hoortBijTag(ctx, run, tag) {
  if (run.event === 'workflow_dispatch') return run.head_branch === tag;
  const jobs = api(ctx, `repos/${ctx.repo}/actions/runs/${run.id}/jobs?per_page=100`).jobs ?? [];
  const regel = new Set([`HEAD_BRANCH: ${tag}`, `VERSION: ${tag}`]);
  return jobs.filter(j => j.conclusion && j.conclusion !== 'skipped')
    .some(j => jobLog(ctx, j.id).split('\n').some(r => regel.has(r.replace(/^\S+\s+/, '').trim())));
}

/**
 * De bekende Snap-fout: alleen de stap `Publish to Snap Store` faalde, en de log zegt dat de geëxporteerde
 * Store-login verlopen is. Elke andere Snap-fout blijft een stop.
 */
export const SNAP_LOGIN_VERLOPEN = 'credentials are no longer valid for the Snap Store';
export function snapLoginVerlopen(ctx, run) {
  if (run.conclusion !== 'failure') return false;
  const jobs = api(ctx, `repos/${ctx.repo}/actions/runs/${run.id}/jobs?per_page=100`).jobs ?? [];
  const rood = jobs.flatMap(j => (j.steps ?? []).filter(st => st.conclusion === 'failure').map(st => ({ job: j, stap: st.name })));
  return rood.length === 1 && rood[0].stap === 'Publish to Snap Store' && jobLog(ctx, rood[0].job.id).includes(SNAP_LOGIN_VERLOPEN);
}

/** AUR: groen met push, of het bewezen ontbrekende secret (referentie.md, Ontbrekend AUR-secret). */
function aur(ctx, { tag, versie, releaseRun }) {
  const zoek = () => vervolgRun(ctx, 'aur.yml', { tag, releaseRun });
  if (!wachtOfNull(ctx, `aur.yml voor ${tag} start`, () => zoek() ?? undefined, { maxMs: 30 * MINUUT })) {
    ctx.act(`aur.yml starten voor ${tag} (publish=true)`, () =>
      ctx.gh(['workflow', 'run', 'aur.yml', '--repo', ctx.repo, '--ref', tag, '-f', `version=${tag}`, '-f', 'publish=true']));
    wacht(ctx, `aur.yml voor ${tag} start`, () => zoek() ?? undefined, { maxMs: UUR });
  }
  const run = volgRun(ctx, { label: `aur.yml ${tag}`, stopcode: 'aur-mislukt', zoek, bewijs: r => hoortBijTag(ctx, r, tag) });
  const jobs = api(ctx, `repos/${ctx.repo}/actions/runs/${run.id}/jobs?per_page=100`).jobs ?? [];
  const job = jobs.find(j => j.name === 'aur');
  const push = job?.steps?.find(s => s.name === 'Push to AUR')?.conclusion;
  if (push === 'success') {
    const info = ctx.httpJson('https://aur.archlinux.org/rpc/v5/info?arg[]=open-planner-studio-bin');
    const aurVersie = info?.results?.[0]?.Version ?? '';
    if (!aurVersie.startsWith(`${versie}-`)) throw new ReleaseStop('aur-mislukt', `AUR toont ${aurVersie || 'niets'}, verwacht ${versie}`);
    return `AUR: [${run.id}](${run.html_url}) groen, AUR-pakket ${aurVersie}.`;
  }
  if (push === 'skipped' && job) {
    const notices = api(ctx, `repos/${ctx.repo}/check-runs/${job.id}/annotations`)
      .filter(a => a.annotation_level === 'notice').map(a => a.message);
    const log = jobLog(ctx, job.id);
    if (notices.includes('AUR-push overgeslagen: secret AUR_SSH_PRIVATE_KEY ontbreekt.')
      && log.includes(`Open.Planner.Studio_${versie}_amd64.deb:`)) {
      return `AUR: [${run.id}](${run.html_url}) groen; Arch kreeg nog geen pakket: secret \`AUR_SSH_PRIVATE_KEY\` ontbreekt.`;
    }
  }
  throw new ReleaseStop('aur-mislukt', `aur.yml ${run.id}: Push to AUR = ${push ?? 'ontbreekt'}, zonder bewijs van het ontbrekende secret`);
}

/** Assets tegen de vorige release, `latest.json` van deze tag en de body (referentie.md, Uitlevering). */
function controleerAssets(ctx, { tag, versie, release }) {
  const fout = reden => { throw new ReleaseStop('uitlevering', `${tag}: ${reden}`); };
  const stabiel = api(ctx, `repos/${ctx.repo}/releases?per_page=30`).filter(r => gepubliceerd(r) && STABIELE_TAG.test(r.tag_name));
  const vorige = stabiel.filter(r => vergelijk(r.tag_name, tag) < 0).sort((a, b) => vergelijk(b.tag_name, a.tag_name))[0];
  const nieuwste = !stabiel.some(r => vergelijk(r.tag_name, tag) > 0);
  if (vorige) {
    const norm = (naam, v) => naam.split(v).join('<versie>');
    const nu = new Set(release.assets.map(a => norm(a.name, versie)));
    const mist = vorige.assets.map(a => norm(a.name, vorige.tag_name.slice(1))).filter(n => !nu.has(n));
    if (mist.length) fout(`assets ontbreken tegenover ${vorige.tag_name}: ${mist.join(', ')}`);
  }
  if (!release.assets.some(a => a.name === `open-planner-studio-${versie}.mcpb`)) fout('de .mcpb-bundel ontbreekt');
  if (!/### Downloads/.test(release.body ?? '')) fout('de releasebody mist het Downloads-blok');
  const latest = JSON.parse(ctx.gh(['release', 'download', tag, '--repo', ctx.repo, '-p', 'latest.json', '-O', '-']));
  if (latest.version !== versie && latest.version !== tag) fout(`latest.json noemt versie ${latest.version}`);
  if (!String(latest.notes ?? '').trim()) fout('latest.json heeft lege notes');
  const platforms = Object.keys(latest.platforms ?? {});
  for (const os of ['linux', 'windows', 'darwin']) if (!platforms.some(k => k.startsWith(`${os}-`))) fout(`latest.json mist ${os}`);
  const urls = [...new Set(Object.values(latest.platforms).map(p => p.url))];
  for (const url of urls) {
    const status = ctx.httpStatus(url);
    if (status !== 200) fout(`${url} gaf HTTP ${status}`);
  }
  // Het publieke updater-adres wijst naar de nieuwste release; de CDN kan even achterlopen.
  if (nieuwste) {
    const publiek = `https://github.com/${ctx.repo}/releases/latest/download/latest.json`;
    const ok = wachtOfNull(ctx, 'publieke latest.json', () => (ctx.httpJson(publiek)?.version === versie ? true : undefined), { intervalMs: MINUUT, maxMs: 15 * MINUUT });
    if (!ok) fout(`${publiek} noemt na 15 minuten nog niet ${versie}`);
  }
  return `Uitlevering: ${release.assets.length} assets, latest.json ${versie} voor ${platforms.length} platforms, ${urls.length} downloads (HTTP 200), body met Downloads${nieuwste ? ', publieke updater actueel' : ''}.`;
}

/** Wiki: af als de Changelog-pagina de sectie van deze versie heeft; anders publiceren vanaf de tag. */
function wiki(ctx, { tag, sha, versie }) {
  const changelog = 'https://raw.githubusercontent.com/wiki/OpenAEC-Foundation/open-planner-studio/Changelog.md';
  const heeftVersie = () => (ctx.httpText(changelog) ?? '').split('\n').some(r => r.startsWith(`## v${versie} `));
  if (heeftVersie()) return `Wiki: de Changelog-pagina heeft ${tag}.`;
  const pad = werkplek(ctx, 'release-wiki', { ref: sha });
  npmCi(ctx, pad);
  const proef = moet(ctx, 'wiki', 'npm', ['run', 'publish:wiki'], { cwd: pad });
  if (/warning\(s\):/.test(proef)) throw new ReleaseStop('wiki', `de proefgeneratie van de wiki geeft waarschuwingen: ${proef.split('warning(s):')[1].trim().split('\n').slice(0, 5).join(' | ')}`);
  moet(ctx, 'wiki', 'node', ['scripts/run-ts.mjs', 'scripts/check-wiki-links.ts'], { cwd: pad });
  ctx.act(`wiki publiceren vanaf ${tag}`, () => moet(ctx, 'wiki', 'npm', ['run', 'publish:wiki', '--', '--push'], { cwd: pad }));
  wacht(ctx, `wiki-Changelog toont ${tag}`, () => (heeftVersie() ? true : undefined), { intervalMs: MINUUT, maxMs: 30 * MINUUT });
  if (ctx.httpStatus('https://github.com/OpenAEC-Foundation/open-planner-studio/wiki') !== 200) throw new ReleaseStop('wiki', 'de wiki-Home geeft geen HTTP 200');
  const commit = ctx.git(['ls-remote', 'https://github.com/OpenAEC-Foundation/open-planner-studio.wiki.git', 'HEAD']).split('\t')[0];
  return `Wiki: gepubliceerd vanaf ${tag} (${sha.slice(0, 12)}), wiki-commit \`${commit}\`; Home live.`;
}

// ---------------------------------------------------------------------------------------------------
// Website (referentie.md, Website). Een fout hier stopt de release nooit; hij komt in het verslag.

function websiteBestand(ctx, pad, ref = 'main') {
  return ctx.gh(['api', `repos/${WEBSITE}/contents/${pad}?ref=${ref}`, '-H', 'Accept: application/vnd.github.raw+json']);
}

/** De versie in `whatsnew.label` van het Engelse woordenboek op `ref`. */
function websiteVersie(ctx, ref) {
  const label = JSON.parse(websiteBestand(ctx, 'shared/translations/open-planner-studio.json', ref)).whatsnew?.label ?? '';
  return label.match(/v(\d{4}\.\d{1,2}\.\d+)/)?.[1] ?? null;
}

/** Af = website-main noemt deze versie (of nieuwer), de laatste deploy is groen op die inhoud, en hij staat live. */
function websiteAf(ctx, versie) {
  const opMain = websiteVersie(ctx, 'main');
  if (!opMain || vergelijk(opMain, versie) < 0) return null;
  const deploy = runs(ctx, 'deploy.yml', { branch: 'main' }, WEBSITE).find(r => r.status === 'completed' && ['push', 'workflow_dispatch'].includes(r.event));
  if (deploy?.conclusion !== 'success') return null;
  const gedeployd = websiteVersie(ctx, deploy.head_sha);
  if (!gedeployd || vergelijk(gedeployd, versie) < 0) return null;
  const live = ctx.httpText('https://open-aec.com/open-planner-studio/') ?? '';
  if (!live.includes(`v${gedeployd}`)) return null;
  return `Website: v${gedeployd} staat op main, [deploy ${deploy.id}](${deploy.html_url}) groen op \`${deploy.head_sha.slice(0, 12)}\`, live.`;
}

export function website(ctx, { tag, versie }) {
  try {
    const af = websiteAf(ctx, versie);
    if (af) return { regel: af, open: false };
    const branch = `release/open-planner-studio-${tag}`;
    let pr = ctx.ghJson(['pr', 'list', '--repo', WEBSITE, '--head', branch, '--state', 'all', '--json', 'number,state,mergeCommit,url'])[0];
    if (!pr || pr.state === 'CLOSED') {
      if (pr?.state === 'CLOSED') return { regel: `Website: PR ${pr.url} is gesloten zonder merge; volgende maandag opnieuw.`, open: true };
      pr = websitePr(ctx, { tag, versie, branch });
    }
    if (pr.state !== 'MERGED') {
      ctx.act(`website-PR ${pr.url} mergen`, () => ctx.gh(['pr', 'merge', String(pr.number), '--repo', WEBSITE, '--merge', '--admin']));
      pr = ctx.ghJson(['pr', 'view', String(pr.number), '--repo', WEBSITE, '--json', 'number,state,mergeCommit,url']);
    }
    const merge = pr.mergeCommit?.oid;
    if (!merge) return { regel: `Website: PR ${pr.url} heeft geen merge-commit.`, open: true };
    const deployNa = () => runs(ctx, 'deploy.yml', { branch: 'main' }, WEBSITE)
      .find(r => ['push', 'workflow_dispatch'].includes(r.event) && websiteAfstammeling(ctx, merge, r.head_sha));
    let deploy = wacht(ctx, 'website-deploy start', () => deployNa() ?? undefined, { maxMs: 20 * MINUUT });
    deploy = wacht(ctx, `website-deploy ${deploy.id}`, () => {
      const nu = api(ctx, `repos/${WEBSITE}/actions/runs/${deploy.id}`);
      return nu.status === 'completed' ? nu : undefined;
    }, { maxMs: UUR });
    if (deploy.conclusion !== 'success') {
      const dispatch = runs(ctx, 'deploy.yml', { branch: 'main', event: 'workflow_dispatch' }, WEBSITE)
        .find(r => Date.parse(r.created_at) > Date.parse(deploy.created_at));
      if (!dispatch) ctx.act('website deploy.yml eenmaal opnieuw starten', () => ctx.gh(['workflow', 'run', 'deploy.yml', '--repo', WEBSITE]));
      return { regel: `Website: deploy ${deploy.id} is ${deploy.conclusion}; een nieuwe deploy is gestart en wordt bij de volgende run gecontroleerd.`, open: true };
    }
    const nu = websiteAf(ctx, versie);
    return nu ? { regel: `${nu} PR ${pr.url}.`, open: false } : { regel: `Website: deploy groen, maar ${tag} staat nog niet live.`, open: true };
  } catch (err) {
    if ((err instanceof ReleaseStop && err.code === 'weekendstop') || err instanceof DroogStop) throw err;
    return { regel: `Website open: ${err instanceof ReleaseStop ? `${err.code}: ${err.reden}` : err.message}`, open: true };
  }
}

function websiteAfstammeling(ctx, voorouder, sha) {
  if (voorouder === sha) return true;
  try {
    const vergelijking = api(ctx, `repos/${WEBSITE}/compare/${voorouder}...${sha}`);
    return vergelijking.status === 'ahead' || vergelijking.status === 'identical';
  } catch { return false; }
}

const RN_BLOK = /<!-- rn:start[\s\S]*?<!-- rn:end -->/g;
const WHATSNEW = /<section\b[^>]*\bid="whats-new"[^>]*>[\s\S]*?<\/section>/g;
const WEBSITE_PAGINAS = ['open-planner-studio/index.html', ...['en', 'fr', 'tr', 'es'].map(t => `${t}/open-planner-studio/index.html`)];
const WEBSITE_DATA = ['data/release-notes/open-planner-studio.json', 'data/release-highlights/open-planner-studio.json'];

/** Vervangt precies één blok; anders een fout (de website veranderde van vorm). */
export function vervangBlok(doel, bron, patroon, wat) {
  const inDoel = doel.match(patroon) ?? [];
  const inBron = bron.match(patroon) ?? [];
  if (inDoel.length !== 1 || inBron.length !== 1) throw new Error(`${wat}: verwacht precies één blok (doel ${inDoel.length}, bron ${inBron.length})`);
  return doel.replace(inDoel[0], () => inBron[0]);
}

function websitePr(ctx, { tag, versie, branch }) {
  const highlights = ctx.httpJson('https://open-planner-studio.open-aec.com/release-highlights.json');
  if (!JSON.stringify(highlights ?? {}).includes(versie)) throw new Error(`de live release-highlights.json noemt ${versie} nog niet`);
  // Twee tijdelijke mappen naast de releasewerkplekken: de websitebranch en een kopie voor de generatoren.
  const kloon = join(ctx.root, '.claude/worktrees/release-website');
  const kopie = join(ctx.root, '.claude/worktrees/release-website-generatie');
  ctx.act(`website klonen en branch ${branch} maken`, () => {
    ctx.fs.rm(kloon); ctx.fs.rm(kopie);
    ctx.git(['clone', '--quiet', `https://github.com/${WEBSITE}.git`, kloon]);
    ctx.git(['switch', '--quiet', '-c', branch], { cwd: kloon });
  });
  // 1. De tekst: #whats-new in het Nederlands en de vier woordenboeken (agent).
  const antwoord = ctx.claude(websiteOpdracht({ tag, versie }), { cwd: kloon, ...WEBSITE_TOOLS });
  if (!antwoord.ok) throw new Error(`websitetekst: ${antwoord.fout}`);
  buitenGrenzen(ctx, kloon, WEBSITE_TEKST_PADEN, 'websitetekst');
  // 2. Generatoren in een aparte kopie; daarna alleen de twee blokken en de twee databestanden overnemen.
  ctx.act('websitegeneratoren draaien in een tijdelijke kopie', () => {
    ctx.fs.copyDir(kloon, kopie);
    ctx.fs.write(join(kopie, 'package.json'), '{"type":"commonjs"}\n');
    for (const script of ['generate-release-notes.js', 'generate-release-highlights.js', 'build-i18n-pages.js', 'build-release-notes-static.js']) {
      moet(ctx, 'werkplek', 'node', [`scripts/${script}`], { cwd: kopie });
    }
  });
  for (const pagina of WEBSITE_PAGINAS) {
    let doel = ctx.fs.read(join(kloon, pagina));
    const bron = ctx.fs.read(join(kopie, pagina));
    doel = vervangBlok(doel, bron, RN_BLOK, `${pagina} rn-blok`);
    if (pagina !== 'open-planner-studio/index.html') doel = vervangBlok(doel, bron, WHATSNEW, `${pagina} #whats-new`);
    ctx.fs.write(join(kloon, pagina), doel);
  }
  for (const data of WEBSITE_DATA) ctx.fs.write(join(kloon, data), ctx.fs.read(join(kopie, data)));
  const notes = JSON.parse(ctx.fs.read(join(kloon, WEBSITE_DATA[0])));
  if (notes.latestStable?.tag !== tag) throw new Error(`latestStable.tag is ${notes.latestStable?.tag}, verwacht ${tag}`);
  if (!ctx.fs.read(join(kloon, WEBSITE_DATA[1])).includes(versie)) throw new Error(`de highlightsdata noemt ${versie} niet`);
  const toegestaan = [...WEBSITE_TEKST_PADEN, ...WEBSITE_PAGINAS, ...WEBSITE_DATA];
  const gewijzigd = buitenGrenzen(ctx, kloon, toegestaan, 'website');
  ctx.act(`website-PR voor ${tag} maken`, () => {
    ctx.git(['add', '--', ...gewijzigd], { cwd: kloon });
    ctx.git(['commit', '--quiet', '-m', `Open Planner Studio ${tag}: wat is er nieuw en de releasetijdlijn`], { cwd: kloon });
    ctx.git(['push', '--quiet', '-u', 'origin', `${branch}:${branch}`], { cwd: kloon });
    ctx.gh(['pr', 'create', '--repo', WEBSITE, '--base', 'main', '--head', branch, '--title', `Open Planner Studio ${tag}`,
      '--body', `Het blok \`#whats-new\` en de releasetijdlijn voor ${tag}, met de vier woordenboeken en de twee Planner-databestanden.\n\nGemaakt door het releasescript van Open Planner Studio, gestart door een AI-assistent.`]);
  });
  return ctx.ghJson(['pr', 'view', branch, '--repo', WEBSITE, '--json', 'number,state,mergeCommit,url']);
}

/**
 * De gewijzigde paden in een werkplek (ook nieuw en verwijderd; bij een hernoeming beide namen). Porcelain v2 met
 * NUL-scheiding: geen betekenisvolle spatie vooraan, geen aanhalingstekens rond vreemde namen.
 */
export function gewijzigdePaden(ctx, pad) {
  const delen = ctx.git(['status', '--porcelain=v2', '-z', '--untracked-files=all'], { cwd: pad }).split('\0');
  const paden = [];
  for (let i = 0; i < delen.length; i++) {
    const regel = delen[i];
    if (!regel) continue;
    const velden = regel.split(' ');
    if (regel.startsWith('1 ')) paden.push(velden.slice(8).join(' '));
    else if (regel.startsWith('2 ')) paden.push(velden.slice(9).join(' '), delen[++i]);
    else if (regel.startsWith('u ')) paden.push(velden.slice(10).join(' '));
    else if (regel.startsWith('? ')) paden.push(regel.slice(2));
    else if (!regel.startsWith('! ')) throw new Error(`onbekende statusregel: ${regel}`);
  }
  return paden;
}

/** De gewijzigde paden; een pad buiten `toegestaan` is een fout. */
function buitenGrenzen(ctx, pad, toegestaan, wat) {
  const paden = gewijzigdePaden(ctx, pad);
  const mag = p => toegestaan.some(t => (t.endsWith('/') ? p.startsWith(t) : p === t));
  const fout = paden.filter(p => !mag(p));
  if (fout.length) {
    if (wat === 'tekst') throw new ReleaseStop('tekst-grens', `de tekstagent schreef buiten zijn bestanden: ${fout.join(', ')}`);
    throw new Error(`${wat}: wijzigingen buiten de grens: ${fout.join(', ')}`);
  }
  return paden;
}

// ---------------------------------------------------------------------------------------------------
// Kandidaatselectie (referentie.md, Kandidaatselectie)

export function kiesKandidaat(ctx, { prev, tags }) {
  const getagd = new Set(tags.map(t => t.tag));
  const mainVersie = JSON.parse(ctx.git(['show', 'origin/main:package.json'])).version;
  const prs = ctx.ghJson(['pr', 'list', '--repo', ctx.repo, '--base', 'main', '--state', 'open', '--limit', '1000',
    '--json', 'number,title,headRefName,headRefOid,url']).filter(pr => /^Release v\d+\.\d+\.\d+$/.test(pr.title));
  if (prs.length > 1) throw new ReleaseStop('kandidaat', `meerdere open release-PR's: ${prs.map(p => p.url).join(', ')}`);
  const kandidaten = getagd.has(`v${mainVersie}`) ? [] : [{ mode: 'main', versie: mainVersie }];
  for (const pr of prs) {
    const versie = JSON.parse(ctx.gh(['api', `repos/${ctx.repo}/contents/package.json?ref=${pr.headRefOid}`, '-H', 'Accept: application/vnd.github.raw+json'])).version;
    if (pr.title !== `Release v${versie}`) throw new ReleaseStop('kandidaat', `${pr.url}: titel en pakketversie ${versie} verschillen`);
    if (getagd.has(`v${versie}`)) throw new ReleaseStop('kandidaat', `${pr.url}: versie ${versie} is al getagd`);
    kandidaten.push({ mode: 'pr', versie, pr });
  }
  for (const { versie } of kandidaten) {
    if (vergelijk(versie, prev) <= 0) throw new ReleaseStop('kandidaat', `kandidaat ${versie} is niet hoger dan ${prev}`);
  }
  if (new Set(kandidaten.map(k => k.versie)).size > 1) throw new ReleaseStop('kandidaat', `kandidaatversies botsen: ${kandidaten.map(k => k.versie).join(', ')}`);
  return kandidaten.find(k => k.mode === 'pr') ?? kandidaten[0] ?? { mode: 'nieuw' };
}

// ---------------------------------------------------------------------------------------------------
// Releasecijfers (referentie.md, Releasecijfers)

const CIJFER_PADEN = ['src', 'src-tauri', 'scripts', 'tests',
  ':(exclude)docs/**', ':(exclude)public/docs/**', ':(exclude)src/i18n/**', ':(exclude)**/package-lock.json',
  ':(exclude)**/*.lock', ':(exclude)dist/**', ':(exclude)node_modules/**', ':(exclude)vendor/**', ':(exclude)public/examples/**'];
export const HIGHLIGHTS = 'src/services/updater/releaseHighlights.ts';
// Tussen push en squashmerge zit de PR-CI; reken de dagen vanaf het verwachte mergemoment.
const VERWACHTE_MERGE_MS = 30 * MINUUT;

export function meetCijfers(ctx, pad, { prev, base }, mergeOverMs = VERWACHTE_MERGE_MS) {
  const commits = Number(ctx.git(['rev-list', '--count', `${prev}..${base}`], { cwd: pad })) + 1;
  const numstat = ctx.git(['diff', '--numstat', prev, '--', ...CIJFER_PADEN], { cwd: pad });
  const regels = numstat.split('\n').filter(Boolean).reduce((som, r) => som + (r.split('\t')[0] === '-' ? 0 : Number(r.split('\t')[0] || 0)), 0);
  const prevDatum = Date.parse(ctx.git(['log', '-1', '--format=%cI', prev], { cwd: pad }));
  const dagen = Math.max(0, Math.round((ctx.now() + mergeOverMs - prevDatum) / DAG));
  return { daysSincePrevious: dagen, commitsSincePrevious: commits, addedCodeLines: regels };
}

/** Zet de cijfers in het versieblok. Geeft de nieuwe tekst, of een fout als het blok er niet (eenmaal) staat. */
export function zetCijfers(tekst, versie, cijfers) {
  const kop = `'${versie}': {`;
  const begin = tekst.indexOf(kop);
  if (begin < 0 || tekst.indexOf(kop, begin + 1) >= 0) throw new ReleaseStop('tekst-checks', `het highlightblok '${versie}' staat er niet precies één keer`);
  const rest = tekst.slice(begin);
  const m = /stats: \{[^}]*\},/.exec(rest);
  if (!m) throw new ReleaseStop('tekst-checks', `het highlightblok '${versie}' heeft geen stats-regel`);
  const nieuw = `stats: { daysSincePrevious: ${cijfers.daysSincePrevious}, commitsSincePrevious: ${cijfers.commitsSincePrevious}, addedCodeLines: ${cijfers.addedCodeLines} },`;
  return tekst.slice(0, begin) + rest.slice(0, m.index) + nieuw + rest.slice(m.index + m[0].length);
}

// ---------------------------------------------------------------------------------------------------
// De release-inhoud

export function tekstAf(ctx, pad, versie) {
  const notes = ctx.fs.readOrNull(join(pad, `docs/release-notes/v${versie}.md`)) ?? '';
  const changelog = ctx.fs.read(join(pad, 'docs/CHANGELOG.md'));
  const highlights = ctx.fs.read(join(pad, HIGHLIGHTS));
  return notes.trim() !== '' && changelog.includes(`## v${versie} — `) && highlights.includes(`'${versie}': {`);
}

/** De lokale controles op de teksten. Geeft de fouten terug (leeg = goed). */
export function tekstControles(ctx, pad, versie) {
  const fouten = [];
  const probeer = (wat, cmd, args, extra = () => null) => {
    const res = ctx.run(cmd, args, { cwd: pad });
    const uit = `${res.stdout}\n${res.stderr}`;
    const fout = res.status !== 0 ? `exit ${res.status}` : extra(uit);
    if (fout) fouten.push(`${wat}: ${fout}\n${uit.trim().split('\n').slice(-25).join('\n')}`);
    return res;
  };
  for (const vorm of ['body', 'notes']) {
    probeer(`release-notes --format=${vorm}`, 'node', ['scripts/release-notes.mjs', `v${versie}`, `--format=${vorm}`],
      uit => (/::warning::/.test(uit) ? 'valt terug op de generieke tekst' : null));
  }
  // Vóór de merge kloppen de cijfers nog niet met HEAD; alleen die meldingen mogen.
  probeer('verify:release-highlights', 'npm', ['run', 'verify:release-highlights', '--', versie]);
  if (fouten.at(-1)?.startsWith('verify:release-highlights')) {
    const xx = fouten.at(-1).split('\n').filter(r => r.startsWith('XX '));
    if (xx.length && xx.every(r => /komt niet overeen met Git-meting/.test(r))) fouten.pop();
  }
  probeer('gen:release-highlights-json', 'npm', ['run', 'gen:release-highlights-json']);
  probeer('verify:release-highlights-json', 'npm', ['run', 'verify:release-highlights-json']);
  probeer('verify:docs', 'npm', ['run', 'verify:docs']);
  probeer('publish:wiki (proef)', 'npm', ['run', 'publish:wiki'], uit => (/warning\(s\):/.test(uit) ? 'waarschuwingen in de proefgeneratie' : null));
  probeer('check-wiki-links', 'node', ['scripts/run-ts.mjs', 'scripts/check-wiki-links.ts']);
  return fouten;
}

/** Notes, changelog, highlights en de documentatiecontrole, via één tekstagent; de checks draait het script. */
export function teksten(ctx, pad, info) {
  const { versie } = info;
  if (!tekstAf(ctx, pad, versie)) {
    const commits = ctx.git(['log', '--oneline', '--no-decorate', `${info.prev}..${info.base}`], { cwd: pad });
    const antwoord = ctx.claude(tekstOpdracht({ ...info, commits }), { cwd: pad, ...TEKST_TOOLS });
    if (!antwoord.ok) throw new ReleaseStop('tekst-agent', antwoord.fout);
    info.tekstAntwoord = antwoord.result;
  }
  buitenGrenzen(ctx, pad, TEKST_PADEN(versie), 'tekst');
  if (!tekstAf(ctx, pad, versie)) throw new ReleaseStop('tekst-agent', 'notes, changelogsectie of highlightblok ontbreekt nog na de tekstagent');
  vulCijfers(ctx, pad, info);
  let fouten = tekstControles(ctx, pad, versie);
  if (fouten.length) {
    const antwoord = ctx.claude(herstelOpdracht({ versie, fouten }), { cwd: pad, ...TEKST_TOOLS });
    if (!antwoord.ok) throw new ReleaseStop('tekst-agent', antwoord.fout);
    buitenGrenzen(ctx, pad, TEKST_PADEN(versie), 'tekst');
    vulCijfers(ctx, pad, info);
    fouten = tekstControles(ctx, pad, versie);
    if (fouten.length) throw new ReleaseStop('tekst-checks', fouten.map(f => f.split('\n')[0]).join('; '));
  }
  commitAlles(ctx, pad, `Release v${versie}: teksten en documentatie`);
}

/** Meet de cijfers en zet ze in het blok; genereert de JSON opnieuw als er iets veranderde. */
export function vulCijfers(ctx, pad, { versie, prev, base }) {
  const cijfers = meetCijfers(ctx, pad, { prev, base });
  const oud = ctx.fs.read(join(pad, HIGHLIGHTS));
  const nieuw = zetCijfers(oud, versie, cijfers);
  if (nieuw === oud) return false;
  ctx.act(`releasecijfers ${JSON.stringify(cijfers)} invullen`, () => {
    ctx.fs.write(join(pad, HIGHLIGHTS), nieuw);
    moet(ctx, 'tekst-checks', 'npm', ['run', 'gen:release-highlights-json'], { cwd: pad });
  });
  return true;
}

/** Commit alle wijzigingen (al binnen de grenzen gecontroleerd), na een blik op `git status -sb`. */
function commitAlles(ctx, pad, bericht) {
  const paden = gewijzigdePaden(ctx, pad);
  if (paden.length === 0) return false;
  ctx.log(ctx.git(['status', '-sb'], { cwd: pad }));
  ctx.act(`commit "${bericht}"`, () => {
    ctx.git(['add', '--', ...paden], { cwd: pad });
    ctx.git(['commit', '--quiet', '-m', `${bericht}\n\nGemaakt door het releasescript, gestart door een AI-assistent.`], { cwd: pad });
  });
  return true;
}

// ---------------------------------------------------------------------------------------------------
// De hele release

export function release(ctx) {
  const regels = [];
  controleerOrigin(ctx);
  haal(ctx);

  // Eerst: browsertests.
  wachtOpReparatie(ctx);
  ciCheck(ctx, ctx.git(['rev-parse', 'origin/main']), { alleenBrowser: true });

  // De vorige tag afronden (zonder website: die komt aan het eind, zie onder).
  const tags = originTags(ctx);
  if (tags.length === 0) throw new ReleaseStop('geen-tag', 'er is geen stabiele origin-tag');
  const vorige = tags[0];
  const prev = vorige.tag;
  const afgeschreven = isAfgeschreven(ctx, prev);
  if (afgeschreven) {
    regels.push(`${prev} is afgeschreven; de opvolger neemt zijn tekst over.`);
  } else {
    const vorigeRegels = [];
    const acties = ctx.acties;
    const meldingen = ctx.meldingen.length;
    const pr = releasePr(ctx, prev)[0];
    const fout = probeer(() => lever(ctx, vorige, vorigeRegels));
    // Alleen bijwerken als het script voor deze tag iets deed of iets niet af vond.
    verslagNa(ctx, fout, () => {
      if (pr && (ctx.acties !== acties || ctx.meldingen.length !== meldingen || fout)) {
        schrijfVerslag(ctx, { nummer: pr.number, tag: prev, kop: fout ? `uitlevering niet af: ${stopTekst(fout)}` : 'uitgeleverd (zonder website)', regels: vorigeRegels });
      }
    });
    regels.push(...vorigeRegels.map(r => `${prev}: ${r}`));
  }

  // De nachtvertaling moet klaar zijn vóór de werkplek.
  wachtOpNacht(ctx, regels);
  haal(ctx);

  const kandidaat = kiesKandidaat(ctx, { prev, tags });
  const base = ctx.git(['rev-parse', 'origin/main']);
  if (!ctx.gitOk(['merge-base', '--is-ancestor', vorige.sha, base])) throw new ReleaseStop('kandidaat', `${prev} is geen voorouder van origin/main`);
  if (kandidaat.mode === 'nieuw' && Number(ctx.git(['rev-list', '--count', `${prev}..${base}`])) === 0) {
    // Geen nieuwe release: de website van de vorige tag nog eens proberen.
    const site = afgeschreven ? null : website(ctx, { tag: prev, versie: prev.slice(1) });
    return `niets veranderd sinds ${prev}${site?.open ? `; website open: ${site.regel}` : ''}${meldingTekst(ctx)}`;
  }
  groeneMain(ctx, base);

  let versie;
  let nummer;
  if (kandidaat.mode === 'main') {
    versie = kandidaat.versie;
    nummer = releasePr(ctx, `v${versie}`)[0]?.number;
    if (!nummer) throw new ReleaseStop('inhoud-ontbreekt', `v${versie} staat ongetagd op main zonder gemergde PR "Release v${versie}"`);
  } else {
    ({ versie, nummer } = releasePrKlaarmaken(ctx, { kandidaat, prev, base, afgeschreven: afgeschreven ? prev : null }));
  }
  const tag = `v${versie}`;
  const sha = tagKlaar(ctx, { versie, prev, nummer, regels });

  ctx.act(`tag ${tag} op ${sha} pushen`, () => {
    ctx.git(['tag', '-a', tag, sha, '-m', `Open Planner Studio ${tag}`]);
    ctx.git(['push', 'origin', `refs/tags/${tag}`]);
  });
  const leverRegels = [`Tag ${tag} op \`${sha}\`.`];
  const fout = probeer(() => lever(ctx, { tag, sha }, leverRegels));
  verslagNa(ctx, fout, () => schrijfVerslag(ctx, { nummer, tag, kop: fout ? `getagd; uitlevering stopte: ${stopTekst(fout)}` : 'getagd en uitgeleverd', regels: leverRegels }));
  // De website van de nieuwe tag dekt ook een open website van de vorige (nieuwste versie en hele tijdlijn).
  const site = website(ctx, { tag, versie });
  leverRegels.push(site.regel);
  schrijfVerslag(ctx, { nummer, tag, kop: site.open ? 'uitgebracht; website nog open (volgende maandag opnieuw)' : 'uitgebracht', regels: leverRegels });
  return `${tag} uitgebracht op ${sha}${site.open ? '; website nog open' : ''}${meldingTekst(ctx)}`;
}

const meldingTekst = ctx => (ctx.meldingen.length ? `; meldingen: ${ctx.meldingen.join(', ')}` : '');

function probeer(fn) {
  try { fn(); return null; } catch (err) { return err; }
}

const stopTekst = err => (err instanceof ReleaseStop ? `${err.code}: ${err.reden}` : err.message);

/** Schrijft het verslag; na een fout gaat die fout altijd voor (ook in de droogloop). */
function verslagNa(ctx, fout, schrijf) {
  if (!fout) return schrijf();
  try { schrijf(); } catch (err) { if (!(err instanceof DroogStop)) ctx.log(`verslag niet bijgewerkt: ${err.message}`); }
  throw fout;
}

/** Ophalen schrijft alleen lokale refs; ook de droogloop doet het. */
function haal(ctx) {
  ctx.git(['fetch', '--quiet', '--prune', '--tags', 'origin']);
}

/** Groene `ci.yml`-pushrun op precies deze main-SHA; rood eenmaal rerun. */
function groeneMain(ctx, sha) {
  const zoek = () => runs(ctx, 'ci.yml', { head_sha: sha, event: 'push', branch: 'main' })
    .find(r => r.head_sha === sha && r.event === 'push' && r.head_branch === 'main') ?? null;
  const run = volgRun(ctx, { label: `main-CI op ${sha.slice(0, 12)}`, stopcode: 'main-ci-rood', zoek });
  if (!run) throw new ReleaseStop('main-ci-ontbreekt', `geen ci.yml-pushrun op main voor ${sha}`);
}

/** Werkplek, bump, teksten, vertaalcontrole, cijfers, PR, groene PR-CI en squashmerge. */
function releasePrKlaarmaken(ctx, { kandidaat, prev, base, afgeschreven }) {
  let pad;
  if (kandidaat.mode === 'pr') {
    pad = werkplek(ctx, 'release-werk', { branch: kandidaat.pr.headRefName, ref: `origin/${kandidaat.pr.headRefName}` });
    // Bijwerken: de remote branch erin (fast-forward), daarna main.
    ctx.act(`werkplek bijwerken met origin/${kandidaat.pr.headRefName} en origin/main`, () => {
      if (!ctx.gitOk(['merge', '--ff-only', '--quiet', `origin/${kandidaat.pr.headRefName}`], { cwd: pad })
        && !ctx.gitOk(['merge-base', '--is-ancestor', `origin/${kandidaat.pr.headRefName}`, 'HEAD'], { cwd: pad })) {
        throw new ReleaseStop('werkplek', `${pad} en origin/${kandidaat.pr.headRefName} zijn uiteengelopen`);
      }
      if (!ctx.gitOk(['merge-base', '--is-ancestor', base, 'HEAD'], { cwd: pad })
        && !ctx.gitOk(['merge', '--no-edit', '--quiet', base], { cwd: pad })) {
        throw new ReleaseStop('merge-conflict', `origin/main in ${kandidaat.pr.headRefName} mergen gaf een conflict; los het op in ${pad} en start opnieuw`);
      }
    });
  } else {
    pad = werkplek(ctx, 'release-werk', { ref: base, nieuweBranch: true });
    let huidig = ctx.git(['branch', '--show-current'], { cwd: pad });
    const oud = /^release\/v(\d+\.\d+\.\d+)$/.exec(huidig);
    if (huidig && !oud) throw new ReleaseStop('werkplek', `${pad} staat op ${huidig}`);
    // Een branch van een al getagde versie is oud werk van een vorige week: begin opnieuw vanaf main.
    if (oud && vergelijk(oud[1], prev) <= 0) huidig = '';
    if (!huidig) {
      ctx.act(`werkplek naar ${base}`, () => ctx.git(['switch', '--quiet', '--detach', base], { cwd: pad }));
    } else if (!ctx.gitOk(['merge-base', '--is-ancestor', base, 'HEAD'], { cwd: pad })) {
      ctx.act(`origin/main mergen in ${huidig}`, () => {
        if (!ctx.gitOk(['merge', '--no-edit', '--quiet', base], { cwd: pad })) throw new ReleaseStop('merge-conflict', `origin/main in ${huidig} mergen gaf een conflict; los het op in ${pad}`);
      });
    }
  }
  npmCi(ctx, pad);
  if (kandidaat.mode === 'nieuw' && !ctx.git(['branch', '--show-current'], { cwd: pad })) {
    ctx.act('npm run bump', () => moet(ctx, 'werkplek', 'npm', ['run', 'bump'], { cwd: pad }));
  }
  const versie = JSON.parse(ctx.fs.read(join(pad, 'package.json'))).version;
  if (vergelijk(versie, prev) <= 0) throw new ReleaseStop('kandidaat', `versie ${versie} in de werkplek is niet hoger dan ${prev}`);
  if (kandidaat.mode !== 'nieuw' && versie !== kandidaat.versie) throw new ReleaseStop('kandidaat', `de werkplek heeft ${versie}, de kandidaat is ${kandidaat.versie}`);
  const branch = `release/v${versie}`;
  if (!ctx.git(['branch', '--show-current'], { cwd: pad })) {
    ctx.act(`branch ${branch}`, () => ctx.git(['switch', '--quiet', '-c', branch], { cwd: pad }));
    commitAlles(ctx, pad, `Release v${versie}: versie`);
  }
  const info = { versie, prev, base, afgeschreven, pad };
  teksten(ctx, pad, info);

  // Vertalingen: de nacht deed wat af was; de release maakt de rest af (update-ui-lang), door de thread.
  const vertaling = ctx.run('npm', ['run', 'verify:translations'], { cwd: pad });
  const prBranch = ctx.git(['branch', '--show-current'], { cwd: pad });
  pushEnPr(ctx, { pad, branch: prBranch, versie, info });
  if (vertaling.status !== 0) {
    throw new ReleaseTaak('vertalen', `verify:translations is rood in ${pad} (branch ${prBranch}); volg update-ui-lang daar, commit en start het script opnieuw`);
  }

  // Cijfers, PR-CI en squashmerge; schuift main op, dan main erin en opnieuw.
  for (let ronde = 1; ; ronde++) {
    if (ronde > 4) throw new ReleaseStop('main-beweegt', 'origin/main schoof vier keer op tijdens de PR-CI');
    haal(ctx);
    const nuBase = ctx.git(['rev-parse', 'origin/main']);
    if (!ctx.gitOk(['merge-base', '--is-ancestor', nuBase, 'HEAD'], { cwd: pad })) {
      ctx.act('origin/main mergen in de releasebranch', () => {
        if (!ctx.gitOk(['merge', '--no-edit', '--quiet', nuBase], { cwd: pad })) throw new ReleaseStop('merge-conflict', `origin/main mergen gaf een conflict in ${pad}`);
      });
    }
    if (vulCijfers(ctx, pad, { versie, prev, base: nuBase })) commitAlles(ctx, pad, `Release v${versie}: releasecijfers`);
    const { nummer } = pushEnPr(ctx, { pad, branch: prBranch, versie, info });
    const head = ctx.git(['rev-parse', 'HEAD'], { cwd: pad });
    wachtOpChecks(ctx, { sha: head, event: 'pull_request', label: `PR-CI op ${head.slice(0, 12)}`, stopcode: 'pr-ci-rood' });
    haal(ctx);
    if (ctx.git(['rev-parse', 'origin/main']) !== nuBase) continue;
    if (vergelijkCijfers(ctx, pad, { versie, prev, base: nuBase })) continue;
    schrijfVerslag(ctx, { nummer, tag: `v${versie}`, kop: 'PR groen; squashmerge', regels: [`PR-head \`${head}\` groen.`, `Basis \`${nuBase}\`.`, ...(info.tekstAntwoord ? [`Tekstagent: ${info.tekstAntwoord}`] : [])] });
    ctx.act(`PR #${nummer} squashmergen op ${head}`, () =>
      ctx.gh(['pr', 'merge', String(nummer), '--repo', ctx.repo, '--squash', '--admin', '--match-head-commit', head]));
    return { versie, nummer };
  }
}

/** Waar: de cijfers wijken af van een nieuwe meting (de dag sprong om); dan opnieuw. */
function vergelijkCijfers(ctx, pad, info) {
  const nu = meetCijfers(ctx, pad, info, 2 * MINUUT); // de merge volgt meteen
  const tekst = ctx.fs.read(join(pad, HIGHLIGHTS));
  return zetCijfers(tekst, info.versie, nu) !== tekst;
}

/** Push (fast-forward) en zorg voor één PR `Release vX`. */
function pushEnPr(ctx, { pad, branch, versie }) {
  if (branch === 'main' || (!/^release\//.test(branch) && branch !== releaseBranchVanPr(ctx, versie))) throw new ReleaseStop('werkplek', `weiger te pushen naar ${branch || 'een losse HEAD'}`);
  const head = ctx.git(['rev-parse', 'HEAD'], { cwd: pad });
  const remote = ctx.gitOk(['rev-parse', '--verify', '--quiet', `origin/${branch}`], { cwd: pad }) ? ctx.git(['rev-parse', `origin/${branch}`], { cwd: pad }) : null;
  if (remote !== head) ctx.act(`push ${branch}`, () => ctx.git(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], { cwd: pad }));
  let pr = releasePr(ctx, `v${versie}`, 'open')[0];
  if (!pr) {
    ctx.act(`PR "Release v${versie}" maken`, () => ctx.gh(['pr', 'create', '--repo', ctx.repo, '--base', 'main', '--head', branch,
      '--title', `Release v${versie}`, '--body', `De wekelijkse release v${versie}.\n\nGemaakt door het releasescript (\`scripts/release/run.mjs\`), gestart door een AI-assistent. De voortgang staat in de reactie met \`<!-- ops-release:v${versie} -->\`.`]));
    pr = releasePr(ctx, `v${versie}`, 'open')[0];
    if (!pr) throw new ReleaseStop('onverwacht', `de PR "Release v${versie}" is na het maken niet te vinden`);
  }
  return { nummer: pr.number };
}

function releaseBranchVanPr(ctx, versie) {
  return releasePr(ctx, `v${versie}`, 'open')[0]?.headRefName ?? null;
}

/** Groene main op de releasecommit, gate-controle en de lokale poorten. Geeft de te taggen SHA. */
function tagKlaar(ctx, { versie, prev, nummer, regels }) {
  for (let ronde = 1; ; ronde++) {
    if (ronde > 4) throw new ReleaseStop('main-beweegt', 'origin/main schoof vier keer op vóór de tag');
    haal(ctx);
    const sha = ctx.git(['rev-parse', 'origin/main']);
    if (JSON.parse(ctx.git(['show', `${sha}:package.json`])).version !== versie) {
      throw new ReleaseStop('poort', `origin/main heeft niet versie ${versie}`);
    }
    groeneMain(ctx, sha);
    ciCheck(ctx, sha, { alleenBrowser: false });
    const pad = werkplek(ctx, 'release-werk', { ref: sha });
    npmCi(ctx, pad);
    const poort = (wat, cmd, args) => {
      const res = ctx.run(cmd, args, { cwd: pad });
      if (res.status !== 0) {
        const staart = `${res.stdout}\n${res.stderr}`.trim().split('\n').slice(-8).join(' | ');
        throw new ReleaseStop(/highlights -- /.test(args.join(' ')) && /Git-meting/.test(staart) ? 'cijfers' : 'poort', `${wat}: ${staart}`);
      }
    };
    if (vergelijk(versie, prev) <= 0) throw new ReleaseStop('poort', `${versie} is niet hoger dan ${prev}`);
    poort('bump-version --check', 'node', ['scripts/bump-version.js', '--check', versie]);
    if (!(ctx.fs.readOrNull(join(pad, `docs/release-notes/v${versie}.md`)) ?? '').trim()) throw new ReleaseStop('poort', `docs/release-notes/v${versie}.md ontbreekt of is leeg`);
    poort('verify:translations', 'npm', ['run', 'verify:translations']);
    poort('verify:release-highlights', 'npm', ['run', 'verify:release-highlights', '--', versie]);
    poort('verify:release-highlights-json', 'npm', ['run', 'verify:release-highlights-json']);
    haal(ctx);
    if (ctx.git(['rev-parse', 'origin/main']) !== sha) continue;
    regels.push(`Main \`${sha}\`: CI groen, gate-controle groen, poorten groen.`);
    schrijfVerslag(ctx, { nummer, tag: `v${versie}`, kop: 'klaar voor de tag', regels: [`Te taggen main-SHA \`${sha}\`; CI, browserrun en poorten groen.`] });
    return sha;
  }
}
