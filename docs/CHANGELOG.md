# Changelog

This document describes, **per released version**, what that release of Open Planner Studio
contains — the detailed, substantive counterpart to the short release notes. Every released
version has its own section (no gaps); the newest is at the top. It is deliberately not a
running archive of every individual commit: within a version there is a curated description,
grouped by whichever category applies (`Added`, `Changed`, `Fixed`, `Documentation`).

## v2026.44.0 — 2026-10-31

### Added

- Compare up to three baselines at once: the active baseline and two comparison baselines share a strip in the Gantt and in reports. Overlapping segments and coincident milestones show their baseline colours together; comparison choices survive save/reopen and undo.
- New-project and project settings choose the default measure for new tasks. Tasks with fixed work use the hour measure; P6 and Microsoft Project profiles default to hour measure.
- Ribbon tabs can be switched with the mouse wheel, with an application setting to disable this behaviour. Summary-task names remain behind their bars.
- Embedded operation follows the host language and skips the welcome dialog. A development-only file link opens repository examples through the normal file-open route.
- Extension contract 1.5 exposes the current task selection for reading.

### Changed

- Scheduling uses one time axis in minutes and effective working-time blocks throughout. OPS day-measure tasks count work days, including fractions, while hour-measure tasks count working hours. A day task can follow an hour task within the same day.
- Hour planning is always available. The former hour-planning switch is removed; mixed planning controls the unit selector, and OPS tasks display their own measure. Dates at a working-day boundary omit the clock time; other moments display it. Duration display uses up to two decimals while retaining the underlying value.
- Calendar walks use integer milliseconds without rounding source work quantities. Dragging, splits, contours, resource loading, levelling, printing and scheduling share placement rules.
- Existing project files pass through the documented, undoable minute-model conversion. The app, headless core results and MCP import responses report the conversion.
- IFC reader/writer indexes avoid repeated hierarchy, calendar and crew scans. Other targeted changes limit Gantt drawing to visible rows, defer document thumbnails until the overview opens, and reduce repeated work in resource views, task selection, indentation, insertion and dependency searching.
- The Warnings ribbon controls are named Warnings panel. Download statistics count program downloads and refresh every two hours.
- The application and installers use the restored Open Planner Studio logo. Rustls is updated to 0.23.46.

### Fixed

- Preserve actual timestamps, completed work and explicit source remaining durations through progress edits, work-rule changes, import, save/reopen and recalculation. Completed milestones retain their planned clock time; zero remaining duration does not silently change a running P6 task's status.
- Correct working-day and clock-time boundaries for constraints, milestones, ALAP placement, lag and fractional remaining durations. Unchanged date input preserves its original instant.
- MS Project XML and P6 XML round trips retain task measures, remaining duration and lag metadata. Native MPP assignment calculations account for assignment units; XER decoding is deterministic for Windows-1252.
- MS Project XML exports time-phased resource capacity. Export warnings cover unsupported data, critical thresholds in hours and XML character replacement.
- Refuse malformed headless XML characters, entities and namespace bindings; decode UTF-16 input without silent character loss. Unprefixed XML no longer performs an unused namespace search for each element.
- Preserve recovery sets on read or claim failures, handle inaccessible browser storage, and stop update installation if recovery flush fails. Legacy recovery restores dirty state correctly.
- Keep MCP requests cancellable during reconnection, preserve operation and confinement errors, clean up failed discovery writes, bound temporary filenames and synchronize atomic-save directories.
- Confirm resource-library calendar removal, restore manual recognition choices, explain unavailable recent files and keep notifications clear of the guide panel.

### Documentation

- Updated Dutch and English guides for days and hours, fractional measures, task types, scheduling profiles, calendar boundaries, progress, exports and baseline comparison. The old hour-planning guide redirects to Plan a task in hours.
- Refreshed examples use the minute model; the two largest examples demonstrate simultaneous baselines.
- UI translations are completed through the translation pipeline for all 28 interface languages. Guide translations beyond Dutch and English remain a separate translation task.

### Compatibility

- Update every workstation before sharing files saved by this version with old installations. In v2026.9.0 and older, new files lose calendar details such as the work week, working times, holidays and shifts. In v2026.9.0 a task with a non-default time, an hour duration or a fractional day duration can also become a zero-duration task (known issue 150).

## v2026.43.0 — 2026-10-24

This release makes MCP clients easier to connect, improves large-schedule performance, and
hardens file handling, recovery and progress entry. Versions now use the ISO week-year, week
and sequence (`YYYY.W.N`); the jump from 2026.10.0 reflects that numbering change.

### Added
- **Claude Desktop extension.** A `.mcpb` asset connects Claude Desktop to the MCP bridge of the
  running desktop app. It forwards calls and contains no planner; the user supplies the token and
  port shown in the app.
- **Headless MCP server.** The same 41 `planner_*` tools can run on Node without the desktop app,
  over stdio or authenticated loopback HTTP, in an isolated store context. File tools stay within
  a configured working folder, reject symlink escapes and save atomically without a direct-write
  fallback. The source build embeds the guides and examples it needs.
- **Desktop discovery files.** The app writes bridge connection information and an inventory of
  open files for future MCP integrations. Documentation describes the identity and file-permission
  limits explicitly; the shipped Claude Desktop bundle still uses manual connection settings.
- **Arch Linux packaging.** AUR packaging and its build/publication workflow accompany the existing
  desktop installers. Snap and AUR installations leave updating to their package managers.
- **AppImage desktop integration.** Launching the AppImage writes a menu entry and icon in the
  user's data folder, respects existing entries it does not own and supports an opt-out.

### Changed
- **Large schedules.** IFC reading indexes property relations, F5 computes outside the Immer
  producer, resource leveling reuses a forward pass when its prerequisites hold, and large leveling
  proposals render only visible rows. The full calculation fallback remains available.
- **Recovery serialization.** Changed IFC snapshots are serialized by one reusable worker, with
  the existing writer as a fallback. Snapshot ordering, stopping and XER archive references remain
  guarded; file handles and archive bytes do not cross the worker boundary.
- **MCP naming.** Ribbon controls, status, connection dialogs, settings and guides now call the
  external connection MCP. Tutorials use a movable guide panel without the former marking overlay.
- **Release automation.** Weekly releases use explicit recovery, translation and CI gates, a
  deadline, reviewed fix PRs and successor versions when a failed tag needs changed source code.
- **Build inputs.** Tailwind scans only application sources; Vite receives security updates.

### Fixed
- **Translation labels.** Outdated or unhashed label translations no longer force an old UI name
  into a newly translated message. Once the label is current, exact label matching remains required.
- **Recovery and saving.** Unreadable, invalid, duplicate or newer recovery manifests cannot
  trigger writes or cleanup of the refused recovery set. A blocked browser database upgrade
  completes startup with a persistent warning and requires reload before recovery accesses it
  again. Real web-save errors are reported, temporary export files are created exclusively, and
  MCP exports respect the document's file identity.
- **Scheduling and progress.** External minute lags also apply to day tasks. Hour-task block
  boundaries, finish constraints, elapsed-time limits and deadline calendars receive targeted
  corrections. Reversed actual dates are refused; completed tasks without an actual finish retain
  the full scheduling path. Unknown driving status stays distinct from a known non-driving link.
- **IFC and imports.** IFC phase progress and actual dates survive round trips, applying IFC editor
  content preserves document state and identities, and deep WBS structures avoid recursive open
  traversal. Building-model IFC files are refused before a lossy import. MSPDI escapes project
  date fields correctly; MPP import-loss reporting handles resource records, rates, notes, RTF and
  empty baseline dates more accurately.
- **Progress sheets.** Invalid populated CSV dates are refused with row and field context;
  unmatched preview rows state their reason and source identifier.
- **Reports and editing.** Report Print invokes PDF export, Backstage print preview opens the
  correct workspace, and PDF filenames follow the report language. Task calendars show names and
  offer a chooser; milestone creation and assignment feedback are consistent.
- **Help and updates.** Pending actual-start questions survive Help navigation and freeze
  surrounding controls. Update preparation, installation and restart have separate phases, and
  automatic update dialogs wait until guided tutorials finish.

### Documentation
- Updated Dutch and English guides for MCP, reports, recovery, calendar generation, conventions,
  imports, extensions and editing; refreshed README examples and tutorial references.
- Updated the interface translations in all 28 languages through the translation pipeline.
  Guide translations beyond Dutch and English were not refreshed. Missing articles use the existing
  English fallback; older translations remain visible.
- Refreshed wiki feature and installation pages, including the building-model guard and package
  manager update behavior.

## v2026.10.0 — 2026-10-21

A large release: 2,165 commits (228 merged pull requests) since v2026.9.0. It opens Primavera P6
(.xer) files natively and makes the difference between P6, MS Project and Open Planner Studio
calculation explicit through scheduling profiles; adds task types (fixed duration, units or work), task splitting, saved layouts,
a progress sheet that round-trips through a spreadsheet, a resource diagram and seven new table
reports (with a DCMA 14-point assessment); writes schema-valid IFC 4.3 ADD2 by default; ships the
interface and the Help in 28 languages; replaces the Help with a Diátaxis-structured set of
78 articles; and prepares the product for the OpenAEC ecosystem with a headless core package, a
headless HTTP API with a container and AWS definition, a release verification workflow and signed
Windows programs. The features are backed by planning, library, MCP and browser regression coverage,
including a fidelity measurement against P6's own calculated output and the 216-file .mpp corpus.

### Added
- **Open Planner Studio can now open Primavera P6 (.xer) files directly.** A new, self-contained
  XER format layer reads the WBS, activities with duration, dates, constraints and progress,
  relations with lag, calendars, resources and assignments, activity codes, user-defined fields,
  notes and P6's scheduling settings (`SCHEDOPTIONS`). A Level-of-Effort activity becomes a
  hammock. A file with several projects opens one tab per project (the largest first); a project
  that P6 designates as another project's baseline becomes that project's baseline instead of a
  tab; cross-project links are preserved as source data. Documents are named "Project name
  (Project ID)". XER is read-only: the app never writes `.xer` and never changes the file.
- **Saving a document opened from XER keeps the original file inside the IFC.** The complete `.xer`
  travels as a compact, verified source archive, so reopening the IFC still knows P6's own dates
  and settings. An unusable archive (damaged, or rewritten by another IFC program) no longer blocks
  opening: the project opens in full without the archive and a notice explains what is missing.
  Exports to CSV, MS Project XML and P6 XML state per format what XER source data they lose.
- **A new "Dates as recorded" view shows the dates the other package stored in the file.** It
  applies to XER, P6 XML, MSPDI and .mpp (with the provenance carried through IFC, including the
  XER source archive): a strip under the ribbon says that you are viewing the schedule as recorded
  and how many tasks a recalculation would move, the Gantt keeps drawing relations, and the table
  marks values the file did not record instead of inventing them. Started and completed tasks always
  stay on their actual dates, as in P6. The view is offered only for formats that carry real
  calculated output, never for CSV or for an Open Planner Studio IFC without recorded provenance,
  and an IFC that you saved while in this mode opens in it again (a file saved after a
  recalculation opens with the calculation).
- **Scheduling profiles replace the old "if the source is P6" switch.** One solver now runs three
  named profiles — Primavera P6, Microsoft Project and Open Planner Studio — each a set of
  conventions (27 in total, such as how P6 treats out-of-sequence completion, elapsed SS lags or the
  physical-completion point). Opening an .xer selects P6, an .mpp selects MS Project and everything
  else starts as Open Planner Studio; the engine itself no longer knows any file format. The
  profile and its project options survive IFC, crash recovery, MCP and the extension API
  (extension API 1.2.0).
- **Project settings has a Calculation profile block.** Conventions are grouped by theme with the
  profile's base value shown per rule and a "back to base" action; built-in profiles are read-only,
  *New profile* saves your own app-wide template (each project keeps its own copy), and a block of
  deviating calculation options replaces the old *Standard options* button. Applying the block is one
  undo step and is guarded against unapplied changes.
- **Primavera-faithful calculation was measured against P6's own output.** The first measurement
  showed 15,056 six-axis date deviations against the P6-calculated files; the conventions above,
  together with an agreed oracle population (only files P6 itself calculated), reduce this to 76,
  guarded by a ratchet that can only go down, and a `measure:profiles` gate that no exact cell may
  become inexact when engine behaviour changes.
- **Task types link duration, units and work per task.** The task types are Fixed duration and units,
  Fixed duration and work, Fixed work and Fixed units, as in MS Project's Task Type and P6's Duration
  Type; the app shows task type and work once the setting *Use task types* is switched on. Changing a duration, units, the work, the
  resource or the calendar goes through one bridge that keeps the stored work coherent, including
  contours, started tasks and the calendar-switch case. The task type has its own drop-down with an
  explanatory info icon per option, the task grid shows a *Task type* column, and stored work that
  deviates from units × duration is marked.
- **P6 and XML files keep P6's remaining work rate.** For work still to be done the app now uses
  and shows the remaining rate (`remain_qty_per_hr`, `RemainingUnitsPerTime`) and keeps the planned
  rate separately (*Planned units per day*), so a Foreman assignment shows 34 instead of 1.11 next to
  306 h of remaining work, and a duration change gives the same work as in P6.
- **Tasks can now be split by the user.** A split mode in the ribbon cuts a bar at a date in the
  Gantt; pieces and piece edges can be dragged, interruptions can be removed from the context menu,
  and the properties panel has an *Interruptions* section. The leveler never cuts a task that has
  its own interruptions, completed work is protected, and exporting to MSPDI or P6 reports that
  interruptions are lost. The MCP tool `planner_set_task_splits` offers the same.
- **Layouts: every saved view is a ribbon button.** A layout stores only what it contains —
  filter, grouping, sorting, task-table columns, time scale and the overlay group (relation lines,
  baseline, progress line, status date line, resource accent, float band, bar colours). Clicking a
  button toggles it on and off with a restore point, each click is one undo step, a *New layout*
  dialog with checkboxes and info tooltips defines parts, and the built-in layouts *Gantt (WBS)* and
  *Resource diagram* ship with the app. Saved filters now live inside layouts.
