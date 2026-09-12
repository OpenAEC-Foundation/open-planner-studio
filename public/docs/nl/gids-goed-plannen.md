# Goed plannen

De andere gidsen leggen uit hóé iets werkt: waar de knop zit, wat een veld doet, hoe een venster
zich gedraagt. Deze gids gaat over de vraag die daarvóór komt — wat maakt een planning goed? Een
goede planning is geen plaatje van wat je hoopt, maar een rekenmodel dat antwoord geeft op de enige
vraag die er tijdens de uitvoering toe doet: als dít verschuift, wat gebeurt er dan met de
oplevering?

Hieronder staat, in de volgorde waarin een planner werkelijk werkt, wat je doet en waarom. Voor de
bediening wordt per onderdeel doorverwezen naar de gids waar de knoppen staan. De voorbeelden komen
uit de bouw — ruwbouw, afbouw, levertijden, weerverlet, onderaannemers, een contractuele
opleverdatum — maar de principes zelf zijn niet bouwspecifiek.

## De volgorde

1. Het doel: mijlpalen en opleverdatum.
2. De opdeling: fasen, werkpakketten, taken.
3. De duur per taak.
4. De relaties.
5. Constraints en vaste datums.
6. Kalenders.
7. Resources.
8. Kritiek pad en speling.
9. Baseline en voortgang.
10. Nalopen.

Die volgorde is geen etiquette. Sla je een stap over, dan komt hij terug als verrassing: taken zonder
relaties bewegen niet mee, duren zonder kalender kloppen niet, en een baseline die je pas achteraf
vastlegt bevriest de vertraging in plaats van de afspraak.

## Begin bij het doel, niet bij de taken

Zet eerst de momenten neer die vastliggen, en pas daarna het werk dat ertussen moet passen: start
bouwrijp maken, vergunning onherroepelijk, waterdicht, start afbouw, oplevering. Dat zijn mijlpalen
— punten zonder duur, die je in Open Planner Studio ook echt als mijlpaal invoert en niet als taak
van nul dagen met een naam die erop lijkt.

Waarom deze volgorde: een planning die begint bij een lijst taken wordt een optelsom, en een
optelsom komt zelden uit op de datum die in het contract staat. Begin je bij de mijlpalen, dan is de
vraag meteen de goede — niet "hoe lang duurt dit alles bij elkaar", maar "past het werk tussen deze
twee momenten, en zo niet, wat moet er dan anders". Reken vanaf de gewenste opleverdatum terug naar
wat er dan uiterlijk waterdicht moet zijn, en van daaruit naar de start.

