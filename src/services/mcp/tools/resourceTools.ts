// MCP-toolmodule — RESOURCEBEHEER (aanmaken / wijzigen / verwijderen).
//
// Naast lezen (`planner_list_resources`, `planner_get_resource_histogram`), toewijzen
// (`planner_manage_assignments`) en nivelleren (`planner_level_resources`) is dit de enige route om
// een resource aan te maken, te hernoemen, te verwijderen of zijn capaciteit/tarief/kalender/
// beschikbaarheid te wijzigen ("zet er een tweede kraan bij").
//
// ONTWERPKEUZE — ÉÉN BULK-TOOL MET ACTIES, niet drie losse tools:
//   * hij spiegelt `planner_manage_assignments`, de zustertool voor exact hetzelfde domein — een AI
//     die de één kent, kent de ander;
//   * create/update/delete delen bijna hun volledige parameterverzameling; drie losse tools zouden
//     drie bijna identieke beschrijvingen aan de tool-keuze toevoegen (slechtere tool-selectie);
//   * "vervang de grote kraan door twee kleine" is dan één call = ÉÉN ongedaan-maak-stap.
//
// SCHRIJFKANT SPREEKT DE LEESKANT (harde eis van dit oppervlak): elk veld heet hier exact zoals
// `planner_list_resources` het teruggeeft — `name`, `type`, `maxUnits`, `costPerHour`,
// `unitOfMeasure`, `calendarId`, `description`, `parentId`, `availabilitySteps`; zie de noot in
// `readTools.ts` bij `listResources`.
//
// Conventies (zie de kop van `taskTools.ts` en `calendarResourceTools.ts`):
//   1. driedeling `parseX` (vormvalidatie) / `xCore` (synchrone, transactie-vrije kern ⇒
//      `MutationOutcome`) / `handler` (guards + backup + transactie), zodat de tool zowel los als
//      als batch-stap draait met exact één implementatie van de mutatie;
//   2. ZACHTE per-item-weigeringen (`itemRejections`) — één rot item rolt de bulk nooit terug;
//   3. LEGE-BATCH-SNELPAD — statisch nul uitvoerbare items betreedt géén transactie (geen spurious
//      undo-snapshot, geen redo-wipe door een AI-no-op);
//   4. `enrichOk` — de respons-`data` wordt ná de transactie uit de VERSE store opgebouwd;
//   5. nooit `ok` zonder effect: een update zonder velden, een onbekend id en een onbekende sleutel
//      worden geweigerd met een boodschap die de sleutel én het alternatief noemt.
import type { McpContext, McpToolOk } from '../contracts';
import {
  runMutateTool,
  toolError,
  McpStepError,
  type MutationOutcome,
} from './runtime';
// Alleen als TYPE: wordt weggestreept bij compileren, dus géén runtime-import naar batchTool.
import type { BatchStepTool } from './batchTool';
import {
  booleanArgReason, enrichOk, okDirectGuarded, parsedBatchStep, projectEndInfo, TEMP_ID_PATTERN, WRITE_ANNOTATIONS,
} from './helpers';
import type { AppState } from '@/state/appStore';
import type { AvailabilityStep, Resource, ResourceType } from '@/types/resource';
// Bibliotheek-gating: EXACT dezelfde bronnen als het slot in `ResourcePanel`, zodat "wat de UI op
// slot zet" en "wat deze tool weigert" nooit uiteen kunnen lopen (zie de noot bij `libraryLockReason`).
import { RESOURCE_DIFF_FIELDS, isResourceFieldLocked } from '@/services/library/libraryOps';
import { isFiniteNumber } from '@/utils/guards';
import { hasLevelingOutput } from '@/utils/taskDefaults';

type Rejection = { id: string; reason: string };
type StoreState = AppState;

/** Het volledige `ResourceType`-domein (types/resource.ts). Hoofdlettergevoelig, net als elders. */
const RESOURCE_TYPES: ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'];

/**
 * De SCHRIJFBARE velden. Bewust exact het oppervlak dat de mens in het resourcepaneel heeft
 * (`ResourcePanel.tsx`: naam, type, max. eenheden, kalender, uurtarief, meeteenheid, ploeg,
 * beschikbaarheidsstappen) plus `description` — dat veld zit in het `Resource`-type, round-trippt
 * door IFC (`IFCxxxRESOURCE` argument 4) en is aan de leeskant zichtbaar, maar heeft in het paneel
 * geen kolom. Het toevoegen kost niets en maakt de bridge niet gevaarlijker.
 *
 * NIET schrijfbaar: `id` (de store genereert hem) en `availability` (deprecated, vervangen door
 * `maxUnits`; alleen nog gelezen bij migratie van oude bestanden).
 */
