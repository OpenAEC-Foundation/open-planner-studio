# MCP-ontdekking: contract tussen de app en de MCP-plugin

Stand 2026-10-23, issue #570 (reactie "Ontwerp: één plugin, drie situaties", besluit eigenaar). Dit document
beschrijft twee bestanden die de desktop-app schrijft voor de MCP-plugin (een headless MCP-server die buiten
de app draait). De typen, de bestandsnamen en de leesregels staan in code in
`src/services/mcp/discoveryContract.ts`; dat bestand importeert niets en mag door de plugin gebundeld worden.
Een wijziging daar is een contractwijziging.

Sinds issue #730 zijn er twee lezers. De Claude Desktop-bundel leest `runtime.json` om per aanvraag te kiezen
tussen de app en de stand zonder app (`integrations/claude-desktop/src/discovery.ts`, uitleg in
[MCP-verificatie](mcp-verificatie.md)). De headless MCP-server leest `open-files*.json` vóór elke schrijfactie
(`headless/mcp-server/src/appLock.ts`, uitleg in [Headless MCP-server](headless-mcp.md)).

## Waarom

De plugin kiest per aanvraag tussen twee standen:

| Situatie | Plugin doet |
|---|---|
| App niet geïnstalleerd, of geïnstalleerd en uit | Werkt zelf op IFC-bestanden |
| App aan, MCP-koppeling aan (bridge draait) | Stuurt alles door naar de bridge van de app |
| App aan, MCP-koppeling uit | Werkt zelf op bestanden, maar weigert elk bestand dat open staat in de app (de headless server van #730 vervangt dan geen enkel bestaand bestand: het register loopt achter op de app) |

Daarvoor moet de plugin weten of de bridge draait (poort en token), en welke bestanden open staan.

## Waar

Beide bestanden staan in de map `mcp/` in de `appDataDir` van de app (identifier `org.openaec.planner`):

| OS | Map |
|---|---|
| Linux | `$XDG_DATA_HOME/org.openaec.planner/mcp/`, standaard `~/.local/share/org.openaec.planner/mcp/` |
| Linux, Snap | `~/snap/open-planner-studio/current/.local/share/org.openaec.planner/mcp/` (snapd zet `HOME` om) |
| macOS | `~/Library/Application Support/org.openaec.planner/mcp/` |
| Windows | `%APPDATA%\org.openaec.planner\mcp\` (Roaming) |

De mappen staan ook in code: `mcpDiscoveryDirs` in `discoveryContract.ts` (`MCP_APP_IDENTIFIER` is de identifier
uit `tauri.conf.json`; een test bewaakt dat). `XDG_DATA_HOME` telt alleen als absoluut pad. De omgevingsvariabele
`OPS_MCP_DISCOVERY_DIR` vervangt de mappen door één map, voor tests en dev-builds.

Een productiebuild gebruikt de namen `runtime.json` en `open-files.json`. Een dev-instantie (`npm run tauri:dev`,
worktree-slug in `OPS_DEV_INSTANCE`) schrijft `runtime.<slug>.json` en `open-files.<slug>.json`, zodat twee
dev-builds elkaars bestanden niet overschrijven. Een plugin voor gebruikers leest alleen de canonieke naam
`runtime.json` (de bundel leest `runtime.<slug>.json` alleen met `OPS_MCP_DEV_INSTANCE`). Voor de weigerregel leest
de headless server elk `open-files*.json` in de map, dus ook die van dev-builds.

## `runtime.json`

Bestaat zolang de bridge draait.

```json
{
  "formatVersion": 1,
  "pid": 12345,
  "port": 3877,
  "token": "64 hex-tekens",
  "appVersion": "2026.43.1",
  "startedAt": "2026-10-23T08:00:00.000Z"
}
```

| Veld | Betekenis |
|---|---|
| `formatVersion` | Altijd `1` voor dit formaat |
| `pid` | Proces-id van de app (het Rust-proces, niet de webview) |
| `port` | Poort van de bridge op `127.0.0.1` (`POST /mcp`) |
| `token` | Bearer-token: `Authorization: Bearer <token>` |
| `appVersion` | Versie van de app |
| `startedAt` | Start van deze bridge, ISO 8601 in UTC |

De app **schrijft** het bestand bij elke geslaagde bridge-start: met de hand, via *Bridge automatisch starten*,
en bij een herstart na een nieuw token of een poortwissel (eerst wissen, dan opnieuw schrijven). De app
**verwijdert** het bij Stop, bij het uitzetten van de MCP-koppeling, na een mislukte start (poort bezet) en
bij het afsluiten van de app. Bij het opstarten verwijdert de app een `runtime.json` die nog van een vorige
sessie is.

## `open-files.json`

Bestaat zolang de desktop-app draait, ook met de MCP-koppeling uit.

```json
{
  "formatVersion": 1,
  "pid": 12345,
  "appVersion": "2026.43.1",
  "updatedAt": "2026-10-23T08:05:00.000Z",
  "files": ["/home/jan/plannen/kantoor.ifc"]
}
```

`files` bevat de paden van de open documenten met een pad op schijf (een `FileRef` van de soort `path`). Een
nieuw, naamloos document staat er niet in. De app schrijft het register opnieuw zodra de set paden verandert:
openen, sluiten, *Opslaan als*, en een documentwissel die een pad verandert. Een wijziging zonder ander pad
schrijft niets; `updatedAt` verandert dus alleen bij een andere lijst. Bij het afsluiten verwijdert de app het
bestand.

### Paden: letterlijk

De app schrijft de paden **letterlijk**, zoals het document ze draagt (uit de bestandskiezer van het OS of uit
*Opslaan als*): geen trim, geen oplossing van `.` of `..`, geen andere hoofdletters, geen andere scheidingstekens
(`openFileList`). Elke omvorming kan een ander bestand aanwijzen; een POSIX-naam mag bijvoorbeeld op een spatie
eindigen. Alleen een lege waarde valt weg; de lijst is uniek en gesorteerd. Symlinks lost de app niet op: de
bestandsplugin van Tauri kent geen `realpath`, en een eigen Rust-command daarvoor zou nieuw publiek oppervlak zijn.

**De lezer vergelijkt bestandsidentiteit, geen tekst.** Vóór elke schrijfactie in de bestandsstand doet de plugin
voor zijn doel en voor elk pad in `files`: `realpath`, dan `stat`, en vergelijkt het apparaat en het
bestandsnummer (Node: `dev` + `ino`, op Windows via `fs.stat(pad, { bigint: true })`). Zo vallen een symlink, een
harde link, een andere schrijfwijze en een `..` in een bovenliggende map samen. Een tekstvergelijking is nooit
een terugval: twee harde links naar hetzelfde bestand hebben elk een eigen `realpath`.

**Onzekere identiteit ⇒ weigeren.** Mislukt `realpath` of `stat` (voor het doel of voor een pad uit `files`) om
een andere reden dan "bestaat aantoonbaar niet", dan weigert de plugin de schrijvende aanvraag. Alleen een pad dat
aantoonbaar niet bestaat (`ENOENT`, en `realpath` van de diepste bovenmap die wel bestaat lukt) mag apart behandeld
worden: zo'n pad is geen bestaand bestand, dus het deelt met geen ander bestand een identiteit. Bestaan het doel en
een pad uit `files` allebei aantoonbaar niet (een open document waarvan het bestand weg is), dan weigert de plugin
als `realpath` van die diepste bestaande bovenmap plus de rest van het pad bij beide gelijk is. De diepste bovenmap,
niet alleen de oudermap: de headless server maakt bij opslaan ontbrekende mappen aan, en met alleen de oudermap zou
elk opslaan in een nieuwe submap geweigerd worden zolang de app draait (#730). Een relatief pad in `files` is
onzeker en geeft dus een weigering; op macOS en Windows vergelijkt de headless server zo'n sleutel zonder onderscheid
in hoofdletters.

## Invariant voor elke toekomstige `formatVersion`

Het veld `pid` op het hoogste niveau van beide bestanden is in **elke** `formatVersion` een positief geheel getal:
het proces-id van het eigenaarproces, de app die het bestand schreef. Een nieuwere versie mag andere velden
veranderen, maar nooit de betekenis of de plaats van `pid`. Alleen daarom mag een lezer een register dat hij niet
begrijpt, toch vrijgeven als dat proces aantoonbaar niet meer leeft. Wie deze invariant wil breken, moet de
bestandsnaam veranderen.

## Regels voor een lezer

1. **Drie uitkomsten, nooit twee** (`readRuntimeFile`, `readOpenFilesFile`):
   - *ontbrekend*: het bestand bestaat niet;
   - *geldig*: het bestand volgt dit contract (extra velden mogen; de lezer laat ze liggen);
   - *onbruikbaar*: het bestand bestaat, maar is onleesbare JSON, heeft een veld van het verkeerde type of een
     andere `formatVersion` (bijv. van een nieuwere app). Is het veld `pid` wel geldig, dan geeft de lezer het
     mee, zodat hij kan zien of de app nog leeft.

   Voor `runtime.json` betekent *onbruikbaar*: niet verbinden met de app. Voor `open-files.json` betekent
   *onbruikbaar*: weiger elke schrijvende aanvraag, behalve als het register een geldig `pid` draagt en dat proces
   aantoonbaar niet meer leeft (dan is het register achtergebleven). `openFilesWritePolicy` legt dat vast:

   | Register | App leeft | App leeft mogelijk (onbekend) | App leeft niet |
   |---|---|---|---|
   | ontbrekend | vrij | vrij | vrij |
   | geldig | toets elk doel tegen `files` | toets elk doel tegen `files` | vrij |
   | onbruikbaar, met geldig `pid` | **weiger elke schrijvende aanvraag** | **weiger elke schrijvende aanvraag** | vrij |
   | onbruikbaar, zonder geldig `pid` | **weiger elke schrijvende aanvraag** | **weiger elke schrijvende aanvraag** | **weiger elke schrijvende aanvraag** |
2. **Halffabricaten overslaan.** De app schrijft eerst `<naam>.<id>.tmp` en hernoemt dat dan over het doel. Een
   naam die op `.tmp` eindigt, is nooit het bestand zelf.
3. **Achtergebleven `runtime.json` herkennen.** Na een crash of een geforceerde stop kan het bestand blijven
   staan. Het is achtergebleven als het proces `pid` niet meer leeft (Node: `process.kill(pid, 0)` gooit
   `ESRCH`; `EPERM` betekent dat het proces wel leeft), of als de verbinding met `127.0.0.1:<port>` faalt, of
   als de bridge het token weigert (`401`). Een pid kan na een herstart van de computer hergebruikt zijn; de
   verbindingstest is dus de echte toets. Valt een van beide toetsen negatief uit, dan werkt de plugin in de
   bestandsstand.
4. **Achtergebleven `open-files.json` herkennen.** Het is achtergebleven als het proces `pid` niet meer leeft.
   Twijfel (pid leeft, maar is misschien hergebruikt) telt als "open": weigeren is veilig, schrijven niet.
5. **Opnieuw lezen per aanvraag.** De app kan tijdens een gesprek starten, stoppen of een bestand openen. Lees
   beide bestanden bij elke schrijvende aanvraag opnieuw.
6. **Het register is een voorcontrole, geen slot.** Tussen lezen en schrijven kan de gebruiker een bestand
   openen. De app beschermt een open document niet extra tegen een schrijver van buiten.

## Rechten

- Op Linux en macOS maakt de app de map `mcp/` met rechten `0700` en de bestanden met `0600`: alleen jouw
  gebruiker leest het token. De proces-umask kan rechten alleen verder beperken.
- Op Windows negeert de bestandsplugin de rechtenbits. De bestanden erven de ACL van de profielmap
  (`%APPDATA%`); standaard beschermt die het bestand voor andere gewone gebruikers. Dat is **niet apart
  gecontroleerd**: een afwijkende ACL op het profiel geldt ook voor het token. Een echte ACL-controle (of geen
  token publiceren als die faalt) is vervolgwerk.

## Hoe de app het doet

- Rust blijft dun: geen nieuw command. Het proces-id komt uit het initialisatiescript `ops-process-info` in
  `src-tauri/src/main.rs` (een plugin zonder commands, zoals `tauri-plugin-os` zijn gegevens injecteert) als
  `window.__OPS_PROCESS__.pid`. De appversie komt uit `getVersion()` van `@tauri-apps/api/app`.
- `src/services/mcp/discoveryFiles.ts` schrijft beide bestanden via `plugin-fs` (nieuw halffabricaat met
  `createNew` en rechten `0600`, dan `rename` in dezelfde map, dus atomair). Alle schrijf- en wisacties lopen
  door één wachtrij, zodat een late schrijfactie nooit een bestand terugzet dat een latere stop al wiste.
  Exclusief aanmaken en schrijven zijn gescheiden: na een schrijf- of sluitfout wordt alleen het eigen
  halffabricaat opgeruimd; een botsende bestaande naam blijft staan. Een geweigerde cleanup wordt gemeld
  en kan het halffabricaat alsnog laten liggen (geen garantie tegen OS-verwijderfouten).
- `createBridgeController` (`server.ts`) meldt start en stop; `useMcpDiscovery` volgt de store voor het
  register; `useAppCloseGuard` verwijdert beide bestanden bij het afsluiten (hoogstens 1,5 s).
- In de browser en in de platformbouw gebeurt niets (`isTauri()`).

## Hoe het getoetst wordt

- `tests/mcp/cases-discovery.ts` (in `npm test`): letterlijke paden, opbouw, de drie leesuitkomsten en het schrijfbeleid, de writer met een
  geheugen-bestandssysteem (atomair, `0600`, wachtrij, opruimen, afsluiten), de controller-meldingen en de
  bijwerk-triggers tegen de echte store.
- `tests/mcp/realApp/run-real-app.ts` (`.github/workflows/mcp-real-app.yml`, Linux): de echte app schrijft
  `runtime.json` met de juiste poort, het juiste token, een levend pid en rechten `0600`; het register bestaat;
  na Stop is `runtime.json` weg en blijft het register staan.
- `tests/mcp/cases-discovery.ts` toetst ook `mcpDiscoveryDirs` per besturingssysteem en de identifier.
- `tests/mcp/cases-mcpb.ts` (bundel) en `tests/mcp/cases-headless-server.ts` (slot) toetsen de lezers met
  bestanden in een tijdelijke map (`OPS_MCP_DISCOVERY_DIR`): geldig, achtergebleven (dood pid), onbruikbaar.
- Niet getoetst: de ACL op Windows, de paden op macOS en Windows, en de Snap-map.
