# Voortgang in de rastertransactie

Voortgang komt in het raster binnen als celwrite met de route `task-progress`. De invoerregels uit ADR 0154
(statusdatum op vandaag, de vraag naar een werkelijke start) gelden in de rastertransactie alleen met
`GridMutationOptions.progressEntry`. `FullTaskGrid` geeft die mee (`progressEntryOptions`, met de datum van vandaag);
headless aanroepers niet, en die houden alleen het vangnet zonder deze regels. Zo staat de regel voor voortgang op één
plek, `engine/progressEntry.ts`, en gebruikt het raster dezelfde toets als paneel en voortgangsblad
(`actualStartQuestionFor`).

## Gevolgen

- Heeft het project geen statusdatum, dan plant de transactie de voortgangscellen met vandaag als statusdatum. De
  kopie krijgt die datum (`project.statusDate`, met `modifiedAt`) pas als een taak met een voortgangswrite daarna
  veranderd is en voortgang heeft (`hasRecordedProgress`); dat gebeurt in dezelfde undo-stap, met de melding
  `statusDateSetToday` na het vastleggen. Houdt geen taak voortgang over (0 %, datums gewist), dan blijft het project
  zoals het was. `check-progress-entry.ts` (2a) toetst dat 0 % in het raster geen statusdatum, geen melding en geen
  undo-stap geeft.
- Zou een voortgangswrite de werkelijke start afleiden uit een geplande start na de statusdatum, dan geeft
  `progressStartQuestion` per taak de fout `actualStartRequired` met als waarde `{ statusDate, latest }`, en weigert
  de hele transactie. `askActualStartAndRetry` in `FullTaskGrid` stelt dan de vraag en voert dezelfde intents opnieuw
  uit met per taak een write in `task.time.actualStart`. `check-progress-entry.ts` (#998) toetst in beide volgordes
  van de plakactie dat het raster die fout geeft en niets schrijft, en dat het met een expliciete start beide
  percentages toepast.
- De geplande datums waaruit een voortgangscel afleidt, komen uit `plannedDatesForGrid`, één keer per transactie en
  alleen als een cel ze vraagt. Die past eerst de plaatsingswrites van dezelfde transactie toe op een kopie: de routes
  `task-schedule`, `task-constraint`, `task-milestone` en `task-hammock`, de kolom `task.workRule` en elke write die
  geen celwrite is. Daarna loopt `progressPlacementForBatch` de taken met voortgang in volgorde van de relatiegraaf af
  en neemt de uitkomst van elke taak op, zodat een latere taak de voortgang van een eerdere ziet. Een taak waarvoor de
  startvraag geldt, neemt hij niet op.
- De startvraag na het toepassen gebruikt dezelfde geplande start als de afleiding (`progressStart`).
- Het werk van de toewijzingen schuift bij een voortgangscel mee van rest naar verricht (`captureProgressWork`,
  `settleProgressWork`, ADR 0154 en 0444).
