# Een rekenprofiel kiezen of samenstellen

Doel: bepalen met welke rekenregels een project rekent. Je kiest een ingebouwd profiel, of je maakt een eigen profiel met je eigen conventies.

## Wanneer je dit nodig hebt

Je opent een project dat als Primavera P6 of Microsoft Project moet rekenen, of je wilt één conventie anders zetten dan het profiel doet. Wat een profiel is en waarom de datums kunnen verschuiven, staat in [Rekenprofielen en conventies](docs://uitleg-rekenprofielen).

## Stappen

### Een profiel kiezen voor een nieuw project

1. Kies *Start › Bestand › Nieuw*. Het venster *Nieuw project* opent.
2. Kies in de keuzelijst *Rekenprofiel* het profiel: *Open Planner Studio*, *Primavera P6* of *Microsoft Project*.
3. Maak het project. De app vervangt de reken-opties die je al had ingevuld door de standaard van het profiel.

### Het profiel van een bestaand project wisselen

1. Kies *Instellingen › Project › Projectinstellingen*. Je kunt ook *Bestand › Projectinstellingen* kiezen.
2. Open in het blok *Rekenprofiel en reken-opties* de keuzelijst *Rekenprofiel* en kies een ander profiel.
3. Klik op **Toepassen**. De app rekent de planning meteen opnieuw door, ook als *Automatisch berekenen* uit staat. Zijn er taken verschoven, dan meldt de app hoeveel.

Tot je op *Toepassen* drukt, staat de wijziging alleen in het formulier. De hele wissel is één stap voor *Ongedaan maken*. Wisselen verandert alleen de conventies; je reken-opties blijven staan.

### Een eigen profiel samenstellen

1. Klik in het blok *Rekenprofiel en reken-opties* op *Nieuw profiel*, naast de keuzelijst.
2. Vul een naam in. De app stelt *Kopie van* het gekozen profiel voor, bijvoorbeeld *Kopie van Open Planner Studio*.
3. Klik op *Maken*. Het deel *Conventies van dit profiel* klapt open.
4. Zet de conventies aan of uit met de keuzevakjes. Het i-icoon achter een regel toont de uitleg van die conventie. Een conventie die afwijkt van de basis krijgt het label *terug naar basis*.
5. Klik op **Toepassen**. Pas dan rekent het project met het nieuwe profiel.

De drie ingebouwde profielen zijn niet te wijzigen. Hun conventies staan er alleen ter informatie.

### Een eigen profiel bewaren als sjabloon

1. Geef het eigen profiel zo nodig een andere naam in het veld *Naam van dit eigen profiel*.
2. Klik op *Opslaan als sjabloon*. De app meldt dat het sjabloon is opgeslagen, of waarom dat niet lukte.
3. In een ander project in dezelfde app staat het sjabloon in de keuzelijst *Rekenprofiel*.

Wijkt het profiel later af van het sjabloon, dan zegt een geel blok dat. Kies dan *Sjabloon bijwerken vanuit dit project* of *Bijwerken vanuit sjabloon*.

Een sjabloon verwijder je met *Sjabloon verwijderen*. De app vraagt eerst om bevestiging.

## Resultaat controleren

- Het blok *Rekenprofiel en reken-opties* toont het gekozen profiel.
- Verschoven taken meldt de app na *Toepassen*, bijvoorbeeld *Na het toepassen zijn 4 taken verschoven.*
- Een oranje blok boven de reken-opties zegt dat je reken-opties afwijken van de standaard van het profiel. Dat is vaak bewust. Wil je de standaard toch, klik dan op *Standaardinstellingen van … gebruiken*.

## Valkuilen en wat de app dan doet

**De datums verschuiven.** Een ander profiel kan echte datums veranderen. Controleer het resultaat. Bevalt het niet, kies dan *Ongedaan maken*: profiel en datums gaan samen terug.

**Een geel blok na Ongedaan maken.** Druk je *Ongedaan maken* of *Opnieuw* terwijl Projectinstellingen open staat, dan volgt het blok de stand van het project. Had je in het blok zelf al iets gewijzigd, dan blijft jouw keuze staan. Een geel blok zegt dan dat *Toepassen* die keuze terugzet.

**Er kunnen maximaal 100 sjablonen zijn.** Zijn er al 100, dan slaat de app het sjabloon niet op en meldt de app dat. Verwijder eerst een sjabloon. Ook een volle of ontbrekende opslag van de app geeft een melding.

**Sjablonen horen bij de app, het profiel bij het project.** Het project draagt altijd zijn eigen kopie van het profiel. Pas je later het sjabloon aan, dan verandert het project niet mee.

**Instellingen uit een bronbestand.** Kies je *Primavera P6* of *Microsoft Project* voor een project dat uit een ander bestand komt, dan blijven de instellingen uit het bronbestand staan. Je kunt ze hier niet wijzigen.

## Zie ook

- [Rekenprofielen en conventies](docs://uitleg-rekenprofielen): wat een profiel is en wat het met datums doet.
- [Rekenopties en conventies](docs://ref-rekenopties-en-conventies): alle conventies en reken-opties op een rij.
- [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen): Retained Logic of Progress Override, los van het profiel.
