# Hyperkritische review PR #167 — "Datums zoals opgeslagen" voor alle formaten (v2)

Reviewer: Claude **Fable 5.1** (subagent, skill `hyperkritische-review`), 2026-09-24.
Onderwerp: branch `claude/recorded-all-formats-v2` op `eda674a9`, diff tegen de #109-basis
`origin/claude/file-formats-support-phase-3-a0ebe2` (`0a29147c`). Eigen detached worktree, weer verwijderd.

## In gewone mensentaal

Het bouwwerk zelf staat: alle gerichte checks zijn groen, de `.mpp`-datumpoort is exact 0 verbeterd / 0
verslechterd / 216 ongewijzigd, de bak-4-scheiding is bewezen op 249 corpusbestanden, en zeven mutaties
die ik zelf in de code stopte werden allemaal door de tests gepakt. Maar op precies de route die deze PR
adverteert — importeren, opslaan terwijl de weergave aanstaat, later heropenen — liegt het heropende
bestand: de vier assen die het bronbestand nooit vastlegde (late datums, speling, kritiek) komen terug als
"zo stond het in het bestand", en de melding "N taken tonen de datums zoals ze in het bestand staan" gaat
ook af bij het heropenen van je eigen projectbestand, wat de PR-tekst juist zegt te hebben afgeschaft.
Daarnaast is er één ontwerpvraag voor de eigenaar (CSV vergelijkt invoer met invoer) en één harde
merge-instructie richting #169. Oordeel: **LANDEN-MET-FIXES** — twee fixes verplicht vóór de merge.

## Wat ik zelf gedraaid heb

- `check-recorded-dates` 330 groen · `check-recorded-dates-mark` 56 · `check-recorded-times-formats` 218
  (met crawl: 658 `.mpp`, 213 leesbaar, 3013/3013 taken vastgelegd, 0 × vroege start ≠ geplande start,
  0/68 voltooid-en-kritiek) · `check-document-contract` 272 · `check-xer-recorded-roundtrip` 68 (zonder
  XER-corpus) · `check-ifc-roundtrip` 213 · `check-recorded-bak4-differential` 25 (249/249 byte-identiek)
  · **`check-mpp-fidelity` 2196 groen, `GOAL_ZERO_DEVIATIONS`: 0 verbeterd, 0 verslechterd, 216 ongewijzigd.**
  Alle exitcodes 0.
- Mutatieproeven (elk apart, bestand daarna hersteld): M2 `isOpsAuthoredIfc` altijd false ⇒ 12 rood
  (4c/4d/4g/4h/4i/4j, 16c/16d/16k, 18c/18d/18e) · M3 `markDocumentEdited` wist de vlag niet ⇒ 9 + 3 rood ·
  M4 `nonEdit` genegeerd ⇒ 5 rood (16q/16r/16t/16w/16x) · M7 aanbod-melding niet op verse import gefilterd
  ⇒ 18e rood · M8 pristine-poort weg uit `applyRecordedDatesOnLoad` ⇒ 7ag/7aj6/18d/18e rood · M5
  voltooid-nooit-kritiek weg ⇒ 5e rood (68/68) · M9 `.F.` leest als true ⇒ 4h rood. **Geen enkele mutatie
  overleefde.**
- Eigen headless bewijsscript (esbuild-bundel, tijdelijk in `tests/planning/`, daarna verwijderd) voor de
  bevindingen 1, 2, 4 en 6 hieronder.
- MPXJ-bron gecontroleerd via sparse clone van `joniles/mpxj@master` (FieldMap14, Task.calculateCritical,
  MicrosoftSlackCalculator, ProjectPropertiesReader).
- Proefmerge (`git merge --no-commit`, daarna `--abort`) tegen `origin/claude/rekenprofielen` (`fe5683c6`).

## Bevindingen, ergste bovenaan

### 1. [BEVESTIGD] Opslaan ín de modus + heropenen fabriceert vier assen die het bronbestand nooit gaf

