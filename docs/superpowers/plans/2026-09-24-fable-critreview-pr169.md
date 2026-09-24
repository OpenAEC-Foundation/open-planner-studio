# Fable-critreview PR #169 (kop `e5717cb4`, 2026-09-24) — Claude Fable 5.1

*In gewone taal: de bouw is degelijk — één motor, benoemde regels, een meetlat die een gewone
motorregressie hard tegenhoudt (zelf bewezen: 259 rode cellen, herpin geweigerd). Maar drie dingen zijn
niet in orde. (1) De meetlat is te bespelen op precies het moment dat een uitsluiting wordt toegevoegd:
een regressie op de uit te sluiten taken verdwijnt dan met de uitsluiting mee én wordt als nieuwe pin
vastgelegd — zelf gedaan, de poort ging groen op 76. (2) De enige "per bestand"-conventie (A19) hangt aan
een P6-vlag die in het hele corpus nooit een andere waarde heeft dan Y, en die volgens Oracle over
budget/kosten gaat, niet over datums; de code zegt dat zelf ("ongetoetst"). (3) De knop "terug naar
basis" op die per-bestand-regel gooit bestandsdata weg en de weg terug maakt stil een eigen profiel.
Oordeel: LANDEN-MET-FIXES — fix (1) en (3) vóór de merge, (2) is een eigenaarsbesluit met een
voorbehoud in de gids, en de PR-tekst is verouderd (26/104/41 i.p.v. 27/76/42).*

Gelezen en gedraaid in een eigen detached worktree op `e5717cb4`; corpus alleen gelezen. Elke
mutatieproef is daarna met `git checkout` teruggedraaid. De orkestrator-eindreview
(`2026-09-24-eindreview-fable-pr169.md`) is gelezen maar niet vertrouwd; waar ik het ermee eens ben
staat dat erbij, waar ze iets miste staat dat onder "Wat de eerdere reviews misten".

Ketenstand van de orkestrator op deze kop, gelezen uit de logs: `measure:profiles` MEASURE_EXIT=0
(NULDOEL 76, `nieuw=0 verslechterd=0 groter=0 schuld=0`, 42 taken uitgesloten in 3 projecten);
`verify` EXIT=0 (`/tmp/ops-chain-c14-verify.log` r.2834).

## Bevindingen, ernstigste bovenaan

### 1. [BEVESTIGD · HOOG] De meetlat is te bespelen op het moment van een uitsluiting — mutatiebewijs

**Wat.** `excludedHiddenRedLines` (`tests/planning/fidelityCells.ts:508-531`) maakt bij een gewijzigde
uitsluitingsidentiteit ELKE verschuiving van de verborgen aantallen `fileset` (r.522), en `compareCells`
(r.562-616) zet cellen op nieuw uitgesloten taken als `excludedCells` (`fileset`). In `=corpus`-modus zijn
`fileset`-regels toegestaan en wordt er geschreven (`check-xer-product-fidelity-x12.ts:2768-2863`). Een
motorregressie die alleen de uit te sluiten taken raakt is dus onzichtbaar, en de nieuwe `excludedHidden`-pin
wordt op het GEREGRESSEERDE niveau gezet. Vanaf dat moment is de regressie ook voor de niet-stijgende pin
"normaal".

**Mutatieproef (e), zelf gedraaid, X12-check met corpus, ~3 s per run.**
- Regressie: in `scheduleAnalysis.ts` na `if (freeFloat === Infinity) freeFloat = 0;` één regel
  `if (taskObj.p6ProjectId === '9032') freeFloat = freeFloat + 1;` (alleen OZB-project 9032).
