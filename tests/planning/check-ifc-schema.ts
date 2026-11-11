// IFC-SCHEMAPOORT: elke entiteit die de OPS-writer schrijft, is geldig volgens het schema in de kop van
// het bestand (IFC4X3_ADD2, de standaard, of IFC4X3 of IFC4: de schemakeuze per project), zonder
// Python in CI. Toelichting en geschiedenis: docs/ifc-round-trip.md, alinea "Schemageldigheid".
//
// WAT DEZE POORT TOETST (de toets per bestand staat in `ifcSchemaCheck.ts`)
//   1. Elke regel `#id=IFCXXX(...)` tegen de tabel van het schema in de kop (`ifcSchemaTable.ts`,
//      gegenereerd uit de EXPRESS-schema's door `scripts/ifc-schema-table.py`, zie daar). De enum-
//      literals verschillen per schema: `.INSPECTION.` (IfcTaskTypeEnum) is geldig in IFC 4.3 en
//      ongeldig in IFC4. Getoetst worden: het aantal attributen, `$`
//      alleen op een OPTIONAL plek, `*` alleen op een afgeleide plek, een enum op de enum-plek met een
//      toegestane literal, REAL met decimale punt, INTEGER zonder, tekst als string, de vorm van
//      GlobalId, IfcDateTime (met seconden), IfcDate, IfcTime en IfcDuration, een verwijzing die bestaat
//      en naar een toegestaan entiteittype wijst, een getypte waarde die de select toestaat (met de
//      juiste inhoud), SET/LIST met minimaal het vereiste aantal elementen en een SET zonder dubbele
//      elementen.
//   2. Een kleine set WHERE-regels uit IFC4X3_ADD2 die OPS kan raken (zie `checkRules`), en de
//      header: elk bestand noemt een schema met een tabel; de voorbeelden en het rijke project per
//      schema noemen precies het verwachte schema.
//   3. Bronnen: de committe voorbeelden (`public/examples/*.ifc` — de acht publieke — en
//      `examples/*.ifc`); een RIJK project dat hier met de echte writer wordt geschreven, in ELK van de
//      drie schema's (alle resourcetypen, ploegen, baselines (ook een zonder taken), werkende uitzonderingen,
//      bibliotheekkalenders, alle eigen-veldtypen, procent-lag, voortgang, negatieve speling, …); een
//      leeg project;
//      kalenderrandgevallen; en een XER-import met bronarchief (`OPS_XerSourceArchive`). Zie
//      ifcSchemaFixture.ts. De round-trip-fixture (splits, contouren, timephased, P6-voortgang) toetst
//      `check-ifc-roundtrip.ts` (19).
//   4. Dekking: elke entiteit uit de tabel en elke getypte waarde die de writer gebruikt, komt minstens
//      één keer voor in wat hier getoetst wordt. Zo kan het rijke project niet stil verarmen.
//   5. Volledigheid van de tabel: de writerbronnen worden gescand op `IFCXXX(`; elke naam moet in de
//      tabel van elk schema staan. Een nieuwe entiteit in de writer zonder tabelregel is rood. De tabel
//      kent precies de schema's die de app schrijft (`IFC_SCHEMAS`).
//
// Lokaal tegen IfcOpenShell valideren: `OPS_IFC_SCHEMA_DUMP=/tmp/dir bash tests/planning/run.sh
// check-ifc-schema.ts` schrijft de geschreven bronnen als .ifc naar die map.
//
// Draait via run.sh. Exit 0 = alles groen.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
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

// ── 1. De committe voorbeelden ───────────────────────────────────────────────────────────────────

const seen = newSeen();
const ifcFiles = (dir: string) => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.ifc')).sort();
const publicFiles = ifcFiles('public/examples');
assert(publicFiles.length >= 8, `public/examples: verwacht minstens de 8 publieke voorbeelden, vond ${publicFiles.length}`);
for (const f of publicFiles) checkFile(`public/examples/${f}`, readFileSync(join(ROOT, 'public/examples', f), 'utf8'), seen, DEFAULT_IFC_SCHEMA);
for (const f of ifcFiles('examples')) checkFile(`examples/${f}`, readFileSync(join(ROOT, 'examples', f), 'utf8'), seen, DEFAULT_IFC_SCHEMA);

