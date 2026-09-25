# Fable-critreview PR #170 — taaktypes (overname #101) op de rekenprofielen-kop

*2026-09-24, Claude Fable 5.1 (`claude-fable-5-1`), op uitdrukkelijk verzoek van de eigenaar. Gemeten
op kop `6e448f63` in een eigen detached worktree; diffbases `origin/claude/rekenprofielen`
(`ea38a608`) en `origin/claude/contour-engine-planner-mnrsy3` (`c5fca94a`). Zware suites niet zelf
gedraaid — de logs `/tmp/ops-chain-taaktypes-measure.log` (MEASURE_EXIT=0, P6 76, CELLDELTA 0 overal,
mpp 216 gepind / 0 / 0) en `/tmp/ops-chain-taaktypes-verify.log` (EXIT=0, browser 176 passed) heb ik
gelezen; dat ze bij precies `6e448f63` horen staat niet in de log en neem ik van de PR-body aan.
Mutatieproeven draaide ik met eigen probe-scripts door de esbuild-bundelroute van `run.sh`
(dezelfde vlaggen als `bundle_check`); de scripts zijn weer verwijderd. Labels: **[BEVESTIGD]** =
zelf gelezen, gedraaid of op het corpusbestand geteld; **[VERMOED]** = plausibel, niet sluitend.*

## In gewone woorden

De overname van #101 op #169 is netjes gedaan: de 29 conflicten zijn goed opgelost, de B1-koppeling
(baan 2) klopt op alle zeven store-paden plus raster en MCP, de solver leest niets van de nieuwe
velden, en de meetlatten (X12, `.mpp`) zijn cel voor cel onveranderd. Maar de etappe zelf — het
ontwerp van #101 — heeft drie gaten die de gebruiker gaat merken zodra hij écht met werk gaat werken:
(1) voortgang boeken laat het opgeslagen restwerk staan, waardoor het histogram dubbel telt en de
werkdriehoek daarna met een verkeerd getal rekent; (2) de kalenderdialoog — de enige plek in de UI
waar je uren per dag wijzigt — loopt níét door de kalenderregel K2 die de gids belooft; (3) een
bewerkte urenverdeling wordt bij de volgende duurwijziging stil teruggedraaid naar het oude
werkgetal. Daarnaast is de E7-diagnose uit het integratieverslag onjuist: de 97 HarbourPointe-
"afwijkingen" zijn per-toewijzing-spannes (precies wat beslispunt 10 uitstelde), geen afwijkend
begroot werk. Oordeel onderaan: **LANDEN-MET-FIXES**, met drie verplichte fixes en één
eigenaarsbesluit vóór de merge.

## Bevindingen, ergste bovenaan

### 1. [BEVESTIGD] Voortgang boeken onderhoudt het opgeslagen restwerk niet — histogram telt dubbel, driehoek rekent daarna fout

Probe (store, dagtaak 10 d, één resource à 1,0, `setTaskWorkRule('FIXED_WORK')` legt
`remainingWorkMinutes = 4800` vast; daarna `setTaskProgress(t, 0.5)`):

```
0 %:            W 4800, histogram-som 10 eenheid-dagen
na 50 %:        rest 5 d, W 4800 (verwacht 2400), actualWorkMinutes undefined, histogram-som 15,000
daarna inzet 1→2 onder FIXED_WORK: duur/rest 10/5   (verwacht 8/3: R = 2400/960 = 2,5 → 3 d)
```

Oorzaak: geen enkel voortgangspad (`setTaskProgress`, `updateTask({completion, remainingTime})`,
raster `task-progress`, MCP `progress`) raakt `remainingWorkMinutes`/`actualWorkMinutes`
(`grep remainingWorkMinutes src/state/` treft alleen de driehoekpaden). `ResourceLoad.ts:165-173`
leidt het verrichte deel dan af als `(duur − rest) × inzet` en telt dat óp bij het stale restveld:
5 + 10 = 15. `workRuleApply.ts:77-86` geeft de driehoek `remainingMinutesOf = 5 d` met `W = 4800` ⇒
R = 5 d, geen wijziging.

