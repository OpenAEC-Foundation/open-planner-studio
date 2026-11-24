# MSPDI lezen: uitzonderingen, basiskalenders en de NL-feestdagen

De lezer zet de `<Exception>`-elementen van een kalender om naar `RawException[]` (`readRawMspdiExceptions`) en laat
de datums uitrekenen door dezelfde `buildContributions` en `resolveContributions` als de `.mpp`-lezer
(`src/services/calendarRecurrence.ts`), onder één `HolidayBudget` voor alle kalenders van het bestand. Zelf eerst de
datums uitschrijven omzeilt dat budget: een XML van 445 KB kostte zo 5 s en 478 MB (meting uit het weggehaalde
commentaar). Eén budget voor het hele bestand, omdat elke kalender binnen `MAX_CALENDAR_EXCEPTIONS` kan blijven en
alle kalenders samen toch onbegrensd veel datums kunnen vragen; overerving telt mee (`check-mspdi-feestdagen.ts` 12).

Een kalender houdt de NL-feestdagen van `createDefaultCalendar()` alleen als hij kaal is: geen basis genoemd
(`<BaseCalendarUID>` -1 of ontbrekend), geen eigen werkweek en geen uitzonderingen (`applyCalendarBody`). Vroeger
kreeg elke kalender zonder `<Exception>` de NL-feestdagen, en rekende een Amerikaans bestand met Koningsdag als vrije
dag (1 tot en met 4). Een kalender die een basis noemt die niet in het bestand staat, of waarvan de keten in een
cyclus eindigt of langer is dan `MAX_BASE_CHAIN_DEPTH`, erft niets en krijgt ook de NL-feestdagen niet, zoals bij de
`.mpp`-lezer (besluit orkestrator 2026-10-13, review #335; 15, 18 en 19).

## Gevolgen

- Een basis-UID die niet naar een `<Calendar>` van het bestand wijst, maakt de kalender een wortel met zijn eigen week
  en uitzonderingen (`chainOk`); 18 toetst de vormen met `0` en met `-1`. Dat Project 2013 en later `0` schrijven en
  dat MPXJ een onbekende basis ook als geen ouder leest, komt uit het weggehaalde commentaar en is niet nagegaan.
- Of een kalender erft, hangt alleen af van de structuur: `chainOk` meet eerst de keten, en `resolve` volgt alleen een
  gemeten keten, dus de documentvolgorde telt niet (16).
- Of een kalender eigen uitzonderingen heeft, telt op het aantal ruwe records, niet op de opgeloste feestdagen: een
  kalender met alleen werkende uitzonderingen heeft er nul.
- De projectkalender is de kalender van `<CalendarUID>` direct onder `<Project>`, anders het eerste `<Calendar>`; alle
  andere, ook UID 1, worden bibliotheekkalenders, zoals bij `.mpp` (9 en 14). `calUidToId` kent alleen de
  bibliotheekkalenders, dus een taak of resource die naar de projectkalender wijst, krijgt geen `calendarId`.
- `MAX_MSPDI_CALENDARS` (1024, dezelfde grens als `MAX_CALENDARS` van `.mpp`) begrenst het aantal
  bibliotheekkalenders, in documentvolgorde. Zonder grens kon een klein tekstbestand duizenden volledige kalenders in
  de state, de undo en elke opslag zetten; het corpus heeft 9 tot 13 kalenders per bestand (meting uit het
  weggehaalde commentaar). `check-adapters-hours.ts` toetst 1200 kalenders. Een taak of resource die naar een
  kalender boven de grens wijst, staat niet in `calUidToId` en krijgt geen `calendarId`.
- `readMspdiRecurringData` vertaalt `<Type>`, `<Period>`, `<DaysOfWeek>`, `<MonthItem>`, `<MonthPosition>`,
  `<MonthDay>` en `<Month>` naar een `RecurrenceSpec`, met de codetabellen `RECURRENCE_TYPES` en `RELATIVE_MAP` van
  de `.mpp`-kant. Dat dit `MSPDIReader.readRecurringData` van MPXJ volgt, komt uit het weggehaalde commentaar en is
  niet in de repo nagegaan; alleen een jaarlijkse uitzondering op een vaste datum is getoetst
  (`check-adapters-hours.ts`, T4). Een dagelijkse herhaling met `<Period>` 1 geeft `null` en wordt zo een gewoon
  bereik van `FromDate` tot `ToDate`; zonder `ToDate` slaat `readRawMspdiExceptions` haar over.
- Een `<Exception>` zonder `FromDate` slaat `readRawMspdiExceptions` over. Een werkende uitzondering zonder
  `<WorkingTimes>` blijft werkend (`periodCount` is minstens 1); welke blokken ze dan krijgt, staat bij
  `WorkingException` in `types/calendar.ts` en in ADR 0221. Dat MPXJ een record zonder beide datums ook overslaat,
  komt uit het weggehaalde commentaar en is niet nagegaan.
- De oude vorm van Project 2003 en eerder (`<WeekDay>` met `DayType` 0 en een `<TimePeriod>`, `readLegacyDayExceptions`)
  leest de lezer alleen als `<Exceptions>` geen enkele uitzondering oplevert (13).
