import { parseXerNumber, parseXerTables } from '@/services/xer/xerTables';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function utf8(lines: readonly string[], newline = '\n'): Uint8Array {
  return new TextEncoder().encode(lines.join(newline));
}

function withPrefix(prefix: readonly number[], bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(prefix.length + bytes.length);
  result.set(prefix);
  result.set(bytes, prefix.length);
  return result;
}

function utf16(text: string, bigEndian: boolean): Uint8Array {
  const result = new Uint8Array(2 + text.length * 2);
  result[0] = bigEndian ? 0xfe : 0xff;
  result[1] = bigEndian ? 0xff : 0xfe;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    result[2 + index * 2] = bigEndian ? code >> 8 : code & 0xff;
    result[3 + index * 2] = bigEndian ? code & 0xff : code >> 8;
  }
  return result;
}

function windows1252(text: string): Uint8Array {
  return Uint8Array.from([...text].map(char => char.charCodeAt(0)));
}

function encodingOutcome(bytes: Uint8Array): Record<string, unknown> {
  try {
    const parsed = parseXerTables(bytes);
    return {
      encoding: parsed.report.encoding,
      name: parsed.tables.get('PROJECT')?.rows[0]?.cells.proj_name,
    };
  } catch (error) {
    return { error: (error as Error).name };
  }
}

function numberOutcome(raw: string, parsed: ReturnType<typeof parseXerTables>): unknown {
  return parseXerNumber(raw, parsed.numberFormat);
}

function caughtXerError(run: () => unknown): Record<string, unknown> | null {
  try {
    run();
    return null;
  } catch (error) {
    const typed = error as {
      name?: string;
      xerCode?: string;
      table?: string;
      missingColumns?: string[];
    };
    return {
      name: typed.name,
      xerCode: typed.xerCode,
      ...(typed.table ? { table: typed.table } : {}),
      ...(typed.missingColumns ? { missingColumns: typed.missingColumns } : {}),
    };
  }
}

// Breuk die dit vangt: ERMHDR als gewone tabel behandelen, het negende veld verkeerd indexeren,
// of de %T/%F/%R-markers niet als afzonderlijke grammaticale records verwerken.
const basic = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tProject Management\tEUR',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\tstatus_code',
  '%R\tP1\t1\tA1000\ttK_Active',
  '%E',
]));
eq('1 ERMHDR en basisgrammatica', {
  version: basic.header.version,
  defaultCurrencyCode: basic.header.defaultCurrencyCode,
  encoding: basic.report.encoding,
  ended: basic.report.endMarkerSeen,
  fields: basic.tables.get('TASK')?.fields,
  row: basic.tables.get('TASK')?.rows[0]?.cells,
}, {
  version: '23.12',
  defaultCurrencyCode: 'EUR',
  encoding: 'utf-8',
  ended: true,
  fields: ['proj_id', 'task_id', 'task_code', 'status_code'],
  row: { proj_id: 'P1', task_id: '1', task_code: 'A1000', status_code: 'tK_Active' },
});

// Breuk die dit vangt: alleen LF accepteren of EOF zonder %E stil als volledig bestand behandelen.
const noTerminator = parseXerTables(utf8([
  'ERMHDR\t19.12',
  '%T\tPROJECT',
  '%F\tproj_id',
  '%R\tP1',
], '\r\n'));
eq('2 CRLF en ontbrekende %E worden afzonderlijk verwerkt', {
  project: noTerminator.tables.get('PROJECT')?.rows[0]?.cells,
  endMarkerSeen: noTerminator.report.endMarkerSeen,
  issues: noTerminator.report.issues.map(issue => issue.code),
}, {
  project: { proj_id: 'P1' },
  endMarkerSeen: false,
  issues: ['XER_MISSING_END_MARKER'],
});