Dit is de route waar optie B om draait (gids: "sla je op terwijl deze weergave aanstaat, dan staan de
oorspronkelijke datums in je projectbestand" en "wat het bestand niet vastlegde, blijft *Niet vastgelegd*").
Gemeten met de MSPDI-fixture uit `tests/fixtures/recordedTimesFormats.ts` (taak B draagt alleen het vroege
paar):

```
P1b B vastlegging (verse import): {"start":"2026-03-16","finish":"2026-03-20"}   unrecordedAxes ["ls","lf","tf","ff"]
P1c B task.time in de modus:      {"ls":"2026-03-16","tf":0,"crit":false}
     → writeIFC(buildWriteIFCInput(S())) → readIFC → applyOpenedImport
P1e B vastlegging (heropend):     {"start":"2026-03-16","finish":"2026-03-20","lateStart":"2026-03-16",
                                   "lateFinish":"2026-03-20","totalFloat":0,"freeFloat":0,"isCritical":false}
                                  unrecordedAxes []
P1f B recordedFields (heropend):  ["earlyStart","earlyFinish","lateStart","lateFinish","freeFloat","totalFloat","isCritical","scheduleStart","scheduleFinish"]
```

Oorzaak: `applyRecordedTimesToTasks` (`src/engine/scheduler/recordedDates.ts:418-424`) vult de ontbrekende
assen op `task.time` met terugvallen (`rec.lateStart ?? rec.start`, `?? 0`, `?? false`); `ifcWriter.ts`
schrijft `task.time.*` onvoorwaardelijk (geen `datesAsRecorded`/`unrecorded`-kennis — `grep` op
`unrecorded` in de writer: nul treffers); bij heropenen registreert `recordedFields` alle negen slots als
aanwezig en neemt `captureRecordedDates` laag 1 ze als echte vastlegging. Gevolg in het product: de
"Niet vastgelegd"-markeringen zijn weg, de export-poort (`unrecordedExportGate`) laat de kolommen door,
en het scherm zegt "speling 0, niet kritiek — zoals opgeslagen" over iets wat MS Project/P6/CSV nooit
zei. Voor XER speelt dit niet (het archief levert bak 4 opnieuw), voor P6 XML/MSPDI/`.mpp`/CSV/vreemd-IFC
wél — precies de formaten die deze PR toevoegt. De KERNREGEL bovenin `recordedDates.ts` ("nooit iets
beweren wat het bestand niet zegt") wordt hier door de eigen opslagroute gebroken.

Niet gedekt door de tests: §16 gebruikt IFC-fixtures met alle negen slots; 16d controleert alleen
`datesAsRecorded`/`origin`, niet de assen.

Fix (kleinste): geef de writer de vastlegging mee — `recordedDates` zit al in `DOCUMENT_FIELDS`; neem hem
op in `IFCSaveSource`/`IFC_SAVE_KEYS` en laat `buildWriteIFCInput` per taak de niet-vastgelegde assen
doorgeven (zelfde `unrecordedExportFields`-logica als de CSV-export), zodat de writer daar `$` schrijft
wanneer `datesAsRecorded` aanstaat. Alternatief (robuuster, groter): `recordedTimes` + herkomst als eigen
`OPS_RecordedTimes`-pset persisteren, zoals het XER-archief, zodat heropenen bak 4 letterlijk terugkrijgt.
Test erbij: MSPDI-fixture → opslaan in de modus → heropenen ⇒ `unrecordedAxes(B)` nog steeds vier assen,
en `recordedFields[B]` zonder late-/float-/critical-slots.

### 2. [BEVESTIGD] Heropenen van een eigen (ongewijzigd) IFC geeft tóch de importmelding

PR-body punt 6: "melding alleen bij verse imports". Dat geldt alleen voor de AANBOD-tak
(`freshOfferTotal`). De automatisch-aan-tak telt `datesAsRecordedShiftedTotal` ongeacht herkomst
(`src/state/slices/fileSlice.ts`, blok `if (!notice && (datesAsRecordedShiftedTotal > 0 || freshOfferTotal > 0))`):

```
P1d heropen eigen IFC: origin ifc-own, pristine true, mode true,
    NIEUWE meldingen: ['notifications.importDatesAsRecorded:{"count":1}']
```

Test 18 dekt alleen de aanbodstand; 16d loopt via `applyLoadedProject` en raakt de meldingsroute niet.
Met #169 erbij wordt het erger: daar filtert `xerImportNotice` een `xer-archive`-heropening weg
(gebruikstest B4: "een heropende IFC meldt helemaal niets"), dus `notice` is `undefined` en de
formaatneutrale melding "zoals ze in het bestand staan" gaat af op een heropend P6-archief — tegen B4 in,
en met verlies van de Primavera-formulering.

Fix: tel ook de automatisch-aan-tak alleen voor `isFreshImportOrigin(get().recordedDates?.origin)`
(een `freshShiftedTotal`), zodat een heropening nooit meldt — de strook zegt het al. Test: 16d via
`applyOpenedImport` + telling `importDatesAsRecorded*` = 0.

### 3. [BEVESTIGD] Verenigbaarheid met #169: negen conflicten, plus één semantische valkuil in de meldingspoort

Zie de aparte sectie onderaan. Kern: alle conflicten zijn tekstueel/adjacent en oplosbaar, maar de
regel `if (!notice && …)` uit #167 botst inhoudelijk met `withSchedulingProfileNotice` uit #169.

### 4. [BEVESTIGD gedrag · VERMOED als probleem, zekerheid midden] CSV en schedule-only-IFC vergelijken invoer met invoer

```
P2 CSV (alleen Start/Finish + Predecessors): mode true, shifted 1, B early 2026-03-16,
   B vastgelegd {"start":"2026-03-16","finish":"2026-03-20"}
```

De CSV-kolom `Start` is dezelfde cel waaruit `task.time.scheduleStart` gelezen wordt
(`csvReader.ts:239`) — de invoer van de gebruiker, geen rekenuitvoer van een pakket. Bij XER is bak 4
écht P6's uitvoer (`early_start_date` ≠ `target_start_date`); bij CSV bestaat dat onderscheid niet, en
"vergelijk wat er is" wordt dan "vergelijk de getypte startdatum met onze berekening ervan". Elke uit
Excel gemaakte CSV met een voorgangerskolom en datums die de logica niet volgen opent nu in de modus
(badge, "Niet vastgelegd" op vier assen, CPM-resultaat verborgen) in plaats van gewoon te rekenen.
Hetzelfde geldt voor een vreemd IFC dat alleen `ScheduleStart/Finish` draagt (laag 2 in
`captureRecordedDates`): sinds 7k gaat ook dát automatisch aan. Eigen CSV-exports zijn oké
(`csvWriter` schrijft `earlyStart || scheduleStart`).

Geen codefout; wel een eigenaarsvraag die de PR-body niet stelt. Voorstel als het niet bedoeld is: CSV
alleen als vastlegging beschouwen wanneer er een `Total Float`- of `Critical`-kolom is (bewijs van een
berekening), en de IFC-schedule-laag (laag 2) op aanbod houden — laag 1 (early-slots) mag automatisch.

### 5. [BEVESTIGD, laag] `.mpp`-totale-speling wijkt af van MPXJ als één slack-as ontbreekt

`mppTotalSlackTenths` (`src/services/mpp/mppReader.ts`): niet gestart + precies één van start-/finish-
slack `null` ⇒ de andere. MPXJ `MicrosoftSlackCalculator.calculateTotalSlack` geeft dan `null`
(gecontroleerd in de bron: `if (startSlack == null) return null; if (finishSlack == null) return null;`).
Het commentaar zegt "ongewijzigd t.o.v. ded4d8c3", het docblok claimt MPXJ te volgen — kies er één.
Corpus: alle 3013 vastgelegde taken hebben beide assen, dus het vuurt vandaag niet. Wél geverifieerd en
correct: FieldMap14-offsets (EARLY_START 0/106/37, EARLY_FINISH 0/8/38, LATE_START 0/12/39, LATE_FINISH
0/110/40, FREE_SLACK 0/24/21, START_SLACK 0/28/438, FINISH_SLACK 0/32/439; TOTAL_SLACK heeft geen entry),
`CRITICAL_SLACK_LIMIT` als `props.getInt(...)` in dagen, `calculateCritical` (werkelijk einde ⇒ false;
`totalSlack <= limiet && pct != 100 && (auto || geen tekstvelden)`), en "gestart ⇒ finish slack".
[VERMOED, laag]: MPXJ leest ook `TotalSlackCalculationType` (START_SLACK/FINISH_SLACK-modi) uit de
projecteigenschappen; de PR stelt dat een `.mpp` die instelling niet draagt — niet nagetrokken in
`ProjectPropertiesReader`.

### 6. [BEVESTIGD, laag] Samenvattingen tellen mee in "N taken" bij MSPDI/`.mpp`

```
P3 MSPDI met samenvatting 1.1 > 1.1.1: recorded ids 2, samenvatting heeft eigen vastlegging
```

MS Project schrijft `EarlyStart` ook op samenvattingen; die krijgen een eigen record, dus
`countShiftedTasks`/`total` tellen ze mee (een verschoven kind telt vaak dubbel via de ouder). XER heeft
geen TASK-rij per WBS, dus daar gebeurt dit niet — de teller in melding en strook is per formaat anders
gedefinieerd. Fix: in de MSPDI-/`.mpp`-lezer alleen bladtaken vastleggen (niet in `captureRecordedDates`,
dat zou de #63-IFC-route R1 raken).

### 7. [BEVESTIGD, laag] De handmatige modus-flow (secties 8–13) test nu alleen nog een synthetisch pad

Omdat `readIFC` altijd een herkomst zet, is twaalf keer `offerOnly()` (`recordedTimesOrigin: undefined`)
ingevoegd — een `ImportResult` dat geen enkele productlezer meer oplevert. Het echte productpad naar de
aanbodstand is nu "bewerkt eigen IFC heropenen" en wordt maar één keer (18d) geraakt, zonder de
showRecordedDates/undo-ketens erop. Geen fout, wel testschuld om te noteren.

### Wat ik nagekeken heb en in orde is

- Bak 4: differentiële test 249/249 byte-identiek; `task.time` blijft in alle vier lezers de gewone
  vulling (1e/2e/3c/3h). Geen enkele nieuwe lezer schrijft naar `Task.time` vanuit de vastlegging.
- Documentcontract: `importPristine` in `DOCUMENT_FIELDS` (`snapshot: 'none'`, `fresh: false`,
  `fromPayload ?? false`), in `IFC_SAVE_KEYS`, in `payloadFromImport`; documentwissel/sluiten via
  `capturePayload`; kopie (`duplicateDocument`) ⇒ `false`; crashherstel via `recoveryInputFromParsed` →
  `payloadFromImport` → pset uit het IFC; MCP-rollback herstelt de vlag expliciet (mcp-case groen).
- Undo: `restoreSnapshot` met `clearImportPristine`; `nonEdit` op F5-in-de-modus en `showRecordedDates`;
  vangnet `pending.edited` (16v). Alle vier scenario's gemuteerd en rood gezien.
- `scheduleStale`/`datesAsRecorded`-invariant: geen nieuw pad raakt `scheduleStale`; de §11-scan blijft
  groen; `finishMutation({stale})` verlaat de modus zoals voorheen.
- `isDirty = true`/`isDirty: true` staat alleen nog in `documentEdited.ts` plus de acht gemotiveerde
  uitzonderingen (scan 16n/16n2); #169 voegt geen nieuwe literals toe t.o.v. de basis (comm-vergelijking).
- i18n: beide sleutels in 14 locales met de juiste CLDR-vormen (ar 6, pl 4, fr/es/it/pt 3, zh/ja/ko 1);
  `isPrimaveraRecordedOrigin` neemt `p6xml` mee; de neutrale strooktekst bestaat.
- Gidsen nl+en: kloppen met het gedrag, behalve op bevinding 1 ("blijft *Niet vastgelegd*" en "de
  oorspronkelijke datums staan in je projectbestand" zijn na heropenen niet waar voor de vier assen) en
  bevinding 2 (heropenen wordt beschreven zonder melding, de code geeft er een). De twaalf overige
  locales van `gids-import-export.md` kregen een vertaalde alinea (de/ja gecontroleerd).
- `csvDateOrUndefined`: geen "vandaag", 31 februari afgewezen (3g/3i), UTC-dagtelling.

## Verenigbaarheid met #169 (`claude/rekenprofielen`, `fe5683c6`)

`git merge-tree` en een proefmerge: **9 bestanden in conflict**, allemaal tekstueel en klein:

| bestand | aard | resolutie |
|---|---|---|
| `src/services/{csv,msproject,p6}/…Reader.ts` | return-object: `recordedTimes/…Origin`-spread (#167) naast `suggestedProfileId: 'ops'` (#169) | beide regels houden |
| `src/services/mpp/mppReader.ts` | importregel `recordedDates` vs `builtInProfile` | beide imports |
| `src/services/ifc/ifcPsets.ts` | `ImportProvenance` vs `SchedulingProfile` | beide constanten |
| `src/services/ifc/ifcWriter.ts` | `writeImportProvenanceMeta`-aanroep/functie vs `writeSchedulingProfileMeta` + `legacyOptionsBlobFor` | beide; let op dat #169 de `writeSchedulingOptionsMeta`-aanroep verandert |
| `src/services/ifc/ifcReader.ts` | twee nieuwe helperfuncties (#167) vs `readSchedulingProfile`/`extractSchedulingProfile` (#169) op dezelfde plek | beide |
| `src/services/importTypes.ts` | docblok `recordedTimesOrigin` + `importPristine` (#167) vs `suggestedProfileId` + `xerOrigin` (#169) | #167's type + #169's velden |
| `src/state/runtime/createMcpTransactions.ts` | 2 × `markDocumentEdited(s)` (#167) vs `reconcileHourInputFinish(...); s.isDirty = true;` (#169) | reconcile-regel + `markDocumentEdited` — een fout hier wordt door scan 16n gepakt |

Auto-gemerged maar **semantisch te controleren**:

- **`fileSlice.applyOpenedImport`** — #169: `const notice = withSchedulingProfileNotice(results, xerImportNotice(...), key)`.
  #167: `if (!notice && (…)) notify(importDatesAsRecorded…)`. Na de merge is `notice` voor een `.mpp`
  (`suggestedProfileId: 'msproject'`) de profielmelding ⇒ #167's datumregel wordt voor `.mpp` stil
  onderdrukt, terwijl MSPDI/CSV/P6 XML (`'ops'`, geen profielmelding) hem wél krijgen. Los dit op door
  de datumregel als `detailLines`-regel aan de (profiel)melding te hangen, of hem onafhankelijk van
  `notice` te plaatsen — nooit via `!notice`.
- **B4 van #169** (heropend XER-archief meldt niets) versus bevinding 2 hierboven: na de merge meldt
  een ongewijzigd XER-archief bij heropenen alsnog, via de neutrale sleutel. Bevinding 2 fixen lost dit op.
- `applyRecordedDatesOnLoad` (#169 = basis) en `payloadFromImport` mergen schoon; `suggestedProfileId`
  en `recordedTimesOrigin` staan elkaar niet in de weg; `xerOrigin: 'xer-archive'` (#169) en
  `recordedTimesOrigin: 'xer-archive'` (#167) zijn twee onafhankelijke velden met dezelfde bron.
- Een profielwissel (`applySchedulingSettings`) loopt via een echte mutator ⇒ wist `importPristine` ⇒
  heropenen daarna alleen aanbod. Consistent met optie B; vermeld het in de gids als je wilt.
- Tests: #169's `check-recorded-dates.ts` 7k en `check-xer-recorded-roundtrip.ts` 4a/4b beweren het
  oude beleid; #169 raakte die regels niet, dus #167's versies winnen zonder conflict. `run.sh` mergt schoon.

## Kon ik niet controleren

- Geen `npm run verify`, `typecheck`, browser-suite of `measure:profiles` (opdracht: alleen gerichte
  checks). De Playwright-specs voor P6 XML/MSPDI heb ik gelezen, niet gedraaid.
- Geen `OPS_XER_CORPUS`; de XER-archiefkant van optie B is alleen op de fixture gemeten.
- MPXJ's `TotalSlackCalculationType`-bron voor MPP14 (zie 5).
- Gedrag van MS Project zelf voor handmatig geplande taken met tekstuele duur/start/einde (de PR laat
  die MPXJ-uitzondering bewust weg; corpus zonder zulke taken).
- ALAP-taken in `.mpp` (PR punt 8) — blijft, zoals de PR zelf zegt, ongemeten.

## Oordeel

**LANDEN-MET-FIXES.** Vóór de merge verplicht: (1) de writer schrijft `$` voor niet-vastgelegde assen
wanneer in de modus wordt opgeslagen (of persisteer bak 4 als pset) — mét de heropen-test op de vier
assen; (2) de openingsmelding alleen bij een verse import, ook in de automatisch-aan-tak. Bij de merge met
#169: de meldingspoort niet via `!notice` bouwen. Eigenaarsvraag apart te beantwoorden: is "invoer
vergelijken met invoer" bij CSV en schedule-only-IFC gewenst (4)? Punten 5–7 mogen in een vervolg.
