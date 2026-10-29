# MCP-server: wat geleverd is en hoe het getoetst wordt

Stand 2026-10-29 (Claude Desktop-bundel: issue #730), bij issue #429 (ecosystem readiness, deelpunten MCP en Claude Desktop/Code). Dit document
legt vast wat de app als MCP-server levert, wat niet, en welke test het bewijst. De architectuur zelf staat in
`.claude/rules/mcp.md`; de gebruikersgids is `public/docs/{nl,en}/howto-ai-assistent-koppelen.md`.

## Transport

- Eén server: de bridge in de desktop-app (Tauri). Rust (`src-tauri/src/mcp_bridge.rs`) doet alleen HTTP; het
  protocol en de tools zitten in TypeScript (`src/services/mcp/`). In de browserversie is er geen bridge.
- Streamable HTTP, alleen `POST http://127.0.0.1:<poort>/mcp` (standaard 3877, instelling `ops-mcpPort`). De app
  toont het endpoint als `http://localhost:<poort>/mcp`.
- Een request krijgt `200 application/json` met één JSON-RPC-bericht. Een geaccepteerde notificatie krijgt
  `202 Accepted` zonder body of Content-Type, volgens de
  [MCP-specificatie van 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#sending-messages-to-the-server).
  Geen SSE, geen GET-stream (`405`, `Allow: POST`), geen JSON-RPC-batch (`-32600`).
- Elk antwoord draagt `Connection: close`. tiny_http sluit bij een stop van de bridge de bestaande keep-alive-
  verbindingen niet; een request dat een client vlak na een herstart over zo'n oude verbinding stuurde, kreeg
  nooit antwoord (gevonden met de echte-app-run in review 3 van PR #439, nagespeeld met tiny_http 0.12.0 en
  Node fetch). Na een stop probeert de bridge ook tot ~1 s opnieuw te binden, omdat de vorige server de poort
  nog heel even kan vasthouden.
- Requests lopen strikt één voor één. Na 120 s wachten geeft de bridge `504`; een request dat langer dan 110 s
  in de rij stond, voert de app niet meer uit (`-32001`).
- Body groter dan 50 MiB: `413`. Ander pad: `404`.
- Sessies volgens de spec: een geslaagde `initialize` krijgt een nieuwe `Mcp-Session-Id` (16 willekeurige bytes,
  hex) in de antwoordheader. De client stuurt die header daarna mee. Een onbekende of vergeten sessie-id krijgt
  `404` zonder body; de client begint dan een nieuwe sessie. De sessietabel leeft per app-sessie (de webview,
  `appMcpSessions`), niet per bridge-start: stop/start en een poortwissel behouden sessies en ankers. Een nieuw
  token wist alle sessies; een herstart van de hele app begint ook leeg, en dat is gewoon een nieuwe start. De
  app onthoudt 32 sessies. Een nieuwe sessie boven die grens verdringt alleen de oudste sessie zonder anker;
  een sessie met anker wordt nooit verdrongen. Zijn alle 32 gebonden, dan weigert de app een nieuwe
  `initialize` met JSON-RPC-fout `-32000` (review 3 PR #439). Elk request behalve `initialize` moet een bekende sessie-id dragen, ook lezen, `ping` en
  notificaties; zonder header volgt `400` met een JSON-RPC-fout (`-32600`). Eén regel voor alles is het
  eenvoudigste dat spec-conform is, en er bestaat zo geen pad waarlangs een tool zonder sessie draait. Een client
  die de sessie-header niet ondersteunt, kan dus niet koppelen. Een `DELETE` om een sessie te beëindigen krijgt `405`; dat mag
  volgens de spec. De sessietabel staat in TypeScript (`createRequestHandler`); Rust geeft de header alleen door.
- Protocolversies: de app kent `2025-06-18`, `2025-03-26` en `2024-11-05` en antwoordt met die van de client als
  hij er een van kent, anders met `2025-06-18`. De SDK-client 1.32.1 vraagt `2025-11-25` en accepteert
  `2025-06-18`.

## Tools, resources en prompts

- `capabilities` is alleen `{ tools: {} }`. Er zijn geen resources en geen prompts; `resources/list` en
  `prompts/list` geven `-32601`.
- 41 `planner_*`-tools (`src/services/mcp/tools/`). Elke tool draagt `readOnlyHint`, `destructiveHint`,
  `idempotentHint` en `openWorldHint` (`tools/helpers.ts`; `planner_batch` is `destructiveHint: true`).
- `initialize` geeft `instructions` mee (`MCP_INSTRUCTIONS` in `dispatcher.ts`): de kernregels voor goed plannen.
  De volledige gids komt via de tool `planner_get_planning_guide`.

## Rechten en veiligheid

- Alleen loopback: de bridge bindt uitsluitend `127.0.0.1`.
- `Authorization: Bearer <token>`: het token is 32 willekeurige bytes (hex), bewaard in `ops-mcpToken`, met
  constante tijd vergeleken. Zonder of met een fout token: `401` zonder body. Een nieuw token herstart de
  bridge, dus het oude werkt direct niet meer.
- Elke request met een `Origin`-header krijgt `403`, ook met een geldig token (bescherming tegen DNS-rebinding).
- De gebruiker zet de bridge zelf aan: AI-modus (`ui.aiMode`) en dan *Bridge starten*, of *Bridge automatisch
  starten* (standaard uit).
- *Alleen lezen* (`ui.aiReadOnly`): elke wijzigende tool krijgt `READ_ONLY`; lezen werkt. *Pauzeren*
  (`ui.aiPaused`): elke wijzigende tool krijgt `PAUSED`. Een open dialoog blokkeert alle tools behalve
  `planner_get_planning_guide`.
- Drift-anker per sessie: de eerste mutatie van een sessie bindt aan het actieve document; wisselt de gebruiker
  van tabblad, dan krijgt de volgende mutatie van die sessie `DOC_DRIFT`. Een tweede client die `initialize`
  doet, krijgt een eigen sessie en wist het anker van de eerste niet; een `initialize` zonder `id` maakt geen
  sessie en raakt niets (reviewrondes 1 en 2 van PR #439). Er is geen gedeeld anker meer. Het anker blijft
  staan bij een bridge-herstart en bij veel nieuwe sessies (review 3), dus een client die `DOC_DRIFT` kreeg,
  blijft dat krijgen tot hij het document bevestigt of de gebruiker een nieuw token maakt.

## Mutatie, undo en backup

- Elke wijzigende tool is één undo-stap (`createMcpTransactions`); `planner_batch` is één undo-stap voor alle
  stappen samen, met één herberekening. Een geweigerde mutatie maakt geen undo-stap.
- Vóór de eerste wijziging per document per bridge-sessie schrijft de app een IFC-backup naar
  `<appDataDir>/ai-backups/<docId>/` (instelling *Auto-backup*, standaard aan). Een batch telt als één backup.
  Uitzondering: een kopie die `planner_duplicate_document` maakte, krijgt geen automatische backup (het
  origineel is de bron); *Nu backup maken* werkt daar wel. Handmatig stoppen en opnieuw starten wist de backuptellers en de kopie-uitzondering; de herstart
  bij tokenvernieuwing doet dat niet.
- Elke aanroep staat in het activiteitenpaneel (laatste 500).

## Hoe het getoetst wordt

1. **`tests/mcp/cases-externe-client.ts`** (in `npm test`, suite `tests/mcp/`). De officiële client
   `@modelcontextprotocol/sdk` (`Client` + `StreamableHTTPClientTransport`, devDependency, vast op 1.32.1)
   praat over echt HTTP met `tests/mcp/bridgeMirror.ts`: een Node-host die het HTTP-contract van
   `mcp_bridge.rs` nabootst (sinds #570 de HTTP-transport van de headless MCP-server,
   `headless/mcp-server/src/http.ts`) rond de echte `createRequestHandler`, dispatcher en tools op een eigen headless
   storecontext. De host is een kopie van de Rust-HTTP-laag en bewijst niets over Rust zelf; dat doet punt 2.
   Controles: initialize (protocolversie, serverInfo, capabilities, instructions, `Mcp-Session-Id`), ping,
   `tools/list` (aantal en annotaties per tool gelijk aan de registry), een leestool, `planner_add_tasks` en
   `planner_batch` elk precies één undo-stap en één backup, `READ_ONLY` en `PAUSED` zonder undo-stap of
   backup (direct na elke weigering geteld), twee clients (A krijgt `DOC_DRIFT` na een tabwissel, ook nadat B
   een sessie begon, na een `initialize` zonder `id`, en dezelfde mutatie zonder sessie-header krijgt `400`; B
   werkt in het actieve document), onbekende sessie `404`, `tools/list` zonder sessie-header `400`, `401` (geen token, fout token, ander scheme), `403` (Origin), `404` en `405`. De sessietabel zelf
   (eigen anker per sessie, `400` zonder header zonder dat de dispatcher het request ziet, `404`, mislukte
   `initialize` en `initialize` zonder `id` zonder sessie, gebonden sessies niet verdrongen, volle tabel ⇒
   `initialize` geweigerd, `createBridgeController.restart()` behoudt sessie en `DOC_DRIFT`, nieuw token wist
   alles) toetst `tests/mcp/cases-server.ts`. De SDK-route toetst ook 40 extra sessies en een bridge-herstart
   tegen een client die `DOC_DRIFT` kreeg: die houdt `DOC_DRIFT`.
   Het gedeelde `externalClient.ts` bevat ook rechtstreekse HTTP-controles: `notifications/initialized`
   krijgt `202` zonder body of Content-Type; initialize, ping en JSON-RPC-fouten houden `200 application/json`.
   Een notificatie met een onbekende sessie houdt `404`, en zonder sessie-header `400` met de JSON-RPC-fout.
   Dezelfde HTTP-controles draaien in punt 2 tegen de echte Rust-bridge.
   Draaien: `bash tests/mcp/run.sh cases-externe-client.ts`.
2. **`.github/workflows/mcp-real-app.yml`** (apart, niet in de verplichte CI; draait op een PR die de MCP-route
   raakt, en met de hand). Bouwt de Tauri-dev-app onder xvfb, zet via het ops-test-kanaal
   (`src/utils/devBridge.ts`, opdrachten `dispatch` en `mcpConnection`) AI-modus en automatisch starten aan,
   en draait dezelfde SDK-controles (`tests/mcp/externalClient.ts`) tegen de echte Rust-bridge. Dezelfde job
   draait de Rust-unit-tests van `mcp_bridge.rs` (`cargo test … mcp_bridge`); die draaien in geen andere
   workflow. De laatste controle start de gebouwde Claude Desktop-bundel (#730) met de werkmap en
   `OPS_MCP_DEV_INSTANCE` op de slug van de dev-build: `tools/list` en `planner_get_project_info` gaan via de echte
   bridge; daarna stopt de bridge, en in dezelfde sessie komt `planner_get_project_info` uit de headless planner, met
   de wisselmelding vooraan en de logregels van de wissel.
   Script: `tests/mcp/realApp/run.sh` (weigert zonder `CI=true` of `OPS_MCP_REAL_APP=1`, omdat het in de
   appDataDir schrijft).
3. **Handmatig, 2026-10-21**, tegen de spiegel uit punt 1 (niet tegen de desktop-app). Een loggende proxy
   ervoor liet zien dat Claude Code en `mcp-remote` de `Mcp-Session-Id` na `initialize` bij elk volgend request
   meesturen. Claude Code stuurt vóór `initialize` eerst `server/discover` zonder header; dat krijgt `400` en
   hij gaat gewoon door met `initialize`. Na de verplichte sessie (review 2) zijn beide opnieuw getoetst:
   koppelen, `tools/list` en een `planner_add_tasks` slagen. Na review 3 met `mcp-remote`: binden, tabwissel
   (`DOC_DRIFT`), 40 extra sessies (`DOC_DRIFT`, geen `404`) en een bridge-herstart (`DOC_DRIFT`); niets in het
   tweede document. Claude Code koppelt en muteert ook na deze wijziging.
   - Claude Code 2.1.306 met precies het configuratiefragment uit de app (`--mcp-config`): las het project en
     voegde een taak toe. `claude mcp add --transport http … --header "Authorization: Bearer …"` schrijft
     hetzelfde fragment (`type: "http"`, `url`, `headers`).
   - `mcp-remote` 0.15.2 als stdio-brug (de route voor Claude Desktop), met `--header
     "Authorization:${AUTH_HEADER}"` en het token in `env`: verbinding, 41 tools, leestool werkt, zowel met
     `localhost` als `127.0.0.1`, zonder `--allow-http`.
   - Claude Desktop met `mcp-remote` en het fragment uit de gids: getest door de eigenaar op 2026-10-23,
     tegen de desktop-app. De `.mcpb`-bundel zelf is nog niet in Claude Desktop geïnstalleerd (zie punt 4).
4. **`tests/mcp/cases-mcpb.ts`** (in `npm test`, suite `tests/mcp/`). Bouwt de Claude Desktop-bundel met
   `scripts/build-mcpb.mjs`, leest de `.mcpb` met de ZIP-lezer van de app (precies zeven bestanden, PNG-icoon,
   schakelstuk onder 1 MB, `server/headless.mjs` is de headless server, licenties van beide erbij) en controleert
   de manifestvelden waar de bundel op leunt (versie = appversie, `mcp_config` met de werkmap in `env`, alleen
   `user_config.workdir`: `directory` en verplicht). Daarna start hij de servers **uit de ZIP** zoals Claude
   Desktop dat doet (`node server/index.mjs`, de werkmap in `env`) en praat er met de SDK-client tegen
   (`Client` over een eigen stdio-transport met de `ReadBuffer` van de SDK). De "app" is de spiegel uit punt 1,
   gevonden via een `runtime.json` in een tijdelijke map (`OPS_MCP_DISCOVERY_DIR`). Getoetst:
   - **beide standen met dezelfde tool**: met de app komt `planner_get_project_info` uit de app (serverInfo en
     instructies van de bridge plus de bundeluitleg); zonder `runtime.json` komt hij uit de headless planner op
     de werkmap, met precies dezelfde tools, beschrijvingen, schema's en annotaties; de logregels van beide
     standen staan op stderr;
   - **terugval zonder app**: een `runtime.json` van een gestopt proces, een poort waar niets luistert en een
     geweigerd token (401) geven elk de stand zonder app, met een logregel;
   - **wisselen zonder werk te verliezen**: de app gaat dicht ⇒ melding vooraan het volgende antwoord,
     `notifications/tools/list_changed`, een wijziging wordt geweigerd tot een bestand geopend is, en het werk
     in de app blijft onaangeroerd; de app gaat open terwijl de headless planner nog niet opgeslagen werk heeft
     ⇒ de aanvragen blijven zonder app (met melding); staat het bestand open in de app (`open-files.json`),
     dan weigert `planner_export_ifc` met `overwrite: true` het overschrijven en blijft het bestand byte-gelijk;
     opslaan onder een andere naam lukt, daarna wissel naar de app,
     weigering tot `planner_switch_document`, en het bestand bevat beide taken; het kindproces stopt
     onverwacht ⇒ melding, en wijzigen pas na opnieuw openen;
   - **sessies met de app** (zoals vóór #730): een app-herstart op dezelfde poort (nieuwe sessietabel): de
     leestool wordt herhaald en slaagt, `planner_add_tasks` blijft geweigerd (ook na een leestool) tot
     `planner_switch_document`, daarna slaagt hij één keer; een nieuwe `runtime.json` (andere poort) geeft een
     nieuwe sessie met dezelfde blokkade; een sessie gebonden aan plan A, app-herstart met plan B actief, een
     `ping` ontdekt het verlies: de wachtende en de volgende wijziging worden geweigerd en er komt niets op B;
     idem maar een leesaanvraag ontdekt het verlies: (a) de wijziging erachter wordt geweigerd, (b) na lezen en
     een tabwissel naar plan C blijft elke wijziging geweigerd, (c) na `planner_switch_document` naar B landt de
     wijziging op B en na een tabwissel weigert de drift-guard van de app (`DOC_DRIFT`); herstel via nieuw of
     import (207); een geannuleerde wijziging achter een trage leesaanvraag bereikt de bridge nooit, ook niet
     tijdens opnieuw verbinden (206/323);
   - **geen van beide**: Stop/Start van de bridge zonder werkmap met behouden sessie: statustool en terug, elk
     met `notifications/tools/list_changed`, daarna wijzigen zonder blokkade; geen app en geen werkmap, of een
     werkmap die niet bestaat: alleen de statustool, met een Engelse fout die beide uitwegen noemt, en verbinden
     zodra de app of de map er is.
5. **`.github/workflows/mcpb.yml`** (apart, niet in `verify`; draait op elke push naar `main` en op een PR die
   de bundel raakt). Bouwt de bundel, controleert het manifest met de officiële CLI
   (`npx @anthropic-ai/mcpb@2.1.2 validate`, vaste versie) en bewaart de `.mcpb` 7 dagen als artifact.
   `release.yml` doet dezelfde controle in de job `build-mcpb` en zet de bundel als asset bij de release.

## Ontdekking door de MCP-plugin

Zolang de bridge draait, schrijft de desktop-app poort en token in `<appDataDir>/mcp/runtime.json`; zolang de app
draait, houdt hij in `<appDataDir>/mcp/open-files.json` bij welke bestanden open staan (issue #570). Contract,
paden per OS, leesregels en toetsen: [MCP-ontdekking](mcp-ontdekking.md).

## Claude Code en Claude Desktop

- **Claude Code**: koppelt direct over HTTP. Het fragment uit de app is het `.mcp.json`-formaat van Claude Code.
  Bron: https://code.claude.com/docs/en/mcp (`claude mcp add --transport http <name> <url> --header …`,
  `type: "http"`, `headers`).
- **Claude Desktop**: Claude Desktop start lokale servers zelf (`command`, `args`, `env`) en praat er via stdio
  mee; de documentatie geeft geen `url`-variant. Bron:
  https://modelcontextprotocol.io/docs/develop/connect-local-servers. De eerste route is daarom de
  **Claude Desktop-bundel** (zie hieronder). De reserve is `mcp-remote` (https://github.com/geelen/mcp-remote)
  in `claude_desktop_config.json`, met het token in `env` vanwege de spatiebug op Windows; die vraagt Node.js
  op de computer van de gebruiker.

## Claude Desktop-bundel (`.mcpb`)

Eén installatie met twee standen (issue #730, besluit eigenaar Nozzit 2026-10-29, "1"). Staat de app open met de
bridge, dan werkt de bundel via de bridge in de app (zoals in #567). Staat de app dicht, dan start de bundel zelf de
headless MCP-server (#572) op een werkmap. Dit is het schakelstuk uit het ontwerp "één plugin, drie situaties" op #570.

- Formaat: MCP Bundle volgens https://github.com/modelcontextprotocol/mcpb (`MANIFEST.md`, `manifest_version`
  `0.3`). Een `.mcpb` is een ZIP met `manifest.json`, `icon.png` (het app-icoon, 512×512, de maat die `mcpb validate`
  aanraadt), `server/index.mjs` (het schakelstuk), `server/headless.mjs` (de headless server), `LICENSE`,
  `LICENSE.GPL` en `THIRD-PARTY-NOTICES.md`. Claude Desktop installeert hem met een dubbelklik en toont een venster
  voor de `user_config`: alleen *Working folder* (`directory`, verplicht). Poort en token vraagt het venster niet
  meer: de bundel leest ze uit `runtime.json`. De werkmap gaat via `env` (`OPS_MCP_ROOT`), niet via `args`: Claude
  Desktop breekt op Windows een argument met een spatie. Claude Desktop levert zelf Node.js mee; de gebruiker
  installeert niets.
- Bron: `integrations/claude-desktop/`: `manifest.json`, `src/main.ts` (stdio en bedrading), `src/config.ts`
  (werkmap uit `env`), `src/discovery.ts` (`runtime.json` lezen), `src/headlessChild.ts` (het kindproces) en
  `src/proxy.ts` (het schakelstuk; kent geen manifest, transport, bestanden of processen). Bouwen:
  `npm run build:mcpb` → `dist-mcpb/open-planner-studio-<versie>.mcpb` en de uitgepakte inhoud in
  `dist-mcpb/bundle/`. Het schakelstuk is één ESM-bestand (esbuild, `node18`, geminificeerd), zonder
  runtime-dependencies; het bevat `@modelcontextprotocol/sdk` (`StdioServerTransport`), zod en uit de app alleen
  het ontdekkingscontract `src/services/mcp/discoveryContract.ts` (importeert niets). De bouw faalt als andere
  app-code erin komt of als de manifestversie afwijkt van `package.json`. `server/headless.mjs` is ongewijzigd de
  uitvoer van `scripts/build-mcp-server.mjs`, met de grenscontrole van die bouw.
- Versie: `manifest.json` staat in het versieregister van `scripts/bump-version.js` (`npm run bump`,
  `--check`).
- **Kiezen per aanvraag.** Vóór elke aanvraag leest de bundel `runtime.json` in `<appDataDir>/mcp/`
  (`mcpDiscoveryDirs`: Linux ook de Snap-map, macOS, Windows; tabel in [MCP-ontdekking](mcp-ontdekking.md)). Een
  geldig bestand van een levend proces ⇒ de app: `POST http://127.0.0.1:<poort>/mcp` met het token en de
  `Mcp-Session-Id`; het antwoord gaat ongewijzigd terug. Bewust `127.0.0.1` en niet `localhost`. Geen bestand,
  een onbruikbaar bestand of een gestopt proces ⇒ zonder app. Antwoordt de bridge niet of weigert hij het token
  (401), dan ook zonder app (regel 3 van het contract). Een time-out geeft een fout en geen wissel: dan is niet
  bekend of de app de aanvraag uitvoerde. Berichten lopen strikt na elkaar, net als in de bridge.
- **Zonder app.** De bundel start `server/headless.mjs` als kindproces (`node headless.mjs --transport stdio
  --root <werkmap>`), met dezelfde Node en dezelfde omgeving, en hergebruikt het zolang de sessie zonder app
  werkt. Een kindproces en geen import, omdat de headless server per bestandsoperatie de procesmap zet. Vóór het
  starten controleert de bundel: een werkmap ingevuld, Node 22 of nieuwer (het schakelstuk zelf draait vanaf
  Node 18), en de map bestaat. Lukt dat niet, dan noemt de fout de reden. De logregels van het kind gaan met het
  voorvoegsel `headless:` naar stderr. De headless server schrijft geen bestand dat open staat in de app
  (`open-files.json`, slot in `headless/mcp-server/src/appLock.ts`, zie [Headless MCP-server](headless-mcp.md)).
- **Dezelfde tools.** In beide standen gelden dezelfde 41 `planner_*`-tools, met dezelfde namen, beschrijvingen,
  schema's en annotaties (getoetst). Geen tool heeft een scherm nodig; Gantt, dialogen, lint, afdrukken en PDF
  hebben geen tool, ook niet in de app. `initialize.instructions` is die van de planner, met een korte uitleg van
  de bundel erachter (`bundleInstructions`).
- **Wisselen tijdens een sessie zonder werk te verliezen.**
  - App → zonder app (de app ging dicht of de bridge stopte): het werk staat in de app, die bij sluiten zelf om
    opslaan vraagt. De bundel weigert daarna elke wijzigende tool tot een geslaagde `planner_import_schedule`,
    `planner_new_document` of `planner_switch_document`: de documenten van de app zijn hier niet open.
  - Zonder app → app (de app ging open): alleen als de headless planner geen wijzigingen meer heeft die nog niet
    met `planner_export_ifc` op schijf staan. De bundel houdt dat per document bij uit de antwoorden: een
    geslaagde wijzigende tool markeert het actieve document, een geslaagde export maakt het weer schoon (import,
    nieuw en wisselen niet). Is er nog zulk werk, dan blijven de aanvragen zonder app, met één melding, tot het is
    opgeslagen. Daarna stopt het kindproces en weigert de bundel wijzigingen tot een documentkeuze in de app.
  - Na elke wissel krijgt het eerstvolgende toolantwoord een korte melding vooraan (een extra tekstblok; de
    `structuredContent` blijft gelijk), en de client krijgt `notifications/tools/list_changed`.
  - Stopt het kindproces onverwacht, dan is zijn geheugen weg: melding, en wijzigen pas na opnieuw openen.
- **Sessies met de app.** Sessieverlies (`404`, de app is herstart), ontdekt door welk bericht ook (ook een
  `ping` of notificatie), of een nieuwe `runtime.json` (ander pid, andere poort of nieuw token): de bundel opent
  een nieuwe sessie met de oorspronkelijke `initialize`-parameters en herhaalt een request dat niets wijzigt
  (alles behalve `tools/call`, en tools met `readOnlyHint: true` uit de laatste `tools/list`). Het drift-anker van
  de oude sessie is weg, dus een wijziging kon op een ander document landen. Daarom weigert de bundel daarna elke
  wijzigende tool (ook een onbekende, en ook aanvragen die al in de wachtrij stonden) met "… this change was NOT
  carried out … confirm it with planner_switch_document …", tot een geslaagde `planner_switch_document` het anker
  van de nieuwe sessie expliciet vastlegt (`bindExpectedDoc`). Een leestool heft niets op (review ronde 2 van PR
  #567). Ook een expliciete `planner_new_document` of `planner_import_schedule` mag als losse herstelactie door:
  alleen na succes wordt de blokkade opgeheven, en ze worden nooit automatisch herhaald.
  `planner_duplicate_document` blijft geblokkeerd, omdat die het actieve document gebruikt. Komt een aanvraag
  niet aan maar is het dezelfde bridge (zelfde pid, poort en token, bijv. Stop/Start), dan probeert de bundel de
  oude sessie eerst te hervatten met een `ping`; lukt dat, dan is er geen blokkade.
- **Geen van beide.** Kan de bundel de app niet bereiken en niet zonder app werken, dan beantwoordt hij
  `initialize` zelf en biedt hij één tool aan: `open_planner_studio_status`. Elke andere aanroep geeft een
  Engelse fout die beide uitwegen noemt (de app met de bridge starten, of een werkmap kiezen). Bij elk volgend
  bericht probeert de bundel het opnieuw. Bij elke wissel tussen statustool en plannertools stuurt hij
  `notifications/tools/list_changed`; `initialize` kondigt daarom altijd `listChanged: true` aan.
- Annuleren (`notifications/cancelled`, ook na een time-out van de client): de bundel legt de annulering vast
  zodra hij binnenkomt, niet achter in de wachtrij. Een geannuleerde aanvraag die nog wachtte, gaat nooit naar
  een planner en krijgt geen antwoord (MCP 2025-06-18, *cancellation*). Een aanvraag die al bij een planner was,
  loopt door.
- Voor tests en ontwikkelaars, niet in het manifest: `OPS_MCP_DISCOVERY_DIR` (lees de ontdekkingsbestanden uit
  deze map) en `OPS_MCP_DEV_INSTANCE` (lees `runtime.<slug>.json` van een dev-build).
- Niet getoetst: installeren en het installatievenster in Claude Desktop zelf (er is geen Claude Desktop voor
  Linux), Claude Desktop op Windows en macOS met de bundel, en welke Node Claude Desktop meelevert (de stand
  zonder app vraagt Node 22). De bundel is niet ondertekend (`mcpb sign`); Claude Desktop meldt dat bij
  installeren.
- **Custom connectors** (Claude, *Customize › Connectors*) passen niet: "Claude connects to your remote MCP
  server from Anthropic's cloud infrastructure, rather than from your local device" en de server "must be
  reachable over the public internet". Bron:
  https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp

## Wat niet geleverd is

- Geen ondertekende `.mcpb`: de bundel is niet ondertekend, en er is geen downloadknop in het koppelvenster van de app.
- Geen Claude-connector en geen interactieve MCP App: de bridge is niet publiek bereikbaar en heeft geen OAuth.
- Geen MCP-resources, -prompts, -sampling of -notificaties van de server naar de client.
