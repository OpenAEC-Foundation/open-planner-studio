# Features

Open Planner Studio is a complete construction-planning application. Everything below works
identically in the desktop app and in the browser version — the same buttons, menus and shortcuts.

## Scheduling

- **Critical Path Method (CPM)** — automatic calculation of early/late start and finish dates, total and free float, and the critical path.
- **Work Breakdown Structure (WBS)** — a hierarchical task structure with collapsible summary tasks.
- **Relations** — Finish-Start, Start-Start, Finish-Finish and Start-Finish dependencies, each with a
  lag or lead in work days; relations can attach to milestones as well as ordinary tasks (not to
  summary tasks, which are flagged as *no effect* if a loaded file already has one).
- **Constraints** — start/finish constraints (such as Start No Earlier Than) for permits, deliveries and fixed dates.
- **Milestones** — start, finish and mandatory inspection milestones.
- **Baselines & progress** — capture baselines and track progress against them.

## Calendars

- **Work calendars** — configurable working days and hours, holidays, the construction industry's collective holiday, and inspection moments.
- **Resource calendars** — per-resource availability.
- **Hour-level planning** — durations in work days with hour-level calendar resolution.

## Resources

- **Resource libraries** — resources and calendars live in a shared, organization-wide library that
  multiple projects draw from; a project shows what it actually uses, with per-item provenance
  (from the library, project-only, or orphaned) and a library/project view toggle. See
  [Resource libraries](docs://gids-resourcebibliotheken) in the manual.
- **Assignments** — assign resources to tasks, with time-phased max-units availability.
- **Histogram & leveling** — a resource histogram plus automatic leveling options, including
  leveling priority per task and leveling within slack only.
- **Occupancy overview** — for multiple open projects drawing from the same library, a
  cross-document view of where each resource is booked and where the combined booking exceeds
  company capacity. See [Occupancy overview](docs://gids-bezettingsoverzicht) in the manual.

## Views & editing

- **Interactive Gantt chart** — drawn on an HTML5 canvas: drag & drop (including reordering or
  reparenting tasks by dragging their row vertically), zoom, a compressed working-days axis, week
  numbers and day names in the header, dependency arrows and hit-testing.
- **Table view** — a spreadsheet-style editor over the same model: a single click on a cell edits it
  immediately, with keyboard navigation (arrows, F2, Tab/Shift+Tab to indent) throughout.
- **Context menus** — right-click tasks for quick actions.
- **Office-style ribbon** — tabs for Start, Planning, Resources, Relations, View, Settings, Table,
  IFC, Report and (once enabled) AI, plus a Backstage file menu.
- **Multi-document** — work on several projects at once and switch between them.

## IFC & interoperability

- **IFC 4.3 native** — projects are saved and opened as IFC (buildingSMART); there is no separate project format.
- **4D BIM ready** — link the schedule to an IFC building model.
- **Import/export** — CSV, Microsoft Project (`.xml`) and Primavera P6 (`.xml`) adapters.

## AI assistant (MCP)

- **Model Context Protocol server** — turn on AI mode and the app becomes an MCP server: an AI
  assistant connects to the project you have open, reads it and edits it live, with every change
  visible immediately and undoable with Ctrl+Z.
- **Broad tool coverage** — reading, scheduling, resource/calendar/baseline setup and document
  management, close to forty tools in total, all prefixed `planner_`.
- **Batch scripting** — an assistant can submit a whole sequence of steps as one script, which lands
  in your undo history as a single step.
- **Safety controls** — pause, read-only mode, automatic per-document backup before the first
  change, and an activity log of every call. The resource library and a few app-wide settings stay
  out of reach entirely.
- **Desktop only, off by default** — the bridge runs in the desktop shell; it can optionally start
  automatically with the app.

## Reporting

- **Live print preview** — configurable report options right in the ribbon, including report font
  size, repeating the header on every page, and spreading the timeline over multiple pages; your
  choices are remembered between sessions.
- **Vector PDF export** — stays crisp at any zoom level and keeps text selectable and searchable, for
  Latin, Cyrillic, Greek, Arabic and Persian text; Chinese/Japanese/Korean text is vector when a font
  extension is installed and otherwise falls back to a raster image.

## Platform & experience

- **Desktop & browser** — Windows, macOS and Linux desktop builds (Tauri 2) plus a full-featured browser version.
- **Auto-save & crash recovery** — your work is saved continuously and restored after an unexpected close.
- **Automatic updates** — the desktop app updates itself where the install type supports it, and
  shows a one-off "you've just been updated" summary the first time you reopen it afterwards.
- **14 languages** — Nederlands, English, Français, Deutsch, Español, 中文, Italiano, Português, Polski, Türkçe, العربية, 日本語, 한국어 and فارسی, including right-to-left layout for Arabic and Persian. The in-app manual has its own language picker, independent of the interface language, with a warning when a translation is behind the English source.
- **Extensible** — a frontend extension system for importers, ribbon buttons, PDF fonts and more. See [Extensions Authoring](Extensions-Authoring).
