# Updating progress

Goal: put the actual state of the work into the schedule and recalculate the schedule: which tasks are finished, which are running and how much is still to do.

## When you need this

You update progress at fixed moments, for example every Friday when the site manager reports the state. That way the schedule sees what has actually happened and calculates the remaining work from the status date. Why the app does it this way is explained in [Progress, status date and baseline](docs://uitleg-voortgang).

## Steps

### 1. Set the status date

The status date is the day on which you take stock. Set it before you enter progress.

1. Go to *Planning › Baselines & progress › Status date*.
2. Type the date in the three boxes for day, month and year, for example 28, 06 and 2027, and press Enter. The app jumps to the next box by itself.
3. With the small cross next to the field you empty the status date again.

If you take stock on Friday after working hours, set the status date to the next working day, Monday. The app plans the remaining work from the start of the status date.

If you enter progress while there is no status date yet, the app sets it to today and reports: *There was no status date yet: it is now set to today (…), because progress is measured up to the status date. You can change it under Planning → Status date.* So rather do this yourself first.

### 2. Enter the progress

Choose the way that suits your situation. They give the same result.

**One task in the Properties panel.** Useful when you update a single task.

1. Click the task. If you do not see the *Properties* panel, turn it on with *View › Panels › Properties*.
2. Drag the slider *Progress (%)* to the percentage that is done.
3. If needed, fill in *Actual start* and *Actual finish*, in the same way as the status date. The app calculates the field *Remaining* itself; you cannot change it here.

A milestone has one field, *Actual date*.

**Choosing a percentage in the menu.** Useful for a quick state.

1. Right-click the task bar in the Gantt.
2. Choose *Progress* and then 0%, 25%, 50%, 75% or 100%.

**Several tasks in the table.** Useful when you update a whole list.

1. Click the **+** at the right of the task list header (*Add column*) and open the category *Progress*. Add the columns *Actual start*, *Actual finish*, *Remaining* and *Status*. The column *Progress* is already on the *Table* tab.
2. Double-click a cell, type the value and press Enter. You type a percentage as `50` or `50%`, a date as `25-06-2027`, a remaining duration as `1`.
3. For *Status*, after a double-click press Enter and choose *Not started*, *In progress* or *Completed*.

If you type a remaining duration, the app works back to the percentage: for a task of 2 work days a remainder of 1 gives a percentage of 50. A remainder of 0 completes the task. If you choose *Not started* at *Status*, the percentage goes to 0 and the actual dates disappear.

**Everything of one task in the Edit task window.** Right-click the task and choose *Edit...*. The progress fields are there too. They only apply once you click *Save*.

**Many tasks at once from a spreadsheet.** See [Importing progress from a spreadsheet](docs://howto-voortgang-importeren).

### 3. Recalculate the schedule

Every change to progress or the status date makes the schedule out of date: the status bar reports *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example through *Planning › Schedule › Calculate*. If *Calculate automatically* is on (under *Settings › Project › Settings*, tab *Planning*), the app does this itself.

## Checking the result

- On the status date the Gantt shows a dashed line with the date in the header. At running tasks the line bulges out to the percentage in the bar. You turn these on or off with *View › Baselines & progress › Progress line* and *Status date line*.
- Completed tasks are never red: with a status date a completed task is not critical.
- Phases show a derived percentage and the finish of the schedule may have moved.
- If you saved a baseline, the original schedule is under each bar and the report type *Variance* shows the variance.

## Pitfalls and what the app does

**A date after the status date.** The app refuses an actual start or an actual finish after the status date. In the panel it says under the fields *Actuals cannot be after the status date*; in the table the cell reports *The actual date lies after the status date.* First set the status date later, or correct the date.

**A task that would only start after the status date.** If you enter progress for a task that according to the schedule would not have started yet, the window *Enter the actual start* opens. It asks when the task actually started; the suggestion is the status date. With *Apply progress* you record it, with *Cancel* nothing changes.

**100% without dates.** If you set a task to 100% without an actual finish, the actual finish becomes the status date, even if the task was finished earlier. Then fill in the actual finish yourself.

**A percentage below 100%.** If you set a completed task back below 100%, the actual finish is dropped. If you clear only the actual finish, the percentage goes to 0 and the task stays *In progress*. If you want the task to count as not started again, also clear the actual start, or choose *Not started* at *Status* in the table.

**Changing the duration of a running task.** The work done stays done and the percentage adjusts. A task of 5 work days at 60% that you set to 10 work days ends up at 30%. The app refuses a duration shorter than the work already done: *‘Build inner cavity leaf’ is already 60% done: a duration shorter than the work already done isn't possible. The duration was not changed.*

**The remaining duration is rounded.** The app rounds the remaining duration to whole work days. For a task of 2 work days, 50% and 75% both give a remainder of 1 work day.

**A phase.** A phase has no progress of its own. In the panel it says *Derived from the subtasks: change progress there. The summary task follows after calculating (F5).* In the table the cell reports *The progress of a summary task is derived from its subtasks and cannot be changed here.*

**Moving the status date later.** The remaining work of running tasks starts on the new status date, and work that has not started yet cannot lie before that date. So move it only together with an update of the progress. If you set a status date without also entering progress, all work that has not started yet moves to that date (except in the Microsoft Project profile).

**A mistake.** Every progress change is one step for Ctrl+Z.

## See also

- [Progress, status date and baseline](docs://uitleg-voortgang): how the app calculates the remaining work and the status date, with a worked example.
- [Importing progress from a spreadsheet](docs://howto-voortgang-importeren): reading in progress for many tasks at once.
- [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen): what the app does with a task that has started while its predecessor is still running.
- [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren): recording the original schedule to compare progress with.
