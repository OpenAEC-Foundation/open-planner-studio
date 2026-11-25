import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { brokenNameFiles, DATA_KOP_VORMEN, metDataKop } from '../planning/ifcDoelBestanden';
import { IFC_SLOT_TABLES, type IfcSlotTable } from '@/services/ifc/ifcSlotTables';
import { ABSENT_SLOT, type SlotSpec } from '@/services/ifc/ifcSlotSoort';
import { splitStepArgs } from '@/services/ifc/foreign/stepScanner';
import { slotTableOf } from '@/services/ifc/foreign/targetForeignScan';
import { IFC_SCHEMA_TABLES } from '../planning/ifcSchemaTable';

export type HeadlessStand = 'eigen' | 'onzeker';

export interface OwnCase {
  readonly name: string;
  readonly bytes: Buffer;
  readonly stand: HeadlessStand;
  readonly opens: boolean;
}

export interface ForeignCase {
  readonly name: string;
  readonly bytes: Buffer;
  readonly pieces: readonly string[];
  readonly kept: boolean;
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
  const cases: OwnCase[] = files.map(file => ({ name: `${basename(dirname(file))}-${basename(file)}`, bytes: readFileSync(file), stand: 'eigen', opens: true }));
  const villa = Buffer.from(villaText(root));
  const text = villa.toString('utf8');
  const at = villa.indexOf("'New-Build Villa") + 1;
  if (at <= 0) throw new Error('de projectnaam van de villa');
  const rawByte = Buffer.concat([villa.subarray(0, at), Buffer.from([0xe9]), villa.subarray(at)]);
  cases.push(
    { name: 'villa-met-bom.ifc', bytes: Buffer.concat([BOM, villa]), stand: 'eigen', opens: true },
    { name: 'villa-met-bom-en-spatie.ifc', bytes: Buffer.concat([BOM, Buffer.from(' '), villa]), stand: 'eigen', opens: true },
    { name: 'villa-met-los-byte.ifc', bytes: rawByte, stand: 'eigen', opens: true },
    { name: 'villa-met-bom-en-los-byte.ifc', bytes: Buffer.concat([BOM, rawByte]), stand: 'eigen', opens: true },
    { name: 'villa-ifc2x3.ifc', bytes: Buffer.from(text.replace(SCHEMA, "FILE_SCHEMA(('IFC2X3'));")), stand: 'eigen', opens: true },
    { name: 'villa-oude-bron.ifc', bytes: Buffer.from(oldOwnSource(root)), stand: 'eigen', opens: true },
    { name: 'villa-id-boven-scannergrens.ifc', bytes: Buffer.from(withId(text, 52, SCANNER_ID_LIMIT + 52)), stand: 'onzeker', opens: true },
    ...DATA_KOP_VORMEN.map((vorm): OwnCase => ({
      name: `villa-${vorm.id}.ifc`, bytes: Buffer.from(metDataKop(text, vorm), 'utf8'), stand: vorm.scannerWeigert ? 'onzeker' : 'eigen',
      opens: vorm.kop.toUpperCase() === 'DATA;' && vorm.overgang === undefined && vorm.naam === undefined,
    })),
    ...brokenNameFiles(text).map(([name, variant]): OwnCase => ({
      name: `villa-${name}.ifc`, bytes: Buffer.from(variant, 'utf8'), stand: 'onzeker', opens: true,
    })),
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
            kept: schema !== 'IFC2X3' && first === 99001,
          });
        }
      }
    }
  }
  return cases;
}

export type SlotOrigin = 'eigen' | 'vreemd';

export interface SlotCase {
  readonly name: string;
  readonly bytes: Buffer;
  readonly table: IfcSlotTable;
  readonly slot: SlotSpec;
  readonly origin: SlotOrigin;
  readonly value: string;
  readonly line: string;
  readonly find: { readonly type: string; readonly guid: string; readonly via?: string };
}

export const FOREIGN_SLOT_TEXT = "'Waarde van een ander programma'";
const FOREIGN_PERSON = 99901;
const FOREIGN_GLOBAL_ID = "'0AnderPakket0000000001'";
const FOREIGN_APPLICATION = 99902;
const FOREIGN_OWNER_HISTORY = 99903;