- (e1) poortmodus: `CELLDELTA nieuw=10 … PRODUCTGATE RED 14/121` — correct hard rood.
- (e2) zelfde regressie + in het manifest `excludeProjects` 9032 op de OZB-entry (die al een `decision`
  droeg; reden ≥ 10 tekens) + `OPS_XER_CELLS_WRITE=corpus OPS_XER_V2_WRITE=corpus`: de check schrijft
  cellenbestand, v2 én het uitsluitingspin-blok in `check-fidelity-cells-gate.ts`. Enige rode regels:
  `cel valt weg door een nieuwe manifestuitsluiting` (fileset), `cel-baseline hoort bij een ander
  corpusmanifest` (fileset) en `verborgen aantallen … 38 zesassig/4 drivingPath → 48 zesassig/8
  drivingPath door een gewijzigde uitsluiting` (fileset). De +10 zesassig ís de regressie; op 9032
  stonden vóór de uitsluiting 0 zesassige en 4 drivingPath-cellen inexact (`uitgesloten=4`).
- (e3) poortmodus op de herpinde stand: `nieuw=0 … PRODUCTGATE RED 3/111` — alleen de drie
  nuldoelregels, X12 nog steeds 76. Regressie volledig verdwenen.

**Ter vergelijking (a)/(b), ook zelf gedraaid:** C2 uitzetten (`&& false` op
`scheduleAnalysis.ts:227`) geeft `nieuw=259` (247 Hotel 2666, 12 Roads 1346) en
`OPS_XER_CELLS_WRITE=1` weigert: "herpin … geweigerd: 259 rode regel(s)". Een gewone regressie houdt
de poort dus wél tegen; het gat zit uitsluitend in de uitsluitingsstap. (Een projectuitsluiting die een
bestand leegmaakt wordt overigens al geweigerd: "als orakel geselecteerd maar geen enkele poortas meetbaar"
— dat is een bijvangst, geen bescherming tegen dit gat.)

**Waarom het pijn doet.** De policy zegt "elke uitsluiting is een eigenaarsbesluit", maar de enige
mechanische eis is een `decision`-string in het juiste formaat (`xerManifestExclusions.ts:72-85`), en die
typt elke agent. De eigenaar beoordeelt de uitsluitingsreden, niet de motor-diff die tegelijk landt. Precies
de HarbourPointe-uitsluiting (vraag 8/13) landde samen met C14: de +2 cellen op EC1420 "onder C14 anders
groter" (manifestreden) zijn daarmee een gedocumenteerd geval van "uitsluiten wat de conventie slechter
maakt". Ik zeg niet dat dat besluit fout was — wel dat de meetlat het niet kán onderscheiden van een
regressie.

**Fix (klein, testbaar met mijn mutatie).** Bij een identiteitswijziging voor bestand F:
`hidden_after(F) − hidden_before(F)` moet per as EXACT gelijk zijn aan het aantal cellen in
`delta.excludedCells` voor F (de cellen die volgens de GEPINDE baseline al inexact waren op de nieuw
uitgesloten ids) min `delta.reincludedCells`; elk surplus is `hard`
("regressie op de zojuist uitgesloten taken"). `evaluateCells` heeft `delta` en `hidden` al in handen
(`check-xer-product-fidelity-x12.ts:2686-2699`). Voeg mutatie (e) als case toe aan
`check-xer-manifest-exclusions.ts` §5.

### 2. [BEVESTIGD · HOOG] A19 "per bestand" hangt aan een vlag zonder aangetoonde relatie tot de regel

**Wat.** De XER-lezer zet `p6UseRemainingStartForProgress` als override uit
`PROJECT.rem_target_link_flag` (`xerScheduleOptions.ts:213-218, 496-500`; `xerReader.ts:971-976`). Het
is de enige `perFile`-conventie in het register en drijft een hele laag: `PER_FILE_CONVENTION_KEYS`,
`withPerFileFrom`, `TEMPLATE_KEYS`, de blauwe badge "per bestand", het label "(aangepast)" en het
overdrachtsgedrag bij elke wissel (`schedulingProfileDraft.ts:30-75`).

**Bewijs.**
- Corpusbreed, zelf gemeten over alle 102 PROJECT-rijen: `rem_target_link_flag` **Y = 62, N = 0,
  leeg = 40**. Alle lege zijn generator-/lezerfixtures zonder P6-uitvoer. Er is geen enkel bestand
  waarmee "N ⇒ actual start" ooit getoetst kan zijn.
