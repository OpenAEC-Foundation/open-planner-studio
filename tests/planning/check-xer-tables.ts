import {
  parseXerNumber,
  parseXerTables,
  XER_TRANSPORT_KIND,
  type XerByteInput,
} from '@/services/xer/xerTables';

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
      missingValues?: string[];
      line?: number;
      lines?: number[];
      encoding?: string;
    };
    return {
      name: typed.name,
      xerCode: typed.xerCode,
      ...(typed.table ? { table: typed.table } : {}),
      ...(typed.missingColumns ? { missingColumns: typed.missingColumns } : {}),
      ...(typed.missingValues ? { missingValues: typed.missingValues } : {}),
      ...(typed.line ? { line: typed.line } : {}),
      ...(typed.lines ? { lines: typed.lines } : {}),
      ...(typed.encoding ? { encoding: typed.encoding } : {}),
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
  '%F\tproj_id\ttask_id\ttask_code\ttask_name',
  '%R\tP1\t1\tA1',
  '%R\tP1\t2\tA2\tNaam\textra',
  '%R\tP1\t3\tA3\tNaam',
  '%E',
]));
eq('4 veld-/waardetellingsverschil wordt verzameld en vervolgd', {
  rows: mismatchedRows.tables.get('TASK')?.rows.map(row => row.cells),
  issues: mismatchedRows.report.issues,
}, {
  rows: [
    { proj_id: 'P1', task_id: '1', task_code: 'A1', task_name: '' },
    { proj_id: 'P1', task_id: '2', task_code: 'A2', task_name: 'Naam' },
    { proj_id: 'P1', task_id: '3', task_code: 'A3', task_name: 'Naam' },
  ],
  issues: [
    { code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 4, table: 'TASK', expected: 4, actual: 3 },
    { code: 'XER_ROW_FIELD_COUNT_MISMATCH', line: 5, table: 'TASK', expected: 4, actual: 5 },
  ],
});

