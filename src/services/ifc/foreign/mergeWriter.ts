/**
 * De writer met een vreemd deel (#804 fase 1b, ontwerp "Gebouwmodel behouden" §4.3, §4.4, §4.6 en §4.10).
 *
 * Opbouw van de uitvoer (§4.10): de kop van de bron; de niet-P-stukken die vóór het eerste P-stuk staan; het hele P-blok
 * in de volgorde van de writer; de overige niet-P-stukken in bronvolgorde; de staart. Heeft de bron geen P-stuk, dan komt
 * het P-blok na het laatste bronstuk, vóór de staart. Niet-P-stukken blijven byte-gelijk en houden hun volgorde. De
 * uitvoer is een lijst `Uint8Array`-delen: stukken van de bron als `subarray` (geen kopie), het P-blok in een paar delen.
 *
 * Ids (§4.3): elk D-stuk houdt zijn bron-`#id` (via `ifcSource.stepIds`). R-stukken, hulpstukken en nieuwe objecten
 * krijgen ids vanaf het hoogste id van de niet-P-stukken plus 1, en slaan de D-ids over.
 *
 * Project (§4.4): is het `IfcProject` van de bron niet P, dan schrijft de writer geen eigen project, eenheden en context;
 * naam, omschrijving, auteur en bedrijf gaan in `OPS_ProjectSettings`.
 *
 * Bewaarde relaties gaan voor (§4.6, v20): geen eigen `IfcRelNests`, `IfcRelAggregates` of `IfcRelDeclares` voor een
 * D-object dat al lid is van een bewaarde relatie van dat type (zo krijgt niets twee `Nests`/`Decomposes`/`HasContext`,
 * die zijn SET [0:1]). Geen taak in het D-schema als zij of een voorouder in de `IfcRelAssignsToControl` of `IfcRelNests`
 * van een ander werkschema staat. Een ongewijzigde gemengde relatie (§4.6) blijft byte-gelijk; de writer laat haar D-leden
 * dan weg uit zijn eigen relatie. Een vreemd lid van een eigen pset hangt hij aan de pset die hij voor hetzelfde object en
 * dezelfde naam schrijft.
 *
 * Wat zonder fase 2 niet veilig kan, schrijft deze writer niet: hij gooit `MergeNeedsPhase2Error` (code
 * `merge-needs-phase2`) met elk geval, vóór er iets geschreven is. Nooit stil weglaten.
 *
 * Fase 1b: alleen tests gebruiken deze writer. Opslaan met een vreemd deel blijft geweigerd tot 1c.
 */
import type { ImportResult } from '@/services/importTypes';
import { readIFC } from '../ifcReader';
import { writeIFC, writeIfcMergeLines, type WriteIFCInput, type WriterMergeIds } from '../ifcWriter';
import { PSET, ifcStr } from '../ifcPsets';
import { decodeStepText } from '../stepText';
import { classify, type Classification } from './classify';
import { foreignScanFrom, readerBytes, readerStepIds } from './foreignScan';
import type { IfcSource } from './ifcSource';
import { scanStep, splitStepArgs, type StepIndex } from './stepScanner';

/** De gevallen waarin de writer zonder fase 2 niet veilig kan schrijven. */
export type MergePhase2Kind =
  /** Een D- of R-stuk van een ander programma (§4.5): zonder `sourceSlots` gingen owner history, `Creators` en andere
   *  slots van dat programma verloren. */
  | 'vreemde-herkomst'
  /** Een eigen D-, R- of propertystuk met een waarde in een slot dat de writer leeg (`$`) schrijft (§4.5, constant). */
  | 'constant-slot'
  /** Een sleutel in de JSON van een eigen property die de writer niet terugschrijft (`jsonExtras`, §4.2). */
  | 'json-sleutel'
  /** Een sleutel in `OPS_Assignments` die de lezer niet gebruikt (`unusedKeys`, §4.2). */
  | 'ongebruikte-sleutel'
  /** Een niet-P-stuk wijst naar een D-object dat niet meer bestaat, of een vreemd lid hoort bij zo'n object (§4.7). */
  | 'verwijderd'
  /** Een niet-P-stuk wijst naar een P-stuk zonder vast id (een relatie of hulpstuk, §4.3). */
  | 'verwijzing-naar-p'
  /** Een D-object kreeg een andere plek dan in een bewaarde relatie (§4.6, verplaatsen uit een bewaarde relatie). */
  | 'verplaatst'
  /** De D-leden van een gemengde relatie veranderden, of de volgorde na herlezen zou anders zijn (§4.6). */
  | 'gemengde-relatie'
  /** Een vreemd lid zonder eigen pset (of template) om aan te hangen. */
  | 'vreemd-lid'
  /** De writer schrijft een D-object met een ander entiteittype dan de bron (§4.5: het type komt uit de bron). */
  | 'entiteittype'
  /** De bron heeft meer dan één `IfcProject`. */
  | 'meer-projecten';

export interface MergePhase2Case {
  readonly kind: MergePhase2Kind;
  /** Het `#id` in de bron waar het geval over gaat, als er één is. */
  readonly sourceId?: number;
  readonly detail: string;
}

