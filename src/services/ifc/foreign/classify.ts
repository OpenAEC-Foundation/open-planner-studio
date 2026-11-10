/**
 * Indeling van een STEP-bestand in P, C, A en V (#804 fase 0, ontwerp "Gebouwmodel behouden" §4.2).
 *
 * Fase 0 is een haalbaarheidsproef: deze module wordt nog nergens in de app aangeroepen. Alleen de
 * poort `tests/planning/check-ifc-foreign-classify.ts` en de meting gebruiken haar. De Python-voorproef
 * `scripts/proef/classify-v9.py` is de referentie; de poort vergelijkt beide.
 *
 * Vier stappen, een pure functie van de index (`StepIndex`):
 *  1. D: de domeinobjecten die de lezer nu kiest (`selectPlanning`).
 *  2. R: de relaties die passen op een van de zes patronen die de writer schrijft.
 *  3. Own: alles wat vooruit bereikbaar is vanuit D ∪ R, alleen via typen die de writer schrijft (W).
 *     Vanuit een eigen pset of template volgt Own alleen de properties die de lezer leest; een andere
 *     property is een vreemd lid.
 *  4. Ext: alles wat vooruit bereikbaar is vanuit een stuk buiten Own, plus de owner history van een D-
 *     of R-stuk van vreemde herkomst en de doelen van `#`-tokens in constante slots. Ext loopt niet door
 *     D en R heen.
 * Uitkomst: P = D ∪ R ∪ (Own − Ext), C = (Own ∩ Ext) − D − R, A = buiten Own met een verwijzing naar een
 * P-stuk, V = de rest.
 */
import type { StepIndex } from './stepScanner';
import { OWN_PSET_PROPERTY_NAMES, OWN_TEMPLATE_NAMES, PER_TASK_PSETS, PSET, isXerArchiveChunkName } from '../ifcPsets';
import { IFC_TO_RESOURCE_TYPE } from '../ifcConstants';
import { workControlSlots } from '../ifcWorkControlSlots';
import { ifcDateTime, WRITER_ENTITY_TYPES } from '../ifcWriter';

export type ChunkClass = 'P' | 'C' | 'A' | 'V';
const CLASS_NAMES: readonly (ChunkClass | undefined)[] = [undefined, 'P', 'C', 'A', 'V'];
const P = 1;
const C = 2;
const A = 3;
const V = 4;

/** Wat de lezer tot domeingegevens maakt (stap 1). Alle waarden zijn stukindexen in bronvolgorde. */
export interface PlanningSelection {
  /** Het werkplan dat de lezer kiest: het eerste `IfcWorkPlan` in het bestand, of -1. */
  readonly workPlan: number;
  /** Alle werkschema's die geen baseline zijn. */
  readonly liveSchedules: readonly number[];
  /** De eigen baselinekoppen (`BASELINE`-schema's die bij een item in `OPS_Baselines` horen). */
  readonly ownBaselines: readonly number[];
  /** De taken die de lezer leest (alles buiten de baselinebomen, `collectBaselineTaskStepIds`). */
  readonly tasks: readonly number[];
  readonly resources: readonly number[];
  readonly calendars: readonly number[];
  /** `IfcRelSequence` tussen twee taken in D. */
  readonly sequences: readonly number[];
  /** D als vlag per stuk (1 = in D). */
  readonly inD: Uint8Array;
}

export interface Classification {
  readonly selection: PlanningSelection;
  /** Klasse per stuk: 0 = geen entiteit (kop, `DATA;`, staart), 1 = P, 2 = C, 3 = A, 4 = V. */
  readonly classes: Uint8Array;
  readonly inR: Uint8Array;
  readonly inOwn: Uint8Array;
  readonly inExt: Uint8Array;
  /** Aantallen over de entiteiten. */
  readonly counts: Readonly<Record<ChunkClass, number>>;
  /** Properties in een eigen pset (of property-templates in een eigen template) die de lezer niet leest. */
  readonly foreignMembers: readonly number[];
  /** D- en R-stukken waarvan de owner history niet naar de applicatie `'OPS'` wijst (§4.5). */
  readonly foreignOrigin: readonly number[];
}

