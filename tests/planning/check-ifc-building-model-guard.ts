// Knownbug 110: gecombineerde 4D-bestanden weigeren vóór documentaanmaak, niet pas bij opslaan.
import './domStub';
import { readIFC } from '@/services/ifc/ifcReader';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { IFC_BUILDING_MODEL_TYPES } from '@/services/ifc/ifcBuildingModelTypes';
import { parseOpenedFile, readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildImportLabels } from '@/i18n/importLabels';
import nl from '@/i18n/locales/nl/common.json';
import en from '@/i18n/locales/en/common.json';

let checks = 0;
const failures: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(label);
}
function rejected(text: string): boolean {
  try { readIFC(text); return false; }
  catch (error) { return error instanceof IfcParseError && error.reason === 'building-model'; }
}
const S = () => useAppStore.getState();
async function main(): Promise<void> {
  S().newProject();
  S().addTask({ name: 'Bestaande planning' });
  const planning = writeIFC(buildWriteIFCInput(S()));
  const add = (record: string) => planning.replace('DATA;', `DATA;\n${record}\n`);
  // Alle schema-subtypen, niet alleen muren of entiteiten met geometrie. Minimale records zijn
  // opzettelijk genoeg: de veiligheidsbeslissing hangt af van het type, niet van referenties.
  for (const type of IFC_BUILDING_MODEL_TYPES) {
    eq(`weigert ${type}`, rejected(add(`#900001=${type}($);`)), true);
  }
  for (const type of ['IFCWALL', 'IFCBUILDING', 'IFCSITE', 'IFCDOOR', 'IFCBRIDGE', 'IFCDUCTSEGMENT', 'IFCWALLTYPE']) {
    eq(`schema-inventaris bevat ${type}`, IFC_BUILDING_MODEL_TYPES.has(type), true);
  }
  eq('kleine letters en commentaar tussen tokens', rejected(add('#900001 = /* model */ ifcwall ( $ );')), true);
  eq('gewone planning opent', readIFC(planning).tasks.length, 1);
  eq('geen tekstmatch in commentaar', readIFC(add('/* #900001=IFCWALL($); */')).tasks.length, 1);
  eq('geen tekstmatch in propertywaarde', readIFC(add("#900001=IFCPROPERTYSINGLEVALUE('test',$,IFCTEXT('#9=IFCWALL($);'),$);")).tasks.length, 1);
  // Meer DATA-secties (ISO 10303-21): een wand in een tweede sectie telt mee. Vóór deze fix stopte de lezer bij de eerste
  // `ENDSEC;`: zo'n bestand opende zonder melding, en opslaan wiste de wand.
  const second = (record: string) => planning.replace(/ENDSEC;(\s*END-ISO-10303-21;)/, `ENDSEC;\nDATA;\n${record}\nENDSEC;$1`);
  eq('weigert een wand in een tweede DATA-sectie', rejected(second("#900001=IFCWALL('x',$);")), true);
  eq('weigert een wand in een tweede DATA-sectie met sectiekop',
    rejected(second("#900001=IFCWALL('x',$);").replace(/\nDATA;\n#900001/, "\nDATA(('deel 2'),('IFC4X3_ADD2'));\n#900001")), true);
  eq('een tweede DATA-sectie zonder model opent', readIFC(second("#900001=IFCPROPERTYSINGLEVALUE('x',$,IFCTEXT('y'),$);")).tasks.length, 1);
  let twoDataReason: string | undefined;
  try {
    await parseOpenedFile({ name: 'fix3-twee-data.ifc', text: readFileSync(resolve('tests/fixtures/ifc-foreign/council/fix3-twee-data.ifc'), 'utf8') });
  } catch (error) { twoDataReason = error instanceof IfcParseError ? error.reason : 'andere fout'; }
  eq('fix3-twee-data (wand in de tweede DATA-sectie): de open-pijplijn zonder flag weigert', twoDataReason, 'building-model');
  // Sol en Terra (review van #870): parameters bij de EERSTE sectiekop. Vóór de fix: `no-data-section`.
  const firstParam = (text: string) => text.replace(/^DATA;$/m, "DATA('deel 1',('IFC4X3_ADD2'));");
  eq('weigert een wand in de enige DATA-sectie met sectiekop', rejected(firstParam(add("#900001=IFCWALL('x',$);"))), true);
  eq('een enige DATA-sectie met sectiekop zonder model opent', readIFC(firstParam(planning)).tasks.length, 1);
  // De echte opgeslagen voorbeelden bewaken context, taken, resources, kalenders en lege modellen.
  for (const file of readdirSync(resolve('public/examples')).filter(f => f.endsWith('.ifc'))) {
    const content = readFileSync(resolve('public/examples', file), 'utf8');
    const parsed = await readIFCWithXerReconstruction(content);
    eq(`voorbeeld ${file} opent`, typeof parsed.project.name, 'string');
  }
  const combined = add("#900001=IFCWALL('0YvctVUKr0kugbFTf53O9L',$,'Muur',$,$,$,$,$,.NOTDEFINED.);");
  const before = S().activeDocumentId;
  const beforeTasks = JSON.stringify(S().tasks);
  let reason: string | undefined;
  try {
    const parsed = await parseOpenedFile({ name: 'samengevoegd.ifc', text: combined });
    S().openAsDocument(parsed, { name: 'samengevoegd.ifc', ref: { kind: 'path', path: '/tmp/samengevoegd.ifc' } });
  } catch (error) { reason = error instanceof IfcParseError ? error.reason : 'andere fout'; }
  eq('echte open-pijplijn weigert vóór koppelen bronpad', reason, 'building-model');
  eq('actief document blijft', S().activeDocumentId, before);
  eq('bestaand werk blijft', JSON.stringify(S().tasks), beforeTasks);
  eq('geen bronpad gekoppeld', S().filePath, null);
  for (const [lang, locale] of [['nl', nl], ['en', en]] as const) {
    const labels = buildImportLabels(key => key === 'project.ifcBuildingModelUnsupported' ? locale.project.ifcBuildingModelUnsupported : key);
    let message: string | undefined;
    try { readIFC(combined, labels); } catch (error) { message = error instanceof Error ? error.message : undefined; }
    eq(`vertaalde uitleg ${lang}`, message, locale.project.ifcBuildingModelUnsupported);
  }
  console.log(`${checks - failures.length}/${checks} IFC-bouwmodelbeveiligingschecks groen`);
  for (const failure of failures) console.error(`XX ${failure}`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
