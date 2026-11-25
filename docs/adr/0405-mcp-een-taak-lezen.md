# Wat planner_get_task over één taak geeft

`planner_get_task` is de lezing waarop een agent een wijziging van één taak bouwt. Ze geeft daarom de waarden in de
eenheid en de vorm waarin de taak ze draagt, en legt een verschil uit dat er zonder uitleg als een fout uitziet.

## Gevolgen

- De duur staat in de eenheid van de taak (`nativeDuration`): bij een urentaak `durationMinutes` gedeeld door 60,
  anders `scheduleDuration`, met `durationUnit` erbij. De rijen van het overzicht en van `planner_list_tasks` doen
  hetzelfde (`dur`, `durUnit`). Toets: `cases-taskfields.ts`, "add/update/get_task/overview: dagen en uren blijven
  hun native eenheid via MCP".
- Bij een toewijzing uit P6 met een ander resttempo is `unitsPerDay` het resttempo, en staat het begrote tempo apart
  als `plannedUnitsPerDay`, alleen als het gezet is (eigenaarsbesluit 2026-10-15, review #361 punt 3). Toets:
  `cases-read.ts`, "get_task: begroot tempo naast het resttempo …" (zonder het veld geen sleutel; met 1,111 naast
  inzet 34 beide waarden). De werkvelden en `costAmount` van een kostentoewijzing (#815) komen ook alleen mee als ze
  gezet zijn; `curve` zonder waarde is `UNIFORM`.
- Een eigen taaktype geeft altijd zijn id, en als naam `null` als het type niet in de catalogus van het project
  staat. Zo blijft een beschadigd of oud project leesbaar zonder dat de taak een ander type lijkt te hebben. Toets:
  `cases-read.ts`, "get_task: custom taaktype …" (een bekend type met naam en een onbekend id met `name: null`).
- Een voltooide taak (`completion` 1) met een `actualFinish` die niet gelijk is aan `earlyFinish`, krijgt
  `progress.actualFinishAdjusted` met beide datums en een reden die de effectieve kalender van de taak noemt en de
  uitweg (`planner_update_calendar`). Valt de werkelijke finish in niet-werkbare tijd, dan eindigt de berekening op
  het werkbare moment ervoor; een agent die de twee velden zonder uitleg naast elkaar ziet, concludeert anders dat de
  herberekening kapot is. Toetsen: `cases-statusdatum.ts`, "get_task meldt het verschil tussen de gerekende finish
  en de actualFinish" (een werkelijke finish in het bouwvak; de toets eist het blok, de ongewijzigde actual en de
  reden met de uitweg) en "valt de actualFinish gewoon op een werkdag, dan is er niets te melden". De voorwaarde is
  alleen dat de twee datums verschillen; de reden noemt een kalenderoorzaak ook als die niet is vastgesteld
  (knownbug 2474).
- Naast de eigen externe koppelingen (`externalLinks`, ook leeg) geeft de tool de koppelingen van de fasen erboven
  als `inheritedExternalLinks`, met `fromTaskId` en `fromWbs`, alleen als er zijn: een koppeling op een fase geldt
  voor elke taak in die fase (keuze 11 in `docs/relaties-tussen-projecten.md`). Toets: `cases-externe-relaties.ts`.
