import { test, assert, assertEq, run } from './harness';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

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

interface Case { name: string; bytes: Buffer }

function corpus(): Case[] {
  const files = [join(ROOT, 'examples'), join(ROOT, 'public', 'examples')]
    .flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.ifc')).sort().map(name => join(dir, name)));
  const cases: Case[] = files.map(file => ({ name: `${basename(dirname(file))}-${basename(file)}`, bytes: readFileSync(file) }));
  const villa = readFileSync(join(ROOT, 'public', 'examples', '10-villa-wassenaar.ifc'));
  const at = villa.indexOf("'New-Build Villa") + 1;
  assert(at > 0, 'de projectnaam van de villa');
  const rawByte = Buffer.concat([villa.subarray(0, at), Buffer.from([0xe9]), villa.subarray(at)]);
  cases.push(
    { name: 'villa-met-bom.ifc', bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), villa]) },
    { name: 'villa-met-bom-en-spatie.ifc', bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf, 0x20]), villa]) },
    { name: 'villa-met-los-byte.ifc', bytes: rawByte },
    { name: 'model-ifc2x3.ifc', bytes: readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/model-ifc2x3.ifc')) },
  );
  return cases;
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

interface Run { transcript: string[]; files: Map<string, Buffer> }

function renamedIds(transcript: readonly string[]): string[] {
  const names = new Map<string, string>();
  return transcript.map(line => line.replace(GENERATED_ID, (id) => {
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
  const transcript: string[] = [];
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await session.request('tools/call', { name, arguments: args });
    transcript.push(JSON.stringify(response));
    return (response as { result?: { structuredContent?: { ok?: boolean; data?: Record<string, unknown> } } }).result?.structuredContent;
  };
  try {
    transcript.push(JSON.stringify(await session.request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ops-pariteit', version: '1.0.0' },
    })));
    session.notify('notifications/initialized');
    transcript.push(JSON.stringify(await session.request('tools/list')));
    for (const [i] of cases.entries()) {
      const dir = join(work, String(i));
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
  return { transcript, files };
}

if (!MAIN) {
  console.log('  overgeslagen: OPS_MAIN_WORKTREE is niet gezet (een werkmap van main met node_modules; de proef draait lokaal)');
} else {
  test('pariteit met main: elk bestand zonder vreemd deel geeft dezelfde antwoorden en dezelfde bytes als de headless server van main', async () => {
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
      const work = join(tmp, 'werkmap');
      const expected = await replay(mainServer, work, cases, preload, tmp);
      const actual = await replay(branchServer, work, cases, preload, tmp);
      assertEq(actual.transcript.length, expected.transcript.length, 'evenveel antwoorden');
      const [mainLines, branchLines] = [renamedIds(expected.transcript), renamedIds(actual.transcript)];
      const differs = mainLines.findIndex((line, i) => branchLines[i] !== line);
      assert(differs < 0, `antwoord ${differs} verschilt:\nmain:   ${mainLines[differs]?.slice(0, 1500)}\nbranch: ${branchLines[differs]?.slice(0, 1500)}`);
      const generated = new Set(expected.transcript.flatMap(line => line.match(GENERATED_ID) ?? [])).size;
      assertEq([...actual.files.keys()], [...expected.files.keys()], 'dezelfde bestanden');
      for (const [key, bytes] of expected.files) {
        assert(actual.files.get(key)!.equals(bytes), `${key} (${cases[Number(key.split('/')[0])].name}): andere bytes dan main`);
      }
      const opened = expected.transcript.filter(line => line.includes('"documentsOpened"')).length;
      console.log(`  ${cases.length} bestanden, ${expected.transcript.length} antwoorden, ${expected.files.size} bestanden op schijf, ${opened} keer geopend, ${generated} gegenereerde id's hernoemd`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

await run();
