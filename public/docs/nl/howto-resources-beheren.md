# Resources beheren

Doel: resources (mensen, machines en materiaal) in je project aanmaken, aanpassen en verwijderen, zodat je ze aan taken kunt toewijzen.

## Wanneer je dit nodig hebt

Voordat je een metselaar of een kraan op een taak zet, moet die bestaan als resource. De resource legt vast hoeveel er van is en op welke dagen hij werkt. Daarmee rekent de app uit of je hem op één dag te veel vraagt. Je past een resource aan als de bezetting verandert, bijvoorbeeld als er een tweede metselaar bij komt.

Twee vaktermen. **Max. eenheden** is de capaciteit per werkdag: 1 is één persoon of machine, 2 zijn er twee. Een **toewijzing** is een resource op een taak (zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen)).

## Stappen

### Een resource maken

1. Kies *Resources › Beheer › Nieuwe resource*. Het resourcepaneel neemt de werkruimte over en onderaan de tabel staat een lege rij. Je kunt het paneel ook openen met *Resources › Beheer › Resources* en dan *Nieuwe resource in het project* kiezen.
2. Typ de naam, bijvoorbeeld *Metselaar*.
3. Kies het *Type*: *Arbeid* (de standaard), *Materieel*, *Materiaal*, *Onderaannemer* of *Ploeg*.
4. Vul zo nodig de andere velden in. Alles heeft een standaard: *Max. eenheden* is 1 en *Kalender* is *Projectkalender*. *Tarief/uur* is leeg. *Eenheid* kun je alleen invullen bij het type *Materiaal*, bijvoorbeeld m³.
5. Druk op Enter of klik buiten de rij. De resource staat in de tabel. Met Enter opent daaronder direct een lege rij voor de volgende. Druk op Esc als je klaar bent.

De rij is pas een resource als er een naam in staat. Met Esc, of door weg te klikken zonder naam, maakt de app niets aan. De volgorde van invullen maakt niet uit: je mag eerst het type kiezen en dan de naam typen.

### Een resource aanpassen

Pas de velden in de rij aan. De app legt de naam, het tarief en de eenheid vast als je het veld verlaat, de andere velden direct.

- *Max. eenheden* neemt de app alleen over als de waarde groter is dan 0. Bij 0 of lager krijgt het veld een rode rand en springt het terug naar de vorige waarde.
- *Kalender* bepaalt op welke dagen de resource werkt. Kies *Projectkalender* of een eigen kalender. Met *+ Resourcekalender* maak je een nieuwe en het potloodje (*Bewerken…*) opent de gekozen kalender. Werkt een taak op een dag dat de resource volgens zijn kalender vrij is, dan telt die dag als overbezet. Hoe je een resourcekalender maakt, staat in [Een resourcekalender instellen](docs://howto-resourcekalender-instellen).
- *Tarief/uur* en *Totaal*: *Totaal* is de belaste uren van die resource maal het tarief. Een stukadoor die 32 uur belast is met een tarief van 50 per uur staat op 1.600,00. Onderaan de tabel staat de som van alle resources.
- *Ploeg* deelt een resource in onder een resource van het type *Ploeg*. Het is alleen een indeling: de app telt de capaciteit of de belasting van de leden niet bij de ploeg op.
- Het gekleurde vlakje links is de kleur van de resource. Het is alleen weergave en heeft geen invloed op de planning.

### Capaciteit die in de tijd verandert

Komt je tweede metselaar pas op 19 juli? Klik op het pijltje naast *Max. eenheden*. Onder *Tijd-gefaseerde capaciteit* kies je *Stap toevoegen*. Elke stap heeft een datum (*Vanaf*) en een aantal (*Max. eenheden*). Vanaf die datum geldt dat aantal. Zonder stappen geldt de vaste waarde altijd.

Een nieuwe stap begint met de datum van vandaag en 1 eenheid. Pas beide aan, want anders geldt vanaf vandaag een capaciteit van 1.

### Een resource verwijderen

1. Klik op de prullenbak in de rij.
2. Heeft de resource toewijzingen, dan vraagt de app om bevestiging, bijvoorbeeld *'Metselaar' heeft 4 toewijzing(en) — verwijderen?* Klik op het vinkje om te verwijderen of op het kruisje om te annuleren. Zonder toewijzingen verdwijnt de resource meteen.

Met de resource verdwijnen ook haar toewijzingen. Heeft een taak waar de resource op stond een andere werkregel dan *Vaste duur en inzet*, dan verdeelt de app het werk van de verdwenen resource over de resources die blijven. Afhankelijk van de regel verandert daardoor hun inzet of de duur van de taak. Verandert de duur, dan is de planning verouderd.

Aanmaken, aanpassen en verwijderen kun je allemaal terugdraaien met *Ongedaan* (Ctrl+Z).

### Het kleine overzicht in de zijkolom

*Resources › Beheer › Resourcedock* zet een compact overzicht in de rechterkolom, naast *Eigenschappen*. Daar zie je de naam en de kleur van elke resource en een waarschuwingsteken (*Overbelast*) bij een resource die overbezet is. Alleen *Max. eenheden* kun je er wijzigen. Selecteer je een of meer taken, dan toont het overzicht alleen de resources van die taken.

## Valkuilen en wat de app dan doet

**Voor de berekening maakt alleen het type *Materiaal* verschil.** Arbeid, Materieel, Onderaannemer en Ploeg worden hetzelfde behandeld. Materiaal telt niet mee voor de duur van een taak en wordt niet genivelleerd. In het histogram telt de rij *Alle resources* materiaal ook niet mee.

**Geen naam, geen resource.** Een lege rij verdwijnt zonder spoor.

**Een nieuwe stap in de capaciteit.** Vergeet je datum en aantal aan te passen, dan is de capaciteit vanaf vandaag 1.

**Een resource weghalen die je nog nodig hebt.** Haal je hem per ongeluk weg, druk dan direct op Ctrl+Z. De toewijzingen komen dan ook terug.

## Zie ook

- [Resources toewijzen met een curve](docs://howto-resource-toewijzen): een resource op een taak zetten.
- [Een resourcekalender instellen](docs://howto-resourcekalender-instellen): de werkdagen van één resource vastleggen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als een resource op een dag te veel moet doen.
- [Resourcepaneel](docs://ref-resourcepaneel): alle velden en knoppen van het resourcepaneel.
