# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Browser-dev via scripts/dev-server.mjs (poort per worktree, dubbelstart-guard)
npm run build        # tsc && vite build → dist/ (noEmit staat in tsconfig)
npm run preview      # Serve the built bundle
npm run tauri:dev    # Run the desktop app (Tauri 2) via scripts/tauri-dev.mjs
npm run tauri:build  # Produce desktop installers
npm run bump X.Y.Z   # CalVer-versie syncen (package.json + tauri.conf.json + lock; Cargo.toml blijft bewust 0.1.0)
npm run verify       # DE poort — exact wat CI, de release-gate en de deploy-gate draaien
npm run typecheck    # tsc --noEmit over src/ én scripts/+tests/ (tsconfig.tests.json)
npm run lint         # los: ESLint over src/ — promises, control-regex en harde React-hookregels
npm test             # alle vijf de suites: planning, library, mcp, dev-server, browser
npm run test:planning     # los: CPM/kalender-regressiesuite (== bash tests/planning/run.sh)
npm run test:library      # los: bibliotheek/IFC/i18n-checks
npm run test:mcp          # los: MCP-tools
npm run test:dev-server   # los: node:test-units + integratietest van de dev-serverpoort/-locks
npm run test:browser      # los: echte gebruikersflows in Chromium via Playwright
npm run test:browser:x11  # lokaal headed; vereist OPS_XER_CORPUS + desktopdisplay, vervangt de corpusloze CI-poort niet
npm run verify:examples   # los: de gebundelde voorbeelden laden/rekenen door zoals verwacht
npm run verify:docs       # los: in-app gidsen — nl+en hard vereist, overige 12 talen indien aanwezig
npm run verify:i18n       # los: ontbrekende vertaalsleutels t.o.v. nl (CLDR-pluralcategorieën meegerekend)
npm run verify:store-boundaries # los: AST-poort — core-runtimefactories en storegebonden MCP-tools importeren nooit useAppStore/appStoreContext
npm run verify:conventions # los: AST-poort — src/engine/ leest geen bronformaat (p6Source/readFormat/XER-bronsignalen/lezer-imports); opties-sleutels alleen uit het register (+ elke conventie gelezen in de solver); ongepinde p6…/xer…/mpp…/msp…-velden rood; herkomst-datagates gepind, alleen omlaag. Syntactisch: een opties-object via een helper in een ander bestand onder een neutrale naam, of via `any`, ziet hij niet
npm run measure:profiles  # los: cel-baseline per rekenprofiel (regel A: geen exacte cel mag inexact worden); het P6-deel vereist OPS_XER_CORPUS
npm run verify:release-highlights # los: controleert voor een getagde release de lokale updatehoogtepunten en statistieken
npm run verify:gantt-boundaries # los: AST-poort voor renderer-, viewport-, pointer- en tabelgrenzen
npm run verify:cycles     # los: circulaire imports binnen src/ (esbuild-metafile, dus ná type-erasure)
npm run verify:text-roles # los: tekstgroottes alleen via de zes tekstrollen — geen kale px/rem, text-[Npx] of Tailwind-standaardmaat
npm run verify:audit      # los: npm audit --audit-level=high — bewust NIET in `verify` (zie hieronder)
npm run gen:examples      # Voorbeeldprojecten (public/examples) opnieuw genereren
npm run publish:wiki      # GitHub-wiki genereren uit repo-bronnen (dry-run; `-- --push` publiceert)
npm run stats:downloads   # downloads per OS uit de GitHub Releases-API (tekst; `-- --format=markdown|json`); de workflow publiceert de JSON wekelijks naar de `stats`-databranch
```

`npm run dev` gaat via `scripts/dev-server.mjs`: dat wijst deze worktree via `scripts/dev-port.mjs` een **vaste** poort toe (verankerd aan de worktree-root, 3007–3106), claimt een guard-slot via `scripts/dev-lock.mjs` zodat een tweede start in dezelfde worktree wordt geweigerd in plaats van stilletjes een andere poort te pakken, stempelt `.claude/launch.json` met die poort (zodat `preview_start` meteen de juiste worktree opent), en spawnt dan pas Vite. `tauri:dev` (`scripts/tauri-dev.mjs`) doet hetzelfde en start `tauri dev` met een matchende `--config` `devUrl` plus `OPS_DEV_PORT`/`OPS_DEV_INSTANCE`/`OPS_DEV_GUARDED` in de env (de geneste `dev`-start slaat de toewijzing dan over). Zo kunnen **meerdere worktrees hun dev- en desktopbuild tegelijk draaien** — elk met een eigen poort (het venster laadt nooit de Vite van een andere worktree) en eigen `recovery.<slug>.*`-auto-save-bestanden (concurrent instanties overschrijven elkaar niet in de gedeelde `appDataDir`). `vite.config.ts` leest `OPS_DEV_PORT` met `strictPort` — dat is de harde backstop: twee worktrees op dezelfde poort geeft EADDRINUSE in plaats van een verkeerde build. `App.tsx` leest de slug via de `__OPS_DEV_INSTANCE__`-define. De regressietests hiervoor staan in `tests/dev-server/`.

Er is geen vitest/jest; `tsc` is de statische hoofdcheck — draai `npm run typecheck` (dekt óók `scripts/` en `tests/`, incl. het casus-schema) in plaats van alleen `npm run build`. TypeScript staat op `strict` met `noUnusedLocals`/`noUnusedParameters`, dus builds leggen vaak dode code bloot. Daarnaast draait er een **bewust minimale** ESLint-config (`eslint.config.js`): géén stijlregels — wel `no-floating-promises`, `no-misused-promises`, `no-control-regex`, `react-hooks/rules-of-hooks` en `react-hooks/exhaustive-deps`, plus een fout op ongebruikte suppressies. `import/no-cycle` staat er bewust NIET in: `verify:cycles` doet dat beter (graaf ná type-erasure, dus geen valse treffers op `import type`). De gedragstests zitten in vijf suites, samen achter `npm test`:

| suite | wat | runner |
|---|---|---|
| `tests/planning/` | data-driven CPM/kalender-cases + losse `check-*.ts`-batterijen (IFC-round-trip en STEP-stringveiligheid, recovery-integriteit en -isolatie, documentcontract, meldingen, undo-begrenzing, export-guard, werkdagen-as, i18n-pluralvormen, renderer, `.mpp`-lezer-datumgetrouwheid met de `GOAL_ZERO_DEVIATIONS`-poort, …), afgesloten met een tijdzone-matrix | `run.sh`, esbuild → Node |
| `tests/library/` | bibliotheek, pool-IFC, vijandige IFC-invoer, i18n-meervouden | `run.sh` |
| `tests/mcp/` | de MCP-tools headless tegen de echte store | `run.sh` |
| `tests/dev-server/` | poortallocatie en flock-races van de dev-server | `node:test` + `integration.sh` |
| `tests/browser/` | echte muis-, toets-, wheel- en DOM-handelingen voor Gantt, documenten, TableEditor, dialogen en panelen; state-/paintasserties via de dev-only brug | Playwright Chromium headless shell |

Installeer de browser en Linux-systeemafhankelijkheden eenmalig met
`npx playwright install --with-deps --only-shell chromium`. `npm run test:browser` reserveert daarna
een afzonderlijke poort voor deze worktree, start en stopt zelf een bewaakte Vite-server en draait
met één worker en nul retries. Gebruik bij falen `test-results/` voor screenshots en traces en
`playwright-report/` voor het HTML-rapport; de CI-, live- en release-gates uploaden die mappen zeven
dagen als `playwright-*`-artefact. Testhandelingen lopen via echte browser-events. De dev-only
`window.__OPS__`-brug mag deterministische fixtures zetten en domeinstate of Canvasgeometrie lezen,
maar mag de geteste gebruikershandeling niet vervangen.

Draai de planningssuite na elke wijziging aan planningscode. **De suite print "alles groen" ook bij exit 1** wanneer het bundelen faalt — vertrouw op de **exitcode**, nooit op de tail. Een `grep` op faalregels is een handig extraatje maar **geen poort**: `grep '^XX'` werkt alleen voor `tests/planning/`. De bibliotheeksuite print zijn faalregels **ingesprongen** (`console.log(\`   XX ${msg}\`)` in `tests/library/check-*.ts`), dus `grep -c '^XX'` geeft daar 0 terwijl de suite rood staat — gemeten 2026-07-28. Gebruik `grep -c 'XX '` als je toch wilt tellen, en laat de exitcode altijd het oordeel vellen. `npm run verify` is de poort die CI, de release-gate en de deploy-gate alle drie draaien — dat is één definitie in `package.json`, dus wat je lokaal draait is letterlijk wat CI draait. Zie `tests/planning/README.md` voor het toevoegen van cases.

CI (`.github/workflows/`): `ci.yml` draait `npm run verify` plus `tauri build --no-bundle` op Ubuntu/Windows/macOS; `live.yml` deployt de browserbuild (`dist/`) naar `open-planner-studio.open-aec.com` bij elke push naar `main` — de webbuild is een echte productie-deploy, geen dev-target — achter dezelfde `verify`-gate; `release.yml` bouwt installers op `v*`-tags achter diezelfde gate plus een controle dat de tag overeenkomt met de gebumpte versie, en `snap.yml` volgt daarna via `workflow_run` (zie *Auto-update & releases* hieronder). Een rode suite blokkeert dus zowel de deploy als de release; draai `npm run verify` lokaal vóór je pusht. `verify:audit` zit sinds 2026-09-03 bewust **niet** meer in die keten: een nieuw gepubliceerd advisory zette anders élke push en deploy rood, ook een die de dependency niet raakt (gemeten: de releasecommit van v2026.9.0 op `browserslist`). Dependabot security alerts staan aan op de repository en zijn het meldkanaal; een advisory wordt in een eigen commit opgelost, `npm run verify:audit` blijft daarvoor als los commando bestaan.

