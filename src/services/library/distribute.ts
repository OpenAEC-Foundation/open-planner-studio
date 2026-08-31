// B1c — de verdeler-kern (spec 2026-08-17-b1c-nivelleren-restcapaciteit-design.md §4).
// Herverdeelt de boeking op ÉÉN poolitem over de geopende documenten die het boeken. Volledig puur
// en headless testbaar (tests/library/check-distribute.ts): geen store, geen I/O — het schrijfpad en
// het paneel zijn etappe 3.
//
// HET PROTOCOL IS SEQUENTIEEL, NIET SIMULTAAN. De eerste versie van de spec gaf een formule waarin
// iedereen iedereen op zijn huidige plek zag — dan is er nergens rest en is verdelen onmogelijk.
// Hier: documenten één voor één in RANGORDE. Nr. 1 nivelleert alleen tegen de vaste last; elk
// volgend document ziet de ECHTE boekingen van zijn voorgangers.
//
// TWEE GROOTBOEKEN. De motor toetst per `resourceId` tegen de eigen projectinzet (dat voorkomt dat
// we een bibliotheekconflict oplossen door een projectconflict te maken); dit bestand voegt het
// gedeelde POOLITEM-grootboek toe. Beide toetsen moeten slagen — identiek aan de
// `min(projectinzet, poolrest)`-formulering elders in de spec.
//
// EEN TEKORT CASCADEERT NIET. Kan een taak binnen plafond en profiel niet geplaatst worden, dan
// wordt haar vraag NIET in het poolgrootboek geboekt (`LevelingPoolLedger.book` wordt overgeslagen)
// maar als tekort geregistreerd. Zo blijft het restprofiel ≥ 0 en krijgt het volgende document
// exact de ruimte die er echt is. Een voorstel mét tekorten is een geldige preview, maar blokkeert
// Toepassen (etappe 3 zet die knop uit-met-reden).
//
// UITSLUITEND DOORGEREKENDE CIJFERS (§3.1). `computeLibraryOccupancy` rekent stale documenten
// efemeer door; blijft er tóch één `counted: false`, dan is de hele actie GEBLOKKEERD met uitleg —
// nooit een stille uitsluiting, want nivelleren tegen een niet-doorgerekend document is nivelleren
// tegen een getal dat nergens vandaan komt.
//
// "FLOAT EERST, UITSCHIETER MINIMAAL" IS GEEN TWEEDE ALGORITME (spec §4 stap 2, KEUZE VAN DIT PLAN
// — concretisering, geen afwijking). De SGS-plaatsing in `levelResources` zoekt per taak het
// VROEGSTE venster vanaf haar PF, dus float wordt per constructie eerst opgesoupeerd en de uitloop
// is per taak minimaal; de rangorde bepaalt wie de vroege ruimte krijgt. Er is dus geen aparte
// "float-pass" nodig — dat zou het bestaande, al-geteste SGS-gedrag dupliceren.
//
// DE KOSTENLABELS EN DE GEREEDSCHAPSSCHAKELAAR ZIJN GEEN APARTE API (spec §4 stap 1 / §6). "Alleen
// dit project laten opschuiven kost +N werkdagen" en het prijskaartje van "onderbrekingen toestaan"
// zijn `computeDistribution` opnieuw draaien met een andere rangorde resp. `allowSplits` — de kern
// levert dus alles wat het paneel nodig heeft; het cache-/schaalbeleid (§3.4) hoort bij het paneel.
import type { Task, TaskSplitGap } from '@/types/task';
import type { CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import {
  levelResources,
  type LevelingOptions,
  type LevelingPoolLedger,
  type LevelingReason,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { computeLibraryOccupancy, type OccupancyDocInput, type OccupancySolveInput } from './occupancy';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

/** Eén deelnemend document. Erft de bezettings-invoer (zodat aanroeper en bezettingsoverzicht
 *  dezelfde mapping delen) en voegt de drie tune-bedieningen van spec §6 toe. */
export interface DistributionDocInput extends OccupancyDocInput {
  /** 1 = wordt het meest ontzien en plaatst als eerste. Duplicaten worden stabiel op `docId`
   *  gebroken; de aanroeper (het paneel) levert een echte volgorde. */
  rank: number;
  /** De pin uit §6: bevriest het document volledig (einddatum ÉN werkdagen). Doet niet mee in de
   *  verdeling, telt als vaste last. */
  pinned: boolean;
  /** #63 — "datums zoals opgeslagen" (§3.3a). Impliciet gepind: het document meldt `counted: true`
   *  met datums die de motor niet berekend heeft, dus B1c raakt zijn data NOOIT aan. */
  datesAsRecorded: boolean;
  /** "Maximale uitloop van de einddatum", in werkdagen; `null` = onbegrensd. `0` = einddatum vast,
   *  float mag benut worden (§6: plafond 0 ≠ bevroren — daarvoor is de pin). */
  ceilingWorkdays: number | null;
  /** Planningsinvoer voor de motor-run van dít document: de VOLLEDIGE takenlijst, relaties en
   *  CPM-opties — zelfde eis en zelfde reden als `OccupancySolveInput` (een gesnoeide lijst geeft
   *  een andere planning dan `runCPM`). */
  levelInput: OccupancySolveInput;
}

export interface DistributionOptions {
  /** "Onderbrekingen toestaan" (§4 stap 0 / §11.4). */
  allowSplits: boolean;
}

/** Waarom een document niet kon wijken — DOCUMENT-niveau, naast de taak-niveau `LevelingReason`. */
export type DistributionPinReason = 'pin' | 'dates-as-recorded';

/** Waarom de HELE actie geblokkeerd is (§3.1-vorm: vóór al het rekenwerk, geen stille uitsluiting).
 *  - `UNCOUNTED_DOCUMENT` — een deelnemer is niet doorgerekend (zie `computeLibraryOccupancy`).
 *  - `MATERIAL_ITEM` (fixronde B1c-plan-2-etappe-2, bevinding 1) — `levelResources` nivelleert nooit
 *    `MATERIAL` (spec §5.3, `ResourceLeveler.ts`s `renewable`-filter); zonder deze poort filterde
 *    `computeDistribution` niet op resourcetype, dus elke scope-taak kreeg stilzwijgend `hasDemand
 *    === false` — een LEEG voorstel dat "opgelost" oogt (geen delays, geen tekorten) terwijl het
 *    bezettingsoverzicht gewoon een conflict toont.
 *  - `NO_DEMAND` — algemener vangnet: geen enkele deelnemende scope-taak heeft daadwerkelijk vraag op
 *    een nivelleerbare (niet-MATERIAL) resource. In de praktijk raakt dit vrijwel alleen een
 *    inconsistente stempel (projectresource op `MATERIAL` gezet terwijl het poolitem zelf dat niet
 *    is); zonder deze poort zou dat dezelfde lege-succes-illusie geven als `MATERIAL_ITEM`. */
export type DistributionBlockReason = 'UNCOUNTED_DOCUMENT' | 'MATERIAL_ITEM' | 'NO_DEMAND';

export interface DistributionShortfall {
  taskId: string;
  reason: LevelingReason;
  /** De dagen waarop het niet paste (uit `LevelingResult.unresolved`). */
  days: string[];
}

export interface DistributionDocResult {
  docId: string;
  title: string;
  /** false ⇒ gepind of #63: het document telde als vaste last en werd niet herplaatst. */
  participated: boolean;
  pinnedReason?: DistributionPinReason;
  /** Alle taken in het document zijn priority 1000 ⇒ het KAN niet wijken (§4-taxonomie): een eigen
   *  uitkomst, geen generieke capaciteitsmelding. */
  cannotMove: boolean;
  delays: Record<string, number>;
  /** Volledige, te schrijven `splitGaps` per taak (leeg wanneer `allowSplits` uit staat). */
  gaps: Record<string, TaskSplitGap[]>;
  projectEndBefore: string;
  projectEndAfter: string;
  /** Werkdagen die de einddatum opschuift — het getal dat het paneel bij de handle toont (§6). */
  endShiftWorkdays: number;
  shortfalls: DistributionShortfall[];
}

export interface DistributionProposal {
  libraryItemId: string;
  /** Niet-null ⇒ er is GEEN voorstel; `docs` is leeg. Zie `DistributionBlockReason` voor de drie
   *  redenen — allemaal in dezelfde vorm (`reason` + `docIds`), ook waar `docIds` voor een reden
   *  (`MATERIAL_ITEM`) minder betekenisvol is dan voor `UNCOUNTED_DOCUMENT`. */
  blocked: { reason: DistributionBlockReason; docIds: string[] } | null;
  docs: DistributionDocResult[];
  /** ISO-dag → vaste last (gepinde documenten + documenten buiten de verdeling die op dit poolitem
   *  boeken). Voedt de fasestrook-achtergrond in etappe 3. */
  fixedLoadByDay: Record<string, number>;
  /** ISO-dag → wat er ná de hele verdeling nog vrij is. ALTIJD ≥ 0. */
  residualByDay: Record<string, number>;
  /** Minstens één document houdt een tekort ⇒ Toepassen blijft uit (etappe 3). */
  hasShortfall: boolean;
}

/** Injecteerbare motor-rand, zelfde patroon als `OccupancyEphemeralSolve` — de default draait de
 *  echte `levelResources` op een verse CPM-solve van het document (zodat `projectEndBefore` een
 *  echt getal is, geen stub); tests kunnen een stub geven voor foutpaden. */
export type DistributionLevelRun = (doc: DistributionDocInput, options: LevelingOptions) => LevelingResult;

const defaultLevelRun: DistributionLevelRun = (doc, options) => {
  const tasks = cloneTasksForSolve(doc.levelInput.tasks);
  const cpmResult = solveProject({
    tasks,
    sequences: doc.levelInput.sequences,
    calendar: doc.calendar,
    calendars: doc.calendars,
    dataDate: doc.levelInput.dataDate,
    progressMode: doc.levelInput.progressMode,
    schedulingOptions: doc.levelInput.schedulingOptions,
  });
  return levelResources(
    tasks, doc.levelInput.sequences, doc.resources, doc.assignments,
    doc.calendar, doc.calendars, cpmResult, options,
    {
      dataDate: doc.levelInput.dataDate,
      progressMode: doc.levelInput.progressMode,
      schedulingOptions: doc.levelInput.schedulingOptions,
    },
  );
};

/** De huidige (ongewijzigde) projecteinddatum van een document — het maximum over de `earlyFinish`
 *  van zijn bladtaken. Gebruikt voor documenten die de motor NIET draait (gepind/#63/`cannotMove`):
 *  hun `projectEndBefore`/`projectEndAfter` zijn per definitie gelijk, want er verandert niets. */
function currentProjectEnd(tasks: Task[]): string {
  let end = '';
  for (const t of tasks) {
    if (t.childIds.length > 0) continue;
    if (t.time.earlyFinish && (!end || t.time.earlyFinish > end)) end = t.time.earlyFinish;
  }
  return end;
}

/** `currentProjectEnd`, maar STALE-bewust (fixronde B1c-plan-2-etappe-2, bevinding 3). Deelnemers
 *  krijgen hun `projectEndBefore` uit een VERSE `defaultLevelRun`-solve (zie hierboven); een gepind/
 *  #63/`cannotMove`-document draait de motor niet en las tot nu toe altijd de rauwe
 *  `t.time.earlyFinish` — bij een STALE document (open, maar niet herberekend sinds de laatste
 *  taakwijziging) een verouderd getal, inconsistent met wat de deelnemers wél zien.
 *
 *  Zelfde route als de efemere doorrekening in `occupancy.ts`s `ephemeralSolve`: een KLOON
 *  doorrekenen, geen write-back naar de payload. #63-documenten (`datesAsRecorded`) zijn hier per
 *  invariant NOOIT stale — `scheduleStale` mag nooit `true` zijn terwijl `datesAsRecorded` aanstaat
 *  (bewaakt door `tests/planning/check-recorded-dates.ts`) — dus deze tak raakt hun opgeslagen datums
 *  nooit aan; die blijven altijd via de rauwe (want per definitie verse) `earlyFinish` gelezen. Een
 *  mislukte solve (cyclus, solverfout) valt terug op de rauwe datums — hetzelfde vangnetgedrag als
 *  `ephemeralSolve`. */
function currentProjectEndFor(doc: DistributionDocInput): string {
  if (!doc.scheduleStale) return currentProjectEnd(doc.levelInput.tasks);
  try {
    const tasks = cloneTasksForSolve(doc.levelInput.tasks);
    const result = solveProject({
      tasks,
      sequences: doc.levelInput.sequences,
      calendar: doc.calendar,
      calendars: doc.calendars,
      dataDate: doc.levelInput.dataDate,
      progressMode: doc.levelInput.progressMode,
      schedulingOptions: doc.levelInput.schedulingOptions,
    });
    if (result.error) return currentProjectEnd(doc.levelInput.tasks);
    return currentProjectEnd(tasks);
  } catch {
    return currentProjectEnd(doc.levelInput.tasks);
  }
}

/** Werkdagen die de einddatum is opgeschoven (getekend), op de PROJECTkalender van het document —
 *  zelfde meting als `ResourceLeveler.ts`s eigen `shifts`-berekening (M9). */
function endShiftWorkdays(before: string, after: string, calendar: WorkCalendar): number {
  const eng = new CalendarEngine(calendar);
  const from = parseDate(before), to = parseDate(after);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  return to >= from ? eng.workDaysBetween(from, to) - 1 : -(eng.workDaysBetween(to, from) - 1);
}

/** Alle taak-id's in dit document die via een resource stempel naar `libraryItemId` (in `companyId`)
 *  daadwerkelijk op deze pool boeken — de `scopeTaskIds` die de motor scope-behoudend nivelleert
 *  (B1c-plan-2 taak 3), zodat taken die niets met dit poolitem te maken hebben nooit verschuiven. */
function scopeTaskIdsFor(doc: DistributionDocInput, companyId: string, libraryItemId: string): string[] {
  const stampedResourceIds = new Set(
    doc.resources
      .filter(r => r.libraryOrigin !== undefined
        && r.libraryOrigin.companyId === companyId
        && r.libraryOrigin.libraryItemId === libraryItemId)
      .map(r => r.id),
  );
  if (stampedResourceIds.size === 0) return [];
  return [...new Set(doc.assignments.filter(a => stampedResourceIds.has(a.resourceId)).map(a => a.taskId))];
}

/** Heeft minstens één taak in `scopeTaskIds` daadwerkelijk vraag die `levelResources` zou zien
 *  (fixronde B1c-plan-2-etappe-2, bevinding 1)? Mirror van `ResourceLeveler.ts`s eigen `hasDemand`-
 *  voorwaarden (niet-mijlpaal, geen verzameltaak, `scheduleDuration > 0`, een toewijzing met
 *  `unitsPerDay > 0` op een NIET-`MATERIAL`-resource — de motor nivelleert `MATERIAL` nooit, spec
 *  §5.3). `scopeTaskIdsFor` levert alleen taken die al via een stempel op DIT poolitem boeken; als
 *  GEEN daarvan hier `true` geeft, zou de motor niets plaatsen en de aanroeper een leeg — maar
 *  "opgelost" ogend — voorstel krijgen. */
function scopeHasDemand(doc: DistributionDocInput, scopeTaskIds: string[]): boolean {
  if (scopeTaskIds.length === 0) return false;
  const scopeSet = new Set(scopeTaskIds);
  const tasksById = new Map(doc.levelInput.tasks.map(t => [t.id, t]));
  const resById = new Map(doc.resources.map(r => [r.id, r]));
  for (const a of doc.assignments) {
    if (!scopeSet.has(a.taskId) || a.unitsPerDay <= 0) continue;
    const res = resById.get(a.resourceId);
    if (!res || res.type === 'MATERIAL') continue;
    const task = tasksById.get(a.taskId);
    if (!task || task.isMilestone || task.childIds.length > 0) continue;
    if (task.time.scheduleDuration <= 0) continue;
    return true;
  }
  return false;
}

/** Ondergrens-argument voor `LevelingPoolLedger.horizonIso` (zelfde geest als `scanLimit`/L4 in
 *  `ResourceLeveler.ts`, B1c-plan-2 taak 6): de laatste dag met vaste last of al geplaatste
 *  boeking, plus een marge van de langste taakspanne over de deelnemende documenten. Dit is GEEN
 *  garantie — de motor mag verder scannen — alleen "tot hier heeft doorscannen zeker zin".
 */
function computeHorizonIso(
  fixedLoadByDay: Record<string, number>,
  placed: Record<string, number>,
  participants: DistributionDocInput[],
): string | null {
  let latest: string | null = null;
  for (const iso of Object.keys(fixedLoadByDay)) if (!latest || iso > latest) latest = iso;
  for (const iso of Object.keys(placed)) if (!latest || iso > latest) latest = iso;
  if (!latest) return null;
  let maxSpanDays = 30;
  for (const doc of participants) {
    for (const t of doc.levelInput.tasks) {
      if (!t.time.earlyStart || !t.time.earlyFinish) continue;
      const s = parseDate(t.time.earlyStart), f = parseDate(t.time.earlyFinish);
      if (isNaN(s.getTime()) || isNaN(f.getTime())) continue;
      const spanDays = Math.round((f.getTime() - s.getTime()) / 86400000);
      if (spanDays > maxSpanDays) maxSpanDays = spanDays;
    }
  }
  return formatDate(addCalendarDays(parseDate(latest), maxSpanDays + 30));
}

/**
 * Reken het verdelingsvoorstel voor poolitem `libraryItemId` in bibliotheek `companyId` uit over
 * `docs`. Zie het moduleblok hierboven voor het protocol.
 */
export function computeDistribution(
  companyId: string,
  pool: CompanyPool,
  libraryItemId: string,
  docs: DistributionDocInput[],
  options: DistributionOptions,
  runLeveling: DistributionLevelRun = defaultLevelRun,
): DistributionProposal {
  const empty: DistributionProposal = {
    libraryItemId, blocked: null, docs: [], fixedLoadByDay: {}, residualByDay: {}, hasShortfall: false,
  };

  const poolItem = pool.resources.find(r => r.id === libraryItemId);
  if (!poolItem) return empty;

  // Stap 1 (§3.1): de bezetting is de ENE bron voor "wie boekt hier al" — puur, zelfde reken-kern
  // als het bezettingsoverzicht. `docs` is structureel een `OccupancyDocInput[]` (de drie
  // tune-velden zijn extra, `computeLibraryOccupancy` negeert ze).
  const { rows } = computeLibraryOccupancy(companyId, pool, docs);
  const row = rows.find(r => r.libraryItemId === libraryItemId);
  if (!row) return empty;

  // Blokkade (§3.1) — VÓÓR al het rekenwerk: nivelleren tegen een niet-doorgerekend document is
  // nivelleren tegen een getal dat nergens vandaan komt.
  const uncounted = row.docs.filter(b => !b.counted);
  if (uncounted.length > 0) {
    return { ...empty, blocked: { reason: 'UNCOUNTED_DOCUMENT', docIds: uncounted.map(b => b.docId) } };
  }

  // Bevinding 1 (fixronde B1c-plan-2-etappe-2): `levelResources` nivelleert `MATERIAL` nooit (spec
  // §5.3) — zonder deze poort zou elke scope-taak stilzwijgend `hasDemand === false` krijgen, niets
  // boeken en niets tekortkomen: een LEEG voorstel dat "opgelost" oogt. Vóór al het rekenwerk, net
  // als de UNCOUNTED_DOCUMENT-poort hierboven — de reden ligt aan het POOLITEM, niet aan een
  // specifiek document, dus `docIds` noemt iedereen die er (volgens de bezetting) al op boekt.
  if (poolItem.type === 'MATERIAL') {
    return { ...empty, blocked: { reason: 'MATERIAL_ITEM', docIds: row.docs.map(b => b.docId) } };
  }

  const docById = new Map(docs.map(d => [d.docId, d]));
  const bookingByDocId = new Map(row.docs.map(b => [b.docId, b]));

  // Stap 3 (vaste last): gepinde + #63-documenten. "Een document dat wél op het poolitem boekt maar
  // níét als deelnemer meedoet" heeft in dit contract maar één mechanisme — de aanroeper levert het
  // gewoon mee met `pinned: true` (zie `DistributionDocInput.pinned`s docblok).
  const fixedLoadByDay: Record<string, number> = {};
  for (const booking of row.docs) {
    const input = docById.get(booking.docId);
    if (!input || (!input.pinned && !input.datesAsRecorded)) continue;
    for (const [iso, units] of Object.entries(booking.dailyLoad)) {
      fixedLoadByDay[iso] = (fixedLoadByDay[iso] ?? 0) + units;
    }
  }

  // Het gedeelde poolitem-grootboek (§4 stap 2): `placed` accumuleert over ALLE deelnemende
  // documenten, in rangorde — dat IS de sequentiële kern van het protocol.
  const placed: Record<string, number> = {};
  const bookPlaced = (iso: string, units: number) => { placed[iso] = (placed[iso] ?? 0) + units; };
  const residualOn = (iso: string): number =>
    Math.max(0, maxUnitsOn(poolItem, iso) - (fixedLoadByDay[iso] ?? 0) - (placed[iso] ?? 0));

  // Bevinding 5 (fixronde B1c-plan-2-etappe-2): `poolItemOf` wordt door `findSlot` per KANDIDAATDAG
  // aangeroepen (elke conflictcheck, elke boeking); een `Array.find` over `doc.resources` daarbinnen
  // is dus O(kandidaten × resources) i.p.v. één keer O(resources) per document. `makeLedgerForDoc`
  // zelf draait al maar één keer per deelnemend document (zie de aanroep hieronder), dus de map hier
  // bouwen — buiten `poolItemOf`, binnen `makeLedgerForDoc` — is voldoende.
  const makeLedgerForDoc = (doc: DistributionDocInput, horizonIso: string | null): LevelingPoolLedger => {
    const resourceById = new Map(doc.resources.map(r => [r.id, r]));
    return {
      poolItemOf: (resourceId: string): string | null => {
        const r = resourceById.get(resourceId);
        if (!r || r.libraryOrigin === undefined) return null;
        if (r.libraryOrigin.companyId !== companyId || r.libraryOrigin.libraryItemId !== libraryItemId) return null;
        return libraryItemId;
      },
      residualOn: (_itemId: string, iso: string): number => residualOn(iso),
      book: (_itemId: string, iso: string, units: number): void => bookPlaced(iso, units),
      horizonIso,
    };
  };

  // Deelnemers: alle documenten met een booking op dit poolitem, MIN de vaste-last-documenten,
  // gesorteerd op rangorde (dan `docId` voor een stabiele tie-break — spec §4 stap 3, "één pass").
  const participantBookings = row.docs.filter(b => {
    const input = docById.get(b.docId);
    return input !== undefined && !input.pinned && !input.datesAsRecorded;
  });
  const participants = participantBookings
    .map(b => docById.get(b.docId)!)
    .sort((a, b) => a.rank - b.rank || a.docId.localeCompare(b.docId));

  // Bevinding 1 (algemener deel): scope-taak-id's per deelnemer alvast bepalen — nodig voor de
  // NO_DEMAND-poort hieronder én voor de hoofdlus verderop (één berekening, niet twee).
  const scopeTaskIdsByDoc = new Map(participants.map(doc => [doc.docId, scopeTaskIdsFor(doc, companyId, libraryItemId)]));

  // Algemener vangnet naast `MATERIAL_ITEM` hierboven: zijn er wél deelnemers, maar heeft GEEN
  // ENKELE daarvan daadwerkelijk vraag op dit poolitem (zie `scopeHasDemand`s docblok voor wanneer
  // dat — buiten een MATERIAL-poolitem — kan gebeuren)? Dan zou de hoofdlus verderop alsnog een leeg
  // maar "opgelost" ogend voorstel opleveren. GEEN documenten (bv. alles gepind) is geen blokkade —
  // dat is gewoon een geldig voorstel zonder deelnemers (zie case 7).
  if (participants.length > 0 && !participants.some(doc => scopeHasDemand(doc, scopeTaskIdsByDoc.get(doc.docId)!))) {
    return { ...empty, blocked: { reason: 'NO_DEMAND', docIds: participants.map(d => d.docId) } };
  }

  const results: DistributionDocResult[] = [];

  // Vaste-last-/#63-documenten eerst in de uitkomst (volgorde is verder niet betekenisvol voor deze
  // documenten — ze draaien geen motor), daarna de deelnemers in rangorde.
  for (const booking of row.docs) {
    const input = docById.get(booking.docId);
    if (!input || (!input.pinned && !input.datesAsRecorded)) continue;
    const end = currentProjectEndFor(input);
    results.push({
      docId: booking.docId,
      title: booking.title,
      participated: false,
      pinnedReason: input.datesAsRecorded ? 'dates-as-recorded' : 'pin',
      cannotMove: false,
      delays: {},
      gaps: {},
      projectEndBefore: end,
      projectEndAfter: end,
      endShiftWorkdays: 0,
      shortfalls: [],
    });
  }

  for (const doc of participants) {
    const scopeTaskIds = scopeTaskIdsByDoc.get(doc.docId)!;
    const tasksById = new Map(doc.levelInput.tasks.map(t => [t.id, t]));
    const cannotMove = scopeTaskIds.length > 0 && scopeTaskIds.every(id => tasksById.get(id)?.priority === 1000);

    if (cannotMove) {
      // Het document KAN niet wijken (§4-taxonomie): alle betrokken taken zijn vastgepind. Boek de
      // bestaande boeking rechtstreeks in het grootboek (het document bezet de pool wél — het is
      // gewoon niet verplaatsbaar), geen motor-run.
      const booking = bookingByDocId.get(doc.docId)!;
      for (const [iso, units] of Object.entries(booking.dailyLoad)) bookPlaced(iso, units);
      const end = currentProjectEndFor(doc);
      results.push({
        docId: doc.docId, title: doc.title, participated: true, cannotMove: true,
        delays: {}, gaps: {}, projectEndBefore: end, projectEndAfter: end, endShiftWorkdays: 0, shortfalls: [],
      });
      continue;
    }

    const horizonIso = computeHorizonIso(fixedLoadByDay, placed, participants);
    const levelOptions: LevelingOptions = {
      constrainToFloat: false,
      scopeTaskIds,
      ...(doc.ceilingWorkdays !== null ? { overrunCeilingDays: doc.ceilingWorkdays } : {}),
      allowSplits: options.allowSplits,
      poolLedger: makeLedgerForDoc(doc, horizonIso),
    };
    const result = runLeveling(doc, levelOptions);

    const shortfalls: DistributionShortfall[] = Object.keys(result.unresolved).map(taskId => ({
      taskId,
      reason: result.unresolvedReasons[taskId],
      days: result.unresolved[taskId],
    }));

    results.push({
      docId: doc.docId,
      title: doc.title,
      participated: true,
      cannotMove: false,
      delays: result.delays,
      gaps: result.gaps,
      projectEndBefore: result.projectEndBefore,
      projectEndAfter: result.projectEndAfter,
      endShiftWorkdays: endShiftWorkdays(result.projectEndBefore, result.projectEndAfter, doc.calendar),
      shortfalls,
    });
  }

  const residualByDay: Record<string, number> = {};
  for (const iso of new Set([...Object.keys(fixedLoadByDay), ...Object.keys(placed)])) {
    residualByDay[iso] = residualOn(iso);
  }

  return {
    libraryItemId,
    blocked: null,
    docs: results,
    fixedLoadByDay,
    residualByDay,
    hasShortfall: results.some(d => d.shortfalls.length > 0),
  };
}
