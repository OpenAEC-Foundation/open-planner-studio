# Progress, status date and baseline

A schedule is a forecast. Once the work is under way, you want to know what is finished, what is still to do and what that means for the handover. This article explains how the app processes progress: what the status date does, how the app calculates the remaining work, why a task that has already started sometimes still waits for its predecessor, and how you compare the current state with the original agreement. A worked example shows the numbers.

## The concept

**Progress** is what has actually happened. For each task the app records three things: a percentage, an **actual start** and an **actual finish**. What the schedule predicted stays alongside it; the actual is what really happened.

The **status date** is the day on which you take stock. Everything that happened before that day is a fact. Everything that still has to happen, the app plans from the start of that day. An actual date may fall on the status date, but never after it.

The **remaining work** is what is left to do on a task. A task of 4 work days that is 25% done has 3 work days of remaining work.

A **baseline** is a snapshot of the schedule at a certain moment, usually the moment the agreement was approved. Later you lay the actual schedule next to it and see how far the execution deviates.

## How the app calculates

The example below uses the calculation profile *Open Planner Studio*, which a new project calculates with. Further on you can read what differs in the Primavera P6 and Microsoft Project profiles.

The app does not recalculate by itself. After every change to progress or the status date the status bar shows *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example through *Planning › Schedule › Calculate*. If *Calculate automatically* is on (under *Settings › Project › Settings*, tab *Planning*, heading *Calculation*), the app does this itself.

### The status date

The status date does three things.

First, the app refuses an actual date after the status date. A date on the status date itself is fine.

Second, work that has not started cannot lie in the past. If such a task is planned before the status date, the app moves it to the status date. That also applies to the tasks after it, which move along through their relations. You can see the effect in the example below. In the Microsoft Project profile the app does not do this.

Third, the remaining work of a task that is already running starts on the status date itself. The app treats the status date as the start of that day. If you take stock on Friday after working hours, you therefore set the status date to Monday. If you set it to Friday, the app still plans the remaining work on that Friday.

If you have no status date yet and you enter progress, the app sets the status date to today and tells you. Without a status date the app calculates a running task forward with its remaining duration but backward with its full duration; the float then comes out negative and the task looks critical without reason.

### Percentage, actual dates and remaining duration

The fields depend on each other. If you fill in one, the app fills in the others.

- A percentage above 0 means the task has started. If you give no actual start, the app takes the planned start. If the task is planned to start after the status date, the app first asks when it actually started.
- A percentage of 100 means completed. If you give no actual finish, it becomes the status date, even if the work was in fact finished earlier.
- An actual finish makes the task 100%. If you set a completed task back below 100%, the actual finish is dropped. If you clear the actual finish, the percentage goes back to 0 and the task stays *In progress* until you also clear the actual start.
- The **remaining duration** is the duration times what is still to do, rounded to whole work days. For a task of 2 work days, 0% and 25% both give 2 work days of remaining work, and 50% and 75% both give 1. At 90% the app rounds to 0: the remaining work is then finished on the status date. A task in hours counts in whole minutes: a task of 5 hours at 40% has 3 hours of remaining work.
- A milestone has only one actual date.
- A phase (summary task) has no progress of its own. After calculating, its percentage follows from the tasks below it: the weighted average of their percentages, with the duration in work days as the weight. A milestone weighs 0.

If you change the duration of a task that is already running, the work done stays done. The percentage adjusts: a task of 5 work days at 60% that you set to 10 work days ends up at 30%. The app refuses a duration shorter than the work already done.

### Completed and running tasks

A completed task is fixed on its actual dates. It no longer moves, and with a status date it is never critical. Without a status date a completed task can still be critical.

A running task keeps its actual start. Only the remaining work moves. Where the remaining work starts depends on the progress mode.

### Retained Logic and Progress Override

What does the app do if a task has already started while its predecessor is still running? Such a relation is called **out-of-sequence**: the progress contradicts the order. Think of the painter who already starts in a room that has been plastered, while the plasterer is still busy elsewhere.

