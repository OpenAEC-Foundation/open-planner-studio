// Belasting-/overallocatie-engine (fase 2.5, resources-ontwerp §4). Twee bouwstenen:
// `distributeUnits` (curve-verdeling van eenheden over de duur van een toewijzing — de ENE
// functie die zowel het histogram als, straks, de nivelleerder voedt) en `computeResourceLoad`
// (dag-granulaire belasting/capaciteit/overallocatie over alle resources+toewijzingen).
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

/** Controlepunten per curve: (t ∈ [0,1] = positie in de duur, gewicht). Lineair geïnterpoleerd
 *  tussen punten; niet genormaliseerd (distributeUnits normaliseert zelf via Σraw). */
const CURVE_POINTS: Record<ResourceCurve, [number, number][]> = {
  UNIFORM: [[0, 1.0], [1, 1.0]],
  FRONT_LOADED: [[0, 1.0], [1, 0.2]],
  BACK_LOADED: [[0, 0.2], [1, 1.0]],
  BELL: [[0, 0.2], [0.5, 1.0], [1, 0.2]],
  EARLY_PEAK: [[0, 0.2], [1 / 3, 1.0], [1, 0.2]],
  LATE_PEAK: [[0, 0.2], [2 / 3, 1.0], [1, 0.2]],
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
  const raw: number[] = [];
  for (let i = 0; i < durationDays; i++) {
    const t = i / (durationDays - 1);
    raw.push(interpolate(points, t));
  }
  const sumRaw = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map(r => r / sumRaw);

  // Grootste-rest-methode: eerst afronden naar beneden, dan de grootste fractionele resten
  // ophogen tot de som weer exact `total` is. De precisie (hele eenheden bij een geheel totaal,
  // anders honderdsten) wordt bepaald in `largestRemainderRound` — zie het issue-#21-punt-7-
  // commentaar daar voor de motivering (hele mensen/machines per dag i.p.v. fracties).
  return largestRemainderRound(weights.map(w => w * total), total);
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

function largestRemainderRound(values: number[], targetSum: number): number[] {
  // issue #21 punt 7 — heeltallig verdelen i.p.v. fracties. Een resource-spreiding gaat over hele
  // mensen/machines per dag: een halve machinist of 0,67 kraan op één dag is praktisch onzin. Daarom
  // verdelen we in GEHELE eenheden per dag (scale=1) zodra het TOTAAL aantal eenheden
  // (unitsPerDay × durationDays = `targetSum`) nagenoeg geheel is. De grootste-rest-methode garandeert
  // dat de som EXACT op dat gehele totaal uitkomt (remainder = round(targetSum) − Σvloer). Is het totaal
  // daarentegen fractie (bv. 0,5/dag × 3 dagen = 1,5), dan kan het per definitie niet heeltallig worden
  // verdeeld zonder de som te breken — dan behouden we de honderdsten-precisie (scale=100) zodat de som
  // althans exact klopt op 2 decimalen. De drempel 1e-9 dekt floating-point-ruis uit unitsPerDay×duur.
  const scale = Math.abs(targetSum - Math.round(targetSum)) < 1e-9 ? 1 : 100;
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

/**
 * Berekent dag-granulaire belasting/capaciteit/overallocatie over alle resources+toewijzingen.
 * Logica (resources-ontwerp §4.2):
 *  1. Filter assignments op leaf-taken zonder milestone (defensieve dubbele bewaking t.o.v.
 *     de assignResource-enforcement — mocht een oud bestand toch een ongeldige assignment
 *     bevatten).
 *  2-3. Per assignment: verdeel de eenheden over de curve en accumuleer per resource per dag,
 *     gemapt op de werkdagen tussen earlyStart/earlyFinish volgens de PROJECTKALENDER (de
 *     CPM-datums — resource-kalenders sturen de CPM-datums niet aan).
 *  4. Capaciteit per resource per dag: maxUnits (met availabilitySteps) op werkdagen van de
 *     resource-kalender (of de projectkalender als geen calendarId gezet is), 0 op niet-werkdagen.
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
  const projectEngine = new CalendarEngine(projectCalendar);

  // 1. Leaf-only, geen mijlpalen (dubbele bewaking t.o.v. resourceSlice.assignResource, §2.4).
  const validAssignments = assignments.filter(a => {
    const task = taskById.get(a.taskId);
    return !!task && !task.isMilestone && task.childIds.length === 0;
  });

  // 2-3. Verdeel + accumuleer per resource per dag.
  for (const a of validAssignments) {
    const task = taskById.get(a.taskId)!;
    const durationDays = task.time.scheduleDuration;
    const days = distributeUnits(a.unitsPerDay, durationDays, a.curve ?? 'UNIFORM');
    if (days.length === 0) continue;

    const workDayIsos = enumerateWorkDays(projectEngine, task.time.earlyStart, task.time.earlyFinish);

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

    const engine = new CalendarEngine(resolveCalendar(resource.calendarId, resourceCalendars, projectCalendar));

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
