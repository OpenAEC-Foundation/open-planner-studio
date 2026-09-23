# Calculation profiles

Open Planner Studio schedules with one engine, but Primavera P6 and Microsoft Project make a different choice in a handful of places. A **calculation profile** bundles those choices. Every project has exactly one profile; you see and change it under **File → Project info → Calculation profile and options**.

## What you'll learn here

- What a calculation profile is and which three built-in profiles exist.
- Which profile an opened file gets, and why you see a notification about it.
- How to switch profiles and what then happens to your schedule.
- How to make a custom profile and keep it as a template.
- What the twenty-four conventions do.
- When a combination has no reference package.

## What a calculation profile is

A profile is a set of twenty-four **conventions**: rules that belong to a scheduling package, such as "an unstarted task does not move to the status date by itself". In addition, every project has **calculation options** that differ per file, such as the lag calendar, the critical definition and the float calculation. Those options belong to the project; the profile only supplies their defaults for a new project.

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

Some values came from the file itself, such as the P6 setting for the start of remaining work. Those stay in place with every switch, also when you choose a custom profile or a template. That is why the list can show "Primavera P6 (modified)": that is not a custom profile, but the built-in profile with values from your file.

When you switch between the built-in profiles, all deviations stay exactly as they are, including one that happens to equal the default of the new profile. So Primavera P6 → Open Planner Studio → Primavera P6 gives back exactly the profile you started with.

The project's calculation options do not change when you switch. If you want the default options of the new profile, click **Apply this profile's default options**.

Take care when switching a project that does not come from P6 to Primavera P6: the convention *Planned start as an extra floor* makes a task's planned start a floor as soon as it lies more than one calendar day later than the network allows.

## Making a custom profile

Turn a convention on or off in the section. If the profile is built in, Open Planner Studio automatically makes a custom copy of it, for example "Copy of Primavera P6". You can change that name. When you choose a template for a project from a `.xer` file, the project keeps the value from the file for the start of remaining work; that does not count as a difference from the template.

With **Save as template** you keep the custom profile in the app, so you can choose it in other projects. A project always keeps its own copy of its profile: changing a template later does not change any existing project. When a project's profile differs from its template, you see that in a coloured block, with the buttons **Update from template** and **Update template from this project**. **Delete template** removes the template from the app again; the project keeps its own copy.

## The twenty-four conventions

Under Open Planner Studio all twenty-four are off.

