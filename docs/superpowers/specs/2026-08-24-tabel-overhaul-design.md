# Tabel-overhaul: één modulaire taakgrid voor Gantt en Tabel

**Datum:** 2026-08-24

**Status:** specontwerp GO; vijf implementatie-eindreviews NO-GO, alle bevindingen verwerkt en
zesde volledige herreview nog uit te voeren

**Branch:** `codex/tabel-overhaul`
**Bronnen:** vault-notitie “tabel weergave revisie”, gekoppelde issues en de in deze sessie
vastgelegde eigenaarsbesluiten.

## 1. Doel

Open Planner Studio krijgt één echte, modulaire taakgrid die op twee plekken wordt gebruikt:

1. als takenpaneel links van de Gantt;
2. als volledige weergave onder het linttabblad **Tabel**.

De twee oppervlakken gebruiken dezelfde rijbron, selectie, bewerkregels, validatie en
kolomdefinities. Alleen hun persoonlijke kolomindeling verschilt. De Gantt-canvas tekent daarna
alleen nog de tijdlijn, taakbalken en relaties; de huidige hardgecodeerde canvas-tabel verdwijnt.

Het doel is geen cosmetische verbouwing. De taakgrid moet uiteindelijk alle informatie die aan een
taak hangt als kolom beschikbaar maken, P6-achtig met toetsenbord en klembord werken, en alle nuttige
functionaliteit van het huidige Relaties-paneel overnemen. Daarna verdwijnen het linttabblad
**Relaties**, `RelationsPanel` en de knop **Beheren**.

## 2. Vaststaande productbesluiten

- Er komt één generieke DOM-gridkern en één taakadapter met het domeingedrag.
- De gridkern wordt nu alleen gebruikt door de twee taakoppervlakken. De geavanceerde
  resourcetabel blijft volledig buiten deze verbouwing.
- Beide taakoppervlakken tonen dezelfde kolomsoorten. Hun volgorde, breedtes en vastgepinde
  kolommen worden afzonderlijk bewaard.
- Kolomvoorkeuren zijn gebruikersinstellingen, geen projectdata.
- De rijhoogte staat vast en is exact gelijk aan de hoogte van één taak in de Gantt-canvas.
- Tekst blijft op één regel en wordt bij ruimtegebrek met een ellipsis afgekapt. Hover toont de
  volledige inhoud.
- Kolomkoppen sorteren nooit. De bestaande expliciete sorteerfunctie onder **Beeld** blijft bestaan.
- Berekende kolommen zijn selecteerbaar en kopieerbaar, maar nooit bewerkbaar.
- Er komt geen knop in een relatiecel en geen nieuw permanent relatiepaneel.
- De relatieknop in het lint wordt een dropdown volgens hetzelfde bestaande popoverpatroon als de
  mijlpaalknop.
- **Voorgangers** en **Opvolgers** komen ook als traceerknoppen op het tabblad **Tabel**.
- Traceren verbergt geen taken: niet-betrokken taken vervagen.
- Alle opgeslagen baselines krijgen hun eigen dynamische kolommen; er is niet slechts één set voor
  de actieve baseline.
- Er wordt in deze fase niets naar `main` gepusht.

## 3. Scope

### 3.1 Wel

- Een generieke, gevirtualiseerde, toegankelijke DOM-grid.
- Vervanging van `TableEditor` en van de canvas-takentabel door dezelfde taakgrid.
- Eén gedeelde zichtbare-rijenpijplijn voor grid en Gantt.
- Volledige kolomcatalogus voor taak-, planning-, voortgang-, relatie-, baseline-, toewijzings-,
  eigen- en technische velden.
- Persoonlijke kolomvoorkeuren per taakoppervlak.
- P6-achtige celnavigatie, bereikselectie en Excel-achtige kopieer-/plakbewerkingen.
- Inline editors met centrale domeinvalidatie.
- Voorganger- en opvolgercellen voor interne en externe relaties.
- Overname van de bruikbare functies uit `RelationsPanel`.
- Verwijdering van het linttabblad **Relaties** nadat functionele gelijkwaardigheid bewezen is.
- Nederlandse en Engelse gebruikersdocumentatie en vertalingen in alle veertien locales.

### 3.2 Niet

- Wijzigingen aan de resourcetabel, zijn gridgedrag of zijn geavanceerde resourcefunctionaliteit.
- Een nieuwe Resource-, Relatie- of detailtab.
- Sorteren door op kolomkoppen te klikken.
- Instelbare, variabele of meerregelige rijhoogtes.
- Een live solve over meerdere projectbestanden voor externe relaties.
- Nieuwe planningsregels. De grid ontsluit de bestaande regels en mag ze niet opnieuw uitvinden.
- Een release, versie-tag, publicatie of push naar `main`.

## 4. Architectuur

### 4.1 Lagen

De oplossing bestaat uit vier expliciete lagen:

1. **`DataGridCore`** — generiek en domeinloos. Beheert virtualisatie, koppen, pinning, horizontale
   en verticale scroll, actieve cel, rechthoekige selectie, toetsenbord, klembord en ARIA.
2. **`TaskGridAdapter`** — vertaalt taakrijen en kolomdefinities naar de gridkern. Bevat geen React-
   oppervlakspecifieke aannames.
3. **`taskColumnRegistry`** — één catalogus met labels, categorie, type, lezer, schrijver,
   formatter, parser, validatie, read-only-regel, auto-fitmeting en beschikbaarheid per kolom.
4. **Oppervlakken** — `GanttTaskGrid` en `FullTaskGrid` geven alleen een surface-id, afmetingen en
   dezelfde taakadapter door.

De gridkern weet dus niet wat een taak, WBS, baseline of relatie is. De taakadapter weet niet of hij
links van een canvas of paginabreed wordt getoond.

`DataGridCore` heeft wel een hard, uitvoerbaar contract. De kern is eigenaar van:

- stabiele rij- en kolom-id’s en de vertaling naar absolute virtuele indices;
- één actieve cel, één bereikanker en één rechthoekige selectie;
- roving focus en het volledige §7-toetsenbordcontract;
- DOM-virtualisatie en scroll-to-cell;
- de niet-gedupliceerde DOM-volgorde van vrije en vastgepinde kolommen;
- TSV-klembordcoördinaten, zonder domeinparsing;
- de ARIA-structuur uit §14;
- focusherstel na het openen/sluiten van een editor of popover.

De kern krijgt gedrag via getypeerde callbacks (`read`, `beginEdit`, `copy`, `planPaste`) en mag
nooit rechtstreeks de appstore importeren. Daardoor kan dezelfde kern in een headless harnas worden
getest met duizenden rijen en duplicate row occurrences.

### 4.2 Eén rijcontract

`computeViewRows` blijft de enige bron voor filteren, groeperen, sorteren en inklappen. Grid en
Gantt consumeren exact dezelfde `ViewRow[]`, dezelfde `rowHeight` en dezelfde verticale `scrollY`.
Er mag geen tweede flattening- of filterpad in een component ontstaan.

Elke zichtbare rij krijgt een stabiele `rowKey`:

- in boommodus: de taak-id;
- in gegroepeerde weergave: groepspad plus taak-id;
- voor een groepsband: de bestaande groepssleutel.

Dat onderscheid is nodig omdat één taak bij resourcegroepering in meerdere banden kan voorkomen.
De celcursor en virtualisatie gebruiken `rowKey`; datamutaties en taakselectie gebruiken `taskId`.
Als dezelfde taak meerdere keren zichtbaar is, wordt hij voor taakacties maar één keer geselecteerd
en wordt een bewerking direct in alle voorkomens zichtbaar.

`rowKey` wordt een verplicht veld van het echte `ViewRow`-contract, niet een lokaal afgeleide key in
React. `computeViewRows` draagt tijdens gegroepeerd recursief afdalen het groepspad mee naar iedere
taakrij. Alle bestaande helpers die nu op `findIndex(taskId)` of “eerste voorkomen” leunen worden
geïnventariseerd: een helper kiest daarna expliciet een `rowKey` (visuele occurrence) of een
`taskId` (domeintaak). Een naamloze mengvorm is niet toegestaan.

### 4.3 Gantt-oppervlak

De huidige `GanttRenderer.drawTaskTable` en alle hardgecodeerde WBS-/naam-/duurkolommen verdwijnen.
Het linker paneel wordt `GanttTaskGrid`; rechts daarvan blijft de canvas. De bestaande
`ui.leftPanelWidth` blijft de buitenbreedte van het linker paneel bepalen.

De grid en canvas delen:

- exact dezelfde rijlijst;
- exact dezelfde vaste kop- en rijhoogtes;
- één verticale scrollpositie;
- dezelfde inklap-, filter-, groep- en traceertoestand;
- dezelfde taakselectie.

Horizontale scroll in de taakgrid en horizontale tijdscroll in de canvas blijven onafhankelijk.
Zo kan een gebruiker kolommen verschuiven zonder de tijdlijn te verplaatsen.

Deze splitsing verplaatst concreet de volgende verantwoordelijkheden uit `GanttCanvas`/
`GanttRenderer` naar de DOM-laag rond `GanttTaskGrid`:

- disclosure-hit-tests en klikken op de huidige canvas-takentabel;
- rijselectie en dubbelklik vanuit het linker paneel;
- rijdrag en bijbehorende drop-indicator links van de tijdlijn;
- het contextmenu dat vanuit een taakrij wordt geopend;
- taakcelhover en ellipsis-tooltips;
- de splitter-hit-test, splitterdrag en splittercursor;
- de gedeelde verticale scrollbar/scrollcontainer.

Na de knip ontvangt de Gantt-canvas lokale x-coördinaten met oorsprong 0. Alle huidige vergelijkingen
met `taskTableWidth`, offsets in bar-/relatiehit-tests, de horizontale scrollbar-offset en
`fit-to-project`-breedte worden verwijderd of vervangen door de werkelijke canvasbreedte. Pan,
boxselect, balkdrag, resize en relatie tekenen blijven uitsluitend in het canvas. Taak-op-y-lookup
blijft dezelfde `ViewRow`-index gebruiken. De splitter woont tussen twee DOM-siblings en niet langer
als hittest in het canvas. Een gerichte eventmigratietest bewijst per oude linkerpaneelhandeling waar
de nieuwe eigenaar zit; alleen `drawTaskTable` verwijderen is niet voldoende.

Er zijn na de knip drie verschillende x-contracten:

1. **DOM-taakgrid** — fysieke breedte `leftPanelWidth`, geen tijdcoördinaten.
2. **Primaire/secundaire timeline-canvas** — ieder een eigen lokale oorsprong 0 en eigen werkelijke
   canvasbreedte. De timeline-`GanttRenderer` kent geen `taskTableWidth` meer.
3. **Histogramcanvas** — blijft bewust één canvas over de volle Gantt-breedte, inclusief zijn
   bestaande resourcekiezer links. Alleen dit canvas houdt een `pickerWidth = leftPanelWidth`; zijn
   tijdplot begint lokaal op `pickerWidth` en ligt daardoor globaal exact onder oorsprong 0 van de
   primaire timeline-canvas.

`SharedAxisInput.taskTableWidth` wordt daarom geen stil hardcoded nul maar wordt hernoemd naar het
semantische `chartOriginX`. De primaire timeline geeft 0 door; het histogram geeft `pickerWidth`
door. Datum↔x, tijdlijnlagen en histogram delen verder dezelfde effectieve oorsprong, zoom en
`scrollX`. `HistogramRenderer` behoudt zijn resourcepicker-hit-tests links van `pickerWidth`; dit is
geen wijziging van de geavanceerde resourcetabel.

Bij split view wordt alleen de timeline-regio rechts van de DOM-grid verdeeld over primaire en
secundaire canvas. De secundaire canvas houdt zijn bestaande eigen zoom/scroll en oorsprong 0. Het
histogram blijft, zoals nu, de primaire as over de volledige histogramplot gebruiken en pretendeert
niet met de secundaire tijdas uit te lijnen. Splitratio, minimap, horizontale scrollbars,
fit-to-project en focus-on-task rekenen uitsluitend met de werkelijke timeline-canvasbreedte; de
DOM-gridbreedte wordt niet nogmaals afgetrokken.

### 4.4 Volledige Tabel-weergave

De volledige Tabel-weergave gebruikt dezelfde grid zonder canvas. Hij krijgt wel zijn eigen
kolomvoorkeuren en eigen horizontale scrollpositie. Alle taakinteracties gedragen zich identiek aan
het Gantt-takenpaneel.

### 4.5 Virtualisatie en uitlijning

- Alleen zichtbare rijen plus een kleine overscan worden als DOM-cellen gerenderd.
- De totale scrollhoogte wordt uit `viewRows.length × rowHeight` afgeleid.
- Groepsrijen nemen eveneens precies één rijhoogte in.
- De canvas gebruikt dezelfde indices om balken en relaties te tekenen.
- Een pixel-uitlijningstest controleert gridlijnen, taakbalkmiddens en groepsrijen bij scrollen,
  zoomen, filteren, groeperen en in-/uitklappen.
- Een actieve of bewerkte cel die buiten beeld navigeert wordt met minimale scrollbeweging in beeld
  gebracht; de Gantt-tijdas verschuift daarbij niet.
- Eén DOM-scrollcontainer is eigenaar van de verticale positie in de Gantt-weergave. Hij schrijft
  `view.scrollY`; canvas en grid lezen dezelfde waarde. Wiel-, touch-, scrollbar- en programmatische
  focusscroll mogen niet ieder een tweede gekoppelde scroller met terugkoppellus vormen.

## 5. Kolommodel en volledige velddekking

### 5.1 Stabiele kolom-id’s

Een kolomvoorkeur verwijst naar een stabiele `TaskColumnId`, niet naar een React-component of een
vertaald label. Voorbeelden:

```text
task.name
task.time.scheduleStart
task.constraint.type
relation.predecessors
assignment.unitsPerDay
activity-code:<projectId>:<typeId>
custom-field:<projectId>:<defId>
baseline:<projectId>:<baselineId>:start
baseline:<projectId>:<baselineId>:varianceFinish
```

Projectgebonden id’s bevatten het project-id. Daardoor kan een persoonlijke voorkeur veilig
velden van verschillende projecten onthouden zonder toevallige botsingen.

Een voorkeur bevat minimaal:

```ts
interface TaskGridColumnPreference {
  id: TaskColumnId;
  width: number;
  pinned: boolean;
}
```

Een afwezige kolom is verborgen; een aparte `visible`-vlag is niet nodig. Onbekende of in het
huidige project niet-beschikbare dynamische kolommen blijven in de voorkeur bewaard, maar worden
voor dat project niet gerenderd.

### 5.2 Compile-time volledigheid

De registry krijgt exhaustieve classificatietabellen volgens het bestaande patroon van
`TaskTime` en `moveProject.ts`:

```ts
const TASK_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof Task, FieldCoverage>;
const TASK_TIME_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TaskTime, FieldCoverage>;
const CONSTRAINT_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TaskConstraint, FieldCoverage>;
const SEQUENCE_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof Sequence, FieldCoverage>;
const EXTERNAL_LINK_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof ExternalLink, FieldCoverage>;
const ASSIGNMENT_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof ResourceAssignment, FieldCoverage>;
const BASELINE_TASK_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof BaselineTask, FieldCoverage>;
const SPLIT_GAP_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TaskSplitGap, FieldCoverage>;
const CONTOUR_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TaskTimephasedContour, FieldCoverage>;
const CONTOUR_PERIOD_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TimephasedContourPeriod, FieldCoverage>;
const NOTE_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TaskNote, FieldCoverage>;
const DURATION_WALK_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof TimephasedDurationWalk, FieldCoverage>;
const EXTERNAL_SOURCE_FIELD_COVERAGE = { /* ... */ } satisfies Record<keyof ExternalSourceRef, FieldCoverage>;
```

Voor de drie huidige inline objecttypes definieert de registry type-aliassen uit de brontypes:
`TaskNote = NonNullable<Task['notes']>[number]`,
`TimephasedDurationWalk = NonNullable<Task['timephasedDurationWalks']>[number]` en
`ExternalSourceRef = ExternalLink['sourceRef']`. Daarmee stopt “volledige dekking” niet bij een
arrayveld terwijl nieuwe informatie binnen het array-item stil zou kunnen verdwijnen.

`FieldCoverage` zegt per bronveld door welke directe, samengestelde, afgeleide of technische kolom
het ontsloten wordt. Een nieuw typeveld zonder classificatie breekt `tsc`. Een veld mag bewust door
een samengestelde technische kolom worden getoond, maar mag nooit stil ontbreken.

### 5.3 Categorieën in de kolomkiezer

De vaste volgorde is:

1. Taak
2. Planning
3. Beperkingen
4. Relaties
5. Resources
6. Voortgang
7. Berekend
8. Baseline
9. Eigen velden
10. Technisch

