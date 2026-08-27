# Onderhoudbaarheidsprogramma — ontwerp en beslisdocument

**Datum:** 2026-08-24

**Status:** uitvoerbaar ontwerp; implementatie nog niet gestart

**Peildatum code:** huidige checkout op 2026-08-24
**Bron:** [`docs/onderhoudbaarheid/audit-2026-08-24.html`](../../onderhoudbaarheid/audit-2026-08-24.html)

## 1. Doel en afbakening

Dit programma behandelt uitsluitend de vier risico's die in de huidige code aantoonbaar nog bestaan:

1. de belangrijkste interactieve bedrading heeft nog geen echte browserpoort en de React-hookregels
   staan uit;
2. `createAppStore()` maakt wel een tweede Zustand-store, maar undo-coalescing, batch- en
   MCP-transacties zijn nog module- of singletongebonden;
3. `GanttCanvas.tsx` bezit te veel verschillende verantwoordelijkheden tegelijk;
4. niet-vertrouwde extensiegegevens worden op vier ingangen te vroeg als geldige TypeScript-objecten
   behandeld.

Het programma is nadrukkelijk **geen herhaling van historische audits**. Een item komt alleen in de
scope als het in deze checkout reproduceerbaar is. Eerder opgeloste problemen zijn geen werkvoorraad.

De gewenste eindtoestand is niet "zo veel mogelijk code verplaatsen". De gewenste eindtoestand is:

- gebruikerskritische bedrading faalt vroeg en reproduceerbaar;
- elke store-instantie bezit zijn eigen uitvoeringsmetadata en transacties;
- elke extensie is vóór registratie óf aantoonbaar bruikbaar óf zichtbaar in quarantaine;
- `GanttCanvas` coördineert herkenbare subsystemen zonder teken- en hit-testgeometrie te dupliceren;
- bestaande, gezonde architectuur blijft ongemoeid.

## 2. Huidige feiten waarop het ontwerp rust

De volgende punten zijn rechtstreeks in de actuele code gemeten.

- `npm run verify` is de enige gedeelde poort van CI, live-deploy en release. `npm test` kent vier
  headless suites en nog geen browsersuite.
- `@playwright/test` staat niet in `package.json`; de workflows installeren geen browser.
- Een strikte tijdelijke hooklint-run vindt nul `rules-of-hooks`-overtredingen. Met inline
  suppressies actief zijn er 21 `exhaustive-deps`-diagnoses. Er staan daarnaast 21 expliciete
  suppressieregels. Als inlineconfig wordt genegeerd zijn er 42 diagnoses op 41 hooksites; één
  Gantt-effect levert zowel een ontbrekende dependency als een complexe dependency-expressie.
- `src/state/transaction.ts` bewaart `coalesce`, `undoSeq`, `mcpTransactionActive` en `batchDepth`
  in modulevariabelen.
- `src/state/batchTransaction.ts` en `src/state/mcpTransaction.ts` importeren de app-singleton.
  `tests/planning/check-store-factory.ts` legt die tekortkoming momenteel zelfs als bekende kloof
  vast.
- MCP-runtime en MCP-tools importeren op meerdere plaatsen rechtstreeks `useAppStore`; alleen de
  transactie-helper vervangen zou dus geen echte instantiegrens opleveren.
- `src/components/canvas/GanttCanvas.tsx` telt 1.764 regels, ongeveer zestig atomische
  storeselecties, twee `GanttRenderer`-constructies, een histogramrenderer, viewport-/scrolllogica
  en centrale pointerarbitrage.
- `src/engine/renderer/GanttRenderer.ts` houdt teken- en hit-testgeometrie bewust bij elkaar. Dat is
  een goede eigendomsgrens.
- Extensiegegevens komen binnen via catalogus-JSON, een `@manifest`-blok in losse JavaScript,
  `manifest.json` in een ZIP en bestaande IndexedDB-records. Op alle vier de grenzen ontbreekt een
  volledige runtimeparser.
- De applicatie heeft twee verschillende taak-tabeloppervlakken: de canvas-taaktabel naast de Gantt
  en de DOM-gebaseerde `TableEditor` op het Tabel-tabblad. Een bredere tabelrevisie is al als apart
  productvraagstuk beschreven; dit programma mag die niet half uitvoeren.

## 3. Uitvoeringsvolgorde en afhankelijkheden

De uitvoering is bewust serieel. Daarmee blijft er één actief spoor en is na elk pakket duidelijk
welke nieuwe garantie beschikbaar is.

