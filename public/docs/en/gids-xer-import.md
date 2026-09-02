# Opening Primavera P6 (.xer)

A `.xer` file is Primavera P6's exchange format. Open Planner Studio can open it directly; no P6 XML conversion or external converter is required. This guide explains what the import does, which data remains available, and where the current P6 model has limits.

## What you'll learn here

- How one XER file can open several project documents.
- How current projects, empty projects and baseline projects are handled.
- Which calendar, resource, progress and metadata information is read.
- How text encoding and P6 number notation are determined safely.
- What saving as IFC means and which P6 features do not yet have their own scheduling model.

## Opening and documents

Open a `.xer` file through **File → Open** or **Ctrl+O**. One export can contain several P6 projects. Open Planner Studio opens every non-empty current project as a separate document; the document with the most activities becomes active. Empty projects do not create a pointless tab.

After one file action, one informational notification appears, even when many documents open. It reports the actual projects found and opened, empty projects, baselines and any fallbacks. A later XER file action receives its own notification.

A P6 baseline project is not opened as a separate schedulable document. When it belongs to an open current project, it is retained as that document's baseline. A baseline reference whose target is not present in the file is not invented: it stays out of the baseline collection and is counted in the notification. A self-reference, a cycle of baseline references, or a selection that would otherwise open no document safely reverses the exclusion: those projects then open as ordinary current documents. This prevents a silently empty screen and makes the fallback visible.

Relations between two different P6 projects are retained as external source links. The app does not schedule them as ordinary relations, because every opened document is an independent schedule.

## What comes from P6

The import reads, among other things:

- **Projects, WBS, activities and milestones**, including P6 activity and duration types.
- **Relations, lags, constraints, progress and actuals**, plus P6 suspend/resume dates where the source file contains them.
- **Project and resource calendars**, working times and exceptions. Hours and clock times remain properties of the calendar rather than a project-wide guess.
- **Resources, rates and assignments**.
- **Activity codes, UDFs and notes**, including their source structure and activity links.

The raw P6 source data that Open Planner Studio reads remains part of the document. It survives tab switching, undo, recovery and saving. That is different from claiming that every P6 feature already has an equivalent editing or scheduling model: when such a model is missing, source data is retained rather than silently discarded.

## Text encoding and numbers

XER does not reliably declare its text encoding in the file. A UTF BOM is followed; without one, the reader uses valid UTF-8 and otherwise falls back to Windows-1252. If that non-ASCII choice is needed, the opening notification states the encoding used. The app does not guess individual rows or describe them as "skipped".

P6 can store decimal and thousands separators in the `CURRTYPE` table, either as literal characters or symbolic tokens such as `ds_Period` and `dg_Comma`. That notation is read before durations, work and float are converted. If `CURRTYPE` is absent, a dot is the safe default. If a value looks like a comma decimal while this source information is absent, import stops with a specific error instead of opening a potentially wrong schedule.

## Saving and exchange

An XER import is an **import**, not an XER editor or XER exporter. When you save afterwards, Open Planner Studio writes an IFC file. IFC is the app's native project file and retains the XER source data alongside the data the app uses. The original `.xer` file is never silently overwritten.

For exchange with Primavera, use the existing **Primavera P6 XML** export. It is a different format with its own limits; see [Import/export](docs://gids-import-export). Keep the IFC file as well when you want to reopen an edited project later.

## Limits that stay visible

Some P6 concepts are already retained but do not yet have a fully equivalent scheduling model:

- **`TT_Rsrc`** (resource-dependent activity) and **`TT_WBS`** are retained as P6 source types. The solver does not yet have a separate P6 scheduling mode for these types.
- A P6 resource curve with 21 points is retained as source distribution. A recognisable shape can be mapped to the nearest built-in curve for the histogram, but the original 21-point shape is not yet recalculated after an edit.
- The existing **P6 XML** reader and this XER reader do not yet cover the same full field set. XER can therefore contain data that P6 XML in the app does not yet read or write.

These limits do not remove source data from the IFC project file. When XER-specific source data is present and you export to CSV, MS Project XML or Primavera P6 XML, that source information cannot fit completely in the target format. After a successful export, one informational notification appears with a link to this guide. If you cancel the export or saving fails, that notification does not appear. Exporting to IFC retains the XER source data; the other exports include only the data their own format supports. The original `.xer` file is not overwritten.

## Further reading

- [Calendars & hour planning](docs://gids-kalenders-uren) explains how working times and exceptions shape a schedule.
- [Resources, histogram & leveling](docs://gids-resources-histogram) covers resources, assignments and loading in Open Planner Studio.
- [Baselines & progress](docs://gids-baselines-voortgang) explains how to use baselines after import.
- [Import/export](docs://gids-import-export) compares IFC, CSV, MS Project XML and Primavera P6 XML.
