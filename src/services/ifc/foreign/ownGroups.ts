/**
 * De eigen groepen op projectniveau (#804 fase 1c, PR 12a; onderzoek "een andere toets voor gegevens die volledig van de
 * app zijn", 14 november 2026, vraag 1).
 *
 * Een eigen groep is een pset die de writer op het `IfcProject` of op zijn eigen live werkschema zet, met haar properties
 * (en wat daaronder hangt, zoals een enumeratie) en haar `IfcRelDefinesByProperties`. Bij `OPS_StructureMeta` horen ook de
 * templates, hun enumeraties en de `IfcRelDeclares` van de codes en eigen velden. De indeling volgt uit de vorm van de
 * regels, niet uit een lijst namen: wat de writer daar schrijft, is een groep. Alleen de eigen regels tellen: een lid van een
 * ander programma (in een pset, een template of een relatie) hangt de merge terug, en het telt in geen groep mee.
 *
 * Twee gegevens staan daarnaast op een tweede plek buiten de pset, op een object dat ook andere gegevens draagt: de
 * baselinekop (een `.BASELINE.`-werkschema in de aggregatie van het werkplan, bij `OPS_Baselines`) en de typenaam
 * (`ObjectType`) van een taak met `PredefinedType .USERDEFINED.` (bij `OPS_TaskTypes`). Die staan hier als de groepen
 * `BASELINE_HEADS` en `TASK_OBJECT_TYPES`.
 *
 * Gebruik: de uitvoercontrole (c) in `mergeWriter.ts` vergelijkt per groep de boomvorm van de uitvoer met die van de writer
 * op de herlezing (`ownGroupTrees`, `ownGroupDifference`). Een slot waar de herleestoets (b) de bronwaarde terugzette,
 * toetst (c) apart: op die regel moet precies de bronwaarde staan; de rest van zijn groep toetst (c) gewoon (#804 stap 5,
 * PR A; `restoredOwnSlots`, `restoredOwnGroupDifference`). De andere toets in de verliescontrole (PR 12b, `openedOwnGroups`
 * in `mergeWriter.ts`) gebruikt dezelfde indeling op de bronregels (`indexView`, `ownGroupMembers`), en laat een groep met
 * een slot van (b) helemaal buiten de toets.
 */
import { decodeStepText } from '../stepText';
import { PSET } from '../ifcPsets';
import { refsOutsideText, type OutLine, type SlotEdit } from './lossCheck';
import type { StepIndex } from './stepScanner';

/** De tweede vorm van `OPS_Baselines`: de baselinekoppen en de aggregatie waarin ze staan (die van het eigen werkplan). */
export const BASELINE_HEADS = `kop:${PSET.Baselines}`;
/** De tweede vorm van `OPS_TaskTypes`: `ObjectType` van elke eigen taak met `PredefinedType .USERDEFINED.` (of met een
 *  `ObjectType`, PR 12d: de writer schrijft er alleen een bij `.USERDEFINED.`). */
export const TASK_OBJECT_TYPES = `taak:ObjectType`;
/** Per pset zijn tweede vorm buiten de pset. Wat een vorm in de verliescontrole mag dragen, staat bij `SECOND_FORMS` in
 *  `lossCheck.ts` (op pset); `openedOwnGroups` in `mergeWriter.ts` toetst per vorm dat het openen hem niet veranderde. */
export const SECOND_FORMS: ReadonlyMap<string, string> = new Map([[PSET.Baselines, BASELINE_HEADS], [PSET.TaskTypes, TASK_OBJECT_TYPES]]);

/**
 * Een kijk op een reeks regels. `line(id)`: een eigen regel (van de writer), anders `undefined`. `typeOf(id)`: het
 * entiteittype van elk stuk, ook een vreemd (zoals een `IfcProject` van een ander programma). `aggregatedIn`: per id dat in
 * een `IfcRelAggregates` staat (eigen of vreemd), het geheel van elke aggregatie waarin het staat: `eigen <type>` als dat
 * geheel een eigen regel is, anders `vreemd <type>` (PR 12c, knownbug 1705: de kop hoort in die van het eigen werkplan).
 */
