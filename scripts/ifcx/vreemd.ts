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

function metGedeeldeActivity(tekst: string): string | undefined {
  const bestand: unknown = JSON.parse(tekst);
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
  const gevallen: Geval[] = [{ naam: pad, bytes: new TextEncoder().encode(tekst) }];
  const kopie = metGedeeldeActivity(tekst);
  if (kopie !== undefined) gevallen.push({ naam: `${pad} met ${GEDEELDE_ACTIVITY}`, bytes: new TextEncoder().encode(kopie) });
  return gevallen;
}

function afzenderVan(bytes: Uint8Array): string {
  const bestand: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const kop = isObject(bestand) && isObject(bestand.header) ? bestand.header : {};
  return `author ${JSON.stringify(kop.author)}, id ${JSON.stringify(kop.id)}`;
}

function oordeel(geval: Geval): string | undefined {
  const soort = classifyIfcx(geval.bytes);
  let fout: unknown;
  try {
    readIfcx(geval.bytes);
  } catch (error) {
    fout = error;
  }
  if (soort === 'foreign' && fout instanceof IfcxReadError && fout.code === 'foreign') return fout.message;
  const gelezen = fout instanceof IfcxReadError ? `weigert met ${fout.code}: ${fout.message}` : fout ? `breekt af: ${String(fout)}` : 'opent het';
  console.log(`XX ${geval.naam}: classifyIfcx geeft ${soort} en readIfcx ${gelezen}`);
  return undefined;
}

function main(): number {
  const paden = process.argv.slice(2);
  if (paden.length === 0) {
    console.error('gebruik: node scripts/run-ts.mjs scripts/ifcx/vreemd.ts <bestand of map met .ifcx>...');
    return 2;
  }
  const gevallen = paden.flatMap(bestandenIn).flatMap(gevallenVan);
  if (gevallen.length === 0) {
    console.error(`Geen IFCX-bestanden in ${paden.join(', ')}`);
    return 2;
  }
  let fouten = 0;
  for (const geval of gevallen) {
    const melding = oordeel(geval);
    if (melding === undefined) fouten++;
    else console.log(`OK ${basename(geval.naam)}: geweigerd als vreemd (${afzenderVan(geval.bytes)}): ${melding}`);
  }
  console.log(`Vreemde IFCX: ${gevallen.length - fouten} van ${gevallen.length} geweigerd als vreemd`);
  return fouten > 0 ? 1 : 0;
}

process.exitCode = main();
