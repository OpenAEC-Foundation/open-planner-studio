# Verkenningsdossier — overname PR #101 (taaktypes: werkregels en opgeslagen werk)

*Verkenning 2026-09-24, door `uitvoerder-opus-midden` (Claude Opus 5.5). Alleen gelezen en gemeten:
er is niets gebouwd, gemerged of gecommit. Gemeten op de PR-kop `c5fca94a` (2026-09-06) in een
losse detached worktree; vergeleken met de #169-kop `origin/claude/rekenprofielen` zoals gefetcht op
24-09. Labels: **[BEVESTIGD]** = zelf gelezen of gedraaid, **[VERMOED]** = afgeleid, niet gemeten.*

## 1. In gewone woorden

PR #101 leert Open Planner Studio wat MS Project en Primavera al kunnen: per taak kiezen wat vast
blijft als je iets verandert — de duur, het werk (manuren) of de inzet. Vandaag rekent de app altijd
"werk = duur × inzet" terug; met deze PR wordt werk een echt, opgeslagen getal en krijgt elke taak een
*werkregel*, die uit MS Project- en P6-bestanden wordt overgenomen. De berekening van de planning
(CPM) zelf verandert niet; alleen wat er gebeurt als je iets bewerkt.

De overname is **middelzwaar tot zwaar**: 105 bestanden, 29 conflictbestanden, waarvan er vijf echt
nadenkwerk vragen (taak-, resource-, raster- en MCP-bewerkpaden en `taskDefaults.ts`). De grootste
inhoudelijke botsing is dat #101 de duur van een taak gaat veranderen vanuit plekken waar #169
(B1) er juist op rekent dat de duur daar níét verandert. De meetlat (X12 en `.mpp`-fidelity) loopt
naar verwachting geen risico: #101 raakt de invoer van de rekenmotor niet — dat is gemeten en per
codepad nagelopen (§4).

## 2. Inhoud van de PR, per baan

Stand van de PR [BEVESTIGD]: 19 commits bovenop de #109-branch van 06-09 (spec, stap 3, 1, 2, 4, 7, 5,
docs, drie reviewrondes, eigenaarsbesluiten K2/Δ-rest en F4). Merge-base met #169: `e1915758`
(05-09). Diff t.o.v. #109: 105 bestanden, +6197 −220.

### Baan A — Datamodel en persistentie (bouwstap 1)

- **Bestanden:** `src/types/workRule.ts` (nieuw: `WorkRule`, `WORK_RULES`, `DEFAULT_WORK_RULE`),
  `src/types/task.ts` (`Task.workRule?`), `src/types/project.ts` (`Project.defaultWorkRule?`),
  `src/types/resource.ts` (`plannedWorkMinutes?`/`actualWorkMinutes?`/`remainingWorkMinutes?` op
  `ResourceAssignment`), `src/state/documentContract.ts` (`taskTypesVisible`, rol `none`, afgeleid in
  `payloadFromImport` via `hasTaskTypeData`), IFC: `ifcPsets.ts` (pset `OPS_WorkRule`),
  `ifcWriter.ts`/`ifcReader.ts` (`DefaultWorkRule` in **`OPS_ProjectSettings`**; de drie werkvelden in
  het bestaande JSON-blob van **`OPS_TimephasedWindow`**), `extTypes.ts`/`extMappers.ts`
  (`ExtTask.workRule`, `ExtProject.defaultWorkRule`, werkvelden op de toewijzing), `moveProject.ts`,
  `fieldCoverage.ts`.