export interface OwnLinesView {
  readonly lines: Iterable<OutLine>;
  line(id: number): OutLine | undefined;
  typeOf(id: number): string | undefined;
  readonly aggregatedIn: ReadonlyMap<number, readonly string[]>;
}

/** Het geheel van een aggregatie, zoals `aggregatedIn` het noemt. */
function wholeOf(own: boolean, type: string | undefined): string {
  return `${own ? 'eigen' : 'vreemd'} ${type ?? '?'}`;
}
function addTo(map: Map<number, string[]>, id: number, whole: string) {
  const a = map.get(id) ?? []; a.push(whole); map.set(id, a);
}

/** Een view op losse regels (de writer), met een terugval voor ids die niet tussen die regels staan. */
export function linesView(lines: readonly OutLine[], fallbackType: (id: number) => string | undefined = () => undefined): OwnLinesView {
  const byId = new Map(lines.map(l => [l.id, l]));
  const typeOf = (id: number) => byId.get(id)?.type ?? fallbackType(id);
  const aggregatedIn = new Map<number, string[]>();
  for (const l of lines) {
    if (l.type !== 'IFCRELAGGREGATES') continue;
    const whole = refsOutsideText(l.args[4] ?? '')[0];
    for (const id of refsOutsideText(l.args[5] ?? '')) addTo(aggregatedIn, id, wholeOf(whole !== undefined && byId.has(whole), whole === undefined ? undefined : typeOf(whole)));
  }
  return { lines, line: id => byId.get(id), typeOf, aggregatedIn };
}

/**
 * Een view op de stukken van een scan. Alleen de stukken waarvoor `own(chunk)` geldt, zijn regels (eigen regels); het type
 * en het lidmaatschap van een aggregatie gelden voor elk stuk, ook een vreemd.
 */
export function indexView(index: StepIndex, own: (chunk: number) => boolean): OwnLinesView {
  const lines: OutLine[] = [];
  const aggregatedIn = new Map<number, string[]>();
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    if (index.type(i) === 'IFCRELAGGREGATES') {
      const whole = index.refAt(i, 4);
      for (const c of index.refsAt(i, 5)) addTo(aggregatedIn, Number(index.id(c)), wholeOf(whole >= 0 && own(whole), whole >= 0 ? index.type(whole) : undefined));
    }
    if (!own(i)) continue;
    const args = index.argTokens(i);
    if (args) lines.push({ id: Number(index.id(i)), type: index.type(i), args });
  }
  const byId = new Map(lines.map(l => [l.id, l]));
  const typeOf = (id: number) => { const c = index.chunkOf(String(id)); return c >= 0 ? index.type(c) : undefined; };
  return { lines, line: id => byId.get(id), typeOf, aggregatedIn };
}