Een oplevering die contractueel vastligt markeer je als verplichte mijlpaal, zodat iedereen die het
bestand opent ziet dat dat moment onderhandelbaar noch verschuifbaar is. De drie soorten mijlpalen —
start, eind, inspectiemoment — en de aparte contractuele vlag staan in de gids
[Plannen & WBS](docs://gids-plannen-wbs).

## De opdeling: fasen, werkpakketten, taken

Onder de mijlpalen bouw je de structuur: fasen, daaronder werkpakketten, daaronder taken. In Open
Planner Studio doe je dat door in te springen; een taak met subtaken wordt vanzelf een samenvattende
taak waarvan de balk de onderliggende taken overspant. Voer een samenvattende taak dus nooit zelf een
duur in — die is altijd afgeleid.

De vuistregel voor granulariteit: **een taak duurt tussen ongeveer één dag en twee weken**. Dat is
geen willekeurig getal. Korter dan een dag betekent dat je de werkvloer aan het plannen bent in
plaats van het project — dat hoort op de weekplanning van de uitvoerder, niet in een CPM-model dat
maandenlang mee moet. Langer dan twee weken betekent dat je een taak hebt die je niet fatsoenlijk
kunt inschatten en tijdens de uitvoering niet kunt volgen: "afbouw begane grond, 40 dagen, 45%
gereed" vertelt niemand of het goed gaat. In schedule-reviews wordt daarom vaak hard geteld hoeveel
taken langer dan ongeveer twee maanden duren; boven een paar procent geldt dat als een gebrek aan
detail.

Te fijn is net zo schadelijk als te grof, en dat wordt onderschat. Elke taak kost onderhoud: relaties
leggen, voortgang bijhouden, na elke wijziging opnieuw beoordelen. Een planning van tweeduizend
taken voor een project van zes maanden wordt niet nauwkeuriger, hij wordt onbijgehouden — en een
planning die niemand bijwerkt is binnen drie weken fictie. Kies het niveau waarop je wekelijks
eerlijk voortgang kunt melden.

Praktisch: "3. Afbouw" is een fase, "Afbouw woning 4" een werkpakket, "Stucwerk woning 4 begane
grond" een taak van vijf dagen. Uitzonderingen op de bovengrens mag je bewust maken voor levertijden
en toezicht — een kozijnlevering van tien weken ís één ondeelbaar wachtblok, en doorlopend toezicht
hoort in een hammock thuis in plaats van in een reeks kunstmatige stukken.

## De duur schatten

Een duur is een schatting van hoe lang het werk duurt, niet van hoe snel het zou kunnen. Schat op een
normale dag met de ploeg die je werkelijk krijgt, niet op de beste dag met de beste ploeg. Dat klinkt
vanzelfsprekend en gaat toch het vaakst mis: optimisme stapelt zich op door de keten, en een planning
waarin elke taak de beste dag aanneemt haalt zijn opleverdatum vrijwel nooit.

Dagen of uren is een echte keuze, geen opmaak. Kies **dagen** voor werk dat de bouwplaats beheerst —
metselen, stucwerk, tegelwerk: het duurt vijf dagen, ook als er een dag acht en een dag negen uur
gewerkt wordt. Kies **uren** wanneer het aantal uren zelf de eenheid is en de restdag ertoe doet: een
keuring van drie uur, een betonstort van veertien uur die over twee dagen valt, werk in ploegendienst.
Open Planner Studio bewaart die keuze per taak en rekent niets stil om; hoe dat precies werkt staat in
de gids [Kalenders, werkdagen en werkuren](docs://gids-kalenders-uren).

Stop geen risico in de duur van losse taken. Wie overal een dag extra bijtelt, verstopt de marge
zodat niemand hem meer kan zien of sturen — en op de plek waar de marge echt nodig was, is hij te
klein. Maak reserve zichtbaar: een expliciete buffertaak vóór de opleverdatum, of een aparte
weerverletpost. Voor buitenwerk in de winter is dat geen luxe. Let daarbij op dubbeltelling: de
ongeveer 180 werkbare werkdagen per jaar waarmee in de Nederlandse bouw gerekend wordt, is een
contractueel jaargetal (UAV) waar feestdagen, bouwvak én verlet al vanaf zijn getrokken. Staan de
feestdagen en de bouwvak dus al in je projectkalender, dan resteert alleen het weerverlet als aparte
post — tel het jaargetal er niet nog eens overheen. Vorst- en stormverlet volgt een eigen regeling in
de cao Onwerkbaar weer Bouw & Infra. Zet die verwachte verletdagen in de kalender of als aparte post,
niet verstopt in de duur van het metselwerk.

## Relaties: zonder netwerk is het geen planning

Elke taak krijgt minstens één voorganger en minstens één opvolger. Alleen de eerste taak van het
project en de laatste mijlpaal zijn daarop de uitzondering. Een taak zonder relaties staat stil
terwijl de rest beweegt: verschuift de ruwbouw twee weken, dan schuift een losgekoppelde afbouwtaak
niet mee, en de planning liegt zonder dat er iets rood kleurt. Dit is de meest voorkomende fout in
planningen die op het eerste gezicht netjes ogen, en in een schedule-review is het de eerste
controle: minder dan een paar procent van de taken mag ontbrekende logica hebben.

**Eind-start is de standaard**, en hoort dat ook te blijven: eerst de fundering af, dan de ruwbouw.
In een gezonde bouwplanning is ruwweg negen van de tien relaties eind-start. Dat is geen dogma maar
een leesbaarheidseis — eind-start is het enige type dat iedereen op de bouwplaats zonder uitleg
begrijpt, en het enige type dat zich tijdens de uitvoering voorspelbaar gedraagt.

**Start-start met een lag** gebruik je waar werk echt meeloopt in plaats van erop wacht. Het
klassieke geval is een rij woningen of een toren met verdiepingen: het metselwerk hoeft niet compleet
te zijn voordat de installateur begint, hij loopt er drie dagen achteraan. Dat is een start-start met
lag van drie dagen, niet een eind-start op een kunstmatig opgeknipte taak. Zet er dan wel een
eind-eind naast, anders kan de opvolger in theorie eerder klaar zijn dan de voorganger. Start-finish
gebruik je niet; in de bouwpraktijk is er vrijwel nooit een goede reden voor.

Leg die start-start bij voorkeur tussen taken, niet tussen fasen: een start-start of start-eind
waarvan de voorganger een samenvattende taak is, rekent Open Planner Studio bewust aan de veilige
kant — hij laat de opvolger wachten op de laatst startende subtaak in plaats van de eerste, en plant
dus nooit te vroeg maar soms te laat. Eind-start en eind-eind op een samenvattende taak zijn wél
exact.

Ga zuinig om met lags, en vooral met negatieve lags. Een lag is wachttijd zonder zichtbare reden —
niemand kan achteraf zien waaróm er zeven dagen tussen zit. Is het uitharden van beton, maak er dan
een lag in doorlooptijddagen van (beton hardt ook in het weekend uit), of beter nog: een echte taak
"uitharden" die iedereen kan zien en volgen. Een negatieve lag — een lead, een overlap — hoort er
eigenlijk niet te zijn: in een schedule-review is de norm nul. Wil je overlap, knip de voorganger dan
op of gebruik een start-start; een lead verstopt bovendien een volgorde die je nooit meer terugvindt
zodra er iets verschuift. Relatietypes, lags in werkdagen
tegenover doorlooptijddagen en de procentuele lag staan in de gids
[Relaties & constraints](docs://gids-relaties-constraints).

## Constraints en handmatige datums: zo min mogelijk

Elke taak staat standaard op "zo vroeg mogelijk", en dat hoort in verreweg de meeste gevallen zo te
blijven. Een constraint is een datumgrens die de logica opzij zet; hoe meer je er zet, hoe minder je
planning nog rekent en hoe meer hij een tekening wordt. Een schema vol vaste datums oogt stabiel en
verbergt precies daardoor het risico: het schuift niet meer, dus het waarschuwt ook niet meer.

Gebruik een constraint alleen voor een harde externe datum waar de planning zelf geen invloed op
heeft: de vergunning die niet vóór 1 maart onherroepelijk is (start niet eerder dan), de vergunde
stremmingsperiode van de gemeente, de aansluitdatum van het nutsbedrijf. Dat zijn feiten van buiten.
"Ik wil dat deze taak in mei staat" is geen feit van buiten — dat los je op met logica of met een
andere duur. Als vuistregel geldt dat hooguit een paar procent van de nog te maken taken een harde
datumgrens zou moeten dragen; zit je daarboven, dan stuur je je planning met de hand.

Typ nooit rechtstreeks een startdatum om een taak op zijn plek te krijgen. Dat is de digitale versie
van de balk verslepen: hij staat waar je hem wilt, en hij blijft daar staan ook als de hele keten
ervoor uitloopt. Wil je een datum bewaken zonder de berekening te forceren, gebruik dan een deadline:
die dwingt niets af, maar levert wél negatieve speling op zodra je hem niet meer haalt — precies het
signaal dat je wilt zien. Een harde pin bewaar je voor het uiterste geval, en dan met de wetenschap
dat hij negatieve speling stroomopwaarts veroorzaakt: dat is de planning die zegt dat het niet past,
niet dat er iets stuk is.

## Kalenders: eerst het project, dan de uitzonderingen

Zet de projectkalender goed vóórdat je duren invoert: werkdagen, werktijden, feestdagen en de
bouwvak. Alle duren worden daarin uitgedrukt, dus een kalender die je halverwege corrigeert verzet
je hele planning. Voeg de voorzienbare stremmingen er meteen bij — de vorstperiode waarin je geen
beton stort, de bedrijfssluiting tussen kerst en oud en nieuw.

Geef een resource pas een eigen kalender als hij werkelijk afwijkt: de gevelbouwer die vier dagen per
week komt, de ploeg die in de zomer een andere vakantie heeft. Doe het niet "voor de zekerheid". Een
resourcekalender raakt namelijk niet de datums van de taak — die blijven op de taak- of
projectkalender lopen — maar wel de belasting en de nivellering. Het gevolg is een verschil dat
lastig te doorzien is als je niet weet dat je het zelf hebt gemaakt: de taak loopt op een dag waarop
de resource niet werkt, en dat komt als tekort terug in het histogram. Het volledige model staat in
de gids [Kalenders, werkdagen en werkuren](docs://gids-kalenders-uren).

## Resources: wie doet het, en kan dat wel

Een planning zonder resources beantwoordt maar de helft van de vraag. Zodra je de ploegen en het
materieel toewijst, kan het model iets wat een tijdlijn alleen niet kan: laten zien dat je op
14 juni drie stukadoorsploegen nodig hebt terwijl je er twee hebt.

Begin met de resources die knellen. Niet elke schroef hoeft erin; de torenkraan, de eigen ploegen, de
onderaannemers met een capaciteitsplafond en de lange levertijden wél. Geef elke resource een
eerlijke capaciteit — twee stukadoors betekent twee, niet "twee, maar in een noodgeval drie".

Lees het histogram als een vraag, niet als een fout. Rood boven de lijn betekent dat de planning meer
vraagt dan je hebt op die dag. Soms is het antwoord: schuiven. Vaak is het antwoord: dit gaat niet,
en dat wilde ik weten. Nivelleer wanneer er ruimte is en de einddatum mag ademen, of nivelleer binnen
de bestaande speling (*smoothing* — zo heet de knop ook) wanneer de opleverdatum vastligt — dan blijft de einddatum staan en houd je een
gemarkeerd restconflict over, wat een eerlijker uitkomst is dan een opgelost ogend schema.

Nivelleer níét wanneer de vraag structureel groter is dan de capaciteit. De nivelleerder herschikt
bestaand werk in bestaande tijd; hij huurt geen extra stukadoors in en maakt geen tweede kraan. Drie
torens die tegelijk dezelfde ploeg nodig hebben, blijven ook na nivellering drie torens die dezelfde
ploeg nodig hebben — het enige wat verandert is dat de oplevering maanden opschuift. De ingreep die
dan wél helpt is fasering, extra capaciteit of ander werk. Nivelleer ook niet voordat je logica en
duren staan: je nivelleert dan een planning die morgen anders is. De bediening, de curves en de
grenzen van de nivelleerder staan in de gids
[Resources, histogram & nivellering](docs://gids-resources-histogram).

## Kritiek pad en speling: waar de planning kwetsbaar is

Reken door — met F5 of de knop **Bereken** — en lees dan pas. Open Planner Studio rekent bewust niet
bij elke wijziging mee, tenzij je **Automatisch berekenen** aanzet; staat er "Verouderd" in de
statusbalk, dan kijk je naar de vorige planning en niet naar deze.

Het kritieke pad is de keten zonder speling: elke dag die daar verloren gaat, is een dag later
opleveren. Dat is waar je toezicht en je beste mensen naartoe gaan. Maar kijk niet alleen naar rood.
Totale speling zegt hoeveel een taak mag uitlopen zonder de opleverdatum te raken; vrije speling
zegt hoeveel hij mag uitlopen zonder zijn eerstvolgende opvolger in beweging te zetten. Het verschil
is de speling die niemands einddatum raakt maar wel iemand in de weg zit — nuttig als je met
onderaannemers werkt die je niet twee keer kunt verzetten.

Zet die kolommen erbij in de taaktabel — via **Beeld → Kolommen…** — en let op drie signalen. Een
taak met een paar dagen speling is geen veilige taak maar een bijna-kritieke taak; zet de
bijna-kritiek-drempel aan en je ziet ze in één kleur. Een taak met extreem veel speling — meer dan
ongeveer twee maanden, in schedule-reviews geteld als 44 werkdagen — is bijna altijd een taak
die een opvolger mist, niet een taak die echt zo veel ruimte heeft; dat is een van de vaste controles
in een schedule-review, en het wijst je precies naar de gaten in je netwerk. En negatieve speling is
nooit een rekenfout: het is de planning die zegt dat een deadline of een gepinde datum niet past.
Meerdere gelijkwaardige kritieke paden, hammocks en de reken-instellingen staan in de gids
[Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).

## Baseline vóór de start, daarna bijhouden

Leg een baseline vast zodra de planning is goedgekeurd en vóórdat er een schop de grond in gaat.
Zonder dat ijkpunt kun je later alleen zeggen dát het anders loopt, niet hoeveel en vanaf wanneer —
en precies dat is wat je nodig hebt in een bouwvergadering, bij meerwerk en als er over vertraging
gesproken wordt. Herbereken eerst, anders bevries je verouderde datums.

**Leg vast waaróp je hebt gepland.** Een baseline bewaart de datums, maar niet de aannames erachter —
en juist die worden gevraagd zodra er over vertraging wordt gesproken. Schrijf daarom bij het
vastleggen kort op wat de basis van dit schema is (in de schedule-praktijk: de *schedule basis*):
welke productiviteitscijfers je hebt gebruikt, welke kalender en waaróm die zo staat, wat je bewust
buiten de planning hebt gelaten, van wie de aangehouden levertijden komen, en wie het schema heeft
goedgekeurd. Een halve pagina is genoeg; zonder die pagina is een half jaar later niet meer te
reconstrueren of een uitloop uit de uitvoering kwam of uit een aanname.

Daarna is bijhouden ritme, geen project. Werk wekelijks bij, in dezelfde volgorde: zet de statusdatum
op de peildatum, vul werkelijke start- en einddatums in van wat gestart en klaar is, corrigeer de
resterende duur van wat loopt, en reken door. Een percentage alleen is te weinig — werkelijke datums
zijn het feitenmateriaal waar later naar gekeken wordt.

Weet daarbij wat de statusdatum doet: werk dat nog niet is begonnen kan niet vóór de statusdatum
starten (een uit MS Project geïmporteerd project volgt daarin MS Projects eigen conventie en schuift
niet). Vergeet je een afgeronde mijlpaal af te melden, dan schuift die vanzelf mee naar rechts —
dat is geen bug maar het model dat weigert te doen alsof iets in het verleden nog kan gebeuren.
Krijg je out-of-sequence-meldingen, dan is er werk gedaan in een andere volgorde dan de logica
voorschrijft; dat is meestal een reden om de volgorde te herzien, niet om de melding weg te klikken.
Een herbaseline maak je alleen bij een echte scopewijziging, en dan naast de eerste en niet eroverheen
— anders raak je kwijt wat er oorspronkelijk was afgesproken. Alles hierover staat in de gids
[Baselines & voortgang](docs://gids-baselines-voortgang).

Tot slot: een planning is pas betrouwbaar als de mensen die het werk doen erin geloven. Laat de
uitvoerder en de onderaannemers de weekplanning tegen dit model leggen. Haal je week in week uit
maar de helft van wat je had afgesproken, dan zit het probleem vaker in de planning dan in de
uitvoering.

## Veelgemaakte fouten

- Taken zonder voorganger of opvolger. Het meest voorkomende, en het schadelijkst: die taken bewegen
  niet mee.
- Datums intypen of balken verslepen in plaats van de logica leggen. Dat zet stilletjes een
  constraint.
- Te veel constraints, en een harde pin gebruiken als bladwijzer.
- Taken van drie maanden, of taken van een halve dag. Tussen ongeveer een dag en twee weken is het
  bruikbare gebied.
- Optimistische duren, en marge verstopt in elke losse taak in plaats van zichtbaar als buffer.
- Weerverlet en bouwvak niet in de kalender. Die komen er in januari alsnog in.
- Lags in plaats van taken. Zeven dagen wachttijd zonder naam is over drie maanden onverklaarbaar.
- Nivelleren voordat de logica staat, of blijven nivelleren bij een structureel capaciteitstekort.
- Vergeten door te rekenen. "Verouderd" in de statusbalk betekent dat je naar de vorige planning
  kijkt.
- Geen baseline, of een baseline die pas na de start is vastgelegd.
- Voortgang alleen als percentage bijhouden, zonder werkelijke datums en zonder statusdatum.
- Het waarschuwingenpaneel wegklikken zonder te lezen. Daar staan de overschreden deadlines, de
  geschonden constraints, de out-of-sequence-relaties en de overbezette resources bij elkaar.

## Verder lezen

- [Snel starten](docs://quick-start) — de bediening in tien minuten, van leeg project tot berekende
  planning.
- [Plannen & WBS](docs://gids-plannen-wbs) — structuur, samenvattende taken en mijlpalen.
- [Relaties & constraints](docs://gids-relaties-constraints) — relatietypes, lag en lead, en alle
  constraint-types.
- [Kalenders, werkdagen en werkuren](docs://gids-kalenders-uren) — dagen tegenover uren, kalenders en
  feestdagen.
- [Resources, histogram & nivellering](docs://gids-resources-histogram) — toewijzen, overallocatie en
  nivelleren.
- [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) — speling, bijna-kritiek werk
  en de reken-instellingen.
- [Baselines & voortgang](docs://gids-baselines-voortgang) — baseline, statusdatum en voortgang.
- [Waarschuwingenpaneel](docs://ref-waarschuwingen) — alle waarschuwingen op één plek, met een sprong
  naar de taak.