/** Schrijven met dit vreemde deel kan pas veilig met fase 2. Er is niets geschreven. */
export class MergeNeedsPhase2Error extends Error {
  readonly code = 'merge-needs-phase2' as const;
  readonly cases: readonly MergePhase2Case[];
  constructor(cases: readonly MergePhase2Case[]) {
    const kinds = new Map<MergePhase2Kind, number>();
    for (const c of cases) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    super(`merge-needs-phase2: ${[...kinds].map(([k, n]) => `${k} (${n})`).join(', ')}`);
    this.name = 'MergeNeedsPhase2Error';
    this.cases = cases;
  }
}

const NESTS = 'IFCRELNESTS';
const AGGREGATES = 'IFCRELAGGREGATES';
const DECLARES = 'IFCRELDECLARES';
const CONTROL = 'IFCRELASSIGNSTOCONTROL';
const PROCESS = 'IFCRELASSIGNSTOPROCESS';
const DEFINES = 'IFCRELDEFINESBYPROPERTIES';

/** Argumentposities van relating en related per structureel relatietype. */
const REL_ARGS: Readonly<Record<string, { relating: number; related: number }>> = {
  [NESTS]: { relating: 4, related: 5 },
  [AGGREGATES]: { relating: 4, related: 5 },
  [DECLARES]: { relating: 4, related: 5 },
  [CONTROL]: { relating: 6, related: 4 },
  [PROCESS]: { relating: 6, related: 4 },
};
/** Typen waarvan het lid maar in één relatie mag staan (inverse SET [0:1]): `Nests`, `Decomposes`, `HasContext`. */
const SINGLE_MEMBERSHIP: ReadonlySet<string> = new Set([NESTS, AGGREGATES, DECLARES]);

/** Een regel van de writer: `#id=TYPE(args);`. */
interface OwnLine {
  readonly id: number;
  readonly type: string;
  args: string[];
  text: string;
  drop: boolean;
}

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;

function parseLine(text: string): OwnLine {
  const m = LINE.exec(text);
  if (!m) throw new Error(`mergeWriter: onverwachte regel van de writer: ${text.slice(0, 80)}`);
  return { id: Number(m[1]), type: m[2], args: splitStepArgs(m[3]), text, drop: false };
}

function setArgs(line: OwnLine, args: string[]): void {
  line.args = args;
  line.text = `#${line.id}=${line.type}(${args.join(',')});`;
}

/** `#12` → 12; anders -1. */
function refOf(token: string | undefined): number {
  const m = /^#(\d+)$/.exec((token ?? '').trim());
  return m ? Number(m[1]) : -1;
}

/** `(#1,#2)` → [1, 2]. */
function refList(token: string | undefined): number[] {
  const t = (token ?? '').trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return [];
  return splitStepArgs(t.slice(1, -1)).map(refOf).filter(id => id >= 0);
}

const formatRefs = (ids: readonly number[]) => `(${ids.map(id => `#${id}`).join(',')})`;

