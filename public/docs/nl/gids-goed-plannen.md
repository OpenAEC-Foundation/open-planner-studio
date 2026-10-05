# Goed plannen

Wat maakt een planning goed? Niet hoe netjes hij eruitziet, maar of hij antwoord geeft op de vraag die er tijdens de uitvoering toe doet: als dít verschuift, wat gebeurt er dan met de oplevering? In dit artikel lees je de principes achter een betrouwbare planning, en waarom ze in Open Planner Studio zo zwaar wegen: de app rekent met wat je invoert, en met niets anders.

De voorbeelden komen uit de bouw — ruwbouw, afbouw, levertijden, weerverlet, onderaannemers, een contractuele opleverdatum — maar de principes zelf zijn niet bouwspecifiek.

## Het begrip

Een goede planning is geen plaatje van wat je hoopt, maar een **rekenmodel**: taken met een duur, verbonden door relaties, in een kalender. Uit dat model rekent de app de datums uit. Verandert er iets, dan rekent het model door en zie je meteen wat dat betekent voor de rest.

Een planner werkt daarbij in een vaste volgorde:

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

Die volgorde is geen etiquette. Sla je een stap over, dan komt hij terug als verrassing: taken zonder relaties bewegen niet mee, duren zonder kalender kloppen niet, en een baseline die je pas achteraf vastlegt bevriest de vertraging in plaats van de afspraak.

## Hoe de app ermee rekent

Elk principe hieronder hangt aan iets wat de app doet. Daarom loopt dit deel dezelfde volgorde af.

### Begin bij het doel, niet bij de taken

Zet eerst de momenten neer die vastliggen, en pas daarna het werk dat ertussen moet passen: start bouwrijp maken, vergunning onherroepelijk, waterdicht, start afbouw, oplevering. Dat zijn **mijlpalen**: punten zonder duur, die je ook echt als mijlpaal invoert (*Start › Taken › Mijlpaal ▾*) en niet als taak van nul dagen met een naam die erop lijkt.

Waarom deze volgorde: een planning die begint bij een lijst taken wordt een optelsom, en een optelsom komt zelden uit op de datum die in het contract staat. Begin je bij de mijlpalen, dan is de vraag meteen de goede — niet "hoe lang duurt dit alles bij elkaar", maar "past het werk tussen deze twee momenten, en zo niet, wat moet er dan anders". Reken vanaf de gewenste opleverdatum terug naar wat er dan uiterlijk waterdicht moet zijn, en van daaruit naar de start.

Een oplevering die contractueel vastligt, markeer je met het vinkje *Verplicht (contractueel)*, zodat iedereen die het bestand opent ziet dat dat moment onderhandelbaar noch verschuifbaar is. Het vinkje is een markering voor de Gantt en de rapporten; het bewaakt geen datum. Dat doe je met een deadline of constraint (zie hieronder).

### De opdeling: fasen, werkpakketten, taken

Onder de mijlpalen bouw je de structuur: fasen, daaronder werkpakketten, daaronder taken. Je doet dat door in te springen. Een taak met subtaken wordt vanzelf een **samenvattingstaak**: de app leidt haar balk en duur af uit de taken eronder. Een samenvattingstaak voer je dus nooit zelf een duur in.

De vuistregel voor granulariteit: **een taak duurt tussen ongeveer één dag en twee weken**. Korter dan een dag betekent dat je de werkvloer aan het plannen bent in plaats van het project — dat hoort op de weekplanning van de uitvoerder, niet in een rekenmodel dat maandenlang mee moet. Langer dan twee weken betekent dat je een taak hebt die je niet fatsoenlijk kunt inschatten en tijdens de uitvoering niet kunt volgen: "afbouw begane grond, 40 dagen, 45% gereed" vertelt niemand of het goed gaat. In schedule-reviews wordt daarom vaak geteld hoeveel taken langer dan ongeveer twee maanden duren; boven een paar procent geldt dat als een gebrek aan detail.

