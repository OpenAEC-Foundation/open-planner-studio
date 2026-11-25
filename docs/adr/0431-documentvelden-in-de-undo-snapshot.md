# Documentvelden in de undo-snapshot: data en derived

Een documentveld heeft in `DOCUMENT_FIELDS` een rol in de undo-snapshot (`SnapshotRole`): `'data'`, `'derived'` of
`'none'` (ADR 0432 en 0433 voor de laatste). `'data'` is projectdata die de gebruiker zet en die in het bestand staat;
`'derived'` is een rekenresultaat of weergavemodus. Beide staan in de snapshot en beide worden per referentie bewaard,
zonder diepe kloon: Immer muteert de basis niet en bevriest de state diep, zodat een gedeelde snapshot niet mee kan
veranderen (`check-mutation-cost.ts` toetst de bevriezing na elke soort mutatie, en dat de bronbestanden die het leest
`setAutoFreeze` niet aanroepen).
Het onderscheid telt voor `documentDataChanged` (`snapshot.ts`): die kijkt alleen naar `'data'`, en een MCP-transactie
en een batchstap gebruiken haar om te beslissen of er iets veranderde (ADR 0240).

## Gevolgen

- `activeBaselineId` en `comparedBaselineIds` (issue #391) zijn `'data'` en niet `'derived'`: de gebruiker kiest ze en ze
  gaan mee in het bestand (`IFC_SAVE_KEYS`). Als `'derived'` zag `documentDataChanged` een andere actieve baseline niet,
  en telde een MCP-transactie die alleen de actieve baseline wisselt als "niets gewijzigd".
- `ifcGlobalIds` is `'data'`: de writer geeft bestaande objecten hun GlobalId uit het ingelezen bestand terug (regel
  `tauri-ifc`, *GlobalIds*), en de IFC-editor kan die identiteit wijzigen.
- `project` staat helemaal in de snapshot. Dat mag alleen als elke mutator van een projectveld (in `projectSlice`) zelf
  een undo-stap maakt: een projectveld zonder eigen undo-stap springt bij het ongedaan maken van een andere bewerking
  mee terug.
- `calendar`, de afgeleide kopie van de projectkalender, staat ook als `'data'` in de snapshot. `restoreSnapshot` roept
  daarna `syncProjectCalendar` aan, die de kopie uit `calendars` zet; ontbreekt de bibliotheekregel, dan promoveert die de
  huidige `calendar` tot bibliotheekregel (`promoteProjectCalendarToLibrary`). Zonder eigen snapshotwaarde zou dat de nieuwe
  kopie zijn in plaats van de herstelde.
- `recordedDates` en `datesAsRecorded` zijn `'derived'`, net als `cpmResult` en `scheduleStale`: ze worden als geheel
  vervangen, en samen met `tasks` draait één undo de datums en de modus terug. Die rol rust op de voorwaarde dat elke
  mutator van deze velden een undo-stap maakt; de ene situatie waarin `runCPM` daarom wel een snapshot maakt, staat in
  de regel `state` (*Datums zoals opgeslagen*).
