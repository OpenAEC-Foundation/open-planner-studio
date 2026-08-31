# Extensies schrijven voor Open Planner Studio

Een extensie is een ZIP-bestand met twee bestanden — of een los `.js`-bestand met een `@manifest`-commentaarblok.

## manifest.json

````json
{
  "id": "mijn-extensie",
  "name": "Mijn Extensie",
  "version": "1.0.0",
  "apiVersion": "1.0",
  "minAppVersion": "2026.4.0",
  "author": "Jouw Naam",
  "description": "Wat de extensie doet.",
  "category": "Import/Export",
  "main": "main.js",
  "permissions": ["ribbon", "events"],
  "icon": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
````

Categorieën: `Import/Export`, `Planning`, `Reporting`, `Utility`, `Fonts`, `Other`.

`icon` is een inline SVG-string of een emoji. Iconen worden gesaniteerd voordat ze getoond worden
(`src/utils/sanitizeSvgIcon.ts`): toegestaan zijn de gebruikelijke vorm-, tekst- en verloop-elementen
met hun geometrie-/stijlattributen. Er uit gaan altijd `script`, `foreignObject`, `use`, `image`,
`animate`, `set` en `a`, plus elk `on…`-attribuut, `href`/`xlink:href`, `style` en verwijzingen naar
buiten het document (`url(https://…)`). De SVG moet welgevormde XML zijn (één wortel, alles gesloten);
lukt het parsen niet of blijft er niets zichtbaars over, dan toont de app het standaardicoon.
Gebruik `currentColor` voor `fill`/`stroke` zodat het icoon met het thema meekleurt.

### Permissies

| Permissie | Afdwinging | Betekenis |
|---|---|---|
| `events` | **hard** — ontbreekt ⇒ `api.events.*` gooit | Abonneren/uitzenden op de event-bus. |
| `ribbon` | **hard** — ontbreekt ⇒ `api.ui.addRibbonButton` gooit | Een knop in de ribbon plaatsen. |
| `backstage` | **warn** (overgangsregime) — ontbreekt ⇒ `api.importers.*` werkt nog, maar logt een waarschuwing | Een importer registreren (verschijnt in Bestand → Importeren). |
| `pdf-fonts` | **hard** — ontbreekt ⇒ `api.pdfFonts.register` gooit | Een font-provider registreren voor de vector-PDF-export (bv. CJK-glyf-bytes). |
| `filesystem` | informatief | Geen API-oppervlak; puur getoonde intentie bij installatie — **geen** sandbox-garantie (extensie-code heeft technisch gewoon toegang). |
| `network` | informatief | Idem — getoonde intentie, geen technische grens. |

`data.*`, `settings.*`, `assets.*` en `ui.showNotification` zijn **kern-API**: altijd beschikbaar, geen permissie nodig.

De afdwinging is gecentraliseerd in `src/extensions/permissions.ts` (één tabel pad → permissie).

### Wat de app wél en niet afdwingt

Twee dingen zijn hard, en het verschil is belangrijk:

- **Integriteit van een catalogus-installatie.** Draagt een catalogusentry een `sha256` van de
  release-ZIP, dan wordt de download geverifieerd en bij het kleinste verschil geweigerd. Draagt hij
  er geen, dan installeert de app wel maar meldt hij in de debug-terminal dat de download
  ongeverifieerd is. Een aanwezige maar onleesbare hash is een weigering, niet een stille terugval.
- **Afscherming van de rauwe host-globals.** `__TAURI_INTERNALS__`, `__TAURI__` en `__OPS__` zijn
  binnen extensie-code geschaduwd op `undefined`. Alles wat een extensie legitiem nodig heeft loopt
  via `require('open-planner-studio')` en de `api` die `onLoad` krijgt.

> **Dit is geen sandbox.** Extensie-code draait in dezelfde realm als de app. `globalThis.__TAURI_INTERNALS__`
> en `Function('return this')()` komen er nog steeds bij, en `filesystem`/`network` zijn dan ook
> informatieve permissies zonder technische grens. Wat de afscherming oplevert is dat de
> gedachteloze route dicht zit: wie er alsnog omheen gaat, doet dat aantoonbaar met opzet.
> **Installeer alleen extensies waarvan je de bron vertrouwt.** Een echte grens vergt uitvoering in
> een Web Worker of iframe; dat staat op de roadmap.

### Toestemming bij installeren

Precies omdát er geen grens is, vraagt de app bij **installeren** om bevestiging — één keer, op het
moment waarop je de maker vertrouwt, niet bij elke activering. Wat de dialoog toont:

- **wie en wat**: naam, versie, auteur, omschrijving en repository uit het manifest;
- **herkomst**: catalogus of lokaal bestand, en of de download tegen een checksum geverifieerd is;
- **wat het concreet betekent** op dit platform (desktop of browser);
- **de gedeclareerde permissies** — nadrukkelijk als *voorgenomen gebruik*, niet als beperking.

Dat laatste is een bewuste keuze. Een afvinklijst in Android-stijl zou lezen als "de extensie is
hiertoe beperkt", en dat is aantoonbaar onwaar; dan is de dialoog erger dan geen dialoog.

Weigeren laat niets achter: geen record in de opslag, geen registratie, en een al geïnstalleerde
vorige versie blijft draaien. Kan de vraag niet gesteld worden (geen dialoog beschikbaar), dan wordt
er **niet** geïnstalleerd — de faalstand is weigeren, niet stil doorlaten.

Zelftests slaan de vraag over via `window.__OPS__.extensions.installFromZip`; de dialoog zelf stuur
je aan met `window.__OPS__.extensions.consent.set(fn)` / `.reset()` (dev-only).

### Twee versievelden, twee vragen

`apiVersion` en `minAppVersion` lijken op elkaar maar beantwoorden verschillende vragen, en allebei
worden ze bij het activeren afgedwongen (weigering ⇒ status `error` met de reden erbij).

| veld | vraag | vorm |
|---|---|---|
| `minAppVersion` | *Welke app-FEATURES heb ik nodig?* | CalVer, bv. `2026.4.0` |
| `apiVersion` | *Tegen welk extensie-CONTRACT ben ik gebouwd?* | semver, bv. `1.0` |

De app-versie is CalVer en zegt alleen wanneer een build gemaakt is — daar valt geen brekende
wijziging uit af te lezen. `apiVersion` doet dat wel:

- **major** verschilt ⇒ geweigerd, in beide richtingen. Een andere major betekent dat `ExtensionApi`
  of een `Ext*`-vorm brekend gewijzigd is.
- **minor** hoger dan de host ⇒ geweigerd (je rekent op iets dat deze app nog niet heeft). Lager of
  gelijk ⇒ prima: toevoegingen zijn achterwaarts compatibel.
- **patch** speelt geen rol.

`apiVersion` is **optioneel**. Laat je hem weg, dan laadt de extensie gewoon (manifesten van vóór dit
veld blijven werken) maar logt de app een waarschuwing in de debug-terminal. Zet hem in nieuwe
extensies wél: zonder dat veld merk je een contractwijziging pas als je code halverwege `onLoad`
klapt. Een onleesbare waarde (`"v1.0"`, `"1.x"`) wordt geweigerd in plaats van als `0.0.0` gelezen.

De huidige contractversie leest je uit met `require('open-planner-studio').apiVersion`.

> **Migratie (audit P16):**
> - De permissie `commands` is verwijderd — die had nooit een API-oppervlak. Manifesten die haar (of een andere onbekende waarde) noemen, blijven werken: onbekende permissies worden bij het activeren stil weggefilterd met een waarschuwing in de debug-terminal.
> - `backstage` is nu de permissie voor `api.importers.*`. Bestaande importer-extensies die haar niet declareren blijven werken (warn-modus); **declareer `backstage` in nieuwe extensies met een importer** — in een toekomstige versie wordt dit hard.

## Validatie, identiteit en quarantaine

ZIP-, JavaScript-, catalogus- en IndexedDB-invoer begint als `unknown` en wordt veld voor veld naar
een nieuw bekend object geparseerd. De uitvoerbare bron van dit contract is
[`src/extensions/validation.ts`](../src/extensions/validation.ts); die module bevat ook de actuele
limieten en is leidend wanneer deze uitleg en de code ooit uiteenlopen.

Het veldbeleid in hoofdlijnen:

- `id` is verplicht, maximaal 128 tekens, gebruikt alleen kleine letters, cijfers, punt,
  underscore en streepje, en wordt nooit automatisch getrimd of naar lowercase omgezet;
- `name`, `version`, `author`, `description`, `category`, `main`, versies, URL's, tags,
  permissies en icoongrootte krijgen een expliciete type-, vorm- en lengtegrens;
- onbekende objectvelden worden niet doorgedragen; de parser reconstrueert uitsluitend bekende
  velden en maakt kopieën van arrays, assets en geneste waarden;
- verse invoer met een onbekende permissie is ongeldig. Alleen reeds opgeslagen legacyrecords
  mogen ontbrekende `permissions` en `minAppVersion` in geheugen aanvullen en onbekende oude
  permissies wegfilteren met een waarschuwing;
- `main` en assetnamen zijn relatieve POSIX-paden. Absolute paden, backslashes, NUL, lege
  segmenten en `.`/`..` zijn verboden. ZIP-entrynamen worden vóór gebruik aan dezelfde soort
  traversalcontrole onderworpen; dubbele namen na het eventueel verwijderen van één gedeelde
  topmap zijn ongeldig;
- uitgepakte ZIP-entries/assets zijn begrensd op 24 MiB per bestand en 48 MiB totaal; opgeslagen
  `mainCode` is begrensd op 48 MiB UTF-8.

Bij installatie vanuit de catalogus moeten de `id` en `version` uit de gevalideerde
`manifest.json` exact overeenkomen met de gevalideerde catalogusentry. De app normaliseert geen
hoofdletters, spaties of versienummers om een mismatch passend te maken. Een aanwezige checksum,
de exacte identiteit, veilige ZIP-paden, consent en opslag zijn afzonderlijke poorten; falen vóór
consent laat geen half geïnstalleerde extensie achter.

De catalogus zelf heeft een atomair topcontract. Is dat topobject ongeldig, dan faalt de catalogus.
Is één entry ongeldig of heeft hij een dubbel `id`, dan wordt alleen die entry overgeslagen en
blijven latere geldige entries zichtbaar. De debuglog vermeldt hoeveel entries zijn overgeslagen.

Bij startup leest de app ieder IndexedDB-record met zijn werkelijke opslagsleutel. Alleen records
waarvan opslagsleutel, record-`id` en manifest-`id` exact overeenkomen en waarvan code/assets geldig
zijn, worden uitvoerbaar. Een ongeldige entry gaat in **quarantaine**: de code wordt niet uitgevoerd,
de kaart heeft geen aan/uit-schakelaar en blijft via de bewaarde echte opslagsleutel verwijderbaar.
Eén kapot record blokkeert latere geldige records niet. Vlak vóór elke activatie wordt het record
opnieuw gelezen en geparseerd, zodat een wijziging ná startup niet alsnog wordt uitgevoerd.

Legacydefaults bestaan alleen in de genormaliseerde geheugenwaarde. Startup herschrijft zo'n oud
record niet stil; pas een expliciete latere statuswrite bewaart de bekende genormaliseerde vorm. Een
mislukte statuswrite verandert de feitelijke runtimekeuze niet: een ingeschakelde extensie blijft
ingeschakeld en een uitgeschakelde blijft uitgeschakeld, met een zichtbare opslagfout op de kaart.

Deze validatie is **geen JavaScript-sandbox**. Zij voorkomt dat ongeldige vormen, identiteiten en
paden de loader passeren, maar geldige extensiecode draait nog steeds in dezelfde realm als de app.
Consent blijft daarom een echte vertrouwensbeslissing: valide betekent structureel bruikbaar, niet
veilig of geïsoleerd.

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
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()`, `batch(fn)` |
| `api.events` | `on/off/emit` (permissie `events`) |
| `api.ui` | `addRibbonButton(reg)` (permissie `ribbon`), `showNotification(msg, type?)` |
| `api.settings` | `get(key, default)`, `set(key, value)` — per extensie geprefixt in localStorage |
| `api.assets` | `get(name)` — rauwe bytes van een mee-verpakt (niet-`main`/`manifest`) ZIP-bestand, of `undefined` (kern-API) |
| `api.pdfFonts` | `register(provider)` (permissie `pdf-fonts`) — font-provider voor de vector-PDF-export; automatisch uitgeschreven bij disable |

`addSequence` retourneert `string | null`: het nieuwe relatie-id, of **`null`** wanneer de relatie
geweigerd is — een duplicaat (zelfde voorganger + opvolger + type), een zelfrelatie, een onbekende
taak, of een **samenvattingstaak** (een taak met subtaken) als voorganger of opvolger. Controleer
het resultaat dus op `null` in plaats van aan te nemen dat elke aanroep slaagt. Dit retourtype is
strikt correcter dan het oude gedrag: bij een geweigerd duplicaat gaf `addSequence` voorheen ook al
gewoon een `string` terug — een id dat nergens naar verwees, omdat de relatie zelf nooit is
toegevoegd.

Belangrijk: na het muteren van taken/relaties zelf `api.data.recalculate()` aanroepen — het schema wordt niet reactief herberekend. `loadProject()` doet dat automatisch.

**Muteer je meer dan een handvol dingen in een lus, wikkel dat dan in `api.data.batch()`.** Elke
losse mutatie legt anders een eigen undo-snapshot aan: honderd taken toevoegen kost honderd
snapshots (de kosten lopen kwadratisch op) en laat honderd undo-stappen achter voor wat de
gebruiker als één handeling ziet. Binnen `batch` wordt de snapshot één keer genomen:

```js
api.data.batch(() => {
  for (const row of rows) api.data.addTask({ name: row.naam });
});
api.data.recalculate();
```

`batch` kent geen rollback: gooit je callback halverwege, dan blijft staan wat al gemuteerd is —
maar de ene snapshot dekt de begintoestand, dus de gebruiker draait het in één keer terug.
Nesten mag; de binnenste `batch` doet dan niets extra's.

### Binaire assets & font-providers

Bestanden die je náást `manifest.json` en `main.js` in de installatie-ZIP stopt, worden bewaard als
**assets** en zijn op naam op te vragen met `api.assets.get(naam)` (rauwe `Uint8Array`, of `undefined`).
Dat is de manier om binaire data mee te leveren — bijvoorbeeld font-bytes. Een los `.js`-geïnstalleerde
extensie heeft geen assets. Grootte is begrensd (per bestand ≤ 24 MB, samen ≤ 48 MB).

Met de permissie `pdf-fonts` registreer je zulke bytes als **font-provider** voor de vector-PDF-export.
Een provider levert rauwe glyf-TTF-bytes + een codepoint-dekking; de export subset en bedt hem
conditioneel in. De registratie wordt bij het uitschakelen automatisch teruggedraaid.

````js
// manifest.json → "permissions": ["pdf-fonts"], en test.ttf mee in de ZIP.
module.exports = {
  onLoad(api) {
    api.pdfFonts.register({
      id: 'mijn-font',
      covers: (cp) => cp >= 0x4e00 && cp <= 0x9fff,   // bv. CJK Unified Ideographs
      getRegularBytes: async () => api.assets.get('test.ttf'),
      // getBoldBytes: async () => api.assets.get('test-bold.ttf'),  // optioneel
    });
  },
};
````

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
/** @manifest { "id": "mijn-extensie", "name": "Mijn Extensie", "version": "1.0.0", "apiVersion": "1.0", "minAppVersion": "0.0.0", "author": "Ik", "description": "…", "category": "Utility", "main": "main.js", "permissions": [] } */
````

## Beperkingen

- Er is geen JavaScript-sandbox: extensie-code draait via `new Function(...)` en heeft toegang tot `window`, `document` en `fetch`. Permissies worden hard afgedwongen voor `ribbon`/`events`, in warn-modus voor `backstage`, en zijn voor `filesystem`/`network` puur informatief (geen technische grens). Installeer alleen extensies die je vertrouwt.
- Objecten uit `api.data.get*()` zijn **verse, muteerbare `Ext*`-kopieën** — muteren raakt de store niet; schrijf terug via de muterende API-functies.
- Het `@manifest`-commentaarblok in een los .js-bestand moet een plat JSON-object zijn (geen geneste objecten).
