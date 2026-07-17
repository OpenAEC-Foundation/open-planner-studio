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

### Permissies

| Permissie | Afdwinging | Betekenis |
|---|---|---|
| `events` | **hard** — ontbreekt ⇒ `api.events.*` gooit | Abonneren/uitzenden op de event-bus. |
| `ribbon` | **hard** — ontbreekt ⇒ `api.ui.addRibbonButton` gooit | Een knop in de ribbon plaatsen. |
| `backstage` | **warn** (overgangsregime) — ontbreekt ⇒ `api.importers.*` werkt nog, maar logt een waarschuwing | Een importer registreren (verschijnt in Bestand → Importeren). |
| `filesystem` | informatief | Geen API-oppervlak; puur getoonde intentie bij installatie — **geen** sandbox-garantie (extensie-code heeft technisch gewoon toegang). |
| `network` | informatief | Idem — getoonde intentie, geen technische grens. |

`data.*`, `settings.*` en `ui.showNotification` zijn **kern-API**: altijd beschikbaar, geen permissie nodig.

De afdwinging is gecentraliseerd in `src/extensions/permissions.ts` (één tabel pad → permissie).
`minAppVersion` wordt óók afgedwongen: is de app ouder, dan weigert de extensie te activeren (status `error`).

> **Migratie (audit P16):**
> - De permissie `commands` is verwijderd — die had nooit een API-oppervlak. Manifesten die haar (of een andere onbekende waarde) noemen, blijven werken: onbekende permissies worden bij het activeren stil weggefilterd met een waarschuwing in de debug-terminal.
> - `backstage` is nu de permissie voor `api.importers.*`. Bestaande importer-extensies die haar niet declareren blijven werken (warn-modus); **declareer `backstage` in nieuwe extensies met een importer** — in een toekomstige versie wordt dit hard.

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

### Datacontract: de `Ext*`-typen

Alles wat via `api.data.*`, de importer-handlers en `sdk.factory.*` de extensie in- en uitgaat, gebruikt **stabiele extensie-typen** (`ExtProject`, `ExtCalendar`, `ExtTask`, `ExtTaskTime`, `ExtSequence`, `ExtResource`, `ExtAssignment`, `ExtImportResult`; gedefinieerd in `src/extensions/extTypes.ts`). Dit is het **publieke contract** — bewust losgekoppeld van het interne domeinmodel, zodat een interne refactor jouw extensie niet breekt.

- `api.data.getTasks()` (en de andere `get*`) leveren **verse, muteerbare kopieën**: je mag het teruggegeven object gerust muteren, dat raakt de store niet. Schrijf terug via `addTask`/`updateTask`/`addSequence` en roep `recalculate()` aan. (Vóór P16 waren dit Immer-*bevroren* objecten die je niet mocht muteren — die beperking is vervallen.)
- Een importer-handler retourneert een `ExtImportResult` (bouw 'm met `sdk.factory.emptyImportResult()`); de host mapt dat intern.

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

- De sandbox is licht: extensie-code draait via `new Function(...)` en heeft toegang tot `window`, `document` en `fetch`. Permissies worden hard afgedwongen voor `ribbon`/`events`, in warn-modus voor `backstage`, en zijn voor `filesystem`/`network` puur informatief (geen technische grens). Installeer alleen extensies die je vertrouwt.
- Objecten uit `api.data.get*()` zijn **verse, muteerbare `Ext*`-kopieën** — muteren raakt de store niet; schrijf terug via de muterende API-functies.
- Het `@manifest`-commentaarblok in een los .js-bestand moet een plat JSON-object zijn (geen geneste objecten).
