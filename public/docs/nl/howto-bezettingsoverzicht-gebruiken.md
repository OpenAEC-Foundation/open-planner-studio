# Het bezettingsoverzicht gebruiken

Doel: zien op welke dagen twee of meer geopende projecten samen meer van een resource vragen dan de resourcebibliotheek heeft.

## Wanneer je dit nodig hebt

Je metselploeg staat in het ene project op de gevels en in het andere op de garages. Elk project vindt de ploeg netjes ingepland, want het histogram en de overbezetting van een project kijken alleen naar dat ene project. Pas als je de projecten naast elkaar legt, blijkt dat ze op dezelfde dagen samen meer vragen dan je metselaars hebt. Het bezettingsoverzicht doet dat naast elkaar leggen voor je.

Het overzicht telt alleen resources die uit de resourcebibliotheek komen, in projecten die aan dezelfde bibliotheek gekoppeld zijn. Hoe dat rekent, lees je in [De resourcebibliotheek](docs://uitleg-resourcebibliotheek).

## Stappen

### 1. Zet de projecten klaar

1. Open de projecten die je wilt vergelijken, elk in een eigen tabblad, zie [Met meerdere projecten tegelijk werken](docs://howto-meerdere-projecten). Het overzicht ziet alleen projecten die in deze app geopend zijn.
2. Koppel elk project aan dezelfde bibliotheek, en gebruik de resource uit de bibliotheek in elk project. Zonder bibliotheekkoppeling toont het resourcepaneel het overzicht niet. Zie [De resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken).
3. Reken de projecten door met *Bereken* (F5), of zet *Automatisch berekenen* aan. Wat het overzicht met verouderde projecten doet, staat bij de valkuilen hieronder.

### 2. Open het overzicht

1. Ga naar een van de projecten en kies *Resources › Beheer › Resources*.
2. Kies rechtsboven *Bezetting*. Het overzicht hoort bij de bibliotheek van het project waarin je staat. In dit paneel kun je niets wijzigen: het is een leesvenster.

### 3. Lees de tabel

Elke resource uit de bibliotheek die in minstens één geopend project geboekt is, krijgt een rij. Resources zonder boeking staan er niet. De rijen met de meeste dubbel geboekte dagen staan bovenaan, daarna alfabetisch.

- *Documenten* zegt in hoeveel projecten de resource geboekt is, bijvoorbeeld *2 documenten*.
- *Periode* loopt van de eerste tot en met de laatste dag met belasting, geschreven als jjjj-mm-dd, bijvoorbeeld *2027-06-07 – 2027-06-14*.
- *Piek / Capaciteit* zet de hoogste dagbelasting van alle projecten samen tegenover de capaciteit van de resource in de bibliotheek, bijvoorbeeld *4,0 / 3,0*. Is er minstens één dubbel geboekte dag, dan staat het in het rood.
- Een rode markering achter de rij, bijvoorbeeld *3 dagen dubbel geboekt*, telt de dagen waarop de som groter is dan de capaciteit. Houd je de muis erboven, dan zie je de datums.

### 4. Kijk per project

1. Klik op het pijltje voor de naam van een resource. De rij klapt open.
2. Bovenaan staan de dubbel geboekte datums, de eerste vijf en daarna *… en 3 meer* als het er meer zijn. Eronder staat per project de naam met de periode en de piek van dat ene project, bijvoorbeeld *Woningen Noord 2027-06-07 – 2027-06-11 Piek: 2,0*.
3. Klik op de rij zelf om onderaan een histogram te zien. Elk project heeft een eigen kleur en de staven staan op elkaar. De gestippelde lijn is de capaciteit van de bibliotheek. Verandert die in de tijd, dan zie je trapjes. Dagen die dubbel geboekt zijn, krijgen een rode band achter de staven. Klik nog een keer op de rij om het histogram weer te sluiten. Zonder gekozen rij staat er *Selecteer een resource om het histogram te zien.*

### 5. Los het op

Het overzicht laat het probleem zien, maar lost het niet op. Je hebt twee mogelijkheden:

- Schuif een taak in een van de projecten, of geef haar minder eenheden per dag. Reken daarna dat project opnieuw door met F5.
- Komt er echt een metselaar bij, zet dan *Max. eenheden* van de resource in de bibliotheek hoger. Dat doe je in *Resources › Beheer › Resources*, weergave *Bibliotheek*.

*Nivelleren* in het lint helpt hier niet: dat kijkt naar de resources van het ene project waarin je staat, zie [Nivelleren](docs://uitleg-nivelleren).

## Valkuilen en wat de app dan doet

**Het overzicht is leeg.** Er staat *Geen bibliotheekresources geboekt in de geopende documenten.* Dan staat er in geen enkel geopend project een resource uit de bibliotheek op een taak.

**Je ziet de knop *Bezetting* niet.** Het project waarin je staat is niet aan een bibliotheek gekoppeld.

**Een project telt niet mee.** Het is niet geopend in deze app, het hangt aan een andere bibliotheek, of de resource daarin is een eigen resource van dat project. Onderaan het overzicht staat altijd *Dit overzicht ziet alleen de documenten die in dit programma geopend zijn.* Een kopie van een resource die inmiddels uit de bibliotheek is verwijderd, telt ook niet mee.

**Een project is verouderd.** Een project is verouderd als je iets aan de planning wijzigde zonder opnieuw te berekenen. Het overzicht gaat dan als volgt om met dat project:

- Een project dat niet het actieve tabblad is, rekent het overzicht zelf alvast door, zonder het project te wijzigen. Boven de tabel staat dan *Gewijzigde documenten zijn voor dit overzicht alvast doorgerekend; druk F5 in het document, of zet 'Automatisch berekenen' aan om dit blijvend te doen.* Achter het project staat *Alvast doorgerekend voor dit overzicht — het document zelf toont oudere datums tot je daar F5 drukt of 'Automatisch berekenen' aanzet.* Staat *Automatisch berekenen* aan (*Instellingen › Project › Instellingen*, tabblad *Planning*), dan rekent de app zulke projecten wel echt door zodra je het overzicht bekijkt, en verdwijnt de melding. Is ook het actieve project verouderd, dan staat boven de tabel in plaats daarvan de melding uit het volgende punt.
- Het project waarin je zelf staat rekent het overzicht niet door. Is dat project verouderd, dan staat er *Een gewijzigd document is nog niet doorgerekend; het telt hier mee met zijn laatst berekende cijfers. Druk F5 in dat document, of zet 'Automatisch berekenen' aan.* en achter het project *Verouderd: dit zijn de laatst berekende cijfers — druk F5 in dit document.* Pas op: *laatst berekende cijfers* klopt niet helemaal. Het overzicht neemt de oude startdatums, maar al wel een gewijzigde duur of inzet. De cijfers kunnen dus afwijken van zowel de oude als de nieuwe planning, en van de balken in de Gantt. Vertrouw ze pas na F5.
- Kan het overzicht een project niet doorrekenen, bijvoorbeeld door een kringverwijzing in zijn relaties, dan telt dat project niet mee. Het staat er wel, met *Telt niet mee: planning niet doorgerekend — activeer dit document en druk F5.* en boven de tabel *Minstens één document is niet doorgerekend en telt niet mee in de bezetting.*

**Het overzicht klopt niet met wat je verwacht.** De capaciteit komt uit de bibliotheek (*Max. eenheden* van het bibliotheekitem, of zijn *Tijd-gefaseerde capaciteit* op die dag), niet uit de *Max. eenheden* van de kopie in het project. Een som gelijk aan de capaciteit is geen conflict.

## Zie ook

- [De resourcebibliotheek](docs://uitleg-resourcebibliotheek): hoe de bezetting wordt geteld, met een rekenvoorbeeld.
- [De resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken): projecten koppelen en resources toewijzen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): overbezetting binnen één project.
