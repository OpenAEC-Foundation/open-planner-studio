/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * T6-kwaliteitsreview (minor M4) — gedeelde harding-klemmen als BLADMODULE: importeert bewust NIETS
 * uit `mppReader.ts`/`mppCalendars.ts` (patroon `src/state/slices/defaults.ts`: een bladmodule mag
 * nooit terug-importeren uit de modules die HEM importeren, anders ontstaat de cyclus die
 * `verify:cycles` bewaakt). Vóór deze module hielden `mppReader.ts` en `mppCalendars.ts` elk hun
 * EIGEN kopie van `MAX_VAR_TEXT_BYTES` aan (letterlijk dezelfde waarde, met commentaar dat uitlegde
 * waarom een gedeelde import niet kon) — deze module lost dat structureel op: beide importeren nu
 * DEZELFDE constante.
 */

/**
 * I1-stijl klem (T5-kwaliteitsreview) — begrenst het scan-/decodeerwerk van `getUnicodeString`
 * (taaknamen, WBS-tekst, kalendernamen, uitzonderingsnamen, …) tegen een gedeelde, gededupliceerde
 * var-data-offset (zie Var2Data's moduleheader in `mppPrimitives.ts`): meerdere unique-ID's kunnen
 * naar DEZELFDE grote string wijzen, dus zonder bovengrens kost het uitlezen ervan O(werkelijke
 * lengte) PER verwijzing. 64 KiB is ruim boven elke realistische naam/tekst in het corpus (dat blijft
 * ver onder 1 KB), maar begrenst een geprepareerd bestand hard. Zie `mppReader.ts`'s I1-toelichting
 * (`readTasks`) voor de volledige kosten-analyse.
 */
export const MAX_VAR_TEXT_BYTES = 65_536;

/**
 * T3 (fase 3.8, MSP-pariteit) — structurele klem op het aantal werktijd-BANDEN binnen ÉÉN 92-byte
 * kalender-uitzonderingsblok (`AbstractCalendarAndExceptionFactory.processCalendarExceptions`,
 * `readExceptionBands` in `mppCalendars.ts`).
 *
 * LAAG-3-FIX (Opus-review — de vorige versie van dit commentaar rekende de klem verkeerd uit): het
 * ANALYSEERDE alleen de DUUR-array (`+32 + i*4`, past 15× vóór de naam-vardata) en NEGEERDE dat de
 * START-array (`+20 + i*2`, 2-byte-stride) een VEEL knellendere grens is — start-slot `i` staat op
 * `20+2i`, wat exact BOTST met duur-slot 0 (op `+32`) zodra `20+2i>=32`, dus `i>=6`. Structureel
 * passen er dus hoogstens 6 NIET-OVERLAPPENDE periodes (`i=0..5`) vóór start-slot 6 al in duur-slot
 * 0 se bytes leest — gedemonstreerd (reviewer-repro): bij `periodCount=15` (de oude klem) las
 * periode-index 6+ een "fantoomband" uit wat feitelijk duur-/naamlengte-bytes van ANDERE periodes/
 * de naam-vardata waren. Geklemd op 5 (niet de structurele 6-slot-bovengrens): MS Project se eigen
 * UI staat de gebruiker hooguit 5 werktijdperiodes per uitzondering toe (dezelfde autoritatieve
 * grens als `MAX_DAY_HOUR_PERIODS`'s eigen toelichting citeert voor het 60-byte-dagblok) — 5 is dus
 * zowel de STRUCTURELE (5<6, geen overlap-risico) als de PRODUCT-grens, en dus de motiveerbaarste
 * keuze. (`MAX_DAY_HOUR_PERIODS` in `mppCalendars.ts` droeg dezelfde start/duur-overlapfout — dat
 * was PRE-EXISTING buiten deze taak se scope, gemeld voor een latere T-taak, en is bij die latere
 * T16-veeglijst-fix met exact dezelfde `i>=6`-analyse gecorrigeerd naar 5.)
 * Een ongeklemde `periodCount` (SHORT, 0..65535) zou zonder deze klem tot 65535 iteraties per
 * uitzondering kunnen forceren; bij `MAX_CALENDAR_EXCEPTIONS` (2000) uitzonderingen per kalender is
 * dat tot 131 miljoen ongebruikte lus-iteraties (elke iteratie ná i=5 leest al buiten de bedoelde
 * band-slots en zou — vóór deze fix — een fantoomband kunnen opleveren, ná deze fix simpelweg niet
 * meer bereikt worden).
 */
