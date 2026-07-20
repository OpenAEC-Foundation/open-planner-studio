# Pakket D1 — "Project verplaatsen…" (Move Project): veld-inventarisatie + implementatieplan

**Status:** bindend implementatiedocument. Read-only onderzoek; er is niets in de repo gewijzigd.
**Worktree:** `/home/nozzit/open-aec/OPS/open-planner-studio/.claude/worktrees/todo-kleine-dingen-794832`
**Bron van de opdracht:** `docs/TODO.md:40-45`.

---

## 0. Samenvatting van de bevindingen die het ontwerp sturen

Vijf dingen die ik in de code heb nagelezen en die het plan bepalen. Alle vijf zijn geverifieerd door
het lezen van de genoemde bestanden/regels in deze sessie (geen aanname, geen herinnering).

1. **`project.startDate` is NIET het reken-anker van de CPM.** De forward pass leidt de projectstart
   af uit de taken zónder voorganger (`src/engine/scheduler/CPMSolver.ts:482-488`:
   `projectStart = min(snapOnOrAfter(t.time.scheduleStart))`). `project.startDate` voedt alleen
   defaults voor nieuwe taken (`taskSlice.ts:120`, `:656`, `ribbonWidgets.tsx:181`,
   `TaskDialog.tsx:58`), de kalender-generatiespanne (`computeGenerateSpan`) en export
   (`mspdiWriter.ts:250`, `p6xmlWriter.ts:247`, `ifcWriter.ts:149` als fallback).
   ⇒ **Het is niet voldoende om `project.startDate` te zetten; élke taak-anker moet mee.**

2. **`project` staat NIET in de undo-snapshot.** `src/state/snapshot.ts:35-43` bewaart uit `project`
   uitsluitend `Pick<Project,'wbsAutoNumber'>`, en `documentContract.ts:147` geeft `project` de rol
   `snapshot: 'none'`. Een `moveProject` die `beginUndoable(s)` gebruikt zou bij undo wél de taken
   maar **niet** `project.startDate`/`endDate`/`statusDate` terugdraaien. Zie §5.1 voor de vereiste
   ingreep — dit is het grootste risico op stille datacorruptie in dit pakket.

3. **Datumvelden dragen twee vormen.** Date-only (`YYYY-MM-DD`) in dag-modus, datetime
   (`YYYY-MM-DDTHH:mm`) in uur-modus (fase 2.8b; `types/task.ts:98-99`, `dateUtils.ts:41-50`,
   `scheduleSlice.ts:108-112`). De shift-helper moet **vormbehoudend** zijn: date-only blijft
   date-only, datetime blijft datetime. `parseInstant` + `addCalendarDays` (UTC, `setUTCDate`) +
   `formatInstant(mode)` doet dat exact en behoudt het tijdstip-op-de-dag.

4. **De gegenereerde feestdagen dekken een eindige jarenspanne.** `WorkCalendar.generation`
   (`types/calendar.ts:40-46`) bewaart `generatedFromYear`/`generatedToYear`, en
   `computeGenerateSpan` (`src/engine/calendar/generateCalendarHolidays.ts:61`) leidt die af uit
   `project.startDate`/`endDate`. Verplaats je een project 2 jaar vooruit, dan **valt de nieuwe
   projectperiode buiten de gematerialiseerde feestdagen** en rekent de planning stilzwijgend
   zonder feestdagen. Dit is een echte valkuil die de preview moet melden (§7.4, randgeval R7).

5. **Er bestaat al een puur, mutatie-vrij preview-patroon**: `levelResources` in
   `scheduleSlice.ts:177-195` draait de rekenmotor en geeft een resultaat terug zonder de store aan
   te raken; `LevelingDialog.tsx` toont dat als diff-tabel met Toepassen/Annuleren. Dat patroon
   kopieer je 1-op-1 (§6.2, §7).

---

## 1. Veld-inventarisatie — uitputtend

Legenda voor het verdict:
- **MEE** — de shift-helper schrijft dit veld met `+Δ` kalenderdagen.
- **NIET** — bewust overgeslagen; blijft op zijn absolute datum staan.
- **AFGELEID** — wordt door de aansluitende `runCPM` (of `recomputeResourceLoad`/`recomputeViewRows`)
  overschreven; niet zelf schuiven (dat zou hoogstens een frame lang een verkeerde balk tonen en
  verbergt fouten in de solver).

### 1.1 Project — `src/types/project.ts`

| Veld | Regel | Type | Verdict | Toelichting |
|---|---|---|---|---|
| `Project.startDate` | 30 | `string` ISO | **MEE** | Het referentiepunt zelf: wordt op `newStartDate` gezet; Δ = `diffDays(oud, nieuw)`. |
| `Project.endDate` | 31 | `string` (mag `''`) | **MEE (als niet-leeg)** | Vrij metadataveld (contractuele einddatum), geen rekenveld. Leeg blijft leeg. |
| `Project.statusDate` | 47 | `string?` ISO, mag datetime | **MEE** | P6 data date. Voedt de CPM (`scheduleSlice.ts:62`). Zou hij blijven staan, dan valt na een verschuiving vooruit het hele project "in de toekomst" t.o.v. de data date en verdwijnt de voortgangs-vloer. |
| `Project.createdAt` | 33 | `string` datetime | **NIET** | Bestandshistorie, geen planningsdatum. |
| `Project.modifiedAt` | 34 | `string` datetime | **NIET (wel bijwerken naar `now`)** | Zoals elke mutatie in `projectSlice` doet (`projectSlice.ts:105`). |
| `Project.calendarId` | 32 | `string` | n.v.t. | Geen datum. |
| `Project.wbsAutoNumber` | 44 | `boolean?` | n.v.t. | Geen datum. |
| `Project.progressMode` | 49 | enum | n.v.t. | Geen datum. |
| `Project.schedulingOptions.*` | 10-24 | opties | n.v.t. | Drempels/modi, geen datums. |

### 1.2 Taak — `src/types/task.ts`

#### TaskTime (regel 87-126)

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `scheduleStart` | 98 | **MEE** | **Het echte anker.** De solver leest dit voor taken zonder voorganger (`CPMSolver.ts:486,520`) en snapt op-of-ná. Zonder deze shift doet `moveProject` niets aan de planning. |
| `scheduleFinish` | 99 | **MEE** | Geen anker in dag-modus, maar wordt als fallback gelezen (`ganttViewport.ts:47`, `externalLinks.ts:55`, `ifcWriter.ts:148`) en in uur-modus door `runCPM` overschreven. Meeschuiven houdt de state consistent tussen shift en herberekening. |
| `earlyStart` | 102 | **AFGELEID** | `scheduleSlice.ts:81`. |
| `earlyFinish` | 103 | **AFGELEID** | `scheduleSlice.ts:82`. |
| `lateStart` | 104 | **AFGELEID** | `scheduleSlice.ts:83`. |
| `lateFinish` | 105 | **AFGELEID** | `scheduleSlice.ts:84`. |
| `freeFloat` / `totalFloat` | 106-107 | **AFGELEID** | Duren, geen datums; `scheduleSlice.ts:85-86`. |
| `isCritical` | 108 | **AFGELEID** | `scheduleSlice.ts:87`. |
| `interferingFloat` | 112 | **AFGELEID** | fase 2.9; `scheduleSlice.ts:91`. |
| `isNearCritical` | 114 | **AFGELEID** | `scheduleSlice.ts:92-93`. |
| `floatPath` | 116 | **AFGELEID** | `scheduleSlice.ts:94-95`. |
| `actualStart` | 119 | **MEE** | Werkelijke start. Zie randgeval R5 — dit is de meest omstreden keuze en verdient de expliciete waarschuwing in de preview. |
| `actualFinish` | 120 | **MEE** | Idem. |
| `actualDuration` | 121 | **NIET** | Duur (dagen), geen datum. |
| `remainingTime` | 122 | **NIET** | Duur. |
| `remainingMinutes` | 124 | **NIET** | Duur (minuten). |
| `completion` | 125 | **NIET** | Fractie. |
| `scheduleDuration` | 91 | **NIET** | Duur in werkdagen. |
| `durationMinutes` | 97 | **NIET** | Duur in minuten. |
| `durationType` | 88 | **NIET** | Enum. |

