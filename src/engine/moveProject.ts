import type { Project } from '@/types/project';
import type { Task, TaskTime, TaskConstraint, ExternalLink } from '@/types/task';
import type { Resource, AvailabilityStep } from '@/types/resource';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { WorkCalendar } from '@/types/calendar';
import type { CustomFieldDef } from '@/types/structure';
import {
  parseInstant, formatInstant, addCalendarDays, diffDays, parseDate, type DateMode,
} from '@/utils/dateUtils';

/**
 * "Project verplaatsen" (pakket D1) — PURE domeintransformatie, geen store-import.
 * Precedent: `src/engine/externalLinks.ts`. Gedeeld door de preview (droogrun) én de commit, zodat
 * die twee per constructie niet kunnen divergeren.
 *
 * KERNMODEL (ontwerpbesluit 2 uit
 * `docs/superpowers/specs/2026-07-20-move-project-design.md`): de PLANNING schuift met Δ
 * kalenderdagen, de KALENDERS schuiven NIET. Feestdagen/bouwvak/winterstop liggen op absolute
 * datums, dus na de verschuiving vallen ze op andere plekken in het netwerk en kan het projectEINDE
 * met een ánder aantal kalenderdagen opschuiven dan Δ. Dat is geen bug maar het hele punt; de
 * preview maakt het zichtbaar.
 *
 * TWEEDE KERNPUNT: `project.startDate` is NIET het reken-anker van de CPM. De forward pass leidt de
 * projectstart af uit `time.scheduleStart` van de taken zónder voorganger (`CPMSolver.ts`), dus
 * alleen de projectdatum zetten doet níéts aan de planning — élk taakanker moet mee.
 */

// ---------------------------------------------------------------------------
// Veld-verdicten: de volledigheids-assertie (§1.11 van het ontwerp)
// ---------------------------------------------------------------------------

/**
 * Wat gebeurt er met een veld bij een verschuiving?
 *  - `shift`   — de shift-helper schrijft dit veld met `+Δ` kalenderdagen.
 *  - `keep`    — bewust overgeslagen; blijft op zijn absolute waarde staan.
 *  - `derived` — wordt door de aansluitende `runCPM`/`recomputeResourceLoad` overschreven; zelf
 *                schuiven zou hoogstens één frame een verkeerde balk tonen en solver-fouten maskeren.
 *  - `n/a`     — geen datum (identiteit, duur, enum, vlag, getal, verwijzing).
 */
type MoveVerdict = 'shift' | 'keep' | 'derived' | 'n/a';

/**
 * DE veldtabellen. Elke `satisfies Record<keyof X, MoveVerdict>` is een COMPILE-TIME
 * volledigheidscheck (zelfde truc als `DOCUMENT_FIELDS` in `documentContract.ts`): voeg je een veld
 * toe aan `TaskTime`/`Task`/`Project`/`Resource`/`Baseline` zonder het hier een verdict te geven,
 * dan faalt `tsc`. Dat is de enige manier waarop deze inventarisatie niet stil veroudert — één
 * vergeten datumveld is stille datacorruptie.
 *
 * De tabellen zijn puur documentatie-met-tanden: de shift-functies hieronder implementeren ze met de
 * hand (een generieke sleutel-lus zou de vorm-discriminatie en de geneste structuren verliezen).
 */
const TASK_TIME_VERDICTS = {
  durationType: 'n/a',            // enum
  scheduleDuration: 'n/a',        // duur in werkdagen
  durationMinutes: 'n/a',         // duur in minuten
  scheduleStart: 'shift',         // HET anker: de solver leest dit voor taken zonder voorganger
  scheduleFinish: 'shift',        // fallback-lezers (viewport/externe links/ifcWriter planEnd)
  earlyStart: 'derived',
  earlyFinish: 'derived',
  lateStart: 'derived',
  lateFinish: 'derived',
  freeFloat: 'derived',
  totalFloat: 'derived',
  isCritical: 'derived',
  interferingFloat: 'derived',
  isNearCritical: 'derived',
  floatPath: 'derived',
  actualStart: 'shift',           // R5 — schuift mee mét de statusdatum, zodat de voortgangs-vloer klopt
  actualFinish: 'shift',          // R5
  actualDuration: 'n/a',          // duur
  remainingTime: 'n/a',           // duur
  remainingMinutes: 'n/a',        // duur
  completion: 'n/a',              // fractie
} satisfies Record<keyof TaskTime, MoveVerdict>;

