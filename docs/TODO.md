# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Afgeronde items worden uit
deze lijst verwijderd — wat klaar is, staat in de changelog en git-historie.

## Openstaand

### Uit de critreview van release v2026.8.0 (2026-08-17)
- [ ] **Perf: met het bezettingsoverzicht open draait er een volledige CPM-solve per bewerking van
  het actieve document.** `getOpenDocumentPayloads()` levert óók het actieve document mee, met
  `scheduleStale = s.scheduleStale` — na elke bewerking `true`. De `useMemo` in
  `ResourceOccupancyView` invalideert dan op `activeTasks`/`activeAssignments` en
  `computeLibraryOccupancy` rekent het actieve document synchroon in de render efemeer door over de
  vólledige takenlijst. Op de schaal die `relationRules.ts` zelf noemt (3000 taken / 1500 relaties:
  700 ms–2,6 s) is dat merkbaar hakkelen tijdens typen. De §7-snit heeft de bibliotheek-*load*
  teruggebracht maar de solve niet meegerekend. Richting: het actieve document overslaan in de
  efemere tak (het heeft `useAutoCalcCPM` of F5), of de solve memoïseren per payload-referentie.
- [ ] **`platformRefusesWrites` is een sessie-brede latch zonder uitweg.**
  `src/services/fileAccess/webBackend.ts`: één `NotAllowedError`/`SecurityError` stuurt de rest van
  de sessie élke opslag naar de downloadmap, ook in een browser waar in-place schrijven prima werkt.
  Reset bestaat alleen als `resetWebWriteRefusalForTests()`. `SecurityError` is juist het
  "geen geldige gebruikersactivatie"-geval, dus een programmatische save kan de latch omzetten en
  daarmee de handmatige Ctrl+S daarna degraderen. Richting: alleen op `NotAllowedError` latchen en
  `SecurityError` als eenmalige fout behandelen. (Nog te bevestigen: of een web-buildpad
  `saveFileDialog` zonder gebruikersactivatie kan bereiken.)
- [ ] **De acht nieuwe voorbeeld-resourcesets staan buiten elke poort.** `verify:examples` eist
  overallocatie juist wél (regel ~196 in `verifyShowcase`, alleen voor showcases), dus niets bewaakt
  dat de acht nieuwe sets overallocatie-vrij blijven. Ze zijn nu gemeten schoon; de eerstvolgende
  topologie-wijziging kan ze stil overbezet maken. Overweeg een assertie.
- [ ] **`deleteTasksBulk` kan een dode undo-stap achterlaten.** Met ≥2 ids pusht `withTransaction`
  onvoorwaardelijk een snapshot; zijn álle ids al weg, dan blijft die stap staan. Het 1-id-pad
  ontwijkt dat bewust.
- [ ] **De thema-map in `index.html` is een handkopie van `THEME_MIGRATION`** in
  `settingsStore.ts`. Vandaag identiek (acht sleutels, zelfde defaults), maar niets bewaakt dat —
  precies de duplicatieklasse die dit project elders wél dichtzet.
- [ ] **`relationRules.ts` is de bron van de regel, niet de poort.** `pasteTasks` (`taskSlice.ts`
  ~978) en het tak-uit-sjabloon-pad (~1060) pushen `s.sequences` zonder `relationVerdict`, dus een
  tak kopiëren die een spookrelatie bevat maakt er weer een. Verdedigbaar als kopie-van-bestaande-
  data (net als import), maar de changelog van v2026.8.0 beweert "single source of truth" — zet
  óf de code óf die tekst recht.
- [ ] **`verify-docs.ts` poort 7e telt tools met een regex** (`/['"](planner_[a-z_]+)['"]/g`) over
  `src/services/mcp/tools/`, dus ook tool-namen in beschrijvingsproza. Vandaag klopt de telling
  (39), maar een beschrijving die een niet-bestaande tool noemt glipt erdoor.
- [ ] **Mijlpaal met start maar zonder finish is niet relatie-sleepbaar.** `getRelationSourceAt`
  eist beide datums, `drawMilestone` alleen een start — hij wordt dus getekend maar is geen
  sleepbron. Randgeval.

### Bedrijfsbibliotheken (B1.1) — vervolgen (2026-07-24)
- [ ] **B1b — bezettingsoverzicht** over open documenten (binnen één bedrijf/pool; bouwt op de
  herkomststempels + Resources-tab Bedrijfsweergave uit B1.1). Zie docs/library.md
  "Bekende beperkingen". In uitvoering — ontwerpdoc:
  docs/superpowers/specs/2026-08-14-b1b-bezettingsoverzicht-design.md (incl. §5a-histogram
  per poolitem, besluit eigenaar 2026-08-14).
- [ ] **B1b-vervolg: "alle resources"-histogram verkennen** (wens eigenaar 2026-08-14). De
  per-dag-data ligt er na B1b al (`dailyLoad` per booking). Drie kandidaatvormen, kiezen ná
  praktijkervaring met v1: (a) totaalsom over alle poolitems zoals "All resources" in het
  projecthistogram, met rood op dagen waarop minstens één item boven zijn capaciteit zit;
  (b) mini-histogram/sparkline per tabelrij, elk op eigen schaal met eigen capaciteitslijn;
  (c) heatmap resources × dagen met bezetting-t.o.v.-capaciteit als celkleur (de klassieke
  "resource usage"-weergave, schaalt het best bij grote pools).
