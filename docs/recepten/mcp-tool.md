# Een nieuwe `planner_*`-MCP-tool toevoegen

De AI-assistent (zie *AI-assistent* in `CLAUDE.md`) stuurt de app aan via een vaste set
`planner_*`-tools. Rust is daarbij een dom doorgeefluik (`src-tauri/src/mcp_bridge.rs`); de hele
protocol- en toollaag zit in TypeScript, `src/services/mcp/`. Een tool toevoegen raakt altijd
dezelfde vier plekken, en drie ervan geven — anders dan bij het IFC-recept — pas een falende
**test** te zien, niet een compileerfout: `contracts.ts` legt alleen het *type* `McpToolDef` vast,
niet de lijst tool-namen zelf.

**Dit is een toelichting, geen vervanging.** De afdwinging zit in de code en in
`tests/mcp/cases-toolregistry.ts` (zie *Het nieuwe mechanische vangnet* onderaan); loopt dit
document ooit achter, dan heeft de code gelijk.

---

## De vorm van het probleem

| plek | wat er misgaat als je hem vergeet |
|---|---|
| de **tool-definitie** in `tools/*.ts` | de tool bestaat niet |
| de **registratie** in `toolRegistry.ts`'s `MODULES` | de tool compileert, maar `tools/list` toont hem nooit — dode code die niemand mist tot iemand er expliciet naar zoekt |
| het **schema** (`inputSchema`) | verplicht door het `McpToolDef`-type (compileerfout als je het vergeet), maar een schema met de verkeerde trefwoorden wordt runtime alsnog niet afgedwongen — zie *Schema-afdwinging* |
| de **case** in `tests/mcp/` | de tool draait ongetest tegen de echte store |

## De stappen

1. **Kies of dit een bestaande module uitbreidt of een nieuwe nodig heeft.** De negen
   `tools/*.ts`-modules zijn onderwerp-gegroepeerd (taken, relaties, resources+kalender, resources,
   baselines, documenten, bestanden, lezen, batch — zie de `MODULES`-lijst in `toolRegistry.ts`). Een
   nieuwe tool hoort meestal in een bestaande module; alleen een heel nieuw onderwerp krijgt een
   nieuw bestand.
2. **Schrijf de `McpToolDef`** (contract uit `contracts.ts`): `name` (verplicht met
   `planner_`-prefix — `toolIndex.ts` gooit anders bij registratie), `description` (niet-leeg, de AI
   kiest tools hierop), `kind` (`read`/`mutate`/`document`/`other`/`batch` — stuurt guards en de
   backup-trigger), `batchable`, `inputSchema`, `annotations`
   (`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`) en de `handler`.
3. **Schrijf het schema bewust binnen de ondersteunde trefwoordenset.** `schemaValidate.ts` is
   *geen* volledige JSON-Schema-implementatie — hij dwingt precies twaalf trefwoorden af
   (`SUPPORTED_KEYWORDS` bovenin dat bestand: `type`, `enum`, `required`, `properties`,
   `additionalProperties`, `items`, `minItems`, `maxItems`, `minimum`, `maximum`,
   `exclusiveMinimum`, `pattern`). Gebruik je iets daarbuiten (`oneOf`, `$ref`, `format`, …), dan
   staat het wél in `tools/list` (waar de AI zich erop richt) maar wordt het runtime **niet**
   gecontroleerd — `unsupportedKeywords()` in datzelfde bestand hoort dat te vangen, en
   `tests/mcp/cases-schemavalidatie.ts` draait die check al over alle geregistreerde tools.
   - **Diepte-regel:** de schemapoort in de dispatcher controleert bij bulk-tools alleen de
     BUITENKANT van array-items (is het een array, `minItems`/`maxItems`, het elementtype); de
     BINNENKANT (properties/enum/required/pattern binnen één item) is aan de handler zelf, die er een
     zachte `itemRejections`-regel van maakt — zo rolt één rot item nooit de hele bulk terug. Is je
     tool per definitie alles-of-niets (zoals `planner_add_tasks`), zet hem dan in
     `ATOMIC_ITEM_TOOLS` (`schemaValidate.ts`).
4. **Registreer de module** in `toolRegistry.ts`: importeer je array boven, voeg hem toe aan
   `MODULES`. Nieuw bestand? Dan is dit de enige plek die ervan moet weten — de registratie-STAAT zelf
   (`registerToolModules`/`getTool`/`getTools`) leeft bewust in de leaf-module `toolIndex.ts`, niet
   hier (zie de kopcommentaren van beide bestanden voor de import-cyclus die dat voorkomt).
