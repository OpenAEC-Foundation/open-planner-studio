// Declaratief projectschema voor de voorbeeld-generator. Eén spec beschrijft taken, relaties,
// resources, kalender, activity codes en custom fields; de generator (generate-examples.ts)
// vertaalt dit naar echte store-acties. Constraint-/deadline-/stap-datums zijn WERKDAG-OFFSETS
// t.o.v. het projectanker (jaar-onafhankelijk), niet hardgecodeerde jaartallen.
import type { SchedulingOptions } from '@/types/project';
import type { WorkTimeBands } from '@/types/calendar';
import type { ExternalLink } from '@/types/task';

export interface CalSpec {
  workDays?: number[];        // 1=ma … 7=zo; default ma-vr
  name?: string;
  description?: string;
  /** Ad-hoc extra vrije periode bovenop de per-jaar berekende NL-feestdagen + bouwvak (bv.
   *  vorstverlet). WERKDAG-offset + duur in KALENDERdagen — zelfde jaar-onafhankelijke conventie
   *  als de rest van het schema (vgl. `ResourceSpec.steps[].fromDay`); de generator zet dit om
   *  naar een absolute ISO-periode t.o.v. het projectanker (`gen-core.ts:buildCalendar`). */
  extraHolidays?: { name: string; fromDay: number; calendarDays: number }[];
  /** OPTIONEEL — per-weekdag werktijd-banden (fase 2.10, golf 2: uren-planning). Aanwezig ⇒
   *  UUR-kalender (`WorkCalendar.workTime`, `calendar.ts:17-19`); afwezig ⇒ dag-kalender
   *  (byte-identiek). Zie `ProjectSpec.calendars` voor hoe taken naar zo'n kalender verwijzen. */
  workTime?: WorkTimeBands;
}

export interface CodeTypeSpec {
  name: string;
  values: { code: string; description?: string; color?: string }[];
}

export interface FieldSpec {
  name: string;
  type: 'text' | 'number' | 'integer' | 'cost' | 'date' | 'boolean';
}

export interface ResourceSpec {
  name: string;
  type?: 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW';
  maxUnits?: number;
  description?: string;
  costPerHour?: number;
  unitOfMeasure?: string;      // alleen MATERIAL
  calendar?: CalSpec;          // eigen resource-kalender
  steps?: { fromDay: number; maxUnits: number }[]; // availabilitySteps (fromDay = werkdag-offset)
  parent?: string;             // naam van een CREW-resource (ploeg-lidmaatschap)
}

export interface AssignSpec {
  res: string;
  units: number;
  curve?: 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';
}

/** Soft-constraint-vorm: type + optionele werkdag-offset-datum. Gedeeld door primaire en
 *  secundaire constraint; `hard` bestaat UITSLUITEND op de primaire (`TaskSpec.constraint`) —
 *  het datamodel verbiedt een harde secundaire constraint (`task.ts:142-146`), dus
 *  `ConstraintSpec2` heeft bewust geen `hard`-veld. */
export interface ConstraintSpec2 { type: string; offsetDay?: number }
export interface ConstraintSpec extends ConstraintSpec2 {
  /** OPTIONEEL — logica-brekende Mandatory-pin (fase 2.9/2.10 golf 2), alleen zinvol bij
   *  MSO/MFO. Afwezig/false ⇒ P6-soft "Start On"/"Finish On" (bestaand gedrag). */
  hard?: boolean;
}