- [ ] **B1c — nivelleren tegen restcapaciteit** (besluit eigenaar 2026-08-14): vanuit een
  conflictregel het veroorzakende document activeren en dáár nivelleren tegen
  bedrijfscapaciteit mín de boekingen van de andere open documenten. Eigen ontwerpdoc ná
  oplevering B1b; zie het B1b-ontwerpdoc §12 voor de open ontwerpvragen. Echt simultaan
  cross-document nivelleren blijft aan onderhoudbaarheidsitem 41 (`createAppStore()`) hangen.
- [ ] **Gedeelde opslag/sync** tussen machines (wortel van alle drie de B1.1-beperkingen: pool-
  divergentie tussen planners, bezettingsoverzicht dat alleen de eigen machine ziet, en
  stilzwijgend overschrijven tussen twee tabbladen/vensters op dezelfde machine).
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
- [x] **Niemand heeft gemeten of de MCP-tools de bibliotheekstempels bijwerken.** *(gemeten
  2026-07-27, geen defect)* Het stempelbeheer blijkt correct: `planner_manage_resources` en
  `planner_update_calendar` laten `libraryOrigin` met rust en werken `syncedHash` niet bij, op alle
  drie de routes (direct, via `planner_batch`, en bij aanmaken/verwijderen). Een MCP-wijziging op een
  gevolgd veld levert dus netjes `deviated` op, een wijziging op `maxUnits` blijft `in-sync` (die zit
  bewust niet in `RESOURCE_DIFF_FIELDS`), en een resource die de AI in een gekoppeld project aanmaakt
  wordt projecteigen zonder stempel. Vastgepind in `tests/mcp/cases-bibliotheek.ts` (9 tests,
  mutatie-getest tegen beide faalvormen). Bijvangst uit die meting: het blind meeschrijven van de
  hash zou érger zijn dan gedacht — `fileHash === syncedHash` leest als `behind`, en `behind` wordt
  door `runOpenBoundary` stil ververst naar de poolwaarden, waarmee de AI-bewerking geruisloos zou
  verdwijnen in plaats van alleen onbevraagd te blijven.
- [x] **De MCP-bridge mag schrijven waar de gebruiker niet mag — ontwerpbeslissing, geen defect.**
  *(besloten én gebouwd 2026-07-27: spiegelen)* Volgde uit de meting hierboven. `ResourcePanel`
  rendert naam, type, tarief/uur en eenheid als platte tekst zodra er een herkomststempel op zit
  (`isResourceFieldLocked`), en `description` heeft in de projectweergave niet eens een kolom —
  precies de vijf `RESOURCE_DIFF_FIELDS` die `planner_manage_resources` wél gewoon schreef. De
  mechaniek klopte, maar de gemeten uitkomst was een afwijkingsdialoog over een wijziging die de
  gebruiker niet met eigen handen had kúnnen maken; koos hij daar "bibliotheekwaarden gebruiken", dan
  draaide de AI-bewerking terug. De tool weigert die velden nu op een gestempeld item en noemt de
  twee routes die wél werken (in de bibliotheek wijzigen, of eerst losmaken); een gemengde update
  sneuvelt in zijn geheel, zodat er geen half toegepaste stille no-op ontstaat. Gating en UI-slot
  delen één bron (`onOpenStatusForResource` + `isResourceFieldLocked` + `RESOURCE_DIFF_FIELDS`), en
  `planner_list_resources` geeft per geërfde rij een `library`-blok (company/status/lockedFields)
  zodat een assistent het slot ziet in plaats van erin te lopen. De pool zelf is bewust NIET via MCP
  muteerbaar gemaakt: app-globale data, raakt projecten die niet openstaan, valt buiten de
  projecthistorie. Kalenders houden hun bestaande gedrag — daar kent de UI geen slot, dus is
  'deviated' juist de gespiegelde uitkomst.
- [ ] **"Losmaken van de bibliotheek" als MCP-actie.** Directe vervolgstap op het punt hierboven: de
  weigering verwijst naar losmaken als de begaanbare route, maar de bridge kan die route alleen
  bénoemen, niet lopen — de assistent moet de gebruiker vragen het handmatig te doen.
  `unlinkResourceFromLibrary` bestaat al als store-actie, is projectlokaal en ongedaan te maken.
  Overwegen: dezelfde actie voor kalenders, en of het een eigen tool wordt of een `action` op
  `planner_manage_resources`.
- [ ] **Crash-herstel reset de bibliotheek-UI-vlaggen niet.** `newDocument()`, `closeDocument()`,
  `newProject()` en `createNewProject()` zetten `ui.showLibraryLinkDialog`/`ui.libraryRefreshNotice`
  inmiddels alle vier terug (zie de asserts in `tests/library/check-library-slice.ts`), maar
  `restoreDocuments()` doet dat niet expliciet. Dat pad draait bij het opstarten van de app, vóór
  enige gebruikersinteractie, dus het risico dat er een vlag uit een vorige sessie overleeft is klein
  — maar het is niet gemeten en de dialoog rendert onvoorwaardelijk zodra de vlag waar is, dus een
  blijven-staande vlag toont een leeg koppel-/afwijkingsscherm. Vervolgstap: nagaan of de vlaggen het
  herstelpad überhaupt kunnen bereiken, en zo ja dezelfde twee regels toevoegen plus een assert.
