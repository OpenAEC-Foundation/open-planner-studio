# Nivelleren

Je hebt één metselaar en twee muren die op dezelfde dagen gemetseld moeten worden. Op papier klopt de planning, maar in de praktijk kan hij maar op één plek staan. Nivelleren is de manier waarop de app zulke botsingen oplost: hij laat taken later beginnen, tot de resource het aankan. In dit artikel lees je wat nivelleren precies verschuift, wanneer de einddatum meegeeft en wat het niet voor je oplost.

## Het begrip

Een resource is **overbezet** op een werkdag als de planning die dag meer van hem vraagt dan hij kan leveren. Wat hij kan leveren, is zijn capaciteit: *Max. eenheden* op de werkdagen van zijn kalender. Werkt hij die dag volgens zijn kalender niet, dan is zijn capaciteit 0.

**Nivelleren** lost dat op door taken later te laten beginnen. Meer doet het niet. Het maakt geen taak korter, splitst geen taak, verandert geen inzet en geen relatie en zet er geen extra resource bij. De app zoekt voor elke taak de eerste plek waar de resources vrij zijn, en schuift de taak daarheen.

Er zijn twee manieren, in het venster *Resources nivelleren*:

- Standaard mag de einddatum van het project meeschuiven. Dat is nivelleren in de eigenlijke zin.
- Met het vakje *Alleen binnen speling nivelleren (smoothing) — projecteinddatum blijft vast* schuift de app taken alleen binnen hun speling. De einddatum blijft dan staan. Lukt het niet, dan blijft de taak staan en meldt de app een conflict. Wat speling is, lees je in [Kritiek pad en speling](docs://uitleg-kritiek-pad).

## Hoe de app rekent

### Hoeveel een taak vraagt

De app telt per werkdag hoeveel eenheden elke taak van een resource vraagt. Dat is de inzet volgens de curve of je eigen urenverdeling, precies dezelfde uren per dag als het histogram toont. De capaciteit van de resource is *Max. eenheden*, of de waarde van de stap in de tijd-gefaseerde capaciteit die op die dag geldt. Een dag is overbezet als de vraag groter is dan de capaciteit.

### In welke volgorde

De app zet de taken één voor één neer, in deze volgorde: de hoogste prioriteit eerst, dan de taak met de minste totale speling, dan de vroegste start, en dan de volgorde in de takenlijst. Een taak komt pas aan de beurt als haar voorgangers hun plek hebben.

De prioriteit is een getal van 0 tot en met 1000 dat je per taak zet. De standaard is 500. In het rechtermuisknopmenu van een taakbalk heet dat *Prioriteit*, met de keuzes *Laag* (100), *Normaal* (500) en *Hoog* (900). Een taak die eerder aan de beurt is, krijgt de plek die ze wil. De taken die daarna komen, moeten er omheen. Zo bepaalt de prioriteit welke taak blijft staan en welke wijkt. De waarde 1000 is bijzonder: zo'n taak schuift nooit voor capaciteit. Dat is het "Do Not Level" van MS Project.

### Waar een taak naartoe schuift

Voor elke taak begint de app bij de vroegste start die de relaties toelaten. Daarbij telt mee dat voorgangers zelf al verschoven kunnen zijn. Past de taak daar, dan blijft ze staan. Past ze niet, dan probeert de app de volgende werkdag van de taak, en zo verder. Een taak past als op elke dag van de taak elke resource genoeg vrij heeft. Heeft een taak meer resources, dan moeten ze allemaal die dagen vrij zijn. Zo schuift een taak altijd naar later, nooit naar eerder.

De verschuiving legt de app vast als **nivelleervertraging**: een aantal werkdagen, in de kalender van de taak, dat de taak later begint dan haar relaties eisen. Je ziet het in de kolom *Nivelleervertraging* onder *Berekend*. De vertraging wordt met het projectbestand bewaard. Bereken (F5) neemt hem mee als extra wachttijd vóór de start. Taken erna schuiven mee via hun relaties.

### Binnen speling of erbuiten

Zonder *smoothing* zoekt de app zo lang door tot de taak past. Daardoor kan de einddatum van het project opschuiven.

Met *smoothing* mag een taak niet later beginnen dan haar laatste start, dat is de laatste dag waarop ze kon beginnen zonder dat de einddatum verschuift. Past de taak binnen dat venster niet, dan blijft ze op haar vroegste plek staan. De taak komt dan onder *Resterende conflicten* te staan.

### Wat de app niet verschuift

- Taken die al gestart of klaar zijn. Hun belasting telt mee, maar ze krijgen nooit een nivelleervertraging.
- Taken met prioriteit 1000. Ze volgen hun voorgangers wel, maar schuiven niet voor capaciteit.
- Taken zonder toewijzing aan de geselecteerde resources, mijlpalen en fasen. Zij schuiven alleen mee als een voorganger verschuift.
- Materiaal. Dat wordt nooit genivelleerd.

### Voorstel en toepassen

*Berekenen* maakt een voorstel: de taken die verschuiven, met oude en nieuwe start, en de einddatum voor en na. Er verandert niets aan je planning tot je *Toepassen* kiest. Dan schrijft de app de vertragingen naar de taken en rekent hij de planning meteen opnieuw door.

## Rekenvoorbeeld: de metselaar op twee muren

Het voorbeeld is het oefenproject *Aanbouw woning* uit de tutorials, zoals het eruitziet vlak vóór het nivelleren in tutorial 5. In tutorial 5 doe je dit zelf en reken je het na. Het stucwerk staat in dit voorbeeld op *Vast werk* met twee stukadoors, zoals in [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).

Na de kanaalplaatvloer, klaar op maandag 28 juni, beginnen het binnenspouwblad (5 werkdagen) en het buitenspouwblad (6 werkdagen) allebei op dinsdag 29 juni. Ze staan beide op de metselaar, met een inzet van 1 en een *Max. eenheden* van 1. De oplevering staat op maandag 30 augustus.

### De overbezetting

Het binnenspouwblad loopt van 29 juni tot en met 5 juli, het buitenspouwblad van 29 juni tot en met 6 juli. Van 29 juni tot en met 5 juli, dat zijn 5 werkdagen, vraagt de planning 2 eenheden van een metselaar met capaciteit 1. De metselaar is op die 5 dagen overbezet.

### De volgorde

Beide taken hebben prioriteit 500. De kozijnen worden pas op 14 juli geleverd (in tutorial 3 zet je daarvoor een constraint *Start niet eerder dan (SNET)*). Daardoor heeft het binnenspouwblad 3 werkdagen speling en het buitenspouwblad 5. Het binnenspouwblad heeft de minste speling en komt dus eerst. Het blijft staan van 29 juni tot en met 5 juli.

### De verschuiving

Het buitenspouwblad kan niet op 29 juni beginnen. De eerste dag waarop de metselaar weer vrij is, is dinsdag 6 juli. Dat is 5 werkdagen later dan de vroegste start, dus de nivelleervertraging is 5. Het buitenspouwblad loopt nu van 6 juli tot en met 13 juli. De kozijnen beginnen toch pas op 14 juli, dus de oplevering blijft maandag 30 augustus. Het venster meldt *Projecteinddatum: ongewijzigd (30-08-2027)* en toont één regel: *Buitenspouwblad metselen*, oude start 29-06-2027, nieuwe start 06-07-2027, *5 d*.

De 5 werkdagen verschuiving zijn precies de speling van het buitenspouwblad. Daarom geeft *smoothing* hier hetzelfde resultaat. Het buitenspouwblad heeft nu geen speling meer en is kritiek.

### Wat als de kozijnen niet op 14 juli komen

Zonder die constraint kunnen de kozijnen op vrijdag 9 juli beginnen en staat de oplevering op woensdag 25 augustus. Het buitenspouwblad heeft dan maar 2 werkdagen speling.

- Zonder *smoothing* schuift het buitenspouwblad nog steeds 5 werkdagen. Nu moeten de kozijnen wachten: ze beginnen op 14 juli, 3 werkdagen later. Alles erna schuift mee en de oplevering gaat van 25 augustus naar 30 augustus, ook 3 werkdagen later.
- Met *smoothing* verschuift er niets. Het buitenspouwblad past niet binnen zijn 2 werkdagen speling. Het venster toont het conflict *Buitenspouwblad metselen*, 5 dag(en), met de reden *Onvoldoende vrije capaciteit binnen de speling om dit conflict op te lossen.*

### Wat als het buitenspouwblad voorrang krijgt

Geef je het buitenspouwblad prioriteit *Hoog* (900), dan komt het eerst aan de beurt. Het blijft op 29 juni staan en nu wijkt het binnenspouwblad: 6 werkdagen later, van 7 juli tot en met 13 juli. Het binnenspouwblad heeft maar 3 werkdagen speling, dus 6 werkdagen verschuiven is 3 te veel. De dakelementen, de kozijnen en alles erna schuiven mee. De oplevering gaat van maandag 30 augustus naar donderdag 2 september. Dezelfde overbezetting geeft dus een andere einddatum, afhankelijk van welke taak blijft staan.

### Wat als er een tweede metselaar komt

Zet je *Max. eenheden* van de metselaar op 2, dan is er geen overbezetting meer. *Berekenen* meldt *Geen taken hoeven te verschuiven — de planning is al conflictvrij.*

## Gevolgen en misverstanden

**"Nivelleren zoekt de kortste planning."** Nee. De app werkt taak voor taak volgens een vaste volgorde en zoekt niet naar de beste totaaloplossing. Zie het voorbeeld met de voorrang: een andere prioriteit geeft een andere einddatum.

**"Een genivelleerde taak is veilig."** Nivelleren gebruikt speling. De verschoven taak heeft daarna minder of geen speling meer en kan kritiek worden, zoals het buitenspouwblad hierboven. Loopt het dan uit, dan schuift de oplevering.

**"Nivelleren volgt mijn latere wijzigingen."** Nee. De vertraging is een vast aantal werkdagen. Wordt het binnenspouwblad na het nivelleren korter, dan begint het buitenspouwblad nog steeds 5 werkdagen later, ook al hoeft dat niet meer. Nivelleer dan opnieuw. De app begint dan van voren af aan.

**Niet alles is op te lossen door te schuiven.** Werkt de resource niet op de dagen die de taak nodig heeft, of vraagt de taak door haar curve op één dag meer dan de resource kan leveren, dan blijft de overbezetting. De app zegt dan bij de taak waarom.

**Materiaal wordt niet genivelleerd.** Vraagt materiaal op een dag meer dan zijn capaciteit, dan meldt de app dat als overbezetting, maar nivelleren laat het staan.

**Taken die je in uren plant en korter zijn dan een werkdag, tellen niet mee.** Zo ook de kraaninzet van 5 uur uit tutorial 4. Ze staan niet in het histogram, tellen niet mee voor de overbezetting en de nivelleerder ziet ze dus ook niet.

**Vastgepinde taken.** Staan alle taken die botsen op prioriteit 1000, dan zegt het venster niet dat er nog een overbezetting is. Kijk na het toepassen dus naar de melding *Overallocatie* in het lint.

## Zie ook

- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): de stappen om overbezetting te vinden en te nivelleren.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat speling is en waarom een taak kritiek wordt.
- [Werkregels: duur, inzet en werk](docs://uitleg-werkregels): hoe de duur van een taak meebeweegt met de inzet.
