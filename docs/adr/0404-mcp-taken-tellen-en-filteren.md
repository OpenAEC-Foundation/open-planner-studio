# Hoe de leestools taken tellen en filteren

Een agent vergelijkt wat hij via MCP leest met wat de planner op het scherm ziet. Waar de app al een filter heeft,
gebruikt `planner_list_tasks` daarom dezelfde functie, en waar een telling of filter bewust afwijkt, zegt de
beschrijving van de tool dat.

## Gevolgen

- `statistics.criticalTasks` telt alleen bladtaken (`countCriticalActivities`): een verzameltaak draagt een
  opgerolde kritieke vlag, maar is geen activiteit. Het rapport *Kritieke en near-critical activiteiten* telt zijn
  eigen rijen (`computeCriticalReport` in `src/engine/reports/criticalReport.ts`, zonder voltooide taken en hammocks),
  dus die twee tellingen kunnen verschillen zodra een voltooide taak of een hammock `isCritical` draagt. Het filter
  `kritiek` van `planner_list_tasks` geeft wel elke taak met `isCritical`, ook een fase, met `summary: true` op de rij.
  Beide beschrijvingen zeggen dat. Toets: `cases-read.ts`, "get_project_info: criticalTasks telt alleen bladtaken, …"
  (een fase met A → B en een losse C, niets voltooid; de toets eist 2 in de projectinformatie, gelijk aan de lengte
  van `cpmResult.criticalPath` en aan `countCriticalActivities`, 3 in de lijst met `summary` op de fase, en de zinnen
  in beide beschrijvingen).
- `van` en `tot` filteren op overlap van de getoonde spanne met het venster, op dagniveau, beide grenzen inbegrepen
  (`shownSpanOverlapsDays`, dezelfde test als het filter "Actief tussen" in `filterEval.ts` en de rapportvensters in
  `reportCommon.ts`). Als tekst is `2026-06-03T08:00` groter dan `2026-06-03`, dus een vergelijking van teksten mist
  een urentaak die op de dag van `tot` begint. Een open kant begrenst niets. Toets: `cases-read.ts`, "list_tasks
  van/tot: een urentaak die op de tot-dag begint telt mee …" (B loopt op 3 juni van 8:00 tot 16:00; de toets eist B
  in het venster 2 tot en met 3 juni en in het venster van alleen 3 juni).
- `zonder_relaties` geeft bladtaken zonder relatie op zichzelf en op een voorouder, en zonder externe relatie (eigen
  of geërfd van een fase, `externalRelationCount`). Een relatie op een fase verbindt haar bladtaken met het netwerk,
  zoals in de berekening en in de rapporten (`buildLogicIndex`); een relatie op een kind verbindt haar ouder en haar
  zustertaken niet. Toets: `cases-read.ts`, "list_tasks zonder_relaties: vindt precies de leaf-wezen …" (inkomende,
  uitgaande en geneste faserelaties; de toets eist per stand de lijst met namen en het paginatotaal).
- `externe_relaties` telt dezelfde eigen en geërfde koppelingen, en de rij draagt hun aantal als `ext`.
- `schedulingProfile` staat altijd in de projectinformatie, ook zonder profiel op het project (dan `ops`), met
  `conventions` uit `resolveConventions` (de set waarmee de solver rekent) en `overrides` letterlijk zoals het project
  ze draagt. `schedulingOptions` geeft de projectopties zoals het project ze draagt plus altijd `startToStartLagFrom`:
  zonder waarde geldt `'earlyStart'` (de standaard in `conventions/registry.ts`; `CPMSolver.ts` wijkt alleen af bij
  `'actualStart'`), en een agent die de sleutel mist, weet dat niet. Het blok `leveling` komt mee; dat het nergens
  meerekent, zegt de beschrijving van de tool.
