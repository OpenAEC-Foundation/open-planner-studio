# .mpp-import zonder uitzonderingscategorie — Implementatieplan (fase 3.8, etappe "nul afwijkingen")

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (aanbevolen) of `superpowers:executing-plans`. Stappen gebruiken checkbox-syntax.
> **Regelnummers in dit plan zijn indicatief — verifieer altijd op INHOUD (grep op de genoemde symboolnaam), nooit op regelnummer.** Dat geldt óók voor de regelnummers in de twee verkenningsrapporten waar dit plan op leunt.
> Opgesteld door de architect-agent (Opus) 2026-08-17, als vervolg op `docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md` (etappe "MSP-pariteit").

---

## 1. Doel en eindmeetlat

**Doel (letterlijk de meetlat van de etappe).** De `.mpp`-import is volledig datumgetrouw aan MS Project, **zonder uitzonderingscategorie**: over het volledige corpus in `voor claude` heeft na import + herberekening (`readMPP` + `solveProject`/`runCPM`) élk leesbaar bestand **exact 0 start- en 0 einddatum-afwijkingen én 0 zelfde-dag-afwijkingen**. De gepinde fidelity-baseline bestaat uitsluitend uit nullen op alle diff- en sameday-tellers, **zonder één `reason`-pin**.

### 1.1 De eindmeetlat, machinaal

`tests/planning/mpp-fidelity-baseline.json` bevat na deze etappe voor élk gepind bestand:

```
tasks === startExact === finishExact
startDiff === 0   startSameday === 0
finishDiff === 0  finishSameday === 0
geen "reason"-sleutel aanwezig
```

en globaal: de verzameling bestanden met ≥1 afwijking is **leeg** in beide wortels (`corpus`, `crawl`).

Dat wordt een **harde poort in de code**, niet alleen een gemeten toestand — zie Z20 (`GOAL_ZERO_DEVIATIONS`). Zolang die poort aan staat is "stilzwijgend versoepelen" onmogelijk: een teruggezette `reason`-pin of een niet-nul-teller maakt de suite rood, ook als de baseline zelf netjes bijgewerkt zou zijn.

### 1.2 Uitgangspositie (gemeten, eindstand vorige etappe — `mpp-fidelity-baseline.json`)

| meting | waarde |
|---|---|
| leesbare bestanden / taken | 216 / 3413 |
| bestanden 100% exact | 196/216 (90,7%) |
| bestanden met ≥1 afwijking | 20 — alle 20 `reason`-gepind |
| startDiff + finishDiff (som) | **193** (70 + 123) |
| startSameday / finishSameday | **2 / 5** |

Verdeling van die 20 bestanden over de werkstromen van deze etappe (verkenningsrapport `rapport-restdossiers-mpxj.md`, deel A2 — met script nagerekend, sluit exact op 193):

| werkstroom | bestanden | startDiff | finishDiff | sameday (s/f) |
|---|---|---|---|---|
| (1) splitsen | 1 | 0 | 2 | 0/0 |
| (2) leveling delay | 2 zuiver + 1 gemengd | 15 + 29 | 19 + 41 | 0/0 + 2/1 |
| (3) timephased/contouring | 11 | 5 | 31 | 0/4 |
| (4) handmatig gepland | 1 taak binnen het gemengde bestand | — | — | (in bovenstaande) |
| (5) vier §T15-restdossiers | 5 | 21 | 30 | 0/0 |
| onbekend/overig | **0** | — | — | — |

Geen restcategorie: elk van de 193 afwijkingen en elk van de 7 sameday-gevallen is aan een werkstroom toegewezen. Dat is de reden dat "nul" deze etappe een verantwoorde ambitie is en geen wens.

### 1.3 Wat er gebouwd wordt

1. **Taak-splitsen als volwaardige feature** — splitsegmenten uit het `.mpp`-bestand gelezen (afgeleid uit timephased werk, want MSP kent géén taakeigen splits-veld), IFC-round-trip via het documentcontract, CPM rekent restwerk per segment zoals MS Project, onderbroken balken in de Gantt (en in print/PDF).
2. **Leveling delay** gelezen, gedecodeerd tot een echte duur, en meegerekend in de forward pass.
3. **Timephased/gecontourde toewijzingen** gelezen; hun venster bepaalt de taakdatums.
4. **Handmatig geplande taken** herkend (TASK_MODE-bit uit `Fixed2Meta`; eigen START/FINISH-veldpaar 1283/1284 uit `Fixed2Data` block 1) en volgens MSP's manual-scheduling-semantiek gepland, inclusief doorwerking naar opvolgers.
5. **De vier restdossiers opgelost met bewijs:** START_FINISH-semantiek, kruis-kalender-FS-asymmetrie, out-of-sequence-actuals (retained logic), rauw anker zonder constraint.

Daarnaast: de openings-melding blijft bestaan als **informatieve mededeling** ("dit bestand bevat N onderbroken/genivelleerde/gecontoureerde taken") maar is geen excuus meer voor afwijkende datums — de tekst wordt herschreven; en de in-app-gidsen (nl+en) beschrijven aantoonbaar het werkelijke gedrag, met elke planningsclaim tegen code of test geverifieerd.

### 1.4 Niet in scope

- `.mpp`-**export**, MPP8/9/12, wachtwoordbestanden.
- Resource-leveling als **algoritme** (zelf nivelleren): wij lézen MSP's uitkomst (`levelingDelay`) en passen 'm toe. `ResourceLeveler.ts` blijft ongemoeid. (ProjectLibre doet het net zo — het berekent zelf geen leveling, zie §9.)
- Splitsen/handmatig plannen als **bewerk**functie (slepen om te splitsen, split-handles in de Gantt). Deze etappe levert lezen + rekenen + tekenen + round-trip; de bewerk-UI is een aparte etappe. Uitzondering: wat het documentcontract/IFC nodig heeft om de data niet te verliezen, wordt wél gebouwd.
- Herstructurering van `TaskTime` buiten de velden die deze etappe toevoegt.

---

## 2. Randvoorwaarden die élke taak bindt

**Corpus & privacy.**
- Corpusbestanden (`voor claude`) komen **nooit** in de repo — geen bytes, geen fragmenten, geen taaknamen, geen datums.
- Bedrijfsbestandsnamen komen nooit in code, commitberichten, testcommentaren of foutmeldingen: **hash-only** (eerste 16 hex van SHA-256 van de bytes). Publieke crawl-namen (MPXJ-junit, OzBuild-workshop) mogen wél leesbaar.
- Bij **elke** nieuwe lees- of motorfeature hoort een **synthetische, corpusloze fixture** naast de corpuspin. Dat is hier geen vrome wens: `tests/planning/mppFixtures.ts` bevat al een volledige CFB/MPP-bouwer (`buildNestedCfb`, `writeCfbHeader`, `encodeCompObjFileFormat`, de Props-encoder) waarmee een synthetisch MPP14-bestand mét `TBkndTask/Fixed2Meta`, `TBkndTask/Fixed2Data` en `TBkndAssn/Var2Data` te bouwen is. Elke byte-lezer in deze etappe wordt daarmee corpusloos mutatie-bewezen.
- CI heeft geen corpus; het skip-gedrag bestaat al (`OPS_MPP_CORPUS`/`OPS_MPP_CRAWL` afwezig ⇒ OK-skipregel, exit 0). Niets in deze etappe mag dat veranderen.

**Licenties en herkomst.** Zie §9 — kort: MPXJ (LGPL-2.1) en ProjectLibre/OpenProj (CPAL 1.0) worden **uitsluitend gelezen om te begrijpen**, onafhankelijk geherimplementeerd, met herkomstvermelding in het commentaar volgens het bestaande patroon in `mppReader.ts`. Nooit code overnemen. **Corpus-datums zijn het orakel boven elke referentie.**

**Poorten.** `npm run verify` is dé poort, **exitcode leidend** (de suite print "alles groen" ook bij exit 1). Na élke motorwijziging draait de planningssuite. Alle fidelity-pins zijn exacte `===`-pins; nooit `>=`, nooit een som.

**Documentcontract.** Nieuwe projectdata (splitsegmenten, leveling delay, timephased-venster, manual-vlag en -datums) leeft op de taak en moet round-trippen door IFC (`OPS_`-pset-patroon), een documentwissel, undo/redo en crashherstel overleven. `tests/planning/check-document-contract.ts` en `check-ifc-roundtrip.ts` zijn de wachters.

**Werkwijze per taak.** Verse Sonnet-implementer → review (Opus voor motor-/byte-/kwaliteitswerk, Sonnet voor mechanische spec-checks) → fixronde via `resume` op dezelfde implementer → her-check door dezelfde reviewer. **Reviewers draaien de mutatiebewijzen zélf** — een beschreven mutatie telt niet. De hardening-checklist (§8) hoort ONGEWIJZIGD in élke implementer-prompt.

---

## 3. Volgorde-redenering (lees dit vóór het takenschema)

Vier dwingende ordeningen; de rest is vrij parallel.

**(a) De meetlat eerst — anders bouwt werkstroom 4 tegen een foute meting.**
`tests/planning/mppGroundTruth.ts` leest vandaag uitsluitend `SCHEDULED_START`/`SCHEDULED_FINISH` (veld 35/36). Voor een **MANUALLY_SCHEDULED**-taak is dat het verkeerde veldpaar: MSP ankert die op `START`/`FINISH` (1283/1284) en `MPP14Reader` overschrijft `START` met `SCHEDULED_START` alléén als `START` leeg is óf de taak AUTO_SCHEDULED is. Meten we straks manual-taken tegen 35/36 terwijl de lezer 1283/1284 gebruikt, dan vergelijkt de fidelity-check twee verschillende MSP-velden in plaats van "onze berekening vs. MSP's eigen antwoord" — vals-groen of vals-rood, allebei fataal voor een "nul afwijkingen"-goal. **Z1 gaat dus vóór Z9a**, en `mppGroundTruth.ts` blijft exclusief eigendom van baan M.
> Verwacht neveneffect, expliciet ingecalculeerd: Z1 kan bestanden die vandaag 100% exact zijn tijdelijk laten afwijken (de grondwaarheid verschuift voor manual-taken, onze berekening nog niet). Dat is geen regressie maar **ontmaskering** — het wordt gepind mét `reason`, en die pin verdwijnt weer bij Z9a. Dit is het enige moment in de etappe waarop een nieuwe `reason`-pin toegestaan is.

**(b) Lezer-infrastructuur als gedeelde onderbouw vóór de features.**
Twee gaten in onze lezer blokkeren drie van de vijf werkstromen tegelijk:
- `fieldMap14.ts`'s `parseFieldMapBytes` registreert **alleen block 0** (`FixedData`); block ≥1 (`Fixed2Data`) wordt bewust overgeslagen. En `mppReader.ts`'s `readTasks` opent van `TBkndTask` alleen `FixedMeta`/`FixedData`/`VarMeta` — nooit `Fixed2Meta`/`Fixed2Data`. Zonder die twee is TASK_MODE noch het manual-START/FINISH-paar leesbaar (**Z2**).
- `mppEntities.ts`'s `readAssignmentsUnsafe` opent voor `TBkndAssn` alleen `FixedMeta`/`FixedData`/`VarMeta` — **`Var2Data` wordt nooit geopend**, en daar leeft álle timephased data (**Z3**).

**(c) Splits worden uit timephased werk afgeleid — dat dicteert de keten.**
MPXJ heeft geen taakeigen splits-veld: `Task.WORK_SPLITS` is een *berekend* veld dat via `ResourceAssignment.getWorkSplits()` uit de timephased actual- en remaining-werksegmenten komt (segment met `totalAmount == 0` = gat; aangrenzende werksegmenten worden gemerged). Dus: **Z3 (timephased-decoder) → Z4 (splits afleiden) → Z7 (splits in de CPM) → Z15 (onderbroken balken)**. Werkstroom 3 (timephased-venster bepaalt datums, **Z8**) tapt uit exact dezelfde decoder — vandaar één gedeelde onderbouw en niet twee.

**(d) Handmatig plannen raakt de motor structureel — dus gefaseerd.**
Een manual task is geen constraint-variant maar een **tweede planningsmodus**: haar datums komen rauw uit het bestand (geen kalendersnap, geen relatiedruk, geen constraint-afdwinging) terwijl haar opvolgers er wél normaal vanaf rekenen. Dat raakt de forward pass, de backward pass, de float-berekening, de driving/kritiek-pad-markering en de rollup van samenvattingstaken. Fasering: **Z9a** = pin + doorwerking (de taak zelf en haar opvolgers kloppen), **Z9b** = de randen (float, kritiek pad, rollup, backward pass) met eigen cases. Beide achter Z1 (meetlat) en Z2 (leesbaarheid).

**Puur solver-werk, corpusloos bewijsbaar, mag meteen parallel:** Z10 (START_FINISH), Z11 (kruis-kalender-FS), Z12 (out-of-sequence). Die drie hebben geen enkele leesfeature nodig — ze hebben elk een publiek crawl-bestand als corpusbewijs én een synthetische case als draagbaar bewijs. **Z13** (rauw anker zonder constraint) wacht wél: het is dezelfde symptoomfamilie als het TASK_MODE-dossier, en Z9a's meting bepaalt of er ná Z9a nog iets van over is.

**Vroeg en serieel: het typecontract.** `src/types/task.ts` draagt een compile-afgedwongen rol-partitie van `TaskTime` (`TaskTimeInput`/`Computed`/`Analysis`/`Tracking` + `_assertTaskTimeComplete`/`_assertTaskTimeDisjoint`). Een nieuw `TaskTime`-veld dat niet in een rol staat geeft een **compile-fout**. Dat is precies wat we willen — maar het maakt het bestand ook een merge-magneet voor drie banen tegelijk. Daarom **Z0**: één korte, seriële voorloper die álle nieuwe velden landt (optioneel, nog ongebruikt) plus de testharness-uitbreiding, gecommit vóórdat de banen splitsen.

---

## 4. Takenlijst

Per taak: **doel → bestanden → mutatie-bewijsbare acceptatie → afhankelijkheden → risico**.
**Vaste poort per taak:** `npm run typecheck` groen + `npm test` (exitcode is de poort, nooit de tail) + de eigen acceptatie. Elke taak eindigt met een commit die de **gemeten voor→na-cijfers** uit het fidelity-harnas draagt (bestanden 100% exact, startDiff/finishDiff/sameday-som, aantal verbeterd/verslechterd).

---

### SERIEEL VOORAF

#### Z0 — Typecontract + testharness landen (klein, snel, blokkeert alles)

**Doel.** Alle nieuwe datavelden bestaan als type vóórdat drie banen ze tegelijk nodig hebben, en de JSON-caseharness kan ze doorgeven. Nog geen enkel gedrag.

