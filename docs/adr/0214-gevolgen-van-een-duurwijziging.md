# De gevolgen van een duurwijziging staan in één functie, in een vaste volgorde

Een duurwijziging komt binnen via de store, het taakraster en de MCP-draft, en elk van die routes schrijft op zijn eigen
manier (een Immer-draft, een losse kopie in een rastertransactie, een draft met terugrollen). Wat de wijziging met de
rest van de taak doet, staat daarom in één functie, `applyDurationChangeRules` (`utils/taskDefaults.ts`), zodat geen
route een gevolg mist. Haar aanroepers staan in `workRuleApply.ts`: `settleEditedDuration` (de duurbewerking zelf, in
`taskSlice.updateTask`, de MCP-draft en `finishDurationEdit` in `taskEditPlan.ts`) en `settleDurationAftermath` (een
duur uit de werkdriehoek, ADR 0200). De aanroeper geeft de werkduur van vóór de mutatie mee, gemeten met
`taskWorkMinutesOf` op de as van ADR 0003, en de werktijd per dag waarmee die gemeten is. Toets:
`check-duration-change-routes.ts`.

## Gevolgen

- De volgorde in `applyDurationChangeRules` is een besluit. Eerst herschaalt `rescaleTaskContours` de contour en de
  importsplits (ADR 0003). Is er niets herschaald en krimpt het werk, dan vervallen gebruikersgaten op of voorbij het
  nieuwe werktotaal (`clipUserGapsToWork`). Zonder contour schaalt niets de gaten mee, en een gat voorbij het
  werktotaal maakt de gatenlijst niet wélgevormd; zo'n lijst is alleen-lezen voor splitsen (regel `gantt-splits`), en
  dat is erger dan het gat te laten vervallen. Dat knippen gebeurt vóór `clearLevelingGaps`, omdat de plek van een
  gebruikersgat op de as de nivelleergaten ervoor meetelt (`splitWalk.ts`). Daarna laat `invalidateForTimeBaseChange`
  de gelezen sturing los en wist `clearLevelingGaps` de nivelleergaten (ADR 0213).
- Het raster zet `rescaleContours` uit als de werktijd per dag niet bruikbaar is (`finishDurationEdit`); dan geldt de
  stap met de gebruikersgaten zoals bij een taak zonder contour.
- Een verplaatsing in de tijd herschaalt niets: de as telt vanaf de start van de taak. Een kalenderwissel die de
  werktijd per dag verandert, herschaalt wel, via `settleCalendarChange` (regel `taaktypes`).
- `setTaskSplits` geeft `keepGaps: true` aan `rescaleTaskContours` (`splitMutations.ts`): de gatenlijst komt daar uit
  het stukkenmodel en is al op de nieuwe werkduur gerekend, dus herschalen zou haar twee keer schalen.
- Werkbehoud bij het herschalen is een keuze van de werkregel (`contourKeepsWork`, regel `contour`). Zonder argument
  gebruikt `rescaleTaskContours` alleen de MSP-herkomst (`mspTaskType === 'FIXED_WORK'`).
- `taskCalendarHoursPerDay` geeft de werktijd per dag uit `effHoursPerDay` van de opgeloste taakkalender, dezelfde
  functie als de werkregelbrug en het taakraster gebruiken (ADR 0200).
