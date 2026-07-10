# Your first schedule in 10 minutes

This guide takes you, in about 10 minutes, from an empty project to a fully calculated construction schedule: adding tasks, building a task structure, adding relations, calculating and saving. No theory upfront — you just do it, step by step, using the exact buttons and menus you'll find in Open Planner Studio.

## What you'll do

1. Create a new project.
2. Add tasks — via the ribbon, the task table and the Gantt chart.
3. Put the tasks into a structure (WBS) by indenting.
4. Add relations between tasks.
5. Calculate the schedule.
6. Read the result: critical path and float.
7. Save.

Would you rather see where you're headed first? Open the example project [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **File → Examples**. (Example names are shown in Dutch, as bundled with the project.) It's a small, easy-to-read schedule that already shows almost every step below — handy to keep open next to this article for comparison.

Everything below works identically in the desktop app and in the browser version: same buttons, same menus, same shortcuts.

## Step 1 — Create a new project

1. Click the ribbon tab **File**. This opens the file screen.
2. Click **New** (or use the shortcut **Ctrl+N** if you're already working in another project). The **New project** dialog appears.
3. Enter a **Project Name**, for example "My first schedule", and check the **Start Date** — it defaults to today.
4. For **Phasing template**, choose **Empty**. The **Residential construction** and **Commercial / renovation** templates set up a few phase tasks for you already, but for this exercise you'll build everything yourself so you recognize every step.
5. Leave the calendar options at their default values and click **Create**.

You now have an empty project: an empty task table on the left, an empty Gantt chart on the right, and a work calendar already set up from the default settings.

## Step 2 — Add tasks

Make sure you're on the ribbon tab **Home**. This tab shows the task table (left) and the Gantt chart (right) side by side — two views of the same schedule, so a task you add appears in both places at once.

### Via the ribbon

1. In the **Tasks** ribbon group, click the **Task** button. A new task named "New task" appears, with a duration of 5 work days, at the bottom of both the task table and the Gantt chart.
2. Repeat this a few times until you have a task for each main phase of your project. If you're following the example project, use the same main phases as it does: "1. Voorbereiding" (Preparation), "2. Fundering & ruwbouw" (Foundation & shell construction), "3. Afbouw" (Finishing) and "4. Oplevering" (Handover).
3. Double-click a task — in the table or on its bar in the Gantt chart — to open the **Edit task** window. Adjust the **Name**, **Type** and **Duration (work days)** to match your phase.

### Via the task table and the Gantt chart

You don't have to keep going back to the ribbon. Right-click an **empty row** in the task table, or an empty spot in the Gantt chart (where there's no task yet), and choose **New task** from the context menu.

Right-click an **existing** task instead, and you get a different context menu with, among others:

- **Insert above** / **Insert below** — adds a task before or after the task you right-clicked.
- **Add subtask** — creates a new task as a child of that task in one step (see step 3 for what that means).

Typed something wrong, or added a task in the wrong place? **Ctrl+Z** undoes the last action, **Ctrl+Y** (or **Ctrl+Shift+Z**) redoes it — both work throughout the whole schedule, not just in text fields.

### Add a milestone

Every schedule needs at least one milestone, for example for the handover. In the **Tasks** ribbon group, click the arrow next to **Milestone** and choose **Finish milestone**, **Start milestone** or **Inspection point (mandatory)** — or use the shortcut **Ctrl+M** for a quick, generic milestone ("New milestone") that you rename afterwards.

## Step 3 — Build a task structure (WBS)

A flat list of tasks gets confusing fast. By indenting tasks you build a task structure (WBS): the task above then automatically becomes a **summary task** that spans the full period of its subtasks.

1. Select a task that should sit under another task — for example "Fundering aanbouw" (Extension foundation) under the phase task "2. Fundering & ruwbouw" (Foundation & shell construction).
2. Press **Alt+→** to indent, or right-click and choose **Indent** from the context menu. The task above immediately becomes visible as a summary task.
3. Went too far, or want to move a task back to the top level? Use **Alt+←**, or right-click and choose **Outdent**.
4. Faster for a brand-new subtask: right-click the parent task and choose **Add subtask** — that skips the separate add-then-indent steps.