// ── 2. Geschreven met de echte writer ────────────────────────────────────────────────────────────
// Inhoud: zie tests/planning/ifcSchemaFixture.ts. Het lege project dekt de verplichte attributen
// zonder bronwaarde: IfcWorkPlan/IfcWorkSchedule.StartTime, IfcOrganization.Name, en de WHERE-regels
// HasName (IfcProject) en IdentifiablePerson (IfcPerson). De kalenderrandgevallen dekken lege
// WeekdayComponent/TimePeriods (`$`, geen `()`).
const rich = buildRichSchemaProject(ROOT);
const written: [string, string][] = [];
const inSchema = (p: ImportResult, schema: IfcSchemaId): ImportResult => ({ ...p, project: { ...p.project, ifcSchema: schema } });
// Het rijke project in elk schema dat de app schrijft; de tabel volgt de kop.
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
// Kostenresource (#815): de drager is in elk schema geldig (de vormtoets hierboven keurt het bestand).
for (const [schema, ifc] of richBySchema) {
  assert(/IFCCONSTRUCTIONMATERIALRESOURCE\('[^']{22}',#\d+,'Leges',[^\n]*,'COST',[^\n]*\.USERDEFINED\.\);/.test(ifc),
    `rijk project (${schema}): testvoorwaarde — een kostenresource als IFCCONSTRUCTIONMATERIALRESOURCE met 'COST' en .USERDEFINED.`);
}

// ── 3. De vormtoets zelf: een fout GlobalId en een tijd zonder seconden zijn rood ─────────────────
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

// ── 3b. Enum-literals per schema: `.INSPECTION.` (IfcTaskTypeEnum) bestaat in IFC 4.3, niet in IFC4 ──
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

// Elk taaktype dat de app kent, is in elk schema een geldige IfcTaskTypeEnum-literal (de rijke fixture
// heeft niet elk taaktype; zo kan een nieuw taaktype dat alleen in IFC 4.3 bestaat de IFC4-uitvoer niet
// stil ongeldig maken).
for (const schema of IFC_SCHEMAS) {
  const spec = IFC_SCHEMA_TABLES[schema].attributes.IFCTASK?.find(a => a.startsWith('PredefinedType:E='));
  const literals = spec?.slice('PredefinedType:E='.length).replace(/\?$/, '').split('|') ?? [];
  const missing = TASK_TYPES.filter(t => !literals.includes(t));
  assert(missing.length === 0, `enumtoets: taaktype(n) ${missing.join(', ')} bestaan niet in IfcTaskTypeEnum van ${schema}`);
}

// ── 3c. Negatieve duur: het minteken staat vóór de P (`-P0Y0M2D`), niet bij het getal ─────────────
for (const [schema, ifc] of richBySchema) {
  const want = `'-P0Y0M${-RICH_NEGATIVE_TOTAL_FLOAT}D'`;
  assert(ifc.includes(want), `negatieve duur (${schema}): de negatieve speling staat als ${want} in het bestand`);
  const wrong = ifc.match(/'-?P\d+Y\d+M-[^'\n]*'/g) ?? [];
  assert(wrong.length === 0, `negatieve duur (${schema}): geen minteken binnen een duur (kreeg ${wrong.slice(0, 3).join(', ')})`);
}

// ── 4. Dekking ───────────────────────────────────────────────────────────────────────────────────
for (const entity of Object.keys(IFC_SCHEMA_TABLES[DEFAULT_IFC_SCHEMA].attributes)) {
  assert(seen.entities.has(entity), `dekking: ${entity} staat in de tabel maar komt in geen enkel getoetst bestand voor`);
}
for (const schema of IFC_SCHEMAS) assert(seen.schemas.has(schema), `dekking: geen getoetst bestand in ${schema}`);

// ── 5. Volledigheid van de tabel t.o.v. de writerbronnen ─────────────────────────────────────────
const writerSources = ['ifcWriter.ts', 'ifcPsets.ts', 'ifcTaskSlots.ts']
  .map(f => readFileSync(join(ROOT, 'src', 'services', 'ifc', f), 'utf8'));
const writerTokens = new Set<string>(Object.values(RESOURCE_TYPE_TO_IFC));
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

// ── Optioneel: schrijf de geschreven bronnen weg voor IfcOpenShell ────────────────────────────────
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
