/**
 * Test-only schema-1-writer voor bestaande X9-containers.
 *
 * Productcode schrijft bewust alleen schema 2. Deze helper houdt de uitgebreide historische
 * envelope als invoerfixture beschikbaar voor validators en achterwaartse-compatibiliteitstests.
 */
import type { ImportResult } from '@/services/importTypes';
import { writeIFC } from '@/services/ifc/ifcWriter';
import {
  chunkXerArchiveBytes,
  encodeXerArchiveMetadataPayload,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';

const escapeIfcText = (value: string): string => value.replace(/'/g, "''");

function appendLegacyExpandedContainer(
  ifc: string,
  archive: XerSourceArchive,
  sourceProjectId: string,
): string {
  const project = /#([A-Za-z0-9_]+)=IFCPROJECT\([^,]+,#([A-Za-z0-9_]+)/.exec(ifc);
  if (!project) throw new Error('Basis-IFC mist IFCPROJECT/eigenaar');
  const diagnostics = chunkXerArchiveBytes(encodeXerArchiveMetadataPayload(archive));
  let nextId = 900000;
  const lines: string[] = [];
  const propertyIds: number[] = [];
  const property = (name: string, value: string): void => {
    const id = nextId++;
    propertyIds.push(id);
    lines.push(`#${id}=IFCPROPERTYSINGLEVALUE('${name}',$,${value},$);`);
  };
  property('SchemaVersion', 'IFCINTEGER(1)');
  property('Format', `IFCLABEL('${escapeIfcText(archive.format)}')`);
  property('ByteLength', `IFCINTEGER(${archive.byteLength})`);
  property('Sha256', `IFCTEXT('${archive.sha256}')`);
  property('Encoding', `IFCLABEL('${archive.encoding}')`);
  property('Bom', `IFCLABEL('${archive.bom}')`);
  property('Newline', `IFCLABEL('${archive.newline}')`);
  property('ByteChunkSize', 'IFCINTEGER(196608)');
  property('ByteChunkCount', `IFCINTEGER(${archive.byteChunks.length})`);
  property('DiagnosticsByteLength', `IFCINTEGER(${diagnostics.byteLength})`);
  property('DiagnosticsSha256', `IFCTEXT('${diagnostics.sha256}')`);
  property('DiagnosticsChunkCount', `IFCINTEGER(${diagnostics.byteChunks.length})`);
  archive.byteChunks.forEach((chunk, index) => property(
    `ByteChunk${String(index).padStart(6, '0')}`,
    `IFCTEXT('${chunk}')`,
  ));
  diagnostics.byteChunks.forEach((chunk, index) => property(
    `DiagnosticsChunk${String(index).padStart(6, '0')}`,
    `IFCTEXT('${chunk}')`,
  ));
  const archiveSet = nextId++;
  lines.push(`#${archiveSet}=IFCPROPERTYSET('0xxxxxxxxxxxxxxxxxxxxx',#${project[2]},'OPS_XerSourceArchive',$,(${propertyIds.map(id => `#${id}`).join(',')}));`);
  lines.push(`#${nextId++}=IFCRELDEFINESBYPROPERTIES('1xxxxxxxxxxxxxxxxxxxxx',#${project[2]},$,$,(#${project[1]}),#${archiveSet});`);
  const selectorIds: number[] = [];
  const selector = (name: string, value: string): void => {
    const id = nextId++;
    selectorIds.push(id);
    lines.push(`#${id}=IFCPROPERTYSINGLEVALUE('${name}',$,${value},$);`);
  };
  selector('ArchiveSha256', `IFCTEXT('${archive.sha256}')`);
  selector('SourceProjectId', `IFCTEXT('${escapeIfcText(sourceProjectId)}')`);
  const selectorSet = nextId++;
  lines.push(`#${selectorSet}=IFCPROPERTYSET('2xxxxxxxxxxxxxxxxxxxxx',#${project[2]},'OPS_XerDocument',$,(${selectorIds.map(id => `#${id}`).join(',')}));`);
  lines.push(`#${nextId++}=IFCRELDEFINESBYPROPERTIES('3xxxxxxxxxxxxxxxxxxxxx',#${project[2]},$,$,(#${project[1]}),#${selectorSet});`);
  return ifc.replace(
    '\nENDSEC;\nEND-ISO-10303-21;\n',
    `\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`,
  );
}

export function writeExpandedLegacyXerArchiveFixture(input: ImportResult): string {
  const archive = input.xerSourceArchive;
  const sourceProjectId = input.xer?.sourceProjectId ?? input.xerSourceProjectId;
  if (!archive || !sourceProjectId) throw new Error('Legacy-X9-fixture mist bronarchief of selector');
  return appendLegacyExpandedContainer(
    writeIFC({ ...input, xer: undefined, xerSourceArchive: undefined, xerSourceProjectId: undefined }),
    archive,
    sourceProjectId,
  );
}