export const MAX_EXCEPTION_BAND_PERIODS = 5;

/**
 * T9 (Opus-review N3, MSP-pariteit) — klem op de RAUWE `REMAINING_DURATION` (fixed-offset 52, INT32,
 * tienden-van-een-minuut — zelfde vorm als `SCHEDULED_DURATION`, zie `fieldMap14.ts`), vóór hij in
 * `mppReader.ts` naar `time.remainingMinutes`/`time.remainingTime` omgerekend wordt en van daaruit in
 * datum-arithmetiek (`CalendarEngine.addWorkMinutes`/`addWorkDaysChecked`, `duration.ts`'s
 * `addElapsedMinutes`) terechtkomt.
 *
 * MEETCOMMENTAAR: het veld is een SIGNED INT32 — structureel al begrensd tot ±2.147.483.647 tienden
 * (≈ ±408 jaar), dus een hostile bestand kan hier nooit een echte overflow forceren. Zonder EIGEN
 * klem zou het corpuscoderingspad niettemin tot ~400 jaar aan (elapsed-)minuten kunnen doorrekenen
 * vóórdat `CalendarEngine`s eigen `MAX_DAYS`/`MAX_MINUTES` (200.000 dagen, ~547 jaar) of
 * `duration.ts`s `MAX_ELAPSED_MINUTES` alsnog capt — die dieper liggende klemmen VANGEN het geval
 * altijd (geen crash-risico), maar precies zoals `MAX_EXCEPTION_BAND_PERIODS`/`MAX_VAR_TEXT_BYTES`
 * hierboven hoort een uit het bestand gelezen getal een EIGEN, hier gedocumenteerde bovengrens te
 * dragen i.p.v. stil te vertrouwen op een klem die toevallig verderop in de keten ook bestaat. 100
 * jaar (`100 × 365,25 × 24 × 60 × 10 ≈ 525.960.000` tienden) is ruim boven elke realistische
 * restduur van een bouwproject (het corpus se langste gemeten taakduur ligt in de orde van maanden),
 * en blijft ruim binnen het structurele INT32-bereik.
 *
 * PRE-EXISTING, BEWUST ONGEWIJZIGD (buiten T9-scope): `SCHEDULED_DURATION`s rauwe `durationRaw` in
 * `mppReader.ts` draagt DEZELFDE klem-leemte (geen eigen bovengrens, alleen de dieper liggende
 * `CalendarEngine`/`duration.ts`-klemmen) — dit bestand voegt hier alleen de klem voor het NIEUWE
 * `remainingDurationRaw`-veld toe; `durationRaw` zelf blijft ongemoeid (gemeld voor een latere taak,
 * zelfde conventie als `MAX_EXCEPTION_BAND_PERIODS`'s PRE-EXISTING-notitie hierboven — `durationRaw`
 * is zelf géén overlapfout, alleen een klem-leemte, dus die T16-veeglijst-fix raakte hem niet).
 */
export const MAX_REMAINING_DURATION_TENTHS = 525_960_000;

/** Klemt een rauwe `REMAINING_DURATION`-waarde (tienden-van-een-minuut, mogelijk negatief bij een
 *  kapot/hostile bestand) naar `[0, MAX_REMAINING_DURATION_TENTHS]` — zie de toelichting hierboven.
 *  Een negatieve restduur is nooit zinvol (spiegelt de bestaande `Math.max(0, …)`-klem op
 *  `remaining` in `CPMSolver.ts`), dus deze functie klemt ook de ondergrens op 0, niet alleen de
 *  bovengrens. */
export function clampRemainingDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_REMAINING_DURATION_TENTHS);
}