```text
Plan 0 — bewijs- en hookpoorten
  |
  v
Plan 2, taak 1 — AppStoreContext + StoreRuntime-contract
  |
  v
Plan 1 — extensieparser, opslagisolatie en quarantaine
  |
  v
Plan 2, taken 2+ — undo/batch/MCP volledig storegebonden
  |
  v
Plan 3 — Gantt langs bewezen naden opdelen
```

De ogenschijnlijk vreemde sprong naar taak 1 van Plan 2 is opzettelijk. Extensiecode mag haar
documentmutaties niet opnieuw aan de singleton vastzetten, terwijl de volledige MCP-migratie geen
voorwaarde is om manifesten veilig te kunnen parseren. Daarom wordt eerst alleen het gedeelde
store-contextcontract neergezet. Daarna kan Plan 1 dat contract gebruiken; vervolgens voltooit
Plan 2 de uitvoeringsisolatie.

Parallel uitvoeren is niet nodig. Als later toch parallel gewerkt wordt, mogen Plan 1 en de
resterende taken van Plan 2 pas na dat contract uiteenlopen en moeten schrijvers in aparte
worktrees werken.

## 4. Plan 0 — eerst aantonen wat de app werkelijk doet

### 4.1 Browserpoort

De browserpoort gebruikt Playwright met één doel: de bedrading testen die headless tests niet kunnen
zien. Het is geen pixelvergelijkingssysteem.

Besluiten:

- pin `@playwright/test` exact op `1.62.1`; de lockfile blijft de gezaghebbende installatie;
- installeer alleen Chromium headless shell;
- controleer installatie met een echte `chromium.launch({ headless: true })` plus onmiddellijke
  `close()`, niet met `chromium.executablePath()` van de afzonderlijke full-Chromiumbinary;
- draai met één worker en nul retries; gedeelde appstate en een enkele devserver maken parallelle
  workers hier onnodig riskant, en retries zouden instabiele bedrading maskeren;
- laat Playwright via `webServer` de lokale Vite-server starten en op gereedheid wachten;
- geef browsersessies een eigen, worktree-veilige poortbaan naast de bestaande devpoortbaan;
- bewaar trace, screenshot en HTML-rapport alleen bij een fout;
- assert domeinstate via de dev-only `window.__OPS__`-brug, maar voer de gebruikershandeling zelf
  met echte muis-, toetsenbord- en DOM-events uit;
- gebruik stabiele `data-testid`/`data-ops-*`-ankers. Tekst en canvaspixels zijn geen locatorcontract.

De eerste browserset dekt vier regressieklassen:

1. een echte balksleep verandert de taakdatums en één undo herstelt exact de voorafgaande staat;
2. twee documenten met verschillende viewstate wisselen via de echte documenttab zonder statelek;
3. primaire/secundaire horizontale scroll en gedeelde verticale scroll zijn correct gekoppeld;
4. de DOM-tabel kan een cel via de echte UI bewerken en undoën, zodat beide tabeloppervlakken vóór
   de Gantt-refactor gekarakteriseerd zijn.

### 4.2 Browserpoort in alle echte gates

Omdat `npm run verify` ook in live- en release-gates draait, moet browserprovisioning aanwezig zijn
in precies de drie Linux-jobs die dat commando uitvoeren:

- `.github/workflows/ci.yml`, job `test`;
- `.github/workflows/live.yml`, job `gate`;
- `.github/workflows/release.yml`, job `gate`.

De matrixjob die alleen Tauri bouwt krijgt geen browsers. Browserbinaries worden niet gecachet; de
officiële Playwright-richtlijn merkt op dat het herstellen van die cache vaak even duur is en dat
Linux-systeembibliotheken er niet in zitten. De bestaande npm-cache blijft wel staan.

Workflowprovisioning, foutartefacten en het toevoegen van `test:browser` aan de gedeelde `test`-keten
landen in één commit. De opt-in runner en eerste smoke mogen eerder bestaan, maar geen commit maakt
de suite verplicht op een schone CI-runner voordat `--only-shell chromium` daar wordt geïnstalleerd.

### 4.3 Hooklint in twee stappen

`rules-of-hooks` gaat direct op `error`: de huidige tijdelijke meting is nul, dus er is geen
migratieschuld om te verbergen.

`exhaustive-deps` gaat pas op `error` nadat alle 41 hooksites bewust zijn afgehandeld. De behandeling
is niet "zet alles in de dependency-array". Per site wordt één van vier aantoonbare vormen gekozen:

