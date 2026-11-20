# Wat de bridge aan het project schrijft en wat niet

`planner_update_project` schrijft de projectgegevens die de planner in de app ook als gegevens invult: naam,
omschrijving, auteur, bedrijf, start-, eind- en statusdatum, voortgangsmodus en de standaardwerkregel. Velden die de
berekening van het hele document bepalen, of die de app zelf beheert, schrijft de bridge bewust niet. Ze worden bij
naam geweigerd met een reden en de route in de app (`PROJECT_REFUSED`), want een uitgelegde weigering helpt een agent
meer dan stilte: het rekenprofiel en de rekenopties (`schedulingProfile`, `schedulingOptions`, `floatPaths`,
`leveling`), welke kalender de projectstandaard is (`calendarId`; de inhoud schrijft `planner_update_calendar`), de
automatische WBS-nummering, `id` en de tijdstempels.

## Gevolgen

- `endDate` is een echt projectveld (Backstage, IFC, MSPDI, P6 en de spanne van `generate`) en dus schrijfbaar. Geen
  einddatum is `""`, de conventie van de app, en geen `null`: het veld is in het type een verplichte string.
- Wissen van `statusDate`, `progressMode` en `defaultWorkRule` (met `null` of `""`) gaat niet via een samengevoegde
  patch maar als te verwijderen sleutel (`ClearableProjectKey`), zoals de store-actie `setStatusDate`: IFC en de
  standaarden van de solver kijken of de sleutel er is. Wissen loopt door dezelfde patch als zetten, zodat ook een
  gewiste standaardwerkregel de taken omzet die hem erven.
- Of een statusdatum niet gestart werk verschuift, hangt af van het rekenprofiel. Met P6 en OPS is ze een ondergrens
  voor werk met voltooiing 0, ook zonder voortgang; met MS Project, of een eigen profiel met die conventie aan, niet
  (conventie A23 `unstartedIgnoresStatusDate`, `CPMSolver.ts`). Het antwoord geeft bij het zetten een uitleg in de data zelf
  (`statusDateNote`, ook in een batchstap), want een agent leest de data vaak eerder dan de beschrijving; die tekst
  beschrijft alleen de ondergrens en noemt het profiel niet. Wat er werkelijk gebeurde, meet de losse aanroep: raakt
  hij de statusdatum, dan vergelijkt de handler het projecteinde vóór en na (`statusDateEffect` met `shifted`), met
  `staleBefore` omdat een verouderde berekening het getal van vóór onbetrouwbaar maakt.
- Datums worden streng getoetst (`isProjectDateValue`): de datum moet bestaan en er mag niets achter staan; alleen de
  statusdatum mag een tijd dragen. Zo komt een onmogelijke datum zoals `2026-02-30` nooit in het project en het
  IFC-bestand.
- `planner_move_project` en `planner_save_baseline` roepen de slice-actie (`moveProject`, `saveBaseline`) direct
  binnen de transactie aan, zonder eigen draftvariant: de logica van verschuiven en van de nulmeting staat op één plek.
  Binnen de MCP-lease doet hun eigen `beginUndoable` niets, zodat het één undo-stap blijft. Bij
  `planner_move_project` rekenen daardoor de slice-actie en de transactie allebei de planning door; die dubbele
  herberekening is aanvaard om de verschuiflogica niet na te bouwen.
- `planner_save_baseline` mag niet in `planner_batch`. Een baseline is een losse, bewuste nulmeting op een verse
  planning; binnen een batch zou een terugrol hem meewissen en is de volgorde onbepaald. Hij rekent eerst bij met
  `ensureFreshSchedule`.
