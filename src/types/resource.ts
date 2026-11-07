import type { LibraryOrigin } from '@/types/library';

/** Geldige capaciteit/eenheden: strikt positief en eindig. 0 is nooit zinvol (een resource die 0
 *  eenheden kan leveren, of een toewijzing van 0/dag). Fracties zijn toegestaan
 *  (materiaal-max.eenheden, halve-dag-toewijzingen). */
export function isValidUnits(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW' | 'COST';

/** Alle `ResourceType`-waarden, in de vaste weergavevolgorde (keuzelijsten, schema-enum). */
export const RESOURCE_TYPES: readonly ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW', 'COST'];

/** Kostenresource (issue #815): een vast, begroot bedrag per toewijzing (`costAmount`), zonder
 *  tarief, capaciteit, kalender, eenheid, ploeg of werk. Telt nooit mee voor belasting,
 *  overallocatie, histogram of nivelleren en stuurt nooit de duur. */
export function isCostResource(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return r?.type === 'COST';
}

/** Stuurt een toewijzing aan deze resource de taakduur (werkregelbrug)? Materiaal en kosten niet.
 *  Onbekende resource ⇒ telt als werkresource (het oude gedrag). Gebruik deze helper in plaats van
 *  een losse `!== 'MATERIAL'`-toets. */
export function resourceDrivesDuration(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return r ? r.type !== 'MATERIAL' && r.type !== 'COST' : true;
}

/** Heeft deze resource belasting (histogram, overallocatie, bezetting)? Alles behalve kosten. */
export function resourceHasLoad(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return !isCostResource(r);
}

/** De ids van de kostenresources (issue #815). */
export function costResourceIds(resources: readonly Pick<Resource, 'id' | 'type'>[]): Set<string> {
  const ids = new Set<string>();
  for (const r of resources) if (isCostResource(r)) ids.add(r.id);
  return ids;
}

/** De toewijzingen die meedoen aan de contourkoppeling (`matchContoursToAssignments`,
 *  `contourIndexForAssignment`, `contourLookup`): alles behalve kostentoewijzingen (issue #815). Een
 *  kostentoewijzing heeft geen urenverdeling. De legacy-terugval van de koppeling telt de lengte van
 *  de lijst, dus een kostentoewijzing erbij mag die lijst niet veranderen. Filter daarom ELKE lijst
 *  vóór de koppeling met deze functie; een toewijzing naar een onbekende resource blijft erin. */
export function contourSiblings<A extends Pick<ResourceAssignment, 'resourceId'>>(
  assignments: readonly A[],
  costIds: ReadonlySet<string>,
): A[] {
  return costIds.size === 0 ? [...assignments] : assignments.filter(a => !costIds.has(a.resourceId));
}

/** Kan deze resource genivelleerd worden (renewable)? Geen materiaal en geen kosten. */
export function resourceIsLevelable(r: Pick<Resource, 'type'>): boolean {
  return r.type !== 'MATERIAL' && r.type !== 'COST';
}

/** Geldig begroot bedrag van een kostentoewijzing: eindig en ≥ 0 (0 mag: "nog geen bedrag"
 *  is `undefined`, "gratis" is 0). */
export function isValidCostAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/** De velden die een kostenresource nooit draagt (tarief, kalender, stappen, eenheid, ploeg). Een
 *  typewissel naar COST wist ze en zet `maxUnits` op 1 (`clearCostResourceFields`). */
export const COST_RESOURCE_CLEARED_FIELDS = ['costPerHour', 'calendarId', 'availabilitySteps', 'unitOfMeasure', 'parentId'] as const;

/** Wist in-place de velden die een kostenresource niet heeft en zet `maxUnits` op 1. */
export function clearCostResourceFields(r: Resource): void {
  for (const k of COST_RESOURCE_CLEARED_FIELDS) delete r[k];
  delete r.availability;
  r.maxUnits = 1;
}

/** De werkvelden die nooit op een toewijzing aan een kostenresource staan. Lezers wissen ze, de
 *  store weigert ze. */
export const COST_ASSIGNMENT_WORK_FIELDS = [
  'plannedUnitsPerDay', 'curve', 'curveValues', 'workWindowStart', 'workWindowFinish',
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes',
] as const;

/** Maakt in-place een toewijzing aan een kostenresource schoon: geen werkvelden, inzet vast 1, en
 *  een ongeldig bedrag valt weg. Een toewijzing aan een andere resource verliest een `costAmount`. */
export function normalizeAssignmentForResource(a: ResourceAssignment, resource: Pick<Resource, 'type'> | undefined): void {
  if (isCostResource(resource)) {
    for (const k of COST_ASSIGNMENT_WORK_FIELDS) delete a[k];
    a.unitsPerDay = 1;
    if (a.costAmount !== undefined && !isValidCostAmount(a.costAmount)) delete a.costAmount;
  } else if (resource && a.costAmount !== undefined) {
    delete a.costAmount;
  }
}

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
   *  Werk = duur × unitsPerDay, tenzij de `*WorkMinutes`-velden hieronder het vastleggen. Bij een
   *  P6-toewijzing met restwerk is dit het RESTERENDE tempo (eigenaarsbesluit 2026-10-15); het
   *  begrote tempo staat dan in `plannedUnitsPerDay`. */
  unitsPerDay: number;
  /** OPTIONEEL — het BEGROTE tempo (P6 Planned Units/Time, XER `target_qty_per_hr`), zelfde schaal
   *  als `unitsPerDay`. Alleen aanwezig wanneer een P6-import het resterende tempo als `unitsPerDay`
   *  koos en dat afwijkt (`importedAssignmentRate`, `workRuleMapping.ts`). Referentie, zoals
   *  `plannedWorkMinutes`: geen bewerking leest of herschrijft het; de P6 XML-export schrijft het als
   *  `PlannedUnitsPerTime` (anders `unitsPerDay`). Afwezig ⇒ begroot tempo = `unitsPerDay`.
   *  Round-tript in het `OPS_Timephased`-JSON-blob. */
  plannedUnitsPerDay?: number;
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
  /** Het BEGROTE bedrag van deze toewijzing (issue #815), alleen op een toewijzing aan een
   *  kostenresource (`type: 'COST'`). Eindig en ≥ 0; zelfde kale valuta als `costPerHour`. Afwezig ⇒
   *  nog geen bedrag. Op een kostentoewijzing staat `unitsPerDay` vast op 1 en komt geen werkveld.
   *  Round-tript in het `OPS_Timephased`-JSON-blob. */
  costAmount?: number;
}
