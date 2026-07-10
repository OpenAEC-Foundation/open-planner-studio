# Resources, histogram & nivellering

Een taak vertelt je wanneer iets moet gebeuren; een resource vertelt je wie of wat het gaat doen — en hoeveel daarvan er op een dag beschikbaar is. Zodra je resources aan taken toewijst, kan een dag méér vragen dan er capaciteit is: een overallocatie. Deze gids laat zien hoe je resources beheert en toewijst, hoe je de belasting leest in het histogram, en hoe (en wanneer níét) nivellering een overallocatie oplost.

## Wat je hier leert

- De vijf resourcetypes en wanneer je welke gebruikt.
- Resources toewijzen aan taken — via het eigenschappenpaneel, de taakdialoog of het lint.
- Eenheden per dag en de zes verdeelcurves: wanneer kies je welke.
- Een toewijzing verplaatsen naar een andere taak.
- Resourcekalenders en tijd-gefaseerde capaciteit (bijvoorbeeld een tweede kraan die later bijkomt).
- Het histogram lezen: de resourcekiezer, drilldown per resource, overallocatie herkennen.
- Het gedockte resourcepaneel naast de Gantt.
- Nivelleren: de opties in het venster **Resources nivelleren**, het verschil tussen binnen-speling en einddatum-verschuiving, en prioriteiten (incl. prioriteit 1000 = "niet nivelleren").
- De eerlijke les: wanneer nivellering een overallocatie *niet* oplost.

