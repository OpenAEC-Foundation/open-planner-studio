import type { LibraryOrigin } from '@/types/library';

/** Geldige capaciteit/eenheden: strikt positief en eindig. 0 is nooit zinvol (een resource die 0
 *  eenheden kan leveren, of een toewijzing van 0/dag). Fracties zijn toegestaan
 *  (materiaal-max.eenheden, halve-dag-toewijzingen). */
export function isValidUnits(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

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
  /** @deprecated vervangen door `maxUnits`. Alleen gelezen bij migratie van oude bestanden/state;
   *  nieuwe code schrijft dit veld niet meer. */
  availability?: number;
  /** Capaciteit per werkdag (P6/MSP "Max Units"): 1 = 100% (één persoon/stuk), 3 = drie eenheden. */
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
  /** Weergavekleur (hex `#rrggbb`) voor de resource-kleurmodi in de rapportexport. Puur
   *  presentatie: zit bewust NIET in RESOURCE_DIFF_FIELDS — een andere kleur is nooit een
   *  bibliotheekafwijking — en heeft géén invloed op planning/berekening. */
  color?: string;
  /** Herkomststempel wanneer deze resource een kopie uit een resourcebibliotheek is. Afwezig ⇒
   *  handmatig aangemaakte resource. */
  libraryOrigin?: LibraryOrigin;
}

export type ResourceCurve = 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK' | 'DOUBLE_PEAK' | 'TURTLE';

/** Alle `ResourceCurve`-waarden, in de vaste weergavevolgorde (keuzelijsten, schema-enum, meldingen). */
export const RESOURCE_CURVES: readonly ResourceCurve[] = [
  'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK', 'DOUBLE_PEAK', 'TURTLE',
];

/** Is `v` een geldige `ResourceCurve` (hoofdlettergevoelig)? */
export function isResourceCurve(v: unknown): v is ResourceCurve {
  return typeof v === 'string' && (RESOURCE_CURVES as readonly string[]).includes(v);
}

export interface ResourceAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  /** Eenheden per werkdag (P6 Units/Time, MSP Units): 1 = 100% (één persoon), 0.5 = halve dag.
   *  Werk = duur × unitsPerDay, tenzij de `*WorkMinutes`-velden hieronder het vastleggen. */
  unitsPerDay: number;
  /** Verdeelcurve over de duur (P6 resource curves, vereenvoudigd). undefined = UNIFORM. */
  curve?: ResourceCurve;
  /** De EXACTE 21-punts curve van deze toewijzing zoals P6 (`<ResourceCurve>`, `Value0`..`Value100`)
   *  of MSPDI (een `WorkContour`-vorm zonder OPS-`curve`-lid, zoals Double Peak/Turtle) die aanlevert:
   *  index 0 is 0, indices 1..20 het percentage werk in elke 5%-slice van de duur (de vorm van
   *  `CONTOUR_SHAPE_VALUES`, `contourEngine.ts`). AANWEZIG ⇒ de lastberekening (`assignmentDayUnits`,
   *  `ResourceLoad.ts`) verdeelt hiermee, zonder de hele-eenhedenafronding van de formule; `curve`
   *  blijft de UI-benadering (bv. P6 "Front Loaded" ⇒ `curve: 'FRONT_LOADED'` én de P6-waarden hier).
   *  Gewist zodra de gebruiker `curve` wijzigt (`resourceSlice.updateAssignment`). Round-tript via het
   *  `OPS_Timephased`-pset (`writeTimephasedMeta`, `ifcWriter.ts`) en native via P6. */
  curveValues?: number[];
  /** Timephased-venster van deze toewijzing (MS Project "contouring"), ISO-datum(tijd). Puur
   *  informatief; de solver leest het niet. De `.mpp`-lezer vult het best-effort met de taakbrede
   *  `timephasedStartAnchor`/`timephasedFinishFloor` op elke toewijzing van zo'n taak; round-tript
   *  door IFC. Afwezig ⇒ geen venster. */
  workWindowStart?: string;
  /** Zie `workWindowStart`. Afwezig ⇒ geen venster. */
  workWindowFinish?: string;
  /** BEGROOT werk in werkminuten (MSP Work, P6 Planned
   *  Units, XER target_qty). Referentie; wordt door de werkdriehoek nooit herschreven. Afwezig ⇒
   *  afgeleid als verricht + resterend. Round-tript in het `OPS_Timephased`-JSON-blob. */
  plannedWorkMinutes?: number;
  /** VERRICHT werk in werkminuten (MSP Actual Work, P6 Actual Units, XER
   *  act_reg_qty + act_ot_qty). Een feit: geen planningsbewerking raakt het. Afwezig ⇒ de som van
   *  de `actual`-periodes van de contour, anders 0. */
  actualWorkMinutes?: number;
  /** RESTEREND werk in werkminuten (MSP Remaining Work, P6 Remaining Units, XER remain_qty). Het
   *  getal waar de werkdriehoek op werkt. Afwezig ⇒ afgeleid als restduur × `unitsPerDay`; een
   *  werkbeschermende regel legt het vast zodra ze het nodig heeft (`workTriangle.ts`). */
  remainingWorkMinutes?: number;
}
