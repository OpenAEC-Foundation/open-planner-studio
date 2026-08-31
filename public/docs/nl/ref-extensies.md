# Extensies beheren en installeren

Extensies voegen functies aan de app toe, zoals extra importformaten of eigen ribbon-knoppen. Ze zijn app-niveau: ze horen bij deze installatie op dit apparaat, niet bij een projectbestand.

## Openen

**Bestand** → **Extensies** (Backstage). Bovenaan twee tabbladen — **Geïnstalleerd** en **Bladeren** — met daarnaast de knoppen **ZIP** en **JS**, en daaronder een zoekveld (**Zoek extensies...**).

## Geïnstalleerd

Per extensie een kaart met naam, versie, categorie, beschrijving en auteur, plus:

- **Aan/uit-schakelaar** — schakelt de extensie in of uit zonder hem te verwijderen.
- **Verwijderen** — klik nogmaals op **Bevestig** om definitief te verwijderen.

Een extensie die niet kon laden toont een foutmelding op de kaart. Zonder extensies meldt het tabblad: "Nog geen extensies geïnstalleerd."

**Quarantaine**

Een opgeslagen extensie verschijnt in **Quarantaine** wanneer haar manifest, code, assets of interne identiteit niet meer geldig is. De app voert die code niet uit en toont op de kaart de concrete reden. Een quarantainekaart heeft bewust geen aan/uit-schakelaar. Verwijderen blijft mogelijk via **Verwijderen** en daarna **Bevestig**.

De app controleert een extensie opnieuw vlak voordat je haar inschakelt. Is een eerder geldige opslagentry intussen beschadigd of gewijzigd, dan verhuist zij naar quarantaine zonder dat haar code draait. Eén kapotte entry verhindert niet dat andere geldige extensies laden.

Bij oudere geldige records kan de app veilige ontbrekende standaardwaarden alleen in het geheugen aanvullen. Alleen het openen van de app herschrijft zo'n legacyrecord niet stil.

## Bladeren (catalogus)

Het tabblad **Bladeren** haalt de online extensiecatalogus op (internetverbinding nodig). Per catalogus-item een kaart met **Installeren**; al geïnstalleerde extensies tonen de badge **Geïnstalleerd**. Lukt het laden niet, dan verschijnt een foutmelding met **Opnieuw proberen**.

Een ongeldige catalogusentry wordt overgeslagen terwijl latere geldige entries zichtbaar blijven. De app toont het aantal overgeslagen entries en schrijft de technische redenen naar de debuglog. Is de catalogus als geheel ongeldig, dan mislukt het laden wel.

## Installeren vanuit een bestand

- **ZIP** — installeert een extensie-ZIP (met `manifest.json` + `main.js`).
- **JS** — installeert een los `.js`-bestand met ingebouwd manifest.

Na installatie is de extensie meteen ingeschakeld en verschijnen eventuele ribbon-knoppen direct.

De app valideert manifesten, identiteit, ZIP-paden en eventuele checksums vóór installatie en controleert opgeslagen gegevens opnieuw vóór uitvoering. Dit is geen JavaScript-sandbox: geldige extensiecode draait in dezelfde omgeving als de app. De toestemmingsvraag blijft daarom een vertrouwensbeslissing. Installeer alleen code en makers die je vertrouwt.

## Importeren via extensies

**Bestand** → **Importeren** toont de importformaten die geïnstalleerde extensies aanbieden; klik een formaat en kies een bestand. Zonder import-extensies meldt de pagina: "Geen import-extensies geïnstalleerd. Voeg er een toe via Extensies." De ingebouwde importformaten (CSV, MS Project, P6) staan los hiervan — zie [Im-/export](docs://gids-import-export).

## Zelf extensies schrijven

De handleiding voor extensie-auteurs (manifest, API, permissies) staat in de repository: `github.com/OpenAEC-Foundation/open-planner-studio`, bestand `docs/extensions.md`.