#### Task (regel 128-185)

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `constraint.date` | 51 (`TaskConstraint`), via `Task.constraint` regel 161 | **MEE** | Primaire constraint, alle 8 types. Bij `ASAP`/`ALAP` is `date` afwezig ⇒ no-op. |
| `constraint.type` | 49 | **NIET** | Enum. |
| `constraint.hard` | 56 | **NIET** | Vlag. De **datum** onder de harde pin schuift wél mee — zie randgeval R4. |
| `constraint2.date` | via regel 166 | **MEE** | Secundaire constraint (fase 2.9). **Vergeet deze niet** — hij is optioneel en zit niet in de meeste voorbeeldbestanden; hem overslaan is precies de stille corruptie die dit pakket moet voorkomen. |
| `deadline` | 176 | **MEE** | Zachte deadline (MSP-model). |
| `externalLinks[].anchorDate` | 71 (`ExternalLink`), via regel 173 | **MEE** | Bevroren P6-External-Date. Zie randgeval R6 (de bron schuift niet mee). |
| `externalLinks[].lagDays` / `lagMinutes` | 68-69 | **NIET** | Duren. |
| `externalLinks[].sourceRef.*` | 72 | **NIET** | Identiteit/paden. |
| `externalLinks[].sourceMissing` | 74 | **NIET** | Versheidssignaal. |
| `isHammock` | 171 | **NIET** (maar zie hieronder) | Vlag. Een hammock heeft géén eigen datum die telt: zijn ES/EF/`scheduleDuration` worden in de forward pass afgeleid uit de drivers (`CPMSolver.ts:502-517`). Zijn `scheduleStart` schuift wel mee (het is een gewoon TaskTime-veld) maar wordt genegeerd. **Verdict effectief: automatisch correct, geen speciale behandeling nodig.** |
| `levelingDelay` | 150 | **NIET** | Vertraging in werkdagen, relatief. |
| `milestoneKind` | 137 | **NIET** | Enum. |
| `mandatory` | 140 | **NIET** | Markering (contractuele mijlpaal), geen datum. |
| `priority` | 144 | **NIET** | Getal. |
| `activityCodes` | 157 | **NIET** | id→id. |
| `customFields[defId]` | 159 | **NIET — bewust** | Zie §1.7: `CustomFieldType` kent `'date'` (`types/structure.ts:28`). Gemotiveerd verdict onder. |
| `notes[]` | 184 | **NIET** | `{id,text,done}` — geen datums (fase 2.10 item 1). |
| `color`, `wbsCode`, `parentId`, `childIds`, `resourceIds`, `calendarId`, `status`, `taskType`, `isMilestone`, `description`, `name`, `id` | div. | **NIET** | Geen datums. |

### 1.3 Relaties — `src/types/sequence.ts`

| Veld | Regel | Verdict |
|---|---|---|
| `lagDays` | 19 | **NIET** — relatieve duur. |
| `lagMinutes` | 23 | **NIET** — relatieve duur. |
| `lagPercent` | 31 | **NIET** — percentage. |
| `lagUnit` | 25 | **NIET** — enum. |

`Sequence` bevat **geen enkel** absoluut datumveld. Dat is de reden dat het netwerk zijn vorm exact
behoudt bij een shift; alleen de kalender-snapping kan de uitkomst veranderen.

### 1.4 Kalenders — `src/types/calendar.ts` — **alle NIET**

Design-besluit 2. Volledig geïnventariseerd zodat de volgende agent kan zien dat de overslag bewust is:

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `WorkCalendar.holidays[].startDate` | 50 (`Holiday`) | **NIET** | Feestdagen liggen op absolute datums. |
| `WorkCalendar.holidays[].endDate` | 51 | **NIET** | Idem — dekt ook bouwvak/winterstop (gematerialiseerde ranges, `calendar.ts:11`). |
| `WorkCalendar.holidays[].name` | 49 | **NIET** | Tekst. |
| `WorkCalendar.workDays[]` | 7 | **NIET** | Weekdag-nummers (1..7), geen datums. |
| `WorkCalendar.workStartHour` / `workEndHour` / `hoursPerDay` | 8-10 | **NIET** | Tijd-op-de-dag, geen datum. |
| `WorkCalendar.workTime.byWeekday[d][].start/end` | 35 (`WorkTimeBands`) | **NIET** | Minuten-vanaf-middernacht per weekdag; geen absolute datum. |
| `WorkCalendar.shift` | 21 | **NIET** | Enum. |
| `CalendarGeneration.generatedFromYear` | 44 | **NIET** | Zie randgeval R7: de dekking kan na een grote shift onvoldoende zijn ⇒ **waarschuwen**, niet schuiven. |
| `CalendarGeneration.generatedToYear` | 45 | **NIET** | Idem. |
| `CalendarGeneration.ruleSetId` / `region` / `breakChoice` | 41-43 | **NIET** | Herkomst-metadata. |

Dit geldt voor **`s.calendar` (de gedenormaliseerde projectkalender-cache) én elke entry in
`s.calendars` (de bibliotheek, inclusief resource- en taakkalenders)**.

### 1.5 Resources & toewijzingen — `src/types/resource.ts`

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `Resource.availabilitySteps[].from` | 5 (`AvailabilityStep`), via regel 26 | **MEE** | Effective-dated capaciteit (P6 Max Units/Time). Dit is een **project**-planningsdatum ("vanaf week 12 hebben we 3 kranen"), niet een kalenderfeit. Blijft hij staan, dan verschuift de hele bemensingscurve t.o.v. de taken en verandert de overallocatie stilzwijgend. Gelezen door `ResourceLoad.ts:180-185`. |
| `Resource.maxUnits` | 20 | **NIET** | Getal. |
| `Resource.availability` (deprecated) | 17 | **NIET** | Getal. |
| `Resource.calendarId` | 23 | **NIET** | Verwijzing; de kalender zelf schuift niet (§1.4). |
| `Resource.costPerHour` / `unitOfMeasure` / `parentId` / `type` | div. | **NIET** | Geen datums. |
| `ResourceAssignment.unitsPerDay` | 42 | **NIET** | Getal. |
| `ResourceAssignment.curve` | 44 | **NIET** | Enum. De curve is **relatief over de taakduur**, niet absoluut in de tijd — hij schuift automatisch mee met de taak. |
| `ResourceAssignment.taskId` / `resourceId` / `id` | 37-39 | **NIET** | Identiteit. |

`ResourceAssignment` bevat **geen** absolute datum en **geen** perioden — de verdeling wordt per run
uit de taakduur afgeleid (`distributeUnits`, `ResourceLoad.ts`). De "tijd-gefaseerde perioden" uit de
opdracht zitten uitsluitend in `Resource.availabilitySteps`.

### 1.6 Baselines — `src/types/baseline.ts` — **MEE alleen bij `shiftBaselines: true`**

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `BaselineTask.start` | 7 | **MEE (optioneel)** | Alleen als de checkbox aan staat. |
| `BaselineTask.finish` | 8 | **MEE (optioneel)** | Idem. |
| `Baseline.projectEnd` | 20 | **MEE (optioneel)** | Idem — anders wijst de variance-samenvatting naar een einddatum die nergens meer op slaat. |
| `Baseline.createdAt` | 17 | **NIET** | Wanneer de snapshot genomen is — een archiefdatum, nooit een planningsdatum. **Ook niet bij `shiftBaselines: true`.** |
| `BaselineTask.duration` | 9 | **NIET** | Duur. |
| `Baseline.projectDuration` | 21 | **NIET** | Duur. |
| `BaselineTask.isMilestone` / `milestoneKind` / `taskId` | 10-11, 6 | **NIET** | Geen datums. |

**Default-keuze: checkbox UIT (baselines schuiven niet mee).** Onderbouwing in één zin: een baseline
bestaat uitsluitend om afwijking te meten, dus hem stilzwijgend meeschuiven wist precies het signaal
waarvoor hij is aangemaakt — wie bewust rebaselinet zet het vinkje aan.
*Praktische aanvulling:* toon de checkbox alleen als `baselines.length > 0`.

### 1.7 Structuur (activity codes & custom fields) — `src/types/structure.ts`

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `CustomFieldDef.type === 'date'` ⇒ `task.customFields[defId]` | 28 / 36 | **NIET — bewust, gedocumenteerd** | Dit is het "gekste" veld in de inventarisatie en verdient een expliciet besluit. Een gebruikersveld van type `date` kan van alles zijn: "keuringsdatum", "vergunning verleend op", "einde garantie", "geboortedatum uitvoerder". De app kent de semantiek niet en de solver leest ze nooit (`filterEval.ts:65-66` gebruikt ze puur voor filter/groep/sorteer). Automatisch meeschuiven zou net zo vaak fout als goed zijn, en fout is hier onherstelbaar (geen aparte undo). **Besluit: niet schuiven, en de preview meldt hoeveel `date`-custom-fields er zijn ingevuld ("N datumvelden blijven staan"), zodat de gebruiker het weet.** Een latere iteratie kan een per-veld-vinkje toevoegen. |
| `ActivityCodeType` / `ActivityCodeValue` (id, code, name, color, description) | 13-26 | **NIET** | Geen datums. |
| `CustomFieldDef.id` / `name` | 31-32 | **NIET** | Geen datums. |

