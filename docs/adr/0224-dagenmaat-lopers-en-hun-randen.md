# De lopers van de dagenmaat: werkdag, randen en een kalender zonder werkdag

De dagenmaat telt werkdagen: elke werkdag telt 1, hoe lang hij ook is, en binnen een dag telt het deel van de werktijd
van die dag (spec alleen uren, §0 en §3.14). `addMeasuredWorkdays`, `subtractMeasuredWorkdays`,
`measuredWorkdaysBetween` en `measuredWorkdayEnd` zijn de lopers daarvoor. Een werkdag van de dagenmaat is een
kalenderdag met werkminuten in de blokken die op die dag beginnen (`measureDay` op `bandsStartingOn`, met de
afsnijding van ADR 0222), dus een nachtblok telt bij de dag waarop het begint. De afronding op hele minuten en de
foutgrens van heen en terug zijn technische keuze T23 van de spec (§3.14); `check-dagenmaat-lopers.ts`, deel C, toetst
die grens.

## Gevolgen

- Vooruit geeft een eindmoment (een blokeinde blijft staan, zoals `addWorkMinutes`), achteruit een startmoment (een
  blokbegin, zoals `subtractWorkMinutes`), behalve in het eerste geval hieronder.
- Past de stap in wat van de begindag rest (vooruit) of in het gedane deel van de einddag (achteruit), met
  `MEASURE_EPS` als marge, en rondt hij af op nul minuten, dan komt de invoer ongewijzigd terug, ook buiten werktijd:
  in een proef gaven +0,001 d en −0,001 d vanaf zo 08:00 op een ma-vr-kalender van 8 uur allebei zo 08:00. Komt de
  stap op een andere werkdag uit en valt het deel van die dag in de afronding weg, dan is het einde het laatste
  blokeinde vóór die dag (`prevWorkInstant`) en de start het volgende blokbegin na die dag.
- Zonder werkdag binnen de veiligheidsgrenzen (ADR 0220) geeft `addMeasuredWorkdaysChecked` het begin terug met
  `capped`; `subtractMeasuredWorkdays` geeft dan het einde ongewijzigd terug, zonder signaal. Vindt
  `measuredWorkdaysBetween` voor een van beide momenten geen werkdag, dan geeft het
  `workMinutesBetween(a, b) / (hoursPerDay * 60)`, en 0 als `hoursPerDay` niet groter is dan 0.
- Hele dagen slaan `nthMeasureWorkday` en `measureWorkdaysInRange` alleen rekenkundig over (ADR 0220) als
  `measureLikeWorkDays` waar is; anders lopen ze dag voor dag over `measureDay`. `measureLikeWorkDays` is waar als de
  weekblokken na de afsnijding van de vorige nacht precies de weekdagen van `workDays` werkend maken, en als rond elke
  werkende uitzondering (de dag zelf en de dag erna) de dagenmaat en `isWorkDay` dezelfde dag werkend noemen; de
  engine bepaalt dat één keer. Zijn grens staat in knownbug 700.
- `MEASURE_EPS` (10⁻⁹ dag) is de marge voor rekenruis van zwevende komma in een dagteller, zoals bij het aftrekken van
  het deel van de eerste dag. Ze is kleiner dan een duizendste minuut op elke werkdag en ruim groter dan die ruis.