Te fijn is net zo schadelijk als te grof. Elke taak kost onderhoud: relaties leggen, voortgang bijhouden, na elke wijziging opnieuw beoordelen. Een planning van tweeduizend taken voor een project van zes maanden wordt niet nauwkeuriger, hij wordt onbijgehouden — en een planning die niemand bijwerkt is binnen drie weken fictie. Kies het niveau waarop je wekelijks eerlijk voortgang kunt melden.

Praktisch: "3. Afbouw" is een fase, "Afbouw woning 4" een werkpakket, "Stucwerk woning 4 begane grond" een taak van vijf dagen. Uitzonderingen op de bovengrens mag je bewust maken voor levertijden en toezicht: een kozijnlevering van tien weken ís één ondeelbaar wachtblok, en doorlopend toezicht hoort in een hammock thuis in plaats van in een reeks kunstmatige stukken.

### De duur schatten

Een duur is een schatting van hoe lang het werk duurt, niet van hoe snel het zou kunnen. Schat op een normale dag met de ploeg die je werkelijk krijgt, niet op de beste dag met de beste ploeg. Optimisme stapelt zich op door de keten: een planning waarin elke taak de beste dag aanneemt, haalt zijn opleverdatum vrijwel nooit.

Dagen of uren is een echte keuze, geen opmaak. Kies **dagen** voor werk dat de bouwplaats beheerst — metselen, stucwerk, tegelwerk: het duurt vijf dagen, ook als er een dag acht en een dag negen uur gewerkt wordt. Kies **uren** wanneer het aantal uren zelf de eenheid is en de restdag ertoe doet: een keuring van drie uur, een betonstort van veertien uur die over twee dagen valt, werk in ploegendienst. De app bewaart die keuze per taak.

Stop geen risico in de duur van losse taken. Wie overal een dag extra bijtelt, verstopt de marge zodat niemand hem meer kan zien of sturen — en op de plek waar de marge echt nodig was, is hij te klein. Maak reserve zichtbaar: een expliciete buffertaak vóór de opleverdatum, of een aparte weerverletpost. Let daarbij op dubbeltelling: de ongeveer 180 werkbare werkdagen per jaar waarmee in de Nederlandse bouw gerekend wordt, is een contractueel jaargetal (UAV) waar feestdagen, bouwvak én verlet al vanaf zijn getrokken. Staan de feestdagen en de bouwvak al in je projectkalender, dan resteert alleen het weerverlet als aparte post. Vorst- en stormverlet volgt een eigen regeling in de cao Onwerkbaar weer Bouw & Infra. Zet die verwachte verletdagen in de kalender of als aparte post, niet verstopt in de duur van het metselwerk.

### Relaties: zonder netwerk is het geen planning

De app rekent de datums uit langs de **relaties**: een taak begint pas als zijn voorgangers het toelaten. Een taak zonder relaties hangt nergens aan. Verschuift de ruwbouw twee weken, dan schuift een losgekoppelde afbouwtaak niet mee, en de planning liegt zonder dat er iets rood kleurt.

Daarom krijgt elke taak minstens één voorganger en minstens één opvolger. Alleen de eerste taak van het project en de laatste mijlpaal zijn daarop de uitzondering. In een schedule-review is dit de eerste controle: minder dan een paar procent van de taken mag ontbrekende logica hebben.

**Eind-start is de standaard**, en hoort dat ook te blijven: eerst de fundering af, dan de ruwbouw. In een gezonde bouwplanning is ruwweg negen van de tien relaties eind-start. Dat is een leesbaarheidseis: eind-start is het enige type dat iedereen op de bouwplaats zonder uitleg begrijpt, en het gedraagt zich tijdens de uitvoering voorspelbaar.

