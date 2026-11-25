/** Onafhankelijke controle van de samengestelde bytes, zonder regels of ids uit het schrijfplan.
 * Scanner en verliesbewaking leveren de bestaande STEP- en IfcRoot-kennis; hier staat alleen
 * de vergelijking met de bron (ontwerp §4.10, controles 1 en 2).
 */
import { classify, type Classification } from './classify';
import { isRootLine, refsOutsideText } from './lossCheck';
import type { StepIndex } from './stepScanner';
import { scanForeignStep } from './oldOwnHeader';
import type { ForeignChange, RestoredForeignPiece } from './changeList';
import { entityValue, losesItsPlace, placeTriggers, serializeStepValue, withoutRemovedMembers } from './stepValue';

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

/** Stuk `i` van `a` en stuk `j` van `b` zijn byte voor byte gelijk. Een gewone lus over beide bereiken: bij een groot model
 *  kostte `subarray` plus `every` met een functie per stuk het meeste van deze controle (#804). */
function equalChunks(source: StepIndex, a: Uint8Array, i: number, index: StepIndex, b: Uint8Array, j: number): boolean {
  const from = source.start(i), at = index.start(j), length = source.end(i) - from;
  if (index.end(j) - at !== length) return false;
  for (let k = 0; k < length; k++) if (a[from + k] !== b[at + k]) return false;
  return true;
}
const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

function equalBytes(a: Uint8Array, b: Uint8Array, from: number, to: number): boolean {
  if (a.length !== to - from) return false;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[from + k]) return false;
  return true;
}

interface ListedPieces {
  readonly listed: ReadonlyMap<number, Exclude<ForeignChange, RestoredForeignPiece>>;
  readonly restored: ReadonlyMap<number, Uint8Array>;
  readonly added: ReadonlyMap<string, Uint8Array>;
  readonly rewritten: Uint8Array;
}

function listedPieces(source: StepIndex, sourceClasses: Classification, sourceBytes: Uint8Array, changes: readonly ForeignChange[],
  problems: string[]): ListedPieces {
  const listed = new Map<number, Exclude<ForeignChange, RestoredForeignPiece>>(), rewritten = new Uint8Array(source.count);
  const restored = new Map<number, Uint8Array>(), added = new Map<string, Uint8Array>();
  for (const change of changes) {
    if (change.kind === 'vervallen' && change.unusedKeyOfTask !== undefined) continue;
    const chunk = source.chunkOf(String(change.id));
    if (change.kind === 'teruggezet') {
      if (chunk >= 0 && sourceClasses.classes[chunk] === 1) problems.push(`wijzigingslijst: teruggezet #${change.id} is een P-stuk van de bron`);
      else if (restored.has(chunk) || added.has(String(change.id))) problems.push(`wijzigingslijst: teruggezet #${change.id} staat er twee keer op`);
      else if (chunk >= 0) { restored.set(chunk, change.newBytes); rewritten[chunk] = 1; }
      else added.set(String(change.id), change.newBytes);
      continue;
    }
    if (chunk < 0 || sourceClasses.classes[chunk] === 1 || listed.has(chunk)) {
      problems.push(`wijzigingslijst: #${change.id} is geen niet-P-stuk van de bron, of staat er twee keer op`);
    } else if (!equalBytes(change.oldBytes, sourceBytes, source.start(chunk), source.end(chunk))) {
      problems.push(`wijzigingslijst: de oude bytes van #${change.id} zijn niet die van de bron`);
    } else {
      listed.set(chunk, change);
      rewritten[chunk] = 1;
    }
  }
  return { listed, restored, added, rewritten };
}

function goneFromOutput(source: StepIndex, sourceClasses: Classification, index: StepIndex): Set<number> {
  const gone = new Set<number>(), inD = sourceClasses.selection.inD;
  for (let i = 0; i < source.count; i++) if (inD[i] === 1 && index.chunkOf(source.id(i)) < 0) gone.add(Number(source.id(i)));
  return gone;
}

