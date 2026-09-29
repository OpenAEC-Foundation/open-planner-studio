# Voortgang, statusdatum en baseline

Een planning is een voorspelling. Zodra het werk loopt, wil je weten wat er klaar is, wat er nog moet en wat dat voor de oplevering betekent. In dit artikel lees je hoe de app voortgang verwerkt: wat de statusdatum doet, hoe ze het restwerk uitrekent, waarom een taak die al begonnen is soms toch op zijn voorganger wacht, en hoe je de stand vergelijkt met de oorspronkelijke afspraak. Een uitgewerkt voorbeeld laat de getallen zien.

## Het begrip

**Voortgang** is wat er werkelijk gebeurd is. Per taak legt de app drie dingen vast: een percentage, een **werkelijke start** en een **werkelijk einde**. Wat de planning voorspelde, blijft daarnaast bestaan; het werkelijke is wat er echt gebeurde.

De **statusdatum** is de dag waarop je de stand opneemt. Alles wat vóór die dag gebeurd is, is een feit. Alles wat nog moet gebeuren, plant de app vanaf het begin van die dag. Een werkelijke datum mag op de statusdatum liggen, maar nooit erna. In een paar meldingen heet de statusdatum *peildatum*; het is hetzelfde.

Het **restwerk** is wat er van een taak nog te doen is. Een taak van 4 werkdagen die voor 25 % klaar is, heeft nog 3 werkdagen restwerk.

Een **baseline** is een foto van de planning op een bepaald moment, meestal het moment waarop de afspraak goedgekeurd is. Later leg je de werkelijke planning ernaast en zie je hoeveel de uitvoering afwijkt.

## Hoe de app rekent

Het voorbeeld hieronder gebruikt het rekenprofiel *Open Planner Studio*, waarmee een nieuw project rekent. Verderop staat wat er in de profielen Primavera P6 en Microsoft Project anders is.

De app rekent niet vanzelf door. Na elke wijziging in voortgang of statusdatum meldt de statusbalk *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Planning › Planning › Bereken*. Staat *Automatisch berekenen* aan (onder *Instellingen › Project › Instellingen*, tabblad *Planning*, kopje *Berekenen*), dan doet de app dat zelf.

### De statusdatum

De statusdatum doet drie dingen.

Ten eerste weigert de app een werkelijke datum na de statusdatum. Een datum op de statusdatum zelf mag wel.

Ten tweede kan werk dat nog niet begonnen is niet in het verleden liggen. Ligt zo'n taak volgens de planning voor de statusdatum, dan schuift de app hem naar de statusdatum. Dat geldt ook voor de taken erna, die via hun relaties meeschuiven. Het effect zie je in het voorbeeld hieronder. In het profiel Microsoft Project doet de app dit niet.

Ten derde begint het restwerk van een taak die al loopt op de statusdatum zelf. De app behandelt de statusdatum als het begin van die dag. Neem je de stand vrijdag na werktijd op, dan zet je de statusdatum dus op maandag. Zet je hem op vrijdag, dan plant de app het restwerk nog op die vrijdag.

Heb je nog geen statusdatum en vul je voortgang in, dan zet de app de statusdatum op vandaag en meldt dat. Zonder statusdatum rekent de app een lopende taak vooruit met de restduur maar achteruit met de volle duur; de speling komt dan negatief uit en de taak lijkt onterecht kritiek.

### Percentage, werkelijke datums en restduur

De velden hangen aan elkaar. Als je er één invult, vult de app de andere aan.

