# Import/export

Open Planner Studio stores a project as IFC by default — no separate project file alongside it. But
sometimes a schedule also needs to live outside the app: in Primavera P6, in Microsoft Project, or as
a flat table for a spreadsheet. This guide explains what the native IFC format really means, what
each export format does and doesn't carry, and where importing/exporting lives in the app.

## What you'll learn here

- What "IFC is the native format" precisely means for opening and saving.
- What does and doesn't come along when exporting to MS Project (MSPDI) and Primavera P6 XML.
- What the CSV export contains — and what is deliberately left out.
- Where to import and export: **Backstage → Export** and **Backstage → Import**.
- How extensions can add extra import formats.

## IFC: the native format

An Open Planner Studio project *is* an IFC 4x3 file (the buildingSMART standard). There is no
separate JSON or project file alongside it: **Save** and **Open** (Backstage, or **Ctrl+S**/**Ctrl+O**)
read and write IFC directly. That means everything you do in the app — tasks, WBS, relations with
constraints, resources and assignments, calendars (both the project calendar and resource
calendars), baselines, progress, notes, activity codes and custom fields, external links between
projects — ends up in the same file and comes back in full the next time you **Open** it. If you run
into a new kind of project data in the app, you can assume it round-trips through IFC; if something
does *not* round-trip, that's called out explicitly below.

IFC is also how this app connects to the rest of the OpenAEC toolkit: the same file can be read by
BIM software for the 4D link (schedule alongside the building model).

## Exporting to other formats

Open **Backstage → Export** for four formats:

- **CSV (semicolon-separated)** — universal table export. All tasks with dates and durations.
- **MS Project XML** — opens in Microsoft Project. Full WBS structure.
- **Primavera P6 XML** — for Oracle Primavera P6.
- **IFC 4x3** — the buildingSMART standard, the same as the native format (handy as a "save as" to a
  separate file, or to share a copy without touching the rest of your open documents).

Each format has its own limitations: the richer the target format, the more comes along, but none of
the three external formats is a full mirror of IFC.

### CSV

The CSV export contains **only the task table**: WBS code, name, duration (days), start, finish,
predecessors (as a text code, e.g. `2.1FS+3d`), task type, status, completion (%), actual
start/finish, critical (yes/no), total float and description. **Resources, assignments, calendars
and baselines are deliberately left out** — CSV is purely a task table for anyone who wants to view
or edit the schedule in a spreadsheet, not a full-fidelity project exchange. When you **import** a
CSV file back in, baselines therefore stay empty (there was nothing to read them from). Also
disappearing without any warning: the flag that a task is **manually scheduled**, the sub-minute
precision of a **leveling delay**, **task splits**, and **resume/stop** resumption data from a
`.mpp` import — CSV only has room for Start/Finish as plain dates, so that extra information simply
doesn't fit. The raw Start/Finish dates of a manually scheduled task do stay put; only the fact
that they're manual is lost.

### MS Project XML (MSPDI)

MSPDI is considerably richer than CSV: resources, assignments (including their loading curve),
calendars and baselines do come along. Still, not everything is expressible in MSPDI. On export the
app warns in the developer console (`console.warn`) whenever something is lost, with the exact
number of affected items:

- **External links** between projects are dropped (the other task's "ghost" reference stays
  in-app only).
- **Soft Start On/Finish On constraints** (soft `MSO`/`MFO`) are degraded to SNET/FNET — MSPDI codes
  2/3 are *hard* (Must), so the soft variant's upper bound is lost. Hard `MSO`/`MFO` export exactly.
- **Secondary constraints** are lost — MSPDI only has one constraint field per task.
- **Hammock tasks** (derived duration) are exported as a plain task with the computed dates — MSPDI
  has no native hammock/LOE type.
- **Task notes** are deliberately **not** exported, even though MSPDI has a `<Notes>` field: our
  notes are a checklist-with-checkboxes form that doesn't translate cleanly to plain text.
- **Manually scheduled tasks** (`.mpp` import) are exported without the native `<Manual>` element — the dates themselves do come along (they're
  already in Start/Finish), only the fact that MS Project would show them as "Manually Scheduled"
  doesn't.
- The **sub-minute precision** of a leveling delay is lost — MSPDI has no native
  `<LevelingDelay>`/`<LevelingDelayFormat>` element for our minute-accurate value.
- **Split tasks** and **contoured assignments** are exported without the native `<TimephasedData>`
  element — the computed dates themselves do come along, the segment/window information doesn't.
- **Resume/stop** (a task resumed outside the ordinary progress logic) has no native
  `<Resume>`/`<Stop>` element.
- The **critical-path definition** (near-critical mode/threshold) and other scheduling options aren't
  natively expressible in MSPDI and are therefore lost — those are only preserved via IFC.

### Primavera P6 XML

The same kind of trade-off as MSPDI, with a few P6-specific quirks:

- **External links** and **hammock tasks** are dropped/simplified the same way as with MSPDI, each
  with a warning.
- **Task notes** are also left out here — P6 XML has no suitable field for them.
- **Percent lag** on a relation (e.g. 40% of the predecessor's duration) is "baked" into a fixed
  number of days, because P6 has no percent-lag concept.
- **Calendar-day lag** (lag in elapsed days rather than working days) is exported as a plain
  hour-based lag — P6 has no separate lag unit per relation.
- The **LATE_PEAK** loading curve has no P6 equivalent and is exported as the closest approximation
  ("Early Peak").
- **Working calendar exceptions** (a day that's normally off but explicitly marked as working —
  for example a scheduled Saturday) are dropped — P6 XML has no schema field to mark that per
  date. P6 models a structurally different weekly pattern through a separate work-week setting
  instead of individual dates, so an automatic translation would change the entire weekly pattern
  rather than just the one date — that's deliberately not risked. The app warns (with the count)
  whenever this affects a file.
- **Manually scheduled tasks** (`.mpp` import) go further than with MSPDI: P6 has no concept of
  "manually scheduled" at all, so such a task exports as an ordinary task with computed dates —
  unlike MSPDI, the raw stored dates themselves aren't guaranteed to stick around here.
- The **sub-minute precision** of a leveling delay is lost — not expressible in P6 XML.
- **Split tasks** and **contoured assignments** are dropped — not expressible in P6 XML.
- **Resume/stop** (a task resumed outside the ordinary progress logic) is dropped — not expressible
  in P6 XML.
- Scheduling options (as with MSPDI) are not exported.

These warnings aren't sloppiness — they're a deliberate, explicit choice: a visible warning per
dropped item beats silent data loss. Open, for example, the showcase
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (it has task
notes and a relation with a percent lag) and export to P6 or MS Project XML: the developer console
then shows exactly which items were dropped or simplified, and how many.

## Importing

**File → Open** (or **Backstage → Open**) accepts `.ifc`, `.csv`, `.xml` and `.mpp` files. For an
`.xml` file, the app detects on its own whether it's a Primavera P6 or an MS Project file, based on
the content. As described above: a CSV or P6 import produces a project **without baselines** (there
weren't any in the source), while IFC and MSPDI bring baselines along.

A `.mpp` file (Microsoft Project's native format, Project 2010 through 2021) is a separate path:
that import is **read-only** — there is no `.mpp` export, so exporting back to MS Project runs
through MSPDI XML. See the guide [Opening MS Project (.mpp)](docs://gids-msproject-import) for
what comes along and what the limitations are.

A small, technical note for anyone importing a task with an **elapsed duration** (24/7 scheduling,
ignoring days off) from a source that only provides a **date** without a time of day — CSV,
Primavera P6, an IFC date field, or the AI assistant — where that task lands on an **hour-based
calendar**: such a task then starts at midnight (00:00) on the given date, not at the day's first
work instant. This is deliberate: an explicitly read time is never moved to a different calendar
day. This doesn't come up with `.mpp` import, since that format always supplies a full time of day.

## Extension importers

Beyond the fixed formats above, installed extensions can add their own importers — for example for a
format that isn't supported by default. Those show up under **Backstage → Import**, each with its own
name, description and matching file extensions; without any import extensions installed, that
section is empty. Check **Backstage → Extensions** to see what's available.

## Further reading

- Baselines only come along via IFC and MS Project XML, not via CSV or P6 — read the guide
  [Baselines & progress](docs://gids-baselines-voortgang) for how to record a baseline.
- Resources, assignments and loading curves — read the guide
  [Resources, histogram & leveling](docs://gids-resources-histogram) for how those are built before
  you export.
