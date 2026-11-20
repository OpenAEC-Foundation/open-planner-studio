# Een hammock is een gevolg, geen oorzaak

Een hammock (in P6 een LOE-activiteit) leidt haar looptijd af van haar drivers. Ze loopt mee in topologische
volgorde, omdat haar drivers per definitie vóór haar staan. Haar vroege start is het maximum van de grenzen uit
haar SS- en FS-voorgangers met de projectstart als vloer; haar vroege finish het maximum van de grenzen uit haar FF-
en SF-voorgangers, omgezet naar een finish en nooit vóór de start. Haar eigen duurinvoer telt niet; de afgeleide
span wordt na elke berekening naar precies één duurbron geschreven (`writeDerivedSpan`, gedeeld met de rollup van
verzameltaken): minuten als de kalender werkblokken heeft, anders werkdagen. Achterwaarts is een hammock neutraal:
LS = ES en LF = EF, speling 0, en ze geeft geen druk door aan haar drivers. Zo kan een strakke opvolger van de
hammock nooit via de hammock negatieve speling op een driver leggen.

## Gevolgen

- Een hammock zonder finish-driver (geen FF- of SF-voorganger) krijgt EF = ES en wordt gemeld in
  `hammockNoFinishDriverTaskIds`.
- Een hammock die ook als mijlpaal is gemarkeerd, krijgt haar vroege start met de gewone startsnap
  (`snapOnOrAfter`), niet met de mijlpaalregels van ADR 0014 (knownbug 1967).
- De relaties van een hammock krijgen geen `seqConstraint` en blijven buiten de analyse van driving en spelingpaden.
- Een hammockspan in kalendertijd telt in klokminuten (ADR 0016).
- B4 (`p6CompletedLoeActualFinish`): een voltooide LOE uit P6 met alleen een SS-ingang en zonder opvolger volgt de
  route via haar werkelijke finish in plaats van de hammockroute. De poort vergelijkt met de rauwe statusdatum, niet
  met de gesnapte: een naar het volgende werkblok gesnapte datum zou een werkelijke finish na de statusdatum van P6
  ten onrechte toelaten.
- B5 (`p6OpenLoeTargetSpan`): een niet-gestarte LOE met een volledig doelvenster neemt dat venster. De meting van de
  werkminuten in dat venster is een uurprimitief en wordt alleen bereikt als de conventie aan staat en de kalender
  eigen werkblokken heeft; anders is de meting NaN en sluit de poort.
