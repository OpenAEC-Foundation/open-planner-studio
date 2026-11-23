# Nivelleren: venster, zoekgrens en de reden van een conflict

Vindt `findSlot` geen venster en geen onderbroken plaatsing (ADR 0165), dan blijft de taak op haar eerste kandidaat
staan met haar conflictdagen en één reden (`LevelingReason`); het nivelleervenster kiest op die reden de uitleg.
De reden moet zeggen wat de planner kan doen, dus de nivelleerder onderscheidt drie manieren waarop de scan in `findSlot` eindigt. Het venster is een keuze
van de planner: met smoothing de late start uit de eigen basis, met een uitloopplafond
(`overrunCeilingDays`) die late start plus het plafond in werkdagen op de taakkalender (bij kalendertijd
kalenderdagen), met allebei het strengste (`windowLimit`). Een plafond van 0 geeft zo hetzelfde venster als
smoothing (`check-leveler-ceiling.ts`, geval 1). De zoekgrens is een rekengrens: `scanLimit` volgt uit de som van de
`scheduleDuration` van alle taken met een marge, en een poolgrootboek met `horizonIso` mag hem verlengen tot hoogstens
`HARD_SCAN_CAP`. Raakt de scan het venster, dan telt het venster, ook als de zoekgrens op dezelfde stap op is; raakt
hij alleen de zoekgrens, dan is dat `NO_WINDOW_IN_HORIZON` en geen bewering over capaciteit. De zoekgrens is een
schatting (knownbug 1982).

## Gevolgen

- `reasonFor` kiest de eerste die geldt, in deze volgorde: de piekvraag past nergens (`INTRINSIC_OVERRUN`), het
  plafond is onbereikbaar (`CEILING_UNREACHABLE`), de kalender van de resource past nergens
  (`CALENDAR_MISMATCH`), alleen de pool zit vol (`RESIDUAL_FULL`), het plafond is te krap (`CEILING_TOO_TIGHT`),
  de zoekgrens is op (`NO_WINDOW_IN_HORIZON`), anders onvoldoende capaciteit.
- `CEILING_UNREACHABLE` geldt alleen met een uitloopplafond, als de eerste kandidaat al na het venster ligt: dan
  drukt een deadline of een constraint de late start naar voren, en meer uitloop helpt niet
  (`check-leveler-ceiling.ts`, geval 3). De eerste kandidaat wordt altijd getoetst, ook buiten het venster;
  `CEILING_UNREACHABLE` is alleen de reden als hij niet past. Met alleen smoothing en een eerste kandidaat na de late
  start krijgt de taak een van de andere redenen.
- `RESIDUAL_FULL` gaat vóór `CEILING_TOO_TIGHT`: met een plafond won anders altijd `CEILING_TOO_TIGHT`, ook als alleen
  andere documenten de pool bezetten (ADR 0163).
- Een resource met capaciteit 0 op een werkdag is een capaciteitsprobleem, geen kalenderprobleem: `calendarOk` kijkt
  alleen naar de kalender van de resource (`isResWorkDay`), niet naar `capacityOf` (`check-leveler-seam.ts`,
  geval 1). Een dag zonder vraag van de taak is nooit haar conflict, ook als een andere taak die dag overboekt
  (`check-leveler-seam.ts`, geval 3).
- Een scan met onderbrekingen die op de zoekgrens leeg loopt, zet ook de uitputting (ADR 0165); anders verdween die
  en koos `reasonFor` een capaciteits- of plafondreden.
- Bij `INTRINSIC_OVERRUN` geeft `intrinsicOverrunFor` resource, piek en hoogste capaciteit mee uit dezelfde dagvraag
  (`intrinsicOverruns`).
