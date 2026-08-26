# Pariteitsbewijs Relaties-tab

Datum: 2026-08-26
Build: a63cce5451ca352d24d102baff167229034139fc

Alle routes hieronder zijn op dezelfde lokale build uitgevoerd in een tijdelijk project met vier
taken en de keten 1 → 2 → 3 → 4. De webbuild kan een handmatige externe relatie zonder lokaal
bestand wel beheren, maar niet uit een Tauri-bestand verversen. Daarom is in beide oppervlakken ook
de concrete melding voor die grens gecontroleerd; het werkelijk herlezen, wijzigen en als vermist
markeren van een bronbestand wordt aanvullend afgedekt door `check-recorded-dates.ts` en
`check-advanced-cpm.ts`.

| Eis-id | Oppervlak | Status | Waarneming |
|---|---|---|---|
| internal-crud | Gantt-taskgrid | GREEN | Relatie 1→2 geopend met Enter, gewijzigd naar SS+2d, via het gepositioneerde venster verwijderd en daarna weer als FS toegevoegd. |
| internal-crud | Volledige Tabel | GREEN | Relatie 1→2 gewijzigd naar FF-1d, verwijderd tot de cel `—` toonde en opnieuw als FS toegevoegd. |
| link-selected | Gantt-taskgrid | GREEN | Exact twee geselecteerde taken via Relatie → Geselecteerde taken koppelen verbonden; de melding `Relation created` verscheen. |
| link-selected | Volledige Tabel | GREEN | Taak 3 en 4 in de volledige tabel geselecteerd en via dezelfde lintactie als FS-relatie verbonden. |
| driving-free-float | Gantt-taskgrid | GREEN | Na Berekenen toonde taak 2 afzonderlijk `→ 3` en `→ 3: 0d`; de waarden kregen na een wijziging zichtbaar de status verouderd. |
| driving-free-float | Volledige Tabel | GREEN | Na Berekenen toonde taak 2 afzonderlijk `← 1; → 3` en `← 1: 0d; → 3: 0d`. |
| warnings | Gantt-taskgrid | GREEN | De handmatige externe voorganger van taak 4 kreeg een waarschuwingsicoon en de kolom toonde `← Gantt external added: bron ontbreekt`. |
| warnings | Volledige Tabel | GREEN | Dezelfde bronwaarschuwing stond apart in Waarschuwingen; dropped, afgekapt lead, te grote lead en out-of-sequence zijn daarnaast in de indextests gecontroleerd. |
| external-crud | Gantt-taskgrid | GREEN | Handmatige externe voorganger toegevoegd, in de cel bekeken, via rechtsklik hernoemd en op +1d gezet, globale verversing gaf de juiste geen-bestandmelding, en verwijderen liet de interne relatie staan. |
| external-crud | Volledige Tabel | GREEN | Externe voorganger toegevoegd, bekeken, hernoemd naar `External foundation revised` en op +2d gezet, verversactie uitgevoerd en via rechtsklik verwijderd; de interne voorganger bleef staan. |
| local-jump | Gantt-taskgrid | GREEN | Vanuit taak 2 op `Spring naar taak 1` geklikt; taak 1 werd de geselecteerde rij en het eigenschappenpaneel volgde. |
| local-jump | Volledige Tabel | GREEN | Vanuit de voorgangercel op `Spring naar taak 1` geklikt; na de normale focusovergang was WBS 1 geselecteerd. |
| predecessor-trace | Gantt-taskgrid | GREEN | Met taak 2 actief gaf alleen Voorgangers de rollen `predecessor, focus, dimmed, dimmed`; samen met Opvolgers werd taak 3 successor. |
| predecessor-trace | Volledige Tabel | GREEN | Met taak 2 actief gaf alleen Voorgangers `predecessor-driving, focus, dimmed, dimmed`; de rol bleef behouden bij de wissel van oppervlak. |
| successor-trace | Gantt-taskgrid | GREEN | Met taak 2 actief gaf alleen Opvolgers de rollen `dimmed, focus, successor, dimmed`. |
| successor-trace | Volledige Tabel | GREEN | Met beide knoppen actief waren de rollen `predecessor-driving, focus, successor-driving, dimmed`; beide lintknoppen bleven bruikbaar. |
