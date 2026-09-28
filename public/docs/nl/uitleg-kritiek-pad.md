# Kritiek pad en speling

Waarom is de einddatum van je project wat hij is? En welke taak mag een dag uitlopen zonder dat de oplevering schuift? Dat zijn de vragen achter het kritieke pad. In dit artikel lees je wat de app precies uitrekent, met een klein voorbeeld dat je zelf bouwt en narekent.

## Het begrip

Een planning is een netwerk van taken met **relaties**: afspraken als "de kozijnen gaan er pas in als het dak dicht is". Door die relaties hangen taken aan elkaar vast. Sommige ketens van taken zijn langer dan andere. De langste keten bepaalt hoe lang het hele project duurt.

Die langste keten heet het **kritieke pad**. Loopt één taak op dat pad een dag uit, dan schuift de oplevering een dag op. Er zit geen ruimte in.

Taken buiten het kritieke pad hebben wél ruimte. Die ruimte heet **speling**. De metselaar die het buitenspouwblad metselt, kan misschien twee dagen later beginnen zonder dat iemand daar last van heeft. Die twee dagen zijn de speling van die taak.

Kritiek zegt dus niets over hoe belangrijk een taak is. Het zegt alleen dat er geen tijd over is.

De rekenmethode heet **CPM** (Critical Path Method, de kritieke-padmethode). Daarom heet het blok met de uitkomsten in het paneel *Eigenschappen* ook *CPM Resultaat*.

## Hoe de app rekent

De app rekent de planning niet vanzelf door. Je start de berekening met **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Heb je iets gewijzigd sinds de laatste berekening, dan staat in de statusbalk *Verouderd — herbereken (F5)*. Wil je dat de app dat zelf doet, zet dan *Automatisch berekenen* aan onder *Instellingen › Project › Instellingen*, tabblad *Planning*, kopje *Berekenen*.

Een berekening bestaat uit twee rondes door het netwerk.

### Voorwaarts rekenen

De app begint bij de projectstart en loopt de relaties af, van voorganger naar opvolger. Voor elke taak zoekt de app de vroegste dag waarop die taak kan beginnen. Heeft een taak meer voorgangers, dan wacht de taak op de laatste die klaar is. Zo ontstaan de **vroegste start** en het **vroegste einde** van elke taak. Het laatste vroegste einde van alle taken is de einddatum van het project.

### Achterwaarts rekenen

Daarna loopt de app terug, van die einddatum naar het begin. Nu zoekt de app per taak de laatste dag waarop de taak klaar moet zijn zonder dat de einddatum schuift. Heeft een taak meer opvolgers, dan telt de opvolger die het eerst moet beginnen. Zo ontstaan de **laatste start** en het **laatste einde**.

### Totale en vrije speling

Het verschil tussen de laatste en de vroegste datum van een taak is de **totale speling**: zoveel werkdagen kan de taak uitlopen of later beginnen voordat de einddatum van het project opschuift. De app telt in werkdagen van de kalender van de taak. Een weekend of een feestdag telt dus niet mee.

**Vrije speling** is strenger. Het is de ruimte die een taak heeft voordat een van zijn opvolgers later moet beginnen. Die ruimte kun je gebruiken zonder dat een andere taak er iets van merkt.

Totale speling kan gedeeld zijn. Volgen twee niet-kritieke taken elkaar op, dan delen ze dezelfde marge. Gebruikt de eerste die op, dan heeft de tweede niets meer. De eerste heeft dan wel totale speling, maar geen vrije speling. Het deel van de totale speling dat niet vrij is, heet **interfererende speling**: gebruik je het, dan schuiven de taken erna mee. In het voorbeeld hieronder zie je dat met getallen.

### Negatieve speling

Speling kan ook negatief worden. Dat gebeurt als een taak een deadline heeft, of een constraint die een uiterste datum oplegt, die eerder ligt dan de datum die de app voor die taak berekent. De taak is dan op papier al te laat, en de taak en de keten ervoor worden kritiek.

### Wanneer is een taak kritiek?

Standaard is een taak kritiek als de totale speling 0 is of minder. Je past dat aan onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, bij *Reken-opties van dit project*. Met *Toepassen* rekent de app de planning meteen opnieuw door. De opties horen bij het projectbestand, niet bij de app.

