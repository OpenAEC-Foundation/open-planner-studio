# Gedeelde componenten: keuzes die verrassen

De componenten in `src/components/common/` worden op veel plekken gebruikt. Een paar keuzes erin zou een collega
zonder uitleg terugdraaien, omdat de eenvoudiger vorm hetzelfde lijkt te doen. Het gemeenschappelijke besluit: een
bewerking in een gedeeld veld of paneel gaat niet stil verloren en telt niet dubbel, ook niet als het veld of paneel
verdwijnt voordat de browser een blur stuurt. Voor het datumveld en zijn kalender staan de keuzes in ADR 0460 tot en
met 0465; de regel voor een klik naast een dialoog bewaakt `tests/planning/check-dialog-backdrop.ts`.

## Gevolgen

- `CommitColorInput` legt vast op het native `change`-event, niet op React's `onChange`: die kan al tijdens het kiezen
  afgaan, en dan werd één kleurkeuze vele undo-stappen.
- `CommitTextInput` en `UnitsInput` (met `commitOnBlur`) leggen een openstaand concept ook vast bij unmount. Escape die
  de dialoog sluit, of een taakwissel die de rij verwijdert, haalt het veld weg zonder blur; zonder de unmount-commit
  ging getypte invoer stil verloren.
- `Popover` en `DatePickerPanel` halen bij sluiten door een klik ernaast (en `Popover` ook door scrollen) eerst de
  focus uit het paneel (`closeKeepingInput`). Zo rondt een veld in het paneel zijn invoer af, want een verwijderd
  element krijgt geen blur.
- `Popover` sluit bij het scrollen van een voorouder alleen als de knop sinds het plaatsen van het paneel echt is
  verschoven. Uit het weggehaalde commentaar, niet nagegaan: de browser kan de knop vóór de openende klik in beeld
  schuiven en het scrollevent pas daarna bezorgen, en dan sloot het paneel meteen na openen.
- De zwevende panelen hangen via een portal aan `document.body`, maar zijn in React nog een kind van hun veld.
  `DatePickerPanel` stopt daarom pointerdown, mousedown en click op het paneel, anders telt een klik erin ook bij de
  tabelcel of dialoog eromheen.
- `Select` roept bij het opnieuw kiezen van de al gekozen optie `onChange` niet aan, zoals een native `<select>`. Anders
  wiste bijvoorbeeld dezelfde curve opnieuw kiezen een geïmporteerde P6-curve. Wie die keuze toch moet horen (de
  gridcel-editor) geeft `onReselect` mee; alleen dan, of bij een echte wijziging, stopt Enter in de open lijst bij de
  `Select`, zodat een omringende Enter-handler de keuze niet een tweede keer verwerkt.
- `Select` tekent vanaf 200 opties alleen de zichtbare rijen plus een buffer: *Bovenliggende taak* met de 6.978 opties
  van `rehab-2.xer` opende daarvoor in 0,9 tot 2,0 s, daarna in 33 tot 43 ms (commit `5d41450bd`).
- `TimeInput` is een tekstveld en geen `<input type="time">`: met het native veld kiest de browser de notatie, en het
  veld moet de instelling Tijdnotatie volgen.
- `TooltipHost` neemt het `title` van elk element over: bij hover haalt hij het tijdelijk weg, zodat de native tooltip
  niet verschijnt, en zet het daarna terug. Daardoor krijgt elk bestaand `title` dezelfde tooltip zonder per knop iets
  te bedraden. Bij het terugzetten overschrijft hij nooit een `title` dat er intussen weer staat, want dat is een
  nieuwere waarde van React.
- `ExtensionIcon` is de enige plek waar een icoon van een extensie in de DOM komt, en zijn `dangerouslySetInnerHTML`
  krijgt alleen de markup die `sanitizeSvgIcon` opnieuw opbouwt. Een nieuwe plek voor extensie-iconen gebruikt deze
  component; het icooncontract staat in `docs/extensions.md`.
