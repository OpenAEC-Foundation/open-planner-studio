# Projectinformatie

Het venster **Projectinformatie** bevat de metadata van het project plus het blok **Rekenprofiel en reken-opties**. Hetzelfde formulier doet ook dienst als projectwizard bij **Nieuw**.

## Openen

- **Instellingen** (ribbontab) → lintgroep **Project** → **Projectinfo**.
- **Bestand** → **Projectinfo** — hetzelfde formulier in de Backstage, met hetzelfde blok **Rekenprofiel en reken-opties**.

**Toepassen** voert alle wijzigingen in één keer door; **Annuleren**, **Esc** of een klik buiten het venster gooit ze weg. **Enter** doet hetzelfde als Toepassen.

## Metadata

- **Projectnaam** — de naam in de titelbalk en het documenttabblad.
- **Beschrijving** — vrije tekst.
- **Ingenieur** en **Bedrijf** — vrije tekst; gaan mee in het IFC-bestand.
- **Startdatum** — het vertrekpunt van de berekening. Een taak mét voorganger start nooit vóór deze datum; een taak zónder voorganger behoudt gewoon haar eigen, ingelezen datum, ook als die vóór de projectstart ligt — dat is nodig om een geïmporteerd bestand (bijvoorbeeld uit MS Project) exact zo te tonen als in het bronprogramma. Een harde Must-Start-On/Must-Finish-On-constraint doorbreekt beide regels: zo'n taak start altijd op de geconstrainde datum, mét of zónder voorganger, ook als die vóór de projectstart ligt. Zet je de startdatum hier naar een latere datum, dan schuift Open Planner Studio zulke te-vroege, losstaande taken automatisch mee naar de nieuwe startdatum — met een melding en met Ctrl+Z ongedaan te maken. Dat gebeurt alleen bij het bewust wijzigen van de startdatum, via Projectinfo of de AI-assistent — nooit bij het openen van een bestand.
- **Einddatum** — informatief einde van het project.

## Rekenprofiel en reken-opties

Bovenaan kies je het **Rekenprofiel**: Open Planner Studio, Primavera P6, Microsoft Project of een eigen sjabloon. Daaronder staan de vierentwintig **Conventies van dit profiel**; zet je er één om, dan maakt Open Planner Studio een eigen kopie van het profiel. Hoe dat werkt staat in de gids **Rekenprofielen** (Backstage → Help).

Daaronder staan de **Reken-opties van dit project** — ze horen bij het bestand, niet bij de app, en reizen dus mee naar andere machines. **Standaardopties van dit profiel toepassen** zet ze op de standaard van het gekozen profiel. Wijzig je in dit blok iets, dan wordt de planning na **Toepassen** meteen herberekend, ook met *Automatisch berekenen* uit. Verschuiven daardoor taken, dan noemt een melding hoeveel (gewone taken, geen samenvattingstaken); verschuift er niets, dan komt er geen melding.

- **Kritiek-definitie** — **Totale speling ≤ drempel** (met **Drempel (werkdagen)**, standaard 0) of **Langste pad**. Staat de drempel in uren, bijvoorbeeld uit een `.xer`-bestand, dan heet het veld **Drempel (uren, per taakkalender)**; een andere kritiek-definitie kiezen laat die drempel staan.
- **Speling-berekening** — **Automatisch (standaard)**, **Kleinste (start/finish)**, **Startspeling** of **Finishspeling**.
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
- **Rekenprofiel** — alleen de keuzelijst; een keuze zet ook de standaard-reken-opties van dat profiel. Conventies en reken-opties stel je daarna in via een van de ingangen hierboven.