Two progress modes decide how the app calculates that:

- **Retained Logic** (the default): the relation stays in force. The remaining work of the successor follows the relation: with Finish-Start it only starts once the predecessor is finished, and never before the status date.
- **Progress Override**: reality wins. The remaining work of the successor starts on the status date, without waiting for the predecessor.

In this profile the difference lies only in the remaining work of tasks that have already started while their predecessor is not yet finished. Other tasks calculate the same in both modes. The app reports such a relation in both modes: in the status bar as *1 out-of-sequence relation(s)* and in the *Warnings* panel.

### Baselines and variance

When you save, the app records for every task without subtasks the early start, the early finish, the duration and the milestone kind. Phases are not in it. What you change afterwards does not touch the baseline. You can keep several baselines; exactly one is **active**. The Gantt, the Variance report and the Progress report use the active baseline.

The **variance** is the difference in work days between the baseline and the current schedule. A plus means later, a minus earlier. The app counts in the project calendar. The Variance report gives the variance of start and finish per task. The status follows only from the finish: *Later* for a plus, *Earlier* for a minus, otherwise *On schedule*. A task added after the baseline is called *New*; a task that no longer exists is *Dropped*.

Two remarks. The duration variance is in the task table (column *Duration variance*), not in the Variance report. It compares the planned duration of the task now with the one in the baseline. Progress does not change that planned duration: a task planned at two days that took three days therefore has a finish variance of +1 but a duration variance of 0. And if you save a baseline after progress has been entered, it records the state with those actual dates; the variance is then zero.

The Progress report puts the planned progress next to the actual progress. Both are weighted by work days. Planned is the part of each task that should have been finished on the status date according to the baseline; actual is the percentage that was entered.

### Where you see it

In the Gantt a dashed line marks the status date, with the date in the header. At every running task the line bulges out to the point in the bar that the percentage indicates. That is the **progress line**. If you turn the progress line off and leave the status date line on, a straight line remains; with both off, the line and the label disappear. The buttons *Baseline overlay*, *Progress line* and *Status date line* are under *View › Baselines & progress* and change nothing in the calculation. The baseline appears as a thin bar under each task bar. The task table has columns for progress and, per baseline, for the variance. On the *Report* tab you find the report types *Variance* and *Progress report*.

## Worked example: the extension after three weeks

The example is the practice project *House extension* from the tutorials, in the state after all relations have been added: without a construction holiday, resources or hours. In tutorial 6 you do this yourself in the practice project. That project has more in it by then, so the numbers there differ. Here you read why the numbers are what they are.

The extension starts on Monday 7 June 2027. On the calculated schedule the app saves a baseline named *Baseline*: handover Friday 6 August 2027, 45 work days.

### The state on Monday 28 June

The status date is Monday 28 June 2027. This is what has happened:

- *Start of construction*, *Set up site*, *Clear garden and paving* and *Set out the extension* are finished according to plan, from 7 to 10 June.
- *Excavate foundation trench* was planned at 2 work days (Friday 11 and Monday 14 June) and took 3: from 11 to 15 June.
- *Foundation formwork and reinforcement* runs from 16 to 18 June. *Reinforcement inspection* is on 18 June, *Pour foundation* on Monday 21 June.
- *Foundation brickwork* (2 work days) started on Friday 25 June and is at 50%.

After **Calculate** the app works it out like this:

- The remaining work of the foundation brickwork is 2 × (1 − 0.5) = 1 work day. It starts on the status date, so it finishes on Monday 28 June.
- *Lay hollow-core floor* follows on Tuesday 29 June. As a result *Build inner cavity leaf* starts on Wednesday 30 June instead of Tuesday 29 June. The handover comes on Monday 9 August: one work day later than the baseline. The one extra day of the excavation is therefore the delay of the whole project, because that task was on the critical path.
- The status bar reports *Critical path: 13 tasks, 46 work days*, against 21 tasks and 45 work days before the progress. The eight completed tasks that were on the critical path no longer count.
- The phase *Foundations* is at 77.8%. The tasks in it weigh 2 + 3 + 1 + 2 + 1 = 9 work days. Finished are 2 + 3 + 1 work days, plus half of 2: 7 in total. And 7 out of 9 is 77.8%. The milestone *Reinforcement inspection* weighs 0.

