---
paths:
  - "src-tauri/**"
  - "src/services/**"
  - "src/App.tsx"
  - "src/state/ifcSchemaChoice.ts"
  - "src/state/ifcSchemaQuestionBridge.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

# Tauri-schil, bestands-I/O en IFC

This is a Tauri 2 desktop app (Rust shell + React 19 frontend) for construction planning, part of the OpenAEC-Foundation desktop-app family (LGPL-3.0; extension system and styling follow Open Calc Studio). The browser build is production-deployed (`live.yml`) and functionally near-complete: since v2026.7.11 it does its own file I/O (File System Access API on Chromium, download-fallback elsewhere) and auto-save recovery (IndexedDB). **The in-app updater and MCP bridge are Tauri-only.** The split is still gated behind a runtime check:

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

Any code that touches `@tauri-apps/*` must be either dynamically imported inside an `isTauri()` branch (see `App.tsx` auto-save) or otherwise guarded — top-level imports of Tauri plugins will break the web build.

## The Rust backend is thin — file I/O uses JS plugins, not `invoke`

De `invoke_handler` in `src-tauri/src/main.rs` telt precies vier commands: `install_kind` (uit `src-tauri/src/commands/mod.rs`), `place_file_exclusive` (uit `src-tauri/src/commands/place_file.rs`, hieronder) plus `mcp_bridge_start`/`mcp_bridge_stop` (uit `src-tauri/src/mcp_bridge.rs`, zie `.claude/rules/mcp.md`). `install_kind` wordt aangeroepen vanuit `src/services/updater/updaterService.ts` om het installatietype (appimage/snap/aur/deb/native) te detecteren en de updater te poorten. (The unused `read_file`/`write_file` commands were removed for finding K6a: everything in the `invoke_handler` is reachable via `window.__TAURI_INTERNALS__.invoke(...)`, extension code included, and those two did no path validation and bypassed the `plugin-fs` scope. Houd die lat aan: elk nieuw command is publiek oppervlak.) Naast de commands registreert `main.rs` de plugin zonder commands, `ops-process-info`: een initialisatiescript dat het proces-id als alleen-lezen `window.__OPS_PROCESS__.pid` zet, voor de ontdekkingsbestanden van de MCP-plugin (`docs/mcp-ontdekking.md`). Op Linux zet `src-tauri/src/desktop_integration.rs` bij elke start uit een AppImage (env `APPIMAGE`) een menu-item (`~/.local/share/applications/org.openaec.planner.desktop`) en het logo (hicolor 256x256) neer; geen command, alleen een thread vanuit `main`. Een `.desktop`-bestand zonder de markering `X-OpenPlannerStudio-AppImage=true` blijft staan; `OPS_NO_DESKTOP_INTEGRATION` schakelt het uit. Ook alleen op Linux geeft `linux_window_shadow` in `main.rs` (vanuit `setup`) het randloze venster (`"decorations": false`) een schaduw: GTK krijgt zijn client-side decoraties terug met een verborgen titelbalk (`set_no_show_all`), dus de titelbalk van de webview blijft de enige. Toon die widget nooit: een getoonde widget krijgt van GTK 3 minstens 1 px hoogte boven de webview, ook gemaximaliseerd, en vangt dan de klikken op de bovenste rij van de vensterknoppen. De schaduw vraagt op X11 een compositor; zonder compositor valt GTK terug op `solid-csd` (effen rand, geen schaduw). Dat moet gebeuren voordat het venster voor het eerst zichtbaar wordt; het werkt alleen omdat het start verborgen (#895). Toon het venster dus niet eerder, en verander `decorations` niet zonder deze functie mee te nemen. De crate `gtk` (0.18, alleen Linux) is dezelfde die tauri/wry al meebrengt. All real file I/O funnels through `src/services/fileAccess/` — a runtime-dispatched abstraction (`index.ts` kiest Tauri↔web met een `FileRef`-model) met een Tauri-backend (`plugin-fs` + `plugin-dialog`), een web-backend (File System Access API + download-fallback) en een site-backend (`siteBackend.ts`, `FileRef` van de soort `site`: opslag via de pagina die de tool host, contract `window.openaecHost` in `siteHost.ts`; alleen in de browser, zie `docs/platformbouw.md`): `fileSlice` (open/save/export), `src/services/recovery/recoveryStore.ts` (auto-save) en `ReportPanel.tsx` (rapport-export) draaien er allemaal op; handle-backed recente-bestanden via `fileAccess/recentFiles.ts`. Schrijven over een bestand van de gebruiker (Opslaan, Opslaan als, automatisch opslaan, export, MCP `export_ifc`) loopt in Tauri via `writeUserTextFileTauri`/`writeUserBytesTauri` uit `fileAccess/atomicWrite.ts`: plugin-fs truncate't het doel vóór het schrijft, dus die route maakt per save een korte, zelfstandige basename `save-<id>.ops-save.tmp` in dezelfde map exclusief aan (onafhankelijk van de lengte van de doelnaam) met de inhoud erin, in één `writeFile`/`writeTextFile` met `createNew: true` en de modus (één open bestand in Rust, dus ook een 0444-origineel blijft zoals nu vervangbaar), en hernoemt pas daarna. Alleen de schrijffout van plugin-fs ná een geslaagde aanmaak (`failed to write bytes to file at path:`, `WRITE_AFTER_CREATE_ERROR`) geeft eigendom (`OwnFileWriteError`); elke andere fout ruimt niets op. **Bytes gaan naar Tauri nooit in een object**: alleen een kale `Uint8Array` als hele payload (`writeFile`/`writeTextFile`) gaat als rauwe body; een `Uint8Array` in een object (zoals `FileHandle.write` met `{ rid, data }`) maakt Tauri met `Array.from` tot JSON, één getal per byte, synchroon op de hoofdthread (tauri 2.12.3 `process-ipc-message-fn.js`; in V8 ongeveer 274 ms per MiB). De opties van `writeFile` gaan als JSON in de kop `options`; sinds plugin-fs 2.6.0 faalt de aanroep vóór het openen als die onleesbaar zijn (2.7.1 `parse_write_file_options`; daarvóór vielen ze stil terug op aanmaken en afkappen), en de Node-adapter `tests/planning/nodeFileIpc.ts` doet dat na. Valt Tauri terug op `postMessage`, dan wordt ook de rauwe body weer JSON; dat is alleen in de echte app te zien (knownbug 1790). Het oude vaste `<doel>.ops-save.tmp` blijft met rust. Een mislukte aanmaak geeft geen eigendom voor cleanup; een botsing geeft een fout zonder directe terugval. Buiten de fs-scope, bij een geweigerde rename en bij een gelinkt doel blijft direct schrijven de bestaande terugval, met de foutveiligheid van die directe write. Buiten de scope valt sinds plugin-fs 2.7.0 ook een map in `$HOME` die via een symbolische link buiten `$HOME` uitkomt: de scope toetst het echte pad (bij een nieuw pad de echte bovenliggende map), dus het halffabricaat ernaast wordt geweigerd; het via de dialoog gekozen bestand zelf blijft toegestaan (Tauri neemt ook zijn echte vorm op), dus Opslaan schrijft daar direct. Alleen eigen halffabricaten worden opgeruimd; cleanup kan mislukken. Dit biedt geen padlock tegen latere link-/directorywissels. Bestaande Unix-modebits worden als aanmaakmode meegegeven, maar de proces-umask kan ze beperken; exact modebehoud wordt niet gegarandeerd; de alleen-lezen-doelkwestie van knownbug 162 blijft apart. Follow that pattern — breid `fileAccess` uit, geen nieuwe Rust-command — when adding file operations. All IFC parsing/serialization, scheduling, and rendering are TypeScript; Rust is just the shell. De commandloze plugin `persisted-scope` staat na `fs` en bewaart de via de kiezer verleende toegang over herstarts, voor Recent en voor een map die de planner voor de vervanging van een bestand vrijgaf (knownbug 1762, zie *Ctrl+S op het eigen bestand op de desktop*). Naast `$HOME` mogen alleen `read_dir`, `open` en `read_file` (scope per opdracht) in de lettertypemappen van het systeem (`/usr/share/fonts`, `/usr/local/share/fonts`, `/System/Library/Fonts`, `/Library/Fonts`, `C:/Windows/Fonts`), voor het eigen rapportlettertype (`src/services/pdf/systemFonts.ts`, #770). Schrijf scopepaden altijd met `/`, ook voor Windows: Tauri bouwt een opdrachtscope bij elke aanroep opnieuw, en één patroon dat op een platform ongeldig is (zoals `C:\\Windows\\Fonts\\**` op Linux en macOS) laat die opdracht daar voor elk pad weigeren (`check-tauri-capability-scopes.ts`). `open` kan daar ook met `write: true`; dan beschermt alleen het besturingssysteem die mappen. Enabled plugins: `fs`, `persisted-scope`, `dialog`, `shell`, `store`, `os`, `updater`, `process`, `clipboard-manager`; app id `org.openaec.planner`. `tauri-plugin-fs` staat op 2.7.1 (ondergrens in `Cargo.toml`; `@tauri-apps/plugin-fs` op dezelfde versie) en `tauri-plugin-persisted-scope` op 2.4.3; een verhoging van plugin-fs raakt `FsRenameScope` (hieronder) en de nabootsing in `nodeFileIpc.ts`.

Opslaan als in Tauri (`pickSavePathTauri` in `fileAccess/tauriBackend.ts`) laat de eindnaam zelf door het
opslagvenster gaan. Het venster geeft toestemming voor het pad dat het teruggeeft (plugin-dialog `save`: `allow_file`,
dat `persisted-scope` voor Recent bewaart) en stelt de overschrijfvraag voor dat pad (GTK
`set_do_overwrite_confirmation`). Op Linux komt een getypte naam zonder extensie terug (`kopie`) en plakt de app de
extensie erachter; voor `kopie.ifc` gaf het venster dan geen toestemming (buiten `$HOME` volgt `forbidden path`, en
sinds plugin-fs 2.7.x ook in een map in `$HOME` die via een link buiten `$HOME` uitkomt, want de scope toetst het echte
pad) en geen overschrijfvraag. Daarom toetst de app de aangevulde naam met plugin-fs `exists`, dat eerst de scope toetst: een
scopeweigering of een bestaande naam opent het venster nog eens met de volledige naam ingevuld; komt er weer een naam
zonder extensie terug, dan herhaalt die stap. In het gewone geval (binnen de scope, naam vrij) blijft het één venster.
Windows (`SetDefaultExtension`) en macOS (`setAllowedFileTypes`) vullen de extensie in het venster zelf aan.
Proef: `check-save-dialog-extension.ts`, per scoperegel van plugin-fs (2.5.0 en 2.7.1); het nagebootste venster geeft
het pad vrij zoals tauri `allow_file` dat doet: zoals gegeven en met `canonicalize_parent`.

### `place_file_exclusive` (#804, knownbug 1131 stap 3)

Eén bestand exclusief onder een nieuwe naam plaatsen, in dezelfde map: Linux `renameat2` met `RENAME_NOREPLACE` en
macOS `renameatx_np` met `RENAME_EXCL`, beide relatief aan de open map; Windows `SetFileInformationByHandle`
(`FileRenameInfo`, `ReplaceIfExists` onwaar) op de open bron. Plugin-fs kan dit niet: zijn `rename` is
`std::fs::rename` en vervangt een bestaand doel. Volgorde, bij de eerste weigering stopt het zonder wijziging: de padteksten van de aanroeper zoals plugin-fs `rename`
ze toetst (`SafeFilePath`: geen `..`, geen URL; absoluut, gewone bestandsnaam; dan de scope van `from` en daarna van
`to`), dezelfde map (de map van `from` één keer geopend en vastgehouden, die
van `to` moet hetzelfde bestand zijn), precies één van beide namen een eigen hulpnaam (`save-<id>.ops-save.tmp` of
`<naam>.ops-vorige-<id>`, `<id>` kleine letters en cijfers zoals `generateId`, één regel in `place_file.rs`; de vervanging
gebruikt `save-<id>.ops-vorige-<id>`), de scope
ook op het echte pad van de open map (`FsRenameScope`: de capability via `Webview::resolve_command_scope` plus de
runtime-scope; een verbod op de padtekst of op het echte pad wint, de toestemming geldt het echte pad, en het echte pad
lost ook links in de bovenliggende mappen van een nog niet bestaand pad op, een lus weigert; zoals `resolve_path` en
`resolve_real_path` in `tauri-plugin-fs-2.7.1/src/commands.rs:1615-1725`, die privé zijn), de bron geopend in de open
map zonder link te volgen en een gewoon bestand met precies één naam (het aantal van de open bron, in één lezing met type en identiteit; meer `hard-linked`, nul `source-changed`,
besluit van 18 november 2026), fsync van die open bron, de exclusieve stap (een fout blijft een fout,
ook `EEXIST`), een controle na de stap (op het doel staat de open bron, in de open map
én via het pad van de aanroeper; anders `source-changed` en geen verdere stap, geen terugzetten), fsync van de map.
Uitkomsten op `code`: `placed`, `dir-not-synced` (wel verplaatst), `target-exists`, `unsupported`, `refused` met
`reason` (`path-shape`, `helper-name`, `scope`, `not-regular-file`, `hard-linked`), `source-changed` (belooft geen stand op schijf),
`io`. De grens van het commando staat letterlijk bovenaan `place_file.rs` en in ontwerp §4.10; op Unix blijft een
venster tussen controle en stap (knownbug 1799). Geen terugval: `link()` + `unlink()` en "eerst kijken, dan hernoemen" laten
een bestand verdwijnen dat tussendoor op het doel komt (review #839, ronde 4); een bestandssysteem zonder gebonden
exclusieve stap geeft `unsupported`. De controles staan in de code, want een app-commando zonder ACL-manifest is
vanuit elke lokale webview aan te roepen, ook vanuit extensiecode (`tauri-2.12.3/src/webview/mod.rs:2076-2083`).
Het verbod op de webviewgegevens komt van twee kanten. `fs:default` van plugin-fs 2.7.1 verbiedt per beschermde map
`map/**` en op Linux de bestanden `cookies` en `hsts-storage.sqlite` (`deny-webview-data.toml`, werkzaam sinds 2.5.2);
de capabilities `webviewgegevens-linux.json` en `webviewgegevens-windows.json` (per platform via `platforms`) voegen toe
wat upstream niet dekt: de map zelf en `rename`/`remove` van `$APPLOCALDATA` zelf. Zet daar geen regel die `fs:default`
al levert: hij staat dan dubbel en `place_file_scope_volgt_plugin_fs` faalt. De grens (besluit van de technisch beslisser, 16 november 2026). Binnen de grens: per beschermde map
óók de map zelf: geen fs-commando mag de map of iets eronder bereiken (`map/**` uit `fs:default`, `map` uit de capability
met `fs:scope`, want `map/**` matcht `map` niet en `rename`/`remove` van plugin-fs toetsen alleen de opgegeven paden;
plus de bestanden `cookies` en `hsts-storage.sqlite` uit `fs:default`); `rename` en `remove` van `$APPLOCALDATA` zelf (de app-datamap) zijn verboden
(`fs:allow-rename` en `fs:allow-remove` met `deny`, een commandoscope); `mkdir`, `read_dir`, lezen en schrijven in
`$APPLOCALDATA` blijven, zodat het herstel na een crash werkt. Buiten de grens (knownbug 1775): op Windows een map
bóven de app-datamap (`AppData\Local`, `AppData`) hernoemen of verwijderen; "wie die mappen kan hernoemen of wissen,
kan dat al met de hele thuismap." Ook buiten de grens (knownbug 1776): een bestand met een punt vooraan (of onder een
map met een punt vooraan) in een beschermde map, dat de gebruiker zelf in een bestandsdialoog kiest. De puntregel van
de matcher laat het verbod dat pad niet raken; code in de webview komt er zonder die keuze van de gebruiker niet. De globale scope geldt voor elk fs-commando, de commandoscope voor dat commando;
`FsRenameScope` leest beide, dus ook hier; bouw het in de code niet na. Linux: de mappen en bestanden van WebKitGTK uit
`deny-webview-data.toml` van plugin-fs, nooit heel `$APPLOCALDATA` (op Linux dezelfde map als `$APPDATA`, met
het herstel, `mcp/`, `ops-test/` en de bibliotheek); Windows `EBWebView`; macOS geen (WKWebView krijgt geen
gegevensmap, `tauri-2.12.3/src/manager/webview.rs:559-568`). Wie een eigen bestand of map in de
app-datamap toevoegt, zet het in `EIGEN_GEBRUIK` in `place_file.rs`. TS-ingang
`fileAccess/placeFileExclusive.ts` (alleen dynamisch in `isTauri()`); aanroepers: de nieuwe-naamroute
hieronder (1131 stap 4) en de vervanging van het eigen bestand met haar afhandelen na een crash (1131 stap 5a, aangesloten op Ctrl+S in stap 5b). Proeven:
`cargo test place_file` (naad `PlaceOps`; nep-app via de feature `tauri/test` voor de echte scope en dezelfde invoer
door de IPC naar plugin-fs `rename` en dit commando, ook via een link naar buiten de scope en met een verbod dat een
link noemt; `place_file_fs_default_verbiedt_zelf` toont wat `fs:default` zonder de eigen capabilities verbiedt; workflow
`rust-tests.yml` op Linux, macOS en Windows) en `check-place-file-exclusive.ts`.

## IFC is the native file format, not a sidecar

De nieuwe byte-ingang (#804, T1) staat naast deze bestaande tekst-/binaire schrijfroutes:
`saveNewBytesDialog` en `saveNewBytesToRef` nemen één `Uint8Array` (de buffer die de merge al heeft). Tauri
(`writeNewUserBytes` in `atomicWrite.ts`, knownbug 1131 stap 4; ook `planner_export_ifc`) maakt in dezelfde map
`save-<id>.ops-save.tmp` (`userFileTempPath`, dezelfde naam als `replaceUserFile`) met `createNew` en de hele buffer als
rauwe body in één aanroep, en zet het met `place_file_exclusive` op de naam. Per uitkomst: `placed` klaar;
`dir-not-synced` klaar met `console.warn`; `target-exists` eigen bestand weg (best effort) en `ByteWriteError('create-new')`;
`unsupported` en `refused`/`scope` eigen bestand weg en de directe exclusieve aanmaak (één `createNew` op de naam);
`refused` anders een fout, zonder opruimen bij `not-regular-file` (bij `hard-linked` wel, alleen de eigen naam); `source-changed` stoppen met `ByteWriteError('source-changed')`
(niets terugzetten, opruimen of terugvallen); `io` eigen bestand weg en `write`. Een `forbidden path` op het tijdelijke
bestand (buiten de thuismap; vanaf plugin-fs 2.7.1 ook een gelinkte map naar buiten) gaat naar de directe aanmaak; een
andere aanmaakfout (ook `EEXIST` op de hulpnaam) geeft geen eigendom: niets verwijderen, geen terugval. Na `io` of
`target-exists` kan de hernoeming op een netwerkschijf toch gebeurd zijn (1795): opruimen verbergt de fout nooit en het
doel wordt niet teruggelezen. Nooit `rename` van plugin-fs (die vervangt). De directe aanmaak is niet crashvast, en na
een crash kan een `save-<id>.ops-save.tmp` blijven staan (1131). Meldingen: `ifcForeignNewTargetOnly` (Opslaan als en
Exporteren, 1760; Opslaan als over een bestaand gewoon bestand vervangt het sinds stap 8, ook met een gebouwmodel, zie hieronder) en `ifcForeignPlaceUnknown` via `newTargetWriteNotice` (`ifcForeignGuard.ts`). Proeven:
`check-file-ifc-bytes.ts` (nagebootst commando op echte bestanden in `nodeFileIpc.ts`), `check-ifc-document-save.ts` en
`cases-doc-file.ts`. Browserhandles missen exclusieve aanmaak en weigeren vóór schrijven (behalve Ctrl+S op het eigen bestand,
hieronder); de webdialoog
downloadt een Blob, ook met FSA (1130). De sitefuncties `saveNewSiteFileBytes` en
`saveSiteFileVersionBytes` dragen een Blob; de laatste weigert vóór I/O zonder basisversie en
behoudt de conflictkopie van de host. De aanroeper houdt de buffer ongewijzigd tot voltooiing.
PR 11a sluit de documentroutes aan: nieuwe lokale naam, download en siteversie met basis.
PR 11b sluit IFC-export en app-MCP aan op dezelfde `state/prepareIfcOutput.ts`, zonder documentcommit.
De MCP-naad `writeNewUserBytes` gebruikt dezelfde exclusieve byte-ingang; headless biedt haar nog niet. Bestaande tekst-/PDF-routes
veranderen niet. Bestaande vreemde lokale doelen en de bronhash horen bij fase 2 (1131).

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth. The other `src/services/` areas — `fileAccess/` (Tauri↔web bestands-I/O + handle-backed recents), `recovery/` (auto-save/restore, Tauri fs + web IndexedDB), `actualAutosave/` (opt-in, promptvrije writes to an existing project file), `benchmark/` (ingebouwde benchmark-tool via Instellingen), `print/` (printvoorbeeld), `pdf/` (vector-PDF-export via `pdf-lib`; Arabic and Persian stay vector, while CJK rasterizes only without an optional `pdf-fonts` extension), `updater/`, `feedback/` (feedbackdialoog + screenshot-annotator), `mcp/` (AI-assistent, zie `.claude/rules/mcp.md`) and `debug/appLog` (log-bus achter de DebugTerminal) — are app plumbing with no IFC impact. `library/` is de uitzondering: bibliotheekdata is app-globaal, maar herkomststempels round-trippen wél door het project-IFC (zie *Resourcebibliotheken*).

**Tekst in IFC is STEP-gecodeerd** (audit 2026-09-26). Elke stringliteral gaat door `ifcStr` → `encodeStepText` (`ifcPsets.ts`): alleen afdrukbaar ASCII letterlijk, `'` → `''`, `\` → `\\`, de rest `\X2\…\X0\` / `\X4\…\X0\`. Schrijf nooit een literal met de hand (`'${x}'`) behalve voor vaste ASCII (datums, tijden). `IFCAPPLICATION.Version` is een formaatteken, geen appversie: vanaf `'0.2'` (`OPS_APP_VERSION`) decodeert `readIFC` de strings (`decodeStepText`), net als bij elk bestand van een ander pakket; een eigen bestand met `'0.1'` schreef letterlijk en wordt ongedecodeerd gelezen (anders breekt een `\\` in een JSON-pset). De voorbeelden in `public/examples/` zijn sinds audit 2026-09-26 opnieuw gegenereerd (`'0.2'`); het oude letterlijke formaat toetst `check-ifc-step-encoding` met een eigen fixture. JSON-psets gaan via `ifcJson`/`asciiJson` (niet-ASCII als JSON-`\uXXXX`, dan pas STEP-gecodeerd), eigenaarsbesluit 2026-09-28: een app van vóór `'0.2'` leest letterlijk en gooide een pset met `\X2\` erin als ongeldige JSON helemaal weg (alle baselines); zo blijft het blok daar geldig en verliest die oude versie alleen nog een pset met `"` of `\` in een waarde. Nieuwe JSON-psets dus nooit met kale `ifcStr(JSON.stringify(…))`. Toets: `check-ifc-step-encoding`.

**GlobalIds** (audit 2026-09-26). Eén uitgiftepunt: `guidOf` in `ifcWriter.ts`, voor objecten via `objectGuid(ctx, soort, id)` met seed `ifcObjectSeed(soort, id)` (`task:`, `res:`, `cal:`, `seq:`, `proj:`): uit XER kunnen taak, relatie en kalender hetzelfde kale getal als id dragen, en zonder soort deelden ze een GlobalId. Elk object uit een ingelezen IFC houdt zijn GlobalId uit dat bestand: `readIFC` levert `ifcGlobalIds` (seed → GlobalId), dat reist als documentveld mee en `buildWriteIFCInput` geeft het aan de writer. Nieuwe objecten krijgen `ifcGuid128(seed)`: 128 bits, IFC-vorm, deterministisch (dus bij elk opslaan gelijk). Hulpentiteiten (`guidOf`: psets, rels, werkschema's) en de projectkalender (`cal-default`, in elk project hetzelfde id) hashen met het project-id als zout (`auxSalt`), zodat twee projecten geen GlobalId delen; geen lezer rekent die na. Id's: taken via OPS_TaskIdentity of `task-ifc-<GlobalId>`; resources, bibliotheekkalenders en relaties via `stableIdFromGuid` (`res-ifc-`, `rescal-ifc-`, `seq-ifc-<GlobalId>`, dubbel ⇒ `-dup-N`), dus gelijk bij elk openen; de projectkalender blijft `cal-default`. Een in de app gemaakt object krijgt bij het eerste heropenen zo nog één keer een ander id; verwijzingen daarnaar in JSON (contour, nivelleren) lopen via `mappedResourceId` (zelfde id, anders `ifcGuid128`, anders de oude 32-bits `ifcGuid` voor bestanden van vóór deze wijziging). Toets: `check-ifc-globalid`.

### Bestandsschema per project

Het IFC-schema is een projectinstelling: `Project.ifcSchema` (standaard `IFC4X3_ADD2`; ook `IFC4X3` en `IFC4`, keuze in Projectinstellingen). Schrijf nooit stil in een ander schema dan het gekozen schema. Bij het eerste EXPLICIETE opslaan (Opslaan, Ctrl+S, Opslaan als, ook "Opslaan" in de sluitvraag) van een bestand met een ander schema in de kop vraagt `src/services/ifc/ifcSchemaQuestion.ts` wat te doen; de UI beantwoordt de vraag via `src/state/ifcSchemaQuestionBridge.ts` (keuzelogica: `src/state/ifcSchemaChoice.ts`). De openstaande vraag woont op het project (`Project.ifcSchemaUnconfirmed`) en round-tript via `OPS_ProjectSettings`. Autosave, crashherstel, de MCP-backup en MCP-opslaan vragen niets en veranderen niets. Bewaking: `tests/planning/check-ifc-schema.ts` (tabel via `scripts/ifc-schema-table.py`, met de hand opnieuw te draaien na een nieuwe writer-entiteit; CI draait geen Python). Detail: `docs/ifc-round-trip.md` (§ Schemageldigheid).

Met `ifcForeignContent` en een vreemd deel ligt de letterlijke kopnaam vast in `ifcSource.schemaName`.
Projectinstellingen toont de keuze uit met een reden; store- en MCP-projectpatches kunnen haar niet
veranderen, undo/redo behoudt de live bestandskeuze en de schemavraag vervalt. Stille opslag leest de
bron; `ifcFullWriteBlocked` laat de voorbereide document- en volledige exportroutes toe; `ifcSaveBlocked` blijft de andere IFC-routes weigeren. Een terugval zonder
bron is alleen toegestaan na een volledige indeling zonder vreemd deel; onzekere invoer wordt
getypeerd geweigerd. IFC2X3 zonder model houdt de ontwerpuitzondering met een openingsmelding.

### Voorbereid schrijfresultaat (#804)

`prepareIfcWrite` (`foreign/mergeWriter.ts`, fase 1c PR 8a) levert één `PreparedIfcWrite`:
`bytes` (één buffer), sha256, de bron van die uitvoer met de writer-sessiekaart en bevroren
schrijfinvoer, en de letterlijke kalender-ids. De bestaande uitvoercontrole levert de scan;
de bron krijgt geen domein-ids uit herindeling. Bij ongewijzigde vreemde invoer gaan de bronbytes
door dezelfde controle en komt dezelfde bron terug. Zonder vreemd deel blijven de bytes van de
gewone writer. De uitvoer ís de nieuwe bronbuffer; het resultaat houdt daardoor niet ook de oude buffer vast. PR 8b legt na geslaagde opslag de bron vast, PR 9 herstelt
haar en PR 11a sluit de documentroutes aan. De bron en het doelkenmerk worden samen gecommit. Een download vervangt die niet. PR 11b deelt de voorbereiding met volledige export naar nieuwe doelen, zonder bron- of kalendercommit. De optionele indexplek is voor PR 6. Pool en planOnly alleen na de vraag "alleen de planning" (PR 13, zie `state.md`); paneel en dev-bridge blijven geblokkeerd. AutoSave schrijft sinds #804 stap 8 (flag aan, bron aanwezig) via dezelfde vervanging van het eigen bestand als Ctrl+S (`replaceOwnHandleWithRecovery`, `replaceOwnPathWithRecovery`, met de grens van de voorrang op `stopBeforeWrite`); zie `settings-autosave.md`. Een IFC-export (ook met bibliotheek) houdt voorrang vanaf het rekenen (`prepareExportIfcWrite` → `claimProjectFileWrite`).

**De opslagworker** (#804 stap 4 tot en met 6, `src/services/ifc/saveWorker/`) rekent wat `prepareIfcOutput` rekent (de
gewone writer of `prepareIfcWrite`) in een Web Worker. De gewone writer hergebruikt hem; na elk antwoord op een merge (een
uitkomst of een weigering) stopt hij en start het volgende verzoek een nieuwe (knownbug 1936: een worker houdt het afval
van zijn kopie van de bron en de indexen vast, op de desktop bij 157 MB ongeveer 2 GB). De gemounte app bezit één client (`appStore.ts`) en
geeft de berekenfunctie onvoorwaardelijk door, via `StoreRuntimeOptions.ifcSaveCompute`: de gewone writer en de merge
rekenen in de worker voor Ctrl+S (ook *Opslaan* in de sluitvraag), Opslaan als, Exporteren → IFC, de export met de
resourcebibliotheek en Automatisch opslaan naar het bestand. Headless-, scratch- en testcontexten, het crashherstel en
`planner_export_ifc` blijven op de hoofdthread. `prepareIfcOutput` houdt de beslissing. De gewone writer geeft de bytes
uit de worker; die gaan rechtstreeks naar de schrijflaag (`FileData`: `saveDataDialog`, `saveToRef`,
`saveToRefWithoutPrompt`, de site), nooit eerst naar tekst. Tekst bestaat alleen als de hoofdthread rekende (de worker
startte niet). De gewone writer houdt zijn recht op overschrijven (`saveFileDialog`/`saveBytesDialog`, de atomaire
opslag); `saveNewBytesDialog` blijft de exclusieve route van de merge. Heen gaat de bron als kopie, terug de uitvoerbuffers overgedragen (`ifcSaveProtocol.ts`); een inhoudelijke
fout komt aan als dezelfde foutsoort, een transportfout als `IfcSaveWorkerError` (`ifcSaveWorkerError.ts`). Meldt de
worker geen `started` binnen de vaste starttijd (10 s, voor elke worker dezelfde), dan startte hij niet. Een gewoon verzoek
rekent dan op de hoofdthread, zoals op main, en gewone verzoeken blijven daar de rest van de sessie; staat de flag de hele
sessie uit, dan is dit de enige soort verzoek en is het gedrag dat van main. Eén verschil (knownbug 2025): na een eerdere
merge in dezelfde sessie (flag aan, ook een weigering) is die worker gestopt, dus start een gewoon verzoek een verse waar
main de gestarte hergebruikte; start die niet, dan rekent de hoofdthread de rest van de sessie voor gewone verzoeken, en
blijft hij stil, dan wacht dat verzoek eerst tot de starttijd van 10 s voorbij is. Een merge valt alleen terug zolang er in deze sessie nog nooit een worker startte; daarna is
een startfout bij een merge een fout (`not-started`), nooit de hoofdthread. Sterft hij na de start, of verloopt de
rekentijd (60 s plus 1 s per MiB bron), dan is het ook een fout en rekent de hoofdthread niet opnieuw. `prepareAppIfcWrite` (`fileSlice.ts`) maakt daar een
mislukte opslag of export van vóór elke I/O, met één melding (`ifcSaveWorkerFailed`). De worker laadt
`appStoreFactory.ts`, nooit `appStore.ts` (`verify:store-boundaries`). Een antwoord dat niet bij het verzoek past
(`resultFits`), is een transportfout. Workerbundels krijgen de grens van de headless kern (`vite.config.ts`: `zustand`
zonder React, de modules uit `STUBBED` als stub). Bewijs: `check-save-worker.ts` (bytes, fouten, levensduur),
`check-ifc-document-save.ts` (de routes met een geïnjecteerde worker: typen, tweede Ctrl+S, tabbladwissel, fouten),
`save-worker-production.spec.ts` (de worker uit de echte productieconfiguratie, met zijn modules, ook dynamisch) en
`settings-tabs.spec.ts` (de app start de worker zelf bij een echte Ctrl+S, met een model en met een gewoon bestand). De
opslagstand in de statusbalk staat in `state.md`.

**De laatste controle in de schrijflaag** (knownbug 1896, #804 stap 6 en fixronde 1 van #1027): elke documentopslag en
elke IFC-export geeft `refuseBeforePlace` (`RefuseBeforePlace` in `fileAccess/index.ts`; `refuseChangedDocumentWrite`
of `refuseChangedExport`) mee tot het laatste veilige punt: vóór `close()` van een bestaande browserhandle (anders
`abort()`; bij de mergehandle synchroon direct na de bronvergelijking, zonder `await` ertussen), vóór de hernoeming en
elke directe schrijfactie van `replaceUserFile`, vóór de exclusieve plaatsing of aanmaak van `writeNewUserBytes`, vóór
het opzijzetten in `replaceOwnFileBytes` (uitkomst `stopped`) en vlak vóór de site-opslag. Een weigering laat het doel
onveranderd; het tijdelijke bestand en het herstelrecord gaan langs het bestaande opruimpad weg; de bestaande melding,
niets in Recent. **Uitzondering: een handle uit de opslaankiezer van de browser** (Opslaan als, de exports, Ctrl+S
zonder doel): Chromium maakt een bestaand doel bij het kiezen al leeg, dus `abort()` laat daar 0 bytes staan (knownbug
1899). `saveDataDialogWeb` geeft `refuseBeforePlace` wel door vóór `close()`, maar de aanroeper geeft hem in de browser
alleen mee als een leeg bestand beter is dan de uitvoer: Opslaan als en Ctrl+S zonder doel geven er geen
(`documentSaveDialog`); daar maakt de opslag het gevraagde bestand af, bij een intussen vervangen inhoud legt de commit
niets vast en komt er niets in Recent. De native kiezer van Tauri geeft alleen een pad (plugin-dialog `save`), dus op de
desktop geldt de late controle overal.
De controle van een IFC-export (`exportAs('ifc')` en `exportProjectWithPool`) is één inhoudscontrole,
`refuseChangedExport`: ze kijkt naar het geëxporteerde document, ook als dat intussen in een ander tabblad staat
(review van #1027 ronde 2, knownbug 1903), en weigert als dat document gesloten is of een andere inhoud kreeg, als de te
schrijven inhoud veranderde, of, bij een document met een vreemd deel, als het bronobject niet meer hetzelfde is of de
app de volledige IFC weigert. Een tabbladwissel alleen is geen wijziging. De controlepunten:
- onder het schrijfslot vóór de kiezer en vóór een download: die controle, en het document moet ook nog vooraan staan
  (`refuseExportBeforePicker`);
- direct na de kiezer, op het gekozen doel (`refuseTarget`), op elk platform;
- desktop: vlak vóór de plaatsing, altijd (`exportTargetChecks`);
- browser, op de handle uit de opslaankiezer (`exportTargetChecks`, keuze (b) van de technisch beslisser, fixronde 3 van
  #1097). **Gekozen** wordt de late controle bij de geslaagde doelcontrole: stond het geëxporteerde document daar niet
  vooraan (het punt waar main weigerde), dan geldt ze voor deze export. **Ze loopt** vlak vóór `close()`, welk tabblad
  dan ook vooraan staat; weigert ze, dan `abort()` en het bestand blijft leeg. Stond het document bij de doelcontrole
  wel vooraan, dan is er geen late controle, ook niet als de planner daarna wisselt: een wijziging tussen de
  doelcontrole en `close()` komt dan niet in het bestand en de export meldt succes, zoals op main (knownbug 1958). Een export meldt bij een intussen
  vervangen inhoud geen succes en legt geen kalenderkeuze vast (`exportContentReplaced`). Automatisch opslaan doet de doelcontrole (`refusedWriteTarget`) ná het rekenen,
in dezelfde schrijfbeurt, zoals Ctrl+S. Een IFC-export (`exportAs('ifc')`, ook zonder gebouwmodel, en
`exportProjectWithPool`) loopt als één volgorde met voorrang (`withIfcExportPriority`, fixronde 2 van de review van
#1033): `claimProjectFileWrite` van de bronkeuze via de vraag "alleen de planning" tot en met het schrijven, en een ronde
van Automatisch opslaan die al plaatst, maakt dat af vóór de export zijn bron opneemt (`whenProjectFilePlacementSettled`;
zie `settings-autosave.md`). Fixronde 3: de export legt bij de aanroep vast voor welk document en welke inhoud hij is;
staat na het wachten een ander document of een andere inhoud in het tabblad, dan weigert hij met de bestaande melding
(`ifcExportChangedWhileWaiting`), vóór de bestandskiezer.

**Herstel bij de start** (knownbug 1902, fixronde 1 van #1027, besluit Trias): een vervanging die aantoonbaar niets
schreef (`nothingWritten`), wist haar record meteen. Weigert plugin-fs bij de start het doel of een hulpnaam
(`forbidden`), dan doet `settleReplaceRemnants` niets: geen melding, het record blijft voor een latere start met toegang.
Een weigering bewijst niet dat er niets staat: plugin-fs toetst het pad waar het nu werkelijk naartoe wijst, een map uit
Afhankelijke projecten kan na een herstart ontbreken, en `persisted-scope` start bij een onleesbaar scopebestand zonder
de bewaarde rechten. "Bleef staan" meldt de app alleen voor een bestand dat ze zag staan.

Controle (c) (PR 12a, `ownOutputProblem` in `mergeWriter.ts`) komt als laatste in die uitvoercontrole: de eigen groepen
op projectniveau (`foreign/ownGroups.ts`: psets op het `IfcProject` of het eigen live werkschema met hun relatie, bij
`OPS_StructureMeta` ook templates en `IfcRelDeclares`, plus de tweede vormen baselinekop en de typenaam per taak
(GlobalId, `ObjectType` en `PredefinedType` van elke eigen taak met `.USERDEFINED.` of een `ObjectType`); een kop met zijn GlobalId en de aggregaties waarin hij staat, `eigen IFCWORKPLAN` of anders) moeten in de uitvoer gelijk zijn aan wat de writer schrijft uit de herlezing die er al is, met de
schrijfklok van O1 (`writeIfcMergeLines(…, writtenAt)`), zonder GlobalId en owner history van psets en hun leden.
`TaskGuids` telt helemaal mee (PR 12e, knownbug 1706): een weesrij (de baselinerij van een gewiste taak) krijgt in de
herlezing de GlobalId van het domein, dus een extra sleutel, een ontbrekende of een andere waarde weigert. De kop draagt
zijn GlobalId (knownbug 1746): de writer leidt die af uit het id van zijn baseline, dus verwisselde koppen, of de kop van
een gewiste baseline in de plaats van een blijvende, weigeren ook bij gelijke inhoud. De merge geeft de writer voor elke
weesrij de GlobalId die de lezer ervoor aannam (knownbug 1702), anders gaf hij na heropenen een nieuwe hash en was
`OPS_Baselines` daarna niet meer gedragen. Die waarde komt uit de lezing van de bron zelf: `extractBaselines` zet per rij
zonder levende taak de GlobalId waarmee hij haar zocht in `ImportResult.baselineOrphanGuids`, en de merge neemt die over
(`assumedRowGuid` en `withOrphanRowGuids` in `foreign/sourceForm.ts`), zonder eigen afleiding. Het veld is geen documentveld:
`payloadFromImport` neemt het niet over. Alleen verwijzingen buiten tekst naar een eigen regel of het `IfcProject` tellen: een vreemd lid
van een pset, template of relatie niet. Een pset of `IfcRelDeclares` met een niet-lege ledenlijst van uitsluitend
vreemde leden (die de merge schrijft om ze te bewaren) is geen groep; een lege lijst of minstens één eigen lid wel. Een slot dat (b) terugzette, toetst (c) apart (hieronder, per slot). Niet getoetst: een groep waarin (c) zo'n slot niet eenduidig aanwijst, en de bronbytes zelf.
Een verschil weigert met `eigen-uitvoer`. De controle kan alleen extra weigeren. Proef: `check-ifc-foreign-eigen-uitvoer.ts`.

De andere toets in de verliescontrole (PR 12b, `ownGroups` in `LossCheckInput`, `openedOwnGroups` in `mergeWriter.ts`):
een verschil in O1 in een eigen groep op projectniveau (dezelfde indeling, op de bronregels) hoeft geen bewerking te
verklaren als de groep in de bron gedragen is (a: geen stuk dat de herleestoets (b) nodig had; een vreemd lid sluit de groep
niet uit, stap 5 deel 1: de merge houdt het lid, ook in een pset met alleen vreemde leden als de writer de pset niet meer
schrijft, en controle 1 bewaakt het lidmaatschap) en het openen hem niet veranderde (a′: de writer op de lezing van de bron en op `ifcSource.opened`
schrijft in die groep hetzelfde, in de bronvorm van `sourceFormWhereUnchanged`; alleen met `opened`). Dan toetsen (c) en
de controle na openen de echte uitvoer. Geldt (a) of (a′) niet, dan blijft de controle van main.
(a) blijft per groep: een groep met een slot van (b) valt helemaal buiten de toets, ook als (c) haar per slot toetst.
(c) per slot (stap 5 deel 2, PR A): een slot dat (b) terugzette, toetst (c) apart; de rest van zijn groep gewoon.
`restoredOwnSlots` (`ownGroups.ts`) wijst het aan op O1 vóór de bewerkingen: de plaats in de boom van (c) (de groep, de weg
via typen en namen, en het argument: `OPS_ProjectSettings|IFCRELDEFINESBYPROPERTIES/5:IFCPROPERTYSET('OPS_ProjectSettings')#3`),
de regel, het argument en de bronwaarde. `checkedOutput` draagt de regel door de nummerkaart van de hernummering (`remap`)
naar de uitvoer. `restoredOwnGroupDifference` eist dat op die plaats in de uitvoer precies die regel staat, met op dat
argument precies de bronwaarde (anders weigert (c)), en dat de herschreven boom daar precies één regel heeft, zonder
verwijzing. Valt dat laatste niet te maken, of is de plaats niet eenduidig (twee properties of psets met dezelfde naam, twee
koppen of taken met dezelfde GlobalId, het slot is de naam of de GlobalId), staat er een verwijzing in de bronwaarde of in de
waarde van de writer, is de bronwaarde van een soort die de lezer deels draagt (lijst, JSON, samengestelde tekst; de lezer
leest haar mee, dus de rest van de groep kan na heropenen anders teruglezen, knownbug 1770), of staat de regel niet in de
nummerkaart: dan slaat (c) de hele groep over, zoals vóór PR A. Proef van het aanwijzen: `check-ifc-foreign-slotplaats.ts`. De baselinekop (PR 12c,
E1, `headsFollowBaselines`): valt `OPS_Baselines` onder de toets, veranderde het openen ook de koppen
niet en zette (b) geen kop terug, dan mag in de aggregatie van het eigen werkplan een kop met zijn baseline wegvallen of
erbij komen (hooguit zoveel als de planner wiste of maakte); de rest van die aggregatie blijft exact en in volgorde. (c)
bewaakt van de koppen het aantal, de inhoud, de plaats en de GlobalId per baseline. De typenaam op de taak
(PR 12d, E2, `typeNameFollowsDefinition`): valt `OPS_TaskTypes` onder de toets, veranderde het openen ook de typenamen niet
en zette (b) geen typenaam terug, dan mag slot 4 (`ObjectType`) veranderen van een eigen taak die in de bron en in O1
`.USERDEFINED.` is, met hetzelfde type als bij openen, waarvan de definitie nu een andere naam heeft (een hernoemd type).
Elk ander slot van de taakregel blijft onder de controle van main. De waarde toetst (c), per taak op GlobalId; zette (b)
een typenaam terug, dan toetst (c) dat slot van die taak apart, op de bronwaarde. Beide vormen blijven per groep: zette (b) iets terug in
de pset van de vorm of in de vorm zelf, dan beweegt de vorm niet mee (knownbug 1747). Beide tweede vormen staan in `SECOND_FORMS`
(`ownGroups.ts`: pset en vorm; `lossCheck.ts`: wat de vorm mag dragen); `openedOwnGroups` geeft per pset of het openen de
vorm niet veranderde (`secondFormsUnchanged`). Buiten de toets: alles buiten de eigen
projectgroepen (taken, relaties, kalenders, resources). De oude verklaringen (lijst A) en de nacontrole blijven; ze weghalen
is PR B van stap 5 deel 2, geparkeerd (knownbug 1953). Proef:
`check-ifc-foreign-eigen-toets.ts`; de verliescontrole los op een nagebootste fout in O1: `lossProbe` in `ifcMergeKern.ts`.

### Vergelijkingsklok (#804 fase 1c)

`planningCanon` gebruikt alleen `writeIFCForComparison`: één vaste datum via de interne schrijfkern,
ook voor owner history, lege planstart en baselines zonder eigen datum. Gewone schrijfingangen geven
geen vergelijkingsdatum mee. Projectdatums en bestaande baseline-aanmaakdatums blijven meetellen.
`pristineFromScan` krijgt bij interne merge-herlezingen de projectdatums van het openen als terugval;
`OPS_ProjectSettings.CreatedAt/ModifiedAt` overschrijven die wanneer aanwezig. Gewoon openen blijft
ontbrekende datums met de echte klok vullen. `check-ifc-foreign-klok.ts` bewaakt beide klokgrenzen,
bronidentieke bytes en de gewone/download-/site-uitvoer zonder vaste vergelijkingsdatum.

### Auteur en bedrijf (#804 fase 1c)

De bytes-route geeft `selectPlanning` mee via de bestaande leesopties. Alleen daar kiest `extractProject` voor auteur en
bedrijf de eigen (`IFCAPPLICATION` identifier `OPS`) owner history van `IfcProject`, daarna die van het werkplan, daarna
de eerste owner history. Aanwezige `Author`/`Organization` in `OPS_ProjectSettings` winnen, ook bewust leeg. Die twee
velden worden op één plek gelezen; naam/beschrijving blijven hun bestaande pset-regel houden. Met de flag uit blijft
de eerste owner history leidend, ook als die van een ander programma is (Trias 13 november 2026, knownbug 1022).
`check-ifc-foreign-preserve.ts` bewaakt twee echte Projectgegevens-bewerkingen in acht bronnen met bytegelijke C-keten;
`check-ifc-foreign-pariteit.ts` bewaakt naast de 47-referentie ook een vreemde eerste eigenaar met main-verwachting.

### Oude eigen kop, scan en datasectie (#804)

`oldOwnHeader.ts` naast `stepDataSection.ts` herkent één letterlijk gemeten sjabloon van de 17 tags v2026.2.0 t/m
v2026.7.12 (ook `2026.7.12`): LF, IFC4X3, SchedulingView, geldige datum zonder fracties/zone, vaste OPS-naam/versie.
Vanaf v2026.7.13 beschermde de writer de vrije velden. Drie gebruikers delen deze herkenning: de C/A/V-scan
(`foreign/oldOwnHeader.ts`, pas na een strenge scanfout), de doelcontrole als stroom en de datasectievinder voor
`readIFC`. De eerste maskeert alleen de drie vrije velden op een even lange zelfstandige kopie, ook bij Node-buffers.
Bronbytes en byteposities blijven intact; DATA gaat streng door de scanner. De andere twee beginnen bij het DATA
na de vaste kopregels, zodat DATA; en ENDSEC; in naam, auteur of bedrijf geen sectiegrens zijn. Puntkomma's en losse apostroffen mogen. Veldsyntaxis, ook met witruimte, stuurtekens en afwijkende vaste ankers
worden niet als vrije tekst herkend. De grens is precies die van main: 64 KiB UTF-8 vanaf het begin t/m de LF na FILE_NAME; de volgende vaste regels
tellen niet mee. Mogelijke entiteitsbeginnen, commentaar en quote/veldgrenzen (ook met witruimte) behouden de
main-route en worden niet gemaskeerd of overgeslagen. De stroom houdt alleen de nog onbesliste kop vast. Alle andere bestanden houden de sectiezoekregel van main (1061). De aparte, ruimere
herkenning in `targetModelScan.ts` is weg; een kapotte huidige kop is geen oude kop en weigert als doel. Een geldig
bestand volgt de gewone grammatica. IFC schrijven met een vreemd deel gebruikt uitsluitend de voorbereide document- en volledige exportroutes; bestaande lokale doelen blijven geblokkeerd.
Proeven: `check-ifc-foreign-classify.ts`, `-open.ts`, `-target.ts`, `check-ifc-target-model-scan.ts` en de herleestoets.

### Opslaan als bij ontbrekend gebouwmodel (#804, PR 9e)

Alleen `saveFileAs` mag met de flag aan `sourceMissing` na een expliciete bevestiging als planOnly schrijven.
De globale `ifcFullWriteBlocked`/`ifcSaveBlocked` blijven dicht voor elke andere IFC-route; de voorbereiding gebruikt
alleen voor deze bevestigde opslag een momentopname zonder bron. De gedeelde `Dialog` begint op Annuleren
(Enter/Escape annuleren), bevriest de globale sneltoetsen en shellbediening en opent pas daarna de gewone kiezer.
`refusedWriteTarget` blijft vóór schrijven actief. Na succes gaat het document naar het nieuwe doel, zonder modelbron;
hetzelfde kenmerk blijft alleen als doelbescherming met `sourceMissing: false`. Die expliciete waarde staat ook in
de bestaande `foreignSource`-manifestmetadata, zonder hogere manifest- of databaseversie. De gewone IFC krijgt geen
herstelkenmerk; een volgende crash maakt er geen ontbrekend model meer van. Met de flag uit blijft de oude weigering.

### Inhoudscontrole van het eigen doel (#804, knownbug 1131 stap 1)

`sourceTargetContent(ref, ifcSource.bytes)` (`src/services/fileAccess/index.ts`, kern in `sourceTargetContent.ts`) zegt
of op een pad (desktop) of bestandshandle (browser) nog precies de bron staat: `same`, `changed`, `missing` of
`unreadable`. Eerst de grootte, dan stukken van 1 MiB byte voor byte; geen sha256 van het doel en nooit het hele doel in
één buffer (afwijking van §4.10, besluit 16 november 2026). Het pad gebruikt dezelfde stukkenlezer als de doelscan
(`openPathChunksTauri` in `tauriBackend.ts`), de handle `File.slice()`. Site en download hebben geen doel: de functie
neemt alleen `path`/`handle`. Proef: `check-file-ifc-bytes.ts`.

### Ctrl+S op het eigen bestand via de handle (#804, knownbug 1131 stap 2)

Alleen de browser, alleen met de flag aan, voor Ctrl+S en *Opslaan* in de sluitvraag (`writeActiveDocument`). Vóór de
merge: de doelcontrole met de uitzondering "eigen doel" (`refusedWriteTarget`, zie `state.md`), de schrijftoestemming
(`handleWritePermission`; geweigerd ⇒ de download, zoals bij een gewoon bestand, en met een gebouwmodel (`hasBuildingModel`) zonder commit: het document blijft gewijzigd en `ifcForeignDownloadCopy` noemt de kopie, knownbug 1768) en `sourceTargetContent` (anders
`ifcForeignTargetChanged`/`ifcForeignTargetGone`). Dan één merge (`prepareIfcOutput`, `'merge'`) en binnen
`replaceWithRecoveryPending`: `replaceHandleWithBytes` (`webBackend.ts`) opent `createWritable()`, schrijft de buffer
in één `write`, vraagt vlak vóór `close()` opnieuw `sourceTargetContent` (verschil ⇒ `abort()`, het bestand blijft ongemoeid) en
sluit. Daarna `commitSavedDocument` met `prepared`. `'not-recorded'` ⇒ niet schrijven, `ifcForeignReplaceNotRecorded`
(1764); een schrijf- of sluitfout ⇒ `ifcForeignReplaceFailed`; het document blijft dan zoals het was. Een wijziging
door een ander programma tussen de tweede controle en `close()` gaat verloren (ontwerp §4.15; de beschrijving van de
flag noemt het). Een pad (desktop) gaat via de vervanging hieronder (stap 5b).
Proeven: `check-ifc-document-save.ts` (nep-handle met echte herstelrondes) en `settings-tabs.spec.ts` (OPFS-handle).

### Ctrl+S op het eigen bestand op de desktop: de vervanging (#804, knownbug 1131 stap 5a en 5b)

**De route (5b, #1008).** Ctrl+S en *Opslaan* in de sluitvraag (`writeActiveDocument` → `replaceOwnPath` in
`fileSlice.ts`), alleen met de flag aan en een vreemd deel, alleen op het eigen pad. Eén `runProjectFileWrite` houdt
alles vast: de doelcontrole met de uitzondering "eigen doel" (`refusedWriteTarget`, ook voor een pad: precies het pad
van document en kenmerk, zonder handle; een ander open document met dat bestand als bron blijft
`ifcForeignReplaceBlocked`), de merge, de vervanging, de broncommit, de laatste herstelronde en het wissen van het
record. Afsluiten en de updater wachten erop (#987). Buiten de thuismap (knownbug 1762, alleen met de flag aan): mag
plugin-fs een hulpnaam naast het doel niet toelaten, dan vraagt de app vóór de merge eenmalig toegang tot die map
(`refusedReplaceFolderAccess` in `state/replaceFolderAccess.ts` → `requestReplaceFolderAccess` in
`fileAccess/replaceFolderAccess.ts`: de toets `exists` op een hulpnaam, de vraag in de app `FolderAccessQuestionDialog`,
de mapkiezer van plugin-dialog met `recursive: false` en de map als `defaultPath`, dan dezelfde toets opnieuw). Geen
vergelijking van padteksten. Annuleren of een andere map ⇒ `ifcForeignFolderAccessMissing`, niets geschreven. De
mapkiezer geeft de map vrij zoals `allow_directory(map, false)` (de bestanden erin, geen submappen), `persisted-scope`
bewaart haar en `place_file_exclusive` neemt haar mee, zonder Rust-commando
(`place_file_mapkiezer_geeft_de_map_niet_recursief_vrij`). Opslaan als over een bestaand bestand vraagt hetzelfde, vlak
vóór de doelcontrole na de kiezer (die dus beslist op de stand van ná de vraag); Automatisch opslaan en een nieuwe naam
vragen nooit. De vraag blokkeert zoals "alleen de
planning" (`isBlockingDialogOpen`, `saveQuestionOpen`, `isGlobalShortcutFrozen`; bedrading
`state/folderAccessQuestionBridge.ts`, proef `check-folder-access-question.ts`). Na de eerste herstelronde, vóór de
eerste schrijfactie in de projectmap, `stopBeforeWrite` = dezelfde `documentTargetCheck(momentopname, write, true)` als
vóór de merge (fixronde 1 van #1008): document en bron ongewijzigd (`refuseChangedDocumentWrite`), `saveTargetRef` nog
dit pad (`movedOwnTarget`, `sameFileRef`) en geen ander open document met dit bestand als bron (`refusedWriteTarget`). Anders de melding van die
bewaking en uitkomst `stopped`, niets in de projectmap. Volgorde met openen: `readOpenedTauriPath` (`tauriBackend.ts`,
waar dialoog, neerzetten en Recent samenkomen) wacht vóór het lezen op `whenProjectFileWritesIdle`; geen opslagroute
leest erdoor, dus de schrijfrij wacht nooit op zichzelf. Een lezing die al vóór de opslag liep: knownbug 1837. `commit` is
`commitSavedDocument(ref, momentopname, undefined, prepared)`; zijn boolean is de uitkomst van de opslag en dus de
sluitbeslissing (een bewerking tijdens de opslag: de geschreven versie wordt de bron, het document blijft gewijzigd).
Elke andere uitkomst meldt via `ownPathReplaceNotices` en stopt; nooit de gewone schrijfroutine (die schrijft op naam).
Automatisch opslaan met een gebouwmodel (#804 stap 8) neemt dezelfde vervanging, met een eigen beleid voor een oud record
en de grens van de voorrang op `stopBeforeWrite` (zie `settings-autosave.md`); `planner_export_ifc` niet (de export
weigert een bestaand pad met een vreemd deel). Proeven: `check-ifc-own-file-replace.ts` (onderaan), `check-ifc-document-save.ts`,
`check-app-quit-lifecycle.ts`.

**Opslaan als over een andere bestaande naam (stap 8, #1019, keuze 4).** Alleen desktop, flag aan: de merge, en met de
flag ook een document zonder vreemd deel. *Opslaan als* en de bestandskiezer van Ctrl+S zonder opslagdoel dragen de keuze
zelf (was knownbug 1891; fixronde 1 van #1071): `saveAsOnDesktop` (`fileSlice.ts`) vraagt het pad aan `pickSaveTarget`
(`fileAccess/index.ts`), die direct na de terugkeer van de kiezer vastlegt wat er staat (`lstat`, geen link volgen; een
gewoon bestand wordt helemaal gelezen, een onleesbaar gewoon bestand geeft `'unreadable'`, niets, een link of een map
geeft `null`; een toen leeg pad houdt de exclusieve aanmaakroute, 1890). Dan de doelcontrole (`documentTargetCheck` met
`openDocumentsExcept: <document-id>` en `readers` = één scan van de vastgelegde bytes, `capturedTargetReaders`): het
bestand of de bron van een ander open document ⇒ `ifcForeignTargetOpenInTab`, de eigen bron ⇒
`ifcForeignReplaceBlocked` (verwijst naar Opslaan), een onleesbaar doel ⇒ `ifcUnreadableTargetSave` (ook een leesfout en
een STEP-bestand zonder DATA-sectie; besluit van de technisch beslisser, 20 november 2026). Een leesbaar bestand dat geen
IFC is, is een gewoon doel. Een gebouwmodel of C/A/V op het doel weigert hier niet (besluit van de eigenaar, 19 november 2026: de bevestiging in
de kiezer geldt voor wat er staat): de controle krijgt de waarneming mee als `chosenTarget` (`WriteTargetDeps`), en
regel 2 heft een weigering op inhoud alleen op voor dat pad als de kiezer daar een gewoon bestand las. Een symbolische
link naar een modelbestand krijgt die toestemming dus niet (`ifcForeignTargetSave`). Daarna beslist dezelfde waarneming
de route, voor elk document en elke inhoud van het doel; er is één vervangroute (fixronde 2 van #1071). Een gelezen
gewoon bestand ⇒ `replaceExistingPath`: dezelfde `replaceOwnPathWithRecovery` als Ctrl+S, met `source` = de vastgelegde
inhoud (dus `vorigeSha256` in het record) en `stopBeforeWrite` = dezelfde controle, na de eerste herstelronde en vóór de
eerste schrijfactie in de map (document, open tabbladen en bronnen opnieuw; de scan niet nog eens). Een document zonder
vreemd deel geeft `documentId: null`: alleen het herstelrecord, geen `pendingSha256` in het manifest (zo'n document heeft
daar geen bron), met de bytes van de gewone writer. Een vrije naam, een link of een map ⇒ `saveNewBytesToRef`
(exclusieve aanmaak; een bestaande naam ⇒ `ifcForeignNewTargetOnly`), dus ook een link naar een gewoon bestand schrijft
de app niet meer door. Onleesbaar ⇒ de controle weigert. `commit` legt het nieuwe pad, de bron en het kenmerk vast zoals
Opslaan als naar een nieuwe naam; daarna Recent. Buiten de thuismap eerst de vraag om toegang tot de map (zie hierboven).
`save-as-only` (een harde link, ook op Windows via `nNumberOfLinks` in `place_file_exclusive`; `unsupported`, `refused`) ⇒
`ifcForeignNewTargetOnly`; de andere uitkomsten de meldingen van Ctrl+S. Met de flag uit gaat een document zonder vreemd
deel langs de gewone kiezer van main (`documentSaveDialog`, `saveDataDialog` → `writeUserFileTauri`), zonder
toestemming, en geldt de volgorde van de weigerredenen van main (zie hieronder). Exporteren, Ctrl+S met een opslagdoel, Automatisch opslaan, `planner_export_ifc` en de dev-bridge geven geen
toestemming en weigeren een doel met een gebouwmodel zoals voorheen. Afhandelen na een crash gaat via het record, ook
als het doel in deze sessie nooit geopend was. Proeven: `check-ifc-own-file-replace.ts` deel c.

**Opslaan als en Exporteren over het bestand van een ander tabblad (#1022, knownbug 1907).** De doelcontrole direct na
de bestandskiezer van een document (`documentSaveDialog` en `saveAsOnDesktop`: Opslaan als, en Ctrl+S zonder bruikbaar
doel) en die van elke
export (`foreignTargetCheck`) geven `openDocumentsExcept` mee, voor elk document en met de flag aan en uit. Dat is de id
van het document waarvan de planning in de uitvoer staat: het document dat opslaat, en bij `exportAs` en het
projectbestand van de export met de resourcebibliotheek het document van het begin van de export (een tabbladwissel
tijdens de kiezer verandert dat niet). Uitvoer zonder de planning geeft `null`, geen uitzondering: het bibliotheekbestand
(`exportLibrary` en de tweede kiezer van `exportProjectWithPool`, via `saveLibraryFile`) en de rapporten (PDF); daar
weigert ook het bestand van het actieve document (review van #1064). `planner_export_ifc` geeft het actieve document mee,
in de app én in de headless server (die kan ook meerdere IFC's open hebben). `refusedWriteTarget` weigert dan een
bestaand pad dat een open document (behalve de uitzondering) als bestand heeft ⇒ `ifcForeignTargetOpenInTab` (Opslaan
als), `exportTargetOpenInTab` (Exporteren met uitzondering), `exportTargetOpenDocument` (zonder uitzondering) of een
`VALIDATION`-fout (`planner_export_ifc`, ook met `overwrite: true`), met dezelfde padvergelijking als de
bronkenmerken (`sameLocalFile`: pad of bestandsidentiteit, dus ook via een link). Met de flag aan vóór regel 1 (fixronde 1 van
#1071): ook de bron van een ANDER open document met een vreemd deel geeft dan het open tabblad als reden
('open-document'); 'open-source' blijft over voor de eigen bron en voor routes zonder `openDocumentsExcept`. Met de flag
uit precies main (fixronde 2): regel 1, dan de eigen versie, dan het open tabblad, met dezelfde meldingen en
bestandsaanroepen, ook als er na het uitzetten nog een tabblad met een gebouwmodel open staat. Staat er op het pad geen bestand meer, dan is de naam vrij, ook als een ander
tabblad hem onthoudt (fixronde 2 van #1019; knownbug 1908). Op de desktop wijzigt de kiezer niets, dus er is dan niets
geschreven. Alleen paden: een handle uit de opslaankiezer van de browser is al leeggemaakt (1899), dus daar vergelijkt de
controle niets en maken Opslaan als en Exporteren het bestand af (knownbug 1893). Opslaan als op de site maakt altijd een
nieuw sitebestand (geen `id`), dus daar is geen bestaand doel om te vergelijken. Het eigen bestand van het document
blijft een gewoon doel. Proeven: `check-ifc-own-file-replace.ts` (#1022, knownbug 1907, de bibliotheek),
`check-ifc-foreign-target.ts` (#1022 browser), `cases-doc-file.ts` en `cases-headless-server.ts` (`planner_export_ifc`).

**De vervanging (5a).** `replaceOwnPathWithRecovery` (`state/ownFileReplace.ts`, binnen `runProjectFileWrite`) doet ontwerp
§4.10 stap 0–6. Een gelinkt doel weigert vooraf (`linkedOwnFile`, een snelle voorcontrole; op Windows ziet die een harde
link niet, `nlink: null`); de garantie geeft stap 3: `place_file_exclusive` weigert een bron met meer dan één naam
(`refused`/`hard-linked`, #996) ⇒ `save-as-only`, niets verplaatst. Stap 0: een eigen herstelrecord `recovery[.<slug>].replace.<id>.json` in de appDataDir
(`fileAccess/replaceRecords.ts`: `{ id, path, vorigeSha256, pendingSha256 }`, atomair zoals het manifest) plus
`replaceWithRecoveryPending` voor `pendingSha256` in het manifest, dat versie 5 blijft; lukt een van de twee niet ⇒
`not-recorded`, niets geschreven (1764). Stap 1–5 in `replaceOwnFileBytes` (`fileAccess/ownFileReplace.ts`, bewerkingen
via `OwnFileReplaceFs`, op Tauri `tauriOwnFileReplaceFs`): `createOwnTemp` (gedeeld met `writeNewUserBytes`, zonder de
directe terugval) naar `save-<id>.ops-save.tmp`, `sourceTargetContent` op het doel, `place_file_exclusive` doel →
`save-<id>.ops-vorige-<id>` (`previousVersionPath`: kort en los van de doelnaam, fixronde 3 van #1071; het herstel leest
de naam uit het record, `recordPreviousPath`, ook de oude vorm `<naam>.ops-vorige-<id>` van record versie 1) en tijdelijk → doel, `.ops-vorige` opnieuw vergelijken met de bron (gelijk: weg; anders
exclusief naar `<naam> (versie van ander programma <JJJJ-MM-DD UU.mm>).ifc`, `i18n/replaceCopyName.ts`). Per uitkomst
(`ownPathReplaceNotices`): stap 1 `forbidden path` of een gelinkt doel, stap 3 `unsupported`/`refused` ⇒ `save-as-only`;
stap 1 een schrijffout, stap 3 `target-exists`/`io` ⇒ `failed`, eigen tijdelijk bestand weg; stap 2 ⇒
`ifcForeignTargetChanged`/`Gone`; `source-changed` ⇒ `unknown`, niets teruggezet of opgeruimd; stap 4 `target-exists` ⇒
alle drie de bestanden blijven; stap 4 anders ⇒ `.ops-vorige` exclusief terug, en lukt ook dat niet, dan noemt de
melding waar die staat. Het record verdwijnt alleen als geen hulpbestand van de operatie meer staat
(`replaceHelpersGone`: `lstat` op de hulpnaam zelf, een andere fout dan "bestaat niet" telt als aanwezig), nooit na
`unknown`. De bytes-of-tekstkeuze maakt elke aanroeper van `readOpenedTauriPath` zelf, zoals in main: de dialoog en
neerzetten met `readsPathAsBytes` (de extensielijst), Recent met `readsAsBytes` op de naam (met de IFC-terugval). Faalt
het lezen nadat het afhandelen iets deed, dan draagt `ReadAfterSettleError` de gebeurtenissen mee en meldt
`openFailureNotices` ze vóór de leesfout.

Afhandelen (`settlePendingReplaces`, los van de flag, alleen desktop): bij de start in `useRecoveryRestore` vóór
`loadRecovery`, en vóór het lezen van een lokaal pad in de ene kern `readOpenedTauriPath` (dialoog, neerzetten en Recent;
de echte IO in `fileAccess/tauriOpenPath.ts`; `OpenedFile.replaceRemnants` → `remnantNotices` in `openOpenedFile`).
Zonder record voor het pad leest dat alleen de appDataDir. Een record van een vervanging die in deze sessie loopt
(`whileReplaceRuns`), blijft erbuiten. Eigendom alleen op inhoud (`settleReplaceRemnants`): `.ops-vorige` met
`vorigeSha256` en het doel weg ⇒ exclusief terug; met een doel dat bestaat ⇒ blijft staan, ook als het doel
`pendingSha256` heeft (dat bewijst stap 4 niet: een ander kan dezelfde bytes gezet hebben, of 1795); het tijdelijke bestand met
`pendingSha256` en het doel ook ⇒ weg, en anders ⇒ `<naam> (niet opgeslagen planning …).ifc`; al het andere blijft staan
(`ifcForeignReplaceLeftOver`) en het record ook (1815). De snapshotopruiming en een oudere app herkennen de naam van het
record niet. Proef: `check-ifc-own-file-replace.ts` (echte bestanden, nagebootst commando, manifest en record als echte
bestanden in een eigen app-datamap van `nodeFileIpc.ts`; elke crash- en foutproef leest daarna opnieuw van schijf).
