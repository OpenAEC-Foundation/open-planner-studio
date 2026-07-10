# Critical path & advanced analysis

Every schedule has a longest chain of tasks that together determine when the project finishes: the critical path. Everything outside it has float — room to slip without touching the end date. This guide goes beyond "which bars are red": total/free/interfering float, near-critical work, multiple equally critical paths, hammocks, hard pins and their upstream effect, and external links between projects.

## What you'll learn here

- Reading the critical path, and the difference between total, free and interfering float.
- Near-critical work: setting the threshold and recognizing the amber marking.
- Multiple critical paths at once — when that happens and how you see it.
- Hard pins and their effect on float, including negative float arising upstream.
- Hammocks (Level of Effort): what they do and don't do.
- External links between projects: the frozen anchor, refreshing, and the "source missing" status.
- Tracing a path via the context menu or the ribbon.
- The **Calculation** section in the project settings.

Follow along with [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — the large, "kitchen sink" showcase with three parallel towers that shows almost every topic in this guide: multiple critical paths, near-critical work, a hammock, a hard pin and an external link to a separate source file.

## Reading the critical path

Press **F5** (or the **Calculate** button) to run the schedule. The status bar at the bottom then shows, for example, "Critical path: N tasks, M work days" — the number of tasks on the critical path and the total duration. In the Gantt chart, critical tasks get their own (red) bar color: tasks with no float, where every day of delay directly pushes out the project end date.

Double-click a task and look in the **CPM Result** section for the exact numbers: **Early start**, **Early finish**, **Late start**, **Late finish**, **Total float**, **Free float** and (where applicable) **Interfering float**, plus whether the task is on the **Critical path**. Want these fields as columns in the task table? **View → Columns…** and check them.

### Total, free and interfering float

- **Total float** — how much a task can slip in total without touching the project end date. Zero means critical.
- **Free float** — how much a task can slip without touching its very next successor. Can be smaller than total float: a task can have some total float, yet if it slips a single day its immediate successor already moves too (that successor then has enough float of its own not to touch the end date).
- **Interfering float** — the difference between the two (total float − free float): the part of your float that doesn't touch the end date but does "get in the way" of a successor. Zero means free and total float are equal — slipping within your float then affects nobody.

## Near-critical work

A task with a small, non-zero total float is vulnerable: a small setback makes it critical after all. Turn this on via **Project info → Calculation → Mark near-critical**, with a **Threshold** in work days (or hours, depending on your duration display). Every task with total float greater than zero and less than or equal to that threshold gets an amber bar color in the Gantt — between the red of critical and the green of ample float.

The large showcase sets the threshold to 3 work days. The final inspection of **Tower C** therefore has exactly 3 work days of total float — just inside the threshold — while the identical final inspections of **Tower A** and **Tower B** sit at zero float and are genuinely critical. Tower C is identical to the other two in tasks and durations except for one slightly shorter finishing task; that small difference is exactly enough to move it from critical to near-critical.

## Multiple critical paths

Normally there is exactly one longest chain, but it can happen that two or more chains are exactly the same length — then they're both (or all) equally critical. Turn on **Multiple float paths** (**Project info → Calculation**) to have this computed: choose the **Method** (**Free float (peeling)** or **Total float (ranking)**) and a **Max. paths**. Every task then gets a **Float path** number (1 = most critical); a task with no float path isn't on any of the computed paths.

In the large showcase, Tower A and Tower B are fully symmetrical in tasks and durations — they finish at exactly the same time. As soon as you turn on **Multiple float paths**, you'll see more than one path in the results (`criticalPaths.length` greater than 1 in the calculation): not a single longest chain, but several equally critical chains running through the project. That's a different signal from "one critical path with some near-critical work next to it" — it means a delay in *any* of those paths hits the end date equally, so you can't focus your attention on a single chain.

## Hard pins and their effect on float

A **hard pin** (the **Mandatory (pin logic)** checkbox on an MSO or MFO constraint) fixes a task to a date, even if its predecessors logically contradict that. The large showcase uses this on "Wegafzetting gemeente (vergunde stremmingsperiode)" (municipal road closure, permitted closure window): the municipality only allows the closure on exactly that permitted date, full stop — the network logic bends around it.

The upstream effect is the tricky part to see through: if the predecessors of a pinned task need more time than is available up to the pin date, **negative float** appears on those predecessors. Negative float is therefore not a calculation error: it's how the engine tells you "this preceding chain no longer fits within the time the pin allows". If you see negative float upstream of a hard pin, the question isn't "what's broken here" but "which of these two things has to give: the pin date, or the duration of the chain before it".

Note: in the large showcase, the entire chain around "Wegafzetting gemeente" — including the pinned task itself — has long since been fully completed (actual start and finish, well before the status date). Because of that, you'll see a small residual negative float across the whole phase-1 chain there, including on the pin task itself: that's a characteristic of already-completed tasks combined with a status date, not the "predecessors don't fit" scenario described above. To see that scenario in its pure form: temporarily clear the status date (**Baselines & progress** ribbon group, **Clear status date** button) and recalculate — the pin task itself then sits back at zero total float, and negative float only appears once you deliberately make the preceding chain longer than the room available before the pin date.

## Hammocks (Level of Effort)

A **hammock** (the **Hammock (derived duration)** checkbox in the properties panel) is a task with no duration input of its own: its start and finish follow automatically from its own relations. Incoming **FS**/**SS** relations supply the **start driver** (the earliest start), incoming **FF**/**SF** relations supply the **finish driver** (the latest finish) — the panel shows both read-only as soon as you check the hammock box, so you can see exactly which tasks determine the span. Without a finish driver, the span falls back to zero length, with a warning in the panel.

What a hammock does do: it shows, as a kind of overarching bar, the full span of a piece of work without you having to maintain a duration yourself — handy for, say, "supervision" or "general site overhead" that literally runs as long as the underlying work. What a hammock doesn't do: it carries no resources or logic of its own that affects the CPM calculation — it's a derived view, not a driving task. The large showcase uses this for "Ruwbouw toren A (LOE)" (shell and core, Tower A): a hammock that starts as soon as the first real shell-and-core task of Tower A begins and finishes as soon as the last one is done, without sitting anywhere in between itself.

## External links between projects

Large projects sometimes consist of several separately managed sub-schedules — for example your own master schedule and a site works package another contractor manages. An **external link** (the **External (cross-project) link** window, opened via the button on the **Relations** tab) records a relation to a task in such another file, without having to open that file as a document.

You pick a **Source file** from your recent files (that's read in read-only, never opened as a document) or fill in **Manual** with a project id, task id and anchor date if you don't have the source file at hand. Then you choose **Direction** (predecessor or successor), **Relationship type** (FS/SS/FF/SF) and a **Lag**. The **Anchor date** — the source task's date at the moment you linked it — is frozen in your own file; that date doesn't automatically follow if the source project changes.

Want to know if the source file has since been updated? Go to the **Relations** tab, **External links** section, and click **Refresh this link** (per link) or **Refresh external anchors** (all at once) to re-read the source file and update the anchor. If the source file isn't available — moved, renamed, or never shipped — the link shows the **outdated** label with the tooltip "source not loaded — re-import to refresh": the app then can't verify for itself whether the frozen anchor still holds.

The large showcase deliberately demonstrates exactly that last path: the task "Bestrating parkeerterrein" (parking area paving) is linked to a source file from a site-works subcontractor that is deliberately *not* shipped with the example. Open the task and you'll see the link listed with the status "outdated" — an honest demonstration of what happens when an external source file is no longer available, instead of a link that always refreshes flawlessly.

## Tracing a path

Want to see exactly which tasks affect a given task upstream and downstream? Right-click the task and choose **Trace path** (or **Stop tracing** to turn it off again) — that highlights the entire chain of predecessors and successors in one go. For more targeted work, the ribbon (**Planning** or **Relations** tab, **Path tracing** ribbon group) has a separate pair of buttons **Predecessors**/**Successors**: both off shows nothing, one on shows that one direction, both on is the same as the context-menu command. The trace also distinguishes between all logically connected tasks and the tasks that are actually **driving** the date (the same "Driving" relation shown in the relations table) — so you see not just what's connected, but what's actually steering.

## Calculation settings

The **Calculation** section in **Project info** (Backstage → Project info, or the **Project info** window) collects the calculation options that belong to this particular project — they belong to the file, not the app, so a colleague opening the same file gets the same outcome:

- **Critical definition** — **Total float ≤ threshold** (default threshold 0) or **Longest path**, which marks tasks critical based on the longest chain through the network, independent of their float number.
- **Float calculation** — how total float is determined for a task with both a start and a finish side: **Smallest (start/finish)** (default), **Start float** or **Finish float**.
- **Open-ended tasks critical** — automatically treat tasks with no successor as critical.
- **Mark near-critical** with **Threshold** (see above).
- **Multiple float paths** with **Method** and **Max. paths** (see above).
- **Lag calendar** — which calendar a lag in work days uses: the **Predecessor**'s, the **Successor**'s, always **24-hour**, or the **Project calendar**.

## Keep reading

- See multiple critical paths, near-critical work, a hammock, a hard pin and an external link all in one schedule: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relations, lag/lead and constraints (including the hard pin) are explained in more depth in the guide [Relations & constraints](docs://gids-relaties-constraints).
- Leveling can change the critical-path structure — read the guide [Resources, histogram & leveling](docs://gids-resources-histogram).
- Progress and a status date can produce negative float on an already-fixed task — read the guide [Baselines & progress](docs://gids-baselines-voortgang).