- Een percentage boven 0 betekent dat de taak gestart is. Geef je geen werkelijke start op, dan neemt de app de geplande start. Begint de taak volgens de planning pas na de statusdatum, dan vraagt de app eerst wanneer hij werkelijk begon.
- Een percentage van 100 betekent voltooid. Geef je geen werkelijk einde op, dan wordt dat de statusdatum, ook als het werk in werkelijkheid eerder klaar was.
- Een werkelijk einde maakt de taak 100 %. Zet je een voltooide taak terug onder de 100 %, dan vervalt het werkelijke einde. Wis je het werkelijke einde, dan gaat het percentage terug naar 0 en blijft de taak *Bezig*, tot je ook de werkelijke start wist.
- De **restduur** is de duur maal wat er nog te doen is, afgerond op hele werkdagen. Voor een taak van 2 werkdagen geven 0 % en 25 % allebei 2 werkdagen restwerk, en 50 % en 75 % allebei 1. Bij 90 % rondt de app af op 0: het restwerk is dan op de statusdatum klaar. Een taak in uren rekent in hele minuten: een taak van 5 uur op 40 % heeft 3 uur restwerk.
- Een mijlpaal heeft maar één werkelijke datum.
- Een fase (samenvattende taak) heeft geen eigen voortgang. Haar percentage volgt na het berekenen uit de taken eronder: het gewogen gemiddelde van hun percentages, met de duur in werkdagen als gewicht. Een mijlpaal weegt 0.

Wijzig je de duur van een taak die al loopt, dan blijft het gedane werk gedaan. Het percentage past zich aan: een taak van 5 werkdagen op 60 % die je naar 10 werkdagen zet, komt op 30 %. Een duur die korter is dan het gedane werk weigert de app.

### Voltooide en lopende taken

Een voltooide taak staat vast op zijn werkelijke datums. Hij verschuift niet meer, en met een statusdatum is hij nooit kritiek. Zonder statusdatum kan een voltooide taak nog wel kritiek zijn.

Een lopende taak houdt zijn werkelijke start. Alleen het restwerk verschuift. Waar het restwerk begint, hangt van de voortgangsmodus af.

### Retained Logic en Progress Override

Wat doet de app als een taak al begonnen is terwijl zijn voorganger nog loopt? Zo'n relatie heet **out-of-sequence**: de voortgang spreekt de volgorde tegen. Denk aan de schilder die al begint in een kamer die al gestuukt is, terwijl de stukadoor elders nog bezig is.

Twee voortgangsmodi bepalen hoe de app daarmee rekent:

- **Retained Logic** (de standaard): de relatie blijft gelden. Het restwerk van de opvolger begint pas als de voorganger klaar is, en nooit vóór de statusdatum.
- **Progress Override**: de werkelijkheid wint. Het restwerk van de opvolger begint op de statusdatum, zonder te wachten op de voorganger.

In dit profiel zit het verschil alleen in het restwerk van taken die al begonnen zijn terwijl hun voorganger nog niet klaar is. Andere taken rekenen in beide modi hetzelfde. De app meldt zo'n relatie in beide modi: in de statusbalk als *1 out-of-sequence-relatie(s)* en in het paneel *Waarschuwingen*.

### Baselines en afwijking

Bij het opslaan legt de app van elke taak zonder onderliggende taken de vroegste start, het vroegste einde, de duur en het mijlpaalsoort vast. Fasen staan er niet in. Wat je daarna wijzigt, raakt de baseline niet. Je kunt meer baselines bewaren; precies één is **actief**. De actieve baseline gebruiken de Gantt, het Variance-rapport en het Voortgangsrapport.

De **afwijking** is het verschil in werkdagen tussen de baseline en de huidige planning. Een plus betekent later, een min eerder. De app telt in de kalender van het project. Het Variance-rapport geeft per taak de afwijking van start en einde. De status volgt alleen uit het einde: *Later* bij een plus, *Eerder* bij een min, anders *Op schema*. Een taak die na de baseline is toegevoegd, heet *Nieuw*; een taak die er niet meer is, *Vervallen*.

Twee kanttekeningen. De duurafwijking vergelijkt de geplande duur van de taak nu met die in de baseline. Voortgang verandert die geplande duur niet: een taak die twee dagen gepland stond en drie dagen duurde, heeft dus een eindafwijking van +1 maar een duurafwijking van 0. En als je een baseline opslaat nadat er voortgang is ingevuld, legt hij de stand met die werkelijke datums vast; de afwijking is dan nul.

Het Voortgangsrapport zet de geplande voortgang naast de werkelijke. Beide zijn gewogen naar werkdagen. Gepland is het deel van elke taak dat volgens de baseline op de statusdatum klaar had moeten zijn; werkelijk is het ingevulde percentage.