interface StepLine { readonly text: string; readonly id: number; readonly type: string; readonly args: string[] }

function stepLines(text: string): StepLine[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const m = /^#(\d+)=([A-Z0-9_]+)\((.*)\);$/.exec(line);
    return m ? [{ text: line, id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]) }] : [];
  });
}

const lineText = (l: StepLine, args: readonly string[]) => `#${l.id}=${l.type}(${args.join(',')});`;
const isRoot = (table: IfcSlotTable) => table.slots.some(slot => slot.key === 'ownerHistory');

export function effectiveSoort(slot: SlotSpec, origin: SlotOrigin) {
  return origin === 'vreemd' ? slot.soortVreemd ?? slot.soort : slot.soort;
}

export interface SlotCaseSpec { readonly table: IfcSlotTable; readonly slot: SlotSpec; readonly origin: SlotOrigin }

export const slotCaseLabel = (c: SlotCaseSpec) => `${c.table.naam}.${c.slot.key} ${c.origin}`;

export function slotCaseSpecs(): SlotCaseSpec[] {
  const specs: SlotCaseSpec[] = [];
  for (const table of IFC_SLOT_TABLES) {
    for (const slot of table.slots) {
      for (const origin of ['eigen', 'vreemd'] as const) {
        const soort = effectiveSoort(slot, origin);
        const wanted = soort === 'constant' ? origin === 'eigen' || isRoot(table) || slot.soortVreemd !== undefined
          : soort === 'domein' && origin === 'vreemd' && slot.key !== 'globalId';
        if (wanted) specs.push({ table, slot, origin });
      }
    }
  }
  return specs;
}

function valueFor(code: string | undefined, current: string): string | undefined {
  const schema = IFC_SCHEMA_TABLES.IFC4X3_ADD2;
  const body = (code === undefined ? 'S' : code.slice(code.indexOf(':') + 1)).replace(/\?$/, '');
  const list = /^(?:SET|LIST)\d+:(.*)$/.exec(body);
  const kind = list ? list[1] : body;
  const one = (k: string): string | undefined => {
    if (k === 'G') return current === FOREIGN_GLOBAL_ID ? undefined : FOREIGN_GLOBAL_ID;
    if (k === '*') return undefined;
    if (k.startsWith('#=')) return `#${FOREIGN_PERSON}`;
    if (k.startsWith('E=')) return k.slice(2).split('|').map(l => `.${l}.`).find(l => l !== current);
    if (k.startsWith('V=')) {
      const type = schema.selects[k.slice(2)]?.types[0];
      const inner = type ? one(schema.typedValueKind[type] ?? 'S') : undefined;
      return type && inner ? `${type}(${inner})` : FOREIGN_SLOT_TEXT;
    }
    if (k === 'DT') return "'2031-01-01T08:00:00'";
    if (k === 'DA') return "'2031-01-01'";
    if (k === 'DU') return "'PT7H'";
    if (k === 'B' || k === 'L') return current === '.T.' ? '.F.' : '.T.';
    if (k.startsWith('R') || k === 'N') return '0.37';
    if (k.startsWith('I')) return '7';
    return FOREIGN_SLOT_TEXT;
  };
  const value = one(kind);
  return value && list ? `(${value})` : value;
}

function examples(root: string): string[] {
  const dir = join(root, 'public', 'examples');
  const villa = join(dir, '10-villa-wassenaar.ifc');
  return [villa, ...readdirSync(dir).filter(n => n.endsWith('.ifc')).sort().map(n => join(dir, n)).filter(p => p !== villa)];
}

