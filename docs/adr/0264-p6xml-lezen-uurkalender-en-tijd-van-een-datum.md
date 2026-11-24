# P6 XML lezen: welke kalender een uurkalender wordt en wanneer 08:00 een anker is

De tijdregel van een bestand (`xmlTimeRule`, spec alleen-uren I8) is `opsLiteral` als het bestand een `<UDFType>` met
SubjectArea `Project`, DataType `Text` en de titel `OPS_LITERAL_CALENDARS_NAME` draagt; anders `opsAnchor` bij een
export van OPS of bij de vingerafdruk `isLegacyOpsP6Xml` (ADR 0260), en anders `foreign`. Alleen bij `opsAnchor`
beslist de kalender van de taak of een tijd telt (`xmlTaskDate`), omdat de writers van die bestanden een datum zonder
tijd als 08:00 schreven; in elk ander bestand is een tijd echt (`check-uren-f5b-adapters.ts` (6) tot en met (12)).
Dezelfde regel geldt in de MSPDI-lezer (ADR 0252).

## Gevolgen

- Een kalender wordt een uurkalender in twee stappen (ADR 0262): eerst door zijn blokken, daarna door een signaal van
  een activiteit op die kalender (`cSignalCalIds`, `promoteHourCalendars` met `preferCanonicalWhenEmpty` onwaar). Het
  signaal is een `PlannedDuration` boven 0 waarvoor `isSubDayMinutes` waar is, of een datumsignaal. Met een geldige
  lijst in de project-UDF `OPS_LiteralCalendars` (een `<UDF>` direct in het gekozen `<Project>`,
  `parseLiteralCalendars`) geeft elke activiteit op een kalender uit die lijst het datumsignaal; een nummer in de
  lijst dat niet de projectkalender of een gelezen bibliotheekkalender is, valt weg en de lijst blijft geldig
  (`literalCalIds`). Zonder geldige lijst is het datumsignaal een `PlannedStartDate`, `PlannedFinishDate`,
  `ActualStartDate` of `ActualFinishDate` waarvoor `xmlTimeSignal` waar is (`check-uren-f5b-adapters.ts` (10)).
- Dat ook de werkelijke datums een signaal geven, komt uit review ronde 3 van PR #559: anders bleef de kalender
  scalair, kapte de lezer bij `opsAnchor` een werkelijk einde om 11:00 af tot de datum en maakte de laadnormalisatie
  er 16:00 van. In een vreemd bestand tellen de werkelijke datums van een activiteit met status `Not Started` niet mee
  (`actualDateRaw`, ADR 0266).
- Bij `opsAnchor` beslist de kalender over de tijd van een taakdatum, niet de duureenheid: `hourDates` is waar als de
  effectieve kalender van de taak na de promotie een uurkalender is, zoals in de MSPDI-lezer, zodat een dagtaak op een
  uurkalender haar tijden houdt. Die keuze (`parseTaskDate`) geldt voor de geplande en werkelijke datums, de
  constraintdatums, `ExpectedFinishDate` en de vastgelegde rekenuitvoer (ADR 0268).
- De projectstart leest de lezer eerst als datum (`parseP6Date`) en op een uurkalender als projectkalender daarna met
  haar tijd (`xmlTaskDate`). Daarna wordt `project.startDate` het anker dat `resolveMissingScheduleDates` teruggeeft:
  het datumdeel van die projectstart, of zonder `PlannedStartDate` het datumdeel van de vroegste aanwezige taakstart,
  anders vandaag. De lezer levert de projectstart dus als datum, ook op een uurkalender (knownbug 2304); een taak
  zonder geplande start krijgt dat datumanker. `DataDate` wordt de statusdatum via `statusDateFromXml`.
