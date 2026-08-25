/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Entry point (T5-T7): `readMPP(bytes, labels) → ImportResult`. Flow: CfbFile → assertReadable
 * (formaatdetectie + wachtwoordpoort, T4) → Props (projecteigenschappen, `"   114"/Props`) →
 * FieldMap14 (T5) → taken uit `"   114"/TBkndTask` (FixedMeta/FixedData + VarMeta/Var2Data,
 * leesvolgorde van `MPP14Reader.processTaskData`) → kalenders uit `"   114"/TBkndCal` (T6,
 * `mppCalendars.ts`) — projectkalender + taak-/resourcekalenders → relaties uit `"   114"/
 * TBkndCons` (T7 — LET OP: dat is MPP-jargon voor RELATIES, niet datumconstraints) + resources
 * uit `"   114"/TBkndRsc` + assignments uit `"   114"/TBkndAssn` (T7, sinds T11 in `mppEntities.ts`
 * — zie diens moduleheader voor het waarom van die knip) — een compleet `ImportResult`, geen
 * placeholders meer.
 *
 * Veldsemantiek is gespiegeld aan `readMSPDI` (mspdiReader.ts) — zelfde afronding voor duur,
 * dezelfde constrainttype-codes (`mspCodeToConstraint`, hergebruikt), dezelfde
 * progress-normalisatie (`normalizeImportedProgress`).
 *
 * UURMODUS (etappe 1.5, 2026-08-15) — CORRECTIE t.o.v. de oorspronkelijke etappe-1-tekst hierboven
 * ("Alles blijft DAG-modus"): die vereenvoudiging is VERVALLEN. De bron draagt de precisie al
 * (duren in tienden van minuten, timestamps met een echte tijdcomponent, kalender-uurbanden — T6
 * las die al) — deze lezer spiegelt nu exact dezelfde (c)-discriminator-orkestratie als
 * `mspdiReader.ts` (zie `@/services/subdayIo`'s normatieve discriminator-tekst): een kalender
 * promoveert naar uur-modus zodra ze zelf afwijkt (discriminator (a)/(b) — meerdere banden per
 * werkdag, of een band die middernacht kruist) ÓF minstens één taak op die kalender een (c)-signaal
 * draagt (sub-dag-duur, `isSubDayMinutes`, of een Start/Finish die van het kalender-eigen anker
 * afwijkt, `hasNonAnchorTime`/`mppAnchorClock` hieronder). De promotie zelf is een LOSSE stap
 * (`promoteCalendarsForHourMode` in `mppCalendars.ts`) die pas draait NÁ een volledige taak-scan —
 * spiegelt mspdiReader's eigen tweefasen-opzet (`readMSPDI`: eerst alle `<Calendar>`-elementen
 * registreren, dan alle taken scannen op het (c)-signaal, dán pas promoveren, dán pas de
 * Task-objecten bouwen). `readTasks` hieronder doet dus drie passes over de geldige taken: (A) een
 * ruwe scan (Date-/getalwaarden, geen `Task`-object), (B) signaalverzameling + promotie, (C) de
 * uiteindelijke `Task`-objecten met de nu bekende dag/uur-beslissing per taak. Bij uur-modus komt
 * `Task.time.durationMinutes` uit de rauwe tienden-van-minuut-duur (geen dag-afronding),
 * `scheduleStart`/`scheduleFinish`/`actualStart`/`actualFinish`/constraint-/deadline-datums
 * behouden hun echte tijdcomponent (`formatInstant(..., 'hour')` i.p.v. `formatDate`), en
 * `TBkndCons`-lag voor een uur-modus-opvolger wordt minuut-precies (`Sequence.lagMinutes`,
 * `mppEntities.ts`'s `mppLagToSequenceFields`) — exact de velden die mspdiReader's uur-modus-pad
 * ook vult. Dag-modus-bestanden (geen enkel (a)/(b)/(c)-signaal op geen enkele kalender) doorlopen
 * dezelfde code maar met `isHour=false` overal, en blijven dus BYTE-VOOR-BYTE hetzelfde resultaat
 * opleveren als vóór etappe 1.5 — zie `check-mpp-import.ts`'s nieuwe uurmodus-sectie voor de
 * corpusmeting die dat bevestigt (inclusief de bevinding dat het corpusbestand 870d339f60603f71
 * zelf, hash-only §8, ondanks de oorspronkelijke aanname, óók sub-dag-signaal draagt — de
 * MSPDI-ground-truth van dát bestand leest via de bestaande, ongewijzigde `readMSPDI` al 51/51
 * taken in uur-modus).
 *
 * PARITEITSCLAIM, GEKWALIFICEERD (uurmodus-review, R3): "identiek aan zijn MSPDI-export" geldt
 * PRECIES wanneer de effectieve kalender se `workStartHour === 8` — MSPDI's eigen anker is een
 * globale, vaste `08:00` (OPS's eigen MSPDI-schrijfconventie), terwijl deze lezer een KALENDER-EIGEN
 * anker gebruikt (`mppAnchorClock` hieronder, bewust — zie die functie se toelichting voor waarom).
 * Voor een kalender met een ANDER startuur (bv. 09:00) divergeren de twee lezers TWEEZIJDIG op een
 * taak die precies op dat startuur landt: deze lezer classificeert 'm als dagmodus, `readMSPDI` op
 * de equivalente XML als uurmodus. Zie `mppAnchorClock`'s eigen docblock voor de volledige
 * toelichting (inclusief de HH:00-granulariteitsbeperking) en `check-mpp-import.ts`'s
 * "ankerdivergentie"-fixture voor het gepinde bewijs.
 *
 * TWEE ASYMMETRISCHE REKENPADEN (uurmodus-review, R4-i/ii — bewust, niet stilzwijgend):
 *  - `scheduleDuration`: het UUR-pad rekent op de EFFECTIEVE taak-kalender se EIGEN `hoursPerDay`
 *    (`effHpd`, ná promotie via `deriveHoursPerDay`); het DAG-pad rekent — ONGEWIJZIGD t.o.v. vóór
 *    etappe 1.5 — op de PROJECT-BREDE `hoursPerDay` (uit Props/MINUTES_PER_DAY, of de 8u-terugval),
 *    ook als de taak een eigen kalender-override met een ANDER `hoursPerDay` draagt. Dat is een
 *    bestaande, doelbewust ONGEMOEID gelaten beperking (zie `readTasks`'s Fase C-toelichting bij
 *    `duration` hieronder) — dag-modus-bestanden moeten byte-voor-byte hetzelfde blijven geven als
 *    vóór deze etappe, dus het rekenpad daar is niet "verbeterd" naar `effHpd`.
 *  - `Sequence.lagMinutes`: een `TBkndCons`-relatie naar een UUR-modus-opvolger krijgt voortaan
 *    `lagMinutes` gezet — INCLUSIEF `lagMinutes: 0` voor een relatie zonder lag (spiegelt
 *    mspdiReader's `taskHourById`-tak exact, die ook zonder waarde-check `seq.lagMinutes =
 *    Math.round(...)` zet). Dit verandert de IFC-/MSPDI-SERIALISATIEVORM van zo'n relatie (een
 *    expliciete `lagMinutes: 0` schrijft een ander pad dan de afwezigheid van het veld) t.o.v. een
 *    relatie die vóór etappe 1.5 hetzelfde stond maar via de opvolger nooit als uur-modus gelezen
 *    werd — een gedocumenteerd, geaccepteerd neveneffect van de spiegelplicht, geen bug.
 *
 * HIËRARCHIE/parentId — CORRECTIE (T5-spec-review, 2026-08-14): een eerdere versie van dit
 * bestand beweerde dat deze lezer hier bewust van MPXJ afweek door `TaskField.PARENT_TASK_
 * UNIQUE_ID` te negeren ten faveure van een outline-level-stack, en verklaarde de vergelijkings-
 * afwijkingen tegen de ground truth als "staleness" van dat veld. Beide beweringen zijn WEERLEGD
 * door een byte-voor-byte hermeting: `PARENT_TASK_UNIQUE_ID` is in alle drie corpusbestanden
 * 100% consistent met de outline-level-stack (0 verschillen op 51/134/215 taken — geen enkele
 * interne tegenstrijdigheid). Belangrijker: MPXJ's `MPP14Reader.processTaskData` vult
 * `m_parentTasks` wél (`m_parentTasks.put(task.getUniqueID(), PARENT_TASK_UNIQUE_ID)`), maar
 * leest die map NERGENS terug voor de hiërarchie — `ProjectFile.updateStructure()` (aangeroepen
 * door `MPPReader.read()` ná alle per-variant-lezers) bouwt de boom uit de taken GESORTEERD OP
 * ID, met het outline-level als enige dieptesignaal. Dat is EXACT wat deze lezer doet: de
 * outline-level-stack hieronder is dus geen vereenvoudiging t.o.v. MPXJ, maar de letterlijke
 * poort van hoe MPXJ het zelf doet.
 *
 * De WERKELIJKE oorzaak van de vergelijkingsafwijkingen tegen de MSPDI-ground-truth (zie de
 * T5-sectie van `tests/planning/check-mpp-import.ts` voor de volledige onderbouwing): de drie
 * `.mpp.xml`-bestanden zijn een ANDERE DOCUMENTVERSIE/-revisie dan de bijbehorende `.mpp`'s, geen
 * export van exact dezelfde staat. Signalen: alle drie XML's hebben compact herNUMMERDE UID==ID
 * 1..N (een echte MSPDI-export van dezelfde live state behoudt de bestaande unique-ID's, die zijn
 * na jaren editen nooit toevallig weer 1..N op een rij) — 27 van de 51 `.mpp`-unique-ID's in
 * 870d339f60603f71 (hash-only §8) komen zelfs helemaal niet voor in die getallenreeks; taken zijn
 * verplaatst (een cut/paste-handtekening, niet een los "vergeten te herberekenen"-veld); en de
 * projectstartdatum van a69fec157074d056 verschilt ronduit tussen de twee bestanden (`.mpp` en
 * `.mpp.xml` liggen elf dagen uit elkaar; exacte datums hash-only, §2/§8). Dat is een brongegeven van het corpus, niet iets een lezer kan overbruggen — zie de
 * per-veld-budgetten in `check-mpp-import.ts` voor de gemeten omvang per bestand.
 *
 * `task.getStart()`/`getFinish()` in MPP14Reader kan, voor HANDMATIG-geplande taken, afwijken van
 * `SCHEDULED_START`/`SCHEDULED_FINISH` (het veld dat déze lezer gebruikt) — MPXJ leest beide
 * (`TaskField.START` op een apart veld-id, 1283/1284) en kiest per taak op basis van de taakmodus
 * (auto/handmatig, `TaskMode`/`TASK_MODE`, een bit-flag die zelf in `Fixed2Meta` zit — buiten T5's
 * veldenlijst). M5-correctie (eindreview T16c): "de meerderheid in normale bestanden is
 * auto-geplande, dus bewuste beperkte vereenvoudiging" was hier eerder als vaststaand feit
 * geformuleerd — dat is NIET gemeten. De `Fixed2Meta`-bit is nooit daadwerkelijk uitgelezen (geen
 * code decodeert `TaskField.TASK_MODE`); er bestaat dus geen bevestiging van de aandeel-claim.
 * T15's corpusbrede probe (zie dossier (c)5 in
 * `docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md`) noemt dit "vermoedelijk de
 * grootste resterende afwijkingscluster" — het tegenovergestelde van "een beperkte
 * vereenvoudiging". TASK_MODE is de best onderbouwde HYPOTHESE voor de discriminator (bekend
 * byte-level mechanisme, juiste richting van het effect), geen geverifieerde verklaring en geen
 * gemeten omvang — zie `tests/planning/mppGroundTruth.ts`'s moduleheader voor de volledige,
 * hypothese-vs-meting-precieze versie.
 *
 * Twee VERDER niet-geporte MPXJ-kwaliteitsfilters (T5-spec-review, 4c) — bewuste, gedocumenteerde
 * vereenvoudiging, geen bug: MPP14Reader's `createTaskMap` accepteert een taakrecord alleen als
 * (a) het bijbehorende `Fixed2Data`-record (via een heuristisch-gedimensioneerde `Fixed2Meta`,
 * kandidaten 92–96 bytes) ook niet-`null` is, én (b) de FixedData-recordlengte minstens 75% van
 * `fieldMap.getMaxFixedDataSize(0)` beslaat (het werkelijke maximale offset+grootte over ALLE
 * ~100 taakvelden in het bestand, niet alleen T5's kleine subset — dat maximum is met de huidige
 * veldenlijst niet betrouwbaar te berekenen). Deze lezer laat beide filters weg: de eenvoudiger
 * validatie (verwijderd-vlag + null-taak-grootte + spooktaak-check via VarMeta, zie
 * `collectValidTaskIndices`) haalt al taakaantal-pariteit (51/134/215) op alle drie ground-truth-
 * bestanden. Mocht een bredere corpuslezing (T9's crawl-smoke, 49 bestanden zonder ground truth)
 * ooit een telling laten afwijken, dan is dát het signaal om `Fixed2Data`/`getMaxFixedDataSize`
 * alsnog te porten — tot dan is dit een bewust uitgestelde uitbreiding, geen gat.
 */
import type { Project } from '@/types/project';
import type {
  Task, TaskConstraint, MilestoneKind, TaskSplitGap, MspTaskType, TaskTimephasedContour, TimephasedContourPeriod,
} from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceType } from '@/types/resource';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { generateId } from '@/utils/id';
import { formatDate, formatInstant, isoDayOfWeek, parseInstant } from '@/utils/dateUtils';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { tenthsOfMinutesToDays } from '@/services/importDurations';
import { mspCodeToConstraint } from '@/services/msproject/mspdiReader';
import { hasNonAnchorTime, isSubDayMinutes } from '@/services/subdayIo';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { CfbFile } from './cfb';
import { assertReadable, detectApplicationVersion, Props } from './mppContainer';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12,
  getInt, getShort, getTimestamp, getUnicodeString, getDurationTimeUnits,
} from './mppPrimitives';
import {
  TaskFieldId, AssignmentFieldId,
  createAssignmentFieldMap, createResourceFieldMap, createTaskFieldMap,
  fixedOffsetOf, fixed2OffsetOf, varDataKeyOf, type FieldMapTable,
} from './fieldMap14';
import { readCalendars, promoteCalendarsForHourMode, type CalendarReadResult } from './mppCalendars';
import { MAX_VAR_TEXT_BYTES, clampRemainingDurationTenths, clampManualDurationTenths, clampLevelingDelayTenths } from './limits';
import { readRelations, readResources, readAssignments, readAssignmentTimephasedRaw } from './mppEntities';
import {
  decodeRegularTimephasedWork, decodePlannedRegularTimephasedWork,
  deriveSplitGapsFromPeriods, deriveTaskSplitGaps, shiftPeriods, hasAnyTimephasedData,
  type AssignmentTimephasedRaw, type TimephasedWorkPeriod,
} from './mppTimephased';

// ── PropsKey-sleutels voor projecteigenschappen (PropsKey.java; gelezen uit `"   114"/Props`,
// NIET uit de root-`Props14`-stream — die draagt alleen de wachtwoordvlag, zie mppContainer.ts). ──
const PROPS_KEY_TITLE = 37748744;
const PROPS_KEY_PROJECT_START_DATE = 37748738;
const PROPS_KEY_PROJECT_FINISH_DATE = 37748739;
const PROPS_KEY_STATUS_DATE = 37748805;
const PROPS_KEY_MINUTES_PER_DAY = 37748765;

/** TBkndTask/FixedMeta-itemgrootte (MPP14Reader.java r. 993: `new FixedMeta(..., 47)`). */
const TASK_FIXED_META_ITEM_SIZE = 47;
/** Z2 — TBkndTask/Fixed2Meta-itemgrootte-KANDIDATEN (MPP14Reader.java: `new FixedMeta(stream,
 *  taskFixedData, 92, 93, 94, 95, 96)` — de heuristische variant, `FixedMeta.withHeuristicItemSize`,
 *  al gebruikt door `mppEntities.ts`'s resource-Fixed2Meta; dit is het taak-precedent). */
const TASK_FIXED2_META_ITEM_SIZES = [92, 93, 94, 95, 96];
/** Fixed-data-blokken kleiner dan dit zijn "null-taak"-plaatshouders (verwijderde/vrijgemaakte
 *  unique-ID's die geen echte taak dragen) — MPP14Reader.java's `NULL_TASK_BLOCK_SIZE`. */
const NULL_TASK_BLOCK_SIZE = 16;
/** Bit 0x02 in de eerste 4 bytes van een FixedMeta-item markeert een verwijderde taak
 *  (`createTaskMap`'s `flags & 0x02`-check). */
const DELETED_TASK_FLAG = 0x02;
/** De eerste drie FixedData-slots zijn geen taken (MPP14Reader.java's `createTaskMap`: "First
 *  three items are not tasks, so let's skip them"). */
const FIRST_TASK_INDEX = 3;

/**
 * C1 (T5-kwaliteitsreview, kritiek): het RUWE outline-level-veld (SHORT, 0..65535) stuurt zowel de
 * stackdiepte in `assignHierarchyAndWbs` als de lengte van de gegenereerde WBS-string
 * ("1.1.1. … .1", één segment per niveau) — ONGEKLEMD is dat een kwadratische geheugen-/tijdbom:
 * bij N taken met STRIKT OPLOPEND outline-level groeit de totale WBS-tekst O(N²) (elke taak op
 * niveau k draagt een string van O(k) tekens, gesommeerd over N ≈ N² tekens). Gemeten
 * (kwaliteitsreview): 20.000 strikt-oplopende niveaus (≈ 2 MB aan `.mpp`-invoer) gaf 461 MB
 * piekgeheugen en 2,3 s; 65.535 niveaus (het theoretische maximum van een SHORT) zou ≈ 5 GB geven.
 * Een geprepareerd bestand kan dit bewust forceren — dit is dus geen randgeval, maar een
 * hardingsvereiste net als de CFB-/VarMeta-klemmen elders in deze module (`collectValidTaskIndices`,
 * `mppPrimitives.ts`'s VarMeta12-clamp).
 *
 * `MAX_OUTLINE_LEVEL = 256` is de klem: ruim boven elke realistische WBS-diepte (het corpus gaat
 * niet voorbij één cijfer), maar laag genoeg om zowel de stackdiepte als de WBS-stringlengte per
 * taak hard te begrenzen — de totale kost wordt zo O(N × 256), lineair in N. Taken die dieper
 * zouden zitten dan de klem worden SIBLINGS op de klemdiepte (ze delen dezelfde geklemde
 * `outlineLevel`, dus de stack behandelt ze als broers/zussen op niveau 256 i.p.v. eindeloos door
 * te nesten) — een leesbaar, voorspelbaar degradatiepatroon voor een pathologisch bestand, in
 * plaats van een OOM-crash.
 */
export const MAX_OUTLINE_LEVEL = 256;

/** Klemt een ruw outline-level (SHORT, mogelijk 0 of tot 65535) naar `[1, MAX_OUTLINE_LEVEL]` —
 *  zie `MAX_OUTLINE_LEVEL`'s toelichting hierboven. Losse, geëxporteerde functie (i.p.v. inline in
 *  `readTasks`) zodat `check-mpp-import.ts` de klemgrenzen rechtstreeks kan testen zonder een
 *  volledig CFB-bestand te hoeven bouwen. */
export function clampOutlineLevel(raw: number): number {
  return Math.min(Math.max(raw, 1), MAX_OUTLINE_LEVEL);
}

/**
 * I1 (T5-kwaliteitsreview, kritiek): var-data-tekst (taaknaam, WBS-tekst) kan door MEERDERE
 * unique-ID's naar DEZELFDE gedeelde Var2Data-offset wijzen (legitiem, zie `Var2Data`'s
 * moduleheader in mppPrimitives.ts: "offsets kunnen herhalen wanneer items gededupliceerde
 * var-data delen"). Zonder een bovengrens kost het uitlezen van zo'n gedeelde string O(werkelijke
 * lengte) per taak die 'm deelt — bij N taken die naar één grote (bv. 500 KB) string wijzen dus
 * O(N × S). Gemeten (kwaliteitsreview): 1.000 taken × 500 KB gedeelde string ≈ 3,0 s. Deze
 * bovengrens (in BYTES, vóór UTF-16-decodering) wordt doorgegeven aan `Var2Data.getUnicodeString`,
 * die 'm weer doorgeeft aan `getUnicodeString` in mppPrimitives.ts — de scan-lus daar is zelf ook
 * door deze grens begrensd (niet alleen het eindresultaat), dus de kostenbovengrens is nu
 * O(N × MAX_VAR_TEXT_BYTES), lineair in N. 64 KiB is ruim boven elke realistische taaknaam/WBS-
 * tekst (het corpus blijft ver onder 1 KB), maar begrenst een geprepareerd bestand hard.
 *
 * Testdekking (T5-slot, precisering): alleen het PRIMITIEF is met een fixture gepind —
 * `check-mpp-import.ts`'s I1-regressietest roept `Var2Data.getUnicodeString(..., maxLength, ctx)`
 * rechtstreeks aan met een 400.000-byte gedeelde string en bewijst dat `maxLength` daar zowel het
 * resultaat als de scan-kosten begrenst. Dat `readTasks` hieronder dit primitief ook daadwerkelijk
 * met `MAX_VAR_TEXT_BYTES` aanroept (i.p.v. zonder grens) is NIET los end-to-end gepind: een
 * >64 KiB-var-data-stream past bewust niet door `buildNestedCfb`'s mini-stream-only-bouwer
 * (>4096 bytes per stream, zie mppFixtures.ts), dus die specifieke callsite-regressie steunt op
 * code-review-discipline (de aanroepen hieronder gebruiken zichtbaar `MAX_VAR_TEXT_BYTES`, geen
 * kale `varData.getUnicodeString(uniqueId, key)` zonder derde argument) in plaats van een
 * geautomatiseerde guard.
 *
 * T6-kwaliteitsreview (minor M4): deze constante woont sinds T6 in `./limits.ts` (bladmodule,
 * gedeeld met `mppCalendars.ts` — die had voorheen noodgedwongen een eigen kopie, want een
 * omgekeerde import vanuit `mppCalendars.ts` naar déze module zou een cyclus geven). Hier alleen
 * ge-re-importeerd zodat de rest van dit bestand ongewijzigd `MAX_VAR_TEXT_BYTES` kan blijven
 * gebruiken.
 */

/** Gedeelde 2010-vs-2013+-versiegrens (`applicationVersion <= PROJECT_2010(14)`), hergebruikt door
 *  élke bit-flag-tabelkeuze in dit bestand — MPXJ's eigen `MPP14Reader` onderscheidt zelf drie
 *  versies (2010/2013/2016) voor sommige tabellen, maar 2013 en 2016 delen voor élk bit-mechanisme
 *  dat déze lezer gebruikt (milestone, TASK_MODE) letterlijk dezelfde offset/mask — zie
 *  `milestoneBitFlag`'s eigen toelichting hieronder het "twee gevallen volstaan"-argument. Z2
 *  (etappe "nul afwijkingen") tilt deze grens uit `milestoneBitFlag` naar een gedeelde helper zodat
 *  `taskModeBitFlag` hieronder 'm hergebruikt i.p.v. een tweede, potentieel uit de pas lopende
 *  `<= 14`-check te verzinnen (plan-§Z2: "hergebruik die logica, geen tweede grens"). */
function isLegacyBitFlagVersion(applicationVersion: number | null): boolean {
  return (applicationVersion ?? 0) <= 14; // MPXJ: NumberHelper.getInt(null) === 0
}

/** Milestone-vlag: `MppBitFlag(TaskField.MILESTONE, offset, mask, ...)` uit MPP14Reader.java's
 *  `PROJECT20xx_TASK_META_DATA_BIT_FLAGS`-tabellen. Voor déze lezer is alleen de MILESTONE-regel
 *  nodig (de rest van die tabellen — FLAG1..20, MARKED, ROLLUP, … — valt buiten T5's veldenlijst).
 *  Project 2013 en 2016+ delen dezelfde milestone-offset/-mask (alleen andere, voor ons
 *  irrelevante velden verschillen tussen die twee), dus twee gevallen volstaan: ≤2010 vs. 2013+.
 *  ONBEKENDE versie (`detectApplicationVersion` gaf `null`) valt terug op de 2010-TABEL, niet de
 *  moderne (T5-spec-review, 4a — correctie t.o.v. een eerdere versie die hier de moderne tabel
 *  koos): MPXJ leest de versie via `NumberHelper.getInt(m_file.getProjectProperties().
 *  getApplicationVersion())`, en `NumberHelper.getInt(null)` levert `0` — `0 <= PROJECT_2010 (14)`
 *  is dus waar, en MPXJ valt zelf terug op de 2010-tabel, niet op 2013+. Corpus-geverifieerd
 *  levert alle drie bestanden altijd een echte versie op ("Microsoft.Project 16.0"), dus dit pad
 *  raakt het corpus niet — het is puur voor MPXJ-trouw bij een onherkenbare/afwezige versiestring
 *  in een ander bestand. */
function milestoneBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x20 } // PROJECT2010_TASK_META_DATA_BIT_FLAGS
    : { offset: 10, mask: 0x02 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA_BIT_FLAGS
}

/** Z2 — TASK_MODE-bit (MANUALLY_SCHEDULED vs. AUTO_SCHEDULED), gelezen uit `Fixed2Meta` (NIET
 *  `FixedMeta` — een taak-eigen `Fixed2Meta`-record, zie `readTasks`). Referentie (verifieer op
 *  inhoud, `MPP14Reader.java`): `PROJECT2010_TASK_META_DATA2_BIT_FLAGS` (offset 8, masker 0x08) vs.
 *  `PROJECT2013_TASK_META_DATA2_BIT_FLAGS`/`PROJECT2016_TASK_META_DATA2_BIT_FLAGS` (beide offset 8,
 *  masker 0x80 — identiek aan elkaar, dus dezelfde twee-gevallen-inperking als `milestoneBitFlag`
 *  is hier ook zonder informatieverlies geldig). */
function taskModeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 8, mask: 0x08 } // PROJECT2010_TASK_META_DATA2_BIT_FLAGS
    : { offset: 8, mask: 0x80 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA2_BIT_FLAGS
}

/** Z14b (eigenaarsbesluit 2026-08-18, punt 1) — EFFORT_DRIVEN-bit ("Effort Driven"-vlag), zelfde
 *  FixedMeta-tabel/-mechanisme als `milestoneBitFlag` hierboven (`PROJECT20xx_TASK_META_DATA_BIT_
 *  FLAGS` — NIET de `_META_DATA2_`-tabel van `taskModeBitFlag`, dat is een ander blok). Referentie
 *  (`MPP14Reader.java`): `new MppBitFlag(TaskField.EFFORT_DRIVEN, 11, 0x10, ...)` op de 2010-tabel,
 *  `(..., 13, 0x08, ...)` op zowel de 2013- als de 2016-tabel (identiek aan elkaar, dus dezelfde
 *  twee-gevallen-inperking als `milestoneBitFlag`). Puur data: geen enkele solverstap leest dit
 *  veld (`Task.effortDriven`). */
function effortDrivenBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  return isLegacyBitFlagVersion(applicationVersion)
    ? { offset: 11, mask: 0x10 } // PROJECT2010_TASK_META_DATA_BIT_FLAGS
    : { offset: 13, mask: 0x08 }; // PROJECT2013_/PROJECT2016_TASK_META_DATA_BIT_FLAGS
}

/** Z14b — spiegelt MPXJ's `TaskTypeHelper.getInstance(int)` (`org.mpxj.mpp.TaskTypeHelper`): 0/1/2
 *  → FIXED_UNITS/FIXED_DURATION/FIXED_WORK, elke andere waarde (negatief, of ≥3 — inclusief MPXJ's
 *  eigen `FIXED_DURATION_AND_UNITS`-ordinal 3, die in de .mpp-BYTE-laag nooit voorkomt: MPXJ leest
 *  die waarde alleen via MSPDI/PMXML, niet via deze offset) → FIXED_WORK (MPXJ's eigen terugval).
 *  `raw === null` is een APARTE staat (veld ontbreekt in de field map, of het record was te kort
 *  voor deze offset) ⇒ GEEN Task-veld gezet — spiegelt het "afwezig ⇒ byte-identiek"-precedent van
 *  elk ander optioneel MPP-veld in dit bestand; MPXJ's FIXED_WORK-terugval geldt alleen voor een
 *  ECHT AANWEZIGE maar ongeldige waarde, niet voor een ontbrekend veld.
 *
 *  Geëxporteerd, zelfde testbaarheidsreden als `readTasks`/`buildAssignmentUidLinks`:
 *  `check-mpp-import.ts`'s Z14b-sectie roept 'm rechtstreeks aan om het "afwezig" (`null`) vs.
 *  "aanwezig maar ongeldig" (bv. 99) onderscheid te bewijzen zonder een tweede CFB-fixture nodig
 *  te hebben (`fixedOffsetOf` bewijst het "afwezig-in-de-veldmap"-geval al op zichzelf). */
const MSP_TASK_TYPE_VALUES: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];
export function mspTaskTypeFromRaw(raw: number | null): MspTaskType | undefined {
  if (raw === null) return undefined;
  return MSP_TASK_TYPE_VALUES[raw] ?? 'FIXED_WORK';
}

/** Z9a (etappe "nul afwijkingen") — MPXJ's `MPP14Reader.java`-overschrijfregel (r. ~1162–1176):
 *  `SCHEDULED_START`/`SCHEDULED_FINISH` (35/36) gaan alléén naar het opgeslagen `START`/`FINISH`
 *  (1283/1284) als dat manual-veldpaar leeg is, óf de taak AUTO_SCHEDULED is. `Task.time.
 *  scheduleStart`/`scheduleFinish` — dat Z9a's forwardPass-tak straks RAUW gebruikt voor een
 *  MANUALLY_SCHEDULED-taak — moet dus zelf al het JUISTE veldpaar dragen; vóór deze fixronde
 *  gebruikte `start`/`finish` hieronder ALTIJD 35/36 (`scheduledStartOffset`/`scheduledFinishOffset`,
 *  ongeacht `taskMode`), dus het manual-ankerpaar (`manualStartTs`/`manualFinishTs`, al sinds Z2
 *  gelezen maar tot deze fixronde nooit gebruikt) bereikte de taak nooit.
 *
 *  SPIEGELT `tests/planning/mppGroundTruth.ts`'s `resolveScheduleField` LETTERLIJK — bewust
 *  GEDUPLICEERD, geen import: die module is de ONAFHANKELIJKE meetlat-tegenhanger (zie haar eigen
 *  "BEWUST EEN TWEEDE LUS"-moduleheader) en moet een bug hier juist kunnen ONTMASKEREN, niet delen.
 *  Kiezen lezer en meetlat elk hun eigen randgeval, dan meet de fidelity-check ruis in plaats van
 *  juistheid — vandaar dat de parametervolgorde/-naam en de exacte boolean-uitdrukking hier
 *  bewust identiek zijn aan het origineel, tot en met de operator-precedentie.
 *
 *  CORPUSMETING (Z9a-probe, wegwerpscript, 2026-08-18): 216 leesbare bestanden, 70 met minstens
 *  één MANUALLY_SCHEDULED-taak (1659 manual-taken totaal). Bij 261 van die taken, verspreid over
 *  15 bestanden, verschilt 1283/1284 daadwerkelijk van 35/36 — en dat zijn EXACT de 14 uit Z8's
 *  slotronde `reason`-gepinde Z9a-bestanden (alle vier `assignment-assignments`/`-flags`/
 *  `-text`-crawlvarianten × 2010/2013/2016/2019, plus `mpp14timephasedsegmentsmanual(offsets).mpp`)
 *  plus het gemengde corpusbestand (hash a69fec157074d056). De overige 55 manual-dragende bestanden
 *  hebben 1283/1284 === 35/36 exact — daar was deze fix dus onzichtbaar geweest (`start`/`finish`
 *  droegen toevallig al de juiste waarde), maar voor precies de Z9a-doelpopulatie was hij dat niet:
 *  zonder deze fix zou de forwardPass-tak (die `scheduleStart`/`scheduleFinish` rauw respecteert)
 *  op alle 14 bestanden het VERKEERDE anker rauw bevriezen. */
function resolveScheduleField(manual: Date | null, scheduled: Date | null, isManual: boolean): Date | null {
  const overrideWithScheduled = manual === null || (scheduled !== null && !isManual);
  return overrideWithScheduled ? scheduled : manual;
}

interface RawTaskRecord {
  uniqueId: number;
  id: number;
  /** Al geklemd via `clampOutlineLevel` (C1) — nooit de rauwe SHORT-waarde. */
  outlineLevel: number;
  /** Expliciet door de gebruiker ingevoerde WBS-tekst, `null` als afwezig (het gebruikelijke
   *  geval, zie de toelichting bij `storedWbs` hierboven) — de outline-level-stack hieronder
   *  genereert dan zelf een WBS-code, net als MPXJ's `updateStructure()`. */
  storedWbs: string | null;
  task: Task;
}

/** Structurele ondergrens voor `assignHierarchyAndWbs` — bewust NIET de volledige `Task`, zodat
 *  een test duizenden lichte fixture-objecten kan bouwen zonder de hele `Task`-vorm (tijdvelden,
 *  resourceIds, …) te hoeven vullen (T5-kwaliteitsreview, I4/C1-regressie). Een echte `Task` is
 *  hier structureel altijd geldig, dus `readTasks` geeft 'm gewoon door. */
interface HierarchyTaskLike {
  id: string;
  parentId: string | null;
  childIds: string[];
  wbsCode: string;
}

/**
 * Hiërarchie via een outline-level-stack, GESORTEERD OP ID — dit is letterlijk hoe MPXJ's
 * `updateStructure()` het zelf doet (zie de moduleheader; `PARENT_TASK_UNIQUE_ID` wordt door MPXJ
 * gevuld maar nooit voor de boom gelezen). Genereert tegelijk de WBS-code als outline-nummering
 * ("1", "1.1", "1.2.1", …) over diezelfde boom — MPXJ doet dat ook zelf in `updateStructure()`,
 * want MPP slaat een auto-WBS niet op (zie de toelichting bij `storedWbs` in `RawTaskRecord`). Een
 * EXPLICIET door de gebruiker ingevoerde WBS-tekst (zeldzaam, corpus: nooit waargenomen) wint van
 * de gegenereerde vorm.
 *
 * Losse, geëxporteerde functie (T5-kwaliteitsreview, I2/C1) — `readTasks` roept 'm aan met de
 * echte `RawTaskRecord[]`, `check-mpp-import.ts`'s C1-regressietest met duizenden lichte
 * `HierarchyTaskLike`-fixtures (zie hierboven) om te bewijzen dat de klem in `clampOutlineLevel`
 * de kwadratische blowup daadwerkelijk voorkomt, zonder een navenant grote CFB-fixture te hoeven
 * bouwen. Verwacht `entries` al gesorteerd op `id` (de aanroeper doet dat). Muteert
 * `entries[i].task` in-place; retourneert niets.
 */
export function assignHierarchyAndWbs<T extends HierarchyTaskLike>(
  entries: { outlineLevel: number; storedWbs: string | null; task: T }[],
): void {
  const stack: { task: T; wbs: string; level: number; childCount: number }[] = [];
  let rootCount = 0;
  for (const rec of entries) {
    while (stack.length > 0 && stack[stack.length - 1].level >= rec.outlineLevel) stack.pop();
    const parent = stack[stack.length - 1];
    let generatedWbs: string;
    if (parent) {
      parent.childCount++;
      generatedWbs = `${parent.wbs}.${parent.childCount}`;
      rec.task.parentId = parent.task.id;
      parent.task.childIds.push(rec.task.id);
    } else {
      rootCount++;
      generatedWbs = `${rootCount}`;
    }
    rec.task.wbsCode = rec.storedWbs || generatedWbs;
    // I2/C1-restpunt: geen los `id`-veld meer op de stack-entry (dood veld — alleen `task.id` werd
    // ooit gelezen, via `parent.task.id` hierboven).
    stack.push({ task: rec.task, wbs: generatedWbs, level: rec.outlineLevel, childCount: 0 });
  }
}

/** Poort van `MPP14Reader.processTaskData`'s `createTaskMap`, vereenvoudigd tot wat T5 nodig
 *  heeft: een `uniqueID → FixedData-index`-tabel, met verwijderde/null-/spooktaken eruit gefilterd
 *  (KRITIEK voor taakaantal-pariteit met de MSPDI-ground-truth). Java itereert ACHTERWAARTS en
 *  voegt alleen toe als de sleutel nog niet bestaat (bij duplicaten wint de LAATSTE/hoogste
 *  index); hier itereren we VOORWAARTS en overschrijven altijd — functioneel identiek resultaat,
 *  met een simpelere lus. */
function collectValidTaskIndices(fixedMeta: FixedMeta, fixedData: FixedData, varMeta: VarMeta12, uniqueIdOffset: number): Map<number, number> {
  const itemCount = fixedMeta.getAdjustedItemCount();
  const validIndexByUniqueId = new Map<number, number>();
  const deletedIds = new Set<number>();

  for (let index = FIRST_TASK_INDEX; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);
    if (!metaItem || metaItem.length < 4) continue;

    const flags = getInt(metaItem, 0, 'TBkndTask/FixedMeta-flags');
    if ((flags & DELETED_TASK_FLAG) !== 0) {
      // Verwijderde-taak-marker: alleen de unique-ID onthouden (voor de spooktaak-check
      // hieronder) — MPP14Reader.java leest 'm hier als SHORT ("Only a short stored for deleted
      // tasks?"), niet als de gebruikelijke INT.
      if (data.length >= 2) deletedIds.add(getShort(data, 0, 'TBkndTask/FixedData deleted-uid'));
      continue;
    }
    // Null-taak-plaatshouder: MPXJ VOEGT deze wél toe aan `m_file` (`task.setNull(true)`, met de
    // ID/unique-ID uit de 16 bytes) — puur om ID-CONTINUÏTEIT te bewaren voor latere taken in
    // dezelfde iteratie (bookkeeping, zie `m_nullTaskOrder`). Zo'n plaatshouder is nooit zichtbaar
    // in de UI en dus ook nooit in een native XML-export, dus deze lezer slaat 'm bewust over i.p.v.
    // 'm als onzichtbare taak te materialiseren. VERKLAART wél de ID-gaten die je in a69fec157074d056
    // (hash-only §8) kunt tegenkomen als je ruw door TBkndTask/FixedData loopt (T5-spec-review, 4b) — dat zijn geen
    // ontbrekende/foutief-uitgesloten taken, maar precies deze plaatshouders.
    if (data.length === NULL_TASK_BLOCK_SIZE) continue;

    if (data.length < uniqueIdOffset + 4) continue;
    const uniqueId = getInt(data, uniqueIdOffset, 'TBkndTask/FixedData uniqueId');
    validIndexByUniqueId.set(uniqueId, index); // latere/hogere index wint
  }

  // Spooktaak-check (MPP14Reader.java): een unique-ID die zowel als verwijderd gemarkeerd staat
  // ALS een normaal record heeft, telt alleen mee als er var-data voor bestaat.
  for (const uid of deletedIds) {
    if (validIndexByUniqueId.has(uid) && !varMeta.containsKey(uid)) {
      validIndexByUniqueId.delete(uid);
    }
  }

  return validIndexByUniqueId;
}

/** Percent complete: SHORT, 0..100 direct (MPPUtility.getPercentage) — buiten dat bereik ⇒ 0
 *  (spiegelt de Java-bron: een ongeldige waarde levert daar `null`, hier de neutrale 0). */
function readPercentComplete(data: Uint8Array, offset: number | null): number {
  if (offset === null || data.length < offset + 2) return 0;
  const raw = getShort(data, offset, 'TBkndTask percentComplete');
  return raw >= 0 && raw <= 100 ? raw : 0;
}

/** Rauwe timestamp (Date, tijdcomponent behouden) — de etappe-1.5-tegenhanger van de oude
 *  `readDateField` (die meteen naar een dag-alleen string formatteerde). De dag/uur-modus-
 *  beslissing valt pas ná de signaal-scan (Fase B hieronder), dus Fase A bewaart hier de rauwe
 *  `Date`; Fase C formatteert 'm dan met `formatDate` (dag) of `formatInstant(...,'hour')` (uur). */
function readTimestampField(data: Uint8Array, offset: number | null, ctx: string): Date | null {
  if (offset === null || data.length < offset + 4) return null;
  return getTimestamp(data, offset, ctx);
}

/**
 * Synthetisch anker voor de MPP-datumdiscriminator (c) — spiegelt mspdiReader's vaste
 * `MSP_TIME_ANCHOR` ('08:00:00', dezelfde waarde voor zowel Start als Finish), maar KALENDER-EIGEN
 * i.p.v. globaal-vast: een rauw MPP-bestand kent geen eigen schrijfconventie zoals OPS's
 * MSPDI-writer (die altijd letterlijk T08:00 plakt op een dag-modus-datum, ongeacht de kalender) —
 * de kalender se EIGEN scalar-startuur (`workStartHour`, de nog-NIET-gepromoveerde, eerste-band-
 * afgeleide waarde uit `buildCalendarFromDays`) is hier de betekenisvolle "dag-modus-verwachting":
 * een taak die exact op het startuur van haar eigen kalender begint/eindigt draagt geen sub-dag-
 * informatie, één die daarvan afwijkt (bv. een Finish midden op de dag, of een Start ná de lunch)
 * wél — precies zoals mspdiReader's vaste anker dat voor MSPDI's OPS-eigen schrijfconventie doet.
 *
 * ANKERDIVERGENTIE (uurmodus-review, R3, 2026-08-15) — BEWUST vastgelegd, geen bug: de "gedraagt
 * zich identiek aan zijn MSPDI-export"-belofte in de moduleheader geldt LETTERLIJK alleen wanneer
 * `cal.workStartHour === 8` (dan vallen het kalender-eigen anker en MSPDI's vaste anker samen). Een
 * kalender met een ANDER startuur (bv. 09:00) laat de twee lezers TWEEZIJDIG divergeren voor een
 * verder identieke taak die precies op dat startuur begint/eindigt: deze lezer blijft DAGMODUS (de
 * taak zit exact op haar eigen kalender-anker), terwijl `readMSPDI` diezelfde taak/kalender als
 * MSPDI-XML gelezen WEL als uur-modus zou classificeren (09:00 ≠ MSPDI's vaste 08:00-anker). Zie
 * `check-mpp-import.ts`'s "ankerdivergentie"-fixture (R3) voor het empirische bewijs — beide kanten
 * (readMPP ÉN readMSPDI, op equivalente invoer) worden daar gepind. De keuze voor het kalender-eigen
 * anker (i.p.v. MSPDI's vaste 08:00 blind overnemen) is bewust: voor een RAUWE MPP-timestamp — die,
 * anders dan MSPDI-tekst, nooit een "date-only vs. echte tijd"-schrijfkeuze kent — is "wijkt de tijd
 * af van déze kalender se eigen dagbegin" de semantisch juiste vraag, niet "wijkt de tijd af van een
 * willekeurig, formaat-vreemd 08:00-getal".
 *
 * GRANULARITEIT (uurmodus-review, R3): het anker rondt `workStartHour` af op het HELE UUR (`:00:00`
 * — geen minuten). Een kalender die om een HALF uur begint (bv. 07:30) krijgt dus een anker ("07:00")
 * dat de kalender ZELF NOOIT als Start-/Finish-tijd oplevert — het datumsignaal (`hasNonAnchorTime`)
 * vuurt dan voor ELKE taak op die kalender, ongeacht of de taak zelf sub-dag-precisie draagt. Dit is
 * in de praktijk GEMASKEERD: een kalender met een half-uur-startuur heeft vrijwel altijd ook een
 * band die niet op een heel uur eindigt, en `buildCalendarFromDays`'s `Math.floor`-afronding op
 * `workStartHour`/`workEndHour` (T6-spec-review-fix, minor a) maakt zulke kalenders al typisch tot
 * een gepromoveerde-via-eigen-banden-of-hoursPerDay-afwijking-kandidaat vóórdat het ankersignaal
 * er nog toe doet. Een kalender die WEL een half-uur-startuur heeft maar verder perfect "rond"
 * (hele-uur-lengte, geen lunch) is, zou dus per abuis altijd in uur-modus belanden — een bekende,
 * ongeteste rand (geen corpusbestand raakt 'm; geen synthetische fixture pint 'm expliciet).
 */
function mppAnchorClock(cal: WorkCalendar): string {
  return `${String(cal.workStartHour).padStart(2, '0')}:00:00`;
}

/**
 * T11 (§9/O6-vervolg): geeft `milestoneKind` aan een UUR-modus-mijlpaal wanneer het opgeslagen
 * anker EXACT op een bandgrens van de effectieve kalender ligt — de informatie die T6's solverkant
 * (`succIsFinishMs`/`predEndsBeginOfDay` in `relationMath.ts`) nodig heeft om MS Projects eigen
 * klokstand (bv. `…T17:00`) te herkennen i.p.v. de eerstvolgende werk-instant (`…T08:00` de
 * volgende dag) te forceren. `milestoneKind` staat al op `Task` en wordt al door de solver
 * geconsumeerd (T6, `70ec7f92`) — geen enkele lezer zette 'm nog vóór deze taak.
 *
 * Kijkt UITSLUITEND naar de KALENDER-EIGEN weekdagbanden (`cal.workTime.byWeekday`, ná promotie
 * door `promoteCalendarsForHourMode` — op het moment dat Fase C dit aanroept is `cal.workTime` dus
 * al gezet voor elke `isHour`-kalender). Geen dag-specifieke holiday-/werkuitzondering-
 * materialisatie (dat is `CalendarEngine`'s taak in de solver, buiten deze lezer se scope): een
 * mijlpaal-anker landt per definitie nooit op een holiday (die dag heeft geen banden in
 * `byWeekday`), en een werkende uitzondering met eigen banden is een T3-aangelegenheid — als de
 * corpusmeting ooit een taak op zo'n dag laat zien die hierdoor ten onrechte `undefined` blijft,
 * is dat een T13-heroverweging, geen gat in deze functie.
 *
 * `minuteOfDay` vergelijkt op UTC-getters (`getUTCHours`/`getUTCMinutes`) — spiegelt de rest van de
 * engine, die overal in UTC-instants zonder DST rekent (zie `dateUtils.ts`'s moduleheader).
 * Seconden worden genegeerd (MPP-tijdstempels zijn al minuut-precies, T5).
 *
 * Bandbegin ⇒ `'START'`; bandeinde ⇒ `'FINISH'`; anders `undefined` (huidig gedrag: geen veld
 * gezet). Een WRAP-band (`end >= 1440`, middernacht-kruisend — INCLUSIEF een band die EXACT om
 * middernacht eindigt, bv. een ploegendienst 20:00–24:00: `resolveOneDay` bouwt zo'n band zonder
 * clamp en `canonicalizeBands` beschouwt 'm niet als afwijkend, dus dit is een volstrekt normale
 * vorm elders in de codebase, geen theoretisch randgeval) staat geregistreerd onder de WEEKDAG
 * WAAROP HIJ BEGINT (§3.2 in `types/calendar.ts`) — de staart landt dus op de VOLGENDE
 * kalenderdag; de bandeinde-check kijkt daarom ook naar de banden van GISTEREN. `b.end - 1440`
 * is dan `0` voor een exact-om-middernacht-eindigende band, wat correct matcht met `minuteOfDay`
 * van een 00:00-anker de dag erna (reviewbevinding: de eerdere STRIKTE `> 1440` miste precies dit
 * geval — een band die letterlijk op middernacht eindigt in plaats van erover heen). Twee
 * aangrenzende banden zonder pauze ertussen (bandeinde van de ene band == bandbegin van de andere,
 * op dezelfde dag) zijn een gedegenereerd geval dat hier als `'START'` uitvalt (de bandbegin-check
 * loopt eerst) — onschadelijk: bij een pauzeloze aaneensluiting is het gat tussen de banden nul,
 * dus of het anker als START van de tweede band of als FINISH van de eerste wordt geclassificeerd
 * maakt voor de datumberekening (dezelfde klokstand, geen dag-boundary-sprong) niets uit.
 */
function deriveMilestoneKind(cal: WorkCalendar, anchor: Date): MilestoneKind | undefined {
  const bands = cal.workTime;
  if (!bands) return undefined;
  const wd = isoDayOfWeek(anchor) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const prevWd = (((wd + 5) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // wd - 1, gewrapt naar 1..7
  const minuteOfDay = anchor.getUTCHours() * 60 + anchor.getUTCMinutes();
  const todays = bands.byWeekday[wd] ?? [];
  for (const b of todays) {
    if (b.start === minuteOfDay) return 'START';
  }
  for (const b of todays) {
    if (b.end === minuteOfDay) return 'FINISH';
  }
  const yesterdays = bands.byWeekday[prevWd] ?? [];
  for (const b of yesterdays) {
    if (b.end >= 1440 && b.end - 1440 === minuteOfDay) return 'FINISH';
  }
  return undefined;
}

/**
 * Z16 (etappe "nul afwijkingen") — detectie voor de eenmalige openings-melding ("dit bestand bevat
 * N taken met een onderbroken, genivelleerde of resource-gedreven planning", `fileSlice.ts`).
 * Vervangt de T12-detectie (§9/O1, vorige etappe) volledig: sinds Z1–Z15 rekenen we zulke taken
 * WÉL door zoals MS Project (splits, nivellering, timephased-vensters, handmatige planning zijn
 * allemaal echt geïmplementeerd) — de melding is dus geen excuus meer voor afwijkende datums,
 * uitsluitend een informatieve mededeling over WAT er in het bestand zit. Geen taakveld (§9/O3,
 * geen documentcontract-impact) — alleen een telling op `ImportResult`. Zie `countScheduleNotes`
 * (hieronder, buiten deze moduleheader) voor de implementatie.
 *
 * DRIE ECHTE SIGNALEN, één per woord in de meldingstekst — geen enkele is nog een schatting:
 *
 * 1. `leveled` — `Task.levelingDelayMinutes` gezet. Bron: `TaskField.LEVELING_DELAY` (FieldMap14.
 *    java: `new FieldItem(TaskField.LEVELING_DELAY, FieldLocation.FIXED_DATA, 0, 58, 20, 0, 0)` —
 *    typeValue 20, corpus-offset 58) ≠ 0, sinds Z5 ECHT gedecodeerd tot een duur (tienden van een
 *    minuut) in plaats van alleen een ≠0-signaal. Veld-id zit sinds Z2 bij haar zusjes in
 *    `fieldMap14.ts`'s `TaskFieldId.LevelingDelay` (T12 hield 'm nog als losse module-lokale
 *    constante — dat kon toen niet anders, `fieldMap14.ts` viel buiten T12's bestandenlijst).
 * 2. `split` — `Task.splitGaps` niet-leeg. Bron: Z4's `deriveSplitGapsForTasks`
 *    (`mppTimephased.ts`), afgeleid uit de timephased-werksegmenten van de toewijzingen van deze
 *    taak — precies het `Task.WORK_SPLITS`-mechanisme dat MPXJ zelf gebruikt
 *    (`ResourceAssignment.getWorkSplits()`), onafhankelijk geherimplementeerd.
 * 3. `timephased` — `Task.timephasedFinishFloor` of `Task.timephasedDurationWalks` gezet. Bron:
 *    Z8's `deriveTimephasedWindowsForTasks` — een gecontoureerde/resource-gedreven toewijzing met
 *    een ECHT gedecodeerde timephased-periode bepaalt het venster (laag 3) of de herberekening
 *    (laag 4) van de taak.
 *
 * WAAROM DE T12-PROXY (`spanGt`) WEG MAG. Vóór Z4/Z8 was geen van deze drie velden leesbaar; T12
 * gebruikte daarom een AFGELEIDE proxy: het MSP-eigen venster tussen start en finish, geteld in
 * werkminuten op de effectieve kalender, groter dan de MSP-eigen opgeslagen duur (met een
 * afrondingstolerantie voor drijvendekomma-restjes). Dat was T12's eigen expliciete UITWIJK ("lukt
 * de splits-bytes niet betrouwbaar, dan…"), geen ontwerp — een schatting die zowel vals-positief
 * (elke echte sub-dag-afwijking > de tolerantie) als vals-negatief kon zijn (zie het contour-onderzoek hieronder:
 * een gecontoureerde taak zonder venster-verlenging mist de proxy per definitie). Nu de drie
 * onderliggende velden zelf leesbaar zijn, is er geen enkele reden meer om via een
 * kalendervenster-schatting te meten wat al rechtstreeks op de taak staat: de proxy en haar
 * tolerantieconstante zijn VERWIJDERD, niet vervangen door een striktere versie.
 *
 * GEVOLG VOOR DE BEKENDE BEPERKING HIERONDER (spec-review-fixronde, 2026-08-15) — de meting in dat
 * onderzoek blijft historisch geldig, maar de CONCLUSIE ("dus niet detecteerbaar, dus niet melden") niet
 * meer: `timephased` hierboven mist het gat van de oude proxy niet. Elke toewijzing met een ÉCHT
 * gedecodeerde timephased-periode (contourvorm of niet) zet `Task.timephasedFinishFloor`/
 * `timephasedDurationWalks`, ongeacht of het venster groter is dan de kale duur — het bit-
 * mechanisme (`AssignmentField.WORK_CONTOUR`) hoeft dus niet meer betrouwbaar te zijn, want de
 * detectieroute loopt niet meer via dat bit. Getoetst op MPXJ's eigen referentiebestand voor deze
 * functie (`mpp14resource.mpp`, taak "Contoured Task"): die telt nu WÉL mee in `timephased` (zie de
 * leescase in `check-mpp-import.ts`) — de beperking is voor elke taak met een echt gedecodeerde
 * periode opgelost, zonder ooit het bit zelf te hoeven lezen.
 *
 * HET CONTOUR-ONDERZOEK — RESOURCE-CONTOURING, EXPLICIET ONDERZOCHT EN NIET BETROUWBAAR GEBLEKEN
 *    (spec-review-fixronde, 2026-08-15, bevinding 1; was "punt 3" in de T12-nummering) — MPXJ leest een contour-indicator op ASSIGNMENT-niveau
 *    (`AssignmentField.WORK_CONTOUR`, een TWEEWAARDIGE FLAT/CONTOURED-vlag, niet de volledige
 *    contourvorm) via een bit in de assignment se EIGEN `FixedMeta`-record (spiegelt hoe
 *    `milestoneBitFlag` hierboven de mijlpaal-vlag uit de taak-FixedMeta leest) —
 *    `ResourceAssignmentFactory.java`: `new MppBitFlag(AssignmentField.WORK_CONTOUR, 8,
 *    0x00000010, WorkContour.FLAT, WorkContour.CONTOURED)` voor MPP14/Project≤2010,
 *    `..., 8, 0x00040000, ...` voor MPP14/Project 2013+ (zelfde offset-8, alleen het masker
 *    verschilt — zelfde `≤14 vs >14`-versiegrens als `milestoneBitFlag`). WORK_CONTOUR staat
 *    NERGENS in `FieldMap14.java`'s generieke assignment-veldentabel (data-gedreven noch default)
 *    — het is uitsluitend via dit bit-mechanisme leesbaar, nooit via de gewone field-map-offset-weg.
 *
 *    GETOETST tegen `mpxj/junit/data/mpp14resource.mpp` (MPXJ se EIGEN referentiebestand voor deze
 *    functie, taak "Contoured Task", assignment-uniqueID 8, taskUniqueID 3, resourceUniqueID 1) —
 *    ground truth bevestigd via het bijbehorende `mpxj/junit/data/mspdiresource.xml` (zelfde project,
 *    zelfde taken/toewijzingen): `<Assignment><UID>8</UID><TaskUID>3</TaskUID><ResourceUID>1</
 *    ResourceUID>…<WorkContour>7</WorkContour></Assignment>` (contourvorm 7 = niet-FLAT) tegenover
 *    `<WorkContour>0</WorkContour>` op de drie overige assignments. Een VOLLEDIGE brute-force-scan
 *    van de 34-byte assignment-FixedMeta-record van uniqueID 8 (élk 4-byte-uitgelijnd offset ×
 *    élke macht-van-twee-masker tot en met bit 23 — dus ook de twee exacte Java-maskers 0x10/
 *    0x40000 op offset 8) tegen de VIER overige assignments in hetzelfde bestand vond GEEN ENKELE
 *    bitpositie die uniek waar is voor assignment 8 en onwaar voor de rest. Byte 8 van assignment 8
 *    is letterlijk `0x01 30 d0 ff` — IDENTIEK aan twee van de drie vlakke assignments (5, 6) van
 *    "Task A" — het bit dat MPXJ's eigen brontabel voor déze offset/dit masker documenteert staat
 *    hier simpelweg niet aan, ondanks bevestigde ground truth dat de toewijzing wél gecontoureerd is.
 *
 *    CONCLUSIE: het bit-mechanisme dat MPXJ zelf documenteert voor WORK_CONTOUR is, GETOETST OP
 *    MPXJ's EIGEN referentievoorbeeld voor precies deze functie, niet betrouwbaar. Dat bleef zo
 *    (deze meting is nooit weerlegd, en het bit is nog steeds niet geïmplementeerd) — maar de
 *    GEVOLGTREKKING eraan (T12: "dus melden we resource-contouring niet") is met Z16's `timephased`-
 *    signaal hierboven ACHTERHAALD: die detecteert via de ECHT gedecodeerde timephased-periode,
 *    nooit via dit bit, en vangt "Contoured Task" daardoor alsnog — zie de corpus-leescase in
 *    `check-mpp-import.ts` die dat nu vastlegt, en de gids (§"Datumgetrouwheid") die dit niet meer
 *    als open beperking benoemt.
 */

/** Z16 — de drie ECHTE signalen (zie de moduleheader hierboven) op de per-taak-velden die Z4/Z5/Z8
 *  al vullen, verenigd tot de telling die `readMPP` op `ImportResult.sourceScheduleNotes` zet. Pure
 *  functie over reeds-gevulde `Task`-objecten — GEEN eigen byte-lezing, dus geen synthetische
 *  CFB-fixture nodig (de hardening-checklist se "corpusloze fixture naast elke corpuspin"-eis geldt
 *  voor byte-lezers; deze functie leest uitsluitend al-gevalideerde `Task`-velden). Draait in
 *  `readMPP` NÁ zowel de `splitGaps`- als de `timephasedFinishFloor`/`timephasedDurationWalks`-
 *  toewijzingslus (beide muteren `tasks` in-place) — vóór die twee lussen zouden `split`/`timephased`
 *  altijd 0 zijn, ongeacht het bronbestand. */
export function countScheduleNotes(
  tasks: readonly Task[],
): { total: number; leveled: number; split: number; timephased: number } {
  let leveled = 0, split = 0, timephased = 0, total = 0;
  for (const task of tasks) {
    const isLeveled = task.levelingDelayMinutes != null;
    const isSplit = (task.splitGaps?.length ?? 0) > 0;
    const isTimephased = task.timephasedFinishFloor != null || task.timephasedDurationWalks != null;
    if (isLeveled) leveled++;
    if (isSplit) split++;
    if (isTimephased) timephased++;
    if (isLeveled || isSplit || isTimephased) total++;
  }
  return { total, leveled, split, timephased };
}

/** I2 (T5-kwaliteitsreview) — vervangt de vijf losse positionele parameters die `readTasks` eerst
 *  had; T6/T7 breiden dit uit i.p.v. de parameterlijst nog verder te laten groeien.
 *
 *  ETAPPE 1.5: `calResult` (T6's kalenders, UNGEPROMOVEERD — zie mppCalendars.ts's moduleheader)
 *  komt er sinds etappe 1.5 bij; `readMPP` roept `readCalendars` daarom nu VÓÓR `readTasks` aan
 *  (omgekeerde volgorde t.o.v. vóór deze etappe) — spiegelt mspdiReader's eigen volgorde
 *  (`parseCalendar` vóór de taken-lus).
 *
 *  Z2 (etappe "nul afwijkingen"): geëxporteerd, samen met `readTasks`/`parseProjectProperties`
 *  hieronder — zelfde testbaarheidsreden als `readRelations`/`readResources`/`readAssignments`
 *  (T7): `check-mpp-import.ts`'s Z2-acceptatietests (block-1-offsetopzoeking, de rode-pad-
 *  fixtures, de corpusbrede manual-taken-telling uit acceptatiepunt 5) hebben rechtstreekse
 *  toegang tot `ReadTasksResult.rawScans` nodig zonder de rest van `readMPP`'s pijplijn
 *  (relaties/resources/assignments) te hoeven optuigen. */
export interface ReadTasksContext {
  cfb: CfbFile;
  taskFieldMap: FieldMapTable;
  hoursPerDay: number;
  statusDate: string | undefined;
  applicationVersion: number | null;
  calResult: CalendarReadResult;
}

/** I2 (T5-kwaliteitsreview) — bereidt de returnvorm voor op T6/T7:
 *  - `taskIdByUniqueId`: T7's TBkndCons-relaties en TBkndAssn-assignments verwijzen naar taken via
 *    hun MPP-uniqueID, niet via het gegenereerde `Task.id` — deze map is precies de vertaling die
 *    daarvoor nodig is (spiegelt mspdiReader's `uidToId`).
 *  - `taskHourById` (etappe 1.5, vervangt de oude `calendarUniqueIdByTaskId` — `Task.calendarId`
 *    wordt nu INLINE gezet tijdens Fase C hieronder, spiegelt mspdiReader's `taskCalendarId`-
 *    toewijzing tijdens de taken-lus, dus een aparte post-hoc-koppelstap in `readMPP` is niet meer
 *    nodig): per taak of ze in UUR-modus is — T7's `readRelations` gebruikt dit voor de
 *    lag-eenheid-keuze, spiegelt mspdiReader's `taskHourById`. */
export interface ReadTasksResult {
  tasks: Task[];
  taskIdByUniqueId: Map<number, string>;
  taskHourById: Map<string, boolean>;
  /** Z2 (etappe "nul afwijkingen") — TEST-/METINGSVELD: de rauwe Fase-A-scan van elke geldige taak,
   *  inclusief de nieuwe Fixed2-velden (`taskMode`, `manualStartTs`/`manualFinishTs`,
   *  `manualDurationRaw`/`manualDurationIsElapsed`, `levelingDelayUnits`). `readMPP` geeft dit NIET
   *  door aan `ImportResult` (nog geen gedragswijziging, zie deze taak se acceptatiepunt 1) —
   *  uitsluitend bedoeld voor `check-mpp-import.ts`'s Z2-acceptatietests (block-1-offsetopzoeking,
   *  de twee rode-pad-fixtures, en de corpusbrede manual-taken-telling uit acceptatiepunt 5, naast
   *  baan M's onafhankelijke `mppGroundTruth.ts`-telling). */
  rawScans: readonly RawTaskScan[];
}

/** Fase A — rauwe scan: alle velden die `readTasks` nodig heeft, als getal/`Date`/string, NOG GEEN
 *  `Task`-object. Kalender-/dag-of-uur-modus-afhankelijke velden (start/finish/duur/actuals/
 *  constraintdatum/deadline) staan hier als rauwe waarde; Fase C formatteert ze pas, ná Fase B's
 *  signaal-scan + promotie. `effCal` is de EFFECTIEVE kalender (taak-override, anders de
 *  projectkalender) — al hier bepaald zodat Fase B er direct het (c)-signaal aan kan toekennen. */
export interface RawTaskScan {
  uniqueId: number;
  id: number;
  outlineLevel: number;
  storedWbs: string | null;
  name: string;
  startTs: Date | null;
  finishTs: Date | null;
  durationRaw: number; // tienden van een minuut
  /** T10: DurationUnits (veld-id 181, ACTUAL_DURATION_UNITS — dient als eenheden-bron voor
   *  SCHEDULED_DURATION, zie `fieldMap14.ts`'s toelichting bij `TaskFieldId.DurationUnits`)
   *  gedecodeerd tot "is dit een ELAPSED-eenheid" (elapsedMinutes/Hours/Days/Weeks/Months/Percent).
   *  Ontbreekt het veld (oude/kapotte field map) dan `false` — spiegelt de bestaande WORKTIME-default. */
  isElapsedDuration: boolean;
  /** T9: rauwe REMAINING_DURATION (tienden van een minuut, zelfde eenheid + eenhedenbron als
   *  `durationRaw` — beide delen ACTUAL_DURATION_UNITS, zie `fieldMap14.ts`). `null` als het veld
   *  ontbreekt in de field map of het record te kort is — Fase C laat `remainingMinutes`/
   *  `remainingTime` dan ongezet (huidig fractioneel-uit-`completion`-gedrag, backwards-compat). */
  remainingDurationRaw: number | null;
  /** T12 — rauwe LEVELING_DELAY (tienden van een minuut, zelfde eenheid als `durationRaw`), sinds
   *  Z5 GEKLEMD (`clampLevelingDelayTenths`, limits.ts) omdat het getal nu ook daadwerkelijk als
   *  duur gedecodeerd wordt (`Task.levelingDelayMinutes`, Fase C) i.p.v. alleen op `≠ 0` getoetst.
   *  `0` als het veld ontbreekt (oude/kapotte field map) — spiegelt de bestaande defaults elders in
   *  deze scan. */
  levelingDelayRaw: number;
  /** Z2 — eenheid/elapsed-vlag-RUW (SHORT, veld-id 178, `TaskFieldId.LevelingDelayUnits`) bij
   *  `levelingDelayRaw` hierboven. Z5 decodeert dit in Fase C tot `Task.levelingDelayElapsed`
   *  (spiegelt `durationUnitsRaw` → `isElapsedDuration` hierboven exact, alleen toegepast op het
   *  LEVELING_DELAY-veldpaar). `null` als het veld ontbreekt in de field map of het record te kort
   *  is — Fase C laat `levelingDelayElapsed` dan ongezet (WORKTIME-default, byte-identiek). */
  levelingDelayUnits: number | null;
  /** Z2 — TASK_MODE (Fixed2Meta-bit, zie `taskModeBitFlag`): MANUALLY_SCHEDULED vs. AUTO_SCHEDULED.
   *  `'AUTO_SCHEDULED'` als het `Fixed2Meta`-record ontbreekt/te kort is óf de stream niet
   *  aanwezig was — spiegelt het bestaande "veld ontbreekt ⇒ neutrale/bestaande default"-patroon
   *  elders in deze scan (byte-identiek gedrag voor een bestand zonder Fixed2Meta). */
  taskMode: MppTaskMode;
  /** Z2 — MANUALLY_SCHEDULED-ankerpaar uit Fixed2Data blok 1 (`TaskFieldId.Start`/`Finish`,
   *  1283/1284) — spiegelt `startTs`/`finishTs` hierboven qua vorm (rauwe `Date`, nog niet
   *  geformatteerd), maar uit het ANDERE blok/veldpaar. `null` als de Fixed2-infrastructuur
   *  ontbreekt, het veld niet in de field map staat, of het record te kort is voor deze offset. */
  manualStartTs: Date | null;
  manualFinishTs: Date | null;
  /** Z2 — rauwe MANUAL_DURATION (Fixed2Data blok 1, offset 58, veld-id 1288, tienden-van-een-
   *  minuut — zelfde vorm/klem-precedent als `durationRaw`/`remainingDurationRaw`, zie
   *  `limits.ts`'s `clampManualDurationTenths`). `null` bij ontbrekend veld/te kort record. */
  manualDurationRaw: number | null;
  /** Z2 — eenheid van `manualDurationRaw` hierboven (`TaskFieldId.ManualDurationUnits`, 1289),
   *  gedecodeerd tot "is dit een ELAPSED-eenheid" — spiegelt `isElapsedDuration`'s decodering
   *  exact, alleen toegepast op het MANUAL_DURATION-veldpaar i.p.v. SCHEDULED_DURATION. `false`
   *  als het eenhedenveld ontbreekt (zelfde WORKTIME-default als `isElapsedDuration`). */
  manualDurationIsElapsed: boolean;
  isMilestone: boolean;
  constraintCode: number | null;
  constraintDateTs: Date | null;
  deadlineTs: Date | null;
  percentComplete: number;
  actualStartTs: Date | null;
  actualFinishTs: Date | null;
  /** Z12-herwerk (dossier out-of-sequence-actuals) — `TaskField.RESUME`/`STOP` (veld-id 99/100,
   *  beide `DataType.DATE`, blok 0). MSP's EIGEN opgeslagen hervattingsinstant/afgewerkt-grens
   *  voor een IN-PROGRESS-taak — spiegelt `actualStartTs`/`actualFinishTs` hierboven qua vorm
   *  (rauwe `Date`, nog niet geformatteerd). `null` bij ontbrekend veld/te kort record — spiegelt
   *  het bestaande "veld ontbreekt ⇒ ongezet"-patroon. `stopTs` wordt momenteel door geen enkele
   *  solverberekening gelezen (de `finish = addWork(resume, remaining)`-formule had 'm niet nodig,
   *  corpusmeting fase 1: 17/17 exact zonder), maar rondt wel mee als rauw feit voor een latere
   *  taak (splits/actual-grens-rendering). */
  resumeTs: Date | null;
  stopTs: Date | null;
  effCal: WorkCalendar;
  /** Alleen gezet als de taak een ECHTE, gevonden kalender-override droeg (spiegelt de oude
   *  `calendarUniqueIdByTaskId`-guard: `calendarUniqueIdRaw >= 0` ÉN de referentie wees naar een
   *  daadwerkelijk gelezen kalender) — bepaalt of Fase C `Task.calendarId` zet. */
  calendarOverride: WorkCalendar | null;
  /** Z14b (eigenaarsbesluit 2026-08-18, punt 1) — rauwe `TaskField.TYPE` (SHORT), `null` bij
   *  ontbrekend veld/te kort record. Fase C decodeert dit via `mspTaskTypeFromRaw`. */
  mspTaskTypeRaw: number | null;
  /** Z14b — rauwe EFFORT_DRIVEN-bit, al gedecodeerd tot boolean (spiegelt `isMilestone` hierboven —
   *  geen apart rauw/gedecodeerd onderscheid nodig voor een enkel bit). */
  effortDrivenRaw: boolean;
}

/** Z2 — spiegelt MPXJ's `TaskMode`-enum (`AUTO_SCHEDULED`/`MANUALLY_SCHEDULED`) letterlijk, zodat
 *  een latere consument (Z9a) geen eigen boolean-naar-string-vertaling hoeft te verzinnen. */
type MppTaskMode = 'AUTO_SCHEDULED' | 'MANUALLY_SCHEDULED';

export function readTasks(ctx: ReadTasksContext): ReadTasksResult {
  const { cfb, taskFieldMap, hoursPerDay, statusDate, applicationVersion, calResult } = ctx;
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    throw new Error('MPP: "   114"/TBkndTask mist een vereiste stream (FixedMeta/FixedData/VarMeta)');
  }
  const var2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Var2Data']); // legitiem afwezig (zie mppPrimitives.ts)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, TASK_FIXED_META_ITEM_SIZE, 'TBkndTask/FixedMeta');
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, 'TBkndTask/FixedData');
  const varMeta = new VarMeta12(varMetaBytes, 'TBkndTask/VarMeta');
  const varData = new Var2Data(varMeta, var2DataBytes);

  // Z2 (etappe "nul afwijkingen") — `Fixed2Meta`/`Fixed2Data` zijn BEIDE optioneel op storage-
  // niveau, spiegelt `mppEntities.ts`'s B7-precedent voor `TBkndRsc/Fixed2Meta` exact (defensief:
  // ontbreken/onleesbaar ⇒ blijven `null`, en élk nieuw `RawTaskScan`-veld hieronder blijft
  // leeg/AUTO_SCHEDULED — huidig gedrag, byte-identiek, zie acceptatiepunt 1/3). `fixed2Meta` is
  // heuristisch gedimensioneerd tegen `fixedData` (blok 0) se itemcount als ankerpunt — exact
  // hetzelfde patroon als `FixedMeta.withHeuristicItemSize`'s resource-aanroep, alleen met de
  // taak-eigen kandidaat-groottes (`TASK_FIXED2_META_ITEM_SIZES`). `fixed2Data` volgt daarna via
  // `FixedData.fromMeta` (zelfde constructie als blok 0's `fixedData` hierboven, nu tegen
  // `fixed2Meta`) — beide delen dus dezelfde item-INDEX als `fixedMeta`/`fixedData`: taak-index
  // `index` verwijst voor alle vier blokken naar hetzelfde record.
  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Meta']);
  const fixed2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Data']);
  let fixed2Meta: FixedMeta | null = null;
  let fixed2Data: FixedData | null = null;
  if (fixed2MetaBytes && fixed2DataBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, TASK_FIXED2_META_ITEM_SIZES, 'TBkndTask/Fixed2Meta');
      fixed2Data = FixedData.fromMeta(fixed2Meta, fixed2DataBytes, 0, 0, 'TBkndTask/Fixed2Data');
    } catch {
      fixed2Meta = null;
      fixed2Data = null;
    }
  }

  const uniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.UniqueId);
  const idOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Id);
  const outlineLevelOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.OutlineLevel);
  const scheduledStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledStart);
  const scheduledFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledFinish);
  const durationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ScheduledDuration);
  const durationUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.DurationUnits);
  const remainingDurationOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.RemainingDuration); // T9
  const constraintTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintType);
  const constraintDateOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ConstraintDate);
  const deadlineOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Deadline);
  const percentCompleteOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.PercentComplete);
  const actualStartOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualStart);
  const actualFinishOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.ActualFinish);
  const resumeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Resume); // Z12-herwerk
  const stopOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Stop); // Z12-herwerk
  const calendarUniqueIdOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.CalendarUniqueId);
  const levelingDelayOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelay); // T12, veld-id verhuisd naar fieldMap14.ts in Z2
  const levelingDelayUnitsOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.LevelingDelayUnits); // Z2
  // Z2 — blok-1-offsets (Fixed2Data): `fixed2OffsetOf`, NIET `fixedOffsetOf` (zie fieldMap14.ts's
  // `FieldEntry`-toelichting: blok 0 en blok 1 zijn fysiek gescheiden records).
  const manualStartOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Start);
  const manualFinishOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.Finish);
  const manualDurationOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDuration);
  const manualDurationUnitsOffset = fixed2OffsetOf(taskFieldMap, TaskFieldId.ManualDurationUnits);
  const nameKey = varDataKeyOf(taskFieldMap, TaskFieldId.Name);
  const wbsKey = varDataKeyOf(taskFieldMap, TaskFieldId.Wbs);
  const mspTaskTypeOffset = fixedOffsetOf(taskFieldMap, TaskFieldId.Type); // Z14b

  // Harde veldmap-check (T5-kwaliteitsreview-minor): UNIQUE_ID/ID alleen was te zwak — een
  // taaklijst zonder NAME (var-data) of zonder SCHEDULED_START/FINISH (fixed-data) is geen
  // leesbaar bestand maar een mis-parse (bv. de verkeerde `TASK_FIELD_MAP`/`TASK_FIELD_MAP2`-
  // sleutel gebruikt, of I3's alles-of-niets-terugval trof een field map die dit specifieke veld
  // simpelweg niet bevat) — beter hard falen dan stilzwijgend taken zonder naam/datum opleveren.
  if (uniqueIdOffset === null || idOffset === null || nameKey === null || scheduledStartOffset === null || scheduledFinishOffset === null) {
    throw new Error('MPP: taak-veldmap mist UNIQUE_ID/ID/NAME/SCHEDULED_START/SCHEDULED_FINISH — kan taken niet betrouwbaar lezen');
  }

  const validIndices = collectValidTaskIndices(fixedMeta, fixedData, varMeta, uniqueIdOffset);
  const { offset: msOffset, mask: msMask } = milestoneBitFlag(applicationVersion);
  const { offset: tmOffset, mask: tmMask } = taskModeBitFlag(applicationVersion); // Z2
  const { offset: edOffset, mask: edMask } = effortDrivenBitFlag(applicationVersion); // Z14b

  // ── Fase A: rauwe scan (zie moduleheader "UURMODUS" + `RawTaskScan`) — nog geen `Task`-object,
  // wél al de effectieve kalender per taak (nodig voor Fase B's signaal-scan). ────────────────────
  const raws: RawTaskScan[] = [];
  for (const [uniqueId, index] of validIndices) {
    if (uniqueId === 0) continue; // projectsamenvattingstaak (net als mspdiReader's uid===0-skip)
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;
    const metaItem = fixedMeta.getByteArrayValue(index);

    const id = data.length >= idOffset + 4 ? getInt(data, idOffset, 'TBkndTask id') : uniqueId;
    const outlineLevelRaw = outlineLevelOffset !== null && data.length >= outlineLevelOffset + 2
      ? getShort(data, outlineLevelOffset, 'TBkndTask outlineLevel')
      : 1;
    const outlineLevel = clampOutlineLevel(outlineLevelRaw); // C1

    const name = varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, 'TBkndTask name') || 'Task';
    // WBS-veld (T5-spec-review, 3): MPP slaat een AUTO-genereerde WBS-code niet op — het var-data-
    // veld is in het corpus voor elke taak leeg. MPXJ genereert 'm zelf in `updateStructure()`
    // (outline-nummering "1.2.3" over de afgeleide hiërarchie); `assignHierarchyAndWbs` spiegelt
    // dat verderop — hier alleen een EXPLICIETE, door de gebruiker ingevoerde WBS-tekst vasthouden
    // (`storedWbs`), zodat een bestand dat 'm wél draagt die overschrijft i.p.v. altijd de
    // gegenereerde vorm te forceren. `MAX_VAR_TEXT_BYTES` (I1) begrenst ook hier het scan-/
    // decodeerwerk, net als bij `name`.
    const storedWbs = wbsKey !== null ? varData.getUnicodeString(uniqueId, wbsKey, MAX_VAR_TEXT_BYTES, 'TBkndTask wbs') : null;

    const startTs = readTimestampField(data, scheduledStartOffset, 'TBkndTask scheduledStart');
    const finishTs = readTimestampField(data, scheduledFinishOffset, 'TBkndTask scheduledFinish');

    const durationRaw = durationOffset !== null && data.length >= durationOffset + 4
      ? getInt(data, durationOffset, 'TBkndTask duration')
      : 0;

    // T10: DurationUnits (short) → MppTimeUnit → "is dit een ELAPSED-eenheid" (spiegelt
    // MPPUtility.getDurationTimeUnits + de DataType.DURATION-tak in FieldMap.java's readFixedData,
    // die ACTUAL_DURATION_UNITS als eenheden-bron voor SCHEDULED_DURATION gebruikt). Ontbreekt het
    // veld, dan blijft `isElapsedDuration` false — de bestaande WORKTIME-default, ongewijzigd.
    const durationUnitsRaw = durationUnitsOffset !== null && data.length >= durationUnitsOffset + 2
      ? getShort(data, durationUnitsOffset, 'TBkndTask durationUnits')
      : null;
    const isElapsedDuration = durationUnitsRaw !== null
      && getDurationTimeUnits(durationUnitsRaw).startsWith('elapsed');

    // T9: REMAINING_DURATION — zelfde INT-vorm/eenheid als SCHEDULED_DURATION (zie
    // `fieldMap14.ts`'s toelichting bij `TaskFieldId.RemainingDuration`). `null` bij ontbrekend
    // veld/te kort record — Fase C valt dan terug op het bestaande fractionele-uit-`completion`-pad.
    // N3 (Opus-review, hardening-§7): `clampRemainingDurationTenths` (limits.ts) begrenst de rauwe
    // waarde vóórdat hij verderop in datum-arithmetiek terechtkomt — zie de klem se meetcommentaar
    // voor het waarom (structureel INT32-begrensd, maar met een eigen, gedocumenteerde bovengrens
    // i.p.v. stil te vertrouwen op de dieper liggende CalendarEngine-/duration.ts-klemmen).
    const remainingDurationRaw = remainingDurationOffset !== null && data.length >= remainingDurationOffset + 4
      ? clampRemainingDurationTenths(getInt(data, remainingDurationOffset, 'TBkndTask remainingDuration'))
      : null;

    // T12: LEVELING_DELAY — zelfde INT-vorm als SCHEDULED_DURATION (tienden van een minuut). Z5:
    // GEKLEMD (`clampLevelingDelayTenths`, limits.ts) — zie die klem se meetcommentaar voor het
    // waarom (spiegelt `clampRemainingDurationTenths`/`clampManualDurationTenths` op hun buurvelden).
    const levelingDelayRaw = levelingDelayOffset !== null && data.length >= levelingDelayOffset + 4
      ? clampLevelingDelayTenths(getInt(data, levelingDelayOffset, 'TBkndTask levelingDelay'))
      : 0;
    // Z2: LEVELING_DELAY_UNITS — rauw bewaard, decodering is Z5-werk (zie RawTaskScan se toelichting).
    const levelingDelayUnits = levelingDelayUnitsOffset !== null && data.length >= levelingDelayUnitsOffset + 2
      ? getShort(data, levelingDelayUnitsOffset, 'TBkndTask levelingDelayUnits')
      : null;

    const isMilestone = !!metaItem && metaItem.length >= msOffset + 4
      && (getInt(metaItem, msOffset, 'TBkndTask milestone-flag') & msMask) !== 0;

    // Z14b — EFFORT_DRIVEN, zelfde metaItem/FixedMeta-record als isMilestone hierboven (andere
    // regel binnen dezelfde bit-flag-tabel, zie effortDrivenBitFlag).
    const effortDrivenRaw = !!metaItem && metaItem.length >= edOffset + 4
      && (getInt(metaItem, edOffset, 'TBkndTask effortDriven-flag') & edMask) !== 0;
    // Z14b — TYPE (MSP's Task Type), FixedData blok 0, SHORT. `null` bij ontbrekend veld/te kort
    // record — zie mspTaskTypeFromRaw voor het onderscheid "onbekend" vs. "aanwezig maar ongeldig".
    const mspTaskTypeRaw = mspTaskTypeOffset !== null && data.length >= mspTaskTypeOffset + 2
      ? getShort(data, mspTaskTypeOffset, 'TBkndTask type')
      : null;

    // Z2 — TASK_MODE, uit het taak-EIGEN `Fixed2Meta`-record op DEZELFDE index als `metaItem`/`data`
    // hierboven (zie de toelichting bij `fixed2Meta`'s constructie: alle vier blokken delen de
    // taak-index). Ontbreekt de stream/is het record te kort ⇒ AUTO_SCHEDULED (huidig gedrag,
    // byte-identiek — spiegelt `isFixed2MetaCostBit`'s defensieve stijl in `mppEntities.ts`).
    const metaData2 = fixed2Meta?.getByteArrayValue(index) ?? null;
    const taskMode: MppTaskMode = metaData2 && metaData2.length > tmOffset && (metaData2[tmOffset] & tmMask) !== 0
      ? 'MANUALLY_SCHEDULED'
      : 'AUTO_SCHEDULED';

    // Z2 — MANUALLY_SCHEDULED-ankerpaar + handmatige duur, uit het taak-EIGEN `Fixed2Data`-record
    // (blok 1, zelfde index-precedent als `metaData2` hierboven). `fixed2Record` is `null` als de
    // Fixed2-infrastructuur ontbreekt óf dit specifieke record leeg is (`FixedData.getByteArrayValue`
    // geeft dan `null`, net als bij het blok-0-equivalent `data`) — élk veld hieronder degradeert
    // dan netjes naar zijn ontbrekend-default, spiegelt `readTimestampField`/de bestaande
    // `data.length >= offset + N`-guards exact (acceptatiepunt 4: een te kort record geeft `null`,
    // geen out-of-bounds-lees).
    const fixed2Record = fixed2Data?.getByteArrayValue(index) ?? null;
    const manualStartTs = fixed2Record ? readTimestampField(fixed2Record, manualStartOffset, 'TBkndTask/Fixed2Data manualStart') : null;
    const manualFinishTs = fixed2Record ? readTimestampField(fixed2Record, manualFinishOffset, 'TBkndTask/Fixed2Data manualFinish') : null;
    const manualDurationRaw = fixed2Record && manualDurationOffset !== null && fixed2Record.length >= manualDurationOffset + 4
      ? clampManualDurationTenths(getInt(fixed2Record, manualDurationOffset, 'TBkndTask/Fixed2Data manualDuration'))
      : null;
    const manualDurationUnitsRaw = fixed2Record && manualDurationUnitsOffset !== null && fixed2Record.length >= manualDurationUnitsOffset + 2
      ? getShort(fixed2Record, manualDurationUnitsOffset, 'TBkndTask/Fixed2Data manualDurationUnits')
      : null;
    const manualDurationIsElapsed = manualDurationUnitsRaw !== null
      && getDurationTimeUnits(manualDurationUnitsRaw).startsWith('elapsed');

    const constraintCode = constraintTypeOffset !== null && data.length >= constraintTypeOffset + 2
      ? getShort(data, constraintTypeOffset, 'TBkndTask constraintType')
      : null;
    const constraintDateTs = readTimestampField(data, constraintDateOffset, 'TBkndTask constraintDate');
    const deadlineTs = readTimestampField(data, deadlineOffset, 'TBkndTask deadline');
    const percentComplete = readPercentComplete(data, percentCompleteOffset);
    const actualStartTs = readTimestampField(data, actualStartOffset, 'TBkndTask actualStart');
    const actualFinishTs = readTimestampField(data, actualFinishOffset, 'TBkndTask actualFinish');
    // Z12-herwerk — RESUME/STOP, zelfde vorm/guard als actualStart/actualFinish hierboven.
    const resumeTs = readTimestampField(data, resumeOffset, 'TBkndTask resume');
    const stopTs = readTimestampField(data, stopOffset, 'TBkndTask stop');

    // CALENDAR_UNIQUE_ID: -1 (of ontbrekend veld) = geen taak-kalender-override, spiegelt
    // MPP14Reader.java's `calendarID.intValue() == -1 ⇒ task.setCalendarUniqueID(null)`. `effCal` =
    // de gevonden override, anders de projectkalender (spiegelt mspdiReader's `effCalIdOfUid`);
    // `calendarOverride` blijft alleen gezet als de referentie ECHT naar een gelezen kalender wees
    // (Fase C zet `Task.calendarId` alleen dán — spiegelt het oude post-hoc-koppelgedrag exact).
    const calendarUniqueIdRaw = calendarUniqueIdOffset !== null && data.length >= calendarUniqueIdOffset + 4
      ? getInt(data, calendarUniqueIdOffset, 'TBkndTask calendarUniqueId')
      : -1;
    const calendarOverride = calendarUniqueIdRaw >= 0 ? (calResult.calendarByUniqueId.get(calendarUniqueIdRaw) ?? null) : null;
    const effCal = calendarOverride ?? calResult.projectCalendar;

    raws.push({
      uniqueId, id, outlineLevel, storedWbs, name, startTs, finishTs, durationRaw, isElapsedDuration,
      remainingDurationRaw, levelingDelayRaw, levelingDelayUnits, taskMode, manualStartTs, manualFinishTs,
      manualDurationRaw, manualDurationIsElapsed, isMilestone, constraintCode, constraintDateTs, deadlineTs,
      percentComplete, actualStartTs, actualFinishTs, resumeTs, stopTs, effCal, calendarOverride,
      mspTaskTypeRaw, effortDrivenRaw,
    });
  }

  // ── Fase B: (c)-signaal per kalender verzamelen + promoveren (spiegelt mspdiReader's
  // `cSignalCalIds`-lus + `promoteHourCalendar`-lus in `readMSPDI`, vóór de taken-opbouw). Gebruikt
  // per taak de EFFECTIEVE kalender se nog-NIET-gepromoveerde `hoursPerDay` (scalar, uit
  // `buildCalendarFromDays`) — precies zoals mspdiReader's signaal-scan de SCALAR `cal.hoursPerDay`
  // leest vóór promotie. ───────────────────────────────────────────────────────────────────────
  const cSignalCals = new Set<WorkCalendar>();
  for (const raw of raws) {
    const cal = raw.effCal;
    const durMinutes = raw.durationRaw / 10;
    const durSignal = isSubDayMinutes(durMinutes, cal.hoursPerDay);
    const anchor = mppAnchorClock(cal);
    const dateSignal =
      (raw.startTs != null && hasNonAnchorTime(formatInstant(raw.startTs, 'hour'), anchor)) ||
      (raw.finishTs != null && hasNonAnchorTime(formatInstant(raw.finishTs, 'hour'), anchor));
    if (durSignal || dateSignal) cSignalCals.add(cal);
  }
  const hourModeCals = promoteCalendarsForHourMode(calResult.calendarByUniqueId, cSignalCals);

  // ── Fase C: de uiteindelijke `Task`-objecten, met de nu bekende dag/uur-beslissing per taak
  // (spiegelt mspdiReader's taken-opbouwlus, die ook pas ná de promotie-lus draait). ─────────────
  const taskIdByUniqueId = new Map<number, string>();
  const taskHourById = new Map<string, boolean>();
  const records: RawTaskRecord[] = [];
  for (const raw of raws) {
    const cal = raw.effCal;
    const isHour = hourModeCals.has(cal);
    const effHpd = cal.hoursPerDay;

    // Duur: uur ⇒ minuten (bron van waarheid, geen dag-afronding — spiegelt mspdiReader's §7.3-pad);
    // dag ⇒ het bestaande dag-pad, ONGEWIJZIGD op de PROJECT-brede `hoursPerDay` (niet `effHpd`) —
    // spiegelt exact het gedrag van vóór etappe 1.5, zodat een genuine dag-modus-bestand met een
    // taak-kalender-override (ander hoursPerDay dan het project) geen stille duurwijziging krijgt.
    // SCOPING (T10-spec-review, BIJGEWERKT ná T8 — T8-review L1): dit `isHour`-pad zet
    // `durationMinutes` op `raw.durationRaw / 10` ONGEACHT WORKTIME/ELAPSEDTIME — dat getal zelf is
    // dus al klok-tijd-neutraal correct (een minuut is een minuut, zie de T10-corpuscase hieronder
    // in check-mpp-import.ts). T10 zelf was uitsluitend een correcte LEESKANT — de SOLVER rekende
    // deze `durationMinutes` op een uur-kalender toen nog elapsed-naïef (als WERKtijd, begrensd door
    // de kalenderbanden i.p.v. 24/7 doorlopend). Sinds T8 (`CPMSolver.ts`'s
    // `addDurationChecked`/`subDuration`/`finishFromStart`/`startFromFinish`, allen `durationType`-
    // bewust via `duration.ts`'s `elapsedMinutesOf`/`addElapsedMinutes`/`subtractElapsedMinutes`)
    // is dat hier gelezen `durationMinutes` ook op een uur-kalender daadwerkelijk eind-tot-eind
    // kloppend voor ELAPSEDTIME-taken. T8-review-BEPERKING: dat geldt voor de duur-TOEPASSING zelf,
    // niet (nog) voor MSO/MFO-constraint-snaps op een ELAPSEDTIME-taak (zie de T8-REIKWIJDTE-notitie
    // bij `CPMSolver.hardPinStart`) en niet voor de relatie-vrije-speling-eenheid wanneer de
    // VOORGANGER elapsed is (zie de M2/L3-notitie bij `scheduleAnalysis.ts`'s relFloat-berekening).
    const durationMinutes = isHour ? Math.round(raw.durationRaw / 10) : undefined;
    // T10-conversievalkuil (zie het plan bij DurationUnits): een ELAPSED-duur ligt in MPP al vast
    // in KLOK-minuten (spiegelt MPPUtility.getAdjustedDuration's ELAPSED_DAYS/-WEEKS/-MONTHS-takken —
    // vaste 24-uursdag, GEEN `properties.getMinutesPerDay()`/`hoursPerDay`-factor, ongeacht de
    // nominale eenheid waarin de gebruiker de duur oorspronkelijk invoerde). `tenthsOfMinutesToDays`
    // deelt door `hoursPerDay × 60` (WERK-tijd-semantiek) — op die ELAPSED klok-minuten toegepast zou
    // dat de dag-omrekening ONTERECHT een tweede keer door `hoursPerDay` delen. Dag-modus + elapsed
    // rekent daarom rechtstreeks met de vaste klok-dag (24 × 60 × 10 tienden), ongeacht `hoursPerDay`.
    // BEREIK VAN DEZE FIX: uitsluitend het DAG-MODUS-pad hieronder (`raw.isElapsedDuration` ⇒
    // klok-dag-deler). Het UUR-MODUS-pad hierboven kreeg GEEN aparte elapsed-correctie — dat was ook
    // niet nodig voor `durationMinutes` zelf (zie de SCOPING-toelichting hierboven), maar betekent wél
    // dat de SOLVER-kant die deze klokduur daadwerkelijk 24/7 doorrekent (op BEIDE kalendermodi) T8
    // is, niet dit bestand.
    const duration = isHour
      ? (effHpd > 0 ? durationMinutes! / (effHpd * 60) : 0)
      : raw.isElapsedDuration
        ? raw.durationRaw / (24 * 60 * 10)
        : tenthsOfMinutesToDays(raw.durationRaw, hoursPerDay);

    // T9 (voortgangsafronding, MEET-EERST): REMAINING_DURATION rechtstreeks meenemen — zelfde
    // eenheden-/elapsed-conversie als `duration` hierboven, alleen op `remainingDurationRaw`
    // toegepast. `null` (veld ontbreekt/record te kort) ⇒ beide ongezet, CPMSolver valt dan terug
    // op de fractionele afleiding uit `completion` (bestaand gedrag, ongewijzigd). Doel: MSP's EIGEN
    // restduur is EXACT (bv. 4 werkdagen = 1920 minuten), terwijl `completion` afgerond is opgeslagen
    // (bv. 33% i.p.v. het werkelijke 33,33…%) — `(1 − 0,33) × scheduleDuration` geeft dan een
    // fractionele restduur (1929,6 min) die op een klokstand landt die MS Project zelf nooit toont
    // (bv. 08:10 i.p.v. een bandgrens). Zie de moduleheader-verwijzing naar `normalizeImportedProgress`
    // (§9.4-noot, BESLIST): voor DAG-modus overschrijft die de hier gezette `remainingTime` nog steeds
    // met de afgeleide waarde — dat blijft zo (ongewijzigd besluit); alleen `remainingMinutes`
    // (UUR-modus) wordt door die functie NOOIT aangeraakt, en dat is precies het corpuspad waar dit
    // T9-mechanisme optreedt (vrijwel elk bestand leest al in uur-modus, zie de moduleheader).
    const remainingMinutes = isHour && raw.remainingDurationRaw !== null
      ? Math.round(raw.remainingDurationRaw / 10)
      : undefined;
    const remainingTime = !isHour && raw.remainingDurationRaw !== null
      ? (raw.isElapsedDuration
        ? raw.remainingDurationRaw / (24 * 60 * 10)
        : tenthsOfMinutesToDays(raw.remainingDurationRaw, hoursPerDay))
      : undefined;

    const formatField = (ts: Date | null): string | undefined =>
      ts ? (isHour ? formatInstant(ts, 'hour') : formatDate(ts)) : undefined;
    // Z9a — `Task.time.scheduleStart`/`scheduleFinish` dragen het veldpaar dat MSP ZELF voor déze
    // taak gebruikt (`resolveScheduleField`, zie haar docblok hierboven voor de corpusmeting): het
    // manual-ankerpaar (1283/1284) voor een MANUALLY_SCHEDULED-taak met een gevuld anker, anders
    // (AUTO, of manual zonder eigen anker) het bestaande SCHEDULED_START/FINISH-paar (35/36) —
    // ONGEWIJZIGD gedrag voor elke AUTO-taak (`isManual === false` ⇒ `resolveScheduleField` geeft
    // altijd `scheduled` terug zolang die niet leeg is, exact `raw.startTs`/`finishTs` van vóór
    // deze fixronde) en voor de 55 manual-bestanden waar beide velden toch al samenvielen.
    const isManual = raw.taskMode === 'MANUALLY_SCHEDULED';
    const resolvedStartTs = resolveScheduleField(raw.manualStartTs, raw.startTs, isManual);
    const resolvedFinishTs = resolveScheduleField(raw.manualFinishTs, raw.finishTs, isManual);
    const start = formatField(resolvedStartTs) ?? formatDate(new Date());
    const finish = formatField(resolvedFinishTs) ?? start;
    const actualStart = formatField(raw.actualStartTs);
    const actualFinish = formatField(raw.actualFinishTs);
    // Z12-herwerk — RESUME/STOP, zelfde format-/dag-of-uur-modus-keuze als actualStart/actualFinish.
    const resume = formatField(raw.resumeTs);
    const stop = formatField(raw.stopTs);

    let constraint: TaskConstraint | undefined;
    if (raw.constraintCode !== null) {
      const mapped = mspCodeToConstraint(raw.constraintCode);
      if (mapped) {
        const constraintDate = formatField(raw.constraintDateTs);
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(constraintDate ? { date: constraintDate } : {}),
        };
      }
    }
    const deadline = formatField(raw.deadlineTs);

    let status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED' = 'NOT_STARTED';
    if (raw.percentComplete >= 100) status = 'COMPLETED';
    else if (raw.percentComplete > 0) status = 'STARTED';

    // T11: `milestoneKind` alleen afleiden voor een UUR-modus-mijlpaal (§9/O6-vervolg — de
    // MSPDI-kant is BAAN K/T4, niet dit bestand). `raw.finishTs ?? raw.startTs` is het opgeslagen
    // anker: bij een echte mijlpaal (duur 0) zijn beide gelijk, dus de keuze is neutraal; ontbreekt
    // finish (nooit in de praktijk, wel theoretisch mogelijk bij een kapot record) dan valt terug op
    // start. `deriveMilestoneKind` retourneert `undefined` — geen veld gezet, huidig gedrag — zowel
    // buiten uur-modus als wanneer het anker niet exact op een bandgrens ligt.
    //
    // T15 (mijlpaal-met-duur, §9/O1): `raw.isMilestone` alléén is niet genoeg — MSP staat de vlag
    // toe op een taak met een reële duur (`isMilestone=true` + `durationRaw>0`, bewezen op
    // `mpp14task.mpp`/`mpp14task-from2013.mpp`/`taskFlags-mpp14Project2010/2013.mpp`, vier publieke
    // MPXJ-fixtures). Zo'n taak is voor de PLANNING geen mijlpaal (`CPMSolver.isZeroDurationMilestone`
    // spiegelt deze zelfde eis); zonder de `durationRaw === 0`-guard hier zou `milestoneKind` alsnog
    // een FINISH-instant-landing afleiden voor een taak die de solver terecht als gewone taak
    // behandelt — een mismatch die `snapSuccessorEarlyStart` (CPMSolver.ts) op de VERKEERDE taak zou
    // toepassen.
    const milestoneAnchor = raw.finishTs ?? raw.startTs;
    const milestoneKind = raw.isMilestone && raw.durationRaw === 0 && isHour && milestoneAnchor
      ? deriveMilestoneKind(cal, milestoneAnchor)
      : undefined;

    // Z5 (etappe "nul afwijkingen"): LEVELING_DELAY wordt hier een ECHTE duur — niet langer alleen
    // het `≠0`-detectiesignaal hierboven (`leveled`). Hergebruikt het bestaande `durationRaw`-pad
    // ("tienden van een minuut", zelfde `Math.round(raw/10)`-omrekening als `durationMinutes`
    // hierboven) — MPPUtility.getDuration draagt letterlijk "Value is given in 1/10 of minute"; de
    // "tienduizendsten van een minuut"-hypothese uit de vorige planronde is daarmee WEERLEGD (zie
    // Z5 in het nul-afwijkingen-plan, met MPXJ's eigen bron als bewijs — geen tweede conversie
    // verzonnen). `levelingDelayUnits` (LEVELING_DELAY_UNITS, veld-id 178) levert de elapsed-vlag
    // via dezelfde `getDurationTimeUnits`/`isElapsedDuration`-conventie als `durationUnitsRaw`
    // hierboven (T10).
    //
    // AANWEZIG ⇒ bron van waarheid (`Task.levelingDelayMinutes`' Z0-precedent, spiegelt
    // `durationMinutes`); AFWEZIG (raw===0) ⇒ GEEN van beide velden gezet — byte-identiek aan vóór
    // Z5 (acceptatiepunt 3). Het BESTAANDE `Task.levelingDelay` (hele werkdagen, gezet door de
    // nivelleerder, fase 2.5) blijft hier BEWUST ONGEMOEID: `CPMSolver.forwardPass` past dat veld
    // al ONGECLAUSULEERD toe (`if (task.levelingDelay) earlyStart = cal.addWorkingDaysSigned(...)`),
    // dus 'm hier ook vullen zou de fidelity-meting VERANDEREN vóórdat Z6 er de uur-precisie- en
    // backward-spiegel bij heeft — expliciet verboden door Z5-acceptatiepunt 4 ("fidelity
    // ongewijzigd, toepassing is Z6-werk: de motorkant"). Z6 is de motorkant die
    // `levelingDelayMinutes`/`levelingDelayElapsed` daadwerkelijk gaat toepassen.
    const levelingDelayMinutes = raw.levelingDelayRaw !== 0
      ? Math.round(raw.levelingDelayRaw / 10)
      : undefined;
    const levelingDelayElapsed = raw.levelingDelayRaw !== 0 && raw.levelingDelayUnits !== null
      && getDurationTimeUnits(raw.levelingDelayUnits).startsWith('elapsed');

    // Z14b — zie mspTaskTypeFromRaw hierboven voor de decoderingsregel.
    const mspTaskType = mspTaskTypeFromRaw(raw.mspTaskTypeRaw);

    const task: Task = {
      id: generateId('task'),
      name: raw.name,
      description: '',
      wbsCode: '', // wordt hieronder gezet — outline-nummering volgt pas ná de hiërarchie-opbouw
      taskType: 'CONSTRUCTION',
      status,
      isMilestone: raw.isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId: null,
      childIds: [],
      time: {
        durationType: raw.isElapsedDuration ? 'ELAPSEDTIME' : 'WORKTIME',
        scheduleDuration: duration,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: start,
        scheduleFinish: finish,
        earlyStart: start,
        earlyFinish: finish,
        lateStart: start,
        lateFinish: finish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        ...(resume != null ? { resume } : {}),
        ...(stop != null ? { stop } : {}),
        ...(remainingTime != null ? { remainingTime } : {}),
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: raw.percentComplete / 100,
      },
      resourceIds: [],
      ...(constraint ? { constraint } : {}),
      ...(deadline ? { deadline } : {}),
      ...(raw.calendarOverride ? { calendarId: raw.calendarOverride.id } : {}),
      ...(levelingDelayMinutes != null ? { levelingDelayMinutes } : {}),
      ...(levelingDelayElapsed ? { levelingDelayElapsed } : {}),
      // Z9a — de éne doorzetregel (gemeld, plan-§Z9a): `raw.taskMode` wordt sinds Z2 gelezen maar
      // bereikte `Task.manuallyScheduled` nooit. `isManual` hierboven (Phase C) is exact dezelfde
      // waarde — hergebruikt, geen tweede taskMode-vergelijking. Afwezig/false ⇒ byte-identiek
      // (ongewijzigd AUTO-gedrag, ook voor élke niet-.mpp-bron).
      ...(isManual ? { manuallyScheduled: true } : {}),
      // Z14b (eigenaarsbesluit 2026-08-18, punt 1) — puur data, geen rekengedrag (zie
      // mspTaskTypeFromRaw/effortDrivenBitFlag hierboven voor de veldherkomst).
      ...(mspTaskType ? { mspTaskType } : {}),
      ...(raw.effortDrivenRaw ? { effortDriven: true } : {}),
    };
    records.push({ uniqueId: raw.uniqueId, id: raw.id, outlineLevel: raw.outlineLevel, storedWbs: raw.storedWbs, task });
    taskIdByUniqueId.set(raw.uniqueId, task.id);
    taskHourById.set(task.id, isHour);
  }

  // ID-volgorde = zowel de Gantt-/rijvolgorde die MS Project's eigen XML-export gebruikt, als
  // exact wat MPXJ's `ProjectFile.updateStructure()` zelf doet om de boom op te bouwen (zie
  // moduleheader) — nodig voor de outline-level-stack-hiërarchie in `assignHierarchyAndWbs`.
  records.sort((a, b) => a.id - b.id);
  assignHierarchyAndWbs(records);

  const tasks = records.map((r) => r.task);
  normalizeImportedProgress(tasks, statusDate);
  return {
    tasks, taskIdByUniqueId, taskHourById,
    rawScans: raws, // Z2 — zie ReadTasksResult se toelichting; readMPP hieronder geeft dit NIET door
  };
}

/** `parseProjectProperties`'s resultaat — `calendarHoursPerDayOverride` is `null` wanneer
 *  MINUTES_PER_DAY afwezig/ongeldig was (zie de klem-toelichting bij `hoursPerDay` hieronder): in
 *  dat geval blijft de kalender se EIGEN, uit haar werktijd-banden afgeleide `hoursPerDay` staan
 *  (T6) i.p.v. die blind te overschrijven met de 8-uursdag-terugval die `hoursPerDay` zelf gebruikt
 *  voor de taakduur-afronding — spiegelt mspdiReader's `if (minutesPerDay > 0) calendar.hoursPerDay
 *  = ...` (alleen overschrijven als de projecteigenschap ECHT aanwezig was).
 *
 *  Z2: geëxporteerd — zie `ReadTasksContext`'s toelichting over waarom `check-mpp-import.ts`
 *  rechtstreeks toegang nodig heeft tot de `readTasks`-preambule. */
export function parseProjectProperties(
  props: Props,
  labels: ImportLabels | undefined,
): { project: Project; hoursPerDay: number; calendarHoursPerDayOverride: number | null } {
  const titleBytes = props.getByteArray(PROPS_KEY_TITLE);
  const name = (titleBytes ? getUnicodeString(titleBytes, 0, MAX_VAR_TEXT_BYTES, 'Props title') : '') || labels?.importedProject || 'MS Project Import';

  const startBytes = props.getByteArray(PROPS_KEY_PROJECT_START_DATE);
  const finishBytes = props.getByteArray(PROPS_KEY_PROJECT_FINISH_DATE);
  const startDate = startBytes && startBytes.length >= 4 ? getTimestamp(startBytes, 0, 'Props startDate') : null;
  const finishDate = finishBytes && finishBytes.length >= 4 ? getTimestamp(finishBytes, 0, 'Props finishDate') : null;

  // minutesPerDay-klem (T5-kwaliteitsreview-minor): een dag heeft hoogstens 1440 minuten — zonder
  // bovengrens zou een corrupt/hostile Props-veld een absurde `hoursPerDay` (en dus een absurde
  // duur-in-dagen-afronding, zie `tenthsOfMinutesToDays`) kunnen opleveren i.p.v. netjes op
  // de 8-uursdag-default terug te vallen.
  const minutesPerDay = props.getInt(PROPS_KEY_MINUTES_PER_DAY);
  const minutesPerDayValid = minutesPerDay > 0 && minutesPerDay <= 1440;
  const hoursPerDay = minutesPerDayValid ? minutesPerDay / 60 : 8;

  const project: Project = {
    id: generateId('proj'),
    name,
    description: '',
    startDate: startDate ? formatDate(startDate) : formatDate(new Date()),
    endDate: finishDate ? formatDate(finishDate) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    // T9 (voortgangsafronding, MSP-pariteit): élke `.mpp`-import toont MSP's eigen restwerk-
    // hervattingsconventie (`actualStart + reeds-verstreken-duur`, zie `CPMSolver.ts`'s
    // `resumeFromActualElapsed`-toelichting) — corpusbreed gemeten, geen per-taak-signaal, dus hier
    // project-breed gezet in plaats van per taak afgeleid. Byte-identiek voor bestanden zonder
    // statusdatum/voortgang (de hele tak in `CPMSolver.ts` is dan toch een no-op).
    // B1 (eindreview T16c, dossier (c)4-herdiagnose): idem voor NIET-gestarte taken — MS Project
    // verschuift die niet automatisch naar op-of-ná de statusdatum (P6-eigen RETAINED_LOGIC-vloer,
    // zie `unstartedIgnoresStatusDate`'s docblock in `src/types/project.ts`). Zelfde reikwijdte-
    // redenering: élke `.mpp`-import, project-breed, byte-identiek zonder statusdatum.
    // Z12-herwerk (dossier out-of-sequence-actuals): GEEN eigen vlag meer hier — het Opus-
    // weerlegde ankerontwerp (project-breed, vlag-gedreven) is vervangen door een veldgedreven
    // formule (`CPMSolver.ts` leest `task.time.resume`, hierboven al per taak gelezen uit MPP-
    // veld-id 99). De AANWEZIGHEID van `resume` op een taak ís het signaal; er is dus niets meer
    // project-breed te zetten (spiegelt hoe `actualStart` ook geen eigen vlag nodig heeft).
    schedulingOptions: {
      resumeFromActualElapsed: true,
      unstartedIgnoresStatusDate: true,
    },
  };

  const statusBytes = props.getByteArray(PROPS_KEY_STATUS_DATE);
  const statusDate = statusBytes && statusBytes.length >= 4 ? getTimestamp(statusBytes, 0, 'Props statusDate') : null;
  if (statusDate) project.statusDate = formatDate(statusDate);

  return { project, hoursPerDay, calendarHoursPerDayOverride: minutesPerDayValid ? hoursPerDay : null };
}

/**
 * Entry point (T5-T7). `.mpp` (MPP14) → compleet `ImportResult`, met dezelfde veldsemantiek als
 * `readMSPDI`.
 */
/**
 * T6-kwaliteitsreview (minor M6): de container-/Props-/versiepreambule van `readMPP` (CfbFile →
 * `assertReadable` → `detectApplicationVersion` → `"   114"/Props`) geëxtraheerd tot een losse,
 * geëxporteerde functie — vóór deze fix hield `check-mpp-import.ts`'s T6-crawl-sectie een HANDMATIGE
 * kopie van precies deze vier stappen aan (om bij `readCalendars` te kunnen zonder de volledige
 * `readMPP` te hoeven draaien), met het risico dat de twee stilzwijgend uit elkaar lopen zodra deze
 * preambule ooit verandert. Nu is er ÉÉN bron: zowel `readMPP` hieronder als testcode importeren
 * `openMppProject`.
 */
export interface OpenMppProject {
  cfb: CfbFile;
  projectProps: Props;
  applicationVersion: number | null;
}

export function openMppProject(bytes: Uint8Array): OpenMppProject {
  const cfb = new CfbFile(bytes);
  assertReadable(cfb); // gooit MppUnsupportedError voor legacy/versleuteld, of een gewone Error
  // voor een onherkenbaar bestand (T4).

  const applicationVersion = detectApplicationVersion(cfb);

  const projectPropsBytes = cfb.getStream(['   114', 'Props']);
  if (!projectPropsBytes) {
    throw new Error('MPP: "   114"/Props ontbreekt — geen geldig MPP14-bestand');
  }
  const projectProps = new Props(projectPropsBytes, '   114/Props');

  return { cfb, projectProps, applicationVersion };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Z4 (etappe "nul afwijkingen") — splitsegmenten koppelen aan de taak. Het AFLEIDEN van
// `TaskSplitGap[]` uit periodes is `mppTimephased.ts`'s werk (`deriveSplitGapsFromPeriods`/
// `deriveTaskSplitGaps`/`shiftPeriods` — zie diens moduleheader voor de meetstap/het algoritme/de
// aggregatieregel/de taak-as-correctie); hier gebeurt de KOPPELING (welke RUWE `TBkndAssn`-
// uniqueId — Z3's `readAssignmentTimephasedRaw`-sleutel — hoort bij welke `Task`, met welk
// ankerpunt) én de ENIGE kalenderwandeling die Z4 nodig heeft (assignment-start/resume →
// taak-relatieve werkminuten, via `CalendarEngine.workMinutesBetween` — zie mppTimephased.ts's
// "TAAK-AS, NIET TOEWIJZINGS-AS"-paragraaf voor waarom die wandeling HIER hoort en niet in de
// calendar-vrije decoder-module).
//
// UID→TAAK, NIET UID→`ResourceAssignment.id` (bewuste afwijking van het oorspronkelijk
// voorgestelde aansluitpunt in `mppTimephased.ts`'s Z3-moduleheader — zie de "VONDST VOOR Z8"-
// paragraaf daar voor de volledige meting): `readAssignments` (mppEntities.ts) sluit een
// `TBkndAssn`-record ZONDER echte resource (`resourceUid === -65535`, MPXJ's
// `ASSIGNMENT_NULL_RESOURCE_ID`-sentinel) bewust uit van `ResourceAssignment[]` — en de VERPLICHTE
// meetreferentie `mpp14splittask.mpp` draagt PRECIES zulke records (beide taken zijn onbemand,
// `readAssignments` geeft `[]` voor dit bestand). Een brug die matcht tegen `ResourceAssignment[]`
// zou dus voor de verplichte referentie zelf leeg blijven. Deze functie leest daarom RECHTSTREEKS
// taskUid/start/resume uit `TBkndAssn/FixedMeta`+`FixedData` (negeert `resourceUid` volledig — Z4
// hoeft alleen te weten BIJ WELKE TAAK een set periodes hoort, niet via welke resource).
//
// ASYMMETRIE t.o.v. `readAssignmentsUnsafe` (Z4-fixronde, punt 5 — bewust, niet vergeten): die
// functie toetst óók `varMeta.containsKey(uid)` (spiegelt `assnVarMeta.getUniqueIdentifierSet()
// .contains(varDataId)`) vóórdat ze een record accepteert; deze brug opent VarMeta niet en doet
// die toets dus NIET. Onschadelijk: de AANROEPER (`deriveSplitGapsForTasksUnsafe` hieronder)
// itereert over `readAssignmentTimephasedRaw`'s uid-sleutels — die komen ZELF al uit VarMeta se
// eigen `getUniqueIdentifierArray()` (Z3) — en zoekt vervolgens in DEZE brug op; een extra uid die
// deze brug WEL bevat maar readAssignmentTimephasedRaw niet, wordt simpelweg nooit opgevraagd. Een
// bredere (superset-)brug is hier dus geen correctheidsrisico, alleen een niet-herhaalde toets.
//
// BEWUST EEN DERDE, ONAFHANKELIJKE LUS over hetzelfde `TBkndAssn`-storage (spiegelt Z1/Z3's
// precedent — zie hun eigen moduleheaders voor dezelfde motivering): `readAssignmentsUnsafe`
// (mppEntities.ts) is TEST-ONLY geëxporteerd met een vast contract (`ResourceAssignment[]`) dat
// `check-mpp-relations.ts` rechtstreeks aanroept — dat bestand valt buiten Z4's bestandseigendom
// (zie de taakspecificatie), dus die returnvorm mag niet wijzigen. `ASSIGNMENT_FIXED_META_ITEM_SIZE`/
// `ASSIGNMENT_FIXED_DATA_ITEM_SIZE` zijn daarom BEWUST HERHAALD (34/110 — `ResourceAssignmentFactory
// .java`) i.p.v. geïmporteerd: mppEntities.ts's eigen constanten zijn niet geëxporteerd, en dat
// blijft zo — deze duplicatie is het gedocumenteerde alternatief, geen orde-uitglijder.
const Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE = 34;
const Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE = 110;

/** Eén `TBkndAssn`-record se koppelinformatie: bij welke taak hoort ze, en (optioneel) haar EIGEN
 *  `AssignmentField.START`/`RESUME` — de twee ankerpunten die `TimephasedDataFactory.java` gebruikt
 *  (zie mppTimephased.ts's moduleheader). `null` ⇒ het veld staat niet in dit bestand se field map,
 *  óf het record is te kort voor die offset — de aanroeper valt dan terug op taakstart (shift 0),
 *  spiegelt MPXJ's eigen `calculateStart()`-terugval (`ResourceAssignment.java`). */
interface AssignmentUidLink {
  taskId: string;
  assignmentStart: Date | null;
  assignmentResume: Date | null;
  /** Z8 (etappe "nul afwijkingen") — `AssignmentField.FINISH` (id 21, blok 0 offset 16, pal naast
   *  `Start`). MSP's EIGEN al berekende afsluitdatum van déze toewijzing — zie
   *  `deriveTimephasedWindowsForTasks`'s moduleheader voor het corpusbewijs. `null` ⇒ het veld
   *  ontbreekt in dit bestand se field map, óf het record is te kort voor die offset (zelfde
   *  terugvalcontract als `assignmentStart`/`assignmentResume`). */
  assignmentFinish: Date | null;
  /** Z8-herwerkronde — `AssignmentField.ResourceUniqueId` (id 2, al gebruikt door `readAssignments`
   *  in mppEntities.ts, hier HERHAALD voor laag-4's resourcekalender-lookup: welke resource — dus
   *  welke resourcekalender — deze toewijzing draagt). `null` bij een ontbrekend veld (zelfde
   *  terugvalcontract als de andere velden hier) — spiegelt MPXJ se `ASSIGNMENT_NULL_RESOURCE_ID`
   *  (-65535) niet apart: die sentinel komt hier gewoon als een niet-vindbare resource-id door. */
  resourceUid: number | null;
}

/** Geëxporteerd, zelfde testbaarheidsreden als `readAssignments`/`readAssignmentTimephasedRaw`
 *  (mppEntities.ts): `check-mpp-import.ts`'s Z4-sectie roept 'm rechtstreeks aan met een kleine
 *  synthetische `TBkndAssn`-fixture i.p.v. via de volledige `readMPP`. */
export function buildAssignmentUidLinks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  try {
    return buildAssignmentUidLinksUnsafe(cfb, assignmentFieldMap, taskIdByUniqueId);
  } catch {
    return new Map();
  }
}

function buildAssignmentUidLinksUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Map<number, AssignmentUidLink> {
  const label = '"   114"/TBkndAssn';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndAssn', 'FixedData']);
  if (!fixedMetaBytes || !fixedDataBytes) return new Map(); // legitiem afwezig (bv. geen assignments)

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, Z4_ASSIGNMENT_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withoutMeta(Z4_ASSIGNMENT_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);

  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  if (uniqueIdOffset === null || taskUidOffset === null) return new Map();
  // Start/Resume: OPTIONEEL — een bestand zonder deze veldmap-entries levert overal `null` (shift
  // 0, byte-identiek t.o.v. vóór de Z4-fixronde). `null`-offset i.p.v. een geklemde 0 (I3-precedent
  // elders in dit bestand: aanwezig ⇒ uitsluitend data-gedreven, geen stille default-offset).
  const startOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Start);
  const resumeOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Resume);
  // Z8: zelfde optionele-veld-contract als Start/Resume hierboven (ontbreekt de veldmap-entry, dan
  // levert dit overal `null` — geen exceptie, geen stille default-offset).
  const finishOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Finish);
  // Z8-herwerkronde: ResourceUniqueId is GEEN optioneel veld in de praktijk (elke assignment-
  // fieldmap in dit corpus draagt 'm, `readAssignments` leunt er ook al op) maar hetzelfde
  // terugvalcontract kost niets en voorkomt een aparte null-check-stijl hieronder.
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);

  const result = new Map<number, AssignmentUidLink>();
  // GEKLEMD via FixedMeta.getItemCount() — zelfde primitief (en dezelfde al-bestaande hardening,
  // I1) als readAssignmentsUnsafe hierboven gebruikt voor hetzelfde storage.
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const meta = fixedMeta.getByteArrayValue(index);
    // Verwijderd-vlag: spiegelt readAssignmentsUnsafe letterlijk (BYTE, niet SHORT).
    if (!meta || meta.length < 8 || meta[0] !== 0) continue;
    const offset = getInt(meta, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(offset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < Math.max(uniqueIdOffset, taskUidOffset) + 4) continue;
    const uid = getInt(data, uniqueIdOffset, `${label}/FixedData uniqueId`);
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    if (!taskId) continue; // onvindbare taak ⇒ overslaan, spiegelt readAssignmentsUnsafe
    // Per-veld-grens (NIET alleen `data.length`, ook `offset >= 0`): een corrupt/vijandig
    // field-map-record kan een NEGATIEVE offset claimen, waar `data.length >= offset + 4` triviaal
    // waar is — `getTimestamp`/`getShort` zouden dat pas intern vangen (en de hele functie via de
    // buitenste try/catch laten mislukken, dus ALLE al-verzamelde links weggooien). Deze klem
    // voorkomt dat: één corrupt Start/Resume-veld kost hoogstens die twee velden, nooit de rest.
    const assignmentStart = startOffset !== null && startOffset >= 0 && data.length >= startOffset + 4
      ? getTimestamp(data, startOffset, `${label}/FixedData start`)
      : null;
    const assignmentResume = resumeOffset !== null && resumeOffset >= 0 && data.length >= resumeOffset + 4
      ? getTimestamp(data, resumeOffset, `${label}/FixedData resume`)
      : null;
    const assignmentFinish = finishOffset !== null && finishOffset >= 0 && data.length >= finishOffset + 4
      ? getTimestamp(data, finishOffset, `${label}/FixedData finish`)
      : null;
    const resourceUid = resourceUidOffset !== null && resourceUidOffset >= 0 && data.length >= resourceUidOffset + 4
      ? getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`)
      : null;
    result.set(uid, { taskId, assignmentStart, assignmentResume, assignmentFinish, resourceUid });
  }
  return result;
}

/** Kalender voor `task`'s EIGEN veld/kalender-override (spiegelt `readTasks`'s Fase-C `effCal`-
 *  keuze, hier ná afloop opnieuw opgezocht via `Task.calendarId` — `calResult.resourceCalendars`
 *  bevat "alle overige kalenders" per haar eigen docblok, dus ELKE task-kalender-override zit
 *  daarin, niet uitsluitend resource-eigen kalenders). Terugval: de projectkalender. */
function taskCalendar(task: Task, calResult: CalendarReadResult): WorkCalendar {
  if (!task.calendarId || task.calendarId === calResult.projectCalendar.id) return calResult.projectCalendar;
  return calResult.resourceCalendars.find((c) => c.id === task.calendarId) ?? calResult.projectCalendar;
}

/** Decodeert + leidt `TaskSplitGap[]` per taak af — de volledige Z4-ketting:
 *  `readAssignmentTimephasedRaw` (Z3) → uid→taak-koppeling + ankerdatums (hierboven) →
 *  per-toewijzing decodering (`decodeRegularTimephasedWork`/`decodePlannedRegularTimephasedWork`,
 *  ZONDER `referenceFinish` — Z4-fixronde punt 1, zie mppTimephased.ts) → verschuiving naar de
 *  TAAK-as (`shiftPeriods`, Z4-fixronde punt 2+3) → per-toewijzing afleiding
 *  (`deriveSplitGapsFromPeriods`) → taakniveau-aggregatie (`deriveTaskSplitGaps`, filtert
 *  samenvattingstaken — Z4-fixronde punt 4).
 *
 *  GEEN try/catch-wrapper (Z4-fixronde, punt 6 — §8 eist een geteste catch of géén catch): elke
 *  sub-aanroep hierin is zelf al vangend (`readAssignmentTimephasedRaw`, `buildAssignmentUidLinks`)
 *  óf aantoonbaar niet-werpend (`CalendarEngine.ts` bevat GEEN enkele `throw`-instructie, geverifieerd
 *  via een volledige grep — de pure `deriveSplitGapsFromPeriods`/`deriveTaskSplitGaps`/`shiftPeriods`
 *  werpen evenmin). Dit is GEEN ongeteste aanname: het testen van deze functie legde WEL een echte
 *  crash bloot (`workMinutesBetween` op een dag-modus-testkalender — zie de `isHourMode`-guard
 *  hieronder), die is OPGELOST bij de bron (de guard) in plaats van weggewerkt achter een catch —
 *  spiegelt de rest van dit bestand, dat crashes structureel voorkomt, niet opvangt en verstopt. Een
 *  ongeteste catch is een stille faalmodus (§8) — geen catch toevoegen die haar eigen bestaansrecht
 *  niet kan bewijzen.
 *
 *  Geëxporteerd, zelfde testbaarheidsreden als `buildAssignmentUidLinks`: `check-mpp-import.ts`'s
 *  Z4-fixronde-sectie roept 'm rechtstreeks aan met hand-gebouwde `Task[]` (geen synthetische
 *  TBkndTask nodig — `tasks` is een gewoon argument, geen CFB-gelezen waarde). */
/** Z14b — de per-toewijzing decodeer-/verschuifstap uit `deriveSplitGapsForTasks` GEËXTRAHEERD
 *  (mechanische verhuizing, geen gedragswijziging — elke regel hieronder stond letterlijk al in die
 *  functie) zodat `deriveTimephasedContoursForTasks` hieronder dezelfde as/verschuiving deelt in
 *  plaats van een tweede, potentieel uit de pas lopende kopie te onderhouden — anders zou een
 *  toekomstige fix aan de shift-formule (bv. een nieuw resume-precedent) stil op maar één van de
 *  twee consumenten landen. Retourneert `null` bij "geen data" (spiegelt de oude `continue` op die
 *  plek exact). */
function computeShiftedAssignmentPeriods(
  raw: AssignmentTimephasedRaw,
  link: AssignmentUidLink,
  engine: CalendarEngine,
  taskStart: Date,
): { actualPeriods: readonly TimephasedWorkPeriod[]; remainingPeriods: readonly TimephasedWorkPeriod[] } | null {
  // Z4-fixronde punt 3: BEIDE decoders ankeren op de TOEWIJZING se eigen `AssignmentField.START`
  // (`getCompleteWork` altijd; `getPlannedWork` zónder al verricht werk) — NIET op taakstart.
  // Verschuiving = werkminuten-afstand taakstart→assignmentStart (0 als het veld ontbreekt of
  // samenvalt — spiegelt MPXJ's `calculateStart()`-terugval naar `task.getStart()`).
  //
  // `engine.isHourMode`-guard (Z4-fixronde-BEVINDING, tijdens het testen ontdekt):
  // `workMinutesBetween` is een ZUIVERE uur-modus-primitief — ze dereferentieert
  // `calendar.workTime!`/`this.bandCache` onvoorwaardelijk en GOOIT op een dag-modus-kalender
  // (geen `workTime`). Zelfde guard staat al elders in de engine (`CPMSolver.ts`: `eng.isHourMode
  // ? workMinutesBetween(...) : …`) — spiegelt dat patroon exact i.p.v. zelf dag-modus-
  // vensterrekenwerk uit te vinden. DAG-modus-taken krijgen dus shift 0 (byte-identiek t.o.v. vóór
  // deze fixronde) — geen gegokte dag-granulaire formule zonder corpusmeting.
  const assignmentStartShift = engine.isHourMode && link.assignmentStart
    ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentStart))
    : 0;

  // Referentie-instant voor de decoder se (voor Z4 ONGEBRUIKTE) `approxStart`/`approxFinish`-
  // velden — betekenisloos voor de WERKminuten-afgeleide `afterMinutes`/`gapMinutes` zelf, zie
  // mppTimephased.ts's moduleheader-meting. GEEN `referenceFinish` (Z4-fixronde punt 1): een
  // ongedeeld `blockCount===0`-samenvattingsrecord kan per definitie geen gat tonen, en zou hier
  // met een klokminuten-lengte op de werkminuten-as een écht gat kunnen overbruggen.
  const actualPeriodsRaw = raw.actualRegularWork
    ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
    : [];
  const remainingPeriodsRaw = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
    : [];
  if (actualPeriodsRaw.length === 0 && remainingPeriodsRaw.length === 0) return null; // geen data ⇒ uitsluiten (zie hierboven)

  const actualPeriods = shiftPeriods(actualPeriodsRaw, assignmentStartShift);

  // Z4-fixronde punt 2: de REMAINING-track ankert op `assignment.getResume()` ZODRA er al
  // complete work is (`getPlannedWork`: `timephasedComplete.isEmpty() ? getStart() : getResume()`)
  // — een APART, LATER punt dan waar `actualRegularWork` eindigt. Voorkeur: het ECHTE RESUME-veld
  // (indien het bestand het draagt); zonder dat veld valt terug op de benadering "taakstart-
  // verschoven actual se eigen laatste `elapsedWorkMinutesEnd`" (gedocumenteerde terugval, geen
  // MPXJ-garantie — `AssignmentField.RESUME` heeft immers geen `mapMpp14`-default, zie
  // fieldMap14.ts, dus niet elk bestand draagt het).
  let remainingShift = assignmentStartShift;
  if (actualPeriods.length > 0) {
    remainingShift = engine.isHourMode && link.assignmentResume
      ? Math.max(0, engine.workMinutesBetween(taskStart, link.assignmentResume))
      : Math.max(...actualPeriods.map((p) => p.elapsedWorkMinutesEnd));
  }
  const remainingPeriods = shiftPeriods(remainingPeriodsRaw, remainingShift);

  return { actualPeriods, remainingPeriods };
}

