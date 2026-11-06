# Platformbouw: Open Planner Studio in de OpenAEC-app op Frappe

OpenAEC brengt de tools onder in één app op het Frappe Framework (issue #307). Een tool draait daar als
gebouwde webbundel binnen een Frappe-site. Dit document beschrijft wat deze tool daarvoor heeft, en wat
de bouwers van de site moeten weten. Het hostcontract onderaan is bewust algemeen: een andere tool kan het
letterlijk overnemen.

## De eisen uit #307 en waar ze in de code staan

| eis | stand | waar |
|---|---|---|
| Bundel onder een subpad, geladen door een andere pagina | `npm run build:platform -- --base /pad/` | `scripts/build-platform.mjs`, `vite.config.ts` |
| Rekent volledig in de browser, geen eigen backend | was al zo | — |
| Geen eigen login | was al zo | — |
| Openen en opslaan via de site (lijst, openen, opslaan, versies) | `FileRef` van de soort `site` | `src/services/fileAccess/siteHost.ts`, `siteBackend.ts` |
| Eigen voorvoegsel in de browseropslag, geen sleutels of tokens | alles `ops-`; AI-token uit in de platformbouw | `src/utils/buildFlags.ts` |
| Versie op een tag, gebouwd door een script | `npm ci && npm run build:platform -- --base /pad/` op de tag | `scripts/build-platform.mjs` |

## De bouw

```bash
npm ci
npm run build:platform -- --base /assets/openaec/planner/
```

- `--base` is verplicht en begint en eindigt met `/`. Zonder geldig pad stopt het script met exit 2 en een
  voorbeeld. Alle URL's in de bundel beginnen met dat pad; eigen bestanden (`docs/`, `examples/`, het
  icoon) laadt de app via `import.meta.env.BASE_URL`.
- Het script draait eerst `tsc`, net als `npm run build`, en bouwt daarna met `vite build --mode platform`.
- De uitvoer staat in `dist-platform/`, met `dist-platform/.vite/manifest.json` (Vite `build.manifest`) en
  `dist-platform/mcp-tools.json` (de tooldefinities voor de assistent, zie hieronder).
- De gewone `npm run build` en de live-deploy krijgen geen van de schakelaars hieronder. De code voor opslag
  via de site zit wel in elke bouw, maar doet alleen iets als een host aanwezig is; de desktop-app heeft nooit
  een host.

### De bouwvlag

De modus `platform` leest `.env.platform` (`VITE_OPS_PLATFORM=1`). De code leest die vlag nooit direct,
alleen via de constanten in `src/utils/buildFlags.ts`. Het zijn constanten, zodat de bundelaar de
uitgeschakelde code weglaat:

