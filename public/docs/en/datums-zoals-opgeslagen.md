# Dates as recorded

Import a schedule from Primavera P6 (or another package) as IFC, and Open Planner Studio
recalculates it right away when it opens — normal behaviour, and usually unremarkable. But an
exported schedule often doesn't carry all the logic the original package used: a few missing
relationships are enough for the recalculated dates to end up different from what the file
recorded. This guide explains how you'll spot that difference, how to bring back the original
dates, and where the limits of that view are.

## What you'll learn here

- Why recalculated dates can differ from the dates in an imported file.
- The notice that appears when that happens, and the **Show recorded dates** button.
- What changes once you're viewing the recorded dates — and what stays empty in the meantime.
- How to get back to the recalculated schedule, and what **Ctrl+Z** does in that process.
- What **Save** does while you're viewing the recorded dates.

## The problem: imported dates that shift

An IFC file holds two things: each task's dates, and the logic — which task follows which. When
opening a file, Open Planner Studio always recalculates from that logic, even if dates were already
present. For a file that came out of this app itself, that's rarely a surprise: the logic was
complete, so the outcome matches what was already there.

An export from another package is a different story. Primavera P6 (and similar software) can
record relationships in a way that doesn't always carry over fully into IFC, or the export may
deliberately leave logic out. The app then recalculates with whatever it does have, and lands on
different dates than the file recorded. Without further explanation you might assume the import
broke something — while the original dates are actually still there, just no longer visible.

## The notice above the schedule

When opening a file, the app compares what the file said against its own recalculation.

- **They match** — the normal case for a file you saved yourself — and you notice nothing.
- **They differ**, and a bar appears above the schedule, for example: *"Recalculation moved 47 of
  312 tasks away from the dates in the file."* Next to it sits the **Show recorded dates** button.

## Viewing the recorded dates

Click **Show recorded dates** and the app puts every task back on the date the file recorded. The
bar then turns into a standing notice: *"You're viewing the dates as recorded in the file. Nothing
has been recalculated."* That notice stays visible for as long as you're using this view, so you
never mistake it along the way for a recalculated schedule.

### What this view doesn't show

Some information only exists because the app calculates it — it can't come from the file if it
wasn't in there to begin with. While you're viewing the recorded dates, these stay empty:

- Which relationships are driving the schedule.
- Exceeded constraints.
- Tasks running out of logical sequence.

Float and the critical path are shown, but only if the file already contained those values itself.
Recalculate, and all of this fills back in.

## Getting back to the calculation

Edit a task, or press **F5**, and the app simply recalculates again and the notice disappears — you're
back in the normal, recalculated schedule. **Ctrl+Z** undoes that step and brings you back to the
recorded dates.

Once you've worked further in the recalculated schedule, there's no button left to switch back and
forth at will: the only way to see the original dates again is to reopen the file.

## Saving

Save while you're viewing the recorded dates, and the app writes those dates — not the recalculated
version. That way you never accidentally overwrite a colleague's schedule, or the source package's
schedule, with an outcome the app made up on its own.

## Further reading

- More on which formats you can import and what does and doesn't come along — read the
  [Import/export](docs://gids-import-export) guide.
- Float and the critical path in detail, including what "driving" actually means — read the
  [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) guide.
