import type { SlotSoort } from '../ifcSlotSoort';
import { sameDomainEntity, type IfcSlotTable } from '../ifcSlotTables';
import type { SourcePieceSlots } from './sourceSlots';

const soortVreemd = (table: IfcSlotTable, k: number): SlotSoort => table.slots[k].soortVreemd ?? table.slots[k].soort;

const hasReference = (token: string) => /#\d/.test(token.replace(/'(?:[^']|'')*'/g, "''"));

const GROUPS = new WeakMap<IfcSlotTable, ReadonlyMap<number, readonly number[]>>();

function groupsOf(table: IfcSlotTable): ReadonlyMap<number, readonly number[]> {
  let groups = GROUPS.get(table);
  if (groups) return groups;
  const at = new Map(table.slots.map((slot, k) => [slot.key, k]));
  const byMain = new Map<number, number[]>();
  table.slots.forEach((slot, k) => {
    if (slot.volgt === undefined) return;
    const main = at.get(slot.volgt)!;
    const members = byMain.get(main) ?? [main];
    members.push(k);
    byMain.set(main, members);
  });
  groups = new Map([...byMain.values()].flatMap(members => members.map(k => [k, members] as const)));
  GROUPS.set(table, groups);
  return groups;
}

export function writerAlwaysWrites(table: IfcSlotTable, k: number): boolean {
  const soort = soortVreemd(table, k);
  return (soort === 'afgeleid' || soort === 'verwijzing') && table.slots[k].rol === undefined && !groupsOf(table).has(k);
}

export function sourceSlotArgs(table: IfcSlotTable, piece: SourcePieceSlots, written: readonly string[],
  before: readonly string[] = written, fieldChanged: (k: number) => boolean = () => false): string[] {
  const source = table.slots.map(slot => piece.slots.get(slot.key)?.trim());
  const unchanged = (k: number) => written[k].trim() === before[k].trim() && !fieldChanged(k);
  const usable = (k: number) => source[k] !== undefined && (table.slots[k].bronverwijzing === true || !hasReference(source[k]!));
  const ownRule = (k: number) => {
    const soort = soortVreemd(table, k);
    return usable(k) && (soort === 'constant' || (soort === 'domein' && unchanged(k)));
  };
  const groups = groupsOf(table);
  const fromSource = (k: number) => {
    const group = groups.get(k);
    if (!group) return ownRule(k);
    const [main, ...dependents] = group;
    return ownRule(main) && dependents.every(d => usable(d) && unchanged(d));
  };
  return written.map((token, k) => (fromSource(k) ? source[k]! : token));
}

export function sourceEntity(table: IfcSlotTable, piece: SourcePieceSlots, written: string): string {
  return sameDomainEntity(table, piece.entity, written) ? piece.entity : written;
}
