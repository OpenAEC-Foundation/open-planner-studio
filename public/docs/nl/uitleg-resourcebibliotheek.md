# De resourcebibliotheek

Je metselploeg werkt niet voor één project. Vandaag staat ze op de woningen in het noorden, morgen op de garages in het zuiden. Een resourcebibliotheek is de plek waar je zo'n ploeg één keer vastlegt, zodat elk project dezelfde ploeg gebruikt. De app kan dan ook zien wanneer twee projecten op dezelfde dag dezelfde mensen vragen, iets wat geen los project kan zien. In dit artikel lees je hoe bibliotheek en project zich tot elkaar verhouden en hoe de app de bezetting over projecten telt.

## Het begrip

Er zijn twee lagen.

De **resourcebibliotheek** is de lijst met resources en kalenders die bij je organisatie horen: een metselaar, een kraan, een stukadoor, met hun type, tarief en het aantal dat je ervan hebt. De lijst zelf, in de app ook wel de **pool** genoemd, staat niet in je projectbestanden maar in de app: in de desktop-app in een bestand op deze computer, in de browser in de opslag van die browser. Wis je in de browser de sitegegevens, dan is de bibliotheek weg; exporteer hem dus als back-up. Er is altijd minstens één bibliotheek. De eerste heet *Mijn resourcebibliotheek* en die naam kun je wijzigen.

Het **project** bepaalt hoeveel van een resource het gebruikt en wanneer. Een project is aan één bibliotheek gekoppeld of staat los. Een los project werkt gewoon, alleen zonder gedeelde lijst.

Een project verwijst niet naar de bibliotheek maar bewaart een **kopie**. Wijs je *Metselaar* uit de bibliotheek toe aan een project, dan maakt de app in het project een kopie met een **herkomststempel**: de aantekening dat deze kopie uit bibliotheek X komt en daar item Y is. In de resourcetabel herken je zo'n kopie aan een klein bibliotheekpictogram. De kopie is een gewone resource: taken kunnen eraan hangen, en hij staat in het projectbestand zelf.

De kalenders in de resourcebibliotheek zijn iets anders dan de kalenderlijst van je project. Die beheer je in de kalenderdialoog. Een bibliotheekkalender komt in je project mee met een resource die eraan hangt.

## Hoe de app ermee werkt

### Wat de bibliotheek bepaalt en wat het project bepaalt

De bibliotheek bepaalt **wat een resource is**: de naam, het type, het tarief per uur, de eenheid en de omschrijving. In een projectkopie staan die velden als platte tekst. Je wijzigt ze in de bibliotheek, zodat ze in elk project kloppen. Wil je een kopie toch los laten lopen, dan maak je hem los van de bibliotheek.

Het project bepaalt **hoeveel en wanneer**: *Max. eenheden*, de capaciteit die in de tijd verandert (*Tijd-gefaseerde capaciteit*) en welke kalender aan de resource hangt. Die velden blijven in het project gewoon bewerkbaar en tellen niet als afwijking van de bibliotheek. Dezelfde ploeg kan op een spoedklus immers een andere kalender draaien dan op een gewoon project. De inhoud van een kalender die met een resource is meegekomen volgt de bibliotheek wel.

### Wanneer een kopie meeloopt

De bibliotheek ververst de kopieën niet doorlopend, maar op vaste momenten:

- Bewerk je iets in de bibliotheek, dan lopen de onbewerkte kopieën in alle geopende projecten meteen mee.
- Open je een project of wissel je naar een ander tabblad, dan vergelijkt de app de kopieën met de bibliotheek. Loopt een onbewerkte kopie achter, dan werkt de app hem stil bij en meldt dat kort: *1 onderdeel bijgewerkt vanuit de bibliotheek* of *N onderdelen bijgewerkt vanuit de bibliotheek*.

