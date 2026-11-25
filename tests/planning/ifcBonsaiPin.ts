import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '@/services/ifc/foreign/classify';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { slotTableOf, type IfcSlotTable } from '@/services/ifc/ifcSlotTables';
import { IFC_SCHEMA_TABLES } from './ifcSchemaTable';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PIN_FILE = 'public/examples/showcase-verbouwing-eengezinswoning.ifc';

export const soort = (table: IfcSlotTable, k: number) => table.slots[k].soortVreemd ?? table.slots[k].soort;
export function groupOf(table: IfcSlotTable, k: number): number[] | undefined {
  const main = table.slots[k].volgt ?? table.slots[k].key;
  const members = table.slots.flatMap((slot, j) => (slot.key === main || slot.volgt === main ? [j] : []));
  if (members.length < 2) return undefined;
  return [members.find(j => table.slots[j].key === main)!, ...members.filter(j => table.slots[j].key !== main)];
}

export const NOT_CARRIED: ReadonlySet<string> = new Set(['IfcRelDeclares', 'IfcRelDefinesByProperties']);
export const SAME_AS_WRITER: Readonly<Record<string, string>> = {
  'IfcWorkSchedule (baseline).globalId': 'de kop van een baseline houdt zijn id via zijn GlobalId',
  'IfcWorkSchedule (baseline).name': 'een baselinekop hoort bij de planning via naam en datum in OPS_Baselines',
  'IfcWorkSchedule (baseline).creationDate': 'een baselinekop hoort bij de planning via naam en datum in OPS_Baselines',
  'IfcWorkSchedule (baseline).predefinedType': 'een ander type maakt er geen baseline meer van',
  'IfcWorkSchedule (live).predefinedType': 'BASELINE maakt er een baseline van; elke andere waarde laat de proef staan',
  'IfcRelAssignsToControl.relatedObjectsType': 'in IFC 4.3 (het schema van het voorbeeld) een attribuut dat leeg moet zijn',
  'IfcRelAssignsToProcess.relatedObjectsType': 'in IFC 4.3 (het schema van het voorbeeld) een attribuut dat leeg moet zijn',
};
const BONSAI = [
  "#990001=IFCPERSON($,'Bonsai',$,$,$,$,$,$);",
  "#990002=IFCORGANIZATION($,'Bonsai Org',$,$,$);",
  '#990003=IFCPERSONANDORGANIZATION(#990001,#990002,$);',
  "#990004=IFCAPPLICATION(#990002,'0.8','Bonsai','Bonsai');",
  '#990005=IFCOWNERHISTORY(#990003,#990004,.READWRITE.,.ADDED.,1767268800,#990003,#990004,1767268800);',
  "#990010=IFCRESOURCETIME('Inzet van Bonsai',$,$,$,$,$,$,$,$,$,$,$,$,$,$,$,$,$);",
  "#990011=IFCCOSTVALUE('Prijs van Bonsai',$,$,$,$,$,$,$,$,$);",
  "#990012=IFCQUANTITYCOUNT('Aantal van Bonsai',$,$,3.,$);",
  '#990013=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);',
  '#990014=IFCMEASUREWITHUNIT(IFCCOUNTMEASURE(2.),#990013);',
  "#990020=IFCRELASSIGNSTOCONTROL('0Bonsaiprojectkalender',#990005,'Kalender van Bonsai',$,(#51,#53),$,#38);",
];
const BONSAI_REFERENCE: Readonly<Record<string, string>> = {
  ownerHistory: '#990005', creators: '(#990001)', usage: '#990010', baseCosts: '(#990011)', baseQuantity: '#990012',
  quantityInProcess: '#990014',
};
const codeOf = (type: string, k: number) => {
  const attribute = IFC_SCHEMA_TABLES.IFC4X3_ADD2.attributes[type]?.[k];
  return attribute?.slice(attribute.indexOf(':') + 1).replace(/\?$/, '');
};
function ownToken(code: string | undefined, current: string, key: string): string | undefined {
  if (code === 'S') return `'Bonsai ${key}'`;
  if (code === 'DT') return "'2001-02-03T04:05:00'";
  if (code === 'DU') return "'P9D'";
  if (code === 'G') return `'0Bonsai${current.trim().slice(8)}`;
  const literals = code?.startsWith('E=') ? code.slice(2).split('|') : undefined;
  const other = literals?.find(l => `.${l}.` !== current.trim() && l !== 'USERDEFINED' && l !== 'NOTDEFINED');
  return other ? `.${other}.` : undefined;
}
const otherForm = (token: string) => (/^'[A-Za-z]/.test(token)
  ? `'\\X2\\${token.charCodeAt(1).toString(16).toUpperCase().padStart(4, '0')}\\X0\\${token.slice(2)}` : undefined);