1. echte dependency toevoegen;
2. callback of afgeleide waarde stabiel maken;
3. actuele waarden via een ref lezen wanneer een langlopende gesture-listener bewust niet opnieuw
   mag worden gekoppeld;
4. een lokale suppressie behouden, direct boven de site, met een functionele invariant en een test.

`reportUnusedDisableDirectives` gaat daarna terug op `error`. Daardoor kan een achterhaalde
suppressie niet blijven liggen.

### 4.4 Hooksite-ledger

De implementatie werkt de volgende ledger af. De genoemde oplossing is richtinggevend; een executor
mag een aantoonbaar eenvoudiger variant kiezen als dezelfde invariant en test behouden blijven.

**Rechtstreeks repareren**

- `Backstage.tsx:58`: `closeBackstage` met `useCallback` stabiliseren en toevoegen.
- `HelpPanel.tsx:213`: `handleNavigate` en `handleOpenExample` stabiliseren; memo op beide handlers.
- `GanttCanvas.tsx:239/243`: vertaalcallbacks toevoegen; taalwissel blijft de expliciete trigger.
- `useBarDrag.ts:246`: kalender, effectieve kalenderkaart en beide uurmodi als echte dependencies.
- `useBoxSelect.ts:131`, `useDependencyDraw.ts:75/123`, `usePan.ts:63`: stabiele refs expliciet
  opnemen.
- `useRowDrag.ts:110/176` en `useTableRowDrag.ts:133/215`: `computeHover` met `useCallback`
  stabiliseren; callbacks/refs volledig opnemen; gesturetests bewaken dat listeners tijdens een
  actieve sleep niet verloren gaan.
- `CalendarDialog.tsx:50`, `IFCPanel.tsx:64`, `useAutoSave.ts:96`, `useGanttZoom.ts:107`,
  `useSettingsBootstrap.ts:26`: de stabiele actie/ref/vertaalfunctie toevoegen.
- `ReportPanel.tsx:399/596`: één gememoiseerde `PrintOptions` bouwen en de twee zelfstandig gelezen
  velden aan de exportcallback toevoegen.
- `RelationsPanel.tsx:109`: `rowData` stabiliseren en opnemen.

**Expliciete synchronisatiesleutel in plaats van objectidentiteit**

- `SequenceLagInput.tsx:21`: synchroniseer op een primitieve lag-signatuur van de vier lagvelden;
  een wijziging van een ongerelateerd sequenceveld mag een half ingevoerde waarde niet wissen.
- `Select.tsx:107`: initialiseer highlight op de gesloten->open-overgang met de op dat moment
  actuele indices; wijzigende opties terwijl het menu openstaat resetten de cursor niet.
- `PoolImportDialog.tsx:74`: maak een open-sessie-id of gesloten->open-overgang leidend; een
  bedrijfsupdate tijdens een open dialoog mag de handmatige keuze niet overschrijven.
- `ScreenshotAnnotator.tsx:189`: houd canvasresizing en shapes-hertekenen als twee afzonderlijke
  effecten; `shapes` hoort alleen bij het tweede.
- `DebugTerminal.tsx:56`: bewaar de nieuwste entries in een ref en neem uitsluitend op de
  pauze-overgang een snapshot. `entries` toevoegen aan het effect zou de pauzestand kapotmaken.
- `useRecoveryRestore.ts:161`: maak de eenmalige opstartsemantiek expliciet met een vastgelegde
  vertaalcallback; een taalwissel mag herstel niet opnieuw starten.
- `UpdateDialog.tsx:89`: stabiliseer `runCheck`; één check per open-sessie.
- `CalendarDialog.tsx:50`: één lokale bufferinitialisatie per mount; actie als dependency is veilig
  omdat Zustand-acties stabiel zijn.

**Imperatieve invalidatie expliciet modelleren**

- `GanttCanvas.tsx:439` en `MiniMap.tsx:89`: de tekenfunctie leest themakleuren imperatief uit CSS.
  Vervang de schijn-dependency door een expliciete `renderRevision`/theme-revision parameter of een
  kleine, lokaal gedocumenteerde suppressie met een browsercheck op themawissel.
- `GanttCanvas.tsx:721`: leid `splitEnabled` af als primitive en laat de listener actuele splitstate
  uit de store lezen; geen complexe dependency-expressie.
- `useCanvasLayer.ts:59`: vervang de oncontroleerbare `...extraDeps` door een primitieve
  `renderRevision` die de caller zelf opbouwt.
- `ResourceOccupancyView.tsx:133`: vervang de `useMemo` met lege callback door een cache-ref met
  expliciete `{companyId, pool}`-sleutel.
