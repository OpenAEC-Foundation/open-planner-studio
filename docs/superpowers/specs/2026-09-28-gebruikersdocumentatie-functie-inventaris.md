# Bijlage — functie-inventaris voor de gebruikersdocumentatie

*Bij `2026-09-28-gebruikersdocumentatie-diataxis-design.md`. Stand `main` `9ab90cfd` (2026-09-28), read-only
afgeleid uit de code — **niet** uit de oude gidsen. Gebruik: dekkingschecklist (elke functie moet in de
nieuwe docs een thuis hebben) en startpunt voor het schrijven. Regelnummers verschuiven; herverifieer
elke bewering tegen de code of de app op het moment dat je hem opschrijft.*

Labels: **nl / en** uit `src/i18n/locales/{nl,en}`. Paden relatief aan `src/`.
**[T]** alleen desktop (Tauri) · **[I:x]** achter instelling x · **[B:x]** alleen bij bronformaat/toestand x ·
**[L]** legacy.

Lintvolgorde (`components/layout/Ribbon/Ribbon.tsx:253`): Bestand/File (Backstage) · Start/Home · Planning ·
Resources · Beeld/View · Instellingen/Settings · Tabel/Table · IFC · Rapport/Report · AI **[I:AI-modus]**.
Lint in-/uitklappen (Lint inklappen / Collapse the ribbon, `Ribbon.tsx:298`).

## 1. Planning opzetten (26)

- **Taak toevoegen** (Taak/Task) — Start/Tabel › Taken, contextmenu "Nieuwe taak", Ctrl+I. `layout/Ribbon/ribbonConfig.tsx:128`. Onder de selectie (boommodus), anders onderaan.
- **Mijlpaal ▾** — Startmijlpaal / Eindmijlpaal / Inspectiemoment (verplicht); Ctrl+M. `ribbonWidgets.tsx:187-206`. Inspectiemoment = type Keuring + verplicht.
- **Invoegen boven/onder, Subtaak toevoegen** — contextmenu, Insert, Ctrl+I. `canvas/ContextMenu.tsx:182-186`, `hooks/keyboard/shortcutRegistry.ts:317,347`.
- **Inspringen / Uitspringen** — Planning › Structuur, Alt(+Shift)+→/←, contextmenu. `ribbonConfig.tsx:468-487`. Alleen in boommodus, anders `layout/StructureLockedNotice.tsx`.
- **Taak omhoog/omlaag** — Alt+↑/↓, rij/balk verticaal slepen. `shortcutRegistry.ts:371-385`.
- **Mijlpaal aan/uit** — contextmenu. `ContextMenu.tsx:197`.
- **Verwijderen** — Start/Tabel › Bewerken, Del/Backspace, contextmenu. `ribbonConfig.tsx:298`.
- **Ongedaan / Opnieuw** — Bewerken-groep, titelbalk, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. `ribbonConfig.tsx:290-295`, `layout/TitleBar/TitleBar.tsx:168-176`.
- **Kopiëren / Plakken** — Ctrl+C/V, contextmenu. `shortcutRegistry.ts:211-222`, `ContextMenu.tsx:280`.
- **Selecteren** — Ctrl+A, Esc, Ctrl/Shift-klik, kaderselectie op lege achtergrond. `shortcutRegistry.ts:264,404`, `canvas/hooks/useBoxSelect.ts:83`.
- **Taakdialoog** — dubbelklik balk, contextmenu Bewerken…, F2. `canvas/GanttCanvas.tsx:420`, `dialogs/TaskDialog.tsx:257-344`. Secties: basis, aantekeningen, mijlpaal, duur, werkregel, hammock, constraint, deadline, voortgang, CPM-resultaat, relaties, toewijzingen, codes.
- **Eigenschappenpaneel** — Beeld › Panelen › Eigensch. `ribbonConfig.tsx:722`, `panels/TaskPropertiesPanel.tsx:90,149`. Direct van kracht; Herbereken, Taak verwijderen.
- **Basisvelden** (naam, WBS-code, omschrijving, type, kalender) — `task-sections/TaskBasicFields.tsx`.
- **Taaktype-categorie** (Bouw … Overig, "+ Nieuw taaktype…", "Taaktypen beheren…") — `task-sections/TaskTypeField.tsx`.
- **Aantekeningen / checklist** — `task-sections/TaskNotesFields.tsx`.
- **Prioriteit** Laag/Normaal/Hoog — contextmenu. `ContextMenu.tsx:238-245`.
- **WBS auto** — Planning › Structuur. `ribbonConfig.tsx:447`.
- **Hernummer WBS** — `ribbonConfig.tsx:455`; uit zolang WBS auto aan staat.
- **Sjablonen** — Planning › Structuur; bewaren via contextmenu "Bewaar tak als sjabloon". `ribbonWidgets.tsx:378`, `ContextMenu.tsx:268`.
- **Codes & velden** — `ribbonConfig.tsx:441`, `dialogs/StructureDialog.tsx` (activity codes + custom fields).
- **Inklappen / Uitklappen** — Beeld › Overzicht, contextmenu. `ribbonConfig.tsx:670-704`, `ContextMenu.tsx:152-158`. Bij groeperen op de banden.
- **Taak splitsen** (modus) — Start/Planning/Tabel. `ribbonConfig.tsx:154`, `layout/SplitModeNotice.tsx`, `task-sections/TaskSplitsSection.tsx`; contextmenu onderbreking opheffen `ContextMenu.tsx:168-171`. Alleen met zichtbare Gantt.
- **Nieuw project** (wizard) — Nieuw, Backstage, titelbalk, Ctrl+N. `dialogs/ProjectInfoDialog.tsx`, `settings/ProjectInfoPanelContent.tsx:510-545`. Faseringssjabloon (Leeg/Woningbouw/Utiliteitsbouw), kalenderland, rekenprofiel.
- **Nieuw of openen** — plusknop documentkiezer. `dialogs/NewOrOpenProjectDialog.tsx`.
- **Projectinfo** — Instellingen › Project, Backstage › Projectinfo. `ProjectInfoPanelContent.tsx:380-493`. Naam, omschrijving, auteur, bibliotheek, opdrachtgever, start/eind, standaard duureenheid.
- **Project verplaatsen…** — Planning › Planning. `ribbonConfig.tsx:354`, `dialogs/MoveProjectDialog.tsx`. Proefberekening, baselines meeschuiven, waarschuwingen (actuals, harde pins, externe relaties, feestdagen). Uit zonder projectstart.