De app onthoudt de waarden van het moment waarop de kopie is gemaakt of bijgewerkt. Verschilt een kopie daar nu van, dan bepaalt de app niet zelf wie gelijk heeft. Een kopie krijgt dan de markering *wijkt af — beslis*. Bij het openen van een bestand met zo'n kopie opent het venster *Resourcebibliotheek koppelen* vanzelf. Daar kies je per onderdeel of de bibliotheekwaarden gelden of dat de waarden uit je bestand in de bibliotheek komen. Bij een wissel van tabblad verschijnt nooit een venster.

Een afwijking ontstaat bijvoorbeeld als je een eigen resource in het project met *Naar de bibliotheek* koppelt aan een bibliotheekitem met dezelfde naam maar andere waarden. De app koppelt dan wel, en markeert de kopie meteen als afwijkend.

### Wanneer een resource verdwijnt uit de bibliotheek

Verwijder je een resource uit de bibliotheek, dan blijft de kopie in je projecten staan en werkt hij gewoon door. Hij krijgt de markering *niet meer in de bibliotheek*, en je kunt hem dan volledig bewerken of uit het project halen.

### Bezetting over projecten

Het histogram en de overbezetting in een project kijken alleen naar dat ene project. De bibliotheek weet meer: hoeveel er van een resource in totaal is. De weergave *Bezetting* telt per dag de belasting op van alle geopende projecten die aan dezelfde bibliotheek gekoppeld zijn en een kopie van die resource gebruiken. Is de som op een dag groter dan de capaciteit van de bibliotheek, dan staat die dag als dubbel geboekt.

Drie regels bepalen wat meetelt:

- De capaciteit komt uit de bibliotheek (*Max. eenheden* van het bibliotheekitem, of zijn *Tijd-gefaseerde capaciteit* op die dag), niet uit de *Max. eenheden* van de projectkopie. Twee projecten die elk binnen hun eigen inzet blijven, kunnen samen dus toch te veel vragen.
- Een som die precies gelijk is aan de capaciteit is geen conflict. Er moet meer dan de capaciteit gevraagd worden.
- Alleen kopieën met een herkomststempel tellen mee, en alleen in projecten die op dat moment in deze app openstaan. Een eigen resource van één project zit niet in de bibliotheek en telt dus niet mee. Documenten die niet in deze app zijn geopend, ziet het overzicht niet; dat staat ook onderaan het overzicht zelf.

## Rekenvoorbeeld: de metselploeg in twee projecten

De bibliotheek bevat de resource *Metselaar* met *Max. eenheden* 3: drie metselaars in dienst. Twee projecten gebruiken hem, beide met een kopie waarop *Max. eenheden* 2 staat.

- *Woningen Noord* heeft de taak *Metselwerk gevels* van 5 werkdagen vanaf maandag 7 juni 2027, met 2 eenheden per dag. De taak loopt van 7 tot en met 11 juni.
- *Garages Zuid* heeft de taak *Metselwerk garages* van 4 werkdagen vanaf woensdag 9 juni 2027, met 2 eenheden per dag. Het weekend telt niet mee, dus de taak beslaat 9, 10, 11 en 14 juni.

Binnen elk project vraagt de metselaar 2 van zijn 2 eenheden. Geen van beide projecten meldt overbezetting: bij *Resources › Overallocatie* staat in beide *Geen*. Toch komen ze samen boven de 3 metselaars uit. Per dag telt de app:

- maandag 7 en dinsdag 8 juni: 2 (alleen Woningen Noord)
- woensdag 9, donderdag 10 en vrijdag 11 juni: 2 + 2 = 4
- maandag 14 juni: 2 (alleen Garages Zuid)

De piek is 4 bij een capaciteit van 3. Het overzicht toont de metselaar met *2 documenten*, de periode *2027-06-07 – 2027-06-14*, *4,0 / 3,0* bij piek en capaciteit, en *3 dagen dubbel geboekt*: 9, 10 en 11 juni.