const RESOURCE_FIELD_KEYS = [
  'name', 'type', 'description', 'maxUnits', 'costPerHour', 'unitOfMeasure',
  'calendarId', 'parentId', 'availabilitySteps',
] as const;
type ResourceFieldKey = (typeof RESOURCE_FIELD_KEYS)[number];

/** Toegestane sleutels per actie (structuur + velden). Alles daarbuiten is een zachte weigering. */
const ALLOWED_KEYS: Record<string, string[]> = {
  create: ['action', 'tempId', ...RESOURCE_FIELD_KEYS],
  update: ['action', 'id', ...RESOURCE_FIELD_KEYS],
  delete: ['action', 'id', 'cascade'],
};

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Een geparste veldpatch. Een sleutel MET waarde `undefined` betekent WISSEN (de aanroeper gaf
 * `null`); een afwezige sleutel betekent "niet aanraken". `draft.updateResource` vertaalt de eerste
 * naar een echte `delete` op het object.
 */
type FieldPatch = Partial<Record<ResourceFieldKey, unknown>>;

interface CreateAction { action: 'create'; tempId?: string; [k: string]: unknown }
interface UpdateAction { action: 'update'; id: string; [k: string]: unknown }
interface DeleteAction { action: 'delete'; id: string; cascade?: boolean }
type ResourceAction = CreateAction | UpdateAction | DeleteAction;

// =================================================================================================
// Vormvalidatie van één item
// =================================================================================================

/** Onbekende sleutels ⇒ leesbare reden die de sleutel ÉN het toegestane alternatief noemt. */
function unknownKeyReason(item: Record<string, unknown>, action: string): string | null {
  const allowed = ALLOWED_KEYS[action];
  const bad = Object.keys(item).filter((k) => !allowed.includes(k));
  if (bad.length === 0) return null;
  return `unknown key(s) ${bad.map((k) => `\`${k}\``).join(', ')} for action '${action}'; allowed are: ` +
    `${allowed.join(', ')}`;
}

/** Vormvalidatie van de `availabilitySteps`-lijst; string = reden, anders de genormaliseerde lijst. */
function parseAvailabilitySteps(raw: unknown): AvailabilityStep[] | string {
  if (!Array.isArray(raw)) return '`availabilitySteps` must be an array (or `null` to clear them)';
  const seen = new Set<string>();
  const out: AvailabilityStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'every item in `availabilitySteps` must be an object';
    const step = s as Record<string, unknown>;
    for (const k of Object.keys(step)) {
      if (k !== 'from' && k !== 'maxUnits') {
        return `unknown key \`${k}\` in \`availabilitySteps\`; allowed are: from, maxUnits`;
      }
    }
    if (typeof step.from !== 'string' || !ISO_DATE_ONLY.test(step.from)) {
      return `\`availabilitySteps.from\` must be an ISO date (YYYY-MM-DD), got '${String(step.from)}'`;
    }
    if (!isFiniteNumber(step.maxUnits) || step.maxUnits <= 0) {
      return `\`availabilitySteps.maxUnits\` must be a number > 0 (units per working day), got '${String(step.maxUnits)}'`;
    }
    if (seen.has(step.from)) return `\`availabilitySteps\` contains two steps with the same date '${step.from}'`;
    seen.add(step.from);
    out.push({ from: step.from, maxUnits: step.maxUnits });
  }
  // Chronologisch: de engine leest "de laatste stap ≤ peildatum" (types/resource.ts).
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Vormvalidatie van de VELDEN van één create/update-item (nog zonder verwijzings-checks — die
 * hebben de gesimuleerde verzameling nodig en staan in `classifyResources`). String = reden.
 */
