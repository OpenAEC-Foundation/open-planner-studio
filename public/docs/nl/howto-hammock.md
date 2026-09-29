# Een hammock maken

Doel: een taak maken die zijn duur niet zelf kent, maar loopt van de start van de ene taak tot het einde van een andere, zoals bouwplaatsinrichting, toezicht of de huur van een keet.

## Wanneer je dit nodig hebt

De bouwkeet staat er zolang er gebouwd wordt, van het eerste grondwerk tot de oplevering. Geef je die taak een vaste duur van 13 werkdagen, dan loopt hij niet mee als het metselwerk uitloopt en klopt de planning niet meer. Een **hammock** (ook wel *hangmat* of *level of effort*) volgt het werk waaraan je hem ophangt: zijn begin komt uit een startrelatie, zijn einde uit een eindrelatie, en zijn duur is het verschil daartussen.

## Stappen

1. Maak de taak aan, bijvoorbeeld *Bouwplaats*, of selecteer een bestaande taak. Een mijlpaal en een samenvattingstaak (fase) kunnen geen hammock zijn; bij zo'n taak ontbreekt het vinkje.
2. Vink *Hammock (afgeleide duur)* aan in het paneel *Eigenschappen*, in *Taak bewerken* (rechtsklik op de taak, *Bewerken...*) of in de tabelkolom *Hammock (afgeleide duur)* onder *Planning*. Het veld *Duur* is dan niet meer te bewerken.
3. Leg een relatie van de taak waarmee de hammock begint naar de hammock, met type **SS** (de hammock begint samen met die taak) of **FS** (de hammock begint na die taak). Selecteer daarvoor de hammock, klik in *Afhankelijkheden* op *Relatie toevoegen*, laat de richting op *Voorganger*, kies de taak en kies het type. De stappen staan in [Relaties leggen](docs://howto-relaties-leggen).
4. Leg een relatie van de taak waarmee de hammock eindigt naar de hammock, met type **FF** (de hammock eindigt samen met die taak) of **SF**.
5. Kijk in het paneel *Eigenschappen* onder *Hammock (afgeleide duur)*: daar staan *Start-driver* met de taak en het type, en *Finish-driver* met de taak en het type. Een driver is een taak waar de hammock zijn begin of einde van afleidt.
6. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*. De hammock loopt nu van de start van de startdriver tot het einde van de einddriver, en *Duur* toont de afgeleide duur.

In de Gantt is een hammock een dunne blauwgroene balk met een haakje aan beide uiteinden.

Voorbeeld: *Bouwplaats* krijgt SS vanaf *Grondwerk* (maandag 7 juni 2027) en FF vanaf *Dakwerk* (klaar woensdag 23 juni). Na **Bereken** loopt de hammock van maandag 7 tot en met woensdag 23 juni: 13 werkdagen. Loopt het metselwerk 2 werkdagen uit, dan wordt het einde van *Dakwerk* vrijdag 25 juni en groeit de hammock mee naar 15 werkdagen.

## Wat de app met een hammock doet

- De hammock is nooit kritiek en heeft geen speling. Hij beperkt de taken waaruit hij zijn begin en einde afleidt niet: die krijgen geen late datum vanwege de hammock.
- Een lag telt mee. Met SS en lag `1d` begint de hammock een werkdag na de startdriver, met FF en lag `2d` eindigt hij twee werkdagen na de einddriver.

## Valkuilen en wat de app dan doet

**Geen eind-driver.** Heeft de hammock geen FF- of SF-relatie, dan kan de app zijn einde niet afleiden. Het paneel *Eigenschappen* meldt *Geen finish-driver (FF/SF) — de span valt terug op nul-lengte.* en het paneel *Waarschuwingen* meldt *Hammock zonder eind-driver (geen FF/SF-voorganger): de duur valt terug op nul*. De hammock begint en eindigt dan op dezelfde dag. Leg een FF- of SF-relatie.

**Een hammock die na de laatste taak eindigt.** Loopt de hammock door tot na de laatste taak, bijvoorbeeld met FF en een lag van 2 werkdagen, dan schuift de einddatum van het project mee. De taken die je echt uitvoert, krijgen daardoor speling en zijn niet meer kritiek.

**Taken die op een hammock wachten.** Leg je een relatie van de hammock naar een andere taak, dan begint die taak pas na het einde van de hammock. De taken waaruit de hammock zijn begin en einde afleidt, krijgen daardoor speling en zijn niet meer kritiek, omdat de hammock geen druk terug naar hen geeft. Laat daarom geen taken op een hammock wachten; hang zulke taken liever aan de einddriver van de hammock.

**Een duur invullen.** Het veld *Duur* van een hammock is afgeleid en niet te bewerken. Een duur die je vóór het aanvinken had ingevuld, telt niet meer mee.

## Zie ook

- [Relaties leggen](docs://howto-relaties-leggen): de stappen om een relatie met type SS of FF te leggen.
- [Relaties en lag](docs://uitleg-relaties): wat SS en FF betekenen en hoe de lag telt.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): wat kritiek betekent en hoe speling werkt.
