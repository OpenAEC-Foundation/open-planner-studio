// Bak 4 — differentiële mutatietest (critreview op ded4d8c3, bevinding 7).
//
// "Datums zoals opgeslagen" leest in vier lezers (P6 XML, MSPDI, `.mpp`, CSV) de rekenuitvoer van
// het bronpakket naar een APART kanaal (`ImportResult.recordedTimes`). De regel is dat die
// vastlegging nooit solverinvoer wordt: `task.time` — en de rest van het importresultaat — moet
// byte-identiek zijn aan wat de lezer zonder die vastlegging zou opleveren.
//
// Dat bewijzen we hier door de vier lezers TWEE keer te bundelen met esbuild: één keer zoals ze zijn
// (AAN) en één keer met de vastlegging bronmatig uitgeschakeld (UIT): het vastleggingsblok in
// MSPDI/P6 XML/`.mpp` wordt `if (false) { … }`, en in CSV wordt `buildRecordedTime(…)` kortgesloten
// (de voorafgaande `get()`-lezingen zijn zuivere reads). Daarna vergelijken we per bestand het
// VOLLEDIGE `ImportResult` zonder `recordedTimes`/`recordedTimesOrigin`, met gegenereerde id's en
// aanmaaktijdstempels genormaliseerd. Elke vervanging moet precies één keer raken; anders faalt de
// check (een lezer die verbouwd is, mag deze test niet stil vacuüm maken).
//
// Fixtures draaien altijd; het publieke corpus (dezelfde standaardwortel als `check-mpp-fidelity.ts`,
// `OPS_MPP_CRAWL`) alleen als het aanwezig is.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CSV_FIXTURE, CSV_FIXTURE_DATES_ONLY, CSV_FIXTURE_UNREADABLE_DATES, MSPDI_FIXTURE, P6XML_FIXTURE,
} from '../fixtures/recordedTimesFormats';