// Breuk die dit vangt: CSV-achtige algemene quote-escaping invoeren, XER's dubbele quotes niet
// terugbrengen, of de betekenisvolle lege kolomnaam na een afsluitende %F-tab wegtrimmen.
const quotesAndTrailingField = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttask_name\t',
  '%R\tP1\t1\tA1000\tBuis 1"" staal\textra',
  '%E',
]));
eq('3 quotes en lege laatste kolomnaam', {
  fields: quotesAndTrailingField.tables.get('TASK')?.fields,
  row: quotesAndTrailingField.tables.get('TASK')?.rows[0]?.cells,
}, {
  fields: ['proj_id', 'task_id', 'task_code', 'task_name', ''],
  row: { proj_id: 'P1', task_id: '1', task_code: 'A1000', task_name: 'Buis 1" staal', '': 'extra' },
});

// Breuk die dit vangt: te korte/lange rijen stil accepteren of na één kapotte rij de hele import
// afbreken, terwijl de betrouwbare kolommen en volgende rijen nog leesbaar zijn.
const mismatchedRows = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code',
  '%R\tP1\t1',
  '%R\tP1\t2\tA2\textra',
  '%R\tP1\t3\tA3',
  '%E',
]));
eq('4 veld-/waardetellingsverschil wordt verzameld en vervolgd', {
  rows: mismatchedRows.tables.get('TASK')?.rows.map(row => row.cells),
  issues: mismatchedRows.report.issues,
}, {
  rows: [
    { proj_id: 'P1', task_id: '1', task_code: '' },
    { proj_id: 'P1', task_id: '2', task_code: 'A2' },
    { proj_id: 'P1', task_id: '3', task_code: 'A3' },
  ],
  issues: [
    { code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 4, table: 'TASK', expected: 3, actual: 2 },
    { code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 5, table: 'TASK', expected: 3, actual: 4 },
  ],
});

// Breuk die dit vangt: een lege eerste token als onbekend record weggooien, DEL-DEL in notities
// laten staan, of de BOM/NUL-vervuiling uit MPXJ's NotesHelper-gevallen doorgeven aan de gebruiker.
const multilineNote = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttask_name\ttask_notes',
  `%R\tP1\t1\tA1\tTaak\tBegin\u007f\u007fmidden\u0000\ufeff`,
  '\t\t\t\t\teinde',
  '%E',
]));
eq('5 DEL-DEL-notitie, BOM/NUL-strip en lege-token-continuatie', {
  rows: multilineNote.tables.get('TASK')?.rows.length,
  note: multilineNote.tables.get('TASK')?.rows[0]?.cells.task_notes,
  issues: multilineNote.report.issues,
}, {
  rows: 1,
  note: 'Begin\nmidden\neinde',
  issues: [],
});

// Breuk die dit vangt: verzonnen/toekomstige tabellen in het resultaat toelaten of stil overslaan
// zonder naam en rijtelling voor het importverslag te bewaren.
const unknownTable = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tSPECIAL_CHARS',
  '%F\tid\tdescription',
  '%R\t1\tcafé',
  '%R\t2\tproject',
  '%T\tPROJECT',
  '%F\tproj_id',
  '%R\tP1',
  '%E',
]));
eq('6 onbekende tabellen worden overgeslagen en geteld', {
  tables: [...unknownTable.tables.keys()],
  unknown: unknownTable.report.unknownTables,
}, {
  tables: ['PROJECT'],
  unknown: [{ name: 'SPECIAL_CHARS', rows: 2 }],
});

// Breuk die dit vangt: de 8-byte DROID-signatuur als leeg maar geldig XER-project accepteren.
eq('7 een ERMHDR-skelet zonder versie is een getypeerde bestandsfout',
  caughtXerError(() => parseXerTables(utf8(['ERMHDR'], '\r\n'))), {
    name: 'XerImportError',
    xerCode: 'XER_INVALID_FILE',
  });

