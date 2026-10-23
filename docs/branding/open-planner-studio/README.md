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

De logo-assets zijn beschikbaar voor gebruik; deze toevoeging activeert ze nog niet in de applicatie of de installers.

Voor het bewerken en opnieuw renderen: zie [LEESMIJ.txt](LEESMIJ.txt). De generator gebruikt Blender, zonder Node.js. De fonts hebben een eigen [SIL Open Font License](04-source/fonts/OFL.txt).

## Gebruik in de app: doorzichtig bovenvlak

De app en de installers gebruiken alleen het beeldmerk (de kubus), met een **doorzichtig bovenvlak** in plaats van #594124, net als de zijvlakken. Dat besloot de eigenaar (Ethan) op 2026-10-23: "het bovenvlak moet natuurlijk doorzichtig zijn". Een eerder besluit van dezelfde dag (wit bovenvlak) is daarmee vervallen. Het pakket in deze map blijft ongewijzigd.

Afleiding: [`scripts/branding/bovenvlak_open.py`](../../../scripts/branding/bovenvlak_open.py) projecteert elke pixel op de lijn bruin → amber. Het bruine aandeel wordt doorzichtig; het amber aandeel blijft als dekking in #F59E0B, zodat de randen tegen de amber contour schoon blijven. Zo ontstaan de masters in [`docs/branding/app-iconbron/`](../app-iconbron/). [`scripts/generate-icon.py`](../../../scripts/generate-icon.py) maakt daaruit alle app- en installer-iconen.