Repeat this until you're a few levels deep. In the example project, the phase "2. Fundering & ruwbouw" for instance breaks down into the subtasks "Grondwerk aanbouw" (Extension earthworks), "Fundering aanbouw" (Extension foundation), "Begane grondvloer storten" (Casting ground floor), "Wanden opmetselen" (Bricklaying walls) and "Dakconstructie plaatsen" (Installing roof structure).

This article only covers WBS building at a practical level, to get you going. To learn how milestone kinds, summary tasks and activity codes work together in detail, read the guide [Planning & WBS](docs://gids-plannen-wbs).

## Step 4 — Add relations

Tasks without relations are independent of each other and don't shift when you change an earlier task. A relation (dependency) links two tasks together.

1. Make sure the bars of the two tasks you want to link are visible in the Gantt chart.
2. Hold **Shift** and drag from the bar of the predecessor to the bar of the successor. As soon as you release, a **Finish-Start (FS)** relation with a lag of 0 work days is created immediately — the most common relation: the successor starts only once the predecessor is finished.
3. Right after you release, the **Relation type** window appears. Here you can change the relation type (**FS**, **SS**, **FF** or **SF**) and enter a **lag**, for example `2d` for two work days of wait time between the tasks. In short: with **FS** (Finish-Start) the successor starts after the predecessor finishes, with **SS** (Start-Start) both tasks start (roughly) at the same time, with **FF** (Finish-Finish) they finish (roughly) at the same time, and with **SF** (Start-Finish) the predecessor must start before the successor is allowed to finish — the last one is the least common in construction practice.
4. Would you rather link two tasks without dragging? Go to the ribbon tab **Relations** (or click **Manage** in the **Relations** ribbon group on the Planning tab), select the predecessor first, then (holding Ctrl/Cmd) the successor, and use the **New relation from selection** button — that button only works when exactly two tasks are selected, in that order.

For the exercise, add at least two relations: for example "1. Voorbereiding" → "2. Fundering & ruwbouw" and "2. Fundering & ruwbouw" → "3. Afbouw".

## Step 5 — Calculate

Now that you have tasks and relations, you can have the schedule calculated (CPM — Critical Path Method).

1. Press **F5**, or click the **Calculate** button in the **Schedule** ribbon group.
2. Open Planner Studio now calculates, for every task, the earliest and latest start and finish dates, the float, and which tasks lie on the critical path.
3. Don't want to think about F5 anymore? Turn on **Calculate automatically** in **Settings**. The schedule then recalculates itself as soon as it becomes out of date, instead of waiting for a manual press of F5.

## Step 6 — Read the result

- At the bottom of the screen, the status bar shows for example "Critical path: 4 tasks, 62 work days" once the schedule has been calculated. If you've changed something since the last calculation, it instead shows "Out of date — recalculate (F5)".
- In the Gantt chart, critical tasks — tasks with no float, which therefore directly determine the project's end date — get a different bar colour than tasks that still have room (float). If a critical task runs late, the whole project end date shifts with it; a task with float can run late without consequences, as long as the float isn't used up.
- Double-click a task to reopen the **Edit task** window. Under the **CPM Result** section you'll find, per task: **Early start**, **Early finish**, **Late start**, **Late finish**, **Total float**, **Free float**, and whether the task lies on the **Critical path**.
- Want this data as columns in the task table too, instead of having to open each task? Go to the ribbon tab **View**, click **Columns…** in the **Display** group, and check **Critical** and **Total Float**.

## Step 7 — Save

1. Press **Ctrl+S**, or click **Save** on the **File** tab. The first time, Open Planner Studio asks for a file name and location; the project is saved as a native IFC file.
2. Want to keep a copy under a different name instead, for example to keep two variants side by side? Use **File → Save As** (shortcut **Ctrl+Shift+S**).

## Keep practising

- Replay the steps above with a complete example: open [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **File → Examples** and recognize the FS chain between the phases, the SS overlap between the wall and roof work, the FF link between the tiling and painting work, and the permit constraint (SNET) before the start.
- Want to know more about task structure, summary tasks, milestone kinds and activity codes? Read the guide [Planning & WBS](docs://gids-plannen-wbs).
- Would you rather take a visual tour of the main areas of the screen? Restart the tour via the **View** tab → **Tour** button, or via **File** → **Start tour**.
