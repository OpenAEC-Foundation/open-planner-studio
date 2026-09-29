# Een constraint of deadline zetten

Doel: een datumafspraak op een taak vastleggen, zodat de planning er rekening mee houdt of laat zien dat je hem niet haalt.

## Wanneer je dit nodig hebt

De stenen worden pas op 21 juni geleverd, dus het metselwerk mag niet eerder beginnen: een **constraint** *Start niet eerder dan*. Het dak moet dicht zijn voor de bouwvak, en je wilt gewaarschuwd worden als dat niet lukt: een **deadline**. De stort staat vast op een dag omdat de betoncentrale hem toegezegd heeft: *Moet starten op*. Welk type wanneer past en wat de app ermee rekent, staat in [Constraints en deadlines](docs://uitleg-constraints).

## Stappen

Je stelt een constraint en een deadline in het paneel *Eigenschappen* in.

1. Selecteer de taak. Zie je het paneel *Eigenschappen* niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Kies bij *Constraint* het type, bijvoorbeeld *Start niet eerder dan (SNET)*.
3. Bij elk type behalve *Zo vroeg mogelijk (ASAP)* en *Zo laat mogelijk (ALAP)* verschijnt het veld *Constraint-datum*. Typ de datum in de drie vakjes voor dag, maand en jaar, bijvoorbeeld 21, 06 en 2027, en druk op Enter. De app springt zelf naar het volgende vakje zodra een vakje vol is. Na het kiezen van het type staat er al een datum: de oorspronkelijke geplande start van de taak. Die kan afwijken van de start die het paneel toont, dus vul altijd zelf de datum in die je bedoelt.
4. Wil je de taak op de datum vastzetten, ook vóór zijn voorgangers, kies dan *Moet starten op (MSO)* of *Moet eindigen op (MFO)* en vink *Verplicht (pin logica)* aan. Dat is een harde pin; gebruik hem alleen voor een datum die echt vaststaat.
5. Wil je ook een tweede grens, bijvoorbeeld een taak die niet vóór 14 juni mag beginnen en uiterlijk 17 juni klaar moet zijn, kies dan bij *Secundaire constraint* een type en vul de *Secundaire datum* in. Dit veld verschijnt pas als de primaire constraint een datumgrens is en geen harde pin heeft.
6. Voor een deadline vul je het veld *Deadline* in, op dezelfde manier als de constraintdatum. Een deadline staat los van de constraint: je kunt beide op dezelfde taak zetten.
7. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. Tot die tijd meldt de statusbalk *Verouderd — herbereken (F5)*.

De velden staan ook in het venster *Taak bewerken*, dat je opent met een rechtsklik op de taak en *Bewerken...*; je bevestigt met *Opslaan*.

In de tabel gaat het via kolommen. Klik op de **+** in de tabelkop en kies onder *Beperkingen* de kolommen *Constrainttype*, *Constraintdatum* en *Deadline* (er zijn ook *Harde constraint*, *Type secundaire constraint* en *Datum secundaire constraint*). Dubbelklik op een cel om hem te bewerken: het type kies je uit een lijst, een datum typ je met streepjes, bijvoorbeeld 21-06-2027. *Harde constraint* is alleen te wijzigen bij MSO en MFO.

Heeft de taak een voorganger, dan is er een kortere weg voor *Start niet eerder dan*: typ gewoon een nieuwe startdatum in het veld *Start* (in het paneel *Eigenschappen*, in *Taak bewerken* of in de tabel), of verschuif de balk in de Gantt. De app maakt er dan zelf een constraint *Start niet eerder dan (SNET)* van en meldt dat.

## Resultaat controleren

- In de Gantt staat een klein ruitje boven de balk, aan de startkant bij een start-constraint en aan de eindkant bij een einde-constraint: blauw bij SNET en FNET, violet bij SNLT, FNLT, MSO en MFO, rood als de constraint geschonden is. Een harde pin heeft een speldje. Een deadline is een pijl omlaag op de deadlinedatum: groen zolang de taak op tijd klaar is, rood als hij te laat is.
- Een geschonden constraint of overschreden deadline verschijnt in het paneel *Waarschuwingen* (*Planning › Planning › Waarschuwingen*) en in de statusbalk. De *Totale speling* van de taak en de taken ervoor is dan negatief.
- Bij een bovengrens (*Start niet later dan*, *Eindig niet later dan*) of een deadline betekent het ontbreken van een waarschuwing dat de planning de datum haalt.

## Een constraint of deadline weghalen

Kies bij *Constraint* weer *Zo vroeg mogelijk (ASAP)*. Dat haalt ook de secundaire constraint weg. Een deadline haal je weg door de drie vakjes leeg te maken en op Enter te drukken. Druk daarna op **Bereken**.

## Valkuilen en wat de app dan doet

**Een constraint op een fase.** Een constraint of deadline op een fase (samenvattingstaak) heeft geen effect. Zet hem op de taak zelf.

**Een taak die al gestart is.** Heeft de taak een werkelijke start of voortgang, dan houdt hij zijn werkelijke start. Een *Start niet eerder dan* met een latere datum verschuift hem niet.

**Een startdatum typen naast een andere constraint.** Heeft de taak een voorganger én al een andere constraint, bijvoorbeeld *Zo laat mogelijk (ALAP)*, dan past de app een ingetypte start niet toe. Een melding noemt de constraint; pas die aan als je de start wilt verplaatsen.

**Een datum in het weekend.** Een datum op een zaterdag, zondag of vrije dag telt als een werkdag: een ondergrens (*Start niet eerder dan*, *Eindig niet eerder dan*) als de eerstvolgende werkdag, een bovengrens (*Start niet later dan*, *Eindig niet later dan*) als de vorige.

**Een secundaire constraint die niet mag.** De app markeert een ongeldige combinatie in rood met de reden, bijvoorbeeld *Primair en secundair mogen niet dezelfde zijde begrenzen.* Een secundaire constraint is niet toegestaan bij ASAP, ALAP, MSO, MFO en een harde pin.

**Een harde pin.** De eerste keer dat je hem aanzet, waarschuwt de app dat een harde pin de relaties overschrijft. De taak staat dan op de datum, ook vóór zijn voorgangers; die voorgangers krijgen negatieve speling.

**Niets veranderd na het instellen.** Constraints werken pas na **Bereken**. Blijft een bovengrens (*Start niet later dan*, *Eindig niet later dan*) zonder effect op de balken, dan is dat normaal: een bovengrens verschuift niets, hij maakt de speling negatief als de datum niet gehaald wordt.

## Zie ook

- [Constraints en deadlines](docs://uitleg-constraints): wat elk type doet, en de uitleg bij harde pin, negatieve speling en deadline.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat negatieve speling met het kritieke pad doet.
- [Relaties en lag](docs://uitleg-relaties): de relaties waar een constraint naast staat.