**Start-start met een lag** gebruik je waar werk echt meeloopt in plaats van erop wacht. Het klassieke geval is een rij woningen of een toren met verdiepingen: de installateur loopt drie dagen achter het metselwerk aan. Dat is een start-start met een lag van drie dagen, niet een eind-start op een kunstmatig opgeknipte taak. Zet er dan wel een eind-eind naast, anders kan de opvolger in theorie eerder klaar zijn dan de voorganger. Start-eind gebruik je in de bouwpraktijk vrijwel nooit.

Leg die start-start bij voorkeur tussen taken, niet tussen fasen. Is de voorganger van een start-start een fase, dan laat de app de opvolger wachten op de taak in die fase die het **laatst** begint, niet op de eerste. Hij plant dus nooit te vroeg, maar soms later dan je bedoelt. Eind-start en eind-eind op een fase als voorganger wachten op de laatst afgeronde taak erin, en dat is meestal precies wat je bedoelt.

Ga zuinig om met lags, en vooral met negatieve lags. Een lag is wachttijd zonder zichtbare reden: niemand kan achteraf zien waaróm er zeven dagen tussen zit. Is het uitharden van beton, maak er dan een lag in kalenderdagen van (beton hardt ook in het weekend uit), of beter nog een echte taak "uitharden" die iedereen kan zien en volgen. Een negatieve lag — een lead, een overlap — hoort er eigenlijk niet te zijn; in een schedule-review is de norm nul. Wil je overlap, knip de voorganger dan op of gebruik een start-start.

### Constraints en vaste datums: zo min mogelijk

Elke taak staat standaard op "zo vroeg mogelijk", en dat hoort in verreweg de meeste gevallen zo te blijven. Een **constraint** is een datumgrens naast de relaties. Hoe meer je er zet, hoe minder je planning nog rekent en hoe meer hij een tekening wordt. Een schema vol vaste datums oogt stabiel en verbergt precies daardoor het risico: het schuift niet meer, dus het waarschuwt ook niet meer.

Gebruik een constraint alleen voor een harde externe datum waar de planning zelf geen invloed op heeft: de vergunning die niet vóór 1 maart onherroepelijk is (*Start niet eerder dan*), de vergunde stremmingsperiode van de gemeente, de aansluitdatum van het nutsbedrijf. "Ik wil dat deze taak in mei staat" is geen feit van buiten; dat los je op met logica of met een andere duur. Als vuistregel draagt hooguit een paar procent van de nog te maken taken een harde datumgrens.

Typ nooit een startdatum om een taak op zijn plek te krijgen. Bij een taak met een voorganger maakt de app van een getypte (of met de muis versleepte) start een constraint *Start niet eerder dan (SNET)*. De taak staat dan waar je hem wilt, en blijft daar ook staan als de hele keten ervoor uitloopt.

Wil je een datum bewaken zonder de berekening te sturen, gebruik dan een **deadline**. Die verschuift niets, maar geeft negatieve speling en een waarschuwing zodra de taak hem niet meer haalt — precies het signaal dat je wilt zien. Een harde pin (*Verplicht (pin logica)*) bewaar je voor het uiterste geval, en dan met de wetenschap dat hij negatieve speling geeft in de keten ervoor: dat is de planning die zegt dat het niet past, niet dat er iets stuk is.

### Kalenders: eerst het project, dan de uitzonderingen

Alle duren tellen in werkdagen of werkuren van een kalender. Zet de projectkalender daarom goed vóórdat je duren invoert: werkdagen, werktijden, feestdagen en de bouwvak. Een kalender die je halverwege corrigeert, verzet je hele planning. Voeg de voorzienbare stremmingen er meteen bij: de vorstperiode waarin je geen beton stort, de bedrijfssluiting tussen kerst en oud en nieuw.