- **Let op:** spec §4.4 noemt `OPS_AssignmentWork` en `OPS_SchedulingOptions`; de code gebruikt
  `OPS_TimephasedWindow` en `OPS_ProjectSettings` [BEVESTIGD]. De spec moet bij de overname worden
  rechtgezet (op #169 is `OPS_SchedulingOptions` bovendien juist ingeperkt tot projectopties).
- **Tests:** `check-ifc-roundtrip.ts` (+12), `check-document-contract.ts`, `check-ext-contract.ts`.
- **Besluiten (spec §3.1, letterlijk):** "2. De knop stuurt **alleen de weergave, nooit de
  berekening**; taaktypes zijn documentdata." — "5. Semantiek werkt **alleen op bewerkingen**, nooit
  bij het openen/herberekenen van een bestand (anders verschuiven de gepinde importdatums)." —
  "9. Het interne model is **neutraal** tussen MSP en P6 (superset)."
  §3.3 besluit 9: "**Drie optionele werkvelden per toewijzing** (begroot / verricht / resterend); de
  driehoek werkt op het restant, begroot blijft referentie (§4.3)."

### Baan B — Import/export-vertaling (bouwstap 2)

- **Bestanden:** `src/engine/work/workRuleMapping.ts` (nieuw: `workRuleFromMsp`,
  `workRuleFromXerDurationType`, `workRuleFromP6DurationType`, `mspFromWorkRule`,
  `importedWorkFields`, `MSPDI_TASK_TYPE_CODE`), `importNormalize.ts` (`deriveImportedWorkRules`),
  `mppReader.ts` (alleen `deriveImportedWorkRules`), `mspdiReader.ts` (leest nu `<Type>`/
  `<EffortDriven>` op taakniveau en `<Work>`/`<ActualWork>`/`<RemainingWork>` op toewijzingen),
  `mspdiWriter.ts` (schrijft `<Type>`/`<EffortDriven>` en de werkvelden), `p6xmlReader.ts`
  (**draait de labels van `DT_FixedDrtn`/`DT_FixedDUR2` om**, leest `<PlannedUnits>`/`<ActualUnits>`/
  `<RemainingUnits>`), `p6xmlWriter.ts`, `xerReader.ts` + `xerResourceAssignments.ts` +
  `xerResourceTypes.ts` (`duration_type` → werkregel; `target_qty`, `act_reg_qty + act_ot_qty`,
  `remain_qty` → werkvelden via `importedWorkFields`).
- **Tests:** `check-work-rule-mapping.ts` (37 checks), `check-xer-p6xml-parity.ts` (labels omgedraaid).
- **Besluiten:** §3.3 besluit 8: "**Optie B**: vier types in het menu; het bewaarde
  `Task.effortDriven` stuurt alleen de twee cellen waar MS Project van P6 afwijkt (§5). Taken die in
  OPS worden aangemaakt krijgen het veld nooit." §3.1-6: "Import **bewaart** MSP's velden".
- **Twee bevindingen [BEVESTIGD]:**
  1. *Labelwissel P6 XML.* Op #169 staat nog `'Fixed Duration and Units': 'DT_FixedDrtn'`; #101 zegt
     (met Oracle's XER Data Map Guide als bron) dat het andersom is. Mijn eigen kennis van MPXJ
     (`FIXED_DURATION` ↔ "Fixed Duration and Units/Time" ↔ `DT_FixedDrtn`) steunt #101 [VERMOED — niet
     opnieuw tegen de bron gecontroleerd]. Solverneutraal voor P6-XML: de twee solvertakken die
     `p6DurationType` lezen (`p6OpenLoeTargetSpanTrace`, `p6CompletedRouteTrace`) eisen óók
     `p6ProjectId`/`p6TaskId`, en die zet de P6-XML-lezer niet (zie §4).
  2. *"Alleen bij afwijking" klopt niet voor XER.* Het XER-plan (§4.1-bijstelling, "Opgeslagen werk")
     en spec §4.4 beloven dat XER de werkvelden alleen zet "wanneer `target_qty` afwijkt van duur ×
     tarief" (176 van 61.618 rijen). `importedWorkFields` zet echter ook alle drie de velden zodra er
     **enig verricht werk** is (`actualPresent`), met een tolerantie van 1 minuut in plaats van 1 %.
     Gemeten over het corpus (93 bestanden, 62 van 93 leesbaar op de #101-basis): **14.293 van 62.028
     toewijzingen** krijgen werkvelden, waarvan 13.455 met verricht werk; rehab-2 alleen al
     13.412/52.640, MER-1 120/120, DCP-03 As-Built 47/47. Werkregels over dezelfde set:
     FIXED_DURATION_WORK 16.673, FIXED_DURATION_RATE 2.136, FIXED_WORK 70, zonder regel 2.756 (vermoedelijk WBS-
     taken). Geen gevolg voor de datums (§4), wél voor histogram/overallocatie/bezetting en de
     handmatige nivelleerder, want veld aanwezig ⇒ de nieuwe vierde bron in `assignmentDayUnits`.
     Eigenaarsbesluit nodig (§6, E3).

### Baan C — Werkdriehoek, de pure rekenkern (bouwstap 3)

- **Bestanden:** `src/engine/work/workTriangle.ts` (409 regels: `applyDurationEdit`,
  `applyUnitsEdit`, `applyWorkEdit`, `applyTaskWorkEdit`, `applyAssignmentAdded`,
  `applyAssignmentRemoved`, `applyRuleChange`, `applySlotChange`), meetlat
  `tests/planning/work-triangle-cases.json` (44 cases; 21 documented, 21 reasoned, 2 decided, 0
  measured; 3 store-cases overgeslagen).
- **Tests:** `check-work-triangle.ts` (370 checks) [BEVESTIGD groen].
- **Besluiten:** §3.2: "1. Menukaart = **P6-vorm: vier types, geen los effort-driven-vinkje**" · "2.
  **Een typewissel verandert geen enkel getal**; alleen welke hoek voortaan beschermd is. Bij wissel
  naar een type dat werk beschermt wordt het huidige werk vastgelegd zoals het is." · "3. Resource
  toevoegen op een gecontoureerde taak met vast werk: **vorm blijft, hoogte zakt evenredig; de nieuwe
  resource is vlak; de duur wordt korter.**" · "4. Bewijs = **beredeneren + grondig
  documentatieonderzoek** …" · "6. Reikwijdte: **alleen gewone bladtaken op werktijd, en uurtaken.**"
  · "7. **Nivelleerder blijft alleen verschuiven**; "inzet verlagen bij vast werk" komt in de TODO".
  §3.3 besluit 10: "**De vereenvoudiging "elke toewijzing loopt over de hele restduur" is
  geaccepteerd** voor deze etappe".

### Baan D — Bedrading (bouwstap 4 + 6, K2, Δ-rest, F4)

- **Bestanden:** `src/engine/work/workRuleApply.ts` (595 regels; `captureTriangle` →
  `settle…`; `settleDurationAftermath`, `captureCalendarChange`/`settleCalendarChange`,
  `carryRemainingThroughDurationEdit`, `syncCompletionToRemaining`, `reconcileContourWork`,
  `contourKeepsWork`), `src/state/calendarTasks.ts`, `taskSlice.ts` (`updateTask` kalenderstap +
  driehoek, `setTaskWorkRule`, `setTaskCalendar`), `resourceSlice.ts` (`assignResource`/
  `updateAssignment`/`unassignResource`/`moveAssignment`/`removeResource`/`updateCalendar` +
  `setAssignmentWork`), `projectSlice.ts` (`setProjectCalendar` door de regel), `gridTransaction.ts`,
  `createMcpTransactions.ts`, `taskEditPlan.ts` (`contourKeepsWork` in de omgeving, Δ-rest),
  `taskDefaults.ts` (`rescaleTaskContours(…, keepWork)`, `taskCalendarHoursPerDay` → `effHoursPerDay`),
  `ResourceLoad.ts` (vierde bron: opgeslagen werk).
- **Tests:** `check-work-rule-store.ts` (174 checks, 0 afwijkingen), `check-grid-transaction.ts`
  (173/173) [BEVESTIGD groen].
- **Besluiten (letterlijk):**
  - **K2** (spec §6.4): "Een andere kalender (taakkalender, projectkalender of de inhoud van een
    kalender) verandert de SLOTgrootte: werkminuten per werkdag. De restduur in dagen blijft, het werk
    van vóór de wissel is het anker, en daarna beslist de regel van de taak". FIXED_WORK/FIXED_RATE:
    "werk en inzet blijven, R = max(W / I) in de nieuwe slot, naar boven op hele dagen — minder uren
    per dag maakt de taak langer (meetlat 32). Dat verschuift dus wél de planning".
  - **Δ-rest** (spec §6.5): "het verrichte deel is een feit, dus wat de gebruiker aan de duur
    toevoegt of afhaalt landt in de rest — rest = max(0, rest + Δ), in dagen (`remainingTime`) of
    minuten (`remainingMinutes`); `completion` volgt uit de nieuwe rest".
  - **F4 optie a** (spec §6.5, besluit 2026-09-06): "Zodra de brug de rest expliciet schrijft (Δ-regel
    hierboven, B2, en de kalenderwissel in §6.4) wordt `completion` herrekend als 1 − rest ÷ duur".
