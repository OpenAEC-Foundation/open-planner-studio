# Gebouwmodel behouden in IFC en IFCX — ontwerp

Status: ontwerp, versie 2 (7 november 2026, na council-ronde 1). Wordt in dezelfde sessie gebouwd.
Issue #804 (IFCX naast IFC4X3). Raakt #748 (lokale 4D-workflow). Vervangt de weigering van PR #547
(commit `5b2812f94`, 2026-10-23; de vroegere knownbug 110).

## 1. Waarom en wat

Een planner krijgt vaak één IFC-bestand met het gebouwmodel van de architect of de constructeur. Hij wil daarin
de planning maken of bijwerken en het bestand terugsturen. Nu kan dat niet:

- `readIFC` weigert elk bestand met een `IfcProduct` of `IfcTypeProduct` (`src/services/ifc/ifcReader.ts:178-185`).
- `writeIFC` schrijft het hele bestand opnieuw uit het eigen planningsmodel (`ifcWriter.ts:317` e.v.). Alles wat
  geen planning is, verdwijnt. Dat geldt nu ook voor planningsbestanden zonder model: vreemde psets of gegevens
  van andere programma's zijn na opslaan weg.
- IFCX (het JSON-formaat voor IFC5) kent de app niet.

Opdracht (Ethan, 7 november 2026): de app werkt met gebouwmodellen en gooit geen gebouwdelen weg, in het huidige
IFC-formaat en in IFCX. IFCX wordt in deze sessie volledig ingebouwd: alles uit de checklist van #804.

**Doel**

1. Een IFC4/IFC4X3-bestand openen, de planning bewerken en opslaan. Alles wat geen planning is, komt **byte-gelijk**
   terug: het model, de geometrie, gegevens van andere programma's.
2. Hetzelfde voor een `.ifcx`-bestand.
3. Een planning als `.ifcx` opslaan en weer openen, zonder verlies van vastgelegde planningsgegevens.
4. Bestaande koppelingen taak↔bouwdeel blijven bestaan en zijn zichtbaar (alleen lezen).

**Buiten dit ontwerp**

- Het model tonen of koppelingen bewerken (viewer, selectie, tijdschuif): #748.
- Een gebouwmodel omzetten tussen STEP en IFCX.
- IFC2X3-bestanden met een model (§4.10). Dat is een echte beperking: veel modellen uit Revit en ArchiCAD in
  Nederland zijn nog IFC2X3.
- Datalagen van een IFCX-bestand oplossen die via `imports` uit andere bestanden komen (§6.4).

## 2. Wat we leerden uit het ecosysteem

Bron: shallow clones van 7 november 2026.

| Project | Wat het doet | Les voor ons |
|---|---|---|
| **IFCCAD** (`ifccad`) | Alleen IFCX + CBOR. Bewaart de bronbytes. Een projectie mag nooit als verliesvrije bron worden gepresenteerd (`docs/experiments/ifccad-document-lifecycle.md:23-30`). Bewerken binnen een groter IFCX-document is uitgesteld. `header.dataVersion` hoort bij de dataset (`schemas/ifccad/experimental-contract-0.6.0.md:35`). | Bewaar de bron, bewerk alleen het eigen deel, zeg eerlijk wat niet behouden blijft. Raak de kop van een ander niet aan. |
| **IFC5-development** (buildingSMART, `1a63082`, 2026-09-08) | `ifcxVersion: "ifcx_alpha"`. Kop `id/ifcxVersion/dataVersion/author/timestamp`. `imports` laadt andere bestanden als lagen, ook met data (`layer-stack.ts:88-111`). Bij gelijke paden wint de latere bijdrage, per attribuutsleutel (`compose.ts`). Paden worden op `/` geknipt (`path.ts:2-11`). **Geen schema of voorbeeld voor taken, relaties, kalenders of resources.** | Planning in een eigen namespace. Paden zonder voorloop-`/`. Volgorde van entries is betekenis. |
| **ifcx-explorer** | Planning als eigen laag: `openaec::activity` (`start`, `endExclusive`, `predecessor`) en `openaec::links` (`relation: "schedules"`, `target`). Weigert stille botsingen tussen lagen (`OWNERSHIP_CONFLICT`, `graph.rs:40-44`). | Er is een ecosysteem-vorm voor "taak plant element". Wij schrijven nooit op paden van een ander. |
| **Open-Calculations-Studio** | Namespace `ocss::`: afkorting van het programma, dan het onderwerp (zus `oses::`). Schema's compleet in elk bestand. UUID v5 en IFC-GlobalId zijn dezelfde 128 bits (`identiteit.ts:4-9`). | Namespace `ops::`, schema's in het bestand, één identiteit voor STEP en IFCX. |
| **open-bim-studio** | `ifcx_alpha`, `dataVersion 1.0.0`, imports ifc@v5a/prop@v5a/usd@v1, namespace `openbim::`, stabiele UUID v5-paden. | Bevestigt de gangbare kop en imports. |
| **ifcx-rs**, **wfc5** | Rust-kern zonder behoud van onbekende sleutels (vermoed); wfc5 is een eigen formaat. | Niet gebruiken. |