/**
 * Z2 (etappe "nul afwijkingen") — klem op de RAUWE `MANUAL_DURATION` (Fixed2Data blok 1, offset
 * 58, INT32, tienden-van-een-minuut — zelfde vorm als `SCHEDULED_DURATION`/`REMAINING_DURATION`,
 * zie `fieldMap14.ts`'s `TaskFieldId.ManualDuration`). Deze taak doet zelf NOG GEEN
 * datum-arithmetiek met dit veld (het wordt uitsluitend gelezen en op `RawTaskScan` opgeslagen,
 * zie `mppReader.ts`'s Z2-sectie) — de klem staat er toch al bij het lezen, zodat een latere
 * consument (Z9a, handmatig-plannen-toepassing) nooit een ongeklemde waarde overneemt en de
 * hardingsdiscipline niet per-veld opnieuw hoeft te worden uitgevonden.
 *
 * MEETCOMMENTAAR: zelfde redenering als `MAX_REMAINING_DURATION_TENTHS` hierboven — het veld is
 * een SIGNED INT32 (structureel al begrensd tot ±2.147.483.647 tienden, ≈ ±408 jaar), dus geen
 * hostile-overflow-risico, maar wél een eigen, gedocumenteerde bovengrens i.p.v. stil op een
 * dieper liggende klem te vertrouwen. Dezelfde 100-jaargrens (`100 × 365,25 × 24 × 60 × 10 ≈
 * 525.960.000` tienden) — een handmatig geplande taak se eigen duur ligt in de praktijk in
 * dezelfde orde van grootte als elke andere taakduur in het corpus (dagen tot maanden), dus er is
 * geen aanleiding voor een andere bovengrens dan haar `REMAINING_DURATION`-buurveld.
 */
export const MAX_MANUAL_DURATION_TENTHS = 525_960_000;

/** Klemt een rauwe `MANUAL_DURATION`-waarde (tienden-van-een-minuut, mogelijk negatief bij een
 *  kapot/hostile bestand) naar `[0, MAX_MANUAL_DURATION_TENTHS]` — zie de toelichting hierboven.
 *  Spiegelt `clampRemainingDurationTenths` exact (eigen naam/constante i.p.v. hergebruik, want de
 *  twee velden zijn semantisch onafhankelijk — een gedeelde klem zou een toekomstige, voor één van
 *  de twee velden andere bovengrens onnodig aan de andere opdringen). */
export function clampManualDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_MANUAL_DURATION_TENTHS);
}

/**
 * Z5 (etappe "nul afwijkingen") — klem op de RAUWE `LEVELING_DELAY` (FixedData blok 0, offset 58,
 * veld-id 20, INT32, tienden-van-een-minuut — zelfde vorm/klem-precedent als
 * `REMAINING_DURATION`/`MANUAL_DURATION` hierboven, zie `fieldMap14.ts`'s `TaskFieldId.LevelingDelay`).
 * T12/Z2 lazen dit veld al RUW (alleen de `≠0`-detectie was relevant); Z5 maakt er een ECHTE duur
 * van (`Task.levelingDelayMinutes`) — vanaf hier komt het getal dus voor het eerst in
 * arithmetiek/opslag terecht, en verdient het dezelfde eigen bovengrens als haar twee buurvelden
 * i.p.v. stil op een dieper liggende klem te vertrouwen.
 *
 * MEETCOMMENTAAR: zelfde redenering als `MAX_REMAINING_DURATION_TENTHS`/`MAX_MANUAL_DURATION_TENTHS`
 * hierboven — het veld is een SIGNED INT32 (structureel al begrensd tot ±2.147.483.647 tienden,
 * ≈ ±408 jaar), dus geen hostile-overflow-risico, maar wél een eigen, gedocumenteerde bovengrens.
 * Een leveling-vertraging in de praktijk is een schuif van hooguit enkele weken tot maanden (het
 * corpus se twee zuivere leveling-bestanden, zie het nul-afwijkingen-plan bij Z6, meten in de orde
 * van uren tot dagen) — ruim binnen dezelfde 100-jaargrens (`100 × 365,25 × 24 × 60 × 10 ≈
 * 525.960.000` tienden) als haar buurvelden; een aparte, kleinere grens zou geen aantoonbaar
 * corpusvoordeel geven en breekt de gedeelde-motivering-consistentie tussen de drie duurvelden.
 * Net als `MANUAL_DURATION` klemt dit ook de ondergrens op 0 — de bestaande consumenten (`Resource
 * Leveler.ts`, `CPMSolver.ts`) behandelen een leveling delay altijd als niet-negatief
 * (`delay > 0 ? delay : undefined`), dus een negatieve rauwe waarde (kapot/hostile bestand) hoort
 * hier al op 0 te landen, niet pas bij een latere consument.
 */