- **Gedrag dat de gebruiker gaat merken [BEVESTIGD uit de code]:** omdat elke `.mpp`, MSPDI, P6 XML
  en XER-taak bij import een werkregel krijgt, gedragen geïmporteerde taken zich bij bewerken anders
  dan vandaag. Een gewone MSP-taak (Fixed Units, effort-driven ⇒ FIXED_RATE) wordt korter als je de
  inzet verhoogt of een resource toevoegt; een XER-taak met `DT_FixedDUR2` (FIXED_DURATION_WORK)
  krijgt bij een duurwijziging een andere inzet. Dat is precies het besluit (volg de bron), maar het
  is het belangrijkste punt voor de gebruikstest.

### Baan E — UI (bouwstap 5)

- **Bestanden:** instelling `ops-showTaskTypes` (`settingsRegistry.ts`, `settingsStore.ts`
  `saveShowTaskTypes`, `SettingsPanelContent.tsx`), `ui.showTaskTypes`, `taskTypesVisible`,
  `src/state/taskTypesNotice.ts` (`notifications.taskTypesUnlocked`, `workRuleDurationsChanged`),
  `TaskWorkRuleField.tsx` (paneel + `TaskDialog`), `TaskAssignmentsSection.tsx` (kolom **Werk (rest)**,
  slotjes), `taskColumnRegistry.ts` (`task.workRule` bewerkbare enum, `assignment.remainingWork`),
  `taskTypesVisibility.ts`, `FullTaskGrid.tsx`/`taskGridAdapter.ts`/`types/taskGrid.ts`
  (`taskTypesUnlocked`), i18n in 14 locales (`common.json` + `task.json`).
- **Tests:** `tests/browser/work-rule.spec.ts` (niet gedraaid in deze verkenning), `verify:i18n` en
  `verify:docs` [BEVESTIGD groen].
- **Besluiten:** §3.1-3: "Een bestand met taaktypedata **ontsluit de weergave automatisch** voor dat
  document, met melding." §3.1-4: "Het **eigenschappenpaneel** krijgt de instelling; een tabelkolom
  mag mee". §3.2-5: "**Aan-knop = app-instelling** ("Toon taaktypes"), plus automatische ontsluiting
  per document".