Dit raakt niet alleen handmatig gezette regels: elke XER-/MSPDI-/P6-XML-toewijzing die bij import
een restveld kreeg (HarbourPointe 119, Roads 35, zie bevinding 5) en waarop de gebruiker daarna
voortgang boekt, krijgt hetzelfde. Spec §6.5 zegt "W het restwerk" en §4.3 "`actualWorkMinutes`
nooit door een planningsbewerking" — maar zwijgt over wat een voortgangsbewerking met het restveld
doet. P6 doet dit wel: Remaining Units = At Completion − Actual bij elke actual (spec §2.2 [P5]).
`check-work-rule-store` sectie (h) test alleen dat de inzet blijft staan (h3), niet het werkveld of
de belasting.

**Fix:** een voortgangsbewerking met een aanwezig restveld verplaatst werk van rest naar verricht
naar rato van de restduur (rest' = W × rest'/rest; actual' = (actual ?? 0) + (W − rest')), in
`taskMutationRules`/de drie voortgangssetters én de MCP-/raster-tweelingen; of — minimaal — laag 3
in `assignmentDayUnits` niet optellen bij een afgeleid verricht deel wanneer het restveld ouder is
dan de voortgang. Case erbij in `check-work-rule-store` (h): 50 % ⇒ W 2400, histogram 10.

### 2. [BEVESTIGD] De kalenderdialoog omzeilt K2 — de gids belooft iets wat de UI niet doet

Probe (FIXED_WORK, 4 d à 8 u ⇒ via `setTaskCalendar` naar 6 u/dag = 6 d, klopt; daarna):

```
commitCalendarLibrary (6 u → 4 u):   dagen 6   (K2 verwacht 8)
removeCalendar (terug op 8 u):        dagen 6   (K2 verwacht 4)
```

`resourceSlice.commitCalendarLibrary` (`resourceSlice.ts:513-548`) vervangt `s.calendars` en wist
alleen Z8-venster/nivelleergaten voor wezen; `removeCalendar` (`:480-509`) idem. Geen
`captureCalendarChange`/`settleCalendarChange`. En `commitCalendarLibrary` ís de UI: `CalendarDialog.tsx:72`
commit de hele bibliotheek in één keer, `CalendarForm.tsx` bewerkt daarin `hoursPerDay`;
`updateCalendar` (wél bedraad) wordt in `src/components` nergens aangeroepen (alleen de MCP-tool
`calendarResourceTools.ts:719` en `ResourceCalendarDialog` voor resourcekalenders). De gids
(`gids-taaktypes.md`, nl+en: "andere uren per dag in de kalender zelf … daarna beslist de werkregel")
en CLAUDE.md ("zes aanroepers … kalenderinhoud") beschrijven dus het MCP-pad, niet het
gebruikerspad. `docs/TODO.md` G9 noemt drie randpaden (`setCalendar`, `resolveDeviation`,
`workTime`-verwijdering) maar niet deze twee — die zijn geen randpaden, dit is de hoofdroute.

**Fix:** in `commitCalendarLibrary` per taak met een gewijzigde effectieve slot (oude vs nieuwe
`effHoursPerDay`) `captureCalendarChange` vóór en `settleCalendarChange` ná de vervanging (ook voor
wezen die op de projectkalender terugvallen); idem `removeCalendar`. Melding via
`notifyWorkRuleDurationsChanged`. Cases in `check-work-rule-store` (p/r) via `commitCalendarLibrary`.

### 3. [BEVESTIGD] Een bewerkte urenverdeling wordt bij de volgende duurwijziging teruggedraaid naar het oude werkgetal

Probe (FIXED_WORK, 4 d, W 1920 vastgelegd; `setAssignmentContour` met 4 × 240 min = 960):

```
contour-som 960, remainingWorkMinutes 1920   (stale — de kolom "Werk (rest)" toont 1920)
updateTask duur 4→8: inzet 0,5 (uit W 1920; bij 960 was het 0,25), contour-som 1920 (was 960)
```

