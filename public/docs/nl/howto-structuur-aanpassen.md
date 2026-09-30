# Structuur aanpassen

Doel: taken in fasen en subtaken indelen, hun volgorde veranderen en de WBS-nummers kloppend houden.

## Wanneer je dit nodig hebt

Je planning is een boom: fasen (samenvattingstaken) met daaronder subtaken, zoals *Fundering* met *Grondwerk*, *Wapening* en *Storten*. Je past die boom aan als je taken onder een fase wilt hangen, een taak eruit wilt halen, of de volgorde niet klopt. De **WBS-code** (1, 1.1, 1.2, 2, …) is het nummer van een taak in die boom.

## Stappen

### Een taak laten inspringen

1. Selecteer de taak. Meerdere taken mag ook.
2. Kies *Planning › Structuur › Inspringen*. Het kan ook met Alt+→ (of Alt+Shift+→), of via *Inspringen* in het rechtermuismenu.

De taak wordt de laatste subtaak van de vorige taak op hetzelfde niveau. Die taak wordt daardoor een samenvattingstaak. Selecteer je een aaneengesloten blok, dan springt het blok als geheel in. Heeft de taak geen vorige taak op hetzelfde niveau, dan gebeurt er niets, en er komt geen melding.

### Een taak laten uitspringen

Kies *Planning › Structuur › Uitspringen*, druk op Alt+← (of Alt+Shift+←) of kies *Uitspringen* in het rechtermuismenu.

De taak wordt een zustertaak direct achter de fase waar hij onder hing. Zijn eigen subtaken gaan met hem mee. De taken die na hem in die fase stonden, blijven erin. Een taak op het hoogste niveau springt niet verder uit.

### Een taak verplaatsen

Je hebt drie manieren.

- **Met het toetsenbord.** Alt+↑ en Alt+↓ wisselen de taak met haar buur op hetzelfde niveau. Een samenvattingstaak neemt haar subtaken mee. Bovenaan of onderaan het niveau gebeurt er niets. Bij een meervoudige selectie verplaatst alleen de eerst aangeklikte taak.
- **Slepen in de takenlijst.** Druk op een rij en sleep verticaal. Het bovenste kwart van een rij betekent *ervoor*, het onderste kwart *erachter*. Het midden van een samenvattingstaak hangt de taak als laatste subtaak eronder. Het midden van een gewone taak telt als de dichtstbijzijnde rand. Sleep je een rij die bij een meervoudige selectie hoort, dan verhuist de hele selectie.
- **Slepen in de Gantt.** Sleep de balk verticaal naar een andere rij. Dat werkt hetzelfde als slepen in de lijst en verandert geen datums. Sleep je horizontaal, dan verschuif je juist de datums.

Elke verplaatsing is één stap voor *Ongedaan* (Ctrl+Z).

### De WBS-nummers bijhouden

Kijk in *Planning › Structuur* naar de knop *WBS auto*.

- **Aan (standaard in een nieuw project).** De app nummert de hele boom opnieuw bij elke toevoeging, verwijdering en verplaatsing. De WBS-code is dan alleen-lezen: in de lijst en in het paneel *Eigenschappen* kun je hem niet typen. *Hernummer WBS* is uitgeschakeld.
- **Uit.** De codes blijven staan zoals ze zijn, ook na verplaatsen en inspringen. Je typt ze zelf, in de kolom *WBS* of in het veld *WBS Code* in *Eigenschappen*, of je laat ze één keer opnieuw nummeren met *Hernummer WBS*. Dat overschrijft ook codes die je zelf getypt hebt.

Zet je *WBS auto* aan, dan nummert de app de boom meteen. Zowel *WBS auto* als *Hernummer WBS* is met *Ongedaan* terug te draaien.

## Valkuilen en wat de app dan doet

**Filteren, groeperen of sorteren staat aan.** De getoonde volgorde is dan niet de volgorde van de planning, dus de app zet de structuur vast. *Inspringen* en *Uitspringen* zijn uitgeschakeld, met de tooltip *Niet beschikbaar tijdens filteren/groeperen/sorteren*. Alt+→ en slepen tonen dezelfde tekst in een strook, met de knop *Wissen*. Die haalt filter, groepering en sortering in één keer weg, en Ctrl+Z brengt ze niet terug. In het rechtermuismenu ontbreken *Inspringen* en *Uitspringen* dan.

Alt+↑ en Alt+↓ werken in zo'n weergave wél, zonder melding. Bij alleen een filter zie je de nieuwe volgorde meteen. Bij een sortering verandert de volgorde in de planning wel, maar zie je het pas na *Wissen*.

**WBS auto staat uit.** Een nieuwe taak krijgt de code die bij zijn plek in de boom past, ook als een andere taak die code al heeft. Zo kunnen er dubbele nummers ontstaan. Ook na inspringen kloppen de codes niet meer met de boom. *Hernummer WBS* lost beide op.

**Een mijlpaal krijgt subtaken.** Een mijlpaal is een moment en heeft geen subtaken. De app haalt de mijlpaalmarkering eraf en meldt dat.

**Een taak met resource-toewijzingen krijgt subtaken.** Een samenvattingstaak draagt zelf geen toewijzingen. De app verhuist ze naar de eerste nieuwe subtaak die ze mag dragen en meldt dat. Is er zo'n subtaak niet, of heeft die dezelfde resource al, dan gebeurt er niets en zegt de melding waarom.

**Een relatie zou een kring maken.** De relaties van een samenvattingstaak gelden ook voor haar subtaken. Zou een verplaatsing daardoor een kring maken, dan weigert de app hem, met de melding *Deze verplaatsing zou een kring in de planning maken (…)*. Er verandert dan niets.

**Een relatie tussen een taak en zijn eigen fase.** Zet je een taak onder een fase waarmee hij al een relatie heeft, dan blijft die relatie bestaan, maar hij telt niet meer mee in de berekening. De app meldt het. Over relaties op samenvattingstaken lees je meer in [Relaties en lag](docs://uitleg-relaties).

**De planning is verouderd.** Een verplaatsing naar een andere fase kan datums veranderen. Druk op **Bereken** (F5). Puur van volgorde wisselen binnen dezelfde fase doet dat niet.

## Zie ook

- [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen): nieuwe taken op de juiste plek zetten.
- [WBS-sjablonen bewaren en invoegen](docs://howto-wbs-sjablonen): een hele fase hergebruiken.
- [Relaties leggen](docs://howto-relaties-leggen): taken aan elkaar koppelen.
- [Taken selecteren, verwijderen en ongedaan maken](docs://howto-taken-selecteren-verwijderen): een verplaatsing terugdraaien.
