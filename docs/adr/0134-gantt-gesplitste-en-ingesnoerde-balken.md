# Gesplitste en ingesnoerde balken in de Gantt

Een balk valt in de Gantt om twee redenen in stukken, en die twee volgen een andere regel. Een echte split
(`Task.splitGaps`) is een werkonderbreking in de data: `drawTaskBar` tekent hem in stukken, los van de instelling
*Taakbalken bij onderbrekingen* (`barSplitMode`). De kalenderinsnoering is alleen weergave: een uurtaak toont de
gaten tussen haar werkblokken volgens die instelling (altijd, bij selectie of nooit; standaard bij selectie). Een
dagtaak zonder split is één doorlopend stuk.

## Gevolgen

- De stukken van een echte split komen uit `computeSplitSegments` met de engine van `splitEngineFor` (de
  werkblokken van de effectieve kalender, ook op een dagkalender) en de maat van `taskSplitMeasure` bij een taak met
  tijden; een taak met alleen datums loopt in hele werkdagen. De eerste en laatste grens zijn de randen van de hele
  balk uit `barGeometry` (in dagmodus met de inclusieve einddag); de tussengrenzen zijn exclusief en gaan rechtstreeks
  door `dateToX`.
- De insnoering deelt alleen het zichtbare deel op, met een dag marge. Een uurtaak van meer dan een jaar werd anders
  na de scangrens van `workIntervalsBetween` afgekapt, en elk frame bouwde de werkblokken van de hele looptijd
  (`check-split-bar-render`). Een stuk dat tegen de knip ligt, loopt door tot de echte balkrand; valt het zichtbare
  deel helemaal in een gat, dan staat er alleen de verbindingslijn.
- De verbindingslijn door de gaten is dun, op halve hoogte en halve dekking. Voortgang, selectiering, rode rand en
  de zichtbaarheidstest gelden voor de hele balk, niet per stuk (`check-split-bar-render`).
- De hittest (`getTaskBarBounds`) leest de stukken die de laatste render tekende (`splitSegmentsByTask`), zolang de
  taak nog gesplitst is; een balk die niet getekend is, valt terug op de hele balk. Stuk 0 heeft een linkerrand,
  elk stuk een rechterrand, en de randzone binnen een stuk is hooguit een derde van zijn breedte, zodat ook een smal
  stuk een middendeel houdt. Het eerste stuk dat de x claimt, wint. Een x in een pauze is geen greep;
  `getSplitGapAt` geeft daar de pauze. Wat een stuk als bewerking betekent, bepalen `useBarDrag` en `splitEdit.ts`.
