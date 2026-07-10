# Baseline management

The **Baselines** window manages the saved snapshots of the schedule: saving, renaming, choosing the active baseline and deleting.

## Opening

**Planning** → ribbon group **Baselines & progress** → **Save baseline…** or **Manage baselines…** (both open the same window). **Esc**, **Close**, the close cross or a click outside the window closes; all changes in this window take effect immediately.

## The baseline table

One row per saved baseline:

- **Active** — radio button; exactly one baseline can be active. The active baseline is the comparison basis for the baseline overlay in the Gantt and the variance report.
- **Name** — editable directly in the row.
- **Created** — the date the baseline was saved.
- **Delete** (trash can) — removes the baseline. If it is the active one, the window first asks for confirmation ("Delete the active baseline?"); after that the most recently saved remaining baseline becomes active, or none if nothing is left.

Without baselines the window shows "No baselines yet".

## Save new baseline

- **Name field** — pre-filled with "Baseline {n} — {date}"; adjust the name as desired.
- **Save** — records the start, finish and (for milestones) the date of every task and makes the new baseline active.
- **Warning** — if the schedule is out of date since the last calculation, "Schedule is out of date — recalculate first (F5)" appears: a hint, not a block. A baseline on a stale schedule would freeze the wrong dates.

## Further reading

- [Baselines & progress](docs://gids-baselines-voortgang) — baseline overlay, variance report, progress and status date.