- In de zeven P6-doorgerekende bestanden hebben alle 60 lopende taken (`TK_Active`)
  `early_start_date == restart_date`, 0× `== act_start_date` — dus P6 zet de vroege start van een lopende
  taak op de reststart, in élk bestand, zonder dat de vlag varieert.
- Het docblok zegt het zelf (`src/types/project.ts:126-127`): "[VERMOED] dat de regel alleen onder
  `rem_target_link_flag`=N (A19 aan) geldt: de koppeling aan deze vlag is ongetoetst." (Let op: die zin
  heeft de polariteit ook nog omgekeerd — de lezer zet A19 aan bij **Y**.)
- Plan XER §"rem_target_link_flag=Y en de vroege start" (`2026-08-20-plan-xer-p6-lezer.md:708-716`)
  registreert het als correlatie ("klasse (ii)-materiaal"), nooit als regel.
- [VERMOED · hoog, Oracle-doc niet online geraadpleegd] In P6's XML heet dit projectveld
  `LinkPlannedAndAtCompletionFlag`, de instelling *Project → Calculations → "Link Budget and At
  Completion for not started activities"* — een koppeling tussen geplande en at-completion
  eenheden/kosten. Geen datumregel.

**Waarom het pijn doet.** Een echt P6-bestand waarin die instelling uit staat (kan gewoon in de
dialoog) rekent onder het profiel "Primavera P6" lopende taken op hun werkelijke start i.p.v. de
reststart — tegen alle beschikbare P6-uitvoer in — en de UI vertelt de gebruiker dat dit "uit het
bestand" komt. Verder gaat op 100 % van de echte P6-bestanden de keuzelijst op "Primavera P6
(aangepast)" en de groep *Voortgang* op "1 afwijkend": ruis, geen informatie.

**Fix-richting (eigenaarsvraag 1).** A19 in het P6-profiel op **aan** (de gemeten P6-regel), `perFile`
eraf; de lezer zet geen override meer. Het per-bestand-mechanisme pas terugbrengen wanneer er een
P6-doorgerekend bestand met `N` bestaat dat een ander gedrag laat zien. Minimaal vóór de merge: het
[VERMOED] uit het docblok in gids en spec herhalen (nu belooft de gids "komt uit je .xer-bestand").

### 3. [BEVESTIGD · HOOG (UX)] "Terug naar basis" op de per-bestand-conventie vernietigt bestandsdata; de weg terug forkt een eigen profiel

`resetConventionToBase` (`schedulingProfileDraft.ts:117-122`) haalt de override weg zonder van een
ingebouwd profiel een kopie te maken — bedoeld, staat ook zo in de gids. Maar `editConvention`
(r.100-113) maakt bij een ingebouwd id ALTIJD een "Kopie van Primavera P6". Pad: XER openen → Projectinfo
→ A19 "terug naar basis" → vinkje weer aan ⇒ project staat op een eigen profiel met A19 als handmatige
afwijking; de bestandswaarde als *per-bestand*-waarde is definitief weg (alleen herimport brengt haar
terug). `tests/browser/scheduling-profile.spec.ts:325-346` pint precies deze asymmetrie als gewenst gedrag.
De UI-critreview van de groepen zag A19 als "wijkt af"; dat was de juiste vraag, het antwoord was niet
"bedoeld" maar "fout ontwerp". Fix: op `perFile` geen resetknop (er is geen "basis" voor een bestandswaarde),
óf reset = terug naar de bestandswaarde; en een edit van een per-bestand-conventie op een ingebouwd id
mag niet forken. Verdwijnt vanzelf met de fix onder 2.

### 4. [BEVESTIGD · MIDDEN] `verify:conventions` is een namenlijst, geen grens — en de PR-body overdrijft