export const MAX_LEVELING_DELAY_TENTHS = 525_960_000;

/** Klemt een rauwe `LEVELING_DELAY`-waarde (tienden-van-een-minuut, mogelijk negatief bij een
 *  kapot/hostile bestand) naar `[0, MAX_LEVELING_DELAY_TENTHS]` — zie de toelichting hierboven.
 *  Spiegelt `clampRemainingDurationTenths`/`clampManualDurationTenths` exact (eigen naam/constante
 *  i.p.v. hergebruik — drie semantisch onafhankelijke velden). */
export function clampLevelingDelayTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_LEVELING_DELAY_TENTHS);
}

/**
 * Z3 (etappe "nul afwijkingen") — klem op het aantal RECORDS in één timephased-blok (`Var2Data`
 * van `TBkndAssn`, zie `mppTimephased.ts`'s moduleheader voor de blokindeling). Het header-veld
 * dat dit aantal claimt is een ONGEVALIDEERDE bestandswaarde (SHORT, 0..65535); `mppTimephased.ts`
 * klemt 'm EERST STRUCTUREEL (tegen wat de daadwerkelijke bloklengte kan dragen — spiegelt
 * `FixedMeta`/`VarMeta12`'s `adjustedItemCount`-patroon, zie `mppPrimitives.ts`), en DAARNA tegen
 * deze absolute bovengrens.
 *
 * MEETCOMMENTAAR: waarom een tweede, absolute klem nodig is bovenop de structurele — anders dan
 * `FixedMeta`/`VarMeta12` (die tegen een storage-item van vaste grootte lezen) is `Var2Data` een
 * ONGEBEGRENSDE variabele-lengte-byte-array (geen `MAX_VAR_TEXT_BYTES`-achtige klem bestaat daar
 * al voor, zie `Var2Data.getByteArray` in `mppPrimitives.ts`): een geprepareerd bestand kan een
 * timephased-var-data-entry van tientallen MB's claimen, en de STRUCTURELE klem alleen zou zo'n
 * buffer volledig laten decoderen (elke record een `Date`-allocatie + array-push).
 *
 * Deze klem geldt UITSLUITEND voor de TWEE categorieën die via `decodeRegularTimephasedWork`
 * gaan — `ActualRegularWork` en `ActualOvertimeWork` (Format A, 20-byte records, zie
 * `mppTimephased.ts`'s moduleheader). `RemainingRegularWork` (Format B, 28-byte) heeft haar EIGEN
 * klem (`MAX_TIMEPHASED_PLANNED_RECORDS` hieronder) — de twee categorieën hebben een verschillende
 * structurele afleiding en dus ook verschillende gemeten pieken; ze in één klem/meetcommentaar
 * vermengen (zoals een eerdere versie hier deed) suggereert een gedeeld formaat dat niet bestaat.
 *
 * MEETCOMMENTAAR (`check-mpp-import.ts`'s Z3-corpustelling, 216 leesbare bestanden over `voor
 * claude/test bestanden voor file implementation` + `voor claude/testdata-crawl`, ná de Z3-
 * fixronde-F1-fix): `ActualRegularWork` — 369 toewijzingen dragen deze categorie, langst
 * waargenomen blok 136 bytes (3 periodes). `ActualOvertimeWork` — 36 toewijzingen, langst
 * waargenomen blok eveneens 136 bytes (4 periodes). 20.000 records (bij 20 bytes/record ≈ 390 KB,
 * bovenop de 16-byte header) is dus ruim boven de gemeten corpus-piek (136 bytes ≈ 6 periodes) —
 * bewust veel hoger dan wat het corpus laat zien (een klem die precies op de gemeten waarde zit,
 * zou een legitiem groter/fijnmaziger project onnodig afknijpen), maar begrenst een hostile
 * bestand nog altijd hard op een paar honderd microseconden werk i.p.v. een onbegrensde
 * decodeerlus.
 */