- `ResourceOccupancyView.tsx:234`: vervang de reeks "alleen om te invalidaren"-dependencies door
  één afgeleide `openDocumentRevision`, of bouw de payloads vóór de memo uit de concrete
  subscriptions. `getOpenDocumentPayloads()` blijft niet als verborgen lezing achter.

**Langlopende listeners met actuele opties**

- `useSplitter.ts:47`: houd `opts` in een actuele ref; koppel windowlisteners alleen op
  `isResizing` en lees bij elk event de huidige callbacks en grenzen.
- `useRowDrag.ts`/`useTableRowDrag.ts`: als het volledig opnemen van `computeHover` listeners tijdens
  een gesture onnodig herkoppelt, gebruik dezelfde actuele-refvorm; geen suppressie zonder test.

**Tour- en resourceflows gericht modelleren**

- `TourOverlay.tsx:133/184/204`: het startsnapshot blijft een mountactie; `finish`, `goTo` en `step`
  worden stabiel. Kaartmeting gaat via `ResizeObserver` op `cardRef`, zodat taal- en inhoudswijziging
  wel meten maar een render zonder maatwijziging niet opnieuw setState doet.
- `ResourcePanel.tsx:222/270/308/330`: stabiliseer `openDraft` en `variantForView`; maak
  mount-/koppeling-reset en pending-new-consumptie afzonderlijke, benoemde hooks. Elke flow krijgt
  een componenttest zodat een dependencyfix geen gebruikerskeuze wist.

## 5. Storecontext en uitvoeringsisolatie

### 5.1 Eigenaarschap

Er komt één expliciet paar:

```ts
export type AppStore = UseBoundStore<StoreApi<AppState>>;

export interface AppStoreContext {
  store: AppStore;
  runtime: StoreRuntime;
}

export interface StoreRuntime {
  beginUndoable(state: AppState, opts?: { coalesceKey?: string }): void;
  pushUndoSnapshot(state: AppState, base?: AppState): void;
  resetUndoCoalescing(): void;
  isBatchActive(): boolean;
  enterBatch(): void;
  exitBatch(): void;
  enterMcpTransaction(): McpTransactionLease;
  recordMcpTimephasedLoss(lease: McpTransactionLease, taskId: string): void;
  countMcpTimephasedLoss(lease: McpTransactionLease): number;
  exitMcpTransaction(lease: McpTransactionLease): void;
}

export interface McpTransactionLease {
  readonly token: symbol;
}
```

`createAppStoreContext()` maakt eerst één `StoreRuntime`, injecteert die in de transactionele
slices en retourneert daarna store plus runtime. De app-singleton wordt:

```ts
export const appStoreContext = createAppStoreContext();
export const useAppStore = appStoreContext.store;
```

`createAppStore()` blijft als compatibiliteitsfactory bestaan en retourneert alleen `.store`.

De modulevariabelen `coalesce`, `undoSeq` en `batchDepth` verhuizen naar de closure van
`createStoreRuntime()`. MCP-exclusiviteit wordt daar niet als vrije boolean maar als één actieve
lease met unieke token en eigen timephased-lossset gemodelleerd. Enter weigert een tweede lease vóór
statemutatie; record/count/exit accepteren alleen het exact actieve leaseobject, en een verkeerde
exit mag de outer lease nooit vrijgeven. Daardoor delen ook twee onafhankelijke
`createMcpTransactions(B)`-factories dezelfde herintreedbaarheids- en suppressiegrens.
`finishMutation` en `markScheduleStale` blijven pure helpers.
Ook `selectionSlice.pasteTasks` krijgt de runtime geïnjecteerd. Het klembord blijft bewust
app-globaal voor kopiëren tussen documenten; de paste-mutatie en haar undo horen bij de gekozen
doelcontext.

### 5.2 Batchcontract

```ts
export interface BatchTransactions {
  withTransaction<T>(fn: () => T): T;
}

export function createBatchTransactions(context: AppStoreContext): BatchTransactions;
```

Het bestaande `withTransaction` blijft als dunne wrapper aan `appStoreContext` gekoppeld. Een throw
houdt bestaand productgedrag: gedeeltelijke mutaties blijven staan, gedekt door precies één
undo-stap. Alleen storelek en suppressielek verdwijnen.

### 5.3 MCP-contract

```ts
export interface McpTransactions {
  run<T>(fn: () => T):
    | { ok: true; value: T; timephasedGuidanceLost: number }
    | { ok: false; error: string };
  draft: McpDraft;
}

export function createMcpTransactions(context: AppStoreContext): McpTransactions;
```

