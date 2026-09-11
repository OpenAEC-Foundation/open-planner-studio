// Rapportmodus (GEEN poort): late start/finish en totale/vrije speling van `readMPP` +
// `solveProject` tegen MS Projects eigen opgeslagen waarden — de vier assen die
// `check-mpp-fidelity.ts` (start/finish, `GOAL_ZERO_DEVIATIONS`) bewust niet meet. Meetkern:
// `mppLateFloatFidelity.ts`; uitkomst en duiding: `docs/planning-test-bevindingen-mpp-late-float.md`.
//
// Draait NIET mee in `run.sh`/`npm run verify` (er is niets te pinnen: dit is een meting van de
// huidige stand, geen eis) — start 'm los via `bash tests/planning/report-mpp-late-float.sh` met
// dezelfde corpuswortels als de meetlat (`OPS_MPP_CORPUS`, `OPS_MPP_CRAWL`). Exitcode is altijd 0
// tenzij de scan zelf faalt (geen bestand gevonden of een onverwachte leesfout).
//
// Privacy volgt `check-mpp-fidelity.ts`'s regel: corpusbestanden uitsluitend als hash, crawl-
// bestanden met hun relatieve pad; taaknamen worden NOOIT geprint (de voorbeeldregels dragen
// alleen tag + MSP-taak-ID + de twee waarden).
//
// Wat het rapport print:
//   1. per as × populatie (alle / handmatig / voltooid / samenvatting / overig) de tellingen
//      meetbaar / exact / zelfde-dag-of-binnen-één-werkdag / afwijkend, corpusbreed;
//   2. per bestand met ≥1 afwijking of sub-dag-verschil: de vier assen naast elkaar;
//   3. per diagnoseklasse (manual, levelingDelay, voltooid, inUitvoering, constraint, deadline,
//      kalender, samenvatting, elapsedEenheid, geen) per as het aantal afwijkende taken en de
//      eerste drie voorbeelden (tag, MSP-id, onze waarde, MSP-waarde);
//   4. welke pins uit `mpp-fidelity-baseline.json` NIET gezien zijn (bv. de OzBuild-helft van de
//      crawl die alleen op één machine staat) — het rapport verzint daar niets voor.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  measureLateFloat, addMatrix, emptyMatrix, emptyCounts, AXES, POPULATIONS, DIAG_FLAGS,
  type Axis, type AxisClass, type Population, type DiagFlag, type LateFloatFileRow, type CountMatrix, type AxisCounts,
} from './mppLateFloatFidelity';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const CRAWL = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';
type RootName = 'corpus' | 'crawl';

function listMppFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMppFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
  }
  return out;
}
const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const tagFor = (root: RootName, hash: string, label: string | undefined): string => (root === 'crawl' ? (label ?? hash) : hash);

const AXIS_LABEL: Record<Axis, string> = {
  lateStart: 'late start', lateFinish: 'late finish', totalFloat: 'totale speling', freeFloat: 'vrije speling',
};
const POP_LABEL: Record<Population | 'all', string> = {
  all: 'alle', manual: 'handmatig gepland', completed: 'voltooid', summary: 'samenvatting', other: 'overig (blad, auto, niet voltooid)',
};
const isDateAxis = (a: Axis) => a === 'lateStart' || a === 'lateFinish';
const nearClass = (a: Axis): AxisClass => (isDateAxis(a) ? 'sameday' : 'subday');
const fmt = (v: string | number | null) => (v === null ? '—' : String(v));

/** `OPS_MPP_LATE_FLOAT_DETAIL=<deelstring van de tag>`: per taak alle vier de assen naast
 *  elkaar voor de bestanden waarvan de tag die deelstring bevat — diagnosehulp. Geen taaknamen
 *  (zelfde privacyregel als hierboven); wél MSP-id, populatie, vlaggen en de rauwe waarden. */
const DETAIL = process.env.OPS_MPP_LATE_FLOAT_DETAIL;
function printDetail(tag: string, row: LateFloatFileRow): void {
  console.log(`   . [detail ${tag}] ${row.tasks} taak/taken — id | pop | vlaggen | hpd | eenheid | ES ours | EF ours | LS ours~msp | LF ours~msp | TF ours~msp (regel) | FF ours~msp`);
  const mark = (c: AxisClass) => (c === 'exact' ? ' ' : c === 'diff' ? 'X' : c === 'missing' ? '?' : c === 'boundary' ? '|' : '~');
  for (const r of row.rows) {
    const c = r.cells;
    console.log(
      `     ${String(r.mspId).padStart(4)} ${r.population.padEnd(9)} ${r.flags.join(',').padEnd(28)} ${String(r.hoursPerDay).padStart(4)} ${r.slackUnit.padEnd(14)} `
      + `ES ${r.earlyStart.padEnd(16)} EF ${r.earlyFinish.padEnd(16)} `
      + `${mark(c.lateStart.cls)}${fmt(c.lateStart.ours).padEnd(16)}~${fmt(c.lateStart.msp).padEnd(16)} `
      + `${mark(c.lateFinish.cls)}${fmt(c.lateFinish.ours).padEnd(16)}~${fmt(c.lateFinish.msp).padEnd(16)} `
      + `${mark(c.totalFloat.cls)}${fmt(c.totalFloat.ours).padStart(7)}~${fmt(c.totalFloat.msp).padEnd(7)} (${r.totalRule}) `
      + `${mark(c.freeFloat.cls)}${fmt(c.freeFloat.ours).padStart(7)}~${fmt(c.freeFloat.msp).padEnd(7)}`,
    );
  }
}