Geef een resource pas een eigen kalender als hij werkelijk afwijkt: de gevelbouwer die vier dagen per week komt, de ploeg die in de zomer een andere vakantie heeft. Een resourcekalender verandert namelijk geen enkele datum van een taak; die blijft op de taak- of projectkalender lopen. Hij maakt alleen zichtbaar dat de resource op een werkdag van de taak niet werkt, als overbezetting in het histogram. Dat verschil is lastig te doorzien als je niet weet dat je het zelf hebt gemaakt.

### Resources: wie doet het, en kan dat wel

Een planning zonder resources beantwoordt maar de helft van de vraag. Zodra je de ploegen en het materieel toewijst, laat het histogram zien wat een tijdlijn alleen niet kan: dat je op 14 juni drie stukadoorsploegen nodig hebt terwijl je er twee hebt.

Begin met de resources die knellen. Niet elke schroef hoeft erin; de torenkraan, de eigen ploegen, de onderaannemers met een capaciteitsplafond en de lange levertijden wél. Geef elke resource een eerlijke capaciteit: twee stukadoors betekent twee, niet "twee, maar in een noodgeval drie".

Lees het histogram als een vraag, niet als een fout. Rood boven de lijn betekent dat de planning op die dag meer vraagt dan je hebt. Soms is het antwoord: schuiven. Vaak is het antwoord: dit gaat niet, en dat wilde ik weten. **Nivelleren** schuift taken tot de vraag binnen de capaciteit past. Mag de einddatum ademen, laat dat dan toe; ligt de opleverdatum vast, nivelleer dan alleen binnen de speling (het vakje *Alleen binnen speling nivelleren (smoothing) — projecteinddatum blijft vast*). Dan blijft de einddatum staan en houd je een gemeld restconflict over, wat een eerlijker uitkomst is dan een opgelost ogend schema.

Nivelleer níét wanneer de vraag structureel groter is dan de capaciteit. Nivelleren herschikt bestaand werk in de tijd; het huurt geen extra stukadoors in en maakt geen tweede kraan. Drie torens die tegelijk dezelfde ploeg nodig hebben, blijven ook na nivelleren drie torens die dezelfde ploeg nodig hebben; het enige wat verandert, is dat de oplevering opschuift. Wat dan wél helpt, is fasering, extra capaciteit of ander werk. Nivelleer ook niet voordat je logica en duren staan: je nivelleert dan een planning die morgen anders is.

### Kritiek pad en speling: waar de planning kwetsbaar is

De app rekent niet bij elke wijziging mee. Reken door met **Bereken** (F5) en lees dan pas. Staat in de statusbalk *Verouderd — herbereken (F5)*, dan kijk je naar de vorige berekening en niet naar deze. Met de instelling *Automatisch berekenen* doet de app het zelf.

Het **kritieke pad** is de keten zonder speling: elke dag die daar verloren gaat, is een dag later opleveren. Daar gaan je toezicht en je beste mensen naartoe. Kijk niet alleen naar rood. **Totale speling** zegt hoeveel een taak mag uitlopen zonder de oplevering te raken; **vrije speling** zegt hoeveel hij mag uitlopen zonder zijn opvolger in beweging te zetten. Het verschil raakt niemands einddatum maar zit wel iemand in de weg — nuttig als je met onderaannemers werkt die je niet twee keer kunt verzetten.

Let op drie signalen. Een taak met een paar dagen speling is geen veilige taak maar een bijna-kritieke taak; met *Bijna-kritiek markeren* krijgen zulke taken een eigen kleur. Een taak met extreem veel speling — in schedule-reviews meer dan 44 werkdagen, ongeveer twee maanden — mist bijna altijd een opvolger; dat wijst je precies naar de gaten in je netwerk. En negatieve speling is nooit een rekenfout: het is de planning die zegt dat een deadline of een vastgezette datum niet past.

### Baseline vóór de start, daarna bijhouden