- [x] **GROOT-showcase "Nieuwbouw Appartementencomplex De Vaart" overalloceert 10 van zijn 12
  resources, terwijl het ontwerpdocument expliciet maar 1 belooft.** *(gefixt 2026-07-27)*
  Oorzaak was inderdaad de generator: `scripts/showcase-groot.ts` dimensioneerde de pools op ÉÉN
  toren terwijl de drie torens per ontwerp parallel lopen (en de niet-uniforme curves het tempo
  bovendien op enkele dagen concentreren). Elke pool is nu op de gemeten worst case gezet —
  3 × de piek van één toren, per toren afzonderlijk gemeten met de echte `computeResourceLoad`:
  Betonvlechters 4→6, Timmerlieden 4→12, Gevelbouwer 2→6, Liftleverancier 1→3, Tegelzetters 3→15,
  Keukenmonteurs 2→9, Installateurs 4→18, Schilders 3→15. Torenkraan (1, met capaciteitsstap naar
  2) en Stukadoors (3) houden bewust hun krappe capaciteit: dat zijn de twee bedoelde knelpunten.
  Resultaat: 261 → 80 overgealloceerde resource-dagen, 10 → 2 pools; beide resterende knelpunten
  zijn met de echte nivelleerder volledig oplosbaar (80 → 0 dagen, 0 onopgeloste taken) — vóór de
  fix bleven er 4 pools zélfs ná nivellering staan. `maxUnits` raakt de CPM-datums niet
  (resources-design §3), empirisch bevestigd: alle 260 taken houden identieke ES/EF/LS/LF/TF/
  kritiek-vlaggen en `criticalPaths` blijft 2. De ontbrekende bovengrens is ook gedicht:
  `scripts/verify-examples.ts` assert nu naast `overalloc.length > 0` óók `<= 2` voor GROOT, met
  de namen in de foutboodschap; die assert is aantoonbaar rood gezien tegen de oude data.

### MCP-bridge — robuustheid van de server zelf (2026-07-27)

> Gemeten tijdens de eerste echte koppelpoging. Beide punten gaan niet over de tools maar over de
> schil eromheen: de bridge kan in een toestand raken waarin hij nog luistert maar niets meer
> beantwoordt, zonder dat iemand dat merkt. Dat is dezelfde faalklasse als de stille no-ops die deze
> ronde zijn opgeruimd — alleen een laag dieper.

- [x] **Snap: werkt de MCP-bridge onder confinement?** *(gemeten 2026-07-30 op de geïnstalleerde
  snap 2026.7.13 rev 1 — JA, volledig)* De vraag kwam op omdat `snap/snapcraft.yaml` alleen
  `network` plugde (client-only) terwijl de storebeschrijving de MCP-server aanprijst. Gemeten
  uitkomst: binden lukt tóch. Een TCP-listener op 127.0.0.1 slaagt binnen `snap run --shell`, en de
  geïnstalleerde app luisterde daadwerkelijk op 3877 met een werkende bridge. De hele keten is
  end-to-end gedraaid tegen die snap (dit was T24, dat nooit echt gelopen had): geen token ⇒ 401,
  fout token ⇒ 401, `Origin`-header ⇒ 403, `initialize` ⇒ serverInfo 2026.7.13, `tools/list` ⇒ 39
  tools met uitsluitend de `planner_`-prefix, en een echte `tools/call` op het geopende document met
  correcte envelope. Alle antwoorden kwamen direct — geen spoor van het 120s-timeout-beeld.
  Oorzaak dat het zonder `network-bind` werkt: `browser-support` staat in het seccomp-profiel
  bind/listen/accept toe "for anonymous sockets", en er zijn geen AppArmor-inet-regels die het
  alsnog mediëren. `network-bind` is alsnog toegevoegd — niet als reparatie, maar om die
  afhankelijkheid vast te leggen: nu hangt het luisteren aan een plug die er voor WebKit zit.
  Ook gemeten in dezelfde ronde: **"Backup-map openen" werkt onder confinement.** `openBackupFolder`
  (`src/services/mcp/backup.ts`) maakt de map aan en roept `open()` uit `plugin-shell` aan, wat op
  Linux op xdg-open uitkomt. Binnen `snap run --shell` gaf `xdg-open` op de ai-backups-map exitcode 0
  én startte er daadwerkelijk een bestandsbeheerder (nautilus). Kanttekening: getest is het
  MECHANISME (xdg-open door de portal), niet de knop zelf in de AI-tab. De geopende map bevatte
  bovendien echte backups — twee documentmappen, waarvan één het `activeDocumentId` uit de
  bridge-envelope — dus ook het backup-schrijfpad werkt onder confinement (appDataDir valt binnen
  `~/snap/open-planner-studio/`, dus zonder `home`-plug-afhankelijkheid).
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

> Gevonden tijdens het overzetbaar maken van uurkalenders via de MCP-bridge. Alle drie zijn
> **beschreven** in de tool-descriptions en met tests vastgepind, dus niets gebeurt stil. De
> eerste bleek bij nadere inspectie al opgelost (zie hieronder); de resterende twee staan nog open.

- [x] **Een kalender zonder taak of resource verdwijnt bij opslaan+herladen.** *(achterhaald,
      opgelost door de A2-fix, geverifieerd 2026-07-27)* Dit was voorafbestaand gedrag (`ifcReader.
      extractCalendarLibrary` bouwde de bibliotheek uitsluitend uit `IFCRELASSIGNSTOCONTROL`-
      relaties), maar B1.1 heeft de beperking al opgeheven: de A2-fix in `extractCalendarLibrary`
      vangt nu ook alle overige `IFCWORKCALENDAR`-entiteiten op (behalve de projectkalender) die
      geen relatie hebben — nodig omdat een naar de bibliotheek gepromote kalender anders zijn
      `libraryOrigin`-stempel verloor. Empirisch bevestigd met een write→read round-trip van een
      project met een kalender zonder enige taak/resource-koppeling: de kalender komt terug met
      naam en uren intact.
- [ ] **Per weekdag verschillende uurbanden overleven een round-trip niet.** IFC draagt één
      werkweek-patroon, dus alle werkdagen krijgen bij herladen de banden van de eerste werkdag —
      een korte vrijdag komt terug als kopie van maandag. Zelfde route als hierboven zou dit ook
      oplossen.
