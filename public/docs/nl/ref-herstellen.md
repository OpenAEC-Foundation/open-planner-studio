# Herstellen na een crash

De desktop-app bewaart automatisch herstel-snapshots van je werk. Sluit de app onverwacht af (crash, stroomuitval), dan biedt hij bij de volgende start aan om dat werk terug te halen.

## Hoe de auto-save werkt

- Kort na elke wijziging (minder dan een seconde) schrijft de app per geopend document een snapshot naar zijn eigen datamap — voor álle geopende tabbladen, ook documenten die nog nooit zijn opgeslagen.
- Dit is géén vervanging van opslaan: je projectbestand zelf wijzigt niet. Sla je werk dus gewoon op met Ctrl+S.
- De snapshots worden opgeruimd zodra je in het herstel-venster een keuze maakt (**Herstellen** of **Niet herstellen**).
- **Alleen in de desktop-app.** De browserversie heeft geen auto-save en geen herstel — sla daar zelf regelmatig op.

## Het venster "Niet-opgeslagen werk herstellen"

Verschijnt bij het opstarten als er snapshots zijn gevonden: "Open Planner Studio is niet normaal afgesloten. De volgende documenten hadden niet-opgeslagen wijzigingen die hersteld kunnen worden." Per document staat er:

- de **naam** (bestandsnaam of projectnaam; zonder naam: "Naamloos project");
- het **bestandspad**, als het document ooit is opgeslagen;
- het **aantal taken** in de snapshot;
- **Opgeslagen** — het tijdstip van de laatste snapshot.

## De keuzes

- **Herstellen** (of **Enter**) — alle genoemde documenten komen terug als geopende tabbladen. Ze gelden daarna als niet-opgeslagen: sla ze zelf op.
- **Niet herstellen** — de snapshots worden weggegooid; je start met een leeg project.
- **Kruisje**, **Esc** of een klik buiten het venster — veilig uitstellen: er wordt níets weggegooid en níets hersteld; bij de volgende start verschijnt de vraag opnieuw.

## Verder lezen

- [Snel starten](docs://quick-start) — opslaan en openen van projecten.