// Breuk die dit vangt: een lege eerste token als onbekend record weggooien, DEL-DEL in notities
// laten staan, of de BOM/NUL-vervuiling uit MPXJ's NotesHelper-gevallen doorgeven aan de gebruiker.
const multilineNote = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASKMEMO',
  '%F\ttask_id\ttask_memo',
  `%R\t1\tBegin\u007f\u007fmidden\u0000\ufeff`,
  '\t\teinde',
  '%E',
]));
eq('5 DEL-DEL-notitie, BOM/NUL-strip en lege-token-continuatie', {
  rows: multilineNote.tables.get('TASKMEMO')?.rows.length,
  note: multilineNote.tables.get('TASKMEMO')?.rows[0]?.cells.task_memo,
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
  { name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT', table: 'CURRTYPE', line: 4, lines: [4] },
  { name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT', table: 'CURRTYPE', line: 4, lines: [4] },
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

const bytesOnlyParser: (input: XerByteInput) => ReturnType<typeof parseXerTables> = parseXerTables;
void bytesOnlyParser;
if (false) {
  // @ts-expect-error XER mag nooit via een reeds gedecodeerde string de parser in.
  parseXerTables('ERMHDR\t23.12');
}
const cp1252TransportFixture = windows1252([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_name',
  '%R\tP1\tPrijs \u0080',
  '%E',
].join('\n'));
const directCp1252 = parseXerTables(cp1252TransportFixture);
const reencodedCp1252 = parseXerTables(new TextEncoder().encode(
  new TextDecoder().decode(cp1252TransportFixture),
));
// Breuk die dit vangt: XER in de registry als tekst transporteren, of de runtimegrens een string
// laten aanvaarden. De CP1252-euro wordt via string onomkeerbaar U+FFFD en daarna vals als UTF-8.
eq('16 XER-consumercontract is uitsluitend ruwe bytes', {
  transportKind: XER_TRANSPORT_KIND,
  stringInput: caughtXerError(() => parseXerTables('ERMHDR\t23.12' as unknown as XerByteInput)),
  direct: {
    encoding: directCp1252.report.encoding,
    name: directCp1252.tables.get('PROJECT')?.rows[0]?.cells.proj_name,
  },
  reencoded: {
    encoding: reencodedCp1252.report.encoding,
    name: reencodedCp1252.tables.get('PROJECT')?.rows[0]?.cells.proj_name,
  },
}, {
  transportKind: 'binary',
  stringInput: { name: 'XerImportError', xerCode: 'XER_INVALID_INPUT' },
  direct: { encoding: 'windows-1252', name: 'Prijs €' },
  reencoded: { encoding: 'utf-8', name: 'Prijs �' },
});

const p6Notes = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASKMEMO',
  '%F\ttask_id\ttask_memo',
  `%R\tT1\tTaak\u007f\u007fregel\u0000\ufeff`,
  '%T\tWBSMEMO',
  '%F\twbs_id\twbs_memo',
  `%R\tW1\tWBS\u007f\u007fregel\u0000\ufeff`,
  '%T\tACCOUNT',
  '%F\tacct_id\tacct_descr',
  `%R\tA1\tRekening\u007f\u007fregel\u0000\ufeff`,
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_notes',
  `%R\tR1\tResource\u007f\u007fregel\u0000\ufeff`,
  '%T\tROLES',
  '%F\trole_id\trole_descr',
  `%R\tO1\tRol\u007f\u007fregel\u0000\ufeff`,
  '%T\tTASKPROC',
  '%F\tproc_id\tproc_descr',
  `%R\tS1\tStap\u007f\u007fregel\u0000\ufeff`,
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_data',
  `%R\tC1\tKalender\u007f\u007fdata\u0000\ufeff`,
  '%E',
]));
// Breuk die dit vangt: NotesHelper op veldnaam of globaal toepassen. Alleen onderzochte echte
// P6-notitievelden worden opgeschoond; structured calendar text blijft byte-inhoudelijk rauw.
eq('17 NotesHelper-semantiek is tabel- en veldspecifiek', {
  task: p6Notes.tables.get('TASKMEMO')?.rows[0]?.cells.task_memo,
  wbs: p6Notes.tables.get('WBSMEMO')?.rows[0]?.cells.wbs_memo,
  account: p6Notes.tables.get('ACCOUNT')?.rows[0]?.cells.acct_descr,
  resource: p6Notes.tables.get('RSRC')?.rows[0]?.cells.rsrc_notes,
  role: p6Notes.tables.get('ROLES')?.rows[0]?.cells.role_descr,
  step: p6Notes.tables.get('TASKPROC')?.rows[0]?.cells.proc_descr,
  calendar: p6Notes.tables.get('CALENDAR')?.rows[0]?.cells.clndr_data,
}, {
  task: 'Taak\nregel',
  wbs: 'WBS\nregel',
  account: 'Rekening\nregel',
  resource: 'Resource\nregel',
  role: 'Rol\nregel',
  step: 'Stap\nregel',
  calendar: `Kalender\u007f\u007fdata\u0000\ufeff`,
});

function emptyIdentity(table: string, fields: string, row: string): Record<string, unknown> | null {
  return caughtXerError(() => parseXerTables(utf8([
    'ERMHDR\t23.12',
    `%T\t${table}`,
    `%F\t${fields}`,
    `%R\t${row}`,
    '%E',
  ])));
}
const roleOnlyAssignment = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASKRSRC',
  '%F\ttask_id\trsrc_id\trole_id\ttarget_qty',
  '%R\tT1\t\tROLE1\t',
  '%E',
]));
// Breuk die dit vangt: alleen %F-kolomnamen controleren of alle sparse assignmentwaarden
// generiek verplicht maken. Fouten dragen tabel, fysieke regel en de werkelijk ontbrekende waarde.
eq('18 aanwezige P6-tabellen vereisen niet-lege identiteit zonder role-only data af te wijzen', {
  failures: [
    emptyIdentity('PROJECT', 'proj_id', ''),
    emptyIdentity('CALENDAR', 'clndr_id', ''),
    emptyIdentity('PROJWBS', 'wbs_id\tproj_id', 'W1\t'),
    emptyIdentity('TASK', 'task_id\tproj_id\ttask_code', 'T1\t\tA1'),
    emptyIdentity('TASKPRED', 'task_id\tpred_task_id\tpred_type', 'T1\tT0\t'),
    emptyIdentity('RSRC', 'rsrc_id', ''),
    emptyIdentity('TASKRSRC', 'task_id\trsrc_id\trole_id', '\tR1\t'),
    emptyIdentity('TASKRSRC', 'task_id\trsrc_id\trole_id', 'T1\t\t'),
  ],
  roleOnlyRows: roleOnlyAssignment.tables.get('TASKRSRC')?.rows.length,
}, {
  failures: [
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'PROJECT', missingValues: ['proj_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'CALENDAR', missingValues: ['clndr_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'PROJWBS', missingValues: ['proj_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASK', missingValues: ['proj_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASKPRED', missingValues: ['pred_type'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'RSRC', missingValues: ['rsrc_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASKRSRC', missingValues: ['task_id'], line: 4 },
    { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASKRSRC', missingValues: ['rsrc_id', 'role_id'], line: 4 },
  ],
  roleOnlyRows: 1,
});

const missingCurrencyMatch = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEP',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
  '%R\tEUR\t,\t.',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttarget_drtn_hr_cnt',
  '%R\tP1\tT1\tA1\t1.5',
  '%E',
]));
const consistentCurrency = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\teur',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdecimal_symbol_type\tdigit_group_symbol\tdigit_group_symbol_type',
  '%R\tEUR\tds_Comma\tCOMMA\tdg_Period\tPERIOD',
  '%E',
]));
function currencyRow(fields: string, values: string): Record<string, unknown> | null {
  return caughtXerError(() => parseXerTables(utf8([
    'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEUR',
    '%T\tCURRTYPE',
    `%F\tcurr_short_name\t${fields}`,
    `%R\tEUR\t${values}`,
    '%E',
  ])));
}
// Breuken die dit vangt: de eerste valutaregel als stille fallback kiezen, slechts de eerste
// herkenbare representatie vertrouwen, of ds/dg-symbolen in de verkeerde familie accepteren.
eq('19 CURRTYPE matcht exact en valideert alle separatorrepresentaties', {
  missingMatch: {
    format: missingCurrencyMatch.numberFormat,
    issues: missingCurrencyMatch.report.issues,
  },
  consistent: consistentCurrency.numberFormat,
  invalid: [
    currencyRow('decimal_symbol\tdecimal_symbol_type\tdigit_group_symbol', ',\tds_Period\t.'),
    currencyRow('decimal_symbol\tdigit_group_symbol\tdigit_group_symbol_type', '.\t,\tdg_Period'),
    currencyRow('decimal_symbol_type', 'dg_Period'),
    currencyRow('decimal_symbol\tdigit_group_symbol_type', '.\tds_Comma'),
    currencyRow('decimal_symbol', 'onbekend'),
  ],
}, {
  missingMatch: {
    format: { decimal: '.', group: null, source: 'default', currencyCode: 'EP' },
    issues: [{ code: 'XER_CURRENCY_NOT_FOUND', line: 1, table: 'CURRTYPE', currencyCode: 'EP' }],
  },
  consistent: { decimal: ',', group: '.', source: 'currtype', currencyCode: 'eur' },
  invalid: Array.from({ length: 5 }, () => ({
    name: 'XerImportError',
    xerCode: 'XER_INVALID_NUMBER_FORMAT',
    table: 'CURRTYPE',
    line: 4,
    lines: [4],
  })),
});

