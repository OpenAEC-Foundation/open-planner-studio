# In "datums zoals opgeslagen" komt het rekenresultaat uit de vastlegging, zonder te rekenen

In de modus staat het bestand op het scherm, niet een berekening. `cpmResultFromRecorded`
(`src/engine/scheduler/recordedDates.ts`) bouwt daarom een `CPMResult` uit de vastlegging (`times`, ADR 0330) en
de taken, zonder solve. Ze vult alleen wat uit de vastlegging en de kalender volgt: per taak de datums en de
speling, het kritieke pad, het projecteinde, de projectduur en de gemiste deadlines. Wat alleen een berekening kan
weten, blijft leeg: `drivingSequenceIds` (met `drivingUnknown`, ADR 0020), `sequenceFreeFloat`,
`truncatedLeadSequenceIds`, `violatedConstraintTaskIds`, `outOfSequenceSequenceIds`, `nearCriticalTaskIds`,
`floatPathByTask` en `hammockNoFinishDriverTaskIds`. Toets: `check-recorded-dates.ts` §3.

## Gevolgen

- Per vastgelegde taak: zonder late datum in de vastlegging is de late datum de vroege, zonder speling is de
  speling 0, zonder `isCritical` is de taak niet kritiek. `CPMTaskResult` eist die velden als getal of tekst;
  "niet vastgelegd" staat alleen in `times` (ADR 0332). Spelingminuten komen alleen mee als het record ze draagt,
  zonder terugval. Het kritieke pad bevat alleen taken met `isCritical: true` in het record
  (`check-recorded-dates.ts` 3b, 3i).
- Een verzameltaak zonder eigen record waaronder vastgelegde taken hangen, staat ook in het resultaat, met de waarden
  van haar `task.time` (die `applyRecordedTimesToTasks` net oprolde). Zo zeggen Gantt en taakraster (op `task.time`)
  en rapporten (op `cpmResult`) hetzelfde over die rij. Een tak zonder enige vastlegging blijft erbuiten
  (`check-recorded-dates.ts` 15f).
- Een gemiste deadline gebruikt `deadlineBound` op de kalender van de taak (`resolveCalendar` op `task.calendarId`
  met de projectkalender als terugval, dan `engineForTaskCalendar`), zoals `CPMSolver.calendarFor`. Een einde precies
  op de grens is niet gemist. Zo spreken de melding na een berekening en die in de modus elkaar niet tegen, ook niet
  voor een taak op een eigen kalender (review PR #402 ronde 2; `check-recorded-dates.ts` 4f en 4g).
- Het projecteinde is het grootste `finish` van de vastgelegde taken, de projectstart voor de duur het kleinste
  `start`, beide als tekst vergeleken (grens: knownbug 2326). De projectduur komt uit `projectDurationOf` op de
  projectkalender, met de ruwe tekst; die functie leest een datum zonder tijd als die werkdag zelf en een moment met
  `parseInstant` als UTC, onafhankelijk van de tijdzone van de machine (`check-recorded-dates.ts` §5, in de
  tijdzonematrix). De mijlpaaluitzondering van die functie leest de taken, niet de vastlegging (§6; grens:
  knownbug 2327).