/** Een multiset van ids. */
class Bag {
  readonly #m = new Map<number, number>();
  add(id: number): void { this.#m.set(id, (this.#m.get(id) ?? 0) + 1); }
  /** Haal er één weg; `true` als dat lukte. */
  take(id: number): boolean {
    const n = this.#m.get(id) ?? 0;
    if (n === 0) return false;
    this.#m.set(id, n - 1);
    return true;
  }
}

/**
 * Schrijf het document met het vreemde deel van `source`. Zonder vreemd deel: de gewone writer (`writeIFC`), zoals nu.
 * Gooit `MergeNeedsPhase2Error` als het niet veilig kan zonder fase 2; dan is er niets geschreven.
 */
export function writeIfcMerge(input: WriteIFCInput, source: IfcSource): Uint8Array[] {
  if (!source.foreign) return [new TextEncoder().encode(writeIFC(input))];
  const index = scanStep(source.bytes);
  const cls = classify(index);
  assertSameSource(index, cls, source);

  const cases: MergePhase2Case[] = [];
  const caseAt = (kind: MergePhase2Kind, chunk: number, detail: string) =>
    cases.push({ kind, ...(chunk >= 0 ? { sourceId: Number(index.id(chunk)) } : {}), detail });
  const n = index.count;
  const isP = (i: number) => cls.classes[i] === 1;
  const inD = cls.selection.inD;
  const sid = (chunk: number) => Number(index.id(chunk));
  const label = (chunk: number) => `${index.type(chunk)} #${index.id(chunk)}`;

  // ── 1. Wat de bron zelf al uitsluit ──
  for (const i of cls.foreignOrigin) caseAt('vreemde-herkomst', i, `${label(i)} heeft de owner history van een ander programma`);
  const projects: number[] = [];
  for (let i = 0; i < n; i++) if (index.isEntity(i) && index.type(i) === 'IFCPROJECT') projects.push(i);
  if (projects.length > 1) caseAt('meer-projecten', projects[1], `${projects.length} keer IfcProject`);
  const projectChunk = projects.length > 0 ? projects[0] : -1;
  const projectIsP = projectChunk >= 0 && isP(projectChunk);

  // ── 2. Het domein en de kaart domein-id → bron-#id ──
  const tasks = new Map(input.tasks.map(t => [t.id, t]));
  const resources = new Map(input.resources.map(r => [r.id, r]));
  const projectCalendarId = input.calendar.id;
  const keep = new Map<string, number>();
  /** bron-#id → het domeinobject (soort en id) */
  const bySource = new Map<number, { kind: string; id: string }>();
  for (const [seed, stepId] of Object.entries(source.stepIds)) {
    const at = seed.indexOf(':');
    const kind = seed.slice(0, at);
    const id = seed.slice(at + 1);
    const key = kind === 'task' ? `task_${id}`
      : kind === 'res' ? `res_${id}`
        : kind === 'seq' ? `seq_${id}`
          : kind === 'cal' ? (id === projectCalendarId ? '_calendar' : `calendar_${id}`)
            : kind === 'proj' ? (projectIsP ? '_project' : undefined)
              : kind === 'wp' ? '_workplan'
                : kind === 'ws' ? '_worksched' : undefined;
    if (!key || bySource.has(stepId)) continue; // de eerste sleutel voor een bron-id wint
    keep.set(key, stepId);
    bySource.set(stepId, { kind, id });
  }
  const reserved = new Set<number>();
  let maxNonP = 0;
  let firstP = -1;
  let ownerHistoryBeforeP = false;
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i)) continue;
    if (inD[i]) reserved.add(sid(i));
    if (isP(i)) { if (firstP < 0) firstP = i; continue; }
    maxNonP = Math.max(maxNonP, sid(i));
    if (firstP < 0 && index.type(i) === 'IFCOWNERHISTORY') ownerHistoryBeforeP = true;
  }
  // Ook een vast id buiten D (het project als het P is) mag de reeks niet uitgeven.
  for (const id of keep.values()) reserved.add(id);
  // De koppen van de eigen baselines (D) staan niet in `stepIds`; ze houden hun id via hun GlobalId. Een GlobalId dat
  // twee koppen delen, telt niet: dan is niet te zeggen welke kop bij welke baseline hoort.
  const baselineHeads = new Map<string, number>();
  const sharedHeadGuid = new Set<string>();
  for (let i = 0; i < n; i++) {
    if (!inD[i] || !index.isEntity(i) || index.type(i) !== 'IFCWORKSCHEDULE') continue;
    const guid = index.globalId(i);
    if (!guid || !index.argTokens(i)?.includes('.BASELINE.')) continue;
    if (baselineHeads.has(guid)) sharedHeadGuid.add(guid);
    baselineHeads.set(guid, sid(i));
  }
  for (const guid of sharedHeadGuid) baselineHeads.delete(guid);
  const plan: WriterMergeIds = {
    keep, firstId: maxNonP + 1, reserved, baselineHeads,
    ...(projectIsP || projectChunk < 0 ? {} : { projectSourceId: sid(projectChunk) }),
    projectData: (!projectIsP && projectChunk >= 0) || ownerHistoryBeforeP,
  };

  // ── 3. De writer ──
  const written = writeIfcMergeLines(input, plan);
  const lines = written.lines.map(parseLine);
  const byId = new Map<number, OwnLine>();
  for (const line of lines) {
    if (byId.has(line.id)) throw new Error(`mergeWriter: de writer gaf #${line.id} twee keer uit`);
    byId.set(line.id, line);
  }
  const outIdOf = (key: string) => written.idMap.get(key);
  const scheduleOut = outIdOf('_worksched');

  // ── 4. Bewaarde en gemengde relaties ──
  /** Leden die in geen eigen relatie van dit type mogen staan (SET [0:1]). */
  const noOwnRel = new Map<string, Set<number>>([[NESTS, new Set()], [AGGREGATES, new Set()], [DECLARES, new Set()]]);
  /** Per `type|relating`: leden die de writer weglaat omdat een ongewijzigde gemengde relatie ze al heeft. */
  const mixedMembers = new Map<string, Bag>();
  const bagFor = (type: string, relating: number) => {
    const key = `${type}|${relating}`;
    let bag = mixedMembers.get(key);
    if (!bag) mixedMembers.set(key, bag = new Bag());
    return bag;
  };
  /** D-taken in een relatie van een ander werkschema (niet D). */
  const otherScheduleTasks = new Set<number>();
  const domainOf = (chunk: number) => bySource.get(sid(chunk));
  const taskOf = (chunk: number) => {
    const d = domainOf(chunk);
    return d?.kind === 'task' ? tasks.get(d.id) : undefined;
  };

  for (let r = 0; r < n; r++) {
    if (!index.isEntity(r) || isP(r)) continue;
    const type = index.type(r);
    const pos = REL_ARGS[type];
    if (!pos) continue;
    const relating = index.refAt(r, pos.relating);
    const members = index.refsAt(r, pos.related).filter(x => x >= 0 && inD[x]);
    if (members.length === 0) continue;
    if (relating >= 0 && inD[relating]) {
      mixedRelation(r, type, relating, members);
      continue;
    }
    // Bewaarde relatie met een relating buiten D: haar D-leden houden hun plek.
    const relatingIsSchedule = relating >= 0 && index.type(relating) === 'IFCWORKSCHEDULE';
    for (const m of members) {
      if (SINGLE_MEMBERSHIP.has(type)) noOwnRel.get(type)!.add(sid(m));
      if (type === NESTS) {
        const d = domainOf(m);
        const moved = d?.kind === 'task' ? !!tasks.get(d.id)?.parentId : d?.kind === 'res' ? resources.get(d.id)?.parentId != null : false;
        if (moved) caseAt('verplaatst', m, `${label(m)} staat in ${label(r)} van een ander, maar heeft in de planning een ouder`);
      }
      if ((type === NESTS || type === CONTROL) && relatingIsSchedule && index.type(m) === 'IFCTASK') otherScheduleTasks.add(sid(m));
    }
  }

  function mixedRelation(r: number, type: string, relating: number, members: number[]): void {
    const relType = index.type(relating);
    const relatingDomain = domainOf(relating);
    const bag = bagFor(type, sid(relating));
    // Een lid dat niet meer bestaat (of dat de planning niet kent): dat meldt de controle op verwijzingen (stap 7).
    const missing = members.some(m => !domainOf(m) || (domainOf(m)!.kind === 'task' ? !tasks.has(domainOf(m)!.id)
      : domainOf(m)!.kind === 'res' ? !resources.has(domainOf(m)!.id) : false));
    if (missing) return;
    if (type === NESTS && relType === 'IFCTASK' && relatingDomain?.kind === 'task') {
      const parent = tasks.get(relatingDomain.id);
      const s = members.map(m => taskOf(m)?.id);
      if (!parent || s.some(id => id === undefined || tasks.get(id)!.parentId !== parent.id)) {
        caseAt('gemengde-relatie', r, `${label(r)}: een D-lid heeft een andere ouder`);
        return;
      }
      // De lezer leest de eigen relatie (in het blok) vóór de gemengde (erna): de volgorde moet dan die van het domein zijn.
      const others = parent.childIds.filter(id => !s.includes(id));
      if (parent.childIds.join('\u0000') !== [...others, ...s].join('\u0000')) {
        caseAt('gemengde-relatie', r, `${label(r)}: de volgorde van de kinderen zou na herlezen anders zijn`);
        return;
      }
    } else if (type === NESTS && relType === 'IFCWORKSCHEDULE') {
      if (members.some(m => !!taskOf(m)?.parentId)) {
        caseAt('gemengde-relatie', r, `${label(r)}: een D-lid is geen wortel-taak meer`);
        return;
      }
    } else if (type === AGGREGATES && relType === 'IFCWORKPLAN') {
      // Het D-schema hangt altijd onder het D-werkplan; een eigen baselinekop heeft geen vast id (zie de verwijzingen).
    } else if (type === CONTROL && relType === 'IFCWORKSCHEDULE') {
      // Elke taak hangt aan het D-schema; de leden bestaan nog (hierboven).
    } else if (type === CONTROL && relType === 'IFCWORKCALENDAR' && relatingDomain?.kind === 'cal') {
      const calId = relatingDomain.id;
      for (const m of members) {
        const d = domainOf(m)!;
        const own = d.kind === 'task' ? tasks.get(d.id)?.calendarId : d.kind === 'res' ? resources.get(d.id)?.calendarId : undefined;
        const same = calId === projectCalendarId ? !own || own === projectCalendarId : own === calId;
        if (!same) {
          caseAt('gemengde-relatie', r, `${label(r)}: ${label(m)} heeft een andere kalender`);
          return;
        }
      }
    } else if (type === PROCESS && relType === 'IFCTASK' && relatingDomain?.kind === 'task') {
      const taskId = relatingDomain.id;
      const domainRes = input.assignments.filter(a => a.taskId === taskId).map(a => a.resourceId);
      const s = members.map(m => domainOf(m)?.id);
      const count = (list: readonly (string | undefined)[], id: string | undefined) => list.filter(x => x === id).length;
      for (const id of new Set(s)) {
        // Meer toewijzingen van dezelfde resource: de wachtrij van `OPS_Assignments` kan dan schuiven.
        if (count(s, id) > 1 || count(domainRes, id) !== 1) {
          caseAt('gemengde-relatie', r, `${label(r)}: de toewijzingen van de taak veranderden`);
          return;
        }
      }
      const others = domainRes.filter(id => !s.includes(id));
      if (domainRes.join('\u0000') !== [...others, ...s].join('\u0000')) {
        caseAt('gemengde-relatie', r, `${label(r)}: de volgorde van de toewijzingen zou na herlezen anders zijn`);
        return;
      }
    } else {
      caseAt('gemengde-relatie', r, `${label(r)} met relating ${label(relating)}: deze vorm kan pas in fase 2`);
      return;
    }
    for (const m of members) bag.add(sid(m));
  }

  // De taken die niet aan het D-schema mogen: zelf of via een voorouder in een relatie van een ander werkschema.
  const notInSchedule = new Set<number>();
  for (const t of input.tasks) {
    for (let cur: typeof t | undefined = t, guard = 0; cur && guard < 10000; cur = cur.parentId ? tasks.get(cur.parentId) : undefined, guard++) {
      const kept = keep.get(`task_${cur.id}`);
      if (kept !== undefined && otherScheduleTasks.has(kept)) {
        const out = outIdOf(`task_${t.id}`);
        if (out !== undefined) notInSchedule.add(out);
        break;
      }
    }
  }

  for (const line of lines) {
    const pos = REL_ARGS[line.type];
    if (!pos) continue;
    const relating = refOf(line.args[pos.relating]);
    const before = refList(line.args[pos.related]);
    const bag = mixedMembers.get(`${line.type}|${relating}`);
    const banned = noOwnRel.get(line.type);
    const scheduleRel = relating === scheduleOut && (line.type === NESTS || line.type === CONTROL);
    const after = before.filter(m => !(banned?.has(m)) && !(bag?.take(m)) && !(scheduleRel && notInSchedule.has(m)));
    if (after.length === before.length) continue;
    if (after.length === 0) line.drop = true;
    else {
      const args = [...line.args];
      args[pos.related] = formatRefs(after);
      setArgs(line, args);
    }
  }

  // ── 5. Gemengde psets (§4.6 b): ongewijzigd ⇒ geen eigen pset voor dat D-object ──
  const ownPsetsOf = indexOwnPsets(lines, byId);
  for (let r = 0; r < n; r++) {
    if (!index.isEntity(r) || isP(r) || index.type(r) !== DEFINES) continue;
    const pset = index.refAt(r, 5);
    if (pset < 0 || index.type(pset) !== 'IFCPROPERTYSET') continue;
    const name = index.name(pset) ?? '';
    if (!REGISTER_PSETS.has(name)) continue;
    for (const owner of index.refsAt(r, 4).filter(x => x >= 0 && inD[x])) {
      const own = ownPsetsOf.get(`${sid(owner)}|${name}`);
      const want = sourceProps(index, pset);
      if (!own || own.rels.some(rel => refList(rel.args[4]).length !== 1) || !sameProps(own.props, want)) {
        caseAt('gemengde-relatie', r, `${label(r)}: de pset ${name} van ${label(owner)} veranderde (of de writer deelt haar)`);
        continue;
      }
      own.pset.drop = true;
      for (const p of own.propLines) p.drop = true;
      for (const rel of own.rels) rel.drop = true;
    }
  }

  // ── 6. Vreemde leden aan de eigen pset of template hangen ──
  const extraPsets = new Map<string, { owner: number; pset: number; rel: number; members: number[] }>();
  for (const m of cls.foreignMembers) {
    for (let k = index.inStart(m); k < index.inEnd(m); k++) {
      const parent = index.inSource(k);
      if (parent < 0 || !isP(parent)) continue;
      const ptype = index.type(parent);
      const name = index.name(parent) ?? '';
      if (ptype === 'IFCPROPERTYSET' && index.inArg(k) === 4) {
        const owners = psetOwners(index, parent);
        if (owners.length !== 1) {
          caseAt('vreemd-lid', m, `${label(m)} hoort bij ${label(parent)} met ${owners.length} eigenaren`);
          continue;
        }
        const own = ownPsetsOf.get(`${sid(owners[0])}|${name}`);
        if (!own || own.pset.drop) {
          const owner = owners[0];
          const exists = !isP(owner) || (byId.has(sid(owner)) && !byId.get(sid(owner))!.drop);
          if (!exists) {
            caseAt('verwijderd', m, `${label(m)} hoort bij ${name} van ${label(owner)}, dat niet meer bestaat`);
            continue;
          }
          // De writer schrijft deze pset niet (golden rule: niets eigens te schrijven). Dan een pset met alleen de vreemde
          // leden, met de GlobalIds van de bron, zodat het lidmaatschap blijft (§4.10, controle 1).
          const key = `${sid(owner)}|${name}`;
          let extra = extraPsets.get(key);
          if (!extra) extraPsets.set(key, extra = { owner: sid(owner), pset: parent, rel: psetRel(index, parent), members: [] });
          extra.members.push(sid(m));
          continue;
        }
        const args = [...own.pset.args];
        args[4] = formatRefs([...refList(args[4]), sid(m)]);
        setArgs(own.pset, args);
      } else if (ptype === 'IFCPROPERTYSETTEMPLATE' && index.inArg(k) === 6) {
        const tmpl = lines.find(l => !l.drop && l.type === 'IFCPROPERTYSETTEMPLATE' && unquote(l.args[2]) === name);
        if (!tmpl) {
          caseAt('vreemd-lid', m, `${label(m)} hoort bij het template ${name}, maar de writer schrijft dat niet`);
          continue;
        }
        const args = [...tmpl.args];
        args[6] = formatRefs([...refList(args[6]), sid(m)]);
        setArgs(tmpl, args);
      }
    }
  }

  if (extraPsets.size > 0) {
    let next = Math.max(plan.firstId - 1, ...lines.map(l => l.id)) + 1;
    const nextId = () => { while (reserved.has(next)) next++; return next++; };
    const ownerHistory = written.idMap.get('_owner');
    for (const extra of extraPsets.values()) {
      const text = (chunk: number, arg: number) => ifcStr(index.tokenText(chunk, index.argTokens(chunk)?.[arg]));
      const psetId = nextId();
      lines.push(parseLine(`#${psetId}=IFCPROPERTYSET(${text(extra.pset, 0)},#${ownerHistory},${text(extra.pset, 2)},`
        + `${text(extra.pset, 3)},${formatRefs(extra.members)});`));
      const relGuid = extra.rel >= 0 ? text(extra.rel, 0) : ifcStr(`${index.globalId(extra.pset)}`);
      const relName = extra.rel >= 0 ? `${text(extra.rel, 2)},${text(extra.rel, 3)}` : '$,$';
      lines.push(parseLine(`#${nextId()}=IFCRELDEFINESBYPROPERTIES(${relGuid},#${ownerHistory},${relName},(#${extra.owner}),#${psetId});`));
    }
  }

  // ── 7. Verwijzingen van buiten P: alleen naar een D-object dat met zijn bron-id in de uitvoer staat ──
  const emitted = new Set<number>();
  for (const line of lines) if (!line.drop) emitted.add(line.id);
  // Een vast id: een domeinobject uit `stepIds`, of de kop van een eigen baseline (`baselineHeads`).
  const fixedIds = new Set<number>([...bySource.keys(), ...baselineHeads.values()]);
  for (let c = 0; c < n; c++) {
    if (!index.isEntity(c) || isP(c)) continue;
    for (let k = index.outStart(c); k < index.outEnd(c); k++) {
      const t = index.outTarget(k);
      if (t < 0 || !isP(t)) continue;
      const id = sid(t);
      if (fixedIds.has(id) && emitted.has(id)) continue;
      if (inD[t] && !emitted.has(id)) {
        caseAt('verwijderd', c, `${label(c)} wijst naar ${label(t)}, dat ${fixedIds.has(id) ? 'niet meer bestaat' : 'de planning niet kent'}`);
      }
      else caseAt('verwijzing-naar-p', c, `${label(c)} wijst naar ${label(t)}, dat bij opslaan een nieuw id krijgt`);
    }
  }
  // Het type van een D-object komt uit de bron (§4.5).
  for (const [, id] of keep) {
    const line = byId.get(id);
    const chunk = index.chunkOf(String(id));
    if (line && !line.drop && chunk >= 0 && line.type !== index.type(chunk)) {
      caseAt('entiteittype', chunk, `${label(chunk)} zou ${line.type} worden`);
    }
  }

  // ── 8. Wat de writer ook zonder bewerking niet terugschrijft (constante slots, JSON-sleutels, ongebruikte sleutels) ──
  pristineChecks(index, cls, source, emitted, caseAt);

  if (cases.length > 0) throw new MergeNeedsPhase2Error(cases);
  return assemble(source, index, cls, lines.filter(l => !l.drop).map(l => l.text));
}

