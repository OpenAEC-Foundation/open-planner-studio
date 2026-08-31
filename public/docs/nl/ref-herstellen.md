# Herstellen na een crash

De desktop-app bewaart automatisch herstel-snapshots van je werk. Sluit de app onverwacht af (crash, stroomuitval), dan biedt hij bij de volgende start aan om dat werk terug te halen.

## Crashherstel en automatisch opslaan

- De app maakt ongeveer elke tien seconden een herstel-snapshot van elk gewijzigd, geopend document — ook van documenten die nog nooit zijn opgeslagen. Dit crashherstel is altijd actief, in de desktop-app én in de browserversie.
- Crashherstel is geen vervanging voor opslaan: het projectbestand zelf wijzigt hierdoor niet.
- Bovenin, naast **Opslaan**, staat de schakelaar **Automatisch opslaan**. Zet hem bewust aan voor een bestaand IFC-bestand; dan schrijft Open Planner Studio gewijzigde inhoud met dezelfde veilige tussenpozen terug naar dat bestand.
- Een nieuw of niet-opgeslagen project heeft nog geen bestand om veilig te overschrijven. De schakelaar is dan uitgeschakeld met een uitleg. Kies eerst **Opslaan** of **Opslaan als**; daarna kan Automatisch opslaan worden ingeschakeld.
- Zet je de schakelaar uit, dan stopt alleen het overschrijven van het projectbestand. Crashherstel blijft gewoon snapshots maken.
- In een browser moet het bestaande bestand al schrijfrecht hebben. Geef dat recht bewust via een gewone handmatige opslag; automatisch opslaan vraagt nooit zelf om een permissie.
- De snapshots worden opgeruimd zodra je in het herstel-venster een keuze maakt (**Herstellen** of **Niet herstellen**).

## Het venster "Niet-opgeslagen werk herstellen"

Verschijnt bij het opstarten als er snapshots zijn gevonden: "Open Planner Studio is niet normaal afgesloten. De volgende documenten hadden niet-opgeslagen wijzigingen die hersteld kunnen worden." Per document staat er:

- de **naam** (bestandsnaam of projectnaam; zonder naam: "Naamloos project");
- het **bestandspad**, als het document ooit is opgeslagen;
- het **aantal taken** in de snapshot;
- **Opgeslagen** — het tijdstip van de laatste snapshot.

## De keuzes

- **Herstellen** (of **Enter**) — alle genoemde documenten komen terug als geopende tabbladen. Ze gelden daarna als niet-opgeslagen: sla ze zelf op. Automatisch opslaan staat na herstel bewust uit totdat je die keuze opnieuw maakt.
- **Niet herstellen** — de snapshots worden weggegooid; je start met een leeg project.
- **Kruisje**, **Esc** of een klik buiten het venster — veilig uitstellen: er wordt níets weggegooid en níets hersteld; bij de volgende start verschijnt de vraag opnieuw.

## Verder lezen

- [Snel starten](docs://quick-start) — opslaan en openen van projecten.
