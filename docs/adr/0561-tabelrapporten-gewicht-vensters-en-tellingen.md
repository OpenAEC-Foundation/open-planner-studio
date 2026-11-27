# Tabelrapporten: gewicht van de voortgang, vensters in het verleden en wat meetelt

De gewogen voortgang van het voortgangsrapport (`computeProgressReport` in `src/engine/reports/progressReport.ts`)
weegt elke taak met haar huidige duur in werkdagen (`durationDays`), ook als er een baseline is. Alleen de geplande
fractie meet op de baselinedatums. `BaselineTask.duration` is `scheduleDuration`, en dat is voor een urentaak geen
duur in werkdagen: die taak zou dan veel te zwaar wegen.

Een venster dat helemaal vóór de referentiedag ligt, is een terugblik. Look-ahead (`computeLookAhead`) en
resourcetoewijzingen (`computeResourceAssignments`) nemen dan geen achterstallig werk mee, en het voortgangsrapport
spiegelt zo'n aangepaste of projectperiode niet naar voren: *Start in de komende periode* blijft leeg. Alleen een
*Afgelopen*-preset wordt gespiegeld.

## Gevolgen

- Resourcetoewijzingen telt ook hammocks, net als `computeHistogramReport`, zodat een overbelaste week uit de
  resourcebelasting hier terug te vinden is.
- `computeResourceGanttRows` (`resourceGantt.ts`) koppelt contouren op de volledige recordlijst van een taak, ook
  records naar een onbekende resource, zoals `contourLookup` en het eigenschappenpaneel (ADR 0311). Met een
  gefilterde lijst kan de terugval voor één toewijzing in `matchContoursToAssignments` anders uitvallen.
- De WBS-samenvatting (`wbsSummary.ts`) neemt de duur van een verzameltaak uit de rollup (`scheduleDuration`), die
  dagdelen al meet. Een eigen inclusieve dagtelling maakt van een halve dag een hele.
- De planningsgezondheid (`scheduleHealth.ts`) meldt geen solverfouten die het waarschuwingenpaneel al geeft
  (cyclus, afgekapte leads, hammocks); ze gaat over de kwaliteit van een planning die rekent. Geschonden constraints
  en gemiste deadlines staan er wel in, want die verklaren negatieve speling.