Leg een **baseline** vast zodra de planning is goedgekeurd en vóórdat er een schop de grond in gaat (*Planning › Baselines & voortgang › Baselines beheren…*). Bereken eerst: de baseline bewaart de datums van de laatste berekening. Zonder dat ijkpunt kun je later alleen zeggen dát het anders loopt, niet hoeveel en vanaf wanneer — en precies dat heb je nodig in een bouwvergadering, bij meerwerk en als er over vertraging gesproken wordt.

Een baseline bewaart de datums, maar niet de aannames erachter, en juist die worden gevraagd zodra er over vertraging wordt gesproken. Schrijf daarom bij het vastleggen kort op wat de basis van dit schema is (in de schedule-praktijk: de *schedule basis*): welke productiviteitscijfers je hebt gebruikt, welke kalender en waaróm die zo staat, wat je bewust buiten de planning hebt gelaten, van wie de aangehouden levertijden komen, en wie het schema heeft goedgekeurd. Een halve pagina is genoeg.

Daarna is bijhouden ritme, geen project. Werk wekelijks bij, in dezelfde volgorde: zet de **statusdatum** op de peildatum, vul werkelijke start- en einddatums in van wat gestart en klaar is, corrigeer de resterende duur van wat loopt, en reken door. Een percentage alleen is te weinig: werkelijke datums zijn het feitenmateriaal waar later naar gekeken wordt.

Weet wat de statusdatum doet: werk dat nog niet is begonnen, schuift de app naar de statusdatum, en de taken erna schuiven mee (behalve in het rekenprofiel Microsoft Project). Vergeet je een afgeronde taak of mijlpaal af te melden, dan schuift hij dus vanzelf naar rechts. Dat is geen fout maar het model dat weigert te doen alsof iets in het verleden nog kan gebeuren. Krijg je een waarschuwing *Out-of-sequence*, dan is er werk gedaan in een andere volgorde dan de logica voorschrijft; dat is meestal een reden om de volgorde te herzien, niet om de melding weg te klikken. Een nieuwe baseline maak je alleen bij een echte scopewijziging, en dan naast de eerste en niet eroverheen.

Tot slot: een planning is pas betrouwbaar als de mensen die het werk doen erin geloven. Laat de uitvoerder en de onderaannemers de weekplanning tegen dit model leggen. Haal je week in week uit maar de helft van wat je had afgesproken, dan zit het probleem vaker in de planning dan in de uitvoering.

## Rekenvoorbeeld: drie keuzes die de planning stil laten liegen

De getallen komen uit twee voorbeelden die elders in de Help zijn uitgewerkt: het oefenproject *Aanbouw woning* uit de tutorials, en een klein netwerk voor een aanbouw. Hier gaat het erom wat elke keuze met je planning doet. Zelf naspelen doe je in tutorial 2 (relaties en het kritieke pad) en tutorial 3 (een constraint en een deadline).

### Een vergeten relatie

In de aanbouw start het werk op maandag 7 juni 2027 en staat de oplevering op vrijdag 6 augustus. *Buitenspouwblad metselen* (6 werkdagen) heeft als opvolger *Kozijnen plaatsen*, want de kozijnen komen in de gevel. Met die relatie heeft het buitenspouwblad 2 werkdagen speling.

Vergeet je die relatie, dan heeft het buitenspouwblad ineens 23 werkdagen speling, tot aan de oplevering. Op papier kan het wekenlang uitlopen zonder dat iemand wacht. Er kleurt niets rood en er komt geen waarschuwing. Alleen met de reken-optie *Open-eind-taken kritiek* wordt zo'n taak zonder opvolger kritiek, en valt het gat op.

### Een getypte datum in plaats van een relatie

Het kleine netwerk: *Grondwerk* (3 werkdagen), *Fundering storten* (2), *Metselen* (5) en *Dakwerk* (3), na elkaar, vanaf maandag 7 juni 2027. Het project is klaar op woensdag 23 juni.