Wat als je iets verandert:

- Duurt *Metselwerk gevels* 6 werkdagen, dan loopt het tot maandag 14 juni. Ook die dag komt op 2 + 2 = 4, dus het overzicht meldt *4 dagen dubbel geboekt*: 9, 10, 11 en 14 juni. De piek blijft 4.
- Heeft de bibliotheek *Max. eenheden* 4, dan staat er *4,0 / 4,0* en is er geen conflict, omdat de som niet groter is dan de capaciteit.
- Werkt *Garages Zuid* met 1 eenheid per dag in plaats van 2, dan is de piek 3 en staat er *3,0 / 3,0*: geen conflict.
- Begint *Garages Zuid* pas op maandag 14 juni, dan overlappen de projecten niet. De periode wordt *2027-06-07 – 2027-06-17* en de piek is *2,0 / 3,0*.

De stappen om dit in je eigen projecten te bekijken staan in [Het bezettingsoverzicht gebruiken](docs://howto-bezettingsoverzicht-gebruiken).

## Gevolgen en misverstanden

**"De bibliotheek is gedeeld met mijn collega's."** Nee. De bibliotheek staat in de app (in de desktop-app in een bestand op deze computer, in de browser in de opslag van die browser) en wordt niet gesynchroniseerd. Werken twee planners met dezelfde resourcebibliotheek, dan kunnen hun bibliotheken uiteenlopen. Delen kan met exporteren en importeren, zie [Resourcebibliotheken beheren en delen](docs://howto-bibliotheken-beheren). Deelt je organisatie ploegen over werkmaatschappijen heen, kies dan bewust één gezamenlijke bibliotheek. Het overzicht ziet ook alleen de projecten die in deze app openstaan.

**"Als ik de bibliotheek wijzig, verandert alles in mijn projecten."** Alleen de identiteit van de resource: naam, type, tarief, eenheid en omschrijving. *Max. eenheden*, de capaciteit in de tijd en de kalenderkeuze van een project blijven zoals ze zijn.

**"Ik kan een bibliotheekwijziging ongedaan maken."** Nee. De bibliotheek hoort bij de app en niet bij een project, dus wijzigingen erin vallen buiten *Ongedaan* (Ctrl+Z). De weergave *Bibliotheek* waarschuwt daar zelf voor: *Dit bewerkt de bibliotheek en geldt voor alle projecten — valt buiten ongedaan maken.* Ook verwijderen uit de bibliotheek vraagt om bevestiging en is niet terug te draaien.

**"Het bezettingsoverzicht lost de dubbele boeking op."** Nee, het overzicht is alleen een leesvenster. Het laat zien op welke dagen twee projecten samen te veel vragen. Nivelleren (*Resources › Nivellering › Nivelleren…*, zie [Nivelleren](docs://uitleg-nivelleren)) kijkt naar de resources van één project en houdt geen rekening met de andere projecten. Verschuif je zelf een taak in een van de projecten, of pas de capaciteit in de bibliotheek aan als er echt iemand bij komt.

**"Mijn eigen resource telt mee in de bezetting."** Alleen als hij in de bibliotheek staat. Een resource die je alleen in het project maakte, zoals een gehuurde kraan voor één klus, heeft geen herkomststempel en zit dus niet in het overzicht. Met *Naar de bibliotheek* neem je hem op.

## Zie ook

- [De resourcebibliotheek gebruiken](docs://howto-resourcebibliotheek-gebruiken): koppelen, resources toewijzen en afwijkingen oplossen.
- [Resourcebibliotheken beheren en delen](docs://howto-bibliotheken-beheren): bibliotheken aanmaken, exporteren en importeren.
- [Het bezettingsoverzicht gebruiken](docs://howto-bezettingsoverzicht-gebruiken): dubbele boekingen over projecten opsporen.
- [Resources beheren](docs://howto-resources-beheren): de resources van één project.
