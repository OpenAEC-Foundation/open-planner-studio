#!/usr/bin/env node
// Het releasescript van Open Planner Studio: de vaste stappen van de wekelijkse release in vaste volgorde.
//
//   node scripts/release/run.mjs            # de release (de release-thread start dit, zie de release-skill)
//   node scripts/release/run.mjs --droog    # leest alles, stopt vóór de eerste stap die iets schrijft
//
// De laatste regel is altijd één van: RELEASE-KLAAR, RELEASE-STOP <code>, RELEASE-TAAK <code> of RELEASE-DROOG
// (zie uitkomst.mjs). Het script draait vanuit een eigen losse worktree op origin/main (`release-script`);
// de releasebranch staat in de werkplek `release-werk`. Alleen Node-ingebouwde modules: geen npm ci nodig.
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DroogStop, ReleaseStop, slotregel } from './uitkomst.mjs';
import { release } from './stappen.mjs';

const REPO = 'OpenAEC-Foundation/open-planner-studio';
const MODEL = 'claude-opus-5-5';
const BUFFER = 256 * 1024 * 1024;

/** Een fout van een opdracht, met stderr erbij (voor de 404-herkenning). */
class OpdrachtFout extends Error {
  constructor(cmd, args, res) {
    super(`${cmd} ${args.join(' ')} faalde (exit ${res.status}): ${String(res.stderr || res.error?.message || '').trim().slice(0, 500)}`);
    this.stderr = String(res.stderr ?? '');
    this.status = res.status;
  }
}

function draai(cmd, args, { cwd, input, env, timeoutMs } = {}) {
  const res = spawnSync(cmd, args, {
    cwd, input, encoding: 'utf8', maxBuffer: BUFFER, timeout: timeoutMs,
    env: { ...process.env, ...env }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  return { status: res.status ?? (res.error ? 127 : 1), stdout: res.stdout ?? '', stderr: res.stderr ?? (res.error?.message ?? ''), error: res.error };
}

function moetSlagen(cmd, args, opts) {
  const res = draai(cmd, args, opts);
  if (res.status !== 0) throw new OpdrachtFout(cmd, args, res);
  return res.stdout;
}

/** `claude -p` met Opus 5.5 high, beperkte tools, zonder MCP en zonder sessie. */
export function claudeArgs(prompt, { tools, toegestaan }) {
  return ['-p', prompt, '--model', MODEL, '--effort', 'high', '--output-format', 'json', '--no-session-persistence',
    '--permission-mode', 'dontAsk', '--tools', tools.join(','), '--allowedTools', ...toegestaan, '--strict-mcp-config',
    '--max-budget-usd', '40'];
}

function claude(prompt, { cwd, tools, toegestaan }) {
  const res = draai('claude', claudeArgs(prompt, { tools, toegestaan }), { cwd, timeoutMs: 90 * 60_000 });
  let json;
  try { json = JSON.parse(res.stdout); } catch { /* hieronder */ }
  if (res.status !== 0 || !json || json.is_error || json.subtype !== 'success') {
    const reden = json?.result ?? json?.subtype ?? (res.stderr.trim().split('\n').at(-1) || `exit ${res.status}`);
    return { ok: false, fout: `claude -p faalde: ${String(reden).slice(0, 300)}` };
  }
  return { ok: true, result: String(json.result ?? '').trim(), kosten: json.total_cost_usd };
}

function http(url, { method = 'GET' } = {}) {
  // `-I` voor HEAD: met `-X HEAD` wacht curl op een body die niet komt.
  const res = draai('curl', ['-sS', '-L', '--max-time', '60', ...(method === 'HEAD' ? ['-I'] : []), '-o', '-', '-w', '\n%{http_code}', url]);
  if (res.status !== 0) return { status: 0, text: null };
  const i = res.stdout.lastIndexOf('\n');
  return { status: Number(res.stdout.slice(i + 1)), text: res.stdout.slice(0, i) };
}

/** De echte omgeving. `droog`: elke schrijvende stap stopt de run vóórdat hij gebeurt. */
export function maakContext({ droog, scriptRoot, root, log }) {
  const ctx = {
    repo: REPO, droog, scriptRoot, root, home: homedir(), acties: 0, npmGedaan: new Set(),
    now: () => Date.now(),
    sleep: ms => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); },
    log,
    // Een melding voor wrakko die de release niet stopt; de thread geeft elke RELEASE-MELDING-regel door.
    meldingen: [],
    meld: (code, tekst) => {
      ctx.meldingen.push(code);
      console.log(`RELEASE-MELDING ${code}: ${tekst.replace(/\s+/g, ' ')}`);
    },
    act(stap, fn) {
      if (droog) throw new DroogStop(stap);
      log(`doe: ${stap}`);
      ctx.acties += 1;
      return fn();
    },
    gh: (args, { input } = {}) => moetSlagen('gh', args, { cwd: root, input }),
    ghJson: args => {
      const uit = moetSlagen('gh', args, { cwd: root });
      if (uit.trim() === '') throw new Error(`gh ${args.join(' ')} gaf lege uitvoer`);
      return JSON.parse(uit);
    },
    git: (args, { cwd = root } = {}) => moetSlagen('git', args, { cwd }).trim(),
    gitOk: (args, { cwd = root } = {}) => draai('git', args, { cwd }).status === 0,
    run: (cmd, args, { cwd, env } = {}) => draai(cmd, args, { cwd, env, timeoutMs: 60 * 60_000 }),
    claude: (prompt, opts) => {
      if (droog) throw new DroogStop('tekstagent (claude -p) starten');
      ctx.acties += 1;
      log(`doe: claude -p in ${opts.cwd}`);
      return claude(prompt, opts);
    },
    httpStatus: url => http(url, { method: 'HEAD' }).status,
    httpText: url => { const r = http(url); return r.status === 200 ? r.text : null; },
    httpJson: url => { const r = http(url); try { return r.status === 200 ? JSON.parse(r.text) : null; } catch { return null; } },
    fs: {
      exists: existsSync,
      read: p => readFileSync(p, 'utf8'),
      readOrNull: p => (existsSync(p) ? readFileSync(p, 'utf8') : null),
      write: (p, tekst) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, tekst); },
      mtimeMs: p => (existsSync(p) ? statSync(p).mtimeMs : null),
      rm: p => rmSync(p, { recursive: true, force: true }),
      copyDir: (van, naar) => cpSync(van, naar, { recursive: true, filter: bron => !bron.includes(`${join(van, '.git')}`) }),
    },
  };
  return ctx;
}