### 1.8 View-state — `src/types/view.ts`

| Veld | Regel | Verdict | Toelichting |
|---|---|---|---|
| `ViewState.viewStartDate` | 97 | **AFGELEID — via `requestFitToProject()`** | Gemotiveerd verdict: hem met `+Δ` schuiven werkt alleen als de balken óók exact `+Δ` schuiven, en dat is precies wat design-besluit 2 uitsluit (het projecteinde kan verspringen). De juiste uitkomst is "toon het verplaatste project" — dat is precies wat `requestFitToProject()` (`viewSlice.ts:118-121`) al doet: het zet `view.pendingFit`, de `GanttCanvas` meet de viewport en voert `computeFitToProject` uit. **Roep dat na `runCPM` aan.** Zo is er één definitie van "project in beeld" en niet twee. |
| `ViewState.scrollX` / `scrollY` | 93-94 | **AFGELEID** | Wordt door de fit gezet. |
| `ViewState.zoom` | 95 | **AFGELEID** | Idem. |
| `ViewState.splitView.secondaryScrollX` | 89 (`SplitViewState`) | **AFGELEID** | Volgt de fit/render; geen absolute datum. |
| `ViewState.filter` → `FilterNode` rule `value` / `value2` | 60-61 | **NIET — bewust** | Een filterregel kán een datum bevatten (`FieldRef {src:'builtin', key:'start'|'finish'}` met operator `between`). Maar een filter is een **weergavevraag** van de gebruiker ("laat me Q3 zien"), geen projectdatum. Meeschuiven zou de vraag veranderen. Niet schuiven; wel noemen in het plan zodat het een bewuste keuze is. |
| `ViewState.columns` / `group` / `sort` / `collapsedGroupKeys` / `histogramResourceId` / `pendingFit` | 102-117 | **NIET** | Geen datums. |
| `Layout.*` (app-globale preset) | 75-83 | **NIET** | Bevat kolommen/filter/groep/sort/tijdschaal; geen absolute datums, en is bovendien app-globaal (niet per document). |

### 1.9 Afgeleide resultaten in de store

| Veld | Bestand:regel | Verdict |
|---|---|---|
| `CPMResult.projectEnd` | `CPMSolver.ts:51` | **AFGELEID** — `runCPM` schrijft het geheel opnieuw (`scheduleSlice.ts:157`). |
| `CPMTaskResult.earlyStart/earlyFinish/lateStart/lateFinish` | `CPMSolver.ts:79-82` | **AFGELEID**. |
| `CPMResult.criticalPath(s)`, `drivingSequenceIds`, `violatedConstraintTaskIds`, `missedDeadlineTaskIds`, `truncatedLeadSequenceIds`, `outOfSequenceSequenceIds`, `nearCriticalTaskIds`, `hammockNoFinishDriverTaskIds`, `floatPathByTask`, `sequenceFreeFloat`, `projectDuration` | `CPMSolver.ts:17-52` | **AFGELEID**. |
| `resourceLoadResult` (per-dag-maps op ISO-datum) | `ResourceLoad.ts:94` | **AFGELEID** — `runCPM` herberekent het (`scheduleSlice.ts:161-163`). |
| `viewRows` | `viewSlice.ts:16` | **AFGELEID** — `recomputeViewRows()` binnen `runCPM` (`scheduleSlice.ts:167`). |
| `scheduleStale` | `scheduleSlice.ts:23` | **AFGELEID** — door `runCPM` op `false` gezet. |

### 1.10 App-globale / niet-document-state

| Veld | Bestand:regel | Verdict |
|---|---|---|
| `taskClipboard` (`{tasks, sequences, assignments}`, diepe JSON-kloon) | `taskSlice.ts:28`, `:552` | **NIET** | App-globaal (bewust níét per document geswapt, zie `CLAUDE.md`) en kan taken uit een ánder document bevatten. Meeschuiven zou datacorruptie over documentgrenzen zijn. Het klembord bevat wel taakdatums, dus dit verdict expliciet vastleggen. |
| Overige geopende documenten (`documentSlice` → `DocumentPayload`-snapshots) | `documentSlice.ts`, `documentContract.ts:41-71` | **NIET** | Multi-document is single-active; `moveProject` raakt uitsluitend het actieve document. |
| `undoStack` / `redoStack` | `documentContract.ts:169-170` | **NIET** | Historie; zie §5.1 voor wat er wél in de nieuwe snapshot moet. |
| `ui.*` (buiten `collapsedTaskIds`) | `slices/types.ts:105-184` | **NIET** | Bevat geen enkele datum. |
| `extensionSlice` (catalogus `fetchedAt: number`) | `extensionSlice.ts:45` | **NIET** | Cache-tijdstempel op app-niveau. |
| `filePath` / `fileHandle` / `isDirty` | `documentContract.ts:67-70` | **NIET** | Geen datums (`isDirty` wordt wél op `true` gezet door `finishMutation`). |

### 1.11 Volledigheidscheck

De inventarisatie is opgebouwd door **alle negen bestanden in `src/types/` volledig te lezen**
(`task.ts`, `project.ts`, `calendar.ts`, `resource.ts`, `sequence.ts`, `baseline.ts`, `structure.ts`,
`view.ts`, `index.ts`) plus `DocumentPayload` (`documentContract.ts:41-71`, dat een **compile-time
volledigheidscheck** heeft op `DOCUMENT_FIELDS` — regel 176-182), en aangevuld met greps op
`date|Date|start|finish|end|from` door `src/state/slices/` en `src/`.

**Aanbeveling voor de bouwende agent:** neem in `src/engine/moveProject.ts` dezelfde truc over als
`documentContract.ts` — een `satisfies`/`Exclude<>`-assertie die faalt zodra er een nieuw
datumveld aan `TaskTime`/`Task`/`Project` wordt toegevoegd dat niet expliciet in de MEE- of
NIET-lijst staat. Dat is de enige manier waarop deze tabel niet stil veroudert.

---

## 2. Uur-modus (fase 2.8b)

**Beslissing: de shift verplaatst een tijdstip met een geheel aantal kalenderdagen en behoudt het
tijdstip-op-de-dag exact. `moveProject` snapt NIET naar het eerstvolgende werkmoment.**

Onderbouwing (drie redenen, alle drie verifieerbaar in de code):

1. **Het tijdstip is planner-intentie, het werkmoment is solver-werk.** `CPMSolver` snapt zelf al
   elke datum met `snapOnOrAfter` (`CPMSolver.ts:486, 520, 528, 567`) voordat hij ermee rekent, in
   dag- én uur-modus (`snapOnOrAfter` delegeert naar `nextWorkInstant` op een uur-kalender). Zou
   `moveProject` óók snappen, dan snap je twee keer op twee plekken, met een tweede definitie van
   "werkmoment" die uit de pas kan lopen. Precedent: `runCPM` normaliseert `scheduleStart` in
   uur-modus expliciet **zonder de instant te veranderen** (`scheduleSlice.ts:111`, met de
   toelichting "verandert de instant niet, dus geen drift").
2. **Snappen zou onherstelbaar zijn voor niet-solver-velden.** `deadline`, `constraint.date` en
   `actualStart/Finish` zijn feiten/afspraken, geen berekende datums. Een deadline "vrijdag 16:00"
   die na de shift stilzwijgend "maandag 08:00" wordt is datacorruptie zonder eigen undo.
3. **Het is technisch een no-op-risico van nul.** `addCalendarDays` gebruikt `setUTCDate`
   (`dateUtils.ts:65-69`) en de engine rekent in UTC zonder DST (`dateUtils.ts:30-31`), dus
   `+N` kalenderdagen laat `HH:mm` gegarandeerd ongemoeid.

**Vormbehoud is verplicht.** De helper leidt de modus af uit de *string*, niet uit de kalender:

```ts
// src/engine/moveProject.ts
export function shiftIso(iso: string, deltaDays: number): string {
  if (!iso) return iso;                                   // '' / undefined blijft leeg
  const mode: DateMode = iso.includes('T') ? 'hour' : 'day';
  const d = parseInstant(iso);
  if (isNaN(d.getTime())) return iso;                     // corrupte import: ongemoeid laten
  return formatInstant(addCalendarDays(d, deltaDays), mode);
}
```