const terminalEnd = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tPROJECT',
  '%F\tproj_id',
  '%R\tP1',
  '%E',
  '%T\tPROJECT',
  '%F\tproj_id',
  '%R\tP2',
]));
// Breuk die dit vangt: na de eerste %E doorlezen en een eerder betrouwbare bekende tabel
// overschrijven. De hele niet-lege staart krijgt precies één issue met record- én regeltelling.
eq('20 de eerste %E is terminaal en rapporteert de volledig genegeerde staart', {
  project: terminalEnd.tables.get('PROJECT')?.rows[0]?.cells.proj_id,
  rows: terminalEnd.tables.get('PROJECT')?.rows.length,
  issues: terminalEnd.report.issues,
}, {
  project: 'P1',
  rows: 1,
  issues: [{
    code: 'XER_TRAILING_RECORDS_AFTER_END',
    line: 6,
    ignoredRecords: 3,
    ignoredLines: 3,
  }],
});

// Breuk die dit vangt: fatale TextDecoder-TypeErrors uit BOM-takken laten ontsnappen. De BOM
// bepaalt ook bij een kapotte payload welke encoding in het typed foutcontract moet staan.
eq('21 kapotte BOM-payloads worden altijd getypeerd met encodingcontext', [
  caughtXerError(() => parseXerTables(Uint8Array.from([0xef, 0xbb, 0xbf, 0xc3, 0x28]))),
  caughtXerError(() => parseXerTables(Uint8Array.from([0xff, 0xfe, 0x45]))),
  caughtXerError(() => parseXerTables(Uint8Array.from([0xfe, 0xff, 0x00]))),
], [
  { name: 'XerImportError', xerCode: 'XER_INVALID_ENCODING', encoding: 'utf-8' },
  { name: 'XerImportError', xerCode: 'XER_INVALID_ENCODING', encoding: 'utf-16le' },
  { name: 'XerImportError', xerCode: 'XER_INVALID_ENCODING', encoding: 'utf-16be' },
]);

