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
