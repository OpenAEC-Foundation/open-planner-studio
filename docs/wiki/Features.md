# Features

Open Planner Studio is a complete construction-planning application. Everything below works
identically in the desktop app and in the browser version — the same buttons, menus and shortcuts.

## Scheduling

- **Critical Path Method (CPM)** — automatic calculation of early/late start and finish dates, total and free float, and the critical path.
- **Work Breakdown Structure (WBS)** — a hierarchical task structure with collapsible summary tasks.
- **Relations** — Finish-Start, Start-Start, Finish-Finish and Start-Finish dependencies, each with a lag or lead in work days.
- **Constraints** — start/finish constraints (such as Start No Earlier Than) for permits, deliveries and fixed dates.
- **Milestones** — start, finish and mandatory inspection milestones.
- **Baselines & progress** — capture baselines and track progress against them.

## Calendars

- **Work calendars** — configurable working days and hours, holidays, the construction industry's collective holiday, and inspection moments.
- **Resource calendars** — per-resource availability.
- **Hour-level planning** — durations in work days with hour-level calendar resolution.

## Resources

- **Resource management** — labour, equipment and subcontractors.
- **Assignments** — assign resources to tasks.
- **Histogram & leveling** — a resource histogram plus automatic leveling options.

## Views & editing

- **Interactive Gantt chart** — drawn on an HTML5 canvas: drag & drop, zoom, dependency arrows and hit-testing.
- **Table view** — an Excel-like editor with inline, double-click editing over the same model.
- **Context menus** — right-click tasks for quick actions.
- **Office-style ribbon** — tabs for Start, Planning, Resources, View, Settings, Table, IFC and Report, plus a Backstage file menu.
- **Multi-document** — work on several projects at once and switch between them.

## IFC & interoperability

- **IFC 4.3 native** — projects are saved and opened as IFC (buildingSMART); there is no separate project format.
- **4D BIM ready** — link the schedule to an IFC building model.
- **Import/export** — CSV, Microsoft Project (`.xml`) and Primavera P6 (`.xml`) adapters.

## Reporting

- **Live print preview** — configurable report options right in the ribbon.
- **Vector PDF export** — stays crisp at any zoom level and keeps text selectable and searchable, with a raster fallback for CJK and right-to-left scripts.

## Platform & experience

- **Desktop & browser** — Windows, macOS and Linux desktop builds (Tauri 2) plus a full-featured browser version.
- **Auto-save & crash recovery** — your work is saved continuously and restored after an unexpected close.
- **Automatic updates** — the desktop app updates itself where the install type supports it.
- **14 languages** — Nederlands, English, Français, Deutsch, Español, 中文, Italiano, Português, Polski, Türkçe, العربية, 日本語, 한국어 and فارسی, including right-to-left layout for Arabic and Persian.
- **Extensible** — a frontend extension system for importers, ribbon buttons, PDF fonts and more. See [Extensions Authoring](Extensions-Authoring).
