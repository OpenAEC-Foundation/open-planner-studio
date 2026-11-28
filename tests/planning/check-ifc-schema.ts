import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { writeIFC, writeIFCForComparison } from '@/services/ifc/ifcWriter';
import { RESOURCE_TYPE_TO_IFC } from '@/services/ifc/ifcConstants';
import { DEFAULT_IFC_SCHEMA, IFC_SCHEMAS, type IfcSchemaId } from '@/types/project';
import type { ImportResult } from '@/services/importTypes';
import { TASK_TYPES } from '@/types/task';
import { IFC_SCHEMA_TABLES } from './ifcSchemaTable';
import { checkIfcSchema, newSeen, type Seen } from './ifcSchemaCheck';
import {
  buildEdgeCalendarProject, buildEmptySchemaProject, buildRichSchemaProject, buildXerSchemaProject,
  RICH_NEGATIVE_TOTAL_FLOAT,
} from './ifcSchemaFixture';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');

let checks = 0;
const fails: string[] = [];
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) fails.push(msg);
}
function checkFile(label: string, text: string, seen: Seen, expectSchema?: IfcSchemaId): void {
  const result = checkIfcSchema(label, text, seen, expectSchema);
  checks += result.checks;
  fails.push(...result.failures);
}

const seen = newSeen();
const ifcFiles = (dir: string) => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).sort();
const publicFiles = ifcFiles('public/examples');
assert(publicFiles.length >= 8, `public/examples: verwacht minstens de 8 publieke voorbeelden, vond ${publicFiles.length}`);
for (const f of publicFiles) checkFile(`public/examples/${f}`, readFileSync(join(ROOT, 'public/examples', f), 'utf8'), seen, DEFAULT_IFC_SCHEMA);
for (const f of ifcFiles('examples')) checkFile(`examples/${f}`, readFileSync(join(ROOT, 'examples', f), 'utf8'), seen, DEFAULT_IFC_SCHEMA);

