# Headless MCP-server

De headless MCP-server geeft een MCP-client (Claude Code, Claude Desktop, een agent op een server)
dezelfde `planner_*`-tools als de MCP-koppeling in de desktop-app. Hij draait op Node, zonder app,
zonder browser en zonder Tauri. De client plant dan direct in een IFC-bestand op schijf.

Dit document hoort bij issue #570. Besluit eigenaar (Nozzit, 2026-10-23): volledig headless bouwen.
Grens: alles wat zonder scherm zin heeft. Gantt, dialogen, lint, afdrukken en PDF horen er niet bij.

## Bouwen en starten

```bash
npm run build:mcp-server                       # → dist-mcp-server/
node dist-mcp-server/server.mjs --help
```

De build levert één zelfstandig bestand, `server.mjs`. Het draait met alleen `node server.mjs`:
zonder repo, zonder `node_modules` en zonder paden naar de repo. Naast het bestand staan een kleine
`package.json` (met `bin: open-planner-mcp`), de licenties, `THIRD-PARTY-NOTICES.md` en een README.
De teksten die een tool tijdens het draaien leest (de agentgids en de skills `goed-plannen` en
`progress-update` voor `planner_get_planning_guide`), zitten in de bundel.

Node 22 of nieuwer. Er wordt niets gepubliceerd (geen npm, geen release-asset).

## Opties

Elke optie werkt als CLI-vlag en als omgevingsvariabele. De vlag wint.

| vlag | omgevingsvariabele | standaard | wat |
|---|---|---|---|
| `--transport stdio\|http` | `OPS_MCP_TRANSPORT` | `stdio` | transport |
| `--root <map>` | `OPS_MCP_ROOT` | huidige map | werkmap: de enige map waarin de bestandstools lezen en schrijven |
| `--host <adres>` | `OPS_MCP_HOST` | `127.0.0.1` | alleen HTTP; alleen loopback (`127.x.x.x`, `::1`, `localhost`) |
| `--port <n>` | `OPS_MCP_PORT` | `3878` | alleen HTTP; `0` = een vrije poort |
| `--token-file <bestand>` | `OPS_MCP_TOKEN_FILE` | — | alleen HTTP; bestand met het Bearer-token |
| — | `OPS_MCP_TOKEN` | — | alleen HTTP; het token zelf (geen vlag: een vlag is zichtbaar in `ps`) |
| `--data-dir <map>` | `OPS_MCP_DATA_DIR` | gegevensmap per gebruiker | waar de MCP-backups komen (`<map>/ai-backups/`) |
| `--no-backup` | `OPS_MCP_BACKUP=off` | aan | geen MCP-backup vóór de eerste wijziging per document |
| `--read-only` | `OPS_MCP_READ_ONLY=1` | uit | elke wijzigende tool geeft `READ_ONLY` |
| `--open <bestand>` | `OPS_MCP_OPEN` | — | open dit bestand bij de start (pad in de werkmap) |
| `--version`, `--help` | — | — | versie of hulp tonen en stoppen |

De standaard gegevensmap is `$XDG_DATA_HOME/open-planner-studio-mcp` (Linux, anders
`~/.local/share/…`), `~/Library/Application Support/open-planner-studio-mcp` (macOS) of
`%LOCALAPPDATA%\open-planner-studio-mcp` (Windows).

Een HTTP-token is verplicht en heeft minstens 32 zichtbare ASCII-tekens, bijvoorbeeld
`openssl rand -hex 32`. Zonder geldig token, of met een `--host` die geen loopback is, start de
server niet (exit 2).

## Een MCP-client koppelen

**Claude Code (stdio).**

```bash
claude mcp add open-planner -- node /pad/naar/server.mjs --root /pad/naar/planningen
```

