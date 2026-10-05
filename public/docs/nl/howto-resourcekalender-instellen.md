# Een resourcekalender instellen

Doel: vastleggen op welke dagen een resource beschikbaar is, zodat het histogram, de overbezetting en het nivelleren daarmee rekenen.

## Wanneer je dit nodig hebt

De metselploeg werkt alleen van maandag tot en met donderdag. De kraan staat de eerste twee weken van augustus op een ander project. Een onderaannemer heeft vier vaste werkdagen. Zonder eigen kalender gaat de app ervan uit dat de resource werkt op de dagen van de projectkalender.

Een resourcekalender verandert geen enkele taakdatum. Hij bepaalt alleen wanneer de resource beschikbaar is. Werkt een taak op een dag waarop de resource niet werkt, dan is de capaciteit die dag 0 en telt de dag als overbezet. Wil je dat de taak zelf op andere dagen loopt, geef dan de taak een eigen kalender ([Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen)). Het verschil staat in [Kalenders en werkdagen](docs://uitleg-kalenders).

## Stappen

### Een nieuwe resourcekalender maken

1. Kies *Resources › Beheer › Resources*. Het resourcepaneel opent. Bestaat de resource nog niet, maak hem dan aan met *Nieuwe resource in het project*.
2. Zoek de rij van de resource. In de kolom *Kalender* staat standaard *Projectkalender*: de resource volgt dan de projectkalender.
3. Kies in die keuzelijst *+ Resourcekalender*. Het venster *Resourcekalender* opent. Het heeft dezelfde velden als het kalenderformulier: *Naam*, *Werkdagen*, de werktijden en de *Feestdagen*. De nieuwe kalender begint als een kopie van de standaardkalender en heet *Resourcekalender*.
4. Geef de kalender een naam die past bij de resource, bijvoorbeeld *Metselploeg ma-do*, en zet de werkdagen goed: klik bij *Werkdagen* de vrijdag uit. Vakantie of stilstand zet je in de lijst *Feestdagen* met *Feestdag toevoegen*.
5. Klik op *Toepassen*. De kalender staat nu in de bibliotheek van het project en is aan de resource gekoppeld, in één stap die je met *Ongedaan* terugdraait. Met *Annuleren* is er niets aangemaakt.

### Een bestaande kalender kiezen of aanpassen

Kies in de kolom *Kalender* een kalender uit de lijst. *Projectkalender* haalt de eigen kalender weer weg. Wil je de gekozen kalender aanpassen, klik dan op het potlood naast de keuzelijst (*Bewerken…*). Het venster *Resourcekalender* opent met de huidige kalender.

### De uitkomst bekijken

1. Staat de statusbalk op *Verouderd — herbereken (F5)*, druk dan op **Bereken** (F5).
2. Kies *Resources › Histogram › Histogram* en klik in de lijst links van het histogram op de resource. De dagen waarop de resource niet werkt maar wel is ingepland, staan rood. Houd je de muis erboven, dan meldt de balk bijvoorbeeld *Werkt volgens kalender "Metselploeg ma-do" niet op deze dag*.
3. Bij *Resources › Overallocatie* staat het aantal overbezette resources, en de statusbalk meldt bijvoorbeeld *1 resource(s) overbezet*.

## Valkuilen en wat de app dan doet

**Alleen de dagen tellen, niet de uren.** Een resourcekalender bepaalt op welke dagen de resource werkt. Hoeveel eenheden er die dag beschikbaar zijn, volgt uit *Max. eenheden* van de resource, niet uit de werktijden in de kalender.

**Nivelleren lost dit niet altijd op.** Ligt in geen enkel venster elke dag van de taak op een werkdag van de resource, dan helpt schuiven niet. Kies *Resources › Nivellering › Nivelleren…* en klik op *Berekenen*. De taak staat dan bij *Resterende conflicten*, met de reden *De resource werkt niet op alle dagen die deze taak nodig heeft — verschuiven lost dit niet op.* Wijs de taak dan aan een andere resource toe of geef hem zelf een eigen kalender.

**Een gedeelde kalender.** De keuzelijst toont alle kalenders van het project, dus ook de projectkalender en de kalenders van taken. Pas je zo'n kalender met het potlood aan, dan verandert de planning van de taken die hem gebruiken mee, en meldt de statusbalk *Verouderd — herbereken (F5)*. Maak liever een eigen kalender voor de resource.

**Overbezetting is niet altijd de kalender.** Ook een resource die op alle dagen werkt, kan overbezet zijn: de tooltip noemt de kalender alleen als de dag geen werkdag van de resource is.

## Zie ook

- [Kalenders en werkdagen](docs://uitleg-kalenders): waarom een resourcekalender geen datums verschuift.
- [Een kalender maken en toewijzen](docs://howto-kalender-maken-en-toewijzen): de velden van het kalenderformulier.
- [Feestdagen en bouwvak genereren](docs://howto-feestdagen-genereren): vakantie en feestdagen in de kalender zetten.
- [Kalendervensters](docs://ref-kalenders): alle velden van de kalendervensters.