- **Keep actual dates in the backward pass** (Primavera P6) — a started or completed task keeps its recorded dates on the late side too.
- **Free float never negative** (Primavera P6) — with an unachievable late constraint, total float stays negative but free float becomes zero.
- **Milestone follows the planned calendar boundary** (Primavera P6) — a zero-duration milestone stays on the calendar boundary the file planned.
- **Planned start as an extra floor** (Primavera P6) — see the warning above.
- **Finish milestone as a boundary window** (Primavera P6) — a finish milestone may sit on two adjacent calendar boundaries.
- **Keep actual dates exact** (Primavera P6) — recorded actual dates are not moved to a working-time band.
- **In-progress task: early start = start of remaining work** (per file from Primavera P6) — the early start of an in-progress task is where the remaining work begins.
- **Exact constraint moment on a milestone** (Primavera P6) — a date-and-time constraint on a milestone is an exact point.
- **Remaining work resumes after the elapsed duration** (Microsoft Project) — an in-progress task resumes at the actual start plus the elapsed duration.
- **Don't move unstarted tasks to the status date** (Microsoft Project) — a task that has not started does not move to the status date by itself.
- **Successor starts on the finish boundary** (Primavera P6) — for relations the file marks this way.
- **Backward lag from a finish boundary** (Primavera P6) — a lag that lands exactly on a band start lands on the previous finish boundary.
- **Completed task in the data-date window** (Primavera P6) — only for tasks with P6 provenance.
- **Completed LOE via its actual finish** (Primavera P6) — only for tasks with P6 provenance.
- **Unstarted LOE uses the target window** (Primavera P6) — only for tasks with P6 provenance.
- **Free float in the task's own calendar** (Primavera P6) — the free float of an open task over a finish-to-start relationship without lag counts in the task's own calendar. If the successor is already complete while the task is still open, that float is zero.
- **Elapsed lag of a completed predecessor does not count** (Primavera P6) — only the part of the lag after a completed task that has not yet elapsed at the data date counts. This applies on the late side, and also going forward: when a completed task sits at the data date (or directly after a predecessor that is not finished yet), its successor starts after the rest of the lag. Turning it off makes 640 dates and floats that are exact today wrong in the measured Primavera P6 files, and 56 that already deviate deviate further.
- **Completed physical-progress task sits at the data date** (Primavera P6) — a completed task with physical percent complete is not shown at its actual dates, but as a single point at the data date, or later if a predecessor that is still in progress or has not started requires it. Its successors calculate from that point.
- **Elapsed SS lag from an in-progress predecessor does not count** (Primavera P6) — for a start-to-start relationship from a task that has already started, only the part of the lag that has not yet elapsed since its actual start at the data date counts. If the lag has already elapsed, the successor may start as soon as the remaining work of the predecessor starts.
- **Finish-to-finish relationship to a start milestone binds to the milestone itself** (Primavera P6) — with a finish-to-finish relationship to a start milestone, the predecessor may run up to the milestone itself, not only up to the start of the milestone's day. That changes the predecessor's late dates and float. A finish milestone does not change.
- **Planned start is not a floor for a task in progress** (Primavera P6) — the remaining work of a started task begins at the data date and right after its predecessors, even if its planned start is later. Its successors move with it. For a task that has not started, the planned start remains a floor (*Planned start as an extra floor*).
- **Late finish on the task's own calendar** (Primavera P6) — if a successor imposes a late finish that falls outside the task's own working time (usually because that successor uses another calendar), the late finish becomes the end of the previous work period on the task's own calendar. Example: a task does not work on Fridays and its successor must start on Friday at 16:00; its late finish is then Thursday 17:00.

### Off by default in every profile

Two conventions are off in every built-in profile, including Primavera P6. They were derived from a file that was not calculated by P6 (output of the older Primavera P3) and change nothing in the files that were demonstrably calculated by P6. To use them anyway, turn them on in a custom profile.

- **Completed predecessor does not hold past the data date** (off by default) — if a completed task's actual finish lies after the data date, its successors may still start at the data date. The completed task's own dates do not change.
- **Completed out-of-sequence task waits for its predecessors** (off by default) — if a task is already completed while a predecessor is still in progress or has not started, it is placed right after that predecessor instead of at the data date, and its successors move with it. This does not apply under the P6 setting Progress Override.

## Combinations without a reference package

Some of the P6 conventions only act on tasks with P6 provenance, that is, from a `.xer` file. If you choose Primavera P6 for your own project, an `.mpp` file or a P6 XML file, those rules do not switch on. A `.xer` project under the Microsoft Project profile is likewise a combination for which no reference package exists. Such combinations calculate consistently, but there is no package to check the result against.

## Saving and exchanging

The profile is saved in the IFC file, with all twenty-four values, so the file calculates the same everywhere. A project with the default profile saves nothing extra. Older versions of Open Planner Studio do not know the profile: they only read the calculation options and the two progress conventions of Microsoft Project, and calculate a P6 project without P6 conventions.

When you export to CSV, MS Project XML or P6 XML, the profile does not come along; those files open as Open Planner Studio again. For a project from a `.xer` file, the export reports that XER source information is lost; the calculation profile is part of that, but the notification does not name it separately.

## Further reading

- [Opening Primavera P6 (.xer)](docs://gids-xer-import)
- [Opening MS Project (.mpp)](docs://gids-msproject-import)
- [Import/export](docs://gids-import-export)