**Claude Desktop (stdio).** In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-planner": {
      "command": "node",
      "args": ["/pad/naar/server.mjs"],
      "env": { "OPS_MCP_ROOT": "/pad/naar/planningen" }
    }
  }
}
```

**HTTP.** Start met `OPS_MCP_TOKEN=<token> node server.mjs --transport http`. Het endpoint is
`http://127.0.0.1:3878/mcp`, transport *streamable HTTP*, header `Authorization: Bearer <token>`.
Claude Code: `claude mcp add --transport http open-planner http://127.0.0.1:3878/mcp --header "Authorization: Bearer <token>"`.

## Werken zonder app: wat anders is

- **Eén planning in het geheugen.** De server begint met één leeg document. `planner_import_schedule`
  opent een bestand als document; `planner_new_document`, `planner_switch_document` en de andere
  documenttools werken zoals in de app.
- **Opslaan.** Er is geen opslagcommando en geen automatisch opslaan. De agent schrijft het actieve
  document met `planner_export_ifc`; `overwrite: true` vervangt het geopende bestand. Wat niet
  geëxporteerd is, is weg als de server stopt.
- **Paden.** In de toolbeschrijvingen staat "home folder". In de headless server is dat de werkmap:
  `~/plan.ifc` is `<werkmap>/plan.ifc`. Een absoluut pad moet in de werkmap liggen. Een relatief pad
  weigert de tool, net als in de app. UNC-/netwerkpaden en Windows-devicepaden worden expliciet
  geweigerd: kies een lokale werkmap en een lokaal absoluut bestandspad. De tool zet een netwerkpad
  nooit om in een lokaal pad.
- **Instructies.** `initialize.instructions` bevat de vaste instructies van de app plus een korte
  headless uitleg (werkmap, opslaan, geen gebruikersinterface).
- **Veiligheidsvlaggen.** `--read-only` zet `ui.aiReadOnly`. `paused` blijft altijd `false`: er is
  geen knop om te pauzeren. Dialogen bestaan niet, dus `DIALOG_OPEN` komt niet voor.
- **Undo.** `planner_undo` en `planner_redo` werken op de undo-stapel van het document in het
  geheugen.

## Beveiliging

**HTTP.** Hetzelfde contract als de bridge in `src-tauri/src/mcp_bridge.rs`: alleen loopback; een
request met een `Origin`-header krijgt 403 (bescherming tegen DNS-rebinding); alleen `POST /mcp`
(anders 405 of 404); het Bearer-token wordt in constante tijd vergeleken (401); body tot 50 MiB (413);
strikt één request tegelijk, met een antwoordtimer van 120 s (zie de beperking hieronder). Sessies via `Mcp-Session-Id`:
elk request behalve `initialize` zonder header krijgt 400, een onbekende sessie 404. Het
documentanker (`DOC_DRIFT`) leeft per sessie.