## 3. Het principe: één route, knippen in plaats van herschrijven

Er is **één** lees- en schrijfroute voor elk IFC-bestand, met of zonder model:

- De app leest de bron als **bytes** en deelt elke entiteit in (§4.2).
- Bij opslaan schrijft hij de **vreemde** stukken byte-gelijk terug, op hun plek en met hun eigen `#id`, en schrijft
  hij de **eigen** planning opnieuw.
- Het **vreemde deel** is elk stuk in klasse C, A of V (§4.2). Een eigen planningsbestand heeft geen vreemd deel.
  Dan gebruikt de app de huidige writer, ongewijzigd, ook de kop. §4.1–4.5 en §4.11 gelden alleen met een vreemd deel.
- Eén regel vervangt een aparte "modelmodus": de app schrijft een eigen `IfcProject`, units en geometrische context
  **alleen als de bron die niet al als vreemde context heeft** (§4.2, klasse C).

Daarmee vervalt ook het huidige stille verlies van vreemde gegevens in planningsbestanden.

Waarom niet de alternatieven:

- *Volledig IFC-objectmodel* (web-ifc, IfcOpenShell-WASM): groot, traag, en het herschrijft ook vreemde regels.
  Dan is "ongewijzigd" niet te bewijzen.
- *Model in een los bestand en extern samenvoegen* (ifcpatch `MergeProjects`): de huidige werkwijze. Dan werkt de app
  niet met gebouwmodellen.

## 4. IFC (STEP)

### 4.1 Wat een stuk is

Een **stuk** is een entiteit-instantie van `#` tot en met de `;` die haar afsluit, plus alle tekst ervóór sinds het
vorige stuk: witruimte, regeleinden (ook CRLF) en commentaar. De kop (`HEADER; … ENDSEC;`), `DATA;` en de staart
(`ENDSEC; END-ISO-10303-21;`) zijn aparte stukken. Zo valt elk byte van de bron in precies één stuk.

Met een vreemd deel blijft de kop **helemaal** byte-gelijk, ook `FILE_NAME` en `FILE_SCHEMA`. Zonder vreemd deel
schrijft de writer de kop zoals nu.

### 4.2 Indeling in klassen

De scanner deelt elk stuk in één klasse in. De regels gaan in deze volgorde; de eerste regel die past, beslist.

| Klasse | Wat | Bij opslaan |
|---|---|---|
| **P — planning** | De wortels `IfcWorkPlan`, `IfcWorkSchedule`, `IfcTask`, `IfcWorkCalendar` en de resourcetypen die de lezer leest (`IFC_TO_RESOURCE_TYPE`); plus hun **afsluiting**: een gesloten lijst van typen die alleen via een P-entiteit bereikt worden (`IfcTaskTime`, `IfcLagTime`, `IfcWorkTime`, `IfcRecurrencePattern`, `IfcTimePeriod`, `IfcRelSequence` tussen taken, `IfcRelNests`/`IfcRelAssignsToControl`/`IfcRelAssignsToProcess` waarvan **alle** leden P zijn, `IfcRelDefinesByProperties` + `IfcPropertySet` + properties met een naam die met `OPS_` begint, en de `OPS_`-templates via `IfcRelDeclares`). | Opnieuw geschreven door de writer (§4.4). |
| **C — context** | Entiteiten waar P naar verwijst en waar ook vreemde stukken naar verwijzen: `IfcProject`, `IfcOwnerHistory` met persoon/organisatie/applicatie, units, geometrische contexten. | Byte-gelijk. De lezer leest ze wel (alleen lezen). |
| **A — aanhangsel** | Een vreemd stuk dat naar minstens één P-entiteit verwijst: een pset van een ander programma op een taak, een `IfcRelAssignsToProduct`, een `IfcRelDeclares` van het project naar het werkplan (IfcOpenShell), een rel met gemengde leden (taken én wanden). | Byte-gelijk, tenzij een P-entiteit waar het naar wijst is verwijderd (§4.5). |
| **V — vreemd** | Al het andere: het model, geometrie, psets op wanden, complexe instanties `#n=(A(..)B(..));`. | Byte-gelijk. |

Belangrijk:

- P is op type **en** verwijzing. `IfcRelDefinesByProperties`, `IfcRelNests` en `IfcRelAssignsToControl` komen ook in
  modellen voor; die zijn V als hun leden V zijn.
- Een pset zonder `OPS_`-naam op een taak is **A**, ook als de lezer hem zou kunnen lezen. De app schrijft alleen
  `OPS_*`-psets (nagelopen in `ifcWriter.ts`/`ifcPsets.ts`), dus hij overschrijft nooit de pset van een ander.