### 5.4 Taakvelden

| Bronveld | Kolom(men) | Categorie | Bewerking |
|---|---|---|---|
| `id` | Taak-id | Technisch | alleen lezen |
| `name` | Naam | Taak | tekst |
| `description` | Beschrijving | Taak | tekst |
| `wbsCode` | WBS | Taak | tekst als autonummering uitstaat; anders berekend |
| `taskType` | Taaktype | Taak | dropdown |
| `status` | Status | Voortgang | bewaakte voortgangsactie, geen kale veldschrijf |
| `isMilestone` | Mijlpaal | Planning | bewaakte taaktypeactie |
| `milestoneKind` | Mijlpaalsoort | Planning | dropdown |
| `mandatory` | Verplichte mijlpaal | Planning | boolean |
| `priority` | Prioriteit | Planning | begrensd getal |
| `levelingDelay` | Nivelleringsvertraging | Berekend | alleen lezen |
| `levelingDelayMinutes` | Nivelleringsvertraging in minuten | Technisch | alleen lezen |
| `levelingDelayElapsed` | Verstreken nivelleringsvertraging | Technisch | alleen lezen |
| `splitGaps` | Onderbrekingen | Planning | compacte, kopieerbare samenvatting; geen ruwe inline-mutatie |
| `timephasedFinishFloor` | Tijdgefaseerde eindondergrens | Technisch | alleen lezen |
| `timephasedStartAnchor` | Tijdgefaseerd startanker | Technisch | alleen lezen |
| `timephasedDurationWalks` | Tijdgefaseerde duurwandelingen | Technisch | volledige kopieerbare technische weergave |
| `timephasedContours` | Tijdgefaseerde contourbron | Technisch | volledige kopieerbare technische weergave |
| `manuallyScheduled` | Handmatig gepland (import) | Technisch | alleen lezen zolang de solver dit niet ondersteunt |
| `mspTaskType` | MSP-taaktype | Technisch | alleen lezen zolang het puur importdata is |
| `effortDriven` | Inspanningsgestuurd (import) | Technisch | alleen lezen zolang het puur importdata is |
| `parentId` | Bovenliggende taak-id | Technisch | alleen lezen; structuuracties wijzigen dit |
| `childIds` | Onderliggende taak-id’s | Technisch | alleen lezen; structuuracties wijzigen dit |
| `time` | alle afzonderlijke kolommen uit §5.5 | Planning/Voortgang/Berekend/Technisch | per onderliggend veld |
| `resourceIds` | Resource-id’s | Technisch | alleen lezen; toewijzingsacties zijn leidend |
| `color` | Kleur | Taak | kleureditor |
| `activityCodes` | één dynamische kolom per codetype | Eigen velden | autocomplete/dropdown |
| `customFields` | één dynamische kolom per definitie | Eigen velden | editor volgens veldtype |
| `constraint` | type, datum en harde vlag | Beperkingen | centrale constraintvalidatie |
| `constraint2` | type en datum | Beperkingen | centrale combinatieregels; nooit hard |
| `isHammock` | Hammock/LOE | Planning | bewaakte domeinactie |
| `externalLinks` | voorgangers/opvolgers plus technische brongegevens | Relaties/Technisch | zie §9 |
| `deadline` | Deadline | Beperkingen | datumeditor |
| `calendarId` | Kalender | Planning | autocomplete/dropdown |
| `notes` | Notities/checklist plus Notitiegegevens | Taak/Technisch | éénregelige samenvatting; technische kolom bewaart id, tekst en status zonder verliesgevende platte schrijver |

Complexe geïmporteerde arrays worden niet als halfwerkende tekstvelden aangeboden. Hun technische
cel toont de volledige canonieke inhoud in tooltip en klembord, terwijl de normale kolom een
menselijke samenvatting geeft. Daarmee is de informatie aanwezig zonder brondata door een
verliesgevende parser te beschadigen.

### 5.5 `TaskTime`

| Bronveld | Kolom | Categorie | Bewerking |
|---|---|---|---|
| `durationType` | Duurtype | Planning | dropdown |
| `scheduleDuration` | Duur | Planning | duurparser |
| `durationMinutes` | Duur in minuten | Technisch | alleen lezen; de normale duuractie houdt beide vormen consistent |
| `scheduleStart` | Geplande start | Planning | datum/tijd |
| `scheduleFinish` | Gepland einde | Planning | datum/tijd |
| `resume` | Hervatten op | Voortgang | alleen lezen totdat een bewaakte editor bestaat |
| `stop` | Gestopt op | Voortgang | alleen lezen totdat een bewaakte editor bestaat |
| `earlyStart` | Vroege start | Berekend | alleen lezen |
| `earlyFinish` | Vroeg einde | Berekend | alleen lezen |
| `lateStart` | Late start | Berekend | alleen lezen |
| `lateFinish` | Laat einde | Berekend | alleen lezen |
| `freeFloat` | Vrije speling | Berekend | alleen lezen |
| `totalFloat` | Totale speling | Berekend | alleen lezen |
| `isCritical` | Kritiek | Berekend | alleen lezen |
| `interferingFloat` | Interfererende speling | Berekend | alleen lezen |
| `isNearCritical` | Bijna kritiek | Berekend | alleen lezen |
| `floatPath` | Floatpad | Berekend | alleen lezen |
| `actualStart` | Werkelijke start | Voortgang | bewaakte voortgangsactie |
| `actualFinish` | Werkelijk einde | Voortgang | bewaakte voortgangsactie |
| `actualDuration` | Werkelijke duur | Voortgang | bewaakte voortgangsactie |
| `remainingTime` | Resterende duur | Voortgang | bewaakte voortgangsactie |
| `remainingMinutes` | Resterende minuten | Technisch | alleen lezen; normale resterende-duuractie houdt eenheden consistent |
| `completion` | Gereed (%) | Voortgang | bewaakte `setTaskProgress`-route |

De normale kolommen **Geplande start** en **Gepland einde** schrijven de invoervelden. De aparte
vroege en late datums zijn berekende, niet-bewerkbare kolommen. Zo schrijft een gebruiker nooit
per ongeluk over een solveruitkomst heen.

### 5.6 Resources en toewijzingen zonder de resourcetabel te verbouwen

De taakgrid mag taaktoewijzingen ontsluiten, maar gebruikt uitsluitend de bestaande
resource-/assignmentacties. De resourcetabel en zijn code blijven ongemoeid.

Beschikbare kolommen:

- Toegewezen resources;
- Eenheden per dag, per resource gelabeld;
- Verdeelcurve, per resource gelabeld;
- Werkvenster start, per resource gelabeld;
- Werkvenster einde, per resource gelabeld;
- technische assignment-id, taak-id en resource-id.

De velddekking is expliciet:

| `ResourceAssignment`-veld | Kolom | Bewerking |
|---|---|---|
| `id` | Assignment-id | alleen lezen |
| `taskId` | Assignment taak-id | alleen lezen |
| `resourceId` | Toegewezen resource / Resource-id | via bewaakte toewijzingsactie |
| `unitsPerDay` | Eenheden per dag | strikt positief, eindig getal |
| `curve` | Verdeelcurve | dropdown; leeg betekent UNIFORM |
| `workWindowStart` | Werkvenster start | alleen lezen; geïmporteerde round-tripdata |
| `workWindowFinish` | Werkvenster einde | alleen lezen; geïmporteerde round-tripdata |

Een multi-value cel gebruikt inline autocomplete en gestructureerde tokens. Een resource toevoegen
of verwijderen maakt of verwijdert een echte `ResourceAssignment`; eenheden en curve blijven aan de
juiste assignment-id gekoppeld. Als één cel meerdere assignments wijzigt, is dat één atomaire
transactie. Er komt hiervoor geen nieuw permanent paneel.

De bestaande `updateAssignment`-route blijft voor `unitsPerDay` en `curve`; de funderingsfase voegt
daarnaast een pure `planTaskAssignmentSet` toe voor membership en multi-token edits. Die planner
bewaakt:

- taak en resource bestaan;
- alleen bladtaken die geen mijlpaal zijn dragen assignments;
- dezelfde resource komt maximaal één keer op dezelfde taak voor;
- `unitsPerDay` is strikt positief en eindig;
- bestaande assignment-id’s blijven behouden als de resource gelijk blijft;
- toevoegen, wijzigen en verwijderen van meerdere tokens commit alles of niets;
- de onderstaande invalidatiematrix gebeurt centraal, idempotent en exact één keer na een
  geslaagde commit.

| Wijziging | `timephasedFinishFloor` + `timephasedStartAnchor` | `timephasedDurationWalks` | Resource load |
|---|---|---|---|
| assignment toevoegen/verwijderen | wissen via `clearTimephasedWindow` | wissen via `clearTimephasedDurationWalks` | herberekenen |
| assignment naar andere taak/resource verplaatsen | wissen op oude én nieuwe taak | wissen op oude én nieuwe taak | herberekenen |
| `unitsPerDay` wijzigen | behouden | behouden | herberekenen |
| `curve` wijzigen | behouden | behouden | herberekenen |
| `workWindowStart`/`workWindowFinish` | geen schrijver in deze overhaul | geen schrijver in deze overhaul | niet van toepassing |

Units en curve veranderen de assignmentset of resourcekalender niet en sturen de CPM momenteel
niet; daarom worden geïmporteerde taakvensters niet onnodig gewist. De werkvenstervelden zijn nu
uitsluitend round-tripmetadata en hebben geen live planner-/loadconsument. Ze bewerkbaar maken zou
een effect suggereren dat niet bestaat en vereist eerst een apart contour-/assignmentvensterontwerp;
in deze overhaul zijn ze wel volledig zichtbaar en kopieerbaar, maar read-only.

De taakgrid importeert deze taakassignmentplanner. De resourcetabel hoeft hem in deze overhaul niet
te adopteren en wordt verder niet gewijzigd.

### 5.7 Baselines

Voor iedere baseline in het huidige project toont de categorie **Baseline** afzonderlijk:

- `<baselinenaam> — Start`;
- `<baselinenaam> — Einde`;
- `<baselinenaam> — Duur`;
- `<baselinenaam> — Startafwijking`;
- `<baselinenaam> — Eindafwijking`;
- `<baselinenaam> — Duurafwijking`;
- `<baselinenaam> — Mijlpaalstatus`;
- `<baselinenaam> — Mijlpaalsoort`.

Alle baselinekolommen zijn read-only. De twee technische mijlpaalkolommen dekken de overige
`BaselineTask`-snapshotvelden; `taskId` is de stabiele koppeling met de gewone Taak-id-kolom.
Start- en eindafwijking gebruiken dezelfde
werkdagberekening als `engine/variance.ts`; duurafwijking is huidige duur minus baselineduur. Een
taak die na de baseline is toegevoegd toont `—` met de uitleg “Niet aanwezig in deze baseline”.

De kolom-id bevat project- en baseline-id. Verwijderen van een baseline verbergt zijn kolommen maar
wist de persoonlijke voorkeur niet meteen, zodat undo van de baselineverwijdering de indeling kan
herstellen.

De compile-time dekking is daarmee: `taskId` via de gewone Taak-id-koppeling, `start`, `finish` en
`duration` via de drie basisbaselinekolommen, en `isMilestone`/`milestoneKind` via de twee technische
mijlpaalkolommen. De drie afwijkingskolommen zijn afgeleiden en vervangen geen bronveld.

## 6. Kolommen toevoegen, verwijderen en ordenen

### 6.1 De plus aan de rechterrand

Aan de rechterrand van iedere taakgrid blijft een plus zichtbaar, onafhankelijk van horizontale
scroll. De plus is geen datakolom en wordt niet meegekopieerd.

Klik opent een lijst met:

1. bovenaan maximaal tien laatst gebruikte, nu beschikbare velden;
2. een zoekveld;
3. daaronder de tien categorieën als inline accordeons.

Meerdere categorieën mogen tegelijk openstaan. Na het toevoegen van één kolom sluit de lijst. De
nieuwe kolom komt uiterst rechts in de niet-vastgepinde kolommen. Een reeds zichtbare kolom is
aangevinkt en uitgeschakeld, zodat duplicaten onmogelijk zijn.

De MRU-lijst is één persoonlijke lijst voor taakvelden op beide oppervlakken. Een dynamisch veld dat
in het huidige project niet bestaat wordt tijdelijk niet getoond, maar blijft in de MRU bewaard.

### 6.2 Verwijderen

Iedere kolomkop toont bij hover of toetsenbordfocus een min. Activeren verwijdert de kolom direct,
zonder bevestiging; undo herstelt hem. Er zijn geen verplichte kolommen: ook WBS en Naam mogen weg.
Als alle kolommen weg zijn, blijft een lege grid met de vaste plus en een korte uitleg om een kolom
toe te voegen.

### 6.3 Volgorde, breedte en pinning

- Kop slepen verandert de volgorde en toont een duidelijke invoeglijn.
- Slepen aan de scheiding verandert de breedte, met de bestaande ondergrens van 40 px.
- Dubbelklikken op de scheiding voert auto-fit uit, begrensd op 480 px.
- Auto-fit meet header en volledige waarden via de formatter/tekstmeting; virtualisatie mag de
  uitkomst niet beperken tot de toevallig zichtbare rijen.
- Rechtsklik op een kop toont alleen: **Links vastzetten/losmaken**, **Breedte automatisch** en
  **Kolom verwijderen**. Er staan geen sorteeracties in.
- Vastgepinde kolommen blijven fysiek links en behouden onderling hun kolomvolgorde. Slepen ordent
  binnen het vastgepinde of vrije blok; pinnen of losmaken gebeurt expliciet via het contextmenu.
- Als vastgepinde breedtes samen groter worden dan de beschikbare viewport, moet alle data
  bereikbaar blijven. De grid valt dan terug op horizontale scroll voor de totale kolomstrook; de
  voorkeur blijft bewaard en wordt weer echt vastgezet zodra er genoeg breedte is.

## 7. Selectie en toetsenbord

### 7.1 Selectiemodel

De grid bewaart afzonderlijk:

- de actieve cel;
- het anker van een bereik;
- één aaneengesloten rechthoekige celselectie;
- de geordende set geselecteerde taak-id’s;
- de actieve taak voor het enkelvoudige eigenschappenpaneel.

Gedrag:

- Gewone klik selecteert de cel én de bijbehorende taak.
- Shift-klik of Shift+pijl breidt de rechthoek uit. Alle unieke taken op de betrokken taakrijen
  worden geselecteerd.
- Ctrl-klik voegt één taak toe of haalt hem uit de taakselectie. De aangeklikte cel wordt de actieve
  enkelvoudige cel; er ontstaat geen niet-rechthoekige kopieerselectie.
- Groepsrijen zijn geen taakcellen. Ze kunnen in-/uitklappen, maar komen niet in het klembordbereik.
- Bij resourcegroepering wordt een taak die tweemaal in het bereik voorkomt slechts eenmaal als taak
  geselecteerd.
- De actieve cel bepaalt de enkelvoudige taak die het eigenschappenpaneel toont. Er komt geen
  bulk-eigenschappeneditor.

Een taakactie zoals verwijderen, inspringen of uitspringen werkt op alle geselecteerde taken. Dat
is bewust: de gebruiker heeft die taken zelf geselecteerd. De actieve cel blijft wel het anker voor
typen en plakken.

### 7.2 Navigatie

- Pijlen: één cel verplaatsen.
- Tab / Shift+Tab: volgende/vorige cel, met doorloop naar de volgende/vorige taakrij. Op de
  allerlaatste cel geeft Tab, en op de allereerste cel geeft Shift+Tab, de toets terug aan de
  browser (WCAG 2.1.2, geen toetsenbordval) — zie hieronder.
- Enter of F2: actieve bewerkbare cel bewerken.
- Tijdens bewerken: Enter commit en gaat één taakrij omlaag; Shift+Enter commit en gaat omhoog.
- Direct typen: vervangt de bestaande celinhoud en start bewerken.
- Escape: annuleert en herstelt de oude waarde tijdens bewerken. In selectiemodus (geen editor
  open) verhuist Escape de browserfocus naar de gridcontainer zonder de actieve cel te wijzigen —
  ook dit is de expliciete uitgang uit de grid, zie hieronder.
- Insert: maakt via de bestaande bewaakte invoegroute een taak en opent direct de naamcel.
- Home / End: eerste/laatste zichtbare kolom van de taakrij.
- Ctrl+Home / Ctrl+End: eerste/laatste taakcel van de zichtbare grid.
- Bestaande sneltoetsen voor in-/uitspringen blijven leidend. Ctrl+pijl-links/rechts krijgt hier
  nadrukkelijk geen nieuwe betekenis.

Navigatie telt alle zichtbare kolommen, ook read-only kolommen. Enter/F2 op read-only toont geen
editor; de cel blijft wel selecteerbaar en kopieerbaar.

