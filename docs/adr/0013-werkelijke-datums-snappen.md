# Een werkelijke start snapt vooruit alleen binnen haar eigen dag

Een vastgelegde werkelijke start of finish is een feit. De solver snapt een werkelijke start vooruit naar het
volgende werkmoment, maar alleen als dat op dezelfde kalenderdag blijft; anders blijft het rauwe moment staan
(`snapActualForward`). Die dagregel geldt alleen voor deze voorwaartse snap van de werkelijke start; een werkelijke
finish volgt een eigen regel (hieronder). Een werkelijke start na het laatste werkblok van haar dag blijft daardoor
rauw staan, buiten werktijd (knownbug 1965). Dat een feit nooit naar een andere dag verschuift, is gemeten: in `mpp14resource.mpp` heeft
"Completed Task" een werkelijke start op zaterdag, en MS Project houdt zaterdag. De snap binnen de dag (07:00 wordt
08:00) heeft geen eigen corpusbewijs: de enige kandidaten in het corpus zijn handmatig geplande taken, die hier niet
komen. Een lopende en een voltooide taak gebruiken dezelfde regel, zodat dezelfde weekendstart hetzelfde antwoord
geeft.

## Gevolgen

- Onder P6 met `p6PreserveActualInstants` (A18) blijven de werkelijke datums van een taak uit een P6-project
  letterlijk staan. Een kalendertijdtaak en een nulduurmijlpaal bewaren hun werkelijke datums altijd letterlijk
  (D3/D7); een voltooide mijlpaal heeft één moment, ES = EF.
- Een werkelijke finish snapt achteruit naar het vorige werkmoment (`snapOnOrBefore`), en kan zo op een vorige
  werkdag vallen (een finish in het weekend wordt vrijdag). Alleen als de finish een tijd heeft en de snap op dezelfde
  kalenderdag blijft, blijft de ingevoerde tijd staan.
- Valt het hele vastgelegde venster in onwerkbare tijd (weekend, bouwvak), dan snapt de start voorbij de finish.
  Dan wijkt de start (ES = EF): een afgemelde taak hoort in het verleden en mag nooit voorbij haar eigen werkelijke
  finish komen, anders tilt een bouwvak een in augustus afgemelde taak en haar opvolgers een week voorbij de
  statusdatum.
- Een lopende taak pint haar vroege start op haar werkelijke start, met en zonder statusdatum. Zonder werkelijke
  start maar met voortgang telt de gewone vroege start uit de voorwaartse pass als impliciete werkelijke start.
- Komt het hervattingspunt uit het resume-veld en ligt het vóór de werkelijke start, dan klemt de finish op de
  werkelijke start. De start zakt nooit: die is een aantoonbaar feit.
