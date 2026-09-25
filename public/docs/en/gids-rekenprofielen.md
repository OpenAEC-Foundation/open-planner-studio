# Calculation profiles

Open Planner Studio schedules with one engine, but Primavera P6 and Microsoft Project make a different choice in a handful of places. A **calculation profile** bundles those choices. Every project has exactly one profile; you see and change it under **File → Project info → Calculation profile and options**.

## What you'll learn here

- What a calculation profile is and which three built-in profiles exist.
- Which profile an opened file gets, and why you see a notification about it.
- How to switch profiles and what then happens to your schedule.
- How to make a custom profile and keep it as a template.
- What the twenty-seven conventions do.
- When a combination has no reference package.

## What a calculation profile is

A profile is a set of twenty-seven **conventions**: rules that belong to a scheduling package, such as "an unstarted task does not move to the status date by itself". In addition, every project has **calculation options** that differ per file, such as the lag calendar, the critical definition and the float calculation. Those options belong to the project; the profile only supplies their defaults for a new project.

The three built-in profiles:

- **Open Planner Studio** — the default for new projects, CSV files and IFC files from other programs. Calculates the way Open Planner Studio always has.
- **Primavera P6** — the conventions of P6. A `.xer` file opens with this profile.
- **Microsoft Project** — the progress conventions of MS Project. An `.mpp` file opens with this profile.

## Which profile does an opened file get?

- `.xer` (Primavera P6): **Primavera P6**. The calculation options from the file become the project's calculation options.
- `.mpp` (Microsoft Project): **Microsoft Project**.
- MS Project XML and P6 XML: **Open Planner Studio** in this version. There is no reference measurement for these formats yet; an automatic choice would move dates without proof that the result is right.
- CSV, a new project and IFC from another program: **Open Planner Studio**.
- Your own IFC file: the profile saved in it.
- An IFC file from an older version of Open Planner Studio, without a saved profile: the profile follows from the saved calculation options. A project that was opened from a `.xer` file gets **Primavera P6** this way, one opened from an `.mpp` file **Microsoft Project**, everything else **Open Planner Studio**.

When you open a `.xer` or `.mpp` file, you see one notification, for example "This project calculates as Primavera P6". The button in that notification opens Project info. For a `.xer` file that line is part of the normal opening notification, also when the file contains several projects. Reopening your own IFC file or recovering after a crash shows no such notification: the profile was already there, and you chose or saw it yourself.

## Switching profiles

Choose another profile in **Project info** and click **Apply**. The schedule is recalculated right away, also when *Calculate automatically* is off. If tasks move as a result, a notification tells you how many; if nothing moves, there is no notification. The count covers ordinary tasks, not summary tasks (those follow the tasks below them). A switch is one step in *Undo*.

As long as you have changed something but not applied it yet, a coloured *Changes not applied* block stays in view at the bottom, with **Discard** next to **Apply**. If you then go to another section, click **Back**, or press Escape or F1, the app first asks whether you want to apply the changes, discard them or stay; switching to another project (Ctrl+1–9, Ctrl+N, Ctrl+O) only works once you have applied or discarded them. If the window is too narrow to show notifications next to that question, they stay dimmed behind the dialog and come back as soon as you have made a choice.

When you switch between the built-in profiles, all deviations stay exactly as they are, including one that happens to equal the default of the new profile. So Primavera P6 → Open Planner Studio → Primavera P6 gives back exactly the profile you started with, and the schedule: the calculated dates are the same as before the switch, also after **Calculate** and after saving and reopening.

The project's calculation options do not change when you switch. If you want the default options of the new profile, click **Apply this profile's default options**.

Take care when switching a project that does not come from P6 to Primavera P6: the convention *Planned start as an extra floor* makes a task's planned start a floor as soon as it lies more than one calendar day later than the network allows.

The columns *Scheduled start* and *Scheduled finish* are input, not a calculation result: the calculated dates are in *Early start* and *Early finish*. A calculation or a profile switch therefore does not change them, and some Primavera P6 conventions read them as the planned window from the file. For a task in hours that has not started yet, *Scheduled finish* does move along when you change the duration, the start or the task's own calendar, or when the work rule changes the duration after different units, different work, or adding or removing a resource: it then becomes the start plus the duration on the task's own calendar. A finish changed in the same edit wins. The finish is not re-derived when the project calendar or calendar exceptions change, when the task's calendar is deleted (the task then runs on the project calendar), for a split without a duration change, after levelling, when the whole project is moved, or for `.mpp` tasks that run on a resource calendar; it follows at the next edit of the task. For a started task, a manually scheduled task, a summary task, a hammock and a P6 task with its own planned window from the `.xer` file it stays as it is.

## Making a custom profile

Turn a convention on or off in the section. If the profile is built in, Open Planner Studio automatically makes a custom copy of it, for example "Copy of Primavera P6". You can change that name.

