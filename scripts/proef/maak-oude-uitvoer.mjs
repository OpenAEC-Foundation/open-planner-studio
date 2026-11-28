#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/planning/fixtures/oude-tags');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const HOUR_TASK = `
      const leaf = r.tasks.find(t => !r.tasks.some(o => o.parentId === t.id) && t.time.scheduleDuration > 1);
      const day = String(leaf.time.scheduleStart).slice(0, 10);
      Object.assign(leaf.time, { durationUnit: 'hours', durationMinutes: 240, scheduleDuration: 0.5, remainingTime: 0.5,
        scheduleStart: day + 'T07:00', scheduleFinish: day + 'T11:00', earlyStart: day + 'T07:00', earlyFinish: day + 'T11:00',
        lateStart: day + 'T07:00', lateFinish: day + 'T11:00' });`;

const JOBS = [
  {
    tag: 'df9eafc7d', label: 'main-df9eafc7d', example: 'woongebouw-nieuwbouw.ifc',
    call: 'writeIFC(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.activityCodeTypes, r.customFieldDefs, r.resourceCalendars)',
  },
  {
    tag: 'v2026.7.2', example: 'woongebouw-nieuwbouw.ifc',
    call: 'writeIFC(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.activityCodeTypes, r.customFieldDefs)',
  },
  { tag: 'v2026.9.0', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })' },
  { tag: 'v2026.43.0', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })' },
  {
    tag: 'v2026.9.0', label: 'v2026.9.0-17-cijfers', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })',
    mutate: `
      const leaves = r.tasks.filter(t => !r.tasks.some(o => o.parentId === t.id) && t.time.scheduleDuration > 1);
      leaves[0].time.scheduleDuration = 7 / 3; leaves[0].time.remainingTime = 7 / 3;
      leaves[1].time.totalFloat = 0.1 + 0.2; leaves[1].time.freeFloat = 1e-7;
      leaves[2].time.actualStart = leaves[2].time.scheduleStart; leaves[2].time.actualDuration = 0.1 + 0.2;
      r.sequences.find(q => q.lagPercent == null && q.lagMinutes == null).lagDays = 0.1 + 0.2;`,
  },
  {
    tag: 'v2026.43.0', label: 'v2026.43.0-halve-dag', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })',
    mutate: `
      const leaf = r.tasks.find(t => !r.tasks.some(o => o.parentId === t.id) && t.time.scheduleDuration > 1);
      leaf.time.scheduleDuration = 0.5; leaf.time.remainingTime = 0.5;`,
  },
  { tag: 'v2026.43.0', label: 'v2026.43.0-urentaak', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })', mutate: HOUR_TASK },
  { tag: 'v2026.9.0', label: 'v2026.9.0-urentaak', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })', mutate: HOUR_TASK },
  {
    tag: 'v2026.7.7', label: 'v2026.7.7-urentaak', example: '10-villa-wassenaar.ifc', mutate: HOUR_TASK,
    call: 'writeIFC(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.activityCodeTypes, r.customFieldDefs, r.resourceCalendars, r.baselines, r.activeBaselineId)',
  },
  { tag: 'v2026.7.12', label: 'v2026.7.12-ohara', example: 'showcase-verbouwing-eengezinswoning.ifc',
    call: `writeIFC({ ...r, project: { ...r.project, name: "O'Hara Tower" } })` },
  { tag: 'v2026.7.12', label: 'v2026.7.12-data', example: 'showcase-verbouwing-eengezinswoning.ifc',
    call: `writeIFC({ ...r, project: { ...r.project, name: 'Fase DATA; Noord' } })` },
];
const only = process.argv.slice(2);

const FIXED_CLOCK = `
const FIXED = Date.UTC(2026, 0, 15, 12, 0, 0);
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
  static now() { return FIXED; }
}
globalThis.Date = FixedDate;
`;

mkdirSync(OUT, { recursive: true });
for (const job of JOBS) {
  if (only.length > 0 && !only.includes(job.label ?? job.tag)) continue;
  const work = mkdtempSync(join(tmpdir(), `ops-oud-${job.tag}-`));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', job.tag, 'src', 'public/examples'], { maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', work], { input: tar });
    writeFileSync(join(work, 'klok.mjs'), FIXED_CLOCK);
    writeFileSync(join(work, 'entry.ts'), `
import './klok.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
const r = readIFC(readFileSync(process.argv[2], 'utf8')) as any;
${job.mutate ?? ''}
writeFileSync(process.argv[3], ${job.call});
`);
    const bundle = join(work, 'entry.mjs');
    execFileSync(ESBUILD, [join(work, 'entry.ts'), '--bundle', '--platform=node', '--format=esm', `--alias:@=${join(work, 'src')}`,
      '--log-level=error', '--define:import.meta.env.DEV=false', '--define:import.meta.env.PROD=true', `--outfile=${bundle}`],
    { stdio: 'inherit', cwd: ROOT });
    const source = join(work, 'public/examples', job.example);
    if (!existsSync(source)) throw new Error(`${job.tag}: voorbeeld ${job.example} ontbreekt`);
    const target = join(OUT, `${job.label ?? job.tag}-${job.example}`);
    execFileSync(process.execPath, [bundle, source, target], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' } });
    console.log(`OK  ${job.tag}: ${target.slice(ROOT.length + 1)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
