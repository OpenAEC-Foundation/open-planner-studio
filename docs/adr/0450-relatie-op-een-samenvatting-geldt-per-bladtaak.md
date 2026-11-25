# Een relatie op een samenvattingstaak geldt per bladtaak

`CPMSolver` rekent alleen met bladtaken (ADR 0010). Een relatie met een samenvattingstaak als voorganger of
opvolger schrijft `expandSummaryRelations` daarom vóór de solver om naar relaties tussen bladtaken. Is de voorganger
een samenvatting, dan wordt elk blad eronder voorganger; is de opvolger een samenvatting, dan wordt elk blad eronder
opvolger; zijn beide kanten een samenvatting, dan komt er een relatie voor elk paar (het kruisproduct). Geneste
samenvattingen tellen door tot de bladtaken (`leafDescendantsOf`, langs `childIds`). Een uitgeschreven relatie
neemt alle velden van de oorspronkelijke over (type, lag en lageenheid); alleen `id`, `predecessorId` en
`successorId` wijzigen. Er is geen aparte berekening voor de tak als geheel. Elke bladrelatie rekent haar eigen lag:
een lag in werktijd telt in de kalender die de projectoptie `lagCalendar` voor die bladrelatie kiest (zonder keuze
die van het blad dat voorganger is, ADR 0270), en een procentuele lag neemt de duur van dat blad. De vroege start
neemt het maximum over de voorgangers (ADR 0270), dus de strengste berekende grens van een bladrelatie bepaalt de
start. Dat is niet per se het blad dat het laatst klaar is, ook niet bij FS zonder lag, als de bladen een eigen
kalender hebben. Proef uit de review van #1281: een fase met K1 op een kalender die alleen op maandag werkt (klaar
op maandag 1 juni 15:00) en K2 op de projectkalender (klaar op dinsdag 2 juni 16:00), met FS zonder lag naar X: X
start op maandag 8 juni 08:00, bepaald door K1; met alleen K2 als voorganger start X op woensdag 3 juni 08:00. Met
een lag geldt hetzelfde (knownbug 2479).
We kozen dit boven de samenvatting als eigen knoop in de solver, omdat zo'n knoop een duur en positie nodig heeft
die uit haar kinderen volgen; dat is een grotere wijziging. Weglaten was geen optie: volgens het weggehaalde
commentaar kostte dat in het corpusbestand `870d339f60603f71` een kwart van de logica. Het corpus staat niet in de
repo; `check-mpp-summary-relations.ts` draait alleen met dat bestand en slaat anders over.

## Gevolgen

- De functie schrijft niets naar de store: de uitgeschreven relaties bestaan alleen als invoer voor de solver en
  voor wie de bladgraaf leest, zoals de relatieregels (`relationRules.ts`), het logica-rapport (`logicIndex.ts`),
  `startEditConstraint.ts` en de XER-export (`xerWriter.ts`). Hoe hun ids eruitzien en hoe het resultaat ze
  terugvouwt, staat in ADR 0454.
- Per relatietype verschilt de uitkomst van een rekening met de samenvatting als één taak, waarvan de start de
  vroegste en de finish de laatste kinddatum is (de rollup in de gevallen `wbs-summary-relation-conservative-*` in
  `cases-edge.json`). Met de samenvatting als voorganger bij SS of SF rekent de opvolger met de start van elk kind,
  niet met de vroegste (knownbug 2477). Met de samenvatting als opvolger bij FF of SF moet elk kind aan de finisheis
  voldoen, ook een kind dat eerder klaar kan zijn (knownbug 2478). Een lag rekent per bladrelatie, met de duur of de
  kalender van het blad dat voorganger is (knownbug 2479). De gids `howto-relaties-leggen` legt de gebruiker uit wat
  per type geldt.
- Het weggehaalde commentaar noemde FS en FF met de samenvatting als voorganger en FS en SS met de samenvatting als
  opvolger gelijk aan MS Project, en de vier andere vormen conservatief: daar kan een taak in de voorwaartse rekening
  later komen dan bij de fase als één taak, niet eerder, en dat noemde het in bouwplanning de veilige kant. Volgens
  dat commentaar had geen van de 28 samenvattingsrelaties in het corpusbestand zo'n vorm of een procentuele lag. Dat
  MS Project een relatie op een samenvatting op elk blad toepast, komt ook uit dat commentaar, met de MSPDI-export van
  hetzelfde bestand als referentie. Niets daarvan is in de repo nagegaan; `check-mpp-summary-relations.ts` noemt die
  export een andere versie van het document en pint alleen het eigen resultaat.
- De vier vormen staan met handberekende datums in `cases-edge.json` (`wbs-summary-relation-pred-01`, `-succ-01`,
  `-both-01` en `-nested-01`); welke bladrelaties ontstaan, met welk type en welke lag, toetst
  `check-summary-relation-expansion.ts`.
