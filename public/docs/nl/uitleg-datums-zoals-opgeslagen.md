# Datums zoals opgeslagen

Je opent een planning uit Primavera of MS Project, en de datums zijn anders dan je in dat pakket zag. Is de import mislukt? Meestal niet. In dit artikel lees je waarom de app zelf doorrekent, wanneer ze de datums uit het bestand laat zien, wat er dan leeg blijft en hoe je terugkeert naar de eigen berekening. Het voorbeeld aan het eind volgt twee taken door de hele cyclus.

## Het begrip

Een planningsbestand bevat twee soorten gegevens. Ten eerste de logica: taken, duren, relaties, kalenders en constraints. Ten tweede de datums die het pakket daar zelf uit uitrekende. Open Planner Studio gebruikt bij het openen de logica en rekent zelf door. De datums uit het bestand zijn dus geen invoer.

Komt de eigen berekening op andere datums uit dan het bestand noemt, dan weet je niet welke kant gelijk heeft. Het bestand kan logica missen die het pakket wel gebruikte. Het pakket kan ook op een punt anders rekenen dan de app. Daarom kan de app de datums laten zien **zoals opgeslagen**: de datums die het andere pakket in het bestand zette. Zo vergelijk je met wat je in dat pakket zag.

## Hoe de app ermee omgaat

### Met welk rekenprofiel de app rekent

De app rekent met een **rekenprofiel**: een vaste set rekenregels die bepaalt hoe ze bijvoorbeeld omgaat met de geplande start van een taak en met constraints. Er zijn drie ingebouwde profielen: *Primavera P6*, *Microsoft Project* en *Open Planner Studio*. Een `.xer` opent met *Primavera P6* en een `.mpp` met *Microsoft Project*. CSV, MS Project XML en Primavera P6 XML openen met *Open Planner Studio*. Het profiel van een project staat onder *Bestand › Projectinfo*, bij *Rekenprofiel en reken-opties*. Een IFC-bestand van de app bewaart zijn profiel.

### Wanneer de app vergelijkt

De app legt bij het openen vast wat het bestand zei en vergelijkt dat met haar eigen uitkomst. Dat doet ze bij:

- een Primavera-bestand (`.xer`) en Primavera P6 XML;
- MS Project XML en MS Project-bestanden (`.mpp`);
- een IFC-bestand van een ander programma, voor de taken waarvan het bestand vroege datums bevat;
- een IFC-bestand van de app zelf dat zijn herkomst onthouden heeft. Hieronder lees je wanneer dat zo is.

Een CSV-bestand vergelijkt de app nooit: de startdatum in een CSV is invoer, geen uitkomst van een berekening. Ook een IFC-bestand van de app zonder onthouden herkomst wordt niet vergeleken.

Wijkt geen enkele taak af, dan merk je niets. Wijkt minstens één taak af bij een bestand dat je net importeert, dan zet de app de weergave meteen aan.

Bij een Primavera-bestand rekent de app met het rekenprofiel *Primavera P6*. Dat houdt de geplande start uit het bestand aan als vroegste begin. Een taak die in het bestand later staat dan de relaties vereisen, maar daar ook gepland is, blijft daarom staan: dan is er geen verschil.

### Wat je ziet

Onder het lint staat een strook: *Je ziet de datums zoals ze in het bestand staan; bij herberekenen wijken 4 taken af.* Bij een Primavera-bron (een `.xer` of Primavera P6 XML) staat er *Je ziet de planning zoals Primavera hem opsloeg; bij herberekenen wijkt 1 taak af.* Rechts in de strook staat de knop *Herberekenen*. Die strook heeft geen kruisje.

