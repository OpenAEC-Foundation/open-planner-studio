import { test, assert, assertEq, run } from './harness';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { ownCorpus, type HeadlessStand } from './headlessCorpus';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAIN = process.env.OPS_MAIN_WORKTREE;

const FIXED = Date.UTC(2026, 10, 20, 9, 0, 0);
const GENERATED_ID = new RegExp(`(?:[a-z]+-)?${FIXED.toString(36)}[a-z0-9]+`, 'g');
const PRELOAD = `
const FIXED = ${FIXED};
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(FIXED); else super(...args); }
  static now() { return FIXED; }
}
globalThis.Date = FixedDate;
let seed = 20261120;
Math.random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
`;

interface Case { name: string; bytes: Buffer; stand: HeadlessStand }

function corpus(): Case[] {
  return [
    ...ownCorpus(ROOT),
    { name: 'model-ifc2x3.ifc', bytes: readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc2x3.ifc')), stand: 'onzeker' },
  ];
}

function build(repo: string, out: string): string {
  const r = spawnSync(process.execPath, [join(repo, 'scripts/build-mcp-server.mjs'), '--out', out], { cwd: repo, encoding: 'utf8' });
  assertEq(r.status, 0, `build:mcp-server in ${repo} faalde:\n${r.stdout}${r.stderr}`);
  return join(out, 'server.mjs');
}

class Session {
  private child: ChildProcessWithoutNullStreams;
  private buffer = new ReadBuffer();
  private waiting = new Map<number, (message: JSONRPCMessage) => void>();
  private next = 1;
  stderr = '';
  constructor(server: string, root: string, preload: string, home: string) {
    this.child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, server, '--root', root, '--no-backup',
      '--discovery-dir', join(home, 'geen-register')], {
      cwd: root, env: { PATH: process.env.PATH ?? '', HOME: home }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stderr.on('data', (d: Buffer) => { this.stderr += d.toString(); });
    this.child.stdout.on('data', (d: Buffer) => {
      this.buffer.append(d);
      for (let m = this.buffer.readMessage(); m; m = this.buffer.readMessage()) {
        const id = 'id' in m ? Number(m.id) : NaN;
        this.waiting.get(id)?.(m);
        this.waiting.delete(id);
      }
    });
  }
  request(method: string, params: Record<string, unknown> = {}): Promise<JSONRPCMessage> {
    const id = this.next++;
    return new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`${method} gaf geen antwoord:\n${this.stderr}`)), 120_000);
      this.waiting.set(id, (m) => { clearTimeout(timer); done(m); });
      this.child.stdin.write(serializeMessage({ jsonrpc: '2.0', id, method, params } as JSONRPCMessage));
    });
  }
  notify(method: string): void {
    this.child.stdin.write(serializeMessage({ jsonrpc: '2.0', method } as JSONRPCMessage));
  }
  async close(): Promise<void> {
    this.child.stdin.end();
    await new Promise<void>((done) => {
      if (this.child.exitCode !== null || this.child.signalCode !== null) done();
      else this.child.once('close', () => done());
    });
  }
}

interface Step { readonly tool: string; readonly response: string }
interface Run { head: string[]; cases: Step[][]; files: Map<string, Buffer> }

function renamedIds(lines: readonly string[]): string[] {
  const names = new Map<string, string>();
  return lines.map(line => line.replace(GENERATED_ID, (id) => {
    if (!names.has(id)) names.set(id, `<id ${names.size}>`);
    return names.get(id)!;
  }));
}

async function replay(server: string, work: string, cases: Case[], preload: string, home: string): Promise<Run> {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work);
  cases.forEach((c, i) => {
    mkdirSync(join(work, String(i)));
    writeFileSync(join(work, String(i), 'plan.ifc'), c.bytes);
  });
  const session = new Session(server, work, preload, home);
  const head: string[] = [];
  const steps: Step[][] = cases.map(() => []);
  try {
    head.push(JSON.stringify(await session.request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ops-pariteit', version: '1.0.0' },
    })));
    session.notify('notifications/initialized');
    head.push(JSON.stringify(await session.request('tools/list')));
    for (const [i] of cases.entries()) {
      const call = async (tool: string, args: Record<string, unknown>) => {
        const response = await session.request('tools/call', { name: tool, arguments: args });
        steps[i].push({ tool, response: JSON.stringify(response) });
        return (response as { result?: { structuredContent?: { ok?: boolean; data?: Record<string, unknown> } } }).result?.structuredContent;
      };
      const dir = join(work, String(i));
      await session.request('tools/call', { name: 'planner_new_document', arguments: {} });
      const opened = await call('planner_import_schedule', { path: join(dir, 'plan.ifc') });
      if (opened?.ok !== true) continue;
      const listed = await call('planner_list_tasks', { limit: 1000 });
      const tasks = (listed?.data?.tasks ?? []) as Array<{ id: string; summary?: boolean; milestone?: boolean }>;
      const leaf = tasks.find(t => !t.summary && !t.milestone);
      if (leaf) await call('planner_update_tasks', { updates: [{ id: leaf.id, fields: { name: 'Pariteit met main', duration: 7 } }] });
      await call('planner_get_critical_path', {});
      await call('planner_export_ifc', { path: join(dir, 'kopie.ifc') });
      await call('planner_export_ifc', { path: join(dir, 'plan.ifc'), overwrite: true });
      await call('planner_import_schedule', { path: join(dir, 'kopie.ifc') });
      await call('planner_get_project_overview', {});
    }
  } finally {
    await session.close();
  }
  const files = new Map<string, Buffer>();
  cases.forEach((_, i) => {
    for (const name of readdirSync(join(work, String(i))).sort()) files.set(`${i}/${name}`, readFileSync(join(work, String(i), name)));
  });
  return { head, cases: steps, files };
}