/** De pset-namen van het register: alleen bij die psets is een gemengde pset (§4.6 b) mogelijk. */
const REGISTER_PSETS: ReadonlySet<string> = new Set(Object.values(PSET));

function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.startsWith("'") && t.endsWith("'") && t.length >= 2 ? t.slice(1, -1).replace(/''/g, "'") : '';
}

/** De eigen psets van de writer per `eigenaar-id|psetnaam`, met hun property-regels en relaties. */
interface OwnPset { pset: OwnLine; propLines: OwnLine[]; rels: OwnLine[]; props: Map<string, string> }
function indexOwnPsets(lines: readonly OwnLine[], byId: ReadonlyMap<number, OwnLine>): Map<string, OwnPset> {
  const out = new Map<string, OwnPset>();
  for (const rel of lines) {
    if (rel.type !== DEFINES) continue;
    const pset = byId.get(refOf(rel.args[5]));
    if (!pset || pset.type !== 'IFCPROPERTYSET') continue;
    const name = unquote(pset.args[2]);
    const propLines = refList(pset.args[4]).map(id => byId.get(id)).filter((l): l is OwnLine => !!l);
    const props = new Map<string, string>();
    for (const p of propLines) props.set(unquote(p.args[0]), propValue(p.args, t => decodeStepText(unquote(t))));
    for (const owner of refList(rel.args[4])) {
      const key = `${owner}|${name}`;
      const have = out.get(key);
      if (have && have.pset === pset) have.rels.push(rel);
      else if (!have) out.set(key, { pset, propLines, rels: [rel], props });
    }
  }
  return out;
}

