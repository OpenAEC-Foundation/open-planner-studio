# Choosing columns

The **Table** (the **Table** tab) and the task list next to the Gantt each have their own columns. You change them in the table itself: the plus in the table header opens the column chooser, and in a column header you move, resize, pin or remove a column. Every change applies immediately; there is no OK step.

By default the task list next to the Gantt shows **WBS**, **Task name** and **Duration**. The Table also shows **Start**, **Finish**, **Task type**, **Critical**, **Total float** and **Progress**, plus the project's activity codes and custom fields.

## Opening the column chooser

- The plus at the right of the table header. The Table and the task list next to the Gantt each have their own plus, which only changes its own table.
- The **Table** tab → **Columns…** opens the column chooser of the Table.
- When the classic view buttons are switched on (**Settings** → **Advanced** tab → **Legacy features** → **Show classic view buttons**), **View** → ribbon group **Display** → **Columns…** does the same: the button goes to the Table tab and opens the column chooser there.

**Esc**, a click outside the chooser or another click on the plus closes the chooser.

## Adding a column

The **Choose column** chooser contains, from top to bottom:

- **Recently used** — fields you recently added with the chooser. This block appears as soon as you have added a column.
- The **Search** field — type part of a field name; the **Search results** come from all groups.
- The fields per group: **Task**, **Planning**, **Constraints**, **Relations**, **Resources**, **Progress**, **Calculated**, **Baseline**, **Custom** and **Technical**. Clicking a group expands it; the number next to it is the number of fields in that group.
- At the bottom the **Reset to default** button (see below).

Click a field to add it as the last column; the chooser then closes. A field that is already a column is ticked and cannot be chosen again. The project's activity codes and custom fields are under **Custom**, the fields of your baselines under **Baseline**.

Under **Calculated** you find, among others, the analysis fields **Free float**, **Interfering float**, **Near critical** and **Float path**. They only get values after a calculation (**F5**), and **Near critical** and **Float path** only when the matching scheduling option is on — see [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse).

## Changing columns in the column header

- **Move** — drag a column header to another position. Pinned columns stay together at the front; an unpinned column only moves among the unpinned columns.
- **Width** — drag the right edge of a column header (40 to 480 pixels). A double-click on that edge fits the column to its header and longest value. With the keyboard: put the focus on the edge and use the left and right arrow keys, with **Shift** for bigger steps.
- **Remove** — the minus sign that appears in the column header when you move the pointer over it. The field stays available in the column chooser.
- **Right-click** a column header for **Pin** (or **Unpin**), **Auto fit** and **Remove**. A pinned column moves to the front, next to the other pinned columns, and stays in view when you scroll the table sideways (as long as the pinned columns fit in the table together).

## Start, Finish and the scheduled dates

**Start** and **Finish** (in the default layout of the Table) show the same dates as the bar in the Gantt: the calculated schedule, and before the first calculation the entered dates. Type a different date in Start and it becomes the scheduled start. A different Finish changes the duration of an automatically scheduled task; for a manually scheduled task it becomes the scheduled finish. Then press **F5** to recalculate. Typing the same date back changes nothing.

The fields **Scheduled start** and **Scheduled finish** show the entered dates themselves, even when the calculation moves the task. Scheduled finish can only be edited for a manually scheduled task: for other tasks the start and duration determine the finish. Start and Finish of an automatically scheduled summary task follow from its subtasks and cannot be edited.

## Reset to default

**Reset to default** sits at the bottom of the column chooser. One click puts the columns of that table back to the default layout: which columns are shown, their order and width, and pinned columns. Extra added fields leave the table and stay available in the chooser. This is also how you get a new default after an update, for example **Start** and **Finish** instead of **Scheduled start** and **Scheduled finish**: a layout of your own that was saved earlier does not change by itself. When the table already uses the default, the button is disabled.

## Saving, undo and layouts

The column layout is a personal preference on this device: it applies to all your projects and is not stored in the project file. Every column action — adding, removing, moving, resizing, pinning or **Reset to default** — is one step that **Ctrl+Z** undoes.

A layout can also store the columns. It takes the column layout of the table you see when you create the layout, and a click on the layout button puts it into the table that is in view at that moment: on the Table tab the Table, on the other tabs the task list next to the Gantt. See [Saving and loading layouts](docs://ref-layouts).

## Further reading

- [Filters](docs://ref-filters) — which tasks the table and the Gantt show.
