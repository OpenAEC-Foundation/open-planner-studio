---
paths:
  - "src/engine/contour/**"
  - "src/engine/scheduler/ResourceLoad.ts"
  - "src/engine/scheduler/ResourceLeveler.ts"
  - "src/services/contourIo.ts"
  - "src/components/dialogs/Contour*.tsx"
  - "src/components/task-sections/TaskAssignmentsSection.tsx"
  - "src/utils/taskDefaults.ts"
  - "src/state/slices/resourceSlice.ts"
  - "tests/planning/check-contour-*"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### De contour-engine: werkverdeling-per-dag als data, de curve-formule als terugval

`src/engine/contour/contourEngine.ts` (puur, 2026-09) is de rekenkern voor **resource-contouring**:
een contourprofiel (`Task.timephasedContours`, periodes op de cumulatieve werkminuten-as van de taak
— dezelfde as als `TaskSplitGap`) wordt per dagslot (`hoursPerDay × 60`) omgerekend naar werkminuten,
en daaruit naar eenheden per dag. `ResourceLoad.ts`'s `assignmentDayUnits` is de ENE verdeelfunctie
die histogram, overallocatie, nivelleerder (`ResourceLeveler.ts`) en bezettingsoverzicht delen:
(1) een opgeslagen contour (gekoppeld aan de toewijzing via `TaskTimephasedContour.resourceId`,
`matchContoursToAssignments`) ⇒ data, zonder de hele-eenheden-afronding; (2) `ResourceAssignment.
curveValues` (de exacte 21-punts P6-/MSPDI-curve, `CONTOUR_SHAPE_VALUES`-vorm) ⇒ eveneens data;
(3) anders de bestaande `distributeUnits`-formule, byte-identiek. De engine raakt **geen taakdatum**:
de CPM-datums van een import blijven bij laag 3/4 van de Z8-beslistabel en `splitGaps` — de
fidelity-poort bewaakt dat. Een duurwijziging (`taskSlice.updateTask`, `createMcpTransactions`,
`taskEditPlan`) herschaalt de contour én de importsplits proportioneel via `taskDefaults.ts`'s
`rescaleTaskContours` (actuals blijven, `mspTaskType === 'FIXED_WORK'` houdt het werk vast); een
datum-/kalender-/toewijzingswijziging raakt de as niet. `src/services/contourIo.ts` is de adapterlaag:
MSPDI `<TimephasedData>` (Type 1/2, per werkdag) en P6 `<ResourceCurve>` + `<ResourceCurveObjectId>`
+ de `PlannedCurve`/`RemainingCurve`/`ActualCurve`-spreidingsstrings (`"werkuren:periodeuren;…"`,
MPXJ `TimephasedHelper`) round-trippen daar doorheen — let op: P6's `<PlannedCurve>` is dus GEEN
curvenaam (dat was een fout van de vroegere writer; de lezer accepteert die naamvorm nog als compat).
De IFC-lezer regenereert resource-ids en mapt `contour.resourceId` daarom via `ifcGuid(oudeId)` terug
(`remapContourResourceIds`). Bewerken in de UI (etappe contour-UI + fasen-editor): `ContourDialog.tsx`
achter de knop **Urenverdeling…** per toewijzing in `TaskAssignmentsSection` — in FASEN (aaneengesloten
werkdagen met één inzet, `src/engine/contour/contourPhases.ts`: run-length over de werkdagslots,
splitsen/samenvoegen/grens/inzet), als sleepbare SVG-strook (`ContourPhaseStrip.tsx`, in het venster,
dus buiten de Gantt-renderergrenzen) én als tabel; vorm-als-data, toepassen/loslaten — op het pure
bewerkmodel `contourEdit.ts` (dagslots ↔ periodes met gat-herinvoeging; de OPSLAGvorm blijft één periode
per werkdag) en de store-actie `resourceSlice.setAssignmentContour` (undo, `isDirty`, GEEN
`scheduleStale`: een contour raakt geen datum en maakt geen split; een 0-inzet-fase blijft binnen de duur).
Dagenlijst via `ResourceLoad.ts`'s `taskWorkDayIsos` — dezelfde als het histogram. Regressie:
`tests/planning/check-contour-engine.ts` en `tests/browser/contour-dialog.spec.ts`; gidsen:
`public/docs/{nl,en}/gids-msproject-import.md` §"Gecontoureerde toewijzingen" en
`gids-resources-histogram.md` §"De urenverdeling zelf bewerken".