export function classOf(c: Classification, i: number): ChunkClass | undefined {
  return CLASS_NAMES[c.classes[i]];
}

/**
 * Herkenner voor de sleutels van `OPS_Assignments` (ontwerp #804 v19 §4.2): elke sleutel in GlobalId-vorm is eigen,
 * kaal of met `#n`, ook als het er meer zijn dan toewijzingen. Een andere naam (`VendorSecretNote`) is een vreemd lid.
 * Kale sleutels schreef alleen main tussen e1ac01947 en 87ebd4d46 (3 juli 2026); het ontwerp zegt "tot en met
 * v2026.7.3", maar geen release-tag schreef ze (zie het evidence-document van fase 0).
 */
export function isOwnAssignmentKey(name: string): boolean {
  return /^[0-9A-Za-z_$]{22}(#\d+)?$/.test(name);
}

/** De chunksleutels van het XER-bronarchief (`ByteChunk000000`, `DiagnosticsChunk000000`). */
function isXerArchiveChunkKey(name: string): boolean {
  return isXerArchiveChunkName(name);
}

/** Het register: per eigen pset de vaste property-namen (descriptors plus `OWN_PSET_PROPERTY_NAMES`). */
const FIXED_PROPERTIES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ...PER_TASK_PSETS.map((d): [string, ReadonlySet<string>] => [d.name, new Set(d.readProps)]),
  ...Object.entries(OWN_PSET_PROPERTY_NAMES).map(([k, v]): [string, ReadonlySet<string>] => [k, new Set(v)]),
]);
/** De namen van alle eigen psets. */
export const REGISTER_PSET_NAMES: ReadonlySet<string> = new Set(FIXED_PROPERTIES.keys());
const TEMPLATE_NAMES: ReadonlySet<string> = new Set(OWN_TEMPLATE_NAMES);
const RESOURCE_TYPES: ReadonlySet<string> = new Set(Object.keys(IFC_TO_RESOURCE_TYPE));

/** Alle doelstukken op argumentpositie `arg`, ook verwijzingen naar een `#id` dat niet bestaat (-1). */
/** Zet alle elementen van `src` achter `dst`. Geen `dst.push(...src)`: dat loopt bij een brede relatie (130.000 leden en
 *  meer) vast op de grens van de call stack (`RangeError`; review van #863, Sol en Terra). */
function pushAll(dst: number[], src: readonly number[]): void {
  for (let k = 0; k < src.length; k++) dst.push(src[k]);
}

function targetsAt(index: StepIndex, i: number, arg: number): number[] {
  const out: number[] = [];
  for (let k = index.outStart(i); k < index.outEnd(i); k++) if (index.outArg(k) === arg) out.push(index.outTarget(k));
  return out;
}

/** Eigen herkomst (§4.5): de owner history (argument 1) wijst met `OwningApplication` naar de applicatie `'OPS'`. */
/** Wijst de owner history van stuk `i` naar de applicatie `'OPS'`? (Ook voor `mergeWriter.ts`.) */
export function hasOwnOrigin(index: StepIndex, i: number): boolean {
  const oh = index.refAt(i, 1);
  if (oh < 0 || index.type(oh) !== 'IFCOWNERHISTORY') return false;
  const app = index.refAt(oh, 1);
  return app >= 0 && index.application(app)?.identifier === 'OPS';
}

/** Is dit werkschema een baseline? Op het slot `PredefinedType` (`workControlSlots`), zoals de lezer. */
function isBaselineSchedule(index: StepIndex, i: number): boolean {
  const wc = index.workControl(i);
  if (!wc) return false;
  return (wc.slotTokens[workControlSlots(wc.slotTokens).predefinedType] ?? '').includes('BASELINE');
}

