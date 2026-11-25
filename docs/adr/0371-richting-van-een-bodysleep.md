# De richting van een bodysleep

Een sleep op de body van een balk kan twee dingen betekenen: opzij verzet de datums, omhoog of omlaag verplaatst de
taak naar een andere rij. We kiezen de richting één keer per gebaar, zodat een schuine beweging nooit zowel datums
als structuur verandert (twee mutaties en twee undo-stappen). De randen van een balk zijn altijd horizontale
duurgrepen en kiezen geen richting.

## Gevolgen

- `handleMouseMove` kiest pas als de muis `ROW_DRAG_THRESHOLD` (4 px, `hooks/constants.ts`) in x of y heeft
  bewogen, dezelfde drempel als de rijsleep. Wint y en is er een ontvanger (`onVerticalBodyDrag`), dan gaat het
  gebaar naar de rijsleep vóór elke schrijfactie: een verticale verplaatsing verandert geen datums en is één
  undo-stap via `moveTaskTo`/`moveTasksTo`. Of de structuur bewerkbaar is, beslist de ontvanger.
- Zonder ontvanger (geen ingebedde taakgrid) bestaat het verticale gebaar niet en blijft de body een gewone
  datumsleep. Afbreken zou de balk tot het loslaten stil laten liggen.
- Een stuk- of stukrandsleep op een gesplitste balk kiest geen richting (ADR 0377).
- De keuze staat in een ref en overleeft een effectherstart (ADR 0370). De browsertests in
  `tests/browser/gantt-drag-undo.spec.ts` slepen schuin en verticaal met echte muisgebaren;
  `check-gantt-event-ownership.ts` controleert alleen dat de schakels van de overdracht in de bron staan.
