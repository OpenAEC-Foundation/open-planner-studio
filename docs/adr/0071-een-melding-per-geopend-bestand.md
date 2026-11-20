# Eén melding per geopend bestand

Eén XER kan twaalf documenten openen, maar het blijft één bestandsactie van de planner. `applyOpenedImport` bouwt
daarom pas na de lus over alle documenten één openingsmelding voor het hele bestand, en de laadstap per document
(`applyLoadedProject`) meldt alleen wat bij dat document hoort. Een nieuwe regel komt als detailregel onder een al
bestaande melding en wordt alleen zelf een melding als er nog geen is.

## Gevolgen

- De regel over de datums zoals opgeslagen telt het aantal taken dat de opgeslagen datums toont
  (`recordedDates.total`), opgeteld over de geopende documenten, niet het aantal dat bij herberekenen zou verschuiven;
  dat noemt de strook.
- Relaties die de solver niet kan meerekenen (een taak gekoppeld aan haar eigen samenvatting, een lege tak, de grens op
  het aantal uitgevouwen relaties) blijven in het document: eruit filteren zou bij openen en opslaan logica uit het
  bronbestand vernietigen. Ze komen wel één keer in een blijvende melding.
- De melding over onderbroken, genivelleerde of door resources gestuurde taken in een `.mpp` is informatief: ze zegt
  dat het bestand zulke taken bevat, niet dat de datums onbetrouwbaar zijn.
