# Voorbeeld-extensie: Takenlijst-importer

Een complete referentie-extensie voor **Open Planner Studio**. Bedoeld om te laten zien
hoe je elk deel van de extensie-API gebruikt. Zie ook de auteurshandleiding in
[`docs/extensions.md`](../../../docs/extensions.md).

## Wat doet hij?

1. **Importer** — registreert het formaat *Eenvoudige takenlijst* (`.tasklist` / `.txt`).
   Het verschijnt in **Bestand → Importeren**. Elke regel `Naam | duur` wordt een taak;
   taken worden in een rechte keten (Eind→Start) gekoppeld. Zie [`voorbeeld.tasklist`](./voorbeeld.tasklist).
2. **Ribbon-knop** — voegt onder tab **Planning** een knop *Demo-taak* toe (permissie `ribbon`).
3. **Host-event** — luistert naar `host:schedule-calculated` en toont na elke CPM-berekening
   een melding (permissie `events`).

## Bestanden

| Bestand | Rol |
|---|---|
| `manifest.json` | Metadata + permissies (`ribbon`, `events`) |
| `main.js` | De extensie zelf (`onLoad`/`onUnload`, CommonJS) |
| `voorbeeld.tasklist` | Voorbeeld-invoer om te importeren |

## Installeren (voor het testen)

- **Los `.js`-bestand:** in **Bestand → Extensies** → knop **JS** en kies `main.js`.
  (Het manifest wordt dan uit de bestandsnaam afgeleid; permissies ontbreken, dus
  de ribbon/events-onderdelen worden geweigerd. Gebruik hiervoor liever de ZIP.)
- **ZIP:** zip de map in (zodat `manifest.json` + `main.js` in de wortel of in één
  submap staan) en kies in **Bestand → Extensies** → knop **ZIP** het zip-bestand.

```bash
# Maak een installeerbare ZIP vanuit deze map:
cd examples/extensions/voorbeeld-takenlijst-importer
zip ../voorbeeld-takenlijst-importer.zip manifest.json main.js
```

## De host-SDK

`require('open-planner-studio')` geeft een stateloze SDK:

```js
const sdk = require('open-planner-studio');
sdk.version;                       // app-versie, bv. "2026.4.0"
sdk.categories / sdk.permissions;  // geldige manifest-waarden
sdk.hostEvents;                    // { projectLoaded, projectNew, scheduleCalculated }
sdk.utils.generateId('seq');       // id's, datums (formatDate/parseDate/addBusinessDays)
sdk.factory.createTask({ name });  // volledige, geldige domeinobjecten
sdk.factory.emptyImportResult();   // startpunt voor een importer-handler
```

Muteren doe je nooit via de SDK maar via de scoped `api` die `onLoad(api)` binnenkrijgt
(`api.data.addTask`, `api.data.loadProject`, `api.data.recalculate`, …).
