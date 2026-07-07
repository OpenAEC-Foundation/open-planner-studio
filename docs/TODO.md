# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Afgeronde items worden uit
deze lijst verwijderd — wat klaar is, staat in de changelog en git-historie.

## Openstaand

### UX & Desktop-shell

- [ ] **Taakdialoog (dubbelklik) gelijktrekken met het eigenschappenpaneel.** Dubbelklik op een
  taak opent `TaskDialog` (`src/components/dialogs/TaskDialog.tsx`), maar die biedt alleen de
  fase-1-velden (naam, WBS, omschrijving, type, mijlpaal-vinkje, start, duur, oudertaak). Alles
  wat het `TaskPropertiesPanel` sindsdien kreeg ontbreekt: mijlpaal-soort (start/eind) en
  verplicht-vlag (2.4), datumconstraints + deadline (2.3), voortgang, prioriteit en de
  toewijzingen-sectie (2.5). De dialoog moet dezelfde opties bieden als het paneel — bij
  voorkeur door de secties als gedeelde componenten te delen i.p.v. te dupliceren (zelfde
  patroon als `SettingsPanelContent`/`CalendarForm`), zodat dit niet opnieuw kan divergeren.
- [ ] **Relatietype kiezen bij het slepen van een afhankelijkheid.** Nu maakt de
      sleep-actie op het Gantt-canvas altijd een `FINISH_START`-relatie aan
      (hardcoded in `GanttCanvas.tsx`, bij het loslaten van de dependency-drag).
      Het type en de lag zijn inmiddels wél achteraf te wijzigen (eigenschappen-
      paneel en relatietabel, via `updateSequence`), maar tijdens het slepen kun
      je ze nog niet kiezen. *Aanpak:* toon bij het loslaten een klein
      contextmenu/popover om het relatietype (FS/SS/FF/SF) en eventueel de lag
      te kiezen in plaats van meteen FS aan te maken.

- [ ] **Toewijzing verplaatsen tussen taken.** Nu kun je een toewijzing alleen verwijderen en
      opnieuw aanmaken. Uit de review: maak het mogelijk een bestaande toewijzing (met eenheden +
      curve) naar een andere taak te verplaatsen (drag of "verplaats naar…"), zodat herplannen niet
      betekent dat je eenheden/curve opnieuw moet intikken.
- [ ] **Native `confirm()`-dialogen vervangen door één in-app bevestigingsdialoog.** Uit de
      fase-2.7-eind-QA: layout-verwijderen/toepassen en baseline-verwijderen gebruiken
      `window.confirm()` — functioneel prima maar systeemgestyled (geen donker thema, geen
      RTL, geen i18n-knoppen). Maak één herbruikbaar `ConfirmDialog`-component (patroon
      RecoveryDialog) en vervang alle `window.confirm`-aanroepen (grep) in één keer.
- [ ] **Resource-paneel als niet-fullscreen variant naast het histogram.** Het `ResourcePanel` neemt
      nu het volledige rechterpaneel over. Uit de review: bied een compacte/gedockte variant zodat
      je resources kunt bewerken terwijl de Gantt + histogramstrook zichtbaar blijven (het effect
      van een wijziging op de belasting is dan meteen te zien).

### Distributie & Release

#### Snap-packaging — follow-ups
Snap-packaging is werkend en zit op `main` (zie changelog +
[ontwerp](superpowers/specs/2026-06-26-snap-packaging-design.md)): `snap/snapcraft.yaml`
(core22, strict, gnome-extensie) herverpakt de release-deb, en `snap.yml` bouwt op
tag-push de `.snap` als release-asset. Geverifieerd via een `workflow_dispatch`-run tegen
`v2026.6.0` (groene build, geldig `.snap`, WebKitGTK uit de gnome-runtime). Wat rest:

- [ ] **In-app updater overslaan binnen de snap.** In een read-only strict snap kan de
      Tauri-updater de binary niet vervangen — de Snap Store doet de refresh. Zonder dit
      krijgen snap-gebruikers een "update beschikbaar"-melding die niets kan uitvoeren.
      *Aanpak:* detecteer de snap-runtime via de door snapd gezette env `SNAP`
      (Rust-zijde, dun gehouden conform "keep Rust thin"), geef dat door aan de frontend
      en sla de updater-check over wanneer actief (updater-logica zit in `App.tsx`).
- [ ] **Live gaan in de Snap Store — eigenaar-stappen.** Daarna publiceert de al
      bestaande gated stap in `snap.yml` (`snapcore/action-publish`, kanaal `stable`)
      automatisch bij elke release-tag:
      1. `snapcraft register open-planner-studio` (eenmalig; vereist een Snap Store-account
         en claimt de naam).
      2. Genereer credentials met `snapcraft export-login --snaps open-planner-studio
         --channels stable -` en voeg de output toe als GitHub-repo-secret
         `SNAPCRAFT_STORE_CREDENTIALS`.