export const MAX_TIMEPHASED_REGULAR_RECORDS = 20_000;

/** Klemt een rauwe regelmatige-timephased-recordcount (header-SHORT, al voor-geklemd tegen de
 *  structurele bloklengte door de aanroeper) naar `[0, MAX_TIMEPHASED_REGULAR_RECORDS]`. */
export function clampTimephasedRegularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_REGULAR_RECORDS);
}

/**
 * Z3 — zelfde redenering als `MAX_TIMEPHASED_REGULAR_RECORDS` hierboven, voor het IRREGULAR-blok
 * (8-byte records i.p.v. 20-byte — zie `mppTimephased.ts`). MEETCOMMENTAAR: irregular-records zijn
 * in dit corpus zeldzaam (ze bestaan alleen voor werk buiten standaard werktijd) — corpusbreed
 * gemeten (dezelfde 216-bestand-run als hierboven): 4 toewijzingen dragen `ActualIrregularWork`,
 * hoogstens 1 record per toewijzing (24 bytes). 5.000 records (8 bytes/record ≈ 40 KB) is ruim
 * boven elke realistische hoeveelheid, met dezelfde structurele-klem-eerst-discipline als
 * hierboven.
 */
export const MAX_TIMEPHASED_IRREGULAR_RECORDS = 5_000;

/**
 * Z3-fixronde (F1/F4) — het REMAINING_REGULAR_WORK-blok (`RAW_TIMEPHASED_REMAINING_REGULAR_WORK`,
 * var-data-sleutel 49) volgt een ANDER byteformaat dan de andere drie timephased-categorieën
 * (28-byte records i.p.v. 20, `getPlannedWork`-model — zie `mppTimephased.ts`'s moduleheader).
 * Eigen klem omdat zowel de structurele afleiding (recordgrootte 28, niet 20) als de gemeten
 * corpuswaarden afwijken van `MAX_TIMEPHASED_REGULAR_RECORDS` hierboven.
 *
 * MEETCOMMENTAAR (dezelfde 216-bestand-run, ná de F1-fix): 3298 toewijzingen dragen deze
 * categorie (verreweg de meest voorkomende van de vier — meer dan de andere drie samen), waarvan
 * 3218 met `blockCount === 0` (het samenvattende-1-record-geval — zie moduleheader) en 3262 in
 * totaal structureel op dit 28-byte-model passen (blockCount===0 of een geheel aantal 28-byte-
 * blokken). Het langst waargenomen blok met échte periode-data droeg 352 bytes = 16 (header) +
 * 12×28 (12 fysieke 28-byte-blokken: 1 summary-blok + 11 periode-blokken, dus header-`blockCount`
 * = 11). 20.000 records (28 bytes/record ≈ 560 KB) is dus ruim boven de gemeten corpus-piek, met
 * dezelfde structurele-klem-eerst-discipline als hierboven.
 */
export const MAX_TIMEPHASED_PLANNED_RECORDS = 20_000;

/** Klemt een rauwe planned/remaining-timephased-blockcount — spiegelt
 *  `clampTimephasedRegularRecordCount` exact, eigen constante omdat de drie klemmen onafhankelijke,
 *  niet per se gelijke bovengrenzen kunnen krijgen. */
export function clampTimephasedPlannedRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_PLANNED_RECORDS);
}

/** Klemt een rauwe irregular-timephased-recordcount — spiegelt
 *  `clampTimephasedRegularRecordCount` exact, eigen constante omdat de blokken onafhankelijke,
 *  niet per se gelijke bovengrenzen kunnen krijgen. */
export function clampTimephasedIrregularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_IRREGULAR_RECORDS);
}
