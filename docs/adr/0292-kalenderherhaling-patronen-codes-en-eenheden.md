# Kalenderherhaling: patronen, codes en eenheden

Een herhaling komt als `RecurrenceSpec` binnen: het type (DAILY, WEEKLY, MONTHLY, YEARLY), absoluut of relatief, een
begin, een einde of een aantal keren, en de velden van het patroon. `expandRecurrence` rekent haar uit tot losse
datums. We houden de codes en eenheden van MS Project zoals de lezers ze aanleveren, zodat beide lezers dezelfde
tabellen delen en niets hoeven te vertalen behalve wat hieronder staat.

## Gevolgen

- De codetabel `RECURRENCE_TYPES` heeft als index de ruwe waarde van het type in het bestand (in `.mpp` het veld op
  +72 van een uitzonderingsblok, in MSPDI `<Type>`): 1 DAILY, 2 YEARLY, 3 YEARLY, 4 MONTHLY, 5 MONTHLY, 6 WEEKLY,
  7 DAILY; index 0 is `null` (geen herhaling). `RELATIVE_MAP` is waar op 3 en 5 (relatief) en heeft lengte 6; de lezers
  nemen voor een index daarbuiten `false` en voor een type buiten de tabel `null`. Dat de tabellen en de MSPDI-codes die
  van MPXJ zijn, komt uit het weggehaalde commentaar en is niet nagegaan (zie ook ADR 0254). Dat MPXJ op een onbekend
  type vastloopt, terwijl de lezers hier `null` geven, komt ook uit dat commentaar; wat elke lezer met `null` doet,
  staat in knownbug 2320.
- Eenheden van de velden: `weeklyDayMask` heeft bit 0 voor zondag tot bit 6 voor zaterdag (`getWeeklyDates` toetst
  `1 << getUTCDay()`); `dayOfWeekValue` is 1 voor zondag tot 7 voor zaterdag (`mpxjDayValue` is `getUTCDay() + 1`);
  `monthNumber` is 1 tot en met 12; `dayNumber` is bij een absoluut patroon de dag van de maand en bij een relatief
  patroon de hoeveelste weekdag, waarbij een waarde boven 4 de laatste die weekdag van de maand betekent
  (`lastRelativeDay`).
- `frequency` en `occurrences` staan ongeklemd in de spec, zoals het bestand ze geeft, omdat een lezer op de ruwe
  waarde beslist of een herhaling een gewoon bereik wordt (`isFlattenedNonRecurring` in `mppCalendars.ts`). Pas bij
  het uitrekenen wordt een waarde onder 1 als 1 genomen: `frequency` in `expandRecurrence`, `occurrences` in
  `moreDates`. De jaarlijkse generatoren krijgen geen `frequency`.
- Einde: met een `finishDate` loopt een patroon tot en met die datum en telt `occurrences` niet; zonder `finishDate`
  bepaalt `occurrences` het aantal (`moreDates`).
- Een jaarlijkse herhaling op een vaste datum met een dag die in de maand niet bestaat (29 februari in een gewoon
  jaar), wordt de laatste dag van de maand. Valt die datum vóór het begin, dan schuift `getYearlyAbsoluteDates` haar
  een jaar op en klemt de al geklemde dag opnieuw, niet de gevraagde dag: met begin 2019-06-01 en dag 29 februari wordt
  het 28 februari 2020, niet 29 februari. Dat volgt `LocalDate.plusYears` in MPXJ volgens het weggehaalde commentaar;
  de repo toetst alleen de uitkomst (LAAG-2 en LAAG-A in `check-mpp-calendars.ts`). Die opschuiving gebeurt na de
  toets op het einde, zodat de laatste datum na het einde kan vallen (knownbug 2318).
- Een wekelijkse herhaling begint op de zondag van de week van het begin en slaat datums vóór het begin over. Een
  maandelijkse herhaling op een vaste dag begint in de maand van het begin als die dag niet vóór de begindag ligt, en
  anders een maand later.