- De scanner leest daarvoor van psets ook het argument `Name`. Verder decodeert hij geen strings.
- Een eigen planningsbestand van de app heeft geen A en geen V, en `IfcProject` is daar P (niets vreemds verwijst ernaar).
- De indeling is een pure functie van de bron. Ze draait vóór de lezer en hangt niet van de lezer af.

### 4.3 Identiteit: bestaande ids blijven staan

Een P-entiteit die al in de bron stond, houdt bij opslaan haar `#id` als ze nog bestaat. Nieuwe P-entiteiten krijgen
ids vanaf `max(alle ids in de bron) + 1`. De koppeling loopt via de GlobalId (die blijft stabiel via `ifcGlobalIds`)
of, voor entiteiten zonder GlobalId, via de sleutel die de writer al gebruikt (`addLine(ctx, key, …)`).

Gevolg: aanhangsels die naar een nog bestaande taak wijzen, blijven **byte-gelijk**. Er is geen omzetting van
verwijzingen nodig. Alleen verwijderde P-entiteiten raken vreemde stukken (§4.5).

### 4.4 Planning van een ander programma (Bonsai, Synchro)

Een taak uit Bonsai of Synchro is P, maar kan attributen hebben die de writer niet vult (`IfcTask.LongDescription`
en `WorkMethod` schrijft de writer nu altijd als `$`, `ifcTaskSlots.ts:338`).

- **Ongewijzigd object** (domeinobject gelijk aan wat de lezer las): de app schrijft het bronstuk byte-gelijk terug,
  met zijn afsluiting.
- **Gewijzigd object**: de writer schrijft het stuk opnieuw, maar neemt voor elke positie die hij niet zelf beheert de
  waarde uit het bronstuk over (slot-samenvoeging op basis van `IFC_TASK_SLOTS`/`IFC_TASKTIME_SLOTS`).
- Meerdere `IfcWorkSchedule`'s: de lezer gebruikt nu het eerste live-schema (`ifcReader.ts:445`). Werkschema's met
  taken die de app niet als planning overneemt, worden **V** met al hun taken. De melding noemt ze.

### 4.5 Een P-entiteit is verwijderd

Wijst een A-stuk naar een verwijderde P-entiteit, dan:

- staat de verwijzing in een lijst (zoals `RelatedObjects`): de app haalt alleen dat lid uit de lijst. Blijft de
  lijst leeg terwijl hij verplicht is, dan vervalt het hele stuk;
- is het een enkele verplichte verwijzing (zoals `RelatingProcess`): het stuk vervalt;
- wijst een ander vreemd stuk naar een vervallen stuk: dat stuk blijft staan (een losse pset is geldig IFC).

Elk gewijzigd of vervallen vreemd stuk staat in een **wijzigingslijst** (id, oud, nieuw). Na opslaan meldt de app:
"3 gegevens van andere programma's hingen aan verwijderde taken. Ze zijn aangepast of verwijderd." Dit gaat via het
meldingenkanaal.

### 4.6 Koppelingen taak↔bouwdeel

Koppelingen (`IfcRelAssignsToProcess` met producten, `IfcRelAssignsToProduct`) zijn **A**. Ze blijven dus vreemd en
byte-gelijk; de app maakt er geen eigen kopie van.

- De lezer leidt er een alleen-lezen weergave uit af: `elementLinks: { direction: 'input' | 'output', ref }[]` per taak
  (bij Bonsai: `ToProcess` = input, `ToProduct` = output). `ref` is een GlobalId (STEP) of pad (IFCX).
- Dat is geen domeinveld en geen documentveld. Het hoort bij de bron (§4.7).
- Taakpaneel: "Gekoppeld aan 12 bouwdelen" (alleen lezen). MCP: veld in `planner_get_task`.
- De lezer gooit producten in `IfcRelAssignsToProcess` nu stil weg (`ifcReader.ts:3487-3490`). Een gemengde rel
  (resources + producten in één rel) is A; de lezer leest de resource-toewijzingen eruit. Bij opslaan haalt de app
  de resource-leden uit dat stuk (wijzigingslijst) en schrijft ze in een eigen rel.

### 4.7 Waar de bron in de app woont

- Nieuw documentveld `ifcSource` met rol `snapshot: 'none'`, zoals `xerSourceArchive` (`documentContract.ts:298`).
  Onveranderlijk na openen.
- Inhoud: de bronbytes (`Uint8Array`), sha256, schema, de stukkenindex (begin/eind per stuk in een `Uint32Array`),
  de klasse per stuk, de A-verwijzingen, het totaal aantal vreemde objecten voor de melding, en de afgeleide
  `elementLinks`.
