# Taaktype overerven van bovenliggende taak — ontwerp

**Datum:** 2026-08-14
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan
**Scope:** taakaanmaak (UI + AI/MCP). Geen wijziging aan indenteren/verslepen van bestaande taken.

## Doel

Wanneer een nieuwe taak wordt aangemaakt met een bovenliggende taak (`parentId`), krijgt hij standaard hetzelfde `taskType` als die ouder — in plaats van de huidige bouwmodus-brede default (`CONSTRUCTION`/`USERDEFINED`). De gebruiker kan het type na aanmaken nog altijd handmatig wijzigen; dit verandert alleen de startwaarde.

## Niet-doelen (YAGNI)

- Geen overerving bij indenteren (Tab), outdenten of slepen naar een andere ouder — een bestaande taak behoudt zijn eigen `taskType` bij reparenting. Alleen het moment van *aanmaken* ("spawnen") is in scope.
- Geen wijziging aan `isMilestone`/`milestoneKind` — die blijven orthogonaal aan `taskType` en volgen dezelfde overervingsregel als een gewone taak (geen aparte behandeling nodig).
- Geen UI-wijziging (geen nieuwe picker, geen indicator "overgeërfd van ouder"). Pure default-logica.
- Geen wijziging aan het gedrag voor root-taken (geen ouder) — die blijven de bestaande constructionMode-default gebruiken.

## Huidige situatie

Twee plekken maken daadwerkelijk een `Task`-object aan en berekenen `taskType` nu identiek, zonder ooit naar de ouder te kijken:

- `taskSlice.ts` `addTask` (UI-pad: "+ Taak"-knop, invoegen boven/onder, contextmenu) — regel 298:
  ```ts
  taskType: partial.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
  ```
- `mcpTransaction.ts` `draft.addTask` (AI-tool `planner_add_tasks`, ook de geneste/bulk-variant `draft.addTasks`, die per item `draft.addTask` aanroept) — regel 184, identieke expressie.

`parentId` wordt in beide functies al vóór de constructie van het `Task`-object opgelost (`taskSlice.ts:289`, `mcpTransaction.ts:173-177`).

## Wijziging

Op beide plekken: zoek — nadat `parentId` is opgelost, vóór het `Task`-object wordt gebouwd — de ouder op in `s.tasks` en gebruik `parentTask.taskType` als tussenstap in de fallback-keten, alleen wanneer de aanroeper zelf geen `taskType` heeft meegegeven:

```ts
const parentTask = parentId ? s.tasks.find(t => t.id === parentId) : undefined;
// ...
taskType: partial.taskType || parentTask?.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED'),
```

`mcpTransaction.ts` valideert al dat een opgegeven `parentId` bestaat (regel 175-177, gooit anders een fout) — de `find` daar kan dus die validatiestap hergebruiken (of gewoon opnieuw zoeken; goedkoop, `s.tasks` is klein).

Effect op afgeleide paden:
- `addTaskNearSelection`/`insertTaskRelativeToScope` (`taskInsertActions.ts`) roepen alleen `store.addTask` aan — geen wijziging nodig, erven automatisch mee.
- `draft.addTasks` (geneste WBS in één MCP-call) loopt top-down en roept `draft.addTask` per item aan met de al-opgeloste `resolvedParent` — een net aangemaakte ouder bestaat dus al in `s.tasks` tegen de tijd dat zijn kind wordt verwerkt, dus geneste batches erven ook correct over, zonder aparte logica.
- Root-taken (`parentId === null`): `parentTask` is `undefined`, keten valt terug op de bestaande constructionMode-default — ongewijzigd gedrag.
- Expliciete `partial.taskType` (handmatige keuze in UI of AI-aanroep): wint altijd, zoals nu.

## Testen

- `tests/planning/`: nieuwe case — taak aanmaken met `parentId` naar een taak met een afwijkend `taskType` (bv. ouder `LOGISTIC`, geen expliciet type op het kind) → kind krijgt `LOGISTIC`. Plus een case zonder ouder (root) → ongewijzigd constructionMode-gedrag, en een case met expliciet `taskType` op het kind → dat wint van de ouder.
- `tests/mcp/`: analoge cases voor `planner_add_tasks`, inclusief een geneste batch (ouder en kind in dezelfde aanroep, ouder via `tempId`) om te bevestigen dat de net-aangemaakte ouder al meetelt.