Dat is de enige juiste vorm-discriminator: `project.statusDate` mag een datetime zijn óók als de
projectkalender een dag-kalender is (`types/project.ts:47`), en een gemengd dag/uur-document
(`ui.allowMixedDayHour`) heeft per taak een andere vorm. Afleiden uit de effectieve kalender zou
in gemengde documenten fout gaan; afleiden uit de string is per definitie correct.

**Δ is altijd een geheel aantal kalenderdagen**, ook in uur-modus: de gebruiker kiest een nieuwe
start*datum*, niet een nieuw start*moment*. `Δ = diffDays(project.startDate, newStartDate)`
(`dateUtils.ts:108`, die intern naar middernacht kapt en dus ongevoelig is voor een datetime-
`project.startDate`).

---

## 3. Randgevallen

| # | Randgeval | Gedrag | Actie voor de bouwer |
|---|---|---|---|
| **R1** | **Shift naar het verleden** (Δ < 0) | Volledig symmetrisch: `addCalendarDays` accepteert negatief. De projectstart-vloer in de forward pass (`CPMSolver.ts:482-488`) wordt uit de *verschoven* taken afgeleid en verschuift dus mee — er is geen absolute ondergrens die zou afkappen. | Geen speciale code. Wel een **niet-blokkerende** hint in het dialoog als `newStartDate < vandaag` ("de nieuwe startdatum ligt in het verleden"); het is een legitieme handeling (planning terugzetten). |
| **R2** | **Shift over een jaargrens** | Kerst/nieuwjaar/bouwvak liggen ná de shift op andere plekken in het netwerk ⇒ de projectduur in kalenderdagen verandert. Dit is precies design-besluit 2. | **Moet in de preview zichtbaar zijn** als "oude einddatum → nieuwe einddatum" plus de duur-in-werkdagen vóór/ná. Testcase `move-06`. |
| **R3** | **Project zonder taken** | `Δ` is berekenbaar, maar er valt niets te verschuiven. `runCPM` levert `projectEnd: ''` (`CPMSolver.ts:114`). `computeFitToProject` geeft `null` bij 0 taken (`ganttViewport.ts:38`) ⇒ de fit is een veilige no-op. | Actie moet slagen (alleen `project.startDate`/`endDate`/`statusDate` schuiven); preview toont "geen taken — alleen de projectstartdatum verschuift". **Geen** undo-snapshot-pollutie vermijden is hier niet nodig: er verandert wél iets (`project.startDate`), dus `beginUndoable` is correct. Wel guard: `Δ === 0` ⇒ **volledige no-op, geen snapshot** (patroon uit `transaction.ts:33-37`). |
| **R4** | **Taak met harde `Mandatory Start/Finish`-pin** (`constraint.hard === true`, fase 2.9) | De pin-**datum** schuift mee (het is `constraint.date`, §1.2). De pin blijft daarna onvoorwaardelijk pinnen op de nieuwe datum (`CPMSolver.ts:hardPinStart` → `applyForwardConstraints` returnt de pin direct). **Dat is het gewenste gedrag**: een harde pin is een gebruikersafspraak op de planning, niet op de kalender. | Geen speciale code — het valt vanzelf goed uit zodra `constraint.date` in de MEE-lijst staat. **Wel** in de preview melden: "N taken met een harde pin — hun pin verschuift mee." Wie een pin op een écht vaste datum wil (opleverdatum in het contract) moet dat na de shift terugzetten; er is geen manier waarop de app dat onderscheid kent. Testcase `move-09`. |
| **R5** | **Project met voortgang/actuals, statusdatum schuift mee** | `statusDate`, `actualStart`, `actualFinish` schuiven alle drie met dezelfde Δ ⇒ de relatie "wat is af t.o.v. de data date" blijft **exact** behouden en de voortgangstakken in de forward pass (`CPMSolver.ts:~590-620`) gedragen zich identiek. Dat is de enige zelfconsistente keuze. | **Waarschuwing in de preview is verplicht**: "N taken hebben werkelijke datums; die verschuiven mee." Verplaatsen van een *lopend* project is inhoudelijk zelden juist (het verleden is echt gebeurd). Geen blokkade — wel zichtbaar. Testcase `move-11`. |
| **R6** | **Externe koppeling waarvan de bron NIET meeschuift** | `anchorDate` schuift mee (§1.2) — dat is correct binnen dít document (de link houdt zijn relatieve positie). Maar het **bronproject** is een ander bestand dat níét verschuift, dus het anker is nu aantoonbaar stale. | Preview meldt: "N externe koppelingen: hun anker verschuift mee, maar het bronproject niet — ververs de koppelingen na het verplaatsen." De verversing bestaat al: `refreshExternalAnchors` (`src/engine/externalLinks.ts:72`). **Zet `sourceMissing` NIET op `true`** — dat veld betekent "bron niet vindbaar", niet "anker verouderd", en misbruiken zou de ghost-weergave (§5.5 van de 2.9-spec) vervuilen. Testcase `move-10`. |
| **R7** | **Gegenereerde feestdagen dekken de nieuwe periode niet** (*nieuw gevonden, stond niet in de opdracht*) | `CalendarGeneration.generatedFromYear/ToYear` (`types/calendar.ts:44-45`) begrenst de gematerialiseerde feestdagen. `computeGenerateSpan` (`generateCalendarHolidays.ts:61`) geeft zonder einddatum `startYear-1 … startYear+3`. Verplaats je 4 jaar vooruit, dan **rekent de planning stil zonder feestdagen** in de nieuwe periode. | **Preview-waarschuwing verplicht:** vergelijk `[nieuwe startjaar, nieuwe eindjaar]` met `generation.generatedFromYear/ToYear` van `s.calendar` én van elke gebruikte bibliotheek-kalender; bij onvoldoende dekking: "De gegenereerde feestdagen van kalender '{{name}}' dekken {{from}}–{{to}}; de verplaatste planning loopt tot {{year}}. Genereer de feestdagen opnieuw via Kalender → Feestdagen." Alleen relevant als `generation` aanwezig is (handmatige kalenders overslaan). |
| **R8** | **Δ = 0** (nieuwe datum = huidige) | Volledige no-op. | Guard vóór `beginUndoable` ⇒ geen loze undo-stap, geen `isDirty`. Dialoog disable't de Toepassen-knop. |
| **R9** | **Ongeldige/lege `project.startDate`** (corrupte import) | `diffDays` zou `NaN` geven. | Guard: bij `!project.startDate` of niet-parseerbaar ⇒ actie is een no-op en het dialoog toont `moveProject.invalidCurrentStart`. |
| **R10** | **Shift landt een anker op een weekend/feestdag** | `scheduleStart` wordt bv. een zaterdag; `snapOnOrAfter` in de forward pass tilt hem naar maandag (`CPMSolver.ts:520`). De *opgeslagen* `scheduleStart` blijft de zaterdag. | Geen code nodig; **wel** een testcase (`move-03`) die dit vastlegt, want het is het meest verrassende zichtbare gedrag: "ik schoof 5 dagen, de balk schoof 7". |
| **R11** | **Meerdere geopende documenten** | Alleen het actieve document verschuift (single-active-model). | Dialoogtitel/knoptekst benoemt het project bij naam zodat er geen twijfel is over welk tabblad verschuift. |

---

## 4. IFC-round-trip-impact

**Verdict: geen datamodel-wijziging, alleen gewijzigde waarden in bestaande velden. Geen
reader/writer-aanpassing nodig.**

Onderbouwing per geraakt veld:
- `project.startDate`/`endDate` round-trippen al via `IfcWorkPlan` — schrijven `ifcWriter.ts:149-150`,
  lezen `ifcReader.ts:262-263`.
- `constraint.date`, `constraint2.date`, `deadline`, `actualStart/Finish`, `statusDate`,
  `externalLinks[].anchorDate`, `availabilitySteps[].from` en de baseline-velden zijn allemaal
  bestaande, al round-trippende velden (`OPS_`-psets / `ifcPsets.ts`). Er komt geen veld bij, geen
  veld weg, geen typewijziging.
- De **niet**-geschoven velden (feestdagen `ifcWriter.ts:519-521`, `GeneratedFromYear`
  `ifcWriter.ts:559`) blijven byte-identiek — dat is precies de bedoeling.