export function deriveSplitGapsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Map<string, TaskSplitGap[]> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap); // Z3, zelf al try/catch-veilig
  if (rawByUid.size === 0) return new Map();

  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return new Map();

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  // Per taak: één TaskSplitGap[]-item PER toewijzing die daadwerkelijk periodes decodeerde — de
  // vorm die `deriveTaskSplitGaps` als invoer verwacht (zie mppTimephased.ts's moduleheader: een
  // toewijzing ZONDER data wordt hier uitgesloten, niet als "altijd stil" meegeteld).
  const gapsByAssignmentPerTask = new Map<string, TaskSplitGap[][]>();
  // Lokale cache (GEEN module-level singleton — hardening-checklist): meerdere toewijzingen op
  // dezelfde taak(kalender) hoeven niet elk hun eigen `CalendarEngine` te bouwen.
  const engineByCalendarId = new Map<string, CalendarEngine>();
  const engineFor = (cal: WorkCalendar): CalendarEngine => {
    let engine = engineByCalendarId.get(cal.id);
    if (!engine) {
      engine = new CalendarEngine(cal);
      engineByCalendarId.set(cal.id, engine);
    }
    return engine;
  };

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task?.time?.scheduleStart) continue;
    // Z4-fixronde punt 4: MPXJ toont nooit splits op een samenvattingstaak
    // (`Task.calculateWorkSplits`: `if (getSummary()) return emptyList()`) — spiegelt dat exact.
    if (isSummaryTask(task)) continue;

    const taskStart = parseInstant(task.time.scheduleStart);
    const engine = engineFor(taskCalendar(task, calResult));

    const shifted = computeShiftedAssignmentPeriods(raw, link, engine, taskStart);
    if (!shifted) continue;
    const { actualPeriods, remainingPeriods } = shifted;

    const gaps = deriveSplitGapsFromPeriods([...actualPeriods, ...remainingPeriods]);
    const list = gapsByAssignmentPerTask.get(link.taskId) ?? [];
    list.push(gaps);
    gapsByAssignmentPerTask.set(link.taskId, list);
  }

  const result = new Map<string, TaskSplitGap[]>();
  for (const [taskId, gapsByAssignment] of gapsByAssignmentPerTask) {
    const combined = deriveTaskSplitGaps(gapsByAssignment);
    if (combined.length > 0) result.set(taskId, combined); // leeg ⇒ veld niet zetten (byte-identiek precedent)
  }
  return result;
}