**Bestanden.**
- `src/types/task.ts` — nieuwe velden (zie ontwerp); als er iets op `TaskTime` landt óók de rol-toewijzing, want `_assertTaskTimeComplete`/`_assertTaskTimeDisjoint` geven anders een compile-fout.
- `src/types/resource.ts` — het timephased-venster op `ResourceAssignment` (nu: `id, taskId, resourceId, unitsPerDay, curve?`).
- `tests/planning/harness.ts` — de JSON-case-interpreter kan de nieuwe taakvelden zetten. **Les uit de vorige etappe (T2/T13):** `buildAndSolve` bouwt het `addTask`-argument met een expliciete veld-voor-veld-spread; een JSON-sleutel die daar niet in staat wordt **stilzwijgend genegeerd** en de case draait groen tegen het defaultgedrag. Er is bovendien géén `TASK_KEYS`-allowlist (wel `CASE_KEYS`/`EXPECT_KEYS`/`TASK_EXPECT_KEYS`), dus een typefout in een casusveld valt ook stil weg. **Voeg daarom in deze taak `TASK_KEYS satisfies Record<keyof Case['tasks'][number], true>` toe aan `validateCaseKeys`** — dan kan dit een derde keer niet gebeuren.
- `tests/planning/check-ifc-roundtrip.ts` — de fixtures `TM` (`satisfies Required<Task> & { time: Required<TaskTime> }`) en `A1` (`Required<ResourceAssignment>`) plus de vergelijkingstabellen `TASK_CANON`/`ASSIGNMENT_CANON` geven **compile-fouten** zodra de velden bestaan. Hier mogen ze nog met `{ skip: '<reden>' }` staan; Z14 maakt er echte round-trip-cellen van (en verwijdert de skip).
- `src/engine/moveProject.ts` — `TASK_VERDICTS` (`satisfies Record<keyof Task, MoveVerdict>`) geeft eveneens een compile-fout. **Let op: die tabel is documentatie-met-tanden** — een `'shift'`-verdict betekent dat je de shift ook echt met de hand moet implementeren.

**Ontwerp (voorgeschreven; één meet-afhankelijke keuze, expliciet gemarkeerd).**

**(1) Splitsen — offset-gebaseerd, op `Task`.**
```ts
/** Eén werkonderbreking in een gesplitste taak (MS Project: "split"). OFFSET-GEBASEERD, niet
 *  absoluut: `afterMinutes` WERKminuten ná de taakstart begint een gat van `gapMinutes`
 *  werkminuten waarin niet gewerkt wordt. */
export interface TaskSplitGap { afterMinutes: number; gapMinutes: number }
```
`Task.splitGaps?: TaskSplitGap[]` — top-level op `Task`, náást het bestaande `levelingDelay`/`isHammock` (zelfde soort veld, zelfde "afwezig ⇒ byte-identiek"-vorm). Drie redenen voor offsets in plaats van absolute datumparen:
- **shift-invariant**: verschuift de taak (herberekening, Project verplaatsen, ander anker), dan verschuiven de gaten vanzelf mee. Absolute segmenten zouden bij elke herberekening verouderen.
- **geen INPUT/COMPUTED-dubbelrol**: de gaten zijn brondata, de absolute segmenten zijn afgeleid (renderer/print leiden ze af uit `earlyStart` + een kalenderwandeling). Dat vermijdt precies de rolambiguïteit die `TaskTime`'s partitie zou blootleggen.
- **`moveProject.ts` wordt triviaal**: verdict `'n/a'` (relatieve offsets, geen datums — zelfde taxonomie als `levelingDelay: 'n/a'`; Z0-reviewbesluit 2026-08-17, het oorspronkelijke `'keep'`-voorschrift week af van de bestaande verdict-definities), aantoonbaar correct in plaats van een handgeschreven shift.

**(2) Handmatig plannen — één boolean, géén nieuw datumpaar.**
`Task.manuallyScheduled?: boolean` (naast `isHammock`). De datums zelf zijn `time.scheduleStart`/`scheduleFinish` — dat zijn per definitie de door de bron gezette datums; `manuallyScheduled` is het signaal dat de solver ze **rauw** moet respecteren in plaats van te herrekenen. **Toets dat expliciet in Z9a:** blijkt uit de meting dat MSP voor manual taken een datumpaar bijhoudt dat níét met `scheduleStart/Finish` samenvalt, escaleer dan met de meting — pas dán komt er een apart veldpaar.
> Let op: `applyCpmResult` overschrijft in uur-modus `scheduleStart`/`scheduleFinish` met de berekende instants. Voor een manual taak is dat per constructie een no-op (de pin ís de opgeslagen waarde) — **assert dat**, laat het geen toevalligheid zijn.

