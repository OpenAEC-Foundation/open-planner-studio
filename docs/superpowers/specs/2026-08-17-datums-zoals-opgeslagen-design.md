# Datums zoals opgeslagen — ontwerp

**Datum:** 2026-08-17
**Status:** ontwerp, wacht op goedkeuring eigenaar
**Aanleiding:** [issue #63](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/63) — *"Does it recalculate immediately after opening?"*
**Scope:** aanwezigheidsregistratie in de IFC-lezer, het laadpad (`applyLoadedProject`), twee documentvelden, één reconstructiemodule en één modus-strook. Geen wijziging aan de solver, het IFC-formaat, de renderer of de tabel.

## Doel

Wanneer het openen van een bestand tot ándere datums leidt dan er in dat bestand staan, kan de gebruiker met één klik de **opgeslagen** datums bekijken in plaats van de herberekende. Dat is de situatie van de melder: een planning die via P6 → IFC (Bonsai/IfcOpenShell) binnenkomt, mét datums maar zonder volledig sluitende logica. Herberekening verschuift die datums dan, en er is nu geen manier om te zien wat het bronbestand eigenlijk zei.

De modus is **niet** een instelling en **niet** permanent: hij wordt alleen aangeboden wanneer er daadwerkelijk verschil is, hij is de hele tijd zichtbaar zolang hij aan staat, en hij verdwijnt zodra de gebruiker bewerkt of berekent.

## Niet-doelen (YAGNI)

- **Geen globale instelling** "bij openen herberekenen aan/uit". Die zou stil kunnen blijven staan en maanden later onverklaarbaar gedrag geven — precies het bezwaar dat in de issue-reactie is genoemd. De keuze is per bestand en per keer.
- **Geen read-only-bewerkingsslot.** Bewerken blijft gewoon toegestaan; het verlaat de modus. Een echte read-only-staat zou door de hele bewerklaag heen moeten (tabel, canvas-drag, contextmenu, MCP) en dat weegt niet op tegen de winst.
- **Geen vergelijkweergave** ("opgeslagen naast herberekend", verschilkolommen, afwijkingsrapport). Dat vraagt een `displayStart()`/`displayFinish()`-extractie over 86 callsites in 23 bestanden en is een eigen project. Baselines dekken de vergelijkbehoefte al deels.
- **Geen ondersteuning voor CSV/MSPDI/P6-import.** Die readers kopiëren `schedule*` naar `early*` ([`csvReader.ts:242`](../../../src/services/csv/csvReader.ts), [`mspdiReader.ts:335`](../../../src/services/msproject/mspdiReader.ts), [`p6xmlReader.ts:465`](../../../src/services/p6/p6xmlReader.ts)); er is dus geen onafhankelijk opgeslagen rekenresultaat om tegen te vergelijken. Alleen IFC doet mee.
- **Geen wijziging aan de IFC-writer.** `OPS_Analysis` blijft ongeschreven; die keuze staat los van deze functie en blijft geldig (zie *Wat er buiten de modus géén gevolgen heeft*).

## Huidige situatie

### Eén herberekenpunt

Alle open-paden lopen via `applyLoadedProject` ([`fileSlice.ts:147-202`](../../../src/state/slices/fileSlice.ts)), met precies één recompute op regel 181:

```ts
if (opts.recompute) get().runCPM();
```

Callers met `recompute: true`: `openFile` (`:230`), `openRecentFile` (`:505`), `openExampleFromString` (`:536`), en de MCP-tool `planner_import_schedule` ([`fileTools.ts:371`](../../../src/services/mcp/tools/fileTools.ts)).

### De opgeslagen datums zitten al in de state

De IFC-slotregistry ([`ifcTaskSlots.ts:83-170`](../../../src/services/ifc/ifcTaskSlots.ts)) leest zeven rekenvelden in die exact overeenkomen met `CPMTaskResult` ([`CPMSolver.ts:103-118`](../../../src/engine/scheduler/CPMSolver.ts)):

| IFC-slot | idx | TS-veld |
|---|---|---|
| EarlyStart | 7 | `time.earlyStart` |
| EarlyFinish | 8 | `time.earlyFinish` |
| LateStart | 9 | `time.lateStart` |
| LateFinish | 10 | `time.lateFinish` |
| FreeFloat | 11 | `time.freeFloat` |
| TotalFloat | 12 | `time.totalFloat` |
| IsCritical | 13 | `time.isCritical` |

`runCPM` overschrijft ze meteen na het laden via [`applyCpmResult.ts:33-45`](../../../src/engine/scheduler/applyCpmResult.ts). De opgeslagen waarden zijn op dat moment dus al ingelezen en worden weggegooid — dát is wat we willen kunnen terugdraaien.

### …maar "ingelezen" betekent niet "aanwezig geweest"

Kritieke valstrik. `parseDateFromIFC` geeft bij een `$`- of leeg argument **de datum van vandaag** terug ([`ifcReader.ts:455-460`](../../../src/services/ifc/ifcReader.ts)), en de zes datumslots roepen die parser onvoorwaardelijk aan. Een `IfcTaskTime` die alleen `ScheduleStart`/`ScheduleFinish` vult — het normale geval bij export uit een andere tool, en precies het scenario van issue #63 — levert dus `earlyStart === earlyFinish === vandaag` voor élke taak.

Een detectie die naïef pre- en post-solve `earlyStart` vergelijkt, meldt daar "312 van 312 taken verschoven", en "opgeslagen datums tonen" zou het hele project op vandaag zetten. Overtuigend fout is erger dan niets doen. Het ontwerp moet daarom onderscheid maken tussen *het bestand gaf een waarde* en *de lezer vulde een default in*.

### De weergave heeft geen wijziging nodig

De hele UI leest datums als `task.time.earlyStart || task.time.scheduleStart` — 50 sites voor start, 36 voor finish, over 23 bestanden (renderer, TableEditor, printPreview, exporters). Zetten we de opgeslagen waarden terug in `task.time`, dan tonen balken, tabel en export vanzelf de opgeslagen datums. **Nul renderer-wijzigingen.**

### Er zijn al drie modus-stroken

[`HourDataNotice`](../../../src/components/layout/HourDataNotice.tsx), [`StructureLockedNotice`](../../../src/components/layout/StructureLockedNotice.tsx) en [`DependencyModeNotice`](../../../src/components/layout/DependencyModeNotice.tsx) hangen in [`App.tsx:219-229`](../../../src/App.tsx), direct onder het lint en **boven** de `activeTab === 'file'`-vertakking — dus zichtbaar in Gantt, tabel, rapport én Backstage. `HourDataNotice` is het nauwste precedent: *een geladen bestand bevat data die de huidige modus niet honoreert.*

De docstring van `DependencyModeNotice` legt de regel vast die wij overnemen:

> *"Bewust een blijvende strook en geen toast: het is een MODUS (hij verandert wat slepen doet), en die mag niet onzichtbaar worden terwijl hij nog aan staat."*

## Ontwerp

### 0. Aanwezigheid bijhouden in de lezer

De informatie bestaat nog op precies één moment: het rauwe STEP-argument. Zodra `parseDate(arg)` heeft gedraaid is `$` niet meer te onderscheiden van een echte datum van vandaag, en na `parseDur(arg)` niet van een echte 0.

**Het `read?(t, arg, p)`-contract blijft ongemoeid.** De aanwezigheid wordt afgeleid buiten de descriptors om, in `extractTasks` ([`ifcReader.ts:631-700`](../../../src/services/ifc/ifcReader.ts)) — daar zijn de interne taak-id én de `IfcTaskTime`-entiteit al beschikbaar op het moment dat `parseTaskTime` wordt aangeroepen, en `TASKTIME_SLOT` ([`ifcTaskSlots.ts:221`](../../../src/services/ifc/ifcTaskSlots.ts)) geeft de naam→index-map. Eén controle op `args[idx]` per rekenslot volstaat; geen enkele slot-implementatie hoeft te wijzigen.

`extractTasks` bouwt al exact dit patroon voor `taskTimeEntities: Map<taskId, StepEntity>`. De nieuwe `recordedFields: Map<taskId, Set<slotKey>>` rijdt in hetzelfde return-object mee.

Puur additief: bestaand leesgedrag verandert niet en `parseDateFromIFC` blijft ongemoeid — de `$` ⇒ vandaag-semantiek is vastgelegd gedrag dat elders op leunt en mag niet verschuiven.

**Twee valkuilen bij het doorgeven.** `ImportResult` ([`importTypes.ts:43`](../../../src/services/importTypes.ts)) wordt hergebruikt als `WriteIFCInput` ([`ifcWriter.ts:128`](../../../src/services/ifc/ifcWriter.ts)) en uitgebreid door `GeneratedProject`, dus het veld moet **optioneel** zijn — anders breken alle writer-callers en de benchmark. En `payloadFromImport` ([`documentContract.ts:333`](../../../src/state/documentContract.ts)) is een **allowlist, geen spread**: een nieuw `ImportResult`-veld komt daar niet vanzelf doorheen.

Alleen de IFC-lezer krijgt dit. De vijf andere `ImportResult`-producenten (CSV, MSPDI, P6, extensie-import, benchmark) laten het veld gewoon weg, wat ze automatisch buiten de functie houdt (zie *Niet-doelen*).

### 1. Wat "de opgeslagen datums" zijn

Twee lagen, **per taak in hun geheel gekozen** — niet per veld:

| laag | bron | wanneer |
|---|---|---|
| **early** | `earlyStart` + `earlyFinish` | wanneer `recordedFields` **beide** meldt |
| **schedule** | `scheduleStart` + `scheduleFinish` | anders, mits `recordedFields` die meldt — dit is het geval van issue #63 |
| *geen* | — | meldt `recordedFields` geen van beide paren, dan wordt de taak **overgeslagen** |
| **speling & kritiek** | `totalFloat`/`freeFloat`/`isCritical`/`lateStart`/`lateFinish` | per veld, uitsluitend wanneer `recordedFields` het meldt |

De terugval op `scheduleStart`/`scheduleFinish` is geen noodgreep maar de kern van de functie. De eigen issue-reactie beschrijft het al: *"de opgeslagen `ScheduleStart` is het anker waar de solver vanaf begint"* — voor een taak zónder voorgangers overleeft die datum, voor een taak mét voorgangers niet. "Datums zoals opgeslagen" betekent voor zo'n bestand dus precies: toon `scheduleStart`/`scheduleFinish` zoals ze er staan.

**Waarom per paar en niet per veld** — correctie na de kwaliteitsreview van taak 2. Een taak waarvan het bestand alleen `EarlyStart` gaf zou anders `start` uit de early-laag en `finish` uit de schedule-laag krijgen: een datumpaar dat het bestand nooit heeft uitgesproken, in de praktijk zelfs een finish vóór de start. De balk die daaruit volgt is een verzinsel.

**Waarom `scheduleStart`/`scheduleFinish` óók aanwezigheidsregistratie nodig hebben** — de tweede en ernstigere correctie. De eerste versie van §0 registreerde alleen de zeven rekenslots, met als redenering dat `schedule*` invoer is en dus altijd betekenisvol. Dat is onjuist: een `IFCTASK` **zonder** `IfcTaskTime` — samenvattings- en WBS-knopen, doodgewoon in elk bestand — krijgt van de lezer `createDefaultTaskTime(vandaag)`, en een `IfcTaskTime` mét `$` op ScheduleStart levert via `parseDateFromIFC` óók vandaag. Zonder registratie op die twee slots leest de terugvallaag dus dezelfde `$`⇒vandaag-val die deze hele functie moet vermijden — één laag lager, en met een opgeblazen noemer in de melding als gevolg. `RECORDED_SLOT_KEYS` krijgt daarom een tegenhanger voor de twee invoerslots.

Ontbreekt de speling-laag, dan wordt die niet verzonnen — zie §4 voor wat dat per veld betekent.

### 2. Detectie — gratis, want de solve draait toch al

In `applyLoadedProject`, rond de bestaande `runCPM()` op regel 181:

1. **Vóór** de solve: leg per taak de opgeslagen waarden vast volgens de tabel hierboven, als `recordedTimes`.
2. Solve zoals nu.
3. **Ná** de solve: tel de taken waarvan de berekende `earlyStart` óf `earlyFinish` afwijkt van de vastgelegde waarde.
4. `> 0` ⇒ zet `recordedTimes` in de state, wat de strook laat verschijnen. `0` ⇒ gooi `recordedTimes` weg; de gebruiker merkt nooit iets.

Bestanden die OPS zelf schreef vallen vanzelf buiten de functie: die zijn intern consistent, dus de teller blijft 0.

Er is **geen extra solve** nodig — de bestaande recompute levert de vergelijking. De detectie is exact, niet heuristisch.

Alleen `opts.recompute === true`-paden doen mee. De vier callers zijn allemaal echte open-acties; `loadState` (`recompute: false`) blijft buiten schot.

### 3. Twee nieuwe documentvelden

In `DOCUMENT_FIELDS` ([`documentContract.ts`](../../../src/state/documentContract.ts)):

| veld | type | `fresh` | `snapshot` | betekenis |
|---|---|---|---|---|
| `recordedTimes` | `Record<string, CPMTaskResult> \| null` | `null` | `'ref'` | wat het bestand zei; bestaat alleen tussen laden en het verlaten van de modus |
| `datesAsRecorded` | `boolean` | `false` | `'ref'` | staat de modus aan |

`'ref'` is de juiste rol: beide worden altijd als geheel vervangen, nooit in-place gemuteerd — hetzelfde profiel als `cpmResult` en `scheduleStale`.

Waarom dit werkt voor Ctrl+Z: `tasks` staat al als `'clone'` in de snapshot en `cpmResult` als `'ref'` ([`documentContract.ts:176,188`](../../../src/state/documentContract.ts)). Een snapshot die vóór het verlaten wordt gepusht bevat dus de opgeslagen datums, het gereconstrueerde resultaat én de modusvlag. Undo draait alle drie in één stap terug.

**Invariant-verplichting.** `snapshot.ts` legt vast: een veld mag in de snapshot staan dan en slechts dan als élke mutator ervan een snapshot pusht. Voor `datesAsRecorded` betekent dat: zowel het **betreden** als het **verlaten** van de modus pusht er een. Dat is meteen goede UX — Ctrl+Z na "Opgeslagen datums tonen" brengt je terug naar herberekend, symmetrisch met de andere kant.

`recordedTimes` hoeft **niet** door IFC te round-trippen: het is per definitie afgeleid van het bestand dat zojuist gelezen is.

### 4. `cpmResultFromRecorded` — reconstructie zonder solve

Nieuwe pure module `src/engine/scheduler/cpmResultFromRecorded.ts`, met de vorm van de bestaande lege-resultaat-fabriek ([`CPMSolver.ts:120+`](../../../src/engine/scheduler/CPMSolver.ts)).

Bouwt een `CPMResult` uit `recordedTimes` plus de taken en de kalender:

**Altijd gevuld:**

| veld | bron |
|---|---|
| `tasks` | `recordedTimes` — `CPMTaskResult` is exact de zeven IFC-velden, dus vrijwel een identiteitsafbeelding |
| `projectEnd` | max opgeslagen finish |
| `projectDuration` | werkdagen tussen projectstart en `projectEnd` via de gedeelde `projectDurationOf` — telwerk, geen solve |
| `missedDeadlineTaskIds` | opgeslagen finish > `deadline`, per taak |
| `criticalPaths` | `[criticalPath]` — het contract eist lengte ≥ 1 met `criticalPaths[0] === criticalPath` |

**Alleen bij aanwezigheid** (`recordedFields`, §0):

| veld | bij ontbreken |
|---|---|
| `criticalPath` | leeg — een bestand zonder `IsCritical` heeft geen kritiek pad om te tónen, en nul kritieke taken verzinnen is een bewering die het bestand niet doet |
| `totalFloat`/`freeFloat` per taak | `undefined`-doorgeven kan niet (het type eist `number`); dus `0`, mét de strook die vertelt dat er niet gerekend is |
| `lateStart`/`lateFinish` per taak | gelijk aan de opgeslagen start/finish — geen afgeleide bewering |

**Bewust leeg** (staat niet in IFC, kán dus nooit eerlijk gevuld worden):

`drivingSequenceIds` (de solver-docstring zegt expliciet: *"wordt bewust niet gepersisteerd (ook niet in IFC)"*), `sequenceFreeFloat`, `truncatedLeadSequenceIds`, `violatedConstraintTaskIds`, `outOfSequenceSequenceIds`, `hammockNoFinishDriverTaskIds`, `nearCriticalTaskIds`, `floatPathByTask`, `cappedTaskIds`, `error`.

Gevolg voor de UI: de statusbalk toont projectduur, projecteinde en gemiste deadlines, plus de kritieke-pad-telling wanneer het bestand die kent. Geschonden constraints en out-of-sequence blijven leeg; relatietabel en driving-markering tonen geen driving-informatie. Dat is eerlijk — die informatie stáát niet in het bestand — en het is te plaatsen omdat de strook de hele tijd zegt dat er niet herberekend is.

**Gedeeld met de solver.** `projectDuration` liep aanvankelijk via een eigen telling in deze module, wat een zichtbare afwijking opleverde: een project van één dag met alleen mijlpalen gaf 1 in de reconstructie en 0 in de solver. Twee weergaven van hetzelfde project die verschillend rekenen is voor een gebruiker een bug, geen nuance. De mijlpaal-alleen-uitzondering uit [`scheduleAnalysis.ts`](../../../src/engine/scheduler/scheduleAnalysis.ts) is daarom geëxtraheerd naar `src/engine/scheduler/projectDurationOf` en wordt nu door beide paden aangeroepen.

Dat is een **afwijking van de scope-regel "geen wijziging aan de solver"** bovenaan dit document, bewust genomen tijdens de bouw. De extractie is een letterlijke transliteratie en is als gedragsbehoudend geverifieerd met een differentiële probe over 4992 combinaties van kalenders, spans en taaksets (nul afwijkingen). Wat wél verandert is het reconstructiepad — dat krijgt de uitzondering er nu bij, en dat is precies de bedoeling.

**Nulwaarden zijn hier het enige echte compromis.** `CPMTaskResult.totalFloat`/`freeFloat` zijn verplichte getallen, dus een bestand zonder speling krijgt nullen die eruitzien als "kritiek". Optioneel maken zou door de hele consumentenketen rimpelen en weegt niet op tegen de winst; de strook is het tegengif. Als dit in de praktijk verwart, is de opvolging `criticalPath` leeghouden (al zo ontworpen) en de speling-kolommen in de tabel leeg tonen in de modus — bewust buiten deze scope.

**Bonus:** omdat `cpmResult` niet-null is en `scheduleStale` `false` blijft, valt de MCP-poort [`staleGuard.ts:42`](../../../src/services/mcp/staleGuard.ts) in zijn early-return. De modus overleeft MCP-leesacties. In een variant waarin `cpmResult` op `null` was gebleven, had elke MCP-read de opgeslagen datums weggeblazen.

### 5. `RecordedDatesNotice` — één strook, twee standen

Nieuw component naast zijn drie broers in `App.tsx`, direct na `DependencyModeNotice`. Twee standen uit dezelfde state:

**Aanbod** — `recordedTimes !== null && !datesAsRecorded`:

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠  Herberekening verschoof 47 van 312 taken t.o.v. de          │
│    datums in het bestand.        [ Opgeslagen datums tonen ] × │
└────────────────────────────────────────────────────────────────┘
```

**Modus actief** — `datesAsRecorded`:

```
┌────────────────────────────────────────────────────────────────┐
│ ◉  Je ziet de datums zoals opgeslagen in het bestand.          │
│    Er is niet herberekend.                   [ Herberekenen ]  │
└────────────────────────────────────────────────────────────────┘
```

De knop **Herberekenen** doet exact wat F5 doet (route B in §7) — dezelfde store-actie, dus dezelfde undo-stap. De strook is geen tweede weg naar hetzelfde, alleen een zichtbare.

Het kruisje zit **alleen** op de aanbod-stand (aanbod afslaan ⇒ `recordedTimes = null`, strook weg, normaal doorwerken). De modus-stand heeft géén kruisje: een modus mag niet wegklikbaar zijn zonder hem te verlaten — dezelfde regel als `DependencyModeNotice`.

Bewust **geen** toast: `NotificationHost` laat een `info` na 5 s verdwijnen ([`NotificationHost.tsx:28-40`](../../../src/components/layout/NotificationHost.tsx)). Een aanbod dat verdwijnt terwijl de gebruiker naar een net geopend plan van 300 taken zit te kijken, is een aanbod dat niemand ziet. En een modus die onzichtbaar wordt terwijl hij aan staat is precies de val die het documentcontract afwijst. `AppNotification` blijft dus ongewijzigd — geen `action`-veld, geen wijziging aan `NotificationHost`.

### 6. Betreden

Store-actie `showRecordedDates()`:

1. `beginUndoable(s)` — snapshot met de herberekende toestand.
2. Schrijf `recordedTimes` terug in `task.time` — per taak de start/finish uit §1, plus de speling-laag voor zover het bestand die kende.
3. Wis `task.time.interferingFloat`, `isNearCritical` en `floatPath`. Die komen uit de zojuist weggegooide solve en zouden anders een planning beschrijven die niet meer op het scherm staat. `applyCpmResult` hanteert dezelfde regel al voor uitgezette opties — *"afwezig ⇒ het veld wordt gewist (zodat een uitgezette optie geen stale markering laat staan)"* ([`applyCpmResult.ts:41-43`](../../../src/engine/scheduler/applyCpmResult.ts)).
4. `s.cpmResult = cpmResultFromRecorded(...)`, `s.resourceLoadResult` opnieuw berekenen.
5. `s.datesAsRecorded = true`.
6. `s.scheduleStale = false` — de weergave is consistent met wat er getoond wordt.
7. Géén `isDirty`: er is niets gewijzigd t.o.v. het bestand. Sterker nog, de state komt hiermee dichter bij het bestand te liggen dan ervoor.
8. `recomputeViewRows()`.

### 7. Verlaten

Twee routes, allebei met werkende Ctrl+Z.

**Route A — bewerken.** `finishMutation(s, { stale: true })` ([`transaction.ts`](../../../src/state/transaction.ts)) wist `datesAsRecorded` en `recordedTimes`. De snapshot is op dat moment al door `beginUndoable` gepusht mét de modus aan, dus undo herstelt modus + datums + `cpmResult` in één stap. Eén regel, één plek — alle 26 muterende callsites erven het.

Ná het verlaten wordt **direct doorgerekend**, ongeacht de instelling "Automatisch berekenen". Dat is essentieel: anders ontstaat de mengvorm van half-opgeslagen, half-bewerkte datums zonder dat iets aangeeft welke welke is — de toestand die [`documentContract.ts:316-325`](../../../src/state/documentContract.ts) expliciet afwijst. Uitvoering via een kleine store-subscriptie naar het model van [`useAutoCalcCPM.ts`](../../../src/hooks/useAutoCalcCPM.ts), die de overgang `true → false` opmerkt en één keer `runCPM()` draait.

**Route B — F5 / "Bereken".** `runCPM` pusht uitzonderlijk wél een undo-snapshot, maar **uitsluitend** wanneer `datesAsRecorded` aan staat. Staat hij uit — het normale geval — dan is het gedrag byte-identiek aan nu en blijft de invariant intact waar [`staleGuard.ts:6-8`](../../../src/services/mcp/staleGuard.ts) en [`batchTool.ts:256`](../../../src/services/mcp/tools/batchTool.ts) op leunen (*"runCPM zet géén isDirty en pusht géén undo-snapshot"*). Die docstrings moeten de uitzondering benoemen.

Dat een MCP-tool die in de modus `runCPM` triggert nu een undo-stap oplevert, is correct en gewenst: het verlaten van de modus ís een datawijziging, en die hoort ongedaan te kunnen.

**Route C — documentwissel.** Modus en `recordedTimes` zijn documentvelden en reizen dus mee in de payload. Een document dat in de modus staat, staat er na terugkeren nog steeds in. Geen extra werk.

## Wat er buiten de modus géén gevolgen heeft

Dit ontwerp raakt de app **alleen zolang de modus aan staat**. Zodra de gebruiker bewerkt of berekent, is de state in elk opzicht die van vóór deze functie. Twee punten die er in een eerdere versie van deze spec ten onrechte als blijvende kosten in stonden:

**De writer-invariant blijft intact.** [`ifcWriter.ts:519-529`](../../../src/services/ifc/ifcWriter.ts) schrijft `OPS_Analysis` (`interferingFloat`/`isNearCritical`/`floatPath`) bewust niet meer, met als motivatie dat *"alle laadpaden gaan via `applyLoadedProject` met `recompute: true` ⇒ `runCPM()`"*. Die aanname wordt **niet** gebroken: het laadpad blijft onvoorwaardelijk herberekenen — dat ís de detectie uit §2 — en de modus wordt pas ná het laden betreden, door een expliciete klik. Een bestand dat in de modus is opgeslagen en later heropend wordt, krijgt gewoon weer een volledige solve die de drie velden regenereert. Geen wijziging aan de writer, geen wijziging aan de comment.

**Opslaan in de modus schrijft de opgeslagen datums terug**, en dat is precies de bedoeling: wie een geïmporteerd plan opent, bekijkt en opslaat, mag niet stilzwijgend herberekende datums in zijn bestand krijgen. Omdat de opgeslagen waarden gewoon in `task.time` staan, gebeurt dat automatisch — geen aparte writer-route.

**Crashherstel bewaart de modus niet.** `restoreDocuments` ([`documentSlice.ts:395`](../../../src/state/slices/documentSlice.ts)) draait `runCPM` op het actieve document. Na een crash is "herberekend" de eerlijke staat: de auto-save-snapshot is een momentopname van een bewerksessie, niet van het bronbestand. Dit is een scope-afbakening, geen prijs — wie de opgeslagen datums terug wil, opent het bestand opnieuw.

## De enige aanvaarde beperking

**`recordedTimes` wordt gewist bij het verlaten en is daarna niet meer op te roepen.** Dit is het enige punt dat de modus overleeft: heb je eenmaal bewerkt of berekend, dan kom je alleen nog terug via Ctrl+Z of door het bestand opnieuw te openen. Er is geen knop "toon opnieuw de opgeslagen datums".

De afweging: het veld levend houden voor de hele documentlevensduur roept de vraag op wat het nog betekent nadat taken zijn toegevoegd, verwijderd of hernoemd, en het kost geheugen per open document (tot zeven waarden × taken). Opnieuw openen is goedkoop en ondubbelzinnig. Blijkt in de praktijk dat mensen herhaaldelijk heen en weer willen, dan is de opvolging een expliciete bewaar-beslissing — bewust buiten deze scope.

## Raakvlakken die géén wijziging nodig hebben

Voor de duidelijkheid, want ze zagen er bij de verkenning uit alsof ze zouden breken:

| plek | waarom het goed gaat |
|---|---|
| [`staleGuard.ts:42`](../../../src/services/mcp/staleGuard.ts) | `cpmResult` niet-null + `scheduleStale` false ⇒ early return, geen recompute |
| [`useAutoCalcCPM.ts:20`](../../../src/hooks/useAutoCalcCPM.ts) | vuurt op `scheduleStale`, die in de modus `false` is; de eerste bewerking verlaat de modus toch al |
| export-guards [`fileSlice.ts:340,396`](../../../src/state/slices/fileSlice.ts), [`ReportPanel.tsx:428`](../../../src/components/panels/ReportPanel.tsx) | checken `scheduleStale` ⇒ exporteren de opgeslagen datums; gewenst |
| renderer, `TableEditor`, printPreview, exporters | lezen `earlyStart \|\| scheduleStart` ⇒ tonen vanzelf het juiste |
| `applyCpmResult` uur-modus-normalisatie ([`:58-62`](../../../src/engine/scheduler/applyCpmResult.ts)) | draait niet in de modus; na verlaten weer wel |
| [`ifcWriter.ts:519-529`](../../../src/services/ifc/ifcWriter.ts) | het laadpad blijft onvoorwaardelijk herberekenen ⇒ de `OPS_Analysis`-motivatie blijft waar |

## Tests

| suite | wat |
|---|---|
| `tests/planning/check-recorded-dates.ts` *(nieuw)* | detectietelling (0 verschil ⇒ geen aanbod; N verschil ⇒ aanbod met N); de §1-tweelagenkeuze (early\* aanwezig ⇒ early\*; alleen schedule\* ⇒ schedule\*); `cpmResultFromRecorded` vult de altijd-velden, laat `criticalPath` leeg zonder `IsCritical`, en laat de tien onmogelijke velden leeg; betreden herstelt de opgeslagen waarden exact én wist `interferingFloat`/`isNearCritical`/`floatPath`; verlaten via bewerking én via F5; Ctrl+Z herstelt modus + datums + `cpmResult` in één stap; een OPS-eigen bestand levert nooit een aanbod op |
| `tests/planning/check-ifc-roundtrip.ts` *(uitbreiding)* | **de scherpste regressie**: een `IfcTaskTime` met `$` op EarlyStart/EarlyFinish levert géén `recordedFields`-melding voor die slots — de `$` ⇒ vandaag-val uit *Huidige situatie* mag nooit als opgeslagen datum doorgaan |
| `tests/planning/check-document-contract.ts` | twee nieuwe velden in `DOCUMENT_FIELDS`, met hun `snapshot`-rol; capture/hydrate/fresh-rondgang |
| `tests/planning/check-export-guard.ts` | export in de modus schrijft de opgeslagen datums, niet de herberekende |
| `tests/mcp/cases-staleguard.ts` | de guard rekent **niet** door in de modus; een MCP-tool die wél `runCPM` triggert levert een undo-stap op |
| `tests/planning/check-recovery-integrity.ts` | crashherstel bewaart de modus niet (aanvaard gevolg 2) |

De compile-asserts in `snapshot.ts` (`MissingInPick`/`ExtraInPick`) en `documentContract.ts` dwingen de contractkant af zonder losse test.

## Documentatie & i18n

- **Gids:** nieuw artikel in `public/docs/nl/` en `public/docs/en/` met manifest-entry, laag `gidsen`. Onderwerp: geïmporteerde planningen bekijken zoals ze zijn vastgelegd. Verwijst naar de bestaande gids over importeren.
- **i18n:** nieuwe sleutels in `common` voor beide stroken-standen, beide knoppen en het aantal-verschoven-taken (met pluralvormen — `verify:i18n` rekent met CLDR-categorieën, dus `pl` krijgt `few`/`many`, de Romaanse talen `many`, en `zh`/`ja`/`ko` géén `one`). Alle veertien locales.
- **CLAUDE.md:** de architectuurparagraaf over scheduling stelt dat `runCPM` na een IFC-load altijd draait. Dat blijft waar — maar de uitkomst kan nu bewust worden teruggedraaid. Eén zin toevoegen.
- **`docs/TODO.md`:** n.v.t., dit stond er niet in.

## Inschatting

Twee tot drie dagen. De zwaartepunten: de aanwezigheidsregistratie in de lezer (§0 — nieuw sinds de zelfreview, en de enige plek waar bestaand IFC-gedrag wordt aangeraakt), `cpmResultFromRecorded` (de lege velden vergen per stuk een bewuste motivatie), de nieuwe testbatterij, en i18n × 14. Het laadpad, de twee contractvelden en de strook zijn elk klein doordat het precedent er telkens al ligt.

## Wat er in de zelfreview is veranderd

Het eerste ontwerp nam aan dat `earlyStart` na het lezen betekent *"dit stond in het bestand"*. Dat is onjuist: `$` wordt vandaag. Zonder §0 zou de functie op precies de bestanden waarvoor hij bedoeld is — externe exports met alleen `ScheduleStart`/`ScheduleFinish` — het hele project op vandaag zetten en dat als "de opgeslagen datums" presenteren. De aanwezigheidsregistratie en de terugval op `schedule*` zijn daar het antwoord op; ze maken het ontwerp iets groter en aanzienlijk juister.