De context-runtime bezit de actieve transactielease en de set met taken die tijdens die lease
timephased sturing verloren. De factory bezit alleen haar draftprimitieven en de uitvoeringsflow.
Iedere run betreedt de runtime vóór snapshot/statemutatie, propageert een geweigerde nested enter
zodat de outer call volledig terugrolt, en sluit in `finally` uitsluitend haar eigen lease.
Snapshot, rollback, eind-CPM, view/resource-recompute, melding en elk draftprimitief lezen
uitsluitend `context.store` en `context.runtime`.

`McpContext` krijgt daarom expliciet:

```ts
app: AppStoreContext;
transactions: McpTransactions;
```

Alle MCP-tools lezen en muteren via die context. `src/state/mcpTransaction.ts` blijft alleen een
compatibiliteitsadapter voor bestaande app- en testcallers. `buildMcpContext(app, transactions?)`
gebruikt singletontransacties alleen bij de singletonapp; bij een custom app zonder tweede argument
bouwt hij altijd `createMcpTransactions(app)`. De testharness levert één centrale contextfactory,
zodat een testliteral niet stil app B aan transacties A kan koppelen. Twee los gebouwde
`buildMcpContext(B)`-resultaten blijven veilig: hun factories verschillen, maar hun exclusieve lease
heeft dezelfde eigenaar B.runtime.

### 5.4 Eigendomsmatrix voor singletongebruik

Rechtstreeks singletongebruik wordt niet blind overal verboden.

- **Documentgebonden uitvoering:** store- en MCP-runtime, extensie-`data.*`, document-/filetools en
  achtergrondberekeningen moeten een context ontvangen.
- **React UI-grens:** atomische `useAppStore(selector)`-aanroepen zijn toegestaan; de gemounte app
  kiest immers bewust de app-singleton.
- **App-globale lifecycle:** actieve pluginregistry, eventbus, SDK-windowregistratie en
  bibliotheekpersistentie mogen globaal blijven. Extensie-ribbonbuttons, importers, PDF-fonts en
  appnotificaties krijgen een expliciete app-hostbinding; alleen `data.*` krijgt de documentcontext.
  Die hostbinding bevat de hoststore én een notificatiesink die in productie het bestaande
  `appLog.emit`-gedrag bewaart. De extensie-API leidt haar batch intern uit de documentcontext af;
  callers kunnen nooit een batch van een andere store injecteren.
- **Compatibiliteitsgrens:** dunne exports mogen de appcontext binden. Ze bevatten geen domeinlogica.

Een broncheck bewaakt dat core runtime-factories en storegebonden MCP-toolmodules geen
`useAppStore`/`appStoreContext` importeren.

### 5.5 Extensie-API: document en app-host zijn verschillende poorten

```ts
export interface ExtensionHostBinding {
  app: AppStoreContext;
  showNotification(
    extensionId: string,
    message: string,
    type: 'info' | 'warning' | 'error',
  ): void;
}

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
  assets: Record<string, Uint8Array> | undefined,
  document: AppStoreContext,
  host: ExtensionHostBinding,
): ExtensionApi;
```

De corefactory accepteert bewust geen `BatchTransactions`: zij maakt intern
`createBatchTransactions(document)`. Daardoor kan een caller document B niet combineren met de
batchruntime van A. `data.*` gebruikt document; importers, ribbonregistratie en cleanup gebruiken
`host.app`. Notificaties gaan naar `host.showNotification`, niet naar een fictief storeveld.

De productiehost wordt in `extensionLoader.ts` samengesteld en bewaart exact het huidige gedrag:
`warning` wordt `warn`, de andere levels blijven gelijk, en de boodschap gaat met source
`ext:${extensionId}` naar `appLog.emit`. De corefactory importeert de logbus of app-singleton niet;
tests kunnen een afzonderlijke hoststore en notificatiesink injecteren zonder productgedrag te
veranderen.

## 6. Extensiecontract en quarantaine

### 6.1 Geen TypeScript-cast als invoercontrole

Nieuwe pure module `src/extensions/validation.ts` levert getypeerde resultaten:

```ts
export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string };

export function parseExtensionManifest(
  input: unknown,
  mode: 'fresh' | 'stored-legacy',
): ParseResult<ExtensionManifest>;

export function parseCatalog(input: unknown): ParseResult<{
  catalog: ExtensionCatalog;
  issues: CatalogIssue[];
}>;

export function parseStoredExtension(
  input: unknown,
  storageKey: IDBValidKey,
): ParseResult<ReadyStoredExtension>;
```