const TASK_VERDICTS = {
  id: 'n/a', name: 'n/a', description: 'n/a', wbsCode: 'n/a', taskType: 'n/a', status: 'n/a',
  isMilestone: 'n/a', milestoneKind: 'n/a', mandatory: 'n/a', priority: 'n/a',
  levelingDelay: 'n/a',           // vertraging in werkdagen (relatief)
  parentId: 'n/a', childIds: 'n/a',
  time: 'shift',                  // zie TASK_TIME_VERDICTS
  resourceIds: 'n/a', color: 'n/a', activityCodes: 'n/a',
  customFields: 'keep',           // §1.7 — een 'date'-gebruikersveld heeft onbekende semantiek
  constraint: 'shift',            // .date schuift; .type/.hard niet (R4)
  constraint2: 'shift',           // fase 2.9 — VERGEET DEZE NIET
  isHammock: 'n/a',               // duur wordt afgeleid uit de drivers; geen eigen datum die telt
  externalLinks: 'shift',         // .anchorDate schuift (R6); lag/sourceRef/sourceMissing niet
  deadline: 'shift',
  calendarId: 'n/a',              // verwijzing; de kalender zelf schuift niet (§1.4)
  notes: 'n/a',                   // {id,text,done}
} satisfies Record<keyof Task, MoveVerdict>;

const TASK_CONSTRAINT_VERDICTS = {
  type: 'n/a',
  date: 'shift',
  hard: 'n/a',                    // R4: de VLAG blijft, de DATUM eronder schuift mee
} satisfies Record<keyof TaskConstraint, MoveVerdict>;

const EXTERNAL_LINK_VERDICTS = {
  id: 'n/a', direction: 'n/a', relType: 'n/a',
  lagDays: 'n/a', lagMinutes: 'n/a',
  anchorDate: 'shift',            // R6
  sourceRef: 'n/a',
  sourceMissing: 'n/a',           // betekent "bron niet vindbaar", NIET "anker verouderd" — niet zetten
} satisfies Record<keyof ExternalLink, MoveVerdict>;

const PROJECT_VERDICTS = {
  id: 'n/a', name: 'n/a', description: 'n/a',
  startDate: 'shift',             // het referentiepunt zelf (exact op newStartDate gezet)
  endDate: 'shift',               // vrij metadataveld; leeg blijft leeg
  calendarId: 'n/a',
  createdAt: 'keep',              // bestandshistorie, geen planningsdatum
  modifiedAt: 'keep',             // wél op `now` gezet door de store-actie, niet met Δ
  author: 'n/a', company: 'n/a', wbsAutoNumber: 'n/a',
  statusDate: 'shift',            // P6 data date (R5)
  progressMode: 'n/a', schedulingOptions: 'n/a',
} satisfies Record<keyof Project, MoveVerdict>;

const RESOURCE_VERDICTS = {
  id: 'n/a', name: 'n/a', type: 'n/a', description: 'n/a', costPerHour: 'n/a',
  availability: 'n/a', maxUnits: 'n/a', calendarId: 'n/a',
  availabilitySteps: 'shift',     // .from schuift: effective-dated capaciteit is PROJECT-planning
  unitOfMeasure: 'n/a', parentId: 'n/a',
} satisfies Record<keyof Resource, MoveVerdict>;

const AVAILABILITY_STEP_VERDICTS = {
  from: 'shift',
  maxUnits: 'n/a',
} satisfies Record<keyof AvailabilityStep, MoveVerdict>;

const BASELINE_VERDICTS = {
  id: 'n/a', name: 'n/a',
  createdAt: 'keep',              // archiefdatum — ook NIET bij shiftBaselines:true
  tasks: 'shift',                 // alleen bij shiftBaselines:true
  projectEnd: 'shift',            // idem
  projectDuration: 'n/a',         // duur
} satisfies Record<keyof Baseline, MoveVerdict>;

