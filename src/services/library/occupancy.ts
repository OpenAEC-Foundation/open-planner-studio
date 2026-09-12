// B1b — pure bezettingskern (spec 2026-08-14-b1b-bezettingsoverzicht-design.md §4/§6).
// Aggregeert, binnen één resourcebibliotheek, de boekingen van álle aangeleverde documenten per
// poolitem per ISO-dag, en markeert de dagen waarop de som boven de bedrijfscapaciteit uitkomt
// (dubbelbezetting). Volledig puur en headless testbaar (tests/library/check-occupancy.ts): geen
// store, geen I/O — de weergavelaag (ResourceOccupancyView) mapt payload-snapshots naar
// `OccupancyDocInput` en rendert het resultaat.
//
// Per NIET-STALE document draait bewust de bestaande `computeResourceLoad` op de payload-velden —
// dezelfde curve-verdeling (`distributeUnits`), leaf-filter en werkdag-mapping als het histogram,
// dus per-document exact consistente cijfers. Er wordt NIET geleund op een opgeslagen
// `resourceLoadResult` in de payload: dat kan achterlopen op ververste resources/kalenders
// (zie het commentaar bij `switchDocument` in documentSlice); vers rekenen is goedkoop (§7) en
// altijd juist t.o.v. wat de payload bevat.
//
// STALE documenten worden EFEMEER DOORGEREKEND (§4.3b, besluit eigenaar 2026-08-14): vóór de
// aggregatie draait `solveProject` op een KLOON van de taken van dat document, zodat het met
// actuele datums gewoon meetelt (`counted: true`) — de payload/store blijft onaangeraakt en het
// document zelf toont zijn oude datums tot de gebruiker echt F5 drukt. `scheduleStale` blijft op de
// booking staan als INFORMATIEVE markering ("het overzicht rekent alvast met de actuele invoer").
// Pariteit by construction: het is letterlijk dezelfde reken-kern die `runCPM` draait (A3/M3), geen
// tweede implementatie die kan divergeren.
//
// VANGNET (§4.3, het gedrag van vóór 4.3b) — wanneer de efemere solve niet kan of faalt (geen
// solve-invoer meegegeven, een relatiecyclus, een solverfout): dan telt het document NIET mee. Bij
// een stale document lopen `scheduleDuration` en `earlyStart..earlyFinish` per definitie uiteen; dat
// gaf vóór B1c-W0.1 een vervormd resultaat (`computeResourceLoad` kapte toen af op
// min(scheduleDuration, werkdagen-in-de-verouderde-spanne)). Sinds B1c-W0.1 mapt
// `computeResourceLoad` bewust exact `scheduleDuration` werkdagen vanaf het (verouderde)
// `earlyStart` — geen afkap meer, het TOTAAL van de curve blijft altijd behouden. Zonder vangnet
// zou het document dus met een HYBRIDE van oud en nieuw meetellen (het oude `earlyStart` met een
// `scheduleDuration` die intussen al de nieuwe invoer kan weerspiegelen), niet met een zuivere
// "oude planning" — en dat is sowieso niet wat de gebruiker nu bedoelt (de invoer is immers
// veranderd, vandaar `scheduleStale`). Precies dáárvoor bestaat de efemere solve (§4.3b): een
// document dat wél kan doorrekenen telt mee met VERSE cijfers; kan dat niet, dan telt het — nog
// steeds — niet mee, zodat er nooit oude cijfers als actueel worden voorgespiegeld. Zulke documenten
// blijven wél zichtbaar: elke boeking (= toewijzingen op aan het poolitem gestempelde resources)
// verschijnt als ongetelde booking (`counted: false`) zonder cijfers, zodat er niets stil
// verdwijnt en de gebruiker weet wat te doen (document activeren, F5).
//
// EIGEN REKENPAD (`skipEphemeralSolve`, perf-poort na de critreview van v2026.8.0) — een document
// dat de aanroeper zelf al doorrekent (het ACTIEVE document: F5 / "Automatisch berekenen") wordt
// hier niet efemeer doorgerekend, maar telt mee met zijn taken zoals ze er staan: de laatst
// berekende toestand, precies wat de gebruiker in dat document op het scherm ziet. Zonder die uitweg
// draait er per toetsaanslag een volledige CPM-solve in de render van deze weergave. Zie het
// veldcommentaar bij `OccupancyDocInput.skipEphemeralSolve`.
//
// Capaciteit komt van het POOLitem via `maxUnitsOn` (§6): `maxUnits`/`availabilitySteps` op een
// projectkopie zijn projectinzet, maar de B1b-vraag is een bedrijfsvraag — twee projecten die elk
// binnen hun eigen inzet blijven kunnen samen alsnog boven wat het bedrijf heeft uitkomen. Twee
// bewuste vereenvoudigingen (§6, besluit): géén pool-kalendercheck op de capaciteit (de belasting
// landt per document al uitsluitend op werkdagen van dát document), en binnen-document-
// overbezetting telt gewoon mee in de som (de vraag is bedrijfsbreed).
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { ProgressMode, SchedulingOptions } from '@/types/project';
import type { CompanyPool } from '@/types/library';
import { computeResourceLoad, maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';

/**
 * De planningsinvoer die een efemere doorrekening nodig heeft (§4.3b), bovenop wat de aggregatie
 * zelf al leest. Alleen relevant voor stale documenten; ontbreekt hij, dan valt dát document terug
 * op het vangnetgedrag (zichtbaar, niet meegeteld).
 */
export interface OccupancySolveInput {
  /** De VOLLEDIGE takenlijst van het document — bladen én verzameltaken, ook taken zonder
   *  bibliotheekboeking. Een gesnoeide lijst zou een andere planning opleveren dan `runCPM`; de
   *  bibliotheek-snit die de aggregatie gebruikt is hier dus expliciet NIET goed genoeg. */
  tasks: Task[];
  sequences: Sequence[];
  /** `project.statusDate`/`progressMode`/`schedulingOptions` — dezelfde opties die `runCPM` aan de
   *  solver geeft, zodat de efemere planning identiek is aan wat F5 in dat document zou opleveren. */
  dataDate?: string;
  progressMode?: ProgressMode;
  schedulingOptions?: SchedulingOptions;
}

/** Eén open document, gemapt uit zijn payload-snapshot (weergavelaag levert dit aan, §4.4). */
export interface OccupancyDocInput {
  docId: string;
  title: string;            // via documentTitle(); '' ⇒ weergavelaag vult 'untitled' + ordinal
  scheduleStale: boolean;
  companyId: string | null; // project.companyId van dit document
  resources: Resource[];
  assignments: ResourceAssignment[];
  tasks: Task[];
  calendar: WorkCalendar;   // projectkalender
  calendars: WorkCalendar[];
  /** Invoer voor de efemere solve (§4.3b). Alleen gelezen wanneer `scheduleStale` waar is; afwezig
   *  ⇒ dat document valt op het vangnetpad (§4.3). Optioneel zodat aanroepers die geen planning
   *  kunnen aanleveren (of bewust niet willen doorrekenen) gewoon het vangnet krijgen. */
  solveInput?: OccupancySolveInput;
  /**
   * Dit document heeft een EIGEN rekenpad (F5 / "Automatisch berekenen") en mag hier niet efemeer
   * worden doorgerekend — ook niet wanneer het stale is. Perf-poort (TODO-item na de critreview van
   * v2026.8.0): de weergavelaag zet dit voor het ACTIEVE document, want dáár is elke toetsaanslag
   * een memo-invalidatie en zou er dus per bewerking een volledige CPM-solve over de complete
   * takenlijst in de render draaien (700 ms–2,6 s op 3000 taken).
   *
   * Bewuste afwijking van het vangnet van §4.3: zo'n document telt gewoon mee, maar dan met zijn
   * taken ZOALS ZE ER NU STAAN — de laatst berekende toestand, precies wat de gebruiker in dat
   * document zelf op het scherm ziet. Dat is dus dezelfde staleness als de Gantt van dat document,
   * niet een hybride die nergens vandaan komt; de booking krijgt `ephemeralComputed: false` zodat de
   * weergave "verouderd, dit zijn de laatst berekende cijfers" kan tonen in plaats van de
   * "alvast doorgerekend"-markering.
   */
  skipEphemeralSolve?: boolean;
}

/**
 * De efemere doorrekening als INJECTEERBARE rand (zelfde patroon als de Tauri-randen in de
 * MCP-laag): geef de doorgerekende taken terug, of `null` wanneer er niets door te rekenen valt.
 * Een exception telt eveneens als mislukking — de aanroepende kern vangt hem af.
 *
 * Waarom injecteerbaar: het houdt de aggregatiekern zelf volledig puur en headless testbaar (een
 * stub kan een falende of een gestuurde solve leveren, tests/library/check-occupancy.ts cases
 * 14-16), en het geeft de weergavelaag een natuurlijke plek om te memoïseren op payload-referentie
 * (§7-cache) zónder de kern iets van caching te laten weten.
 */
export type OccupancyEphemeralSolve = (doc: OccupancyDocInput) => Task[] | null;

/**
 * De echte efemere solve (default van `computeLibraryOccupancy`): kloon de taken, draai dezelfde
 * `solveProject` die `runCPM` draait, en geef de doorgerekende KLOON terug. De invoer blijft
 * byte-gelijk — `cloneTasksForSolve` kopieert precies het `time`-blok dat solver en `applyCpmResult`
 * schrijven (case 16).
 *
 * `null` bij: geen solve-invoer meegegeven, of een resultaat met `error` (relatiecyclus e.d.). In
 * beide gevallen valt het document op het vangnetgedrag terug.
 */
export const ephemeralSolve: OccupancyEphemeralSolve = (doc) => {
  const input = doc.solveInput;
  if (!input) return null;
  const tasks = cloneTasksForSolve(input.tasks);
  const result = solveProject({
    tasks,
    sequences: input.sequences,
    calendar: doc.calendar,
    calendars: doc.calendars,
    dataDate: input.dataDate,
    progressMode: input.progressMode,
    schedulingOptions: input.schedulingOptions,
  });
  if (result.error) return null;
  return tasks;
};

/** De boeking van één document op één poolitem. */
export interface OccupancyDocBooking {
  docId: string;
  title: string;
  /** Het DOCUMENT is niet doorgerekend. Bij `counted: true` (efemeer doorgerekend, §4.3b) is dit
   *  een INFORMATIEVE markering — "het overzicht rekent alvast met de actuele invoer, druk F5 in
   *  het document om het daar ook te zien"; bij `counted: false` is het de niet-meegeteld-⚠. */
  scheduleStale: boolean;
  /** false ⇒ vangnet: zichtbaar maar niet meegeteld (§4.3, alleen wanneer de efemere solve niet kon
   *  of faalde) — dan geen cijfers. */
  counted: boolean;
  /** De cijfers komen uit een EFEMERE doorrekening (§4.3b) in plaats van uit de taken zoals ze in
   *  het document staan. Alleen dan geldt de "alvast doorgerekend"-markering; een stale document met
   *  `skipEphemeralSolve` telt mee met zijn laatst berekende cijfers en krijgt hier `false`. */
  ephemeralComputed: boolean;
  firstDay: string | null;  // ISO, eerste dag met belasting > 0 (null bij counted: false)
  lastDay: string | null;
  peak: number;             // hoogste dagbelasting binnen dít document (0 bij counted: false)
  /** ISO-dag → belasting van dít document op dit poolitem (alleen dagen met belasting > 0;
   *  {} bij counted: false) — voedt de histogramweergave per rij (§5a); de som over getelde
   *  documenten per dag is exact de som die `totalPeak`/`conflictDays` gebruiken. */
  dailyLoad: Record<string, number>;
}

/** Eén rij van het overzicht: een geboekt poolitem met zijn documenten en conflictdagen. */
export interface OccupancyRow {
  libraryItemId: string;    // pool-resource-id
  name: string;             // poolnaam (weergave; matching blijft op id)
  docs: OccupancyDocBooking[];
  totalPeak: number;        // hoogste gesommeerde dagbelasting over GETELDE documenten
  capacityAtPeak: number;   // maxUnitsOn(poolItem, piekdag)
  conflictDays: string[];   // ISO-datums waar som > capaciteit (gesorteerd)
}

/**
 * Reken de bezetting van bibliotheek `companyId` uit over `docs`. Scope-regels (§4.2, zelfde
 * stempel-scope als alle B1.1-mechaniek):
 *  - een document telt alleen mee wanneer `doc.companyId === companyId`;
 *  - een resource telt alleen mee wanneer zijn stempel naar déze bibliotheek wijst ÉN de pool het
 *    `libraryItemId` nog bevat (wezen vallen eruit — een stempel dat nergens meer naar wijst hoort
 *    bij geen enkel poolitem). Projecteigen resources (geen stempel) tellen nooit mee: hun
 *    dubbelbezetting is een binnen-project-vraag en die beantwoordt het bestaande histogram al;
 *  - poolitems zonder enige boeking krijgen géén rij (het overzicht toont inzet, geen catalogus).
 * Stale documenten (§4.3b): elk stale document wordt eerst efemeer doorgerekend via `solve` (default
 * `ephemeralSolve`, de echte reken-kern op een kloon). Lukt dat, dan telt het document gewoon mee
 * met de doorgerekende datums (`counted: true`, `scheduleStale: true` als informatieve markering).
 * Lukt het niet (geen `solveInput`, een cyclus, een exception), dan geldt het vangnet van §4.3:
 * zichtbaar maar niet meegeteld. Draagt het document `skipEphemeralSolve`, dan wordt `solve` voor
 * dat document helemaal niet aangeroepen en telt het mee met zijn eigen (laatst berekende) taken —
 * `counted: true`, `ephemeralComputed: false`, `scheduleStale` blijft staan als markering.
 * Boeking-/telregels: een booking is `counted` wanneer het document doorgerekend beschikbaar is
 * (niet stale, of efemeer doorgerekend) én de berekende belasting op minstens één dag > 0 is. Een
 * vangnet-document met toewijzingen op aan het poolitem gestempelde resources levert een ongetelde
 * booking zonder cijfers; een doorgerekend document zonder enige dag belasting > 0 (0 eenheden,
 * geen datums) levert géén booking — de fantoomrij-guard. Een rij bestaat alleen bij minstens één
 * booking (geteld of ongeteld); `anyStale` staat zodra er een stale document in het overzicht
 * voorkomt — geteld-met-informatieve-⚠ óf vangnet-ongeteld.
 * Conflictdefinitie (§6): som over getelde documenten > `maxUnitsOn(poolItem, dag)` — strikt
 * groter; som == capaciteit is géén conflict. `conflictDays` is oplopend gesorteerd. Rijvolgorde
 * is de poolvolgorde (deterministisch; de weergave sorteert zelf op conflicten/naam, §5).
 *
 * `solve` is de injecteerbare efemere-solve-rand (§4.3b): de default is de echte reken-kern; tests
 * geven een stub (of bewust `() => null` voor het vangnetpad) en de weergavelaag kan er desgewenst
 * een per-payload-memoïsatie omheen leggen.
 */
export function computeLibraryOccupancy(
  companyId: string,
  pool: CompanyPool,
  docs: OccupancyDocInput[],
  solve: OccupancyEphemeralSolve = ephemeralSolve,
): { rows: OccupancyRow[]; anyStale: boolean } {
  const poolItemIds = new Set(pool.resources.map(r => r.id));

  // Emmers: per poolitem → per document → dag-belasting (alleen dagen > 0), plus de gesommeerde
  // dag-belasting over getelde documenten. Een vangnet-document krijgt een emmer zonder cijfers.
  interface DocBucket {
    doc: OccupancyDocInput;
    counted: boolean;
    /** De cijfers komen uit de efemere solve (§4.3b) — zie `OccupancyDocBooking.ephemeralComputed`. */
    ephemeralComputed: boolean;
    daily: Map<string, number>; // leeg bij counted: false
  }
  const perItem = new Map<string, { byDoc: Map<string, DocBucket>; total: Map<string, number> }>();

  const bucketFor = (itemId: string) => {
    let bucket = perItem.get(itemId);
    if (!bucket) {
      bucket = { byDoc: new Map(), total: new Map() };
      perItem.set(itemId, bucket);
    }
    return bucket;
  };

  for (const doc of docs) {
    if (doc.companyId !== companyId) continue;

    // Alleen resources met een stempel naar déze bibliotheek én een nog bestaand poolitem.
    const stampedResources = doc.resources.filter(r =>
      r.libraryOrigin !== undefined &&
      r.libraryOrigin.companyId === companyId &&
      poolItemIds.has(r.libraryOrigin.libraryItemId));
    if (stampedResources.length === 0) continue;

    // §4.3b: een stale document eerst efemeer doorrekenen (op een kloon — de invoer blijft
    // onaangeraakt). Lukt dat, dan tellen de doorgerekende taken gewoon mee; faalt het, dan geldt
    // het vangnet hieronder. Een exception uit de injectie telt als mislukking: dit is een
    // leesvenster, dat mag nooit de hele weergave onderuit halen.
    // `skipEphemeralSolve` slaat die solve over: dat document heeft een eigen rekenpad en telt mee
    // met zijn taken zoals ze er staan (zie het veldcommentaar) — geen solve, dus ook geen vangnet.
    let solvedTasks: Task[] | null = null;
    if (doc.scheduleStale && doc.skipEphemeralSolve !== true) {
      try {
        solvedTasks = solve(doc);
      } catch {
        solvedTasks = null;
      }
    }

    if (doc.scheduleStale && doc.skipEphemeralSolve !== true && solvedTasks === null) {
      // Vangnet (§4.3): niet rekenen (de engine-uitkomst zou noch oud noch nieuw zijn), maar elke
      // boeking — het document heeft toewijzingen op een gestempelde resource — blijft zichtbaar
      // als ongetelde booking. Geen cijfers, dus ook geen bijdrage aan `total`.
      for (const resource of stampedResources) {
        if (!doc.assignments.some(a => a.resourceId === resource.id)) continue;
        const bucket = bucketFor(resource.libraryOrigin!.libraryItemId);
        if (!bucket.byDoc.has(doc.docId)) {
          bucket.byDoc.set(doc.docId, { doc, counted: false, ephemeralComputed: false, daily: new Map() });
        }
      }
      continue;
    }

    // Vers per document rekenen — zelfde engine-pass als het histogram (zie kopcommentaar). Bij een
    // efemeer doorgerekend document zijn dat de KLOON-taken met de zojuist berekende datums; de
    // taken uit de payload blijven ongemoeid.
    const loadTasks = solvedTasks ?? doc.tasks;
    const loadResult = computeResourceLoad(doc.resources, doc.assignments, loadTasks, doc.calendar, doc.calendars);

    for (const resource of stampedResources) {
      const daily = loadResult.load[resource.id];
      if (!daily) continue; // geen (geldige) toewijzingen ⇒ geen boeking
      const itemId = resource.libraryOrigin!.libraryItemId;

      // Fantoomrij-guard (critreview bevinding 2): `computeResourceLoad` maakt de load-emmer al
      // vóór de daglus aan, dus een truthy (leeg) object is geen bewijs van belasting — en
      // 0-eenheden-dagen evenmin. Alleen dagen met belasting > 0 vormen een boeking: zonder zo'n
      // dag wordt hier geen emmer aangemaakt en bestaat de booking (en dus de rij) niet.
      for (const [iso, units] of Object.entries(daily)) {
        if (units <= 0) continue;
        const bucket = bucketFor(itemId);
        let docBucket = bucket.byDoc.get(doc.docId);
        if (!docBucket) {
          docBucket = { doc, counted: true, ephemeralComputed: solvedTasks !== null, daily: new Map() };
          bucket.byDoc.set(doc.docId, docBucket);
        }
        // Meerdere kopieën met dezelfde stempel in één document sommeren gewoon op.
        docBucket.daily.set(iso, (docBucket.daily.get(iso) ?? 0) + units);
        bucket.total.set(iso, (bucket.total.get(iso) ?? 0) + units);
      }
    }
  }

  const rows: OccupancyRow[] = [];
  let anyStale = false;

  // Poolvolgorde als deterministische rijvolgorde; ongeboekte items slaan we over.
  for (const poolItem of pool.resources) {
    const bucket = perItem.get(poolItem.id);
    if (!bucket) continue;

    const docBookings: OccupancyDocBooking[] = [];
    for (const { doc, counted, ephemeralComputed, daily } of bucket.byDoc.values()) {
      let firstDay: string | null = null;
      let lastDay: string | null = null;
      let peak = 0;
      const dailyLoad: Record<string, number> = {};
      for (const [iso, units] of daily) {
        dailyLoad[iso] = units;
        if (firstDay === null || iso < firstDay) firstDay = iso;
        if (lastDay === null || iso > lastDay) lastDay = iso;
        if (units > peak) peak = units;
      }
      // anyStale (§4.3b): er komt minstens één STALE document in het overzicht voor — efemeer
      // doorgerekend en meegeteld (informatieve ⚠) óf vangnet-ongeteld (niet-meegeteld-⚠). De
      // `!counted`-tak is er voor de volledigheid: een ongetelde booking ontstaat alleen op het
      // vangnetpad, en dat pad is per definitie stale.
      if (!counted || doc.scheduleStale) anyStale = true;
      docBookings.push({
        docId: doc.docId,
        title: doc.title,
        scheduleStale: doc.scheduleStale,
        counted,
        ephemeralComputed,
        firstDay,
        lastDay,
        peak,
        dailyLoad,
      });
    }

    // Som per dag over getelde documenten (oplopend doorlopen ⇒ conflictDays vanzelf gesorteerd,
    // en de piekdag is bij gelijke pieken deterministisch de vroegste).
    let totalPeak = 0;
    let peakDay: string | null = null;
    const conflictDays: string[] = [];
    for (const iso of [...bucket.total.keys()].sort()) {
      const sum = bucket.total.get(iso)!;
      if (sum > totalPeak) {
        totalPeak = sum;
        peakDay = iso;
      }
      if (sum > maxUnitsOn(poolItem, iso)) conflictDays.push(iso);
    }

    rows.push({
      libraryItemId: poolItem.id,
      name: poolItem.name,
      docs: docBookings,
      totalPeak,
      // Zonder enige getelde belaste dag (alleen ongetelde boekingen) is er geen piekdag; vlakke
      // maxUnits als neutrale capaciteit.
      capacityAtPeak: peakDay !== null ? maxUnitsOn(poolItem, peakDay) : poolItem.maxUnits,
      conflictDays,
    });
  }

  return { rows, anyStale };
}
