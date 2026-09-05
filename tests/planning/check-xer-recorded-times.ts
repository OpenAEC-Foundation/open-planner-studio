/**
 * BAK 4 — "datums zoals opgeslagen" voor XER (XER-etappeplan §4.1-bijstelling 2026-09-04,
 * eigenaarsbesluit X-O7 laag 3), taak T1. Toetst `readXerRecordedTimes`
 * (`src/services/xer/xerRecordedTimes.ts`) en de wiring in `readXER`
 * (`ImportResult.recordedTimes`/`recordedTimesOrigin`).
 *
 * CORPUSLOOS (altijd): oracle-fixture met bekende waarden per as, plus mutatiebewijs (b) — een
 * TIJDELIJKE lokale assertie die aantoont dat een lek van een bak-4-kolom naar `Task.time` deze
 * poort rood maakt. De DEFINITIEVE X12-assertie (positieve helft: gemuteerde opgeslagen uitvoer
 * verplaatst de solve niet, maar verplaatst de weergavemodus wél) is taak T2 en herschrijft
 * `check-xer-product-fidelity-x12.ts` naar v2 — dat bestand wordt door DEZE taak NIET aangeraakt.
 *
 * MET CORPUS (OPS_XER_CORPUS): aantallen per as voor twee gepinde bestanden.
 */