Fresh ZIP-, JS- en catalogusdata is strikt. Bestaande opslag krijgt alleen veilige, expliciete
legacydefaults; identiteitsvelden worden nooit stil herschreven.

### 6.2 Veldbeleid

- `id`: verplicht, maximaal 128 tekens, patroon
  `^[a-z0-9](?:[a-z0-9._-]{0,127})$`; geen automatische lowercase of trim die identiteit wijzigt.
- `name`, `version`, `author`: verplichte niet-lege strings met respectievelijk maxima 160, 64 en
  160 tekens.
- `description`: string, maximaal 4.000 tekens.
- `category`: exact één bestaande `ExtensionCategory`.
- `main`: veilig relatief POSIX-pad, maximaal 512 tekens; geen absolute paden, backslashes,
  NUL, lege segmenten, `.` of `..`.
- `permissions`: array van unieke bekende permissies. Fresh onbekend = fout. Stored legacy onbekend
  = wegfilteren plus waarschuwing; ontbrekend legacyveld = `[]`.
- `apiVersion`: optionele numerieke puntversie; `minAppVersion`: numerieke puntversie, waarbij alleen
  stored legacy bij ontbreken `0.0.0` krijgt.
- `repository` en catalogus-`downloadUrl`: geldige `http:`- of `https:`-URL.
- `tags`: maximaal 32 unieke strings van maximaal 64 tekens.
- `icon`: string met een ruime maar eindige limiet van 128 KiB; bestaande SVG-sanitisatie blijft de
  rendergrens en wordt niet vervangen door manifestvalidatie.
- `assets`: record met veilige relatieve namen en echte `Uint8Array`-waarden; bestaande limieten van
  24 MiB per asset en 48 MiB totaal blijven gelden. Dubbele of padtraverserende ZIP-namen zijn fout.
- onbekende objectvelden worden niet doorgedragen; parsers bouwen een nieuw bekend object.

### 6.3 Ingangsbesluiten

- Een **aanwezig maar ongeldig** `@manifest` faalt. Alleen als de marker volledig ontbreekt wordt
  het bestaande gegenereerde manifest gebruikt.
- Een ongeldig catalogus-topobject faalt de hele fetch. Een ongeldige afzonderlijke entry wordt
  overgeslagen en als `CatalogIssue` zichtbaar gemaakt; geldige buren blijven bruikbaar.
- Een catalogusinstallatie accepteert de ZIP alleen als `manifest.id` én `manifest.version` exact
  overeenkomen met de catalogusentry. De oude `overrideId`-overschrijving verdwijnt uit het
  productiepad.
- Een lokaal ZIP-bestand ontleent zijn identiteit uitsluitend aan het geldige manifest.
- Normalisatie van legacy-opslag gebeurt in geheugen. Opstarten schrijft niet stil naar IndexedDB.
  De eerstvolgende expliciete enable/disable-actie mag het genormaliseerde record bewaren.
- Een mislukte status-write verandert de reeds gekozen runtimestatus niet; de gebruiker krijgt wel
  een concrete foutmelding.

### 6.4 Ready versus quarantaine

```ts
export type ExtensionRecord = ReadyExtension | QuarantinedExtension;

export interface ReadyExtension {
  kind: 'ready';
  id: string;
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  error?: string;
}

export interface QuarantinedExtension {
  kind: 'quarantined';
  quarantineId: string;
  storageKey: IDBValidKey;
  displayName: string;
  reason: string;
  status: 'quarantined';
}
```

De invoering gebeurt zonder rode typetussenstap: het bestaande `InstalledExtension` blijft eerst
ongewijzigd naast het strengere `ReadyExtension`. Pas wanneer alle vier constructiepaden in dezelfde
task `kind: 'ready'` leveren, schakelt de store om en verdwijnt het legacytype. `kind` wordt nooit
optioneel gemaakt.

De store houdt twee getypeerde collecties: `installedExtensions` voor ready records en
`quarantinedExtensions` voor quarantaine. Daardoor kan `enableExtension(id)` op typeniveau geen
quarantainerecord ontvangen. De UI voegt beide alleen voor presentatie samen.

`catalogIssues` en `quarantinedExtensions` worden expliciet als app-globaal geclassificeerd in
`documentContract.ts`. De compile-time top-level-statepoort blijft zo de beslissende bewaker dat
deze installatiestatus niet per ongeluk documentdata wordt of ongeclassificeerd blijft.

