#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TIME_ZONE = 'Europe/Amsterdam';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BROWSER_JOB = /^verify \(browser (\d+)-(\d+)\)$/;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const localFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', weekday: 'short',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

function localClock(ms) {
  const part = Object.fromEntries(localFormat.formatToParts(ms).map(({ type, value }) => [type, value]));
  return {
    weekday: WEEKDAYS.indexOf(part.weekday),
    clock: Date.UTC(+part.year, +part.month - 1, +part.day, +part.hour, +part.minute, +part.second),
  };
}

export function fridayEvening(now) {
  const { weekday, clock } = localClock(now);
  let target = clock - (clock % DAY_MS) - ((weekday + 2) % 7) * DAY_MS + 22 * HOUR_MS;
  if (target > clock) target -= 7 * DAY_MS;
  return target - (localClock(target).clock - target);
}

const describe = run => `run ${run.id} (${run.event}, ${run.created_at})`;

function runsOf(api, path) {
  const runs = api(path)?.workflow_runs;
  if (!Array.isArray(runs)) throw new Error(`onverwachte uitvoer van gh api ${path}: geen workflow_runs`);
  return runs;
}

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

function firstAttemptJobs(api, repo, run) {
  const path = `repos/${repo}/actions/runs/${run.id}/attempts/1/jobs?per_page=100`;
  const jobs = api(path)?.jobs;
  if (!Array.isArray(jobs)) throw new Error(`onverwachte uitvoer van gh api ${path}: geen jobs`);
  return jobs;
}

export function browserJobs(jobs) {
  return jobs.filter(job => BROWSER_JOB.test(job.name) && job.conclusion !== 'skipped');
}

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

export function checkBrowserRun({ sha, repo, now, api, isAncestor }) {
  const since = fridayEvening(now);
  const sinceIso = new Date(since).toISOString();
  const created = encodeURIComponent(`>=${sinceIso}`);
  const list = event => runsOf(api, `repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=${event}&created=${created}&per_page=100`);
  const runs = [...list('schedule'), ...list('workflow_dispatch')]
    .filter(run => run.head_branch === 'main' && (run.event === 'schedule' || run.event === 'workflow_dispatch'))
    .filter(run => Date.parse(run.created_at) >= since)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of runs) {
    const stop = text => ({ ok: false, text, runId: run.id });
    if (run.status !== 'completed') return stop(`browserrun: ${describe(run)} is niet klaar (status ${run.status})`);
    const jobs = firstAttemptJobs(api, repo, run);
    if (browserJobs(jobs).length === 0) continue;
    const problems = browserJobProblems(jobs);
    if (run.conclusion !== 'success') problems.unshift(`conclusie ${run.conclusion}`);
    if (problems.length) return stop(`laatste browserrun ${describe(run)}: ${problems.join('; ')}`);
    if (!isAncestor(run.head_sha, sha)) {
      return stop(`laatste browserrun ${describe(run)} staat op ${run.head_sha}, geen voorouder van ${sha}`);
    }
    return { ok: true, text: `browserrun ${describe(run)} is groen, op ${run.head_sha}`, runId: run.id };
  }
  return { ok: false, text: `geen browserrun sinds vrijdag ${sinceIso} (gepland of handmatig op main)`, runId: null };
}

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

export function gitIsAncestor(ancestor, commit) {
  const res = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, commit], { encoding: 'utf8' });
  if (res.status === 0) return true;
  if (res.status === 1) return false;
  throw new Error(`git merge-base ${ancestor} ${commit} faalde: ${(res.stderr || res.error?.message || `status ${res.status}`).trim()}`);
}

function main(argv) {
  const browserOnly = argv[0] === '--browser';
  const sha = (browserOnly ? argv[1] : argv[0]) ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    console.log(`::error::release-ci-check: geef een volledige commit-SHA, niet "${sha}"`);
    return 1;
  }
  const repo = process.env.GITHUB_REPOSITORY || 'OpenAEC-Foundation/open-planner-studio';
  const context = { sha, repo, now: Date.now(), api: ghApi, isAncestor: gitIsAncestor };
  const browser = checkBrowserRun(context);
  const results = browserOnly ? [browser] : [checkPushRun(context), browser];
  for (const { ok, text } of results) console.log(ok ? `OK  release-ci-check: ${text}` : `::error::release-ci-check: ${text}`);
  console.log(`BROWSERRUN=${browser.runId ?? ''}`);
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