const BASELINE_TASK_VERDICTS = {
  taskId: 'n/a',
  start: 'shift', finish: 'shift',
  duration: 'n/a', isMilestone: 'n/a', milestoneKind: 'n/a',
} satisfies Record<keyof BaselineTask, MoveVerdict>;

// De tabellen bestaan om te COMPILEREN, niet om gelezen te worden op runtime.
void TASK_TIME_VERDICTS; void TASK_VERDICTS; void TASK_CONSTRAINT_VERDICTS;
void EXTERNAL_LINK_VERDICTS; void PROJECT_VERDICTS; void RESOURCE_VERDICTS;
void AVAILABILITY_STEP_VERDICTS; void BASELINE_VERDICTS; void BASELINE_TASK_VERDICTS;

// ---------------------------------------------------------------------------
// Primitieven
// ---------------------------------------------------------------------------

export interface MoveProjectOptions {
  /** Baselines mee verschuiven. Default false (§1.6): een baseline bestaat om AFWIJKING te meten,
   *  dus hem stilzwijgend meeschuiven wist precies het signaal waarvoor hij is aangemaakt. */
  shiftBaselines?: boolean;
}

/**
 * VORMBEHOUDENDE shift van één ISO-waarde (§2). De modus wordt uit de STRING afgeleid, niet uit de
 * kalender: `project.statusDate` mag datetime zijn óók op een dag-kalender, en een gemengd
 * dag/uur-document (`ui.allowMixedDayHour`) heeft per taak een andere vorm — afleiden uit de
 * effectieve kalender zou daar fout gaan, afleiden uit de string is per definitie correct.
 *
 * Δ is ALTIJD een geheel aantal kalenderdagen, ook in uur-modus: de gebruiker kiest een nieuwe
 * start*datum*, niet een nieuw start*moment*. `addCalendarDays` gebruikt `setUTCDate` en de engine
 * rekent in UTC zonder DST, dus `HH:mm` blijft gegarandeerd ongemoeid. Er wordt bewust NIET naar het
 * eerstvolgende werkmoment gesnapt — dat is solver-werk (`snapOnOrAfter` in de forward pass), en een
 * deadline "vrijdag 16:00" die stilzwijgend "maandag 08:00" wordt is datacorruptie zonder eigen undo.
 *
 * Leeg (`''`/undefined) of onparseerbaar (corrupte import) ⇒ onveranderd terug.
 */
export function shiftIso(iso: string, deltaDays: number): string;
export function shiftIso(iso: string | undefined, deltaDays: number): string | undefined;
export function shiftIso(iso: string | undefined, deltaDays: number): string | undefined {
  if (!iso) return iso;
  if (!Number.isFinite(deltaDays) || deltaDays === 0) return iso;
  const mode: DateMode = iso.includes('T') ? 'hour' : 'day';
  const d = parseInstant(iso);
  if (isNaN(d.getTime())) return iso;
  return formatInstant(addCalendarDays(d, deltaDays), mode);
}

/** Δ in kalenderdagen tussen de huidige en de nieuwe projectstart.
 *  `NaN` bij een lege/onparseerbare datum aan een van beide kanten (R9). */
export function computeMoveDelta(currentStart: string | undefined, newStart: string | undefined): number {
  if (!currentStart || !newStart) return NaN;
  const d = diffDays(currentStart, newStart);
  return Number.isFinite(d) ? d : NaN;
}

/** Is dit een bruikbare, parseerbare ISO-datum? */
function isUsableIso(iso: string | undefined): iso is string {
  return !!iso && !isNaN(parseInstant(iso).getTime());
}

// ---------------------------------------------------------------------------
// Pure shift-functies — geven NIEUWE objecten terug, muteren niets
// ---------------------------------------------------------------------------

function shiftConstraint(c: TaskConstraint | undefined, delta: number): TaskConstraint | undefined {
  if (!c) return c;
  if (c.date === undefined) return { ...c };   // ASAP/ALAP: geen datum ⇒ no-op
  return { ...c, date: shiftIso(c.date, delta) };
}

