import type { LibraryOrigin } from '@/types/library';

export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW';

export interface AvailabilityStep {
  /** ISO-datum: vanaf deze dag geldt maxUnits (P6 "Max Units/Time"-rijen, effective-dated). */
  from: string;
  maxUnits: number;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  costPerHour?: number;
  /** @deprecated vervangen door `maxUnits`. Alleen gelezen bij migratie van oude bestanden/state
   *  (zie fase 2.5-datamodel-ontwerp §2.4); nieuwe code schrijft dit veld niet meer. */
  availability?: number;
  /** Capaciteit per werkdag (P6/MSP "Max Units"): 1 = 100% (één persoon/stuk), 3 = drie eenheden.
   *  Vervangt `availability`. */
  maxUnits: number;
  /** Verwijst naar `resourceCalendars[].id`; undefined = projectkalender (`s.calendar`). Puur
   *  informatief: voedt alleen belasting/overallocatie, niet de CPM-datums. */
  calendarId?: string;
  /** Tijd-gefaseerde capaciteit (P6 Units-and-Prices-model, effective-dated). Leeg/undefined =
   *  vlakke `maxUnits` geldt altijd. Sorteren op `from`; de eerstvolgende stap ≤ peildatum geldt. */
  availabilitySteps?: AvailabilityStep[];
  /** Alleen materiaal: verplichte eenheid (P6 Unit of Measure / MSP Material Label). */
  unitOfMeasure?: string;
  /** Ploeg-lidmaatschap: verwijst naar een CREW-resource. Puur groepering/weergave — GEEN
   *  automatische rollup van capaciteit/belasting (P6-gedrag). */
  parentId?: string;
  /** Weergavekleur (hex `#rrggbb`) voor de resource-kleurmodi in de rapportexport (#21). Puur
   *  presentatie: zit bewust NIET in RESOURCE_DIFF_FIELDS — een andere kleur is nooit een
   *  bibliotheekafwijking — en heeft géén invloed op planning/berekening. */
  color?: string;
  /** OPTIONEEL — herkomststempel wanneer deze resource een kopie uit een bedrijfsbibliotheek is
   *  (spec B1, §2). Afwezig ⇒ handmatig aangemaakte resource. */
  libraryOrigin?: LibraryOrigin;
}

export type ResourceCurve = 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';

export interface ResourceAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  /** Eenheden per werkdag (P6 Units/Time, MSP Units): 1 = 100% (één persoon), 0.5 = halve dag.
   *  Vervangt `units`. Werk = duur(werkdagen) × unitsPerDay — altijd afgeleid, nooit opgeslagen. */
  unitsPerDay: number;
  /** Verdeelcurve over de duur (P6 resource curves, vereenvoudigd). undefined = UNIFORM. */
  curve?: ResourceCurve;
  /** OPTIONEEL — timephased-venster van deze toewijzing (MS Project "contouring", etappe "nul
   *  afwijkingen" Z0, voorlopig ONGEBRUIKT: geen lezer vult dit, geen solver-stap raadpleegt het).
   *  ISO-datum(tijd); precedent voor "effective-dated venster op een resource-object":
   *  `Resource.availabilitySteps`. Afwezig ⇒ geen venster (byte-identiek). */
  workWindowStart?: string;
  /** OPTIONEEL — zie `workWindowStart`. Afwezig ⇒ geen venster (byte-identiek). */
  workWindowFinish?: string;
}
