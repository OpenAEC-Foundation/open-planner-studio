# P6 XML lezen: uitzonderingen, feestdagen en de NL-feestdagen

De writer schrijft beide soorten uitzondering als `<HolidayOrException>`, één per datum (`holidayOrExceptionsNode`,
`check-p6xml-writer-p6.ts` (3)). `parseP6HolidayOrExceptions` maakt er een feestdag van als het element geen leesbaar
`<WorkTime>`-blok heeft, of precies één blok van 00:00 tot het einde van de dag (23:59 telt als 1440 minuten, ADR
0262); met andere blokken wordt het een werkende uitzondering op die blokken. De lezer rekent één blok van 00:00 tot
23:59 als vrije dag (`check-p6xml-nested.ts` 4e); dat P6 het zo bedoelt, komt uit het weggehaalde commentaar en de
writer, en is niet tegen P6 nagegaan. De writer schrijft een werkende dag van 24 uur daarom als twee aansluitende
blokken (`splitWholeDay`), en de lezer voegt die weer samen (`check-p6xml-calendar-rules.ts` (3)).

## Gevolgen

- Een blok dat eindigt op of vóór zijn begin, loopt door tot de volgende dag. De blokken van een werkende uitzondering
  gaan op begin gesorteerd door één ronde van achter naar voren: een blok dat begint vóór of op het einde van het blok
  ervoor, gaat daarin op. Dat dekt twee aansluitende blokken, niet elke overlap: na `08:00–16:00`, `09:00–10:00` en
  `11:00–12:00` blijven `08:00–16:00` en `11:00–12:00` staan.
- `mergeConsecutiveDays` voegt dagen weer samen tot één reeks, zodat een bouwvak van drie weken geen vijftien losse
  uitzonderingen wordt, maar alleen als de volgende dag precies één kalenderdag na het einde begint, met dezelfde naam
  en dezelfde blokken (`check-p6xml-calendar-rules.ts` (4), `check-p6xml-writer-p6.ts` 6c). Zonder `<Name>` krijgt een
  uitzondering een vaste naam (`UNNAMED_HOLIDAY_NAME`, `UNNAMED_WORKING_EXCEPTION_NAME`); `<FinishDate>` geldt als
  einde als het er staat.
- `readP6Calendar` beslist de feestdagen in deze volgorde. Levert de werkweek een werkdag op, dan gaan de feestdagen
  van `createDefaultCalendar()` weg (in bouwmodus de NL-feestdagen; `check-p6xml-nested.ts` 5c), want een kalender met
  een eigen werkweek is een volledige kalender. Dan valt elke eendaagse feestdag weg die op het begin van een werkende
  uitzondering valt, zodat een datum niet in beide lijsten staat (`WorkCalendar.workingExceptions`). Blijft er daarna
  minstens één feestdag over, dan vervangen de feestdagen uit het bestand de lijst. Zo houdt alleen een kalender
  zonder werkdag in zijn werkweek, waarvan na het wegvallen geen feestdag overblijft, de feestdagen van
  `createDefaultCalendar()`.
- Een feestdag over meer dagen valt niet weg; de motor laat de werkende uitzondering dan winnen (ADR 0221). Twee
  werkende uitzonderingen op dezelfde datum blijven allebei staan (knownbug 2004).