/**
 * Stap 1: de domeinobjecten D, met letterlijk de regels van de huidige lezer (`readIFC`):
 *  - het eerste `IfcWorkPlan` (`extractProject`);
 *  - alle taken buiten de baselinebomen; die bomen tellen alleen als er een live-schema met minstens één
 *    taak is (`collectBaselineTaskStepIds`);
 *  - alle resources (`IFC_TO_RESOURCE_TYPE`) en alle `IfcWorkCalendar`'s;
 *  - elke `IfcRelSequence` tussen twee taken in D;
 *  - het eerste live-schema (zoals `readIFC`), andere live-schema's alleen bij eigen herkomst, en de eigen
 *    baselinekoppen (§4.2, spec v20).
 *
 * Plus de ene uitzondering uit §4.2 (Opus, ronde 8): een live-schema van **eigen herkomst** sluit de baselinebomen
 * altijd uit, ook zonder taken. Anders werd een Bonsai-baselineboom D nadat de planner alle taken wiste, en verdween
 * hij bij het volgende opslaan. Die regel zit nog niet in `readIFC`: op zo'n bestand kiest `selectPlanning` andere
 * taken dan de lezer van nu. Fase 1 moet de lezer dezelfde regel geven (de poort toont het verschil op
 * `fix1-leeg-live.ifc` uit het corpus).
 */
