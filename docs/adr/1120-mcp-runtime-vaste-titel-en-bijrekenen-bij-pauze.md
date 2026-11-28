# MCP-runtime: vaste Engelse titel en bijrekenen bij pauze

De tool-runtime (`src/services/mcp/tools/runtime.ts`) zet de envelop op elk antwoord en draait de guards en de
versheid van de leestools. Twee keuzes daar zien er zonder uitleg verkeerd uit.

## Gevolgen

- Een naamloos document heet voor de AI `MCP_UNTITLED_TITLE`, een vaste tekst gelijk aan de Engelse vertaling van
  `common:project.untitled` ("New schedule"), en geen `t(...)`. Wat de agent via MCP leest is Engels
  (`.claude/rules/mcp.md`), en de i18n-UI-config mag niet in de bundel van de headless MCP-server
  (`scripts/build-mcp-server.mjs`). Geen poort vergelijkt de twee teksten: verandert de Engelse vertaling, pas dan
  `MCP_UNTITLED_TITLE` met de hand mee aan.
- `freshenScheduleForRead` rekent een verouderde planning ook bij als de bridge gepauzeerd of alleen-lezen is, anders
  dan nivelleren (ADR 0106). Een leestool mag dan lezen, en de herrekening is dezelfde als F5: ze schrijft alleen
  berekende velden, maakt geen undo-stap en zet `isDirty` niet (`tests/mcp/cases-read-freshness.ts`, "alleen-lezen +
  pauze"). Binnen een lopende MCP-transactie rekent ze niet: daar telt de transactie de herrekening als wijziging, en
  `planner_batch` ververst zelf vóór de transactie.
