# Gebouwmodel behouden in IFC en IFCX — ontwerp

Status: ontwerp, versie 3 (7 november 2026, na council-ronde 2). Wordt in dezelfde sessie gebouwd.
Issue #804 (IFCX naast IFC4X3). Raakt #748 (lokale 4D-workflow). Vervangt de weigering van PR #547
(commit `5b2812f94`, 2026-10-23; de vroegere knownbug 110).

## 1. Waarom en wat

Een planner krijgt vaak één IFC-bestand met het gebouwmodel van de architect of de constructeur. Hij wil daarin de
planning maken of bijwerken en het bestand terugsturen. Nu kan dat niet:

- `readIFC` weigert elk bestand met een `IfcProduct` of `IfcTypeProduct` (`src/services/ifc/ifcReader.ts:178-185`).
- `writeIFC` schrijft het hele bestand opnieuw uit het eigen planningsmodel (`ifcWriter.ts:317` e.v.). Alles wat geen
  planning is, verdwijnt. Dat geldt nu ook voor planningsbestanden zonder model: gegevens van andere programma's zijn
  na opslaan weg.
- IFCX (het JSON-formaat voor IFC5) kent de app niet.

Opdracht (Ethan, 7 november 2026): de app werkt met gebouwmodellen en gooit geen gebouwdelen weg, in het huidige
IFC-formaat en in IFCX. IFCX wordt in deze sessie volledig ingebouwd: alles uit de checklist van #804.

**Doel**

1. Een IFC4/IFC4X3-bestand openen, de planning bewerken en opslaan. Alles wat geen planning is, komt **byte-gelijk**
   terug: het model, de geometrie, gegevens van andere programma's.
