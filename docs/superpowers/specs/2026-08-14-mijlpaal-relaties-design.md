# Mijlpaal-relaties vrijgeven en spookrelaties dichten

**Datum:** 2026-08-14
**Status:** ontwerp, goedgekeurd — klaar voor implementatieplan

> **Banner (2026-08-15, eigenaarsbesluit):** het §spookrelaties-deel van dit ontwerp — relaties met
> een verzameltaak-eindpunt ALTIJD weigeren (§1, §3, §4, §5, §5a hieronder) — is ingehaald. Een
> parallelle tak bouwde in dezelfde periode `expandSummaryRelations`
> (`src/engine/scheduler/expandSummaryRelations.ts`), die zulke relaties naar de onderliggende
> bladtaken doorrekent conform MS Project-semantiek. De eigenaar koos voor die semantiek: een
> verzameltaak-eindpunt is sinds 2026-08-15 GEEN weigergrond meer — alleen een relatie tussen een
> taak en zijn EIGEN (voor)ouder-samenvatting blijft geweigerd (`RelationRejection.ancestor` in
> `src/state/relationRules.ts`, `isAncestorRelation`), want die zou de expansie een directe cyclus
> laten genereren. Het mijlpaal-deel van dit ontwerp (§1, §4 voor zover het de hittest betreft) blijft
> ONGEWIJZIGD van kracht. Dit document is NIET herschreven — lees §spookrelaties-passages hieronder
> dus als geschiedenis, niet als huidig gedrag. Zie `docs/superpowers/specs/` voor het vervolg, en
> `public/docs/nl/gids-relaties-constraints.md` voor de gebruikersgerichte, actuele beschrijving.

## Aanleiding

Twee klachten die op één plek in de code samenkomen:

1. Je kunt in de Gantt **geen relatie slepen vanaf een mijlpaal**. Dat is een bug: een mijlpaal is
   een 0-duur bladtaak die de solver volledig ondersteunt als voorganger én opvolger, met eigen
   START/FINISH-relatiewiskunde en een uitgebreide testdekking (`cases-milestones.json`,
   `cases-milestone-kinds.json`). De blokkade is een neveneffect van hergebruikte hit-test-code.

2. Relaties met een **verzameltaak** als eindpunt zijn *spookrelaties*: ze worden opgeslagen,
   getekend en geëxporteerd, maar hebben nul effect op de planning. Ze worden nu stil aangemaakt
   zonder enige waarschuwing.

### Waarom de bugs bestaan

`GanttRenderer.getTaskBarBounds()` (`src/engine/renderer/GanttRenderer.ts`) weigert taken met
`childIds.length > 0 || isMilestone`. Die functie is geschreven als hittest voor **slepen/resizen**
— een ruit heeft geen duur om te resizen, een samenvattingsbalk heeft afgeleide datums. Terecht.
Maar sinds issue #40 armt diezelfde functie óók de relatie-sleep, en daar slaat de mijlpaal-clausule
nergens op.

De spookrelaties komen uit de solver-architectuur: `runCPM` geeft alleen bladtaken aan de solver
(`solveProject.ts`, `input.tasks.filter(t => t.childIds.length === 0)` — die filter zat bij het
schrijven van deze spec nog in `scheduleSlice.ts` en is daarna met de solve-kern meegeëxtraheerd),
en `CPMSolver` leest relaties
met optional chaining in (`this.successors.get(seq.predecessorId)?.push(seq)`). Een verzameltaak
staat niet in die map, dus de relatie verdwijnt geruisloos. `applyCpmResult` overschrijft de datums
van een verzameltaak daarna sowieso met de rollup uit de kinderen.

`addSequence` valideert niets op taaktype, dus de Relaties-paneelknop, de lint-knop, de extensie-API
en de MCP-tools maken zulke relaties allemaal probleemloos aan.

## Scope

**Wel:**
- Relatie-sleep vanaf een mijlpaal vrijgeven.
- Nieuwe relaties met een verzameltaak-eindpunt overal weigeren, met leesbare reden.
- Bestaande en geïmporteerde exemplaren behouden en zichtbaar markeren als "zonder effect".

**Niet:**
- Mijlpalen horizontaal verslepen om hun datum te wijzigen. Ligt geblokkeerd door dezelfde
  `getTaskBarBounds`-null, maar raakt `barDrag` (0-duurtaak: alleen een body-sleep mag armen, nooit
  een resize-greep, plus snapping/undo/uur-modus). Blijft open als TODO.