Mutatie: één lezing van `p6NonWorkPenaltyDates` (een veld dat alleen na XER-import op een kalender staat,
`types/calendar.ts:61`) in `CPMSolver.isUnstartedAlapPositionedFromSuccessors` ⇒
`node scripts/verify-conventions.mjs` **groen, exit 0**. Een extra `if (task.p6ProjectId …)` ⇒ rood
("datagate 'p6ProjectId': 14 lezingen, gepind 13") — de datagates werken, maar alleen voor de 17 gepinde
namen (`scripts/verify-conventions.mjs:36-40`). Elk ander bron-eigen veld is een gratis formaat-if.

Daarnaast zijn er nu al 13 `p6ProjectId`-lezingen die conventies aan herkomst koppelen: A18 werkt alleen
met `task.p6ProjectId !== undefined` (`CPMSolver.ts:2296, 2359`), `useExpectedFinishDates` idem (:2745),
de suspend/resume-route (:2500), B5 en de voltooid-routes (`p6OpenLoeTargetSpanTrace.ts:64`,
`p6CompletedRouteTrace.ts:101`). De gids zegt dat eerlijk onder "Combinaties zonder referentiepakket"; de
PR-body ("De motor kent geen bestandsformaten meer") en CLAUDE.md ("nooit een `if` op het formaat") niet.
Fix: (a) de poort omdraaien naar een denylist op naampatroon (`^(p6|xer|mpp|msp)[A-Z]` buiten de
registersleutels) met de bestaande pin als uitzonderingenlijst; (b) de tekst nuanceren: "geen `if` op
het formaat, wél gepinde herkomstpoorten binnen conventies".

### 5. [BEVESTIGD · MIDDEN] Zes conventies dragen een `isHourMode`-poort die de facto een formaatproxy is

C2 (`scheduleAnalysis.ts:228`), C5 (`CPMSolver.ts:551`), C6 (:600), C9 (:705), C12 (:763) en C14
(:3451) doen niets op een dagkalender. P6 rekent altijd in uren, dus dit is geen P6-semantiek maar
regel-A-bescherming van de dagfixtures — een verkapte "kwam dit uit een XER"-test. Onder het profiel
"Primavera P6" op een CSV-/OPS-project op dagen rekenen die regels niet, en alleen bij C14 zegt de gids
dat ("een taak op een dagkalender houdt het oude gedrag"). Fix: minimaal per conventie in docblok en gids;
netter: een registereigenschap (`hourCalendarOnly`) zodat de UI het kan tonen en de poort het kan tellen.

### 6. [VERMOED · hoog] C5 "voltooide CP_Phys-taak" is een corpusartefact, geen P6-regel

Zelf gemeten over de orakelbestanden: ÉLKE voltooide taak (`TK_Complete`) is `CP_Phys` — Roads 157,
HarbourPointe 18, OZB 17; Hotel, Sample en ashspace hebben er nul. Het corpus kan "alleen CP_Phys" niet
van "alle voltooide taken" onderscheiden; van die 192 staan 166 op `early_start = early_end =
last_recalc_date` en 26 later (de C5-voorgangerregel). P6's planner kent het percent-complete-type geen
datumrol toe; de P6-standaard is *Duration %* (`CP_Drtn`). Een doorsnee P6-project krijgt onder het
P6-profiel zijn voltooide taken dus op werkelijke datums — de vorm die het corpus nergens laat zien.
§1d-6 koos "smal" omdat breed "geen extra cel wint": regel A als semantiekbron gebruikt. Ontbrekende
check: één P6-doorgerekend bestand met voltooide `CP_Drtn`-taken. Eigenaarsvraag 2; tot die tijd hoort
de naam van de conventie ("fysieke-voortgangstaak") in de gids een voorbehoud te dragen.

### 7. [BEVESTIGD · MIDDEN] Het P6-profiel is per relatiesoort een lappendeken van gemeten gevallen

C2-breed houdt voor gestarte taken "letterlijk het predicaat van het oude C2" (`scheduleAnalysis.ts:
235-236`) — geen P6-bron, alleen ratchetbehoud; SF, ELAPSEDTIME, procentlag en andere lagkalenders
"ongemeten ⇒ oude berekening". Zelfde patroon bij C6 (alleen SS, alleen WORKTIME, alleen positieve lag),
C12 (alleen FF zonder ELAPSED) en C14 (alleen niet-gestart). Regel A verklaart dat, maar de gids en de
docblokken presenteren de gemeten deelverzameling als "de P6-regel". Fix: per conventie twee zinnen:
"P6-regel: …; gebouwd: …; bewust niet: … (geen orakel)".

