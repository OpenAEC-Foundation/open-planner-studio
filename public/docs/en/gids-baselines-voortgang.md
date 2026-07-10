# Baselines & progress

A schedule you never update is a forecast. Once work starts, you want to see two things at once: what was originally agreed, and what's actually happening now. A **baseline** freezes the first; **progress** and the **status date** track the second. This guide shows how to save and manage a baseline, how to make variance visible, how to enter progress, and exactly what the status date does to your schedule.

## What you'll learn here

- Saving and managing a baseline, and which baseline is active.
- Seeing variance: the baseline overlay in the Gantt and the variance report.
- Entering progress — percentage, actual dates — via the panel, the task dialog and the context menu.
- The status date: what it does to not-yet-started tasks and to unmarked milestones.
- Out-of-sequence warnings: what they mean and how to resolve them.
- Reading the progress line.

Follow along with [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (one baseline before start, plus progress and a status date partway through the project) and with [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (two baselines — a contract baseline and a rebaseline after a change order — with their own progress and status date).

## Saving and managing a baseline

Open the **Baselines** window via the **Baselines & progress** ribbon group on the **Planning** tab: **Save baseline…** immediately saves a new baseline with a suggested name ("Baseline 1 — [date]"), **Manage baselines…** opens the same window to review, rename or delete.

The window shows a table with every saved baseline: an **Active** radio button, the **Name** (editable directly), the **Created** date, and a delete button. Exactly one baseline can be active at a time — that's the baseline the Gantt overlay and the variance report compare against. Deleting the active baseline asks for confirmation (no baseline stays active afterward until you pick another one or save a new one). If the schedule is out of date since the last calculation, the window shows a hint next to "Save new baseline" to recalculate first — a baseline saved against an out-of-date schedule would freeze the wrong dates.

A baseline is a snapshot: the start, finish and (for milestones) date of every task at the moment you saved it. Change the schedule further afterward and the baseline stays unchanged until you save a new one yourself.

## Seeing variance

### In the Gantt: the baseline overlay

Turn the overlay on via **View → Baselines & progress ribbon group → Baseline overlay**. A thin sub-bar (or a diamond for a milestone) appears under every task bar, in the baseline color, at the original baseline dates. If the main bar runs past its sub-bar, you can see at a glance how far a task has slipped relative to the baseline — without opening a separate report.

### As a report: the variance report

Go to the **Report** tab, choose **Variance** for **Report type**. The report shows, per task: **Baseline start**, **Baseline finish**, **Current start**, **Current finish**, **Δ start (wd)**, **Δ finish (wd)** and a **Status** (**On schedule**, **Later**, **Earlier**, **New** for tasks added since the baseline, or **Dropped** for tasks removed since). At the top the report totals the number of tasks, how many are later and how many earlier, and — if the project end date has shifted — a line with the number of work days' difference relative to the baseline. If there's no active baseline, the report says so explicitly instead of showing an empty table.

## Entering progress

You set progress in three places, all with the same effect:

1. **Properties panel** — the **Progress** section under a selected task: a slider for **percent complete**, and (for a regular task) **Actual start**/**Actual finish** fields, or (for a milestone) a single **Actual date** field. Push the percentage above 0% without an actual start date, and it's filled in automatically with the planned early start; pull it back below 100% and any actual finish you'd entered is cleared again.
2. **Task dialog** — the same **Progress** section, in the **Edit task** window.
3. **Context menu** — right-click a task, **Progress** submenu, with the fixed steps **0%**, **25%**, **50%**, **75%** and **100%**. Handy for a quick update without opening a panel; for an in-between percentage or a specific actual date use the panel or the task dialog.

Actual dates can never be later than the status date — try to enter a later one and the app rejects it with an error. That's a deliberate boundary: a "fact" (something that actually happened) can, by definition, not lie in the future relative to the moment you're recording progress.

## The status date

The **status date** (**Baselines & progress** ribbon group on the Planning tab, **Status date** field) marks "today" within the schedule — the moment you recorded progress as of. Once it's set, it does two things at once:

- Any task or milestone that hasn't started yet (0% complete, no actual start) cannot begin earlier than the status date, even if the logic (predecessors, relations) would otherwise allow an earlier start. Its calculated early start gets "floored" to the status date.
- Tasks that have already started or finished keep their actual dates — those are never overwritten by the status date.

You can see this exactly in the medium-sized showcase: with the status date set to 20 May 2027, several not-yet-started tasks (for example bricklaying and plumbing work on different houses) have their early start pinned exactly on that date, even though they run in different houses and would, without the status-date floor, have started on various, earlier dates.

### Why an unmarked milestone "shifts to the right"

In the calculation a milestone is nothing more than a task with zero duration, so the same rule applies: if it hasn't been marked complete yet (no 100%, no actual date), its calculated date cannot fall before the status date. Keep pushing the status date forward without marking the milestone complete, and its displayed date in the Gantt keeps shifting right along with it, even though nothing has changed about the underlying tasks — the schedule is effectively saying "this moment can't lie in the past if you haven't checked it off yet." Once you do mark the milestone complete with an actual date, it snaps back to that fixed date and stops shifting.

## Out-of-sequence warnings

Once there's a status date, the calculation also checks whether the recorded facts (actual start/finish dates) don't contradict the logic of the relations — for example a successor that has already started while its predecessor, according to the schedule, shouldn't have finished yet. Such cases are called **out-of-sequence** and show up as a warning in the status bar at the bottom of the screen ("N out-of-sequence relation(s)"), with a tooltip for the count. It's a warning, not a blocking error — the calculation carries on regardless.

Resolve an out-of-sequence warning by recording the actual situation accurately: fill in the missing or incorrect actual start/finish date on the tasks involved (via the panel, the task dialog or the context menu, as above), so the recorded facts line up again with what logically must have preceded them. Often this simply means: a task that in reality has already finished wasn't yet marked as such in the schedule.

## The progress line

Turn the progress line on via **View → Baselines & progress ribbon group → Progress line**. It draws an orange dashed line (4/4 dashes, same style as the status-date line) that plots, for every task, a point at the position corresponding to its percent complete, and connects that to the status date — the classic zigzag pattern. A kink to the left of the status date means a task is behind what you'd expect based on elapsed time; a kink to the right means it's ahead. The progress line already draws the status-date vertical itself as the spine of the zigzag, so the separate **Status date line** toggle (same ribbon group) recedes while the progress line is on — it only becomes visible again once you turn the progress line off and still want the status date shown as a plain vertical line.

## Keep reading

- See a baseline before start and progress partway through in practice: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- See two baselines (Contract → rebaseline after a change order) in practice: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Resources and their load are also recalculated on every F5 — read the guide [Resources, histogram & leveling](docs://gids-resources-histogram) for overallocation and leveling.
- Progress and a status date can produce negative float on a task that's already fixed — read the guide [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) for how to read that.
