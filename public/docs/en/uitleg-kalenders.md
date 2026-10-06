# Calendars and working days

How many work days does a task take, and on what date is it finished? That depends on the calendar the app counts in. In this article you read what a calendar is, how the app counts work days with it, and which calendar wins when more than one is involved. The worked example helps you follow the numbers.

## The concept

A schedule counts in **work days**, not calendar days. "Five days of bricklaying" means five days on which work happens. A weekend or a public holiday does not count, so such a task spans more than five days in the diary.

Which days are work days is recorded in a **calendar**. A calendar fixes three things:

- The **work week**: the weekdays on which work happens. By default that is Monday to Friday.
- The **working times**: start, end and break. They give the **net hours per day**. By default that is 07:00 to 16:00 with an hour's break, so 8 hours.
- The **holidays**: single days or whole periods on which no work happens, such as King's Day, Christmas or the construction holiday.

A project has one library of calendars. One of them is the **project calendar**. It applies to every task that has no calendar of its own. You give another calendar to an individual task, for example a six-day work week for a subcontractor who also works on Saturdays. A resource can have its own calendar too, but that does something different (see below).

## How the app calculates

This article describes the standard calculation: the *Open Planner Studio* calculation profile, which a new project calculates with.

### Counting work days

The first work day of a task counts as day 1. A task of 5 days therefore finishes on the fifth work day. If the start falls on a non-working day, the task begins on the next work day. A holiday or construction holiday in the middle of a task does not count: the task simply runs across it and gets longer in the diary.