// ── Scan ─────────────────────────────────────────────────────────────────────────────────────
interface FileResult { tag: string; hash: string; root: RootName; row: LateFloatFileRow }
const files: FileResult[] = [];
let rejected = 0;
const errors: string[] = [];
const scannedRoots: RootName[] = [];
for (const [root, dir] of [['corpus', CORPUS], ['crawl', CRAWL]] as const) {
  if (!existsSync(dir)) { console.log(`.  ${root} niet aanwezig (${root === 'corpus' ? 'OPS_MPP_CORPUS' : 'OPS_MPP_CRAWL'}) — overgeslagen`); continue; }
  const paths = listMppFilesRecursive(dir);
  if (paths.length === 0) { console.log(`.  ${root}map aanwezig maar zonder .mpp-bestanden — overgeslagen`); continue; }
  scannedRoots.push(root);
  for (const path of paths) {
    const bytes = new Uint8Array(readFileSync(path));
    const hash = hashOf(bytes);
    const label = root === 'crawl' ? relative(dir, path).split(sep).join('/') : undefined;
    const tag = tagFor(root, hash, label);
    const row = measureLateFloat(bytes);
    if (row.status === 'rejected') { rejected++; continue; }
    if (row.status === 'error') { errors.push(`[${tag}] ${row.errMsg ?? '(geen boodschap)'}`); continue; }
    files.push({ tag, hash, root, row });
    if (DETAIL && tag.includes(DETAIL)) printDetail(tag, row);
  }
  console.log(`.  [${root}] ${paths.length} bestand(en) gescand`);
}
console.log(`.  ${rejected} bestand(en) overgeslagen (MPP_LEGACY/MPP_ENCRYPTED), ${errors.length} leesfout(en), ${files.length} gemeten`);
for (const e of errors) console.log(`   ! ${e}`);
if (files.length === 0) { console.log('XX  geen meetbaar bestand gevonden'); process.exit(1); }

// ── 1. Corpusbrede tabel per as × populatie ───────────────────────────────────────────────────
const total = emptyMatrix();
for (const f of files) addMatrix(total, f.row.counts);
const totalTasks = files.reduce((n, f) => n + f.row.tasks, 0);
const totalSlackStored = files.reduce((n, f) => n + f.row.totalSlackStoredTasks, 0);
console.log(`\n== 1. Corpusbreed: ${files.length} bestanden, ${totalTasks} taken (TOTAL_SLACK opgeslagen bij ${totalSlackStored} taken)`);
const sumPops = (m: CountMatrix, a: Axis, pops: readonly Population[]): AxisCounts => {
  const c = emptyCounts();
  for (const p of pops) for (const k of Object.keys(c) as AxisClass[]) c[k] += m[a][p][k];
  return c;
};
const pct = (n: number, d: number) => (d === 0 ? '   —  ' : `${((100 * n) / d).toFixed(1).padStart(5)}%`);
for (const a of AXES) {
  const near = nearClass(a);
  console.log(`\n-- ${AXIS_LABEL[a]}  (kolommen: meetbaar | exact | grensvorm (0 werkminuten ertussen) | ${near === 'sameday' ? 'zelfde dag, ander tijdstip' : 'binnen één werkdag'} | afwijkend | ontbrekend | %exact van meetbaar)`);
  for (const p of ['all', ...POPULATIONS] as const) {
    const c = p === 'all' ? sumPops(total, a, POPULATIONS) : total[a][p];
    const measurable = c.exact + c.boundary + c[near] + c.diff;
    console.log(`   ${POP_LABEL[p].padEnd(36)} ${String(measurable).padStart(5)} | ${String(c.exact).padStart(5)} | ${String(c.boundary).padStart(5)} | ${String(c[near]).padStart(5)} | ${String(c.diff).padStart(5)} | ${String(c.missing).padStart(5)} | ${pct(c.exact, measurable)}`);
  }
}