2. Hetzelfde voor een `.ifcx`-bestand (§6 zegt precies wat byte-gelijk is).
3. Een planning als `.ifcx` opslaan en weer openen, zonder verlies van de gegevens in §5.4.
4. Bestaande koppelingen taak↔bouwdeel blijven bestaan en zijn zichtbaar (alleen lezen).
5. Een bestaand eigen IFC-project werkt precies zoals nu (eis uit #804).

**Buiten dit ontwerp**

- Het model tonen of koppelingen bewerken (viewer, selectie, tijdschuif): #748.
- Een gebouwmodel omzetten tussen STEP en IFCX.
- IFC2X3-bestanden met een model (§4.11). Dat is een echte beperking: veel modellen uit Revit en ArchiCAD in
  Nederland zijn nog IFC2X3.
- Datalagen van een IFCX-bestand oplossen die via `imports` uit andere bestanden komen (§6.5).
- Een IFCX-bestand met alleen `openaec::activity` als planning openen.

## 2. Wat we leerden uit het ecosysteem

Bron: shallow clones van 7 november 2026.

| Project | Wat het doet | Les voor ons |
|---|---|---|
| **IFCCAD** (`ifccad`) | Alleen IFCX + CBOR. Bewaart de bronbytes. Een projectie mag nooit als verliesvrije bron worden gepresenteerd (`docs/experiments/ifccad-document-lifecycle.md:23-30`). `header.dataVersion` hoort bij de dataset (`schemas/ifccad/experimental-contract-0.6.0.md:35`). | Bewaar de bron, bewerk alleen het eigen deel, zeg eerlijk wat niet behouden blijft. Raak de kop van een ander niet aan. |
| **IFC5-development** (buildingSMART, `1a63082`, 2026-09-08) | `ifcxVersion: "ifcx_alpha"`. `imports` laadt andere bestanden als lagen (`layer-stack.ts:88-111`). Bij gelijke paden wint de latere bijdrage, per attribuutsleutel (`compose.ts`). Paden worden op `/` geknipt (`path.ts:2-11`). De validator eist een schema voor elk attribuut (`schema-validation.ts:129-131`). **Geen schema of voorbeeld voor taken, relaties, kalenders of resources.** | Planning in een eigen namespace, schema's in het bestand. Volgorde van entries is betekenis. |
| **ifcx-explorer** | Planning als eigen laag: `openaec::activity` (`start`, `endExclusive`, `status`, optioneel één `predecessor`) en `openaec::links` (`relation: "schedules"`, `target`). Paden met voorloop-`/` (`/planning/work-0`). Weigert stille botsingen tussen lagen (`graph.rs:40-44`). | Er is een ecosysteem-vorm voor "taak plant element". Wij schrijven nooit op paden van een ander. |
| **Open-Calculations-Studio** | Namespace `ocss::`: afkorting van het programma, dan het onderwerp (zus `oses::`). Schema's compleet in elk bestand. UUID v5 en IFC-GlobalId zijn dezelfde 128 bits (`identiteit.ts:4-9`). | Namespace `ops::`, één identiteit voor STEP en IFCX. |
| **open-bim-studio** | `ifcx_alpha`, `dataVersion 1.0.0`, imports ifc@v5a/prop@v5a/usd@v1, namespace `openbim::`. | Bevestigt de gangbare kop en imports. |
| **ifcx-rs**, **wfc5** | Rust-kern zonder behoud van onbekende sleutels (vermoed); wfc5 is een eigen formaat. | Niet gebruiken. |

## 3. Het principe

Er is **één** lees- en schrijfroute voor elk IFC-bestand, met of zonder model.

- De app leest de bron als **bytes** en deelt elk stuk in een klasse in (§4.2).
- Bij opslaan schrijft de app de **eigen planning (P)** opnieuw met de bestaande writer. Alle andere stukken komen
  **byte-gelijk** terug, met hun eigen `#id` en op hun plek.
- Het **vreemde deel** is elk stuk dat niet P is. Een eigen planningsbestand van de app is 100 % P. Dan is de uitvoer
  precies wat de app nu schrijft, ook de kop (doel 5). Een test bewijst dat voor elk voorbeeldbestand en voor elke
  uitvoer van de writer (§10).
- Na een geslaagd opslaan is de uitvoer de nieuwe bron (§4.8).

Waarom niet de alternatieven:

- *Volledig IFC-objectmodel* (web-ifc, IfcOpenShell-WASM): groot, traag, en het herschrijft ook vreemde regels.
  Dan is "ongewijzigd" niet te bewijzen.
- *Model in een los bestand en extern samenvoegen* (ifcpatch `MergeProjects`): de huidige werkwijze. Dan werkt de app
  niet met gebouwmodellen.
- *Ongewijzigde planningsobjecten byte-gelijk terugschrijven* (versie 2): vraagt een betrouwbare koppeling van elk
  hulpobject aan de bron. Die is er niet (de writer-sleutels zijn niet uniek, `ifcWriter.ts:1160-1167`, `ifcPsets.ts:381-394`).
  De planning wordt daarom altijd opnieuw geschreven. Wat de writer niet kent, wordt per slot bewaard (§4.5).

## 4. IFC (STEP)

### 4.1 Stukken

Een **stuk** is een entiteit-instantie van `#` tot en met de `;` die haar afsluit, plus alle tekst ervóór sinds het
vorige stuk: witruimte, regeleinden (ook CRLF) en commentaar. De kop (`HEADER; … ENDSEC;`), `DATA;` en de staart
(`ENDSEC; END-ISO-10303-21;`) zijn aparte stukken. Elk byte van de bron valt in precies één stuk. Complexe instanties
`#n=(A(..)B(..));` zijn ook stukken (de huidige `readEntity` slaat ze over, `ifcReader.ts:982-985`).

Met een vreemd deel blijft de kop **helemaal** byte-gelijk, ook `FILE_NAME` en `FILE_SCHEMA`. Zonder vreemd deel
schrijft de writer de kop zoals nu.

### 4.2 Indeling

De scanner levert per stuk: `#id`, type (of "complex"), de `#`-verwijzingen met hun argumentpositie, argument 0 als ruwe
ASCII-tekst (de GlobalId van een `IfcRoot`, geen decodering nodig) en, voor psets, `Name`. De indeling is een pure functie
van die index. Ze gaat in vier stappen.

**Stap 1 — de planning kiezen.** Eén gedeelde functie `selectPlanning(index)` bepaalt de wortels. Dezelfde functie
bepaalt in de lezer welke taken de app overneemt, zodat indeling en lezer niet uiteen kunnen lopen.

- Wortels: elk `IfcWorkPlan` en elk live-`IfcWorkSchedule` (niet `BASELINE`, `ifcReader.ts:1113-1115`), de taken die daar
  via `IfcRelAssignsToControl` en `IfcRelNests` onder hangen, de `IfcWorkCalendar`'s en de resources van die taken.
  Zonder werkschema: elke `IfcTask` buiten een baselineboom, zoals nu (`ifcReader.ts:1749`).
- Baselinebomen: P als ze een `OPS_`-pset dragen (eigen baselines); anders niet P (een baseline van Bonsai blijft
  byte-gelijk; de lezer gooit ze nu al weg, dus dat is winst).
- Meerdere live-schema's: allemaal P. De lezer voegt hun taken samen zoals nu. De writer schrijft één schema; de melding
  bij openen zegt "2 werkschema's samengevoegd tot één". Is dat in fase 0 te veel verlies voor echte Bonsai-bestanden,
  dan maakt dit een product-besluit voor Ethan.

**Stap 2 — de afsluiting.** P is alles wat vanuit de wortels bereikbaar is via verwijzingen, beperkt tot de typen die de
writer zelf schrijft (een gesloten lijst, af te leiden uit `ifcWriter.ts`). Een bereikbaar stuk waar ook een stuk naar
verwijst dat niet bereikbaar is vanuit de wortels, is **niet** P maar C (gedeelde context).

**Stap 3 — het project.** `IfcProject` met zijn owner history, units en geometrische context:

- verwijst niets buiten P ernaar: P (een eigen bestand);
- anders: **C** (het project van de architect). De lezer leest het, de writer verwijst ernaar.
- Dit geldt ook voor een model **zonder** planning: het `IfcProject` is dan C, en de app hangt de nieuwe planning eraan.

**Stap 4 — relaties en de rest.**

- Een relatie (`IfcRel*`) waarvan alle leden P zijn, of P plus het C-project, is **P**. Voorbeelden: `IfcRelAggregates`
  werkplan→schema's (`ifcWriter.ts:483`), `IfcRelDeclares` project→templates (`:825`), `IfcRelDefinesByProperties` met
  een `OPS_`-pset op het project (`OPS_Project`, `OPS_ProjectSettings`, het XER-archief).
- Een `IfcRelDefinesByProperties` met een pset zonder `OPS_`-naam is **nooit** P. De writer schrijft alleen `OPS_*`-psets.
- **A — aanhangsel**: een stuk dat niet P is en naar minstens één P-stuk verwijst. Voorbeelden: een pset van Bonsai op
  een taak, `IfcRelAssignsToProduct`, `IfcRelDeclares` project→werkplan van IfcOpenShell, een rel met taken én wanden.
- **V — vreemd**: al het andere.

| Klasse | Lezer | Schrijver |
|---|---|---|
| P | leest | schrijft opnieuw (§4.4, §4.5) |
| C | leest (alleen lezen) | byte-gelijk; P-stukken verwijzen ernaar |
| A | leest alleen `IfcRelAssignsToProcess` en `IfcRelAssignsToProduct` (§4.6) | byte-gelijk, tenzij een P-doel verdwijnt (§4.7) |
| V | leest niet | byte-gelijk |

Lezen en schrijven zijn dus apart geregeld: de lezer mag een A-stuk lezen zonder dat de app het bezit.

### 4.3 Identiteit

- Een P-stuk met een GlobalId dat de lezer aan een domeinobject koppelt (werkplan, schema, taak, kalender, resource,
  relatie, de eigen OPS-psets op het project), houdt bij opslaan zijn `#id`. De koppeling loopt via de GlobalId; die is al
  stabiel via `ifcGlobalIds`.
- Alle andere P-stukken (hulpstukken zonder GlobalId: tijden, perioden, properties) krijgen nieuwe ids, vanaf het
  hoogste id dat in de uitvoer behouden blijft, plus 1.
- Gevolg: een A-stuk dat naar een nog bestaande taak, resource of kalender verwijst, blijft byte-gelijk. Vreemde stukken
  verwijzen in de praktijk alleen naar objecten met een GlobalId. Verwijst een vreemd stuk toch naar een hulpstuk, dan is
  dat hulpstuk C (stap 2) en blijft het staan.

### 4.4 De writer met een vreemd deel

- Geen eigen `IfcProject`, units en geometrische context als het project C is. De sleutel `_project` wijst naar het C-id.
- Eigen owner history, persoon, organisatie en applicatie: wel. Die zijn P (alleen P verwijst ernaar), dus ze worden
  elke keer vervangen en stapelen niet op.
- Projectnaam en beschrijving: de writer zet ze al in `IfcWorkPlan.Name`/`Description` (`ifcWriter.ts:453`). Is het
  project C, dan leest de lezer de naam eerst uit het werkplan. Auteur en bedrijf komen als nieuwe properties in
  `OPS_ProjectSettings` (blijft op het project, `ifcWriter.ts:676-694`), met terugval op de owner history.
- Eenheden: de writer voegt niets toe aan de `IfcUnitAssignment` van het model. Fase 0 controleert of de lezer iets uit
  de units leest.
- Regeleinde: dat van de bron. Uitvoer: een lijst `Uint8Array`-delen, geen grote string.

### 4.5 Planning van een ander programma (Bonsai, Synchro)

Een taak uit Bonsai of Synchro is P en wordt dus opnieuw geschreven. Wat de writer niet kent, mag daarbij niet stil
verdwijnen.

- Elke slot-descriptor (`IFC_TASK_SLOTS`, `IFC_TASKTIME_SLOTS` in `ifcTaskSlots.ts`, en de descriptors in
  `ifcWorkControlSlots.ts`) krijgt een vlag `domain: true` als de lezer het slot naar een domeinveld vertaalt.
- De lezer bewaart voor elk P-object met GlobalId de ruwe STEP-tokens van alle slots met `domain: false`, plus het
  entiteittype, in `ifcSource.foreignSlots` (sleutel: GlobalId; voor `IfcTaskTime` de GlobalId van de taak).
- De writer schrijft een slot met `domain: false` uit `foreignSlots` als het er is, en anders zoals nu.
- Een slot met `domain: true` schrijft de writer uit het domein. Is het domeinveld gelijk aan de waarde bij openen,
  dan neemt hij het ruwe token uit de bron, zodat bijvoorbeeld een Bonsai-`Status` of een schemanaam niet verandert.
- Het entiteittype komt uit de bron als het domein het niet onderscheidt (een `IfcConstructionProductResource` blijft
  dat, en wordt niet `IfcConstructionEquipmentResource`, `ifcConstants.ts:52-56`).
- Dit geldt voor `IfcTask`, `IfcTaskTime`, `IfcWorkPlan`, `IfcWorkSchedule`, `IfcWorkCalendar`, de resources en
  `IfcRelSequence`/`IfcLagTime`.
- Wat dan nog verloren gaat (bijvoorbeeld de extra werkschema's uit §4.2, of een vreemde vorm van een tijdsperiode),
  meldt de app bij openen in een lijst. Zo presenteert de app de overname niet als verliesvrij (les van IFCCAD).

### 4.6 Koppelingen taak↔bouwdeel en toewijzingen

`IfcRelAssignsToProcess` en `IfcRelAssignsToProduct` met producten erin zijn A. De lezer parseert juist deze A-stukken
met de bestaande `parseSTEP` (een kleine set).

- Afgeleide, alleen-lezen weergave per taak: `elementLinks: { direction: 'input' | 'output', globalId }[]`. Bij Bonsai:
  `ToProcess` = input (de taak gebruikt het product), `ToProduct` = output (de taak maakt het). Geen domeinveld, geen
  documentveld; het hoort bij `ifcSource`.
- Taakpaneel: "Gekoppeld aan 12 bouwdelen" (alleen lezen). MCP: veld in `planner_get_task`. Een GlobalId die niet in het
  bestand staat, toont "niet gevonden".
- **Gemengde rel** (resources en producten in één `IfcRelAssignsToProcess`; IfcOpenShell hergebruikt zo'n rel mogelijk,
  te controleren in fase 0): de lezer leest de resource-leden als toewijzingen. Zijn de toewijzingen van die taak bij
  opslaan ongewijzigd, dan schrijft de app geen eigen rel en blijft het stuk byte-gelijk. Zijn ze gewijzigd, dan haalt de
  app de resource-leden uit het stuk (wijzigingslijst) en schrijft hij een eigen rel.

### 4.7 Een P-object is verwijderd

Een A-stuk verwijst naar een P-stuk dat in de uitvoer niet meer bestaat. Dan geldt één algemene regel:

1. De verwijzing staat in een lijst: alleen dat lid gaat eruit.
2. De lijst wordt leeg, of het is een enkele verwijzing: het hele stuk vervalt.
3. Een stuk dat naar een **vervallen** stuk verwijst, valt onder dezelfde regel (herhalen tot niets meer verandert).
4. Een stuk waar een vervallen stuk naar verwees, blijft staan (een losse pset is geldig IFC).

Elk gewijzigd of vervallen vreemd stuk staat in de **wijzigingslijst** (id, oude bytes, nieuwe bytes of "vervallen").
Of een attribuut optioneel is, toetst de app niet zelf. `ifcopenshell.validate` in CI vangt de rest (§10). Melding na
opslaan, via het meldingenkanaal: "3 gegevens van andere programma's hingen aan verwijderde taken of resources. Ze zijn
aangepast of verwijderd."

### 4.8 `ifcSource`: waar de bron woont

- Nieuw documentveld `ifcSource` met rol `snapshot: 'none'`, zoals `xerSourceArchive` (`documentContract.ts:298`).
  Niet in undo.
- Inhoud: de bronbytes (`Uint8Array`), sha256, de kopnaam van het schema (ook `IFC4X3_ADD1`/`TC1`), de stukkenindex
  (`Uint32Array`), de klasse per stuk, de A-verwijzingen, `foreignSlots`, `elementLinks`, het totaal aantal vreemde
  objecten voor de melding.
- **Na een geslaagd opslaan** vervangt de app `ifcSource` door de uitvoer (die controle 2 al gescand heeft). Zo komt een
  melding uit §4.7 maar één keer, en wijst het herstel naar het bestand zoals het nu op schijf staat.
- **Eigenaar van de bytes**: de hoofdthread, in `ifcSource`. De scanner draait synchroon (ook in Node en in het herstel)
  of krijgt in een Worker een kopie. Het samenvoegen bij opslaan gebeurt op de hoofdthread met `subarray`, zonder kopie.
  Fase 0 meet of dat bij 150 MB de UI te lang blokkeert; zo ja, dan krijgt een Worker een kopie.
- Geen vreemd deel (nieuw project, eigen bestand, import uit CSV/MSPDI/XER): `ifcSource = null`, de huidige route.

### 4.9 Lezen

1. **Openen als bytes.** Elke open-route voor IFC leest bytes: Openen (`tauriBackend.ts:22`, `webBackend.ts:124`,
   `siteBackend.ts:43`), Recent (`tauriBackend.ts:87-90`, `fileSlice.ts:1658`) en externe bronnen
   (`parseExternalSource`, `fileSlice.ts:1500`). De grootte wordt vóór het lezen gecontroleerd (§4.13).
2. **Scanner** op `Uint8Array` (alle STEP-syntaxis is ASCII).
3. **Indeling** (§4.2).
4. **Lezer**: de P-, C- en gekozen A-stukken worden gedecodeerd (STEP-strings, UTF-8) en gaan door de bestaande
   `parseSTEP` en lezer.

### 4.10 Vóór opslaan: de verliesbewaking

De writer schrijft: alle niet-P-stukken in bronvolgorde (A volgens de wijzigingslijst), dan de P-stukken, dan de staart.
Daarna, vóór het wegschrijven, scant de app de uitvoer opnieuw met de scanner. Twee controles:

1. **Vreemd deel.** Elk niet-P-stuk van de bron staat in de uitvoer met hetzelfde `#id`, dezelfde bytes en in dezelfde
   volgorde, op de wijzigingslijst na. Directe vergelijking van bytes (geen hash per stuk). Er komt geen niet-P-stuk bij.
   Deze controle vergelijkt de scan van de uitvoer met de index van de bron. Ze vangt een fout van de writer, niet een
   fout van de scanner zelf; die vangt controle 3.
2. **Planning.** De uitvoer gaat door de volledige leesroute. Vergelijk de planning met het geheugen in de canonieke vorm
   van `tests/planning/check-ifc-roundtrip.ts` (`canon`: sleutel GlobalId, gegenereerde ids genormaliseerd). Een gewone
   `documentDataChanged`-vergelijking werkt niet: de lezer maakt nieuwe ids voor relaties, resources en toewijzingen
   (`ifcReader.ts:2063, 2434, 3503`). Verwijzingen en GlobalIds: er komen geen loze verwijzingen en geen dubbele GlobalIds
   **bij** ten opzichte van de bron (een bron met dubbele GlobalIds blijft dus op te slaan).

Faalt een controle, dan schrijft de app niets. De melding biedt een uitweg: *Exporteren zonder gebouwmodel*.

3. **Alleen in CI**: IfcOpenShell vergelijkt invoer en uitvoer onafhankelijk: alle entiteiten op `#id`, type en
   attributen (ook geometrie zonder GlobalId), plus `ifcopenshell.validate` (§10).

### 4.11 Schema

- Het schema komt uit de kop van de bron en verandert niet. De kopnaam staat in `ifcSource`. `Project.ifcSchema` (drie
  waarden) blijft voor bestanden zonder vreemd deel. Met een vreemd deel staat de keuze in *Projectinstellingen* uit, met
  de reden, en de schemavraag bij opslaan vervalt. AutoSave (`ifcSchemaBlocksSilentWrite`, `useAutoSave.ts:143`) leest
  dan `ifcSource`.
- Herkende kopnamen: `IFC4`, `IFC4X3`, `IFC4X3_ADD1`, `IFC4X3_ADD2`, `IFC4X3_TC1` (nu kent `readFileSchema` alleen drie,
  `ifcReader.ts:1105-1107`).
- **IFC2X3 met vreemd deel**: geweigerd. `IfcTask` en `IfcWorkCalendar` zijn in IFC2X3 anders; een mengsel is ongeldig.
  De melding raadt aan het model eerst naar IFC4 om te zetten. Een onbekend schema: ook geweigerd.

### 4.12 Elke route

| Route | Waar | Gedrag met een vreemd deel |
|---|---|---|
| Opslaan, Opslaan als in hetzelfde formaat | `fileSlice.ts` | Volledig bestand (§4.10). |
| `exportAs('ifc')` | `fileSlice.ts:1396-1399` | Zelfde als Opslaan als. |
| Exporteren → IFC zonder gebouwmodel | `fileSlice.ts`, nieuw | Alleen P (de huidige uitvoer). Vraag vooraf die dat zegt. |
| `exportProjectWithPool` | `fileSlice.ts:1474` | Volledig bestand, met de pool als extra P. |
| Opslaan als ander formaat (STEP↔IFCX, CSV, MSPDI, XER) | `fileSlice.ts` | Alleen planning, met een vraag vooraf. Het model gaat niet mee. |
| Echte AutoSave naar het bestand | `useAutoSave.ts:148` | Volledig bestand, op de hoofdthread. Langere wachttijd met een vreemd deel (voorstel 60 s, te meten). |
| Crashherstel (10 s) | `recoverySnapshotInput.ts` | Alleen P + verwijzing naar de bron (§4.14). |
| MCP-backup | `backupService.ts:312`, `backupFs.ts:35` | P + verwijzing; de bron één keer per sha256 in de backupmap, als bytes. |
| MCP-bestandstools, `planner_export_ifc` | `mcp/tools/fileTools.ts` | Volledig bestand, zelfde controles. |
| IFC-werkruimte (paneel) | `IFCPanel.tsx:39-58` | Toont alleen de P-stukken, alleen lezen. *Toepassen* staat uit met een vreemd deel (nu zou `applyLoadedProject`/`payloadFromImport` het model laten vallen, `fileSlice.ts:898`). |
| Headless core | `core/index.ts:53`, `api.ts:120` | Nieuw: `openIfcBytes(Uint8Array)` en `toIfcBytes()`. `openIfc(text)`/`toIfc()` blijven en zijn alleen byte-gelijk voor geldige UTF-8 (staat in `docs/headless-kern.md`). Samenvatting krijgt `foreignContent: { format, schema, objectCount } \| null`. Contractwijziging. |
| Headless HTTP-API | `headless/server/server.mjs:269` | Accepteert en levert `application/octet-stream`; `openapi.yaml` bijwerken. |
| Headless MCP-server | `headless/mcp-server/src/nodeFs.ts:358` | Leest en schrijft bytes; synchrone scanner. |
| Site-opslag | `siteBackend.ts` | Bytes in en uit. |
| Resourcebibliotheek | `libraryIfc.ts` | Ongewijzigd (nooit een vreemd deel). |
| Benchmark, dev-bridge | `benchmark/runner.ts`, `devBridge.ts:89-91` | Ongewijzigd; tekst, alleen voor ontwikkelaars. |

### 4.13 Grootte en geheugen

- Bronbytes één keer in het geheugen (§4.8). Uitvoer = verwijzingen naar de bron plus de P-stukken.
- De Tauri-app draait op WebKit (JavaScriptCore) op Linux en macOS en op WebView2 (V8) op Windows; de browserbuild op V8.
- Voorlopige grens: 150 MB, gecontroleerd vóór het volledig lezen. De echte grens volgt uit de meting in fase 0.

### 4.14 Herstel en een ontbrekende bron

- Herstel zet nu ook het bestandspad en het site-doel terug (`useRecoveryRestore.ts:90`). Zonder bron zou Ctrl+S het
  modelbestand overschrijven met alleen planning.
- Het herstelmanifest krijgt per document een verwijzing `ifcSource: { sha256, size }` (manifest versie 6,
  `recoveryManifest.ts:4`). Opruimen houdt rekening met die verwijzing, zoals nu met `xerArchive` (`recoveryStore.ts:378`).
- **Tauri**: eerst het oorspronkelijke pad opnieuw lezen en de sha256 controleren. Pas als dat niet kan, een kopie in de
  herstelopslag (één keer per sha256, asynchroon, vóór het manifest dat ernaar verwijst).
- **Browser**: een kopie in IndexedDB, één keer per sha256, asynchroon, vóór het manifest (volgorde van het XER-archief,
  `docs/xer-recovery-guardrails.md`).
- Vindt het herstel geen bron met de juiste sha256, dan krijgt het document de toestand **bron ontbreekt**. Opslaan,
  AutoSave naar het bestand en MCP-export naar het oorspronkelijke doel zijn dan geblokkeerd. Alleen *Opslaan als* naar
  een nieuw bestand kan, met een tekst dat het model er niet in zit.

### 4.15 Wat de planner ziet

- Na openen, in de statusbalk: "Dit bestand bevat ook een gebouwmodel en gegevens van andere programma's
  (12.345 objecten). Bij opslaan blijven die ongewijzigd."
- Bij openen, als de overname van planning uit een ander programma iets niet meeneemt: de lijst uit §4.5.
- Na opslaan, alleen als de wijzigingslijst niet leeg is: de melding uit §4.7.
- Handleiding: `howto-ifc-schema-kiezen` ("Voeg samen als laatste stap") en `docs/ifc-round-trip.md` herschrijven. Nieuwe
  how-to: "Een planning maken in een IFC-bestand met gebouwmodel".

## 5. IFCX: planning lezen en schrijven

### 5.1 Kop, versie en imports

- **Eigen bestand**: `ifcxVersion: "ifcx_alpha"`, `dataVersion: "1.0.0"` (de versie van deze dataset, zoals IFC5 het
  bedoelt), `id: "urn:openaec:planner:<project-uuid>"`, `author`, `timestamp` (ISO 8601).
- **Bestand van een ander**: de kop blijft byte-gelijk, ook `timestamp`.
- `ifcxVersion` anders dan `ifcx_alpha`: openen geweigerd, met de gevonden waarde in de melding.
- **Versie van het OPS-profiel**: alleen `ops::document.formatVersion` op de planwortel. Een hogere hoofdversie dan de app
  kent: openen geweigerd ("gemaakt met een nieuwere versie van Open Planner Studio").
- `imports` en `schemas` van de bron blijven staan. De app voegt `ifc@v5a` toe als die ontbreekt (voor `bsi::ifc::class`)
  en voegt haar eigen schema's toe (`ops::*`, en `openaec::activity` als die er nog niet is). Lezen heeft geen netwerk nodig.

### 5.2 Namespace, paden en nodes

Namespace `ops::` (open besluit 1). Elke eigen node krijgt ook `bsi::ifc::class` met de IFC 4.3-klasse.

- **Paden**: de UUID van het object, dezelfde 128 bits als de IFC-GlobalId. Een taak heeft dus in STEP en IFCX dezelfde
  identiteit. De buildingSMART-composer knipt op `/` (`path.ts:2-11`), ifcx-explorer gebruikt paden met een voorloop-`/`.
  Fase 0 opent een uitvoer in beide en kiest de vorm die in beide werkt. Uitgangspunt: kale UUID.
- **Eigen pad**: een pad met een `ops::`-attribuut in de bron, of een pad dat de app zelf maakt.

| Planningsgegeven | Node | Attributen |
|---|---|---|
| Werkplan | `<plan-uuid>` | `bsi::ifc::class: IfcWorkPlan`, `ops::document` (`formatVersion`), `ops::project` |
| Taak | `<taak-uuid>` | `bsi::ifc::class: IfcTask`, `ops::task` |
| Relatie | `<rel-uuid>` | `bsi::ifc::class: IfcRelSequence`, `ops::relation` |
| Kalender | `<kal-uuid>` | `bsi::ifc::class: IfcWorkCalendar`, `ops::calendar` |
| Resource | `<res-uuid>` | `bsi::ifc::class` (resource-subtype), `ops::resource` |
| Toewijzing, baseline, codes, overige projectdata | onder taak of plan | `ops::assignment`, `ops::baseline`, … |

- WBS via `children` van plan en samenvattingstaken, alleen naar eigen paden.
- De `ops::`-schema's worden met de hand geschreven, met volledige `objectRestrictions`. Een test valideert elke uitvoer
  van de voorbeeldprojecten met de validator van IFC5-development.

### 5.3 Afgeleide kopie voor het ecosysteem

De app schrijft per taak ook `openaec::activity` met `start`, `endExclusive`, `status` (verplicht in het schema van
ifcx-explorer) en de eerste voorganger als `predecessor` (het schema kent maar één voorganger). Het schema van
`openaec::activity` gaat mee in `schemas`. De app leest deze kopie nooit terug (open besluit 2).

### 5.4 Wat wel en niet in IFCX gaat

- Wel: alles wat in IFC4X3 round-tript. Bron: `DOCUMENT_FIELDS` en `IFC_SAVE_KEYS`. Een test eist dat elk veld dat in
  IFC4X3 round-tript, ook in IFCX round-tript.
- Niet: het XER-bronarchief (`xerSourceArchive`). Opslaan als IFCX van een project met zo'n archief geeft vooraf een
  melding: "Het P6-bronarchief gaat niet mee naar IFCX."
- Niet: koppelingen taak↔bouwdeel bij omzetten STEP↔IFCX (het model gaat ook niet mee).

## 6. IFCX: alles wat geen planning is, behouden

### 6.1 Entries als tokens

- Een JSON-tokenizer op bytes vindt de grenzen van `header`, `imports`, `schemas` en elke entry in `data`.
- Per entry decodeert hij de structuur: `path`, de sleutels en waarden van `children` en `inherits`, en de **gedecodeerde
  namen** van de attributen (dus ook een ontsnapte naam als `"ops::task"`). De waarden van attributen blijven
  ruwe bytes.
- Alleen de waarden van eigen attributen worden geparsed. Geen JSON-parser die getallen kan veranderen raakt vreemde
  waarden.

### 6.2 Eigendom per bijdrage

- Eigen bijdragen: `ops::*`-attributen; `bsi::ifc::class` en `openaec::activity` op eigen paden; `children` van eigen
  paden naar eigen paden.
- Een entry zonder eigen bijdragen: **byte-gelijk**.
- Een entry met alleen eigen bijdragen: opnieuw geschreven, **op dezelfde plek**.
- Een gemengde entry: de app schrijft hem op dezelfde plek terug zonder de eigen bijdragen. De vreemde attribuutwaarden
  en de vreemde `children`/`inherits` zijn dan byte-gelijke tokens; alleen de omlijsting van de entry (accolades,
  komma's) wordt opnieuw gemaakt. De eigen bijdragen gaan naar de eigen entry van dat pad.
- Nieuwe eigen entries komen achteraan. Bestaande blijven op hun plek, zodat de compositie van vreemde bijdragen niet
  verandert (een latere `children.sub = null` houdt zijn werking).
- De app schrijft nooit iets op een vreemd pad.
- Vervalt een eigen pad (taak verwijderd), dan vervallen vreemde bijdragen op dat pad ook, met melding (zoals §4.7).

Voorbeeld van een gemengde entry, vóór en na opslaan (de taak is hernoemd):

```json
{"path":"0f2c…","attributes":{"ops::task":{"name":"Fundering"},"openaec::label":"F1"}}
```
wordt
```json
{"path":"0f2c…","attributes":{"openaec::label":"F1"}}
…
{"path":"0f2c…","attributes":{"ops::task":{"name":"Fundering en kelder"},"bsi::ifc::class":{…}}}
```

### 6.3 Controles

Zoals §4.10, met:

1. **Vreemd deel**: elke entry zonder eigen bijdragen is byte-gelijk en staat op dezelfde plek; elke gemengde entry heeft
   dezelfde vreemde tokens; kop, `imports` en `schemas` van de bron zijn byte-gelijk op de eigen toevoegingen na.
2. **Planning**: opnieuw lezen, canonieke vergelijking.
3. **Compositie**: alle eigen bijdragen uit §6.2 eruit, dan samenstellen volgens IFC5 `compose.ts`. Bron en uitvoer geven
   dezelfde vreemde compositie. Lege nodes die alleen eigen bijdragen hadden, tellen niet mee.

### 6.4 Koppelingen in IFCX

`openaec::links` met `relation: "schedules"` op een eigen pad leest de lezer als `elementLinks` met richting `output`.
Een eigen `ops::task` heeft geen koppelingen; die komen pas met #748.

### 6.5 Imports met data

`imports` kan andere bestanden als datalaag laden. De app lost die in deze versie niet op: hij bewaart de import-entry en
leest alleen de planning uit het geopende bestand. Een koppeling naar een pad dat niet in dit bestand staat, toont "niet
in dit bestand".

## 7. Bestanden, dialogen en keuzes

- `formatRegistry.ts`: formaat `ifcx` (`extensions: ['ifcx']`, `canBeSaveTarget: true`), gelezen als bytes.
- Tauri-bestandskoppeling (`src-tauri/tauri.conf.json`) en de dialogfilters krijgen `.ifcx`.
- *Projectinstellingen → Bestandsformaat*: `IFC 4.3 ADD2 (standaard)`, `IFC 4.3`, `IFC4`, `IFCX`. `IFC4X3_ADD2` blijft de
  standaard (#804).
- De vraag bij opslaan krijgt het geval "geopend als IFCX, opslaan als IFC" en omgekeerd.
- Twee feature flags tijdens de bouw: `ifcForeignContent` (§3–4) en `ifcx` (§5–6), allebei met `writesNewIfcData: true`.
  Zolang `ifcForeignContent` uit staat, blijft de weigering van PR #547 actief. Bij oplevering gaan beide flags eraf, in de
  PR die het aanzet (conventie in `AGENTS.md`).

## 8. Fasen en inschatting

| Fase | Inhoud | Omvang | Risico |
|---|---|---|---|
| 0 | **Haalbaarheidsproef** op het corpus (§10): scanner, `selectPlanning`, indeling, lezen als bytes, meting van tijd en geheugen (50/150/300 MB, Linux-WebKit en Chromium), controle met IfcOpenShell. Beantwoordt de vragen in §11. | 1 PR (tests en scripts) | — |
| 1 | Bytes-openroutes, scanner, indeling, `ifcSource`, lezer met C-context, writer met behouden ids, controles 1 en 2, `ifcSource` vernieuwen na opslaan. Achter de flag. | 3 PR's | hoog |
| 2 | `foreignSlots`, A-stukken bij verwijderen, gemengde rels, `elementLinks`, alle routes uit §4.12 (ook headless bytes), herstel met manifest 6 en "bron ontbreekt", meldingen, handleiding. Flag eraf, weigering eruit (laatste PR). | 4–5 PR's | middel-hoog |
| 3 | IFCX-planning zonder vreemde inhoud: profiel `ops::` 1.0.0, schema's, lezer, writer, `openaec::activity`, dialogen, keuze, vraag bij opslaan, round-trip STEP↔IFCX. Achter de flag. | 4–6 PR's | hoog: veel velden, alfa-formaat |
| 4 | IFCX met vreemde inhoud: tokenizer, eigendom per bijdrage, compositiecontrole, `openaec::links`. Flag eraf. | 2–3 PR's | middel |

Hoe moeilijk: dit is groot werk, ongeveer 15 tot 18 PR's. Het knippen zelf is niet het lastige deel. Het lastige deel is
waar de planning en de rest elkaar raken: de indeling, vreemde gegevens op taken, gemengde relaties, verwijderen,
planning van andere programma's en herstel zonder bron. Daarom eerst fase 0 met echte bestanden; daarna is de inspanning
beter te schatten. Het grootste externe risico is IFCX zelf: het formaat is alfa en kan brekend veranderen. Daarom een
eigen profielversie.

## 9. Volgorde van de PR's

Elke PR gaat naar `main`, klein, met een review door GPT-6.1-Sol (BLOKKEERT/VERVOLG). `main` gaat elke zaterdag uit;
daarom staat alles achter de flags tot het compleet is.

## 10. Tests

- **Corpus** (`tests/fixtures/ifc-foreign/`, klein): een IFC4- en een IFC4X3-model zonder planning (buildingSMART-
  voorbeelden), een 4D-bestand met taken gekoppeld aan bouwdelen (Schependomlaan als de licentie het toestaat, anders een
  eigen bestand uit Bonsai), een Bonsai-bestand met twee werkschema's, een baseline en `IfcRelDeclares` naar het werkplan,
  vreemde psets op taken, een gemengde `IfcRelAssignsToProcess`, een CRLF-bestand met commentaar, een Latin-1-bestand,
  complexe instanties, dubbele GlobalIds in de bron, een IFC2X3-model. Plus `Hello Wall`, een groter IFC5-voorbeeld en
  IFCX-bestanden met een gemengde entry, een `null`-child, een ontsnapte attribuutnaam en een groot geheel getal.
- **Eigen bestanden = 100 % P**: elk `public/examples/*.ifc` en elke uitvoer van de writer voor elk voorbeeldproject geeft
  na indeling alleen P. De uitvoer is gelijk aan die van de huidige writer.
- `check-ifc-foreign-preserve.ts`: openen → opslaan zonder wijziging → alle niet-P-stukken byte-gelijk, en een tweede
  opslaan zonder wijziging is byte-gelijk aan het eerste. Taak toevoegen, wijzigen, verplaatsen onder een ongewijzigde
  ouder en verwijderen → vreemd deel byte-gelijk op de wijzigingslijst na, en die lijst klopt. Gedeelde kalender. Herstel
  met bron, met bron op het oude pad, en zonder bron ("bron ontbreekt" blokkeert opslaan).
- **Controles zelf testen**: een writer die bewust een vreemd stuk weglaat, verdubbelt of verschuift, moet door controle 1
  worden tegengehouden.
- `check-ifcx-roundtrip.ts`: elk voorbeeldproject IFC → IFCX → IFC zonder verschil in het planningsmodel; de veldentest uit
  §5.4; de compositiecontrole.
- **Onafhankelijke controle in CI** (eigen workflow, zoals `headless-api.yml`): IfcOpenShell leest invoer en uitvoer en
  vergelijkt alle entiteiten op `#id`, type en attributen, plus `ifcopenshell.validate`. De validator van IFC5-development
  controleert de IFCX-uitvoer.

## 11. Open punten

**Besluiten voor Ethan** (elk apart, met voorbeeld en aanbeveling):

1. **Namespace**: `ops::` (aanbevolen: volgt `ocss::`/`oses::`) of `openaec::planner::`.
2. **`openaec::activity` meeschrijven** zodat ifcx-explorer de planning toont: ja, als afgeleide kopie (aanbevolen), of niet.

**Vragen voor fase 0** (meting of proef, geen besluit):

- Klopt `selectPlanning` op echte Bonsai- en Synchro-bestanden? Is "meerdere werkschema's samenvoegen" acceptabel?
- Hergebruikt IfcOpenShell gemengde `IfcRelAssignsToProcess`-relaties?
- Leest de lezer iets uit de units?
- Hoe groot mag een model zijn (tijd, geheugen, UI-blokkering)?
- Welke padvorm werkt in de buildingSMART-composer én in ifcx-explorer?

## 12. Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |
| 2 (v2) | 6 | 6 | 7 |

Wijzigingen na ronde 1: één route met klassen in plaats van twee modi; lezen en knippen als bytes; projectgegevens als
context; tabel van alle routes; "bron ontbreekt"; IFCX-kop van een ander blijft; profielversie in `ops::document`;
eigendom per attribuut; volgorde behouden; grens te meten; fase 0; flags; bronnen gecorrigeerd.

Wijzigingen na ronde 2: indeling via bereikbaarheid en een gedeelde `selectPlanning` (eigen bestand = 100 % P, getest);
het C-project ook bij een model zonder planning; lees- en schrijfrecht apart (A-stukken lezen); de scanner levert
argumentposities en de GlobalId; ids alleen behouden voor objecten met GlobalId; "ongewijzigd = bronstuk" geschrapt;
`foreignSlots` met een `domain`-vlag per slot, ook voor werkplan, schema, kalender, resource en relatie; controle 1 op de
scan van de uitvoer, controle 2 canoniek; `ifcSource` vernieuwd na opslaan; eigenaar van de bytes; herstel met manifest 6
en eerst het oude pad; ontbrekende routes en een bytes-contract voor de headless kern, de HTTP-API en de MCP-server;
`OPS_ProjectSettings` blijft op het project; regel bij verwijderen in de goede richting; IFCX: tokens per bijdrage,
ontsnapte namen, compositiecontrole zonder alle eigen bijdragen, `openaec::activity` met `status` en schema,
`openaec::links` lezen, kop van een ander byte-gelijk, padvorm in fase 0; het XER-archief gaat niet naar IFCX; lezen van
een bestand met alleen `openaec::activity` geschrapt; schema's met de hand.

## 13. Bronnen

- Issue #804 (DutchSailor, 2026-11-02); issue #748; PR #547 / commit `5b2812f94`.
- `src/services/ifc/ifcReader.ts:178-185, 982-985, 1105-1115, 1377-1423, 1749, 2063, 2434, 3473-3506, 3570-3612`;
  `ifcWriter.ts:287, 317-416, 453, 483, 676-694, 825, 1160-1167`; `ifcTaskSlots.ts:330-340`; `ifcWorkControlSlots.ts`;
  `ifcPsets.ts:381-394`; `ifcConstants.ts:52-56`; `src/state/documentContract.ts:298`; `src/state/snapshot.ts:180-189`;
  `src/services/recovery/{recoverySnapshotInput.ts, recoveryManifest.ts:4, recoveryStore.ts:378}`;
  `src/hooks/useRecoveryRestore.ts:90`; `src/hooks/useAutoSave.ts:143-148`; `src/services/mcp/{backupService.ts:312,
  backupFs.ts:35}`; `src/components/panels/IFCPanel.tsx:39-58`; `fileSlice.ts:898, 1396-1399, 1474, 1500, 1658`;
  `src/services/fileAccess/{tauriBackend.ts:22, 87-90, webBackend.ts:124, siteBackend.ts:43}`; `formatRegistry.ts:142`;
  `src/core/{index.ts:53, api.ts:120}`; `headless/server/server.mjs:269`; `headless/mcp-server/src/nodeFs.ts:358`;
  `tests/planning/check-ifc-roundtrip.ts`.
- IFC5-development `schema/ifcx.tsp`, `src/ifcx-core/composition/{compose.ts, path.ts}`, `layers/layer-stack.ts`,
  `schema/schema-validation.ts`, `examples/Hello Wall/`.
- IFCCAD `docs/experiments/ifccad-document-lifecycle.md`, `schemas/ifccad/experimental-contract-0.6.0.md`.
- ifcx-explorer `examples/reference-school/planning/work-packages.ifcx`, `schemas/openaec-reference.ifcx`,
  `crates/ifcx-project/src/graph.rs`, `crates/ifcx-reference/src/lib.rs:96-102`.
- Open-Calculations-Studio `packages/core/src/ifcx/namespace.ts`, `identiteit.ts`; open-bim-studio `exchange/ifcx/bim_ifcx.dl`.