function noCurrencyDuration(value: string, field = 'target_drtn_hr_cnt'): Record<string, unknown> | null {
  return caughtXerError(() => parseXerTables(utf8([
    'ERMHDR\t23.12',
    '%T\tTASK',
    `%F\tproj_id\ttask_id\ttask_code\t${field}`,
    `%R\tP1\tT1\tA1\t${value}`,
    '%E',
  ])));
}
const validCommaGroups = parseXerTables(utf8([
  'ERMHDR\t23.12',
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\ttarget_drtn_hr_cnt',
  '%R\tP1\tT1\tA1\t1,234',
  '%R\tP1\tT2\tA2\t-12,345',
  '%R\tP1\tT3\tA3\t1,234,567',
  '%E',
]));
// Breuk die dit vangt: maximaal twee fractiecijfers aannemen, op een suffixregex vertrouwen,
// of geldige komma-duizendgroepen als bewezen decimaalnotatie afwijzen.
eq('22 komma-decimaalbewijs gebruikt veldcatalogus en onbeperkte precisie', {
  ambiguous: [
    noCurrencyDuration('1,5000'),
    noCurrencyDuration('-2,34567'),
    noCurrencyDuration('1.234,567890'),
  ],
  groupedRows: validCommaGroups.tables.get('TASK')?.rows.length,
  numericLookingText: noCurrencyDuration('1,5000', 'task_name'),
}, {
  ambiguous: Array.from({ length: 3 }, () => ({
    name: 'XerImportError',
    xerCode: 'XER_AMBIGUOUS_DECIMAL',
  })),
  groupedRows: 3,
  numericLookingText: null,
});

// Breuk die dit vangt: elke rij met een breedte-issue generiek overslaan. Een ontbrekende
// verplichte token blijft bij afkappen of uitsluitend extra eindtokens ondubbelzinnig zichtbaar.
eq('23 rijbreedte omzeilt ondubbelzinnig ontbrekende identiteit niet', [
  emptyIdentity('PROJECT', 'proj_id', '\tEXTRA'),
  emptyIdentity('PROJECT', 'proj_id\tproj_name', ''),
  emptyIdentity('TASK', 'proj_id\ttask_id\ttask_code\ttask_name', 'P1\tT1\t\tNaam\tEXTRA'),
  emptyIdentity('TASK', 'proj_id\ttask_id\ttask_code\ttask_name', 'P1\tT1'),
  emptyIdentity('TASKPRED', 'task_id\tpred_task_id\tpred_type', 'T1\t\tFS\tEXTRA'),
  emptyIdentity('RSRC', 'rsrc_id\trsrc_name', ''),
], [
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'PROJECT', missingValues: ['proj_id'], line: 4 },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'PROJECT', missingValues: ['proj_id'], line: 4 },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASK', missingValues: ['task_code'], line: 4 },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASK', missingValues: ['task_code'], line: 4 },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'TASKPRED', missingValues: ['pred_task_id'], line: 4 },
  { name: 'XerImportError', xerCode: 'XER_MISSING_REQUIRED_VALUE', table: 'RSRC', missingValues: ['rsrc_id'], line: 4 },
]);

