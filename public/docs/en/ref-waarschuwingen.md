# Warnings panel

The status bar counts what is wrong with the schedule: missed deadlines, violated constraints, out-of-sequence relations and overallocated resources. The **Warnings panel** shows the details: one list with every individual warning, and a single click takes you to the task, relation or resource concerned.

## Opening and closing

- Click one of the yellow counters in the status bar — for example **⚠ 2 deadline(s) missed**. From the IFC or Report view the app switches back to the Gantt, because that is where the sidebar lives.
- Or use the ribbon: **View → Panels → Warnings**, or **Planning → Schedule → Warnings**, next to **Calculate**.
- The panel appears at the bottom of the right-hand sidebar, below Properties and the Resource dock. When another panel is on as well, drag the edge above it to change its height; the height is remembered. When it is the only panel, it fills the whole sidebar.
- Close it with the cross in its header or with the ribbon button again. The panel is always off when the app starts.

## What the list contains

Everything comes from the last calculation (F5) and the resource load derived from it; the panel does not calculate anything itself. Errors come first, then the warnings by type, in the order of the tasks in your schedule.

- **The schedule could not be calculated** — an error such as a circular relation or a calendar without working days. For a cycle, the tasks involved are listed.
- **Deadline missed** — the task's early finish falls after its deadline. The row shows both dates.
- **Constraint overridden** — a "no later than" or "must on" constraint is pushed aside by the logic; the task has negative float.
- **Out of sequence** — the successor has progress that contradicts the relation (for example, it has started while the predecessor is not finished).
- **Lead truncated** — a negative lag tried to pull the successor before the project start; the relation is not fully honoured.
- **Relation ignored** — the predecessor or successor is missing or is not a leaf task; the relation is not part of the calculation.
- **Hammock without a finish driver** — a hammock task without an FF or SF predecessor; its duration falls back to zero.
- **Finish date capped** — the calendar leaves no workable window for this task.
- **Overallocated** — a resource is loaded beyond its capacity on one or more days. The row shows the number of days and the first and last day.

If it says **No warnings**, the schedule passes all checks. If the schedule has never been calculated, the panel offers a **Calculate** button.

## Jumping to the problem

Click a row, or move to it with Tab and press Enter.

- **Task** — the task is selected, collapsed parent tasks expand and the Gantt zooms and scrolls to it. The Properties panel shows the task.
- **Relation** — both tasks are selected, with the successor as the active task. In the Properties panel the relation is listed under **Dependencies**.
- **Resource** — every task this resource is assigned to is selected (their bars light up), and the histogram strip below the Gantt is switched on and shows exactly this resource, so you can see the overallocated days.
- **Circular relation** — all tasks in the cycle are selected; the Gantt jumps to the first one.

On the **Table** tab the task is selected in the table; the Gantt makes the jump as soon as you switch back. A resource row does switch straight to the Resources tab there, because the histogram strip only exists next to the Gantt. An error without a target (for example a calendar without working days) is not clickable.

## Stale list

If you change tasks without recalculating, a yellow triangle appears in the panel header: the list still belongs to the previous calculation. Click **Calculate** or press F5. Rows that now refer to a deleted task, relation or resource disappear on their own.

## Keep reading

- What deadlines and constraints do exactly: the guide [Relations & constraints](docs://gids-relaties-constraints).
- Resolving overallocation with levelling and the histogram: the guide [Resources & histogram](docs://gids-resources-histogram).
- See the deadline conflict in practice: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
