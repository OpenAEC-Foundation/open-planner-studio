# Rekenprofielen en conventies

Dezelfde planning kan andere datums opleveren, afhankelijk van welke rekenregels je toepast. In dit artikel lees je waarom Primavera P6 en Microsoft Project op een paar punten anders rekenen, hoe de app dat verschil vastlegt in een **rekenprofiel**, en wat een profiel onderscheidt van de reken-opties die je zelf per project instelt. Een uitgewerkt voorbeeld met één klein netwerk laat zien wat dat met datums doet.

## Het begrip

Taken, relaties en een kalender bepalen het meeste van een planning, maar niet alles. Wat gebeurt er met werk dat nog niet begonnen is als je een statusdatum zet? Waar begint het restwerk van een taak die al loopt? Wat is de vrije speling van een taak als een deadline niet gehaald wordt? Het netwerk zegt daar niets over. Een planningspakket moet er zelf een regel voor kiezen. De app kent een aantal punten waarop de regel van Primavera P6 en die van Microsoft Project verschillen.

Zo'n keuze noemt de app een **conventie**. Een **rekenprofiel** is de verzameling conventies die bij één pakket hoort. De app kent er drie:

- *Open Planner Studio*: het profiel waarmee een nieuw project rekent. Er staat geen enkele conventie aan.
- *Primavera P6*: de conventies die de app van P6 kent.
- *Microsoft Project*: de conventies die de app van Microsoft Project kent.

Het profiel zegt dus hoe een pakket rekent. Wat jij voor je project wilt, zit er niet in. Dat zijn de **reken-opties**: keuzes als vanaf hoeveel speling een taak kritiek is, of in welke kalender een lag telt. Die zet je per project.

## Hoe de app ermee rekent

### Conventies en reken-opties

Een conventie is een schakelaar: aan of uit. Het profiel bepaalt welke schakelaars aan staan. Een reken-optie is een keuze van jou. Het verschil zie je in de app zelf, in het blok *Rekenprofiel en reken-opties*:

