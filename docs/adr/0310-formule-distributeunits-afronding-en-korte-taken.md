# De formule `distributeUnits`: hele eenheden bij een heel tempo, een korte taak op één slot

`distributeUnits` (`src/engine/scheduler/ResourceLoad.ts`) is de laatste bron van `assignmentDayUnits` (regel
`contour`, ADR 0311): inzet maal duur, verdeeld over de dagslots volgens de curve. Ze rondt af met de grootste-
restmethode (`largestRemainderRound`): eerst naar beneden, daarna krijgen de slots met de grootste rest er een stap
bij tot de som het afgeronde totaal is. De stap hangt aan het tempo, niet aan het totaal. Ligt `unitsPerDay` binnen
1e-9 van een geheel getal, dan verdeelt ze in hele eenheden per dag, omdat een halve machinist of 0,67 kraan op één
dag geen planning is; anders in honderdsten, omdat een fractioneel tempo gewone invoer is (`UnitsInput` neemt
breuken aan). Een toets op het totaal zou een fractioneel tempo met een heel totaal in hele eenheden leggen; volgens
het weggehaalde commentaar gaf `distributeUnits(0.5, 4)` dan [1, 1, 0, 0] in plaats van vier keer 0,5.
`check-contour-engine.ts`, geval a7b, toetst *Dubbele piek* met tempo 0,5 over 4 dagen (totaal 2) op honderdsten;
a7c en b6 toetsen de hele eenheden bij tempo 1.

## Gevolgen

- Een duur groter dan 0 en hoogstens 1 geeft één slot met inzet maal duur, voor elke curve en zonder afronding; een
  duur van 0 of minder geeft een lege lijst. Zonder die regel gaf een urentaak korter dan een werkdag een lege lijst
  (`check-short-hour-task-load.ts`, deel a).
- Zes curves hebben controlepunten (`CURVE_POINTS`): de formule interpoleert lineair op t = i / (D − 1) en deelt door
  de som. *Dubbele piek* en *Schildpad* hebben er geen; hun gewichten komen uit de tabel (`CONTOUR_SHAPE_VALUES`, via
  `slotWeightsFromValues`), zoals bij `curveValues`.
- Op twee dagen vallen de monsterpunten van *Klok*, *Vroege piek* en *Late piek* op hun twee randpunten (gewicht
  0,2), dus verdwijnt de piek uit de gewichten: beide slots wegen even zwaar. De grootste-restmethode kan daarna nog
  een afrondingsstap aan één slot geven, waardoor de afgeronde slots toch verschillen: `distributeUnits(0.334, 2,
  'BELL')` geeft [0,34, 0,33]: elk slot krijgt eerst 33 van zijn 33,4 honderdsten, het afgeronde totaal is 67
  honderdsten, en bij gelijke rest krijgt het eerste slot de stap. Dat is aanvaard: een bult in het midden is met
  twee slots niet te tonen. ADR 0002 noemt hetzelfde: de formule interpoleert en vervlakt korte taken.
- Op een kalender met werkblokken bepalen deze slots alleen de vorm: `assignmentPlacementLoad` (`workPlacement.ts`)
  legt ze naar rato op de dagen van de plaatsing, en zonder opgeslagen werk volgt het totaal de plaatsing (ADR 0312).
  Op de dagslotroute (`dayslotLoad`) boekt de belasting de slots zoals ze zijn.