### 8. [BEVESTIGD · MIDDEN] PR-body is verouderd op de kop

Body: "26 conventies", "104 zesassige afwijkingen", "41 taken in 3 projecten", "C14 nog niet op de kop
(104 → 80)", "UI-groepenvoorstel wacht op de eigenaar", "Eindreview … twee delen, GO met B1
uitgezonderd". Kop: 27 conventies (`registry.ts`), 76 (`measure`-log), 42 taken (manifest + log), C14 en
UI-groepen gemerged (`c7d17ee5`, `31503ca4`), eindreview drie delen. CLAUDE.md r.154-166 klopt wél.
Herschrijf de body vóór de merge; het voorstel in `2026-09-24-pr169-body-voorstel.md` heb ik niet
tegen de kop gecontroleerd.

### 9. [VERMOED · midden] `measure:profiles` laat "VERBETERD zonder herpin" door

`measure-profiles.mjs` telt VERBETERD als exit 0 en vertrouwt op discipline ("commit alleen mét herpin").
De X12-check zelf staat dan wel rood op de v2-gelijkheid, maar die draait alleen mét corpus, dus niet in
CI. Gevolg: een verbetering die nooit gepind wordt, gevolgd door een terugval naar de OUDE pin, is voor
regel A onzichtbaar (per cel geldt de pin, niet de beste ooit gemeten stand). Fix: VERBETERD rood in de
landingsroute (`--strict` standaard voor `measure:profiles` zonder `--only`). Niet zelf gereproduceerd.

### 10. [BEVESTIGD · KLEIN] B1: geen vergeten gebruikerspad gevonden; één randgeval en één docgat

Gecontroleerd: `taskSlice.updateTask`/`setTaskCalendar` (reconcile ná `clearLevelingGaps`, r.461-464,
486), MCP `updateTaskFields`/`patchTaskFields` (`createMcpTransactions.ts:397, 457`), grid
(`taskEditPlan.ts:164-167`), balk-sleep (stuurt start+finish+duur samen, `useBarDrag.ts:169-177,
234-241` ⇒ "gewijzigd einde wint"), TaskDialog-bewerken (via `updateTask`). Wel: (a)
`seedNewHourTaskFinish` slaat over zodra `partial.time.scheduleFinish` meekomt
(`taskDefaults.ts:170`); `extensions/sdk.ts:90` maakt `createDefaultTaskTime(start, 5)` zonder eenheid
of kalender — een extensie die een urentaak met eigen `time` aanlevert krijgt geen koppeling; (b)
`resourceSlice.removeCalendar` (r.343) laat taken op de projectkalender terugvallen zonder herleiding —
de gids noemt "projectkalender of kalenderuitzonderingen", niet het verwijderen van een taakkalender.
Gids aanvullen of reconcile in `removeCalendar`.

### 11. [VERMOED · laag] `excludedHidden` netto-effect binnen een bestaande uitsluiting

Orkestrator-bevinding 8 klopt (per bestand één getal, plus en min heffen elkaar op). Met de fix onder 1
(per-as-delta) wordt ook dit strakker; apart geen actie.

## Gezond — zelf bevestigd

- **Twee lagen, compile-time.** `ProjectOptionKey` ⊥ `ConventionKey` (`registry.ts:145-148`);
  `CPMOptions.schedulingOptions` eist `EffectiveSchedulingOptions`; `solveInputFor` is de enige weg
  (`solveInput.ts`), en `runCPM`/nivelleerder gebruiken hem (`scheduleSlice.ts` diff).
