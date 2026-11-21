/** Onafhankelijke controle van de samengestelde bytes, zonder regels of ids uit het schrijfplan.
 * Scanner en verliesbewaking leveren de bestaande STEP- en IfcRoot-kennis; hier staat alleen
 * de vergelijking met de bron (ontwerp §4.10, controles 1 en 2).
 */
import { classify, type Classification } from './classify';
import { isRootLine, refsOutsideText } from './lossCheck';
import type { StepIndex } from './stepScanner';
import { scanForeignStep } from './oldOwnHeader';
import { METING, METING_DATA, PROEF } from './meting'; // METING

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
/** METING proef 'lijsten': dezelfde vergelijking als `equalBytes` op twee stukken, zonder subarray en closure. */
function equalRange(a: Uint8Array, aFrom: number, aTo: number, b: Uint8Array, bFrom: number, bTo: number): boolean { // METING proef
  if (aTo - aFrom !== bTo - bFrom) return false;
  for (let k = 0, n = aTo - aFrom; k < n; k++) if (a[aFrom + k] !== b[bFrom + k]) return false;
  return true;
}
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

// ── METING proef 'telling' (deel 2, ingreep 1; wegwerpcode): dezelfde drie tellingen en dezelfde meldingen in dezelfde
// volgorde, maar alleen over de stukken die tussen bron en uitvoer kunnen verschillen. Geldt alleen als elk niet-P-stuk
// byte-gelijk en op zijn plek staat (de lus van E2/E3 vond niets); anders de volledige telling. ──
/** De bijdrage van één entiteit aan `dangling` en de GlobalId-sleutel, precies zoals in `structuralCounts`. */
function countEntity(index: StepIndex, i: number, dangling: Map<string, number>): string | undefined { // METING proef
  const args = index.argTokens(i);
  if (!args) return undefined;
  for (let arg = 0; arg < args.length; arg++) for (const id of refsOutsideText(args[arg])) {
    if (index.chunkOf(String(id)) < 0) add(dangling, `${index.id(i)}|${arg}|${id}`);
  }
  return args.length >= 5 && isRootLine({ args }) ? args[0].trim() : undefined;
}
function guidKeyOf(index: StepIndex, i: number): string | undefined { // METING proef
  const args = index.argTokens(i);
  return args && args.length >= 5 && isRootLine({ args }) ? args[0].trim() : undefined;
}
function memberCounts(index: StepIndex): Map<string, number> { // METING proef: het lidmaatschapsdeel van structuralCounts, ongewijzigd
  const members = new Map<string, number>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    const type = index.type(i);
    if (type === 'IFCRELAGGREGATES' || type === 'IFCRELNESTS' || type === 'IFCRELDECLARES') {
      for (const member of index.refsAt(i, 5)) add(members, `${type}|${index.id(member)}`);
    }
  }
  return members;
}
const isGuidByte = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36; // METING proef
/** Hash van de 22 tekens binnen de aanhalingstekens; dezelfde voor een sleutel `'…'` en voor de bytes. */
const guidHash = (at: (k: number) => number) => { let h = 0; for (let k = 0; k < 22; k++) h = (Math.imul(h, 31) + at(k)) | 0; return h; }; // METING proef
function differenceProblems(source: StepIndex, sourceClasses: Classification, index: StepIndex, bytes: Uint8Array,
  preserved: ArrayLike<number>, actual: ArrayLike<number>, pairs: number): string[] { // METING proef
  const problems: string[] = [];
  const inN = new Uint8Array(index.count), affected = new Uint8Array(index.count), affectedSource: number[] = [];
  for (let j = 0; j < pairs; j++) {
    inN[actual[j]] = 1;
    const s = preserved[j];
    if (!source.isEntity(s)) continue;
    // Een niet-P-stuk dat naar een P-stuk of naar niets wijst: daar kan een verwijzing loos worden of juist niet meer.
    for (let k = source.outStart(s); k < source.outEnd(s); k++) {
      const t = source.outTarget(k);
      if (t < 0 || sourceClasses.classes[t] === 1) { affected[actual[j]] = 1; affectedSource.push(s); break; }
    }
  }
  const beforeDangling = new Map<string, number>(), afterDangling = new Map<string, number>();
  const sourceGuids = new Map<string, number>(), outGuids = new Map<string, number>(), firstAt = new Map<string, number>();
  for (let i = 0; i < source.count; i++) {
    if (!source.isEntity(i) || sourceClasses.classes[i] !== 1) continue;
    const key = countEntity(source, i, beforeDangling);
    if (key !== undefined) add(sourceGuids, key);
  }
  for (const s of affectedSource) countEntity(source, s, beforeDangling);
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    if (!inN[i]) {
      const key = countEntity(index, i, afterDangling);
      if (key !== undefined) { add(outGuids, key); if (!firstAt.has(key)) firstAt.set(key, i); }
    } else if (affected[i]) countEntity(index, i, afterDangling);
  }
  // De GlobalIds van de niet-P-stukken zijn aan beide kanten gelijk (zelfde bytes). Ze tellen alleen mee voor een sleutel
  // die de uitvoer buiten die stukken heeft: zoek die sleutels in de bytes (elk voorkomen van ' + 22 tekens + '), en tel
  // een stuk alleen als zijn sleutel volgens de echte regel (argTokens, isRootLine) die sleutel is.
  const hashes = new Set<number>();
  for (const key of outGuids.keys()) hashes.add(guidHash(k => key.charCodeAt(k + 1)));
  const nGuids = new Map<string, number>();
  if (hashes.size > 0) {
    for (let j = 0; j < pairs; j++) {
      const o = actual[j];
      if (!index.isEntity(o)) continue;
      const end = index.end(o);
      let hit = false;
      for (let p = bytes.indexOf(39, index.start(o)); p >= 0 && p + 23 < end; p = bytes.indexOf(39, p + 1)) {
        if (bytes[p + 23] !== 39) continue;
        let ok = true;
        for (let k = 1; k <= 22 && ok; k++) ok = isGuidByte(bytes[p + k]);
        if (ok && hashes.has(guidHash(k => bytes[p + 1 + k]))) { hit = true; break; }
      }
      if (!hit) continue;
      const key = guidKeyOf(index, o);
      if (key === undefined || !outGuids.has(key)) continue;
      add(nGuids, key);
      if (o < firstAt.get(key)!) firstAt.set(key, o);
    }
  }
  for (const [key, count] of afterDangling) if (count > (beforeDangling.get(key) ?? 0)) problems.push(`nieuwe loze verwijzing ${key}`);
  for (const key of [...outGuids.keys()].sort((a, b) => firstAt.get(a)! - firstAt.get(b)!)) {
    const shared = nGuids.get(key) ?? 0;
    if (shared + outGuids.get(key)! > Math.max(1, shared + (sourceGuids.get(key) ?? 0))) problems.push(`nieuwe dubbele GlobalId ${key}`);
  }
  const membersBefore = memberCounts(source), membersAfter = memberCounts(index);
  for (const [key, count] of membersAfter) if (count > Math.max(1, membersBefore.get(key) ?? 0)) problems.push(`nieuw dubbel lidmaatschap ${key}`);
  METING_DATA('proef telling', () => ({ geraakt: affectedSource.length, uitvoerGuids: outGuids.size, gedeeldeGuids: nGuids.size })); // METING
  return problems;
}