export function slotCorpus(root: string): SlotCase[] {
  const sources = examples(root).map(path => readFileSync(path, 'utf8'));
  const cases: SlotCase[] = [];
  for (const spec of slotCaseSpecs()) {
    const { table, slot, origin } = spec;
    const label = slotCaseLabel(spec);
    let made: SlotCase | undefined;
    for (const text of sources) {
      const lines = stepLines(text);
      const target = lines.find(l => slotTableOf(l.type, l.args) === table && table.positions(l.args)[slot.key] !== ABSENT_SLOT);
      if (!target) continue;
      const at = table.positions(target.args)[slot.key];
      const owner = isRoot(table) ? target : lines.find(l => {
        const t = slotTableOf(l.type, l.args);
        return t !== undefined && isRoot(t) && l.args.includes(`#${target.id}`);
      });
      if (!owner) continue;
      const ownerTable = slotTableOf(owner.type, owner.args)!;
      const via = owner === target ? undefined : ownerTable.slots.find(s => owner.args[ownerTable.positions(owner.args)[s.key]] === `#${target.id}`)?.key;
      const code = IFC_SCHEMA_TABLES.IFC4X3_ADD2.attributes[target.type]?.[table.slots.indexOf(slot)];
      const value = slot.key === 'ownerHistory' ? `#${FOREIGN_OWNER_HISTORY}` : valueFor(code, target.args[at] ?? '$');
      if (value === undefined) break;
      const args = [...target.args];
      args[at] = value;
      const ownerArgs = owner === target ? args : [...owner.args];
      const ownerAt = ownerTable.positions(owner.args).ownerHistory;
      if (origin === 'vreemd' && slot.key !== 'ownerHistory') ownerArgs[ownerAt] = '$';
      const line = lineText(target, args);
      let changed = text.replace(target.text, line);
      if (owner !== target) changed = changed.replace(owner.text, lineText(owner, ownerArgs));
      const actor = lines.find(l => l.type === 'IFCPERSONANDORGANIZATION');
      const organization = lines.find(l => l.type === 'IFCORGANIZATION');
      const extra = value.includes(`#${FOREIGN_PERSON}`) ? [`#${FOREIGN_PERSON}=IFCPERSON($,'Pakket','Ander',$,$,$,$,$);`]
        : value === `#${FOREIGN_OWNER_HISTORY}` ? [
          `#${FOREIGN_APPLICATION}=IFCAPPLICATION(#${organization!.id},'1.0','Ander pakket','ANDER');`,
          `#${FOREIGN_OWNER_HISTORY}=IFCOWNERHISTORY(#${actor!.id},#${FOREIGN_APPLICATION},$,.NOCHANGE.,$,$,$,0);`,
        ] : [];
      changed = changed.replace(END, [...extra, END].join('\n'));
      if (!changed.includes(line) || extra.some(e => !changed.includes(e))) throw new Error(`${label}: het voorbeeld veranderde niet zoals bedoeld`);
      const guid = owner.args[0];
      made = {
        name: `slot-${table.naam.replace(/[^A-Za-z]+/g, '-')}-${slot.key}-${origin}.ifc`, bytes: Buffer.from(changed), table, slot, origin, value, line,
        find: { type: owner.type, guid, ...(via ? { via } : {}) },
      };
      break;
    }
    if (!made) throw new Error(`${label}: geen voorbeeld met een stuk voor dit slot`);
    cases.push(made);
  }
  return cases;
}

export function slotValueIn(text: string, c: SlotCase): string | undefined {
  const lines = stepLines(text);
  const owner = lines.find(l => l.type === c.find.type && l.args[0] === c.find.guid);
  if (!owner) return undefined;
  const ownerTable = slotTableOf(owner.type, owner.args);
  const ref = c.find.via && ownerTable ? owner.args[ownerTable.positions(owner.args)[c.find.via]] : undefined;
  const line = c.find.via ? lines.find(l => `#${l.id}` === ref) : owner;
  return line?.args[c.table.positions(line.args)[c.slot.key]];
}

export const REVIEW_TASK = "#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',#6,'Set up site',$,$,'1.1',$,$,$,.F.,$,#51,.LOGISTIC.);";
export const REVIEW_WORK_METHOD = "'Werkwijze uit ander pakket'";

export function foreignWorkMethodSource(root: string): Buffer {
  const villa = villaText(root);
  const task = `#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',$,'Set up site',$,$,'1.1',$,$,${REVIEW_WORK_METHOD},.F.,$,#51,.LOGISTIC.);`;
  if (!villa.includes(REVIEW_TASK)) throw new Error('de villa heeft taak #52 niet meer zoals in de review');
  return Buffer.from(villa.replace(REVIEW_TASK, task));
}