### Waar je het ziet

In de Gantt staat een gestippelde lijn op de statusdatum, met de datum in de kop. Bij elke lopende taak buigt de lijn uit naar het punt in de balk dat het percentage aangeeft. Dat is de **voortgangslijn**. Zet je de voortgangslijn uit en laat je de statusdatumlijn aan, dan blijft er een rechte lijn over; staan beide uit, dan verdwijnt lijn en label. De knoppen *Baseline-overlay*, *Voortgangslijn* en *Statusdatumlijn* staan onder *Beeld › Baselines & voortgang* en veranderen niets aan de berekening. De baseline verschijnt als dunne balk onder elke taakbalk. In de takentabel zijn er kolommen voor voortgang en, per baseline, voor de afwijking. Op het tabblad *Rapport* staan de rapporttypes *Variance* en *Voortgangsrapport*.

## Rekenvoorbeeld: de aanbouw na drie weken

Het voorbeeld is het oefenproject *Aanbouw woning* uit de tutorials, in de stand nadat alle relaties gelegd zijn: zonder bouwvak, resources of uren. In tutorial 6 doe je dit zelf in het oefenproject. Dat project heeft daar al meer aan boord, dus de getallen wijken daar af. Hier lees je waarom de getallen zijn wat ze zijn.

De uitbouw start op maandag 7 juni 2027. Op de berekende planning slaat de app de baseline *Basisplanning* op: oplevering vrijdag 6 augustus 2027, 45 werkdagen.

### De stand op maandag 28 juni

De statusdatum is maandag 28 juni 2027. Dit is er gebeurd:

- *Start bouw*, *Bouwplaats inrichten*, *Tuin en bestrating verwijderen* en *Aanbouw uitzetten* zijn klaar volgens planning, van 7 tot en met 10 juni.
- *Funderingssleuf ontgraven* was gepland op 2 werkdagen (vrijdag 11 en maandag 14 juni) en duurde 3: van 11 tot en met 15 juni.
- *Wapening en bekisting fundering* loopt van 16 tot en met 18 juni. *Inspectie wapening* is op 18 juni, *Fundering storten* op maandag 21 juni.
- *Funderingsmetselwerk* (2 werkdagen) begon op vrijdag 25 juni en staat op 50 %.

Na **Bereken** rekent de app zo:

- Het restwerk van het funderingsmetselwerk is 2 × (1 − 0,5) = 1 werkdag. Het begint op de statusdatum, dus het eindigt op maandag 28 juni.
- *Kanaalplaatvloer leggen* volgt op dinsdag 29 juni. Daardoor begint *Binnenspouwblad metselen* op woensdag 30 juni in plaats van dinsdag 29 juni. De oplevering komt op maandag 9 augustus: één werkdag later dan de baseline. De ene extra dag van het ontgraven is dus de vertraging van het hele project, omdat die taak op het kritieke pad lag.
- De statusbalk meldt *Kritiek pad: 13 taken, 46 werkdagen*, tegen 21 taken en 45 werkdagen voor de voortgang. De acht voltooide taken die op het kritieke pad lagen, tellen niet meer mee.
- De fase *Fundering* staat op 77,8 %. De taken erin wegen 2 + 3 + 1 + 2 + 1 = 9 werkdagen. Klaar zijn 2 + 3 + 1 werkdagen, plus de helft van 2: samen 7. En 7 van de 9 is 77,8 %. De mijlpaal *Inspectie wapening* weegt 0.

Het Variance-rapport zet dit naast de baseline:

- *Funderingssleuf ontgraven*: start 0, einde +1 (baseline-einde 14 juni, nu 15 juni).
- *Funderingsmetselwerk*: start +1 (24 juni werd 25 juni), einde +1.
- *Buitenspouwblad metselen*: +1, +1. Die taak is toch niet kritiek: hij had 2 werkdagen speling en houdt die.
- *Oplevering*: +1. Het projecteinde wijkt 1 werkdag af.
- In totaal staan 19 taken op *Later* en 4 op *Op schema*; geen taak staat op *Eerder*.