IndexedDB wordt per cursorrecord gelezen inclusief de echte `IDBValidKey`. Elke record krijgt een
eigen `try/catch`; één kapot record blokkeert latere geldige records niet. Quarantaine blijft
zichtbaar en verwijderbaar via de exacte opslagsleutel, maar heeft geen enableknop en voert nooit
code uit. `enableExtension` parseert een record opnieuw vlak vóór uitvoering; storage-corruptie na
startup faalt dus eveneens dicht.

Dit werk verhoogt robuustheid en data-integriteit. Het maakt same-realm JavaScript niet tot een
sandbox. De bestaande waarschuwing daarover blijft staan.

## 7. Gantt-decompositie langs bestaande naden

### 7.1 Wat uit `GanttCanvas` verhuist

Er komen drie coördinatoren en één rendererhost.

1. `useGanttRendererHost.ts` bezit primaire, secundaire en histogram-rendererlifecycle, canvasrefs
   en de enige `new GanttRenderer(...)`-callsite.
2. `useGanttViewportCoordinator.ts` bezit effectieve tijdas/origin, contentmaten, klemmen,
   horizontale en verticale scrollsync, splitpane-scroll, wheel, zoom, focus, fit en minimaproute.
3. `useGanttPointerCoordinator.ts` bezit de ene prioriteitsbeslissing voor gestures en levert de
   canvas-handlers/cursor terug.
4. `GanttCanvas.tsx` blijft de React-shell die storewaarden selecteert, de coördinatoren composeert
   en JSX rendert.

Plan 0 levert vóór deze extractie al dev-only, observer-only `paintCount`/`lastSize` voor primary,
secondary en histogram. De echte drawcallbacks verhogen die tellers; de driver kan zelf geen paint
starten. Lifecycletests wachten eerst op fonts en de bedoelde resize/thematrigger, daarna op twee
opeenvolgende quiet windows in plaats van slechts twee animation frames.

### 7.2 Wat juist niet verhuist

- `GanttRenderer` blijft eigenaar van tekenen, `barGeometry` en alle hit-tests. Tekenen en raken
  moeten dezelfde getallen blijven gebruiken.
- `ganttRenderOptions.ts` blijft de enige afleiding van renderopties.
- Pointerprioriteit blijft centraal. De feitelijke volgorde wordt vóór extractie in browsertests
  vastgelegd: actieve gestureguard, middelklik-pan, tabel/chart-splitter, headerguard,
  dependency-draw, Ctrl/Cmd-selectie, bar drag/resize, tabel-rowdrag, chart-pan en boxselect.
- Storeselecties worden niet in een gigantisch object gegroepeerd; de huidige atomische selectors
  voorkomen onnodige renders.

### 7.3 Stopcriteria

Plan 3 stopt pas als alle volgende uitspraken met bronchecks en browsertests kloppen:

- buiten `useGanttRendererHost.ts` staat geen `new GanttRenderer` in React-code;
- één viewportcoördinator bezit bounds en scrollsync;
- één pointercoördinator bezit de gestureprioriteit;
- renderopties worden nergens dubbel afgeleid;
- elke geëxtraheerde naad heeft minstens één echte browsercase;
- een themawissel, resize en documentwissel veroorzaken geen renderlus of resize-oscillatie;
- drag + undo, splitview, histogram/picker, splitter, wheel/pan/zoom/focus/fit en pointerprioriteit
  zijn in de echte UI bewezen;
- `GanttRenderer` behoudt teken- en hit-testgeometrie samen.

## 8. Bewuste bevriezing van `TableEditor`

`TableEditor.tsx` is groot, maar wordt in dit programma niet structureel opgesplitst. De reden is
niet dat 922 regels wenselijk zijn. De reden is dat de DOM-tabel en canvas-taaktabel nu twee
verschillende producten zijn, terwijl de gewenste eindrichting juist één samenhangend model voor
navigatie, kolommen en interactie vraagt. Alleen één component nu opdelen zou die productkeuze
vastzetten zonder hem te beantwoorden.

Tijdens dit programma gelden daarom vier regels:

1. karakteriseer vóór Ganttwerk beide tabeloppervlakken met browsertests;
2. in `TableEditor` zijn alleen bugfixes en kleine, lokaal aantoonbare extracties toegestaan;
3. voeg geen nieuwe structurele verantwoordelijkheid aan `TableEditor` toe;
4. hef de freeze pas op in de bredere tabelrevisie die beide oppervlakken, relaties en resources
   gezamenlijk ontwerpt.

De vaste takentabel naast de Gantt blijft rendererwerk; dit programma maakt daar geen half-DOM-model
van.