- Alleen de P- en C-stukken worden gedecodeerd (STEP-strings, UTF-8) en gaan door de bestaande lezer. V- en A-stukken
  blijven bytes.
- Geen bron (nieuw project, import uit CSV/MSPDI/XER): `ifcSource = null`, de huidige route.

### 4.8 Lezen

1. **Openen als bytes.** De open-routes lezen nu tekst: `readTextFile` (`tauriBackend.ts:22`), `file.text()`
   (`webBackend.ts:124`), `siteBackend.ts:43`. Voor IFC wordt dat `readFile`/`arrayBuffer()`. Daarmee blijven
   Latin-1-bytes, ongeldige UTF-8 en een BOM behouden. De grootte wordt vóór het lezen gecontroleerd (§4.12).
2. **Scanner** op `Uint8Array` (alle STEP-syntaxis is ASCII). Eén doorloop: stukgrenzen, `#id`, type (of "complex"),
   de `#`-verwijzingen, en `Name` van psets. Strings worden overgeslagen, niet gedecodeerd. De scanner is een pure
   synchrone functie. In de browser en Tauri draait hij in een Web Worker met overgedragen bytes; in crashherstel,
   de headless core en de headless MCP-server (Node) synchroon, zoals `recoverySnapshotSerializer.ts:27` al een
   terugval zonder Worker heeft.
3. **Indeling** (§4.2).
4. **Lezer**: alleen P- en C-stukken gedecodeerd door de bestaande `parseSTEP` en de bestaande lezer.
   Project-gegevens in een bestand met vreemde context (§4.9).

### 4.9 Projectgegevens

De lezer haalt projectnaam, project-id en auteur/bedrijf nu uit `IFCPROJECT` en de eerste `IFCOWNERHISTORY`
(`ifcReader.ts:1377-1423`). Het project-id is ook het zout voor de hulp-GlobalIds (`ifcWriter.ts:343`).

- De lezer leest `IfcProject` als C (alleen lezen). Het project-id blijft dus `proj-ifc-<GlobalId>`: stabiel.
- Is `IfcProject` C, dan bewaart de app eigen projectnaam, beschrijving, auteur en bedrijf in `OPS_ProjectSettings`
  (pset op het werkplan). De lezer leest daar eerst, en valt terug op `IfcProject` en de owner history.
- Zo blijft het `IfcProject` van de architect byte-gelijk, ook als de planner de projectnaam wijzigt.
- Eenheden: de writer schrijft bedragen als `IFCMONETARYMEASURE` en tijden als `IfcDuration`. Hij voegt geen units toe
  aan de `IfcUnitAssignment` van het model. Te bevestigen in fase 0: leest de lezer iets uit de units?

### 4.10 Schema

- Het schema komt uit de kop van de bron en verandert niet (de kop blijft byte-gelijk). De keuze in
  *Projectinstellingen* staat uit zolang er een vreemd deel is, met de reden erbij. De schemavraag bij opslaan vervalt.
- Kopnamen: `IFC4`, `IFC4X3`, `IFC4X3_ADD1`, `IFC4X3_ADD2`, `IFC4X3_TC1` worden herkend (nu geeft `readFileSchema`
  `undefined` voor `ADD1`/`TC1`, `ifcReader.ts:1105-1107`). Voor de planning-entiteiten zijn ze gelijk.
- **IFC2X3 met vreemd deel**: geweigerd. `IfcTask` en `IfcWorkCalendar` zijn in IFC2X3 anders; een mengsel is ongeldig.
  De melding raadt aan het model eerst naar IFC4 om te zetten. Een onbekend schema: ook geweigerd.

### 4.11 Schrijven en de verliesbewaking

De writer schrijft: alle stukken in bronvolgorde (V, A en C byte-gelijk, A eventueel volgens de wijzigingslijst;
P-stukken van ongewijzigde objecten byte-gelijk) → nieuwe en gewijzigde P-stukken vóór de staart → staart. Het
regeleinde volgt de bron. Het resultaat is een lijst van `Uint8Array`-delen, geen grote string; opslaan schrijft de
delen achter elkaar (Blob, stream of `writeFile` met de delen).

Vóór het wegschrijven, twee controles die elkaar niet nodig hebben:

1. **Bytes**: de uitvoer, zonder de P-stukken, is gelijk aan de bron zonder de P-stukken, op de wijzigingslijst na.
   Dit vergelijkt bytes van de stukken die de schrijver uit de bron kopieerde met de bron zelf, per stuk via sha256.
2. **Opnieuw lezen**: de uitvoer gaat door de volledige leesroute (scanner, indeling, lezer). De planning moet gelijk
   zijn aan het geheugen (dezelfde vergelijking als `documentDataChanged`), elke `#`-verwijzing moet bestaan, en er
   mogen geen dubbele ids of GlobalIds zijn.

