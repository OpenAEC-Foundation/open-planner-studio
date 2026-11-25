# P6 XML schrijven: de eigen OPS-velden

P6 XML zegt niet of een activiteit in werkdagen of in uren bedoeld is, en draagt geen maatrecord, geen eigen taaktype
en geen letterlijke kalenders. `writeP6XMLWithReport` schrijft die daarom als Text-UDF's, zodat OPS zijn eigen export
weer exact leest. Een UDF-type staat als `<UDFType>` op het hoogste niveau, de waarde als `<UDF>` met `TypeObjectId`
en `TextValue` binnen de activiteit of het project, niet als los `<UDFValue>` (`check-p6xml-writer-p6.ts` (1) en
4d). De lezer herkent ze aan titel, SubjectArea en DataType (ADR 0260).

## Gevolgen

- De vaste `ObjectId`'s: de duureenheid (`OPS_DURATION_UNIT_NAME`) 1, het eigen taaktype
  (`OPS_CUSTOM_TASK_TYPE_UDF_TITLE`) 900000001, de maatrecords `OPS_DayMeasureDurations`, `OPS_ExactMinutes` en
  `OPS_DayMeasureLags` 900000003 tot en met 900000005, `OPS_LagCalendar` 900000006 en `OPS_LiteralCalendars`
  900000007; het notitieonderwerp van de beschrijving 900000002 (ADR 0360). De eerste vier gaan over een activiteit,
  de laatste twee over het project.
- De definitie van de duureenheid, van de drie maatrecords en van `OPS_LiteralCalendars` staat in elke export, ook
  zonder waarde, omdat de lezer al uit de definitie iets afleidt: die van de duureenheid maakt het bestand een export
  van OPS (ADR 0260), die van `OPS_DayMeasureDurations` zegt dat een dag de werktijd per dag is (`workdayIsWorkTime`,
  ADR 0265), en die van `OPS_LiteralCalendars` geeft de tijdregel `opsLiteral` (ADR 0264). Het project draagt de
  lijst altijd, ook leeg. De definitie van het eigen taaktype staat er alleen als een activiteit een
  `customTaskTypeId` heeft, die van `OPS_LagCalendar` alleen als `project.schedulingOptions.lagCalendar` gezet is.
- Elke activiteit krijgt de duureenheid (`taskDurationUnit`). Een urentaak draagt haar duur- en restrecord in
  `OPS_ExactMinutes`, een andere taak in `OPS_DayMeasureDurations`, als één JSON met de sleutels `PlannedDuration` en
  `RemainingDuration` (`fieldRecordsJson`); zonder record geen UDF. De lagrecords staan op de opvolger (ADR 0363).
- De lagkalender staat twee keer in het bestand: als `OPS_LagCalendar`, alleen als het project hem zelf kiest, en als
  `RelationshipLagCalendar` in `<ScheduleOptions>`, altijd, met de effectieve optie (`p6XmlScheduleOptionFields`,
  ADR 0366). De lezer laat de UDF winnen (ADR 0265).
- De writer schrijft elke UDF-waarde helemaal, zonder lengtegrens; wat een te lange waarde in P6 kan doen, staat in
  knownbug 2338.
