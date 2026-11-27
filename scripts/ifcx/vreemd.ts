import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { classifyIfcx, IfcxReadError, readIfcx } from '@/services/ifc/ifcx';

const ACTIVITY_VAN_IFCX_EXPLORER = 'openaec::activity';
const GEDEELDE_ACTIVITY = 'openaec::planning::activity';

interface Geval {
  readonly naam: string;
  readonly bytes: Uint8Array;
}

const isObject = (waarde: unknown): waarde is Record<string, unknown> => typeof waarde === 'object' && waarde !== null && !Array.isArray(waarde);

function bestandenIn(pad: string): string[] {
  if (!statSync(pad).isDirectory()) return [pad];
  return readdirSync(pad).filter(naam => naam.endsWith('.ifcx')).sort().map(naam => join(pad, naam));
}

const hernoemd = (object: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(object).map(([sleutel, waarde]) => [sleutel === ACTIVITY_VAN_IFCX_EXPLORER ? GEDEELDE_ACTIVITY : sleutel, waarde]));

function alsJson(tekst: string): unknown {
  try {
    return JSON.parse(tekst);
  } catch {
    return undefined;
  }
}

function metGedeeldeActivity(tekst: string): string | undefined {
  const bestand = alsJson(tekst);
  if (!isObject(bestand) || !Array.isArray(bestand.data)) return undefined;
  const metActivity = (entry: unknown) => isObject(entry) && isObject(entry.attributes) && ACTIVITY_VAN_IFCX_EXPLORER in entry.attributes;
  if (!bestand.data.some(metActivity)) return undefined;
  const data = bestand.data.map(entry => (isObject(entry) && isObject(entry.attributes)
    ? { ...entry, attributes: hernoemd(entry.attributes) } : entry));
  const schemas = isObject(bestand.schemas) ? hernoemd(bestand.schemas) : bestand.schemas;
  return JSON.stringify({ ...bestand, schemas, data }, null, 2);
}

function gevallenVan(pad: string): Geval[] {
  const tekst = readFileSync(pad, 'utf8');
  const naam = basename(pad);
  const gevallen: Geval[] = [{ naam, bytes: new TextEncoder().encode(tekst) }];
  const kopie = metGedeeldeActivity(tekst);
  if (kopie !== undefined) gevallen.push({ naam: `${naam} met ${GEDEELDE_ACTIVITY}`, bytes: new TextEncoder().encode(kopie) });
  return gevallen;
}

function uitslagVanLezen(bytes: Uint8Array): string {
  try {
    readIfcx(bytes);
    return 'opent het';
  } catch (error) {
    if (error instanceof IfcxReadError) return `weigert met code ${error.code}`;
    return `breekt af (${error instanceof Error ? error.name : typeof error})`;
  }
}

function geweigerdAlsVreemd(geval: Geval): boolean {
  const soort = classifyIfcx(geval.bytes);
  const lezen = uitslagVanLezen(geval.bytes);
  if (soort === 'foreign' && lezen === 'weigert met code foreign') {
    console.log(`OK ${geval.naam}: geweigerd als vreemd (classifyIfcx ${soort}, readIfcx code foreign)`);
    return true;
  }
  console.log(`XX ${geval.naam}: niet geweigerd als vreemd (classifyIfcx ${soort}, readIfcx ${lezen})`);
  return false;
}

function main(): number {
  const paden = process.argv.slice(2);
  if (paden.length === 0) {
    console.error('gebruik: node scripts/run-ts.mjs scripts/ifcx/vreemd.ts <bestand of map met .ifcx>...');
    return 2;
  }
  let gevallen: Geval[];
  try {
    gevallen = paden.flatMap(bestandenIn).flatMap(gevallenVan);
  } catch (error) {
    const code = isObject(error) && typeof error.code === 'string' ? error.code : error instanceof Error ? error.name : typeof error;
    console.error(`De bestanden zijn niet te lezen (${code}): ${paden.join(', ')}`);
    return 2;
  }
  if (gevallen.length === 0) {
    console.error(`Geen IFCX-bestanden in ${paden.join(', ')}`);
    return 2;
  }
  const fouten = gevallen.filter(geval => !geweigerdAlsVreemd(geval)).length;
  console.log(`Vreemde IFCX: ${gevallen.length - fouten} van ${gevallen.length} geweigerd als vreemd`);
  return fouten > 0 ? 1 : 0;
}

process.exitCode = main();
