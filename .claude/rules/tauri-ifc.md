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

De `invoke_handler` in `src-tauri/src/main.rs` telt precies vijf commands: `install_kind` (uit `src-tauri/src/commands/mod.rs`), `place_file_exclusive` (uit `src-tauri/src/commands/place_file.rs`, hieronder), `open_backup_folder` (uit `src-tauri/src/commands/open_backup_folder.rs`, #1245, ADR 0508: opent `<appDataDir>/ai-backups` in de bestandsbeheerder via `tauri-plugin-opener`, want plugin-shell `open` staat alleen weblinks toe; geen padargument, de webview krijgt de opener-commands niet vergund) plus `mcp_bridge_start`/`mcp_bridge_stop` (uit `src-tauri/src/mcp_bridge.rs`, zie `.claude/rules/mcp.md`). `install_kind` wordt aangeroepen vanuit `src/services/updater/updaterService.ts` om het installatietype (appimage/snap/aur/deb/native) te detecteren en de updater te poorten. (The unused `read_file`/`write_file` commands were removed for finding K6a: everything in the `invoke_handler` is reachable via `window.__TAURI_INTERNALS__.invoke(...)`, extension code included, and those two did no path validation and bypassed the `plugin-fs` scope. Houd die lat aan: elk nieuw command is publiek oppervlak.) Naast de commands registreert `main.rs` de plugin zonder commands, `ops-process-info`: een initialisatiescript dat het proces-id als alleen-lezen `window.__OPS_PROCESS__.pid` zet, voor de ontdekkingsbestanden van de MCP-plugin (`docs/mcp-ontdekking.md`). Bestanden op de opdrachtregel (de eerste start, en een tweede start via de single-instance-callback met diens werkmap; #1091) houdt `src-tauri/src/launch_files.rs` vast tot de webview het event `ops:open-files-ready` stuurt, en stuurt ze dan als event `ops:open-files`; `src/state/launchFiles.ts` opent ze via de route van slepen en neerzetten. Geen command, geen verruiming van de fs-scope (buiten `$HOME` faalt het lezen, knownbug 2030). Op Linux zet `src-tauri/src/desktop_integration.rs` bij elke start uit een AppImage (env `APPIMAGE`) een menu-item (`~/.local/share/applications/org.openaec.planner.desktop`) en het logo (hicolor 256x256) neer; geen command, alleen een thread vanuit `main`. Een `.desktop`-bestand zonder de markering `X-OpenPlannerStudio-AppImage=true` blijft staan; `OPS_NO_DESKTOP_INTEGRATION` schakelt het uit. Ook alleen op Linux geeft `linux_window_shadow` in `main.rs` (vanuit `setup`) het randloze venster (`"decorations": false`) een schaduw: GTK krijgt zijn client-side decoraties terug met een verborgen titelbalk (`set_no_show_all`), dus de titelbalk van de webview blijft de enige. Toon die widget nooit: een getoonde widget krijgt van GTK 3 minstens 1 px hoogte boven de webview, ook gemaximaliseerd, en vangt dan de klikken op de bovenste rij van de vensterknoppen. De schaduw vraagt op X11 een compositor; zonder compositor valt GTK terug op `solid-csd` (effen rand, geen schaduw). Dat moet gebeuren voordat het venster voor het eerst zichtbaar wordt; het werkt alleen omdat het start verborgen (#895). Toon het venster dus niet eerder, en verander `decorations` niet zonder deze functie mee te nemen. De crate `gtk` (0.18, alleen Linux) is dezelfde die tauri/wry al meebrengt. All real file I/O funnels through `src/services/fileAccess/` — a runtime-dispatched abstraction (`index.ts` kiest Tauri↔web met een `FileRef`-model) met een Tauri-backend (`plugin-fs` + `plugin-dialog`), een web-backend (File System Access API + download-fallback) en een site-backend (`siteBackend.ts`, `FileRef` van de soort `site`: opslag via de pagina die de tool host, contract `window.openaecHost` in `siteHost.ts`; alleen in de browser, zie `docs/platformbouw.md`): `fileSlice` (open/save/export), `src/services/recovery/recoveryStore.ts` (auto-save) en `ReportPanel.tsx` (rapport-export) draaien er allemaal op; handle-backed recente-bestanden via `fileAccess/recentFiles.ts`. Schrijven over een bestand van de gebruiker (Opslaan, Opslaan als, automatisch opslaan, export, MCP `export_ifc`) loopt in Tauri via `writeUserTextFileTauri`/`writeUserBytesTauri` uit `fileAccess/atomicWrite.ts`: plugin-fs truncate't het doel vóór het schrijft, dus die route maakt per save een korte, zelfstandige basename `save-<id>.ops-save.tmp` in dezelfde map exclusief aan (onafhankelijk van de lengte van de doelnaam) met de inhoud erin, in één `writeFile`/`writeTextFile` met `createNew: true` en de modus (één open bestand in Rust, dus ook een 0444-origineel blijft zoals nu vervangbaar), en hernoemt pas daarna. Alleen de schrijffout van plugin-fs ná een geslaagde aanmaak (`failed to write bytes to file at path:`, `WRITE_AFTER_CREATE_ERROR`) geeft eigendom (`OwnFileWriteError`); elke andere fout ruimt niets op. **Bytes gaan naar Tauri nooit in een object**: alleen een kale `Uint8Array` als hele payload (`writeFile`/`writeTextFile`) gaat als rauwe body; een `Uint8Array` in een object (zoals `FileHandle.write` met `{ rid, data }`) maakt Tauri met `Array.from` tot JSON, één getal per byte, synchroon op de hoofdthread (tauri 2.12.3 `process-ipc-message-fn.js`; in V8 ongeveer 274 ms per MiB). De opties van `writeFile` gaan als JSON in de kop `options`; sinds plugin-fs 2.6.0 faalt de aanroep vóór het openen als die onleesbaar zijn (2.7.1 `parse_write_file_options`; daarvóór vielen ze stil terug op aanmaken en afkappen), en de Node-adapter `tests/planning/nodeFileIpc.ts` doet dat na. Valt Tauri terug op `postMessage`, dan wordt ook de rauwe body weer JSON; dat is alleen in de echte app te zien (knownbug 1790). Het oude vaste `<doel>.ops-save.tmp` blijft met rust. Een mislukte aanmaak geeft geen eigendom voor cleanup; een botsing geeft een fout zonder directe terugval. Buiten de fs-scope, bij een geweigerde rename en bij een gelinkt doel blijft direct schrijven de bestaande terugval, met de foutveiligheid van die directe write. Buiten de scope valt sinds plugin-fs 2.7.0 ook een map in `$HOME` die via een symbolische link buiten `$HOME` uitkomt: de scope toetst het echte pad (bij een nieuw pad de echte bovenliggende map), dus het halffabricaat ernaast wordt geweigerd; het via de dialoog gekozen bestand zelf blijft toegestaan (Tauri neemt ook zijn echte vorm op), dus Opslaan schrijft daar direct. Alleen eigen halffabricaten worden opgeruimd; cleanup kan mislukken. Dit biedt geen padlock tegen latere link-/directorywissels. Bestaande Unix-modebits worden als aanmaakmode meegegeven, maar de proces-umask kan ze beperken; exact modebehoud wordt niet gegarandeerd; de alleen-lezen-doelkwestie van knownbug 162 blijft apart. Follow that pattern — breid `fileAccess` uit, geen nieuwe Rust-command — when adding file operations. All IFC parsing/serialization, scheduling, and rendering are TypeScript; Rust is just the shell. De commandloze plugin `persisted-scope` staat na `fs` en bewaart de via de kiezer verleende toegang over herstarts, voor Recent. Naast `$HOME` mogen alleen `read_dir`, `open` en `read_file` (scope per opdracht) in de lettertypemappen van het systeem (`/usr/share/fonts`, `/usr/local/share/fonts`, `/System/Library/Fonts`, `/Library/Fonts`, `C:/Windows/Fonts`), voor het eigen rapportlettertype (`src/services/pdf/systemFonts.ts`, #770). Schrijf scopepaden altijd met `/`, ook voor Windows: Tauri bouwt een opdrachtscope bij elke aanroep opnieuw, en één patroon dat op een platform ongeldig is (zoals `C:\\Windows\\Fonts\\**` op Linux en macOS) laat die opdracht daar voor elk pad weigeren (`check-tauri-capability-scopes.ts`). `open` kan daar ook met `write: true`; dan beschermt alleen het besturingssysteem die mappen. Enabled plugins: `fs`, `persisted-scope`, `dialog`, `shell`, `store`, `os`, `updater`, `process`, `clipboard-manager`, `opener` (alleen vanuit Rust via `open_backup_folder`; de webview krijgt geen opener-capability); app id `org.openaec.planner`. `tauri-plugin-fs` staat op 2.7.1 (ondergrens in `Cargo.toml`; `@tauri-apps/plugin-fs` op dezelfde versie) en `tauri-plugin-persisted-scope` op 2.4.3; een verhoging van plugin-fs raakt `FsRenameScope` (hieronder) en de nabootsing in `nodeFileIpc.ts`.

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

`backupmap.json` (#1245) zet op alle platforms een deny op `fs:allow-rename`/`fs:allow-remove` voor `$APPDATA/ai-backups` zelf en `$APPDATA` zelf, zodat de webview de backupmap niet tussentijds kan vervangen tussen de controle van `open_backup_folder` en het openen; wat eronder ligt blijft toegestaan (herstel, `mcp/`, `ops-test/`, de bibliotheek en de backups zelf blijven gewoon leesbaar/schrijfbaar). Proef: `place_file_backupmap_vervangen_verboden` in `place_file.rs`.

Besluiten van `src/services/fileAccess/`: `docs/adr/0810-bestandsidentiteit-en-gelinkte-doelen-op-de-desktop.md`
(`compareFilePaths`, `missingTarget`, gelinkte doelen in `replaceUserFile`) en
`docs/adr/0811-weigeringen-van-de-browser-bij-bestandstoegang.md` (`webBackend.ts`).

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
Exporteren, 1760; Opslaan als over een bestaand gewoon bestand vervangt het sinds stap 8, ook met een gebouwmodel, en Exporteren → IFC van een document met een vreemd deel ook, zie hieronder; de export zegt het dan met `exportReplaceNewTargetOnly`) en `ifcForeignPlaceUnknown` via `newTargetWriteNotice` (`ifcForeignGuard.ts`). Proeven:
`check-file-ifc-bytes.ts` (nagebootst commando op echte bestanden in `nodeFileIpc.ts`), `check-ifc-document-save.ts` en
`cases-doc-file.ts`. Browserhandles missen exclusieve aanmaak en weigeren vóór schrijven (behalve Ctrl+S op het eigen bestand,
hieronder); de webdialoog
downloadt een Blob, ook met FSA (1130). De sitefuncties `saveNewSiteFileBytes` en
`saveSiteFileVersionBytes` dragen een Blob; de laatste weigert vóór I/O zonder basisversie en
behoudt de conflictkopie van de host. De aanroeper houdt de buffer ongewijzigd tot voltooiing.
PR 11a sluit de documentroutes aan: nieuwe lokale naam, download en siteversie met basis.
PR 11b sluit IFC-export en app-MCP aan op dezelfde `state/prepareIfcOutput.ts`, zonder documentcommit.
De MCP-naad `writeNewUserBytes` gebruikt dezelfde exclusieve byte-ingang; headless levert haar zelf (`nodeFs.ts`: eigen halffabricaat, `fsync`, `link` naar de nieuwe naam), maar niet `replaceUserBytes` (de vervanging van een bestaande naam, zie `mcp.md`). Bestaande tekst-/PDF-routes
veranderen niet. Bestaande vreemde lokale doelen en de bronhash horen bij fase 2 (1131).

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth. The other `src/services/` areas — `fileAccess/` (Tauri↔web bestands-I/O + handle-backed recents), `recovery/` (auto-save/restore, Tauri fs + web IndexedDB), `actualAutosave/` (opt-in, promptvrije writes to an existing project file), `benchmark/` (ingebouwde benchmark-tool via Instellingen), `print/` (printvoorbeeld), `pdf/` (vector-PDF-export via `pdf-lib`; Arabic and Persian stay vector, while CJK rasterizes only without an optional `pdf-fonts` extension), `updater/`, `feedback/` (feedbackdialoog + screenshot-annotator), `mcp/` (AI-assistent, zie `.claude/rules/mcp.md`) and `debug/appLog` (log-bus achter de DebugTerminal) — are app plumbing with no IFC impact. `library/` is de uitzondering: bibliotheekdata is app-globaal, maar herkomststempels round-trippen wél door het project-IFC (zie *Resourcebibliotheken*).

**IFCX achter de flag `ifcx` (#804 fase 3, F3-4).** Met de flag leest de registry `.ifcx` als bytes (`FormatReadOptions.ifcx`,
`readOptionsFor`; `isIfcxName`, een naam zonder punt is nooit IFCX), lui via `src/services/ifc/ifcxOpen.ts` naar de kern
(`readIfcx`). **Regel F:** het formaat is een eigenschap van het document. De lezer legt het vast (`fileFormat`) en geeft
lengte en SHA-256 van de gelezen bytes mee (`ReadImportResult.ifcxRead`); `applyLoadedProject` maakt daarvan de bekende
versie van het doel, ook met `ifcForeignContent` uit (`versionGuarded`, `src/state/versionGuard.ts`). De naam van het doel
beslist niets over een bestaand document. Een poging legt formaat en flag vast bij haar begin (`outputFormat`; één stand
per poging, zie `state.md`); met de flag
aan zet de documentopslag dan `format: 'ifcx'` op de writer-job, die alleen de opslagworker rekent (`writeIfcx`, met de
letterlijke kalenders van de gewone writer, `plainWriteLiteralCalendarIds`). Het eigen doel toetst de bekende versie
(#1174); een ander bestaand doel classificeert de worker (`classifyIfcx` via `ifcxTargetRefusal`, `TargetReaders.readPath`
leest het pad helemaal) en alleen een eigen IFCX, een leeg bestand of een nieuwe naam mag. Met de flag uit weigert een
IFCX-document elke schrijfactie naar zijn eigen doel (`ifcxWriteBlocked`); Opslaan als schrijft STEP naar een naam op
`.ifc`. Een STEP-schrijfactie naar het bestand van een open IFCX-document weigert (`isOpenIfcxFile`). In de browser
schrijft een IFCX-document een nieuw doel alleen als download (`saveNewBytesDialog`, zoals een merge).

**Het bestandstype kiezen bij Opslaan als (#804 F3-5, besluit eigenaar 27 november 2026).** Eén plek per keuze: het
bestandstype (IFC of IFCX) kiest de planner alleen in het opslagvenster van Opslaan als, het IFC-schema alleen in
Projectinstellingen. Alleen op de desktop en met de flag `ifcx` (`typeChoice` in `saveDocumentAsOnTurn`, uit de
momentopname van de poging) biedt het venster beide filters, het type van het document voorop (`saveAsFileFilters`);
Ctrl+S, ook de kiezer van Ctrl+S zonder doel, de browser (de kiezer schrijft daar meteen in het gekozen bestand, en een
IFCX-document downloadt) en de site houden het formaat van het document. Het venster vult een naam zonder een van de
extensies van zijn filters aan met de eerste (`withOneOfExtensions` in `pickSavePathTauri`; met één filter zoals
`ensureExtension`: `plan.ifcx` wordt met de flag uit `plan.ifcx.ifc`). Het gekozen type is het type van de naam
(`formatOfName`). Opslaan als rekent zoals main de uitvoer van het document vóór het venster; wijkt het gekozen type af,
dan rekent `saveAsInFormat` na het venster opnieuw, op dezelfde momentopname, en wordt dat type deel van de ene stand
van de poging (`SaveAsAttempt`: uitvoer, formaat, `missingSourceSaveAs`), die de doelcontrole (ook de IFCX-classificatie
van #1223), de vingerafdruk en de commit gebruiken. Daarom kiest de desktop eerst het pad en schrijft daarna
(`pickSaveTarget` + `placePicked` met de flag `ifcForeignContent` of een merge, anders `pickSavePath` +
`saveDataToPath`); dezelfde aanroepen van Tauri als `saveDataDialogTauri`. IFC naar IFCX: bij een gebouwmodel of een
ontbrekende bron eerst de vraag "alleen de planning" (`ifcxSaveAs`, planOnly naar IFCX), bij een XER-import de melding
"Het P6-bronarchief gaat niet mee naar IFCX." met doorgaan of annuleren (`ifcxXerArchive`; de invoer zonder
`xer`, `xerSourceArchive` en `xerSourceProjectId`, `ifcxInputWithoutXerArchive`); geen schemavraag na het venster.
IFCX naar IFC: geen vraag; de writer schrijft `Project.ifcSchema`. De vragen van het type van het document (de
schemavraag, de vraag vóór het opslaan, "alleen de planning" bij een ontbrekende bron) blijven vóór het venster
(knownbug 2390). Wat het niet kan: knownbug 2389. Proef: de blokken "omzetten", "hetzelfde type" en "de extensie" in
`check-ifcx-app.ts`; Projectinstellingen in `ifc-schema.spec.ts`.

**Tekst in IFC is STEP-gecodeerd** (audit 2026-09-26). Elke stringliteral gaat door `ifcStr` → `encodeStepText` (`ifcPsets.ts`): alleen afdrukbaar ASCII letterlijk, `'` → `''`, `\` → `\\`, de rest `\X2\…\X0\` / `\X4\…\X0\`. Schrijf nooit een literal met de hand (`'${x}'`) behalve voor vaste ASCII (datums, tijden). `IFCAPPLICATION.Version` is een formaatteken, geen appversie: vanaf `'0.2'` (`OPS_APP_VERSION`) decodeert `readIFC` de strings (`decodeStepText`), net als bij elk bestand van een ander pakket; een eigen bestand met `'0.1'` schreef letterlijk en wordt ongedecodeerd gelezen (anders breekt een `\\` in een JSON-pset). De voorbeelden in `public/examples/` zijn sinds audit 2026-09-26 opnieuw gegenereerd (`'0.2'`); het oude letterlijke formaat toetst `check-ifc-step-encoding` met een eigen fixture. JSON-psets gaan via `ifcJson`/`asciiJson` (niet-ASCII als JSON-`\uXXXX`, dan pas STEP-gecodeerd), eigenaarsbesluit 2026-09-28: een app van vóór `'0.2'` leest letterlijk en gooide een pset met `\X2\` erin als ongeldige JSON helemaal weg (alle baselines); zo blijft het blok daar geldig en verliest die oude versie alleen nog een pset met `"` of `\` in een waarde. Nieuwe JSON-psets dus nooit met kale `ifcStr(JSON.stringify(…))`. Toets: `check-ifc-step-encoding`.

**GlobalIds** (audit 2026-09-26). Eén uitgiftepunt: `guidOf` in `ifcWriter.ts`, voor objecten via `objectGuid(ctx, soort, id)` met seed `ifcObjectSeed(soort, id)` (`task:`, `res:`, `cal:`, `seq:`, `proj:`): uit XER kunnen taak, relatie en kalender hetzelfde kale getal als id dragen, en zonder soort deelden ze een GlobalId. Elk object uit een ingelezen IFC houdt zijn GlobalId uit dat bestand: `readIFC` levert `ifcGlobalIds` (seed → GlobalId), dat reist als documentveld mee en `buildWriteIFCInput` geeft het aan de writer. Nieuwe objecten krijgen `ifcGuid128(seed)`: 128 bits, IFC-vorm, deterministisch (dus bij elk opslaan gelijk). Hulpentiteiten (`guidOf`: psets, rels, werkschema's) en de projectkalender (`cal-default`, in elk project hetzelfde id) hashen met het project-id als zout (`auxSalt`), zodat twee projecten geen GlobalId delen; geen lezer rekent die na. Id's: taken via OPS_TaskIdentity of `task-ifc-<GlobalId>`; resources, bibliotheekkalenders en relaties via `stableIdFromGuid` (`res-ifc-`, `rescal-ifc-`, `seq-ifc-<GlobalId>`, dubbel ⇒ `-dup-N`), dus gelijk bij elk openen; de projectkalender blijft `cal-default`. Een in de app gemaakt object krijgt bij het eerste heropenen zo nog één keer een ander id; verwijzingen daarnaar in JSON (contour, nivelleren) lopen via `mappedResourceId` (zelfde id, anders `ifcGuid128`, anders de oude 32-bits `ifcGuid` voor bestanden van vóór deze wijziging). Toets: `check-ifc-globalid`.

### De IFC-lezer (`ifcReader.ts`)

Besluiten van de lezer: `docs/adr/0040-ifc-lezen-integriteitspoort.md`, `0041-step-tekstscan-quote-bewust.md`,
`0042-ifc-lezen-leeg-is-een-uitspraak.md`, `0043-ifc-lezen-uurmodus-kalender.md`,
`0044-ifc-lezen-welke-taken-en-kalenders.md`, `0045-ifc-lezen-toewijzingen.md`,
`0046-ifc-lezen-verwijzingen-terugvinden.md`, `0047-ifc-lezen-ops-sequences-een-bron.md`,
`0048-xer-vastlegging-via-bronreconstructie.md`, `0049-ifc-lezen-opties-van-de-bytesroute.md` en
`0050-ifc-lezen-oude-en-vreemde-vormen.md`. De bestandsgrammatica (`stepFileGrammar.ts`):
`docs/adr/0770-step-grammatica-waar-ze-van-de-norm-afwijkt.md`.

### De IFC-writer (`ifcWriter.ts`)

Besluiten van de writer: `docs/adr/0140-ifc-schrijven-globalids-uniek-per-bestand.md`,
`0141-ifc-schrijven-kop-en-verplichte-tekst.md`, `0142-ifc-schrijven-projectinstellingen.md`,
`0143-ifc-schrijven-standaard-ifc-naast-eigen-json.md`, `0144-ifc-schrijven-kalenders.md`,
`0145-ifc-schrijven-datums-duren-en-lags.md`, `0146-ifc-schrijven-met-een-vreemd-deel.md`,
`0147-ifc-schrijven-resources-en-toewijzingen.md`, `0148-ifc-schrijven-een-invoerobject.md` en
`0771-ifc-voortgang-en-dagenrecord-lezen-exact-terug.md`.

### Het register van de eigen psets (`ifcPsets.ts`)

Besluiten van het register en de descriptors per taak: `docs/adr/0420-ifc-eigen-psets-een-register.md`,
`0421-ifc-eigen-taakpset-alleen-als-hij-iets-zegt.md`, `0422-ifc-eigen-taakpset-lezen.md` en
`0423-ifc-waarden-in-een-eigen-property.md`.

### Losse services direct in `src/services/`

Besluiten: `docs/adr/0760-fetch-met-een-tijdslimiet.md` (`fetchWithTimeout.ts`),
`0761-ingelezen-taken-boom-en-restduur.md` (`importNormalize.ts`) en `0762-xer-bronarchief-eerst-valideren.md`
(`xerSourceArchive.ts`). De kleuren van eigen werksoorten (`taskTypes/`): `docs/adr/1161-kleuren-van-eigen-werksoorten.md`.

### MSPDI-beschikbaarheid en CSV-export (`msproject/`, `csv/`)

Besluiten: `docs/adr/0970-mspdi-beschikbaarheid-en-kritiek-drempel.md` (`mspdiAvailability.ts`,
`mspdiCriticalSlackLimit.ts`) en `0074-keuzes-van-de-exportroute.md` (`csvWriter.ts`).

### Gedeelde helpers binnen een dag (`subdayIo.ts`)

Besluiten van de helpers voor de IFC-, MSPDI-, P6 XML-, XER- en `.mpp`-adapters en het kalendervenster:
`docs/adr/0320-uurkalender-herkennen-de-gedeelde-afwijkingsregel.md`, `0321-uurkalender-promotie-en-bandregister.md`,
`0322-kloktijd-en-duur-als-tekst-in-de-adapters.md`, `0323-werkdag-en-uren-per-dag-uit-werkblokken.md`,
`0324-werkdagen-wisselen-in-een-uurkalender.md`, `0325-soort-mijlpaal-op-een-blokgrens.md` en
`0326-kalender-en-duur-van-een-taak-bij-het-schrijven.md`.

### De P6 XML-writer (`p6/p6xmlWriter.ts`)

Besluiten van de writer van P6 XML: `docs/adr/0360-p6xml-schrijven-indeling-objectids-en-volgorde.md`,
`0361-p6xml-schrijven-eigen-ops-velden.md`, `0362-p6xml-schrijven-kalenders.md`,
`0363-p6xml-schrijven-duur-rest-en-lag.md`, `0364-p6xml-schrijven-voortgang-type-duursoort-en-datums.md`,
`0365-p6xml-schrijven-resources-toewijzingen-en-curves.md`, `0366-p6xml-schrijven-project-naam-id-en-rekenopties.md` en
`0367-p6xml-schrijven-wat-niet-meegaat.md`. De lezer staat in de regel `xer`.

### Bestandsschema per project

Het IFC-schema is een projectinstelling: `Project.ifcSchema` (standaard `IFC4X3_ADD2`; ook `IFC4X3` en `IFC4`, keuze in Projectinstellingen). Schrijf nooit stil in een ander schema dan het gekozen schema. Bij het eerste EXPLICIETE opslaan (Opslaan, Ctrl+S, Opslaan als, ook "Opslaan" in de sluitvraag) van een document met een openstaande schemavraag vraagt `src/services/ifc/ifcSchemaQuestion.ts` wat te doen (wanneer die vraag openstaat: ADR 0184 en 0142); de UI beantwoordt de vraag via `src/state/ifcSchemaQuestionBridge.ts` (keuzelogica: `src/state/ifcSchemaChoice.ts`). De openstaande vraag woont op het project (`Project.ifcSchemaUnconfirmed`) en round-tript via `OPS_ProjectSettings`. Autosave, crashherstel, de MCP-backup en MCP-opslaan vragen niets en veranderen niets. Bewaking: `tests/planning/check-ifc-schema.ts` (tabel via `scripts/ifc-schema-table.py`, met de hand opnieuw te draaien na een nieuwe writer-entiteit; CI draait geen Python). Detail: `docs/ifc-round-trip.md` (§ Schemageldigheid). Besluit over de standaard en de
terugval: `docs/adr/0184-ifc-schema-standaard-en-terugval.md`.

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
haar en PR 11a sluit de documentroutes aan. De bron en het doelkenmerk worden samen gecommit. Een download vervangt die niet. PR 11b deelt de voorbereiding met volledige export naar nieuwe doelen, zonder bron- of kalendercommit. De optionele indexplek (`outputIndex`) is nog ongebruikt. Pool en planOnly alleen na de vraag "alleen de planning" (PR 13, zie `state.md`); paneel en dev-bridge blijven geblokkeerd. AutoSave schrijft sinds #804 stap 8 (flag aan, bron aanwezig) via dezelfde vervanging van het eigen bestand als Ctrl+S (`replaceOwnHandleWithRecovery`, `replaceOwnPathWithRecovery`, met de grens van de voorrang op `stopBeforeWrite`); zie `settings-autosave.md`. Een IFC-export (ook met bibliotheek) houdt voorrang vanaf het rekenen (`prepareExportIfcWrite` → `claimProjectFileWrite`).

**Wijzigingslijst** (#804 fase 2, ontwerp §4.7). Wijst een niet-P-stuk naar een D-stuk dat de planner verwijderde, dan
past de merge één regel toe (`applyForeignRule` in `foreign/changeList.ts`): een lid van een lijst gaat eruit, een lijst
die leeg wordt of een enkele verwijzing laat het stuk vervallen, herhaald tot niets meer verandert; wat een vervallen stuk
aanwees, blijft staan. Welke objecten verdwenen, zegt `goneStepIds` (de sleutels van `ifcSource.stepIds` tegen het
domein). De verwijzingen komen uit `foreignReferences` (`foreign/foreignReferences.ts`): bij openen in de scanworker
(`ifcSource.foreignReferences`, alleen als de indeling C-, A- of V-stukken heeft) en na elk opslaan uit de uitvoer.
`PreparedIfcWrite.foreignChanges` is de lijst: per stuk het id, de oude bytes en de nieuwe bytes of *vervallen*, plus de
ongebruikte sleutels van een verwijderde taak. Controle 1 (`validateMergeOutput`) eist dat de uitvoer daarmee klopt en
rekent de lijst na met een eigen lezer (`foreign/stepValue.ts`), los van de regel en de lexer van de merge: elk vervallen
stuk moet vanuit de ontbrekende D-stukken te verklaren zijn, een gewijzigd stuk is precies de bron zonder de leden naar
verwijderde stukken. Een vreemd lid van een eigen pset van een verwijderd object blijft als los stuk staan en staat niet
op de lijst (§4.2 stap 3). Bij het wissen van een taak of resource, en bij Opnieuw van zo'n stap, meldt
`state/foreignLinksNotice.ts` met dezelfde regel hoeveel er bij opslaan verandert: één info van main met het aantal van
die ene wisstap en de knop *Ongedaan maken* (`undoHistoryEvent`, 12 s, zonder `dedupeKey`), bewaakt door `watchNotice`
uit `otherWorkNotice.ts` met de flag als extra voorwaarde (PR 7). De regel van de knop: hij staat er zolang de melding
zichtbaar is, de wisstap de stap van Ctrl+Z van het actieve document is, de projectgegevens sinds het wissen gelijk zijn
en de flag aan staat; Ctrl+S en Automatisch opslaan halen hem niet weg, een nieuwere stap, Ctrl+Z, een ander tabblad,
een verversing uit de resourcebibliotheek of de flag uit halen de melding met haar knop definitief weg, en Ctrl+Y van
de wisstap meldt opnieuw als er dan nog iets vervalt. Staat de vraag vóór het opslaan open, dan is de knop zoals de
rest van het scherm niet te bedienen (inert, ook Ctrl+Z); na *Annuleren* werkt hij weer zolang de melding er staat.
Besluit technisch eigenaar, 25 november 2026: met `detached`
vervalt de reden van de oude regel B (Ctrl+Z na opslaan bracht de koppelingen niet terug). Ze deelt de grenzen van de
stapel van main (knownbug 2357). Regel A: na het schrijven meldt `state/foreignChangesWrittenNotice.ts` per geslaagde
schrijfactie met een niet-lege lijst één eigen gewone melding (info, blijvend, geen `dedupeKey`) met de naam van het
geschreven doel uit de schrijfuitkomst (pad, handlenaam of de naam die de site teruggeeft) en het aantal, op elke
schrijfroute: `commitSavedDocument` (ook AutoSave en de site), de downloadtakken van Ctrl+S en Opslaan
als (een eigen zin: "in de download"), de IFC-export en `planner_export_ifc` (in het antwoord). Die melding deelt de
grenzen van de stapel van main; wat ze niet kan, staat in knownbug 2357. Weigeren blijft: een verwijzing naar een R-stuk
(`verwijzing-naar-p`, het krijgt een nieuw id) en naar een D-stuk dat de planning niet kent (`verwijderd`).

**`detached`** (PR 7, `foreign/detached.ts`, ontwerp §4.7). De bron van een geslaagde merge (`writtenSource`) draagt in
`ifcSource.detached` de oude bytes van elk stuk op de wijzigingslijst (eigen kopie, de oudste versie, met per verwijzing
naar een D-object de seed), de `sourceSlots` en koppelingen van verdwenen objecten, en per GlobalId de bewaarde relaties
van een ander programma die een lid kwijtraakten, met hun oudste ledenlijst. Alleen als het niet leeg is en de uitvoer een
vreemd deel heeft; zonder wissen is de bron dus gelijk aan die van main. Komt een object met dezelfde domein-id terug,
dan zet `prepareIfcWrite` terug: de constante slots op de regel van de writer (`withReturnedSlots`), de D-leden van een
teruggezette gemengde relatie uit de eigen relatie (`withoutRestoredMembers`), en in `checkedOutput` (na de
verliesbewaking) de leden van bewaarde relaties (`withReturnedMembers`) en de stukken met de huidige ids: op hun plek of
direct na het P-blok (`renderedRestorations`, de `appended` van `assemble`). De wijzigingslijst krijgt dan soort
`teruggezet`; controle 1 eist de bytes en `countedForeignChanges` telt ze niet. De opslagworker draagt de buffers terug
over en `resultFits` eist de vorm (`isDetached`). Het taakpaneel valt terug op de koppelingen in `detached`. `detached`
onthoudt alleen wat de regel van §4.7 uit een stuk haalt (`ruleChangesOnly`): een stuk dat alleen `departuresOf` of een
botsende naam veranderde (#1262), niet; een stuk dat de regel ook raakte, zonder de vertrekkende leden. Terugzetten op
aanwezigheid van het object zou anders een vertrokken lid terugzetten terwijl de koppeling niet terugkwam (knownbug 2355).
Wat nog niet meegaat: knownbug 2354. Proef: `check-ifc-foreign-detached.ts`.

**De vraag vóór het opslaan** (#804, besluit eigenaar 25 november 2026). Met de instelling `ui.foreignChangesQuestion` aan
(standaard; `ops-foreignChangesQuestion`, per apparaat) vraagt een documentopslag met gewijzigde of vervallen stukken in
`prepared.foreignChanges` eerst of het mag (`askForeignChanges` in `services/ifc/foreignChangesQuestion.ts`), met hun
aantal (`writtenForeignChangeCount`; een stuk dat `detached` terugzet, telt niet mee): in `writeActiveDocument` direct na de merge en de controle erna, vóór de doelcontrole, de
site-keuze en de kiezer (met de naam van het eigen pad, de eigen handle of het bestand op de site; zonder eigen doel en
bij een geweigerde schrijftoestemming de vorm "nieuw bestand"); in `saveDocumentAsOnTurn` direct na de merge, vóór de
site-keuze en de kiezer (altijd "nieuw bestand"). Zo vragen Ctrl+S, *Opslaan* in de sluitvraag, afsluiten, de site,
Opslaan als en de download; er wordt na de vraag niets opnieuw gerekend. Annuleren: de poging geeft `false`, schrijft
niets en meldt niets. Opslaan: de route toetst de inhoud opnieuw (`refuseChangedDocumentWrite`) en daarna lopen alle
controles zoals zonder vraag. Na een beantwoorde vraag komt geen telling achteraf (de route onthoudt het
`PreparedIfcWrite`-object, `countShownBeforeWrite`). De vraag hangt alleen aan `write.prepared` en leest de flag dus
niet zelf; de instelling komt uit de momentopname van de poging. Het vinkje "Niet meer vragen" telt alleen met Opslaan
en zet de instelling uit. Met de vraag uit, bij een export (ook `planner_export_ifc`) en bij Automatisch opslaan geldt
regel A hierboven zoals vóór de vraag (Automatisch opslaan wacht op een besluit, `settings-autosave.md`). Wat er bij
opslaan vervalt, is ook vooraf te tellen: `foreignChangesIfSaved` (`state/foreignLinksNotice.ts`, dezelfde regel als de
wismelding) geeft hetzelfde aantal als de merge (`check-ifc-foreign-telling-vooraf.ts`). Ctrl+Z na een opslag en dan opslaan zet
de stukken terug zonder vraag: er vervalt niets. Proeven: de blokken "vraag vóór opslaan" in
`check-ifc-document-save.ts` en de stap met `bonsai-4d.ifc` in `settings-tabs.spec.ts`.

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
opslag); `saveNewBytesDialog` blijft de exclusieve route van de merge. Met de flag `ifcForeignContent` vraagt een
documentopslag (Ctrl+S, Opslaan als, Automatisch opslaan; geen export) in de writer-job ook de SHA-256 van de bytes
(`hashBytes`, `documentSaveCompute`); het antwoord draagt dan `sha256` en `resultFits` eist hem, en weigert hem zonder
vraag. Met de flag uit zijn verzoek en antwoord gelijk aan die van vóór de vraag (de versie op het eigen doel, `state.md`). Heen gaat de bron als kopie, terug de uitvoerbuffers overgedragen (`ifcSaveProtocol.ts`); een inhoudelijke
fout komt aan als dezelfde foutsoort, een transportfout als `IfcSaveWorkerError` (`ifcSaveWorkerError.ts`). Meldt de
worker geen `started` binnen de vaste starttijd (10 s, voor elke worker dezelfde), dan startte hij niet. Een gewoon verzoek
rekent dan op de hoofdthread, zoals op main, en gewone verzoeken blijven daar de rest van de sessie; staat de flag de hele
sessie uit, dan is dit de enige soort verzoek en is het gedrag dat van main. Eén verschil (knownbug 2025): na een eerdere
merge in dezelfde sessie (flag aan, ook een weigering) is die worker gestopt: na een antwoord van een mergeworker kan het
volgende gewone verzoek een verse worker starten, zolang de gewone route nog beschikbaar is, waar main de gestarte
hergebruikte; start die niet, dan rekent de hoofdthread de rest van de sessie voor gewone verzoeken, en
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

**De toets op de taaktijden** (knownbug 2231, fixronde 4 van #1216). De maat is "niet blinder dan main": geen bron buiten
het bestand mag iets verbergen wat de controle van main wel ziet. Binnen "datums zoals opgeslagen" weigerde main elke opslag,
dus daar is deze toets de bewaker; buiten de modus blijft de controle die van main (knownbug 2360). Alleen voor uitvoer die de
writer zelf schreef, in de modus (`recordedSourceFormat` van de invoer), direct na de ongewijzigde vergelijking na heropenen,
met dezelfde soort `planning-na-openen`. `taskTimeSlotProblem` (`foreign/taskTimeExpectation.ts`) leest per taak de
argumenten 3 tot en met 19 van `IFCTASKTIME` strikt: alles wat de gewone lezer zou herstellen, aanvullen, afronden of uit een
hulprecord terugzetten, weigert, tenzij het een letterlijk teruggezette bronwaarde is. De verwachting is de momentopname van
wat de planner zag (de invoer van de merge), niet de bronvorm; die bepaalt alleen wat de merge schrijft.

Leeg hoort een slot volgens `withheldTaskTimeFields` van de momentopname, bij gereedheid 0 (`ifcCompletionReal`), zonder
werkelijke datum, duur of rest, en de statustijd alleen bij een werkelijke datum. Een bronwaarde van de herleestoets (b)
(`sourceTokens`) moet er letterlijk staan, en ook een rekenslot dat in de bron leeg was en dat de planner niet wijzigde: de
bronvorm laat het leeg (`emptySlots` van `sourceFormWhereUnchanged`, alleen in de modus), en de toets eist daar `$`. Strikt per
argument: de regel heeft precies twintig argumenten, elk expliciet. Een tijdstip is `'JJJJ-MM-DDTuu:mm:00'` zonder zone, een
bestaande datum en kloktijd (`isStrictIsoDateTime`); op de dagweg (de lezer leest de dag) alleen om 07:00 (`IFC_TIME_ANCHOR`);
een datum zonder tijd gaat aan beide kanten door `normalizeTaskDate`, zoals bij laden, want de momentopname draagt tijdstippen.
De statustijd telt tot op de minuut, en bij een peildatum zonder tijd is het de dag om 07:00 (dagtaak) of 00:00 (urentaak).
Het duurtype en de kritieke vlag zijn het geschreven lid; de gereedheid is een STEP REAL met hetzelfde decimale getal
(`sameNumber`). Een duur staat tussen aanhalingstekens en geeft de dagen, de eenheid en de minuten die de planner zag
(dezelfde duur in een andere ISO 8601-schrijfwijze, en de werkdag van de taakkalender). Een hulprecord (`DayMeasureDurations`,
`ExactMinutes`, `ExactFloat`) telt alleen als het geschreven slot zijn drager is: de minuten van het slot zijn het tweede getal
van het record, en dat getal hoort bij het eerste (`dayMeasureMinutes` met de werkdag van de taak, `exactMinutesRecord`; bij
`ExactFloat` de hele dagen van het slot, `wholeFloatDays`). Anders weigert de toets, ook als de lezer het record zou negeren.

Het geschreven slot leest de lezer zelf, in de lezing die de controle al doet: `taskTimeReadingsOut` van `readIFC` legt per
taak de ruwe argumenten vast, alleen de velden van de taaktijd die de toets vergelijkt, de werkdag van de taak en de
hulprecords zoals de lezer ze las, na `applyTaskTimeRecords`. Op dat moment is al gebeurd: de slotlezing (`parseTaskTime`),
de nulduur van een mijlpaal in `extractTasks` (de vastlegging zet de duur uit het slot terug bij een dagtaak), de uurmodus
(`applyHourModeIFC`), `fillEmptyComputedDateSlots` (een leeg vroeg of laat slot heeft dan al de geplande datum; de aanwezigheid
oordeelt daarom op het argument) en de hulp-psets. Daarna komen nog `reconcileP6SuspendResume`, `resolveMissingScheduleDates`,
`normalizeImportedProgress` en de berekening bij het laden; die ziet de toets niet. De toets voegt geen schrijf-, scan- of
parseerronde toe. Proef: `check-ifc-foreign-opgeslagen-datums.ts` (de eigenschapsproef: per stand in de modus, per taaksoort
en per tijdslot een vaste reeks soorten verschil per soort slot, ook een onbestaande datum, een argument te weinig of te veel
en een hulprecord dat met het slot meeverandert of zonder bijpassend slot staat).

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

### Koppelingen taak↔bouwdeel (#804 fase 2, `elementLinks`)

`ifcSource.elementLinks` (ontwerp §4.6) is een afgeleide, alleen-lezen weergave per taak-id: `{ direction, target, found }[]`,
geen domein- en geen documentveld, als `Map` (veilig voor elke taak-id, ook na het klonen in een Worker).
`foreign/elementLinks.ts` leest de koppelingen uit een `StepIndex` (`scanElementLinks`), alleen op twee plekken: bij openen
(`scanForeignToOpen`, in de Worker via een verzoek met `open: true`) en voor de bron die de writer teruggeeft
(`writtenSource` in `mergeWriter.ts`, uit de index die daar al is). `scanForeign` en `foreignScanFrom` (doelcontrole, ook
headless, en de interne scans van de merge) verzamelen ze niet. `IfcRelAssignsToProcess` met een `IfcTask` als relating
geeft `input` naar elk lid met een modeltype (`IFC_BUILDING_MODEL_TYPES`); een ontbrekend lid telt daar niet, want het kan
ook een resource zijn. `IfcRelAssignsToProduct` geeft `output` aan elk `IfcTask`-lid; staat het doel daar niet in het
bestand, dan is het `found: false` met `target` = `#<id>`. Een bestaand doel zonder modeltype (een resource, een
kostenpost) is geen koppeling; een complexe instantie ook niet (knownbug 2216). De scan levert ze op STEP-id;
`elementLinksByTask` deelt ze in één keer in (één `Set` op taak, richting en doel, in de volgorde van de bron) met de kaart
domein-id → `#id`: bij openen die van de lezer (`ifcBytesRoute.ts`), na een merge die van de writer (§4.8), nooit met
domein-ids van een nieuwe indeling. De opslagworker eist die vorm (`resultFits`). Niet via `parseSTEP` van de lezer: de doelen zijn V en staan niet in de
tekst die de lezer krijgt. De app schrijft niets aan de koppelingen; de A-stukken blijven bytegelijk. Het taakpaneel
(`TaskElementLinksNotice`) en `planner_get_task` lezen ze alleen met de flag aan, via `state/taskElementLinks.ts`; een
bouwdeel dat zowel invoer als uitvoer is, telt één keer. IFCX (§6.4) hoort bij fase 3 en 4. Proeven:
`check-ifc-element-links.ts`, `tests/mcp/cases-element-links.ts` en de stap met `bonsai-4d.ifc` in `settings-tabs.spec.ts`.

### Ongebruikte sleutels in `OPS_Assignments` (#804 fase 2, PR 3)

Een sleutel in GlobalId-vorm (`isAssignmentKeyName` in `src/services/ifc/assignmentKeys.ts`, ook de herkenner achter
`isOwnAssignmentKey` in `classify.ts`) die de lezer aan geen toewijzing koppelt, is ongebruikt: meer `#n`-sleutels dan
toewijzingen van die resource, een kale sleutel naast genoeg `#n`-sleutels, of een waarde die geen tekst is.
`extractAssignments` meldt ze via `unusedAssignmentKeysOut`. De bytes-route vraagt daar alleen om bij een vreemd deel
(`C + A + V > 0`) en zet ze dan in `ifcSource.unusedKeys` (taak-`#id` met de property-`#id`'s, in psetvolgorde); een eigen
bestand krijgt hetzelfde leesresultaat als op main. Alleen de merge schrijft ze terug: `unusedKeysForWriter`
(`foreign/unusedKeys.ts`) leest naam en waardetoken uit de bron, en `writeAssignmentMeta` schrijft ze na de eigen sleutels,
met de namen van `unusedAssignmentKeyNames`: een `#n` onder de nummers die de writer zelf schrijft, schuift naar het
eerste vrije nummer erboven, zodat de wachtrij van de lezer niet verschuift; een kale sleutel houdt haar naam. Dat vrije
nummer slaat ook de namen van de vreemde leden van dezelfde pset over (`foreignAssignmentKeyNamesForWriter`), want een
pset met twee properties met dezelfde naam is ongeldige IFC. Heeft de taak geen toewijzingen meer, dan krijgt ze een pset
met alleen deze sleutels. In `checkedBytes` eist `unusedKeysProblem` per bestaande taak in de herlezing van de uitvoer
dezelfde waarden onder de namen die de regel geeft, en weigert `duplicateAssignmentKeyProblem` elke naam die in
`OPS_Assignments` vaker voorkomt dan in de bron, ook een eigen sleutel naast een vreemd lid (beide `uitvoer-controle`).
De nieuwe bron neemt de lijst uit die herlezing. Een gewiste taak neemt haar sleutels mee (op de wijzigingslijst);
na Ctrl+Z komen ze nog niet terug (knownbug 2354). Zonder vreemd deel schrijft de gewone writer ze niet, zoals op main; een paar bronvormen weigeren nog
(knownbug 2210). Proef: `check-ifc-foreign-ongebruikte-sleutels.ts`.

### Tokens per slot van een ander programma (#804 fase 2, `sourceSlots`)

`ifcSource.sourceSlots` (ontwerp §4.5) bewaart van elk D- en R-stuk van vreemde herkomst (`cls.foreignOrigin`: de owner
history wijst niet naar de applicatie `'OPS'`) het entiteittype, de tabel en de ruwe tokens per slotnaam, als `Map` op het
bron-`#id`; de `IfcTaskTime` van een taak en de `IfcLagTime` van een relatie staan onder `owned` van hun eigenaar,
alleen bij een directe verwijzing met het id zoals het er staat (zoals de lezer: een lijst of een voorloopnul geeft geen
taaktijd en geen `owned`).
`foreign/sourceSlots.ts` leest ze met het register (`slotTableOf` in `ifcSlotTables.ts`: per bronregel precies één
tabel, een werkschema op `isBaselineWorkControl`). Een stuk in een oude lay-out of met de oude letterlijke codering
(§4.9) krijgt geen tokens. Alleen op twee plekken: bij openen van een bron met een vreemd deel (`scanForeignToOpen`, ook
in de Worker) en voor de bron die de writer teruggeeft (`writtenSource` in `mergeWriter.ts`: alleen de regels die de
writer schreef, met een owner history van een ander programma). Een bron zonder vreemd deel heeft het veld niet, zoals op
main; de doelcontrole, de headless routes en de interne scans van de merge verzamelen niets. De scanrunner en de
opslagworker eisen bij een vreemd deel een kaart (een lege is geldig) en weigeren er een zonder vreemd deel
(`isSourceSlots`, in `foreignScanRunner.ts` en `resultFits`). Het crashherstel opent de bronbytes opnieuw en krijgt ze zo
terug; het herstelrecord heeft er geen veld voor. Proef: `check-ifc-source-slots.ts`.

De merge schrijft met de kaart (deel 2 van PR 2, `foreign/sourceSlotWrite.ts`, één regel over de soort uit het register):
een stuk van de kaart krijgt per slot het brontoken of de waarde van de writer. Constant: het brontoken (een `#` alleen
op de vaste lijst, `bronverwijzing`); domein: het brontoken zolang de planner geen veld wijzigde waar de writer dat slot
uit schrijft (regel A: één slot, één beslissing, één veldenlijst; `slotFieldChanged` en `slotHasFields` in `lossCheck.ts`,
dezelfde tabel als de uitleg van O1 voor een stuk uit de kaart, die ook dezelfde wijzigingen leest: `plannerChanged`,
tegenover wat de app na openen liet zien); alleen een slot zonder veldenlijst kijkt of de writer er hetzelfde schrijft als
bij openen (O0). Een tijdveld dat alleen het openen veranderde, krijgt de waarde uit de bronlezing terug
(`sourceFormWhereUnchanged`), behalve bij een taak die bij openen kinderen had en nu geen meer: heropenen telt haar
tijd dan niet meer op uit de kinderen, dus schrijft de writer de taaktijd van de planner, met de duur-eenheid. De
waarde van een lag volgt de schrijfkeuze van de writer: houdt die de dagvorm van de bron
(`sourceDayLagIds`), dan hangt de waarde niet van de eenheid af en blijft `P0.50D` staan. Afgeleid: de writer. Verwijzing: de writer, behalve een gevulde verwijzing naar
een stuk dat de writer niet draagt (niet P, zoals een `IfcTaskTimeRecurring`; regel B, `keepsTarget`): die houdt haar
brontoken zolang de velden van het slot gelijk blijven, en de regel die de writer ernaast schreef vervalt
(`dropReleased`); anders weigert de verliescontrole (`releasesKeptTarget`). Een afhankelijk slot (`volgt`) gaat samen met
zijn hoofdslot. Het entiteittype komt uit de bron als het domein het niet onderscheidt (`sameDomainEntity`: een
`IfcConstructionProductResource` blijft dat). Dat geldt voor de D-stukken met hun vaste id (ook een baselinekop die zijn
id via zijn GlobalId houdt) en hun taaktijd of lag, in O0 en O1 (`buildLines` in `mergeWriter.ts`). Relaties van een
ander programma (`IfcRelNests`, `IfcRelAggregates`, `IfcRelAssignsToControl`, `IfcRelAssignsToProcess`) schrijft de merge
opnieuw met hun bewaarde slots; de leden komen uit wat de writer voor dezelfde relating schreef: een enige `Nests` van
Bonsai volgt de ouder (alle kinderen, in de volgorde van het domein), anders houdt elke bewaarde relatie haar leden die
het domein nog koppelt, en houdt de eigen relatie de rest. Een relatie met de projectkalender (de lezer slaat die over)
houdt de leden zonder eigen kalender. Zonder leden vervalt de relatie. De verliescontrole laat een afgeleid slot en een
verwijzing buiten een relatierol en een groep aan de writer (`writerAlwaysWrites`), een verwijzing alleen als haar doel
P is; de rest toetst zij zoals bij een eigen stuk. Een relatie uit de kaart met een unieke GlobalId paart alleen op die
GlobalId (`guidIsIdentity`): een verdwenen relatie paart niet met een buur, en de ledencontrole verklaart haar. Controle
(c) krijgt de slots die de kaart koos (`chosen`, vastgelegd waar `sourceSlotArgs` beslist); de owner history van een
IfcRoot telt daar niet mee, en `checkedOutput` toetst elke gekozen verwijzing op de hernummerde regel. Een verwijzing
naar een bewaard stuk houdt bij het hernummeren haar token (ook `#00107`). Een stuk met een token dat niet verliesvrij
te lezen is (een rauwe Latin-1-byte), komt niet in de kaart. De nieuwe bron na een opslag neemt haar klassen uit de
uitvoerscan en toetst dat precies de geschreven regels P zijn. `vreemde-herkomst` blijft voor wat de
kaart niet draagt: een oude lay-out, de oude letterlijke codering, een vorm buiten het register (een
`IfcLaborResource` met 10 argumenten) en een `IfcRelDeclares` of `IfcRelDefinesByProperties` van een ander programma
(knownbug 2233). `entiteittype` blijft als de planner het type van een resource wijzigt. Proef:
`check-ifc-source-slot-write.ts` (de regel en de rest per slot over het hele register).

Regel C, waar regel A en B onder vallen: de opslag verandert de verwijzingen tussen bewaarde stukken van een ander
programma niet, behalve waar de bewerking het verklaart. Elk stuk dat ernaar wees, wijst er nog naar (ook een eigen
stuk; geeft OPS dat opnieuw uit met een nieuwe GlobalId, dan neemt een nieuw eigen stuk van hetzelfde type die rol in
hetzelfde slot over), een gedeeld hulpstuk blijft gedeeld, en het stuk wijst nog naar dezelfde stukken. Verklaard is
alleen wat bij een gewiste toewijzing, relatie of taak hoort, en de verwijzer van een gewijzigd veld. De herkomst van een
toewijzing is de enige bronrelatie met die taak en die resource (`assignmentOrigin` in `foreign/assignmentOrigin.ts`:
één beslissing voor de writer en de verliescontrole). Staat het paar in meer dan één relatie en veranderden de
toewijzingen van dat paar, dan weigert de merge met `niet-eenduidig` (`foreignRelations` in `mergeWriter.ts`) en
verklaart de verliescontrole niets (`expectedProcessMembers` in `lossCheck.ts`); knownbug 2368. Een P-hulpstuk achter
een verwijzingsslot van een stuk uit de kaart dat twee verwijzers deelt, weigert de merge vooraf met `niet-eenduidig`
(`sharedHelpers` in `prepareIfcWrite`; knownbug 2369); een opslag zonder wijziging in de planning (ook na ongedaan maken)
komt daar niet: de merge geeft dan de bronbytes terug (`planningCanon` gelijk aan wat de app na openen liet zien). De
volgorde telt per geordend slot: de kinderen van een `IfcRelNests` blijven in hun volgorde, behalve bij de ouder waar de
planner ze versleepte. Een nieuwe toewijzingsrelatie staat in de uitvoer na de bewaarde toewijzingsrelaties van de taken
die in het domein vóór haar taak staan (`assignmentPlacement` in `mergeWriter.ts`), zodat herlezen de toewijzingen in de
volgorde van de planner geeft; die volgorde tussen taken is zichtbaar (de optelvolgorde van belasting en van de totalen per
resource in MCP, `getAssignments` voor extensies, de UID's van MSPDI). Proef: `check-ifc-foreign-regel-c.ts` bouwt de verwijzingsgraaf
van bron en uitvoer (`tests/planning/ifcRegelC.ts`) over twaalf bronnen en elke bewerking op elke plek waar ze kan; de
pinproef gebruikt dezelfde toets.

Kosten: evenredig met het aantal stukken van een ander programma én met de gedecodeerde lengte van hun regels
(`argTokens` decodeert en splitst de hele regel, ook een ledenlijst van 50.000). De reviewer van #1196 (GPT-6.2-Sol) mat
bij 10.000 vreemde taken met taaktijden ongeveer 18,7 MiB extra V8-heap na GC, bij een IFC van 1,51 MiB; bij
`fix2-vendor-ops.ifc` (369 stukken) ongeveer 335 KiB. De kaart reist gekloond naar en van de opslagworker. Gemeten in
deel 2 (aia09-mp50 onder zware belasting, dus ruwe tijden): 10.000 vreemde taken met taaktijden (2,09 MiB) openen 3,0 s,
opslaan 27,3 s met een piek-RSS van 1.157 MiB; vóór de writer weigerde die opslag na 50,6 s met een piek van 686 MiB,
vóór het herlezen van de uitvoer. `bonsai-4d.ifc` opslaan 141 ms. Fixronde 1 van #1205, twee geslaagde opslagen van
dezelfde invoer naast elkaar: vóór het herstel 28,3 s en een piek-RSS van 1.115 MiB, erna 28,3 s en 947 MiB (één meting per kant onder wisselende
belasting; O1 houdt nu geen tweede kaart met de argumenten van de writer meer vast).

Voor een eigen stuk blijft (b) in de verliescontrole (`planRestores` in `lossCheck.ts`): die leest de bronwaarden bij
elke merge opnieuw uit `ifcSource.bytes`; een stuk van de kaart heeft na de writer geen verschil meer in O0. Bij (b) geldt de waarde van
de planner als hij het veld wijzigde; bij een slot van de soort `lijst`, `json` of `samengesteld` (de lezer draagt er een
deel van) weigert de merge dan, want per lid, per sleutel of per deel samenvoegen volgt met `jsonExtras` en `unusedKeys`.
Paart het stuk in O1 niet eenduidig, of heeft de regel in O1 een ander type of een andere vorm, dan weigert de merge ook.
De merge leest de planning met de bronwaarden erin terug (`mergeWriter.ts`); geeft dat een andere planning dan zonder,
dan weigert hij.

### Gemengde en bewaarde relaties (#804 fase 2, PR 8)

Eén functie bepaalt welke planningsleden een relatie van een ander programma verlaten die geen R is (gemengd, of bewaard
met een relating buiten D): `departuresOf` in `departures.ts`. Ze rekent uit de bronrelatie, de planning bij openen en de
te bewaren planning precies uit wie vertrekt. De writer (stap 4 van `buildLines` in `mergeWriter.ts`) haalt precies
die leden eruit en schrijft hun plek of koppeling in een eigen relatie; controle 1 (`changeListProblems` in
`mergeValidation.ts`) eist dat de uitvoer precies die leden mist, niet meer en niet minder, ook bij een stuk dat niet op
de wijzigingslijst staat (review ronde 2 van #1262: eerst een toestemming, nu een exacte uitkomst). Per vorm vertrekt een
lid als zijn eigen koppeling veranderde: Nests onder een taak (andere ouder), Nests onder een schema (geen wortel meer),
Process onder een taak (het aantal toewijzingen van die resource bij de taak veranderde), Control onder een kalender
(andere kalender) en een bewaarde Nests buiten D (andere ouder). De gedeelde pset (b, stap 5) gaat zoals op main: bij
gelijke waarden blijft de gedeelde relatie bytegelijk en vervalt de eigen pset, bij andere waarden weigert de writer met
`gemengde-relatie` (knownbug 2385; besluit van Trias na review ronde 3). Bij Nests en Process onder een taak vertrekt een gebleven lid
ook als de volgorde het onmogelijk maakt: de lezer leest de eigen relatie vóór de gemengde, dus alleen de langste staart
van de kinderen of toewijzingen van het domein die in dezelfde volgorde in de bronrelatie staat, kan blijven
(`keptTail`; die kijkt per relatie, knownbug 2386). Is die lijst ongewijzigd, dan vertrekt niemand: de bron had die vorm al. Kan de functie het niet eenduidig
zeggen (een D-lid van een andere soort, dezelfde resource twee keer in één relatie, of een gebleven resource met meer dan
één toewijzing bij een gewijzigde lijst), dan weigert de writer met `gemengde-relatie`. Aggregates onder het werkplan en
Control onder het schema hebben geen wijziging die het domein kan uitdrukken. Een vreemd lid dat de lezer na opslaan als
eigen veld of code zou lezen, vervalt (`readAsOwnMembers`). `withLeaving` voegt dit bij de uitkomst van
`applyForeignRule`: één wijzigingslijst, één telling (§4.7); een relatie zonder leden vervalt. Een vervallen vreemd lid
alleen als zijn pset één eigenaar heeft, de planning een nieuw veld of codetype met die naam heeft, en de uitvoer bij elke
oorspronkelijke binding minstens zo vaak een eigen property met die naam heeft; bij meer eigenaren weigert de writer met
`vreemd-lid`. Een relatie met een vreemde relating (bijvoorbeeld een kostenpost) valt daar niet onder. De Control van een
tweede schema houdt een verplaatste taak, zoals op main (knownbug 2356). Ctrl+Z na het opslaan zet een lid niet terug:
`detached` onthoudt de vertrekkers niet (`ruleChangesOnly`, knownbug 2355). Controle 1 eist bij een teruggezet stuk de
bytes van `detached` en laat het buiten de toets op stukken die niet op de lijst staan. Proef:
`check-ifc-foreign-gemengde-relaties.ts` (per vorm en soort wijziging, vaste reeksen, tien gemuteerde uitvoeren).

### Vergelijkingsklok (#804 fase 1c)

`planningCanon` gebruikt alleen `writeIFCForComparison`: één vaste datum via de interne schrijfkern,
ook voor owner history, lege planstart en baselines zonder eigen datum. Gewone schrijfingangen geven
geen vergelijkingsdatum mee. Projectdatums en bestaande baseline-aanmaakdatums blijven meetellen.
`pristineFromScan` krijgt bij interne merge-herlezingen de projectdatums van het openen als terugval;
`OPS_ProjectSettings.CreatedAt/ModifiedAt` overschrijven die wanneer aanwezig. Gewoon openen blijft
ontbrekende datums met de echte klok vullen. `check-ifc-foreign-klok.ts` bewaakt beide klokgrenzen,
bronidentieke bytes en de gewone/download-/site-uitvoer zonder vaste vergelijkingsdatum.

### Twee grenzen: de drempel voor de waarschuwing en de technische grens (#804, knownbug 1936)

Twee getallen, elk op één plek:
- **De drempel voor de waarschuwing** `IFC_FOREIGN_OPEN_WARN_BYTES` (`src/services/ifc/foreignOpenSize.ts`): 150 MiB
  (binair, `IFC_FOREIGN_OPEN_WARN_MIB`). Besluit van de eigenaar, 24 november 2026: boven deze grootte opent een bestand
  met een gebouwmodel of vreemde gegevens gewoon, met een waarschuwing zonder timer (van 21 tot 24 november weigerde
  openen hier). Eén toets, `opensLargeForeignSource`: de bron van een gelezen document heeft `ifcSource.foreign` en is
  groter dan de drempel (`>`); geen tweede scan. De proefnaad `lowerForeignOpenWarnBytesForTests` verlaagt alleen die
  vergelijking; het getal in de tekst is altijd `IFC_FOREIGN_OPEN_WARN_MIB`. De tekst belooft niet dat het bestand op
  schijf gelijk blijft als opslaan mislukt (review van #1203, ronde 1): ze zegt dat recente wijzigingen verloren kunnen
  gaan. De melding `notifications.ifcForeignOpenLarge` loopt mee in de
  keten van openingsmeldingen (`withLargeForeignOpenNotice` in `applyOpenedImport`; ADR 0071: een regel onder een
  bestaande openingsmelding, anders een eigen melding) en heeft geen timer via `STICKY_OPEN_NOTICE_KEYS`; de stapel van
  drie en de samenvouwing kunnen haar wel verdringen (knownbug 2253). Het kanaal kent
  geen aparte ernst voor een waarschuwing; zoals de andere verlieswaarschuwingen is ze `info` met `sticky`. Zo krijgt
  elke route die een nieuw document opent haar: Bestand → Openen, Recent, slepen en het startbestand, de dev-link, de
  site en `planner_import_schedule` in de app. Een wissel naar een tabblad waarin het bestand al open staat, opent niets
  en waarschuwt niet. Het crashherstel opent zijn bron in een eigen storecontext (`recoveryDocumentWithSource`), net als
  de kern, de mergecontrole en de headless MCP-server: hun melding bereikt het scherm niet. `planner_import_schedule`
  zet de waarschuwing in de app ook in `notice` (`McpFileFs.warnsLargeForeignSource`, gezet door `realFs`); de headless
  server niet, die gelijk blijft aan main. Met de flag uit is er geen `ifcSource` en dus geen waarschuwing.
- **De technische grens** `IFC_FOREIGN_SCAN_MAX_BYTES` (`foreignScan.ts`, ook `IFC_BYTES_ROUTE_MAX_BYTES`): 300 MiB, zoals
  main. Bytes-route, scanner, doelscan, crashherstel en headless gebruiken alleen deze, ongewijzigd. Daarboven weigert
  openen een bestand met een gebouwmodel of vreemde gegevens, met de melding van main.

Een planning zonder gebouwmodel en zonder vreemde gegevens krijgt de waarschuwing niet. De uitvoer van opslaan heeft geen
grens; een bestand dat door opslaan boven de drempel komt, opent daarna met de waarschuwing. Bewaakt in
`check-ifc-foreign-grens.ts` (de drempel verlaagd met de proefnaad `lowerForeignOpenWarnBytesForTests`, door de echte
routes en de echte herstelvraag; boven de technische grens met een nagebootste lengte), `check-one-file-one-tab.ts` (een
al open model boven de drempel), `tests/mcp/cases-doc-file.ts` (de app) en `tests/mcp/cases-headless-server.ts`
(headless zonder waarschuwing).

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
bestand volgt de gewone grammatica. IFC schrijven met een vreemd deel gebruikt uitsluitend de voorbereide document- en volledige exportroutes; een bestaand lokaal doel vervangen ze alleen langs `replaceOwnPathWithRecovery` (hieronder).
Een UTF-8-BOM op byte 0 slaat de scanner (`stepScanner.ts`) over: hij hoort bij het kopstuk, dat de merge byte-gelijk
terugschrijft (fixronde 1 van #1184). Elders buiten tekst blijft een BOM een scanfout. De oude-kopherkenning van de
C/A/V-scan (`foreign/oldOwnHeader.ts`) kijkt na die BOM en maskeert op absolute posities; `recognizeOldOwnHeader`
zelf, de datasectievinder en de doelscan als stroom zijn ongewijzigd. De doelscan (`targetForeignScan.ts`) houdt
een bestaand doel dat met een BOM begint 'unreadable', zoals main. Regel voor het eigen bestand (knownbug 2212, PR
#1213): een eigen bestand met een BOM gedraagt zich bij Ctrl+S, *Opslaan* in de sluitvraag en Automatisch opslaan als
hetzelfde bestand zonder BOM op main; alleen blijft de BOM staan. Het contract (fixronde 3): aan het begin van de
poging legt de app de versie van het eigen bestand vast als waarde (`ownBomVersion`: de bekende versie in
`knownTargetFingerprint` als die met een BOM begint, `utf8Bom`; Ctrl+S bij de momentopname van `writeActiveDocument`,
Automatisch opslaan bij het kiezen van de kandidaat in `listPlain`). Die ene waarde bepaalt twee dingen. De doelscan laat
een BOM alleen door als de bytes die hij zelf las precies die versie zijn: lengte en SHA-256, in de scan
(`isOwnBomVersion` in `targetForeignScan.ts`). Daarnaast komt de BOM direct na het antwoord van de writer vóór zijn bytes
(`withUtf8Bom`; met de opslagworker ook de hash van die bytes), dus vóór de eerste lezing van het doel. Na het vastleggen
leest de poging hiervoor niets meer uit de store; een flagwissel of een gewiste vingerafdruk verandert de toestemming
niet. Verder is de route letterlijk die van main, met dezelfde lezingen, redenen en meldingen; tussen de laatste lezing
en de bestandslaag gebeurt niets wat main daar niet doet (het gat van knownbug 2069). Opslaan als en export over een
BOM-bestand blijven 'unreadable', net als elke andere BOM-versie op het eigen doel; zonder bekende versie ook Ctrl+S
(knownbug 2358), en op de site (knownbug 2359). De
merge houdt de BOM zelf, in het kopstuk. Proef van de regel: `check-ifc-bom-eigen-bestand.ts` tegen een opname van main
(`scripts/proef/maak-main-bom-eigen-bestand.mjs` schrijft `tests/planning/fixtures/main-bom-eigen-bestand.json`; de
gevallen staan in `bomEigenBestand.ts`). Verandert de writer of de opslagroute op main bewust, maak de opname dan
opnieuw met een nieuwe `BASIS` en zeg dat in de PR.
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
record. Afsluiten en de updater wachten erop (#987). Na de eerste herstelronde, vóór de eerste schrijfactie in de
projectmap, `stopBeforeWrite` = dezelfde `documentTargetCheck(momentopname, write, true)` als vóór de merge (fixronde 1
van #1008): document en bron ongewijzigd (`refuseChangedDocumentWrite`), `saveTargetRef` nog dit pad (`movedOwnTarget`,
`sameFileRef`) en geen ander open document met dit bestand als bron (`refusedWriteTarget`). Anders de melding van die
bewaking en uitkomst `stopped`, niets in de projectmap. Volgorde met openen: `readOpenedTauriPath` (`tauriBackend.ts`,
waar dialoog, neerzetten en Recent samenkomen) wacht vóór het lezen op `whenProjectFileWritesIdle`; geen opslagroute
leest erdoor, dus de schrijfrij wacht nooit op zichzelf. Een lezing die al vóór de opslag liep: knownbug 1837. `commit` is
`commitSavedDocument(ref, momentopname, undefined, prepared)`; zijn boolean is de uitkomst van de opslag en dus de
sluitbeslissing (een bewerking tijdens de opslag: de geschreven versie wordt de bron, het document blijft gewijzigd).
Elke andere uitkomst meldt via `ownPathReplaceNotices` en stopt; nooit de gewone schrijfroutine (die schrijft op naam).
Automatisch opslaan met een gebouwmodel (#804 stap 8) neemt dezelfde vervanging, met een eigen beleid voor een oud record
en de grens van de voorrang op `stopBeforeWrite` (zie `settings-autosave.md`); Exporteren → IFC en `planner_export_ifc`
over een andere bestaande naam ook (zie *Exporteren → IFC over een andere bestaande naam*). Proeven: `check-ifc-own-file-replace.ts` (onderaan), `check-ifc-document-save.ts`,
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
Opslaan als naar een nieuwe naam; daarna Recent. `save-as-only` (buiten de scope van de kiezer, knownbug 1762; een
harde link, ook op Windows via `nNumberOfLinks` in `place_file_exclusive`; `unsupported`, `refused`) ⇒
`ifcForeignNewTargetOnly`; de andere uitkomsten de meldingen van Ctrl+S. Met de flag uit gaat een document zonder vreemd
deel langs de gewone kiezer van main (`documentSaveDialog`, `saveDataDialog` → `writeUserFileTauri`), zonder
toestemming, en geldt de volgorde van de weigerredenen van main (zie hieronder). Ctrl+S met een opslagdoel, Automatisch opslaan, de exports van een planning zonder vreemd deel en de dev-bridge geven
geen toestemming en weigeren een doel met een gebouwmodel zoals voorheen; Exporteren → IFC van een document met een
vreemd deel en `planner_export_ifc` met `overwrite: true` wel (hieronder). Afhandelen na een crash gaat via het record, ook
als het doel in deze sessie nooit geopend was. Proeven: `check-ifc-own-file-replace.ts` deel c.

**Exporteren → IFC over een andere bestaande naam (#804, besluit van de eigenaar, 21 november 2026).** Alleen desktop,
flag aan, een document met een vreemd deel (`preparedExport`). Opslaan als en deze export delen één functie,
`placeOnDesktop` (`fileSlice.ts`, geeft `SaveOutcome | null`): de kiezer met de doelwaarneming, de doelcontrole met die
waarneming, pas daarna de bytes, en dan de vervanging, de exclusieve aanmaak of de weigering zoals hierboven. De route
geeft de doelcontrole, de late controle, het document voor het manifest, de commit en de meldingen mee. De export:
- **Bevestiging.** Dezelfde waarneming als Opslaan als: de versie die `pickSaveTarget` direct na de keuze leest, is de
  bevestigde (maat a van Trias, fixronde 2 van #1179; geen tijdstempels). Stond er toen niets, dan de exclusieve aanmaak
  (een later verschenen bestand blijft staan, `exportReplaceNewTargetOnly`). De grens vóór die lezing: knownbug 2208.
- **P1.** `exportTargetPermission(bron, waarneming)` (`ifcForeignGuard.ts`) is de ene exportregel voor de toestemming:
  `chosenTarget` plus `protectModelTargets` als de uitvoer geen gebouwmodel draagt (`hasBuildingModel`). Dan blijft een
  doel met een gebouwmodel geweigerd, ook bevestigd; een doel met alleen gegevens van een ander programma niet.
- Doelcontrole `exportTargetChecks(momentopname, toestemming)` (`foreignTargetCheck` met één scan van de vastgelegde bytes,
  `capturedTargetReaders` in `foreignSourceTarget.ts`, daarna `refuseChangedExport`), late controle `refuseChangedExport`,
  `documentId: null` (alleen het herstelrecord, geen `pendingSha256` in het manifest) en een lege commit: bron, kenmerk,
  doel, dirty-vlag en kalenderkeuzes blijven staan; daarna Recent, zoals elke export.
- **De haak `planningChanged`** (alleen de export; `replaceOwnFileBytes`, na het opzijzetten van het doel en vóór de
  plaatsing): vraagt alleen of de planning sinds de opdracht veranderde (`exportPlanningChanged`, zonder melding en zonder
  vlag- of doelcontrole). Zo ja: het doel exclusief terug op zijn plek, het tijdelijke bestand weg, uitkomst
  `planning-changed` (de aanroeper meldt `ifcExportChangedWhileWaiting`); lukt het terugzetten niet, dan
  `previous-stranded` en blijven het record en de hulpnaam. Zonder haak (Ctrl+S, Opslaan als, Automatisch opslaan) loopt
  de route aanroep voor aanroep als voorheen (proef: de reeksen aanroepen in `check-ifc-own-file-replace.ts`).
- **De vlag tot de plaatsing** (`replaceAllowed`, alleen de export, los van de haak): direct na de haak, in dezelfde
  synchrone stap. Staat `ifcForeignContent` uit, dan dezelfde terugzetstap, uitkomst `replace-withdrawn` (de melding van
  main bij de flag uit, `ifcForeignSaveBlocked`). `tauriOwnFileReplaceFs` laadt `invoke` vooraf
  (`placeFileExclusiveWith`), zodat haak, vlag en de aanroep van de definitieve plaatsing geen `await` scheidt; wat
  overblijft is knownbug 2247.
- Het eigen bestand van het document blijft geweigerd; bij de IFC-exports van de planning (`exportTargetChecks`: ook
  zonder gebouwmodel en het planningsbestand van de export met bibliotheek) met `exportTargetOwnFile`, dat naar Opslaan
  verwijst. Andere formaten en de afzonderlijke bibliotheekuitvoer houden hun zin.
Een planning zonder vreemd deel krijgt geen toestemming en blijft op `saveDataDialog`, zoals main. Een mislukte vervanging
meldt met de exportzinnen van `exportReplaceNotices` (`state/ownFileReplace.ts`, "Niet geëxporteerd"); een link en
`save-as-only` geven `exportReplaceNewTargetOnly`. Na een crash handelt het herstel de hulpnamen af zoals bij Opslaan als
(de naam van de kopie: knownbug 2207). `planner_export_ifc` doet hetzelfde met `overwrite: true` via
`McpFileFs.replaceUserBytes` (`mcp.md`). Proeven: de gevallen "Exporteren → IFC over …", P1 en de haak in
`check-ifc-own-file-replace.ts`, `check-ifc-document-save.ts`, `cases-doc-file.ts` en `run-real-app.ts`.

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
controle niets en maken Opslaan als en Exporteren het bestand af (knownbug 1893). Openen gaat met de flag aan altijd naar het tabblad dat een
bestand al open heeft, met een strook als de gelezen versie verschilt (`openDocumentFor.ts`, knownbug 1957; de beslissing
staat in `state.md`). Regel: de PR voegt geen wachtmoment en geen bestandsaanroep toe aan de openactie, ook niet aan de
native kant (besluit D, review #1121 ronde 6). De desktop kijkt bij het openen niet naar de schijf: geen `stat`, geen
`fileIdentityFs` in een openroute; Openen, Recent, slepen en `planner_import_schedule` lezen regel voor regel zoals main
(eerst de schrijfrij, `whenProjectFileWritesIdle` in `tauriBackend.ts`, dan de herstelrecords, dan één lezing;
`planner_import_schedule` leest via `realFs` buiten die rij om, ook zoals main: knownbug 2060). De versie komt uit de al
gelezen bytes (`ifcSource.sha256`), niet uit een tweede lezing. Alleen de browser heeft een asynchroon deel
(`startOpenLookup`); het start synchroon vlak vóór het lezen en niets wacht erop: de haak `beforeRead` van
`openFileDialogWeb`, die van `DroppedFile.read` in `webDroppedFile`, en in `openRecentFile` vóór de vraag om leesrechten.
Met de flag uit gaat elke route langs de lijn van main. Een tweede tabblad op hetzelfde bestand kan er nog zijn
(crashherstel, een tabblad zonder bekende versie, een ander pad naar hetzelfde bestand: knownbug 2063, kruisende
openacties in de browser: knownbug 2041; een late toets: 2062), dus de doelbewaking blijft nodig. Opslaan als op de site maakt altijd een
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