Daarnaast komt er een melding: *4 taken tonen de datums zoals ze in het bestand staan (niet herberekend).* Alleen bij een `.xer` staat er *1 taak toont de datums zoals Primavera ze opsloeg (niet herberekend).* Elke taak waarvan het bestand datums vastlegde, toont in het paneel *Eigenschappen* een markering: *Toont Primavera’s eigen opgeslagen datums voor deze taak* bij een Primavera-bron, of *Toont de datums zoals ze in het bestand staan voor deze taak* bij een andere bron. De Gantt, het taakraster en de statusbalk tonen de datums uit het bestand.

### Wat er in deze weergave leeg blijft

De app rekent in deze weergave niets door. Ze toont alleen wat het bestand vastlegde. Speling en kritiek pad zie je dus alleen als het bestand ze bevat. Legt het bestand geen kritieke taken vast, dan meldt de statusbalk 0 kritieke taken. Dat zegt niets over het kritieke pad in het pakket zelf. Wat alleen uit een berekening komt, bestaat in deze weergave niet: welke relaties de planning bepalen, geschonden constraints, taken die buiten hun volgorde lopen en bijna-kritieke taken.

Legt het bestand van een taak niet alles vast, dan zie je in het paneel *Eigenschappen* de markering *Vastlegging deels onvolledig — zie de late-/spelingkolommen*. In een CSV-export blijven de kolommen *Critical* en *Total Float* voor zo'n taak leeg, in plaats van een verzonnen nul.

### De weergave verlaten

Je verlaat de weergave op twee manieren:

- Klik in de strook op *Herberekenen*, of kies *Bereken* (F5). De app rekent door met haar eigen regels.
- Wijzig iets waardoor de datums kunnen veranderen, zoals de duur van een taak of een nieuwe taak. De app verlaat de weergave en rekent meteen door, ook als *Automatisch berekenen* uit staat. Een naam wijzigen doet dat niet: dan blijft de weergave aan.

Na het verlaten is er geen knop meer om naar de weergave terug te schakelen. Ctrl+Z brengt hem wel terug, direct na het herberekenen of direct na zo'n bewerking. Verder kun je het bronbestand opnieuw openen. Bij een `.xer` zet ook het heropenen van een IFC-bestand dat je na het herberekenen opsloeg, maar niet bewerkte, de weergave weer aan.

### Crashherstel

