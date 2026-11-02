# Open Planner Studio — logopakket

Het isometrische kubuslogo met zes Gantt-blokken op drie rijen. De tijdlijn en één taakbalk lopen over de hoek door. Beide verticale zijvlakken zijn transparant.

![Open Planner Studio](preview.png)

[Download het volledige logopakket](open-planner-studio-kubus-v4-logopakket.zip) · [Gebruiksinstructies](LEESMIJ.txt) · [Controleaanzichten](03-views/geometry-overview.png)

## Bestanden

| Onderdeel | Bestanden |
|---|---|
| Beeldmerk, 2048 × 2048 | [Donker](01-png/open-planner-studio-symbol-dark.png) · [Transparant](01-png/open-planner-studio-symbol-transparent.png) |
| Met tekst, 3600 × 1440 | [Donker](01-png/open-planner-studio-wordmark-dark.png) · [Transparant](01-png/open-planner-studio-wordmark-transparent.png) |
| Bewerkbaar 3D-model | [Blender](02-models/open-planner-studio.blend) · [GLB](02-models/open-planner-studio.glb) |
| 3D-model met tekst | [Blender met ingepakte fonts](02-models/open-planner-studio-wordmark.blend) · [GLB](02-models/open-planner-studio-wordmark.glb) |
| App-iconen | [PNG, 64 t/m 1024 px](01-png/app-icons/) |
| Bron en fonts | [Blender-generator](04-source/build_planner.py) · [Space Grotesk en SIL OFL](04-source/fonts/) |
| Verificatie | [Controleverslag](05-checks/validation.json) · [SHA-256-bestandslijst](05-checks/SHA256SUMS.txt) |

De map bevat het complete aangeleverde pakket, ongewijzigd uitgepakt naast het oorspronkelijke ZIP-bestand. De ZIP en de bestanden in de hashmanifesten zijn byte voor byte gecontroleerd. Deze index is apart toegevoegd en valt buiten het pakketmanifest.

De app en de installers gebruiken dit logo nu niet; zie *Gebruik in de app* hieronder.

Voor het bewerken en opnieuw renderen: zie [LEESMIJ.txt](LEESMIJ.txt). De generator gebruikt Blender, zonder Node.js. De fonts hebben een eigen [SIL Open Font License](04-source/fonts/OFL.txt).

## Gebruik in de app

Van 2026-10-23 tot 2026-10-29 gebruikten de app en de installers het beeldmerk uit dit pakket, met een doorzichtig bovenvlak. Op 2026-10-29 besloot de eigenaar (Ethan) terug te gaan naar het vorige logo: "het nieuwe logo werkt voor geen meter. verander het dus terug naar het oude logo. binnenkort komt er een nieuw die wel werkt." De iconen komen weer uit [`scripts/generate-icon.mjs`](../../../scripts/generate-icon.mjs). Dit pakket blijft hier staan als bron.