## 2. Relaties & constraints (12)

- **Relatie tekenen** (modus) of Shift+slepen balk→balk. `ribbonWidgets.tsx:279`, `layout/DependencyModeNotice.tsx`, `canvas/hooks/useGanttPointerCoordinator.ts:296`.
- **Geselecteerde taken koppelen** (FS-keten). `ribbonWidgets.tsx:291`.
- **Externe relatie toevoegen…** — `ribbonWidgets.tsx:303`, `dialogs/ExternalLinkDialog.tsx`.
- **Alle externe relaties vernieuwen** — `ribbonWidgets.tsx:315`; rastermenu `task-grid/FullTaskGrid.tsx:1086-1120`. **[T]** vernieuwen (web: niet beschikbaar).
- **Relatie toevoegen / Relatie leggen vanaf hier** — contextmenu. `ContextMenu.tsx:164,188`.
- **Relatietype-popover** na slepen (FS/SS/FF/SF + lag). `canvas/RelationTypePopover.tsx`.
- **Relatiesectie / relatiecel** (type, lag, driving, vrije speling, zoeken). `task-sections/TaskDependenciesSection.tsx`, `task-grid/RelationCellEditor.tsx:72-430`.
- **Pad traceren** Voorgangers/Opvolgers. `ribbonConfig.tsx:200-238`, `ContextMenu.tsx:250`.
- **Constraints** ASAP/ALAP/SNET/SNLT/FNET/FNLT/MSO/MFO + harde pin + secundaire constraint. `task-sections/TaskConstraintFields.tsx`.
- **Deadline** — `task-sections/TaskDeadlineField.tsx`.
- **Hammock** — `task-sections/TaskHammockFields.tsx` (bladtaak, geen mijlpaal).
- **Relatielijnen** tonen — Beeld. `ribbonConfig.tsx:826`.

## 3. Kalenders & uren (11)