**Geen toetsenbordval (WCAG 2.1.2).** `resolveTaskGridCommand` klemde Tab/Shift+Tab voorheen op de
eigen positie aan de randen van de grid, en `DataGridCore` annuleert elk afgehandeld toetsenbord-
event (`preventDefault` + `stopPropagation`). Het gevolg: op de allerlaatste cel kon Tab, en op de
allereerste cel Shift+Tab, de grid nooit verlaten. Het besluit: aan die twee randen geeft
`resolveTaskGridCommand` `{ kind: 'unhandled' }` terug, zodat het native browsergedrag de focus
naar het volgende/vorige focusbare element buiten de grid verplaatst. Daarnaast krijgt Escape in
selectiemodus een expliciete, altijd beschikbare uitgang: `{ kind: 'exit-to-container' }` verplaatst
de DOM-focus naar de gridcontainer (die zelf geen taborde-stop is), zonder de logische actieve cel
te wijzigen. Een daaropvolgende Tab hoeft zo niet eerst weer door de cellen te lopen om de grid te
verlaten.

### 7.3 Klik en dubbelklik

- Eén klik selecteert alleen; booleans, dropdowns en datums wijzigen daardoor niet onverwacht.
- Dubbelklik op een taakcel opent het bestaande eigenschappenpaneel voor de actieve taak.
- Bewerken gebeurt met Enter, F2 of direct typen, niet met dubbelklik.
- Een dropdown opent pas wanneer de cel echt in bewerkmodus gaat.

## 8. Bewerken, validatie en klembord

### 8.1 Editortypen

De registry levert minimaal editors voor tekst, getal, percentage, duur, datum/tijd, boolean,
enum/dropdown, kleur, autocomplete, relaties en getypeerde custom fields. De datumeditor accepteert
typen en een kalenderkiezer; presentatie volgt de persoonlijke datumnotatie, opslag blijft ISO.

Een tekstcel blijft tijdens normale weergave één regel. De inline editor mag horizontaal scrollen,
maar verandert de rijhoogte niet.

### 8.2 Eén domeinroute per wijziging

Een kolomschrijver mag niet rechtstreeks een willekeurig objectveld muteren als daarvoor al een
bewaakte storeactie bestaat. Voorbeelden:

- voortgang via `setTaskProgress` en de bestaande actual-/statusdatuminvarianten;
- relaties via de centrale relation rules en cycluscontrole;
- constraints via de bestaande combinatie- en hard-pinregels;
- resourcevelden via assignmentacties;
- WBS/structuur via de bestaande structuurregels;
- duur via kalender- en uurmodusbewuste parsing.

Gridbewerking, eigenschappenpaneel, MCP en import mogen daardoor niet elk hun eigen versie van een
regel krijgen.

### 8.3 Commit en foutweergave

- Klikken op een andere cel probeert de huidige bewerking eerst te committen.
- Geldige invoer commit en verplaatst de actieve cel.
- Ongeldige invoer laat de editor open, wijzigt geen data en verplaatst focus niet.
- De exacte foutieve cel of het exacte foutieve token krijgt een foutmarkering plus begrijpelijke
  uitleg; een algemene toast alleen is niet genoeg.
- Escape blijft altijd een uitweg uit een ongeldige edit.
- Als een externe mutatie de bewerkte taak verwijdert, wordt de edit zonder commit gesloten.
- Een kolom kan niet worden verwijderd of opnieuw geordend zolang een ongeldige edit focus
  vasthoudt; eerst corrigeren of annuleren.

### 8.4 Berekende en verouderde waarden

Na een datamutatie en vóór **Berekenen** blijven de laatst berekende waarden zichtbaar. Iedere
berekende cel krijgt dan een subtiele verouderd-markering en een tooltip die uitlegt dat F5/
**Berekenen** de waarde vernieuwt. De waarde mag nog steeds worden geselecteerd en gekopieerd.

De markering volgt één centrale `scheduleStale`-bron. Kolommen mogen niet zelf raden of hun waarde
verouderd is.

### 8.5 Kopiëren

- Ctrl+C schrijft een rechthoekige TSV naar `text/plain`, zodat plakken in Excel werkt.
- Waarden volgen de zichtbare persoonlijke notatie, met parseerbare datum-, duur- en
  relatieformaten.
- De TSV gebruikt tab als kolomscheiding en CRLF als rijscheiding. Een cel met tab, CR, LF of `"`
  wordt tussen dubbele aanhalingstekens gezet en een intern `"` wordt `""`; de pasteparser accepteert
  dezelfde Excel-quoting met CRLF of LF. Daardoor breekt tekstinhoud nooit ongemerkt de rechthoek.
- De header wordt niet automatisch meegekopieerd.
- Een losse Ctrl-taakselectie verandert het klembord niet: alleen de actieve rechthoek wordt
  gekopieerd.
- Technische complexe cellen kopiëren hun volledige canonieke inhoud, niet de afgekorte tekst.

#### 8.5.1 Verliesloze externe relatietokens

Een externe relatie mag in het klembord nooit alleen door projectnaam, taaknaam of WBS worden
geïdentificeerd. De normale celrenderer blijft bijvoorbeeld dit tonen:

```text
Project West / Fundering FS+2d
```

Ctrl+C schrijft voor diezelfde token deze canonieke, éénregelige vorm naar de TSV:

```text
Project West / Fundering FS+2d ⟦OPS-EXT/1:<base64url-payload>⟧
```

De payload is UTF-8 JSON met vaste sleutelvolgorde, gecodeerd als base64url zonder padding, en
voldoet exact aan dit versieerbare schema:

```ts
interface ExternalRelationClipboardV1 {
  v: 1;
  origin: {
    ownerTaskId: string;
    direction: 'predecessor' | 'successor';
    linkId: string;
  };
  sourceProjectKey: string;
  sourceRef: {
    projectId: string;
    projectName?: string;
    taskId: string;
    taskName?: string;
    filePath?: string;
  };
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
  sourceMissing: boolean;
}
```

Het zichtbare externe bronlabel wordt canoniek uit
`projectName || projectId` en `taskName || taskId` opgebouwd en volgens §9.1 gequote. Het huidige
persistente model bewaart geen externe WBS-code; de grid doet dus niet alsof die na sluiten of bij
een ontbrekende bron beschikbaar blijft.

`sourceProjectKey` is `project:<projectId>` wanneer een project-id bestaat en anders
`path-sha256:<sha256(normalizeExternalSourcePath(filePath))>`. Als een legacy link beide mist,
gebruikt alleen een
same-cell round-trip `id-only:<origin.ownerTaskId>:<origin.linkId>`; zo'n payload mag niet naar een
andere taak worden geplakt. De parser eist dat de key exact opnieuw uit `sourceRef` of die toegestane
id-only-uitzondering volgt. De payload bevat daarnaast de volledige opgeslagen
`sourceRef`, inclusief `filePath` wanneer die bestaat, omdat een plak naar een andere taak anders
niet dezelfde vernieuwbare bron kan behouden. Die suffix is transportcodering, geen versleuteling:
wie expliciet externe relaties naar Excel kopieert, kopieert dus ook hun technische bronverwijzing.
Er komen geen credentials of bestandsinhouden in de payload.

`normalizeExternalSourcePath()` is één gedeelde, pure lexicale helper; klembordidentiteit én
`refreshExternalAnchors`/bronmatching gebruiken hem. Hij doet geen filesystem-I/O, `realpath` of
symlinkresolutie en volgt exact deze regels:

- NUL en een leeg of niet-absoluut pad zijn ongeldig en leveren geen path-key op;
- een Windows-drivepad (`C:\\...` of `C:/...`) of UNC-pad (`\\\\server\\share\\...` of
  `//server/share/...`) wordt als Windows herkend:
  `\\` wordt `/` en **alle** ASCII-letters in de volledige output — drive, server, share en alle
  padcomponenten — worden vóór vergelijking en hash lowercase. Een drive-root is exact `c:/`; een
  geldige UNC-root bevat een niet-lege server plus share en is exact `//server/share`. `..` mag nooit
  boven die drive- of UNC-root uitkomen;
- een POSIX-pad moet met `/` beginnen, behoudt hoofdletters en behandelt `\\` als een gewoon
  bestandsnaamteken;
- `.`-segmenten verdwijnen, `..` wordt puur lexicaal tegen het vorige segment opgelost en een
  poging boven de root uit te komen is ongeldig;
- herhaalde separators en een trailing separator verdwijnen, behalve bij de eigen rootvorm;
- de hash is SHA-256 over exact de UTF-8-bytes van die genormaliseerde string.

Verplichte testvectoren leggen dit bytegedrag vast:

```text
C:\\A\\.\\X\\..\\B.ifc          -> c:/a/b.ifc
c:/a/b.ifc                       -> c:/a/b.ifc
\\\\Server\\Share\\A\\B.ifc     -> //server/share/a/b.ifc
//SERVER/SHARE/a/./b.ifc         -> //server/share/a/b.ifc
/A/B.ifc                         -> /A/B.ifc
/a/b.ifc                         -> /a/b.ifc   (op POSIX bewust een andere key)
C:/../../b.ifc                   -> ongeldig
relative/b.ifc                   -> ongeldig
```

De eerste twee en de twee UNC-vormen moeten per paar exact dezelfde SHA-256-key opleveren.

Het origineel in `sourceRef.filePath` blijft ongewijzigd voor tonen en daadwerkelijk lezen. Een
legacy pad dat deze functie afwijst valt terug op de hierboven begrensde `id-only`-route. Er bestaan
dus niet twee verschillende padnormalisaties voor refresh en klembord.

Bij een gewone verversing blijft de persistente project-id het primaire matchanker en is het
genormaliseerde pad fallback; daardoor blijft een bewust geselecteerd, verplaatst bronbestand
bruikbaar. Alleen wanneer **Alles verversen** in één actie twee verschillende genormaliseerde
bronpaden inleest die dezelfde project-id claimen, is die id aantoonbaar ambigu. Binnen uitsluitend
die groep matcht iedere bron dan verplicht op zijn eigen genormaliseerde pad. Links zonder een
bruikbaar pad worden in zo'n ambigue groep veilig overgeslagen in plaats van door de laatst gelezen
kopie te worden overschreven. Project- en document-id's worden hiervoor niet herschreven.

De parser behandelt dit als volgt:

1. de suffix wordt strikt op versie, schema, veldlengtes, datum, lag en toegestane tekens
   gevalideerd; onbekende versies of extra velden worden geweigerd;
2. `sourceRef`, `sourceProjectKey`, `anchorDate` en `sourceMissing` komen uit de payload en mogen niet
   via het zichtbare label worden vervangen;
3. het zichtbare relatietype en de zichtbare lag zijn de gewenste nieuwe waarden. De gelijknamige
   payloadvelden beschrijven de gekopieerde uitgangstoestand en worden gebruikt om een ongewijzigde
   round-trip en de oorspronkelijke link eenduidig te herkennen;
4. een handmatig gewijzigd project-/taaklabel dat niet meer canoniek bij `sourceRef` past wordt
   geweigerd met de route **Relatie → Externe relatie toevoegen…**; een bron wisselen gebeurt nooit
   door alleen een label te herschrijven;
5. plakken in dezelfde eigenaar/richting behoudt `origin.linkId` als die link nog exact bij de
   technische brontuple past; anders valt de planner terug op de semantische key uit §9.2;
6. `externalSourceSide(origin.direction, payload.relType)` legt vast of `anchorDate` bij de start of
   finish van de brontaak hoort. Een zichtbaar gewijzigd type of een andere doelrichting mag dat
   anker alleen behouden wanneer `externalSourceSide(nieuweRichting, nieuwRelType)` dezelfde zijde
   oplevert. Bij een zijdewissel wordt de paste atomair geweigerd en opent de herstelroute de
   bestaande externe-relatiedialoog in bewerkmodus; die leest de bron opnieuw of vraagt bij een
   handmatige bron om een nieuw anker;
7. plakken naar een andere taak maakt uit de volledige payload een nieuwe `ExternalLink` met een
   nieuw id. De doelkolom bepaalt de nieuwe richting; bron, geldig anker en ontbrekend-status blijven
   gelijk. Dit is verboden voor een `id-only`-payload, omdat die geen overdraagbare bronidentiteit
   heeft. De gewone duplicate-, ancestor- en cyclusvalidatie blijft gelden;
8. één payload uit een voorgangercel kan dus bewust in een opvolgercel worden geplakt wanneer de
   bronzijde gelijk blijft. Een voorganger-`FS` met finishanker kan bijvoorbeeld als
   opvolger-`FF` worden gebruikt, maar niet als opvolger-`FS` zonder een nieuw startanker;
9. een interactieve editor die vanuit een bestaande token opent, bewaart zijn idmetadata buiten de
   zichtbare tekst. Volledige tekstvervanging of plakken heeft die metadata niet: een externe token
   zonder geldige `OPS-EXT/1`-suffix wordt dan altijd geweigerd, ook als de getoonde namen toevallig
   uniek lijken. Nieuwe externe relaties lopen via de bestaande dialoog.

Een Excel-round-trip is daarmee verliesloos zolang Excel de volledige celtekst inclusief suffix
behoudt. Excel mag relatietype of lag in het zichtbare deel wijzigen; bij terugplakken bewaart de
payload identiteit, bron en anker. Verwijdert Excel de suffix, dan volgt een gerichte validatiefout
en verandert niets. Interne relaties houden hun gewone leesbare tekstvorm en hebben geen technische
suffix nodig, omdat hun WBS-token binnen het actieve project exact tegen taak-id wordt opgelost en
ambiguïteit al een fout is.

### 8.6 Plakken als atomaire transactie

Plakken wordt eerst volledig geparseerd naar voorgenomen domeincommando’s. Daarna valideert de app
de complete eindtoestand op een draft. Pas wanneer alles geldig is, wordt één undoable transactie
toegepast.

De hele paste wordt geweigerd als:

- één doelcel read-only of berekend is;
- één waarde niet geparseerd kan worden;
- één domeinregel faalt;
- een relatie zelfverwijzend, dubbel, cyclisch, ambigu of anderszins verboden wordt;
- dezelfde onderliggende taak door dubbele groepsvoorkomens tegenstrijdige waarden zou krijgen;
- het bereik buiten de beschikbare taakrijen of kolommen valt.

Er bestaat geen gedeeltelijk resultaat. De foutmelding noemt de eerste fout én het celadres; waar
zinvol worden alle gevonden foutcellen tegelijk gemarkeerd. Schrijft een gegroepeerd bereik dezelfde
waarde tweemaal naar exact hetzelfde taakveld, dan dedupliceert de transactie dat; twee verschillende
waarden voor hetzelfde taakveld zijn een fout.

Een 1×1 klembordwaarde mag een geselecteerde rechthoek vullen. Een grotere matrix plakt vanaf de
actieve cel; als de bestaande selectie meer dan één cel bevat, moeten de afmetingen exact passen.

### 8.7 Atomaire UI-transactie

De bestaande `withTransaction` is hiervoor nadrukkelijk ongeschikt: die bundelt undo maar rolt bij
een fout niet terug. Het MCP-transactiepad heeft wel rollback, maar is gekoppeld aan MCP-drafts en
eindherberekeningen en wordt niet als UI-shortcut aangeroepen.

Er komt één generiek, synchroon documenttransactieprimitief voor gridmutaties:

```ts
type GridIntent = CellEditIntent | PasteIntent | RelationSetIntent | AssignmentSetIntent;

type PreparedGridMutation = {
  documentId: string;
  before: Snapshot;
  after: Snapshot;
  derivedAfter: {
    viewRows: readonly ViewRow[];
    resourceLoadResult: ResourceLoadResult | null;
  };
  notifications: readonly DeferredNotification[];
};

function prepareGridMutation(
  state: Readonly<GridMutationState>,
  intents: readonly GridIntent[],
): Result<PreparedGridMutation, readonly CellValidationError[]>;

function commitPreparedGridMutation(prepared: PreparedGridMutation): CommitResult;
```

`prepareGridMutation` en `commitPreparedGridMutation` worden uitsluitend achter één synchrone,
niet-herintreedbare `runGridMutation(intents)` aangeroepen. Er zit geen `await`, workerbericht,
React-yield of gebruikerscallback tussen prepare en commit. JavaScript kan de actieve documentstaat
daardoor niet tussentijds wijzigen. Een half ontworpen `mutationRevision` is dus niet nodig en wordt
niet aan de state toegevoegd. De commit controleert defensief alleen dat `activeDocumentId` nog aan
`prepared.documentId` gelijk is; afwijking is een interne fout en commit niets.

Werking:

1. De prepare-stap neemt een `before`-snapshot en maakt met Immer een geïsoleerde draft van de
   relevante documentstaat. Hij roept uitsluitend pure domeinprimitieven aan; geen store-`set`,
   notificatie of live-storeherberekening mag tijdens voorbereiding optreden.
