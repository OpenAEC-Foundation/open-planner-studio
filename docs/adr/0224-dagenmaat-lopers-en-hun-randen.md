# De lopers van de dagenmaat: werkdag, randen en een kalender zonder werkdag

De dagenmaat telt werkdagen: elke werkdag telt 1, hoe lang hij ook is, en binnen een dag telt het deel van de werktijd
van die dag (spec alleen uren, §0 en §3.14). `addMeasuredWorkdays`, `subtractMeasuredWorkdays`,
`measuredWorkdaysBetween` en `measuredWorkdayEnd` zijn de lopers daarvoor. Een werkdag van de dagenmaat is een
kalenderdag waarop een werkblok begint (`measureDay` op `bandsStartingOn`, ADR 0222), dus een nachtblok telt bij de dag
waarop het begint. De afronding op hele minuten en de foutgrens van heen en terug zijn technische keuze T23 van de spec
(§3.14); `check-dagenmaat-lopers.ts` toetst ze.

## Gevolgen

- Vooruit geeft een eindmoment (een blokeinde blijft staan, zoals `addWorkMinutes`), achteruit een startmoment (een
  blokbegin, zoals `subtractWorkMinutes`). Valt het deel van de laatste dag in de afronding weg, dan is het einde het
  laatste werkmoment vóór die dag (`prevWorkInstant`) en de start het volgende blokbegin na die dag.
- Zonder werkdag binnen de veiligheidsgrenzen (ADR 0220) geeft `addMeasuredWorkdaysChecked` het begin terug met
  `capped`; `subtractMeasuredWorkdays` geeft dan het einde ongewijzigd terug, zonder signaal. Vindt
  `measuredWorkdaysBetween` voor een van beide momenten geen werkdag, dan rekent het met `workMinutesBetween` gedeeld
  door `hoursPerDay` maal 60, en met 0 als `hoursPerDay` 0 is.
- Hele dagen slaan `nthMeasureWorkday` en `measureWorkdaysInRange` alleen rekenkundig over als `measureLikeWorkDays`
  waar is; anders lopen ze dag voor dag over `measureDay`. Zijn grens staat in knownbug 700.
- `MEASURE_EPS` (10⁻⁹ dag) is de marge voor rekenruis van zwevende komma in een dagteller, zoals bij het aftrekken
  van het deel van de eerste dag. Ze is kleiner dan een duizendste minuut op elke werkdag en ruim groter dan die ruis.