The hours per day play no part in the dates of a task in days. Only the work week and the holidays count. The working times only come into play for a task in hours; that is covered in [Days and hours](docs://uitleg-dagen-en-uren).

### Which calendar wins

The app picks one calendar per task:

1. If the task has a calendar of its own, the app calculates that task entirely in that calendar: duration, finish date and float.
2. If it has none, the project calendar applies. If a task points to a calendar that no longer exists, it falls back on the project calendar too.

A summary task (a phase) has no work of its own and so no calendar of its own. Its duration follows from the dates of its tasks, and the app counts it on the project calendar.

The calendar of a **resource** plays no part in the dates. In a schedule you build yourself in the app it only determines when the resource is available: in the histogram, for overallocation and when leveling.

### Tasks on different calendars

When two tasks with different calendars are linked, this applies:

- With a Finish-Start relation the successor begins on the first work day after the finish of the predecessor, counted in the calendar of the **successor**. If a task finishes on a Friday, a successor with a six-day work week starts on the Saturday.
- A **lag** counts in the calendar of the **predecessor** by default. You can change that under *Settings › Project › Project info*, in the block *Calculation profile and options*, under *Calculation options of this project*, with the choice *Lag calendar*: *Predecessor* (default), *Successor*, *24-hour* or *Project calendar*.
- The **total float** counts in work days of the calendar of the task itself. In this profile the **free float** counts in the calendar of the successor.

What a lag is exactly is covered in [Adding relations](docs://howto-relaties-leggen); what float is, in [Critical path and float](docs://uitleg-kritiek-pad).

### In the Gantt

The grey background in the Gantt always shows the non-working days of the **project calendar**. A task on a calendar of its own can therefore run across a grey day, such as a six-day task across the Saturday. A block of holidays three days wide or more gets its name shown, for example *Bouwvak (Noord)*. That does not happen when *Show only working days* is on. If you do not want to see the grey days at all, turn on *Show only working days* under *Settings › Project › Settings*, tab *Appearance*, heading *Timeline axis*.

## Worked example: the building schedule

The example uses the standard calendar *Bouwkalender NL*: Monday to Friday, with the Dutch public holidays. All tasks last a whole number of days. In the tutorial on calendars (tutorial 3) you build such a calendar yourself.

### Weekend, holiday and construction holiday

*Brickwork* lasts 5 work days and starts on Thursday 13 May 2027. Thursday 13 and Friday 14 May are day 1 and 2. The weekend and Whit Monday, 17 May, do not count. Tuesday 18, Wednesday 19 and Thursday 20 May are day 3, 4 and 5. The task finishes on **Thursday 20 May**: eight calendar days for five work days.

A construction holiday makes the difference bigger. Take *Bouwvak (Noord)*, from 26 July to 13 August 2027 inclusive, and the same task of 5 work days from Friday 23 July. Friday 23 July is day 1. After that the calendar stands still for three weeks. Monday 16 to Thursday 19 August are day 2 to 5. The finish is **Thursday 19 August**, 28 calendar days after the start. Without the construction holiday it would have been Thursday 29 July.

### A task on Saturday

Three tasks follow each other, all with a Finish-Start relation without lag: *Groundwork* (4 days), *Pour foundation* (3 days) and *Brickwork* (5 days). The project starts on Monday 24 May 2027.

If all three are on the project calendar, *Groundwork* runs from Monday 24 to Thursday 27 May. *Pour foundation* runs from Friday 28 May to Tuesday 1 June (Friday, Monday, Tuesday). *Brickwork* runs from Wednesday 2 June to Tuesday 8 June. The project finishes on **Tuesday 8 June**.

Give *Pour foundation* the calendar *Six-day week* (Monday to Saturday) and the Saturday counts. The task runs from Friday 28 May to **Monday 31 May** (Friday, Saturday, Monday). *Brickwork* stays on the project calendar, starts on Tuesday 1 June and finishes on **Monday 7 June**. The whole project is a day shorter, because one task works on Saturday.

### A lag across two calendars

*Pour floor* (six-day week, 4 days) starts on Monday 31 May and finishes on Thursday 3 June. *Pointing* (project calendar, 3 days) follows with a lag of 2 work days. Without the lag *Pointing* would start on Friday 4 June.

- By default the lag counts in the calendar of the predecessor, the six-day week. From Friday 4 June, Saturday 5 June is the first work day and Monday 7 June the second. *Pointing* starts on **Monday 7 June** and finishes on Wednesday 9 June.
- If you set *Lag calendar* to *Successor*, the project calendar counts. Saturday then does not count: Monday 7 June is the first work day and Tuesday 8 June the second. *Pointing* starts on **Tuesday 8 June** and finishes on Thursday 10 June.

### Float in its own calendar

*Brickwork* (5 days, project calendar) and *Crane hire* (3 days, six-day week) both start on Monday 24 May. Both are predecessors of *Fit window frames* (2 days, project calendar).

*Brickwork* finishes on Friday 28 May, so *Fit window frames* starts on Monday 31 May. *Crane hire* is already finished on Wednesday 26 May. The total float of *Crane hire* counts in its own calendar: Thursday 27, Friday 28 and Saturday 29 May, so **3 work days**. If *Crane hire* were on the project calendar, it would have been 2 work days. The free float is 2 work days (Thursday and Friday), because the app counts it in the calendar of the successor.

### The calendar of a resource

In another example project the resource *Bricklaying crew* has the calendar *Crew Mon–Thu* (Monday to Thursday). It is assigned for 1 unit per day to *Brickwork* (5 days, project calendar, from Monday 31 May to Friday 4 June).

The dates of *Brickwork* do not change. But Friday 4 June is red in the histogram, with the message *Does not work this day per calendar "Crew Mon–Thu"*, and the ribbon reports one resource under *Overallocation*. Leveling does not solve this. Shifting does not help, because five work days in a row always contain a Friday. In the *Level resources* window the task is therefore listed under *Remaining conflicts*, with the reason *The resource does not work on all days this task needs — shifting cannot resolve this.*

## Consequences and misunderstandings

**"The calendar of the resource shifts my tasks."** No. A resource calendar changes no date at all; it only makes overallocation visible. If you want the task itself to run on other days, give the task a calendar of its own.

**"If I switch the project calendar, everything shifts."** Only the tasks without a calendar of their own move along. A task to which you yourself gave a calendar from the list keeps it, even if it happens to be the old project calendar. If you delete a calendar, the tasks and resources that used it fall back on the project calendar.

**"The holidays are in there, aren't they?"** Holidays only exist for the years for which they were created. A day outside those years is simply a work day. In the calendar dialog the app says so with *Holidays cover 2025–2028; project runs to 2030. Regenerate?*

**"More hours per day make my task shorter."** Not for a task in days: it counts whole work days, whether the day has 6 or 8 hours. Only for a task with resources and the work rule *Fixed work* or *Fixed units* does the duration change with it.

**A calendar without work days** cannot be calculated by the app. The calculation reports *The calendar has no working days set*.

## See also

- [Days and hours](docs://uitleg-dagen-en-uren): how the app counts working hours and what happens when day tasks and hour tasks meet.
- [Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen): the steps to make a calendar of your own and give it to tasks.
- [Generating holidays and the construction holiday](docs://howto-feestdagen-genereren): filling in the holidays of a country and the construction holiday.
- [Setting up a resource calendar](docs://howto-resourcekalender-instellen): recording the availability of a resource.
- [Calendar windows](docs://ref-kalenders): all fields of the calendar windows.
