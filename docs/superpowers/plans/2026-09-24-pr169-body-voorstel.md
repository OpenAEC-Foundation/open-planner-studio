# Voorstel: herschreven PR-body voor #169 (rekenprofielen + X12 brok 1–9)

*Opgesteld door de critreview van #169 als geheel (Opus 5.5, `uitvoerder-opus-midden`) op kop
`d981ed33`. Dit is een VOORSTEL: de eigenaar of orkestrator zet het met `gh pr edit 169 --body-file`
over zodra de openstaande landingen (zie "Open punten") gemerged zijn en de tellingen opnieuw gemeten
zijn. Alles hieronder is gecontroleerd tegen de code op `d981ed33`, tenzij er "na landing" staat.*

*Waarom herschrijven: de huidige body beschrijft de etappe bij het openen (18 conventies, 15.056
afwijkingen, cel-baseline 15.473) met daarboven een statusblok dat elke ronde langer werd. Een
merge-reviewer leest nu drie verschillende tellingen. Daarnaast heet de aanroeperfix in de oude tekst
"C5", terwijl C5 in het register nu `p6CompletedPhysicalAtDataDate` is.*

---

> **Status:** draft, gestapeld op `claude/file-formats-support-phase-3-a0ebe2` (PR #109). Merget ná
> #109; zet de base daarna om naar `main`.

### What and why

Bij elke formaat-etappe kwam dezelfde vraag terug: moet dit in de solver? Dan rekent het raar voor
iemand die MS Project gewend is. Er is één motor en er zijn drie scholen (Primavera P6, MS Project,
OPS). Tot nu toe koos elke etappe wiens gedrag de motor kreeg, en de uitweg was een vlag
(`schedulingOptions.p6Source === 'XER'`) met P6-takken erachter. Deze PR vervangt die vlag door
**rekenprofielen** en brengt daarna de P6-getrouwheid (X12) omlaag van 15.056 naar **175** zesassige
afwijkingen, gemeten op de orakelpopulatie die de eigenaar op 23-09 heeft vastgesteld.

Ontwerp: spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md` (v3.1). Besluiten en stand:
`docs/superpowers/plans/2026-09-22-rekenprofielen-overdracht.md` §0–§1.

**1. Rekenprofielen (de architectuur)**

- **Twee lagen.** Het *rekenprofiel* (`project.schedulingProfile`: basis `p6 | msproject | ops` plus
  afwijkingen) levert **26 conventies**. Dat zijn booleans die bij een school horen: A12–A20, A22, A23,
  B1–B5, C1–C9, C11 en C12. C10 is gereserveerd voor de geparkeerde ALAP-conventie. Register:
  `src/engine/scheduler/conventions/registry.ts`. `project.schedulingOptions` draagt alleen de
  **10 projectopties** per bestand: `lagCalendar`, `criticalDefinition`, `totalFloatMode`,
  `makeOpenEndedCritical`, `nearCriticalThreshold`, `floatPaths`, `useExpectedFinishDates`,
  `useProjectEndDateForFloat`, `p6CompletedLateFromRemainingWindow` en `startToStartLagFrom` (nieuw,
  voorheen conventie C6-variant).
- **Drie ingebouwde profielen en eigen profielen.** Een afwijking op een ingebouwd profiel blijft
  letterlijk staan. Opslaan als eigen profiel maakt een app-globaal sjabloon
  (`ops-schedulingProfiles`); het project draagt altijd zijn eigen kopie, dus een sjabloon werkt niet
  door. A19 (`rem_target_link_flag`) is per bestand en blijft bij elke profielwissel staan.
- **De motor kent geen bestandsformaten meer.** `SchedulingOptions.p6Source` is weg. De solver krijgt
  uitsluitend `EffectiveSchedulingOptions` via `solveOptionsFor`/`solveInputFor`; een aanroeper die
  het profiel overslaat compileert niet. `npm run verify:conventions` (AST-poort, onderdeel van
  `verify`) verbiedt `p6Source` en lezerimports in `src/engine/` en pint de herkomst-datagates
  (alleen omlaag).
- **Openen:** XER ⇒ P6 (SCHEDOPTIONS als opties, A19 als afwijking), `.mpp` ⇒ MS Project,
  MSPDI/P6-XML/CSV/extensie ⇒ OPS (bewust: er is geen orakel voor die wissel), eigen IFC ⇒ het
  opgeslagen profiel. Stelt de lezer een ander profiel dan OPS voor, dan geeft openen één melding per
  bestand met de actie *Projectinfo openen*. Bij een XER wordt die melding samengevoegd met de
  bestaande XER-melding. Crashherstel en heropenen uit IFC melden niets.
- **UI:** het blok *Rekenprofiel en reken-opties* in Projectinfo (dialoog, Backstage en wizard). Dit
  blok vervangt `CalcOptionsSection`. Een profielwissel is één undo-stap en rekent daarna opnieuw.
  `useExpectedFinishDates`, `useProjectEndDateForFloat` en `p6CompletedLateFromRemainingWindow` zijn
  bewust niet bewerkbaar, omdat het P6-bronsignalen zijn. Gids `gids-rekenprofielen` in nl en en.
- **MCP:** `planner_get_project_info` toont het profiel (id, basis, afwijkingen, alle 26 opgeloste
  conventies) en de projectopties. `planner_update_project` weigert `schedulingProfile` en
  `schedulingOptions` expliciet, met een reden en een verwijzing naar de app.

**2. IFC en compatibiliteit**

- Nieuwe pset `OPS_SchedulingProfile` op de `IfcWorkSchedule`: `{ id, baseId, conventions (alle 26
  opgelost), overrides (letterlijk), name? }`. Die pset wordt alleen geschreven als het profiel iets
  anders is dan "OPS zonder afwijkingen". Een OPS-bestand blijft zo byte-identiek aan vóór deze PR.
- `OPS_SchedulingOptions` bevat nog alleen de projectopties, plus A22/A23 wanneer die `true` zijn.
  **v2026.9.0** leest dat blok letterlijk en rekent daarmee: een MS Project-profielbestand rekent daar
  gelijk. Een P6-profielbestand rekent daar als OPS, want v2026.9.0 kent geen P6-conventies. Die versie
  had ook geen XER-lezer, dus het is geen regressie.
- **Migratie** (`services/ifc/schedulingProfileMigration.ts`): een bestand zonder profiel-pset wordt
  per veld gemigreerd. Voor een blob met `p6Source: 'XER'` (alleen uit dev-builds van #109) is de
  basis P6. Een aanwezige vlag wint. Een afwezige B1–B5 gaat aan. Afwezige C1–C9/C11/C12 krijgen hun
  P6-waarde uit een gepinde lijst, zodat een latere conventie niet vanzelf aangaat. Zonder `p6Source`
  gelden A22+A23 als MS Project, anders OPS. In een profiel-pset van een oudere dev-build van deze
  branch krijgt een ontbrekende conventie zijn `legacyValue`, nooit de basiswaarde.

**3. X12 naar nul: brok 1–9 en populatie**

- **Populatie (eigenaarsbesluit 23-09):** alleen bestanden die aantoonbaar door P6 zijn doorgerekend,
  tellen als orakel. Kenmerken: een SCHEDOPTIONS-rij, `rem_late_start_date` gevuld en
  `driving_path_flag` ergens Y (`scripts/xer-p6-computed.ts`, `xer-corpus-manifest.json`). rehab-2
  (P3-uitvoer), de synthetische S1–S10 en de DCP-03-Baseline-kopieën (generatoruitvoer; bevestigd
  24-09) zijn `reader-only`. Gemeten: 8 bestanden en 20 projecten.
- **Conventies uit X12:** C1–C9, C11 en C12, elk per cel gemeten tegen P6 (regel A: 0 slechter).
  C1 en C4 staan in elk ingebouwd profiel uit: ze droegen alleen P3-gedrag (rehab-2). C3 blijft in P6
  aan, want C5 rekent met de C3-regel. Uit C3 halen kost 640 exacte cellen.
- **Float-tolerantie:** tf/ff tellen als exact als het verschil op het 0,001-minuutraster 0 wordt
  (`FLOAT_EXACT_TOLERANCE_MIN`, alleen de float-assen).
- **Meetlat:** cellenbestand v2 (`xer-product-fidelity-cells.json`) met ratchet per cel op emmer én
  afwijkingsgrootte. `ratchetDebt` staat op 0 (was 14 Roads-cellen). Het manifest kent uitsluiting per
  project en per taak (`excludeProjects`/`excludeTasks`, met een verplichte `decision`).
- **Stand op `d981ed33`:** **175** zesassige afwijkingen (ef 27, es 24, ff 15, lf 29, ls 33, tf 47)
  en 168 drivingPath-cellen. Het nuldoel is niet gehaald; mét corpus staat de X12-suite by design rood
  op precies de drie nuldoelregels. Zonder corpus is alles groen.

### Gedragsbehoud en benoemde wijzigingen

- **De ombouw naar profielen zelf gedraagt zich gelijk:** het X12-detailrapport is byte-identiek
  vóór/ná de solverombouw, `.mpp` houdt 216 pins met 0 verbeterd en 0 verslechterd, en de
  corpusloze suites zijn identiek.
- **Benoemd — laadpad krijgt de volledige solverinvoer** (in eerdere teksten "C5" genoemd; dat is niet
  de conventie C5). Vier aanroepers gaven `projectStart/EndDate` niet door: `documentActivation`,
  `occupancy`, `distribute` en `benchmark`. Via `prepareLoadedPayload` (elk geopend bestand en
  crashherstel) toont een XER met `useProjectEndDateForFloat` bij het openen nu dezelfde late datums en
  dezelfde speling als na F5. **Releasenotitie verplicht.**
- **Benoemd — P6-rekenwerk verandert bewust** voor XER-documenten, door de X12-conventies (C1–C12) en
  de float-tolerantie. Dat is het doel van brok 1–9: 15.056 → 175 op de P6-populatie. Voor OPS- en
  MS Project-projecten verandert niets: de C-conventies staan daar uit.
- **Benoemd — `lagCalendar`** werkt voor elk formaat (eigenaarsbesluit 22-09, releasenotitie).

### Hoe te testen

- `npm run verify` (zonder `OPS_XER_CORPUS`) — **EXIT 0 op `d981ed33`** (critreview 23-09, browser 167 passed;
  `verify:conventions` meldt één datagate om omlaag te herpinnen: `p6StartAtPredecessorFinishBoundary` 6→5).
- Met corpus: `OPS_XER_CORPUS=… npm run measure:profiles`. Verwacht: P6 staat op NULDOEL rood met
  exact 175, MS Project is GROEN (216 pins) en de vangrails zijn GROEN.
- Handmatig: open een `.xer`. Er verschijnt een melding "rekent als Primavera P6". Kies Projectinfo →
  Rekenprofiel, wissel naar OPS en weer terug naar P6: dat geeft het origineel, en het is één
  undo-stap. Sla op als IFC en open opnieuw: het profiel is gelijk. Open daarna een `.mpp`: die krijgt
  het MS Project-profiel. Een nieuw project via de wizard biedt de profielkeuze aan.
- Gerichte checks: `check-scheduling-profile-roundtrip`, `check-conventions-registry`,
  `check-conventions-p6-flags`, `check-solve-input`, `check-import-profile`, `check-document-contract`,
  `check-scheduling-profile-{actions,draft,notice}`, `check-ifc-roundtrip`, recovery-checks,
  `tests/browser/scheduling-profile.spec.ts`.

### Open punten

- **Besloten op 24-09 maar nog niet in de code op `d981ed33`** *(bijwerken na landing)*:
  - vraag 7: B3, B4 en A17 in het P6-profiel uit (landing `b3121e2e`). Let op: A21
    (`p6CompletedLateFromRemainingWindow`) werkt alleen samen met B3, en de diagnose-trace
    `backwardFloatTrace` gebruikt B3 als schakelaar. Een IFC dat op deze branch als P6 is opgeslagen,
    heropent daarna als "P6 met drie afwijkingen", omdat de pset de opgeloste waarden draagt. De gids
    moet dan bijgewerkt worden (daar staan B3/B4/A17 nu als "(Primavera P6)").
  - vraag 8: HarbourPointe, 8 taken met verouderde P6-uitvoer via `excludeTasks`.
  - vraag 10: OZB project 9033 (door P6 genivelleerd) via `excludeProjects`. P6-nivellering wordt
    een eigen etappe.
  - vraag 12: Hotel deelproject CR 2665 via `excludeProjects`.
  - vraag 11: de manifest-policy zegt nog "bevestiging door de eigenaar gevraagd"; dat is inmiddels
    bevestigd.
  - Na deze landingen dalen de 175 verder; de body krijgt dan de nieuwe telling.
- **Restant zonder bouwbare stap:** ALAP (C10, geparkeerd), de SF-lag-0-minuut in Sample (n=1,
  zonder Oracle-bron) en de driving-path-as (longest-path-wandeling als instelling).
- **Bekende gaten (bewust):** de export-guard (`detectXerExportLoss`) werkt alleen voor documenten met
  XER-herkomst, dus `.mpp` → MSPDI meldt het verlies van A22/A23 niet. MSPDI en P6-XML openen voorlopig
  als OPS.
- **Neerwaarts:** wie een bestand van deze versie in v2026.9.0 opent en opslaat, verliest de pset
  `OPS_SchedulingProfile`, want v2026.9.0 kent geen doorgeefmechanisme voor onbekende psets. De
  projectopties overleven wel. Bij heropenen hier: MS Project blijft MS Project (via A22/A23) en P6
  wordt OPS.
- Niet met de hand in P6 of MS Project getest. De P6-regels komen uit de Oracle-documentatie en het
  corpus; er is geen MPXJ-code overgenomen.

### Does this touch

- [x] **Project data** — `project.schedulingProfile` (in `project`, dus via `DOCUMENT_FIELDS`), pset
  `OPS_SchedulingProfile`, migratie.
- [x] **Scheduling logic** — profielombouw gedragsbehoudend; X12-conventies C1–C12 in P6; aanroeperfix
  laadpad.
- [x] **User-visible text** — 14 locales (`verify:i18n`), gidsen nl+en (`verify:docs`).
- [ ] **`@tauri-apps/*`** — n.v.t.

### Documentation

Spec v3.1, plan, overdracht met eigenaarsbesluiten, X12-dossiers (`docs/superpowers/plans/2026-09-2[234]-*`),
gids `gids-rekenprofielen` nl+en, CLAUDE.md (secties XER-lezer en Rekenprofielen), AGENTS.md,
CONTRIBUTING.md, `scripts/README.md`, `docs/recepten/conventie.md`, `docs/ifc-round-trip.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
