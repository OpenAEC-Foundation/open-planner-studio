# Een payload laden: leesmigraties en de volgorde in hydratePayload

Een `DocumentPayload` kan uit een oudere versie van de app komen, uit een slapend tabblad of uit crashherstel, en dan
velden missen of een oude vorm hebben. Daarvoor heeft een veld een leesmigratie (`fromPayload` in
`DOCUMENT_FIELDS`); zonder `fromPayload` neemt `hydratePayload` de waarde letterlijk over. De migraties staan per veld in
de lijst: een standaardwaarde met `??`, de oude naam `resourceCalendars` voor `calendars`, `normalizeTaskDurationUnits`
voor `tasks`, `normalizeComparedBaselines` voor `comparedBaselineIds` en `normalizeView` voor `view`.

## Gevolgen

- `normalizeView` vult `filter`, `group`, `sort` en `collapsedGroupKeys` aan die een oude payload kan missen. Het oude
  veld `groupBy` (een activity-code-type-id) wordt, als `group` ontbreekt of leeg is, één groeperingsniveau op die
  activity code, oplopend. Daarna haalt het `groupBy` weg, zodat het niet opnieuw meereist, en ook `columns`:
  taakgridkolommen zijn alleen nog app-globale voorkeuren (ADR 0430, `AppGlobalKey`).
- Omdat `normalizeView` de kolommen weghaalt, geeft `hydratePayload` de oude kolommen van het document eerst aan
  `stageLegacyTaskGridColumns` (`taskGridSlice.ts`), vóór de lus over de velden.
- Na de lus roept `hydratePayload` `promoteProjectCalendarToLibrary` aan, zodat een oud of vers document zonder
  bibliotheekregel voor zijn projectkalender er een krijgt (geen wijziging als de regel er al is), en daarna
  `syncProjectCalendar` om de afgeleide `calendar` gelijk te zetten. In een ontwikkelbuild controleert
  `assertMinuteModelTaskDates` daarna de taakdatums.
- `payloadFromImport` neemt uit het gelezen bestand alleen de velden van `documentDataFromImport` over, plus
  `filePath` en `isDirty: false`; selectie,
  rekenresultaat en de rest beginnen vers (`freshPayload`). `view` en `collapsedTaskIds` vult de aanroeper:
  `applyLoadedProject` (`fileSlice.ts`) neemt die van het huidige document over, met eventueel een nieuwe
  `viewStartDate`.
