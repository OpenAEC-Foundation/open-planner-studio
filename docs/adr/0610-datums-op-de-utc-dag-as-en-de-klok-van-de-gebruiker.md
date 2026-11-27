# Datums op de UTC-dag-as en de klok van de gebruiker

De motor rekent in UTC-middernachten zonder zomertijd. `parseDate` (`src/utils/dateUtils.ts`) leest daarom het
kalenderdeel van een datum zonder tijd als tekst en bouwt de dag met `Date.UTC`, in plaats van `new Date(iso)` met
lokale getters: in een tijdzone achter UTC gaf dat de dag ervoor, en schoof de hele planning een dag op. Onleesbare
invoer geeft bewust een `Invalid Date` terug; de solver vangt die af met `isNaN(getTime())`.

Waar de app de dag of het moment van de gebruiker nodig heeft, leest hij de lokale klok en schrijft die als
UTC-velden: `localTodayIso` (de statusdatum op vandaag) en `localNowOnDayAxis` (de vandaag-lijn op scherm en print).
`formatDate(new Date())` of `new Date()` zelf zou in Nederland tussen 00:00 en 02:00 nog gisteren geven.

## Gevolgen

- `formatDate` bouwt de tekst zelf in plaats van `toISOString().split('T')[0]`. Hij draait per dag per taak in de
  werkdagenreeksen van de solver en de resourcebelasting; op 5.000 taken ging `runCPM` daarmee van 677 naar 604 ms
  (uit het weggehaalde commentaar). Buiten de jaren 0 tot en met 9999, en bij een ongeldige datum, valt hij terug op
  `toISOString`, zodat de uitkomst en de `RangeError` gelijk blijven. `check-date-format.ts` toetst dat tegen
  `toISOString`.
- `isExistingYmd` beslist rekenkundig of een dag bestaat, niet via het parsen van de JS-engine. Uit het weggehaalde
  commentaar, niet nagegaan: V8 rolt `2026-02-31` stil door naar 3 maart, WebKit weigert.
