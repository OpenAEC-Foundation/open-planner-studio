# Gebouwmodel behouden in IFC en IFCX — voorlopig ontwerp

Status: voorlopig ontwerp, 7 november 2026. Nog niet gebouwd. Issue #804 (IFCX naast IFC4X3), raakt #748
(lokale 4D-workflow) en vervangt de weigering van knownbug 110 (PR #547).

## 1. Waarom

Een planner krijgt vaak één IFC-bestand met het gebouwmodel van de architect of de constructeur. Hij wil
daar de planning in maken of bijwerken en het bestand terugsturen. Nu kan dat niet:

- `readIFC` weigert elk bestand met een `IfcProduct` of `IfcTypeProduct` (`src/services/ifc/ifcReader.ts:178-185`,
  lijst in `ifcBuildingModelTypes.ts`). Reden: `writeIFC` schrijft het hele bestand opnieuw uit het eigen
  planningsmodel (`ifcWriter.ts:317` e.v.). Alles wat geen planning is, zou bij opslaan verdwijnen.
- IFCX (het JSON-formaat voor IFC5) kent de app nog niet.

Opdracht (Ethan, 7 november 2026, voicetranscript bij #804): de app moet met gebouwmodellen werken, zonder de
gebouwdelen weg te gooien, in het huidige IFC-formaat én in IFCX. Aanvrager van #804: DutchSailor (2 november 2026).

## 2. Doel en grenzen

**Doel**

1. Een IFC4/IFC4X3-bestand met gebouwmodel openen, de planning bewerken en opslaan. Het gebouwmodel komt
   ongewijzigd terug, regel voor regel.
2. Hetzelfde voor een `.ifcx`-bestand met gebouwmodel.
3. Een planning zonder model als `.ifcx` opslaan en weer openen, zonder verlies van vastgelegde planningsgegevens
   (de lijst van #804).
4. Bestaande koppelingen taak↔bouwdeel in het bestand blijven bestaan (begin van #748, nog zonder viewer).

**Buiten dit ontwerp**

- Het model tonen of bewerken (viewer, selectie, tijdschuif): dat is #748.
- Een gebouwmodel omzetten van STEP naar IFCX of terug. Het model blijft in zijn eigen formaat.
- IFC2X3-bestanden met een model (zie §4.8).
- Een model achteraf aan een planning koppelen ("samenvoegen in de app"): mogelijke latere stap (§8, fase 5).

## 3. Wat we leerden uit het ecosysteem

Bron: shallow clones van 7 november 2026 (onderzoek door Haiku-zoekagents, steekproeven zelf nagelopen).

| Project | Wat het doet | Les voor ons |
|---|---|---|
| **IFCCAD** (`ifccad`) | Alleen IFCX + CBOR, profiel `urn:example:ifccad:0.6.0`. Bewaart de bronbytes (`source_bytes()`), onbekende provider-gegevens gaan ongewijzigd mee (`docs/preservation.md:36`). Een projectie mag nooit als verliesvrije bron worden gepresenteerd (`docs/experiments/ifccad-document-lifecycle.md:23-30`). Bewerken binnen een groter IFCX-document is uitgesteld (besluit 2026-10-21). | Bewaar de bron, bewerk alleen het eigen deel, en zeg eerlijk wat niet behouden blijft. |
| **IFC5-development** (buildingSMART, commit `1a63082`, 2026-09-08) | `ifcxVersion: "ifcx_alpha"`, header `id/ifcxVersion/dataVersion/author/timestamp`. Lagen: `imports` laadt andere bestanden als lagen; bij gelijke paden wint de latere node, per attribuutsleutel (`compose.ts:17`, `layer-stack.ts`). **Geen enkel schema of voorbeeld voor taken, relaties, kalenders of resources.** | Planning moet in een eigen namespace. Toevoegen naast een model kan zonder het model te wijzigen. |
| **ifcx-explorer** | Planning als eigen laag: `planning/work-packages.ifcx` met `openaec::activity` (`start`, `endExclusive`, `predecessor`) en `openaec::links` (`relation: "schedules"`, `target: /elements/…`). Weigert stille botsingen tussen lagen (`OWNERSHIP_CONFLICT`, "declare an explicit overlay"). | Er is al een ecosysteem-vorm voor "taak plant element". Wij schrijven nooit attributen op paden van een ander. |
| **Open-Calculations-Studio** | Namespace `ocss::` met de redenering: afkorting van het programma, dan het onderwerp (zus `oses::`); geen `bsi::` (van een ander), geen `ifcx::`. Schema's compleet in elk bestand. UUID v5 en IFC-GlobalId zijn twee schrijfwijzen van dezelfde 128 bits (`identiteit.ts:4-9`). | Namespace `ops::`, schema's in het bestand, één identiteit voor STEP en IFCX. |
| **open-bim-studio** | Schrijft IFCX (`ifcx_alpha`, `dataVersion 1.0.0`, imports ifc@v5a/prop@v5a/usd@v1), namespace `openbim::`, stabiele UUID v5-paden. | Bevestigt de gangbare header en imports. |
| **ifcx-rs** | Rust-kern, standaard `ifcx_alpha` / `1.0.0` / import ifc@v5a; "later layer wins". Nodes zonder `flatten`, dus onbekende sleutels vallen waarschijnlijk weg (niet getest). | Geen bruikbare gedeelde bibliotheek voor ons (Rust, en geen behoud). |
| **wfc5** | Eigen `.wefc`-formaat, noemt zich "IFCX-compatible" maar wijkt af. Heeft wel `WefcWorkSchedule`. | Niet volgen. |

Gemeenschappelijk in het ecosysteem: `ifcx_alpha`, `bsi::ifc::class` voor de klasse, een eigen namespace per
programma, schema's in het bestand, en UUID-paden.

## 4. IFC (STEP): het model behouden

### 4.1 Het principe: knippen en plakken, niet herschrijven

De app leest het bestand en verdeelt de entiteiten in twee groepen:

- **Eigen** (planning): entiteiten die de app begrijpt en bij opslaan zelf opnieuw schrijft.
- **Vreemd** (al het andere: het model, de geometrie, psets op wanden, ook planning-entiteiten van een ander
  die de app niet begrijpt): de app bewaart de originele tekstregel en schrijft die **byte-gelijk** terug.

Bij opslaan schrijft de app: kop → alle vreemde regels in hun oorspronkelijke volgorde en met hun
oorspronkelijke `#id` → de eigen regels met nieuwe ids vanaf `max(vreemd id) + 1`.

Waarom niet de alternatieven:

- *Volledig IFC-objectmodel* (web-ifc, IfcOpenShell-WASM): groot, traag om te laden, en het herschrijft ook
  vreemde regels (andere getalnotatie, andere ids). Dan is "ongewijzigd" niet meer te bewijzen.
- *Model in een los bestand en pas bij export samenvoegen*: dat is de huidige werkwijze (ifcpatch
  `MergeProjects`). Het werkt, maar dan "werkt de app niet met gebouwmodellen", en de planner moet zelf
  samenvoegen.

### 4.2 Indeling eigen/vreemd

De indeling gaat op type **en** op verwijzingen, niet op type alleen. `IfcRelDefinesByProperties`,
`IfcRelNests` en `IfcRelAssignsToControl` komen ook in gewone modellen voor (psets op wanden, poorten).

1. **Wortels**: `IfcWorkPlan`, `IfcWorkSchedule`, `IfcTask`, `IfcWorkCalendar` en de resourcetypen die de lezer
   nu leest.
2. **Afsluiting**: een entiteit is eigen als de lezer haar gebruikt om een wortel te lezen (TaskTime, LagTime,
   WorkTime, RecurrencePattern, TimePeriod, de psets en properties van wortels, de rels tussen wortels).
3. **Gedeeld blijft vreemd**: een entiteit waar ook een vreemde entiteit naar verwijst, blijft vreemd en
   ongewijzigd. Eigen regels mogen naar vreemde ids verwijzen.
4. **Het eigen project**: in modelmodus schrijft de app geen eigen `IfcProject`, units, geometrische context
   en `IfcRelAggregates` naar het project. De eigen regels verwijzen naar het `IfcProject` van het model.
   Eigen `IfcOwnerHistory`, `IfcApplication`, persoon en organisatie mag wel: IFC staat meerdere toe.
5. **OPS-psets op het project** (`OPS_Project`, het XER-archief, de property-templates via `IfcRelDeclares`)
   zijn eigen, herkenbaar aan hun naam en hun relatie.

### 4.3 Aanhangsels: vreemde regels die aan een taak hangen

Een ander programma (Bonsai, Synchro) kan iets aan een taak hangen dat de app niet kent: een eigen pset,
een document, een `IfcRelAssignsToProduct`. Die regels zijn vreemd, maar ze verwijzen naar een eigen
entiteit, en die krijgt bij opslaan een nieuw `#id`.

- De lezer bewaart zo'n regel als **aanhangsel**: de originele tekst plus de GlobalId van de taak waar hij aan hangt.
- De schrijver zet de verwijzing om naar het nieuwe `#id` van die taak (GlobalIds blijven stabiel via
  `ifcGlobalIds`). Alleen de `#`-verwijzing in de regel verandert.
- Is de taak verwijderd, dan vervalt het aanhangsel. De app meldt dat bij opslaan ("3 gegevens van andere
  programma's hingen aan verwijderde taken en zijn niet opgeslagen"), via het meldingenkanaal.

### 4.4 Koppelingen taak↔bouwdeel

Een 4D-bestand koppelt een taak aan bouwdelen met `IfcRelAssignsToProcess` (RelatingProcess = taak,
RelatedObjects = producten), of omgekeerd met `IfcRelAssignsToProduct`. De lezer gebruikt
`IfcRelAssignsToProcess` nu voor resources (`ifcReader.ts:3473`).

- Nieuw domeinveld op de taak: `elementLinks: string[]` met de GlobalIds van de bouwdelen. Het gaat mee in
  undo, document-wissel, herstel en opslaan, zoals elk taakveld.
- Lezen: een `IfcRelAssignsToProcess` met gemengde RelatedObjects wordt gesplitst: resources → toewijzingen,
  producten → `elementLinks`.
- Schrijven: per taak één rel voor resources (zoals nu) en één voor bouwdelen.
- Een GlobalId die niet (meer) in het model staat, blijft bewaard en wordt gemeld als "niet gevonden".
  Dat is de basis voor het herkoppelrapport van #748.
- Eerste fase: geen bewerk-UI. In het taakpaneel alleen "Gekoppeld aan 12 bouwdelen" (alleen lezen).

### 4.5 Waar het model in de app woont

Een model kan 100 MB of meer zijn. Het mag niet in undo-snapshots of in elke herstelronde.

- Nieuw documentveld `ifcSourceModel` met rol `snapshot: 'none'`, zoals `xerSourceArchive`
  (`documentContract.ts:298`). Onveranderlijk na openen.
- Inhoud: de brontekst (één string), het schema, de sha256, een index (`Int32Array` met begin en einde per
  vreemde regel), de lijst aanhangsels en een telling per type voor de melding.
- De vreemde regels worden bij opslaan uit de brontekst gesneden. Ze worden nooit geparsed tot objecten.
- Grens: V8 kan een string van ongeveer 536 miljoen tekens aan. Boven een vaste grens (voorstel 400 MB)
  weigert de app met een duidelijke melding, zoals nu bij een kapot bestand.

### 4.6 Lezen: snel scannen, alleen het eigen deel parsen

`parseSTEP` maakt nu van elke entiteit een object. Voor een groot model is dat te traag en te zwaar.

1. **Scanner** (nieuw, in een Web Worker): één doorloop over de tekst. Per entiteit: `#id`, type, begin- en
   eindpositie, en de `#`-verwijzingen in de argumenten. Geen strings decoderen, geen objecten.
2. Indeling eigen/vreemd op de index (§4.2).
3. Alleen de eigen entiteiten gaan door de bestaande `parseSTEP`-route en de bestaande lezer. Zo blijft de
   planningslezer zoals hij is.

De weigering van knownbug 110 vervalt. Een planningsbestand zonder model gaat precies de huidige route.

### 4.7 Schrijven en de verliesbewaking

`writeIFC` krijgt een modus "met bronmodel":

1. Kop: `FILE_DESCRIPTION` en het schema van de bron, ongewijzigd. In `FILE_NAME` alleen de tijd en het
   programma bijwerken.
2. Vreemde regels uit de bron, in volgorde. Aanhangsels met omgezette verwijzing.
3. Eigen regels, ids vanaf `max(vreemd id) + 1`, verwijzend naar het `IfcProject` van het model.

Daarna, **vóór** het schrijven naar schijf, een zelfcontrole met dezelfde scanner op de uitvoer:

- elke vreemde regel staat erin, byte-gelijk (hash per regel of over het geheel);
- elke `#`-verwijzing wijst naar een bestaande regel;
- geen dubbele ids, geen dubbele GlobalIds;
- het aantal vervallen aanhangsels is gelijk aan het aantal dat de melding noemt.

Faalt de controle, dan schrijft de app niets en meldt een fout. Liever niet opslaan dan stil verlies.

### 4.8 Schema

- In modelmodus ligt het schema vast op dat van het model (`IFC4`, `IFC4X3`, `IFC4X3_ADD2`). De keuze in
  *Projectinstellingen* staat dan uit, met de reden erbij. De schemavraag bij opslaan vervalt.
- **IFC2X3 met model**: blijft geweigerd. De app schrijft IFC4-planning (`IfcTask` en `IfcWorkCalendar` zijn
  in IFC2X3 anders); een mengsel is ongeldig. De melding zegt dat en raadt aan het model eerst naar IFC4 om
  te zetten.

### 4.9 Herstel, auto-save, MCP, headless

- **Crashherstel** (auto-save, elke 10 s): de herstelronde schrijft alleen de planning plus een verwijzing
  naar het model (sha256), zoals het XER-archief (`xerSourceArchiveStorage: 'recovery-reference'`,
  `recoverySnapshotInput.ts`). Het model gaat één keer per sha256 in de herstelopslag. Ontbreekt het bij
  herstel, dan biedt de app de planning aan met een duidelijke waarschuwing dat het model ontbreekt.
- **Auto-opslaan naar het bestand** (`autoSaveToFile`): met een model wordt elke ronde een volledige
  schrijfronde. Voorstel: in modelmodus een langere wachttijd (bijvoorbeeld 60 s). Te meten.
- **Web Worker voor opslaan**: alleen de planning gaat over de grens; het samenvoegen met het model gebeurt in
  de Worker die de bron al heeft, of in de hoofdthread bij echt opslaan. Nooit 100 MB per ronde kopiëren.
- **Site-opslag** (`window.openaecHost`): niets nieuws; het volledige bestand gaat naar de site.
- **Headless core** (`src/core/`): `open` en `toIfc()` gebruiken dezelfde route, dus het model blijft ook daar
  behouden. De samenvatting krijgt `buildingModel: { format, schema, entityCount } | null`. Dat is een
  contractwijziging in `api.ts`.
- **MCP**: `planner_*`-tools ongewijzigd. `planner_get_project_info` meldt of er een model is.
  `planner_export_ifc` schrijft het model mee.

### 4.10 Wat de planner ziet

- Na openen: een vaste regel in de statusbalk of het projectpaneel: "Dit bestand bevat een gebouwmodel
  (12.345 objecten, IFC4X3_ADD2). Bij opslaan blijft het ongewijzigd."
- *Opslaan* schrijft model + planning. *Exporteren → IFC zonder gebouwmodel* geeft het losse planningsbestand,
  voor wie toch extern wil samenvoegen.
- De handleiding `howto-ifc-schema-kiezen` ("Voeg samen als laatste stap") en `docs/ifc-round-trip.md` worden
  herschreven. Een nieuwe how-to: "Een planning maken in een IFC-bestand met gebouwmodel".

## 5. IFCX: planning lezen en schrijven

### 5.1 Versie en kop

- `ifcxVersion: "ifcx_alpha"`: de enige versie die buildingSMART en het hele ecosysteem nu schrijven. Een andere
  waarde: openen geweigerd met de gevonden versie in de melding.
- `dataVersion`: de versie van het OPS-planningsprofiel, bijvoorbeeld `"1.0.0"`. Een hogere hoofdversie dan de
  app kent: openen geweigerd ("gemaakt met een nieuwere versie").
- `id`: bij een eigen bestand `urn:openaec:planner:<project-uuid>`, stabiel per project. Bij een bestand van een
  ander: het bestaande `id` blijft.
- `imports`: `ifc@v5a` alleen omdat we `bsi::ifc::class` gebruiken; verder niets. Geen netwerk nodig om te lezen.
- `schemas`: alle `ops::`-schema's compleet in elk bestand (zoals `ocss::`).

### 5.2 Namespace en indeling

Namespace `ops::` (Open Planner Studio, naar de regel van het ecosysteem: afkorting van het programma, dan het
onderwerp). Elke node krijgt ook `bsi::ifc::class` met de IFC 4.3-klasse, zodat andere programma's zien wat het is.

| Planningsgegeven | Node | Attributen |
|---|---|---|
| Project/werkplan | `/<plan-uuid>` | `bsi::ifc::class: IfcWorkPlan`, `ops::project` (naam, statusdatum, opties, profiel), `ops::document` (`formatVersion`) |
| Taak | `/<taak-uuid>` | `bsi::ifc::class: IfcTask`, `ops::task` (alle taakvelden, ook `elementLinks`) |
| Relatie | `/<rel-uuid>` | `bsi::ifc::class: IfcRelSequence`, `ops::relation` (voorganger, opvolger, type, lag) |
| Kalender | `/<kal-uuid>` | `bsi::ifc::class: IfcWorkCalendar`, `ops::calendar` |
| Resource | `/<res-uuid>` | `bsi::ifc::class: IfcConstructionResource` (subtype), `ops::resource` |
| Toewijzing, baseline, activiteitscodes, overige projectdata | onder de taak of het plan | `ops::assignment`, `ops::baseline`, … |

- Paden zijn UUID's. De UUID is dezelfde 128 bits als de IFC-GlobalId van hetzelfde object. Een taak heeft
  dus in STEP en in IFCX dezelfde identiteit.
- Hiërarchie (WBS) via `children` van plan en samenvattingstaken.
- Bron van de velden: `DOCUMENT_FIELDS` (`src/state/documentContract.ts`). Een test eist dat elk veld dat in
  IFC4X3 round-tript, ook in IFCX round-tript. Zo kan IFCX nooit stil achterlopen.

### 5.3 Openen van een IFCX van een ander programma

- Alleen `ops::`-gegevens worden planning. `openaec::activity` van ifcx-explorer lezen we in een latere stap
  (§9, besluit 3).
- Een bestand zonder `ops::`-gegevens en zonder model opent als leeg project met de projectnaam uit de kop.

## 6. IFCX: het model behouden

Dit is eenvoudiger dan bij STEP, omdat IFCX-nodes los van elkaar staan.

- **Eigen** = de entries met een `ops::`-attribuut. Al het andere is vreemd en blijft als JSON-waarde bewaard,
  in de oorspronkelijke volgorde.
- **Nooit op een vreemd pad schrijven.** De app zet geen attribuut op een wand. Een koppeling staat op de taak
  (`ops::task.elementLinks` = paden van bouwdelen). Dat volgt ifcx-explorer (`openaec::links` op de werkpakketten).
- **Aanhangsels** (§4.3) bestaan ook hier: een entry van een ander programma op het pad van een taak, zonder
  `ops::`-attribuut. Die blijft bewaard; vervalt de taak, dan vervalt het aanhangsel met een melding.
- Bij opslaan: kop (bijgewerkte `timestamp`) → vreemde entries ongewijzigd → eigen entries. Eigen entries staan
  achteraan, dus bij gelijke paden winnen ze (regel "later wins").
- Byte-gelijk is hier niet haalbaar: JSON opnieuw schrijven verandert spaties en volgorde van sleutels.
  De belofte is: **inhoudelijk gelijk**. De zelfcontrole vergelijkt elke vreemde entry als JSON-waarde.
  Optie voor later: de originele tekst per entry uit de bron snijden, net als bij STEP.
- Geen omzetting van het model tussen STEP en IFCX. *Opslaan als* in het andere formaat kan alleen als
  "planning zonder model", met een vraag vooraf die dat zegt.

**Losse planningslaag (optie, niet in de eerste fase).** IFCX kan een planningsbestand maken dat het
modelbestand als laag importeert (`imports: [{ uri: <model> }]`), zoals ifcx-explorer met een manifest doet.
Hoe een lezer een `uri` naar een bestand vertaalt, ligt in het formaat nog niet vast. Daarom eerst één bestand.

## 7. Bestanden, dialogen en keuzes

- `formatRegistry.ts`: een nieuw formaat `ifcx` (`extensions: ['ifcx']`, `kind: 'text'`, `canBeSaveTarget: true`).
- Tauri-bestandskoppeling (`src-tauri/tauri.conf.json`) en de dialogfilters krijgen `.ifcx`.
- *Projectinstellingen → bestandsformaat*: `IFC 4.3 ADD2 (standaard)`, `IFC 4.3`, `IFC4`, `IFCX (alfa)`.
  `IFC4X3_ADD2` blijft de standaard (eis uit #804).
- De vraag bij opslaan krijgt het geval "geopend als IFCX, opslaan als IFC" en omgekeerd.
- Feature flag `ifcx` met `writesNewIfcData: true` tot de round-trip compleet is (conventie in `AGENTS.md`).
  Het behoud van een STEP-model (§4) krijgt **geen** flag: het vervangt een weigering en verliest niets.

## 8. Fasen en inschatting

| Fase | Inhoud | Omvang | Risico |
|---|---|---|---|
| 1 | STEP-scanner + indeling + verliesbewaking, eerst alleen lezen en "opslaan zonder wijziging = vreemd deel byte-gelijk". Testcorpus. | 2 PR's | middel: de indeling (§4.2) bij vreemde planning |
| 2 | STEP-modelmodus compleet: aanhangsels, `elementLinks`, schema vast, herstel met verwijzing, melding, handleiding. Weigering 110 eruit. | 3 PR's | middel |
| 3 | IFCX planning zonder model, achter de flag: profiel `ops::` 1.0.0, lezer, schrijver, dialogen, keuze, round-trip STEP↔IFCX. | 4–6 PR's | hoog: veel velden, formaat nog alfa |
| 4 | IFCX met model: vreemde entries, aanhangsels, zelfcontrole. Flag eraf als 3+4 compleet zijn. | 1–2 PR's | laag na 1–3 |
| 5 (later) | Model achteraf koppelen, losse planningslaag, `openaec::activity` lezen/schrijven, #748-viewer. | apart | — |

Hoe moeilijk: fase 1–2 is goed te doen. Het lastige is de indeling eigen/vreemd bij bestanden van Bonsai of
Synchro die zelf al planning bevatten. Fase 3 is het meeste werk, niet het moeilijkste: elk veld van het
planningsmodel moet een plek krijgen. Het grootste risico van IFCX is extern: het formaat is alfa en kan
brekend veranderen. Daarom het eigen profiel met een versienummer en de flag.

## 9. Tests

- **Corpus** (in `tests/fixtures/ifc-models/`, klein gehouden): een IFC4-model en een IFC4X3-model zonder planning
  (buildingSMART-voorbeelden), een 4D-bestand met taken gekoppeld aan bouwdelen (Schependomlaan, als de licentie
  het toestaat; anders een eigen bestand uit Bonsai), een model met vreemde psets op taken, een IFC2X3-model.
  Plus de IFCX-voorbeelden `Hello Wall` en één grotere uit IFC5-development.
- `check-ifc-model-preserve.ts`: openen → opslaan zonder wijziging → vreemd deel byte-gelijk; openen → taak
  toevoegen, taak verwijderen → vreemd deel byte-gelijk, aanhangsels juist, melding juist.
- `check-ifcx-roundtrip.ts`: elk voorbeeldproject (`public/examples`) IFC → IFCX → IFC zonder verschil in het
  planningsmodel; en het veldentest uit §5.2.
- Validatie buiten de app in een eigen workflow (zoals `headless-api.yml`): IfcOpenShell `validate` op de
  uitvoer van STEP, en de TypeScript-validator van IFC5-development op de IFCX-uitvoer.
- `measure:large-plans` uitbreiden met een groot model (bijvoorbeeld 150 MB): openen, opslaan, geheugen.

## 10. Open besluiten

Elk besluit leg ik apart aan Ethan voor, met voorbeeld en aanbeveling.

1. **Namespace**: `ops::` (aanbevolen, volgt `ocss::`/`oses::`) of `openaec::planner::`.
2. **IFCX-belofte bij een model**: "inhoudelijk gelijk" (aanbevolen voor de eerste versie) of "byte-gelijk"
   (meer werk: eigen JSON-snijder).
3. **`openaec::activity`/`openaec::links` meeschrijven** zodat ifcx-explorer de planning toont: ja als afgeleide
   kopie die de app nooit terugleest (aanbevolen, fase 5), of niet.
4. **Grens voor modelgrootte**: 400 MB (voorstel) of anders.
5. **Fase 1–2 eerst los uitbrengen** (STEP met model, zonder IFCX): aanbevolen, want het lost knownbug 110 op
   zonder op IFCX te wachten.

## 11. Bronnen

- Issue #804 (DutchSailor, 2026-11-02); issue #748 (4D-workflow, criterium 3: "geen stil verlies").
- Knownbug 110 / PR #547: commit `5dfabb38b` "Weiger IFC-bouwmodellen vóór verliesgevende import".
- `src/services/ifc/ifcReader.ts:178-185`, `ifcWriter.ts:317-416`, `src/state/documentContract.ts:298`,
  `src/services/recovery/recoverySnapshotInput.ts`, `src/services/formatRegistry.ts:142`.
- IFC5-development `schema/ifcx.tsp`, `src/ifcx-core/composition/compose.ts`, `src/ifcx-core/layers/layer-stack.ts`,
  `examples/Hello Wall/`.
- IFCCAD `docs/preservation.md`, `docs/experiments/ifccad-document-lifecycle.md`, `docs/alpha-compatibility.md`.
- ifcx-explorer `examples/reference-school/planning/work-packages.ifcx`, `schemas/openaec-reference.ifcx`,
  `crates/ifcx-project/src/graph.rs`.
- Open-Calculations-Studio `packages/core/src/ifcx/namespace.ts`, `identiteit.ts`.
- open-bim-studio `exchange/ifcx/bim_ifcx.dl`.