function parseFields(item: Record<string, unknown>): FieldPatch | string {
  const patch: FieldPatch = {};

  if (item.name !== undefined) {
    if (typeof item.name !== 'string' || item.name.trim() === '') return '`name` must be a non-empty string';
    patch.name = item.name;
  }
  if (item.type !== undefined) {
    if (!(RESOURCE_TYPES as string[]).includes(item.type as string)) {
      return `unknown \`type\` '${String(item.type)}'; valid values are ${RESOURCE_TYPES.join(', ')} (case-sensitive)`;
    }
    patch.type = item.type;
  }
  if (item.description !== undefined) {
    if (typeof item.description !== 'string') return '`description` must be a string (use "" to empty it)';
    patch.description = item.description;
  }
  if (item.maxUnits !== undefined) {
    if (!isFiniteNumber(item.maxUnits) || item.maxUnits <= 0) {
      return `\`maxUnits\` must be a number > 0 (capacity per WORKING DAY; 1 = 100% = one person/piece), got '${String(item.maxUnits)}'`;
    }
    patch.maxUnits = item.maxUnits;
  }
  if (item.costPerHour !== undefined) {
    if (item.costPerHour === null) patch.costPerHour = undefined;
    else if (!isFiniteNumber(item.costPerHour) || item.costPerHour < 0) {
      return `\`costPerHour\` must be a number ≥ 0 (cost per HOUR) or \`null\` to clear it, got '${String(item.costPerHour)}'`;
    } else patch.costPerHour = item.costPerHour;
  }
  if (item.unitOfMeasure !== undefined) {
    if (item.unitOfMeasure === null) patch.unitOfMeasure = undefined;
    else if (typeof item.unitOfMeasure !== 'string' || item.unitOfMeasure.trim() === '') {
      return '`unitOfMeasure` must be a non-empty string (e.g. "m3", "ton") or `null` to clear it';
    } else patch.unitOfMeasure = item.unitOfMeasure;
  }
  if (item.calendarId !== undefined) {
    if (item.calendarId === null) patch.calendarId = undefined;
    else if (typeof item.calendarId !== 'string' || item.calendarId === '') {
      return '`calendarId` must be an existing calendar id or `null` (= the project calendar)';
    } else patch.calendarId = item.calendarId;
  }
  if (item.parentId !== undefined) {
    if (item.parentId === null) patch.parentId = undefined;
    else if (typeof item.parentId !== 'string' || item.parentId === '') {
      return '`parentId` must be the id of a CREW resource or `null` (= no crew)';
    } else patch.parentId = item.parentId;
  }
  if (item.availabilitySteps !== undefined) {
    if (item.availabilitySteps === null) patch.availabilitySteps = undefined;
    else {
      const steps = parseAvailabilitySteps(item.availabilitySteps);
      if (typeof steps === 'string') return steps;
      // Een LEGE lijst wist de stappen (vlakke `maxUnits` geldt dan weer altijd) — dat is een echt
      // effect, geen no-op, en dus toegestaan.
      patch.availabilitySteps = steps.length > 0 ? steps : undefined;
    }
  }
  return patch;
}

// =================================================================================================
// Classificatie (gedeeld door het lege-batch-snelpad en de transactie-kern)
// =================================================================================================

/** Gesimuleerde resource tijdens de pre-validatie (alleen wat de guards lezen). */
interface SimResource { id: string; type: ResourceType; parentId?: string }

type ResourcePlan =
  | { mode: 'create'; index: number; tempId?: string; fields: FieldPatch }
  | { mode: 'update'; index: number; id: string; fields: FieldPatch }
  | { mode: 'delete'; index: number; id: string };

/**
 * Statische classificatie van een resource-batch. Draait tegen een MEEGROEIENDE simulatie, zodat
 * verwijzingen binnen dezelfde call kloppen: een `create` met `tempId` mag door een latere actie als
 * `parentId` worden gebruikt, en een `delete` haalt de resource uit de simulatie zodat een daarna
 * volgende verwijzing ernaar correct wordt geweigerd.
 */
/**
 * BIBLIOTHEEK-GATING. Een resource die uit een resourcebibliotheek komt draagt een
 * herkomststempel; de bibliotheek bepaalt dan WAT die resource is (naam/type/omschrijving/tarief/
 * eenheid — `RESOURCE_DIFF_FIELDS`) en het project bepaalt hoeveel en wanneer (`maxUnits`,
 * `availabilitySteps`, `calendarId`). Het resourcepaneel rendert die eerste groep daarom als platte
 * tekst: een mens KAN ze op zo'n rij niet wijzigen.
 *
 * Deze tool spiegelt dat slot: anders schrijft de bridge velden die de gebruiker zelf niet kan
 * schrijven, en volgt er bij de eerstvolgende verversgrens een afwijkingsvraag die de bewerking
 * stilzwijgend kan terugdraaien. Een weigering die de twee echte routes noemt helpt meer.
 *
 * De gating leunt op EXACT dezelfde twee bronnen als de UI — `onOpenStatusForResource` +
 * `isResourceFieldLocked` voor de vraag "geldt hier een bibliotheekherkomst", en `RESOURCE_DIFF_FIELDS`
 * voor de vraag "welke velden". Er is dus geen tweede, mee-te-onderhouden lijst: verhuist een veld
 * ooit van bedrijfsafspraak naar projectinzet, dan bewegen paneel en bridge samen mee.
 *
 * Buiten schot blijven bewust: een stempel van een ÁNDER bedrijf dan het geopende en een 'removed'-wees
 * (beide leveren `isResourceFieldLocked === false`, precies zoals de rij in het paneel gewoon
 * bewerkbaar blijft), en `delete` — "Verwijder uit project" is in de UI óók een gewone rijactie.
 *
 * Retourneert `null` wanneer er niets te weigeren valt.
 */
