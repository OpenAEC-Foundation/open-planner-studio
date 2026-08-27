# Opening MS Project (.mpp)

Besides MS Project XML (MSPDI), Open Planner Studio can also open Microsoft Project's native
`.mpp` file directly — no export step needed first. The reader is a self-contained TypeScript
implementation of the MPP14 container format (Project 2010 through 2021). This guide explains what
comes along, where the limits are, and what happens when you save a file like this.

## What you'll learn here

- How to open a `.mpp` file, and which paths support it.
- What exactly comes along: tasks, relations, calendars, resources and assignments.
- How accurate the imported start and finish dates are, and how splitting, leveling, manual
  scheduling and resource contouring are accounted for.
- What happens to progress: MS Project's own resumption convention for tasks in progress.
- One known calendar limitation: work weeks (a temporary alternate weekly pattern).
- What deliberately does not come along, and what you get for an unsupported file.
- What happens when you save or re-export an opened `.mpp` file.

## What comes along

When you open a `.mpp` file, Open Planner Studio reads:

- **Tasks**, including the hierarchy (summary tasks/subtasks) and the WBS coding.
- **Relations** in all four kinds (finish-to-start, start-to-start, finish-to-finish,
  start-to-finish), with lag — both in working days and in elapsed days, as well as percentage lag.
- **Calendars**: working days, working hours per day, and the concrete exception dates
  (days off).
- **Resources**, of type Work or Material. MS Project also has a Cost type, but — same as with
  the existing MSPDI import — it's treated as Work.
- **Assignments** of resources to tasks, including progress (percent complete, actual
  start/finish where present).

This is the same field set as the existing MS Project XML import (MSPDI), except for the
limitations listed below.

