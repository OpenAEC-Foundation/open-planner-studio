// X9 — IFC-container voor het zelfstandige XER-bronarchief. Geen reader-mock: echte STEP-tekst
// gaat door writeIFC én readIFC. De bron is geldige XER, want schema 2 reconstrueert daaruit.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { archiveDropped } from './xerArchiveFallbackAssert';
import { readIFC as readIFCRaw } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import type { XerArchiveIssueCode } from '@/services/importTypes';
import {
  decodeXerSourceArchive,
  sha256Hex,
} from '@/services/xerSourceArchive';
import { readXER } from '@/services/xer/xerReader';

declare const process: { exit(code: number): never };
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };

const sourceText = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP6-ARCHIVE\tContainerfixture\tC\t2026-08-01 08:00',
  '%T\tSCHEDOPTIONS',
  '%F\tschedoptions_id\tproj_id\tsched_use_expect_end_flag',
  '%R\tSO\tP6-ARCHIVE\tY',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tA\tP6-ARCHIVE\tA-1\tArchieftaak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%T\tRSRC',
  '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
  '%R\tR\tVakman\tRT_Labor\tC\t1',
  '%T\tTASKRSRC',
  '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trole_id\ttarget_qty_per_hr\tremain_qty\ttarget_qty',
  '%R\tAS\tP6-ARCHIVE\tA\tR\t\t1\t8\t8',
  '%T\tUNKNOWN',
  '%F\tpayload',
  `%R\t${'x'.repeat(196_608)}`,
  '%E',
].join('\r\n');
const bytes = new TextEncoder().encode(sourceText);
const opened = readXER(bytes);
if ('kind' in opened) throw new Error('Containerfixture moet één XER-document openen');
const archive = opened.xerSourceArchive;
if (!archive || !opened.xer) throw new Error('Containerfixture mist XER-bronarchief');
const ifc = writeIFC(opened);

