# P6 XML lezen: welke kalender een uurkalender wordt en wanneer 08:00 een anker is

De tijdregel van een bestand (`xmlTimeRule`, spec alleen-uren I8) is `opsLiteral` als het bestand een `<UDFType>` met
SubjectArea `Project`, DataType `Text` en de titel `OPS_LITERAL_CALENDARS_NAME` draagt, `opsAnchor` bij een export van
OPS zonder die definitie of met de vingerafdruk `isLegacyOpsP6Xml` (ADR 0260), en anders `foreign`. Alleen bij
`opsAnchor` beslist de kalender van de taak of een tijd telt (`xmlTaskDate`), omdat de writers van die bestanden een
datum zonder tijd als 08:00 schreven; in elk ander bestand is een tijd echt (`check-uren-f5b-adapters.ts` (5) tot en
met (12)). Dezelfde regel geldt in de MSPDI-lezer (ADR 0252).

## Gevolgen

- Een kalender wordt een uurkalender (`promoteHourCalendars`, met `preferCanonicalWhenEmpty` onwaar) als zijn blokken
  afwijken (ADR 0262) of als een activiteit op die kalender een signaal geeft (`cSignalCalIds`): een `PlannedDuration`
  boven 0 waarvoor `isSubDayMinutes` waar is, of een datumsignaal. Met een geldige lijst in de project-UDF
  `OPS_LiteralCalendars` (een `<UDF>` direct in het gekozen `<Project>`, `parseLiteralCalendars`) geeft elke
  activiteit op een kalender uit die lijst het datumsignaal; een nummer in de lijst dat niet de projectkalender of een
  gelezen bibliotheekkalender is, valt weg en de lijst blijft geldig (`literalCalIds`). Zonder geldige lijst is het
  datumsignaal een `PlannedStartDate`, `PlannedFinishDate`, `ActualStartDate` of `ActualFinishDate` waarvoor
  `xmlTimeSignal` waar is (`check-uren-f5b-adapters.ts` (10)).
- Dat ook de werkelijke datums een signaal geven, komt uit review ronde 3 van PR #559: anders bleef de kalender
  scalair, kapte de lezer bij `opsAnchor` een werkelijk einde om 11:00 af tot de datum en maakte de laadnormalisatie er
  16:00 van. In een vreemd
  bestand tellen de werkelijke datums van een activiteit met status `Not Started` niet mee (`actualDateRaw`, ADR 0266).
- Bij `opsAnchor` beslist de kalender over de tijd van een taakdatum, niet de duureenheid: `hourDates` is waar als de
  effectieve kalender van de taak een uurkalender is, zoals in de MSPDI-lezer, zodat een dagtaak op een uurkalender
  haar tijden houdt. Die keuze (`parseTaskDate`) geldt voor de geplande en werkelijke datums, de constraintdatums,
  `ExpectedFinishDate` en de vastgelegde rekenuitvoer (ADR 0268).
- `PlannedStartDate` van het project houdt zijn tijd als de projectkalender een uurkalender is (`xmlTaskDate` met
  een uurkalender), zoals de XER-lezer `PROJECT.plan_start_date` leest (issue #775): anders kreeg een startmijlpaal op
  de projectstart een andere datum dan uit de XER van hetzelfde project. Op een dagkalender is de projectstart een
  datum. `DataDate` wordt de statusdatum via `statusDateFromXml`.