Faalt een controle, dan schrijft de app niets. De melding biedt een uitweg: *Exporteren zonder gebouwmodel*.
Een derde, onafhankelijke controle draait alleen in CI: IfcOpenShell vergelijkt invoer en uitvoer (§10).

### 4.12 Grootte en geheugen

- Bronbytes worden één keer bewaard. Een string per vreemd stuk bestaat niet. Naar de Worker gaan de bytes als
  overgedragen buffer.
- Piek bij opslaan: bron + uitvoerdelen (verwijzingen naar de bron via `subarray`, geen kopie) + de P-stukken.
- De Tauri-app draait op WebKit (JavaScriptCore) op Linux en macOS en op WebView2 (V8) op Windows; de browserbuild op
  V8. De grens hangt dus niet van één stringlimiet af.
- Voorlopige grens: 150 MB, gecontroleerd vóór het volledig lezen. De echte grens volgt uit de meting in fase 0
  (`measure:large-plans` uitbreiden met modellen van 50, 150 en 300 MB: open, opslaan, piekgeheugen, blokkering van de UI,
  op Linux-WebKit en in Chromium).

### 4.13 Elke schrijver en elke afnemer

| Route | Waar | Gedrag met een vreemd deel |
|---|---|---|
| Opslaan, Opslaan als (IFC) | `fileSlice.ts` | Volledig bestand (§4.11). |
| Exporteren → IFC zonder gebouwmodel | `fileSlice.ts`, nieuw | Alleen P (de huidige uitvoer). Vraag vooraf die dat zegt. |
| Opslaan als ander formaat (IFCX, CSV, MSPDI, XER) | `fileSlice.ts` | Alleen planning, met dezelfde vraag. Het model gaat niet mee. |
| Echte AutoSave naar het bestand (`autoSaveToFile`) | `useAutoSave.ts:148` | Volledig bestand. De samenvoeging draait in de Worker die de bron al heeft; de hoofdthread geeft alleen de planning door. Langere wachttijd met een vreemd deel (voorstel 60 s, te meten). |
| Crashherstel (auto-save, 10 s) | `recoverySnapshotInput.ts` | Alleen P + verwijzing naar de bron (sha256), zoals het XER-archief (`'recovery-reference'`). De bron één keer per sha256 in de herstelopslag (§4.14). |
| MCP-backup | `backupService.ts:312` | Zelfde vorm als herstel: P + verwijzing; de bron één keer per sha256 in de backupmap. Herstel van een backup voegt ze samen. |
| MCP `planner_export_ifc` / bestandstools | `mcp/tools/fileTools.ts` | Volledig bestand, zelfde controles. |
| IFC-werkruimte (paneel) | `IFCPanel.tsx:39-58` | Toont alleen de P-stukken, alleen lezen, met de melding dat het model buiten het paneel blijft. *Toepassen* staat uit met een vreemd deel (nu zou `applyLoadedProject`/`payloadFromImport` het model stil laten vallen, `fileSlice.ts:898`). |
| Headless core (`src/core/`) | `core/index.ts` | `open` en `toIfc()` via dezelfde route. De samenvatting krijgt `foreignContent: { format, schema, objectCount } \| null`. Contractwijziging in `api.ts`. |
| Headless MCP-server | `headless/mcp-server/` | Zelfde route, synchrone scanner. |
| Site-opslag (`window.openaecHost`) | `siteBackend.ts` | Volledig bestand, als bytes. |
| Resourcebibliotheek | `libraryIfc.ts` | Ongewijzigd (heeft nooit een vreemd deel). |
| Benchmark, dev-bridge | `benchmark/runner.ts`, `devBridge.ts` | Ongewijzigd. |

### 4.14 Herstel en een ontbrekend model

- Herstel zet nu ook het bestandspad en het site-doel terug (`useRecoveryRestore.ts:90`). Zonder bron zou Ctrl+S het
  modelbestand overschrijven met alleen planning.
- Daarom: bij herstel zoekt de app de bron in de herstelopslag op sha256. Ontbreekt die, dan leest hij het
  oorspronkelijke bestand opnieuw en controleert de sha256.
- Klopt geen van beide, dan krijgt het document de toestand **bron ontbreekt**. Opslaan, AutoSave naar het bestand en
  MCP-export naar het oorspronkelijke doel zijn dan geblokkeerd. Alleen *Opslaan als* naar een nieuw bestand kan, met
  een duidelijke tekst dat het model er niet in zit.
- Harde voorwaarden: de bron staat in de herstelopslag vóór het manifest dat ernaar verwijst; opruimen verwijdert een
  bron pas als geen manifest er nog naar wijst; elke lezing controleert de sha256. Dezelfde volgorde als het XER-archief
  (`docs/xer-recovery-guardrails.md`).

### 4.15 Wat de planner ziet

- Na openen, in de statusbalk: "Dit bestand bevat ook een gebouwmodel en gegevens van andere programma's
  (12.345 objecten). Bij opslaan blijven die ongewijzigd."