function libraryLockReason(s: StoreState, resourceId: string, fields: FieldPatch): string | null {
  if (!isResourceFieldLocked(s.onOpenStatusForResource(resourceId))) return null;
  const geraakt = RESOURCE_DIFF_FIELDS.filter((f) => f in fields);
  if (geraakt.length === 0) return null;

  const res = s.resources.find((r) => r.id === resourceId);
  const companyId = res?.libraryOrigin?.companyId;
  const bedrijf = s.companies.find((c) => c.id === companyId)?.name ?? '(name unknown)';
  const projectVelden = RESOURCE_FIELD_KEYS.filter((k) => !(RESOURCE_DIFF_FIELDS as string[]).includes(k));
  return (
    `resource '${resourceId}'${res ? ` ('${res.name}')` : ''} comes from the resource library ${bedrijf}; ` +
    `${geraakt.join(', ')} ${geraakt.length === 1 ? 'is' : 'are'} fixed there and cannot be changed in the ` +
    'resource panel either (the library determines WHAT a resource is). Two routes: change it in the library ' +
    'itself (Backstage → Library) — that then applies to EVERY project that uses this resource, and the ' +
    'bridge deliberately does not offer that route, because it also affects projects that are not open now; ' +
    'or first unlink this resource from the library ("Unlink from library" in the Resources tab), after ' +
    'which it is project-owned and fully editable. Can still be changed via this tool: ' +
    `${projectVelden.join(', ')} (project deployment).`
  );
}