/** Z14b (eigenaarsbesluit 2026-08-18, punt 1 van het bindende eigenaarsprincipe: "er gaat nooit
 *  stilzwijgend broninformatie verloren, ook niet ná bewerken") — bewaart de RAUWE, gedecodeerde
 *  timephased-periodes per taak, ONGEACHT of ze tot een `TaskSplitGap` leiden. Deelt de exacte
 *  decodeer-/verschuifstap met `deriveSplitGapsForTasks` (`computeShiftedAssignmentPeriods`
 *  hierboven) en dezelfde filters (samenvattingstaken uitgesloten, vlakke `blockCount===0`-
 *  summary-records tellen niet mee — zie die functie se eigen toelichting) zodat de rauwe periodes
 *  hier PRECIES de toewijzingen dekken die ook `splitGaps` voedden, geen bredere of smallere
 *  populatie. Puur data — geen enkele solverstap leest dit veld. */
export function deriveTimephasedContoursForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
): Map<string, TaskTimephasedContour[]> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap);
  if (rawByUid.size === 0) return new Map();

  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return new Map();

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const contoursByTask = new Map<string, TaskTimephasedContour[]>();
  const engineByCalendarId = new Map<string, CalendarEngine>();
  const engineFor = (cal: WorkCalendar): CalendarEngine => {
    let engine = engineByCalendarId.get(cal.id);
    if (!engine) {
      engine = new CalendarEngine(cal);
      engineByCalendarId.set(cal.id, engine);
    }
    return engine;
  };

  const toContourPeriods = (
    periods: readonly TimephasedWorkPeriod[],
    kind: 'actual' | 'remaining',
  ): TimephasedContourPeriod[] => periods.map((p) => ({
    afterMinutes: p.elapsedWorkMinutesStart,
    minutes: p.elapsedWorkMinutesEnd - p.elapsedWorkMinutesStart,
    workMinutes: p.workMinutes,
    kind,
  }));

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task?.time?.scheduleStart) continue;
    if (isSummaryTask(task)) continue; // spiegelt deriveSplitGapsForTasks

    const taskStart = parseInstant(task.time.scheduleStart);
    const engine = engineFor(taskCalendar(task, calResult));

    const shifted = computeShiftedAssignmentPeriods(raw, link, engine, taskStart);
    if (!shifted) continue;
    const { actualPeriods, remainingPeriods } = shifted;

    const periods: TimephasedContourPeriod[] = [
      ...toContourPeriods(actualPeriods, 'actual'),
      ...toContourPeriods(remainingPeriods, 'remaining'),
    ];
    const list = contoursByTask.get(link.taskId) ?? [];
    list.push({ resourceUid: link.resourceUid, periods });
    contoursByTask.set(link.taskId, list);
  }
  return contoursByTask;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Z8-HERWERKRONDE (etappe "nul afwijkingen") — GELAAGDE BESLISKOLOM, per taak (Opus-review
// blokkeerde de EERSTE versie: een onvoorwaardelijke venster-override vuurde op 91% van de taken,
// was op 3102/3103 daarvan gelijk aan de rauwe import — cirkelmeting — en bevroor de motor ná
// import, want een gelezen `AssignmentField.FINISH` reageert niet op latere edits). De nieuwe
// regel, in volgorde:
//   1. `time.completion >= 1` (VOLTOOID) ⇒ geen venster — de bestaande VOLTOOID-tak in
//      `CPMSolver.ts` plant op actuals, dat is al MSP-getrouw.
//   2. `0 < completion < 1` (IN-PROGRESS) ⇒ geen venster — de bestaande resume/actuals-paden
//      (Z12/T9) blijven de bron van waarheid.
//   3. ≥1 ÉCHTE gedecodeerde timephased-periode (Format A/B, ZONDER `referenceFinish` — spiegelt
//      Z4's eigen conventie, dus het vlakke `blockCount===0`-samenvattingsrecord telt NIET mee)
//      ⇒ `timephasedFinishFloor`/`timephasedStartAnchor`: MSP's EIGEN `AssignmentField.FINISH`/
//      `START` rechtstreeks gelezen (GEEN kalenderwandeling — corpusbewijs: 0 afwijkingen op de
//      genuine-contour-taken, zie de Z8-herwerkronde-rapportage voor de volledige meting).
//   4. Vlak (geen echte periode) MAAR de toewijzing draagt een NIET-STANDAARD resourcekalender
//      (structureel verschillende banden DAN of GEMATERIALISEERDE uitzonderingen anders dan de
//      taak se eigen effectieve kalender, zie `calendarDiffersIncludingExceptions` — Z19-L: sinds
//      deze fixronde UNIFORM voor elke completion-staat, was vóór deze fixronde voor completion===0
//      bands-only — corpusbewijs: de "Night Shift"/"24 Hours"-families, `mpp14resource.mpp`'s
//      "Task A" (bandverschil), en sinds Z19-L (op state-niveau gemeten, niet alleen op de fidelity-
//      diff-tellingen — zie `calendarDiffersIncludingExceptions`'s eigen docblok voor de volledige
//      8-bestand/10-taak-blast-radius) ook `mpp14timephased2.mpp`'s "Planned task with resource
//      holiday", de volledige `timephased-budget*.mpp`-familie (5 bestanden, HOLIDAY-only verschil
//      op een single-resource 100%-toewijzing), én "Task Seven"/"Task Eight" in zowel `mpp14
//      timephasedsegments.mpp` als `mpp14timephasedsegmentsmanual.mpp` (holiday+working-exception-
//      verschil die bij de OPGESLAGEN duur netto nul uitwerkt — zie datzelfde docblok voor waarom
//      dat GEEN reden is om de activering uit te sluiten) ⇒ `timephasedDurationWalks`:
//      GEEN gelezen antwoord, een VERSE herberekening. Bij PRECIES 1 toewijzing wandelt
//      `CPMSolver.ts` `task.time.durationMinutes` (edit-live) door de toewijzings-eigen
//      resourcekalender (nu promoveerbaar, zie `subdayIo.ts`'s (b2)-instrumentfix). Bij >1
//      toewijzing (Z19-apportionering, `decodeAssignmentWorkMinutes` hieronder): elke toewijzing
//      wandelt ALLEEN haar eigen gedecodeerde werk-aandeel (een volle-duur-wandeling per
//      toewijzing gaf op "Task A" een ~2× te late datum, zie de finalisatielus van
//      `deriveTimephasedWindowsForTasks`). Beide varianten nemen het MAXIMUM over de toewijzingen
//      ("langste toewijzing bepaalt de finish"). N2-CORRECTIE (Opus-her-check, tweede ronde): "geen
//      invalidatie nodig, stroomt vanzelf mee" klopt UITSLUITEND voor de PRECIES-1-toewijzing-tak
//      (die wandelt `task.time.durationMinutes`, edit-live, dus ELKE `runCPM` ziet de nieuwste duur
//      vanzelf). De >1-toewijzing/apportioneringstak wandelt per item de BEVROREN `workMinutes` uit
//      de import — een latere duur-/datumwijziging op de taak bereikte die wandeling tot deze fix
//      NIET (een kalenderwijziging ook niet, maar dat is geen bug: `durMin` volgt `task.calendarId`
//      sowieso niet, zie `taskDefaults.ts`'s "kalender"-paragraaf). `taskDefaults.ts`'s
//      `updateTask`/`updateTaskFields`/`patchTaskFields` wissen
//      de lijst sinds N2 daarom alsnog (`clearTimephasedDurationWalks`, gepoort op
//      `timephasedDurationWalksHaveFrozenWork`) zodra zo'n bevroren item aanwezig is — de taak valt
//      dan terug op punt 5 hieronder tot een volgende import. Corpusbewijs voor de activering zelf:
//      9/9 (mpp14timephased2.mpp), 20/20 (mpp14timephasedsegments.mpp), en de volledige
//      0%-populatie van mpp14timephased.mpp (de Task 6-familie, completion 60%, blijft BUITEN
//      dit punt — hun resourcekalender is geverifieerd IDENTIEK aan de projectkalender; zie de
//      resumeOverride-gate in `CPMSolver.ts` voor hoe die familie is opgelost).
//   5. Anders ⇒ geen van beide velden gezet, de gewone duurberekening blijft ongewijzigd.
// Lagen 3 en 4 zijn MUTUEEL EXCLUSIEF per taak (nooit beide gezet) — lagen 1/2 sluiten een taak
// hier VOLLEDIG uit (geen enkel Z8-veld gezet), dus `CPMSolver.ts`'s VOLTOOID-/IN-PROGRESS-takken
// hoeven deze velden niet meer te raadplegen (zie die functie se eigen toelichting).
//
// EERDERE (WEERLEGDE) HYPOTHESES, kort — voor de volledige meting zie de Z8-herwerkronde-
// rapportage: (a) een onvoorwaardelijke venster-override (eerste versie, hierboven al genoemd);
// (b) een kalenderwandeling op basis van de gedecodeerde periodes se `workMinutes`-som ("variant
// c") — werkt op een MINDERHEID van de populatie (periodes dragen voor de vlakke meerderheid geen
// kalenderspanne-informatie, alleen een totaal-werk-getal, MSPDI-orakel bevestigd: `<Work>` en
// `<Duration>` zijn legitiem VERSCHILLENDE grootheden, geen decodeerfout); (c) een correlatie-
// verschuivingshypothese (uid→taak-brug fout) — WEERLEGD: de uid/taskUid/resourceUid-koppeling is
// een schone 1:1-reeks, geen off-by-one.
//
// Z19-NUANCE op (b): "werkt op een minderheid" was juist voor `workMinutes` als VERVANGER van de
// gewone duurwandeling over de HELE populatie (elke taak, ongeacht toewijzingsaantal) — dat blijft
// afgewezen, zie punt 4 hierboven ("bij PRECIES 1 toewijzing... de volle `durationMinutes`").
// `decodeAssignmentWorkMinutes` gebruikt dezelfde decoders voor een SMALLERE, andere vraag (hoe
// verdeelt het werk zich over >1 gelijktijdige toewijzing van DEZELFDE taak), niet "wat is de
// datum" — geen tegenspraak met deze weerlegging.
//
// SAMENVATTINGSTAKEN: zelfde semantische uitsluiting als Z4 — MSP toont geen
// contour-eigen venster op een WBS-samenvattingstaak, haar datums komen uit de kinderrollup.
export interface TimephasedWindowResult {
  finishFloor: Date | null;                 // laag 3
  startAnchor: Date | null;                 // lagen 3+4 (vroegste anker)
  /** laag 4. `workMinutes` ONTBREEKT bij PRECIES 1 toewijzing (de wandeling gebruikt dan de volle
   *  `task.time.durationMinutes`, bewezen gedrag — zie de finalisatielus hieronder) en is GEZET bij
   *  >1 toewijzing (Z19-apportionering: elke toewijzing wandelt alleen haar eigen gedecodeerde
   *  werk-aandeel, zie `decodeAssignmentWorkMinutes`). */
  durationWalks: { anchor: Date; resourceCalendarId: string; workMinutes?: number }[];
}

/** Vergelijk de gecanoniseerde banden van twee kalenders — puur structureel (geen id-vergelijking:
 *  in dit corpus krijgt ELKE resource haar EIGEN kalender-object, ook als de inhoud identiek is aan
 *  de taak-kalender, dus id-ongelijkheid alleen zou laag 4 op vrijwel elke toewijzing laten vuren).
 *  `undefined`/ontbrekend `workTime` ⇒ geen zinvolle vergelijking mogelijk (dag-modus) ⇒ `false`. */
function sortedRanges(list: readonly { startDate: string; endDate: string }[] | undefined): string {
  if (!list || list.length === 0) return '[]';
  const sorted = [...list].sort((x, y) => x.startDate.localeCompare(y.startDate) || x.endDate.localeCompare(y.endDate));
  return JSON.stringify(sorted.map((h) => [h.startDate, h.endDate]));
}

function calendarBandsDiffer(a: WorkCalendar, b: WorkCalendar): boolean {
  if (!a.workTime || !b.workTime) return false;
  return JSON.stringify(a.workTime.byWeekday) !== JSON.stringify(b.workTime.byWeekday);
}

/** Uitbreiding van `calendarBandsDiffer` met GEMATERIALISEERDE uitzonderingen (`holidays`/
 *  `workingExceptions`): een resource kan dezelfde weekbanden hebben als de taakkalender maar een
 *  extra vrije dag ("resource holiday") — een even echte afwijking als een andere weekband
 *  (corpusbevinding: mpp14timephased2.mpp, "Partially complete task with resource holiday",
 *  completion 10%; en de Z19-L-budget-dossierfamilie hieronder, allemaal completion 0%).
 *
 *  Z19-L HERMETING (2026-08-18) — de eerdere completion===0-uitsluiting hier is VERVALLEN. Vóór
 *  deze fixronde gebruikte de aanroeper voor completion===0 bewust `calendarBandsDiffer` (bands-
 *  only), met als reden een corpusproef uit een eerdere fixronde: uitzonderingen meetellen zou op
 *  `mpp14timephasedsegmentsmanual.mpp`'s "Task Seven"/"Task Eight" een valse activering geven
 *  (hun wandelformule had toen een systematisch 1-uur-precisieverschil met MSP's segment-antwoord).
 *
 *  BLAST-RADIUS, OP STATE-NIVEAU GEMETEN (niet alleen op de fidelity-diff-tellingen — die verbergen
 *  een nieuwe-maar-toevallig-gelijke activering): een taakniveau-census van `timephasedDurationWalks`
 *  vóór/ná deze wijziging (216-bestand-baseline + 658-bestand-crawl) laat **8 bestanden / 10 taken**
 *  zien met een NIEUWE laag-4-activering: de 5 `timephased-budget*.mpp`-bestanden ("Task 1", elk 1
 *  taak), `mpp14timephased2.mpp`'s "Planned task with resource holiday", ÉN — dit is de correctie op
 *  een eerdere versie van dit docblok, die beweerde dat er hier NIETS veranderde — `mpp14
 *  timephasedsegmentsmanual.mpp`'s "Task Seven"/"Task Eight" EN dezelfde twee taken in het verwante
 *  `mpp14timephasedsegments.mpp` (niet eerder genoemd in dit docblok, wél in dezelfde populatie).
 *  `sourceScheduleNotes.total` verschuift dienovereenkomstig in 8 bestanden: 5× budget 0→1,
 *  `mpp14timephased2.mpp` 2→3, `mpp14timephasedsegments.mpp` 9→11, `mpp14timephasedsegmentsmanual
 *  .mpp` 10→12 (`mpp14timephased.mpp` — de Task 6-familie, zie mpp-fidelity-baseline.json se eigen
 *  reason — en `mpp14timephasedsegmentsmanualoffsets.mpp` blijven ONGEWIJZIGD: 31 resp. 23).
 *
 *  WAAROM "Task Seven"/"Task Eight" TÓCH BYTE-IDENTIEK bleven ondanks de nieuwe activering (een
 *  aanwijsbaar mechanisme, maar afhankelijk van déze duur — en GEEN weerlegging van de corpusproef — de eerdere versie van dit
 *  docblok speculeerde ten onrechte dat een latere fixronde het precisieprobleem al had opgelost;
 *  dat is NIET gemeten en dus geschrapt): op BEIDE bestanden, bij de OPGESLAGEN taakduur (4800 min,
 *  10 werkdagen), HEFFEN de gematerialiseerde uitzonderingen elkaar binnen het wandelvenster netto
 *  op. "Task Seven": de RESOURCEKALENDER (niet de taakkalender, die is hier leeg) draagt een holiday
 *  op 2011-02-08 (−1 werkdag) én een working exception op 2011-02-12 (+1 werkdag) — netto 0 t.o.v.
 *  de vlakke taakkalender-wandeling. "Task Eight": hier is het net andersom — de TAAKKALENDER draagt
 *  een eigen override (`Task.calendarId` gezet, niet de projectkalender) met holidays op 2011-02-08
 *  ÉN 2011-02-10 (−2 werkdagen) plus een working exception op 2011-02-12/13 (+2 werkdagen, ÉÉN
 *  tweedaags record) — netto ook 0; de RESOURCEKALENDER zelf is hier juist "schoon" (geen holidays/
 *  workingExceptions), dus vóór deze fixronde activeerde de bands-only-poort niet op "Task Eight"
 *  (haar resourcekalender wéék immers niet af in bands), en de holiday-inclusieve poort
 *  activeert nu WEL (de resourcekalender wijkt af van de taak se EIGEN, override-kalender) — met
 *  dezelfde toevallige netto-nul-uitkomst bij déze specifieke duur.
 *
 *  DIT IS GEEN REDEN OM DE ACTIVERING UIT TE SLUITEN (orkestratorrichting, Z19-L-reviewronde): de
 *  regel "toewijzingswerk wandelt op de EIGEN resourcekalender (inclusief haar uitzonderingen), niet
 *  op de taakkalender" is MSP's eigen semantiek — het is het invoerfeit dat de discriminerende
 *  dossiers van deze etappe (budget-familie, mpp14timephased2) onafhankelijk bevestigen — de twee
 *  segments-fixtures discrimineren hier per constructie niet (beide wandelingen landen bij de
 *  opgeslagen duur op hetzelfde instant) en tellen dus niet als bevestiging mee. Activering
 *  op "Task Seven"/"Task Eight" is dus PRINCIPIEEL juist, niet een ongelukkig neveneffect om te
 *  vermijden. Wat WEL blijft staan, als bewust geaccepteerde LATENTE divergentie: bij de opgeslagen
 *  duur (4800 min) is de wandeling bewezen byte-identiek (fidelity, hierboven), maar bij een ANDERE
 *  duur zou de netto-nul-uitkomst NIET meer gelden (bv. 960 min = 2 of 1920 min = 4 werkdagen — te
 *  kort om zowel de holiday als de working-exception-band te passeren, dus de "annulering" werkt dan
 *  niet meer symmetrisch en divergeert de finish 1–2 werkdagen). Die divergentie is REËEL maar met het huidige harnas ONVERIFIEERBAAR: de
 *  fidelity-suite meet uitsluitend tegen MSP's EIGEN opgeslagen duur/antwoord — voor een zelf-
 *  bedachte, bewerkte duur BESTAAT er simpelweg geen grondwaarheid in het bestand — en dit
 *  project heeft geen "bewerk deze taak en vergelijk met MSP's herberekening"-testinstrument — dat
 *  is de duurste, nog niet gebouwde post in de taaktypes-spec (bewerkgedrag-fidelity). Deze afweging
 *  is bewust doorgegeven aan de orkestrator (Z19-L-eindrapport, reviewronde) i.p.v. zelf een tweede,
 *  ongeteste "correctie" te bouwen. `calendarBandsDiffer` blijft als losse, kleinere bouwsteen
 *  bestaan (intern hergebruikt hieronder) — geen dode code. */
function calendarDiffersIncludingExceptions(a: WorkCalendar, b: WorkCalendar): boolean {
  if (calendarBandsDiffer(a, b)) return true;
  if (!a.workTime || !b.workTime) return false;
  if (sortedRanges(a.holidays) !== sortedRanges(b.holidays)) return true;
  if (sortedRanges(a.workingExceptions) !== sortedRanges(b.workingExceptions)) return true;
  return false;
}

/** Z19 (residu-iteratie "nul afwijkingen", dossier "mpp14resource-apportionering") — het TOTALE
 *  per-toewijzing gedecodeerde werk in minuten: som van `actualRegularWork` + `remainingRegularWork`
 *  via de bestaande Z3-decoders (`decodeRegularTimephasedWork`/`decodePlannedRegularTimephasedWork`)
 *  — DEZELFDE functies als de laag-3-`hasGenuinePeriod`-detectie hierboven gebruikt, hier voor een
 *  ANDER doel: bij >1 gelijktijdige toewijzing wandelt geen enkele toewijzing alleen de VOLLE
 *  taakduur — zie de finalisatielus onderaan deze functie voor het corpusbewijs ("Task A",
 *  `mpp14resource.mpp`: 3 toewijzingen × 1440 werkminuten elk, task-duur 2880 min — de oude
 *  volle-duur-per-toewijzing-wandeling gaf ~2× te laat per toewijzing).
 *
 *  L2 (Opus-review, correctie): NIET "toewijzingen DELEN het werk" — dat zou een PARTITIE van de
 *  taakduur suggereren en klopt niet letterlijk (Task A: taakduur 2880 min, 3×1440 gedecodeerd
 *  werk = 4320 min, GEEN partitie — de drie toewijzingen dragen elk hun EIGEN, onafhankelijk
 *  opgeslagen werk-hoeveelheid, die kan groter, kleiner of gelijk zijn aan een partitie). De ware
 *  regel: ELKE toewijzing wandelt haar EIGEN gedecodeerde werk-aandeel, de LANGSTE (het MAXIMUM
 *  over de wandelingen) bepaalt de taakfinish — spiegelt exact laag 3's "langste toewijzing
 *  bepaalt de finish"-regel, nu met een verse berekening i.p.v. een gelezen antwoord.
 *
 *  L1 (Opus-review, beperking): deze functie wandelt WERKMINUTEN, niet werk-BIJ-EEN-BEPAALDE-
 *  CAPACITEIT — ze houdt GEEN rekening met `ResourceAssignment.unitsPerDay` (bv. een toewijzing op
 *  25% capaciteit zou in MSP's eigen model langer over dezelfde nominale "werkhoeveelheid" doen dan
 *  een 100%-toewijzing). Corpusbewijs dat deze aanname niet universeel is: `mpp14assignmentfields
 *  .mpp`'s "Task One" draagt units `[1, 0.25]` (buiten dit dossier se eigen apportionerings-
 *  activering, zie CPMSolver.ts's `resumeOverride`-toelichting — die taak activeert de HIER
 *  beschreven tak niet, want ze heeft geen genuine timephased-werkblok). Bewust NIET opgelost: geen
 *  enkel corpusgeval in DEZE apportioneringspopulatie (walks.length>1, wél genuine werkblok) draagt
 *  een niet-100%-`unitsPerDay` — de vereenvoudiging is dus ONGETOETST, geen bewezen-correcte
 *  aanname, gemeld als openstaand punt i.p.v. stilzwijgend genegeerd.
 *
 *  `assignmentFinish` is voor `decodePlannedRegularTimephasedWork`'s `blockCount===0`-tak
 *  UITSLUITEND een NIET-NULL ankerpunt (nodig om de vroege lege-return te vermijden voor dat
 *  speciale geval, zie haar eigen docblok in `mppTimephased.ts` — GELDT ALLEEN voor die
 *  `blockCount===0`-tak; de `decodeRegularTimephasedWork`-tak hierboven kent geen `blockCount===0`-
 *  speciaal geval en gebruikt `assignmentFinish` dus ook niet); de WERK-waarde zelf (offset 16,
 *  losstaand van dit ankerpunt) verandert NIET met welke datum hier wordt doorgegeven — corpusprobe
 *  (Task A, drie toewijzingen): identieke `workMinutes` met het gelezen `assignmentFinish` én met
 *  een willekeurig ander niet-`null` ankerpunt. `link.assignmentFinish` (het gelezen MSP-eigen
 *  ankerpunt, toch al beschikbaar) is dus een gemaksgreep, GEEN cirkelmeting: de teruggegeven
 *  `workMinutes` is een edit-live, kalenderonafhankelijke werk-HOEVEELHEID, geen gelezen datum.
 *  `0`/geen gedecodeerd werk ⇒ `null` — de aanroeper behandelt dat als "niet apportioneerbaar" en
 *  laat de hele taak op laag 5 vallen (zie de finalisatielus).
 *
 *  L3 (Opus-review): `assignmentFinish` KAN `null` zijn (`AssignmentUidLink.assignmentFinish`'s
 *  eigen docblok — het veld ontbreekt in sommige bestanden se field map, of het record is te kort).
 *  De `?? new Date(taskStart.getTime() + 60_000)`-terugval is dus GEEN dode/onbereikbare tak — zie
 *  `check-mpp-import.ts`'s Z19-eenheidstest (`decodeAssignmentWorkMinutes` hieronder is UITSLUITEND
 *  hiervoor geëxporteerd, zelfde testbaarheidsreden als `readAssignments`/`readAssignmentTimephasedRaw`
 *  elders in dit bestand) voor het rode-pad-mutatiebewijs dat de terugval daadwerkelijk werkt en
 *  dat de teruggegeven `workMinutes` — zoals het docblok hierboven al claimt — ONGEWIJZIGD blijft
 *  ongeacht welk niet-`null` ankerpunt hier binnenkomt. */
export function decodeAssignmentWorkMinutes(
  raw: AssignmentTimephasedRaw, taskStart: Date, assignmentFinish: Date | null,
): number | null {
  const actual = raw.actualRegularWork ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart) : [];
  const referenceFinish = assignmentFinish ?? new Date(taskStart.getTime() + 60_000);
  const remaining = raw.remainingRegularWork
    ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart, referenceFinish)
    : [];
  const total = actual.reduce((sum, p) => sum + p.workMinutes, 0)
    + remaining.reduce((sum, p) => sum + p.workMinutes, 0);
  return total > 0 ? total : null;
}