- **Kalenders** — Planning › Kalender › Kalender en Vrije dagen; Instellingen › Kalender. `ribbonConfig.tsx:173,432,853`, `dialogs/CalendarDialog.tsx:174`. Nieuw, dupliceren, projectdefault. ("Vrije dagen" = zelfde dialoog.)
- **Werkdagen/werktijden** (presets Ma–vr, Continu 24/7, banden, eigen presets). `dialogs/CalendarForm.tsx`, `dialogs/WorkTimeEditor.tsx`.
- **Feestdagen genereren…** (land, regio, bouwvak). `dialogs/CalendarGeneratorFields.tsx`.
- **Kalender toewijzen** aan taak — contextmenu. `ContextMenu.tsx:201-214`.
- **Resourcekalender** — `panels/ResourcePanel.tsx:942`, `dialogs/ResourceCalendarDialog.tsx`.
- **Urenplanning inschakelen / Gemengde dag/uur-planning** **[I]** — `settings/SettingsPanelContent.tsx:314-323`; tijdschaal Uur `ribbonWidgets.tsx:1024`.
- **Kwartieren tonen** — `SettingsPanelContent.tsx:264`.
- **Week begint op** — `SettingsPanelContent.tsx:332`.
- **Alleen werkbare dagen tonen** — `SettingsPanelContent.tsx:253`.
- **Melding urenplanning in bestand** **[B:uurdata, urenplanning uit]** — `layout/HourDataNotice.tsx`.
- **Waarschuwing vrije periode** — `task-sections/TaskFreePeriodWarning.tsx`.

## 4. Resources & werk (11)

- **Resources**-paneel — Resources › Beheer, Beeld › Panelen. `ribbonConfig.tsx:513`, `panels/ResourcePanel.tsx`. Naam, type (Arbeid/Materieel/Materiaal/Onderaannemer/Ploeg), max. eenheden, kosten/uur, kleur, eenheid, ouder, kalender.
- **Resourcedock** (compact, rechter-rail). `ribbonConfig.tsx:537`, `panels/ResourcePanelCompact.tsx`.
- **Nieuwe resource** — `ribbonConfig.tsx:597`.
- **Tijd-gefaseerde capaciteit** — `ResourcePanel.tsx:905,1295`.
- **Toewijzen ▾** (eenheden/dag, curve) — Resources › Toewijzing. `ribbonWidgets.tsx:581`. Eén bladtaak, geen mijlpaal.
- **Toewijzingssectie** (8 curves) — `task-sections/TaskAssignmentsSection.tsx`.
- **Urenverdeling…** (contour, fasen) — `TaskAssignmentsSection.tsx:237`, `dialogs/ContourDialog.tsx`, `dialogs/ContourPhaseStrip.tsx`.
- **Werkregel** (Vaste duur en inzet / Vaste duur en werk / Vast werk / Vaste inzet) **[I:Toon werkregels en werk, of taaktypedata]** — `task-sections/TaskWorkRuleField.tsx`, `SettingsPanelContent.tsx:363`.
- **Histogram** (Vorige/Volgende resource, Ctrl+Shift+H, hover = bijdragers) — `ribbonConfig.tsx:579-627`, `GanttCanvas.tsx:707`, `canvas/hooks/useGanttHistogramInteraction.ts:59`.
- **Overallocatie-indicator** — `ribbonWidgets.tsx:1170`.
- **Resource-accent** (streepje onder balk) — `ribbonConfig.tsx:801`.

## 5. Nivellering (3)

- **Nivelleren…** — Resources › Nivellering. `ribbonConfig.tsx:634`, `dialogs/LevelingDialog.tsx`. Resourcekeuze, alleen binnen speling, Berekenen → preview → Toepassen.
- **Nivellering wissen** — `ribbonConfig.tsx:638`.
- **Nivelleringsvertraging als kolommen** (alleen-lezen) — `engine/taskGrid/taskColumnRegistry.ts:792-794`.

## 6. Uitvoering, voortgang & baselines (11)