export interface TaskSpec {
  key: string;                 // unieke sleutel voor relaties
  name: string;
  dur?: number;                // werkdagen (default 5); genegeerd bij milestone
  /** OPTIONEEL — canonieke duur in MINUTEN (fase 2.10, golf 2: uren-planning). Alleen zinvol in
   *  combinatie met `calendarKey` naar een uur-kalender (`CalSpec.workTime`); op een dag-kalender
   *  wordt dit door de engine genegeerd (`TaskTime.durationMinutes`-invariant). Aanwezig ⇒
   *  overschrijft `dur` als bron van waarheid voor de duur. */
  durMinutes?: number;
  parent?: string;             // key van de WBS-ouder
  taskType?: string;
  milestone?: boolean;
  milestoneKind?: 'START' | 'FINISH';
  mandatory?: boolean;
  priority?: number;           // 0–1000; 1000 = "Do Not Level"
  constraint?: ConstraintSpec;                        // PRIMAIR; offsetDay = werkdagen ná anker
  /** OPTIONEEL — SECUNDAIRE constraint (fase 2.10, golf 2: `Task.constraint2`). Altijd soft. */
  constraint2?: ConstraintSpec2;
  /** OPTIONEEL — hammock/LOE (fase 2.10, golf 2: `Task.isHammock`). Span wordt AFGELEID uit
   *  gewone `LinkSpec`-relaties die op deze taak wijzen (FS/SS ⇒ start-driver, FF/SF ⇒
   *  finish-driver) — puur topologisch, geen apart "driver"-veld nodig. */
  hammock?: boolean;
  deadlineDay?: number;        // werkdagen ná anker
  codes?: Record<string, string>;                     // codeTypeName → valueCode
  fields?: Record<string, string | number | boolean>; // fieldName → waarde
  assign?: AssignSpec[];
  description?: string;
  /** OPTIONEEL — vrije aantekeningen/checklist (fase 2.10, item 1: `Task.notes`). De builder
   *  genereert de id's; hier alleen tekst + afvink-status. Afwezig ⇒ geen aantekeningen. */
  notes?: { text: string; done: boolean }[];
  /** OPTIONEEL — voortgang (fase 2.6, `TaskTime.completion`). 0..1. Wordt via de echte
   *  `setTaskProgress`-actie gezet (dwingt dezelfde invarianten af als de UI). */
  completion?: number;
  /** OPTIONEEL — werkelijke start, WERKDAG-offset t.o.v. het anker (zelfde conventie als
   *  `deadlineDay`/`constraint.offsetDay`). Via de echte `setActualStart`-actie. */
  actualStartDay?: number;
  /** OPTIONEEL — werkelijk einde, WERKDAG-offset t.o.v. het anker. Via de echte
   *  `setActualFinish`-actie (zet completion=1 + status COMPLETED). */
  actualFinishDay?: number;
  /** OPTIONEEL — "conform plan afgerond": neem werkelijke start/einde over uit de BEREKENDE,
   *  KALENDERBEWUSTE planning (`time.earlyStart`/`earlyFinish` op het moment dat de voortgang
   *  wordt toegepast) i.p.v. uit werkdag-offsets. `actualStartDay`/`actualFinishDay` worden dan
   *  genegeerd. Reden: `offset()` telt alleen weekenden weg (`addBusinessDays`), terwijl de
   *  projectkalender óók feestdagen/bouwvak kent — handmatige dag-indices leveren daardoor
   *  systematisch een schijn-UITLOOP op, en die uitloop verschijnt (terecht, P6-conform) als
   *  negatieve totale speling op de al voltooide keten: de solver pint een voltooide taak in de
   *  forward pass op zijn actuals, maar leidt LS/LF af uit het netwerk met de GEPLANDE duren. */
  actualsFromPlan?: boolean;
  /** OPTIONEEL — verwijst naar `ProjectSpec.calendars[key]` (fase 2.10, golf 2: uren-planning).
   *  Afwezig ⇒ projectkalender (bestaand gedrag). */
  calendarKey?: string;
  /** OPTIONEEL — externe (cross-project) koppeling (fase 2.10, golf 2). Vooraf-berekend: de
   *  generator bouwt eerst het bronbestand, leest het terug (`readIFC`) en bevriest het anker
   *  hierin — precies zoals de echte `ExternalLinkDialog`-flow. Doorgezet via de echte
   *  `addExternalLink`-actie (niet via `addTask`), zodat het exact het app-patroon volgt. */
  externalLink?: Omit<ExternalLink, 'id'>;
}

export interface LinkSpec {
  pred: string;
  succ: string;
  type?: 'FINISH_START' | 'START_START' | 'FINISH_FINISH' | 'START_FINISH';
  lag?: number;                // werkdagen; negatief = lead
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  lagPercent?: number;         // % van de voorgangerduur (sluit lag uit)
}