- [ ] **Wélke kalender de projectdefault is, kan de bridge niet wisselen** (de inhoud ervan wel, via
      het id uit `projectDefaultId`). `update_project.calendarId` weigert nu met die uitleg. Beoordeel
      of dat een echte beperking moet blijven of gewoon nog gebouwd moet worden.

### MPP/MSP-import (fase 3.8, MSP-pariteit) — bekende beperkingen (2026-08-17)

> Verzameld tijdens de MPP-datumgetrouwheidsetappe (T13-T16, zie
> `docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md`). Twee van de drie
> (contouring-detectiegrens, TASK_MODE-hypothese) zijn sinds de etappe "nul afwijkingen" (Z9a/Z16,
> 2026-08-18) daadwerkelijk opgelost — hieronder afgevinkt met verwijzing. Het P6-item blijft een
> echte, blijvende schemabeperking (niet stilzwijgend: console.warn, code-toelichting en de gids
> dekken 'm) en stond eerder onder "IFC-kalenderbibliotheek" — hierheen verhuisd, het gaat over een
> export-schemabeperking, niet over de IFC-kalenderbibliotheek (B1.1).

- [x] **P6-XML-export laat werkende kalenderuitzonderingen weg — schemabeperking, geen bug (fase
      3.8 T13, 2026-08-17).** `WorkingException` (T2/T3: een dag-uitzondering die een dag WERKEND
      maakt) is niet uit te drukken in P6-XML: `<HolidayOrException>` kent geen `DayWorking`-achtig
      veld (alleen `Name`/`Date`/`FinishDate` — `p6xmlReader.ts`'s `parseP6HolidayOrExceptions` leest
      elk element onvoorwaardelijk als NIET-werkend). P6 zelf modelleert een ingeroosterde extra
      werkdag alleen via `<StandardWorkWeek>` (project-breed weekpatroon, geen per-datum-uitzondering)
      — geen veilige automatische vertaling. `p6xmlWriter.ts`'s `writeHolidayOrExceptions` laat werkende
      uitzonderingen daarom bewust weg, met `console.warn('P6-export: … werkende kalenderuitzondering(en)
      weggelaten — niet uitdrukbaar in P6-XML …')`. **T16: gidsvermelding toegevoegd**
      (`gids-import-export.md`, nl+en) — de console.warn blijft de enige gebruikersvoorlichting bij
      het exportmoment zelf.
- [x] **Zuivere resource-contouring is niet betrouwbaar detecteerbaar — de contouring-detectiegrens
      opgelost (Z16, fase 3.8 etappe "nul afwijkingen", 2026-08-18).** De oude `spanGt`-proxy (venster
      > duur, een schatting) is vervangen door `countScheduleNotes`, dat drie ECHTE signalen telt
      (`Task.levelingDelayMinutes`/`.splitGaps`/`.timephasedFinishFloor`|`.timephasedDurationWalks`).
      Bijvangst: MPXJ's eigen referentiebestand voor resource-contouring (`mpp14resource.mpp`,
      "Contoured Task") wordt daarmee nu wél herkend — de oude WORK_CONTOUR-FixedMeta-bit-aanpak bleef
      ongebruikt (0 treffers op datzelfde bestand), maar de echte timephased-telling raakt dezelfde
      taak via een ander pad. Zie `mppReader.ts` (`countScheduleNotes`) en `gids-msproject-import.md`.
- [x] **TASK_MODE (Manually Scheduled vs. Automatically Scheduled) — hypothese bevestigd en
      geïmplementeerd (Z9a, fase 3.8 etappe "nul afwijkingen", 2026-08-18).** De bit is daadwerkelijk
      uitgelezen (`Fixed2Meta`-bit-flag, offset 8, masker 0x08/0x80 al naar applicationVersion) en
      bevestigd: een MANUALLY_SCHEDULED taak gebruikt inderdaad zijn eigen `START`/`FINISH`-veldpaar
      (1283/1284, `Fixed2Data` blok 1) i.p.v. `SCHEDULED_START`/`SCHEDULED_FINISH` (35/36). Reader
      (`mppReader.ts`/`mppGroundTruth.ts`, byte-gelijk gespiegeld tussen lezer en grondwaarheid) en
      solver (rauw anker, geen snap, backward-early-return, manual wint van constraints) beide
      geland. Corpusbreed effect gemeten: 14 bestanden naar 0/0/0/0, startDiff 211→5, finishDiff 225→19.

### MPP/MSP-import (fase 3.8, etappe "nul afwijkingen") — bewust laten liggen (2026-08-19)
- [ ] `CPMSolver.ts` leveling-takvolgorde: een taak met zowel `levelingDelay` (dagen) als `levelingDelayMinutes` zou aan de ankerregel ontsnappen (vandaag onmogelijk — lezer zet alleen minuten, nivelleerder alleen dagen); precedentie-commentaar benoemt dat geval niet (Z6-veeglijst).
- [ ] `CPMSolver.ts` M1-bandsnap-float-nuance: de bandsnap kan de ES verder duwen dan de kale leveling-delay terwijl de backward-doorgifte alleen de kale delay terugrekent — float-nuance op elapsed-delay-WORKTIME-taken, geen datumeffect (Z6-veeglijst).
- [ ] `CPMSolver.ts` `isExactBandEnd`/`dayFirstBandStart`/`dayLastBandEnd` leunen stilzwijgend op de engine-brede oplopend-gesorteerde-banden-aanname (`effectiveBandsOn` sorteert niet) — docblok-vermelding zoals `nextBandStartStrictAfter` die wel heeft (Z13-veeglijst R3).

