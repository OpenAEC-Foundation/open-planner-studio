# Leveling options

The **Level resources** window resolves overallocation by shifting tasks. It works in two steps: **Calculate** builds a proposal (nothing changes yet), **Apply** carries it out.

## Opening

**Resources** → ribbon group **Leveling** → **Level…**. **Esc**, the close cross or a click outside the window closes without applying.

## Options

- **Level only within slack (smoothing) — project end date stays fixed** — when ticked, leveling shifts tasks only within their total float: the end date cannot move, but not every conflict can then be resolved. Unticked (default), the project end date may extend to resolve all conflicts.
- **Resources** — a checkbox per resource: which resources take part. Material resources are absent here (material is not leveled). All resources are on by default.

## Calculate

Requires an up-to-date calculation; otherwise the window shows "Calculate the schedule (F5) before leveling." The button is also disabled while no resource is ticked. Any option change invalidates an earlier proposal — calculate again.

## Proposal (preview)

- **Project end date line** — "unchanged (date)" or "old date → new date" (red) if the project extends.
- **Table** — per shifted task: **Task**, **Old start**, **New start** and **Days shifted**. Non-resourced successors that shift along through the logic are included too.
- If there is nothing to do, the window reports "No tasks need to move — the schedule is already conflict-free."

## Remaining conflicts

Tasks that do not fit within the rules, with per task the number of conflict days and a reason:

- "… peaks at … units/day, capacity is … — cannot be resolved by shifting." — an assignment demands more at its peak than the resource capacity; lower the units/day or raise Max units.
- "The resource does not work on all days this task needs — shifting cannot resolve this." — calendar mismatch between task and resource.
- "Not enough free capacity within the slack to resolve this conflict." — mostly with smoothing: no free window within the available float.

## Apply and undo

**Apply** carries out the proposal and closes the window; **Cancel** closes without change. Undo an applied leveling with **Clear leveling** (same ribbon group) or Ctrl+Z.

## Further reading

- [Resources, histogram & leveling](docs://gids-resources-histogram) — spotting overallocation in the histogram and the full leveling workflow.
