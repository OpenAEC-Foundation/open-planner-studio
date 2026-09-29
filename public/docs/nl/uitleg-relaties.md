# Relaties en lag

Waarom begint het metselwerk pas als de fundering staat? En waarom schuift de dakmontage een week op als de dakelementen later geleverd worden? Dat komt door de relaties tussen je taken. In dit artikel lees je welke vier soorten relaties de app kent, wat lag en lead doen, in welke kalender een lag telt, wat er gebeurt met een relatie op een fase, en hoe de app bepaalt welke relatie de startdatum van een taak bepaalt.

De regels en voorbeelden gelden voor een nieuw project, met rekenprofiel *Open Planner Studio* en een werkweek van maandag tot en met vrijdag.

## Het begrip

Een **relatie** legt vast dat twee taken van elkaar afhangen. De eerste taak heet de **voorganger**, de tweede de **opvolger**. Een relatie is een ondergrens: de opvolger mag nooit eerder beginnen of eindigen dan de relatie toestaat, maar wel later. Heeft een taak meer voorgangers, dan wacht hij op de laatste datum die uit al die relaties komt.

Er zijn vier soorten. Ze verschillen in welk moment van de voorganger (start of einde) vastzit aan welk moment van de opvolger:

- **FS (Eind-Start).** De opvolger begint pas als de voorganger klaar is. De dakelementen gaan er pas op als de wanden staan. Dit is verreweg de meest gebruikte relatie.
- **SS (Start-Start).** De opvolger begint pas als de voorganger begonnen is. De taken mogen overlappen: het leidingwerk kan beginnen zodra het metselwerk loopt.
- **FF (Eind-Eind).** De opvolger eindigt pas als de voorganger klaar is. Het voegwerk kan niet af zijn voordat het metselwerk af is, maar het mag wel eerder beginnen.
- **SF (Start-Eind).** De opvolger eindigt pas als de voorganger begonnen is. Dit type is zeldzaam. Een voorbeeld: de tijdelijke bemaling mag pas stoppen als het metselwerk op de fundering is begonnen.

Een relatie kan daarnaast een **lag** hebben: wachttijd tussen de twee taken, zoals beton dat moet uitharden. Een negatieve lag heet een **lead**: de opvolger begint dan al voordat de voorganger klaar is, zodat de taken overlappen.

## Hoe de app rekent

### De vier soorten

De app berekent per relatie de vroegste datum waarop de opvolger kan beginnen, en neemt van alle relaties van een taak de laatste. Zonder lag rekent hij zo:

- Bij FS begint de opvolger op de eerste werkdag na het einde van de voorganger.
- Bij SS begint de opvolger op dezelfde dag als de voorganger.
- Bij FF eindigt de opvolger op dezelfde dag als de voorganger. De app telt daarvoor terug over de duur van de opvolger om de start te vinden. Een opvolger van 3 werkdagen begint dus 2 werkdagen vóór het einde van de voorganger.
- Bij SF eindigt de opvolger op de dag dat de voorganger begint. Ook hier telt de app terug over de duur van de opvolger.

Dat zijn ondergrenzen. Een opvolger begint later als een andere relatie of een constraint dat eist. Alle datums komen pas in beeld na **Bereken** (F5); zolang de statusbalk *Verouderd — herbereken (F5)* meldt, horen de balken bij de vorige berekening.

### Lag en lead

Een lag kan op drie manieren worden uitgedrukt:

- In **werkdagen** (`3` of `3d`): de app slaat vrije dagen en weekenden over. Dit is de standaard.
- In **kalenderdagen** (`3ed`, de e staat voor *elapsed*, verstreken tijd): elke dag telt mee, ook zaterdag en zondag. Dit is de eenheid voor iets dat doorloopt zonder dat er gewerkt wordt, zoals uitharden.
- Als **percentage** van de duur van de voorganger (`40%`): de app rekent dit bij elke berekening opnieuw uit en rondt af op hele dagen (2,5 dagen wordt 3).

