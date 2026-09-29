# Calculation options and conventions

All the choices that determine how the app calculates a schedule, as you find them in the block *Calculation profile and options*: the profile, the 27 conventions per profile and the calculation options of the project. Why P6 and MS Project calculate differently and what that means for your dates is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

## Where to find them and how they work

Choose *Settings › Project › Project info* or *File › Project info*. At the bottom is the block *Calculation profile and options*. In the *New project* window there is only the drop-down *Calculation profile*: a choice immediately applies the default options of that profile.

**Per project, not per app.** The profile and the options belong to the project file and travel with *Save* (IFC). Two people opening the same file therefore calculate the same way. CSV, MS Project XML and P6 XML do not carry them: see [Import and export formats](docs://ref-import-exportformaten). Your own templates are app-wide: the app keeps those on this device.

**Only on Apply.** What you change in this block is a draft until you click *Apply*. The app then recalculates the schedule, even if *Calculate automatically* is off, and reports how many tasks moved (*After applying, 3 tasks moved.*). It is one step for *Undo*. Applying also leaves the view *Dates as recorded*. A change that changes nothing does nothing. In *File › Project info* you throw the draft away with *Discard*.

## Calculation profile

**Calculation profile** — the basis the app calculates with. Choose from *Primavera P6*, *Microsoft Project* and *Open Planner Studio*, plus your own templates and the custom profile of this project. Default: *Open Planner Studio* for a new project and for a project without a profile. Effect: the profile switches each of the 27 conventions below on or off. A file you open gets the profile of its format: a `.xer` calculates as *Primavera P6*, an `.mpp` as *Microsoft Project*, and CSV, MS Project XML and P6 XML as *Open Planner Studio*. An IFC file keeps the profile stored in it. A profile that differs from its basis is called *Primavera P6 (modified)*, with the name of the basis. Where: the block *Calculation profile and options*, drop-down *Calculation profile*.

**Ticking or unticking a convention** — changes the profile. Effect: on a built-in profile the app makes a custom profile itself, named *Copy of Primavera P6* (or of the profile you started from), with all current values. The field *Name of this custom profile* names it; without a name, *Apply* refuses it. Where: the block *Conventions of this profile*.

**Save as template**, **Update template from this project**, **Update from template** and **Delete template** — manage your custom profiles as a template. Effect: a template is a saved profile that you can choose in any project; the project keeps its own copy. If the profile of the project differs from its template, it says *This profile differs from the template “…”.* Templates are not in the project file. Where: below the drop-down, with a custom profile.

## Conventions per profile

A convention is a rule in which planning packages differ. Every convention is on or off. The block shows a tick box per convention, the base value (*base: on* or *base: off*) and, if you deviate, the button *back to base* and a badge *changed: 2* on the group. With the arrow before a line you open its explanation. The default per convention is what the chosen built-in profile says. *Open Planner Studio* has every convention off. Under each convention below is what *Primavera P6* and *Microsoft Project* do.


### Progress and completed work

**Keep actual dates in the backward pass** — A started or completed task keeps its recorded dates on the late side too; a completed successor does not pull an open predecessor back into the past. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**In-progress task: early start = start of remaining work** — The early and late start of an in-progress task describe where the remaining work begins, not the historical actual start. Calculating backward over a start-to-start relationship, only the remaining duration counts. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Completed physical-progress task sits at the data date** — A completed task with physical percent complete is shown as a single point at the data date, or later if a predecessor requires it, instead of at its actual dates. Only measured for physical percent complete; for other percent complete types (P6 default: duration) this behaviour has not been measured and stays off. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Planned start is not a floor for a task in progress** — The remaining work of a started task begins at the data date and right after its predecessors, even if its planned start is later. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Progress Override ignores a started successor on the late side too** — Under Progress Override, the relationship to a successor that has already started does not count in the late dates and free float of a predecessor that is not finished. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.


### Relationships and lag

**Successor starts on the finish boundary** — For a finish-to-start relation without lag on a shared band boundary, the successor starts at the predecessor's finish (only relations the file marks this way). Calculating backward, the successor shows its late start simply as the start of a work band. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Backward lag from a finish boundary** — When the backward pass subtracts a working-time lag from a finish boundary and lands exactly on a band start, it lands on the previous finish boundary. With a finish-to-finish relationship without lag, a late finish on a band end also stays on that finish boundary. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Elapsed lag of a completed predecessor does not count** — On the late side, only the part of the lag after a completed predecessor that has not yet elapsed at the data date counts. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Elapsed SS lag from an in-progress predecessor does not count** — For a start-to-start relationship from a task that has already started, only the part of the lag that has not yet elapsed since its actual start at the data date counts. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Early finish not before a finish-to-finish boundary** — With a finish-to-finish relationship, the successor's early finish never lies before the boundary set by the predecessor in clock time. If that boundary falls in the successor's non-working time, the finish becomes the start of the next work period. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.


### Milestones and LOE activities

**Milestone follows the planned calendar boundary** — A zero-duration milestone stays on the calendar boundary the file planned: a day start stays a start milestone, a band end may land on the predecessor's finish. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Unstarted LOE uses the target window** — A level-of-effort activity that has not started takes its target window as its span (only tasks with P6 provenance). Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Finish-to-finish relationship to a start milestone binds to the milestone itself** — A finish-to-finish relationship to a start milestone counts up to the milestone itself, not up to the start of the milestone's day: the predecessor's late finish may run up to the milestone's late finish. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.


### Float and late dates

**Free float never negative** — With an unachievable late constraint, total float stays negative but free float becomes zero. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Free float in the task's own calendar** — The free float of a not-started task counts per relationship in the task's own calendar, not in the successor's: for finish-to-start, start-to-start and finish-to-finish, including a working-time lag on the predecessor's calendar. A started task only for finish-to-start without lag. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Late finish on the task's own calendar** — If the late finish imposed by a successor falls outside the task's working time, it becomes the end of the previous work period on the task's own calendar. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**ALAP tasks as late as the successors allow** — An unstarted task with the 'as late as possible' constraint finishes at the minute its successors need it, successors first, so a chain closes up. Its own planned start does not count; a task without a predecessor then starts no earlier than the status date. Applies only on an hourly calendar. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.


### Dates and moments from the file

**Planned start as an extra floor** — The planned start from the file acts as a floor once both start and finish lie more than one calendar day later than the network allows. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Keep actual dates exact** — Recorded actual start and finish dates are not moved to a working-time band. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Exact constraint moment on a milestone** — A date-and-time constraint on a zero-duration milestone is an exact point, also at the start of a working band. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.


### Progress as in Microsoft Project

**Remaining work resumes after the elapsed duration** — An in-progress task resumes its remaining work at the actual start plus the elapsed duration, not at the status date. Default: on under Microsoft Project, off under Primavera P6 and Open Planner Studio.

**Don't move unstarted tasks to the status date** — A task that has not started is not moved to on or after the status date automatically. Default: on under Microsoft Project, off under Primavera P6 and Open Planner Studio.


### Custom profiles only

These conventions are off in every built-in profile, including Primavera P6. Turning one on makes it a custom profile.

**Finish milestone as a boundary window** — A finish milestone may sit on two adjacent calendar boundaries: early start at the start of a band, early finish at the end of the previous band. Default: off in every built-in profile.

**Completed task in the data-date window** — A completed task gets early dates in the data-date window, and its finish counts toward the project finish (only tasks with P6 provenance). Default: off in every built-in profile.

**Completed LOE via its actual finish** — A completed level-of-effort activity with only a start-to-start input follows the route through its actual finish (only tasks with P6 provenance). Default: off in every built-in profile.

**Completed predecessor does not hold past the data date** — If a completed predecessor's actual finish lies after the data date, its successors may still start at the data date. Default: off in every built-in profile.

**Completed out-of-sequence task waits for its predecessors** — A completed task whose predecessor is not yet finished gets its zero window after that predecessor instead of at the data date (Retained Logic). Default: off in every built-in profile.


## Calculation options of this project

These options are under *Calculation options of this project*, below the conventions. The button *Apply this profile's default options* resets all of them to the default of the chosen profile. Defaults per profile: *Open Planner Studio* has no values of its own, so every option is at its default below; *Microsoft Project* only sets *Float calculation* to *Smallest (start/finish)*; *Primavera P6* sets *Lag calendar* to *Predecessor*, *Critical definition* to *Total float ≤ threshold* with a threshold of 0 hours, *Float calculation* to *Finish float*, *Open-ended tasks critical* off and *Calculate SS lag from an in-progress predecessor from* to *Early start (remaining start)*. A `.xer` file also brings values from the file itself.

**Critical definition** — what makes a task critical. Choose from *Total float ≤ threshold* and *Longest path*. Default: *Total float ≤ threshold* with threshold 0. Effect: with *Total float ≤ threshold* a task is critical if its total float is less than or equal to the threshold. With *Longest path* a task is critical if it lies on the chain that leads to the last finish; with several end tasks with the same finish, all their chains count. Float then plays no part. In both cases a completed task is never critical, and neither is a hammock. It applies to the Gantt, the table, the milestone overview and the reports. Where: *Calculation options of this project*.

**Threshold (work days)** — the limit for *Total float ≤ threshold*. Default: 0. Effect: the threshold may be negative. A threshold from a P6 file is in hours and is then called *Threshold (hours, per task calendar)*: the app compares it per task in the hours of that task's calendar. Where: *Calculation options of this project*, next to *Critical definition*.

**Float calculation** — which float the total float is. Choose from *Automatic (default)*, *Smallest (start/finish)*, *Start float* and *Finish float*. Default: *Automatic (default)*; *Microsoft Project* sets *Smallest (start/finish)* and *Primavera P6* *Finish float*. Effect: *Start float* is late start minus early start, *Finish float* is late finish minus early finish, *Smallest (start/finish)* is the smaller of the two. *Automatic (default)* uses the finish float for a task in progress (with an actual start or progress, and a status date) and the smallest for all other tasks. Where: *Calculation options of this project*.

**Open-ended tasks critical** — a task without a successor. Default: off. Effect: on gives such a task total and free float 0, so that under the critical definition *Total float ≤ threshold* it becomes critical (unless it is completed). Off calculates the float as usual up to the end of the project. Where: *Calculation options of this project*.

**Mark near-critical** — marks tasks with almost no float. Default: off. Effect: on gives a threshold, by default 2 work days (the field *Threshold*). A task with more than 0 and at most that threshold of total float is called *Near critical*; a task with exactly 0 float is critical and does not count. You see it in the table column *Near critical* and in the reports. The field shows work days; with hour planning on and the duration display in hours it shows hours. Where: *Calculation options of this project*.

**Multiple float paths** — numbers chains of tasks by their float. Default: off. Effect: on gives tasks a number in the table column *Float path*. Off leaves the column empty. Where: *Calculation options of this project*.

**Method** — how the paths arise, with *Multiple float paths*. Choose from *Free float (peeling)* and *Total float (ranking)*. Default: *Free float (peeling)*. Effect: with *Free float (peeling)* the app peels off chains. It picks the task with the last finish and adds its driving predecessors: that is path 1. From the remaining tasks it does the same for path 2, and so on; a shared predecessor keeps the number of the first path in which it occurs. With *Total float (ranking)* the number is the rank of the task's total float: 1 for the smallest, 2 for the next smallest value. Hammocks do not take part. Where: *Calculation options of this project*.

**Max. paths** — how many paths get a number. Default: 10. Effect: tasks outside the first *Max. paths* paths or ranks get no number. Where: *Calculation options of this project*, with *Multiple float paths*.

**Lag calendar** — in which calendar a lag in working time counts. Choose from *Predecessor*, *Successor*, *24-hour* and *Project calendar*. Default: *Predecessor*. Effect: a lag of 2 days counts in the working days of the calendar you choose. Where: *Calculation options of this project*. See [Relations and lag](docs://uitleg-relaties).

**Calculate SS lag from an in-progress predecessor from** — the variant of the convention *Elapsed SS lag from an in-progress predecessor does not count*. Choose from *Early start (remaining start)* and *Actual start (data date)*. Default: *Early start (remaining start)*. Effect: for a start-to-start relation with a positive working-time lag from a predecessor in progress, the successor with *Early start (remaining start)* starts at the start of the predecessor's remaining work plus the remaining lag. With *Actual start (data date)* it starts at the data date plus the remaining lag, and the relation does not bound the predecessor in progress backward. The remaining lag is the lag minus the working time between the actual start and the data date, never less than 0. A lag of 0 or less, a lag in clock hours and a schedule in days keep the normal behaviour. The choice only works when the conventions *Elapsed SS lag from an in-progress predecessor does not count* and *In-progress task: early start = start of remaining work* are both on; otherwise the drop-down is disabled and it says *Only applies when the convention “…” is on.* Where: *Calculation options of this project*.

### Settings from the source file

These three options come from a Primavera P6 file (`.xer`) and are read-only. The block *Settings from the source file* only appears if the project carries them. They count in the calculation. *Apply this profile's default options* leaves them as they are or, under *Primavera P6*, sets them back on (the first and the last).

**Use expected finish dates (P6: Use Expected Finish Dates)** — Default under P6: on. Effect: a P6 task in progress with an expected finish date gets that date as its early finish. Where: *Settings from the source file*.

**Calculate float up to the project finish date** — Default: off. Effect: the finish date of the project is the anchor for the late dates. Without a finish date in the file the app calculates up to the end of the network. Where: *Settings from the source file*.

**Completed task: late dates from the data date** — Default under P6: on. Effect: a completed task also gets zero remaining duration on the data date on the late side, with a meaningful float. It only works together with the convention *Completed task in the data-date window*, which is off in every built-in profile; if that is off, it says *Only works together with the convention “…”, which is currently off.* Where: *Settings from the source file*.

## See also

- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): why an imported schedule can show other dates than your package.
- [Critical path and float](docs://uitleg-kritiek-pad): what critical, total and free float mean.
- [Relations and lag](docs://uitleg-relaties): lag and the calendar in which it counts.
- [Progress, status date and baseline](docs://uitleg-voortgang): the status date that many conventions refer to.
- [Import and export formats](docs://ref-import-exportformaten): which profile a file gets when it is opened.
