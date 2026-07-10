# Resources, histogram & leveling

A task tells you when something needs to happen; a resource tells you who or what is going to do it — and how much of it is available on a given day. As soon as you assign resources to tasks, a day can demand more than there is capacity for: an overallocation. This guide shows how to manage and assign resources, how to read the load in the histogram, and how (and when *not*) leveling resolves an overallocation.

## What you'll learn here

- The five resource types and when to use each.
- Assigning resources to tasks — via the properties panel, the task dialog or the ribbon.
- Units per day and the six distribution curves: when to pick which.
- Moving an assignment to a different task.
- Resource calendars and time-phased capacity (for example a second crane added later).
- Reading the histogram: the resource picker, drilling down per resource, spotting overallocation.
- The docked resource panel next to the Gantt.
- Leveling: the options in the **Level resources** window, the difference between staying within slack and letting the end date shift, and priorities (including priority 1000 = "do not level").
- The honest lesson: when leveling does *not* solve an overallocation.

Follow along with [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (medium-sized, one deliberate and leveling-solvable overallocation on the plasterers) and with [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (large, almost every resource overloaded because three towers need the same crews and the tower crane at the same time — the showcase where leveling runs into its limits).

## The five resource types

Every resource has a **Type** (a column in the resource panel):

- **Labor (LABOR)** — tradespeople: bricklayers, plasterers, installers.
- **Equipment (EQUIPMENT)** — machines and gear: a tower crane, a construction hoist.
- **Material (MATERIAL)** — consumables with a **Unit** (for example m³ of concrete). Material is never leveled and never counted in the histogram — it's a stock, not a per-day capacity that can overflow.
- **Subcontractor (SUBCONTRACTOR)** — an outside company with its own capacity ceiling, for example a façade contractor who can only field two crews at once.
- **Crew (CREW)** — an umbrella group. Other resources can join a crew via the **Crew** column in the panel for grouping/overview; this is purely informational — there's no automatic capacity roll-up to the crew.

## Managing resources

Open the resource panel via the **Manage** ribbon group on the **Resources** tab: the **Resources** button opens the full panel (a separate full-panel view, like Table or Relations), **New resource** adds a row directly. In the panel you edit, per resource: **Name**, **Type**, **Max units** (capacity per work day — 1 = one person/item full time, 2 = two units at once), **Calendar**, **Rate/hour**, **Unit** (material only) and **Crew** (which crew this resource belongs to). At the bottom, the **Total** column adds up each resource's cost (loaded units × hours/day × rate), recalculated on every F5.

### Time-phased capacity

Next to **Max units** is an arrow that expands a **Time-phased capacity** sub-row: here you add steps (a **From** date + **Max units**) for capacity that changes over the course of the project. The large showcase uses this for the tower crane: it sits at **Max units 1**, with a step that raises capacity to **2** **from day 130** — the moment a second crane is added. Before that date, all three towers have to share a single crane; after it, two towers can hoist at once.

## Assigning resources

There are three places where you manage an assignment — they operate on the same underlying data, so anything you do in one shows up immediately in the others:

1. **Properties panel** — the **Assignments** section under a selected task: a dropdown to **Assign resource** with the not-yet-assigned resources, and per existing assignment the **units/day**, the **curve** and a button to remove it.
2. **Task dialog** — the same **Assignments** section, in the **Edit task** window.
3. **Ribbon** — **Resources** tab, **Assignment** ribbon group, the **Assign ▾** button. This button is only active when exactly one non-milestone, non-summary task is selected; the dropdown lets you set **units/day** and **curve** first and then lists the not-yet-assigned resources below — click a name to complete an assignment in one go.

Milestones and summary tasks cannot carry resources (they have no duration of their own to load) — both places show an explanation instead of the assignment form.

### Moving an assignment

Assigned a resource to the wrong task by mistake, or moving work from one task to another? In the **Assignments** section of the properties panel (or the task dialog), each assignment has a **Move to…** dropdown listing the candidate tasks (leaf tasks without this resource, excluding the current task). Choosing one moves the assignment in a single step, including its units and curve — no need to remove and re-create it.

## Units and distribution curves

Every assignment has **units/day** (1 = one person/item full time, 0.5 = half a day) and a **curve** that determines how that load is spread across the task's duration:

- **Uniform** — flat, the same amount every day. The default, and the right starting point for most tasks.
- **Front loaded (FRONT_LOADED)** — most of the work early in the task, tapering toward the end.
- **Back loaded (BACK_LOADED)** — the mirror image: ramping up toward the end, for example a task that needs to build up momentum.
- **Bell shaped (BELL)** — low at the start and end, peaking in the middle — a task that ramps up, runs at full tilt and winds down again.
- **Early peak (EARLY_PEAK)** — the peak sits early in the task, then the load tapers off.
- **Late peak (LATE_PEAK)** — the peak sits late in the task.

Curve variation shows up most clearly in the histogram: the same task with the same units/day produces a very different bar shape with a bell curve than with uniform. The medium-sized showcase deliberately mixes uniform/front loaded/back loaded on the per-house finishing tasks, so you can compare the difference.

## Resource calendars

A resource can sit on the **Project calendar** (default) or on its own calendar — for example for a subcontractor who's only available four days a week. Set this via the **Calendar** column in the resource panel, or the **Calendar** field on the resource itself. A resource calendar never touches a task's CPM dates (those keep running on the task/project calendar) — it only affects **load** and **leveling**: if a resource doesn't work a day the task needs, that counts as a shortfall in the histogram, and the leveler warns that shifting won't fix that calendar mismatch. See the guide [Calendars & hour planning](docs://gids-kalenders-uren) for the full explanation of calendars.

## Reading the histogram

Turn the histogram on via the **Histogram** ribbon group on the **Resources** tab (the **Histogram** button). A strip appears under the Gantt on the same time axis: bars per day, with the part above the capacity line shown in red.

To the left of the bars, above the task-table column, sits the **resource picker**: a list with "All resources" at the top and every resource below it, each with a red dot if that resource is overallocated anywhere. Click a name to zoom in on that one resource — the histogram rescales to its load and capacity alone. Click back on "All resources" to see the sum of all resources again. Besides clicking, you can also step through resources with the **Previous**/**Next** buttons in the **Histogram** ribbon group, without touching the picker itself.

Click an overloaded bar and a tooltip shows how many tasks contribute to the load that day, with the first few task names — handy for quickly seeing which combination of tasks causes the overallocation without checking every assignment by hand.

If you see "Recalculate (F5) to show the load" instead of bars, the schedule hasn't been (re)calculated since the last change — the histogram, like the critical path, is a snapshot you refresh yourself.

## The docked resource panel

Besides the full resource panel (ribbon button **Resources**), there's a compact variant you can dock on the right: the **Dock** button in the **Manage** ribbon group. This docked panel shows only the name, **Max units** (editable directly) and a red/green dot for overallocation — a quick overview next to your Gantt without opening the full panel. The docked resource panel and a task's properties panel are mutually exclusive — you'll see only one of the two in the right rail at a time.

## Spotting overallocation

A resource is overloaded on a day as soon as the summed units of all its assignments that day exceed its **Max units**. You'll see this in three places: the red portion of the bar in the histogram, the red dot in the resource picker and the docked panel, and the **Overallocation** counter in the ribbon group on the Resources tab ("N resources" with a warning icon, or "None").

The medium-sized showcase makes this visible on purpose: in early June the **Stukadoors** (plasterers, max units 2) get a 2-unit assignment on three houses at once (the plastering of House 1, 2 and 3 overlaps there for a few days) — 6 units combined at the peak, well above the capacity of 2.

## Leveling

Open the **Level resources** window via the **Level…** button in the **Leveling** ribbon group on the Resources tab. The window requires a valid, up-to-date calculation (recalculate with F5 first if the schedule is out of date) and works in two steps: **Calculate** first for a proposal, then **Apply** — nothing changes in your schedule until you've seen the proposal.

In the window you choose:

- **Resources** — which resources participate in the leveling run (all of them by default; material is always excluded — it's never leveled).
- **Level only within slack (smoothing)** — a checkbox with a clear subtitle: "project end date stays fixed". Off (**leveling**), the leveler may shift tasks as far as needed, even beyond their own slack, which can push out the project end date. On (**smoothing**), the end date is sacred — the leveler only shifts within each task's existing slack, and a conflict that doesn't fit within that stays flagged as a remaining conflict.

After **Calculate**, the window shows a table with every task whose start changes (old start → new start → days shifted), a line reporting whether the project end date changes, and — if conflicts remain — a **Remaining conflicts** section with, per task, the reason: a calendar mismatch (the resource doesn't work the days the task needs), insufficient free capacity within the slack, or an intrinsic overrun (a single assignment already demands more at its peak than the resource could ever deliver — no shift fixes that). Only once you're happy with the proposal do you click **Apply**.

Try this yourself on the plasterer overallocation in the medium-sized showcase: open **Nieuwbouw 6 Rijwoningen De Akkers**, go to the **Resources** tab and open **Level resources**. Leave all resources checked, leave smoothing off and click **Calculate**: the conflicts disappear completely (0 remaining conflicts), but the project end date moves about a week later. Then check **Level only within slack** and calculate again: the end date now stays unchanged, but one task (plastering in one of the houses) remains as a flagged conflict — there simply isn't enough slack to fit it entirely within the existing schedule. That's exactly the trade-off this checkbox makes visible: do you solve the problem by letting the end date go, or do you keep the end date fixed and accept a flagged remaining conflict?

### Priorities

Every task has a **leveling priority** from 0 to 1000 (default 500). Right-click a task and choose **Priority** for three presets: **Low** (100), **Normal** (500) and **High** (900) — in a capacity conflict between two tasks, the one with the higher priority gets first claim on the scarce capacity. The value **1000** is a special case: "do not level" (MS Project calls this "Do Not Level"). Such a task still moves through the leveling loop and follows its own, possibly shifted, predecessors, but is itself never shifted to free up capacity. The large showcase uses this on "Nutsaansluitingen aanleggen" (installing utility connections): a fixed connection date set by the utility company that must not move, whatever the leveling run otherwise proposes.

**Clear leveling** (in the **Leveling** ribbon group) removes every previously applied shift in one go — handy for returning to the original, unleveled schedule without resetting each task by hand.

## The honest lesson: when leveling doesn't help

Leveling resolves an overallocation by rearranging work in time — within slack, or, if needed, with a later end date. That works well as long as there's enough room (slack or time) somewhere in the schedule to redistribute the excess demand. It fundamentally *doesn't* work when demand is structurally larger than what will ever be available, no matter how you shift things.

The large showcase shows this across multiple resources at once: because the three towers run largely in parallel and share the same crews (bricklayers, installers, plasterers, tile setters, the tower crane), almost every labor resource is overloaded at some point. Level with all resources selected and the end date free, and most of the conflicts disappear — but the project end date slips by months, and a handful of finishing tasks per tower (tiling, kitchens, sanitary, painting) remain as an intrinsic overrun: a single assignment's peak load already exceeds capacity there, so no shift helps. Turn on smoothing to protect the end date, and a much larger share of the conflicts simply stays unresolved.

The lesson isn't that leveling "doesn't work" — the algorithm does exactly what's asked of it. The lesson is that leveling is a **scheduling** tool, not a **capacity** tool: it rearranges existing work within existing time, but it doesn't create extra tradespeople, equipment or calendar days. A structural shortage — too few plasterers for three towers at once, one tower crane serving three sites — calls for a different fix: hiring more capacity, adjusting the phasing (towers one after another instead of in parallel, which the second-crane step from day 130 already partly does), or dividing the work differently. Leveling is the tool that shows you where it hurts; it doesn't solve the underlying capacity question for you.

## Keep reading

- Replay the plasterer-overallocation leveling yourself in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- See the limits of leveling in practice — plus all five resource types, all six curves and the time-phased tower-crane capacity — in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Resources run on calendars — read the guide [Calendars & hour planning](docs://gids-kalenders-uren) for resource calendars and hour planning.
- Want to set a baseline before you start leveling, so you can see the difference? Read the guide [Baselines & progress](docs://gids-baselines-voortgang).
- Leveling can change which tasks are critical — read the guide [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) for how to spot that.
