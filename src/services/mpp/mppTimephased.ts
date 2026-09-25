/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Z3 (etappe "nul afwijkingen") — de timephased-decoder: de dag-voor-dag (of uur-voor-uur)
 * werksegmenten die MS Project per toewijzing bijhoudt (contouring, restwerk, overwerk). Dit
 * bestand is PUUR: het kent geen CFB/storage/field-map-kennis (dat is `mppEntities.ts`, die de
 * ruwe bytes opent en doorgeeft — zie haar `readAssignmentTimephasedRaw`), geen kalenderrekenen
 * (dat is de motor, buiten scope hier) en GEEN planningsgedrag — het decodeert alleen bytes naar
 * periode-records. Poort-bron: `TimephasedDataFactory.java` — in eigen woorden hieronder, zie de
 * "AFWIJKING VAN MPXJ"-paragraaf voor waar en waarom deze decoder bewust simpeler is.
 *
 * SCOPE-BEGRENZING (plan-Z3, letterlijk overgenomen besluit): uitsluitend de categorieën die Z4
 * (splitsegmenten afleiden) en Z8 (timephased venster bepaalt taakdatums) nodig hebben — actual
 * regular work, remaining regular work, actual overtime work, en hun irregular-tegenhanger. NIET
 * de 11 baseline-timephased-varianten, NIET de kostcategorieën — die dragen niets bij aan datums.
 * Zie `fieldMap14.ts`'s `AssignmentFieldId`-toelichting voor de vier concrete var-data-sleutels.
 *
 * TWEE VERSCHILLENDE BYTEFORMATEN (Z3-fixronde F1, kwaliteitsreview — een eerdere versie van dit
 * bestand nam aan dat alle vier de categorieën hetzelfde 20-byte-formaat delen; dat is ONWAAR,
 * geverifieerd tegen `ResourceAssignmentFactory.process` (rond r.202-213): `RAW_TIMEPHASED_
 * ACTUAL_REGULAR_WORK` (50) en `RAW_TIMEPHASED_ACTUAL_OVERTIME_WORK` (51) gaan door
 * `getCompleteWork` (samen met `TIMEPHASED_ACTUAL_IRREGULAR_WORK`, 87), maar `RAW_TIMEPHASED_
 * REMAINING_REGULAR_WORK` (49) gaat door een HELEMAAL ANDER pad: `getPlannedWork`. De twee delen
 * geen enkele byte-lay-out. Corpusbewijs (Z3-fixronde-meting, 3298 toewijzingen met timephased-
 * data): 3073/3298 `RAW_TIMEPHASED_REMAINING_REGULAR_WORK`-blokken passen op het 28-byte-model
 * hieronder (typische bloklengte 16 + 2×28 = 72 bytes) — de oorspronkelijke 20-byte-aanname gaf
 * daar stil `[]` op, precies de categorie die Z4 nodig heeft.
 *
 * ── Byteformaat A — REGULIER (`getCompleteWork`, categorieën 50/51 + hun irregular-tegenhanger
 * 87) — verifieer op inhoud, niet op deze samenvatting ────────────────────────────────────────
 *
 * REGULIER blok: 16-byte header (eerste 2 bytes = recordcount N, RUW) gevolgd door N+1 records van
 * 20 bytes elk. Het EERSTE van die N+1 records is een TOTAAL-record voor de hele toewijzing en
 * wordt overgeslagen (spiegelt MPXJ's `offset = 36` — 16-byte header + het 20-byte totaal-record —
 * vóórdat de N-tellende lus begint). Elk van de overige N records:
 *   offset  0: cumulatief werk aan periode-eind, DOUBLE, in 1000sten van een minuut
 *   offset  8: werk per uur deze periode, DOUBLE, in 10000sten van een uur (NIET gebruikt door
 *              deze decoder)
 *   offset 16: verstreken WERKMINUTEN aan periode-eind, INT, in 80sten van een minuut, CUMULATIEF
 *              vanaf een impliciet "periode 0"-ankerpunt
 * VÓÓR de lus leest MPXJ ÉÉN keer `finishTime = getInt(regularData, 24)` (absolute offset 24 — dat
 * valt IN het totaal-record, op wat qua veld-indeling het "werk-per-uur"-double zou zijn; MPXJ
 * hergebruikt die bytes bewust/toevallig als sanity-plafond). Per periode geldt dan: is de RUWE
 * (nog-niet-door-80-gedeelde) `elapsedMinutesAtPeriodEnd` `< 0` of `> finishTime`, dan wordt hij op
 * 0 gezet (corrupt/absurd record) i.p.v. gedeeld door 80 — `decodeRegularTimephasedWork` hieronder
 * poort deze guard letterlijk (Z3-fixronde F3(1)).
 * Werk-afronding (Z3-fixronde F3(2), letterlijk uit `getCompleteWork`): de cumulatieve-werk-DOUBLE
 * wordt eerst met een `(long)`-cast getrunceerd (bij ons: `Math.trunc`) VÓÓRDAT het verschil met de
 * vorige periode genomen wordt — dat verschil (nog in 1000sten) wordt daarna gedeeld door 1000 en
 * afgerond op de dichtstbijzijnde SECONDE (`roundMinutesToSeconds`: `Math.round(m*60)/60`). Zonder
 * die twee stappen zou een drijvendekomma-residu van bv. 1e-13 een "gat" (workMinutes===0) laten
 * lijken op een piepklein positief getal — Z4's gat-detectie hangt op een EXACTE `=== 0`-vergelijk.
 *
 * ── Byteformaat B — PLANNED/REMAINING (`getPlannedWork`, categorie 49) — apart formaat ─────────
 *
 * 16-byte header (eerste 2 bytes = blockCount N, RUW). GEEN "N+1"-conventie zoals bij Format A:
 * hier betekent N=0 een SPECIAAL geval (één samenvattend record, zie hieronder); N≥1 betekent een
 * summary-blok (overgeslagen, net als Format A's totaal-record — maar hier 28 bytes, niet 20) +
 * N periode-blokken van 28 bytes elk. Elk periode-blok:
 *   offset  0: cumulatief werk aan periode-eind, DOUBLE, in 1000sten van een minuut (GEEN
 *              `(long)`-truncatie hier — MPXJ's `getPlannedWork` mist die stap, ANDERS dan Format
 *              A; deze decoder poort dat verschil letterlijk, geen eigen "consistentie"-correctie)
 *   offset  8: uren per dag, DOUBLE, in 20000sten van een uur — NIET gebruikt (MPXJ's eigen
 *              commentaar: "unreliable value, not used")
 *   offset 16: onbekend (DOUBLE) — NIET gebruikt (MPXJ's eigen commentaar: "unknown")
 *   offset 24: cumulatief verstreken WERKMINUTEN aan periode-eind, INT, in 80sten van een minuut
 *              (LET OP: offset 24, niet 16 zoals Format A — ANDERE recordlay-out, GEEN finishTime-
 *              guard hier, MPXJ's `getPlannedWork` kent die guard niet)
 * `blockCount === 0`-geval: één samenvattend record voor de HELE toewijzing, gelezen uit het
 * summary-blok zelf (`getDouble(data, 16) / 1000`, het totale werk). MPXJ ankert dit record op
 * `assignment.getStart()`/`assignment.getResume()` én `assignment.getFinish()` — TWEE externe
 * ankerpunten die deze pure decoder niet zelfstandig kent. `decodePlannedRegularTimephasedWork`
 * ondersteunt dit geval daarom ALLEEN als de aanroeper `referenceFinish` meegeeft; zonder dat
 * levert `blockCount === 0` een lege lijst (gedocumenteerde, geen stille foutieve aanname).
 *
 * ── AFWIJKING VAN MPXJ (bewuste vereenvoudiging, expliciet vastgelegd) ──────────────────────────
 *
 * MPXJ's `getCompleteWork` weeft irregulier- en regulier-blok ALTIJD samen (calendar-bewust
 * `splitItem`) en `getPlannedWork`/`getCompleteWork` zetten hun periode-grenzen om in ECHTE
 * kalenderinstants via `ProjectCalendar.getDate`/`getNextWorkStart` — d.w.z. de "verstreken
 * WERKMINUTEN"-velden hierboven zijn WERKtijd, geen 24/7-klok, en het terugrekenen naar een
 * concrete datum vereist een kalenderwandeling (weekend/nacht/vrije dagen overslaan). Die
 * kalenderwandeling bestaat op dit niveau niet — vandaar dat elke decoder hieronder de WERKMINUUT-
 * OFFSETS als PRIMAIR resultaat teruggeeft (`elapsedWorkMinutesStart`/`End`), NIET een instant.
 * Een `approxStart`/`approxFinish`-veld is aanwezig als 24/7-KLOKMINUTEN-PROJECTIE vanaf
 * `referenceStart` — uitdrukkelijk een BENADERING die alleen klopt zolang de periode geen
 * niet-werktijd overspant, NOOIT te gebruiken voor datum-/planningsbeslissingen. De echte
 * kalenderwandeling (werkminuten → instant, kalender-bewust) is Z8's taak.
 * Verder: deze module weeft irregulier/regulier NIET samen zoals `splitItem` — dat is calendar-
 * afhankelijk en dus geen "pure decoder" meer. `decodeIrregularTimephasedWork` levert de
 * irreguliere periodes RECHTSTREEKS uit hun eigen ABSOLUTE MPP-timestamps (die zijn per definitie
 * al instants, geen projectie nodig) als eigen, apart type (`TimephasedIrregularPeriod`) — geen
 * los amount-veld bestaat in dat blok (MPXJ gebruikt het uitsluitend om een regulier record te
 * CORRIGEREN); deze decoder rekent daarom het volledige tijdvak als werk, een OPS-eigen keuze.
 * Consequentie: Z4/Z8 krijgen een RUWE, ongeweven momentopname per blok — dat is precies wat Z3
 * vraagt ("de timephased werksegmenten... leesbaar", "pure decoder, geen planningsgedrag").
 *
 * ── Z4 (etappe "nul afwijkingen") — splitsegmenten afleiden ─────────────────────────────────────
 *
 * VERPLICHTE MEETSTAP (plan-§1.3/Z0, "meet-afhankelijke keuze" — vóór implementatie uitgevoerd,
 * wegwerpscript, niet gecommit): `mpxj/junit/data/mpp14splittask.mpp` (MPXJ-crawl, 2 taken, elk
 * ÉÉN gat) reproduceert MSP's EIGEN opgeslagen `FINISH` exact uit `start + duur + gat`, MITS het
 * gat in WERKMINUTEN telt — Z0's offsetvorm is dus BEVESTIGD, geen afwijking, geen escalatie nodig:
 *   - Taak "Split Task 1": start 2006-09-21T08:00, duur 4800 min (10 werkdagen), gat
 *     {afterMinutes: 1920, gapMinutes: 1440} (1440 min ÷ 480 min/werkdag = 3 WERKDAGEN — Z4-
 *     fixronde-correctie: een eerdere versie van deze regel beweerde "1 werkdag+2u", een rekenfout
 *     — spiegelt exact het gedecodeerde `remainingRegularWork`-record met `workMinutes===0`).
 *     `addWorkMinutes(start, 4800+1440)` (de
 *     CalendarEngine-primitief die T5/T7 al gebruiken) geeft PRECIES de opgeslagen finish
 *     (2006-10-09T17:00) — byte-exact, geen afronding nodig.
 *   - Taak "Split Task 2": start 2006-09-21T08:00, duur 7200 min (15 werkdagen), TWEE gaten
 *     ({afterMinutes:1440, gapMinutes:960}, {afterMinutes:4800, gapMinutes:1440}). Zelfde formule
 *     (`addWorkMinutes(start, 7200+960+1440)`) geeft PRECIES de opgeslagen finish (2006-10-18T17:00).
 *   - Ter vergelijking: de KALENDERMINUTEN-hypothese (het gat als 24/7-wandkloktijd optellen i.p.v.
 *     als extra werkminuten) geeft voor beide taken een ANDERE, VERKEERDE finish (respectievelijk
 *     4 en 2 dagen te vroeg in deze meting) — WEERLEGD.
 *   - "Blijft het voltooide segment staan terwijl restwerk schuift?" — NIET waarneembaar aan dit
 *     bestand: beide taken staan op 0% voltooid (`percentComplete: 0`, `actualStartTs`/
 *     `actualFinishTs`: null, `actualRegularWork` decodeert leeg) — er ís geen voltooid segment om
 *     te meten. Dat is een EERLIJKE meetbeperking, geen aanname: deze vraag hoort expliciet bij Z7
 *     (die "de splitsende taken in het OzBuild-materiaal" als aanvullend bewijs moet meten, plan-
 *     §Z7) en wordt hier NIET beantwoord.
 *
 * ALGORITME (`deriveSplitGapsFromPeriods`) — poort van MPXJ's `ResourceAssignment.getWorkSplits()`
 * in eigen woorden: filter EERST alle periodes met `workMinutes === 0` weg (die dragen geen andere
 * informatie dan "de klok liep door zonder werk" — dat IS precies het gat, geen apart object) en
 * sorteer de OVERGEBLEVEN (werkende) periodes op `elapsedWorkMinutesStart`; vergelijk dan elk
 * opeenvolgend PAAR: een STRIKTE discontinuïteit (`volgende.elapsedWorkMinutesStart >
 * vorige.elapsedWorkMinutesEnd`) is een gat van dat verschil, op offset `vorige.elapsedWorkMinutesEnd`.
 * Twee AANGRENZENDE werkperiodes (gelijk, geen `>`) leveren GEEN kandidaat. Dit ontwerp poort
 * MPXJ's "segment met totalAmount==0 is een gat; aangrenzende werksegmenten mergen" letterlijk:
 * de filter+paarsgewijze-vergelijking MERGET automatisch N opeenvolgende nul-werk-records tot ÉÉN
 * gat (het paar vóór/ná die hele nul-werk-run) zonder een aparte merge-stap, en de STRIKTE `>`
 * voorkomt een fantoom-gat van 0 minuten op de naad tussen twee aangrenzende werksegmenten (bv. de
 * grens tussen een "actual"- en een "remaining"-record die toevallig precies aansluiten) — zie
 * `check-mpp-import.ts`'s Z4-sectie voor de twee bijbehorende mutatiebewijzen (nul-werk-detectie
 * weg ⇒ elke discontinuïteit verdwijnt want de nul-periode zelf overbrugt de naad; strikte `>`
 * vervangen door "altijd pushen" ⇒ fantoom-gat van 0 minuten op elke aangrenzende naad).
 *
 * SCOPE (spiegelt Z3's eigen scope-begrenzing, zelfde motivering): alleen `actualRegularWork` +
 * `remainingRegularWork` voeden de gat-afleiding. NIET `actualOvertimeWork` (overuren gebeuren
 * PARALLEL aan reguliere uren op dezelfde WERKminuten-as — "extra werk tijdens een gat" zou het
 * per definitie GEEN gat meer maken, maar dit corpusbestand draagt sowieso geen overurendata om die
 * interactie te verifiëren; uitgesteld, geen aanname). NIET `actualIrregularWork` (die periodes
 * dragen ABSOLUTE MPP-instants, geen `elapsedWorkMinutes`-offset — structureel incompatibel met
 * deze offset-gebaseerde afleiding zonder een kalenderwandeling, die hier expliciet buiten scope is).
 *
 * AGGREGATIEREGEL (`deriveTaskSplitGaps`, acceptatiepunt (d)) — DOORSNEDE (intersectie) van de
 * gat-intervallen over alle toewijzingen van een taak. REFERENTIE-BEVESTIGD (Z4-fixronde, was
 * eerder "ongeverifieerd" — nu geverifieerd tegen de MPXJ-bron): `Task.java`'s `calculateWorkSplits`
 * doet `getResourceAssignments().stream().map(ResourceAssignment::getWorkSplits).reduce(this::
 * reduceWorkSplits)` — d.w.z. MPXJ berekent taakniveau-splits als de VERENIGING van elke toewijzing
 * se eigen WERK-bereiken (`reduceWorkSplits`/`addWorkSplit`: overlappende of aangrenzende
 * werkbereiken van verschillende toewijzingen worden gemerged tot één breder bereik). Met De
 * Morgan is "vereniging van werkbereiken" wiskundig identiek aan "doorsnede van de complementen"
 * — en de complementen van de werkbereiken ZIJN precies de gaten. Onze eigen motivering (MSP's
 * Gantt-balk toont "bezig" zodra ÉÉN toegewezen resource werkt; een split hoort alleen te
 * verschijnen waar ALLE toewijzingen tegelijk stilliggen) is dus niet alleen intuïtief maar de
 * LETTERLIJKE MPXJ-semantiek, op een detail na: MPXJ werkt op ECHTE kalenderinstants (`LocalDateTime
 * Range`, met een kalender-bewuste aaneengesloten-check, `calendar.getWork(...) == 0`), deze module
 * op WERKminuten-offsets zonder kalenderwandeling (zie de moduleheader hierboven) — voor twee
 * toewijzingen op DEZELFDE taak-as (zie de "TAAK-AS, NIET TOEWIJZINGS-AS"-paragraaf hieronder) zijn
 * beide vormen equivalent, omdat de kalenderwandeling zelf niet meer nodig is: de intervallen liggen
 * al in dezelfde eenheid. Een toewijzing ZONDER timephased-data draagt geen signaal en wordt
 * UITGESLOTEN van de doorsnede (niet als "altijd stil" behandeld — dat zou elders een fantoomgat
 * forceren); de aanroeper (`mppReader.ts`) geeft daarom alleen toewijzingen door die daadwerkelijk
 * periodes decodeerden. Bij één toewijzing (de meerderheid, incl. beide corpustaken hierboven) is
 * dit triviaal identiek aan die ene lijst.
 *
 * SAMENVATTINGSTAKEN (Z4-fixronde, punt 4 — gratis geborgd uit de MPXJ-bron): `Task.java`'s
 * `calculateWorkSplits` begint met `if (getSummary()) return Collections.emptyList();` — "In MS
 * Project, summary tasks do not show splits" (letterlijke code-commentaar, hier vertaald, niet
 * gekopieerd). `mppReader.ts`'s koppelcode filtert daarom semantische samenvattingen uit vóórdat ze
 * `Task.splitGaps` zet — spiegelt exact deze MPXJ-regel, niet een eigen aanname.
 *
 * TAAK-AS, NIET TOEWIJZINGS-AS (Z4-fixronde, punt 2+3 — CORRECTIE): een eerdere versie van deze
 * module concateneerde `actualRegularWork`/`remainingRegularWork` alsof BEIDE tracks, over ALLE
 * toewijzingen van een taak, op DEZELFDE `elapsedWorkMinutesStart=0` beginnen. Dat is WEERLEGD door
 * `TimephasedDataFactory.java` (in eigen woorden):
 *   - `getCompleteWork` (actual): `LocalDateTime calendarPeriodStart = resourceAssignment.getStart()`
 *     — ALTIJD de toewijzing se EIGEN start, niet de taakstart. Die twee vallen samen zolang een
 *     toewijzing niet vertraagd is; bij een vertraagde/later-toegevoegde toewijzing NIET.
 *   - `getPlannedWork` (remaining): `LocalDateTime start = timephasedComplete.isEmpty() ?
 *     assignment.getStart() : assignment.getResume()` — zónder al verricht werk hetzelfde
 *     ankerpunt als actual (dus SAMENVALLEND, en precies waarom de VERPLICHTE meetreferentie
 *     hierboven — 0% voltooid op beide taken — dit gat nooit blootlegde); MÉT al verricht werk
 *     ankert de REMAINING-track op `assignment.getResume()` — een APART, LATER punt dan waar
 *     `actualRegularWork` eindigt, dus NIET simpelweg "actual se eigen laatste `elapsedWorkMinutes
 *     End`" (die twee tellers hebben elk hun EIGEN nulpunt uit de ruwe bytes, en simpelweg
 *     concateneren telt twee nulpunten op elkaar i.p.v. ze in dezelfde as te zetten).
 *   `mppReader.ts` (de koppellaag, niet deze pure module) leest daarom `AssignmentField.START`
 *   (`fieldMap14.ts`'s `AssignmentFieldId.Start`) en `AssignmentField.RESUME` (`...Resume`) — BEIDE
 *   ECHTE MPP-timestampvelden, geen afleiding — en verschuift (`shiftPeriods` hieronder, PUUR,
 *   geen kalenderwandeling zelf) de gedecodeerde periodes met de WERKMINUTEN-afstand
 *   taakstart→ankerdatum (via `CalendarEngine.workMinutesBetween`, ÉÉN keer per toewijzing, in de
 *   koppellaag — de kalenderwandeling blijft dus daar, deze module blijft calendar-vrij). Ontbreekt
 *   `AssignmentField.RESUME` in het bestand (MPXJ heeft er zelf geen default-terugval voor, zie
 *   `fieldMap14.ts`), dan valt `mppReader.ts` terug op een BENADERING (actual se eigen laatste
 *   `elapsedWorkMinutesEnd`, verschoven) — gedocumenteerd als terugval, niet als de primaire regel.
 *   Consequentie voor de DOORSNEDE hierboven: nu ALLE toewijzingen van een taak op dezelfde
 *   TAAK-relatieve as staan, is een cross-toewijzing-vergelijking pas betekenisvol — vóór deze
 *   correctie kon de doorsnede twee ONVERGELIJKBARE assen naast elkaar leggen.
 *   UUR-MODUS-ALLEEN (tijdens het testen ontdekt, geen aparte plan-vondst): de kalenderwandeling
 *   die deze verschuiving uitrekent (`CalendarEngine.workMinutesBetween`) is een zuivere uur-
 *   modus-primitief — ze GOOIT op een dag-modus-kalender (geen `workTime`). `mppReader.ts` bewaakt
 *   dat met `engine.isHourMode` (spiegelt hetzelfde patroon dat elders in dat bestand al staat,
 *   `CPMSolver.ts`'s eigen conventie): DAG-modus-taken krijgen shift 0, byte-identiek t.o.v. vóór
 *   deze fixronde — geen gegokte dag-granulaire formule zonder corpusmeting.
 *
 * ONGEDEELD SAMENVATTINGSRECORD TOONT PER DEFINITIE GEEN GAT (Z4-fixronde, punt 1 — CORRECTIE):
 * Format B se `blockCount === 0`-geval (zie hierboven) levert ÉÉN record dat het VOLLEDIGE
 * resterende venster als niet-nul werk claimt (`getPlannedWork`: `if (totalWorkInMinutes != 0.0)`)
 * — een blok zonder interne verdeling kan per constructie geen gat binnen zichzelf tonen, en het
 * gebruiken van `referenceFinish` om zo'n record te reconstrueren (zoals een eerdere versie van
 * `mppReader.ts` deed) overbrugt zo een gat dat WEL in het gedetailleerde (`blockCount>=1`)-pad
 * zichtbaar zou zijn geweest, met een spuriale KLOKminuten-lengte op de WERKminuten-as. `mppReader
 * .ts`'s splits-koppelcode geeft daarom BEWUST géén `referenceFinish` mee aan
 * `decodePlannedRegularTimephasedWork` — `blockCount===0` levert dan `[]` (het gedocumenteerde,
 * al-bestaande gedrag zónder `referenceFinish`, zie hierboven), in plaats van een record dat een
 * gat zou kunnen wegpoetsen. Z8 (die WEL de volledige taakdatum nodig heeft, niet alleen gaten) mag
 * `referenceFinish` wél meegeven — dat is een ANDER gebruik met een ANDERE afweging.
 * REIKWIJDTE VAN HET MUTATIEBEWIJS (Z4-her-check, verzachting — de vorige versie van deze alinea
 * suggereerde meer dan bewezen): het mutatiebewijs voor "MET referenceFinish verandert de
 * gatenlijst" (`check-mpp-import.ts`'s "Vergelijkende bugbewijzen") roept
 * `decodePlannedRegularTimephasedWork` RECHTSTREEKS aan, met en zonder `referenceFinish` — dat is
 * DECODER-niveau. Dat `mppReader.ts`'s splits-koppelcode zelf bewust géén `referenceFinish`
 * doorgeeft is een CALLSITE-ONTWERPKEUZE, geverifieerd door een aparte, POSITIEVE
 * callsite-integratietest (`[Z4 punt1]`, via `deriveSplitGapsForTasks`) — er is geen aparte
 * CALLSITE-mutatietest die die koppelcode zelf muteert (bv. terug `referenceFinish` laten
 * doorgeven) en de volledige `readMPP`/`deriveSplitGapsForTasks`-keten rood laat zien. De
 * invariant zelf staat dus vast; alleen het NIVEAU van het mutatiebewijs was hierboven te sterk
 * geformuleerd.
 *
 * VONDST VOOR Z8 (mppReader.ts's uid→taak-brug, zie de toelichting daar): een taak ZONDER
 * toegewezen resource draagt in dit bestand tóch een `TBkndAssn`-record met timephased-data — MSP
 * gebruikt de assignment-tabel ook als "drager" voor een taak se eigen tijdgefaseerde profiel
 * wanneer er geen echte resource is (`resourceUid === -65535`, MPXJ's `ASSIGNMENT_NULL_RESOURCE_ID`
 * -sentinel — zie `mppEntities.ts`'s eigen commentaar bij die sentinel). `readAssignments`
 * (mppEntities.ts) sluit zulke records BEWUST uit van `ResourceAssignment[]` (geen resource ⇒ geen
 * toewijzing) — dus een brug die uitsluitend via `ResourceAssignment.id` loopt, mist PRECIES de
 * twee toewijzingen die `mpp14splittask.mpp` (de VERPLICHTE referentie hierboven) draagt. Z4's
 * brug in `mppReader.ts` gaat daarom rechtstreeks via `taskId` (niet via `ResourceAssignment.id`) —
 * zie de toelichting daar. Z8 (die `ResourceAssignment.workWindowStart`/`Finish` moet VULLEN, dus
 * wél een echt toewijzingsobject nodig heeft) loopt tegen DEZELFDE `-65535`-populatie aan en moet
 * zelf beslissen hoe ze een venster op een niet-bestaande toewijzing vastlegt (bv. op de taak zelf,
 * of door een synthetische toewijzing te materialiseren) — dit is hier NIET opgelost, alleen gemeten
 * en doorgegeven zodat Z8 niet opnieuw hoeft te ontdekken waarom haar brug leeg blijft.
 */
import type { TaskSplitGap } from '@/types/task';
import { getShort, getInt, getDouble, getTimestamp } from './mppPrimitives';
import {
  clampTimephasedRegularRecordCount, clampTimephasedIrregularRecordCount, clampTimephasedPlannedRecordCount,
} from './limits';

/** Eén werkperiode uit een WERKMINUUT-gebaseerd timephased-blok (Format A of B — zie moduleheader).
 *  `elapsedWorkMinutesStart`/`End` zijn het PRIMAIRE, betrouwbare resultaat (cumulatieve
 *  werkminuten sinds het venster begon — GEEN kalenderklok). `approxStart`/`approxFinish` zijn een
 *  24/7-KLOKMINUTEN-PROJECTIE vanaf `referenceStart`, uitdrukkelijk een BENADERING (zie
 *  moduleheader's "AFWIJKING VAN MPXJ") — NOOIT gebruiken voor datum-/planningsbeslissingen; de
 *  echte kalenderwandeling is Z8's taak. */
export interface TimephasedWorkPeriod {
  /** Cumulatieve werkminuten sinds `referenceStart` tot het BEGIN van deze periode. */
  elapsedWorkMinutesStart: number;
  /** Cumulatieve werkminuten sinds `referenceStart` tot het EIND van deze periode. Altijd
   *  `> elapsedWorkMinutesStart` (zie de "geen ontaarde periodes"-filter in de decoders). */
  elapsedWorkMinutesEnd: number;
  /** Werk in deze periode, in MINUTEN — kan 0 zijn (een periode zonder werk, maar mét verstreken
   *  werkminuten: dat IS het gat dat Z4 als splitsegment herkent). Nooit gefilterd op nul. */
  workMinutes: number;
  /** BENADERING, zie het moduleheader — 24/7-klokminuten-projectie, geen kalenderwandeling. */
  approxStart: Date;
  /** BENADERING, zie het moduleheader. */
  approxFinish: Date;
}

/** Eén periode uit het IRREGULIERE blok — ECHTE absolute MPP-instants (geen projectie, de bytes
 *  dragen zelf al datum+tijd), dus GEEN aparte "approx"-onderscheiding nodig. Zie moduleheader
 *  voor waarom `workMinutes` hier de volledige tijdspanne is (OPS-eigen keuze, geen MPXJ-poort). */
export interface TimephasedIrregularPeriod {
  start: Date;
  finish: Date;
  workMinutes: number;
}

const REGULAR_HEADER_SIZE = 16;
const REGULAR_RECORD_SIZE = 20;
const PLANNED_HEADER_SIZE = 16;
const PLANNED_BLOCK_SIZE = 28;
const IRREGULAR_HEADER_SIZE = 16;
const IRREGULAR_RECORD_SIZE = 8;

/** `referenceStart + minutes` in 24/7 KLOKminuten — zie moduleheader: dit is een BENADERING
 *  (`approxStart`/`approxFinish`), geen kalenderwandeling. Lokale, triviale helper i.p.v. een
 *  import uit `@/engine/scheduler/duration`: deze module heeft geen enkele andere engine-
 *  afhankelijkheid, en een import zou schijnkoppeling toevoegen aan een module die zich expliciet
 *  presenteert als "geen planningsgedrag" — en zou bovendien NIETS aan de kalender-onjuistheid
 *  veranderen (`addElapsedMinutes` is óók 24/7, geen werkminuut-bewuste kalenderwandeling). */
function addClockMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

/** MPXJ's `roundMinutesToSeconds` (`TimephasedDataFactory.java`) — rondt af op de dichtstbijzijnde
 *  1/60 minuut (seconde). Zie moduleheader/F3(2): voorkomt dat een drijvendekomma-residu een
 *  `workMinutes === 0`-gat-detectie (Z4) laat missen. */
function roundMinutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60) / 60;
}

/**
 * Decodeert een REGULIER timephased-blok (Format A — categorieën `ActualRegularWork`/
 * `ActualOvertimeWork`, zie moduleheader). `referenceStart` is het ankerpunt voor `approxStart`/
 * `approxFinish` — zie de "AFWIJKING VAN MPXJ"-paragraaf voor waarom dit een parameter is i.p.v.
 * een intern opgezocht veld, en waarom het uitdrukkelijk een BENADERING is.
 *
 * `data === null` (categorie niet aanwezig) of te kort voor zelfs het totaal-record ⇒ lege lijst,
 * geen exceptie (spiegelt het bestaande `readXUnsafe`-precedent).
 */
export function decodeRegularTimephasedWork(data: Uint8Array | null, referenceStart: Date, ctx = 'timephased regular'): TimephasedWorkPeriod[] {
  if (!data || data.length < REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  // KLEM (hardening-checklist): de header-recordcount is een ONGEVALIDEERDE bestandswaarde.
  // STRUCTUREEL geklemd tegen wat de daadwerkelijke bloklengte kan dragen (spiegelt FixedMeta/
  // VarMeta12's adjustedItemCount-patroon — mppPrimitives.ts) VÓÓRDAT ie als lusbovengrens dient,
  // en DAARNA tegen `MAX_TIMEPHASED_REGULAR_RECORDS` (limits.ts, met meetcommentaar) als absolute
  // bovengrens. Geen allocatie is ooit met de RUWE `headerCount` gesized.
  const structuralMax = Math.max(0, Math.floor((data.length - REGULAR_HEADER_SIZE - REGULAR_RECORD_SIZE) / REGULAR_RECORD_SIZE));
  const count = clampTimephasedRegularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  // F3(1): finishTime-sanity-plafond, ÉÉN keer gelezen (spiegelt MPXJ's `getInt(regularData, 24)`
  // vóór de lus — absolute offset 24, binnen het totaal-record, ONGEACHT of dat record verder
  // gebruikt wordt). `data.length` is hier al ≥ 36 (guard hierboven), dus offset 24 is altijd
  // binnen bereik.
  const finishTime = getInt(data, 24, ctx);

  const result: TimephasedWorkPeriod[] = [];
  let prevRawCumulativeWork = 0; // RUW (1000sten van een minuut), getrunceerd — zie F3(2)
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    // +REGULAR_RECORD_SIZE: het EERSTE fysieke record (bytes 16..36) is het totaal-record en wordt
    // overgeslagen — periode-index 0 hieronder leest dus al het TWEEDE fysieke record.
    const offset = REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE + i * REGULAR_RECORD_SIZE;

    // F3(2): `(long)`-truncatie VÓÓR het verschil (MPXJ: "(long) MPPUtility.getDouble(...)").
    const rawCumulativeWork = Math.trunc(getDouble(data, offset, ctx));

    // F3(1): de RUWE (nog-niet-door-80-gedeelde) waarde eerst tegen `finishTime` toetsen.
    const rawElapsed = getInt(data, offset + 16, ctx);
    const cumulativeElapsedMinutes = (rawElapsed < 0 || rawElapsed > finishTime) ? 0 : rawElapsed / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    // Geen ontaarde (nul-lengte) periodes — spiegelt MPXJ's `removeEmptyItems` (start===finish
    // weggefilterd). Een periode ZONDER werk maar MET verstreken werkminuten blijft wél staan (dat
    // is het gat dat Z4 straks herkent) — alleen `periodElapsedMinutes <= 0` wordt overgeslagen.
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: roundMinutesToSeconds((rawCumulativeWork - prevRawCumulativeWork) / 1000),
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevRawCumulativeWork = rawCumulativeWork;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

/**
 * Decodeert een PLANNED/REMAINING timephased-blok (Format B — categorie `RemainingRegularWork`,
 * zie moduleheader). ANDER formaat dan `decodeRegularTimephasedWork` (28-byte records, elapsed op
 * offset 24, geen finishTime-guard, geen `(long)`-truncatie op het werkveld) — poort van MPXJ's
 * `getPlannedWork`, NIET `getCompleteWork`.
 *
 * `referenceFinish` (OPTIONEEL): alleen nodig voor het `blockCount === 0`-speciale geval (één
 * samenvattend record voor de hele toewijzing — zie moduleheader). Zonder `referenceFinish` levert
 * dat geval een lege lijst (gedocumenteerde beperking, geen aanname).
 */
export function decodePlannedRegularTimephasedWork(
  data: Uint8Array | null,
  referenceStart: Date,
  referenceFinish?: Date,
  ctx = 'timephased planned',
): TimephasedWorkPeriod[] {
  if (!data || data.length < PLANNED_HEADER_SIZE + 8) return []; // te kort voor zelfs het cumulatieve-werkveld van het summary-blok

  const blockCount = getShort(data, 0, ctx);

  if (blockCount === 0) {
    if (!referenceFinish) return []; // geen tweede ankerpunt beschikbaar — zie moduleheader
    const totalWorkMinutes = getDouble(data, 16, ctx) / 1000;
    if (totalWorkMinutes === 0) return []; // MPXJ: "If the total work for the block is zero it's not valid"
    return [{
      elapsedWorkMinutesStart: 0,
      elapsedWorkMinutesEnd: Math.max(0, (referenceFinish.getTime() - referenceStart.getTime()) / 60_000),
      workMinutes: totalWorkMinutes,
      approxStart: referenceStart,
      approxFinish: referenceFinish,
    }];
  }

  // STRUCTUREEL + ABSOLUUT geklemd, zelfde tweetraps-discipline als de reguliere decoder — eigen
  // klem (`MAX_TIMEPHASED_PLANNED_RECORDS`, limits.ts) omdat dit blok een andere recordgrootte
  // (28 i.p.v. 20 bytes) en dus een andere structurele afleiding heeft.
  const structuralMax = Math.max(0, Math.floor((data.length - PLANNED_HEADER_SIZE - PLANNED_BLOCK_SIZE) / PLANNED_BLOCK_SIZE));
  const count = clampTimephasedPlannedRecordCount(Math.min(Math.max(0, blockCount), structuralMax));

  const result: TimephasedWorkPeriod[] = [];
  let prevCumulativeWorkMinutes = 0; // GEEN `(long)`-truncatie hier — `getPlannedWork` mist die stap (moduleheader)
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    // +PLANNED_BLOCK_SIZE: het EERSTE fysieke blok (bytes 16..44) is het summary-blok en wordt
    // overgeslagen (spiegelt MPXJ's `offset = 16 + 28`).
    const offset = PLANNED_HEADER_SIZE + PLANNED_BLOCK_SIZE + i * PLANNED_BLOCK_SIZE;
    const cumulativeWorkMinutes = getDouble(data, offset, ctx) / 1000;
    // LET OP: offset 24, NIET 16 — andere recordlay-out dan Format A (zie moduleheader).
    const cumulativeElapsedMinutes = getInt(data, offset + 24, ctx) / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: cumulativeWorkMinutes - prevCumulativeWorkMinutes,
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevCumulativeWorkMinutes = cumulativeWorkMinutes;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

/**
 * Decodeert een IRREGULIER timephased-blok (zie moduleheader). Geen referentiepunt nodig — de
 * twee 4-byte velden per record zijn al absolute MPP-timestamps.
 */
export function decodeIrregularTimephasedWork(data: Uint8Array | null, ctx = 'timephased irregular'): TimephasedIrregularPeriod[] {
  if (!data || data.length < IRREGULAR_HEADER_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  // Zelfde tweetraps-klem-discipline als hierboven, eigen constante (limits.ts) omdat dit blok een
  // andere recordgrootte/verwachte-dichtheid heeft.
  const structuralMax = Math.max(0, Math.floor((data.length - IRREGULAR_HEADER_SIZE) / IRREGULAR_RECORD_SIZE));
  const count = clampTimephasedIrregularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  const result: TimephasedIrregularPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const offset = IRREGULAR_HEADER_SIZE + i * IRREGULAR_RECORD_SIZE;
    const start = getTimestamp(data, offset, ctx);
    const finish = getTimestamp(data, offset + 4, ctx);
    // getTimestamp geeft null terug voor MPP se eigen "N/A"-heuristieken (mppPrimitives.ts) — een
    // NA-timestamp of een ontaarde/omgekeerde periode wordt overgeslagen, geen crash.
    if (!start || !finish || finish.getTime() <= start.getTime()) continue;
    result.push({ start, finish, workMinutes: (finish.getTime() - start.getTime()) / 60_000 });
  }
  return result;
}

/** Vier ruwe timephased-byte-blokken voor ÉÉN toewijzing — spiegelt de scope-begrenzing hierboven
 *  (`AssignmentFieldId`'s vier categorieën). `mppEntities.ts`'s `readAssignmentTimephasedRaw`
 *  vult dit type; `null` per veld = die categorie is voor deze toewijzing legitiem afwezig (geen
 *  var-data-entry voor die sleutel — normaal voor een toewijzing zonder contouring/restwerk).
 *  `remainingRegularWork` decodeert via `decodePlannedRegularTimephasedWork` (Format B); de
 *  overige drie via `decodeRegularTimephasedWork`/`decodeIrregularTimephasedWork` (Format A) —
 *  zie moduleheader voor waarom dat GEEN gedeeld formaat is. */
export interface AssignmentTimephasedRaw {
  actualRegularWork: Uint8Array | null;
  remainingRegularWork: Uint8Array | null;
  actualOvertimeWork: Uint8Array | null;
  actualIrregularWork: Uint8Array | null;
}

/** `true` zodra minstens één van de vier categorieën daadwerkelijk data draagt — het corpus-
 *  telcriterium voor acceptatiepunt 5 (zie `check-mpp-import.ts`'s Z3-corpussectie) en een
 *  handige eerste vraag vóór Z4 de duurdere byte-decodering aanroept. */
export function hasAnyTimephasedData(raw: AssignmentTimephasedRaw): boolean {
  return raw.actualRegularWork !== null || raw.remainingRegularWork !== null
    || raw.actualOvertimeWork !== null || raw.actualIrregularWork !== null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Z4 — splitsegmenten afleiden (zie de "── Z4 ──"-paragraaf in de moduleheader voor de meetstap,
// het algoritme-ontwerp en de aggregatieregel — dit blok is uitsluitend de implementatie).
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Verschuift een periodelijst met een constant aantal WERKminuten (Z4-fixronde, punt 2+3 — zie de
 * moduleheader se "TAAK-AS, NIET TOEWIJZINGS-AS"-paragraaf). PUUR: verschuift uitsluitend
 * `elapsedWorkMinutesStart`/`End` (de velden die `deriveSplitGapsFromPeriods` daadwerkelijk
 * gebruikt); `workMinutes`/`approxStart`/`approxFinish` blijven ONGEWIJZIGD (de laatste twee zijn
 * toch al een BENADERING vanaf een ander ankerpunt, zie de decoders hierboven — deze functie voegt
 * daar geen nieuwe garantie aan toe). `shiftMinutes === 0` ⇒ dezelfde array-referentie terug (geen
 * onnodige kopie — het overgrote deel van de toewijzingen heeft geen assignment-start-offset).
 */
export function shiftPeriods(periods: readonly TimephasedWorkPeriod[], shiftMinutes: number): readonly TimephasedWorkPeriod[] {
  if (shiftMinutes === 0) return periods;
  return periods.map((p) => ({
    ...p,
    elapsedWorkMinutesStart: p.elapsedWorkMinutesStart + shiftMinutes,
    elapsedWorkMinutesEnd: p.elapsedWorkMinutesEnd + shiftMinutes,
  }));
}

/**
 * Leidt de `TaskSplitGap[]` van ÉÉN toewijzing af uit haar WERKminuten-periodes (typisch de
 * concatenatie van `decodeRegularTimephasedWork`(actual) + `decodePlannedRegularTimephasedWork`
 * (remaining) voor diezelfde toewijzing — zie moduleheader voor de scope-begrenzing). Puur, geen
 * bestandstoegang, geen kalender — precies wat Z4 als "pure afleidingsfunctie" vraagt
 * (acceptatiepunt 1).
 *
 * Algoritme (moduleheader): filter periodes MET werk (`workMinutes !== 0`), sorteer op
 * `elapsedWorkMinutesStart`, en meld voor elk opeenvolgend paar een gat wanneer er een STRIKTE
 * discontinuïteit is. `periods` hoeft NIET vooraf gesorteerd te zijn (de sort hieronder is
 * defensief — de aanroeper concateneert doorgaans twee al-gesorteerde bronnen, maar deze functie
 * mag daar niet blindelings op vertrouwen).
 *
 * AS-CONTRACT VOOR CONSUMENTEN (Z7-fixronde-H1, gemeld ná een reviewbevinding tegen `CPMSolver.ts`):
 * de teruggegeven `TaskSplitGap.afterMinutes`/`gapMinutes` staan op `elapsedWorkMinutesStart/End`s
 * EIGEN as — CUMULATIEF, dus een gat telt zelf ook mee in de positie van een VOLGEND gat (zie
 * `TimephasedWorkPeriod`s docblock hierboven: een periode zonder werk draagt tóch verstreken
 * werkminuten). Voor een taak met ≥2 gaten is `afterMinutes` van het tweede gat dus GEEN "zuivere
 * werktijd sinds taakstart" meer. Consumenten (`src/engine/scheduler/duration.ts`'s
 * `splitTotalSpanMinutes`) moeten deze as daarom WANDELEN i.p.v. tegen een vast `[0, duur)`-venster
 * te klemmen — een eerdere consumentversie deed dat wél en trunceerde legitieme gaten (`mpp14
 * timephased.mpp`'s "Task 5 - 24 Hour": `{afterMinutes:1440, gapMinutes:5760}` werd afgekapt).
 * Deze module zelf blijft ONGEWIJZIGD (de as-interpretatie hoort bij de consument, niet bij de
 * decoder/afleiding hier — "kleinste-oppervlak"-keuze, zie `CPMSolver.ts`/`duration.ts`'s Z7-
 * fixronde-commentaar voor de volledige motivering).
 */
export function deriveSplitGapsFromPeriods(periods: readonly TimephasedWorkPeriod[]): TaskSplitGap[] {
  // NUL-WERK-DETECTIE (mutatiebewijs `check-mpp-import.ts`'s Z4-sectie, punt 3): alleen periodes
  // MET werk blijven over. Een periode met `workMinutes === 0` draagt geen extra informatie t.o.v.
  // het GAT tussen haar buren — ze zelf overbrugt juist de discontinuïteit die anders zichtbaar zou
  // zijn, dus laat deze filter weg en elk gat verdwijnt (de nul-periode "vult" de naad op).
  const worked = periods
    .filter((p) => p.workMinutes !== 0)
    .slice()
    .sort((a, b) => a.elapsedWorkMinutesStart - b.elapsedWorkMinutesStart);

  const gaps: TaskSplitGap[] = [];
  for (let i = 1; i < worked.length; i++) {
    const prevEnd = worked[i - 1].elapsedWorkMinutesEnd;
    const nextStart = worked[i].elapsedWorkMinutesStart;
    // MERGE-CHECK (mutatiebewijs, punt 4): STRIKT `>` — twee AANGRENZENDE werkperiodes
    // (`nextStart === prevEnd`, bv. de naad tussen een "actual"- en een "remaining"-record die
    // toevallig precies aansluiten) leveren GEEN kandidaat. Vervang dit door `>=` (of onvoorwaardelijk
    // pushen) en elke aangrenzende naad levert een fantoom-`TaskSplitGap` van 0 minuten op.
    if (nextStart > prevEnd) {
      gaps.push({ afterMinutes: prevEnd, gapMinutes: nextStart - prevEnd });
    }
  }
  return gaps;
}

/** Eén interval `[start, end)` — lokale hulpvorm voor de doorsnede hieronder, geen publiek type. */
function intersectGapIntervals(a: readonly TaskSplitGap[], b: readonly TaskSplitGap[]): TaskSplitGap[] {
  const result: TaskSplitGap[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aStart = a[i].afterMinutes;
    const aEnd = aStart + a[i].gapMinutes;
    const bStart = b[j].afterMinutes;
    const bEnd = bStart + b[j].gapMinutes;
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    if (start < end) result.push({ afterMinutes: start, gapMinutes: end - start });
    if (aEnd < bEnd) i++; else j++;
  }
  return result;
}

/**
 * Taakniveau-aggregatie over meerdere toewijzingen van DEZELFDE taak (acceptatiepunt (d)) —
 * DOORSNEDE van de per-toewijzing gat-intervallen, zie moduleheader voor de volledige motivering
 * (MSP's Gantt-balk toont "bezig" zodra één toewijzing werkt; een split hoort alleen te
 * verschijnen waar ALLE toewijzingen tegelijk stilliggen).
 *
 * `gapsByAssignment`: één `TaskSplitGap[]` per toewijzing die DAADWERKELIJK timephased-data droeg
 * (de aanroeper — `mppReader.ts` — sluit toewijzingen zonder enige gedecodeerde periode vooraf uit;
 * een LEGE lijst hier betekent dus "deze toewijzing had wél data, maar nul gaten" en drukt de
 * doorsnede terecht naar leeg, in tegenstelling tot "geen data" dat de toewijzing had moeten
 * uitsluiten — zie moduleheader).
 */
export function deriveTaskSplitGaps(gapsByAssignment: readonly (readonly TaskSplitGap[])[]): TaskSplitGap[] {
  if (gapsByAssignment.length === 0) return [];
  return gapsByAssignment.slice(1).reduce<TaskSplitGap[]>(
    (acc, gaps) => intersectGapIntervals(acc, gaps),
    [...gapsByAssignment[0]],
  );
}