Path alias: `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`). Use it consistently in imports.

## Architecture

This is a Tauri 2 desktop app (Rust shell + React 19 frontend) for construction planning, part of the OpenAEC-Foundation desktop-app family (LGPL-3.0; extension system and styling follow Open Calc Studio). The browser build is production-deployed (`live.yml`) and functionally near-complete: since v2026.7.11 it does its own file I/O (File System Access API on Chromium, download-fallback elsewhere) and auto-save recovery (IndexedDB). **The in-app updater and MCP bridge are Tauri-only.** The split is still gated behind a runtime check:

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

Any code that touches `@tauri-apps/*` must be either dynamically imported inside an `isTauri()` branch (see `App.tsx` auto-save) or otherwise guarded — top-level imports of Tauri plugins will break the web build.

### The Rust backend is thin — file I/O uses JS plugins, not `invoke`

De `invoke_handler` in `src-tauri/src/main.rs` telt precies drie commands: `install_kind` (uit `src-tauri/src/commands/mod.rs`) plus `mcp_bridge_start`/`mcp_bridge_stop` (uit `src-tauri/src/mcp_bridge.rs`, zie *AI-assistent* hieronder). `install_kind` wordt aangeroepen vanuit `src/services/updater/updaterService.ts` om het installatietype (appimage/snap/deb/native) te detecteren en de updater te poorten. (The unused `read_file`/`write_file` commands were removed for finding K6a: everything in the `invoke_handler` is reachable via `window.__TAURI_INTERNALS__.invoke(...)`, extension code included, and those two did no path validation and bypassed the `plugin-fs` scope. Houd die lat aan: elk nieuw command is publiek oppervlak.) All real file I/O funnels through `src/services/fileAccess/` — a runtime-dispatched abstraction (`index.ts` kiest Tauri↔web met een `FileRef`-model) met een Tauri-backend (`plugin-fs` + `plugin-dialog`) en een web-backend (File System Access API + download-fallback): `fileSlice` (open/save/export), `src/services/recovery/recoveryStore.ts` (auto-save) en `ReportPanel.tsx` (rapport-export) draaien er allemaal op; handle-backed recente-bestanden via `fileAccess/recentFiles.ts`. Follow that pattern — breid `fileAccess` uit, geen nieuwe Rust-command — when adding file operations. All IFC parsing/serialization, scheduling, and rendering are TypeScript; Rust is just the shell. Enabled plugins: `fs`, `dialog`, `shell`, `store`, `os`, `updater`, `process`, `clipboard-manager`; app id `org.openaec.planner`.

### IFC is the native file format, not a sidecar

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth. The other `src/services/` areas — `fileAccess/` (Tauri↔web bestands-I/O + handle-backed recents), `recovery/` (auto-save/restore, Tauri fs + web IndexedDB), `actualAutosave/` (opt-in, promptvrije writes to an existing project file), `benchmark/` (ingebouwde benchmark-tool via Instellingen), `print/` (printvoorbeeld), `pdf/` (vector-PDF-export via `pdf-lib`; Arabic and Persian stay vector, while CJK rasterizes only without an optional `pdf-fonts` extension), `updater/`, `feedback/` (feedbackdialoog + screenshot-annotator), `mcp/` (AI-assistent, zie hieronder) and `debug/appLog` (log-bus achter de DebugTerminal) — are app plumbing with no IFC impact. `library/` is de uitzondering: bibliotheekdata is app-globaal, maar herkomststempels round-trippen wél door het project-IFC (zie *Resourcebibliotheken*).

### De `.mpp`-lezer is een eigen CFB/OLE2-implementatie, alleen-lezen

Naast de bestaande CSV/MSPDI (MS Project XML)/P6-XML-adapters kan Open Planner Studio het native
`.mpp`-formaat van Microsoft Project (MPP14, Project 2010–2021) rechtstreeks openen — geen Rust, geen
externe bibliotheek. `src/services/mpp/` is een eigen, in TypeScript geschreven CFB/OLE2-container-
parser (`cfb.ts`) plus een MPP14-fieldmap-laag (`fieldMap14.ts`, `mppContainer.ts`, `mppEntities.ts`,
`mppCalendars.ts`, `mppPrimitives.ts`, `mppTimephased.ts`), structureel afgeleid van MPXJ
(`github.com/joniles/mpxj`, LGPL-2.1) zonder de Java-afhankelijkheid. Entry point `readMPP()`
(`mppReader.ts`) levert hetzelfde `ImportResult`-contract als de andere lezers en wordt — net als
CSV/MSPDI/P6-XML/IFC — via `src/services/formatRegistry.ts` (`READ_FORMATS`, één registry voor alle
open-dispatches en de exportlijst) achter een dynamic import geladen, zodat de CFB/fieldmap-code
buiten de hoofdbundel blijft. De import is **alleen-lezen**: er is geen `.mpp`-schrijfpad, opslaan
gaat altijd via IFC (zie hierboven); oudere `.mpp`-versies (MPP8/9/12) en wachtwoord-versleutelde
bestanden worden herkend maar geweigerd met een duidelijke foutmelding.

Datumgetrouwheid tegen MS Project zelf wordt bewaakt door `tests/planning/check-mpp-fidelity.ts`
tegen een gecommitte baseline (`mpp-fidelity-baseline.json`, 216 bestanden/3413 taken uit publiek
MPXJ-/OzBuild-testmateriaal): de `GOAL_ZERO_DEVIATIONS`-poort daarin faalt zodra één gepind bestand
nog maar één dag/minuut afwijkt. Een bewerking die de MSP-eigen timephased-sturing van een taak
loslaat (contour/split/nivellering uit het bronbestand) geeft eenmalig per document een informatieve
melding (`notifyTimephasedLoss`, `src/state/timephasedLossNotice.ts`) en markeert de taak in het
eigenschappenpaneel (`TaskTimephasedNotice.tsx`); beide linken via `openHelpArticle` (`uiSlice.ts`,
`NotifyInput.helpArticleId`) naar de Help-viewer (Backstage → Help). Zie de gids
`public/docs/{nl,en}/gids-msproject-import.md` voor het gebruikersperspectief en de overige
`tests/planning/check-mpp-*.ts`-batterijen (import/relations/calendars/summary-relations) voor de
rest van de regressiedekking.

### De XER-lezer (Primavera P6): bronarchief in het IFC, P6-getrouwheid in drie lagen

