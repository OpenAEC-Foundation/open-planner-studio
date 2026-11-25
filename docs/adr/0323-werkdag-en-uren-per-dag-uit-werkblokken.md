# De enkelvoudige werkdag en de uren per dag uit werkblokken

Een kalender met werkblokken heeft daarnaast een enkelvoudige werkdag (`workStartHour`, `workEndHour`) en uren per dag
(`hoursPerDay`). Bij een dag met meer blokken nemen we het begin van het eerste blok, het einde van het laatste en de
netto uren: MS Projects 08:00 tot 12:00 en 13:00 tot 17:00 is 8 tot 17 met 8 netto uren, niet 8 tot 12 (de fix van het
werkdageinde, 2026-10). Eén definitie, `workDayFromBlocks` in `src/services/subdayIo.ts`, voor de lezers en de
resourcebibliotheek, zodat ze niet uit elkaar lopen.

## Gevolgen

- `workDayFromBlocks` laat blokken met een niet-eindige grens weg, geeft een blok met een einde op of vóór het begin
  1440 erbij en sorteert op begin. Het begin is het hele uur onder het begin van het eerste blok (`Math.floor`). Het
  einde is 24 als het laatste blok na 1440 eindigt (een nachtploeg), en anders het hele uur onder zijn einde. Netto is
  de som van de blokken. `firstBlockEndHour` is het hele uur onder het einde van het eerste blok (hoogstens 1440), de
  waarde die de lezers vóór de fix namen. Zonder blokken geeft hij niets.
- `mspdiReader`, `mppCalendars` en `ifcReader` roepen hem alleen aan voor een dag met meer dan één blok; bij één blok
  houdt elke lezer zijn eigen afleiding (ADR 0253 voor MSPDI). Toets: `check-werkdag-einde.ts` §1 tot en met §3.
- `deriveHoursPerDay` is `modalBandHoursPerDay` van de motor (`CalendarEngine.ts`): de dagsom die het vaakst voorkomt
  over de weekdagen met blokken, bij gelijke aantallen de hoogste, en zonder blokken de meegegeven terugval. Reden: de
  opgeslagen uren per dag zijn dan gelijk aan wat de motor rekent. Dat ook een weekdag buiten `workDays` meetelt, staat
  in knownbug 2003.
- `hoursPerDayDiffers` vergelijkt strikt (`!==`), zonder marge; een afgeleide waarde `undefined` of `NaN` telt als
  afwijking. Dezelfde vergelijking beslist op drie plekken: of de IFC-writer `HoursPerDay` schrijft
  (`writeCalendarGenerationMeta`; `docs/ifc-round-trip.md`, "Uren per dag bij een blokkenkalender"), of het
  kalendervenster het blok over de eigen uren per dag uit het bestand toont (`showFileHoursNotice` in `CalendarForm`,
  besluit van de eigenaar van 2026-10-20, punt 8, optie 2), en of de uren per dag de blokken volgen
  (`hoursPerDayFollowsBlocks`, ADR 0324, die het geval zonder dagsom zelf afvangt).
- De resourcebibliotheek bewaart kalenders als JSON, ook kalenders die een MSPDI- of `.mpp`-lezer van vóór de fix
  importeerde, met als einde dat van het eerste blok. `withRepairedFirstBlockScalar` zet het einde op dat van het
  laatste blok, alleen als de eerste werkdag met blokken (`firstBlockedDay`) er minstens twee heeft, het begin gelijk
  is aan `startHour`, het einde gelijk aan `firstBlockEndHour` en het laatste blok later eindigt; anders blijft de
  kalender gelijk. `firstBlockScalarVariant` geeft omgekeerd de oude vorm, voor de vergelijking met een stempel uit
  een oud bestand. Gebruikers: `normalizePoolShape`, `poolCalendarById` en `calendarMatchesStamp` in
  `libraryOps.ts`. Toets: `check-werkdag-einde.ts` §5.