declare const process: { env: Record<string, string | undefined>; cwd(): string; exit(code: number): never };

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: verwacht ${w.slice(0, 200)}, kreeg ${g.slice(0, 200)}`);
};
const truthy = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

// ── Wortels: de gebundelde check staat in tests/planning/, de repo twee niveaus hoger ─────────────
const here = fileURLToPath(new URL('.', import.meta.url));
const rootCandidates = [resolve(here, '..', '..'), process.cwd()];
const ROOT = rootCandidates.find((p) => existsSync(join(p, 'src', 'services', 'csv', 'csvReader.ts')));
if (!ROOT) {
  console.log('XX  recorded-bak4-differential: repo-wortel niet gevonden');
  process.exit(1);
}

/** De UIT-mutaties: [bestand (relatief aan src/), zoektekst, vervanging]. Elk moet exact 1× raken. */
const OFF_MUTATIONS: Array<[string, string, string]> = [
  ['services/msproject/mspdiReader.ts',
    '    {\n      const recordedDate = (raw: string): string | undefined =>\n        raw ? (isHour ? parseMSPInstant',
    '    if (false) {\n      const recordedDate = (raw: string): string | undefined =>\n        raw ? (isHour ? parseMSPInstant'],
  ['services/p6/p6xmlReader.ts',
    '    {\n      const recordedDate = (raw: string): string | undefined =>\n        raw ? (isHour ? parseP6Instant',
    '    if (false) {\n      const recordedDate = (raw: string): string | undefined =>\n        raw ? (isHour ? parseP6Instant'],
  ['services/mpp/mppReader.ts',
    '    {\n      const slackDays = (tenths: number | null): number | undefined => {',
    '    if (false) {\n      const slackDays = (tenths: number | null): number | undefined => {'],
  ['services/csv/csvReader.ts',
    '      recorded: buildRecordedTime({',
    '      recorded: undefined && buildRecordedTime({'],
];

type Readers = {
  readCSV: (s: string) => Record<string, unknown>;
  readMSPDI: (s: string) => Record<string, unknown>;
  readP6XML: (s: string) => Record<string, unknown>;
  readMPP: (b: Uint8Array) => Record<string, unknown>;
  installDOMParser: () => void;
};

// esbuild staat in node_modules; een niet-letterlijke specifier houdt hem buiten de checkbundel.
const esbuildName = 'esbuild';
const esbuild = await import(esbuildName) as {
  build(opts: Record<string, unknown>): Promise<{ outputFiles?: unknown[] }>;
};

const workDir = mkdtempSync(join(tmpdir(), 'ops-bak4-'));
async function bundle(variant: 'on' | 'off'): Promise<Readers> {
  const hits = new Map<number, number>();
  const srcRoot = join(ROOT!, 'src');
  const outfile = join(workDir, `readers-${variant}.mjs`);
  await esbuild.build({
    stdin: {
      contents: [
        "export { readCSV } from '@/services/csv/csvReader';",
        "export { readMSPDI } from '@/services/msproject/mspdiReader';",
        "export { readP6XML } from '@/services/p6/p6xmlReader';",
        "export { readMPP } from '@/services/mpp/mppReader';",
        `export { installDOMParser } from ${JSON.stringify(join(ROOT!, 'tests', 'planning', 'xmldom-shim.ts'))};`,
      ].join('\n'),
      resolveDir: ROOT, loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error',
    alias: { '@': srcRoot },
    external: ['react-dom/server'],
    define: {
      'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"', __OPS_DEV_INSTANCE__: '"test"',
    },
    plugins: variant === 'on' ? [] : [{
      name: 'recording-off',
      setup(build: { onLoad(o: { filter: RegExp }, cb: (a: { path: string }) => unknown): void }) {
        build.onLoad({ filter: /[\\/]src[\\/]services[\\/](csv|msproject|p6|mpp)[\\/][A-Za-z0-9]+\.ts$/ }, (args) => {
          const rel = args.path.slice(srcRoot.length + 1).replace(/\\/g, '/');
          const idxs = OFF_MUTATIONS.map((m, i) => (m[0] === rel ? i : -1)).filter((i) => i >= 0);
          if (idxs.length === 0) return undefined;
          let text = readFileSync(args.path, 'utf8');
          for (const i of idxs) {
            const [, from, to] = OFF_MUTATIONS[i];
            hits.set(i, text.split(from).length - 1);
            text = text.split(from).join(to);
          }
          return { contents: text, loader: 'ts' };
        });
      },
    }],
  });
  if (variant === 'off') {
    OFF_MUTATIONS.forEach(([file, from], i) =>
      eq(`0 UIT-mutatie raakt precies één keer: ${file} «${from.split('\n').pop()!.trim().slice(0, 50)}»`, hits.get(i) ?? 0, 1));
  }
  return await import(pathToFileURL(outfile).href) as Readers;
}

const on = await bundle('on');
const off = await bundle('off');
on.installDOMParser();

/** Gegenereerde id's (`prefix-<ts36><rand4><teller>`) en aanmaak-/wijzigtijden gelijktrekken. */
function normalize(result: Record<string, unknown>): string {
  const { recordedTimes: _r, recordedTimesOrigin: _o, ...rest } = result;
  void _r; void _o;
  const ids = new Map<string, string>();
  return JSON.stringify(rest)
    .replace(/"(createdAt|modifiedAt)":"[^"]*"/g, '"$1":"<t>"')
    .replace(/\b([a-z]+)-[0-9a-z]{9,}\b/g, (m, prefix: string) => {
      if (!ids.has(m)) ids.set(m, `${prefix}-#${ids.size}`);
      return ids.get(m)!;
    });
}

