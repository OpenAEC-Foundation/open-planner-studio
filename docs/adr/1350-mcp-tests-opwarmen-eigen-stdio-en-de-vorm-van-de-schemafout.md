# MCP-tests: opwarmen, een eigen stdio-transport en de vorm van de schemafout

Een paar keuzes in de MCP-tests in `tests/mcp/` zien eruit als iets wat je kunt opschonen, maar dragen de toets.

## Gevolgen

- **Opwarmen met één bewerking en Undo.** Casebestanden die na een terugrol of Undo de store byte voor byte
  vergelijken, beginnen met `addTask` gevolgd door `undo()` (onder meer `cases-transaction.ts`,
  `cases-runtime.ts`, `cases-guards.ts`, `cases-draft.ts`). Een verse store heeft `calendars: []`, en het herstel
  van een snapshot (`snapshot.ts`) roept `syncProjectCalendar` aan, die de projectkalender aan de bibliotheek
  toevoegt als hij daar nog niet staat. Zonder het opwarmen ziet de eerste vergelijking na een terugrol die
  toevoeging als verschil. Haal die twee regels niet weg als "ongebruikt".
- **Een eigen stdio-transport in `cases-mcpb.ts`.** De case start de meegeleverde server met een eigen minimaal
  stdio-clienttransport, niet met `StdioClientTransport` van `@modelcontextprotocol/sdk`. Dat transport importeert
  `cross-spawn`, een CommonJS-pakket, en `run.sh` bundelt de cases met esbuild als ESM; de bundel gooit dan bij het
  laden "Dynamic require of "child_process" is not supported".
- **De batchtoetsen in `cases-schemavalidatie.ts` eisen de vorm van de poortfout.** `expectBatchSchemaReject` eist
  `step N: invalid arguments for <tool> —` (de tekst van `validateToolArgs` in `batchTool.ts`), niet alleen een
  mislukte batch. De leestools toetsen hun argumenten ook zelf (0401); een toets op alleen `ok === false` bleef dan
  groen zonder de schemapoort in `planner_batch`.
- **Leestools zonder array van objecten.** De schemapoort toetst de binnenkant van array-items alleen voor
  `ATOMIC_ITEM_TOOLS`, in de dispatcher en in `planner_batch` gelijk. De toets "leestools hebben geen
  object-array-items" in `cases-schemavalidatie.ts` faalt zodra een leesschema zo'n array krijgt: dan moet opnieuw
  gekozen worden tussen diep toetsen en weigeren per item.
- **Alleen `cases-toolregistry.ts` kent de volledige set tools.** Die toets leest de `name: 'planner_…'`-literals uit
  `src/services/mcp/tools/*.ts` met een reguliere expressie en vergelijkt ze met de registry; uit de registry zelf
  is een vergeten registratie niet af te lezen. De andere MCP-tests noemen geen vast aantal tools, zodat een nieuwe
  tool daar niets breekt; `cases-schemavalidatie.ts` eist alleen dat de lijst niet leeg is.
