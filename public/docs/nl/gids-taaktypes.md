# Werkregels en werk: vaste duur, vast werk of vaste inzet

Een taak met resources heeft drie getallen die bij elkaar horen: de **restduur** (hoeveel werkdagen er nog zijn), de **inzet** per resource (eenheden per werkdag, 1 = één persoon voltijds) en het **werk** (uren). Werk = restduur × inzet. Verandert er één, dan moet een ander getal meebewegen. Welk getal dat is, bepaalt de **werkregel** van de taak — in MS Project heet dat het *taaktype* plus *effort-driven*, in Primavera P6 het *duration type*.

## Zichtbaar maken

Standaard houdt Open Planner Studio duur en inzet vast en volgt het werk — precies zoals de app altijd al plande. De werkregel en het resterende werk worden dan niet getoond.

- **Instelling**: zet *Toon werkregels en werk* aan onder Instellingen → Planning → Berekenen (⚙, het tabblad Instellingen of Backstage → Instellingen). Dan verschijnen de werkregel in het eigenschappenpaneel en de taakdialoog, de kolom *Werk (rest)* in de toewijzingstabel en de kolommen *Werkregel* en *Resterend werk* in de kolomkiezer van het raster.
- **Automatisch**: opent u een bestand dat al taaktypes bevat (een `.mpp`, MSPDI-, P6- of XER-bestand met taaktypes, of een eerder in deze app gezette werkregel), dan zijn die bedieningselementen voor dát document zichtbaar, ongeacht de instelling. Draagt het bestand opgeslagen werk per toewijzing of een eigen werkregel, dan meldt de app dat één keer, met een link naar deze gids; een werkregel die alleen uit het taaktype van MS Project of P6 volgt, wordt stil getoond.

## De vier werkregels

- **Vaste duur en inzet** (standaard; MS Project *Fixed Duration*, niet effort-driven; P6 *Fixed Duration & Units/Time*): duur en inzet blijven staan, het werk volgt. Een resource erbij verandert de duur niet.
- **Vaste duur en werk** (P6 *Fixed Duration & Units*): duur en werk blijven staan, de inzet volgt. Een tweede resource verdeelt het werk en verlaagt ieders inzet.
- **Vast werk** (MS Project *Fixed Work*; P6 *Fixed Units*): het werk blijft staan. Meer inzet, of een resource erbij, maakt de taak korter; een resource eraf maakt haar langer.
- **Vaste inzet** (MS Project *Fixed Units*, effort-driven; P6 *Fixed Units/Time*): de inzet blijft staan. Meer werk maakt de taak langer; een resource erbij verdeelt het werk en maakt haar korter.

Alleen de regel wisselen verandert geen enkel getal. Onder de keuzelijst staat in gewone woorden wat de gekozen regel beschermt, en in de toewijzingstabel draagt de beschermde kolom een slotje.

## Werk invoeren

In de toewijzingstabel toont de kolom *Werk (rest)* het resterende werk in uren: opgeslagen werk uit het bestand, of anders restduur × inzet. Typ een nieuw getal en de werkregel bepaalt wat meebeweegt: onder *Vast werk* of *Vaste inzet* wordt de taak langer of korter (de planning is dan verouderd tot u opnieuw berekent), onder de twee vaste-duur-regels verandert de inzet. Materiaalresources tellen niet mee voor de duur.

Werk uit P6 of MS Project kan afwijken van inzet × duur, bijvoorbeeld wanneer een resource in P6 maar een deel van de taak op de taak staat. Zo'n werkcel krijgt een oranje waarschuwingsteken; wijs het aan om beide getallen te zien. Het histogram volgt het opgeslagen werk, verdeeld over de hele taakduur; de inzet blijft zoals het bestand hem gaf. Een eigen spanne per toewijzing (werk alleen in dat deel van de taak) komt in een latere versie.

In het raster werken de kolommen *Werkregel* (keuzelijst) en *Resterend werk* (`naam: uren; naam: uren`) op dezelfde manier, ook bij plakken over meerdere taken.

## Wat u moet weten

- De regel werkt op het **resterende** deel van een gestarte taak: verrichte duur en verricht werk bewegen nooit.
- Een dagtaak houdt hele dagen: levert werk ÷ inzet een halve dag op, dan wordt de duur naar boven afgerond en blijft het werk exact staan.
- Onder *Vaste inzet* en *Vast werk* onthoudt de app het werk zodra een andere inzet of een andere kalender de duur verandert, net als MS Project. Heen en terug komt daardoor weer op de oude duur uit: 5 dagen met inzet 1 wordt bij inzet 0,3 17 dagen (40 uur ÷ 2,4 uur per dag, naar boven afgerond) en bij inzet 1 weer 5 dagen. Heeft de taak twee of meer resources, dan houdt de resource die u niet bewerkt haar inzet en groeit haar werk mee met de langere duur; terugzetten maakt de taak dan niet vanzelf weer korter.
- Een resource erbij of eraf, ook via *Verplaats naar…* of het verwijderen van een resource, volgt dezelfde regel.
- Verandert de werkregel de duur (na een andere inzet, ander werk of een resource erbij of eraf), dan telt dat als een gewone duurwijziging. Een pauze die het nivelleren in de taak had gelegd, vervalt; nivelleer daarna opnieuw. Bij een taak in uren die nog niet gestart is, beweegt *Gepland einde* mee: start plus de nieuwe duur op de kalender van de taak.
- Een **andere kalender** (voor de taak, voor het project, of andere uren per dag in de kalender zelf) verandert het aantal werkuren per dag; daarna beslist de werkregel. Onder *Vast werk* en *Vaste inzet* wordt een taak langer als de mensen minder uren per dag maken (32 uur op 6 uur per dag = 6 dagen). Onder *Vaste duur en werk* stijgt de inzet. Onder de standaardregel blijft alles zoals voorheen: duur en inzet blijven, het werk volgt. Verandert een project- of kalenderwijziging de duur van taken, dan meldt de app hoeveel.
- Een **duurwijziging op een gestarte taak** laat het verrichte deel staan (elke voortgangsinvoer legt de resterende duur vast): wat u aan de duur toevoegt of afhaalt, komt bij de resterende duur (nooit onder nul). Het percentage gereed wordt daarna opnieuw berekend als verricht gedeeld door de nieuwe duur, zodat de voortgangsbalk en de resterende duur hetzelfde zeggen. Hetzelfde gebeurt wanneer een kalenderwijziging de duur van een gestarte taak verandert.
- Het MS Project-vinkje *effort-driven* telt alleen op een taak die uit een MS Project-bestand komt; daar betekent "niet ingevuld" letterlijk *niet effort-driven*. Op een taak uit P6 of uit Open Planner Studio zelf speelt het vinkje geen rol. Dit is een **bewerkregel**: het bepaalt alleen wat er meebeweegt als u duur, inzet of werk wijzigt of een resource toevoegt. Het rekenen van de planning (F5) leest het nooit, en het staat los van het rekenprofiel.
- Elke bewerking is één stap ongedaan te maken.
- In de **taakdialoog** gelden werkregel, werk en toewijzingen meteen, zodat ze in de dialoog met elkaar rekenen. *Annuleren* draait ze terug; *Opslaan* is samen met de rest van de dialoog één stap ongedaan maken.
- De projectstandaard-werkregel (voor taken zonder eigen keuze) is via de AI-assistent te zetten; een UI daarvoor volgt.
- Mijlpalen, verzameltaken, hangmatten en taken op doorlooptijd hebben geen werkregel; in het raster blijft de kolom *Werkregel* bij mijlpalen, verzameltaken en hangmatten leeg.
