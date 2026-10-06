# Taken en mijlpalen toevoegen

Doel: een nieuwe taak of mijlpaal in je planning zetten, op de plek waar hij hoort.

## Wanneer je dit nodig hebt

Je bouwt een planning op, er komt werk bij, of je wilt een moment vastleggen, zoals de oplevering of een keuring.

Een **taak** is werk dat tijd kost. Een nieuwe taak duurt standaard 5 werkdagen (bij urenplanning kan de projectstandaard uren zijn). Een **mijlpaal** is een moment zonder duur: 0 dagen. Een taak met subtaken heet een **samenvattingstaak**, in de bouw vaak een fase. Haar duur en datums volgen uit haar subtaken, zodra je **Bereken** (F5) gebruikt.

## Stappen

### Een taak toevoegen

1. Kies *Start › Taken › Taak*. Dezelfde knop staat op het tabblad *Tabel*.
2. Het paneel *Eigenschappen* gaat open en het veld *Naam* is geselecteerd. Typ de naam en druk op Enter.

De nieuwe taak heet eerst *Nieuwe taak* en begint op de projectstart.

Is er een taak geselecteerd, dan komt de nieuwe taak direct eronder, op hetzelfde niveau. Is de geselecteerde taak een samenvattingstaak, dan komt hij onder die hele fase, dus na haar subtaken. Is er niets geselecteerd, dan komt hij onderaan de lijst. De tooltip van de knop zegt welke van de twee er gebeurt: *Nieuwe taak direct onder de selectie* of *Nieuwe taak onderaan de lijst*. Selecteer je meerdere taken, dan komt er één nieuwe taak, onder de onderste van de selectie zoals je die op het scherm ziet.

### Boven of onder een bepaalde taak

Klik met de rechtermuisknop op de taak en kies *Invoegen boven* of *Invoegen onder*. Met het toetsenbord kan het ook: Insert voegt boven de geselecteerde taak in, Ctrl+I (op een Mac ⌘+I) eronder. In de takenlijst gaat na Insert de naamcel meteen open om te typen.

Bij een meervoudige selectie komt er één nieuwe taak: *Invoegen boven* zet hem boven de bovenste geselecteerde taak, *Invoegen onder* onder de onderste.

### Een subtaak toevoegen

Klik met de rechtermuisknop op de taak en kies *Subtaak toevoegen*. De nieuwe taak komt onderaan de subtaken van die taak. In de takenlijst naast de Gantt staat achter de naam van een samenvattingstaak ook een kleine **+** die hetzelfde doet.

### Een mijlpaal toevoegen

1. Kies *Start › Taken › Mijlpaal ▾* en dan *Startmijlpaal*, *Eindmijlpaal* of *Inspectiemoment (verplicht)*.
2. Typ de naam en druk op Enter. De plaatsing volgt dezelfde regel als bij *Taak*.

De drie soorten verschillen zo:

- Een *Startmijlpaal* hoort bij het begin van de dag, een *Eindmijlpaal* bij het einde van de dag. In de Gantt staat de ruit links respectievelijk rechts in de dagkolom. Dat maakt ook verschil voor de opvolger. Staat een mijlpaal op dinsdag 29 september 2026 en volgt er een taak op met een Eind-Start-relatie, dan begint die taak na een startmijlpaal op diezelfde dinsdag en na een eindmijlpaal op woensdag 30 september.
- Een *Inspectiemoment (verplicht)* is een eindmijlpaal met het taaktype *Keuring/Inspectie* en het vinkje *Verplicht (contractueel)*.

### Een bestaande taak tot mijlpaal maken

Klik met de rechtermuisknop op de taak en kies *Mijlpaal aan/uit*, of zet het vinkje *Mijlpaal* in het paneel *Eigenschappen* aan. Het menu-item werkt voor de hele selectie. De duur wordt 0.

Zet je het weer uit, dan blijft het een gewone taak met duur 0: vul zelf een duur in.

### Andere manieren

- Ctrl+M (op een Mac ⌘+M) zet een nieuwe mijlpaal onderaan de lijst, ook als er een taak geselecteerd is. Het paneel *Eigenschappen* gaat daarbij niet open.
- *Mijlpaal toevoegen* in het rechtermuismenu van een taak maakt de mijlpaal een subtaak van die taak, niet een zustertaak.

