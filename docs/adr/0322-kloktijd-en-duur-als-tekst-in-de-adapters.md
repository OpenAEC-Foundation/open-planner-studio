# Kloktijd en duur als tekst in de adapters

De IFC-, MSPDI-, P6 XML- en XER-adapters zetten minuten om in kloktijden en duurteksten en terug. De gedeelde
omzettingen staan één keer in `src/services/subdayIo.ts`, zodat de adapters geen eigen kopie van die regels houden.
Dezelfde minuutwaarde kan verschillende tekst geven: 1440 wordt met `endOfDay` `24:00:00` en zonder `00:00:00`. Het
zijn losse functies met eigen aanroepers: welke een adapter gebruikt en wat hij eromheen doet, verschilt per formaat.
De IFC-writer bewaart een ongewijzigd begin uit de bron letterlijk, ook met seconden of fijnere precisie
(`calendarPeriodClocks` in `ifcWriter.ts`); een ongewijzigd einde alleen als het samen met het geschreven begin
dezelfde periodeduur geeft (ADR 0144), of als het blok gelijk is aan de scalaire bronperiode. De P6 XML-lezer telt
bij een blokeinde onder voorwaarden een minuut op (`p6FinishClockToMinutes` in `p6xmlReader.ts`); de XER-lezer leest
kalenderklokken met een eigen functie en weigert seconden die niet nul zijn (`parseXerClock` in `xerCalendarData.ts`,
`XER_CALENDAR_NONZERO_SECONDS`). Een kloktijd is in minuten sinds middernacht; een duur in minuten.

## Gevolgen

- `minutesToClock` schrijft `HH:MM:SS` van de minuten modulo 1440, afgerond op hele milliseconden
  (`Math.round(m * 60_000)`), met hoogstens drie decimalen in de seconden en zonder nullen aan het eind. Zo wordt 1440
  `00:00:00`, en een einde na middernacht (boven 1440) de tijd van die dag. Alleen met `endOfDay` wordt precies 1440
  `24:00:00`. Dat gebruikt de IFC-writer voor het einde van een periode (`calendarClock`), omdat een periode die op
  `00:00:00` eindigt een einde vóór haar begin heeft, en ook `calendarExceptionKey`; ADR 0144 en
  `check-ifc-calendar-identity.ts` §11 (elke `IFCTIMEPERIOD` een geldige `hh:mm:ss` met begin vóór einde, en een
  rondgang die gelijk terugkomt). De MSPDI-writer schrijft een blokeinde zonder `endOfDay`, de P6 XML-writer schrijft
  het einde min één minuut (`p6FinishClock`). `calendarClock` neemt de tekst van `minutesToClock` alleen als
  `parseIfcClock` daaruit modulo 1440 precies de minuten terugleest; anders probeert hij een nauwkeuriger tekst met de
  seconden van de minuten zelf, en pas als ook die de invoer modulo 1440 niet exact teruggeeft, weigert hij
  (`IfcCalendarTimePrecisionError`).
- `clockToMinutes` leest alleen uren en minuten aan het begin van de tekst; seconden vallen weg, een andere vorm geeft
  `null` (knownbug 1031). `scalarHourFromClock` geeft de uren van `parseIfcClock`, met minuten en seconden, en `NaN`
  als die de tekst niet leest; die leest ook de oude eigen vorm met een uurbreuk (`7.5:00:00`, ADR 0253). Gebruikers:
  `mspdiReader` en `foreign/lossCheck.ts`.
- `minutesToIsoDuration` rondt af op hele minuten en schrijft `PT{h}H{m}M0S`, met een `-` vooraan als de afgeronde
  waarde negatief is (een lead); -0,4 minuut wordt dus `PT0H0M0S`. Er staat geen dagdeel in, zodat de tekst niet
  afhangt van de uren per dag van een kalender.
  Gebruikers: `ifcWriter`, `dayMeasureIo.ts`, `foreign/durationForms.ts` en `mspdiWriter`.
- `sixDecimalHoursToMinutes` (voor `xerReader` en `p6xmlReader`) leest uren met zes decimalen. Ligt `uren × 60`
  binnen `SIX_DECIMAL_HOUR_NOISE_MINUTES` (0,00003 minuut, de grootste ruis van zes decimalen: 0,5 × 10⁻⁶ uur × 60)
  van een hele minuut, dan wordt het die hele minuut; anders blijft de breuk staan, afgerond op een miljoenste
  minuut. Reden: 40 minuten staan er als 0,666667 uur. Een echte breuk zoals 0,33 uur (19,8 minuten) blijft. Met
  die ruis werden 29 P6-cellen onexact (regel A; commit 62101d596) en sprong een late datum met de oude
  kalenderwandeling een dag terug (knownbug 385, niet meer in `knownbugs.md`; commit 04f4710ea). De
  toetsen staan in ADR 0265 (`check-uren-f5b-adapters.ts` (13) en (14)).