- Verzameltaak-relaties *laten werken* via FS-desugaring. Zie "Toekomstpad".

## Ontwerp

### 1. `src/state/relationRules.ts` — één regel, meerdere lezers

Nieuwe **bladmodule**: pure functies, importeert niets uit `slices/` of `appStore`. Dat is geen
stijlkeuze maar noodzaak — anders ontstaat `sequenceSlice → relationRules → appStore →
sequenceSlice` en slaat `verify:cycles` aan. Zelfde reden als bij `state/defaults.ts`.

```ts
export type RelationRejection = 'self' | 'unknown-task' | 'summary-endpoint' | 'duplicate';
export type RelationVerdict = { ok: true } | { ok: false; reason: RelationRejection };

interface RelationEndpoints { predecessorId: string; successorId: string }

/**
 * Heeft deze relatie een eindpunt zonder effect op de planning? De solver ziet alleen bladtaken,
 * dus een verzameltaak als voorganger of opvolger wordt weggegooid.
 *
 * Mijlpalen zijn bladtaken en dus expliciet WÉL toegestaan — dat is het hele punt van dit ontwerp.
 */
export function hasSummaryEndpoint(
  byId: ReadonlyMap<string, Task>,
  seq: RelationEndpoints,
): boolean;

export function relationVerdict(
  byId: ReadonlyMap<string, Task>,
  sequences: readonly Sequence[],
  seq: RelationEndpoints & { type: SequenceType },
): RelationVerdict;
```

`hasSummaryEndpoint` staat er los naast omdat de paneelmarkering hem per rij nodig heeft zónder de
`sequences`-array: elke *bestaande* relatie is zijn eigen duplicaat, dus `relationVerdict` is daar
onbruikbaar.

Naast `summary-endpoint` weigert de module ook `self` (voorganger == opvolger; de solver maakt daar
nu een verwarrende cyclusfout van) en `unknown-task` (verwijzing naar een niet-bestaand id; zelfde
stille-drop-mechaniek als een verzameltaak). Beide zijn één conditie en delen de hele omliggende
plumbing; ze zijn alleen bereikbaar via MCP en de extensie-API, die geen UI-guard hebben.

### 2. De dedup-regel verhuist mee

`mcpTransaction.addSequence` (`src/state/mcpTransaction.ts`) is een handgeschreven kopie van
`sequenceSlice.addSequence`, inclusief een tweede exemplaar van de dedup-regel "één per
(voorganger, opvolger, type)". Dat is precies het duplicatiepatroon dat elders in deze codebase
systematisch is opgeruimd (het documentcontract, `applyCpmResult`) — en het bijt hier meteen: zonder
deze verhuizing zou validatie in de slice-actie MCP overslaan, en is MCP het gat waardoor precies de
bug binnenkomt die we dichten.

Na de verhuizing verschillen de twee implementaties alleen nog in **transactiemechaniek**
(snapshot + `finishMutation` vs. snapshot-vrij, want MCP-batches beheren hun eigen transactie), niet
meer in regels.

### 3. Vier lezers

| lezer | gedrag |
|---|---|
| `sequenceSlice.addSequence` | handhaving; retourneert `string \| null` in plaats van altijd een id |
| `mcpTransaction.addSequence` | handhaving; geeft de `RelationRejection` door zodat de tool een herstelbare fout kan melden |
| `classifyDeps` (`planner_add_dependencies`) | zachte per-item weigering, op de bestaande mechaniek |
| `classifyDepUpdates` (`planner_update_dependencies`) | idem — zie hieronder, dit was een gat |
| `createRelationWithFeedback` | vraagt het verdict vóór de mutatie, om de juiste melding te kiezen |
| `RelationsPanel` (markering) + `getRelationSourceAt` (hittest) | lezen `hasSummaryEndpoint` |

**Het verhang-pad was een gat in dit ontwerp.** Deze spec keek alleen naar het *aanmaken* van een
relatie. Maar `planner_update_dependencies` kan de voorganger of opvolger van een **bestaande**
relatie wijzigen, en `dependencyTools.ts` schrijft die eindpunten **rechtstreeks** op de draft
(`seq.predecessorId = …`) — langs `addSequence` én `updateSequence` heen. Daar zit dus, anders dan
bij het aanmaken, géén tweede laag onder: `classifyDepUpdates` is de enige plek waar het
tegengehouden kan worden. Gevonden tijdens de uitvoering van taak 4.

