# Kritiek pad en speling

Waarom is de einddatum van je project wat hij is? En welke taak mag een dag uitlopen zonder dat de oplevering schuift? Dat zijn de vragen achter het kritieke pad. In dit artikel lees je wat de app precies uitrekent, aan de hand van een uitgewerkt voorbeeld.

## Het begrip

Een planning is een netwerk van taken met **relaties**: afspraken als "de kozijnen gaan er pas in als het dak dicht is". Door die relaties hangen taken aan elkaar vast. Sommige ketens van taken zijn langer dan andere. De langste keten bepaalt hoe lang het hele project duurt.

Die langste keten heet het **kritieke pad**. Loopt één taak op dat pad een dag uit, dan schuift de oplevering een dag op. Er zit geen ruimte in.

Taken buiten het kritieke pad hebben wél ruimte. Die ruimte heet **speling**. De metselaar die het buitenspouwblad metselt, kan misschien twee dagen later beginnen zonder dat iemand daar last van heeft. Die twee dagen zijn de speling van die taak.

Kritiek zegt dus niets over hoe belangrijk een taak is. Het zegt alleen dat er geen tijd over is.

De rekenmethode heet **CPM** (Critical Path Method, de kritieke-padmethode). Daarom heet het blok met de uitkomsten in het paneel *Eigenschappen* ook *CPM Resultaat*.

## Hoe de app rekent

De app rekent de planning niet vanzelf door. De berekening start met **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Is er iets gewijzigd sinds de laatste berekening, dan staat in de statusbalk *Verouderd — herbereken (F5)*. Staat *Automatisch berekenen* aan (onder *Instellingen › Project › Instellingen*, tabblad *Planning*, kopje *Berekenen*), dan doet de app dat zelf.

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

Standaard is een taak kritiek als de totale speling 0 is of minder. Dat is aan te passen onder *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*, bij *Reken-opties van dit project*. Met *Toepassen* rekent de app de planning meteen opnieuw door. De opties horen bij het projectbestand, niet bij de app.

- **Kritiek-definitie** met *Totale speling ≤ drempel* en het veld *Drempel (werkdagen)*. Standaard is de drempel 0. Wie een buffer wil bewaken, zet de drempel bijvoorbeeld op 2: elke taak met 2 werkdagen speling of minder telt dan als kritiek en wordt rood.
- **Bijna-kritiek markeren** met een eigen *Drempel*, standaard 2 werkdagen. Een taak met meer dan 0 maar hoogstens zoveel speling krijgt een amberkleurige balk. Zo zie je welke taken bijna geen marge meer hebben, zonder ze kritiek te noemen.
- **Open-eind-taken kritiek**: een taak zonder opvolger die nog niet klaar is, telt als kritiek. Handig als vangnet tegen vergeten relaties (zie de misverstanden hieronder).
- **Speling-berekening** bepaalt of de totale speling aan de startkant of de eindkant van de taak wordt gemeten, of de kleinste van beide. Nieuwe projecten staan op *Automatisch (standaard)*. Wie de rekenwijze van een ander pakket volgt, zet deze keuze met *Standaardopties van dit profiel toepassen* op de waarde van dat profiel: *Finishspeling* voor Primavera P6, *Kleinste (start/finish)* voor MS Project.

### Waar je het ziet

Kritieke taken hebben een rode balk in de Gantt. Achter een niet-kritieke balk staat een groene band tot aan het laatste einde van de taak: dat is de speling. Die band gaat aan of uit met *Beeld › Baselines & voortgang › Spelingsband*.

Bij een geselecteerde taak staat in het paneel *Eigenschappen* onder *CPM Resultaat* alles op een rij: vroegste en laatste start en einde, totale, vrije en interfererende speling, en of de taak op het kritieke pad ligt. De speling van alle taken naast elkaar zie je in de kolommen onder *Berekend* (de **+** rechts in de tabelkop), zoals *Totale speling*, *Vrije speling*, *Kritiek* en *Bijna kritiek*.

De statusbalk onderaan telt de kritieke taken, bijvoorbeeld *Kritiek pad: 21 taken, 45 werkdagen*.

## Rekenvoorbeeld: de aanbouw

Het voorbeeld is het oefenproject *Aanbouw woning* uit de tutorials, zoals het eruitziet als alle relaties gelegd zijn. In tutorial 2, "Relaties en het kritieke pad", bouw je dit zelf op en reken je het na. Hier lees je waarom de getallen zijn wat ze zijn.

De uitbouw start op maandag 7 juni 2027. Na de berekening staat de oplevering op vrijdag 6 augustus 2027 en meldt de statusbalk *Kritiek pad: 21 taken, 45 werkdagen*. Twee taken zijn niet kritiek: *Buitenspouwblad metselen* en *Schilderwerk*.

### Twee ketens die samenkomen

Na de ruwbouwvloer (*Kanaalplaatvloer leggen*, klaar op maandag 28 juni) splitst het werk zich in twee ketens. Beide eindigen bij *Kozijnen plaatsen*:

- De binnenkant: *Binnenspouwblad metselen* (5 werkdagen), dan *Dakelementen plaatsen* (1), dan *Dakbedekking aanbrengen* (2). De kozijnen kunnen er pas in als het dak dicht is.
- De buitenkant: *Buitenspouwblad metselen* (6 werkdagen). De kozijnen komen in de gevel, dus ook die moet klaar zijn.

**Voorwaarts.** Beide spouwbladen kunnen op dinsdag 29 juni beginnen. Het binnenspouwblad is klaar op maandag 5 juli. De dakelementen gaan erop op dinsdag 6 juli, de dakbedekking volgt op woensdag 7 en donderdag 8 juli. Het buitenspouwblad is klaar op dinsdag 6 juli. *Kozijnen plaatsen* wacht op de laatste van de twee ketens, de dakbedekking, en begint dus op vrijdag 9 juli.