With **Save as template** you keep the custom profile in the app, so you can choose it in other projects. A project always keeps its own copy of its profile: changing a template later does not change any existing project. When a project's profile differs from its template, you see that in a coloured block, with the buttons **Update from template** and **Update template from this project**. **Delete template** removes the template from the app again; the project keeps its own copy.

## The twenty-seven conventions

Under Open Planner Studio all twenty-seven are off. In Project info they are grouped by topic, as below. Behind each line, the value of the chosen base profile is shown in grey ("base: on" or "base: off"). If your project differs from it, the line is highlighted and **back to base** restores the profile's value. The arrow in front of a line expands its explanation.

If the difference is on a built-in profile, the profile stays the built-in profile after **back to base**; no copy is made.

### Progress and completed work

- **Keep actual dates in the backward pass** (Primavera P6) — a started or completed task keeps its recorded dates on the late side too.
- **In-progress task: early start = start of remaining work** (Primavera P6) — the early start of an in-progress task is where the remaining work begins. Calculating backward over a start-to-start relationship, only its remaining duration counts: without remaining work, late start and late finish coincide. In every measured file calculated by Primavera P6, an in-progress task starts this way. Up to September 2026, Open Planner Studio took this rule per `.xer` file from a project setting (`rem_target_link_flag`); that link was never tested and is no longer read. Whether a P6 project with a different value of that setting calculates differently is not known.
- **Completed physical-progress task sits at the data date** (Primavera P6) — a completed task with physical percent complete is not shown at its actual dates, but as a single point at the data date, or later if a predecessor that is still in progress or has not started requires it. Its successors calculate from that point, and the free float of a predecessor that is not finished counts up to that point. Caveat: measured only on physical percent complete; for completed tasks with duration (the P6 default) or units percent complete it has not been measured, so those keep their actual dates.
- **Planned start is not a floor for a task in progress** (Primavera P6) — the remaining work of a started task begins at the data date and right after its predecessors, even if its planned start is later. Its successors move with it. For a task that has not started, the planned start remains a floor (*Planned start as an extra floor*).
- **Progress Override ignores a started successor on the late side too** (Primavera P6) — only when the project uses the progress setting *Progress Override*. If a successor has already started while its predecessor is still in progress, the schedule already ignores that relationship when calculating forward. With this convention it also does not count in the predecessor's late dates and free float. Without it, the predecessor can get negative float, while Primavera P6 gives it float up to its other successors.

### Relationships and lag

- **Successor starts on the finish boundary** (Primavera P6) — for relations the file marks this way. Calculating backward, the successor shows its late start simply as the start of a work band.
- **Backward lag from a finish boundary** (Primavera P6) — a lag that lands exactly on a band start lands on the previous finish boundary. With a finish-to-finish relationship without lag, a late finish on a band end also stays on that finish boundary.
- **Elapsed lag of a completed predecessor does not count** (Primavera P6) — only the part of the lag after a completed task that has not yet elapsed at the data date counts. This applies on the late side, and also going forward: when a completed task sits at the data date (or directly after a predecessor that is not finished yet), its successor starts after the rest of the lag. Turning it off makes 640 dates and floats that are exact today wrong in the measured Primavera P6 files, and 56 that already deviate deviate further.
- **Elapsed SS lag from an in-progress predecessor does not count** (Primavera P6) — for a start-to-start relationship from a task that has already started, only the part of the lag that has not yet elapsed since its actual start at the data date counts. If the lag has already elapsed, the successor may start as soon as the remaining work of the predecessor starts. Where the remaining lag is counted from is chosen with the calculation option **Calculate SS lag from an in-progress predecessor from**: *Early start* (the P6 default: the start of the predecessor's remaining work) or *Actual start* (the data date, even when the predecessor's remaining work starts later). A `.xer` file takes that choice from the P6 setting *Calculate Start-to-Start lag from*. With this convention off, the option has no effect.
- **Early finish not before a finish-to-finish boundary** (Primavera P6) — with a finish-to-finish relationship, the successor may only finish once the predecessor has finished. If that moment falls in the successor's non-working time, Open Planner Studio without this convention shows the end of the work period before it (the same working time, but too early on the clock). With the convention, the early finish becomes the start of the next work period, as in Primavera P6. The free float over such a relationship then counts up to the successor's early finish.

### Milestones and LOE activities

- **Milestone follows the planned calendar boundary** (Primavera P6) — a zero-duration milestone stays on the calendar boundary the file planned.
- **Unstarted LOE uses the target window** (Primavera P6) — only for tasks with P6 provenance.
- **Finish-to-finish relationship to a start milestone binds to the milestone itself** (Primavera P6) — with a finish-to-finish relationship to a start milestone, the predecessor may run up to the milestone itself, not only up to the start of the milestone's day. That changes the predecessor's late dates and float. A finish milestone does not change.

### Float and late dates

