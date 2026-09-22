# Taken splitsen — etappe 5 (MCP-tool, exportmelding, gids, poorten, PR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Het derde oppervlak (AI-tool `planner_set_task_splits`), zichtbaar exportverlies naar
MSPDI/P6, de in-app gids, documentatie-afronding, rooktests en de volledige `verify` — waarna de
orchestrator de PR maakt.

**Architecture:** Tool in `src/services/mcp/tools/taskTools.ts` volgens `docs/recepten/mcp-tool.md`;
invoer in de leesbare werk-as-vorm (`interruptions: [{ afterWorkDays|afterWorkHours, pauseDays|pauseHours }]`),
vertaald naar stukken via `splitEdit.ts` en geschreven via de documentcontext (`ctx.app`-store-actie
`setTaskSplits`; nooit `useAppStore`/`appStoreContext` importeren). Exportverlies via het bestaande
K8a-meldingskanaal (`notify`) in `fileSlice.exportAs`. Gids volgens `docs/recepten/in-app-gids.md`.
Spec §5–§6 en de tabel "Verwerkte critreview" (bevindingen 5, 11).

**Werkafspraken:** poorten op exitcode; `npm run verify` maximaal ÉÉN keer, aan het eind, nooit
parallel aan een andere suite; `PATH` met nvm node v24; niet pushen; dev-server 3028 met rust laten.

---

### Task 1: `planner_set_task_splits`

**Files:** `src/services/mcp/tools/taskTools.ts` (nieuwe `McpToolDef`, `kind: 'mutate'`,
`batchable: true`), `src/services/mcp/tools/taskFields.ts` (weigertekst `splitGaps` → verwijst naar de
tool), `src/services/mcp/tools/readTools.ts` (naast `splitGaps` de leesbare `interruptions`-vorm
teruggeven, dezelfde eenheden als de invoer), `CLAUDE.md` (regel "De 40 `planner_*`-tools" → 41 —
Poort 7e van `verify:docs`), `tests/mcp/cases-splits.ts` (nieuw; het runscript pikt `cases-*.ts` op).

- [ ] Schema binnen de twaalf ondersteunde trefwoorden: `taskId` (string, required), `interruptions`
  (array, items object met `afterWorkDays`/`afterWorkHours`/`pauseDays`/`pauseHours` als number
  ≥ 0, `additionalProperties: false`), lege lijst = alle onderbrekingen opheffen. Dag- en uursleutels
  mogen niet gemengd worden (zachte weigering met reden). Eenheid volgt de taak (`splitUnitMinutes`).
- [ ] Handler: taak zoeken (drift-anker via `bindExpectedDoc`/bestaande patroon), `canSplitTask` ⇒
  `toolError` met de reden; stukken bouwen = `removeAllGaps(toSplitPieces(...))` en daarna per
  onderbreking `splitAt` op de werk-as (gesorteerd op `after`); elke weigering (`position-on-gap`,
  `work-too-short`, …) ⇒ foutantwoord met de index van het item, niets geschreven. Schrijven via de
  store-actie `setTaskSplits` van de documentcontext; antwoord via `enrichOk` met de nieuwe
  `interruptions`, `scheduleDuration`, en de bestaande stale-melding (de tool herrekent NIET zelf —
  zelfde regel als `planner_update_tasks`).
- [ ] Tests (via `handleMcpMessage`, niet rechtstreeks de handler): dag-taak 10d ⇒ `[{afterWorkDays:5, pauseDays:3}]`
  ⇒ `splitGaps` `[{2400,1440,'user'}]`; twee onderbrekingen; lege lijst heft op; mijlpaal ⇒ fout;
  uur-taak met `pauseHours`; gemengde eenheden ⇒ fout; `aiReadOnly` ⇒ geweigerd; in `planner_batch`
  ⇒ werkt en schema wordt afgedwongen; `cases-toolregistry.ts` en `cases-schemavalidatie.ts` groen.