`resourceSlice.setAssignmentContour` (`:283-307`) en `draft.setAssignmentContour` schrijven het
werkveld niet; spec §4.3 eist juist "staan ze allebei, dan moet de som van de `remaining`-periodes
gelijk zijn aan `remainingWorkMinutes`". Daarna wint het stale veld: `applyDurationEdit` rekent
I = 1920/R en `reconcileContourWork` (`workRuleApply.ts:225-244`) schaalt de contour terug naar
1920 — de bewerking van de gebruiker is weg, zonder melding. Het paneel verergert het: `remainingHoursOf`
(`TaskAssignmentsSection.tsx:105-112`) toont `stored ?? contourRemaining`, dus het stale getal.

**Fix:** `setAssignmentContour` schrijft — als er een restveld is — `remainingWorkMinutes` = som van
de `remaining`-periodes (en `actualWorkMinutes` = som `actual` als dat veld er is), zonder
duurwijziging (contour raakt geen datum); loslaten (`null`) laat het veld staan. Case in
`check-work-rule-store` (d).

### 4. [BEVESTIGD] FIXED_RATE drift: de regel "nooit terugrekenen uit de afgeronde R" wordt onder Vaste inzet zelf geschonden

Pure kern, `applyUnitsEdit`/`applySlotChange`:

```
P1  5 d, I 1 → 0,3 → 1:        5 → 17 → 6 d   (werkveld blijft afwezig)
P2  5 d, 8 u → 6 u → 8 u/dag:  5 → 7 → 6 d
```

`workTriangle.ts:228-236` en `:399-402`: onder FIXED_RATE wordt bewust géén werkveld geschreven
(F5, meetlat 35), dus de tweede bewerking rekent uit R' × I' — precies wat spec §5 regel 3 en §6.1
("nooit terug vanuit de afgeronde R", case 31) verbieden. MS Project bewaart Work altijd per
toewijzing, ongeacht taaktype; heen-en-weer geeft daar 5 d. Weegt zwaar omdat FIXED_RATE de regel
is die élke `.mpp`/MSPDI-taak met MSP's fabrieksinstelling Fixed Units krijgt
(`workRuleFromMsp`, `workRuleMapping.ts:44`) — en bij MSP's standaard (niet effort-driven) óók de
8-B-cel. Meetlat 35 praat de implementatie na: hij pint `derivedHours: 36` waar het anker 32 was.

**Fix:** FIXED_RATE legt bij een inzet-/slotbewerking het anker W vast zoals FIXED_WORK dat doet
(het veld schrijven); wt-35 en de F5-alinea in de spec/docblok aanpassen. De zorg uit F5 ("een
opgeslagen W die van R × I afwijkt") is juist de bedoeling van regel 3.

### 5. [BEVESTIGD] E3/E7: de 97 HarbourPointe-"afwijkingen" zijn per-toewijzing-spannes; de diagnose in het integratieverslag klopt niet

Door de echte lezer (`readXER`, corpus) met de bronrijen ernaast:

| bestand | toewijzingen | met restveld | eigen toewijzingsspanne (niet gestart) | gestart/klaar | overig |
|---|---|---|---|---|---|
| HarbourPointe_AssistedLiving | 417 | 119 | **97** | 22 | 0 |
| Roads_Project_TEC | 3575 | 35 | 0 | 35 | 0 |

EC2370 (336 u, `DT_FixedDrtn`): zeven resources à 0,2679/u hebben `target_qty` 90 = 336 × 0,2679 —
geen afwijking; de Painter (rsrc 6878) staat er twee keer op met `TASKRSRC.target_start/end`
03-04→23-04 en 13-05→03-06 (112 u elk) en `target_qty` 30 = 112 × 0,2679. Dat is geen "afwijkend
begroot werk" en geen resourcekalender (alle acht op kalender 5829, 8 u/dag): het is de
toewijzingsspanne die beslispunt 10 bewust uitstelde. `importedWorkFields` vergelijkt tegen
`taakduur × inzet` (`xerReader.ts:895-899`, `xerResourceAssignments.ts:227-235`) en ziet 30 ≠ 90.
Gevolg: het histogram spreidt nu 30 u vlak over 42 dagen (0,71 u/dag) waar P6 2,14 u/dag over 14
dagen toont — vóór #170 stond er 2,14 u/dag over 42 dagen (goede intensiteit, verkeerd totaal).
Beide fout; de PR-tekst "histogram bij XER-import weer gelijk aan vandaag" is voor deze 119 + 35
onwaar. Roads' 35 zijn wél echte P6-herschattingen op gestarte/afgeronde activiteiten (bv. A10530:
`target_qty` 10, `remain_qty` 306) — daar is laag 3 terecht.