function changeListProblems(source: StepIndex, sourceBytes: Uint8Array, index: StepIndex, bytes: Uint8Array,
  listed: ReadonlyMap<number, Exclude<ForeignChange, RestoredForeignPiece>>, gone: ReadonlySet<number>, restored: ReadonlyMap<number, Uint8Array>): string[] {
  const problems: string[] = [];
  const removed = new Set(gone);
  const valueOf = (ix: StepIndex, b: Uint8Array, chunk: number) => chunk < 0 ? undefined : entityValue(b, ix.entityStart(chunk), ix.end(chunk));
  const pending = [...listed].filter(([, change]) => change.kind === 'vervallen')
    .map(([chunk, change]) => ({ id: change.id, value: valueOf(source, sourceBytes, chunk) }));
  const watchers = new Map<number, { readonly id: number; readonly list?: { left: number } }[]>();
  const watch = (ref: number, watcher: { readonly id: number; readonly list?: { left: number } }) => {
    const list = watchers.get(ref);
    if (list) list.push(watcher); else watchers.set(ref, [watcher]);
  };
  for (const piece of pending) {
    if (!piece.value) continue;
    const { direct, lists } = placeTriggers(piece.value);
    for (const ref of direct) watch(ref, { id: piece.id });
    for (const members of lists) {
      const list = { left: members.length };
      for (const ref of members) watch(ref, { id: piece.id, list });
    }
  }
  const justified = new Set<number>(), queue = [...removed];
  for (let i = 0; i < queue.length; i++) {
    for (const { id, list } of watchers.get(queue[i]!) ?? []) {
      if ((list && --list.left > 0) || justified.has(id)) continue;
      justified.add(id);
      if (!removed.has(id)) { removed.add(id); queue.push(id); }
    }
  }
  for (const piece of pending) {
    if (!justified.has(piece.id)) problems.push(`wijzigingslijst: #${piece.id} vervalt, maar geen verwijderd stuk laat het vervallen`);
  }
  for (const [chunk, change] of listed) {
    if (change.kind !== 'gewijzigd') continue;
    const before = valueOf(source, sourceBytes, chunk), after = valueOf(index, bytes, index.chunkOf(String(change.id)));
    const want = before && serializeStepValue(withoutRemovedMembers(before, removed));
    if (!before || !after) problems.push(`wijzigingslijst: gewijzigd stuk #${change.id} is niet te lezen`);
    else if (losesItsPlace(before, removed)) problems.push(`wijzigingslijst: #${change.id} staat als gewijzigd op de lijst, maar vervalt volgens §4.7`);
    else if (want === serializeStepValue(before)) problems.push(`wijzigingslijst: #${change.id} staat als gewijzigd op de lijst, maar verliest geen lid`);
    else if (!restored.has(chunk) && want !== serializeStepValue(after)) {
      problems.push(`gewijzigd niet-P-stuk #${change.id}: in de uitvoer niet hetzelfde stuk met alleen de leden naar verwijderde stukken eruit`);
    }
  }
  return problems;
}

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
export function danglingMayChange(index: StepIndex, classes: ArrayLike<number>, bytes: Uint8Array,
  rewritten?: ArrayLike<number>): (i: number) => boolean {
  let comment = nextCommentOpen(bytes, 0);
  return (i: number) => {
    for (let k = index.outStart(i); k < index.outEnd(i); k++) {
      const target = index.outTarget(k);
      if (target < 0 || classes[target] === 1 || rewritten?.[target] === 1) return true;
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
  index: StepIndex, bytes: Uint8Array, preserved: ArrayLike<number>, actual: ArrayLike<number>,
  rewritten?: ArrayLike<number>): { before: StructuralCounts; after: StructuralCounts } {
  const classes = sourceClasses.classes;
  const kept = new Uint8Array(index.count), recount = new Uint8Array(index.count);
  const beforeDangling = new Map<string, number>(), afterDangling = new Map<string, number>();
  const mayChange = danglingMayChange(source, classes, sourceBytes, rewritten);
  for (let j = 0; j < actual.length; j++) {
    const s = preserved[j];
    if (rewritten?.[s] === 1) continue;
    kept[actual[j]] = 1;
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
    if (!source.isEntity(i) || (classes[i] !== 1 && rewritten?.[i] !== 1)) continue;
    const key = countEntity(source, i, beforeDangling);
    const t = key === undefined ? undefined : tally.get(key);
    if (t) t.source++;
  }
  const hashes = new Set<number>();
  for (const key of tally.keys()) hashes.add(guidHash(k => key.charCodeAt(k + 1)));
  if (hashes.size > 0) {
    for (let j = 0; j < actual.length; j++) {
      const o = actual[j];
      if (!index.isEntity(o) || kept[o] !== 1) continue;
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
  bytes: Uint8Array, options: { full?: boolean; changes?: readonly ForeignChange[] } = {}): { index: StepIndex; classification: Classification; problems: string[];
  counting: 'verschil' | 'volledig' } {
  // Ook dubbele #ids en ongeldige STEP worden door de bestaande scanner geweigerd.
  const index = scanForeignStep(bytes), classification = classify(index), problems: string[] = [];
  const { listed, restored, added, rewritten } = listedPieces(source, sourceClasses, sourceBytes, options.changes ?? [], problems);
  const gone = goneFromOutput(source, sourceClasses, index);
  // De stuknummers van de niet-P-stukken van bron en uitvoer, als `Int32Array`: bij een groot model zijn het er miljoenen
  // (#804).
  const preservedAll = new Int32Array(source.count);
  let preservedCount = 0;
  for (let i = 0; i < source.count; i++) {
    if (sourceClasses.classes[i] !== 1 && (listed.get(i)?.kind !== 'vervallen' || restored.has(i))) preservedAll[preservedCount++] = i;
  }
  const preserved = preservedAll.subarray(0, preservedCount);
  const actualAll = new Int32Array(index.count), seen = new Set<string>();
  let actualCount = 0;
  for (let i = 0; i < index.count; i++) {
    const entity = index.isEntity(i), original = entity ? source.chunkOf(index.id(i)) : -1;
    if (!entity || (original >= 0 && sourceClasses.classes[original] !== 1)) actualAll[actualCount++] = i;
    else if (added.has(index.id(i))) {
      const want = added.get(index.id(i))!;
      if (classification.classes[i] === 1 || !equalBytes(want, bytes, index.entityStart(i), index.end(i))) {
        problems.push(`teruggezet stuk #${index.id(i)}: in de uitvoer niet met de bytes van de wijzigingslijst`);
      }
      seen.add(index.id(i));
    } else if (classification.classes[i] !== 1) problems.push(`extra niet-P-stuk #${index.id(i)}`);
  }
  const actual = actualAll.subarray(0, actualCount);
  for (const id of added.keys()) if (!seen.has(id)) problems.push(`teruggezet stuk #${id} ontbreekt in de uitvoer`);
  if (preserved.length !== actual.length) problems.push(`niet-P-stukken: ${preserved.length} → ${actual.length}`);
  for (let j = 0; j < Math.min(preserved.length, actual.length); j++) {
    const before = preserved[j], after = actual[j], change = listed.get(before);
    if (source.id(before) !== index.id(after)) {
      problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} ontbreekt, is gewijzigd of verplaatst`);
    } else if (restored.has(before)) {
      if (!equalBytes(restored.get(before)!, bytes, index.start(after), index.end(after))) {
        problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} heeft niet de teruggezette bytes van de wijzigingslijst`);
      }
    } else if (change?.kind === 'gewijzigd') {
      if (!equalBytes(change.newBytes, bytes, index.start(after), index.end(after))) {
        problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} heeft niet de nieuwe bytes van de wijzigingslijst`);
      }
    } else if (!equalChunks(source, sourceBytes, before, index, bytes, after)) {
      problems.push(`niet-P-stuk op plek ${j}: #${source.id(before)} ontbreekt, is gewijzigd of verplaatst`);
    }
  }
  // Vond de lus hierboven niets, dan staat elk niet-P-stuk byte-gelijk op zijn plek: dan telt alleen het verschil.
  const counting = problems.length === 0 && !options.full ? 'verschil' : 'volledig';
  for (const problem of changeListProblems(source, sourceBytes, index, bytes, listed, gone, restored)) problems.push(problem);
  for (const member of sourceClasses.foreignMembers) {
    const id = source.id(member), expected = bindings(source, id), shown = bindings(index, id);
    for (const key of [...expected.keys()]) if (gone.has(Number(JSON.parse(key)[0]))) expected.delete(key);
    if (expected.size !== shown.size || [...expected].some(([key, count]) => shown.get(key) !== count)) {
      problems.push(`vreemd lid #${id} hangt niet meer aan hetzelfde object en dezelfde psetnaam`);
    }
  }
  const { before, after } = counting === 'verschil'
    ? differenceCounts(source, sourceClasses, sourceBytes, index, bytes, preserved, actual, rewritten)
    : { before: structuralCounts(source), after: structuralCounts(index) };
  for (const [key, count] of after.dangling) if (count > (before.dangling.get(key) ?? 0)) problems.push(`nieuwe loze verwijzing ${key}`);
  for (const [key, count] of after.guids) if (count > Math.max(1, before.guids.get(key) ?? 0)) problems.push(`nieuwe dubbele GlobalId ${key}`);
  for (const [key, count] of after.members) if (count > Math.max(1, before.members.get(key) ?? 0)) problems.push(`nieuw dubbel lidmaatschap ${key}`);
  return { index, classification, problems, counting };
}
