# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Afgeronde items worden uit
deze lijst verwijderd — wat klaar is, staat in de changelog en git-historie.

## Openstaand

- [ ] **Rekenprofielen / X12 (PR #169, stand 2026-09-24):** restant 76 zesassige afwijkingen op de
  P6-doorgerekende orakels — HarbourPointe-opvolgers van verouderde P6-uitvoer (nieuw P6-bewijs nodig),
  mijlpaalvloer (n=1), Sample SF-lag-0-minuut (n=1). Eigenaarsbesluiten 2026-09-24: A19 in P6 aan en
  per-bestand vervallen ("a", branch `claude/x12-a19-basis`); C5 smal. Zie `docs/superpowers/plans/2026-09-22-rekenprofielen-overdracht.md` §1d.
- [ ] **P6-nivellering (motoretappe):** fundament (data) ligt; vijf eigenaarsbesluiten in
  `docs/superpowers/plans/2026-09-24-nivellering-etappe-onderzoek.md` §8.
- [ ] **Datums zoals opgeslagen (PR #167) vervolg:** een taak zonder enige vastlegging telt na opslaan-in-modus
  bij heropenen als vastgelegd (geen vals aanbod, wel in de telling).

### Rapporten (tabelrapporten uit discussie #31, review 2026-09-08)
- [ ] **Twaalf vertaalde gidsen beschrijven een niet-bestaande knop "Afdrukken…".** In
  `public/docs/{de,fr,es,it,pt,pl,tr,ar,fa,zh,ja,ko}/gids-rapporten-printen.md` staat nog dat het
  instellingenpaneel een printknop met systeemdialoog heeft; die is er niet (alles gaat via
  Exporteer PDF). nl en en zijn gecorrigeerd; de rest volgt in de maandelijkse vertaalronde.
  `verify:docs` vangt proza niet.
- [ ] **Relatiepijlen in de Gantt-afdruk over een paginagrens.** Sinds issue #110 eindigt een
  pagina op een rijgrens, maar een pijl tussen twee rijen op verschillende pagina's wordt nog
  gesneden. Inherent aan tegelen; een oplossing (pijl per pagina afkappen met een markering) is
  renderer-werk.
- [ ] **RTL-tabelrapporten: DOM spiegelt kolommen, PDF niet.** Een `dir=rtl`-locale (ar/fa)
  spiegelt de HTML-tabel; de vector-PDF tekent de kolommen LTR. Niet geverifieerd in een echte
  browser; wel een bekende divergentie tussen de twee weergaven.

### Bedrijfsbibliotheken (B1.1) — vervolgen (2026-07-24)
- [ ] **B1b-vervolg: "alle resources"-histogram verkennen** (wens eigenaar 2026-08-14). De
  per-dag-data ligt er na B1b al (`dailyLoad` per booking). Drie kandidaatvormen, kiezen ná
  praktijkervaring met v1: (a) totaalsom over alle poolitems zoals "All resources" in het
  projecthistogram, met rood op dagen waarop minstens één item boven zijn capaciteit zit;
  (b) mini-histogram/sparkline per tabelrij, elk op eigen schaal met eigen capaciteitslijn;
  (c) heatmap resources × dagen met bezetting-t.o.v.-capaciteit als celkleur (de klassieke
  "resource usage"-weergave, schaalt het best bij grote pools).
- [ ] **B1c — bediening van "Verdelen over projecten" (UI).** Rekenkern (`computeDistribution`,
  `src/services/library/distribute.ts`, B1c-etappe 2) en schrijfpad (`applyDistribution`/
  `undoDistribution` in `librarySlice`, via de headless scratch-instantie; B1c-etappe 3) zijn
  gebouwd, maar op `main` is er nog geen dialoog die ze aanroept (geen `applyDistribution` in
  `src/components/`). De dialoog (`DistributionDialog`, plan 3 taken 8 e.v. + plan 4) is gebouwd op de
  branch `origin/t3code/b1c-etappe3` en niet gemerged (`ee882777` nam bewust alleen de kern mee).
  Rest: die verdeeldialoog met pins, plafonds en de onderbrekingsschakelaar landen — ontwerp in
  `docs/superpowers/specs/2026-09-12-b1c-verdeeldialoog-herontwerp-design.md` en
  `docs/superpowers/plans/2026-09-12-b1c-plan4-verdeeldialoog-herontwerp.md`; zie ook
  `docs/library.md` punt 5.
- [ ] **Gedeelde opslag/sync** tussen machines (wortel van alle drie de B1.1-beperkingen: pool-
  divergentie tussen planners, bezettingsoverzicht dat alleen de eigen machine ziet, en
  stilzwijgend overschrijven tussen twee tabbladen/vensters op dezelfde machine).
- [ ] **Welke projecten gebruiken een resourcebibliotheek, met knop Openen** (wens eigenaar, geparkeerd
  2026-09-04 tot ná B1c-etappe 3). OPS heeft geen projectindex: de app kent alleen open documenten en
  de recente-bestandenlijst, en de bibliotheekbinding staat ín het IFC. Enige eerlijke route zonder
  index: bij koppelen/opslaan een stempel (project, pad, bibliotheek, laatst gezien) in de app-globale
  bibliotheekopslag wegschrijven en die lijst tonen — met dezelfde grens als het bezettingsoverzicht
  (alleen deze machine, dood pad na verplaatsen). Niet: bij elk openen van het bibliotheekscherm alle
  recente IFC-bestanden lezen (browser vraagt per bestand toestemming).
- [ ] **Kalenderpromotie naar de Resources-tab** verhuizen — momenteel een bewuste fase-1-interim
  in Backstage → Bibliotheek (resourcepromotie/-CRUD is al verhuisd). Zie docs/library.md
  "Resources-tab: Bedrijfsweergave en Projectweergave".
- [ ] **Cross-document-plakken verliest resource-toewijzingen stil** (bestaand gedrag van vóór
  B1.1, herbevestigd in de B1.1-vlootverificatie). Toewijzingen wijzen naar resource-id's van het
  brondocument; plak je taken in een ánder document, dan blijven die id's onopgelost en verdwijnen
  de toewijzingen zonder melding. Minstens een melding is de korte-termijn-fix; via de
  herkomststempels (§spec) zou het ook automatisch kunnen herkoppelen aan dezelfde gedeelde
  bedrijfspool-resource, mits beide documenten aan hetzelfde bedrijf gebonden zijn.
- [ ] **Twee gelijknamige bedrijven zijn in selectors niet te onderscheiden.** De
  bedrijfsselectors (projectinfo, koppeldialoog) tonen alleen de bedrijfsnaam; bij twee bedrijven
  met dezelfde naam (bv. na hernoemen of dubbele import) valt met het blote oog niet te zien welke
  van de twee je selecteert. Kandidaat-fix: secundair kenmerk tonen (aanmaakdatum, id-fragment) bij
  naamcollisie.
- [ ] **Projectinfo-selector toont visueel "geen bedrijf" bij een binding aan een niet-meer-
  bestaand bedrijf.** `project.companyId` behoudt de dode id wanneer het gekoppelde bedrijf
  inmiddels verwijderd is; de selector valt dan terug op "geen bedrijf" i.p.v. de binding zichtbaar
  als kapot te markeren. Verder onschadelijk (los-gedrag, geen dataverlies) — presentatie-polish.
- [ ] **Herkenning-performance-schaalgrens bij grote pools (1000+ items).** `computeRecognition()`
  (LibraryLinkDialog) herberekent bij elke render zonder memoization; bij bedrijfspools met 1000+
  resources/kalenders kan dat merkbaar worden. Niet gemeten binnen B1.1-scope (pools in de
  vlootverificatie waren klein); kandidaat-fix: memoiseren op pool-/documentversie zoals elders in
  de store.
- [ ] **Undo na ontkoppelen laat een inconsistente tussenstaat achter.** `unbindProject`/
  `bindProjectToCompany` doen `beginUndoable()`, maar `project.companyId` valt (op `wbsAutoNumber`
  na) bewust buiten de undo-snapshot (B3-uitzondering in `src/state/snapshot.ts`). Een Ctrl+Z na
  ontkoppelen zet dus de `libraryOrigin`-stempels terug op een project dat ontkoppeld blíjft. Geen
  dataverlies (los-gedrag, stempels zijn inert en zelfherstellend bij terugkoppelen), maar wel
  verwarrend. Gevonden bij de critreview op de ProjectInfo-unificatie (2026-07-25).
- [ ] **Standaardbibliotheek zou een gegenereerd id moeten krijgen i.p.v. de vaste
  `DEFAULT_COMPANY_ID`-constante** (critreview F1/F8 op pool-import, issue #19). Vrijwel elke
  installatie heeft hooguit één resourcebibliotheek onder dat vaste id — waardoor `importPoolAsNewCompany`
  het (terecht) als `isReservedCompanyId` behandelt en er nooit de identiteit uit een geïmporteerd
  bestand voor behoudt. Praktisch gevolg: een meegestuurd project van een eenpitter-collega (de
  meest voorkomende situatie) herkent zijn bibliotheek na "toevoegen als nieuwe resourcebibliotheek"
  niet automatisch — de ontvanger moet de herkenningsstap zelf één keer doorlopen (zie
  docs/library.md "Bekende beperkingen" en de gebruikersgids). Zou het standaardbedrijf bij de
  EERSTE start een vers gegenereerd id krijgen (i.p.v. de gedeelde constante), dan werkt automatische
  herkenning ook voor eenpitters. Vergt een migratie voor bestaande installaties (opgeslagen
  bibliotheken én de `libraryOrigin`-stempels die al naar `DEFAULT_COMPANY_ID` wijzen) — daarom nu
  niet gedaan; `DEMO_COMPANY_ID` blijft sowieso bewust vast (idempotente seed, spec-eis).
- [ ] **"Losmaken van de bibliotheek" als MCP-actie.** `planner_manage_resources` weigert de
  bibliotheekvelden op een gestempeld item (gespiegeld aan het UI-slot, 2026-07-27); die
  weigering verwijst naar losmaken als de begaanbare route, maar de bridge kan die route alleen
  bénoemen, niet lopen — de assistent moet de gebruiker vragen het handmatig te doen.
  `unlinkResourceFromLibrary` bestaat al als store-actie, is projectlokaal en ongedaan te maken.
  Overwegen: dezelfde actie voor kalenders, en of het een eigen tool wordt of een `action` op
  `planner_manage_resources`.

### MCP-bridge — robuustheid van de server zelf (2026-07-27)

> Gemeten tijdens de eerste echte koppelpoging. Beide punten gaan niet over de tools maar over de
> schil eromheen: de bridge kan in een toestand raken waarin hij nog luistert maar niets meer
> beantwoordt, zonder dat iemand dat merkt. Dat is dezelfde faalklasse als de stille no-ops die deze
> ronde zijn opgeruimd — alleen een laag dieper.

- [ ] **De bridge merkt niet dat het venster erachter weg is.** Gemeten: het venster dat poort 3877
      bezat had een hot-reload gehad, waardoor de frontend-listeners uit `createBridgeController`
      verdwenen waren. De Rust-kant bleef luisteren; élke aanvraag liep vast tot de 120s-timeout.
      Ook een aanvraag **zonder token** — die hoort puur in Rust op een 401 te stranden en raakt de
      webview helemaal niet — bleef hangen, dus één blokkerend verzoek zet via de serialisatie-mutex
      ook al het verkeer erachter vast. Een client ziet dan geen fout maar twee minuten stilte.
      Richtingen: de auth-/Origin-/methode-afwijzingen vóór de mutex afhandelen (die hebben de
      webview niet nodig), een korte hartslag naar de frontend met een snelle "geen luisteraar"-fout
      i.p.v. de volledige timeout, en de frontend zijn listeners laten herstellen na een reload.
      Hot reload bestaat alleen in dev, maar een gecrashte of vastgelopen webview in een echte
      installatie geeft exact hetzelfde beeld.
- [ ] **Een tweede app-instantie is onzichtbaar voor de gebruiker.** De dubbele bewaker
      (`scripts/tauri-dev.mjs`) verhindert twee dev-servers, maar niet twee app-vensters — terwijl de
      bridge-poort een singleton is. Wie als tweede start krijgt "poort bezet", wat klopt maar niet
      vertelt dát er al een ander venster luistert (laat staan welk). Waargenomen na een crash van de
      ontwikkelomgeving: een verweesde instantie hield de poort vast terwijl de gebruiker in een
      nieuwer venster zat te kijken. Richting: bij "poort bezet" onderzoeken of het onze eigen app is
      en dat benoemen in de statusmelding.

### IFC-lezer — resterende punten uit de release-review v2026.7.13 (2026-07-27)

> Gevonden bij de hyperkritische review op de releasekandidaat, nadat die twee keer op de
> `DATA;`-sectiegrens was misgegaan. De blokkerende gevallen zijn gerepareerd en vastgepind in
> `tests/planning/check-step-strings.ts` (batterij 9); dit zijn de resten die de release niet
> tegenhielden.

- [ ] **Een rauwe apostrof in een taaknaam in de DATA-sectie verliest nog steeds stil data.** Een
      handgeschreven of door een derde tool geschreven `#2=IFCTASK('g2',$,'Van 't Hof',…)` levert
      nul taken op zonder fout: de sectiegrens wórdt gevonden, dus `no-data-section` vuurt niet, en
      de quote-bewuste entiteitsscan loopt daarna uit de pas. v2026.7.12 gaf hier 2 taken met een
      verminkte naam. Onze eigen writer produceert dit niet (taaknamen gaan altijd door `ifcStr`),
      dus eigen bestanden zijn veilig — maar een geïmporteerd bestand kan er zo uitzien. Richting:
      per entiteit detecteren dat de scan een niet-afgesloten string tegenkomt en dan óf de regel
      overslaan met een melding, óf de hele lezing als getypeerde fout afkeuren. Niet stil nul.
- [ ] **De leesfouten zijn hardgecodeerd Nederlands.** `not-step`, `truncated` en `no-data-section`
      gooien een Nederlandse `message` die via `notify({ detail })` letterlijk in de UI belandt —
      ook in een Engelse, Japanse of Arabische interface. Richting: de `reason` is al getypeerd, dus
      een `messageKey` per reason en de vertaling bij de aanroeper.

### IFC-kalenderbibliotheek — resterende punten (2026-07-27)

> Gevonden tijdens het overzetbaar maken van uurkalenders via de MCP-bridge. Beide punten zijn
> **beschreven** in de tool-descriptions en met tests vastgepind, dus niets gebeurt stil.

- [ ] **Per weekdag verschillende uurbanden overleven een round-trip niet.** IFC draagt één
      werkweek-patroon, dus alle werkdagen krijgen bij herladen de banden van de eerste werkdag —
      een korte vrijdag komt terug als kopie van maandag (`ifcWriter.ts` schrijft nog alleen
      `workTime.byWeekday[firstDay]`; H7/#239 loste de scalar-werktijd op, niet dit).
- [ ] **Wélke kalender de projectdefault is, kan de bridge niet wisselen** (de inhoud ervan wel, via
      het id uit `projectDefaultId`). `update_project.calendarId` weigert nu met die uitleg. Beoordeel
      of dat een echte beperking moet blijven of gewoon nog gebouwd moet worden.

### MPP/MSP-import (fase 3.8, etappe "nul afwijkingen") — bewust laten liggen (2026-08-19)
- [ ] `CPMSolver.ts` leveling-takvolgorde: een taak met zowel `levelingDelay` (dagen) als `levelingDelayMinutes` zou aan de ankerregel ontsnappen (vandaag onmogelijk — lezer zet alleen minuten, nivelleerder alleen dagen); precedentie-commentaar benoemt dat geval niet (Z6-veeglijst).
- [ ] `CPMSolver.ts` M1-bandsnap-float-nuance: de bandsnap kan de ES verder duwen dan de kale leveling-delay terwijl de backward-doorgifte alleen de kale delay terugrekent — float-nuance op elapsed-delay-WORKTIME-taken, geen datumeffect (Z6-veeglijst).
- [ ] `CPMSolver.ts` `isExactBandEnd`/`dayFirstBandStart`/`dayLastBandEnd` leunen stilzwijgend op de engine-brede oplopend-gesorteerde-banden-aanname (`effectiveBandsOn` sorteert niet) — docblok-vermelding zoals `nextBandStartStrictAfter` die wel heeft (Z13-veeglijst R3).

> Uit de Z20-eindronde: dingen die deze etappe bewust NIET meenam, met de reden erbij — zodat het
> geen verrassing is als iemand er later tegenaan loopt.

- [ ] **Native MSPDI-`<Manual>`/`<LevelingDelay>` lezen en schrijven.**
      Orkestratorbesluit O4 (2026-08-17): native schrijven zonder terugleeslezen zou een stille
      semantiek-omklap zijn (hetzelfde precedent als `ELAPSEDTIME`) — de MSPDI-export waarschuwt
      daarom bewust in plaats van deze elementen te schrijven. `<TimephasedData>` is sinds de
      contour-engine-etappe (2026-09) WÉL native lezen+schrijven (`mspdiReader.ts`/`mspdiWriter.ts`,
      `contourIo.ts`); de andere twee blijven een eigen, kleine vervolg-etappe.
- [ ] **Native MSPDI-/P6-schrijven van een split zonder urenverdeling.** Een onderbroken taak zonder
      contour gaat nu zonder onderbrekingen naar MSPDI/P6 (de export meldt het aantal via
      `exportSplitsLostNotice`). Vervolg: de pauzes als `<TimephasedData>`-/spreidingsvorm van de
      toewijzingen schrijven, of — bij een taak zonder toewijzing — een verantwoorde alternatieve vorm
      kiezen. CSV verliest onderbrekingen eveneens, en meldt dat nog niet.
- [ ] **Nivelleerder blind over importsplits.** Een taak met een `'user'`-gat wordt niet meer
      opgeknipt (issue #146), maar een IMPORTsplit (geen `source`) mag de scatter-as nog overstapelen
      — vastgelegd als bestaand gedrag in `check-leveler-splitmode.ts` geval 4. Gaten-bewust opknippen
      is een eigen etappe.
- [ ] **Float-spiegel onvolledig bij deeldag-duren (Z13-hercheck R2).** `subDuration`s band-eind-
      float-spiegel klopt voor hele-dag-duren maar niet voor een deeldag-duur op een deeldag-kalender
      (12u-taak op een 8u-dag: gemeten `tf` 1,5 waar `LF−EF` 2,5 hoort — één werkdag te weinig).
      Corpusincidentie 0, wel app-zichtbaar bij een taakstart aan het eind van de werkdag. Structurele
      plek voor een fix: de float-laag (`scheduleAnalysis.computeScheduleResults`, die formule-invoer
      al corrigeert voor hammock/manual — zelfde behandeling voor een gedegenereerd band-eind-anker).
- [ ] **Dangling `resourceCalendarId` in timephased walks na `removeCalendar` (Z19-hercheck R4).** Een
      `timephasedDurationWalks`-item dat naar een inmiddels verwijderde resourcekalender verwijst
      valt stil terug op de projectkalender — pre-existing `resolveCalendar`-semantiek, geen
      regressie van deze etappe, maar onopgemerkt zolang `removeCalendar` niet zelf valideert/opschoont.
- [ ] **Bewerkgedrag-meetlat (taaktypes-spec) als voorwaarde voor de Z19-L-segments-afweging.** Of de
      holiday-bewuste laag-4-activering op de `mpp14timephasedsegments*`-fixtures bij een ANDERE duur
      dan de opgeslagen klopt, is met het huidige harnas onverifieerbaar — bewerkgedrag-fidelity heeft
      nog geen meetlat. Wacht op de bewerken-zoals-MSP-meetlat uit de taaktypes-etappe
      (eigenaarsbesluit 2026-08-18: task type/effort-driven als aparte etappe, niet hier).

### Contour-engine (2026-09) — geleverd en bewust laten liggen

> Etappe "contour-engine" (`src/engine/contour/contourEngine.ts`, `src/services/contourIo.ts`,
> `tests/planning/check-contour-engine.ts`): de dagverdeling van een toewijzing is nu DATA
> (opgeslagen contour of exacte 21-punts-curve) met de `distributeUnits`-formule als terugval;
> histogram/overallocatie/nivelleerder/bezetting lezen dezelfde `assignmentDayUnits`; een
> duurwijziging herschaalt de contour proportioneel; MSPDI `<TimephasedData>` en P6
> `<ResourceCurve>`/`<ResourceCurveObjectId>`/spreidingsstrings zijn native. Zie CLAUDE.md.

- [ ] **Fasen als opslagvorm.** `TimephasedContourPeriod` kan een fase van tien dagen als één
      periode dragen, maar de editor slaat bewust één periode per werkdag op (byte-identieke
      round-trips). Een fase-periode zou het IFC compacter maken; vergt een controle dat
      `periodsToWorkDaySlots` mét splits een lange periode over een gat correct verdeelt (de
      engine deelt naar rato van as-lengte, dus een gat middenin een lange periode "eet" werk op
      dat naar het volgende werkslot schuift).
- [ ] **Sleepbare fasen op de Gantt-balk zelf** (buiten het venster). De strook leeft nu in het
      venster; op de balk zou het de renderer- en pointer-lagen raken (`verify:gantt-boundaries`).
      Pas bouwen als gebruikers erom vragen.
- [ ] **Contour via MCP en het taakraster.** De draft-API (`createMcpTransactions.setAssignmentContour`)
      bestaat, maar er is nog geen `planner_*`-tool met contract/schema (route: `docs/recepten/mcp-tool.md`).
      De rasterkolom *Toewijzingscurve* (`assignment.curve`, `TaskCellEditor.tsx`) toont een
      gecontoureerde toewijzing nog als "uniform" en laat een curvekeuze toe die geen effect heeft
      zolang de contour bestaat — het paneel toont daar wél "Contour" en schakelt de dropdown uit.
- [ ] **Herkomstmarkering na een MSPDI-import.** `TaskTimephasedNotice` kiest tussen "datumvenster
      losgelaten" (grijs, MS Project-tekst) en "eigen urenverdeling" (grijs, neutraal) op de
      heuristiek `resourceUid !== null` — die zetten zowel de `.mpp`- als de MSPDI-lezer. Een vers
      geïmporteerd MSPDI-bestand met contouren toont daardoor de "losgelaten"-tekst terwijl er nooit
      een datumvenster wás (MSPDI kent geen laag-3/4-sturing). Pre-existent (vóór de contour-UI
      stond die tekst er ook), maar nu zichtbaarder; echte oplossing = een herkomstveld op de
      contour (IFC-round-trip) of `resourceUid: null` in de MSPDI-lezer als de writer 'm niet nodig
      heeft.
- [ ] **Contour van een taak in uur-modus met ongelijke werkdagen.** Het dialoogvenster rekent in
      dagslots van `hoursPerDay × 60` (zie het benaderingspunt hieronder); een korte vrijdag staat er
      als gewone rij. Correct voor de lastlezers (dezelfde slotdefinitie), maar de urenkolom
      suggereert meer precisie dan de as biedt.
- [ ] **Bewerken-meetlat tegen MS Project.** De herschalingsregel (proportioneel, actuals blijven,
      FIXED_WORK houdt werk) volgt MSP's gedocumenteerde gedrag maar is niet tegen MSP zelf
      gemeten — de taaktypes-spec noemt die meetlat als de duurste post van de vervolgetappe.

### Taaktypes / opgeslagen werk — vervolgpunten (gemerged via PR #170, 2026-09-26)

> Ontwerp: `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md` (opvolger van de
> spec van 2026-08-18). Gebouwd op PR #101 en als PR #170 (overname op de rekenprofielen-kop)
> naar `main` gemerged. De gids `gids-taaktypes` bestaat in nl+en; de twaalf vertalingen volgen in
> de maandelijkse ronde. Eigenaarsbesluiten 1–10 staan in spec §3.

- [ ] **MS Project-meting van K2 en de Δ-regel (§6.4/§6.5):** beide zijn *documented* voor de richting
      en *reasoned* voor de OPS-werkdagen; wie MS Project heeft, meet cases 32–36 plus "duur wijzigen
      op een taak met ingevoerde resterende duur" en noteert de uren.
- [ ] **K2 niet bedraad op twee randpaden (review G9, 2026-09-05):** `projectSlice.setCalendar`
      (vervangt de hele projectkalender; geen UI-aanroeper meer, wel API-oppervlak) en
      de `workTime`-verwijdering ná `draft.updateCalendar` in `calendarResourceTools.ts` wijzigen de
      slot buiten `settleCalendarChange` om. (`resolveDeviation(ref, 'company')` en de rest van de
      bibliotheekverversing zijn sinds H6, 2026-09-26, wél bedraad — zie `docs/library.md`.) Bedraden zodra een van die paden weer een UI-ingang
      krijgt; tot dan volgt de werkregel daar niet. Daarnaast (G10): `updateCalendar`/
      `setProjectCalendar` wissen het Z8-venster alleen wanneer de regel de duur wijzigt, terwijl
      `setTaskCalendar` dat bij elke kalenderwissel doet — zelfde trigger, ander gedrag.
- [ ] **Crashherstel ontsluit zonder melding (review K2, 2026-09-05).** `restoreDocuments` leidt
      `taskTypesVisible` correct af (`payloadFromImport`) maar loopt niet langs `applyLoadedProject`,
      waar de eenmalige melding zit — na herstel verschijnen de bedieningselementen zonder uitleg.
      Bewust gelaten: herstel is dezelfde gebruiker in (meestal) dezelfde sessie. Meenemen zodra
      `restoreDocuments` andere laadmeldingen krijgt.
- [ ] **Werkinvoer ≤ 0 in het paneel weigert stil** (review K6a): rode rand via `aria-invalid`, geen
      melding — zelfde conventie als de inzetinvoer (`isValidUnits`).
- [ ] **Per-toewijzing-spanne (vervolg op beslispunt 10).** MS Project en P6 laten de ene resource op
      een taak eerder klaar zijn dan de andere; OPS laat elke toewijzing over de hele restduur lopen
      (spec §6.2: verhoog je op een vast-werk-taak de inzet van één resource, dan wordt de taak korter
      en gaat de ándere resource dunner over die kortere duur in plaats van eerder klaar te zijn).
      `ResourceAssignment.workWindowStart/Finish` bestaat al, round-tript door IFC
      (`OPS_TimephasedWindow`) en het extensiecontract, maar geen lezer vult het en geen solverstap
      leest het. Activeren raakt `assignmentDayUnits` (histogram/nivelleerder/bezetting), de
      renderer (balk per toewijzing?) en de MSPDI-/P6-exports (per-assignment start/finish).
      Zichtbaar gevolg sinds E9 (25-09): onder *Vaste inzet* komt inzet heen en terug op één
      toewijzing weer op de oude duur uit, maar met twee of meer toewijzingen niet — de andere volgt
      de langere duur met afgeleid werk (MSP houdt haar werk en geeft haar een kortere spanne).
      Gepind in `check-work-triangle.ts` (b); spec §3.4.
- [ ] **MSP-meetlat: 36 bewerkingen** (spec §9) meten in MS Project (en P6) zodra iemand het heeft;
      tot dan draagt elke case `evidence: 'documented' | 'reasoned' | 'decided'` in `work-triangle-cases.json`.
- [ ] **Telling `mspTaskType × effortDriven` over de `OPS_MPP_CRAWL`-set** (216 bestanden): bepaalt
      hoe vaak beslispunt 8 in de praktijk speelt. Het corpus is niet in de repo.
- [ ] **Nivelleerder-optie "inzet verlagen bij vast werk"** (eigenaarsbesluit 7-B, 2026-09-04) als
      geavanceerde optie naast het verschuiven; de verdeler raakt nu nooit inzet of werk.
- [ ] **% werk gereed** (MSP % Work Complete) naast de duurgebaseerde `completion`.
- [ ] **Projectstandaard-werkregel in de UI** (projectwizard/projectinfo); het veld bestaat sinds
      bouwstap 1 en is via `planner_update_project` (`defaultWorkRule`) zetbaar; de gids noemt dat.
- [ ] **P6-optie "preserve existing assignments"** bij resource erbij: OPS volgt altijd de
      synchronisatietabel ("recalculate"); de preserve-variant is een instelling voor later.
- [ ] **Uur-modus-dagslot is een benadering.** De engine deelt de as in slots van `hoursPerDay × 60`;
      een werkdag met afwijkende bandlengte (korte vrijdag) telt daardoor als een deel-slot — dezelfde
      benadering als `enumerateTaskWorkDays`, dus consistent, maar geen echte per-dag-bandtelling.

### Resourcekalender-semantiek — taak volgt resourcekalender als keuze (besluit eigenaar 2026-09-04)
- [ ] **"Taak volgt resourcekalender" als opt-in** (besluit eigenaar 2026-09-04, deel 2). Overallocatie
  op een vrije dag van de resource is bewust gedrag (`ResourceLoad.ts` §4: capaciteit 0 op niet-werkdagen
  van de resourcekalender; P6-"Task Dependent"-semantiek). Deel 1 (uitleggen) is gebouwd: het
  waarschuwingenpaneel (`warnings.kind.overallocationNonWorkingDay`) en de histogram-tooltip
  (`describeNonWorkingDay`) zeggen dat de resource die dag volgens zijn kalender niet werkt. Rest: een
  echt ontwerp voor MS Project-/P6-"Resource Dependent"-gedrag als opt-in per taak of per project, in
  lijn met de opt-in-richting voor taaktypen. Raakt de CPM-motor en moet tegen de `.mpp`-fidelity-poort
  gemeten worden. Bewust NIET gekozen: nivelleren als oplossing — dat is een pleister op een
  kalendermismatch, geen capaciteitsconflict.

### Solver/presentatie — resterende punten (2026-07-20)

> De vier oorspronkelijke punten uit de 2.10-showcase-triage zijn afgerond op 2026-07-20; zie de
> changelog. Twee ervan bleken een andere oorzaak te hebben dan het item beschreef: de `TF=-4` was
> geen hard-pin-interactie maar een off-by-one plus feestdag-blinde dag-index in de
> showcase-generator, en het "plan vs. forecast"-punt was geen presentatiekwestie maar een echte
> bug in het eigenschappenpaneel. Onderstaande punten zijn er tijdens dat werk bij gevonden.

> **Onderzocht op 2026-07-20 (headless probes tegen de echte solver).** Het vermoeden bestond uit
> twee armen; er bleek er één echt te zijn.
>
> **VERWORPEN — de uur-pred/dag-succ-arm.** Daar ontbreken de grensvlaggen terecht: `predDoneAt` is
> in uurmodus letterlijk de identiteit (`CalendarEngine.ts:495-498`), dus beide takken van de
> forward-uitdrukking leveren dezelfde instant en er valt niets te spiegelen. Empirisch bevestigd:
> alle varianten met vlaggen geven niet-negatieve float. **Niet opnieuw onderzoeken.**

- [ ] **Anker versus berekend: `scheduleStart` als datamodel-vraag.** Het symptoom "je getypte start
      lijkt genegeerd" is voor taken mét voorganger opgelost in #231 (een getypte of gesleepte start
      wordt "Start niet eerder dan", `src/engine/startEditConstraint.ts`). Wat blijft is de
      modellering: het anker `scheduleStart` naast de berekende start, zonder consistente labels
      ("Anker" vs "Berekend") over tabel, `TaskDialog` en paneel. Nette oplossing = het anker alleen
      bewaren bij taken zonder voorgangers, óf het als apart "Plan"-veld benoemen. Raakt store,
      IFC-round-trip, taakraster (`FullTaskGrid`), `TaskDialog`, paneel, `check-ifc-roundtrip.ts` en
      i18n — eigen golf.

### Samenvattingsrelatie-propagatie — resterende punten (CPM-review, 2026-08-15)

> Vervolg op de samenvattingsrelatie-propagatie (`expandSummaryRelations`, MS Project-semantiek voor
> relaties op WBS-samenvattingstaken). De CPM-review vond en fixte C1 (vooroudersguard, blokkerend),
> I2 (synthetische ids terugvouwen in de solver-uitvoer) en M7 (waarschuwings-dedup); onderstaande
> punten zijn bewust doorgeschoven.

- [ ] **Echte MIN-semantiek voor SS/SF met een samenvatting als voorganger** (I3). De huidige
      expansie (één relatie per bladkind, MAX over de forward-pass) is voor SS/SF-voorganger
      CONSERVATIEF TE LAAT t.o.v. MS Project's ware "samenvatting-start" (de VROEGSTE kind-start,
      dus MIN): de opvolger kan later gepland worden dan nodig, nooit vroeger. Voor FF/SF met een
      samenvatting als OPVOLGER (een vorm die MS Project op een samenvatting zelf al ontmoedigt)
      dwingt de expansie bovendien ELK kind individueel tot de constraint, i.p.v. alleen het laatst
      afgeronde kind. Beide zijn gedocumenteerd in de moduleheader van
      `src/engine/scheduler/expandSummaryRelations.ts` en gepind in vier regressiecases
      (`wbs-summary-relation-conservative-*` in `tests/planning/cases-edge.json`). Echte MIN-
      semantiek vergt de samenvatting als EIGEN solver-knoop (met een afgeleide duur/positie uit
      zijn kinderen) i.p.v. een verzameling losse bladtaak-relaties — een grotere, aparte wijziging.
      Corpusincidentie (Bijlage 13): 0 — geen gemeten regressie, alleen een grens.
- [ ] **Procentuele lag (`lagPercent`) op een samenvattingsrelatie rekent tegen de duur van het
      INDIVIDUELE bladkind, niet tegen de samenvatting als geheel** (M5). Ná expansie leest
      `resolveEffectiveLagDays` de duur van de synthetische (bladtaak-)voorganger — bij kinderen met
      sterk uiteenlopende duren geeft dat per gegenereerde bladrelatie een andere absolute lag.
      Corpusincidentie (Bijlage 13): 0 (geen van de samenvatting-relaties heeft `lagPercent`). Zou
      dezelfde "samenvatting als solver-knoop"-golf als het vorige punt vergen om goed op te lossen.
- [ ] **`droppedSequenceIds` is niet zichtbaar via MCP** (I4). In de UI wel: het waarschuwingenpaneel
      (`collectScheduleWarnings`, soort `droppedSequence`) en het Relaties-paneel (`relationIndex.ts`)
      tonen gedropte relaties. De MCP-leestools (`src/services/mcp/tools/readTools.ts`, bv.
      `planner_get_project_overview`) noemen ze niet, dus een AI-assistent ziet een gedropte relatie
      (kapotte tak, vooroudersrelatie, `MAX_EXPANDED_RELATIONS`-klem) niet en kan hem niet melden.

### Verticaal slepen aan de Gantt-balk — resterende punten (hyperkritische review 2026-09-15)

Het gebaar zelf is hersteld in PR #143 (balkbody draagt een overwegend verticale sleep over aan de
rijsleep van de DOM-taakgrid, via `src/components/canvas/ganttRowDragBridge.ts`). De drie
blokkerende bevindingen zijn daar opgelost; de poorten kennen dat pad sinds dezelfde PR
(`check-gantt-event-ownership.ts` bewaakt de delegatieketen, `verify-gantt-boundaries.mjs` de
importgrens). Deze drie zijn bewust blijven liggen.

- [ ] **`probeRootRef` staat ook op de volledige Tabel-tab aan.** `FullTaskGrid.tsx` geeft
      `probeRootRef: containerRef` onvoorwaardelijk mee, dus ook voor `surfaceId === 'full-task-grid'`,
      terwijl de docstring alleen over het Gantt-canvas praat. Gemeten gevolg: sleep je daar een rij
      en beweeg je buiten het raster, dan toont de invoegstreep een plek die bij loslaten niets doet
      (de drop-zone staat op de rij, `dropTarget` blijft null). In één meting bleef de sleep zelfs
      hangen doordat de mouseup op een *disabled* `<input>` in de rechterrail landde, waar Chromium
      geen muisevents dispatcht — dat vastlopen is ouder dan de brug, maar `probeRootRef` maakt
      "loslaten buiten het raster" nu een uitnodigende handeling in plaats van een duidelijke
      annulering. **Aanpak:** de ref alleen meegeven voor de ingebedde Gantt-grid
      (`surfaceId === 'gantt-task-grid'`), plus een browsertest op de Tabel-tab die eist dat er
      buiten het raster géén invoegstreep verschijnt. Terzijde, uit dezelfde meting: `computeHover`
      garandeert alleen voor `zone === 'nest'` dat zone en target uit dezelfde berekening komen; voor
      `before`/`after` kan `target` null zijn terwijl de indicator gewoon getoond wordt, dus het
      commentaar "de indicator kan niet iets anders tonen dan waar de taak landt" klopt maar half.
- [ ] **De pointercoördinator weet niet dat er een overgedragen gebaar loopt.** Bij de overdracht
      wordt `barDrag.dragState` genulld, dus `onMouseMove`'s guard grijpt niet meer en de
      cursorafleiding kent het gebaar niet. Gemeten: midden in de structurele sleep staat er een
      hover-tooltip van de taak ónder de cursor (dus de drop-doeltaak, niet de gesleepte), valt de
      cursor terug van `grabbing` naar `grab`, pant een middelklik de tijdlijn terwijl de rijsleep
      loopt, en verzet een rechtsklik de selectie naar de doeltaak. Het gedocumenteerde invariant in
      `onMouseDown` ("1 actief gebaar weigert een tweede") is daarmee stuk, want het gebaar leeft in
      een ander component. Bijvangst: een volledige React-render van de GanttCanvas-subtree per
      mousemove tijdens de sleep. **Aanpak:** één `transferredRowDragRef`/state in de coördinator die
      zowel de tooltip- en cursorafleiding als de "één gebaar tegelijk"-guard voedt, in plaats van
      alleen de wegwerp-vlag `justRowDraggedRef`. Browsertest: tijdens een overgedragen sleep geen
      tooltip, cursor blijft `grabbing`, en middel-/rechtsklik doen niets.
- [ ] **Meervoudige selectie sleept nooit mee vanaf de balk** — eerst een productbesluit. De
      balk-mousedown doet `selectTask(hit.task.id, false)` (`useGanttPointerCoordinator.ts`), en
      `selectionSlice.selectTask` met `multi=false` zet `selectedTaskIds = [id]`. Tegen de tijd dat
      `useTableRowDrag`'s mouseup `selectedTaskIds.length > 1` test, is de selectie al gesloopt;
      Ctrl/Cmd vasthouden helpt niet, want dan valt de mousedown in tak 5 en start er geen sleep.
      Vanaf een RIJ werkt groepssleep wel. **Keuze:** óf de balk-mousedown laat een bestaande
      meervoudige selectie waarin de taak zit met rust (gedrag gelijk aan de rij), óf het blijft
      bewust één taak. De gidsen `public/docs/{nl,en}/gids-plannen-wbs.md` zeggen sinds PR #143
      expliciet dát de balk altijd één taak verplaatst, dus bij de eerste keuze moeten die mee.
- [ ] **Klein: de overdracht vraagt één extra muisbeweging.** `startRowDrag` is `setCandidate`; de
      kandidaat promoveert pas op de eerstvolgende mousemove ná de overdracht. Eén enkele sprong van
      6 px verticaal gevolgd door loslaten doet dus niets (en slikt de afsluitende klik in). In de
      praktijk zeldzaam — het is een gratis extra drempel bovenop `ROW_DRAG_THRESHOLD`.

### Klein
- [ ] **Mijlpaal horizontaal verslepen om de datum te wijzigen.** Nu geblokkeerd door dezelfde
      `getTaskBarBounds`-null die het relatie-tekenen blokkeerde (opgelost in spec 2026-08-14). Raakt
      `barDrag`: bij een 0-duurtaak mag alleen een body-sleep armen, nooit een resize-greep, en
      snapping/undo/uur-modus moeten kloppen.
- [ ] **Taakbewerkvenster en eigenschappenpaneel labelen hetzelfde duurveld verschillend:** het paneel
      toont `Duur (dagen)` (`task:properties.duration`), de dialoog (`TaskDialog`, via de gedeelde
      `task-sections`) `Duur (werkdagen)` (`task:dialog.duration`). Gemeten in een browsergebruikstest
      van de urenplanning (2026-08-15). De dialoog is inmiddels ook via het contextmenu en F2
      (`edit.editTask`) bereikbaar; wat rest is één consistente labelset over beide oppervlakken.

### Klein — bulk-mutaties: tweede kwadratische factor (2026-07-29)
- [ ] **`applyWbsNumbering` + `recomputeViewRows` draaien per mutatie.** `withTransaction`
      (K-item 32) haalde de snapshot-kant eruit: bij 600 `addTask`-aanroepen ging het van
      4528 ms naar 1533 ms en van 100 naar 1 undo-stap. Maar de schaling bleef ~3,5× bij een
      verdubbeling van n, dus er is een tweede kwadratische factor: beide functies zijn O(n) en
      worden n keer aangeroepen. `flattenOrder` is al gede-kwadrateerd, dus dát is het niet.
      *Aanpak:* binnen een lopende batch de hernummering en de viewRows-herberekening uitstellen
      tot het einde van de transactie. Let op: dan ziet code BÍNNEN de batch verouderde
      `wbsCode`/`viewRows` — dat is een gedragswijziging, geen pure optimalisatie, en hoort
      daarom niet stilzwijgend in K-item 32. Hangt samen met item 36 (prestaties).

### Klein — zes Gantt-schakelaars slaan aan terwijl de Gantt niet in beeld is (2026-07-29)
- [ ] **Beeld-tab: histogram, baseline-overlay, voortgangslijn, statusdatumlijn, mini-map en
      split view zijn actief te schakelen terwijl `GanttCanvas` helemaal niet gemount is.** Gemeten
      met het volledige resource-paneel open: `showHistogram` gaat op `true`, de knop kleurt oranje,
      `ganttVisible: false` en er verandert niets zichtbaars. Alle zes wonen ín `GanttCanvas` (het
      histogram rond `:1521`), niet in de rechter-rail — anders dan Vastzetten/Eigenschappen, die
      via de `setUI`-invarianten in `uiSlice` (`:171-199`) inmiddels wél de rail uitklappen.
      *Dit is één ontwerpprobleem, geen zes bugs.* Losstaand één ervan repareren is een plakker;
      de generieke regel "toon de Gantt bij het aanzetten van een Gantt-optie" doortrekken is
      juist schadelijk — dan gooit het aanvinken van de voortgangslijn je resource-tabel dicht.
      *Aanpak (keuze nodig):* de zes uitschakelen met een tooltip zolang de Gantt niet zichtbaar is,
      óf de volledige-paneelmodus zo vormgeven dat hij de Gantt niet verdringt. Kwam boven bij het
      herstelwerk rond issue #46.

### Klein — structuurmutaties die een relatie laten droppen zijn stil (2026-08-15, herzien)
- [ ] **Structuurmutaties kunnen een bestaande relatie retroactief tot voorouder-relatie maken,
      zonder enig signaal op het moment zelf.** Sinds het eigenaarsbesluit van 2026-08-15
      (`docs/superpowers/specs/2026-08-14-mijlpaal-relaties-design.md`, banner bovenaan) is een
      relatie naar een verzameltaak-eindpunt geen spookrelatie meer — `expandSummaryRelations`
      rekent hem gewoon door naar de onderliggende bladtaken (MS Project-semantiek). Wat overblijft
      is de voorouder-guard: als een structuurmutatie (`indentTasks`, `moveTaskTo`,
      `addTask({ parentId })`, `insertWbsTemplate`) een bestaande relatie retroactief tot een
      relatie tussen een taak en zijn EIGEN (voor)ouder-samenvatting maakt (bv. A→B bestond al,
      en de gebruiker maakt A vervolgens tot kind van B, of B tot kind van A), dan droppt de
      solver-guard die relatie voortaan stil — pas zichtbaar bij de eerstvolgende herberekening,
      via de *niet meegerekend*-markering in het Relaties-paneel (niet standaard open) en
      `cpmResult.droppedSequenceIds`. Er komt op het moment van de structuurmutatie zelf geen
      melding, in tegenstelling tot het laadpad (`notifications.summaryRelationsDropped`), dat wél
      meldt zodra `applyLoadedProject` klaar is. MCP meldt hier ook niets: `planner_add_tasks` met
      een `parentId` die een bestaande relatie tot voorouder-relatie promoveert, doet dat zonder
      een woord.
      *Kandidaat-aanpak:* na elke structuurmutatie die relaties kan raken, `cpmResult.
      droppedSequenceIds` vóór/ná vergelijken en bij een toename dezelfde melding afvuren als na
      het laden (`notifications.summaryRelationsDropped`), of het aantal daadwerkelijk gedropte
      relaties tonen als niet-blokkerende toast. Gevonden bij de eindreview op de mijlpaal-
      relaties-tak (2026-08-14); herzien bij het eigenaarsbesluit van 2026-08-15 dat samenvattings-
      relaties liet meerekenen i.p.v. ze te weigeren.

### Klein — gedropte relaties hebben geen reden-per-drop (her-review verzoening, 2026-08-15)
- [ ] **`expandSummaryRelations` levert een platte `droppedSequenceIds` zonder oorzaak**, dus de
      gebruikersmelding (`notifications.summaryRelationsDropped`) en de paneelmarkering
      (`relations.warnDropped`) kunnen alleen neutraal zeggen "niet meegerekend — zie het
      Relaties-paneel", en het paneel stopt daar ook: de gebruiker heeft geen route naar het
      *waarom* (voorouderconflict, kapotte tak, of de `MAX_EXPANDED_RELATIONS`-budgetklem — die
      laatste heeft de grootste impact: één relatie tussen twee grote samenvattingen kan de klem
      in z'n eentje raken). Oplossing: de expansie een reden per gedropte relatie laten teruggeven
      en die in het Relaties-paneel (tooltip/detail) tonen; de meldingtekst kan dan weer specifiek
      worden. Gevonden bij de her-review van de verzoening (2026-08-15).

### Klein — testinfra: gedeelde bundelpaden in run.sh (projectstart-review, 2026-08-15)
- [ ] **`tests/planning/run.sh`'s `bundle_check` schrijft elke check-bundel naar een VASTE naam**
      (`tests/planning/.<naam>.mjs`, bv. `.adapters-hours-check.mjs`) — prima voor één run, maar
      twee GELIJKTIJDIGE `bash tests/planning/run.sh`-runs (twee agents/worktrees/CI-jobs tegen
      dezelfde checkout, of een lokale run naast een CI-run op een gedeelde runner) delen dat pad:
      de een kan de bundel van de ander overschrijven tussen bundelen en uitvoeren in, waarna een
      run een MENGSEL van twee bronversies test — of een bundel leest die de andere run net aan het
      overschrijven is. Gevonden tijdens het onderzoek naar de eerder gerapporteerde "flake" in
      `check-adapters-hours.ts` (waarvan de eigenlijke oorzaak een `process.cwd()`-fixture-pad
      bleek, zie de changelog/commit-historie — gefixt). Bewust NIET gefixt: een per-run tmp-map
      voor de bundels raakt `bundle_check`/`BUNDLES`/de tijdzone-matrix-hergebruik-logica in
      `run.sh` overal tegelijk — groter dan een enkele testfix. Risico is bovendien laag zolang de
      suite hoofdzakelijk sequentieel draait (lokaal, en CI-jobs per PR).

### Prestatiedoel: 5000 taken moet werken — interactieve pad AF, bulk nog niet (2026-08-17)

De eigenaar heeft de grens uit item 36 vastgesteld: **de app moet 5000 taken aankunnen.**

**Wat er mis was.** De rekenkern was nooit het probleem: `runCPM` doet 5000 taken in 0,9 s en vijf
volledige `recomputeViewRows` kosten samen 47 ms. Het zat in de kosten **per mutatie**. Drie
plekken deden O(n) werk over de hele takenlijst bij élke bewerking, dus n bewerkingen waren O(n²):

1. `createSnapshot` deep-cloonde de projectdata met `JSON.parse(JSON.stringify(...))`. Duurder dan
   het lijkt: bovenop de kloon zelf moest Immer alle vers gekloonde objecten ook nog diepvriezen
   (~26% respectievelijk ~45% van één mutatie in het CPU-profiel).
2. `applyWbsNumbering` las én beschreef élke taak via de Immer-draft, ook waar de code gelijk bleef.
   Elke aanraking maakt een proxy die aan het eind van de producer gefinaliseerd moet worden.
3. `recomputeResourceLoad` las resources, toewijzingen én taken óók via de draft, terwijl het niets
   muteert — `recomputeViewRows` deed dat al goed, deze niet.

**Wat er gedaan is.** De snapshot deelt nu per referentie in plaats van te klonen; dat mag omdat
Immer de state na elke producer diep bevriest en zelf nooit de basis muteert (de onderbouwing staat
in de kop van `src/state/snapshot.ts`). De nummering leest de draft plain via `current()` en schrijft
alleen waar de code echt verandert. De belastingberekening draait buiten de producer. De rollen in
het documentcontract heten daardoor niet langer `'clone'`/`'ref'` maar `'data'`/`'derived'` — ze
worden allebei per referentie bewaard en de oude naam loog.

**Gemeten, één `addTask` / `updateTask` op 5000 taken:**

| stand | addTask | updateTask |
|---|---|---|
| zoals het was | 132 ms | 97 ms |
| alleen de snapshot goedkoper | 59 ms | 11 ms |
| alleen de nummering goedkoper | 105 ms | 97 ms |
| **beide (huidig)** | **18 ms** | **11 ms** |

En over de hele linie, met `withTransaction` om de opbouw heen:

| pad | N=1000 | N=2500 | N=5000 |
|---|---|---|---|
| 1 `addTask` | 4 ms | 7 ms | 20 ms |
| 1 `updateTask` | 2 ms | 4 ms | 10 ms |
| 1 `undo` | 2 ms | 4 ms | 11 ms |
| 1 `assignResource` | 41 ms | 69 ms | **138 ms** |
| `runCPM` | 174 ms | 406 ms | 907 ms |
| 5× `recomputeViewRows` | 7 ms | 20 ms | 47 ms |
| opbouw: N taken | 1,7 s | 9,6 s | **40 s** |
| opbouw: N relaties | 1,7 s | 11 s | **46 s** |
| opbouw: N toewijzingen | 18 s | 82 s | **302 s** |

Vóór dit werk rondden N=2500 en N=5000 niet eens af binnen tien minuten.

**En wat een gebruiker daadwerkelijk doet, bij 5000 taken / 5000 toewijzingen** (na de snellere
`formatDate`, zie hieronder):

| handeling | tijd |
|---|---|
| bestand opslaan (`writeIFC`, 3,9 MB) | 201 ms |
| bestand openen (`readIFC`) | 447 ms |
| berekenen (`runCPM`, expliciet via F5) | 604 ms |
| rijen herberekenen | 9 ms |
| taak toevoegen / hernoemen / ongedaan maken | 18 / 14 / 10 ms |
| **resource toewijzen** | **106 ms** |

`formatDate` was `d.toISOString().split('T')[0]` en draait per DAG per taak in de solver en de
resourcebelasting; handmatig opbouwen scheelde `runCPM` 677 → 604 ms, `recomputeResourceLoad`
126 → 90 ms en `assignResource` 133 → 106 ms. Bewaakt door `tests/planning/check-date-format.ts`,
met de oude implementatie als orakel.

De poort staat in `tests/planning/check-mutation-cost.ts`. Let op wat die wél en niet kan: twee van
de drie wijzigingen hebben géén waarneembaar gedragsverschil (plain lezen is puur goedkoper), dus
daar is de bron-assert de enige bewaking. Dat staat ook zo in de kop van die batterij.

*Wat nog open staat, in deze volgorde:*
- [ ] **`assignResource` is bij 5000 taken het enige interactieve pad dat nog knelt: 106 ms** (was
      133 ms vóór de snellere `formatDate`). Vrijwel alles daarvan is `computeResourceLoad`, dat bij
      élke toewijzing over ÁLLE toewijzingen loopt en per toewijzing de werkdagenreeks van de taak
      opnieuw uitloopt. Incrementeel bijwerken is de voor de hand liggende oplossing, maar dat is
      een echte herontwerp-stap: de huidige functie is één bron van waarheid voor histogram én
      leveler en dat moet zo blijven. Een goedkopere tussenstap die nog openstaat: de
      werkdagen-enumeratie per taak memoïseren binnen één aanroep (taken met twee toewijzingen
      rekenen hem nu twee keer).
- [ ] **De bulk-paden.** Binnen een lopende `withTransaction` draaien de hernummering en de
      rijen-/belastingherberekening nog steeds per mutatie. Uitstellen tot het einde van de batch
      maakt de opbouw lineair. LET OP: code BÍNNEN de batch ziet dan verouderde `wbsCode`/`viewRows`
      — dat is een gedragswijziging, geen pure optimalisatie, en hoort dus met een eigen test.
- [ ] Daarna de aanroepers die nog buiten `withTransaction` bulk doen (import, plakken, sjabloon
      invoegen) daar echt binnen trekken.
- [ ] De grens van 5000 publiceren zodra de bulk-paden ook goed zijn.

### Klein — de tijdlijn-kopstrook van de afdruk is niet dezelfde als die van het scherm (2026-08-17)
- [ ] **De afdruk tekent een vaste maand/week/dag-kopstrook; het scherm kiest zijn niveaus met
      `pickTiers`/`TIER_CONFIG` uit `engine/renderer/timelineTiers.ts`.** K-item 39 noemt dat
      expliciet als onderdeel, maar het is bij nader inzien géén "S": de gedeelde tier-logica
      overnemen verandert de kopstrook van élk bestaand rapport (andere niveaus, andere labels,
      andere dichtheid bij dezelfde zoom). Dat is een productbeslissing over hoe afdrukken eruitzien,
      geen opruiming. De drie dingen die wél puur divergentie waren — weeknummer, weekgrens en welke
      dagen vrij zijn — zijn in K-item 39 rechtgezet en met `check-print-screen-parity.ts` afgedekt.
      *Eerst beslissen:* moet de afdruk meeschalen met de zoom zoals het scherm, of blijft de vaste
      maand/week/dag-strook de bedoeling? Pas daarna bouwen.

### Distributie & Release

#### Sleutelbeheer — vier velden die alleen de eigenaar kan invullen (2026-07-28)
`docs/release-secrets.md` inventariseert de negen secrets van de uitleverketen, maar vier
velden staan er nog als `⟨IN TE VULLEN⟩` in. Ze zijn per definitie niet uit de repo af te
leiden. Zolang ze leeg zijn is dat document een inventarisatie en géén herstelplan.

- [ ] **Bewaarplek van de minisign-privésleutel en zijn wachtwoord vastleggen.** Dit is de
      enige onherstelbare sleutel in de hele keten: zijn publieke helft
      (`28AC8F08A87C90CD`) staat hardgecodeerd in `tauri.conf.json` en zit dus in élke
      uitgeleverde binary, en Tauri's updater kent één `pubkey`-veld — geen lijst, dus geen
      reservesleutel meeleveren. Kwijt = elke bestaande installatie permanent afgesneden
      van auto-updates, zonder weg terug. De GitHub-secret telt **niet** als back-up: die
      is write-only. Minimum: sleutel én wachtwoord (op gescheiden plekken) in een gedeelde
      password manager, plus één offline kopie.
- [ ] **Een tweede persoon toegang geven.** Nu is de bus factor 1 op precies die sleutel.
- [ ] **Vervaldatum van `AZURE_CLIENT_SECRET` (en het certificaatprofiel) vastleggen**, met
      een agenda-herinnering een maand van tevoren die niet aan één persoon hangt. Verloopt
      uit zichzelf en breekt dan midden in een release — ná de onomkeerbare tag-push.
- [ ] **Vervaldatum van `SNAPCRAFT_STORE_CREDENTIALS` vastleggen**, idem. Verlopen
      credentials laten de publish-stap falen terwijl de rest van de release slaagt.

Het migratiepad voor de sleutel staat al uitgeschreven in `docs/release-secrets.md` §2 —
met de dwingende volgorde, en het werkt alléén zolang de oude sleutel er nog is.

### Kwaliteit & verificatie

- [ ] **Meetlat per formaat (nul afwijkingen zoals XER §1), als aparte etappe ná de
  etappe "datums zoals opgeslagen voor alle formaten"** (eigenaarsbesluit 2026-09-09, optie 3;
  die etappe zelf wordt gebouwd en staat daarom niet hier maar in plan §10.f). Nu: alleen XER (93 bestanden,
  zes assen) en `.mpp` (216 bestanden, alleen start/einde) hebben een corpus + gepinde baseline;
  MSPDI en P6 XML zijn nooit gemeten. Materiaal: `ops-xer-corpus/pmxml-samples/` (9 P6 XML) en
  de publieke MPXJ-junit-data (148 XML, deels MSPDI, deels P6 XML). Per formaat: corpus,
  zesassige meting, gepinde baseline, suite rood zolang niet nul. Beginnen met P6 XML (meeste
  materiaal, grootste overlap met XER); `.mpp` uitbreiden van twee naar zes assen. CSV krijgt
  geen meetlat (geen bronpakket dat het antwoord geeft).
- [ ] **XER: het bronarchief heeft geen bytegrens en gaat mee in élke auto-save-serialisatie**
  (eindreview 2026-09-07, bevinding 1). Gemeten op `rehab-2.xer` (17,7 MB): IFC 50 MB, volledige
  herstelronde 73 s / 3,1 GB piek-RSS, ±3,6 s hoofdthread per 10-secondentick; bij twaalf documenten
  uit één bestand 26× amplificatie (OZB). Geen cap, geen opt-out, geen worker. Eigenaarsbesluit
  (plan §10.f): bytegrens waarboven het archief niet in de recovery-snapshot meegaat, óf het
  immutabele archief één keer apart schrijven, plus een budgetpoort in
  `check-xer-archive-recovery-corpus.ts`. De gids benoemt de prijs nu wel.
- [ ] **XER: "niet vastgelegd" bestaat in tabel, CSV en MCP, maar niet in de rapporten, de PDF, het
  printvoorbeeld en de renderer** (eindreview bevinding 6). In de modus schrijft
  `applyRecordedTimesToTasks` `totalFloat ?? 0`/`isCritical ?? false` in `task.time`; de rapporten
  presenteren dat als cijfer (corpus: 122 taken zonder volledig late-paar, 290 zonder
  `total_float_hr_cnt`). Nu: één melding bovenaan elk rapport (`tableReports.recordedDatesNote`).
  Volledig: `unrecordedExportGate` door `ReportContext` en de kolomspecs heen.
- [ ] **XER: de exportverliesmelding komt ná het schrijven** (eindreview bevinding 12) —
  `detectXerExportLoss` draait vóór de dialoog, de `info`-melding pas ná `saveFileDialog`. Overweeg
  de waarschuwing vóór de dialoog wanneer de categorieën het exact-source-bytes-verlies bevatten.
- [ ] **XER: geen bovengrens op het aantal documenten uit één bestand** (eindreview bevinding 13,
  VERMOED): elk document draagt zijn eigen archiefkopie; het corpus haalt maximaal 15 projecten. Te
  bevestigen met een synthetisch bestand van ~100 projecten door `readXER` + auto-save.
- [ ] **`lagCalendar` is sinds X5 effectief voor élk formaat** (eindreview bevinding 5): een
  bestaand document waarin ooit 'successor'/'24hour'/'projectDefault' is gekozen plant na de
  volgende release anders. Regel in de releasenotities van die versie; eventueel migratienoot.
- [ ] **XER: A19 (P6-basis) geeft de reststart waar de verified cases 08 A / 10 B de werkelijke
  start tonen** ('A'-datum = Start-kolom; ES én LS, vier cellen). Nog te checken: welk veld de
  vergelijking eigenlijk hoort te gebruiken (werkelijke start versus reststart) vóór er een oorzaak
  wordt aangewezen. Zie plan §9.

- [ ] **Geen enkele poort raakt het Tauri-asset-protocol — een hele klasse desktopbugs is
  structureel onzichtbaar.** Aangetoond 2026-07-28: in de uitgeleverde `.deb` v2026.7.13 toonde
  Backstage → Help bij élk artikel "Artikel niet gevonden", terwijl alle 354 artikelen gewoon in de
  binary zaten (gefixt in `e257770`). Oorzaak: `tauri-utils` kent de extensie `md` niet en valt terug
  op `MimeType::Html`, dus de webview labelt elk artikel als `text/html` — en onze eigen
  SPA-fallback-guard verwierp precies dat.
  **Waarom niets het ving:** dev, de webdeploy én `npm run tauri:dev` gaan allemaal via Vite, dat
  `.md` wél correct serveert. Alleen een gebundelde build met embedded assets vertoont het. CI bouwt
  die wel (`tauri build --no-bundle`) maar start hem nooit. `verify:docs` bewijst dat de bestanden
  kloppen, niets bewijst dat de app ze kán laden.
  **Nog steeds latent** (uit de audit bij die fix): `.ifc`-voorbeelden (`Backstage.tsx`,
  `HelpPanel.tsx`) krijgen op de desktop óók `text/html` en overleven alleen doordat dat pad geen
  header-check heeft — zet iemand daar ooit een guard neer, dan breken de voorbeelden op dezelfde
  manier. Idem `pdf/hbSubset.ts`: `arrayBuffer()` is veilig, maar een overstap naar
  `WebAssembly.instantiateStreaming` zou op de desktop stukgaan op het content-type.
  **Kandidaat-poort:** de gebundelde binary in CI daadwerkelijk starten en één asset per uitgeleverd
  bestandstype (`.md`, `.ifc`, `.wasm`, fonts) laten laden — of, veel goedkoper, een headless check
  die de extensies die wij uitleveren aftoetst tegen de MIME-tabel van de gebruikte `tauri-utils` en
  waarschuwt zodra er één op de HTML-fallback landt. Dat laatste is geen echte end-to-end-poort,
  maar had deze bug wél gevangen.

- [ ] **ResourceLeveler-schaalbaarheid (gemeten 2026-07-06, benchmark tegen de echte engine).**
  De leveler groeit ~kwadratisch met het taakaantal (dag-modus: 100 taken=0,15s, 500=6,2s,
  2000≈100s geëxtrapoleerd; uur-modus is consequent ~4× sneller: 500=1,5s, 2000=25,3s gemeten).
  Oorzaak: `computePF` draait `solve()` per pick in een lus. Geen 2.8b-regressie (dag-gedrag was
  altijd zo) en de CPM-solve zelf is prima (2000 taken = 37-81 ms, ruim onder de 2s-lat), maar
  voor projecten >500 taken met nivellering is dit merkbaar. Kandidaat-verbeteringen:
  incrementele her-solve of PF-caching per iteratie. De banden-memoization uit 2.8b §5.6 is
  gemeten en werkt (0 nieuwe cache-fills bij een tweede solve op dezelfde kalenders).
  Benchmark-scripts: `/tmp/ops-perf/` (bench.ts + run.sh, herbruikbaar).

- [ ] **D2 — opslaan naar een Web Worker verhuizen (prestatie-audit, geparkeerd 2026-07-23).**
  Uit de prestatie-audit ([`superpowers/prestatie-modulariteit-audit.md`](superpowers/prestatie-modulariteit-audit.md)):
  de IFC-serialisatie bij auto-save draait op de hoofd-thread en kan bij grote projecten een
  korte hik geven. De pijn is al fors verzacht door de throttle (eens/10 s) en de dirty-cache
  (alleen gewijzigde documenten her-serialiseren, `src/hooks/useAutoSave.ts`), dus dit is een
  *nice-to-have*, geen blokker. *Aanpak:* `ifcWriter` in een Web Worker draaien zodat het
  serialiseren de UI nooit blokkeert. **Let op:** dit zou de eerste Web Worker in de app zijn —
  nieuwe infrastructuur (berichtenverkeer, foutafhandeling), dus met een frisse aanloop bouwen,
  niet er even tussendoor. Verificatie-eis: de worker moet **byte-identieke** IFC produceren
  t.o.v. de huidige synchrone `writeIFC` (git-archive-vergelijking, zoals bij A1/A2).
- [ ] **C3 — canvas-heralloc / renderer-hergebruik (prestatie-audit, geparkeerd 2026-07-23).**
  Marginale winst nadat de pijl-culling (C1) al binnen is; in de browser-preview bovendien
  lastig hard te bewijzen (het canvas composit niet in een verborgen tab). Alleen oppakken als
  een concrete meting laat zien dat het nog ergens knelt. Zie de audit voor de context.

- [ ] **Driedubbele eindverificatie van fase 2 (uitgesteld op 2026-07-04).** Na afronding van
  fase 2.5 was een uiterst grondige verificatie gepland maar die is doorgeschoven; uitvoeren
  zodra fase 2 verder gevorderd is (bv. na 2.7 of als afsluiter samen met §2.10). De volledige
  werkwijze ligt klaar als workflow-script:
  [`docs/superpowers/workflows/triple-verify.js`](superpowers/workflows/triple-verify.js)
  (vóór gebruik `ROOT`/`TMP` en de prompts actualiseren — zie de kopcommentaar).

  **Werkwijze in het kort — per onderdeel 1 Opus + 2 Sonnet die exact hetzelfde doen, plus een
  Opus-rechter:**
  1. *Onderdelen.* De app wordt opgeknipt in 8 gebieden die samen alles dekken: CPM-kern &
     kalenders, resource-belasting & curves, nivellering & smoothing, state-management &
     documenten, IFC-round-trip, P6/MSPDI/CSV-adapters, UI in de browser, en voorbeelden &
     generator. Bij uitvoering ná 2.6/2.7 uitbreiden met die featuresets (baselines/voortgang
     resp. weergaven) — de prompts in het script per gebied bijwerken.
  2. *Drie onafhankelijke controleurs per onderdeel* (1× Opus, 2× Sonnet) krijgen een
     **identieke**, zeer gedetailleerde audit-opdracht: alles checken wat met dat onderdeel te
     maken heeft. Harde regels: strikt read-only in de repo, eigen tmp-map per agent,
     verwachtingen éérst met de hand uitrekenen en dan pas headless probes draaien tegen de
     echte store/solver (esbuild-patroon van `tests/planning/run.sh`), suite + `tsc` draaien;
     het UI-onderdeel gebruikt een al draaiende dev-server + eigen playwright-core-instantie
     met screenshots als bewijs. "Alles OK" mag alleen na aantoonbaar uitgevoerde checks.
  3. *Gestructureerde rapporten.* Elke controleur levert via een afgedwongen schema: verdict
     (OK/ISSUES_FOUND), de volledige lijst daadwerkelijk uitgevoerde checks, en bevindingen
     met ernst (BLOKKEREND/HOOG/MIDDEL/LAAG), faalscenario + bestand:regel en bewijs.
  4. *Per onderdeel een Opus-rechter* die de drie rapporten adversarieel weegt: elke bevinding
     zélf verifiëren in de code of met een eigen probe vóór bevestiging (een bevinding die maar
     één van de drie zag is verdacht maar kan juist de echte zijn), tegenspraken zelf
     beslechten, OK-verdicts toetsen op dekking van de opdracht en de belangrijkste ontbrekende
     check zelf alsnog doen, en bevindingen zonder reproduceerbaar bewijs verwerpen. Output:
     bevestigd/verworpen/dekkingsgaten + één eindoordeel-zin per onderdeel.
  5. *Afronding.* Bevestigde bevindingen gewogen per ernst rapporteren; fixes zijn een aparte
     vervolgronde (zelfde fix-golf-aanpak als na de fase-2.5-reviews).

### Fase 2 — Professionele Planning (v0.5)

> §2.1 Volledige dependencies is afgerond (lag-eenheid, procent-lag, leads, driving-markering,
> relatietabel, path tracing) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-volledige-dependencies-design.md).

> §2.2 WBS & structuur is afgerond (auto-nummering, activity codes, custom fields,
> groeperingsweergave, WBS-templates; kopieer/plak bestond al) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-wbs-structuur-design.md). Bewust v2: WBS-maskers/
> prefixen, hiërarchische codewaarden, indicator-velden/formules, adapter-export van
> codes/velden (CSV/MSPDI/P6), N×N-matrix.

> §2.3 Constraints & deadlines is afgerond (alle 8 datum-constraints in CPM met
> P6-soft-semantiek, deadline per taak, negatieve float, Gantt-indicatoren +
> statusbar-waarschuwingen) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-02-constraints-deadlines-design.md).
> Bewust 2.9: logica-brekende Mandatory-pins, secundaire constraints,
> scheduling-options (float-berekeningswijze, honor-toggle, retained logic).

