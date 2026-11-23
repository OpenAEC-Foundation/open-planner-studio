# Features

Open Planner Studio is a complete construction-planning application. Its core planning, editing,
reporting and project-file workflows are available in both the desktop app and browser.
Platform-specific features and limitations are called out below, including the desktop-only MCP
bridge and automatic updates.

## Scheduling

- **Critical Path Method (CPM)** — automatic calculation of early/late start and finish dates, total and free float, and the critical path.
- **Calculation shifts** — after Calculate (F5), see which tasks moved and why, inspect the project-finish change and restore the previous dates while that calculation is still the latest change. See [Why a task shifts](docs://uitleg-verschuivingen).
- **Work Breakdown Structure (WBS)** — a hierarchical task structure with collapsible summary tasks.
- **Relations** — Finish-Start, Start-Start, Finish-Finish and Start-Finish dependencies, each with a
  lag or lead in work days; relations can attach to milestones, ordinary tasks and summary tasks. A
  relation on a summary task is applied to each of its leaf tasks. A task cannot be linked to itself
  or to its own summary (ancestor); a relation on a summary without any leaf tasks is flagged as
  *no effect*.
- **External project links** — use anchor dates from another project file, an optionally enabled open document, or a project on the hosting site. Review changed anchors before accepting a new source version, inspect their origin and find projects that depend on your schedule. See [External relations to another project](docs://howto-externe-relaties).
- **Dependency editing** — link selected tasks in the order of the list with Ctrl+F2, assign predecessors or successors from the right-click menu, add several together, and see predecessors and successors as separate lists. Step through the dependency chain and return to previously visited tasks. Dissolve reconnects neighbouring tasks when removing an activity; summary handling is configurable. See [Adding relations](docs://howto-relaties-leggen).
- **Constraints** — start/finish constraints (such as Start No Earlier Than) for permits, deliveries and fixed dates.
- **Milestones** — start, finish and mandatory inspection milestones. A series of milestones directly below each other collapses into one row; milestones on the same day share one diamond.
- **Baselines & progress** — capture baselines and track progress against them. Compare the active baseline and two earlier baselines together in the Gantt and in print.
- **Calculation profiles** — one scheduling engine, three schools: Primavera P6, Microsoft Project and
  Open Planner Studio. A profile is a named set of conventions (per project, switchable, with custom
  profiles as templates); the file's own calculation options stay per project.
- **Dates as recorded** — when the app's own calculation differs from what a P6 or Microsoft Project file
  recorded, you can show the recorded dates instead and compare.

## Calendars

- **Work calendars** — configurable working days, start and finish times, breaks, holidays, the construction industry's collective holiday, and inspection moments.
- **Holiday generator** — national and regional sets, including United States federal holidays with observed dates and Bolivia. Check the generated set against the project's actual working arrangements.
- **Resource calendars** — per-resource availability.
- **Days and hours** — hour planning is always available. Mix day and hour measures, including fractional days, on one time axis in minutes. Tasks can follow each other within a work day; the calendar and scheduling profile determine how the measure is counted.

## Resources

- **Resource libraries** — resources and calendars live in a shared, organization-wide library that
  multiple projects draw from; a project shows what it actually uses, with per-item provenance
  (from the library, project-only, or orphaned) and a library/project view toggle. See
  [Using the resource library](docs://howto-resourcebibliotheek-gebruiken) in the manual.
- **Assignments** — assign resources to tasks, with time-phased max-units availability.
- **Cost resources** — assign fixed amounts to tasks or milestones without work hours or capacity. The resource panel totals the amounts; IFC preserves them, while MS Project and P6 exports explicitly report their omission. See [Assigning a fixed amount](docs://howto-vast-bedrag-toekennen).
- **Task types and work** — a work rule per task (fixed duration and units, fixed duration and
  work, fixed work, fixed units — the MS Project task types and P6 duration types) decides which
  corner of work = remaining duration × units moves when you edit another; remaining work per
  assignment is editable in hours. Choose the project default in Project settings; an explicit
  choice also controls the corresponding field visibility. When the hours of other resources on a
  task change, a notice lists them, with Undo. See [Choosing a task type](docs://howto-werkregel-kiezen) in the manual.
- **Histogram & leveling** — a resource histogram plus automatic leveling options, including
  leveling priority per task and leveling within slack only.
- **Occupancy overview** — for multiple open projects drawing from the same library, a
  cross-document view of where each resource is booked and where the combined booking exceeds
  company capacity. See [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken) in the manual.

## Views & editing

- **Interactive Gantt chart** — a Canvas timeline paired with an accessible DOM task grid: drag & drop (including reordering or
  reparenting tasks by dragging their row vertically), zoom, a compressed working-days axis, week
  numbers and day names in the header, dependency arrows and hit-testing.
- **Open by dropping files** — drop supported planning files into the window to use the normal guarded file-open route. On the desktop, a file passed at start-up or to a running app opens the same way.
- **Table view** — a spreadsheet-style editor over the same model: one click selects a cell; use
  F2, Enter or typing to edit it, and double-click a drop-down cell to open its list. Arrow keys and
  Tab/Shift+Tab navigate cells, while Alt+Left and Alt+Right outdent and indent tasks.
- **Date picker** — date fields and date cells open the app's own calendar with week numbers and keyboard control; typing a date keeps working. See [Entering a date](docs://howto-datum-invoeren).
- **Work-category colours** — colour bars by work category; each custom category gets its own free colour in the Gantt, print and legend.
- **Table columns** — automatic content-based sizing, remembered manual widths and a Calendar days column alongside working durations.
- **Context menus** — right-click tasks for quick actions.
- **Office-style ribbon** — tabs for Start, Planning, Resources, View, Settings, Table, IFC,
  Report and (once enabled) MCP, plus a Backstage file menu. Relation actions are available from the
  task groups instead of a separate Relations tab.
- **Multi-document** — work on several projects at once and switch between them.
- **Progress sheets** — exchange progress as Excel, compare the returned sheet with its export snapshot and the current plan, and resolve conflicting changes before applying them.

## IFC & interoperability

- **IFC 4.3 native** — projects are saved and opened as IFC (buildingSMART); there is no separate project format.
- **Planning IFC and building models** — edit the planning file separately, then combine it with a
  building model in another IFC tool. Opening an IFC that contains building-model objects is
  refused by default. Experimental building-model support can retain foreign content through guarded
  Save As and export to new destinations, with source-aware recovery. The feature is disabled by
  default. With it on, Save writes over the document's own file, Save As on the desktop can replace a
  confirmed existing file, AutoSave runs on its own rhythm, and files with a building model open up
  to 150 MB.
- **Import/export** — CSV, Microsoft Project XML and Primavera P6 XML adapters, experimental
  Primavera P6 XER export, and read-only opening of native Microsoft Project `.mpp` files. P6 XML
  and XER export show explicit loss notices; save the editable project as IFC. An imported original
  `.xer` travels inside the IFC as a source archive.

## MCP clients

- **Model Context Protocol server** — enable the MCP connection and start the bridge: an MCP
  assistant connects to the project you have open, reads it and edits it live, with every change
  visible immediately and undoable with Ctrl+Z.
- **Broad tool coverage** — reading, scheduling, resource/calendar/baseline setup and document
  management, 42 tools in total, all prefixed `planner_`.
- **Batch scripting** — an assistant can submit a whole sequence of steps as one script, which lands
  in your undo history as a single step.
- **Safety controls** — pause, read-only mode, automatic per-document backup before the first
  change, and an activity log of every call. The resource library and a few app-wide settings stay
  out of reach entirely.
- **Desktop only, off by default** — the bridge runs in the desktop shell; it can optionally start
  automatically with the app.
- **Claude Desktop extension** — the release includes a `.mcpb` bundle. While the desktop app runs
  with its MCP bridge, Claude works in the open plan; when the app is closed, the bundle starts its own
  planner on a working folder that you choose at install. It finds the app by itself: no token to paste.
- **Headless MCP server** — developers can build the same tools as a standalone Node program,
  with stdio or authenticated loopback HTTP transport and file access limited to a working folder.
  See [the headless MCP documentation](https://github.com/OpenAEC-Foundation/open-planner-studio/blob/main/docs/headless-mcp.md).

## Reporting

- **Progress curve** — planned, early, late and approximate actual S-curves with progress indicators and risk tasks. The actual curve is reconstructed from current progress, not a stored daily history.
- **Report workspace** — five steps follow the Gantt paper: tasks and grouping, columns, bars and timeline, page, and header and footer. Use all tasks, the current view or a layout, apply layout columns and bar options explicitly, and open the right step from the paper. A Resource diagram layout shows resource bands.
- **Live print preview** — choose columns, dates beside bars, repeating headers and page scale. Settings are remembered between sessions and shared across open windows. The preview draws the sheets in view; PDF export recalculates stale schedules first.
- **Report fonts** — five bundled families include monospace Liberation Mono. Supported TrueType fonts from this device or a file can be embedded in the PDF, subject to embedding permissions. See [Making and printing a report](docs://howto-rapport-maken-en-afdrukken).
- **Vector PDF export** — stays crisp at any zoom level and keeps text selectable and searchable, for
  Latin, Cyrillic, Greek, Arabic and Persian text; Chinese/Japanese/Korean text is vector when a font
  extension is installed and otherwise falls back to a raster image.

## Platform & experience

- **Desktop & browser** — Windows, macOS and Linux desktop builds (Tauri 2) plus a full-featured browser version.
- **Site hosting** — integrated file versions and preferences, live host language and theme changes, and planning tools for the hosting site’s assistant.
- **macOS integration** — native window controls and translated menus share the app's document and pending-input guards. See [macOS window and menu bar](docs://ref-macos).
- **Searchable settings** — one settings panel with search, eight groups, preview pictures and a reset button for every changed setting. See [Settings](docs://ref-instellingen).
- **Background saving** — the IFC file is computed in the background and the status bar shows *Saving…*, *Saved* with the time, or *Unsaved*; closing waits for a running save.
- **System-aware appearance** — optionally follow the operating system or browser light/dark colour scheme, including live changes while the app remains open; High Contrast stays an explicit choice.
- **Auto-save & crash recovery** — recovery snapshots are written about every ten seconds and can
  restore open work after an unexpected close. For an existing saved IFC file, you can separately
  opt in to writing changed work back to that same file on the same interval.
- **Automatic updates** — the desktop app updates itself where the install type supports it, and
  shows a one-off "you've just been updated" summary the first time you reopen it afterwards.
- **28 languages** — Nederlands, English, Français, Deutsch, Español, 中文, Italiano, Português, Polski, Türkçe, العربية, 日本語, 한국어, فارسی, Русский, Українська, Čeština, Slovenčina, Српски, Hrvatski, Български, Magyar, Română, Svenska, Norsk bokmål, Dansk, Suomi and ລາວ, including right-to-left layout for Arabic and Persian. The in-app manual is available in all 28 languages, with its own language picker independent of the interface language; an article that is not yet translated shows the English text with a short notice.
- **Extensible** — a frontend extension system for importers, ribbon buttons, PDF fonts and more. See [Extensions Authoring](Extensions-Authoring).
