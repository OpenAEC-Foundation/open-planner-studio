// Declaratief projectschema voor de voorbeeld-generator. Eén spec beschrijft taken, relaties,
// resources, kalender, activity codes en custom fields; de generator (generate-examples.ts)
// vertaalt dit naar echte store-acties. Constraint-/deadline-/stap-datums zijn WERKDAG-OFFSETS
// t.o.v. het projectanker (jaar-onafhankelijk), niet hardgecodeerde jaartallen.
import type { Holiday } from '@/types/calendar';

export interface CalSpec {
  workDays?: number[];        // 1=ma … 7=zo; default ma-vr
  name?: string;
  description?: string;
  extraHolidays?: Holiday[];  // bovenop de per-jaar berekende NL-feestdagen + bouwvak
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
}
