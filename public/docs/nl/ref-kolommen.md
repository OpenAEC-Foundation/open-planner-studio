# Kolommen kiezen

Het venster **Kolommen** bepaalt welke kolommen het Tabel-tabblad toont, in welke volgorde en hoe breed. (De taaktabel links van de Gantt heeft vaste kolommen: WBS, Taaknaam en Duur.)

## Openen

Het plusje rechts in de tabelkop, of tabblad **Tabel** → **Kolommen…**. (De knop **Beeld** → lintgroep **Weergave** → **Kolommen…** hoort bij de klassieke weergaveknoppen — zie de gids Layouts.) Elke wijziging wordt direct toegepast — er is geen aparte OK-stap; **Sluiten**, **Esc**, het kruisje of een klik buiten het venster sluit het venster.

## Gekozen kolommen

Per kolom een rij met:

- **Sleepgreep** — versleep de rij om de kolomvolgorde te wijzigen.
- **Zichtbaar** — uitvinken verbergt de kolom zonder hem uit de lijst te verwijderen.
- **Naam** — het veldlabel zoals de tabel het toont.
- **Breedte** — in pixels (minimaal 40).

## Beschikbare velden

Onder de gekozen kolommen staat de lijst **Beschikbare velden**: elk veld dat nog géén kolom is. Aanklikken voegt het als kolom toe. Naast de standaardvelden staan hier onder andere de analysevelden **Mijlpaal**, **Vrije speling**, **Interfererende speling**, **Bijna kritiek** en **Speling-pad**, plus **Resources** en de activity codes en eigen velden van het project. De drie speling-velden en Speling-pad krijgen pas waarden na een berekening met de bijbehorende reken-opties — zie [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).

**Start** en **Einde** (in de standaardindeling) tonen dezelfde datums als de balk in de Gantt: de berekende planning, en vóór de eerste berekening de ingevoerde datums. Typ je bij Start een andere datum, dan wordt die de geplande start. Een ander Einde past bij een automatisch geplande taak de duur aan; bij een handmatig geplande taak wordt het het geplande einde. Druk daarna op **F5** om opnieuw te berekenen. Typ je dezelfde datum terug, dan verandert er niets.

De velden **Geplande start** en **Gepland einde** tonen de ingevoerde datums zelf, ook als de berekening de taak verschuift. Gepland einde is alleen te bewerken bij een handmatig geplande taak: bij andere taken bepalen start en duur het einde. Start en Einde van een automatisch geplande verzameltaak volgen uit de onderliggende taken en zijn niet te bewerken.

## Herstel standaard

**Herstel standaard** staat onderaan de kolomkiezer (het plusje rechts in de tabelkop, of tabblad **Tabel** → **Kolommen…**). Eén klik zet de kolommen van die tabel terug naar de standaardindeling: welke kolommen er staan, hun volgorde en breedte, en vastgezette kolommen. Extra toegevoegde velden verdwijnen uit de tabel en blijven kiesbaar in de lijst. Zo krijg je na een update ook de nieuwe standaard, bijvoorbeeld **Start** en **Einde** in plaats van **Geplande start** en **Gepland einde**: een eigen, eerder bewaarde indeling verandert niet vanzelf. Het is één handeling, dus **Ctrl+Z** zet je eigen indeling terug. Staat de tabel al op de standaard, dan is de knop uitgeschakeld.

De kolommenset maakt deel uit van een opgeslagen layout — zie [Layouts opslaan/laden](docs://ref-layouts).

## Verder lezen

- [Filters](docs://ref-filters) — welke taken de tabel en de Gantt tonen.