export function selectPlanning(index: StepIndex): PlanningSelection {
  const n = index.count;
  const inD = new Uint8Array(n);
  let workPlan = -1;
  const schedules: number[] = [];
  const baseline = new Uint8Array(n);
  const live = new Uint8Array(n);
  const allTasks: number[] = [];
  const resources: number[] = [];
  const calendars: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i)) continue;
    const t = index.type(i);
    if (t === 'IFCWORKSCHEDULE') {
      schedules.push(i);
      if (isBaselineSchedule(index, i)) baseline[i] = 1; else live[i] = 1;
    } else if (t === 'IFCWORKPLAN') {
      if (workPlan < 0) workPlan = i;
    } else if (t === 'IFCTASK') allTasks.push(i);
    else if (t === 'IFCWORKCALENDAR') calendars.push(i);
    else if (RESOURCE_TYPES.has(t)) resources.push(i);
  }

  // Baselinebomen (spiegel van `collectBaselineTaskStepIds`).
  const excluded = new Uint8Array(n);
  const hasBaseline = schedules.some(s => baseline[s]);
  const hasLive = schedules.some(s => live[s]);
  if (hasBaseline && hasLive) {
    const baselineRoots: number[] = [];
    const liveRoots: number[] = [];
    const nestedUnder = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      if (!index.isEntity(i)) continue;
      const t = index.type(i);
      if (t === 'IFCRELNESTS') {
        const relating = index.refAt(i, 4);
        if (relating < 0) continue;
        const related = index.refsAt(i, 5);
        if (baseline[relating]) pushAll(baselineRoots, related);
        else if (live[relating]) pushAll(liveRoots, related);
        else {
          let kids = nestedUnder.get(relating);
          if (!kids) nestedUnder.set(relating, kids = []);
          pushAll(kids, related);
        }
      } else if (t === 'IFCRELASSIGNSTOCONTROL') {
        const control = index.refAt(i, 6);
        if (control < 0) continue;
        const related = index.refsAt(i, 4);
        if (baseline[control]) pushAll(baselineRoots, related);
        else if (live[control]) pushAll(liveRoots, related);
      }
    }
    const tree = (roots: number[]): Set<number> => {
      const seen = new Set<number>();
      const todo = [...roots];
      while (todo.length > 0) {
        const id = todo.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        pushAll(todo, nestedUnder.get(id) ?? []);
      }
      return seen;
    };
    const liveTree = tree(liveRoots);
    const ownLive = schedules.some(sc => live[sc] && hasOwnOrigin(index, sc));
    if (liveTree.size > 0 || ownLive) for (const id of tree(baselineRoots)) if (!liveTree.has(id)) excluded[id] = 1;
  }
  const tasks = allTasks.filter(i => !excluded[i]);
  for (const i of tasks) inD[i] = 1;

  // Eigen baselinekoppen: onder het D-werkplan geaggregeerd, Name en CreationDate gelijk aan een item in
  // `OPS_Baselines`, en geen taken eronder. `OPS_Baselines` zoals `extractBaselines`: de laatste geldige lijst.
  const aggregated = new Uint8Array(n);
  let baselineItems: { name: string; createdAt: string }[] = [];
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i)) continue;
    const t = index.type(i);
    if (t === 'IFCRELAGGREGATES' && workPlan >= 0 && index.refAt(i, 4) === workPlan) {
      for (const s of index.refsAt(i, 5)) if (index.type(s) === 'IFCWORKSCHEDULE') aggregated[s] = 1;
    } else if (t === 'IFCPROPERTYSET' && index.name(i) === PSET.Baselines) {
      for (const prop of index.refsAt(i, 4)) {
        if (index.type(prop) !== 'IFCPROPERTYSINGLEVALUE' || index.name(prop) !== 'Baselines') continue;
        const raw = index.propertyText(prop);
        if (raw === undefined) continue;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            baselineItems = parsed.map((b: unknown) => {
              const o = (b && typeof b === 'object' ? b : {}) as { name?: unknown; createdAt?: unknown };
              return { name: typeof o.name === 'string' ? o.name : '', createdAt: typeof o.createdAt === 'string' ? o.createdAt : '' };
            });
          }
        } catch { /* corrupte JSON: de lezer negeert hem ook */ }
      }
    }
  }
  const hasTasksUnder = (s: number): boolean => {
    for (let k = index.inStart(s); k < index.inEnd(s); k++) {
      const rel = index.inSource(k);
      const t = index.type(rel);
      const arg = index.inArg(k);
      const relatedArg = t === 'IFCRELASSIGNSTOCONTROL' && arg === 6 ? 4 : t === 'IFCRELNESTS' && arg === 4 ? 5 : -1;
      if (relatedArg >= 0 && index.refsAt(rel, relatedArg).some(x => index.type(x) === 'IFCTASK')) return true;
    }
    return false;
  };
  const ownBaselines = schedules.filter(s => {
    if (!baseline[s] || !aggregated[s] || hasTasksUnder(s)) return false;
    const wc = index.workControl(s)!;
    return baselineItems.some(b => b.name === wc.name
      && (!b.createdAt || wc.creationDate === ifcDateTime(b.createdAt).replace(/^'|'$/g, '')));
  });
  const liveSchedules = schedules.filter(s => live[s]);

  if (workPlan >= 0) inD[workPlan] = 1;
  // Het eerste live-schema in de volgorde van het bestand is D, zoals `readIFC` het kiest (`ifcReader.ts:445`; spec v20,
  // §4.2 stap 1; besluit wrakko, 9 november 2026). Een ander live-schema is alleen D bij eigen herkomst (de oude writer
  // schreef er soms meer); een ander live-schema van vreemde herkomst blijft vreemd, met zijn relaties als A (§4.6).
  for (const s of liveSchedules) if (s === liveSchedules[0] || hasOwnOrigin(index, s)) inD[s] = 1;
  for (const s of ownBaselines) inD[s] = 1;
  for (const r of resources) inD[r] = 1;
  for (const c of calendars) inD[c] = 1;
  const sequences: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || index.type(i) !== 'IFCRELSEQUENCE') continue;
    const pred = index.refAt(i, 4);
    const succ = index.refAt(i, 5);
    if (pred >= 0 && succ >= 0 && inD[pred] && inD[succ]
      && index.type(pred) === 'IFCTASK' && index.type(succ) === 'IFCTASK') sequences.push(i);
  }
  for (const s of sequences) inD[s] = 1;
  return { workPlan, liveSchedules, ownBaselines, tasks, resources, calendars, sequences, inD };
}