**Eén aandachtspunt:** `ifcWriter.ts:147-150` leidt `planStart`/`planEnd` af uit
`min(task.scheduleStart)`/`max(task.scheduleFinish)` en gebruikt `project.startDate` slechts als
*fallback*. Omdat §1.2 `scheduleStart` én `scheduleFinish` in de MEE-lijst zet, blijft die afleiding
consistent. Zou je alleen `scheduleStart` schuiven (en `scheduleFinish` aan `runCPM` overlaten), dan
zou een opslaan-vóór-herberekenen een IFC met een inconsistente `planEnd` schrijven. **Dit is de
belangrijkste reden dat `scheduleFinish` in de MEE-lijst staat.**

**Aanvullend advies:** `moveProject` roept aan het eind `runCPM()` aan (design-besluit 5), dus de
opgeslagen state is altijd vers. Voeg één regressiecheck toe aan de round-trip-verificatie:
verplaats een voorbeeldbestand, sla op, herlaad, en vergelijk `project.startDate` +
`tasks[].time.scheduleStart` — die moeten identiek terugkomen.

---

## 5. Implementatieplan — state

### 5.1 De undo-snapshot moet worden verbreed (KRITIEK — doe dit eerst)

`src/state/snapshot.ts:35-43` bewaart uit `project` alleen `wbsAutoNumber`, met een uitvoerig
gedocumenteerde reden (de "B3-uitzondering": `setProject`/`setStatusDate`/`setProgressMode`/
`setProjectCalendar` muteren `project` **bewust zonder snapshot**, dus zou de snapshot heel `project`
bevatten, dan draaide een undo van een ongerelateerde taakbewerking ook een later gezette statusdatum
terug).

`moveProject` is de **eerste** actie die project-datums als deel van een undoable transactie muteert.
Zonder ingreep: undo herstelt de taken naar hun oude datums maar laat `project.startDate` op de
nieuwe waarde ⇒ het document is inconsistent en `runCPM` levert daarna een andere planning.

**Besluit: verbreed de projectie naar `Pick<Project, 'wbsAutoNumber' | 'startDate' | 'endDate' | 'statusDate'>`, altijd gevangen en altijd hersteld.**

```ts
// src/state/snapshot.ts
export interface Snapshot extends Pick<DocumentPayload, /* ...ongewijzigd... */> {
  /** B3-fix + moveProject (pakket D1): wbsAutoNumber plus de drie project-DATUMS die
   *  `moveProject` als één undo-stap muteert. */
  project: Pick<Project, 'wbsAutoNumber' | 'startDate' | 'endDate' | 'statusDate'>;
}
```
- `createSnapshot` (regel 65): projectie uitbreiden.
- `restoreSnapshot` (regel 117): de drie extra velden terugzetten; `statusDate` met een
  `undefined`-bewuste zet (`if (v === undefined) delete s.project.statusDate; else s.project.statusDate = v;`)
  zodat "geen statusdatum" herstelbaar blijft — spiegelt `setStatusDate` (`projectSlice.ts:145-146`).
- `migrateSnapshot` (regel 100): `project: raw.project` blijft passthrough; de guard in
  `restoreSnapshot` dekt een projectie-loze legacy-snapshot al af.

**Kosten van deze keuze, eerlijk benoemd:** de B3-zorg wordt breder. Concreet scenario: undo je
*voorbij* een `setStatusDate` heen (taakbewerking → statusdatum wijzigen → undo), dan wordt de
statusdatum nu óók teruggezet naar de waarde van vóór de taakbewerking. Dat is een gedragswijziging
in een randgeval. Ik acht dat acceptabel en zelfs verdedigbaar (undo die de state naar een echt
eerder punt terugbrengt is minder verrassend dan undo die een half-gemengde state achterlaat), maar
het is een bewuste ruil die de bouwer in de commit-boodschap moet noemen.

**Overwogen en verworpen alternatief:** een optioneel `projectDates?`-veld dat alleen `moveProject`
op de zojuist gepushte snapshot zet. Dat werkt voor undo maar **breekt bij redo**: `historySlice.redo`
(`historySlice.ts:26-27`) pusht een verse `createSnapshot(s)` die het optionele veld niet zou dragen,
dus een redo van een verplaatsing zou de taken wél en de projectdatums niet terugzetten. Asymmetrisch
en subtiel fout ⇒ verworpen.

### 5.2 Nieuwe pure module: `src/engine/moveProject.ts`

Volgt het precedent van `src/engine/externalLinks.ts` (pure domeintransformatie, geen store-import,
op engine-topniveau). Gedeeld door de preview én de commit, zodat die twee per constructie niet
kunnen divergeren.

```ts
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import { parseInstant, formatInstant, addCalendarDays, diffDays, type DateMode } from '@/utils/dateUtils';

export interface MoveProjectOptions {
  /** Baselines mee verschuiven. Default false (zie §1.6). */
  shiftBaselines?: boolean;
}

/** Δ in kalenderdagen; NaN bij een onparseerbare huidige/nieuwe startdatum (R9). */
export function computeMoveDelta(currentStart: string, newStart: string): number;

/** Vormbehoudende shift van één ISO-waarde (§2). Leeg/ongeldig ⇒ onveranderd terug. */
export function shiftIso(iso: string, deltaDays: number): string;

/** Puur: geeft NIEUWE objecten terug; muteert niets. */
export function shiftTask(task: Task, deltaDays: number): Task;
export function shiftProjectDates(project: Project, deltaDays: number): Project;
export function shiftResource(resource: Resource, deltaDays: number): Resource;
export function shiftBaseline(baseline: Baseline, deltaDays: number): Baseline;

/** Telling voor de preview-waarschuwingen (§7.4). Puur, geen solve. */
export interface MoveImpact {
  taskCount: number;              // taken met minstens één verschoven datum
  constraintCount: number;        // taken met constraint/constraint2-datum
  hardPinCount: number;           // constraint.hard === true (R4)
  deadlineCount: number;
  actualCount: number;            // taken met actualStart/actualFinish (R5)
  externalLinkCount: number;      // (R6)
  availabilityStepCount: number;
  dateCustomFieldCount: number;   // NIET verschoven (§1.7)
  baselineCount: number;
}
export function computeMoveImpact(tasks: Task[], resources: Resource[], /* … */): MoveImpact;
```

`shiftTask` moet **elke** MEE-cel uit §1.2 raken: `time.scheduleStart`, `time.scheduleFinish`,
`time.actualStart`, `time.actualFinish`, `constraint.date`, `constraint2.date`, `deadline`,
`externalLinks[].anchorDate`. De AFGELEIDE velden laat hij ongemoeid (`runCPM` overschrijft ze).

### 5.3 De store-actie — `src/state/slices/projectSlice.ts`

**Waarom `projectSlice`:** de actie is verankerd op `project.startDate` en `projectSlice` is al de
eigenaar van de project-brede datumsemantiek (`setProject`, `setStatusDate`). Dat hij ook `tasks`,
`resources` en `baselines` muteert is geen bezwaar — elke slice is getypeerd tegen de volledige
`AppState` juist om cross-slice-acties toe te staan (`slices/types.ts:10`), en `projectSlice` doet dat
al (`createNewProject` schrijft `payload.tasks`).

```ts
export interface MoveProjectResult {
  moved: boolean;         // false bij Δ=0 of ongeldige datum (R8/R9)
  deltaDays: number;
  taskCount: number;
}

export interface MoveProjectPreview {
  deltaDays: number;
  startBefore: string;  startAfter: string;
  endBefore: string;    endAfter: string;      // '' als er geen taken zijn (R3)
  durationBefore: number; durationAfter: number; // werkdagen, uit CPMResult.projectDuration
  /** Kalender-dagen die het EINDE opschuift; ≠ deltaDays ⇒ de kalender heeft ingegrepen. */
  endDeltaDays: number;
  impact: MoveImpact;
  /** Kalenders waarvan de gegenereerde feestdagen de nieuwe periode niet dekken (R7). */
  holidayGapCalendars: { name: string; from: number; to: number }[];
  error?: string;        // solver-fout in de droogrun (cyclus e.d.)
}

// In ProjectSlice:
/** Verschuif de HELE planning zodat het project op `newStartDate` begint (§D1).
 *  Δ = kalenderdagen tussen de huidige en de nieuwe projectstart; kalenders schuiven NIET mee,
 *  dus einddatums kunnen verspringen. Eén undo-stap; draait aansluitend runCPM + fit. */
moveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectResult;

/** Droogrun van `moveProject`: rekent de verschoven planning volledig door met een verse
 *  `CPMSolver` en geeft het resultaat terug ZONDER de store te muteren (levelResources-precedent). */
previewMoveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectPreview;
```

Implementatieskelet van de commit — let op de volgorde, die spiegelt `applyLeveling`
(`scheduleSlice.ts:197-211`):

