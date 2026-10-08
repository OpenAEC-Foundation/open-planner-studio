# UI: tabblad, rail, wisselaar (Haiku-leesagent, model claude-haiku-5-5, main d233d578c)
- Eén navigatiestijl tegelijk: DocumentTabBar (App.tsx:312, 'tabs', default uiSlice.ts:109), ProjectRail (App.tsx:316, 'rail'),
  SwitcherPill in TitleBar (TitleBar.tsx:198-199, 'switcher'). ProjectOverview altijd gemount (App.tsx:373). StatusBar App.tsx:370.
- Per-document data: useDocumentCards.ts:32-87 (title, fileName, code, color, isActive, isDirty). Geen loading-/rekenstatus in de store.
- Dirty-stip: tab .ops-dirty-dot (DocumentTabControl.tsx:51), rail .ops-rail-dirty (ProjectRail.tsx:34), pill (SwitcherPill.tsx:24).
- Sluiten: closeWithGuard (useDocumentCards.ts:100-106) → pendingCloseDocId + CloseDocumentDialog, schoon → closeDocument (documentSlice.ts:498).
- Openen: openFile (fileSlice.ts:685) wacht op dialoog+parse, dan openAsDocument (:693) / applyOpenedImport (:565) met newDocument (~:600).
- Animatie: alleen ops-fade/ops-flyin, ops-tooltip-in (reduced-motion), .ops-indeterminate-bar (globals.css:2109, zonder reduced-motion).
- i18n: common documents.* (common.json:429-445); geen sleutel voor "openen…"/"bezig".
- RTL: richting alleen voor pijltoetsen; fysieke waarden in CSS (tab-close right:7px, rail ::before left:-8px, flyout left:64).
- Tests: document-switch.spec, new-open-task-flow.spec ([data-ops-tabstrip] .ops-tabstrip-add), check-document-tab-navigation.ts;
  geen spec voor rail/pill/overview; [data-ops-rail] botst met RightRail.tsx:174.