**(3) Leveling delay — het veld BESTAAT AL, alleen te grof.**
`Task.levelingDelay?: number` bestaat, in **hele werkdagen**, wordt in `forwardPass` toegepast als `earlyStart = cal.addWorkingDaysSigned(earlyStart, task.levelingDelay)` (ná dependency/constraint, vóór het voortgangsblok — exact de volgorde die ProjectLibre ook aanhoudt), round-tript al door IFC (`OPS_Leveling`), en wordt door `ResourceLeveler.ts`/`applyLeveling` gezet. MSP levert echter tienden-van-een-minuut, dus sub-dag. **Toevoegen: `Task.levelingDelayMinutes?: number`** volgens het gevestigde `scheduleDuration`/`durationMinutes`-precedent: aanwezig ⇒ bron van waarheid, afwezig ⇒ `levelingDelay` (werkdagen) blijft de bron ⇒ byte-identiek. Plus `Task.levelingDelayElapsed?: boolean` (MSP's `LevelingDelayFormat` kent een elapsed-variant; MSPDI drukt dat uit met een elapsed-vlag op de duur).

**(4) Timephased-venster — op de toewijzing, niet op de taak.**
`ResourceAssignment.workWindowStart?: string` / `workWindowFinish?: string` (+ eventueel de gedecodeerde segmentlijst als die voor Z8 nodig blijkt). Precedent voor "effective-dated lijst op een resource-object": `Resource.availabilitySteps`.

**Meet-afhankelijke keuze (verplicht vastleggen in Z4, niet hier gokken).** Blijkt bij Z4 dat de offsetvorm de opgeslagen MSP-datums niet exact reproduceert — bijvoorbeeld omdat een gat in *kalendertijd* moet tellen, of omdat het reeds voltooide segment bij herplanning blijft staan terwijl alleen het restwerk schuift — dan wordt de vorm dáár herzien, met de meting als motivering, en Z0 in dezelfde commitreeks bijgetrokken. Het is expliciet **niet** toegestaan om de discrepantie in de solver weg te compenseren en de opslagvorm te laten staan.

**Acceptatie.**
1. `npm run verify` groen zonder één bestaande verwachting aan te passen (alles optioneel/afwezig ⇒ byte-identiek).
2. Mutatie: verwijder `manuallyScheduled` uit `TASK_VERDICTS` in `moveProject.ts` → `tsc` faalt (bewijst dat de compile-poorten het nieuwe veld écht afdwingen). Idem voor de `Required<Task>`-fixture in `check-ifc-roundtrip.ts`.
3. Een JSON-case met `splitGaps` en `manuallyScheduled` bereikt aantoonbaar de solver. Mutatie: verwijder de harness-doorgifte van één veld → de case leest `undefined` en de bijbehorende assert valt ROOD (bewijst dat de doorgifte echt bestaat en niet stil wegvalt).
4. Mutatie: voeg een onbekende sleutel toe aan een taak in een casusbestand → `validateCaseKeys` faalt met de nieuwe `TASK_KEYS`-allowlist (vóór deze taak was dat stil).

**Afhankelijk van:** niets. **Blokkeert:** alles. **Risico:** laag, maar het is de fundering — Sonnet-implementer, korte Opus-review.

---

### BAAN M — meetlat

#### Z1 — Grondwaarheid TASK_MODE-bewust maken (meet-eerst)

**Doel.** De onafhankelijke grondwaarheid meet voor élke taak het veldpaar dat MS Project zélf voor die taak gebruikt: `SCHEDULED_START/FINISH` (35/36) voor auto-geplande taken, `START/FINISH` (1283/1284) voor handmatig geplande.

**Verplichte eerste stap: méten, niet bouwen.** Corpusbrede probe (wegwerpscript, niet committen):
- hoeveel taken hebben de TASK_MODE-bit aan, in hoeveel bestanden, in welke wortel (corpus/crawl)?
- voor hoeveel van die taken verschilt `START/FINISH` daadwerkelijk van `SCHEDULED_START/FINISH`?
- hoeveel van de 20 vandaag afwijkende bestanden bevatten er één, en — belangrijker — **hoeveel van de 196 vandaag exacte bestanden**?
Dit getal stuurt Z9a's omvang én voorspelt hoeveel tijdelijke `reason`-pins Z1 introduceert. Rapporteer het aan de orkestrator vóór de implementatie doorgaat.

**Bestanden.** `tests/planning/mppGroundTruth.ts` (exclusief baan M). Eventueel `tests/planning/mpp-fidelity-baseline.json` (tijdelijke pins).

**Referentie (verifieer op inhoud).** `MPP14Reader.java`: `readBitFields(metaData2BitFlags, task, metaData2)` met `metaData2` uit de **`Fixed2Meta`**-stream van `TBkndTask`; bit-flag-tabellen `PROJECT2010_TASK_META_DATA2_BIT_FLAGS` (offset **8**, masker **0x08**) en `PROJECT2013_/PROJECT2016_TASK_META_DATA2_BIT_FLAGS` (offset **8**, masker **0x80**). De versiegrens is dezelfde `≤14 vs >14`-`applicationVersion`-grens die `mppReader.ts` al voor `milestoneBitFlag` gebruikt — **hergebruik die logica, verzin geen tweede grens.** `FieldMap14.java`: `START` = block 1, offset 50, id 1283; `FINISH` = block 1, offset 54, id 1284. Overschrijfregel: `SCHEDULED_START` gaat alléén naar `START` als `START` leeg is óf de taak AUTO_SCHEDULED is.

**Let op — de onafhankelijkheidsbelofte.** Deze module is bewust een **tweede lus** naast `readTasks`. Ze mag dus **niet** de Fixed2-lezer van Z2 importeren; ze leest zelf, met haar eigen lus (net zoals ze nu al haar eigen `FixedMeta`/`FixedData`-lus heeft). Dat is duplicatie met opzet — documenteer het in de moduleheader, in dezelfde toon als de bestaande "BEWUST EEN TWEEDE LUS"-alinea. De bestaande "BEKENDE BEPERKING (L5)"-alinea wordt vervangen door de nu wél-gemeten werkelijkheid.

**Acceptatie (mutatie-bewijs).**
1. Synthetische, corpusloze fixture (`mppFixtures.ts`-bouwer): één MPP14-bestand met twee taken — één AUTO met verschillende 35/36 vs. 1283/1284, één MANUAL idem. `scanGroundTruthTasks` levert voor de AUTO-taak 35/36 en voor de MANUAL-taak 1283/1284. **Corpusloos**, dus draait ook in CI.
2. Mutatie: forceer de TASK_MODE-decodering naar altijd `AUTO` → fixture-case ROOD.
3. Mutatie: gebruik het 2010-masker (0x08) op een 2013-fixture → fixture-case ROOD (bewijst dat de versiegrens echt gelezen wordt).
4. Fixed2Meta/Fixed2Data-stream ontbreekt volledig → val netjes terug op 35/36 voor élke taak, geen exceptie; vijandige fixture die dat aantoont.
5. De baseline-delta van deze taak wordt volledig verantwoord: elk bestand dat verandert staat in het commitbericht met "welke taak, welke bit, welk veldpaar".

**Afhankelijk van:** Z0 (niet strikt, maar houdt de banen synchroon). **Blokkeert:** Z9a, en daarmee de eindpoort. **Risico:** hoog — dit verschuift de meetlat zelf. **Kwaliteitsreview op Opus.**

#### Z2 — Fixed2-infrastructuur in de lezer (block 1 + `Fixed2Meta`/`Fixed2Data` van `TBkndTask`)

**Doel.** De lezer kán bij block-1-velden en bij de taak-`Fixed2Meta`-bits. **Nog geen gedragswijziging aan de datums** — alleen lezen, opslaan in `RawTaskScan`, en tellen.

**Bestanden.** `src/services/mpp/fieldMap14.ts`, `src/services/mpp/mppReader.ts`, `src/services/mpp/limits.ts`, `tests/planning/check-mpp-import.ts`.

**Werk.**
- [ ] `FieldEntry` krijgt een blok-aanduiding (bv. `location: 'fixed' | 'fixed2' | 'var'`, of `block: 0 | 1`); `parseFieldMapBytes` registreert block-1-entries in plaats van ze weg te gooien. **Let op de alles-of-niets-terugval (I3):** `DEFAULT_TASK_FIELDS` beschrijft een andere fysieke layout; block-1-defaults erbij zetten mag alleen als de hele default-tabel consistent blijft. Volg het bestaande "aanwezig ⇒ uitsluitend data-gedreven"-contract.
- [ ] Nieuwe `TaskFieldId`-constanten: `Start: 1283`, `Finish: 1284`, `ManualDuration: 1288`, `ManualDurationUnits: 1289`, `LevelingDelay: 20`, `LevelingDelayUnits: 178`. (`LevelingDelay` staat vandaag als losse constante `TASK_FIELD_LEVELING_DELAY` in `mppReader.ts` — verhuis 'm hierheen, één plek.)
- [ ] `readTasks` opent `TBkndTask/Fixed2Meta` en `TBkndTask/Fixed2Data`, **beide optioneel** (ontbreken ⇒ huidige gedrag, geen exceptie). Spiegel het bestaande resource-precedent in `mppEntities.ts`: `FixedMeta.withHeuristicItemSize(...)` met kandidaat-itemgroottes, en `isFixed2MetaCostBit`'s defensieve stijl.
- [ ] `RawTaskScan` krijgt `taskMode`, `manualStartTs`, `manualFinishTs`, `manualDurationRaw`, `manualDurationIsElapsed`, `levelingDelayRaw` (bestaat al), `levelingDelayUnits`.
- [ ] Klemmen in `limits.ts` mét meetcommentaar voor elke nieuwe telling/lengte (hardening-checklist).

**Acceptatie (mutatie-bewijs).**
1. **Fidelity-baseline ONGEWIJZIGD** (0 verbeterd, 0 verslechterd, 216 ongewijzigd) — deze taak leest alleen. Dat is de belangrijkste assertie: een leesuitbreiding die stil datums verschuift is een bug.
2. Synthetische MPP14-fixture met een block-1-veldmap-entry: `fixedOffsetOf`-tegenhanger voor block 1 levert de juiste offset; mutatie (block-1-entries weer weggooien) → ROOD.
3. Synthetische fixture zonder `Fixed2*`-streams → alle nieuwe velden leeg, geen exceptie, rest van de lezing ongewijzigd (rode-pad-fixture voor elke nieuwe `try`/`catch`).
4. Vijandige fixture: `Fixed2Data`-record korter dan offset 54 → geen out-of-bounds, netjes `null`.
5. Corpusbrede telling van manual-taken (uit Z1's probe) reproduceert via déze lezer hetzelfde getal als via `mppGroundTruth.ts` — twee onafhankelijke lussen, zelfde antwoord.

**Afhankelijk van:** Z0. **Blokkeert:** Z5 (leveling), Z9a (manual). **Risico:** midden-hoog (byte-parsing, gedeelde field-map). **Kwaliteitsreview op Opus.**

#### Z3 — Timephased-decoder (`Var2Data` van `TBkndAssn`)

**Doel.** De timephased werksegmenten per toewijzing zijn leesbaar. Pure decoder, geen planningsgedrag.

**Bestanden.** `src/services/mpp/mppTimephased.ts` (**nieuw**), `src/services/mpp/mppEntities.ts` (`Var2Data` van `TBkndAssn` openen + doorgeven), `src/services/mpp/fieldMap14.ts` (assignment-veld-id's voor de timephased-categorieën), `src/services/mpp/limits.ts`, `tests/planning/check-mpp-import.ts`.

**Referentie (verifieer op inhoud).** `TimephasedDataFactory.java` (`getCompleteWork`, `getPlannedWork`, `getBaselineWork`, `getCost`), aangeroepen vanuit `ResourceAssignmentFactory.java`. Data zit volledig in **`Var2Data` van `TBkndAssn`**, per categorie een eigen var-data-sleutel (`RAW_TIMEPHASED_ACTUAL_REGULAR_WORK`, `TIMEPHASED_ACTUAL_IRREGULAR_WORK`, `RAW_TIMEPHASED_ACTUAL_OVERTIME_WORK`, `RAW_TIMEPHASED_REMAINING_REGULAR_WORK`, …). Decodering:
- *irregular*-blok: 16-byte header (eerste 2 bytes = recordcount) + 8-byte records (twee 4-byte timestamps: start/eind van werk buiten standaard werktijd).
- *regular*-blok: 16-byte header + 20-byte records — offset 0 = cumulatief werk aan periode-eind (**1000sten van een minuut**, double), offset 8 = werk-per-uur deze periode (**10000sten van een uur**), offset 16 = verstreken minuten aan periode-eind (**80sten van een minuut**, int). **Het eerste record is een totaal-record en wordt overgeslagen.**
- Resultaat: `TimephasedWork[]` — per entry een start/eind-instant en de hoeveelheid werk.

**Scope-begrenzing.** Alleen de categorieën die Z4/Z8 nodig hebben: actual regular work, remaining regular work, actual overtime work, en de irregular-tegenhangers. **Niet** de 11 baseline-varianten, niet de kostcategorieën — die dragen niets bij aan datums en verdubbelen het oppervlak. Documenteer die keuze in de moduleheader.

**Acceptatie (mutatie-bewijs).**
1. **Corpusloze** fixtures met handgebouwde bytes (`DataView`, nooit `TextEncoder`): (a) drie regelmatige records met bekende cumulatieve werkwaarden → exact de verwachte `TimephasedWork`-lijst; (b) een blok met een nul-werk-record ertussen → dat record komt door als gat; (c) een irregular-blok; (d) header met recordcount die niet strookt met de bloklengte → klemmen, geen crash, geen allocatie op basis van de ongevalideerde count.
2. Mutatie: sla het overslaan van het eerste (totaal-)record over → fixture (a) ROOD met een aantoonbaar te hoge eerste periode.
3. Mutatie: gebruik 1/10-minuut i.p.v. 1/1000-minuut voor de werkhoeveelheid → fixture (a) ROOD (bewijst dat de eenheden echt getoetst worden en niet toevallig meeschalen).
4. Fidelity-baseline ONGEWIJZIGD (0/0/216) — nog geen planningsgedrag.
5. Corpusbrede telling: hoeveel toewijzingen dragen timephased data, in hoeveel bestanden, en hoeveel daarvan zitten in de 11 timephased-bestanden uit §1.2? Als dat getal niet overlapt met de bekende afwijkers, is er iets mis met de decoder — rapporteer vóór verder te gaan.

**Afhankelijk van:** Z0. **Blokkeert:** Z4, Z8. **Risico:** hoog (nieuw byte-formaat). **Kwaliteitsreview op Opus.**

#### Z4 — Splitsegmenten afleiden

**Doel.** Uit de timephased-segmenten per toewijzing komt per taak een lijst werkonderbrekingen, in de canonieke vorm uit Z0.

**Bestanden.** `src/services/mpp/mppTimephased.ts` (afleidingsfunctie), `src/services/mpp/mppReader.ts` (koppelen aan de taak via `taskIdByUniqueId`), `tests/planning/check-mpp-import.ts`.

**Referentie.** `ResourceAssignment.getWorkSplits()`: loop over actual- en remaining-werksegmenten; een segment met `totalAmount == 0` is een gat; aaneensluitende/aangrenzende werksegmenten worden gemerged tot één range. Taakniveau = aggregatie over toewijzingen. ProjectLibre modelleert dit als één `stop`/`resume`-paar per toewijzing (taakniveau: vroegste stop, vroegste resume) en heeft daar een **zelf-erkende `//TODO integrate split - still needed?`** in de kern-offsetberekening — dus: ProjectLibre is hier expliciet **geen** betrouwbare referentie voor meer dan één splitsgrens. MSP kent er wél meerdere; ons model moet N gaten aankunnen.

**Verplichte meetstap (bepaalt de opslagvorm, zie Z0).** Reproduceer voor `mpxj/junit/data/mpp14splittask.mpp` (het enige zuivere splits-bestand, 2 finish-afwijkingen) de MSP-eigen opgeslagen finish uit `start + duur + gaten`. Werkt dat met gaten in **werk**minuten? In **kalender**minuten? Blijft het eerste (voltooide) segment staan terwijl het restwerk schuift? Leg het antwoord vast in de moduleheader mét het bewijs; wijk je van Z0's vorm af, escaleer dan naar de orkestrator in plaats van de vorm stil te veranderen.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze fixtures op de pure afleidingsfunctie: (a) twee werksegmenten met een gat → één `TaskSplitGap` met exact de verwachte `afterMinutes`/`gapMinutes`; (b) drie segmenten, twee gaten; (c) aangrenzende segmenten zonder gat → **lege** lijst (geen fantoom-split); (d) twee toewijzingen met verschillende gaten op dezelfde taak → de gedocumenteerde aggregatieregel, met een expliciete uitspraak wélke regel dat is en waarom.
2. `mpp14splittask.mpp` levert de verwachte gaten (aantal + posities gepind in een leescase).
3. Mutatie: laat de nul-werk-detectie weg → fixtures (a)/(b) ROOD.
4. Mutatie: merge aangrenzende segmenten niet → fixture (c) ROOD (fantoom-split van 0 minuten).
5. Fidelity nog steeds ONGEWIJZIGD (de solver doet er in deze taak nog niets mee).

**Afhankelijk van:** Z3. **Blokkeert:** Z7, Z15. **Risico:** midden-hoog. **Kwaliteitsreview op Opus.**

#### Z5 — Leveling delay lezen en decoderen

**Doel.** `levelingDelayRaw` wordt een echte duur — niet langer alleen een binair detectiesignaal (`≠ 0` ⇒ melding). Landt in `Task.levelingDelayMinutes` (nieuw, Z0) resp. `Task.levelingDelay` (bestaand, hele werkdagen) en `Task.levelingDelayElapsed`.

**Bestanden.** `src/services/mpp/mppReader.ts`, `src/services/mpp/fieldMap14.ts` (id 20/178, verhuisd in Z2), `src/services/mpp/limits.ts`, `tests/planning/check-mpp-import.ts`.

**Eenheid — de plan-hypothese van de vorige ronde is WEERLEGD.** `MPPUtility.getDuration(double, TimeUnit)` draagt de letterlijke commentaarregel *"Value is given in 1/10 of minute"*; MINUTES/ELAPSED_MINUTES doen `value / 10`, en `getAdjustedDuration` gebruikt `unitsPerDay = minutesPerDay * 10`. De schaal is dus **tienden van een minuut**, niet tienduizendsten. Onze eigen code documenteert dit al goed (`levelingDelayRaw`: "tienden van een minuut, zelfde eenheid als `durationRaw`") — hergebruik dat pad, bouw geen tweede conversie. `LEVELING_DELAY_UNITS` (id 178) levert de eenheid/elapsed-vlag; hergebruik de bestaande `getDurationTimeUnits`-decodering en de `isElapsedDuration`-conventie uit T10.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze fixture: leveling delay van bekende ruwe waarde → verwachte minuten; elapsed-variant → elapsed-vlag gezet.
2. Mutatie: deel door 10000 in plaats van 10 → fixture ROOD (pint de weerlegde hypothese expliciet af).
3. `levelingDelay === 0` ⇒ velden afwezig ⇒ byte-identiek (de bestaande `sourceScheduleNotes.leveled`-telling blijft exact gelijk).
4. Fidelity ONGEWIJZIGD (toepassing is Z6-werk: de motorkant).

**Afhankelijk van:** Z2. **Blokkeert:** Z6. **Risico:** laag-midden.

---

### BAAN S — motor

#### Z6 — Leveling delay meerekenen (uur-precisie + de backward-spiegel)

**Doel.** MSP's opgeslagen nivelleringsvertraging verschuift de taak exact zoals in MS Project — óók sub-dag, en zonder spookfloat.

**Wat er al is (niet opnieuw bouwen).** `forwardPass` bevat al `if (task.levelingDelay) earlyStart = cal.addWorkingDaysSigned(earlyStart, task.levelingDelay);`, precies ná de wortel-/voorganger-tak (dus ná `applyForwardConstraints` + `snapOnOrAfter`/`snapSuccessorEarlyStart`) en **vóór** het voortgangsblok. Die volgorde komt overeen met wat ProjectLibre doet (delay ná dependencies/constraints, vóór de actualStart-override) — houden.

**Drie gaten om te dichten.**
- [ ] **Uur-/minuutprecisie.** `CalendarEngine.addWorkingMinutesSigned` bestaat al; gebruik `levelingDelayMinutes` wanneer aanwezig (uur-modus), anders het bestaande dag-pad. Zelfde "aanwezig ⇒ bron van waarheid"-conventie als `durationMinutes`.
- [ ] **Elapsed.** `levelingDelayElapsed` ⇒ 24/7 rekenen via `addElapsedMinutes` (`duration.ts`), niet via de kalender — spiegelt wat T8/T9-M2 elders al deden. Verzin geen tweede elapsed-helper.
- [ ] **Backward-spiegel.** `levelingDelay` gaat vandaag **niet** mee in `backwardPass`/`subDuration`; een genivelleerde taak krijgt daardoor een `lateStart` die niet bij haar `earlyStart` hoort ⇒ verkeerde totale float en een verkeerd kritiek pad. Beslis en implementeer expliciet: telt de delay mee als onderdeel van de late-zijde? **Corpus is het orakel** — er zijn twee zuivere leveling-bestanden (`OzBuild Workshop 17.mpp`, `… 17 Leveling.mpp`, samen 15 start-/19 finish-afwijkingen) en één gemengd corpusbestand (hash `a69fec157074d056`, 15 gevlagde taken).
- [ ] **Invariant-waarschuwing.** `addWorkingDaysSigned` leunt erop dat `earlyStart` op een werkdag ligt. De `rootElapsed`- en `succElapsed`-bypasses (T8) kúnnen die invariant inmiddels breken. Toets dat met een case in plaats van het aan te nemen.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze cases in `cases-msp-pariteit.json`: (a) uurkalender, delay van 90 minuten ⇒ ES exact 90 werkminuten later; (b) delay over een weekend ⇒ werktijd telt, kalendertijd niet; (c) elapsed delay ⇒ 24/7; (d) delay op een taak mét voorganger én constraint ⇒ de volgorde (dependency → constraint → delay → voortgang) is aantoonbaar die en geen andere.
2. Mutatie: negeer `levelingDelayMinutes` (val terug op hele dagen) → case (a) ROOD.
3. Mutatie: laat de backward-spiegel weg → de float-assert in case (a)/(d) ROOD.
4. Corpus: de twee zuivere leveling-bestanden gaan naar **0** start- en finish-afwijkingen; het gemengde corpusbestand verbetert met minstens het leveling-deel (het manual-deel is Z9a).
5. `cases-resource-leveling.json` blijft ongewijzigd groen — `ResourceLeveler.ts` zet nog steeds hele werkdagen en mag niets merken.

**Afhankelijk van:** Z0, Z5 (voor de corpusclaim; de synthetische cases kunnen eerder). **Risico:** midden-hoog (raakt forward- én backward-pass). **Kwaliteitsreview op Opus.**

#### Z7 — Splitsen in de CPM: restwerk per segment

**Doel.** Een taak met `splitGaps` loopt door de gaten heen zoals MS Project: het werk is aaneengesloten, de gaten verlengen het venster, de finish klopt op de minuut.

**Ontwerp.** De canonieke regel is één zin: **de finish is de start plus de duur, waarbij elk gat als extra niet-werktijd telt op zijn eigen offset.** Dat is een uitbreiding van de duur-optelling, geen tweede algoritme.

**Aangrijpingspunten (alle vier verplicht — dit is de plek waar deze taak stil kan mislukken).**
1. `CPMSolver.addDurationChecked` (en de wrapper `addDuration`) — de gewone ES→EF-opbouw.
2. **De IN-PROGRESS-tak in `forwardPass` heeft haar EIGEN duur-optelling** (`addElapsedMinutes`/`cal.addWorkMinutes`/`cal.addWorkDaysChecked` op `remStart`, plus de `elapsedAnchor`-hervatting) en loopt **níét** door `addDurationChecked`. MSP's restwerk-per-segment raakt precies hier — een split-implementatie die alleen (1) doet, werkt aantoonbaar niet voor taken mét voortgang, en dat is nu juist de populatie waar splits vandaan komen.
3. `CPMSolver.subDuration` (backward: LF ⊖ duur ⇒ LS) — spiegel, anders spookfloat.
4. `CPMSolver.finishFromStart` / `startFromFinish` — gebruikt door de FF/SF-armen in `relationMath.ts` en door `forwardBoundOf`/`backwardBoundOf`/`hardPinStart`/`hardPinFinish`.
Daarnaast bewust NIET segmentbewust: `addElapsedMinutes`/`subtractElapsedMinutes` (24/7 per definitie) — spreek dat uit in het commentaar in plaats van het open te laten.

**Ontwerpvraag die met het corpus beantwoord moet worden, niet met een gok.** Wat gebeurt er bij herplanning met het al voltooide segment — schuift de hele taak, of blijft het gedane deel staan en schuift alleen het restwerk? ProjectLibre kiest expliciet het tweede (het uitgevoerde deel is onaantastbaar, `shift()` verplaatst alleen restwerk) maar draagt in diezelfde functie een zelf-erkende `//TODO integrate split - still needed?`. Meet het aan `mpp14splittask.mpp` en aan de splitsende taken in het OzBuild-materiaal; leg het antwoord vast in het docblok.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze cases: (a) taak 5d met één gat van 2 werkdagen ⇒ EF 7 werkdagen na start; (b) twee gaten; (c) gat dat op een weekend valt ⇒ telt niet dubbel; (d) gesplitste taak mét voortgang (raakt aangrijpingspunt 2); (e) gesplitste taak als FF-voorganger (raakt 4); (f) float-assert op een gesplitste taak (raakt 3).
2. Mutatie: verwijder de segmentbewuste tak uit `addDurationChecked` → (a)/(b) ROOD.
3. Mutatie: verwijder 'm alleen uit de IN-PROGRESS-tak → **(d) ROOD terwijl (a)/(b) groen blijven** — dit mutatiebewijs is de kern van de taak; zonder deze case is aangrijpingspunt 2 niet aantoonbaar geraakt.
4. Mutatie: laat `subDuration` ongewijzigd → (f) ROOD.
5. Corpus: `mpp14splittask.mpp` naar **0** afwijkingen. Geen enkel bestand zonder `splitGaps` verandert (byte-identiek: de veld-afwezige tak is dezelfde code als vóór deze taak).

**Afhankelijk van:** Z0, Z4. **Blokkeert:** Z15 (rendering leunt op dezelfde afleiding). **Risico:** hoog (heetste engine-lus, vier aangrijpingspunten). **Kwaliteitsreview op Opus.**

#### Z8 — Timephased venster bepaalt de taakdatums

**Doel.** Voor een taak met gecontoureerde/timephased toewijzingen komen de datums uit het werkvenster van die toewijzingen, niet uit een platte duur-optelling.

**Semantiekreferentie (ProjectLibre, ter hypothesevorming — corpus is het orakel).** `NormalTask.calcOffsetFrom()` itereert over **alle** toewijzingen, berekent per toewijzing haar eigen offset uit de work-contour, en neemt het **maximum** (forward) resp. minimum (backward): de langste toewijzing bepaalt de taakfinish. WBS-oudertaken vermijden die route juist en krijgen hun datums via min/max over de kinderen — dat komt overeen met onze bestaande `updateSummary`-rollup in `applyCpmResult.ts`.

**Ontwerp.** Voeg géén tweede planningsroute toe. Het venster uit Z3/Z0 (`ResourceAssignment.workWindowStart/Finish`) levert per taak een **ondergrens voor de finish** (en waar gemeten nodig: een anker voor de start), toegepast op dezelfde plek waar de andere forward-grenzen worden gestapeld. Concreet uit te meten en vast te leggen: *is* het maximum over toewijzingen de regel die het corpus reproduceert, of wint de toewijzing met het laatste venster ongeacht duur? (Dat is open vraag 7 uit het ProjectLibre-rapport — met 11 timephased-bestanden in het corpus is die vraag beantwoordbaar.)

**Let op — de contouring-detectiegrens uit de vorige etappe vervalt hiermee.** `WORK_CONTOUR` bleek via het door MPXJ gedocumenteerde `Fixed2Meta`-bit **niet** detecteerbaar (brute-force-scan op MPXJ's eigen referentiebestand `mpp14resource.mpp`: 0 treffers). Deze taak lost dat op een andere manier op: **de aanwezigheid van timephased datablokken is zelf het signaal**, en het venster is bovendien direct bruikbaar in plaats van alleen "iets is anders". Werkt dat, dan mag de KNOWN-GAP-leescase in `check-mpp-import.ts` omgezet worden van "wordt niet gemeld" naar "wordt correct gepland" — dat is een gedragswijziging aan een expliciet gepinde gap, dus mét mutatiebewijs en in het commitbericht verantwoord.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze cases op de vensterregel: (a) één gecontoureerde toewijzing met een venster langer dan de duur ⇒ finish volgt het venster; (b) twee toewijzingen met verschillende vensters ⇒ de gemeten regel (max) en niet de andere; (c) taak zonder timephased data ⇒ byte-identiek.
2. Mutatie: negeer het venster → (a)/(b) ROOD.
3. Corpus: de 11 timephased-bestanden gaan naar 0 start-/finish-afwijkingen **en 0 finishSameday** (4 van de 5 sameday-gevallen van de hele etappe zitten hier).
4. `mpp14resource.mpp` (contouring-grens) gaat naar 0 afwijkingen — dat is het bestand waarop de vorige etappe de detectiegrens moest documenteren.

**Afhankelijk van:** Z0, Z3. **Risico:** hoog (nieuwe planningsdriver). **Kwaliteitsreview op Opus.**

> **Orkestratorbesluit Z8-herwerk (2026-08-18).** De eerste oplevering (per-toewijzing FINISH-veld als brede forward-floor) is door de Opus-review blokkerend afgekeurd: de floor vuurde op 91% van álle taken (3102/3103 gelijk aan het gemeten taakveld — vrijwel volledige cirkelmeting met 2812 blinde vlekken), bevroor de motor na import (170/216 bestanden inert; 0,2% van de finishes reageert nog op bewerkingen), en introduceerde een EF<ES-inversie die al in het ongemuteerde corpus staat. De "kalenderwandeling onmogelijk"-conclusie rustte op een kapot instrument (de 24-uurs-resourcekalender promoveert niet naar uur-modus — een echte lezer-bug). Besluit: herwerk naar het Z12-model — eerst instrument repareren en de échte formule meten (per-toewijzing kalenderwandeling: START + restwerk + units door de toewijzings-eigen resourcekalender) op de werkelijke doelpopulatie (79 finish-taken / 13 bestanden + de startanker-populatie); een eventueel restant leest alleen met een strakke gate (echte timephased-records) en zonder bevriezing van bewerkingen ná import.

#### Z9a — Handmatig geplande taken: pin + doorwerking

**Doel.** Een `manuallyScheduled`-taak houdt haar eigen opgeslagen start/finish (rauw, ongesnapt, zonder constraint- of relatiedruk); haar opvolgers rekenen er wél normaal vanaf.

**Aangrijpingspunten.** Het beste structurele precedent is **`task.isHammock`**: dat is óók een taak met een eigen tak in `forwardPass`, een eigen early-return in `backwardPass` (`ls = es`, `lf = ef`) en drie uitsluitingen in `scheduleAnalysis.ts`. Volg dat patroon.
- [ ] `forwardPass`: nieuwe tak die ES/EF uit `time.scheduleStart`/`scheduleFinish` leest en `results.set(...); continue;` doet — **zonder** `snapOnOrAfter` (dat is het hele punt: MSP snapt een manual-taak niet naar de werkband). Functioneel het dichtst bij de bestaande VOLTOOID-tak; spiegel die vorm, inclusief de `if (ef < es) es = ef`-inversiecorrectie.
- [ ] Opvolgers hebben **geen** wijziging nodig: `results` is de enige bron voor `forwardConstraint`, dus de doorwerking komt gratis. Assert dat wél expliciet met een case (voorganger manual → opvolger auto ⇒ opvolger start op de rauwe manual-finish volgens de gewone FS-regels).
- [ ] `backwardPass`: **verplicht** een early-return, anders herrekent `subDuration(lateFinish, task)` een LS die niet bij de gepinde ES hoort ⇒ spookfloat.
- [ ] Besluit vastleggen: wat wint bij een manual-taak mét MSO/MFO-hardpin, en wat doet `applyForwardConstraints` dan? Voorstel: manual wint (MSP negeert constraints op manual taken), met een case die het pint.

**Acceptatie (mutatie-bewijs).**
1. Corpusloze cases: (a) manual taak met een anker buiten de werkband ⇒ ES exact het rauwe instant (géén snap); (b) manual voorganger → auto opvolger ⇒ correcte doorwerking; (c) manual taak met constraint ⇒ de gekozen, gedocumenteerde regel; (d) `manuallyScheduled` afwezig ⇒ byte-identiek.
2. Mutatie: laat de snap wél gebeuren → (a) ROOD (en dit is exact het symptoom uit dossier (c)5: 1 RAW tegen 5 SNAPPED).
3. Mutatie: laat de backward-early-return weg → de float-assert in (a) ROOD.
4. Corpus: de tijdelijke `reason`-pins die Z1 introduceerde verdwijnen; het gemengde corpusbestand verliest zijn `startSameday`-geval (de 45-minuten-taak uit dossier (c)5).

**Afhankelijk van:** Z1 (meetlat!), Z2 (leesbaarheid). **Blokkeert:** Z13. **Risico:** hoog — nieuwe planningsmodus. **Kwaliteitsreview op Opus.**

> **Z1-reviewobservatie voor deze taak (2026-08-17):** `mpp14timephasedsegmentsmanual.mpp` (21 taken, na Z1 alle 21 sameday) draagt een **uniform −60 min**-verschil tussen 1283/1284 en 35/36 op álle taken, ook bij onregelmatige eindtijden (14:20→13:20, 10:17→09:17) — een pure translatie, geen herberekening. De motor moet daar na Z9a exact de 07:00-ankers reproduceren; lukt dat niet, dan is de Z1-veldkeuze voor dít bestand de verdachte, niet de motor (zie §6-procesrisico "meetlat-verschuiving").

#### Z9b — Handmatig geplande taken: de randen

**Doel.** Float, kritiek pad, ALAP en rollup gedragen zich correct rond een gepinde taak. Aparte taak omdat dit vier verschillende modules raakt en Z9a anders te groot wordt.

**Werk.**
- [ ] `applyAlap`: mag een gepinde taak niet vooruitschuiven — overslaan.
- [ ] `scheduleAnalysis.computeScheduleResults`: `sequenceFreeFloat`/`drivingSequenceIds` leunen op `seqConstraint`, die voor een gepinde taak nog steeds gevuld wordt en dus een relatie ten onrechte non-driving kan maken; plus de `isCritical`-bepaling, `nearCritical` en de `floatPath`/`longestPath`-ketenopbouw. Spiegel de drie bestaande `isHammock`-uitsluitingen.
- [ ] `applyCpmResult.updateSummary`: de rollup neemt onvoorwaardelijk min/max over de kinderen. **In MS Project rolt een handmatig geplande samenvattingstaak juist NIET op** — die houdt haar eigen datums. Meet dit aan het corpus vóór je het implementeert (een manual samenvattingstaak moet in het corpus te vinden zijn met Z1's probe); is er geen enkel voorbeeld, documenteer dan de keuze en pin 'm met een synthetische case in plaats van hem stil te laten.

**Acceptatie (mutatie-bewijs).** Per punt één case + één mutatie; `cases-float.json`/`cases-advanced-cpm.json` blijven ongewijzigd groen (zonder `manuallyScheduled` verandert er niets).

**Afhankelijk van:** Z9a. **Risico:** midden-hoog. **Kwaliteitsreview op Opus.**

#### Z10 — Dossier: START_FINISH-semantiek (`mpp14relations.mpp`, "Task 5")

**Doel.** De SF-relatie rekent zoals MS Project. 1 finish-afwijking, maar het is een gedeelde-relatiewiskunde-dossier — dus klein in tellers, groot in blast radius.

**Stand van het bewijs.** MSP: ES 2006-09-22T08:00 (matcht al), EF 2006-09-25T08:00 (maandag). Wij: 2006-09-22T17:00 (vrijdag). Op een ma-vr-kalender liggen daar **0 werkminuten** tussen — het is één werk-sessiegrens, geen "3 dagen mis". De handmatige trace van de SF-forward-tak (`case 'START_FINISH'` in `forwardHour`: anker op `predResult.es`, evt. via `snapStrictAfter`, dan `deps.startFromFinish(se, reqFinish, successor)`) voorspelde ES 2006-09-25 voor Task 5, terwijl de live solver 2006-09-22 geeft. **Die discrepantie tussen statische trace en runtime is de openstaande vraag — en ze is met runtime-inspectie op te lossen, niet met bronlezing.**

**Verplichte werkwijze.** Bouw eerst een **corpusloze reproductie** van precies dit scenario (uurkalender, SF-relatie, dezelfde duurverhouding) in `cases-msp-pariteit.json` met de MSP-uitkomst als verwachting. Reproduceert die het symptoom, dan is de rest gewone debugging op een synthetische case en is het corpusbestand nog slechts de bevestiging. Reproduceert die het **niet**, dan zit de oorzaak in de interactie (`forwardConstraint`/`rawMax`/de projectstart-ondergrens) — breid de case dan stapsgewijs uit tot ze wél reproduceert; dát is de diagnose.

**Referentie (hypothesevorming, niet overnemen).** ProjectLibre rekent SF-forward terug op de *huidige* duur van de opvolger en past de lag altijd in de **voorganger**kalender toe. Dat is een plausibele interpretatie, geen autoriteit — en het is bovendien volgorde-gevoelig als de duur van de opvolger in dezelfde pass nog verandert.

**Acceptatie.** `mpp14relations.mpp` naar 0 afwijkingen; corpusloze case pint de MSP-semantiek; mutatie: draai de fix terug → case én corpusbestand ROOD; alle bestaande SF-cases (`cases-relations.json`, `cases-hours-relations.json`, `cases-lag-advanced.json`) groen **zonder aangepaste verwachtingen** — wijzigt er één, dan is dát het te motiveren feit.

**Afhankelijk van:** niets (puur solver). **Risico:** hoog (gedeelde relatiewiskunde). **Kwaliteitsreview op Opus.**

> **Orkestratorbesluit Z10 (2026-08-17, semantiekconflict).** De gevonden oorzaak: de SF-terugtelling (finish ⇒ start over de duur) is niet inverteerbaar wanneer ze exact een niet-werkperiode overspant; de voorwaartse herberekening `ES + duur` landde dan vóór het SF-anker. De fix (een aparte finish-ondergrens `reqFinish`, alleen voor START_FINISH) maakte `mpp14relations.mpp` exact met 0 corpusregressies over alle 216 bestanden, maar brak 4 oude synthetische cases (`rr-sf-h8-zero`, `rr-sf-hbreak-zero`, `rr-sf-pred-finishms`, `sf-hour`) die voor nacht/lunch-sessiegrenzen het voorwaarts-herberekende antwoord pinden. Die vier stammen van vóór het MSP-pariteitswerk en zijn nooit tegen MS Project geverifieerd. Besluit: **de uniforme SF-ankerregel wint** — één regel, gestaafd door MSP's eigen opgeslagen antwoord (weekendgeval) én corpus-consistent (0 regressies); een weekend/binnen-dag-discriminator zonder één meting zou verzonnen semantiek zijn. De vier verwachtingen worden bijgewerkt mét motiveringscommentaar dat expliciet zegt: binnen-dag-variant is MSP-ongemeten; duikt er ooit een corpusbestand op dat het tegenspreekt, dan wint dat bestand.

#### Z11 — Dossier: kruis-kalender-FS-asymmetrie

**Doel.** Een FS+0-relatie tussen taken met verschillende kalenders landt op MSP's datum, zonder de bestaande guard-case te breken.

**Stand van het bewijs (vorige etappe, T16c-M1 — beide kanten byte-onderbouwd).**
- **Corpusgeval** (`OzBuild Workshop 14 End Para 29.mpp`, 2 taken): voorganger en opvolger delen identieke ma-vr-banden maar de opvolger-kalender ("6 Day Week") werkt óók zaterdag. MSP's ES is zaterdag 08:00; wij geven maandag. Oorzaak: bij lag 0 snapt de grens **eerst** in de voorganger-kalender (`pe.nextWorkInstant`/`pe.nextWorkDayAfter`), die zaterdag niet kent.
- **Guard-case** (`msp-04-m2-guard1-alleen-crosscalendar` in `cases-msp-pariteit.json`): twee uur-kalenders met écht verschillende bandgrenzen; daar is de `pe`-eerst-dan-`se`-dubbelsnap aantoonbaar **correct**.
- Een narrow fix ("lag 0 ⇒ snap direct in de opvolger-kalender") loste het corpusgeval op (−4 afwijkingen, 0 corpusregressie, dag-modus byte-identiek) maar brak de guard-case in uur-modus.

**De opdracht is dus: vind de discriminator en toets hem.** De kandidaat staat al geformuleerd: *voorganger-eerst, tenzij de twee kalenders op hun gedeelde werkdagen identieke banden hebben — dan opvolger-eerst.* In het corpusgeval zijn de gedeelde banden identiek (alleen zaterdag verschilt); in het guard-geval verschillen de bandgrenzen zelf. Die eigenschap is uitleesbaar. **Implementeer 'm pas nadat beide gevallen met de kandidaat-discriminator gereconstrueerd zijn** — anders is het een derde ongeverifieerde aanname in code die álle FS-relaties raakt.

**Let op de aanpalende, gedocumenteerde beperking:** `shiftLagPred` normaliseert bij lag 0 zélf al via `pe.nextWorkInstant(base)`, vóór de `succElapsed`-check — SS mist daardoor de `lagIsZero`-ontsnapping die FS/FF/SF wél hebben. Raak je `shiftLagPred` (9 aanroepplekken), toets dan óók de bekende-beperkingscases `msp-26`/`msp-28`.

**Acceptatie.** Corpusgeval naar 0 afwijkingen; guard-case ongewijzigd groen; nieuwe corpusloze cases voor beide kanten van de discriminator (identieke gedeelde banden + extra werkdag / verschillende bandgrenzen); mutatie: discriminator vast op "voorganger-eerst" → corpusgeval ROOD; vast op "opvolger-eerst" → guard-case ROOD. **Beide mutaties zijn verplicht** — samen bewijzen ze dat de discriminator echt discrimineert.

**Afhankelijk van:** niets. **Risico:** hoog. **Kwaliteitsreview op Opus.**

#### Z12 — Dossier: out-of-sequence-actuals (retained logic)

**Doel.** De grootste enkele restcluster: 2 OzBuild-bestanden, 18 start-/26 finish-afwijkingen, één root-cause-taak die naar 13 van de 18 taken propageert.

**Stand van het bewijs.** Root-cause: "Validate Technical Specification" (completion 8%, `actualStart` vóór de herberekende finish van haar FS-voorganger; expliciet gedetecteerd via `CPMResult.outOfSequenceSequenceIds`). Gemeten tegen MSP's eigen opgeslagen antwoord:

| modus | finish |
|---|---|
| RETAINED_LOGIC (huidig, incl. `resumeFromActualElapsed`) | 2019-01-09T17:00 (6 dagen te laat) |
| PROGRESS_OVERRIDE | 2019-01-02T17:00 (1 dag te vroeg) |
| **MSP's eigen waarheid** | **2019-01-03T17:00** |

MSP ligt tussen beide bestaande modi in. Sterke aanwijzing uit de vorige ronde: bij een aantoonbaar out-of-sequence relatie moet de voorganger-druk uit de RETAINED_LOGIC-hervattingsformule vervallen (zoals PROGRESS_OVERRIDE doet) — maar niet volledig, want dat alleen geeft nog 1 dag te vroeg. **De resterende dag is de opdracht van deze taak.**

**Werkwijze (meet-eerst, corpusloos reproduceren).** Reconstrueer de taak volledig als synthetische case (actualStart vóór voorgangerfinish, 8% voortgang, dezelfde kalender/duur) en zoek de formule die MSP's antwoord oplevert. Kandidaten om systematisch te toetsen, elk met een gemeten uitkomst in het docblok: hervatting op `actualStart + verstreken duur` (T9's `resumeFromActualElapsed`-mechanisme) zónder de voorganger-max; hervatting op de statusdatum; hervatting op de voorgangerfinish maar met de reeds verstreken duur verrekend. **Geen enkele van die drie mag "ongeveer" kloppen — de goal is op de minuut.**

**Reikwijdte-besluit dat expliciet gemaakt moet worden.** Wordt dit een nieuwe `.mpp`-scoped opt-in-vlag (familie `resumeFromActualElapsed`/`unstartedIgnoresStatusDate`, allebei uitsluitend door `mppReader.ts` gezet) of een universele correctie (familie O8/O9)? **Voorstel: opt-in vlag**, want de bestaande RETAINED_LOGIC-semantiek van Scenario A/B/C in `cases-progress.json` is een bewuste P6-keuze die niet stil mag omslaan. Spiegel het documentatiestramien van `unstartedIgnoresStatusDate` (default false ⇒ byte-identiek, wie zet 'm, welke test bewaakt de default), inclusief de `mspdiWriter.ts`-warn zodat een `.mpp → MSPDI → herimport`-cyclus 'm niet stil laat vallen.

**Acceptatie.** Beide OzBuild-bestanden naar 0 afwijkingen (root-cause én de 13 downstream-taken — die komen gratis mee zodra de wortel klopt, en dat is meteen de controle dat de diagnose klopt); corpusloze cases voor beide semantieken (vlag aan/uit); mutatie: vlag geforceerd uit → corpus ROOD, `cases-progress.json` groen; vlag geforceerd aan → de P6-contrastcase ROOD.

**Afhankelijk van:** niets (raakt wel dezelfde voortgangstak als Z7's aangrijpingspunt 2 — coördineer binnen baan S, één taak tegelijk). **Risico:** hoog. **Kwaliteitsreview op Opus.**

> **Orkestratorbesluit Z12-herwerk (2026-08-18).** De eerste oplevering koos een retentie-anker op `scheduleFinish` op basis van de claim dat MSP's beslissing history-afhankelijk is. De Opus-review WEERLEGDE die claim met eigen meting: de discriminerende invoer staat in het bestand — veld-id **99 ("resume")** en **100 ("stop")** in de data-gedreven veldkaart, ongelezen in `fieldMap14.ts` — en `addWork(resume, remaining)` reproduceert MSP's opgeslagen finish-dag op alle vier de workshop-snapshots. Het anker had bovendien drie kritieke gebreken (cirkelmeting: 15 blinde vlekken; bevriezing ná import, zelfvoedend via `applyCpmResult`; docblok verwees naar een niet-bestaande MSPDI-warn). Besluit: **anker eruit, veldgedreven stop/resume-formule ervoor in de plaats**, mits de corpusbrede meting (met juiste taakkalenders) hem draagt; de vlag `outOfSequenceIgnoresPredecessorPressure` vervalt vermoedelijk mee. Fase 1 = meten (scratchpad-only, want baan L bewerkt `mppReader.ts` parallel); fase 2 = implementatie ná de eerstvolgende baan-L-merge. De leeskant (99/100 → `RawTaskScan`) is dan een geoorloofde, gemelde uitzondering op de bestandseigendom, net als de eerdere éne-optieregel.

#### Z13 — Dossier: rauw anker zonder constraint

**Doel.** Een wortel-taak met een opgeslagen anker exact op een bandgrens (`…T17:00`) behoudt dat instant, zoals MSP.

**Stand van het bewijs.** `timephased-prorated-cost-resource.mpp`, taak "No Progress - Actual Cost" (4 taken, geen voorgangers, geen constraints): MSP houdt `2026-01-29T17:00`, wij snappen naar `2026-01-30T08:00`. De `earlyFinish` klopt wél — de discrepantie zit uitsluitend in de wortel-anker-snap (`ownAnchor`/`snapOnOrAfter` in de `preds.length === 0`-tak van `forwardPass`), niet in `applyForwardConstraints`.

**Waarom deze taak WACHT op Z9a.** Dit is dezelfde symptoomfamilie als dossier (c)5 (rauw vs. gesnapt anker), en de best onderbouwde hypothese daarvoor was TASK_MODE. Z9a lost het constraint-gebonden geval op; **meet daarna opnieuw** of dit bestand nog afwijkt. Zo niet: klaar, en dat is dan een aantoonbaar gevolg van Z9a en geen toeval. Zo wel: dan is er een tweede regel nodig, en die raakt de gedeelde wortel-anker-snap — dus ALLE wortel-taken. In dat geval geldt: eerst corpusbreed meten hoeveel wortel-ankers exact op een bandgrens liggen en wat MSP daar doet (dezelfde probe-vorm als de 1-RAW-vs-5-SNAPPED-meting), pas dan een regel.

**Acceptatie.** Bestand naar 0 afwijkingen; corpusloze case voor de gekozen regel; mutatie: regel terug → case + bestand ROOD; **alle bestaande wortel-anker-cases groen zonder aangepaste verwachtingen** (deze snap raakt élke voorgangerloze taak — dat is de grootste blast radius van de vier dossiers).

**Afhankelijk van:** Z9a. **Risico:** hoog. **Kwaliteitsreview op Opus.**

---

### BAAN D — data-round-trip, weergave, documentatie

#### Z14 — Documentcontract, IFC-round-trip en de exportranden

**Doel.** De nieuwe projectdata overleeft opslaan+heropenen, documentwissel, undo/redo en crashherstel — en verdwijnt nergens stil.

**Wat NIET hoeft (gemeten, niet aangenomen).** `src/state/documentContract.ts` beschrijft taakvelden **niet per veld**: er is één `field({ key: 'tasks', snapshot: 'clone' })`-descriptor, en `'clone'` is een diepe JSON-kloon. Splitsegmenten, manual-vlag en leveling-minuten rijden dus automatisch mee in undo/redo, `switchDocument` en recovery. `ifcSaveInput.ts` idem (`tasks` gaat integraal mee). `check-document-contract.ts` assert over `DOCUMENT_FIELDS`-keys en ziet een nieuw taakveld niet. **De echte poort is `check-ifc-roundtrip.ts`** — dáár landt het werk.

**Werk.**
- [ ] `src/services/ifc/ifcPsets.ts` — nieuwe `PER_TASK_PSETS`-descriptors. **Raak `ifcTaskSlots.ts` niet aan**: daar is de array-positie de STEP-argumentindex, en een ingevoegd slot breekt élk bestaand bestand.
  - Splits: kopieer descriptor `PSET.ExternalLink`/`PSET.TaskNotes` — één autoritatief JSON-veld (`PSET.Splits = 'OPS_TaskSplits'`, `write` levert `null` bij lege lijst, `apply` doet `JSON.parse` in try/catch met `Array.isArray`-guard). Schaalt naar N gaten zonder property-explosie.
  - Manual scheduling: kopieer descriptor `PSET.Constraints`/`PSET.Milestone` — losse getypte properties. **Let op de volgorde van de guards**: de boolean-afhandeling moet bóven de `typeof value !== 'string'`-guard, precies zoals `Hard` in de Constraints-descriptor.
  - Leveling-minuten/elapsed: uitbreiding van het bestaande `OPS_Leveling`-pset.
  - Timephased-venster: **niet** het `OPS_Assignments`-pipe-formaat uitbreiden (dat breekt de legacy-parse-symmetrie) maar een eigen `OPS_Timephased`-pset in JSON-blob-vorm, zoals `writeBaselineMeta` het doet. Dat raakt `ifcWriter.ts`/`ifcReader.ts`.
- [ ] `src/types/task.ts` — de Z0-tijdperk-doc bij `splitGaps` ("geen lezer vult dit") is sinds Z4 onwaar; actualiseren (Z4-reviewsignaal, buiten baan L-eigendom gehouden).
- [ ] **`TaskTime.resume`/`stop` IFC-round-trippen** (Z12-reviewsignaal): nu skip-cellen in `TIME_CANON`; zonder pset-cel schuift een `.mpp → IFC → heropenen → F5`-cyclus de out-of-sequence-taak terug naar de RETAINED_LOGIC-uitkomst — zelfde klasse als `splitGaps`. Plus de MSPDI-melding "resume/stop niet native geschreven" (of native `<Resume>`/`<Stop>` — hier wegen).
- [ ] **Z8-navelden round-trippen** (Z8-oplevering): `Task.timephasedFinishFloor`/`timephasedStartAnchor` hebben nog geen IFC-pset (skip-cellen in check-ifc-roundtrip) — zonder pset verliest een .mpp → IFC → heropenen → F5-cyclus het timephased-venster en schuiven die taken terug. Zelfde klasse als resume/stop; kleine baan-D-nataak vóór Z17.
- [ ] **Rauwe contourperiodes bewaren** (eigenaarsvraag 2026-08-18): de gedecodeerde échte timephased-periodes (actual + remaining, uitsluitend toewijzingen met werkelijke dagverdeling — de vlakke samenvattingsrecords dragen geen verdeling en blijven buiten beschouwing) landen nu nergens in het document; na .mpp → IFC → origineel weg is de contour-informatie definitief verloren, en de latere contour-engine (zie de taaktypes-spec) mist dan zijn voedingsdata voor eerder geïmporteerde projecten. Bewaren als eigen OPS-pset in JSON-blob-vorm (Z14-patroon), puur data — geen rekengedrag. Baan-D-nataak, samen met de venstervelden.
- [ ] **EIGENAARSPRINCIPE (2026-08-18, bindend voor de invalidatie-nataak): er gaat nooit stilzwijgend broninformatie verloren, ook niet ná bewerken.** De edit-time-invalidatie mag uitsluitend de *afgeleide sturing* uitschakelen (het venster stopt de motor te ankeren); de rauwe periodes/broninvoer eronder blijven in het document staan, desnoods gemarkeerd als "origineel uit MSP, niet meer toegepast na bewerking". Wissen van brongegevens gebeurt alleen als de gebruiker dat zélf expliciet doet.
- [ ] **Sleutel-aanwezigheid-testgat** (Z12-her-check L1): `mergeTaskTime`'s conventie is voor `resume`/`stop` ongetest — mutatie `resume: partial.resume` (guard eruit) blijft groen; voeg twee regels toe aan de `10b/draft.updateTaskFields`-cases in `check-ifc-roundtrip.ts` zoals `actualStart` ze heeft.
- [ ] `src/engine/moveProject.ts` — verdicts invullen. `splitGaps` = `'n/a'` (offsets, geen datums — dat is het ontwerpvoordeel uit Z0; taxonomie gelijk aan `levelingDelay: 'n/a'`); `manuallyScheduled` = `'n/a'` (vlag, zoals `isHammock`); de manual-datums zitten in `scheduleStart`/`scheduleFinish` en dragen dus het bestaande verdict.
- [ ] Exportranden — **warnen, niet stil laten vallen.** MSPDI kent native `<Manual>`, `<LevelingDelay>`/`<LevelingDelayFormat>` en `<TimephasedData>`, maar onze lezer leest geen van drieën. Het bestaande precedent in `mspdiWriter.ts` (de `ELAPSEDTIME`/`<DurationFormat>`-motivering) is expliciet: *native schrijven zonder terug te lezen is een stille semantiek-omklap en dus erger dan verlies.* Volg dat: deze etappe **alleen warnen** (per-taak-teller + `console.warn`-vorm die daar al staat, en het `lost`-array-patroon voor `schedulingOptions`), en native MSPDI-ondersteuning als TODO registreren. `p6xmlWriter.ts` heeft dezelfde vormtaal.
- [ ] Niet-compile-afgedwongen randen, dus expliciet afvinken: `src/services/csv/csvWriter.ts` (vaste 14-koloms `headers`, geen warn), `src/extensions/extTypes.ts` + `extMappers.ts` (**vier** plekken: `toExtTask`, `toIntTask`, het create-pad en het update-pad), en de MCP-allowlist in `src/services/mcp/tools/taskFields.ts` (`TASK_FIELD_NAMES` + `TASK_FIELD_SCHEMA_PROPERTIES` + een `REJECT_HINTS`-entry voor de niet-zetbare velden, zoals `notes`/`isHammock` het al doen) **plus `src/state/mcpTransaction.ts` `draft.addTask`** — de gedocumenteerde veld-voor-veld-tweeling van `taskSlice.addTask`; die kreeg de vier nieuwe velden in Z0 bewust niet (ongebruikt + MCP-zetbaarheid is een Z14-besluit) en drift anders stil (Z0-reviewbevinding 3).

**Acceptatie (mutatie-bewijs).**
1. `check-ifc-roundtrip.ts`: elke nieuwe `{ skip: … }`-cel uit Z0 is vervangen door een echte round-trip-cel; veld-voor-veld identiek vóór/na.
2. Mutatie: laat één property weg in de writer → round-trip ROOD op precies dat veld (niet "ergens").
3. Idempotentie (`writeIFC∘readIFC∘writeIFC`) blijft groen; een project **zonder** de nieuwe velden schrijft **byte-identiek** IFC als vóór deze taak (`verify:examples` groen zonder regeneratie).
4. Extern-stijl IFC zonder de OPS-markering leest conservatief (geen fantoom-splits) — spiegelt het T5-precedent waar een spec-conform bestand niet als OPS-data misgelezen mag worden.
5. `check-document-contract.ts` blijft groen; de recovery-K3-keten (echte store → `writeIFC` → `readIFC` → `restoreDocuments`) draagt de nieuwe velden aantoonbaar mee.
6. Mutatie per exportrand: verwijder de warn → de bijbehorende case in de exportsuite ROOD.

**Afhankelijk van:** Z0 (types), en inhoudelijk van Z4/Z5 (er moet data zijn om te round-trippen). **Risico:** midden. **Sonnet-review (mechanische volledigheidscontrole tegen deze lijst).**

#### Z15 — Onderbroken balken in Gantt, print en PDF

**Doel.** Een gesplitste taak ziet er uit zoals in MS Project: losse blokken met een dun verbindingslijntje.

**Wat er al is (hergebruiken, niet herbouwen).** `GanttRenderer.drawTaskBar` heeft de segmentmachinerie **al**, alleen gevoed vanuit de kalender: `barGeometry(task)` → `shouldSplit(isSelected)` (leest `opts.barSplitMode`, `'always'|'selection'|'never'`, uit `ui.barSplitMode`) → `engineFor(task).workIntervalsBetween(start, end)` → `segs`, plus de necking-connector (dunne lijn op `y + height/2` tussen `segs[0].x2` en `segs[laatste].x1`, `globalAlpha * 0.5`), de per-segment `roundRect`, de voortgangsvulling begrensd op de **globale** `progressEnd`, en de selectiering over de volle extent. **Inpassen = `segs` mede uit `task.splitGaps` vullen**, met dezelfde `split`-vlag.

**Aandachtspunten.**
- De cull-test bovenaan `drawTaskBar` (bewaakt door `check-gantt-float-cull.ts`) moet op de volle extent blijven redeneren.
- `getTaskBarBounds` (drag/resize-hittest) redeneert op `[x1, x2]` — een gesplitste balk blijft dus als geheel sleepbaar. Dat is voor deze etappe **de gewenste uitkomst** (bewerken van splits is niet in scope); leg het vast in het commentaar in plaats van het toevallig zo te laten.
- **Interactie met `barSplitMode`:** dat is vandaag een weergave-instelling voor kalender-necking. Een échte split is geen weergavevoorkeur — die hoort altijd zichtbaar te zijn. Kies expliciet: `splitGaps` tekent altijd gesplitst, ongeacht `barSplitMode`; de instelling blijft alleen de kalender-necking sturen. Documenteer dat in de gids.
- `src/services/print/printPreview.ts` heeft een **eigen** balkenlus (`d2d.roundRect`, eigen `PRINT_COLORS`, `BarLabelJob`-uitgestelde labels) die `isHammock` al niet kent — hier moet de splittekening apart bijgebouwd. Eén implementatie daar bedient zowel de rasterpreview als de vector-PDF, want beide lopen via de `Draw2D`-abstractie (`src/services/pdf/draw2d.ts`, `canvasDraw2d.ts`, `pdfVectorDraw2d.ts`). Respecteer de gedocumenteerde tekenvolgorde (staven → pijlen → labels).

**Acceptatie (mutatie-bewijs).** Nieuwe `tests/planning/check-split-bar-render.ts`, gemodelleerd naar `check-milestone-duration-render.ts`/`check-gantt-float-cull.ts`/`check-renderer-dateless.ts` (DOM-stubs + opnemende 2D-context-stub):
1. Taak met 2 gaten ⇒ 3 `roundRect`-aanroepen op die rij + de connector (`moveTo`/`lineTo`) ertussen.
2. Mutatie: negeer `splitGaps` in `segs` → 1 `roundRect`, case ROOD.
3. `barSplitMode: 'never'` ⇒ een `splitGaps`-taak blijft gesplitst; een taak zonder `splitGaps` niet (bewijst dat de twee mechanismen echt gescheiden zijn).
4. Voortgangsvulling loopt door over de segmenten heen (globale `progressEnd`), niet per segment opnieuw.
5. Print/PDF: dezelfde assertie op de `Draw2D`-opnemer.

**Afhankelijk van:** Z0 (veld), Z7 (voor echte data; het rendertest-werk kan met handmatig gezette `splitGaps` eerder). **Risico:** laag-midden.

#### Z16 — Melding herschrijven en de gidsen waarmaken

**Doel.** De openings-melding blijft — maar als **informatieve mededeling**, niet als excuus. En elke planningsclaim in de gidsen is tegen code of test geverifieerd.

**Melding.** De huidige tekst zegt in essentie "hun datums kunnen daardoor afwijken van MS Project". Ná deze etappe is dat **onwaar** en dus een bug in de tekst. Nieuwe strekking (nl is bron, en verplicht, plus 13 vertalingen): *"Dit MS Project-bestand bevat {{count}} taak/taken met een onderbroken, genivelleerde of resource-gedreven planning. Die worden als zodanig ingelezen en getoond."* — neutraal, tellend, niet-blokkerend, `severity: 'info'`, bestaande `dedupeKey`. Volledige CLDR-pluralcategorieën (`verify:i18n` rekent met categorieën: `zh/ja/ko` géén `_one`, `pl` `few`/`many`, `es/fr/it/pt` `many`).
**Detectiebron opnieuw bekijken:** `sourceScheduleNotes` telt vandaag `leveled` (leveling delay ≠ 0) en de proxy `spanGt`. Met Z4 zijn splits **echt** leesbaar en met Z8 timephased-vensters ook — vervang de proxy door de echte tellingen en zeg in de moduleheader waarom de proxy weg mag (ze was een uitwijk, geen ontwerp).

**Gidsen (nl + en, verplicht; manifest-entry; binnen de `miniMarkdown`-subset — geen tabellen, geen blockquotes, geen h4, alleen `docs://`/`examples://`-links).**
- `public/docs/{nl,en}/gids-msproject-import.md`: de "twee eerlijke uitzonderingscategorieën"-formulering uit de vorige etappe **vervalt** en wordt vervangen door wat er nu waar is. Nieuwe secties: gesplitste taken, handmatig geplande taken, nivellering, gecontoureerde toewijzingen.
- `gids-plannen-wbs.md` / `gids-relaties-constraints.md`: waar ze over mijlpalen/duur spreken, controleren of de nieuwe planningsmodus genoemd moet worden.
- `gids-import-export.md`: wat er bij MSPDI-/P6-/CSV-export verloren gaat (de warns uit Z14) — expliciet, niet impliciet.
- **Verificatieregel, hard:** elke zin die planningsgedrag claimt, krijgt in de PR-/commit-toelichting een verwijzing naar de code of de test die 'm waarmaakt. Een claim zonder verwijzing wordt geschrapt, niet verzacht. Dit is de les van de "hoogstens één taak in een ongebruikelijke situatie"-claim die de vorige etappe nooit gemeten had.

**Acceptatie (mutatie-bewijs).**
1. Mutatie: verwijder de `notify`-aanroep → nieuwe case in `check-notifications.ts` ROOD.
2. Mutatie: verwijder één taal uit de sleutelset → `verify:i18n` ROOD.
3. Mutatie: hernoem een gids-id in het manifest → `verify:docs` ROOD.
4. De melding verschijnt **niet** bij een schoon bestand (negatieve case).
5. De nieuwe detectietelling is per corpusbestand gepind en komt overeen met het aantal taken dat daadwerkelijk `splitGaps`/`levelingDelayMinutes`/een timephased-venster draagt.

**Afhankelijk van:** Z4, Z5, Z8 (echte tellingen). **Risico:** laag-midden; veel oppervlak (14 talen + docs).

---

### SERIEEL — integratie en afronding

#### Z17 — Integratie, hermeting, herpinnen

**Stappen.** Banen mergen in de volgorde van §5 → `OPS_MPP_FIDELITY_REPORT=baseline` draaien → nieuwe pins committen → `npm run verify` → het resterende afwijkingsbeeld classificeren en aan Z19 doorgeven.
**Verplicht vóór herpinnen** (les van T13): elke verslechtering wordt **geattribueerd** vóór ze gepind wordt — welke taak, welk mechanisme, bug of verklaard effect. Stilzwijgend pinnen is een regressie in het proces, niet alleen in de cijfers. En: let op de val waar T13 in trapte — een **verzameltaak** met een afwijking is bijna nooit zelf de oorzaak; haar `earlyFinish` is een rollup van een kind. Diagnosticeer altijd op bladniveau (`childIds.length === 0`).
**Acceptatie.** `npm run verify` groen; elke baselinewijziging in het commitbericht verantwoord met "welke taak, welk gemeten effect".
**Afhankelijk van:** Z1–Z16.

#### Z18 — Gebruikstest in de browser (aparte agent, DIRECT na Z17)

**Werkwijze.** `docs/self-test-harness.md`, tier 1: `npm run dev` (poort per worktree — lees 'm uit de dev-serveruitvoer of `.claude/launch.json`, neem nooit 3007 aan), Playwright-MCP + `window.__OPS__`; assert op **store-state**, niet op canvas-pixels.
**Scenario's.**
1. Open een `.mpp` met gesplitste taken → de Gantt toont onderbroken balken; de tabel toont MSP's datums.
2. Open → opslaan als IFC → heropenen → `splitGaps`/`manuallyScheduled`/leveling-minuten/timephased-venster staan er nog, datums identiek.
3. Open een bestand met handmatig geplande taken → hun datums staan exact op MSP's waarden; hun opvolgers zijn wél doorgerekend; F5 (herberekenen) verandert **niets**.
4. Melding verschijnt precies één keer, met het juiste aantal en de juiste (nieuwe) tekst; de gidslink werkt.
5. Print-/PDF-voorbeeld toont dezelfde onderbroken balken.
6. Taalwissel naar `pl` en `ja` → meldingstekst correct meervoudig, geen Engelse terugval.
7. Undo/redo en documentwissel over een geïmporteerd bestand met splits → geen dataverlies.
**Acceptatie.** Bevindingen als losse, benoemde items terug naar de orkestrator; blokkerende bevindingen worden taken vóór Z19.
**Valkuil uit de vorige etappe:** een meegeleverde `.mpp.xml`-sidecar is **geen** betrouwbare grondwaarheid (kan een andere bewerkstatus hebben) — verifieer tegen de binaire scan.

> **Z8-restdossiers voor Z19 (eindstand ná de goedgekeurde slotronde, 2026-08-18):** de vlakke
> lees-terugval is volledig geschrapt; het gelezen venster raakt nog 69 taken in 13 bestanden.
> (a) **14 bestanden 100% handmatig-gepland** (bladniveau via taskMode geverifieerd, steekproef door de
> reviewer bevestigd) — Z9a-pins, verdwijnen daar; (b) **7 bestanden met een eigen gemeten
> timephased-reden**: multi-toewijzing-apportionering (mpp14resource "Task A"), holiday-only-0%-poortgrens
> (mpp14timephased2), 5× budget-werktracking buiten decoder-scope; plus de eerdere drie (Task 6-familie-
> restwerk-anomalie, segmentsmanual-uurprecisie, overtime-wandelpad) voor zover nog aanwezig in de pins.
> **Nataken vóór Z17**: (1) edit-time-invalidatie van het gelezen venster in `taskSlice.ts`/
> `mcpTransaction.ts` (raakt nu nog 69 taken — door de reviewer als legitieme nataak beoordeeld) —
> *afgehandeld in Z14b (incl. `resourceSlice.ts` en laag 4 bij toewijzingswijzigingen)*;
> (2) docblok-nit startanker: rechtvaardiging herformuleren naar "MSP slaat hier een ongesnapt instant
> op", niet "verwijderen verslechtert" (dat suggereert een bewijs dat de meting niet kan leveren) —
> *afgehandeld direct na de Z14b-merge (mutatieproef alleen nog als niet-circulariteitscontrole)*.

#### Z19 — Residu-iteratie tot nul

**Doel.** Van "vrijwel nul" naar **nul**. Dit is de taak waar de goal gehaald of gemist wordt.
**Werkwijze.** Itereer: `OPS_MPP_FIDELITY_REPORT=detail` → classificeer élke resterende afwijkende taak (op **bladniveau**) → één van twee uitkomsten:
- **(a)** het is een echte fout → eigen mini-taak in de juiste baan, met mutatiebewijs;
- **(b)** geen (a) → **escaleren volgens §6**. Er is in deze etappe géén categorie (c): "pinnen met reden" bestaat niet meer als uitweg.
**Uitgangscriterium.** Alle tellers 0, geen `reason`-veld in de baseline.

#### Z20 — Eindpoort aanzetten, eindreview, documentatie

> **Veeglijst voor de eindronde** (niet-blokkerende reviewobservaties, hier verzameld):
> - Z6: takvolgorde `if (levelingDelay) … else if (!noPreds && levelingDelayMinutes)` — een taak met beide velden zou aan de ankerregel ontsnappen (vandaag onmogelijk: lezer zet alleen minuten, ResourceLeveler alleen dagen); precedentie-tekst spoort niet helemaal met de gating.
> - Z6: de M1-bandsnap kan de ES verder duwen dan de kale delay terwijl de backward-doorgifte alleen de kale delay terugrekent — float-nuance op elapsed-delay-op-WORKTIME-taken, geen datumeffect.
> - Z11: `nextBandStartStrictAfter` veronderstelt per-dag gesorteerde banden (pre-existing engine-invariant, geobserveerd bij de omgekeerde-bandvolgorde-probe).
> - Z9b: manual taken zijn in de default-modus per constructie kritiek (tf=0 door de backward-early-return ≤ drempel) — een volledig handmatig gepland project rendert 100% kritiek. Gepind in msp-56/57. **Z16 mag dus níét schrijven dat manual taken "gewoon float tonen"**; benoem het gedrag zoals het is of registreer een latere verfijning. *(Z16-review: gehaald — de gids beschrijft het gedrag exact zo.)*
> - Z16-review (sonnet): `tests/planning/check-mpp-import.ts` bevat ~33 letterlijke bedrijfsbestandsnamen uit het corpus — pre-existing (T12/T5-tijdperk), in strijd met de hash-only-regel van §8. Vóór de Z20-eindpoort omzetten naar hash-identificatie.
> - Z13-hercheck R1: de B7-gating in `subDuration` (ES-uit-`earlyDates`-verificatie) is mutatie-onbewaakt — weghalen laat de suite groen. Kant-en-klare case uit de review: wortel-taak, start band-eind ma 16:00, dur 24u, kalender 08–16 ma–vr, SNET wo → es/ls wo 08:00, tf 0; zonder gating wordt ls 16:00. Case toevoegen (of de docblok-claim verzwakken) vóór Z20.
> - Z13-hercheck R2: de float-spiegel is compleet voor hele-dag-duren maar niet voor deeldagen (12u-taak op 8u-dag: tf 1.5 waar LF−EF 2.5 is — één werkdag te weinig, zelfde klasse als B3). Intrinsiek aan de voorwaartse regel; structurele plek is de float-laag (`scheduleAnalysis.computeScheduleResults` corrigeert formule-invoer al voor hammock/manual — zelfde behandeling voor gedegenereerde band-eind-ankers: tf volgt finishFloat). Corpusincidentie 0, wel app-zichtbaar bij een taakstart op het einde van de werkdag. NB: het Z13-fixronde-commitbericht claimt "altijd" — te sterk; het code-docblok scopet correct.
> - Z13-hercheck R3 (observatie): `isExactBandEnd`/`dayFirstBandStart`/`dayLastBandEnd` leunen op de engine-brede oplopend-gesorteerde-banden-aanname (`effectiveBandsOn` sorteert niet) — zelfde pre-existing invariant als de Z11-observatie hierboven; Z13 staat er nu ook op.
> - Z19-L (bewuste afweging, geregistreerd voor de taaktypes-etappe): de holiday-bewuste laag-4-poort activeert ook Task Seven/Eight in de twee mpp14timephasedsegments*-fixtures — principieel juist (toewijzingswerk wandelt op de resourcekalender, MSP-semantiek), byte-identiek bij de opgeslagen duur, maar bij een ANDERE duur divergeert de finish daar 1–2 dagen en dat is met het huidige harnas onverifieerbaar: bewerkgedrag-fidelity heeft geen meetlat (de "bewerken-meetlat" uit de taaktypes-spec). Gepind op state-niveau (sourceScheduleNotes + activering) zodat verdere verschuivingen zichtbaar zijn.

- [ ] **`GOAL_ZERO_DEVIATIONS` aan** in `tests/planning/check-mpp-fidelity.ts`: een extra, harde poort die faalt zodra (i) een gepind bestand een niet-nul `startDiff`/`startSameday`/`finishDiff`/`finishSameday` heeft, of (ii) er ergens nog een `reason`-sleutel in de baseline staat. Het bestaande `assertPinnedDiffsHaveReason`-mechanisme blijft **staan** (het is de wacht tijdens de etappe) maar wordt door de nieuwe poort overvleugeld: met nul afwijkingen is er niets meer te verantwoorden, en een teruggezette reden-pin maakt de suite rood.
  **Acceptatie (mutatie-bewijs, verplicht):** zet één teller in de baseline op 1 → ROOD op de nieuwe poort; voeg een `reason` toe aan een schone pin → ROOD; herstel → groen.
- [ ] `npm run verify` groen (exitcode).
- [ ] `docs/TODO.md`: de twee openstaande MPP-items (contouring-detectiegrens, TASK_MODE-hypothese) afvinken met verwijzing naar de taak die ze oploste; nieuwe items registreren voor wat bewust bleef liggen (native MSPDI `<Manual>`/`<LevelingDelay>`/`<TimephasedData>`, splits als bewerkfunctie).
- [ ] `docs/CHANGELOG.md` **niet** aanraken (alleen tijdens een release, zie de `release`-skill).
- [ ] MPXJ-/ProjectLibre-herkomstvermelding in élk nieuw of gewijzigd bestand (§9).
- [ ] Hyperkritische eindreview (Opus) op de volledige diff van de etappe.

---

## 5. Parallelliseringsschema en worktree-toewijzing

```
                     Z0  (serieel — typen, harness, compile-poorten)
                      │
   ┌──────────────────┼───────────────────┬────────────────────────┐
BAAN M             BAAN L              BAAN S                  BAAN D
  Z1                Z2 ─┐              Z10  Z11  Z12            Z14
  (meetlat,         Z3 ─┴→ Z4          (corpusloos, meteen)     Z15
   eerst!)          Z5                          │               Z16
   │                 │                          │
   └────────┬────────┘                          │
            ▼                                   │
      Z6  (leveling)      ◄── Z5                │
      Z7  (splits in CPM) ◄── Z4                │
      Z8  (timephased)    ◄── Z3                │
      Z9a → Z9b           ◄── Z1 + Z2           │
      Z13                 ◄── Z9a               │
            │                                   │
   ═══════════ SYNC: Z17 integratie + hermeting ═══════════
                      │
              Z18 gebruikstest (aparte agent, browser)
                      │
              Z19 residu → nul  →  Z20 eindpoort + eindreview
```

**Let op:** Z6–Z9/Z13 staan hierboven onder baan S maar hangen aan baan L's resultaten. Ze draaien dus in de S-worktree **nadat** de betreffende L-taak gemerged is. Baan S kan intussen ononderbroken doorwerken aan Z10/Z11/Z12 — die drie hebben geen enkele leesfeature nodig.

### Eigen git-worktree per baan (les uit etappe 1: index-races)

| baan | worktree | branch |
|---|---|---|
| M | `.claude/worktrees/mpp-nul-meetlat` | `claude/mpp-nul-meetlat` |
| L | `.claude/worktrees/mpp-nul-lezer` | `claude/mpp-nul-lezer` |
| S | `.claude/worktrees/mpp-nul-motor` | `claude/mpp-nul-motor` |
| D | `.claude/worktrees/mpp-nul-data` | `claude/mpp-nul-data` |

Eén taak tegelijk per baan. Elke worktree krijgt bij aanmaak de eigen dev-poort van `scripts/dev-port.mjs` — dat is al geregeld, maar noem het in de implementer-prompt zodat niemand 3007 aanneemt.

### Strikt disjuncte bestandseigendom

| baan | exclusief eigendom |
|---|---|
| **M** | `tests/planning/mppGroundTruth.ts`, `mppFidelity.ts`, `check-mpp-fidelity.ts`, `mpp-fidelity-baseline.json`, `tests/planning/run.sh` |
| **L** | `src/services/mpp/**` (`mppReader.ts`, `fieldMap14.ts`, `mppEntities.ts`, `mppTimephased.ts` (nieuw), `limits.ts`, `mppPrimitives.ts`), `src/services/importTypes.ts`, `tests/planning/check-mpp-import.ts`, `check-mpp-calendars.ts`, `check-mpp-relations.ts`, `tests/planning/mppFixtures.ts` |
| **S** | `src/engine/scheduler/**` (`CPMSolver.ts`, `relationMath.ts`, `duration.ts`, `scheduleAnalysis.ts`, `applyCpmResult.ts`, `solveProject.ts`), `tests/planning/cases-*.json`, `tests/planning/harness.ts` (ná Z0), `check-advanced-cpm.ts` |
| **D** | `src/types/**` (ná Z0), `src/services/ifc/**`, `src/engine/moveProject.ts`, `src/engine/renderer/**`, `src/services/print/**`, `src/services/pdf/**`, `src/services/msproject/**`, `src/services/p6/**`, `src/services/csv/**`, `src/extensions/**`, `src/services/mcp/tools/taskFields.ts`, `src/state/slices/fileSlice.ts`, `src/i18n/locales/**`, `public/docs/**`, `check-ifc-roundtrip.ts`, `check-notifications.ts`, `check-split-bar-render.ts` (nieuw) |

**Drie bekende raakvlakken, expliciet geregeld.**
1. `src/types/task.ts` + `src/types/resource.ts` + `tests/planning/harness.ts` — **allemaal in Z0, serieel, vóór de banen splitsen.** Daarna is `src/types/**` eigendom van D en `harness.ts` van S. Blijkt tijdens de etappe dat er een veld bij moet, dan gaat dat via een **korte seriële mini-Z0** (orkestrator merget eerst, banen rebasen), nooit via twee banen tegelijk.
2. `mppFixtures.ts` (baan L) wordt door M's Z1 gebruikt voor de synthetische MPP14-fixture. Regel: **M consumeert, L bezit.** Heeft M een uitbreiding nodig, dan levert L die als eigen mini-taak; M wacht.
3. `limits.ts` hoort bij L. Heeft S of D een klem nodig, dan komt die tijdelijk lokaal en verhuist bij Z17.

### Merge-volgorde door de orkestrator

1. **Z0** (serieel, iedereen rebaset erop).
2. **Z1** (baan M) — vóór élke motorwijziging die manual-taken raakt. Introduceert mogelijk tijdelijke `reason`-pins; die zijn expliciet toegestaan en verdwijnen bij Z9a.
3. **Z2 → Z3 → Z4 → Z5** (baan L), elk apart gemerged zodra groen. Na elke merge rebaset baan S.
4. **Z6 … Z13** (baan S), één voor één; motorwijzigingen nooit twee tegelijk in dezelfde merge — een dubbele merge maakt attributie van een fidelity-delta onmogelijk.
5. **Z14 → Z15 → Z16** (baan D). Z14 vóór Z17, anders gaat geïmporteerde data bij de eerste Ctrl+S verloren.
6. **Z17 → Z18 → Z19 → Z20**, serieel.

**Regel bij elke merge:** de orkestrator draait `check-mpp-fidelity` vóór én ná, en noteert de delta in het merge-commitbericht. Twee banen in één merge = geen attributie = een verboden zet.

---

## 6. Risico's en terugvalopties — en het escalatiepad wanneer nul niet gehaald wordt

**Het escalatiepad, hard geformuleerd.** De goal staat geen `reason`-pins toe. Wijkt een corpusbestand ná een correcte implementatie tóch af, dan is de volgorde:

1. **Dieper meten.** `OPS_MPP_FIDELITY_REPORT=detail`, op **bladniveau** classificeren (een afwijkende verzameltaak is een rollup, bijna nooit de oorzaak). Isoleer met een whatif-schakelaar welke motorregel het veroorzaakt — dat instrument is beproefd (T7's `NO_PSD`, B1's dataDate-schakelaar leverde alsnog het byte-bewijs waar de eerste diagnose acht jaar naast zat).
2. **Corpusloos reproduceren.** Bouw het scenario na als synthetische case. Reproduceert die het symptoom, dan is het gewone debugging. Reproduceert die het níét, dan zit de oorzaak in de interactie en breid je de case stapsgewijs uit tot ze wél reproduceert — dát is de diagnose.
3. **Byte-bewijs voor de bron.** Blijft het verschil bestaan terwijl onze reconstructie aantoonbaar MSP-getrouw is, dan is de **bron** verdacht: is het bestand wel door MS Project zelf geschreven en herberekend? Dat is met bytes te controleren (applicationVersion, writer-signatuur, of een taak waarvan de opgeslagen datums intern inconsistent zijn met haar eigen duur/kalender). **Zonder zulk byte-bewijs is dit geen geldige uitkomst** — "het bestand zal wel raar zijn" is precies de smoes die deze etappe uitsluit.
4. **Escaleren naar de orkestrator, met de meting.** Alleen die kan (na eigenaarsakkoord) besluiten een bestand uit de meting te halen — en dan als expliciet gemarkeerde **uitsluiting met byte-onderbouwing**, in een eigen sectie, niet als `reason`-pin op een afwijking. Zo'n uitsluiting is een zichtbaar, telbaar feit; een reden-pin is dat niet.

**Wat nooit mag:** een teller ophogen "omdat het nu eenmaal zo uitkomt"; een bestaande case-verwachting aanpassen om een nieuwe regel groen te krijgen (wijzigt er één, dan is dát het te motiveren feit); een `>=`-pin; een som in plaats van per-veld.

**Per werkstroom: risico en terugval.**

| werkstroom | grootste risico | terugval als het vastloopt |
|---|---|---|
| Z2 Fixed2-infra | block-1-offsets tegen de verkeerde recordlayout lezen (het I3-scenario: stil verkeerde waarden, geen fout) | alles-of-niets-terugval strikt aanhouden; ontbreekt de field-map-entry, lees dan **niets** in plaats van de default te mengen |
| Z3 timephased-decoder | nieuw byte-formaat, eenheden (1000sten min / 10000sten uur / 80sten min) door elkaar | corpusloze fixtures met handberekende verwachtingen zijn hier de enige echte wacht; bij twijfel: eerst de decoder tegen een publiek MPXJ-fixture waarvan de MSPDI-XML-tegenhanger de waarden noemt |
| Z4/Z7 splits | de opslagvorm (offsets vs. absoluut) reproduceert de datums niet | vormbeslissing terug naar de orkestrator mét meting; **niet** in de solver wegcompenseren |
| Z6 leveling | backward-spiegel breekt bestaande float-cases | de uur-precisie kan zelfstandig landen; de backward-spiegel is een eigen commit met eigen bewijs |
| Z8 timephased-venster | de "max over toewijzingen"-regel blijkt niet MSP's regel | 11 corpusbestanden zijn genoeg om de echte regel te bepalen — meet vóór je implementeert |
| Z9a/b manual | nieuwe planningsmodus lekt naar auto-taken | `manuallyScheduled` afwezig ⇒ byte-identiek is de harde eis; bewijs met de volledige bestaande suite zonder één aangepaste verwachting |
| Z10 SF | gedeelde relatiewiskunde, alle relatietypes | corpusloze reproductie eerst; lukt die niet, dan is de diagnose nog niet af en mag er geen regel bij |
| Z11 kruis-kalender | discriminator die één van beide kanten breekt | **twee** mutatiebewijzen verplicht (elke vaste keuze breekt precies één kant) |
| Z12 out-of-sequence | derde formule blijft onvindbaar | opt-in-vlag houdt de bestaande P6-semantiek intact; blijft de formule onvindbaar ⇒ escaleren volgens de vier stappen hierboven, niet pinnen |
| Z13 rauw anker | raakt élke wortel-taak | eerst meten of Z9a het al oploste; zo niet, corpusbreed meten vóór een regel |
| Z14/Z15 round-trip & render | stil dataverlies bij export; `ifcTaskSlots` per ongeluk aanraken | compile-poorten (`Required<>`-fixtures, `TASK_VERDICTS`) doen het meeste werk; de niet-afgedwongen randen (CSV, extensies, MCP) staan als checklist in Z14 |
| Z16 gidsen | claims die niemand naverteld heeft | verificatieregel: elke planningsclaim krijgt een code-/testverwijzing, anders schrappen |

**Procesrisico's.**
- **Meetlat-verschuiving (Z1).** Kan bestanden die vandaag exact zijn tijdelijk laten afwijken. Ingecalculeerd, tijdelijk `reason`-gepind, verdwijnt bij Z9a. Als het ná Z9a niet verdwijnt, is Z1's veldkeuze zelf verdacht — dán opnieuw meten, niet de motor bijbuigen.
- **Twee banen in één merge.** Maakt attributie onmogelijk. Structureel verboden (§5).
- **Rollup-valkuil.** Al twee keer toegeslagen in de vorige etappe (T13's "Delivery Plan", T9's "Technical Specification"). Elke diagnose begint met `childIds.length === 0`.
- **Stille testcases.** Een JSON-case met een veld dat `harness.ts` niet doorgeeft test niets. Z0 dicht dat structureel met `TASK_KEYS`.

---

## 7. Modeltoewijzing

| rol | model | waarom |
|---|---|---|
| implementers (alle Z-taken) | **Sonnet** | uitvoerend werk met scherpe specificatie en harde poorten |
| kwaliteitsreview Z1, Z2, Z3, Z4, Z6, Z7, Z8, Z9a, Z9b, Z10, Z11, Z12, Z13 + eindreview Z20 | **Opus** | meetlat, byte-parsing, en alles wat de solver raakt — de grootste blast radius |
| mechanische spec-review Z0, Z5, Z14, Z15, Z16 | **Sonnet** | contract-/volledigheidscontrole tegen dit plan |
| gebruikstest Z18 | **Sonnet** (aparte agent, browser) | scenario-uitvoering |
| **nooit** | **Fable** | — |

De modelnaam hoort in de agentnaam (`sonnet-z7-splits-cpm`, `opus-review-z7`) én in de rapportage.

---

## 8. Hardening-checklist — kopieer dit blok ONGEWIJZIGD in élke implementer-prompt

- [ ] **Geen allocaties of lussen uit ongevalideerde bestandswaarden.** Elke telling/lengte/offset uit het bestand wordt geklemd vóór gebruik; de klem staat in `src/services/mpp/limits.ts` met een **meetcommentaar** erbij (wat is de gemeten corpuswaarde, waarom is deze bovengrens ruim, wat kost het ergste geval zonder klem). Dit geldt nadrukkelijk óók voor de nieuwe recordcounts in de timephased-blokken en de Fixed2-itemgroottes.
- [ ] **Strings gechunkt en begrensd.** Geen `String.fromCharCode(...bigArray)`; hergebruik `mppPrimitives.getUnicodeString` en `MAX_VAR_TEXT_BYTES`.
- [ ] **Geen module-level muteerbare singletons.** Caches horen aan een instantie of aan een expliciet meegegeven context (patroon: de `HolidayBudget`-factory in `mppCalendars.ts`).
- [ ] **Elke nieuwe `try`/`catch`-wrapper krijgt een eigen rode-pad-fixture** die aantoonbaar door die `catch` gaat — een `catch` zonder test is een stille faalmodus.
- [ ] **Fixtures schrijf je nooit naar de implementatie toe.** Bouw de verwachting uit de specificatie/de MPXJ-bron/de MS Project-uitvoer, niet uit wat de code nu toevallig oplevert. Moet een bestaande verwachting wijzigen, dan is dát het te motiveren feit.
- [ ] **Testcommentaren claimen alleen wat mutatie-bewezen is.** Schrijf je "vangt X", dan heb je X daadwerkelijk gemuteerd en de test rood gezien. Anders formuleer je het zwakker.
- [ ] **Binaire testdata nooit door `TextEncoder`.** Bouw `Uint8Array`/`DataView` direct; `TextEncoder` maakt van elke byte ≥ 0x80 stil twee bytes.
- [ ] **Synthetische, corpusloze fixture naast elke corpuspin.** `tests/planning/mppFixtures.ts` bouwt volledige CFB/MPP-structuren — een byte-lezer zonder corpusloze fixture is niet af, want in CI draait er dan niets.
- [ ] **Exitcode is de poort, nooit de tail-uitvoer.** De planningssuite print "alles groen" ook bij exit 1 als het bundelen faalt. `grep -c '^XX'` werkt alleen voor `tests/planning/`; de bibliotheeksuite print ingesprongen.
- [ ] **Byte-identiek waar niets zou mogen wijzigen.** Een nieuw optioneel veld dat afwezig is ⇒ exact hetzelfde gedrag als daarvoor; bewijs dat met de bestaande suite **zónder aangepaste verwachtingen**.
- [ ] **Nooit corpusbestanden of hun inhoud committen** (bedrijfsdata/licentie). Ook geen fragmenten in commitberichten, testcommentaren of foutmeldingen; bedrijfsbestanden identificeer je uitsluitend met hun hash. `OPS_MPP_FIDELITY_REPORT=detail`-uitvoer over corpusbestanden hoort nooit in een commit, PR of log.
- [ ] **Diagnose begint op bladniveau** (`childIds.length === 0`). Een afwijkende verzameltaak is een rollup van haar kinderen — twee keer eerder een verkeerde diagnose veroorzaakt.
- [ ] **Herkomstvermelding.** Elk nieuw of ingrijpend gewijzigd bestand met MPXJ-/ProjectLibre-afgeleide veldkennis draagt de vermelding uit §9.

---

## 9. Referenties en herkomstregels

**MPXJ** — `https://github.com/joniles/mpxj`, © Jon Iles e.a., **LGPL-2.1**. Lokale kopie onder de crawl-wortel (`voor claude/testdata-crawl/mpxj/`). Gebruikt als **formaatdocumentatie**: veld-id's, bit-posities, blokstructuren, decodeer-eenheden. Vindplaatsen die dit plan aanhaalt (verifieer op inhoud, niet op regelnummer): `MPP14Reader.java` (TASK_MODE-bit-flags in `Fixed2Meta`, offset 8, masker 0x08 (2010) / 0x80 (2013/2016); de `SCHEDULED_*`-vs-`START/FINISH`-overschrijfregel), `FieldMap14.java` (block 1: START 1283/offset 50, FINISH 1284/offset 54, MANUAL_DURATION 1288/offset 58, MANUAL_DURATION_UNITS 1289/offset 62), `TimephasedDataFactory.java` + `ResourceAssignmentFactory.java` (timephased in `Var2Data` van `TBkndAssn`), `ResourceAssignment.java` `getWorkSplits()` (splits afgeleid uit timephased werk), `MPPUtility.java` (`getDuration`: "Value is given in 1/10 of minute").

**ProjectLibre / OpenProj** — preservatie-mirror `OldRepoPreservation/projectlibre`, commit `0cac2742b5b9a2593a557f7fc4a7a0a912f6cc17` (2015-08-25), **CPAL 1.0** (niet CPL). Gebruikt als **semantiekreferentie** voor de rekenmotor: `openproj_core/.../criticalpath/TaskSchedule.java` (volgorde dependency → constraint → leveling delay → actualStart-override), `assignment/Assignment.java` (splits als contour-gat, `stop`/`resume`, restwerk-berekening), `dependency/Dependency.java` (SF-tak, "lag altijd in de voorganger-kalender"), `task/NormalTask.java` (`calcOffsetFrom`: max over toewijzingen bepaalt de taakfinish).
**Waardering per punt, expliciet:**
- *bruikbaar als hypothese*: leveling-delay-volgorde, timephased/contour bepaalt taakdatums, retained-logic-gedrag.
- *zwak*: splits — de eigen bron draagt een `//TODO integrate split - still needed?` in precies de centrale offsetberekening, en het model kent maar één stop/resume-paar terwijl MSP er meerdere kent.
- *onbruikbaar*: handmatig geplande taken — ProjectLibre ondersteunt ze **niet**; `TaskMode` wordt door de meegebundelde MPXJ wél geparsed maar niet doorgegeven aan de eigen engine. Elk MPP-bestand met manual taken wordt daar stilzwijgend als auto behandeld. Werkstroom 4 moet dus volledig uit MSP-gedrag en het corpus komen.
- *niet aan MSP getoetst*: kruis-kalender-lag en SF-forward — beide interne conventies zonder MSP-verificatie.

**Harde regels, voor beide bronnen.**
1. **Nooit code overnemen** — lezen om te begrijpen, dan zelfstandig in TypeScript herimplementeren. CPAL mengt niet met LGPL-3.0; LGPL-2.1-code kopiëren evenmin.
2. **Nooit letterlijke fragmenten** in commentaar, commitberichten of dit soort documenten — samenvattingen in eigen woorden, met bestandspad + symboolnaam als bronverwijzing.
3. **Herkomstvermelding** in elk bestand dat op afgeleide formaat-/semantiekkennis leunt, volgens het bestaande patroon in `mppReader.ts`/`calendarRecurrence.ts`/`mppGroundTruth.ts`: volledige koptekst voor het ongedocumenteerde MPP-binairformaat, gerichte inline-verwijzingen voor de publieke XML-schema's.
4. **Corpus-datums zijn het orakel.** Waar een referentie en het corpus elkaar tegenspreken, wint het corpus — en dan wordt de referentie in het commentaar als *weerlegd* geregistreerd, niet stilzwijgend genegeerd. (Precedent: de "tienduizendsten van een minuut"-hypothese uit de vorige planronde is met MPXJ's eigen bron weerlegd; die weerlegging staat nu in Z5.)

---

## 10. Openstaande vragen voor de orkestrator

- **O1 — Uitsluiting als allerlaatste redmiddel.** §6 stap 4 laat toe dat een corpusbestand met byte-onderbouwing en eigenaarsakkoord uit de meting gehaald wordt. Is dat aanvaardbaar als vangnet, of geldt "nul, punt uit" ook dan (en wordt de etappe in dat geval niet afgesloten tot het bestand klopt)?
- **O2 — Bewerk-UI voor splits.** Dit plan levert lezen/rekenen/tekenen/round-trip, maar geen bewerken (splitsen via slepen, split ongedaan maken). Akkoord dat dat een aparte etappe is, ook al kan een gebruiker een geïmporteerde split dan wel zien maar niet wijzigen?
- **O3 — Manual scheduling voor niet-`.mpp`-bronnen.** `manuallyScheduled` wordt een gewoon taakveld en round-tript door IFC. Daarmee kán een gebruiker het straks ook op een handmatig gemaakt project zetten (via extensie/MCP/IFC), terwijl er nog geen UI voor is. Bewust toestaan (en later een UI erbij), of deze etappe afschermen tot `.mpp`-import?
- **O4 — Native MSPDI-export.** MSPDI kent `<Manual>`, `<LevelingDelay>`, `<TimephasedData>`. Dit plan kiest voor **warnen** (het `ELAPSEDTIME`-precedent: native schrijven zonder terug te lezen is een stille semantiek-omklap). Akkoord, of moet MSPDI-lezen+schrijven van deze drie alsnog in deze etappe?
- **O5 — `barSplitMode`.** Z15 stelt voor dat echte splits **altijd** gesplitst tekenen, ongeacht de weergave-instelling (die blijft alleen de kalender-necking sturen). Akkoord?
- **O6 — Reikwijdte van Z12's fix.** Opt-in-vlag (`.mpp`-only, familie T9/B1) of universele correctie (familie O8/O9)? Dit plan stelt opt-in voor omdat de bestaande P6-RETAINED_LOGIC-semantiek een bewuste keuze is.

### Aandachtspunten voor etappe 2 (XER/P6) — vastgelegd 2026-08-18, op eigenaarsverzoek

Deze etappe maakte drie soorten wijzigingen met verschillende draagwijdte; de derde soort moet bij
de start van de XER-etappe expliciet op de agenda:

1. **Opt-in-vlaggen** (`unstartedIgnoresStatusDate`, `resumeFromActualElapsed`) — uitsluitend door
   `mppReader.ts` gezet, default uit. Veilig voor andere bronnen; patroon herbruikbaar.
2. **Veldgedreven gedrag** (splitGaps, levelingDelayMinutes, resume/stop, manuallyScheduled,
   timephased) — afwezig veld ⇒ byte-identiek. MAAR: **veld-aanwezigheid ís hier het
   semantiek-signaal** ("taak heeft resume ⇒ MSP-hervattingsconventie"). Zodra de XER-lezer
   dezelfde velden gaat vullen met P6-betekenis, erft hij stilzwijgend MSP-gedrag. Regel voor
   etappe 2: elke nieuwe lezer kiest per veld bewust of hij het zet, en elke afwijkende semantiek
   wordt een bron-vlag — nooit stil hetzelfde veld met andere betekenis.
3. **Universele semantiekwijzigingen op MSP als enige geverifieerde orakel**: de SF-ankerregel
   (Z10), de kruis-kalender-FS-discriminator (Z11), de leveling-backward-doorgifte (Z6) en de
   kalenderpromotie-fix. De oude gedragingen waren nergens tegen geverifieerd, dus dit was de
   juiste keuze — maar P6 heeft op precies deze punten aantoonbaar eigen semantiek (de
   lag-kalender is in P6 een projectínstelling: voorganger/opvolger/project/24-uurs; retained
   logic vs. progress override is er een expliciete rekenoptie). Verwacht dat het XER-corpus
   sommige van deze universele regels alsnog naar een bron-instelling dwingt; plan die
   flag-isatie in als kandidaat-taak, niet als verrassing.

Daarnaast geldt: "lezen wint van herrekenen" (timephased laag 3) is een gedocumenteerd functioneel
gat — import is exact, maar ná een gebruikersbewerking valt een gecontourde taak terug op vlakke
berekening omdat OPS geen contour-engine heeft. Voor P6 speelt hetzelfde t.z.t. met resource-curves,
zij het lichter (curves sturen daar vooral de resourceverdeling, minder de activiteitsdatums).

**Eigenaarsbesluit 2026-08-18 — task types / effort-driven:**
1. **Nataak in deze of direct na deze etappe (klein, alleen data):** MSP's task-type- en
   effort-driven-velden bij .mpp-import lezen en bewaren (Task-velden + OPS-pset-round-trip,
   géén rekengedrag) — zodat de data niet weggegooid wordt. Zelfde stramien als de andere
   leestaken: veld-id's uit de MPXJ-referentie, corpusloze fixtures, byte-identiek bij afwezig veld.
2. **Aparte sessie/etappe (niet hier):** opgeslagen werk als eerste-klas grootheid, task type als
   projecteigenschap-met-per-taak-keuze, een bewerken-zoals-MSP-meetlat, en de contour-engine —
   inclusief de UX-vraag hoe je toont welke hoek vastligt zonder MSP's verwarring te importeren.
   De eigenaar wil default het huidige gedrag (bouwdefault) houden en dit opt-in ontsluiten;
   semantiek hoort dan in het document, niet in een app-instelling.

### Orkestratorbesluiten op O1–O6 (2026-08-17)

- **O1 — besloten: werkhouding "nul, punt uit".** De §6-stap-4-uitsluiting wordt níét vooraf als vangnet geautoriseerd. Doet het geval zich voor (correcte implementatie + byte-bewijs dat de bron zelf inconsistent is), dan gaat het als expliciet beslispunt naar de eigenaar op dat moment, mét de meting. Tot die tijd geldt: de etappe is niet af zolang er een niet-nul-teller bestaat.
- **O2 — besloten: akkoord.** Bewerk-UI voor splits (slepen, split-handles, split ongedaan maken) is een aparte etappe. Deze etappe levert lezen + rekenen + tekenen + round-trip; de goal-tekst eist niet meer dan dat.
- **O3 — besloten: bewust toestaan.** `manuallyScheduled` wordt een gewoon taakveld (zoals `isHammock`/`levelingDelay`): zetbaar via IFC/extensie, round-tript altijd. Geen kunstmatige `.mpp`-afscherming — dat zou een tweede klasse taakvelden introduceren. De MCP-kant volgt Z14's allowlist-besluit (leesbaar; zetbaarheid conform het bestaande `isHammock`-patroon). UI voor handmatig plannen is een latere etappe; de gids benoemt dat de vlag bij import ontstaat.
- **O4 — besloten: akkoord, warnen.** Native MSPDI-`<Manual>`/`<LevelingDelay>`/`<TimephasedData>` schrijven zonder ze terug te lezen is de stille semantiek-omklap die het `ELAPSEDTIME`-precedent verbiedt. Warn + TODO-registratie in Z20; native lezen+schrijven is een eigen (kleine) vervolg-etappe.
- **O5 — besloten: akkoord.** Echte splits (`splitGaps`) tekenen áltijd gesplitst; `barSplitMode` blijft uitsluitend de kalender-necking sturen. Een werkonderbreking is data, geen weergavevoorkeur.
- **O6 — besloten: opt-in-vlag.** Zelfde familie als `resumeFromActualElapsed`/`unstartedIgnoresStatusDate`: default false ⇒ byte-identiek, uitsluitend gezet door `mppReader.ts`, met MSPDI-warn en een test die de default bewaakt. De P6-RETAINED_LOGIC-semantiek van `cases-progress.json` blijft ongewijzigd.

