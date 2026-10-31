---
paths:
  - "src/components/layout/**"
  - "src/components/tour/**"
  - "src/state/onboarding.ts"
  - "src/extensions/firstTutorial.ts"
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

The active tab is in `ui.activeRibbonTab`. De rechterrail bevat conditioneel `TaskPropertiesPanel` en de compacte `ResourcePanelCompact` (samen de stapel met sleepgrens), daaronder het `WarningsPanel` (issue #53: alle waarschuwingen uit `cpmResult`/`resourceLoadResult` via de pure `collectScheduleWarnings`, klik navigeert via `revealScheduleWarning`; `ui.showWarningsPanel`, sessie) en in dezelfde sectie het paneel Verschuivingen (`ScheduleShiftPanel`, #742; `ui.showScheduleShiftPanel`, sessie); `DebugTerminal` en `AIActivityPanel` kunnen daaronder verschijnen. De volledige Tabel-, Resource-, IFC- en Rapportweergaven zijn werkruimtes en geen rechterpanelen. De rail gebruikt `ui.rightPanelCollapsed` / `ui.rightPanelWidth`. Global dialogs (`UpdateDialog`, `JustUpdatedDialog`, `FeedbackDialog` + `ScreenshotAnnotator`, `ProjectInfoDialog`, `LibraryLinkDialog`, `CloseDocumentDialog`) mount from `App.tsx` behind `ui.show*` flags. De gedeelde `Dialog` heeft een focus-trap (Tab/Shift+Tab blijven in de modal); dialogen die elkaar zouden overlappen worden geweerd via een gedeelde guard (`hasBlockingDialogOpen`). De sluitvraag van een tabblad ligt op z-index 80; een vraag die vanuit *Opslaan* in die sluitvraag opent (zoals `SiteSaveDialog`/`SiteOpenDialog`, op `z-[90]`) moet daarboven liggen. Gebruikerzichtbare meldingen lopen sinds K8a via **één** kanaal, gevoed vanuit de store — geen losse `alert()`/ad-hoc toasts erbij bouwen.

### Eerste start: welkom, rondleiding, tutorialvraag

`src/state/onboarding.ts` bevat de regels als pure functies: welkomstdialoog, dan de rondleiding, dan de tutorialvraag. Ingebed (een host op `window.openaecHost` of de platformbouw, #716) en zonder `localStorage` (#706) komt er geen welkomstdialoog, en dus ook geen rondleiding of tutorialvraag (`useSettingsBootstrap`); de taal komt dan van de host (`embeddedLocale` in `src/i18n/config.ts`). De tutorialvraag komt alleen na een VOLTOOIDE rondleiding (Volgende/Klaar op de laatste stap) en eenmalig. Zolang de eerste start loopt, wacht "Update beschikbaar". Overgangen gaan in ÉÉN `setUI`. De rondleiding staat in `src/components/tour/`: stappen en ankers (`data-tour-anchor`) in `tourSteps.ts`; `TourOverlay` slaat een stap zonder anker over. "Ja" op de tutorialvraag loopt via `src/extensions/firstTutorial.ts` en stuurt `host:tutorial-requested` (zie `docs/extensions.md`, Host-events). Test: `tests/planning/check-first-start.ts`.