```ts
moveProject: (newStartDate, opts) => {
  let out: MoveProjectResult = { moved: false, deltaDays: 0, taskCount: 0 };
  set((s) => {
    const delta = computeMoveDelta(s.project.startDate, newStartDate);
    if (!Number.isFinite(delta) || delta === 0) return;   // R8/R9 — vóór beginUndoable!
    beginUndoable(s);                                     // §5.1-verbrede snapshot
    s.project = shiftProjectDates(s.project, delta);
    s.project.startDate = newStartDate;                   // exact, niet via Δ (geen afrondingsdrift)
    s.project.modifiedAt = new Date().toISOString();
    s.tasks = s.tasks.map((t) => shiftTask(t, delta));
    s.resources = s.resources.map((r) => shiftResource(r, delta));
    if (opts?.shiftBaselines) s.baselines = s.baselines.map((b) => shiftBaseline(b, delta));
    finishMutation(s);   // GEEN { stale: true } — de runCPM hieronder wist scheduleStale zelf
                         // (precedent: applyLeveling, scheduleSlice.ts:208)
    out = { moved: true, deltaDays: delta, taskCount: s.tasks.length };
  });
  if (out.moved) {
    get().runCPM();                  // design-besluit 5
    get().requestFitToProject();     // §1.8 — het verplaatste project in beeld
    emitExtensionEvent(HOST_EVENTS.projectMoved, { deltaDays: out.deltaDays });  // optioneel, zie noot
  }
  return out;
},
```

*Noot bij het extensie-event:* `HOST_EVENTS` bestaat al (`src/services/extensionEvents.ts`); een
nieuw event is additief maar niet noodzakelijk voor deze golf. Laat het weg als het de golf opblaast.

`previewMoveProject` mag **niets** muteren:

```ts
previewMoveProject: (newStartDate, opts) => {
  const s = get();
  const delta = computeMoveDelta(s.project.startDate, newStartDate);
  const shifted = s.tasks.map((t) => shiftTask(t, delta));
  const leaf = shifted.filter((t) => t.childIds.length === 0);
  const solver = new CPMSolver(leaf, s.sequences, s.calendar, s.calendars, {
    dataDate: shiftIso(s.project.statusDate ?? '', delta) || undefined,
    progressMode: s.project.progressMode,
    schedulingOptions: s.project.schedulingOptions,
  });
  const after = solver.solve();
  // 'before' komt uit s.cpmResult als die vers is; anders één extra solve op de ongewijzigde taken.
  …
}
```

Let op: `shiftTask` geeft nieuwe objecten terug, maar `CPMSolver` **schrijft** in de hammock-tak
`task.time.scheduleDuration`/`durationMinutes` terug op het meegegeven object (`CPMSolver.ts:511-515`).
Omdat `shiftTask` per taak een nieuw object levert (inclusief een nieuw `time`-object) raakt dat de
store-objecten niet — **maar dat moet expliciet zijn**: `shiftTask` moet `time` altijd kopiëren, ook
als er niets aan verandert. Zet dat als comment in de code, anders sloopt een latere "optimalisatie"
(referentie hergebruiken als er geen datum wijzigt) de preview-zuiverheid.

### 5.4 UI-vlag

- `src/state/slices/types.ts` → `UIState`: `showMoveProjectDialog: boolean; // session`
  (bij de andere session-dialoogvlaggen, rond regel 146-157).
- `src/state/slices/uiSlice.ts`: default `false` in de initiële `ui`-literal. **Niet persisteren**
  (session-vlag, zoals `showLevelingDialog`/`showBaselineDialog`).

---

## 6. Implementatieplan — UI

### 6.1 Dialoogbestand

**`src/components/dialogs/MoveProjectDialog.tsx`** — nieuw.

**Modelleren op: `src/components/dialogs/LevelingDialog.tsx`.** Dat is het enige bestaande dialoog met
exact dezelfde vorm: *opties → expliciet Berekenen → preview van een puur (niet-muterend)
rekenresultaat → Toepassen/Annuleren*. Neem daaruit letterlijk over:
- de `Dialog`-wrapper uit `@/components/common/Dialog` met `onBackdropClick`/`onCancel`
  (`LevelingDialog.tsx:112-116`);
- de header met titel + `X`-knop (`:117-124`);
- het `const [result, setResult] = useState<…|null>(null)` + "elke optiewijziging zet `result` op
  `null`"-patroon (`:45-52`), zodat er nooit een preview van andere opties zichtbaar is;
- de knoppenbalk onderaan met Toepassen disabled zolang `!result`.

Neem **niet** over: de resource-selectielijst en de conflict-secties (niet van toepassing).

Panelbreedte: `w-[560px]` (BaselineDialog-formaat) volstaat — dit is een klein dialoog, geen wizard
(design-besluit 6). Gebruik `displayDate(iso, ui.dateNotation)` uit `@/utils/displayDate` voor élke
getoonde datum (BaselineDialog-precedent, `:30`) — niet de lokale `fmt`-helper van LevelingDialog,
die de gebruikersnotatie negeert.

**Mount:** `src/App.tsx`, naast de andere vlag-gestuurde dialogen (import bij regel ~26, render bij
regel ~324): `{showMoveProjectDialog && <MoveProjectDialog />}`.

### 6.2 Dialoog-inhoud (van boven naar beneden)

1. **Huidige projectstart** — read-only regel.
2. **Nieuwe projectstart** — `<input type="date">`; gebruik het bestaande datum-invoercomponent als
   dat er is (`common:dateInput`-sleutels bestaan al in `common.json`).
3. **Δ-regel** — "Verschuiving: {{days}} kalenderdagen" (of "… terug" bij negatief).
4. **Checkbox "Baselines mee verschuiven"** — default uit, alleen zichtbaar bij `baselines.length > 0`.
5. **Knop "Voorbeeld berekenen"** → `previewMoveProject(...)`.
6. **Previewblok** (§7).
7. **Knoppenbalk**: Annuleren · Verplaatsen (disabled tot er een preview is en `deltaDays !== 0`).

### 6.3 Ribbon-ingang

**Tab `planning`, groep `schedule`** — `src/components/layout/Ribbon/ribbonConfig.tsx:291`:
```ts
{ id: 'schedule', labelKey: 'menu:ribbon.schedule', items: [calcButton] },
```
Die groep gaat over de planning als geheel (nu alleen de Bereken-knop) en is de enige logische plek:
"Project verplaatsen" is een schema-brede operatie, geen structuur-, kalender- of baseline-actie.
Voeg een tweede item toe:

```ts
{
  kind: 'button', id: 'moveProject', icon: <CalendarArrowRight size={20} />,   // lucide-react
  labelKey: 'menu:ribbon.moveProject',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasStart = useAppStore(s => !!s.project.startDate);
    return { onClick: () => setUI({ showMoveProjectDialog: true }), disabled: !hasStart };
  },
},
```

*(Controleer of `CalendarArrowRight` in de geïnstalleerde `lucide-react`-versie bestaat; zo niet:
`CalendarClock` of `MoveHorizontal`. Ik heb dat in deze sessie **niet** geverifieerd.)*

Optioneel, als het zonder extra werk kan: dezelfde actie ook in **Backstage → Projectinfo**
(`src/components/backstage/Backstage.tsx:398-399` bewerkt daar al `startDate`/`endDate`). Niet
verplicht voor deze golf. De drie-oppervlakken-regel uit `CLAUDE.md` geldt voor **instellingen**, niet
voor acties — dus één ribbon-ingang is voldoende.

---

## 7. De preview

### 7.1 Beslissing: echte droogrun-CPM, geen goedkope schatting

**Eén beslissing: de preview draait een volwaardige `CPMSolver.solve()` op een verschoven kloon.**

Onderbouwing: het hele bestaansrecht van de preview is design-besluit 2 — laten zien dát de einddatum
verspringt omdat de kalender niet meeschuift. Een goedkope schatting kan per definitie alleen
"oude einddatum + Δ" opleveren, en dát is precies het antwoord dat fout is. Een schatting zou de
preview van een waarschuwing in een leugen veranderen.

Kosten: één (of twee) extra solve. Dat is verwaarloosbaar en volledig in lijn met bestaand gedrag —
`LevelingDialog` draait interactief een héle nivelleer-simulatie (die zelf meerdere CPM-passes doet)
op één knopdruk. De preview is bovendien **expliciet** (knop "Voorbeeld berekenen"), niet live-op-elke-
toetsaanslag, dus er is geen typ-latentie.

De "voor"-waarden komen uit `s.cpmResult` als die vers is (`!scheduleStale && !cpmResult.error`);
anders draait de preview een tweede solve op de ongewijzigde taken, zodat "voor" en "na" gegarandeerd
met dezelfde motor en dezelfde opties gemeten zijn.

