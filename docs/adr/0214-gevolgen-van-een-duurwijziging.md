# De gevolgen van een duurwijziging staan in één functie, in een vaste volgorde

Een duurbewerking komt binnen via de store, het taakraster en de MCP-draft, en elk van die routes schrijft op zijn
eigen manier (een Immer-draft, een losse kopie in een rastertransactie, een draft met terugrollen). Wat de wijziging
met de rest van de taak doet, staat daarom op één plek, `applyDurationChangeRules` (`utils/taskDefaults.ts`). Haar
aanroepers staan in `workRuleApply.ts`: `settleEditedDuration` (de duurbewerking in `taskSlice.updateTask`, de
MCP-draft en `finishDurationEdit` in `taskEditPlan.ts`) en `settleDurationAftermath` (een duur uit de werkdriehoek,
ADR 0200). De aanroeper geeft de werkduur van vóór de mutatie mee, gemeten op de as van ADR 0003
(`taskWorkMinutesOf`), en de werktijd per dag waarmee die gemeten is. Toetsen: `check-duration-change-routes.ts`
(store tegen raster) en `tests/mcp/cases-splits.ts` (de MCP-route).

## Gevolgen

- De volgorde in `applyDurationChangeRules` is een besluit. Eerst `rescaleTaskContours` (ADR 0003). Herschaalde die
  niets en krimpt het werk, dan vervallen gebruikersgaten op of voorbij het nieuwe werktotaal (`clipUserGapsToWork`).
  Zonder herschaling schuift geen gat mee, en een gat voorbij het werktotaal maakt de gatenlijst niet wélgevormd; zo'n
  lijst is alleen-lezen voor splitsen (regel `gantt-splits`), en dat is erger dan het gat te laten vervallen. Dat
  knippen gebeurt vóór `clearLevelingGaps`, omdat de plek van een gebruikersgat op de as de nivelleergaten ervoor
  meetelt (`splitWalk.ts`). Daarna `invalidateForTimeBaseChange` en `clearLevelingGaps` (ADR 0213).
- Het raster geeft `rescaleContours: false` als de werktijd per dag niet bruikbaar is (`finishDurationEdit`); dan
  geldt de stap met de gebruikersgaten zoals zonder herschaling.
- Bij een gelijke werkduur herschaalt `rescaleTaskContours` niets (`rescaleFactor` geeft dan geen factor), dus ook een
  verplaatsing in de tijd niet. Bij een kalenderwissel kan in twee stappen herschaald worden, allebei vanuit
  `settleCalendarChange` en alleen bij een taak met een momentopname van de werkdriehoek (`captureTriangle`) en een
  andere slotgrootte; voor een urentaak keert die functie eerder terug. Eerst roept het `rescaleTaskContours` aan met
  de werktijd per dag van de nieuwe kalender. Slaagt de werkdriehoek daarna (`result.ok`) en verandert ze de duur
  (`written.durationChanged`), dan roept het `settleDurationAftermath` aan, en `applyDurationChangeRules` herschaalt
  de contour nogmaals als de taak een contour heeft en de werkduur op de as verandert (`rescaleFactor`). Toets:
  `check-work-rule-store.ts`, r7 (vast werk van 4 dagen van 8 naar 6 uur per dag: duur 16/3 dagen, as en werk 1920
  minuten).
- `setTaskSplits` geeft `keepGaps: true` aan `rescaleTaskContours` (`splitMutations.ts`): de gatenlijst komt daar uit
  het stukkenmodel en is al op de nieuwe werkduur gerekend, dus herschalen zou haar twee keer schalen.
- Werkbehoud bij het herschalen volgt de werkregel (`contourKeepsWork`, regel `contour`); zonder argument gebruikt
  `rescaleTaskContours` alleen de MSP-herkomst.
- `taskCalendarHoursPerDay` neemt de werktijd per dag uit `effHoursPerDay` van de opgeloste taakkalender, dezelfde
  functie als de werkregelbrug en het taakraster (ADR 0200).