**Advies E7 (eigenaarsbesluit):** tot de per-toewijzing-spanne er is, géén werkvelden zetten
wanneer `TASKRSRC.target_start/end` van de activiteitsspanne afwijkt (dan blijft het histogram
byte-identiek aan vandaag en klopt de intensiteit), óf — beter — die twee datums in
`workWindowStart/Finish` lezen (het veld bestaat, round-tript, niemand vult het) en laag 3 daarop
laten spreiden. De 1 %-tolerantie uit het dossier verandert niets (ook nagemeten: 97 blijft 97).

### 6. [BEVESTIGD] E2: de P6-XML-labelwissel van #101 is juist

MPXJ `org/mpxj/primavera/TaskTypeHelper.java` (master, via GitHub API): `DT_FixedDrtn` ↔ "Fixed
Duration and Units/Time" ↔ `FIXED_DURATION`; `DT_FixedDUR2` ↔ "Fixed Duration and Units" ↔
`FIXED_DURATION_AND_UNITS`; `DT_FixedQty` ↔ "Fixed Units"; `DT_FixedRate` ↔ "Fixed Units/Time".
Identiek aan `workRuleMapping.ts:69-100` en de nieuwe `P6_XML_DURATION_TYPE_BY_LABEL`. E2 kan dicht:
overnemen, oude IFC's uit een P6-XML-import niet migreren (solverneutraal, zoals het dossier zegt).

### 7. [BEVESTIGD] Laag 3 wordt overgeslagen zodra een P6-/MSPDI-curve meereist

`assignmentDayUnits` (`ResourceLoad.ts:160-164`): laag 2 (`curveValues`) staat vóór laag 3 en
spreidt `unitsPerDay × duur`, dus een XER-toewijzing mét resourcecurve én afwijkend werk boekt niet
haar werk maar de afleiding. Vorm en totaal zijn orthogonaal; laag 3 hoort het totaal te leveren en
laag 2 de vorm. Spec §6.1 zegt "vóór de formule", wat de code letterlijk doet — het ontwerp is hier
te smal. Kleine fix: bij `curveValues` + restveld `slotWeightsFromValues(curveValues) × totalUnits`.

### 8. [VERMOED · hoog] E6 is poortnaleving door verhuizing, geen scheiding

`effectiveEffortDriven` (`taskDefaults.ts:23-25`) is een formaat-if: "MSP-herkomst ⇒ afwezig vinkje
= niet effort-driven ⇒ andere regeltabelcel". Dat is eigenaarsbesluit 8-B en bewerksemantiek, geen
solverinvoer — inhoudelijk verdedigbaar. Maar `verify:conventions` telt alleen lezingen ín
`src/engine/`, en `src/engine/work/workRuleApply.ts:28-32` importeert deze functies gewoon uit
`utils/`; de AST-poort volgt geen imports. De pin staat dus weer op 6/1 terwijl de motor dezelfde
lezing via één hop binnenhaalt. Niet fout voor #170, wel een gat in de poort dat een volgende
formaat-if via `src/utils/` of `src/state/` in de rekenuitkomst kan brengen (een duur die uit de
driehoek komt, gaat de solve in). Check die ontbreekt: de gate ook over de import-sluiting van
`src/engine/` laten lopen, of `workRuleApply.ts` naar `src/state/` verhuizen.