> Uit de Z20-eindronde: dingen die deze etappe bewust NIET meenam, met de reden erbij — zodat het
> geen verrassing is als iemand er later tegenaan loopt.

- [ ] **Native MSPDI-`<Manual>`/`<LevelingDelay>`/`<TimephasedData>` lezen en schrijven.**
      Orkestratorbesluit O4 (2026-08-17): native schrijven zonder terugleeslezen zou een stille
      semantiek-omklap zijn (hetzelfde precedent als `ELAPSEDTIME`) — de MSPDI-export waarschuwt
      daarom bewust in plaats van deze drie elementen te schrijven. Native lezen+schrijven is een
      eigen, kleine vervolg-etappe.
- [ ] **Splitsen/handmatig plannen als bewerkfunctie (UI).** Deze etappe levert lezen, rekenen,
      tekenen en round-trip; slepen om te splitsen, split-handles in de Gantt en split ongedaan maken
      zijn een aparte etappe (plan §1.4/O2, orkestratorbesluit akkoord 2026-08-17).
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

- [ ] **Anker versus berekend: `scheduleStart` als datamodel-vraag.** Het paneelveld is op
      2026-07-20 gelijkgetrokken met de vier andere oppervlakken (toont `earlyStart || scheduleStart`,
      schrijft bij wijziging naar het anker), maar de onderliggende modellering blijft verwarrend: in
      de tabel typ je een datum die naar `scheduleStart` gaat terwijl de cel daarna de berekende
      datum toont — je invoer *lijkt* genegeerd. Nette oplossing = het anker alleen bewaren bij taken
      zonder voorgangers, óf het als apart "Plan"-veld benoemen en overal consistent labelen
      ("Anker" vs "Berekend"). Raakt store, IFC-round-trip, `TableEditor`, `TaskDialog`, paneel,
      `check-ifc-roundtrip.ts` en i18n — eigen golf. Let op het regressierisico dat in
      `src/state/slices/scheduleSlice.ts:96-100` beschreven staat (taak blijft op zijn gedrifte
      datum hangen na het verwijderen van een relatie).

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
- [ ] **`droppedSequenceIds` heeft nul consumenten** (I4). `CPMResult.droppedSequenceIds` (489a9ef2
      + de expansie-drops uit C1/de MAX_EXPANDED_RELATIONS-klem) wordt nergens in de UI of MCP
      getoond — een gebruiker met een gedropte relatie (kapotte tak, vooroudersrelatie, klem) ziet
      dat nergens terug. Kandidaat-aansluitpunten: een badge naast de bestaande out-of-sequence-
      teller in `StatusBar.tsx` (zelfde `⚠`-patroon, `cpmResult.outOfSequenceSequenceIds`), en/of
      opname in `get_project_overview`/vergelijkbare MCP-leestools (`src/services/mcp/tools/
      readTools.ts`) zodat een AI-assistent het kan zien en melden. Geen UI-werk nu — bewust
      doorgeschoven, dit is puur zichtbaarheid, geen correctheidsgat.

### Klein
- [ ] **Raster-terugval van de rapport-export heeft geen paginalimiet.** Gemeten 2026-07-27 tijdens
      issue #25: de PREVIEW is inmiddels afgedekt (`maxPages` in `paginateCanvasToTiles`, 30 vellen),
      maar `exportRaster()` in `ReportPanel.tsx` niet — en dat mag ook niet zomaar, want een export
      moet compleet zijn. Daar bestaan dus álle `rows * cols` pagina-canvassen tegelijk vóór de
      omzetting naar JPEG, op `SUPERSAMPLE = 2`. Een A3-vel is daarmee ~2382×1684×4 ≈ 16 MB; het
      gemeten scenario van 300 taken met `timelineColumns: 8` (20 rijen × 8 kolommen = 160 pagina's)
      komt op ~2,5 GB. Let op wanneer dit toeslaat: raster is de `catch`-terugval van de vector-tak,
      dus precies op het moment dat de vector-export net gefaald is. `MAX_TIMELINE_COLUMNS = 32`
      begrenst het wel, maar staat nog steeds honderden pagina's toe. Pre-existing gedrag, geen
      regressie van #25 — dat werk maakte het pad alleen makkelijker bereikbaar (één dropdown i.p.v.
      een handmatige zoominstelling). Fix-richting: pagina's streamend omzetten naar JPEG en het
      canvas per pagina vrijgeven i.p.v. ze allemaal vast te houden, of één pagina-canvas hergebruiken.
- [ ] **Recovery-robuustheid bij een corrupt herstelbestand.** Sinds 2026-07-20 rekent
      `restoreDocuments` het herstelde document door (`runCPM`), net als elk ander laadpad. Een
      corrupte of afgekapte recovery-snapshot na een crash laat het opstarten daardoor klappen in
      plaats van doormodderen. Overweeg een defensieve afhandeling rond die ene aanroep, met een
      zichtbare melding in plaats van een stille catch.
