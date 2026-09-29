# Saving and managing a baseline

Goal: record the schedule as an agreement (a baseline), so you can later see how far the execution deviates, and keep, rename, choose and delete several baselines.

## When you need this

You record a baseline when the schedule has been approved and the work still has to start. If the schedule is formally revised later, for example after a variation order, you save a second baseline and keep the first one. That way you measure the execution against the first agreement and against the revised one. What a baseline records exactly and how the app calculates the variance is explained in [Progress, status date and baseline](docs://uitleg-voortgang).

## Steps

### Saving a baseline

1. Press **Calculate** (F5), for example through *Planning › Schedule › Calculate*. The baseline records the dates that are calculated at that moment.
2. Choose *Planning › Baselines & progress › Manage baselines…*. The *Baselines* window opens.
3. Under *Save new baseline* there is a suggested name, such as *Baseline 1 — (today's date)*. Type a name of your own that you will recognise later, for example *Original plan*.
4. Click *Save*. The baseline is now in the list and is immediately the active baseline.
5. Click *Close*.

Under every task bar in the Gantt there is now a thin bar with the baseline dates; a milestone gets a small diamond. You turn that overlay on or off with *View › Baselines & progress › Baseline overlay*.

### Choosing the active baseline

Open *Manage baselines…* and choose in the *Active* column the baseline you want to compare with. There is always one active baseline. The Gantt overlay, the report type *Variance* and the *Progress report* use it.

### Renaming a baseline

Change the name in the list. The change applies immediately; you do not have to click *Save*.

### Deleting a baseline

Click the small wastebasket next to the baseline in the list. If you delete the active baseline, the app asks *Delete the active baseline?*. Afterwards the newest remaining baseline becomes the active one. If there is no other, there is no active baseline any more and the overlay disappears. With Ctrl+Z you bring back a deleted baseline.

### Variances in the task table

Every baseline has six columns in the task table. Click the **+** at the right of the task list header (*Add column*) and open the category *Baseline*. Per baseline there are *Scheduled start*, *Scheduled finish*, *Duration*, *Start variance*, *Finish variance* and *Duration variance*, with the name of the baseline in front, for example *Original plan — Finish variance*. The variances are in work days: a plus is later, a minus is earlier. A task that is not in the baseline shows a dash (—) in those columns.

## Pitfalls and what the app does

**An out-of-date schedule.** If the schedule is out of date, the window says *Schedule is out of date — recalculate first (F5)*. That is a warning; saving remains possible. But you then save the old dates. Close the window, press **Calculate** and only then save.

**A baseline with progress in it.** If you save a baseline after you have entered progress, it records the state with those actual dates. The variance is then zero and says nothing about the execution any more. Record the baseline before the work starts.

**A baseline cannot be updated.** If you want to revise the agreement, save a new baseline and delete the old one if needed.

**Only tasks without subtasks.** A phase is not in the baseline: it has no baseline bar and no variance. The phase follows from the tasks below it.

**New and deleted tasks.** A task you add after saving has no baseline bar. In the Variance report it appears as *New*. A task you delete appears as *Dropped*.

**Move project.** In the *Move project…* window, as soon as there are baselines, there is the checkbox *Shift baselines too*. It is off by default: the baselines stay in place, so the shift shows up as variance.

**Stored in the project file.** Baselines and the active choice are saved with the project and come back when you open the file.

## See also

- [Progress, status date and baseline](docs://uitleg-voortgang): what a baseline records and how the variance is calculated.
- [Updating progress](docs://howto-voortgang-bijwerken): entering the actual state that you compare with the baseline.