expect('1 schrijft precies één manifestcontainer', (ifc.match(/OPS_XerSourceArchive/g) ?? []).length === 1);
expect('2 schrijft selector met P6-project', ifc.includes('OPS_XerDocument') && ifc.includes('P6-ARCHIVE'));
expect('3 volle chunk heeft 196608 bytes', archive.byteChunks.length === 2);
const read = readIFC(ifc);
expect('4 archive wordt uit IFC herlezen', read.xerSourceArchive !== undefined);
if (read.xerSourceArchive) {
  expect('5 bytes zijn exact gelijk', sha256Hex(decodeXerSourceArchive(read.xerSourceArchive)) === sha256Hex(bytes));
  expect('6 projectselector herleeft naast het archief', read.xerSourceProjectId === 'P6-ARCHIVE');
  expect('6a X5- en X6-bronmateriaal herleeft uit de compacte bronreconstructie',
    read.xer?.sourceProjectId === 'P6-ARCHIVE'
    && (read.xer.scheduleOptions.sourceRows.length ?? 0) > 0
    && read.xer.resources?.assignments.length === 1
    && read.xer.resources.assignments[0]?.sourceId === 'AS'
    && read.xer.resources.assignments[0]?.rawRow.cells.taskrsrc_id === 'AS');
}
// Eigenaarsbesluit 2026-09-24 ("openen met melding"): een onbruikbaar archief GIJZELT het project
// niet meer. Elke case hieronder eist het VOLLEDIGE terugvalcontract (`archiveDropped`): project
// opent, álle archiefafgeleiden weg, en een verplicht `xerArchiveIssue` met code + validatorreden.
// Vroeger heetten deze helpers `rejectsArchive*` en eisten ze een `IfcParseError`.
const droppedFailures: string[] = [];
const dropsArchiveWith = (value: string, fragment?: string, code?: XerArchiveIssueCode) => {
  const verdict = archiveDropped(() => readIFC(value), { fragment, code });
  if (!verdict.ok) droppedFailures.push(verdict.why);
  // Het project zelf moet volledig openen: de ene archieftaak is er gewoon.
  return verdict.ok && verdict.result?.tasks.some(task => task.name === 'Archieftaak') === true;
};
const replaceIntegerProperty = (content: string, name: string, value: number) => content.replace(
  new RegExp(`(IFCPROPERTYSINGLEVALUE\\('${name}',\\$,IFCINTEGER\\()\\d+(\\),\\$\\))`),
  `$1${value}$2`,
);
const psetId = (content: string, name: string) => {
  const match = new RegExp(`#([A-Za-z0-9_]+)=IFCPROPERTYSET\\([^\\n]*'${name}'`).exec(content);
  if (!match) throw new Error(`Pset ${name} ontbreekt in fixture`);
  return match[1]!;
};
const propertyRelationLine = (content: string, setId: string) => {
  const line = content.split('\n').find(candidate =>
    candidate.includes('IFCRELDEFINESBYPROPERTIES(') && candidate.endsWith(`,#${setId});`));
  if (!line) throw new Error(`Relatie voor Pset #${setId} ontbreekt in fixture`);
  return line;
};
expect('7 corrupte base64: project opent, archief weg mét signaal (structure)', dropsArchiveWith(ifc.replace(archive.byteChunks[0]!, `!${archive.byteChunks[0]!.slice(1)}`), 'ongeldige base64', 'structure'));
expect('8 hernoemde chunk: archief weg mét signaal (structure)', dropsArchiveWith(ifc.replace('ByteChunk000001', 'ByteChunkAfwezig'), 'geordend', 'structure'));
expect('9 FOUTCODE hash-mismatch: corrupte bronhash ⇒ archief weg mét signaal', dropsArchiveWith(ifc.replace(archive.sha256, `0${archive.sha256.slice(1)}`), 'Sha256', 'hash-mismatch'));
expect('10 verkeerde manifestchunkgrootte: archief weg mét signaal (structure)', dropsArchiveWith(ifc.replace('IFCINTEGER(196608)', 'IFCINTEGER(196607)'), 'ByteChunkSize', 'structure'));
expect('10a FOUTCODE schema-version: onbekende archiefschemaversie ⇒ archief weg mét signaal',
  dropsArchiveWith(replaceIntegerProperty(ifc, 'SchemaVersion', 3), 'SchemaVersion', 'schema-version'));
expect('10b mismatchende ByteLength ⇒ afgeknot (truncated), vóór samenvoegen',
  dropsArchiveWith(ifc.replace(`IFCINTEGER(${bytes.length})`, `IFCINTEGER(${bytes.length + 1})`), 'heeft', 'truncated'));
const reorderedChunks = ifc
  .replace('ByteChunk000000', 'ByteChunkTMP')
  .replace('ByteChunk000001', 'ByteChunk000000')
  .replace('ByteChunkTMP', 'ByteChunk000001');
expect('10c verwisselde chunkvolgorde (herordenend programma) ⇒ structure, vóór decode',
  dropsArchiveWith(reorderedChunks, 'geordend', 'structure'));
const validButChangedChunk = `${archive.byteChunks[0]![0] === 'A' ? 'B' : 'A'}${archive.byteChunks[0]!.slice(1)}`;
expect('10d geldige base64 met gewijzigde bytes ⇒ hash-mismatch',
  dropsArchiveWith(ifc.replace(archive.byteChunks[0]!, validButChangedChunk), 'Sha256', 'hash-mismatch'));
expect('10e selector naar ontbrekende documentview ⇒ metadata-invalid, nooit stil',
  dropsArchiveWith(ifc.replace("IFCTEXT('P6-ARCHIVE')", "IFCTEXT('P6-ONTBREEKT')"), 'documentview', 'metadata-invalid'));
const hugeCount = 4_294_967_296;
const hugeLength = hugeCount * 196_608;
const hugeBytes = replaceIntegerProperty(
  replaceIntegerProperty(ifc, 'ByteLength', hugeLength),
  'ByteChunkCount', hugeCount,
);
expect('11 enorme coherente bytecount ⇒ truncated, vóór Array.from/allocatie',
  dropsArchiveWith(hugeBytes, 'propertybudget', 'truncated'));
