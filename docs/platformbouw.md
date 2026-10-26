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
- De uitvoer staat in `dist-platform/`, met `dist-platform/.vite/manifest.json` (Vite `build.manifest`).
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
  /** Toon bij de start geen welkomstvenster (alleen strikt `true`). Werkt ook zonder `storage`. */
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
- Kan de tool geen instellingen bewaren (bijvoorbeeld een sandbox-iframe zonder `localStorage`), zet dan
  `skipWelcome: true`. Anders komt het welkomstvenster bij elke start terug. De tool kijkt bij de start en nog
  eens vlak voordat het venster zou openen.
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
  met dezelfde basisversie (het herstelmanifest bewaart `siteFileId` en `siteFileVersion`).
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