/** De properties van een pset in de bron: naam → de overige argumenten als tekst. */
function sourceProps(index: StepIndex, pset: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of index.refsAt(pset, 4)) {
    if (p < 0) continue;
    const args = index.argTokens(p) ?? [];
    out.set(index.name(p) ?? '', propValue(args, t => index.tokenText(p, t)));
  }
  return out;
}

/**
 * De waarde van een property zoals de lezer haar ziet: het type en de waarde (een getal als getal, tekst gedecodeerd), plus
 * `Description` en `Unit`. Zo is `IFCREAL(8)` gelijk aan `IFCREAL(8.)` (de writer schrijft sinds 2026-10-13 altijd een
 * punt) en `'caf\X2\00E9\X0\'` gelijk aan dezelfde tekst in een bestand met letterlijke codering.
 */
function propValue(args: readonly string[], text: (token: string) => string): string {
  const typed = (token: string | undefined): unknown => {
    const t = (token ?? '').trim();
    const m = /^([A-Z0-9_]+)\s*\(([\s\S]*)\)$/.exec(t);
    if (!m) return t.startsWith("'") ? ['', text(t)] : t;
    const inner = m[2].trim();
    if (inner.startsWith("'")) return [m[1], text(inner)];
    const num = Number(inner);
    return [m[1], inner !== '' && Number.isFinite(num) ? num : inner];
  };
  return JSON.stringify([typed(args[1]), typed(args[2]), typed(args[3])]);
}

