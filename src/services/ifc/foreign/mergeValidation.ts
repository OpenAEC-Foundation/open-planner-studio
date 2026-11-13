/** Onafhankelijke controle van de samengestelde bytes, zonder regels of ids uit het schrijfplan.
 * Scanner en verliesbewaking leveren de bestaande STEP- en IfcRoot-kennis; hier staat alleen
 * de vergelijking met de bron (ontwerp §4.10, controles 1 en 2).
 */
import { classify, type Classification } from './classify';
import { isRootLine, refsOutsideText } from './lossCheck';
import { scanStep, type StepIndex } from './stepScanner';

/** De eigenaren van een pset via IfcRelDefinesByProperties, als stuknummers. */
export function psetOwners(index: StepIndex, pset: number): number[] {
  const owners: number[] = [];
  for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
    const rel = index.inSource(k);
    if (rel >= 0 && index.type(rel) === 'IFCRELDEFINESBYPROPERTIES' && index.inArg(k) === 5) {
      owners.push(...index.refsAt(rel, 4));
    }
  }
  return owners;
}

const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const chunkBytes = (index: StepIndex, bytes: Uint8Array, i: number) => bytes.subarray(index.start(i), index.end(i));
const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

/** Een vreemd lid blijft aan hetzelfde object en dezelfde psetnaam, ook als de pset een nieuw id kreeg. */
function bindings(index: StepIndex, memberId: string): Map<string, number> {
  const result = new Map<string, number>(), member = index.chunkOf(memberId);
  if (member < 0) return result;
  for (let k = index.inStart(member); k < index.inEnd(member); k++) {
    const parent = index.inSource(k), type = index.type(parent), name = index.name(parent);
    if (type === 'IFCPROPERTYSET' && index.inArg(k) === 4) {
      for (const owner of psetOwners(index, parent)) add(result, JSON.stringify([index.id(owner), name]));
    } else if (type === 'IFCPROPERTYSETTEMPLATE' && index.inArg(k) === 6) {
      add(result, JSON.stringify(['template', name]));
    }
  }
  return result;
}

/** Reeds bestaande gebreken mogen blijven; de uitvoer mag er geen toevoegen. */
function structuralCounts(index: StepIndex): { dangling: Map<string, number>; guids: Map<string, number>; members: Map<string, number> } {
  const dangling = new Map<string, number>(), guids = new Map<string, number>(), members = new Map<string, number>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    const args = index.argTokens(i);
    if (args) {
      for (let arg = 0; arg < args.length; arg++) for (const id of refsOutsideText(args[arg])) {
        if (index.chunkOf(String(id)) < 0) add(dangling, `${index.id(i)}|${arg}|${id}`);
      }
      // Concrete IfcRoot-typen hebben naast hun vier basisslots minstens één eigen slot.
      // Een IFCPROPERTYSINGLEVALUE met een naam van 22 tekens heeft er vier en draagt geen GlobalId.
      if (args.length >= 5 && isRootLine({ args })) add(guids, args[0].trim());
    }
    const type = index.type(i);
    if (type === 'IFCRELAGGREGATES' || type === 'IFCRELNESTS' || type === 'IFCRELDECLARES') {
      for (const member of index.refsAt(i, 5)) add(members, `${type}|${index.id(member)}`);
    }
  }
  return { dangling, guids, members };
}

export function validateMergeOutput(source: StepIndex, sourceClasses: Classification, sourceBytes: Uint8Array,
  bytes: Uint8Array): { index: StepIndex; classification: Classification; problems: string[] } {
  // Ook dubbele #ids en ongeldige STEP worden door de bestaande scanner geweigerd.
  const index = scanStep(bytes), classification = classify(index), problems: string[] = [];
  const preserved: number[] = [];
  for (let i = 0; i < source.count; i++) if (sourceClasses.classes[i] !== 1) preserved.push(i);
  const actual: number[] = [];
  for (let i = 0; i < index.count; i++) {
    const original = index.isEntity(i) ? source.chunkOf(index.id(i)) : -1;
    if (!index.isEntity(i) || (original >= 0 && sourceClasses.classes[original] !== 1)) actual.push(i);
    else if (classification.classes[i] !== 1) problems.push(`extra niet-P-stuk #${index.id(i)}`);
  }
  if (preserved.length !== actual.length) problems.push(`niet-P-stukken: ${preserved.length} → ${actual.length}`);
  for (let j = 0; j < Math.min(preserved.length, actual.length); j++) {
    const before = preserved[j], after = actual[j];
    if (source.id(before) !== index.id(after)
      || !equalBytes(chunkBytes(source, sourceBytes, before), chunkBytes(index, bytes, after))) {
      problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} ontbreekt, is gewijzigd of verplaatst`);
    }
  }
  for (const member of sourceClasses.foreignMembers) {
    const id = source.id(member), expected = bindings(source, id), shown = bindings(index, id);
    if (expected.size !== shown.size || [...expected].some(([key, count]) => shown.get(key) !== count)) {
      problems.push(`vreemd lid #${id} hangt niet meer aan hetzelfde object en dezelfde psetnaam`);
    }
  }
  const before = structuralCounts(source), after = structuralCounts(index);
  for (const [key, count] of after.dangling) if (count > (before.dangling.get(key) ?? 0)) problems.push(`nieuwe loze verwijzing ${key}`);
  for (const [key, count] of after.guids) if (count > Math.max(1, before.guids.get(key) ?? 0)) problems.push(`nieuwe dubbele GlobalId ${key}`);
  for (const [key, count] of after.members) if (count > Math.max(1, before.members.get(key) ?? 0)) problems.push(`nieuw dubbel lidmaatschap ${key}`);
  return { index, classification, problems };
}
