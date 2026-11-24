# Gesplitste en ingesnoerde balken in de Gantt

Een balk valt in de Gantt om twee redenen in stukken, en die twee volgen een andere regel. Een echte split
(`Task.splitGaps`) is een werkonderbreking in de data: `drawTaskBar` tekent hem in stukken, los van de instelling
*Taakbalken bij onderbrekingen* (`barSplitMode`). De kalenderinsnoering is weergave en verandert geen greep: een
taak met tijden in haar datums, een duur in uren en een kalender met werktijden (`engineFor`) toont de gaten
tussen haar werkblokken volgens die instelling (altijd, bij selectie of nooit; standaard bij selectie). Een andere
taak zonder split is één doorlopend stuk.

## Gevolgen

- De stukken van een echte split komen uit `computeSplitSegments` met de engine van `splitEngineFor` (de
  werkblokken van de effectieve kalender, ook op een dagkalender) en de maat van `taskSplitMeasure` bij een taak met
  tijden; een taak met alleen datums loopt in hele werkdagen. De eerste en laatste grens zijn de randen van de hele
  balk uit `barGeometry` (in dagmodus met de inclusieve einddag); de tussengrenzen zijn exclusief en gaan rechtstreeks
  door `dateToX`.
- De insnoering deelt het zichtbare deel op, met een marge van een dagbreedte en een dag. Een uurtaak van meer dan een jaar werd anders
  na de scangrens van `workIntervalsBetween` afgekapt, en elk frame bouwde de werkblokken van de hele looptijd
  (`check-split-bar-render`). Een stuk dat tegen de knip ligt, loopt door tot de echte balkrand; valt het zichtbare
  deel helemaal in een gat, dan staat er in beeld geen balkvulling en loopt de verbindingslijn door; de selectiering
  van een geselecteerde taak blijft ook dan zichtbaar.
- De verbindingslijn door de gaten is dun, op halve hoogte en halve dekking. Voortgang, selectiering, rode rand en
  de zichtbaarheidstest gelden voor de hele balk, niet per stuk (`check-split-bar-render`).
- De hittest (`getTaskBarBounds`) leest de stukken die de laatste render tekende (`splitSegmentsByTask`), zolang de
  taak nog gesplitst is; een balk die niet getekend is, valt terug op de hele balk. Stuk 0 heeft een linkerrand,
  elk stuk een rechterrand, en de randzone binnen een stuk is hooguit een derde van zijn breedte, zodat ook een smal
  stuk een middendeel houdt. Buiten het stuk loopt de randzone 6 px door: links van stuk 0 en rechts van elk stuk.
  Het eerste stuk dat de x claimt, wint. In een pauze is daardoor de eerste 6 px de rechtergreep van het stuk ervóór;
  pas daarna is het geen greep en geeft `getSplitGapAt` de pauze. Wat een stuk als bewerking betekent, bepalen
  `useBarDrag` en `splitEdit.ts`.
