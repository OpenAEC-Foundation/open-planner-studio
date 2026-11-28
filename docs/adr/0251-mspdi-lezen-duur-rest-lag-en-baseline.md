# MSPDI lezen: duur, rest, lag en baseline in de maat van de schrijver

Voor duur, rest en lag volgt `readMSPDI` de spec alleen-uren (`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`
§3.3 en §3.10; T13, T15, T21). De maat van duur en rest beslist `readMeasure`, met de OPS-markering op de taak; of een
lagrecord telt, beslist `lagRecordHolds`. De lezer rekent een dag om met dezelfde maat als de schrijver van het
bestand, omdat een getal anders bij elke rondgang verandert.

## Gevolgen

- Een dag is de werktijd per dag van de taakkalender, en bij een kalendertijdtaak (`ELAPSEDTIME`) 1440 minuten
  (`dayMeasureMinutesPerDay`), als de projectkop `OPS_DayMeasureDurations` definieert (`workdayIsWorkTime`), en anders
  de opgeslagen uren per dag, zoals OPS tot en met F5a-1 schreef. `check-uren-f5a2-adapters.ts` (8) leest een bestand
  zonder die definitie met de opgeslagen 8 uur. Dezelfde dag (`dayMinutesPerDay`) geldt voor de baselineduur van een
  taak die geen urentaak is. `workdayIsWorkTime` geldt ook voor het werk van een toewijzing dat uit een duur in dagen
  wordt afgeleid: dat rekent met de werktijd van de taakkalender, ook bij een kalendertijdtaak (ADR 0257).
- Een lagrecord uit `OPS_DayMeasureLags` telt alleen met twee elementen (een record met een eenheid hoort bij P6 XML,
  spec §3.3), alleen bij een werktijdformaat en alleen als zijn sleutel (`lagRecordKey`) één keer voorkomt bij die
  opvolger, omdat twee relaties met dezelfde voorganger en hetzelfde type het record dubbelzinnig maken. Daarna moeten
  de minuten opnieuw kloppen met de lagkalender van de lezer: die uit `OPS_LagCalendar` op de projectsamenvattingstaak,
  anders de standaard (`lagRecordHolds`; `check-uren-f5a2-adapters.ts` (5)).
- De lezer rondt een lag niet af: `LinkLag` staat in tienden van een minuut (review #591 r2).
  `check-uren-f5b-adapters.ts` (13) toetst een lag van 150,5 minuten heen en terug door MSPDI. `LagFormat` 8 wordt
  kalenderdagen, 4, 6, 10 en 12 kalenderminuten, 19 en 20 een procentlag en elk ander formaat werktijd, zonder
  afronding op hele dagen (spec §1.3, I1 en I2). `check-xml-adapter-fidelity.ts` #4 leest LagFormat 6 terug als 180
  kalenderminuten, `check-uren-f5a-adapters.ts` een procentlag als -12,5 %.
- Een onbekend relatietype wordt FS (`mspTypeToSequenceType`, ook gebruikt door de `.mpp`-lezer). MPXJ heeft dezelfde
  codes en dezelfde terugval (`RelationType.getInstance`).
- Met de taakmarkering `days` geeft de lezer een duur of rest van de vorm `PnD` als n dagen door (`wholeDays`);
  `readMeasure` neemt die dagen alleen als geen dagrecord voorgaat en het in de dagenmaat blijft. Hoe
  `mspDurationMinutes` een dagcomponent vóór de `T` telt, staat in knownbug 2010.
- De baselineduur rekent met dezelfde dag als de taakduur (`mspdiBaselineDays`). `check-dag-is-werktijd.ts` §8b leest
  `PT1870H0M0S` op een kalender met 8 uur per dag en blokken van 10 uur als 187 dagen. De baselinedatums lezen met
  dezelfde tijdregel als de taakdatums (`parseTaskDate`), zodat een urentaak haar tijd houdt zoals `saveBaseline` die
  vastlegt (PR #392; `check-mspdi-hour-baseline.ts` 1b). Een baseline zonder leesbare start of einde krijgt geen regel:
  `BaselineTask` eist beide datums, en vandaag invullen zou een afwijking tonen die het bestand niet heeft
  (`check-mspdi-hour-baseline.ts` (5)).