function classifyResources(
  s: StoreState,
  actions: ResourceAction[],
): { plans: ResourcePlan[]; rejections: Rejection[] } {
  const plans: ResourcePlan[] = [];
  const rejections: Rejection[] = [];
  let sim: SimResource[] = s.resources.map((r) => ({ id: r.id, type: r.type, parentId: r.parentId }));
  // Toewijzingen per resource — nodig voor de cascade-poort bij `delete`. Groeit niet mee: deze tool
  // maakt of verwijdert zelf geen toewijzingen (dat doet `planner_manage_assignments`).
  const assignmentsOf = (id: string) => s.assignments.filter((a) => a.resourceId === id);
  const calendarIds = new Set(s.calendars.map((c) => c.id));

  /** Loopt de ploeg-keten omhoog vanaf `parentId`; true zodra hij op `selfId` uitkomt. */
  const wouldCycle = (selfId: string, parentId: string): boolean => {
    const seen = new Set<string>();
    let cur: string | undefined = parentId;
    while (cur !== undefined) {
      if (cur === selfId) return true;
      if (seen.has(cur)) return false; // reeds bestaande kring: niet ónze schuld, niet blokkeren
      seen.add(cur);
      cur = sim.find((r) => r.id === cur)?.parentId;
    }
    return false;
  };

  /**
   * Verwijzings-checks die de simulatie nodig hebben (kalender, ploeg, meeteenheid-op-materiaal).
   * `selfId` is het (sim-)id van de resource zelf; `effectiveType` het type ná deze patch.
   */
  const referenceReason = (patch: FieldPatch, selfId: string, effectiveType: ResourceType): string | null => {
    if (patch.calendarId !== undefined) {
      const calId = patch.calendarId as string;
      if (!calendarIds.has(calId)) {
        const hint = calId === s.calendar.id
          ? ' — this IS the PROJECT calendar, but it is not yet in the library of this document; use `null` ' +
            '(that already means "the project calendar") or promote it first with planner_update_calendar'
          : '; get valid ids with planner_list_calendars, or create one with planner_update_calendar (`create: true`)';
        return `calendar '${calId}' does not exist in this document${hint}`;
      }
    }
    if (patch.parentId !== undefined) {
      const pid = patch.parentId as string;
      const parent = sim.find((r) => r.id === pid);
      if (!parent) return `crew '${pid}' does not exist; \`parentId\` must be the id of an existing CREW resource`;
      if (parent.type !== 'CREW') {
        return `resource '${pid}' has type ${parent.type}; \`parentId\` may only point to a CREW resource (crew membership)`;
      }
      if (pid === selfId) return 'a resource cannot be its own crew';
      if (wouldCycle(selfId, pid)) return `crew '${pid}' is already under this resource; that would create a cycle in the crew membership`;
    }
    if (patch.unitOfMeasure !== undefined && effectiveType !== 'MATERIAL') {
      return `\`unitOfMeasure\` only applies to type MATERIAL (this resource is ${effectiveType}) — just ` +
        'like in the resource panel, where the field is disabled then';
    }
    return null;
  };

  actions.forEach((raw, index) => {
    const at = `#${index}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejections.push({ id: at, reason: 'every item must be an object with an `action` (create | update | delete)' });
      return;
    }
    const item = raw as unknown as Record<string, unknown>;
    const action = item.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') {
      rejections.push({ id: at, reason: `unknown action '${String(action)}' (create | update | delete)` });
      return;
    }
    const badKey = unknownKeyReason(item, action);
    if (badKey) {
      rejections.push({ id: typeof item.id === 'string' ? item.id : at, reason: badKey });
      return;
    }

    if (action === 'create') {
      const label = typeof item.tempId === 'string' ? item.tempId : (typeof item.name === 'string' ? item.name : at);
      if (item.tempId !== undefined) {
        if (typeof item.tempId !== 'string' || !TEMP_ID_PATTERN.test(item.tempId)) {
          rejections.push({
            id: String(item.tempId),
            reason: `\`tempId\` '${String(item.tempId)}' does not follow the reserved batch syntax; it must ` +
              'start with `tmp-` or `tmp_` (e.g. `tmp-crane-2`), so a next batch step can refer to it ' +
              'without ever hitting ordinary text',
          });
          return;
        }
        if (sim.some((r) => r.id === item.tempId)) {
          rejections.push({ id: item.tempId as string, reason: `\`tempId\` '${item.tempId}' was already used earlier in this call` });
          return;
        }
      }
      if (typeof item.name !== 'string' || item.name.trim() === '') {
        rejections.push({ id: label, reason: '`create` requires a non-empty `name`' });
        return;
      }
      const fields = parseFields(item);
      if (typeof fields === 'string') { rejections.push({ id: label, reason: fields }); return; }
      // Een placeholder-id dat NIETS kan matchen wanneer er geen tempId is (geen collisiegevaar met
      // echte id's, en geen enkele latere actie kan er per ongeluk naar verwijzen).
      const simId = typeof item.tempId === 'string' ? item.tempId : `\u0000new-${index}`;
      const effectiveType = (fields.type as ResourceType) ?? 'LABOR';
      const refBad = referenceReason(fields, simId, effectiveType);
      if (refBad) { rejections.push({ id: label, reason: refBad }); return; }
      sim = [...sim, { id: simId, type: effectiveType, parentId: fields.parentId as string | undefined }];
      plans.push({ mode: 'create', index, tempId: typeof item.tempId === 'string' ? item.tempId : undefined, fields });
      return;
    }

    if (action === 'update') {
      if (typeof item.id !== 'string' || item.id === '') {
        rejections.push({ id: at, reason: '`update` requires a non-empty string `id` (exactly the id from planner_list_resources)' });
        return;
      }
      const cur = sim.find((r) => r.id === item.id);
      if (!cur) {
        rejections.push({ id: item.id, reason: `resource '${item.id}' does not exist; get valid ids with planner_list_resources, or create it with \`action: "create"\`` });
        return;
      }
      const fields = parseFields(item);
      if (typeof fields === 'string') { rejections.push({ id: item.id, reason: fields }); return; }
      if (Object.keys(fields).length === 0) {
        rejections.push({
          id: item.id,
          reason: `no changes given; pass at least one of ${RESOURCE_FIELD_KEYS.join(', ')}`,
        });
        return;
      }
      // Bibliotheek-gating vóór de verwijzingscontroles: raakt de update een veld dat de bibliotheek
      // bepaalt, dan wordt het HELE item geweigerd — niet half toegepast. Een gedeeltelijke toepassing
      // ("maxUnits landde, costPerHour niet") is precies de stille-no-op-klasse die dit oppervlak
      // uitsluit.
      const lockBad = libraryLockReason(s, item.id, fields);
      if (lockBad) { rejections.push({ id: item.id, reason: lockBad }); return; }
      const effectiveType = (fields.type as ResourceType) ?? cur.type;
      const refBad = referenceReason(fields, cur.id, effectiveType);
      if (refBad) { rejections.push({ id: item.id, reason: refBad }); return; }
      // Simulatie bijwerken zodat latere items tegen de NIEUWE stand valideren.
      cur.type = effectiveType;
      if ('parentId' in fields) cur.parentId = fields.parentId as string | undefined;
      plans.push({ mode: 'update', index, id: item.id, fields });
      return;
    }

    // action === 'delete'
    if (typeof item.id !== 'string' || item.id === '') {
      rejections.push({ id: at, reason: '`delete` requires a non-empty string `id`' });
      return;
    }
    if (item.cascade !== undefined && typeof item.cascade !== 'boolean') {
      rejections.push({ id: item.id, reason: booleanArgReason(item.cascade, 'cascade') });
      return;
    }
    const target = sim.find((r) => r.id === item.id);
    if (!target) {
      rejections.push({ id: item.id, reason: `resource '${item.id}' does not exist (or was already deleted in this call)` });
      return;
    }
    if (target.id.startsWith('\u0000') || TEMP_ID_PATTERN.test(target.id)) {
      rejections.push({ id: item.id, reason: 'a resource created in the same call cannot be deleted in that same call' });
      return;
    }
    // CASCADE-POORT. Een resource verwijderen sloopt óók toewijzingen op taken die de aanroeper
    // helemaal niet noemde — anders dan bij `delete_tasks`, waar de meegewiste subboom logisch
    // ONDER het gevraagde object hangt. Daarom hier: bevestiging vereist, met de exacte omvang in de
    // weigering, zodat de AI in één ronde met `cascade: true` kan terugkomen.
    const attached = assignmentsOf(item.id);
    if (attached.length > 0 && item.cascade !== true) {
      const taskCount = new Set(attached.map((a) => a.taskId)).size;
      rejections.push({
        id: item.id,
        reason: `resource '${item.id}' still has ${attached.length} assignment(s) on ${taskCount} task(s); ` +
          'deleting clears those assignments TOO. Confirm with `cascade: true`, or remove them first with ' +
          'planner_manage_assignments (`remove`).',
      });
      return;
    }
    sim = sim.filter((r) => r.id !== item.id);
    // Leden van de verwijderde ploeg verliezen hun lidmaatschap — ook in de simulatie.
    for (const r of sim) if (r.parentId === item.id) r.parentId = undefined;
    plans.push({ mode: 'delete', index, id: item.id });
  });

  return { plans, rejections };
}

