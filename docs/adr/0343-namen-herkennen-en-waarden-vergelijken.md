# Namen genormaliseerd herkennen, veldwaarden letterlijk vergelijken

`src/services/library/libraryOps.ts` vergelijkt op twee manieren. De herkenning op naam (`matchByName`,
`createNameMatcher`) en de botsing van bibliotheeknamen (`resolveUniqueCompanyName`) gaan door `normalizeName`; welke
normalisatie dat is (NFC, onzichtbare tekens weg, witruimte, `toLowerCase`), staat in `docs/library.md`
(*Het afwijkingenscherm*, punt 1). De vergelijking van een projectkopie met haar poolitem (`diffFields`) en de
`syncedHash` (`hashFields`) gebruiken `normalizeName` niet: ze vergelijken per veld `diffKey` van de ruwe waarde. Een
naam die alleen in hoofdletters of witruimte verschilt, is dus een verschil voor diff en hash, terwijl de herkenning
hem als dezelfde naam ziet. Diff en hash delen `diffKey` en de veldlijsten, zodat een gelijke hash en een lege diff
over dezelfde waarden gaan. Uitzondering bij kalenders: `diffCalendarVsPool` vergelijkt de pauze- en
uitzonderingsvelden altijd, en `computeCalendarHash` neemt ze alleen mee als de kalender er een van heeft (de twee
hashvormen in `docs/library.md`, *Waarom `syncedHash` bestaat*). `calendarMatchesStamp` vergelijkt ze alleen in de
terugval voor oude stempels apart met de pool: als `computeCalendarHash` niet gelijk is aan de stempel en de hash over
de oude veldlijst wel. Een kopie zonder pauze houdt zo haar oude hash; voegt de bibliotheek een pauze toe, dan is de
kopie `behind` en wordt ze stil ververst (toets (3) van de hash-migratie in `tests/library/check-library-ops.ts`).

## Gevolgen

- `diffKey` behandelt een lijst als multiset: elk element wordt `JSON.stringify` en die teksten worden gesorteerd,
  dus de volgorde van de elementen telt niet, de volgorde van de sleutels binnen een element wel. Een andere waarde
  gaat ongewijzigd door `JSON.stringify`. `hashFields` is de JSON van de `diffKey`s in de volgorde van de veldlijst.
  Toetsen: de multisetgevallen bij `computeCalendarHash` in `tests/library/check-library-ops.ts` en A4 in
  `tests/library/check-ifc-hostile.ts`.
- `resolveUniqueCompanyName` (gebruikt door `importPoolAsNewCompany` en voor de voorvertoning in `PoolImportDialog`)
  toetst of een naam leeg is met `normalizeName` en niet met `trim()`, want `trim()` laat een naam van alleen
  onzichtbare tekens staan. Een lege naam wordt `companyLibrary.newCompany`, en zonder geladen i18next de vaste
  terugvalnaam die ook `addCompany` gebruikt (knownbug 125); `addCompany` zelf toetst met `trim()` (knownbug 2331).
  Of de naam botst met een bestaande, vergelijkt het ook met `normalizeName`. Bij een botsing komt er " (2)", " (3)"
  en verder achter, tot de naam vrij is; de naam zelf houdt de schrijfwijze uit het bestand, zonder witruimte aan de
  randen.
  Toets: het blok "resolveUniqueCompanyName" in `check-library-ops.ts`.
