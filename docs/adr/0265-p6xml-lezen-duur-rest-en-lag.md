# P6 XML lezen: duur, rest en lag in de maat van de schrijver

De lezer neemt `PlannedDuration`, `RemainingDuration` en `Lag` als uren (`× 60` naar minuten), en een activiteit zegt
in P6 XML niet of ze in werkdagen of in uren bedoeld is. De lezer volgt de spec alleen-uren
(`docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.3 en §3.10; T13, T15, T21): zonder geldige
OPS-duureenheid op de activiteit (ADR 0260) is de taak in de urenmaat, ook in een bestand van OPS. De maat van duur en
rest beslist `readMeasure`, of een lagrecord telt beslist `lagRecordHolds`. De lezer rekent een dag om met dezelfde
maat als de schrijver, omdat een getal anders bij elke rondgang verandert.

## Gevolgen

- Volgorde bij een taak in de dagenmaat (`readMeasure`): past een duur- of restrecord niet bij de huidige daglengte,
  of draagt het standaardveld niet meer de minuten van het duurrecord, dan geeft de lezer duur én rest in de urenmaat,
  met de minuten uit het bestand. Anders geeft een duurrecord zijn dagen, en zonder duurrecord blijft de taak in de
  dagenmaat met de minuten gedeeld door de minuten per dag. Een taak in de urenmaat krijgt de minuten op de hele
  minuut, of de exacte minuten van een `OPS_ExactMinutes`-record dat nog klopt. Een dagrecord telt alleen bij een taak
  in de dagenmaat, een `OPS_ExactMinutes`-record alleen bij een taak in de urenmaat.
- Een dag is de werktijd per dag van de effectieve kalender van de taak (`dayMeasureMinutesPerDay` met `elapsed`
  onwaar, ook voor een taak in kalendertijd), als het bestand een definitie `OPS_DayMeasureDurations` draagt
  (`workdayIsWorkTime`); anders de `hoursPerDay` van die kalender, zoals OPS tot en met F5a-1 schreef. Zijn dat 0
  uren, dan telt een dag 8 uur. `check-uren-f5b-adapters.ts` (4) toetst dat de minuten één keer gedeeld worden.
- Een activiteit is werktijd, tenzij een geldig OPS-record kalendertijd zegt (`measure.durationType`); de lezer geeft
  zonder zo'n record nooit kalendertijd.
- De lagkalender, in deze volgorde: een geldige waarde in de project-UDF `OPS_LagCalendar` (`parseLagCalendarOption`)
  wint. Zonder geldige waarde geldt de keuze van `deriveP6XmlScheduleOptions` (ADR 0267): met een `<ScheduleOptions>`
  waarvan `RelationshipLagCalendar` leeg of onbekend is de opvolger, zonder `<ScheduleOptions>` de standaard van het
  profiel, de voorganger (`deriveXerScheduleOptions`, eigenaar 2026-10-29).
- `Lag` is een lengte in uren; de eenheid van de opvolger verandert die lengte niet (spec I5). Een lagrecord uit
  `OPS_DayMeasureLags` (één UDF op de opvolger, met als sleutel het `ObjectId` van de voorganger en het relatietype,
  `lagRecordKey`) telt alleen als die sleutel bij die opvolger één keer voorkomt, omdat twee relaties met dezelfde
  voorganger en hetzelfde type het record dubbelzinnig maken. Daarna toetst `lagRecordHolds` de minuten: het
  standaardveld moet de geschreven minuten dragen en de dagen van het record moeten met de daglengte van de
  lagkalender van de lezer weer die minuten geven (review #585 r1, punt 1). Een andere lagkalender met dezelfde
  daglengte laat het record dus gelden. Een geldig record geeft de dagenmaat terug, of de kalendertijd, die P6 per
  relatie niet kent (`lagFromRecord`).
- Zonder geldig record wordt de lag `sixDecimalHoursToMinutes`: ruis van zes decimalen wordt de hele minuut (0,666667
  uur is 40 minuten) en een echte breuk blijft (150,5 minuten), zoals in de XER-lezer (`check-uren-f5b-adapters.ts`
  (13) en (14), review #591).
- Een onbekend relatietype wordt FS. `SEQUENCE_TYPE_BY_P6` kent het label van P6 (`Finish to Start`) en het XER-token
  dat oudere eigen exports schreven (`PR_FS`).
- Een FS zonder lag krijgt de P6-grensvlag `p6StartAtPredecessorFinishBoundary`, zoals de XER-lezer hem zet, als de
  geplande start van de opvolger gelijk is aan het geplande einde van de voorganger, de kalender van de voorganger een
  uurkalender is en dat einde op het einde van een werkblok van die dag valt.
