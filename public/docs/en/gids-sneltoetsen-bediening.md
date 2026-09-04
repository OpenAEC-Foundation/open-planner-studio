# Keyboard shortcuts & controls

This guide doesn't list keyboard shortcuts — that list already lives in one place, and a copy here
would go stale immediately. Instead, this explains **how to always pull up the current list**, and
which control concepts (context menus, dragging, box-select versus panning, zooming) are worth
understanding on their own.

## What you'll learn here

- How to open the always-current shortcuts overview.
- What each of the four context menus in the Gantt view contains.
- How dragging works: moving a bar versus drawing a relation.
- When a drag on empty canvas pans, and when it box-selects.
- Moving through visible tasks or histogram resources with the arrow keys.
- Zooming, document tabs and presentation mode.
- How to restart the tour.

## The always-current overview

Press **Ctrl+/** (or **Cmd+/** on macOS) to open the shortcuts overview — the same window is also
reachable via the **Shortcuts** button on the **View** ribbon tab. This window is read-only and is
built directly from the app's source code: a new shortcut shows up here automatically, with no
separate list for anyone to keep in sync. That's exactly why this guide doesn't duplicate the list —
a second, hand-maintained list would sooner or later drift from what the app actually does. The
window groups shortcuts by category: File, Edit, Structure, View and Navigation.

## Context menus: four kinds, depending on where you right-click

Right-clicking in the Gantt view gives a different menu depending on where the mouse is:

- **On a task bar** — the full task menu (edit, insert, add subtask/milestone/relation, assign
  calendar, progress, priority, trace path, delete…), plus one extra bar-specific item at the top:
  **Start relation from here**.
- **On a task row without a bar hit** (for example a row with no bar currently visible) — the same
  task menu, but without the bar-specific item.
- **On a group header row** (the row that summarizes a grouped set of tasks) — a small menu to
  collapse/expand that one group, plus **Expand all**/**Collapse all**, which open or close every
  group band at once (including bands nested inside a band).
- **On empty canvas** (no task, no group header) — **New task**, **Add milestone**, **Paste** (if
  there's something on the clipboard), **Reset zoom** and **Fit to project**.

This last menu was verified live: right-clicking an empty spot on the Gantt canvas produces exactly
these five items, in this order.

## Dragging on a task bar

Grabbing and dragging a task bar moves the task (or, when grabbing the edge, changes its duration).
While you drag an **edge**, a small dark pill appears against that edge showing the duration the
task would get — `15d`, for instance, or `6h` for a task planned in hours. It updates live as you
drag, so you see the new duration before you release the mouse button. Moving the whole bar does not
show it: that gesture leaves the duration unchanged.
Hold **Shift** while dragging from a bar, and instead you start drawing a **relation** to whichever
task you release on — the same thing as **Start relation from here** in the bar's context menu, but
in one mouse motion.

Click a bar to select just that task. **Ctrl/⌘+click** a bar toggles it into or out of the current
selection instead of replacing it, so you can build up a multi-task selection one bar at a time —
handy right before clicking the **Link** button with exactly two tasks selected, or before dragging a
whole selection of tasks to a new position at once in the task table.

First click in the **task list** or on a **Gantt bar**. Then **↑** selects the previous visible task
and **↓** the next visible task. The selection, properties panel and bar highlight follow straight
away. Collapsed, filtered-out or differently sorted tasks are not visited: you move through exactly
the list currently on screen.

Click the **resource picker** on the left of the histogram to make that surface active. There **↑**
and **↓** follow that same list: **All resources** first, then every project resource. This makes it
quick to compare resource load without repeatedly clicking a name. At either end, the current
selection remains in place. Arrow keys with Ctrl, Alt, Shift or ⌘ keep their existing meaning
elsewhere in the app.

## Panning versus box-select

A drag that starts on empty space does one of two things, and that depends on where you start it and
on your scroll mode (**Settings → Scroll & zoom**):

- **In the task table** (the left-hand column with WBS/name/duration), a drag on empty space is
  **always** a box-select — panning never happens there.
- **In the Gantt canvas itself**: if your scroll mode is set to **Zoom + drag** (map-style panning,
  the default), panning wins — exactly as you'd expect from a map application. On either of the other
  scroll modes (**Position** or **Keys**), that same drag on empty canvas is a box-select, letting you
  select multiple tasks at once by dragging a rectangle around them.

In short: the task table always selects; with the *left* button the canvas only pans in drag
scroll mode and selects otherwise.

Beyond that, one gesture works everywhere, always: dragging with the **middle mouse button**
(the scroll wheel) held down pans the view — in every scroll mode, and regardless of whether you
start on a bar, in the task table or on empty space. Handy when you're on the Position or Keys
mode but want a quick drag anyway.

## Zooming

Besides the zoom buttons on the ribbon, **+**/**=** (or **Ctrl+=**) zooms in and **-** (or
**Ctrl+-**) zooms out. A bare **0** resets zoom to the default; **Ctrl+0** adjusts zoom so the whole
project fits on screen ("fit to project") — the same as the button with that name in the empty-canvas
context menu above. The timeline header adapts as you zoom in further: week numbers appear once
there's room for them, and day names label each column once you're zoomed in close enough to work at
day level. If **Show only working days** (Settings → Timeline / Zoom) is on, the header — and the
bars themselves — skip weekends and holidays entirely instead of just greying them out, so a
5-workday task is exactly 5 columns wide.

## Document tabs

If you have several projects open at once (each in its own document tab), **Ctrl+1** through
**Ctrl+9** jump straight to the first through ninth document tab.

## Presentation mode

**F11** toggles presentation mode — a full-screen view without the ribbon and side panels, meant for
showing the schedule without the editing chrome around it. **Esc** exits presentation mode again
(and, on a subsequent press, performs the usual "clear selection").

## Restarting the tour

Want to run the introduction tour again (for example to show someone else the app)? There are two
places to do that: the **Tour** button on the **View** ribbon tab, or **Start tour** in the Backstage
navigation (the row just above Settings). Both start the tour immediately, without showing the
welcome dialog first.

## Further reading

- Open the shortcuts overview itself with **Ctrl+/** — that's the binding source, not this guide.
- Scroll and zoom behaviour is configured under **Settings → Scroll & zoom**, available in all three
  of the app's fixed settings locations (the gear icon, the Settings ribbon tab, and Backstage →
  Settings).
