// Belasting-/overallocatie-engine (fase 2.5, resources-ontwerp §4). Twee bouwstenen:
// `distributeUnits` (curve-verdeling van eenheden over de duur van een toewijzing — de ENE
// functie die zowel het histogram als, straks, de nivelleerder voedt) en `computeResourceLoad`
// (dag-granulaire belasting/capaciteit/overallocatie over alle resources+toewijzingen).
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import type { Task, TaskTimephasedContour } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult } from './CPMSolver';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { enumerateTaskWorkDays } from './splitWalk';
import {
  CONTOUR_SHAPE_VALUES, CURVE_TO_SHAPE, matchContoursToAssignments, periodsToWorkDaySlots,
  slotWeightsFromValues,
} from '@/engine/contour/contourEngine';
import { parseDate, formatDate, addCalendarDays, getWeekStart } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';

/** Controlepunten per curve: (t ∈ [0,1] = positie in de duur, gewicht). Lineair geïnterpoleerd
 *  tussen punten; niet genormaliseerd (distributeUnits normaliseert zelf via Σraw). */
const CURVE_POINTS: Partial<Record<ResourceCurve, [number, number][]>> = {
  UNIFORM: [[0, 1.0], [1, 1.0]],
  FRONT_LOADED: [[0, 1.0], [1, 0.2]],
  BACK_LOADED: [[0, 0.2], [1, 1.0]],
  BELL: [[0, 0.2], [0.5, 1.0], [1, 0.2]],
  EARLY_PEAK: [[0, 0.2], [1 / 3, 1.0], [1, 0.2]],
  LATE_PEAK: [[0, 0.2], [2 / 3, 1.0], [1, 0.2]],
  // DOUBLE_PEAK en TURTLE (contour-UI, 2026-09) hebben GEEN controlepunten: die twee curves bestaan
  // alleen als MS Project-/P6-tabelvorm en worden hieronder rechtstreeks uit de exacte 21-punts
  // tabel (`CONTOUR_SHAPE_VALUES`) bemonsterd — de zes bestaande curves blijven byte-identiek.
};

/**
 * Verdeelt `unitsPerDay × durationDays` totale eenheden over `durationDays` werkdagen volgens
 * `curve`, met lineaire interpolatie tussen controlepunten en grootste-rest-afronding zodat de
 * som EXACT klopt (geen 0.1-drift door floating point of afronding per dag). D=1 → alles op
 * dag 0, voor elke curve (randgeval).
 *
 * Deze ENE functie voedt zowel het histogram (`computeResourceLoad`) als, in een volgende
 * bouwstap, de nivelleerder — nooit een tweede, "simpelere" verdeelfunctie voor de leveler
 * (zie resources-ontwerp §5.7/§10-P12).
 *
 * LET OP — curve-vervlakking op korte taken (A7, deze golf): de piek-curves (BELL, EARLY_PEAK,
 * LATE_PEAK) worden bemonsterd op t = i/(D−1). Bij D=2 zijn de enige monsterpunten t=0 en t=1;
 * die vallen precies op de dal-controlepunten (0.2) van BELL/EARLY_PEAK/LATE_PEAK, dus beide dagen
 * krijgen gelijk gewicht en de "piek" verdwijnt — de verdeling is voor D≤2 dan de facto UNIFORM.
 * Dit is inherent aan lineaire interpolatie op zo weinig punten en bewust niet "gerepareerd": een
 * bult in het midden van een 2-daagse taak is niet zinvol te representeren.
 */
export function distributeUnits(unitsPerDay: number, durationDays: number, curve: ResourceCurve = 'UNIFORM'): number[] {
  const total = unitsPerDay * durationDays;
  if (durationDays <= 1) return durationDays === 1 ? [total] : [];

  const points = CURVE_POINTS[curve];
  let weights: number[];
  if (points) {
    const raw: number[] = [];
    for (let i = 0; i < durationDays; i++) {
      const t = i / (durationDays - 1);
      raw.push(interpolate(points, t));
    }
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    weights = raw.map(r => r / sumRaw);
  } else {
    // Tabelvorm (DOUBLE_PEAK/TURTLE): integratie van de 5%-slices over `durationDays` slots —
    // dezelfde bemonstering als een geïmporteerde `curveValues`-lijst in `assignmentDayUnits`.
    weights = slotWeightsFromValues(CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[curve]], durationDays);
  }

  // Grootste-rest-methode: eerst afronden naar beneden, dan de grootste fractionele resten
  // ophogen tot de som weer exact `total` is. De precisie (hele eenheden/dag bij een geheel TEMPO,
  // anders honderdsten) wordt bepaald in `largestRemainderRound` — zie het issue-#21-punt-7-
  // commentaar daar voor de motivering (hele mensen/machines per dag bij geheel tempo; een
  // fractioneel tempo als 0,5 kracht/dag blijft fractioneel).
  return largestRemainderRound(weights.map(w => w * total), total, unitsPerDay);
}