**Achterwaarts.** De kozijnen moeten uiterlijk op vrijdag 9 juli beginnen, anders schuift de oplevering. Dus moet het buitenspouwblad uiterlijk op donderdag 8 juli klaar zijn. Zes werkdagen terug is dat een laatste start op donderdag 1 juli.

**Speling.** Het buitenspouwblad kan vroegst op 29 juni beginnen en moet uiterlijk op 1 juli beginnen. Daartussen liggen 2 werkdagen: woensdag 30 juni en donderdag 1 juli. Dat is de totale speling; het paneel toont *Totale speling: 2 dagen* en *Kritiek pad: Nee*. De vrije speling is ook 2 dagen, want de enige opvolger, *Kozijnen plaatsen*, ligt op het kritieke pad.

De binnenketen heeft geen speling. Elke dag vertraging daar schuift de kozijnen en alles erna op.

### Schilderwerk

*Schilderwerk* (3 werkdagen) begint na het stucwerk, op maandag 26 juli, en is klaar op woensdag 28 juli. De taak erna, *Opleverpunten en schoonmaken*, wacht ook op het tegelwerk. Dat is pas klaar op donderdag 5 augustus, want de dekvloer moet eerst vijf werkdagen drogen. Het schilderwerk mag dus uitlopen tot donderdag 5 augustus. Dat geeft 6 werkdagen speling: 29 en 30 juli, en 2 tot en met 5 augustus. Ook hier is de vrije speling gelijk aan de totale, want de opvolger is kritiek.

### Als het buitenspouwblad uitloopt

Duurt het buitenspouwblad 8 werkdagen in plaats van 6, dan is het klaar op donderdag 8 juli: precies het laatste einde. De speling is op en de taak wordt rood. Beide ketens zijn dan kritiek en de statusbalk telt 22 kritieke taken. De oplevering blijft op vrijdag 6 augustus.

Duurt het 9 werkdagen, dan is het buitenspouwblad pas op vrijdag 9 juli klaar. De kozijnen schuiven naar maandag 12 juli en de oplevering naar maandag 9 augustus: één werkdag later. De buitenketen is nu het kritieke pad; de statusbalk meldt *Kritiek pad: 19 taken, 46 werkdagen*.

De binnenketen heeft in dat geval 1 werkdag totale speling, maar die dag wordt gedeeld:

- *Binnenspouwblad metselen*: totale speling 1, vrije speling 0, interfererende speling 1. Loopt het binnenspouwblad een dag uit, dan schuiven de dakelementen mee.
- *Dakelementen plaatsen*: totale speling 1, vrije speling 0, interfererende speling 1.
- *Dakbedekking aanbrengen*: totale speling 1, vrije speling 1. Alleen hier kost een dag uitloop niemand iets.

Het is dezelfde ene dag, gedeeld door de hele keten. Gebruikt het binnenspouwblad hem, dan is hij voor de dakelementen en de dakbedekking weg.

### Bijna-kritiek en negatieve speling

Staat *Bijna-kritiek markeren* aan met de standaarddrempel van 2 werkdagen, dan krijgt het buitenspouwblad, met precies 2 dagen speling, een amberkleurige balk. Het schilderwerk, met 6 dagen, blijft blauw.

Krijgt de oplevering een deadline van woensdag 4 augustus, twee werkdagen vóór de berekende oplevering, dan wordt de speling negatief. Alle 21 taken van het kritieke pad krijgen een totale speling van −2 werkdagen. Het buitenspouwblad houdt geen speling over en wordt ook kritiek; het schilderwerk houdt 4 werkdagen.

## Gevolgen en misverstanden

**"Kritiek betekent belangrijk."** Nee. Een keuring kan cruciaal zijn en toch speling hebben. Andersom kan een eenvoudige klus kritiek zijn: in het voorbeeld ligt *Opleverpunten en schoonmaken* op het kritieke pad. Kritiek gaat alleen over tijd: er is geen marge meer.

**"Deze taak heeft speling, dus die kan wel wachten."** Kijk eerst naar de vrije speling. Heeft een taak totale speling maar geen vrije speling, dan neemt elke dag uitstel marge weg bij de taken erna, zoals bij het binnenspouwblad in het 9-werkdagengeval.

**Een vergeten relatie geeft valse speling.** Een taak zonder opvolger krijgt speling tot aan het einde van het project. Ontbreekt in het voorbeeld de relatie van het buitenspouwblad naar de kozijnen, dan heeft het buitenspouwblad ineens 23 werkdagen speling, tot aan de oplevering op 6 augustus. Op papier zou het dan wekenlang kunnen uitlopen zonder dat de kozijnen wachten. Met *Open-eind-taken kritiek* aan wordt het buitenspouwblad in dat geval kritiek en valt het gat op.

**Het kritieke pad staat niet vast.** Loopt een niet-kritieke taak meer uit dan de speling, dan wordt een andere keten de langste. Dat zag je hierboven bij 9 werkdagen metselwerk. Na elke wijziging moet de planning dus opnieuw berekend worden. Zolang de statusbalk *Verouderd* meldt, horen de rode balken nog bij de vorige berekening.

**Speling telt in werkdagen.** De 6 werkdagen speling van het schilderwerk lopen van donderdag 29 juli tot en met donderdag 5 augustus: acht dagen in de agenda, omdat het weekend niet meetelt. Ook een feestdag of bouwvak in de kalender telt niet mee.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): de stappen om taken aan elkaar te koppelen en een lag te zetten.