- Na opslaan, alleen als de wijzigingslijst niet leeg is: de melding uit §4.5.
- Werkschema's die de app niet overneemt: een melding bij openen (§4.4).
- Handleiding: `howto-ifc-schema-kiezen` ("Voeg samen als laatste stap") en `docs/ifc-round-trip.md` herschrijven.
  Nieuwe how-to: "Een planning maken in een IFC-bestand met gebouwmodel".

## 5. IFCX: planning lezen en schrijven

### 5.1 Kop, versie en imports

- **Eigen bestand**: `ifcxVersion: "ifcx_alpha"`, `dataVersion: "1.0.0"` (de versie van deze dataset, zoals IFC5 het
  bedoelt), `id: "urn:openaec:planner:<project-uuid>"`, `author`, `timestamp` (ISO 8601).
- **Bestand van een ander**: de kop blijft zoals hij is. Alleen `timestamp` wordt bijgewerkt.
- `ifcxVersion` anders dan `ifcx_alpha`: openen geweigerd, met de gevonden waarde in de melding.
- **Versie van het OPS-profiel**: alleen `ops::document.formatVersion` op de planwortel. Een hogere hoofdversie dan de
  app kent: openen geweigerd ("gemaakt met een nieuwere versie van Open Planner Studio"). `dataVersion` speelt daarbij
  geen rol.
- `imports` en `schemas` van de bron blijven staan, in hun volgorde. De app voegt `ifc@v5a` toe als die ontbreekt
  (voor `bsi::ifc::class`) en voegt haar eigen `ops::`-schema's toe of vervangt ze. Lezen heeft geen netwerk nodig.

### 5.2 Namespace, paden en indeling

Namespace `ops::` (open besluit 1). Paden zijn kale UUID's zonder voorloop-`/` (de composer van buildingSMART knipt op
`/`). De UUID is dezelfde 128 bits als de IFC-GlobalId van hetzelfde object, dus een taak heeft in STEP en IFCX dezelfde
identiteit. Elke eigen node krijgt ook `bsi::ifc::class` met de IFC 4.3-klasse.

| Planningsgegeven | Node | Attributen |
|---|---|---|
| Werkplan | `<plan-uuid>` | `bsi::ifc::class: IfcWorkPlan`, `ops::document` (`formatVersion`), `ops::project` |
| Taak | `<taak-uuid>` | `bsi::ifc::class: IfcTask`, `ops::task` |
| Relatie | `<rel-uuid>` | `bsi::ifc::class: IfcRelSequence`, `ops::relation` |
| Kalender | `<kal-uuid>` | `bsi::ifc::class: IfcWorkCalendar`, `ops::calendar` |
| Resource | `<res-uuid>` | `bsi::ifc::class` (resource-subtype), `ops::resource` |
| Toewijzing, baseline, codes, overige projectdata | onder taak of plan | `ops::assignment`, `ops::baseline`, … |

- WBS via `children` van plan en samenvattingstaken; alleen naar eigen paden.
- De velden komen uit `DOCUMENT_FIELDS` (`src/state/documentContract.ts`). Een test eist dat elk veld dat in IFC4X3
  round-tript, ook in IFCX round-tript. Zo loopt IFCX nooit stil achter.
- De `ops::`-schema's worden uit de TypeScript-typen gegenereerd, met volledige `objectRestrictions` (diepte: elk veld
  met type), zodat de validator van IFC5-development de uitvoer kan controleren.

### 5.3 Afgeleide kopie voor het ecosysteem

De app schrijft per taak ook `openaec::activity` (`start`, `endExclusive`, `predecessor`) zodat ifcx-explorer de
planning toont (open besluit 2). Het is een afgeleide kopie: de app leest hem nooit terug als er `ops::task` is. Een
bestand met alleen `openaec::activity` opent als eenvoudige planning (naam, start, einde, voorganger).

## 6. IFCX: alles wat geen planning is, behouden

### 6.1 Entries als bytes

Net als bij STEP knipt de app de `data`-entries uit de bron als bytes:

- Een JSON-tokenizer op bytes vindt de grenzen van elke entry in `data`.
- Alleen entries waarin `"ops::` voorkomt, worden geparsed. Dat parsen houdt getallen als tekst vast (geen verlies bij
  `9007199254740993`).
- Alle andere entries blijven bytes en komen byte-gelijk terug. Ook `header`, `imports` en `schemas` blijven bytes,
  behalve de wijzigingen uit §5.1.

### 6.2 Eigendom per attribuut, volgorde behouden

- Eigen zijn alleen: `ops::*`-attributen, `bsi::ifc::class` en `openaec::activity` op eigen paden, en `children` van eigen
  paden naar eigen paden.
