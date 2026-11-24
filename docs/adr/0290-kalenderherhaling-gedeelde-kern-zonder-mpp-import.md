# Kalenderherhaling: één gedeelde kern zonder import uit de mpp-laag

`src/services/calendarRecurrence.ts` rekent de uitzonderingen van een kalender om naar losse feestdagen en werkende
uitzonderingen: het rekent herhalingen uit (`expandRecurrence`), bepaalt per datum welke uitzondering wint
(`buildContributions`, `resolveContributions`, `mergeInherited`) en draagt de gedeelde grenzen (ADR 0293). De
`.mpp`-lezer (`mppCalendars.ts`) en de MSPDI-lezer (`mspdiReader.ts`) bouwen elk hun eigen `RawException[]` uit hun
eigen bestandsvorm en geven die aan deze kern; de P6 XML-lezer gebruikt alleen de twee vaste namen
(`UNNAMED_HOLIDAY_NAME`, `UNNAMED_WORKING_EXCEPTION_NAME`, ADR 0291). We kozen één kern, zodat beide MS
Project-lezers dezelfde datums en dezelfde voorrang opleveren.

Het bestand importeert alleen `@/utils/dateUtils` en niets uit `src/services/mpp/`. `mspdiReader.ts` wordt statisch
geïmporteerd door `formatRegistry.ts`, en een statische import uit de mpp-laag zou de MPP-parser in de hoofdbundel
trekken; `vite.config.ts` zet `src/services/mpp/` wel in een eigen chunk, maar Rollup volgt een statische import
toch. `check-mpp-chunk-boundary.ts` weigert elke regel onder `src/` met `@/services/mpp` buiten de dynamische import
in `formatRegistry.ts`. `mppCalendars.ts` exporteert de namen van de kern opnieuw voor bestaande aanroepers; nieuwe
code importeert ze uit `calendarRecurrence.ts`.

## Gevolgen

- Datums zijn `Date`'s op UTC-middernacht, dezelfde vorm als `parseDate`, `formatDate` en `addCalendarDays` in
  `dateUtils.ts`; de generatoren rekenen met `Date.UTC` en `getUTC…`. De uitvoer bevat ISO-datums (`formatDate`).
- De kern is een poort van drie onderdelen van MPXJ: het veldenmodel van een herhaling (`RecurrenceSpec`, naar
  `AbstractCalendarAndExceptionFactory.readRecurringData`; het lezen van de bytes zelf blijft in `mppCalendars.ts`), de
  datumgeneratoren (naar `RecurringData.populateDates()`/`getDates()`) en de voorrangsvolgorde (naar
  `ProjectCalendar.populateExpandedExceptions()`/`ORDERED_RECURRENCE_TYPES`). Die herkomst komt uit het weggehaalde
  commentaar en is niet tegen MPXJ nagegaan. Waar de kern bewust afwijkt, staat in ADR 0291 en 0292.
