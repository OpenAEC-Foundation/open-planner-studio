# Kolommen kiezen

De **Tabel** (tabblad **Tabel**) en de takenlijst naast de Gantt hebben elk hun eigen kolommen. Je past ze aan in de tabel zelf: het plusje in de tabelkop opent de kolomkiezer, en in de kolomkop verplaats je een kolom, maak je hem breder of smaller, zet je hem vast of verwijder je hem. Elke wijziging werkt meteen; er is geen OK-stap.

Standaard toont de takenlijst naast de Gantt **WBS**, **Taaknaam** en **Duur**. De Tabel toont daarnaast **Start**, **Einde**, **Taaktype**, **Kritiek**, **Totale speling** en **Voortgang**, plus de activity codes en eigen velden van het project.

## De kolomkiezer openen

- Het plusje rechts in de tabelkop. De Tabel en de takenlijst naast de Gantt hebben elk een eigen plusje, dat alleen zijn eigen tabel aanpast.
- Tabblad **Tabel** → **Kolommen…** opent de kolomkiezer van de Tabel.
- Staan de klassieke weergaveknoppen aan (**Instellingen** → tab **Geavanceerd** → **Legacy-functies** → **Klassieke weergaveknoppen tonen**), dan doet **Beeld** → lintgroep **Weergave** → **Kolommen…** hetzelfde: de knop gaat naar het tabblad Tabel en opent daar de kolomkiezer.

**Esc**, een klik buiten de kiezer of nog een klik op het plusje sluit de kiezer.

## Een kolom toevoegen

De kolomkiezer **Kolom kiezen** bevat, van boven naar onder:

- **Laatst gebruikt** — velden die je onlangs met de kiezer hebt toegevoegd. Dit blok verschijnt zodra je een kolom hebt toegevoegd.
- Het zoekveld **Zoeken** — typ een deel van een veldnaam; de **Zoekresultaten** komen uit alle groepen.
- De velden per groep: **Taak**, **Planning**, **Beperkingen**, **Relaties**, **Resources**, **Voortgang**, **Berekend**, **Baseline**, **Aangepast** en **Technisch**. Een klik op een groep klapt hem open; het getal erachter is het aantal velden in die groep.
- Onderaan de knop **Herstel standaard** (zie hieronder).

Klik op een veld om het als laatste kolom toe te voegen; de kiezer sluit dan. Een veld dat al een kolom is, staat aangevinkt en kun je niet nog eens kiezen. De activity codes en eigen velden van het project staan onder **Aangepast**, de velden van je baselines onder **Baseline**.

Onder **Berekend** staan onder andere de analysevelden **Vrije speling**, **Interfererende speling**, **Bijna kritiek** en **Spelingpad**. Ze krijgen pas waarden na een berekening (**F5**), en **Bijna kritiek** en **Spelingpad** alleen als de bijbehorende reken-optie aanstaat — zie [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).

## Kolommen aanpassen in de kolomkop

- **Verplaatsen** — sleep een kolomkop naar een andere plek. Vastgezette kolommen blijven bij elkaar vooraan; een losse kolom verplaats je alleen tussen de losse kolommen.
- **Breedte** — sleep de rechterrand van een kolomkop (40 tot 480 pixels). Een dubbelklik op die rand maakt de kolom passend voor de kop en de langste waarde. Met het toetsenbord: zet de focus op de rand en gebruik pijl links en pijl rechts, met **Shift** voor grotere stappen.
- **Verwijderen** — het minteken dat in de kolomkop verschijnt als je erover beweegt. Het veld blijft kiesbaar in de kolomkiezer.
- **Rechtsklik** op een kolomkop geeft **Vastzetten** (of **Losmaken**), **Automatisch passend maken** en **Verwijderen**. Een vastgezette kolom schuift naar voren, bij de andere vastgezette kolommen, en blijft in beeld als je de tabel horizontaal scrolt (zolang de vastgezette kolommen samen in de tabel passen).

## Start, Einde en de geplande datums

**Start** en **Einde** (in de standaardindeling van de Tabel) tonen dezelfde datums als de balk in de Gantt: de berekende planning, en vóór de eerste berekening de ingevoerde datums. Typ je bij Start een andere datum, dan wordt die de geplande start. Heeft de taak een voorganger, dan wordt die datum bovendien een constraint **Start niet eerder dan (SNET)**, net als in MS Project; anders zou de voorganger de taak bij het herberekenen gewoon terugzetten. Een bestaande SNET krijgt de nieuwe datum. Heeft de taak een andere constraint (bijvoorbeeld MSO), dan wordt de datum niet toegepast: die constraint bepaalt samen met de voorganger de start, blijft staan en wordt in een melding genoemd. Een melding vertelt steeds wat er gebeurde. Een ander Einde past bij een automatisch geplande taak de duur aan; bij een handmatig geplande taak wordt het het geplande einde. Druk daarna op **F5** om opnieuw te berekenen. Typ je dezelfde datum terug, dan verandert er niets.

De velden **Geplande start** en **Gepland einde** tonen de ingevoerde datums zelf, ook als de berekening de taak verschuift. Een getypte Geplande start volgt dezelfde SNET-regel als Start. Gepland einde is alleen te bewerken bij een handmatig geplande taak: bij andere taken bepalen start en duur het einde. Start en Einde van een automatisch geplande verzameltaak volgen uit de onderliggende taken en zijn niet te bewerken.

## Herstel standaard

**Herstel standaard** staat onderaan de kolomkiezer. Eén klik zet de kolommen van die tabel terug naar de standaardindeling: welke kolommen er staan, hun volgorde en breedte, en vastgezette kolommen. Extra toegevoegde velden verdwijnen uit de tabel en blijven kiesbaar in de kiezer. Zo krijg je na een update ook de nieuwe standaard, bijvoorbeeld **Start** en **Einde** in plaats van **Geplande start** en **Gepland einde**: een eigen, eerder bewaarde indeling verandert niet vanzelf. Staat de tabel al op de standaard, dan is de knop uitgeschakeld.

## Bewaren, ongedaan maken en layouts

De kolomindeling is een persoonlijke voorkeur op dit apparaat: hij geldt voor al je projecten en staat niet in het projectbestand. Elke kolomhandeling — toevoegen, verwijderen, verplaatsen, verbreden, vastzetten of **Herstel standaard** — is één stap die je met **Ctrl+Z** ongedaan maakt.

Een layout kan ook de kolommen vastleggen. Hij neemt de indeling over van de tabel die je ziet als je de layout maakt, en zet die bij een klik op de layoutknop in de tabel die dan in beeld is: op het tabblad Tabel de Tabel, op de andere tabbladen de takenlijst naast de Gantt. Zie [Layouts opslaan/laden](docs://ref-layouts).

## Verder lezen

- [Filters](docs://ref-filters) — welke taken de tabel en de Gantt tonen.
