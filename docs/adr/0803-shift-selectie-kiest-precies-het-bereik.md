# Shift-selectie kiest precies het bereik

`selectTask` in `selectionSlice.ts` zet bij Shift de selectie op precies het bereik vanaf het anker, ook als Ctrl
ingedrukt is, net als de takenlijst en een bestandsverkenner. Een vereniging met de vorige selectie hield bij een
verkleind bereik de oude taken vast, en Ctrl+F2 koppelde die dan mee (review #1004).

## Gevolgen

- Het anker hoort bij de selectielijst zelf, niet bij haar inhoud (`liveSelectionAnchor`). Een actie die het anker
  niet kent (plakken, inklappen, Ctrl+A, MCP) zet een nieuwe lijst neer, en dan geldt het anker niet meer, ook niet
  als later dezelfde taken weer gekozen zijn. Daarom zet `selectTask` altijd een nieuwe lijst neer.