/** Namen van de codetypen en velden uit `OPS_StructureMeta`, met terugval op de templates (`extractStructure`). */
function structureNames(index: StepIndex): { codes: Map<string, Set<string>>; fields: Set<string> } {
  let codeTypes: { name: string; codes: string[] }[] = [];
  let fieldNames: string[] = [];
  let sawCodes = false;
  let sawFields = false;
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || index.type(i) !== 'IFCPROPERTYSET' || index.name(i) !== PSET.StructureMeta) continue;
    for (const prop of index.refsAt(i, 4)) {
      if (index.type(prop) !== 'IFCPROPERTYSINGLEVALUE') continue;
      const raw = index.propertyText(prop);
      if (raw === undefined) continue;
      try {
        const meta = JSON.parse(raw) as { activityCodeTypes?: unknown; customFieldDefs?: unknown };
        if (Array.isArray(meta.activityCodeTypes)) {
          sawCodes = meta.activityCodeTypes.length > 0;
          codeTypes = meta.activityCodeTypes.map((t: unknown) => {
            const o = (t && typeof t === 'object' ? t : {}) as { name?: unknown; values?: unknown };
            const values = Array.isArray(o.values) ? o.values : [];
            return {
              name: typeof o.name === 'string' ? o.name : '',
              codes: values.map((v: unknown) => (v && typeof v === 'object' ? (v as { code?: unknown }).code : undefined))
                .filter((c): c is string => typeof c === 'string'),
            };
          });
        }
        if (Array.isArray(meta.customFieldDefs)) {
          sawFields = meta.customFieldDefs.length > 0;
          fieldNames = meta.customFieldDefs
            .map((d: unknown) => (d && typeof d === 'object' ? (d as { name?: unknown }).name : undefined))
            .filter((x): x is string => typeof x === 'string');
        }
      } catch { /* corrupte meta: terugval op de templates, zoals de lezer */ }
    }
  }
  if (!sawCodes && !sawFields) {
    codeTypes = [];
    fieldNames = [];
    for (let i = 0; i < index.count; i++) {
      if (!index.isEntity(i) || index.type(i) !== 'IFCPROPERTYSETTEMPLATE') continue;
      const setName = index.name(i);
      for (const tmpl of index.refsAt(i, 6)) {
        if (index.type(tmpl) !== 'IFCSIMPLEPROPERTYTEMPLATE') continue;
        const name = index.name(tmpl) ?? '';
        const templateType = index.templateType(tmpl);
        if (setName === PSET.CustomFields && templateType === 'P_SINGLEVALUE') fieldNames.push(name);
        else if (setName === PSET.ActivityCodes && templateType === 'P_ENUMERATEDVALUE') {
          const en = index.refAt(tmpl, 7);
          const codes = en >= 0 && index.type(en) === 'IFCPROPERTYENUMERATION' ? index.enumValues(en) ?? [] : [];
          codeTypes.push({ name, codes });
        }
      }
    }
  }
  // `new Map(...)` per naam: de laatste wint, zoals `typeByName` in de lezer.
  return { codes: new Map(codeTypes.map(t => [t.name, new Set(t.codes)])), fields: new Set(fieldNames) };
}