Herstel je na een crash een project dat in de weergave stond, dan blijft de weergave aan. Het project dat actief was, toont dezelfde strook als eerder. Een project op een ander tabblad toont de strook zonder aantal: *Je ziet de datums zoals ze in het bestand staan. Er is niet herberekend.* Zie [Herstellen na een crash](docs://howto-herstellen-na-een-crash).

### Opslaan en heropenen

Sla je op terwijl je de weergave gebruikt, dan schrijft de app de getoonde datums in het IFC-bestand, samen met het bronformaat. Open je dat IFC-bestand later opnieuw en heb je het sinds de import niet bewerkt, dan staat de weergave weer aan, zonder nieuwe melding.

Heb je tussendoor bewerkt en opgeslagen, dan hangt het af van de bron. Bij een Primavera-bestand bewaart het IFC-bestand het oorspronkelijke `.xer` mee. De app vergelijkt dan opnieuw en biedt de weergave aan: *Herberekening verschoof 1 van de 2 taken ten opzichte van de datums in het bestand.* Daarbij staat de knop *Opgeslagen datums tonen* en een kruisje. Op elke afwijkende taak staat in het paneel *Eigenschappen* de markering *Wijkt af van de opgeslagen datums*. *Opgeslagen datums tonen* zet de weergave aan; Ctrl+Z draait dat terug. Het kruisje verbergt het aanbod.

Bij MS Project XML, `.mpp`, Primavera P6 XML of een IFC-bestand van een ander programma bewaart het IFC-bestand de bron niet. Bewerk en bewaar je zo'n project, dan vergelijkt de app bij het heropenen niet meer.

## Rekenvoorbeeld: de uitbouw

Stel, je opent een Primavera-bestand *Uitbouw* met twee taken, op een kalender zonder feestdagen. In 2027 is 6 mei Hemelvaartsdag en 17 mei Tweede Pinksterdag: met feestdagen in de kalender komen de datums anders uit. *Fundering storten* duurt 5 werkdagen, *Metselwerk* 10 werkdagen, en Metselwerk volgt op Fundering met een Eind-Start-relatie. Het bestand legt vast dat Fundering loopt van maandag 3 mei tot en met vrijdag 7 mei 2027 en Metselwerk van maandag 17 mei tot en met vrijdag 28 mei 2027: een week later dan de vroegste start die de relatie toestaat. De geplande start van Metselwerk in het bestand is maandag 10 mei 2027.

Direct na het openen zie je de datums uit het bestand. De statusbalk zegt *Einde: 28-05-2027* en *Kritiek pad: 2 taken, 20 werkdagen*. De strook meldt dat bij herberekenen 1 taak afwijkt, en beide taken tonen *Toont Primavera’s eigen opgeslagen datums voor deze taak*.

Bij *Herberekenen* blijft Fundering op 3 tot en met 7 mei staan. Metselwerk begint nu op maandag 10 mei, de werkdag na het einde van Fundering, en eindigt op vrijdag 21 mei. De planning eindigt op 21 mei 2027 en beslaat 15 werkdagen in plaats van 20. Het kritieke pad bestaat uit dezelfde 2 taken.

Wat als het anders is?

- Staat Metselwerk in het bestand ook gepland op maandag 17 mei, dan houdt het rekenprofiel *Primavera P6* die start aan. De berekening komt uit op 17 tot en met 28 mei, er is geen verschil en de weergave gaat niet aan.
- Je voegt in de weergave een taak toe: dezelfde herberekening. Metselwerk gaat naar 10 tot en met 21 mei.
- Je slaat op in de weergave en opent het IFC-bestand opnieuw, zonder bewerking: Metselwerk staat weer op 17 tot en met 28 mei.
- Je herberekent, slaat op zonder verder te bewerken en opent het IFC-bestand opnieuw: de weergave staat weer aan en Metselwerk staat op 17 tot en met 28 mei.
- Je bewerkt, slaat op en opent opnieuw: de app biedt de weergave aan met *Herberekening verschoof 1 van de 2 taken ten opzichte van de datums in het bestand.* Op Metselwerk staat *Wijkt af van de opgeslagen datums*.

## Gevolgen en misverstanden

**Een verschil is geen importfout.** De app rekent met haar eigen regels: bij een `.xer` met het rekenprofiel *Primavera P6*, bij een `.mpp` met *Microsoft Project*, bij CSV, MS Project XML en Primavera P6 XML met *Open Planner Studio*. Waarom de datums in het bronpakket anders uitkwamen, kan aan het bestand liggen of aan het pakket. De weergave laat je zien dát ze afwijken.

**De weergave is geen rekenuitkomst.** De app heeft de datums niet uitgerekend. Neem ze niet zonder meer over als uitkomst van je eigen planning.

**Opslaan in de weergave bewaart de datums van het bronpakket.** Het IFC-bestand bevat dan wat het bronpakket zei, niet wat de app zou uitrekenen.

**De knop *Opgeslagen datums tonen* verschijnt niet bij elke import.** Bij een nieuw geopend bestand staat de weergave al aan. De knop komt alleen bij een heropend IFC-bestand met Primavera-bron dat je sinds de import bewerkte.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): wat de app in een bestand bewaart en wat een import of export meeneemt.
- [Een Primavera P6-bestand (.xer) openen](docs://howto-xer-openen): de stappen en meldingen bij een `.xer`-bestand.
- [Een MS Project-bestand (.mpp) openen](docs://howto-mpp-openen): de stappen en meldingen bij een `.mpp`-bestand.
- [Herstellen na een crash](docs://howto-herstellen-na-een-crash): wat er met dit project gebeurt na een crash.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): hoe de app speling en kritiek rekent als ze wél rekent.
