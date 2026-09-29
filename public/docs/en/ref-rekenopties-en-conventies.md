# Calculation options and conventions

All the choices that determine how the app calculates a schedule, as you find them in the block *Calculation profile and options*: the profile, the 27 conventions per profile and the calculation options of the project. Why P6 and MS Project calculate differently is in [Calculation profiles and conventions](docs://uitleg-rekenprofielen); what that means for your dates is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

## Where to find them and how they work

Choose *Settings › Project › Project info* or *File › Project info*. At the bottom is the block *Calculation profile and options*. In the *New project* window there is only the drop-down *Calculation profile*: a choice immediately applies the default options of that profile.

**Per project, not per app.** The profile and the options belong to the project file and travel with *Save* (IFC). Two people opening the same file therefore calculate the same way. CSV and P6 XML do not carry them; of the calculation options, MS Project XML keeps at most the critical threshold. See [Import and export formats](docs://ref-import-exportformaten). Your own templates are app-wide: the app keeps those on this device.

**Only on Apply.** What you change in this block is a draft until you click *Apply*. The app then recalculates the schedule, even if *Calculate automatically* is off, and, if tasks moved, reports how many (*After applying, 3 tasks moved.*). If no tasks moved, there is no message. It is one step for *Undo*. Applying also leaves the view *Dates as recorded*. A change that changes nothing does nothing. In *File › Project info* you throw the draft away with *Discard*.

## Calculation profile

**Calculation profile** — the basis the app calculates with. Choose from *Primavera P6*, *Microsoft Project* and *Open Planner Studio*, plus your own templates and the custom profile of this project. Default: *Open Planner Studio* for a new project and for a project without a profile. Effect: the profile switches each of the 27 conventions below on or off. A file you open gets the profile of its format: a `.xer` calculates as *Primavera P6*, an `.mpp` as *Microsoft Project*, and CSV, MS Project XML and P6 XML as *Open Planner Studio*. An IFC file keeps the profile stored in it. A profile that differs from its basis is called *Primavera P6 (modified)*, with the name of the basis. If you choose another profile in Project info, the calculation options stay as they were; set them to the default of the new profile with *Apply this profile's default options*. Where: the block *Calculation profile and options*, drop-down *Calculation profile*.

**Ticking or unticking a convention** — changes the profile. Effect: on a built-in profile the app makes a custom profile itself, named *Copy of Primavera P6* (or of the profile you started from), with all current values. The field *Name of this custom profile* names it; without a name, *Apply* refuses it. Where: the block *Conventions of this profile*.

**Save as template**, **Update template from this project**, **Update from template** and **Delete template** — manage your custom profiles as a template. Effect: a template is a saved profile that you can choose in any project; the project keeps its own copy. If the profile of the project differs from its template, it says *This profile differs from the template “…”.* Templates are not in the project file. Where: below the drop-down, with a custom profile.

## Conventions per profile

A convention is a rule in which planning packages differ. Every convention is on or off. The block shows a tick box per convention, the base value (*base: on* or *base: off*) and, if you deviate, the button *back to base* and a badge *changed: 2* on the group. With the arrow before a line you open its explanation. The default per convention is what the chosen built-in profile says. *Open Planner Studio* has every convention off. Under each convention below is what *Primavera P6* and *Microsoft Project* do.

### Progress and completed work

**Keep actual dates in the backward pass** — When calculating backward, a started task keeps its recorded start as its late start, and a completed task keeps its actual dates as its late dates. As a result a completed successor does not pull an open predecessor back into the past. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**In-progress task: early start = start of remaining work** — The early and late start of a task in progress point to where the remaining work begins (the later of the status date and the relation boundary), not to the actual start. When calculating backward over a start-to-start relation, only the remaining duration of a predecessor in progress counts. Conditions: Is the basis of the option *Calculate SS lag from an in-progress predecessor from* and of the convention *Elapsed SS lag from an in-progress predecessor does not count*. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Completed physical-progress task sits at the data date** — A completed task sits as a single point at the status date, or later if a predecessor requires it, instead of at its actual dates. Conditions: Only for tasks from a P6 file with the percent-complete type *physical*, with an actual finish on or before the status date. For other percent-complete types, including the P6 default duration, this has not been measured and the app does not apply it. Requires *In-progress task: early start = start of remaining work*. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Planned start is not a floor for a task in progress** — The planned start from the file is not a floor for a task in progress (with an actual start and less than 100%): its remaining work begins at the status date, right after its predecessors, even if its planned start is later. This is the counterpart of *Planned start as an extra floor*. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Progress Override ignores a started successor on the late side too** — The relation from an uncompleted predecessor to a successor that has already started and is not finished does not count on the late side or in the free float of that predecessor: the successor therefore puts no pressure back and is not a driving relation. Conditions: Only with the progress mode *Progress Override*. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

### Relationships and lag

**Successor starts on the finish boundary** — A finish-to-start relation without lag that the P6 file marks as "on the finish boundary" lets the successor begin right at the finish of the predecessor instead of at the start of the next working block. Calculating backward, the successor simply shows its late start as the start of a block. Conditions: Only for relations the file marks this way; the mark is absent when you create a relation yourself. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Backward lag from a finish boundary** — When the app subtracts a working-time lag from the exact finish boundary of a working block while calculating backward and lands exactly on the start of a block, it becomes the finish boundary of the previous block. Also with a finish-to-finish relation without lag, a late finish on a block end stays on that boundary. Conditions: Only on an hour calendar. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Elapsed lag of a completed predecessor does not count** — Of a positive working-time lag after a completed predecessor only the part that has not yet elapsed at the status date counts: the lag minus the working time between the actual finish and the status date, never less than 0. Conditions: Works on the late side and, forward, only from completed predecessors with a status-date point or window (see *Completed physical-progress task sits at the data date* and *Completed out-of-sequence task waits for its predecessors*); a completed task that simply sits at its actual dates keeps the full lag. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Elapsed SS lag from an in-progress predecessor does not count** — With a start-to-start relation with a positive working-time lag from a predecessor in progress, only the part of the lag that has not yet elapsed counts: the lag minus the working time between the actual start and the status date, at least 0. Forward that counts from the start of the predecessor's remaining work; calculating backward, the late start of the predecessor is the late start of the successor minus that remaining lag. Conditions: Requires *In-progress task: early start = start of remaining work*. The option *Calculate SS lag from an in-progress predecessor from* chooses the starting point. Lags of 0 or less, lags in clock hours and finish-to-start relations stay as usual. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Early finish not before a finish-to-finish boundary** — With a finish-to-finish relation, the early finish of the successor is never before the finish of the predecessor plus the lag. If that boundary falls outside the working time of the successor, the early finish becomes the first working boundary on or after it; the start stays. Conditions: Only on an hour calendar and with working-time lags; not with a hard finish constraint or a hammock. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

### Milestones and LOE activities

**Milestone follows the planned calendar boundary** — A milestone without duration stays on the calendar boundary that the file planned: a milestone that stood at the start of a day stays a start milestone, and a milestone that stood at the end of a working block may land on the finish of the predecessor. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Unstarted LOE uses the target window** — An LOE activity that has not started (a hammock in the app) with a complete target window takes that target window as its span. Conditions: Only on an hour calendar, and only if the activity comes from a P6 file with only start-to-start incoming and finish-to-finish outgoing relations without lag. The evidence for this rule is weak: one file. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Finish-to-finish relationship to a start milestone binds to the milestone itself** — A finish-to-finish relation to a start milestone (zero duration, kind *Start*) binds to the late finish of that milestone itself, instead of to the start of the milestone day. The free float of the predecessor then no longer becomes a working day shorter. The early start of the milestone never changes. Conditions: Only on an hour calendar; a finish milestone stays unchanged. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

### Float and late dates

**Free float never negative** — With a late constraint that cannot be met, the total float stays negative, but the free float becomes 0 instead of negative. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Free float in the task's own calendar** — The free float of an unstarted task counts per relation in the task's own calendar, not in that of the successor. That holds for finish-to-start, start-to-start and finish-to-finish. A lag only counts if the lag calendar is *Predecessor*; a lag of 0 always counts. A started, uncompleted task only follows this with finish-to-start without lag. Conditions: Only on an hour calendar. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Late finish on the task's own calendar** — If a successor imposes a late finish that falls outside the working time of the task, the late finish becomes the end of the previous working period on the task's own calendar. A tighter constraint or deadline wins. This is the late-side counterpart of *Free float in the task's own calendar*. Conditions: Only on an hour calendar and not for the project finish. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**ALAP tasks as late as the successors allow** — An unstarted task with the constraint *As late as possible (ALAP)* gets as its early finish the strictest boundary that its successors allow with their early dates, to the minute, and as its early start that finish minus its duration. The successors go first, so a chain of ALAP tasks joins up. Its own planned window does not count; the floor is its predecessors and the status date. Conditions: Only on an hour calendar; on a day calendar the usual step in whole working days stays. That ALAP tasks wait for their successors holds in every profile; this convention adds the minute-precise placement. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

### Dates and moments from the file

**Planned start as an extra floor** — The planned start from the file counts as an extra floor next to the network, but only if both start and finish are more than one calendar day later than the network allows. An ordinary start at the next working block does not trigger the rule. Conditions: It does not apply to a task in progress; see *Planned start is not a floor for a task in progress*. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Keep actual dates exact** — Recorded actual start and finish dates, with their time of day, stay exact and are not moved to the edge of a working block. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

**Exact constraint moment on a milestone** — A constraint with date and time (SNLT, MSO, FNLT or MFO) on a milestone without duration is an exact point, even if that point is the start of a working block. Default: on under Primavera P6, off under Microsoft Project and Open Planner Studio.

### Progress as in Microsoft Project

**Remaining work resumes after the elapsed duration** — A task in progress resumes its remaining work not at the later of the status date and the predecessor boundary (as P6 does with Retained Logic), but at the actual start plus the duration that has already elapsed. That is an extra floor that can only move the remaining work later. Default: on under Microsoft Project, off under Primavera P6 and Open Planner Studio.

**Don't move unstarted tasks to the status date** — A task without progress does not shift by itself to on or after the status date. Off applies the floor that P6 does have with Retained Logic. Default: on under Microsoft Project, off under Primavera P6 and Open Planner Studio.

### Custom profiles only

These conventions are off in every built-in profile, including Primavera P6. Turning one on makes it a custom profile.

**Finish milestone as a boundary window** — A finish milestone may stand on two adjacent calendar boundaries: the early start at the start of a working block and the early finish at the end of the previous block. Conditions: Only seen in P3 output; no effect on files calculated by P6. Default: off in every built-in profile.

**Completed task in the data-date window** — A completed task gets the status-date window as its early dates, and that window counts towards the project finish and the float. Conditions: Only for tasks from a P6 file; requires *In-progress task: early start = start of remaining work*. Only seen in P3 output. Default: off in every built-in profile.

**Completed LOE via its actual finish** — A completed LOE activity with only a start-to-start incoming relation and no successor follows the route via its actual finish instead of the usual hammock route. Conditions: Only for tasks from a P6 file; requires *In-progress task: early start = start of remaining work*, *Keep actual dates in the backward pass* and *Keep actual dates exact*. Only seen in P3 output. Default: off in every built-in profile.

**Completed predecessor does not hold past the data date** — If a completed predecessor ends after the status date according to its actual finish, finish-to-start and finish-to-finish relations calculate from the boundary of the status-date window instead of from that actual finish. Start-to-start relations stay on the actual start. Conditions: Only on an hour calendar and with a status date. Default: off in every built-in profile.

**Completed out-of-sequence task waits for its predecessors** — A completed task of which a predecessor is not yet finished (out of sequence) gets its zero-remaining window not at the status date but at the later of the status date and the ordinary relation boundary of that predecessor. Conditions: Works on the status-date route of *Completed task in the data-date window*. Not with *Progress Override*. Default: off in every built-in profile.

## Calculation options of this project

These options are under *Calculation options of this project*, below the conventions. The button *Apply this profile's default options* resets the editable options to the default of the chosen profile; what it does with the source options is under *Settings from the source file*. Defaults per profile: *Open Planner Studio* has no values of its own, so every option is at its default below; *Microsoft Project* only sets *Float calculation* to *Smallest (start/finish)*; *Primavera P6* sets *Lag calendar* to *Predecessor*, *Critical definition* to *Total float ≤ threshold* with a threshold of 0 hours, *Float calculation* to *Finish float*, *Open-ended tasks critical* off and *Calculate SS lag from an in-progress predecessor from* to *Early start (remaining start)*. A `.xer` file also brings values from the file itself.

**Critical definition** — what makes a task critical. Choose from *Total float ≤ threshold* and *Longest path*. Default: *Total float ≤ threshold* with threshold 0. Effect: with *Total float ≤ threshold* a task is critical if its total float is less than or equal to the threshold. With *Longest path* a task is critical if it lies on the chain that leads to the last finish; with several end tasks with the same finish, all their chains count. Float then plays no part. In both cases a completed task is never critical, and neither is a hammock. It applies to the Gantt, the table, the milestone overview and the reports. Where: *Calculation options of this project*.

**Threshold (work days)** — the limit for *Total float ≤ threshold*. Default: 0. Effect: the threshold may be negative. A threshold from a P6 file, or one set by the default of *Primavera P6* (0 hours), is in hours and is then called *Threshold (hours, per task calendar)*: the app compares it per task in the hours of that task's calendar. Where: *Calculation options of this project*, next to *Critical definition*.

**Float calculation** — which float the total float is. Choose from *Automatic (default)*, *Smallest (start/finish)*, *Start float* and *Finish float*. Default: *Automatic (default)*; *Microsoft Project* sets *Smallest (start/finish)* and *Primavera P6* *Finish float*. Effect: *Start float* is late start minus early start, *Finish float* is late finish minus early finish, *Smallest (start/finish)* is the smaller of the two. *Automatic (default)* uses the finish float for a task in progress (with an actual start or progress, and a status date) and the smallest for all other tasks. Where: *Calculation options of this project*.

**Open-ended tasks critical** — a task without a successor. Default: off. Effect: on gives such a task total and free float 0, so that under the critical definition *Total float ≤ threshold* it becomes critical (unless it is completed). Off calculates the float as usual up to the end of the project. Where: *Calculation options of this project*.

**Mark near-critical** — marks tasks with almost no float. Default: off. Effect: on gives a threshold, by default 2 work days (the field *Threshold*). A task with more than 0 and at most that threshold of total float is called *Near critical*; a task with exactly 0 float is critical and does not count. You see it in the table column *Near critical* and in the reports. The field shows work days. With *Enable hour planning* on it shows hours if the duration display is *Always hours*, or *Automatic* on an hour calendar. Where: *Calculation options of this project*.

**Multiple float paths** — numbers chains of tasks by their float. Default: off. Effect: on gives tasks a number in the table column *Float path*. Off leaves the column empty. Where: *Calculation options of this project*.

**Method** — how the paths arise, with *Multiple float paths*. Choose from *Free float (peeling)* and *Total float (ranking)*. Default: *Free float (peeling)*. Effect: with *Free float (peeling)* the app peels off chains. It picks the task with the last finish and adds its driving predecessors: that is path 1. From the remaining tasks it does the same for path 2, and so on; a shared predecessor keeps the number of the first path in which it occurs. With *Total float (ranking)* the number is the rank of the task's total float: 1 for the smallest, 2 for the next smallest value. Hammocks do not take part. Where: *Calculation options of this project*.

**Max. paths** — how many paths get a number. Default: 10. Effect: tasks outside the first *Max. paths* paths or ranks get no number. Where: *Calculation options of this project*, with *Multiple float paths*.

**Lag calendar** — in which calendar a lag in working time counts. Choose from *Predecessor*, *Successor*, *24-hour* and *Project calendar*. Default: *Predecessor*. Effect: a lag of 2 days counts in the working days of the calendar you choose. Where: *Calculation options of this project*. See [Relations and lag](docs://uitleg-relaties).

**Calculate SS lag from an in-progress predecessor from** — the variant of the convention *Elapsed SS lag from an in-progress predecessor does not count*. Choose from *Early start (remaining start)* and *Actual start (data date)*. Default: *Early start (remaining start)*. Effect: for a start-to-start relation with a positive working-time lag from a predecessor in progress, the successor with *Early start (remaining start)* starts at the start of the predecessor's remaining work plus the remaining lag. With *Actual start (data date)* it starts at the data date plus the remaining lag, and the relation does not bound the predecessor in progress backward. The remaining lag is the lag minus the working time between the actual start and the data date, never less than 0. A lag of 0 or less, a lag in clock hours and a schedule in days keep the normal behaviour. The choice only works when the conventions *Elapsed SS lag from an in-progress predecessor does not count* and *In-progress task: early start = start of remaining work* are both on; otherwise the drop-down is disabled and it says *Only applies when the convention “…” is on.* Where: *Calculation options of this project*.

### Settings from the source file

These options come from a Primavera P6 file (`.xer`) and are read-only. The block *Settings from the source file* only appears if the project carries them. They count in the calculation. *Use expected finish dates (P6: Use Expected Finish Dates)* and *Completed task: late dates from the data date* are also set by the default of *Primavera P6*: with *New project* or via *Apply this profile's default options*. *Apply this profile's default options* leaves *Calculate float up to the project finish date* as it is. The other two the button sets to the default of the profile: under *Primavera P6* on, even if the file said off; under *Microsoft Project* and *Open Planner Studio* they disappear.

**Use expected finish dates (P6: Use Expected Finish Dates)** — Default under P6: on. Effect: a P6 task in progress with an expected finish date gets that date as its early finish. Where: *Settings from the source file*.

**Calculate float up to the project finish date** — Default: off. Effect: the finish date of the project is the anchor for the late dates. Without a finish date in the file the app calculates up to the end of the network. Where: *Settings from the source file*.

**Completed task: late dates from the data date** — Default under P6: on. Effect: a completed task also gets zero remaining duration on the data date on the late side, with a meaningful float. It only works together with the convention *Completed task in the data-date window*, which is off in every built-in profile; if that is off, it says *Only works together with the convention “…”, which is currently off.* Where: *Settings from the source file*.

## See also

- [Calculation profiles and conventions](docs://uitleg-rekenprofielen): why P6 and MS Project calculate differently and how a profile works.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): why an imported schedule can show other dates than your package.
- [Critical path and float](docs://uitleg-kritiek-pad): what critical, total and free float mean.
- [Relations and lag](docs://uitleg-relaties): lag and the calendar in which it counts.
- [Progress, status date and baseline](docs://uitleg-voortgang): the status date that many conventions refer to.
- [Import and export formats](docs://ref-import-exportformaten): which profile a file gets when it is opened.