### Een taak of hele tak kopiëren

1. Klik in de Gantt op de balk van de taak. Meer taken selecteer je met Ctrl+klik.
2. Druk op Ctrl+C (op een Mac ⌘+C). De app kopieert de taak met al haar subtaken, de relaties tussen de gekopieerde taken en hun resource-toewijzingen.
3. Klik eventueel op de balk van de taak waarnaast de kopie moet komen, en druk op Ctrl+V (⌘+V).

De kopie heeft dezelfde naam, dezelfde datums en dezelfde voortgang. Hij komt als zustertaak van de geselecteerde taak (bij meer taken: de eerst aangeklikte), onderaan bij die zusters. Is er niets geselecteerd, dan komt hij onderaan de lijst. De gekopieerde taken zijn daarna geselecteerd, de WBS-codes (het nummer van elke taak in de boom, zoals 1.2; zie [Structuur aanpassen](docs://howto-structuur-aanpassen)) worden opnieuw bepaald en de planning is verouderd.

Het klembord geldt voor de hele app, dus je kunt ook in een ander document plakken. Wat daar niet bestaat, zoals een taakkalender, een eigen taaktype, een activity code of een eigen veld, maakt de app leeg en hij meldt dat.

### Daarna

Een nieuwe taak verandert nog niets aan de andere datums. De statusbalk meldt *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*.

## Valkuilen en wat de app dan doet

**Elke nieuwe taak begint op de projectstart.** Zonder relaties wacht een taak op niets. Leg relaties, zie [Relaties leggen](docs://howto-relaties-leggen).

**Filteren, groeperen of sorteren staat aan.** Dan is de getoonde volgorde niet de volgorde van de planning. Met een geselecteerde taak voegen *Taak* en *Mijlpaal ▾* de nieuwe taak onderaan toe, en verschijnt de strook *Niet beschikbaar tijdens filteren/groeperen/sorteren*. *Invoegen boven* en *Invoegen onder* worden dan geweigerd, met dezelfde strook. Met de knop *Wissen* in de strook haal je filter, groepering en sortering in één keer weg. Dat staat niet in *Ongedaan*: Ctrl+Z brengt ze niet terug.

**Een subtaak onder een taak met resource-toewijzingen.** De taak wordt een samenvattingstaak, en die draagt zelf geen toewijzingen. De app verplaatst de toewijzingen naar de nieuwe subtaak en meldt dat. Kan dat niet, bijvoorbeeld omdat je *Mijlpaal toevoegen* koos en een mijlpaal geen toewijzingen mag dragen, dan voegt de app niets toe en zegt hij waarom.

**Een subtaak onder een mijlpaal.** De mijlpaal wordt een samenvattingstaak en de app haalt de mijlpaalmarkering eraf, met een melding.

**Mijlpaal aan bij een samenvattingstaak of een taak met toewijzingen.** De app weigert dat en zegt waarom. Bij toewijzingen: verwijder die eerst.

**Kopiëren in de takenlijst.** In de takenlijst (en op het tabblad *Tabel*) kopieert Ctrl+C alleen de waarden van de geselecteerde cellen, zoals in een spreadsheet, en plakt Ctrl+V in cellen. Taken kopiëren werkt dus alleen als je de Gantt gebruikt: klik eerst op een balk.

## Zie ook

- [Structuur aanpassen](docs://howto-structuur-aanpassen): taken laten inspringen, verplaatsen en de WBS-nummers bijhouden.
- [Relaties leggen](docs://howto-relaties-leggen): taken aan elkaar koppelen.
- [Taken selecteren, verwijderen en ongedaan maken](docs://howto-taken-selecteren-verwijderen): een taak weer weghalen.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat de app uitrekent zodra er relaties zijn.
- [Taakdialoog en eigenschappenpaneel](docs://ref-taak-eigenschappen): alle velden van een taak.
- [Nieuw project en Projectinfo](docs://ref-projectinfo): beginnen met een fasering-template.
- [Rechtermuismenu's](docs://ref-contextmenus): alle items van het menu op een taak.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): een klein voorbeeldproject (*Bestand › Voorbeelden*) met vier fasen, een startmijlpaal en een verplichte opleveringsmijlpaal.