import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function truthy(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function read(lines: readonly string[]): XerReadResult {
  const parsed = readXER(bytes(lines));
  if (isMultiDocumentImport(parsed)) throw new Error('Enkelprojectfixture gaf een meervoudige import terug');
  return parsed;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Corpusloze oracle-fixture — dag-modus, twee kalenders (C1: 8u/dag, C2: 6u/dag — bewijst dat de
// omrekening de TAAK-EFFECTIEVE kalender gebruikt, niet de projectkalender).
// ═══════════════════════════════════════════════════════════════════════════════════════════
const FIXTURE_HEADER = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');

const fixture = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%R\tC2\tKort 6u\tCA_Base\t6\t30\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tRecordedTimesFixture\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  `%F\t${FIXTURE_HEADER}`,
  // T1 — volledig: early+late+float, positieve speling (5 dagen), niet kritiek.
  '%R\tT1\tP1\tC1\tA1\tDeviates\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t2026-01-10\t2026-01-17\t40\t8',
  // T2 — kritiek: total_float_hr_cnt=0 ⇒ isCritical=true (afgeleid, geen driving_path_flag).
  '%R\tT2\tP1\tC1\tA2\tCritical\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-02-01\t2026-02-05\t2026-02-01\t2026-02-05\t2026-02-01\t2026-02-05\t0\t0',
  // T3 — alleen early: late/float ontbreken ⇒ "niet vastgelegd", geen 0/gelijkstelling.
  '%R\tT3\tP1\tC1\tA3\tEarlyOnly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-03-01\t2026-03-03\t2026-03-01\t2026-03-03\t\t\t\t',
  // T4 — early_end_date ontbreekt: GEEN uitspraak, ook al zijn late/float wél aanwezig.
  '%R\tT4\tP1\tC1\tA4\tMissingEarlyFinish\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-04-01\t2026-04-06\t2026-04-01\t\t2026-04-05\t2026-04-06\t16\t8',
  // T5 — geen enkele early-as, target_start/end WEL aanwezig: bewijst dat er GEEN terugval is.
  '%R\tT5\tP1\tC1\tA5\tNoEarlyAtAll\tTT_Task\tDT_FixedDUR\tTK_NotStart\t32\t32\t2026-05-01\t2026-05-05\t\t\t\t\t\t',
  // T6 — onparseerbare early_start_date: taak volledig overgeslagen (geen half paar).
  '%R\tT6\tP1\tC1\tA6\tMalformed\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-06-01\t2026-06-05\tnot-a-date\t2026-06-05\t\t\t\t',
  // T7 — fractionele uren: 4.01u × 60 = 240,6min → Math.round → 241min / 480min-per-dag.
  '%R\tT7\tP1\tC1\tA7\tRounding\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-07-01\t2026-07-02\t2026-07-01\t2026-07-02\t\t\t4.01\t',
  // T8 — eigen kalender C2 (6u/dag): 6u float ⇒ 1,0 dag. Op de PROJECTkalender (C1, 8u/dag) zou
  // dit fout 0,75 dag zijn — bewijst dat de TAAK-effectieve kalender wordt gebruikt.
  '%R\tT8\tP1\tC2\tA8\tOtherCalendar\tTT_Task\tDT_FixedDUR\tTK_NotStart\t12\t12\t2026-08-01\t2026-08-02\t2026-08-01\t2026-08-02\t\t\t6\t',
  '%E',
] as const;

const result = read(fixture);

eq('0 recordedTimesOrigin is xer', result.recordedTimesOrigin, 'xer');
truthy('0b recordedTimes bestaat', !!result.recordedTimes);
const rt = result.recordedTimes ?? {};

eq('1 T1 — volledig early+late+float, niet kritiek', rt.T1, {
  start: '2026-01-05', finish: '2026-01-12',
  lateStart: '2026-01-10', lateFinish: '2026-01-17',
  totalFloat: 5, freeFloat: 1, isCritical: false,
});
eq('2 T2 — kritiek afgeleid uit totalFloat=0', rt.T2, {
  start: '2026-02-01', finish: '2026-02-05',
  lateStart: '2026-02-01', lateFinish: '2026-02-05',
  totalFloat: 0, freeFloat: 0, isCritical: true,
});
eq('3 T3 — alleen early vastgelegd; late/float/isCritical ontbreken (geen 0/gelijkstelling)', rt.T3, {
  start: '2026-03-01', finish: '2026-03-03',
});
truthy('4 T4 — early_end_date ontbreekt ⇒ GEEN uitspraak, ook met late/float aanwezig', rt.T4 === undefined);
truthy('5 T5 — geen early-as ⇒ GEEN terugval op target_start/end_date', rt.T5 === undefined);
truthy('6 T6 — onparseerbare early_start_date ⇒ taak volledig overgeslagen', rt.T6 === undefined);
eq('7 T7 — Math.round(4.01×60)=241min / 480min-per-dag', rt.T7, {
  start: '2026-07-01', finish: '2026-07-02',
  totalFloat: 241 / 480, isCritical: false,
});
eq('8 T8 — omrekening via de TAAK-effectieve kalender (C2, 6u/dag), niet de projectkalender (C1)',
  rt.T8, { start: '2026-08-01', finish: '2026-08-02', totalFloat: 1, isCritical: false });

// ── Geen enkele orakelwaarde lekt naar Task.time (de kernregel van laag 3) ──────────────────
// Concreet en scherp (geen tautologie): het bestand plant T1 op target_start/end 02–09 jan, terwijl
// het orakel 05–12 jan zegt. Staat één van die orakelwaarden ook in `task.time`, dan is er ergens
// een lezerregressie die een bak-4-kolom alsnog naar `Task.time` kopieert — precies wat
// MUTATIEBEWIJS (b) hieronder (tijdelijk, handmatig) aantoont.
truthy('9 T1 — task.time draagt NERGENS de orakel-earlyStart (2026-01-05)',
  !Object.values(result.tasks.find(t => t.id === 'T1')!.time).includes('2026-01-05'));
truthy('10 T1 — task.time draagt NERGENS de orakel-lateStart (2026-01-10)',
  !Object.values(result.tasks.find(t => t.id === 'T1')!.time).includes('2026-01-10'));

console.log(`.   xer-recorded-times: ${Object.keys(rt).length} van ${result.tasks.length} taken met vastgelegde early-as (fixture)`);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// MUTATIEBEWIJS (b) — status na taak T2. Checks 9/10 hierboven zijn tijdens de bouw van taak T1
// bewust ROOD gemaakt door `xerReader.ts` handmatig te muteren (`row.cells.late_start_date` laten
// lekken naar `Task.time.lateStart` in `mappedActivities.push(...)`), gecontroleerd, en weer
// teruggedraaid — nooit als blijvende code hier, want een permanente mutatie in dit testbestand zou
// de fixture naar de implementatie toe schrijven (verboden, baan-preambule).
//
// KEUZE (expliciet gevraagd bij taak T2): checks 9/10 BLIJVEN STAAN als extra, corpusloze dekking
// naast de definitieve X12-mutatieproef — geen verplaatsing. Motivatie: dit bestand draagt zijn eigen
// T1..T8-fixture dekt assen (afronding, per-taak-kalender, ontbrekend-paar-uitsluiting) die de
// X12-productfixtures niet als hoofddoel hebben, en de assertie hier is goedkoper te onderhouden
// (één klein, doelgericht bestand) dan de zwaardere productfixtures. De DEFINITIEVE, plan-vereiste
// X12-mutatieproef (§4/T2: beide helften — `recordedTimes` verschilt exact op de gemuteerde assen
// mét de verwachte waarden, én de solverprojectie blijft byte-gelijk) staat sinds T2 in
// `check-xer-product-fidelity-x12.ts` (zoek op "X12-T2"), op de bestaande `completedPackageBytes`-
// en `packageBytes`-fixtures — dat bestand is de canonieke poort voor dit mutatiebewijs.

// ═══════════════════════════════════════════════════════════════════════════════════════════
// MET CORPUS: aantallen per as voor twee gepinde bestanden (X-O7-bijstellingsrapport).
// ═══════════════════════════════════════════════════════════════════════════════════════════
const CORPUS = process.env.OPS_XER_CORPUS;

function axisCounts(r: XerReadResult): {
  tasks: number; early: number; late: number; totalFloat: number; freeFloat: number; critical: number;
} {
  const times = Object.values(r.recordedTimes ?? {});
  return {
    tasks: r.tasks.length,
    early: times.length,
    late: times.filter(t => t.lateStart !== undefined && t.lateFinish !== undefined).length,
    totalFloat: times.filter(t => t.totalFloat !== undefined).length,
    freeFloat: times.filter(t => t.freeFloat !== undefined).length,
    critical: times.filter(t => t.isCritical === true).length,
  };
}

if (!CORPUS) {
  console.log('OK  xer-recorded-times: corpus niet aanwezig (OPS_XER_CORPUS) — corpuspoort overgeslagen');
} else if (!existsSync(CORPUS)) {
  truthy('xer-recorded-times: OPS_XER_CORPUS wijst naar een bestaande map', false);
} else {
  const p6diffPath = join(CORPUS, 'crawl-xer', 'p6diff-baseline.xer');
  if (existsSync(p6diffPath)) {
    const parsed = readXER(new Uint8Array(readFileSync(p6diffPath)));
    const r = isMultiDocumentImport(parsed) ? parsed.results[parsed.activeDocumentIndex] : parsed;
    const counts = axisCounts(r as XerReadResult);
    eq('K1 p6diff-baseline.xer — 8 van 12 taken met vastgelegd early-paar', counts.early, 8);
    console.log(`.   xer-recorded-times: p6diff-baseline.xer — ${JSON.stringify(counts)}`);
  } else {
    truthy(`xer-recorded-times: ${p6diffPath} bestaat`, false);
  }

  // rehab-2.xer kan op verschillende dieptes in de crawl-extra-boom staan; zoek 'm op, net als
  // andere corpuschecks doen voor bestanden buiten een vaste submap.
  function findFile(dir: string, name: string): string | null {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFile(full, name);
        if (found) return found;
      } else if (entry.name === name) {
        return full;
      }
    }
    return null;
  }
  const rehabPath = findFile(CORPUS, 'rehab-2.xer');
  if (rehabPath) {
    const parsed = readXER(new Uint8Array(readFileSync(rehabPath)));
    const r = isMultiDocumentImport(parsed) ? parsed.results[parsed.activeDocumentIndex] : parsed;
    const counts = axisCounts(r as XerReadResult);
    truthy(`K2 rehab-2.xer — ~6,9k taken met vastgelegd early-paar (gemeten: ${counts.early})`,
      counts.early >= 6800 && counts.early <= 7000);
    console.log(`.   xer-recorded-times: rehab-2.xer — ${JSON.stringify(counts)}`);
  } else {
    truthy('xer-recorded-times: rehab-2.xer gevonden in OPS_XER_CORPUS', false);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: xer-recorded-times — ${checks} checks groen`);
} else {
  console.log(`XX xer-recorded-times — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
