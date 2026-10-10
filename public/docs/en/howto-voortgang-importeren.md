# Importing progress from a spreadsheet

Goal: put the progress that site staff fill in on a spreadsheet into the schedule in one go, without clicking every task yourself.

## When you need this

A subcontractor or site manager does not have the app, but reports his state every week: how many percent done, when started, when finished. You send him a sheet with your tasks, he fills in three columns and sends it back. From that the app reads only three values per task: completion, actual start and actual finish. The rest of your schedule is left alone. What the app does with that progress is explained in [Progress, status date and baseline](docs://uitleg-voortgang).

## Steps

### 1. Set the status date and calculate

Set the status date as described in [Updating progress](docs://howto-voortgang-bijwerken). The site manager fills in actual dates up to and including that day. If the schedule is out of date, the app recalculates it before the sheet is made.

### 2. Make the sheet

Choose *Planning › Progress › Export progress sheet*. The same button is on the *Table* and *Report* tabs. The app makes an Excel file and suggests the name *(project name)-voortgang.xlsx*; in the browser the file lands in your downloads. Prefer a CSV? Choose *File › Export › Progress sheet (CSV)*. The Excel sheet is there too, as *Progress sheet (Excel)*.

The sheet has eight columns. The column names stay in English, with a short instruction in the language of the app after them:

- `OPS Task ID`, `WBS` and `Name` are only there to recognise the task. Leave them alone.
- `Start` and `Finish` are the planned dates, for information. The app never writes them back.
- `Completion (%)`, `Actual Start` and `Actual Finish` are the ones you fill in.

The Excel sheet is protected, without a password: only the three fill-in columns can be edited. Excel checks that a percentage is between 0 and 100 and that an actual date is a date. A phase (summary task) is marked grey with *— summary task: do not fill in*.

### 3. Have it filled in

For each task the site manager fills in:

- `Completion (%)`: 0 up to and including 100. In the Excel sheet decimals are allowed (for example 33.3); in the CSV the instruction asks for whole numbers.
- `Actual Start` and `Actual Finish`: in Excel as a date in your own regional setting; in the CSV as dd-mm-yyyy.

Whatever stays empty changes nothing. So an empty cell does not clear existing progress either; that can only be done in the app. A task that has not started, he leaves completely empty.

### 4. Read the sheet in

1. Choose *Planning › Progress › Update progress from a spreadsheet* (also on the *Table* and *Report* tabs), or *File › Import › Update progress from a spreadsheet*. The window *Update progress from a spreadsheet* opens.
2. Click *Choose file…* and choose the filled-in `.xlsx` or `.csv` file.
3. If the dates in a CSV are ambiguous, the app asks *Day first or month first?*, with the date from your file read in two ways. Click the date that is right.
4. You now see a preview. At the top are four counters: *Applied*, *Unchanged*, *Waiting for a link* and *Refused*. Below that, per task, what changes, for example *Completion: 0% → 100%*.
5. Check the preview and click *Apply*. The window shows *Result*, with the counters and the rows that were refused and why. Finish with *Close*.

You cannot skip the preview. The button *Apply* is disabled as long as there is nothing to apply.

### 5. Recalculate the schedule

Reading in does not recalculate by itself. Press **Calculate** (F5), for example through *Planning › Schedule › Calculate*, unless *Calculate automatically* is on.

## Rows that do not simply fit

The app links every row to a task, first on `OPS Task ID` and otherwise on the WBS number.

**Link is uncertain.** If the app found the task only by WBS number, the row is under *Link is uncertain*, with *Confirm* and *Change*. The row is applied too if you do nothing; so check that the task is right. *Confirm* takes the row out of this list; it changes nothing about what is applied. *Change* lets you choose another task. With *Clear link* you remove a link you made yourself. Note: a sheet from another project with the same WBS numbers is linked after all, under *Link is uncertain*, and applied when you click *Apply*.

**Waiting for a link.** If the app found no task, or several with the same WBS number, the row is under *Waiting for a link*. At *Choose a task…* choose the right task; you search by WBS number or name. If you do not link it, the row is refused.

## Pitfalls and what the app does

A row that does not fit is refused with a reason. The rest of the sheet just carries on. These are the main messages:

- *The actual date is after the status date.* Set the status date later or correct the sheet.
- *This task is planned to start after the status date: fill in its actual start in the sheet first.* The app does not invent a start; supply it in the sheet.
- *Percentage outside 0–100. Check the decimal separator: 8.38 can be read as 838 by a spreadsheet with a different locale.*
- *Summary tasks cannot receive progress from a sheet.* The progress of a phase follows from the tasks below it.
- *Actual finish is before actual start.*
- *Unreadable date.* and *Unreadable percentage.*
- *The entered values contradict each other.* For example an actual finish with a percentage below 100.
- *No task found for this row.* The sheet mentions a task ID and WBS number that do not occur in this project.
- *This WBS code occurs on multiple tasks — link the row by hand.*
- *Another row already claimed this task.* Two rows point to the same task.
- *Refused by the planner.* Another refusal by the planning itself, without a message of its own.

If the whole file is refused, one of these messages appears in the window: *This file has no “OPS Task ID” or “WBS” column to link rows to tasks.*, *This file has none of the Completion, Actual Start or Actual Finish columns.*, *This file is too large to read as a progress sheet.* (more than 16 MB), *This file has too many rows to read as a progress sheet.* (more than 50,000 rows) or *This file is password-protected and cannot be read.* or *This file could not be read as a progress sheet.*

**No status date.** If there is no status date yet and the import applies progress, the app sets it to today and tells you. So set it yourself first.

**Everything back in one go.** The whole sheet is one step for Ctrl+Z.

**Only what you fill in.** A row with no difference from the schedule counts as *Unchanged*. A task without a row in the sheet stays as it was.

## See also

- [Progress, status date and baseline](docs://uitleg-voortgang): what the app calculates with actual dates and percentages.
- [Updating progress](docs://howto-voortgang-bijwerken): entering progress in the app itself.
