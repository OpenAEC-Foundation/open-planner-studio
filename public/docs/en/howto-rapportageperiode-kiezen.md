# Choosing the reporting period

Goal: decide which stretch of time a report covers, for example the coming four weeks or the month of June.

## When you need this

The weekly meeting wants to know what happens in the coming four weeks. The monthly report covers June. Without a period you get the whole schedule on paper. Five reports therefore work with a *Reporting period:*: *Look-ahead*, *Progress report*, *Resource loading*, *Resource assignments* and the *Resource diagram*. The other reports have no period.

The period is not tied to a calendar month, but to a **reference day**: the status date of your project (the day on which you measure progress, see [Progress, status date and baseline](docs://uitleg-voortgang)), or today if the project has no status date. *Next 4 weeks* counts from that day. If you move the status date, the window moves with it.

## Steps

### 1. Set the status date

If you work with a relative choice, such as *Next 4 weeks* or *Last month*, set the status date first. Choose *Planning › Baselines & progress* and fill in the *Status date* field. With the cross next to it (*Clear status date*) you remove the date again. If you work with a fixed period (step 4), you do not need this.

### 2. Choose a report with a period

Open the *Report* tab and choose one of the five reports at *Report type*. The *Reporting period:* list is under *Report options*. For the Resource diagram it is under *Settings*, below the four checkboxes of that report.

Each report remembers its own period. These are the initial values:

- *Look-ahead*: *Next month*.
- *Progress report*: *Last month*.
- *Resource loading*, *Resource assignments* and *Resource diagram*: *Project duration*.

### 3. Choose a period from the list

The list has *Next week*, *Next 2 weeks*, *Next 4 weeks*, *Next 6 weeks*, *Next 8 weeks*, *Next 12 weeks*, *Next month*, the same seven with *Last*, *Project duration* and *Custom*. Below the list are *From* and *To* with the dates the choice produces. You can only read those here.

Both days count. If the status date is Thursday 20 May, *Next week* runs from 20 to 26 May inclusive and *Next 4 weeks* from 20 May to 16 June inclusive (28 days). *Next month* runs to one day before the same date in the next month, here up to and including 19 June. *Last 2 weeks* runs from 7 to 20 May inclusive.

*Project duration* takes the schedule from the first start to the last finish.

### 4. Or choose Custom

With *Custom*, *From* and *To* become two date fields. They start with the dates of the choice you just had. Fill in both, for example 1 and 14 June. If the input is not right, the report stays on the last valid period and it says in red:

- *The end date is before the start date.* if *To* is earlier than *From*.
- *Fill in both dates.* if one of the two is empty.

### 5. Read the period in the report

For the Look-ahead, Resource loading and Resource assignments the period is under the title, for example *Period: 20-05-2027 – 19-06-2027*. If you choose *Project duration*, *Project duration* is added behind the dates. The Progress report shows the period in the summary at *Period*. The Resource diagram lets its time axis run exactly over the period.

### What the period does per report

The period does not work the same in every report.

- **Look-ahead** takes the unfinished activities that touch the period, also if they span the whole period. Overdue activities from before the reference day are included as well, as long as the end of the period is not before the reference day. A custom period entirely in the past is a look back: it shows only what was running then and is not finished yet, without today's backlog.
- **Progress report** uses the period for *Completed in the past period*. The section *Starting in the next period* looks ahead from the status date, up to the date at *Look ahead until* in the summary. If you choose a *Last* period, the report looks ahead as far as it looks back: with *Last 2 weeks* and status date 20 May it says *Look ahead until* 3 June. A custom period or *Project duration* that lies entirely in the past is not mirrored.
- **Resource loading** shows every week or month that touches the period, in full. If your period runs from Wednesday to Wednesday you therefore see whole weeks, so a row always shows the same number as the histogram.
- **Resource assignments** shows the assignments of activities that touch the period. With *Project duration* there is no filtering on date.
- **Resource diagram** shows only the tasks that touch the period. In the summary, *Outside the period:* counts how many tasks were left out.

## Pitfalls and what the app does

**There is no status date.** The app then uses today. For the four table reports with a period (*Look-ahead*, *Progress report*, *Resource loading* and *Resource assignments*) it says at the top, with a relative period, *No status date set — the report uses today (29-09-2026).*, with your own date of today. The Resource diagram does not report this. So look at *From* and *To*: they are then around today, not around your schedule.

**The period lies outside your schedule.** Then the report is empty. The Resource diagram says so with *No tasks in the reporting period — choose another period or Whole project.* (in the list that choice is called *Project duration*). In the other reports you see zero activities or no rows.

**The dates are in your own notation.** *From* and *To* follow the date notation from your settings, except in the date fields of *Custom*: those show the notation of your browser.

**The period moves along.** A relative choice such as *Next month* is determined anew each time: if the status date changes, or without a status date it is a day later, the period moves along at once. If you want a fixed period, choose *Custom*.

**The choice applies to all your projects.** A custom period also applies to all your projects on this device, not only to the open project.

## See also

- [Making and printing a report](docs://howto-rapport-maken-en-afdrukken): the whole route from report type to PDF.
- [Progress, status date and baseline](docs://uitleg-voortgang): what the status date is and why the app calculates with it.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do with the overloaded weeks from Resource loading.
