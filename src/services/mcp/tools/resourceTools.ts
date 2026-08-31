// MCP-toolmodule — RESOURCEBEHEER (aanmaken / wijzigen / verwijderen).
//
// WAAROM DEZE MODULE BESTAAT. De bridge kon resources wél LEZEN (`planner_list_resources`,
// `planner_get_resource_histogram`), wél TOEWIJZEN (`planner_manage_assignments`) en wél NIVELLEREN
// (`planner_level_resources`) — maar er was geen enkele manier om een resource aan te maken, te
// hernoemen, te verwijderen of zijn capaciteit/tarief/kalender/beschikbaarheid te wijzigen. Een
// gebruiker die "zet er een tweede kraan bij" vroeg, liep dood: `manage_assignments`' `add` weigert
// met `resource '<id>' bestaat niet` en er was binnen de bridge geen weg vooruit. Deze module dicht
// dat gat.
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
// `unitOfMeasure`, `calendarId`, `description`, `parentId`, `availabilitySteps`. De leeskant is
// daarvoor uitgebreid met de laatste drie (die waren wél schrijfbaar in de UI maar onzichtbaar via
// de bridge); zie de noot in `readTools.ts` bij `listResources`.
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
  guardNonTransactional,
  runMutateTool,
  toolError,
  McpStepError,
  type MutationOutcome,
} from './runtime';
// Alleen als TYPE (SYNC-2): wordt weggestreept bij compileren, dus géén runtime-import naar batchTool.
import type { BatchStepTool } from './batchTool';
import { enrichOk, okDirect, projectEndInfo } from './helpers';
import type { AppState } from '@/state/appStore';
import type { AvailabilityStep, Resource, ResourceType } from '@/types/resource';
// Bibliotheek-gating: EXACT dezelfde bronnen als het slot in `ResourcePanel`, zodat "wat de UI op
// slot zet" en "wat deze tool weigert" nooit uiteen kunnen lopen (zie de noot bij `libraryLockReason`).
import { RESOURCE_DIFF_FIELDS, isResourceFieldLocked } from '@/services/library/libraryOps';

const STD_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

type Rejection = { id: string; reason: string };
type StoreState = AppState;

/** Het volledige `ResourceType`-domein (types/resource.ts). Hoofdlettergevoelig, net als elders. */
const RESOURCE_TYPES: ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'];