2. Bestaande slice-invarianten die de grid nodig heeft worden uit de storewrapper getrokken naar
   gedeelde pure functies die zowel de slice als de planner gebruiken. Er komt geen tweede versie
   van voortgangs-, constraint-, relationele of assignmentregels.
3. Alle intents worden op de draft toegepast. Daarna valideren setbrede regels de uiteindelijke
   toestand, waaronder duplicate assignments en de volledige relationele graaf.
4. Bij één fout wordt de draft weggegooid. De live store, undo/redo, `isDirty`, notificaties en
   afgeleide resultaten blijven byte-identiek.
5. Bij succes bevat `after` de complete historydragende eindtoestand uit §13.1: brondata,
   `cpmResult` en `scheduleStale`, maar niet het opnieuw afleidbare `resourceLoadResult`. Na alle
   validatie berekent dezelfde prepare-stap met de bestaande pure selectors `derivedAfter` uit die
   eindtoestand; een fout daarbij gooit eveneens de hele voorbereiding weg.
6. De commit gebeurt in één storeproducer: hij past `after`, `derivedAfter`, één history-event en
   `isDirty` samen toe. Daardoor bestaat er geen render met nieuwe assignments maar oude belasting,
   en bevat redo evenmin stale derived data. Pas na die producer volgen uitgestelde meldingen.
   Handmatig CPM-gedrag blijft behouden: planningrelevante edits zetten
   `scheduleStale`, maar draaien niet stil zelf F5.
7. Een throw vóór of tijdens de enige storeproducer laat de live state ongemoeid; Immer publiceert
   een geworpen producer niet. Er is geen afgeleide post-commitstap meer die apart kan mislukken.

Ook een gewone gridcel gebruikt dit primitief. Daardoor zijn single-edit, multi-paste,
relatiesetdiff en assignmenttokens vier intentvormen boven dezelfde commitgrens. Eigenschappenpaneel
en overige bestaande acties blijven via hun storewrappers werken, maar hun undo-registratie gaat na
de historyfundering uit §13 door hetzelfde getypeerde eventcontract.

## 9. Relaties in de taakgrid

### 9.1 Twee leidende kolommen

De categorie **Relaties** bevat minimaal:

- Voorgangers;
- Opvolgers;
- Relationele vrije speling;
- Relatiewaarschuwingen;
- Externe relatiegegevens (Technisch).

Interne en externe relaties staan samen in Voorgangers en Opvolgers. Beide kolommen zijn
bewerkbaar en zijn twee kanten van dezelfde brondata: een interne wijziging in A’s opvolgercel is
direct zichtbaar in B’s voorgangercel.

Alle `ExternalLink`-bronvelden zijn aantoonbaar gedekt:

| `ExternalLink`-veld | Normale/technische weergave |
|---|---|
| `id` | technisch extern-relatie-id |
| `direction` | plaatsing in Voorgangers of Opvolgers |
| `relType` | suffix `FS`/`SS`/`FF`/`SF` |
| `lagDays` | lag in dagen in het suffix en technische waarde |
| `lagMinutes` | lag in minuten in uurmodus en technische waarde |
| `anchorDate` | bevroren anker in Externe relatiegegevens |
| `sourceRef` | project-/taaknaam in de normale token; ids en `filePath` technisch |
| `sourceMissing` | waarschuwing, tooltip en technische status |

Voorbeelden:

```text
1.2 FS+2d, 1.3 SS
1.4 SS+50%, 1.5 FF+3ed
Project West / Fundering FS+2d
```

Het relatietype is altijd `FS`, `SS`, `FF` of `SF`. Positieve lag gebruikt `+`, lead gebruikt `-`.
Voor **interne** `Sequence`-tokens hergebruikt de parser `parseLagInput` en de formatter
`formatLagShort`: werkdagen (`d`), elapsed dagen (`ed`), uren (`u`/invoer ook `h`), elapsed uren
(`eu`/`eh`) en percentage (`%`/`e%`) blijven dus symmetrisch met de bestaande relatie-editors en
solverprecedentie. Projectnamen met komma,
slash of aanhalingsteken worden in de tekstvorm gequote en escaped, zodat tokenisering nooit op een
zichtbaar teken hoeft te gokken.

De interne `Sequence`-dekking is expliciet: `id` wordt technisch en in editormetadata bewaard;
`predecessorId`/`successorId` vormen de WBS-token en richting; `type` vormt het typecode-suffix; en
`lagDays`, `lagMinutes`, `lagUnit` en `lagPercent` worden samen door de bestaande lagformatter en
-parser gedragen. Geen van de vier lagbronvelden mag bij een typewisseling als stale hogere-
precedentiewaarde achterblijven.

Een **externe** `ExternalLink` heeft aantoonbaar geen `lagUnit` of `lagPercent`. Externe tokens
gebruiken daarom een aparte verliesloze `parseExternalLagInput`/`formatExternalLagShort`:

- toegestaan: vaste werkdaglag (`d` of kaal getal) en vaste werktijduren (`u`, invoer ook `h`);
- niet toegestaan: `%`, `e%`, `ed`, `eu` en `eh`;
- `lagMinutes` is de bron bij een uurwaarde; anders is `lagDays` de bron;
- een niet-ondersteunde externe suffix houdt de edit open met “Externe relaties ondersteunen
  alleen vaste werkdag- of werktijdlag”.

Daarmee suggereert de gezamenlijke cel geen semantiek die het huidige externe datamodel, de solver,
refresh of import/export niet kan bewaren. Uitbreiding van externe links met elapsed/procentuele lag
is een apart datamodel- en round-tripontwerp en valt buiten deze overhaul.

### 9.2 Hele cel is de gewenste eindtoestand

Bij commit is de celtekst de volledige gewenste verzameling voor die richting. Voorbeeld:

```text
oud: 1.2 FS, 1.3 SS
nieuw: 1.2 FS+2d, 1.4 FF
```

Dat betekent in één transactie:

- relatie met 1.2 wijzigen;
- relatie met 1.3 verwijderen;
- relatie met 1.4 toevoegen.

Iedere bestaande `Sequence` en `ExternalLink` heeft verplicht een stabiel `id`. De editor bewaart dat
id als onzichtbare tokenmetadata zolang een token interactief wordt gewijzigd; namen en WBS-codes
zijn nooit identiteit. Plakken of het volledig vervangen van tekst heeft geen tokenmetadata en valt
terug op de onderstaande semantische keys.

- Interne exacte key: `(predecessorId, successorId, type)`; de vier lagvelden zijn wijzigbare
  payload en geen identiteit.
- Externe exacte key:
  `(ownerTaskId, direction, sourceProjectKey, sourceRef.taskId, relType)`, waarbij
  `sourceProjectKey = project:<projectId>` als die niet leeg is en anders
  `path-sha256:<sha256(normalizeExternalSourcePath(filePath))>` volgens de ene gedeelde helper uit
  §8.5.1. De hash voorkomt dat de semantische vergelijkingskey zelf een lokaal pad hoeft te
  verspreiden; de lossless klembordpayload uit §8.5.1 draagt voor een echte cross-task-kopie wel de
  volledige `sourceRef`. `projectName`, `taskName`, het getoonde bronlabel en `sourceMissing` zijn
  geen identiteit.
- Een externe link zonder project-id én zonder bestandspad kan alleen via zijn bestaande token-id
  worden gewijzigd; een tekst/plakfallback is dan ambigu en wordt geweigerd.

Een exacte keymatch behoudt het id en mag type-ongewijzigde lag bijwerken. Voor een typewijziging
wordt de key zonder `type`/`relType` gebruikt, maar uitsluitend als er voor dat tegen-eindpunt exact
één unmatched oude en één unmatched nieuwe token bestaan. Bij meerdere types op hetzelfde paar is
die koppeling ambigu: semantisch ongewijzigde exacte keys behouden hun id, de overige oude records
worden verwijderd en de nieuwe krijgen een nieuw id. Er wordt nooit willekeurig “de eerste” gekozen.

Refresh mag een externe `sourceRef` canonicaliseren terwijl hetzelfde record-id blijft bestaan;
idmetadata wint dan van de fallbackkey. De complete uiteindelijke relationele graaf wordt
gevalideerd; de toevallige volgorde van toevoegen en verwijderen mag geen valse cyclusfout geven.

Dit wordt geen losse reeks storeacties. Er komt één pure `planRelationSet` onder de grid én andere
nieuwe relationele schrijvers:

```ts
function planRelationSet(input: {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  ownerTaskId: string;
  direction: 'predecessor' | 'successor';
  tokens: readonly ParsedRelationToken[];
}): Result<RelationMutationPlan, readonly RelationTokenError[]>;
```

De planner:

1. parseert eerst alle tokens met bronposities voor precieze fouten;
2. splitst interne en reeds bekende externe tokens;
3. bouwt de volledige gewenste incoming of outgoing set van de actieve taak;
4. behoudt een id bij tokenmetadata of een exacte semantische keymatch;
5. behandelt alleen de hierboven gedefinieerde eenduidige één-op-één typewijziging als update met
   id-behoud;
6. behandelt een werkelijk ambigue veel-op-veel wijziging als remove+add, maar laat semantisch
   ongewijzigde relaties ongemoeid;
7. combineert de setdiff met alle onaangeraakte relaties tot één finale graaf;
8. valideert self, onbekende taak, ancestorregels, exacte duplicaten, type en lag op de finale set;
9. breidt summaryrelaties uit met dezelfde `expandSummaryRelations`-semantiek als de solver en draait
   daarna één gedeelde pure cyclusdetector op de uiteindelijke leaf-graaf;
10. retourneert alleen een mutation plan; commit gebeurt atomair via §8.7.

De huidige pure cycluscontrole uit `mcpValidation` wordt naar een neutrale domeinmodule verplaatst en
door MCP en de relation planner gedeeld. `relationVerdict` blijft de lokale nieuwe-relatiecheck, maar
is niet langer de enige check waarop een hele relationele celcommit vertrouwt. Solverdetectie blijft
een laatste vangnet, niet de normale gebruikersvalidatie.

### 9.3 Interne WBS-verwijzingen

Een interne WBS wordt via autocomplete gekozen of exact getypt. De commit faalt bij:

- onbekende WBS;
- meerdere taken met dezelfde getypte WBS;
- een relatie naar de taak zelf;
- een duplicaat;
- een cyclus;
- een relatie die de actuele centrale relation rules weigeren, waaronder de geldende
  voorouder-/verzameltaakregels;
- ongeldig relatietype of ongeldige lag.

De grid importeert de centrale regels; hij legt geen kopie naast `relationRules`.

### 9.4 Externe relaties

Bestaande externe relaties kunnen in de cel worden verwijderd en hun type/lag kan worden gewijzigd.
Een volledig nieuwe externe relatie kan niet alleen uit vrije tekst ontstaan, omdat bronbestand,
bronproject, bron-taak-id en ankerdatum nodig zijn. Een onbekend extern teksttoken wordt daarom
geweigerd met de concrete route **Relatie → Externe relatie toevoegen…**.

De canonieke `OPS-EXT/1`-klembordtoken uit §8.5.1 is geen onbekende vrije tekst: hij draagt alle
bronvelden en de bevroren ankerdatum en mag daarom atomair naar een andere taak worden gekopieerd.
Een externe token zonder editor-idmetadata én zonder die volledige payload blijft verboden.

Die route opent de bestaande `ExternalLinkDialog`, tijdelijk en taakgebonden. De dialoog krijgt
expliciet een add- en editmodus. Beide modi gebruiken dezelfde `parseExternalLagInput` als de grid,
accepteren dus vaste `d` en `u`/`h`, en normaliseren naar exact één actief bronveld:
`lagDays` óf `lagMinutes`. In dagmodus gebruikt een handmatig anker een datumveld; in uurmodus een
datum/tijdveld dat dezelfde datetimeconventie als `anchorDate` parseert. Bij een gelezen bron kiest
`sourceAnchorDate` automatisch start of finish. Editmodus ontvangt `taskId` plus `linkId`, vult bron,
richting, type, lag en anker voor en schrijft geen nieuwe link-id.

Bij een bronzijdewissel commit de dialoog één bewaakt mutation plan met het bestaande id, de nieuwe
richting/type/lag en het opnieuw gelezen of handmatig gekozen anker. Annuleren laat alles
byte-identiek. Dit is een uitbreiding van de tijdelijke bestaande dialoog, geen permanent
extern-relatiepaneel en geen nieuw persistent datamodel.

Voor bewerken komt een expliciete bewaakte route:

```ts
updateExternalLink(
  taskId: string,
  linkId: string,
  patch: Partial<Pick<ExternalLink, 'relType' | 'lagDays' | 'lagMinutes'>>,
): Result<void, ExternalLinkValidationError>;
```

De route bewaart `id`, `direction`, `anchorDate`, `sourceRef` en `sourceMissing`, normaliseert de
vaste dag-/minutenlag volgens `parseExternalLagInput` en weigert elapsed/procentuele of anderszins
ongeldige combinaties. Een typewijziging die volgens `externalSourceSide` dezelfde bronzijde houdt,
mag het bestaande anker behouden. Een type- of richtingwijziging die van startanker naar
finishanker of omgekeerd gaat, loopt via `ExternalLinkDialog` in bewerkmodus: bronbestand opnieuw
lezen of bij een handmatige bron expliciet een nieuw anker invoeren, waarna id, type/richting en
anker samen atomair wijzigen. Er komt dus geen tussenstaat met nieuwe semantiek en oud anker, en geen kale
`updateTask({ externalLinks })`. Verwijderen blijft via de bestaande id-route. Een hele cel gebruikt
dezelfde pure externe setdiffprimitief in §8.7, zodat meerdere externe wijzigingen één commit zijn.

Een ontbrekende bron blijft een geldige bevroren externe relatie. De cel toont een waarschuwing en
tooltip; planning blijft de opgeslagen `anchorDate` gebruiken. Dat is verouderd, niet ongeldig.

Rechtsklik op één extern relatietoken toont:

- Bron vernieuwen;
- Relatie verwijderen.

### 9.5 Hover en springen volgens issue #65

Alleen het interne WBS- of externe taakverwijzingsdeel is interactief; `FS+2d` blijft gewone
relatietekst. Hover op een interne WBS toont exact dezelfde `HoverTooltip` met `TaskTooltipContent`
als hover op een taakbalk in de Gantt. Klik gebruikt de bestaande `focusOnTask`-actie:

- taak selecteren;
- voorouderketen openklappen;
- verticaal centreren;
- horizontaal naar de taak zoomen/scrollen volgens de bestaande begrenzing.

Er wordt geen tweede tooltip of afwijkende springlogica gebouwd. Voor een externe taak zonder lokaal
taakobject toont hover de beschikbare bevroren broninformatie en is lokaal springen uitgeschakeld.

### 9.6 Driving, vrije speling en waarschuwingen

- Een driving relation krijgt een subtiel accent in dezelfde voorganger-/opvolgercel.
- Relationele vrije speling is een aparte read-only kolom, bijvoorbeeld
  `← 1.2: 0d, → 1.4: 2d`.
- Relatiewaarschuwingen is een aparte read-only kolom, per WBS gelabeld.
- Driving en relationele speling gebruiken de laatst berekende analyse en dragen de centrale
  verouderd-markering wanneer `scheduleStale` waar is.

Deze kolommen nemen de informatie over die nu alleen in `RelationsPanel` zichtbaar is.

## 10. Lint en verdwijnen van de Relaties-tab

### 10.1 Nieuwe relatiedropdown

De bestaande knop **Relatie** wordt een popovercomponent volgens `MilestoneDropdown`. De dropdown
bevat:

1. **Relatie tekenen** — toggelt de bestaande dependency-drawmodus;
2. **Geselecteerde taken koppelen** — exact twee geselecteerde taken, eerste selectie is
   voorganger, standaard FS en lag 0, via `createRelationWithFeedback`;
3. **Externe relatie toevoegen…** — voor de actieve taak, opent `ExternalLinkDialog`;
4. **Alle externe relaties vernieuwen** — gebruikt de bestaande refreshroute.

Een onbeschikbare actie blijft zichtbaar maar uitgeschakeld met een concrete tooltip, bijvoorbeeld
“Selecteer precies twee taken”. De knop verandert dus niet langer stil van betekenis op basis van
de selectie.

### 10.2 Trace in Tabel

De bestaande `traceGroup` wordt ook aan het linttabblad **Tabel** toegevoegd. `buildTrace` verhuist
naar een gedeelde, UI-onafhankelijke selector die canvas en grid consumeren.

In de volledige grid:

- focus, voorgangers en opvolgers blijven normaal zichtbaar;
- alle andere taakrijen vervagen;
- rijen verdwijnen niet en hun positie verandert niet;
- groepskoppen blijven leesbaar;
- de richtingknoppen kunnen afzonderlijk of samen actief zijn, volgens het bestaande gedrag.

### 10.3 Verwijderpoort

`RelationsPanel`, het linttabblad **Relaties** en **Beheren** mogen pas weg wanneer geautomatiseerde
pariteitstests en een handmatige gebruikersroute aantonen dat het volgende elders beschikbaar is:

- interne relaties bekijken, toevoegen, wijzigen en verwijderen;
- twee geselecteerde taken koppelen;
- driving en vrije speling bekijken;
- waarschuwingen bekijken;
- externe relaties toevoegen, bekijken, vernieuwen en verwijderen;
- naar de betrokken lokale taken springen;
- voorgangers en opvolgers traceren.

Tot die poort gehaald is, blijft het oude paneel tijdelijk bestaan. Er mag geen tussencommit op
`main` belanden waarin informatie of een actie verdwenen is.

## 11. Rijacties en structuur

- Rijdrag werkt in beide taakgrids via dezelfde bestaande `useTableRowDrag`-/`moveTasksTo`-regels.
- Sleep je een taak uit een meervoudige selectie, dan beweegt de hele selectie in één undo-stap.
- Rijdrag, inspringen, uitspringen en positioneel invoegen zijn alleen actief in pure boommodus:
  geen filter, geen groep en geen sortering.
- Buiten boommodus wordt de actie niet stil genegeerd; de bestaande duidelijke
  structuurvergrendelingsmelding wordt gebruikt.
- De aanwezigheid van een expliciete sortering onder **Beeld** blijft dus verenigbaar met het verbod
  op snel sorteren via koppen.

## 12. Persoonlijke opslag en layouts

### 12.1 Gebruikersniveau

Nieuwe opslag onder een versieerbare `ops-*`-sleutel bevat:

- kolommen, volgorde, breedtes en pinning voor `gantt-task-grid`;
- hetzelfde afzonderlijk voor `full-task-grid`;
- horizontale scroll per oppervlak;
- de gedeelde MRU-lijst van maximaal tien velden;
- een schemaversie en parse-/migratieguard.

Deze gegevens staan niet in `DOCUMENT_FIELDS`, projectbestanden, IFC of document-recoverypayloads
en zetten `isDirty` nooit aan. Een corrupte instelling valt per oppervlak terug op de default en
mag de app niet onbruikbaar maken.

Eerste standaard:

- Gantt-takenpaneel: WBS, Naam, Duur;
- volledige Tabel: de huidige brede defaults — WBS, Naam, Duur, Start, Einde, Type, Kritiek,
  Totale speling, Gereed en de momenteel bestaande dynamische code-/customfielddefaults.

### 12.2 Projectgebonden dynamische velden

Een activity code, custom field of baselinekolom verschijnt alleen in een project waarin exact die
projectgebonden definitie bestaat. De persoonlijke positie en breedte blijven bewaard voor het
oorspronkelijke project. Wisselen van project mag de voorkeur niet wegfilteren of overschrijven.

### 12.3 Opgeslagen layouts

Een opgeslagen Layout blijft app-globaal en bevat naast filter, groep, sortering en tijdschaal de
kolomindeling die op het moment van opslaan in het actieve taakoppervlak zichtbaar is.

Bij toepassen:

- filter/groep/sortering/tijdschaal gelden voor het actieve document volgens het bestaande gedrag;
- de kolommen worden op het op dat moment actieve taakoppervlak toegepast;
- de kolommen van het andere taakoppervlak veranderen niet;
- niet-beschikbare dynamische kolommen worden tijdelijk onderdrukt, niet uit de Layout verwijderd.

Zo kan een Layout “Voortgang” in zowel Gantt als Tabel worden toegepast zonder beide persoonlijke
indelingen tegelijk te overschrijven.

### 12.4 Migratie

- Oude `view.columns` worden niet langer als projectvoorkeur gebruikt.
- Als nog geen nieuwe gebruikersvoorkeur bestaat, wordt bij de eerste migratie de oude zichtbare
  kolomset van het actieve document als start voor de volledige Tabel overgenomen; het
  Gantt-takenpaneel krijgt zijn vaste eerste default.
- `visible:false`-kolommen worden bij die conversie niet toegevoegd.
- Oude dynamische `FieldRef`s uit `view.columns` mogen de context van dat document krijgen: daar is
  het herkomstproject aantoonbaar bekend.
- Oude app-globale Layouts hebben géén herkomstproject. Hun activity-code-/customfieldrefs worden
  daarom gemigreerd naar opaque `legacy-activity-code:<typeId>` en
  `legacy-custom-field:<defId>`, nadrukkelijk niet naar het toevallig actieve project.
- Zo’n legacy-ref wordt alleen tijdelijk gerenderd wanneer het actieve project een definitie van
  hetzelfde soort met exact hetzelfde id bevat. Dat tijdelijke matchen herschrijft de opgeslagen
  Layout niet. Pas wanneer de gebruiker de Layout in dat project expliciet **Bijwerkt** of opnieuw
  **Opslaat als**, wordt de ref een project-scoped id.
- Oude opgeslagen Layouts worden dus lazily gelezen, maar alleen automatisch definitief
  geconverteerd voor statische builtinrefs. Ambigue dynamische identiteit blijft opaque tot een
  expliciete gebruikerssave de herkomst vastlegt.
- Onbekende velden blijven in een Layout behouden als opaque id wanneer ze syntactisch geldig zijn;
  ze worden alleen niet getoond. Zo vernietigt openen in een ander project geen voorkeuren.

De migratie is idempotent en draagt een eigen schemaversie. Een crash halverwege laat de oude
`ops-layouts` ongemoeid totdat de volledige nieuwe payload valide is; pas daarna wordt de nieuwe
sleutel atomair geplaatst en de migratieversie verhoogd. Geen enkele migratiestap markeert een
project dirty.

## 13. Undo en redo

De huidige `undoStack: Snapshot[]`/`redoStack: Snapshot[]` per `DocumentPayload` kan persoonlijke
gridvoorkeuren en één chronologische app-sessie niet modelleren. Dit is daarom een afzonderlijke
fundering binnen de overhaul, niet een aanpassing van twee arrays.

### 13.1 Eventmodel

```ts
type HistoryDelta =
  | {
      kind: 'document-data';
      documentId: string;
      before: Snapshot;
      after: Snapshot;
    }
  | {
      kind: 'document-view';
      documentId: string;
      before: ViewLayoutHistoryState;
      after: ViewLayoutHistoryState;
    }
  | {
      kind: 'grid-preference';
      surface: 'gantt-task-grid' | 'full-task-grid';
      before: TaskGridSurfacePreferences;
      after: TaskGridSurfacePreferences;
    };

interface SessionHistoryEvent {
  id: string;
  sequence: number;
  label: string;
  state: 'applied' | 'undone';
  deltas: readonly [HistoryDelta, ...HistoryDelta[]];
}
```

`ViewLayoutHistoryState` is exact
`Pick<ViewState, 'filter' | 'group' | 'sort' | 'zoom' | 'scrollX' | 'timeScale' | 'collapsedGroupKeys'>`.
`view.columns` zit daar bewust niet in. Een data-`Snapshot` blijft het bestaande exhaustieve
projectdatasnapshot; presentatie wordt niet heimelijk aan dat contract toegevoegd.

De afgeleide-stategrens wordt wel één keer bewust gecorrigeerd:

- `cpmResult` en `scheduleStale` blijven in `Snapshot`. Handmatig berekenen betekent dat een oude
  solveruitkomst plus zijn stale-vlag niet altijd uit brondata opnieuw mag worden berekend; undo en
  redo moeten exact die berekenstand herstellen.
- `resourceLoadResult` verdwijnt uit `Snapshot` en krijgt in `DOCUMENT_FIELDS` `snapshot:'none'`.
  Belasting is deterministisch uit taken/resources/assignments/kalenders af te leiden en wordt na
  iedere data-undo, data-redo en relevante commit opnieuw berekend.
- `viewRows` blijft buiten `Snapshot` en wordt eveneens na restore/commit opnieuw berekend.
- De kalendercache blijft via de bestaande `syncProjectCalendar` uit het herstelde snapshot komen.

De compile-assert tussen `Snapshot` en de `DOCUMENT_FIELDS.snapshot`-rollen wordt in dezelfde
fundering aangepast, zodat `resourceLoadResult` niet later stil terug de history in kan lekken.

Dezelfde afgeleide-stategrens geldt bij iedere documentactivatie. `resourceLoadResult` mag in een
slapende `DocumentPayload` als cache blijven staan, maar is bij activering nooit gezaghebbend. Eén
pure `materializeDocumentActivation({ payload, boundaryMode })` bouwt vóór publicatie een
geïsoleerde doelstaat. `boundaryMode` is exact `'silent-switch' | 'open-boundary'`:

- `silent-switch` geldt voor wisselen tussen geopende documenten, sluiten naar een buur, nieuw en
  dupliceren. Behind-items verversen stil, `showLibraryLinkDialog` wordt altijd `false` en alleen een
  positief refreshaantal wordt als notice getoond;
- `open-boundary` geldt voor bestand openen/importeren en crash-recovery. Deze modus behoudt exact
  de huidige open-boundarysemantiek: vóór behind-verversing `deviated` en `removed` classificeren,
  behind stil verversen, het afwijkingsdialoogsignaal uit de deviated-count bepalen en de volledige
  vlagtoestand — ook `false`/`null` — bij de ene publicatie vestigen.

Daarna doorloopt iedere modus dezelfde stappen:

1. payload hydrateren en alle synchrone activatiegrensmutaties uitvoeren, inclusief
   `syncProjectCalendar` en een pure behind-only bibliotheekmaterialisatie;
2. uit die definitieve doelstaat `viewRows` en `resourceLoadResult` berekenen;
3. `cpmResult` exact uit de payload behouden. `scheduleStale` start met de payloadwaarde en mag door
   een werkelijk ververste kalender alleen via de bestaande `markScheduleStale`/
   `datesAsRecorded`-regel veranderen; activeren draait geen stille CPM;
4. pas daarna in één storeproducer het uitgaande document parkeren, brondata, kalendercache,
   afgeleiden en `activeDocumentId` publiceren en documentgebonden tijdelijke UI resetten.

`switchDocument`, het sluiten van het actieve document naar een buur, nieuw, dupliceren,
openen/importeren en crash-recovery gebruiken allemaal deze ene materializer met de hierboven
vastgelegde modus. Er bestaat dus geen
render waarin het nieuwe document al actief is met `viewRows` of belasting van het vorige of een
slapende cache. Een latere asynchrone verversing mag niet in-place half publiceren: zij krijgt een
eigen prepare/commitgrens die brondata en beide afgeleiden samen vervangt. Pas na de atomaire
publicatie worden extension-events of React-effecten uitgezonden.

De activatiematerializer mag nadrukkelijk niet de huidige live storeactie `refreshBehindItems`
aanroepen. De berekenlogica daaronder wordt eerst uitgetrokken naar een pure helper:

```ts
type BehindRefreshMaterialization = {
  payload: DocumentPayload;
  calendarsChanged: number;
  resourcesChanged: number;
  invalidateRedoScope: boolean;
};

type LibraryBoundarySignals = {
  refreshed: number;
  deviated: number;
  removed: number;
  showLibraryLinkDialog: boolean;
  libraryRefreshNotice: number | null;
};

function materializeBehindOnlyRefresh(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
}): BehindRefreshMaterialization;

function materializeLibraryBoundary(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
  mode: 'silent-switch' | 'open-boundary';
}): BehindRefreshMaterialization & { signals: LibraryBoundarySignals };
```

Deze helper werkt uitsluitend op de geïsoleerde payload, gebruikt dezelfde
`classify*OnOpen`/`apply*Update`-primitieven en roept geen `set`, `get`, notificatie,
`recomputeViewRows`, `recomputeResourceLoad` of UI-actie aan. Hij synchroniseert na een
kalenderwijziging de projectkalendercache en zet `scheduleStale` volgens de bestaande
`datesAsRecorded`-regel, maar zet het document niet dirty en maakt geen undo-event.

`materializeLibraryBoundary` classificeert en stelt alleen resultaten samen rond die helper; ook hij
is puur en roept de huidige live `runOpenBoundary`, `refreshBehindItems` of `setUI` niet aan. In
`silent-switch` zijn `deviated`/`removed` nul voor UI-doeleinden en is
`showLibraryLinkDialog:false`. In `open-boundary` worden `deviated`/`removed` op de ongeüpdatete
doelpayload geteld, precies zoals het huidige `runOpenBoundary`, waarna behind-only refresh volgt.
Zo verdwijnen afwijkingssignalen niet in de nieuwe activatiegrens en lekt evenmin een vlag van het
vorige document door.

Omdat zo'n stille bibliotheekwijziging niet via redo teruggezet mag worden, meldt de helper
`invalidateRedoScope:true` zodra hij minimaal één kalender of resource daadwerkelijk heeft
ververst. De
enige activatieproducer verwijdert dan alle undone session-historyevents die scope
`document:<targetId>` raken, overeenkomstig §13.3; compound events verdwijnen geheel. Dezelfde
producer publiceert ook het noticesignaal uit het resultaat. De bestaande publieke
`refreshBehindItems`-actie mag na de extractie zelf wrapper blijven, maar gebruikt voor een reeds
actief document eveneens deze pure helper plus één brondata/afgeleiden-commit. Zo kan geen bestaande
live mutator de activatieatomiciteit doorbreken.

Een gewone datahandeling bevat één `document-data`-delta. Een kolomhandeling bevat één
grid-preferencedelta. **Layout toepassen** bevat één compound event met een `document-view`- en een
grid-preferencedelta. Alle deltas
van een event worden altijd samen toegepast of samen teruggezet; gedeeltelijke undo bestaat niet.
Een compound event mag maximaal één document-id bevatten.

`SessionHistoryEvent[]` en de oplopende sequencecounter zijn app-globale, niet-gepersisteerde
sessiestate. Zij staan niet in `DOCUMENT_FIELDS`, projectbestanden, recovery of localStorage. De
voor/na-gridvoorkeur uit een event wordt na commit/undo/redo wel opnieuw naar de gewone `ops-*`-
voorkeurensleutel geschreven.

### 13.2 Toepasbaarheid en volgorde

Een event is toepasbaar wanneer:

- het alleen grid-preferencedeltas bevat; of
- alle documentdata-/viewdeltas naar het actieve document wijzen.

Undo zoekt het toepasbare event met de hoogste `sequence` en `state:'applied'`. Redo zoekt het
toepasbare event met de laagste `sequence` en `state:'undone'`. Daardoor keert redo de daadwerkelijke
undo-volgorde om, ook wanneer events van niet-actieve documenten ertussen staan.

Voorbeeld: A1, B1, globale kolomwijziging G1. Met document A actief maakt Ctrl+Z eerst G1 en daarna
A1 ongedaan; B1 blijft toegepast. Na wisselen naar B kan B1 ongedaan worden. De events behouden hun
oorspronkelijke sequence; een documentwissel verplaatst niets.

Een compound event met document A plus een kolomwijziging is alleen toepasbaar terwijl A actief is.
Zo kan de globale helft nooit los van de documenthelft teruggedraaid worden.

### 13.3 Nieuwe wijzigingen en redo

Iedere documentdata- of viewdelta heeft scopekey `document:<id>`; een gridelta heeft
`grid:<surface>`. Een nieuw event verwijdert
alle undone events waarvan ten minste één scopekey de nieuwe scopes raakt. Omdat een event atomair
is, wordt bij zo’n botsing het hele oude compound event verwijderd. Undone events van een ander
document of het andere gridoppervlak blijven bestaan.

Daarmee is precies vastgelegd wat “de bijbehorende redo-tak” betekent. Er is geen enkele globale
`redoStack=[]` meer die ongerelateerde documenten wist.

### 13.4 Registratie door bestaande acties

De bestaande `beginUndoable`/`finishMutation` worden de compatibiliteitsgrens:

1. `beginUndoable` neemt bij de buitenste mutatie `before`, actief document-id en label op;
2. mutators werken zoals nu binnen hun storeproducer;
3. `finishMutation` maakt `after` en voegt één toegepast documentdata-event toe als de snapshot echt
   verschilt;
4. bestaande keyed coalescing vervangt alleen `after` van het laatste compatibele event;
5. batchsuppressie laat alleen de buitenste handeling een event maken;
6. §8.7 kan direct een al voorbereid before/after-event committen zonder tussenmutaties.

Hierdoor verschijnen ook projectwijzigingen buiten de grid in dezelfde geschiedenis. De bestaande
`withTransaction` behoudt voor bestaande aanroepers zijn gedocumenteerde “geen rollback”-semantiek,
maar registreert na afloop één event met de werkelijk bereikte eindstand; de nieuwe grid gebruikt
hem niet.

