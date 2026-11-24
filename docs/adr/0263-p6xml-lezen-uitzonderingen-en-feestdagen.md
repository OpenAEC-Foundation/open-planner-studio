# P6 XML lezen: uitzonderingen, feestdagen en de NL-feestdagen

P6 XML kent één element voor beide soorten uitzondering, `<HolidayOrException>`, één per datum
(`holidayOrExceptionsNode` in de writer, `check-p6xml-writer-p6.ts` (3)). `parseP6HolidayOrExceptions` maakt er een
feestdag van als het element geen leesbaar `<WorkTime>`-blok heeft, of precies één blok van 00:00 tot het einde van de
dag (23:59 telt als 1440 minuten, ADR 0262), omdat P6 zo'n blok als vrije dag leest (`check-p6xml-nested.ts` 4e toetst
de lezing; dat P6 het zo leest, komt uit het weggehaalde commentaar en de writer, en is niet tegen P6 nagegaan). De
writer schrijft een werkende dag van 24 uur daarom als twee blokken (`splitWholeDay`), en de lezer voegt blokken die
overlappen of op elkaar aansluiten weer samen (`check-p6xml-calendar-rules.ts` (3)). Met andere blokken wordt het een
werkende uitzondering op precies die blokken. Een blok dat eindigt op of vóór zijn begin loopt door tot de volgende
dag.

## Gevolgen

- `mergeConsecutiveDays` voegt dagen weer samen tot één reeks, zodat een bouwvak van drie weken geen vijftien losse
  uitzonderingen wordt, maar alleen als de volgende dag precies één kalenderdag na het einde begint, met dezelfde naam
  en dezelfde blokken (`check-p6xml-calendar-rules.ts` (4), `check-p6xml-writer-p6.ts` 6c). Zonder `<Name>` krijgt een
  uitzondering een vaste naam (`UNNAMED_HOLIDAY_NAME`, `UNNAMED_WORKING_EXCEPTION_NAME`); `<FinishDate>` geldt als
  einde als het er staat.
- Een kalender met een eigen werkweek is een volledige kalender: zonder uitzonderingen heeft hij geen feestdagen. De
  NL-feestdagen van `createDefaultCalendar()` blijven alleen staan op een kalender waarvan de werkweek in het bestand
  geen werkdag oplevert en die zelf geen feestdag draagt (`readP6Calendar`, `check-p6xml-nested.ts` 5c). Een werkende
  uitzondering laat ze staan.
- Staat een eendaagse feestdag op dezelfde datum als het begin van een werkende uitzondering, dan valt de feestdag
  weg, zodat een datum niet in beide lijsten staat (`WorkCalendar.workingExceptions`). Een feestdag over meer dagen
  valt niet weg; de motor laat de werkende uitzondering dan winnen (ADR 0221). Twee werkende uitzonderingen op
  dezelfde datum blijven allebei staan (knownbug 2004).
