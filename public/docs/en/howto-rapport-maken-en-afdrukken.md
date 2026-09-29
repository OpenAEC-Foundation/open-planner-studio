# Making and printing a report

Goal: choose a report of your schedule, check it in the preview and save it as a PDF, so you can hand it out or print it yourself.

## When you need this

Friday is the site meeting. The client wants the schedule on paper, the site manager wants to know what starts in the coming weeks, and the foreman wants a sheet with only his own tasks. You make overviews like these on the *Report* tab. The app calculates them from your schedule and shows them as a preview first. Then you export them to a PDF.

The app does not send a report to a printer itself. The end point is always a PDF. You print that with your PDF reader, or email it.

## Steps

### 1. Open the Report tab

Choose *Report* in the ribbon, or press Ctrl+P. So Ctrl+P does not open the print dialog of your browser or operating system, but this tab.

On the left is the *Report* column with the *Report type* list, a summary and the settings. On the right is the preview.

### 2. Choose the report type

The *Report type* list has eleven reports. Choose the one that fits your question.

- *Gantt chart*: the schedule as a bar chart on paper, with the columns WBS, Task Name, Duration, Start, End and Compl. to the left of the timeline. The report for the ordinary handout schedule.
- *Resource diagram*: the same bars, but with a band per resource and its tasks below it. For the question "what is crew X doing?". With the checkbox *Each resource on a new page* you get a sheet per crew.
- *Milestone overview*: all milestones with date, float and status (*On schedule*, *Critical* or *Late*).
- *Variance*: the current start and finish next to those of the active baseline, with the difference in work days. For the question "how far have we slipped?".
- *Look-ahead*: the activities that run or start in the coming period. The list for the weekly meeting.
- *Critical & near-critical*: the activities with no float (*Critical*) or almost no float (*Near-critical*).
- *Progress report*: where the project stands on the status date. Planned against actual, what is complete, what is running and what starts soon.
- *Schedule health*: a check of the schedule itself. Each check has a severity (*Error*, *Warning* or *Info*) and lists the tasks involved, for example under *Negative float*, *Missed deadline* or *No predecessor (open start)*.
- *Resource loading*: per resource per week or month, what is required against what is available. Overloaded weeks appear in the *Overloaded* column.
- *Resource assignments*: per resource, the activities it is assigned to.
- *WBS summary*: the schedule rolled up per WBS level. The overview for management.

### 3. Make sure the schedule is up to date

The app does not calculate by itself. If you changed tasks, relations or calendars since the last calculation, press **Calculate** (F5). The table reports warn you themselves, at the top of the report: *The schedule changed since the last calculation — press Calculate (F5) for current values.* Or, if it has never been calculated: *Not calculated yet — press Calculate (F5) for dates and float.*

The ribbon of the Report tab has no Calculate button, but F5 works here just fine. *Export PDF* also calculates first by itself if the schedule is out of date, so the PDF never lags behind your schedule.

### 4. Adjust the report

Under *Settings* are the choices for the Gantt chart and the Resource diagram. Look-ahead, Critical & near-critical, Progress report, Schedule health, Resource loading, Resource assignments and WBS summary only have *Paper:* and *Orientation:*, plus a *Report options* block with the choices of that report. The Milestone overview and the Variance have no choices of their own. For the period of a report see [Choosing the reporting period](docs://howto-rapportageperiode-kiezen).

- *Paper:* and *Orientation:* determine the sheet. By default this is A3 landscape, which is handy for a construction schedule, but not every printer prints A3. If you have an A4 printer, choose A4 now: the app then lays out the pages for A4, instead of you having to shrink them later.
- *Font size:* (90% to 125%) makes text and table larger or smaller. A larger font leaves less room for the timeline.
- *Follow view (filter, grouping, sort)* only appears for the Gantt chart. By default the whole task tree goes on paper. With this checkbox the report draws exactly the rows you see on screen, for example only the critical tasks from a layout. How to make such a view is in [Creating and using a layout](docs://howto-layouts-gebruiken).
- *Show baseline overlay* shows the active baseline next to the current bars. With *Status line:* you choose a *Status date line* or a *Progress line*.
- *Auto-fit to paper* is on by default: the timeline is then scaled to the page width and the number of pages follows from the height. If you turn it off, the report uses a fixed zoom and also tiles across the width, which quickly produces many pages. With *Timeline over:* you spread the timeline over 2 to 8 pages wide with auto-fit, for a long schedule you want to print at a readable size.

### 5. Check the preview

For the Gantt chart and the Resource diagram you see the paper with page header, table, timeline and legend. Scroll to look at the pages. *Preview quality* only sets how sharp the preview is on your screen; the PDF does not change with it. If below the pages it says *… and 1 more page — export for the full document* (with more pages *… and 2 more pages — export for the full document*), the preview does not have all pages ready. The PDF contains all of them.

The other reports are shown on screen as a table. What you see is what ends up in the PDF.

### 6. Export to PDF

At the bottom of the left column, click **Export PDF**. The suggested file name is the project name followed by the kind of report, for the Gantt chart for example *Extension house-planning.pdf*.

- In the desktop app, and in a browser that has a save dialog for files, you choose where the PDF goes. If you close that dialog without saving, nothing happens.
- In a browser without such a dialog, the browser puts the PDF in your downloads folder.

### 7. Print the PDF

Open the PDF in your PDF reader and print it there. If you print an A3 PDF on an A4 printer, your print dialog has to shrink the pages. So set the paper size first in step 4.

## Pitfalls and what the app does

**The Print button or Ctrl+P does not print.** The *Print* button in the ribbon (group *Report*) and Ctrl+P only take you to the Report tab. Nothing goes to a printer, and there is no separate print command: the way to paper goes through the PDF.

**Company: does not stay.** The *Company:* field of the Gantt chart starts with the company from the project information. What you type over it applies only while you stay on the Report tab. If you go to another tab and come back, the company from the project information is back. You cannot type in *Author:* here. You change both with *Settings › Project › Project info*, in the fields *Company* and *Author*, and confirm with *Apply*.

**Bar colors: also applies to your screen.** The *Bar colors:* choice in the report is the same choice as *Bar colors* on the View tab. If you change it in the report, your Gantt on screen changes with it.

**The Variance without a baseline.** If you have no active baseline, instead of a comparison it says *No active baseline — save a baseline or set one active.*

**Status line without a status date.** If you choose a *Status line:* while the project has no status date, the report warns with *Set a status date first* and draws nothing. You set the status date at *Planning › Baselines & progress › Status date*.

**Paper applies to all reports.** There is one choice for *Paper:* and *Orientation:*, shared by all reports. The Milestone overview and the Variance have no paper choice of their own: they use what you set in another report, A3 landscape by default. So choose the paper first in a report that offers it, for example the Gantt chart, and then go back.

**The settings apply to all projects.** Paper, font size, period and the other choices are remembered by the app on this device, for all your projects. They do not belong to the project file.

## See also

- [Choosing the reporting period](docs://howto-rapportageperiode-kiezen): a look-ahead or progress report over a certain stretch of time.
- [Creating and using a layout](docs://howto-layouts-gebruiken): first filter or group, then print with *Follow view*.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do when Resource loading shows overloaded weeks.
- [Critical path and float](docs://uitleg-kritiek-pad): why an activity is critical or near-critical.