function sameProps(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/** De (eerste) `IfcRelDefinesByProperties` van een pset in de bron, of -1. */
function psetRel(index: StepIndex, pset: number): number {
  for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
    const rel = index.inSource(k);
    if (rel >= 0 && index.type(rel) === DEFINES && index.inArg(k) === 5) return rel;
  }
  return -1;
}

/** De eigenaren van een pset in de bron (via `IfcRelDefinesByProperties`). */
function psetOwners(index: StepIndex, pset: number): number[] {
  const owners: number[] = [];
  for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
    const rel = index.inSource(k);
    if (rel >= 0 && index.type(rel) === DEFINES && index.inArg(k) === 5) owners.push(...index.refsAt(rel, 4).filter(x => x >= 0));
  }
  return owners;
}

/** De bron moet de bron zijn waaruit `ifcSource` kwam: dezelfde stukken met dezelfde ids en klassen. */
function assertSameSource(index: StepIndex, cls: Classification, source: IfcSource): void {
  const same = index.count === source.classes.length
    && cls.classes.every((c, i) => c === source.classes[i])
    && Array.from({ length: index.count }, (_, i) => i).every(i => (index.id(i) === '' ? -1 : Number(index.id(i))) === source.chunkIds[i]);
  if (!same) throw new Error('mergeWriter: de bronbytes passen niet bij ifcSource');
}