- [x] **`project.endDate` overleeft opslaan + herladen niet.** *(gefixt 2026-07-20)* `ifcWriter` schrijft
      `planEnd = max(scheduleFinish)` en gebruikt `project.endDate` alleen als fallback bij nul
      taken; de reader leest dat terug ín `project.endDate`. Elke ingevulde contractuele einddatum
      gaat dus verloren bij een round-trip — los van Move Project, dat het veld correct meeschuift.
      Het huidige gedrag is met toelichting vastgelegd in `check-move-project.ts` (check 151), zodat
      een fix die check rood maakt.
      **Aanpak (besloten 2026-07-20):** contractuele datums krijgen eigen persistentie in het
      `OPS_ProjectSettings`-pset (precedent: `wbsAutoNumber` en de statusdatum zitten daar al, met een
      gedocumenteerde reden in `ifcWriter.ts` ~regel 308). `IFCWORKPLAN.StartTime/FinishTime` blijven
      ongewijzigd de *afgeleide* plan-omvang dragen — dat is semantisch juist en andere IFC-tools
      lezen die slots. Lezer: pset wint, anders terugvallen op het WORKPLAN-slot, zodat bestaande
      bestanden zich exact als vandaag gedragen.
      **Twee valkuilen die de fix moet afdekken:**
      (1) Een lege `endDate` moet léég terugkomen. De golden rule van dat pset (alleen schrijven wat
      gezet is) zou bij `''` niets wegschrijven, waarna de lezer terugvalt op het WORKPLAN-slot en de
      afgeleide datum alsnog invult — dezelfde bug, verplaatst naar het lege geval. De lezer moet
      "veld aanwezig maar leeg" van "veld afwezig" kunnen onderscheiden.
      (2) **`check-ifc-roundtrip.ts` geeft hier valse zekerheid.** Regel ~377 vergelijkt
      `project.startDate`/`endDate` wél, maar de fixture heeft `endDate: '2026-07-24'` (regel ~257)
      terwijl de laatste taak op diezelfde datum eindigt (regel ~184) — afgeleid en contractueel
      vallen samen, dus het verlies is per constructie onzichtbaar en de check passeert zonder iets
      te bewijzen. De fixture moet contractuele datums krijgen die expliciet afwijken van de
      taak-span, anders bewijst ook de fix niets.
      **Uitgevoerd 2026-07-20** volgens bovenstaande aanpak. Beide valkuilen afgedekt: de lege
      einddatum wordt als NominalValue `$` geschreven ("aanwezig maar leeg") zodat de lezer hem van
      een afwezig veld kan onderscheiden, en de round-trip-fixture heeft nu contractuele datums los
      van de taak-span. De gap is uit KNOWN_GAPS naar de echte vergelijking verhuisd en check 151
      legt het juiste gedrag vast. Rood/groen bewezen; live in de devbuild bevestigd.
      Restpunt: `public/examples/*.ifc` zijn niet geregenereerd en bevatten de nieuwe
      pset-properties dus nog niet — onschadelijk (ze lezen via de WORKPLAN-terugval), maar bij een
      volgende `gen:examples`-run komen ze er vanzelf bij.
- [ ] **Mijlpaal horizontaal verslepen om de datum te wijzigen.** Nu geblokkeerd door dezelfde
      `getTaskBarBounds`-null die het relatie-tekenen blokkeerde (opgelost in spec 2026-08-14). Raakt
      `barDrag`: bij een 0-duurtaak mag alleen een body-sleep armen, nooit een resize-greep, en
      snapping/undo/uur-modus moeten kloppen.
- [ ] **`useDependencyDraw.ts` toetst de drop-x tegen `ui.leftPanelWidth`, terwijl de overige
      canvas-hittests `taskTableWidth` gebruiken.** Uitzoeken of dat een bug is.
- [ ] **Het taakbewerkvenster met de uren-velden (`Duur (uren)`/`Totaal uren`) is alleen via
      dubbelklik op de canvas-Gantt-balk bereikbaar** en dupliceert daarbij het rechter
      eigenschappenpaneel met net andere labels. Gemeten tijdens een browsergebruikstest van de
      urenplanning (2026-08-15): het paneel toont `Duur (dagen)`, de dialoog (`TaskDialog`, via de
      gedeelde `task-sections`) toont `Duur (werkdagen)` voor hetzelfde veld — twee ingangen naar
      dezelfde taakvelden met net iets andere bewoording, en de dialoog is niet vanuit het paneel
      of het lint te openen. Op te lossen: óf één consistente labelset over beide oppervlakken,
      óf de dialoog ook vanuit een expliciete actie (contextmenu/lint) bereikbaar maken i.p.v.
      alleen via dubbelklik op de balk.
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

### Store-factory: wat er ná K-item 41 nog tussen twee instanties gedeeld is (2026-08-17)

`createAppStore()` bestaat, de singleton wordt eruit gebouwd, en twee instanties hebben elk hun eigen
project, taken, resources, selectie en undo/redo-stacks. Wat er nog aan de singleton of aan
module-state hangt — en dus GEDEELD is — staat vastgepind in `tests/planning/check-store-factory.ts`
deel 4. In volgorde van hoe hard het split-view blokkeert:

- [ ] **`withTransaction` importeert `useAppStore` rechtstreeks** (`batchTransaction.ts`). Een bulk op
      instantie B neemt zijn snapshot op de SINGLETON. Zelfde verhaal voor `runInMcpTransaction`
      (`mcpTransaction.ts`, tien aanroepen). Beide moeten de store als parameter krijgen.
- [ ] **De batch-diepte, de undo-coalescing en de MCP-suppressie zijn module-variabelen**
      (`transaction.ts`: `batchDepth`, `coalesce`, `undoSeq`, `mcpTransactionActive`). Twee
      instanties delen die teller, dus een bulk op A onderdrukt de per-mutatie-snapshots van B. De
      kop van die module beargumenteert waarom ze niet in het DOCUMENTCONTRACT horen — dat argument
      staat nog, maar het sluit niet uit dat ze per STORE moeten leven.
- [ ] **De app-globale registers** (extensies, MCP-server, SDK, bibliotheek-persistentie) kennen maar
      één store. Deels bewust — een extensie hoort niet per venster te bestaan — maar er is niet
      uitgezocht welk deel wél per instantie moet.
