# Baselinebeheer

Het venster **Baselines** beheert de vastgelegde momentopnames van de planning: opslaan, hernoemen, de actieve baseline kiezen en verwijderen.

## Openen

**Planning** → lintgroep **Baselines & voortgang** → **Baseline opslaan…** of **Baselines beheren…** (beide openen hetzelfde venster). **Esc**, **Sluiten**, het kruisje of een klik buiten het venster sluit; alle wijzigingen in dit venster zijn direct van kracht.

## De baselinetabel

Per opgeslagen baseline één rij:

- **Actief** — keuzerondje; precies één baseline kan actief zijn. De actieve baseline is de vergelijkingsbasis voor de baseline-overlay in de Gantt en het variantierapport.
- **Naam** — direct in de rij te bewerken.
- **Aangemaakt** — de datum waarop de baseline is opgeslagen.
- **Verwijderen** (prullenbak) — verwijdert de baseline. Is het de actieve, dan vraagt het venster eerst om bevestiging ("De actieve baseline verwijderen?"); daarna wordt de laatst opgeslagen overgebleven baseline actief, of geen enkele als er niets meer over is.

Zonder baselines toont het venster "Nog geen baselines".

## Nieuwe baseline opslaan

- **Naamveld** — voorgevuld met "Baseline {n} — {datum}"; pas de naam desgewenst aan.
- **Opslaan** — legt start, einde en (bij mijlpalen) de datum van elke taak vast en maakt de nieuwe baseline actief.
- **Waarschuwing** — is de planning verouderd sinds de laatste berekening, dan verschijnt "Planning is verouderd — herbereken eerst (F5)": een hint, geen blokkade. Een baseline op een verouderde planning zou de verkeerde datums bevriezen.

## Verder lezen

- [Baselines & voortgang](docs://gids-baselines-voortgang) — baseline-overlay, variantierapport, voortgang en statusdatum.
