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
    const typed = error as { name?: string; xerCode?: string; table?: string; missingColumns?: string[] };
    return {
      name: typed.name,
      xerCode: typed.xerCode,
      ...(typed.table ? { table: typed.table } : {}),
      ...(typed.missingColumns ? { missingColumns: typed.missingColumns } : {}),
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
    name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASK',
    missingColumns: ['proj_id'],
  });
  eq('R4 p6xer-empty_tables', summary(root, 'crawl-xer/p6xer-empty_tables.xer'), {
    name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASK',
    missingColumns: ['proj_id', 'task_code'],
  });
  eq('R5 p6xer-malformed', summary(root, 'crawl-xer/p6xer-malformed.xer'), {
    name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASK',
    missingColumns: ['proj_id', 'task_code'],
  });
  eq('R6 p6xer-encodings blijft geldige UTF-8 met onbekende tabellen',
    summary(root, 'crawl-xer/p6xer-encodings.xer'), {
      encoding: 'utf-8',
      tables: {},
      issues: [],
      unknownTables: [
        { name: 'SPECIAL_CHARS', rows: 5 },
        { name: 'MIXED_ENCODINGS', rows: 4 },
        { name: 'EXTENDED_ASCII', rows: 5 },
        { name: 'CONTROL_CHARS', rows: 3 },
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
    files: Record<string, { role: string }>;
  };
  const aggregate = {
    files: 0,
    ok: 0,
    oracleOk: 0,
    oracleErrors: 0,
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
    }
  }
  eq('C1 volledige manifestcrawl heeft concrete parser-/rapporttellingen', aggregate, {
    files: 93,
    ok: 69,
    oracleOk: 45,
    oracleErrors: 0,
    encodings: { 'utf-8': 58, 'windows-1252': 11 },
    errors: { XER_MISSING_REQUIRED_COLUMNS: 22, XER_INVALID_FILE: 2 },
    issues: {
      XER_MISSING_END_MARKER: 6,
      XER_UNKNOWN_RECORD: 82,
      XER_ROW_FIELD_COUNT_MISMATCH: 114,
    },
    unknownTables: 62,
    unknownRows: 926,
  });
}

if (diffs.length === 0) {
  console.log(`OK  xer-corpus: ${checks} checks groen`);
} else {
  console.log(`XX  xer-corpus: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