Voor data-undo/redo bouwt een pure `materializeHistoryTarget` eerst buiten de live store een
geïsoleerde doelstaat: snapshot herstellen, kalendercache synchroniseren, `viewRows` en
`resourceLoadResult` uit die doelstaat afleiden. Eén storeproducer publiceert daarna brondata,
cache en beide afgeleiden tegelijk. `cpmResult` en `scheduleStale` worden niet herberekend maar komen
uit het snapshot. Grid-preference-undo zet nooit `isDirty`;
document-view-undo evenmin; alleen documentdata-undo doet dat. Een resize-drag opent bij pointerdown
één pending event en sluit bij pointerup met
de eindbreedte; muispixels zijn geen losse events.

### 13.5 Levensduur, limiet en migratie

- Sluiten van een document verwijdert alle events die een delta voor dat document bevatten. Een
  eventueel compound griddeel wordt mee verwijderd om atomiciteit te behouden.
- De nieuwste honderd events per scopekey blijven behouden, gelijk aan de bestaande `MAX_UNDO=100`.
  Een compound event wordt pas gepruned wanneer het buiten de nieuwste honderd van al zijn scopes
  valt. Daardoor is het totaal begrensd door het aantal open scopes maal honderd.
- Bij upgrade zijn oude per-document stacks niet veilig samen te voegen: zij bevatten geen globale
  volgorde en geen `after`-snapshots. De eenmalige migratie leegt daarom uitsluitend oude undo- en
  redostacks en start een verse sessiegeschiedenis. Projectdata zelf verandert niet en wordt niet
  dirty. Dit wordt niet als projectmigratie opgeslagen.
- Crash-recovery herstelt, net als nu, geen sessiegeschiedenis. Na een herstart begint undo leeg.

Na deze migratie verdwijnen `undoStack` en `redoStack` uit `DocumentPayload` en
`DOCUMENT_FIELDS`; `HistorySlice` bewaart alleen `SessionHistoryEvent[]`. Legacy payloadvelden worden
bij lezen genegeerd en nooit opnieuw weggeschreven. Er blijven dus geen twee concurrerende
historysystemen bestaan.

Voorbeelden van precies één event blijven: één celcommit, één volledige paste, één kolomactie, één
resize-drag, het verplaatsen van twintig geselecteerde taken en één relationele setdiff.

Gridvoorkeuren terug in documentsnapshots stoppen of gebeurtenissen van een ander document stil
muteren tijdens Ctrl+Z is uitdrukkelijk verboden.

## 14. Toegankelijkheid, taal en thema

Dit is een kerncontract van `DataGridCore`, geen testwens achteraf:

- De buitenste interactieve node heeft `role="grid"`, de totale `aria-rowcount` inclusief
  groepsrijen en `aria-colcount` van de zichtbare datakolommen. De plus telt niet als kolom.
- De header heeft `role="row"`; iedere kop heeft `role="columnheader"` en een absolute,
  1-gebaseerde `aria-colindex`.
- Iedere virtuele data- of groepsrij heeft `role="row"` en zijn absolute `aria-rowindex`, ook als
  omliggende rijen niet gemount zijn. Een groepsrij krijgt één `gridcell` met passende
  `aria-colspan` en een toegankelijke in-/uitklapstatus.
- Iedere taakcel heeft `role="gridcell"`, `aria-colindex`, `aria-selected` voor het celbereik en
  `aria-readonly` wanneer de registry geen schrijver aanbiedt.
- Alleen de actieve gridcell heeft `tabIndex=0`; alle andere cellen hebben `-1`. Als de actieve cel
  virtueel niet gemount is, houdt de gridcontainer tijdelijk focus, scrolt de cel in beeld en draagt
  focus daarna over. Er bestaan nooit twee actieve tabstops.
- Vastpinnen dupliceert geen cellen in de DOM. Pinned en vrije kolommen blijven in één logische
  kolomvolgorde; CSS-positionering verandert alleen de visuele positie. In de overflowfallback van
  §6.3 wordt sticky voor het hele pinned blok tijdelijk uitgezet, zodat kolommen niet over elkaar
  heen liggen en de ARIA-volgorde gelijk blijft.
- Pijl-links/rechts bewegen naar de visueel aangrenzende cel; Tab volgt de logische kolomvolgorde.
  Dit wordt apart in RTL getest. De gridstructuur zelf houdt daarom altijd fysieke LTR-volgorde
  en LTR-scrollcoördinaten; kop- en celinhoud krijgen afzonderlijk de taalrichting van de locale.
  “Links vastzetten” blijft als productbesluit fysiek links.
- Plus, min en resizegreep hebben een naam, focusstatus en toetsenbordactie. Resize ondersteunt naast
  pointerdrag ook een toetsenbordstap en auto-fit.
- Een editor/popover krijgt focus zonder de gridcursor te verliezen. Escape sluit hem en brengt
  focus naar dezelfde gridcell terug.
- Ongeldige invoer wordt gekoppeld via `aria-invalid` en `aria-describedby`; de fouttekst staat in
  de DOM en wordt via een bescheiden live region aangekondigd. Tooltip of kleur is nooit de enige
  drager.
- Read-only, verouderd, actief bereik en driving relation hebben naast kleur een icoon, patroon,
  tekst of toegankelijke status.
- Alle gebruikerslabels en meldingen lopen door i18n in alle veertien locales. Licht, donker en
  high-contrast gebruiken bestaande thematokens; popoverplaatsing en tekst volgen de bestaande
  RTL-conventies.

## 15. Prestatie-eisen

- Tienduizenden taakrijen veroorzaken geen evenredig aantal DOM-nodes.
- Scrollen in een realistisch groot plan blijft vloeiend en loopt niet achter op de Gantt-canvas.
- Kolomresize rendert niet per pixel alle taakdata opnieuw; één drag wordt gecoalesced.
- Auto-fit gebruikt efficiënte tekstmeting en blokkeert de interface niet langdurig.
- Relationele displaywaarden worden geïndexeerd op taak-id; per cel de volledige sequences-array
  filteren is niet toegestaan.
- Baselinewaarden worden per baseline eenmalig op taak-id geïndexeerd.
- Een benchmark vergelijkt vóór/na op bestaande gegenereerde projecten en stelt een concrete,
  reproduceerbare regressiegrens vast in het implementatieplan.

## 16. Fout- en randgevallen

Minimaal expliciet afdekken:

- nul kolommen;
- nul taken;
- één taak die in meerdere groepsbanden voorkomt;
- actieve cel verdwijnt door filter, collapse, taakverwijdering of kolomverwijdering;
- selectie over groepskoppen heen;
- meer vastgepinde breedte dan viewportbreedte;
- een dynamisch veld bestaat niet in het volgende project;
- een baseline is verwijderd en via undo teruggezet;
- twee handmatig gelijke WBS-codes;
- interne relationele paste die pas in de uiteindelijke combinatie wel of geen cyclus vormt;
- externe bron ontbreekt of wordt tijdens bewerken onbereikbaar;
- relatieprojectnaam bevat komma, slash of aanhalingsteken;
- TSV-cel bevat tab, CRLF, LF of dubbele aanhalingstekens;
- gemengde dag-/uurkalenders in duur- en lagcellen;
- een computed value is verouderd maar nog kopieerbaar;
- multi-paste raakt dezelfde taak via twee gegroepeerde voorkomens;
- kolomactie terwijl een ongeldige cel edit actief is;
- documentwissel met open edit;
- documentwissel naar een slapende payload met bewust verouderde `viewRows` en
  `resourceLoadResult`;
- undo/redo over twee geopende documenten plus een globale kolomwijziging;
- layout met velden die in het actieve project niet bestaan;
- high-contrast, RTL en 200% browserzoom.

Als een rij of kolom door een externe viewwijziging verdwijnt, commit de grid geen half afgemaakte
tekst. Een geldige open edit wordt vóór een door de gebruiker gestarte viewwissel gecommit; een
ongeldige edit blokkeert die wissel totdat hij gecorrigeerd of geannuleerd is. Wordt de taak door
een andere systeemactie verwijderd, dan annuleert de grid zonder write.

## 17. Test- en bewijsstrategie

### 17.1 Pure/unit-tests

- Exhaustieve compile-time velddekking voor `Task`, `TaskTime`, constraints, externe links,
  assignments en baseline-taken.
- Kolom-id-encoding, projectscoping en migratie.
- Selectierechthoeken, Ctrl-taakselectie en duplicate row occurrences.
- Navigatie aan alle randen en door read-only kolommen.
- Parsers/formatters per editortype en alle persoonlijke datum-/duurvormen.
- Relation parser inclusief quoting, autocomplete-resolutie, volledige-setdiff en foutlocaties.
- Canonieke externe `OPS-EXT/1`-serialisatie en strikte parsing: exacte Excel-round-trip,
  type-/lagwijziging in Excel, gewijzigde zichtbare bronlabels, verwijderde suffix en onbekende
  versie; een legacy `id-only`-bron werkt alleen in dezelfde cel en faalt cross-task.
- `normalizeExternalSourcePath` dekt POSIX, Windows-drive, UNC, dotsegmenten, case-regels,
  root-escape, lege/relatieve legacywaarden en identieke matching bij clipboard plus refresh; de
  acht letterlijke input/outputvectoren uit §8.5.1 zijn vaste regressietests en Windows/UNC-paren
  leveren byte-identieke hashes.
- Externe type-/richtingwijziging behoudt het anker alleen bij dezelfde `externalSourceSide`;
  zijdewisseling zonder opnieuw gelezen of handmatig gekozen anker weigert de hele mutatie.
- ExternalLinkDialog add/edit in dag- en uurmodus: `d` versus `u`/`h`, date versus datetime,
  automatische start-/finishbron, id-behoud en atomair annuleren.
- Relation planner met id-behoud, typewijziging, meerdere types op hetzelfde takenpaar,
  exacte interne/externe fallbackkeys, sourceMissing/refresh, summary-expansie en eindgraafcyclus.
- Externe lag accepteert alleen vaste `d`/`u`/`h` en weigert `%`/elapsed zonder één bronveld te
  wijzigen; interne lag behoudt het volledige bestaande formaat.
- Pasteplanning en atomaire validatie, inclusief bewijs dat iedere fout live store, dirty-vlag,
  afgeleiden, notificaties en history byte-identiek laat.
- Historyscoping over meerdere documenten, compound events, scoped redo-invalidatie, pruning en
  document sluiten; data-undo/redo materialiseert `viewRows` en `resourceLoadResult` atomair terwijl
  `cpmResult`/`scheduleStale` exact uit het snapshot komen.
- Alle documentactivatiepaden materialiseren kalendercache, `viewRows` en `resourceLoadResult` vóór
  één publicatie en vertrouwen nooit de slapende loadcache; activeren start geen CPM.
- Behind-only activatie gebruikt uitsluitend `materializeBehindOnlyRefresh`: geen live storecalls,
  correcte changed-counts/notices, scheduleStale zonder dirty/undo en scoped redo-invalidatie.
- Library-boundarymodi bewijzen afzonderlijk: switch wist een oud dialoogsignaal en toont alleen een
  positieve refreshnotice; open/import/recovery telt deviated/removed vóór refresh en publiceert
  alle UI-signalen samen met payload en afgeleiden.
- Migratie van documentgebonden oude kolommen versus opaque dynamische refs uit globale Layouts.
- Assignmentplanner met duplicate resource, ongeldige units en multi-token rollback.
- Assignment-invalidatiematrix: membership wist beide timephased sturingslagen, units/curve niet,
  en read-only werkvensters hebben geen schijnmutatie.
- Traceclassificatie voor grid en canvas uit dezelfde selector.

### 17.2 Integratietests

- Dezelfde handelingen leveren in Gantt-takenpaneel en volledige Tabel dezelfde data en selectie op.
- Grid en Gantt blijven pixelgelijk bij scroll, zoom, collapse, filter en groep.
- Iedere oude linkerpaneelhandeling heeft na de canvasknip precies één eigenaar; canvas-x=0,
  splitter, fit-to-project en horizontale scrollbar worden afzonderlijk gereproduceerd.
- Timeline deelt `chartOriginX=0` met zijn lokale hit-tests; histogram gebruikt
  `chartOriginX=pickerWidth` en blijft globaal op dezelfde primaire datum-as uitgelijnd.
- Split view bewijst afzonderlijk: vaste DOM-grid links, twee origin-0 timelinecanvassen,
  primaire histogramas, secundaire eigen zoom/scroll en correcte minimap-/scrollbarbreedtes.
- Shift-/Ctrl-selectie stuurt echte bulkacties op alle bedoelde taken.
- Excel round-trip voor tekst, datum, duur, percentage en relaties; externe relaties behouden hun
  technische identiteit en anker met de suffix uit §8.5.1.
- Een externe relatie naar een andere taak plakken maakt een nieuw link-id, neemt de volledige bron
  en het anker over, gebruikt de doelkolom als richting en blijft één atomaire validatie.
- Externe relatiepaste zonder canonieke suffix wordt volledig geweigerd in plaats van op een
  zichtbaar label te gokken.
- Een invalid of read-only doel weigert de hele paste zonder datamutatie of extra undo-entry.
- Persoonlijke kolomvoorkeuren, MRU, pinning en layouts overleven een apprestart en projectwissel.
- Een oude globale Layout met dynamische refs bindt niet aan het toevallig actieve project en wordt
  pas na expliciet opslaan project-scoped.
- Berekende waarden blijven zichtbaar en worden gemarkeerd tot **Berekenen**.
- Interne relaties spiegelen tussen voorganger en opvolger.
- Externe relaties blijven plannen op bevroren ankers als de bron ontbreekt.
- Issue #65: exact dezelfde lokale taaktooltip en `focusOnTask`-sprong.
- Relatietab-pariteitsmatrix vóór verwijdering.
- ARIA-gridrollen, absolute virtuele indices, één roving tabstop en pinned-overflow zonder
  gedupliceerde cellen.

### 17.3 Visuele en handmatige controle

De echte gebruikershandelingen worden in de draaiende app uitgevoerd, niet alleen via componenttests:

- Gantt-paneel en volledige Tabel;
- brede en smalle vensters;
- duizenden taken;
- licht, donker en high-contrast;
- Nederlands, Engels, een lange vertaling en een RTL-locale;
- hover, kopcontextmenu, pluskiezer, datumdropdown, relatie-autocomplete en foutstatus;
- relatie-WBS hover/klik vergeleken met de bestaande taakbalktooltip;
- tracevervaging tegelijk in grid en Gantt.

Screenshots of browserbewijs worden bij interfacewijzigingen bewaard waar zij uitlijning of visuele
gelijkwaardigheid aantonen. De hoofdpoort blijft `npm run verify`; exitcode 0 is leidend.

## 18. Bouwvolgorde en harde poorten

De latere implementatie volgt vijf functionele etappes:

0. fundering: verplicht `ViewRow.rowKey`, nieuwe session history, atomaire UI-transactie,
   projectveilige voorkeurenmigratie en een headless kolomregistry met compile-time velddekking;
1. generieke gridkern, voorkeuren, selectie, keyboard, ARIA, pinning, virtualisatie en klembord;
2. beide taakoppervlakken op dezelfde kern, volledige Gantt-eventmigratie en verwijdering van de
   canvas-takentabel;
3. alle registrykolommen, editors en bewaakte assignment-/voortgangs-/constraintschrijvers;
4. pure relation planner, relatiekolommen, pariteitsbewijs en pas daarna verwijdering van de
   Relaties-tab.

De headless registry en de dekkingsasserts bestaan dus vóór `TaskGridAdapter` gaat renderen. Etappe
3 vult de al afgedwongen catalogus met alle gespecialiseerde editors; hij introduceert niet alsnog
een tweede veldcatalogus in React.

Harde poorten:

- Geen implementatie voordat deze spec tweemaal hyperkritisch is gereviewd, bevindingen verwerkt
  zijn en de eigenaar de herziene spec heeft gezien.
- Daarna komt eerst een afzonderlijk implementatieplan, eveneens uitgebreid gereviewd en verwerkt.
- Geen verwijdering van relatie-UI zonder bewezen pariteit.
- Geen claim “af” of “groen” zonder zelf geziene exitcodes en de noodzakelijke visuele controle.
- Geen push naar `main` in deze sessie.

## 19. Verwerking eerste hyperkritische review

De eerste Tier-2-review gaf ondubbelzinnig **no-go**. De scheiding van de reviewer blijft intact:

- **[BEVESTIGD]** Multi-document undo/redo was onderspecificeerd. Verwerkt als het concrete,
  getypeerde session-historydeelontwerp in §13, inclusief scope, redo, compounds, pruning en migratie.