export function validateMergeOutput(source: StepIndex, sourceClasses: Classification, sourceBytes: Uint8Array,
  bytes: Uint8Array): { index: StepIndex; classification: Classification; problems: string[] } {
  // Ook dubbele #ids en ongeldige STEP worden door de bestaande scanner geweigerd.
  const index = scanForeignStep(bytes);
  METING('E1 uitvoer scannen'); // METING
  const classification = classify(index), problems: string[] = [];
  METING('E1 uitvoer indelen'); // METING
  // METING proef 'lijsten': de twee lijsten als Int32Array in plaats van JS-arrays van miljoenen getallen.
  const lijsten = PROEF('lijsten'); // METING proef
  let preserved: { readonly length: number; readonly [j: number]: number }, actual: { readonly length: number; readonly [j: number]: number };
  if (lijsten) { // METING proef
    const p = new Int32Array(source.count); let np = 0;
    for (let i = 0; i < source.count; i++) if (sourceClasses.classes[i] !== 1) p[np++] = i;
    const a = new Int32Array(index.count); let na = 0;
    for (let i = 0; i < index.count; i++) {
      const original = index.isEntity(i) ? source.chunkOf(index.id(i)) : -1;
      if (!index.isEntity(i) || (original >= 0 && sourceClasses.classes[original] !== 1)) a[na++] = i;
      else if (classification.classes[i] !== 1) problems.push(`extra niet-P-stuk #${index.id(i)}`);
    }
    preserved = p.subarray(0, np); actual = a.subarray(0, na);
  } else {
  const preservedList: number[] = [];
  for (let i = 0; i < source.count; i++) if (sourceClasses.classes[i] !== 1) preservedList.push(i);
  const actualList: number[] = [];
  for (let i = 0; i < index.count; i++) {
    const original = index.isEntity(i) ? source.chunkOf(index.id(i)) : -1;
    if (!index.isEntity(i) || (original >= 0 && sourceClasses.classes[original] !== 1)) actualList.push(i);
    else if (classification.classes[i] !== 1) problems.push(`extra niet-P-stuk #${index.id(i)}`);
  }
  preserved = preservedList; actual = actualList;
  } // METING proef
  METING('E2 lijsten niet-P (bron en uitvoer)'); // METING
  if (preserved.length !== actual.length) problems.push(`niet-P-stukken: ${preserved.length} → ${actual.length}`);
  for (let j = 0; j < Math.min(preserved.length, actual.length); j++) {
    const before = preserved[j], after = actual[j];
    if (source.id(before) !== index.id(after)
      || !(lijsten ? equalRange(sourceBytes, source.start(before), source.end(before), bytes, index.start(after), index.end(after)) // METING proef
        : equalBytes(chunkBytes(source, sourceBytes, before), chunkBytes(index, bytes, after)))) {
      problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} ontbreekt, is gewijzigd of verplaatst`);
    }
  }
  const pairsEqual = problems.length === 0; // METING proef 'telling'
  METING('E3 equalBytes (niet-P-stukken byte-gelijk)'); // METING
  for (const member of sourceClasses.foreignMembers) {
    const id = source.id(member), expected = bindings(source, id), shown = bindings(index, id);
    if (expected.size !== shown.size || [...expected].some(([key, count]) => shown.get(key) !== count)) {
      problems.push(`vreemd lid #${id} hangt niet meer aan hetzelfde object en dezelfde psetnaam`);
    }
  }
  METING('E4 bindings van vreemde leden'); // METING
  if (PROEF('telling') && pairsEqual) { // METING proef
    problems.push(...differenceProblems(source, sourceClasses, index, bytes, preserved, actual, preserved.length));
    METING('E5-7 telling op het verschil (proef)'); // METING
    return { index, classification, problems };
  }
  const before = structuralCounts(source);
  METING_DATA('E5 telling bron', () => ({ dangling: before.dangling.size, guids: before.guids.size, members: before.members.size })); // METING
  METING('E5 structuralCounts bron'); // METING
  const after = structuralCounts(index);
  METING_DATA('E6 telling uitvoer', () => ({ dangling: after.dangling.size, guids: after.guids.size, members: after.members.size })); // METING
  METING('E6 structuralCounts uitvoer'); // METING
  for (const [key, count] of after.dangling) if (count > (before.dangling.get(key) ?? 0)) problems.push(`nieuwe loze verwijzing ${key}`);
  for (const [key, count] of after.guids) if (count > Math.max(1, before.guids.get(key) ?? 0)) problems.push(`nieuwe dubbele GlobalId ${key}`);
  for (const [key, count] of after.members) if (count > Math.max(1, before.members.get(key) ?? 0)) problems.push(`nieuw dubbel lidmaatschap ${key}`);
  METING('E7 tellingen vergelijken'); // METING
  return { index, classification, problems };
}
