# Voortgang uit een spreadsheet importeren

Doel: de voortgang die uitvoerders in een spreadsheet invullen in één keer in de planning zetten, zonder elke taak zelf aan te klikken.

## Wanneer je dit nodig hebt

Een onderaannemer of uitvoerder heeft de app niet, maar geeft elke week zijn stand door: hoeveel procent klaar, wanneer begonnen, wanneer klaar. Je stuurt hem een blad met je taken, hij vult drie kolommen in en stuurt het terug. De app leest daaruit alleen drie waarden per taak: voltooiing, werkelijke start en werkelijk einde. De rest van je planning blijft ongemoeid. Wat de app met die voortgang doet, lees je in [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).

## Stappen

### 1. Zet de statusdatum en reken door

Zet de statusdatum zoals beschreven in [Voortgang bijwerken](docs://howto-voortgang-bijwerken). De uitvoerder vult werkelijke datums in tot en met die dag. Is de planning verouderd, dan rekent de app hem door voordat het blad gemaakt wordt.

### 2. Maak het blad

Kies *Planning › Voortgang › Voortgangsblad exporteren*. Dezelfde knop staat op de tabbladen *Tabel* en *Rapport*. De app maakt een Excel-bestand en stelt de naam *(projectnaam)-voortgang.xlsx* voor; in de browser komt het bestand in je downloads. Liever een CSV? Kies *Bestand › Exporteren › Voortgangsblad (CSV)*. Het Excel-blad staat daar ook, als *Voortgangsblad (Excel)*.

Het blad heeft acht kolommen. De kolomnamen blijven Engels, met een korte instructie in de taal van de app erachter:

- *OPS Task ID*, *WBS* en *Name* zijn alleen om de taak te herkennen. Laat ze staan.
- *Start* en *Finish* zijn de geplande datums, ter informatie. De app schrijft ze nooit terug.
- *Completion (%)*, *Actual Start* en *Actual Finish* vul je in.

Het Excel-blad is beveiligd, zonder wachtwoord: alleen de drie invulkolommen zijn te bewerken. Excel controleert dat een percentage tussen 0 en 100 ligt en dat een werkelijke datum een datum is. Een fase (samenvattende taak) is grijs gemarkeerd met *— verzameltaak: niet invullen*.

### 3. Laat het invullen

De uitvoerder vult per taak in:

- *Completion (%)*: 0 tot en met 100. In het Excel-blad mag met decimalen (bijvoorbeeld 33,3); in de CSV vraagt de instructie om hele getallen.
- *Actual Start* en *Actual Finish*: in Excel als datum in de eigen landinstelling; in de CSV als dd-mm-jjjj.

Wat leeg blijft, verandert niets. Met een leeg vak wis je dus ook geen bestaande voortgang; dat kan alleen in de app. Een taak die niet gestart is, laat hij helemaal leeg.

### 4. Lees het blad in

1. Kies *Planning › Voortgang › Voortgang bijwerken uit een blad* (ook op de tabbladen *Tabel* en *Rapport*), of *Bestand › Importeren › Voortgang bijwerken uit een blad*. Het venster *Voortgang bijwerken uit een blad* opent.
2. Klik op *Bestand kiezen…* en kies het ingevulde `.xlsx`- of `.csv`-bestand.
3. Zijn de datums in een CSV niet eenduidig, dan vraagt de app *Dag of maand eerst?*, met de datum uit je bestand op twee manieren gelezen. Klik op de datum die klopt.
4. Je ziet nu een voorbeeld. Bovenaan staan vier tellers: *Toegepast*, *Ongewijzigd*, *Wacht op koppeling* en *Geweigerd*. Daaronder staat per taak wat er verandert, bijvoorbeeld *Voltooiing: 0% → 100%*.
5. Controleer het voorbeeld en klik op *Toepassen*. Het venster toont *Resultaat*, met de tellers en de rijen die geweigerd zijn en waarom. Sluit af met *Sluiten*.

Je kunt het voorbeeld niet overslaan. De knop *Toepassen* is uitgeschakeld zolang er niets is om toe te passen.

### 5. Reken de planning door

Het inlezen rekent zelf niet door. Druk op **Bereken** (F5), bijvoorbeeld via *Planning › Planning › Bereken*, tenzij *Automatisch berekenen* aan staat.

## Rijen die niet zonder meer passen

De app koppelt elke rij aan een taak, eerst op *OPS Task ID* en anders op het WBS-nummer.

**Koppeling betwijfeld.** Vond de app de taak alleen op WBS-nummer, dan staat de rij onder *Koppeling betwijfeld*, met *Bevestigen* en *Wijzigen*. De rij wordt ook toegepast als je niets doet; controleer dus of de taak klopt. *Bevestigen* haalt de rij uit deze lijst; aan wat er wordt toegepast verandert het niets. *Wijzigen* laat je een andere taak kiezen. Met *Koppeling wissen* haal je een koppeling die je zelf legde weer weg. Let op: een blad van een ander project met dezelfde WBS-nummers wordt wél gekoppeld, onder *Koppeling betwijfeld*, en bij *Toepassen* doorgevoerd.

**Wacht op koppeling.** Vond de app geen taak, of meerdere met hetzelfde WBS-nummer, dan staat de rij onder *Wacht op koppeling*. Kies bij *Kies een taak…* de juiste taak; je zoekt op WBS-nummer of naam. Koppel je hem niet, dan wordt de rij geweigerd.

## Valkuilen en wat de app dan doet

Een rij die niet past, wordt geweigerd met een reden. De rest van het blad gaat gewoon door. Dit zijn de belangrijkste meldingen:

- *De werkelijke datum ligt na de peildatum.* De peildatum is je statusdatum. Zet de statusdatum later of corrigeer het blad.
- *Deze taak begint volgens de planning pas na de peildatum: vul in het blad eerst de werkelijke start in.* De app verzint geen start; geef hem in het blad mee.
- *Percentage buiten 0–100. Controleer het decimaalteken: 8,38 kan in een spreadsheet met een andere landinstelling als 838 zijn gelezen.*
- *Verzameltaken kunnen geen voortgang uit een blad krijgen.* De voortgang van een fase volgt uit de taken eronder.
- *Werkelijk einde ligt vóór werkelijke start.*
- *Onleesbare datum.* en *Onleesbaar percentage.*
- *De ingevulde waarden spreken elkaar tegen.* Bijvoorbeeld een werkelijk einde bij een percentage onder 100.
- *Geen taak gevonden voor deze rij.* Het blad noemt een taak-ID en WBS-nummer die in dit project niet voorkomen.
- *Deze WBS-code komt bij meerdere taken voor — koppel de rij met de hand.*
- *Een andere rij claimde deze taak al.* Twee rijen wijzen naar dezelfde taak.
- *Geweigerd door de planner.* Een andere weigering van de planning zelf, zonder eigen melding.

Wordt het hele bestand geweigerd, dan staat er een van deze meldingen in het venster: *Dit bestand heeft geen kolom “OPS Task ID” of “WBS” om rijen aan taken te koppelen.*, *Dit bestand heeft geen van de kolommen Voltooiing, Werkelijke start of Werkelijk einde.*, *Dit bestand is te groot om als voortgangsblad te lezen.* (meer dan 16 MB), *Dit bestand heeft te veel rijen om als voortgangsblad te lezen.* (meer dan 50.000 rijen) of *Dit bestand is met een wachtwoord beveiligd en kan niet worden gelezen.* of *Dit bestand kon niet als voortgangsblad worden gelezen.*

**Geen statusdatum.** Is er nog geen statusdatum en past de import voortgang toe, dan zet de app hem op vandaag en meldt dat. Zet hem dus eerst zelf.

**Alles in één keer terug.** Het hele blad is één stap voor Ctrl+Z.

**Alleen wat je invult.** Een rij zonder verschil met de planning telt als *Ongewijzigd*. Een taak zonder rij in het blad blijft zoals hij was.

## Zie ook

- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): wat de app met werkelijke datums en percentages rekent.
- [Voortgang bijwerken](docs://howto-voortgang-bijwerken): voortgang in de app zelf invullen.