Typ je bij *Metselen* een start op maandag 21 juni, omdat de stenen pas dan komen, dan wordt dat een *Start niet eerder dan*. Het metselwerk schuift een week op en het project is klaar op woensdag 30 juni. *Grondwerk* en *Fundering storten* krijgen 5 werkdagen speling en zijn niet meer kritiek. Komen de stenen toch eerder, dan blijft het metselwerk op 21 juni staan: de datum stuurt nu, niet de logica.

Typ je in plaats daarvan woensdag 9 juni, vóór de fundering klaar is, dan gebeurt er niets: de relaties laten het metselwerk toch pas op maandag 14 juni beginnen.

### Een deadline in plaats van een constraint

Wil je dat *Dakwerk* op vrijdag 18 juni klaar is, zet daar dan een deadline. Er verschuift niets: het dakwerk blijft op maandag 21 tot en met woensdag 23 juni. Maar de keten krijgt −3 werkdagen speling en de app meldt *Deadline 18-06-2027 overschreden — vroegste einde 23-06-2027*. Je ziet dus meteen dat de afspraak niet past, in plaats van een balk die op de goede plek staat en een keten erachter die het niet haalt.

## Gevolgen en misverstanden

- **Taken zonder voorganger of opvolger.** Het meest voorkomende, en het schadelijkst: die taken bewegen niet mee en krijgen valse speling.
- **Datums typen of balken verslepen in plaats van de logica leggen.** Dat zet stilletjes een constraint.
- **Te veel constraints, en een harde pin als bladwijzer.** De planning rekent dan niet meer, hij tekent.
- **Taken van drie maanden, of taken van een halve dag.** Tussen ongeveer een dag en twee weken is het bruikbare gebied.
- **Optimistische duren, en marge verstopt in elke losse taak** in plaats van zichtbaar als buffer.
- **Weerverlet en bouwvak niet in de kalender.** Die komen er in januari alsnog in.
- **Lags in plaats van taken.** Zeven dagen wachttijd zonder naam is over drie maanden onverklaarbaar.
- **Nivelleren voordat de logica staat**, of blijven nivelleren bij een structureel capaciteitstekort.
- **Vergeten door te rekenen.** *Verouderd* in de statusbalk betekent dat je naar de vorige berekening kijkt.
- **Geen baseline, of een baseline die pas na de start is vastgelegd.**
- **Voortgang alleen als percentage**, zonder werkelijke datums en zonder statusdatum.
- **Het paneel *Waarschuwingen* wegklikken zonder te lezen.** Daar staan de overschreden deadlines, de geschonden constraints, de out-of-sequence-relaties en de overbezette resources bij elkaar (*Planning › Planning › Waarschuwingen*).

## Zie ook

- [Kritiek pad en speling](docs://uitleg-kritiek-pad): hoe de app vroegste en laatste datums en de speling uitrekent.
- [Relaties en lag](docs://uitleg-relaties): de vier soorten relaties, lag en relaties op een fase.
- [Constraints en deadlines](docs://uitleg-constraints): wat elke constraint en een deadline met de berekening doen.
- [Kalenders en werkdagen](docs://uitleg-kalenders): hoe de app werkdagen telt en welke kalender wint.
- [Dagen en uren](docs://uitleg-dagen-en-uren): plannen in dagen, in uren, of gemengd.
- [Nivelleren](docs://uitleg-nivelleren): wat nivelleren verschuift en wat niet.
- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat de statusdatum doet en hoe je afwijking leest.
- [Taken en mijlpalen toevoegen](docs://howto-taken-en-mijlpalen-toevoegen): de mijlpalen en taken invoeren.
- [Relaties leggen](docs://howto-relaties-leggen): taken aan elkaar koppelen.
- [Een AI-assistent koppelen (MCP)](docs://howto-ai-assistent-koppelen): een assistent die met deze principes plant.
- [Meldingen en waarschuwingen](docs://ref-meldingen): alle waarschuwingen op één plek.
