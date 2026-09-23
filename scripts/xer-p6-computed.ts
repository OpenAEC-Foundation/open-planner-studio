// Meet per corpus-entry of het orakel aantoonbaar door P6 zelf is doorgerekend — UITSLUITEND
// rapportage. Bron van `tests/planning/xer-corpus-p6computed.json`; het veld stuurt nooit de
// populatie (dat doen alleen role/included in xer-corpus-manifest.json, een eigenaarsbesluit).
//
//   node scripts/run-ts.mjs scripts/xer-p6-computed.ts           # meet en schrijft het bestand
//   node scripts/run-ts.mjs scripts/xer-p6-computed.ts --check   # faalt (exit 1) bij afwijking
//
// Vereist OPS_XER_CORPUS. De drie kenmerken (plan 2026-09-23-x12-c1-c4-toets-buiten-rehab2.md §3,
// B01-onderzoek §3), per project gemeten op de ruwe tabellen:
//   S  er is een SCHEDOPTIONS-rij voor het project;
//   R  `rem_late_start_date` is gevuld op ALLE open taken (status_code ≠ TK_Complete), met ≥1 open taak;
//   D  `driving_path_flag` = Y op minstens één taak.
// Een project is P6-doorgerekend (`projects[proj_id].p6Computed`) als S, R en D gelden; "unknown"
// als het project geen open taken heeft; anders false. Dit per-projectoordeel is de eenheid van de
// X12-splitsing (check-xer-product-fidelity-x12.ts telt per (bestand, project)). Het bestandsveld
// `p6Computed` is alleen een samenvatting: de gemeenschappelijke waarde als alle projecten dezelfde
// hebben, "mixed" als ze verschillen, "unknown" zonder projecten of als het bestand niet als XER te
// lezen is. De bestands-evidence is over het hele bestand opgeteld.
//
// LET OP — bak 2: `rem_late_start_date` en `driving_path_flag` staan in XER_TASK_FORBIDDEN
// (plan-xer-p6-lezer §4.1, tests/planning/check-xer-field-whitelist.ts). Dit script leest ze
// alleen voor deze meting, buiten `src/`. Zet zo'n lezing NOOIT in `src/`: de lezer mag deze
// P6-rekenuitvoer nooit lezen, en de whitelist-grep over `src/` bewaakt dat.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseXerTables } from '@/services/xer/xerTables';

type P6Computed = true | false | 'unknown';
interface Evidence { schedOptions: boolean; remLateStartFilled: string; drivingPathFlagY: boolean }
interface ProjectEntry extends Evidence { p6Computed: P6Computed }
interface Entry {
  sha256: string; p6Computed: P6Computed | 'mixed'; p6ComputedEvidence: Evidence; projectsP6Computed: string;
  projects: Record<string, ProjectEntry>;
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
const files: Record<string, Entry> = {};
const errors: string[] = [];
for (const label of Object.keys(manifest.files).sort()) {
  const path = onDisk.get(label);
  if (!path) { errors.push(`ontbreekt in corpus: ${label}`); continue; }
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== manifest.files[label]!.sha256) { errors.push(`sha256 wijkt af van manifest: ${label}`); continue; }
  files[label] = { sha256, ...measure(bytes) };
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
