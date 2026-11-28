# Bezettingsoverzicht: het actieve document niet doorrekenen, en een eigen histogram

Het bezettingsoverzicht (`ResourceOccupancyView.tsx`) rekent een verouderd slapend document efemeer door (regel
`library`, ADR 0476), maar het actieve document niet: dat krijgt `skipEphemeralSolve`. Een bewerking aan de invoer van
de bezetting maakt de memo rond `computeLibraryOccupancy` ongeldig, dus een efemere doorrekening zou per toetsaanslag
een volledige CPM-berekening synchroon in de render kosten. Het actieve document heeft zijn eigen rekenpad (F5 of
`useAutoCalcCPM`); hier telt het mee zonder doorrekening, dus mogelijk met oudere planningsdatums (knownbug 28), en
krijgt het een eigen markering (`staleAsShownDoc`).

## Gevolgen

- De efemere doorrekening krijgt de volledige taken en relaties van de payload (`occupancySolveInputFor`), niet de
  bibliotheeksnit: een gesnoeide graaf geeft een andere planning dan F5 in dat document.
- Documentkleuren worden in het overzicht één voor één toegewezen in de volgorde van de gesorteerde rijen, niet met de
  hash van `documentColor`, omdat twee documenten met die hash dezelfde kleur kunnen krijgen.
- Het histogram is SVG in de DOM en niet de canvas-`HistogramRenderer`, want die hangt aan de tijdschaal van het
  actieve project. Het staat op `dir="ltr"`, ook in ar/fa, net als de pane-rij van de Gantt (ADR 0570); de tabel
  en de legenda eromheen volgen de documentrichting.