- [ ] Pas als die drie opgelost zijn kan split-view met twee documenten hierop leunen. Haal dan de
      vastpinningen in deel 4 van de batterij weg en werk de kop van `createAppStore` bij.

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

### Klein — fit en contentbreedte zijn het oneens over een taak zonder finish (2026-08-17)
- [ ] **`computeFitToProject` valt op de finish-keten terug op de start (`|| s`),
      `computeContentSpanDays` niet.** `ganttViewport.ts` doet
      `earlyFinish || scheduleFinish || lateFinish || s`; `ganttRenderOptions.ts` doet dezelfde
      keten zonder die laatste terugval. Een taak met alleen een start telt dus wél mee voor de
      Ctrl+0-fit maar niet voor de contentbreedte, en kan daardoor buiten `maxScrollX` vallen
      terwijl de fit er wél naartoe zoomt. De codedivergentie is zeker; de bereikbaarheid niet —
      `createDefaultTaskTime` zet altijd een `scheduleFinish`, dus je hebt een corrupte import of
      een externe adapter nodig. *Eerst uitzoeken:* wat de IFC-lezer en de CSV/MSPDI/P6-importers
      kunnen opleveren; pas daarna beslissen welke van de twee ketens de juiste is. Niet ontstaan
      door K-item 33 — dat item legde het alleen bloot. Er staat een toelichtende regel bij beide
      functies zodat het verschil niet als slordigheid leest.

### Klein — de indirecte route naar een spookrelatie is volledig stil (2026-08-14)
- [ ] **Structuurmutaties kunnen een bladtaak-met-relaties tot verzameltaak maken zonder enig
      signaal.** De mijlpaal-relaties-tak (`docs/superpowers/specs/2026-08-14-mijlpaal-relaties-
      design.md`, §5a) blokkeert alleen het *directe* pad — een relatie rechtstreeks naar een
      verzameltaak leggen — met een leesbare weigering. Het *indirecte* pad via `indentTasks`,
      `moveTaskTo`, `addTask({ parentId })` en `insertWbsTemplate` is stil: een project met A→B
      waar de gebruiker C onder B inspringt, maakt A→B met terugwerkende kracht tot spookrelatie.
      De Gantt tekent de pijl identiek, er komt geen melding, en F5 verschuift de planning zonder
      uitleg. De enige aanwijzing is het waarschuwingsdriehoekje in het Relaties-paneel (niet
      standaard open, visueel niet te onderscheiden van de bestaande lead-waarschuwingen daar).
      MCP meldt hier ook niets: `planner_add_tasks` met een `parentId` maakt de spookrelaties
      zonder een woord, en de leestools melden per relatie nergens "zonder effect".
      *Kandidaat-aanpak:* dezelfde samenvattende melding als na het laden (`notifications.
      summaryRelationsIgnored`) afvuren wanneer een structuurmutatie relaties zonder effect maakt,
      óf de spookpijl in de Gantt gestippeld/gedimd tekenen zodra `hasSummaryEndpoint` waar is.
      Gevonden bij de eindreview op die tak.

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

#### Snap-packaging — follow-ups
Snap-packaging is werkend en zit op `main` (zie changelog +
[ontwerp](superpowers/specs/2026-06-26-snap-packaging-design.md)): `snap/snapcraft.yaml`
(core22, strict, gnome-extensie) herverpakt de release-deb, en `snap.yml` bouwt op
tag-push de `.snap` als release-asset. Geverifieerd via een `workflow_dispatch`-run tegen
`v2026.6.0` (groene build, geldig `.snap`, WebKitGTK uit de gnome-runtime). Wat rest:

### Distributie & Release — release notes in de in-app updater

### Kwaliteit & verificatie

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
> **Status: gemerged op main (golven 0-6, sinds 2026-07-06); visuele QA en fix-golf lopen nog.
> CHANGELOG-note staat onder `Ongepubliceerd` in afwachting van het versionslag.**

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
> **Status: gemerged op main (fase-2.9-branch, merge f79ae82 — 9 golven + QA + fix-golven);
> CHANGELOG-note staat onder `Ongepubliceerd` in afwachting van het versionslag.**

#### 2.10 Gebruikersdocumentatie & showcase-voorbeelden (afsluiter van fase 2)

> **AFGEROND (v2026.7.9 + v2026.7.10, 2026-07-07 t/m 2026-07-10).** Sneltoets-register + Ctrl+/-overzicht,
> contextmenu's (4 oppervlakken), box-selectie, taakdialoog-parity via gedeelde task-sections,
> taak-aantekeningen (IFC-pset `OPS_TaskNotes`), toewijzing verplaatsen, ConfirmDialog, relatietype-popover,
> gedockt/versleepbaar resourcepaneel, first-startup (welkom + 7-staps rondleiding + feedback-slotstap),
> 3 woningbouw-showcases klein/middel/groot (generator-schema uitgebreid; `verify:examples` als levend
> contract), en volledige in-app-documentatie NL+EN (25 artikelen, F1/Backstage-viewer, `verify:docs`).
> Zie changelog, de specs in `superpowers/specs/2026-07-07-2.10-*` en de git-historie van `fase-2.10`.
> Bewust doorgeschoven: drag-and-drop toewijzing-verplaatsen; sneltoets-herbinden; 12 extra doc-talen.

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
- [ ] Fasering-templates (fundering, ruwbouw, afbouw, installatie, oplevering)
- [ ] Seizoensgebonden restricties (geen buitenwerk in winter)
- [ ] Kraanplanning (beschikbaarheid, capaciteit)
- [ ] Bouwplaatsinrichting-milestones

