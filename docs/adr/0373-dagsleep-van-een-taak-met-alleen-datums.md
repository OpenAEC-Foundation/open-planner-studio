# De dagsleep van een taak met alleen datums

Een taak waarvan de oorspronkelijke start of finish geen tijd heeft (`dragKind` `days`, ADR 0372), sleept in hele
getoonde kolommen (`Math.round(pixels / zoom)`). Voor zo'n balk legden we drie regels vast, omdat de balk anders
na de volgende berekening anders staat dan de planner losliet.

## Gevolgen

- De duur na een randsleep is de inclusieve telling van werkdagen op de taakkalender
  (`CalendarEngine.workDaysBetween`), met minimaal 1. Zo tellen weekend en feestdagen niet mee; een exclusieve
  telling van kalenderdagen gaf één werkdag te weinig en telde zaterdag en zondag. Dezelfde inclusieve telling
  gebruikt de dagtak van `writeDerivedSpan` (`duration.ts`) voor een afgeleide duur.
- De sleep schrijft een werkdag als anker en niet de rauwe kalenderdag onder de muis: de rechterrand schrijft
  `addWorkDays(start, duur)`, de linkerrand `subtractWorkDays(einde, duur)`, met de taakkalender. Zo landt
  `earlyStart`/`earlyFinish` niet op een weekend of feestdag. Volgens het weggehaalde commentaar verschoof een
  anker op een vrije dag bij de eerstvolgende `runCPM` (ook bij het openen van het bestand); dat is niet apart
  nagespeeld.
- `handleMouseMove` slaat een beweging alleen over als het aantal kolommen niet veranderde sinds de vorige
  schrijfactie (`lastAppliedDeltaRef`, begint op 0), en niet zodra het 0 is. Een toets op 0 zou de beginduur
  onbereikbaar maken: na een beweging terug naar 0 werd niets geschreven en bleef de balk op de buurwaarde staan.
  Deze toets hoort alleen bij deze dagsleep. De uursleep en de dagenmaatsleep (ADR 0372) vergelijken hun uitkomst met
  de opgeslagen velden en schrijven ook bij nul stappen als die verschillen (knownbug 2347).
- Het aantal kolommen wordt een datum via de projectkalender, dezelfde kalender waarmee `GanttCanvas` de gedeelde
  as bouwt (`resolveGanttAxis`); de duur telt op de kalender van de taak. Onder werkdagencompressie
  (`isCompressedEffective`: de instelling staat aan en de projectkalender heeft werkdagen, net als bij de as) is een kolom een werkdag van de projectkalender
  en schuift `shiftByDisplayedColumns` (`barDragMath.ts`) met `addWorkingDaysSigned`; zonder compressie met
  `addCalendarDays`. Wat `addWorkingDaysSigned` vanaf een vrije dag doet, staat in knownbug 2005.
- De bodysleep verschuift start en finish met hetzelfde aantal kolommen en laat de duur staan. Heeft een datum
  toch een tijdsdeel, dan blijft dat staan: de sleep vervangt alleen de eerste tien tekens (de datum).
- Een nulduurmijlpaal zonder tijd loopt ook door deze bodysleep (ADR 0376).