- [ ] `npm run test:mcp`, `npm run verify:docs`, `npm run verify:store-boundaries` exit 0.
  Commit: `MCP: planner_set_task_splits`.

### Task 2: Exportverlies zichtbaar

**Files:** `src/services/msproject/mspdiWriter.ts` en `src/services/p6/p6xmlWriter.ts` (de
`splitWithoutContour`-telling als retourwaarde/`warnings` beschikbaar maken i.p.v. alleen
`console.warn` — kijk hoe de writer nu zijn resultaat teruggeeft en breid dat minimaal uit),
`src/state/slices/fileSlice.ts` (`exportAs`: na een geslaagde MSPDI/P6-export `notify({ severity:
'warning', messageKey: 'notifications.exportSplitsLost', count })`), `common.json` in alle 14 locales
(pluralfamilie met de juiste CLDR-categorieën: nl "{{count}} taak met onderbrekingen is zonder
onderbrekingen geëxporteerd: MS Project/P6 kennen die alleen als urenverdeling." / "_other"),
`tests/planning/check-export-guard.ts` of een nieuwe check: export van een taak met `'user'`-split
zonder contour geeft precies één melding; met contour geen.
- [ ] De bestaande `console.warn`-tekst corrigeren (ze noemt alleen importbronnen).
- [ ] Commit: `Export: verlies van onderbrekingen naar MSPDI/P6 wordt gemeld`.

### Task 3: Gids en documentatie

**Files:** `public/docs/manifest.json` (id `gids-taken-splitsen`, layer `gidsen`, titels in 14 talen,
cluster zoals de buren), `public/docs/nl/gids-taken-splitsen.md` + `public/docs/en/...` (binnen de
miniMarkdown-subset: wat een onderbreking is en wanneer je hem gebruikt i.p.v. losse taken (het
voorbeeld uit issue #146: twee projecten die elkaar afwisselen), de splits-modus, stukken en randen
slepen, rechtsklik, de sectie Onderbrekingen in het paneel, wat er met de duur gebeurt, welke taken
niet splitsbaar zijn, MS Project-splits die alleen-lezen zijn, de exportbeperking, en de AI-tool),
`public/docs/{nl,en}/gids-msproject-import.md` §"Gesplitste taken" (verwijzing `docs://gids-taken-splitsen`),
`docs/TODO.md` (regel "Splitsen/handmatig plannen als bewerkfunctie (UI)" afvinken; nieuwe open regel:
native MSPDI/P6-schrijven van een split zonder contour; nivelleerder blind over importsplits),
`CLAUDE.md` (korte alinea onder *Rendering* of *State*: waar splits bewerken leeft — `splitEdit.ts`,
`setTaskSplits`, `useSplitGesture`, de sectie, de tool; source `'user'`; niet-wélgevormd = alleen-lezen),
`public/skills/goed-plannen/SKILL.md` + byte-identieke kopie `.claude/skills/goed-plannen/SKILL.md`
(één regel bij stap 3: onderbreking in een taak via `planner_set_task_splits` wanneer werk wordt
opgeschort en hervat — geen losse taken).
- [ ] `npm run verify:docs` exit 0. Commit: `Docs: gids Taken splitsen + verwijzingen`.

### Task 4: Rooktests niet-gecontroleerde oppervlakken

- [ ] `tests/planning/check-split-bar-render.ts` of `check-reports.ts`: een taak met `'user'`-split
  in (a) `printPreview` (segmenten getekend, geen throw), (b) het WBS-/voortgangsrapport (duur =
  werkduur, geen pauze meegeteld), (c) verzameltaak-rollup (ouder eindigt op het einde van het
  laatste stuk), (d) baseline/variance (afwijking vergelijkt einddata, geen throw). Kleine
  asserties, geen nieuwe engine-logica.
- [ ] Commit: `Splits: rooktests print, rapporten, rollup en baseline`.

### Task 5: Volledige verify (orchestrator)
- [ ] `npm run verify` één keer, exit 0; daarna pushen en PR.
