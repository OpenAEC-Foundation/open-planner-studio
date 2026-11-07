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
| Taal en thema van de host, ook tijdens de sessie (#818) | `taal`, `thema`, event `openaec-host-preferences` | `siteHostPreferences.ts`, `src/hooks/useSiteHostPreferences.ts` |
| Instellingen bewaren zonder blijvende browseropslag (#818) | `settings` van de host | `src/services/fileAccess/siteHostSettings.ts` |
| Geen inline script in de bundel (#818) | het pre-paint-script is een eigen bestand | `public/theme-prepaint.js` |
| Versie op een tag, gebouwd door een script | `npm ci && npm run build:platform -- --base /pad/` op de tag | `scripts/build-platform.mjs` |

## De bouw

```bash
npm ci
npm run build:platform -- --base /assets/openaec/planner/
```

- `--base` is verplicht: een absoluut pad dat begint en eindigt met `/`, of `./` (#818, de vorm uit het
  SuperCloud-contract). Zonder geldig pad stopt het script met exit 2 en een voorbeeld. Alle URL's in de
  bundel beginnen met dat pad; eigen bestanden (`docs/`, `examples/`, het icoon) laadt de app via
  `import.meta.env.BASE_URL`. Bij `./` is dat `./`: zulke adressen lossen op tegen het adres van het document.
  De site moet `index.html` dan binnen de map van de bundel serveren (`…/planner/` of `…/planner/index.html`,
  niet `…/planner` zonder slash). Workers en dynamische chunks gebruiken `import.meta.url` en werken met
  beide vormen.
- `index.html` heeft geen inline script (#818): de Content-Security-Policy van de SuperCloud laat alleen de eigen
  bundel toe. Het kleine script dat een themaflits voorkomt, is `public/theme-prepaint.js`, een klassiek en
  blokkerend script in `<head>`. Vite kopieert het ongewijzigd uit `public/` en zet het pad in `index.html` op
  de `base` van de bouw (`/pad/theme-prepaint.js`, of `./theme-prepaint.js` bij `--base ./`), net als het icoon.
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
| `DOWNLOAD_STATS_AVAILABLE` | geen downloadcijfers in Instellingen → Geavanceerd (#818) | de cijfers komen van GitHub, en de werkplek van de SuperCloud laat geen netwerk buiten de bundel toe |

`tests/browser/platform-build.spec.ts` bouwt één keer met `--base /tools/planner/`, serveert alleen dat
subpad en toetst: het manifest, de paden in `index.html`, geen catalogus-URL in de JS, icoon, help en
voorbeelden laden, de tool start leeg, en extensies en AI-modus ontbreken.

Het laatste scenario in die spec is de controle uit #818, een benadering van de werkplek van de SuperCloud.
Een ouderpagina (`/werkplek.html`) laadt de bundel in een frame met `sandbox="allow-scripts allow-modals"`.
Het document in dat frame krijgt een strikte CSP (`default-src 'self'; script-src 'self'`, inline stijlen
toegestaan) en de bestanden `Access-Control-Allow-Origin: *`. Vóór de start staan in het frame een nep-opslag
in het geheugen en een nep-`window.openaecHost` in de platte vorm. Het scenario toetst met echte toetsen en
klikken: het startbestand opent, taal en thema van de host, Ctrl+S (`{ id, expectedVersion }` met een getal),
Opslaan als (`{ name }`), een instelling bij `settings.set`, nivelleren, en `window.__OPDS_APP__`
(`definitions()` gelijk aan `mcp-tools.json`, een leestool, `niet_in_browser` voor `planner_export_ifc`).
Over de hele route: geen consolefout, geen CSP-schending, geen verzoek buiten de bundel. De echte CSP en
sandbox van de SuperCloud kunnen strenger zijn; zie knownbugs 866, 867 en 869.

In zo'n frame weigert de browser een worker van de bundel al in de constructor (opaque origin). Nivelleren
valt dan terug op de hoofdthread (`src/services/leveling/backgroundLeveling.ts`); het snapshot voor
crashherstel deed dat al, en crashherstel staat daar toch uit (geen IndexedDB).

## Inbedden in een pagina van de site

De pagina die de tool toont, staat op een ander adres dan de bundel. Er zijn twee manieren.

1. **Iframe (aanbevolen).** De pagina toont `<basispad>index.html` in een iframe van dezelfde origin.
   De tool krijgt dan zijn eigen document: zijn CSS raakt de pagina van de site niet, het thema-attribuut
   op `<html>` botst niet met dat van Frappe, en sneltoetsen zoals Ctrl+S komen bij de tool aan. De host
   (zie hieronder) mag op het venster van de pagina staan; de tool kijkt ook naar `window.parent`.
2. **Entry uit het manifest.** De pagina leest `.vite/manifest.json`, voegt de CSS en de entry-JS van
   `index.html` in, en zorgt voor een `<div id="root">` met een vaste hoogte. Let op: de CSS van de tool
   (Tailwind-basisstijlen) geldt dan voor de hele pagina, de tool zet `data-theme` op `<html>`, en het
   script dat een themaflits voorkomt (`<basispad>theme-prepaint.js`) staat niet in het manifest; voeg het
   zelf vóór de entry in als je die flits wilt voorkomen. Gebruik dit alleen op een pagina die verder niets
   van de site toont.

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
  /** Het thema van de site: `'light'` of `'dark'` (#818). */
  thema?: string;
  /** Opslag voor de instellingen van de tool (#818), als de browser zelf niets bewaart. */
  settings?: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
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

### De SuperCloud-vorm (#818)

De OpenAEC SuperCloud zet de functies niet onder `storage`, maar direct op `window.openaecHost`:

```ts
interface HostFileRef { id: string; name: string; version: string | number }
interface SuperCloudHost {
  taal?: string; initialFileId?: string;
  open(id: string, version?: string | number): Promise<HostFileRef & { readOnly: boolean; bytes: ArrayBuffer | Uint8Array }>;
  save(bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: string | number }): Promise<HostFileRef>;
  list(): Promise<{ id: string; name: string; modified: string }[]>;
  versions(id: string): Promise<{ version: string | number; modified: string; author?: string }[]>;
}
```

De tool herkent beide vormen. Is `host.storage` geldig, dan wint die. Anders zet
`src/services/fileAccess/superCloudHost.ts` de platte functies om naar `SiteStorage` (één adapter per
hostobject). Wat er anders is:

- Versies mogen een getal zijn. De tool werkt intern met tekst en geeft bij `expectedVersion` en
  `open(id, version)` de waarde terug in de soort die de host gaf. Ids zijn altijd tekst.
- Opslaan is `save(bytes, { id, expectedVersion })`, Opslaan als is `save(bytes, { name })`. Een vreemd
  formaat weigert de host met `code: 'soort_niet_toegestaan'`; de tool toont dan *Opslaan mislukt* met de
  tekst van de host.
- `readOnly: true` bij `open`: de tool opent het bestand onder zijn eigen naam, zonder opslagdoel en
  zonder basis, met een blijvende melding dat Opslaan een nieuw bestand maakt. Het bestand blijft in Recent.
- Een conflict geeft een kopie: `save` met `id` geeft een ander `id` terug. De kopie wordt het opslagdoel,
  het document telt als opgeslagen, en de tool meldt de naam van de kopie. Bij de `storage`-vorm blijft een
  ander `id` een fout.
- De fout `code: 'VERSION_CONFLICT'` (zo meldt Open Calc Studio een conflict) telt als `'conflict'`.
- `list()` geeft geen versie per bestand. In *Openen van de site* geldt dan de eerste versie uit
  `versions` (nieuwste eerst) als de nieuwste.
- `initialFileId` en het event `openaec-host-ready` werken zoals bij de `storage`-vorm.

Afspraken (de `storage`-vorm; de SuperCloud-vorm volgt ze via de adapter):

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
- Zet de host vóór de tool start. De tool kiest de taal vóór de eerste weergave, en kijkt voor het
  welkomstvenster bij de start en nog eens vlak voordat het zou openen. Een venster dat al open staat, sluit een
  latere host niet.
- Het thema komt ook van de host (#818): `thema` is `light` of `dark`; een andere waarde telt niet. De tool start
  in dat thema, ook al vóór de eerste paint (`theme-prepaint.js` leest `window.openaecHost.thema`), en bewaart
  het niet: de eigen keuze in `ops-theme` blijft staan. Kiest de gebruiker in de tool een thema, dan geldt dat
  voor de rest van de sessie; bij de volgende start wint de host weer, net als bij de taal.
- Veranderen `taal` of `thema` op hetzelfde object, stuur dan het event `openaec-host-preferences` op het venster
  waar de host staat (#818). De tool leest beide opnieuw en neemt over wat veranderde: de taal via de vertaling
  (alleen een taal die de tool kent, `de-AT` wordt `de`), het thema in de weergave. Hij bewaart ze niet. Een
  keuze die de gebruiker in de tool maakte, blijft staan tot de host die waarde zelf wijzigt. Dit vervangt het
  gedrag van #716 ("een latere host verandert de taal niet"): zet de site de host pas na de start en stuurt ze
  `openaec-host-ready`, dan neemt de tool taal en thema alsnog over, en leest hij de instellingen (`settings`)
  als een laat antwoord (zie hieronder).
- `settings` (optioneel, #818): de tool bewaart daar zijn blijvende `ops-`-instellingen, voor een frame waarin
  `localStorage` na herladen leeg is (de SuperCloud: een vervanger in het geheugen). Eén hostsleutel per
  instelling, met dezelfde naam (`ops-theme`, `ops-showFloatBand`, …) en tekst als waarde. Twee frames die elk
  een andere instelling wijzigen, draaien elkaar zo niet terug. De tool vraagt een vaste lijst op
  (`siteHostSettingKeys.ts`; het contract heeft geen `list`), met één `get` per sleutel; `null` of `undefined`
  betekent "niet bewaard". Hij doet dat vóór hij de app laadt, zodat ook het eerste document (bijv. de kalender
  van de bouwmodus) de instellingen van de host volgt. **De start wacht hoogstens 5 s** (`HYDRATE_TIMEOUT_MS`);
  in die tijd blijft het venster leeg. Antwoordt de host op tijd, dan start de app met die waarden, en gaat
  daarna elke wijziging gebundeld terug: `set` voor een nieuwe waarde, `delete` voor een gewiste.
- **Te laat of een fout** (besluit van Ethan, 7 november 2026). Antwoordt de host niet binnen 5 s, of wijst hij
  de lezing af, dan start de app met de standaardinstellingen en toont hij een pop-up: "Je instellingen konden
  niet van de server worden geladen. Je werkt nu met de standaardinstellingen. Zodra je instellingen weer
  beschikbaar zijn, worden ze automatisch toegepast." (knop OK). Op de achtergrond wacht de tool verder:
  - Geen antwoord: de lezing blijft lopen. Er komt geen tweede verzoek naast.
  - Een afwijzing (of een waarde die geen tekst is): na 30 s een nieuwe poging, hoogstens 10 keer
    (`RETRY_DELAY_MS`, `MAX_RETRIES`), steeds één verzoek tegelijk. Lukt het nooit, dan blijft de sessie
    zonder bewaren; de pop-up heeft dat al gezegd.
  - Tijdens het wachten schrijft de tool **niets** naar de host: geen `set` en geen `delete`. Zo kan een lijst
    die de gebruiker intussen maakt (bijv. persoonlijke werksoorten) de bewaarde lijst nooit wissen.
  - Komt het antwoord alsnog, dan **winnen de bewaarde instellingen**. De tool zet de toestand die een gewone
    start met dat antwoord zou geven: een sleutel uit het antwoord krijgt die waarde; een sleutel die de
    gebruiker intussen wijzigde en die niet in het antwoord staat, gaat terug naar zijn standaard. Wat de app zelf
    bij de start invulde (bijv. de standaardindeling van de taakgrid), blijft staan, zoals bij een gewone start.
    De tool past alles live toe, zonder herladen: de instellingen in de store, de taal, de taakgrid, en de lijsten
    in open dialogen en panelen (via een `StorageEvent` per sleutel). De pop-up gaat dicht als hij nog open is.
    Daarna één korte melding: "Je instellingen zijn geladen en toegepast.", met erachter "Wat je in de
    tussentijd wijzigde, is teruggezet." als de gebruiker iets wijzigde dat daardoor terugging. Vanaf dan staat
    het bewaren aan, zoals na een gewone start.
  - **Grens:** de bouwmodus bepaalt de kalender van het eerste document bij het maken van de store. Een laat
    antwoord verandert de kalender van het document dat al open is niet; de bouwmodus van de host geldt dan
    pas voor een volgend nieuw document.
  - Een host die pas na de start komt (`openaec-host-ready`), of die verschijnt terwijl de app nog laadt (de app
    haalt dat bij het starten in), telt als een laat antwoord: de tool leest hem dan, met dezelfde regels. Antwoordt
    zo'n host binnen 5 s, dan volgt alleen de melding; anders eerst de pop-up.

  Niet mee: `ops-mcpPort`, `ops-mcpToken`, `ops-downloadStats` (van één apparaat) en de instellingen van extensies
  (`ops-ext:`); die leest, wijzigt en schrijft de tool nooit bij de host. Een fout van de host is nooit een crash.
  Een fout bij het neerzetten of teruglezen in `localStorage`, of geen `localStorage`, zet het bewaren uit voor de
  rest van de sessie, met één melding die blijft staan: zo wordt een fout nooit een wisactie, en overschrijft de
  tool niets wat hij niet begreep. Een mislukte `set` of `delete` probeert hij bij de volgende wijziging opnieuw.
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
- Toetsen: `tests/planning/check-site-storage.ts` (contract, dispatch, opslagdoel, herstelmanifest, de
  SuperCloud-adapter) en
  `tests/browser/site-storage.spec.ts` (de paden hierboven, met een nep-host).
- Taal, thema en instellingen van de host (#818): `tests/planning/check-site-host-preferences.ts` (thema- en
  taalkeuze, inlezen en terugschrijven met een nep-host), `tests/planning/check-theme-premirror.ts` (geen inline
  script; het pre-paint-script gedraagt zich als `peekTheme()`) en de host-ronden in
  `tests/browser/welcome-dialog.spec.ts` (thema van de host, live wissel, een instelling die via `settings`
  een herlaad overleeft, en een host boven de grens: pop-up, een werksoort tijdens het wachten, het late
  antwoord met de bewaarde werksoorten en de melding).

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
  batch van tien stappen met 20 tot 40 taken past daarna volledig. Is het antwoord dan nog te groot, dan wordt het
  ingekort, maar uit het antwoord van een wijzigende tool valt geen veld weg:
  - eerst de koppelingen: de paren van een opgegeven label naar een nieuw id komen uit de oorspronkelijke uitvoer en
    staan apart in `links` (`data.links` bij één aanroep, `steps[i].links` in een batch). Ze krimpen niet mee. Het gaat
    om `created` van `planner_add_tasks` en `planner_manage_resources` (dat veld verhuist naar `links`), en om
    `{requestedId, id}` van elke kalender met `created: true` uit `planner_update_calendar`;
  - weg: alleen de uitvoer van een leesvariant in een batch (`readOutputOmitted: true`). Een leesvariant is een tool
    met `readOnlyHint` of `kind: 'read'`, of een aanroep met `dryRun: true` bij een tool die dat kent (zoals
    `planner_level_resources`). De assistent roept zo'n stap los aan om hem te lezen;
  - past het dan nog niet, dan wordt steeds de grootste verzameling in het hele antwoord korter, op elke diepte. Een
    verzameling is een lijst, of een object met minstens vijf sleutels die allemaal een cijfer bevatten (een map per
    taak-id, zoals `unresolved` van de nivellering). Ze houdt haar eerste regels of sleutels; `compacted.shortened`
    noemt per pad het totaal en hoeveel er weg zijn. Losse waarden blijven staan, dus kleine meldingen zoals
    `phaseTransitions`, `becameLiteral` en `clearedLagMinutes` blijven er volledig in;
  - is er geen verzameling meer en past het nog niet, dan worden lange losse teksten ingekort (ook in `shortened`).

  Er is één eindcontrole op het hele antwoord, envelop inbegrepen. Zouden de koppelingen samen met het rapport van
  deze aanroep niet passen, dan weigert `run` vóór uitvoering met `te_groot` en het maximum aantal nieuwe items. De
  ruimte voor het rapport hangt af van de aanroep: 4.000 tekens plus per batchstap 220 tekens en de toolnaam, en voor
  een tool met een groot vast deel meer (`SITE_APP_STEP_EXTRA_CHARS`, nu `planner_level_resources`). Een test toetst
  dat een batch tot aan dat maximum altijd past en elke koppeling houdt.
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
- `?fakeSite=1&fakeSiteShape=supercloud`: de nep-site heeft de SuperCloud-vorm (versies als getal). Daarbij
  geeft `fakeSiteReadOnly=1` elk bestand alleen-lezen, en maakt `fakeSiteConflict=1` van elke nieuwe versie
  een conflictkopie. Opslaan als met een andere extensie dan `.ifc` geeft `soort_niet_toegestaan`.

De platformbouw zelf bekijk je met `npm run build:platform -- --base /tools/planner/` en een statische
server die `dist-platform/` onder `/tools/planner/` serveert.

## Open punten

- Er is nog geen echte site. Het contract is getoetst met een nep-host, niet met Frappe.
- Het basispad op de site ligt nog niet vast; het script vraagt het daarom altijd.
- Browseropslag (crashherstel, recente bestanden) hangt aan het browserprofiel, niet aan de ingelogde gebruiker
  van de site (knownbugs 98). Een gebruikers-id van de host zou dat kunnen oplossen.
