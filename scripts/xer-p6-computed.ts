import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseXerTables } from '@/services/xer/xerTables';

type P6Computed = true | false | 'unknown';
interface Evidence { schedOptions: boolean; remLateStartFilled: string; drivingPathFlagY: boolean }
interface ProjectEntry extends Evidence { p6Computed: P6Computed }
interface Entry {
  sha256: string; p6Computed: P6Computed | 'mixed'; p6ComputedEvidence: Evidence; projectsP6Computed: string;
  projects: Record<string, ProjectEntry>;
  generatorEvidence?: string[];
}

const OUT = 'tests/planning/xer-corpus-p6computed.json';
const MANIFEST = 'tests/planning/xer-corpus-manifest.json';
const POLICY = 'p6Computed is uitsluitend rapportage (splitsing van de X12-afwijkingen); het stuurt de populatie nooit — alleen role/included in xer-corpus-manifest.json doen dat.';

function listXer(root: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) out.push(...listXer(p));
    else if (e.name.toLowerCase().endsWith('.xer')) out.push(p);
  }
  return out;
}

function measure(bytes: Uint8Array): Omit<Entry, 'sha256'> {
  let tables;
  try { tables = parseXerTables(bytes); } catch {
    return { p6Computed: 'unknown', p6ComputedEvidence: { schedOptions: false, remLateStartFilled: '0/0', drivingPathFlagY: false }, projectsP6Computed: '0/0', projects: {} };
  }
  const tasks = tables.tables.get('TASK')?.rows ?? [];
  const sched = new Set((tables.tables.get('SCHEDOPTIONS')?.rows ?? []).map(r => r.cells.proj_id ?? ''));
  const projects = new Map<string, { open: number; filled: number; d: boolean }>();
  for (const r of tables.tables.get('PROJECT')?.rows ?? []) projects.set(r.cells.proj_id ?? '', { open: 0, filled: 0, d: false });
  let open = 0, filled = 0, d = false;
  for (const t of tasks) {
    const pid = t.cells.proj_id ?? '';
    const p = projects.get(pid) ?? { open: 0, filled: 0, d: false };
    projects.set(pid, p);
    if ((t.cells.driving_path_flag ?? '') === 'Y') { p.d = true; d = true; }
    if ((t.cells.status_code ?? '') !== 'TK_Complete') {
      p.open++; open++;
      if ((t.cells.rem_late_start_date ?? '').trim() !== '') { p.filled++; filled++; }
    }
  }
  let yes = 0;
  const perProject: Record<string, ProjectEntry> = {};
  for (const pid of [...projects.keys()].sort()) {
    const p = projects.get(pid)!;
    const value: P6Computed = p.open === 0 ? 'unknown' : sched.has(pid) && p.filled === p.open && p.d ? true : false;
    if (value === true) yes++;
    perProject[pid] = { p6Computed: value, schedOptions: sched.has(pid), remLateStartFilled: `${p.filled}/${p.open}`, drivingPathFlagY: p.d };
  }
  const values = new Set(Object.values(perProject).map(p => p.p6Computed));
  const p6Computed: P6Computed | 'mixed' = values.size === 0 ? 'unknown' : values.size > 1 ? 'mixed' : [...values][0]!;
  return {
    p6Computed, projects: perProject,
    p6ComputedEvidence: { schedOptions: sched.size > 0, remLateStartFilled: `${filled}/${open}`, drivingPathFlagY: d },
    projectsP6Computed: `${yes}/${projects.size}`,
  };
}

const root = process.env.OPS_XER_CORPUS;
if (!root || !existsSync(root)) { console.error('XX OPS_XER_CORPUS ontbreekt of bestaat niet'); process.exit(2); }
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { files: Record<string, { sha256: string }> };
const onDisk = new Map(listXer(root).map(p => [relative(root, p).split('\\').join('/'), p]));
const shaOf = new Map<string, string>();
for (const [label, path] of onDisk) shaOf.set(label, createHash('sha256').update(readFileSync(path)).digest('hex'));
function generatorEvidence(sha256: string): string[] {
  const dirs = new Set<string>();
  for (const [label, s] of shaOf) if (s === sha256) dirs.add(dirname(onDisk.get(label)!));
  const out = new Set<string>();
  for (const dir of dirs) for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.py')) continue;
    const text = readFileSync(join(dir, e.name), 'utf8');
    if (text.includes('ERMHDR') && text.includes('SCHEDOPTIONS')) out.add(relative(root!, join(dir, e.name)).split('\\').join('/'));
  }
  return [...out].sort();
}
const files: Record<string, Entry> = {};
const errors: string[] = [];
for (const label of Object.keys(manifest.files).sort()) {
  const path = onDisk.get(label);
  if (!path) { errors.push(`ontbreekt in corpus: ${label}`); continue; }
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== manifest.files[label]!.sha256) { errors.push(`sha256 wijkt af van manifest: ${label}`); continue; }
  const gen = generatorEvidence(sha256);
  files[label] = { sha256, ...measure(bytes), ...(gen.length ? { generatorEvidence: gen } : {}) };
}
if (errors.length) { for (const e of errors) console.error(`XX ${e}`); process.exit(1); }
const text = JSON.stringify({ version: 2, policy: POLICY, files }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== text) { console.error(`XX ${OUT} komt niet overeen met de meting — draai zonder --check en commit`); process.exit(1); }
  console.log(`OK  ${OUT}: ${Object.keys(files).length} entries komen overeen met de meting`);
} else {
  writeFileSync(OUT, text);
  const c = { true: 0, false: 0, unknown: 0, mixed: 0 } as Record<string, number>;
  for (const e of Object.values(files)) c[String(e.p6Computed)]!++;
  console.log(`geschreven ${OUT}: ${Object.keys(files).length} entries; true ${c.true}, false ${c.false}, unknown ${c.unknown}, mixed ${c.mixed}`);
}