- **A warnings panel lists schedule rule failures and navigates to the task, relation or resource
  concerned** (issue #53).
- **The progress sheet round-trips through a spreadsheet.** *Export progress sheet* writes a
  slim sheet — as CSV or as a real .xlsx with column widths, frozen headers, input validation and
  instructions in the column headings — and *Import progress* reads it back from three entry points:
  a preview plan matches rows by override, ID or WBS, shows exactly what would change, and applies
  it atomically. Phases mark themselves in the sheet, ambiguous dates and percentages get specific
  reasons, and the sheet never appears in the recent-files list. The .xlsx reader and writer, with
  their own ZIP and XML handling, have no external dependency (issue #27).
- **Progress entry follows consistent rules everywhere.** Entering progress without a status date
  sets the status date to today (local day) with a notice; progress on a task that, per plan, starts
  after the status date asks for the actual start; lowering the duration of a running task below the
  work already done is refused, otherwise the done work stays and remaining duration and percentage
  follow. The same rules apply in the panel, the context menus, the grid, *Edit task*, the progress
  import and the AI assistant. Phase progress and actual dates are derived from their leaf tasks and
  read-only.
- **A resource diagram report prints the Gantt per resource, one sheet per person.** It groups by
  resource and resource type in two layers, shows units per day and the contour/curve per row,
  supports a reporting period and weekly or monthly grouped load, repeats a legend footer on every
  page, drops the assignment columns when they would leave too little timeline, and can be exported
  as PDF.
- **Seven table reports arrived with discussion #31**: look-ahead, critical and near-critical,
  progress, schedule health, resource loading, resource assignments and WBS summary, plus a shared
  reporting period. Schedule health now starts with the **DCMA 14-point assessment** according to
  EVMS Program Analysis Pamphlet DCMA-EA PAM 200.1 (count, total, value, threshold, result and
  detail per point; a flag is a reason to look further, not a failure).
- **Work distribution per day is now data, and can be edited.** Contours are native in MSPDI and
  P6, the properties panel edits the hours distribution per assignment with a draggable phase strip
  and phase table instead of day rows, and *Double peak* and *Turtle* are full curves.
- **Resource overallocation now explains itself.** A day on which a resource is overbooked shows
  the reason (for example a day off in the resource calendar) in the histogram and in the warnings;
  the histogram resource picker scrolls with a pinned total row, and short hour tasks now carry
  their load into the histogram, overallocation and leveling.
- **The leveling dialog calculates in the background and can be stopped.** Long leveling runs no
  longer freeze the interface.
- **IFC files declare and keep their schema.** New projects are written as IFC 4.3 ADD2 (the
  schema of IfcOpenShell and Bonsai); Project settings offers IFC 4.3 or IFC4 for saving, and a
  file with another schema asks once at the first save whether to keep it. Undo, extensions, export
  and `planner_export_ifc` never change the schema silently. This makes IfcOpenShell `MergeProjects`
  work with IFC4 and IFC 4.3 models (issue #292). A newly written file loses calendar data when it
  is opened in an older app version (see Changed).
- **Time notation setting.** Clock times show in 24-hour or 12-hour notation (default 24-hour) in
  the calendar dialog, date-time cells, split labels, the Gantt hour scale, notices and dialogs;
  storage, files and MCP stay ISO 24-hour. Midnight is `24:00` / `12:00 AM`, a night block such as
  22:00–06:00 is written as "next day", and the input accepts `13`, `1300` and `1 pm`.
- **The status date now has a time, and you can see and change it.** In a project whose calendar
  works in hours, the ribbon (Planning, Baselines & progress) shows a time field next to the status
  date, the status date line in the Gantt and in print stands at that moment, its label reads
  `20-09-2006 17:00` in your date and time notation instead of raw ISO, and the progress line compares
  "done" and "not started" at that moment instead of per day. Two files with status dates 12:00 and
  17:00 no longer look the same while the remaining work differs by half a day. A day-based calendar
  shows no time field and behaves as before, because the solver ignores the time there
  (`isHourModeCalendar`, one test shared by ribbon, renderer, print and solver).
- **The feedback button now sends your feedback directly to Open Feedback Studio, an external
  service run by OpenAEC, and no longer needs a GitHub account.** What you type (title, description,
  the kind of feedback) goes over the internet to `open-feedback-studio.pages.dev`, together with an
  optional e-mail address, an optional screenshot and the app version, operating system and language;
  the dialog states this in a privacy line, and the e-mail address is remembered only on your own
  device (#395, #397). There are three kinds: *Something's not working*, *Idea* and *Question or comment*. The
  screenshot editor gained *Cover* (a solid black block that is drawn into the sent image, so the
  pixels underneath are not sent) and *Retake*; an unsent draft survives closing the dialog during
  the session; and the dialog says when the same report has already arrived or when it is uncertain
  whether it arrived. Only when sending certainly failed does it offer the old route, *Open on
  GitHub*, which prepares the issue as before. If the annotated screenshot cannot be prepared, nothing
  is sent: the editor stays open with an error instead of falling back to the uncovered original
  (#408). Until the studio is linked to this repository, reports
  arrive in the studio's dashboard, not as GitHub issues.
- **Platform build for the OpenAEC app on Frappe.** `npm run build:platform -- --base /path/`
  produces a bundle for a sub-path with a manifest; extensions, AI mode and the demo start are off
  there. Open, Save, Save As, Recent files and crash recovery also work against the hosting site
  through a third file-reference kind (`window.openaecHost`, versions and conflict detection;
  AutoSave deliberately excluded), and `?fakeSite=1` installs a fake site for development.
- **A headless core without the desktop interface: the Node package `@openaec/open-planner-core`
  (#440).** `src/core/` offers three calls: `openIfc(text)` opens IFC text like *File → Open*,
  `doc.schedule()` calculates like F5 (the project's task types and calculation profile) and returns
  a JSON summary (project, start and finish, counts, tasks with dates, late dates, total float and
  critical flag, the critical path and warnings), and `doc.toIfc()` writes the IFC back. Every failure
  is a `PlannerCoreError` with a fixed code (`INVALID_INPUT`, `IFC_READ_FAILED`, `NO_TASKS`,
  `SCHEDULE_FAILED`, `IFC_WRITE_FAILED`). `npm run build:core` builds one ESM bundle for Node 22 with
  type declarations, a generated `package.json` (version = app version, LGPL-3.0-or-later) and the
  licence texts of the bundled dependencies, and fails if React, Tauri or the app singleton end up in
  it; the store itself now comes from a factory (`appStoreFactory.ts`) without that singleton. A test
  proves that the core returns the same dates, float, critical flag, finish and critical path as the
  app for all 32 example files, and `npm run verify:core-package` (new step in `npm run verify`)
  builds the package, installs the tarball in an empty folder and runs the example in
  `headless/consumer-example/`. **The package is not published to npm**: a consumer installs the
  tarball from `npm pack` (`docs/headless-kern.md`).
- **A headless HTTP API, a container and an AWS definition (#442).** `headless/server/` is a small
  server on the headless core: `GET /healthz` (no authentication) and `POST /v1/schedule?output=summary|ifc`,
  which takes IFC text and returns the JSON summary or the recalculated IFC. It needs a Bearer token
  (`OPS_API_TOKEN` or `OPS_API_TOKEN_FILE`; without one the server refuses to start), limits the
  body (20 MiB by default), the calculation time (60 s by default) and the number of calculations at
  once, always answers errors as `{ "error": { "code", "message" } }`, and logs one JSON line per
  request without IFC content or token. The contract is `headless/server/openapi.yaml` (OpenAPI 3.1)
  and a 21-check smoke test runs against it. A multi-stage `Dockerfile` builds a container that runs
  as a non-root user with a health check, and `deploy/aws/ecs-fargate.yaml` defines ECS Fargate
  behind a load balancer with HTTPS, the token from AWS Secrets Manager and a minimal execution role.
  CI (`headless-api.yml`) runs the server, builds the container, runs the smoke test against both
  and lints the template with `cfn-lint`. **Nothing is deployed or published:** there is no AWS
  account yet, so the template is only linted and no image is hosted (`docs/headless-api.md`).
- **The interface and the in-app Help are available in 28 languages.** Thirteen languages are new
  (Russian, Ukrainian, Czech, Slovak, Serbian in Cyrillic, Croatian, Bulgarian, Hungarian,
  Romanian, Swedish, Norwegian Bokmål, Danish, Finnish), Lao joined from a community contribution,
  and the existing twelve were made consistent. A translation pipeline with a per-language
  termbase, source hashes and a release gate (`verify:translations`) keeps them current. A Help
  article read in a language other than Dutch or English shows a notice with buttons to read the
  English or Dutch source.
- **The Help was rewritten around the four Diátaxis kinds and grew from 31 to 78 articles**:
  49 how-to articles, 15 references, 13 explanations and a planning guide, with `?` buttons in
  dialogs and panels that open the matching article, anchors, aliases and draft support. New
  explanations cover calculation profiles, task types, dates as recorded, days and hours, leveling,
  calendars, constraints and the critical path.
- **Tutorials: seven step-scripted tutorials with generated screenshots** (`gen:docs-screenshots`),
  a generated tutorial project ("Aanbouw woning", nl/en) with intermediate states per tutorial, and a
  first-start question that offers the tutorial after the guided tour (no "Just updated" dialog on
  the first start).
- **AI agents get a built-in planning guide.** MCP agents get the planning
  rules in `initialize` instructions, a read tool `planner_get_planning_guide`, and two downloadable
  skills (*goed-plannen*, *progress-update*), all in English.
- **Extension API 1.4.0 adds a `help` permission and `api.help.*` with a guidance panel**, so an
  extension can ship its own Help. Extensions can also read the XER source archive through a
  separate read-only `importSource` permission.
- **Settings show download statistics per operating system and per release**, behind a button on the
  Application tab, fed by a weekly job on the `stats` data branch. The web build also ships
  `release-highlights.json` as the source for the release timeline on open-aec.com.
- **The live browser build opens with an example plan** (demo start), the title bar no longer
  repeats New/Open/Save, and a browser-specific explanation appears when saving.
- **Task grid additions:** summary tasks and milestones are recognisable in the name column
  (discussion #97), right-clicking empty space or typing in a ghost row under the table adds tasks,
  a *Reset to default* button sits in the column chooser, a relation can be added from the
  *Dependencies* section of the panel, and the relation-type drop-down explains the choice with
  the real task names.
- **Gantt additions:** the float band can be switched off (issue #130), a task name moves to the
  right of the bar when it does not fit, and progress is drawn on phase bars.

- **Opening an MS Project file now reports what was not imported.** An MSPDI (.xml) or .mpp file
  gets, like .xer and P6 XML, one notice that stays until you close it, with a line per category the
  reader did not take over: baselines (also Baseline 1–10 and the work or cost in Baseline 0), custom
  fields and outline codes, notes, hyperlinks, fixed costs, rates, inserted projects and external
  tasks, and for MSPDI also manually scheduled and inactive tasks and leveling delays, for .mpp the
  critical threshold. A file that lost nothing, or that the app wrote itself, gives no notice, and the
  .mpp notice keeps the calculation-profile line first. The counting lives in `mspdiImportLoss.ts` and
  `mppImportLoss.ts`; the readers themselves did not change for it (part of issue #391).
### Changed
- **The *Task type* field is now called *Work category*, so that *Task type* can mean what it means
  in MS Project and P6.** The field from v2026.9.0 that holds a category such as *Construction*,
  *Installation* or *Other* is now **Work category**, with *Custom work category* for your own entries
  (Dutch: *Werksoort*). **Task type** is now the new choice per task between Fixed duration and units,
  Fixed duration and work, Fixed work and Fixed units, like Task Type in MS Project and Duration Type in
  P6 (Dutch: *Taaktype*); it was called *Work rule* during development. The setting is *Use task
  types*: a file that carries task types or stored work shows them even when the setting is off. The
  panel field, the task-grid column, dialogs, notices, the Help, the agent texts and the MCP tool
  descriptions follow; the MCP descriptions name both terms, so an agent recognises either. Only the
  visible words changed: no data, IFC property, MCP parameter (`taskType`, `workRule`) or file format
  name (the CSV column `Task Type` still holds the work category).
- **Hours are written the same everywhere: `10h` in English and `10u` in Dutch, without a space (#400).**
  This covers the *Duration* column, the Gantt bar labels, tooltips, the properties panel, print and
  reports, the remaining-work notice (`320u → 88u`), the work deviation on assignments, and lags in
  the grid, the lag field, warnings and the health report. Input is unchanged: `80u`, `80h`, `2u`
  and `2h` work in every language. Spelled-out words ("800 hours of work"), days (`5d`) and minutes
  (`30m`) stay as they were. A lag in the CSV export follows the app language (`3FS+2u` in Dutch,
  `3FS+2h` in English); a language without a readable abbreviation, such as Russian, gets `u`, and
  the CSV reader accepts `u`, `h`, `eu` and `eh`.
- **A duration change now also moves the remaining duration and remaining work of a task that has
  not started.** A task with an explicit remaining duration (typical after a P6 import) used to keep
  the old one: E-1010 went from 80 to 88 h and *Remaining* stayed 80 h. The remaining duration now
  follows, and the task type decides the rest: with Fixed duration and units or Fixed units the
  remaining work becomes units × remaining duration; with Fixed duration and work or Fixed work the
  work stays and the units adjust. Only when stored, deviating remaining work disappears does a
  notice say so (`320u → 88u`; one notice per action, with a count for several tasks, and one
  updating notice while dragging in the Gantt). *Ctrl+Z* restores duration, remaining duration and
  work in one step, and the warning mark returns. MCP agents get no question; the response carries
  `remainingWorkRecomputed`. This also fixed three follow-on faults with the same cause: a start on
  0 % raised the remaining work, the histogram showed a phantom "done" part and, under Fixed work, the
  units did not adjust. Root cause and rule: `settleDurationEdit` in `src/engine/work/workRuleApply.ts`.
- **A task that becomes a summary task always asks what happens with its assignments.** Giving a
  task with assignments its first subtask no longer moves the assignments silently. The dialog *Task
  becomes a summary task* offers *Cancel*, *Remove assignment* and *Move to '<subtask>'*. When moving
  is impossible (the subtask already has the resource, or only a milestone was added) it says why and
  *Remove assignment* becomes the main action; when the assignment already carries actual work, the
  dialog names the hours and focus stays on *Cancel*, so Enter never discards work. One action that
  creates several summary tasks gives one dialog. The choice and the structure change are one undo
  step, and while the question is open all global shortcuts are frozen (Delete, F5, Ctrl+S, Ctrl+Z,
  …). MCP and extensions keep their earlier behaviour.
- **Every refusal is now a red notice that stays until you close it.** A refusal says that your action
  was not carried out: a duration shorter than the work done, a duplicate or cyclic relation, a start
  blocked by a constraint, a dragged actual date, a milestone with assignments, a paste into read-only
  cells, relations skipped on insert, and the locked structure strip during filtering. Many of these
  were blue notices that vanished after 5 s, so they were easily missed. If part of an action
  succeeded, the notice says which tasks or relations were not changed (at most five names, then "and
  N more"). A refused duration entry now shows the real duration again. Consequences of a successful
  action, opening notices at import and real failures stay as they were.
- **The calendar dialog explains a file's own working day.** When the hours per day that a file
  stored (XER `day_hr_cnt`, P6 XML `HoursPerDay`, MSPDI `MinutesPerDay`) differ from the *Standard
  workday* the app calculates, an orange block under that field names both numbers and says that the
  file's value is kept on export. The block follows edits live and disappears when the blocks match
  the file again. Nothing is calculated or exported differently; one comparison (`hoursPerDayDiffers`)
  now serves the dialog and the IFC writer.
- **Floating scrollbars in the task list, also in the desktop app.** The task list gets 8 px overlay
  bars like the Gantt: they take no room, there is no corner square, and the vertical bar sits on the
  side of the Gantt (also in right-to-left languages). The wheel, dragging the thumb and clicking in
  the track behave as before. A related fault is fixed: at the very bottom the list and the Gantt had
  different scroll heights (the ghost row counted on one side only), so the list jumped up when
  scrolling sideways and the rows no longer lined up; both now share one scroll extent
  (`src/engine/taskGrid/scrollExtent.ts`). Checked in Chromium and in WebKitGTK, the engine of the
  Linux desktop app (#362).
- **"Dates as recorded" says per task what a recalculation would do.** The badge in capitals that ran
  outside the panel is gone. *Properties* shows an information block above *Start*, with the line
  "Recalculating changes this task" or "stays the same" and, when the file did not record everything,
  which fields are missing (Late start, Late finish, Total float, Free float). Outside the mode the
  app forgets the recorded dates, so the "x tasks deviate" strip and the red marking are gone;
  changing a work category or task type does not leave the mode.
- **Gantt readability was redesigned (discussion #175).** Rows are taller (32 px) with larger
  bars, labels use the table text size, completed work turns grey from left to right (also on phase
  bars and in print, with one drawing routine for screen and print), the float band is lighter with
  a cross-hatch, the grid density follows the zoom, and the light theme is now a neutral grey scale.
  Saturated brand colours are back on the bars, with their own tints for High Contrast.
- **The day count of an hour task is now working minutes ÷ the net working time per day of its
  calendar** (owner decision 2026-10-15). The calendar dialog's *Standard workday* field (first
  named *Net hours per day*) shows the working time the app actually calculates with — the daily
  total that occurs most often, so Monday 16 h with Tuesday–Friday 10 h shows 10.00 h; the stored
  P6 factor (`day_hr_cnt`) is kept and exported unchanged. A baseline saved with the old day count
  gets a warning marker.
- **Calendar work blocks are always editable in the calendar dialog**, also with hour planning off;
  the *Mon–Fri* and *Continuous* buttons adjust the blocks, and the *Standard workday* field has an
  info icon that explains it.
- **Project info is now "Project settings" and the ribbon button Settings is "App settings".**
  The app settings are reorganised into three tabs (Display, Planning, Advanced) with an explanation
  per section.
- **Warning blocks are red with a triangle icon; info blocks stay orange and follow the theme**,
  and all other warnings use one shared warning colour, so the two kinds are distinguishable in
  the light theme.
- **MCP changed for agents.** Everything an agent reads is English, `planner_run_cpm` is gone
  because the read tools recalculate a stale schedule themselves (and respect the edit and
  calculation-error brakes), `planner_update_calendar` accepts breaks and working exceptions from a
  read-out, and AI backups of a saved file are kept in one fixed folder and thinned instead of a
  fixed ten.
- **MCP calls now belong to a session, and an official MCP client is part of the tests (#439).** A
  successful `initialize` returns an `Mcp-Session-Id`; every later request must carry it (without it
  the request gets `400`, an unknown id `404`), and the check that the document did not change
  under the agent is kept per session, so a second client no longer shares the first one's
  anchor. Sessions survive a bridge restart or port change and are cleared by a new token. The
  bridge also closes each connection after its answer, which fixed a first request hanging after
  a restart. The official MCP SDK now tests the server in `npm test` and, in a separate workflow
  (`mcp-real-app.yml`), against the real desktop bridge. After updating, an AI client must connect
  again (restart Claude Desktop).
- **Notifications are shorter and closable.** Toasts are short, "Relation created" is gone, a
  notice closes with its cross and a click does nothing, an opening notice stays when the app changed
  the data, and a file opened in a format other than IFC explains what the app took over and how
  saving works.
- **P6 XML now follows the XER model.** A file opens as one document per project with its baselines
  linked, the writer produces P6-conform output, the P6 Project-ID is kept apart from the project
  name, and a notice stays visible when relations or activities were left out. Extensions loading a project through `loadProject` keep baselines, calendars, codes,
  fields, GlobalIds, the calculation profile and the document's link to its saved file.
- **A summary task's duration now rolls up from its children** (issue #145).
- **Exports and calendars are more faithful.** MSPDI/CSV export builds the WBS from the real tree,
  never writes a summary as a milestone and writes day durations in task-calendar hours; IFC
  calendars keep work times and day identity; and MSPDI and .mpp calendars take the end of the
  day from the last work block.
- **UI scaling and fonts follow the platform.** The interface font scale now covers the ribbon tab
  strip and auto-fit, and Linux resolves the system font correctly in the web and desktop builds
  (community contributions).
- **Document tabs use arrow buttons instead of a scrollbar**, are semantic, focus-safe and
  race-free, and the close cross and tab name are placed correctly in right-to-left languages.
- **The *Assignments* block in the task panel has one row per resource.** A header names *Resource*,
  *Units* and *Work (h)*; each resource is one line with a colour square, the name, the two fields and
  a bin. Click the name to show *Curve*, *Hour distribution…* and *Move to…* below it (a bar icon
  next to the name shows a curve other than *Uniform* or an own distribution, also when collapsed).
  *Units* shows at most two decimals (the exact value is in the tooltip) and accepts a comma or a
  point; a value that could be a decimal or thousands, such as `1,500` in English or `1.500` in Dutch,
  is refused with a red notice and the value stays. The number fields grow with the shown value, so
  `306,5` or `1234,5` is not cut off at 200 or 280 px, and the warning triangle sits inside the work
  field. Curve, move and assign use the app's own drop-down lists instead of the browser's.
  *Ctrl+S* and *F5* save the field you are typing in (the field is committed, automatic calculation
  runs, then the file is saved), and afterwards *Ctrl+Z*, *Ctrl+Y* and *Esc* belong to the app again.
  An unfinished entry is committed before the document is switched, duplicated, closed, reloaded or
  the desktop app closes, so it never lands in the wrong document or is lost. This brings together
  the work of #369 and #389 (`TaskAssignmentsSection.tsx`, `UnitsInput.tsx`, `pendingTextEdits.ts`).
- **Work and units in the task table use the number format of the language (#378).** The columns
  *Units per day*, *Planned units*, *Planned work*, *Actual work* and *Remaining work* showed raw
  values such as `617.14` and `1.71428571428571` next to a duration of `146,9d`. They now follow the
  *Duration* column: at most two decimals, the decimal sign of the language and no needless zeros.
  Typed or pasted text accepts a comma or a point, and the `name: hours; name: hours` separator stays
  `;`. Opening a cell and confirming with Enter without a change writes nothing, and putting back the
  text as shown keeps the exact stored value, so no history step and no stale schedule appear. In the
  cell editor the units field is now a text field in the language (it was a number field that took
  only a point) and *Remaining work* has an input field for the first time. Copying gives readable
  text in the language with the tokens kept exact, and pasting inside the app is exact. The contour
  window and the axis of the histogram use the decimal sign of the language too, and the
  *Table columns* guide is updated (Dutch and English). The task panel *Assignments* block stays as
  described above (#369).
- **The macOS installers are signed and notarized.** The release workflow signs the app and the dmg
  with a Developer ID certificate, has Apple notarize both and staples the ticket, and then
  checks the dmg with `codesign`, Gatekeeper (`spctl`: *Notarized Developer ID*) and
  `stapler validate`. A failing check keeps the release as a draft, so Windows and publishing wait;
  pull requests that touch signing run the same checks in `macos-sign-check.yml`
  (`scripts/macos-notarize-dmg.sh`, `scripts/macos-verify-dmg.sh`, `release.yml`).
- **On Windows the installed program and the uninstaller are now signed too, not only the installer
  (#444).** In v2026.9.0 `open-planner-studio.exe` was `NotSigned` after installation. The release
  build now has Tauri sign the program, the uninstaller and the setup during bundling
  (`scripts/windows-sign.ps1`, Microsoft's signing client with a checked hash, RFC 3161 timestamp),
  and a gate keeps the release a draft unless the setup and the program carry a valid, timestamped
  signature. CI builds, `tauri:dev` and local builds stay unsigned. A release-like build without a
  tag (`windows-sign-check.yml`) showed valid signatures on all three files; only a real release will
  show that the signed setup, its `.exe.sig` and `latest.json` agree.
- **Every release is now verified on clean runners (#438).** `scripts/verify-release.mjs <tag>`
  checks the minisign updater signatures, `latest.json` and the sha256 of each asset against GitHub's
  digest, and `release-verify.yml` installs, starts and removes the packages on fresh runners (Ubuntu
  22.04 and 24.04, Fedora, Windows, macOS) and checks the platform signatures, automatically after
  each release build. Run against v2026.9.0 it found three faults: the `.exe.sig` did not fit the
  signed setup (the release workflow now signs and uploads it again after Authenticode), the macOS
  app lacked notarization (the signed and notarized installers above) and the installed Windows
  program was unsigned (the item above). Linux packages carry no GPG signature; that is still an
  open decision (`docs/release-verificatie.md`).
- **Reliability evidence for saving, recovery, progress import and large plans (issue #405).** New
  tests prove that a failed save leaves the document marked as changed and the target file intact
  (desktop, web and site; read-only and full-disk targets), that a crash-recovery copy restores every
  document field and the calculated dates (#434), and that applying a progress sheet changes only
  progress fields, that cancelling changes nothing and that applying the same sheet twice does
  nothing the second time (#407). A first measurement of large plans (`npm run measure:large-plans`,
  one machine, headless Chromium, no targets set) gives for 1,000, 5,000 and 10,000 tasks:
  opening 0.5, 2.0 and 3.7 s, F5 0.2, 0.8 and 1.5 s, one leveling calculation 0.6, 8.4 and 37.6 s,
  and an auto-save tick 0.09, 0.28 and 0.55 s; scrolling and zooming stay near 45 ms per wheel
  step (#437).
- **Engineering and release process.** `AGENTS.md` is the single instruction source, the CI runs
  the full verify in parallel parts (deploy now waits for a green CI run), a translation release
  gate and a documentation audit skill were added, code comments were trimmed across the codebase,
  and the full verify no longer runs locally before every push. The browser tests are now spread over
  the CI shards by measured duration (a test guards that every spec runs in exactly one shard), a new
  browser test first extends an existing scenario, a flaky document-switch test was made reliable, and
  an update loop in the feedback dialog that lost the 52nd typed character was removed. The TypeScript
  runner for tests now removes its temporary bundle folder after each run, also after a failure
  (#427), and the IFC round-trip date check no longer fails on days when the creation date equals a
  contract date (#428).
- **A performance and robustness audit touched the hot paths.** Cycle detection and topological
  sorting are iterative and linear, bulk edits and bulk deletes are linear, path calculations and
  the histogram no longer sort or trace per task, relation arrows are clipped before drawing, the
  mini-map caches its day layout, report rasters are exported one page canvas at a time, the
  occupancy overview no longer recalculates the active document, long drop-down lists are
  virtualized, and crash recovery is incremental and atomic with the XER source archive stored once.
- **Undo history has a memory ceiling**, and a document switch keeps the source of the document
  intact; the session history counts baselines in its size estimate.

### Fixed
- **IFC round-trips lost or distorted data.** Fixed: per-weekday work blocks and hours per day of a
  block calendar, project start/end and status date times, a running task at 100%, fractional day
  durations (2.5 d became 5 d), mixed durations such as `P1.5DT2H`, an empty calendar description,
  line breaks and non-ASCII text inside strings (now ISO 10303-21 encoded), conforming GlobalIds
  that tasks, the project, resources, calendars and relations keep, constraint dates written as
  dates, phases with an invalid task status, and `24:00` end-of-day times.
- **The IFC writer and reader were corrected against the schema.** `IfcWorkCalendar`, work plans,
  work schedules and resources are written with the right number of arguments, REAL values with a
  decimal point, schema-correct enumeration literals per schema and negative durations in ISO
  form, and older files, including those merged by IfcOpenShell, are still read. The example
  projects were regenerated.
- **Hours per day, calendars and breaks survive MSPDI, P6 XML and .mpp reopen.** The hour
  promotion no longer resets the stored hours per day, the project calendar is resolved through
  `<CalendarUID>` with the work week inherited from the base calendar, MSPDI work with half-hour
  durations survives export and import, a full MS Project calendar no longer receives Dutch
  holidays, and the task-duration unit is stored in the real `Text30` field (the old `Flag9` ID is
  still read).
- **MSPDI calendars keep their working time to the minute, and a day calendar keeps its break.** A
  calendar whose weekdays have different blocks (for example 08:00–16:00 on weekdays and 00:08–00:16
  at the weekend in `0402ScheduleMSP.xml`) was read as a 24-hour day calendar; it now becomes an hour
  calendar with its blocks per day. The writer writes a day calendar with its real blocks, so
  07:00–16:00 with a 60-minute break survives export and reopening: a 20-day task stays 20 days and its
  successor stays in place instead of shifting by a day. An invalid `7.5:00:00` clock time is no longer
  written (an old export with it is still read as 7.5).
- **The XER reader handles real files more faithfully.** A missing `status_code` is derived from
  progress, Arabic, Cyrillic and Greek files are no longer silently read as Windows-1252, a raw line
  break in a cell no longer truncates the row, a missing planned start no longer becomes 1970,
  the WBS tree has a real root and numeric sibling order, and a project end without an end date no
  longer anchors the late side on the project start.
- **P6 XML now reads real P6 files**: objects inside `<Project>`, progress according to
  `PercentCompleteType`, `Not Started` ignoring actual dates, 24-hour working exceptions staying
  workdays, holidays returned as a series, and a notice when a file has no readable activities.
- **Scheduling engine fixes.** Fixed: an ALAP chain now moves as a whole to the late side, a P6
  crash on FF day-to-hour relations, a day-to-hour relation with a long lag losing the lag backward,
  summary-relation pruning above the expansion budget, a stack overflow in `Math.min/max` over large
  arrays, and the solver no longer writes `scheduleFinish` back.
- **Progress and actual dates stay coherent.** A task read at 100% never gets a start after its
  finish, a completed task without actuals gets its planned start, an automatically filled actual
  start is never after the actual finish, a pure no-op (same value) no longer creates an undo step or
  marks the document changed, and clearing *Actual finish* in a row paste reopens the task.
- **Task dialog and grid editing.** *Edit task* applies the progress rules on Save as a single undo
  step, Cancel now reverts task type, work and assignments, Enter commits both the date field and the
  dialog, Escape cancels cell editing again, keys no longer leak from an open drop-down to
  shortcuts, and an open list is never narrower than its options.
- **Undo behaves.** Colour pickers, resource renames and rate typing are one undo step, a bulk
  action is no longer coalesced across history events, an open edit session is outside the undo
  memory ceiling, and a transaction without a data change no longer creates a step.
- **Gantt interaction and rendering fixes.** Vertical dragging of a bar was restored, scrolling
  reaches the end of a scaled timeline, hour bars longer than a year are no longer clipped,
  relation arrows on hour tasks anchor on the bar edges, zoom and *Ctrl+0* clamp at the new zoom's
  limit, a milestone with only a start can be dragged as a relation source, and a new project (also
  from a template with phases) opens on the project start and shows its tasks instead of an empty
  grid.
- **Crash recovery and saving.** A corrupt recovery file no longer blocks startup, *Later* in the web
  recovery window really keeps the snapshots, a clean exit clears only its own snapshots, closing
  the desktop app asks to save and flushes the last snapshot, the updater stores a snapshot before
  installing, AutoSave no longer reports a false "not writable", saving never truncates the project
  file after a failed write, and blocked or full browser storage no longer breaks loading.
- **MCP reliability.** The document-drift anchor now survives the request boundary, a new token
  really revokes the old one, pause/read-only/dialog guards are checked after every `await`, expired
  queued requests are not executed, `move_project` validates dates strictly, self-relations are
  refused per item, a parent cycle no longer hangs `planner_move_task`, and `clear_leveling` sees
  the same output as the store.
- **Library and calendars.** Renaming a library updates linked open documents, the resource library
  follows breaks and working exceptions of a calendar, and a library calendar refresh follows the
  task type like the calendar dialog; holidays that end before they begin are flagged and refused,
  and *Apply* or Enter without a change is a no-op.
- **Interface fixes.** The resize cursor works again on Linux (Tauri 2.12), F11 in a browser no
  longer starts presentation mode, the white square in the task-list scrollbar corner is gone, the
  centred title no longer overlaps the feedback button, dialogs with input no longer close on a
  click beside the panel, right-to-left splitters and table headers follow the real boundary, and
  "Today" is the local calendar day instead of the UTC day.
- **Adapters and import correctness.** CSV handles multi-line cells, a space before a quote and the
  decimal comma; datetimes with a time-zone designator are read as wall clock; duplicate IDs are made
  unique and reported; MSPDI/P6/.mpp XML detection works on the root element, elapsed-hour lags and
  P6 date precision; and an extension importer now opens as a new document like built-in formats.
- **Security and dependencies.** Vulnerable dependencies were updated (`rustls`, `source-map-js`,
  `brace-expansion`, `browserslist`), and two CodeQL findings were fixed: a pasted percentage such as
  `5%0` or `50%%` is now refused instead of read silently as 50%.
- **Report fixes.** Pagination now breaks on row boundaries, the near-critical count and threshold
  are correct, the status date appears once, export happens after recalculation, a failed PDF export
  reports itself, data columns scale with their content, and the Volume column and `#` column can be
  hidden or removed (issue #93).
- **Extension reliability.** A removed extension no longer revives while its `onLoad` still runs, a
  hanging `onLoad` times out after 15 s, `api.ui.showNotification` is visible to the user, a failed
  extension importer reports an error, and the ZIP download has an idle limit.
- **Entering and calculating values.** Clicking into *Duration*, *Max. units* or the units of an
  assignment now selects the shown value, so typing `1` and then `2` no longer gives `21` (#416).
  A lag of −1.5 days typed in days became −1 while the same lag in minutes rounds to −2; days now
  round half away from zero in both directions, for internal and external relations (#411). Saving a
  branch as a WBS template dropped the minutes of an hour lag (a 4-hour lag came back as nothing); the
  template keeps them now, but templates saved earlier cannot get them back and must be saved again
  (#410).
- **Texts that said the wrong thing.** The Dutch column and property label is *Werkelijk einde*, as in
  the progress import (#409). One day of float reads *1 day* instead of *1 days* in the three float
  fields of *CPM result* (#430). The hint for regenerating holidays no longer calls the generator's
  target year (end year + 1) the project end (#413). The English new-project wizard names its
  calendar *Construction calendar NL* instead of *Bouwkalender NL* (#417). The header under
  *Remaining conflicts* in leveling no longer blames every conflict on too little float, also not
  when smoothing is off (#418). The progress import and the import card name CSV and XLSX, not CSV
  only (#435).
- **Files, recovery and extensions.** After a partial recovery, *Restore* deleted the one unreadable
  copy together with the restored ones; unreadable copies are now kept (#424). In a browser without
  `crypto.randomUUID` the first web recovery session fell back to one shared key, so a busy tab or
  *Later* could crash; all three web paths now make their own id (#423). Cancelling an export in
  Backstage jumped to *Start* as if it had succeeded; it now stays on *Export* (#425). *Save failed*
  on the desktop showed no reason because Tauri plugins reject with a string, not an `Error` (#434).
  A failing local ZIP or JS extension install showed nothing; it now gives a notice, while cancelling
  stays silent (#415). After *Port busy* or *Error* the AI port field stayed locked although the
  bridge was not running; only *live* locks it now (#412). `api.events.emit` in the extension API now
  refuses the reserved `host:` namespace, so an extension cannot forge host events; this guards the
  API contract, not a sandbox (#431).
- **MCP texts and tools told agents the wrong thing.** `planner_get_project_overview` and
  `planner_get_task` described the read-only `wbs` as writable `wbsCode` (#420); the
  `planner_update_calendar` description still said an unused calendar does not survive save and
  reload, though IFC keeps it (#421); `planner_update_tasks` reported an explicit duration on a phase
  as updated although the duration is derived from the subtasks, and `planner_add_tasks` accepted a
  duration on an item that got children in the same call; both are now refused (#422);
  `planner_list_tasks` with `zonder_relaties` reported leaf tasks as orphans that are linked through
  their phase, and now counts relations on all parent phases (#426); and a batch with
  `planner_level_resources` on a stale schedule added an empty undo step (#432).

- **The coloured marker before the WBS number in *Dependencies* no longer looks odd.** It was a pill or
  rectangle of 6 × 10 px with a ring in the text colour (white on dark). It is now 1em, the size of the
  colour square at *Assignments*: a circle for a predecessor and a square with 3 px rounding for a
  successor, so the role is still in the shape and not only in the colour (issue #65). The ring is
  gone. On the light theme the gold and purple have too little contrast against the panel (2.1:1 and
  2.6:1), so only there the shape gets an edge in a 30% darker tint of its own colour
  (`src/styles/globals.css`, `check-dependency-presentation.ts`).
- **MSPDI import read the baseline of an hour task as a date only.** The reader took the time of the
  task dates, but not of *Baseline 0* Start and Finish, so the baseline of a task from 09:00 to 12:00
  lost its times and no longer matched a baseline set in the app. *Baseline 0* now uses the same mode
  as the task dates: an hour task keeps the time, a day task keeps the date, as before
  (`importDateTime` in `mspdiReader.ts`, `check-mspdi-hour-baseline.ts`). A *Baseline 0* whose start
  or finish is empty or unreadable (for example `NA`) counts as missing: the task gets no baseline
  instead of aborting the import or receiving a made-up date (the text `NA` or today's date) that
  would show a false variance (#406).
### Documentation
- Rewrote the user documentation according to Diátaxis (how-to, reference, explanation): the 31
  articles of v2026.9.0 became 78 in Dutch and English, translated into all other languages, with
  new references for shortcuts, settings, calculation options, formats, report types, permissions,
  calendars, columns, notices and the Project settings, and new explanations for calculation
  profiles and conventions, task types, dates as recorded, days and hours, and leveling.
- Documentation audit of 2026-10-19: all findings of high and medium severity were repaired. 64
  Help articles (nl and en) had facts corrected (for example "veertien talen", "86 kolommen", a
  quoted message that does not exist, leveling "within float", presentation "from any tab") and now
  describe functions added since v2026.9.0 (the *Actual duration* column, the IFC schema question on
  Save, the IFC tab as an editor, the right-hand column, the Gantt tooltip, tutorials as an
  extension, the strips under the ribbon, P6 XML notices); the agent texts and MCP descriptions name
  the real tools (`planner_get_calendars`); `AGENTS.md` and the path-bound rules cover six
  architecture changes since v2026.9.0, with a new `import-export` rule.
- Added how-to articles for opening an .xer file, choosing a task type, choosing or building a
  calculation profile, splitting a task, using layouts, importing progress, choosing the IFC schema, editing the hours distribution, picking a
  reporting period and opening/saving through the site; the "Good planning" guide and the AI
  assistant guide were extended.
- Ecosystem readiness (issue #429): `docs/ecosysteem-gereedheid.md` gives a capability matrix (installers,
  updater, browser and platform build, headless core, HTTP API, AWS, MCP, Claude Code and Desktop) and
  the status per requirement, linking to the detail documents added with it: `docs/headless-kern.md`,
  `docs/headless-api.md`, `docs/release-verificatie.md` (outcome of the v2026.9.0 check) and
  `docs/mcp-verificatie.md` (what was tested with the official MCP client and what is not delivered:
  no `.mcpb` bundle, no Claude connector, no stdio server). Still open: a real AWS deployment, GPG
  for Linux packages, publishing to npm, and testing Claude Desktop itself (#453).
- The in-app guide *Connecting an AI assistant* explains how to connect Claude Code
  (`claude mcp add --transport http …`) and Claude Desktop (through `mcp-remote`) (#439). The
  progress-import guide now says that the CSV also accepts decimals with a comma or point and ISO
  dates, not only whole numbers and dd-mm-yyyy (#407).
- Repository documentation: `AGENTS.md` became the single agent instruction source (with
  path-bound rules in `.claude/rules/` and recipes in `docs/recepten/`), `knownbugs.md` collects
  side findings, `docs/platformbouw.md` describes the platform build and site storage, and design
  documents cover scheduling profiles, task types, task splitting and the translation pipeline.


## v2026.9.0 — 2026-09-01

This is a substantial planning-workflow release: 287 commits since v2026.8.1 concentrate on a
single, accessible task grid; explicit day and hour work; more capable reporting; safer extension
handling; and reliable saving and resource leveling. The headline features are backed by browser,
planning, library and MCP regression coverage rather than being isolated interface changes.

### Added
- **One virtual, accessible task grid now powers both the Gantt's task list and the full Table
  view.** It virtualizes large task sets while keeping keyboard cell navigation, selection,
  editing, pinning and row operations consistent between the two surfaces. The grid has a complete
  column registry, a column chooser with recently used fields, and personal per-surface column and
  scroll preferences.
- **Spreadsheet-style task editing is now available in that grid.** Multi-cell TSV copy/paste is
  planned and applied atomically, preserves supported values instead of flattening them to text,
  repeats a pasted tile where appropriate, and skips read-only cells. Task assignments, scheduling
  and progress fields can be edited from the same surface.
- **Dependencies can be edited directly in a task-grid cell.** The relation editor supports the
  relation details and linked-task navigation needed by the former dedicated Relationships surface;
  it also preserves external relation tokens rather than turning them into unstable local links.
- **Projects can define and use personal task types.** A type is reusable on the local installation
  while its stable identity and readable name are stored with the project, so tasks remain
  intelligible after IFC exchange or on another installation.
- **Task duration has an explicit per-task unit: Days or Hours.** Mixed day/hour projects keep the
  unit that the planner chose; an hour task consumes real working minutes in its effective calendar
  instead of being silently converted to a day count. The same unit survives IFC, MSPDI and P6
  round-trips; CSV remains day-based and does not claim to preserve it.
- **Calendars can now express a configurable intra-day break from their simple shift pattern.** The
  resulting working-time bands are used by hour scheduling, resource loading and leveling; users
  can therefore model, for example, a lunch break without manually constructing every weekday band.
- **The resource-leveling core gained controlled interruption and shared-capacity foundations.** It can
  insert calendar-valid pauses into work (including hour-mode tasks), level a chosen task scope
  while treating the rest as fixed load, apply per-task overrun ceilings, and take an external pool
  ledger into account. A headless resource-library distributor can use that ledger to place
  document inputs sequentially against their remaining shared capacity; this release does not yet
  expose that cross-document distributor as a user-facing screen or write-back action.
- **Gantt reports gained clearer planning controls.** Reports can use A2 paper, show a baseline
  overlay, follow the current filtered/grouped view, display a status or progress line, colour
  bars by task/category/resource/automatic mode, and optionally compress non-working days. The
  compressed timeline also uses alternate week bands so adjacent weeks remain readable.
- **Saved filter presets** are available from the filter workflow, and the resource panel can limit
  its displayed resources to the current task selection.
- **Document-bound AutoSave is now available next to Save.** Once a project has a known writable
  IFC file, the user may enable periodic writes back to that file. It deliberately remains separate
  from crash recovery: unsaved documents are never overwritten and recovery snapshots continue to
  protect changed open documents.
- **The interface can now follow the operating system or browser colour scheme.** A new opt-in
  switch in Settings and the welcome dialog resolves the system preference to Light or Dark,
  reacts live while the app is open, and keeps the resolved theme through the first paint so the
  transition does not reintroduce a startup flash. High Contrast remains an explicit manual choice.

### Changed
- **The Table view is no longer a separate editor with different interaction rules.** It reuses the
  Gantt task-grid core, and the old Relations tab was retired after relationship editing and
  navigation reached parity in both grid surfaces.
- **The Gantt is easier to navigate and reposition.** Arrow-key navigation now works in the Gantt
  and histogram, bars can be moved vertically to another task row, the ribbon exposes Fit to
  project, and hour-bar dragging follows calendar working bands rather than a purely elapsed-time
  grid.
- **The report preview was redesigned as a bounded, progressive page renderer.** It renders pages
  locally at a selected quality, keeps a compact control strip and scroll position, and avoids
  creating one unbounded set of data URLs for a large report.
- **Undo/redo, document activation and grid preferences now use a session event model with
  document-aware boundaries.** This keeps a document's history from being offered against another
  open document while still allowing deliberate personal grid-preference changes to be undone.
- **Extensions and their stored catalog data are now validated before they can become runnable.**
  Invalid manifests, JavaScript, ZIP packages and corrupt IndexedDB records are classified and
  shown in quarantine instead of being treated as installed extensions; repaired storage replaces
  the matching quarantine entry atomically.
- **The post-update experience is now driven by a local, versioned highlight catalog.** Its fixed
  primary/secondary-card structure, localized copy and measured release statistics have explicit
  verification, so an update can show curated product changes without depending on a live release
  page.

### Fixed
- **Hour-mode scheduling and leveling now measure work on the task's real calendar.** Fixes cover
  split tasks, calendar-aware delays and lags, effective hour bands, non-working gaps and the
  distinction between calendar feasibility and capacity. Started and completed tasks are correctly
  retained as fixed load instead of being shifted by leveling.
- **The task grid received a focused usability and accessibility repair pass.** Tab, Shift+Tab and
  Escape no longer trap keyboard users; AltGr and macOS Option can still start cell editing; the
  active cell follows the selected task; dropdowns show their full choices; and selection/drop
  indicators remain visible above cells.
- **Grid geometry now remains usable at narrow sizes.** Column resizing and dragging cover the
  intended interaction area, the chooser is constrained to the window, the last header is not
  obscured by its add control, and the Gantt/table splitter reserves sensible column space.
- **Report preview quality switches no longer race stale image work.** Pages are rasterized and
  cached locally with per-page budgets, object URLs are replaced safely, and the preview remains
  sharp without growing without bound on long reports.
- **The MPP reader stops immediately when its monthly cursor cannot advance**, preventing a
  stationary cursor from continuing through an invalid month traversal.
- **Undo and snapshot handling now crosses Immer's draft boundary explicitly.** The shared helper
  preserves the distinction between a producer's original state and its current draft, with a
  behavioral regression test for the invariant. Immer is also pinned to the exact reviewed
  version so local dependency updates cannot silently test different state semantics than CI.
- **Collapsed ribbon groups retain readable labels**, and long tooltips wrap instead of escaping the
  application window.

### Documentation
- Added English and Dutch in-app guides for personal task types, and updated the calendar/hour
  planning guide to describe explicit units, safe conversion, working-time bands and breaks.
- Updated the English and Dutch recovery guide to distinguish always-on crash recovery from the
  opt-in writable-file AutoSave switch, including its browser permission boundary.
- Expanded the report, resource/histogram, filter and shortcut guides to cover the new controls and
  navigation. The release also adds regression documentation for the shared grid, Gantt interaction
  boundaries, extension validation and release-highlight contract.

## v2026.8.1 — 2026-08-19

A release built around one feature, taken all the way from a first read to full date-fidelity:
native MS Project (.mpp) import — plus the mainline work that landed after v2026.8.0 was tagged
(the "dates as recorded" mode, the WBS jump button, the active-between filter). About 357 commits
since v2026.8.0 in total.

### Added
- **Open Planner Studio can now open MS Project (.mpp) files natively.** The format joins the
  existing open pipeline — its own registry entry, a lazily loaded parser chunk, translated error
  messages in all fourteen languages — with no external converter involved: the file's own binary
  container (a Compound File Binary / OLE2 structure) is parsed directly, then its calendars,
  tasks, hierarchy, constraints, relations, resources and assignments are read out of it.
- **.mpp import is now date-faithful to the minute.** Across a 216-file test corpus, every file
  now lands on exactly zero start, finish and same-day deviations after recalculation — no
  exceptions — enforced by an always-on regression gate that fails the moment a single pinned
  file drifts again or picks up an undocumented exception. Getting there took several new pieces
  of scheduling engine, all shared with the rest of the app rather than bolted onto the .mpp path
  alone: task splits are now a first-class feature — read from the source file, carried through
  the critical-path calculation as per-segment remaining work, and drawn as genuinely broken bars
  in the Gantt chart, the print preview and PDF export; leveling delay is read and applied to the
  schedule to the minute; timephased (contoured) assignments now walk their own imported date
  window and duration through the assigned resource's own calendar — holiday-aware, and correctly
  apportioning work when a task carries more than one simultaneous assignment; manually scheduled
  tasks follow genuine MS Project semantics, including how their fixed dates propagate to
  successors; out-of-sequence progress is read from MS Project's own resume/stop fields instead of
  being inferred; and the critical-path solver gained a handful of matching refinements — an
  unsnapped raw anchor for root tasks that start exactly on a calendar band boundary, a
  zero-duration milestone that no longer snaps past its own deadline, and a dedicated rule for
  resumed out-of-sequence work.

- **A "dates as recorded" mode** (issue #63): when a file's stored dates differ from what
  recalculation produces, the app can now show the project exactly as the file recorded it — with
  its own toolbar strip, an in-app guide article, and a working undo path back to the recalculated
  schedule. Leaving the mode is explicit: any date-touching edit or a recalculation returns to
  computed dates.
- **A WBS jump button on dependencies** (issue #65): every dependency row in the task properties
  panel now shows the linked task's WBS number as a clickable button — hover for the same details
  as a Gantt bar tooltip, click to select the task while the chart zooms and scrolls to it,
  auto-expanding any collapsed parents.
- **An "active between" filter field** (issue #32): filter tasks on interval overlap with a date
  range, using both start and finish.

### Changed
- **Nothing a .mpp file contains is thrown away on import, and edits only ever switch off derived
  steering — never delete data.** Raw contour periods, MS Project's task-type and effort-driven
  flags, and every other field added for date-fidelity round-trip through the project's IFC file
  like the rest of the project data. Editing a task that MS Project was actively steering hour by
  hour never silently drops what was read from the source; it only stops that hour-by-hour
  distribution from applying going forward, and the underlying data stays in the document.
- **Editing a task now says, at the moment you edit it, when the edit releases MS Project's
  original hour-by-hour distribution.** A one-time in-app notice appears the first time this
  happens in a document, and the task's properties panel carries a small marker so the state stays
  visible afterwards — both link straight to the relevant section of the MS Project import guide.
  An AI assistant working through the MCP bridge gets the same signal as a `timephasedGuidanceLost`
  field on its response.
- **Every user-facing notification in the app is now in-app.** The last native browser/OS confirm
  dialog (removing a resource library company) was replaced by the app's own confirmation dialog;
  only the file open/save pickers remain native, as they must.
- **The .mpp opening notice now counts real signals instead of estimating them**, and the MS
  Project import guides (Dutch and English) were rewritten so each claim points at the code or
  test that backs it up.

### Fixed
- **Auto-save could fail on a fresh install because the application data directory did not exist
  yet** (issue #72): the directory is now created before the first auto-save or library write.
- **A calendar name collision on IFC round-trip could cross-contaminate two calendars.** Timephased
  duration data translated its resource-calendar reference by calendar name, but the app never
  enforced calendar names being unique — two identically named calendars with different working
  hours could silently swap places after a save/reload. The translation now goes through the
  calendar's own identity instead of its name.
- **A finish-no-later-than or start-no-later-than deadline could push a milestone forward past
  that very deadline.** A guard meant to keep those deadline types from affecting forward
  scheduling ran too early and let a zero-duration milestone snap to (or past) the deadline anyway.
- **Duration, date or duration-type edits did nothing on a task whose imported work distribution
  had already been apportioned across more than one assignment.** The frozen, imported values kept
  winning over the edit; such edits now correctly release that distribution instead of being
  silently ignored.
- **A calendar representing a full day as one continuous band failed to switch into hour-precision
  mode.** Calendars in the "24 Hours" family (one continuous midnight-to-midnight band) were
  missing a needed signal and silently stayed in day-precision mode, losing hour-level detail for
  every resource on them. The fix lives in the shared sub-day calendar layer, so it applies to
  IFC, MSPDI and Primavera imports as well as .mpp — an existing project with such a calendar
  will now correctly promote to hour precision on open.
- **Task durations computed against a non-whole-number workday length (for example 8.4 hours, a
  value MS Project allows) could land one workday late.** A tiny floating-point rounding error was
  read as "not finished yet" and added an extra workday that shouldn't have been there.

### Documentation
- **The MS Project import guide (Dutch and English) was rewritten around what the engine actually
  does now**, not what it did at the start of this effort: split tasks are always visible, manually
  scheduled tasks keep their own dates with no slack by design (not "shows slack"), leveling delay
  is counted in both directions, and contoured assignments follow their imported window but are not
  yet recomputed after a manual edit. The WBS guide and the relations/constraints guide each gained
  a short note on how a manually scheduled task behaves (it doesn't roll up; it wins over a hard
  pin). The import/export guide now spells out what each export format does with
  manually-scheduled, leveling-delay, split and resume/stop data — CSV drops it silently, MSPDI and
  P6 exports warn.

## v2026.8.0 — 2026-08-17

A release centred on cross-document resource visibility — a new occupancy overview per resource
library — plus a round of relation-correctness fixes around milestones and summary tasks. About
100 commits since v2026.7.14.

### Added
- **A resource-library occupancy overview across open documents (issue #19, the part v2026.7.13
  left open).** A new pure core, `computeLibraryOccupancy` (`src/services/library/occupancy.ts`),
  aggregates every open document's bookings against a resource library's pool items per ISO day and
  flags days where the summed load exceeds a pool item's capacity — a double-booking that no single
  project's own histogram can show, since each project only sees its own assignments. The Resources
  tab gained a third view, `ResourceOccupancyView.tsx`, with a table and a per-pool-item histogram.
  A background (non-active) document whose schedule is stale is recomputed on a throwaway clone of
  its tasks (the same `solveProject` core `runCPM` uses, extracted in this release — see Changed) so
  it still counts correctly with current dates, without touching that document's own stored state;
  only a genuine solve failure (a cycle, missing solve input) falls back to showing the document's
  bookings without numbers rather than risking numbers that are neither the old nor the new
  schedule. When "Calculate automatically" is on, opening the overview now genuinely refreshes those
  stale background documents in place (`recalculateStaleSleepingDocuments`) instead of leaving them
  perpetually marked stale — no more switching to each tab and pressing F5. Documents get stable,
  unique colours (assigned by order of first appearance, reusing the shared `DOC_PALETTE`) instead
  of a hash that could collide, the histogram axis compresses non-working gaps, and the chart reads
  left-to-right. New in-app guide "Resource occupancy overview" (NL+EN).
- **Relations on milestones now work, and relations that land on a summary task ("phantom
  relations") are surfaced instead of silently vanishing.** A milestone's diamond hit-test had
  accidentally been reused to arm relation-dragging (since the sticky-Shift mode of v2026.7.14),
  which blocked dragging a relation from a milestone even though the solver fully supports it as a
  predecessor or successor; it now has its own dedicated hit-test, separate from the drag/resize
  hit-test that deliberately excludes milestones. A relation whose endpoint is a summary task has no
  effect on the schedule — the solver only sees leaf tasks — so a new pure rule module,
  `src/state/relationRules.ts`, is now the single source of truth for what a relation endpoint is
  allowed to be. Existing and imported "phantom" relations are kept (filtering them would destroy
  information from the source file, e.g. a P6/MSP import) but are now marked in the Relations panel
  and summarized in one notification after a file loads. Both the direct create path and the
  reassign-an-existing-relation path (`planner_update_dependencies`, which writes endpoints straight
  onto the draft and was a gap the create-path guard didn't cover) now reject a *new* summary-task
  endpoint on the MCP side, sharing one rejection message between both tools; the backstop rejection
  no longer claims a relation "already existed" for cases it doesn't actually know the reason for
  (K3).
- **New tasks now inherit `taskType` from their parent** instead of always falling back to the
  construction-mode-wide default, on both the UI path (`addTask`) and the AI/MCP path
  (`draft.addTask`, including inside nested `draft.addTasks` batches).
- **Resource sets for the example projects.** Across the 24 example topologies in `examples/` —
  eight of which ship with the app via `public/examples/manifest.json` — almost none carried
  resources or assignments, so opening one showed an empty Resources tab and histogram. Eight
  examples now carry realistic resource pools and assignments, all measured overallocation-free:
  six base examples (canal house restoration, N279 bridge replacement, Wassenaar villa, offshore
  wind turbine, Agriport data centre, Almere housing estate) and, in a follow-up pass, the two
  remaining bundled ones (03 Kantoorgebouw Zuidas, 08 Zorgcentrum De Linde). The entry-level
  showcase (verbouwing eengezinswoning) is deliberately left without resources. A new generator module, `scripts/example-resources.ts`, maps task names to
  resources/assignments per example slug, feeding `topologyToSpec` alongside the existing pure
  topology data.

### Changed
- **The CPM solve core was extracted out of `runCPM` (A3/M3).** `src/engine/scheduler/solveProject.ts`
  now holds the pure leaf-filter → `CPMSolver` → `applyCpmResult` pipeline as a standalone function;
  `runCPM` is a thin wrapper around it (stale flag, notifications, extension events,
  `recomputeViewRows`). No behaviour changed for the interactive path — the planning suite passed
  unmodified — but it is what lets the occupancy overview recompute a background document's schedule
  without duplicating solver logic.
- **Test-suite coverage gap closed: the standalone planning run now typechecks every `check-*.ts`
  battery**, not only the IFC round-trip battery it happened to cover before (a new
  `tsconfig.check.json` globs all of them); repo-level `npm run typecheck` already covered this, so
  the gap was specific to running the suite standalone. Assorted `.gitignore` cleanup keeps test
  bundle build artefacts (histogram, relation-rules, assign-resource-guard, and others) out of git
  going forward instead of being caught one at a time after the fact.

### Fixed
- **WBS numbering could desync from the visible task order after `moveTask` without an explicit
  position** — e.g. after changing a task's parent in the Task dialog, or via
  `planner_move_task` — because the move only reordered `childIds` (which drives what's shown) and
  left the underlying `tasks` array (which drives WBS numbering) untouched.
- **Bulk delete now costs one undo step, on all three routes that trigger it** (context menu,
  ribbon Delete button, Delete/Backspace) via a new shared `deleteTasksBulk` in
  `src/state/taskBulkActions.ts` — deleting five tasks previously cost five separate `Ctrl+Z`s.
- **An IFC `DATA;` section boundary is now read case-insensitively.** A file written by a
  third-party tool with a lowercase `data;` token threw a hard "no data section" error on load; the
  boundary check now folds case via character codes rather than assuming a specific casing.
- **The web build now falls back to a download when the environment refuses to grant write
  access**, instead of surfacing a raw `DOMException` as "Failed to save" with no way out. Measured
  cause: some embedded webviews (e.g. inside the Claude desktop app) expose the full File System
  Access API but never grant `createWritable` a read-write permission, unlike a real browser on the
  same build and URL. The distinction is made on error type (`NotAllowedError`/`SecurityError`), not
  on error text, which varies by browser and locale; a genuine write failure (full disk, a vanished
  file) still surfaces as an error, and a user cancelling the picker still does nothing.
- **`assignResource` rejects an unknown or `null` resourceId** instead of poisoning the document —
  an assignment referencing a resource that doesn't exist (reachable via the dev bridge, or a
  corrupted document) previously crashed every subsequent `writeIFC`, including every auto-save,
  in `writeAssignmentMeta` → `guidOf`. `writeAssignmentMeta` also now skips assignments it can't
  resolve, so documents/auto-save snapshots already in that state become saveable again, byte-
  identical for healthy documents.
- **MS Project (MSPDI) export silently dropped the active baseline.** `exportAs('mspdi')` called
  `writeMSPDI` with too few arguments, so baselines fell back to their defaults even though
  `readMSPDI` reads them back in — a real data-loss bug on the export path.
- **Canvas text scale (issue #60), a renderer crash on tasks missing a date, and middle-click
  panning (issue #52).** The `ui.uiFontScale` setting now also scales the Gantt canvas and its
  histogram companion (fonts, row/header height, and the picker row all move together, including
  hit-testing); a task missing a start or finish date used to blank the canvas every frame, and now
  borrows the missing side from the other one, falling back to a visible one-day stub if both are
  absent; and holding the middle mouse button now pans the canvas, without stealing the next
  regular click or starting mid-gesture over a bar drag, relation draw, row drag, or box-select.
- **`<html lang>` now follows the active locale** — screen readers previously announced every one of
  the thirteen non-Dutch locales as Dutch.
- **The Resources tab now opens in Project view by default (issue #64)**, with the resource-library
  hint promoted to a real warning banner (`role="alert"`, icon, amber border); the Library view —
  app-global, outside undo — is now a deliberate per-visit tab choice rather than the default,
  which used to make "New resource" land in the library.
- **The saved theme is now applied before first paint (issue #61)**, via an inline `<head>` script
  reading the same storage key and legacy-name migration as `initTheme`, removing a dark-theme flash
  when the user's preference was Light.
- `npm audit fix` for three advisories introduced after v2026.7.14 (`brace-expansion`/`nanoid`
  high, `postcss` moderate), resolved within existing semver ranges.

### Documentation
- **New in-app guide "Resource occupancy overview" (NL+EN)**, including the write-back behaviour
  when "Calculate automatically" is on.
- **The relations guide (`gids-relaties-constraints`, NL+EN) now explains relations on milestones
  and on summary tasks**, using the established user-facing term "summary task" rather than the
  internal Dutch code term `verzameltaak`.
- **The two newest in-app guides — "Connecting an AI assistant (MCP)" and resource libraries — were
  translated into the remaining twelve locales**, and six other guides (quick start, WBS planning,
  reports/printing, resource histogram, keyboard shortcuts, settings reference) were brought back in
  line with an nl/en source that had grown ahead of them, including the "resource dock" renaming.
- Nine items confirmed fixed and removed from `docs/TODO.md`, each individually re-verified against
  the current code or test output rather than trusted from its commit message.

## v2026.7.14 — 2026-07-30

A release centred on Gantt-interaction polish, a reworked right-hand panel layout, and a round
of maintainability hardening behind one unified `npm run verify` gate. About 88 commits since
v2026.7.13.

### Added
- **Gantt split-view navigation and separate collapse/expand actions (issue #35).** Each pane of
  the split view now has its own horizontal scrollbar and its own mini-map viewport frame —
  previously both drove the primary time window, so the secondary pane's independent scroll/zoom
  was unreachable — plus a real vertical scrollbar the canvas never had (large WBS trees had to be
  navigated by mouse wheel, Shift+wheel in drag mode). Collapse and Expand are now first-class,
  separate actions instead of one per-task toggle: new `collapseTasks`/`expandTasks` store actions
  operate on the whole selection (or globally when nothing is selected), dedicated buttons sit on
  the View tab, collapse/expand works on the group-band headers when rows are grouped, the
  band-header right-click menu gained Collapse all / Expand all, and the task context menu was
  split into two items (#42) that reuse the ribbon keys so the two surfaces can never drift apart.
  The WBS guide (NL+EN) documents them.
- **The right-hand rail became a two-panel layout (issue #46).** Turning on the resource dock used
  to replace the properties panel entirely, leaving it unreachable; the two now sit open together,
  each with its own header toggle (the cross closes the same flag), divided by a draggable
  splitter with a 120 px floor on both sides. The rail keeps its single width and single splitter
  as before — only a vertical axis was added — and a collapsed panel takes just its header bar, so
  "section closed" and "rail closed" stay separate intentions.
- **Resources gained an inline concept row and keyboard navigation (issue #48).** Adding a
  resource opens an editable row that no longer jumps to the bottom of the list after you type the
  name (it renders at its final position from the start, so nothing shifts), stays fully editable
  with the cursor in view, and supports Enter / Shift+Enter to move down and up and open a fresh
  concept row — one commit still costs one Ctrl+Z. The Pin and Histogram toggles also moved under
  the View tab, next to the resource dock.
- **Ctrl+Shift+H toggles the resource histogram**, and the Link button on the Relations tab became
  a real sticky-Shift mode (#40): with it on, dragging bar-to-bar does exactly what Shift+drag
  does — with a crosshair cursor over the bars, a stop strip under the ribbon, and confirm/duplicate
  feedback through the shared notification channel. Previously the button only lit up orange and did
  nothing except silently create one FS link at exactly two selected tasks; the "add relation"
  context-menu item was a second silent no-op in the same path.
- **The duration pill now updates live while dragging a bar edge (issue #51)** — the hover tooltip
  was suppressed during a drag and nothing replaced it, even though the duration already lived in
  the store — and carries the OpenAEC brand accent rather than an inverted theme contrast that read
  as a colourless patch. Hour tasks format from `durationMinutes` (13u / 13h, never 1d) and the day
  suffix is translated. Right-edge drag shows the pill inside the bar; left-edge drag shows it
  outside so it does not overlap the name label.
- **Ribbon density became adaptive, with a manual compact mode and non-native tooltips (issue
  #38).** The ribbon adapts its density to the window width; a manually collapsed ribbon shows
  icons only, the View tab was compacted, and global non-native tooltips replace the OS-native ones
  for consistent cross-platform styling.
- **The updater gained a "What's new" button next to "Check for updates"**, and the just-updated
  dialog was refined: it shows only the current version (not a confusing "from X to Y") and shows
  what's new even on a first run with no previously saved version. The just-updated detection now
  logs to the app log bus.
- **Bundled examples, showcases and the demo resource library are now in English, and every written
  IFC file carries English labels (issue #39)** — the showcase data and IFC header labels were
  previously Dutch, which read oddly for an international audience.

### Changed
- **Snap packaging now publishes to the Snap Store for real.** The release workflow was silently
  skipping the `snapcraft push` step; with the `SNAPCRAFT_STORE_CREDENTIALS` secret it now publishes
  to the `stable` channel on every `v*` tag. The snap gained a `network-bind` plug for the MCP
  bridge's listening port — though measuring the real installed snap (rev 1) showed the bridge
  already bound its port correctly via `browser-support`, so the plug is harmless and kept — and an
  English store title and description that mention the resource libraries and the AI/MCP feature.
  The auto-backup directory was confirmed to work under snap confinement.
- **Continued maintainability hardening (K-items 26–32), mostly internal with no behaviour change.**
  The document contract now forces a conscious choice for every top-level state field: a new field
  is a compile error unless classified as per-document, deliberately-app-global, or derived — so
  data can no longer silently leak between documents, escape undo, or survive `newProject()`. This
  caught a latent cross-document bug (`editingTaskId` from the task dialog survived a tab switch and
  pointed at a task that no longer existed), and two dead UI fields were removed. A circular import
  around `projectSlice` — held together only by function-declaration hoisting, so converting a
  factory to `export const` would crash at module init, possibly only in the production bundle — was
  broken into a leaf `defaults.ts` module and is now guarded by `verify:cycles`. A minimal ESLint
  gate (the promise/regex cases `tsc` cannot see) and an `npm audit --audit-level=high` gate were
  added; the scheduler's `applyCpmResult` was de-duplicated to one implementation; `addTask` now owns
  its own time defaults; and the extension `api.data.batch(fn)` takes one undo snapshot per bulk
  instead of one per mutation (measured on 600 adds: 4.5 s → 1.5 s, 100 → 1 undo steps).
- **`npm run verify` is now the single gate** that CI, the release gate and the deploy gate all run
  — one definition covering all four test suites plus typecheck, lint, examples, docs, cycles and
  audit. The i18n difference check was promoted from an always-exit-0 soft warning to a real gate
  using CLDR plural categories (it had been silently letting twenty new Dutch keys through, with the
  app falling back to English), which surfaced and filled eight real `…_many` gaps in es/fr/it/pt —
  a missing category falls back to English, not to `_other`.

### Fixed
- **Finish-to-Finish and Start-to-Finish relation arrows landed on the wrong edge of the successor
  (issue #59).** The default rendering branch treated FF and SF as finish-to-start, so the arrow
  always pointed at the successor's start (left edge); the CPM math was correct, only the drawn line
  and the report export were wrong. Both render paths (screen and print/PDF) now anchor per type,
  with a mirrored arrowhead direction for finish arrivals; FS and SS are byte-identical.
- **Relation arrows were overdrawn by the task bars (issue #41).** Rather than reversing draw order
  (which would send arrows over labels, the baseline overlay and the progress fill), the routing now
  genuinely avoids obstacles: horizontal travel runs in the gutter between two rows (bar-free by
  construction) and vertical travel in a column with no intervening bars, and the stub points away
  from its own bar. A negative-lag SS arrow no longer leaves a lone floating arrowhead. Measured at
  realistic size (2500 tasks, ~2900 relations): no visible performance change.
- **The Gantt hover overlay truncated long task names and could scroll out of view (issue #58).**
  Long names now run through and the overlay stays in view near the cursor.
- **Report exports lost relation-line styling (issue #56), and the "Today" label collided with the
  day numbers and was missing from the preview.** Relation lines now keep their style through the
  PDF/raster export; the today label goes through the translation layer, no longer overlaps the day
  figures, and appears in the live preview as well as the export.
- **Context-menu actions affected only the clicked task, not the selection (issue #45).** They now
  act on the whole selection and cost a single undo step.
- **Task insertion was inconsistent (issue #49).** Insert-above / insert-below landed at the wrong
  structural position in some surfaces and moved only the clicked task of a selection; it now lands
  in the correct position everywhere (table, Gantt, context menu) and accounts for the entire
  selection when inserting relative to it.
- **A CSS cascade left input fields unusable, the Table tab incomplete, and the Columns entry
  hidden.** `.input` in `globals.css` sits outside every cascade layer with `width:100%`, so a plain
  `w-*` utility on it is dead code — a field dropdown in the group/sort popover measured 11.8 px
  next to a 209 px sibling, and a number field in the resource panel stretched to 1263 px. Seven
  broken call sites were measured and repaired; the Table tab gained its File and Edit groups; and
  the Columns button — previously reachable only from the View tab, where it controls a table that
  is mounted only on the Table tab — now also sits on the Table tab.
- **Fallout from an empty project name.** Making a nameless project truly empty in the data exposed
  four gaps: the MCP bridge sent an empty document title in every response (now an English
  "Untitled" fallback matching the UI), two nameless documents were indistinguishable (now a sequence
  number in the display layer, so no locale-bound string lands in the data), and duplication,
  generated file names and exports handle the empty case gracefully.
- **Smaller fixes.** "Close project" in Backstage opened the new-project wizard instead of closing
  the document (#37); the desktop help viewer showed "Article not found" for every article because
  of an over-strict content-type check on fetched markdown; a nameless schedule now shows a
  translated "New schedule" and an IFC without a project definition gets a translated default name;
  the IFC baseline remap was decoupled from the GUID hash before the collision check (B8); the
  browser dev server now validates a committed port rather than trusting it blindly; and a
  duration-header regression that broke main was fixed without a stray text-alignment mutation.

### Documentation
- **Governance files were added**: `CONTRIBUTING.md`, `SECURITY.md`, English issue and PR templates,
  and a single declared repository owner. `CLAUDE.md`, `AGENTS.md`, `PLAN.md` and the README were
  brought current, and the changes are mechanically enforced via the verify gates.
- **The release secrets behind the delivery chain were inventoried** (`docs/release-secrets.md`):
  what each secret does, what breaks on its loss, and the minisign-key migration path — the one
  irrecoverable single point of failure, since its pubkey ships inside every binary. Release notes
  now come from a single source (`docs/release-notes/v<version>.md`) feeding both the GitHub release
  body and the updater dialog's plain-text notes, instead of a hardcoded generic body paired with an
  empty `notes` field.

## v2026.7.13 — 2026-07-27

### Added
- **An AI assistant can now operate the app directly, through a built-in MCP (Model Context
  Protocol) server.** The new `src/services/mcp/` layer (about two dozen files) exposes roughly
  38 `planner_`-prefixed tools — ten read tools (project overview, tasks, critical path,
  resources, histogram, calendars, baselines) and mutation tools for tasks, dependencies,
  resources, calendars, baselines, documents and files — plus a `planner_batch` executor that
  runs up to 100 scripted steps as one atomic transaction with temporary-id resolution across
  steps. A new AI ribbon tab turns the bridge on/off and opens a *Connection details* dialog
  (endpoint, Authorization header, a ready-to-paste JSON config fragment and connect prompt,
  with the tool count read live from the registry) instead of a client-specific, truncated CLI
  line. Safety is explicit: pause, read-only and an auto-backup (capped at 10 snapshots per
  document) sit next to a ring-buffer activity panel that lists every tool call the assistant
  made. A new `ops-aiAutostart` setting (default off) can start the bridge together with the
  app. New in-app guide "Connecting an AI assistant (MCP)" (NL+EN) documents what the assistant
  can and cannot do — including the resource-library fields it is not allowed to touch (see
  below).
- **Resource libraries (issue #19, partly): a resource pool that lives above individual projects,
  with company binding, provenance and a real editor.** Issue #19 also asked for a cross-project
  overview of where each resource is already booked, to spot double-bookings; that part is not in
  this release and the issue stays open for it. The Resources tab now has two views — a
  Library view that is the source of truth (with its own inline table editor, replacing an old
  `window.prompt()`-based one) and a Project view showing what a project actually assigns from
  it. Identity fields (name, type, description, rate, unit) follow the library and become
  read-only in the project once a resource is linked; assignment fields (max units,
  availability, which calendar to use) stay per-project and editable, governed by a shared
  `RESOURCE_DIFF_FIELDS` diff so the UI and the MCP bridge can never disagree about what is
  locked. A shared `LibraryLinkDialog` handles linking, resolving deviations and reviewing what
  changed since the last sync; libraries round-trip through project IFC files as an
  `OPS_Library` pset with origin stamps, and can be imported either as a new library or to
  replace an existing one. The bundled showcase projects now share one demo resource library.
  The user-facing term "company" was renamed to "resource library" throughout the app.
- **Dragging rows vertically now moves the whole selection, in both the Gantt table and the WBS
  table (issue #21 pt. 1, issue #26).** Dragging one row of a multi-row selection used to move
  only that row and leave the rest behind; a new `moveTasksTo` store action, built on shared
  placement helpers, now moves the entire selection together, in view order, as one undo step,
  and does nothing at all — rather than partially moving the group — if the drop target sits
  inside the dragged selection itself. The underlying single-row drag (`moveTaskTo` +
  `resolveDropTarget`) is shared between the canvas and the table so both behave identically.
- **Gantt/histogram timeline improvements (issue #21 pt. 2/3/5).** A new `compressNonWorkdays`
  setting collapses non-working days out of the timeline axis (a headless `WorkdayAxis`, shared
  by the Gantt and the histogram), so a project with long weekends or holiday blocks no longer
  wastes horizontal space on days nothing happens; horizontal dragging under compression now
  moves tasks in working days rather than calendar days. The day header shows week numbers in
  day view and, from zoom level 40 onward, the day-of-week name next to the day number.
  Ctrl/⌘+click now multi-selects task bars on the canvas (a mousedown hit-test used to reset the
  selection before the modifier key was read). The task properties panel now warns when a task
  spans a long non-working stretch (a holiday or shutdown longer than 7 calendar days), naming
  the dominant holiday.
- **The WBS/task table can now be edited like a spreadsheet (issue #26, requested by Manu
  Varkey).** One click on a cell edits it immediately with the existing value pre-selected; F2
  re-edits without replacing; arrow keys move the cursor without entering edit mode; Enter on
  the last row appends a new sibling task and moves the cursor into its name field; Tab/Shift+Tab
  indent and outdent the selection at row level while staying cell-navigation inside a cell
  (matching MS Project); rows can be dragged vertically using the same placement logic as the
  Gantt. Structural edits are blocked while the table is filtered, sorted or grouped —
  previously silently, now with a banner and a one-click reset. Fixed along the way: the
  progress cell now goes through `setTaskProgress` instead of writing the raw field directly, so
  it respects the status-date invariants and automatic actual-start behavior.
- **Reports gained page-layout controls (issue #25): adjustable font size, a repeatable header,
  and a timeline spread over multiple pages.** `reportFontScale` (90/100/110/125%) scales fonts,
  row height, header/footer and table width relative to the fixed timeline zoom, so text prints
  larger without changing how many rows fit; "repeat header on every page" (on by default) and
  "timeline over 1–8 pages" let a wide schedule print legibly instead of being squeezed onto one
  sheet. All fifteen settings on the Report tab are now persisted — previously none of them
  were, so the panel reset on every reload. A shared `tileLayout.ts` replaced pagination math
  that used to be duplicated between the raster preview and the vector PDF backend.
- **Interface font family and text size are now configurable (issue #25.4).** A
  default/system/serif/mono font choice and a 90–125% text-scale setting apply through shared
  CSS variables — including the Gantt and histogram canvas renderers, which previously
  hardcoded their font stack in up to 17 places, and 60 inline pixel font-size declarations
  across ten chrome stylesheets that didn't scale with the rest of the UI. Row height and bar
  geometry on the canvas stay fixed on purpose, so the scale setting affects text only, not
  layout, there.
- **A "you were just updated" dialog appears once after an in-app update completes.** It
  compares the previous and new version via the GitHub Releases API — install size difference,
  days since the previous release, the release description, and an OS-aware asset choice — and
  is gated to never show alongside the welcome or recovery dialogs at startup.
- **The in-app help viewer got its own language picker, independent of the UI language**, with a
  per-article English fallback and a warning banner on any language other than Dutch/English
  (those are translated less frequently). `verify:docs` grew from checking 2 to 14 languages,
  including heading/link-parity and drift checks against the English source, so a translation
  that silently drops a section or a link now fails the build.
- **Developer tooling: the browser dev server now gets the same per-worktree isolation the
  desktop dev build already had, plus a double-start guard.** `npm run dev` used to hand Vite a
  bare port and fail (or, worse, silently serve a second worktree's code into an already-open
  window) when two checkouts were active. It now runs through `scripts/dev-server.mjs`, which
  allocates a port anchored to the worktree root, claims a guard slot so a second start in the
  same worktree is refused outright instead of drifting to another port, and stamps
  `.claude/launch.json` so tooling opens the right worktree. Port allocation and the lock
  protocol (atomic rename-claim + verify + link, stress-tested with 8 concurrent stealers) are
  shared with `scripts/tauri-dev.mjs`, which was refactored onto the same helpers and passes
  `OPS_DEV_GUARDED` down so a nested `dev` start doesn't allocate twice. Only relevant when
  developing the app — no user-visible change.

### Changed
- **Startup and bundle size.** Twenty dialogs, Backstage, the tour overlay and the rarely-open
  panels (IFC, Report, AI activity, Debug Terminal) now load via `React.lazy` instead of eagerly,
  cutting the app's eager
  first-load JS by about 17% (288,723 → 239,644 bytes gzip). Translations for all but English
  now load per-language on demand instead of all 14 locales upfront, cutting eager JS by
  roughly 41% in that change alone (488,982 → 287,864 bytes gzip) with no flash of untranslated
  text, since the active locale loads before first paint. Auto-save now re-serializes only
  documents that actually changed instead of every open document on every tick (measured: 318 ms
  → 64 ms with one dirty document out of five open), and the Gantt's long-free-period scan is
  memoized instead of re-running on every store mutation.
- **Continued modularity cleanup, with byte- and pixel-identical output verified before and
  after.** The IFC writer/reader's hardcoded `IFCTASK`/`IFCTASKTIME` field layouts became shared
  slot descriptors (one source of truth instead of three); the Gantt, histogram, minimap and
  print renderers now read colors from one shared `themePalette` and share a `timeAxis` module
  instead of duplicating date-to-pixel math; and `TaskTime` was split into four typed,
  compile-time-checked roles (input/computed/analysis/tracking) so it's clear which fields a
  caller may write versus which `runCPM` overwrites. Verified with SHA-256 diffs of IFC output
  and a 10,686-call canvas draw-log comparison across 22 fixtures — zero differences.
- **Zoom-and-drag ("drag") is now the default Gantt navigation mode** (issue #22), and the
  horizontal scrollbar now spans only the chart area instead of running the full window width
  under the frozen task-name column, which was confusing since only the timeline actually
  scrolls. Anyone who had already picked a mode keeps their choice.

### Fixed
- **Dates near a month boundary could shift by a day depending on the machine's timezone.**
  `parseDate` built a UTC-midnight instant and then read it back with local getters, so under
  any negative UTC offset a date one day early was possible — invisible on a machine in Europe,
  but the regression suite dropped to 311/431 under `TZ=America/New_York`. The calendar part is
  now read textually from the ISO string instead. `tests/planning/run.sh` now re-runs the built
  suite under five timezones (UTC, New York, Midway, Auckland, Azores) on every full run so this
  class of bug can't hide again.
- **Task names or notes containing `);`, `/* */`, `ENDSEC;`, `DATA;` or an apostrophe could
  silently corrupt a saved project.** The IFC parser split on those substrings without tracking
  whether they were inside a quoted string, so ordinary Dutch text like "Fase 1 (ruwbouw); fase
  2" could truncate the parsed section or drop the wrong number of arguments — worst case, a
  duration of 7 came back as 5 on reopen, with no error. The writer had the matching bug: an
  apostrophe in a project name, author or company produced syntactically invalid STEP output.
  All three parsing sites now share one quote-aware scanner; the header writer quotes those
  three fields properly. Files written by earlier versions keep opening, which took one more step:
  their header can carry exactly that unbalanced apostrophe, and a quote-aware scan desynchronises
  on it and finds no data section at all. The `DATA;` section boundary is therefore looked up
  quote-aware first — correct for any well-formed file, including one written entirely on a single
  line or with `DATA;` inside a comment — and only falls back to a line-anchored lookup when that
  finds nothing, which is precisely the broken-legacy-header case. If neither finds a boundary the
  read now fails with a typed error rather than quietly opening as an empty project on top of the
  original file's path, and crash recovery no longer deletes snapshots that failed to parse. The
  writer also stops emitting raw line breaks in those three header fields (reachable through an
  imported file or the MCP `update_project` tool): a STEP string literal may not span lines, and a
  line break there put arbitrary text at the start of a line where it could pose as a section
  boundary.
- **Three compounding bugs in crash recovery could silently lose an entire relationship
  network, or let one instance overwrite another's recovered work.** Auto-save wrote recovery
  snapshots non-atomically and the reader had no truncation check, so an interrupted write
  (crash mid-save) could leave a complete-looking project with all its tasks but none of its
  dependencies — no error, and the broken snapshot was then deleted after "recovering" it;
  snapshots are now written to a temp file and atomically renamed, and a truncated or non-STEP
  file is now rejected with a typed error. Baselines were separately dropped during recovery
  because the recovery input builder enumerated fields by hand and missed two of them. And two
  app windows (or two duplicated browser tabs) sharing the same recovery storage would overwrite
  and delete each other's snapshots; recovery bookkeeping is now scoped per installation/session,
  with a single-instance guard for the desktop build (skipped for concurrent dev instances) and
  a per-tab Web Lock in the browser.
- **Exporting to CSV/MS Project/Primavera P6 could silently ship dates from a stale,
  un-recalculated schedule.** Automatic recalculation is off by default and mutations only
  flagged the schedule as stale via a small status-bar note; every exporter wrote
  `task.time.earlyStart` regardless. Export now recomputes a stale schedule first and refuses to
  export if that recompute hits a dependency cycle, on both the ribbon export path and the
  Report tab's PDF export (which has no Gantt canvas mounted, so the existing cycle warning
  never reached it there).
- **Save and recovery failures used to fail completely silently, and the unsaved-changes
  indicator could lie.** The only user-facing feedback channel was a local toast inside the
  Gantt canvas, invisible from Backstage, the table or the report panel — exactly where an
  export or save is triggered. A new store-driven notification channel (errors stick, info fades
  after 5s, repeats within a channel collapse into one with a counter) now surfaces all eight
  previously-silent failure points, including `saveFile`, which had no try/catch at all.
  Separately, `isDirty` was being cleared based on when a save *started*, not what was actually
  on disk when a slow native save dialog finally returned — anything typed in between was marked
  as saved while sitting in no file at all; it's now compared against the actual serialized
  content.
- **A release could ship, get signed, and auto-update everyone's installation even with a
  failing test suite.** `ci.yml`'s four gates (typecheck, planning suite, `verify:examples`,
  `verify:docs`) only ran on pushes/PRs to `main` — a release tag matched neither, and
  `live.yml`'s production deploy had no gate at all. Both workflows now run the same blocking
  gate before creating a release or deploying; `release.yml` additionally checks the tag against
  `package.json`/`tauri.conf.json` so a forgotten `npm run bump` can't ship a version the
  auto-updater silently treats as unchanged; and `snap.yml` now triggers on `workflow_run` after
  the release workflow instead of on tag push (which GitHub-token-created tags never fire),
  fixing v2026.7.12 shipping without a Snap asset. Separately, `scripts/` and `tests/` (about 19k
  lines) were never typechecked — they run through esbuild, which strips types without checking
  them — so a case file with nonsense keys or an `expect: {}` could pass silently; a new
  `tsconfig.tests.json` closes that gate and is now part of both CI and the release checks.
- **Two independent hardening fixes.** An extension's SVG icon was rendered as raw HTML in
  three places, including the extensions list — which runs before a user ever enables an
  extension, so a disabled extension's icon alone could execute script; icons are now parsed and
  rebuilt through a strict allowlist that strips event handlers, `href`, inline `style` and
  script-capable elements. And the Rust shell's unused `read_file`/`write_file` commands, which
  did no path validation and bypassed the `plugin-fs` scope, were removed entirely — unused by
  the frontend, but reachable from extension code via `window.__TAURI_INTERNALS__.invoke(...)`.
  Separately, `postcss` was bumped 8.5.15 → 8.5.18 for GHSA-r28c-9q8g-f849 (not reachable here,
  since postcss only ever processes the app's own build-time CSS, but the patch was free).
- **Three UI clipping/overflow bugs reported by users.** The Save As/Update/Manage ribbon button
  row could cut text off mid-letter in a longer language (#29); the report panel's Company Name
  field could overflow past the panel edge because a `!w-auto` utility class overrode its
  intended `width: 100%` (#28); and the Gantt minimap's viewport indicator and canvas could
  exceed the strip's bounds when zoomed out past the project period or when the canvas hadn't
  yet stretched to fill its container (#30).
- **Four pre-existing task-structure bugs, all found while testing this release's drag and
  table work.** Outdenting a task placed it at the end of its new parent's children instead of
  directly after its former parent, contradicting a years-old interface comment; reordering a
  non-root sibling updated the tree's `childIds` but not the raw task array that WBS numbering
  and row order are actually derived from, so the WBS column could disagree with what was on
  screen; a downward drag-and-drop reorder within the same parent landed one position too far
  because the drop-target resolver and the actual move used different reference lists; and a
  corrupted `parentId` cycle from a hand-edited IFC file could hang the app in an infinite
  ancestor walk. All four now share the same placement helpers and cycle guards as the new
  multi-selection drag.
- **A stray `$` (IFC's "no value" marker) could appear as literal text in the properties
  panel.** Four optional text slots (task description, WBS code, resource/calendar description)
  used a plain quote-stripper instead of the shared null-aware helper, so an unset field
  round-tripped as the character "$" instead of nothing — visible across every task in a bundled
  showcase. Files already re-saved with the literal "$" need a one-time manual cleanup; it can't
  be told apart from an intentional "$" automatically. Also fixed: the constraint dropdown's
  "(ASAP)" suffix used to slide under the panel's collapse arrow because the two constraint
  fields were laid out side-by-side instead of stacked.
- **Undo history had no upper bound**, and each edit deep-clones the changed fields (~4.95 MB
  per snapshot at 5,000 tasks) with per-document undo/redo stacks kept for every open — even
  inactive — document, so memory scaled with edits × project size × open documents. It's now
  capped at 100 steps. Separately, a document restored from crash recovery showed no staleness
  warning even though it hadn't been recalculated (`switchDocument` never calls `runCPM`), so it
  could look like a valid, up-to-date schedule with no critical path or float actually computed;
  it's now marked stale on restore. And typing into an "actual start"/"actual finish" date field
  used to push one undo step per keystroke, since those fields go through dedicated setters that
  lacked the coalescing key the rest of the undo overhaul already had — completing that earlier
  work, they now coalesce into one step per edit.
- **Keyboard focus could escape an open dialog.** Tab/Shift+Tab had no boundary, so keyboard
  navigation could tab out into the app behind a modal. A shared `useFocusTrap` hook now keeps
  focus inside the panel, focuses the first focusable element on open, and restores focus to the
  trigger on close — applied to all 18 dialogs built on the shared `Dialog` component plus the
  two dialogs with their own overlay (Feedback, Settings).

### Documentation
- **The repository claimed LGPL-3.0 in five places (README, PLAN.md, CLAUDE.md, the wiki) but
  shipped no license file at all**, which legally defaults to all-rights-reserved and left the
  README's license badge showing "unknown". `LICENSE` (LGPL-3.0, which incorporates GPL-3.0 by
  reference) and `LICENSE.GPL` were added verbatim from gnu.org, and `package.json` now declares
  `LGPL-3.0-or-later`.
- **The GitHub wiki is now generated from the same sources as the in-app manual** instead of
  maintained separately: `scripts/publish-wiki.mjs` builds it from the English manual, the
  wiki-specific pages (Home, Features, Installation, Contributing, Extensions-Authoring) and
  this changelog, rewriting cross-links to wiki pages and stamping a "generated — don't edit"
  banner. Dry-run by default; `--push` publishes at release time.
- **The in-app manual is now available in all 14 supported languages**, not just Dutch and
  English — 25 articles translated into the remaining 12 (300 files), with domain terms (float,
  summary task, resource leveling, …) matched to each language's existing UI terminology rather
  than translated freestanding. Two new articles were added in Dutch and English: "Resource
  libraries" and "Connecting an AI assistant (MCP)".
- **README screenshots refreshed** to the current app (main Gantt view with critical path,
  progress and milestones; the Report tab's live A3 print preview; the task context menu),
  replacing outdated captures.
- **A repository-wide maintainability audit was carried out and recorded**
  (`docs/onderhoudbaarheid/`) — ten area reports plus independent critical reviews of each,
  correcting several of its own early claims (a timezone bug reproduced under
  `TZ=America/New_York` that cut the suite to 311/431, three XSS sites, a missing undo cap, a
  missing staleness guard on export) before turning into the fixes listed above.

## v2026.7.12 — 2026-07-23

### Added
- **PDF report export is now vector-based with selectable text (issue #23).** The export of the
  Gantt report, the milestone overview and the variance report previously embedded the rendered
  preview as a single raster image in the PDF file — sharpness depended on the canvas resolution
  and nothing could be selected or searched. The export now draws directly as PDF vectors
  (lines, fills and embedded, subsetted text) via `pdf-lib`, so the result stays sharp at every
  zoom level and text is selectable/searchable — exactly as expected from a "real" PDF.
  This applies to Latin, Cyrillic and Greek text (embedded with the bundled Inter font, see
  below); documents with **CJK text (Chinese/Japanese/Korean) or RTL text
  (Arabic/Persian)** are detected automatically by the export and fall back to the old
  raster export — still perfectly legible, but not selectable. Vector CJK will come later via
  an extension; vector RTL follows in a later phase. (Under the hood, RTL shaping/bidi and
  CJK harfbuzz subsetting are already in place and exposed behind a font-provider extension API.)
- **Move project…** — a feature that shifts the entire schedule to a new start date in one go,
  with a calendar-aware warning when the project end or the project duration ends up different
  than chosen (see the accompanying i18n fixes under *Fixed*).
- **Built-in benchmark tool** — reachable via Settings; measures the compute time of the
  scheduling engine (including `runCPM`) on the user's own machine, as a frame of reference for
  the performance work below. App plumbing, no IFC impact.

### Changed
- **The print/export font for reports has changed from the system font stack to the bundled
  Inter.** This belongs with the vector export above: the old preview/export measured
  text widths with whichever font the operating system happened to offer first in the stack, which
  differed per platform (and sometimes per machine). Now it is always Inter, so the layout is
  deterministic across Windows/macOS/Linux/browser. Side effect: existing exports may come out
  slightly differently on re-export — a slightly different text width can make a line wrap or
  run on, which in turn can shift the number of pages. Functionally identical, visually not
  necessarily pixel-equal to an export from before this change.
- **Project data can now be undone.** Name, description, author, company, start and end date,
  data date, progress mode, calculation options and the project-calendar choice were until now
  entirely outside undo. They are now in the snapshot and every change is an undo step, with an
  equality check in front of it so that saving-without-change does not produce an empty step. This
  immediately repaired two existing half-restore bugs: undo after deleting a calendar or saving
  the calendar library did restore the library but not the project calendar, after which the
  internal cache stayed pointed at the wrong calendar. A typed-in data date now costs one undo
  step instead of three (the date field commits on every keystroke).
- **The large example project got a second construction stream.** It showed multiple critical
  paths only thanks to the data error described under *Fixed*; with correct data there was one
  path left. Phase 7 has been expanded into a genuine parallel stream: as soon as the parking deck
  is poured, its own crew starts on the garage fit-out, which runs via the outdoor area with no
  float to the same delivery date as the towers. Bonus: the temporary construction road was
  previously torn up while the towers still had to go up — that order is now correct.
- **The IFC writer no longer writes the derived analysis properties.** The pset `OPS_Analysis`
  (interfering float, near-critical, float-path number) contained solely output of the
  scheduling calculation with no user input; all 589 tasks in the examples reproduced their
  stored values bit-exact after recalculation. That saves about 157 kB in the bundled
  examples — the web selection went from 726 to 567 kB — and roughly a fifth of every automatic
  intermediate save, which runs every 800 ms per open document. Existing files with these
  properties load unchanged; crash recovery now recalculates, just like every other load path.
- **Performance of the scheduling engine (based on the new performance audit).** Byte-identical
  results, only faster: `CalendarEngine` now computes working days numerically/arithmetically with
  an allocation-free `isWorkDay` instead of day-by-day with date strings (the audit pointed to
  this as the main culprit, effectively O(n²) on large schedules); the summary rollup uses an
  id→task `Map` instead of a linear `find` per task; and the undo snapshot is taken from the
  ordinary pre-mutation state instead of from the Immer draft.

### Fixed (minor items from the 2.10 triage, 2026-07-20)
- **The calendar warning for "Move project…" contained an empty message.** The
  warning fires on two independent symptoms — the project end shifts by a different
  number of calendar days than chosen, and/or the project duration in working days changes — but
  always named both. If only one occurred, it stated something meaningless: "the project duration
  goes from 177 to 177 working days", or the other way around "the end shifts 11 calendar days
  instead of 11". Both cases occur in practice; in a schedule without public holidays in the
  shifted window, "only the end shifts" is even the common case. Now three variants with their own
  text.
- **"Move project…" showed plurals for a single item.** The warning lines wrote
  "1 tasks have a hard Mandatory pin" and "1 external links"; the detail line turned it into
  "1 deadlines". The five count keys now use i18next pluralization in all fourteen languages.
  In the process a catch surfaced: if one plural category is missing in a language, i18next does
  **not** fall back to the `_other` of that same language but to `fallbackLng` — a Polish user
  with two items would then see English text. Every language therefore has exactly the categories
  that CLDR prescribes (Polish four, Arabic six), guarded by the new battery `check-i18n-plurals`.
  The detail line was rebuilt from one sentence with five counts to "label: count", in which the
  label does not agree with the number; zero categories now drop out instead of showing
  "0 deadlines".
- **Lag was lost in the backward hour calculation with a milestone predecessor.** In the
  finish-start relationship the boundary flags `predEndsBeginOfDay`/`succIsFinishMs` did double
  duty: alongside the finish normalization they also suppressed the lag, whereas the day
  calculation always applies the lag and lets the flags decide only about the day step. The result
  was a wrong total float and a wrong critical path in hour-based scheduling — the same schedule
  gave `tf=1` and non-critical in hour mode versus `tf=0` and critical in day mode. Forward and
  backward calculation thus contradicted each other. Five new cases in `cases-hours-relations.json`
  capture it, including a negative lag (lead) and day-parity anchors.
- **Day/hour asymmetry with a start-milestone predecessor.** The hour branch pulled the day-start
  anchor of a start milestone via `prevWorkInstant` back to the previous band end, whereas such a
  milestone has no real finish instant and the day branch actually keeps the target-date label.
  Work-equivalent, but the milestone showed a late finish on the previous working day in hour mode.
  The day side was covered nowhere — existing milestone cases asserted early but no late dates —
  and now has a parity anchor.
- **Completed tasks in the large example project appeared to overrun.** The generator wrote
  actual dates from hand-written working-day indices in which `finishDay − startDay == dur`,
  whereas the index translation counts inclusively; moreover that translation only skipped weekends
  and no public holidays, causing a task to start on Good Friday. Every completed task therefore got
  a day of apparent overrun, which in the backward calculation stacked back up to `TF=-4` on the
  start milestone. Actual dates now come from the fully-computed, calendar-aware schedule and the
  data date is derived from the planned end of the crane erection instead of from a fixed day index.
  The example now has zero tasks with negative float. Two cases in `cases-progress.json` capture the
  underlying solver behavior (completed as planned ⇒ float 0; overrun ⇒ negative float).
- **The properties panel showed a different start date than the Gantt bar.** Four surfaces
  (bar, tooltip, table, task dialog) show the computed date; the panel was the only one showing the
  raw anchor date. Measured across all 24 examples this ran up to 484 days of difference, and in the
  large example 246 of the 249 tasks diverged — the panel simply showed the project start date for
  almost every task. The field now shows the computed date and writes to the anchor only on a real
  change, with an explanatory hint in all 14 languages.
- **The contractual project dates did not survive the IFC round-trip** — the deliberately set
  project start/end date was not reliably read back on save-and-reload. Sealed and covered.
- **Ribbon dropdowns went wrong after the portal fix.** The RibbonDropdown panel (including the
  timescale) lost its width; dropdown menus such as Milestone were clipped by the ribbon itself;
  and the right-click menu fell below the window for milestones low in the task list. All three
  fixed.
- **Empty undo steps on delete actions.** `removeSequence`, `deleteTask`, `removeResource`,
  `removeCalendar` and `deleteBaseline` pushed an undo snapshot before their filter, so a call
  with an unknown id left an empty step behind.

### Documentation
- **OFL-1.1 license text vendored with the bundled Inter** (`src/services/pdf/fonts/Inter-OFL.txt`
  + explanation in `src/services/pdf/fonts/README.md`) — the Open Font License requires the
  license text to be bundled with the font; that obligation was still missing since Inter was
  vendored as a raw TTF in phase 0/1 of the vector-PDF export (issue #23).
- The guide **Reports & printing** (`gids-rapporten-printen`, nl+en) has been updated for the
  vector export: an explanation that the PDF file now stays sharp at every zoom level and contains
  selectable/searchable text, plus the CJK/RTL raster fallback.
- README provided with a badge bar (version/CI/deploy/suite/languages/license) and a
  download-counter badge; the performance & modularity audit has been recorded as a measurement
  report with a phased plan.

## v2026.7.11 — 2026-07-20

### Added
- **Opening and saving files in the browser.** The web version was until now fully usable
  except for file I/O — which sat behind a desktop check. That gap is closed:
  - **Open, save, save-as and export** (IFC, CSV, MS Project, Primavera P6) now work
    in the browser as well.
  - **Browsers with the File System Access API** — in practice the Chromium family (Chrome, Edge,
    Opera, Brave, Vivaldi, …): you open a file, edit it and save with Ctrl+S **over the same
    file**, exactly as on the desktop. The browser asks for write permission once.
  - **Browsers without that API** — currently Firefox and Safari: a clean fallback, opening via a
    file picker and saving as a download. In-place overwriting is not possible there; nor is it
    suggested.
  - The app looks at the **capability, not the browser name** (feature detection). If a
    browser rolls out the API later, in-place saving works there automatically — without a new
    version.
  - **Recent files** can be reopened in browsers with that API (the reference to the
    file is kept, not just the name). If the support is missing, the list is
    hidden instead of showing non-working items.
  - **Auto-save and crash recovery** now work in the browser too: on every change a (debounced)
    snapshot per open document is kept, and after a crash or accidental close the app offers
    to recover on startup. If you close the tab with unsaved changes, the browser
    warns first.
  - The desktop version does not change as a result: it uses the same shared layer with the
    existing file-system behavior.
- **Construction-mode toggle** — a construction-agnostic mode for use outside the construction
  context (design: `docs/superpowers/specs/2026-07-13-bouwmodus-toggle-design.md`).

### Changed
- **Large cleanup round based on a modularity audit of the entire codebase.** No
  functional changes, but structurally fewer places where the same mistake can arise again:
  one canonical document contract for per-document state (capture/restore/undo), a transaction
  helper that replaces a pattern repeated 50×, one shared load path, a pset registry that couples
  the IFC reader and writer, a declarative ribbon and settings registry, shared dialog primitives,
  a stable extension facade with a central permission table, one relationship-math module, and
  `App.tsx` reduced from 741 to 345 lines.
- **Test coverage expanded** with batteries that permanently guard the just-closed gaps:
  IFC round-trip, document contract and Gantt-float visibility.

### Fixed
- **Eight gaps through which data was lost on save have been closed.** The storage contract
  now demonstrably round-trips completely (with a new test battery that permanently enforces this).
- **Opening lost activity codes and custom fields.** All open paths now run through one shared
  load implementation, so structural data no longer silently drops out.
- **The fast save route in the browser dropped fields** (activity codes, custom fields,
  baselines, calendar library). All state→IFC routes now build their data in one place.
- **Float disappeared on horizontal scroll.** The float band was skipped together with the task
  bar as soon as that bar scrolled off the left edge, even when the band itself was still clearly
  visible.
- **Gantt dragging:** dragging the bar edge now writes the correct (inclusive working-day)
  duration, and every duration is reachable — including the initial value.
- **Non-working days were always shaded as Saturday/Sunday** instead of according to the
  project calendar; crew and deviating calendars now display correctly.
- **Crash when switching document** after a recovery action (a frozen calendar list was
  mutated). Permanently guarded with a regression test.
- **PDF export revised**: multiple pages, page orientation and a preview that matches
  the result.
- **View tab and title bar** overlapped on a narrow window; the display options now sit in a
  2×2 grid.
- **Settings**: cleaner layout, uniform checkboxes and working keyboard operation in dropdowns.
- **Security update**: `serde_with` 3.18.0 → 3.21.0 (GHSA-7gcf-g7xr-8hxj).
- **Development environment**: on a second dev server Vite watched all git worktrees along
  (could exceed the system limit for file watching), and conversely ignored all files
  when you ran the dev server from within a worktree — causing changes not to come through.

## v2026.7.10 — 2026-07-10

Completion of phase 2.10 (parts 4 and 5).

### Added
- **In-app documentation** — a built-in help viewer with complete user documentation in
  Dutch and English: a real quick-start, nine task-oriented guides (Planning & WBS, Relationships
  & constraints, Calendars & hours, Resources, Baselines, Critical path, Import/export, Reports &
  printing, Shortcuts & controls) and fifteen reference articles (R1–R15). A `verify:docs` script
  guards that the bundled content stays complete and consistent.
- **Three residential-construction showcases (SMALL / MEDIUM / LARGE)** that together use all
  app features, including advanced schema extensions and an external (cross-project) link. They
  replace the earlier ad-hoc "large" examples with an ascending series that starts small and runs
  up to a fully filled schedule.

### Fixed
- **"Export PDF" in the Report panel actually generated a PNG.** The button now delivers a
  genuine PDF file, in high resolution.
- **The progress line and the data-date line** got their correct dash pattern and thickness back
  (equal to the today line, 4/4 pattern, 2 px), after a regression in which the progress line
  fanned out and the data-date line was drawn twice.
- **False "hard pin violated" message** in a showcase removed (data fix), plus the MEDIUM
  showcase leveling corrected.
- **Small UX items**: the context-menu item "Set constraint…" on the task bar removed, an
  invisible grab zone instead of a visible 5 px drag edge on the right panel, and the
  tour can be restarted from Settings with the tour tooltip inside the window.

## v2026.7.9 — 2026-07-07

Phase 2.10 (parts 1–3): controls, shortcuts and the first-start experience.

### Added
- **Shortcut foundation** with a central registry and store helpers, plus a
  **shortcut overview dialog** (Ctrl+/). Reorder runs via Alt+arrow (Ctrl+Alt+arrow collided with
  a GNOME workspace switch), with Alt+left/right as indent/outdent aliases.
- **Context-menu expansion** across the Gantt and table, and **box selection**: a drag frame that
  selects tasks by row intersection.
- **Task notes** — a free note field per task (on request from the field).
- **First-startup experience** — a `WelcomeDialog` on the very first start, followed by a
  7-step `TourOverlay` that guides through the most important parts and ends at the feedback button.
- Further UI building blocks: a shared **ConfirmDialog** (replaces separate `window.confirm`
  calls), a relationship-type popover, a resource dock and `moveAssignment`.

### Fixed
- QA fix waves on the new controls: parent-move corruption on reorder, popover select behavior,
  Enter in dialogs, `addTask.notes`, and reveal-on-select that may only fire on a click in the left
  task list.

## v2026.7.8 — 2026-07-07

The bulk is phase 2.9; alongside that an important Windows updater hotfix.

### Added
- **Advanced CPM (phase 2.9)** — the critical-path engine has been made complete relative to
  Primavera P6 and MS Project, in both day and hour-based scheduling (design:
  `docs/superpowers/specs/2026-07-06-geavanceerde-cpm-design.md`):
  - **All constraint types in the calculation.** Alongside the existing "soft" constraints, now
    also **logic-breaking Mandatory Start/Finish pins**: a pinned task is placed unconditionally on
    its date — even if a predecessor is then not finished on time — and the resulting
    negative float is driven upstream (to the predecessors) instead of through the pin.
    A **secondary constraint** per task (P6's primary + secondary), with live validation that
    rejects impossible combinations. Constraints now work **hour-precise**: a date-with-time is
    honored to the minute on an hour calendar, a date-without-time stays day-anchored.
  - **Hammock tasks (Level of Effort).** A hammock derives its duration from the distance between
    its start driver and finish driver and **stretches automatically** when those drivers shift; it
    never counts in the critical path and puts no float pressure on its drivers.
  - **External (cross-project) links.** Refer to a task in another file via a
    **frozen anchor date** (P6 External Dates), for all four relationship types and both
    directions. The external task shows as a **ghost bar**; anchors can be **refreshed** per link
    and project-wide, and a non-loaded source gets a "stale" mark. No live two-document
    recalculation.
  - **Near-critical analysis.** A configurable threshold marks tasks with little float (an amber
    band between critical and normal; in the high-contrast theme with a block pattern). Off by
    default; when enabled the threshold is 2 working days and the display follows the duration unit
    (days or hours, fractional).
  - **Multiple critical paths / float paths.** Parallel chains are numbered (`floatPath` per
    task) via driving-logic peeling or total-float ranking, with a configurable maximum.
  - **Interfering float** — the float a task can absorb without hitting the project end
    but which shifts intermediate tasks (total float − free float), drawn and fractional.
  - **Calculation-settings block on the project.** A new project section for the calculation
    choices: lag-calendar choice, critical definition (float threshold or longest path),
    float-calculation method, open-ended-tasks-critical, near-critical threshold and float paths.
    On the project (not app-wide), so that the same file gives the same schedule everywhere.
  - **Interop.** Task constraints now also round-trip in **P6-XML and MSPDI** (previously they were
    lost on export), including the hard/secondary extension; hammocks, external links and the
    Calculation block preserve their data via custom IFC property sets.
  - **Fully backwards-compatible:** every new option defaults to exactly the existing behavior;
    documents from before 2.9 calculate and serialize byte-for-byte identically.
  - The CPM regression suite grew along to **369 hand-computed cases** (incl. FF/SF-hour and a
    completeness sweep), all existing cases unchanged green.

### Fixed
- **Windows auto-update could not unpack the installer.** The zip crate used a backend that could
  not read the NSIS updater zip; the deflate backend is now forced so that the Windows updater
  does unpack the package (updater hotfix, also merged back to main).
- **A schedule opened on "today" instead of at its own project period** (issue #16). On
  opening, fit-to-project is now applied and the view jumps to the project window; on
  selection, task bars are brought into view (reveal-on-select).
- **The Calculation section committed live** instead of via a draft — a half-filled choice could
  already take effect; it now works draft-based.
- **The Columns dialog did not let all available fields be added**; that is now possible.
- **The working-time editor stayed hidden** on some hour presets; it is now immediately visible on
  every hour preset, with an explanation at "Save as preset".

## v2026.7.7 — 2026-07-06

### Added
- **Hour-based scheduling (phase 2.8b)** — scheduling becomes hour/minute-aware, on top of the
  day-granular core of 2.8a (design: `docs/superpowers/specs/2026-07-06-uren-scheduling-design.md`):
  - **Main toggle Hour-based scheduling** (Settings, **default off**): switches on the hour/
    minute scheduling — an hour timescale, crews with working-time bands and hour-precise
    task bars. Off ⇒ the app keeps the byte-for-byte same day-granular behavior from before
    2.8b. A separate setting **"Allow mixed day/hour scheduling"** for documents that
    combine both kinds of tasks/calendars.
  - **Working-time bands per weekday** on the calendar: multiple bands per day (breaks), bands
    that run over midnight (night shift) and a full **24/7** form. Ready-made
    **crew presets** (day shift, 2 shifts, 3 shifts, night shift, 24/7) plus a
    band editor (add band, save as own preset, set per weekday, copy
    to all working days) with a live derived hours/day indicator.
  - **Hour timescale in the Gantt**: the already-present hour/quarter-hour tiers (`timelineTiers`,
    dead until now since phase 2.7) are activated as soon as a calendar has hour data.
  - **Three duration-display modes** in the settings: automatic (own unit per task),
    always days, always hours — with a warning on mixed calendars in the task table
    and three separate duration input fields (days/hours/total hours) in the task dialog.
  - **Task-bar splitting at interruptions**: configurable never/on selection/always, so that
    a task running over a break or night block can be shown visually as separate segments
    instead of as one continuous bar.
  - **Minute-precise interop**: P6-XML, MSPDI and IFC now read and write sub-day duration and
    times losslessly (previously everything was rounded to whole days); documents without
    hour data round-trip unchanged.
  - **Date fields rebuilt**: typeable day/month/year segments instead of a single
    text field, with a project-wide date-notation setting and accompanying
    calendar-dialog fixes.
  - Fully translated in all 14 languages; the CPM regression suite reached **319 hand-computed
    cases**.
  - **Deliberate limitations**: a configurable lag-calendar option (P6's "Calendar for scheduling
    Relationship Lag") is phase 2.9; sub-day resource leveling (per-hour/per-shift
    capacity buckets) stays day-bucket-based; timezone/DST-aware scheduling and
    per-row Gantt shading on deviating task calendars follow later.

### Fixed
- The band editor no longer corrupted the `hoursPerDay` of ordinary day calendars; typing over a
  filled date segment now replaces the content; in the calendar/wizard dialog Enter executes the
  primary action and Cancel reverts the changes (buffer model). The "fixed winter shutdown" toggle
  has been removed from the generator (it belongs in the public-holidays generator).

## v2026.7.6 — 2026-07-04

### Added
- **Calendar extensions (phase 2.8a)** — the calendar becomes a first-class, multiple,
  year-independent concept (design:
  `docs/superpowers/specs/2026-07-04-kalenders-design.md`):
  - **Year-independent public-holidays engine** (`src/engine/calendar/holidays.ts`): rule-based
    instead of a hard-coded 2026 list, with an Easter algorithm and substitution rules (e.g.
    King's Day on Sunday → 26 April, UK public holidays that fall on the weekend → next
    Monday). **Seven country sets**: NL, **Germany incl. all 16 Bundesländer**, Belgium,
    France (+ Alsace-Moselle), United Kingdom (EN-WLS/SCT/NIR), Austria and Switzerland.
    Liberation Day (5 May) follows the **lustrum rule**: only in years divisible by 5 is it
    generated as a public holiday (in other years optionally selectable).
  - **Construction holiday is now opt-in via the wizard choice** (none/North/Central/South), with
    **default none** — the old default calendar silently baked three weeks of construction holiday
    (region North) into every new project, which in the phase-2.5 QA made a 5-day task look like a
    "stretched bar of four weeks". The regional construction-holiday dates come from a verified data
    table per year with an approximation fallback for years outside the table.
  - **Calendar library**: the resource-calendar registry (phase 2.5) has been promoted to the
    project-wide library (`calendars: WorkCalendar[]`) that project, tasks and resources
    all refer to — one central place instead of an implicit project calendar plus a
    separate resource registry. Existing documents migrate automatically (inline project calendar
    becomes library entry "Project calendar").
  - **Task-specific calendars in the CPM**: every task can get its own calendar
    (`Task.calendarId`, fallback project calendar); the solver computes duration, float and
    constraint snaps per task in its own calendar via an engine cache. **Predecessor-
    calendar lag rule**: the lag between two tasks counts in the calendar of the *predecessor*
    (P6 default), while the successor-derived start time snaps in the calendar of the *successor*
    — forward and backward pass mirror this split exactly, so that float stays symmetric.
  - **Wizard** (`ProjectInfoDialog`): country/region dropdown (Bundesland for Germany, country part
    for the UK, canton for Switzerland), the construction-holiday choice, a fixed-winter-shutdown
    checkbox (default off) and a compact public-holidays preview with an expandable list — replaces
    the old, year-bound 3-presets dropdown.
  - **Calendar dialog as library management**: a list of all library calendars with
    active/project-default marking, new/duplicate/delete, and a new **"Generate public
    holidays…"** button that opens the same country/region/construction-holiday generator as the
    wizard — also for existing projects, not only on creation.
  - **Gantt name label on multi-day holiday blocks**: blocks wider than a few zoom pixels
    now show their name (e.g. "Construction holiday (North)") in the shading zone, so it is
    immediately visible which public holiday or vacation period is in the schedule.
  - **IFC-reader gap closed**: the work week and working hours now actually read back from
    `IFCRECURRENCEPATTERN`/`IFCTIMEPERIOD` (previously a 6- or 7-day calendar silently fell
    back to the Mon-Fri default on reload). Multiple named calendars and the
    task-calendar link round-trip via `IfcRelAssignsToControl` and a new
    OPS pset (rule-set id/construction-holiday choice).
  - **Multi-calendar and task-calendar round-trip** also in **MSPDI** (`Calendars` +
    `Task CalendarUID`, made effective) and **P6-XML** (`StandardWorkWeek`/
    `HolidayOrExceptions`, `CalendarObjectId` per activity). Loss matrix in the design doc §8.4.
  - Fully translated in all 14 languages; the test suite grew from 280 to **289 hand-computed
    cases**, all existing cases unchanged green, `verify:examples` byte-identical.
  - **Deliberate limitations**: hour/minute-based scheduling and day/night crew calendars are
    **phase 2.8b** (the data model stays day-granular — an hour calendar now has no effect on
    the solver); per-row Gantt shading on deviating task calendars follows **later** (the global
    column shading stays on the project calendar, MSP behavior); a configurable lag-calendar option
    (P6's "Calendar for scheduling Relationship Lag") is **phase 2.9** — 2.8a fixes
    predecessor calendar as an internal constant; weather/frost-dependent winter downtime is
    **phase 4** (2.8a knows only a fixed, annually recurring winter-shutdown period); the
    construction-holiday table dates are **advisory dates** (Bouwend Nederland) that become less
    precise further into the future with an approximation fallback.

### Fixed
- Eight QA findings from the 2.8a walkthrough corrected, plus the 24/7-preset labels translated in
  the remaining languages.

## v2026.7.5 — 2026-07-04

### Added
- **Views (phase 2.7)** — real, saveable views on the View ribbon tab (design:
  `docs/superpowers/specs/2026-07-04-weergaven-design.md`):
  - **Timescale repair**: the until-now dead timescale choice has been replaced by a
    working dropdown (Year/Quarter/Month/Week/Day) that maps to zoom presets; the
    displayed label is **derived** from the actual zoom level (so it can never
    desync from the drawn axis again) and the viewport recenters on the midpoint of the
    current window when switching scale.
  - **One shared visible-rows list** (`computeViewRows`) for table and Gantt: filter,
    grouping and sorting are henceforth computed in exactly one place, so that table and
    Gantt canvas can structurally no longer diverge (structural parity).
  - **Column configuration** in the task table: visibility, order and width per column,
    across builtin fields, activity codes, custom fields and a new **resource column**
    (comma-separated join via assignments, read-only in 2.7).
  - **Nested AND/OR filters** with a P6-like editor (All/Any groups, field-type-aware
    value input: text/number/date/dropdown for codes/resources), including
    "show summaries" behavior (non-matching parents of a match stay visible, dimmed).
  - **Grouping up to 2 levels** over any field (WBS, activity code, custom field, resource,
    task type) with a band header + count, and unlimited **multi-key sorting** (stable sort,
    respects the WBS hierarchy within tree mode).
  - **Structure locking outside tree mode**: indent/outdent and task dragging are
    disabled as soon as filter/group/sort is active (structure mutations are only
    well-defined in pure tree mode); value mutations (cell edits, adding,
    deleting) always remain possible.
  - **Custom layouts**: save/apply/rename/delete/manage, app-global
    (localStorage, not per document), with silent tolerance for fields that no longer
    exist in the current document.
  - **Presentation mode** (F11) via the real Fullscreen API: all chrome (title bar, ribbon,
    document tabs, status bar, properties panel) disappears, only the Gantt full-bleed
    remains; Escape or the browser/OS fullscreen closes it.
  - **Split view** within one document: two independent time windows side by side on
    the same shared rows and vertical scroll — for example a detail week next to a
    faraway milestone.
  - **Mini-map**: a light thumbnail strip of the entire schedule with a draggable
    viewport frame.
  - **Auto-calculate setting** (three surfaces: gear ⚙, Settings ribbon tab and
    backstage) plus the "Calculate" naming consolidated into one i18n key everywhere
    (ribbon, menu, properties panel).
  - Fully translated in all 14 languages; the test suite grew from 256 to **280
    hand-computed cases**, all existing cases unchanged green.
  - **Deliberate limitations**: the hour timescale waits on hour/minute scheduling (phase 2.8) —
    the data model is day-granular, an hour axis would mislead now; rollup totals per
    group band (sum duration/costs/units) follow later (phase 3.5/3.9); a split view with
    **two different documents** requires a store-singleton refactor and is deliberately
    later; layouts are app-global and do not round-trip in the IFC file
    (per-file layouts are deliberately later).

### Fixed
- QA findings 2.7: a unique Milestone label in the field catalog (was duplicated) and the
  Gantt tooltip via i18n.

## v2026.7.4 — 2026-07-04

### Added
- **Baselines & progress (phase 2.6)** — data-date-driven CPM, real
  progress tracking and unlimited baselines (design:
  `docs/superpowers/specs/2026-07-04-baselines-voortgang-design.md`):
  - **Data date** (P6 *data date*) on the project: drives the CPM forward pass —
    completed tasks are clamped to their actuals, started-not-completed
    tasks place their remaining work from the data date, and not-started tasks
    cannot start before the data date. No data date set ⇒ the behavior is
    byte-for-byte equal to before 2.6.
  - **Real progress tracking**: percent-complete, actual start and
    actual finish (the until-now dead `TaskTime` fields) with enforced
    invariants (an actual finish implies 100%, 100% implies an
    actual finish, filling in a percentage automatically sets an actual
    start, actuals may never lie after the data date). `remainingTime` is always
    derived from the percentage.
  - **Retained Logic / Progress Override** as project-wide progress mode: determines
    how the remaining work of a task that finished before its predecessor
    relates to the network logic.
  - **Out-of-sequence detection**: tasks that show progress while their predecessor
    relationship (FS/SS/FF/SF) logically contradicts it, are marked and reported as a
    warning — blocks nothing, follows the chosen progress mode.
  - **Unlimited, named baselines** (P6-style snapshots) with exactly one active;
    management via a baseline dialog (save/rename/delete/activate) in the
    Planning tab.
  - **In the Gantt**: a data-date line, a baseline overlay (thin sub-bar per
    task against the recorded baseline dates) and a progress line (MSP zigzag that
    bulges out per row to the progress position) — all three separately toggleable.
  - **Variance report** as the third report type in the Report panel: baseline vs.
    current start/end per task, delta in working days, status (on schedule/later/
    earlier/new/removed) and a project-end summary.
  - Round-trip through **IFC 4.3** (actuals in the already-existing but until-now
    unused `IfcTaskTime` slots 14-18 — spec-conform; data date/
    progress mode in `OPS_ProjectSettings`; baselines double-track via a
    lossless `OPS_Baselines` JSON plus `.BASELINE.` schedule headers for
    interop), **MSPDI** (full: Baseline0, `<StatusDate>`, actuals), **P6-XML**
    (best-effort: actuals + data date; P6 baselines are a documented
    loss) and **CSV** (new actual-start/-end columns, deliberately without
    baselines/data date). Golden rule preserved: files without 2.6 data
    round-trip bit-identically.
  - Fully translated in all 14 languages; the CPM regression suite grew from 240 to
    **256 hand-computed cases**, all existing cases unchanged green.
  - **Deliberate limitations**: no costs/work/Earned Value (SPI/CPI/BCWP) — that is
    phase 3.5; P6 baselines are not exported (best-effort, documented
    loss); setting the data date/progress mode is not undoable
    (same precedent as the project calendar — undo via clearing + recalculating).

### Fixed
- QA findings 2.6: the compact-ribbon overlap and F5/Ctrl+S from input fields.

## v2026.7.3 — 2026-07-03

### Added
- **Resources (phase 2.5)** — resource management, load, overallocation and
  automatic leveling (design: `docs/superpowers/specs/2026-07-03-resources-design.md`):
  - **Five resource types**: labor (people), equipment (cranes, machines,
    scaffolding), material (concrete, steel, wood), subcontractor and crew. Crews
    bundle other resources; every resource has a maximum capacity,
    unit and optionally its own calendar.
  - **Time-phased capacity**: the availability of a resource can change per
    period (availability steps) — e.g. three carpenters until week 10,
    five after that.
  - **Resource assignment to tasks** with units per day and six distribution curves
    (uniform, front-loaded, back-loaded, bell, and ascending and descending), so that
    the deployment is spread realistically over the task duration. Assignment is only
    possible on workable (leaf) tasks.
  - **Load and overallocation engine** in the calculation (F5 / Calculate): per
    resource the daily load is summed and compared with the capacity;
    overload is marked.
  - **Resource histogram** as a strip under the Gantt, with a shared time axis,
    capacity line, red peaks above the line, a resource picker with
    overallocation badges and drill-down tooltip; the height is adjustable and
    persistent.
  - **Automatic resource leveling and smoothing**: a serial placement
    algorithm (SGS) shifts tasks within their float to resolve overallocation,
    sorted by priority/float/start date. Leveling goes via a
    dialog with an up-front preview (shifts, new end date, remaining
    conflicts) and can be applied or cancelled with one click.
  - **Task priority** (0–1000; 1000 = do not level) drives which tasks get
    precedence under scarcity.
  - **Resources ribbon tab** with a management panel (resources + capacity steps +
    calendar link), an assignments section in the task properties panel, the
    histogram strip and the leveling dialog.
  - Round-trip through **IFC 4.3** (incl. `IfcCrewResource`, `OPS_Resource`/
    `OPS_Assignments`/`OPS_Leveling` psets, an `IfcWorkCalendar` per resource and
    `IfcTask.Priority`) and import/export via **Primavera P6-XML** and **MS Project
    MSPDI** — resources, assignments, curves and resource calendars travel along.
    Golden rule: files without resources stay bit-identical.
  - Fully translated in all 14 languages; the CPM regression suite grew from 202 to
    **231 hand-computed cases** (incl. leveling and smoothing scenarios), all
    existing cases unchanged green.
- **Example projects in Backstage** — a new section **File → Examples**
  exposes the bundled example schedules (cards with name, description and
  tags). Clicking opens the example in a new tab (no source file, so
  saving becomes save-as). The list is data-driven via
  `public/examples/manifest.json`, so new examples come
  in without a code change. Works in the web and desktop build. The section now shows two groups:
  the three **showcase schedules** at the top (badge "All features"), below them the
  **simple examples** (manifest field `category`).
- **Example generator rebuilt (`npm run gen:examples`)** — the examples are now
  fully built by the app itself via the real store + `runCPM()` + `writeIFC`
  (instead of a hand-rebuilt IFC writer, which had drifted). Drift between the
  examples and the app is thereby structurally impossible. New:
  - **Three showcase schedules** (residential / infra / renovation) that together use all
    app features: all four relationship types + lags/leads/%-lag/ELAPSEDTIME,
    date constraints + deadlines incl. a deliberate conflict with negative float,
    start/finish/mandatory milestones, activity codes + custom fields, all five
    resource types with crew hierarchy, resource calendars, availabilitySteps, all
    six assignment curves, an overallocation solvable with leveling and a
    pinned task (priority 1000).
  - **Year-independent dates**: projects anchor relatively ("first Monday of
    March, next year"); NL public holidays (incl. Easter derivatives) and the construction holiday
    are computed per year, so that regenerating always yields current dates.
  - **Twenty sector examples enriched** with real phase overlap (SS/FF relationships,
    leads and %-lags on the phase boundaries) and varied calendars, so that a
    realistic critical path **with float** arises (55–86% critical instead of nearly
    everything). The two old, hand-built "large" examples have been replaced
    by the showcases.
  - **Verification** (`npm run verify:examples`): every file goes through the real
    `readIFC` with asserts on counts, round-trip stability and present features.

### Changed
- **Recovery dialog in the app itself** — on startup after an unexpected
  shutdown the recovery question now appears as its own, styled React dialog
  (`RecoveryDialog`) instead of a native OS dialog. The dialog shows, per document to
  recover, the project name, the file path (if known), the number of
  tasks and the timestamp of the last auto-save snapshot. Escape defers the choice
  without cleaning up the recovery files; the auto-save is postponed until
  the choice is made, so that the snapshots are not overwritten prematurely.
  (This was desktop-only at the time; since v2026.7.11 the browser build also has recovery, via
  IndexedDB.)
- The default task priority is now an explicit value (500) instead of empty,
  so that priority weighs in predictably during leveling; an explicitly filled-in
  0 is preserved (was previously silently corrected to 500 in the MSPDI export).

### Fixed
- Product/code-review findings on the resource features: an honest leveling preview with fresh
  floats, first-class derived state and histogram refresh; validation, popover behavior, Y-scale,
  explanation and a total column in the management panel; and the resource name that was
  squeezed out in the assignment row. The IFC/P6 adapters got correct assignment keys, a
  correct P6 rate, a spec-conform `IfcTask` and units as a fraction.
- Collapsed subtasks appeared at the bottom of the table instead of staying hidden; the
  "parent task" field has been removed from the task dialog when editing.
- i18n final sweep: hundreds of translation keys in the twelve remaining languages filled in and an
  orphaned key cleaned up (incl. a German `clearLeveling` label that broke mid-word in the ribbon).

## v2026.7.2 — 2026-07-03

### Added
- **Milestones (phase 2.4)** — start/finish milestones, mandatory milestones and a
  milestone overview (design: `docs/superpowers/specs/2026-07-02-mijlpalen-design.md`):
  - **Start and finish milestones** (P6 *Start/Finish Milestone*) via a day-granular
    boundary model: a start milestone anchors on a day start, a finish milestone on a
    day end (end of working day F = start of the next working day). FS to a finish milestone lands
    on the finish day itself; an FS/SS successor of a finish milestone starts the working day after.
    `undefined` = automatic (the anchor follows the binding relationship side) — existing
    files calculate bit-equally. Golden invariant: an inserted milestone
    never shifts the chain.
  - **Mandatory (contractual) milestones**: `mandatory` flag with a double-diamond in the
    Gantt; date guarding via the existing 2.3 constraints (FNLT/MFO → negative float).
    The ribbon milestone button is a menu: start milestone, finish milestone or
    **inspection point** (finish milestone + task type Inspection + mandatory).
  - **Milestone overview** as the second report type in the Report panel: a table with
    kind, date, constraint/deadline date, float, mandatory and status
    (on schedule / critical / late, color-coded), printable; a summary with
    mandatory and late counters.
  - Round-trip through IFC 4.3 (`OPS_Milestone` pset; automatic writes nothing) and
    P6-XML (activity type `Start`/`Finish Milestone`, kind is preserved on import).
  - Test suite grown from 176 to **202 hand-computed cases** (battery
    `cases-milestone-kinds.json`), all existing cases unchanged green.
- **Indent/outdent of tasks** (MSP convention): Alt+Shift+→/← and buttons in
  Planning → Structure; indenting makes a task a child of its preceding sibling,
  outdenting makes it a sibling after its parent — subtrees ride along, WBS auto-numbering
  renumbers and it is one undo step.
- **Resizable task table** in the Gantt: drag the divider line (150–800 px,
  persistent); replaces the fixed width of 350 px.
- **Compact ribbon mode**: a small arrow at the bottom right of the ribbon
  (Word-web style) collapses the ribbon to a single row of 40 px instead of 94 px —
  for small screens; the state is remembered.

### Changed
- The milestone checkbox in the properties panel now sets the duration to 0 and disables the
  duration field; the tables consistently show duration 0 for milestones (was: silent divergence).
- New milestones no longer get the task type Inspection by default
  (that is now reserved for the inspection point).

### Fixed
- **In-app updater on .deb installations (Ubuntu/Debian)**: .deb installs got only
  manual update instructions, on the outdated assumption that the Tauri updater cannot replace .deb
  in-place. The updater plugin (≥2.6; we run 2.10.1) does do that —
  it matches the `linux-x86_64-deb` entry in `latest.json` via the bundle-type stamp in
  the binary and installs via pkexec/sudo + `dpkg -i`. The update dialog on .deb
  now shows the normal "Download and install" button; the manual copy-paste command and
  the download-page button remain as a fallback when the installation fails.
- **Windows auto-update broke due to a draft URL in `latest.json`**: the re-sign step in
  `release.yml` took over the download URL from the GitHub API while the release was still draft,
  causing the `windows-x86_64(-nsis)` entries to point to an `untagged-…` URL that
  404s after publication (as happened in v2026.7.1). The workflow now builds the stable
  `releases/latest/download/` URL itself from the asset name; the `latest.json` of release
  v2026.7.1 was repaired in place (all URLs verified 200, signatures unchanged).
- **Sharp app icon on Linux**: the runtime window icon was 32×32 (first PNG in
  `bundle.icon`), causing docks to show an upscaled blurry icon. `icon.png` (512 px)
  is now at the front, 256×256/512×512 fill the hicolor slots in the `.deb`/snap and all
  sizes have been regenerated from the 1024px vector source (incl. `snap/gui/icon.png`).

## v2026.7.1 — 2026-07-02

### Added
- **Constraints & deadlines (phase 2.3)** — date constraints, deadlines and negative float
  (design: `docs/superpowers/specs/2026-07-02-constraints-deadlines-design.md`):
  - **All 8 date constraints in CPM** (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO) with
    **P6 soft semantics**: constraints never break the network logic — early-side types are
    lower bounds in the forward pass, late-side types upper bounds in the backward pass;
    MSO/MFO work as P6's *Start On*/*Finish On* (both bounds at once); ALAP shifts to
    zero-free-float (P6 model, and the relationship then becomes correctly driving). Constraint
    dates snap to working days. The logic-breaking Mandatory pin is deliberately §2.9.
  - **Deadline per task** (MSP model, soft): bounds only the late finish — bars never
    move; float is measured up to the deadline and negative on overrun.
  - **Negative float**: total float is now drawn (min of start and finish float,
    MSP-safe) and `critical = float ≤ 0`; missed deadlines and violated constraints
    propagate negative float through the predecessor chain (DCMA checks 5/7 as a frame).
  - **Indicators**: constraint pin on the bar edge (blue = early-side, violet = late-side,
    red = violated), deadline arrow on the deadline date (green/red), P6 asterisk after
    the date in the table, negative float red in the float column and warning counters in the
    status bar.
  - Round-trip via `OPS_Constraints` pset (IfcTaskTime has no constraint slots);
    test suite 159 → **176 hand-computed cases**.
- Dependabot alert #12 (glib `VariantStrIter`, RUSTSEC-2024-0429) assessed and dismissed
  as *not used*: the API is used by neither the app nor Tauri's gtk3 path and the fix (glib 0.20)
  requires GTK4 bindings that Tauri 2 does not use — revisit on a Tauri migration.

## v2026.7.0 — 2026-07-02

### Added
- **WBS & structure (phase 2.2)** — the structure layer at a professional level
  (design: `docs/superpowers/specs/2026-07-02-wbs-structuur-design.md`):
  - **Automatic WBS numbering** (1.2.3.4 from the tree position): new projects
    number live on every structure mutation (on/off via Planning → Structure);
    existing files keep their free codes (MSP model) with an explicit
    **Renumber WBS** action. New tasks also get a derived
    code without auto, and pasting renumbers the pasted branch (no more code duplicates).
  - **Activity codes** (P6 model): project-bound code types (e.g. Location,
    Discipline) with values (code + description + color), max one value per
    type per task; management via the new dialog *Codes & fields*, assignment in
    the properties panel and as table columns.
  - **Custom fields**: typed user fields (text/number/integer/
    cost/date/yes-no) per task, visible as table columns.
  - **Multiple WBS breakdowns**: View → *Group by* shows table and Gantt as
    bands per code value (color strip + label, P6 Group & Sort style) — the
    industry standard for location × discipline without a second saved tree.
  - **WBS templates** (Asta task-pools style): right-click on a summary task
    → *Save branch as template* (tasks + internal relationships incl. lag); inserting and
    managing via Planning → Structure → *Templates*. App-level (localStorage).
  - **IFC 4.3 round-trip** for all of this: definitions as `IfcPropertySetTemplate`
    (+ `IfcPropertyEnumeration` for code types, declared via `IfcRelDeclares`),
    values per task as `OPS_CustomFields`/`OPS_ActivityCodes` psets with
    typed values, project flag in `OPS_ProjectSettings`; lossless
    meta-JSON for own files and template fallback for third-party files.
  - Copy/paste of WBS branches already existed; the new fields ride along and
    pasting now also preserves `lagUnit`/`lagPercent` of internal relationships (fix).
- **Full dependencies (phase 2.1)** — the relationship model has been brought to the level of
  professional planners (design:
  `docs/superpowers/specs/2026-07-02-volledige-dependencies-design.md`):
  - **Lag unit per relationship**: working days (default) or **calendar days** (24/7, e.g. curing
    of concrete) — IFC-conform as `IfcTaskDurationEnum` (`WORKTIME`/`ELAPSEDTIME`); notation `2d`
    vs. `3ed` in editors, CSV and MSPDI (LagFormat 8).
  - **Percentage lag** (e.g. `SS+50%`, MS Project semantics): percentage of the duration of the
    predecessor, re-evaluated on every CPM run; round-trips via IFC (`IfcRatioMeasure`)
    and MSPDI (LagFormat 19/20); P6 export bakes out to fixed hours (with a log message).
  - **Negative lag (lead) rounded**: the clamp on the project start remains (P6/MSP-conform) but a
    **truncated lead** is now marked, as is a lead larger than the predecessor duration;
    leads serialize ISO-8601-conform (`-P2D`) and the swapped `IfcLagTime` attributes
    (LagValue ↔ DurationType) have been corrected — old files remain readable.
  - **Driving/non-driving relationships** (P6 definition: relationship free float = 0, ties
    allowed): solid vs. dashed arrows in the Gantt (red = critical driving line),
    ⚡ indicator in the properties panel and the relationship table.
  - **Relationship table** — new ribbon tab *Relationships*: all relationships in one sortable,
    inline editable table (predecessor, type, lag, successor, driving, free float per relationship,
    warnings) + "new relationship from selection"; the Manage button on the Planning tab opens it.
  - **Path tracing** (MSP Task Path style): trace buttons (predecessors/successors) on the
    Planning and Relationships tab + context menu "Trace path" — transitive predecessors gold,
    successors purple (driving chains darker), the rest dimmed; Escape stops.
  - Relationships are now also **editable** in the properties panel (type + lag notation
    `2d/3ed/50%/-25e%`); new store action `updateSequence` with undo.
  - Test suite expanded: 129 → **159 cases** (new batteries `cases-lag-advanced.json` and
    `cases-driving.json`; harness knows `lagUnit`/`lagPercent`/`drivingSet`/`truncatedLeadSet`).

### Fixed
- **The manual `.deb` install command in the update dialog** accidentally also matched the
  `amd64.deb.sig` asset, causing `$url` to contain two URLs and `curl` to fail with
  "URL rejected: Malformed input to a URL function". The grep now matches on the closing quote.

## v2026.6.1 — 2026-06-29

### Added
- **In-app feedback button → GitHub issue** with an optional screenshot and a full-screen
  annotation editor (inline text tool, OK confirmation before anything goes to GitHub). The
  feedback button got a rotating label to make it more visible.
- **Working snap packaging** — `snap/snapcraft.yaml` (core22, strict confinement,
  gnome extension) that repackages the release `.deb`, plus a restored `snap.yml` workflow that
  triggers on tag push and `workflow_dispatch`, downloads the release deb instead of rebuilding the
  app, attaches the `.snap` as a release asset and publishes to the Snap Store once
  the store credential exists.
- **Auto-save on every change** — the recovery snapshot is henceforth written on every mutation
  (debounced) instead of at fixed moments.

### Fixed
- **CPM correctness** — seven verified issues from a new planning-correctness test plan:
  CPM relationships, lag/lead, milestones and free float are now correct, the `scheduleStart` drift
  on recalculation is gone, and a review round sealed the IFC lead, WBS late rollup and various
  hang/robustness cases.
- The canvas context menu now also closes on a click-outside (not only on Escape); the
  clipboard image in the feedback tool is built via `Image.new(rgba,w,h)` instead of from
  raw bytes; and the auto-assign workflow got the `issues:write` permission.

### Documentation
- Test plan and findings for planning correctness (CPM/relationships/milestones/calendar) recorded,
  and the design + the to-do for working snap packaging.

## v2026.6.0 — 2026-06-24

A large leap of ~146 commits that took the app from a prototype to a genuinely extensible,
self-updating product (highlights).

### Added
- **Cross-platform in-app auto-update** (Tauri updater) on Windows, macOS and Linux — the
  flagship of this release. The app checks silently on startup against the GitHub-release
  `latest.json`, verified with a minisign pubkey; macOS got an `app` target and Windows
  a re-sign step so that the updater can install the package.
- **Extension system** (modeled on Open Calc Studio) — an extension is a ZIP or loose
  `.js` file (`manifest.json` + `main.js`) that registers importers and ribbon buttons.
  Loader with IndexedDB storage and a `new Function` sandbox, a scoped host API with
  permission checks and event bus, host events (`host:project-loaded`/`-new`/`schedule-calculated`),
  a real host SDK via `require('open-planner-studio')`, management via Backstage → Extensions /
  Import, an example extension and a public catalog repo.
- **Multi-document** — `documentSlice` keeps track of multiple opened projects (active at
  top-level, inactive as a payload snapshot); three switch styles (horizontal tabs /
  project rail / title-bar pill) with a shared project-overview overlay, per-document view/
  undo/selection/dirty, shared clipboard, `Ctrl/⌘ 1–9`, multi-document recovery and a 3-way
  close confirmation (Save / Don't save / Cancel).
- **New-project wizard** (`ProjectInfoDialog`) with name/client/start date, a
  calendar preset and a phasing template — with this **Phase 1 is complete**.
- **Copy/paste tasks** (Ctrl+C / Ctrl+V) including subtasks and internal relationships.
- **CAD-style zoom**: cursor-anchored zooming with a tier-driven timescale header,
  week-start awareness and shortcuts (+/−/0/Ctrl+0 fit-to-project).
- **Debug terminal** overlay, a shared **settings unification** across three surfaces, a
  reusable themed **Select** dropdown, a work-calendar dialog, a **self-test harness**
  (Tier 1 Playwright + `window.__OPS__`, Tier 2 `ops-test` channel), Linux desktop-icon metadata
  and per-worktree isolation of port and recovery file so that multiple desktop builds can
  run at once.

### Changed
- **Modern UI overhaul** — a cool "Soft-Depth" look across all surfaces (Phase 1 cool
  tokens, shadow/radius, AA control edge and fonts; Phase 2 across the whole app), on top of an
  OpenAEC stylebook alignment (fonts + tokens, theme reduction from 7 to 3 with migration).
- **Store architecture** — the monolithic Zustand store has been split into ten slices
  (`src/state/slices/`); `appStore.ts` is now a composition root. No behavior change.
- **Performance** — O(n³)/O(n²) lookups in IFC nesting and the drawing of Gantt arrows
  eliminated; `isTauri()` centralized in `src/utils/platform.ts`; CI to Node 24-compatible
  Actions versions; eleven of twelve Dependabot vulnerabilities patched.

### Fixed
- **Scheduler** — the critical path is now correct (no more phantom float on predecessors) and
  `runCPM` can no longer freeze or crash on odd/invalid data.
- **Light-mode contrast** improved (deeper tint, visible edges/lines, bright amber, WCAG AA).
- **Extension robustness**: `minAppVersion` is enforced, the own ZIP parser reads sizes from
  the central directory, and a failed activation cleanly cleans up its UI registrations;
  `removeResource`/`unassignResource` clean up orphaned ids; XML-import detection more robust
  (P6 before MS Project; unknown format throws).
- Various: the update-dialog grep accidentally matched the `.sig` asset, the file extension is
  ensured on save (Linux/GTK), STEP entities are terminated with `;` (invalid IFC output
  fixed, incl. the example generator), the default end date follows the duration and theme names
  are translated in the theme picker.

### Documentation
- `CLAUDE.md` added/updated (architecture, multi-worktree dev setup, i18n/settings/
  Rust facts), the README architecture corrected, a to-do list and this changelog document
  set up, the UI-overhaul spec and the self-test-harness documentation recorded, and `read_file`/
  `write_file` in the Rust backend documented as a deliberate escape hatch.

## v2026.2.0 — 2026-02-23

First public release (seed). This is one squashed initial commit plus a handful of
follow-ups; the granular history behind it is missing.

### Added
- **The core of Open Planner Studio** — a construction-planning application with **Gantt charts**
  (imperative on canvas), a **CPM scheduler** with a calendar engine and the **native IFC 4.3
  file format** (reading and writing via `ifcReader`/`ifcWriter`, no separate project format).
  Around the Gantt: a **ribbon** UI, an Excel-like **table editor**, an **IFC code editor**,
  a **report panel** with an inline live print preview, draggable task bars, collapsible
  WBS chapters and a right-click context menu.
- **Multilingual with 14 languages** (i18next + OS-locale detection), a **Settings dialog**, a
  **4-theme system** (Dark, Light, Blue, High Contrast) with CSS variables from which the
  canvas renderer also reads its colors, and a **custom title bar** with working window buttons.
- CalVer versioning (`YYYY.M.B`), two bundled example IFC schedules and the
  release/CI plumbing (bundling, Azure Trusted Signing for the Windows installer).