- **[BEVESTIGD]** `withTransaction` biedt geen rollback en kan de beloofde atomaire paste niet
  dragen. Verwerkt met de geïsoleerde prepare/commitgrens in §8.7.
- **[BEVESTIGD]** `relationVerdict` controleert geen volledige eindgraafcyclus. Verwerkt met de pure
  setdiffplanner, summary-expansie en gedeelde cyclusdetector in §9.2.
- **[BEVESTIGD]** Er bestond geen bewaakte updateactie voor type/lag van externe links. Verwerkt in
  §9.4.
- **[BEVESTIGD]** Oude globale Layouts hebben geen bewijsbaar herkomstproject voor dynamische refs.
  De foutieve binding aan het actieve project is vervangen door opaque legacyrefs in §12.4.
- **[BEVESTIGD]** De Gantt-knip benoemde niet alle event-, hittest-, splitter- en scrollbar-
  eigenaars. Verwerkt in §4.3.
- **[BEVESTIGD]** Duplicate grouped occurrences vereisen een echt `rowKey`-contract. Verwerkt in
  §4.2 en §7.
- **[BEVESTIGD]** De assignmentacties waren te smal voor werkvensters en multi-token edits.
  Verwerkt in §5.6.
- **[BEVESTIGD]** De headless registry moet vóór de adapter bestaan. Verwerkt in §5.2 en de nieuwe
  funderingsetappe van §18.
- **[BEVESTIGD]** De bestaande centrale `scheduleStale`-aansluiting was gezond. §8.4 blijft daarop
  leunen.
- **[BEVESTIGD]** ARIA/RTL/pinning was alleen een testwens. §14 is nu een uitvoerbaar kerncontract.
- **[BEVESTIGD]** De pariteitspoort vóór verwijderen van relatie-UI was gezond en blijft hard in
  §10.3.

De eerste reviewer kon de volledige `GanttCanvas`-eventketen, alle MCP-draftprimitieven,
constraintvalidatie, i18n-keydekking, visuele RTL/high-contrastdetails en volledige testsuite niet
tot het einde controleren. De tweede review moet juist die open bewijsdraden en alle bovenstaande
reparaties opnieuw aanvallen; niets uit deze lijst geldt door alleen deze tekst als bewezen opgelost.

## 20. Verwerking tweede hyperkritische review

Ook de tweede Tier-2-review gaf **no-go**, met deze behouden bewijslast en verwerking:

- **[BEVESTIGD]** Externe lag kon de volledige interne notatie niet opslaan. §9.1 beperkt externe
  tokens nu expliciet en verliesloos tot vaste werkdagen/werktijduren; procent/elapsed wordt
  geweigerd in plaats van stil verloren.
- **[BEVESTIGD]** `after`-history en post-commit derived recompute spraken elkaar tegen. §8.7 en
  §13.1/13.4 halen `resourceLoadResult` uit `Snapshot` en materialiseren load plus viewRows vóór één
  atomaire publicatie; `cpmResult`/`scheduleStale` blijven exact historydragend.
- **[BEVESTIGD]** `mutationRevision` was geïntroduceerd zonder lifecycle. Hij is volledig verwijderd;
  §8.7 maakt prepare+commit één synchrone, niet-herintreedbare JavaScript-handeling.
- **[BEVESTIGD]** De Gantt-migratie vergat histogram/shared-axis. §4.3 definieert nu drie aparte
  x-contracten voor DOM-grid, origin-0 timelines en het full-width histogram met resourcepicker.
- **[BEVESTIGD]** Assignment-invalidatie was te vaag. §5.6 legt per mutatie vast welke timephased
  lagen en load wijzigen; nog ongeconsumeerde werkvensters zijn bewust read-only.
- **[VERMOED · zekerheid: hoog]** Relation fallback identity bleef ambigu bij meerdere types en
  externe bronnen. §9.2 definieert nu verplichte idmetadata, exacte interne/externe tuples en de
  enige toegestane één-op-één typewijziging; er wordt nooit “eerste match” gekozen.

Dezelfde reviewer bevestigde dat `rowKey`, legacy Layoutbinding, registryvolgorde en
ARIA/pinning/RTL aantoonbaar concreter waren geworden. Hij draaide geen tests of `tsc`, volgde niet
alle import/export/IFC-ripples van een mogelijke ExternalLink-uitbreiding en kon uiteraard nog geen
niet-bestaande grid runtime-testen. Omdat deze spec ExternalLink nu juist niet uitbreidt, moet de
derde review vooral bewijzen dat de begrenzing door parser, editor, refresh en bestaand datamodel
consistent blijft en dat de vijf andere reparaties geen nieuwe tegenspraak dragen.

## 21. Verwerking derde hyperkritische review

De derde gerichte Tier-2-herreview gaf opnieuw **no-go**, nu met één bevestigde blokkade en één
kleiner open risico:

- **[BEVESTIGD]** Externe relatietokens waren via `text/plain` niet verliesloos: de zichtbare naam/WBS
  bevatte niet de technische tuple die §9.2 voor identiteit vereist. §8.5.1 definieert nu de
  versieerbare `OPS-EXT/1`-suffix met volledige bron, anker, oorspronkelijke id/richting en
  type-/laguitgangstoestand. Ook Excel-round-trip, tekstvervanging zonder metadata en plakken naar
  een andere taak hebben nu exact gedrag; op labels raden is verboden.
- **[VERMOED · zekerheid: midden]** `resourceLoadResult` kon bij documentwissel kort uit een slapende
  cache komen voordat de huidige naloop hem herberekende. §13.1 maakt iedere documentactivatie nu
  één geïsoleerde materialisatie en één publicatie van brondata, kalendercache, `viewRows`, load en
  actief document-id.

De reviewer bevestigde de eerdere reparaties voor externe lag, history/derived-state,
synchrone gridtransacties, de drie Gantt-x-contracten, assignment-invalidatie en relationele
fallbackidentiteit. Hij kon geen toekomstige gridruntime uitvoeren, omdat er volgens de harde poort
nog geen implementatie bestaat. De vierde review valt daarom uitsluitend de twee bovenstaande
reparaties en hun aangrenzende contracten aan; pas een review zonder materiële blokkade sluit de
specfase.

## 22. Verwerking vierde hyperkritische review

Ook de vierde gerichte Tier-2-herreview gaf **no-go**, maar bevestigde dat de externe
klembordgrammatica en bronzijdesemantiek zonder nieuw persistent datamodel op de huidige solver
passen. Verwerkt zijn:

- **[BEVESTIGD]** `normalizedFilePath` was niet gedefinieerd en de huidige refresh vergelijkt ruwe
  paden. §8.5.1 specificeert nu één exacte, platformbewuste `normalizeExternalSourcePath` voor
  klembordkey én refresh/matching, inclusief ongeldige legacyfallback.
- **[BEVESTIGD]** De activatietekst kon gelezen worden als een oproep naar de bestaande live
  `refreshBehindItems`, die eigen storecalls en naloopherberekeningen doet. §13.1 eist nu eerst de
  pure `materializeBehindOnlyRefresh`; één producer publiceert brondata, afgeleiden, notices en
  scoped redo-invalidatie samen.
- **[VERMOED · zekerheid: hoog]** De huidige `ExternalLinkDialog` is alleen add-mode, schrijft alleen
  `lagDays` en gebruikt handmatig alleen een datumveld. §9.4 maakt add/edit, gedeelde externe
  lagparsing, datum/tijdankers en een atomaire bronzijdewissel expliciet.

Bij de verwerking is ook de normale externe weergave rechtgezet op wat `sourceRef` werkelijk
bewaart: projectnaam/id plus taaknaam/id, niet een na sluiten verdwenen externe WBS. Verder is de
Excel-TSV-quoting voor tabs, regels en aanhalingstekens vastgelegd. De vijfde review hoeft alleen
deze preciseringen en hun directe contractranden opnieuw aan te vallen.

## 23. Verwerking vijfde hyperkritische review

De vijfde finale herreview gaf een zeer smalle **no-go**:

- **[BEVESTIGD]** Windows/UNC-paden werden “case-insensitive vergeleken”, maar de tekst garandeerde
  niet dat alle componenten vóór de hash lowercase werden. §8.5.1 bepaalt nu de exacte output voor
  drive en UNC, definieert `//server/share` als UNC-root en geeft acht letterlijke testvectoren;
  equivalente Windows/UNC-paren moeten byte-identieke hashes opleveren.
- **[VERMOED · zekerheid: midden]** De nieuwe activatiematerializer benoemde alleen de
  refreshnotice, terwijl de bestaande open-boundary ook deviated/removed en het dialoogsignaal
  afhandelt. §13.1 heeft nu expliciete `silent-switch`- en `open-boundary`-modi plus een pure
  `materializeLibraryBoundary` die alle signalen vóór dezelfde publicatie bepaalt.

De reviewer bevestigde `OPS-EXT/1`, de atomaire documentactivatie en ExternalLinkDialog add/edit als
uitvoerbaar op het huidige model zonder nieuwe persistente velden. De zesde herreview controleert
alleen de gecorrigeerde pathbytes, boundarysignalen en eventuele tegenspraak rond `scheduleStale`;
bij afwezigheid van een materiële blokkade is dit de finale specpoort.

## 24. Zesde hyperkritische review: GO

De zesde finale herreview vond **geen materiële resterende spectegenstrijdigheid** en gaf expliciet
**GO voor eigenaarreview en implementatieplanning**:

- **[BEVESTIGD]** `normalizeExternalSourcePath`, de acht testvectoren, `sourceProjectKey` en de
  begrensde `id-only`-fallback vormen één coherent identiteitscontract.
- **[BEVESTIGD]** `silent-switch` en `open-boundary` dekken alle activatiepaden, classificeren en
  verversen vóór één publicatie en laten geen live storeactie in de preparefase toe.
- **[BEVESTIGD]** `cpmResult` blijft exact; `scheduleStale` verandert bij activatie alleen door een
  werkelijk ververste kalender via de bestaande `markScheduleStale`/`datesAsRecorded`-regel. Er is
  geen stille CPM.
- **[BEVESTIGD]** Stille bibliotheekmaterialisatie maakt geen dirty- of undo-event en invalideert
  alleen de toepasselijke undone documentscope wanneer werkelijk iets is ververst.
- **[VERMOED · zekerheid: hoog]** Het implementatieplan moet de bestaande legacyrefresh behouden:
  `refreshExternalAnchors` mag bij een niet-matchende project-id nog via het genormaliseerde
  bestandspad matchen. Alleen vervangen door `sourceProjectKey` zou die bestaande fallback breken.

De toekomstige helpers en gridruntime bestaan volgens de harde poort nog niet; runtime-, Excel- en
visueel bewijs horen daarom bij implementatie en zijn niet als reeds uitgevoerd gepresenteerd. Het
implementatieplan moet daarnaast expliciet plaatsen waar een bij open/import/recovery beschikbare
`cpmResult` vóór de ene activatiepublicatie in de payload wordt gezet.

## 25. Eerste implementatie-eindreview: NO-GO en verwerking

Na voltooiing van de implementatietaken is de volledige spec tegenover code, tests en bewijs gelegd.
Die eerste implementatie-eindreview gaf **NO-GO** met negen bevindingen. Geen ervan wordt door deze
tekst alleen als gesloten beschouwd; de volledige scope wordt na de eindpoort opnieuw beoordeeld.

- **[BEVESTIGD · blokkerend]** De Relaties-tab was verwijderd zonder echte desktopproef van
  **Alle externe relaties vernieuwen**. Verwerkt met een zichtbare Tauri-UI-proef. Die vond een
  werkelijke identiteitfout: IFCTASK kreeg bij iedere parse een nieuwe interne id. IFC schrijft nu
  `OPS_TaskIdentity.InternalTaskId`; oude bestanden vallen deterministisch terug op GlobalId.
  Herhaald lezen, lezen→schrijven→lezen en de zichtbare verversactie behouden nu de brontaak.
- **[BEVESTIGD · blokkerend]** Mijlpaalomschakeling verzon in enkele routes vijf dagen en was niet
  centraal. `taskMilestoneTransition` bepaalt nu alle vier routes. Gewone taak→mijlpaal is
  P6-nulduur; mijlpaal→gewone taak bewaart de aanwezige duur; een reeds aanwezige geïmporteerde
  mijlpaal met duur blijft bij een no-op bytegelijk.
- **[BEVESTIGD · hoog]** Het eerste vóór/na-performancebewijs mat tweemaal dezelfde implementatie.
  De claim is ingetrokken. Een nieuwe productprobe vergelijkt plancommit `446324ce` met de huidige
  grid via dezelfde 10.000-taken-IFC en dezelfde lintklik: mediaan 3.407,3 ms/230.303 elementen
  tegenover 88,0 ms/926 elementen, twee warmups en negen runs per versie.
- **[BEVESTIGD · hoog]** Dubbelklik op Gantt en Tabel had verschillende gevolgen. De
  oppervlakafhankelijke dialoogroute is verwijderd; beide grids selecteren dezelfde cel/taak en
  gebruiken het bestaande eigenschappenpaneel.
- **[BEVESTIGD · hoog]** Er stonden nieuwe hardgecodeerde labels en onvolledige vertalingen in
  registry, technische samenvattingen en externe-linkwaarschuwing. Alle gebruikerslabels lopen nu
  via i18n; alle veertien taaklocales dragen dezelfde sleutels.
- **[BEVESTIGD · midden]** Volledige afgekorte celinhoud was niet aangetoond. De adapter levert nu
  een volledige cel-`title`; gewone tekst en datum/datumtijd houden daarmee hun complete waarde
  bereikbaar zonder knop of apart paneel.
- **[BEVESTIGD · midden]** Splitterslepen gebruikte een dynamische bovengrens, maar toetsenbord en
  ARIA hielden 800 px. Eén helper berekent nu voor pointer, toetsenbord, klem en `aria-valuemax`
  dezelfde grens uit de gemeten werkruimtebreedte.
- **[BEVESTIGD · midden]** “Excel round-trip” was alleen intern gridkopiëren. De claim is vernauwd:
  interne Ctrl+C/Ctrl+V en Ctrl+Z blijven apart bewezen; LibreOffice Calc heeft daarnaast echte
  productie-TSV via XLSX heen en terug geschreven. Microsoft Excel zelf wordt niet geclaimd.
- **[BEVESTIGD · midden]** Datumdisplay gebruikte ISO terwijl editor en klembord persoonlijke
  notatie gebruikten. Display, edit en copy volgen nu dezelfde `dmy`/`mdy`/`ymd`-voorkeur; de
  canonieke waarde blijft als volledige titel beschikbaar.

Het uitvoerige dossier met ruwe benchmark-JSON, Tauri-screenshot, Calc-uitvoer en exitcodes staat
in `docs/superpowers/evidence/tabel-overhaul-review-fixes.md`. De tweede implementatie-eindreview
mag pas starten nadat de volledige verificatie opnieuw met exitcode 0 is afgerond. Een eventuele GO
wordt in een afzonderlijke volgende sectie vastgelegd; tot dat moment blijft deze status NO-GO.

## 26. Tweede implementatie-eindreview: NO-GO en verwerking

Dezelfde zware reviewklasse beoordeelde na de volledige groene eindpoort opnieuw de hele scope en
gaf **NO-GO** met zes bevindingen. De reparaties hieronder zijn daarna met rode regressietests
begonnen en opnieuw door de volledige planningssuite gehaald; de derde review moet ze nog
onafhankelijk sluiten.

- **[BEVESTIGD · blokkerend]** Delete/Backspace routeerde in de React-surface naar het verwijderen
  van alle geselecteerde taken, terwijl de pure klembordlaag al een atomaire lege celpaste kende.
  De UI gebruikt nu `planTaskGridClear`; een niet-leegbare cel blokkeert de hele clear zonder enige
  mutatie. Taakverwijdering blijft uitsluitend achter de bestaande expliciete verwijderactie.
- **[BEVESTIGD · blokkerend]** Een meercellige paste met `task.isMilestone` en duur hing af van de
  links-naar-rechtskolomvolgorde, omdat read-only tijdens dezelfde draft opnieuw werd beoordeeld.
  Writes van dezelfde taak worden nu semantisch rond de overgang geordend: duur vóór aanzetten,
  duur ná uitzetten en mijlpaalmetadata ná aanzetten. Beide kolomvolgordes hebben exact dezelfde
  eindtoestand en blijven één transactie.
- **[BEVESTIGD · hoog]** De desktopverversing had geen zelfstandig controleerbare voor/na-artefacten.
  Bron-IFC, doel vóór en doel na staan nu naast het dossier met vaste SHA-256-hashes en een
  planningscheck die ze via de productiereader opent. Die controle vond aanvullend dat ook het
  project-id per parse wisselde. OPS schrijft daarom nu `InternalProjectId` in
  `OPS_ProjectSettings`; oudere bestanden vallen deterministisch terug op `IFCPROJECT.GlobalId`.
