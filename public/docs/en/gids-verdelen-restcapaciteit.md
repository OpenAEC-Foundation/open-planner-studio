# Distributing across projects

The [occupancy overview](docs://gids-bezettingsoverzicht) shows which resource is double-booked
across your open projects. This guide covers the next step: actually resolving that double booking,
without having to open every project separately and shift things by hand.

## When you use this

Use "Distribute over projects" as soon as the occupancy overview shows a conflict row: a library item
whose combined bookings across several projects exceed the company capacity. Instead of tackling that
conflict project by project, this dialog looks at all the involved projects at once and proposes a
single shift that fits within what's actually available.

## Opening the dialog

There are two entry points:

- From a conflict row in the occupancy overview: the **Distribute…** button.
- From the Resources ribbon, whenever a conflict is open.

The dialog opens with the title "Distribute over projects" and shows which library item it concerns
at the top. You close it with the cross in the top-right corner, with Esc, or with **Discard** at the
bottom — in all three cases nothing changes, and the occupancy overview simply stays underneath the
dialog, so there's no separate "back" step needed.

A few situations block the distribution right away, with a clear reason:

- One of the involved projects hasn't been calculated yet — calculate it first (F5) in that project.
- The chosen item is a material item; distributing only works for people and equipment.
- None of the projects actually book work here — there's nothing to distribute.

## Allow interruptions

At the top of the dialog sits the **"Allow interruptions"** toggle. It determines how a task is
allowed to give way when there isn't enough capacity. With the toggle off, a task that doesn't fit
shifts as a whole to a later moment. With it on, a task may also get pause days — whole workdays
without deployment in between the days it is deployed — instead of shifting in one piece. This is
exactly the same switch as "Leveling can create splits in remaining work" in Microsoft Project.

Work that has already started is never interrupted, whether this toggle is on or off: that part can
only give way through overrun. Whatever the toggle is set to, the dialog shows the price tag in
workdays of overrun, so you can weigh the effect before you apply.

## Who gets spared the most?

Below that sits the ranking list **"Who gets spared the most?"**. This is the order in which
projects get priority: the project at the top wiggles the least, and each project below it gives way
first whenever a choice has to be made. Drag a project to change the order, or use the arrow buttons
to move it up or down one place.

Next to each project you'll see the slack it still has, and what it would cost to let only this
project shift — in workdays of overrun. That way you can see straight away which project is the
cheapest place to absorb the shift, instead of having to guess.

## Pinning or a ceiling

Below that, on a strip per project, you have two ways to limit the room it gives up:

- **Pin** freezes a project completely: both its end date and its workdays stay exactly as they are
  now. A pinned project never gives up room — it counts in the calculation as a fixed load that the
  other projects have to plan around.
- The **ceiling** ("Maximum overrun of the end date") only limits *how much* a project may shift, not
  *whether* it may shift. A ceiling of 0 workdays means the end date may not move, but the slack
  already present within the existing schedule may still be used — that's different from pinning,
  where even the workdays within the task no longer change.

The ceiling is a draggable handle on each project's phase strip: drag it, or use the arrow keys to
move it one workday at a time, Home for a ceiling of 0, and End for unlimited. The label next to the
handle shows what that means for the project's end date, and if less overrun turned out to be needed
than you had allowed, the label says so explicitly: "requested X, closest achievable Y".

## Before and after

Below the phase strips sits a chart with two states, "Now" and "After distributing": how the load
currently runs against the library's capacity line, and how that changes once you apply the proposal.
If a shortfall remains despite every setting, the dialog shows next to it which tasks don't fit per
project, and **Apply** stays disabled with the reason next to it.

## Why it sometimes doesn't work out

A task that can't be shifted gets a plain-language reason instead of just a red mark:

- **The resource doesn't work on the days the task needs.** The resource's calendar excludes the days
  the task requires; shifting within this slack doesn't fix that.
- **Not enough free capacity within the slack.** There is some room, but not enough to resolve this
  conflict within the available slack.
- **At its peak, the task demands more than the capacity allows**, no matter how you shift it — this
  is a task you can only fix by lowering the demand itself, not by scheduling around it.
- **The ceiling is too tight.** Within the allowed number of workdays of overrun, no free window can
  be found. Widen the ceiling, or allow interruptions.
- **A deadline or another scheduling constraint holds the task in place** — allowing extra overrun
  won't help then, because the task isn't allowed to move from there regardless.
- **No free window was found within the searched period.** Further out in time it's unknown whether
  there's room — this isn't a definitive "no", it just means the search period wasn't long enough.
- **The library's residual capacity is used up.** This project's own demand still had room, but other
  projects already occupy the resource up to the company capacity. Give that other project a lower
  spot in the ranking, or pin it so the rest can plan around it.

A project with **["Dates as recorded"](docs://datums-zoals-opgeslagen)** turned on never takes part in
a distribution — leave that mode in that project first before adding it to a distribution proposal.

## Recalculated automatically, or with the button

There is no separate mode for automatic calculation: at the bottom of the dialog sits a single
button, which reads **"Distribute automatically"** as long as there's no proposal yet, and
**"Recalculate"** afterwards. Changing the ranking, a ceiling, a pin, or the "Allow interruptions"
toggle makes the dialog recalculate the proposal right away on its own — you don't have to press the
button for that yourself. Only on a very large overview (many tasks in one of the involved projects,
or many tasks that book against this item) does the dialog switch that automatism off; it then reports
that it only calculates once you press **Recalculate** yourself.

If something is edited in one of the involved projects while the dialog is open — for example by an
AI assistant, by another edit, or because you press **Apply** yourself — the dialog reports the
proposal as no longer current. That is never recalculated automatically: press **Recalculate**
yourself when that happens.

## Applying and undoing

Once the proposal is valid and everything fits, **Apply** writes the shift into all the involved
projects at once — even into a project where **Calculate automatically** is switched off. Each
project gets an ordinary undo step for it, just as if you had shifted things there by hand yourself.
If writing to a project unexpectedly fails, nothing changes anywhere and you get an error message —
Apply never fails halfway, and never silently.

After applying, a strip "Applied in N projects" appears at the bottom of the dialog with an
**Undo all** button. That strip survives switching, closing and opening projects within the same
session: close the dialog, switch to a different document, or close and reopen a project — open the
dialog again afterwards from the same conflict row, and the strip is still there. It only disappears
through **Undo all**, through a new **Apply**, or by going on to distribute a different library item.

Undoing reverts the step in every project — except one where you yourself worked further, after
applying: that project is then named explicitly and stays at its new state, while the rest is
reverted normally. Right after applying, the dialog also reports the proposal itself as "no longer
current" — that isn't a glitch: the projects have, after all, just changed. Press Recalculate if you
want to distribute again from the same dialog.

The choices you make in this dialog — ranking, pins, ceilings — belong to this one session, just like
the "applied" strip: they stay in place for as long as you keep working in the app, even across a
document switch, and only reset to a neutral ranking once you go distribute a different library item
or restart the app. Nothing about them is stored in the project itself.

## The boundary

"Distribute over projects" only sees, just like the occupancy overview it grows out of, the documents
that are open in this app right now. A project that isn't open doesn't take part, even if it's linked
to the same library; and a colleague planning on a different machine never counts here.