const injectedDiagnostics = ifc.replace('ByteChunk000000', 'DiagnosticsChunk000000');
expect('12 schema-2 accepteert geen ingespoten uitgebreide diagnosticschunk (structure)',
  dropsArchiveWith(injectedDiagnostics, 'geordend', 'structure'));

const projectLine = ifc.split('\n').find(line => line.includes('=IFCPROJECT('));
if (!projectLine) throw new Error('IFCPROJECT ontbreekt in fixture');
const duplicateProject = ifc.replace(projectLine, `${projectLine}\n${projectLine.replace(/^#[A-Za-z0-9_]+=/, '#999991=')}`);
expect('13 archive-IFC met twee IFCPROJECT-entiteiten ⇒ structure',
  dropsArchiveWith(duplicateProject, 'exact één IFCPROJECT', 'structure'));

const selectorSetId = psetId(ifc, 'OPS_XerDocument');
const selectorRelation = propertyRelationLine(ifc, selectorSetId);
const danglingSelector = ifc.replace(selectorRelation, selectorRelation.replace(/\(#[A-Za-z0-9_]+\),#[A-Za-z0-9_]+\);$/, '(#999992),#' + selectorSetId + ');'));
expect('14 selectorrelatie naar een dangling project ⇒ structure',
  dropsArchiveWith(danglingSelector, 'hangt niet één-op-één', 'structure'));

const archiveSetId = psetId(ifc, 'OPS_XerSourceArchive');
const duplicateRelation = ifc.replace(
  selectorRelation,
  selectorRelation.replace(new RegExp(`#${selectorSetId}\\);$`), `#${archiveSetId});`),
);
expect('15 dubbele propertyrelatie naar het archief ⇒ structure',
  dropsArchiveWith(duplicateRelation, 'hangt niet één-op-één', 'structure'));

// ── Per foutcode één gerichte case (eigenaarsbesluit 2026-09-24) ─────────────────────────────
/** Verwijder properties (op naam) uit een pset — zoals een herschrijvend IFC-programma dat grote
 *  tekstwaarden laat vallen. De property-entiteiten zelf blijven staan (wees-entiteiten zijn
 *  onschuldig en precies wat zulke software achterlaat). */
const dropPsetProperties = (content: string, psetName: string, drop: (name: string) => boolean) => {
  const lines = content.split('\n');
  const nameByRef = new Map<string, string>();
  for (const line of lines) {
    const m = /^#([A-Za-z0-9_]+)=IFCPROPERTYSINGLEVALUE\('([^']*)'/.exec(line);
    if (m) nameByRef.set(m[1]!, m[2]!);
  }
  return lines.map(line => {
    if (!line.includes('=IFCPROPERTYSET(') || !line.includes(`'${psetName}'`)) return line;
    return line.replace(/\(((?:#[A-Za-z0-9_]+,?)+)\)\);$/, (_all, refs: string) => {
      const kept = refs.split(',').filter(ref => !drop(nameByRef.get(ref.slice(1)) ?? ''));
      return `(${kept.join(',')}));`;
    });
  }).join('\n');
};
expect('17 FOUTCODE truncated: laatste bronchunk ontbreekt ⇒ afgeknot archief, project opent',
  dropsArchiveWith(dropPsetProperties(ifc, 'OPS_XerSourceArchive', name => name === 'ByteChunk000001'), 'propertybudget', 'truncated'));
expect('18 FOUTCODE bytes-missing: herschreven door ander programma (pset aanwezig, álle bronbytes weg)',
  dropsArchiveWith(dropPsetProperties(ifc, 'OPS_XerSourceArchive', name => name.startsWith('ByteChunk0')), 'geen enkele', 'bytes-missing'));
const archiveRelation = propertyRelationLine(ifc, archiveSetId);
const archivePsetLine = ifc.split('\n').find(line => line.startsWith(`#${archiveSetId}=`))!;
const withoutArchivePset = ifc.replace(`${archiveRelation}\n`, '').replace(`${archivePsetLine}\n`, '');
expect('18a FOUTCODE bytes-missing: archief-pset weg, selector (OPS_XerDocument) bleef staan',
  !withoutArchivePset.includes("'OPS_XerSourceArchive'")
  && dropsArchiveWith(withoutArchivePset, 'zonder OPS_XerSourceArchive', 'bytes-missing'));
// Critreview archief-fallback (a): de omgekeerde richting van 18a — de selector-pset
// (OPS_XerDocument) is weg bij een verder geldig archief. Ook dan valt het archief weg mét signaal;
// zonder de selectorregel in `extractXerSourceProjectId` zou het archief stil zonder project blijven.
const selectorPsetLine = ifc.split('\n').find(line => line.startsWith(`#${selectorSetId}=`))!;
const withoutSelectorPset = ifc.replace(`${selectorRelation}\n`, '').replace(`${selectorPsetLine}\n`, '');
expect('18b FOUTCODE structure: selector (OPS_XerDocument) weg, archief-pset geldig',
  !withoutSelectorPset.includes("'OPS_XerDocument'") && withoutSelectorPset.includes("'OPS_XerSourceArchive'")
  && dropsArchiveWith(withoutSelectorPset, 'selector ontbreekt', 'structure'));
{
  // Critreview archief-fallback (b): het detail is begrensd, ook bij een reusachtige foutmelding.
  const verdict = archiveDropped(
    () => readIFCRaw(ifc, {}, { reconstructXerArchive: () => { throw new Error(`lang${'y'.repeat(20_000)}`); } }),
    { code: 'metadata-invalid', fragment: 'lang' },
  );
  if (!verdict.ok) droppedFailures.push(verdict.why);
  expect('19a detail afgekapt op 500 tekens',
    verdict.ok && (verdict.result?.xerArchiveIssue?.detail.length ?? 0) <= 500
    && (verdict.result?.xerArchiveIssue?.detail.length ?? 0) >= 400);
}
{
  // Metadata onparseerbaar: de bytes kloppen (hash ok), maar de afleiding eruit faalt. In productie is
  // dat de reconstructie (`readXER` over de geverifieerde bytes); hier geïnjecteerd, zodat de case
  // niet afhangt van welke rommel `readXER` toevallig nog accepteert.
  const verdict = archiveDropped(
    () => readIFCRaw(ifc, {}, { reconstructXerArchive: () => { throw new Error('leesmodel kapot'); } }),
    { code: 'metadata-invalid', fragment: 'leesmodel kapot' },
  );
  if (!verdict.ok) droppedFailures.push(verdict.why);
  expect('19 FOUTCODE metadata-invalid: afleiding uit geldige bytes faalt ⇒ archief weg mét signaal', verdict.ok);
}
expect('20 een bruikbaar archief draagt nooit een xerArchiveIssue', read.xerArchiveIssue === undefined);
{
  // Aanroepercontract blijft hard: de synchrone ingang zonder reconstructor is geen bestandsfout.
  let contractThrow = false;
  try { readIFCRaw(ifc); } catch (error) {
    contractThrow = error instanceof IfcParseError && error.reason === 'xer-source-archive';
  }
  expect('21 synchrone readIFC zonder reconstructor blijft een getypeerde contractfout (geen stille drop)', contractThrow);
}

const legacyIfc = writeIFC({ project: opened.project, calendar: opened.calendar, tasks: [], sequences: [], resources: [], assignments: [] });
const legacyRead = readIFC(legacyIfc);
expect('16 geldige oudere IFC zonder XER-Psets blijft legacy-compatibel (en zonder archief-issue: geen sporen, geen signaal)',
  legacyRead.xerSourceArchive === undefined && legacyRead.xerSourceProjectId === undefined && legacyRead.xer === undefined
  && legacyRead.xerArchiveIssue === undefined);

for (const why of droppedFailures) failures.push(`   terugval: ${why}`);
if (failures.length === 0) { console.log('OK  ifc-xer-archive-container: alle checks groen (30)'); process.exit(0); }
console.log(`XX  ifc-xer-archive-container: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
