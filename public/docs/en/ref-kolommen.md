# Choosing columns

The **Columns** window controls which columns the Table tab shows, in which order and how wide. (The task table to the left of the Gantt has fixed columns: WBS, Task Name and Duration.)

## Opening

The plus at the right of the table header, or the **Table** tab → **Columns…**. (The **View** → ribbon group **Display** → **Columns…** button belongs to the classic view buttons — see the Layouts guide.) Every change is applied immediately — there is no separate OK step; **Close**, **Esc**, the close cross or a click outside the window closes it.

## Chosen columns

One row per column, with:

- **Drag handle** — drag the row to change the column order.
- **Visible** — unticking hides the column without removing it from the list.
- **Name** — the field label as the table shows it.
- **Width** — in pixels (minimum 40).

## Available fields

Below the chosen columns sits the **Available fields** list: every field that is not yet a column. Clicking one adds it as a column. Besides the standard fields you will find the analysis fields **Milestone**, **Free Float**, **Interfering Float**, **Near Critical** and **Float Path**, plus **Resources** and the project's activity codes and custom fields. The three float fields and Float Path only get values after a calculation with the matching scheduling options — see [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse).

**Start** and **Finish** (in the default set) show the same dates as the bar in the Gantt: the calculated schedule, and before the first calculation the entered dates. Type a different date in Start and it becomes the scheduled start. A different Finish changes the duration of an automatically scheduled task; for a manually scheduled task it becomes the scheduled finish. Then press **F5** to recalculate. Typing the same date back changes nothing.

The fields **Scheduled start** and **Scheduled finish** show the entered dates themselves, even when the calculation moves the task. Scheduled finish can only be edited for a manually scheduled task: for other tasks the start and duration determine the finish. Start and Finish of an automatically scheduled summary task follow from its subtasks and cannot be edited.

## Reset to default

**Reset to default** sits at the bottom of the column chooser (the plus at the right of the table header, or the **Table** tab → **Columns…**). One click puts the columns of that table back to the default layout: which columns are shown, their order and width, and pinned columns. Extra added fields leave the table and stay available in the list. This is also how you get a new default after an update, for example **Start** and **Finish** instead of **Scheduled start** and **Scheduled finish**: a layout of your own that was saved earlier does not change by itself. It is a single action, so **Ctrl+Z** brings your own layout back. When the table already uses the default, the button is disabled.

The column set is part of a saved layout — see [Saving and loading layouts](docs://ref-layouts).

## Further reading

- [Filters](docs://ref-filters) — which tasks the table and the Gantt show.
