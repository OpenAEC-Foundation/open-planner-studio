# Importing progress

A site foreman usually doesn't work in Open Planner Studio itself. Send them a spreadsheet, let them
fill in what's already done, and read the returned sheet back in — without having to rebuild your
project. That's what this feature does: it **updates existing tasks**, it never creates new ones.

## What you'll learn here

- Why you set a status date first, before reading a sheet back in.
- How to export the sheet, and what the `OPS Task ID` column does.
- Where to find the feature.
- Which three columns are read, and which two are only used as a check.
- That completion is always a percentage.
- Which date formats work, and what happens when the app isn't sure.
- What an empty field means.
- How linking works, and how to link a row by hand.
- Why new rows in the sheet don't become new tasks.
- Which rows get refused, and why.
- That the preview is mandatory and that you can't switch documents during the import.
- That you need to recalculate afterwards.

## Set a status date first

Before reading a returned sheet, set a **status date** on the Planning tab (your project's reference
date). Without a status date the app cannot judge whether a reported actual date lies in the future —
and that check is exactly the protection against a typo in a returned sheet (for example an actual
start accidentally entered as next month). How to set the status date, and what else it does, is
covered in the [Baselines & progress](docs://gids-baselines-voortgang) guide.

## Exporting the sheet

The fastest route is the **Export progress sheet** button on the Planning or Table tab, in the
Progress group. That button produces a slim CSV sheet right away with exactly the columns a foreman
needs: task id, WBS, name, Start, Finish, Completion (%), Actual Start and Actual Finish — nothing
else. The file is named `<project name>-voortgang.csv` and lands in your downloads folder wherever
possible. This is the recommended route: fewer columns to accidentally change, and nothing for the
foreman to ignore. The column headers themselves say what's expected too — for example
"Completion (%) — fill in: 0 to 100, whole numbers" or "WBS — do not change" — so a foreman doesn't
have to guess which columns to fill in and which to leave alone.

You can also use the full CSV export instead (Backstage → Export → CSV) — it contains the same
progress columns, plus every other project field (duration, predecessors, status, …). Both sheets are
readable by the import: every CSV export carries a first column `OPS Task ID` — a technical,
human-unreadable key the app uses to link a returned sheet back to the right task. Don't remove or
change that column; feel free to move or sort the rows, that makes no difference. Send the file to the
foreman, have them fill in the progress columns and send it back. More on the full CSV export is in the
[Import/export](docs://gids-import-export) guide.

## Where to find the feature

You can read a returned sheet back in from three places — all three open the same screen:

- Backstage → Import, the card "Update progress from a spreadsheet" at the top.
- The Planning tab, in the Baselines & progress group.
- The Table tab, in the Progress group.

## Which columns are read

The import reads exactly three columns: **Completion (%)**, **Actual Start** and **Actual Finish**.
The **Start** and **Finish** columns are also read, but only to check *how* the dates in the file are
written (see below) — their values are never copied onto a task. If you change the planned dates in
the returned sheet, nothing happens: those columns are a reference point only, never input.

## Completion is always a percentage

Whatever a foreman types in the Completion (%) column is a percentage: `100` is one hundred percent
done, `1` is one percent, `45.5` may use either a comma or a period. The percent sign is optional —
`40` and `40%` mean the same thing. A value below 0 or above 100 is refused; there is no alternative
reading where, say, `0.4` would count as forty percent.

The exported sheet always contains **whole** percentages (e.g. "38", never "38.5") — a spreadsheet
program with a different locale swaps the decimal and thousands separators, so a decimal percentage
gets read there as an entirely different number (`8.38` becomes `838`). If you type decimals yourself
(for example "33.4"), that still counts as a real change as soon as it differs from the current value.
A whole percentage that rounds to what the task already has doesn't count as a change: if a task is
already at 33.4% and the sheet says "33", nothing changes. That applies at the edges too: a task at
99.5% or higher cannot be rounded up to one hundred percent complete via "100" in the sheet — the file
can't tell 99.5% and 100% apart, so it reads as no change. Mark such a task complete in the app itself,
or fill in a real finish date instead.

## Dates

The following notations work, with or without a time: `2026-06-09`, `9-6-2026`, `9/6/2026`,
`9.6.2026`. The app determines, for the **whole file**, whether the first component is the day or the
month — Excel is consistent about that, so it only needs deciding once per file. Where possible the
app works this out automatically (for example because one component is above 12, or because the dates
in the sheet match the planned dates in your project).

If the app is unsure, it **asks** you, before you see the preview: you're shown the first ambiguous
date from the file, with the two possible readings as buttons. If you pick the wrong one, you can go
back to that same question from the preview — any links you made by hand stay exactly as they were.

## An empty field means: no change

A returned sheet often comes back partially filled in. If a foreman leaves a column empty, the task's
existing value simply stays as it is — an empty field **clears nothing**.

## Linking: automatic, and by hand

Every row is first linked on `OPS Task ID`. If that's missing (for example because the sheet was
edited in another program and lost the column), the app falls back to the WBS code. A WBS fallback is
weaker evidence than the real id, so such a row shows up in the preview under "Link is uncertain": you
can **confirm** it with one click, or **change** it to a different task.

If no task can be found for a row at all — for example because the WBS code isn't unique, or because
there's nothing usable in it — it shows up under "Waiting for a link". There you link the row by hand
to a task through a searchable picker (search by WBS code or name); a task already claimed by another
row can't be picked again.

## New rows don't become new tasks

This import only updates **existing** tasks. A row that can't be linked to any task stays waiting for
a link, or gets refused — it never silently becomes a new task. To add new tasks, do that in the app
itself.

## Which rows get refused

A row is refused, with a reason shown in the preview, in cases including:

- The actual date is after the status date (hence: set that status date first).
- Actual finish is before actual start.
- The row refers to a summary task — those can't carry their own progress; the sheet the app exports
  says so in the cells themselves: a summary task's fill-in cells read "— summary task: do not fill
  in", and you simply leave that text alone.
- A date or percentage is unreadable.

One refused row doesn't stop the rest of the sheet: every other row is still processed.

## The preview is mandatory

Before anything in your project changes, you always see a preview first: per row, what will change (or
why a row is refused), with dates written out in full so a day/month mix-up stands out. There is no
way to skip the preview. While this screen is open, you **cannot switch to another document** — that
prevents any linking work you just did by hand from being lost to an accidental document switch.
Confirming the import happens in **one step**: a single Ctrl+Z undoes the whole sheet at once, never
row by row.

## Afterwards: recalculate

A successful import updates the progress fields on your tasks, but doesn't automatically recalculate
the schedule. Press **F5** (or the Calculate button) to let the new progress flow through the rest of
your schedule.

## Further reading

- [Baselines & progress](docs://gids-baselines-voortgang) — the status date, progress mode, and
  entering progress by hand in the app itself.
- [Import/export](docs://gids-import-export) — the CSV export in general.
