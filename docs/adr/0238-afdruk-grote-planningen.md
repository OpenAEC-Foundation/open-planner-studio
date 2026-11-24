# De afdruk van een grote planning: begrensd tekenen en rekenen

Een lange planning op *Passend maken* geeft een tijdas van minder dan een pixel per dag, en het papier op het
Rapport-tabblad rendert bij elke klik opnieuw. Volgens het weggehaalde commentaar hield het één voor één tekenen van
onzichtbare daglijnen de hoofdthread minutenlang bezig, en kostten de datumcellen bij 5000 taken ruim de helft van een
papieropname (gemeten 9 november 2026). Daarom begrenst `renderReport` wat het tekent op wat leesbaar is, en onthoudt
het wat voor een ongewijzigde taak al uitgerekend is.

## Gevolgen

- De dagrasterlijnen nemen een stap zodat er hoogstens ongeveer `MAX_DAILY_GRID_STEPS` (5000) zijn en niet meer dan één
  per pixel. De weekend- en feestdagarcering op de kalenderas tekent alleen bij hoogstens `MAX_DAILY_WEEKEND_STEPS`
  dagen en minstens een halve pixel per dag. In de kop (`drawTimelineHeader`) slaan de maandlabels maanden over als een
  maand smaller dan een pixel is of het bereik heel groot, staat het weekraster er alleen bij minstens een pixel per
  week en een begrensd bereik, en staan de dagcijfers er alleen bij meer dan 15 px per dag en hoogstens
  `MAX_DAILY_GRID_STEPS` dagen. De maand- en weekkoppen lopen per maand en per week, niet per dag.
- `taskDayRange` en `taskOwnCellTexts` onthouden hun uitkomst alleen voor een bevroren taak (`Object.isFrozen`): de
  taken uit de store zijn door Immer bevroren en veranderen dus niet meer. Een losse taak (een toets, een import) rekent
  elke keer opnieuw. Voor `taskDayRange` scheelde dat volgens het weggehaalde commentaar bij 5000 taken ongeveer 15 ms
  per klik. De celteksten hangen ook van de opmaak af; `cellTextCacheFor` houdt per opmaak (notaties, taal,
  duurweergave, afkortingen en de kalenders) een eigen tabel bij, hoogstens vier tegelijk, genoeg voor bijvoorbeeld
  meting en render naast elkaar.
- `drivingSetOf` maakt de verzameling bepalende relaties één keer per lijst `drivingSequenceIds`, want het papier
  rendert per klik meerdere keren met dezelfde opties; volgens het weggehaalde commentaar kostte het opbouwen bij 5000
  relaties elke render een milliseconde.
- `measureTableColumnWidths` neemt een `TableColumnMeasureCache`, zodat bij een kolom erbij alleen die kolom over alle
  rijen gemeten wordt. De cache geldt zolang rijen, opmaak, koppen en letter gelijk blijven; daarna maakt de aanroeper
  een nieuwe (`check-report-columns.ts`, sectie 6).
