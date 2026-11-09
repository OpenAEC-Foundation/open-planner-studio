# Gebouwmodel behouden in IFC en IFCX — ontwerp

Status: ontwerp, versie 15 (9 november 2026: besluiten van Ethan over IFCX en council-rondes 9 tot en met 13 verwerkt;
Opus en Sol gaven een 9).
Wordt in dezelfde sessie gebouwd.
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
2. Hetzelfde voor een `.ifcx`-bestand (§6 zegt precies wat byte-gelijk is). Een planning die een ander programma in
   `openaec::planning::` schreef, opent de app en is te bewerken (§5.5).
3. Een planning als `.ifcx` opslaan en weer openen, zonder verlies van de gegevens in §5.4.
4. Bestaande koppelingen taak↔bouwdeel blijven bestaan en zijn zichtbaar (alleen lezen).
5. Een bestaand eigen IFC-project werkt precies zoals nu (eis uit #804).

**Buiten dit ontwerp**

- Het model tonen of koppelingen bewerken (viewer, selectie, tijdschuif): #748.
- Een gebouwmodel omzetten tussen STEP en IFCX.
- IFC2X3-bestanden met een model (§4.11). Dat is een echte beperking: veel modellen uit Revit en ArchiCAD in
  Nederland zijn nog IFC2X3.
- Datalagen van een IFCX-bestand oplossen die via `imports` uit andere bestanden komen (§6.5).
- De oude naam `openaec::activity` (huidige ifcx-explorer) als planning lezen. Die bijdrage blijft als vreemde bijdrage
  staan (§6.2).

## 2. Wat we leerden uit het ecosysteem

Bron: shallow clones van 7 november 2026.

| Project | Wat het doet | Les voor ons |
|---|---|---|
| **IFCCAD** (`ifccad`) | Alleen IFCX + CBOR. Bewaart de bronbytes. Een projectie mag nooit als verliesvrije bron worden gepresenteerd (`docs/experiments/ifccad-document-lifecycle.md:23-30`). `header.dataVersion` hoort bij de dataset (`schemas/ifccad/experimental-contract-0.6.0.md:35`). | Bewaar de bron, bewerk alleen het eigen deel, zeg eerlijk wat niet behouden blijft. Raak de kop van een ander niet aan. |
| **IFC5-development** (buildingSMART, `1a63082`, 2026-09-08) | `ifcxVersion: "ifcx_alpha"`. `imports` laadt andere bestanden als lagen (`layer-stack.ts:88-111`). Bij gelijke paden wint de latere bijdrage, per attribuutsleutel (`compose.ts`). Paden worden op `/` geknipt (`path.ts:2-11`). De validator eist een schema voor elk attribuut (`schema-validation.ts:129-131`). **Geen schema of voorbeeld voor taken, relaties, kalenders of resources.** | Planning in een eigen namespace, schema's in het bestand. Volgorde van entries is betekenis. |
| **ifcx-explorer** | Planning als eigen laag: `openaec::activity` (`start`, `endExclusive`, `status`, optioneel één `predecessor`, `crates/ifcx-reference/src/lib.rs:96-102`) en `openaec::links` (`relation: "schedules"`, `target: /elements/<32 hex>`). Paden met voorloop-`/`. Weigert stille botsingen tussen lagen (`graph.rs:40-44`). | Er is een ecosysteem-vorm voor "taak plant element". Bjorn (maintainer van IFCCAD en ifcx-explorer) zet de planning in ifcx-explorer om naar `openaec::planning::activity` (9 november 2026). |
| **Open-Calculations-Studio** | Namespace `ocss::`: afkorting van het programma, dan het onderwerp (zus `oses::`). Schema's compleet in elk bestand. UUID en IFC-GlobalId zijn dezelfde 128 bits (`identiteit.ts:4-9`). | Eén identiteit voor STEP en IFCX. (De naam `ops::` naar dit voorbeeld is vervangen door het besluit in §5.2.) |
| **open-bim-studio** | `ifcx_alpha`, `dataVersion 1.0.0`, imports ifc@v5a/prop@v5a/usd@v1, namespace `openbim::`. | Bevestigt de gangbare kop en imports. |
| **ifcx-rs**, **wfc5** | Rust-kern zonder behoud van onbekende sleutels (vermoed); wfc5 is een eigen formaat. | Niet gebruiken. |

## 3. Het principe

Er is **één** lees- en schrijfroute voor elk IFC4/IFC4X3-bestand, met of zonder model.

- De app leest de bron als **bytes** en deelt elk stuk in een klasse in (§4.2).
- Bij opslaan schrijft de app de **eigen planning (P)** opnieuw met de bestaande writer. Alle andere stukken komen
  **byte-gelijk** terug, met hun eigen `#id` en in hun eigen volgorde (§4.10).
- Het **vreemde deel** is elk stuk dat niet P is. Een eigen planningsbestand van de app is 100 % P.
- **Een eigen bestand zonder vreemd deel schrijft de writer precies zoals nu** (doel 5): dezelfde kop, nummering vanaf
  `#1`, geen kaart met bron-ids, en in elk slot de waarde van de writer. Alle objecten hebben dan eigen herkomst (§4.5).
  De enige uitzondering zijn de constante slots: daar blijft een token staan dat een ander programma erin zette,
  bijvoorbeeld een `LongDescription` in een verder eigen bestand. In een
  bestand van de huidige writer bevat een constant slot al de constante van de writer. De uitvoer is dan byte-gelijk aan
  die van de huidige writer. De poort van fase 0 bewijst dat (§10).
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
argumentpositie, argument 0 als ruwe ASCII-tekst (de GlobalId van een `IfcRoot`), en een paar gedecodeerde velden die
de indeling nodig heeft: de `Name` van psets, templates, properties en property-templates; `PredefinedType`, `Name` en
`CreationDate` van werkschema's; de waarde van de property `Baselines` in `OPS_Baselines` en de JSON in
`OPS_StructureMeta`; de waarden van
`IfcPropertyEnumeratedValue` en `IfcPropertyEnumeration`; en de `ApplicationIdentifier` en `Version` van elke
`IfcApplication`. Daaruit bouwt hij ook de **inkomende** verwijzingen (wie verwijst naar mij). De indeling is een pure
functie van deze index en draait vóór de lezer. Een test eist dat de indeling geen ander veld leest.

**Begrippen.**

- **W** — de typen die de writer schrijft (een gesloten lijst, afgeleid uit `ifcWriter.ts` en de helpers; een test
  houdt hem gelijk aan de writer).
- **Objectleden** van een relatie — de argumenten `Relating*` en `Related*` (niet `OwnerHistory`, niet `TimeLag`).

**Stap 1 — domeinobjecten D.** `selectPlanning(index)` geeft precies de objecten die de lezer tot domeingegevens
maakt. Dezelfde functie gebruikt de lezer, zodat indeling en lezer niet uiteen kunnen lopen. Ze neemt de huidige
regels letterlijk over:

- het werkplan dat de lezer kiest: het **eerste** `IfcWorkPlan` in het bestand (`ifcReader.ts:442, 1378`). Een tweede
  werkplan is vreemd en blijft byte-gelijk (§4.5). De writer schrijft het hele P-blok op de plek van het eerste P-stuk
  van de bron (§4.10). Het D-werkplan staat vóór elk ander werkplan, dus het blijft na opslaan het eerste (Opus en Sol,
  ronde 6: in v6 kwam het vreemde werkplan na opslaan vooraan, en koos de lezer het verkeerde);
- de werkschema's en taken zoals de lezer ze nu kiest: alle `IfcTask` buiten de baselinebomen (`ifcReader.ts:1749`);
  baselinebomen worden alleen uitgesloten als er een live-schema met minstens één taak is; anders zijn de
  baselinetaken de planning (`collectBaselineTaskStepIds`, `:3570-3612`, #336). Eén uitzondering: een live-schema van
  eigen herkomst sluit baselinebomen altijd uit, ook zonder taken. Anders werd een Bonsai-baselineboom D nadat de planner
  alle taken wiste, en verdween hij bij het volgende opslaan (Opus, ronde 8). Losse taken buiten een schema horen erbij;
- **alle** resources (`IFC_TO_RESOURCE_TYPE`) en **alle** `IfcWorkCalendar`'s, zoals de lezer nu;
- elke `IfcRelSequence` tussen twee taken in D. De lezer maakt er een domeinrelatie van met een eigen id
  (`ifcReader.ts:2062`), en de writer behoudt haar GlobalId (`ifcWriter.ts:1675`). Zo hebben twee relaties tussen
  hetzelfde paar taken (FS en SS, toegestaan, `sequenceSlice.ts:79`) elk een eigen identiteit;
- de eigen baselinekoppen. De lezer maakt baselines alleen uit de JSON in `OPS_Baselines` (`extractBaselines`,
  `ifcReader.ts:3623-3660`); de writer schrijft per baseline een `BASELINE`-schema zonder taken onder het werkplan
  (`ifcWriter.ts:462-483`). Een `BASELINE`-schema is dus alleen D als zijn `Name` en `CreationDate` gelijk zijn aan
  `name` en `createdAt` van een item in `OPS_Baselines`, en er geen taken onder hangen. De vergelijking gebruikt de
  gedecodeerde `Name` en `ifcDateTime(createdAt)`, want de writer normaliseert de datum (`ifcWriter.ts:112-119, 472-474`;
  een lege `createdAt` wordt "nu"; dan vergelijkt de indeling alleen de `Name`). De GlobalId is
  geen goede sleutel: de writer neemt eerst een GlobalId uit de bron over en maakt bij een botsing een `#dupN`-variant
  (`issueGuid`, `ifcWriter.ts:244-258`). Een baseline van Bonsai, met of zonder takenboom, is geen D en blijft byte-gelijk.
- Baseline herkennen: op het slot `PredefinedType` (`workControlSlots`, `ifcReader.ts:1113-1115`), niet op tekst elders
  in de regel. Taken die zowel onder een live-schema als onder een baseline hangen, horen bij de planning
  (`ifcReader.ts:3610-3611`).

**Stap 2 — eigen relaties R.** Een relatie is R als ze past op een van de zes patronen die de writer schrijft, en
anders niet (`IfcRelSequence` is D, stap 1):

| Type | Patroon (objectleden) |
|---|---|
| `IfcRelNests` | ouder en kinderen in D (taken, schema's, ploegen) |
| `IfcRelAssignsToControl` | relating = schema in D, related ⊆ taken in D; of relating = kalender in D, related ⊆ taken of resources in D (`ifcWriter.ts:1482, 1490`) |
| `IfcRelAssignsToProcess` | relating = taak in D, related ⊆ resources in D |
| `IfcRelAggregates` | relating = werkplan in D, related ⊆ schema's in D |
| `IfcRelDeclares` | relating = het `IfcProject`, related ⊆ templates uit het register |
| `IfcRelDefinesByProperties` | related ⊆ D ∪ {het `IfcProject`}, pset uit het register |

- **Register**: een gesloten lijst van de psets en templates die de writer echt schrijft en de lezer echt leest. De code
  haalt hem uit `ifcPsets.ts`; hij wordt niet overgetikt (een handlijst in de voorproef van ronde 5 had markers die geen
  pset zijn en miste `OPS_P6Progress`, `ifcPsets.ts:77, 707`). Een voorvoegsel `OPS_` alleen geeft geen schrijfrecht: een
  onbekende `OPS_AndereTool` is geen R.
- **Properties in het register.** Per pset zegt het register welke properties eigen zijn: de properties die de lezer
  echt gebruikt. Dat is een vaste lijst namen, of een herkenner voor sleutels uit de data:
  - `OPS_Assignments` is de enige pset met sleutels uit de data. Twee vormen: `<GlobalId van een resource>#n` en, van
    writers tot en met v2026.7.3, de kale GlobalId (`ifcReader.ts:3458-3462, 3494`). De lezer zet de `#n`-sleutels per
    GlobalId op volgorde van `n` in een wachtrij en neemt er één per toewijzing van die resource aan de taak
    (`ifcReader.ts:3455-3470, 3489`). Regel: elke sleutel in GlobalId-vorm (kaal of met `#n`) is eigen, ook als het er
    meer zijn dan toewijzingen. Een andere naam (`VendorSecretNote`) is een vreemd lid. Een vreemde `#n`-sleutel zou de
    wachtrij verschuiven, want de lezer sorteert op `n` (`ifcReader.ts:3464, 3494`; proef van Opus, ronde 8).
  - `OPS_Timephased` heeft één vaste property `Windows`, met de sleutels in de JSON (`ifcReader.ts:3380-3390`).
    `OPS_TimephasedWindow` heeft de vaste properties `FinishFloor` en `StartAnchor` (`ifcPsets.ts:628-636`). (Sol, ronde 7:
    v7 behandelde ze als `#n`-psets, en een eigen fixture kreeg vreemde leden.)
  - `OPS_ActivityCodes`: de naam van een codetype, met als eerste code een waarde van dat type. `OPS_CustomFields`: de
    naam van een veld. De typen en velden komen uit de JSON in `OPS_StructureMeta`, met terugval op het eigen template,
    in dezelfde voorrang als de lezer (`ifcReader.ts:2202-2246, 2343-2366`).
  - Dezelfde regel geldt voor property-templates in een template uit het register.
  - Lezer en indeling gebruiken dezelfde herkenner.
  - Bij opslaan vervalt elk vreemd lid dat de herkenner in de uitvoer als eigen zou lezen (wijzigingslijst, met een
    melding). Voorbeelden: de planner maakt een veld "Zone" terwijl een ander programma al een "Zone" op de taak zette
    (`ifcReader.ts:2351`); of de writer schrijft een naam die al als vreemd lid in de pset staat. Zo komen er nooit twee
    properties met dezelfde naam in één pset. (Sol, ronde 6: met *alle* in v6 bleef een `VendorSecretNote` in
    `OPS_Assignments` of `OPS_ActivityCodes` P en ging hij verloren.)
- Het register bevat ook de psetnamen die alleen in `ifcWriter.ts` staan, zoals `OPS_Project` (`ifcWriter.ts:413`,
  `ifcReader.ts:384`); de bouw zet ze in `PSET`. Een test eist dat elke psetnaam die de writer schrijft in het register
  staat.
- De patronen en het register worden in code uit één bron gehaald, die de writer, de indeling en de poorttest delen.
- Een relatie die niet past (een pset van Bonsai, `IfcRelDeclares` project→werkplan van IfcOpenShell, een rel met taken
  én wanden, een `IfcRelAggregates` werkplan→(live-schema, baseline van Bonsai)), is geen R. Zie §4.6 voor gemengde relaties.

**Stap 3 — eigen afsluiting Own.** Own is alles wat vooruit bereikbaar is vanuit D ∪ R, alleen via stukken met een
type in W. Hiermee horen psets, properties, `IfcLagTime`, templates, owner histories, `IfcTaskTime`, tijden en perioden,
en het `IfcProject` met zijn units en context bij Own als alleen eigen stukken ernaar wijzen.

Eén grens: vanuit een pset of template uit het register volgt Own alleen de properties die de lezer leest (stap 2). Een
andere property is een **vreemd lid**: niet Own, dus V (of A). De writer zet zijn `#id` terug in de `HasProperties` van de
opnieuw geschreven pset; `ifcSource.foreignMembers` bewaart die ids per (domeinobject, psetnaam). Heeft de pset geen
eigen properties meer (de planner wist de laatste notitie), dan schrijft de writer haar toch, met alleen de vreemde
leden, zolang het domeinobject bestaat (Fable, Opus en Sol, ronde 8: de writer slaat een lege pset nu over,
`ifcWriter.ts:694, 910`, `ifcPsets.ts:487, 508, 612, 637`, en dan hing het vreemde lid nergens meer aan). Voorbeeld: een
`VendorSecretNote` in `OPS_Calendar` blijft byte-gelijk staan (proef van Sol in ronde 5; in v5 werd hij P en ging hij bij
opslaan verloren). Verdwijnt het domeinobject, dan blijft de property als los stuk staan (§4.7 regel 4).

**Stap 4 — gedeelde context.** Ext is alles wat vooruit bereikbaar is vanuit elk stuk **buiten** Own, plus de doelen
van verwijzingen in bewaarde tokens van constante slots (§4.5). Daartoe hoort de owner history van elk D- en R-stuk van
vreemde herkomst: die blijft staan (§4.5), dus zij en haar persoon, organisatie en applicatie zijn C. Ext loopt door tot het einde (ook de persoon, organisatie en
applicatie achter een gedeelde owner history), **behalve door D en R heen**: een D- of R-stuk houdt zijn `#id`, en wat
erachter ligt (de `IfcTaskTime` van een taak, haar owner history) is van de writer. Een vreemde verwijzing naar een taak
maakt de tijden van die taak dus niet tot context. Zonder deze regel bleef bij elk opslaan per gekoppelde taak een
verweesde `IfcTaskTime` achter (gevonden in ronde 4 met proefbestanden).

**Uitkomst.**

| Klasse | Definitie | Lezer | Schrijver |
|---|---|---|---|
| **P** | D ∪ R ∪ (Own − Ext) | leest | schrijft opnieuw (§4.3–4.5) |
| **C** | (Own ∩ Ext) − D − R | leest (alleen lezen) | byte-gelijk; P verwijst ernaar |
| **A** | buiten Own, met een verwijzing naar een P-stuk | leest alleen `IfcRelAssignsToProcess`/`IfcRelAssignsToProduct` en gemengde relaties (§4.6) | byte-gelijk, tenzij een P-doel verdwijnt (§4.7) of een gemengde relatie wijzigt (§4.6) |
| **V** | de rest | leest niet | byte-gelijk |

Gevolgen:

- Een eigen bestand: alles is Own, Ext is leeg, dus 100 % P.
- Een model zonder planning: D en R zijn leeg, dus alles is V, ook het `IfcProject`. De lezer leest het `IfcProject`
  (er is er precies één) altijd als context, ook als het V is; de writer hangt de nieuwe planning eraan. Na het eerste
  opslaan verwijst een eigen R-stuk ernaar (`OPS_ProjectSettings`), en is het C.
- Nagerekend met `scripts/proef/classify-v9.py`, dat deze vier stappen uitvoert (fase-0-voorproef, 7 november 2026):
  alle 35 bestanden in `public/examples/`, `examples/` en `docs/superpowers/evidence/` geven 100 % P, zonder vreemde
  leden en zonder vreemde herkomst; acht modellen uit IFC5-development (ook `TeklaHouse.ifc`, 19 MB, 224.496 entiteiten) geven 100 % V; een eigen
  planning samengevoegd met Hello Wall geeft C = alleen project, units en context (9 stukken); de proefbestanden van de
  council geven geen `IfcTaskTime` in C. Uit ronde 5: een onbekende property in `OPS_ProjectSettings` of `OPS_Calendar` is
  een vreemd lid; FS en SS tussen hetzelfde paar taken zijn twee D-relaties; een lege Bonsai-baseline onder het eigen
  werkplan is V, en de aggregatie erboven is een gemengde relatie (A). Uit ronde 6: een `VendorSecretNote` in
  `OPS_Assignments` en in `OPS_ActivityCodes` is een vreemd lid; in het Bonsai-voorbeeld hebben 10 D- en R-stukken
  vreemde herkomst, en hun owner history is C. Het script is een benadering (register uit de
  `OPS_*`-namen in de code, bekende propertynamen = alle tekstliteralen in `src/services/ifc/`); de bouw gebruikt de
  gedeelde bron uit de code.
- Een model met eigen planning (eerder door de app opgeslagen): het `IfcProject` is C (het model wijst ernaar), de eigen
  owner history is P zolang alleen eigen stukken ernaar wijzen, en wordt dan elke keer vervangen. Wijst een vreemd stuk
  er ook naar, dan is hij C en blijft hij staan; de writer schrijft daarnaast zijn eigen P-owner history. Elk opslaan
  vervangt die P-versie, dus er stapelt niets op.
- Een A-stuk wijst alleen naar D (stukken met een stabiel `#id`, §4.3); geen IFC-attribuut wijst naar een relatie. Wijst
  een vreemd stuk naar een hulpstuk, dan is dat hulpstuk in Ext, dus C, en blijft het staan.
- Lezen en schrijven zijn apart geregeld: de lezer mag een A-stuk lezen zonder dat de app het bezit.

### 4.3 Identiteit en ids

- **Zonder vreemd deel** nummert de writer zoals nu, vanaf `#1`. De kaart hieronder wordt dan niet gebruikt (er is
  niets dat naar een id kan wijzen).
- **Met een vreemd deel** houdt elk D-stuk bij opslaan zijn `#id` als het object nog bestaat. De koppeling loopt via een expliciete kaart
  **domein-id → bron-`#id`** (de lezer heeft al `taskStepIdMap` en `resourceStepIdMap`). Zo blijven ook twee objecten
  met dezelfde GlobalId uit elkaar (de lezer maakt daar `-dup-N`-ids van, `ifcReader.ts:466-468`; de writer geeft de
  tweede een nieuwe GlobalId, `ifcWriter.ts:244-253`).
- R-stukken en alle andere P-stukken (hulpstukken) krijgen nieuwe ids vanaf het hoogste id van de niet-P-stukken plus 1,
  en slaan de ids van de D-stukken over. Zo ligt de nummering vast na het eerste opslaan, ook als de writer een nieuw
  D-stuk maakte (bijvoorbeeld een werkplan of kalender in een Bonsai-bestand zonder; Opus, ronde 8). Geen IFC-attribuut wijst naar een relatie, en niets buiten P wijst naar een hulpstuk (§4.2). Nieuwe ids
  breken dus geen verwijzing. Wijst toch een stuk buiten P naar een R-stuk, dan vindt controle 2 de loze verwijzing en
  schrijft de app niets.
- Nieuwe D-objecten (in de app gemaakt) krijgen ook ids uit die reeks.
- Teruggezette stukken (§4.7) krijgen ids boven die van de hulpstukken.

### 4.4 De writer met een vreemd deel

- Geen eigen `IfcProject`, units en geometrische context als het project **niet P** is (C, of V bij een model zonder
  planning). De sleutel `_project` wijst naar het bron-id.
- Eigen owner history, persoon, organisatie en applicatie: wel; die zijn P en worden elke keer vervangen.
- Projectgegevens bij een project dat niet P is: de writer schrijft naam, beschrijving, auteur en bedrijf als
  properties in `OPS_ProjectSettings` (`ProjectName`, `ProjectDescription`, `Author`, `Organization`; de pset blijft op het
  project, `ifcWriter.ts:676-694`). De lezer leest ze daar eerst, met terugval op `IfcProject.Name`/`Description` en de
  owner history. Zonder vreemd deel schrijft de writer de naam in het werkplan zoals nu (`ifcWriter.ts:453`).
- Voorbeeld (Opus, ronde 5): een Bonsai-bestand met project 'Proj' en werkplan 'Plan'. Na openen heet het project 'Proj'.
  Na opslaan staat 'Proj' in `OPS_ProjectSettings`, het werkplan heet nog 'Plan', en een herlezing geeft weer 'Proj'. Het
  werkplan houdt zijn naam ook bij elk volgend opslaan, omdat het zijn vreemde herkomst houdt (§4.5).
- Eenheden: de lezer leest niets uit `IfcUnitAssignment` (nagelopen); de writer voegt niets toe aan die van het model.
- Regeleinde: dat van de bron. Uitvoer: een lijst `Uint8Array`-delen, geen grote string.

### 4.5 Planning van een ander programma (Bonsai, Synchro)

Een taak uit Bonsai of Synchro is P en wordt dus opnieuw geschreven. Wat de writer niet kent, mag daarbij niet stil
verdwijnen.

- **Herkomst.** Een object heeft *eigen herkomst* als het slot `OwningApplication` van zijn owner history naar een
  `IfcApplication` met identifier `'OPS'` wijst (`ifcWriter.ts:393`); anders *vreemde herkomst* (ook bij `OwnerHistory = $`). Nieuwe objecten hebben eigen herkomst.
- **De herkomst blijft.** Bij een D- of R-stuk van vreemde herkomst is `OwnerHistory` een constant slot met een `#`: de
  writer schrijft het brontoken terug, en de owner history van het andere programma blijft als C staan (§4.2 stap 4). Zo
  heeft het object na elk opslaan, en na sluiten en opnieuw openen, nog steeds vreemde herkomst. De app past de owner
  history van een ander programma niet aan, ook niet als de planner het object wijzigt (geen nieuwe `ChangeAction`): het
  is een stuk van een ander, en het kan gedeeld zijn. (Fable, Opus en Sol, ronde 6: in v6 zette de writer overal zijn
  eigen owner history; na één opslaan had alles eigen herkomst, en bij het tweede opslaan heette werkplan 'Plan' 'Proj'
  en verdween de `QuantityInProcess` van Bonsai.)
- De lezer bewaart voor elk D-stuk en elk R-stuk **alle** ruwe slot-tokens en het entiteittype, in `ifcSource.sourceSlots`.
  Sleutel: het bron-`#id` (D en R), of het `#id` van de eigenaar (`IfcTaskTime`, `IfcLagTime`).
- Tokens worden per **slotnaam** bewaard, via de descriptor die de lay-out van de bron herkent. Er zijn oude eigen
  lay-outs: `IfcTask` met 12 argumenten tot 2026-07-03 (`ifcReader.ts:1768-1777`), resources met 9 argumenten en het type op
  de plek van `BaseCosts` (`ifcWriter.ts:1727-1728`), `IfcLagTime` met verwisselde argumenten (`ifcReader.ts:1984`). Tokens
  uit een oude lay-out, of uit een stuk met de oude letterlijke codering (`'0.1'`, §4.9), worden niet bewaard.
- **Vier soorten slots.** Elk slot in elke descriptortabel heeft een soort; een test faalt bij een slot zonder soort.
  - **Domein**: de lezer vertaalt het naar een domeinveld. Eigen herkomst: altijd de waarde van de writer. Vreemde
    herkomst: het brontoken als het domeinveld nog gelijk is aan wat de lezer eruit las, én het token in de codering van
    de uitvoer dezelfde waarde geeft; anders de waarde van de writer. Zo blijft een Bonsai-`Status` staan.
  - **Afgeleid**: de writer berekent het uit andere gegevens. Altijd de waarde van de writer. Voorbeelden:
    `IfcTaskTime.StatusTime` (`ifcWriter.ts:1542`), `IfcTaskTime.Name`, de naam van `IfcRelNests` bij eigen herkomst (`:1600`),
    StartTime/FinishTime/CreationDate van werkplan en werkschema (`:447-449`), naam en datums van de baselineschema's
    (`:465-466`), `IfcWorkPlan.Name` bij eigen herkomst. Zo blijft een statusdatum niet op de oude waarde staan (Opus,
    ronde 5: in v5 bevroor het brontoken de oude datum).
  - **Constant**: de writer schrijft een vaste waarde (vaak `$`) en de lezer leest het slot niet. Dan het brontoken.
    Voorbeelden: `LongDescription`, `WorkMethod`, `IfcWorkPlan.Name` bij vreemde herkomst. In een bestand van de huidige
    writer is het brontoken al de constante.
  - **Verwijzing** (`OwnerHistory` bij eigen herkomst, `TaskTime`, `Creators`, `Recurrence`, `WorkingTimes`): altijd de
    eigen verwijzing van de writer.
  - Een brontoken met een `#` blijft alleen staan in een constant slot uit een vaste lijst: `OwnerHistory` bij vreemde
    herkomst, `IfcConstructionResource.Usage`,
    `BaseCosts` en `BaseQuantity` (de writer zet daar `$`, `ifcWriter.ts:1732`) en `IfcRelAssignsToProcess.QuantityInProcess`.
    Fase 2 maakt de lijst af met het schema. De doelen zijn startpunten van Ext (§4.2). Zo hangt de indeling niet af van
    keuzes die pas bij opslaan vallen.
  - **Afhankelijke slots** (bijvoorbeeld `ObjectType`, verplicht bij `USERDEFINED`, `ifcTaskSlots.ts:333-338`): de
    descriptor schrijft ze samen, zodat de combinatie geldig blijft.
- **Relaties van een ander programma.** Een R-stuk van vreemde herkomst wordt opnieuw geschreven met zijn bewaarde slots
  (GlobalId, OwnerHistory, Name, Description, `QuantityInProcess`). Welke leden erin staan, volgt uit de **huidige
  koppelingen in het domein**, niet uit het bestaan van de objecten:
  - Een lid blijft alleen staan zolang het domein dezelfde koppeling heeft, **zoals de lezer haar vertaalt**: hetzelfde
    type en dezelfde relating. Bij `IfcRelAssignsToProcess`: het paar (taak, resource), zo vaak als het domein die
    toewijzing heeft. Bij `IfcRelAssignsToControl` met een schema: hetzelfde schema. Met een kalender: dezelfde kalender;
    is dat de projectkalender, dan slaat de lezer de relatie over (`ifcReader.ts:3272`) en is de koppeling "volgt de
    projectkalender" (geen eigen `calendarId`). Het lid blijft dan staan zolang de taak of resource geen eigen kalender
    heeft en die kalender de projectkalender blijft. (Opus, ronde 7: anders verviel de kalendertoewijzing van Bonsai al
    bij openen en opslaan zonder wijziging.)
  - Een `IfcRelNests` volgt de ouder: de bewaarde relatie van een ouder krijgt de kinderen die die ouder nu heeft, in de
    volgorde van het domein. Komt er een kind bij of gaat er een weg, dan verandert alleen de ledenlijst.
  - Een lid zonder koppeling gaat eruit (wijzigingslijst niet nodig: het is P). Zonder leden vervalt de relatie.
  - De relaties die de writer zelf maakt, krijgen alleen de koppelingen die in geen bewaarde relatie staan
    (`ifcWriter.ts:1596-1600, 1830-1838`). Zo staat een kind nooit in twee `Nests`, en een toewijzing nooit twee keer.
  - R-stukken van eigen herkomst gaan zoals nu.
  - Voorbeelden (Opus en Sol, ronde 6): een taak een niveau hoger zetten haalt haar uit de `Nests` van Bonsai van de oude
    ouder; een verwijderde toewijzing (`unassignResource`, `resourceSlice.ts:252`) gaat eruit, ook al bestaan taak en
    resource nog; een toewijzing per resource uit Bonsai houdt haar `QuantityInProcess`.
- Het entiteittype komt uit de bron als het domein het niet onderscheidt (een `IfcConstructionProductResource` blijft
  dat, `ifcConstants.ts:52-56`).
- Descriptortabellen: `IfcTask` en `IfcTaskTime` hebben ze al (`ifcTaskSlots.ts:94, 324`). Fase 2 maakt ze voor
  `IfcWorkPlan`/`IfcWorkSchedule` (nu index-helpers in `ifcWorkControlSlots.ts:45-86` en `workControlArgs` in de writer),
  `IfcWorkCalendar`, de resources en `IfcRelSequence`/`IfcLagTime` (nu vaste sjablonen, `ifcWriter.ts:1268, 1675`).
- Wat dan nog verloren gaat, meldt de app bij openen in een lijst. Bekend: extra werkschema's worden samengevoegd tot
  één; een tweede werkplan blijft als vreemd stuk staan, maar de app hangt er geen planning meer onder (zijn aggregatie
  wordt een gemengde of A-relatie, §4.6); vreemde vormen van tijdsperioden; `Creators` van een werkplan. Zo presenteert
  de app de overname niet als verliesvrij (les van IFCCAD).

### 4.6 Koppelingen taak↔bouwdeel en toewijzingen

`IfcRelAssignsToProcess` en `IfcRelAssignsToProduct` met producten erin zijn A. De lezer parseert juist deze A-stukken
met de bestaande `parseSTEP` (een kleine set; de lezer kent `IfcRelAssignsToProduct` nu niet).

- Afgeleide, alleen-lezen weergave per taak: `elementLinks: { direction: 'input' | 'output', target }[]`. `target` is een
  GlobalId (STEP) of een pad (IFCX, §6.4). Bij Bonsai: `ToProcess` = input, `ToProduct` = output. Geen domeinveld, geen
  documentveld; het hoort bij `ifcSource`.
- Taakpaneel: "Gekoppeld aan 12 bouwdelen" (alleen lezen). MCP: veld in `planner_get_task`. Een doel dat niet in het
  bestand staat, toont "niet gevonden".
- **Gemengde relatie**: een relatie die niet R is en een van deze twee vormen heeft:
  - (a) een van de vier structurele typen (`IfcRelAssignsToProcess`, `IfcRelNests`, `IfcRelAggregates`,
    `IfcRelAssignsToControl`), met de relating in D en onder related zowel D-leden als vreemde leden. Voorbeelden:
    resources en producten in één `IfcRelAssignsToProcess`; een `IfcRelAggregates` werkplan→(live-schema, baseline van
    Bonsai).
  - (b) een `IfcRelDefinesByProperties` met een pset uit het register en onder related zowel D-objecten als vreemde
    objecten. Voorbeeld: één `OPS_Calendar` op een kalender én een wand.
- Een relatie met een vreemde relating is nooit gemengd, ook als ze naar D-leden wijst. Voorbeeld:
  `IfcRelAssignsToControl` van een `IfcCostItem` naar taken (5D). Ze is A en valt onder §4.7 (Opus, ronde 5).
- Een gemengde relatie is A. **Lezen** staat los van schrijfrecht: bij (a) leest de lezer de D-leden alsof het een eigen
  relatie is; bij (b) leest hij de properties uit het register voor de D-objecten. Zo leest een kalender zijn
  `HoursPerDay = 8` ook uit een `OPS_Calendar` die hij met een wand deelt (Sol, ronde 5: in v5 las de lezer die pset niet,
  en leidde hij uit 07:00–16:00 9 uur af). `ifcSource` onthoudt per D-lid wat de lezer zo las.
- **Ongewijzigd** betekent: bij (a) dezelfde D-leden; bij (b) de writer zou voor elk D-object dezelfde propertywaarden
  schrijven als de lezer las. Dan schrijft de app geen eigen relatie of pset voor die leden, en blijft het stuk
  byte-gelijk.
- **Gewijzigd**: de app haalt de gewijzigde D-leden uit het stuk (wijzigingslijst) en schrijft voor hen een eigen relatie
  of pset. Bij (b) houdt het vreemde object de oude pset.
- Zo staat een taak of schema nooit in twee `Nests`/`Decomposes`-relaties (die zijn SET [0:1]), en krijgt een object
  nooit twee psets met dezelfde naam.

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

**Ongedaan maken na opslaan.** De app bewaart elk vervallen of gewijzigd vreemd stuk (oude bytes), en van verdwenen
objecten de `sourceSlots`, de `elementLinks` en de `foreignMembers` (met de psetnaam waar elk vreemd lid bij hoorde), in
`ifcSource.detached`, zolang het document open is. Ook de bewaarde slots van een vervallen relatie van een ander
programma gaan erin, per koppeling (een toewijzing van Bonsai komt na Ctrl+Z terug met haar `QuantityInProcess` en
GlobalId). (Sol en Opus, ronde 7.) Komt een object met dezelfde
domein-id terug (Ctrl+Z, ook na opslaan), dan zet de writer bij het volgende opslaan die stukken terug, met de
verwijzing naar het huidige `#id` van het object (wijzigingslijst). Zo verliest Ctrl+Z na opslaan niets. Na sluiten van
het document vervalt `detached`; dan kan ook Ctrl+Z het object niet meer terugbrengen.

- Is hetzelfde stuk in twee opslagrondes bewaard, dan komt de oudste versie terug, met alleen de leden die nog bestaan.
- De wijzigingslijst kent drie soorten: *gewijzigd*, *vervallen* en *teruggezet*. Teruggezette stukken staan direct na
  het P-blok (§4.10), met ids boven die van de hulpstukken (§4.3); verwijzingen tussen teruggezette stukken worden
  meegenummerd. Controle 1 rekent ze mee als teruggezet.

### 4.8 `ifcSource`: waar de bron woont

- Nieuw documentveld `ifcSource` met rol `snapshot: 'none'`, zoals `xerSourceArchive` (`documentContract.ts:298`).
  Niet in undo (§4.7 regelt undo na opslaan).
- Inhoud: de bronbytes (`Uint8Array`), sha256, de kopnaam van het schema (ook `IFC4X3_ADD1`/`TC1`), de stukkenindex
  (`Uint32Array`), de klasse per stuk, de kaart domein-id → bron-`#id`, de A-verwijzingen, `sourceSlots`,
  `foreignMembers`, wat de lezer uit gemengde relaties las (§4.6), `elementLinks`, `detached`, `foreign` (is er een vreemd
  deel), het aantal bewaarde vreemde tokens in constante slots, de grootte en wijzigingstijd van het bestand op het eigen
  doel (§4.10) en het totaal aantal vreemde objecten voor de melding.
- **De nieuwe bron komt van de writer.** De klassen, de kaart domein-id → `#id`, `sourceSlots`, `foreignMembers` en
  `elementLinks` van de nieuwe bron komen uit wat de writer schreef, met de domein-ids van de sessie, niet uit een nieuwe
  indeling van de uitvoer. Anders kregen in de app gemaakte objecten, of een `-dup-N`-object met een nieuwe GlobalId, bij
  elk opslaan een ander id, en verdwenen vreemde koppelingen ernaar (Opus, ronde 8). Bij heropenen deelt de indeling
  opnieuw in; een test eist dat die uitkomst gelijk is aan wat de writer als P schreef.
- **Na elk geslaagd schrijven naar het eigen doel** van het document (Opslaan, Opslaan als, de echte AutoSave naar het
  bestand) vervangt de app `ifcSource` door de uitvoer (die de controles al gescand hebben). Dat gebeurt in dezelfde
  `set()` als het afronden van het opslaan, en los van de dirty-vlag: werkt de planner door tijdens een lange AutoSave,
  dan blijft het document gewijzigd (`commitSavedDocument`, `fileSlice.ts:576-594`), maar de bron is wel de uitvoer op
  schijf. Een export naar een ander doel (`exportAs`, Exporteren zonder gebouwmodel, pool-export) vervangt `ifcSource`
  nooit; anders klopt de sha256 in het manifest niet meer met het eigen doel. Het vervangen neemt `detached` mee.
- **AutoSave en een nieuwe bron.** De controle op een verouderde kandidaat (`useAutoSave.ts:155`) eist ook dat
  `ifcSource` nog hetzelfde object is als waarop de kandidaat is gebouwd. Zo schrijft AutoSave geen uitvoer die op een
  oudere bron is gebouwd nadat een handmatig opslaan een nieuwe bron maakte (Opus, ronde 7).
- **De schrijver krijgt `ifcSource` via `IFCSaveSource`.** `IFCSaveSource` is een expliciete `Pick`, met compile-asserts
  gekoppeld aan `IFC_SAVE_KEYS` (`ifcSaveInput.ts:13, 116-126`). `ifcSource` komt in die `Pick`; dan kan geen van de 26
  aanroepen van `buildWriteIFCInput`/`buildExportIFCInput` het veld vergeten (Opus, ronde 5). `buildWriteIFCInput(src, mode)`
  krijgt een verplichte modus: `'merge'` (met het vreemde deel) of `'planOnly'` (alleen planning: Exporteren zonder
  gebouwmodel, ander formaat, pool-export). De schrijflaag weigert een `planOnly`-uitvoer naar het eigen doel van een
  document met een vreemd deel.
- **Twee sleutellijsten.** De compile-asserts eisen dat `IFC_SAVE_KEYS` gelijk is aan `keyof IFCSaveSource`
  (`ifcSaveInput.ts:116-131`); `ifcSource` komt dus in `IFC_SAVE_KEYS`. Nieuw is `IFC_DIRTY_KEYS` = `IFC_SAVE_KEYS` zonder
  `ifcSource`, met een eigen assert. Die lijst gebruiken alle vergelijkingen: `sameIFCSource` (`:135-137`),
  `commitSavedDocument`, `markAutoSaveVersionSaved` (`documentSlice.ts:598-602`) en `recoveryDelta.ts:88`. Het vervangen
  van `ifcSource` maakt het document dus niet opnieuw "gewijzigd": AutoSave blijft niet schrijven. Het herstel krijgt de
  nieuwe sha256 via de metadata van het manifest (`sameMetadata`), niet via een nieuwe snapshot (§4.14).
- **Bronbytes reizen niet mee.** De herstelsnapshot laat `ifcSource` weg, zoals nu `xerSourceArchive` en `xer`
  (`recoverySnapshotInput.ts:12`); anders gaat tot 150 MB elke 10 s naar de worker. De MCP-backup laat de bronbytes ook
  weg (§4.12). Een test eist beide.
- Een bestand dat uit IFC geopend is, heeft altijd een `ifcSource`, ook zonder vreemd deel (voor de constante slots van §4.5).
  Dan is het geheugen klein: een eigen bestand is meestal enkele MB.
- **Eigenaar van de bytes**: de hoofdthread, in `ifcSource`. De scanner draait synchroon (ook in Node en in het herstel)
  of krijgt in een Worker een kopie. Het samenvoegen bij opslaan gebeurt op de hoofdthread met `subarray`, zonder kopie.
  Fase 0 meet of dat bij 150 MB de UI te lang blokkeert; zo ja, dan krijgt een Worker een kopie.
- Geen IFC-bron (nieuw project, import uit CSV/MSPDI/XER): `ifcSource = null`, de huidige route.

### 4.9 Lezen

1. **Openen als bytes.** Elke open-route voor IFC leest bytes: Openen (`tauriBackend.ts:22`, `webBackend.ts:124`,
   `siteBackend.ts:43`), Recent (`tauriBackend.ts:87-90`, `fileSlice.ts:1658`) en externe bronnen
   (`parseExternalSource`, `fileSlice.ts:1500`). De grootte wordt vóór het lezen gecontroleerd (§4.13).
   `openExampleFromString` (voorbeelden, `helpApi.ts:104`, `useDemoStartExample.ts:49`, `qaScenes.ts:89`) blijft tekst:
   het zijn eigen bestanden in UTF-8. Een voorbeeld met een model (`bouwmodel-ifc4.ifc` in de QA-scènes) gaat via
   dezelfde route met `TextEncoder`; dat is byte-gelijk voor geldige UTF-8.
2. **Scanner** op `Uint8Array` (alle STEP-syntaxis is ASCII), met de index uit §4.2.
3. **Indeling** (§4.2).
4. **Lezer**: de P-, C- en gekozen A-stukken, en de pset met properties onder een gemengde relatie (b), worden gedecodeerd
   (STEP-strings, UTF-8) en gaan door de bestaande `parseSTEP` en lezer.
5. **Codering van strings.** Nu kiest `stringsAreStepEncoded` voor het hele bestand op de eerste OPS-applicatie
   (`ifcReader.ts:1156-1161`). Nieuw: de keuze geldt **per stuk**. Een stuk met een `OwnerHistory`-slot volgt de applicatie
   achter dat slot, los van de klasse van die owner history: OPS met versie `'0.1'` = letterlijk, al het andere = de norm.
   Een stuk zonder `OwnerHistory`-slot (property, `IfcTaskTime`, `IfcLagTime`) volgt het stuk dat ernaar verwijst
   (property → pset; een pset heeft zelf een `OwnerHistory`-slot); een stuk waar niemand naar verwijst, volgt de norm. Staat er in het hele bestand
   geen `IfcApplication`, dan blijft de huidige terugval: met `OPS_`-psets letterlijk (`ifcReader.ts:1161, 3802-3808`). Voorbeelden: in `oud01.ifc` (Opus, ronde 5) wijzen het project en de
   taken naar een `'0.1'`-owner history die C is; de taken en hun psets worden toch letterlijk gelezen, zodat een `\` in
   een JSON-pset heel blijft (Fable en Opus, ronde 6). In `k2.ifc` (Sol) staat de planning op een `'0.2'`-owner history en
   de oude `'0.1'` alleen achter het project: de planning volgt de norm. De writer schrijft elke P-tekst in de huidige
   codering; tokens uit een stuk met de oude codering hergebruikt hij niet (§4.5).

### 4.10 Vóór opslaan: de verliesbewaking

De writer schrijft (met een vreemd deel): de kop; de niet-P-stukken die in de bron vóór het eerste P-stuk staan; dan het
hele **P-blok**, zoals de writer het zonder vreemd deel schrijft (D-stukken houden hun `#id`, de rest krijgt ids volgens
§4.3); dan de teruggezette stukken (§4.7); dan de overige niet-P-stukken in bronvolgorde; dan de staart. Heeft de bron
geen P-stuk (een model zonder planning, het eerste wat een planner doet), dan komt het P-blok na het laatste bronstuk,
vóór de staart. Niet-P-stukken blijven
byte-gelijk (A volgens de wijzigingslijst), en hun volgorde onderling verandert niet.

Waarom het hele blok in writer-volgorde (Opus, ronde 7): de lezer haalt veel keuzes uit de bestandsvolgorde. De volgorde
van de wortel-taken komt uit de volgorde van de `IFCTASK`-regels (`ifcReader.ts:1749`, `taskTree.ts:94-98`), de
projectkalender is de eerste `IFCWORKCALENDAR` (`ifcReader.ts:1449, 3256`, `ifcWriter.ts:418`). Met D-stukken op hun
bronplek (v7) kwam een nieuwe taak achteraan en bleef de oude projectkalender de eerste. In writer-volgorde maakt de
samengevoegde uitvoer dezelfde keuzes als de uitvoer zonder vreemd deel. Het D-werkplan is het eerste werkplan van de
bron, dus elk vreemd werkplan staat na het begin van het P-blok, en de lezer kiest na opslaan weer het D-werkplan. Een
test eist voor elke "eerste X"-keuze van de lezer (`ifcReader.ts:267, 438-445, 1377-1378, 1397, 1449, 3256`) hetzelfde
domeinveld bij `merge` en `planOnly`. Voor `:1397` (de eerste owner history, in een model die van een ander) is §4.4 de
voorwaarde: auteur en bedrijf staan dan in `OPS_ProjectSettings`.

Ook de volgorde binnen het blok tegenover de vreemde stukken telt. Gemengde relaties (A) staan na het blok, dus de lezer
leest hun leden na de eigen leden (wachtrij van `OPS_Assignments`, `ifcReader.ts:3494`; `reconstructResourceIds`, `:284`;
`childIds` over meer `Nests`, `:2412`; de kalenderbibliotheek, `:3279`). De writer nummert de `#n`-sleutels daarom in de
volgorde waarin de lezer de leden in de uitvoer tegenkomt. Een bewaarde relatie van een ander programma staat in het
blok direct vóór de relatie die de writer voor dezelfde relating schrijft (bijvoorbeeld `assign_<taak>`,
`ifcWriter.ts:1830-1838`).
Daarna, vóór het wegschrijven, scant de app de uitvoer opnieuw met de scanner. Twee controles:

1. **Vreemd deel.** Elk niet-P-stuk van de bron staat in de uitvoer met hetzelfde `#id`, dezelfde bytes en in dezelfde
   volgorde, op de wijzigingslijst na (gewijzigd, vervallen, teruggezet). Er komt geen ander niet-P-stuk bij, en geen
   `#id` komt twee keer voor. Ook het lidmaatschap blijft: elk vreemd lid hangt in de uitvoer aan dezelfde
   (domeinobject, psetnaam) als in de bron, tenzij het object verdween of het lid volgens §4.2 verviel (Sol, ronde 8:
   zonder deze eis zag controle 1 een losgeraakt vreemd lid niet). Directe
   vergelijking van bytes. Deze controle vergelijkt de scan van de uitvoer met de index van de bron; ze vangt een fout
   van de writer. Een fout van de scanner zelf vangt controle 3.
2. **Planning.** Twee herlezingen moeten gelijk zijn:
   `planningCanon(read(samengevoegde uitvoer)) === planningCanon(read(writeIFC(dezelfde invoer, zonder vreemd deel)))`.
   Beide lopen door dezelfde writer, dus de normalisatie bij laden speelt geen rol. `planningCanon` is nieuw, in `src/`:
   sleutel = de stabiele domein-ids (afgeleid uit de GlobalId, `stableIdFromGuid`), toewijzingen op (taak, resource) in
   leesvolgorde. `planningCanon` neemt ook de volgorde van wortel-taken en kinderen, de projectkalender en de GlobalIds
   van werkplan en schema's mee. Toegestane verschillen zijn alleen: ids en GlobalIds van hulpstukken, en tijdstempels in
   eigen owner histories. De bestaande `canon` van `check-ifc-roundtrip.ts` sleutelt op WBS-code en
   naam (`:852-881`) en is daarom niet geschikt. Daarnaast: er komen geen loze verwijzingen en geen dubbele GlobalIds
   **bij** ten opzichte van de bron (een bron met dubbele GlobalIds blijft dus op te slaan).

Faalt een controle, dan schrijft de app niets. De melding biedt een uitweg: *Exporteren zonder gebouwmodel*.

**Bestand buiten de app vervangen** (alleen met een vreemd deel). Vóór het overschrijven van het eigen doel vergelijkt de
app grootte en wijzigingstijd van het bestand op schijf met die in `ifcSource`, en bij een verschil de sha256. Is het
bestand vervangen (bijvoorbeeld door een nieuwe versie van de architect), dan schrijft de app niet. Bij Opslaan meldt hij
het en biedt hij *Opslaan als* en *Opnieuw openen* aan. AutoSave naar het bestand geeft één melding en stopt voor dit
document tot de planner kiest. Anders zou Ctrl+S het oude model terugschrijven. Zonder vreemd deel geldt de huidige
route, ook als een eigen bestand via een synchronisatiemap is gewijzigd (doel 5).

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
  `IfcWorkCalendar` zijn in IFC2X3 anders; een mengsel is ongeldig.
- **Onbekend schema**: zonder vreemd deel zoals nu (het bestand opent, opslaan schrijft de standaard,
  `ifcReader.ts:202-207`); met een vreemd deel geweigerd.
- Onder een kop `IFC4X3_ADD1` of `IFC4X3_TC1` schrijft de writer de P-stukken in de vorm van IFC4X3 (voor de
  planning-entiteiten is die gelijk).

### 4.12 Elke route

| Route | Waar | Gedrag met een vreemd deel |
|---|---|---|
| Opslaan, Opslaan als in hetzelfde formaat | `fileSlice.ts` | Volledig bestand (§4.10). |
| `exportAs('ifc')` | `fileSlice.ts:1396-1399` | Volledig bestand, zelfde controles; vervangt `ifcSource` niet (§4.8). |
| Exporteren → IFC zonder gebouwmodel | `fileSlice.ts`, nieuw | Modus `planOnly`: alleen P (de huidige uitvoer). Vraag vooraf die dat zegt. |
| `exportProjectWithPool` | `fileSlice.ts:1474` | Een export voor uitwisseling van resources: alleen planning en pool, zonder model, met een vraag vooraf. |
| Opslaan als ander formaat (STEP↔IFCX, CSV, MSPDI, XER) | `fileSlice.ts` | Alleen planning, met een vraag vooraf. Het model gaat niet mee. |
| Echte AutoSave naar het bestand | `useAutoSave.ts:148` | Volledig bestand, op de hoofdthread. Langere wachttijd met een vreemd deel (voorstel 60 s, te meten). |
| Crashherstel (10 s) | `recoverySnapshotInput.ts` | Alleen P + verwijzing naar de bron (§4.14). |
| MCP-backup | `backupService.ts:312` | P + de sha256 van de bron, geen modelkopie. Terugzetten = de planning uit de backup + het vreemde deel van de **huidige** bron van het open document; dat verandert tussen opslagrondes alleen via §4.6–4.7. D-objecten koppelen via de kaart van de huidige bron; een object dat daar niet meer staat, geldt als nieuw. Is er geen open document met een bron, dan zet de app alleen de planning terug, als nieuw document, met een melding. (Fable, ronde 5: met twee bewaarde bronnen was een backup van vóór een agentfout na twee AutoSaves zijn model kwijt.) |
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
- Het herstelmanifest krijgt per document een verwijzing `ifcSource: { sha256, size, foreign, foreignTokens, pendingSha256? }` (manifest
  versie 6, `recoveryManifest.ts:4`). De sha256 is die van de huidige bron: het bestand zoals het na het laatste opslaan op
  schijf staat. Opruimen houdt rekening met die verwijzing, zoals nu met `xerArchive` (`recoveryStore.ts:378`).
- **Opslaan en herstel in twee stappen**: vóór het wegschrijven zet de app `pendingSha256` = de sha256 van de nieuwe
  uitvoer in het manifest. Na het wegschrijven zet hij `sha256` op die waarde en wist hij `pendingSha256`. Crasht de app
  daartussen, dan accepteert herstel een bestand met `sha256` óf `pendingSha256`. Zo leidt een crash direct na opslaan
  niet tot "bron ontbreekt".
- Het manifest is **best effort**, zoals nu: is de herstelopslag niet beschikbaar (`RecoveryStorageUnavailableError`,
  #582, bijvoorbeeld in een sandbox-iframe) of geblokkeerd, dan slaat de app toch op, zonder de twee stappen. Een crash
  direct daarna kan dan tot "bron ontbreekt" leiden.
- Herstel bouwt de rest van `ifcSource` (index, klassen, kaart, `sourceSlots`, `elementLinks`) opnieuw op door de bron
  opnieuw te scannen en in te delen. Een object uit de snapshot zonder koppeling met de bron (bijvoorbeeld een tweede
  object met een dubbele GlobalId, dat van de writer een nieuwe GlobalId kreeg) geldt als nieuw.
- **Tauri**: geen kopie. Herstel leest het oorspronkelijke pad opnieuw en controleert de sha256.
- **Browser met een bestands-handle**: ook geen kopie; herstel leest via de handle en controleert de sha256.
- **Browser zonder handle** (download, site, externe bron): een kopie in IndexedDB, één keer per sha256, asynchroon, vóór
  het manifest dat ernaar verwijst (volgorde van het XER-archief, `docs/xer-recovery-guardrails.md`). Na een nieuw
  opslaan ruimt de app de oude kopie op als geen manifest er meer naar wijst.
- Vindt het herstel geen bron met de juiste sha256, en had het document een vreemd deel (`foreign`), dan krijgt het de
  toestand **bron ontbreekt**. Opslaan, AutoSave naar het bestand en MCP-export naar het oorspronkelijke doel zijn dan
  geblokkeerd. Alleen *Opslaan als* naar een nieuw bestand kan, met een tekst dat het model er niet in zit.
- Zonder vreemd deel (een eigen planning die na een crash verplaatst of gesynchroniseerd is) geldt de huidige route: het
  herstel werkt zonder bron (Opus, ronde 5: anders blokkeerde v5 ook eigen bestanden, tegen doel 5). Alleen als de bron
  tokens van andere programma's in constante slots had (`foreignTokens` > 0), meldt de app dat die bij opslaan kunnen
  vervallen.

### 4.15 Wat de planner ziet

- Na openen, in de statusbalk: "Dit bestand bevat ook een gebouwmodel en gegevens van andere programma's
  (12.345 objecten). Bij opslaan blijven die ongewijzigd."
- Bij openen, als de overname van planning uit een ander programma iets niet meeneemt: de lijst uit §4.5.
- Na opslaan, alleen als de wijzigingslijst niet leeg is: de melding uit §4.7.
- Handleiding: `howto-ifc-schema-kiezen` ("Voeg samen als laatste stap") en `docs/ifc-round-trip.md` herschrijven. Nieuwe
  how-to: "Een planning maken in een IFC-bestand met gebouwmodel".

## 5. IFCX: planning lezen en schrijven

### 5.1 Kop, versie en imports

- **Door de app begonnen**: een nieuw document, of een bron waarvan `header.id` begint met `urn:openaec:planner:`. De app
  schrijft de kop: `ifcxVersion: "ifcx_alpha"`, `dataVersion: "1.0.0"` (de versie van deze dataset, zoals IFC5 het
  bedoelt), `id: "urn:openaec:planner:<project-uuid>"`, `author`, `timestamp` (ISO 8601).
- **Elke andere bron**: de kop blijft byte-gelijk, ook `id`, `timestamp` en extra kopvelden (ifcx-explorer leest
  bijvoorbeeld `openaecComposition`, `graph.rs:78`, en weigert een andere `id` in een pakket, `package.rs:104`).
- `ifcxVersion` anders dan `ifcx_alpha`: openen geweigerd, met de gevonden waarde in de melding.
- **Versie van het OPS-profiel**: alleen `openaec::ops::document.formatVersion` op het werkplan. Een hogere hoofdversie dan de app
  kent: openen geweigerd ("gemaakt met een nieuwere versie van Open Planner Studio"). Een hogere tussenversie: openen
  mag; onbekende `openaec::ops::`-attributen blijven als vreemde bijdrage staan (§6.2). Regel voor het profiel: een
  tussenversie voegt alleen nieuwe attributen toe, nooit velden binnen een bestaand attribuut. Vindt de lezer toch een
  onbekend veld in een bekend `openaec::ops::`-attribuut, dan behandelt hij het bestand als een nieuwere hoofdversie en
  weigert hij het. Voor de gedeelde `openaec::planning::`-attributen geldt een andere regel (§5.3). Schrijft de app een
  nieuwe gedeelde naam (§5.3), dan gaat de hoofdversie van het profiel omhoog: een oudere app weigert het bestand dan
  met een melding, in plaats van een lege planning te tonen. Ook een `openaec::ops::`-attribuut dat in een nieuwe
  hoofdversie verandert, krijgt een nieuwe naam; anders botsen twee bestanden met een andere hoofdversie in één pakket
  (`SCHEMA_CONFLICT`).
- De weigeringen in deze paragraaf en in §5.3 gelden alleen voor attributen op een pad dat een domeinobject wordt
  (§5.5). Een tweede werkplan met een onbekend veld is vreemd en geeft geen weigering.
- `imports` en `schemas` van de bron blijven staan. De app voegt nooit een import toe: ifcx-explorer eist dat elke
  import een document in het pakket is (`MISSING_IMPORT`, `graph.rs:24`), en het IFC-kernschema heet daar anders
  (`"id": "ifc"`). Schema's voegt zij **per attribuutnaam** toe: voor elke naam die zij schrijft en die nog niet in
  `schemas` staat, zet zij de definitie erbij: de `openaec::ops::`-schema's zelf geschreven, de
  `openaec::planning::`-schema's als letterlijke kopie van de gedeelde bron (§5.3). Omdat een naam nooit van schema
  verandert, botst een letterlijke kopie niet met een definitie die via een import binnenkomt. Lezen heeft geen netwerk
  nodig.

### 5.2 Namespace, paden en nodes

Besluit (Ethan, 9 november 2026, op advies van Bjorn, maintainer van IFCCAD en ifcx-explorer): twee namespaces.

- **`openaec::planning::`** voor de algemene planningsgegevens: wat een planning in IFC betekent, los van dit programma
  (taken, relaties, kalenders, resources, toewijzingen, werkplan en schema's, baselines). Andere OpenAEC-programma's
  mogen deze gegevens ook schrijven en lezen; ifcx-explorer leest straks `openaec::planning::activity`.
- **`openaec::ops::`** voor wat alleen Open Planner Studio gebruikt: de profielversie, de plaats in de takenlijst,
  rekeninstellingen, werkregels, eigen velden, codes, weergaven, andere projectinstellingen, en de precisie die de vaste
  vorm van een gedeeld veld niet draagt (§5.3).

De regel voor elk veld uit `DOCUMENT_FIELDS`: heeft het veld een betekenis in IFC 4.3 of in een andere planner (een
duur, een datum, een relatie), dan staat het in `openaec::planning::`; anders in `openaec::ops::`. De verdeling per veld
is werk van fase 3 en staat in de schema's.

- **Paden**: een nieuw object krijgt als pad de UUID van het object, dezelfde 128 bits als de IFC-GlobalId (vorm uit
  fase 0, uitgangspunt kale UUID). Een bestaand pad blijft altijd zoals het in de bron staat, ook `/planning/work-0`.
  De identiteit van een object uit de bron: heeft het **hele** pad de eigen padvorm (uit fase 0: een UUID, eventueel met
  voorloop-`/`), dan die 128 bits; anders een UUID v5 van het hele pad (vaste namespace-UUID van de app). Zo krijgen
  `/a/<uuid>` en `/b/<uuid>` verschillende ids. Bestaat een id al (uit een pad of uit `openaec::ops::task`, bijvoorbeeld
  omdat een ander programma een node kopieerde), dan krijgt het volgende object `-dup-N`, zoals bij dubbele ids in STEP
  (`ifcReader.ts:1731-1734`). Die UUID is
  het domein-id en de GlobalId. `ifcSource` bewaart per
  domein-id het bronpad, en `detached` bewaart het bronpad van een verwijderd object (§6.6). De writer kiest het pad uit
  `ifcSource`, dan uit `detached`, en pas daarna een nieuw pad. Zo bevat geen domein-id een `/`, en blijft de identiteit
  gelijk na elke ronde, ook na Ctrl+Z na opslaan en bij opslaan als STEP. Ook de paden in het taakveld van een
  baseline gaan in die kaart, zodat een verwijderde baselinetaak bij elk opslaan hetzelfde pad houdt.
- **Interne id**: wijkt het interne id van een taak af van het id uit haar pad (een taak uit STEP met
  `OPS_TaskIdentity`, `ifcReader.ts:193-199`), dan staat het in `openaec::ops::task`. Koppelingen tussen projecten
  (`src/engine/externalLinks.ts:137-142`) blijven zo werken na STEP → IFCX.
- **Projectkalender**: houdt in het domein het id `cal-default` (`defaultCalendar.ts:20`); `ifcSource` bewaart haar pad.
  De lezer herkent haar aan het verwijsveld naar de kalender in `openaec::planning::workplan`, en zonder dat veld als de
  eerste kalender in bestandsvolgorde, zoals STEP.
- **Verwijzingen** tussen objecten (ouder, voorganger en opvolger, toewijzing, baseline) staan in IFCX altijd als pad.
  Een baseline verwijst met gewone tekst naar haar taken, niet met een verwijzing die moet bestaan: een baseline houdt
  bewust taken vast die al verwijderd zijn (`removeTaskSubtrees`, `src/state/taskTree.ts:186-200`;
  `ifcReader.ts:3615-3619`). De andere eigen verwijsvelden wijzen altijd naar een levend object.
  Interne ids die STEP als id bewaart (`OPS_TaskIdentity`, `TaskGuids` in `OPS_Baselines`, `ifcReader.ts:3618-3660`)
  worden bij schrijven naar IFCX het pad van het object en bij lezen weer het domein-id van dat pad.
- **Planningspad**: een pad met een bekend `openaec::planning::`-attribuut (gesloten lijst, zie de tabel). De app maakt
  geen pad met alleen `openaec::ops::`-attributen.

| Planningsgegeven | Node | Attributen |
|---|---|---|
| Werkplan | `<plan-uuid>` | `openaec::planning::workplan`, `openaec::ops::document` (`formatVersion`, projectinstellingen) |
| Werkschema | `<schema-uuid>` | `openaec::planning::schedule` |
| Taak | `<taak-uuid>` | `openaec::planning::activity`, `openaec::ops::task` |
| Relatie | `<rel-uuid>` | `openaec::planning::sequence` |
| Kalender | `<kal-uuid>` | `openaec::planning::calendar` |
| Resource | `<res-uuid>` | `openaec::planning::resource` (met het resource-subtype als veld) |
| Toewijzing | `<toew-uuid>` | `openaec::planning::assignment` |
| Baseline | `<bl-uuid>` | `openaec::planning::baseline` |

- De app schrijft geen `bsi::ifc::class`. Daarvoor zou een import van het IFC-kernschema nodig zijn (§5.1), en de
  planningsattributen zeggen al wat een node is. Een `bsi::ifc::class` in de bron is altijd een vreemde bijdrage.
- De app schrijft een `openaec::ops::`-attribuut alleen als zijn inhoud afwijkt van wat de lezer zonder dat attribuut
  zou afleiden (§5.5): "afwezig blijft afwezig" geldt ook voor een heel attribuut. Lezer en writer gebruiken daarvoor
  één gedeelde afleidfunctie. Een vreemde taak die de planner niet
  aanraakte, krijgt dus geen `openaec::ops::task`. De tabel noemt de
  attributen die er zeker zijn; een relatie, kalender of resource met app-gegevens krijgt `openaec::ops::sequence`,
  `…::calendar` of `…::resource`. Een leeg attribuut alleen als merkteken bestaat niet: eigendom hangt niet af van
  `openaec::ops::` (§6.2).
- **Hiërarchie zonder `children`**: de WBS staat als veld `parent` (het pad van de ouder) in
  `openaec::planning::activity`; de plaats onder de ouder als volgnummer in `openaec::ops::task` (leesregel in §5.5).
  Werkschema,
  toewijzing en baseline verwijzen ook met een pad-veld. De app schrijft geen `children`. Reden: `children` en
  paden met een `/` erin werken niet samen in de IFC5-composer (een pad met voorloop-`/` is nooit een wortel,
  `cycles.ts:50`; `children` naar `/planning/work-0` geeft `Unknown node`, `compose.ts:167`). Zo blijft ook elke
  `children`-bijdrage van een ander byte-gelijk.
- De `openaec::ops::`-schema's worden met de hand geschreven, met volledige `objectRestrictions`. Een test valideert de
  eigen attributen van elke uitvoer met de validator van IFC5-development.

### 5.3 Gedeelde planningsschema's

- **Eén bron.** De schema's van `openaec::planning::` hebben één bron, gedeeld met andere OpenAEC-programma's (met Bjorn
  af te spreken, §11). De app neemt ze byte-gelijk over als letterlijke kopie per ontbrekende naam (§5.1). Een eigen afwijkende kopie
  zou ifcx-explorer laten weigeren (`SCHEMA_CONFLICT`, `crates/ifcx-project/src/graph.rs:81-84`).
- **Elke wijziging krijgt een nieuwe naam**, ook een toevoeging van een veld. Dezelfde naam heeft dus altijd hetzelfde
  schema. De lezer blijft oude namen lezen. (Bjorn adviseerde op 9 november 2026 "oude naam blijven lezen" bij een
  andere structuur; dat ook een toevoeging een nieuwe naam krijgt, komt uit council-ronde 9 en staat op de lijst voor
  Bjorn.) Een nieuwe naam verhoogt de hoofdversie van het profiel (§5.1). Een attribuut onder een oude naam schrijft de
  app terug onder die oude naam; een nieuw object krijgt de nieuwste naam.
- **Vaste vorm per veld.** Elk gedeeld veld heeft één vaste waardevorm in het schema; de app schrijft altijd die vorm.
  Voorbeeld: ifcx-explorer leest `start` en `endExclusive` als datum zonder tijd en eist een venster van minstens één
  hele dag (`viewer/src/studios/adapters.ts:403-407`).
- **Projectie.** Draagt de vorm niet alles wat de app weet (het uur), dan staat de precieze waarde in `openaec::ops::`,
  en ligt per gedeeld veld één projectie vast van de precieze waarde naar de vaste vorm. Voor de datums (projectkalender,
  tijd van de app):
  - `start` = de datum van het startmoment;
  - `endExclusive` = de datum van het eindmoment als dat precies 00:00 is, anders die datum plus één dag (dus
    1 juni 07:00–16:00 geeft 1 juni tot 2 juni; ma 08:00 tot wo 17:00 geeft ma tot do);
  - een mijlpaal (eind = start): `endExclusive` = startdatum plus één dag (op de lijst voor Bjorn, §11).
- **Leesregel.** De precieze waarde geldt alleen als haar projectie gelijk is aan het gedeelde veld; anders heeft een
  ander programma het veld veranderd en wint het gedeelde veld. Een automatisch geplande taak van de app waarvan zo een
  datum veranderde, wordt handmatig gepland met de nieuwe datums; anders zet de volgende berekening (F5) haar terug.
  De melding bij openen noemt het aantal zulke taken. Een datum zonder precieze waarde leest de app als 00:00
  van die datum, voor eigen en vreemde taken gelijk (zoals de brug van ifcx-explorer, `adapters.ts:406-407`).
- `openaec::planning::activity` heeft in elk geval `start` en `endExclusive` met de betekenis uit ifcx-explorer
  (`crates/ifcx-reference/src/lib.rs:96-102`). `status` betekent daar de rijpheid van de gegevens (`example`, `source`,
  `derived`), niet de voortgang; wat de app daar schrijft, spreken we af met Bjorn. Voorgangers staan in
  `openaec::planning::sequence`, niet in de taak.
- Er komt geen aparte kopie in `openaec::activity` (dat was open besluit 2; het vervalt).
- **Onbekend veld in een gedeeld attribuut** (een ander programma voegde het toe): de lezer weigert het bestand niet.
  Het veld blijft als byte-gelijk token in hetzelfde attribuut staan (§6.2). Een bekend veld met een ongeldige waarde
  (verkeerd type of vorm) geeft wel een weigering, met pad en veld in de melding.
- **Naam van een taak**: het afgesproken naamveld in `openaec::planning::activity` gaat voor op `openaec::label`. De app
  schrijft een nieuwe naam in dat veld; `openaec::label` is vreemd en blijft staan.
- **Afwezige velden blijven afwezig.** Een bekend optioneel veld dat in de bron ontbrak, schrijft de app niet zolang
  het domein de waarde na openen houdt. Velden buiten de afgesproken kern zijn optioneel.

### 5.4 Wat wel en niet in IFCX gaat

- Wel: alles wat in IFC4X3 round-tript. Bron: `DOCUMENT_FIELDS` en `IFC_SAVE_KEYS`. Een test eist dat elk veld dat in
  IFC4X3 round-tript, ook in IFCX round-tript.
- Niet: het XER-bronarchief (`xerSourceArchive`). Opslaan als IFCX van een project met zo'n archief geeft vooraf een
  melding: "Het P6-bronarchief gaat niet mee naar IFCX."
- Niet: koppelingen taak↔bouwdeel bij omzetten STEP↔IFCX (het model gaat ook niet mee).

### 5.5 Planning van een ander programma

Besluit (Ethan, 9 november 2026): de app opent een planning die een ander programma in `openaec::planning::` schreef, en
de planner kan die bewerken. Voorbeeld: IFCCAD slaat een gebouw op met tien taken in `openaec::planning::activity`. De
planner opent het bestand, ziet de tien taken in de Gantt, verschuift er een en slaat op. Wat de app niet kent, blijft
staan.

- **Welke objecten**: zoals `selectPlanning` in STEP (§4.2). Het eerste werkplan in bestandsvolgorde is de planning;
  elke activity wordt een taak, ongeacht het werkplan (zoals `ifcReader.ts:1749`). Een baseline verwijst naar levende
  taken (`BaselineTask.taskId`, `src/types/baseline.ts:2-5`) en maakt een taak dus niet tot baselinekopie; kalenders en
  resources allemaal. Een ander werkplan wordt geen domeinobject; zijn attributen zijn dus vreemd (§6.2) en blijven
  staan. **Geen werkplan in de bron** (zo schrijft ifcx-explorer nu: 22 taken, nul werkplannen): de app maakt bij
  opslaan een nieuw werkplanpad.
- **Afbeelding op het importcontract.** Een taak zonder `openaec::ops::task` leest de app zoals de bestaande brug van
  ifcx-explorer haar nu al aanlevert (`adapters.ts:375-417`): handmatig gepland, met `start` en `endExclusive` als vaste
  datums en de duur als verstreken tijd. Openen verandert die datums dus niet. Verder: het document krijgt
  `recordedTimesOrigin: 'ifc'` (al "verse import van een ander programma", `isFreshImportOrigin`) als het gekozen werkplan
  geen `openaec::ops::document` heeft; `recordedFields` volgt uit de aanwezige velden; het
  `timeModel` is het huidige, zodat er geen omzetting van een oud bestand volgt (`minuteModel.ts:451-454`). De naam
  komt uit het afgesproken naamveld (§11; ifcx-explorer gebruikt nu `openaec::label`).
- **Volgorde**: een volgnummer is de plaats van de taak onder haar ouder. Taken zonder volgnummer vullen de open plaatsen,
  in de volgorde van hun eerste entry. Een volgnummer buiten de lijst komt achteraan. De writer laat een langste deelrij
  van taken die in entryvolgorde en in domeinvolgorde gelijk staan zonder volgnummer, en geeft de andere taken een
  volgnummer (langste stijgende deelrij, in n log n; dezelfde gedeelde afleidfunctie als in §5.2). Bij gelijke lengte
  kiest hij eerst de taken die toch al een `openaec::ops::task` krijgen, daarna de latere entry. Voorbeeld: taken `work-0..3` zonder volgnummer; de planner voegt N in tussen `work-1` en `work-2`. Alleen N
  krijgt volgnummer 2; de andere vullen plaats 0, 1, 3 en 4. Taken die de planner niet aanraakte, houden hun onderlinge
  volgorde en krijgen zo weinig mogelijk volgnummers.
- **Opslaan**: de app schrijft de bekende velden van elk planningsattribuut uit het domein, in de vaste vorm (§5.3), en
  de onbekende velden als token (§6.2). Een veld dat de planner niet aanraakte, houdt zijn waarde, ook na opslaan,
  sluiten, heropenen en opnieuw opslaan.
- **Voorgangers**: zolang de afspraak met Bjorn er niet is (§11), heeft de testfixture haar `predecessor`-velden
  omgezet naar `openaec::planning::sequence`-nodes; een `predecessor` in de activity is een onbekend veld.
- **Verwijderen**: verwijdert de planner zo'n taak, dan gaan de planningsattributen weg; andere attributen op het pad
  blijven byte-gelijk staan (§6.2, laatste punt).
- **Onbekend `openaec::planning::`-attribuut** (bijvoorbeeld een nieuwere gedeelde naam uit een ander programma): de app
  opent het bestand, laat het attribuut staan als vreemde bijdrage, en meldt: "Dit bestand bevat planningsgegevens in een
  nieuwere vorm die deze versie niet kent; die blijven ongewijzigd staan."
- **Melding bij openen**: heeft het gekozen werkplan geen `openaec::ops::document` (of is er geen werkplan), dan toont
  de app één keer: "Deze planning komt uit <author uit de kop>. Gegevens die Open Planner Studio niet kent, blijven bij
  opslaan in het bestand." Na opslaan heeft het werkplan dat attribuut en komt de melding niet terug.
- **Grens**: een programma dat geen vreemde IFCX terugschrijft (IFCCAD kan dat nog niet,
  `docs/experiments/ifccad-document-lifecycle.md:281-288`), laat bij een rondgang de `openaec::ops::`-gegevens vallen.
  Wat het van `openaec::planning::` terugschrijft, leest de app zoals hierboven. Een verzegeld pakket van ifcx-explorer
  weigert na opslaan met `CHECKSUM_MISMATCH` (`package.rs:100`) tot iemand het opnieuw verzegelt; de app verzegelt niet.
  Verwijzingen uit andere documenten van zo'n pakket naar een verwijderde taak ziet de app niet.

## 6. IFCX: alles wat geen planning is, behouden

### 6.1 Entries als tokens

- Een JSON-tokenizer op bytes vindt de grenzen van `header`, `imports`, `schemas` en elke entry in `data`.
- Per entry decodeert hij de structuur: `path`, de sleutels en waarden van `children` en `inherits`, en de **gedecodeerde
  namen** van de attributen (dus ook een ontsnapte naam als `"openaec::planning::activity"`). De waarden van attributen blijven
  ruwe bytes.
- Alleen de waarden van eigen attributen worden geparsed, per veld, met het ruwe token van elk veld erbij. Geen
  JSON-parser die getallen kan veranderen raakt vreemde waarden of onbekende velden.

### 6.2 Eigendom per bijdrage

Eigendom hangt alleen af van wat de app als domeinobject leest, nooit van een merkteken. Daardoor is het eigendom
hetzelfde vóór en na opslaan, en na heropenen.

- **Eigen bijdragen**: bekende `openaec::planning::`- en `openaec::ops::`-attributen op een pad dat een domeinobject wordt
  (§5.5), zonder hun onbekende velden.
- **Vreemde bijdragen**: al het andere. Ook een bekend attribuut op een pad dat geen domeinobject wordt (een tweede
  werkplan, een losse `openaec::ops::task` zonder activity), een onbekend attribuut in de bekende namespaces,
  `openaec::activity`, `children`, `inherits` en `bsi::ifc::class`.
- **Meer bijdragen van hetzelfde attribuut op één pad**: IFC5 laat het laatste hele attribuutobject winnen
  (`compose.ts`). Alle bijdragen van een eigen attribuut op een pad zijn eigen. De lezer neemt de waarde van de laatste
  bijdrage. De writer schrijft het attribuut één keer, op de plek van de **eerste** bijdrage; de andere bijdragen
  vervallen. Zo verschuift een werkplan of taak niet achter een ander object, en blijft de volgorde bij heropenen gelijk.
  De onbekende velden komen uit de laatste bijdrage.
- **Velden**: bekende velden schrijft de writer uit het domein in de vaste vorm (§5.3). Omdat de lezer elke andere vorm
  weigert, geeft een onveranderd veld dezelfde waarde; een brontoken per bekend veld is niet nodig. Per (pad, attribuut)
  bewaart de app alleen welke bekende velden afwezig waren, met hun domeinwaarde na openen (§5.3).
  Onbekende velden zijn byte-gelijke tokens in hetzelfde attribuut, in hun oorspronkelijke volgorde, na de bekende
  velden. Vervalt het attribuut (object verwijderd), dan vervallen ze mee.
- Een entry zonder eigen bijdragen: **byte-gelijk**, op zijn plek.
- Een entry met alleen eigen bijdragen: opnieuw geschreven, **op dezelfde plek** (als hij de eerste bijdrage van zijn
  attributen bevat; anders vervalt hij).
- Een gemengde entry: de app schrijft hem op zijn plek terug zonder de eigen bijdragen, en zet de eigen bijdragen in een
  eigen entry **direct erna**. De vreemde attribuutwaarden en de vreemde `children`/`inherits` zijn byte-gelijke tokens;
  alleen de omlijsting van de entry (accolades, komma's) wordt opnieuw gemaakt. Omdat de eigen entry direct na de
  gemengde komt, verandert de voorrang tegenover alle andere entries niet (een latere vreemde `children.sub = null` houdt
  zijn werking).
- Nieuwe eigen entries komen achteraan.
- De app schrijft alleen op planningspaden die een domeinobject zijn, op nieuwe paden, en een lege entry op een pad
  volgens de regel hieronder.
- Vervalt een planningspad (taak verwijderd), dan blijven vreemde bijdragen op dat pad byte-gelijk staan, zonder melding
  (een node met alleen vreemde attributen is geldige IFCX). Dat sluit aan bij §4.7 regel 4.
- **Verwijzingen naar een verwijderd pad**: zou een bronpad na verwijderen geen entry meer hebben, en komt het pad nog
  voor als gedecodeerde tekenreeks in een vreemde bijdrage in de uitvoer (in `children`, `inherits`, een
  `Reference`-veld, `openaec::links`, of een onbekend veld van een eigen attribuut, zoals `predecessor`), dan schrijft de app op de plek van de eerste vervallen entry een lege entry
  `{"path":"…"}`. De tokenizer decodeert daarvoor alleen de tekenreeksen, ook met ontsnapte tekens als `\/` of
  `\u002f`; getallen en andere tokens blijven ongemoeid, en vreemde schema's zijn niet nodig. ifcx-explorer weigert
  anders met `MISSING_REFERENCE` (`graph.rs:188-194`). Ctrl+Z na opslaan zet de taak terug op dat pad (`detached`, §5.2).
  Verwijzingen uit andere documenten in een pakket ziet de app niet (grens, §5.5). Fase 0 controleert dat de gepinde versie van
  ifcx-explorer een entry zonder `attributes` accepteert.

Voorbeeld van een gemengde entry, vóór en na opslaan (de taak is hernoemd):

```json
{"path":"0f2c…","attributes":{"openaec::planning::activity":{"name":"Fundering"},"openaec::label":"F1"}}
```
wordt
```json
{"path":"0f2c…","attributes":{"openaec::label":"F1"}},
{"path":"0f2c…","attributes":{"openaec::planning::activity":{"name":"Fundering en kelder"},"openaec::ops::task":{…}}}
```
(Een `bsi::ifc::class` in de bron zou in de eerste entry blijven staan, als vreemde bijdrage.)

### 6.3 Controles

1. **Vreemd deel**: alle entries met vreemde bijdragen staan in dezelfde volgorde, met dezelfde vreemde tokens; een
   entry zonder eigen bijdragen is byte-gelijk; elk onbekend veld in een eigen attribuut staat byte-gelijk in hetzelfde
   attribuut op hetzelfde pad, zolang het object bestaat; elk bronpad dat als gedecodeerde tekenreeks in een vreemde
   bijdrage of een onbekend veld staat, bestaat als pad; eigen entries bevatten alleen eigen attribuutnamen en geen `children` of `inherits`;
   een lege entry staat alleen op een vervallen bronpad; kop (behalve in een document dat de app begon), `imports` en `schemas` van de bron zijn byte-gelijk op de
   toevoegingen uit §5.1 na.
2. **Planning**: twee herlezingen, zoals §4.10.

Een aparte compositiecontrole bij opslaan is niet nodig: omdat de vreemde entries in dezelfde volgorde en byte-gelijk
blijven, en eigen bijdragen direct na hun gemengde entry komen, volgt de vreemde compositie uit controle 1. De tests in
§10 vergelijken wel de compositie per pad met de IFC5-flattener (`FlattenCompositionInput`, `compose.ts:60`).

### 6.4 Koppelingen in IFCX

`openaec::links` met `relation: "schedules"` op een planningspad leest de lezer als `elementLinks` met richting `output` en
`target` = het pad. Is het laatste segment 32 hexadecimale tekens, dan rekent de app er een GlobalId uit (dezelfde 128
bits, zoals in Open-Calculations-Studio `identiteit.ts`); anders blijft alleen het pad. De app schrijft zelf geen
koppelingen; die komen pas met #748.

### 6.5 Imports met data

`imports` kan andere bestanden als datalaag laden. De app lost die in deze versie niet op: hij bewaart de import-entry en
leest alleen de planning uit het geopende bestand. Een koppeling naar een pad dat niet in dit bestand staat, toont "niet
in dit bestand".

### 6.6 De bron bij IFCX

`ifcSource` werkt bij IFCX zoals bij STEP (§4.8, §4.14), met deze inhoud: de bronbytes, sha256, de grenzen van `header`,
`imports`, `schemas` en elke entry (§6.1), per entry de eigen en vreemde bijdragen (§6.2), per (pad, attribuut) de
afwezige bekende velden met hun domeinwaarde na openen en de tokens van de onbekende velden (één structuur, §6.2), per
domein-id het bronpad (§5.2),
`elementLinks` (§6.4), `foreign`, grootte en wijzigingstijd. De tokens van onbekende velden, het bronpad en de
`elementLinks` van een verwijderd object gaan ook in `detached` (undo na opslaan), zoals `sourceSlots` en `foreignMembers` bij STEP. `foreign` is waar als er een vreemde bijdrage of
een onbekend veld is, of als de kop van een ander is (§5.1); dat is dezelfde betekenis als bij STEP. Een onbekend veld in een
`openaec::ops::`-attribuut maakt het bestand onleesbaar (§5.1). Manifest 6, de twee stappen bij opslaan, "bron
ontbreekt" (alleen met `foreign`) en de controle op een vervangen bestand gelden ongewijzigd.

## 7. Bestanden, dialogen en keuzes

- `formatRegistry.ts`: formaat `ifcx` (`extensions: ['ifcx']`, `canBeSaveTarget: true`), gelezen als bytes.
  Ook `parseExternalSource` (`fileSlice.ts:1500`, koppelingen tussen projecten) leest `.ifcx`.
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
| 3 | IFCX-planning zonder vreemde inhoud: voorstel gedeelde schema's aan Bjorn (§5.3), profiel `openaec::ops::` 1.0.0, schema's, lezer, writer, dialogen, keuze, vraag bij opslaan, round-trip STEP↔IFCX, handleiding over IFCX (nl/en; de andere talen via de vertaalstraat). Achter de flag. | 4–6 PR's | hoog: veel velden, alfa-formaat |
| 4 | IFCX met vreemde inhoud: tokenizer, eigendom per bijdrage, planning van een ander programma (§5.5), onbekende velden als token, de lege entry bij verwijzingen, `openaec::links`, `ifcSource` voor IFCX (§6.6), handleiding en `docs/ifc-round-trip.md` bijwerken. Flag eraf. | 2–3 PR's | middel |

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
  IFC2X3-planningsbestand en een IFC2X3-model, een samengevoegd bestand waarin het project naar de eigen owner history
  wijst, een bestand met twee werkplannen, en een oud eigen bestand (`'0.1'`) samengevoegd met een model. Plus `Hello Wall`, een groter IFC5-voorbeeld en IFCX-bestanden met een
  gemengde entry gevolgd door een vreemde `null`-child, een ontsnapte attribuutnaam en een groot geheel getal; een
  planning van een ander programma in `openaec::planning::` zonder `openaec::ops::`, met een onbekend veld, een datum
  zonder tijd en een groot geheel getal in een gedeeld attribuut; het voorbeeld `work-packages.ifcx` van ifcx-explorer
  (`openaec::activity`) en een kopie met de nieuwe attribuutnaam.
- **Poort: eigen bestanden = 100 % P en uitvoer zoals nu.** Elk `public/examples/*.ifc`, de echte writer-uitvoer in
  `tests/planning/fixtures/` (niet de fixtures met bewust hernoemde properties, zoals `werkdag-einde-tussenwaarde.ifc`, en
  niet die met een model), de uitvoer van de writer voor elk voorbeeldproject, en uitvoer van oudere release-tags geven
  na indeling alleen P, zonder vreemde leden en zonder vreemde herkomst. Oude tags minstens één per formaatwissel: tot en
  met v2026.7.3 (kale sleutels in `OPS_Assignments`), vóór 2026-07-03 (`IfcTask` met 12 argumenten), vóór 2026-09-28
  (`'0.1'`, letterlijke tekst). Voor elk
  zulk bestand is de uitvoer van de nieuwe route byte-gelijk aan `writeIFC(readIFC(bestand))` van de huidige code, met een
  vaste klok. Extra gevallen: eigen bestand, statusdatum wijzigen, taak en baseline hernoemen, een toewijzing toevoegen:
  weer byte-gelijk aan de huidige writer.
- `check-ifc-foreign-preserve.ts`:
  - openen → opslaan zonder wijziging → alle niet-P-stukken byte-gelijk; een tweede opslaan → niet-P weer byte-gelijk en
    de planning gelijk volgens `planningCanon` (P-stukken mogen andere hulp-ids en tijdstempels hebben);
  - een onbekende property (`VendorSecretNote`) in `OPS_Calendar` en in `OPS_ProjectSettings` blijft byte-gelijk; een veld
    van `OPS_CustomFields` uit het eigen template wordt gelezen en geschreven;
  - een `OPS_Calendar` gedeeld door kalender en wand: herlezing geeft `HoursPerDay = 8`; na een wijziging van de kalender
    houdt de wand de oude pset, en de kalender heeft één `OPS_Calendar`;
  - FS en SS tussen hetzelfde paar taken: twee relaties, elk met eigen GlobalId en vertraging; een toewijzing per resource
    uit Bonsai met `QuantityInProcess` blijft na opslaan een eigen relatie met die hoeveelheid;
  - Bonsai-bestand met project 'Proj' en werkplan 'Plan': na opslaan, en na een tweede opslaan, en na sluiten, opnieuw
    openen en opslaan, heet het project 'Proj' en het werkplan 'Plan', en houdt de toewijzing per resource haar
    `QuantityInProcess`. Vanaf het tweede opslaan is de uitvoer byte-gelijk aan die van het eerste (vaste klok);
  - Bonsai-relaties en bewerkingen: een taak een niveau hoger zetten, een toewijzing verwijderen terwijl taak en resource
    blijven, de kalender van een taak wijzigen, de volgorde van kinderen wijzigen: na herlezen klopt de planning en
    staat geen kind in twee `Nests`;
  - twee werkplannen: na opslaan, en na een tweede opslaan, is hetzelfde werkplan D (proeven van Opus en Sol, ronde 6);
  - volgorde in een bestand met model: een wortel-taak verplaatsen, een nieuwe wortel bovenaan, een kind invoegen en de
    WBS opnieuw nummeren, een andere projectkalender kiezen: na herlezen gelijk aan de uitvoer zonder vreemd deel
    (proeven van Opus, ronde 7);
  - een Bonsai-kalendertoewijzing naar de projectkalender blijft na openen en opslaan staan (`bonsai-achtig.ifc` `#64`);
  - `OPS_Timephased`, `OPS_TimephasedWindow` en oude kale `OPS_Assignments`-sleutels in een eigen bestand: 100 % P; de
    sturing wissen, opslaan en heropenen: de waarde is weg (proeven van Sol en Opus, ronde 7);
  - een vreemd lid in `OPS_TaskNotes` en een in `OPS_Assignments` op dezelfde taak: taak verwijderen, opslaan, Ctrl+Z,
    opslaan: elk lid hangt weer in zijn eigen pset (proef van Sol, ronde 7);
  - een vreemd lid dat de herkenner in de uitvoer als eigen zou lezen (een veld "Zone" dat de planner later maakt): het
    vreemde lid vervalt, met een melding; een vreemde `#n`-sleutel in `OPS_Assignments` is eigen;
  - de laatste notitie van een taak met een vreemd lid in `OPS_TaskNotes` wissen, opslaan, heropenen, opnieuw opslaan:
    het lid hangt nog aan de taak (proef van Sol, ronde 8);
  - `OPS_StructureMeta` met lege lijsten en templates: de typen komen uit de templates, 100 % P (proef van Sol, ronde 8);
  - een Bonsai-bestand zonder werkplan of kalender: vanaf het tweede opslaan byte-gelijk;
  - alle taken wissen in een bestand met een Bonsai-baselineboom, opslaan, opslaan: de boom blijft;
  - AutoSave na een handmatig opslaan schrijft niet op de oude bron;
  - een onbekende property in `OPS_Assignments` en in `OPS_ActivityCodes` blijft byte-gelijk (proeven van Sol, ronde 6);
  - `IfcRelAssignsToControl` van een `IfcCostItem` naar taken blijft A; een taak verwijderen volgt §4.7;
  - oud eigen bestand (`'0.1'`) met model, met een `\` in een JSON-pset en een `é` in een taaknaam: na openen, opslaan en
    herlezen dezelfde gegevens;
  - de herstelsnapshot en de MCP-backup bevatten geen bronbytes;
  - de manifeststap faalt (`RecoveryStorageUnavailableError`): opslaan lukt toch;
  - het bestand op schijf wordt vervangen terwijl een document met vreemd deel open is: opslaan schrijft niet en AutoSave
    stopt na één melding; bij een eigen bestand zonder vreemd deel verandert er niets;
  - MCP-backup van vóór een wijziging, na twee AutoSaves terugzetten: het model blijft;
  - crash zonder bron bij een eigen bestand: geen blokkade, wel de melding;
  - taak toevoegen, wijzigen, verplaatsen onder een ongewijzigde ouder en verwijderen → vreemd deel byte-gelijk op de
    wijzigingslijst na, en die lijst klopt; gedeelde kalender;
  - verwijderen → opslaan → Ctrl+Z → opslaan: de vreemde stukken staan er weer;
  - drie keer opslaan van een bestand met een taak gekoppeld aan een wand en een vreemde pset op een taak: na de eerste
    ronde blijft het aantal stukken gelijk (geen verweesde `IfcTaskTime` of owner history). De eerste ronde zelf mag
    stukken toevoegen: naast een gedeelde owner history schrijft de writer zijn eigen (simulatie van Opus, ronde 5: +1 tot
    +6, daarna gelijk);
  - een onbekende `OPS_AndereTool`-pset en een onbekende property binnen een bekende pset blijven staan;
  - een gemengde `IfcRelAggregates` werkplan→(live-schema, Bonsai-baseline) en een gemengde `IfcRelNests`: geen dubbele
    `Decomposes`/`Nests` na opslaan, ook niet na een wijziging van de structuur;
  - een `LongDescription` op een taak in een verder eigen bestand blijft staan;
  - crash tussen wegschrijven en het bijwerken van het manifest: herstel vindt de bron via `pendingSha256`;
  - herstel met bron op het oude pad, via een handle, met een kopie, en zonder bron ("bron ontbreekt" blokkeert opslaan).
- **Controles zelf testen**: een writer die bewust een vreemd stuk weglaat, verdubbelt of verschuift, moet door controle 1
  worden tegengehouden; `planningCanon` met dubbele namen en WBS-codes.
- `check-ifcx-roundtrip.ts`: elk voorbeeldproject IFC → IFCX → IFC zonder verschil volgens `planningCanon` (drie hebben
  een baseline); de veldentest uit §5.4; de compositie per pad met de IFC5-flattener; planning van een ander programma openen, één taak verschuiven, opslaan: alleen de
  velden van die taak veranderen, onbekende velden zijn byte-gelijk, ongewijzigde velden houden hun waarde, afwezige velden blijven
  afwezig; **openen → opslaan → sluiten → heropenen → opslaan**: tweede uitvoer
  byte-gelijk aan de eerste, vreemde compositie gelijk; `planningCanon(open(x)) === planningCanon(open(save(open(x))))`
  met een taak binnen één dag, een einde op 00:00, een handmatige taak en een eindmijlpaal; openen zonder bewerken en
  opslaan verandert geen datum; een taak uit ifcx-explorer hernoemen, opslaan, heropenen: nieuwe naam, `openaec::label`
  ongewijzigd; een taak met een vreemde `children`-verwijzing ernaar verwijderen, opslaan, heropenen: lege entry, geen
  `MISSING_REFERENCE`; hetzelfde met een vreemde `openaec::links`-verwijzing en met een ontsnapte verwijzing
  (`"\u002fplanning\/work-0"`); **verwijderen → opslaan → Ctrl+Z → opslaan → heropenen**: de taak staat op haar oude
  pad en haar `elementLinks` zijn terug; een baseline zetten, de taak verwijderen, opslaan (ook vanuit STEP met een
  vervallen baselinetaak): de projectcontrole van ifcx-explorer laadt het bestand; twee activities op
  `/planning/a/<uuid>` en `/planning/b/<uuid>`: twee taken, één verwijderen, heropenen: de andere blijft; twee
  activity-bijdragen op één pad met verschillende onbekende velden en een class in de eerste entry: één bijdrage op de
  plek van de eerste, met de onbekende velden van de laatste, de class blijft vreemd, ook na heropenen; werkplan W1, W2,
  nog een bijdrage van W1: na opslaan en heropenen is W1 de planning; de app voegt geen class en geen import toe, en de
  kop van een andere bron blijft byte-gelijk; een onbekend `openaec::planning::`-attribuut geeft de melding;
  **volgorde** in een planning van een ander programma: een taak achteraan toevoegen, ertussen invoegen, verplaatsen,
  en verwijderen → opslaan → Ctrl+Z → opslaan; na heropenen dezelfde volgorde, en alleen de taken die de leesregel
  nodig heeft, hebben een volgnummer; een vreemde taak in een baseline verwijderen, opslaan, heropenen, opslaan: het pad
  blijft gelijk; een taak uit STEP met `OPS_TaskIdentity` → IFCX → heropenen: een koppeling uit een ander project vindt
  haar; **crashherstel**: vreemde IFCX openen → taak toevoegen → opslaan → verder bewerken → herstel na crash →
  opslaan: dezelfde bronpaden, baselinekoppelingen en onbekende velden;
  baseline zetten, een taak toevoegen, opslaan als IFCX, heropenen: alle taken zichtbaar; een bestand met alleen
  activities krijgt een werkplan en een eerste relatie, en de IFC5-validator vindt elk schema; een vreemde taak die de
  planner niet aanraakte krijgt geen `openaec::ops::task`; elke eigen uitvoer en de omgezette `work-packages.ifcx` laden
  met de projectcontrole van ifcx-explorer (`crates/ifcx-project`, gepinde commit, in de IFC-workflow in CI); de taak verwijderen laat de vreemde attributen op het pad staan; Ctrl+Z na opslaan zet de onbekende velden
  terug; `openaec::activity` blijft byte-gelijk en wordt niet gelezen; `work-packages.ifcx` met de attribuutnaam
  omgezet naar `openaec::planning::activity` en `predecessor` omgezet naar sequence-nodes (22 taken, paden
  `/planning/work-N`, geen werkplan) opent, is te bewerken,
  krijgt een nieuw werkplan en houdt zijn paden; een tweede werkplan en een losse `openaec::ops::task` blijven
  byte-gelijk.
- **Onafhankelijke controle in CI** (eigen workflow, zoals `headless-api.yml`): IfcOpenShell leest invoer en uitvoer en
  vergelijkt alle niet-P-entiteiten op `#id`, type en attributen, plus `ifcopenshell.validate`. De validator van
  IFC5-development controleert de eigen attributen van de IFCX-uitvoer (vreemde attributen kunnen hun schema via een
  import hebben die de validator niet oplost).

## 11. Open punten

**Besluiten voor Ethan**

De besluiten zijn genomen (Ethan, 9 november 2026):

1. **Namespace**: `openaec::planning::` voor algemene planningsgegevens en `openaec::ops::` voor wat alleen deze app
   gebruikt (advies Bjorn, §5.2).
2. **`openaec::activity` meeschrijven**: vervalt; ifcx-explorer leest `openaec::planning::activity` (§5.3).
3. **Planning van een ander programma in `openaec::planning::`**: openen en bewerken (§5.5).

**Afstemmen met Bjorn** (via Ethan, vóór de eerste writer-PR van fase 3; §5.3):

- waar de gedeelde schema's van `openaec::planning::` staan (één bron, URI voor `imports`);
- de vaste vorm van elk gedeeld veld (datum zonder tijd voor `start` en `endExclusive`?);
- wat `status` betekent en wat de app er schrijft;
- het naamveld in de activity, met voorrang op `openaec::label` (§5.3);
- de projectie van precieze tijden naar `start` en `endExclusive`, en hoe een mijlpaal eruitziet (§5.3);
- dat elke wijziging van een gedeeld schema, ook een toevoeging, een nieuwe naam krijgt (§5.3);
- welke verwijsvelden (`parent`, sequence, toewijzing) het type `Reference` krijgen; het taakveld van een baseline is
  gewone tekst, want een baseline wijst ook naar verwijderde taken (§5.2);
- dat de app geen `bsi::ifc::class` en geen import van het IFC-kernschema schrijft (§5.2);
- voorgangers als `openaec::planning::sequence` in plaats van één `predecessor` in de activity;
- de WBS als veld `parent` in plaats van `children` (§5.2), en of de plaats onder de ouder ook in
  `openaec::planning::` hoort (in IFC 4.3 heeft de volgorde betekenis; nu staat ze in `openaec::ops::task`, §5.5); een
  volgnummer is een vaste plaats, dus verwijdert een programma dat volgnummers bewaart een zus, dan schuift de taak op;
- of `openaec::activity` onder de regel "oude naam blijven lezen" valt;
- de adapter van ifcx-explorer schrijft `IFCAPPLICATION(…,'OPS')` (`adapters.ts:358`); de app ziet zo'n STEP-bestand dan
  als eigen herkomst (§4.5, `ifcReader.ts:3804`). Voorstel: een eigen identificatie voor ifcx-explorer.

**Vragen voor fase 0** (meting of proef, geen besluit):

- Klopt `selectPlanning` op echte Bonsai- en Synchro-bestanden? Is "meerdere werkschema's samenvoegen" acceptabel, of
  wordt dat een besluit voor Ethan?
- Hergebruikt IfcOpenShell gemengde `IfcRelAssignsToProcess`-relaties? Aggregeert Bonsai baselines onder het werkplan?
- Delen IfcOpenShell en Bonsai owner histories en `Creators` tussen model en planning?
- Hoe groot mag een model zijn (tijd, geheugen, UI-blokkering)?
- Welke padvorm werkt in de buildingSMART-composer én in ifcx-explorer? Accepteert de gepinde versie van ifcx-explorer
  een entry zonder `attributes`?
- Geeft uitvoer van oudere release-tags in een constant slot een andere waarde dan de huidige writer? Zo ja, dan beslist
  fase 0 per slot of het oude token van de app zelf was (dan wint de constante van de writer).
- Welke slots horen in de vaste lijst met `#`-tokens (§4.5), volgens het schema?
- Wat doen IfcOpenShell en Bonsai met een owner history van een ander programma op een object dat zij wijzigen? Dat
  bevestigt of de keuze in §4.5 (owner history van een ander niet aanpassen) aansluit bij de praktijk.
- Hangt Bonsai alleen wortel-taken via `IfcRelAssignsToControl` aan het schema? De writer wijst alle taken toe
  (`ifcWriter.ts:549-553`). Fase 0 opent de uitvoer in Bonsai; toont die een kind dan ook als wortel, dan wordt de
  koppeling bij een schema met een relatie van een ander programma "wortel-taak".
- Schrijven IfcOpenShell of Bonsai meer dan één `IfcRelNests` per ouder? Dan moet §4.5 zeggen welke bewaarde relatie de
  kinderen krijgt.

## 12. Council

| Ronde | Opus 5.5 (xhigh) | GPT-6.1-Sol (xhigh) | Fable 5.1 (high) |
|---|---|---|---|
| 1 (v1) | 6 | 6 | 7 |
| 2 (v2) | 6 | 6 | 7 |
| 3 (v3) | 6 | 6 | 8 |
| 4 (v4) | 7 | 6 | 7 |
| 5 (v5) | 7 | 7 | 8 |
| 6 (v6) | 7 | 7 | 8 |
| 7 (v7) | 7 | 8 | 9 |
| 8 (v8) | 9 | 9 | 9 |
| 9 (v10) | 7 | 8 | — |
| 10 (v11) | 8 | 8 | — |
| 11 (v12) | 8 | 8 | — |
| 12 (v13) | 8 | 8 | — |
| 13 (v14) | 8 ("daarna 9") | 9 | — |
| 13 (v15) | 9 | (9 op v14) | — |

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

Na ronde 4: Ext loopt niet door D en R heen (anders verweesde `IfcTaskTime` bij elk opslaan; door Opus en Fable los van
elkaar met proefbestanden aangetoond); kalenderpatronen in `IfcRelAssignsToControl`; register van psets en templates in
plaats van het voorvoegsel `OPS_`, onbekende properties in een bekende pset blijven; eigen baselines alleen via
`OPS_Baselines`, baseline herkennen op het slot, gedeelde taken horen bij de planning; slot-tokens ook zonder vreemd deel
(`ifcSource` voor elk IFC-bestand) en ook voor R; tokens met `#` alleen in letterlijke slots; gemengde relaties van vier
structurele typen volgen één regel; R houdt zijn id alleen als een vreemd stuk ernaar wijst; `ifcSource` buiten
`IFC_SAVE_KEYS`, nieuwe sha via het manifest; opslaan en herstel in twee stappen (`pendingSha256`); herstel bouwt
`ifcSource` opnieuw op; onbekend schema alleen met vreemd deel geweigerd; pool-export zonder model; MCP-backups houden
twee bronnen; `detached` met de oudste versie en nieuwe ids; IFCX-tussenversie voegt alleen attributen toe; voorproef
`classify-v5.py` volgt de tekst en draait ook op de proefbestanden van de council.

Na ronde 5: zonder vreemd deel nummering en slots zoals nu, met de poort byte-gelijk aan de huidige writer; vier soorten
slots (domein, afgeleid, constant, verwijzing) per slotnaam en lay-out, met herkomst (eigen of vreemd); vaste lijst
`#`-tokens; `IfcRelSequence` is D; R-sleutel = bron-`#id`, relaties van een ander programma houden hun indeling en
`QuantityInProcess`; de R-id-regel vervalt; alleen het eerste werkplan is D; baselinesleutel = Name + CreationDate;
register uit `ifcPsets.ts`, met per pset de properties die de lezer leest (vaste namen, alle, of uit het template);
onbekende properties zijn vreemde leden; projectgegevens in `OPS_ProjectSettings` als het project niet P is; gemengde
relatie alleen met de relating in D, plus gedeelde register-psets (lezen los van schrijfrecht); codering per P-deel;
`ifcSource` in `IFCSaveSource` met een verplichte modus `merge`/`planOnly`; `ifcSource` vervangen bij elk schrijven naar het
eigen doel, los van de dirty-vlag, nooit bij een export; "bron ontbreekt" alleen met vreemd deel; MCP-backup zonder
modelkopie; teruggezette stukken als soort in de wijzigingslijst; controle op een bestand dat buiten de app is vervangen;
nieuwe tests. Voorproef `classify-v6.py`: 35 eigen bestanden 100 % P zonder vreemde leden, 8 modellen 100 % V.

Na ronde 6: de herkomst blijft (de owner history van een ander programma is een constant `#`-slot en wordt C); relaties
van een ander programma volgen de huidige koppelingen in het domein, `Nests` volgt de ouder, en de eigen relaties sluiten
bewaarde koppelingen uit; D-stukken op hun bronplek, zodat de lezer hetzelfde werkplan en live-schema kiest;
dynamische psets met herkenners die de lezer volgen (`<GlobalId>#n`-wachtrij, codetype met waarde, veld uit template);
`OPS_Project` in het register, met een test; de index noemt alle velden die de indeling leest; baseline alleen zonder
taken, met genormaliseerde datum; codering per stuk via het eigen `OwnerHistory`-slot; `IFC_DIRTY_KEYS` naast
`IFC_SAVE_KEYS`; geen bronbytes in herstelsnapshot en MCP-backup; controle op een vervangen bestand alleen met vreemd
deel, AutoSave stopt na één melding; manifest best effort; melding na herstel alleen bij vreemde tokens; `ifcSource` voor
IFCX (§6.6); handleiding in fase 3 en 4. Voorproef `classify-v7.py`: 35 eigen bestanden 100 % P zonder vreemde leden en
zonder vreemde herkomst; 8 modellen 100 % V.

Na ronde 7: het hele P-blok in writer-volgorde op de plek van het eerste P-stuk (de lezer haalt wortelvolgorde en
projectkalender uit de bestandsvolgorde), met een test op elke "eerste X"-keuze; een koppeling met de projectkalender
heet "volgt de projectkalender"; alleen `OPS_Assignments` heeft sleutels uit de data, ook de oude kale vorm;
`OPS_Timephased` en `OPS_TimephasedWindow` hebben vaste namen; codetypen en velden uit `OPS_StructureMeta` met terugval op
het template; een vreemd lid met een naam van de writer vervalt; `detached` bewaart `foreignMembers` en de slots van
vervallen relaties van een ander, en blijft bij het vervangen van `ifcSource`; AutoSave eist dezelfde bron; codering per
stuk met de huidige terugval zonder `IfcApplication`; naam van `IfcRelNests` alleen afgeleid bij eigen herkomst;
baseline met lege `createdAt` op naam; herkomst via `OwningApplication`; IFCX-volgorde in `ops::task`; poort met de
fixtures en concrete oude tags. Voorproef `classify-v8.py`: alle 35 eigen bestanden en de echte writer-uitvoer in
`tests/planning/fixtures/` 100 % P; de proeven van Sol en Opus uit ronde 7 zoals bedoeld.

Na ronde 8 (doel gehaald; de leden vroegen deze punten vóór fase 1 in de tekst): een pset met vreemde leden blijft
bestaan zonder eigen properties, en controle 1 bewaakt het lidmaatschap; een vreemd lid dat de herkenner als eigen zou
lezen vervalt, en elke GlobalId-sleutel in `OPS_Assignments` is eigen; de nieuwe bron komt van de writer; een live-schema
van eigen herkomst sluit baselinebomen uit; plek van het P-blok zonder P-stuk in de bron; ids van hulpstukken vanaf het
hoogste niet-P-id; `#n` in leesvolgorde en de plek van bewaarde relaties in het blok; `planningCanon` met volgorde en
keuzes, en de lijst toegestane verschillen; IFCX met één volgnummer; tekstpunten. Voorproef `classify-v9.py` volgt de
lege terugval van `OPS_StructureMeta`.

Na de besluiten van 9 november (versie 10): twee namespaces (`openaec::planning::` gedeeld, `openaec::ops::` eigen);
eigendom in IFCX op planningspad en eigen pad in plaats van op namespace; planning van een ander programma lezen en
bewerken met brontokens per veld; onbekende velden in gedeelde attributen bewaard; geen kopie in `openaec::activity`.
Ethan besliste op 9 november dat de council voorlopig uit Opus en Sol bestaat; Fable alleen op echt belangrijke momenten.

Na ronde 9 (versie 11): eigendom alleen op domeinobject, geen merkteken (zelfde eigendom na heropenen); brontoken per veld
voor elk pad als het veld onveranderd is; één bron en vaste vorm per veld voor de gedeelde schema's, elke wijziging een
nieuwe naam; bestaande paden blijven, id = pad, GlobalId uit UUID of UUID v5; geen werkplan → nieuw werkplan; WBS als
veld `parent`, geen `children`; compositiecontrole per pad zonder wortels; afbeelding op het importcontract (handmatig
gepland, vaste datums); afwezige velden blijven afwezig; lijst voor Bjorn; test openen → opslaan → heropenen → opslaan.

Na ronde 10 (versie 12): projectie per datumveld met leesregel (00:00) en test op heropenen; kop van een andere bron
blijft byte-gelijk, geen class en geen import in een bron van een ander programma; class alleen eigen als planningsklasse;
lege entry voor een pad met vreemde inkomende verwijzingen; meer bijdragen van één attribuut: één bijdrage op de plek van
de laatste; bekende velden zonder brontoken; verwijzingen als pad; nieuwe gedeelde naam verhoogt de hoofdversie;
naamveld gaat voor op `openaec::label`; `recordedTimesOrigin 'ifc'`; §5.5 in fase 4.

Na ronde 11 (versie 13): elke activity is een taak (baseline verwijst naar levende taken); geen `bsi::ifc::class` en
geen import van de app; schema's per attribuutnaam toevoegen; lege entry voor elk verwijderd pad dat nog als tekenreeks in
de uitvoer staat; `openaec::ops::`-attribuut alleen als het afwijkt; domein-id = UUID (bronpad in `ifcSource`);
weigeringen alleen op domeinpaden; leesregel voor automatisch geplande taken; oude naam terugschrijven onder oude naam;
`openaec::ops::`-naam per hoofdversie; geen aparte compositiecontrole bij opslaan (test met de flattener); test met de
projectcontrole van ifcx-explorer in CI.

Na ronde 12 (versie 14): domein-id uit het hele pad (geen botsing tussen `/a/<uuid>` en `/b/<uuid>`); `detached`
bewaart het bronpad, Ctrl+Z na opslaan zet een taak terug op haar oude pad; baseline wijst met gewone tekst; writer op de
plek van de eerste bijdrage; projectkalender `cal-default` met pad in `ifcSource`; controle 1 ook voor eigen entries;
verwijzingen zoeken op gedecodeerde tekenreeksen; melding bij een onbekend `openaec::planning::`-attribuut.

Na ronde 13 (versie 15; Sol 9, Opus 8 met "daarna 9"): volgnummer = plaats onder de ouder, taken zonder volgnummer vullen
de open plaatsen; baselinepaden in de kaart; intern id in `openaec::ops::task` als het afwijkt; `elementLinks` in
`detached`; onbekende velden tellen mee bij de zoekactie; `-dup-N` bij gelijke 128 bits; padvorm uit fase 0; geen
import-alternatief voor schema's; tests voor volgorde en crashherstel. Opus bevestigde versie 15 met een 9; daarna kwamen er alleen tekstpunten bij
(algoritme voor de volgnummers, `-dup-N` ook voor ids uit `openaec::ops::task`, de vaste plaats op de lijst voor Bjorn).
**Doel gehaald in ronde 13.**

## 13. Bronnen

- Issue #804 (DutchSailor, 2026-11-02); issue #748; issue #336; issue #292; PR #547 / commit `5b2812f94`.
- `src/services/ifc/ifcReader.ts:178-185, 442, 466-468, 982-985, 1105-1115, 1156-1161, 1377-1423, 1749, 1768-1777, 1984,
  2062, 2343-2357, 3473-3506, 3570-3612`;
  `ifcWriter.ts:231-258, 343, 393, 447-449, 453, 462-483, 676-694, 825, 1160-1167, 1268, 1542, 1600, 1675, 1727-1732,
  1830-1838`; `ifcPsets.ts:77, 707`; `src/state/slices/sequenceSlice.ts:79`; `fileSlice.ts:576-594`;
  `src/state/ifcSaveInput.ts:13, 66-69, 116-137`; `ifcReader.ts:384, 2225-2246, 2359-2366, 3283-3293, 3455-3470, 3489`;
  `ifcWriter.ts:112-119, 185, 413, 1596-1600`; `src/state/slices/{documentSlice.ts:598-602, resourceSlice.ts:252}`;
  `src/services/recovery/recoverySnapshotInput.ts:12`; `ifcReader.ts:1449, 2202-2219, 3256, 3272, 3380-3390, 3458-3462`;
  `ifcPsets.ts:628-636`; `ifcWriter.ts:418, 549-553`; `src/hooks/useAutoSave.ts:155`; `src/state/taskTree.ts:94-98`;
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
