# Using split view and the mini-map

Goal: see two stretches of the timeline side by side, and move quickly through a long schedule.

## When you need this

You are discussing the start of the foundation and, at the same time, the handover nine months later. Without help you keep zooming in and out and lose track of where you were. With **split view** you see the same schedule twice, side by side, each with its own time window. With the **mini-map** you see the whole project period in one narrow strip, and you jump with a click to the part you are looking for.

## Steps

### Turning on split view

1. Choose the *View* tab. In the *Presentation* group are *Presentation*, *Split view* and *Mini-map*.
2. Click *Split view*. The Gantt splits in two. Both windows start with the zoom and position of your current view.

The two windows share the task list, the rows and the vertical scroll. What each window has for itself is the time axis: zoom and horizontal position.

### Giving each window its own stretch of time

- Zoom and scroll in the window your mouse is over. With the default setting for *Scroll & zoom* (*Zoom + drag*) the mouse wheel zooms in that window, centered on your mouse. If your setting follows another mode, the wheel does in both windows what that mode says.
- With the default setting you scroll through the rows with Shift plus the mouse wheel. That applies to both windows at once.
- The buttons *Zoom +* and *Zoom -* and the time scale list (for example *Quarter*) only work on the left window. So you zoom the right window with the mouse wheel.
- Drag the bar between the two windows to the left or right to make them wider or narrower. They start at half.

### Turning off split view

Click *Split view* again. One window remains, with the view of the left window. A new split view starts again with the view of that moment.

### Turning on the mini-map

1. In the *Presentation* group, click *Mini-map*.
2. Below the timeline a strip appears of the whole project period, with the tasks of your current view as thin dashes (so after a filter only the tasks that filter shows) and a frame around the part you see now.
3. Click anywhere on the strip to put the frame there. The window centers on that spot. Or grab the frame and drag it.

The mini-map only moves the time window. The rows stay as they are.

If split view is on, each window gets its own strip, under its own part of the timeline. Each strip controls only the window above it.

## Pitfalls and what the app does

**The mini-map does nothing if the whole project is already in view.** If you zoom out so far that the whole schedule fits, there is nothing to move to and clicking has no effect. Zoom in first.

**The mini-map is only on the Gantt.** On the *Table*, *IFC* and *Report* tabs and in the full resource panel (*Resources*, not *Resource dock*) there is no timeline, so no mini-map and no split view either. They are back as soon as you return to a view with the Gantt.

**Split view belongs to the project, the mini-map does not.** Split view applies to the open project: if you switch to another project and back, it is still there. The mini-map is one choice for all projects and stays on or off after a restart. Both are screen choices: they do not go into the project file, do not make the project "modified" and are not in *Undo*.

**Split view and presentation.** Both stay in view when you turn on presentation mode (see [Presenting on a large screen](docs://howto-presentatie)). Because the ribbon is gone then, you can no longer turn them on or off in that mode. So set them up properly before you start.

## See also

- [Presenting on a large screen](docs://howto-presentatie): the Gantt full screen, without the ribbon.
- [Creating and using a layout](docs://howto-layouts-gebruiken): the time scale can also be stored as part of a layout.
