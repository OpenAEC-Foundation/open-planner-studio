# Kloktijd en duur als tekst in de adapters

De IFC-, MSPDI-, P6 XML- en XER-adapters zetten minuten om in kloktijden en duurteksten en terug. Die omzettingen
staan één keer in `src/services/subdayIo.ts`, zodat elke schrijver dezelfde tekst maakt en elke lezer dezelfde
waarde leest. Een kloktijd is in minuten sinds middernacht; een duur in minuten.

## Gevolgen

- `minutesToClock` schrijft `HH:MM:SS` van de minuten modulo 1440, afgerond op hele milliseconden
  (`Math.round(m * 60_000)`), met hoogstens drie decimalen in de seconden en zonder nullen aan het eind. Zo wordt 1440
  `00:00:00`, en een einde na middernacht (boven 1440) de tijd van die dag. Alleen met `endOfDay` wordt precies 1440
  `24:00:00`. Dat gebruiken de IFC-writer voor het einde van een periode (`calendarClock`) en `calendarExceptionKey`,
  omdat een periode die op `00:00:00` eindigt een einde vóór haar begin heeft; ADR 0144 en
  `check-ifc-calendar-identity.ts` §11 (elke `IFCTIMEPERIOD` een geldige `hh:mm:ss` met begin vóór einde, en een
  rondgang die gelijk terugkomt). De MSPDI-writer schrijft een blokeinde zonder `endOfDay`, de P6 XML-writer schrijft
  het einde min één minuut (`p6FinishClock`). Een tijd die fijner is dan een milliseconde, toetst `calendarClock`
  apart (`IfcCalendarTimePrecisionError`).
- `clockToMinutes` leest alleen uren en minuten aan het begin van de tekst; seconden vallen weg, een andere vorm geeft
  `null` (knownbug 1031). `scalarHourFromClock` geeft de uren van `parseIfcClock`, met minuten en seconden, en `NaN`
  als die de tekst niet leest; die leest ook de oude eigen vorm met een uurbreuk (`7.5:00:00`, ADR 0253). Gebruikers:
  `mspdiReader` en `foreign/lossCheck.ts`.
- `minutesToIsoDuration` rondt af op hele minuten en schrijft `PT{h}H{m}M0S`, met een `-` vooraan bij een negatieve
  waarde (een lead). Er staat geen dagdeel in, zodat de tekst niet afhangt van de uren per dag van een kalender.
  Gebruikers: `ifcWriter`, `dayMeasureIo.ts`, `foreign/durationForms.ts` en `mspdiWriter`.
- `sixDecimalHoursToMinutes` (voor `xerReader` en `p6xmlReader`) leest uren met zes decimalen. Ligt `uren × 60`
  binnen `SIX_DECIMAL_HOUR_NOISE_MINUTES` (0,00003 minuut, de grootste ruis van zes decimalen: 0,5 × 10⁻⁶ uur × 60)
  van een hele minuut, dan wordt het die hele minuut; anders blijft de breuk staan, afgerond op een miljoenste
  minuut. Reden: 40 minuten staan er als 0,666667 uur. Een echte breuk zoals 0,33 uur (19,8 minuten) blijft. Dat
  met die ruis 29 P6-cellen onexact werden (regel A) en een late datum met de oude kalenderwandeling een dag terug
  sprong (knownbug 385, niet meer in `knownbugs.md`), komt uit het weggehaalde commentaar en is niet nagegaan. De
  toetsen staan in ADR 0265 (`check-uren-f5b-adapters.ts` (13) en (14)).