### Distributie & Release — release notes in de in-app updater

- [ ] **Release-notes-vulling van `latest.json` automatiseren.** De update-dialoog
  (`UpdateDialog.tsx`) toont `update.body` al, maar het `notes`-veld in `latest.json` blijft
  leeg omdat de release notes pas ná de CI-build handmatig op de GitHub-release worden gezet.
  Sinds v2026.7.5 is de workaround een vaste release-procedure-stap: na `gh release edit
  --notes-file` ook `latest.json` downloaden, `notes` vullen (platte-tekst-versie van de
  notes) en met `--clobber` terug-uploaden. Automatiseren kan door in `release.yml` een
  gated slotstap toe te voegen die na het publiceren de release-body in `latest.json` patcht
  (of door de notes vóór het taggen in een bestand in de repo te leggen dat de workflow
  leest). Tot die tijd: procedure-stap niet vergeten.

### Kwaliteit & verificatie

- [ ] **ResourceLeveler-schaalbaarheid (gemeten 2026-07-06, benchmark tegen de echte engine).**
  De leveler groeit ~kwadratisch met het taakaantal (dag-modus: 100 taken=0,15s, 500=6,2s,
  2000≈100s geëxtrapoleerd; uur-modus is consequent ~4× sneller: 500=1,5s, 2000=25,3s gemeten).
  Oorzaak: `computePF` draait `solve()` per pick in een lus. Geen 2.8b-regressie (dag-gedrag was
  altijd zo) en de CPM-solve zelf is prima (2000 taken = 37-81 ms, ruim onder de 2s-lat), maar
  voor projecten >500 taken met nivellering is dit merkbaar. Kandidaat-verbeteringen:
  incrementele her-solve of PF-caching per iteratie. De banden-memoization uit 2.8b §5.6 is
  gemeten en werkt (0 nieuwe cache-fills bij een tweede solve op dezelfde kalenders).
  Benchmark-scripts: `/tmp/ops-perf/` (bench.ts + run.sh, herbruikbaar).

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

> §2.8b: hoofdschakelaar Urenplanning (instelling, default uit) + gemengde dag/uur-planning
> toestaan; werktijd-banden per weekdag (meerdere banden, nachtploeg over middernacht) met
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
> **Status: bouw af (golven 0-6), visuele QA en fix-golf lopen nog; niets naar main tot af en
> getest.**

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
> **Status: bouw af (golven 0-8), QA loopt; niets naar main tot af en getest.**