| constante | uit in de platformbouw | waarom |
|---|---|---|
| `DEMO_START_EXAMPLE` | geen voorbeeldplanning bij de start (#310) | de tool start met een leeg document |
| `EXTENSIONS_ENABLED` | geen catalogus, installatie, extensie-ribbon, importers of tutorialaanbod (#311) | een extensie draait zonder afscherming met de rechten van de ingelogde gebruiker |
| `AI_MODE_AVAILABLE` | geen AI-modus, geen AI-tabblad, geen `ops-mcpToken` | de koppeling werkt alleen in de desktop-app, en het token zou leesbaar zijn voor elke tool op de origin |

`tests/browser/platform-build.spec.ts` bouwt één keer met `--base /tools/planner/`, serveert alleen dat
subpad en toetst: het manifest, de paden in `index.html`, geen catalogus-URL in de JS, icoon, help en
voorbeelden laden, de tool start leeg, en extensies en AI-modus ontbreken.

## Inbedden in een pagina van de site

De pagina die de tool toont, staat op een ander adres dan de bundel. Er zijn twee manieren.

1. **Iframe (aanbevolen).** De pagina toont `<basispad>index.html` in een iframe van dezelfde origin.
   De tool krijgt dan zijn eigen document: zijn CSS raakt de pagina van de site niet, het thema-attribuut
   op `<html>` botst niet met dat van Frappe, en sneltoetsen zoals Ctrl+S komen bij de tool aan. De host
   (zie hieronder) mag op het venster van de pagina staan; de tool kijkt ook naar `window.parent`.
2. **Entry uit het manifest.** De pagina leest `.vite/manifest.json`, voegt de CSS en de entry-JS van
   `index.html` in, en zorgt voor een `<div id="root">` met een vaste hoogte. Let op: de CSS van de tool
   (Tailwind-basisstijlen) geldt dan voor de hele pagina, de tool zet `data-theme` op `<html>`, en het
   kleine inline script uit `index.html` dat een themaflits voorkomt draait niet. Gebruik dit alleen op een
   pagina die verder niets van de site toont.

Opslag in de browser: alle sleutels in localStorage, sessionStorage en IndexedDB beginnen met `ops-`. De enige
uitzondering is een oude sleutel `open-planner-studio-recent-files`, die de app alleen leest en daarna
verwijdert (migratie van vóór de recente bestanden in IndexedDB).

## Het hostcontract

De site zet `window.openaecHost`. De volledige beschrijving staat in de kop van
`src/services/fileAccess/siteHost.ts`; dit is de korte vorm.

```ts
interface OpenAECHost {
  storage?: SiteStorage;
  /** Open dit bestand bij de start, als de tool nog een leeg document heeft. */
  initialFileId?: string;
  /** De taal van de site (bijv. `'nl'`); de tool start in die taal als hij hem kent (#716). */
  taal?: string;
  /** Niet meer nodig (#716): elke host slaat het welkomstvenster al over. Blijft geldig. */
  skipWelcome?: boolean;
}

interface SiteStorage {
  list(query?: { extensions?: string[] }): Promise<SiteFileInfo[]>;
  open(id: string, version?: string): Promise<{ file: SiteFileInfo; data: Blob | ArrayBuffer | Uint8Array | string }>;
  save(request: { id?: string; name: string; data: Blob; baseVersion?: string }): Promise<SiteFileInfo>;
  versions(id: string): Promise<SiteVersionInfo[]>;
}

interface SiteFileInfo { id: string; name: string; version?: string; modified?: string; size?: number }
interface SiteVersionInfo { version: string; modified?: string; author?: string; label?: string }
```

Afspraken:

- De tool kijkt op het moment van gebruik, eerst naar `window.openaecHost`, dan naar `window.parent.openaecHost`
  (alleen dezelfde origin). Staan er meer tools op één pagina, zet de host dan per tool op het venster van zijn
  iframe: een host op de pagina zelf (met `initialFileId` en het ready-event) geldt voor elke tool eronder. Een host zonder de vier functies telt als "geen site". In de desktop-app is er
  nooit een site.
- Zet de site de host pas na het laden en gebruikt ze `initialFileId`, stuur dan één keer het event
  `openaec-host-ready` op het venster waar de host staat (het eigen venster van de tool, of de pagina eromheen).
- Ingebed (er staat een host, ook zonder de vier functies, of dit is de platformbouw) toont de tool bij de start
  geen welkomstvenster, en dus geen taalvraag en geen rondleiding (#716). De gebruiker opent ze zelf via het lint,
  de backstage of de instellingen; daar blijft ook de taalkeuze. `skipWelcome` is daarvoor niet meer nodig.
  Zonder `localStorage` slaat de tool het venster ook buiten een host over (#706).
- De taal komt van de host: eerst `taal` op de host (`nl`, `en`, `de`, `fr`, `es`, `tr`, of een andere taal van
  de tool), dan de `lang` van een same-origin parentpagina (`<html lang="nl">`), dan `taal=` in de hash van de
  url (`#taal=nl`). De eerste taal die de tool kent, wint, ook boven een eerder bewaarde keuze; `de-AT` wordt
  `de`. Kent de tool geen enkele, dan kiest hij zoals buiten een host (bewaarde keuze, dan de browsertaal). De
  tool bewaart de taal van de host niet.
- Zet de host vóór de tool start. De tool kiest de taal één keer, vóór de eerste weergave, en kijkt voor het
  welkomstvenster bij de start en nog eens vlak voordat het zou openen. Een latere host verandert de taal niet
  en sluit een venster dat al open staat niet.
- `list` krijgt de extensies zonder punt (`ifc`, `csv`, `xml`, `mpp`, `xer`). De site mag erop filteren; de
  tool filtert daarna zelf ook.
- `open` zonder `version` geeft de nieuwste versie, met `file.version` erbij; zonder versie weigert de tool het
  bestand. Bestaat het bestand niet (meer), weiger dan met `code === 'not-found'`: alleen dan haalt de tool het
  uit de recente bestanden. Tekstformaten leest de tool als UTF-8.
- `save` zonder `id` maakt een nieuw bestand. Met `id` schrijft het een nieuwe versie en geeft hetzelfde `id`
  terug. Het antwoord heeft altijd een `id` en een `version`; ontbreekt er een, of is het `id` anders, dan telt de
  opslag als mislukt. De tool slaat altijd IFC op (`.ifc`).
- `baseVersion` is de versie waarop het document in de tool rust: per document, gezet na een geslaagde open of
  opslag van dat document. Is het bestand intussen verder, weiger dan
  met een fout waarvan `code === 'conflict'`. De tool meldt dat apart, en het document blijft gewijzigd. Elke
  andere fout meldt de tool met de `message` van de site.
- `versions` geeft de versies, nieuwste eerst.
- Staat de host op `window.parent`, dan komen objecten uit twee vensters. Gebruik dus geen `instanceof Blob`,
  maar `data.arrayBuffer()` of `data.text()`.

### Wat de gebruiker ziet

Alleen als er een site is; zonder site verandert er niets.

- **Openen** (Ctrl+O, Start, Bestand) toont "Openen van de site": de planningen op de site, per bestand de
  versies, en een knop "Van deze pc…" voor de gewone bestandskiezer. Een bestand opent met de site als
  opslagdoel. Een oudere versie opent als kopie zonder opslagdoel, zodat Ctrl+S de nieuwste versie nooit per
  ongeluk overschrijft.
- **Opslaan** (Ctrl+S) schrijft een site-bestand zonder dialoog terug als nieuwe versie. Een document zonder
  doel, en **Opslaan als**, tonen "Opslaan op de site" met een naamveld en een knop "Op deze pc…".
- **Recente bestanden** tonen site-bestanden met het label "Op de site". Heropenen haalt de nieuwste versie.
- **Crashherstel** werkt met een site-bestand: na herstel schrijft Ctrl+S weer naar dezelfde plek op de site,
  met dezelfde basisversie (het herstelmanifest bewaart `siteFileId` en `siteFileVersion`). Crashherstel blijft
  lokaal in de browser. Weigert de browser IndexedDB (bijv. in een sandbox-iframe zonder `allow-same-origin`,
  zoals de SuperCloud-werkplek), dan gaat crashherstel stil uit voor die sessie: geen melding, één regel in de
  console. Opslaan via de site werkt gewoon.
- **Automatisch opslaan** staat uit voor een site-bestand: elke ronde zou een nieuwe versie op de site maken. De
  knop in de titelbalk is grijs en zegt waarom; crashherstel blijft actief.
- Exporteren blijft altijd een download of bestandskiezer.

### In de code

- `FileRef` heeft drie soorten: `path` (Tauri), `handle` (Chromium-web) en `site`. Elke functie in
  `src/services/fileAccess/index.ts` stuurt `site` naar `siteBackend.ts`, vóór de keuze tussen Tauri en web.
- Een document draagt `siteFileId` en `siteFileVersion` naast `filePath` en `fileHandle` (`DOCUMENT_FIELDS`,
  snapshotrol `none`, niet in het IFC). Het opslagdoel komt uit één helper (`saveTargetRef`).
- De twee dialogen (`SiteOpenDialog`, `SiteSaveDialog`) worden via `src/state/siteDialogBridge.ts` gevraagd,
  zodat de store geen componenten importeert. Ze liggen op `z-[90]`, boven de sluitvraag van een tabblad.
- Toetsen: `tests/planning/check-site-storage.ts` (contract, dispatch, opslagdoel, herstelmanifest) en
  `tests/browser/site-storage.spec.ts` (de paden hierboven, met een nep-host).

## De assistent van de site

In de platformbouw zet `src/main.tsx` `window.__OPDS_APP__` neer (`src/services/mcp/siteAppTools.ts`). De assistent van de
site bedient de tool daarmee, via de brug van de site in het frame:

```ts
window.__OPDS_APP__ = {
  tools(): Promise<string[]>;                      // de namen
  definitions(): Promise<{ name; description; inputSchema; annotations }[]>;  // zoals tools/list
  run(name, args?): Promise<unknown>;              // het structuredContent; een weigering wordt een fout `CODE: melding`
};
```

Achter `run` zit dezelfde verzoekafhandeling als achter de bridge (`createRequestHandler`), met daarachter
`handleMcpMessage`: dezelfde namen, schema's, guards en uitvoering, op het open document. Er is geen tweede implementatie.

- **Eén sessie, één documentanker.** Bij de eerste aanroep opent `__OPDS_APP__` één MCP-sessie. De eerste wijziging
  bindt de sessie aan het actieve document. Wisselt de gebruiker daarna zelf van document, dan geeft elke volgende
  wijziging `DOC_DRIFT`, tot de assistent met `planner_switch_document` expliciet een document kiest. Lezen mag door.
  Ook pauze (`PAUSED`), alleen-lezen (`READ_ONLY`) en een open dialoog (`DIALOG_OPEN`) werken zoals bij de bridge.
- **Fouten.** Elke fout heeft de vorm `CODE: melding`, en dezelfde code staat los in `error.code`. De codes zijn die van
  de tools (`VALIDATION`, `NOT_FOUND`, `DOC_DRIFT`, …), `JSONRPC_<code>` voor een fout van de dispatcher (een onbekende
  tool geeft `JSONRPC_-32602: Unknown tool: …`), en twee codes van het sitecontract:
  - `niet_in_browser: <tool>`: `planner_export_ifc` en `planner_import_schedule` werken op een bestandssysteem. Ze staan
    niet in `definitions()` en worden geweigerd, ook als stap van `planner_batch` (dan draait de hele batch niet).
    Openen en opslaan lopen via het hostcontract, door de gebruiker.
  - `te_groot: …`: een leestool die meer dan 30.000 tekens zou geven. De melding noemt een uitweg die werkt:
    `limit` en `offset` (ook optioneel op `planner_get_critical_path`, `planner_compare_baseline` en
    `planner_analyze_delay`), één `part` van `planner_get_planning_guide` (de standaardwaarde `both` is te groot),
    `planner_list_tasks` in plaats van `planner_get_project_overview`, of minder detail bij het histogram.
- **Grote wijzigingen.** Een wijzigende tool of `planner_batch` krijgt nooit achteraf een fout, want de wijziging is
  al gedaan. Van een batch gaat eerst `substeps` af (het activiteitenlog, dat de app al verwerkt heeft); een gewone
  batch van tien stappen met 20 tot 40 taken past daarna volledig. Is het antwoord dan nog te groot, dan wordt het één
  compact rapport. Elk veld is daarvoor ingedeeld (`SITE_APP_RESULT_FIELDS`):
  - altijd: de status per stap en elke koppeling van een opgegeven label naar een nieuw id (`created` van
    `planner_add_tasks` en `planner_manage_resources`, `calendars[].{requestedId, id}` van `planner_update_calendar`);
  - zolang het past: nevenwijzigingen en waarschuwingen, zoals `phaseTransitions`, verwijderde ids, de
    restwerkcorrecties en de deelweigeringen. Een lange lijst wordt de eerste regels plus het totaal in
    `compacted.shortened`. Een veld zonder indeling hoort hier ook bij;
  - weg (`compacted.omitted`): wat een leestool opnieuw geeft, zoals datums en de uitvoer van leesstappen.

  Er is één eindcontrole op het hele antwoord, envelop inbegrepen. Zouden de koppelingen samen met het rapport van
  deze aanroep niet passen, dan weigert `run` vóór uitvoering met `te_groot` en het maximum aantal nieuwe items. De
  ruimte voor het rapport hangt af van de aanroep: 4.000 tekens plus een regel per batchstap.
- **Foutantwoorden.** Ook een fout blijft binnen de grens, ook een JSON-RPC-fout. De code blijft, net als de terugrolmelding en het
  staprapport van een batch. Een lange kring wordt een aantal plus een fragment; daarna blijven zo nodig het begin en
  het eind van de melding over.
- **Laden.** De dispatcher, de toolregistry en `server.ts` worden pas bij de eerste aanroep via `import()` opgehaald.
  Een aparte chunk is het nog niet: `App.tsx` (via `useAiAutostart`), de instellingen, het AI-tabblad van het lint en
  `AiConnectionDetailsDialog` importeren `server.ts` of de toolregistry statisch, ook in de platformbouw. De MCP-laag
  zit dus in de hoofdbundel (knownbugs 850). Een browsertest die `__OPDS_APP__` in een sandbox-frame aanroept, ontbreekt
  nog (knownbugs 852).

`npm run build:platform` schrijft de definities ook naar `dist-platform/mcp-tools.json`, naast de bundel, zodat de site ze
kan controleren. Dat doet `scripts/export-mcp-tools.ts` met `siteAppToolsJson`, dezelfde pure functie als
`definitions()`; los aan te roepen met `node scripts/run-ts.mjs scripts/export-mcp-tools.ts <bestand>`.

Toetsen: `tests/mcp/cases-site-app-tools.ts` (via `installSiteAppTools` op een nepvenster: guards, documentanker,
bestandstools direct en in `planner_batch`, foutcodes, grootte-grens en inkorten, `mcp-tools.json`) en
`tests/browser/platform-build.spec.ts` (het bestand ligt naast de bundel).

## Zelf proberen

Op de dev-server (`npm run dev`) installeert `?fakeSite=1` een nep-site in IndexedDB (`ops-fake-site`), met
een paar voorbeeldbestanden; het eerste heeft twee versies. Alleen in de dev-build.

- `?fakeSite=1&fakeSiteConflict=1`: elke nieuwe versie wordt geweigerd als conflict.
- `?fakeSite=1&fakeSiteInitial=1`: de host vraagt het eerste bestand bij de start te openen.

De platformbouw zelf bekijk je met `npm run build:platform -- --base /tools/planner/` en een statische
server die `dist-platform/` onder `/tools/planner/` serveert.

## Open punten

- Er is nog geen echte site. Het contract is getoetst met een nep-host, niet met Frappe.
- Het basispad op de site ligt nog niet vast; het script vraagt het daarom altijd.
- Browseropslag (crashherstel, recente bestanden) hangt aan het browserprofiel, niet aan de ingelogde gebruiker
  van de site (knownbugs 98). Een gebruikers-id van de host zou dat kunnen oplossen.