- Een entry met `ops::` én vreemde bijdragen (vreemde attributen, `children`, `inherits`) wordt gesplitst: de vreemde
  rest blijft als eigen entry **op dezelfde plek** staan, de eigen bijdragen gaan naar de eigen entry.
- Bestaande eigen entries worden op hun plek opnieuw geschreven. Nieuwe eigen entries komen achteraan. Zo verandert de
  compositie van vreemde bijdragen niet (anders kan een latere `children.sub = null` zijn werking verliezen).
- De app schrijft nooit een attribuut op een vreemd pad.
- Aanhangsels bestaan ook hier: een vreemde bijdrage op het pad van een verwijderde taak vervalt, met melding.

### 6.3 Controles

Zoals §4.11: (1) de vreemde bytes gelijk aan de bron op de wijzigingslijst na; (2) opnieuw lezen geeft dezelfde
planning; en (3) een compositiecontrole: de samengestelde vreemde inhoud (alle `ops::`-bijdragen eruit, dan samenstellen
volgens IFC5 `compose.ts`) is in bron en uitvoer gelijk.

### 6.4 Imports met data

`imports` kan andere bestanden als datalaag laden. De app lost die in deze versie niet op: hij bewaart de import-entry
ongewijzigd en leest alleen de planning uit het geopende bestand. Een koppeling naar een pad dat niet in dit bestand
staat, toont "niet in dit bestand". Een planningslaag die een modelbestand importeert, is een latere stap.

### 6.5 Geen omzetting van het model

*Opslaan als* in het andere formaat (STEP ↔ IFCX) kan alleen als "planning zonder model", met een vraag vooraf die dat zegt.

## 7. Bestanden, dialogen en keuzes