### 7.2 Wat de preview toont

| Regel | Bron |
|---|---|
| Projectstart: `startBefore` → `startAfter` | `project.startDate` / `newStartDate` |
| Projecteinde: `endBefore` → `endAfter` | `cpmResult.projectEnd` (voor) / droogrun `projectEnd` (na) |
| Projectduur: `durationBefore` → `durationAfter` werkdagen | `CPMResult.projectDuration` |
| "{{count}} taken verschoven" | `tasks.length` (leaf + samenvatting; alle taken schuiven) |
| Meeverschoven-opsomming | `MoveImpact`: N constraint-datums, N deadlines, N werkelijke datums, N externe ankers, N capaciteitsstappen |

### 7.3 De kalender-waarschuwing (verplicht, het hart van de preview)

Bereken `endDeltaDays = diffDays(endBefore, endAfter)`.

- `endDeltaDays === deltaDays` **én** `durationBefore === durationAfter` ⇒ groene/neutrale regel:
  "De projectduur blijft {{days}} werkdagen."
- anders ⇒ **prominente waarschuwing**:
  "Let op: het projecteinde verschuift {{endDays}} kalenderdagen in plaats van {{days}} — de kalender
  (feestdagen, bouwvak, winterstop) schuift niet mee. De projectduur gaat van {{before}} naar
  {{after}} werkdagen."

Dit is de enige plek in de app waar design-besluit 2 zichtbaar wordt; maak hem visueel opvallend
(waarschuwingskleur), niet een grijze voetnoot.

### 7.4 Overige waarschuwingen in de preview

| Conditie | Tekstsleutel |
|---|---|
| `impact.actualCount > 0` | `moveProject.warnActuals` (R5) |
| `impact.hardPinCount > 0` | `moveProject.warnHardPins` (R4) |
| `impact.externalLinkCount > 0` | `moveProject.warnExternal` (R6) |
| `holidayGapCalendars.length > 0` | `moveProject.warnHolidayGap` (R7) |
| `impact.dateCustomFieldCount > 0` | `moveProject.warnCustomDateFields` (§1.7) |
| `newStartDate < vandaag` | `moveProject.warnPast` (R1) |
| `tasks.length === 0` | `moveProject.noTasks` (R3) |
| droogrun `error` gezet (cyclus) | toon de fout, disable Verplaatsen |

---

## 8. i18n-sleutels

Twee namespaces. Alleen **NL** (canoniek) en **EN** (fallback, `i18n/config.ts`) in deze golf; de
andere twaalf talen zijn een aparte stap (precedent: `docs/TODO.md:261`).

### `menu.json` → `ribbon.*`

| Sleutel | NL | EN |
|---|---|---|
| `ribbon.moveProject` | Project verplaatsen… | Move project… |
| `ribbon.moveProjectTitle` | Hele planning naar een nieuwe startdatum verschuiven | Shift the entire schedule to a new start date |

### `common.json` → nieuw top-level blok `moveProject`

| Sleutel | NL | EN |
|---|---|---|
| `moveProject.title` | Project verplaatsen | Move project |
| `moveProject.currentStart` | Huidige projectstart | Current project start |
| `moveProject.newStart` | Nieuwe projectstart | New project start |
| `moveProject.delta` | Verschuiving: {{days}} kalenderdagen vooruit | Shift: {{days}} calendar days later |
| `moveProject.deltaBack` | Verschuiving: {{days}} kalenderdagen terug | Shift: {{days}} calendar days earlier |
| `moveProject.deltaZero` | De nieuwe startdatum is gelijk aan de huidige. | The new start date is the same as the current one. |
| `moveProject.shiftBaselines` | Baselines mee verschuiven | Shift baselines too |
| `moveProject.shiftBaselinesHint` | Uit: baselines blijven staan, zodat de verschuiving als afwijking zichtbaar blijft. | Off: baselines stay in place, so the shift shows up as variance. |
| `moveProject.calculate` | Voorbeeld berekenen | Calculate preview |
| `moveProject.previewTitle` | Voorbeeld | Preview |
| `moveProject.startRow` | Projectstart: {{before}} → {{after}} | Project start: {{before}} → {{after}} |
| `moveProject.endRow` | Projecteinde: {{before}} → {{after}} | Project finish: {{before}} → {{after}} |
| `moveProject.durationUnchanged` | De projectduur blijft {{days}} werkdagen. | Project duration stays {{days}} working days. |
| `moveProject.durationChanged` | Let op: het projecteinde verschuift {{endDays}} kalenderdagen in plaats van {{days}} — de kalender (feestdagen, bouwvak, winterstop) schuift niet mee. De projectduur gaat van {{before}} naar {{after}} werkdagen. | Note: the project finish moves {{endDays}} calendar days instead of {{days}} — the calendar (holidays, construction breaks) does not shift. Project duration changes from {{before}} to {{after}} working days. |
| `moveProject.affectedTasks` | {{count}} taken verschoven | {{count}} tasks shifted |
| `moveProject.affectedDetail` | Meeverschoven: {{constraints}} constraint-datums, {{deadlines}} deadlines, {{actuals}} werkelijke datums, {{external}} externe ankers, {{steps}} capaciteitsstappen | Also shifted: {{constraints}} constraint dates, {{deadlines}} deadlines, {{actuals}} actual dates, {{external}} external anchors, {{steps}} availability steps |
| `moveProject.warnActuals` | {{count}} taken hebben werkelijke start-/einddatums; die verschuiven mee. Controleer of dat klopt voor een lopend project. | {{count}} tasks have actual start/finish dates; these shift along. Check whether that is correct for a running project. |
| `moveProject.warnHardPins` | {{count}} taken hebben een harde Mandatory-pin; die pin verschuift mee. | {{count}} tasks have a hard Mandatory pin; that pin shifts along. |
| `moveProject.warnExternal` | {{count}} externe koppelingen: hun anker verschuift mee, maar het bronproject niet. Ververs de koppelingen na het verplaatsen. | {{count}} external links: their anchor shifts along, but the source project does not. Refresh the links after moving. |
| `moveProject.warnHolidayGap` | De gegenereerde feestdagen van kalender "{{name}}" dekken {{from}}–{{to}}; de verplaatste planning loopt tot {{year}}. Genereer de feestdagen opnieuw. | The generated holidays of calendar "{{name}}" cover {{from}}–{{to}}; the shifted schedule runs to {{year}}. Regenerate the holidays. |
| `moveProject.warnCustomDateFields` | {{count}} ingevulde datum-gebruikersvelden blijven op hun datum staan. | {{count}} filled-in custom date fields keep their date. |
| `moveProject.warnPast` | De nieuwe startdatum ligt in het verleden. | The new start date is in the past. |
| `moveProject.noTasks` | Dit project heeft nog geen taken; alleen de projectdatums verschuiven. | This project has no tasks yet; only the project dates shift. |
| `moveProject.invalidDate` | Kies een geldige datum. | Choose a valid date. |
| `moveProject.invalidCurrentStart` | Het project heeft geen geldige startdatum; stel die eerst in bij Projectinfo. | The project has no valid start date; set it first in Project info. |
| `moveProject.apply` | Verplaatsen | Move |
| `moveProject.calcError` | De planning kon niet worden doorgerekend: {{error}} | The schedule could not be calculated: {{error}} |

---

## 9. Tests — `tests/planning/`

### 9.1 Benodigde harness-uitbreidingen (klein)

`tests/planning/harness.ts` ondersteunt al `afterCPM`-operaties (`AfterOp`, regel 206-216) en
`{ undo: true }`. Voeg toe:

1. **`AfterOp`-variant** `{ moveProject: { newStart: string; shiftBaselines?: boolean } }` → roept
   `S().moveProject(op.moveProject.newStart, { shiftBaselines: !!op.moveProject.shiftBaselines })`
   aan. (`moveProject` draait zelf al `runCPM`, dus een navolgende `{runCPM:true}` is optioneel.)
2. **`expect.projectStartDate?: string`** → assert `S().project.startDate` (nodig voor `move-07` en
   `move-12`).
3. *(alleen voor `move-13`)* baseline-ondersteuning: `AfterOp` `{ saveBaseline: { name } }` +
   `expect.baselineTasks?: Record<taakNaam, {start, finish}>`. **Als dit te veel is voor deze golf:
   laat `move-13` vallen uit de suite en verifieer de baseline-keuze handmatig via de self-test-
   harness (`window.__OPS__.store`). Meld dat dan expliciet in het PR-verslag — niet stilzwijgend
   overslaan.**

