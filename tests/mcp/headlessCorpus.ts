import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { brokenNameFiles, DATA_KOP_VORMEN, metDataKop } from '../planning/ifcDoelBestanden';

export type HeadlessStand = 'eigen' | 'onzeker';

export interface OwnCase {
  readonly name: string;
  readonly bytes: Buffer;
  readonly stand: HeadlessStand;
}

export interface ForeignCase {
  readonly name: string;
  readonly bytes: Buffer;
  readonly pieces: readonly string[];
}

export const OLD_TASK_NAME = String.raw`Set up \X2\00E9\X0\ site`;
export const SCANNER_ID_LIMIT = 2147483648;

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const END = 'ENDSEC;\nEND-ISO-10303-21;';
const SCHEMA = "FILE_SCHEMA(('IFC4X3_ADD2'));";

function villaText(root: string): string {
  return readFileSync(join(root, 'public', 'examples', '10-villa-wassenaar.ifc'), 'utf8');
}

function withId(text: string, from: number, to: number): string {
  return text.replace(new RegExp(`#${from}(?![0-9])`, 'g'), `#${to}`);
}

export function oldOwnSource(root: string): string {
  const villa = villaText(root);
  const task = "#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',#6,'Set up site'";
  if (!villa.includes(task)) throw new Error('de villa heeft de taak Set up site niet meer');
  return villa.replace("#5=IFCAPPLICATION(#4,'0.2',", "#5=IFCAPPLICATION(#4,'0.1',")
    .replace(task, `#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',$,'${OLD_TASK_NAME}'`);
}

export function ownCorpus(root: string): OwnCase[] {
  const files = [join(root, 'examples'), join(root, 'public', 'examples')]
    .flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.ifc')).sort().map(name => join(dir, name)));
  const cases: OwnCase[] = files.map(file => ({ name: `${basename(dirname(file))}-${basename(file)}`, bytes: readFileSync(file), stand: 'eigen' }));
  const villa = Buffer.from(villaText(root));
  const text = villa.toString('utf8');
  const at = villa.indexOf("'New-Build Villa") + 1;
  if (at <= 0) throw new Error('de projectnaam van de villa');
  const rawByte = Buffer.concat([villa.subarray(0, at), Buffer.from([0xe9]), villa.subarray(at)]);
  cases.push(
    { name: 'villa-met-bom.ifc', bytes: Buffer.concat([BOM, villa]), stand: 'eigen' },
    { name: 'villa-met-bom-en-spatie.ifc', bytes: Buffer.concat([BOM, Buffer.from(' '), villa]), stand: 'eigen' },
    { name: 'villa-met-los-byte.ifc', bytes: rawByte, stand: 'eigen' },
    { name: 'villa-met-bom-en-los-byte.ifc', bytes: Buffer.concat([BOM, rawByte]), stand: 'eigen' },
    { name: 'villa-ifc2x3.ifc', bytes: Buffer.from(text.replace(SCHEMA, "FILE_SCHEMA(('IFC2X3'));")), stand: 'eigen' },
    { name: 'villa-oude-bron.ifc', bytes: Buffer.from(oldOwnSource(root)), stand: 'eigen' },
    { name: 'villa-id-boven-scannergrens.ifc', bytes: Buffer.from(withId(text, 52, SCANNER_ID_LIMIT + 52)), stand: 'onzeker' },
    ...DATA_KOP_VORMEN.map((vorm): OwnCase => ({
      name: `villa-${vorm.id}.ifc`, bytes: Buffer.from(metDataKop(text, vorm), 'utf8'), stand: vorm.scannerWeigert ? 'onzeker' : 'eigen',
    })),
    ...brokenNameFiles(text).map(([name, variant]): OwnCase => ({ name: `villa-${name}.ifc`, bytes: Buffer.from(variant, 'utf8'), stand: 'onzeker' })),
  );
  return cases;
}

export function foreignCorpus(root: string): ForeignCase[] {
  const villa = villaText(root);
  const owners = [['project', 13], ['taak', 52], ['kalender', 39]] as const;
  const schemas = ['IFC4X3_ADD2', 'IFC4X3_ADD1', 'IFC4', 'IFC2X3'] as const;
  const cases: ForeignCase[] = [];
  for (const [owner, ownerId] of owners) {
    for (const schema of schemas) {
      for (const first of [99001, SCANNER_ID_LIMIT]) {
        const pieces = [
          `#${first}=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('van een ander programma'),$);`,
          `#${first + 1}=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#${first}));`,
          `#${first + 2}=IFCRELDEFINESBYPROPERTIES('0abcdefghijkmnopqrstuw',$,$,$,(#${ownerId}),#${first + 1});`,
        ];
        const text = villa.replace(SCHEMA, `FILE_SCHEMA(('${schema}'));`).replace(END, [...pieces, END].join('\n'));
        if (!text.includes(pieces[2]) || !text.includes(`FILE_SCHEMA(('${schema}'))`)) throw new Error('de villa veranderde');
        const ids = first === 99001 ? 'gewone-ids' : 'ids-boven-scannergrens';
        for (const bom of [false, true]) {
          cases.push({
            name: `pset-aan-${owner}-${schema}-${ids}${bom ? '-bom' : ''}.ifc`,
            bytes: bom ? Buffer.concat([BOM, Buffer.from(text)]) : Buffer.from(text),
            pieces,
          });
        }
      }
    }
  }
  return cases;
}
