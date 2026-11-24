# De volgorde van taken staat op drie plekken

De boom van een planning staat op drie plekken: `parentId` per taak, de `childIds` van een ouder en de volgorde van
de rauwe lijst `tasks`. Ze worden elk door iets anders gelezen. De weergave (`computeViewRows` in
`engine/view/visibleRows.ts`) neemt in de zuivere boomweergave, zonder actieve sortering, de kinderen van een ouder in de volgorde van `childIds` en de taken op het hoogste
niveau in de volgorde van de rauwe lijst. De WBS-nummering loopt via `flattenOrder` (`utils/wbs.ts`), die kinderen op
`parentId` groepeert in de volgorde van de rauwe lijst en `childIds` niet leest. We houden die drie plekken en kiezen
niet één bron, omdat de weergave en de nummering elk op hun eigen bron leunen. Een actie die de volgorde verandert,
moet daarom zelf de plekken bijwerken die ze raakt; welke dat zijn, staat in haar functie in `taskSlice.ts`. Werkt een
actie alleen `childIds` bij, dan kunnen de zichtbare volgorde en de WBS-volgorde uit elkaar lopen (knownbug 1981).

## Gevolgen

- In de rauwe lijst verhuist alleen de taak zelf, niet haar subboom (`applyTaskPlacement`, `moveTaskEdit`,
  `reorderSibling`). Haar kinderen hangen via `parentId` aan haar en `flattenOrder` zet ze weer onder haar, dus een
  verspreide subboom in de rauwe lijst is geen fout.
- `planTaskPlacement` bepaalt een doelplek zonder iets te veranderen en `applyTaskPlacement` voert haar uit. Rij slepen
  (`moveTaskTo`), een selectie slepen (`moveTasksTo`), uitspringen en het opheffen van een kopregel gebruiken die twee.
  De index telt in de kindlijst zonder de taak zelf, want de taak gaat eerst weg en komt dan terug.
- `moveTask` (Taak bewerken, en `planner_move_task` via de tweeling in `state/taskTree.ts`) heeft een eigen plaatsing
  in `moveTaskEdit`.
- `addTask` met een anker (invoegen boven of onder) neemt de ouder van het anker. Een onbekend anker is geen fout: de
  taak komt dan achteraan onder `parentId`.
- `reorderSibling` maakt de planning niet verouderd: een herordening raakt geen tijden.
- Inspringen (`indentEdit`) verandert `parentId` en `childIds` en niet de rauwe lijst (knownbug 1981).
- De boom kan uit een bestand een kring in `parentId` meekrijgen (knownbug 1980). `isSelfOrDescendant`, `ancestorIds`
  en `flattenOrder` onthouden welke taken ze al zagen en lopen op zo'n kring niet vast.
