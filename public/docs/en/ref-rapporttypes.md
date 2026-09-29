# Report types

Every report on the *Report* tab, with the options that belong to it: what they do, the starting value, what changes in the report and where you find them. How to make a report and save it as a PDF is in [Making and printing a report](docs://howto-rapport-maken-en-afdrukken).

## How the report window works

Open the *Report* tab (or press Ctrl+P). On the left is the *Report* column with the drop-down *Report type*, the block *Summary* with counts, the block *Settings* or *Report options* and at the bottom the button *Export PDF*. On the right is the preview. What you see in the preview goes into the PDF.

**Report type** — which report you see. Choose from eleven reports. Default: *Gantt chart*. Where: *Report*, at the top of the *Report* column.

**Export PDF** — makes the PDF. Effect: the result is only a PDF; the app does not send anything to a printer. If the schedule is out of date, the app calculates first. If the calculation gives an error, for example because of a loop in the relations, the button makes no file and shows the error. Where: *Report*, at the bottom of the *Report* column.

**Remembered.** The app keeps all report options on this device, for all your projects. They do not belong to the project file. Only the *Company:* field of the Gantt chart is not kept.

**Current schedule.** The reports use the last calculation. If the schedule has changed since then, the table reports show at the top *The schedule changed since the last calculation — press Calculate (F5) for current values.* If nothing has ever been calculated it says *Not calculated yet — press Calculate (F5) for dates and float.* If the project is in the view *Dates as recorded*, the reports show the dates from the source file and a strip says so.

**Abbreviations.** *wd* is work days. *TF* is total float, *FF* free float.

## Paper and orientation

**Paper:** — the paper size of the PDF. Choose from A4, A3, A2 and A1. Default: A3. Effect: the pages are laid out for that size. There is one choice for all reports: what you choose for one report also holds for the others. On portrait A4 a wide table gets small, because the table is scaled to the page width. Where: *Settings* (Gantt chart and Resource diagram) or *Report options* (the seven table reports). The Milestone overview and the Variance show no choices.

**Orientation:** — landscape or portrait. Choose from *Landscape* and *Portrait*. Default: *Landscape*. Effect: like *Paper:*. Where: the same place as *Paper:*.

## Gantt chart

The schedule as a bar chart, with a table on the left and a timeline on the right, over several pages if needed. The preview shows the paper with page header, table, timeline and legend. The block *Summary* counts *Tasks:*, *Leaf tasks:*, *Critical:* and *Relations:*. All options are under *Settings*.

**Company:** — the company in the page header. Default: the company from the project information. Effect: only the header of the report; what you type over here is not kept. Change the company in *Settings › Project › Project info*, in the field *Client/organization*, and confirm with *Apply*.

**Author:** — the author in the page header. Read-only: the app takes it from the project information.

**Font size:** — size of text and table in the report. Choose from 90%, 100%, 110% and 125%. Default: 100%. Effect: with a larger font, text, rows and table grow and the timeline loses width. Independent of *Text size* in the settings.

**Bar colors:** — what the colour of a bar depends on. Choose from *Critical path*, *Per task — automatic* and *By category*, with a drop-down *Category field* for *By category*. Default: *Critical path*. Effect: this is the same choice as *Bar colors* on the *View* tab: if you change it here, the Gantt on screen changes with it. If the chosen field does not exist in this project, it says *This field does not exist in this project. Task type is used temporarily.*

**Status line:** — a line at the status date. Choose from *None*, *Status date line* and *Progress line*. Default: *None*. Effect: *Status date line* draws a line at the status date; *Progress line* draws the zigzag line that bulges to the progress of each task. If the project has no status date, it says *Set a status date first* and the report draws nothing.

**Follow view (filter, grouping, sort)** — only for the Gantt chart. Default: off. Effect: off puts the whole task tree on paper. On draws exactly the rows of the screen: with your filter, grouping, sorting and collapsed phases.

**Auto-fit to paper** — scale the timeline to the page width. Default: on. Effect: on scales the timeline to the width of the page; the number of pages follows from the height. Off uses a fixed scale (*Zoom:*) and also tiles across the width, which quickly gives many pages.

**Zoom:** — the fixed scale of the timeline. Only visible when *Auto-fit to paper* is off. Slider from 1 to 40. Default: 22. Effect: a larger value makes the timeline wider, so more pages across.

**Timeline over:** — spreads the timeline over more page widths. Choice from 1 through 8 pages. Default: 1 page. Effect: only with *Auto-fit to paper*; otherwise the choice is disabled and it says *Only with auto-fit*. Handy for a long schedule that you want to print in readable size.

**Repeat header on each page** — Default: on. Effect: on puts the page header on every page; off only on the first.

**Repeat footer on each page** — Default: on. Effect: on puts the footer (project name, print date and legend) on every page; off only on the last. A handout without a legend is unreadable, hence on.

**Task names on bars** — Default: on. Effect: the name of the task on the bar, where there is room.

**Show completion** — Default: on. Effect: a darker part in the bar up to the progress of the task, and the column *Compl.* in the table.

**Truncate task names** — Default: on. Effect: on cuts names in the table at the width of *Name column:*. Off lets the column grow with the longest name; it then says *The name column adapts to the longest task name*.

**Name column:** — the width of the name column. Only visible when *Truncate task names* is on. Slider from 60 to 400. Default: 130.

**Show baseline overlay** — the active baseline next to the bars. Default: off. Effect: a thin bar in the baseline colour under the task bar, only for tasks that are in the baseline.

**Critical path** — Default: on. Effect: only controls the red relation lines between two critical tasks and the legend line. The bars themselves follow *Bar colors:*, regardless of this checkbox.

**Show float** — Default: on. Effect: the float as a band behind non-critical bars.

**Dependencies** — the relation lines. Default: on. Effect: draws arrows between the bars.

**Show only working days** — compresses the timeline axis in this report. Default: off. Effect: weekends and holidays are skipped, and week bands then replace the weekend shading. Independent of the same setting for the Gantt on screen.

**Weekends** — Default: on. Effect: shades weekends and holidays in the timeline, as long as the scale makes days distinguishable. On the compressed axis (*Show only working days*) this checkbox has no effect.

**Legend** — Default: on. Effect: the legend in the footer.

**Preview quality** — how sharp the preview is. Choose from *Standard*, *High* and *Maximum*. Default: *High*. Effect: only the sharpness of the preview on screen; the PDF does not change. Where: *Report*, above the preview.

## Resource diagram

The same bars as the Gantt chart, grouped per resource: who does what and when. The block *Summary* counts *Resources:*, *Assignments:* and *Without resource:* (with a period also *Outside the period:*). The diagram shares all options of the Gantt chart, except *Follow view (filter, grouping, sort)*, *Critical path* and *Dependencies*: the rows do not come from the screen, a task can appear under several resources, and the relations are not drawn there. The checkbox *Critical path* is hidden and on. This comes with the options of the Gantt chart under *Settings*, with these four checkboxes and the period:

**Each resource on a new page** — Default: off. Effect: each resource starts on a new page, so you can hand out a sheet per crew or employee. Off gives one continuous document.

**Include tasks without a resource** — Default: off. Effect: the tasks without a resource come as the last band in the diagram, to see what nobody has yet.

**Group by resource type** — Default: off. Effect: a layer on top: first a band per resource type (labor, crew, subcontractor, equipment, material), within it per resource.

**Show units/day and curve** — Default: on. Effect: two columns after the task name with the units per day and the distribution curve of the resource of that band. If there is too little room for the timeline, the report leaves the columns out and says *The Units/d and Curve columns were left out: …*; more room comes from a larger paper size or landscape, a smaller font size or a narrower table.

**Reporting period:** — only the tasks that touch the period. Default: *Project duration*. Effect: the time axis runs exactly over the period. If there is nothing in the period it says *No tasks in the reporting period — choose another period or Whole project.* See *Reporting period* below.

## Milestone overview

All milestones of the project in a table. No options of its own. The block *Summary* counts *Milestones*, *Mandatory* and *Late*. The columns are *WBS*, *Name*, *Kind* (*Automatic*, *Start* or *Finish*), *Date*, *Constraint/deadline*, *Float*, *Mandatory* and *Status*. The status is *Late* if the constraint is violated, the deadline is missed or the total float is negative; otherwise *Critical* if the milestone is critical according to the critical definition of the project; otherwise *On schedule*. Without milestones it says *No milestones in this project.* The PDF uses the paper and orientation you last chose for another report.

## Variance

The current schedule next to the active baseline, for leaf tasks. No options of its own. The block *Summary* counts *Tasks*, *Later* and *Earlier* and shows *Project end: +3 work days* (the difference in work days between the baseline finish and the current finish). The columns are *WBS*, *Name*, *Baseline start*, *Baseline finish*, *Current start*, *Current finish*, *Δ start (wd)*, *Δ finish (wd)* and *Status*. The status follows the finish: *Later* if the finish is later than in the baseline, *Earlier* if it is earlier, otherwise *On schedule*. *New* is a task that is not in the baseline, *Dropped* a task that is in the baseline but no longer in the schedule. Without an active baseline it says *No active baseline — save a baseline or set one active.* The PDF uses the paper and orientation you last chose for another report.

## Look-ahead

What runs or starts in the period: the list for the weekly meeting. Options under *Report options*.

**Reporting period:** — the window of the report. Default: *Next month*. Effect: the report contains the uncompleted activities that touch the period, even if they span the whole period, plus overdue activities from before the reference day, as long as the end of the period is not before the reference day.

**Near-critical ≤ (wd):** — the threshold for *Near-critical*. Number from 0 to 60. Default: 5. Effect: a task with more than 0 and at most that many work days of total float counts as near-critical. At 0 only what the project's calculation option *Mark near-critical* marks counts.

The block *Summary* counts *Activities*, *Overdue*, *In progress*, *Should have started*, *Starting*, *Critical* and *Near-critical*. The status per row, always relative to the reference day: *Overdue* (not completed and the finish is before the reference day), *Should have started* (not started while the start was before the reference day), *In progress*, *Starting* (not yet started, starts in the window). The columns are *WBS*, *Name*, *Start*, *Finish*, *Rem. (wd)*, *Compl.*, *TF (wd)*, *Critical*, *Resources* and *Status*.

## Critical & near-critical

The activities that determine the project end and those that are nearly there. Option under *Report options*.

**Near-critical ≤ (wd):** — Default: 5. Number from 0 to 60. Effect and meaning as with the Look-ahead. The subtitle states the chosen threshold.

The report contains the uncompleted tasks that are critical (according to the solver and the critical definition of the project) or near-critical, sorted by float path, then by total float, then by start. The block *Summary* counts *Critical*, *Near-critical*, *Critical chains* and *Leaf tasks*. The columns are *WBS*, *Name*, *Start*, *Finish*, *Rem. (wd)*, *TF (wd)*, *FF (wd)*, *Path* and *Status*. The column *Path* shows the float path if the calculation option *Multiple float paths* is on, otherwise a dash.

## Progress report

Where the project stands on the status date. Options under *Report options*.

**Reporting period:** — Default: *Last month*. Effect: *Completed in the past period* counts within the period. *Starting in the next period* looks ahead from the status date, up to *Look ahead until*; with a *Last* period as far ahead as the period looks back.

**Near-critical ≤ (wd):** — Default: 5. As with the Look-ahead.

The block *Summary* shows *Status date*, *Period*, *Look ahead until*, *Baseline finish*, *Forecast finish*, *Δ finish (wd)*, *Planned* (with *(baseline)* or *(current schedule)*), *Actual*, and the counts *Complete*, *In progress*, *Not started*, *Overdue* and *Critical*. Planned and actual are weighted by the duration of the tasks. Planned measures against the baseline if there is an active baseline, otherwise against the current schedule. The sections are *Completed in the past period*, *In progress*, *Starting in the next period*, *Overdue* and *Open critical activities*; a task can be in more than one section.

## Schedule health

A check of the schedule itself for errors and unusual values, in the spirit of the DCMA 14-point check. Options under *Report options*.

**High float > (wd):** — Number from 1 to 365. Default: 44. Effect: an uncompleted task with more total float than this falls under *High float*.

**Long duration > (wd):** — Number from 1 to 365. Default: 44. Effect: an uncompleted task, not a milestone, with a longer duration falls under *Long duration*.

**Lag > (wd):** — Number from 0 to 365. Default: 10. Effect: a relation with more lag falls under *Long lag*. A negative lag (lead) is always reported.

**Near-critical ≤ (wd):** — Number from 0 to 60. Default: 5. Effect: determines the check *Near-critical*.

The checks are in this order, with their severity. Error: *Negative float*, *Missed deadline*, *Violated constraint* and *Inconsistent progress* (actual start or finish after the status date, 100% without an actual finish, actual finish but not 100%, progress without an actual start). Warning: *No predecessor (open start)* and *No successor (open end)* (not milestones), *Long duration*, *Lead (negative lag)*, *Hard constraint* (a mandatory constraint or an MSO, MFO, SNLT or FNLT) and *Out-of-sequence progress*. Info: *Near-critical*, *High float* and *Long lag*. The report looks at leaf tasks that are not hammocks only. The block *Summary* counts *Errors*, *Warnings*, *Information*, *Leaf tasks* and *Relations*; below it are a section *Overview* (per check the severity and the count) and a section *Findings* (every task or relation). Without a calculation, the checks that need float are missing.

## Resource loading

Per resource per week or month what is required against what is available. Options under *Report options*.

**Reporting period:** — Default: *Project duration*. Effect: every week or month that touches the period is included in full. That way a row shows the same number as the histogram.

**Aggregation:** — Choose from *Weekly* and *Monthly*. Default: *Weekly*. Effect: a row per calendar week (column *Week of*, with the Monday) or per calendar month (column *Month*).

**Overloaded periods only** — Default: off. Effect: on only shows the weeks or months with at least one overloaded day.

The columns are *Resource*, *Type*, *Week of* or *Month*, *Required*, *Available*, *Variance* (available minus required; negative is a shortage), *Peak/day* and *Overloaded*. *Required* is the sum of unit-days. Only weeks or months with demand are in it. The block *Summary* counts *Resources*, *Weeks* or *Months*, *Overloaded weeks* or *Overloaded months* and *Overloaded resources*.

## Resource assignments

Per resource the activities it is attached to: what is this crew or crane doing? Options under *Report options*.

**Reporting period:** — Default: *Project duration*. Effect: with a period only assignments of activities that touch the period are included, plus overdue work from before the reference day. *Project duration* does not filter by date.

**Include completed tasks** — Default: off. Effect: on also includes the assignments of completed activities.

The rows are per resource, and within a resource by start. The block *Summary* counts *Resources*, *Assignments* and *Tasks without a resource*. The columns include the resource, the task, start and finish, *Rem. (wd)*, *Units/day*, *Compl.*, *Critical* and *Status*.

## WBS summary

The schedule rolled up per WBS element: the management overview. Options under *Report options*.

**Level:** — up to which level the WBS is shown. Choose from *Full WBS* and levels 1 through 8. Default: level 2. Effect: the subtitle says *Up to level 2*.

**Show activities** — Default: off. Effect: on also shows the leaf tasks themselves under each element.

The columns include *WBS*, *Name*, *Start*, *Finish*, *Baseline start*, *Baseline finish*, *Duration (wd)*, *Compl.*, *Δ finish (wd)*, *Min. TF*, *Act.* (number of activities), *Crit.*, *Active* and *Done*. Start and finish of a summary task come from the last calculation. Progress is duration-weighted over the leaf tasks. *Min. TF* and the counts concern the leaf tasks below. The block *Summary* counts *WBS elements* and *Activities*.

## Reporting period

Four table reports and the Resource diagram work with a *Reporting period:*: *Look-ahead*, *Progress report*, *Resource loading*, *Resource assignments* and the *Resource diagram*. Each report remembers its own period. Below the drop-down are *From* and *To*, with the dates the choice produces.

**Reference day.** A period with *Next* or *Last* counts from the status date of the project, or from today if there is no status date. Then the table reports say *No status date set — the report uses today (…).* If you move the status date, the window moves along. Both days count.

**Next week, Next 2 weeks, Next 4 weeks, Next 6 weeks, Next 8 weeks, Next 12 weeks** — from the reference day, 7 days per week long. With status date Thursday 20 May, *Next week* runs from 20 through 26 May and *Next 4 weeks* from 20 May through 16 June.

**Last week, Last 2 weeks, Last 4 weeks, Last 6 weeks, Last 8 weeks, Last 12 weeks** — the same six, but counted back: 7 days per week long, through the reference day. *Last 2 weeks* runs from 7 through 20 May at 20 May.

**Next month, Last month** — a calendar month forward or back, up to a day before the same date in the other month. *Next month* runs through 19 June at 20 May; *Last month* runs from 21 April through 20 May.

**Project duration** — from the first start to the last finish of the schedule.

**Custom** — your own period. Effect: *From* and *To* become two date fields. They start with the dates of the choice you just had. The end date may not be before the start date (*The end date is before the start date.*) and both fields must be filled in (*Fill in both dates.*). If the input is not right, the report stays on the last valid period.

## See also

- [Making and printing a report](docs://howto-rapport-maken-en-afdrukken): the whole route from report type to PDF.
- [Choosing the reporting period](docs://howto-rapportageperiode-kiezen): steps and examples.
- [Critical path and float](docs://uitleg-kritiek-pad): what critical and near-critical mean.
- [Progress, status date and baseline](docs://uitleg-voortgang): the status date and the baseline the reports work with.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do with the overloaded weeks from Resource loading.
- [Import and export formats](docs://ref-import-exportformaten): PDF next to the other formats.
