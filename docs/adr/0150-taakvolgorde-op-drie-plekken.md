# De volgorde van taken staat op drie plekken

De boom van een planning staat in `taskSlice.ts` op drie plekken: `parentId` per taak, de `childIds` van een ouder en
de volgorde van de rauwe lijst `tasks`. Ze lezen elk iets anders. De zichtbare volgorde onder een ouder komt uit
`childIds` (`engine/view/visibleRows.ts`). De WBS-nummering loopt via `flattenOrder` (`utils/wbs.ts`), die kinderen op
`parentId` groepeert in de volgorde van de rauwe lijst en `childIds` niet leest. Taken op het hoogste niveau hebben
geen kindlijst: hun volgorde is hun onderlinge volgorde in de rauwe lijst. We houden die drie plekken bij elke
verplaatsing samen bij in plaats van één bron te kiezen, omdat de weergave, de WBS-nummering en de rest van de app
elk op hun eigen bron leunen. Een verplaatsing die alleen `childIds` bijwerkt, geeft een taak die zichtbaar achteraan
staat en een WBS-nummer volgens haar oude plek.

## Gevolgen

- In de rauwe lijst verhuist alleen de taak zelf, niet haar subboom (`applyTaskPlacement`, `moveTaskEdit`,
  `reorderSibling`). Haar kinderen hangen via `parentId` aan haar en `flattenOrder` zet ze weer onder haar, dus een
  verspreide subboom in de rauwe lijst is geen fout.
- `planTaskPlacement` bepaalt de doelplek zonder iets te veranderen en `applyTaskPlacement` voert haar uit. Rij slepen
  (`moveTaskTo`), een selectie slepen (`moveTasksTo`), uitspringen en het opheffen van een kopregel delen die twee, zodat
  ze niet uit elkaar lopen. De index telt in de kindlijst zonder de taak zelf, want de taak gaat eerst weg en komt dan
  terug.
- `moveTask` (Taak bewerken en `planner_move_task` via `moveTaskVerdict`) heeft een eigen plaatsing in `moveTaskEdit`:
  zonder positie achteraan, in `childIds` en in de rauwe lijst, en een enig kind komt vlak achter zijn ouder. De
  MCP-draft heeft een tweeling in `state/taskTree.ts`.
- `addTask` met een anker (invoegen boven of onder) neemt de ouder van het anker en voegt in beide lijsten naast het
  anker in. Een onbekend anker valt terug op achteraan onder `parentId`.
- `reorderSibling` verwisselt onder een ouder de twee ids in `childIds` en zet de taak in de rauwe lijst naast de
  ander. Op het hoogste niveau verwisselt hij de twee taken op hun plek in de rauwe lijst. Hij maakt de planning niet
  verouderd.
- Inspringen (`indentEdit`) verandert alleen `parentId` en `childIds`, niet de rauwe lijst. De nieuwe ouder is de
  voorgaande sibling in de volgorde van `flattenOrder`.
- De boom kan uit een bestand een kring in `parentId` meekrijgen (knownbug 1980). De kringtoetsen op de boom
  (`isSelfOrDescendant`, `ancestorIds`) onthouden wat ze al zagen en lopen daardoor niet vast.