#### 3.8 Import/export
> Zie ook GitHub-issue #17 (DutchSailor, 2026-07-06): onderbouwd formaten-voorstel met NL-marktanalyse
> ("6+2"-lijst). Kern klopt met onze richting; prioriteiten hieronder daarop aangescherpt.
- [ ] **Primavera XER import/export** — tekstformaat, native in TS haalbaar (geen JVM); samen met ons
  bestaande PMXML dekt dit de P6-wereld. Hoogste interop-prioriteit na fase 2 (issue #17).
- [ ] **iCalendar (.ics) export** — mijlpalen/deadlines naar agenda-apps; goedkoop, hoge waarde (issue #17).
- [x] **MS Project MPP import (alleen-lezen)** — sinds fase 3.8 etappe 1 native in TS (MPP14 =
  Project 2010 t/m 2021; `src/services/mpp/`, afgeleid van de MPXJ-bronnen, LGPL). **Besluit
  herzien 2026-08-14:** de triage van 2026-07-07 ("realistisch alleen via MPXJ/JVM") rustte op de
  premisse dat een native lezer onhaalbaar was; corpusonderzoek (2026-08-14, 52 bestanden uit
  Project 2010–2021) toonde één stabiel, onversleuteld MPP14-containerformaat — native in de kern
  is dus de lichtste route en de JVM-sidecar vervalt voor dit doel. Wachtwoord-versleutelde
  bestanden en MPP8/9/12 geven een nette "exporteer als XML"-fout. Er bestaat geen .mpp-EXPORT
  (ook MPXJ schrijft het niet): de export-tegenhanger blijft MSPDI-XML.
- [x] **MPP-resourcetype "afwijking" bij Bijlage 13 — vindbaarheids-item, GEEN bug (T11-eindreview).**
  6 van de 8 niet-plaatshouderresources in 'Bijlage 13 Productieplanning.mpp' lezen als MATERIAL
  waar de MSPDI-ground-truth ze als Work (LABOR) toont; gepind als budget
  (`RESOURCE_TYPE_MISMATCH_BUDGET` in `tests/planning/check-mpp-relations.ts`, rond r. 799). Matcht
  MPXJ's eigen bit-voor-bit-uitkomst exact (dus geen leesfout van de poort) en volgt hetzelfde
  documentversieverschil-patroon als de taak-/kalendervergelijkingen elders in de mpp-checks (zie
  de moduleheader van `check-mpp-import.ts`: de drie `.mpp.xml`-ground-truths zijn een ANDERE
  documentrevisie dan de bijbehorende `.mpp`'s). Een onafhankelijke probe bevestigde bovendien dat
  de `.mpp`-lezing hier de semantisch plausibele indeling geeft en de XML-revisie de uitzondering
  is. Geen actie nodig aan de lezer — genoteerd zodat een toekomstige lezer dit niet als regressie
  herontdekt.
- [ ] **MPP-vervolgetappes (user-wens 2026-08-15: de bewuste beperkingen van etappe 1 zijn geen
  eindstation — "als we hier een keer genoeg tokens tegenaan gooien dan lukt het wel").** In
  oplopende moeilijkheidsgraad:
  - [ ] **Baselines + custom fields/outline codes uit `.mpp` lezen** — de var-data-typen bestaan in
    `FieldMap14.java`; onze data-gedreven veldmap-parser (`fieldMap14.ts`) hoeft alleen extra
    veld-ids te leren. Meest haalbare uitbreiding; ground truth voor baselines ligt klaar in
    `mpxj/junit/data/generated/task-baselines/`.
  - [x] **Recurrente kalenderuitzonderingen materialiseren** *(afgerond fase 3.8, MSP-pariteit T3/T4,
    2026-08-17)* (jaarlijks Kerst e.d. mét herhaalregel) — alle vier recurrentietypes (WEEKLY/
    MONTHLY/YEARLY/DAILY × absoluut/relatief) worden nu geëxpandeerd naar concrete datums binnen de
    projecthorizon, in zowel `.mpp` (`mppCalendars.ts`) als MSPDI (`mspdiReader.ts`) — inclusief
    werkende uitzonderingen en de precedentieregels tussen overlappende recurrente reeksen. Werkweken
    (`processWorkWeeks`, alternatieve weekpatronen per datumbereik) blijven een apart, bewust
    ongebouwd gat (O5-orkestratorbesluit: de probe verklaarde geen afwijkingen) — gedocumenteerd als
    bekende beperking in `gids-msproject-import.md` (nl+en), geen los TODO-item.
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
- [ ] Clipboard-ondersteuning (kopieer taken naar Excel)
- [ ] MSPDI native `<Notes>`-mapping voor taak-aantekeningen (fase 2.10, item 1) — momenteel
  bewust weggelaten-met-warn (lossy voor onze checklist-vorm met done-vlaggen + parse-
  complexiteit); IFC blijft de verliesloze route (`OPS_TaskNotes`-pset).

#### 3.9 Rapportage
- [ ] Afdrukken naar printer (multi-page)
- [ ] Rapport-wizard (kies inhoud, layout, filters)
- [ ] Standaard rapporten: taaklijst, kritiek pad, resources, voortgang
- [ ] Custom rapporten (kies velden, groepering, filters)
- [ ] Grafische rapporten (histogrammen, pie charts)
- [ ] Look-ahead rapport (komende 3/6/8 weken)
- [ ] Voortgangsrapport (per periode)
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
- [ ] MCP-server voor Claude en andere AI-assistenten
- [ ] Alle planning-operaties als MCP tools (zie PLAN.md §5.2 tool-lijst)
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
- [ ] Planning-validatie regels (check op ontbrekende dependencies)

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
- [ ] Multi-project resource pool
- [ ] Portfolio-management (overzicht alle projecten)
- [ ] Cross-project dependencies
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
