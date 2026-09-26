# Splitting tasks

Sometimes work on a task stops for a while and then simply carries on: the crew is pulled onto another project for a week, material arrives late, or a holiday period falls in between. A **break** records that in the task itself, instead of cutting it into separate tasks. The Gantt bar then shows work, a pause and more work, and the schedule calculates with it.

## What you'll learn here

- When a break fits better than two separate tasks.
- Creating a break with split mode in the Gantt.
- Dragging pieces and pauses, merging them, and making them longer or shorter.
- Entering breaks precisely in the properties panel.
- What happens to the duration and the dates, and which tasks can't be split.
- What happens when you export to MS Project or P6, and how the AI assistant sets breaks.

## A break or separate tasks?

Take two projects that share the same bricklaying crew. On project A the crew lays bricks for five days, moves to project B for three days, and then comes back to finish the brickwork on A. It is one piece of work that is put on hold and resumed.

- Use a **break** when the same work is suspended and resumed. The task keeps one name, one duration, one set of relations and one progress figure; only its bar runs through the pause.
- Use **separate tasks** when the parts are genuinely different work, each need their own relations, or are done by different people.

A break doesn't change the amount of work. A 10-workday task with a 3-workday break is still 10 workdays of work; it just finishes 3 workdays later.

## Creating a break in the Gantt

1. Click **Split task** on the ribbon (Home or Planning tab). Split mode is now on, and a short explanation with a **Stop** button appears. On the Table tab the button is off, because there is no Gantt chart to click on; switching to the Table while the mode is on turns it off.
2. Point at the day on the bar where the pause should start. A vertical line marks the day.
3. Click and drag to the right for the length of the pause. A label shows how many workdays the break will be. Releasing without dragging creates a one-workday break (or one hour for an hour-based task).
4. The mode stays on so you can add another break straight away. Press **Esc** or click **Split task** again to stop.

A bar that can't be split shows a not-allowed cursor.

## Editing pieces and pauses

Outside split mode you can edit a broken bar with the mouse as usual:

- **Dragging the first piece** moves the whole task, just like an ordinary bar.
- **Dragging a later piece** makes the pause before it longer or shorter. Drag the piece right up against the previous one and the two pieces merge; that pause disappears.
- **Dragging the right edge of a piece** makes that piece longer or shorter. This changes the task's duration: the work is not redistributed over the other pieces.

Each drag is one step you can undo with **Ctrl+Z**.

Right-click a broken bar to choose **Remove break** (the pause under the cursor) or **Remove all breaks**.

## The Breaks section in the properties panel

Select the task; the properties panel then shows the **Breaks** section. Each pause has one row:

- **after** — how many workdays of work lie before the pause, counted from the start of the task. Pauses don't count here: for a second pause you only count the work.
- **pause** — the length of the pause in workdays.
- the from and to dates, so you can see where the pause falls in the calendar;
- a button to remove the pause.

Setting a pause to 0 removes it. **Add break** inserts a new one-workday pause halfway through the longest piece; adjust it afterwards. For an hour-based task the same fields are in hours.

A pause created by resource leveling carries the *leveling* tag. Once you edit the breaks of such a task yourself, those pauses become yours: **Clear leveling** no longer removes them.

## What happens to the duration and the dates

- The bar grows with the pause right away. Successors only move at the next calculation: press **F5**, click **Calculate**, or turn on **Calculate automatically**.
- A task that has already started can only be interrupted in its remaining part; a pause can't fall inside work that is already done.
- If the task has its own work distribution per assignment, that distribution moves along: the work per workday stays the same, only the pause days shift.
- Breaks are saved in the project file like everything else and come back when you open it.

## Tasks you can't split

- milestones;
- summary tasks (split their subtasks instead);
- hammock tasks;
- tasks whose duration runs in calendar days (elapsed time);
- manually scheduled tasks;
- tasks shorter than two workdays (or two hours for an hour-based task).

## Breaks from MS Project

A task that was already split in MS Project comes in with those breaks (see [Opening MS Project (.mpp)](docs://gids-msproject-import)). Usually you can edit them like any other. Sometimes they are stored in a form that can't be edited here, for example pauses that overlap or that fall after the task's last work. The Breaks section then shows a coloured block explaining this and only the **Remove all breaks** button: the breaks stay exactly as they are in the file until you deliberately remove them.

## Exporting to MS Project or P6

MS Project and Primavera P6 only know a break as the work distribution of an assignment. A split task without its own work distribution therefore arrives there without its breaks, as one continuous task. After such an export the app tells you how many tasks are affected. Your own project file (IFC) keeps everything. See also [Import/export](docs://gids-import-export).

## With the AI assistant

The AI assistant sets breaks with the `planner_set_task_splits` tool, in the same form as the panel: after how many workdays of work, and how many workdays of pause. An empty list removes all breaks from the task. The assistant reads them back through `planner_get_task`. To connect an assistant, see [Connecting an AI assistant (MCP)](docs://gids-ai-mcp).