/** Typen die een object zijn (geen deel van een groep): in de boomvorm staat alleen hun type. */
const OBJECT_TYPES: ReadonlySet<string> = new Set(['IFCPROJECT', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCTASK', 'IFCOWNERHISTORY']);
/** `IfcRoot`-typen binnen een groep: GlobalId (0) en owner history (1) tellen niet mee. */
const ROOT_TYPES: ReadonlySet<string> = new Set(['IFCPROPERTYSET', 'IFCRELDEFINESBYPROPERTIES', 'IFCPROPERTYSETTEMPLATE',
  'IFCSIMPLEPROPERTYTEMPLATE', 'IFCRELDECLARES']);

const isBaselineHead = (l: OutLine) => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.');
/**
 * De verwijzingen in een argument die meetellen: buiten tekst (`refsOutsideText`), en alleen naar een eigen regel of naar
 * het `IfcProject` (de writer verwijst ook naar een project van een ander programma). Een verwijzing naar een ander stuk is
 * een vreemd lid dat de merge bewaart (in een pset, een template, een relatie): dat telt in geen enkele groep mee.
 */
function refs(view: OwnLinesView, token: string | undefined): number[] {
  return refsOutsideText(token ?? '').filter(id => view.line(id) !== undefined || view.typeOf(id) === 'IFCPROJECT');
}
/**
 * Een ledenlijst die niet leeg is en uitsluitend naar vreemde stukken wijst. Zo'n pset of `IfcRelDeclares` schreef de
 * merge alleen om vreemde leden te bewaren; de writer schrijft hem niet, dus hij is geen groep. Een lege lijst en een lijst
 * met minstens één eigen lid tellen wel: die komen uit de writer of horen tegen diens uitvoer getoetst te worden.
 */
function onlyForeignMembers(view: OwnLinesView, token: string | undefined): boolean {
  return refsOutsideText(token ?? '').length > 0 && refs(view, token).length === 0;
}
function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.length >= 2 && t.startsWith("'") && t.endsWith("'") ? decodeStepText(t.slice(1, -1).replace(/''/g, "'")) : t;
}

/** Een anker van een projectgroep: het `IfcProject` (eigen of vreemd) of het eigen live werkschema. */
function anchor(view: OwnLinesView, id: number): boolean {
  if (view.typeOf(id) === 'IFCPROJECT') return true;
  const l = view.line(id);
  return !!l && l.type === 'IFCWORKSCHEDULE' && !isBaselineHead(l);
}

/** De wortels per groep: de eigen `IfcRelDefinesByProperties` naar een anker, en de eigen `IfcRelDeclares` van templates. */
function groupRoots(view: OwnLinesView): Map<string, OutLine[]> {
  const roots = new Map<string, OutLine[]>();
  const add = (g: string, l: OutLine) => { const a = roots.get(g) ?? []; a.push(l); roots.set(g, a); };
  for (const l of view.lines) {
    if (l.type === 'IFCRELDEFINESBYPROPERTIES') {
      const related = refs(view, l.args[4]), pset = view.line(refs(view, l.args[5])[0] ?? -1);
      if (pset?.type === 'IFCPROPERTYSET' && !onlyForeignMembers(view, pset.args[4])
        && related.length > 0 && related.every(id => anchor(view, id))) {
        add(unquote(pset.args[2]), l);
      }
    } else if (l.type === 'IFCRELDECLARES') {
      const related = refs(view, l.args[5]).map(id => view.line(id));
      if (refs(view, l.args[4]).every(id => anchor(view, id)) && !onlyForeignMembers(view, l.args[5])
        && related.every(t => t?.type === 'IFCPROPERTYSETTEMPLATE')) add(PSET.StructureMeta, l);
    }
  }
  return roots;
}

/** Per eigen regel de groep waartoe zij hoort (pset, properties, enumeraties, templates, relaties, baselinekoppen). */
export function ownGroupMembers(view: OwnLinesView): Map<number, string> {
  const out = new Map<number, string>();
  const walk = (id: number, g: string) => {
    const l = view.line(id);
    if (!l || OBJECT_TYPES.has(l.type) || out.has(id)) return;
    out.set(id, g);
    for (const a of l.args) for (const r of refs(view, a)) walk(r, g);
  };
  for (const [g, roots] of groupRoots(view)) for (const l of roots) walk(l.id, g);
  for (const l of view.lines) if (isBaselineHead(l)) out.set(l.id, BASELINE_HEADS);
  return out;
}

/** De groep die een herstelde bronwaarde (b) raakt: argument `arg` van eigen regel `line`, of niets. */
function editedOwnGroup(members: ReadonlyMap<number, string>, line: OutLine, arg: number): string | undefined {
  if (line.type === 'IFCTASK') return arg === 4 || arg === 12 ? TASK_OBJECT_TYPES : undefined;
  return members.get(line.id);
}

/** Het argument met de naam waarop een regel in de weg naar een slot staat (de plaats in `groupTrees`). */
const NAME_ARG: Readonly<Record<string, number>> = {
  IFCPROPERTYSET: 2, IFCPROPERTYSETTEMPLATE: 2, IFCSIMPLEPROPERTYTEMPLATE: 2,
  IFCPROPERTYSINGLEVALUE: 0, IFCPROPERTYENUMERATEDVALUE: 0, IFCPROPERTYENUMERATION: 0,
};
/** Een stap in de weg naar een slot: het type, met de naam als het type er een heeft. */
const stepOf = (l: OutLine) => NAME_ARG[l.type] === undefined ? l.type : `${l.type}(${l.args[NAME_ARG[l.type]]?.trim()})`;
/** Wat (c) toont op een slot uit `mask` (`groupTrees`). Geen STEP-token kan zo luiden. */
const MASKED = '«(b)»';

/**
 * De boomvorm per groep (`ownGroupTrees`). `mask`: slots die (c) apart toetst, als `<plaats>#<argument>`; op zo'n slot staat
 * `MASKED`, en `masked` krijgt de regel en het token dat daar stond. `place`: per eigen regel elke plaats waarop zij in een
 * boom staat, zonder id's: de groep, dan de wortel en per stap het argument, het type en de naam
 * (`<groep>|<wortel>/<argument>:<type>(<naam>)…`); een baselinekop en een taak op hun GlobalId (`kop:OPS_Baselines|<GlobalId>`,
 * `taak:ObjectType|<GlobalId>`).
 */
function groupTrees(view: OwnLinesView, mask: ReadonlySet<string>, place?: (id: number, at: string) => void,
  masked?: (slot: string, id: number, token: string) => void): Map<string, string[]> {
  const tree = (id: number, depth: number, at: string): string => {
    const l = view.line(id);
    if (!l) return view.typeOf(id) ?? `?#${id}`;
    if (OBJECT_TYPES.has(l.type)) return isBaselineHead(l) ? 'IFCWORKSCHEDULE[BASELINE]' : l.type;
    if (depth > 12) return `${l.type}(…)`;
    place?.(id, at);
    return `${l.type}(${argsOf(l, depth, at).join(',')})`;
  };
  const below = (at: string, k: number, id: number) => { const c = view.line(id); return `${at}/${k}:${c ? stepOf(c) : '?'}`; };
  const argsOf = (l: OutLine, depth: number, at: string, from = 0) => l.args.slice(from).map((a, i) => {
    const k = i + from;
    if (mask.has(`${at}#${k}`)) { masked?.(`${at}#${k}`, l.id, a); return MASKED; }
    const t = a.trim();
    if (ROOT_TYPES.has(l.type) && k < 2) return k === 0 ? 'G' : 'OH';
    const list = /^\(([\s\S]*)\)$/.exec(t);
    if (list && /^#\d+(\s*,\s*#\d+)*$/.test(list[1].trim())) {
      const members = l.type === 'IFCPROPERTYSET' && k === 4;
      const parts = refs(view, list[1]).map(x => tree(x, depth + 1, below(at, k, x)));
      if (members) parts.sort();
      return `(${parts.join(',')})`;
    }
    return /^#\d+$/.test(t) ? tree(Number(t.slice(1)), depth + 1, below(at, k, Number(t.slice(1)))) : t;
  });
  const groups = new Map<string, string[]>();
  const add = (g: string, t: string) => { const a = groups.get(g) ?? []; a.push(t); groups.set(g, a); };
  for (const [g, roots] of groupRoots(view)) for (const l of roots) add(g, tree(l.id, 0, `${g}|${l.type}`));
  for (const l of view.lines) {
    // De kop met de aggregaties waarin hij staat (knownbug 1705): een kop in een andere aggregatie dan die van het eigen
    // werkplan (die van het project, of een vreemde) leest anders dan wat de writer schrijft.
    if (isBaselineHead(l)) {
      const at = `${BASELINE_HEADS}|${l.args[0].trim()}`;
      place?.(l.id, at);
      add(BASELINE_HEADS, `${[...view.aggregatedIn.get(l.id) ?? ['los']].sort().join('+')}|${l.args[0].trim()}|${argsOf(l, 0, at, 2).join(',')}`);
    } else if (l.type === 'IFCTASK') {
      // De typenaam per taak (op GlobalId), met het PredefinedType erbij (PR 12d): ook een typenaam op een taak zonder
      // `.USERDEFINED.`, en een `.USERDEFINED.` dat wegviel terwijl de taak haar type houdt, lezen anders dan wat de writer
      // schrijft (de lezer leest het type per taak uit `OPS_TaskTypes`, niet uit deze twee slots). Een gemaskeerd slot telt
      // ook niet mee voor de vraag of de taak er staat: aan beide kanten alsof het leeg is.
      const at = `${TASK_OBJECT_TYPES}|${l.args[0].trim()}`;
      place?.(l.id, at);
      const masked4 = mask.has(`${at}#4`), masked12 = mask.has(`${at}#12`);
      if (masked4) masked?.(`${at}#4`, l.id, l.args[4] ?? '');
      if (masked12) masked?.(`${at}#12`, l.id, l.args[12] ?? '');
      const name = l.args[4]?.trim(), kind = l.args[12]?.trim();
      if ((!masked12 && kind === '.USERDEFINED.') || (!masked4 && (name ?? '$') !== '$')) {
        add(TASK_OBJECT_TYPES, `${l.args[0].trim()}|${masked4 ? MASKED : name}|${masked12 ? MASKED : kind}`);
      }
    }
  }
  for (const v of groups.values()) v.sort();
  return groups;
}

/**
 * Per groep een gesorteerde lijst boomvormen, zonder GlobalId en owner history; een object staat er alleen met zijn type.
 * Alleen eigen leden tellen mee (`refs`: een vreemd lid van een pset, template of relatie niet). `TaskGuids` telt helemaal
 * mee, ook de sleutel en de GlobalId van een weesrij (PR 12e, was knownbug 1706): de merge houdt die GlobalId
 * (`withOrphanRowGuids` in `sourceForm.ts`), dus een extra sleutel, een ontbrekende of een andere waarde leest anders dan
 * wat de writer schrijft. Een baselinekop staat er met zijn GlobalId (was knownbug 1746): de writer leidt die af uit het id van
 * zijn baseline, dus twee verwisselde koppen, of de kop van een gewiste baseline in de plaats van een blijvende, lezen ook
 * bij gelijke inhoud anders.
 */
export function ownGroupTrees(view: OwnLinesView): Map<string, string[]> {
  return groupTrees(view, new Set());
}

/**
 * Een slot dat (b) terugzette en dat (c) apart toetst (#804 stap 5, PR A): zijn groep, zijn plaats in de boom
 * (`<plaats>#<argument>`, `groupTrees`), en de regel en de bronwaarde die (b) daar zette. Het id is dat van O1
 * (`restoredOwnSlots`); in de uitvoercontrole dat van de uitvoer, door de hernummering van de merge (`OwnOutputCheck` in
 * `mergeWriter.ts`).
 */
export interface RestoredOwnSlot { readonly group: string; readonly place: string; readonly id: number; readonly token: string }
/** Wat (c) doet met de slots die (b) terugzette: `skip`, de groepen die (c) helemaal overslaat (zoals vóór PR A), en
 *  `slots`, de slots die (c) apart toetst in de andere groepen. */
export interface RestoredOwnSlots {
  readonly skip: ReadonlySet<string>;
  readonly slots: readonly RestoredOwnSlot[];
}

/**
 * Wijs de slots aan die (b) terugzette (`edits`, regel en argument in `view`: O1 zonder de bronwaarden; de plaats hangt niet
 * aan de waarde van het slot). Een slot krijgt zijn plaats in de boom van zijn groep als de regel op precies één plaats in een
 * boom staat, geen andere regel op die plaats staat (twee properties of twee psets met dezelfde naam, twee koppen of taken met
 * dezelfde GlobalId), het slot niet in die plaats zelf zit (de naam of de GlobalId), en de bronwaarde en de waarde van de
 * writer geen verwijzing bevatten (dan hangt er een deel van de boom aan, of verandert de hernummering de waarde). Een slot
 * van een soort die de lezer deels draagt (`partial`: lijst, JSON, samengestelde tekst) wijst hij nooit aan: de lezer leest
 * die bronwaarde mee, dus de rest van de groep kan na heropenen anders teruglezen (knownbug 1770). Eén slot zonder plaats
 * zet zijn hele groep in `skip`: dan slaat (c) haar over, zoals vóór PR A.
 */
export function restoredOwnSlots(view: OwnLinesView, edits: readonly Pick<SlotEdit, 'id' | 'arg' | 'token' | 'partial'>[]): RestoredOwnSlots {
  if (edits.length === 0) return { skip: new Set(), slots: [] };
  const members = ownGroupMembers(view);
  const placesOf = new Map<number, string[]>(), holders = new Map<string, number>();
  groupTrees(view, new Set(), (id, at) => {
    const a = placesOf.get(id) ?? []; a.push(at); placesOf.set(id, a);
    holders.set(at, (holders.get(at) ?? 0) + 1);
  });
  const plain = (token: string | undefined) => refsOutsideText(token ?? '').length === 0;
  const skip = new Set<string>(), slots: RestoredOwnSlot[] = [];
  for (const e of edits) {
    const line = view.line(e.id);
    const group = line && editedOwnGroup(members, line, e.arg);
    if (!line || group === undefined) continue;
    const [at, ...more] = placesOf.get(e.id) ?? [];
    const inPlace = e.arg === NAME_ARG[line.type] || ((isBaselineHead(line) || line.type === 'IFCTASK') && e.arg === 0);
    if (!e.partial && at !== undefined && more.length === 0 && holders.get(at) === 1 && !inPlace && plain(e.token) && plain(line.args[e.arg])) {
      slots.push({ group, place: `${at}#${e.arg}`, id: e.id, token: e.token });
    } else skip.add(group);
  }
  return { skip, slots: slots.filter(s => !skip.has(s.group)) };
}

/**
 * Controle (c) op de eigen groepen (`ownOutputProblem` in `mergeWriter.ts`): het eerste verschil tussen de groepen van de
 * uitvoer en die van de writer op de herlezing, buiten de groepen in `restored.skip`. Een slot uit `restored.slots` toetst
 * (c) apart. In de uitvoer staat op zijn plaats precies één regel: de regel waarop (b) de bronwaarde zette (`id`), met op
 * dat argument precies die bronwaarde; anders weigert (c). In de herschreven boom moet op die plaats precies één regel staan,
 * met een waarde zonder verwijzing; anders slaat (c) de groep over, zoals vóór PR A. De rest van de groep toetst (c) gewoon.
 */
export function restoredOwnGroupDifference(output: OwnLinesView, rewritten: OwnLinesView, restored: RestoredOwnSlots):
  { group: string; detail: string } | undefined {
  const mask = new Set(restored.slots.map(s => s.place));
  const read = (view: OwnLinesView) => {
    const at = new Map<string, { id: number; token: string }[]>();
    const trees = groupTrees(view, mask, undefined, (slot, id, token) => { const a = at.get(slot) ?? []; a.push({ id, token }); at.set(slot, a); });
    return { trees, at };
  };
  const out = read(output), again = read(rewritten);
  const skip = new Set(restored.skip);
  for (const s of restored.slots) {
    const there = again.at.get(s.place) ?? [];
    if (there.length !== 1 || refsOutsideText(there[0].token).length > 0) skip.add(s.group);
  }
  for (const s of restored.slots) {
    if (skip.has(s.group)) continue;
    const there = out.at.get(s.place) ?? [];
    if (there.length === 1 && there[0].id === s.id && there[0].token.trim() === s.token.trim()) continue;
    const found = there.map(t => `#${t.id} ${t.token.trim()}`).join(', ') || 'niets';
    return { group: s.group, detail: `de eigen groep ${s.group} draagt de bronwaarde niet meer: op ${s.place} hoort #${s.id} met ${s.token.trim()} te staan, de uitvoer heeft ${found}` };
  }
  return ownGroupDifference(out.trees, again.trees, skip);
}

/** Het eerste verschil tussen twee indelingen: de groep en een stukje van beide kanten rond het eerste andere teken. */
export function ownGroupDifference(output: ReadonlyMap<string, readonly string[]>, rewritten: ReadonlyMap<string, readonly string[]>,
  skip: ReadonlySet<string>): { group: string; detail: string } | undefined {
  const names = [...new Set([...output.keys(), ...rewritten.keys()])].filter(g => !skip.has(g)).sort();
  for (const group of names) {
    const x = (output.get(group) ?? []).join('\n'), y = (rewritten.get(group) ?? []).join('\n');
    if (x === y) continue;
    let i = 0;
    while (i < x.length && x[i] === y[i]) i++;
    const around = (s: string) => s.slice(Math.max(0, i - 60), i + 80) || '(niets)';
    return { group, detail: `de eigen groep ${group} leest niet terug tot wat de writer ervan maakt: uitvoer «${around(x)}», herschreven «${around(y)}»` };
  }
  return undefined;
}
