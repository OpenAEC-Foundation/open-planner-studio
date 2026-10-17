# Dates as recorded

You open a schedule from Primavera or MS Project, and the dates differ from what you saw in that package. Did the import go wrong? Usually not. In this article you read why the app recalculates by itself, when it shows the dates from the file, what stays empty then and how you return to its own calculation. The example at the end follows two tasks through the whole cycle.

## The concept

A schedule file contains two kinds of data. First the logic: tasks, durations, relations, calendars and constraints. Second the dates that the package itself calculated from that. When opening, Open Planner Studio uses the logic and calculates by itself. So the dates in the file are not input.

If its own calculation ends up on other dates than the file states, you do not know which side is right. The file may lack logic that the package did use. The package may also calculate differently from the app on some point. That is why the app can show the dates **as recorded**: the dates the other package put in the file. That way you compare with what you saw in that package.

## How the app deals with it

### Which calculation profile the app uses

The app calculates with a **calculation profile**: a set of calculation rules (conventions) that decides, for example, how it treats the planned start of a task and constraints. See [Calculation profiles and conventions](docs://uitleg-rekenprofielen). There are three built-in profiles: *Primavera P6*, *Microsoft Project* and *Open Planner Studio*. An `.xer` opens with *Primavera P6* and an `.mpp` with *Microsoft Project*. CSV, MS Project XML and Primavera P6 XML open with *Open Planner Studio*. The profile of a project is under *File › Project settings*, at *Calculation profile and options*. An IFC file from the app keeps its profile.

### When the app compares

On opening, the app records what the file said and compares that with its own outcome. It does that for:

- a Primavera file (`.xer`) and Primavera P6 XML;
- MS Project XML and MS Project files (`.mpp`);
- an IFC file from another program, for the tasks whose early dates are in the file;
- an IFC file from the app itself that has remembered its origin. Below you read when that is the case.

The app never compares a CSV file: the start date in a CSV is input, not the outcome of a calculation. An IFC file from the app itself without a remembered origin is not compared either.

If no task differs, you notice nothing. If at least one task differs in a file you are importing right now, the app switches the view on immediately.

With a Primavera file the app calculates with the calculation profile *Primavera P6*. That keeps the planned start from the file as the earliest start. A task that is later in the file than the relations require, but is also planned there, therefore stays where it is: then there is no difference.

### What you see

Under the ribbon there is a bar: *You're viewing the dates as recorded in the file; recalculating would shift 4 tasks.* With a Primavera source (an `.xer` or Primavera P6 XML) it says *You're viewing the schedule as Primavera recorded it; recalculating would shift 1 task.* On the right of the bar is the button *Recalculate*. The bar has no cross.

There is also a message: *12 tasks show the dates as recorded in the file (not recalculated).* Only with an `.xer` it says *12 tasks show the dates as Primavera recorded them (not recalculated).* That number counts every task for which the file recorded dates, including the tasks that do not differ. The number of tasks that differ after recalculating is in the strip. Every task for which the file recorded dates shows an orange block in the *Properties* panel, directly above *Start*: *You see the dates Primavera saved, not the app's calculation.* With another source it says *You see the dates that were in the file, not the app's calculation.* A second line says what happens to this task when you recalculate: *Recalculating changes this task.* or *Recalculating leaves this task the same.* The Gantt, the task grid and the status bar show the dates from the file.

### Tasks that have started or are complete

A task that is complete sits on the days on which it really happened: from the actual start to the actual finish. A task that is in progress starts on the day on which it really started. It finishes on the calculated finish. This applies in this view, after recalculating and with every calculation profile, as in Primavera and MS Project.

For such a task the file often records other early dates. Primavera puts the early start of a task that is in progress or complete on the status date. You see those dates in the columns *Early start* and *Early finish*, not in *Start* and *Finish*. A task that is complete therefore never counts as a difference. A task that is in progress only counts when its finish differs.

For a task that has started, you can no longer type the start. In the task grid, in the *Properties* panel and in *Edit task* the start is then read-only. For a task that is complete, this also applies to the finish in the task grid. Change the *Actual start* or the *Actual finish* instead, with the progress. In the Gantt the bar of such a task does not move; you then get a message.

### What stays empty in this view

In this view the app calculates nothing. It only shows what the file recorded. So you only see float and critical path if the file contains them. If the file records no critical tasks, the status bar reports 0 critical tasks. That says nothing about the critical path in the package itself. What only comes out of a calculation does not exist in this view: which relations drive the schedule, violated constraints, tasks that run out of sequence and near-critical tasks.

If the file does not record everything for a task, you see a grey block in the *Properties* panel, for example *Primavera did not save everything for this task. Missing: Late start, Total float.* With another source it says *The file does not contain everything for this task.* The missing values have the same names as the columns in the task grid. In a CSV export the columns *Critical* and *Total Float* stay empty for such a task, instead of an invented zero.

### Leaving the view

You leave the view in two ways:

- Click *Recalculate* in the bar, or choose *Calculate* (F5). The app calculates with its own rules.
- Change something that can alter the dates, such as the duration of a task or a new task. The app leaves the view and recalculates straight away, even if *Calculate automatically* is off. Changing a name, description, task type or work rule does not do that: the view stays on.

A calendar change from the resource library keeps the view on and the dates from the file in place, but updates the number in the bar.

After leaving there is no button to switch back to the view. Ctrl+Z does bring it back, right after recalculating or right after such an edit. Otherwise you can open the source file again. With an `.xer`, opening an IFC file that you saved after recalculating, but did not edit, also switches the view on again.

### Crash recovery

If you recover a project after a crash that was in the view, the view stays on. If the view was off, the app forgets the dates from the file. The project that was active shows the same bar as before. A project on another tab shows the bar without a number: *You're viewing the dates as recorded in the file. Nothing has been recalculated.* See [Recovering after a crash](docs://howto-herstellen-na-een-crash).

### Saving and reopening

If you save while you are using the view, the app writes the displayed dates into the IFC file, together with the source format. If you later open that IFC file again, the view is on again, without a new message. This also applies if you changed something in the view that does not affect the dates, such as a name. The app opens the file the way you left it.

If you save after you left the view, by recalculating or by an edit that can change the dates, the file holds the app's own calculation. When reopening you see that calculation, without a strip and without a block in the *Properties* panel. There is one exception: an `.xer` that you only recalculated and did not edit (see above). Your edited schedule is now the schedule; the old dates from the source package no longer belong to it. If you still want to see them, open the source file again.

## Worked example: the extension

Suppose you open a Primavera file *Uitbouw* (extension) with two tasks, on a calendar without holidays. In 2027, 6 May is Ascension Day and 17 May is Whit Monday: with holidays in the calendar the dates come out differently. *Fundering storten* (pour foundation) takes 5 working days, *Metselwerk* (brickwork) 10 working days, and Metselwerk follows Fundering with a Finish-Start relation. The file records that Fundering runs from Monday 3 May to Friday 7 May 2027 and Metselwerk from Monday 17 May to Friday 28 May 2027: a week after the earliest start the relation allows. The planned start of Metselwerk in the file is Monday 10 May 2027.

Right after opening you see the dates from the file. The status bar says *End: 28-05-2027* and *Critical path: 2 tasks, 20 work days*. The bar reports that 1 task differs when recalculating, Both tasks show the orange block *You see the dates Primavera saved, not the app's calculation.* Below it, Metselwerk says *Recalculating changes this task.* and Fundering says *Recalculating leaves this task the same.*

On *Recalculate*, Fundering stays on 3 to 7 May. Metselwerk now starts on Monday 10 May, the working day after Fundering ends, and finishes on Friday 21 May. The schedule ends on 21 May 2027 and spans 15 working days instead of 20. The critical path consists of the same 2 tasks.

What if it is different?

- If Metselwerk is also planned on Monday 17 May in the file, the calculation profile *Primavera P6* keeps that start. The calculation ends on 17 through 28 May, there is no difference and the view does not switch on.
- You add a task in the view: the same recalculation. Metselwerk moves to 10 through 21 May.
- You save in the view and open the IFC file again, without editing: Metselwerk is back on 17 through 28 May.
- You recalculate, save without editing further and open the IFC file again: the view is on again and Metselwerk is on 17 through 28 May.
- You only change the name of Metselwerk in the view, save and open again: the view is on again and Metselwerk is on 17 through 28 May.
- You add a task in the view, save and open again: the app forgets the dates from the file. Metselwerk is on 10 to 21 May, without a strip and without a block.
- Fundering is already complete in the file: it actually started on 3 May and actually finished on 7 May. The file records the status date as its early start. The bar of Fundering still sits on 3 to 7 May, in the view and after recalculating. Fundering does not count as a difference.

## Consequences and misunderstandings

**A difference is not an import error.** The app calculates with its own rules: with an `.xer` with the calculation profile *Primavera P6*, with an `.mpp` with *Microsoft Project*, with CSV, MS Project XML and Primavera P6 XML with *Open Planner Studio*. Why the dates in the source package came out differently can lie with the file or with the package. The view shows you *that* they differ.

**The view is not a calculation result.** The app did not calculate the dates. Do not simply take them over as the outcome of your own schedule.

**Saving in the view keeps the dates of the source package.** The IFC file then holds what the source package said, not what the app would calculate.

**After editing, the dates from the file do not come back.** If you edit, save and reopen a project, you only see the app's own calculation. Open the source file again if you want to see the dates from the source package.

## See also

- [Files and formats](docs://uitleg-bestanden): what the app keeps in a file and what an import or export carries.
- [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen): the steps and messages for a `.xer` file.
- [Opening an MS Project file (.mpp)](docs://howto-mpp-openen): the steps and messages for a `.mpp` file.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what happens to this project after a crash.
- [Critical path and float](docs://uitleg-kritiek-pad): how the app calculates float and criticality when it does calculate.
