# Resources toewijzen met een curve

Doel: een resource op een taak zetten, met een inzet per dag en een curve die bepaalt hoe die inzet over de dagen van de taak verdeeld is.

## Wanneer je dit nodig hebt

Zodra je wilt zien wie wanneer waar werkt: de metselaar op het buitenspouwblad, de kraan op de kanaalplaten. Zonder toewijzing is er geen belasting en dus ook geen histogram of overbezetting.

Twee vaktermen. De **inzet** (in de app *Eenh./dag*) is hoeveel van de resource er per werkdag aan de taak werkt: 1 is één metselaar, 2 zijn er twee, 0,5 is een halve dag. De **curve** bepaalt hoe het totaal, inzet maal duur, over de werkdagen van de taak wordt verdeeld. Werk is zelden gelijkmatig: bij een muur is het begin rustig, het midden druk en het einde weer rustig.

Het buitenspouwblad duurt 6 werkdagen. Met één metselaar en de curve *Uniform* is dat 1 eenheid op elk van de 6 dagen, samen 6. Met de curve *Klokvorm* blijven het samen 6 eenheden, maar de verdeling wordt 0, 1, 2, 2, 1 en 0.

## Stappen

Je kunt een resource op twee manieren toewijzen. De resource moet al bestaan (zie [Resources beheren](docs://howto-resources-beheren)).

### Via het lint

1. Selecteer één taak in de takenlijst. Het moet een gewone taak zijn, geen mijlpaal en geen fase.
2. Kies *Resources › Toewijzing › Toewijzen ▾*.
3. Vul in het venster de *Eenh./dag* in (standaard 1) en kies de *Curve* (standaard *Uniform*). Ze gelden voor de resource die je nu kiest.
4. Klik op de resource. Het venster sluit en de toewijzing staat er.

Voor een tweede resource open je het venster opnieuw. Resources die al op de taak staan, ontbreken in de lijst.

### Via het paneel Eigenschappen

1. Selecteer de taak. Het paneel *Eigenschappen* staat rechts; zie je het niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Kies in het blok *Toewijzingen*, helemaal onderaan, bij *Resource toewijzen* de resource. De toewijzing begint met een inzet van 1 en de curve *Uniform*.
3. Pas per toewijzing de *Eenh./dag* aan en kies bij *Curve* een andere curve.

Zo wijzig je ook een bestaande toewijzing. Met de prullenbak (*Verwijderen*) naast de naam haal je de toewijzing van de taak. De resource zelf blijft bestaan. Met *Verplaats naar…* zet je de toewijzing over op een andere taak.

### De curves

- *Uniform*: elke dag evenveel. Dit is de standaard.
- *Vooraan belast*: het begin is zwaarder dan het einde.
- *Achteraan belast*: het einde is zwaarder dan het begin.
- *Klokvorm*: een piek in het midden, met een rustig begin en einde.
- *Vroege piek*: een piek voor het midden.
- *Late piek*: een piek na het midden.
- *Dubbele piek*: twee pieken.
- *Schildpad*: een rustig begin en einde met een brede piek in het midden.

De curve verandert alleen de verdeling. De duur, de datums en het totaal blijven gelijk. Je hoeft daarna niet te herberekenen. Het histogram past zich direct aan. Kies *Resources › Histogram › Histogram* om het te zien. Selecteer je een taak, dan toont het histogram alleen de belasting van die taak.

## Valkuilen en wat de app dan doet

**Een curve kan de piek boven je inzet uitduwen.** Bij een heel getal als inzet rondt de app de waarde per dag af op hele eenheden, en het totaal blijft gelijk. Metselaar met inzet 1 op het buitenspouwblad en de curve *Klokvorm* geeft 0, 1, 2, 2, 1, 0. Op de twee middelste dagen is dat 2 eenheden tegenover een *Max. eenheden* van 1. Het histogram kleurt die dagen rood en de resource telt als overbezet. Kies een andere curve, of verdeel de uren zelf (zie [Urenverdeling aanpassen](docs://howto-urenverdeling-aanpassen)). Bij een inzet als 0,5 rondt de app af op honderdsten.

**Geen mijlpaal of fase.** De knop *Toewijzen* is dan uitgeschakeld, en in *Eigenschappen* staat *Toewijzingen zijn niet mogelijk op mijlpalen.* of *Toewijzingen zijn niet mogelijk op samenvattingstaken.*

**Een resource maar één keer per taak.** Staat de resource al op de taak, dan staat hij niet meer in de lijst. Staan alle resources al op de taak, dan meldt de app *Alle resources zijn al toegewezen.* Bestaat er nog geen resource, dan meldt hij *Maak eerst resources aan (Resources-tab).*

**De inzet moet groter zijn dan 0.** Een waarde van 0 of lager neemt de app niet over.

**Uurtaken korter dan een werkdag.** Zet je een resource op een taak die je in uren plant en die korter duurt dan één werkdag, zoals de kraan op de kanaalplaten van 5 uur, dan komt er geen belasting in het histogram. Zie [Overbezetting oplossen](docs://howto-overbezetting-oplossen).

**Materiaal.** Bij een materiaalresource is de inzet de hoeveelheid per dag, in de eenheid van de resource, bijvoorbeeld m³. Materiaal telt niet mee voor de duur van de taak.

**Een werkregel kan de duur aanpassen.** Staat de taak op *Vast werk* of *Vaste inzet*, dan verandert een tweede resource de duur van de taak. De planning is dan verouderd; druk op **Bereken** (F5). Zie [Werkregels: duur, inzet en werk](docs://uitleg-werkregels).

**Een eigen verdeling.** Heeft de toewijzing al een eigen urenverdeling, dan staat de curve uitgeschakeld op *Contour*. Laat die verdeling eerst los via *Urenverdeling…*.

**Terugdraaien.** Een toewijzing maken, wijzigen of verwijderen kun je met *Ongedaan* (Ctrl+Z) terugdraaien.

## Zie ook

- [Urenverdeling aanpassen](docs://howto-urenverdeling-aanpassen): de uren per dag zelf bepalen.
- [Overbezetting oplossen](docs://howto-overbezetting-oplossen): wat je doet als een resource op een dag te veel moet doen.
- [Werkregels: duur, inzet en werk](docs://uitleg-werkregels): wat er gebeurt met de duur als je de inzet wijzigt.
