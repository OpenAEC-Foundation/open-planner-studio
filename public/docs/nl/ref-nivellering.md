# Nivelleringsopties

Het venster **Resources nivelleren** lost overbelasting op door taken te verschuiven. Het werkt in twee stappen: **Berekenen** maakt een voorstel (er wijzigt nog niets), **Toepassen** voert het uit.

## Openen

**Resources** → lintgroep **Nivellering** → **Nivelleren…**. **Esc**, het kruisje of een klik buiten het venster sluit zonder toe te passen.

## Opties

- **Alleen binnen speling nivelleren (smoothing) — projecteinddatum blijft vast** — aangevinkt schuift de nivellering taken alleen binnen hun totale speling: de einddatum kan niet verschuiven, maar niet elk conflict is dan oplosbaar. Uitgevinkt (standaard) mag de projecteinddatum uitlopen om alle conflicten op te lossen.
- **Resources** — een checkbox per resource: welke resources meedoen. Materiaal-resources ontbreken hier (materiaal wordt niet genivelleerd). Standaard staan alle resources aan.

## Berekenen

Vereist een actuele berekening; anders toont het venster "Bereken eerst de planning (F5) voordat je nivelleert." De knop is ook uitgeschakeld zolang geen enkele resource is aangevinkt. Elke optie-wijziging maakt een eerder voorstel ongeldig — bereken dan opnieuw.

## Voorstel (preview)

- **Projecteinddatum-regel** — "ongewijzigd (datum)" of "oude datum → nieuwe datum" (rood) als het project uitloopt.
- **Tabel** — per verschoven taak: **Taak**, **Oude start**, **Nieuwe start** en **Dagen verschoven**. Ook niet-geresourcete opvolgers die door de logica meeschuiven staan erin.
- Is er niets te doen, dan meldt het venster "Geen taken hoeven te verschuiven — de planning is al conflictvrij."

## Resterende conflicten

Taken die niet binnen de regels passen, met per taak het aantal conflictdagen en een reden:

- "… vraagt op de piek … eenh./dag, capaciteit is … — niet oplosbaar door schuiven." — een toewijzing vraagt op zijn piek meer dan de resource-capaciteit; verlaag de eenheden/dag of verhoog Max. eenheden.
- "De resource werkt niet op alle dagen die deze taak nodig heeft — verschuiven lost dit niet op." — kalender-mismatch tussen taak en resource.
- "Onvoldoende vrije capaciteit binnen de speling om dit conflict op te lossen." — vooral bij smoothing: binnen de beschikbare speling is geen vrij venster.

## Toepassen en terugdraaien

**Toepassen** voert het voorstel uit en sluit het venster; **Annuleren** sluit zonder wijziging. Een toegepaste nivellering maak je ongedaan met **Nivellering wissen** (dezelfde lintgroep) of Ctrl+Z.

## Verder lezen

- [Resources, histogram & nivellering](docs://gids-resources-histogram) — overbelasting herkennen in het histogram en de complete nivelleer-werkwijze.