- **Migratie.** `legacyOptionsToProfile` met gepinde `LEGACY_XER_ALWAYS_ON`/`_ALSO_ON_X12`;
  `legacyXerDefault` ⇒ `builtIn.p6` (B3/B4/C1/C4 dus uit); niet-XER-blob gooit de `gatedByP6Source`-
  conventies weg; basis `msproject` alleen bij A22+A23. `legacyOptionsBlobFor` schrijft alleen A22/A23 —
  en A12/A13 zaten in v2026.9.0 niet in `SchedulingOptions` (gecontroleerd tegen de tag), dus de
  neerwaartse claim klopt.
- **IFC-pset.** `sanitizeSchedulingProfile` (`schedulingOptionsRead.ts:218-238`): onbekende basis ⇒
  ops, ontbrekende sleutel ⇒ `legacyValue`, letterlijke afwijking die de opgeloste set tegenspreekt ⇒
  genegeerd, te grote JSON geweigerd; `carriesProfile` houdt een OPS-bestand byte-identiek.
- **`switchProfile`/`isDefaultProfile`** letterlijk zoals gespecificeerd; `selectProfile` draagt per-bestand-
  waarden over bij sjabloon en vanaf een eigen profiel (`check-scheduling-profile-draft.ts` 25-29).
- **Undo.** `applyProjectInfo`: één `beginUndoable`, `finishMutation({stale:true})`, dan `runCPM()`; no-op
  bij `sameSettings`; naamloos eigen profiel geweigerd.
- **Nivelleringsfundament inert.** `leveling` wordt alleen gelezen in `xerScheduleOptions`, `ifcReader`,
  `readTools`, `mspdiWriter`; `levelingInput.ts` heeft nul importeurs onder `src/engine`;
  `ResourceLeveler.ts` wijzigt alleen de signatuur. De kolommapping is gesloten en wijst nooit naar
  bronuitvoer.
- **Manifest.** `decision`-vorm, datum niet in de toekomst (UTC + 1 dag), alleen op inbegrepen orakels,
  dubbelen en niet-rakende regels geweigerd; het pinblok is gedigest. Uitsluitingsredenen per taak citeren
  het bewijs (span < restduur) — inhoudelijk juist gemotiveerd, geen "pinnen met reden" (behalve het
  meetlat-gat onder 1, dat mechanisch is, niet inhoudelijk).
- **UI B2/B5.** Vertrekbewaking via `backstageLeaveGuard` op zijbalk, Terug, Escape, F1, lintkeuze en
  meldingsacties; Ctrl+1–9/N/O geblokkeerd; `UnappliedChangesDialog` op de gedeelde `Dialog` zonder
  Enter-als-Toepassen. Document-tabbalk/rail niet bewaakt — in de PR-body als bekend gat gemeld, klopt.
- **i18n/tekstrollen.** `conventions.p6AlapPositionedFromSuccessors`, de zes themasleutels en `perFile`
  staan in alle 14 `common.json`; de sectie gebruikt alleen `text-body`/`text-heading`. `verify` EXIT=0 op
  de kop dekt `verify:i18n`, `verify:text-roles`, `verify:docs`.
- **C14 tegen Oracle.** "Zo laat mogelijk zonder opvolgers te vertragen" = strengste opvolgergrens op de
  minuut, keten aaneengesloten, ondergrens statusdatum/voorgangers, opvolgers bewegen niet — dat is de
  P6-ALAP (nul vrije speling, totale speling behouden). Alleen de uurmodus-poort (bevinding 5) is vreemd.
- **C11 tegen Oracle.** Progress Override negeert de relatie naar een gestarte, niet-voltooide opvolger
  ook achterwaarts en in de vrije speling, alleen onder `progressMode === 'PROGRESS_OVERRIDE'`
  (`CPMSolver.ts:744-749`) — consistent met "the relationship is ignored".
- **A19 late kant (restduurregel)** is wél een gedocumenteerd P6-principe (Oracle-citaat in het docblok).

## Wat de eerdere reviews misten

1. Het uitsluitingsgat (bevinding 1): de orkestrator zag alleen het netto-effect binnen een bestaande
   uitsluiting (haar bevinding 8) en noemde de uitsluitingen "geen pinnen met reden"; mechanisch kan de
   meetlat dat niet garanderen. Mutatie (e) bewijst het in drie runs.
