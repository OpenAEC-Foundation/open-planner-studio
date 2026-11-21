/** Onafhankelijke controle van de samengestelde bytes, zonder regels of ids uit het schrijfplan.
 * Scanner en verliesbewaking leveren de bestaande STEP- en IfcRoot-kennis; hier staat alleen
 * de vergelijking met de bron (ontwerp §4.10, controles 1 en 2).
 */
import { classify, type Classification } from './classify';
import { isRootLine, refsOutsideText } from './lossCheck';
import type { StepIndex } from './stepScanner';
import { scanForeignStep } from './oldOwnHeader';

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

/** Reeds bestaande gebreken mogen blijven; de uitvoer mag er geen toevoegen. Per kant: de loze verwijzingen
 *  (`#id|argument|doel`), de GlobalIds en de lidmaatschappen. */
export interface StructuralCounts {
  readonly dangling: Map<string, number>;
  readonly guids: Map<string, number>;
  readonly members: Map<string, number>;
}

/** De telregel voor één entiteit: haar loze verwijzingen in `dangling` (als die er is), en haar GlobalId als ze een
 *  IfcRoot-regel is. Dezelfde regel voor de volledige telling en die op het verschil. */
function countEntity(index: StepIndex, i: number, dangling?: Map<string, number>): string | undefined {
  const args = index.argTokens(i);
  if (!args) return undefined;
  if (dangling) {
    for (let arg = 0; arg < args.length; arg++) for (const id of refsOutsideText(args[arg])) {
      if (index.chunkOf(String(id)) < 0) add(dangling, `${index.id(i)}|${arg}|${id}`);
    }
  }
  // Concrete IfcRoot-typen hebben naast hun vier basisslots minstens één eigen slot.
  // Een IFCPROPERTYSINGLEVALUE met een naam van 22 tekens heeft er vier en draagt geen GlobalId.
  return args.length >= 5 && isRootLine({ args }) ? args[0].trim() : undefined;
}

/** De lidmaatschappen: alleen de index, geen tekst. */
function memberCounts(index: StepIndex): Map<string, number> {
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

/** De volledige telling: elk stuk van één kant. */
export function structuralCounts(index: StepIndex): StructuralCounts {
  const dangling = new Map<string, number>(), guids = new Map<string, number>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    const key = countEntity(index, i, dangling);
    if (key !== undefined) add(guids, key);
  }
  return { dangling, guids, members: memberCounts(index) };
}

const SLASH = 0x2f, STAR = 0x2a, QUOTE = 0x27;

/** De plaats van de eerste `/*` in `bytes` vanaf `from`, of -1. */
function nextCommentOpen(bytes: Uint8Array, from: number): number {
  for (let p = bytes.indexOf(SLASH, from); p >= 0; p = bytes.indexOf(SLASH, p + 1)) if (bytes[p + 1] === STAR) return p;
  return -1;
}

/**
 * Kan de bijdrage van bewaard stuk `i` aan de loze verwijzingen tussen bron en uitvoer verschillen? Na een geslaagde E2/E3
 * staat elk niet-P-stuk met hetzelfde id in de uitvoer; alleen een verwijzing naar een P-stuk of naar niets kan er dus loos
 * worden of juist niet meer. Daarom `true` als:
 *  - de scanner een verwijzing van het stuk naar een P-stuk of naar niets ziet (`outTarget`);
 *  - er `/*` staat in de bytes van de entiteit, van haar `#` tot en met de `;` (`entityStart` tot `end`), ook in een
 *    string. De tekstregel (`argTokens`, dan `refsOutsideText`) haalt commentaar weg en plakt de delen aan elkaar:
 *    `#/*c*\/53` is daar `#53` en `#5/*c*\/3` ook, voor de scanner geen verwijzing of `#5` (knownbug 1951). Zonder `/*`
 *    in die bytes doet `stripComments` niets (de gedecodeerde tekst heeft dan ook geen `/*`: UTF-8 houdt elk ASCII-byte),
 *    en zien scanner en tekstregel dezelfde `#` met cijfers buiten strings (`check-ifc-foreign-telling-verschil.ts`).
 *    De tekstregel leest alleen tussen de haakjes van de entiteit, binnen deze bytes.
 * Aanroepen met oplopende `i`: de zoektocht naar `/*` loopt één keer door de bytes.
 */
