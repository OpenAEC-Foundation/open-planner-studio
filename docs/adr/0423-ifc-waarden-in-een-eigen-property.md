# Een waarde in een eigen property heeft één vorm, die de lezer ongewijzigd teruggeeft

De helpers voor de waarde van een property staan in `ifcPsets.ts`, zodat de descriptors en de writer dezelfde vorm
schrijven. De contracten staan elders en gelden: tekst en JSON in *Tekst in IFC is STEP-gecodeerd* in
`.claude/rules/tauri-ifc.md` (`ifcStr`, `encodeStepText`, `asciiJson`, `ifcJson`, `OPS_APP_VERSION`, toets
`check-ifc-step-encoding.ts`), datums in "Datums in een property" in `docs/ifc-round-trip.md` (`ifcDateValue`,
`readIfcDate`, toets `check-ifc-datumvorm.ts`), en een REAL met decimale punt in "Schemageldigheid" van datzelfde
document. Hier staan de grenzen die daar niet staan.

## Gevolgen

- `ifcDateValue` typt een datum alleen als de kalenderdatum bestaat (`isCalendarDate`). Een jaar onder 100 gaat als
  `IFCTEXT`, want `Date.UTC` leest de jaren 0 tot en met 99 als 1900 tot en met 1999. Een constraintdatum
  `0099-12-31T08:00` kwam in een proef met `writeIFC` en `readIFC` ongewijzigd terug.
  `IfcDate` kent geen tijd en een `IfcDateTime` zonder seconden is een schemafout, dus elke andere vorm gaat als tekst.
- `readIfcDate` geeft bij `IFCDATETIME` de uitkomst van `importStatusDate`; elke andere waarde leest het veld zoals het
  dat altijd deed (het argument `legacy`). Volgens het weggehaalde commentaar schreef geen
  OPS-versie `IFCDATETIME` bij `ConstraintDate`, `Deadline` of een eigen veld, zodat geen oud eigen bestand daardoor
  anders leest; dat is niet tegen de releasetags nagegaan.
- `stepReal` schrijft de kortste exacte vorm (`String`) met een verplichte punt, zodat `parseFloat` hetzelfde getal
  teruggeeft (`check-ifc-real-values.ts`). Volgens het weggehaalde commentaar vond de IfcOpenShell-validatie van
  2026-10-13 zonder die punt 158 fouten in de voorbeelden. Een niet-eindig getal heeft geen STEP-vorm:
  `ifcTypedReal` geeft dan `$`, en mag daarom alleen op een OPTIONAL plek staan, zoals `NominalValue`; de lezer leest
  `$` als geen waarde (`check-ifc-real-values.ts`: een niet-eindig tarief ontbreekt na heropenen). Oudere versies
  schreven op die plek `IFCREAL(NaN)`. `parseTypedValue` in `ifcReader.ts` geeft voor een getal dat niet eindig is
  geen waarde, dus die oude vorm leest gelijk aan `$` en het veld krijgt zijn standaardwaarde: een bestand met
  `IFCREAL(NaN)` bij `OPS_Resource.MaxUnits` opent met capaciteit 1, en houdt die na opslaan en heropenen.
- `encodeStepText` schrijft een losse surrogaathelft als UTF-16-eenheid in `\X2\…\X0\`, en een geldig paar als één
  teken in `\X4\…\X0\`; beide komen ongewijzigd terug (`check-ifc-step-encoding.ts`). `asciiJson` maakt elke
  UTF-16-eenheid vanaf U+007F een JSON-escape.