// Breuk die dit vangt: pseudo-XER met herkenbare tabelnamen maar niet-P6-kolommen als een leeg,
// zogenaamd geldig project doorlaten. Dit is tevens de verplichte kolomcontrole-mutatiefixture.
eq('8 TASK zonder verplichte P6-kolommen is getypeerd fataal', caughtXerError(() =>
  parseXerTables(utf8([
    'ERMHDR\t24.8\t2024-09-08\tProject\ttest\tuser\tDB\tCloud\tUSD',
    '%T\tTASK',
    '%F\tTask_ID\tTask_Name\tStart_Date\tDuration\tStatus',
    '%R\t1000\tTask 1\t2024-01-01\t5d\tNot Started',
    '%E',
  ]))), {
  name: 'XerImportError',
  xerCode: 'XER_MISSING_REQUIRED_COLUMNS',
  table: 'TASK',
  missingColumns: ['proj_id', 'task_code'],
});

const encodingText = [
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_name',
  '%R\tP1\tCafé',
  '%E',
].join('\n');
// Breuk die dit vangt: de BOM negeren, alleen een prefix als UTF-8 testen, of CP1252 kiezen
// zonder eerst het volledige BOM-loze bestand fataal als UTF-8 te valideren.
eq('9 BOM, volledig UTF-8 en Windows-1252 kiezen de gerapporteerde encoding', [
  encodingOutcome(withPrefix([0xef, 0xbb, 0xbf], new TextEncoder().encode(encodingText))),
  encodingOutcome(utf16(encodingText, false)),
  encodingOutcome(utf16(encodingText, true)),
  encodingOutcome(new TextEncoder().encode(encodingText)),
  encodingOutcome(windows1252(encodingText)),
], [
  { encoding: 'utf-8', name: 'Café' },
  { encoding: 'utf-16le', name: 'Café' },
  { encoding: 'utf-16be', name: 'Café' },
  { encoding: 'utf-8', name: 'Café' },
  { encoding: 'windows-1252', name: 'Café' },
]);

