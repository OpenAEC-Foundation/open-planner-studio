# MSPDI lezen: uitzonderingen, basiskalenders en de NL-feestdagen

De lezer zet de uitzonderingen van een kalender om naar ruwe records (`readRawMspdiExceptions`, `RawException[]`) en
laat de datums uitrekenen door dezelfde `buildContributions` en `resolveContributions` als de `.mpp`-lezer
(`src/services/calendarRecurrence.ts`), onder één `HolidayBudget` voor alle kalenders van het bestand. Zelf eerst de
datums uitschrijven omzeilt dat budget, dat al tijdens de opbouw klemt; zonder die klem kostte een XML van 445 KB 5192
ms en 478 MB (de reproductie bij toets (f) in `check-adapters-hours.ts`). Eén budget voor het hele bestand, omdat elke
kalender binnen `MAX_CALENDAR_EXCEPTIONS` kan blijven en alle kalenders samen toch onbegrensd veel datums kunnen
vragen; overerving telt mee (`check-mspdi-feestdagen.ts` 12).

Een kalender houdt de NL-feestdagen van `createDefaultCalendar()` alleen als hij kaal is: geen basis genoemd
(`<BaseCalendarUID>` -1 of ontbrekend), geen eigen werkweek en geen ruwe uitzonderingsrecords (`applyCalendarBody`).
Vroeger kreeg elke kalender zonder `<Exception>` de NL-feestdagen, en rekende een Amerikaans bestand met Koningsdag als
vrije dag (1 tot en met 4). Een kalender die een basis noemt die niet in het bestand staat, of waarvan de keten in een
cyclus eindigt of langer is dan `MAX_BASE_CHAIN_DEPTH`, erft niets en krijgt ook de NL-feestdagen niet, zoals bij de
`.mpp`-lezer (besluit orkestrator 2026-10-13, review #335; 15, 18 en 19).

## Gevolgen

- De keuze hangt aan het aantal ruwe records, niet aan het aantal feestdagen: één record met `DayWorking` 1 is een
  werkende uitzondering zonder feestdag, en die kalender is dus niet kaal.
- Een record met `DayWorking` 1 en zonder `<WorkingTimes>` blijft een werkende uitzondering (`periodCount` is minstens
  1). Een record zonder `FromDate`, of zonder `ToDate` en zonder herhaling, levert geen bereik en valt weg. In de oude
  vorm van Project 2003 en eerder (`<WeekDay>` met `DayType` 0, `readLegacyDayExceptions`) is een dag werkend als hij
  leesbare blokken heeft en anders vrij; die vorm leest de lezer alleen als `<Exceptions>` niets oplevert (13). Dat dit
  MPXJ volgt, komt uit het weggehaalde commentaar en is niet nagegaan.
- Een basis-UID die niet naar een `<Calendar>` van het bestand wijst, maakt de kalender een wortel met zijn eigen week
  en uitzonderingen (`chainOk`); 18 toetst de vormen met `0` en met `-1`. Dat Project 2013 en later `0` schrijven en
  dat MPXJ een onbekende basis ook als geen ouder leest, komt uit het weggehaalde commentaar en is niet nagegaan.
- Of een kalender erft, hangt alleen af van de structuur: `chainOk` meet eerst de keten, en `resolve` volgt alleen een
  gemeten keten (16: de documentvolgorde telt niet).
- De projectkalender is de kalender van `<CalendarUID>` direct onder `<Project>`, anders het eerste `<Calendar>`; alle
  andere, ook UID 1, worden bibliotheekkalenders, zoals bij `.mpp` (9 en 14).
- `MAX_MSPDI_CALENDARS` (1024, dezelfde grens als `MAX_CALENDARS` van `.mpp`) begrenst het aantal bibliotheekkalenders,
  in documentvolgorde, omdat een klein tekstbestand anders duizenden volledige kalenders in de state, de undo en elke
  opslag kan zetten (`check-adapters-hours.ts` met 1200 kalenders). Een taak of resource die naar een kalender boven de
  grens wijst, krijgt geen `calendarId`.
- `readMspdiRecurringData` gebruikt de codetabellen `RECURRENCE_TYPES` en `RELATIVE_MAP` van de `.mpp`-kant; een
  dagelijkse herhaling met `<Period>` 1 geeft `null` en wordt zo een gewoon bereik. Dat die vertaling
  `MSPDIReader.readRecurringData` van MPXJ volgt, komt uit het weggehaalde commentaar en is niet in de repo nagegaan.
  `check-adapters-hours.ts` toetst een jaarlijkse uitzondering op een vaste datum (T4) en wekelijkse uitzonderingen
  onder het budget (f).