function interpolate(points: [number, number][], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, w0] = points[i];
    const [t1, w1] = points[i + 1];
    if (t >= t0 && t <= t1) {
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return w0 + frac * (w1 - w0);
    }
  }
  return points[points.length - 1][1];
}

function largestRemainderRound(values: number[], targetSum: number, unitsPerDay: number): number[] {
  // issue #21 punt 7 — heel TEMPO (unitsPerDay) ⇒ hele eenheden/dag; fractioneel tempo ⇒ fracties.
  // Een resource-spreiding gaat over echte eenheden per dag: is het TEMPO geheel (bv. 2 kracht/dag),
  // dan verdelen we in GEHELE eenheden per dag (scale=1) — een halve machinist of 0,67 kraan op één
  // dag is praktisch onzin, en de grootste-rest-methode garandeert dat de som EXACT op het gehele
  // totaal uitkomt (remainder = round(targetSum×scale) − Σvloer). Is het tempo fractie (bv. 0,5
  // kracht/dag), dan behouden we de honderdsten-precisie (scale=100) zodat de som exact klopt op
  // 2 decimalen — fractioneel tempo is expliciet ondersteund (UnitsInput step=any, P6/MSPDI-imports)
  // en mag niet worden afgerond naar hele eenheden.
  //
  // De gate is op unitsPerDay, NIET op het totaal: anders vervormt een fractioneel tempo dat
  // toevallig op een geheel totaal uitkomt. Bv. distributeUnits(0,5, 4, UNIFORM) → totaal 2 → een
  // totaal-gate kiest dan scale=1 en levert [1,1,0,0] i.p.v. de juiste [0,5,0,5,0,5,0,5]; en
  // distributeUnits(0,1, 10, UNIFORM) → totaal 0,9999999999999999 → binnen 1e-9 van 1 → [1,0,…,0].
  // Beide fouten zijn de aanleiding tot deze herstelronde. Drempel 1e-9 dekt floating-point-ruis.
  const scale = Math.abs(unitsPerDay - Math.round(unitsPerDay)) < 1e-9 ? 1 : 100;
  const floors = values.map(v => Math.floor(v * scale));
  let remainder = Math.round(targetSum * scale) - floors.reduce((a, b) => a + b, 0);
  const fracIdx = values
    .map((v, i) => ({ i, frac: v * scale - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < fracIdx.length && remainder > 0; k++, remainder--) {
    result[fracIdx[k].i] += 1;
  }
  return result.map(v => v / scale);
}

/**
 * Contour-engine (2026-09) — DE ENE verdeelfunctie per toewijzing: eenheden per werkdag-slot van
 * de taak, index-uitgelijnd op `enumerateTaskWorkDays(task.splitGaps, …)` (slot i ⇒ i-de werkdag
 * vanaf `earlyStart`, pauzedagen overgeslagen). Drie bronnen, in deze volgorde:
 *   1. een OPGESLAGEN contour (`Task.timephasedContours`, gekoppeld via `resourceId` —
 *      `contourEngine.ts`'s `matchContoursToAssignments`): werkminuten per slot ÷ `mpd` = eenheden
 *      per dag. DATA, dus GEEN hele-eenheden-afronding (spec: "een fractie in een contour is
 *      bedoelde data"). Een contour met méér slots dan `scheduleDuration` levert een langere array;
 *      de aanroeper enumereert daarom `Math.max(durationDays, units.length)` werkdagen — het TOTAAL
 *      blijft behouden (dezelfde garantie als het earlyFinish-besluit hieronder).
 *   2. `ResourceAssignment.curveValues` (exacte 21-punts P6-/MSPDI-curve): `slotWeightsFromValues`
 *      × (unitsPerDay × duur) — ook data-achtig, dus eveneens zonder de formule-afronding.
 *   3. anders de bestaande formule `distributeUnits` (curve-vorm + hele-eenheden-afronding) —
 *      byte-identiek voor elke toewijzing zonder contour of `curveValues`.
 * `contour` mag door de aanroeper vooraf zijn opgezocht (één `matchContoursToAssignments` per
 * taak); ontbreekt het argument, dan zoekt deze functie 'm zelf op uit `task.timephasedContours`
 * en `siblings` (alle toewijzingen van de taak — nodig voor de volgorderegel van de koppeling).
 */
export function assignmentDayUnits(
  task: Task,
  assignment: ResourceAssignment,
  mpd: number,
  contour?: TaskTimephasedContour | null,
  siblings?: readonly ResourceAssignment[],
): number[] {
  const durationDays = task.time.scheduleDuration;
  const resolved = contour === undefined
    ? matchContoursToAssignments(task.timephasedContours, siblings ?? [assignment]).get(assignment.id) ?? null
    : contour;
  if (resolved && resolved.periods.length > 0) {
    const slotMinutes = Math.max(1, mpd);
    const slotWork = periodsToWorkDaySlots(resolved.periods, task.splitGaps, slotMinutes, 0);
    if (slotWork.length > 0) return slotWork.map((w) => w / slotMinutes);
  }
  if (assignment.curveValues && durationDays > 0) {
    const weights = slotWeightsFromValues(assignment.curveValues, durationDays);
    const total = assignment.unitsPerDay * durationDays;
    return weights.map((w) => w * total);
  }
  return distributeUnits(assignment.unitsPerDay, durationDays, assignment.curve ?? 'UNIFORM');
}

/** Hulpje voor de lastlezers: één `matchContoursToAssignments`-uitslag per taak (gecachet per
 *  aanroep), zodat de volgorderegel van de koppeling over álle toewijzingen van de taak gaat. */
export function contourLookup(
  assignments: readonly ResourceAssignment[],
): (task: Task, assignment: ResourceAssignment) => TaskTimephasedContour | null {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    let list = byTask.get(a.taskId);
    if (!list) { list = []; byTask.set(a.taskId, list); }
    list.push(a);
  }
  const cache = new Map<string, Map<string, TaskTimephasedContour>>();
  return (task, assignment) => {
    if (!task.timephasedContours || task.timephasedContours.length === 0) return null;
    let m = cache.get(task.id);
    if (!m) {
      m = matchContoursToAssignments(task.timephasedContours, byTask.get(task.id) ?? [assignment]);
      cache.set(task.id, m);
    }
    return m.get(assignment.id) ?? null;
  };
}

/**
 * De werkdagen waarop een toewijzing van `task` boekt, index-uitgelijnd op `assignmentDayUnits`
 * (slot i ⇒ `isos[i]`). Eén definitie voor beide lastlezers hieronder ÉN voor het contour-
 * dialoogvenster (`ContourDialog.tsx`), zodat de dag die de gebruiker bewerkt exact de dag is
 * waarop het histogram boekt. Drie takken:
 *  - ELAPSEDTIME: `scheduleDuration` is KALENDERdagen, niet werkdagen (zie het docblok bij
 *    `computeResourceLoad`) — de op `earlyFinish` geklemde mapping i.p.v. `enumerateTaskWorkDays`,
 *    die het getal als werkdagen-telling zou lezen en voorbij `earlyFinish` zou doorlopen;
 *  - VOLTOOID (`completion >= 1 && actualFinish`, eindpoortronde W0): `earlyFinish` is dan
 *    GEZAGHEBBEND, niet stale — dezelfde geklemde vorm, andere reden (zie datzelfde docblok);
 *  - anders `enumerateTaskWorkDays(task.splitGaps, …)`: `durationDays` werkdagen vanaf
 *    `earlyStart`, pauzedagen van de splits overgeslagen.
 */
export function taskWorkDayIsos(task: Task, taskEngine: CalendarEngine, durationDays: number): string[] {
  return task.time.durationType === 'ELAPSEDTIME' || (task.time.completion >= 1 && task.time.actualFinish)
    ? enumerateWorkDays(taskEngine, task.time.earlyStart, task.time.earlyFinish)
    : enumerateTaskWorkDays(task.splitGaps, taskEngine, task.time.earlyStart, durationDays);
}

/** ISO-datum → belaste/beschikbare eenheden. Alleen dagen met >0 belasting of capaciteit
 *  (dag-granulair) — geen volledige-projectspanne-vulling met nul-dagen. */
export interface DailyLoad {
  [isoDate: string]: number;
}

export interface ResourceLoadResult {
  /** resourceId → per-dag-belasting (som over alle assignments van deze resource op deze dag). */
  load: Record<string, DailyLoad>;
  /** resourceId → per-dag-capaciteit (kalender × maxUnits/availabilitySteps; 0 op niet-werkdagen). */
  capacity: Record<string, DailyLoad>;
  /** resourceId → ISO-datums waar load > capacity. */
  overallocatedDays: Record<string, string[]>;
}

/** Kalender-engine voor de TAAKkalender van `task` — spiegelt `CPMSolver.calendarFor`
 *  (`resolveCalendar(task.calendarId, registry, projectCalendar)`) exact: dezelfde bron
 *  (`task.calendarId`) en dezelfde fallback (geen/onbekende id ⇒ projectkalender), dat is dus
 *  óók de engine waarmee de CPM de duur en de splits van de taak rekent. Gecachet per calendarId
 *  (`cache`, per aanroep van `computeResourceLoad`/`computeHistogramReport` een verse Map) zodat
 *  taken op dezelfde kalender geen nieuwe `CalendarEngine` per taak bouwen. Gedeeld door beide
 *  mappings hieronder — één definitie, geen tweede die stil kan afdrijven (B1c-W0.1). */
function engineForTask(
  task: Task,
  cache: Map<string, CalendarEngine>,
  projectEngine: CalendarEngine,
  calendarRegistry: WorkCalendar[],
  projectCalendar: WorkCalendar,
): CalendarEngine {
  const key = task.calendarId ?? '';
  let eng = cache.get(key);
  if (!eng) {
    eng = key === ''
      ? projectEngine
      : new CalendarEngine(calendarForEngine(
        resolveCalendar(task.calendarId, calendarRegistry, projectCalendar),
      ));
    cache.set(key, eng);
  }
  return eng;
}

/**
 * Berekent dag-granulaire belasting/capaciteit/overallocatie over alle resources+toewijzingen.
 * Logica (resources-ontwerp §4.2, dag-mapping herzien in B1c-W0.1):
 *  1. Filter assignments op leaf-taken zonder milestone (defensieve dubbele bewaking t.o.v.
 *     de assignResource-enforcement — mocht een oud bestand toch een ongeldige assignment
 *     bevatten).
 *  2-3. Per assignment: verdeel de eenheden over de curve en accumuleer per resource per dag,
 *     gemapt op de ECHTE werkdagen van de taak vanaf `earlyStart` (`enumerateTaskWorkDays`,
 *     `splitWalk.ts`) — de kalender van de TAAK (`engineForTask`, dezelfde engine als de CPM-duur/
 *     -splits), met `splitGaps`-pauzedagen overgeslagen. Vóór B1c-W0.1 werd hier onvoorwaardelijk
 *     de projectkalender gebruikt en werden pauzedagen niet overgeslagen — beide zijn bewust
 *     gerepareerd gedrag, zie `docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`
 *     §W0. `enumerateTaskWorkDays` is dag-granulair: een gat dat in uur-modus is opgegeven wordt op
 *     hele werkdagen afgerond (bestaand gedrag van `splitDayPattern`, zie `splitWalk.ts`).
 *
 *     BESLUIT — earlyFinish wordt genegeerd (behalve ELAPSEDTIME, zie hieronder): de mapping loopt
 *     exact `scheduleDuration` werkdagen vanaf `earlyStart`, ongeacht wat `earlyFinish` zegt. Dat is
 *     bewust: bij een STALE taak (opgeslagen datums achterhaald t.o.v. de invoer, bv. het
 *     bezettingsoverzicht vóór een efemere doorrekening) lopen `scheduleDuration` en
 *     `earlyStart..earlyFinish` per definitie uiteen. Zou de mapping op `earlyFinish` klemmen, dan
 *     kapt ze de verdeling af op min(dagen, werkdagen-in-de-verouderde-spanne) — een uitkomst die
 *     noch de oude, noch de nieuwe planning is. Door gewoon `scheduleDuration` dagen vanaf
 *     `earlyStart` te lopen, blijft het TOTAAL van de curve altijd behouden (nooit stil een deel
 *     laten verdwijnen) — dat behouden totaal is de dragende garantie, niet een precieze dagindeling:
 *     bij stale data is `earlyStart` het oude anker maar kan `scheduleDuration` al de nieuwe invoer
 *     weerspiegelen (een bewerking die de duur wijzigt zonder meteen te herrekenen), dus de uitkomst
 *     is dan een HYBRIDE van oud en nieuw, geen zuivere "oude planning" — zie ook
 *     `docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`
 *     §W0. `enumerateTaskWorkDays` zelf kent hoe dan ook geen eindgrens (in tegenstelling tot
 *     `computeSplitSegments` in `splitWalk.ts`, dat een renderer-balk wél op `taskEnd` klemt — een
 *     balk MOET binnen zijn eigen grenzen tekenen; een lastlezer mag, en moet hier bewust, verder
 *     lopen dan een verouderde `earlyFinish`).
 *
 *     UITZONDERING — ELAPSEDTIME: voor zo'n taak is `scheduleDuration` KALENDERdagen, niet
 *     werkdagen (`duration.ts`'s `elapsedMinutesOf`-docblok) — `enumerateTaskWorkDays` zou dat getal
 *     als werkdagen-telling lezen en voorbij `earlyFinish` doorlopen (bv. duur 10 over een spanne
 *     met een weekend erin). Voor ELAPSEDTIME-taken gebruikt de mapping daarom een DERDE variant —
 *     geen restauratie van het pre-W0.1-gedrag: `enumerateWorkDays(taskEngine, earlyStart,
 *     earlyFinish)` loopt weliswaar (net als vóór W0.1) over de spanne in plaats van een
 *     dagenteling, maar op `taskEngine` — dezelfde `engineForTask`-taakkalender als de andere twee
 *     takken hierboven, niet onvoorwaardelijk de projectkalender. De taakkalender-lijn van deze fix
 *     geldt dus ook hier; alleen het "loop tot `earlyFinish`, niet `scheduleDuration` werkdagen
 *     verder"-gedrag is bewust ongewijzigd t.o.v. vóór W0.1. `splitGaps` wordt in deze tak niet
 *     toegepast — een BEWUSTE, begrensde beperking, geen aanname over de invoer: de `.mpp`-lezer
 *     poort `splitGaps` niet op `durationType`, dus een ELAPSEDTIME-taak mét gaten is mogelijk (al
 *     zeldzaam) en boekt in dat geval gewoon door op wat voor een WORKTIME-taak een pauzedag zou
 *     zijn. De bestaande min-klem in de accumulatielus (`i < days.length && i < workDayIsos.length`)
 *     zorgt dat een curve die méér dagen telt dan er werkdagen in de spanne zitten, gewoon aan het
 *     eind afkapt.
 *
 *     TWEEDE UITZONDERING — VOLTOOID (`completion >= 1 && actualFinish`, eindpoortronde W0): dezelfde
 *     `enumerateWorkDays(taskEngine, earlyStart, earlyFinish)`-vorm als de ELAPSEDTIME-tak, om een
 *     andere reden. Het BESLUIT hierboven ("earlyFinish wordt genegeerd") rust op de aanname dat
 *     `earlyFinish` STALE kan zijn t.o.v. `scheduleDuration` — maar voor een VOLTOOIDE taak is
 *     `earlyFinish` niet stale, hij is GEZAGHEBBEND: `CPMSolver.forwardPass`'s VOLTOOID-tak heeft hem
 *     zojuist onvoorwaardelijk uit `actualStart`/`actualFinish` afgeleid (§ "VOLTOOID: volledig gepind
 *     op actuals" aldaar), niet uit `scheduleDuration`. De stale-data-rechtvaardiging geldt hier dus
 *     niet, en `scheduleDuration` werkdagen vanaf `earlyStart` doorlopen kan een reëel voltooide taak
 *     over een feestdagenblok heen laten doorschieten — precies het scenario van de showcase
 *     "rijwoningen-de-akkers" (Roof structure — House 1: completion=1, CPM-earlyFinish 05-04 via
 *     `snapOnOrBefore`, maar `scheduleDuration`=5 werkdagen vanaf `earlyStart` 04-29 landt via het
 *     05-05/05-06-feestdagenblok op 05-07 — House 2's eigen startdag, een fantoomoverallocatie).
 *     Splits/gaten worden ook hier niet toegepast (zelfde begrensde beperking als de ELAPSEDTIME-tak):
 *     een voltooide taak se echte verloop staat al vast in de actuals, niet in `splitGaps`.
 *  4. Capaciteit per resource per dag: maxUnits (met availabilitySteps) op werkdagen van de
 *     resource-kalender (of de projectkalender als geen calendarId gezet is), 0 op niet-werkdagen.
 *     Dit is de RESOURCE-kalender, niet per se de taakkalender: werkt een taak (op haar eigen
 *     kalender) op een dag die de resource-kalender niet als werkdag kent, dan is capaciteit daar 0
 *     en telt de dag automatisch mee in `overallocatedDays` — bewust: de resource kán daar simpelweg
 *     niet werken, dus is dat een echt (en niet een vals-positief) conflict.
 *  5. Materiaal telt gewoon mee voor overallocatie (leveler slaat het straks over, deze functie
 *     niet — expliciete beslissing, zie §4.2 punt 5).
 *  6. overallocatedDays = dagen waar load > capacity.
 */
export function computeResourceLoad(
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: Task[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
): ResourceLoadResult {
  const load: Record<string, DailyLoad> = {};
  const capacity: Record<string, DailyLoad> = {};
  const overallocatedDays: Record<string, string[]> = {};

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const projectEngine = new CalendarEngine(calendarForEngine(projectCalendar));
  // W0: de dag-mapping volgt de TAAKkalender (dezelfde engine waarmee de CPM duur en splits
  // rekent — zie `engineForTask` hierboven), niet onvoorwaardelijk de projectkalender. Cache per
  // calendarId, één Map per aanroep van deze functie.
  const taskEngineCache = new Map<string, CalendarEngine>();

  // 1. Leaf-only, geen mijlpalen (dubbele bewaking t.o.v. resourceSlice.assignResource, §2.4).
  const validAssignments = assignments.filter(a => {
    const task = taskById.get(a.taskId);
    return !!task && isLeafTask(task) && !task.isMilestone;
  });

  // 2-3. Verdeel + accumuleer per resource per dag. Contour-engine (2026-09): de verdeling komt uit
  //      `assignmentDayUnits` — opgeslagen contour of exacte curve als DATA, anders de formule.
  const contourOf = contourLookup(validAssignments);
  for (const a of validAssignments) {
    const task = taskById.get(a.taskId)!;
    const taskEngine = engineForTask(task, taskEngineCache, projectEngine, resourceCalendars, projectCalendar);
    const days = assignmentDayUnits(task, a, taskEngine.hoursPerDay * 60, contourOf(task, a));
    if (days.length === 0) continue;
    const durationDays = Math.max(task.time.scheduleDuration, days.length);
    const workDayIsos = taskWorkDayIsos(task, taskEngine, durationDays);

    if (!load[a.resourceId]) load[a.resourceId] = {};
    const bucket = load[a.resourceId];
    for (let i = 0; i < days.length && i < workDayIsos.length; i++) {
      const iso = workDayIsos[i];
      bucket[iso] = (bucket[iso] ?? 0) + days[i];
    }
  }

  // 4. Capaciteit — alleen op de dagen waar ook belasting bestaat (zie DailyLoad-doc hierboven).
  for (const resource of resources) {
    const bucket = load[resource.id];
    if (!bucket) continue;

    const engine = new CalendarEngine(calendarForEngine(
      resolveCalendar(resource.calendarId, resourceCalendars, projectCalendar),
    ));

    capacity[resource.id] = {};
    for (const iso of Object.keys(bucket)) {
      const date = parseDate(iso);
      capacity[resource.id][iso] = engine.isWorkDay(date) ? maxUnitsOn(resource, iso) : 0;
    }
  }

  // 6. Overallocatie: load > capacity (materiaal telt gewoon mee, zie §4.2 punt 5).
  for (const resId of Object.keys(load)) {
    const bucket = load[resId];
    const cap = capacity[resId] ?? {};
    const flagged: string[] = [];
    for (const iso of Object.keys(bucket)) {
      if (bucket[iso] > (cap[iso] ?? 0)) flagged.push(iso);
    }
    if (flagged.length > 0) overallocatedDays[resId] = flagged.sort();
  }

  return { load, capacity, overallocatedDays };
}

/**
 * Eén gedeelde betrouwbaarheidspoort voor afgeleide belasting. Een CPM-fout betekent dat de
 * taakdatums niet als geldige planning mogen worden behandeld; callers publiceren dan `null`.
 * Een nog niet berekende planning (`cpmResult === null`) behoudt het bestaande gedrag en leidt de
 * belasting af uit de aanwezige taakdatums.
 */
export function computeReliableResourceLoad(
  cpmResult: CPMResult | null,
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: Task[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
): ResourceLoadResult | null {
  return cpmResult?.error
    ? null
    : computeResourceLoad(resources, assignments, tasks, projectCalendar, resourceCalendars);
}

/** Vlakke `maxUnits`, tenzij `availabilitySteps` een latere stap ≤ `iso` heeft — dan geldt de
 *  laatste zo'n stap (effective-dated, P6 Units-and-Prices-model). Geëxporteerd zodat de
 *  nivelleerder (`ResourceLeveler.ts`) exact dezelfde capaciteitsdefinitie hergebruikt — één
 *  bron van waarheid voor histogram én leveler. */
export function maxUnitsOn(resource: Resource, iso: string): number {
  const steps = resource.availabilitySteps;
  if (!steps || steps.length === 0) return resource.maxUnits;
  let applicable = resource.maxUnits;
  for (const step of [...steps].sort((a, b) => a.from.localeCompare(b.from))) {
    if (step.from <= iso) applicable = step.maxUnits;
  }
  return applicable;
}

// ── Histogram-rapport (taak T6, MCP-tool `get_resource_histogram`) ───────────────────────────────
//
// Een aparte, gescopete engine-pass bovenop dezelfde bouwstenen als `computeResourceLoad`
// (`distributeUnits` + werkdag-enumeratie), met drie dingen die de UI-load-pass NIET levert:
//   1. Bucketing (dag/week) — weekbucket levert zowel de weeksom (`load`) als de piekdag
//      (`peakDayLoad`), zodat een eendaagse piek niet in de weeksom verdwijnt.
//   2. Venster-capaciteit — een EIGEN enumeratie over ÁLLE werkdagen van het bucketvenster (ook
//      onbelaste). De load-pass levert capaciteit enkel op belaste dagen; dat zou een week-som
//      onderschatten (review-bevinding). Kalender per resource: `resource.calendarId` → bibliotheek,
//      anders de projectkalender — exact zoals `computeResourceLoad`.
//   3. Veroorzaker-attributie (`causes`) — ALLÉÉN voor buckets met minstens één overbelaste dag
//      (gescopet, O(assignments×duur + pieken)); bijdrage = de units die de assignment op de
//      overbelaste dag(en) van die bucket levert.
//
// `overallocatedDays` is ALTIJD dag-granulair, ook in week-modus. De bestaande `computeResourceLoad`
// blijft ongewijzigd (de UI leunt erop); deze functie is puur additief.

export interface HistogramCause {
  assignmentId: string;
  taskId: string;
  /** Units die deze assignment levert op de overbelaste dag(en) binnen dit bucketvenster. */
  contribution: number;
}

export interface HistogramBucket {
  /** ISO-grenzen van het bucketvenster (inclusief). Dagbucket: start == end. */
  start: string;
  end: string;
  /** Weekbucket: som van de belasting over de week. Dagbucket: gelijk aan `peakDayLoad`. */
  load: number;
  /** Hoogste dag-belasting binnen het venster (dagbucket: gelijk aan `load`). */
  peakDayLoad: number;
  /** Som van de capaciteit over ÁLLE werkdagen van het bucketvenster (ook onbelaste). */
  capacity: number;
  /** Dag-granulaire overbelaste dagen binnen het venster (altijd, ook in week-modus). */
  overallocatedDays: string[];
  /** Alleen aanwezig als `overallocatedDays` niet leeg is: de veroorzakende assignments. */
  causes?: HistogramCause[];
}

export interface HistogramReport {
  resources: Array<{ resourceId: string; buckets: HistogramBucket[] }>;
}

export interface HistogramInput {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
  resources: Resource[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  cpmResult: CPMResult | null;
  /** Alleen deze resources rapporteren (volgorde = `resources`-volgorde). Leeg/undefined = alle. */
  resourceIds?: string[];
  /** Vensterstart/-einde (ISO). Default = projectspanne uit de taakdatums (min earlyStart..max earlyFinish). */
  from?: string;
  to?: string;
  bucket: 'dag' | 'week';
}

/**
 * Bereken het histogram-rapport (zie blokcommentaar hierboven). Deelt de atomaire bouwsteen
 * `distributeUnits` + werkdag-mapping met `computeResourceLoad`, zodat load én attributie exact
 * consistent zijn; capaciteit is een aparte venster-enumeratie.
 */
export function computeHistogramReport(input: HistogramInput): HistogramReport {
  const { tasks, assignments, resources, calendar, calendars, resourceIds, from, to, bucket } = input;

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const projectEngine = new CalendarEngine(calendarForEngine(calendar));
  // W0: zelfde taakkalender-mapping als computeResourceLoad (zie `engineForTask` hierboven) — één
  // definitie, gecachet per calendarId voor deze aanroep.
  const taskEngineCache = new Map<string, CalendarEngine>();

  // 1. Per-assignment dag-verdeling — dezelfde filter/mapping als computeResourceLoad (leaf, geen
  //    milestone), zodat de veroorzaker-bijdragen exact optellen tot de per-resource-dagbelasting.
  interface AssignDaily {
    assignmentId: string;
    taskId: string;
    resourceId: string;
    daily: Map<string, number>;
  }
  const perAssignment: AssignDaily[] = [];
  const contourOf = contourLookup(assignments);
  for (const a of assignments) {
    const task = taskById.get(a.taskId);
    if (!task || task.isMilestone || isSummaryTask(task)) continue;
    const taskEngine = engineForTask(task, taskEngineCache, projectEngine, calendars, calendar);
    const dist = assignmentDayUnits(task, a, taskEngine.hoursPerDay * 60, contourOf(task, a));
    if (dist.length === 0) continue;
    const durationDays = Math.max(task.time.scheduleDuration, dist.length);
    const workDayIsos = taskWorkDayIsos(task, taskEngine, durationDays);
    const daily = new Map<string, number>();
    for (let i = 0; i < dist.length && i < workDayIsos.length; i++) {
      const iso = workDayIsos[i];
      daily.set(iso, (daily.get(iso) ?? 0) + dist[i]);
    }
    perAssignment.push({ assignmentId: a.id, taskId: a.taskId, resourceId: a.resourceId, daily });
  }

  // Per-resource dag-belasting = som over de assignments van die resource.
  const loadByResource = new Map<string, Map<string, number>>();
  for (const pa of perAssignment) {
    let m = loadByResource.get(pa.resourceId);
    if (!m) { m = new Map(); loadByResource.set(pa.resourceId, m); }
    for (const [iso, u] of pa.daily) m.set(iso, (m.get(iso) ?? 0) + u);
  }

  // 2. Vensterspanne — default uit de taakdatums (min earlyStart .. max earlyFinish).
  let fromIso = from;
  let toIso = to;
  if (!fromIso || !toIso) {
    let minS: string | undefined;
    let maxF: string | undefined;
    for (const t of tasks) {
      const es = t.time.earlyStart;
      const ef = t.time.earlyFinish;
      if (es && (!minS || es < minS)) minS = es;
      if (ef && (!maxF || ef > maxF)) maxF = ef;
    }
    fromIso = fromIso ?? minS;
    toIso = toIso ?? maxF;
  }

  // 3. Bucketvensters — dichte tegeling van [from,to]. Week = ISO-week (ma..zo); dag = één dag.
  const windows: Array<{ start: string; end: string }> = [];
  if (fromIso && toIso && fromIso <= toIso) {
    const toDate = parseDate(toIso);
    if (bucket === 'week') {
      let ws = getWeekStart(parseDate(fromIso)); // maandag van de week rond `from`
      let guard = 0;
      while (ws <= toDate && guard++ < 100_000) {
        const we = addCalendarDays(ws, 6);
        windows.push({ start: formatDate(ws), end: formatDate(we) });
        ws = addCalendarDays(ws, 7);
      }
    } else {
      let d = parseDate(fromIso);
      let guard = 0;
      while (d <= toDate && guard++ < 1_000_000) {
        const iso = formatDate(d);
        windows.push({ start: iso, end: iso });
        d = addCalendarDays(d, 1);
      }
    }
  }

  // 4. Rapport per (gescopete) resource.
  const idSet = resourceIds && resourceIds.length > 0 ? new Set(resourceIds) : null;
  const reported = idSet ? resources.filter(r => idSet.has(r.id)) : resources;

  const report: HistogramReport = { resources: [] };
  for (const resource of reported) {
    const dailyLoad = loadByResource.get(resource.id) ?? new Map<string, number>();
    const engine = new CalendarEngine(calendarForEngine(
      resolveCalendar(resource.calendarId, calendars, calendar),
    ));

    // Dag-granulaire overbelaste dagen: load > capaciteit (resource-kalender), over de belaste dagen.
    const overDays = new Set<string>();
    for (const [iso, l] of dailyLoad) {
      const cap = engine.isWorkDay(parseDate(iso)) ? maxUnitsOn(resource, iso) : 0;
      if (l > cap) overDays.add(iso);
    }
    const resAssignments = perAssignment.filter(pa => pa.resourceId === resource.id);

    const buckets: HistogramBucket[] = [];
    for (const w of windows) {
      let load = 0;
      let peak = 0;
      for (const [iso, l] of dailyLoad) {
        if (iso >= w.start && iso <= w.end) {
          load += l;
          if (l > peak) peak = l;
        }
      }
      // Venster-capaciteit: EIGEN enumeratie over álle werkdagen van het venster (ook onbelaste).
      let capacity = 0;
      for (const iso of enumerateWorkDays(engine, w.start, w.end)) capacity += maxUnitsOn(resource, iso);

      const overInWin = [...overDays].filter(iso => iso >= w.start && iso <= w.end).sort();
      const b: HistogramBucket = {
        start: w.start,
        end: w.end,
        load,
        peakDayLoad: peak,
        capacity,
        overallocatedDays: overInWin,
      };
      if (overInWin.length > 0) {
        const causes: HistogramCause[] = [];
        for (const pa of resAssignments) {
          let contribution = 0;
          for (const iso of overInWin) contribution += pa.daily.get(iso) ?? 0;
          if (contribution > 0) causes.push({ assignmentId: pa.assignmentId, taskId: pa.taskId, contribution });
        }
        if (causes.length > 0) b.causes = causes;
      }
      buckets.push(b);
    }
    report.resources.push({ resourceId: resource.id, buckets });
  }

  return report;
}

/** Alle werkdagen (volgens `engine`) tussen `startIso` en `finishIso`, inclusief. Geëxporteerd
 *  voor hergebruik door de nivelleerder (dag-mapping van een taak op de projectkalender). */
export function enumerateWorkDays(engine: CalendarEngine, startIso: string, finishIso: string): string[] {
  const start = parseDate(startIso);
  const finish = parseDate(finishIso);
  const isos: string[] = [];
  let current = new Date(start.getTime());
  let guard = 0;
  const MAX_DAYS = 200_000; // zelfde veiligheidsgrens als CalendarEngine
  while (current <= finish) {
    if (engine.isWorkDay(current)) isos.push(formatDate(current));
    current = addCalendarDays(current, 1);
    if (++guard > MAX_DAYS) break;
  }
  return isos;
}
