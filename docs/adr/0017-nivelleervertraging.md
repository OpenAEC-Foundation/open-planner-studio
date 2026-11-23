# De minutenvertraging wint; op een wortel telt alleen een dagenvertraging

Een taak kan een nivelleervertraging in hele werkdagen dragen (`levelingDelay`) en in minuten
(`levelingDelayMinutes`, met `levelingDelayElapsed` voor kalendertijd). *Nivellering toepassen* schrijft er
allebei (`writeLevelingResult` in `src/utils/taskDefaults.ts`: de minuten als het voorstel ze heeft, zodat de start
precies het moment is dat de nivelleerder toetste); een `.mpp`-bestand levert alleen minuten (LEVELING_DELAY).
Draagt een taak minuten, dan verschuift `shiftByLevelingDelay` met de minuten en niet met de dagen
(`check-leveling-delay-units.ts`, deel 1). Of er verschoven wordt, hangt af van het dagenveld:

- Met `levelingDelay` verschuift de vroege start altijd, ook bij een wortel, want de opgeslagen `scheduleStart`
  weet niets van de nivellering (anders blijft "B" in `lvl-basic-conflict` ongenivelleerd). Staan er ook minuten,
  dan bepalen die de afstand.
- Zonder `levelingDelay` verschuift een minutenvertraging alleen een taak met een voorganger. Voor een
  `.mpp`-wortel is `scheduleStart` al het eindantwoord van MS Project, inclusief nivellering, en nog eens toepassen
  telt dubbel (`mpp14barstyle.mpp`). Een door een voorganger bepaalde start is vers berekend en kent de vertraging
  nog niet (MS Project: haalbare start plus vertraging). Van de 19 `.mpp`-taken met `levelingDelayMinutes` in het
  corpus hebben er 14 een voorganger; de vijf zonder zijn precies `mpp14barstyle.mpp`. Een wortel met constraint
  en minutenvertraging volgt dezelfde regel (`msp-53-z6-anker-regel-wortel-met-constraint`).

## Gevolgen

- Na de verschuiving her-snapt een taak in werktijd met `snapSuccessorEarlyStart`: met een dagenveld altijd, in de
  minutentak alleen bij een vertraging in werktijd. Een vertraging die op een blokeinde eindigt (di 16:00) start zo op
  het volgende blokbegin (wo 08:00); anders gaf de blokeinde-regel voor een rauw wortelanker een taak met duur nul
  (`bg140-*` in `cases-hours-blokgrenzen.json`). Een kalendertijdtaak her-snapt niet.
- In de minutentak zonder dagenveld snapt een kalendertijdvertraging op een taak in werktijd met `snapOnOrAfter`
  naar een werkmoment (`msp-48-z6-elapsed-delay`); een kalendertijdtaak zelf blijft ongesnapt
  (`msp-51-z6-invariant-elapsed-opvolger-hele-dagen-delay`).
- De late start trekt de vertraging niet af (`subDuration`): de late finish komt los van de eigen vroege start
  binnen, en een aftrek daar zou de vertraging dubbel in de totale speling tellen. Wel verschuift de achterwaartse
  doorgifte de late datums van een vertraagde opvolger met haar vertraging terug voordat ze op de voorganger drukken
  (`shiftByLevelingDelay` met teken −1). Zonder die spiegel toont de voorganger in een keten P → A (vertraging) → S
  zoveel speling als de vertraging, terwijl ze kritiek is.
- Voor een relatie die aan het einde van een dagenmaat-opvolger bindt, kan een vertraging over de statusdatumvloer
  de taak op werkdagen van verschillende lengte leggen. De voorganger krijgt dan als relatiegrens het einde
  berekend vanaf de teruggeschoven start, op de kalender van de opvolger (#1161).
