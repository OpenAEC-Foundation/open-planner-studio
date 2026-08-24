import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseXerTables } from '@/services/xer/xerTables';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function summary(root: string, label: string): unknown {
  try {
    const parsed = parseXerTables(new Uint8Array(readFileSync(join(root, label))));
    return {
      encoding: parsed.report.encoding,
      tables: Object.fromEntries([...parsed.tables].map(([name, table]) => [name, table.rows.length])),
      issues: parsed.report.issues,
      unknownTables: parsed.report.unknownTables,
    };
  } catch (error) {
    const typed = error as {
      name?: string;
      xerCode?: string;
      table?: string;
      missingColumns?: string[];
      missingValues?: string[];
      line?: number;
    };
    return {
      name: typed.name,
      xerCode: typed.xerCode,
      ...(typed.table ? { table: typed.table } : {}),
      ...(typed.missingColumns ? { missingColumns: typed.missingColumns } : {}),
      ...(typed.missingValues ? { missingValues: typed.missingValues } : {}),
      ...(typed.line ? { line: typed.line } : {}),
    };
  }
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  xer-corpus: corpus niet aanwezig (OPS_XER_CORPUS) — corpuspoort overgeslagen');
} else if (!existsSync(root)) {
  diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
} else {
  eq('K1 kedular-empty-schedule', summary(root, 'crawl-xer/kedular-empty-schedule.xer'), {
    encoding: 'utf-8', tables: { PROJECT: 1 }, issues: [], unknownTables: [],
  });
  eq('K2 kedular-field-mismatch', summary(root, 'crawl-xer/kedular-field-mismatch.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, TASK: 2 },
    issues: [{ code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 7, table: 'TASK', expected: 13, actual: 7 }],
    unknownTables: [],
  });
  eq('K3 kedular-minimal-valid', summary(root, 'crawl-xer/kedular-minimal-valid.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, CALENDAR: 1, PROJWBS: 2, TASK: 2, TASKPRED: 1 },
    issues: [], unknownTables: [],
  });
  eq('K4 kedular-missing-calendar', summary(root, 'crawl-xer/kedular-missing-calendar.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, PROJWBS: 1, TASK: 1, TASKPRED: 1 },
    issues: [], unknownTables: [],
  });
  eq('K5 kedular-missing-taskpred', summary(root, 'crawl-xer/kedular-missing-taskpred.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, CALENDAR: 1, PROJWBS: 1, TASK: 2 },
    issues: [], unknownTables: [],
  });
  eq('K6 kedular-multi-project', summary(root, 'crawl-xer/kedular-multi-project.xer'), {
    encoding: 'utf-8', tables: { PROJECT: 2, TASK: 2 }, issues: [], unknownTables: [],
  });
  eq('K7 kedular-no-terminator', summary(root, 'crawl-xer/kedular-no-terminator.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, CALENDAR: 1, PROJWBS: 2, TASK: 2, TASKPRED: 1 },
    issues: [{ code: 'XER_MISSING_END_MARKER', line: 19 }], unknownTables: [],
  });
  eq('K8 kedular-unknown-tables', summary(root, 'crawl-xer/kedular-unknown-tables.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1, CALENDAR: 1, PROJWBS: 2, TASK: 2, TASKPRED: 1, SCHEDOPTIONS: 1 },
    issues: [],
    unknownTables: [{ name: 'FINTMPL', rows: 1 }, { name: 'POBS', rows: 1 }],
  });

  eq('R1 DROID-skelet', summary(root, 'crawl-xer/droid_skeleton_fmt-1455.xer'), {
    name: 'XerImportError', xerCode: 'XER_INVALID_FILE',
  });
  eq('R2 p6xer-basic', summary(root, 'crawl-xer/p6xer-basic.xer'), {
    name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASK',
    missingColumns: ['proj_id', 'task_code'],
  });
  eq('R3 p6xer-comprehensive', summary(root, 'crawl-xer/p6xer-comprehensive.xer'), {
    encoding: 'utf-8',
    tables: { PROJECT: 1 },
    issues: [
      { code: 'XER_UNKNOWN_RECORD', line: 2 },
      { code: 'XER_UNKNOWN_RECORD', line: 3 },
      { code: 'XER_TRAILING_RECORDS_AFTER_END', line: 9, ignoredRecords: 44, ignoredLines: 51 },
    ],
    unknownTables: [],
  });
  eq('R4 p6xer-empty_tables', summary(root, 'crawl-xer/p6xer-empty_tables.xer'), {
    encoding: 'utf-8',
    tables: {},
    issues: [
      { code: 'XER_UNKNOWN_RECORD', line: 2 },
      { code: 'XER_TRAILING_RECORDS_AFTER_END', line: 7, ignoredRecords: 7, ignoredLines: 9 },
    ],
    unknownTables: [{ name: 'EMPTY_TABLE1', rows: 0 }],
  });
  eq('R5 p6xer-malformed', summary(root, 'crawl-xer/p6xer-malformed.xer'), {
    encoding: 'utf-8',
    tables: {},
    issues: [{ code: 'XER_TRAILING_RECORDS_AFTER_END', line: 8, ignoredRecords: 35, ignoredLines: 42 }],
    unknownTables: [{ name: 'ERMHDR', rows: 1 }],
  });
  eq('R6 p6xer-encodings blijft geldige UTF-8 met onbekende tabellen',
    summary(root, 'crawl-xer/p6xer-encodings.xer'), {
      encoding: 'utf-8',
      tables: {},
      issues: [{
        code: 'XER_TRAILING_RECORDS_AFTER_END',
        line: 11,
        ignoredRecords: 21,
        ignoredLines: 24,
      }],
      unknownTables: [
        { name: 'SPECIAL_CHARS', rows: 5 },
      ],
    });
  eq('R7 p6xer-mixed_endings wordt als onbekend dialect gerapporteerd',
    summary(root, 'crawl-xer/p6xer-mixed_endings.xer'), {
      encoding: 'utf-8',
      tables: {},
      issues: [],
      unknownTables: [{ name: 'TASK\\R\\N', rows: 2 }],
    });

  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, 'xer-corpus-manifest.json'), 'utf8')) as {
    files: Record<string, { role: string; sha256: string }>;
  };
  const noteAnchors = [
    '2bc12241c3f8ee5b7472dd0e77f2cbffafcf3b5438b17022fd9db4f4c642d4b0',
    'b9547eb91c30af1750933a64409d8b2a4a2c1dbe4c0be276a04ab150c8a50167',
  ].map(hash => {
    const label = Object.entries(manifest.files).find(([, entry]) => entry.sha256 === hash)?.[0];
    if (!label) return { hash, missing: true };
    const bytes = new Uint8Array(readFileSync(join(root, label)));
    const parsed = parseXerTables(bytes);
    const wbs = parsed.tables.get('WBSMEMO')?.rows.map(row => row.cells.wbs_memo ?? '') ?? [];
    const task = parsed.tables.get('TASKMEMO')?.rows.map(row => row.cells.task_memo ?? '') ?? [];
    return {
      hash: createHash('sha256').update(bytes).digest('hex'),
      wbsRows: wbs.length,
      taskRows: task.length,
      contaminated: [...wbs, ...task].filter(value => /[\u0000\uFEFF\uFFFE]|\u007f\u007f/.test(value)).length,
    };
  });
  // Breuk die dit vangt: alleen de synthetische notitiefixture herstellen. De openbare dragers
  // worden uitsluitend via inhoudshash aangewezen; corpusnamen of bedrijfsnamen horen niet hier.
  eq('R8 twee inhoudshash-ankers hebben schone echte WBS-/TASK-notities', noteAnchors, [
    {
      hash: '2bc12241c3f8ee5b7472dd0e77f2cbffafcf3b5438b17022fd9db4f4c642d4b0',
      wbsRows: 15,
      taskRows: 15,
      contaminated: 0,
    },
    {
      hash: 'b9547eb91c30af1750933a64409d8b2a4a2c1dbe4c0be276a04ab150c8a50167',
      wbsRows: 2,
      taskRows: 4,
      contaminated: 0,
    },
  ]);
  const anonymousIdentityHash = 'b8bc3cb30463c99c2255c5bd243888ac2706b7f6a1bfe31e242407a24f002dcf';
  const anonymousIdentityLabel = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === anonymousIdentityHash)?.[0];
  eq('R9 anonieme pseudo-XER-drager wordt via inhoudshash op lege identiteit afgewezen',
    anonymousIdentityLabel ? summary(root, anonymousIdentityLabel) : { missing: true }, {
      name: 'XerImportError',
      xerCode: 'XER_MISSING_REQUIRED_VALUE',
      table: 'PROJECT',
      missingValues: ['proj_id'],
      line: 11,
    });
  const missingCurrencyHash = '4d8bce790a93b9bc747abec5d99840e3e0d1ce5523e0afae3ba881762cfe2c13';
  const missingCurrencyLabel = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === missingCurrencyHash)?.[0];
  let missingCurrencyOutcome: unknown = { missing: true };
  if (missingCurrencyLabel) {
    const bytes = new Uint8Array(readFileSync(join(root, missingCurrencyLabel)));
    const parsed = parseXerTables(bytes);
    missingCurrencyOutcome = {
      hash: createHash('sha256').update(bytes).digest('hex'),
      format: parsed.numberFormat,
      currencyIssues: parsed.report.issues.filter(issue => issue.code === 'XER_CURRENCY_NOT_FOUND'),
    };
  }
  eq('R10 valutamismatch-anker kiest nooit stil de eerste CURRTYPE-rij', missingCurrencyOutcome, {
    hash: missingCurrencyHash,
    format: { decimal: '.', group: null, source: 'default', currencyCode: 'EP' },
    currencyIssues: [{ code: 'XER_CURRENCY_NOT_FOUND', line: 1, table: 'CURRTYPE', currencyCode: 'EP' }],
  });
  const largeCorpusHash = '2c1dce175b9f078111a48dc13fd1777f5fbd4cd7ab6623e647e7437330c60b7f';
  const largeCorpusLabel = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === largeCorpusHash)?.[0];
  let largeCorpusOutcome: unknown = { missing: true };
  if (largeCorpusLabel) {
    const bytes = new Uint8Array(readFileSync(join(root, largeCorpusLabel)));
    const started = performance.now();
    const parsed = parseXerTables(bytes);
    const elapsedMs = performance.now() - started;
    const rows = [...parsed.tables.values()].reduce((sum, table) => sum + table.rows.length, 0);
    largeCorpusOutcome = {
      hash: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      rows,
      withinGenerousBudget: elapsedMs < 15_000,
    };
    console.log(
      `.   xer-large: hash=${largeCorpusHash.slice(0, 16)}, bytes=${bytes.length}, `
      + `rows=${rows}, elapsedMs=${elapsedMs.toFixed(1)}`,
    );
  }
  // Capaciteitscontract X2-R3: geen arbitraire groottecap. De tijdgrens is ruim boven de verse
  // lokale meting en bewaakt alleen een catastrofale regressie; browsergeheugen blijft X11.
  eq('R11 grootste inhoudshash blijft zonder file-size-cap binnen royaal tijdplafond', largeCorpusOutcome, {
    hash: largeCorpusHash,
    bytes: 18_592_333,
    rows: 163_628,
    withinGenerousBudget: true,
  });
  const trailingLinesHash = 'a303595f1def90620cb7da693e7217f364dd66bbc3b3775de5ae93106fa504e4';
  const trailingLinesLabel = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === trailingLinesHash)?.[0];
  let trailingLinesOutcome: unknown = { missing: true };
  if (trailingLinesLabel) {
    const bytes = new Uint8Array(readFileSync(join(root, trailingLinesLabel)));
    const parsed = parseXerTables(bytes);
    trailingLinesOutcome = {
      hash: createHash('sha256').update(bytes).digest('hex'),
      issue: parsed.report.issues.find(issue => issue.code === 'XER_TRAILING_RECORDS_AFTER_END'),
    };
  }
  // Breuk die dit vangt: alleen synthetische LF-fixtures corrigeren en de echte afsluitende
  // newline in het openbare bestand als extra fysieke staartregel blijven tellen.
  eq('R12 inhoudshash-anker telt de genegeerde staart fysiek', trailingLinesOutcome, {
    hash: trailingLinesHash,
    issue: {
      code: 'XER_TRAILING_RECORDS_AFTER_END',
      line: 6,
      ignoredRecords: 21,
      ignoredLines: 21,
    },
  });
  const aggregate = {
    files: 0,
    ok: 0,
    oracleOk: 0,
    oracleErrors: 0,
    referenceOk: 0,
    referenceErrors: 0,
    encodings: {} as Record<string, number>,
    errors: {} as Record<string, number>,
    issues: {} as Record<string, number>,
    unknownTables: 0,
    unknownRows: 0,
  };
  for (const [label, entry] of Object.entries(manifest.files)) {
    aggregate.files++;
    try {
      const parsed = parseXerTables(new Uint8Array(readFileSync(join(root, label))));
      aggregate.ok++;
      if (entry.role === 'oracle') aggregate.oracleOk++;
      if (entry.role === 'reference-only') aggregate.referenceOk++;
      aggregate.encodings[parsed.report.encoding] = (aggregate.encodings[parsed.report.encoding] ?? 0) + 1;
      aggregate.unknownTables += parsed.report.unknownTables.length;
      aggregate.unknownRows += parsed.report.unknownTables.reduce((sum, table) => sum + table.rows, 0);
      for (const issue of parsed.report.issues) {
        aggregate.issues[issue.code] = (aggregate.issues[issue.code] ?? 0) + 1;
      }
    } catch (error) {
      const code = (error as { xerCode?: string }).xerCode ?? (error as Error).name;
      aggregate.errors[code] = (aggregate.errors[code] ?? 0) + 1;
      if (entry.role === 'oracle') aggregate.oracleErrors++;
      if (entry.role === 'reference-only') aggregate.referenceErrors++;
    }
  }
  eq('C1 volledige manifestcrawl heeft concrete parser-/rapporttellingen', aggregate, {
    files: 93,
    ok: 71,
    oracleOk: 45,
    oracleErrors: 0,
    referenceOk: 1,
    referenceErrors: 0,
    encodings: { 'utf-8': 60, 'windows-1252': 11 },
    errors: { XER_MISSING_REQUIRED_COLUMNS: 19, XER_INVALID_FILE: 2, XER_MISSING_REQUIRED_VALUE: 1 },
    issues: {
      XER_MISSING_END_MARKER: 6,
      XER_UNKNOWN_RECORD: 67,
      XER_ROW_FIELD_COUNT_MISMATCH: 114,
      XER_TRAILING_RECORDS_AFTER_END: 5,
      XER_CURRENCY_NOT_FOUND: 2,
    },
    unknownTables: 60,
    unknownRows: 914,
  });
}

if (diffs.length === 0) {
  console.log(`OK  xer-corpus: ${checks} checks groen`);
} else {
  console.log(`XX  xer-corpus: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
