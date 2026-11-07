# Feestdagen en bouwvak genereren

Doel: de feestdagen van een land, en eventueel de bouwvak, in een kalender laten invullen, en zo nodig zelf een vrije dag of periode toevoegen.

## Wanneer je dit nodig hebt

Zonder feestdagen plant de app gewoon werk op Kerst of Koningsdag. Een nieuw project krijgt de Nederlandse feestdagen al mee, zolang *Bouwmodus* aan staat. Je genereert opnieuw als je een ander land of een andere regio nodig hebt, als je de bouwvak wilt meenemen, of als je project buiten de jaren valt waarvoor feestdagen zijn aangemaakt. Die jaren zijn belangrijk: een dag buiten die jaren is voor de app gewoon een werkdag. Hoe de app een feestdag meeneemt bij het tellen, lees je in [Kalendervensters](docs://ref-kalenders).

De **bouwvak** is de collectieve vakantie in de bouw, drie weken in de zomer. In de app staat hij standaard uit.

## Stappen

### Feestdagen genereren

1. Kies *Planning › Kalender › Kalender* en kies links de kalender waar de feestdagen in moeten.
2. Klik op *Feestdagen genereren…*. Onder de knop opent een blok met de keuzes.
3. Kies het *Land*: Nederland, Duitsland, België, Frankrijk, Verenigd Koninkrijk, Oostenrijk, Zwitserland, Verenigde Staten, of *Geen feestdagen*. Bij een aantal landen komt er een keuzelijst *Regio* bij, bijvoorbeeld een deelstaat in Duitsland. *Landelijk* laat alleen de feestdagen over die overal gelden.
4. Kies bij Nederland de *Bouwvak*: *Geen* (standaard), *Noord*, *Midden* of *Zuid*. De bouwvak komt als één periode in de lijst, bijvoorbeeld *Bouwvak (Noord)*, drie weken van maandag tot en met vrijdag. Deze keuze zie je alleen als *Bouwmodus* aan staat.
5. Onder de keuzes staat een samenvatting, zoals *21 feestdagen, 2026–2028*. Klik erop om de datums te zien.
6. Klik op *Genereren*. De lijst *Feestdagen* is nu gevuld.
7. Klik op *Toepassen*. De app rekent de planning meteen opnieuw door.

Bij Nederland zet de app per jaar Nieuwjaar, Goede Vrijdag, Pasen (twee dagen), Koningsdag, Hemelvaart, Pinksteren (twee dagen) en Kerst (25 en 26 december) in de lijst. Valt Koningsdag op een zondag, dan staat hij op 26 april. Bevrijdingsdag staat er alleen in lustrumjaren, zoals 2025 en 2030.

Bij de Verenigde Staten zet de app per jaar de 11 federale feestdagen in de lijst: New Year's Day, Martin Luther King Jr. Day, Washington's Birthday (Presidents' Day), Memorial Day, Juneteenth (vanaf 2021), Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving Day en Christmas Day. Valt een vaste datum op een zaterdag, dan is de vrije dag de vrijdag ervoor; valt hij op een zondag, dan de maandag erna. In 2026 is Independence Day dus vrijdag 3 juli. Dit is de regel voor federale medewerkers. Private bedrijven hoeven hem niet te volgen en niet elk bedrijf geeft alle 11 dagen vrij; vooral Columbus Day en Veterans Day wordt vaak gewerkt. Vergelijk de lijst met de afspraken van je opdrachtgever of de cao en haal de dagen weg die jouw project werkt. Feestdagen van een staat en Inauguration Day (alleen in de regio Washington DC) staan er niet bij; voeg ze zelf toe als vrije dag als je project ze nodig heeft.

De jaren volgen de projectperiode: van het jaar vóór de startdatum tot en met het jaar na het latere van de ingevulde einddatum en het laatst berekende projecteinde. Ontbreken beide, dan tot drie jaar na het jaar van de start. Dit geldt ook voor *Feestdagen genereren…* en *Opnieuw genereren* in het venster *Resourcekalender*. Heb je taken gewijzigd, druk dan eerst op **Bereken** (F5) om hun nieuwe einde te gebruiken. Start en de ingevulde einddatum pas je aan onder *Instellingen › Project › Projectinstellingen*.

### Opnieuw genereren na een nieuwe projectperiode

Verschuift je project, of krijgt het een latere einddatum, dan dekken de feestdagen de nieuwe jaren niet meer. De app meldt dat in het venster *Kalenders*, bijvoorbeeld *Feestdagen dekken 2025–2028; opnieuw genereren tot en met 2030?* Klik dan op *Opnieuw genereren*. De app gebruikt dezelfde keuzes als de vorige keer (land, regio, bouwvak) voor de jaren van het project. Klik daarna op *Toepassen*. Deze melding zie je alleen bij een kalender waarvan de feestdagen eerder zijn gegenereerd.

### Een eigen vrije dag of periode toevoegen

1. Klik in het venster *Kalenders* op *Feestdag toevoegen*. Onderaan de lijst komt een nieuwe regel, met de datum van vandaag bij *Van*.
2. Vul de *Omschrijving* in, bijvoorbeeld *Bedrijfsuitje*.
3. Pas *Van* aan. Laat *Tot* leeg voor één dag, of vul de laatste vrije dag in voor een periode, bijvoorbeeld voor een winterstop.
4. Klik op *Toepassen*.

Met de prullenbak achter een regel haal je een feestdag weg.

### Alle feestdagen weghalen

Kies bij *Land* de keuze *Geen feestdagen* en klik op *Genereren*. De lijst is dan leeg.

## Valkuilen en wat de app dan doet

**Genereren vervangt de hele lijst.** Ook de dagen die je zelf toevoegde, verdwijnen. Voeg ze daarna opnieuw toe.

**Goede Vrijdag staat erbij.** Werkt jouw bedrijf op Goede Vrijdag, of op Bevrijdingsdag in een lustrumjaar, verwijder die regel dan met de prullenbak.

**De bouwvakdatums zijn adviesdatums.** De app kent ze voor 2025 tot en met 2028; voor andere jaren maakt hij een grove schatting. Bij een gekozen bouwvak staat er daarom *Adviesdatums — controleer bij Bouwend Nederland*. Pas de periode zo nodig aan in de lijst.

**Een ongeldige regel.** Een regel zonder geldige *Van*, een *Tot* die vóór *Van* ligt of een onleesbare datum krijgt een rode melding, bijvoorbeeld *De einddatum ligt vóór de begindatum.* *Toepassen* is uitgeschakeld tot je het herstelt.

**Bij een nieuw project.** Het venster *Nieuw project* heeft dezelfde keuzes onder *Feestdagenset*. Met *Aangepast…* begin je zonder feestdagen; na het aanmaken opent het venster *Kalenders*, zodat je ze zelf invult.

## Zie ook

- [Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen): een eigen kalender maken waar je feestdagen in zet.
- [Kalendervensters](docs://ref-kalenders): alle velden van de kalendervensters.
- [Nieuw project en Projectinstellingen](docs://ref-projectinfo): de feestdagenset bij een nieuw project.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): de projectkalender heeft naast de feestdagen een vrije periode *Frost delay, foundations* (vorstverlet).
