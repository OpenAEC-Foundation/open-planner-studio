# Table columns

The task table has 86 fixed columns, plus one column per activity code and custom field of the project and eight columns per baseline. This article says for each column what it shows, whether you can edit it and in what form the value is written. How to choose and arrange columns is in [Customizing table columns](docs://howto-tabelkolommen-aanpassen).

## Where you choose columns

The task table next to the Gantt and the table on the *Table* tab each have their own column choice. The plus at the right of the header opens the column picker (window title *Choose column*); on *Table* you can also use *Table › Columns › Columns…*. The picker lists the columns per category: *Task*, *Planning*, *Constraints*, *Relations*, *Resources*, *Progress*, *Calculated*, *Baseline*, *Custom* and *Technical*. You search by name, and *Recently used* is at the top. *Reset to default* restores the default columns.

By default the table next to the Gantt shows *WBS*, *Task name* and *Duration*. The table on the *Table* tab shows *WBS*, *Task name*, *Duration*, *Start*, *Finish*, *Task type*, *Critical*, *Total float* and *Progress*, plus a column per activity code and custom field of the project.

## How values are read and edited

- **Calculated columns** — the columns in the category *Calculated* and a number of others are read-only: they come from the calculation. If you try to edit a read-only cell, the app says *This calculated column cannot be edited.* That text is the general message for every read-only cell, also when the column is not calculated. If they are out of date because you changed something, *outdated* appears next to them until you press *Calculate*.
- **Dates** — appear in the notation you chose under *Settings*, tab *View*, heading *Date format*.
- **Durations and float** — a duration appears in the unit of the task (`5d`, `12h`), or according to *Duration display* on the same tab (*Automatic (native unit per task)*, *Always days* or *Always hours*). Float appears in working days with two decimals and the decimal separator of your language.
- **Yes/No** — a yes/no value appears as *Yes* or *No*; an empty value as a dash (—).
- **Editing** — type or choose a value. An invalid value is refused with a reason under the cell, for example *Enter a valid duration, such as 5d or 8h.* or *Enter a percentage between 0 and 100.* Pasting a block of cells works cell by cell; read-only cells are skipped and the app reports how many.

## Task

- **Task name** — the name of the task. Editable; required.
- **Description** — the description. Editable; free text.
- **WBS** — the WBS code. Editable and required, but read-only while *WBS auto* is on.
- **Task type** — the task type (*Construction*, *Installation*, *Demolition*, *Logistics*, *Inspection*, *Relocation*, *Renovation*, *Maintenance* or *Other*). Editable with a list.
- **Custom task type** — the custom task type from the project, or a dash. Editable with a list of the project's custom types.
- **Colour** — the stored colour of the task, as a colour code such as `#1a73e8`. Editable with a colour picker. It is stored in the IFC file, but no bar or report uses it; you set bar colours under *View › Baselines & progress › Bar colors*.
- **Notes** — the notes as `✓ text; ○ text`. Editable as long as there is at most one note (you then edit its text); with more notes read-only.

## Planning

- **Milestone** — whether the task is a milestone. Editable. Turning it on makes the duration 0; the app refuses it for a summary task and for a task with assignments.
- **Milestone type** — *Start milestone* or *Finish milestone*, or a dash for automatic. Only editable on a milestone.
- **Mandatory milestone** — the flag *Mandatory (contractual)*. Only editable on a milestone.
- **Leveling priority** — a whole number from 0 to 1000, default 500. Editable. 1000 pins the task for leveling.
- **Split gaps** — the number of breaks, as `Split gaps: 2`, or a dash. Read-only; you edit them in the *Properties* panel.
- **Work rule** — the work rule of the task; empty is the project default. Editable with a list, but empty and read-only on a milestone, summary task or hammock. Only visible in the picker when the work rules are visible (*Show work rules and work*, or the file carries work rules).
- **Hammock (derived duration)** — whether the task is a hammock. Editable, except on a milestone or summary task.
- **Calendar** — the id of the task's own calendar; empty (—) is the project calendar. You type or pick an id from the suggestions; an unknown id is refused. Note: the cell currently shows the internal id instead of the name; better pick a calendar in the *Properties* panel.
- **Duration type** — *Work time* (the duration counts in working days or working hours of the calendar) or *Elapsed time* (the duration counts in continuous clock time, without a calendar). Editable.
- **Duration unit** — *Days* or *Hours*. Editable except on a summary task, hammock or milestone; switching only works if the conversion is exact and *Enable hour planning* is on.
- **Duration** — the duration of the task, in the unit of the task or according to *Duration display*. Editable: type `5d`, `12h` or `1h 30m`; also a number in the unit of the task. Read-only on a summary task, a hammock and a milestone with duration 0.
- **Start** — the displayed start, the same date as the Gantt bar. Editable. A task with a predecessor that you give a new start gets the constraint *Start no earlier than (SNET)* on that date. Read-only on a summary task or hammock, unless manually scheduled.
- **Finish** — the displayed finish. Editable: a new finish becomes a new duration. The app refuses it for a completed task, a milestone, a task in elapsed time and a task with breaks, and for a finish before the start (*The finish lies before the start.*). Read-only on a summary task or hammock, unless manually scheduled.
- **Scheduled start** — the scheduling anchor the calculation starts from (not necessarily the displayed start). Editable; same effect as typing in *Start*.
- **Scheduled finish** — the entered finish. Only editable on a manually scheduled task; otherwise the app says *Scheduled finish only applies to a manually scheduled task. Change the finish through the Finish column or the duration.*

## Constraints

- **Constraint type** — the type of the constraint, from *As soon as possible (ASAP)* to *Must finish on (MFO)*. Editable; a task without a constraint shows *ASAP*.
- **Constraint date** — the date of the constraint. Editable.
- **Hard constraint** — the flag *Mandatory (pin logic)*. Only editable on *MSO* and *MFO*.
- **Secondary constraint type** — the type of the second bound, or a dash. Editable; the table offers all types, but a combination that is not allowed is refused: it must be *SNET*, *FNET*, *SNLT* or *FNLT*, the primary constraint must be a bound (not *ASAP*, *ALAP*, *MSO*, *MFO* or a hard constraint) and the two must bound opposite sides (a lower bound *SNET*/*FNET* with an upper bound *SNLT*/*FNLT*, or the other way round).
- **Secondary constraint date** — the date of the second bound. Editable.
- **Deadline** — the target date for the finish. Editable.

## Relations

- **Predecessors** — the predecessors, as `WBS type±lag`, separated by `; `, for example `1.2 FS+2d`. Editable by typing the same form. You do not add an external relation here but with *Planning › Relations › Link › Add external relation…*.
- **Successors** — the successors, in the same form. Editable.
- **Driving** — the relations that determine the date of this task, as `← 1.2` (predecessor) or `→ 1.4` (successor). Read-only; outdated until *Calculate*.
- **Free float** (in the category *Relations*) — the free float per relation, as `← 1.2: 3d`. Not the same column as *Free float* under *Calculated*, which shows the float of the task itself. Read-only.
- **Warnings** — warnings per relation, for example *Out of sequence* or *Not included in the calculation*. Read-only. See [Notifications and warnings](docs://ref-meldingen).

## Resources

- **Assigned resources** — the names of the assigned resources, separated by commas. Editable: adding a name assigns the resource with 1 unit per day, removing a name removes the assignment. Read-only on a milestone or summary task.
- **Assignment units per day** — the units per resource, as `Name: 1; Name: 0.5`. Editable on a task with assignments.
- **Assignment curve** — the curve per resource, as `Name: Uniform`. Editable on a task with assignments.
- **Work window start** and **Work window finish** — the work window per resource, from an imported file, as `Name: date`. Read-only.
- **Planned work (hours)** and **Actual work (hours)** — the planned and actual work per resource in hours, as `Name: 12`, from an imported file. Read-only.
- **Remaining work (hours)** — the remaining work per resource in hours, as `Name: 6`: the stored work, otherwise remaining duration × units. Editable on a task with assignments on which a work rule applies. Only visible in the picker when the work rules are visible.

## Progress

- **Status** — *Not started*, *In progress* or *Completed*. Editable, except on a summary task.
- **Progress** — the percentage, as `40%`. Editable with a number from 0 to 100, except on a summary task.
- **Actual start** — the date the task began. Editable, except on a summary task.
- **Actual finish** — the date the task was done. Editable, except on a summary task.
- **Actual duration** — the actual duration, as a number. Editable, except on a summary task.
- **Remaining** — the remaining duration, in the unit of the task. Editable, except on a summary task.
- **Resume date** and **Stop date** — the resume and the stop of a running task from an MS Project or Primavera file. Read-only.

The progress columns follow the progress rules of the app: an actual date after the status date is refused. On a summary task the app says *The progress of a summary task is derived from its subtasks and cannot be changed here.*

## Calculated

All columns in this category are read-only.

- **Leveling delay** — how many working days leveling delayed the task; a dash if no leveling has been applied.
- **Early start** and **Early finish** — the earliest dates from the calculation.
- **Late start** and **Late finish** — the latest dates on which the task may still begin or end without delaying the project.
- **Free float** — the working days the task can slip without delaying a successor.
- **Total float** — the working days the task can slip without delaying the project finish. Negative if a constraint or deadline cannot be met.
- **Critical** — *Yes* if the task is on the critical path.
- **Interfering float** — total float minus free float.
- **Near critical** — *Yes* for a near-critical task. Only filled if *Mark near-critical* is on (*Project info*, block *Calculation profile and options*); otherwise a dash.
- **Float path** — the number of the float path, 1 for the most critical. Only filled if *Multiple float paths* is on; otherwise a dash.
- **Recorded-dates source** — for a file with recorded dates: *Deviates* or *Partly unrecorded*. Only visible in the picker for such a file. On an unrecorded axis, *Not recorded* appears in the late-date and float columns.

See [Critical path and float](docs://uitleg-kritiek-pad).

## Baseline

For each baseline of the project, columns are added, with the name of the baseline in front of the column name (`<baseline> — Scheduled start`). They are read-only. A task that is not in the baseline shows a dash with the tooltip *Not present in this baseline*.

- **Scheduled start**, **Scheduled finish** and **Duration** — the start, the finish and the duration as the baseline recorded them.
- **Start variance** and **Finish variance** — the number of working days between the baseline and the displayed start or finish, in the calendar of the project; positive if the task is later.
- **Duration variance** — the current duration minus the duration in the baseline, in working days.

## Custom

- **Activity code** — one column per activity code, with the name of the code. Shows the code of the chosen value. Editable: you type the code or pick it from the suggestions; an unknown code is refused, and if a code occurs more than once the app asks you to choose it from the list.
- **Custom field** — one column per custom field, with its name. The input fits the type: text, number, integer, cost, date or yes/no. Editable.

These columns belong to the project the code or field is in. See [Codes and custom fields](docs://howto-codes-en-velden).

## Technical

All columns in this category are read-only. They show data the app stores but does not show in an ordinary column, for example for checking an import.

- **Task ID** — the internal id of the task.
- **Parent task ID** and **Child task IDs** — the ids of the parent and child tasks.
- **Resource IDs** — the ids of the resources on the task.
- **Assignment ID**, **Assignment task ID** and **Assignment resource ID** — the ids of the assignments, tasks and resources of this task.
- **Duration (minutes)** and **Remaining (minutes)** — the duration and remaining duration in minutes; only filled on a task in hours.
- **Leveling delay (minutes)** and **Elapsed leveling delay** — the leveling delay from MS Project in minutes, and whether it counts in clock time.
- **Manually scheduled** — whether the task is manually scheduled.
- **MS Project task type (import)** and **Effort driven** — the task type and the effort-driven flag as MS Project had them.
- **Primavera P6 provenance** — the source fields from a Primavera file, as `key: value`.
- **Explicit summary task** — whether the task is an explicit summary without subtasks (from a Primavera file).
- **Timephased finish floor**, **Timephased start anchor**, **Timephased duration segments** and **Timephased contours** — the hour distribution from an MS Project file, as dates and counts.
- **Activity code data**, **Custom field data** and **Note data** — the number of code assignments, custom fields and notes.
- **Internal relationship data** and **External relationship data** — the number of internal and external relations.
- Of each baseline, **Milestone** and **Milestone type** are also here, as the baseline recorded them.
