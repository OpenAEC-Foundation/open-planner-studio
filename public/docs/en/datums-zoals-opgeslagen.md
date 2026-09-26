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
forth at will: the only way to see the original dates again is to reopen the **original source
file**. An IFC you have saved yourself in the meantime does not always help — see below.

## Saving

Save while you're viewing the recorded dates, and the app writes those dates — not the recalculated
version. That way you never accidentally overwrite a colleague's schedule, or the source package's
schedule, with an outcome the app made up on its own.

### What a saved project still knows about the source file

Only for a Primavera `.xer` import does the project file keep a complete copy of the original file.
That lets the app show Primavera's dates later on, even after you first recalculated with **F5** and
then saved.

For P6 XML, MS Project XML, `.mpp` and an IFC from another package the app does **not** keep
such a copy. After saving, the original dates are only in your project file if you save **while this
view is on**. Press **F5** first and save afterwards, and the file holds the recalculated dates; the
original dates are gone from it. Reopen that file and there is nothing left to compare: you get no
notification and no view. To see the original dates again, reopen the original source file.

## Opening another file format turns this view on by itself

For a file with dates that a scheduling package calculated itself, the view switches on as soon as
you open it and differences exist — you don't first click **Show recorded dates**. That applies to
Primavera P6 (`.xer` and P6 XML) and Microsoft Project (`.mpp` and MS Project XML). From such a file
the app reads the dates the source package
recorded — including, where the file carries them, the late dates, the float and the critical flag —
and compares them with its own recalculation. If anything differs, you see the recorded dates, with
the opening notification stating the number of differing tasks and the standing notice above the
schedule. Whatever the file did not record stays "Not recorded" (see below): an MS Project task with
only an early start and early finish is compared on those two axes and shows the other four empty.

### Which files get this view, and which do not

Only calculated dates are worth comparing. A start date someone typed in is input: comparing against
it would only show that the logic gives a different date than was typed. Therefore:

- **CSV** opens normally and is recalculated — no view, no offer and no notification. The Start column
  is the input, not the outcome of a calculation.
- **An IFC from another package with only start and finish dates** (ScheduleStart/ScheduleFinish)
  likewise: those are input dates too.
- **An IFC from another package with calculated dates** (EarlyStart/EarlyFinish in the task times,
  such as a Primavera export to IFC) does get the view.
- **A project file Open Planner Studio saved itself** only gets the view if the file remembers which
  package the dates originally came from. The app only writes that along when you save **while this
  view is on** — so as long as you do not change dates or recalculate. An edit that does not affect
  dates, such as changing the project description, is fine. Change a duration, a relationship or a
  calendar, or press **F5**, and the file holds our own calculation from then on and the note is
  dropped. A project you created in the app itself, or an older project file without that note,
  never gets the view: there the app would only compare its own earlier calculation with the new
  one.

For a `.xer` or P6 XML file the notice says "as Primavera recorded them"; for the other formats "as
recorded in the file", because the app then does not know which package the dates came from.

If you then save the project as IFC and reopen that file later, the view only switches on by itself
as long as you have **not edited** the project since the import — and as long as the file still
carries the original dates (see *What a saved project still knows about the source file* above: for
everything except `.xer`, only if you saved while this view was on). Recalculating with **F5** and
saving do not count as editing; changing a task, adding a relationship or adjusting a calendar do.
Once you have edited, reopening only offers the view — you click yourself — so that a schedule you
have changed in the meantime never comes back on screen with the old dates from the source file
unasked. The app remembers "unchanged since import" inside the project file itself.

For a `.xer` project that offer is always possible, thanks to the copy of the source file. For the
other formats it depends on whether the view was still on when you saved. An edit that affects dates (a duration,
a relationship, a calendar) leaves the view, so what you save afterwards are recalculated dates and
reopening has nothing left to offer. An edit that does not affect dates, such as changing the project
description, keeps the view on; save then, and the original dates stay in the file and reopening
does offer them. Save again afterwards without first choosing **Show recorded dates**, and the file
holds the recalculated schedule; the next reopen has nothing left to offer.

Tasks inside this view are also recognisable in the table — column **Recorded-dates source** — and
with a badge in the properties panel of the selected task. **F5** and editing a task leave this view
in exactly the same way as described above; the calculation itself never uses the source package's
recorded dates as input, only as a view. See [Opening Primavera P6 (.xer)](docs://gids-xer-import)
and [Opening MS Project (.mpp)](docs://gids-msproject-import) for what those imports bring along.

## "Not recorded"

Primavera doesn't record all four axes — late start, late finish, total float and free float — for
every activity; an activity might have an early date but no float, for example. When such an axis is
missing from the source file, the relevant column in the table shows "Not recorded" instead of a
number. That's not an error: it only means the file itself said nothing on that point, so Open Planner
Studio doesn't invent anything either. This applies only while you are looking at this view: as
soon as the app shows its own calculation — outside this view, or after recalculating with **F5** —
that column simply holds the calculated number.

The same honesty applies off screen: export to CSV while this view is on and the cell for an
unrecorded axis stays empty instead of showing a `0`, and the AI assistant sees `null` for such an
axis, together with the list of axes the file did not record.

The reports (the Report tab, including the PDF and the print preview) do not have that blank cell
yet: there a not-recorded axis shows an empty field or a `0`. While this view is active, one notice
therefore appears above every report saying that you are looking at the dates from the file and where
those zeros come from.

## Further reading

- More on which formats you can import and what does and doesn't come along — read the
  [Import/export](docs://gids-import-export) guide.
- Float and the critical path in detail, including what "driving" actually means — read the
  [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) guide.
- Everything a `.xer` import brings along — read the
  [Opening Primavera P6 (.xer)](docs://gids-xer-import) guide.