The Variance report puts this next to the baseline:

- *Excavate foundation trench*: start 0, finish +1 (baseline finish 14 June, now 15 June).
- *Foundation brickwork*: start +1 (24 June became 25 June), finish +1.
- *Build outer cavity leaf*: +1, +1. That task is still not critical: it had 2 work days of float and keeps them.
- *Handover*: +1. The project finish deviates by 1 work day.
- In total 19 tasks are on *Later* and 4 on *On schedule*; no task is on *Earlier*.

The Progress report shows *Planned* 28.3% and *Actual* 23.9%. The tasks weigh 46 work days together. According to the baseline 13 should have been finished: 4 work days in the preparation, 2 for the excavation, 3 for the reinforcement, 1 for the pour, 2 for the foundation brickwork and 1 for the hollow-core floor. Actually 11 are finished: 4 + 2 + 3 + 1, plus the half day of the foundation brickwork.

### What if you move the status date?

The same progress, a different status date. The remaining work of the foundation brickwork always starts on the status date, so the handover moves with it:

- Status date Friday 25 June: the remaining work falls on Friday 25 June, the handover stays Friday 6 August.
- Monday 28 June: handover Monday 9 August.
- Tuesday 29 June: handover Tuesday 10 August, 2 work days later than the baseline.

### What if you change the percentage?

The foundation brickwork has 2 work days. At 0% or 25% the remaining work is 2 work days: it finishes Tuesday 29 June and the handover becomes Tuesday 10 August. At 50% or 75% it is 1 work day: Monday 28 June, handover Monday 9 August. At 90% the remaining work is 0 and the task finishes on the status date.

### What if you set a status date without entering progress?

If you only set the status date to Monday 28 June and enter nothing, then according to the schedule nothing has happened yet. Work that has not started cannot lie in the past. The app therefore moves everything to 28 June: *Start of construction* is then on that day, and the handover comes on Friday 27 August, 15 work days after the baseline. So enter the progress that exists first.

## Worked example: plasterer and painter

Now an example for the progress mode. The same extension, a different state: it is Wednesday 21 July 2027. Everything up to and including *Install building services* is finished according to plan. *Plastering* (4 work days) started on Tuesday 20 July and is at 25%. *Painting* (3 work days) follows the plastering, but the painter has already started today and is at 33%.

Without progress the plastering was planned from Tuesday 20 to Friday 23 July, and the painting from Monday 26 to Wednesday 28 July. The status bar now reports *1 out-of-sequence relation(s)*: the painting has started while the plastering is not finished. In the *Warnings* panel it says: *Out of sequence: the successor's progress contradicts the relation*.

The plastering has 4 × (1 − 0.25) = 3 work days of remaining work: 21, 22 and 23 July. The painting has 3 × (1 − 0.33) = 2 work days of remaining work.

- With **Retained Logic** that remaining work can only start once the plastering is finished. That is Friday 23 July, so the painting starts Monday 26 July and finishes Tuesday 27 July. The bar runs from the actual start on 21 July to 27 July. The total float is 7 work days.
- With **Progress Override** the remaining work starts on the status date. The painting finishes Thursday 22 July, before the plastering is finished. The total float is 10 work days.

The handover stays Friday 6 August in both cases: the painting had float anyway.

### Other calculation profiles

In the Primavera P6 and Microsoft Project profiles the painting in this example finishes on the same dates (27 and 22 July). They differ on the following points. They are conventions of the profile; you find them under *Settings › Project › Project info*, in the block *Calculation profile and options*.

