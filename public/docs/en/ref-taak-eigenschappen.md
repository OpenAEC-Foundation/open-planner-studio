# Task dialog and properties panel

You can edit a task in two places: in the *Edit task* window and in the *Properties* panel. They share almost all fields. This article says for each field what it does, what the default is and what you notice of it. How to create and set up a task is in [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen); why the calculation comes out where it does is in [Critical path and float](docs://uitleg-kritiek-pad).

## The two places

- **Edit task** — the window for the first selected task. Open it with F2, by double-clicking a bar in the Gantt, or by right-clicking a task in the Gantt or the table and choosing *Edit...*. Your changes stay in a draft until you click *Save* (Enter); *Cancel* (Esc) throws them away. *Save* is disabled while the name is empty. Saving is one step under *Undo*, including what you did in the sections *Work rule*, *Dependencies*, *Assignments* and *Codes & fields*: those already act on the project while you edit, and *Cancel* reverses them.
- **Properties** — the panel in the right-hand column, for the active task. Every change takes effect at once; consecutive changes to the same field count as one step under *Undo*. Without a task it says *Select a task to view properties.* Turn it on or off with *View › Panels › Properties*. Default: on. The panel sits next to the Gantt and on the *Table* tab, not on *IFC* and *Report* and not under the full resource panel.

Only in the window: *Parent task* and the buttons *Save* and *Cancel*. Only in the panel: the bin *Delete task*, the button *Calculate* at the bottom, the *Breaks* section, the three markers under *Work rule* (long non-working period, MS Project, recorded dates) and adding relations and jumping to a linked task in *Dependencies*. All other fields are in both places. The window shows *Dependencies*, *Assignments* and *Codes & fields* only for an existing task.

If you changed something that touches the dates, press *Calculate*. Calculating does not happen by itself unless *Calculate automatically* is on.

## General

- **Name** (in the window *Name \**) — the name of the task in the Gantt, the table and the reports. Required: an empty name is not kept. Default for a new task: *New task*.
- **WBS Code** — the structure code of the task, for example `RB-301`. Required. With *Planning › Structure › WBS auto* the field is disabled (tooltip: *WBS codes are numbered automatically (Planning → Structure)*), because the app then owns the codes.
- **Description** — free text. No effect on the calculation; you can show it as the column *Description* in the table.
- **Type** — the task type. The list has the groups *Built-in types* (*Construction*, *Installation*, *Demolition*, *Logistics*, *Inspection*, *Relocation*, *Renovation*, *Maintenance*), *My task types* and *From this project*. *Other* only appears if the task already has that type. At the bottom are *+ New task type…* and *Manage task types…*. Default: the type of the parent task, otherwise *Construction* (Construction mode on, the default) or *Other*. Effect: no effect on the calculation; you can group and filter on it and colour the bars by it. The app keeps a custom type on your device; when you choose it, a copy goes into the project (*From this project*).
- **Calendar** — the calendar in which the task counts its duration, finish date and float. Default: *Project calendar: {name}*. Effect: a task on its own calendar works on different days than the project calendar. After a change, *Calculate* recalculates the dates. See [Calendars and working days](docs://uitleg-kalenders).
- **Parent task** (only in the window) — moves the task under another task. Default: the current parent; *- None (root) -* puts it at the top level. A choice that would create a cycle in the relations is refused on *Save* with a message and the window stays open.

## Notes

- **Notes** — a checklist on the task. *Add note* adds a line; the tick (*Done*) crosses it out; the bin (*Remove*) deletes it. Without lines it says *No notes yet.* No effect on the calculation; the column *Notes* in the table shows them with ✓ or ○ in front.

## Milestone

- **Milestone** — makes the task a milestone. Default: off. Effect: the duration becomes 0. The app refuses it for a summary task (a task with subtasks) and for a task with resource assignments, with a message; remove the assignments first. If you untick it again, *Milestone kind* and *Mandatory (contractual)* disappear.
- **Milestone kind** (only for a milestone) — *Automatic*, *Start milestone* or *Finish milestone*. Default: *Automatic*. Effect: a start milestone sits at the beginning of a day, a finish milestone at the end. With *Automatic* the milestone counts as a start milestone when it is a predecessor, at the beginning of the day.
- **Mandatory (contractual)** (only for a milestone) — marks a contractual milestone, such as an inspection or handover. Default: off. Effect: a marker for the Gantt and reports; it does not guard a date. You do that with a constraint or deadline.

## Time

- **Start** (in the window *Start date*) — shows the calculated start, the same date as the Gantt bar and the column *Start*, not the raw planning anchor. Required: an empty field falls back. Effect of typing: the new date becomes the planned anchor (column *Scheduled start*). If the task has a predecessor and has not started yet, the app records the new start as a constraint *Start no earlier than (SNET)* on that date (or moves an existing SNET), with a message; after *Calculate* the task therefore does not start earlier. If there is a constraint other than *ASAP* or *SNET*, the app does not apply the start and says which constraint determines the start.
- **Duration** — how long the task works. Type `5d` for days, or `12h` or `1h 30m` for hours. A number without a unit counts in the unit of the task. Days are always whole; hours may have a decimal. An invalid entry gives *Enter a whole number of days or hours, for example 2d or 12h.* and the field jumps back. Default for a new task: 5 days (a milestone 0). The field is disabled for a summary task, a hammock and a milestone with duration 0: their duration follows from other tasks or is zero. A task in hours is disabled while *Enable hour planning* is off; there is a button with that name. Effect: after *Calculate* the duration determines the finish in the task's calendar. If the task has resources and a work rule, the rule decides whether work or units move along. If the task is already partly done, the app refuses a duration shorter than the work done. See [Days and hours](docs://uitleg-dagen-en-uren).
- **Duration unit** — a choice of *Days* or *Hours*, with an info button next to it. Only visible when *Enable hour planning* and *Allow mixed day/hour planning* are on (the latter is on by default when hour planning is on). Effect: the app only converts if the result is exact, and then makes a proposal (*Apply proposal* or *Retain*). If it does not fit exactly, the unit stays and the app says so. A calendar without valid working times refuses the switch.
- **Work rule** — which corner of duration × units = work stays fixed when one of the three changes. Choices: *Project default (Fixed duration and units)*, *Fixed duration and units*, *Fixed duration and work*, *Fixed work* and *Fixed units*. Default: the project default. Below it is what the rule protects (*Protected: …*) and, for a task from MS Project, *From MS Project: effort-driven* or *From MS Project: not effort-driven*. Only visible when *Show work rules and work* is on (*Settings*, tab *Planning*, heading *Calculation*) or the file itself carries work rules or stored work, and only for an ordinary task: not a summary task, milestone, hammock or task in elapsed time. See [Work rules: duration, units and work](docs://uitleg-werkregels).

## Hammock

- **Hammock (derived duration)** — lets the duration follow from two other tasks instead of having one of its own. Default: off. Only for an ordinary task, so not for a milestone or summary task. On: *Start driver* shows the predecessors with a Finish-Start or Start-Start relation, *Finish driver* those with a Finish-Finish or Start-Finish relation, each with the relation type after it. If you have no finish driver, it says *No finish driver (FF/SF) — the span falls back to zero length.* and the duration is zero. See [Making a hammock](docs://howto-hammock).

## Constraint and deadline

On a summary task a constraint or deadline has no effect: the calculation only calculates leaf tasks and derives the dates of a summary task from its subtasks.

- **Constraint** — a date limit for the task. Choices: *As soon as possible (ASAP)*, *As late as possible (ALAP)*, *Start no earlier than (SNET)*, *Start no later than (SNLT)*, *Finish no earlier than (FNET)*, *Finish no later than (FNLT)*, *Must start on (MSO)* and *Must finish on (MFO)*. Default: *ASAP*, which is no constraint. Choose ASAP and all constraints of the task disappear; choose ALAP and the secondary one disappears. Effect after *Calculate*: a limit moves the task or makes the float negative. See [Constraints and deadlines](docs://uitleg-constraints).
- **Constraint date** — the date belonging to the constraint. Visible for every constraint except *ALAP*. Required; a new constraint gets the planned start as its date.
- **Mandatory (pin logic)** — only for *MSO* and *MFO*. Default: off. On: the date is hard, overrides the relations and pins the bar even before its predecessors. A violation becomes negative float upstream. The first time you turn it on, an explanation appears once.
- **Secondary constraint** and **Secondary date** — a second limit, only one of *SNET*, *FNET*, *SNLT* or *FNLT* (or *(none)*). Visible as soon as there is a primary constraint that is not ASAP, ALAP or a hard pin. Always soft. A forbidden combination gets a red border and a reason: a secondary constraint may not be hard, not with MSO/MFO or a hard pin, not with ASAP/ALAP, must be a bound, and primary and secondary may not bound the same side. A valid pair is, for example, SNET with FNLT.
- **Deadline** — a target date for the finish. Empty = no deadline. Effect: the task does not move because of it. If the early finish is later, the float becomes negative and the app reports *Deadline … missed — early finish …*.

## Progress

- **Progress (%)** — a slider from 0 to 100. Default: 0. Effect: above 0 the app fills in a missing *Actual start*, and 100 fills in the *Actual finish*. The status follows: *Not started* without an actual start, *In progress* with an actual start and *Completed* with an actual finish. The remaining duration (*Remaining*) is the duration × (1 − progress), rounded to whole days for a task in days and to whole minutes for a task in hours. Work done is measured up to the status date; if there is no status date yet, the app sets it to today and says so. For a summary task the field is disabled: its progress follows from its subtasks after *Calculate* (*Derived from the subtasks: change progress there. The summary task follows after calculating (F5).*).
- **Actual start** — the date the task really began. A date after the actual finish or after the status date is refused. If the task is planned to start only after the status date and now gets progress, the window asks *Enter the actual start*. For a milestone there is one field *Actual date* instead of *Actual start* and *Actual finish*.
- **Actual finish** — the date the task was really done. Filling it in sets progress to 100 and the status to *Completed*; clearing it sets progress back to 0 and the status to *In progress*. Same refusals as *Actual start*.
- **Remaining** — read-only (not for a milestone): how much duration is left, in the unit of the task.

The window applies these rules to the draft; they only count after *Save*. See [Progress, status date and baseline](docs://uitleg-voortgang).

## CPM Result

- **CPM Result** — read-only view of the last calculation: *Early start*, *Early finish*, *Late start*, *Late finish*, *Total float*, *Free float*, *Interfering float* and *Critical path* (*Yes* or *No*). Float is in working days with two decimals. Out of date or not calculated yet? Press *Calculate*.

## Dependencies

- **Dependencies** — the relations of this task, one line per relation: the linked task (in the panel the WBS code, or the name if that is missing; in the window the name), a lightning icon if the relation is driving (*Driving relationship*, after a calculation), the relation type (*FS*, *SS*, *FF* or *SF*), the lag and a bin. In the panel the WBS code is a button: pointing at it shows the task, clicking jumps to it. In the window it is plain text and you only see the section if the task has relations.
- **Lag** — type a number with a unit: `2d` working days, `3ed` calendar days, `2u` or `2h` working hours, `3eu` or `3eh` calendar hours, `50%` a percentage of the predecessor's duration, `-25e%` a percentage in calendar time. A minus makes it a lead. Without a unit it counts as working days. An invalid entry turns the field red and falls back. See [Relations and lag](docs://uitleg-relaties).
- **Add relation** (only in the panel) — opens a draft row. Under *Direction* choose *Predecessor* or *Successor*, find the task with *Search task…* by WBS or name, choose the type and the lag, and confirm with *Create relation* (or *Cancel*). A duplicate or a relation with the task's own parent is refused with a message and the row stays.

## Breaks

Only in the panel, and not for a milestone, summary task, hammock, task in elapsed time, manually scheduled task or a task that is too short for a break.

- **Breaks** — pauses in the work of the task. One line per pause: *after* (how much work before the pause), *pause* (the length) and the unit (*work days*, for a task in hours *hours*), with from–to of the piece after it below. A pause made by leveling carries the badge *leveling*. A pause of length 0 removes it; the bin per line (*Remove break*) removes it too. Effect: the bar is drawn interrupted and after *Calculate* the finish moves by the pause.
- **Add break** — adds a pause of one unit in the middle of the longest piece. Disabled when there is no room for a pause.
- **Remove all breaks** — appears when the breaks come from a source file in a form that cannot be edited here (*These breaks come from the source file in a form that cannot be edited here.*). Then you only see the dates.

See [Splitting a task](docs://howto-taak-splitsen).

## Assignments

- **Assignments** — the resources on this task. Per resource: the name with a bin (*Remove*), *Units/day*, *Work (rem.)*, *Curve*, a button *Hour distribution…* and *Move to…*. At the bottom is a list *Assign resource*; it assigns the resource with 1 unit per day. Without resources it says *Create resources first (Resources tab).*; when all are assigned, *All resources are already assigned.* For a milestone or summary task it says that assigning is not possible.
- **Units/day** — how much of the resource the task uses per day, a number above 0. Effect: the load in the histogram and the overallocation, and with a work rule the work.
- **Work (rem.)** — remaining work in hours for this resource. Only visible when the work rules are visible and the task has one; for material there is a dash. The lock shows which corner the work rule protects (*Protected by the work rule …*). The warning triangle (*Differs from units × duration*) means the stored work is not equal to units × remaining duration; the histogram then follows the stored work.
- **Curve** — how the work is spread over the duration: *Uniform*, *Front loaded*, *Back loaded*, *Bell shaped*, *Early peak*, *Late peak*, *Double peak* or *Turtle*. Default: *Uniform*. If the assignment has its own hour distribution, it says *Contour* and the list is disabled; an imported curve is called *Imported curve*.
- **Hour distribution…** — opens the hour distribution per working day of this assignment. See [Adjusting the hour distribution](docs://howto-urenverdeling-aanpassen).
- **Move to…** — moves the assignment to another leaf task that does not have the resource yet. Only visible when such a task exists.

## Codes & fields

- **Codes & fields** — only visible when the project has activity codes or custom fields. Each activity code is a list with *(none)* and the values as `code — description`; per type you choose at most one value. Each custom field has an input that fits its type: *Text*, *Number*, *Integer*, *Cost*, *Date* or *Yes/no*. Effect: no effect on the calculation; you can group and filter on them and show them as columns. See [Codes and custom fields](docs://howto-codes-en-velden).

## Markers under the work rule

Only in the panel, and only when they apply.

- **Long non-working period** — *This task runs through a …-day non-working period (… to …).*, or with the name of the holiday or construction break added. Appears when the task runs through a continuous period of 8 days or more that contains at least one holiday. It is a warning, not a refusal; check whether the schedule is meant that way.
- **MS Project marker** — a badge *Follows the hour distribution from MS Project*, *MS Project date window no longer applied after editing — …* or *Own hour distribution*, with *Read more*. It says whether the hour distribution from an MS Project file still drives the dates.
- **Recorded dates** — a badge for an imported file with recorded dates: *Shows the dates as recorded in the file for this task* (for a Primavera file *Shows Primavera’s own recorded dates for this task*), *Deviates from the recorded dates* or *Recorded data is partly incomplete — see the late/float columns*, with *Read more*. See [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

## Head and foot of the panel

- **Delete task** — the bin next to the heading *Task*; deletes this task together with its subtasks, as one step under *Undo*. The schedule is out of date afterwards until you press *Calculate*.
- **Calculate** — the button at the bottom; the same calculation as *Home › Schedule › Calculate*.

## What you do not find here

- **Leveling priority** — is not in the window or the panel. You set it by right-clicking and choosing *Priority* (*Low* = 100, *Normal* = 500, *High* = 900) or by typing a number from 0 to 1000 in the column *Leveling priority*. Default: 500. Effect: leveling keeps tasks with a higher priority in place first; 1000 pins the task, so that leveling never moves it. See [Leveling](docs://uitleg-nivelleren).
- **Other task data** — the rest of what a task carries, such as the columns *Manually scheduled*, *Colour* and the technical columns, is only in the table; see [Table columns](docs://ref-tabelkolommen).
