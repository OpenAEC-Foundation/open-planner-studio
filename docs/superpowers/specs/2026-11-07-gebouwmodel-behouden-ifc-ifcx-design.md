# Gebouwmodel behouden in IFC en IFCX — ontwerp

Status: ontwerp, versie 4 (7 november 2026, na council-ronde 3). Wordt in dezelfde sessie gebouwd.
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
| **ifcx-explorer** | Planning als eigen laag: `openaec::activity` (`start`, `endExclusive`, `status`, optioneel één `predecessor`, `crates/ifcx-reference/src/lib.rs:96-102`) en `openaec::links` (`relation: "schedules"`, `target: /elements/<32 hex>`). Paden met voorloop-`/`. Weigert stille botsingen tussen lagen (`graph.rs:40-44`). | Er is een ecosysteem-vorm voor "taak plant element". Wij schrijven nooit op paden van een ander. |
| **Open-Calculations-Studio** | Namespace `ocss::`: afkorting van het programma, dan het onderwerp (zus `oses::`). Schema's compleet in elk bestand. UUID en IFC-GlobalId zijn dezelfde 128 bits (`identiteit.ts:4-9`). | Namespace `ops::`, één identiteit voor STEP en IFCX. |
| **open-bim-studio** | `ifcx_alpha`, `dataVersion 1.0.0`, imports ifc@v5a/prop@v5a/usd@v1, namespace `openbim::`. | Bevestigt de gangbare kop en imports. |
| **ifcx-rs**, **wfc5** | Rust-kern zonder behoud van onbekende sleutels (vermoed); wfc5 is een eigen formaat. | Niet gebruiken. |

## 3. Het principe

Er is **één** lees- en schrijfroute voor elk IFC4/IFC4X3-bestand, met of zonder model.

- De app leest de bron als **bytes** en deelt elk stuk in een klasse in (§4.2).
- Bij opslaan schrijft de app de **eigen planning (P)** opnieuw met de bestaande writer. Alle andere stukken komen
  **byte-gelijk** terug, met hun eigen `#id` en op hun plek.
- Het **vreemde deel** is elk stuk dat niet P is. Een eigen planningsbestand van de app is 100 % P. Dan is de uitvoer
  precies wat de app nu schrijft, ook de kop (doel 5). Een test bewijst dat voor elk voorbeeldbestand, voor uitvoer
  van oudere releases en voor elke uitvoer van de writer (§10). Die test is de poort van fase 0.
- Na een geslaagd opslaan is de uitvoer de nieuwe bron (§4.8).

Waarom niet de alternatieven:

- *Volledig IFC-objectmodel* (web-ifc, IfcOpenShell-WASM): groot, traag, en het herschrijft ook vreemde regels.
- *Model in een los bestand en extern samenvoegen* (ifcpatch `MergeProjects`): de huidige werkwijze. Dan werkt de app
  niet met gebouwmodellen.
- *Ongewijzigde planningsobjecten byte-gelijk terugschrijven*: vraagt een betrouwbare koppeling van elk hulpstuk aan de
  bron. Die is er niet (de writer-sleutels zijn niet uniek, `ifcWriter.ts:1160-1167`, `ifcPsets.ts:381-394`). De planning
  wordt daarom altijd opnieuw geschreven. Wat de writer niet kent, wordt per slot bewaard (§4.5).

## 4. IFC (STEP)

### 4.1 Stukken

Een **stuk** is een entiteit-instantie van `#` tot en met de `;` die haar afsluit, plus alle tekst ervóór sinds het
vorige stuk: witruimte, regeleinden (ook CRLF) en commentaar. De kop (`HEADER; … ENDSEC;`), `DATA;` en de staart
(`ENDSEC; END-ISO-10303-21;`) zijn aparte stukken. Elk byte van de bron valt in precies één stuk. Complexe instanties
`#n=(A(..)B(..));` zijn ook stukken (de huidige `readEntity` slaat ze over, `ifcReader.ts:982-985`).

Met een vreemd deel blijft de kop **helemaal** byte-gelijk, ook `FILE_NAME` en `FILE_SCHEMA`. Zonder vreemd deel
schrijft de writer de kop zoals nu.

### 4.2 Indeling

**Index.** De scanner levert per stuk: `#id`, type (of "complex"), de uitgaande `#`-verwijzingen met hun
argumentpositie, argument 0 als ruwe ASCII-tekst (de GlobalId van een `IfcRoot`), en voor psets en templates `Name`.
Daaruit bouwt hij ook de **inkomende** verwijzingen (wie verwijst naar mij). De indeling is een pure functie van deze
index en draait vóór de lezer.

**Begrippen.**

- **W** — de typen die de writer schrijft (een gesloten lijst, afgeleid uit `ifcWriter.ts` en de helpers; een test
  houdt hem gelijk aan de writer).
- **Objectleden** van een relatie — de argumenten `Relating*` en `Related*` (niet `OwnerHistory`, niet `TimeLag`).

**Stap 1 — domeinobjecten D.** `selectPlanning(index)` geeft precies de objecten die de lezer tot domeingegevens
maakt. Dezelfde functie gebruikt de lezer, zodat indeling en lezer niet uiteen kunnen lopen. Ze neemt de huidige
regels letterlijk over:

- elk `IfcWorkPlan`;
- de werkschema's en taken zoals de lezer ze nu kiest: alle `IfcTask` buiten de baselinebomen (`ifcReader.ts:1749`);
  baselinebomen worden alleen uitgesloten als er een live-schema met minstens één taak is; anders zijn de
  baselinetaken de planning (`collectBaselineTaskStepIds`, `:3570-3612`, #336). Losse taken buiten een schema horen erbij;
- **alle** resources (`IFC_TO_RESOURCE_TYPE`) en **alle** `IfcWorkCalendar`'s, zoals de lezer nu;
- de baselineschema's die de lezer tot een domeinbaseline maakt (de eigen baselines: een `BASELINE`-schema onder het
  werkplan, `ifcWriter.ts:469-483`). Een baseline die de lezer niet leest (bijvoorbeeld van Bonsai), is geen D.

**Stap 2 — eigen relaties R.** Een relatie is R als ze past op een van de zeven patronen die de writer schrijft, en
anders niet:

| Type | Patroon (objectleden) |
|---|---|
| `IfcRelNests` | ouder en kinderen in D (taken, schema's, ploegen) |
| `IfcRelAssignsToControl` | relating = schema in D, related ⊆ taken in D |
| `IfcRelAssignsToProcess` | relating = taak in D, related ⊆ resources in D |
| `IfcRelSequence` | relating en related = taken in D |
| `IfcRelAggregates` | relating = werkplan in D, related ⊆ schema's in D |
| `IfcRelDeclares` | relating = het `IfcProject`, related ⊆ templates met een `OPS_`-naam |
| `IfcRelDefinesByProperties` | related ⊆ D ∪ {het `IfcProject`}, pset met een `OPS_`-naam |

Een relatie die niet past (een pset van Bonsai, `IfcRelDeclares` project→werkplan van IfcOpenShell, een rel met taken én
wanden), is geen R.

**Stap 3 — eigen afsluiting Own.** Own is alles wat vooruit bereikbaar is vanuit D ∪ R, alleen via stukken met een
type in W. Hiermee horen psets, properties, `IfcLagTime`, templates, owner histories, `IfcTaskTime`, tijden en perioden,
en het `IfcProject` met zijn units en context bij Own als alleen eigen stukken ernaar wijzen.

**Stap 4 — gedeelde context.** Ext is alles wat vooruit bereikbaar is vanuit elk stuk **buiten** Own, plus de doelen
van verwijzingen in bewaarde slot-tokens (§4.5). Ext loopt door tot het einde: ook de persoon, organisatie en
applicatie achter een gedeelde owner history horen erbij.

**Uitkomst.**

| Klasse | Definitie | Lezer | Schrijver |
|---|---|---|---|
| **P** | D ∪ R ∪ (Own − Ext) | leest | schrijft opnieuw (§4.3–4.5) |
| **C** | (Own ∩ Ext) − D − R | leest (alleen lezen) | byte-gelijk; P verwijst ernaar |
| **A** | buiten Own, met een verwijzing naar een P-stuk | leest alleen `IfcRelAssignsToProcess`/`IfcRelAssignsToProduct` (§4.6) | byte-gelijk, tenzij een P-doel verdwijnt (§4.7) |
| **V** | de rest | leest niet | byte-gelijk |

Gevolgen:

- Een eigen bestand: alles is Own, Ext is leeg, dus 100 % P.
- Een model zonder planning: D en R zijn leeg, dus alles is V, ook het `IfcProject`. De lezer leest het `IfcProject`
  (er is er precies één) altijd als context, ook als het V is; de writer hangt de nieuwe planning eraan. Na het eerste
  opslaan verwijst een eigen R-stuk ernaar (`OPS_ProjectSettings`), en is het C.
- Nagerekend met een script dat deze vier stappen letterlijk uitvoert (fase-0-voorproef, 7 november 2026): alle
  `public/examples/*.ifc`, `examples/*.ifc` en `docs/superpowers/evidence/*.ifc` geven 100 % P; `hello-wall.ifc`,
  `domestic-hot-water.ifc`, `Railway_project_simple_IFC4X3.ifc` en `TeklaHouse.ifc` (19 MB, 224.496 entiteiten) uit
  IFC5-development geven 100 % V.
- Een model met eigen planning (eerder door de app opgeslagen): het `IfcProject` is C (het model wijst ernaar), de eigen
  owner history is P (alleen eigen stukken wijzen ernaar) en wordt dus elke keer vervangen, niet opgestapeld.
- Een A-stuk wijst alleen naar D of R (stukken met een stabiel `#id`, §4.3). Wijst een vreemd stuk naar een hulpstuk,
  dan is dat hulpstuk in Ext, dus C, en blijft het staan.
- Lezen en schrijven zijn apart geregeld: de lezer mag een A-stuk lezen zonder dat de app het bezit.

### 4.3 Identiteit en ids

- Elk D- en R-stuk houdt bij opslaan zijn `#id` als het object nog bestaat. De koppeling loopt via een expliciete kaart
  **domein-id → bron-`#id`** (de lezer heeft al `taskStepIdMap` en `resourceStepIdMap`). Zo blijven ook twee objecten
  met dezelfde GlobalId uit elkaar (de lezer maakt daar `-dup-N`-ids van, `ifcReader.ts:466-468`; de writer geeft de
  tweede een nieuwe GlobalId, `ifcWriter.ts:244-253`).
- Een R-stuk koppelt via zijn objectleden (bijvoorbeeld "sequence van taak X naar taak Y", "toewijzingen van taak X").
- Alle andere P-stukken (hulpstukken) krijgen nieuwe ids vanaf het hoogste id dat in de uitvoer behouden blijft, plus 1.
  Niets buiten P wijst naar een hulpstuk (§4.2), dus nieuwe ids breken geen verwijzing.

### 4.4 De writer met een vreemd deel

- Geen eigen `IfcProject`, units en geometrische context als het project C is. De sleutel `_project` wijst naar het C-id.
- Eigen owner history, persoon, organisatie en applicatie: wel; die zijn P en worden elke keer vervangen.
- Projectnaam en beschrijving: de writer zet ze al in `IfcWorkPlan.Name`/`Description` (`ifcWriter.ts:453`). Is het
  project C, dan leest de lezer de naam eerst uit het werkplan. Auteur en bedrijf komen als nieuwe properties in
  `OPS_ProjectSettings` (blijft op het project, `ifcWriter.ts:676-694`), met terugval op de owner history.
- Eenheden: de lezer leest niets uit `IfcUnitAssignment` (nagelopen); de writer voegt niets toe aan die van het model.
- Regeleinde: dat van de bron. Uitvoer: een lijst `Uint8Array`-delen, geen grote string.

### 4.5 Planning van een ander programma (Bonsai, Synchro)

Een taak uit Bonsai of Synchro is P en wordt dus opnieuw geschreven. Wat de writer niet kent, mag daarbij niet stil
verdwijnen.

- De lezer bewaart voor elk D-object (sleutel: bron-`#id`) **alle** ruwe slot-tokens en het entiteittype, in
  `ifcSource.sourceSlots`. Voor `IfcTaskTime` en `IfcLagTime` (geen GlobalId) is de sleutel het `#id` van de eigenaar.
- Elke schrijf-descriptor krijgt het brontoken als invoer en beslist zelf. De regels:
  - **Letterlijk slot dat de lezer niet vertaalt** (bijvoorbeeld `LongDescription`, `WorkMethod`): brontoken.
  - **Domeinslot**: is het domeinveld gelijk aan de waarde die de lezer uit dit token las, dan het brontoken (een
    Bonsai-`Status` of een schemanaam blijft zo staan); anders de nieuwe waarde.
  - **Afhankelijke slots** (bijvoorbeeld `ObjectType`, verplicht bij `USERDEFINED`, `ifcTaskSlots.ts:333-338`): de
    descriptor schrijft ze samen, zodat de combinatie geldig blijft.
  - **Verwijzingsslot** (`OwnerHistory`, `TaskTime`, `Creators`, `Recurrence`): de writer schrijft zijn eigen verwijzing.
    Behoudt hij toch een brontoken met een `#`, dan is het doel een startpunt van Ext (§4.2) en blijft het staan.
- Het entiteittype komt uit de bron als het domein het niet onderscheidt (een `IfcConstructionProductResource` blijft
  dat, `ifcConstants.ts:52-56`).
- Descriptortabellen: `IfcTask` en `IfcTaskTime` hebben ze al (`ifcTaskSlots.ts:94, 324`). Fase 2 maakt ze voor
  `IfcWorkPlan`/`IfcWorkSchedule` (nu index-helpers in `ifcWorkControlSlots.ts:45-86` en `workControlArgs` in de writer),
  `IfcWorkCalendar`, de resources en `IfcRelSequence`/`IfcLagTime` (nu vaste sjablonen, `ifcWriter.ts:1268, 1675`).
- Wat dan nog verloren gaat, meldt de app bij openen in een lijst. Bekend: extra werkschema's worden samengevoegd tot
  één; GlobalIds van relaties en psets van een ander programma worden bij het eerste opslaan nieuw (de writer maakt ze
  uit een vaste seed, `ifcWriter.ts:506, 552, 1836`); vreemde vormen van tijdsperioden. Zo presenteert de app de overname
  niet als verliesvrij (les van IFCCAD).

### 4.6 Koppelingen taak↔bouwdeel en toewijzingen

`IfcRelAssignsToProcess` en `IfcRelAssignsToProduct` met producten erin zijn A. De lezer parseert juist deze A-stukken
met de bestaande `parseSTEP` (een kleine set; de lezer kent `IfcRelAssignsToProduct` nu niet).

- Afgeleide, alleen-lezen weergave per taak: `elementLinks: { direction: 'input' | 'output', target }[]`. `target` is een
  GlobalId (STEP) of een pad (IFCX, §6.4). Bij Bonsai: `ToProcess` = input, `ToProduct` = output. Geen domeinveld, geen
  documentveld; het hoort bij `ifcSource`.
- Taakpaneel: "Gekoppeld aan 12 bouwdelen" (alleen lezen). MCP: veld in `planner_get_task`. Een doel dat niet in het
  bestand staat, toont "niet gevonden".
- **Gemengde rel** (resources en producten in één `IfcRelAssignsToProcess`): de lezer leest de resource-leden als
  toewijzingen. Zijn de toewijzingen van die taak bij opslaan ongewijzigd, dan schrijft de app geen eigen rel en blijft het
  stuk byte-gelijk. Zijn ze gewijzigd, dan haalt de app de resource-leden uit het stuk (wijzigingslijst) en schrijft hij
  een eigen rel.

### 4.7 Een P-object is verwijderd

Een A-stuk verwijst naar een D- of R-stuk dat in de uitvoer niet meer bestaat. Dan geldt één algemene regel:

1. De verwijzing staat in een lijst: alleen dat lid gaat eruit.
2. De lijst wordt leeg, of het is een enkele verwijzing: het hele stuk vervalt.
3. Een stuk dat naar een **vervallen** stuk verwijst, valt onder dezelfde regel (herhalen tot niets meer verandert).
4. Een stuk waar een vervallen stuk naar verwees, blijft staan (een losse pset is geldig IFC).

Elk gewijzigd of vervallen vreemd stuk staat in de **wijzigingslijst** (id, oude bytes, nieuwe bytes of "vervallen").
Of een attribuut optioneel is, toetst de app niet zelf; `ifcopenshell.validate` in CI vangt de rest (§10). Melding na
opslaan, via het meldingenkanaal: "3 gegevens van andere programma's hingen aan verwijderde taken of resources. Ze zijn
aangepast of verwijderd."

**Ongedaan maken na opslaan.** De app bewaart elk vervallen of gewijzigd vreemd stuk (oude bytes), en de `sourceSlots` en
`elementLinks` van verdwenen objecten, in `ifcSource.detached`, zolang het document open is. Komt een object met dezelfde
domein-id terug (Ctrl+Z, ook na opslaan), dan zet de writer bij het volgende opslaan die stukken terug, met de
verwijzing naar het huidige `#id` van het object (wijzigingslijst). Zo verliest Ctrl+Z na opslaan niets. Na sluiten van
het document vervalt `detached`; dan kan ook Ctrl+Z het object niet meer terugbrengen.

### 4.8 `ifcSource`: waar de bron woont

- Nieuw documentveld `ifcSource` met rol `snapshot: 'none'`, zoals `xerSourceArchive` (`documentContract.ts:298`).
  Niet in undo (§4.7 regelt undo na opslaan).
- Inhoud: de bronbytes (`Uint8Array`), sha256, de kopnaam van het schema (ook `IFC4X3_ADD1`/`TC1`), de stukkenindex
  (`Uint32Array`), de klasse per stuk, de kaart domein-id → bron-`#id`, de A-verwijzingen, `sourceSlots`,
  `elementLinks`, `detached`, het totaal aantal vreemde objecten voor de melding.
- **Na een geslaagd opslaan** vervangt de app `ifcSource` door de uitvoer (die de controles al gescand hebben), in
  **dezelfde** `set()` die de dirty-vlag wist. `ifcSource` staat niet in `IFC_SAVE_KEYS`; de vergelijking voor AutoSave
  (`sameIFCSource`, `ifcSaveInput.ts:135`) kijkt naar de sha256, zodat AutoSave niet blijft schrijven.
- **Eigenaar van de bytes**: de hoofdthread, in `ifcSource`. De scanner draait synchroon (ook in Node en in het herstel)
  of krijgt in een Worker een kopie. Het samenvoegen bij opslaan gebeurt op de hoofdthread met `subarray`, zonder kopie.
  Fase 0 meet of dat bij 150 MB de UI te lang blokkeert; zo ja, dan krijgt een Worker een kopie.
- Geen vreemd deel (nieuw project, eigen bestand, import uit CSV/MSPDI/XER): `ifcSource = null`, de huidige route.

### 4.9 Lezen

1. **Openen als bytes.** Elke open-route voor IFC leest bytes: Openen (`tauriBackend.ts:22`, `webBackend.ts:124`,
   `siteBackend.ts:43`), Recent (`tauriBackend.ts:87-90`, `fileSlice.ts:1658`) en externe bronnen
   (`parseExternalSource`, `fileSlice.ts:1500`). De grootte wordt vóór het lezen gecontroleerd (§4.13).
   `openExampleFromString` (voorbeelden, `helpApi.ts:104`, `useDemoStartExample.ts:49`, `qaScenes.ts:89`) blijft tekst:
   het zijn eigen bestanden in UTF-8. Een voorbeeld met een model (`bouwmodel-ifc4.ifc` in de QA-scènes) gaat via
   dezelfde route met `TextEncoder`; dat is byte-gelijk voor geldige UTF-8.
2. **Scanner** op `Uint8Array` (alle STEP-syntaxis is ASCII), met de index uit §4.2.
3. **Indeling** (§4.2).
4. **Lezer**: de P-, C- en gekozen A-stukken worden gedecodeerd (STEP-strings, UTF-8) en gaan door de bestaande
   `parseSTEP` en lezer.

### 4.10 Vóór opslaan: de verliesbewaking

De writer schrijft: alle niet-P-stukken in bronvolgorde (A volgens de wijzigingslijst), dan de P-stukken, dan de staart.
Daarna, vóór het wegschrijven, scant de app de uitvoer opnieuw met de scanner. Twee controles:

1. **Vreemd deel.** Elk niet-P-stuk van de bron staat in de uitvoer met hetzelfde `#id`, dezelfde bytes en in dezelfde
   volgorde, op de wijzigingslijst na. Er komt geen niet-P-stuk bij, en geen `#id` komt twee keer voor. Directe
   vergelijking van bytes. Deze controle vergelijkt de scan van de uitvoer met de index van de bron; ze vangt een fout
   van de writer. Een fout van de scanner zelf vangt controle 3.
2. **Planning.** Twee herlezingen moeten gelijk zijn:
   `planningCanon(read(samengevoegde uitvoer)) === planningCanon(read(writeIFC(dezelfde invoer, zonder vreemd deel)))`.
   Beide lopen door dezelfde writer, dus de normalisatie bij laden speelt geen rol. `planningCanon` is nieuw, in `src/`:
   sleutel = de stabiele domein-ids (afgeleid uit de GlobalId, `stableIdFromGuid`), toewijzingen op (taak, resource),
   met een vaste lijst toegestane normalisaties. De bestaande `canon` van `check-ifc-roundtrip.ts` sleutelt op WBS-code en
   naam (`:852-881`) en is daarom niet geschikt. Daarnaast: er komen geen loze verwijzingen en geen dubbele GlobalIds
   **bij** ten opzichte van de bron (een bron met dubbele GlobalIds blijft dus op te slaan).

Faalt een controle, dan schrijft de app niets. De melding biedt een uitweg: *Exporteren zonder gebouwmodel*.

3. **Alleen in CI**: IfcOpenShell vergelijkt invoer en uitvoer onafhankelijk: alle niet-P-entiteiten op `#id`, type en
   attributen (ook geometrie zonder GlobalId), en de planning via het domein. Plus `ifcopenshell.validate` (§10).

### 4.11 Schema

- Het schema komt uit de kop van de bron en verandert niet. De kopnaam staat in `ifcSource`. `Project.ifcSchema` (drie
  waarden) blijft voor bestanden zonder vreemd deel. Met een vreemd deel staat de keuze in *Projectinstellingen* uit, met
  de reden, en de schemavraag bij opslaan vervalt. AutoSave (`ifcSchemaBlocksSilentWrite`, `useAutoSave.ts:143`) leest
  dan `ifcSource`.
- Herkende kopnamen: `IFC4`, `IFC4X3`, `IFC4X3_ADD1`, `IFC4X3_ADD2`, `IFC4X3_TC1` (nu kent `readFileSchema` alleen drie,
  `ifcReader.ts:1105-1107`).
- **IFC2X3**: zonder `IfcProduct`/`IfcTypeProduct` de huidige route, zoals nu (#292): de planning opent, vreemde gegevens
  gaan bij opslaan verloren, en de app meldt dat bij openen. Mét een model: geweigerd, zoals nu. `IfcTask` en
  `IfcWorkCalendar` zijn in IFC2X3 anders; een mengsel is ongeldig. Een onbekend schema: ook geweigerd.

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
| MCP-backup | `backupService.ts:312` | P + verwijzing; de bron één keer per sha256 in de backupmap, als bytes, opgeruimd samen met de backups die ernaar wijzen. |
| MCP-bestandstools, `planner_export_ifc` | `mcp/tools/fileTools.ts` | Volledig bestand, zelfde controles. |
| IFC-werkruimte (paneel) | `IFCPanel.tsx:39-58` | Toont alleen de P-stukken, alleen lezen. *Toepassen* staat uit met een vreemd deel (nu zou `applyLoadedProject`/`payloadFromImport` het model laten vallen, `fileSlice.ts:898`). |
| Headless core | `core/index.ts:53`, `api.ts:120` | Nieuw: `openIfcBytes(Uint8Array)` en `toIfcBytes()`. `openIfc(text)`/`toIfc()` blijven en zijn alleen byte-gelijk voor geldige UTF-8 (staat in `docs/headless-kern.md`). Samenvatting krijgt `foreignContent: { format, schema, objectCount } \| null`. Contractwijziging. |
| Headless HTTP-API | `headless/server/server.mjs:269` | Accepteert en levert `application/octet-stream`; `openapi.yaml` bijwerken. |
| Headless MCP-server | `headless/mcp-server/src/{nodeFs.ts:358, backupFs.ts:35}` | Leest en schrijft bytes; synchrone scanner. |
| Site-opslag | `siteBackend.ts` | Bytes in en uit. |
| Voorbeelden | `openExampleFromString` | Tekst (§4.9). |
| Resourcebibliotheek | `libraryIfc.ts` | Ongewijzigd (nooit een vreemd deel). |
| Benchmark, dev-bridge | `benchmark/runner.ts`, `devBridge.ts:89-91` | Tekst, alleen voor ontwikkelaars. `devBridge.saveToPath` weigert een document met een vreemd deel. |

### 4.13 Grootte en geheugen

- Bronbytes één keer in het geheugen (§4.8). Uitvoer = verwijzingen naar de bron plus de P-stukken.
- De Tauri-app draait op WebKit (JavaScriptCore) op Linux en macOS en op WebView2 (V8) op Windows; de browserbuild op V8.
- Voorlopige grens: 150 MB, gecontroleerd vóór het volledig lezen. De echte grens volgt uit de meting in fase 0.

### 4.14 Herstel en een ontbrekende bron

- Herstel zet nu ook het bestandspad en het site-doel terug (`useRecoveryRestore.ts:90`). Zonder bron zou Ctrl+S het
  modelbestand overschrijven met alleen planning.
- Het herstelmanifest krijgt per document een verwijzing `ifcSource: { sha256, size }` (manifest versie 6,
  `recoveryManifest.ts:4`). De sha256 is die van de huidige bron: het bestand zoals het na het laatste opslaan op schijf
  staat. Opruimen houdt rekening met die verwijzing, zoals nu met `xerArchive` (`recoveryStore.ts:378`).
- **Tauri**: geen kopie. Herstel leest het oorspronkelijke pad opnieuw en controleert de sha256.
- **Browser met een bestands-handle**: ook geen kopie; herstel leest via de handle en controleert de sha256.
- **Browser zonder handle** (download, site, externe bron): een kopie in IndexedDB, één keer per sha256, asynchroon, vóór
  het manifest dat ernaar verwijst (volgorde van het XER-archief, `docs/xer-recovery-guardrails.md`). Na een nieuw
  opslaan ruimt de app de oude kopie op als geen manifest er meer naar wijst.
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

- **Eigen bestand** (geen vreemde entries): `ifcxVersion: "ifcx_alpha"`, `dataVersion: "1.0.0"` (de versie van deze
  dataset, zoals IFC5 het bedoelt), `id: "urn:openaec:planner:<project-uuid>"`, `author`, `timestamp` (ISO 8601).
- **Bestand met vreemde entries**: de kop blijft byte-gelijk, ook `timestamp`.
- `ifcxVersion` anders dan `ifcx_alpha`: openen geweigerd, met de gevonden waarde in de melding.
- **Versie van het OPS-profiel**: alleen `ops::document.formatVersion` op de planwortel. Een hogere hoofdversie dan de app
  kent: openen geweigerd ("gemaakt met een nieuwere versie van Open Planner Studio"). Een hogere tussenversie: openen
  mag; onbekende `ops::`-attributen blijven als vreemde bijdrage staan (§6.2).
- `imports` en `schemas` van de bron blijven staan. De app voegt `ifc@v5a` toe als die ontbreekt (voor `bsi::ifc::class`)
  en voegt haar eigen schema's toe (`ops::*`, en `openaec::activity` als die er nog niet is). Lezen heeft geen netwerk nodig.

### 5.2 Namespace, paden en nodes

Namespace `ops::` (open besluit 1). Elke eigen node krijgt ook `bsi::ifc::class` met de IFC 4.3-klasse.

- **Paden**: de UUID van het object, dezelfde 128 bits als de IFC-GlobalId. Een taak heeft dus in STEP en IFCX dezelfde
  identiteit. De buildingSMART-composer knipt op `/` (`path.ts:2-11`), ifcx-explorer gebruikt paden met een voorloop-`/`.
  Fase 0 opent een uitvoer in beide en kiest de vorm die in beide werkt. Uitgangspunt: kale UUID.
- **Eigen pad**: een pad met een van de eigen node-attributen (`ops::document`, `ops::project`, `ops::task`,
  `ops::relation`, `ops::calendar`, `ops::resource`, `ops::assignment`, `ops::baseline`, …; een gesloten lijst), of een
  pad dat de app zelf maakt.

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

- **Eigen bijdragen**: bekende `ops::`-attributen (de gesloten lijst uit §5.2 en hun velden); `bsi::ifc::class` en
  `openaec::activity` op eigen paden; `children` van eigen paden naar eigen paden. Al het andere is een vreemde bijdrage,
  ook een onbekend `ops::`-attribuut.
- Een entry zonder eigen bijdragen: **byte-gelijk**, op zijn plek.
- Een entry met alleen eigen bijdragen: opnieuw geschreven, **op dezelfde plek**.
- Een gemengde entry: de app schrijft hem op zijn plek terug zonder de eigen bijdragen, en zet de eigen bijdragen in een
  eigen entry **direct erna**. De vreemde attribuutwaarden en de vreemde `children`/`inherits` zijn byte-gelijke tokens;
  alleen de omlijsting van de entry (accolades, komma's) wordt opnieuw gemaakt. Omdat de eigen entry direct na de
  gemengde komt, verandert de voorrang tegenover alle andere entries niet (een latere vreemde `children.sub = null` houdt
  zijn werking).
- Nieuwe eigen entries komen achteraan.
- De app schrijft nooit iets op een vreemd pad.
- Vervalt een eigen pad (taak verwijderd), dan blijven vreemde bijdragen op dat pad byte-gelijk staan, zonder melding
  (een node met alleen vreemde attributen is geldige IFCX). Dat sluit aan bij §4.7 regel 4.

Voorbeeld van een gemengde entry, vóór en na opslaan (de taak is hernoemd):

```json
{"path":"0f2c…","attributes":{"ops::task":{"name":"Fundering"},"openaec::label":"F1"}}
```
wordt
```json
{"path":"0f2c…","attributes":{"openaec::label":"F1"}},
{"path":"0f2c…","attributes":{"ops::task":{"name":"Fundering en kelder"},"bsi::ifc::class":{…}}}
```

### 6.3 Controles

1. **Vreemd deel**: elke entry zonder eigen bijdragen is byte-gelijk en staat in dezelfde volgorde; elke gemengde entry
   heeft dezelfde vreemde tokens; kop, `imports` en `schemas` van de bron zijn byte-gelijk op de eigen toevoegingen na.
2. **Planning**: twee herlezingen, zoals §4.10.
3. **Compositie, twee keer**: (a) alle eigen bijdragen uit §6.2 eruit, dan samenstellen volgens IFC5 `compose.ts`: bron en
   uitvoer geven dezelfde vreemde compositie (lege nodes die alleen eigen bijdragen hadden, tellen niet mee). (b) de
   volledige compositie van de uitvoer: voor elke vreemde bijdrage is het effect (een waarde, of een `null` die iets
   verwijdert) hetzelfde als in de volledige compositie van de bron, tenzij hij een vervallen eigen pad raakt.

### 6.4 Koppelingen in IFCX

`openaec::links` met `relation: "schedules"` op een eigen pad leest de lezer als `elementLinks` met richting `output` en
`target` = het pad. Is het laatste segment 32 hexadecimale tekens, dan rekent de app er een GlobalId uit (dezelfde 128
bits, zoals in Open-Calculations-Studio `identiteit.ts`); anders blijft alleen het pad. Een eigen `ops::task` heeft geen
koppelingen; die komen pas met #748.

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
  Zolang `ifcForeignContent` uit staat, blijft de weigering van PR #547 actief en gaat elk bestand de huidige route. Bij
  oplevering gaan beide flags eraf, in de PR die het aanzet (conventie in `AGENTS.md`).

## 8. Fasen en inschatting

| Fase | Inhoud | Omvang | Risico |
|---|---|---|---|
| 0 | **Haalbaarheidsproef** op het corpus (§10): scanner met inkomende verwijzingen, `selectPlanning`, indeling, de 100 %-P-poort, lezen als bytes, meting van tijd en geheugen (50/150/300 MB, Linux-WebKit en Chromium), controle met IfcOpenShell. Beantwoordt de vragen in §11. | 1 PR (tests en scripts) | — |
| 1 | Bytes-openroutes, scanner, indeling, `ifcSource`, lezer met C-context, writer met behouden ids, controles 1 en 2 met `planningCanon`, `ifcSource` vernieuwen na opslaan. Achter de flag. | 3 PR's | hoog |
| 2 | `sourceSlots` en de vijf nieuwe descriptortabellen, A-stukken bij verwijderen, `detached` voor undo, gemengde rels, `elementLinks`, alle routes uit §4.12 (ook headless bytes), herstel met manifest 6 en "bron ontbreekt", meldingen, handleiding. Flag eraf, weigering eruit (laatste PR). | 4–6 PR's | middel-hoog |
| 3 | IFCX-planning zonder vreemde inhoud: profiel `ops::` 1.0.0, schema's, lezer, writer, `openaec::activity`, dialogen, keuze, vraag bij opslaan, round-trip STEP↔IFCX. Achter de flag. | 4–6 PR's | hoog: veel velden, alfa-formaat |
| 4 | IFCX met vreemde inhoud: tokenizer, eigendom per bijdrage, beide compositiecontroles, `openaec::links`. Flag eraf. | 2–3 PR's | middel |

Hoe moeilijk: dit is groot werk, ongeveer 15 tot 19 PR's. Het knippen zelf is niet het lastige deel. Het lastige deel is
waar de planning en de rest elkaar raken: de indeling, vreemde gegevens op taken, gemengde relaties, verwijderen en
undo, planning van andere programma's en herstel zonder bron. Daarom eerst fase 0 met echte bestanden en de
100 %-P-poort; daarna is de inspanning beter te schatten. Het grootste externe risico is IFCX zelf: het formaat is alfa en
kan brekend veranderen. Daarom een eigen profielversie.

## 9. Volgorde van de PR's

Elke PR gaat naar `main`, klein, met een review door GPT-6.1-Sol (BLOKKEERT/VERVOLG). `main` gaat elke zaterdag uit;
daarom staat alles achter de flags tot het compleet is.

## 10. Tests

- **Corpus** (`tests/fixtures/ifc-foreign/`, klein): een IFC4- en een IFC4X3-model zonder planning (buildingSMART-
  voorbeelden), een 4D-bestand met taken gekoppeld aan bouwdelen (Schependomlaan als de licentie het toestaat, anders een
  eigen bestand uit Bonsai), een Bonsai-bestand met twee werkschema's, een baseline en `IfcRelDeclares` naar het werkplan,
  vreemde psets op taken, een gemengde `IfcRelAssignsToProcess`, een gedeelde owner history tussen wanden en taken, een
  CRLF-bestand met commentaar, een Latin-1-bestand, complexe instanties, dubbele GlobalIds in de bron, een
  IFC2X3-planningsbestand en een IFC2X3-model. Plus `Hello Wall`, een groter IFC5-voorbeeld en IFCX-bestanden met een
  gemengde entry gevolgd door een vreemde `null`-child, een ontsnapte attribuutnaam en een groot geheel getal.
- **Poort: eigen bestanden = 100 % P.** Elk `public/examples/*.ifc`, de uitvoer van de writer voor elk voorbeeldproject,
  en uitvoer van oudere release-tags geven na indeling alleen P. De uitvoer is gelijk aan die van de huidige writer.
- `check-ifc-foreign-preserve.ts`:
  - openen → opslaan zonder wijziging → alle niet-P-stukken byte-gelijk; een tweede opslaan → niet-P weer byte-gelijk en
    de planning gelijk volgens `planningCanon` (P-stukken mogen andere hulp-ids en tijdstempels hebben);
  - taak toevoegen, wijzigen, verplaatsen onder een ongewijzigde ouder en verwijderen → vreemd deel byte-gelijk op de
    wijzigingslijst na, en die lijst klopt; gedeelde kalender;
  - verwijderen → opslaan → Ctrl+Z → opslaan: de vreemde stukken staan er weer;
  - herstel met bron op het oude pad, via een handle, met een kopie, en zonder bron ("bron ontbreekt" blokkeert opslaan).
- **Controles zelf testen**: een writer die bewust een vreemd stuk weglaat, verdubbelt of verschuift, moet door controle 1
  worden tegengehouden; `planningCanon` met dubbele namen en WBS-codes.
- `check-ifcx-roundtrip.ts`: elk voorbeeldproject IFC → IFCX → IFC zonder verschil volgens `planningCanon`; de veldentest
  uit §5.4; beide compositiecontroles.
- **Onafhankelijke controle in CI** (eigen workflow, zoals `headless-api.yml`): IfcOpenShell leest invoer en uitvoer en
  vergelijkt alle niet-P-entiteiten op `#id`, type en attributen, plus `ifcopenshell.validate`. De validator van
  IFC5-development controleert de IFCX-uitvoer.

## 11. Open punten

**Besluiten voor Ethan** (elk apart, met voorbeeld en aanbeveling):

1. **Namespace**: `ops::` (aanbevolen: volgt `ocss::`/`oses::`) of `openaec::planner::`.
2. **`openaec::activity` meeschrijven** zodat ifcx-explorer de planning toont: ja, als afgeleide kopie (aanbevolen), of niet.

**Vragen voor fase 0** (meting of proef, geen besluit):

- Klopt `selectPlanning` op echte Bonsai- en Synchro-bestanden? Is "meerdere werkschema's samenvoegen" acceptabel, of
  wordt dat een besluit voor Ethan?
- Hergebruikt IfcOpenShell gemengde `IfcRelAssignsToProcess`-relaties? Aggregeert Bonsai baselines onder het werkplan?
- Delen IfcOpenShell en Bonsai owner histories en `Creators` tussen model en planning?
- Hoe groot mag een model zijn (tijd, geheugen, UI-blokkering)?
- Welke padvorm werkt in de buildingSMART-composer én in ifcx-explorer?

## 12. Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |
| 2 (v2) | 6 | 6 | 7 |
| 3 (v3) | 6 | 6 | 8 |

Na ronde 1: één route met klassen; lezen en knippen als bytes; projectgegevens als context; tabel van alle routes;
"bron ontbreekt"; IFCX-kop van een ander blijft; profielversie in `ops::document`; eigendom per attribuut; volgorde
behouden; grens te meten; fase 0; flags.

Na ronde 2: bereikbaarheid en `selectPlanning`; C-project ook zonder planning; lees- en schrijfrecht apart; scanner met
argumentposities en GlobalId; "ongewijzigd = bronstuk" geschrapt; slot-tokens; controle 1 op de scan van de uitvoer;
`ifcSource` vernieuwd na opslaan; eigenaar van de bytes; herstel met manifest 6; bytes-contract voor headless; IFCX-tokens
per bijdrage, ontsnapte namen, `openaec::activity` met `status`.

Na ronde 3: de indeling als vaste stappen met inkomende verwijzingen, D = precies wat de lezer leest (huidige regels
letterlijk, ook #336, alle resources en kalenders), zeven relatiepatronen van de writer, Own vooruit over W, Ext over de
hele afsluiting van alles buiten Own (ook doelen van bewaarde tokens), C = Own ∩ Ext; ids via de kaart domein-id →
bron-`#id` (ook bij dubbele GlobalIds); alle slot-tokens bewaard, met regels voor letterlijke, domein-, afhankelijke en
verwijzingsslots; `detached` voor undo na opslaan; controle 2 als vergelijking van twee herlezingen met een nieuwe
`planningCanon`; `ifcSource` vervangen in dezelfde `set()` als de dirty-vlag; herstel zonder kopie in Tauri en met handle;
IFC2X3-planningsbestanden houden de huidige route; voorbeelden als tekst; IFCX: eigen entry direct na een gemengde entry,
gesloten lijst eigen attributen, onbekende `ops::` = vreemd, kop eigen alleen zonder vreemde entries, tweede
compositiecontrole, pad → GlobalId; tests: tweede opslaan op niet-P en `planningCanon`, undo-scenario.

## 13. Bronnen

- Issue #804 (DutchSailor, 2026-11-02); issue #748; issue #336; issue #292; PR #547 / commit `5b2812f94`.
- `src/services/ifc/ifcReader.ts:178-185, 466-468, 982-985, 1105-1115, 1377-1423, 1749, 2063, 2434, 3473-3506, 3570-3612`;
  `ifcWriter.ts:244-253, 287, 317-416, 453, 469-483, 506, 552, 676-694, 825, 1160-1167, 1268, 1675, 1836`;
  `ifcTaskSlots.ts:94, 324-340`; `ifcWorkControlSlots.ts:45-86`; `ifcPsets.ts:381-394`; `ifcConstants.ts:52-56`;
  `src/state/documentContract.ts:298`; `src/state/snapshot.ts:180-189, 218`; `src/state/ifcSaveInput.ts:135`;
  `src/services/recovery/{recoverySnapshotInput.ts, recoveryManifest.ts:4, recoveryStore.ts:378}`;
  `src/hooks/useRecoveryRestore.ts:90`; `src/hooks/useAutoSave.ts:143-148`; `src/services/mcp/backupService.ts:312`;
  `headless/mcp-server/src/{backupFs.ts:35, nodeFs.ts:358}`; `src/components/panels/IFCPanel.tsx:39-58`;
  `fileSlice.ts:898, 1396-1399, 1474, 1500, 1658`; `src/services/fileAccess/{tauriBackend.ts:22, 87-90,
  webBackend.ts:124, siteBackend.ts:43}`; `formatRegistry.ts:142`; `src/core/{index.ts:53, api.ts:120}`;
  `headless/server/server.mjs:269`; `src/utils/devBridge.ts:89-91`; `tests/planning/check-ifc-roundtrip.ts:852-881`.
- IFC5-development `schema/ifcx.tsp`, `src/ifcx-core/composition/{compose.ts, path.ts}`, `layers/layer-stack.ts`,
  `schema/schema-validation.ts`, `examples/Hello Wall/`.
- IFCCAD `docs/experiments/ifccad-document-lifecycle.md`, `schemas/ifccad/experimental-contract-0.6.0.md`.
- ifcx-explorer `examples/reference-school/planning/work-packages.ifcx`, `schemas/openaec-reference.ifcx`,
  `crates/ifcx-project/src/graph.rs`, `crates/ifcx-reference/src/lib.rs:96-102`.
- Open-Calculations-Studio `packages/core/src/ifcx/namespace.ts`, `identiteit.ts`; open-bim-studio `exchange/ifcx/bim_ifcx.dl`.