> §2.4 Mijlpalen is afgerond (start-/eindmijlpalen via het dag-granulaire
> grens-model naar P6-voorbeeld, verplichte/contractuele mijlpalen met
> inspectiemoment-knop, mijlpalen-overzicht als tweede rapporttype) — zie
> changelog en [ontwerp](superpowers/specs/2026-07-02-mijlpalen-design.md).
> Bewust later: MTA/baseline-variance (vereist 2.6-snapshots),
> checklijsten bij inspectiemomenten (fase 3.2).

> §2.5 Resources is afgerond (vijf resourcetypes incl. ploeg, tijd-gefaseerde
> capaciteit, toewijzingen met units/dag + zes verdeelcurves, belasting- en
> overallocatie-engine in runCPM, resource-nivellering én smoothing via serieel
> SGS met float-constraint, Resources-ribbontab + beheerpaneel + histogramstrook
> + nivelleer-dialoog, IFC/P6/MSPDI-round-trip, taak-prioriteit) — zie changelog
> en [ontwerp](superpowers/specs/2026-07-03-resources-design.md). Bewust later:
> resource-kalenders zijn nu informatief (registry), nog niet hard afgedwongen in
> de scheduling; kostenkoppeling van resources hoort bij fase 3.5.

> §2.6 Baselines & voortgang is afgerond (statusdatum-gestuurde CPM met
> actual-pinning en data-date-vloer, voortgangsregistratie met afgedwongen
> invarianten, Retained Logic/Progress Override, out-of-sequence-detectie,
> onbeperkte benoemde baselines met precies één actieve, baseline-overlay +
> statusdatumlijn + voortgangslijn in de Gantt, variance-rapport als derde
> rapporttype, IFC/MSPDI/P6/CSV-round-trip) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-04-baselines-voortgang-design.md). Bewust
> later: meerdere voortgangslijnen/statuslijnen, MSPDI-baselineslots 1-10,
> P6-baseline-round-trip, per-relatie out-of-sequence-override; physical-%/
> work-% als aparte dimensie hoort bij fase 3.5.