Volg mee met [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (middelgroot, één opzettelijke en met nivellering oplosbare overallocatie op de stukadoors) en met [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (groot, vrijwel elke resource overbelast doordat drie torens tegelijk dezelfde ploegen en de torenkraan nodig hebben — de showcase waar nivellering tegen haar grenzen aanloopt).

## De vijf resourcetypes

Elke resource heeft een **Type** (kolom in het resourcepaneel):

- **Arbeid (LABOR)** — vakmensen: metselaars, stukadoors, installateurs.
- **Materieel (EQUIPMENT)** — machines en apparatuur: een torenkraan, een bouwlift.
- **Materiaal (MATERIAL)** — verbruiksgoederen met een **Eenheid** (bijvoorbeeld m³ beton). Materiaal wordt nooit genivelleerd en telt niet mee in het histogram — het is een voorraad, geen dagcapaciteit die kan overlopen.
- **Onderaannemer (SUBCONTRACTOR)** — een extern bedrijf met een eigen capaciteitsplafond, bijvoorbeeld een gevelbouwer die maar twee ploegen tegelijk kan leveren.
- **Ploeg (CREW)** — een overkoepelende groep. Andere resources kunnen via de kolom **Ploeg** in het paneel lid worden van een ploeg voor overzicht/groepering; dat is puur informatief, er is geen automatische optelling van capaciteit naar de ploeg toe.

## Resources beheren

Open het resourcepaneel via de lintgroep **Beheer** op het tabblad **Resources**: de knop **Resources** opent het volledige paneel (een aparte volledige-paneel-weergave, net als Tabel of Relaties), **Nieuwe resource** voegt direct een rij toe. In het paneel bewerk je per resource: **Naam**, **Type**, **Max. eenheden** (de capaciteit per werkdag — 1 = één persoon/stuk voltijds, 2 = twee eenheden tegelijk), **Kalender**, **Tarief/uur**, **Eenheid** (alleen materiaal) en **Ploeg** (bij welke ploeg deze resource hoort). Onderaan telt de kolom **Totaal** de kosten van elke resource op (belaste eenheden × uren/dag × tarief), herberekend bij elke F5.

### Tijd-gefaseerde capaciteit

Achter **Max. eenheden** staat een pijltje dat een subrij **Tijd-gefaseerde capaciteit** uitklapt: hier voeg je stappen toe (**Vanaf**-datum + **Max. eenheden**) voor een capaciteit die in de loop van het project verandert. De grote showcase gebruikt dit voor de torenkraan: die staat op **Max. eenheden 1**, met een stap die **vanaf dag 130** de capaciteit naar **2** brengt — het moment waarop een tweede kraan wordt bijgeplaatst. Vóór die datum moeten alle drie de torens het met één kraan doen; erna kunnen twee torens tegelijk hijsen.

## Resources toewijzen

Er zijn drie plekken waar je een toewijzing beheert — ze werken op dezelfde onderliggende data, dus wat je in de ene plek doet zie je meteen terug in de andere:

1. **Eigenschappenpaneel** — sectie **Toewijzingen** onder een geselecteerde taak: een dropdown **Resource toewijzen** met de nog-niet-toegewezen resources, en per bestaande toewijzing de **eenheden/dag**, de **curve** en een knop om de toewijzing te verwijderen.
2. **Taakdialoog** — dezelfde sectie **Toewijzingen**, in het venster **Taak bewerken**.
3. **Lint** — tabblad **Resources**, lintgroep **Toewijzing**, knop **Toewijzen ▾**. Deze knop is alleen actief als precies één niet-mijlpaal-, niet-samenvattende taak geselecteerd is; het uitklapmenu laat je eerst **eenheden/dag** en **curve** instellen en toont daaronder de nog-niet-toegewezen resources — klik een naam aan om in één keer een complete toewijzing te maken.

Mijlpalen en samenvattende taken kunnen geen resources dragen (ze hebben geen eigen duur om te belasten) — beide plekken tonen dat met een uitleg in plaats van het toewijzingsformulier.

### Een toewijzing verplaatsen

Wijs je een resource per ongeluk aan de verkeerde taak toe, of verhuis je werk van de ene naar de andere taak? In de sectie **Toewijzingen** van het eigenschappenpaneel (of de taakdialoog) staat naast elke toewijzing een dropdown **Verplaats naar…** met alle kandidaat-taken (leaf-taken zonder deze resource, exclusief de huidige taak). Kiezen verplaatst de toewijzing in één stap, inclusief eenheden en curve — zonder eerst te verwijderen en opnieuw aan te maken.

## Eenheden en verdeelcurves

Elke toewijzing heeft **eenheden/dag** (1 = één persoon/stuk voltijds, 0,5 = een halve dag) en een **curve** die bepaalt hoe die belasting over de duur van de taak verdeeld wordt:

- **Uniform** — vlak, elke dag evenveel. De standaard, en het juiste vertrekpunt voor de meeste taken.
- **Vooraan belast (FRONT_LOADED)** — het meeste werk vroeg in de taak, aflopend naar het einde.
- **Achteraan belast (BACK_LOADED)** — het spiegelbeeld: oplopend naar het einde toe, bijvoorbeeld een taak die op stoom moet komen.
- **Klokvorm (BELL)** — laag begin en einde, piek in het midden — een taak die opstart, op volle kracht draait en weer afbouwt.
- **Vroege piek (EARLY_PEAK)** — de piek zit vroeg in de taak, daarna neemt de belasting af.
- **Late piek (LATE_PEAK)** — de piek zit laat in de taak.

Curve-variatie is vooral zichtbaar in het histogram: dezelfde taak met dezelfde eenheden/dag geeft met een klokvorm-curve een heel andere staafverdeling dan met uniform. De middelgrote showcase gebruikt bewust een mix (uniform/vooraan/achteraan belast) op de afbouwtaken per woning, zodat je het verschil kunt vergelijken.

## Resourcekalenders

Een resource kan op de **Projectkalender** staan (standaard) of op een eigen kalender — bijvoorbeeld voor een onderaannemer die maar vier dagen per week beschikbaar is. Dit stel je in via de kolom **Kalender** in het resourcepaneel, of het veld **Kalender** in het eigenschappenpaneel van de resource zelf. Een resourcekalender raakt nooit de CPM-datums van de taak (die blijven op de taak-/projectkalender lopen) — hij beïnvloedt uitsluitend de **belasting** en de **nivellering**: werkt een resource op een dag niet die de taak wél nodig heeft, dan telt dat als een tekort in het histogram, en de nivelleerder waarschuwt dat schuiven dit kalendermismatch niet oplost. Zie de gids [Kalenders & uren-planning](docs://gids-kalenders-uren) voor de volledige uitleg van kalenders.

## Het histogram lezen

Zet het histogram aan via de lintgroep **Histogram** op het tabblad **Resources** (knop **Histogram**). Er verschijnt een strook onder de Gantt met dezelfde tijdas: staafjes per dag, met het deel boven de capaciteitslijn in rood.

Links van de staafjes, boven de taaktabel-kolom, staat de **resourcekiezer**: een lijstje met "Alle resources" bovenaan en daaronder elke resource, elk met een rood stipje als die resource ergens overbelast is. Klik op een naam om in te zoomen op precies die resource — het histogram herschaalt naar zijn belasting en capaciteit alleen. Klik terug op "Alle resources" om weer de som van alle resources te zien. Naast klikken kun je ook met de knoppen **Vorige**/**Volgende** in de lintgroep **Histogram** door de resources heen stappen, zonder de kiezer zelf aan te klikken.

Klik je op een overbelaste staaf, dan toont een tooltip hoeveel taken op die dag bijdragen aan de belasting, met de eerste paar taaknamen — handig om snel te zien wélke combinatie van taken de overallocatie veroorzaakt zonder elke toewijzing los na te lopen.

Staat er "Herbereken (F5) om de belasting te tonen" in plaats van staafjes, dan is de planning nog niet (opnieuw) doorgerekend sinds de laatste wijziging — het histogram is, net als het kritieke pad, een momentopname die je zelf ververst.

## Het gedockte resourcepaneel

Naast het volledige resourcepaneel (lintknop **Resources**) is er een compacte variant die je aan de rechterkant kunt vastzetten: knop **Vastzetten** in de lintgroep **Beheer**. Dit gedockte paneel toont alleen naam, **Max. eenheden** (direct bewerkbaar) en een rood/groen bolletje voor overallocatie — een snel overzicht naast je Gantt zonder het volledige paneel open te zetten. Het gedockte resourcepaneel en het eigenschappenpaneel van een taak sluiten elkaar wederzijds uit: je ziet er telkens één van de twee in de rechterrail.

## Overallocatie herkennen

Een resource is overbelast op een dag zodra de opgetelde eenheden van alle toewijzingen die dag boven zijn **Max. eenheden** komen. Dat zie je op drie plekken: het rode deel van de staaf in het histogram, het rode stipje in de resourcekiezer en het gedockte paneel, en de teller **Overallocatie** in de lintgroep op het tabblad Resources ("N resources" met een waarschuwingsicoon, of "Geen").

In de middelgrote showcase is dit met opzet zichtbaar: de **Stukadoors** (max. eenheden 2) krijgt begin juni een toewijzing van 2 eenheden op drie woningen tegelijk (het stucwerk van Woning 1, 2 en 3 overlapt daar enkele dagen) — op de piekdagen samen 6 eenheden, ruim boven de capaciteit van 2.

## Nivelleren

Open het venster **Resources nivelleren** via de knop **Nivelleren…** in de lintgroep **Nivellering** op het tabblad Resources. Het venster vereist een geldige, actuele berekening (bereken eerst met F5 als de planning verouderd is) en werkt in twee stappen: eerst **Berekenen** voor een voorstel, dan pas **Toepassen** — er verandert dus niets aan je planning voordat je het voorstel hebt gezien.

In het venster kies je:

- **Resources** — welke resources meedoen in de nivellering (standaard allemaal, materiaal is altijd uitgesloten — dat wordt nooit genivelleerd).
- **Alleen binnen speling nivelleren (smoothing)** — een aanvinkvakje met een duidelijke ondertitel: "projecteinddatum blijft vast". Uit (**nivelleren**) mag de nivelleerder taken zo ver verschuiven als nodig, ook voorbij hun eigen speling, wat de einddatum van het project kan opschuiven. Aan (**smoothing**) blijft de einddatum heilig — de nivelleerder schuift alleen binnen de bestaande speling van elke taak, en een conflict dat daarbinnen niet past, blijft gewoon als resterend conflict staan.

Na **Berekenen** toont het venster een tabel met elke taak wiens start verandert (oude start → nieuwe start → aantal dagen verschoven), een regel die meldt of de projecteinddatum wijzigt, en — als er conflicten overblijven — een sectie **Resterende conflicten** met per taak de reden: een kalendermismatch (de resource werkt niet op de dagen die de taak nodig heeft), onvoldoende vrije capaciteit binnen de speling, of een intrinsieke overvraag (één toewijzing vraagt op zijn piek al meer dan de resource ooit kan leveren — geen enkele verschuiving lost dát op). Pas als je tevreden bent met het voorstel klik je **Toepassen**.

Test dit zelf op de stukadoors-overallocatie in de middelgrote showcase: open **Nieuwbouw 6 Rijwoningen De Akkers**, ga naar het tabblad **Resources** en open **Resources nivelleren**. Laat alle resources aangevinkt, laat smoothing uít en klik **Berekenen**: de conflicten verdwijnen volledig (0 resterende conflicten), maar de projecteinddatum schuift ongeveer een week op. Vink daarna **Alleen binnen speling nivelleren** aan en bereken opnieuw: de einddatum blijft nu ongewijzigd, maar er blijft één taak (stucwerk in een van de woningen) als resterend conflict staan — er is simpelweg niet genoeg speling om hem geheel binnen de bestaande planning te passen. Dat is precies de afweging die dit selectievakje zichtbaar maakt: los je het probleem op door de einddatum los te laten, of houd je de einddatum vast en accepteer je een gemarkeerd restconflict?

### Prioriteiten

Elke taak heeft een **nivelleer-prioriteit** van 0 tot 1000 (standaard 500). Rechtsklik een taak en kies **Prioriteit** voor drie presets: **Laag** (100), **Normaal** (500) en **Hoog** (900) — bij een capaciteitsconflict tussen twee taken krijgt de taak met de hoogste prioriteit voorrang bij het toewijzen van de schaarse capaciteit. De waarde **1000** is een speciaal geval: "niet nivelleren" (MS Project noemt dit "Do Not Level"). Zo'n taak loopt wel gewoon mee in de nivelleerlus en volgt zijn eventueel verschoven voorgangers, maar wordt zelf nooit verschoven om capaciteit vrij te maken. De grote showcase gebruikt dit op "Nutsaansluitingen aanleggen": een vaste aansluitdatum van het nutsbedrijf die niet mag opschuiven, ongeacht wat de nivellering verder voorstelt.

Nivellering wissen (lintgroep **Nivellering**, knop **Nivellering wissen**) verwijdert alle eerder toegepaste verschuivingen weer in één keer — handig om terug te gaan naar de oorspronkelijke, ongenivelleerde planning zonder elke taak los terug te zetten.

## De eerlijke les: wanneer nivellering niet helpt

Nivellering lost een overallocatie op door werk in de tijd te herschikken — binnen speling, of desnoods met een latere einddatum. Dat werkt goed zolang er ergens in de planning genoeg ruimte (speling of tijd) zit om het teveel aan vraag te herverdelen. Het werkt principieel *niet* wanneer de vraag structureel groter is dan wat er ooit beschikbaar zal zijn, hoe je ook schuift.

De grote showcase laat dit zien op meerdere resources tegelijk: doordat de drie torens grotendeels gelijktijdig lopen en dezelfde ploegen (metselaars, installateurs, stukadoors, tegelzetters, de torenkraan) delen, is vrijwel elke arbeidsresource op enig moment overbelast. Nivelleer je met alle resources geselecteerd en de einddatum vrij, dan verdwijnt het gros van de conflicten — maar de projecteinddatum schuift maanden op, en een handvol afwerktaken (tegelwerk, keukens, sanitair, schilderwerk) per toren blijft als intrinsieke overvraag staan: de piekbelasting van één enkele toewijzing overschrijdt daar al de capaciteit, dus geen enkele verschuiving helpt. Zet je smoothing aan om de einddatum te beschermen, dan blijft een veel groter deel van de conflicten simpelweg onopgelost staan.

De les is niet dat nivellering "niet werkt" — het algoritme doet precies wat gevraagd wordt. De les is dat nivellering een **plannings**-instrument is, geen **capaciteits**-instrument: het herschikt bestaand werk in bestaande tijd, maar het maakt geen extra vakmensen, materieel of kalenderdagen vrij. Een structureel tekort — te weinig stukadoors voor drie torens tegelijk, één torenkraan die drie bouwplaatsen moet bedienen — vraagt om een andere ingreep: meer capaciteit inhuren, de fasering aanpassen (torens na elkaar in plaats van gelijktijdig, zoals de tweede-kraan-stap vanaf dag 130 al deels doet), of het werk anders verdelen. Nivellering is het instrument dat je laat zíen waar dat schuurt; het lost het onderliggende capaciteitsvraagstuk niet voor je op.

## Verder lezen

- Speel de nivellering van de stukadoors-overallocatie zelf na in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Zie de grens van nivellering in de praktijk — en alle vijf resourcetypes, alle zes curves en de tijd-gefaseerde torenkraan-capaciteit — in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Resources werken op kalenders — lees de gids [Kalenders & uren-planning](docs://gids-kalenders-uren) voor resourcekalenders en uren-planning.
- Wil je een basislijn vastleggen vóórdat je gaat nivelleren, zodat je het verschil kunt zien? Lees de gids [Baselines & voortgang](docs://gids-baselines-voortgang).
- Nivellering verandert soms welke taken kritiek zijn — lees de gids [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) voor hoe je dat herkent.