- **Kritiek-definitie** met *Totale speling ≤ drempel* en het veld *Drempel (werkdagen)*. Standaard is de drempel 0. Wil je een buffer bewaken, zet de drempel dan bijvoorbeeld op 2: elke taak met 2 werkdagen speling of minder telt dan als kritiek en wordt rood.
- **Bijna-kritiek markeren** met een eigen *Drempel*, standaard 2 werkdagen. Een taak met meer dan 0 maar hoogstens zoveel speling krijgt een amberkleurige balk. Zo zie je welke taken bijna geen marge meer hebben, zonder ze kritiek te noemen.
- **Open-eind-taken kritiek**: een taak zonder opvolger die nog niet klaar is, telt als kritiek. Handig als vangnet tegen vergeten relaties (zie de misverstanden hieronder).
- **Speling-berekening** bepaalt of de totale speling aan de startkant of de eindkant van de taak wordt gemeten, of de kleinste van beide. Nieuwe projecten staan op *Automatisch (standaard)*. Volg je de rekenwijze van een ander pakket, dan zet *Standaardopties van dit profiel toepassen* deze keuze op de waarde van dat profiel: *Finishspeling* voor Primavera P6, *Kleinste (start/finish)* voor MS Project. Meer daarover lees je bij [Rekenprofielen](docs://gids-rekenprofielen).

### Waar je het ziet

Kritieke taken hebben een rode balk in de Gantt. Achter een niet-kritieke balk staat een groene band tot aan het laatste einde van de taak: dat is de speling. Die band zet je aan of uit met *Beeld › Baselines & voortgang › Spelingsband*.

Selecteer je een taak, dan staat in het paneel *Eigenschappen* onder *CPM Resultaat* alles op een rij: vroegste en laatste start en einde, totale, vrije en interfererende speling, en of de taak op het kritieke pad ligt. Wil je de speling van alle taken naast elkaar zien, voeg dan een kolom toe met de **+** rechts in de tabelkop, onder *Berekend*. Daar staan onder meer *Totale speling*, *Vrije speling*, *Kritiek* en *Bijna kritiek*.

De statusbalk onderaan telt de kritieke taken, bijvoorbeeld *Kritiek pad: 5 taken, 11 werkdagen*.

## Rekenvoorbeeld: bouw het zelf na

Het voorbeeld is een stukje ruwbouw van een aanbouw. Wie de tutorials volgt, herkent het uit het oefenproject *Aanbouw woning*; daar heeft *Buitenspouwblad metselen* ook 2 werkdagen speling.

### Het netwerk

Maak een nieuw project met *Start › Bestand › Nieuw* en zet de *Startdatum* op maandag 28 juni 2027. Voeg deze zes taken toe, met hun duur in werkdagen:

1. Vloer: 1
2. Binnenspouwblad: 5
3. Dakelementen: 1
4. Dakbedekking: 2
5. Buitenspouwblad: 6
6. Kozijnen: 2

Leg daarna deze relaties, allemaal Eind-Start (hoe dat gaat, staat in [Relaties leggen](docs://howto-relaties-leggen)):

- Vloer → Binnenspouwblad → Dakelementen → Dakbedekking → Kozijnen. De kozijnen kunnen er pas in als het dak dicht is.
- Vloer → Buitenspouwblad → Kozijnen. De kozijnen komen in de gevel, dus ook die moet klaar zijn.

Druk op **Bereken** (F5). Het project eindigt op maandag 12 juli 2027 en de statusbalk meldt *Kritiek pad: 5 taken, 11 werkdagen*. Alleen Buitenspouwblad is niet kritiek.

### Voorwaarts

De vloer ligt op maandag 28 juni. Beide spouwbladen kunnen op dinsdag 29 juni beginnen. Het binnenspouwblad is klaar op maandag 5 juli. De dakelementen gaan erop op dinsdag 6 juli, de dakbedekking volgt op woensdag 7 en donderdag 8 juli. Het buitenspouwblad is klaar op dinsdag 6 juli. De kozijnen wachten op de laatste van de twee ketens: de dakbedekking. Ze beginnen dus op vrijdag 9 juli en zijn klaar op maandag 12 juli.

### Achterwaarts

De kozijnen moeten uiterlijk op vrijdag 9 juli beginnen, anders schuift de einddatum. Dus moet het buitenspouwblad uiterlijk op donderdag 8 juli klaar zijn. Zes werkdagen terug is dat een laatste start op donderdag 1 juli.

### De speling

Het buitenspouwblad kan vroegst op 29 juni beginnen en moet uiterlijk op 1 juli beginnen. Daartussen liggen 2 werkdagen: woensdag 30 juni en donderdag 1 juli. Dat is de totale speling. Selecteer Buitenspouwblad en je ziet onder *CPM Resultaat*: *Totale speling: 2 dagen* en *Kritiek pad: Nee*. De vrije speling is ook 2 dagen, want de enige opvolger, Kozijnen, ligt op het kritieke pad.

De binnenketen heeft geen speling. Elke dag vertraging daar schuift de kozijnen en dus de einddatum op.

### Wat als het buitenspouwblad uitloopt?

Zet de duur van Buitenspouwblad op 8 werkdagen en druk op **Bereken**. Het buitenspouwblad is nu klaar op donderdag 8 juli, precies het laatste einde. De speling is op en de taak kleurt rood. Beide ketens zijn nu kritiek: de statusbalk telt 6 kritieke taken. De einddatum blijft maandag 12 juli.

Maak er 9 werkdagen van. Nu is het buitenspouwblad pas op vrijdag 9 juli klaar. De kozijnen schuiven naar maandag 12 en dinsdag 13 juli: het project eindigt een werkdag later. De buitenketen is nu het kritieke pad.

De binnenketen heeft nu 1 werkdag totale speling, maar die dag wordt gedeeld:

- Binnenspouwblad: totale speling 1, vrije speling 0, interfererende speling 1. Loopt het binnenspouwblad een dag uit, dan schuiven de dakelementen mee.
- Dakelementen: totale speling 1, vrije speling 0, interfererende speling 1.
- Dakbedekking: totale speling 1, vrije speling 1. Alleen hier kost een dag uitloop niemand iets.

Het is dezelfde ene dag, gedeeld door de hele keten. Gebruikt het binnenspouwblad hem, dan is hij voor de dakelementen en de dakbedekking weg.

### Bijna-kritiek en negatieve speling in het voorbeeld

Zet de duur van Buitenspouwblad terug op 6 en vink onder *Instellingen › Project › Projectinfo* het vakje *Bijna-kritiek markeren* aan (drempel 2 werkdagen). Na *Toepassen* krijgt Buitenspouwblad, met precies 2 dagen speling, een amberkleurige balk.

Geef Kozijnen daarna in het paneel *Eigenschappen* een *Deadline* van donderdag 8 juli 2027 en druk op **Bereken**. De kozijnen zijn volgens de berekening pas op 12 juli klaar, twee werkdagen te laat. Kozijnen, de vloer en de hele binnenketen krijgen nu een totale speling van −2 werkdagen.

## Gevolgen en misverstanden

**"Kritiek betekent belangrijk."** Nee. Een keuring kan cruciaal zijn en toch speling hebben. Andersom kan een eenvoudige klus kritiek zijn. Kritiek gaat alleen over tijd: er is geen marge meer.

**"Deze taak heeft speling, dus die kan wel wachten."** Kijk eerst naar de vrije speling. Heeft een taak totale speling maar geen vrije speling, dan neemt elke dag uitstel marge weg bij de taken erna, zoals bij het binnenspouwblad hierboven.

**Een vergeten relatie geeft valse speling.** Een taak zonder opvolger krijgt speling tot aan het einde van het project. Haal in het voorbeeld de relatie Buitenspouwblad → Kozijnen weg en reken opnieuw: Buitenspouwblad heeft dan ineens 4 werkdagen speling, en zou op papier kunnen uitlopen zonder dat de kozijnen wachten. Controleer daarom of elke taak een opvolger heeft, of zet *Open-eind-taken kritiek* aan. Dan wordt Buitenspouwblad in hetzelfde geval kritiek en valt het gat op.

**Het kritieke pad staat niet vast.** Loopt een niet-kritieke taak meer uit dan de speling, dan wordt een andere keten de langste. Dat zag je hierboven bij 9 werkdagen metselwerk. Kijk dus na elke wijziging opnieuw, en druk eerst op **Bereken**. Zolang de statusbalk *Verouderd* meldt, horen de rode balken nog bij de vorige berekening.

**Speling telt in werkdagen.** De 4 werkdagen speling van het vergeten buitenspouwblad lopen van woensdag 7 tot en met maandag 12 juli: zes dagen in de agenda, omdat het weekend niet meetelt. Ook een feestdag of bouwvak in de kalender telt niet mee.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): de stappen om taken aan elkaar te koppelen en een lag te zetten.
- [Rekenprofielen](docs://gids-rekenprofielen): waarom P6 en MS Project op details anders rekenen.
- [Goed plannen](docs://gids-goed-plannen): planningsprincipes, zoals waarom elke taak een voorganger en een opvolger hoort te hebben.
