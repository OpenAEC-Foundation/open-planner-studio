# To-do

Lijst met dingen die we nog willen doen, afgeleid van de roadmap in
[PLAN.md](../PLAN.md) (§6, "Functionaliteiten — Roadmap in 6 Fases").
Hieronder staan **alleen items die nog niet in de code zitten** — wat al af is
(zie Gantt/CPM-engine, IFC/CSV/MSP/P6 I/O, thema's, undo/redo, 14 talen) is
weggelaten. Per fase gegroepeerd zodat het terug te koppelen is naar PLAN.md.

Werkwijze: voeg nieuwe items toe in de juiste fase. Afgeronde items worden uit
deze lijst verwijderd — wat klaar is, staat in de changelog en git-historie.

## Openstaand

### Solver/presentatie (klein, uit de 2.10-showcase-triage, 2026-07-08)
- [ ] **Dag/uur-asymmetrie backward-FS bij start-mijlpaal-voorganger normaliseren** (vondst pakket O,
      2026-07-17). De backward-uur-FS-tak past `prevWorkInstant` onvoorwaardelijk toe, óók bij
      `predEndsBeginOfDay`; de dag-tak behoudt dan juist het doeldatum-label. Work-equivalent
      (tf blijft 0, geen scheduling-fout), maar de mijlpaal toont in uur-modus een late finish op de
      vórige werkdag. Pre-existing; bewust byte-identiek gepind in `tests/planning/`
      `cases-hours-relations.json` case `rr-fs-pred-startms` (met note) — bij normaliseren gaat die
      case bewust rood en moet de verwachting mee. Code: `src/engine/scheduler/relationMath.ts`
      (backward-uur-FS vs. backward-dag-FS).
- [ ] **Hard-pin-restsignaal `TF=-4` op de GROOT-startmijlpaal.** Pre-existing interactie
      (hard pin trekt de backward pass licht negatief door een voltooide keten); valse
      "violated"-melding is al gefixt (74eb7b2), dit is alleen nog het float-getal.
      Triage-repro's staan in de sessie-artefacten; opnieuw af te leiden uit
      `showcase-groot.ts` + `check-advanced-cpm.ts` #182-186.
- [ ] **Plan-datum vs. CPM-forecast zichtbaar verschillend.** De Gantt-balk toont
      `scheduleStart` terwijl de CPM-diagnose de (data-date-gevloerde) forecast toont —
      correct (P6-conform) maar verwarrend naast elkaar. Presentatie-verduidelijking
      overwegen (bv. forecast-markering of tooltip-uitleg).

### Klein
- [ ] **Existentie-guard vóór snapshot in de `remove*`-acties** (reviewer-aanbeveling pakket R,
      2026-07-17). `removeSequence`/`deleteTask`/`removeResource`/`removeCalendar`/`deleteBaseline`
      pushen een undo-snapshot vóór hun filter; bij een onbekend id blijft een loze undo-stap achter
      (zelfde klasse als de in pakket R gefixte `updateTask`/`addSequence`). Impact laag (UI roept ze
      met een bestaand id aan); fix = dezelfde goedkope guard, plus check-blok (g) in
      `tests/planning/check-document-contract.ts` uitbreiden.
- [ ] **"Project verplaatsen…"-functie (Move Project, user-verzoek 2026-07-10).** Hele planning
      N maanden/dagen verschuiven in één handeling: nieuwe projectstartdatum kiezen, alle expliciete
      datums schuiven mee (constraint-datums, deadlines, werkelijke start/einde, statusdatum,
      externe-koppeling-ankers), met keuze of baselines meegaan. Let op: kalender schuift NIET mee
      (feestdagen/bouwvak liggen vast), dus einddatums kunnen verspringen — dat is correct en moet
      in de preview zichtbaar zijn. Scope: store-actie + klein dialoog + tests (één golf).

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