// =================================================================================================
// Kern + tooldefinitie
// =================================================================================================

/** Vormvalidatie van `manage_resources`; string = foutboodschap. */
function parseManageResources(args: unknown): ResourceAction[] | string {
  const a = (args ?? {}) as { actions?: unknown };
  if (!Array.isArray(a.actions) || a.actions.length === 0) {
    return 'manage_resources requires a non-empty `actions` array';
  }
  return a.actions as ResourceAction[];
}

/** Bouw het `Resource`-object voor een `create`; afwezige velden krijgen de app-default. */
function buildNewResource(fields: FieldPatch): Omit<Resource, 'id'> {
  const res: Omit<Resource, 'id'> = {
    name: fields.name as string,
    type: (fields.type as ResourceType) ?? 'LABOR',
    description: (fields.description as string) ?? '',
    maxUnits: (fields.maxUnits as number) ?? 1,
  };
  // Een sleutel met waarde `undefined` (de aanroeper gaf `null`) betekent bij AANMAAK simpelweg
  // "niet gezet" — dus alleen echte waarden overnemen; dat houdt het object schoon voor IFC.
  if (fields.costPerHour !== undefined) res.costPerHour = fields.costPerHour as number;
  if (fields.unitOfMeasure !== undefined) res.unitOfMeasure = fields.unitOfMeasure as string;
  if (fields.calendarId !== undefined) res.calendarId = fields.calendarId as string;
  if (fields.parentId !== undefined) res.parentId = fields.parentId as string;
  if (fields.availabilitySteps !== undefined) res.availabilitySteps = fields.availabilitySteps as AvailabilityStep[];
  return res;
}

/** Synchrone, transactie-vrije kern van `manage_resources` (zie de batchStep-noot in taskTools.ts). */
function manageResourcesCore(ctx: McpContext, actions: ResourceAction[]): MutationOutcome {
  const { plans, rejections } = classifyResources(ctx.app.store.getState(), actions);

  const created: Record<string, string> = {}; // tempId → echt id (batch-contract, batchTool.ts)
  const createdRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];
  const deletedRows: Record<string, unknown>[] = [];
  /** tempId → echt id, voor `parentId`-verwijzingen binnen dezelfde call. */
  const tempToReal = new Map<string, string>();

  const asgBefore = ctx.app.store.getState().assignments.length;

  for (const plan of plans) {
    if (plan.mode === 'create') {
      const fields = { ...plan.fields };
      // Een `parentId` die naar een tempId uit DEZE call wijst, nu vertalen naar het echte id.
      if (typeof fields.parentId === 'string' && tempToReal.has(fields.parentId)) {
        fields.parentId = tempToReal.get(fields.parentId)!;
      }
      const id = ctx.transactions.draft.addResource(buildNewResource(fields));
      if (plan.tempId) { created[plan.tempId] = id; tempToReal.set(plan.tempId, id); }
      createdRows.push({ id, ...(plan.tempId ? { tempId: plan.tempId } : {}), name: fields.name as string });
      continue;
    }

    if (plan.mode === 'update') {
      const fields = { ...plan.fields };
      if (typeof fields.parentId === 'string' && tempToReal.has(fields.parentId)) {
        fields.parentId = tempToReal.get(fields.parentId)!;
      }
      ctx.transactions.draft.updateResource(plan.id, fields as unknown as Partial<Resource>);
      updatedRows.push({ id: plan.id, changedFields: Object.keys(fields) });
      continue;
    }

    // delete — het VOLLEDIGE voor/na-verschil komt uit het draft-primitief zelf.
    const before = ctx.app.store.getState().resources.find((r) => r.id === plan.id);
    if (!before) {
      // Kan alleen bij een defect in de classificatie — harde stapfout i.p.v. stil doorgaan.
      throw new McpStepError('NOT_FOUND', `resource '${plan.id}' does not exist (after classification)`);
    }
    const name = before.name;
    const diff = ctx.transactions.draft.removeResource(plan.id);
    deletedRows.push({
      id: plan.id,
      name,
      removedAssignmentIds: diff.removedAssignmentIds,
      removedAssignmentCount: diff.removedAssignmentIds.length,
      affectedTaskIds: diff.affectedTaskIds,
      orphanedCrewMemberIds: diff.orphanedCrewMemberIds,
    });
  }

  const removedAssignmentCount = asgBefore - ctx.app.store.getState().assignments.length;

  return {
    data: {
      // `created` is het batch-contract (batchTool.ts → collectCreated): een volgende stap in
      // dezelfde `planner_batch` kan de tempId gebruiken als `resourceId` in manage_assignments.
      created,
      resources: createdRows,
      updated: updatedRows,
      deleted: deletedRows,
      removedAssignmentCount,
    },
    itemRejections: rejections,
  };
}