interface Fixture { readonly text: string; readonly distinct: ReadonlySet<string>; readonly carried: ReadonlySet<number> }
export function bonsaiPlanning(file: string): Fixture {
  const original = readFileSync(join(ROOT, file), 'latin1');
  const index = scanForeignStep(new TextEncoder().encode(original));
  const cls = classify(index);
  const lines = new Map<string, string[]>();
  const distinct = new Set<string>();
  const carried = new Set<number>();
  const rewrite = (chunk: number, table: IfcSlotTable, foreign: boolean) => {
    const args = [...index.argTokens(chunk)!];
    table.slots.forEach((slot, k) => {
      const at = `${table.naam}.${slot.key}`;
      const kind = foreign ? soort(table, k) : slot.soort;
      if (groupOf(table, k) || slot.rol) return;
      let next: string | undefined;
      if (slot.bronverwijzing) next = BONSAI_REFERENCE[slot.key];
      else if (kind === 'constant' || kind === 'afgeleid') next = SAME_AS_WRITER[at] ? undefined : ownToken(codeOf(index.type(chunk), k), args[k], slot.key);
      else if (kind === 'domein' && table.naam === 'IfcTask' && slot.key === 'status') next = "'Bonsai: in uitvoering'";
      else if (kind === 'domein' && codeOf(index.type(chunk), k) === 'S' && args[k].trim() !== '$') next = otherForm(args[k].trim());
      else if (kind === 'domein' && /^'P0Y0M\d+D'$/.test(args[k].trim())) next = `'P${args[k].trim().slice(6)}`;
      else if (kind === 'domein' && /^'\d{4}-\d\d-\d\dT\d\d:\d\d:00'$/.test(args[k].trim())) next = `${args[k].trim().slice(0, -4)}'`;
      else if (kind === 'domein' && args[k].trim() === '.WORKTIME.') next = '.NOTDEFINED.';
      else if (kind === 'domein' && table.naam === 'IfcTask' && slot.key === 'priority' && args[k].trim() === '$') next = '500';
      if (next === undefined || next === args[k].trim()) return;
      args[k] = next;
      distinct.add(at);
    });
    lines.set(index.id(chunk), args);
  };
  for (let chunk = 0; chunk < index.count; chunk++) {
    if (!index.isEntity(chunk) || (!cls.selection.inD[chunk] && !cls.inR[chunk])) continue;
    const args = index.argTokens(chunk)!;
    const table = slotTableOf(index.type(chunk), args);
    if (!table || NOT_CARRIED.has(table.naam) || args.length !== table.slots.length) continue;
    carried.add(Number(index.id(chunk)));
    rewrite(chunk, table, true);
    const ownedSlot = table.naam === 'IfcTask' ? 'taskTime' : table.naam === 'IfcRelSequence' ? 'timeLag' : undefined;
    const owned = ownedSlot ? index.refAt(chunk, table.slots.findIndex(s => s.key === ownedSlot)) : -1;
    if (owned >= 0) rewrite(owned, slotTableOf(index.type(owned), index.argTokens(owned)!)!, true);
  }
  let product = false;
  const text = original.split(/\r?\n/).map(line => {
    const m = /^#(\d+)=([A-Z0-9_]+)\(/.exec(line);
    const args = m ? lines.get(m[1]) : undefined;
    const type = m?.[2] === 'IFCLABORRESOURCE' && !product && (product = true) ? 'IFCCONSTRUCTIONPRODUCTRESOURCE' : m?.[2];
    return args ? `#${m![1]}=${type}(${args.join(',')});` : line;
  }).join('\n').replace('ENDSEC;\nEND-ISO', `${BONSAI.join('\n')}\nENDSEC;\nEND-ISO`);
  return { text, distinct, carried };
}