- `formatRegistry.ts`: formaat `ifcx` (`extensions: ['ifcx']`, `canBeSaveTarget: true`), gelezen als bytes.
- Tauri-bestandskoppeling (`src-tauri/tauri.conf.json`) en de dialogfilters krijgen `.ifcx`.
- *Projectinstellingen → Bestandsformaat*: `IFC 4.3 ADD2 (standaard)`, `IFC 4.3`, `IFC4`, `IFCX`. `IFC4X3_ADD2` blijft de
  standaard (#804).
- De vraag bij opslaan krijgt het geval "geopend als IFCX, opslaan als IFC" en omgekeerd.
- Twee feature flags tijdens de bouw: `ifcForeignContent` (§3–4) en `ifcx` (§5–6), allebei met `writesNewIfcData: true`.
  Zolang `ifcForeignContent` uit staat, blijft de weigering van PR #547 actief. Bij oplevering gaan beide flags eraf,
  in de PR die het aanzet (conventie in `AGENTS.md`).

## 8. Fasen en inschatting

| Fase | Inhoud | Omvang | Risico |
|---|---|---|---|
| 0 | **Haalbaarheidsproef**: scanner + indeling op het testcorpus (§10), lezen als bytes, meting van tijd en geheugen, controle met IfcOpenShell. Beantwoordt: klopt de indeling bij Bonsai/Synchro, leest de lezer iets uit units, hoe groot mag een model zijn. | 1 PR (alleen tests en scripts) | — |
| 1 | Bytes-openroute, scanner, indeling, `ifcSource`, lezer met C-context, schrijver met stukken en ids, beide controles. Achter de flag. | 2–3 PR's | middel-hoog |
| 2 | A-stukken bij verwijderen, Bonsai-slots, gemengde rels, `elementLinks`, alle routes uit §4.13, herstel en "bron ontbreekt", melding, handleiding. Flag eraf, weigering eruit (laatste PR). | 3–4 PR's | middel-hoog |
| 3 | IFCX-planning zonder model: profiel `ops::` 1.0.0, gegenereerde schema's, lezer, schrijver, `openaec::activity`, dialogen, keuze, vraag bij opslaan, round-trip STEP↔IFCX. Achter de flag. | 4–6 PR's | hoog: veel velden, alfa-formaat |
| 4 | IFCX met vreemde inhoud: entries als bytes, eigendom per attribuut, compositiecontrole. Flag eraf. | 2 PR's | middel |

Hoe moeilijk: dit is groot werk. Het lastige deel is niet het knippen zelf, maar het randgebied waar de planning en de
rest elkaar raken: vreemde gegevens op taken, gemengde relaties, verwijderen, planning van andere programma's, en
herstel zonder bron. Daarom eerst fase 0 met echte bestanden. De inspanning is pas na fase 0 goed te schatten. Het
grootste externe risico is IFCX zelf: het formaat is alfa en kan brekend veranderen. Daarom een eigen profielversie.

## 9. Volgorde van de PR's

Elke PR gaat naar `main`, klein, met een review door GPT-6.1-Sol (BLOKKEERT/VERVOLG). `main` gaat elke zaterdag uit;
daarom staat alles achter de flags tot het compleet is.

## 10. Tests

- **Corpus** (`tests/fixtures/ifc-foreign/`, klein): een IFC4- en een IFC4X3-model zonder planning (buildingSMART-
  voorbeelden), een 4D-bestand met taken gekoppeld aan bouwdelen (Schependomlaan als de licentie het toestaat, anders
  een eigen bestand uit Bonsai), een Bonsai-bestand met `IfcRelDeclares` naar het werkplan, vreemde psets op taken, een
  gemengde `IfcRelAssignsToProcess`, een CRLF-bestand met commentaar, een Latin-1-bestand, complexe instanties, een
  IFC2X3-model. Plus `Hello Wall` en een groter IFC5-voorbeeld, een IFCX met een gemengde entry, een `null`-child en een
  groot geheel getal.
- `check-ifc-foreign-preserve.ts`: openen → opslaan zonder wijziging → bron byte-gelijk; taak toevoegen, wijzigen en
  verwijderen → vreemd deel byte-gelijk op de wijzigingslijst na, en die lijst klopt; herstel met en zonder bron.
- `check-ifcx-roundtrip.ts`: elk voorbeeldproject IFC → IFCX → IFC zonder verschil in het planningsmodel; de veldentest
  uit §5.2; de compositiecontrole.
- **Onafhankelijke controle in CI** (eigen workflow, zoals `headless-api.yml`): IfcOpenShell leest invoer en uitvoer en
  vergelijkt alle vreemde entiteiten per GlobalId en attribuut, plus `ifcopenshell.validate`. De TypeScript-validator van
  IFC5-development controleert de IFCX-uitvoer.
- Verplicht vóór de flags eraf gaan: bron ontbreekt of is corrupt, gedeeltelijk verwijderde relaties, de grensgevallen
  van de scanner.

## 11. Open besluiten

Elk besluit leg ik apart aan Ethan voor, met voorbeeld en aanbeveling.

1. **Namespace**: `ops::` (aanbevolen: volgt `ocss::`/`oses::`) of `openaec::planner::`.
2. **`openaec::activity` meeschrijven** zodat ifcx-explorer de planning toont: ja, als afgeleide kopie (aanbevolen), of niet.

Vervallen na ronde 1: "byte-gelijk of inhoudelijk gelijk bij IFCX" (byte-gelijk is nu de route), "grens voor
modelgrootte" (wordt gemeten), "fase 1–2 los uitbrengen" (alles komt in deze sessie, achter flags).

## 12. Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |

Wijzigingen na ronde 1: één route met klassen P/C/A/V in plaats van twee modi; bestaande ids blijven staan; lezen en
knippen als bytes, ook voor IFCX; projectgegevens als context en in `OPS_ProjectSettings`; Bonsai-slots en
"ongewijzigd = bronstuk"; koppelingen blijven vreemd met een afgeleide weergave; tabel van alle routes; "bron ontbreekt"
blokkeert opslaan; IFCX-paden zonder `/`, kop en imports van een ander blijven staan, profielversie alleen in
`ops::document`, eigendom per attribuut, volgorde behouden, compositiecontrole; grens gemeten; fase 0; flags; bronnen
gecorrigeerd.

## 13. Bronnen

- Issue #804 (DutchSailor, 2026-11-02); issue #748; PR #547 / commit `5b2812f94`.
- `src/services/ifc/ifcReader.ts:178-185, 445, 982-985, 1105-1107, 1377-1423, 3473-3490`; `ifcWriter.ts:287, 317-416, 825`;
  `ifcTaskSlots.ts:338`; `src/state/documentContract.ts:298`; `src/services/recovery/recoverySnapshotInput.ts`;
  `recoverySnapshotSerializer.ts:27`; `src/hooks/useRecoveryRestore.ts:90`; `src/hooks/useAutoSave.ts:148`;
  `src/services/mcp/backupService.ts:312`; `src/components/panels/IFCPanel.tsx:39-58`; `fileSlice.ts:898`;
  `src/services/fileAccess/{tauriBackend.ts:22, webBackend.ts:124, siteBackend.ts:43}`; `formatRegistry.ts:142`.
- IFC5-development `schema/ifcx.tsp`, `src/ifcx-core/composition/{compose.ts, path.ts}`, `layers/layer-stack.ts`,
  `schema/schema-validation.ts`, `examples/Hello Wall/`.
- IFCCAD `docs/experiments/ifccad-document-lifecycle.md`, `schemas/ifccad/experimental-contract-0.6.0.md`.
- ifcx-explorer `examples/reference-school/planning/work-packages.ifcx`, `schemas/openaec-reference.ifcx`,
  `crates/ifcx-project/src/graph.rs`.
- Open-Calculations-Studio `packages/core/src/ifcx/namespace.ts`, `identiteit.ts`; open-bim-studio `exchange/ifcx/bim_ifcx.dl`.