function duplicateCurrency(secondRow: string): Record<string, unknown> | ReturnType<typeof parseXerTables> {
  try {
    return parseXerTables(utf8([
      'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tCloud\tEUR',
      '%T\tCURRTYPE',
      '%F\tcurr_short_name\tdecimal_symbol\tdecimal_symbol_type\tdigit_group_symbol\tdigit_group_symbol_type',
      '%R\teur\t.\tperiod\t,\tcomma',
      secondRow,
      '%E',
    ]));
  } catch (error) {
    return caughtXerError(() => { throw error; }) ?? {};
  }
}
const identicalCurrencyDuplicates = duplicateCurrency('%R\tEUR\t.\tds_period\t,\tdg_comma');
// Breuken die dit vangt: de eerste matching CURRTYPE-rij kiezen zonder de rest te valideren,
// of semantisch afwijkende duplicaten accepteren. Foutcontext wijst de fysieke bronregels aan.
eq('24 alle matching CURRTYPE-rijen zijn gevalideerd en semantisch eensluidend', {
  identical: 'numberFormat' in identicalCurrencyDuplicates
    ? identicalCurrencyDuplicates.numberFormat
    : identicalCurrencyDuplicates,
  conflict: duplicateCurrency('%R\tEUR\t,\tcomma\t.\tperiod'),
  invalidSecond: duplicateCurrency('%R\tEUR\t.\tdg_period\t,\tdg_comma'),
}, {
  identical: { decimal: '.', group: ',', source: 'currtype', currencyCode: 'EUR' },
  conflict: {
    name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT', table: 'CURRTYPE',
    line: 5, lines: [4, 5],
  },
  invalidSecond: {
    name: 'XerImportError', xerCode: 'XER_INVALID_NUMBER_FORMAT', table: 'CURRTYPE',
    line: 5, lines: [5],
  },
});

function trailingLinesWithFinalNewline(newline: '\n' | '\r\n'): unknown {
  const text = [
    'ERMHDR\t23.12',
    '%E',
    '%T\tPROJECT',
    '',
    '%F\tproj_id',
    '%R\tP2',
  ].join(newline) + newline;
  return parseXerTables(new TextEncoder().encode(text)).report.issues;
}
// Breuk die dit vangt: het lege split-token ná een afsluitende newline als fysieke staartregel
// tellen. De bewust lege regel midden in de genegeerde staart moet juist wel blijven meetellen.
eq('25 ignoredLines telt fysieke LF/CRLF-staartregels zonder synthetisch eindtoken', {
  lf: trailingLinesWithFinalNewline('\n'),
  crlf: trailingLinesWithFinalNewline('\r\n'),
}, {
  lf: [{ code: 'XER_TRAILING_RECORDS_AFTER_END', line: 3, ignoredRecords: 3, ignoredLines: 4 }],
  crlf: [{ code: 'XER_TRAILING_RECORDS_AFTER_END', line: 3, ignoredRecords: 3, ignoredLines: 4 }],
});