const rich = buildRichSchemaProject(ROOT);
const written: [string, string][] = [];
const inSchema = (p: ImportResult, schema: IfcSchemaId): ImportResult => ({ ...p, project: { ...p.project, ifcSchema: schema } });
const richBySchema = new Map<IfcSchemaId, string>();
for (const schema of IFC_SCHEMAS) {
  const ifc = writeIFC(inSchema(rich, schema));
  richBySchema.set(schema, ifc);
  checkFile(`rijk project (${schema})`, ifc, seen, schema);
  written.push([`schema-rijk-project-${schema}.ifc`, ifc]);
}
const emptyIfc = writeIFC(inSchema(buildEmptySchemaProject(rich), DEFAULT_IFC_SCHEMA));
checkFile('leeg project', emptyIfc, seen);
written.push(['schema-leeg-project.ifc', emptyIfc]);
const edgeIfc = writeIFC(buildEdgeCalendarProject(rich));
checkFile('kalenderrandgevallen', edgeIfc, seen);
written.push(['schema-kalenderrandgevallen.ifc', edgeIfc]);
assert(/IFCRECURRENCEPATTERN\(\.WEEKLY\.,\$,\$,/.test(edgeIfc) && /IFCRECURRENCEPATTERN\([^\n]*,\$\);/.test(edgeIfc),
  'kalenderrandgevallen: testvoorwaarde — een patroon zonder weekdagen en een patroon zonder tijdvakken');
const xerIfc = writeIFC(buildXerSchemaProject());
checkFile('XER-import met bronarchief', xerIfc, seen);
written.push(['schema-xer-bronarchief.ifc', xerIfc]);
assert(xerIfc.includes("'OPS_XerSourceArchive'"), 'XER-import: testvoorwaarde — het bestand draagt OPS_XerSourceArchive');
assert(rich.baselines?.some(b => b.tasks.length === 0) === true, 'rijk project: testvoorwaarde — een baseline zonder taken');
for (const [schema, ifc] of richBySchema) {
  assert(/IFCCONSTRUCTIONMATERIALRESOURCE\('[^']{22}',#\d+,'Leges',[^\n]*,'COST',[^\n]*\.USERDEFINED\.\);/.test(ifc),
    `rijk project (${schema}): testvoorwaarde — een kostenresource als IFCCONSTRUCTIONMATERIALRESOURCE met 'COST' en .USERDEFINED.`);
}

const RICH_COMPARISON_SHA256 = 'a9759ca30903110fa8c03a671851a4490b9595acd5516d523ba1f4a41f513155';
const RICH_COMPARISON_BASE = 'main e7ffb5f8c';
{
  const comparison = writeIFCForComparison(inSchema(rich, DEFAULT_IFC_SCHEMA));
  assert(/IFCCONSTRUCTIONMATERIALRESOURCE\('[^']{22}',#\d+,'Leges',[^\n]*,'COST',[^\n]*\.USERDEFINED\.\);/.test(comparison),
    'bytevergelijking: testvoorwaarde — een kostenresource met de COST-markering');
  assert(rich.baselines?.some(b => b.tasks.length === 0) === true, 'bytevergelijking: testvoorwaarde — een baseline zonder taken');
  const got = createHash('sha256').update(comparison).digest('hex');
  assert(got === RICH_COMPARISON_SHA256,
    `bytevergelijking: het rijke project met vaste klok is byte-gelijk aan de writer van ${RICH_COMPARISON_BASE} (sha256 ${got})`);
}

{
  const tamper = (from: RegExp, to: string) => {
    const out = emptyIfc.replace(from, to);
    assert(out !== emptyIfc, `vormtoets: testvoorwaarde — ${from} komt voor in het lege project`);
    return checkIfcSchema('gemanipuleerd', out).failures.length > 0;
  };
  assert(tamper(/IFCPROJECT\('[0-3]/, "IFCPROJECT('4"), 'vormtoets: een GlobalId dat met 4 begint, is rood');
  assert(tamper(/IFCPROJECT\('([^']{22})'/, "IFCPROJECT('$1x'"), 'vormtoets: een GlobalId van 23 tekens is rood');
  assert(tamper(/(IFCWORKPLAN\([^\n]*?'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):\d{2}'/, "$1'"), 'vormtoets: een IfcDateTime zonder seconden is rood');
  assert(tamper(/IFCAPPLICATION\(#(\d+),/, 'IFCAPPLICATION(#1,'), 'vormtoets: IfcApplication.ApplicationDeveloper naar een IfcPerson is rood');
}

{
  const inspect = (schema: IfcSchemaId) => {
    const ifc = richBySchema.get(schema)!;
    const out = ifc.replace(/(#\d+=IFCTASK\([^\n]*),\.CONSTRUCTION\.\);/, '$1,.INSPECTION.);');
    assert(out !== ifc, `enumtoets: testvoorwaarde — het rijke project (${schema}) heeft een taak met .CONSTRUCTION.`);
    return checkIfcSchema('gemanipuleerd', out).failures;
  };
  const ifc4 = inspect('IFC4');
  assert(ifc4.some(f => f.includes('IFCTASK') && f.includes('.INSPECTION.')),
    `enumtoets: IFCTASK met .INSPECTION. in een IFC4-bestand is rood (kreeg: ${ifc4.join(' | ') || 'groen'})`);
  for (const schema of ['IFC4X3', 'IFC4X3_ADD2'] as const) {
    const failures = inspect(schema);
    assert(failures.length === 0, `enumtoets: IFCTASK met .INSPECTION. is geldig in ${schema} (kreeg: ${failures.join(' | ')})`);
  }
}

for (const schema of IFC_SCHEMAS) {
  const spec = IFC_SCHEMA_TABLES[schema].attributes.IFCTASK?.find(a => a.startsWith('PredefinedType:E='));
  const literals = spec?.slice('PredefinedType:E='.length).replace(/\?$/, '').split('|') ?? [];
  const missing = TASK_TYPES.filter(t => !literals.includes(t));
  assert(missing.length === 0, `enumtoets: taaktype(n) ${missing.join(', ')} bestaan niet in IfcTaskTypeEnum van ${schema}`);
}

for (const [schema, ifc] of richBySchema) {
  const want = `'-P0Y0M${-RICH_NEGATIVE_TOTAL_FLOAT}D'`;
  assert(ifc.includes(want), `negatieve duur (${schema}): de negatieve speling staat als ${want} in het bestand`);
  const wrong = ifc.match(/'-?P\d+Y\d+M-[^'\n]*'/g) ?? [];
  assert(wrong.length === 0, `negatieve duur (${schema}): geen minteken binnen een duur (kreeg ${wrong.slice(0, 3).join(', ')})`);
}

for (const entity of Object.keys(IFC_SCHEMA_TABLES[DEFAULT_IFC_SCHEMA].attributes)) {
  assert(seen.entities.has(entity), `dekking: ${entity} staat in de tabel maar komt in geen enkel getoetst bestand voor`);
}
for (const schema of IFC_SCHEMAS) assert(seen.schemas.has(schema), `dekking: geen getoetst bestand in ${schema}`);

const writerSources = ['ifcWriter.ts', 'ifcPsets.ts', 'ifcTaskSlots.ts']
  .map(f => readFileSync(join(ROOT, 'src', 'services', 'ifc', f), 'utf8'));
const TYPED_REAL_TOKENS = ['IFCREAL', 'IFCMONETARYMEASURE'];
const writerTokens = new Set<string>([...Object.values(RESOURCE_TYPE_TO_IFC), ...TYPED_REAL_TOKENS]);
for (const src of writerSources) for (const m of src.matchAll(/\b(IFC[A-Z0-9]{3,})\(/g)) writerTokens.add(m[1]);
assert(JSON.stringify(Object.keys(IFC_SCHEMA_TABLES).sort()) === JSON.stringify([...IFC_SCHEMAS].sort()),
  `tabel: de schematabel kent ${Object.keys(IFC_SCHEMA_TABLES).join(', ')}, de app schrijft ${IFC_SCHEMAS.join(', ')} (genereer de tabel opnieuw)`);
for (const token of writerTokens) {
  for (const schema of IFC_SCHEMAS) {
    const table = IFC_SCHEMA_TABLES[schema];
    const known = token in table.attributes || token in table.typedValueKind;
    assert(known, `tabel: de writer gebruikt ${token}, maar die staat niet in de tabel van ${schema} (ifcSchemaTable.ts; genereer opnieuw)`);
  }
  if (token in IFC_SCHEMA_TABLES[DEFAULT_IFC_SCHEMA].typedValueKind) {
    assert(seen.typed.has(token), `dekking: de writer gebruikt ${token}, maar geen getoetst bestand bevat die waarde`);
  }
}

const dumpDir = process.env.OPS_IFC_SCHEMA_DUMP;
if (dumpDir) {
  mkdirSync(dumpDir, { recursive: true });
  for (const [name, ifc] of written) writeFileSync(join(dumpDir, name), ifc, 'utf8');
  console.log(`   (${written.length} geschreven bronnen naar ${dumpDir})`);
}

if (fails.length) {
  for (const f of fails) console.log(`   XX ${f}`);
  console.log(`XX check-ifc-schema: ${fails.length} fout(en) in ${checks} toetsen`);
  process.exit(1);
}
console.log(`OK check-ifc-schema: ${checks} toetsen groen (${seen.entities.size} entiteittypen, ${seen.schemas.size} schema's, ${publicFiles.length} publieke voorbeelden)`);