/** OPTIONEEL — declaratieve scope-mutatie tussen twee baselines (rebaseline-patroon, fase 2.10
 *  golf 2). Toegepast (in deze volgorde: taken → relaties → duurverlenging) ná de vorige
 *  baseline-snapshot en vóór de bijbehorende `runCPM()` + de volgende `saveBaseline()`. */
export interface ScopeMutationSpec {
  /** Extra taken (meerwerk); `parent`/links mogen verwijzen naar reeds bestaande keys. */
  addTasks?: TaskSpec[];
  addLinks?: LinkSpec[];
  /** Bestaande taak (key) krijgt een nieuwe duur (werkdagen) — bv. meerwerk-vertraging. */
  extendDurations?: { key: string; dur: number }[];
}

export interface BaselineSpec {
  name: string;
  /** OPTIONEEL — scope-mutatie vlak vóór déze baseline wordt opgeslagen (alleen zinvol op de
   *  2e+ entry — de eerste baseline is per definitie "vóór elke mutatie"). */
  mutationBefore?: ScopeMutationSpec;
}

export interface ProjectSpec {
  slug: string;                // bestandsnaam zonder .ifc
  name: string;
  author?: string;
  company?: string;
  description?: string;
  publicDescription?: string;  // manifest-omschrijving (benoemt wat de showcase demonstreert)
  category?: 'showcase' | 'basic' | 'external-source';
  tags?: string[];
  anchorShiftDays?: number;    // kalenderdagen-shift t.o.v. het standaardanker
  calendar?: CalSpec;
  /** OPTIONEEL — extra kalender-bibliotheek (fase 2.10, golf 2: uren-planning). Naam → CalSpec;
   *  taken verwijzen ernaar via `TaskSpec.calendarKey` (voor taak-specifieke uur-kalenders naast
   *  de dag-projectkalender). */
  calendars?: Record<string, CalSpec>;
  codeTypes?: CodeTypeSpec[];
  fields?: FieldSpec[];
  resources?: ResourceSpec[];
  tasks: TaskSpec[];
  links?: LinkSpec[];
  /** OPTIONEEL — project-scoped reken-opties (fase 2.10, golf 2: near-critical + float paths).
   *  Gezet via `setProject({ schedulingOptions })` vóór de (eerste) `runCPM()`. */
  schedulingOptions?: SchedulingOptions;
  /** OPTIONEEL — baseline(s), opgeslagen via de echte `saveBaseline`-actie; `writeIFC` krijgt ze
   *  mee als 10e/11e argument (`baselines`/`activeBaselineId`). Golf 1: enkelvoudige baseline
   *  (vóór eventuele voortgang/statusdatum-mutaties). Golf 2: `mutationBefore` op de 2e+ entry
   *  ondersteunt het rebaseline-patroon (Contract → meerwerk → Herbaseline). */
  baselines?: BaselineSpec[];
  /** OPTIONEEL — welke baseline (op naam) `activeBaselineId` wordt ná alle baselines/mutaties.
   *  Afwezig ⇒ bestaand gedrag (de LAATST opgeslagen baseline blijft actief, `saveBaseline`
   *  activeert altijd de nieuwste). */
  activeBaselineName?: string;
  /** OPTIONEEL — statusdatum (P6 data date, `Project.statusDate`), WERKDAG-offset t.o.v. het
   *  anker. Gezet via de echte `setStatusDate`-actie vóór de (tweede) `runCPM()`-run zodat
   *  voortgang/actuals correct doorwerken in de forward pass (data-date-gedreven herplanning). */
  statusDay?: number;
  /** OPTIONEEL — statusdatum AFGELEID uit de berekende planning i.p.v. uit een werkdag-offset:
   *  de statusdatum wordt het GEPLANDE einde van de taak met deze key. Zelfde kalenderbewuste
   *  bron als `TaskSpec.actualsFromPlan`, dus jaar- én feestdag-robuust: een hardgecodeerde
   *  `statusDay` verschuift zodra het generatiejaar een feestdag anders laat vallen. Heeft
   *  voorrang op `statusDay`. */
  statusFromPlanFinish?: string;
}