- **Statusdatum** (+ leegmaken) — Planning › Baselines & voortgang. `ribbonWidgets.tsx:85-104`.
- **Voortgangsmodus** Retained Logic / Progress Override — `ribbonWidgets.tsx:116-121`.
- **Baseline opslaan… / Baselines beheren…** (zelfde dialoog) — `ribbonWidgets.tsx:80-81,131-132`, `dialogs/BaselineDialog.tsx`.
- **Voortgang per taak** (%, werkelijke start/einde, resterend; contextmenu-percentages) — `task-sections/TaskProgressFields.tsx`, `ContextMenu.tsx:222-230`.
- **Startvraag** — `dialogs/ActualStartDialog.tsx`.
- **Voortgangsblad exporteren** (.xlsx) — Planning/Tabel/Rapport › Voortgang. `ribbonConfig.tsx:382`.
- **Voortgang bijwerken uit een blad** — idem + Backstage › Importeren. `ribbonConfig.tsx:366`, `backstage/Backstage.tsx:625`, `dialogs/ProgressImportDialog.tsx`.
- **Overlays**: baseline, voortgangslijn, statusdatumlijn — Beeld. `ribbonConfig.tsx:770-790`.
- **Baselinekolommen** — `engine/taskGrid/fieldIds.ts:1-8`.
- **Datums zoals opgeslagen** **[B:import met afwijkende datums]** — `layout/RecordedDatesNotice.tsx`.
- **Melding losgelaten urenverdeling** **[B:MPP/MSPDI]** — `task-sections/TaskTimephasedNotice.tsx`.

## 7. Berekenen & analyse (10)