> §2.7 Weergaven is afgerond (werkende tijdschaal-keuze jaar t/m dag met afgeleid label
> + recenter, kolom-configuratie incl. resource-kolom, geneste AND/OR-filters met
> veldtype-bewuste editor, groeperen tot 2 niveaus + multi-key-sorteren, één gedeelde
> zichtbare-rijenlijst voor tabel én Gantt, structuur-vergrendeling buiten boommodus,
> custom layouts, presentation mode (F11), split view binnen één document, mini-map,
> auto-bereken-instelling op de 3 surfaces) — zie changelog en
> [ontwerp](superpowers/specs/2026-07-04-weergaven-design.md). Bewust later:
> rollup-totalen per groepsband (fase 3.5/3.9), split view met twee verschillende
> documenten (vergt store-singleton-refactor), per-bestand-layouts (IFC-pset), en
> inline bewerken van de resource-kolom (blijft read-only; toewijzen via het
> eigenschappenpaneel).

#### 2.8 Kalender-uitbreidingen

> §2.8a is afgerond (jaar-onafhankelijke feestdagen-engine met 7 landensets incl. Duitse
> Bundesländer, Pasen-algoritme, substitutieregels en de lustrum-regel voor Bevrijdingsdag;
> bouwvak nu opt-in via de wizardkeuze met default geen; de resource-kalenderregistry
> gepromoveerd tot een gedeelde kalender-bibliotheek voor project, taken én resources;
> taak-specifieke kalenders in de CPM met de voorganger-kalender-lagregel; wizard
> land/regio/bouwvak/winterstop + preview; kalenderdialoog als bibliotheekbeheer met
> feestdagen-genereren; Gantt-naamlabel op meerdaagse feestdagblokken; IFC-reader-gat gedicht
> (werkweek/uren round-trippen nu); multi-kalender + taak-kalender round-trip in IFC/MSPDI/P6)
> — zie changelog en
> [ontwerp](superpowers/specs/2026-07-04-kalenders-design.md). Bewust later: uren-/
> minuten-scheduling en dag/nacht-ploegenkalenders zijn 2.8b (hieronder); per-rij
> Gantt-arcering op afwijkende taak-kalenders volgt later; een instelbare
> lag-kalender-scheduling-option (P6's "Calendar for scheduling Relationship Lag") is fase 2.9;
> weer-/vorstafhankelijk winterverlet is fase 4 (2.8a kent alleen een vaste winterstop-periode);
> de bouwvak-tabeldatums zijn adviesdata (Bouwend Nederland).

> **Fase-splitsing (besluit user 2026-07-04):** 2.8 wordt in twee delen uitgevoerd.
> **2.8a** = feestdagen/bouwvak/kalender-bibliotheek/taak-kalenders (afgerond, hierboven);
> **2.8b** = uren-/minuten-based scheduling + de uur-tijdschaal, als apart ontworpen
> vervolgfase (raakt solver, alle adapters, renderer én IFC — te groot om mee te liften).

> §2.8b: hoofdschakelaar Urenplanning (instelling, default uit) + per-taak dag/uur-eenheid;
> werktijd-banden per weekdag (meerdere banden, nachtploeg over middernacht) met
> dag/2-ploegen/3-ploegen/nacht/24-7-presets en een banden-editor (opslaan als preset,
> per-weekdag instellen, kopiëren naar alle werkdagen); uur-tijdschaal in de Gantt (bestaande
> `timelineTiers` geactiveerd); drie duurweergave-modi (automatisch/altijd dagen/altijd uren)
> met mixed-kalender-waarschuwing; taakbalk-opsplitsing bij onderbrekingen (nooit/bij
> selectie/altijd); minuut-precieze round-trip in P6-XML, MSPDI en IFC; datumvelden herbouwd
> als getypte dag/maand/jaar-segmenten met een datumnotatie-instelling; diverse
> kalenderdialoog-fixes. Volledig vertaald in alle 14 talen — zie changelog en
> [ontwerp](superpowers/specs/2026-07-06-uren-scheduling-design.md). Bewust later: instelbare
> lag-kalender-optie (P6's "Calendar for scheduling Relationship Lag") is fase 2.9; sub-dag
> resource-nivellering (per-uur/per-shift capaciteits-emmers) blijft dag-emmer-gebaseerd;
> tijdzone/DST-bewuste scheduling; per-rij Gantt-arcering op afwijkende taak-kalenders.
> **Status: uitgebracht in v2026.7.7** (zie `docs/CHANGELOG.md`).

#### 2.9 Geavanceerde CPM

> §2.9: de CPM-kern is "compleet" gemaakt t.o.v. P6/MSP, bovenop de 2.8b-uren-erfenis en in dag- én
> uur-modus. Constraints compleet (logica-brekende **Mandatory Start/Finish**-pins die ES/LF resp.
> EF/LS onvoorwaardelijk pinnen en negatieve float upstream drijven, **secundaire** P6-constraint met
> validatie van de verboden combinaties, en constraints uur-modus-correct tot de minuut);
> **hammock-taken** (afgeleide span tussen start-/finish-driver, her-spannend bij verschuivende
> dragers, backward-druk loopt niet door de hammock, altijd uitgesloten van het kritieke pad);
> **externe (cross-project) dependencies** via bevroren P6-*External-Dates*-ankers (FS/SS/FF/SF, beide
> richtingen, ghost-weergave + per-link/projectbreed verversen, ontbrekende-bron-gedrag zonder
> live multi-document-solve); **near-critical-analyse** met instelbare drempel (default uit; aangezet
> default 2 werkdagen, fractioneel in uur-modus); **meerdere kritieke paden / float paths**
> (driving-logic-peel FREE_FLOAT + TF-rangschikking, `floatPath`-nummer per taak, `criticalPaths`);
> **interfering float** (tf−ff, getekend/fractioneel); en een project-scoped **Berekening**-blok
> (lag-kalender-keuze, kritiek-definitie TF≤x / longest-path, TF-berekeningswijze, open-ended-kritiek,
> near-critical-drempel, float-paths). Interop: taak-constraints round-trippen nu óók in P6-XML en
> MSPDI (voorheen leeg), met hard/secundair-uitbreiding en custom psets
> (`OPS_Hammock`/`OPS_ExternalLink`/`OPS_SchedulingOptions`). Testbatterij: `cases-advanced-cpm.json`
> (dag + uur, incl. FF/SF-uur-ankers, gemengd dag/uur-net, fractionele near-critical) +
> `check-advanced-cpm.ts` + universele harness-invarianten (interfering=tf−ff, criticalPaths[0]==
> criticalPath, hammock nooit floatPath/near-critical) over álle cases. Zie changelog en
> [ontwerp](superpowers/specs/2026-07-06-geavanceerde-cpm-design.md). Bewust later: live cross-project
> solve (vergt store-singleton-refactor); Expected-Finish-constraint; independent float; de
> spec-conforme `IfcRelAssociatesConstraint`-graf; sub-shift-nivellering van hammocks; native
> P6/MSPDI LOE/external round-trip waar de veldcodes UNVERIFIED zijn.
> **Status: uitgebracht in v2026.7.8** (zie `docs/CHANGELOG.md`).

#### 2.10 Gebruikersdocumentatie & showcase-voorbeelden (afsluiter van fase 2)

> **AFGEROND (v2026.7.9 + v2026.7.10, 2026-07-07 t/m 2026-07-10).** Sneltoets-register + Ctrl+/-overzicht,
> contextmenu's (4 oppervlakken), box-selectie, taakdialoog-parity via gedeelde task-sections,
> taak-aantekeningen (IFC-pset `OPS_TaskNotes`), toewijzing verplaatsen, ConfirmDialog, relatietype-popover,
> gedockt/versleepbaar resourcepaneel, first-startup (welkom + 7-staps rondleiding + feedback-slotstap),
> 3 woningbouw-showcases klein/middel/groot (generator-schema uitgebreid; `verify:examples` als levend
> contract), en volledige in-app-documentatie NL+EN (25 artikelen, F1/Backstage-viewer, `verify:docs`).
> Zie changelog, de specs in `superpowers/specs/2026-07-07-2.10-*` en de git-historie van `fase-2.10`.
> Bewust doorgeschoven: drag-and-drop toewijzing-verplaatsen; sneltoets-herbinden.

### Fase 3 — Bouwsector & Nederlandse Features (v1.0)

#### 3.1 Lean Construction & Last Planner System
- [ ] Phase Planning / Pull Planning (faseplanningsbord)
- [ ] Look-ahead Planning (6-8 weken vooruit, constraint-check)
- [ ] Weekly Work Plan (weekplanning met commitments)
- [ ] Commitment tracking (wie belooft wat)
- [ ] PPC-berekening (Percent Plan Complete) + dashboard
- [ ] Variance/Root Cause analysis
- [ ] Constraint log (belemmeringen-register)
- [ ] Constraint-ready indicator (taak kan starten: groen/rood)
- [ ] Make-ready process tracking
- [ ] Takt planning (repetitieve eenheden, bijv. per verdieping)
- [ ] Kanban-bord weergave
- [ ] Digitaal post-it bord (collaborative planning)
- [ ] Dagstart-dashboard (daily huddle board)
- [ ] Naadloze integratie LPS ↔ CPM (geen dubbel werk)

#### 3.2 Nederlandse bouwstandaarden
- [ ] RAW-besteksposten koppelen aan taken
- [ ] STABU-bestekscodes in WBS
- [ ] UAV-gc ondersteuning (Systems Engineering, V&V-planning)
- [ ] BRL-normen koppelen aan inspectiemomenten
- [ ] Wkb (Wet kwaliteitsborging) kwaliteitsborgingsplan-integratie
- [ ] CROW-publicaties referenties (bijv. CROW 400)
- [ ] Nederlandse aanbestedingsfasen (Aanbestedingswet 2012)
- [ ] VISI-koppeling (NL bouwcommunicatiestandaard)
- [ ] BLVC-plan (Bereikbaarheid, Leefbaarheid, Veiligheid, Communicatie)
- [ ] Asbestinventarisatie-milestones
- [ ] Omgevingsvergunning-milestones
- [ ] V&G-plan taken (veiligheidsmaatregelen)
- [ ] Bouwlogistiek planning

#### 3.3 Duitse/DACH bouwstandaarden
- [ ] VOB/B ondersteuning (Terminplanung conform VOB)
- [ ] HOAI-fasen (Leistungsphasen 1-9) als WBS-structuur
- [ ] DIN-normen referenties

#### 3.4 Earned Value Management (EVM)
- [ ] BCWP, BCWS, ACWP berekeningen
- [ ] CPI (Cost Performance Index)
- [ ] SPI (Schedule Performance Index)
- [ ] EAC (Estimate at Completion)
- [ ] S-curve (cumulatieve voortgang/kosten)
- [ ] Kostencurve (gepland vs. werkelijk)
- [ ] Cashflow-prognose
- [ ] EVM-dashboard

#### 3.5 Kosten & budget
- [ ] **Man-uren/kosten-totalen en budget-rollup als volwaardige feature.** De ResourcePanel-kolom
      "Totaal" (fase-2.5-review) toont nu enkel Σ eenheden × uren/dag × tarief per resource — een
      eerste, eerlijke stap. Bouw dit uit tot echte man-uren- en kostentotalen per taak/WBS-tak met
      rollup naar projectniveau (budget), inclusief materiaal en een baseline-vergelijking.
- [ ] Kostenberekening per taak (uren × tarief + materiaal)
- [ ] Budget vs. actual kosten tracking
- [ ] Cost loading (kosten verspreid over taakduur)
- [ ] Kostenrapportage
- [ ] Budget-overschrijding waarschuwingen

#### 3.6 Weergave-uitbreidingen
- [ ] Netwerkdiagram (PDM/Activity-on-Node)
- [ ] Line of Balance (LOB) diagram voor repetitieve werken
- [ ] Kalenderweergave (maandoverzicht)
- [ ] Timeline-weergave (horizontale tijdlijn, MS Project-stijl)

#### 3.7 Bouwspecifieke features
- [ ] Weercondities per taak (buitenwerk/binnenwerk markering)
- [ ] Inspectiemomenten als verplichte mijlpalen met checklijst
- [ ] Seizoensgebonden restricties (geen buitenwerk in winter)
- [ ] Kraanplanning (beschikbaarheid, capaciteit)
- [ ] Bouwplaatsinrichting-milestones

#### 3.8 Import/export
> Zie ook GitHub-issue #17 (DutchSailor, 2026-07-06): onderbouwd formaten-voorstel met NL-marktanalyse
> ("6+2"-lijst). Kern klopt met onze richting; prioriteiten hieronder daarop aangescherpt.
- [ ] **Primavera XER export** — de XER-import bestaat (PR #109, `src/services/xer/`); een XER-schrijver
  niet (export naar P6 loopt via P6-XML, met verliesmelding `xerExportLoss.ts`). Issue #17.
- [ ] **iCalendar (.ics) export** — mijlpalen/deadlines naar agenda-apps; goedkoop, hoge waarde (issue #17).
- [ ] **MPP-vervolgetappes (user-wens 2026-08-15: de bewuste beperkingen van etappe 1 zijn geen
  eindstation — "als we hier een keer genoeg tokens tegenaan gooien dan lukt het wel").** In
  oplopende moeilijkheidsgraad:
  - [ ] **Baselines + custom fields/outline codes uit `.mpp` lezen** — de var-data-typen bestaan in
    `FieldMap14.java`; onze data-gedreven veldmap-parser (`fieldMap14.ts`) hoeft alleen extra
    veld-ids te leren. Meest haalbare uitbreiding; ground truth voor baselines ligt klaar in
    `mpxj/junit/data/generated/task-baselines/`.
  - [ ] **MPP9/12 native lezen** (Project 2000-2007) — zelfde containerformaat, andere veldmaps:
    `MPP9Reader.java`/`MPP12Reader.java` + `FieldMap9/12` porten op de bestaande
    CFB/primitieven-laag; de XOR-decodering uit `DocumentInputStreamFactory.java` (simpel:
    `0xFF - code`) erbij voor "versleutelde" bestanden. Testdata: `mpxj/junit/data/legacy/`.
  - [ ] **`.mpp`-EXPORT (schrijven)** — de moonshot: geen enkele OSS-implementatie bestaat (ook
    MPXJ niet; alleen MS Project zelf via COM). Onze leeskennis (CFB-writer + veldmaps + Props)
    is het halve werk, maar de andere helft (alle verplichte streams/checksums die Project bij
    het openen eist) is onontgonnen reverse-engineering met MS Project als enige orakel.
    Realistischer tussenstap als er vraag is: MSPDI-export ís de officiële uitwisselroute en
    opent verliesvrij in MS Project.
- [ ] MPP9/12-legacy en Asta Powerproject PP — de eerder uitgewerkte "managed tools"-route
  (user-besluit 2026-07-07: catalogus-extensie declareert een MPXJ-CLI-hulpprogramma met checksum;
  de APP-KERN beheert download/levenscyclus; sandbox ongewijzigd; web = "alleen desktop") blijft
  hiervoor de optie als er vraag naar blijkt.
- [ ] **KYP Project REST API-integratie (onderzoek)** — de facto NL-bouwplanningstool zonder publieke
  export; directe API-koppeling zou een unieke NL-USP zijn. Eerst: API-toegang/partnerschap verkennen
  (issue #17).
- [ ] Primavera XML (PMXML) import/export — bestaat sinds fase 2 (P6 XML round-trip, sinds v2026.7.7
  minuut-precies); dit punt is de restcontrole dat we P6's PMXML-dialectvarianten breed genoeg dekken.
- [ ] SVG-export van Gantt (PNG bestaat al)
- [ ] MSPDI native `<Notes>`-mapping voor taak-aantekeningen (fase 2.10, item 1) — momenteel
  bewust weggelaten-met-warn (lossy voor onze checklist-vorm met done-vlaggen + parse-
  complexiteit); IFC blijft de verliesloze route (`OPS_TaskNotes`-pset).

#### 3.9 Rapportage
- [ ] Afdrukken naar printer (multi-page)
- [ ] Rapport-wizard (kies inhoud, layout, filters)
- [ ] Custom rapporten (kies velden, groepering, filters)
- [ ] Grafische rapporten (histogrammen, pie charts)
- [ ] Executive dashboard (samenvatting op 1 pagina)
- [ ] Opleverpuntenlijst
- [ ] Kostenrapport

> §3.10 Volledige meertaligheid is afgerond (14 locales) — staat daarom niet als to-do.

### Fase 4 — 4D/5D BIM & Geavanceerde Analyse (v2.0)

#### 4.1 4D BIM
- [ ] IFC-gebouwmodel laden en renderen (Three.js + web-ifc)
- [ ] Taken koppelen aan IFC-elementen (drag & drop)
- [ ] 4D simulatie: tijdlijn-animatie
- [ ] Bouwfase-visualisatie (kleurcodering per status)
- [ ] Scrub door tijdlijn (slider)
- [ ] Camera-posities opslaan
- [ ] Screenshot/video-export van simulatie
- [ ] BIM-model filteren op verdieping/sectie
- [ ] Transparantie voor toekomstige elementen

#### 4.2 5D kosten-koppeling
- [ ] Quantity takeoff vanuit BIM-model
- [ ] Kosten koppelen aan IFC-elementen
- [ ] 5D visualisatie (kosten per fase in 3D)
- [ ] Cumulatieve kostencurve gekoppeld aan 4D-simulatie

#### 4.3 Risico-analyse
- [ ] Probabilistische duurschatting (3-point: optimistisch/realistisch/pessimistisch)
- [ ] Monte Carlo simulatie (Rust backend)
- [ ] Tornado-diagram (gevoeligheidsanalyse)
- [ ] Risico-register met koppeling aan taken
- [ ] Confidence level-analyse (P50, P80, P90 einddatums)
- [ ] Weather-risk integration (historische weersdata)

#### 4.4 Claims & delay analysis
- [ ] As-planned vs. as-built vergelijking (visueel)
- [ ] Time Impact Analysis (TIA)
- [ ] Window analysis (period-by-period delay)
- [ ] Delay-rapport genereren
- [ ] Snapshot-vergelijking (wijzigingen per periode)
- [ ] Trend-analyse (voortgang per week/maand)

#### 4.5 Clashdetectie & ruimtelijke analyse
- [ ] Detectie gelijktijdige werkzaamheden op zelfde locatie
- [ ] Kraanreikwijdte-analyse
- [ ] Hijszone-conflicten
- [ ] Logistieke route-conflicten
- [ ] Veiligheidszone-analyse

#### 4.6 Geavanceerde weergaven
- [ ] Tijd-weg diagram (lineaire projecten: wegen, tunnels, spoor)
- [ ] 3D Gantt (locatie × tijd × activiteit)
- [ ] Resource-heatmap (overbelasting visueel)
- [ ] Dashboard-builder (drag & drop widgets)

### Fase 5 — AI, Automatisering & Integratie (v3.0)

#### 5.1 MCP-server (AI-integratie)
- [ ] MCP-tools voor de nog niet gebouwde functies uit PLAN.md §5.2 (`get_ppc`, `run_monte_carlo`,
  `suggest_optimization`); de rest van die lijst bestaat als de 42 `planner_*`-tools in `src/services/mcp/tools/`
- [ ] Natural language planning ("maak fundering in week 10, 3 dagen, 2 timmerlieden")
- [ ] AI-gestuurde planning suggesties
- [ ] AI risico-analyse
- [ ] AI resource-optimalisatie
- [ ] AI duurschatting op basis van historische data
- [ ] Conversational planning (chat-interface in app)
- [ ] Publieke TypeScript API-laag (`window.planner`) als basis hiervoor

#### 5.3 ERPNext-integratie
- [ ] Projecten synchroniseren (planning ↔ ERP)
- [ ] Inkoop-triggers vanuit planning (materiaalbestelling bij start taak)
- [ ] Timesheet-koppeling (uren ↔ voortgang)
- [ ] Factuurmomenten koppelen aan mijlpalen
- [ ] Kosten-synchronisatie (budget ERP ↔ planning)
- [ ] Subcontractor-management

#### 5.4 Automatisering
- [ ] Macro's/scripting (TypeScript API)
- [ ] REST API (voor externe integraties)
- [ ] Regels/triggers (als X dan Y)
- [ ] Batch-updates (bulk wijzigingen)
- [ ] Automatische resource-toewijzing (AI-gestuurd)
- [ ] Templates met parametrisering (bijv. "woning, 3 verdiepingen, met kelder")

#### 5.5 Externe integraties
- [ ] BIM Collaboration Format (BCF) import/export
- [ ] Relatics-koppeling (UAV-gc SE)
- [ ] VISI-koppeling (communicatieprotocol)
- [ ] Procore-koppeling
- [ ] BIM360/Autodesk Construction Cloud koppeling
- [ ] Trimble Connect koppeling
- [ ] Webhook-ondersteuning (events naar externe systemen)

### Fase 6 — Samenwerking, Cloud & Enterprise (v4.0)

#### 6.1 Multi-user samenwerking
- [ ] Gelijktijdig bewerken (CRDT-based conflict resolution)
- [ ] Gebruikersrechten/rollen (admin, planner, viewer, subcontractor)
- [ ] Audit trail (volledige wijzigingslog: wie/wanneer/wat)
- [ ] Commentaar per taak (threaded discussions)
- [ ] @mentions en notificaties
- [ ] Bijlagen per taak (foto's, PDF's, documenten)
- [ ] Subcontractor-portal (beperkte toegang)

#### 6.2 Cloud-synchronisatie
- [ ] Cloud storage backend (self-hosted of managed)
- [ ] Realtime sync (WebSocket/CRDT)
- [ ] Offline mode (werk lokaal, sync later)
- [ ] Versiegeschiedenis (terugkeren naar eerdere versie)
- [ ] Project-sharing (link delen)
- [ ] Multi-project portfolio-overzicht

#### 6.3 Mobiele app
- [ ] PWA of native Tauri Mobile
- [ ] Voortgang registreren in het veld (foto + % gereed)
- [ ] Dagplanning bekijken
- [ ] Push-notificaties
- [ ] Offline voortgangsregistratie
- [ ] QR-code scanning voor locatie-registratie

#### 6.4 Enterprise features
- [ ] Single Sign-On (SSO) / SAML / OAuth2
- [ ] LDAP/Active Directory integratie
- [ ] Portfolio-management (overzicht alle projecten)
- [ ] Live cross-project dependencies (bevroren externe ankers bestaan sinds §2.9)
- [ ] Organisatie-breed dashboard
- [ ] Capaciteitsplanning (organisatie-niveau)
- [ ] Compliance-rapportage (BRL, Wkb, VOB/B)
- [ ] Data-export voor BI-tools (Power BI, Tableau)
- [ ] White-label opties

#### 6.5 Communicatie & notificaties
- [ ] E-mail notificaties bij wijzigingen
- [ ] Push-notificaties (desktop + mobiel)
- [ ] Weekrapport automatisch genereren en versturen
- [ ] Slack/Teams integratie
- [ ] Agenda-integratie (Outlook, Google Calendar)
