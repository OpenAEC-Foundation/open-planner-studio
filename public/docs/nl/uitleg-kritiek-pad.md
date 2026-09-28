# Kritiek pad en speling

Waarom is de einddatum van je project wat hij is? En welke taak mag een dag uitlopen zonder dat de oplevering schuift? Dat zijn de vragen achter het kritieke pad. In dit artikel lees je wat de app precies uitrekent, met een voorbeeld dat je zelf kunt narekenen.

## Het begrip

Een planning is een netwerk van taken met **relaties**: afspraken als "de kozijnen gaan er pas in als het dak dicht is". Door die relaties hangen taken aan elkaar vast. Sommige ketens van taken zijn langer dan andere. De langste keten bepaalt hoe lang het hele project duurt.

Die langste keten heet het **kritieke pad**. Loopt één taak op dat pad een dag uit, dan schuift de oplevering een dag op. Er zit geen ruimte in.

Taken buiten het kritieke pad hebben wél ruimte. Die ruimte heet **speling**. De metselaar die het buitenspouwblad metselt kan misschien twee dagen later beginnen zonder dat iemand daar last van heeft. Die twee dagen zijn zijn speling.

Kritiek zegt dus niets over hoe belangrijk een taak is. Het zegt alleen dat er geen tijd over is.

## Hoe de app rekent

De app rekent de planning niet vanzelf door. Je start de berekening met **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Heb je iets gewijzigd sinds de laatste berekening, dan staat in de statusbalk *Verouderd — herbereken (F5)*. Wil je dat de app dat zelf doet, zet dan *Automatisch berekenen* aan onder *Instellingen › Project › Instellingen*, tabblad *Planning*, kopje *Berekenen*.

Een berekening bestaat uit twee rondes door het netwerk.

### Voorwaarts rekenen

De app begint bij de projectstart en loopt de relaties af, van voorganger naar opvolger. Voor elke taak zoekt hij de vroegste dag waarop hij kan beginnen. Heeft een taak meer voorgangers, dan wacht hij op de laatste die klaar is. Zo ontstaan de **vroegste start** en het **vroegste einde** van elke taak. Het laatste vroegste einde van alle taken is de einddatum van het project.

### Achterwaarts rekenen

Daarna loopt de app terug, van die einddatum naar het begin. Nu zoekt hij per taak de laatste dag waarop hij klaar moet zijn zonder dat de einddatum schuift. Heeft een taak meer opvolgers, dan telt de opvolger die het eerst moet beginnen. Zo ontstaan de **laatste start** en het **laatste einde**.

### Totale en vrije speling

Het verschil tussen de laatste en de vroegste datum van een taak is zijn **totale speling**: zoveel werkdagen kan de taak uitlopen of later beginnen voordat de einddatum van het project opschuift. De app telt in werkdagen van de kalender van de taak. Een weekend of een feestdag telt dus niet mee.

**Vrije speling** is strenger. Het is de ruimte die een taak heeft voordat zijn eerste opvolger moet opschuiven. Die ruimte kun je gebruiken zonder dat een andere taak er iets van merkt. Totale speling kan gedeeld zijn: volgen twee niet-kritieke taken elkaar op, dan hebben ze samen dezelfde marge. Gebruikt de eerste die op, dan heeft de tweede niets meer. De eerste heeft dan wel totale speling, maar geen vrije speling. Het verschil tussen beide heet **interfererende speling**.

### Wanneer is een taak kritiek?

Standaard is een taak kritiek als zijn totale speling 0 is of minder. Je past dat aan onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, bij *Reken-opties van dit project*:

- **Kritiek-definitie** met *Totale speling ≤ drempel* en het veld *Drempel (werkdagen)*. Standaard is de drempel 0. Zet je hem op 2, dan telt ook elke taak met 2 werkdagen speling of minder als kritiek.
- **Bijna-kritiek markeren** met een eigen *Drempel*, standaard 2 werkdagen. Een taak met meer dan 0 maar hoogstens zoveel speling krijgt dan een amberkleurige balk. Zo zie je welke taken bijna geen marge meer hebben, zonder dat ze meetellen als kritiek.
- **Open-eind-taken kritiek**: een taak zonder opvolger die nog niet klaar is, telt dan als kritiek.
- **Speling-berekening** bepaalt of de totale speling aan de startkant of de eindkant van de taak wordt gemeten, of de kleinste van beide. Standaard staat hij op *Automatisch (standaard)*.

Deze opties horen bij het projectbestand, niet bij de app. Met *Toepassen* rekent de app de planning meteen opnieuw door. Hoe Primavera P6 en MS Project hier anders rekenen, lees je bij [Rekenprofielen](docs://gids-rekenprofielen).

### Waar je het ziet

Kritieke taken hebben een rode balk in de Gantt. Achter een niet-kritieke balk staat een groene band tot aan zijn laatste einde: dat is de speling. Die band zet je aan of uit met *Beeld › Baselines & voortgang › Spelingsband*.

Selecteer je een taak, dan staat in het paneel *Eigenschappen* onder *CPM Resultaat* alles op een rij: vroegste en laatste start en einde, totale, vrije en interfererende speling, en of de taak op het kritieke pad ligt. Wil je de speling van alle taken naast elkaar zien, voeg dan een kolom toe met de **+** rechts in de tabelkop, onder *Berekend*. Daar staan onder meer *Totale speling*, *Vrije speling*, *Kritiek* en *Bijna kritiek*.

De statusbalk onderaan telt de kritieke taken, bijvoorbeeld *Kritiek pad: 21 taken, 45 werkdagen*.

## Rekenvoorbeeld: de aanbouw

Het voorbeeld komt uit het oefenproject *Aanbouw woning* van de tutorials, in de stand na de tutorial over relaties. De uitbouw start op maandag 7 juni 2027. Na **Bereken** staat de oplevering op vrijdag 6 augustus 2027. Twee taken zijn niet kritiek: *Buitenspouwblad metselen* en *Schilderwerk*.

### Twee ketens die samenkomen

Na de ruwbouwvloer (*Kanaalplaatvloer leggen*, klaar op maandag 28 juni) splitst het werk zich in twee ketens. Beide eindigen bij *Kozijnen plaatsen*:

- De binnenkant: *Binnenspouwblad metselen* (5 werkdagen), dan *Dakelementen plaatsen* (1), dan *Dakbedekking aanbrengen* (2). De kozijnen kunnen er pas in als het dak dicht is.
- De buitenkant: *Buitenspouwblad metselen* (6 werkdagen). De kozijnen komen in de gevel, dus ook die moet klaar zijn.

**Voorwaarts.** Beide spouwbladen kunnen op dinsdag 29 juni beginnen. Het binnenspouwblad is klaar op maandag 5 juli. De dakelementen gaan erop op dinsdag 6 juli, de dakbedekking volgt op woensdag 7 en donderdag 8 juli. Het buitenspouwblad is klaar op dinsdag 6 juli. *Kozijnen plaatsen* wacht op de laatste van de twee ketens: de dakbedekking. De kozijnen beginnen dus op vrijdag 9 juli.

**Achterwaarts.** De kozijnen moeten uiterlijk op vrijdag 9 juli beginnen, anders schuift de oplevering. Dus moet het buitenspouwblad uiterlijk op donderdag 8 juli klaar zijn. Zes werkdagen terug is dat een laatste start op donderdag 1 juli.

**Speling.** Het buitenspouwblad kan vroegst op 29 juni beginnen en moet uiterlijk op 1 juli beginnen. Daartussen liggen 2 werkdagen: woensdag 30 juni en donderdag 1 juli. Dat is zijn totale speling. In het paneel *Eigenschappen* zie je bij *CPM Resultaat*: *Totale speling: 2 dagen* en *Kritiek pad: Nee*.

De binnenketen heeft geen speling. Elke dag vertraging daar schuift de kozijnen en alles erna op.

### Schilderwerk

*Schilderwerk* (3 werkdagen) begint na het stucwerk, op maandag 26 juli, en is klaar op woensdag 28 juli. De taak erna, *Opleverpunten en schoonmaken*, wacht ook op het tegelwerk. Dat is pas klaar op donderdag 5 augustus, want de dekvloer moet eerst vijf werkdagen drogen. Het schilderwerk mag dus uitlopen tot donderdag 5 augustus. Dat geeft 6 werkdagen speling: 29 en 30 juli, en 2 tot en met 5 augustus. Het weekend telt niet mee.

Bij beide taken is de vrije speling gelijk aan de totale speling (2 en 6 dagen). Hun directe opvolger ligt namelijk op het kritieke pad. Wat zij opsouperen, neemt niemand anders af.

### Wat als het buitenspouwblad uitloopt?

Zet de duur van *Buitenspouwblad metselen* eens op 8 werkdagen en druk op **Bereken**. Het buitenspouwblad is nu klaar op donderdag 8 juli, precies zijn laatste einde. De speling is op, de taak kleurt rood. Beide ketens zijn nu kritiek: de statusbalk telt 22 kritieke taken in plaats van 21. De oplevering blijft op vrijdag 6 augustus.

Maak er 9 werkdagen van. Nu is het buitenspouwblad pas op vrijdag 9 juli klaar. De kozijnen schuiven naar maandag 12 juli en de oplevering naar maandag 9 augustus: één werkdag later. De buitenketen is nu het kritieke pad. De binnenketen heeft 1 werkdag speling gekregen.

### Bijna-kritiek in het voorbeeld

Zet onder *Instellingen › Project › Projectinfo* het vinkje *Bijna-kritiek markeren* aan (drempel 2 werkdagen) en kies *Toepassen*. Het buitenspouwblad, met precies 2 dagen speling, krijgt een amberkleurige balk. Het schilderwerk, met 6 dagen, blijft blauw.

## Gevolgen en misverstanden

**"Kritiek betekent belangrijk."** Nee. Een keuring kan cruciaal zijn en toch speling hebben. Andersom kan een eenvoudige klus kritiek zijn: in het voorbeeld ligt *Opleverpunten en schoonmaken* op het kritieke pad. Kritiek gaat alleen over tijd: er is geen marge meer.

**"Deze taak heeft speling, dus die kan wel wachten."** Pas op met gedeelde speling. Heeft een taak totale speling maar geen vrije speling, dan neemt elke dag uitstel marge weg bij de taken erna.

**Een vergeten relatie geeft valse speling.** Een taak zonder opvolger krijgt speling tot aan het einde van het project. In het oefenproject zonder relaties begint alles op 7 juni en is alleen *Buitenspouwblad metselen* kritiek, omdat dat de langste taak is. Alle andere taken lijken ruimte te hebben. Controleer daarom of elke taak een opvolger heeft, of zet *Open-eind-taken kritiek* aan. In hetzelfde project worden dan alle 23 taken kritiek.

**Het kritieke pad staat niet vast.** Loopt een niet-kritieke taak meer uit dan zijn speling, dan wordt een andere keten de langste. Dat zag je hierboven bij 9 werkdagen metselwerk. Kijk dus na elke wijziging opnieuw, en druk eerst op **Bereken**. Zolang de statusbalk *Verouderd* meldt, horen de rode balken nog bij de vorige berekening.

**Speling telt in werkdagen.** Zes dagen speling kan ruim een week in de agenda zijn. Een weekend, feestdag of bouwvak in de kalender telt niet mee.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): de stappen om taken aan elkaar te koppelen en een lag te zetten.
- [Rekenprofielen](docs://gids-rekenprofielen): waarom P6 en MS Project op details anders rekenen.
- [Goed plannen](docs://gids-goed-plannen): planningsprincipes, zoals waarom elke taak een voorganger en een opvolger hoort te hebben.
