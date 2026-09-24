---
paths:
  - "src/components/layout/**"
  - "src/components/backstage/**"
  - "src/components/ribbon/**"
  - "src/components/panels/**"
  - "src/components/common/Dialog.tsx"
  - "src/App.tsx"
  - "src/state/slices/uiSlice.ts"
  - "src/state/slices/types.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### Ribbon-driven UI

The shell is a Microsoft Office-style ribbon (`src/components/layout/Ribbon`) plus a Backstage view (`src/components/backstage/`) for File. De bron van beide lijsten is `slices/types.ts`, niet deze alinea — `npm run verify:docs` faalt als ze uit elkaar lopen.

Tabbladen (`RibbonTab`): `file`, `start`, `planning`, `resources`, `beeld`, `instellingen`, `table`, `ifc`, `report`, `ai` — die laatste verschijnt alleen als `ui.aiMode` aan staat. Relatieacties staan als dropdown in de taakgroepen van Start, Planning en Tabel; er is geen afzonderlijk Relaties-tabblad.

Backstage-secties (`BackstageSection`): `recent`, `examples`, `export`, `import`, `print`, `project-info`, `settings`, `extensions`, `library`, `help` — waarvan `help` een compleet documentatiesubsysteem is (zie `.claude/rules/docs-help.md`).

The active tab is in `ui.activeRibbonTab`. De rechterrail bevat conditioneel `TaskPropertiesPanel` en de compacte `ResourcePanelCompact` (samen de stapel met sleepgrens), daaronder het `WarningsPanel` (issue #53: alle waarschuwingen uit `cpmResult`/`resourceLoadResult` via de pure `collectScheduleWarnings`, klik navigeert via `revealScheduleWarning`; `ui.showWarningsPanel`, sessie); `DebugTerminal` en `AIActivityPanel` kunnen daaronder verschijnen. De volledige Tabel-, Resource-, IFC- en Rapportweergaven zijn werkruimtes en geen rechterpanelen. De rail gebruikt `ui.rightPanelCollapsed` / `ui.rightPanelWidth`. Global dialogs (`UpdateDialog`, `JustUpdatedDialog`, `FeedbackDialog` + `ScreenshotAnnotator`, `ProjectInfoDialog`, `LibraryLinkDialog`, `CloseDocumentDialog`) mount from `App.tsx` behind `ui.show*` flags. De gedeelde `Dialog` heeft een focus-trap (Tab/Shift+Tab blijven in de modal); dialogen die elkaar zouden overlappen worden geweerd via een gedeelde guard (`hasBlockingDialogOpen`). Gebruikerzichtbare meldingen lopen sinds K8a via **één** kanaal, gevoed vanuit de store — geen losse `alert()`/ad-hoc toasts erbij bouwen.