## 9. Wat bewust blijft zoals het is

### Scheduler en kalenderengine

De solver en kalenderengine hebben gerichte headless batterijen en zijn niet de bron van de vier
risico's. Ze verhuizen niet naar React-hooks en krijgen geen nieuwe reactive lifecycle.

### Handmatige CPM-semantiek

`runCPM` blijft expliciet. Automatisch op elke edit rekenen zou productgedrag, performance en undo
veranderen; dat is geen onderhoudsrefactor.

### IFC als native documentcontract

IFC-reader/writer, `DOCUMENT_FIELDS`, capture/hydrate en recovery blijven de bron van waarheid.
Geen JSON-zijformaat en geen alternatieve save-route.

### Snapshot-undo

Snapshots blijven het undo-model. Alleen uitvoeringsmetadata verhuist van module-global naar
per-store runtime. Een command/event-sourcing-herschrijving zou een veel groter programma zijn
zonder relatie tot de gevonden storelekken.

### Atomische Zustand-selectors

De circa zestig selectors in `GanttCanvas` zijn veel, maar een groot selectorobject zou elke
onverwante wijziging laten herrenderen. De refactor groepeert gedrag, niet automatisch alle reads.

### Dunne Rust-backend en fileAccess-dispatch

Bestands-I/O blijft via `src/services/fileAccess/`; er komt geen nieuwe Rust-commandolaag.

### App-globale registries

Plugininstances, eventbus, SDK-registratie en bedrijfsbibliotheek mogen app-global blijven. Alleen
documentmutaties krijgen een expliciete storecontext. Een volledige multi-window-productarchitectuur
is geen voorwaarde voor correcte store-isolatie.

### Extensiesandbox

Runtimevalidatie voorkomt corrupte vormen en onbedoelde activatie, maar same-realm extensiecode
blijft vertrouwde code na expliciete toestemming. Worker-/iframe-isolatie is een apart security- en
compatibiliteitsproject.

## 10. Documentatie, i18n en gebruikersbewijs

- Nieuwe quarantine- en catalogusmeldingen lopen via `t(...)` in alle veertien locales.
- `docs/extensions.md` en ten minste `public/docs/nl/ref-extensies.md` en
  `public/docs/en/ref-extensies.md` leggen quarantaine en de niet-sandboxgrens uit.
- Browsertests gebruiken echte interacties en inspecteren daarna state. Screenshots/traces zijn
  foutartefacten, geen bewijs op zichzelf.
- Geen plan raakt `docs/CHANGELOG.md`; dat is uitsluitend een releaseartefact.

## 11. Rollbackstrategie

Elk plan is opgebouwd uit kleine, reviewbare commits met vóór elke extractie een rode of
karakteriserende test.

Omdat de actuele startworktree al een niet-gerelateerde wijziging in `tests/planning/run.sh` bevat,
wordt dat bestand hunkgewijs gestaged. Iedere commit krijgt een cached naam-, whitespace- en
overlapcontrole; de bestaande dependency-presentationhunk hoort nooit in dit programma.

- Plan 0 kan als geheel worden teruggedraaid zonder productdata te raken.
- Extensieparsers wijzigen geen IndexedDB-schema. Een rollback kan dus dezelfde records blijven
  lezen; quarantaine introduceert geen migratie die data overschrijft.
- Storecompatibiliteitswrappers houden bestaande imports werkend. Een migratiestap kan per
  modulegroep worden teruggedraaid zolang de boundarytest en twee-store-suite bij die commit passen.
- Ganttextracties wijzigen geen opgeslagen documentvorm. Iedere naad heeft een eigen commit en kan
  afzonderlijk terug zonder dat een bestandsmigratie nodig is.

## 12. Programma-eindcriteria

Het programma is pas afgerond wanneer:

1. `npm run verify` exit 0 geeft inclusief de vijfde browsersuite;
2. alle drie de Linux-gates Chromium provisioneren en foutartefacten bewaren;
3. hooklint beide regels als error afdwingt en alleen gemotiveerde, gebruikte lokale suppressies
   over zijn;
4. twee storecontexten interleaved batch-, coalesce- en MCP-cases zonder kruisbesmetting doorstaan;
5. elk extensie-ingangspunt runtimegevalideerd is en corrupte opslag per record in quarantaine
   belandt;
6. de Gantt-stopcriteria uit §7.3 bewezen zijn;
7. de TableEditor-freeze niet geschonden is;
8. de finale hyperkritische review een GO geeft zonder open hoog-risicobevinding.