/**
 * De SCHRIJFBARE velden. Bewust exact het oppervlak dat de mens in het resourcepaneel heeft
 * (`ResourcePanel.tsx`: naam, type, max. eenheden, kalender, uurtarief, meeteenheid, ploeg,
 * beschikbaarheidsstappen) plus `description` — dat veld zit in het `Resource`-type, round-trippt
 * door IFC (`IFCxxxRESOURCE` argument 4) en is nu ook aan de leeskant zichtbaar, maar heeft in het
 * paneel geen kolom. Het toevoegen kost niets en maakt de bridge niet gevaarlijker.
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

/** Gereserveerde batch-syntax voor `tempId` (spiegelt `TEMP_ID_PATTERN` in batchTool.ts). */
const TEMP_ID_PATTERN = /^tmp[-_]/;

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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
  return `onbekende sleutel(s) ${bad.map((k) => `\`${k}\``).join(', ')} bij actie '${action}'; ` +
    `toegestaan zijn: ${allowed.join(', ')}`;
}

/** Vormvalidatie van de `availabilitySteps`-lijst; string = reden, anders de genormaliseerde lijst. */
function parseAvailabilitySteps(raw: unknown): AvailabilityStep[] | string {
  if (!Array.isArray(raw)) return '`availabilitySteps` moet een array zijn (of `null` om ze te wissen)';
  const seen = new Set<string>();
  const out: AvailabilityStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return 'elk item in `availabilitySteps` moet een object zijn';
    const step = s as Record<string, unknown>;
    for (const k of Object.keys(step)) {
      if (k !== 'from' && k !== 'maxUnits') {
        return `onbekende sleutel \`${k}\` in \`availabilitySteps\`; toegestaan zijn: from, maxUnits`;
      }
    }
    if (typeof step.from !== 'string' || !ISO_DATE_ONLY.test(step.from)) {
      return `\`availabilitySteps.from\` moet een ISO-datum zijn (JJJJ-MM-DD), kreeg '${String(step.from)}'`;
    }
    if (!isFiniteNumber(step.maxUnits) || step.maxUnits <= 0) {
      return `\`availabilitySteps.maxUnits\` moet een getal > 0 zijn (eenheden per werkdag), kreeg '${String(step.maxUnits)}'`;
    }
    if (seen.has(step.from)) return `\`availabilitySteps\` bevat twee stappen met dezelfde datum '${step.from}'`;
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
    if (typeof item.name !== 'string' || item.name.trim() === '') return '`name` moet een niet-lege string zijn';
    patch.name = item.name;
  }
  if (item.type !== undefined) {
    if (!(RESOURCE_TYPES as string[]).includes(item.type as string)) {
      return `onbekend \`type\` '${String(item.type)}'; geldige waarden zijn ${RESOURCE_TYPES.join(', ')} (hoofdlettergevoelig)`;
    }
    patch.type = item.type;
  }
  if (item.description !== undefined) {
    if (typeof item.description !== 'string') return '`description` moet een string zijn (gebruik "" om hem te legen)';
    patch.description = item.description;
  }
  if (item.maxUnits !== undefined) {
    if (!isFiniteNumber(item.maxUnits) || item.maxUnits <= 0) {
      return `\`maxUnits\` moet een getal > 0 zijn (capaciteit per WERKDAG; 1 = 100% = één persoon/stuk), kreeg '${String(item.maxUnits)}'`;
    }
    patch.maxUnits = item.maxUnits;
  }
  if (item.costPerHour !== undefined) {
    if (item.costPerHour === null) patch.costPerHour = undefined;
    else if (!isFiniteNumber(item.costPerHour) || item.costPerHour < 0) {
      return `\`costPerHour\` moet een getal ≥ 0 zijn (kosten per UUR) of \`null\` om het te wissen, kreeg '${String(item.costPerHour)}'`;
    } else patch.costPerHour = item.costPerHour;
  }
  if (item.unitOfMeasure !== undefined) {
    if (item.unitOfMeasure === null) patch.unitOfMeasure = undefined;
    else if (typeof item.unitOfMeasure !== 'string' || item.unitOfMeasure.trim() === '') {
      return '`unitOfMeasure` moet een niet-lege string zijn (bijv. "m3", "ton") of `null` om hem te wissen';
    } else patch.unitOfMeasure = item.unitOfMeasure;
  }
  if (item.calendarId !== undefined) {
    if (item.calendarId === null) patch.calendarId = undefined;
    else if (typeof item.calendarId !== 'string' || item.calendarId === '') {
      return '`calendarId` moet een bestaand kalender-id zijn of `null` (= de projectkalender)';
    } else patch.calendarId = item.calendarId;
  }
  if (item.parentId !== undefined) {
    if (item.parentId === null) patch.parentId = undefined;
    else if (typeof item.parentId !== 'string' || item.parentId === '') {
      return '`parentId` moet het id van een CREW-resource zijn of `null` (= geen ploeg)';
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
 * BIBLIOTHEEK-GATING (B1.1, issue #19). Een resource die uit een bedrijfsbibliotheek komt draagt een
 * herkomststempel; de bibliotheek bepaalt dan WAT die resource is (naam/type/omschrijving/tarief/
 * eenheid — `RESOURCE_DIFF_FIELDS`) en het project bepaalt hoeveel en wanneer (`maxUnits`,
 * `availabilitySteps`, `calendarId`). Het resourcepaneel rendert die eerste groep daarom als platte
 * tekst: een mens KAN ze op zo'n rij niet wijzigen.
 *
 * Deze tool spiegelt dat slot in plaats van eromheen te lopen. Deed ze dat niet, dan schreef de
 * bridge velden die de gebruiker zelf niet kan schrijven — en de gemeten uitkomst daarvan is een
 * afwijkingsvraag bij de eerstvolgende verversgrens over een wijziging die de gebruiker niet zelf
 * maakte; kiest hij daar (begrijpelijk) "bibliotheekwaarden gebruiken", dan is de bewerking weg.
 * Een weigering die de twee echte routes noemt helpt de aanroeper verder dan een wijziging die later
 * stilzwijgend terugdraait.
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
  const bedrijf = s.companies.find((c) => c.id === companyId)?.name ?? 'de bedrijfsbibliotheek';
  const projectVelden = RESOURCE_FIELD_KEYS.filter((k) => !(RESOURCE_DIFF_FIELDS as string[]).includes(k));
  return (
    `resource '${resourceId}'${res ? ` ('${res.name}')` : ''} komt uit de bibliotheek van ${bedrijf}; ` +
    `${geraakt.join(', ')} ${geraakt.length === 1 ? 'ligt' : 'liggen'} daar vast en ${geraakt.length === 1 ? 'is' : 'zijn'} ` +
    'ook in het resourcepaneel niet te wijzigen (de bibliotheek bepaalt WAT een resource is). ' +
    'Twee routes: wijzig het in de bibliotheek zelf (Backstage → Bibliotheek) — dat geldt dan voor ELK ' +
    'project dat deze resource gebruikt, en die route heeft de bridge bewust niet, want dat raakt ook ' +
    'projecten die nu niet openstaan; óf maak deze resource eerst los van de bibliotheek ' +
    '("Losmaken van de bibliotheek" in de Resources-tab), waarna hij projecteigen en volledig ' +
    `bewerkbaar is. Wél gewoon te wijzigen via deze tool: ${projectVelden.join(', ')} (projectinzet).`
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
          ? " — dit is wél de PROJECTkalender, maar die staat nog niet in de bibliotheek van dit document; " +
            'gebruik `null` (dat betekent al "de projectkalender") of promoot hem eerst met planner_update_calendar'
          : "; haal geldige id's op met planner_list_calendars, of maak er een met planner_update_calendar (`create: true`)";
        return `kalender '${calId}' bestaat niet in dit document${hint}`;
      }
    }
    if (patch.parentId !== undefined) {
      const pid = patch.parentId as string;
      const parent = sim.find((r) => r.id === pid);
      if (!parent) return `ploeg '${pid}' bestaat niet; \`parentId\` moet het id van een bestaande CREW-resource zijn`;
      if (parent.type !== 'CREW') {
        return `resource '${pid}' heeft type ${parent.type}; \`parentId\` mag alleen naar een CREW-resource wijzen (ploeg-lidmaatschap)`;
      }
      if (pid === selfId) return 'een resource kan niet zijn eigen ploeg zijn';
      if (wouldCycle(selfId, pid)) return `ploeg '${pid}' zit al onder deze resource; dat zou een kring in het ploeg-lidmaatschap maken`;
    }
    if (patch.unitOfMeasure !== undefined && effectiveType !== 'MATERIAL') {
      return `\`unitOfMeasure\` geldt alleen voor type MATERIAL (deze resource is ${effectiveType}) — ` +
        'net als in het resourcepaneel, waar het veld dan uitgeschakeld is';
    }
    return null;
  };

  actions.forEach((raw, index) => {
    const at = `#${index}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejections.push({ id: at, reason: 'elk item moet een object zijn met een `action` (create | update | delete)' });
      return;
    }
    const item = raw as unknown as Record<string, unknown>;
    const action = item.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') {
      rejections.push({ id: at, reason: `onbekende actie '${String(action)}' (create | update | delete)` });
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
            reason: `\`tempId\` '${String(item.tempId)}' voldoet niet aan de gereserveerde batch-syntax; ` +
              'hij moet met `tmp-` of `tmp_` beginnen (bijv. `tmp-kraan-2`), zodat een volgende batch-stap ' +
              'ernaar kan verwijzen zonder ooit gewone tekst te raken',
          });
          return;
        }
        if (sim.some((r) => r.id === item.tempId)) {
          rejections.push({ id: item.tempId as string, reason: `\`tempId\` '${item.tempId}' is al eerder in deze call gebruikt` });
          return;
        }
      }
      if (typeof item.name !== 'string' || item.name.trim() === '') {
        rejections.push({ id: label, reason: '`create` vereist een niet-lege `name`' });
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
        rejections.push({ id: at, reason: '`update` vereist een niet-lege string-`id` (exact het id uit planner_list_resources)' });
        return;
      }
      const cur = sim.find((r) => r.id === item.id);
      if (!cur) {
        rejections.push({ id: item.id, reason: `resource '${item.id}' bestaat niet; haal geldige id's op met planner_list_resources, of maak hem aan met \`action: "create"\`` });
        return;
      }
      const fields = parseFields(item);
      if (typeof fields === 'string') { rejections.push({ id: item.id, reason: fields }); return; }
      if (Object.keys(fields).length === 0) {
        rejections.push({
          id: item.id,
          reason: `geen wijzigingen opgegeven; geef minstens één van ${RESOURCE_FIELD_KEYS.join(', ')} mee`,
        });
        return;
      }
      // Bibliotheek-gating vóór de verwijzingscontroles: raakt de update een veld dat de bibliotheek
      // bepaalt, dan wordt het HELE item geweigerd — niet half toegepast. Een gedeeltelijke toepassing
      // ("maxUnits landde, costPerHour niet") zou precies de stille-no-op-klasse terugbrengen die dit
      // oppervlak eerder heeft opgeruimd.
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
      rejections.push({ id: at, reason: '`delete` vereist een niet-lege string-`id`' });
      return;
    }
    if (item.cascade !== undefined && typeof item.cascade !== 'boolean') {
      rejections.push({ id: item.id, reason: `\`cascade\` moet een boolean zijn (true/false), kreeg ${typeof item.cascade} '${String(item.cascade)}'` });
      return;
    }
    const target = sim.find((r) => r.id === item.id);
    if (!target) {
      rejections.push({ id: item.id, reason: `resource '${item.id}' bestaat niet (of is in deze call al verwijderd)` });
      return;
    }
    if (target.id.startsWith('\u0000') || TEMP_ID_PATTERN.test(target.id)) {
      rejections.push({ id: item.id, reason: 'een resource die in dezelfde call is aangemaakt kan niet in diezelfde call worden verwijderd' });
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
        reason: `resource '${item.id}' heeft nog ${attached.length} toewijzing(en) op ${taskCount} taak/taken; ` +
          'verwijderen wist die toewijzingen MEE. Bevestig met `cascade: true`, of haal ze eerst weg met ' +
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
    return 'manage_resources vereist een niet-lege `actions`-array';
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
      throw new McpStepError('NOT_FOUND', `resource '${plan.id}' bestaat niet (na classificatie)`);
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
    'Beheer de RESOURCES zelf in bulk — aanmaken, wijzigen, verwijderen (één call = één ' +
    'ongedaan-maak-stap). Dit is de tegenhanger van planner_manage_assignments: die koppelt een ' +
    'BESTAANDE resource aan een taak, deze tool maakt/wijzigt/verwijdert de resource. Per item één ' +
    '`action`: `create` (verplicht `name`, optioneel `tempId` + alle velden), `update` (`id` + ' +
    'minstens één veld) of `delete` (`id`, en `cascade: true` zodra er nog toewijzingen op zitten). ' +
    'Velden: `name`, `type` (LABOR | EQUIPMENT | MATERIAL | SUBCONTRACTOR | CREW, default LABOR), ' +
    '`description`, `maxUnits` (capaciteit per WERKDAG; 1 = 100% = één persoon/stuk, default 1), ' +
    '`costPerHour` (kosten per UUR), `unitOfMeasure` (alleen voor MATERIAL), `calendarId` ' +
    '(bestaande bibliotheek-kalender; `null` = de projectkalender), `parentId` (ploeg-lidmaatschap, ' +
    'moet een CREW-resource zijn; `null` = geen ploeg) en `availabilitySteps` (tijd-gefaseerde ' +
    'capaciteit: `[{from: "JJJJ-MM-DD", maxUnits: n}]`; een lege lijst of `null` wist ze). De ' +
    'veldnamen zijn exact die van planner_list_resources, dus je kunt gelezen waarden rechtstreeks ' +
    'terugstoppen. `null` WIST een optioneel veld; een sleutel weglaten laat hem ongemoeid. ' +
    'VERWIJDEREN IS DESTRUCTIEF: de resource, ál zijn toewijzingen en het ploeg-lidmaatschap van ' +
    'zijn leden gaan weg. Zolang er toewijzingen op zitten wordt `delete` zacht geweigerd met het ' +
    'exacte aantal; bevestig dan met `cascade: true`. De respons meldt per verwijderde resource ' +
    'precies wat er meeging (`removedAssignmentIds`, `affectedTaskIds`, `orphanedCrewMemberIds`). ' +
    'Geef bij `create` een `tempId` (`tmp-...`) mee als je de nieuwe resource in een volgende ' +
    'planner_batch-stap wilt toewijzen — het echte id komt terug in `created`. Geweigerde items ' +
    'komen terug in `itemRejections`; de geldige items blijven gewoon staan. ' +
    'UIT DE BEDRIJFSBIBLIOTHEEK GEËRFDE RESOURCES: komt een resource uit een bedrijfsbibliotheek ' +
    '(`libraryOrigin` in planner_list_resources), dan bepaalt die bibliotheek WAT hij is en liggen ' +
    '`name`, `type`, `description`, `costPerHour` en `unitOfMeasure` vast — een `update` daarop ' +
    'wordt geweigerd, precies zoals die velden ook in het resourcepaneel niet te wijzigen zijn. Wat ' +
    'het PROJECT bepaalt blijft wél schrijfbaar: `maxUnits`, `calendarId`, `parentId` en ' +
    '`availabilitySteps`. Moet zo\'n vastgelegd veld tóch anders, leg de gebruiker de twee routes ' +
    'voor: in de bibliotheek wijzigen (geldt dan voor elk project dat de resource gebruikt; die ' +
    'route heeft de bridge bewust niet) of de resource losmaken van de bibliotheek, waarna hij ' +
    'projecteigen en volledig bewerkbaar is.',
  kind: 'mutate',
  batchable: true,
  // Verwijderen wist toewijzingen (en dus werk) — dat is destructief.
  annotations: { ...STD_ANNOT, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        description: 'De uit te voeren resource-acties, in volgorde.',
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['create', 'update', 'delete'] },
            id: { type: 'string', description: 'Bij `update`/`delete`: exact het resource-id uit planner_list_resources.' },
            tempId: {
              type: 'string',
              description:
                'Alleen bij `create`: eigen aanduiding die met `tmp-` of `tmp_` begint. Het echte id komt ' +
                'terug in `created[tempId]`; binnen planner_batch mag een volgende stap de tempId gebruiken.',
            },
            cascade: {
              type: 'boolean',
              description:
                'Alleen bij `delete`: bevestig dat de bestaande toewijzingen van deze resource MEE mogen ' +
                'worden gewist. Zonder deze vlag wordt een resource mét toewijzingen zacht geweigerd.',
            },
            name: { type: 'string', description: 'Weergavenaam; verplicht bij `create`.' },
            type: {
              type: 'string',
              enum: ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW'],
              description: 'Resourcesoort (HOOFDLETTERS). Default bij `create`: LABOR.',
            },
            description: { type: 'string', description: 'Vrije omschrijving; "" leegt hem.' },
            maxUnits: {
              type: 'number',
              exclusiveMinimum: 0,
              description: 'Capaciteit per WERKDAG (P6 "Max Units"): 1 = 100% = één persoon/stuk, 3 = drie eenheden. Default 1.',
            },
            costPerHour: {
              type: ['number', 'null'],
              minimum: 0,
              description: 'Kosten per UUR; `null` wist het tarief.',
            },
            unitOfMeasure: {
              type: ['string', 'null'],
              description: 'Meeteenheid, ALLEEN voor type MATERIAL (bijv. "m3"); `null` wist hem.',
            },
            calendarId: {
              type: ['string', 'null'],
              description: 'Bestaande bibliotheek-kalender (planner_list_calendars); `null` = de projectkalender.',
            },
            parentId: {
              type: ['string', 'null'],
              description: 'Ploeg-lidmaatschap: id van een CREW-resource; `null` = geen ploeg. Puur groepering, geen capaciteits-rollup.',
            },
            availabilitySteps: {
              type: ['array', 'null'],
              description:
                'Tijd-gefaseerde capaciteit: vanaf `from` geldt `maxUnits`. Een lege lijst of `null` wist ze ' +
                '(dan geldt de vlakke `maxUnits` weer altijd).',
              items: {
                type: 'object',
                required: ['from', 'maxUnits'],
                properties: {
                  from: { type: 'string', description: 'ISO-datum (JJJJ-MM-DD): vanaf deze dag geldt maxUnits.' },
                  maxUnits: { type: 'number', exclusiveMinimum: 0, description: 'Capaciteit per werkdag vanaf `from`.' },
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
  batchStep(args, ctx) {
    const parsed = parseManageResources(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return manageResourcesCore(ctx, parsed);
  },
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
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(ctx, { ...EMPTY_DATA, warnings: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
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
          `Er zijn ${totalRemoved} toewijzing(en) MEE verwijderd met ${data.deleted.length} resource(s) ` +
          `(${data.deleted.map((d) => `${d.name}: ${d.removedAssignmentCount}`).join(', ')}). Dat werk staat nu ` +
          'op geen enkele resource meer — controleer de betrokken taken (zie `affectedTaskIds`).',
        );
      }
      const orphaned = data.deleted.flatMap((d) => d.orphanedCrewMemberIds);
      if (orphaned.length > 0) {
        warnings.push(
          `${orphaned.length} resource(s) zijn hun ploeg-lidmaatschap kwijt doordat hun CREW is verwijderd ` +
          `(${orphaned.join(', ')}); hun \`parentId\` staat nu leeg.`,
        );
      }
      // Nivellering: `levelingDelay` staat op de TAKEN en blijft na een capaciteits-/kalender-/
      // toewijzingswijziging gewoon staan — de eind-`runCPM` rekent die oude vertraging dus door op
      // een gewijzigde capaciteit. Dat is geen fout, maar het mag niet stil blijven.
      const capacityTouched =
        totalRemoved > 0 ||
        data.updated.some((u) => u.changedFields.some((f) => f === 'maxUnits' || f === 'availabilitySteps' || f === 'calendarId'));
      const state = ctx.app.store.getState();
      if (capacityTouched && state.tasks.some((t) => t.levelingDelay !== undefined)) {
        warnings.push(
          'Er staat een TOEGEPASTE nivellering op deze planning; die is berekend op de OUDE capaciteit en ' +
          'is nu verouderd. Draai planner_level_resources opnieuw of wis hem met planner_clear_leveling.',
        );
      }
      const { projectEnd, cappedTaskIds } = projectEndInfo(state);
      return {
        ...((res as McpToolOk).data as object),
        warnings,
        projectEnd,
        ...(cappedTaskIds ? { cappedTaskIds } : {}),
      };
    });
  },
};

/** Alle resource-beheer-tools van deze module (registratie via `toolRegistry.ts`). */
export const resourceTools: BatchStepTool[] = [manageResources];
