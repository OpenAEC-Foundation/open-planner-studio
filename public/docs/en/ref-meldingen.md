# Notifications and warnings

The app tells you what is going on in three places: the status bar at the bottom, the *Warnings* panel in the right-hand column and the notifications that appear briefly at the bottom of the screen. This article says for each place what you see, when it appears and what you can do about it. Why a schedule is critical or overallocated is in [Critical path and float](docs://uitleg-kritiek-pad); resolving overallocation is in [Resolving overallocation](docs://howto-overbezetting-oplossen); making relations is in [Creating relations](docs://howto-relaties-leggen).

## The difference between the three

- **Status bar** — a fixed line with counters. They come from the last calculation and stay until you calculate again.
- **Warnings panel** — the list behind those counters, with everything the last calculation found, and a click takes you to the task, relation or resource. It is derived from the last calculation; nothing is stored.
- **Notifications** — short messages about something you just did (saving failed, relation refused, import read). They disappear again and are not in the panel.

## The status bar

The bar at the bottom shows, from left to right:

- **Tasks:** — the number of leaf tasks (summary tasks do not count).
- **Milestones:** — the number of milestones.
- **Critical path: N tasks, N work days** — the number of critical tasks and the project duration. Only visible after a calculation.
- **End:** — the project finish from the calculation. Only visible after a calculation; an empty project has none.
- **N deadline(s) missed**, **N constraint(s) violated**, **N out-of-sequence relation(s)** and **N resource(s) overallocated** — each a button with a warning sign, only visible when the counter is above 0 and there is a calculation. A click opens the *Warnings* panel (tooltip: *Open the Warnings panel (details and navigation)*). If you are on the *IFC* or *Report* tab, the app jumps to *Home* at the same time, because the right-hand column does not exist there. The *resource(s) overallocated* counter also refreshes after changes to resources and assignments; the other counters only change after *Calculate*. The four counters are a selection: what the panel shows in addition (truncated lead, ignored relation, hammock without a finish driver, capped finish date, schedule error) is not in the status bar.
- **Out of date — recalculate (F5)** — with a warning sign (tooltip: *Schedule out of date — recalculate (F5)*). Visible as soon as you change something that affects the schedule and have not recalculated. If *Calculate automatically* is on it stays away, except when the calculation gave an error: then it stays.
- **Selection: N task(s)** — the number of selected tasks; only visible with a selection.
- **Scale:** and **Zoom: Npx/day** — the time scale of the timeline and the zoom level. The scale follows from the zoom.
- **Unsaved** — as long as the document has changes that are not in the file.
- **AI** — a coloured dot with the word AI, only when AI mode is on. The tooltip says *AI bridge:* with *Off*, *Live on port N*, *Port N in use* or *Error*. A click opens the *AI* tab.
- **Debug terminal** — a terminal button, only when the debug terminal is enabled; it shows or hides the terminal (*Show debug terminal* / *Hide debug terminal*).

## The Warnings panel

- **Opening** — *Planning › Schedule › Warnings*, *View › Panels › Warnings*, or a counter in the status bar. The panel is in the right-hand column, below *Properties* and the resource dock, and expands a collapsed column. By default it is closed and it is not remembered between sessions. You drag its height at the edge when it is under other panels, and that height is remembered. The cross at the top right closes it (*Close warnings*).
- **Header line** — *N error(s), N warning(s)*. If nothing has been calculated yet, it says *Not calculated yet — press Calculate (F5) to run the checks.*
- **Calculate** — a button in the header line, visible as long as the schedule is out of date or not yet calculated. It does the same as *Calculate* in the ribbon.
- **Warning sign in the header line** — when the schedule is out of date, with the tooltip *Schedule is stale — this list comes from the last calculation. Recalculate (F5).* The list is not hidden, only marked as out of date.
- **Empty list** — *No warnings. The schedule passes all checks.*
- **A line** — at the top the place (task, relation, resource or project) and under it the description. An error has its own octagonal sign, a warning a triangular sign. A task appears as `WBS name`. A relation appears as `predecessor → successor (FS+2d)`, with type and lag. A click goes to the place (tooltip *Go to: …*), see below. The line that belongs to your active task (for a relation: its successor) or to the resource chosen in the histogram is highlighted.
- **Order** — errors first; then per kind in the order of the list below; within a kind in document order (for a relation that of the successor, for a resource that of the resource list). A task, relation or resource that was deleted after the last calculation drops out.

### Kinds of warning

- **Schedule error** — *The schedule could not be calculated: …* with the reason after it, see below. A click: for a cycle the app selects all tasks in the cycle and jumps to the first; for other errors there is nothing to jump to and the line is not a button.
- **Deadline missed** — *Deadline {date} missed — early finish {date}*. The task has a deadline and the calculation does not meet it. A click jumps to the task. To fix: adjust the logic or the duration, or move the deadline.
- **Constraint violated** — *Constraint {type and date} is overridden by the logic (negative float)*. The constraint cannot be met without breaking the logic; the float is negative. A click jumps to the task. See [Constraints](docs://uitleg-constraints).
- **Out of sequence** — *Out of sequence: the successor's progress contradicts the relation*. The progress of the successor does not fit the type of relation, for example a successor that is already in progress while the predecessor is not yet done under a Finish-to-Start relation. A click selects both tasks, with the successor active. Check the actual dates or the relation.
- **Lead truncated** — *Lead truncated by the project start — the relation is not fully honoured*. The lead (negative lag) of the relation reaches before the project start. A click selects both tasks.
- **Relation ignored** — *Relation ignored: predecessor or successor is missing or is not a leaf task*. The calculation does not use the relation. A click selects the tasks that still exist. See [Relations](docs://uitleg-relaties).
- **Hammock without a finish driver** — *Hammock without a finish driver (no FF/SF predecessor): its duration falls back to zero*. A click jumps to the task. See [Hammock tasks](docs://howto-hammock).
- **Finish date capped** — *Finish date capped: the calendar leaves no workable window for this task*. The calculation hit the limit of the number of days it searches, for example because of a very long unbroken stretch of days off in the calendar. A click jumps to the task. See [Calendars and working days](docs://uitleg-kalenders).
- **Overallocation** — *Overallocated on N day(s) (first – last)*, with *the resource does not work these day(s) per its calendar* added if all days are days off, or *of which N day(s) the resource does not work per its calendar* for a mix. A click selects the tasks with an assignment on that resource, turns the histogram on and chooses that resource in it; from *Table*, *IFC* or *Report* the app jumps to *Resources*. See [Resource panel](docs://ref-resourcepaneel).

### Reasons for a schedule error

- *Circular dependency between tasks: {path}* — the relations form a cycle. The tasks are in the path; reverse or remove one relation.
- *The calendar has no working days set* — give the calendar at least one working day, see [Calendar windows](docs://ref-kalenders).
- *Invalid duration in days for task '{task}'* and *Invalid duration in hours for task '{task}'* — the duration of the task is not a valid number.
- *Hour task '{task}' has no valid working hours in its calendar* — a task in hours on a calendar without working hours.
- *Invalid start date for task '{task}'* — the start date of the task is not valid.

## Notifications

Notifications appear at the bottom of the screen, also in the table, in Backstage and in presentation mode. A notification is an *error* or *info*. An error stays until you click it away; an info disappears after 5 seconds, and those timers start again as soon as the stack changes. A click on a notification closes it (tooltip *Close notification*). At most three are shown at once: if a fourth comes, the oldest info goes first, and if there is no info, the oldest notification, so an error is never pushed out by an info. The stack moves away from the buttons of an open dialog and from sticky action bars.

- **Counter ×N** — a notification with a fixed key folds a repeat into one line with a counter, for example a save error that keeps coming back or a refused relation that you repeat. Not every notification does that.
- **Read more** — some notifications have a *Read more* link or a topic of their own (for example *Work rules explained*) to the guide in Backstage › Help.
- **Action button** — the notification about the calculation profile has a button *Open calculation profile* to Project info.

The list below is a selection, grouped by topic. Where it does not say otherwise, it is an info.

### Saving, opening and recovery

- **Saving failed** (error) — *Failed to save* with the reason below it. When saving, saving as and exporting a report.
- **Saved as a download** (info) — *Saved as a download: '{name}' is now in your downloads folder. …* When the environment does not let the app write directly to the location you picked. Two downloads right after each other fold together.
- **Auto-save failed** (error) — *Auto-save failed* with the reason. Applies to auto-saving to the file and to crash recovery.
- **Library could not be saved** (error) — *Library could not be saved*, when saving the resource library.
- **Opening a file failed** (error) — *Failed to open file* with the reason. For an example, a recent file or an imported file.
- **Old or protected .mpp** (error) — *This .mpp file uses an older format (Project 2007 or earlier)…* or *This .mpp file is password-protected…*, both with the advice to export as XML in MS Project and open that file.
- **Invalid XER file** (error) — one of the *XER…* texts, for example *This is not a valid or supported XER file.* or *The XER file contains a duplicate table.*, with the reason added.
- **IFC could not be read** (error) — *IFC could not be read* with the reason, in the IFC view.
- **Recovery** (error) — *Recovered file could not be read*, *Restore failed* and *N recovery files could not be loaded and were skipped.* When recovering after an unexpected shutdown.
- **Branch saved as template** (info) — *Branch saved as template '{name}'*.
- **Message from an extension** (info, or error if the extension reports an error) — *Extension {name}: {message}*. An extension may show at most three new ones per 10 seconds, so it does not fill the stack. If a step of an extension's guide fails, it says *A step from the extension {name} failed. The guide continues.*, and if a project file of an extension cannot be opened, *The project file {file} from the extension {name} could not be opened.* Both are errors.
- **A change came in between** (info) — *A change by the AI assistant or an extension came in between. …* When you cancel the task dialog while the AI or an extension changed something in the meantime: the task edits from before that change are not reverted and remain as ordinary steps under *Undo*.

### Calculating

- **Schedule could not be calculated** (error) — *Schedule could not be calculated* with the reason below it (see *Reasons for a schedule error*). On *Calculate*, when switching documents and when opening a file.
- **Status date set to today** (info) — *There was no status date yet: it is now set to today ({date}), because progress is measured up to the status date. You can change it under Planning → Status date.* When entering progress in a project without a status date.
- **Duration shorter than the work done** (info) — *‘{name}’ is already {N}% done: a duration shorter than the work already done isn't possible. The duration was not changed.*

### Relations and hierarchy

- **Relation created** (info) — *Relation created: {predecessor} → {successor}*.
- **Relation refused** (info) — *That relation already exists*, *A relation between a task and its own (grand)parent summary task is not allowed.* or *This relation would create a cycle in the schedule ({cycle}) and was not created.* The cycle names the tasks, so you know which relation to remove or reverse first.
- **Move refused** (info) — *This move would create a cycle in the schedule ({cycle}): a summary task's relations also apply to its subtasks. Nothing was moved.*
- **Relations drop out after a move** (info) — *After the move, N relations link a task to its own summary task; they no longer count in the calculation.*
- **Relations skipped on insert** (info) — *N relations were not created: invalid link…*, when pasting or inserting a branch.
- **Relations not counted after import** (info) — *N relation(s) could not be included in the calculation. Check the Predecessors and Successors columns.*
- **Duplicate ids after import** (info) — *Objects with a duplicate id in this file: N. They were given their own id…*

### Editing tasks

- **Start recorded as a constraint** (info) — *'{name}' has a predecessor: the new start is now a Start no earlier than (SNET) constraint on {date}. After recalculating (F5) the task won't start before that date.* When you change the start of a task with a predecessor. If the task already had such a constraint, the notification says it moved; for several tasks at once it gives a count.
- **Start not applied** (info) — *The new start of '{name}' was not applied: the task has a predecessor and the constraint {type} {date}, and those determine its start. Change that constraint to move the start.*
- **Milestone refused** (info) — *'{task}' has resource assignments and cannot become a milestone. Remove the assignments first.* or *'{task}' is a summary task with subtasks and cannot become a milestone.* When converting in the task dialog, the properties panel, the context menu and the table.
- **Assignments moved to a subtask** (info) — *The assignment of {resources} was moved from '{phase}' to the new subtask '{child}': a summary task carries no assignments itself.* When a task with assignments gets subtasks.
- **Milestone flag removed** (info) — *Milestone '{phase}' now has subtasks and has become a summary task; the milestone flag was removed.*
- **Summary task refused** (info) — *'{phase}' cannot become a summary task: …* with the reason, and *Nothing was changed.*
- **Cells skipped on paste** (info) — *Skipped N cells: they are read-only (for example an auto-numbered WBS code or a calculated column).*
- **References cleared on paste** (info) — *N references did not exist in this document and were cleared (task calendars, custom task types, activity codes or custom fields from the source document).*
- **Work rule adjusted durations** (info) — *After the calendar change the work rule adjusted the duration of N tasks (work stays, hours per day changed).* With a link *Work rules explained*.

### Primavera (XER)

- **XER file opened** (info) — *XER file opened: N project documents.* One notification per file, even if the file opens several projects, with a *Read more* link and detail lines below it. Always *N projects found.* Only when the number is above 0: *N empty projects skipped.*, *N baseline projects excluded.*, *N baselines materialized.*, *N dangling baseline references ignored.*, *A protective baseline fallback was used.* and *N external links preserved.* Only for an encoding other than UTF-8: *Text encoding selected: {encoding}.* Further, when the number is above 0: *N parser findings.*, *N calendar findings.*, *N number-format findings.*, *N enum fallbacks.* and *N P6 scheduling settings used safe fallbacks.*
- **Dates as Primavera recorded them** (detail line in the same notification) — *N tasks show the dates as Primavera recorded them (not recalculated).*, or, if the mode did not turn on, *N tasks differ from the dates in the file — you can show them.*
- **XER source archive unusable** (info) — *The XER source archive in this file is unusable and was left out; the project itself opened in full.* with the reason (for example *Reason: the checksum does not match the source bytes — the archive is damaged.*) and the consequence (*The schedule, the calculation profile and all project data from the IFC are complete. …*). When opening an IFC file in which a previously stored XER source archive cannot be used. Also when restoring after an unexpected shutdown, if the recovery storage no longer holds the source archive.
- **Export loses XER information** (info) — *Exporting to {format} loses XER source information.* After a successful export to a format other than IFC of a project with data that only exists in an XER file. With a *Read more* link.

### Importing, exporting and calculation profile

- **Dates as in the file** (info) — *N tasks show the dates as recorded in the file (not recalculated).* or *N tasks differ from the dates in the file — you can show them.* When opening a file with recorded dates.
- **Work and work rules visible** (info) — *This file contains stored work or custom work rules; the work rule and remaining work are shown for this project.*
- **MS Project schedule read** (info) — *This MS Project file contains N tasks with a split, leveled, or resource-driven schedule. They are imported and shown as such.*
- **Breaks not exported** (info) — *N tasks with breaks were exported without their breaks: MS Project/P6 only know breaks as a work distribution.* When exporting to MS Project or Primavera.
- **Project start moved** (info) — *Project start moved: N task anchors without a predecessor or constraint were shifted to the new start date.*
- **Date window no longer steers** (info) — *MS Project's date window no longer drives N tasks after this edit; …* Once per document.
- **Leveling delay rounded** (info) — *Leveling rounds MS Project's minute-precise leveling delay for N tasks to whole workdays.* Once per document.
- **Calculation profile applied** (info) — *This project calculates as {profile}. Change it via File → Project info → Calculation profile and options.* With the button *Open calculation profile*. After applying a profile, *After applying, N tasks moved.* follows if needed.
