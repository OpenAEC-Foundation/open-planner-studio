// Declaratief projectschema voor de voorbeeld-generator. Eén spec beschrijft taken, relaties,
// resources, kalender, activity codes en custom fields; de generator (generate-examples.ts)
// vertaalt dit naar echte store-acties. Constraint-/deadline-/stap-datums zijn WERKDAG-OFFSETS
// t.o.v. het projectanker (jaar-onafhankelijk), niet hardgecodeerde jaartallen.

export interface CalSpec {
  workDays?: number[];        // 1=ma … 7=zo; default ma-vr
  name?: string;
  description?: string;
  /** Ad-hoc extra vrije periode bovenop de per-jaar berekende NL-feestdagen + bouwvak (bv.
   *  vorstverlet). WERKDAG-offset + duur in KALENDERdagen — zelfde jaar-onafhankelijke conventie
   *  als de rest van het schema (vgl. `ResourceSpec.steps[].fromDay`); de generator zet dit om
   *  naar een absolute ISO-periode t.o.v. het projectanker (`gen-core.ts:buildCalendar`). */
  extraHolidays?: { name: string; fromDay: number; calendarDays: number }[];
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

export interface TaskSpec {
  key: string;                 // unieke sleutel voor relaties
  name: string;
  dur?: number;                // werkdagen (default 5); genegeerd bij milestone
  parent?: string;             // key van de WBS-ouder
  taskType?: string;
  milestone?: boolean;
  milestoneKind?: 'START' | 'FINISH';
  mandatory?: boolean;
  priority?: number;           // 0–1000; 1000 = "Do Not Level"
  constraint?: { type: string; offsetDay?: number };  // offsetDay = werkdagen ná anker
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
}

export interface LinkSpec {
  pred: string;
  succ: string;
  type?: 'FINISH_START' | 'START_START' | 'FINISH_FINISH' | 'START_FINISH';
  lag?: number;                // werkdagen; negatief = lead
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  lagPercent?: number;         // % van de voorgangerduur (sluit lag uit)
}

export interface ProjectSpec {
  slug: string;                // bestandsnaam zonder .ifc
  name: string;
  author?: string;
  company?: string;
  description?: string;
  publicDescription?: string;  // manifest-omschrijving (benoemt wat de showcase demonstreert)
  category?: 'showcase' | 'basic';
  tags?: string[];
  anchorShiftDays?: number;    // kalenderdagen-shift t.o.v. het standaardanker
  calendar?: CalSpec;
  codeTypes?: CodeTypeSpec[];
  fields?: FieldSpec[];
  resources?: ResourceSpec[];
  tasks: TaskSpec[];
  links?: LinkSpec[];
  /** OPTIONEEL — baseline(s), opgeslagen ná de (eerste) `runCPM()` via de echte `saveBaseline`-
   *  actie; `writeIFC` krijgt ze mee als 10e/11e argument (`baselines`/`activeBaselineId`, al
   *  ondersteund door `ifcWriter.ts` maar tot nu toe nooit aangeroepen door de generator). Golf 1
   *  ondersteunt een enkelvoudige baseline (één entry, opgeslagen vóór eventuele voortgang/
   *  statusdatum-mutaties). GOLF 2 breidt dit array-patroon uit met een tussentijdse
   *  scope-mutatie tussen twee entries (rebaseline: baseline "Contract" → meerwerk → tweede
   *  `runCPM()` → baseline "Herbaseline") — de array-vorm is bewust gekozen zodat die stap later
   *  natuurlijk aansluit zonder het schema opnieuw te hoeven vormgeven. */
  baselines?: { name: string }[];
  /** OPTIONEEL — statusdatum (P6 data date, `Project.statusDate`), WERKDAG-offset t.o.v. het
   *  anker. Gezet via de echte `setStatusDate`-actie vóór de (tweede) `runCPM()`-run zodat
   *  voortgang/actuals correct doorwerken in de forward pass (data-date-gedreven herplanning). */
  statusDay?: number;
}
