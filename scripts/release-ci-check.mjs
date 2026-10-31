#!/usr/bin/env node
// De CI-controle van een release (besluit eigenaar, 2026-10-31): de gate in release.yml test niets
// dubbel, maar kijkt of de CI en de browserrun al groen zijn. De release-skill draait precies dit
// script vóór de tag, zodat de release niet pas ná de onomkeerbare tag vastloopt.
//
//   node scripts/release-ci-check.mjs <commit-sha>
//
// Twee eisen, allebei op GitHub gelezen met `gh api`:
//   1. De `ci.yml`-pushrun op main op precies deze commit is klaar en `success`.
//   2. De laatste browserrun op main (gepland of handmatig) is `success`, staat op deze commit of
//      een voorouder daarvan, en is hoogstens 7 dagen oud. De uitkomst komt uit de browserjobs van
//      poging 1: een rerun maakt een haperende test niet groen, en een run waarin die jobs zijn
//      overgeslagen is geen browserrun.
//
// Exit 0 = beide groen. Anders exit 1 met een `::error::`-regel per probleem. Een andere foutcode,
// lege uitvoer of onverwachte JSON van `gh` of `git` stopt ook: dit script gaat nooit stil door.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MAX_BROWSER_RUN_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const BROWSER_JOB = /^verify \(browser (\d+)-(\d+)\)$/;

/** Een tekst per run, voor in een foutmelding. */
const describe = run => `run ${run.id} (${run.event}, ${run.created_at})`;

/** De runs van ci.yml uit een antwoord van `gh api`; faalt hard op iets anders dan een lijst. */
function runsOf(api, path) {
  const runs = api(path)?.workflow_runs;
  if (!Array.isArray(runs)) throw new Error(`onverwachte uitvoer van gh api ${path}: geen workflow_runs`);
  return runs;
}

/** Eis 1. Geeft `{ ok, text }`. */
export function checkPushRun({ sha, repo, api }) {
  const runs = runsOf(api, `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&branch=main&per_page=100`)
    .filter(run => run.head_sha === sha && run.event === 'push' && run.head_branch === 'main')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const run = runs[0];
  if (!run) return { ok: false, text: `geen ci.yml-pushrun op main gevonden voor ${sha}` };
  if (run.status !== 'completed') return { ok: false, text: `ci.yml-pushrun ${run.id} op ${sha} is niet klaar (status ${run.status})` };
  if (run.conclusion !== 'success') return { ok: false, text: `ci.yml-pushrun ${run.id} op ${sha} is niet groen (conclusie ${run.conclusion})` };
  return { ok: true, text: `ci.yml-pushrun ${run.id} op ${sha} is groen` };
}

/** De jobs van poging 1; poging 1 telt, want een rerun verandert de conclusie van de run. */
function firstAttemptJobs(api, repo, run) {
  const path = `repos/${repo}/actions/runs/${run.id}/attempts/1/jobs?per_page=100`;
  const jobs = api(path)?.jobs;
  if (!Array.isArray(jobs)) throw new Error(`onverwachte uitvoer van gh api ${path}: geen jobs`);
  return jobs;
}

/** De browserjobs die echt draaiden. Een overgeslagen matrixjob heet letterlijk `verify (${{ matrix.name }})`. */
export function browserJobs(jobs) {
  return jobs.filter(job => BROWSER_JOB.test(job.name) && job.conclusion !== 'skipped');
}

/** Problemen met de uitkomst van een browserrun: alle shards 1..n aanwezig en groen, en `test` groen. */
export function browserJobProblems(jobs) {
  const shards = browserJobs(jobs);
  const problems = [];
  const names = shards.map(job => BROWSER_JOB.exec(job.name));
  const totals = new Set(names.map(m => m[2]));
  const numbers = new Set(names.map(m => Number(m[1])));
  const total = Number(names[0][2]);
  const complete = totals.size === 1 && numbers.size === total && [...numbers].every(n => n >= 1 && n <= total);
  if (!complete) problems.push(`shards onvolledig (${shards.map(job => job.name).join(', ')})`);
  const red = shards.filter(job => job.conclusion !== 'success');
  if (red.length) problems.push(`niet groen in poging 1: ${red.map(job => `${job.name} = ${job.conclusion}`).join(', ')}`);
  const final = jobs.find(job => job.name === 'test');
  if (final?.conclusion !== 'success') problems.push(`job test in poging 1 = ${final?.conclusion ?? 'ontbreekt'}`);
  return problems;
}

/** Eis 2. Geeft `{ ok, text }`. `now` is in milliseconden. */
export function checkBrowserRun({ sha, repo, now, api, isAncestor }) {
  const list = event => runsOf(api, `repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=${event}&per_page=100`);
  const runs = [...list('schedule'), ...list('workflow_dispatch')]
    .filter(run => run.head_branch === 'main' && (run.event === 'schedule' || run.event === 'workflow_dispatch'))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of runs) {
    if (run.status !== 'completed') return { ok: false, text: `browserrun: ${describe(run)} is niet klaar (status ${run.status})` };
    const jobs = firstAttemptJobs(api, repo, run);
    if (browserJobs(jobs).length === 0) continue; // Geen browserrun: de browserjobs zijn overgeslagen.
    const problems = browserJobProblems(jobs);
    if (problems.length) return { ok: false, text: `laatste browserrun ${describe(run)}: ${problems.join('; ')}` };
    const age = now - Date.parse(run.created_at);
    if (!(age <= MAX_BROWSER_RUN_AGE_DAYS * DAY_MS)) {
      return { ok: false, text: `laatste browserrun ${describe(run)} is ouder dan ${MAX_BROWSER_RUN_AGE_DAYS} dagen` };
    }
    if (!isAncestor(run.head_sha, sha)) {
      return { ok: false, text: `laatste browserrun ${describe(run)} staat op ${run.head_sha}, geen voorouder van ${sha}` };
    }
    return { ok: true, text: `browserrun ${describe(run)} is groen, op ${run.head_sha}` };
  }
  return { ok: false, text: 'geen browserrun op main gevonden (gepland of handmatig)' };
}

/** `gh api`: elke andere foutcode, lege uitvoer of ongeldige JSON is een harde fout. */
export function ghApi(path) {
  let out;
  try {
    out = execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`gh api ${path} faalde: ${String(err.stderr || err.message).trim()}`);
  }
  if (out.trim() === '') throw new Error(`gh api ${path} gaf lege uitvoer`);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`gh api ${path} gaf geen geldige JSON`);
  }
}

/** Exit 0 = voorouder of dezelfde commit, exit 1 = niet; elke andere uitkomst is een harde fout. */
export function gitIsAncestor(ancestor, commit) {
  const res = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, commit], { encoding: 'utf8' });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git merge-base ${ancestor} ${commit} faalde: ${(res.stderr || res.error?.message || `status ${res.status}`).trim()}`);
}

function main(argv) {
  const sha = argv[0] ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    console.log(`::error::release-ci-check: geef een volledige commit-SHA, niet "${sha}"`);
    return 1;
  }
  const repo = process.env.GITHUB_REPOSITORY || 'OpenAEC-Foundation/open-planner-studio';
  const context = { sha, repo, now: Date.now(), api: ghApi, isAncestor: gitIsAncestor };
  const results = [checkPushRun(context), checkBrowserRun(context)];
  for (const { ok, text } of results) console.log(ok ? `OK  release-ci-check: ${text}` : `::error::release-ci-check: ${text}`);
  return results.every(result => result.ok) ? 0 : 1;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.log(`::error::release-ci-check: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