export function deriveTimephasedWindowsForTasks(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  tasks: readonly Task[],
  calResult: CalendarReadResult,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
  resources: readonly Resource[],
): Map<string, TimephasedWindowResult> {
  const rawByUid = readAssignmentTimephasedRaw(cfb, assignmentFieldMap); // Z3, zelf al try/catch-veilig
  if (rawByUid.size === 0) return new Map();

  const linkByUid = buildAssignmentUidLinks(cfb, assignmentFieldMap, taskIdByUniqueId);
  if (linkByUid.size === 0) return new Map();

  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const resourceById = new Map(resources.map((r) => [r.id, r] as const));
  const finishesByTask = new Map<string, Date[]>();
  const startsByTask = new Map<string, Date[]>();
  // `resourceType` is UITSLUITEND een lokale filtersleutel voor de finalisatielus hieronder (Z19-
  // klokdossier-activeringsverbreding) — komt NIET in `TimephasedWindowResult`/
  // `Task.timephasedDurationWalks` terecht (die dragen alleen `anchor`/`resourceCalendarId`/
  // `workMinutes`, zie hun eigen type/docblok). `null` = de resource kon niet worden opgezocht
  // (Opus-her-check-nit: eerder viel dit terug op `'LABOR'`, wat een ONVINDBARE resource als
  // gewoon meewandelend LABOR behandelde — de conservatieve kant van het MATERIAL-filter is juist
  // UITSLUITEN bij twijfel, dus `null` telt hieronder net als `'MATERIAL'` als "niet meewandelen").
  const durationWalksByTask = new Map<string, { anchor: Date; resourceCalendarId: string; workMinutes: number | null; resourceType: ResourceType | null }[]>();
  // Laag 4 is een taak-brede activering (≥1 toewijzing met een écht afwijkende resourcekalender)
  // die vervolgens ALLE vlakke toewijzingen van die taak meeneemt in de MAX-wandeling (ook een
  // toewijzing die zelf niet afwijkt — haar bijdrage wordt dan gedomineerd, spiegelt "Task A" waar
  // twee van de drie toewijzingen een taak-gelijke kalender dragen en de derde de doorslag geeft).
  const layer4ActivatedTasks = new Set<string>();

  for (const [uid, raw] of rawByUid) {
    const link = linkByUid.get(uid);
    if (!link) continue;
    const task = taskById.get(link.taskId);
    if (!task || isSummaryTask(task)) continue; // samenvattingstaak: zelfde uitsluiting als Z4
    if (!task.time.scheduleStart) continue;
    const completion = task.time.completion ?? 0;

    // Lagen 1/2 (VOLTOOID/IN-PROGRESS, completion > 0): GEEN gelezen venster (laag 3, cirkelmeting-
    // risico — zie de moduleheader) — maar de laag-4-KALENDERKEUZE (welke resourcekalender, GEEN
    // gelezen datum) is een gewoon, edit-live gegeven en mag WEL voor elke completion-staat bepaald
    // worden; `CPMSolver.ts` consumeert 'm daar apart (herwerkronde-fixronde 2, "laag 1/2-gat").
    // Laag 3 se signaaldetectie (`hasGenuinePeriod`/`finishesByTask`/`startsByTask`) blijft daarom
    // UITSLUITEND voor `completion === 0` — dat is de enige plek waar deze `continue` nog staat.
    if (completion === 0) {
      const taskStart = parseInstant(task.time.scheduleStart);
      const actualPeriods = raw.actualRegularWork
        ? decodeRegularTimephasedWork(raw.actualRegularWork, taskStart)
        : [];
      // GEEN referenceFinish (Z4-conventie) — het vlakke `blockCount===0`-geval telt hier bewust
      // NIET als "echte periode", zie de moduleheader-toelichting hierboven.
      const remainingPeriods = raw.remainingRegularWork
        ? decodePlannedRegularTimephasedWork(raw.remainingRegularWork, taskStart)
        : [];
      const hasGenuinePeriod = actualPeriods.length > 0 || remainingPeriods.length > 0;

      if (hasGenuinePeriod) {
        // LAAG 3: gelezen venster.
        if (link.assignmentFinish) {
          const list = finishesByTask.get(link.taskId) ?? [];
          list.push(link.assignmentFinish);
          finishesByTask.set(link.taskId, list);
        }
        if (link.assignmentStart) {
          const list = startsByTask.get(link.taskId) ?? [];
          list.push(link.assignmentStart);
          startsByTask.set(link.taskId, list);
        }
        continue;
      }
    }

    // Vlak, dus geen laag-3-signaal — maar mogelijk WEL een laag-4-wandelkandidaat (bij een
    // resolvebare, afwijkende resourcekalender). GEEN gelezen terugval meer (herwerkronde-slotronde:
    // de reviewer wees de eerdere "vlak/null-resource"-terugval af als fee9ecb4's onvoorwaardelijke
    // override in een nieuw jasje — 2896 taken in 156 bestanden lazen daar nog altijd het opgeslagen
    // `AssignmentField.FINISH` rechtstreeks terug, zonder onafhankelijke herberekening). De
    // KALENDERREFERENTIE zelf (`durationWalksByTask`/`layer4ActivatedTasks`) is GEEN gelezen datum —
    // herwerkronde-fixronde 2 ("laag 1/2-gat"): CPMSolver.ts gebruikt 'm ook voor completion>0-taken
    // (resume-anker/actuals-hervatting door de resourcekalender i.p.v. de taakkalender), dus die
    // verzameling loopt hier bewust voor ELKE completion-staat door.
    if (!hasAnyTimephasedData(raw)) continue; // geen enkel timephased-signaal ⇒ laag 5, niets doen
    if (!link.assignmentStart || link.resourceUid === null) continue;
    const resourceId = resourceIdByUniqueId.get(link.resourceUid);
    const resource = resourceId ? resourceById.get(resourceId) : null;
    const resCal = resource?.calendarId
      ? calResult.resourceCalendars.find((c) => c.id === resource.calendarId)
      : null;
    if (!resCal) continue;
    const taskCal = taskCalendar(task, calResult);
    // Z19-L (2026-08-18): UNIFORM voor elke completion-staat — bands ÉN gematerialiseerde
    // uitzonderingen (holidays/workingExceptions) tellen mee. Zie `calendarDiffersIncludingExceptions`'s
    // eigen docblok voor de hermeting die de vroegere completion===0-bands-only-uitsluiting hier
    // heeft opgeheven — de VOLLEDIGE op-state-niveau gemeten blast-radius (8 bestanden/10 taken
    // nieuwe activering, 6 daarvan met een fidelity-verbetering naar 0/0, 0 regressies) staat daar,
    // niet hier herhaald om drift tussen twee kopieën van hetzelfde getal te voorkomen.
    const activates = calendarDiffersIncludingExceptions(resCal, taskCal);
    if (activates) layer4ActivatedTasks.add(link.taskId);
    const walkList = durationWalksByTask.get(link.taskId) ?? [];
    // Z19 — werk-hoeveelheid voor een EVENTUELE latere apportionering (finalisatielus hieronder);
    // bij PRECIES 1 toewijzing wordt dit veld genegeerd (byte-identiek bewezen gedrag, zie daar).
    const workMinutes = decodeAssignmentWorkMinutes(raw, parseInstant(task.time.scheduleStart), link.assignmentFinish);
    walkList.push({
      anchor: link.assignmentStart, resourceCalendarId: resCal.id, workMinutes,
      // Opus-her-check-nit: `null` (niet `'LABOR'`) als de resource niet kon worden opgezocht — een
      // onvindbare resource krijgt hierdoor GEEN gewone LABOR-behandeling meer, maar wordt hieronder,
      // net als MATERIAL, uitgesloten van de wandeling. Conservatief bij twijfel.
      resourceType: resource?.type ?? null,
    });
    durationWalksByTask.set(link.taskId, walkList);
  }

  const result = new Map<string, TimephasedWindowResult>();
  for (const [taskId, finishes] of finishesByTask) {
    const finishFloor = new Date(Math.max(...finishes.map((d) => d.getTime())));
    const starts = startsByTask.get(taskId);
    const startAnchor = starts ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    result.set(taskId, { finishFloor, startAnchor, durationWalks: [] });
  }
  // Herwerkronde-slotronde: GEEN gelezen terugval meer (fee9ecb4 in een nieuw jasje, afgekeurd door
  // de reviewer — zie de toelichting hierboven bij `hasAnyTimephasedData`). Laag 4
  // (`durationWalksByTask`) is dus de ENIGE resterende bron hier.
  //
  // Z19 (residu-iteratie "nul afwijkingen") — TWEE takken, niet meer één:
  //  - PRECIES 1 toewijzing: bewezen byte-stabiel gedrag (9/9 mpp14timephased2.mpp, 20/20
  //    mpp14timephasedsegments.mpp, de volledige 0%-populatie van mpp14timephased.mpp) — de
  //    wandeling gebruikt de VOLLE `task.time.durationMinutes` (`workMinutes` wordt hier NIET
  //    doorgegeven, dus `CPMSolver.ts` valt terug op de kale duur — ONGEWIJZIGD t.o.v. vóór Z19).
  //    Activering blijft hier UITSLUITEND op `layer4ActivatedTasks` (kalender wijkt af) — deze
  //    populatie is niet aangeraakt door de verbreding hieronder.
  //  - >1 toewijzing: Z19's werkVERDELING — is voor ELKE toewijzing van deze taak een `workMinutes`
  //    gedecodeerd (`null` bij ontbrekend/nul werk ⇒ de HELE taak blijft op laag 5, geen
  //    gedeeltelijke gok), dan wandelt `CPMSolver.ts` per toewijzing ALLEEN haar eigen werk-aandeel
  //    en neemt het MAXIMUM over de lijst ("langste toewijzing bepaalt de finish" — spiegelt laag 3,
  //    nu met een VERSE werk-apportionering i.p.v. een gelezen antwoord).
  //
  //    ACTIVERINGSVERBREDING (Z19-residudossier "SNET-klokdossier a69fec157074d056", ná Opus-
  //    weerlegging van de eerdere "corpusloos" escalatie): eerder gold hier óók `layer4ActivatedTasks`
  //    (kalendervergelijking) als poort — maar `walks.length > 1` is op zichzelf AL het signaal "≥2
  //    toewijzingen dragen een écht timephased-blok" (elke push in `walkList` hierboven gaat achter
  //    `hasAnyTimephasedData(raw)`, zie die guard verderop in de hoofdlus) — dat is DEZELFDE
  //    voorwaarde als "≥2 tijdgefaseerd-dragende toewijzingen", los van of hun resourcekalender
  //    toevallig ook nog verschilt. Corpusbewijs (klokdossier): twee toewijzingen met GESTAGGERDE
  //    eigen `AssignmentField.START`/`FINISH`-vensters én eigen (vlakke) timephased-werkblokken,
  //    IDENTIEKE resourcekalender aan de taak — de oude kalendervoorwaarde sloot deze populatie dus
  //    onterecht uit; de taakfinish is het MAXIMUM over de twee toewijzings-eigen wandelingen
  //    (`anchor: assignmentStart`, `workMinutes: eigen aandeel`) — exact dezelfde machinerie als
  //    "Task A" (`mpp14resource.mpp`), alleen zonder kalenderverschil als extra aanleiding. De
  //    kalendervoorwaarde blijft daarom bewust NIET vereist voor deze tak — `layer4ActivatedTasks`
  //    wordt hier niet meer geraadpleegd, `>1 NIET-MATERIAL toewijzing met decodeerbaar werk` (zie
  //    de MATERIAL-uitsluiting in de tak hieronder — eigen corpusbevinding, `timephased-cost-
  //    rollup.mpp`) is de volledige poort.
  //
  //    BLAST-RADIUS (N3, Opus-her-check tweede ronde — corpusbreed gemeten over `OPS_MPP_CORPUS` +
  //    `OPS_MPP_CRAWL`, 661 bestanden gescand, 445 overgeslagen als MPP_LEGACY/MPP_ENCRYPTED,
  //    onafhankelijk herverificeerd via `solveMppBytes` vóór deze fixronde-commit — geen kwalitatieve
  //    claim, getelde populaties):
  //      - walks>1 (deze tak): 1 → 129 taken. Vóór de verbreding hierboven activeerde deze tak
  //        uitsluitend als de kalendervoorwaarde ook gold; ná de verbreding is elke taak met ≥2
  //        NIET-MATERIAL, decodeerbare toewijzingen genoeg — 129 taken, corpusbreed geteld.
  //      - walks===1 (de tak hierboven): 22 → 41 taken (19 daarvan NIEUW met een gezette
  //        `workMinutes` — die 19 zijn taken die vóór deze fixronde als "walks>1" NIET decodeerbaar
  //        waren en na filtering/decodering op precies 1 bruikbare toewijzing uitkwamen, spiegelt
  //        "Task A" se eigen MATERIAL-filtering hierboven).
  //      - IN-PROGRESS-taken (completion tussen 0 en 1) MET een niet-lege `timephasedDurationWalks`:
  //        5 → 17 (corpusbreed; zie `CPMSolver.ts`'s `resumeOverride`-docblok voor de aparte
  //        progressCal-promotie-deelmeting binnen die 17: 5 → 7).
  //    GEEN "overige populatie blijft gedekt of laag 5"-claim meer hier — dat was een ongekwantificeerde
  //    aanname (N3-bevinding); de volledige populatie is hierboven exact geteld, niet geschat.
  for (const [taskId, walks] of durationWalksByTask) {
    if (result.has(taskId)) continue; // laag 3 heeft deze taak al (mutueel exclusief per taak)
    if (walks.length === 1 && layer4ActivatedTasks.has(taskId)) {
      // PRECIES 1 toewijzing IN TOTAAL — de bewezen, byte-stabiele populatie (9/9/20/20, zie
      // hierboven). GEEN MATERIAL-filter hier: bij één toewijzing is er geen "meerdere bronnen,
      // welke tellen mee"-vraag, en de volle taakduur (niet `workMinutes`) is hier het bewezen
      // juiste wandelgetal — dat blijft ONGEWIJZIGD, ongeacht het toewijzings-type.
      const startAnchor = new Date(Math.min(...walks.map((w) => w.anchor.getTime())));
      result.set(taskId, {
        finishFloor: null, startAnchor,
        durationWalks: walks.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId })),
      });
    } else if (walks.length > 1) {
      // MEERDERE toewijzingen IN TOTAAL — de werkVERDELING-tak. MATERIAL-toewijzingen tellen NIET
      // mee IN DE WANDELING (Z19-blast-radius-bevinding, `timephased-cost-rollup.mpp`'s "Task 8"):
      // twee MATERIAL-toewijzingen (budgethoeveelheden, geen kalenderwerk) droegen elk een
      // gedecodeerd "werk"-getal (≈300 min) dat, gewandeld als echte kalenderwerkminuten, de taak
      // ~4 werkdagen te vroeg liet eindigen — MATERIAL-resources verbruiken het schema, ze STUREN
      // het niet, dus hun "werk"-veld is geen kalender-consumerende activiteit. LET OP: dit is een
      // FILTER op WELKE toewijzingen meewandelen, GEEN vervanging van de "meerdere toewijzingen"-
      // herkenning zelf — `mpp14resource.mpp`'s "Task A" (3 toewijzingen, waarvan 2 in dít bestand
      // toevallig MATERIAL getypeerd zijn) bewijst waarom: na filtering blijft daar precies 1
      // toewijzing (Brian Leach, LABOR) over, en DIE ENE moet nog altijd haar EIGEN gedecodeerde
      // werk-aandeel wandelen (1440 min, niet de volle taakduur 2880 min) — vandaar dat deze tak,
      // anders dan de PRECIES-1-toewijzing-tak hierboven, `laborWalks.length >= 1` toetst (niet
      // `> 1`) en per definitie `workMinutes` gebruikt, nooit de volle duur. LABOR (het klokdossier
      // se eigen populatie, corpusbewijs) blijft wél meetellen; EQUIPMENT/SUBCONTRACTOR/CREW zijn
      // hier ongetoetst maar NIET uitgesloten (geen corpusbewijs tegen, en ze representeren —
      // anders dan MATERIAL — typisch wél kalenderbindende inzet). Poort dus specifiek op MATERIAL,
      // niet op "alles behalve LABOR". `resourceType === null` (onvindbare resource, Opus-her-check-
      // nit) sluit hier ook uit — conservatief: een niet-opgeloste resource wandelt niet zomaar mee
      // als LABOR.
      const laborWalks = walks.filter((w) => w.resourceType !== 'MATERIAL' && w.resourceType !== null);
      if (laborWalks.length >= 1 && laborWalks.every((w) => w.workMinutes !== null)) {
        // `startAnchor` blijft over ALLE toewijzingen gaan (óók MATERIAL) — dit is het VROEGSTE
        // ankerpunt voor een taak ZONDER voorganger (`CPMSolver.ts`'s `timephasedStartAnchor`), geen
        // wandel-invoer. MATERIAL-toewijzingen hebben nog altijd een zinvol eigen `assignmentStart`
        // (ze WORDEN ingezet vanaf dat moment, ook al is hun "werk" geen kalenderwandeling) —
        // "Task A" bewijst dit: Wade Golden/Jon Iles (MATERIAL in dit bestand) dragen het VROEGSTE
        // anker (08:00, MSP's eigen taak-start); zonder hen zou `startAnchor` op Brian Leach se
        // latere 23:00 belanden — een NIEUWE, eigen regressie op de START (gemeten tijdens deze
        // fixronde, hersteld vóór commit).
        const startAnchor = new Date(Math.min(...walks.map((w) => w.anchor.getTime())));
        result.set(taskId, {
          finishFloor: null, startAnchor,
          durationWalks: laborWalks.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId, workMinutes: w.workMinutes! })),
        });
      }
      // Anders: laag 5 (na filtering geen enkele niet-MATERIAL toewijzing over, of onvolledig
      // gedecodeerd werk — geen gedeeltelijke gok).
    }
    // Anders: laag 5, niets gezet (0 toewijzingen actief).
  }
  return result;
}