- **Aandachtspunten [VERMOED]:** (a) elke XER- en `.mpp`-import draagt taaktypedata, dus met de
  instelling uit krijgt elke open een extra melding, naast de profielmelding van #169; (b) de UI
  gebruikt losse hint-/bijschriftregels (`scrollzoom-hint`, "Beschermd: …", MSP-bijschrift) — dat
  botst met de eigenaarsvoorkeur "info in gekleurde blokken, geen verspreide bijschriften";
  (c) #101 zet de instelling op een tabblad "Tijdlijn" dat op #169 niet meer bestaat (U1: drie tabs).

### Baan F — MCP (bouwstap 7)

- **Bestanden:** `taskFields.ts` (`fields.workRule`, `REJECT_HINTS`), `taskTools.ts`,
  `calendarResourceTools.ts` (`planner_manage_assignments` `update`/`add` `remainingWorkMinutes`,
  `planner_update_project` `defaultWorkRule`), `readTools.ts` (`get_project_info` toont
  `defaultWorkRule`), MCP-tweelingen in `createMcpTransactions.ts`. Geen nieuwe tool.
- **Tests:** `tests/mcp/cases-work-rule.ts`, `cases-taskfields.ts`; samen met `cases-toolregistry`
  en `cases-schemavalidatie` [BEVESTIGD groen, 4/4].

### Baan G — Docs en gids

- `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md` (767 regels),
  `public/docs/{nl,en}/gids-taaktypes.md` + manifest, `docs/TODO.md` (+71), `CLAUDE.md` (+51:
  contour-sectie en werkregels), `docs/wiki/Features.md`, README-telling.
- Spec-status in de kop zegt nog "stap 8 volgt"; commit `38da59f2` deed stap 8 al deels.

## 3. De 29 conflictbestanden

`git merge-tree --write-tree origin/claude/rekenprofielen origin/claude/contour-engine-planner-mnrsy3`
[BEVESTIGD]: 29 inhoudsconflicten, geen hernoem- of verwijderconflicten. Merge-base `e1915758`.

### 3a. De vijf zware (semantisch)

