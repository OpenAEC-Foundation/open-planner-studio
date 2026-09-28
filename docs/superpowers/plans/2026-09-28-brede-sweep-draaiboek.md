# Brede sweep — draaiboek (bugs, logica, rekenprofielen, bibliotheken, import/export, code-opbouw)

**Status:** klaargezet op 2026-09-28, nog niet gestart. Start op het teken van de eigenaar.
**Orkestratie:** één Claude-sessie orkestreert met subagents (Agent-tool met `isolation: "worktree"` en de
Workflow-tool). Geen losse cloud-sessies per spoor.
**Basis:** `main` ná de merge van PR #241 (audit bottlenecks/bugs). Elke spoorbranch start vanaf die `main`.

Dit document is het contract voor elke agent in deze sweep. Een agent die alleen dit document en de
opdracht voor zijn spoor krijgt, moet zijn werk kunnen doen zonder terug te vragen.

---

## 1. Eigenaarsbesluiten voor deze sweep (2026-09-28)

| # | Besluit |
|---|---|
| E1 | **Branch per spoor**, één PR per spoor. Naam: `claude/sweep-<spoorletter>-<onderwerp>`. |
| E2 | **De orkestrator merget zelf** naar `main`, maar pas na de poorten van §4 **én** de merge-wachtkamer van §4.1. Een PR die klaar is, wacht op de synchronisatie. Tussendoor kan een andere agent iets vinden waardoor hij niet mag landen. Nooit een tag of release (dat blijft de `release`-skill, op expliciet verzoek). `main` deployt via `live.yml` naar productie, achter een `npm run verify`-poort. |
| E3 | **De eigenaar reviewt niet.** Elk stuk werk wordt daarom gereviewd door een agent die het niet schreef: elke bevinding, elke fix en elk bevindingenrapport. De orkestrator raadpleegt daarnaast regelmatig de advisor (§4.2). |
| E4 | **Motorwerk op 7 van 9 orakels.** De twee orakels in `P6-Viewer/XER Files/` (`Hotel Project.xer`, `TERMINAL BUILDING-AIRPORT.xer`) ontbreken in `ops-xer-corpus`. Een wijziging die het rekengedrag verandert, landt dus **niet**; ze wordt een voorstel met meting in het bevindingenrapport. Exacte (differentieel gepinde) motorwijzigingen mogen wel. |
| E5 | **Vraagpoort:** vóór een vraag de eigenaar bereikt, doet de agent eerst onderzoek (code, corpus, internet: documentatie van Oracle P6 en Microsoft Project, MPXJ, vakliteratuur). Een vraag met één logisch of duidelijk eleganter antwoord wordt niet gesteld maar beslist, met bron en reden in de PR. Alleen een echte smaak-/strategiekeuze gaat naar de eigenaar, altijd met bronnen, opties en advies. |
| E6 | **Profielgebonden gedrag buiten de solver** krijgt een plek als tweede laag in het rekenprofiel (reist mee in het bestand en wisselt mee met het profiel), niet als losse app-instelling. Zie spoor P. |
| E7 | **"Imports/exports" betekent beide:** bestandsformaten (sporen E/F) én module-imports/-exports in de code (spoor K). |
| E8 | **Niet aan `public/docs/` komen.** De eigenaar herbouwt de documentatie. De gidsen zijn geen specificatie van hoe iets hoort te werken. Elke PR krijgt in plaats van gidswijzigingen een sectie *Gevolgen voor de gidsen* (per wijziging: welke gids iets moet zeggen en wat). `npm run verify:docs` moet wel groen blijven. |
| E9 | Spoor R (gidsen tegen gedrag) vervalt; spoor M is alleen i18n en toegankelijkheid. |

---

## 2. Werkcontract voor elke agent

### 2.1 Vooraf lezen (niet alles, wel dit)

