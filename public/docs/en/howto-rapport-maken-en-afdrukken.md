# Making and printing a report

Goal: choose a report of your schedule, check it in the preview and save it as a PDF, so you can hand it out or print it yourself.

## When you need this

Friday is the site meeting. The client wants the schedule on paper, the site manager wants to know what starts in the coming weeks, and the foreman wants a sheet with only his own tasks. You make overviews like these on the *Report* tab. The app calculates them from your schedule and shows them as a preview first. Then you export them to a PDF.

The app does not send a report to a printer itself. The end point is always a PDF. You print that with your PDF reader, or email it.

## Steps

### 1. Open the Report tab

Choose *Report* in the ribbon, or press Ctrl+P. Ctrl+P takes you to this tab. If you are typing in a field, a dialog is open or presentation mode is on, Ctrl+P does not work. In the browser the print dialog of the browser then opens, and that prints the screen, not the report.

From the file menu, choose *File › Print › Open print preview*. The file menu closes and the Report tab opens. Then choose your report and settings.

On the left is the *Report* column with the *Report type* list, a summary and the settings. On the right is the preview.

If *New Report tab* is on under *Settings › Advanced › Experimental*, the Gantt chart looks different. Then read [The new Report tab](docs://howto-rapport-maken-en-afdrukken#the-new-report-tab-experimental) below.

### 2. Choose the report type

The *Report type* list has eleven reports. Choose the one that fits your question.

- *Gantt chart*: the schedule as a bar chart, for the ordinary handout schedule.
- *Resource diagram*: the same bars, but with a band per resource. For "what is crew X doing?", if you like with a sheet per crew.
- *Milestone overview*: all milestones with date and status.
- *Variance*: the current schedule next to the active baseline. For "how far have we slipped?".
- *Look-ahead*: what runs or starts in the coming period. The list for the weekly meeting.
- *Critical & near-critical*: the activities with no or almost no float.
- *Progress report*: where the project stands on the status date, the day on which you measure progress.
- *Schedule health*: a check of the schedule itself for errors and unusual values.
- *Resource loading*: per resource per week or month, what is required against what is available.
- *Resource assignments*: per resource, the activities it is assigned to.
- *WBS summary*: the schedule rolled up per WBS level, for management.

### 3. Make sure the schedule is up to date

The app does not calculate by itself. If you changed tasks, relations or calendars since the last calculation, press **Calculate** (F5). The table reports warn you themselves, at the top of the report: *The schedule changed since the last calculation — press Calculate (F5) for current values.* Or, if it has never been calculated: *Not calculated yet — press Calculate (F5) for dates and float.*

The ribbon of the Report tab has no Calculate button, but F5 works here just fine. *Export PDF* also calculates first by itself if the schedule is out of date, so the PDF never lags behind your schedule.

### 4. Adjust the report

Under *Settings* are the choices for the Gantt chart and the Resource diagram. Look-ahead, Critical & near-critical, Progress report, Schedule health, Resource loading, Resource assignments and WBS summary only have *Paper:*, *Orientation:* and *Font:*, plus a *Report options* block with the choices of that report. The Milestone overview and the Variance have no choices of their own. For the period of a report see [Choosing the reporting period](docs://howto-rapportageperiode-kiezen).

- *Paper:* and *Orientation:* determine the sheet. By default this is A3 landscape, which is handy for a construction schedule, but not every printer prints A3. If you have an A4 printer, choose A4 now: the app then lays out the pages for A4, instead of you having to shrink them later.
- With the Resource diagram, the checkbox *Each resource on a new page* gives a sheet per crew.
- *Font:* chooses the font of all reports: *Inter* (default), *Liberation Sans* (like Arial), *Carlito* (like Calibri) or *Liberation Serif* (like Times New Roman). The choice applies to every report, like the paper.
- *Font size:* (90% to 125%) makes text and table larger or smaller. A larger font leaves less room for the timeline.
- *Follow view (filter, grouping, sort)* only appears for the Gantt chart. By default the whole task tree goes on paper. With this checkbox the report draws exactly the rows you see on screen, including collapsed phases, for example only the critical tasks from a layout. How to make such a view is in [Creating and using a layout](docs://howto-layouts-gebruiken).
- *Show baseline overlay* shows the active baseline next to the current bars. With *Status line:* you choose a *Status date line* or a *Progress line*.
- *Auto-fit to paper* is on by default: the timeline is then scaled to the page width and the number of pages follows from the height. If you turn it off, the report uses a fixed zoom and also tiles across the width, which quickly produces many pages. With *Timeline over:* you spread the timeline over 2 to 8 pages wide with auto-fit, for a long schedule you want to print at a readable size.

### 5. Check the preview

For the Gantt chart and the Resource diagram you see the paper with page header, table, timeline and legend. Scroll to look at the pages. *Preview quality* only sets how sharp the preview is on your screen; the PDF does not change with it. With the new Report tab the paper is always sharp, and this choice is not there. If below the pages it says *… and 1 more page — export for the full document* (with more pages *… and 2 more pages — export for the full document*), the preview does not have all pages ready. The PDF contains all of them.

The other reports are shown on screen as a table. What you see is what ends up in the PDF.

### 6. Export to PDF

Click **Export PDF** at the bottom of the left column. The button exports the selected report with your current settings to PDF. The suggested file name is the project name followed by the kind of report, for the Gantt chart for example *Extension house-schedule.pdf*. The report part follows the interface language: a progress report gets `-progress.pdf` in English and `-voortgang.pdf` in Dutch. The project name stays the same; previously saved files are not renamed.

- In the desktop app, and in a browser that has a save dialog for files, you choose where the PDF goes. If you close that dialog without saving, nothing happens.
- In a browser without such a dialog, the browser puts the PDF in your downloads folder.

### 7. Print the PDF

Open the PDF in your PDF reader and print it there. If you print an A3 PDF on an A4 printer, your print dialog has to shrink the pages. So set the paper size first in step 4.

## The new Report tab (experimental)

If *New Report tab* is on under *Settings › Advanced › Experimental*, the Gantt chart opens in a new layout. You choose the other reports by their name in the *Report type* list at the top; they open the tab as described above. The Resource diagram is no longer there: in the new tab it is a layout in the *Tasks and grouping* step. A Resource diagram you chose before opens as the Gantt chart with that layout.

On the left is a sidebar with five steps, in the order of the paper: *Tasks and grouping*, *Columns*, *Bars and timeline*, *Page* and *Header and footer*. At the bottom are the name of the file and the *Export PDF* button. The button to the right of the list collapses the sidebar; collapsed, it shows another icon and expands it again. One step is open. A closed step briefly shows what you chose. An orange dot at the number means that the step differs from the default. A message appears directly below the choice that causes it; an open step with a message has a warning sign next to its title. On your first visit step 1 is open; after that the step you used last opens. The number of pages is shown above the paper; if the sheets also run side by side, it says how many across and down, for example *12 pages: 6 across, 2 down*.

- **Tasks and grouping: all tasks, the view or a layout.** In the *Tasks and grouping* step you choose which rows go on paper. *All tasks* gives the whole task tree. *As in the view* takes the filter, grouping, sorting and collapsed groups of your current Gantt chart, and also the columns of the table next to the Gantt. Those columns follow the table live; the *Columns* step shows them, but you change them in the table itself. The bar colours then follow your screen as well. Your own report columns and bar colours are kept and apply again as soon as you choose *All tasks* or a layout. Under *Layouts* are the same layouts as on the ribbon, with the same name and icon: the built-in *Resource diagram*, your own layouts and your saved filters. A layout applies to the report only; your Gantt chart does not change. The report follows the layout: if you change it later, the paper changes with it. If you delete it, the report shows all tasks again, with a message.
- **What a layout brings.** The filter, grouping and sorting set the rows. They follow the layout live. A part the layout does not have stays as with *All tasks*. The report takes over columns and bar options only when you click a button. The i icon next to the *Layouts* heading sums this up. If the layout has different columns or bar options from the report, a notice below the choice offers *Apply columns* and *Apply bar options*. Bar options are *Dependencies*, the baseline, the float, the status line and the bar colours. After such a click, *Undo* appears above the paper. It restores only that part; the layout stays chosen. If you then apply the other part as well, one click on *Undo* restores both. Another choice in *Tasks and grouping*, with the mouse or with the arrow keys, never changes your columns and bar options. A click on the choice that is already chosen does nothing. The time scale of a layout does not count: you choose the scale in *Page*. If the layout's filter uses a field that is not in this project, for example a deleted custom field, a notice appears below the choice. The filter stays as it is; change it in *Manage layouts*.
- **Per resource.** If the layout groups by resource, like the *Resource diagram*, each resource gets its own band, also when two resources have the same name. A task with two resources appears under both bands. Under *Per resource* you choose *Each resource on a new page*, *Include tasks without a resource*, *Group by resource type*, *Show units/day and curve* and a period; below that it shows how many resources and assignments there are. The relation lines are then off, because a task appears under more than one band. Your own choice for *Dependencies* is kept and applies again with another choice. *Critical path* stays on: if the bars are coloured by critical path, the critical path is in the legend. You always choose the colour of the bars under *Bar colours*. With *Show units/day and curve* the columns *Units/d* and *Curve* follow the task name. They are not in the *Columns* step; a click on such a column on the paper takes you to this checkbox.
- **Click the paper.** Move over the sheet: the part under the mouse lights up and its name shows above the sheet, for example *Columns · Start*. When you click, the step of that part opens. A click on a column highlights that column in the *Columns* step.
- **Columns.** *Add column* opens the same window as in the table. Type part of the name or open a category, and click the column. The window closes and the column is at the bottom of the list. Drag a column by its dots, or use Alt with the up or down arrow. Under *Copy columns from* are two buttons. *Table tab* copies the columns of the Table tab, *Table next to the Gantt* those of the task table next to the Gantt. The two tables can have different columns. After such a click, *Undo* appears above the paper. The task name is required: its cross is off. With *Truncate* you set the width of the name column in millimetres on paper. If you chose *As in the view* under *Tasks and grouping*, the columns follow the table next to the Gantt and you cannot add, move or remove them here.
- **Whole page and Width.** At the top right you choose how the paper fits. *Whole page* (default) shows one whole sheet. *Width* fills the width of the window with one sheet. If the timeline runs over more pages side by side, *Whole row* puts the sheets of a row side by side. With − and + or Ctrl+scroll you zoom; the percentage is relative to the actual size of the paper. The 0 key brings back *Whole page*. *Whole page* goes to the top of the sheet that was most in view. After a change of paper or orientation, sheet 1 is at the top again.
- **Fit to width or Fixed scale.** In the *Page* step, *Fit to width* fits the whole timeline on the sheet width. *Fixed scale* gives every day a fixed width. The app shows it in millimetres per day, or per week, month or year when a day is narrower than 1 mm, with below it how much time fits on one page, for example *≈ 3 months per page*. Fixed scale starts at exactly the width per day you just had, also when it is less than a tenth of a millimetre. So the number of pages does not jump.
- **Reset to default and Undo.** In the header of the open step is the *Reset to default* button (an arrow that turns back). It resets only that step. In a small window the button is in the header of the window. Then *Undo* appears above the paper; a small window stays open. It restores exactly what *Reset to default* changed, in *Header and footer* also the company name. What you chose in another step after that stays.
- **Status line without status date.** If you choose a status line in *Bars and timeline* while the project has no status date, *Set to today* sets the status date to today. Or you pick a date. The app then recalculates at once, like F5.
- **Collapse the sidebar.** With the button next to the list or `Ctrl+\` you collapse the sidebar to a narrow rail with the steps. A click on a step or on the paper opens that step as a small window. Drag the window by its header if it covers something; it stays next to the rail and above the *Export PDF* button. At the bottom left there is then the *Export PDF* button. The paper stays clear of that button: if a sheet reaches its corner, the paper stops above it.
- **Export.** *Export PDF* is at the bottom of the sidebar. The paper on the screen is the same as the PDF: the same pages, and names and dates are truncated in the same place.
- **Schedule not recalculated.** If you change something in the schedule without F5 (and *Calculate automatically* is off), the paper still shows the last calculation. Above the paper it then says *The schedule has not been recalculated. The PDF recalculates it first.* So the PDF has the new dates and the paper does not yet. Click *Recalculate now* (it does the same as F5); after that the paper is the same as the PDF again.

## Pitfalls and what the app does

**Ctrl+P opens Report.** Ctrl+P takes you to the Report tab; it does not start an export. You export with *Export PDF*. There is no separate print command in the app: the way to paper goes through the PDF. If Ctrl+P does not work (see step 1), the print dialog of the browser opens in the browser, and that prints the screen, not the report.

**Company: overtyping is not kept.** The *Company:* field of the Gantt chart starts with the company from the project settings. What you type over it is not kept. You cannot type in *Author:* here. You change both with *Settings › Project › Project settings*, in the fields *Client/organization* and *Author*, and confirm with *Apply*.

**Bar colors: also applies to your screen.** The *Bar colors:* choice in the report is the same choice as *Bar colors* on the View tab. If you change it in the report, your Gantt on screen changes with it. The new Report tab (experimental) works differently: there the report has its own bar colours, and your Gantt on screen does not change. There the bars are coloured by critical path by default, also when your screen has another choice.

**The Variance without a baseline.** A baseline is a saved snapshot of your schedule that you measure against later; how to save one is in [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren). If you have no active baseline, instead of a comparison it says *No active baseline — save a baseline or set one active.*

**Status line without a status date.** If you choose a *Status line:* while the project has no status date, the report warns with *Set a status date first* and draws nothing. You set the status date at *Planning › Baselines & progress › Status date*.

**The schedule contains a loop.** If the schedule contains a loop, *Export PDF* makes no file and shows the error.

**Paper currently applies to all reports.** There is one choice for *Paper:* and *Orientation:*, shared by all reports. The Milestone overview and the Variance have no paper choice of their own: they use what you set in another report, A3 landscape by default. So choose the paper first in a report that offers it, for example the Gantt chart, and then go back.

**The settings apply to all projects.** Paper, font, font size, period and the other choices are remembered by the app on this device, for all your projects. They do not belong to the project file.

## See also

- [Choosing the reporting period](docs://howto-rapportageperiode-kiezen): a look-ahead or progress report over a certain stretch of time.
- [Creating and using a layout](docs://howto-layouts-gebruiken): first filter or group, then print with *Follow view*.
- [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren): the snapshot the Variance compares with.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do when Resource loading shows overloaded weeks.
- [Calculation options and conventions](docs://ref-rekenopties-en-conventies): why an activity is critical or near-critical.
- [Report types](docs://ref-rapporttypes): all report types and their options.
