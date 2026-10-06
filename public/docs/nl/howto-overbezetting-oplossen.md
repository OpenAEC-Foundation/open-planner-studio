# Overbezetting oplossen

Doel: zien waar een resource op een dag te veel moet doen en dat oplossen, meestal door taken te nivelleren.

## Wanneer je dit nodig hebt

Op papier klopt je planning, maar de metselaar staat op twee muren die op dezelfde dagen lopen. Dat noemt de app **overbezetting**. Een resource is overbezet op een werkdag als de planning die dag meer van hem vraagt dan zijn capaciteit (*Max. eenheden*), of als hij die dag volgens zijn kalender niet werkt.

Je zoekt de overbezetting eerst op. Daarna kies je een oplossing. **Nivelleren** is de oplossing die de app zelf voor je berekent: hij laat taken later beginnen tot de resource het aankan. Hoe dat rekent, lees je in [Nivelleren](docs://uitleg-nivelleren).

## Stappen

### 1. Zoek de overbezetting

1. Kijk in het lint bij *Resources › Overallocatie*. Daar staat *Geen* of, in het rood, het aantal overbezette resources, bijvoorbeeld *1 resource*. Na een berekening staat ook in de statusbalk *⚠ 1 resource(s) overbezet*.
2. Klik op die melding in de statusbalk. Rechts opent het paneel *Waarschuwingen*, met per resource een regel, bijvoorbeeld *Metselaar* met *Overbezet op 5 dag(en) (29-06-2027 – 05-07-2027)*.
3. Klik op die regel. De app zet het histogram aan, kiest de resource en selecteert alle taken waar die resource op staat.
4. Bekijk het histogram onder de Gantt. Rode balken zijn overbezette dagen. Beweeg je de muis over een dag, dan zie je welke taken bijdragen, bijvoorbeeld *2 taken dragen bij op 2027-06-30* met de namen eronder.

Het histogram kun je ook zelf aanzetten met *Resources › Histogram › Histogram*. Kies links in de lijst een resource, of ga met *Vorige* en *Volgende* langs de resources. Een rode stip in de lijst betekent dat die resource overbezet is. De rij *Alle resources* telt de resources bij elkaar, zonder materiaal.

Is een taak geselecteerd, dan toont het histogram alleen de belasting van die taak en alleen de resources die eraan hangen. Druk op Esc om de selectie op te heffen en het hele project weer te zien.

### 2. Kies een oplossing

- **Meer capaciteit.** Komt er echt een tweede metselaar, zet dan *Max. eenheden* op 2 (zie [Resources beheren](docs://howto-resources-beheren)). De overbezetting is dan weg.
- **Minder inzet per dag.** Verlaag de *Eenh./dag* of kies een andere curve bij de toewijzing (zie [Resources toewijzen met een curve](docs://howto-resource-toewijzen)).
- **Taken achter elkaar zetten.** Leg een relatie tussen de twee taken, zodat de tweede pas begint als de eerste klaar is (zie [Relaties leggen](docs://howto-relaties-leggen)).
- **Nivelleren.** De app laat een taak later beginnen.

### 3. Nivelleren

1. Zorg dat de planning berekend is met **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*.
2. Kies *Resources › Nivellering › Nivelleren…*. Het venster *Resources nivelleren* opent.
3. Bepaal of de einddatum van het project mag opschuiven. Laat je het vakje *Alleen binnen speling nivelleren (smoothing) — projecteinddatum blijft vast* uit, dan mag de einddatum verschuiven. Zet je het aan, dan schuift de app taken alleen binnen hun speling.
4. Onder *Resources* staan de resources die genivelleerd worden. Standaard zijn alle resources aangevinkt, behalve materiaal. Haal het vinkje weg bij een resource die je met rust wilt laten.
5. Klik op *Berekenen*. Tijdens het rekenen staat er *Bezig met berekenen…* en kun je stoppen met *Stoppen*. De planning verandert nog niet: dit is een voorstel.
6. Lees het voorstel. Bovenaan staat de einddatum, bijvoorbeeld *Projecteinddatum: ongewijzigd (30-08-2027)* of *Projecteinddatum: 25-08-2027 → 30-08-2027*. Daaronder staat een tabel met per taak de *Oude start*, de *Nieuwe start* en de *Dagen verschoven*, bijvoorbeeld *Buitenspouwblad metselen*, 29-06-2027, 06-07-2027 en *5 d*.
7. Kies *Toepassen*. De app schrijft de vertragingen naar de taken en rekent de planning meteen opnieuw door. Drukken op F5 is niet nodig. *Annuleren* sluit het venster zonder wijziging.
8. Controleer *Resources › Overallocatie*. Daar staat nu *Geen*.

Wijzig je in het venster een optie nadat je op *Berekenen* hebt geklikt, dan verdwijnt het voorstel. Klik dan opnieuw op *Berekenen*. Wijzigt de planning terwijl de app rekent, dan meldt hij *De planning is gewijzigd tijdens het berekenen. Klik opnieuw op Berekenen.*

### Bepalen welke taak blijft staan

De app zet taken één voor één neer en de taken die eerst aan de beurt komen, blijven staan. De taken met de hoogste prioriteit gaan eerst. Bij gelijke prioriteit gaat de taak met de minste speling voor.

Wil je zelf bepalen welke taak blijft staan, geef die dan een hogere prioriteit. Klik met de rechtermuisknop op de balk van de taak in de Gantt en kies *Prioriteit*, dan *Laag* (100), *Normaal* (500) of *Hoog* (900). *Normaal* is de standaard. Je kunt ook zelf een getal van 0 tot en met 1000 typen in de kolom *Nivelleerprioriteit*: klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en kies onder *Planning* die kolom. Een hoger getal betekent dat de taak eerder blijft staan. Een groter getal dan 1000 neemt de app niet over. Een taak met prioriteit 1000 schuift nooit voor capaciteit.

### Terugdraaien en opnieuw doen

- *Ongedaan* (Ctrl+Z) draait *Toepassen* in één stap terug.
- *Resources › Nivellering › Nivellering wissen* haalt alle nivellering van de taken. De knop is grijs zolang er geen nivellering is. Overbezetting die je daarmee terugkrijgt, is er dan weer.
- Heb je de planning daarna gewijzigd, kies dan gewoon opnieuw *Nivelleren…*. De app begint dan van voren af aan: de oude vertragingen tellen niet mee.

## Valkuilen en wat de app dan doet

**Nog niet berekend.** Is de planning niet berekend, dan staat er in het venster *Bereken eerst de planning (F5) voordat je nivelleert.* en is *Berekenen* niet beschikbaar.

**Resterende conflicten.** Niet elke overbezetting is op te lossen door te schuiven. De taken die overblijven, staan onder *Resterende conflicten*, met het aantal dagen en de reden:

- *Onvoldoende vrije capaciteit binnen de speling om dit conflict op te lossen.* Dit zie je bij *smoothing*: binnen de speling van de taak is geen vrij moment. Haal het vinkje weg, dan mag de einddatum wel opschuiven.
- *De resource werkt niet op alle dagen die deze taak nodig heeft — verschuiven lost dit niet op.* De resource heeft in zijn eigen kalender vrije dagen midden in de taak. Pas de kalender of de taak aan.
- *Metselaar vraagt op de piek 2 eenh./dag, capaciteit is 1 — niet oplosbaar door schuiven.* De taak vraagt door haar curve alleen al op één dag meer dan de resource kan leveren. Kies een andere curve of een lagere inzet.

**Er staat** *Geen taken hoeven te verschuiven — de planning is al conflictvrij.* Staat die regel samen met de lijst *Resterende conflicten* in het voorstel, geloof dan de lijst. De regel zegt alleen dat er niets te verschuiven valt. Staat de regel zonder lijst, terwijl *Resources › Overallocatie* nog een resource meldt, dan zijn alle taken die botsen vastgepind op prioriteit 1000 of al gestart. Die schuiven niet en het venster meldt ze niet als conflict. Kijk daarom na het toepassen altijd naar *Overallocatie*.

**Taken die niet meeschuiven.** Een taak die al gestart of klaar is, schuift nooit. Haar belasting telt wel mee. Ook mijlpalen en fasen schuiven niet.

**Materiaal wordt niet genivelleerd.** Vraagt een materiaalresource op een dag meer dan zijn *Max. eenheden*, dan telt hij in *Overallocatie* wel als overbezet, maar staat hij niet in het nivelleervenster.

**Nivelleren past zich niet aan.** De vertragingen blijven staan zoals ze berekend zijn. Wijzig je later de duur van een taak, dan blijft een genivelleerde taak op zijn plek, ook als die plek nu niet meer nodig is. Nivelleer dan opnieuw.

**Overbezet door de kalender.** Werkt de resource op een dag niet volgens zijn kalender, dan meldt het paneel *Waarschuwingen* bijvoorbeeld *Overbezet op 5 dag(en) (29-06-2027 – 05-07-2027), waarvan 1 dag(en) waarop de resource niet werkt volgens zijn kalender*. Loopt een taak altijd over zo'n dag heen, wat de tweede reden hierboven is, dan lost nivelleren dat niet op.

## Zie ook

- [Nivelleren](docs://uitleg-nivelleren): wat nivelleren verschuift, binnen speling en erbuiten, en wat het niet doet.
- [Resources beheren](docs://howto-resources-beheren): capaciteit en kalender van een resource aanpassen.
- [Relaties leggen](docs://howto-relaties-leggen): taken achter elkaar zetten.
- [Meldingen en waarschuwingen](docs://ref-meldingen): de waarschuwing Overbezet in het paneel Waarschuwingen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): de stukadoors zijn op 5 dagen overbezet. Met *Alleen binnen speling nivelleren (smoothing)* aan blijft het einde op 17 augustus 2027 staan en houd je een restconflict. Met het vakje uit (de standaard) is alles opgelost en verschuift het einde naar 24 augustus 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): de torenkraan is op 65 dagen en de stukadoors zijn op 15 dagen overbezet. Nivelleren met het vakje *Alleen binnen speling nivelleren (smoothing)* uit schuift het einde van 9 mei naar 12 oktober 2028.
