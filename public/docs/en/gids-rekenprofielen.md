# Calculation profiles

Open Planner Studio schedules with one engine, but Primavera P6 and Microsoft Project make a different choice in a handful of places. A **calculation profile** bundles those choices. Every project has exactly one profile; you see and change it under **File → Project info → Calculation profile and options**.

## What you'll learn here

- What a calculation profile is and which three built-in profiles exist.
- Which profile an opened file gets, and why you see a notification about it.
- How to switch profiles and what then happens to your schedule.
- How to make a custom profile and keep it as a template.
- What the seventeen conventions do.
- When a combination has no reference package.

## What a calculation profile is

A profile is a set of seventeen **conventions**: rules that belong to a scheduling package, such as "an unstarted task does not move to the status date by itself". In addition, every project has **calculation options** that differ per file, such as the lag calendar, the critical definition and the float calculation. Those options belong to the project; the profile only supplies their defaults for a new project.

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

When a file opens with a profile other than Open Planner Studio, you see one notification, for example "This project calculates as Primavera P6". The button in that notification opens Project info. For a `.xer` file that line is part of the normal opening notification, also when the file contains several projects.

## Switching profiles

Choose another profile in **Project info** and click **Apply**. The schedule is recalculated right away, also when *Calculate automatically* is off, and a notification tells you how many tasks moved as a result. A switch is one step in *Undo*.

Some values came from the file itself, such as the P6 setting for the start of remaining work. Those stay in place with every switch, also when you choose a custom profile or a template. That is why the list can show "Primavera P6 (modified)": that is not a custom profile, but the built-in profile with values from your file.

When you switch between the built-in profiles, all deviations stay exactly as they are, including one that happens to equal the default of the new profile. So Primavera P6 → Open Planner Studio → Primavera P6 gives back exactly the profile you started with.

The project's calculation options do not change when you switch. If you want the default options of the new profile, click **Apply this profile's default options**.

Take care when switching a project that does not come from P6 to Primavera P6: the convention *Planned start as an extra floor* makes a task's planned start a floor as soon as it lies more than one calendar day later than the network allows.

## Making a custom profile

Turn a convention on or off in the section. If the profile is built in, Open Planner Studio automatically makes a custom copy of it, for example "Copy of Primavera P6". You can change that name. When you choose a template for a project from a `.xer` file, the project keeps the value from the file for the start of remaining work; that does not count as a difference from the template.

With **Save as template** you keep the custom profile in the app, so you can choose it in other projects. A project always keeps its own copy of its profile: changing a template later does not change any existing project. When a project's profile differs from its template, you see that in a coloured block, with the buttons **Update from template** and **Update template from this project**.

## The seventeen conventions

Under Open Planner Studio all seventeen are off.

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
- **Completed predecessor does not hold past the data date** (Primavera P6) — if a completed task's actual finish lies after the data date, its successors may still start at the data date. The completed task's own dates do not change.
- **Free float in the task's own calendar** (Primavera P6) — the free float of an open task over a finish-to-start relationship without lag counts in the task's own calendar. If the successor is already complete while the task is still open, that float is zero.

## Combinations without a reference package

Some of the P6 conventions only act on tasks with P6 provenance, that is, from a `.xer` file. If you choose Primavera P6 for your own project, an `.mpp` file or a P6 XML file, those rules do not switch on. A `.xer` project under the Microsoft Project profile is likewise a combination for which no reference package exists. Such combinations calculate consistently, but there is no package to check the result against.

## Saving and exchanging

The profile is saved in the IFC file, with all seventeen values, so the file calculates the same everywhere. A project with the default profile saves nothing extra. Older versions of Open Planner Studio do not know the profile: they only read the calculation options and the two progress conventions of Microsoft Project, and calculate a P6 project without P6 conventions.

When you export to CSV, MS Project XML or P6 XML, the profile does not come along; those files open as Open Planner Studio again. For a project from a `.xer` file, the export reports that loss.

## Further reading

- [Opening Primavera P6 (.xer)](docs://gids-xer-import)
- [Opening MS Project (.mpp)](docs://gids-msproject-import)
- [Import/export](docs://gids-import-export)