type Outcome = { ok: true; text: string; recorded: number } | { ok: false; error: string };
function runBoth(read: (r: Readers) => Record<string, unknown>): { on: Outcome; off: Outcome } {
  const once = (r: Readers): Outcome => {
    try {
      const res = read(r);
      const rec = res.recordedTimes as Record<string, unknown> | undefined;
      return { ok: true, text: normalize(res), recorded: rec ? Object.keys(rec).length : 0 };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  };
  return { on: once(on), off: once(off) };
}

// ── (1) Fixtures — altijd ──────────────────────────────────────────────────────────────────────
const fixtures: Array<[string, (r: Readers) => Record<string, unknown>]> = [
  ['P6 XML-fixture', (r) => r.readP6XML(P6XML_FIXTURE)],
  ['MSPDI-fixture', (r) => r.readMSPDI(MSPDI_FIXTURE)],
  ['CSV-fixture', (r) => r.readCSV(CSV_FIXTURE)],
  ['CSV-fixture (alleen datums)', (r) => r.readCSV(CSV_FIXTURE_DATES_ONLY)],
  ['CSV-fixture (onleesbare datums)', (r) => r.readCSV(CSV_FIXTURE_UNREADABLE_DATES)],
];
for (const [label, read] of fixtures) {
  const { on: a, off: b } = runBoth(read);
  truthy(`1 ${label}: beide varianten lezen`, a.ok && b.ok);
  if (a.ok && b.ok) {
    eq(`1 ${label}: importresultaat AAN = UIT (zonder het vastleggingskanaal)`, a.text === b.text, true);
    if (label !== 'CSV-fixture (onleesbare datums)') truthy(`1 ${label}: AAN legt echt iets vast (anders test dit niets)`, a.recorded > 0);
    eq(`1 ${label}: UIT legt niets vast`, b.recorded, 0);
  }
}

// ── (2) Corpus — optioneel ─────────────────────────────────────────────────────────────────────
const crawl = process.env.OPS_MPP_CRAWL ?? '/home/nozzit/open-aec/voor claude/testdata-crawl';
if (!existsSync(crawl)) {
  console.log('.   recorded-bak4-differential: crawl (OPS_MPP_CRAWL) niet aanwezig — corpuslaag overgeslagen');
} else {
  const list = (dir: string, ext: RegExp): string[] => {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const e of readdirSync(dir).sort()) {
      const f = join(dir, e);
      if (statSync(f).isDirectory()) out.push(...list(f, ext));
      else if (ext.test(e)) out.push(f);
    }
    return out;
  };
  const tally = { files: 0, read: 0, withRecorded: 0, identical: 0, bothFailed: 0 };
  const mismatches: string[] = [];
  const compare = (file: string, read: (r: Readers) => Record<string, unknown>) => {
    tally.files++;
    const { on: a, off: b } = runBoth(read);
    if (!a.ok || !b.ok) {
      if (!a.ok && !b.ok && a.error === b.error) { tally.bothFailed++; return; }
      mismatches.push(`${file.slice(crawl.length)}: leesuitkomst verschilt (${a.ok ? 'ok' : a.error} / ${b.ok ? 'ok' : b.error})`);
      return;
    }
    tally.read++;
    if (a.recorded > 0) tally.withRecorded++;
    if (a.text === b.text) tally.identical++;
    else mismatches.push(`${file.slice(crawl.length)}: importresultaat AAN ≠ UIT`);
  };
  for (const f of list(crawl, /\.mpp$/i)) {
    const bytes = new Uint8Array(readFileSync(f));
    compare(f, (r) => r.readMPP(bytes));
  }
  for (const dir of ['crawl-mspdi', 'crawl-pmxml', 'pmxml-samples']) {
    for (const f of list(join(crawl, dir), /\.xml$/i)) {
      const text = readFileSync(f, 'utf8');
      const isP6 = text.includes('<APIBusinessObjects');
      compare(f, (r) => (isP6 ? r.readP6XML(text) : r.readMSPDI(text)));
    }
  }
  console.log(`.   recorded-bak4-differential corpus: ${tally.files} bestanden, ${tally.read} gelezen (${tally.withRecorded} met vastlegging), ${tally.identical} byte-identiek, ${tally.bothFailed} in beide varianten gelijk geweigerd, ${mismatches.length} afwijkend`);
  truthy('2a het corpus levert gelezen bestanden mét vastlegging op (anders test dit niets)', tally.withRecorded > 0);
  eq('2b élk gelezen corpusbestand: importresultaat AAN = UIT', mismatches.slice(0, 10), []);
}

rmSync(workDir, { recursive: true, force: true });
if (diffs.length === 0) {
  console.log(`OK  recorded-bak4-differential: ${checks} checks groen`);
  process.exit(0);
}
console.log(`XX  recorded-bak4-differential: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