Ter afbakening: de store-actie `updateSequence` heeft dit probleem *niet* — die accepteert per
signatuur geen eindpuntwijziging (`Partial<Omit<Sequence, 'id' | 'predecessorId' | 'successorId'>>`)
en houdt zijn eigen botsingsregel voor type-wijzigingen.

**Waarom zowel de wrapper als de slice het verdict opvraagt.** De wrapper heeft de *reden* nodig om
de juiste melding te kiezen; de slice is de handhavingsgrens voor álle aanroepers (inclusief de
extensie-API, die direct op de slice zit). Het alternatief — de reden door de retourwaarde van
`addSequence` heen vlechten — maakt het typeoppervlak van de extensie-API onnodig ingewikkeld voor
een pure functie die twee keer aanroepen gratis is. De *regel* staat op één plek; alleen de aanroep
staat er twee keer.

**Opruiming die hieruit valt:** `createRelationWithFeedback` verliest zijn
`sequences.length`-vóór/ná-truc. Die bestond alleen omdat `addSequence` bij een geweigerd duplicaat
tóch een id teruggaf die naar niets verwees. Met `string | null` is dat weg.

**Extensie-API:** `addSequence` gaat van `string` naar `string | null` (`src/extensions/types.ts`,
`docs/extensions.md` bijwerken). Voor auteurs is dat strikt correcter — de oude `string` bij een
geweigerd duplicaat was al een id die nergens naar verwees. Extensies zijn CommonJS-JS, dus geen
compile-breuk.

### 4. Mijlpalen vrijgeven: een aparte hittest

Nieuwe methode náást `getTaskBarBounds`, bewust géén versoepeling daarvan — anders wordt een
mijlpaal-ruit versleepbaar en een samenvattingsbalk resizebaar, allebei fout.

```ts
/** Hittest voor het armen van een relatie-sleep. Ruimer dan getTaskBarBounds: mijlpalen tellen
 *  wél mee (0 duur is geen bezwaar voor CPM-logica, alleen voor resizen), verzameltaken bewust
 *  niet — een relatie daarheen zou een spookrelatie zijn. */
getRelationSourceAt(canvasX: number, canvasY: number): Task | null
```

Hergebruikt `barGeometry`. Voor een ruit is `x1 ≈ x2`, dus het greepgebied krijgt dezelfde ±6 px die
het pijltekenen al hanteert (`GanttRenderer.ts`, `pad = row.task.isMilestone ? 6 : ARROW_PAD`). De
datumloos-guard uit `getTaskBarBounds` blijft gelden: een taak zonder datums heeft geen positie om
vanaf te slepen.

In `GanttCanvas.handleMouseDown` wordt de shift/relatiemodus-tak vóór de `getTaskBarBounds`-tak
getrokken en leest die de nieuwe hittest. Sleep- en resizegedrag voor gewone taken blijft daarmee
ongewijzigd.

**Correctie (eindreview, punt A):** de oorspronkelijke aanname dat `handleContextMenu` ongemoeid kon
blijven, was onjuist. `barHit` in `GanttCanvas.tsx` poort in `ContextMenu.tsx` precies één
menu-item — `context.startRelationHere` ("Relatie leggen vanaf hier") — en niets over slepen of
resizen. Dat is dus een relatie-actie, geen balk-specifieke actie, en hoort dezelfde hittest te
gebruiken als de sleep-start: `getRelationSourceAt` in plaats van `getTaskBarBounds`. Vóór de
correctie toonde rechtsklikken op een mijlpaal het item niet, terwijl slepen vanaf diezelfde
mijlpaal via `getRelationSourceAt` al wél werkte — dezelfde bug, één laag verderop. Gefixt door de
`barHit`-berekening in `handleContextMenu` om te zetten naar `getRelationSourceAt`.

De **drop-kant** in `useDependencyDraw` blijft de ruime `getTaskAtY` gebruiken. Je mág dus op een
verzamelbalk loslaten en krijgt dan de weigering mét reden — beter dan een pijl die geruisloos
nergens landt.

### 5. Bestaande spookrelaties: geen filter- of migratiecode

Omdat de markering **afgeleid** is uit `childIds` en niet opgeslagen, hoeven IFC-laden en de
importers niets te filteren en is er geen migratie nodig. Ze installeren de `sequences`-array in
bulk; de markering rekent live mee. De enige toevoeging in een laadpad is de samenvattende melding
hieronder.