const codeOf = (response: string) => (JSON.parse(response) as { result?: { structuredContent?: { code?: string } } }).result?.structuredContent?.code;

if (!MAIN) {
  console.log('  overgeslagen: OPS_MAIN_WORKTREE is niet gezet (een werkmap van main met node_modules; de proef draait lokaal)');
} else {
  test('pariteit met main: een bewezen eigen bestand geeft de antwoorden en bytes van main, een onzeker bestand opent zoals main en schrijft geen IFC', async () => {
    assert(existsSync(join(MAIN, 'headless/mcp-server/src/main.ts')), `${MAIN} is geen werkmap van Open Planner Studio`);
    const commit = spawnSync('git', ['-C', MAIN, 'log', '-1', '--format=%H %s'], { encoding: 'utf8' }).stdout.trim()
      || process.env.OPS_MAIN_COMMIT || '(commit onbekend)';
    console.log(`  main: ${commit}`);
    const tmp = mkdtempSync(join(tmpdir(), 'ops-pariteit-'));
    try {
      const preload = join(tmp, 'vaste-klok.mjs');
      writeFileSync(preload, PRELOAD);
      const mainServer = build(MAIN, join(tmp, 'main'));
      const branchServer = build(ROOT, join(tmp, 'branch'));
      const cases = corpus();
      const started = Date.now();
      const work = join(tmp, 'werkmap');
      const expected = await replay(mainServer, work, cases, preload, tmp);
      const actual = await replay(branchServer, work, cases, preload, tmp);
      assertEq(renamedIds(actual.head), renamedIds(expected.head), 'initialize en tools/list');
      const tally = { eigen: 0, onzeker: 0, nietGeopend: 0 };
      const refusedOwn: string[] = [];
      for (const [i, c] of cases.entries()) {
        const [main, branch] = [expected.cases[i], actual.cases[i]];
        const label = `${i} ${c.name}`;
        const mainOpened = codeOf(main[0].response) === undefined;
        if (!mainOpened || c.stand === 'eigen') {
          const [m, b] = [renamedIds(main.map(s => s.response)), renamedIds(branch.map(s => s.response))];
          const differs = Array.from({ length: Math.max(m.length, b.length) }, (_, k) => k).find(k => m[k] !== b[k]) ?? -1;
          assert(differs < 0, `${label}, stap ${differs} (${main[differs]?.tool ?? branch[differs]?.tool}) verschilt:\nmain:   ${m[differs]?.slice(0, 1200)}\nbranch: ${b[differs]?.slice(0, 1200)}`);
          for (const name of ['plan.ifc', 'kopie.ifc']) {
            const [mainFile, branchFile] = [expected.files.get(`${i}/${name}`), actual.files.get(`${i}/${name}`)];
            assert(mainFile === undefined ? branchFile === undefined : branchFile?.equals(mainFile) === true, `${label}: ${name} anders dan main`);
          }
          tally[mainOpened ? 'eigen' : 'nietGeopend']++;
          continue;
        }
        const [m, b] = [renamedIds(main.slice(0, 4).map(s => s.response)), renamedIds(branch.slice(0, 4).map(s => s.response))];
        assertEq(b, m, `${label}: openen, lezen, wijzigen en rekenen zoals main`);
        const exports = branch.filter(s => s.tool === 'planner_export_ifc');
        assertEq(exports.map(s => codeOf(s.response)), ['VALIDATION', 'VALIDATION'], `${label}: elke IFC-export weigert`);
        assertEq(actual.files.get(`${i}/kopie.ifc`), undefined, `${label}: geen kopie`);
        assert(actual.files.get(`${i}/plan.ifc`)!.equals(c.bytes), `${label}: de bron is bytegelijk`);
        assert(expected.files.has(`${i}/kopie.ifc`), `${label}: main schreef hier wel (anders hoort het bestand niet in deze lijst)`);
        tally.onzeker++;
        refusedOwn.push(c.name);
      }
      const generated = new Set(expected.cases.flat().flatMap(s => s.response.match(GENERATED_ID) ?? [])).size;
      console.log(`  ${Math.round((Date.now() - started) / 1000)} s; ${cases.length} bestanden: ${tally.eigen} eigen zoals main, `
        + `${tally.onzeker} onzeker zonder IFC-uitvoer, ${tally.nietGeopend} door beide geweigerd; ${generated} gegenereerde id's hernoemd per bestand`);
      console.log(`  geopend en onzeker: ${refusedOwn.join(', ')}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

await run();