- In the Microsoft Project profile, work that has not started does not move to the status date (convention *Don't move unstarted tasks to the status date*). If in the example above you only set a status date and enter nothing, the handover in that profile stays Friday 6 August.
- In the Microsoft Project profile the remaining work also does not start earlier than the actual start plus the duration already elapsed (convention *Remaining work resumes after the elapsed duration*). That is an extra lower limit next to the status date: the later of the two counts. Take *Build inner cavity leaf* (5 work days), started on Tuesday 29 June and at 40% on Wednesday 30 June, the status date (two crews are bricklaying at the same time, so 40% is already done after one day). Everything before it is finished according to plan. Open Planner Studio and Primavera P6 let the task finish on Friday 2 July; Microsoft Project on Monday 5 July, because Tuesday 29 June plus 2 elapsed work days is Thursday 1 July, after the status date.
- Primavera P6 shows as the early start of a running task the start of the remaining work, not the actual start (in the inner-leaf example Wednesday 30 June).
- In the Primavera P6 profile, under Progress Override the relation to a successor that has already started also does not count for the predecessor: it no longer limits its late dates and its free float (convention *Progress Override ignores a started successor on the late side too*). In the plasterer and painter example you do not see that, because the plastering is critical anyway through the floor screed: its late dates and free float are the same under Retained Logic and Progress Override.
- When you open an .xer file, the app takes the progress mode from the file. Actual Dates, the third P6 mode, is not known to the app; such a file calculates as Retained Logic.

## Consequences and misunderstandings

**"I'll just move the status date on."** If you move it, the remaining work of running tasks starts on the new date, and work that has not started yet can never lie before that date. So move the status date only together with an update of the progress.

**"Entering 100% records the real finish."** Only if you also enter the actual finish. If you set a task to 100% without an actual finish, it becomes the status date. If it was in fact finished earlier, fill in the actual finish.

**"0% means not started."** If a task has an actual start, it counts as started, even at 0%. The remaining work is then the full duration and starts on the status date. Clear the actual start to make it count as not started again.

**"Progress Override solves the warning."** The out-of-sequence message stays. The mode only decides how the app calculates. If the relation is no longer right, change the relation.

**"The pause in a split task drops out."** No: a pause in the part still to do stays in the remaining work. Take a task of 5 work days with a 1-day pause after 2 days of work, started on Tuesday 29 June and, with the status date on Wednesday 30 June, at 40%. The remaining work of 3 work days starts on the status date and runs through the pause: the finish is Monday 5 July. Without the pause it was Friday 2 July.

**Hours and the status date.** You cannot enter a time in the ribbon: you fill in the status date as a date. If you take stock after working hours, set the status date to the next working day. A task in hours calculates the remaining work from the start of the status date. Take *Lay hollow-core floor* in the practice project after tutorial 4: 5 hours, on Monday 28 June, working day from 07:00. With the status date on Monday 28 June and the task at 40%, it has 3 hours of remaining work, running from 07:00 to 10:00, even if work was already done that morning. How the app counts hours is explained in [Days and hours](docs://uitleg-dagen-en-uren).

**Updating a baseline.** That is not possible. You save a new one and delete the old one. If you move the project, the actual dates and the status date move along, but the baselines by default do not: that way the shift stays visible as variance. See [Moving a project](docs://howto-project-verplaatsen).

## See also

- [Updating progress](docs://howto-voortgang-bijwerken): setting the status date and entering progress.
- [Importing progress from a spreadsheet](docs://howto-voortgang-importeren): reading in progress from site staff in one go.
- [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen): setting Retained Logic or Progress Override.
- [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren): recording a baseline and using it.
- [Moving a project](docs://howto-project-verplaatsen): what happens to actual dates, the status date and baselines.
- [Critical path and float](docs://uitleg-kritiek-pad): why a task is critical and what float means.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): progress and a status date partway through the project (20 May 2027).
