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
CSV file back in, baselines therefore stay empty (there was nothing to read them from).

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
- Scheduling options (as with MSPDI) are not exported.

These warnings aren't sloppiness — they're a deliberate, explicit choice: a visible warning per
dropped item beats silent data loss. Open, for example, the showcase
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (it has task
notes and a relation with a percent lag) and export to P6 or MS Project XML: the developer console
then shows exactly which items were dropped or simplified, and how many.

## Importing

**File → Open** (or **Backstage → Open**) accepts `.ifc`, `.csv` and `.xml` files. For an `.xml`
file, the app detects on its own whether it's a Primavera P6 or an MS Project file, based on the
content. As described above: a CSV or P6 import produces a project **without baselines** (there
weren't any in the source), while IFC and MSPDI bring baselines along.

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
