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
  calendar, progress, priority, trace path, delete…), plus two extra bar-specific items at the top:
  **Start relation from here** and **Set constraint…**.
- **On a task row without a bar hit** (for example a row with no bar currently visible) — the same
  task menu, but without the two bar-specific items.
- **On a group header row** (the row that summarizes a grouped set of tasks) — a small menu to
  collapse/expand that one group, plus **Expand all**/**Collapse all** for the whole tree.
- **On empty canvas** (no task, no group header) — **New task**, **Add milestone**, **Paste** (if
  there's something on the clipboard), **Reset zoom** and **Fit to project**.

This last menu was verified live: right-clicking an empty spot on the Gantt canvas produces exactly
these five items, in this order.

## Dragging on a task bar

Grabbing and dragging a task bar moves the task (or, when grabbing the edge, changes its duration).
Hold **Shift** while dragging from a bar, and instead you start drawing a **relation** to whichever
task you release on — the same thing as **Start relation from here** in the bar's context menu, but
in one mouse motion.

## Panning versus box-select

A drag that starts on empty space does one of two things, and that depends on where you start it and
on your scroll mode (**Settings → Scroll & zoom**):

- **In the task table** (the left-hand column with WBS/name/duration), a drag on empty space is
  **always** a box-select — panning never happens there.
- **In the Gantt canvas itself**: if your scroll mode is set to **Drag** (map-style panning), panning
  wins — exactly as you'd expect from a map application. On either of the other scroll modes
  (**Position** or **Modifier mapping**), that same drag on empty canvas is a box-select, letting you
  select multiple tasks at once by dragging a rectangle around them.

In short: the task table always selects; the canvas only pans in drag scroll mode and selects
otherwise.

## Zooming

Besides the zoom buttons on the ribbon, **+**/**=** (or **Ctrl+=**) zooms in and **-** (or
**Ctrl+-**) zooms out. A bare **0** resets zoom to the default; **Ctrl+0** adjusts zoom so the whole
project fits on screen ("fit to project") — the same as the button with that name in the empty-canvas
context menu above.

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