export function danglingMayChange(index: StepIndex, classes: ArrayLike<number>, bytes: Uint8Array): (i: number) => boolean {
  let comment = nextCommentOpen(bytes, 0);
  return (i: number) => {
    for (let k = index.outStart(i); k < index.outEnd(i); k++) {
      const target = index.outTarget(k);
      if (target < 0 || classes[target] === 1) return true;
    }
    const from = index.entityStart(i), to = index.end(i);
    while (comment >= 0 && comment < from) comment = nextCommentOpen(bytes, comment + 1);
    return comment >= 0 && comment + 1 < to;
  };
}

/** Hash van de 22 tekens van een GlobalId: dezelfde voor een sleutel `'…'` en voor de bytes erbinnen. */
function guidHash(at: (k: number) => number): number {
  let h = 0;
  for (let k = 0; k < 22; k++) h = (Math.imul(h, 31) + at(k)) | 0;
  return h;
}

/** Een eigen string voor een sleutel: `slice` en `trim` geven in V8 een deelstring die de hele gedecodeerde
 *  argumententekst van het stuk vasthoudt, `join` maakt een nieuwe. */
const detached = (key: string) => Array.from(key).join('');

/**
 * De tellingen van `structuralCounts`, maar alleen over wat tussen bron en uitvoer kan verschillen (knownbug 1936). Alleen
 * geldig als `preserved[j]` (bron) en `actual[j]` (uitvoer) voor elke `j` hetzelfde niet-P-stuk zijn: hetzelfde id en
 * dezelfde bytes, op dezelfde plek (de lus van E2/E3 vond niets). Hun telregel leest alleen die bytes, dus:
 *  - loze verwijzingen: alleen een bewaard stuk waarvan de bijdrage kan verschillen (`danglingMayChange`), plus elk P-stuk
 *    van de bron en elk niet-bewaard stuk van de uitvoer, met de bestaande regel. Voor elke andere sleutel is de telling aan
 *    beide kanten gelijk; een sleutel bevat het id van zijn stuk, dus de volgorde van de uitvoer blijft;
 *  - GlobalIds: een bewaard stuk heeft aan beide kanten dezelfde. Alleen een sleutel die de uitvoer buiten de bewaarde
 *    stukken heeft, kan een nieuwe dubbele worden. Voor die sleutels telt een bewaard stuk mee als de bestaande regel hem
 *    geeft; zo'n sleutel staat letterlijk in zijn bytes (`'` + 22 tekens + `'`: een string bevat geen commentaar), dus
 *    alleen een stuk met een treffer op de hash rekent de regel na. Volgorde: het eerste voorkomen in de uitvoer;
 *  - lidmaatschappen: volledig.
 * Met deze tellingen geeft de vergelijking in `validateMergeOutput` dezelfde meldingen in dezelfde volgorde als met de
 * volledige.
 */