- **[BEVESTIGD · midden]** De datumeditor voldeed niet aan §8.1: hij bood alleen tekstinvoer. Datum
  en datumtijd combineren nu persoonlijke tekstinvoer met een native kalender-/datumtijdkiezer;
  de kiezer vertaalt terug naar dezelfde persoonlijke notatie en de writer houdt ISO.
- **[BEVESTIGD · midden]** Booleanweergave was vertaald, maar kopiëren schreef hard `Ja`/`Nee` en
  plakken kende alleen Nederlands/Engels. Adapter en klembord krijgen nu dezelfde lokale waar/onwaar-
  labels; gelokaliseerde waarden roundtrippen, terwijl `true`/`false` canonieke terugval blijven.
- **[BEVESTIGD · midden]** Datumtitels gebruikten de op minuten afgekorte displaytekst en verloren
  seconden, milliseconden en tijdzone. De zichtbare cel, editor en copy blijven persoonlijke
  minuutprecisie gebruiken; de bestaande gewone celtitel draagt de volledige canonieke waarde.

Na deze verwerking eindigden typecheck, lint en `git diff --check` met exitcode 0. De volledige
`bash tests/planning/run.sh` eindigde eveneens met exitcode 0: 560/560 rekengevallen, 168/168
IFC-rondreiscontroles, 5/5 vastgelegde Tauri-bewijscontroles en alle vijf tijdzones groen. Dit is
verificatiebewijs, nog geen onafhankelijke review-GO.

## 27. Derde implementatie-eindreview: NO-GO en verwerking

De derde review is opnieuw door dezelfde zware reviewklasse over de **volledige** implementatie
uitgevoerd. Hij gaf **NO-GO**: twee eerdere blokkades bleken via aangrenzende routes nog open en
één editorlaag gebruikte sleutels die in geen enkele locale bestonden. De review bevestigde de
overige vier reparaties uit §26 en sloot ook IFC-identiteit, Tauri-artefacten, productbenchmark,
dubbelklikpariteit, celhover, splittergrens, spreadsheetbewijs en persoonlijke datumnotatie.

- **[BEVESTIGD · blokkerend]** De grid maakte bij Delete/Backspace wel een cel-clear, maar het
  gebubbelde native event bereikte daarna ook de globale sneltoetslistener en kon alsnog de
  geselecteerde taken verwijderen. `DataGridCore` stopt nu de eventpropagatie na een afgehandelde
  gridopdracht en de globale listener keert defensief terug voor ieder `defaultPrevented` event.
  Een gedragstest voert hetzelfde cancelable event eerst onbehandeld en daarna afgehandeld door de
  globale beslisgrens voor zowel Delete als Backspace.
- **[BEVESTIGD · blokkerend]** De semantische sortering dekte vlag plus duur, maar niet
  `milestoneKind` en `mandatory` bij uitzetten. Die metadata werd halverwege read-only. Voor een
  overgang naar gewone taak wordt metadata nu verwerkt terwijl de begintoestand nog een mijlpaal
  is, daarna ruimt de ene domeinovergang haar op en ten slotte landt de gewone duur. De regressiematrix
  doorloopt lege, afwijkende en gevulde metadata in alle 24 kolomvolgordes: 72 samengestelde pastes
  hebben exact dezelfde geldige eindtoestand.
- **[BEVESTIGD · hoog]** De editor vroeg niet-bestaande `assignment.*`, `resourceCurve.*` en
  `boolean.*`-sleutels op. Assignmentbediening hergebruikt nu de bestaande
  `properties.assignments.*`-teksten, de zes curves gebruiken de bestaande
  `resource.curve.*`-teksten uit `common` en booleankeuzes gebruiken exact dezelfde lokale labels
  als adapter en klembord. De i18n-regressie leest de echte veertien taak- én common-resources en
  faalt ook wanneer die oude dynamische sleutels terugkomen.

Na verwerking eindigden de gerichte toetsenbord-, transactie-, editor-, surface- en i18n-checks
respectievelijk 4/4, 137/137, 20/20, 15/15 en 4473/4473 groen. Typecheck, lint en
`git diff --check` eindigden met exitcode 0. De volledige planningssuite eindigde met exitcode 0:
560/560, IFC 168/168, Tauri-artefacten 5/5 en vijf tijdzones groen. Daarna eindigde ook de volledige
`npm run verify` met exitcode 0, inclusief bibliotheek, MCP, ontwikkelserver, voorbeelden,
30 artikelen × 14 talen, localevergelijking, 449 importmodules en audit met nul kwetsbaarheden.
Dit blijft verificatiebewijs; de vierde onafhankelijke herreview moet nog GO geven.

## 28. Vierde implementatie-eindreview: NO-GO en verwerking

De vierde review is opnieuw door de zware reviewklasse over de **volledige** implementatie,
specificatie en bewijsset uitgevoerd. Hij gaf **NO-GO** met één blokkerende productfout en drie
bewijs-/afwerkingspunten. De review bevestigde dat de eerdere Delete/Backspace-productroute,
mijlpaal→gewone-taaktransactie en editorvertalingen waren gerepareerd.

- **[BEVESTIGD · blokkerend]** `planTaskGridPaste` beoordeelde dynamische schrijfbaarheid nog tegen
  de begintaak. Daardoor faalde een geldige gezamenlijke eindtoestand al vóór de transactielaag,
  onder meer gewone taak→mijlpaal met metadata, `MSO` plus hard constraint en mijlpaal uit plus
  hangmat uit. De klembordplanner doet nu alleen de statische kolomgrens en bouwt ongecontroleerde
  schrijfintenties; de ene geïsoleerde transactiedraft ordent en valideert de gezamenlijke
  eindtoestand. De productiepadmatrix loopt via `planTaskGridPaste` én `runGridMutation`, bevat alle
  zes constraint- en assignmentkolomvolgordes, beide mijlpaalvolgordes, atomaire conflictsituaties
  en aanvullend beide hangmat-/duur- en hangmat-/resourcevolgordes.
- **[BEVESTIGD · midden]** De externe-lagdialoog bevatte nog de hardgecodeerde placeholder
  `0d of 2u`. `externalLinks.lagPlaceholder` bestaat nu in alle veertien taaklocales en de bronpoort
  verbiedt de oude literal.
- **[BEVESTIGD · midden]** Het toetsenbordbewijs testte alleen een beslishelper. De check gebruikt
  nu de echte `DataGridCore`-dispatch op hetzelfde cancelable event als de globale beslisgrens.
  Aanvullend is de werkelijke app op de gecontroleerde worktreepoort bediend: Delete en Backspace
  maakten een gevulde beschrijvingscel leeg, terwijl de taakrij en teller op één taak bleven staan.
- **[BEVESTIGD · midden]** Een opgeslagen datumzonder tijd kon in uurmodus als ongeldige waarde in
  een native `datetime-local` terechtkomen. De dialoog normaliseert de invoergrens naar
  `T00:00`, maar bewaart een ongewijzigd bestaand canoniek anker. De pure regressie dekt datum,
  datumtijd, leeg en dagmodus; in de echte app is een relatie met `2026-08-26` gemaakt in dagmodus,
  de projectkalender naar twee ploegen omgezet en dezelfde relatie daarna geopend als
  `datetime-local` met waarde `2026-08-26T00:00`.

De reviewreparatie bracht ook één aangrenzende hangmatroute aan het licht: `hangmat uit + duur`
kon nog van de zichtbare kolomvolgorde afhangen. Die overgang gebruikt nu dezelfde
eindtoestandsordening. De gerichte klembordcheck eindigt met 97/97 groen. De daaropvolgende
volledige planningssuite eindigde met exitcode 0: 560/560 rekengevallen, 168/168
IFC-rondreiscontroles, 5/5 vastgelegde Tauri-bewijscontroles en alle vijf tijdzones groen. De
daaropvolgende volledige `npm run verify` eindigde eveneens met exitcode 0: typecheck, lint, alle
testreeksen, bibliotheek, MCP, ontwikkelserver, voorbeelden, 30 artikelen × 14 talen,
localevergelijking, 449 importmodules en audit waren groen; de audit vond nul kwetsbaarheden. Dit is
nog geen onafhankelijke review-GO; de vijfde review beoordeelt opnieuw de hele scope.

## 29. Vijfde implementatie-eindreview: NO-GO en verwerking

De vijfde review is opnieuw door de zware reviewklasse over de **volledige** implementatie,
specificatie, transactielaag en bewijsset uitgevoerd. Hij gaf **NO-GO** met twee blokkerende
transactiefouten, twee hoge externe-linkfouten en één middelzware uur-/dagweergavefout. De reviewer
bevestigde de eerdere Delete/Backspace-, mijlpaal-, hangmat-, vertaal- en relationele
klembordreparaties, maar vond aangrenzende routes die nog niet door dezelfde eindtoestandsregels
werden beschermd.

- **[BEVESTIGD · blokkerend]** `assignment.unitsPerDay` en `assignment.curve` konden via de
  ongecontroleerde meercellige writer zelfstandig een nieuwe toewijzing maken. Ieder
  assignment-intent draagt nu verplicht zijn bronkolom. Alleen `assignment.resources` mag
  lidmaatschap wijzigen; units en curve mogen uitsluitend bestaande toewijzingen van dezelfde
  resources aanpassen en bewaren daarbij id en de niet-bewerkte assignmentvelden.
- **[BEVESTIGD · blokkerend]** Meerdere celwrites van één taak werden nog achtereenvolgens tegen
  tijdelijke tussenstanden gevalideerd. Daardoor kon een geldig nieuw constraintpaar falen en
  konden actualdatums of status/completion door kolomvolgorde verschillen. `planTaskCellEdits`
  vormt nu per taak één gewenste toestand: beide constraints worden pas samen gevalideerd en alle
  voortgangsvelden worden éénmaal als groep gecanonicaliseerd. Geldige paren slagen in beide
  volgordes; tegenstrijdige status, completion, werkelijk duur en resterende duur falen atomair met
  `conflictingProgressInputs`.
- **[BEVESTIGD · hoog]** Een ongewijzigde bewerking van een gezonde bestandslink zette
  `sourceMissing=true`; de brede spread van `sourceRef` kon bovendien oude bestandsidentiteit bij
  een nieuwe handmatige bron bewaren. De submitbuilder onderscheidt nu expliciet een echte no-op,
  het wissen van een optionele naam en een identiteitswijziging. De no-op bewaart projectnaam,
  bestandspad, bronstatus en canoniek anker; een nieuwe identiteit krijgt geen oude
  projectnaam/bestandspad mee.
- **[BEVESTIGD · hoog]** De externe-linkdialoog had geen werkende Escape- of Enter-route. Hij gebruikt
  nu dezelfde `Dialog`-grens als de rest van de app met `onCancel` en `onConfirm`. De broncheck
  bewaakt de productiebedrading; in de echte app sloot Escape zonder taakverlies en voegde Enter
  vanuit een geldig veld de relatie toe.
- **[BEVESTIGD · midden]** Een bestaande datumtijd bleef bij uur→dag als `datetime-local` zichtbaar.
  De inputsoort volgt nu uitsluitend de huidige kalender van de eigentaak. In dagmodus projecteert
  de dialoog alleen het datumdeel; ongewijzigd opslaan bewaart de verborgen canonieke tijd. In de
  echte app werd `2026-08-26T13:45` in dagmodus `2026-08-26` en na ongewijzigd opslaan en terugkeer
  naar uurmodus opnieuw exact `2026-08-26T13:45`.

De gerichte controles eindigden met assignment 44/44, klembord 101/101, gridtransactie 149/149,
registry 526/526, editor 20/20, externe-linkdialoog 12/12 en externe-linkbewerking 12/12 groen. De
volledige planningssuite eindigde met exitcode 0: 560/560 rekengevallen, 168/168 IFC-rondreis,
5/5 Tauri-artefactcontroles en alle vijf tijdzones groen. Daarna eindigde `npm run verify` met
exitcode 0: typecheck, lint, alle testreeksen, bibliotheek, MCP, ontwikkelserver, voorbeelden,
30 artikelen × 14 talen, localevergelijking, 449 importmodules zonder cyclus en audit met nul
kwetsbaarheden. Dit blijft verificatiebewijs; de zesde onafhankelijke herreview moet nog GO geven.

## 30. Zesde implementatie-eindreview: NO-GO en verwerking

De zesde volledige review gaf opnieuw **NO-GO**. Vijf blokkades betroffen eventeigenaarschap,
gezamenlijke taaktoestanden en documentidentiteit; drie hoge punten betroffen externe ankers,
zichtbare enumtekst en kolomspecifieke assignments; twee middelzware punten betroffen
toegankelijkheid en een achterhaalde verwijzing naar het verwijderde Relaties-paneel. De reviewer
bevestigde tegelijk de gebruikersopslag, lintknoppen, hover/trace, IFC-identiteit, gewone
activatieroutes en het ongemoeid laten van de geavanceerde resourceweergave.

- Ctrl/Cmd+C en V worden binnen een actieve tabel-editor door het native invoerveld afgehandeld;
  alleen een gewone geselecteerde gridcel gebruikt TSV. De globale sneltoetslaag en de gridroot
  hanteren dezelfde grens.
- Alle celwrites van één taak worden tegen één gewenste eindtoestand gepland. Dit sluit de gevonden
  combinaties voortgang+nevenveld, hangmat uit+mijlpaal aan+duur en kalender+duur onder de nieuwe
  kalender, onafhankelijk van kolomvolgorde.
- Een externe verversing legt het doeldocument vóór de asynchrone bronread vast en past na een
  documentwissel niets toe. Een handmatige identiteitswijziging kan zonder nieuw aangeraakt anker
  evenmin het oude bronanker erven.
- Assignmentresources, units en curve openen elk uitsluitend hun eigen bediening. Validatiefouten
  staan op het werkelijk focusbare invoerveld. Dezelfde browserproef vond en repareerde bovendien
  een React-crash bij units/curve: native eventwaarden worden nu vóór de state-updater vastgelegd.
- Status, taaktype en assignmentcurve gebruiken zichtbare locale labels; canonieke enumwaarden
  blijven alleen in de interne edit-/klembordgrens. Alle veertien locales bevatten de drie
  taakstatuslabels. De importwaarschuwing verwijst in iedere taal naar voorganger- en
  opvolgerkolommen, niet naar het verwijderde paneel.
- Horizontale scroll blijft direct in de gebruikersstate staan, maar een scrollburst wordt tot één
  uitgestelde `localStorage`-write samengevoegd. Een tussentijdse gewone voorkeurwijziging annuleert
  de timer, zodat een oud scrollsnapshot geen nieuwere kolommen kan overschrijven.

De gerichte regressies eindigden met gridtransactie 152/152, externe-linkdialoog 13/13,
toetsenbordroutering 14/14, adapter 58/58, externe verversing 206/206, editor 23/23,
gebruikersvoorkeuren 72/72 en i18n 4607/4607 groen. Typecheck, lint en `git diff --check` eindigden
met exitcode 0. De browser bewees een onopgeslagen editorwaarde `Draft` via native Ctrl+C/V,
afzonderlijke assignmentbedieningen, een gekoppelde `aria-invalid`-fout zonder crash, een werkende
curvewijziging en een vertaald statuslabel. Dit is nog geen onafhankelijke GO; de volledige eindpoort
en zevende brede herreview volgen.

De eerste volledige eindpoort vond daarna nog één samengestelde grens die niet in de gerichte set
zat: een volledige mijlpaalrij met duur, hammock en een lege resourcecel gaf vier afwijkingen in de
101 klembordchecks. De gezamenlijke celgroep werd bij de eerste cel uitgevoerd en passeerde daardoor
de lege assignmentwrite die bestaande toewijzingen vóór de mijlpaalovergang hoort te wissen. Lege
assignmentwrites staan nu vóór iedere cel uit zo'n mijlpaalgroep; niet-lege assignments blijven een
tegenstrijdige en dus geweigerde eindtoestand. Klembord 101/101, gridtransactie 152/152 en assignments
44/44 eindigden daarna afzonderlijk groen.

De volledige herstart van `npm run verify` eindigde met exitcode 0. Daarbij waren onder meer de
solvermatrix 560/560, IFC 168/168, Tauri-bewijs 5/5, alle vijf tijdzones, 35 MCP-reeksen,
ontwikkelserverintegratie, voorbeelden, 30 artikelen × 14 talen, alle 13 locales, 449 importmodules
en de audit met nul kwetsbaarheden groen. De tijdelijke gebruikerskolom **Assignment curve** is via
het echte Tabel-contextmenu verwijderd; na paginaherlading stonden exact de negen standaardkolommen
zonder curve. De bewijsserver is daarna gestopt en poort 3018 weigerde verbinding. De zevende brede
herreview blijft nodig voordat deze implementatie als GO geldt.