2. De A19-vlag (bevinding 2): niemand heeft het corpus op `rem_target_link_flag = N` geteld (0) of het
   [VERMOED] in het docblok tegen de gids gelegd, terwijl er een hele UI-laag op is gebouwd.
3. De reset/fork-asymmetrie op per-bestand (bevinding 3): de UI-critreview stelde de vraag, het antwoord
   "bedoeld" is als test gepind.
4. `verify:conventions` als namenlijst (bevinding 4) en de `isHourMode`-proxy's (5): "de motor kent geen
   bronformaten" is als slogan gereviewd, niet als poort.
5. C5's `CP_Phys`-poort (6): de populatie is 100 % CP_Phys, dus "breed wint geen cel" bewijst niets.

## Kon ik niet controleren

- Oracle-documentatie niet online geraadpleegd (geen web); de betekenis van `rem_target_link_flag`
  komt uit mijn kennis van de P6-XML-mapping — daarom [VERMOED · hoog], niet [BEVESTIGD].
- `npm run verify`, `measure:profiles` en de browsersuite niet zelf gedraaid (verboden); uitslagen uit de
  logs van de orkestrator overgenomen (EXIT=0 / MEASURE_EXIT=0).
- Geen echte v2026.9.0-binary geopend om het neerwaartse pad live te zien; alleen de typen op de tag.
- `.mpp`-kant (216 pins) en de MSPDI-/P6-XML-exportverliezen niet doorgelicht.
- De tekst van `2026-09-24-pr169-body-voorstel.md` niet tegen de kop gelegd.

## Eigenaarsvragen

1. **A19-basis.** Zet je A19 in het P6-profiel op aan en laat je het per-bestand-mechanisme (badge,
   overdracht, `(aangepast)`) vallen tot er een `N`-bestand met P6-uitvoer is? Of houd je het per bestand
   met een expliciet voorbehoud in gids en spec ("vlag is ongetoetst")? Mijn advies: aan + laten vallen.
2. **C5 breed of smal.** Wil je voltooide `CP_Drtn`/`CP_Units`-taken onder P6 ook op de statusdatum
   zetten (P6-regel volgens de gemeten vorm) — of blijft "smal" tot een bestand het bewijst? Zonder
   bestand is het een gok in beide richtingen; mijn advies: smal houden, maar de naam en de gidsregel
   eerlijk maken ("gemeten op CP_Phys; CP_Drtn niet gemeten").
3. **Uitsluitingen als eigenaarsbesluit.** Wil je dat de meetlat mechanisch afdwingt dat een uitsluiting
   nooit een regressie meeneemt (fix bevinding 1)? Dat kost je niets aan vrijheid — een uitsluiting van
   een taak die de motor tegelijk slechter maakt, moet dan in twee commits.
4. **Per-bestand reset.** Als 1 niet "laten vallen" wordt: mag "terug naar basis" op een per-bestand-regel
   verdwijnen?

## Oordeel

**LANDEN-MET-FIXES.** Fundamenteel gezond: één motor, benoemde conventies, per cel geratcht, en een
gewone motorregressie komt er niet doorheen (zelf bewezen). Vóór de merge minimaal:

1. Bevinding 1 — de per-as-delta-check op `excludedHidden` bij een identiteitswijziging, met mutatie (e)
   als case. Klein, mechanisch, geen eigenaarsbesluit nodig.
2. Bevinding 3 — geen resetknop/geen fork op `perFile` (of het A19-besluit dat haar overbodig maakt), plus
   het [VERMOED] uit `types/project.ts:126-127` letterlijk in `gids-rekenprofielen` nl+en.
3. Bevinding 8 — PR-body op 27/76/42 en de gemergde stand.

Bevindingen 2 en 6 zijn eigenaarsbesluiten en mogen als eigen etappe ná de merge; 4, 5, 7, 9, 10 zijn
verbeterwerk dat het oordeel niet draagt.
