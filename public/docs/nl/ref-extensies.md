# Extensies beheren en installeren

Extensies voegen functies aan de app toe, zoals extra importformaten of eigen ribbon-knoppen. Ze zijn app-niveau: ze horen bij deze installatie op dit apparaat, niet bij een projectbestand.

## Openen

**Bestand** → **Extensies** (Backstage). Bovenaan twee tabbladen — **Geïnstalleerd** en **Bladeren** — met daarnaast de knoppen **ZIP** en **JS**, en daaronder een zoekveld (**Zoek extensies...**).

## Geïnstalleerd

Per extensie een kaart met naam, versie, categorie, beschrijving en auteur, plus:

- **Aan/uit-schakelaar** — schakelt de extensie in of uit zonder hem te verwijderen.
- **Verwijderen** — klik nogmaals op **Bevestig** om definitief te verwijderen.

Een extensie die niet kon laden toont een foutmelding op de kaart. Zonder extensies meldt het tabblad: "Nog geen extensies geïnstalleerd."

## Bladeren (catalogus)

Het tabblad **Bladeren** haalt de online extensiecatalogus op (internetverbinding nodig). Per catalogus-item een kaart met **Installeren**; al geïnstalleerde extensies tonen de badge **Geïnstalleerd**. Lukt het laden niet, dan verschijnt een foutmelding met **Opnieuw proberen**.

## Installeren vanuit een bestand

- **ZIP** — installeert een extensie-ZIP (met `manifest.json` + `main.js`).
- **JS** — installeert een los `.js`-bestand met ingebouwd manifest.

Na installatie is de extensie meteen ingeschakeld en verschijnen eventuele ribbon-knoppen direct.

## Importeren via extensies

**Bestand** → **Importeren** toont de importformaten die geïnstalleerde extensies aanbieden; klik een formaat en kies een bestand. Zonder import-extensies meldt de pagina: "Geen import-extensies geïnstalleerd. Voeg er een toe via Extensies." De ingebouwde importformaten (CSV, MS Project, P6) staan los hiervan — zie [Im-/export](docs://gids-import-export).

## Zelf extensies schrijven

De handleiding voor extensie-auteurs (manifest, API, permissies) staat in de repository: `github.com/OpenAEC-Foundation/open-planner-studio`, bestand `docs/extensions.md`.