export function readMPP(bytes: Uint8Array, labels?: ImportLabels): ImportResult {
  const { cfb, projectProps, applicationVersion } = openMppProject(bytes);

  const { project, hoursPerDay, calendarHoursPerDayOverride } = parseProjectProperties(projectProps, labels);

  const taskFieldMap = createTaskFieldMap(projectProps);

  // T6: echte kalenders uit `"   114"/TBkndCal` (mppCalendars.ts) — basiskalenders + afgeleide
  // (resource-)kalenders, met de projectkalender gekozen via DEFAULT_CALENDAR_NAME.
  // `calendarHoursPerDayOverride` (alleen niet-`null` als MINUTES_PER_DAY echt aanwezig/geldig
  // was, zie `parseProjectProperties`'s returntype) gaat MEE de aanroep in — spiegelt mspdiReader
  // (MinutesPerDay-override in `parseCalendar`). UURMODUS (etappe 1.5): `readCalendars` draait nu
  // VÓÓR `readTasks` (omgekeerde volgorde t.o.v. vóór deze etappe) — `readTasks` heeft de
  // kalender-objecten (met hun scalar, nog-NIET-gepromoveerde `hoursPerDay`/banden) nodig om het
  // (c)-signaal per taak te bepalen vóórdat `readTasks` ze zelf promoveert (zie mppCalendars.ts's
  // moduleheader en `readTasks`'s Fase B/C). De kalenders die hieronder in `calendar`/
  // `calResult.resourceCalendars` belanden zijn dus PAS na de `readTasks`-aanroep volledig
  // gepromoveerd — dat is geen probleem: het zijn dezelfde object-referenties, `readTasks` muteert
  // ze in-place (via `promoteHourCalendar`), en `readMPP` leest ze pas hieronder, ná die aanroep.
  const calResult = readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride);
  const calendar = calResult.projectCalendar;
  project.calendarId = calendar.id;

  // I2 (T5-kwaliteitsreview)/etappe 1.5: `readTasks` zet `Task.calendarId` nu INLINE (spiegelt
  // mspdiReader's `taskCalendarId`-toewijzing tijdens de taken-lus) — de oude post-hoc-koppelstap
  // (`calendarUniqueIdByTaskId` → `calResult.calendarByUniqueId`-lookup ná `readTasks`) is dus
  // vervallen; `taskHourById` voedt T7's relaties (lag-eenheid-keuze, spiegelt mspdiReader).
  const { tasks, taskIdByUniqueId, taskHourById } = readTasks({
    cfb, taskFieldMap, hoursPerDay, statusDate: project.statusDate, applicationVersion, calResult,
  });

  // T7: relaties/resources/assignments — compleet ImportResult, geen placeholders meer.
  const sequences = readRelations(cfb, applicationVersion, hoursPerDay, taskIdByUniqueId, taskHourById);

  const resourceFieldMap = createResourceFieldMap(projectProps);
  const { resources, resourceIdByUniqueId } = readResources(cfb, resourceFieldMap, applicationVersion, calResult, labels);

  const assignmentFieldMap = createAssignmentFieldMap(projectProps);
  const assignments = readAssignments(cfb, assignmentFieldMap, taskIdByUniqueId, resourceIdByUniqueId);

  // Z19 (residu-iteratie "nul afwijkingen", dossier "resumeOverride-gate-verbreding") — `task.
  // resourceIds` vullen uit de zojuist gelezen `assignments`. Vóór deze taak liet `readMPP` dit veld
  // altijd `[]` (nooit gezet) — spiegelt letterlijk `ifcReader.ts`'s `reconstructResourceIds` (Fase
  // 3/H2, "resourceIds is een afgeleide projectie [van assignments] en wordt niet los bewaard, dus
  // reconstrueren i.p.v. lezen"): dezelfde eerste-zien-volgorde-met-deduplicatie, dezelfde
  // motivering (assignments zijn de bron, resourceIds is puur een projectie). Puur boekhouding, geen
  // timephased-decodering — geen enkele solverstap las dit veld voordien voor MPP-taken (byte-
  // identiek voor alle bestaande callers die het negeerden), UITSLUITEND `CPMSolver.ts`'s
  // `resumeOverride`-gate hieronder raadpleegt het vanaf nu.
  {
    const resourceIdsByTaskId = new Map<string, string[]>();
    for (const a of assignments) {
      let list = resourceIdsByTaskId.get(a.taskId);
      if (!list) { list = []; resourceIdsByTaskId.set(a.taskId, list); }
      if (!list.includes(a.resourceId)) list.push(a.resourceId);
    }
    for (const task of tasks) {
      const ids = resourceIdsByTaskId.get(task.id);
      if (ids) task.resourceIds = ids;
    }
  }

  // Z4 (etappe "nul afwijkingen") — splitsegmenten koppelen aan de taak (zie de functies hierboven
  // en mppTimephased.ts's moduleheader voor de volledige afleiding). Nog GEEN gedragswijziging aan
  // datums: geen solver-stap raadpleegt `Task.splitGaps` in deze etappe-fase (dat is Z7).
  const splitGapsByTaskId = deriveSplitGapsForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult);
  for (const task of tasks) {
    const gaps = splitGapsByTaskId.get(task.id);
    if (gaps) task.splitGaps = gaps;
  }

  // Z14b (eigenaarsbesluit 2026-08-18, punt 1 van het bindende eigenaarsprincipe) — de RAUWE
  // contourperiodes bewaren, los van (en NAAST) `splitGaps` hierboven: dit is de bron die een
  // latere edit-time-invalidatie van `splitGaps`/het Z8-venster (taskSlice.ts/mcpTransaction.ts)
  // NOOIT wist. Zie `deriveTimephasedContoursForTasks`'s eigen moduleheader.
  const contoursByTaskId = deriveTimephasedContoursForTasks(cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult);
  for (const task of tasks) {
    const contours = contoursByTaskId.get(task.id);
    if (contours && contours.length > 0) task.timephasedContours = contours;
  }

  // Z8-herwerkronde (etappe "nul afwijkingen") — gelaagde beslistabel voor timephased-venster vs.
  // -herberekening (zie de functie se eigen moduleheader hierboven voor de volledige toelichting
  // en het corpusbewijs). Laag 3 zet `timephasedFinishFloor` (gelezen), laag 4 zet
  // `timephasedDurationWalks` (verse herberekening); mutueel exclusief per taak. `startAnchor` is
  // bij beide lagen betekenisvol (bij laag 4 uitsluitend als wandel-oorsprong, niet als gelezen
  // antwoord — zie `Task.timephasedStartAnchor`'s docblok).
  const timephasedWindowByTaskId = deriveTimephasedWindowsForTasks(
    cfb, assignmentFieldMap, taskIdByUniqueId, tasks, calResult, resourceIdByUniqueId, resources,
  );
  for (const task of tasks) {
    const window = timephasedWindowByTaskId.get(task.id);
    if (!window) continue;
    if (window.finishFloor) task.timephasedFinishFloor = formatInstant(window.finishFloor, 'hour');
    if (window.startAnchor) task.timephasedStartAnchor = formatInstant(window.startAnchor, 'hour');
    if (window.durationWalks.length > 0) {
      // Z19-apportionering: `workMinutes` is UITSLUITEND aanwezig als het item uit de >1-toewijzing-
      // IN-TOTAAL-tak komt (`deriveTimephasedWindowsForTasks`'s finalisatielus, de `walks.length > 1`-
      // branche) — conditioneel gespreid zodat de tak die uit PRECIES 1 toewijzing IN TOTAAL ontstaat
      // (de `walks.length === 1 && layer4ActivatedTasks.has(taskId)`-branche) byte-identiek blijft
      // (geen `workMinutes: undefined`-property). N3-CORRECTIE (Opus-her-check, tweede ronde): dit is
      // GEEN uitspraak over de UITEINDELIJKE array-lengte hier — na de MATERIAL-filter in de >1-tak
      // (`mpp14resource.mpp`'s "Task A") kan `window.durationWalks.length` ALSNOG op 1 uitkomen terwijl
      // dat ene item wél `workMinutes` draagt (corpusbreed: 19 taken, zie de N3-blast-radius-meting
      // hierboven "walks===1 ... 19 daarvan NIEUW met een gezette workMinutes"). Een latere lezer die
      // hier "final length === 1 ⇒ nooit workMinutes" aanneemt, meet dus het verkeerde ding — de
      // GARANTIE zit op de BRANCH (welke tak van de finalisatielus het item leverde), niet op de
      // geobserveerde lengte van de uiteindelijke lijst.
      task.timephasedDurationWalks = window.durationWalks.map((w) => ({
        anchor: formatInstant(w.anchor, 'hour'), resourceCalendarId: w.resourceCalendarId,
        ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
      }));
    }
    // `ResourceAssignment.workWindowStart`/`workWindowFinish` (Z0-velden, ronden al door IFC via
    // Z14's `OPS_Timephased`-pset) — best-effort gevuld, UITSLUITEND voor laag 3 (een GELEZEN
    // antwoord past bij dat veldpaar se semantiek; laag 4's live-herberekende `durationWalks` heeft
    // geen enkel bevroren "venster" om hier te zetten — dat zou stale informatie suggereren).
    // `readAssignments` (mppEntities.ts) genereert een VERS `id` per toewijzing (`generateId('asgn')`,
    // geen relatie met de ruwe MPP-uid) en sluit de null-resource-toewijzingen uit (zie
    // `mppTimephased.ts`'s "VONDST VOOR Z8"-paragraaf) — een exacte per-toewijzing terugkoppeling zou
    // een VIERDE onafhankelijke `TBkndAssn`-lus vergen voor een zuiver informatief veld (P6-/MSPDI-
    // exportmeldingen tellen alleen de AANWEZIGHEID, zie `p6xmlWriter.ts`/`mspdiWriter.ts`). Daarom
    // hier de taak-brede aggregaten op ELKE resourced toewijzing van deze taak.
    if (task.timephasedFinishFloor) {
      for (const assignment of assignments) {
        if (assignment.taskId !== task.id) continue;
        assignment.workWindowFinish = task.timephasedFinishFloor;
        if (task.timephasedStartAnchor) assignment.workWindowStart = task.timephasedStartAnchor;
      }
    }
  }

  // Z16 (etappe "nul afwijkingen") — de meldingstelling draait HIER, ná beide mutatielussen
  // hierboven: `task.splitGaps` (Z4) en `task.timephasedFinishFloor`/`timephasedDurationWalks` (Z8)
  // staan pas op dit punt op de taak. Zie `countScheduleNotes`'s eigen docblok voor waarom dit geen
  // eigen byte-lezing is en dus geen synthetische fixture nodig heeft.
  const scheduleNotes = countScheduleNotes(tasks);

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars: calResult.resourceCalendars,
    // T12 (§9/O1), telling sinds Z16 herzien: alleen gezet als er daadwerkelijk ≥1 taak een signaal
    // draagt — `undefined` bij een schoon bestand, zodat `fileSlice.ts` met
    // `parsed.sourceScheduleNotes?.total` kan volstaan en geen aparte "0 gevonden"-staat hoeft te
    // onderscheiden.
    ...(scheduleNotes.total > 0 ? { sourceScheduleNotes: scheduleNotes } : {}),
  };
}