De regel voor een lag van N werkdagen bij FS: de N werkdagen na het einde van de voorganger zijn wachttijd, en de opvolger begint op de werkdag daarna. Bij SS en FF wordt de lag bij de start respectievelijk het einde van de voorganger opgeteld. Een negatieve lag telt terug: een lead van 1 werkdag bij FS laat de opvolger beginnen op de dag waarop de voorganger klaar is.

Een lead kan een taak niet vóór de projectstart zetten. Zou dat gebeuren, dan houdt de app de opvolger op de projectstart en meldt in het paneel *Waarschuwingen*: *Lead afgekapt door de projectstart — de relatie is niet volledig benut*.

### In welke kalender telt de lag

Elke taak kan een eigen kalender hebben. Bij een lag in werkdagen maakt het uit welke kalender de werkdagen telt. De instelling *Lag-kalender* bepaalt dat, met vier keuzes: *Voorganger*, *Opvolger*, *24-uurs* en *Projectkalender*. Standaard telt de lag in de kalender van de **voorganger**. Je vindt de instelling onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, bij *Reken-opties van dit project*. De keuze hoort bij het projectbestand.

Een lag in kalenderdagen (`3ed`) telt altijd alle dagen, welke *Lag-kalender* je ook kiest.

### Relaties op samenvattingstaken

Je kunt een relatie leggen op een fase (een samenvattingstaak) in plaats van op een taak erin. De app legt die relatie intern op elke taak in de fase:

- Een fase als **voorganger** bij FS of FF: de opvolger wacht tot de laatst afgeronde taak in de fase klaar is.
- Een fase als **opvolger** bij FS of SS: elke taak in de fase wacht op de voorganger, onafhankelijk van de andere taken in de fase.
- Een fase als **voorganger** bij SS of SF: de opvolger wacht op de start van de taak in de fase die het **laatst** begint, niet op de start van de fase zelf. Dat is voorzichtiger dan je misschien verwacht: de opvolger begint nooit te vroeg, maar mogelijk later dan je bedoelt. Wil je dat de opvolger meebeweegt met de start van de fase, leg de relatie dan op de eerste taak in de fase.
- Een fase als **opvolger** bij FF of SF: elke taak in de fase moet zelf voldoen aan de eind-eis (bij FF eindigen op of na het einde van de voorganger, bij SF op of na de start van de voorganger), ook een taak die veel eerder klaar had kunnen zijn. Leg zo'n relatie liever op de laatste taak in de fase.

Een relatie tussen een taak en de fase waar hij zelf onder valt, is niet toegestaan.

### Bepalende relaties

Heeft een opvolger meer voorgangers, dan bepaalt meestal één relatie zijn startdatum: de relatie waar de opvolger geen dag eerder kan beginnen dan hij nu doet. Zo'n relatie heet **bepalend**. Bij een gelijkspel zijn er meer bepalende relaties. Een bepalende relatie herken je aan het bliksemsymbool in de kolommen *Voorgangers* en *Opvolgers* van de tabel, aan de kolom *Bepalend* (de **+** rechts in de tabelkop, onder *Relaties*) en aan de sterkere tint bij het traceren van een pad. Hoe je dat pad opent, staat in [Een pad traceren](docs://howto-pad-traceren).

Bepalend zegt iets over datums, niet over duur. Ook een korte voorganger kan bepalend zijn, bijvoorbeeld door een lange lag; je ziet dat in het voorbeeld hieronder.

## Rekenvoorbeeld

