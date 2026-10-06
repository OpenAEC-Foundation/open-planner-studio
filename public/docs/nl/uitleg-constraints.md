# Constraints en deadlines

De stenen worden pas op 21 juni geleverd. De vergunning is nog niet binnen. Het dak moet dicht zijn voor de bouwvak. Relaties leggen vast dat een taak op een andere taak wacht, maar zulke afspraken over een datum volgen niet uit de volgorde van het werk. Daarvoor zijn constraints en deadlines. In dit artikel lees je wat elk type doet, wanneer een taak verschuift en wanneer alleen de speling verandert, wat een harde pin is, en hoe de app een conflict meldt.

De regels en voorbeelden gelden voor een nieuw project, met rekenprofiel *Open Planner Studio* en een werkweek van maandag tot en met vrijdag.

## Het begrip

Een **constraint** (beperking) is een datumgrens op één taak, los van zijn relaties. Zo'n grens kan op twee manieren werken:

- Hij **duwt**: de taak mag niet eerder beginnen of eindigen dan de datum. Begint de taak op grond van zijn relaties eerder, dan schuift hij naar de datum.
- Hij **bewaakt**: de taak moet uiterlijk op de datum beginnen of eindigen. De app verschuift niets. Haalt de planning de datum niet, dan wordt de **speling** van de taak en van de keten ervoor negatief. Speling is de ruimte die een taak heeft voordat de einddatum van het project opschuift; negatief betekent dat je op papier al te laat bent (zie [Kritiek pad en speling](docs://uitleg-kritiek-pad)).

Een **deadline** is een eenvoudiger vorm van bewaken: een streefdatum voor het einde van een taak, zonder dat de taak ergens door wordt verschoven.

Alle constraints zijn **zacht**: de berekening blijft doorlopen, ook als een datum niet gehaald wordt. Eén uitzondering is de **harde pin**, die de relaties overschrijft. Daarover straks meer.

## Hoe de app rekent

### De acht typen

Je kiest het type bij *Constraint* in het paneel *Eigenschappen*. Hoe elk type rekent:

- *Zo vroeg mogelijk (ASAP)*: geen grens. Dit is de standaard: de taak begint zodra zijn relaties dat toelaten.
- *Zo laat mogelijk (ALAP)*: de taak schuift zo laat als kan zonder dat een opvolger later hoeft te beginnen. Hij gebruikt dus zijn vrije speling op. Heeft hij daarna nog totale speling, omdat zijn opvolgers zelf ruimte hebben, dan blijft hij niet-kritiek; is ook die op, dan telt hij als kritiek.
- *Start niet eerder dan (SNET)*: een ondergrens voor de start. Zou de taak eerder beginnen, dan schuift hij naar de datum; ligt de datum eerder dan wat de relaties toelaten, dan doet de constraint niets.
- *Eindig niet eerder dan (FNET)*: hetzelfde, maar voor het einde van de taak.
- *Start niet later dan (SNLT)* en *Eindig niet later dan (FNLT)*: een bovengrens voor de start of het einde. Ze verschuiven niets. Wordt de grens niet gehaald, dan meldt de app een geschonden constraint en wordt de speling negatief.
- *Moet starten op (MSO)* en *Moet eindigen op (MFO)*: een ondergrens én een bovengrens tegelijk. De taak schuift naar de datum als die later is dan zijn relaties eisen. Ligt de datum eerder dan wat de relaties toelaten, dan blijft de taak staan waar de relaties hem zetten, en wordt de speling negatief.

Valt een datum op een zaterdag, zondag of vrije dag, dan leest de app hem als een werkdag: een ondergrens (SNET, FNET) als de eerstvolgende werkdag, een bovengrens (SNLT, FNLT) als de vorige.

### Wat negatieve speling betekent

Een bovengrens werkt achterwaarts. Ligt de late datum van een taak door de constraint eerder dan zijn vroegste datum, dan wordt de totale speling negatief. Dat geldt ook voor de taken ervoor: als het metselwerk uiterlijk vrijdag 11 juni moet beginnen en het kan niet eerder dan maandag 14 juni, dan zijn ook de taken vóór het metselwerk een werkdag te laat. Alle taken met negatieve speling zijn kritiek; hoe dat werkt staat in [Kritiek pad en speling](docs://uitleg-kritiek-pad).

De balken verschuiven niet door een bovengrens. Je ziet het conflict aan de negatieve *Totale speling*, aan een rood ruitje boven de balk, aan de melding in de statusbalk (bijvoorbeeld *1 constraint(s) geschonden*) en in het paneel *Waarschuwingen*.

### De harde pin

Bij MSO en MFO verschijnt het vinkje *Verplicht (pin logica)*. Met dat vinkje zet je de taak vast op de datum, ook als zijn voorgangers dan nog niet klaar zijn. De relaties worden overschreden:

- De taak staat op de datum (bij MSO begint hij daar, bij MFO eindigt hij daar) en overlapt met zijn voorgangers.
- De voorgangers krijgen negatieve speling en de app meldt een geschonden constraint zodra de relaties de taak later zouden laten beginnen dan de pin. Zelf houdt de gepinde taak 0 speling.
- De opvolgers rekenen vanaf de gepinde taak. Ze kunnen daardoor eerder beginnen dan zonder pin, ook al is de logica ervoor nog niet af. In het voorbeeld hieronder schuift het einde van het project daardoor drie werkdagen naar voren.

De eerste keer dat je de pin aanzet, toont de app een korte toelichting: een harde pin overschrijft de relaties, de balk wordt op de datum vastgezet, ook vóór zijn voorgangers.

### De secundaire constraint

Een taak heeft één primaire constraint. Wil je ook een tweede grens, bijvoorbeeld een taak die niet vóór 14 juni mag beginnen en uiterlijk 17 juni klaar moet zijn, dan voeg je een **secundaire constraint** toe. Die moet een echte grens zijn (SNET, FNET, SNLT of FNLT) en in de andere richting begrenzen dan de primaire: een ondergrens (SNET of FNET) met een bovengrens (SNLT of FNLT). SNET met SNLT mag dus, SNET met FNET niet. Andere combinaties markeert de app in rood met de reden, bijvoorbeeld *Primair en secundair mogen niet dezelfde zijde begrenzen.* Bij ASAP, ALAP, MSO, MFO en een harde pin is een secundaire constraint niet toegestaan.

### De deadline

Een deadline is een aparte datum op een taak, naast de constraint. Hij is een bovengrens op het einde: verschuift niets, maar laat de speling negatief worden als de taak er niet op tijd klaar voor is. Dan meldt de app in het paneel *Waarschuwingen* *Deadline … overschreden — vroegste einde …* en de statusbalk telt de overschreden deadlines. In de Gantt staat een pijl omlaag op de deadlinedatum: groen zolang de taak op tijd klaar is, rood zodra hij te laat is. Een deadline op een zaterdag telt tot en met de vrijdag ervoor.

Voor de speling doet een deadline hetzelfde als FNLT. Het verschil zit in het gebruik. Een deadline is een streefdatum die je wilt bewaken; hij staat los van de constraint, dus een taak kan een constraint én een deadline hebben. FNLT is een constraint: een overtreding verschijnt als geschonden constraint in plaats van als overschreden deadline.

### Wat een constraint niet doet

- Op een **fase** (samenvattingstaak) telt een constraint of deadline niet mee: de app rekent met de taken in de fase. Zet hem op de taak zelf.
- Een taak die al een werkelijke start of voortgang heeft, houdt die start. Een SNET met een latere datum verschuift hem dan niet.
- Een **startdatum typen** bij een taak met een voorganger werkt niet als vaste start: de voorganger blijft bepalen. Daarom maakt de app er een SNET van op de ingetypte datum, in het paneel *Eigenschappen*, in *Taak bewerken*, in de tabel en bij het verschuiven van de balk in de Gantt. De app meldt dat. Heeft de taak al een andere constraint (bijvoorbeeld ALAP of MSO), dan past de app de nieuwe start niet toe en meldt dat ook; pas dan die constraint aan.

Alle veranderingen komen pas in beeld na **Bereken** (F5).

## Rekenvoorbeeld

Het voorbeeld is een klein netwerk voor een aanbouw. Het begint op maandag 7 juni 2027:

- *Grondwerk* (3 werkdagen): maandag 7 tot en met woensdag 9 juni.
- *Fundering storten* (2): donderdag 10 en vrijdag 11 juni.
- *Metselen* (5): maandag 14 tot en met vrijdag 18 juni.
- *Dakwerk* (3): maandag 21 tot en met woensdag 23 juni.
- *Steigers* (2): volgt op *Fundering storten* en gaat vóór *Dakwerk*. Het loopt maandag 14 en dinsdag 15 juni en heeft 3 werkdagen speling.

Het kritieke pad is *Grondwerk*, *Fundering storten*, *Metselen* en *Dakwerk*. Het project is klaar op woensdag 23 juni. Wat verandert er bij één constraint op *Metselen*?

- **SNET maandag 21 juni** (de stenen komen pas dan): *Metselen* loopt van maandag 21 tot en met vrijdag 25 juni, *Dakwerk* van maandag 28 tot en met woensdag 30 juni. Het project is klaar op woensdag 30 juni. *Grondwerk* en *Fundering storten* hebben nu 5 werkdagen speling en zijn niet meer kritiek, *Steigers* heeft er 8.
- **SNET woensdag 9 juni**: geen effect. De relaties laten *Metselen* toch pas op maandag 14 juni beginnen.
- **SNLT woensdag 16 juni**: geen effect. *Metselen* begint op maandag 14 juni en haalt de grens ruim.
- **SNLT vrijdag 11 juni**: te krap. *Metselen* begint nog steeds op maandag 14 juni, één werkdag te laat. *Grondwerk*, *Fundering storten* en *Metselen* krijgen −1 werkdag speling en de app meldt *Constraint Start niet later dan (SNLT) 11-06-2027 wordt door de logica overschreden (negatieve speling)*. Er verschuift niets.
- **MSO woensdag 16 juni** (zonder harde pin): *Metselen* schuift naar woensdag 16 juni en is klaar op dinsdag 22 juni. *Dakwerk* loopt van woensdag 23 tot en met vrijdag 25 juni, het project is klaar op vrijdag 25 juni.
- **MSO vrijdag 11 juni** (zonder harde pin): de datum ligt vóór wat de relaties toelaten. *Metselen* begint toch op maandag 14 juni en de speling wordt −1, net als bij SNLT.
- **MSO woensdag 9 juni met harde pin**: *Metselen* start op woensdag 9 juni en is klaar op dinsdag 15 juni, terwijl *Fundering storten* nog tot vrijdag 11 juni loopt. *Dakwerk* loopt van woensdag 16 tot en met vrijdag 18 juni: het project is drie werkdagen eerder klaar dan zonder pin. *Grondwerk* en *Fundering storten* krijgen −3 werkdagen speling.

En met een constraint of deadline op een andere taak:

- **ALAP op** *Steigers*: de taak schuift naar donderdag 17 en vrijdag 18 juni, het laatste moment vóór *Dakwerk*. *Dakwerk* is zijn enige opvolger en had ruimte voor precies zijn 3 werkdagen speling; die zijn nu op en *Steigers* is kritiek.
- **SNET zaterdag 19 juni op** *Steigers*: de grens telt als maandag 21 juni. *Steigers* loopt maandag 21 en dinsdag 22 juni en *Dakwerk* schuift mee naar woensdag 23 tot en met vrijdag 25 juni.
- **Deadline vrijdag 18 juni op** *Dakwerk*: er verschuift niets, *Dakwerk* blijft op maandag 21 tot en met woensdag 23 juni. *Grondwerk*, *Fundering storten*, *Metselen* en *Dakwerk* krijgen −3 werkdagen speling en de app meldt *Deadline 18-06-2027 overschreden — vroegste einde 23-06-2027*. *Steigers* houdt nog 0 werkdagen speling over en wordt ook kritiek.
- **SNET maandag 21 juni op** *Metselen*, **deadline vrijdag 25 juni op** *Dakwerk*: de constraint duwt het metselwerk een week op, en de deadline meldt dat *Dakwerk* op woensdag 30 juni te laat is. *Metselen* en *Dakwerk* krijgen −3 werkdagen speling; *Grondwerk* en *Fundering storten* houden 2 werkdagen.

In tutorial 3 zet je zelf een constraint en een deadline in het tutorialproject en zie je hoe de planning verschuift.

## Gevolgen en misverstanden

**"Een constraint verplaatst de taak."** Alleen SNET, FNET, MSO en MFO kunnen een taak later zetten dan zijn relaties doen, en ALAP kan hem opschuiven binnen zijn vrije speling. SNLT en FNLT verplaatsen nooit iets: ze waarschuwen alleen. De datum halen betekent dan de keten ervoor korter maken.

**"Negatieve speling is een fout van de app."** Het is het signaal dat de planning conflicteert met je datumafspraak. Je lost het op door de keten korter te maken, de afspraak te versoepelen, of het conflict bewust te accepteren.

**"Een harde pin lost het conflict op."** Een harde pin verbergt het conflict: de taak staat op de datum, maar zijn voorgangers zijn er nog niet klaar voor, en de opvolgers rekenen alsof dat wel zo is. Gebruik hem alleen voor een datum die echt vaststaat, zoals een wettelijke opleverdatum, en niet als middel om een taak op een datum te krijgen.

**"Ik typ gewoon een startdatum."** Bij een taak met een voorganger wordt dat een SNET. Ligt die datum vóór wat de voorganger toelaat, dan doet hij niets.

**"Deadline of FNLT?"** Kies een deadline voor een streefdatum die je wilt bewaken, en een constraint voor een datum die echt een randvoorwaarde voor de planning is.

**"Een constraint op de fase."** Die telt niet. Zet hem op de taak zelf.

## Zie ook

- [Een constraint of deadline zetten](docs://howto-constraint-deadline-zetten): de stappen om een constraint of deadline in te stellen.
- [Relaties en lag](docs://uitleg-relaties): de afhankelijkheden waar constraints naast staan.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): hoe negatieve speling ontstaat en wat het met het kritieke pad doet.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): een harde pin (*Moet starten op*) op *Municipal road closure (permitted closure period)* en een secundaire constraint (*Start niet later dan*) op *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): een deadline die niet gehaald wordt, met negatieve speling.