/** Eén run tegelijk: een slotbestand met het proces-id; een dood proces laat geen slot achter. */
export function neemSlot(pad, pid = process.pid, leeft = p => { try { process.kill(p, 0); return true; } catch { return false; } }) {
  mkdirSync(dirname(pad), { recursive: true });
  for (let poging = 0; poging < 2; poging++) {
    try {
      const fd = openSync(pad, 'wx');
      writeFileSync(fd, String(pid));
      closeSync(fd);
      return () => { try { unlinkSync(pad); } catch { /* al weg */ } };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const ander = Number(readFileSync(pad, 'utf8'));
      if (ander && leeft(ander)) throw new ReleaseStop('al-actief', `er loopt al een releasescript (pid ${ander}, ${pad})`);
      unlinkSync(pad);
    }
  }
  throw new ReleaseStop('al-actief', `het slot ${pad} is niet te nemen`);
}

function main(argv) {
  const droog = argv.includes('--droog');
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const log = tekst => console.log(`[${new Date().toISOString()}] ${tekst}`);
  let uitkomst;
  let laat = () => {};
  try {
    // De hoofdrepo: de gedeelde .git-map van deze worktree.
    const root = resolve(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: scriptRoot, encoding: 'utf8' }).trim(), '..');
    if (!droog) laat = neemSlot(join(homedir(), '.local/state/ops-release/slot'));
    uitkomst = release(maakContext({ droog, scriptRoot, root, log }));
  } catch (err) {
    uitkomst = err;
  } finally {
    laat();
  }
  if (uitkomst instanceof Error && !(uitkomst instanceof ReleaseStop) && uitkomst.constructor.name === 'Error') console.error(uitkomst.stack);
  const { regel, exit } = slotregel(uitkomst);
  console.log(regel);
  return exit;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
