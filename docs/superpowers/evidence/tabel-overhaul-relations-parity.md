# Pariteitsbewijs Relaties-tab

Datum: 2026-08-26
Build: a63cce5451ca352d24d102baff167229034139fc

Alle routes hieronder zijn op dezelfde lokale build uitgevoerd in een tijdelijk project met vier
taken en de keten 1 → 2 → 3 → 4. De oorspronkelijke webproef kon een handmatige externe relatie
zonder lokaal bestand beheren en controleerde daar de concrete grensmelding. Het werkelijk
herlezen van een bronbestand is daarna ook via de zichtbare lintactie in een echte Tauri-runtime
uitgevoerd; dat aanvullende desktopbewijs staat onder de tabel.

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

## Aanvullende desktopproef: werkelijk bronbestand verversen

De desktop-app draaide rechtstreeks uit deze worktree. Een tijdelijk bronproject is als IFC
opgeslagen; een doelproject kreeg een verouderde externe voorganger naar die bron. Via de
toegankelijkheidsboom is niet een storefunctie maar de zichtbare lintbediening aangeroepen:

1. keuzeknop **Relatie** openen;
2. menu-item **Alle externe relaties vernieuwen** activeren;
3. doelproject opnieuw als IFC opslaan en inhoudelijk vergelijken.

Voor de actie had de link anker `2026-07-01` en `sourceMissing=true`. Na de actie was het anker
`2026-09-02`, `sourceMissing=false`, met de canonieke project- en taakidentiteit uit het
bronbestand. De app had daarna een berekend schema (`cpm=true`). Het blijvende beeldbewijs is
[`tabel-overhaul-review-tauri-refresh.png`](./tabel-overhaul-review-tauri-refresh.png), SHA-256
`779897f10f2f8528f12e20132f853b613e943fa90ef5abb78261a5704a03eb50`.

Na de tweede implementatiereview is dezelfde zichtbare desktopactie herhaald en zijn ook de exacte
bestanden blijvend vastgelegd: [`bron`](./tabel-overhaul-tauri-refresh-source.ifc),
[`voor`](./tabel-overhaul-tauri-refresh-before.ifc) en
[`na`](./tabel-overhaul-tauri-refresh-after.ifc). `check-tauri-refresh-evidence.ts` opent deze drie
met de productiereader en bewaakt hun hashes, anker, ontbrekend-status, bronproject, brontaak en
stabiele identiteit; de controle eindigde met 5/5 groen.

Deze proef vond eerst een echte fout: de IFC-lezer maakte bij iedere parse een nieuwe interne
taak-id. Daardoor kon een opgeslagen externe link de taak na herlezen niet terugvinden. De tweede
bewijscontrole vond dezelfde fout vervolgens op projectniveau. De writer schrijft nu
`OPS_TaskIdentity.InternalTaskId` en `OPS_ProjectSettings.InternalProjectId`; de reader gebruikt
die waarden en valt voor oudere IFC's deterministisch terug op de desbetreffende IFC-`GlobalId`.
De regressietest bewijst zowel twee opeenvolgende reads als lezen→schrijven→lezen.
`check-ifc-roundtrip` eindigde met exitcode 0 en 168 groene checks; de herhaalde echte
Tauri-verversing rapporteerde één ververste en nul ontbrekende bronnen.
