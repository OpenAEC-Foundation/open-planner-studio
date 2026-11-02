# Afbakening van de testreeks

Uitgangspunt: de 48 punten onder **Tests** op `6386f95e6`.
Alleen de hieronder opgeloste punten verdwijnen uit `knownbugs.md`.

## Opgelost

394, 427, 432, 460, 473, 552, 553 en 598. Het rood/groen bewijs staat in `bewijs.md`.
De wijzigingen betreffen tests, hun uitvoer-/CI-inrichting en het PR-sjabloon.

## Voor Ethan

- **406:** kies of een mislukte opslagproef het welkom mag overslaan; advies: leg eerst de gewenste eerste taalkeuze vast en baseer beschikbaarheid daarna op een echte lees-/schrijfproef.
- **461:** kies of `generatedAt` het laatste ophalen of de laatste cijferwijziging betekent; advies: behoud de huidige bronbetekenis totdat de gewenste actualiteit van de appweergave vaststaat.
- **402:** de MCP-waarschuwing moet uitleggen dat pins hun verschoven voorgangers blijven volgen; advies: corrigeer de twee teksten samen in de tekstgroep.
- **495:** de verouderde knopnaam staat in Help-vertalingen; advies: neem dit mee in een afzonderlijke gidsvertaalronde.

## Overgeslagen wegens botsing met een uitgesloten PR

- **409:** de pre-paintscriptcorrectie raakt `index.html`, onderdeel van #721.
- **410:** de dev-linkroute moet samen met de wijzigingen in `devOpenLink.ts` en de bestaande dev-linkchecks worden bewezen; die bestanden vallen onder #779/#780. Het punt blijft bovendien gemeld, niet opnieuw bevestigd.
- **413:** de oplossing of documentatie van `#` in een dev-link raakt de dev-linkcode/documentatie van #779/#780.
- **562:** het betreft thema's en `check-theme-bar-contrast`, uitgesloten door #721/#780.

## Andere productgroep of externe omgeving

- **585, 599:** opruiming/optimalisatie in productcode voor rapporten en renderer; buiten de testgroep.
- **212:** de echte Tauri-bestandsroutes vergen een echte desktop-app en de bijbehorende integratierun; lokaal geen Tauri-build gestart.
- **263:** bewijs moet uit de echte SuperCloud-werkplek komen; een dev-server of nagebootste host sluit dit punt niet.
- **178:** betreft de GitHub CLI op de host, geen testfix in deze repo. PR-tekst wordt waar nodig via de API bijgewerkt.
- **199:** historische APT-/runneruitval; de oorzaak is niet opnieuw bevestigd. Geen netwerk- of tijdslimiet verruimd.

## Open testwerk zonder fix in deze PR

- **79, 313, 314:** variërende prestaties onder machinebelasting. Geen lokale zware meting gedaan en geen grens versoepeld; een relatieve meetlat of CI-beleid vraagt afzonderlijk meetbewijs.
- **310:** de echte formaat-/laadroute van de headless server moet met volledige tijdstippen en maatrecords worden uitgebreid; niet meegenomen in deze ronde.
- **401, 325, 429, 430, 490, 491, 496:** browserroutes voor echt openen, smal scherm, hosttaal, platformstart, lintwiel, miniaturen en lintweergave. Niet aangepast zonder de bijbehorende browser- en mutatiebewijzen; lokaal geen dev-server gestart.
- **484:** het bronbestand bij browsercoverage moet via de echte productiemeting en de artifact-upload worden gecontroleerd; geen productiebouw of meetworkflow gestart voor dit punt.
- **403:** de relatie met de historische tooltipmelding 294 is zonder nieuwe reproductie onvoldoende om beide meldingen te verwijderen.

## Niet opnieuw bevestigde gemelde punten

**91, 167, 169, 151, 237, 238, 264, 294, 405, 224, 334, 442 en 561** blijven open.
Er is geen nieuwe reproducerende test voor deze punten uitgevoerd; eerdere wisselvallige
CI-uitkomsten of bronvermoedens zijn niet tot een bewezen oorzaak verheven.

## Nieuwe punten

Geen nieuwe knownbugs uit reeks 780–799 toegevoegd.