5. **Voeg een case toe** in `tests/mcp/` (`cases-<onderwerp>.ts` — het runscript pikt elk
   `cases-*.ts`-bestand vanzelf op, geen aparte registratie nodig). Roep de tool bij voorkeur via de
   ECHTE dispatch-weg aan (`handleMcpMessage`, zie `cases-schemavalidatie.ts`), niet rechtstreeks via
   `def.handler(...)` — anders test je de poorten niet mee.

## Context-aandachtspunten

- **`McpContext`** (`contracts.ts`) is wat je handler krijgt: `app`/`transactions` (de storecontext,
  nooit zelf `appStoreContext`/`useAppStore` importeren — zie *State* in `CLAUDE.md`),
  `expectedDocId` (het drift-anker), `tempIdMap` (batch-only), en de live vlaggen `paused`/`readOnly`
  plus `ensureBackup`/`markDuplicateBorn`.
- **`staleGuard.ts`'s `ensureFreshSchedule`** herrekent de planning alleen als ze stale is of nog
  nooit gedraaid heeft, zonder een undo-snapshot te pushen (`runCPM` schrijft alleen berekende
  velden terug — zie *Scheduling* in `CLAUDE.md`). Gebruik hem in elke tool die een verse planning
  nodig heeft maar geen extra undo-stap mag achterlaten (voorbeeld: `get_resource_histogram` in
  `readTools.ts`).
- **Read-only-modus** (`ui.aiReadOnly`) en **pauze** (`ui.aiPaused`) worden vóór de handler
  afgedwongen door `preBackupGuards` (`tools/runtime.ts`) — een muterende tool hoeft dit zelf niet te
  controleren, maar een leestool (`kind: 'read'`) loopt via `runReadTool`, dat deze guards bewust
  NIET toepast (lezen mag altijd, ook gepauzeerd/read-only).
- **`planner_batch` omzeilt de schemapoort niet.** Batch-stappen dispatchen niet via
  `handleMcpMessage` maar via `batchStep`/rechtstreeks `def.handler`; sinds de fix in
  `dispatcher.ts`/`batchTool.ts` draait `validateToolArgs` óók per stap, met dezelfde
  diepte-instelling. Een nieuwe tool die `batchable: true` draagt, wordt dus automatisch ook binnen
  een draaiboek geschemavalideerd — niets extra's te doen, maar goed om te weten als je een
  `cases-batch.ts`-achtige regressie schrijft.

## Het nieuwe mechanische vangnet

`tests/mcp/cases-toolregistry.ts` scant `src/services/mcp/tools/*.ts` op elke `name: 'planner_...'`-
literal en vergelijkt die verzameling, na `registerAllTools()`, exact tegen `getTools()`: elke
tool-literal moet geregistreerd zijn (anders is een module vergeten in `MODULES`) en elke registratie
moet een tool-literal hebben (anders is er een spookregistratie), met exact gelijke namen en
gelijke aantallen. Vult dat de laatste blinde vlek: vóór deze poort compileerde een vergeten
`MODULES`-regel gewoon — het tool-bestand exporteerde zijn array keurig, TypeScript zag niets fout,
en de tool verdween stilzwijgend uit `tools/list`.

Let op het onderscheid met **Poort 7e** in `scripts/verify-docs.ts`: die telt `planner_*`-literals in
dezelfde map en vergelijkt het GETAL met de bewering "De N `planner_*`-tools" in `CLAUDE.md` — dat
bewaakt alleen dat de documentatie het aantal niet laat wegdrijven, niet dat elke tool ook echt
geregistreerd is. Beide poorten scannen dezelfde bron, maar toetsen iets anders.

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| types (`McpToolDef`, `McpContext`, foutcodes) | `src/services/mcp/contracts.ts` |
| tool-definities per onderwerp | `src/services/mcp/tools/*.ts` |
| registratie (`MODULES`, `registerAllTools`) | `src/services/mcp/toolRegistry.ts` |
| kale registratie-staat (`getTool`/`getTools`) | `src/services/mcp/toolIndex.ts` |
| JSON-RPC-routering + waar de schemapoort wordt aangeroepen | `src/services/mcp/dispatcher.ts` |
| runtime-schemavalidatie (ondersteunde trefwoorden, diepte-regel) | `src/services/mcp/schemaValidate.ts` |
| guards (paused/readOnly/drift), leestool-wikkel | `src/services/mcp/tools/runtime.ts` |
| versheids-guard zonder undo-snapshot | `src/services/mcp/staleGuard.ts` |
| bridge-levenscyclus, token, `isTauri()`-splitsing | `src/services/mcp/server.ts` |
| batch-executor + temp-id-resolutie | `src/services/mcp/tools/batchTool.ts` |
| de tests zelf + het volledigheidsvangnet | `tests/mcp/cases-*.ts`, `tests/mcp/cases-toolregistry.ts` |
| tellingscontrole tegen CLAUDE.md ("N tools") | `scripts/verify-docs.ts` (Poort 7e) |
