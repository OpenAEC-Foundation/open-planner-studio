# Voortgang bijwerken

Doel: de werkelijke stand van het werk in de planning zetten en de planning opnieuw doorrekenen: welke taken klaar zijn, welke lopen en hoeveel er nog te doen is.

## Wanneer je dit nodig hebt

Je werkt de voortgang bij op vaste momenten, bijvoorbeeld elke vrijdag als de uitvoerder de stand doorgeeft. Zo ziet de planning wat er werkelijk gebeurd is en rekent zij het restwerk vanaf de statusdatum door. Waarom de app dat zo doet, lees je in [Voortgang, statusdatum en baseline](docs://uitleg-voortgang).

## Stappen

### 1. Zet de statusdatum

De statusdatum is de dag waarop je de stand opneemt. Zet hem vóór je voortgang invult.

1. Ga naar *Planning › Baselines & voortgang › Statusdatum*.
2. Typ de datum in de drie vakjes voor dag, maand en jaar (in de volgorde van je datumnotatie), bijvoorbeeld 28, 06 en 2027, en druk op Enter. De app springt zelf naar het volgende vakje.
3. Met het kruisje naast het veld maak je de statusdatum weer leeg.

Neem je de stand vrijdag na werktijd op, dan zet je de statusdatum op de eerstvolgende werkdag, maandag. De app plant het restwerk vanaf het begin van de statusdatum.

Vul je voortgang in terwijl er nog geen statusdatum is, dan zet de app hem op vandaag en meldt: *Er stond nog geen statusdatum: die staat nu op vandaag (…), want voortgang wordt tot de statusdatum gemeten. Aanpassen kan via Planning → Statusdatum.* Doe dit dus liever eerst zelf.

### 2. Vul de voortgang in

Kies de manier die bij je situatie past. Ze maken hetzelfde resultaat.

**Eén taak in het paneel Eigenschappen.** Handig als je één taak bijwerkt.

1. Klik op de taak. Zie je het paneel *Eigenschappen* niet, zet het dan aan met *Beeld › Panelen › Eigensch.*
2. Sleep de schuif *Voortgang (%)* naar het percentage dat klaar is.
3. Vul zo nodig *Werkelijke start* en *Werkelijke einde* in, op dezelfde manier als de statusdatum. Het veld *Resterend* rekent de app zelf uit; je kunt het hier niet wijzigen.

Bij een mijlpaal staat er één veld, *Werkelijke datum*.

**Een percentage kiezen in het menu.** Handig voor een snelle stand.

1. Klik met de rechtermuisknop op de taakbalk in de Gantt.
2. Kies *Voortgang* en dan 0%, 25%, 50%, 75% of 100%.

**Meerdere taken in de tabel.** Handig als je een hele lijst bijwerkt.

1. Klik op de **+** rechts in de kop van de takenlijst (*Kolom toevoegen*) en open de categorie *Voortgang*. Voeg de kolommen *Werkelijke start*, *Werkelijke einde*, *Resterend* en *Status* toe. De kolom *Voortgang* staat al op het tabblad *Tabel*.
2. Dubbelklik op een cel, typ de waarde en druk op Enter. Een percentage typ je als `50` of `50%`, een datum als `25-06-2027`, een resterende duur als `1`.
3. Bij *Status* druk je na een dubbelklik op Enter en kies je *Niet gestart*, *Bezig* of *Voltooid*.

Typ je een resterende duur, dan rekent de app het percentage terug: bij een taak van 2 werkdagen geeft een rest van 1 een percentage van 50. Een rest van 0 maakt de taak voltooid. Kies je bij *Status* *Niet gestart*, dan gaat het percentage naar 0 en verdwijnen de werkelijke datums.

**Alles van één taak in het venster Taak bewerken.** Klik met de rechtermuisknop op de taak en kies *Bewerken...*. De voortgangsvelden staan er ook. Ze gelden pas als je op *Opslaan* klikt.

**Veel taken tegelijk uit een spreadsheet.** Zie [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren).

### 3. Reken de planning door

Elke wijziging in voortgang of statusdatum maakt de planning verouderd: de statusbalk meldt *Verouderd — herbereken (F5)*. Druk op **Bereken** (F5), bijvoorbeeld via *Planning › Planning › Bereken*. Staat *Automatisch berekenen* aan (onder *Instellingen › Project › Instellingen*, tabblad *Planning*), dan doet de app dit zelf.

## Resultaat controleren

- Op de statusdatum staat in de Gantt een gestippelde lijn met de datum in de kop. Bij lopende taken buigt de lijn uit naar het percentage in de balk. Aan of uit zet je die met *Beeld › Baselines & voortgang › Voortgangslijn* en *Statusdatumlijn*.
- Het voltooide deel van een balk wordt grijs; de rest houdt zijn kleur. Een taak die helemaal klaar is, is helemaal grijs, met een vinkje voor de naam en zonder spelingsband. Ook de balk van een fase wordt grijs tot zijn afgeleide percentage, zodat je per fase ziet hoe ver het werk is. Toon je voorgangers of opvolgers van een taak, dan houden die balken hun markeerkleur, ook als ze klaar zijn.
- Voltooide taken zijn nooit rood: met een statusdatum is een voltooide taak niet kritiek.
- Fasen tonen een afgeleid percentage en het einde van de planning kan opgeschoven zijn.
- Heb je een baseline opgeslagen, dan staat onder elke balk de oorspronkelijke planning en laat het rapporttype *Variance* de afwijking zien.

## Valkuilen en wat de app dan doet

**Een datum na de statusdatum.** De app weigert een werkelijke start of een werkelijk einde na de statusdatum. In het paneel staat onder de velden *Actuals kunnen niet ná de statusdatum liggen*; in de tabel meldt de cel *De werkelijke datum ligt na de statusdatum.* Zet de statusdatum eerst later, of corrigeer de datum.

**Een taak die pas na de statusdatum zou beginnen.** Vul je voortgang in bij een taak die volgens de planning nog niet begonnen zou zijn, dan opent het venster *Werkelijke start opgeven*. Het vraagt wanneer de taak werkelijk begon; het voorstel is de statusdatum. Met *Voortgang toepassen* leg je het vast, met *Annuleren* verandert er niets.

**100 % zonder datums.** Zet je een taak op 100 % zonder werkelijk einde, dan wordt het werkelijke einde de statusdatum, ook als de taak eerder klaar was. Vul dan het werkelijke einde zelf in.

**Een percentage onder 100 %.** Zet je een voltooide taak terug onder de 100 %, dan vervalt het werkelijke einde. Wis je alleen het werkelijke einde, dan gaat het percentage naar 0 en blijft de taak *Bezig*. Wil je de taak weer als niet begonnen laten tellen, wis dan ook de werkelijke start, of kies in de tabel bij *Status* *Niet gestart*.

**De duur van een lopende taak wijzigen.** Het gedane werk blijft gedaan en het percentage past zich aan. Een taak van 5 werkdagen op 60 % die je op 10 werkdagen zet, staat daarna op 30 %. Een duur die korter is dan het gedane werk weigert de app: *‘Binnenspouwblad metselen’ is al voor 60% gedaan: een duur korter dan het gedane werk kan niet. De duur is niet gewijzigd.* In de tabel meldt de cel *Deze duur is korter dan het werk dat al gedaan is.*

**De restduur is afgerond.** De app rondt de restduur af op hele werkdagen. Bij een taak van 2 werkdagen geven 50 % en 75 % allebei een rest van 1 werkdag.

**Een fase.** Een fase heeft geen eigen voortgang. In het paneel staat *Afgeleid uit de onderliggende taken: wijzig de voortgang daar. De samenvattende taak volgt na berekenen (F5).* In de tabel meldt de cel *De voortgang van een samenvattende taak wordt afgeleid uit de onderliggende taken en kan hier niet worden gewijzigd.*

**De statusdatum later verzetten.** Het restwerk van lopende taken begint op de nieuwe statusdatum, en werk dat nog niet begonnen is kan niet voor die datum liggen. Verzet hem dus alleen samen met een update van de voortgang. Zet je een statusdatum zonder ook voortgang in te vullen, dan schuift alle werk dat nog niet begonnen is naar die datum (behalve in het profiel Microsoft Project).

**Een vergissing.** Elke voortgangswijziging is één stap voor Ctrl+Z.

## Zie ook

- [Voortgang, statusdatum en baseline](docs://uitleg-voortgang): hoe de app het restwerk en de statusdatum rekent, met een uitgewerkt voorbeeld.
- [Voortgang uit een spreadsheet importeren](docs://howto-voortgang-importeren): voortgang van veel taken tegelijk inlezen.
- [De voortgangsmodus kiezen](docs://howto-voortgangsmodus-kiezen): wat de app doet met een taak die al begonnen is terwijl zijn voorganger nog loopt.
- [Een baseline opslaan en beheren](docs://howto-baseline-opslaan-en-beheren): de oorspronkelijke planning vastleggen om de voortgang mee te vergelijken.
