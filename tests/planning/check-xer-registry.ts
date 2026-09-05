import {
  allReadFormats,
  binaryExtensions,
  importErrorMessageKey,
  openDialogFilters,
  parseOpenedFile,
  readFormatInput,
  readFormatForFile,
  saveTargetFor,
} from '@/services/formatRegistry';
import { XerImportError, type XerImportErrorCode } from '@/services/xer/xerTables';
import { activeImportResult } from '@/services/importTypes';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function fixture(projectName: string): string {
  return [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_data',
    '%R\tC1\tStandaard\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    `%R\tP1\t${projectName}\tC1\t2026-01-01 08:00`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tA1\tTaak\t2026-01-01 08:00\t2026-01-01 16:00',
    '%E',
  ].join('\n');
}

function utf16(text: string, littleEndian: boolean): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = littleEndian ? 0xff : 0xfe;
  out[1] = littleEndian ? 0xfe : 0xff;
  for (let index = 0; index < text.length; index++) {
    const value = text.charCodeAt(index);
    out[2 + index * 2] = littleEndian ? value & 0xff : value >>> 8;
    out[3 + index * 2] = littleEndian ? value >>> 8 : value & 0xff;
  }
  return out;
}

function cp1252(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of text) {
    if (character === '€') bytes.push(0x80);
    else if (character === 'é') bytes.push(0xe9);
    else bytes.push(character.charCodeAt(0));
  }
  return Uint8Array.from(bytes);
}

const format = readFormatForFile('planning.XeR');
eq('1 .xer staat als lazy binair leesformaat in het register', format && {
  id: format.id,
  kind: format.kind,
  canBeSaveTarget: Boolean(format.canBeSaveTarget),
}, { id: 'xer', kind: 'binary', canBeSaveTarget: false });
eq('2 XER staat in openfilters en binaire extensies', {
  binary: binaryExtensions().includes('xer'),
  filter: openDialogFilters().some(item => item.extensions.includes('xer')),
  listed: allReadFormats().some(item => item.id === 'xer'),
}, { binary: true, filter: true, listed: true });
eq('3 XER is nooit een opslagdoel', saveTargetFor(format, null, 'bron.xer'), {
  filePath: null,
  fileHandle: null,
});

const ioCalls: string[] = [];
const routed = await readFormatInput('/tmp/bron.xer', {
  readTextFile: async () => {
    ioCalls.push('text');
    throw new Error('XER mag nooit als tekst gelezen worden');
  },
  readFile: async () => {
    ioCalls.push('bytes');
    return new Uint8Array([0x80, 0xff]);
  },
});
eq('4 gedeeld Tauri/MCP/dev-bridge-pad kiest bytes zonder re-encoding', {
  calls: ioCalls,
  sameBytes: routed.bytes?.[0] === 0x80 && routed.bytes?.[1] === 0xff,
  text: routed.text,
}, { calls: ['bytes'], sameBytes: true });

const encoded = [
  ['CP1252', cp1252(fixture('Café €'))],
  ['UTF-16LE BOM', utf16(fixture('Café €'), true)],
  ['UTF-16BE BOM', utf16(fixture('Café €'), false)],
] as const;
for (const [label, input] of encoded) {
  const parsed = activeImportResult(await parseOpenedFile({ name: 'bron.xer', bytes: input }));
  eq(`5 ${label} bereikt de lazy reader als originele bytes`, parsed.project.name, 'Café €');
}

const errorKeys: ReadonlyArray<readonly [XerImportErrorCode, string]> = [
  ['XER_INVALID_INPUT', 'notifications.xerInvalidInput'],
  ['XER_INVALID_FILE', 'notifications.xerInvalidFile'],
  ['XER_INVALID_ENCODING', 'notifications.xerInvalidEncoding'],
  ['XER_DUPLICATE_TABLE', 'notifications.xerDuplicateTable'],
  ['XER_MISSING_REQUIRED_COLUMNS', 'notifications.xerMissingRequiredColumns'],
  ['XER_MISSING_REQUIRED_VALUE', 'notifications.xerMissingRequiredValue'],
  ['XER_AMBIGUOUS_DECIMAL', 'notifications.xerAmbiguousDecimal'],
  ['XER_INVALID_NUMBER_FORMAT', 'notifications.xerInvalidNumberFormat'],
  ['XER_INVALID_NUMBER', 'notifications.xerInvalidNumber'],
  ['XER_SINGLE_PROJECT_REQUIRED', 'notifications.xerSingleProjectRequired'],
  ['XER_EMPTY_PROJECT', 'notifications.xerEmptyProject'],
  ['XER_DUPLICATE_ID', 'notifications.xerDuplicateId'],
  ['XER_AMBIGUOUS_LOCAL_RELATION', 'notifications.xerAmbiguousLocalRelation'],
  ['XER_DANGLING_LOCAL_RELATION', 'notifications.xerDanglingLocalRelation'],
];
eq('6 iedere typed XER-fout heeft een eigen meldingssleutel',
  errorKeys.map(([code]) => importErrorMessageKey(new XerImportError(code, code))),
  errorKeys.map(([, key]) => key));

if (diffs.length > 0) {
  console.error(`XER-registry: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-registry: ${checks} lazy/bytes/filter/opslagdoel-checks`);
