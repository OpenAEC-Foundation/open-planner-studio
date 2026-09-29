# Dates as recorded

You open a schedule from Primavera or MS Project, and the dates differ from what you saw in that package. Did the import go wrong? Usually not. In this article you read why the app recalculates by itself, when it shows the dates from the file, what stays empty then and how you return to its own calculation. The example at the end follows two tasks through the whole cycle.

## The concept

A schedule file contains two kinds of data. First the logic: tasks, durations, relations, calendars and constraints. Second the dates that the package itself calculated from that. When opening, Open Planner Studio uses the logic and calculates by itself. So the dates in the file are not input.

If its own calculation ends up on other dates than the file states, you do not know which side is right. The file may lack logic that the package did use. The package may also calculate differently from the app on some point. That is why the app can show the dates **as recorded**: the dates the other package put in the file. That way you compare with what you saw in that package.

## How the app deals with it

### Which calculation profile the app uses

The app calculates with a **calculation profile**: a set of calculation rules (conventions) that decides, for example, how it treats the planned start of a task and constraints. See [Calculation profiles and conventions](docs://uitleg-rekenprofielen). There are three built-in profiles: *Primavera P6*, *Microsoft Project* and *Open Planner Studio*. An `.xer` opens with *Primavera P6* and an `.mpp` with *Microsoft Project*. CSV, MS Project XML and Primavera P6 XML open with *Open Planner Studio*. The profile of a project is under *File › Project info*, at *Calculation profile and options*. An IFC file from the app keeps its profile.

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

There is also a message: *4 tasks show the dates as recorded in the file (not recalculated).* Only with an `.xer` it says *1 task shows the dates as Primavera recorded them (not recalculated).* Every task for which the file recorded dates shows a marker in the *Properties* panel: *Shows Primavera’s own recorded dates for this task* with a Primavera source, or *Shows the dates as recorded in the file for this task* with another source. The Gantt, the task grid and the status bar show the dates from the file.

### What stays empty in this view

In this view the app calculates nothing. It only shows what the file recorded. So you only see float and critical path if the file contains them. If the file records no critical tasks, the status bar reports 0 critical tasks. That says nothing about the critical path in the package itself. What only comes out of a calculation does not exist in this view: which relations drive the schedule, violated constraints, tasks that run out of sequence and near-critical tasks.

If the file does not record everything for a task, you see the marker *Recorded data is partly incomplete — see the late/float columns* in the *Properties* panel. In a CSV export the columns *Critical* and *Total Float* stay empty for such a task, instead of an invented zero.

### Leaving the view

You leave the view in two ways:

- Click *Recalculate* in the bar, or choose *Calculate* (F5). The app calculates with its own rules.
- Change something that can alter the dates, such as the duration of a task or a new task. The app leaves the view and recalculates straight away, even if *Calculate automatically* is off. Changing a name does not do that: the view stays on.

After leaving there is no button to switch back to the view. Ctrl+Z does bring it back, right after recalculating or right after such an edit. Otherwise you can open the source file again. With an `.xer`, opening an IFC file that you saved after recalculating, but did not edit, also switches the view on again.

### Crash recovery

If you recover a project after a crash that was in the view, the view stays on. The project that was active shows the same bar as before. A project on another tab shows the bar without a number: *You're viewing the dates as recorded in the file. Nothing has been recalculated.* See [Recovering after a crash](docs://howto-herstellen-na-een-crash).

### Saving and reopening

If you save while you are using the view, the app writes the displayed dates into the IFC file, together with the source format. If you later open that IFC file again and have not edited it since the import, the view is on again, without a new message.

If you edited and saved in between, it depends on the source. With a Primavera file the IFC file keeps the original `.xer` along. The app then compares again and offers the view: *Recalculation moved 1 of 2 tasks away from the dates in the file.* With it come the button *Show recorded dates* and a cross. On every deviating task the *Properties* panel shows the marker *Deviates from the recorded dates*. *Show recorded dates* switches the view on; Ctrl+Z undoes that. The cross hides the offer.

With MS Project XML, `.mpp`, Primavera P6 XML or an IFC file from another program, the IFC file does not keep the source. If you edit and save such a project, the app no longer compares when reopening.

## Worked example: the extension

Suppose you open a Primavera file *Uitbouw* (extension) with two tasks, on a calendar without holidays. In 2027, 6 May is Ascension Day and 17 May is Whit Monday: with holidays in the calendar the dates come out differently. *Fundering storten* (pour foundation) takes 5 working days, *Metselwerk* (brickwork) 10 working days, and Metselwerk follows Fundering with a Finish-Start relation. The file records that Fundering runs from Monday 3 May to Friday 7 May 2027 and Metselwerk from Monday 17 May to Friday 28 May 2027: a week after the earliest start the relation allows. The planned start of Metselwerk in the file is Monday 10 May 2027.

Right after opening you see the dates from the file. The status bar says *End: 28-05-2027* and *Critical path: 2 tasks, 20 work days*. The bar reports that 1 task differs when recalculating, and both tasks show *Shows Primavera’s own recorded dates for this task*.

On *Recalculate*, Fundering stays on 3 to 7 May. Metselwerk now starts on Monday 10 May, the working day after Fundering ends, and finishes on Friday 21 May. The schedule ends on 21 May 2027 and spans 15 working days instead of 20. The critical path consists of the same 2 tasks.

What if it is different?

- If Metselwerk is also planned on Monday 17 May in the file, the calculation profile *Primavera P6* keeps that start. The calculation ends on 17 through 28 May, there is no difference and the view does not switch on.
- You add a task in the view: the same recalculation. Metselwerk moves to 10 through 21 May.
- You save in the view and open the IFC file again, without editing: Metselwerk is back on 17 through 28 May.
- You recalculate, save without editing further and open the IFC file again: the view is on again and Metselwerk is on 17 through 28 May.
- You edit, save and open again: the app offers the view with *Recalculation moved 1 of 2 tasks away from the dates in the file.* Metselwerk shows *Deviates from the recorded dates*.

## Consequences and misunderstandings

**A difference is not an import error.** The app calculates with its own rules: with an `.xer` with the calculation profile *Primavera P6*, with an `.mpp` with *Microsoft Project*, with CSV, MS Project XML and Primavera P6 XML with *Open Planner Studio*. Why the dates in the source package came out differently can lie with the file or with the package. The view shows you *that* they differ.

**The view is not a calculation result.** The app did not calculate the dates. Do not simply take them over as the outcome of your own schedule.

**Saving in the view keeps the dates of the source package.** The IFC file then holds what the source package said, not what the app would calculate.

**The button *Show recorded dates* does not appear with every import.** With a newly opened file the view is already on. The button only appears with a reopened IFC file with a Primavera source that you edited since the import.

## See also

- [Files and formats](docs://uitleg-bestanden): what the app keeps in a file and what an import or export carries.
- [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen): the steps and messages for a `.xer` file.
- [Opening an MS Project file (.mpp)](docs://howto-mpp-openen): the steps and messages for a `.mpp` file.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what happens to this project after a crash.
- [Critical path and float](docs://uitleg-kritiek-pad): how the app calculates float and criticality when it does calculate.