### 9. [BEVESTIGD] Kleinere punten

- `removeResource` wist nu de nivelleergaten (PR-body klopt) maar níét Z8-venster/bevroren walks,
  terwijl `unassignResource` dat wel doet (`resourceSlice.ts:127-153` vs `:309-341`). Zelfde
  toewijzingstrigger, ander gedrag — de PR-body zegt "net als de andere toewijzingspaden".
- `taskCalendarHoursPerDay` → `effHoursPerDay` (`taskDefaults.ts:572-575`) verandert de
  contourreferentie voor élke aanroeper, ook zonder werkregel. Op een uurkalender waarvan de banden
  niet op `hoursPerDay` uitkomen is "byte-identiek onder de standaardregel" dan niet waar
  [VERMOED · midden; geen fixture met zo'n kalender gevonden].
- MSPDI-writer: zonder werkvelden én zonder `workRule`/`mspTaskType` byte-identiek (gelezen:
  `mspdiWriter.ts:500-514`, `:695-716`). Maar elke import zet nu `workRule`, dus elke XER→MSPDI-
  export krijgt `<Type>`/`<EffortDriven>`; `<EffortDriven>` staat vóór `<Start>`, terwijl het
  MSPDI-schema hem ná `ResumeValid` legt [VERMOED · midden — de bestaande writer zet Duration al
  vóór Start; of MS Project daar streng op is heb ik niet gemeten].
- `TaskDialog`: een regelwissel commit direct op de store (B4); Annuleren draait 'm niet terug.
  Consistent met de toewijzingssectie, maar de dialoog heeft een Annuleren-knop die hier niets
  annuleert [VERMOED · laag als UX-vraag].
- `assignResource`/`unassignResource` onder de standaardregel wissen nivelleergaten zonder
  `reconcileHourInputFinish`; `hourInputFinishBasis` bevat de gaten niet, dus het einde van een
  urentaak houdt de gewiste gaten. Pre-existing #169-besluit ("uitvoer van de nivelleerder"), niet
  van #170 — maar de PR-body's "elke bewerking die de duur verandert" verhult dat de reconcile
  alleen bij `durationChanged` draait.
- `applyTriangleResult` rondt een afgeleide inzet op 4 decimalen (`:152`), de spec zegt 2; de
  `UnitsInput` toont wat hij toont — bij een hercommit van het getoonde getal verschuift W.
  [VERMOED · laag]

### 10. Wat klopt (zodat de eigenaar weet wat ik wél heb nagelopen)

- **Regel A**: `grep workRule|remainingWorkMinutes|plannedWorkMinutes|actualWorkMinutes|effortDriven|mspTaskType src/engine/scheduler/` treft alleen `ResourceLoad.ts` [BEVESTIGD]. `settle*` heeft geen aanroeper in lezers, `payloadFromImport`, `applyLoadedProject`, `restoreDocuments` of `solveProject` [BEVESTIGD]; checks 61/62 pinnen dat. Logs: X12 76/0/0/0, mpp 216/0/0 [BEVESTIGD uit de log]. Nivelleerder-in-de-solve blijft het dossierrisico §4.6: laag 3 voedt `ResourceLeveler` al vandaag, dus zodra die in de solve landt worden bevinding 1 en 5 datumfouten.
- **B1-koppeling**: `settleDurationAftermath` (`workRuleApply.ts:441-454`) met verplichte `finishBasis`; op alle veertien paden (7 store, 7 MCP) en het raster wordt de basis vóór de eerste mutatie gelezen — ook bij `moveAssignment` (twee bases), `removeResource` (per toewijzing vóór de filter) en de kalenderstap in `updateTask` (basis vóór K2). Volgorde `clearLevelingGaps` → `reconcileHourInputFinish` gelijk aan `updateTask`. Checks 45–62 dekken dat [BEVESTIGD gelezen; niet zelf gedraaid].
- **Vergeten paden gezocht**: extensie-API loopt via `data.updateTask` → `taskSlice.updateTask` (K1) en kent geen toewijzingsmutatie; `moveProject` heeft alleen verdicts (`n/a`); `applyLeveling` schrijft gaten, geen duur; undo/redo hydrateert via het contract (werkvelden zitten in `assignments`, rol `data`; `taskTypesVisible` rol `none`, `fresh: false`); paste (`selectionSlice.ts:257-263`) spreadt de toewijzing incl. werkvelden mee. Het echte vergeten pad is bevinding 2.
- **Documentcontract/IFC**: `taskTypesVisible` in `DOCUMENT_FIELDS` (`documentContract.ts:259`), werkvelden in het `OPS_Timephased`-blob met `Object.keys(meta).length === 0`-guard, `OPS_WorkRule` als pset 17 met `WORK_RULES`-validatie, `DefaultWorkRule` in `OPS_ProjectSettings` [BEVESTIGD gelezen]. Let op: spec §4.4 noemt nog `OPS_AssignmentWork` en `OPS_SchedulingOptions` (dossier wees daar al op; niet rechtgezet).
- **Meetlat, vijf cases met de hand**: wt-02 (Fixed Units, inzet 1→0,5 ⇒ 10 d) ✓ MSP; wt-08 (Fixed Duration, werk 80 u ⇒ inzet 2) ✓ MSP; wt-11a (FD&Units, duur 5→10 ⇒ inzet 0,5) ✓ P6; wt-13/wt-19 (Fixed Work, inzet ⇒ duur; eraf ⇒ langer) ✓ MSP; wt-05/05b (niet effort-driven, erbij/eraf laat duur staan) ✓ MSP. Waar de meetlat de implementatie napraat: wt-04/15/30 pinnen de OPS-afronding (MSP: 2,5 d) als `reasoned` — eerlijk gelabeld; wt-35 pint de drift uit bevinding 4 als gewenst gedrag; wt-31 (W leidend) bestaat alleen voor FIXED_WORK, niet voor FIXED_RATE.
- **UI/i18n/gids**: 14 locales dragen de sleutels (`verify:i18n` in de log groen); tekstrollen via `text-caption`/`text-small`; de detailregel-melding met gidsnaam (T4-18b/c). De instelling staat als kaal vinkje + `scrollzoom-hint`-bijschrift onder Urenplanning — geen gekleurd blok (eigenaarsvoorkeur), zie E5.

## Wat de eerdere reviews misten

- Beide Opus-critreviews (baan 1 en 2) toetsten de driehoek alleen op bewerkingen; niemand boekte
  voortgang ná een vastgelegd werkveld (bevinding 1) of bewerkte een contour ná een vastgelegd
  werkveld (bevinding 3). Sectie (h) van `check-work-rule-store` kijkt uitdrukkelijk alleen naar de inzet.
- K2 werd op zes aanroepers getoetst — allemaal store-/MCP-acties — maar niemand volgde de UI-draad
  naar `CalendarDialog` → `commitCalendarLibrary` (bevinding 2). Het TODO-punt G9 wekt de indruk dat
  de resterende paden randgevallen zijn.
- E7: het verslag gokte op "afwijkende resourcekalender, niet uitgezocht". Eén blik op
  `TASKRSRC.target_start_date/target_end_date` naast de activiteit had het per-toewijzing-spanne-
  patroon laten zien (bevinding 5).
- F5 (geen werkveld onder FIXED_RATE) is in de #101-reviewronde aangenomen zonder de heen-en-weer-
  proef die regel 3 zelf voorschrijft (bevinding 4).
- E2 bleef "niet opnieuw gecontroleerd" terwijl MPXJ's bron in één API-call te lezen is (bevinding 6).

## Eigenaarsvragen

- **E1 (aangescherpt)** — de gebruikstest moet niet alleen "inzet omhoog ⇒ korter" tonen, maar
  expliciet: (a) voortgang boeken op een taak met werkveld en dan het histogram; (b) inzet heen en
  weer op een `.mpp`-taak (Fixed Units) — na fix 4 moet dat op de oude duur uitkomen; (c) uren per
  dag wijzigen in de kalenderdialoog — na fix 2 moet Vast werk langer worden.
- **E2** — kan dicht: MPXJ bevestigt #101 (bevinding 6). Geen IFC-migratie.
- **E3** — "code volgt spec" is verdedigbaar, maar de spec-regel zelf (vergelijken tegen
  activiteitsduur × inzet) is blind voor de toewijzingsspanne. Besluit gevraagd: E7-advies
  overnemen (geen veld bij afwijkende spanne, of `workWindowStart/Finish` vullen).
- **E4 (aangescherpt)** — `hasTaskTypeData` slaat aan op `p6DurationType`/`mspTaskType`, en
  `deriveImportedWorkRules` geeft élke geïmporteerde taak een `workRule`; elke `.mpp`/XER ontsluit
  dus altijd, met detailregel. Advies: ontsluiten stil wanneer de enige bron een afgeleide regel is;
  melden alleen bij opgeslagen werkvelden (dat is wat de gebruiker moet weten: "dit bestand draagt
  werk dat van duur × inzet afwijkt") of een eigen regel uit een IFC.
- **E5** — huidige vorm: kaal vinkje met los bijschrift onder Urenplanning; in het paneel een
  "Beschermd: …"-regel met slotje en een cursief MSP-bijschrift. Botst met de eigenaarsvoorkeur
  (info in gekleurde blokken); geen blokkade, wel voor de UI-baan.
- **E7** — zie bevinding 5; het is beslispunt 10, geen resourcekalender.
- **Nieuw E8 — voortgang en werkvelden.** Moet een voortgangsbewerking rest → verricht verplaatsen
  (P6: Remaining = At Completion − Actual; advies: ja, naar rato van de restduur), of blijft werk
  alleen door de driehoek en import bewogen (dan moet laag 3 het stale veld negeren)?
- **Nieuw E9 — FIXED_RATE en het anker.** F5 terugdraaien (advies: ja; MSP bewaart Work altijd)?
- **Nieuw E10 — contour ↔ werkveld.** Contourbewerking schrijft het restveld (advies: ja), of het
  werkveld wint en de dialoog waarschuwt?

## Kon ik niet controleren

- Het verbandje tussen de twee logs en exact `6e448f63` (de log noemt geen sha).
- De browserspecs (`work-rule`, `contour-dialog`, `scheduling-profile`) en `measure:profiles` heb
  ik niet zelf gedraaid; alleen de log gelezen.
- MS Project-strengheid op de elementvolgorde in MSPDI (`<Type>`/`<EffortDriven>`).
- Of een uurkalender in het `.mpp`-corpus `effHoursPerDay ≠ hoursPerDay` oplevert (bevinding 9,
  tweede punt) — de mpp-fidelity-poort meet datums, niet contouren.
- De `.mpp`-lezer zet geen werkvelden (dossier §4.2) — dus voor `.mpp` speelt bevinding 1 alleen na
  een eigen regelkeuze; MSPDI/P6-XML/XER wél bij import.

## Oordeel

**LANDEN-MET-FIXES.** De integratie en de B1-koppeling zijn goed en regel A staat; wat stuk is zit
in het ontwerp van #101 en is met deze PR op de kop gezet. Vóór de merge minimaal: (1) voortgang
onderhoudt het restveld of laag 3 negeert het stale veld (bevinding 1, met case); (2) K2 in
`commitCalendarLibrary` en `removeCalendar` (bevinding 2, met case) — of de gids en CLAUDE.md
zeggen eerlijk dat alleen het MCP-pad de regel volgt; (3) `setAssignmentContour` schrijft het
restveld (bevinding 3, met case). Daarnaast het eigenaarsbesluit op E7/E3 (bevinding 5), want dat
bepaalt wat 119 HarbourPointe-toewijzingen in het histogram doen. Bevinding 4 (FIXED_RATE-anker)
mag als eigen fixcommit vlak erna, maar vóór een release: het raakt elke MS Project-import.