De regels uit §1 bewaken uitsluitend het **aanmaken**. De markering dekt alleen
`summary-endpoint` — een bestaand bestand met een `self`- of `unknown-task`-relatie wordt niet
gemarkeerd of opgeruimd, want die gevallen zijn buiten MCP/extensies vrijwel niet te maken en de
solver handelt ze al af (cyclusfout, respectievelijk stille drop).

**`addSequence` is niet de enige schrijver naar `s.sequences`**, en dat is met opzet. Behalve de
bulk-laadpaden schrijven ook `pasteTasks` (`taskSlice.ts:975`) en `insertWbsTemplate`
(`taskSlice.ts:1057`) er rechtstreeks in. Allebei **reproduceren** ze bestaande relaties met nieuwe
id's; ze maken niets nieuws. Onder de keuze van §5 (bestaande relaties behouden) hoort dat ook zo:
een tak plakken die een spookrelatie bevat mag die relatie meenemen — hij komt in het doelproject
gemarkeerd terug, precies zoals in het bronproject. Wie later een schrijver toevoegt die wél nieuwe
relatielogica aanmaakt, hoort door `relationVerdict` te gaan.

Dat dekt gratis het randgeval waarin een bladtaak met bestaande relaties later een kind krijgt: hij
wordt daarmee retroactief een verzameltaak en zijn relaties worden vanzelf gemarkeerd. Een
opgeslagen vlag zou daar stil verouderen.

Zichtbaar op twee plekken:

- **Relaties-paneel:** markering + tooltip per regel.
- **Na het laden van een document:** één samenvattende melding ("N relaties op verzameltaken hebben
  geen effect op de planning") via het bestaande `notify`-kanaal met `dedupeKey`. Dit gaat in
  `applyLoadedProject` in `fileSlice.ts`, de gedeelde implementatie waar `loadState` en de drie
  open-paden allemaal doorheen lopen — naast de bestaande uur-data-melding, die exact dezelfde vorm
  heeft. Bewaakt door `tests/planning/check-notifications.ts` (eindreview, punt C).
  **Bekende beperking (eindreview, punt E2):** crash-herstel (`restoreDocuments`) loopt NIET door
  `applyLoadedProject` — `fileSlice.ts:79` vermeldt dat zelf — dus na een herstelde sessie verschijnt
  deze samenvattende melding niet, ook al kan het herstelde document dezelfde spookrelaties bevatten.

Waarom behouden en niet wegfilteren bij het laden: wegfilteren vernietigt logica uit het
bronbestand (open + opslaan van een P6-plan verliest die relaties permanent), en het gooit precies
de data weg die het toekomstpad hieronder nodig heeft.

### 5a. Bekende beperking: de indirecte route maakt spookrelaties zonder enig signaal

Dit ontwerp blokkeert alleen het **directe** pad — een relatie rechtstreeks naar een verzameltaak
leggen — met een leesbare weigering (§1, §Foutafhandeling). Het **indirecte** pad is volledig stil:
`indentTasks`, `moveTaskTo`, `addTask({ parentId })` en `insertWbsTemplate` kunnen een bladtaak MET
bestaande relaties tot verzameltaak maken door haar een kind te geven. Vanaf dat moment zijn haar
relaties spookrelaties — §5 hierboven dekt dat gratis qua *markering* ("dekt gratis het randgeval"),
maar niet qua *signalering op het moment zelf*.

Concreet: een project met relatie A→B. De gebruiker sleept C onder B (inspringen). Vanaf dat moment
doet A→B niets meer. De Gantt tekent de pijl **identiek** aan een werkende relatie; er verschijnt
geen melding; een druk op F5 verschuift de planning zonder uitleg. De enige aanwijzing is het
waarschuwingsdriehoekje in het Relaties-paneel (§5) — visueel niet te onderscheiden van de bestaande
lead-waarschuwingen daar, en in een paneel dat niet standaard open staat.

**MCP meldt hier ook niets.** `planner_add_tasks` met een `parentId` maakt de spookrelaties zonder
een woord — er is geen zachte weigering, geen waarschuwing in het resultaat. De leestools
(`planner_get_dependencies` e.d.) melden per relatie nergens "zonder effect"; alleen het
Relaties-paneel toont de afgeleide markering, en dat paneel heeft geen MCP-equivalent. Een agent die
via MCP een taak onder een andere hangt, ziet dus geen signaal dat hij zojuist bestaande relaties
buiten werking heeft gezet.

Mogelijke uitwegen (niet gebouwd, buiten scope van deze tak — genoemd door de eindreview):

- Dezelfde samenvattende melding (§5) afvuren wanneer een structuurmutatie (`indentTasks`,
  `moveTaskTo`, `addTask({ parentId })`, `insertWbsTemplate`) relaties zonder effect maakt — het
  laadpad-patroon hergebruiken op het bewerkpad.
- De spookpijl in de Gantt gestippeld of gedimd tekenen zodra `hasSummaryEndpoint` waar is, zodat het
  zichtbaar is zonder het Relaties-paneel te openen.

## Foutafhandeling

| situatie | gedrag |
|---|---|
| UI-gebaar (sleep, lint-knop, paneelknop) op verzameltaak | geen mutatie; melding met reden en de suggestie om aan een bladtaak te koppelen |
| Relatie-sleep vanaf een verzamelbalk | armt niet (de hittest geeft null) — weigert vroeg in plaats van na de sleep |
| MCP-tool | fout met reden, zodat een agent kan herstellen |
| Extensie-API | `null` retour |
| Bestaand/geïmporteerd exemplaar | blijft staan, gemarkeerd |

## Tests

- **`tests/planning/check-relation-rules.ts`** (nieuw): verdict-matrix over de pure module, met
  **mijlpaal-eindpunt = toegestaan** als expliciet regressie-anker, plus het retroactieve geval
  (bladtaak met relaties krijgt een kind → gemarkeerd).
- **`tests/planning/check-renderer-dateless.ts`** (uitbreiden, geen nieuw bestand): heeft de harnas
  al — DOM-stubs, opnemende 2D-context, en rijen met een gezonde taak, een mijlpaal én een
  samenvattingsbalk — en toetst al `getTaskBarBounds`. Toevoegen: `getRelationSourceAt` accepteert
  de mijlpaal, weigert de verzameltaak, weigert de datumloze taak.
- **`tests/mcp/cases-update-dependencies.ts`** (uitbreiden): weigering met leesbare reden op een
  verzameltaak; acceptatie op een mijlpaal.

## Documentatie

- `public/docs/{nl,en}/gids-relaties-constraints.md` uitbreiden. Bestaat al — geen nieuwe
  manifest-entry nodig.
- `docs/extensions.md`: de `string | null`-retour van `addSequence`.
- **Let op:** nieuwe i18n-sleutels moeten in alle veertien locales landen, anders faalt
  `verify:i18n` (dat rekent met CLDR-pluralcategorieën, niet met letterlijke sleutelvergelijking).

## Toekomstpad (niet nu bouwen)

Als fase-koppeling ooit écht moet werken ("Ruwbouw klaar → Afbouw start"), is **FS-desugaring** de
route: klap bij het oplossen een relatie met een verzameltaak-eindpunt uit naar de bladtaken.

- `Fase → T (FS)` → voor elke bladtaak L in de fase: `L → T (FS)`. Correct: fase-eind = max over
  kinderen.
- `T → Fase (FS)` → voor elke L: `T → L (FS)`. Correct: fase-start = min over kinderen.

Dit werkt **alleen voor FS**. `Fase → T (SS)` betekent "T start als de fase start" = **min** over de
kinderstarts, en een conjunctie van blad-relaties levert **max**. Niet uitdrukbaar. Niet toevallig
staat MS Project op verzameltaken alleen FS en SS toe — daar botst hetzelfde probleem.

Voordeel van deze route boven "verzameltaken als echte netwerkknopen": de verzameltaak blijft géén
knoop, dus float, kritiek pad, rollup, nivellering en baselines blijven onaangeroerd. Wél nodig bij
die stap: een expliciete afwijzing van een relatie tussen een fase en haar eigen nakomeling — nu
onzichtbaar (de edge verdwijnt), na desugaring een echte cyclus.

Dit ontwerp houdt dat pad open door de relaties te bewaren in plaats van weg te filteren.

## Losse waarneming (buiten scope)

`useDependencyDraw.ts` toetst de drop-x tegen `ui.leftPanelWidth`, terwijl de rest van de
canvas-hittests `taskTableWidth` gebruiken. Ziet er verdacht uit, maar staat los van dit ontwerp.