// Onafhankelijke inventaris uit MPXJ XerFile.FIELD_TYPE_MAP: uitsluitend bronvelden met
// DataType.NUMERIC, DURATION of CURRENCY. De lijst is met de hand gecontroleerd en wordt niet uit
// productie afgeleid; ontbreekt daar later één veld, dan noemt deze gedragsmatrix precies dat veld.
const authoritativeDecimalFields = [
  'act_cost', 'act_equip_qty', 'act_ot_cost', 'act_ot_qty', 'act_reg_cost', 'act_reg_qty',
  'act_work_qty', 'asgnmnt_catg_id', 'asgnmnt_catg_short_len', 'asgnmnt_catg_type_id',
  'base_exch_rate', 'complete_pct', 'cost_per_qty', 'cost_per_qty2', 'cost_per_qty3',
  'cost_per_qty4', 'cost_per_qty5', 'critical_drtn_hr_cnt', 'curv_id', 'day_hr_cnt',
  'def_qty_per_hr', 'est_wt', 'free_float_hr_cnt', 'indep_remain_total_cost',
  'indep_remain_work_qty', 'lag_hr_cnt', 'latitude', 'longitude', 'max_qty_per_hr',
  'month_hr_cnt', 'orig_cost', 'parent_asgnmnt_catg_id',
  'pct_usage_0', 'pct_usage_1', 'pct_usage_2', 'pct_usage_3', 'pct_usage_4', 'pct_usage_5',
  'pct_usage_6', 'pct_usage_7', 'pct_usage_8', 'pct_usage_9', 'pct_usage_10', 'pct_usage_11',
  'pct_usage_12', 'pct_usage_13', 'pct_usage_14', 'pct_usage_15', 'pct_usage_16',
  'pct_usage_17', 'pct_usage_18', 'pct_usage_19', 'pct_usage_20', 'phys_complete_pct',
  'proc_wt', 'remain_cost', 'remain_drtn_hr_cnt', 'remain_equip_qty', 'remain_qty',
  'remain_qty_per_hr', 'remain_work_qty', 'target_cost', 'target_drtn_hr_cnt',
  'target_equip_qty', 'target_lag_drtn_hr_cnt', 'target_qty', 'target_qty_per_hr',
  'target_work_qty', 'total_float_hr_cnt', 'udf_number', 'week_hr_cnt', 'year_hr_cnt',
] as const;

function commaDecimalField(
  table: string,
  fields: readonly string[],
  values: readonly string[],
): Record<string, unknown> | null {
  return caughtXerError(() => parseXerTables(utf8([
    'ERMHDR\t23.12',
    `%T\t${table}`,
    `%F\t${fields.join('\t')}`,
    `%R\t${values.join('\t')}`,
    '%E',
  ])));
}
const uncoveredAuthoritativeFields = authoritativeDecimalFields.filter(field =>
  commaDecimalField('UDFVALUE', [field], ['1,5000'])?.xerCode !== 'XER_AMBIGUOUS_DECIMAL');
const representativeDecimalFields = [
  commaDecimalField('UDFVALUE', ['udf_number'], ['1,5000']),
  ...['cost_per_qty2', 'cost_per_qty3', 'cost_per_qty4', 'cost_per_qty5']
    .map(field => commaDecimalField('RSRCRATE', [field], ['1,5000'])),
  commaDecimalField(
    'TASKRSRC',
    ['task_id', 'rsrc_id', 'role_id', 'remain_qty_per_hr'],
    ['T1', 'R1', '', '-2,34567'],
  ),
  commaDecimalField('RSRCCURVDATA', ['pct_usage_0', 'pct_usage_20'], ['1,5000', '2']),
  commaDecimalField('PROJCOST', ['target_cost'], ['1.234,5678']),
  commaDecimalField(
    'TASK',
    ['proj_id', 'task_id', 'task_code', 'target_drtn_hr_cnt'],
    ['P1', 'T1', 'A1', '1,5000'],
  ),
];
// Breuken die dit vangt: een suffixheuristiek, alleen de reeds gemapte X3-velden opnemen, of
// NUMERIC/DURATION/CURRENCY onvolledig overnemen. INTEGER-id en vrije tekst blijven negatief.
eq('26 gezaghebbende numerieke P6-veldmatrix draagt de komma-decimaalheuristiek volledig', {
  authoritativeCount: authoritativeDecimalFields.length,
  uncoveredAuthoritativeFields,
  representativeDecimalFields,
  negative: {
    udfText: commaDecimalField('UDFVALUE', ['udf_text'], ['1,5000']),
    integerId: commaDecimalField('UDFVALUE', ['udf_type_id'], ['1,5000']),
    projectTextAndId: commaDecimalField(
      'PROJECT',
      ['proj_id', 'proj_name'],
      ['1,5000', '1,5000'],
    ),
  },
}, {
  authoritativeCount: 72,
  uncoveredAuthoritativeFields: [],
  representativeDecimalFields: Array.from({ length: 9 }, () => ({
    name: 'XerImportError', xerCode: 'XER_AMBIGUOUS_DECIMAL',
  })),
  negative: { udfText: null, integerId: null, projectTextAndId: null },
});

if (diffs.length === 0) {
  console.log(`OK  xer-tables: ${checks} checks groen`);
} else {
  console.log(`XX  xer-tables: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