- **Bereken** (F5) — `ribbonConfig.tsx:119`, `shortcutRegistry.ts:140`.
- **Automatisch berekenen** **[I]** — `SettingsPanelContent.tsx:346`.
- **Statusbalk** (taken, mijlpalen, kritiek pad, einde, verouderd, selectie, schaal, zoom, onopgeslagen, waarschuwingsknoppen) — `layout/StatusBar/StatusBar.tsx:38-100`.
- **Waarschuwingenpaneel** (Ctrl+Shift+L; 9 soorten; klik navigeert) — `ribbonConfig.tsx:404`, `panels/WarningsPanel.tsx:138`.
- **CPM-resultaat per taak** (ES/EF/LS/LF/TF/FF/IF/kritiek) — `task-sections/TaskCpmResultSection.tsx`.
- **Rekenprofiel** (P6 / MS Project / Open Planner Studio + eigen sjablonen; 27 conventies in 6 thema's) — `settings/SchedulingProfileSection.tsx:216,238`, `engine/scheduler/conventions/registry.ts:93-150`.
- **Reken-opties** (kritiek-definitie, speling, open-eind kritiek, bijna-kritiek, meerdere spelingspaden, lagkalender, SS-lag vanaf) — `SchedulingProfileSection.tsx:316-439`.
- **Instellingen uit het bronbestand** **[B:P6/MSP]** — `SchedulingProfileSection.tsx:454`.
- **Bouwmodus** **[I]** — `SettingsPanelContent.tsx:298`.
- **Balkkleuren** (kritiek pad / per taak / categorie) + **Spelingsband** — `ribbonWidgets.tsx:671`, `ribbonConfig.tsx:811`.

## 8. Rapporten & printen (6)

- **Afdruk** — Rapport › Rapportage, Ctrl+P, Backstage › Afdruk. `ribbonConfig.tsx:893`, `Backstage.tsx:490-499`.
- **11 rapporttypes** (Gantt-afdruk, Resourcediagram, Mijlpalen, Variance, Look-ahead, Kritiek & near-critical, Voortgang, Planningsgezondheid, Resourcebelasting, Resourcetoewijzingen, WBS-samenvatting) — `panels/ReportPanel.tsx:1324-1328`, `engine/reports/*`.
- **Rapportinstellingen** — `ReportPanel.tsx:1404-1515`.
- **Rapportageperiode** — `panels/reports/ReportingPeriodField.tsx`.
- **Opties per tabelrapport** — `panels/reports/TableReportOptionsBlock.tsx`.
- **PDF exporteren** — `ReportPanel.tsx:1261,1669`.

## 9. Import/export & bestanden (12)

- **Openen** (Ctrl+O): IFC, CSV, XML (MSPDI/P6 XML), MPP, XER — `services/formatRegistry.ts:95-100,127-147`.
- **Opslaan / Opslaan als** (alleen IFC als opslagdoel) — `formatRegistry.ts:122`.
- **Recent** — `ribbonWidgets.tsx:437`, `Backstage.tsx:258`.
- **Voorbeelden** — `Backstage.tsx:342-391`.
- **Exporteren** (6 formaten: voortgangsblad xlsx/csv, CSV, MSPDI, P6 XML, IFC 4x3) — `formatRegistry.ts:279-285`, `ribbonWidgets.tsx:489`.
- **IFC met bibliotheek ernaast** **[B:gekoppeld]** — `Backstage.tsx:436-442`.
- **Importeren via extensies** — `Backstage.tsx:596-641`.
- **IFC-editor** — IFC-tab, `panels/IFCPanel.tsx`.
- **Sluit project** (+ Opslaan/Niet opslaan/Annuleren) — `Backstage.tsx:152`, `layout/DocumentChrome/CloseDocumentDialog.tsx`.
- **Automatisch opslaan** naar bestand — `TitleBar.tsx:150-162` (na eerste opslag).
- **Crashherstel** (snapshot ≤ elke 10 s) — `hooks/useAutoSave.ts`, `dialogs/RecoveryDialog.tsx`.
- **Meldingen per bronformaat** **[B]** — `notifications.*` in `i18n/locales/nl/common.json`.

## 10. Weergave & navigatie (15)

- **Tijdschaal** (zoom, herstellen, passend, Jaar…Dag [+Uur]; +/−/0) — `ribbonWidgets.tsx:989-1024`.
- **Spring naar vandaag** (Ctrl+Home) — `shortcutRegistry.ts:495`.
- **Layouts** (aan/uit, nieuw, bewerken, dupliceren, verwijderen; ingebouwd Resourcediagram) — `ribbonWidgets.tsx:840-926`, `dialogs/LayoutsDialog.tsx`, `viewControls/builtinLayouts.ts:18`.
- **Filter/Groeperen/Sorteren/Kolommen als losse knoppen** **[L][I:Klassieke weergaveknoppen]** — `ribbonConfig.tsx:711-714`, `ribbonWidgets.tsx:1151`, `dialogs/FilterDialog.tsx`.
- **Presentatie** (F11) — `ribbonWidgets.tsx:963`, `layout/PresentationHint.tsx`.
- **Split view** — `ribbonWidgets.tsx:970`.
- **Mini-map** — `ribbonWidgets.tsx:977`, `canvas/MiniMap.tsx`.
- **Tabel-tab** (kolomkiezer, vastzetten, breedte, autofit, herordenen, reset, zoeken; ~82 vaste kolommen) — `ribbonConfig.tsx:315`, `FullTaskGrid.tsx:708-735`, `task-grid/ColumnChooser.tsx`, `taskColumnRegistry.ts:771-937`.
- **Celbewerking** (Tab, Enter/F2, typen, Delete, Esc) — `shortcutRegistry.ts:550-625`.
- **Gantt-interactie** (slepen, rekken, pannen) — `useGanttPointerCoordinator.ts:290-380`, `canvas/hooks/useBarDrag.ts`.
- **Scrollen & zoomen** (Positie / Toetsen / Zoom + slepen) — `dialogs/ScrollZoomSettings.tsx:62-104`.
- **Hover-tooltip** — `canvas/HoverTooltip.tsx`.
- **Rechter-rail** — `layout/RightRail/RightRail.tsx:212-303`.
- **Meerdere documenten** (tabs/verticaal/pil, Ctrl+1..9) — `layout/DocumentChrome/*`, `SettingsPanelContent.tsx:233`.
- **Melding structuur vergrendeld** — `StructureLockedNotice.tsx`.

## 11. Instellingen (27)

Tandwiel (`TitleBar.tsx:187`), Instellingen › Project › Instellingen, Backstage › Instellingen; tabs Weergave/Planning/Geavanceerd (`SettingsPanelContent.tsx:106-121`).
- **Weergave:** Thema, Volg systeemthema, Taal (14), Lettertype, Tekengrootte, Datumnotatie, Duurweergave, Documentwissel-stijl, Alleen werkbare dagen, Kwartieren, Taakbalken bij onderbrekingen, Scrollen & zoomen.
- **Planning:** Bouwmodus, Urenplanning, Gemengd dag/uur, Week begint op, Automatisch berekenen, Toon werkregels en werk.
- **Geavanceerd:** AI-modus, Bridge automatisch starten, Debug-terminal, Benchmark…, Statistieken…, Rondleiding starten, Controleren op updates, Wat is er nieuw, Klassieke weergaveknoppen **[L]**.
- **Sneltoetsenoverzicht** (Ctrl+/) — `dialogs/ShortcutsDialog.tsx`, `ribbonConfig.tsx:855`.

## 12. Resourcebibliotheek (7)

- **Backstage › Bibliotheek** (toevoegen/verwijderen, default, export/import, uit project overnemen, kalenders) — `backstage/LibrarySection.tsx`.
- **Bibliotheek importeren** — `dialogs/PoolImportDialog.tsx`.
- **Bibliotheek koppelen** — `dialogs/LibraryLinkDialog.tsx`.
- **Weergaven Bibliotheek / Project / Bezetting** **[B:gekoppeld]** — `ResourcePanel.tsx:495-502`.
- **Bezettingsoverzicht** — `panels/ResourceOccupancyView.tsx`.
- **Naar de bibliotheek / Losmaken** — `ResourcePanel.tsx:1023,1038`.
- **Gekoppelde bibliotheek in Projectinfo** — `ProjectInfoPanelContent.tsx:397`.

## 13. Extensies & AI (10)

- **Extensies** (geïnstalleerd/bladeren, ZIP/JS, aan/uit, verwijderen, quarantaine) — `backstage/ExtensionManagerPanel.tsx`, catalogus `extensions/extensionService.ts:31`.
- **Toestemmingsvraag** (7 permissies) — `dialogs/ExtensionConsentDialog.tsx`, `extensions/types.ts:54-61`.
- **Extensie-lintknoppen/importers** — `ribbonWidgets.tsx:536`.
- **AI-tab** **[I:AI-modus]** — `Ribbon.tsx:255`.
- **Bridge starten/stoppen** **[T]** — `ribbon/ai/AiServerGroup.tsx:65`.
- **Verbinding** (poort, token, verbindingsgegevens) — `ribbon/ai/AiConnectionGroup.tsx:95-219`, `dialogs/AiConnectionDetailsDialog.tsx`.
- **Veiligheid** (pauzeren, alleen lezen, auto-backup; backup maken/map openen **[T]**) — `ribbon/ai/AiSafetyGroup.tsx:95-132`.
- **Activiteitenpaneel** — `ribbon/ai/AiActivityGroup.tsx:19`, `panels/AIActivityPanel.tsx`.
- **AI-status in statusbalk** — `StatusBar.tsx:101`.
- **42 MCP-tools** — `services/mcp/tools/`.

## 14. Help, onboarding & overig (12)

- **Welkomstdialoog** — `dialogs/WelcomeDialog.tsx`.
- **Rondleiding** (7 stappen) — `tour/tourSteps.ts`, `Backstage.tsx:147`.
- **Help** (zoeken, docstaal; F1) — `backstage/HelpPanel.tsx`, `shortcutRegistry.ts:484`.
- **Feedback geven** (GitHub-issue, screenshot met annotatie) — `TitleBar.tsx:198`, `dialogs/FeedbackDialog.tsx`, `dialogs/ScreenshotAnnotator.tsx`.
- **Software-update** **[T]** — `hooks/useUpdateCheck.ts:18`, `dialogs/UpdateDialog.tsx`.
- **Net geüpdatet / Wat is er nieuw** — `dialogs/JustUpdatedDialog.tsx`.
- **Statistieken** — `dialogs/StatsDialog.tsx`.
- **Benchmark** — `dialogs/BenchmarkDialog.tsx`.
- **Debug-terminal** **[I]** — `panels/DebugTerminal.tsx`, `StatusBar.tsx:111`.
- **Vensterknoppen** **[T]** — `TitleBar.tsx:227-235`.
- **Snelle toegang titelbalk** — `TitleBar.tsx:140-146`.
- **Meldingenkanaal** — `layout/NotificationHost.tsx`.

## Totalen

185 functies in 14 domeinen. Verder: 9 lintregisters, 10 Backstage-onderdelen, 11 rapporttypes, 6 export- en
5 leesformaten, 39 dialoogbestanden, 37 sneltoetsregels, 27 rekenconventies, 42 MCP-tools, 131 meldingssleutels.

## Opvallend bij de inventaris

- Dubbele knoppen: "Vrije dagen" = "Kalender"; "Baseline opslaan…" = "Baselines beheren…" (zelfde dialoog).
- Afdruk-knop staat alleen op Rapport (een commentaar noemt ook Beeld).
- Filter/Groeperen/Sorteren lopen nu via Layouts; de losse knoppen zijn legacy.