/** De lege-respons-vorm; gedeeld door het snelpad zodat de sleutels altijd hetzelfde zijn. */
const EMPTY_DATA = { created: {}, resources: [], updated: [], deleted: [], removedAssignmentCount: 0 };

const manageResources: BatchStepTool = {
  name: 'planner_manage_resources',
  description:
    'Manage the RESOURCES themselves in bulk — create, change, delete (one call = one undo step). This is ' +
    'the counterpart of planner_manage_assignments: that one links an EXISTING resource to a task, this tool ' +
    'creates/changes/deletes the resource. One `action` per item: `create` (required `name`, optional ' +
    '`tempId` + all fields), `update` (`id` + at least one field) or `delete` (`id`, and `cascade: true` as ' +
    'soon as it still has assignments). Fields: `name`, `type` (LABOR | EQUIPMENT | MATERIAL | SUBCONTRACTOR ' +
    '| CREW, default LABOR), `description`, `maxUnits` (capacity per WORKING DAY; 1 = 100% = one ' +
    'person/piece, default 1), `costPerHour` (cost per HOUR), `unitOfMeasure` (only for MATERIAL), ' +
    '`calendarId` (existing library calendar; `null` = the project calendar), `parentId` (crew membership, ' +
    'must be a CREW resource; `null` = no crew) and `availabilitySteps` (time-phased capacity: `[{from: ' +
    '"YYYY-MM-DD", maxUnits: n}]`; an empty list or `null` clears them). The field names are exactly those ' +
    'of planner_list_resources, so you can put read values straight back. `null` CLEARS an optional field; ' +
    'leaving a key out leaves it alone. DELETING IS DESTRUCTIVE: the resource, ALL its assignments and the ' +
    'crew membership of its members are removed. As long as it still has assignments, `delete` is softly ' +
    'refused with the exact count; then confirm with `cascade: true`. The response reports per deleted ' +
    'resource exactly what went along (`removedAssignmentIds`, `affectedTaskIds`, `orphanedCrewMemberIds`). ' +
    'Pass a `tempId` (`tmp-...`) with `create` if you want to assign the new resource in a next ' +
    'planner_batch step — the real id comes back in `created`. Refused items come back in `itemRejections`; ' +
    'the valid items simply stay. RESOURCES INHERITED FROM THE RESOURCE LIBRARY: if a resource comes from a ' +
    'resource library (`libraryOrigin` in planner_list_resources), that library determines WHAT it is and ' +
    '`name`, `type`, `description`, `costPerHour` and `unitOfMeasure` are fixed — an `update` on them is ' +
    'refused, exactly as those fields cannot be changed in the resource panel either. What the PROJECT ' +
    'determines stays writable: `maxUnits`, `calendarId`, `parentId` and `availabilitySteps`. If such a ' +
    'fixed field must be different after all, present the user with the two routes: change it in the library ' +
    '(then applies to every project that uses the resource; the bridge deliberately does not offer that ' +
    'route) or unlink the resource from the library, after which it is project-owned and fully editable.',
  kind: 'mutate',
  batchable: true,
  // Verwijderen wist toewijzingen (en dus werk) — dat is destructief.
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        description: 'The resource actions to run, in order.',
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            id: { type: 'string', description: 'For `update`/`delete`: exactly the resource id from planner_list_resources.' },
            tempId: {
              type: 'string',
              description:
                'Only for `create`: your own label starting with `tmp-` or `tmp_`. The real id comes back in ' +
                '`created[tempId]`; inside planner_batch a next step may use the tempId.',
            },
            cascade: {
              type: 'boolean',
              description:
                'Only for `delete`: confirm that the existing assignments of this resource may be cleared ' +
                'TOO. Without this flag a resource WITH assignments is softly refused.',
            },
            name: { type: 'string', description: 'Display name; required for `create`.' },
            type: {
              type: 'string',
              enum: ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'],
              description: 'Resource type (UPPERCASE). Default for `create`: LABOR.',
            },
            description: { type: 'string', description: 'Free description; "" empties it.' },
            maxUnits: {
              type: 'number',
              exclusiveMinimum: 0,
              description: 'Capacity per WORKING DAY (P6 "Max Units"): 1 = 100% = one person/piece, 3 = three units. Default 1.',
            },
            costPerHour: {
              type: ['number', 'null'],
              minimum: 0,
              description: 'Cost per HOUR; `null` clears the rate.',
            },
            unitOfMeasure: {
              type: ['string', 'null'],
              description: 'Unit of measure, ONLY for type MATERIAL (e.g. "m3"); `null` clears it.',
            },
            calendarId: {
              type: ['string', 'null'],
              description: 'Existing library calendar (planner_list_calendars); `null` = the project calendar.',
            },
            parentId: {
              type: ['string', 'null'],
              description: 'Crew membership: id of a CREW resource; `null` = no crew. Pure grouping, no capacity roll-up.',
            },
            availabilitySteps: {
              type: ['array', 'null'],
              description:
                'Time-phased capacity: from `from` onwards `maxUnits` applies. An empty list or `null` ' +
                'clears them (then the flat `maxUnits` applies at all times again).',
              items: {
                type: 'object',
                required: ['from', 'maxUnits'],
                properties: {
                  from: { type: 'string', description: 'ISO date (YYYY-MM-DD): from this day maxUnits applies.' },
                  maxUnits: { type: 'number', exclusiveMinimum: 0, description: 'Capacity per working day from `from`.' },
                },
              },
            },
          },
        },
      },
    },
    required: ['actions'],
    additionalProperties: false,
  },
  // Zie de batchStep-noot in taskTools.ts: het lege-batch-snelpad is puur transactie-vermijding en
  // dus overbodig binnen een batch (die bezit de transactie al).
  batchStep: parsedBatchStep(parseManageResources, manageResourcesCore),
  async handler(args, ctx) {
    const parsed = parseManageResources(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const actions = parsed;

    // Lege-batch-snelpad: statisch nul uitvoerbare items ⇒ direct Ok mét de weigeringen, zónder
    // transactie/backup/snapshot/redo-wipe.
    {
      const state = ctx.app.store.getState();
      const pre = classifyResources(state, actions);
      if (pre.plans.length === 0) {
        return okDirectGuarded(ctx, { ...EMPTY_DATA, warnings: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => manageResourcesCore(ctx, actions));

    return enrichOk(res, () => {
      const data = (res as McpToolOk).data as {
        deleted: { id: string; name: string; removedAssignmentCount: number; orphanedCrewMemberIds: string[] }[];
        updated: { id: string; changedFields: string[] }[];
        removedAssignmentCount: number;
      };
      const warnings: string[] = [];
      const totalRemoved = data.removedAssignmentCount;
      if (totalRemoved > 0) {
        warnings.push(
          `${totalRemoved} assignment(s) were deleted TOO along with ${data.deleted.length} resource(s) (` +
          `${data.deleted.map((d) => `${d.name}: ${d.removedAssignmentCount}`).join(', ')}). That work is ` +
          'now on no resource at all — check the tasks involved (see `affectedTaskIds`).',
        );
      }
      const orphaned = data.deleted.flatMap((d) => d.orphanedCrewMemberIds);
      if (orphaned.length > 0) {
        warnings.push(
          `${orphaned.length} resource(s) lost their crew membership because their CREW was deleted (` +
          `${orphaned.join(', ')}); their \`parentId\` is now empty.`,
        );
      }
      // Nivellering: de nivelleeruitvoer (vertraging, ook sub-dag-precisie uit een `.mpp`, en
      // ingevoegde pauzedagen) staat op de TAKEN en blijft na een capaciteits-/kalender-/
      // toewijzingswijziging gewoon staan — de eind-`runCPM` rekent die oude nivellering dus door op
      // een gewijzigde capaciteit. Dat is geen fout, maar het mag niet stil blijven. "Staat er
      // nivellering op?" is de ENE gedeelde definitie `hasLevelingOutput` (`utils/taskDefaults.ts`),
      // dezelfde als achter "Nivellering wissen" — geen eigen, smallere controle hier.
      const capacityTouched =
        totalRemoved > 0 ||
        data.updated.some((u) => u.changedFields.some((f) => f === 'maxUnits' || f === 'availabilitySteps' || f === 'calendarId'));
      const state = ctx.app.store.getState();
      if (capacityTouched && state.tasks.some(hasLevelingOutput)) {
        warnings.push(
          'An APPLIED leveling is on this schedule; it was calculated on the OLD capacity and is now out of ' +
          'date. Run planner_level_resources again or clear it with planner_clear_leveling. ',
        );
      }
      return { ...((res as McpToolOk).data as object), warnings, ...projectEndInfo(state) };
    });
  },
};

/** Alle resource-beheer-tools van deze module (registratie via `toolRegistry.ts`). */
export const resourceTools: BatchStepTool[] = [manageResources];