| bestand | #101 doet | #169 veranderde sinds 05-09 | samensmelting |
|---|---|---|---|
| `src/state/slices/taskSlice.ts` | `updateTask`: kalenderstap éérst (`captureCalendarChange`/`settleCalendarChange`), dan de driehoek vóór/na de merge, Δ-rest, `settleDurationEdit`, `settleRuleChange`; haalt `workRule` en **`calendarId` uit `rest`**; nieuw `setTaskWorkRule`; `setTaskCalendar` door de regel | B1c: `clearLevelingGaps` met poort `taskUpdateInvalidatesLevelingGaps(rest, time)` en in de drie voortgangssetters; B1: `hourInputFinishBasis` vóór de merge, `reconcileHourInputFinish` ná `clearLevelingGaps`; `seedNewHourTaskFinish` in `addTask`; issue #27 `previewProgressImport`/`applyProgressImport` | #169 leidend voor de volgorde, #101 schuift ertussen. **Val 1:** #101's `rest` bevat geen `calendarId` meer, dus `taskUpdateInvalidatesLevelingGaps(rest, time)` mist dan de kalenderwissel — geef `updates` (of `{ ...rest, calendarId }`) mee. **Val 2:** `hourInputFinishBasis` moet vóór #101's kalenderstap worden vastgelegd, anders zit de kalenderwissel niet in de sleutel en blijft het ingevoerde einde oud. Volgorde: basis → kalenderstap → driehoek-momentopname → merge → Δ-rest → contour + `settleDurationEdit` → `settleRuleChange` → Z8 → `clearLevelingGaps` → `reconcileHourInputFinish` |
| `src/state/slices/resourceSlice.ts` | alle toewijzingsroutes door de driehoek; bij een duur uit de driehoek `settleDurationAftermath` + stale; `setAssignmentWork`; `updateCalendar`/`removeCalendar` door `settleCalendarChange` | B1c: `clearLevelingGaps` in `assignResource`, `unassignResource`, `moveAssignment` (oud en nieuw), `removeCalendar`, `removeCalendarsBulk` | beide houden. Dan geldt de **grootste botsing** (hieronder): een duur uit de driehoek moet ook het ingevoerde einde en de nivelleergaten bijwerken |
| `src/state/gridTransaction.ts` | assignment-set-pad met `settleAssignmentPlan` + `settleWorkEdit` + `settleDurationAftermath`; celbewerking met aparte kalenderstap en driehoek; `contourKeepsWork` in de **inline** omgeving; `datesAsRecorded`-reset + `markScheduleStale` | `buildTaskEditPlanEnvironment` uitgelicht (voor de voortgangsimport #27), `recordedMark` in de kolomruntime | `contourKeepsWork` verhuist naar `buildTaskEditPlanEnvironment(state, task)` — dan krijgt de voortgangsimport hem ook, wat klopt. Het ingevoerde einde komt op dit pad via `taskEditPlan.ts` (#169, regel 166) goed, **behalve** bij een duur uit de driehoek op het assignment-set-pad |
| `src/state/runtime/createMcpTransactions.ts` | tweelingen van alles hierboven + `afterTriangleDurationChange`, `draft.setAssignmentWork`/`setTaskWorkRule`, `updateCalendar` door de regel | B1c `clearLevelingGaps` (incl. `applyLeveling` met `scopeTaskIds`), B1 `finishBasis`/`reconcileHourInputFinish` in `updateTaskFields` en `updateTask` | zelfde twee vallen als `taskSlice` (`rest`/`topRest` zonder `calendarId`; basis vóór de kalenderstap). `afterTriangleDurationChange` loopt via `settleDurationAftermath`, dus één fix daar dekt ook MCP |
| `src/utils/taskDefaults.ts` | `rescaleTaskContours(…, keepWork = mspTaskType === 'FIXED_WORK')`; `taskCalendarHoursPerDay` → `effHoursPerDay` | +190: `hourTaskInputFinish`, `hourInputFinishFollowsEdits`, `hourInputFinishBasis`, `reconcileHourInputFinish`, `seedNewHourTaskFinish`, `clearLevelingGaps`, `taskUpdateInvalidatesLevelingGaps`; `createDefaultTaskTime(…, calendar)` | tekstueel een unie. Let op: `effHoursPerDay` wijzigt de contour-herschaalfactor bij bewerkingen op een uurkalender (alleen de aanroepers `taskSlice`/MCP `updateTask*`) — geen import- of solvepad [BEVESTIGD via grep] |

**De grootste semantische botsing — B1 tegen een duur uit de werkdriehoek.** Sinds B1 schrijft de
solve `scheduleFinish` niet meer terug; het ingevoerde einde van een niet-gestarte urentaak blijft
alleen kloppen doordat élke plek die duur, start of kalender verandert `reconcileHourInputFinish`
aanroept (`taskSlice`, MCP, `taskEditPlan`). #101 voegt plekken toe die de duur veranderen buiten die
drie om: inzet- of werkbewerking en resource erbij/eraf onder FIXED_WORK/FIXED_RATE, via
`resourceSlice`, het assignment-set-pad van het raster en de MCP-toewijzingstools. Uurtaken vallen
binnen de reikwijdte (besluit 6, meetlat 24). Zonder ingreep houdt zo'n urentaak na de merge een oud
`scheduleFinish` [VERMOED — de paden zijn gelezen, niet gedraaid]. Oplossing: in
`settleDurationAftermath` (één plek voor store, raster en MCP) de basis vastleggen vóór de
driehoekstap en daarna `clearLevelingGaps` + `reconcileHourInputFinish` aanroepen. Dat vraagt een
kleine API-wijziging, want de basis moet vóór `applyTriangleResult` worden vastgelegd. De
kalenderwissel botst niet: `settleCalendarChange` slaat uurtaken over en B1 geldt alleen voor
uurtaken. Het TODO-punt "B1c-koppelpunt" uit #101 (`docs/TODO.md`) is op #169 dus nu uit te voeren:
`clearLevelingGaps` in `settleDurationAftermath`.

**`hourInputFinishFollowsEdits` tegen FIXED_WORK/FIXED_RATE.** Geen tegenspraak: die functie sluit
gestarte taken uit, en precies daar werkt #101's Δ-rest/`syncCompletionToRemaining`. Wel een
combinatie om te testen: een niet-gestarte urentaak onder FIXED_WORK krijgt via de driehoek een
andere `durationMinutes` en moet dan (na de fix) een ander ingevoerd einde krijgen. Taken met
`p6ExplicitTargetWindow` (XER) blijven uitgesloten, dus hun `target_end_date` blijft staan.

### 3b. De overige 24 (mechanisch of klein)

| bestand | #101 | #169 | aanpak |
|---|---|---|---|
| `src/types/project.ts` | `Project.defaultWorkRule`; verder alleen CRLF → LF (merge-base heeft 86 CRLF-regels, beide koppen 0) | 62 commits: `SchedulingOptions` opgesplitst (projectopties/conventies/`leveling`) | #169 nemen, één veld toevoegen |
| `src/state/slices/types.ts` | `NotificationMessageKey` +2, `UIState.showTaskTypes` | nieuwe meldingssleutels (profiel, nivellering, …) | unie |
| `src/types/taskGrid.ts`, `taskGridAdapter.ts`, `FullTaskGrid.tsx` | `taskTypesUnlocked`, `TaskAssignmentToken.remainingWorkMinutes` | `recordedMark`/"datums zoals opgeslagen"-binding, rijsleep | unie |
| `src/components/settings/SettingsPanelContent.tsx` | sectie "Toon taaktypes" | U1: drie tabs Weergave/Planning/Geavanceerd + layouts (+203 −165) | naar tab **Planning**, bij Urenplanning; vorm volgens de UI-voorkeur van de eigenaar |
| `src/services/xer/xerReader.ts` | `deriveImportedWorkRules`, `taskWorkMinutes`-kaart | C3 bronprofiel, bak 4 `recordedTimes`, `useProjectEndDateForFloat` | unie |
| `src/services/msproject/mspdiReader.ts` | `<Type>`/`<EffortDriven>`, werkvelden | C3, #159 WBS-scheidsrechter, Work op de taakkalender | unie; `effHpd` blijft de taakkalender |
| `src/services/msproject/mspdiWriter.ts` | `<Type>`/`<EffortDriven>`, werkvelden, `<Work>` uit het veld | #159 `workHpd` (taakkalender), nivellering, C6, C3 | veld eerst, anders #169's afleiding met `workHpd` |
| `src/services/p6/p6xmlReader.ts` | labelwissel + werkvelden | C3, #162 kalender-hpd | eigenaarsbesluit over de labels (E2), dan unie |
| `src/services/mcp/tools/readTools.ts` | `defaultWorkRule` in projectinfo | profiel, `leveling`, C6-optie | unie |
| 9 × `src/i18n/locales/*/task.json` (fa fr it ja ko pl pt tr zh) | columns-regel + `workRule`-blok + werkkolom | `recordedSource` op dezelfde columns-regel, recorded-/relatiesleutels | regel per regel samenvoegen; `verify:i18n` |
| `public/docs/manifest.json`, `README.md` | `gids-taaktypes`; telling 34 | rekenprofielen-/recorded-gidsen; telling 36 | unie; telling opnieuw tellen |
| `tests/planning/check-ext-contract.ts` | velden in de canon | C1–C12, profiel (API 1.2.0) | unie; **`EXTENSION_API_VERSION` naar 1.3.0** (#169's `apiVersion.ts`; nieuwe velden + `updateTask({workRule})` via de extensie-API) |
| `tests/planning/check-milestone-duration-render.ts` | +8 | datumonafhankelijk gemaakt | #169 nemen, #101's regels erbij |

**Automatisch gemergede bestanden die toch aandacht vragen [VERMOED]:** `CLAUDE.md` (#101's
contourtekst plus #169's rekenprofielen-, B1- en contourwijzigingen; nalezen), `taskEditPlan.ts`
(#169 heeft daar `reconcileHourInputFinish`, #101 de Δ-rest: volgorde nagaan — Δ-rest vóór reconcile),
`projectSlice.ts` (#101 zet `syncProjectCalendar` vóór de settle), `docs/TODO.md`, en
`check-xer-p6xml-parity.ts` (labels).

**Andere open PR's:** #167 (recorded-all-formats, na #109) raakt waarschijnlijk dezelfde MSPDI-/P6-XML-
lezers [VERMOED, niet gemeten]. Wie als tweede merget, lost dat op.

## 4. Risico's voor regel A (X12 en `.mpp`-fidelity)

**Conclusie: geen verandering in `Task.time` bij import; X12 en `.mpp`-fidelity horen cel voor cel
gelijk te blijven.** Onderbouwing per pad [BEVESTIGD tenzij anders vermeld]:

1. **De solver leest niets van #101.** In `src/engine/scheduler/` leest alleen `ResourceLoad.ts`
   werkvelden (vierde bron van `assignmentDayUnits`). `CPMSolver`/`solveProject`/`solveInput` lezen
   geen toewijzingen (op #169 gegrept: geen `assignments` in `CPMSolver.ts`, `solveProject.ts`,
   `solveInput.ts`). `workRule` wordt nergens in de motor gelezen.
2. **Lezers:** `deriveImportedWorkRules` zet alleen `Task.workRule`; `importedWorkFields` zet alleen
   toewijzingsvelden; `unitsPerDay` is in alle drie de lezers byte-identiek (alleen naar een lokale
   variabele gehaald). `mppReader.ts` heeft één regel extra. `.mpp`-toewijzingen krijgen géén
   werkvelden (alleen MSPDI/P6 XML/XER) — een gat t.o.v. spec §4.2, geen risico.
3. **"Afwezig ⇒ afgeleid" vult geen duur of inzet in:** de afleiding (`taskWorkMinutes(task.time,
   hpd) × unitsPerDay`) is alleen een vergelijkingswaarde in `importedWorkFields`; er wordt niets
   teruggeschreven naar `Task.time`.
4. **`settle*` draait nooit bij laden:** alle aanroepers staan in `taskSlice`, `resourceSlice`,
   `projectSlice`, `gridTransaction`, `createMcpTransactions` en `taskEditPlan` — geen in lezers,
   `payloadFromImport`, `applyLoadedProject` of `solveProject` (besluit 3.1-5 is dus in de code
   nageleefd). Laden doet alleen `hasTaskTypeData` (zichtbaarheid) en een melding.
5. **P6-XML-labelwissel:** verandert `p6DurationType` voor P6-XML-bestanden. De solvertakken die dat
   veld lezen (`p6OpenLoeTargetSpanTrace`: `DT_FixedDUR2`; `p6CompletedRouteTrace`: `DT_FixedDrtn`)
   eisen ook `p6ProjectId`/`p6TaskId`, die de P6-XML-lezer niet zet, plus conventies die onder het
   voorgestelde ops-profiel voor P6 XML uit staan. Dus geen X12-effect (X12 meet alleen XER) en geen
   solve-effect voor P6 XML. Wel: bestaande IFC's uit een P6-XML-import dragen de oude, verwisselde
   waarde — geen migratie (E2).
6. **Toekomstig risico — nivellering in de solve:** het nivelleringsonderzoek (`2026-09-24-
   nivellering-etappe-onderzoek.md` §5) wil een tweede pas in `solveProject` die
   `assignmentDayUnits` deelt. Vanaf dat moment verandert #101's vierde bron (14.293 XER-toewijzingen
   met werkvelden) de genivelleerde datums. Vandaag geen effect (motor leest `leveling` niet; OZB 9033
   staat buiten de meetlat), maar wie als tweede landt, moet dit onder regel A meten.
7. **Gerichte meting bij de integratie:** `measure:profiles` (regel A per cel) en
   `check-mpp-fidelity` (`GOAL_ZERO_DEVIATIONS`) vóór en ná; verwachting 104/0/0/0 en 0 afwijkingen.
   Plus één gerichte non-interferencecheck: XER lezen met en zonder werkvelden/werkregels ⇒ identieke
   `Task.time` na `solveProject` (analoog aan de bak-4-mutatiecheck).

## 5. Stand van de PR zelf

**Verwerkte reviewrondes [BEVESTIGD uit de commits]:** stap 3 (`912039d2`), bouwstap 4 (`7d4f2bfc`:
B1 voortgang ≠ duurbewerking, B2 rest expliciet, B3 vierde bron met verricht deel, B4 verplaatsen/
verwijderen door de driehoek), stap 5/7 (`4016ebe8`: B1–B4, K1, K3–K6), K2/Δ-rest (`f72a964e`,
F2–F11), kalenderwissel G1–G11 (`d3bfc956`), F4 optie a (`c5fca94a`). Op GitHub: 0 reviews, 0
comments, niet draft, `REVIEW_REQUIRED`, laatst bijgewerkt 06-09.

**Open punten (spec §12 + `docs/TODO.md` op de branch):** MSP-meetlat (36 bewerkingen, nu 0
measured); MS Project-meting van K2 en de Δ-regel; **K2 niet bedraad op drie randpaden** (G9:
`projectSlice.setCalendar`, `librarySlice.resolveDeviation(ref, 'company')`, de `workTime`-
verwijdering in `calendarResourceTools.ts`) plus G10 (Z8-venster ongelijk gewist); crashherstel
ontsluit zonder melding (K2-review); werkinvoer ≤ 0 weigert stil (K6a); **B1c-koppelpunt**
(`clearLevelingGaps` in `settleDurationAftermath` — nu uit te voeren, §3); per-toewijzing-spanne;
telling `mspTaskType × effortDriven` over de `.mpp`-crawl; nivelleerder "inzet verlagen"; % werk
gereed; projectstandaard-werkregel in de UI (alleen via MCP zetbaar); P6 "preserve existing
assignments"; CSV. Twaalf vertalingen van de gids volgen maandelijks.

**Checks op de branch zelf (kop `c5fca94a`, 24-09) [BEVESTIGD, op exitcode]:**

| check | exit | uitkomst |
|---|---|---|
| `npm run typecheck` | 0 | — |
| `check-work-triangle` | 0 | 370 checks; meetlat 44 cases |
| `check-work-rule-mapping` | 0 | 37 checks |
| `check-work-rule-store` | 0 | 174 checks, 0 afwijkingen |
| `check-xer-p6xml-parity` | 0 | groen |
| `check-ifc-roundtrip` | 0 | 209 |
| `check-document-contract` | 0 | 272 |
| `check-ext-contract` | 0 | 261 |
| `check-grid-transaction` | 0 | 173/173 |
| `check-milestone-duration-render` | 0 | 6 |
| `tests/mcp` `cases-work-rule`, `-taskfields`, `-toolregistry`, `-schemavalidatie` | 0 | 4/4 |
| `verify:i18n`, `verify:docs`, `verify:cycles` | 0 | groen (34 artikelen; 533 modules) |

Niet gedraaid (opdracht: geen zware suites): `npm run verify`, de browsersuite (`work-rule.spec.ts`),
`measure:profiles`. De corpustelling in §2 baan B is een eenmalig script over `OPS_XER_CORPUS` (31
van 93 bestanden werden door de #101-basislezer geweigerd — dat is XER-stand van 06-09, niet #101).

## 6. Voorgestelde etappe-indeling

In de stijl van `2026-09-22-rekenprofielen-overdracht.md` §3. Discipline zoals daar §3.7: eigen
branch per agent (nooit twee worktrees op één branch), critreview per landing, regel A per cel,
één `verify` tegelijk machinebreed.

0. **Eigenaarsbesluiten vooraf (gewone tekst, met voorbeeld en advies):**
   - **E1 — gedrag van bestaande importen.** Na de merge gedraagt elke geïmporteerde taak zich bij
     bewerken naar haar bron (MSP Fixed Units ⇒ inzet omhoog = duur korter; P6 `DT_FixedDUR2` ⇒ duur
     omhoog = inzet omlaag). Volgt uit besluiten 3.1-5 en 8, maar het is een grote zichtbare
     verandering. Advies: zo laten, wel in de gebruikstest en de releasetekst.
   - **E2 — P6-XML-labels.** Wissel overnemen (advies: ja, na één controle tegen Oracle's PMXML-
     schema/MPXJ `DurationTypeHelper`). Oude IFC's niet migreren (advies), want solverneutraal.
   - **E3 — XER-werkvelden: "alleen bij afwijking" of "ook bij verricht werk".** Gemeten 14.293/62.028
     in plaats van ±176. Advies: verricht werk alleen overnemen als het afwijkt van verrichte duur ×
     tarief, en de tolerantie relatief maken (1 %, zoals het XER-plan) — anders verandert het
     histogram van vrijwel elk gestart P6-project.
   - **E4 — meldingen bij openen.** Elke XER/`.mpp` ontsluit en meldt. Advies: geen aparte melding
     voor ontsluiting uit importvelden (`mspTaskType`/`p6DurationType`), alleen voor echte werkvelden
     of een eigen `workRule`; of samenvoegen met de profielmelding.
   - **E5 — UI-vorm.** Bijschriften/"Beschermd: …" omzetten naar een gekleurd blok (eigenaarsvoorkeur)?
1. **Baan 1 — Rebase-integratie op de #169-kop (één agent, `uitvoerder-opus-midden`, eigen branch
   `claude/taaktypes-integratie`).** Merge (niet rebasen: 19 commits, historie van reviewrondes bewaren)
   van `origin/claude/contour-engine-planner-mnrsy3` op de #169-kop. Eerst de 24 mechanische
   conflicten, dan de vijf zware met de volgorde uit §3a. In dezelfde baan: de twee vallen (`calendarId`
   uit `rest`, basis vóór de kalenderstap), `contourKeepsWork` in `buildTaskEditPlanEnvironment`,
   `EXTENSION_API_VERSION` 1.3.0, instelling naar tab Planning. Poorten: typecheck, lint,
   `verify:store-boundaries`, `verify:conventions`, `verify:cycles`, de negen gerichte checks uit §5,
   `check-recorded-dates`, `check-profile-switch-dates`, B1-checks, `tests/mcp` volledig.
2. **Baan 2 — B1 × werkdriehoek (eigen agent, ná baan 1).** `settleDurationAftermath` uitbreiden met
   basis + `clearLevelingGaps` + `reconcileHourInputFinish`; nieuwe cases in `check-work-rule-store`:
   niet-gestarte urentaak onder FIXED_WORK, inzet ×2 via store/raster/MCP ⇒ `scheduleFinish` = start +
   nieuwe duur op de taakkalender; genivelleerde taak ⇒ leveling-gaten weg. Mutatiebewijs: haal de
   reconcile weg ⇒ rood.
3. **Baan 3 — Regel A-meting (na 1+2, losgekoppelde keten).** `measure:profiles` vóór/na (verwacht
   104/0/0/0, uitgesloten 41), `check-mpp-fidelity`, plus de non-interferencecheck uit §4.7 als
   blijvende check (corpusloos op een fixture met werkvelden en `DT_FixedQty`, en met corpus).
4. **Baan 4 — Importbesluiten uitvoeren (na E2/E3).** `importedWorkFields` volgens E3, spec §4.2/§4.4
   rechtzetten (psetnamen, XER-regel), corpustelling opnieuw en in de spec §11.
5. **Critreviews (skill `hyperkritische-review`, [BEVESTIGD]/[VERMOED]):** één per baan, plus één
   brede op de hele PR vóór de gebruikstest (de PR had 0 GitHub-reviews; alleen reviewrondes binnen
   de sessie).
6. **Baan 5 — UI en docs (na E4/E5).** Instelling op tab Planning, meldingen, UI-vorm, CLAUDE.md-
   contour-/werkregeltekst op de #169-stand, `gids-taaktypes` nl+en bijwerken (profielen noemen),
   spec-kop en §10-status, `docs/TODO.md` (B1c-koppelpunt afvinken, G9-randpaden laten staan).
   Browsersuite: `work-rule.spec.ts` + de #169-specs die instellingen tellen.
7. **Gebruikstest (Opus midden, dev-server losgekoppeld):** `.mpp` openen ⇒ inzet wijzigen ⇒ duur;
   XER (`DT_FixedDUR2`) ⇒ duur wijzigen ⇒ inzet; kalenderwissel onder Vast werk ⇒ melding + langere
   taak; urentaak onder Vast werk ⇒ ingevoerd einde volgt; profielwissel P6 ↔ OPS raakt werkregels
   niet; undo is één stap; opslaan/heropenen IFC. Schermbewijs 100/125 %.
8. **Open laten (buiten deze overname):** de G9-randpaden, MSP-meetlat, per-toewijzing-spanne,
   nivelleerder "inzet verlagen" (besluit 7), en de koppeling met de nivelleringsetappe (§4.6).

**Wat eerst:** baan 1 met de twee vallen, direct gevolgd door baan 2. Daarvóór of parallel alleen
de eigenaarsvragen E1–E5 stellen; baan 4 wacht op E2/E3, baan 5 op E4/E5.