For **hour-based projects** (tasks that MS Project schedules at hour or minute precision, or a
calendar with, say, a lunch break) durations and working times come along at that precision: a
2-hour task no longer comes out as 0 days, and start/finish times keep their real time of day
instead of only the date. Open Planner Studio detects this automatically, per calendar — there's
nothing to turn on. See [Calendars & hour planning](docs://gids-kalenders-uren) for how hour mode
works elsewhere in the app.

## Opening

You open a `.mpp` file the exact same way as any other project file:

- **File → Open** (or **Ctrl+O**), just pick a `.mpp` file.
- Via **recent files** once you've opened one before.
- Via the AI assistant, with the `planner_import_schedule` tool (see the guide
  [Connecting an AI assistant (MCP)](docs://gids-ai-mcp)).

The file lands in a **new document** — like any import — unless the active tab is still empty and
unchanged.

## Date accuracy

Open Planner Studio schedules an opened `.mpp` file using the same calendar logic as MS Project
itself (working days, working hours per day, days off, and — for an hour-based project — the exact
clock time). Split tasks, leveling, manually scheduled tasks and contoured (resource-driven)
assignments are no longer treated as a deviating exception here — they're fully implemented
behavior, see the four sections below for what that means in practice. Across the full test corpus
(216 readable files / 3413 tasks, from public MPXJ and OzBuild test material to
real-world projects), the start and finish date match MS Project exactly, down to the minute for an
hour-based project — for every file in the corpus, with no remaining deviation. An automated test
guards this: if a change would cause even a single date in the corpus to drift, the test suite
fails. If you're unsure about a specific file that isn't in the corpus, check the critical tasks
against MS Project after opening it.

If the file contains tasks with a split, leveled, or resource-driven schedule, a one-time
informational notification appears when opening it — not a warning, since those tasks are simply
scheduled correctly; the notification only tells you the file contains them.

### Split tasks

A task that MS Project split into work interruptions (say, 3 days of work, a 2-day pause, then more
work) is read by Open Planner Studio as such: the breaks come from the file, and the Gantt bar shows
them as separate blocks joined by a thin connector line — **always visible**, regardless of the
**Task bars at interruptions** setting (Settings tab, ⚙ popup, or Backstage → Settings). A work
interruption is data, not a display preference; that setting only controls whether tasks *without*
their own splits are drawn broken up on non-working days (calendar necking). The print and PDF
preview show the same broken bars. Scheduling is segment-aware: remaining work keeps counting past
each gap, even for a task that's already partly done.

### Manually scheduled tasks

A task that was set to **Manually Scheduled** in MS Project keeps its own stored start and finish
date in Open Planner Studio — raw, with no calendar snap and with no relation or constraint moving
it; even a hard Must-Start/Finish-On pin on such a task is then a dead letter. Its successors
compute normally from those dates, following the ordinary relation rules (see the guide
[Relations & constraints](docs://gids-relaties-constraints)). Such tasks therefore have zero float
by construction (total and free float 0) and count as critical under the default setting — they
don't show ordinary float the way an automatically scheduled task does. Recalculating (**F5**)
changes nothing about a manually scheduled task: that's the whole point.

### Leveling

If MS Project gave a task a leveling delay, Open Planner Studio counts it as a real shift of the
early start — down to the minute for an hour-based project, including any elapsed-time delay (which
counts around the clock, not just during working hours). The delay is applied on both sides of the
calculation, so the float of the task (and of tasks waiting on it) still comes out right after
leveling.

### Contoured assignments

If a resource assignment in MS Project got its own work window that deviates from a flat, even
distribution (resource contouring, or a task spread out over a longer period than its duration
alone would require), Open Planner Studio follows that window on opening: the dates come from MS
Project's own stored answer, not from a plain duration calculation. What doesn't come along is the
shape of that distribution itself — the rising or falling load per day within the window. Open
Planner Studio doesn't yet have a contour calculation engine: a task's resource load is always
spread evenly across its working days, even for an imported contoured task.

If you then edit such a task yourself — its duration, dates, assignments, or calendar — Open
Planner Studio lets go of the window captured at import: the task falls back to an ordinary,
continuous duration calculation without the original contour shape. The first time this happens
within an open document, an informative notification appears with a link to this section; later
edits in the same document don't notify again. The task's properties panel now shows whether it's
still actively steered by MS Project, or whether that steering was let go after an edit — with the
same link. Neither touches the file itself: the originally read distribution always stays saved,
even after saving; only the DERIVED steering the engine used is let go.

## Milestones: MS Project's own finish-boundary convention for finish milestones

A milestone whose **Milestone kind** field is set to **Finish milestone** (see the guide
[Planning & WBS](docs://gids-plannen-wbs), Milestone kinds section) that's linked to a predecessor
via a finish-to-start relation lands on that predecessor's finish boundary itself, rather than on
the next working moment after it. With an **hour-based calendar** (see above) that means the
**exact finish clock time** of the predecessor — for example Tuesday 17:00, if the predecessor
finishes then — instead of Wednesday 08:00. In **day mode** the same distinction exists, just at
day granularity: the finish milestone lands on the same working day the predecessor finishes,
instead of the next working day. That's MS Project's own convention for finish milestones, and
Open Planner Studio follows it wherever this kind of milestone occurs, not just for a `.mpp`
import — a finish milestone in a manually created project behaves the same way. The default value
for **Milestone kind** is **Automatic**: such a milestone (and an explicit **Start milestone**)
simply lands on the next working moment, like an ordinary task — this convention applies only to a
milestone you've explicitly set to **Finish milestone**. An ordinary task (with its own duration)
after that same predecessor always starts on the next working moment regardless.

If a milestone in the source file itself carries a duration greater than 0, the **Milestone**
checkbox stays on, but Open Planner Studio simply schedules it as a task with that duration — see
the guide [Planning & WBS](docs://gids-plannen-wbs), Milestone kinds section.

## Progress: MS Project's own resumption convention

For a task that's already **partly done** when you open the `.mpp` file, Open Planner Studio
determines the resumption point of the remaining work the same way MS Project itself does: based
on the actual start time plus the time already elapsed, rather than (as with a project from
Primavera P6 or another format) based on the status date or the pressure from preceding tasks. You
usually won't notice this — the two approaches land on the same result for most tasks — but it's
why a `.mpp`-imported task can sometimes show a slightly different resumption point than an
otherwise identical task sourced from P6 or MS Project XML. This setting is a permanent property of
the project: it stays intact across **Save** (as IFC) and a later **Open**, with no toggle anywhere
to see or change it.

## Calendar exceptions and work weeks

Concrete, one-off exception dates in a calendar (a specific day off on a fixed date) come along
just fine, and so do **yearly recurring** exceptions with a repeat rule — for example a holiday
like Christmas that's set up in MS Project to recur automatically every year. Open Planner Studio
expands such a repeat rule itself into the concrete dates within the project period; there's
nothing you need to do for this. This applies both to ordinary days off and to **working
exceptions** (a day that's normally off but explicitly marked as working in the calendar — for
example a scheduled Saturday).

What remains a known limitation are **work weeks** — MS Project's way of assigning an alternate
weekly pattern to a calendar for a given date range (for example, "starting July 1st this team
also works Saturdays"). Only the standard weekly pattern and the individual exception dates come
along; a temporary alternate weekly pattern doesn't. In practice this affects few files — most MS
Project calendars don't use work weeks — but if you know a calendar has one, double-check it after
opening, under **Planning → Calendar** — see the guide
[Calendars & hour planning](docs://gids-kalenders-uren).

## What doesn't come along

The `.mpp` import is **read-only**: there is no `.mpp` export format, not even in the source
project (MPXJ) the reader is based on. In addition:

- **No baselines**, custom fields, outline codes, subprojects or cost fields. The field set is
  exactly what the MSPDI import also delivers, minus baselines.
- **Older `.mpp` formats** (MPP8/9/12 — Project 98 through 2007) are recognized but not read:
  you get a clear error message suggesting you export the file as XML in MS Project
  (**File → Save As → XML**) and open that file instead.
- **Password-protected files** give the same error with the same suggestion — the contents are
  not decrypted.

## Saving and exporting

As everywhere in Open Planner Studio, **Save** always writes IFC — there's no separate `.mpp`
project format to write back to. Because an opened `.mpp` file (just like an opened `.csv` or MS
Project XML) therefore gets no save target of its own, **Ctrl+S** on such a document is always
**save-as**: your source file is never silently overwritten with IFC content. To bring the
schedule back into MS Project, use **Backstage → Export → MS Project XML** — see the guide
[Import/export](docs://gids-import-export) for what does and doesn't come along there.

## Origin

The `.mpp` reader is derived from the source code and structural knowledge of MPXJ
(`github.com/joniles/mpxj`, Jon Iles et al.), a Java library under LGPL-2.1 — just like Open
Planner Studio itself is open source under LGPL-3.0.

## Further reading

- What each export and import format does and doesn't carry: [Import/export](docs://gids-import-export).
- Checking working days, hours and holidays after opening:
  [Calendars & hour planning](docs://gids-kalenders-uren).