`src/services/xer/` leest het native `.xer`-uitwisselingsformaat van Primavera P6 rechtstreeks
(geen Rust, geen externe bibliotheek): `xerTables.ts` (tabelparser, getalnotatie uit `CURRTYPE`,
tekencodering BOM → UTF-8 → Windows-1252), `xerReader.ts` (entry point `readXER()`, hetzelfde
`ImportResult`-contract als de andere lezers, via `formatRegistry.ts` achter een dynamic import),
`xerMultiProject.ts` (één bestand ⇒ meerdere documenten; baselineprojecten worden bij hun huidige
project gematerialiseerd), `xerCalendarData.ts` (de `clndr_data`-decoder incl. herstelcodes),
`xerScheduleOptions.ts` (SCHEDOPTIONS → `SchedulingOptions`, X5), `xerRecordedTimes.ts` (zie
hieronder) en de resource-/metadata-lezers. Het volledige plan met eigenaarsbesluiten, dossiers en
de overdrachtsstand staat in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`; lees §4.1
(de veldwhitelist met vier "bakken") vóór je een TASK-kolom aanraakt.

Drie architectuurregels die je moet kennen. (1) **Het bronarchief.** De volledige oorspronkelijke
`.xer`-bytes reizen als `xerSourceArchive` (+ `xerImportMetadata`, `xerSourceProjectId`) mee in
`DOCUMENT_FIELDS` én in `IFC_SAVE_KEYS` (`src/state/ifcSaveInput.ts`; de archiefvelden zelf in `src/services/xerSourceArchive.ts`): het IFC-projectbestand
en elke crashherstel-snapshot dragen het archief, zonder bovengrens — gemeten 17,7 MB `.xer` ⇒ ±50 MB
IFC, ±3,6 s hoofdthread per auto-save-tick (`docs/xer-recovery-guardrails.md`; eigenaarsbesluit,
plan §10.f). De MCP-tool `planner_inspect_xer_provenance` en de extensie-API `data.getImportSource*` (achter
de permissie `importSource`, default-deny) lezen eruit. (2) **Bak 4 — opgeslagen rekenuitvoer is
weergave, nooit solverinvoer.** De zes P6-uitvoerkolommen (`early_/late_start/end_date`,
`total_/free_float_hr_cnt`) mogen uitsluitend via `xerRecordedTimes.ts` gelezen worden, als
`ImportResult.recordedTimes`; ze voeden de weergave "Datums zoals opgeslagen" (issue #63, hierboven
onder *State*) en de X12-meetlat, nooit `Task.time` als invoer. Bak 2 (`restart_date`, `driving_path_flag`,
…) mag de lezer nooit lezen. `tests/planning/check-xer-field-whitelist.ts` grept beide grenzen
corpusloos over heel `src/`; de X12-non-interferentie in `check-xer-product-fidelity-x12.ts` bewijst
het per mutatie. (3) **P6-gedrag loopt via het rekenprofiel, niet via het bronformaat.** De XER-lezer zet
`project.schedulingProfile` op het ingebouwde profiel Primavera P6 (A19 per bestand als override uit
`rem_target_link_flag`); elke P6-specifieke solvertak staat achter een eigen conventievlag (zie
*Rekenprofielen* hieronder). `SchedulingOptions.p6Source` bestaat niet meer; oude IFC-bestanden met
`p6Source` migreren per veld (`legacyOptionsToProfile`). `WorkCalendar.p6Source` blijft als diagnoseveld.
Uitzondering: `lagCalendar` is sinds X5 een werkende instelling voor élk formaat.

Meten gaat via het corpus (`OPS_XER_CORPUS`, plan §10.a; niet in de repo, geen CI-poort):
`check-xer-product-fidelity-x12.ts` telt zesassige afwijkingen tegen P6's eigen uitvoer
(`OPS_XER_FIDELITY_REPORT=summary|detail|baseline`), gepind in `xer-product-fidelity-baseline-v2.json`
en corpusloos in `check-xer-corpusless-fidelity-gate.ts`. De orakelpopulatie is sinds 2026-09-23
alleen de aantoonbaar door P6 doorgerekende bestanden (`xer-corpus-manifest.json`, eigenaarsbesluit;
rehab-2 = P3-uitvoer, de DCP-03-Baseline-kopieën = generatoruitvoer en de synthetische bestanden zijn
`reader-only`). Binnen een orakelbestand kan een eigenaarsbesluit bovendien projecten of taken uit de
meetlat halen (`excludeProjects`/`excludeTasks` met `decision`; sinds 2026-09-23: OZB project 9033
(genivelleerd), Hotel project CR, 8 HarbourPointe-taken met verouderde P6-uitvoer; sinds 2026-09-24 ook
HarbourPointe EC1420, dat zijn datums uit die verouderde EC1430 krijgt — 42 taken, hun
afwijkingen staan als niet-stijgende pin `excludedHidden` in het cellenbestand). Het nuldoel van plan §1
is niet gehaald (76 zesassige afwijkingen over 8 geselecteerde entries en 18 projecten op 2026-09-24, na C14;
daarvoor 15.056 op het oude, bredere orakel); mét corpus staat de suite daarom by design rood op precies die drie
nuldoelregels. Het cellenbestand (`xer-product-fidelity-cells.json`, versie 2) is een ratchet per cel
op emmer én afwijkingsgrootte, met een eenmalige `ratchetDebt` (14 Roads-cellen, sinds X12 brok 6 op 0) die alleen mag dalen;
recept en verboden omwegen in `scripts/README.md`.
Gebruikersgidsen: `public/docs/{nl,en}/gids-xer-import.md` en `datums-zoals-opgeslagen.md`.

### Rekenprofielen: benoemde conventies, geen formaatvlag

Eén motor, drie scholen (Primavera P6, MS Project, OPS). Een **rekenprofiel** (`project.schedulingProfile`,
basis `p6 | msproject | ops` + overrides) levert zevenentwintig **conventies** (`ConventionKey`, booleans);
`project.schedulingOptions` draagt alleen de elf **projectopties** (`ProjectOptionKey`, per bestand) en
`progressMode` blijft een eigen projectveld. De bron voor beide is `src/engine/scheduler/conventions/registry.ts`
(`CONVENTIONS` met per conventie drie ingebouwde waarden, `legacyValue`, `gatedByP6Source` en het
beschrijvende `perFile`); de migratie van oude optieblokken (`legacyOptionsToProfile`) staat bewust buiten
de motor, in `src/services/ifc/schedulingProfileMigration.ts`. Per bestand komt alleen A19 (`perFile` in het
register; het bewerkmodel leidt er `PER_FILE_CONVENTION_KEYS` uit af): die waarde blijft bij elke
profielwissel staan, ook naar een eigen profiel of een sjabloon. Verder blijven afwijkingen op een
ingebouwd id bij een wissel letterlijk staan (`switchProfile`), en `isDefaultProfile` is letterlijk "ops
zonder enige afwijking" — zo geeft P6 → OPS → P6 het origineel terug.
De solver krijgt uitsluitend `EffectiveSchedulingOptions` via `solveOptionsFor`/`solveInputFor`
(`src/engine/scheduler/solveInput.ts`) — `CPMOptions.schedulingOptions` is verplicht dat type, dus een
aanroeper die het profiel overslaat compileert niet. Lezers stellen het profiel voor (`ImportResult.suggestedProfileId`:
XER ⇒ p6, `.mpp` ⇒ msproject, MSPDI/P6-XML/CSV ⇒ ops deze etappe); openen meldt het profiel met een
actie naar Projectinfo. IFC: `OPS_SchedulingProfile` (alle zevenentwintig opgelost plus de letterlijke afwijkingen, alleen ≠ standaardprofiel)
naast `OPS_SchedulingOptions` (opties + A22/A23 alleen als true) — door `writeIFC`/`readIFC` geschreven en
gelezen. Eigen profielen zijn app-globale
sjablonen (`ops-schedulingProfiles`, `services/schedulingProfiles/profileStore.ts`); een project draagt
zijn eigen kopie. UI: het blok *Rekenprofiel en reken-opties* in Projectinfo
(`SchedulingProfileSection.tsx`, bewerkmodel `state/schedulingProfileDraft.ts`, actie
`applySchedulingSettings`). **Regel A/B voor motorwerk:** een wijziging landt alleen als onder elk
profiel met orakel geen exacte cel inexact wordt (`npm run measure:profiles`, cel-baseline); verschilt
iets per profiel, dan is het een conventie in het register — nooit een `if` op het formaat (wél bestaan er
gepinde herkomstpoorten bínnen conventies, zoals `task.p6ProjectId !== undefined`: de datagates).
`npm run verify:conventions` bewaakt dat mechanisch. Recept: `docs/recepten/conventie.md`; gids:
`public/docs/{nl,en}/gids-rekenprofielen.md`; spec: `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`;
regel A en B: `docs/superpowers/plans/2026-09-22-goalprompt-x12-naar-nul.md`.
De elfde projectoptie, `leveling`, is het **fundament voor P6-nivellering** en nog pure data: de XER-lezer
vult hem uit SCHEDOPTIONS (`level_keep_sched_date_flag`, `level_all_rsrc_flag`, `LevelPriorityList`) en
RSRCLEVELLIST (+ `RSRCRATE.max_qty_per_hr`), bewust zonder aan/uit-veld (P6 bewaart niet óf er
genivelleerd is; de vorm van de aan/uit is eigenaarsbeslissing 1); hij round-tript via `OPS_SchedulingOptions` en MCP
`get_project_info` toont hem, maar motor, UI en `ResourceLeveler.ts` lezen hem niet. De motoretappe leest
hem straks uitsluitend via `src/services/leveling/levelingInput.ts` (hangende resource-ids gemeld, gesloten
mapping P6-kolomnaam ⇒ eigen berekende grootheid, nooit opgeslagen P6-uitvoer). Het manifestveld
`leveledProjects` (`tests/planning/xerManifestLeveling.ts`) is het bijbehorende meetmechanisme, zonder
data en zonder invloed op de telling (eigenaarsbeslissing 2). Plan en open besluiten:
`docs/superpowers/plans/2026-09-24-nivellering-etappe-onderzoek.md`.

### De contour-engine: werkverdeling-per-dag als data, de curve-formule als terugval

`src/engine/contour/contourEngine.ts` (puur, 2026-09) is de rekenkern voor **resource-contouring**:
een contourprofiel (`Task.timephasedContours`, periodes op de cumulatieve werkminuten-as van de taak
— dezelfde as als `TaskSplitGap`) wordt per dagslot (`hoursPerDay × 60`) omgerekend naar werkminuten,
en daaruit naar eenheden per dag. `ResourceLoad.ts`'s `assignmentDayUnits` is de ENE verdeelfunctie
die histogram, overallocatie, nivelleerder (`ResourceLeveler.ts`) en bezettingsoverzicht delen:
(1) een opgeslagen contour (gekoppeld aan de toewijzing via `TaskTimephasedContour.resourceId`,
`matchContoursToAssignments`) ⇒ data, zonder de hele-eenheden-afronding; (2) `ResourceAssignment.
curveValues` (de exacte 21-punts P6-/MSPDI-curve, `CONTOUR_SHAPE_VALUES`-vorm) ⇒ eveneens data;
(3) opgeslagen werk (`ResourceAssignment.remainingWorkMinutes` [+ `actualWorkMinutes`], taaktypes-
etappe) ⇒ als data met de curvevorm over de duur gespreid; (4) anders de bestaande `distributeUnits`-
formule, byte-identiek. De engine raakt **geen taakdatum**:
de CPM-datums van een import blijven bij laag 3/4 van de Z8-beslistabel en `splitGaps` — de
fidelity-poort bewaakt dat. Een duurwijziging (`taskSlice.updateTask`, `createMcpTransactions`,
`taskEditPlan`) herschaalt de contour én de importsplits proportioneel via `taskDefaults.ts`'s
`rescaleTaskContours` (actuals blijven; werkbehoud volgt de effectieve werkregel via
`workRuleApply.ts`'s `contourKeepsWork` — zonder eigen `workRule` geldt nog `mspTaskType ===
'FIXED_WORK'`); een datum-/kalender-/toewijzingswijziging raakt de as niet. **Werkregels
(taaktypes-etappe, spec `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md`, in
aanbouw):** `Task.workRule` ∈ FIXED_DURATION_RATE (standaard, het gedrag van vandaag) |
FIXED_DURATION_WORK | FIXED_WORK | FIXED_RATE, anders `Project.defaultWorkRule`. De pure kern
`src/engine/work/workTriangle.ts` werkt op de RESTERENDE toestand (werk = restduur × inzet; W en I
opgeslagen, R afgeleid en naar boven afgerond op hele dagen/minuten); de brug
`src/engine/work/workRuleApply.ts` (`captureTriangle` vóór de mutatie → `settle…` erna) is op vier
plekken bedraad: `taskSlice.updateTask`/`setTaskWorkRule`, `resourceSlice.assignResource`/
`updateAssignment`/`unassignResource`/`moveAssignment`/`removeResource`/`setAssignmentWork`,
`gridTransaction.ts` en de MCP-tweeling in `createMcpTransactions.ts`. Een duur die uit de driehoek
komt (inzet/werk/resource erbij-eraf onder FIXED_WORK/FIXED_RATE) zet `scheduleStale` en loopt door
`settleDurationAftermath` (contour + importsplits herschalen, Z8-venster en bevroren walks wissen),
precies als een duurbewerking; op een gestarte taak wordt de rest dan expliciet geschreven
(`remainingTime`/`remainingMinutes`) zodat niets drift. Een voortgangsbewerking is géén duurbewerking
(de poort is de totale werkduur). Verandert het restwerk van een toewijzing mét contour, dan zakt de
contourhoogte mee (`reconcileContourWork`, "vorm blijft, hoogte zakt"). Materiaalresources sturen
de duur nooit. Een **kalenderwissel** (taak-/projectkalender of andere uren per dag in een kalender)
verandert de slotgrootte en loopt daarna óók door de regel (`applySlotChange`/`settleCalendarChange`:
Vast werk/Vaste inzet ⇒ duur; Vaste duur en werk ⇒ inzet; standaard ⇒ werk volgt, byte-identiek);
de contour-as herschaalt daarbij van de oude naar de nieuwe werkminuten (ook zonder dagverandering),
en een project-/kalenderwijziging die duren verandert meldt hoeveel (`notifyWorkRuleDurationsChanged`).
Alle aanroepers delen `captureCalendarChange` → mutatie → `settleCalendarChange` (store, raster — als
EIGEN stap vóór de rest van de paste —, MCP-tweeling, projectkalender, kalenderinhoud, en de hele
bibliotheek via `captureCalendarLibraryChange`/`settleCalendarLibraryChange` in `state/calendarTasks.ts`:
`commitCalendarLibrary` — de kalenderdialoog, dé UI-route voor uren per dag — en `removeCalendar`); de contour-
hoogte wordt daarin tegen het werkelijke werk per toewijzing verzoend, niet tegen een regelvlag.
Drie randpaden die de slot óók kunnen wijzigen (`setCalendar`, `resolveDeviation`, de `workTime`-
verwijdering in de MCP-kalendertool) zijn bewust NIET bedraad — zie `docs/TODO.md`. Een
duurbewerking op een taak met EXPLICIETE restduur schuift die rest mee met Δ, geklemd op 0
(`carryRemainingThroughDurationEdit`). Schrijft de brug de rest expliciet — Δ-regel of kalenderwissel
op een gestarte taak — dan volgt `completion` daaruit als 1 − rest ÷ duur (`syncCompletionToRemaining`,
dezelfde formule als een restbewerking in het raster; eigenaarsbesluit 2026-09-06), zodat Gantt-balk,
solver en rapportage één waarheid delen — eigenaarsbesluiten 2026-09-05/06, spec §6.4/§6.5, meetlat
32–36. Regressie: `tests/planning/check-work-triangle.ts` (kern + meetlat
`work-triangle-cases.json`), `check-work-rule-mapping.ts` (MSP/P6/XER-vertaling) en
`check-work-rule-store.ts` (store/raster/MCP). Via de MCP-bridge: `planner_update_tasks`/`planner_add_tasks`
`fields.workRule`, `planner_manage_assignments` `update.remainingWorkMinutes` en `planner_update_project`
`defaultWorkRule` (`tests/mcp/cases-work-rule.ts`). UI: zichtbaar wanneer de instelling **Toon
taaktypes** (`ui.showTaskTypes`, `ops-showTaskTypes`, default uit) aan staat óf het document zelf
taaktypedata draagt (`taskTypesVisible` in `DOCUMENT_FIELDS`, afgeleid bij laden via
`hasTaskTypeData`, met één melding per document — `taskTypesNotice.ts`); selector `taskTypesUnlocked`
(`src/state/taskTypesVisibility.ts`). Dan: `TaskWorkRuleField` in paneel en dialoog, de kolom
**Werk (rest)** met slotjes in `TaskAssignmentsSection`, en de rasterkolommen `task.workRule` en
`assignment.remainingWork` (alleen `available` wanneer ontsloten; `TaskColumnContext.taskTypesUnlocked`).
Gids: `public/docs/{nl,en}/gids-taaktypes.md`; browserspec `tests/browser/work-rule.spec.ts`. `src/services/contourIo.ts` is de adapterlaag:
MSPDI `<TimephasedData>` (Type 1/2, per werkdag) en P6 `<ResourceCurve>` + `<ResourceCurveObjectId>`
+ de `PlannedCurve`/`RemainingCurve`/`ActualCurve`-spreidingsstrings (`"werkuren:periodeuren;…"`,
MPXJ `TimephasedHelper`) round-trippen daar doorheen — let op: P6's `<PlannedCurve>` is dus GEEN
curvenaam (dat was een fout van de vroegere writer; de lezer accepteert die naamvorm nog als compat).
De IFC-lezer regenereert resource-ids en mapt `contour.resourceId` daarom via `ifcGuid(oudeId)` terug
(`remapContourResourceIds`). Bewerken in de UI (etappe contour-UI + fasen-editor): `ContourDialog.tsx`
achter de knop **Urenverdeling…** per toewijzing in `TaskAssignmentsSection` — in FASEN (aaneengesloten
werkdagen met één inzet, `src/engine/contour/contourPhases.ts`: run-length over de werkdagslots,
splitsen/samenvoegen/grens/inzet), als sleepbare SVG-strook (`ContourPhaseStrip.tsx`, in het venster,
dus buiten de Gantt-renderergrenzen) én als tabel; vorm-als-data, toepassen/loslaten — op het pure
bewerkmodel `contourEdit.ts` (dagslots ↔ periodes met gat-herinvoeging; de OPSLAGvorm blijft één periode
per werkdag) en de store-actie `resourceSlice.setAssignmentContour` (undo, `isDirty`, GEEN
`scheduleStale`: een contour raakt geen datum en maakt geen split; een 0-inzet-fase blijft binnen de duur;
een aanwezig werkveld van de toewijzing volgt de contoursom, `syncAssignmentWorkToContour`).
Dagenlijst via `ResourceLoad.ts`'s `taskWorkDayIsos` — dezelfde als het histogram. Regressie:
`tests/planning/check-contour-engine.ts` en `tests/browser/contour-dialog.spec.ts`; gidsen:
`public/docs/{nl,en}/gids-msproject-import.md` §"Gecontoureerde toewijzingen" en
`gids-resources-histogram.md` §"De urenverdeling zelf bewerken".

### Rendering: Gantt-tijdlijn in Canvas 2D, taakraster in de DOM

De Gantt-tijdlijn wordt imperatief op een `<canvas>` getekend via `src/engine/renderer/` (`GanttRenderer`): balken, relaties, tijdschaal en hit-testing horen daar. De taakrijen links van de tijdlijn zijn juist het gedeelde DOM-raster `FullTaskGrid`, via `GanttTaskGrid`; het volledige lint-tabblad **Tabel** gebruikt dezelfde kern. `TableEditor` is alleen nog een compatibiliteitsexport naar `FullTaskGrid` en heeft geen eigen structurele verantwoordelijkheid. React beheert daarnaast de omringende chrome, panelen en dialogen.

### Rapporten: één kolomspec voor DOM én PDF

Het Rapport-tabblad (`ReportPanel.tsx`) kent elf rapporttypen (`ReportType` in
`src/utils/reportSettings.ts`): de Gantt-afdruk (Canvas → raster/vector-PDF), het **resourcediagram**
(issue #113: dezelfde Gantt-render met als rijenbron `computeResourceGanttRows` uit
`src/engine/reports/resourceGantt.ts` — per resource-IDENTITEIT een band (niet per naam, zoals de
schermgroepering: gelijknamigen krijgen `#n`, naamlozen een surrogaat), daaronder zijn bladtaken op
start; relaties staan bij dit type uit omdat een taak onder meerdere banden kan staan, en het vinkje
*Kritiek pad* is er verborgen en geforceerd aan (`reportTypeShowsCriticalToggle`: het vinkje kleurt alleen
relatielijnen en legendaregel, de balken volgen `barColorSelection` via `criticalFill`); optie "blad
per resource" = `PrintOptions.pageBreakBeforeGroups`
→ `RenderReportResult.forcedBreakOffsets` → `forcedBreakOffsetsPx` in `tileLayout`, waar een gedwongen
positie zonder vulgraaddrempel wint — een band direct onder een band (de optionele typelaag
`groupByType`: eerst een band per resourcetype in de vaste volgorde `RESOURCE_TYPE_BAND_ORDER`) krijgt
geen eigen gedwongen positie; optie *Rapportageperiode* = de gedeelde `ReportingPeriod` als
`PrintOptions.timeWindow` (tijdas exact op het venster, geometrie geklemd op het chartgebied want
`Draw2D` kent geen clip; de rijenbron filtert op overlap en telt `counts.outsidePeriod`); optie
*Eenheden/dag en curve tonen* = `PrintOptions.assignmentColumns` + `rowAssignments` (per `rowKey`
uit `assignmentByRowKey`: eenheden opgeteld, curve alleen bij eensluidende records) als twee
tabelkolommen achter de naam; `isGanttReportType()` bundelt beide Gantt-achtige typen; de voet
met legenda is sinds #113 net als de kop een herhaalbaar blok — `RenderReportResult.footerHeight` →
`repeatFooterHeightPx`/`repeatFooter`, instelling `repeatFooter` standaard aan; let op: de preview
rendert per pagina één volledige `renderReport`-pass extra voor die strook, net als voor de kop), het
mijlpalen- en variance-rapport (eigen DOM-component + `build*Columns` voor de PDF) en zeven **tabelrapporten**
uit discussie #31 — look-ahead, kritiek/near-critical, voortgang, planningsgezondheid,
resourcebelasting (per week of maand), resourcetoewijzingen en WBS-samenvatting. Die zeven hebben
een pure rekenlaag in `src/engine/reports/` (één `ReportContext` in, rijen met rauwe waarden uit;
headless getest in `tests/planning/check-reports.ts`) en één presentatielaag: `useTableReportSpec.tsx` bouwt
per type een `TableReportSpec` (titel, meldingen, samenvatting, secties met een `ReportColumn`-
lijst), `TableReportView.tsx` tekent daar de `<table>`s uit en `makeSectionedRenderReport`
(`pdfTable.ts`) de vector-PDF — dezelfde kolomspec, dus DOM en PDF kunnen niet uit elkaar lopen.
Nieuw tabelrapport ⇒ engine-module, een `build*`-functie in `useTableReportSpec`, opties in
`TableReportOptions` + `TableReportOptionsBlock`, sleutels onder `tableReports.*` in alle 14
`report.json`-locales, en een sectie in `gids-rapporten-printen.md` (nl+en). Rapporten met een
tijdvenster (look-ahead, voortgang, belasting, toewijzingen) delen de **rapportageperiode** (issue
#120): een `ReportingPeriod` (preset rond de statusdatum, `project` of `custom` met twee ISO-dagen)
uit `src/engine/reports/reportingPeriod.ts`, per rapport opgeslagen in `TableReportOptions`, in de
UI het gedeelde `ReportingPeriodField`, en in de engine opgelost via `resolvePeriodFor(ctx, period)`
— nooit een eigen weken-getal erbij bouwen.

**Kolombreedtes zijn gemeten, niet vast.** De datakolommen van de Gantt-/resourcediagram-tabel (WBS,
Duur, Start, Einde, Volt., Eenh./d) worden — net als de naam- en de curvekolom — door `ReportPanel`
op de echte koppen én cellen van dít rapport gemeten (`measureTableColumnWidths`) en via
`PrintOptions.columnWidths` doorgegeven; zonder meting gelden de oude vaste breedtes uit `COL`, dus
elk pad zonder canvas blijft byte-identiek. Meten hoort in het paneel en niet in de printlaag:
`measurePrintReport` (paginering) heeft geen canvas en zou anders een ándere tabelbreedte uitrekenen
dan de raster- en vector-render. De celteksten komen daarbij uit één bron (`taskTableCellTexts`) die
de render óók gebruikt — anders meet je "Duur" en teken je iets anders. Bij de tabelrapporten doet
`fitColumnsToHeaders` (`pdfTable.ts`) hetzelfde voor de PDF, maar **alleen verbreden**: een kolom die
haar eigen vertaalde kop niet kwijt kan groeit mee, versmallen niet — `mode: 'fit-width'` schaalt een
smallere tabel juist gróter, en celinhoud hoort in een vrije-tekstkolom wél af te kappen.

### State: één Zustand + Immer store, samengesteld uit slices

`src/state/appStore.ts` is een compositie-root: `create<AppState>()(immer(...))` combineert de slice-creators uit `src/state/slices/` plus de gridtransactieslice. Elke slice is getypeerd als `AppSlice<XSlice>` (zie `slices/types.ts`) tegen de **volledige** `AppState`, zodat cross-slice acties (runCPM, undo/redo, newProject, file-I/O) gewoon de hele Immer-draft muteren. Nieuwe state/acties horen in de passende slice; `slices/types.ts` bevat daarnaast gedeelde type/enum-definities (`ViewState`, `UIState`, …). Domain-types staan in `src/types/`. De renderer leest alleen uit de store.

De gemounte productinterface gebruikt bewust exact één `appStoreContext`; React-componenten blijven
die app-singleton atomisch lezen via `useAppStore(selector)`. Dezelfde compositie-root kan voor
headless code en isolatietests wel onafhankelijke contexten maken met `createAppStoreContext()`.
Ownership is daarbij expliciet:

| oppervlak | eigenaar |
|---|---|
| React UI-selectors en de gemounte productinterface | `useAppStore` / `appStoreContext` |
| documentstate, undo/redo en niet-documentaire state binnen één context | `AppStoreContext.store` |
| undo-coalescing, batchdiepte, MCP-lease en timephased-verliestelling | `AppStoreContext.runtime` |
| batch-, MCP- en extensie-`data.*`-uitvoering | de expliciet meegegeven documentcontext |
| extensie-ribbon/importers/cleanup en notificaties | de expliciet geïnjecteerde app-hostbinding |
| app-lifecycleregistries zoals extensie-instanties, eventbus, PDF-fontproviders en SDK-windowbinding | app-globaal |
| `batchTransaction.ts` en `mcpTransaction.ts` | dunne compatibiliteitsadapters die alleen `appStoreContext` binden |

Core runtimefactories en storegebonden MCP-tools mogen daarom nooit zelf `useAppStore` of
`appStoreContext` importeren. `npm run verify:store-boundaries` bewaakt die grens mechanisch. Een
tweede context is een correct headless/testfundament, geen productbelofte voor multi-window of een
multi-store-Reactinterface.

Multi-document is **single-active**: het actieve document leeft op top-level (project/tasks/sequences/… zoals altijd), zodat alle slices, componenten en de renderer single-document blijven. `documentSlice` bewaart de overige geopende documenten als losse `DocumentPayload`-snapshots en swapt top-level ↔ payload bij `switchDocument`/`newDocument`/`closeDocument`. Per-document: project, kalender, taken/relaties/resources/toewijzingen, selectie, `cpmResult`, `view`, `collapsedTaskIds`, `filePath` en `isDirty`. De undo/redo-opslag is geen stapel in iedere payload maar één niet-gepersisteerde sessiechronologie binnen de appcontext (`historyEvents`/`nextHistorySequence`); undo en redo kiezen daaruit het toepasselijke event voor het actieve document of de betreffende gridsurface. Ook de rest van `ui`, `taskClipboard` en de taakgridvoorkeuren is appcontext-globaal en wordt niet met een document geswapt. Er is altijd minstens één document; het laatste sluiten reset naar een leeg document. De document-chrome-UI staat in `src/components/layout/DocumentChrome/`: `DocumentTabBar`, `ProjectRail` en `SwitcherPill` zijn drie instelbare stijlen (`ui.documentChromeStyle` ∈ `'tabs' | 'rail' | 'switcher'`, persistent), plus een `ProjectOverview`-overlay en `CloseDocumentDialog` met 3-weg sluitbevestiging (opslaan/niet opslaan/annuleren); Ctrl/⌘ 1–9 springt naar het n-de document. `openFile`/`openRecentFile` openen in een **nieuw** document tenzij het actieve tabblad nog leeg en ongewijzigd is (`isActivePristine` in `fileSlice`); "Nieuw" opent de projectwizard (`ProjectInfoDialog` met kalender-presets en faseringssjablonen, via `ui.showNewProjectDialog`) in plaats van een kaal `newProject()`.

Scheduling is **manual, not reactive**: the actual solve — leaf-filter → `CPMSolver` (which owns `CalendarEngine`) → write computed fields (early/late dates, total float, critical-path flag) back onto the tasks — lives in `solveProject()` (`src/engine/scheduler/solveProject.ts`), extracted from `runCPM` in A3/M3 so it has exactly one implementation. The `runCPM` action (`scheduleSlice.ts`) is a thin wrapper: it calls `solveProject` directly on the Immer draft (`s.tasks` mutated in place), then sets `cpmResult`/`resourceLoadResult` and clears `scheduleStale`. It does not re-run on every edit — triggered explicitly by F5, the ribbon **Calculate** button, the menu, and after an IFC load. Editing tasks without calling `runCPM` leaves the schedule stale, so call it after mutating tasks/sequences/calendar. The same `solveProject` also powers the resource-occupancy overview (see *Resourcebibliotheken* below): opening the overview runs it there on a **clone** (`cloneTasksForSolve`) of a stale, non-active document's tasks — ephemeral, no write-back. Is **Automatisch berekenen** aan, dan gebeurt dat efemere doorrekenen nog steeds, en draait `documentSlice`'s `recalculateStaleSleepingDocuments()` er **daarnaast** overheen: die rekent óók op een kloon van de payload-taken en schrijft juist díé kloon terug (no undo snapshot, mirroring `runCPM`'s semantics). Die kloon is geen detail maar de atomiciteitsgarantie — de payload blijft onaangeraakt tot de solve slaagt, zodat een cyclus niets halfs achterlaat. Het actieve document blijft buiten die actie en houdt zijn eigen pad via `useAutoCalcCPM`.

**Datums zoals opgeslagen (issue #63).** Het laden herberekent nog steeds onvoorwaardelijk — die solve ís de detectie — maar de uitkomst kan bewust worden teruggedraaid. Wijkt het rekenresultaat af van wat het bestand vastlegde, dan biedt `RecordedDatesNotice` aan de opgeslagen datums te tonen; `showRecordedDates()` zet ze terug en reconstrueert `cpmResult` uit het bestand via `src/engine/scheduler/recordedDates.ts`, zónder te solven. Drie gevolgen die je moet kennen voor je hier iets aanraakt: (1) `runCPM` pusht in déze ene situatie wél een undo-snapshot — buiten de modus geldt de oude invariant onverkort, waar `staleGuard`/`batchTool` op leunen; (2) `scheduleStale` mag nooit `true` zijn terwijl `datesAsRecorded` aanstaat, want in de modus staat het bestand op het scherm en niet een berekening — zet de vlag daarom via `markScheduleStale` (`state/transaction.ts`) en nooit rechtstreeks, wat een broncode-check in `check-recorded-dates.ts` afdwingt; (3) `parseDateFromIFC` maakt van een `$`-slot de datum van vandaag, dus "welke datums gaf het bestand écht" komt uit `ImportResult.recordedFields` en niet uit de gelezen taakvelden.

**Het documentcontract — lees dit vóór je een veld aan de state toevoegt.** Naast de slices staan er in `src/state/` vier modules die samen bepalen wat een "document" ís. Ze bestaan omdat deze afspraken eerder ~50× met de hand herhaald werden en dan stilzwijgend uit elkaar liepen:

| module | rol |
|---|---|
| `documentContract.ts` | `DOCUMENT_FIELDS` — één descriptorlijst met per veld: waar het in de live state woont (`get`/`set`), de verse default (`fresh`), de rol in de undo-snapshot (`clone`/`ref`/`none`), en optioneel een leesmigratie. `capturePayload`/`hydratePayload`/`freshPayload` lopen key-gedreven over die ene lijst, dus capture en hydrate kúnnen niet divergeren. Een nieuw veld in `DocumentPayload` dat de lijst mist geeft een **compile-fout**. |
| `snapshot.ts` | de undo/redo-snapshot als expliciete `Pick<>`-subset van datzelfde contract, gestuurd door de `snapshot`-rol per veld. |
| `transaction.ts` | het muteer-ritueel (snapshot pushen, redo leegmaken, `isDirty`/`scheduleStale` zetten) op één plek in plaats van per actie. |
| `ifcSaveInput.ts` | welke velden een IFC-save meeschrijft — precies de round-trip-velden van het contract, zodat alle callsites (opslaan, auto-save, IFCPanel, devBridge) dezelfde bron doorgeven. |
| `defaults.ts` | de `fresh`-fabrieken (`createDefaultProject`/`createDefaultView`) als **bladmodule**: hij importeert niets uit `slices/`. Dat is geen stijlkeuze — stonden ze in hun slice, dan ontstaat de cyclus `projectSlice → transaction → snapshot → documentContract → projectSlice`, die alleen werkt zolang het function *declarations* zijn (hoisting). `npm run verify:cycles` bewaakt dat. |

Voeg je projectdata toe, dan hoort die dus in `DOCUMENT_FIELDS` — anders overleeft hij geen documentwissel, geen undo, geen crashherstel en geen opslaan. `tests/planning/check-document-contract.ts` bewaakt de keten.

### Ribbon-driven UI

The shell is a Microsoft Office-style ribbon (`src/components/layout/Ribbon`) plus a Backstage view (`src/components/backstage/`) for File. De bron van beide lijsten is `slices/types.ts`, niet deze alinea — `npm run verify:docs` faalt als ze uit elkaar lopen.

Tabbladen (`RibbonTab`): `file`, `start`, `planning`, `resources`, `beeld`, `instellingen`, `table`, `ifc`, `report`, `ai` — die laatste verschijnt alleen als `ui.aiMode` aan staat. Relatieacties staan als dropdown in de taakgroepen van Start, Planning en Tabel; er is geen afzonderlijk Relaties-tabblad.

Backstage-secties (`BackstageSection`): `recent`, `examples`, `export`, `import`, `print`, `project-info`, `settings`, `extensions`, `library`, `help` — waarvan `help` een compleet documentatiesubsysteem is (zie *In-app documentatie & wiki* hieronder).

The active tab is in `ui.activeRibbonTab`. De rechterrail bevat conditioneel `TaskPropertiesPanel` en de compacte `ResourcePanelCompact` (samen de stapel met sleepgrens), daaronder het `WarningsPanel` (issue #53: alle waarschuwingen uit `cpmResult`/`resourceLoadResult` via de pure `collectScheduleWarnings`, klik navigeert via `revealScheduleWarning`; `ui.showWarningsPanel`, sessie); `DebugTerminal` en `AIActivityPanel` kunnen daaronder verschijnen. De volledige Tabel-, Resource-, IFC- en Rapportweergaven zijn werkruimtes en geen rechterpanelen. De rail gebruikt `ui.rightPanelCollapsed` / `ui.rightPanelWidth`. Global dialogs (`UpdateDialog`, `JustUpdatedDialog`, `FeedbackDialog` + `ScreenshotAnnotator`, `ProjectInfoDialog`, `LibraryLinkDialog`, `CloseDocumentDialog`) mount from `App.tsx` behind `ui.show*` flags. De gedeelde `Dialog` heeft een focus-trap (Tab/Shift+Tab blijven in de modal); dialogen die elkaar zouden overlappen worden geweerd via een gedeelde guard (`hasBlockingDialogOpen`). Gebruikerzichtbare meldingen lopen sinds K8a via **één** kanaal, gevoed vanuit de store — geen losse `alert()`/ad-hoc toasts erbij bouwen.

### Tekstgroottes: zes rollen, één bron

De interface kent precies zes absolute tekstgroottes (plus relatieve afleidingen daarvan), gedefinieerd in het `@theme static`-blok van `src/styles/globals.css`: `caption` 9 · `small` 10 · `body` 11 · `large` 12 · `heading` 14 · `title` 20 (px × `--ui-font-scale`, dus elke rol volgt de instelling `ui.uiFontScale` vanzelf). In klassen schrijf je `text-body` (met `!` waar een `.input`/`.btn`-regel overstemd moet worden), in losse CSS `font-size: var(--text-body)`. `--text-*: initial` heeft Tailwinds eigen schaal verwijderd: `text-xs`/`text-sm`/… bestaan niet meer en zouden stil níéts doen. Een rol is alleen een grootte — regelhoogte zet je zelf met `leading-*` (de omgezette `text-xs`/`text-sm`-plekken dragen daarom `leading-4`/`leading-5`). De `13px` op `html` is geen rol maar de rem-basis waar Tailwinds spacing aan hangt; `body` erft `large`. Relatieve maten (`em`, `%`) mogen, want die erven van een rol — de enige in gebruik is `.help-inline-code` (`0.85em`, zodat inline code met kop of alinea meegroeit). `npm run verify:text-roles` (onderdeel van `verify`) keurt de gangbare schrijfwijzen van een absolute maat in `src/` af (CSS-`font-size` via een witte lijst, `font`-shorthand, `@apply`, `text-[…]`, Tailwinds eigen schaal, `fontSize`/`setProperty`/`cssText`); wat hij níét ziet — `fontSize: n` met een variabele, HTML-strings — vangt `tests/browser/text-roles.spec.ts` op de oppervlakken die die test bezoekt (computed font-size op 100% en 125%); Canvas-/PDF-/printtekst (`src/engine/`, `src/services/`) en SVG-`fontSize={n}` vallen erbuiten, en een bewuste uitzondering krijgt op de regel zelf `text-roles: <reden>`. Een zevende rol toevoegen is een ontwerpbesluit, geen gemak: de poort kent de lijst en faalt op een onbekende `var(--text-…)`; het recept staat in `docs/recepten/tekstgrootte.md`.

### i18n

Fourteen locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`) via `react-i18next`, configured in `src/i18n/config.ts`; each locale has four namespaces (`common`, `task`, `report`, `menu`). Alleen Engels wordt eager geladen; de rest komt lazy binnen via `loadLocale()` (Vite splitst per taal een eigen async chunk), dus vertalingen zijn niet synchroon beschikbaar direct na een taalwissel. `ar` and `fa` are RTL — `RTL_LOCALES` drives `document.documentElement.dir`. i18n initializes and falls back to **English** (`lng`/`fallbackLng: 'en'`); on startup `initLocale()` picks the saved preference, otherwise the OS/browser locale — it is not hard-defaulted to one language. The project's *working* language is Dutch, though: code comments, commit messages, and the canonical source translations are Dutch. Always go through `t(...)`; never hard-code visible text.

`npm run verify:i18n` (onderdeel van `npm run verify`) bewaakt dat iedere reeds als meervoudfamilie vastgelegde sleutel per locale de juiste **CLDR-pluralcategorieën** heeft, niet alleen letterlijk dezelfde suffixen als `nl`: `zh`/`ja`/`ko` kennen geen `one`, terwijl `pl` (`few`/`many`) en `es`/`fr`/`it`/`pt` (`many`) extra categorieën eisen. De algemene controle leidt echter niet uit een kale aanroep `t(key, { count })` af dat een nog ongesufficete vertaalsleutel een familie moet worden; domeinchecks moeten dat gebruik expliciet bewaken. Voor de taakgrid-registerlabels doet `check-task-grid-i18n.ts` dat door de echte count-aanroepen te inventariseren en de exacte `Intl.PluralRules`-categorieën per locale te eisen. Een ontbrekende pluralvorm valt in i18next **niet** terug op `_other` maar op het Engels — dus een gat is zichtbare taalvervuiling, geen cosmetiek. Voor `es`/`fr`/`it`/`pt` is `_many` (alleen 1.000.000, 2.000.000, …) in dit project gelijk aan `_other`, omdat `{{count}}` altijd in cijfers wordt weergegeven en niet in compacte vorm.

### Settings persistence

`src/utils/settingsStore.ts` persists settings to `localStorage` only, under `ops-`-prefixed keys — it does **not** use `@tauri-apps/plugin-store` (that package is a dependency but unused here). De **load**-kant loopt declaratief via `src/utils/settingsRegistry.ts`: één descriptor per instelling (localStorage-sleutel → validator/parser → doelveld in `UIState`), naar het `SHORTCUTS`-patroon. Een nieuwe instelling toevoegen = één entry daar, eventueel een dunne `saveX`-wrapper in `settingsStore.ts`, plus de gedeelde UI. Drie bewuste afwijkers worden expliciet in `loadAllSettings()` afgehandeld: thema (`initTheme()` migreert legacy-namen, persisteert de conversie en levert áltijd een voorkeur; `useResolvedUITheme()` zet de extra voorkeur `system` live om naar Light/Dark voor DOM en Canvas), bouwmodus (synchroon, want de kalenderfabriek leest 'm direct) en balkkleurkeuze (`barColorSelection`, één objectkeuze met legacy-migratie uit twee oude instellingen). `UI_THEMES` bevat bewust alleen de drie handmatig kiesbare thema's; de pre-paintspiegel in `index.html` resolveert `system` al vóór React. Sleutels die buiten de opstart-hydratatie lazy laden (layouts, workTimePresets, welcomeSeen, locale) staan bewust níét in het register. Settings-UI-conventie: elke instelling moet op alle drie de plekken verschijnen — tandwiel-popup (⚙), Instellingen-ribbontab en Backstage → Instellingen — door één gedeeld component te gebruiken (`src/components/settings/SettingsPanelContent`). Op het tabblad Toepassing staat sinds 2026-09 naast Benchmark de knop **Statistieken…** (`ui.showStatsDialog` → `StatsDialog.tsx` met `DownloadStatsSection.tsx`; bewust een knop en geen eigen tabblad, de gemiddelde gebruiker heeft er niets aan): geen instelling maar een leesweergave van `downloads.json` op de `stats`-databranch (`src/services/stats/downloadStats.ts`, 30 min cache in `ops-downloadStats`, in-flight-dedupe, verlopen cache als terugval bij een netwerkfout) — dezelfde drie ingangen, nooit een GitHub-API-call vanuit de app. Regressie: `tests/planning/check-download-stats.ts` en `tests/browser/settings-stats.spec.ts`.

Separately, project **auto-save** draait zowel in Tauri als in de browser: een store-subscription (`src/hooks/useAutoSave.ts`, **gethrottled op 10 s** — bewust een throttle en geen debounce, want een debounce schrijft pas 10 s ná de láátste wijziging en vergroot dus juist het dataverliesvenster tijdens een lange bewerksessie) schrijft per open document één IFC-snapshot naar een gedeelde backend (`src/services/recovery/recoveryStore.ts` — Tauri: `appDataDir` via `plugin-fs`; web: IndexedDB) als `recovery[.<slug>].<docId>.ifc` plus een `recovery[.<slug>].documents.json`-manifest, met opruimen van verouderde snapshots, hersteld bij de volgende start. De oude enkele `recovery[.<slug>].ifc` wordt alleen nog als legacy-fallback gelezen. Dat crashherstel staat los van de runtime-only keuze **Automatisch opslaan** per document: `src/services/actualAutosave/` schrijft uitsluitend een gewijzigd, al bestaand `FileRef` terug op dezelfde 10-seconden-throttle, zonder dialoog, downloadfallback of browser-permissieprompt. Een nieuw document of een browserhandle zonder bestaand schrijfrecht kan dus nooit stil overschreven worden; uitzetten stopt alleen die bestandswrite, niet het crashherstel.

### Auto-update & releases

Versies zijn CalVer (`YYYY.M.patch`), gelijkgehouden tussen `package.json` en `src-tauri/tauri.conf.json` via `npm run bump` (`Cargo.toml` blijft bewust `0.1.0`). De volledige runbook staat in de **`release`-skill** (`.claude/skills/release/`) — draai die bij een release in plaats van de stappen los te herhalen; een `v*`-tag is onomkeerbaar en auto-update naar alle gebruikers. Release-flow in het kort: `npm run bump <versie>` → **releasetekst schrijven in `docs/release-notes/v<versie>.md`** → commit → tag `v*` → push; `release.yml` bouwt en signeert installers (Windows via Azure Trusted Signing; macOS universal, met `app`-target voor de updater) en publiceert `latest.json`; `snap.yml` verpakt daarna de release-`.deb` tot Snap (`snap/snapcraft.yaml`) en publiceert 'm — sinds 2026-07-30, met het secret `SNAPCRAFT_STORE_CREDENTIALS` (zie `docs/release-secrets.md`) — ook automatisch naar het `stable`-kanaal van de Snap Store; dat gebeurt bij elke `v*`-tag en is, net als de rest van een release, onomkeerbaar. De in-app updater checkt stil bij het opstarten (`App.tsx` → `updaterService`, `UpdateDialog`): endpoint is de GitHub-release-`latest.json`, geverifieerd met de minisign-pubkey in `tauri.conf.json`; Snap/AppImage-installs slaan de updater over (detectie via het `install_kind`-command). Ná een geslaagde update toont `JustUpdatedDialog` één keer wat er nieuw is: `ui.justUpdated` wordt gezet door de versievergelijking tegen de bewaarde `ops-lastVersion`, en `src/services/updater/releaseInfo.ts` haalt de release-omschrijving, het grootteverschil en de tijd tussen releases op bij de GitHub Releases-API (pure functies, headless getest in `tests/planning/check-just-updated.ts`).

De webbuild levert daarnaast `public/release-highlights.json` mee — gegenereerd uit de catalogus met `npm run gen:release-highlights-json`, bewaakt door `npm run verify:release-highlights-json` en geserveerd op `https://open-planner-studio.open-aec.com/release-highlights.json` als bron voor de releasetijdlijn op open-aec.com.

**Releaseteksten hebben één bron.** `docs/release-notes/v<versie>.md` bevat alleen de "What's New"-inhoud; `scripts/release-notes.mjs` maakt daar de twee vormen van die de release nodig heeft: `--format=body` (markdown + het vaste Downloads-blok) voor de GitHub-releasepagina, en `--format=notes` (platte tekst — de updater-dialoog rendert geen markdown) voor het `notes`-veld in `latest.json`. `release.yml` roept dat op twee plekken aan: `create-release` voor de body, en `publish-release` voor `latest.json` vlak vóór publicatie. Ontbreekt het bestand, dan valt alles terug op het oude gedrag (generieke body, leeg `notes`-veld) en logt de gate een warning — een vergeten notesbestand breekt de release niet.

### Extensiesysteem

Naar het model van Open Calc Studio (`OpenAEC-Foundation/open-calc-studio`): een extensie is een ZIP (of los `.js`) met `manifest.json` + `main.js` (CommonJS, exporteert `onLoad(api)`/`onUnload()`). Volledig frontend — geen Rust. Code in `src/extensions/` (types, api, loader, service), state in `extensionSlice`. Opslag: IndexedDB `ops-extensions`; uitvoering: `new Function(...)`-sandbox waarvan `require()` alleen `'open-planner-studio'` teruggeeft; permissies (`ribbon`, `events`, …) worden per API-call afgedwongen. UI: Backstage → Extensies (beheer/installeren/catalogus) en Backstage → Importeren (extensie-importers); extensie-ribbon-knoppen renderen via `ExtensionRibbonGroups`. Catalogus: `open-planner-studio-extensions/catalog.json` op GitHub raw (30 min cache). Extensies zijn app-niveau data (geen projectdata) — geen IFC-round-trip-impact; importer-resultaten (`ImportResult`) zijn gewone store-data. Zelftest-haken: `window.__OPS__.extensions.*` (dev-only). Auteurshandleiding: `docs/extensions.md`.

### AI-assistent (MCP-bridge) — Tauri-only, protocol in TypeScript

Een externe AI-client (Claude Code e.d.) kan de app aansturen via MCP. De verdeling spiegelt de
rest van de architectuur: **Rust is een dom doorgeefluik, alle logica is TS.**
`src-tauri/src/mcp_bridge.rs` bindt een `tiny_http`-server op uitsluitend `127.0.0.1:<poort>`,
bewaakt een Bearer-token, weigert elk request met een `Origin`-header (DNS-rebinding-bescherming),
serialiseert requests strikt één-voor-één en forwardt de body als Tauri-event `mcp://request` naar
de webview; het antwoord komt terug via `mcp://response` (id-correlatie), status via `mcp://status`.
Het kent niets van MCP of JSON-RPC.

De hele protocol- en toollaag zit in `src/services/mcp/`: `server.ts` (levenscyclus, token, event-
bedrading — álle `@tauri-apps/*`-imports dynamisch achter `isTauri()`, zodat de web-build blijft
bouwen), `dispatcher.ts`, `schemaValidate.ts` (schema's worden in de dispatcher afgedwongen, óók
binnen `planner_batch` — een draaiboek mag de poort niet omzeilen), `toolRegistry.ts`/`toolIndex.ts`,
`staleGuard.ts` (`ensureFreshSchedule`), `backup.ts` (AI-backups per document in `appDataDir`,
`MAX_PER_DOC = 10`) en `activityLog.ts` (ring-buffer achter het AI-activiteitenpaneel). De 41
`planner_*`-tools staan in `src/services/mcp/tools/` (taken, relaties, resources, kalender, project,
baselines, documenten/bestanden, leestools, XER/P6-bronprovenance, en `planner_batch` als
transactionele executor met temp-id-resolutie).

Veiligheid is state, geen conventie: `ui.aiMode` (de hele AI-tab en bridge verschijnen pas hierdoor),
`ui.aiPaused`, `ui.aiReadOnly` en `ui.aiServerStatus` leven in `uiSlice`; de per-request `McpContext`
leest ze live, plus een drift-anker (`expectedDocId`) zodat een tool nooit op het verkeerde document
landt. Instellingen staan onder de bekende `ops-`-prefix (`ops-aiMode`, `ops-aiAutostart` — default
**uit**, want een luisterende poort openen is een bewuste keuze —, `ops-aiAutoBackup`, `ops-mcpPort`,
`ops-mcpToken`); `src/hooks/useAiAutostart.ts` start de bridge desgewenst mee met de app, eenmalig
per app-sessie zodat een handmatige stop niet stil ongedaan wordt gemaakt.

De kern-bouwstenen nemen hun Tauri-randen als injecteerbare functies, zodat alles headless testbaar
is — zie `tests/mcp/`. Nieuwe tool ⇒ contract in `contracts.ts`, schema erbij, registreren in
`toolRegistry.ts`, en een case in `tests/mcp/`; zie `docs/recepten/mcp-tool.md` voor de volledige
route. `tests/mcp/cases-toolregistry.ts` is het mechanische vangnet dat een vergeten registratie
(of een spookregistratie zonder broncode) mechanisch afvangt.

### Resourcebibliotheken

De bibliotheek (`librarySlice`) is app-globaal, net als extensies — niet per-document geswapt.
Persistentie via een `isTauri()`-gesplitste `libraryStore`: IndexedDB `ops-library` in de browser,
`ops-library.json` in `appDataDir` op desktop. Herkomststempels en bibliotheekbinding round-trippen
door het project-IFC via het bestaande `OPS_`-pset-patroon. De **bibliotheek is de bron** met de
volledige resource-editor; het project toont de inzet, en toewijzen vanuit de bibliotheek *is*
materialiseren (geen los "kopiëren"/"bijwerken-uit"). De Resources-tab kent daarom een
Bibliotheek- en een Projectweergave, met markeringen voor *wijkt af* / *niet meer in de bibliotheek*
en een gedeelde `LibraryLinkDialog` voor koppelen en afwijkingen. Let op de terminologie: code en
IFC gebruiken nog `companyId`/`companyName`, de **gebruikersterm is "resourcebibliotheek"** —
"bedrijf" alleen waar het echt over de organisatie gaat. Zie `docs/library.md`.

Een derde weergave op de Resources-tab (B1b) is **Bezetting**: per bibliotheekitem de boeking over
**alle geopende documenten** die aan dezelfde bibliotheek gekoppeld zijn, met de bedrijfscapaciteit
als grens — dubbelbezetting tussen projecten, die geen los project kan zien. De kern is
`computeLibraryOccupancy` (`src/services/library/occupancy.ts`), puur en headless getest
(`tests/library/check-occupancy.ts`); de weergave is `src/components/panels/ResourceOccupancyView.tsx`.
Een niet-actief geopend document met een stale planning wordt **efemeer** doorgerekend — `solveProject`
op een kloon van zijn taken, alleen voor deze weergave, zonder de payload aan te raken — tenzij
**Automatisch berekenen** aanstaat, in welk geval het overzicht die documenten meteen écht bijwerkt
(zie *State* hierboven). De weergave ziet uitsluitend documenten die in déze app-instantie open staan;
geen sync tussen machines of vensters (zie `docs/library.md` en de in-app gids
`public/docs/{nl,en}/gids-bezettingsoverzicht.md`).

### In-app documentatie & wiki

`public/docs/` is een **eigen documentatiesubsysteem** met een eigen CI-poort — makkelijk over het hoofd te zien, want het staat niet in `src/`. Het bestaat uit `manifest.json` (artikel-id's, per-artikel titels in veertien talen, en een `layer` ∈ `quickstart | gidsen | referentie`) plus één map met Markdown-artikelen per taal.

Twee afnemers, één bron:

- **De in-app helpviewer** — `src/components/backstage/HelpPanel.tsx`, bereikbaar via Backstage → Help. Manifest en artikelen worden at-runtime gefetcht via `BASE_URL` (net als `public/examples/`), dus ze zitten niet in de bundel. De documentatietaal staat persistent los van de UI-taal (`ops-docs-locale`), zodat iemand de docs in het Engels kan lezen terwijl de app Nederlands blijft; ontbreekt een artikel in een taal, dan valt hij terug op EN.
- **De GitHub-wiki** — via `npm run publish:wiki`. De wiki wordt **gegenereerd, nooit met de hand bewerkt**; zie de `wiki`-skill.

De artikelen worden gerenderd door `src/utils/miniMarkdown.tsx`, dat een **beperkte** Markdown-subset kent: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend `docs://`- en `examples://`-links. Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML.

`npm run verify:docs` (onderdeel van `npm run verify`) bewaakt dit: elk manifest-id moet minstens een `nl`- en een `en`-artikel hebben, geen weesbestanden, geen dubbele id's, elke `docs://`/`examples://`-link moet bestaan, en de inhoud moet binnen de parser-subset blijven. De overige twaalf talen mogen achterlopen maar worden gevalideerd zodra ze er zijn.

**Bouw je een gebruikerszichtbare functie, dan hoort daar documentatie bij** — minimaal `nl` en `en`, met een manifest-entry. Zonder dat blokkeert `verify:docs` niet (het artikel bestaat dan simpelweg niet), maar de functie is voor gebruikers onvindbaar.

## Docs

- [PLAN.md](PLAN.md) — large project plan, source of truth for the **roadmap**. ⚠️ Alleen voor de roadmap: §4 "Mappenstructuur" is vervallen (de ontwerpfase-boom is verwijderd, er staat alleen een verwijzing). Voor de werkelijke structuur: dit bestand en `AGENTS.md`.
- [docs/TODO.md](docs/TODO.md) — lopende to-do-lijst met dingen die nog gedaan moeten worden.
- [docs/ifc-round-trip.md](docs/ifc-round-trip.md) — **hoe je een veld toevoegt dat een opslaan/laden overleeft.** IFC is het native formaat, dus domeindata die niet round-trippt is bij het volgende openen weg; dit is de route langs writer, reader, fixture en canon-tabel, plus waar de compiler je tegenhoudt.
- [docs/recepten/](docs/recepten/) — dezelfde receptvorm als hierboven voor andere terugkerende klussen: een nieuwe `planner_*`-MCP-tool, een nieuwe instelling, een nieuwe vertaalsleutel, een nieuw ribbontabblad, een tekstgrootte kiezen/toevoegen, een nieuwe in-app gids en een nieuwe rekenconventie.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — per **uitgebrachte** versie de uitgebreide beschrijving (Engels). Wordt alleen tijdens een release bijgewerkt (zie de `release`-skill) — geen `Ongepubliceerd`-kop, geen commit-dump.
- [docs/self-test-harness.md](docs/self-test-harness.md) — how Claude drives the app to self-test changes. Tier 1 (default): Playwright MCP (`.mcp.json`) + the dev-only `window.__OPS__` hook (installed by `src/utils/devBridge.ts`: store, log-bus, `extensions.*`) against the **browser** dev build (`npm run dev` — de poort wordt per worktree toegewezen en gestempeld in `.claude/launch.json`, dus lees hem uit de dev-server-uitvoer in plaats van 3007 aan te nemen) — assert via store state, not canvas pixels. Tier 2 (opt-in): `tauri-driver` for the real desktop window.
- [docs/superpowers/](docs/superpowers/) — ontwerp- en implementatiedocs (specs, plannen en een handvol losse stukken). **Begin bij [docs/superpowers/README.md](docs/superpowers/README.md)**; die zegt per document wat de status is en waarom er niet blind gearchiveerd wordt (er wijzen ~50 commentaarregels in `src/`/`tests/` naar deze bestanden). Hier stond een handmatige opsomming van "actieve" onderwerpen die niet meer klopte — op het actieve programma en enkele nog-niet-uitgevoerde stukken na gaan alle specs/plannen over opgeleverde functionaliteit, en de afvinkvakjes in de plannen zijn nooit bijgehouden. Lees ze als *waarom het zo is*, niet als *wat er is*.
- [docs/onderhoudbaarheid/](docs/onderhoudbaarheid/) — het onderhoudbaarheidsonderzoek: deelrapporten, critreviews en een visueel overzicht. Bron van de "K-items" die in commitberichten opduiken (K2 STEP-strings, K4/K5 recovery, K6a Rust-oppervlak, K7 export-guard, K8 meldingen/`isDirty`, K9–K11 CI-poorten).
- [docs/planning-test-bevindingen.md](docs/planning-test-bevindingen.md) — bevindingen van het CPM-correctheidsonderzoek dat de `tests/planning/`-suite opleverde.
- [docs/archive/superpowers/](docs/archive/superpowers/) — historical design docs and implementation plans for shipped features (zoom, debug terminal, stylebook). Archived; useful for context on *why* something was built, not *what* exists now — verify against current code.
- [docs/archive/handoffs/](docs/archive/handoffs/) — verbruikte sessie-draaiboeken. Puur historisch; een draaiboek dat zelf zegt dat het afgewerkt is, hoort niet meer tussen de levende docs.
- [docs/extensions.md](docs/extensions.md) — handleiding voor extensie-auteurs (manifest, API, installeren).
- [docs/library.md](docs/library.md) — resourcebibliotheken (B1/B1.1): bibliotheek als bron met projectinzet, herkomststempels, pool-IFC-export/-import, bekende beperkingen (geen sync tussen machines).
- [docs/release-secrets.md](docs/release-secrets.md) — de sleutels achter de uitleverketen: wat elk secret doet, wat er stukgaat bij verlies, en het migratiepad voor de minisign-sleutel (de enige onherstelbare SPOF: zijn pubkey zit in elke uitgeleverde binary).
- `artifacts/<onderwerp>/` — **gecommit schermbewijs** bij een PR (bijv. `artifacts/resourcediagram/`), waar een PR-tekst of issue-reactie naar linkt via `raw.githubusercontent.com`. Klein houden: PNG, ≤ ~150 KB per bestand, een handvol per PR, en na de merge niet bijwerken (het is bewijs van dat moment, geen documentatie). Die regel geldt vanaf 2026-09 voor nieuwe mappen; `artifacts/tabel-overhaul/` (25 JPG's, 2,3 MB) dateert van daarvóór en blijft bewust zoals hij is. Lokale QA-screenshots horen in `qa/` (in `.gitignore`).
- [scripts/README.md](scripts/README.md) — wat elk script in `scripts/` doet en wie het aanroept (dev-serverpoorten, de verify-poorten, de generatoren, release-hulpjes). Regel: wat daar staat wordt aangeroepen — eenmalige klussen horen weg, niet "voor het geval dat".
- [tests/planning/README.md](tests/planning/README.md) — hoe de CPM/kalender-regressiesuite werkt en hoe je cases toevoegt.
- `public/docs/<taal>/*.md` — de **in-app gidsen** achter Backstage → Help (viewer met taalkiezer, stale-waarschuwing en 14-taal-fallback). Brontalen zijn `nl` + `en`; die twee eist `npm run verify:docs` hard, de overige twaalf worden alleen gevalideerd wanneer ze bestaan (vertalingen volgen maandelijks, niet per release).
- `docs/wiki/` + `scripts/publish-wiki.mjs` — de GitHub-wiki is een **build-artefact** uit `public/docs/en`, `docs/wiki/*` en de changelog. Nooit de wiki direct bewerken; genereer met `npm run publish:wiki` (zie de `wiki`-skill).