- **Free float never negative** (Primavera P6) — with an unachievable late constraint, total float stays negative but free float becomes zero.
- **Free float in the task's own calendar** (Primavera P6) — the free float of a not-started task counts per relationship in the task's own calendar, not in the successor's. This holds for finish-to-start, start-to-start and finish-to-finish, also with a working-time lag, as long as that lag runs on the predecessor's calendar. A started task counts this way only over a finish-to-start relationship without lag. Example: a task works until 17:00, its successor (start-to-start with lag) until 16:00. If the relationship boundary falls at 16:00, the successor only starts the next morning and the task has one hour of free float. Start-to-finish relationships, elapsed-time lags, percentage lags and lags on another lag calendar have not been measured and keep the ordinary calculation.
- **Late finish on the task's own calendar** (Primavera P6) — if a successor imposes a late finish that falls outside the task's own working time (usually because that successor uses another calendar), the late finish becomes the end of the previous work period on the task's own calendar. Example: a task does not work on Fridays and its successor must start on Friday at 16:00; its late finish is then Thursday 17:00.
- **ALAP tasks as late as the successors allow** (Primavera P6) — without this convention, an unstarted task with the *as late as possible* constraint moves by whole working days along its free float, and does not start before its own planned start. With the convention it finishes at the minute its successors need it, and a chain of such tasks closes up, as in Primavera P6. Its own planned start then does not count: a task without a predecessor starts no earlier than the status date. A second constraint on the same task still applies: with *finish on or before* it does not move past that date, with *start on or after* it does not start earlier. Three limits were chosen deliberately from measurements, not taken from the P6 documentation: the rule only applies to tasks on a calendar with hours, only to tasks that have not started, and a task without a predecessor counts from the status date. A started or completed task, or a task on a daily calendar, therefore keeps the old behaviour; for a task on a daily calendar there is no example calculated by P6 to measure against.

### Dates and moments from the file

- **Planned start as an extra floor** (Primavera P6) — see the warning above.
- **Keep actual dates exact** (Primavera P6) — recorded actual dates are not moved to a working-time band.
- **Exact constraint moment on a milestone** (Primavera P6) — a date-and-time constraint on a milestone is an exact point.

### Progress as in Microsoft Project

- **Remaining work resumes after the elapsed duration** (Microsoft Project) — an in-progress task resumes at the actual start plus the elapsed duration.
- **Don't move unstarted tasks to the status date** (Microsoft Project) — a task that has not started does not move to the status date by itself.

### Custom profiles only

Five conventions are off in every built-in profile, including Primavera P6. They were derived from a file that was not calculated by P6 (output of the older Primavera P3) and change nothing in the files that were demonstrably calculated by P6. To use them anyway, turn them on in a custom profile.

- **Completed predecessor does not hold past the data date** (off by default) — if a completed task's actual finish lies after the data date, its successors may still start at the data date. The completed task's own dates do not change.
- **Completed out-of-sequence task waits for its predecessors** (off by default) — if a task is already completed while a predecessor is still in progress or has not started, it is placed right after that predecessor instead of at the data date, and its successors move with it. This does not apply under the P6 setting Progress Override.
- **Finish milestone as a boundary window** (off by default) — a finish milestone may sit on two adjacent calendar boundaries.
- **Completed task in the data-date window** (off by default) — only for tasks with P6 provenance.
- **Completed LOE via its actual finish** (off by default) — only for tasks with P6 provenance.

Files from Primavera P6 also carry a project setting that takes the late dates of a completed task from the remaining window. It only works together with **Completed task in the data-date window**, so under the built-in Primavera P6 profile it has no effect. If you turn that convention on in a custom profile, the setting counts again.

## Settings from the source file

A project from a `.xer` file carries three calculation options that only come from Primavera P6: *Use expected finish dates*, *Calculate float up to the project finish date* and *Completed task: late dates from the data date*. They are used in the calculation, but you cannot change them. They are shown read-only in a blue block at the bottom, so you can see why two projects with the same profile may calculate differently. The last one only works together with the convention *Completed task in the data-date window*; if that is off, the block says so.

## Combinations without a reference package

Some of the P6 conventions only act on tasks with P6 provenance, that is, from a `.xer` file. If you choose Primavera P6 for your own project, an `.mpp` file or a P6 XML file, those rules do not switch on. A `.xer` project under the Microsoft Project profile is likewise a combination for which no reference package exists. Such combinations calculate consistently, but there is no package to check the result against.

## Saving and exchanging

The profile is saved in the IFC file, with all twenty-seven values, so the file calculates the same everywhere. A project with the default profile saves nothing extra. Older versions of Open Planner Studio do not know the profile: they only read the calculation options and the two progress conventions of Microsoft Project, and calculate a P6 project without P6 conventions.

When you export to CSV, MS Project XML or P6 XML, the profile does not come along; those files open as Open Planner Studio again. For a project from a `.xer` file, the export reports that XER source information is lost; the calculation profile is part of that, but the notification does not name it separately.

## Further reading

- [Opening Primavera P6 (.xer)](docs://gids-xer-import)
- [Opening MS Project (.mpp)](docs://gids-msproject-import)
- [Import/export](docs://gids-import-export)