// ── 2. Per bestand met ≥1 niet-exacte meetbare taak ──────────────────────────────────────────
console.log('\n== 2. Per bestand (alleen bestanden met ≥1 niet-exacte meetbare taak; per as exact/grensvorm/near/afwijkend)');
let perfectFiles = 0;
for (const f of files) {
  const cells = AXES.map((a) => sumPops(f.row.counts, a, POPULATIONS));
  const imperfect = cells.some((c, i) => c.boundary + c[nearClass(AXES[i])] + c.diff > 0);
  if (!imperfect) { perfectFiles++; continue; }
  console.log(`   ${f.tag.padEnd(90)} taken=${String(f.row.tasks).padStart(3)}  ${AXES.map((a, i) => `${a}=${cells[i].exact}/${cells[i].boundary}/${cells[i][nearClass(a)]}/${cells[i].diff}`).join('  ')}`);
}
console.log(`   (${perfectFiles} bestand(en) op alle vier de assen exact voor alle meetbare taken)`);

// ── 3. Diagnoseklassen ───────────────────────────────────────────────────────────────────────
console.log('\n== 3. Diagnoseklassen — per vlag per as: aantal niet-exacte taken (afwijkend + near; grensvorm apart geteld, niet in de voorbeelden), eerste drie voorbeelden (tag #MSP-id: onze waarde vs MSP)');
interface Example { tag: string; mspId: number; ours: string; msp: string; cls: AxisClass; pop: Population }
const byFlag: Record<DiagFlag, Record<Axis, { n: number; diff: number; boundary: number; ex: Example[] }>> = {} as never;
for (const fl of DIAG_FLAGS) {
  byFlag[fl] = {} as never;
  for (const a of AXES) byFlag[fl][a] = { n: 0, diff: 0, boundary: 0, ex: [] };
}
for (const f of files) {
  for (const r of f.row.rows) {
    for (const a of AXES) {
      const cell = r.cells[a];
      if (cell.cls === 'exact' || cell.cls === 'missing') continue;
      for (const fl of r.flags) {
        const slot = byFlag[fl][a];
        if (cell.cls === 'boundary') { slot.boundary++; continue; }
        slot.n++;
        if (cell.cls === 'diff') slot.diff++;
        if (slot.ex.length < 3) slot.ex.push({ tag: f.tag, mspId: r.mspId, ours: fmt(cell.ours), msp: fmt(cell.msp), cls: cell.cls, pop: r.population });
      }
    }
  }
}
for (const fl of DIAG_FLAGS) {
  const any = AXES.some((a) => byFlag[fl][a].n + byFlag[fl][a].boundary > 0);
  if (!any) { console.log(`   ${fl}: 0 op alle assen`); continue; }
  console.log(`   ${fl}:`);
  for (const a of AXES) {
    const s = byFlag[fl][a];
    if (s.n + s.boundary === 0) continue;
    console.log(`      ${AXIS_LABEL[a].padEnd(15)} niet-exact=${s.n} (afwijkend=${s.diff}, near=${s.n - s.diff}); grensvorm=${s.boundary}`);
    for (const e of s.ex) console.log(`         ${e.tag} #${e.mspId} [${e.pop}] ${e.cls}: ${e.ours} vs ${e.msp}`);
  }
}

// ── 4. Niet-geziene pins uit de baseline (per gescande wortel) ────────────────────────────────
console.log('\n== 4. Pins uit mpp-fidelity-baseline.json die deze run NIET zag');
try {
  const baseline = JSON.parse(readFileSync(join(HERE, 'mpp-fidelity-baseline.json'), 'utf-8')) as { files: Record<string, { root: RootName; label?: string; tasks: number }> };
  const seen = new Set(files.map((f) => f.hash));
  for (const root of ['corpus', 'crawl'] as const) {
    const pinned = Object.entries(baseline.files).filter(([, v]) => v.root === root);
    if (!scannedRoots.includes(root)) { console.log(`   [${root}] niet gescand — alle ${pinned.length} pin(s) ongezien`); continue; }
    const unseen = pinned.filter(([h]) => !seen.has(h));
    const unseenTasks = unseen.reduce((n, [, v]) => n + v.tasks, 0);
    console.log(`   [${root}] ${pinned.length - unseen.length} van ${pinned.length} pins gezien; ${unseen.length} ongezien (${unseenTasks} gepinde taken)`);
    for (const [h, v] of unseen) console.log(`      ${tagFor(root, h, v.label)}`);
  }
} catch (e) {
  console.log(`   baseline niet leesbaar: ${(e as Error).message}`);
}
console.log('\nOK  report-mpp-late-float: rapport compleet (geen poort, geen pins)');