#### 2.10 Gebruikersdocumentatie & showcase-voorbeelden (afsluiter van fase 2)
- [ ] **Keyboard-shortcuts + rechtermuisklik-menu uitbreiden — VÓÓR de documentatie (user-verzoek
  2026-07-04).** Voordat de gebruikersdocumentatie geschreven wordt (die legt sneltoetsen en
  menu's immers vast) moet de bediening op peil: (a) **sneltoetsen voor zoveel mogelijk
  acties** — inventariseer wat `useKeyboardShortcuts.ts` al heeft (F5/Ctrl+S/Ctrl+Z/F11/
  indent-outdent/zoom…) en vul aan naar het niveau van MSP/P6: o.a. taak invoegen/verwijderen,
  relatie leggen op selectie, mijlpaal maken, omhoog/omlaag verplaatsen, inklappen/uitklappen
  (alles/niveau), naar vandaag/statusdatum springen, dialoog-openers (kalenders, baselines,
  filter, kolommen), rapportweergave, tabwissel tussen documenten. Conflictvrij per platform
  (let op browser-gereserveerde combinaties in de web-build) en tonen in tooltips; overweeg
  een "sneltoetsen"-overzichtsdialoog (Ctrl+/?) als onderdeel van dit werk. (b) **Het
  rechtermuisklik-contextmenu verrijken** — het bestaande `ContextMenu` op taakrij/canvas is
  minimaal; voeg contextuele acties toe per plek: taakrij (bewerken, invoegen boven/onder,
  verwijderen, indent/outdent, mijlpaal-toggle, kalender toewijzen, voortgang zetten,
  resource toewijzen, naar relaties), Gantt-balk (relatie leggen vanaf hier, pin/prioriteit,
  constraint zetten), lege canvas (taak toevoegen, plakken, zoom-presets), bandkop
  (in-/uitklappen, alles), histogram (drill-down). Elke context-actie hergebruikt bestaande
  store-acties — geen nieuwe logica, alleen ontsluiting. i18n 14 talen.
- [ ] **First-startup-ervaring: welkomstmenu + rondleiding (user-verzoek 2026-07-04).** Bij de
  allereerste start van het programma verschijnt een welkomstscherm met (a) een aantal basale
  instellingen om direct te kiezen (denk: taal, thema licht/donker, en relevante voorkeuren
  zoals de auto-bereken-toggle zodra die bestaat) en (b) een "show around": een korte
  rondleiding door het programma (lint-tabs, taaktabel + Gantt, eigenschappenpaneel,
  histogram/rapporten, voorbeelden openen) — overslaanbaar, en achteraf opnieuw te starten
  vanuit Help/backstage. **Harde eis: het menu mag NIET terugkomen na een update** — de
  gezien-vlag dus persistent opslaan onafhankelijk van de appversie (settingsStore/localStorage
  zonder versie-sleutel; in Tauri overleven zowel localStorage als de settings een in-app
  update, verifiëren bij implementatie). De gekozen instellingen landen gewoon in de bestaande
  settings (3-surfaces-regel blijft gelden — het welkomstscherm is een vierde *invoerpunt*,
  geen aparte opslag).
- [ ] **Drie voorbeeld-planningen die écht alle functies van de app benutten.** De huidige
  voorbeelden demonstreren vooral taken+relaties; maak drie rijk uitgewerkte, realistische
  projecten (bv. woningbouw, infra, renovatie) die samen alle features raken: WBS-hiërarchie
  met inspringen, alle vier relatietypes + lags/leads (incl. %-lag), datumconstraints +
  deadlines (incl. een bewust conflict met negatieve float), start-/eindmijlpalen +
  verplichte/inspectiemijlpalen, activity codes + custom fields + groepering, alle vijf
  resourcetypes met ploeg-hiërarchie, resource-kalenders, capaciteitsstappen, toewijzingen
  met verschillende curves, zichtbare overallocatie die met nivellering/smoothing oplosbaar
  is, taak-prioriteiten (incl. een vastgepinde), en meerdere kalender-eigenaardigheden
  (feestdagen/bouwvak). In het Voorbeelden-manifest opnemen met passende tags, zodat ze ook
  als interactieve documentatie dienen naast de handleiding hieronder.
- [ ] **Volledige gebruikersdocumentatie schrijven** — aan het einde van fase 2, als alle
  planningsfeatures er zijn. Gebruikers moeten nu nog gokken hoe alles werkt; er is geen
  handleiding. Dekking: projecten aanmaken (wizard, kalender-presets), taken/WBS/inspringen,
  relaties + lags, constraints + deadlines, mijlpalen (soorten, verplicht), resources
  (types, kalenders, capaciteitsstappen, toewijzen, curves), histogram lezen, nivelleren vs.
  smoothing (en wanneer welke), rapporten/printen, import/export (IFC/P6/MSP/CSV, incl. wat
  wél/niet meereist per formaat), multi-document, sneltoetsen, instellingen en de updater.
  Vorm: gebruikersgericht (taakgericht "hoe doe ik X", niet feature-opsomming), NL als brontaal,
  vindbaar vanuit de app (Backstage → Help of vergelijkbaar), met screenshots. Bestaande
  vindplaats voor auteurs: alleen `docs/extensions.md` (extensie-auteurs) — eindgebruikers
  hebben nu niets.

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
- [ ] MS Project MPP import (readonly) — realistisch alleen via MPXJ (JVM): NIET als core-dependency
  (strijdig met lichte Tauri/web-architectuur); route = optionele externe converter (MPXJ-CLI/sidecar)
  óf gebruikers MSPDI laten exporteren. Besluit gedocumenteerd in issue #17-triage (2026-07-07).
  **Distributie via het extensiesysteem met "managed tools" (user-besluit 2026-07-07):** de
  catalogus-extensie declareert in zijn manifest een benodigd hulpprogramma (naam, downloadUrl uit
  onze eigen releases, sha256-checksum, grootte); de APP-KERN — niet de extensie — beheert daarop de
  volledige binary-levenscyclus: één bevestigingsvraag bij installatie, download + checksum-verificatie,
  opslag in de app-datamap, updates bij een nieuwere manifest-declaratie, opruimen bij de-installatie.
  De extensie-sandbox blijft ongewijzigd (JS mag alleen declareren/vragen, nooit zelf processen of
  bestanden beheren); de gebruiker hoeft nooit over Java/binaries na te denken. Web-versie: dezelfde
  extensie toont "alleen desktop". Generiek bouwen (herbruikbaar voor toekomstige zware extensies).
- [ ] Asta Powerproject PP import — zelfde MPXJ-afweging als MPP; zelfde converter-route.
- [ ] **KYP Project REST API-integratie (onderzoek)** — de facto NL-bouwplanningstool zonder publieke
  export; directe API-koppeling zou een unieke NL-USP zijn. Eerst: API-toegang/partnerschap verkennen
  (issue #17).
- [ ] Primavera XML (PMXML) import/export — bestaat sinds fase 2 (P6 XML round-trip, sinds v2026.7.7
  minuut-precies); dit punt is de restcontrole dat we P6's PMXML-dialectvarianten breed genoeg dekken.
- [ ] SVG-export van Gantt (PNG bestaat al)
- [ ] Clipboard-ondersteuning (kopieer taken naar Excel)

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