**Geen harde uitvoeringstijdgrens.** De antwoordtimer wordt pas gestart nadat de body is gelezen en
het request aan de beurt is in de HTTP-wachtrij; die voorafgaande wachttijd telt dus niet mee. De timer
gebruikt de Node-eventloop. Als die vrij kan draaien en er geen antwoord is, kan de timer na circa
120 s een 504 leveren. Synchrone verwerking, waaronder `readFileSync`, `writeFileSync` en `fsyncSync` in de
gebonden bestandsroute, kan diezelfde eventloop blokkeren. Tijdens zo'n blokkade staan ook andere
sessies stil en kan de timer niet afgaan: 120 s is geen gegarandeerde bovengrens, ook niet op trage
of vastgelopen opslag. Zie [Node-timers](https://nodejs.org/api/timers.html#scheduling-timers).

Een 504 beëindigt het HTTP-wachten, maar onderbreekt geen al gestarte toolbewerking. Behandel dat
niet als bewijs dat er niets is gewijzigd: controleer de planning en eventuele doelbestanden vóór
het opnieuw uitvoeren van een wijzigende opdracht. De headless server is hiermee niet getest of
geschikt verklaard voor harde opslagdeadlines. Metingen op grote bestanden/trage opslag en een
mogelijke geïsoleerde uitvoeringsopzet blijven apart vervolgwerk (knownbug 218); de scopecontroles
mogen daarvoor niet worden afgezwakt.

**stdio.** Eén proces is één client en één sessie. stdout is alleen voor het protocol; alle
logging gaat naar stderr.

**Bestanden.** Twee poorten vóór elke lees- of schrijfactie:

1. Lexicaal (`checkScope` in `fileTools.ts`, dezelfde code als de app): het pad wordt
   genormaliseerd (`..`, `.`, `~`) en moet in de werkmap liggen.
2. Fysiek (`check` in `headless/mcp-server/src/nodeFs.ts`, vóór elke operatie): de `realpath` van het
   pad, of van de dichtstbijzijnde bestaande bovenmap, moet in de `realpath` van de werkmap liggen. De
   vergelijking is exact, teken voor teken. Er is geen aanname over hoofdletters per besturingssysteem:
   een hoofdlettergevoelig volume op macOS bestaat, en een link naar `plans` naast `Plans` ligt buiten.
   Een andere schrijfwijze van een bestaand pad wordt dus geweigerd, nooit toegelaten. De server weigert
   met `SCOPE`: een symlink of junction naar buiten, een dode link, een bestand met meer dan één harde
   link (dan is niet te bewijzen dat elke naam in de werkmap ligt), en een bestand dat in de app open
   staat (slot-haak, nu altijd vrij).

**De operatie is gebonden aan de ligging.** Poort 2 is een controle vooraf. Een ander proces kan daarna
een map door een link vervangen, of een map mét inhoud naar buiten verplaatsen en een link terugleggen.
Node kent geen `openat` of `renameat`, maar wel de procesmap: die wijst naar een map-object, niet naar een
pad. Elke bestandsoperatie loopt daarom in één synchroon blok (er draait geen andere code tussendoor; de
procesmap wordt erna teruggezet voor zover de oorspronkelijke map of de terugval nog bestaat):

1. `chdir` naar de echte map van het bestand. Ontbrekende mappen maakt de server één voor één aan, elk
   relatief aan de vorige.
2. `realpath('.')` (native) moet in de werkmap liggen, en de werkmap moet nog dezelfde `dev`/`ino` hebben.
3. Openen, aanmaken en hernoemen gebruiken alleen de bestandsnaam, relatief aan die map, met
   `O_NOFOLLOW`. De server lost geen mappad meer op. Een gelezen bestand moet dezelfde `dev`/`ino` hebben
   als bij de controle en precies één harde link.
4. Op Linux moet ook `/proc/self/fd/<fd>` van het geopende bestand in de werkmap liggen.
5. Stap 2 herhaalt zich na het lezen, vlak vóór de `rename` (samen met: het gevraagde pad wijst nog naar
   deze map, de naam van het halffabricaat wijst nog naar het eigen bestand) en direct na de `rename`.

Wat overblijft, per besturingssysteem:

- **Linux.** Een proces dat de map van het doel naar buiten verplaatst NA de laatste controle en vóór de
  `rename`, kan de server niet tegenhouden. De `rename` gebeurt dan in die verplaatste map: hetzelfde
  map-object dat bij de controle in de werkmap lag, niet een map die via een pad of link is gevonden. De
  server merkt de verplaatsing direct na de `rename` en de tool geeft een fout; terugdraaien kan hij niet.
  Bij lezen geeft de server niets terug als de map of het bestand na het lezen buiten ligt. Een bestand
  dat een ander proces van buiten in de werkmap zet, leest de server wel; dat proces had het ook zelf
  kunnen lezen.
- **macOS.** Hetzelfde als Linux, zonder stap 4: `realpath('.')` komt van `getcwd`, het pad dat de kernel
  voor de procesmap kent. Niet getest in CI (de tests draaien op Linux).
- **Windows.** Node maakt van een relatief pad weer een absoluut pad met de tekst van de procesmap.
  Openen en hernoemen gaan daar dus wel via een pad, en `O_NOFOLLOW` bestaat er niet. Wat blijft: de
  controles van stap 2 en 5 vóór en na elke stap. Tussen zo'n controle en de operatie kan een proces een
  map door een junction vervangen; de controle erna ziet dat, maar de operatie is dan al gebeurd. Windows
  laat een map die een procesmap is niet hernoemen of verwijderen; dat beperkt het venster (VERMOED, niet
  getest). Niet getest in CI.

**Procesmap terugzetten.** Na elke gebonden bestandsoperatie probeert de server de oorspronkelijke
procesmap terug te zetten. Is die verdwenen, dan gebruikt hij de geconfigureerde werkmap als terugval.
Mislukt ook dat, dan blijft de tijdelijke procesmap actief en wordt dit expliciet gemeld. De fout bewaart
zowel een eventuele oorspronkelijke operatiefout als beide herstelfouten; de laatste `chdir`-fout
verbergt dus niet de reden waarom de bestandsbewerking mislukte. Dit is geen garantie dat een verdwenen
map hersteld kan worden. CLI-, backup- en importpaden blijven absoluut.

Wie een tweede proces met schrijfrechten in de werkmap niet vertrouwt, draait de server als eigen
gebruiker of in een container met alleen de werkmap.

**Opslaan is altijd atomair.** Eerst een eigen halffabricaat naast het echte doel, dan `fsync` en
`rename`. Op Linux/macOS volgt daarna een `fsync` van de doelmap, via een handle op het al gebonden
map-object. Mislukt die stap, dan meldt de tool expliciet dat het bestand al vervangen is maar de
crashbestendigheid niet bevestigd is: controleer het opgeslagen bestand vóór opnieuw proberen. Er is
geen rollback na de `rename`. Windows houdt alleen de bestands-fsync; deze POSIX-directoryroute wordt
daar niet uitgevoerd. Dit is geen bewijs tegen echte stroomuitval of weigerende opslaghardware, en
synchroniseert niet de hele keten van eventueel nieuw aangemaakte bovenmappen.
Een link naar een bestand binnen de werkmap blijft een link: het echte doel wordt vervangen.
Mislukt schrijven of `rename` (volle schijf, afgebroken proces), dan geeft de tool een fout en blijft
het origineel byte-gelijk. De server probeert het halffabricaat op te ruimen, in dezelfde map en alleen
als de naam nog naar het eigen bestand wijst. Is die map verdwenen of stopt het proces hard (zoals bij
een crash), dan kan een halffabricaat (`.<willekeurig>.ops-save.tmp`) blijven staan. Anders dan
in de app is er geen terugval op direct schrijven (die terugval in `replaceUserFile` blijft voor de
desktop-app ongewijzigd). De bestaande controle tegen een stille schemawissel via bestandsaliassen
(#519) werkt ook hier: de server levert `dev`/`ino` van het doel.

**Importformaten.** Node heeft geen `DOMParser`. De MSPDI- en P6-XML-lezers van de app gebruiken hem;
de server zet daarom een eigen kleine XML-parser als `DOMParser` (`headless/mcp-server/src/xmlDom.ts`),
met precies wat de lezers gebruiken. Een DOCTYPE met eigen entiteiten weigert hij (geen
entiteit-expansie, geen externe entiteiten). CSV, XER en `.mpp` gebruiken geen browserglobals die in
Node 22 ontbreken (nagelopen: `TextDecoder`, `crypto.subtle` en `structuredClone` bestaan).

**MCP-backups.** Vóór de eerste wijziging per document schrijft de server een IFC-backup naar
`<data-dir>/ai-backups/<document>/`, met hetzelfde uitdunbeleid (`BACKUP_RETENTION`) als de app. De
agent kiest die map niet.

## Tool-inventaris

41 tools. Alle 41 staan in `tools/list`, met dezelfde namen, beschrijvingen, schema's en annotaties
als in de app (`tests/mcp/cases-headless-server.ts` vergelijkt ze). Er zijn geen uitzonderingen.

| groep | tools | stand |
|---|---|---|
| lezen | `get_project_info`, `get_project_overview`, `list_tasks`, `get_task`, `get_critical_path`, `get_calendars`, `list_resources`, `get_resource_histogram`, `list_baselines`, `compare_baseline`, `analyze_delay`, `list_documents` | headless |
| XER-herkomst | `inspect_xer_provenance` | headless |
| taken | `add_tasks`, `update_tasks`, `delete_tasks`, `move_task`, `set_task_splits` | headless |
| relaties | `add_dependencies`, `update_dependencies`, `remove_dependencies` | headless |
| kalender, project | `update_calendar`, `update_project`, `move_project` | headless |
| resources | `manage_resources`, `manage_assignments`, `level_resources`, `clear_leveling` | headless |
| baselines | `save_baseline`, `activate_baseline`, `rename_baseline`, `delete_baseline` | headless |
| documenten | `new_document`, `switch_document`, `duplicate_document`, `undo`, `redo` | headless |
| batch | `batch` | headless |
| bestanden | `export_ifc`, `import_schedule` | met adapter: Node `fs` in de werkmap |
| gids | `get_planning_guide` | met adapter: teksten ingebed in de bundel |

Samen: 38 headless, 3 met adapter, 0 niet van toepassing. (Alle namen beginnen met `planner_`.)

Wat er niet is, omdat het een scherm nodig heeft: Gantt, dialogen, lint, afdrukken en PDF. Daarvoor
bestaat geen tool, ook niet in de app.

## Hoe het gebouwd is

| deel | waar |
|---|---|
| ingang, opties | `headless/mcp-server/src/main.ts`, `options.ts` |
| host: storecontext en host-functies | `headless/mcp-server/src/host.ts` |
| bestandstoegang, slot-haak | `headless/mcp-server/src/nodeFs.ts`, `appLock.ts` |
| XML-parser voor MSPDI en P6 XML | `headless/mcp-server/src/xmlDom.ts` |
| MCP-backups | `headless/mcp-server/src/backupFs.ts` |
| transports | `headless/mcp-server/src/stdio.ts`, `http.ts` |
| bouw en grenscontrole | `scripts/build-mcp-server.mjs`, `scripts/lib/headless-bundle.mjs` |

Geen tweede kopie van toollogica. De server gebruikt de dispatcher, de registry, `runtime.ts`, alle
tools en de requestlaag van de app ongewijzigd. Wat in de app uit Tauri komt, vult de host in via
naden die de app al had of die er voor deze server bij kwamen:

| naad | app | headless |
|---|---|---|
| `fileToolDeps.getFs` (`fileTools.ts`) | Tauri plugin-fs, scope `$HOME` | `nodeFs.ts`, scope = werkmap |
| `McpFileFs.confine` (optioneel, nieuw) | ontbreekt: de Tauri-capability is de harde grens | `realpath`-controle |
| `globalThis.DOMParser` | de browser of webview | `xmlDom.ts` |
| `guideToolDeps.fetchImpl` (nieuw) | ontbreekt: `fetch` op de eigen bundel | ingebedde teksten |
| `createAppBackupService(app, { getFs, autoBackupEnabled })` | `appDataDir` via Tauri | `backupFs.ts` |
| `createRequestHandler` (`requestHandler.ts`) | via Tauri-events en Rust | `http.ts` |

Om de server zonder React, Tauri en de app-singleton te kunnen bundelen, staan deze delen nu in eigen
modules zonder singleton. De oude modules exporteren alles opnieuw, dus de app verandert niet:

- `requestHandler.ts` (sessies, wachtrij, activiteitenlog) uit `server.ts`;
- `context.ts` (`createMcpContext`), gebruikt door `buildMcpContext`;
- `backupService.ts` (de kern) uit `backup.ts`;
- `freshness.ts` uit `staleGuard.ts`;
- `src/state/blockingDialogs.ts` (`isBlockingDialogOpen`) uit `shortcutRegistry.ts`.

De bouw faalt als React, React DOM, `@tauri-apps/*`, `src/state/appStore.ts`, `src/components/`,
`src/hooks/` of de i18n-UI-config in de bundel komt, of als een toolmodule ontbreekt.
`verify:store-boundaries` weigert een waarde-import uit `appStore` in de servercode en in de vijf
modules hierboven. `verify:cycles` kijkt ook naar de servercode.

`tests/mcp/bridgeMirror.ts` (de spiegel van de Rust-bridge voor `cases-externe-client.ts`) gebruikt
nu `http.ts`. Er is dus één Node-kopie van het HTTP-contract van de bridge. Wijzigt `mcp_bridge.rs`,
pas dan `http.ts` mee aan.

## Later: één plugin, drie situaties

Ontwerp op #570 (besluit eigenaar, 2026-10-23). Nog niet gebouwd; de server is erop voorbereid:

- **Schakelstuk.** `handleMessage` (`McpMessageHandler` in `host.ts`) is de enige naad tussen de
  transports en de toolafhandeling: rauwe JSON-RPC in, rauwe JSON-RPC uit. Een schakelstuk komt daar
  vóór en kiest per aanvraag tussen doorsturen naar de bridge van de app en de headless afhandeling.
- **Slot.** `isPathOpenInApp(path)` (`appLock.ts`) wordt vóór elke bestandsoperatie aangeroepen.
  Geeft hij `true`, dan weigert de tool met `SCOPE`. Nu geeft hij altijd `false`; het register van
  open bestanden in de app is apart werk.

## Tests

| test | wat hij bewijst |
|---|---|
| `tests/mcp/cases-headless-server.ts` (deel A) | De host achter `http.ts` doorstaat dezelfde controles als de bridge (`externalClient.ts`): sessies, 400/404, token, Origin, alleen lezen, pauze, documentanker. Verder: de MCP-backup, de opties en de slot-haak. |
| `tests/mcp/cases-headless-server.ts` (deel B) | Bouwt `server.mjs`, kopieert de uitvoer naar een lege map buiten de repo en start hem daar. Over stdio met de officiële SDK-client: `tools/list` = de registry, gids en skills ingebed, een voorbeeld openen → taken en relaties toevoegen → rekenen → opslaan → opnieuw openen → vergelijken, de backup, en de padbeveiliging (buiten de werkmap, `..`, symlinks, dode link, relatief pad). Over HTTP: `tools/list`, fout token, Origin, ontbrekende en onbekende sessie-id, en de startweigeringen. |
| `cases-externe-client.ts` | Ongewijzigd; draait nu via `http.ts`. |

## Niet getest

- Windows en macOS: CI draait de tests op Linux. De padregels voor Windows (stationsletters,
  hoofdletters) en junctions zijn niet op Windows zelf getest.
- Claude Desktop en Claude Code zelf: de tests gebruiken de officiële SDK-client.
- `.mpp` openen via de server: de repo heeft geen `.mpp`-bestand om mee te testen. De lezer gebruikt
  geen browserglobals; MSPDI, P6 XML, CSV en XER zijn wel getest.
- De wissels tussen controle en bestandsoperatie (route A: een map wordt een link tussen `realpath` en
  `stat`; route B: een map verhuist mét het halffabricaat naar buiten) zijn getest met een haak in
  hetzelfde proces (zelfde module als in de bundel), niet tegen het losse bestand: een race is van
  buitenaf niet op het juiste moment te maken. Alleen op Linux.
- UNC-werkmap op Windows (`\\server\share`): het lexicale pad wordt nu `/server/share/…`. Vervolgwerk.