Het Voortgangsrapport meldt *Gepland* 28,3 % en *Werkelijk* 23,9 %. De taken wegen samen 46 werkdagen. Volgens de baseline hadden er 13 klaar moeten zijn: 4 werkdagen in de voorbereiding, 2 voor het ontgraven, 3 voor de wapening, 1 voor het storten, 2 voor het funderingsmetselwerk en 1 voor de kanaalplaatvloer. Werkelijk zijn er 11 klaar: 4 + 2 + 3 + 1, plus de halve dag van het funderingsmetselwerk.

### Wat als je de statusdatum verzet?

Dezelfde voortgang, een andere statusdatum. Het restwerk van het funderingsmetselwerk begint steeds op de statusdatum, dus de oplevering schuift mee:

- Statusdatum vrijdag 25 juni: het restwerk valt op vrijdag 25 juni, de oplevering blijft vrijdag 6 augustus.
- Maandag 28 juni: oplevering maandag 9 augustus.
- Dinsdag 29 juni: oplevering dinsdag 10 augustus, 2 werkdagen later dan de baseline.

### Wat als je het percentage verandert?

Het funderingsmetselwerk heeft 2 werkdagen. Bij 0 % of 25 % is het restwerk 2 werkdagen: het eindigt dinsdag 29 juni en de oplevering wordt dinsdag 10 augustus. Bij 50 % of 75 % is het 1 werkdag: maandag 28 juni, oplevering maandag 9 augustus. Bij 90 % is het restwerk 0 en eindigt de taak op de statusdatum.

### Wat als je een statusdatum zet zonder voortgang in te vullen?

Zet je alleen de statusdatum op maandag 28 juni en vul je niets in, dan is er in de planning nog niets gebeurd. Werk dat niet begonnen is, kan niet in het verleden liggen. De app schuift daarom alles naar 28 juni: *Start bouw* staat dan op die dag, en de oplevering komt op vrijdag 27 augustus, 15 werkdagen na de baseline. Vul dus eerst de voortgang in die er is.

## Rekenvoorbeeld: stukadoor en schilder

Nu een voorbeeld voor de voortgangsmodus. Dezelfde aanbouw, andere stand: het is woensdag 21 juli 2027. Alles tot en met *Installaties aanleggen* is klaar volgens planning. *Stucwerk* (4 werkdagen) is dinsdag 20 juli begonnen en staat op 25 %. *Schilderwerk* (3 werkdagen) volgt op het stucwerk, maar de schilder is vandaag al begonnen en staat op 33 %.

Zonder voortgang stond het stucwerk gepland op dinsdag 20 tot en met vrijdag 23 juli, en het schilderwerk op maandag 26 tot en met woensdag 28 juli. De statusbalk meldt nu *1 out-of-sequence-relatie(s)*: het schilderwerk is gestart terwijl het stucwerk niet klaar is. In het paneel *Waarschuwingen* staat: *Out-of-sequence: de voortgang van de opvolger spreekt de relatie tegen*.

Het stucwerk heeft 4 × (1 − 0,25) = 3 werkdagen restwerk: 21, 22 en 23 juli. Het schilderwerk heeft 3 × (1 − 0,33) = 2 werkdagen restwerk.

- Bij **Retained Logic** kan dat restwerk pas beginnen als het stucwerk klaar is. Dat is vrijdag 23 juli, dus het schilderwerk begint maandag 26 juli en eindigt dinsdag 27 juli. De balk loopt van de werkelijke start op 21 juli tot 27 juli. De totale speling is 7 werkdagen.
- Bij **Progress Override** begint het restwerk op de statusdatum. Het schilderwerk eindigt donderdag 22 juli, voordat het stucwerk klaar is. De totale speling is 10 werkdagen.

De oplevering blijft in beide gevallen vrijdag 6 augustus: het schilderwerk had toch al speling.

### Andere rekenprofielen

In de profielen Primavera P6 en Microsoft Project eindigt het schilderwerk in dit voorbeeld op dezelfde data (27 en 22 juli). Ze verschillen op deze punten. Het zijn conventies van het profiel; je vindt ze bij *Instellingen › Project › Projectinfo*, in het blok *Rekenprofiel en reken-opties*.