- `CLAUDE.md` (invarianten, commando's, valkuilen bij testen).
- De `.claude/rules/`-bestanden die bij je paden horen (ze laden vanzelf bij het lezen van een bestand
  in hun `paths`; lees ze bewust als je spoor zo'n gebied raakt).
- Het PR-bericht van #241: wat daar al opgelost of bewust gelaten is, doe je niet opnieuw.
- `docs/onderhoudbaarheid/README.md` §2 (K1–K11) en `docs/TODO.md`: controleer per item tegen de code
  of het nog speelt, voordat je het als bevinding meldt.

### 2.2 Bewijsregels (geen aannames)

- Elke bevinding is **zeker** (gereproduceerd met een test of script, met uitvoer), **afgeleid**
  (redenering uit code, met `pad:regel`) of **onbekend**. Het label staat erbij.
- Uitspraken over wat P6 of MS Project doet, hebben een bron: een door P6 doorgerekend orakel uit het
  corpus, een `.mpp`-orakel, of documentatie van Oracle/Microsoft (URL + citaat). Anders: *onbekend*.
- Een correctheidsfix heeft een test die **op de oude code faalt**. Controleer dat door alleen het
  bronbestand terug te zetten en de test te draaien.
- Een prestatiefix is **differentieel gepind** (zelfde uitkomst als de oude route) en gemeten (vóór → na).
- Een "flake" is geen oorzaak. Een rode test is rood tot de oorzaak bekend is.

### 2.3 Corpusregels (rekenmotor)

- Corpus: `/home/user/ops-xer-corpus` (privérepo `OpenAEC-Foundation/ops-xer-corpus`, shallow clone).
  `OPS_XER_CORPUS` en `OPS_MPP_CRAWL` wijzen daarheen (bij de start controleren, zie §5).
- **Alleen `role: "oracle"` met `included: true`** in `tests/planning/xer-corpus-manifest.json` telt als
  P6-bewijs, met de uitsluitingen per project/taak (`excludeProjects`/`excludeTasks`).
- **`rehab-2.xer` is P3-uitvoer** en telt nooit als P6-bewijs; hetzelfde geldt voor generator-, pseudo-
  en synthetische bestanden (`reader-only`, `pseudo-xer`, `synthetic-fixture`, `engine-input`). De vijf
  conventies die alleen uit rehab-2 komen (A17, B3, B4, C1, C4) blijven uit in de ingebouwde profielen.
- `crawl-xer-extra/ashspace-primeveraxereditor/sample.xer` is een **twijfelachtig orakel** (bron is een
  XER-editor). Een uitkomst die alleen op dat bestand rust, markeer je als zodanig.
- **Het manifest is verboden terrein.** Geen nieuwe uitsluitingen, geen rolwissels, geen pins verruimen
  om een meting groen te krijgen. Een voorstel daartoe gaat als eigenaarsbesluit naar de lijst (§6).
- Regel A: geen exacte cel mag inexact worden (`npm run measure:profiles`). Door E4 geldt: een
  wijziging die het rekengedrag verandert, landt niet in deze sweep.
- Nooit een `if` op het bronformaat in `src/engine/` (`npm run verify:conventions`); gedrag dat per
  profiel verschilt, is een conventie in `src/engine/scheduler/conventions/registry.ts`.

### 2.4 Grenzen

- Geen tags, releases, `npm run bump`, wijzigingen aan `docs/CHANGELOG.md` of de wiki.
- Geen nieuw Rust-command (`src-tauri/`: drie commands, elk nieuw is publiek oppervlak).
- `immer` blijft exact `11.1.4`. Geen dependency-bumps behalve als fix voor een aangetoond probleem,
  in een eigen commit.
- Geen test overslaan, uitschakelen of in quarantaine zetten. Geen pin of baseline verruimen zonder
  dat de reden in de PR staat en de verificatie-agent hem heeft bevestigd.
- Tekst via `t(...)`, nieuwe sleutels via `npm run i18n:add` (alle 14 locales), daarna `npm run i18n:fmt`.
- Nieuwe projectdata: `DOCUMENT_FIELDS` + IFC-round-trip (`docs/ifc-round-trip.md`).
- Geen `public/docs/`-wijzigingen (E8).

### 2.5 Werkwijze per spoor

1. **Audit (alleen lezen).** Zoek met invarianten, gegenereerde invoer en het corpus, niet alleen door
   te lezen. Schrijf elke kandidaat-bevinding op met ernst (kritiek/hoog/middel/laag), label (§2.2),
   `pad:regel` en een reproductie.
2. **Verificatie.** Een tweede agent, die de audit niet schreef, probeert elke bevinding te weerleggen
   (zie de skill `hyperkritische-review`). Wat niet reproduceert of al opgelost is, valt af.
3. **Fix.** Test eerst rood, dan de fix, dan groen. Kleinste fix die het probleem oplost; geen
   verbreding buiten het spoor.
4. **Review en poorten** (§4): een agent die de fix niet schreef reviewt de diff. Dan PR, dan de
   merge-wachtkamer (§4.1). De orkestrator merget pas na de kruiscontrole.
5. **Bevindingenrapport** in de PR: `docs/superpowers/plans/2026-09-XX-sweep-<spoor>-bevindingen.md`
   met alle bevindingen (ook de niet-gefixte, met reden), de meetuitslagen, de beslissingen onder E5
   met bron, en *Gevolgen voor de gidsen* (E8).

---

## 3. De sporen

Per spoor: wat het bezit (conflictzone), wat er gezocht wordt, en wat het oplevert. Een spoor wijzigt
alleen bestanden in zijn eigen zone; een fix die daarbuiten moet, gaat via de orkestrator naar het
spoor dat die zone bezit.

### A — Rekenmotor CPM

- **Zone:** `src/engine/scheduler/CPMSolver.ts`, `relationMath.ts`, `applyCpmResult.ts`, `scheduleAnalysis.ts`
  (niet `conventions/`, dat is O).
- **Zoeken:**
  - Een onafhankelijke referentie-CPM in `tests/planning/` (uit leerboekdefinities, niet uit de solver)
    en die tegen de solver op tienduizenden gegenereerde netwerken, in alle drie de profielen.
  - Invarianten: opnieuw rekenen verandert niets; ES ≤ LS; relaties en lags worden gerespecteerd;
    totale en vrije speling kloppen met de definities; cycli worden gemeld, niet stil gebroken;
    constraints (SNET, FNLT, MSO, ALAP …) doen wat ze in elk profiel horen te doen.
  - Uur- en dagtaken door elkaar, samenvattingsrelaties, LOE, mijlpalen, voortgang en statusdatum.
- **Let op:** E4. Afwijkingen die het rekengedrag zouden veranderen: meten, rapporteren, niet landen.

### B — Kalender, datum en tijd

- **Zone:** `CalendarEngine.ts`, `src/utils/date*`, `src/services/subdayIo.ts`, `calendarRecurrence.ts`,
  `src/engine/renderer/workdayAxis.ts`, `timeAxis.ts` (alleen rekenkunde).
- **Zoeken:** zomertijdovergangen (ook zuidelijk halfrond, halfuurzones, `Pacific/Chatham`), schrikkel-
  dagen, jaargrenzen, uitzonderingen en pauzes, 24-uurskalenders, kalenders zonder werkdagen,
  terugrekenen over feestdagen. Alles in de tijdzonematrix van `tests/planning/run.sh`.

### C — Resources, nivellering, contouren, werkregels

- **Zone:** `src/engine/work/`, `ResourceLeveler.ts`, `src/engine/contour/`, `src/services/leveling/`,
  `assignmentMutations.ts`.
- **Zoeken:** werk = duur × inzet na elke mutatie; geen route om de werkregelbrug heen
  (`captureTriangle` → mutatie → `settle…`); de nivelleerder schendt geen relaties of capaciteit en is
  deterministisch; splitsingen; kosten en uren; opgeslagen werk per toewijzing.

### D — IFC round-trip (native formaat)

- **Zone:** `src/services/ifc/`, `src/state/ifcSaveInput.ts`.
- **Zoeken:** gegenereerde documenten over alle `DOCUMENT_FIELDS` → schrijven → lezen → diep gelijk;
  STEP-randgevallen (na de codering uit #241); oude bestanden (`IFCAPPLICATION.Version` `'0.1'` en ouder,
  `public/examples/`); afgekapte of corrupte bestanden (nooit stil half inlezen); grote bestanden;
  GlobalId-stabiliteit; recovery-snapshot = opgeslagen bestand.

### E — Import-adapters

- **Zone:** `src/services/{mpp,xer,p6,msproject,csv,xlsx,progressImport}/`, `importNormalize.ts`,
  `importDates.ts`, `importDurations.ts`, `xmlInterchange.ts`.
- **Zoeken:**
  - Fuzzing op kapotte en vreemde invoer: nooit een onafgevangen crash, nooit stil data weggooien.
  - Een fidelity-matrix per veld en per formaat: wat komt binnen, wat valt weg, wordt dat gemeld?
  - Het volledige `.mpp`-crawlcorpus (658 bestanden) en alle XER-bestanden als lezertest.
  - Encodings, meerdere projecten per bestand, ontbrekende tabellen.

### F — Export en kruisformaat-round-trips

- **Zone:** de writers (`ifcWriter` uitgezonderd, dat is D), `formatRegistry.ts`, `xerExportLoss.ts`,
  exportpaden in `fileSlice.ts`.
- **Zoeken:** IFC → MSPDI → IFC, IFC → XER → IFC, IFC → CSV → IFC, P6-XML; is het verliesrapport volledig
  (alles wat wegvalt wordt gemeld)?; exporteert de app ooit een verouderde planning (K7)?; geldigheid
  van de uitvoer voor MS Project en P6 (schema's, verplichte velden) met bron.

### G — Store, undo, documentcontract, herstel en autosave

- **Zone:** `src/state/` (behalve `librarySlice.ts`, dat is Q, en de profielbestanden, dat is O).
- **Zoeken:** modelgebaseerd testen met willekeurige actiereeksen: alles ongedaan maken = begintoestand,
  opnieuw = identiek; documentwissel; crashherstel = laatste stand; twee instanties tegelijk; het
  undo-geheugenplafond uit #241; `markScheduleStale`-discipline; MCP-transacties atomair.

### H — Gantt-canvas, interactie, taakraster

- **Zone:** `src/engine/renderer/` (niet de rekenkunde van B), `src/components/canvas/`,
  `src/components/task-grid/`, `src/engine/taskGrid/`, `gridTransaction.ts`.
- **Zoeken:** geometrie consistent (`getRowAtY`/`getTaskAtY` tegen `dateToX`, ook op de werkdagen-as);
  slepen, zoomen en scrollen aan de randen; `taskEditPlan` en `gridTransaction` onder bulkbewerkingen;
  browsertests met echte events op 10k taken (`tests/browser/`).

### I — Print, PDF en rapporten

- **Zone:** `src/services/{print,pdf}/`, `src/engine/reports/`, `ReportPanel.tsx`.
- **Zoeken:** paginering; RTL (bekende divergentie DOM ↔ PDF in `docs/TODO.md`); fontsubsetting en
  geldigheid van de PDF (met een externe validator als die beschikbaar is); scherm = afdruk; de
  berekeningen achter elk rapport (kritiek pad, look-ahead, resourcebelasting, planningsgezondheid)
  tegen hun definitie.

### J — MCP-server, tools en extensies

- **Zone:** `src/services/mcp/`, `src/extensions/`, `src/state/runtime/createMcpTransactions.ts`,
  `mcpValidation.ts`.
- **Zoeken:** schema tegen gedrag voor alle 42 `planner_*`-tools; validatie van randwaarden; atomiciteit
  van `batch`; consistente foutcodes; extensie-sandbox, manifestvalidatie (K6), levenscyclus;
  Tauri-guard.

### K — Code-opbouw: module-imports en -exports (golf 3, als laatste)

- **Zone:** overal, maar alleen mechanisch (imports, exports, opsplitsen), geen gedrag.
- **Zoeken:** dode exports en bestanden (knip of gelijkwaardig); cycli (`npm run verify:cycles`);
  barrel-bestanden; grootte van de main chunk en wat erin zit (bundle-analyse); zware delen lazy laden
  (pdf-lib, fontkit, harfbuzz, `.mpp`/XER-lezers); opstarttijd gemeten vóór en na.
- **Waarom als laatste:** het verschuift importregels in bijna elk bestand en botst anders met alle
  andere sporen.

### L — Prestaties op schaal (meetspoor)

- **Zone:** alleen `scripts/` en `tests/` voor metingen; fixes gaan naar het spoor dat de code bezit.
- **Zoeken:** met `src/services/benchmark/` alle hoofdflows op 10k en 50k taken profileren: openen per
  formaat, rekenen, scrollen, bulkbewerkingen, opslaan, printen, nivelleren. Aanvullend op #241.

### M — i18n en toegankelijkheid

- **Zone:** `src/i18n/`, ARIA en toetsenbordbediening in `src/components/` (alleen die attributen en
  handlers).
- **Zoeken:** placeholders die per locale verschillen; pluralvormen; RTL-lay-out; alles met alleen het
  toetsenbord bereikbaar; focusvolgorde in dialogen; contrast in beide thema's.

### N — Concrete bekende bugs uit `docs/TODO.md`

- **Zone:** per item, afgestemd met de orkestrator.
- **Items (eerst controleren of ze nog spelen):** plakken tussen documenten verliest toewijzingen stil;
  twee gelijknamige bedrijven niet te onderscheiden; dode `companyId` toont "geen bedrijf"; een taak
  zonder vastlegging telt na opslaan-in-modus als vastgelegd (PR #167-vervolg).

### O — Rekenprofielen, kritisch

- **Zone:** `src/engine/scheduler/conventions/`, `solveInput.ts`, `src/services/schedulingProfiles/`,
  `src/services/ifc/schedulingProfileMigration.ts`, `src/state/schedulingProfile*.ts`,
  `SchedulingProfileSection.tsx`, `scripts/measure-profiles*.mjs`, `scripts/verify-conventions*`.
- **Zoeken:**
  - Per conventie (27) en per projectoptie (11): is de ingebouwde waarde voor P6, MSP en OPS aantoonbaar
    juist? Bron per waarde (orakel, documentatie). Een waarde zonder bron: melden.
  - Profiel wisselen (P6 → OPS → P6 geeft het origineel), eigen profielen (app-globaal) tegen de
    projectkopie, migratie van oude optieblokken, IFC-round-trip van `OPS_SchedulingProfile` en
    `OPS_SchedulingOptions`, MCP en extensie-API (`ExtProject.schedulingProfile`).
  - Worden alle conventies echt gelezen, en alleen via `EffectiveSchedulingOptions`?
    `verify:conventions` ziet sommige omwegen niet (zie `.claude/rules/rekenprofielen.md`): zoek ze.
  - `npm run measure:profiles` met het corpus (7 van 9 orakels, E4) en de 76 restafwijkingen uit
    `docs/TODO.md` opnieuw bekijken: welke zijn te verklaren, met welke bron?
  - `suggestedProfileId` per formaat (MSPDI/P6-XML/CSV ⇒ ops "deze etappe"): klopt dat nog?

### P — MS Project-bias buiten de solver (golf 3, na O)

- **Zone golf 1:** alleen lezen, overal. **Zone golf 3:** de tweede profiellaag (E6) plus de plekken die
  hem gaan lezen.
- **Golf 1, inventaris:** elk gedrag en elke standaardwaarde buiten de solver die een keuze tussen
  planningsscholen is. Startpunten (geen volledige lijst):
  - standaard taaktype en inzetgestuurd plannen (`src/engine/work/`, `utils/taskDefaults.ts`);
  - uren per dag, week en maand, duureenheden en weergave;
  - wat "kritiek" betekent (speling ≤ 0 of langste pad) en hoe speling wordt getoond;
  - het type voltooiingspercentage (P6: duur, fysiek, eenheden; MSP: duur, fysiek);
  - samenvattingstaken: optellen, voortgang, datums; WBS-nummering en -codes;
  - mijlpaalherkenning (duur 0 tegen een expliciete vlag), weergave van einddatums (einde dag tegen
    begin volgende dag);
  - voortgangsgedrag (`auto actual start`, statusdatum), planningsgezondheid (`scheduleHealth.ts`),
    MCP-standaarden en rapportdefinities.
  - Hulpmiddel: `grep -rniE "ms ?project|\bmsp\b|primavera|\bp6\b"` buiten de adapters en de solver
    (263 MSP- en 411 P6-treffers op 2026-09-28; alleen een wegwijzer, geen bewijs).
- **Per item één regel:** wat de app nu doet, waar het vandaan komt (commit/spec), wat MSP doet, wat P6
  doet (elk met bron), en het advies: globaal laten, motorconventie (O-route), of tweede profiellaag.
- **Golf 3, bouwen:** de tweede profiellaag volgens de bestaande conventiesystematiek (register met
  per profiel een waarde, IFC-round-trip, UI in het profielblok, `verify:conventions`-achtige poort).
  **Het OPS-profiel houdt exact het huidige gedrag.** Het MSP- en P6-profiel wijken alleen af waar de
  inventaris een bron heeft. Omdat een afwijking in het P6- of MSP-profiel gedrag verandert voor
  gebruikers van dat profiel: per item eerst onderzoek (E5); blijft er na onderzoek een echte keuze
  over, dan gaat die als één gebundelde lijst naar de eigenaar.

### Q — Resourcebibliotheken, kritisch

- **Zone:** `src/state/slices/librarySlice.ts`, `src/services/library/`, bibliotheek-UI in
  `src/components/` (Resources-tab, Backstage → Bibliotheek).
- **Zoeken:** poolgrootboek en bezetting (`dailyLoad`) tegen een eigen herberekening; bedrijfsbinding en
  dode bindingen; promotie (resources en kalenders); pool-IFC-export/-import round-trip; de verdeelkern
  (`computeDistribution`, `applyDistribution`/`undoDistribution`) met gegenereerde invoer; twee
  tabbladen of vensters tegelijk (stil overschrijven, bekend); herkomststempels. Leidraad:
  `docs/library.md` en `.claude/rules/library.md`, als *waarom*, niet als bewijs van gedrag.

---

## 4. Poorten vóór merge (door de orkestrator, per spoor-PR)

1. `npm run verify` lokaal groen (exitcode 0) op de head van de spoorbranch, ná een merge met de
   actuele `main`.
2. CI groen op de laatste commit van de PR.
3. Bij elke wijziging onder `src/engine/`: `npm run measure:profiles` met het corpus, geen exacte cel
   inexact, en de uitslag in de PR (met de vermelding "7 van 9 orakels", E4).
4. Een verificatie-agent, die de fix niet schreef, heeft de diff adversarieel gelezen en akkoord
   gegeven; zijn bevindingen zijn opgelost of met reden weerlegd.
5. Geen open eigenaarsbesluit dat deze PR raakt.
6. De PR-tekst volgt `.github/pull_request_template.md` en bevat de sectie *Gevolgen voor de gidsen*.

Een PR die deze zes poorten haalt, is **klaar**, niet gemerged. Hij gaat de wachtkamer in (§4.1).

### 4.1 Merge-wachtkamer

1. **Niet direct mergen.** Een klare PR wacht tot het eerstvolgende synchronisatiemoment. Dat valt na
   het afronden van de verificatie van een golf, of na een batch fixes; in elk geval niet midden in
   lopend werk dat dezelfde zone raakt.
2. **Kruiscontrole op dat moment.** De orkestrator legt de diff van elke klare PR naast alle
   bevindingen die sinds de PR klaar werd zijn binnengekomen, ook die van andere sporen, en naast de
   andere klare PR's. Vragen: raakt een nieuwe bevinding code die deze PR wijzigt? Maakt een andere
   PR deze overbodig of tegenstrijdig? Verandert de volgorde van landen de uitkomst?
3. **Een verificatie-agent kijkt mee** met die kruiscontrole, met de lijst klare PR's en de nieuwe
   bevindingen als invoer. Hij gaat na of er een reden is om iets tegen te houden.
4. **Advisor** (§4.2) vóór elke merge-batch.
5. Alleen wat de kruiscontrole doorstaat, landt. Twijfel betekent wachten, niet mergen. Een PR die
   wordt tegengehouden, krijgt de reden in een PR-reactie.
6. Volgorde: kleine, geïsoleerde sporen eerst. Daarna de volgende PR's opnieuw op `main` zetten
   (merge, geen rebase van gedeelde geschiedenis), de poorten van §4 opnieuw draaien en weer de
   wachtkamer in.

### 4.2 Advisor

De orkestrator raadpleegt de advisor, als die in de sessie aanstaat, op vaste momenten:
- vóór de start van elke golf (klopt de opzet?);
- na de verificatie van golf 1 (kloppen de bevindingen en de prioriteiten, en is de besluitenlijst
  voor de eigenaar echt nodig?);
- vóór elke merge-batch (§4.1);
- als een spoor vastloopt of een fix groter wordt dan gepland.

Het advies en wat ermee gedaan is, komt kort in het bevindingenrapport van het spoor. Staat de advisor
niet aan, dan meldt de orkestrator dat aan de eigenaar in plaats van stil door te gaan.

---

## 5. Startchecklist (orkestrator, vóór golf 1)

1. PR #241 is gemerged; `git fetch origin main`.
2. `npm ci`; Playwright: de voorgeïnstalleerde Chromium gebruiken (`/opt/pw-browsers`), nooit
   `playwright install`. Als de vastgezette revisie niet klopt: symlink-map zoals in #241.
3. Corpus aanwezig (`git -C /home/user/ops-xer-corpus rev-parse HEAD`), anders opnieuw clonen (zie de
   `add_repo`-instructie; één clone, ruime time-out).
4. `OPS_XER_CORPUS` en `OPS_MPP_CRAWL` zetten. **Eerst controleren** hoe de scripts de paden verwachten
   (manifestsleutels zijn relatief, bv. `crawl-xer/...`) en hoe `measure:profiles` reageert op de twee
   ontbrekende orakels: stopt het, of meet het stil minder? Dat gedrag staat in de PR van elk
   motorspoor.
5. Nulmeting: `npm run verify` en `npm run measure:profiles` op `main`, uitslag bewaren als referentie.
6. Workflowgrootte: de richtlijn staat op "medium" (< 10 agents per workflow). Meer tegelijk kan pas
   als de eigenaar dat ophoogt met `/config workflowSizeGuideline=large` (of `unrestricted`); anders draaien de golven in
   delen na elkaar.

---

## 6. Golven

| golf | sporen | aard |
|---|---|---|
| 1 | A, B, C, D, E, F, G, H, I, J, M, N, O, Q en P-inventaris; L meet vanaf het begin mee | audit + verificatie (alleen lezen) |
| 2 | A, B, C, D, E, F, G, H, I, J, M, N, O, Q | fixes per spoor, elk in een eigen worktree en branch, mergen volgens §4 |
| 3 | P (tweede profiellaag), daarna K (code-opbouw) | bouwen, daarna mechanisch opruimen |

Na golf 1 bundelt de orkestrator wat na onderzoek (E5) nog echt een eigenaarsbesluit is in één lijst,
met per punt bronnen, opties en advies. Alles wat niet op die lijst wacht, gaat door.

---

## 7. Eigenaarsbesluiten tijdens de sweep

*(leeg bij de start; de orkestrator vult dit aan, met datum en bron per punt)*