/**
 * Schuif één taak. Raakt ELKE `shift`-cel uit `TASK_VERDICTS`/`TASK_TIME_VERDICTS`; de `derived`-
 * velden blijven ongemoeid (`runCPM` overschrijft ze).
 *
 * LET OP — `time` wordt ALTIJD gekopieerd, óók als er niets aan verandert. De preview-droogrun geeft
 * het resultaat aan een verse `CPMSolver`, en die SCHRIJFT in de hammock-tak
 * `task.time.scheduleDuration`/`durationMinutes` terug op het meegegeven object. Een latere
 * "optimalisatie" die de `time`-referentie hergebruikt wanneer er geen datum wijzigt, zou de
 * store-objecten laten muteren door een preview die niets hoort te muteren. Niet doen.
 */
export function shiftTask(task: Task, delta: number): Task {
  const t = task.time;
  const next: Task = {
    ...task,
    time: {
      ...t,
      scheduleStart: shiftIso(t.scheduleStart, delta),
      scheduleFinish: shiftIso(t.scheduleFinish, delta),
      actualStart: shiftIso(t.actualStart, delta),
      actualFinish: shiftIso(t.actualFinish, delta),
    },
  };
  if (task.constraint) next.constraint = shiftConstraint(task.constraint, delta);
  if (task.constraint2) next.constraint2 = shiftConstraint(task.constraint2, delta);
  if (task.deadline !== undefined) next.deadline = shiftIso(task.deadline, delta);
  if (task.externalLinks) {
    next.externalLinks = task.externalLinks.map((l) => ({
      ...l,
      anchorDate: shiftIso(l.anchorDate, delta),
      // sourceMissing BEWUST ongemoeid (R6): dat veld betekent "bron niet vindbaar", niet
      // "anker verouderd"; misbruiken zou de ghost-weergave vervuilen.
    }));
  }
  return next;
}

/** Schuif de drie project-DATUMS. `startDate` wordt door de aanroeper daarna exact op de gekozen
 *  datum gezet (geen afrondingsdrift); `createdAt`/`modifiedAt` blijven buiten schot. */
export function shiftProjectDates(project: Project, delta: number): Project {
  const next: Project = {
    ...project,
    startDate: shiftIso(project.startDate, delta),
    endDate: shiftIso(project.endDate, delta),   // '' blijft ''
  };
  if (project.statusDate !== undefined) next.statusDate = shiftIso(project.statusDate, delta);
  return next;
}

/** Schuif de effective-dated capaciteitsstappen van één resource. */
export function shiftResource(resource: Resource, delta: number): Resource {
  if (!resource.availabilitySteps?.length) return { ...resource };
  return {
    ...resource,
    availabilitySteps: resource.availabilitySteps.map((s) => ({ ...s, from: shiftIso(s.from, delta) })),
  };
}

/** Schuif één baseline (alleen aanroepen bij `shiftBaselines: true`). `createdAt` blijft staan —
 *  dat is wannéér de snapshot genomen is, een archiefdatum. */
export function shiftBaseline(baseline: Baseline, delta: number): Baseline {
  return {
    ...baseline,
    projectEnd: shiftIso(baseline.projectEnd, delta),
    tasks: baseline.tasks.map((bt) => ({
      ...bt,
      start: shiftIso(bt.start, delta),
      finish: shiftIso(bt.finish, delta),
    })),
  };
}

// ---------------------------------------------------------------------------
// Impact-telling voor de preview (§7.4) — puur, geen solve
// ---------------------------------------------------------------------------

export interface MoveImpact {
  /** Taken met minstens één verschuifbare datum. */
  taskCount: number;
  /** Taken met een primaire en/of secundaire constraint-DATUM. */
  constraintCount: number;
  /** Taken met een harde Mandatory-pin (R4) — hun pin verschuift mee. */
  hardPinCount: number;
  deadlineCount: number;
  /** Taken met actualStart en/of actualFinish (R5). */
  actualCount: number;
  /** Aantal externe koppelingen (R6) — anker schuift mee, bronproject niet. */
  externalLinkCount: number;
  availabilityStepCount: number;
  /** Ingevulde gebruikersvelden van type 'date' — deze schuiven BEWUST NIET (§1.7). */
  dateCustomFieldCount: number;
  baselineCount: number;
}