- **Conventies** staan onder *Conventies van dit profiel*, gegroepeerd per onderwerp, bijvoorbeeld *Voortgang en voltooid werk*, *Relaties en lag* en *Speling en late datums*. Elke regel is een keuzevakje met erachter de waarde van het profiel (*basis: aan* of *basis: uit*). Wijkt jouw keuze daarvan af, dan valt de regel op en verschijnt *terug naar basis*. Het pijltje voor een regel klapt de uitleg van die conventie open. Lees die eerst als je een conventie wilt omzetten.
- **Reken-opties** staan onder *Reken-opties van dit project*: onder andere *Kritiek-definitie*, *Speling-berekening*, *Open-eind-taken kritiek*, *Bijna-kritiek markeren* en *Lag-kalender*. Ze zeggen wat jij voor dit project wilt, niet hoe een pakket rekent. Wat ze doen staat in [Kritiek pad en speling](docs://uitleg-kritiek-pad) en [Relaties en lag](docs://uitleg-relaties).

Een voorbeeld van elk. "Een taak is kritiek als de totale speling 0 of minder is" is een reken-optie: je kunt de drempel op 4 zetten, en dan is alles met 4 werkdagen speling of minder kritiek. "Werk dat niet begonnen is, schuift naar de statusdatum" is een conventie: Open Planner Studio en Primavera P6 doen het, Microsoft Project niet.

Profiel en reken-opties horen bij het projectbestand, niet bij de app. Sla je het project op, dan gaan ze mee. Twee projecten in dezelfde app kunnen dus met een ander profiel rekenen. Een project zonder profiel rekent als Open Planner Studio.

Staan er reken-opties die alleen Primavera kent, dan staat onderaan het blok ook *Instellingen uit het bronbestand*: bij een project uit een .xer-bestand, maar ook als je *Primavera P6* kiest in *Nieuw project* of de standaardopties van Primavera P6 toepast. Je kunt ze hier niet wijzigen.

### Waar je het profiel kiest

Bij een nieuw project staat het profiel in het venster *Nieuw project*, dat je opent via *Start › Bestand › Nieuw*. Daar is *Rekenprofiel* een keuzelijst. Kies je *Primavera P6* of *Microsoft Project*, dan zet de app meteen ook de standaard reken-opties van dat profiel. Zo staat *Speling-berekening* dan op *Finishspeling* (Primavera P6) of op *Kleinste (start/finish)* (Microsoft Project).

Bij een bestaand project kies je het profiel onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, in de keuzelijst *Rekenprofiel*. Je vindt dezelfde plek ook via *Bestand › Projectinfo*. Wisselen van profiel verandert hier alleen de conventies. Je reken-opties blijven staan. Wil je ook de standaard reken-opties van het nieuwe profiel, kies dan *Standaardopties van dit profiel toepassen*.

Tot je op *Toepassen* drukt, staat een wijziging alleen in het formulier. Met *Toepassen* rekent de app de planning meteen opnieuw door, ook als *Automatisch berekenen* uit staat. Zijn er taken verschoven, dan meldt hij hoeveel, bijvoorbeeld *Na het toepassen zijn 4 taken verschoven.* De hele wissel is één stap voor *Ongedaan maken*.

Zet je in een profiel één conventie aan of uit, dan maakt de app er een eigen profiel van. Dat heet *Kopie van Open Planner Studio*, of *Kopie van* het profiel waarmee je begon. Je kunt het een andere naam geven en het met *Opslaan als sjabloon* bewaren voor andere projecten in deze app. Het project draagt altijd zijn eigen kopie: pas je later het sjabloon aan, dan verandert het project niet mee.

### Wanneer de app zelf een profiel kiest

Bij het openen van een bestand stelt de app een profiel voor, op basis van het formaat:

- Een .mpp-bestand (Microsoft Project) opent met het profiel *Microsoft Project*.
- Een .xer-bestand (Primavera P6) opent met het profiel *Primavera P6*.
- Een bestand in het formaat *MS Project XML*, *Primavera P6 XML* of *CSV (puntkomma-gescheiden)* opent met *Open Planner Studio*, zonder profielmelding.
- Een eigen project (.ifc) opent met het profiel dat erin staat.

Bij een .mpp- of .xer-bestand meldt de app het profiel: *Dit project rekent als Microsoft Project. Aanpassen via Bestand → Projectinfo → Rekenprofiel en reken-opties.* Met de knop *Rekenprofiel openen* in de melding ga je direct naar Projectinfo. Bij een .xer-bestand staat deze regel als eerste detailregel in de openingsmelding van het bestand. Meer over de melding staat bij [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen) en [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen).

Bij een .mpp-bestand zet de app alleen het profiel. De reken-opties blijven leeg, zoals bij een nieuw project: *Speling-berekening* staat op *Automatisch (standaard)*, niet op *Kleinste (start/finish)*. Wil je de standaard reken-opties van Microsoft Project, kies dan *Standaardopties van dit profiel toepassen*.

## Rekenvoorbeeld: één netwerk, drie profielen

Het voorbeeld is een klein netwerk. De kalender heeft een werkweek van maandag tot en met vrijdag en geen vrije dagen in deze weken. De voortgangsmodus is Retained Logic (de standaard). Het project start op maandag 7 juni 2027. Alle taken staan in werkdagen.

- *Fundering storten*: 5 werkdagen, gepland vanaf maandag 7 juni.
- *Muren metselen*: 5 werkdagen, na *Fundering storten* (Eind-Start).
- *Kozijnen bestellen*: 3 werkdagen, zonder voorganger, gepland vanaf maandag 7 juni.
- *Dak plaatsen*: 2 werkdagen, na *Muren metselen* en na *Kozijnen bestellen*. Het einde van deze taak is de oplevering.

De getallen zijn nagerekend met de rekenmotor van de app. Je leest ze in het paneel *Eigenschappen* onder *CPM Resultaat*.

**Zonder statusdatum en zonder voortgang rekenen de drie profielen dit netwerk hetzelfde.** *Fundering storten* loopt van maandag 7 tot en met vrijdag 11 juni, *Muren metselen* van maandag 14 tot en met vrijdag 18 juni en *Dak plaatsen* op maandag 21 en dinsdag 22 juni. De oplevering is dinsdag 22 juni. *Kozijnen bestellen* (maandag 7 tot en met woensdag 9 juni) heeft 7 werkdagen totale speling.

Nu neem je de stand op. De statusdatum is woensdag 9 juni. De fundering is begonnen op maandag 7 juni en staat op 60 %. Het restwerk is dus 2 werkdagen (5 × 40 %). *Kozijnen bestellen* is nog niet begonnen. Hoe [voortgang en statusdatum](docs://uitleg-voortgang) werken, staat in dat artikel. Hier gaat het om wat het profiel ermee doet.

### Open Planner Studio

Het restwerk van de fundering begint op de statusdatum: woensdag 9 en donderdag 10 juni. De vroegste start blijft de werkelijke start, maandag 7 juni. Het vroegste einde is donderdag 10 juni. *Muren metselen* loopt van vrijdag 11 tot en met donderdag 17 juni en *Dak plaatsen* op vrijdag 18 en maandag 21 juni.

*Kozijnen bestellen* was gepland voor maandag 7 juni, maar is niet begonnen. Werk dat niet begonnen is, kan niet in het verleden liggen. De app schuift het daarom naar de statusdatum: woensdag 9 tot en met vrijdag 11 juni, met 4 werkdagen totale speling. De oplevering is maandag 21 juni.

### Primavera P6

Alles is gelijk aan Open Planner Studio, op één punt na: de vroegste start van *Fundering storten* is woensdag 9 juni. Dat is het begin van het restwerk, niet de werkelijke start. Dit doet de conventie *Lopende taak: vroege start = begin van het restwerk*, in de groep *Voortgang en voltooid werk*. Het einde en de speling veranderen er niet door. De oplevering is maandag 21 juni.

### Microsoft Project

Hier verschillen de datums. Twee conventies in de groep *Voortgang zoals Microsoft Project* doen dat.

*Niet-gestarte taken niet naar de statusdatum*: *Kozijnen bestellen* blijft van maandag 7 tot en met woensdag 9 juni staan, ook al ligt dat deels vóór de statusdatum. De totale speling is 7 werkdagen.

*Restwerk hervat na de al verstreken duur*: het restwerk begint niet eerder dan de statusdatum, en ook niet eerder dan de werkelijke start plus de al verstreken duur. Bij 60 % van 5 werkdagen is dat 3 werkdagen gedaan. Maandag 7 juni plus 3 werkdagen is donderdag 10 juni. Dat ligt na de statusdatum, dus het restwerk loopt donderdag 10 en vrijdag 11 juni. *Muren metselen* loopt van maandag 14 tot en met vrijdag 18 juni en *Dak plaatsen* op maandag 21 en dinsdag 22 juni. De oplevering is dinsdag 22 juni: één werkdag later dan in de andere twee profielen.

### Wat-als

**De fundering staat op 20 % in plaats van 60 %.** Het restwerk is dan 4 werkdagen. Onder alle drie de profielen eindigt de fundering op maandag 14 juni en is de oplevering woensdag 23 juni. De Microsoft Project-conventie voor het restwerk geeft hier geen verschil: maandag 7 juni plus 1 verstreken werkdag is dinsdag 8 juni, en dat ligt vóór de statusdatum. Zo'n conventie is een ondergrens die het restwerk alleen later kan maken. *Kozijnen bestellen* en de vroegste start onder Primavera P6 verschillen nog wel, zoals hierboven. Onder Microsoft Project heeft *Kozijnen bestellen* dan 8 werkdagen totale speling.

**Je zet alleen een statusdatum en vult geen voortgang in.** Onder Open Planner Studio en Primavera P6 schuift het hele netwerk naar woensdag 9 juni. De fundering loopt dan van woensdag 9 tot en met dinsdag 15 juni en de oplevering wordt donderdag 24 juni: twee werkdagen later dan zonder statusdatum. Onder Microsoft Project blijft alles staan en is de oplevering dinsdag 22 juni.

**Je stelt zelf een profiel samen.** Zet je onder Open Planner Studio alleen *Niet-gestarte taken niet naar de statusdatum* aan, dan wordt het een eigen profiel, *Kopie van Open Planner Studio*. Met de voortgang van 60 % houdt de fundering dan de datums van Open Planner Studio (einde donderdag 10 juni, oplevering maandag 21 juni). *Kozijnen bestellen* blijft wel van maandag 7 tot en met woensdag 9 juni staan, met 6 werkdagen totale speling. Een profiel is dus een bundel losse schakelaars, en je kunt ze los omzetten.

**Een reken-optie in plaats van een conventie.** Zet je onder Open Planner Studio bij *Kritiek-definitie* (*Totale speling ≤ drempel*) de *Drempel (werkdagen)* op 4, dan wordt *Kozijnen bestellen* kritiek, want de totale speling is precies 4. Geen enkele datum verandert. Een reken-optie is jouw keuze voor het project en staat los van het profiel.

**Een deadline die niet gehaald wordt.** Geef *Dak plaatsen* een deadline op vrijdag 18 juni. Onder Open Planner Studio is de totale speling van *Dak plaatsen* dan −1 werkdag en de vrije speling ook −1. Onder Primavera P6 blijft de totale speling −1, maar de vrije speling wordt 0. Dat doet de conventie *Vrije speling nooit negatief*, in de groep *Speling en late datums*. Onder Microsoft Project zijn beide −2, omdat de oplevering daar een dag later valt. Hoe een deadline werkt, staat in [Constraints en deadlines](docs://uitleg-constraints).

## Gevolgen en misverstanden

**"Het profiel is een instelling van de app."** Nee. Het profiel en de reken-opties horen bij het project en gaan mee in het bestand. Alleen de sjablonen die je bewaart zijn van de app, en een project houdt altijd zijn eigen kopie.

**"Als ik exporteer, gaat mijn profiel mee."** Alleen bij je eigen projectformaat (.ifc). Exporteer je naar *MS Project XML*, *Primavera P6 XML* of *CSV (puntkomma-gescheiden)*, dan staat het profiel niet in het bestand. Van de reken-opties schrijft de MS Project XML-export hooguit de kritiek-drempel. De app waarschuwt daar alleen voor bij een project dat uit een .xer-bestand kwam. Bij een project dat je zelf maakte, krijg je geen melding. Het bestand opent daarna als Open Planner Studio, zonder profielmelding. Neem het voorbeeld met het profiel Microsoft Project en 60 % voortgang. Exporteer je het naar *MS Project XML* en open je het weer, dan toont de app eerst de datums uit het bestand, met oplevering op dinsdag 22 juni. Laat je de app zelf opnieuw berekenen, dan wordt dat maandag 21 juni. Wat een export nog meer verliest, staat in [Bestanden en formaten](docs://uitleg-bestanden).

**"Het profiel Primavera P6 geeft dezelfde uitkomst als P6."** Dat kan de app niet beloven. Het profiel zet de conventies aan die de app van P6 kent, en dat zijn niet alle instellingen van P6. P6 kent naast Retained Logic en Progress Override bijvoorbeeld een derde voortgangsmodus, Actual Dates. Die kent de app niet: zo'n .xer-bestand rekent als Retained Logic, en de openingsmelding meldt dat, bijvoorbeeld als *1 P6-planningsinstelling met veilige terugval.* Sommige conventies van het profiel Primavera P6 werken bovendien alleen op taken die uit een .xer-bestand komen, zoals *Niet-gestarte LOE neemt het doelvenster* en *Werkelijke datums exact overnemen*. Bij een deel ervan staat dat in de uitleg: "alleen taken met P6-herkomst". Op taken die je zelf maakt, doen die conventies niets.

**"De voortgangsmodus zit in het profiel."** Nee. Retained Logic of Progress Override is een eigen keuze per project. Je zet hem los van het profiel, zie [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen). Eén Primavera P6-conventie, *Progress Override negeert een gestarte opvolger ook achterwaarts*, doet alleen iets onder Progress Override.

**"Ik wissel even van profiel om te kijken."** Dat kan, want *Toepassen* is één stap voor *Ongedaan maken*: profiel en datums gaan samen terug. Maar de datums kunnen echt verschuiven. In het voorbeeld verschuiven bij een wissel van Open Planner Studio naar Microsoft Project alle 4 de taken. De melding telt ze voor je. Bekijk daarna de planning voordat je verder werkt. Toont de app na het openen van een .xer of .mpp nog de datums uit het bestand, dan verlaat een profielwissel die weergave en rekent de app zelf. Hoe dat zit, staat in [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen).

**Het voorbeeld toont vier conventies, en de lijst in de app is langer.** Elke regel in het blok heeft een eigen uitleg. Lees die eerst. Let ook op de groep *Alleen voor eigen profielen*: die conventies staan in elk ingebouwd profiel uit, ook onder Primavera P6. Zet je er een aan, dan wordt het een eigen profiel.

## Zie ook

- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat de statusdatum en het restwerk doen, met de verschillen per profiel.
- [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen): Retained Logic of Progress Override kiezen.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): de reken-opties voor kritiek en speling.
- [Relaties en lag](docs://uitleg-relaties): de reken-optie *Lag-kalender*.
- [Bestanden en formaten](docs://uitleg-bestanden): wat een export meeneemt en wat niet.
- [Exporteren](docs://howto-exporteren): een project exporteren.
- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): percentage, werkelijke start en statusdatum invullen.
- [Datums zoals opgeslagen](docs://uitleg-datums-zoals-opgeslagen): waarom geïmporteerde datums kunnen afwijken van wat de app zelf berekent.