/** Stap 1 tot en met 4. */
export function classify(index: StepIndex, selection: PlanningSelection = selectPlanning(index)): Classification {
  const n = index.count;
  const { inD, workPlan } = selection;
  const isType = (i: number, t: string) => i >= 0 && index.type(i) === t;
  const dTask = (i: number) => i >= 0 && inD[i] === 1 && index.type(i) === 'IFCTASK';
  const dResource = (i: number) => i >= 0 && inD[i] === 1 && RESOURCE_TYPES.has(index.type(i));
  const dSchedule = (i: number) => i >= 0 && inD[i] === 1 && index.type(i) === 'IFCWORKSCHEDULE';
  const structure = structureNames(index);

  // ── Stap 2: R ──
  const inR = new Uint8Array(n);
  const fitsPattern = (i: number): boolean => {
    switch (index.type(i)) {
      case 'IFCRELNESTS': {
        const relating = index.refAt(i, 4);
        return relating >= 0 && inD[relating] === 1 && targetsAt(index, i, 5).every(x => x >= 0 && inD[x] === 1);
      }
      case 'IFCRELASSIGNSTOCONTROL': {
        const control = index.refAt(i, 6);
        const related = targetsAt(index, i, 4);
        if (dSchedule(control)) return related.every(dTask);
        if (control >= 0 && inD[control] === 1 && isType(control, 'IFCWORKCALENDAR')) {
          return related.every(x => dTask(x) || dResource(x));
        }
        return false;
      }
      case 'IFCRELASSIGNSTOPROCESS':
        return dTask(index.refAt(i, 6)) && targetsAt(index, i, 4).every(dResource);
      case 'IFCRELAGGREGATES':
        return workPlan >= 0 && index.refAt(i, 4) === workPlan && targetsAt(index, i, 5).every(dSchedule);
      case 'IFCRELDECLARES':
        return isType(index.refAt(i, 4), 'IFCPROJECT') && targetsAt(index, i, 5)
          .every(x => isType(x, 'IFCPROPERTYSETTEMPLATE') && TEMPLATE_NAMES.has(index.name(x) ?? ''));
      case 'IFCRELDEFINESBYPROPERTIES': {
        if (!targetsAt(index, i, 4).every(x => x >= 0 && (inD[x] === 1 || index.type(x) === 'IFCPROJECT'))) return false;
        const pset = index.refAt(i, 5);
        return isType(pset, 'IFCPROPERTYSET') && REGISTER_PSET_NAMES.has(index.name(pset) ?? '');
      }
      default:
        return false;
    }
  };
  for (let i = 0; i < n; i++) {
    if (index.isEntity(i) && index.type(i).startsWith('IFCREL') && !inD[i] && fitsPattern(i)) inR[i] = 1;
  }

  // ── Stap 3: Own ──
  const ownProperty = (psetName: string, prop: number): boolean => {
    const t = index.type(prop);
    const name = index.name(prop) ?? '';
    if (psetName === PSET.Assignments) return t === 'IFCPROPERTYSINGLEVALUE' && isOwnAssignmentKey(name);
    if (psetName === PSET.ActivityCodes) {
      const codes = structure.codes.get(name);
      return t === 'IFCPROPERTYENUMERATEDVALUE' && codes !== undefined && codes.has((index.enumValues(prop) ?? [])[0] ?? '\u0000');
    }
    if (psetName === PSET.CustomFields) return t === 'IFCPROPERTYSINGLEVALUE' && structure.fields.has(name);
    if (t !== 'IFCPROPERTYSINGLEVALUE') return false;
    if (psetName === PSET.XerSourceArchive && isXerArchiveChunkKey(name)) return true;
    return FIXED_PROPERTIES.get(psetName)?.has(name) ?? false;
  };
  const ownTemplateProperty = (templateName: string, tmpl: number): boolean => {
    if (index.type(tmpl) !== 'IFCSIMPLEPROPERTYTEMPLATE') return false;
    const name = index.name(tmpl) ?? '';
    return templateName === PSET.CustomFields ? structure.fields.has(name) : structure.codes.has(name);
  };
  const inOwn = new Uint8Array(n);
  const memberFlag = new Uint8Array(n);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) if (inD[i] || inR[i]) stack.push(i);
  while (stack.length > 0) {
    const x = stack.pop()!;
    if (x < 0 || inOwn[x]) continue;
    if (!inD[x] && !inR[x] && !WRITER_ENTITY_TYPES.has(index.type(x))) continue;
    inOwn[x] = 1;
    const t = index.type(x);
    const setName = t === 'IFCPROPERTYSET' || t === 'IFCPROPERTYSETTEMPLATE' ? index.name(x) ?? '' : '';
    const memberArg = t === 'IFCPROPERTYSET' && REGISTER_PSET_NAMES.has(setName) ? 4
      : t === 'IFCPROPERTYSETTEMPLATE' && TEMPLATE_NAMES.has(setName) ? 6 : -1;
    for (let k = index.outStart(x); k < index.outEnd(x); k++) {
      const target = index.outTarget(k);
      if (target < 0) continue;
      if (memberArg >= 0 && index.outArg(k) === memberArg) {
        const own = memberArg === 4 ? ownProperty(setName, target) : ownTemplateProperty(setName, target);
        if (!own) { memberFlag[target] = 1; continue; }
      }
      stack.push(target);
    }
  }

  // ── Stap 4: Ext ──
  const foreignOrigin: number[] = [];
  const extStarts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!inD[i] && !inR[i]) continue;
    if (!hasOwnOrigin(index, i)) {
      foreignOrigin.push(i);
      const oh = index.refAt(i, 1);
      if (oh >= 0) extStarts.push(oh);
    }
    // Constante slots met een `#`-token (§4.5): het brontoken blijft staan, dus zijn doel is context.
    // Resources (11 argumenten): Usage 7, BaseCosts 8, BaseQuantity 9. `IfcRelAssignsToProcess`: QuantityInProcess 7.
    // Werkplan en werkschema: Creators 7 (spec v20; de writer schrijft daar `$`, `ifcWriter.ts:208`).
    if (inD[i] && RESOURCE_TYPES.has(index.type(i)) && index.argCount(i) === 11) {
      for (const arg of [7, 8, 9]) pushAll(extStarts, index.refsAt(i, arg));
    } else if (inD[i] && (index.type(i) === 'IFCWORKPLAN' || index.type(i) === 'IFCWORKSCHEDULE')) {
      pushAll(extStarts, index.refsAt(i, 7));
    } else if (inR[i] && index.type(i) === 'IFCRELASSIGNSTOPROCESS') {
      pushAll(extStarts, index.refsAt(i, 7));
    }
  }
  // Het project dat de writer niet samen met de planning schreef (§4.4; fixronde 1 van #867, BLOKKEERT 2). De writer
  // schrijft één owner history en hangt die aan alles wat hij schrijft, ook aan het project en het werkplan. Is het
  // `IfcProject` van de bron niet P, dan schrijft de merge-writer geen eigen project: het project houdt de owner history
  // van de bron, het werkplan krijgt de nieuwe. Een project met een andere owner history dan het D-werkplan is dus context
  // (C), met wat het bereikt (eenheden, context, owner history). Anders werd een oud los project (v2026.7.2) na het eerste
  // opslaan P, en schreef de writer bij het tweede opslaan een eigen project, zonder wat de bron daar had (een extra
  // eenheid, millimeter). Een eigen bestand heeft altijd één owner history voor project en werkplan, dus daar blijft het
  // project P.
  const planOwner = workPlan >= 0 ? index.refAt(workPlan, 1) : -1;
  if (planOwner >= 0) {
    for (let i = 0; i < n; i++) {
      if (index.isEntity(i) && index.type(i) === 'IFCPROJECT' && index.refAt(i, 1) !== planOwner) extStarts.push(i);
    }
  }
  const inExt = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const walk = (start: number) => {
    stack.length = 0;
    stack.push(start);
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (x < 0 || seen[x]) continue;
      seen[x] = 1;
      if (inOwn[x]) inExt[x] = 1;
      if (inD[x] || inR[x]) continue; // Ext loopt niet door D ∪ R heen: die houden hun #id.
      for (let k = index.outStart(x); k < index.outEnd(x); k++) stack.push(index.outTarget(k));
    }
  };
  for (let i = 0; i < n; i++) if (index.isEntity(i) && !inOwn[i]) walk(i);
  for (const s of extStarts) walk(s);

  // ── Uitkomst ──
  const classes = new Uint8Array(n);
  const counts: Record<ChunkClass, number> = { P: 0, C: 0, A: 0, V: 0 };
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i)) continue;
    if (inD[i] || inR[i] || (inOwn[i] && !inExt[i])) classes[i] = P;
    else if (inOwn[i]) classes[i] = C;
  }
  for (let i = 0; i < n; i++) {
    if (!index.isEntity(i) || classes[i]) continue;
    let refersToP = false;
    for (let k = index.outStart(i); k < index.outEnd(i) && !refersToP; k++) {
      const t = index.outTarget(k);
      refersToP = t >= 0 && classes[t] === P;
    }
    classes[i] = refersToP ? A : V;
  }
  for (let i = 0; i < n; i++) {
    const c = CLASS_NAMES[classes[i]];
    if (c) counts[c]++;
  }
  // Een vreemd lid dat via een ander eigen pad toch Own is, telt niet (het is dan P of C).
  const foreignMembers: number[] = [];
  for (let i = 0; i < n; i++) if (memberFlag[i] && !inOwn[i]) foreignMembers.push(i);
  return { selection, classes, inR, inOwn, inExt, counts, foreignMembers, foreignOrigin };
}