export function computeMoveImpact(
  tasks: Task[],
  resources: Resource[],
  baselines: Baseline[],
  customFieldDefs: CustomFieldDef[],
): MoveImpact {
  const dateDefIds = new Set(customFieldDefs.filter((d) => d.type === 'date').map((d) => d.id));
  const impact: MoveImpact = {
    taskCount: 0, constraintCount: 0, hardPinCount: 0, deadlineCount: 0, actualCount: 0,
    externalLinkCount: 0, availabilityStepCount: 0, dateCustomFieldCount: 0,
    baselineCount: baselines.length,
  };
  for (const t of tasks) {
    const hasConstraintDate = isUsableIso(t.constraint?.date) || isUsableIso(t.constraint2?.date);
    const hasDeadline = isUsableIso(t.deadline);
    const hasActual = isUsableIso(t.time.actualStart) || isUsableIso(t.time.actualFinish);
    const links = t.externalLinks?.filter((l) => isUsableIso(l.anchorDate)) ?? [];
    if (
      isUsableIso(t.time.scheduleStart) || isUsableIso(t.time.scheduleFinish) ||
      hasConstraintDate || hasDeadline || hasActual || links.length > 0
    ) impact.taskCount++;
    if (hasConstraintDate) impact.constraintCount++;
    if (t.constraint?.hard === true) impact.hardPinCount++;
    if (hasDeadline) impact.deadlineCount++;
    if (hasActual) impact.actualCount++;
    impact.externalLinkCount += links.length;
    for (const defId of dateDefIds) {
      const v = t.customFields?.[defId];
      if (v !== undefined && v !== null && v !== '') impact.dateCustomFieldCount++;
    }
  }
  for (const r of resources) {
    impact.availabilityStepCount += r.availabilitySteps?.length ?? 0;
  }
  return impact;
}

// ---------------------------------------------------------------------------
// R7 — dekking van de GEGENEREERDE feestdagen
// ---------------------------------------------------------------------------

export interface HolidayGapCalendar {
  name: string;
  /** De gematerialiseerde spanne (incl.) van deze kalender. */
  from: number;
  to: number;
  /** Het jaar waar de verplaatste planning tot loopt (of vanaf begint) en dat buiten de spanne valt. */
  year: number;
}

/**
 * R7 (verplichte preview-waarschuwing): `CalendarGeneration.generatedFromYear/ToYear` begrenst de
 * GEMATERIALISEERDE feestdagen (`computeGenerateSpan` geeft zonder einddatum `startjaar−1 …
 * startjaar+3`). Verplaats je een project een paar jaar vooruit, dan valt de nieuwe projectperiode
 * buiten die spanne en rekent de planning STIL zonder feestdagen. Dat moet zichtbaar zijn.
 *
 * Alleen kalenders MÉT `generation` doen mee — een handmatige/letterlijke kalender heeft geen
 * spanne-belofte en mag nooit "onvoldoende" heten.
 */
export function computeHolidayGaps(
  calendars: WorkCalendar[],
  newStartIso: string,
  newEndIso: string,
): HolidayGapCalendar[] {
  const yearOf = (iso: string): number | null => {
    if (!iso) return null;
    const d = parseDate(iso);
    return isNaN(d.getTime()) ? null : d.getUTCFullYear();
  };
  const startYear = yearOf(newStartIso);
  const endYear = yearOf(newEndIso) ?? startYear;
  if (startYear === null || endYear === null) return [];

  const seen = new Set<string>();
  const gaps: HolidayGapCalendar[] = [];
  for (const cal of calendars) {
    if (!cal?.generation) continue;
    if (seen.has(cal.id)) continue;
    seen.add(cal.id);
    const { generatedFromYear: from, generatedToYear: to } = cal.generation;
    if (endYear > to) gaps.push({ name: cal.name, from, to, year: endYear });
    else if (startYear < from) gaps.push({ name: cal.name, from, to, year: startYear });
  }
  return gaps;
}
