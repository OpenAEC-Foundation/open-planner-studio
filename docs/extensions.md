# Extensies schrijven voor Open Planner Studio

Een extensie is een ZIP-bestand met twee bestanden — of een los `.js`-bestand met een `@manifest`-commentaarblok.

## manifest.json

````json
{
  "id": "mijn-extensie",
  "name": "Mijn Extensie",
  "version": "1.0.0",
  "minAppVersion": "2026.4.0",
  "author": "Jouw Naam",
  "description": "Wat de extensie doet.",
  "category": "Import/Export",
  "main": "main.js",
  "permissions": ["ribbon", "events"],
  "icon": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
````

Categorieën: `Import/Export`, `Planning`, `Reporting`, `Utility`, `Other`.
Permissies: `ribbon` en `events` worden afgedwongen; de overige (`commands`, `backstage`, `filesystem`, `network`) zijn declaratief.
`minAppVersion` wordt **wel** afgedwongen: is de app ouder, dan weigert de extensie te activeren (status `error`).

## main.js

CommonJS-module die `onLoad(api)` exporteert (en optioneel `onUnload()`):

````js
module.exports = {
  onLoad(api) {
    // Importer: verschijnt in Bestand → Importeren
    api.importers.register({
      id: 'mijn-import',
      name: 'Mijn Formaat',
      description: 'Leest .abc-bestanden',
      fileExtensions: ['.abc'],
      handler: async (file) => {
        const text = await file.text();
        // … parse text …
        return { project, calendar, tasks, sequences, resources, assignments };
      },
    });

    // Ribbon-knop (permissie 'ribbon')
    api.ui.addRibbonButton({
      tab: 'start',
      group: 'Mijn Groep',
      label: 'Doe iets',
      onClick: () => api.ui.showNotification('Gedaan!'),
    });
  },
  onUnload() {},
};
````

## API-overzicht

| Onderdeel | Functies |
|---|---|
| `api.importers` | `register(def)`, `unregister(id)` |
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()` |
| `api.events` | `on/off/emit` (permissie `events`) |
| `api.ui` | `addRibbonButton(reg)` (permissie `ribbon`), `showNotification(msg, type?)` |
| `api.settings` | `get(key, default)`, `set(key, value)` — per extensie geprefixt in localStorage |

Belangrijk: na het muteren van taken/relaties zelf `api.data.recalculate()` aanroepen — het schema wordt niet reactief herberekend. `loadProject()` doet dat automatisch.

## Host-SDK: `require('open-planner-studio')`

Naast de scoped `api` (die `onLoad(api)` binnenkrijgt) kun je de **host-SDK** ophalen. Die is
globaal en stateloos — alleen versie-info, constanten en pure helpers om geldige
domeinobjecten te bouwen. Muteren doe je nooit via de SDK, maar via `api.data.*`.

````js
const sdk = require('open-planner-studio');

sdk.version;            // app-versie, bv. "2026.6.0"
sdk.categories;         // geldige manifest-categorieën
sdk.permissions;        // geldige manifest-permissies
sdk.hostEvents;         // { projectLoaded, projectNew, scheduleCalculated }

sdk.utils.generateId('seq');                 // id volgens de app-conventie
sdk.utils.formatDate(new Date());            // "YYYY-MM-DD"
sdk.utils.parseDate('2026-06-19');           // Date (UTC-middernacht)
sdk.utils.addBusinessDays(date, 5);          // werkdagen optellen

sdk.factory.createProject({ name: '…' });    // volledig Project
sdk.factory.createCalendar();                // standaard WorkCalendar
sdk.factory.createTask({ name: 'Taak' });    // volledige Task met defaults
sdk.factory.createTaskTime(start, 10);       // TaskTime met duur in werkdagen
sdk.factory.emptyImportResult();             // { project, calendar, tasks: [], … }
````

Een importer wordt zo veel korter:

````js
function parse(text) {
  const result = sdk.factory.emptyImportResult();
  result.project = sdk.factory.createProject({ name: 'Import' });
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    result.tasks.push(sdk.factory.createTask({ name: line.trim() }));
  }
  return result;
}
````

## Host-events

De app zendt lifecycle-events op dezelfde bus als `api.events`. Abonneer met
`api.events.on(...)` (permissie `events`); de namen staan in `sdk.hostEvents`:

| Event (`sdk.hostEvents.…`) | Naam | Data |
|---|---|---|
| `projectLoaded` | `host:project-loaded` | `{ tasks, sequences, resources }` |
| `projectNew` | `host:project-new` | — |
| `scheduleCalculated` | `host:schedule-calculated` | `{ hasError, error, criticalTasks }` |

````js
api.events.on(sdk.hostEvents.scheduleCalculated, (d) => {
  api.ui.showNotification(`Schema berekend — kritiek: ${d.criticalTasks}`);
});
````

## Compleet voorbeeld

Zie [`examples/extensions/voorbeeld-takenlijst-importer/`](../examples/extensions/voorbeeld-takenlijst-importer/) —
een werkende referentie-extensie (importer + ribbon-knop + host-event) met `manifest.json`,
`main.js`, een voorbeeld-invoerbestand en een README.

## Installeren

Bestand → Extensies → **ZIP** of **JS** (lokaal bestand), of via de **Bladeren**-tab (catalogus: `OpenAEC-Foundation/open-planner-studio-extensions`).

Bij een los `.js`-bestand mag het manifest als commentaarblok bovenaan:

````js
/** @manifest { "id": "mijn-extensie", "name": "Mijn Extensie", "version": "1.0.0", "minAppVersion": "0.0.0", "author": "Ik", "description": "…", "category": "Utility", "main": "main.js", "permissions": [] } */
````

## Beperkingen

- De sandbox is licht: extensie-code draait via `new Function(...)` en heeft toegang tot `window`, `document` en `fetch`. Permissies zijn declaratief en worden alleen voor `ribbon` en `events` afgedwongen. Installeer alleen extensies die je vertrouwt.
- Objecten uit `api.data.get*()` zijn Immer-frozen: muteer ze niet direct, gebruik de muterende API-functies.
- Het `@manifest`-commentaarblok in een los .js-bestand moet een plat JSON-object zijn (geen geneste objecten).