export function differenceCounts(source: StepIndex, sourceClasses: Classification, sourceBytes: Uint8Array,
  index: StepIndex, bytes: Uint8Array, preserved: ArrayLike<number>, actual: ArrayLike<number>): { before: StructuralCounts; after: StructuralCounts } {
  const classes = sourceClasses.classes;
  const kept = new Uint8Array(index.count), recount = new Uint8Array(index.count);
  const beforeDangling = new Map<string, number>(), afterDangling = new Map<string, number>();
  const mayChange = danglingMayChange(source, classes, sourceBytes);
  for (let j = 0; j < actual.length; j++) {
    kept[actual[j]] = 1;
    const s = preserved[j];
    if (source.isEntity(s) && mayChange(s)) { recount[actual[j]] = 1; countEntity(source, s, beforeDangling); }
  }
  /** Per GlobalId buiten de bewaarde stukken van de uitvoer: hoe vaak daar, in de P-stukken van de bron, en in de
   *  bewaarde stukken (aan beide kanten gelijk); en het eerste stuk van de uitvoer met die sleutel. */
  const tally = new Map<string, { output: number; source: number; shared: number; first: number }>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    if (kept[i]) { if (recount[i]) countEntity(index, i, afterDangling); continue; }
    const key = countEntity(index, i, afterDangling);
    if (key === undefined) continue;
    const t = tally.get(key);
    if (t) t.output++;
    else tally.set(detached(key), { output: 1, source: 0, shared: 0, first: i });
  }
  for (let i = 0; i < source.count; i++) {
    if (!source.isEntity(i) || classes[i] !== 1) continue;
    const key = countEntity(source, i, beforeDangling);
    const t = key === undefined ? undefined : tally.get(key);
    if (t) t.source++;
  }
  const hashes = new Set<number>();
  for (const key of tally.keys()) hashes.add(guidHash(k => key.charCodeAt(k + 1)));
  if (hashes.size > 0) {
    for (let j = 0; j < actual.length; j++) {
      const o = actual[j];
      if (!index.isEntity(o)) continue;
      // Alleen binnen de entiteit: haar GlobalId staat tussen haar haakjes.
      for (let p = index.entityStart(o), to = index.end(o); p + 23 < to; p++) {
        if (bytes[p] !== QUOTE || bytes[p + 23] !== QUOTE || !hashes.has(guidHash(k => bytes[p + 1 + k]))) continue;
        const key = countEntity(index, o);
        const t = key === undefined ? undefined : tally.get(key);
        if (t) { t.shared++; if (o < t.first) t.first = o; }
        break; // de regel geeft per stuk één sleutel
      }
    }
  }
  const beforeGuids = new Map<string, number>(), afterGuids = new Map<string, number>();
  for (const [key, t] of [...tally].sort((a, b) => a[1].first - b[1].first)) {
    afterGuids.set(key, t.shared + t.output);
    if (t.shared + t.source > 0) beforeGuids.set(key, t.shared + t.source);
  }
  return {
    before: { dangling: beforeDangling, guids: beforeGuids, members: memberCounts(source) },
    after: { dangling: afterDangling, guids: afterGuids, members: memberCounts(index) },
  };
}

/** `full`: alleen voor proeven, altijd de volledige telling. `counting` zegt welke telling liep. */
export function validateMergeOutput(source: StepIndex, sourceClasses: Classification, sourceBytes: Uint8Array,
  bytes: Uint8Array, options: { full?: boolean } = {}): { index: StepIndex; classification: Classification; problems: string[];
  counting: 'verschil' | 'volledig' } {
  // Ook dubbele #ids en ongeldige STEP worden door de bestaande scanner geweigerd.
  const index = scanForeignStep(bytes), classification = classify(index), problems: string[] = [];
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
  // Vond de lus hierboven niets, dan staat elk niet-P-stuk byte-gelijk op zijn plek: dan telt alleen het verschil.
  const counting = problems.length === 0 && !options.full ? 'verschil' : 'volledig';
  for (const member of sourceClasses.foreignMembers) {
    const id = source.id(member), expected = bindings(source, id), shown = bindings(index, id);
    if (expected.size !== shown.size || [...expected].some(([key, count]) => shown.get(key) !== count)) {
      problems.push(`vreemd lid #${id} hangt niet meer aan hetzelfde object en dezelfde psetnaam`);
    }
  }
  const { before, after } = counting === 'verschil'
    ? differenceCounts(source, sourceClasses, sourceBytes, index, bytes, preserved, actual)
    : { before: structuralCounts(source), after: structuralCounts(index) };
  for (const [key, count] of after.dangling) if (count > (before.dangling.get(key) ?? 0)) problems.push(`nieuwe loze verwijzing ${key}`);
  for (const [key, count] of after.guids) if (count > Math.max(1, before.guids.get(key) ?? 0)) problems.push(`nieuwe dubbele GlobalId ${key}`);
  for (const [key, count] of after.members) if (count > Math.max(1, before.members.get(key) ?? 0)) problems.push(`nieuw dubbel lidmaatschap ${key}`);
  return { index, classification, problems, counting };
}