// Breuk die dit vangt: CURRTYPE alleen gebruiken wanneer die vóór TASK staat, of de eerste valuta
// kiezen in plaats van ERMHDR veld 9. De kommawaarde blijft hier bewust nog een rauwe token.
const commaCurrency = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEUR',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttarget_drtn_hr_cnt',
  '%R\tP1\t1\tA1\t1.234,5',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
  '%R\tUSD\t.\t,',
  '%R\tEUR\t,\t.',
  '%E',
]));
eq('10 CURRTYPE wordt in een tweede pas op de defaultvaluta bepaald', {
  format: commaCurrency.numberFormat,
  raw: commaCurrency.tables.get('TASK')?.rows[0]?.cells.target_drtn_hr_cnt,
}, {
  format: { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' },
  raw: '1.234,5',
});

const symbolicCurrency = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEUR',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol_type\tdigit_group_symbol_type',
  '%R\tEUR\tds_Comma\tdg_Period',
  '%E',
]));
const defaultPoint = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id',
  '%R\tP1',
  '%E',
]));
// Breuk die dit vangt: symbolische separators als letterlijke tekst behandelen, of Number/parseFloat
// direct op localegetallen toepassen. Dezelfde parser wordt later door alle numerieke velden gebruikt.
eq('11 symbolische CURRTYPE-tokens en de getalparser', {
  format: symbolicCurrency.numberFormat,
  comma: numberOutcome('1.234,5', symbolicCurrency),
  defaultFormat: defaultPoint.numberFormat,
  point: numberOutcome('-12.5', defaultPoint),
  empty: numberOutcome('', defaultPoint),
  invalid: caughtXerError(() => parseXerNumber('12,5', defaultPoint.numberFormat)),
}, {
  format: { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' },
  comma: 1234.5,
  defaultFormat: { decimal: '.', group: null, source: 'default', currencyCode: '' },
  point: -12.5,
  empty: null,
  invalid: { name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER' },
});

const noCurrencyComma = utf8([
  'ERMHDR\t23.12',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt',
  '%R\tP1\t1\tA1\tNaam, met komma\t1,5',
  '%E',
]);
// Breuk die dit vangt: zonder CURRTYPE stil punt-decimaal aannemen terwijl een numeriek P6-veld
// aantoonbaar komma-decimaal is. Een komma in gewone tekst is juist geen bewijs.
eq('12 komma-decimaal zonder CURRTYPE wordt getypeerd geweigerd',
  caughtXerError(() => parseXerTables(noCurrencyComma)), {
    name: 'XerImportError',
    xerCode: 'XER_AMBIGUOUS_DECIMAL',
  });

function currencyOnly(decimal: string, group: string): Uint8Array {
  return utf8([
    'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEUR',
    '%T\tCURRTYPE',
    '%F\tcurr_short_name\tdecimal_symbol_type\tdigit_group_symbol_type',
    `%R\tEUR\t${decimal}\t${group}`,
    '%E',
  ]);
}

// Breuk die dit vangt: onbekende CURRTYPE-symbolen of hetzelfde decimaal-/groepsteken stil naar
// punt/default terug laten vallen en daarmee geldwaarden verkeerd interpreteren.
eq('13 onbruikbare CURRTYPE-notatie is getypeerd fataal', [
  caughtXerError(() => parseXerTables(currencyOnly('ds_Unknown', 'dg_Period'))),
  caughtXerError(() => parseXerTables(currencyOnly('ds_Comma', 'dg_Comma'))),
], [
  { name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT' },
  { name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT' },
]);

// Breuk die dit vangt: grammaticaal kapotte rijen stil overslaan. Elk probleem blijft zichtbaar
// met regel en tabel, terwijl de nog betrouwbaar leesbare PROJECT-rij behouden blijft.
const brokenGrammar = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%R\tdata-zonder-velden',
  '\twees-continuatie',
  '%F\tproj_id\tproj_id',
  '%R\tP1\tP2',
  '%Q\tonbekend-record',
  '%E',
]));
eq('14 onbetrouwbare grammaticarijen worden concreet gerapporteerd', brokenGrammar.report.issues, [
  { code: 'XER_DATA_WITHOUT_FIELDS', line: 3, table: 'PROJECT' },
  { code: 'XER_ORPHAN_CONTINUATION', line: 4, table: 'PROJECT' },
  { code: 'XER_DUPLICATE_FIELD', line: 5, table: 'PROJECT', field: 'proj_id' },
  { code: 'XER_UNKNOWN_RECORD', line: 7, table: 'PROJECT' },
]);

function missingColumns(table: string, fields: string): Record<string, unknown> | null {
  return caughtXerError(() => parseXerTables(utf8([
    'ERMHDR\t23.12',
    `%T\t${table}`,
    `%F\t${fields}`,
    '%E',
  ])));
}

// Breuk die dit vangt: alleen TASK beveiligen en andere aanwezige P6-kern-/koppeltabellen zonder
// hun identiteitssleutels als bruikbaar doorgeven aan X3/X4a.
eq('15 verplichte sleutelkolommen gelden per aanwezige P6-kern-/koppeltabel', [
  missingColumns('PROJECT', 'proj_name'),
  missingColumns('CALENDAR', 'clndr_name'),
  missingColumns('PROJWBS', 'wbs_id\twbs_name'),
  missingColumns('TASKPRED', 'task_id\tpred_task_id'),
  missingColumns('RSRC', 'rsrc_name'),
  missingColumns('TASKRSRC', 'task_id'),
], [
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'PROJECT', missingColumns: ['proj_id'] },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'CALENDAR', missingColumns: ['clndr_id'] },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'PROJWBS', missingColumns: ['proj_id'] },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASKPRED', missingColumns: ['pred_type'] },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'RSRC', missingColumns: ['rsrc_id'] },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_COLUMNS', table: 'TASKRSRC', missingColumns: ['rsrc_id'] },
]);

if (diffs.length === 0) {
  console.log(`OK  xer-tables: ${checks} checks groen`);
} else {
  console.log(`XX  xer-tables: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
