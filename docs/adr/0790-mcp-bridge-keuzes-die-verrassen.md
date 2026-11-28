# MCP-bridge: keuzes die verrassen

De protocollaag in `src/services/mcp/` (dispatcher, verzoekafhandeling, levenscyclus van de bridge, backups) bevat
een paar keuzes die er zonder uitleg overbodig uitzien. Wat al in `.claude/rules/mcp.md`, `docs/mcp-ontdekking.md`,
`docs/mcp-verificatie.md`, `docs/recepten/mcp-tool.md` of `docs/platformbouw.md` staat, herhaalt deze ADR niet.

## Gevolgen

- `toolListEntry` (`toolListing.ts`) geeft alle vier de annotaties mee, ook een hint die gelijk is aan de standaard
  van de MCP-spec.
- De typen in `contracts.ts` groeien alleen aan: een veld komt erbij, er verdwijnt of verandert er geen. AI-clients
  buiten de repo lezen die vormen.
- `MCP_INSTRUCTIONS` (`dispatcher.ts`) blijft kort: clients zetten het in elke systeemprompt. Het bevat alleen de
  regels die een agent anders fout doet; de rest staat in de agentgids achter `planner_get_planning_guide`.
- `createRequestHandler` (`requestHandler.ts`) stuurt ook voor een notificatie met een geldige sessie een
  `mcp://response`, met een lege body. De Rust-kant wacht per verzoek-id op een antwoord en zou anders pas na zijn time-out verder gaan.
- `regenerateAndApplyMcpToken` (`server.ts`) herstart een draaiende bridge met het nieuwe token. Rust kopieert het
  token bij `mcp_bridge_start`; alleen de opgeslagen waarde vervangen laat het oude token werken tot de volgende start.
- `createBridgeController.start` probeert de start eerst stil, en bij een mislukking één keer na een stop. Na een
  herlaad van de webview draait de Rust-bridge van de vorige webview-sessie nog en antwoordt `mcp_bridge_start` met
  "draait al"; pas de tweede mislukking is `port-busy`. Zodra die startpoging terugkeert, meldt de controller zijn
  listeners af, nog vóór het wachten op het ontdekkingsbestand, zodat het aparte `error`-event van Rust de status `port-busy` niet overschrijft.
- `backupTimeOf` (`backupService.ts`) leest het tijdstip van een backup uit de bestandsnaam, niet uit de
  wijzigingstijd: kopiëren en synchroniseren zetten die opnieuw. Een map met een kale document-id (van vóór de mappen
  `file-` en `unsaved-`) houdt na een jaar één backup per jaar (`bucketKeepsYearly`), omdat zo'n map bij een
  opgeslagen bestand kan horen.
