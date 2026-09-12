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
- Straight from the Resources ribbon: **Distribute…** sits there too.

If you haven't picked a library item yet, that ribbon button first opens a list of the items that are
currently double-booked across the open projects, with the number of projects and the number of
conflict days on each row. One click on a row starts the proposal. If nothing is double-booked
anywhere, the dialog simply says so: "No library item is currently double-booked across the open
projects." During a distribution in progress, **Choose another item…** at the bottom takes you back to
that list; note that this also drops the "Applied in … projects" bar.

The dialog opens with the title "Distribute over projects" and shows which library item it concerns
at the top. You close it with the cross in the top-right corner, with Esc, or with **Discard** at the
bottom — in all three cases nothing changes, and the occupancy overview simply stays underneath the
dialog, so there's no separate "back" step needed.

### Trying it out with the examples

The bundled showcases already carry this conflict. Via **File → Examples**, open all three showcases
— [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc),
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) and
[Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — each in its
own tab, press F5 in every project and then go to **Resources → Occupancy**. Exactly two rows are
red, and that is deliberate: on every other point the company is comfortably big enough for these
three projects combined.

The first is **Masonry crew**: there is only one such crew, and in early June it is laying the walls
of the family home extension and of house 6 in De Akkers at the same time. That is the textbook
case — two projects, one crew, neatly resolved by moving one of them slightly. The second is
**Plasterers**: a single plastering crew that appears in all three projects, and that the apartment
complex alone already wants on three towers at once. That one is resolvable too, but it costs the
apartment complex a sizeable delay — instructive to compare with the first case.

Click **Masonry crew**, then **Distribute…** on that row and let
**Distribute automatically** build the proposal; then drag a project's grip to the right, or pin a
project, and watch what happens to the proposed shift.

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
only give way through overrun. Next to the switch you see what it buys you, as a single difference:
with the switch off it reads "would save 3 workdays", with it on "saves 3 workdays". If interrupting
buys nothing here, it says so plainly.

## The bar is the control

Below the switch, each project gets one bar on one shared timeline. On the left the project name with
a colour dot and the slack it still has, in the middle the bar itself, on the right the outcome.

Inside the bar you see one block per workday in the project's colour, separated by a thin white line
— so you can literally count the days. A **hatched** block is a pause day: a workday on which the
distributor holds the work still to make room for another project. Those only appear when "Allow
interruptions" is on.

A thin gauge runs along the bottom of the bar. The **grey dotted** part is the slack this project
still had: it may shift that far without moving its end date. The **solid red** part is everything
beyond that — real end-date shift. A bar without red costs the project nothing.

To the right of the last block sits a **grip** with three strokes. Drag it to the right to allow this
project more overrun; the distributor then decides for itself which days to pause on and how much of
that room it actually needs. Whatever you allowed but turned out not to be needed shows up as a
**dotted box** behind the bar. While you drag, the app recalculates: the other bars, the chart and
the outcomes move under your hand. On a very large overview it does not — there the calculation
follows when you release.

The same grip works from the keyboard: the arrow keys move one workday, PageUp and PageDown three,
Home sets the ceiling to zero and End makes it unlimited.

To the right of the bar sits the outcome: a coloured pill with what happens to the end date (green at
zero, amber at a day or two, red above that), and below it the latest date you allowed plus how many
of those days are actually used.

## Pinning or a ceiling

For each project you have two ways to limit the room it gives up:

- **Pin** freezes a project completely: both its end date and its workdays stay exactly as they are
  now. A pinned project never gives up room — it counts in the calculation as a fixed load that the
  other projects have to plan around.
- The **ceiling** ("Maximum overrun of the end date") only limits *how much* a project may shift, not
  *whether* it may shift. A ceiling of 0 workdays means the end date may not move, but the slack
  already present within the existing schedule may still be used — that's different from pinning,
  where even the workdays within the task no longer change.

Pinning is the **pin** text button next to the project name; it turns into **pinned — unpin**. The
ceiling is the grip in the bar, as described above. The **Reset** button at the bottom puts every
ceiling and pin back to neutral in one go; the "Allow interruptions" switch stays as it is, because
that is a choice about the tool and not about one project.

## Before and after

Below the bars sits a chart with two states, "Now" and "After distributing": how the load
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
  projects already occupy the resource up to the company capacity. Allow that other project more
  overrun with its grip, or pin it so the rest can plan around it.

A project with **["Dates as recorded"](docs://datums-zoals-opgeslagen)** turned on never takes part in
a distribution — leave that mode in that project first before adding it to a distribution proposal.

## Recalculated automatically, or with the button

There is no separate mode for automatic calculation: at the bottom of the dialog sits a single
button, which reads **"Distribute automatically"** as long as there's no proposal yet, and
**"Recalculate"** afterwards. Changing a ceiling, a pin, or the "Allow interruptions"
toggle makes the dialog recalculate the proposal right away on its own — you don't have to press the
button for that yourself. Only on a very large overview (many tasks in one of the involved projects,
or many tasks that book against this item) does the dialog switch that automatism off; it then reports
that it only calculates once you press **Recalculate** yourself.

If something is edited in one of the involved projects while the dialog is open — for example by an
AI assistant, by another edit, or because you press **Apply** yourself — the dialog reports the
proposal as no longer current. That is never recalculated automatically: press **Recalculate**
yourself when that happens.

## The line below the chart

Below the chart there is always one line with the verdict. Green means the conflict is resolved, with
the largest end-date shift and the project carrying it. Red means a shortfall remains, with the first
days on which it goes wrong. If every project is pinned, that line says there is nothing to
redistribute and that you should unpin one. If the proposal is no longer current — because you
changed something, or because someone worked in one of the projects — that shows up there too.

That line is always there, even when there is nothing to report. That is deliberate: it stops the
rest of the screen from jumping whenever something changes.

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

The choices you make in this dialog — pins and ceilings — belong to this one session, just like
the "applied" strip: they stay in place for as long as you keep working in the app, even across a
document switch, and only reset to neutral once you go distribute a different library item
or restart the app. Nothing about them is stored in the project itself.

## The boundary

"Distribute over projects" only sees, just like the occupancy overview it grows out of, the documents
that are open in this app right now. A project that isn't open doesn't take part, even if it's linked
to the same library; and a colleague planning on a different machine never counts here.
