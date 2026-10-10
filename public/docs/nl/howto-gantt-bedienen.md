# In de Gantt slepen, pannen en zoomen

Doel: de tijdlijn met de muis bedienen: een balk verplaatsen of zijn duur aanpassen, de tijdlijn verschuiven, taken met een kader selecteren en in- en uitzoomen.

## Wanneer je dit nodig hebt

Je ziet in de Gantt dat het metselwerk twee dagen later moet beginnen, of dat de stort een dag langer duurt, en je wilt dat direct op de balk doen. Of je hebt een project van maanden en wilt snel naar de bouwvak scrollen. De muis kent daarvoor een paar gebaren. Welk gebaar wat doet, hangt af van waar je begint te slepen en van je instelling voor scrollen.

## Stappen

### Een balk verplaatsen

1. Druk op het midden van een taakbalk en sleep horizontaal. Start en einde schuiven samen op, in hele dagen; de duur blijft gelijk.
2. Laat los. De balk blijft staan op de nieuwe plek. De planning is dan verouderd: druk op *Bereken* (F5), of laat de app het zelf doen als *Automatisch berekenen* aan staat.

Heeft de taak een voorganger, dan legt de app de nieuwe start vast als constraint *Start niet eerder dan (SNET)*, en meldt dat na het loslaten. Dat geldt niet voor een taak met voortgang, een samenvattingstaak, een hammock of een handmatig geplande taak. Waarom dat zo is en wat er bij een andere constraint gebeurt, staat in [Constraints en deadlines](docs://uitleg-constraints). Sleep je terug naar de oorspronkelijke start, dan komt de oorspronkelijke constraint ook terug.

Sleep je overwegend omhoog of omlaag in plaats van opzij, dan verplaats je de taak naar een andere rij en blijven de datums staan. De richting die je in de eerste paar pixels kiest, geldt voor de hele sleepbeweging, dus één gebaar verandert nooit tegelijk datums en structuur. Zie [Structuur aanpassen](docs://howto-structuur-aanpassen).

### De duur aanpassen

1. Beweeg de muis naar de rechterrand van de balk. De cursor wordt een pijl naar links en rechts.
2. Sleep de rand. Zolang je sleept, staat er een klein pilletje in de accentkleur van het thema (standaard oranje) met de duur die de taak nu zou krijgen, bijvoorbeeld *4d*. Het loopt live mee, zodat je de nieuwe duur ziet voordat je loslaat. Bij de rechterrand staat het pilletje in de balk, bij de linkerrand net links ervan. Het pilletje toont de duur zoals de duurkolom die toont.
3. Laat los. De duur is de duur die het pilletje toonde.

De linkerrand verplaatst de start en laat het einde staan, dus de taak wordt korter of langer aan de voorkant. Daarvoor geldt dezelfde SNET-regel als bij het verplaatsen. Bij het slepen van het midden van de balk verschijnt het pilletje niet: de duur verandert dan niet.

De duur telt werkdagen van de kalender van de taak. Weekenden en vrije dagen tellen niet mee, en een taak in dagen kan niet korter worden dan één werkdag. Bij een taak in uren rondt de app af op het stapje van de tijdlijn onder je muis: minstens een uur, of een kwartier als je ver genoeg inzoomt en *Kwartieren tonen bij ver inzoomen* aan staat.

Eén sleepbeweging is één stap in *Ongedaan*, hoe lang je ook sleept. Op een gesplitste balk werken de randen anders; zie [Een taak splitsen](docs://howto-taak-splitsen).

### De tijdlijn verschuiven

Wat een sleepbeweging op lege achtergrond doet, hangt af van je scrollmodus. Die kies je in *Instellingen*, tabblad *Weergave*, onder *Gantt › Scrollen & zoomen* bij *Modus*:

- **Zoom + slepen** (standaard): sleep je op lege achtergrond met de linker muisknop, dan verschuift de tijdlijn mee met de muis, zoals een kaart. De cursor is een hand. Op een balk begint een sleep gewoon een balkgebaar.
- **Positie** en **Toetsen**: dezelfde sleepbeweging maakt een selectiekader. De tijdlijn verschuif je dan met het wiel (zie [Instellingen](docs://ref-instellingen)) of met de middelste muisknop.

**De middelste muisknop** (het wiel ingedrukt) verschuift de tijdlijn in elke modus, en ook als je op een balk begint. Het werkt niet zolang je een ander gebaar bezig hebt, zoals het verslepen van een balk.

### Taken selecteren met een kader

Een kader selecteert alle taken in de rijen die het kader raakt. Alleen de hoogte van het kader telt, niet de tijdas.

1. Begin op lege achtergrond. Bij *Zoom + slepen* houd je daarbij Ctrl ingedrukt (op een Mac ⌘); bij *Positie* en *Toetsen* is dat niet nodig.
2. Sleep over de rijen die je wilt selecteren. De selectie krijgt een kader.
3. Laat los. Met Esc tijdens het slepen breek je het kader af en blijft de selectie zoals ze was.

Meer over selecteren staat in [Taken selecteren, verwijderen en ongedaan maken](docs://howto-taken-selecteren-verwijderen). Op lege ruimte in de takenlijst zelf gebeurt er niets bij slepen.

### Inzoomen en uitzoomen

1. Gebruik *Zoomen +* en *Zoomen -* (*Start › Zoomen*), of de toetsen + en -. Het wiel zoomt ook; wanneer, hangt af van je scrollmodus (zie [Instellingen](docs://ref-instellingen)).
2. Wil je het hele project in beeld, kies dan *Beeld › Tijdschaal › Passend maken op project* of druk op Ctrl+0. *Herstellen* (op het tabblad *Beeld*) of de toets 0 zet de zoom terug op de standaard.
3. Rechts onderin de statusbalk staat de zoom in pixels per dag, bijvoorbeeld *Zoom: 15px/dag*.

Hoe verder je uitzoomt, hoe minder rasterlijnen er staan. Bij 8 pixels per dag of meer staat er een lijn voor elke dag, met een dikkere lijn op de weekgrens. Tussen 2 en 8 pixels per dag blijft alleen de weekgrens over. Onder 2 pixels per dag, op jaarniveau, zijn het alleen nog de maandgrenzen. Anders zou het canvas een egaal streeppatroon worden waarin de balken verdwijnen. De grijze weekenden en vrije dagen, en de weekbanden die om en om getint zijn, blijven op elk niveau staan; zij dragen de weekstructuur als de lijnen wegvallen. In de tijdlijnkop verschijnen de weeknummers en dagnummers pas als er ruimte voor is, en vanaf 40 pixels per dag staat er ook de weekdag voor het dagnummer.

De taaknaam staat in de balk als hij er helemaal in past. Past hij niet, bijvoorbeeld als je uitzoomt, dan staat de volledige naam rechts naast de balk.

## Valkuilen en wat de app dan doet

**De start verschuift niet.** Heeft de taak een voorganger én een andere constraint dan SNET, bijvoorbeeld *Zo laat mogelijk (ALAP)*, dan past de app het verslepen van de start niet toe. Na het loslaten meldt de app welke constraint de start tegenhoudt. Pas die constraint aan om de start te verzetten. De rechterrand werkt wel, want die verandert alleen de duur.

**Het gebaar doet iets anders.** In de relatiemodus en in de splits-modus doen balkgebaren iets anders; Esc stopt die modi. Houd je Shift ingedrukt terwijl je van een balk sleept, dan leg je een relatie in plaats van een balk te verplaatsen. Zie [Relaties leggen](docs://howto-relaties-leggen).

**In de Positie- of Toetsen-modus pant de linker muisknop niet.** Je ziet dan geen hand maar een gewone cursor. Gebruik het wiel of de middelste muisknop, of zet de modus op *Zoom + slepen*.

**Een klik in een pauze van een gesplitste balk** selecteert de taak en start geen sleepbeweging of kader.

## Zie ook

- [Rechtermuismenu's](docs://ref-contextmenus): de menu's op een balk, een rij en een groepskop.
- [Sneltoetsen](docs://ref-sneltoetsen): de toetsen voor zoomen en voor het annuleren van een gebaar.
- [Instellingen](docs://ref-instellingen): de scrollmodus en de tijdas.
- [Constraints en deadlines](docs://uitleg-constraints): waarom een verschoven start een constraint wordt.
