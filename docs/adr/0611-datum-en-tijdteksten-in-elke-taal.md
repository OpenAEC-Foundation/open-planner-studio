# Datum- en tijdteksten in elke taal

Datums die de app met `Intl` schrijft, staan altijd op de Gregoriaanse kalender en in Latijnse cijfers, ook als de
maand- en dagnamen vertaald zijn: `gregorianDateFormat` (`src/utils/monthLabel.ts`) en `formatLocalDateTime`
(`src/utils/displayTime.ts`) zetten `-u-ca-gregory-nu-latn` achter de taal. Zonder die toevoeging kiest `Intl` in het
Perzisch de Solar-Hijri-kalender, en zou een maandlabel naast een ondertitel met "2026" een ander jaar tonen. Een taal
die `Intl` niet ondersteunt, krijgt in `gregorianDateFormat` Engels, zodat dezelfde code overal hetzelfde label geeft;
volgens het weggehaalde commentaar (niet nagegaan) kiest `Intl` anders de systeemtaal.

AM en PM zijn vaste notatietekens, zoals de cijfers, en geen vertaalde tekst. De tijd in een datumtijd komt daarom
van `formatClock` en niet van `Intl`, zodat er overal "1:00 PM" staat. De plaatshouder van een leeg tijdveld
(`clockPlaceholder`) is een voorbeeldtijd in de gekozen notatie en geen vertaalsleutel: een patroon als `HH:MM`
verschilt per taal, een voorbeeldtijd niet. `parseClock` hangt niet van de instelling Tijdnotatie af, zodat wie
omschakelt beide vormen kan blijven typen.
