# Kalenderdialoog

Het venster **Kalenders** beheert de kalenderbibliotheek van het project: links de lijst met alle kalenders, rechts het bewerkformulier van de geselecteerde kalender.

## Openen

- **Planning** → lintgroep **Kalender** → knop **Kalender** of **Vrije dagen**.
- **Instellingen** (ribbontab) → lintgroep **Kalender** → **Kalender**.
- Vanuit de projectwizard: de kalenderkeuze **Aangepast…** opent na het aanmaken dit venster.

## Toepassen en annuleren

Alle bewerkingen — ook nieuw/dupliceren/verwijderen — gebeuren in een werkkopie. **Toepassen** (of **Enter**) schrijft alles in één keer weg en herberekent de planning; **Annuleren**, **Esc**, het kruisje of een klik buiten het venster gooit álle wijzigingen weg.

## Bibliotheek (linkerkolom)

- **Lijst** — alle kalenders; de ster markeert de **Projectkalender** (de standaard voor taken zonder eigen kalender).
- **+** — **Nieuwe kalender**.
- **Dupliceren** — kopie van de geselecteerde kalender.
- **Verwijderen** — kan niet bij de laatste kalender; verwijder je de projectdefault, dan wordt een andere kalender de default.
- **Als projectdefault** — maakt de geselecteerde kalender de projectkalender (knop boven het formulier).

## Formulier (rechterkolom)

- **Naam** — vrije naam.
- **Werkdagen** — knoppen **Ma** t/m **Zo**; aan = werkdag. Presets: **Ma–vr** (standaardweek, 07–16 u, 8 u/dag) en **Continu (24/7)**.
- **Begin (uur)** / **Einde (uur)** / **Uren per dag** — de dag-brede werktijd. Verborgen zodra de kalender werktijd-banden heeft én Urenplanning aan staat; dan sturen de banden de tijden.

## Werktijden (alleen met Urenplanning ingeschakeld)

- **Afgeleide uren/dag** — controlegetal, afgeleid uit de banden.
- Presets: **Dagdienst**, **2 ploegen**, **3 ploegen**, **Nachtploeg**, **24/7** — elk zet de werktijd-banden in één keer.
- **Bewaar als preset…** — sla de huidige werktijden op als eigen preset (op dit apparaat); eigen presets verschijnen als knoppen met een verwijder-kruisje.
- **Per weekdag instellen…** / **Werktijden tonen/verbergen** — opent of in-/uitklapt de banden-editor.
- **Banden-editor** — per weekdag een lijst tijd-banden (begin–eind), met per band een **volgende dag**-vinkje (nachtploeg over middernacht), **Band toevoegen** (een gat tussen twee banden is een pauze), **Kopieer naar alle werkdagen**, de urensom per dag en onderaan de afgeleide uren/dag. Zie [Kalenders & uren-planning](docs://gids-kalenders-uren).

## Feestdagen genereren…

Genereert de feestdagenlijst regelgebaseerd over de projectperiode:

- **Land** — Nederland, Duitsland, België, Frankrijk, Verenigd Koninkrijk, Oostenrijk, Zwitserland of **Geen feestdagen**.
- **Regio** — alleen bij landen met regionale sets; standaard **Landelijk**.
- **Bouwvak** — alleen bij Nederland: **Geen**, **Noord**, **Midden** of **Zuid**; met de hint dat het adviesdatums zijn.
- **Preview** — samenvattingsregel ("n feestdagen, jaar–jaar"), uitklapbaar tot de volledige lijst.
- **Genereren** vervangt de feestdagenlijst; **Annuleren** sluit het blok.
- Loopt het project inmiddels buiten de gegenereerde jaren, dan verschijnt bovenin een hint met een **Opnieuw genereren**-knop.

## Feestdagen

De lijst zelf: per regel **Omschrijving**, **Van**, **Tot** en een verwijderknop; **Feestdag toevoegen** maakt een nieuwe regel. Meerdaagse periodes (bouwvak, vorstverlet) zijn gewoon een regel met een langere Van–Tot-spanne.