De voorbeelden gebruiken losse mini-projecten, allemaal beginnend op maandag 7 juni 2027 tenzij anders vermeld. Begrippen als kritiek pad en speling worden uitgelegd in [Kritiek pad en speling](docs://uitleg-kritiek-pad). Zelf een relatienetwerk opbouwen en nabouwen doe je in tutorial 2, "Relaties en het kritieke pad".

### Vier soorten naast elkaar

*Fundering storten* duurt 5 werkdagen: maandag 7 tot en met vrijdag 11 juni. *Wanden metselen* (5 werkdagen) volgt met FS en loopt van maandag 14 tot en met vrijdag 18 juni. Vier taken van elk 3 werkdagen hangen aan *Wanden metselen*, elk met een ander type:

- *Dakelementen plaatsen* (FS) begint maandag 21 juni, de eerste werkdag na het metselwerk, en is klaar op woensdag 23 juni.
- *Leidingwerk* (SS) begint maandag 14 juni, samen met het metselwerk, en is klaar op woensdag 16 juni.
- *Voegwerk* (FF) moet vrijdag 18 juni klaar zijn, samen met het metselwerk. Met 3 werkdagen begint het dus op woensdag 16 juni.
- *Bemaling* (SF) moet eindigen op maandag 14 juni, de dag dat het metselwerk begint. Terugtellen over 3 werkdagen (donderdag 10, vrijdag 11, maandag 14 juni) geeft een start op donderdag 10 juni.

Alleen *Dakelementen plaatsen* ligt op het kritieke pad; het project is klaar op woensdag 23 juni. *Leidingwerk*, *Voegwerk* en *Bemaling* hebben respectievelijk 5, 3 en 7 werkdagen speling.

### Lag en lead in getallen

*Fundering storten* is klaar op vrijdag 18 juni. *Wanden metselen* (2 werkdagen) volgt met FS. Wat de lag met de startdatum doet:

- Zonder lag begint het metselwerk op maandag 21 juni.
- Met lag `3` (drie werkdagen) zijn maandag 21, dinsdag 22 en woensdag 23 juni wachttijd; het metselwerk begint donderdag 24 juni.
- Met lag `3ed` (drie kalenderdagen) tellen zaterdag, zondag en maandag mee; het metselwerk begint dinsdag 22 juni.
- Met lag `-1` (lead van één werkdag) begint het metselwerk vrijdag 18 juni, op de dag dat het storten klaar is.
- Met lag `40%` is de lag 40% van 5 werkdagen, dus 2 werkdagen; het metselwerk begint woensdag 23 juni.
- Met lag `50%` is de lag 2,5 werkdag, afgerond 3 werkdagen; het metselwerk begint donderdag 24 juni.

### Welke kalender telt de lag

*Wanden metselen* (4 werkdagen) staat op de projectkalender (maandag tot en met vrijdag) en is klaar op donderdag 10 juni. *Voegwerk* (2 werkdagen) volgt met FS en lag `3`, en staat op een kalender waarin ook zaterdag en zondag werkdagen zijn. Dan hangt de startdatum af van *Lag-kalender*:

- *Voorganger* (standaard): de lag telt in de kalender van het metselwerk. Vrijdag 11, maandag 14 en dinsdag 15 juni zijn wachttijd; het voegwerk begint woensdag 16 juni.
- *Opvolger*: de lag telt in de kalender van het voegwerk. Vrijdag 11, zaterdag 12 en zondag 13 juni zijn wachttijd; het voegwerk begint maandag 14 juni.
- *24-uurs*: elke kalenderdag telt. Ook hier zijn vrijdag, zaterdag en zondag wachttijd; het voegwerk begint maandag 14 juni.
- *Projectkalender*: de lag telt in de projectkalender, net als bij *Voorganger*; het voegwerk begint woensdag 16 juni.

### Relaties op een fase

*Fundering* is een fase met twee taken: *Graven* (2 werkdagen, maandag 7 en dinsdag 8 juni) en daarna *Storten* (3 werkdagen, woensdag 9 tot en met vrijdag 11 juni). *Wanden metselen* volgt de fase *Fundering* met FS en begint maandag 14 juni: de app laat hem wachten op *Storten*, de laatst afgeronde taak.

Bij een fase als opvolger: *Vergunning* (3 werkdagen, klaar woensdag 9 juni) gaat met FS naar de fase *Ruwbouw*. De fase bevat *Wanden metselen* (4 werkdagen) en daarna *Vloer leggen* (2 werkdagen). Elke taak in de fase wacht op de vergunning: *Wanden metselen* begint donderdag 10 juni en is klaar op dinsdag 15 juni. *Vloer leggen* wacht ook op het metselwerk en loopt van woensdag 16 tot en met donderdag 17 juni.

Bij SS vanaf een fase: de fase *Afbouw* bevat *Stucwerk* (2 werkdagen, 7 en 8 juni), daarna *Schilderwerk* (3 werkdagen, 9 tot en met 11 juni) en daarna *Opleverpunten* (2 werkdagen, 14 en 15 juni). *Schoonmaak* volgt de fase met SS. Je zou een start op maandag 7 juni verwachten, maar de app laat *Schoonmaak* wachten op de start van *Opleverpunten*, de laatst beginnende taak: maandag 14 juni.

### Wat bepalend is

*Fundering storten* (2 werkdagen) loopt van maandag 7 tot en met dinsdag 8 juni. Daarna volgen twee takken:

- *Wanden metselen* (5 werkdagen): woensdag 9 tot en met dinsdag 15 juni.
- *Dakelementen bestellen* (2 werkdagen): woensdag 9 en donderdag 10 juni.

*Dakelementen plaatsen* (3 werkdagen) volgt op beide: met FS na het metselwerk, en met FS en lag `5` na het bestellen (de levertijd). Vanuit het metselwerk zou het plaatsen op woensdag 16 juni kunnen beginnen. Vanuit de bestelling zijn vrijdag 11, maandag 14, dinsdag 15, woensdag 16 en donderdag 17 juni wachttijd; het plaatsen begint vrijdag 18 juni. De relatie met de bestelling is dus bepalend, ook al is de bestelling veel korter dan het metselwerk. Het metselwerk heeft 2 werkdagen speling.

## Gevolgen en misverstanden

**"Een relatie legt taken vast."** Nee, een relatie is een ondergrens. Een opvolger begint op zijn vroegst op de datum die de relatie geeft, en later als een andere relatie of een constraint dat vraagt. Hoe constraints daarin passen, lees je in [Constraints en deadlines](docs://uitleg-constraints).

**"SS betekent dat de taken tegelijk beginnen."** SS zegt alleen dat de opvolger niet eerder mag beginnen dan de voorganger. Heeft de opvolger een andere voorganger die later klaar is, dan begint hij later.

**"Bij FF begint de opvolger op dezelfde dag."** Nee, bij FF vallen de einddatums samen. Een korte opvolger begint daardoor later dan de voorganger, zoals het voegwerk in het voorbeeld.

**"Een lag in dagen telt kalenderdagen."** Standaard telt een lag werkdagen, in de kalender van de voorganger. Voor uitharden of drogen, waar het weekend ook meetelt, gebruik je kalenderdagen (`ed`).

**"Een taak zonder relaties is geen probleem."** Een taak zonder voorganger begint op zijn geplande startdatum, en een taak zonder opvolger krijgt speling tot het einde van het project. Vergeet je een relatie, dan lijkt een taak dus veel ruimte te hebben; zie de misverstanden in [Kritiek pad en speling](docs://uitleg-kritiek-pad).

**"Een relatie op een fase is één relatie."** Voor de berekening is het een relatie per taak in de fase. Verplaats je taken in of uit een fase, dan verandert dus ook welke relaties voor die taken gelden.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): de stappen om taken aan elkaar te koppelen en een lag te zetten.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat de app met je relaties uitrekent, en waarom een taak kritiek wordt.
- [Constraints en deadlines](docs://uitleg-constraints): datumafspraken naast de relaties.
- [Een pad traceren](docs://howto-pad-traceren): de keten voor of na een taak zichtbaar maken.
- [Externe relaties naar een ander project](docs://howto-externe-relaties): relaties met een taak in een ander projectbestand.
