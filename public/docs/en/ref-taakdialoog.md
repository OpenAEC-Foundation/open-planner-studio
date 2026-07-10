# Task dialog

The **Edit task** window shows all properties of one task — the same fields and sections as the properties panel on the right, but in a window with an explicit save step.

## Opening

- **Double-click** a task in the Gantt.
- **F2** with a task selected.
- **Right-click** a task → **Edit...**

## Saving and cancelling

- **Save** applies all field changes at once; the button is disabled while the name is empty. **Enter** does the same as Save (except inside a multi-line text box).
- **Cancel**, **Esc**, the close cross or a click outside the window closes without applying the field changes.
- Exception: the **Dependencies**, **Assignments** and **Codes & fields** sections work directly on the schedule (identical to the panel) — changes there take effect immediately, even if you cancel afterwards.

## Fields

- **Name *** — required; automatically receives focus when the dialog opens.
- **WBS Code** — free entry. With WBS auto-numbering on (Planning → Structure) the field is locked: the app manages the codes.
- **Description** — free text.
- **Type** — the task type (for example Construction); drives the bar colour coding.
- **Calendar** — **Project calendar** or a specific calendar from the library; determines this task's working days.
- **Parent task** — move the task under a different parent, or **- None (root) -**. This field only exists in the dialog; in the panel, restructuring is done by dragging or indent/outdent.

## Notes

A checklist per task: each row has a **done checkbox**, a text box and a remove button; **Add note** creates a new row. Completed rows are struck through. See [Planning & WBS](docs://gids-plannen-wbs).

## Milestone

- **Milestone** — ticking it sets the duration to 0 and shows the diamond instead of a bar.
- **Milestone kind** — **Automatic**, **Start milestone** or **Finish milestone**.
- **Mandatory (contractual)** — marks the milestone as contractual.

## Time

- **Start date** — shows the computed early start; a manual change anchors the new date as the planned start.
- **Duration (work days)** — whole work days; disabled for a milestone.
- With **hour planning enabled** and an hour calendar on the task, three synchronised boxes appear: **Days**, **Hours** and **Total hours** (whole numbers only). Without an hour calendar a hint shows: "Hour input requires an hour calendar (working times)." See [Calendars & hour planning](docs://gids-kalenders-uren).

## Hammock (derived duration)

Only on a task without subtasks that is not a milestone. Ticking it makes the duration derived: the span between the **Start driver** (incoming FS/SS relation) and the **Finish driver** (incoming FF/SF relation), both shown read-only. If a finish driver is missing, the dialog reports that the span falls back to zero length. See [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse).

## Constraint and deadline

- **Constraint** — As soon as possible (ASAP), As late as possible (ALAP), Start no earlier than (SNET), Start no later than (SNLT), Finish no earlier than (FNET), Finish no later than (FNLT), Must start on (MSO) or Must finish on (MFO); with a **Constraint date** where applicable.
- **Mandatory (pin logic)** — MSO/MFO only: hard-pins the date and overrides the relationship logic; a violation becomes negative float upstream.
- **Secondary constraint** — a second bound (SNET/FNET/SNLT/FNLT) with a **Secondary date**; not possible with a hard pin. Forbidden combinations turn red with a reason.
- **Deadline** — a target date outside the calculation; missing it gives a warning, not a shift. See [Relations & constraints](docs://gids-relaties-constraints).

## Progress

- **Progress (%)** — slider 0–100%.
- **Actual start** / **Actual finish** — recorded facts; for a milestone a single **Actual date** field. Dates after the status date are rejected.
- **Remaining (work days)** — read-only, derived from duration × (1 − progress). See [Baselines & progress](docs://gids-baselines-voortgang).

## CPM Result (read-only)

**Early start/finish**, **Late start/finish**, **Total float**, **Free float**, **Interfering float** (when computed) and **Critical path** (yes/no). Filled after a calculation (F5).

## Dependencies

All relations of this task: direction (→ successor, ← predecessor), the other task, a lightning icon on the **driving relationship**, the relation type (FS/SS/FF/SF), the **lag** (e.g. 2d, 3ed, 50%) and a remove button. Changes take effect immediately.

## Assignments

Per assigned resource: name, **Units/day**, **Curve**, **Move to…** (move the assignment to another task) and remove; at the bottom **Assign resource**. Not possible on milestones or summary tasks. Takes effect immediately. See [Resources, histogram & leveling](docs://gids-resources-histogram).

## Codes & fields

Only visible when the project has activity code types or custom fields: a value picker per code type, a typed input per custom field. Takes effect immediately. Definitions are managed in the structure dialog — see [Codes & fields](docs://ref-codes-velden).