Nieuw bestand: **`tests/planning/cases-move-project.json`**, en toevoegen aan de batterijentabel in
`tests/planning/README.md`.

### 9.2 Concrete testgevallen

Basisnet voor de meeste cases: `A` (5 werkdagen) → FS → `B` (3 werkdagen), anker `2026-06-01` (ma),
schone kalender (ma–vr, geen feestdagen). Zonder shift: A 06-01→06-05, B 06-08→06-10, `projectEnd`
06-10, `projectDuration` 8. Werkdagen nagerekend met de tabel in `tests/planning/BRIEF.md`.

| id | Wat het vastlegt | Opzet | Verwacht |
|---|---|---|---|
| `move-01` | Basisverschuiving met een veelvoud van 7 ⇒ identieke vorm | `moveProject 2026-06-08` (Δ=+7) | A 06-08→06-12, B 06-15→06-17, `projectEnd` 06-17, `projectDuration` 8, `projectStartDate` 2026-06-08 |
| `move-02` | Δ géén veelvoud van 7 ⇒ weekdagen verschuiven, duur blijft | `moveProject 2026-06-03` (Δ=+2, wo) | A 06-03→06-09, B 06-10→06-12, `projectDuration` 8 |
| `move-03` | **Shift-dan-snap** (R10): anker landt op zaterdag | `moveProject 2026-06-06` (za, Δ=+5) | A 06-08→06-12 (gesnapt naar ma), B 06-15→06-17, `projectDuration` 8. *Differentieel t.o.v. `move-01`: zelfde uitkomst bij een andere Δ — dat is het punt.* |
| `move-04` | Shift naar het verleden (R1) | `moveProject 2026-05-25` (Δ=−7) | A 05-25→05-29, B 06-01→06-03, `projectDuration` 8, geen `truncatedLeadSet` |
| `move-05` | **Kerncase: kalender schuift niet mee** (besluit 2) | Kalender met feestdagenrange 2026-06-22 … 2026-06-26; `moveProject 2026-06-22` (Δ=+21) | A 06-29→07-03 (start gesnapt over de bouwvakweek), B 07-06→07-08, `projectEnd` 2026-07-08. **Het einde schuift 28 kalenderdagen terwijl Δ=21.** `projectDuration` blijft 8. |
| `move-06` | Jaargrens (R2) | Feestdagenrange 2026-12-25 … 2027-01-01; `moveProject 2026-12-21` (ma) | A 2026-12-21→2027-01-04, B 2027-01-05→2027-01-07, `projectDuration` 8 |
| `move-07` | Leeg project (R3) | Geen taken; `moveProject 2027-03-01` | `expect.error: false`, `projectEnd: ''`, `projectStartDate: 2027-03-01` |
| `move-08` | Constraint + deadline schuiven mee | A met `constraint {SNET, 2026-06-08}` en `deadline 2026-06-20`; `moveProject +7` (→06-08) | A es 06-15, ef 06-19; `missedDeadlinesSet: []` (deadline nu 06-27). *Differentieel: zonder deadline-shift zou A de deadline missen.* |
| `move-09` | Harde Mandatory-pin (R4) | B met `constraint {MSO, 2026-06-15, hard:true}`; `moveProject 2026-06-08` (Δ=+7) | B es 2026-06-22, `tf` 0 op B |
| `move-10` | Extern anker schuift mee (R6) | A met `externalLinks:[{direction:'predecessor', relType:'FS', anchorDate:'2026-06-05'}]`; `moveProject +7` | anker 06-12 (vr) ⇒ A es 2026-06-15; `sourceMissing` blijft `false` |
| `move-11` | Statusdatum + actuals (R5) | `statusDate 2026-06-03`, A `actualStart 2026-06-01`, `completion 0.4`; `moveProject +14` (→06-15) | `statusDate` 06-17, A actualStart 06-15, en het restwerk van A start niet vóór 06-17 (structurele assertie: `B.es >= 2026-06-17`) |
| `move-12` | **Eén undo-stap, inclusief projectdatums** (§5.1) | `afterCPM: [{moveProject:{newStart:'2026-06-08'}}, {undo:true}, {runCPM:true}]` | A 06-01→06-05, B 06-08→06-10, `projectEnd` 06-10 **én** `projectStartDate: 2026-06-01`. *Dit is de case die de snapshot-uitbreiding bewaakt; zonder §5.1 faalt hij op `projectStartDate`.* |
| `move-13` | Baselines standaard NIET mee (§1.6) | `saveBaseline`, dan `moveProject +7` zonder `shiftBaselines` | baseline-taak A blijft `start 2026-06-01`, `finish 2026-06-05`. *(Vereist harness-uitbreiding 3 — zie §9.1.)* |
| `move-14` | **Uur-modus: tijdstip-op-de-dag behouden** (§2) | Uur-kalender (`workTime`-banden), A `dur "4u"` startend 2026-07-06T08:00; `moveProject 2026-07-13` (Δ=+7) | A es exact `"2026-07-13T08:00"` (string-gelijkheid). *Differentieel: bij "snap naar eerstvolgende werkmoment" zou een andere HH:mm ontstaan.* |
| `move-15` | Δ=0 is een no-op (R8) | `afterCPM: [{moveProject:{newStart:'2026-06-01'}}, {undo:true}]` | Datums ongewijzigd; de `undo` mag géén eerdere echte mutatie terugdraaien (geen loze undo-stap gepusht) |

**Anti-circulariteitsregel van de suite blijft gelden:** reken elke verwachte datum met de hand na met
de werkdag-tabel in `BRIEF.md` en `caldict.mjs`, niet uit de solver.

**Let op bij het draaien in een worktree:** `tests/planning/run.sh` faalt met exit 127 in een worktree
omdat het `$ROOT/node_modules/.bin/esbuild` hardcodeert; symlink de esbuild van de hoofdcheckout erin.

### 9.3 Verificatie buiten de suite

Naast `bash tests/planning/run.sh`:
- `npm run build` (tsc-strict; `noUnusedLocals`/`noUnusedParameters` vangen dode helpers).
- Self-test via de browser-dev-build + `window.__OPS__.store` (`docs/self-test-harness.md`):
  open een voorbeeldproject, verplaats het, controleer `project.startDate`, een verschoven
  `constraint.date` en dat `view` netjes op het project fit; daarna `undo()` en verifieer dat
  `project.startDate` terug is.
- IFC-round-trip (§4): verplaatsen → opslaan → herladen → `project.startDate` en
  `tasks[].time.scheduleStart` vergelijken.

---

## 10. Golf-volgorde voor de bouwende agent

1. **`src/state/snapshot.ts`** — projectie verbreden (§5.1). Draai daarna `tests/planning/run.sh`:
   moet groen blijven (er is nog geen actie die project-datums undoable muteert).
2. **`src/engine/moveProject.ts`** — pure helpers + `MoveImpact` (§5.2), met de
   volledigheids-assertie uit §1.11.
3. **`projectSlice.moveProject` + `previewMoveProject`** (§5.3) en de UI-vlag (§5.4).
4. **Harness-uitbreidingen + `cases-move-project.json`** (§9) — schrijf de cases vóór het dialoog;
   dan is de store-laag bewezen voordat er UI overheen komt.
5. **`MoveProjectDialog.tsx`** + mount in `App.tsx` + ribbon-item (§6).
6. **i18n NL + EN** (§8).
7. **Verificatie** (§9.3) en `docs/CHANGELOG.md` + afvinken in `docs/TODO.md:40`.

---

## 11. Wat ik NIET heb kunnen verifiëren (eerlijk gemarkeerd)

- Het bestaan van het lucide-icoon `CalendarArrowRight` in de geïnstalleerde versie (§6.3).
- Of `tests/planning/run.sh` in déze worktree draait — ik heb hem bewust **niet** uitgevoerd (de
  opdracht is strikt read-only en er werken twee andere agents in dezelfde tree). Het bekende
  esbuild-symlinkprobleem in worktrees is uit projectgeheugen, niet uit een run in deze sessie.
- De exacte visuele vorm van het `Dialog`-component (`@/components/common/Dialog`) — ik heb alleen
  het gebruik ervan in `BaselineDialog`/`LevelingDialog` gelezen, niet de implementatie.
- Alle verwachte datums in §9.2 zijn met de hand nagerekend uit de werkdagtabel in `BRIEF.md`; ze
  zijn **niet** tegen de solver gedraaid (dat is per suite-conventie ook de bedoeling), dus behandel
  ze als hypothesen die de eerste run mag falsificeren — een afwijking is dan een bevinding, geen
  automatische testfout.