/**
 * De controles op wat de writer ook zonder bewerking niet terugschrijft. De lezer leest de bron opnieuw (de stand bij
 * openen), de writer schrijft die, en de uitkomst wordt vergeleken met de bron, per object met hetzelfde GlobalId:
 *  - een slot met een waarde in de bron dat de writer leeg (`$`) schrijft (een constant slot, §4.5). Een verwijzing naar
 *    een P-stuk telt niet (de writer schrijft dat hulpstuk zelf opnieuw), een lege tekst ook niet;
 *  - een pset: een property met `Description` of `Unit` die de writer leeg schrijft, een JSON-sleutelpad dat de writer
 *    niet terugschrijft (`jsonExtras`), en in `OPS_Assignments` meer sleutels per resource dan de writer schrijft
 *    (`unusedKeys`).
 * Alleen voor objecten die in de uitvoer nog bestaan: met het object vervallen ook zijn gegevens (§4.7).
 */
function pristineChecks(
  index: StepIndex, cls: Classification, source: IfcSource, emitted: ReadonlySet<number>,
  caseAt: (kind: MergePhase2Kind, chunk: number, detail: string) => void,
): void {
  const scan = foreignScanFrom(index, cls, source.bytes);
  const text = new TextDecoder('utf-8').decode(readerBytes(source.bytes, scan));
  const pristine: ImportResult = readIFC(text, {}, { ...readerStepIds(scan), skipBuildingModelGuard: true });
  const outIndex = scanStep(new TextEncoder().encode(writeIFC(pristine)));
  const isP = (i: number) => cls.classes[i] === 1;
  const label = (chunk: number) => `${index.type(chunk)} #${index.id(chunk)}`;

  const uniqueGuids = (idx: StepIndex, keepChunk: (i: number) => boolean) => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    for (let i = 0; i < idx.count; i++) {
      if (!idx.isEntity(i) || !keepChunk(i)) continue;
      const g = idx.globalId(i);
      if (!g) continue;
      if (seen.has(g)) dup.add(g); else seen.set(g, i);
    }
    for (const g of dup) seen.delete(g);
    return seen;
  };
  const srcGuids = uniqueGuids(index, i => isP(i) && (cls.selection.inD[i] === 1 || cls.inR[i] === 1));
  const outGuids = uniqueGuids(outIndex, () => true);
  // Een stuk buiten P (bijvoorbeeld het project van het model) blijft staan; een P-stuk bestaat als de writer het schrijft.
  const exists = (chunk: number) => !isP(chunk) || emitted.has(Number(index.id(chunk)));

  const lostSlot = (srcTok: string, outTok: string | undefined) => {
    if (outTok !== '$' || srcTok === '$' || srcTok === "''") return false;
    // Een verwijzing (of lijst) naar alleen P-stukken: de writer schrijft dat hulpstuk zelf.
    const refs = [...srcTok.matchAll(/#(\d+)/g)].map(m => index.chunkOf(m[1]));
    if (refs.length > 0 && refs.every(r => r >= 0 && cls.classes[r] === 1) && srcTok.replace(/#\d+|[(),\s]/g, '') === '') return false;
    return true;
  };

  // D- en R-stukken.
  for (const [guid, chunk] of srcGuids) {
    if (!exists(chunk) && !cls.inR[chunk]) continue;
    const out = outGuids.get(guid);
    if (out === undefined || outIndex.type(out) !== index.type(chunk)) continue;
    const a = index.argTokens(chunk);
    const b = outIndex.argTokens(out);
    if (!a || !b || a.length !== b.length) continue; // oude lay-out: geen slots te bewaren (§4.5)
    for (let k = 0; k < a.length; k++) {
      if (lostSlot(a[k], b[k])) caseAt('constant-slot', chunk, `${label(chunk)}, argument ${k}: ${a[k].slice(0, 40)}`);
    }
  }

  // Psets, per eigenaren (GlobalIds) en naam.
  const psetKey = (idx: StepIndex, pset: number) => {
    const owners = psetOwners(idx, pset).map(o => idx.globalId(o));
    if (owners.length === 0 || owners.some(g => !g)) return undefined;
    return `${owners.sort().join('+')}|${idx.name(pset) ?? ''}`;
  };
  const outPsets = new Map<string, number>();
  for (let i = 0; i < outIndex.count; i++) {
    if (outIndex.isEntity(i) && outIndex.type(i) === 'IFCPROPERTYSET') {
      const key = psetKey(outIndex, i);
      if (key) outPsets.set(key, i);
    }
  }
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || !isP(i) || index.type(i) !== 'IFCPROPERTYSET') continue;
    const owners = psetOwners(index, i);
    if (owners.length === 0 || !owners.every(exists)) continue;
    const key = psetKey(index, i);
    const out = key ? outPsets.get(key) : undefined;
    const name = index.name(i) ?? '';
    const srcProps = index.refsAt(i, 4).filter(p => p >= 0 && isP(p));
    const outProps = out === undefined ? [] : outIndex.refsAt(out, 4).filter(p => p >= 0);
    if (name === PSET.Assignments) {
      const perResource = (idx: StepIndex, props: number[]) => {
        const m = new Map<string, number>();
        for (const p of props) {
          const g = (idx.name(p) ?? '').replace(/#\d+$/, '');
          m.set(g, (m.get(g) ?? 0) + 1);
        }
        return m;
      };
      const want = perResource(outIndex, outProps);
      for (const [g, count] of perResource(index, srcProps)) {
        if (count > (want.get(g) ?? 0)) caseAt('ongebruikte-sleutel', i, `${label(i)}: ${count - (want.get(g) ?? 0)} sleutel(s) voor ${g}`);
      }
      continue;
    }
    if (out === undefined) continue;
    const outByName = new Map(outProps.map(p => [outIndex.name(p) ?? '', p]));
    for (const p of srcProps) {
      const q = outByName.get(index.name(p) ?? '');
      if (q === undefined || index.type(p) !== outIndex.type(q)) continue;
      const a = index.argTokens(p) ?? [];
      const b = outIndex.argTokens(q) ?? [];
      for (const k of [1, 3]) {
        if (a[k] !== undefined && lostSlot(a[k], b[k])) caseAt('constant-slot', p, `${label(p)} (${name}), argument ${k}`);
      }
      const srcJson = jsonOf(index, p);
      const outJson = jsonOf(outIndex, q);
      if (srcJson !== undefined && outJson !== undefined) {
        const have = new Set(keyPaths(outJson));
        const extra = keyPaths(srcJson).find(path => !have.has(path));
        if (extra !== undefined) caseAt('json-sleutel', p, `${label(p)} (${name}.${index.name(p)}): ${extra}`);
      }
    }
  }
}

/** De JSON in de tekstwaarde van een property, of `undefined`. Alleen een object of lijst telt. */
function jsonOf(idx: StepIndex, prop: number): unknown {
  const text = idx.propertyText(prop);
  if (text === undefined) return undefined;
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return undefined;
  try { return JSON.parse(t) as unknown; } catch { return undefined; }
}

/** Alle sleutelpaden in een JSON-waarde; een lijstpositie telt als `[]`. */
function keyPaths(value: unknown, prefix = '', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = `${prefix}.${k}`;
      out.push(path);
      keyPaths(v, path, out);
    }
  }
  return out;
}

/** Het P-blok tussen de bronstukken (§4.10). */
function assemble(source: IfcSource, index: StepIndex, cls: Classification, block: readonly string[]): Uint8Array[] {
  const n = index.count;
  const bytes = source.bytes;
  const starts = source.chunkStarts;
  let insertAt = -1;
  for (let i = 0; i < n; i++) if (cls.classes[i] === 1) { insertAt = i; break; }
  if (insertAt < 0) insertAt = n - 1; // geen P-stuk: vóór de staart
  const parts: Uint8Array[] = [];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart >= 0 && end > runStart) parts.push(bytes.subarray(starts[runStart], starts[end]));
    runStart = -1;
  };
  const enc = new TextEncoder();
  const le = source.lineEnding;
  const BATCH = 2000;
  for (let i = 0; i < n; i++) {
    if (i === insertAt) {
      flush(i);
      for (let b = 0; b < block.length; b += BATCH) parts.push(enc.encode(le + block.slice(b, b + BATCH).join(le)));
    }
    if (cls.classes[i] === 1) { flush(i); continue; }
    if (runStart < 0) runStart = i;
  }
  flush(n);
  return parts;
}
