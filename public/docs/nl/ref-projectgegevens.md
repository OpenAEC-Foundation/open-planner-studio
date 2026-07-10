# Projectinformatie

Het venster **Projectinformatie** bevat de metadata van het project plus de sectie **Berekening** met de reken-opties. Hetzelfde formulier doet ook dienst als projectwizard bij **Nieuw**.

## Openen

- **Instellingen** (ribbontab) → lintgroep **Project** → **Projectinfo**.
- Instellingen-venster (tandwiel ⚙) → tab **Algemeen** → **Projectinformatie...**
- **Bestand** → **Projectinfo** — een vereenvoudigde variant in de Backstage, met alleen de metadata-velden (zonder Berekening-sectie).

**Toepassen** voert alle wijzigingen in één keer door; **Annuleren**, **Esc** of een klik buiten het venster gooit ze weg. **Enter** doet hetzelfde als Toepassen.

## Metadata

- **Projectnaam** — de naam in de titelbalk en het documenttabblad.
- **Beschrijving** — vrije tekst.
- **Ingenieur** en **Bedrijf** — vrije tekst; gaan mee in het IFC-bestand.
- **Startdatum** — de projectstart waarvandaan de berekening rekent.
- **Einddatum** — informatief einde van het project.

## Berekening

Reken-opties voor dit project — ze horen bij het bestand, niet bij de app, en reizen dus mee naar andere machines. Wijzig je hier iets, dan wordt de planning na **Toepassen** automatisch herberekend.

- **Kritiek-definitie** — **Totale speling ≤ drempel** (met **Drempel (werkdagen)**, standaard 0) of **Langste pad**.
- **Speling-berekening** — **Kleinste (start/finish)** (standaard), **Startspeling** of **Finishspeling**.
- **Open-eind-taken kritiek** — markeert taken zonder opvolger als kritiek.
- **Bijna-kritiek markeren** — aanvinken toont een extra **Drempel** (standaard 2 werkdagen; de eenheid volgt de Duurweergave, dus eventueel uren): taken met weinig speling krijgen de markering "bijna kritiek".
- **Meerdere speling-paden** — aanvinken toont de **Methode** (**Vrije speling (peeling)** of **Totale speling (rangschikking)**) en **Max. paden** (standaard 10): de berekening nummert dan de belangrijkste speling-paden.
- **Lag-kalender** — welke kalender de lag van een relatie telt: **Voorganger** (standaard), **Opvolger**, **24-uurs** of **Projectkalender**.

Hoe je deze resultaten leest, staat in [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse).

## De projectwizard (Nieuw)

**Nieuw** opent hetzelfde venster als wizard (titel **Nieuw project**, knop **Aanmaken**). Naast de metadata-velden bevat de wizard:

- **Fasering-template** — **Leeg**, **Woningbouw** of **Utiliteitsbouw / renovatie**: vult het nieuwe project met een fasenstructuur.
- **Ploeg** — alleen zichtbaar met Urenplanning ingeschakeld: **Dagdienst** (standaard), **2 ploegen**, **3 ploegen** of **24/7**.
- **Feestdagenset** — genereert de projectkalender: kies een land (met regio en bouwvak waar van toepassing), **Geen feestdagen**, of **Aangepast…** — die laatste opent na het aanmaken meteen de kalenderdialoog om de kalender handmatig samen te stellen. Zie [Kalenderdialoog](docs://ref-kalenderdialoog).

De Berekening-sectie ontbreekt in de wizard; die stel je daarna in via een van de ingangen hierboven.
