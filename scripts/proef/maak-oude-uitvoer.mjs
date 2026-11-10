#!/usr/bin/env node
// #804 fase 0: maak echte writer-uitvoer van oude release-tags voor de 100 %-P-poort (ontwerp §10).
//
// Per tag: `git archive` van src/ en public/examples/ naar een tijdelijke map, een klein script dat het
// voorbeeld met de lezer van die tag leest en met de writer van die tag schrijft, bundelen met esbuild
// en draaien met een vaste klok. Geen app-build: alleen lezer en writer. De uitvoer gaat naar
// tests/planning/fixtures/oude-tags/<tag>-<voorbeeld>.ifc.
//
// Formaatwissels (§10):
//  - df9eafc7d (main, 2026-07-03): kale GlobalId-sleutels in OPS_Assignments, IfcTask met 12 argumenten, '0.1'. De
//    sleutels kwamen in e1ac01947 en wisselden naar `#n` in 87ebd4d46, op dezelfde dag en vóór v2026.7.3.
//  - v2026.7.2: de laatste tag met IfcTask met 12 argumenten (en '0.1'); schrijft nog geen OPS_Assignments.
//  - v2026.9.0: de laatste tag met '0.1' (letterlijke tekst, vóór 2026-09-28), met `#n`-sleutels en 13 argumenten.
//  - v2026.43.0: de huidige lay-out en codering; voor de vraag uit §11 of een oudere tag in een constant slot een
//    andere waarde schrijft (evidence fase 0).
//
// Draaien: node scripts/proef/maak-oude-uitvoer.mjs   (licht: kleine esbuild-bundels)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/planning/fixtures/oude-tags');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const JOBS = [
  {
    // Kale sleutels stonden alleen op main tussen e1ac01947 en 87ebd4d46 (3 juli 2026, ruim vier uur) en zaten in
    // geen release-tag. De browserbouw draait main (live.yml), dus bestanden in dit formaat kunnen bestaan.
    tag: 'df9eafc7d', label: 'main-df9eafc7d', example: 'woongebouw-nieuwbouw.ifc',
    call: 'writeIFC(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.activityCodeTypes, r.customFieldDefs, r.resourceCalendars)',
  },
  {
    tag: 'v2026.7.2', example: 'woongebouw-nieuwbouw.ifc',
    call: 'writeIFC(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.activityCodeTypes, r.customFieldDefs)',
  },
  { tag: 'v2026.9.0', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })' },
  { tag: 'v2026.43.0', example: '10-villa-wassenaar.ifc', call: 'writeIFC({ ...r })' },
  // #870 ronde 8 (Trias, wrakko 10 november 2026): v2026.7.12 is de laatste tag die naam, auteur en bedrijf rauw in
  // FILE_NAME schreef (771db15cb ontsnapte ze pas in v2026.7.13). Een apostrof of `DATA;` in de projectnaam maakt de kop
  // kapot; zulke eigen bestanden moeten blijven opslaan.
  { tag: 'v2026.7.12', label: 'v2026.7.12-ohara', example: 'showcase-verbouwing-eengezinswoning.ifc',
    call: `writeIFC({ ...r, project: { ...r.project, name: "O'Hara Tower" } })` },
  { tag: 'v2026.7.12', label: 'v2026.7.12-data', example: 'showcase-verbouwing-eengezinswoning.ifc',
    call: `writeIFC({ ...r, project: { ...r.project, name: 'Fase DATA; Noord' } })` },
];

// Vaste klok: de writer zet `new Date()` in de kop, de owner history en de werkplannen.
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