- In het profiel Microsoft Project schuift werk dat niet begonnen is niet naar de statusdatum (conventie *Niet-gestarte taken niet naar de statusdatum*). Zet je in het voorbeeld hierboven alleen een statusdatum en vul je niets in, dan blijft de oplevering in dat profiel vrijdag 6 augustus.
- Microsoft Project hervat het restwerk niet op de statusdatum, maar op de werkelijke start plus de al verstreken duur (conventie *Restwerk hervat na de al verstreken duur*). Neem *Binnenspouwblad metselen* (5 werkdagen), begonnen op dinsdag 29 juni en op woensdag 30 juni, de statusdatum, op 40 % (twee ploegen). Alles ervoor is klaar volgens planning. Open Planner Studio en Primavera P6 laten de taak eindigen op vrijdag 2 juli; Microsoft Project op maandag 5 juli.
- Primavera P6 toont als vroegste start van een lopende taak het begin van het restwerk, niet de werkelijke start (in het voorbeeld met het binnenspouwblad woensdag 30 juni). Progress Override werkt daar bovendien achterwaarts (conventie *Progress Override negeert een gestarte opvolger ook achterwaarts*). Bij het openen van een .xer-bestand neemt de app de voortgangsmodus uit het bestand over. Actual Dates, de derde P6-modus, kent de app niet; zo'n bestand rekent als Retained Logic.

## Gevolgen en misverstanden

**"Ik zet de statusdatum even door."** Verzet je hem, dan begint het restwerk van lopende taken op de nieuwe datum, en werk dat nog niet begonnen is kan nooit voor die datum liggen. Verzet de statusdatum daarom alleen samen met een update van de voortgang.

**"Een taak op 100 % is altijd op tijd klaar."** Zet je een taak op 100 % zonder werkelijk einde, dan wordt dat de statusdatum. Was hij in werkelijkheid eerder klaar, vul dan het werkelijke einde in.

**"0 % betekent niet begonnen."** Heeft een taak een werkelijke start, dan telt hij als begonnen, ook op 0 %. Het restwerk is dan de volle duur en begint op de statusdatum. Wis de werkelijke start om hem weer als niet begonnen te laten tellen.

**"Progress Override lost de waarschuwing op."** De melding over out-of-sequence blijft staan. De modus bepaalt alleen hoe de app rekent. Klopt de relatie niet meer, pas dan de relatie aan.

**"Een gesplitste taak rekent gewoon door."** Een pauze in het nog te doen deel blijft in het restwerk zitten. Neem een taak van 5 werkdagen met na 2 dagen werk 1 dag pauze, begonnen op dinsdag 29 juni en met de statusdatum op woensdag 30 juni op 40 %. Het restwerk van 3 werkdagen begint op de statusdatum en loopt door de pauze: het einde is maandag 5 juli. Zonder pauze was het vrijdag 2 juli.

**Uren en de statusdatum.** In het lint vul je de statusdatum als datum in, zonder tijd. Een urentaak rekent het restwerk vanaf het begin van die werkdag. Op de kalender van het oefenproject (werkdag vanaf 07:00) heeft een taak van 5 uur op 40 %, met de statusdatum op de dag zelf, 3 uur restwerk. Dat loopt van 07:00 tot 10:00, ook al is er die ochtend al gewerkt. Hoe de app uren telt, staat in [Dagen en uren](docs://uitleg-dagen-en-uren).

**Een baseline bijwerken.** Dat kan niet. Je slaat een nieuwe op en verwijdert de oude. Verplaats je het project, dan schuiven de werkelijke datums en de statusdatum mee, maar de baselines standaard niet: zo blijft de verschuiving als afwijking zichtbaar.

## Zie ook

- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): de statusdatum zetten en voortgang invullen.
- [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren): voortgang van uitvoerders in één keer inlezen.
- [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen): Retained Logic of Progress Override instellen.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): een baseline vastleggen en gebruiken.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): waarom een taak kritiek is en wat speling betekent.
