# External relations to another project

Goal: link a task in this project to a task in another project file, so your schedule takes account of work that is planned elsewhere.

## When you need this

Your extension can only start once the site has been made ready for building, and that work is in the contractor's project. Or the installer can only start once your structure is finished, and he plans in his own file. An ordinary relation only works between tasks in the same project. An **external relation** links a task to a task in another file.

An external relation does not calculate live with the other project. The app stores a fixed **anchor date**: the date of the external task at the moment you link it. The calculation uses that date as a limit. If the other project changes, nothing moves in yours until you refresh the anchor.

## Steps

1. Select exactly one task in this project: the task that depends on the external task, or that the external task depends on.
2. Choose *Home › Tasks › Link ▾ › Add external relation…*. The same menu is on *Planning › Relations* and on *Table › Tasks*. The item is only available if exactly one task is selected.
3. In the window *External (cross-project) link* choose one of the two routes. With *Source file* you pick the project file under *Choose a recent file* and then the *Source task*; the app reads the file read-only, does not open it as a document, and takes over the anchor date itself. This route only works in the desktop app and only for a file in the list of recent files; otherwise the *Source file* button is disabled. With *Manual (fallback)* you fill in the *Project id* and *Task id* of the external task, optionally a *Task name (optional)*, and the *Anchor date*. In the browser version this is the only route.
4. Under *Direction* choose whether the external task is your predecessor or your successor: *Predecessor (external → me)* or *Successor (me → external)*.
5. Choose the *Relationship type* (FS, SS, FF or SF) and fill in a *Lag (work days)* if needed, for example `0d` or `2d`.
6. Click *Add link* and press **Calculate** (F5).

Which date you enter as the anchor for a manual link depends on the direction and the type:

- With an external **predecessor** the first letter of the type counts: F means the finish date of the external task, S the start date. With FS and FF you therefore enter the finish, with SS and SF the start.
- With an external **successor** the second letter counts: S is the start date of the external task, F the finish date. With FS and SS you therefore enter the start, with FF and SF the finish.

If you plan in hours (hour planning on and a task on a calendar with working times), the *Anchor date* field also asks for a time.

Example: the site project finishes on Friday 18 June 2027. You link *Groundwork* with an external predecessor of type FS, anchor date 18 June 2027. After **Calculate** the groundwork starts on Monday 21 June, the first work day after the anchor. An external successor works the other way round: it limits how late your task may finish.

## What you see and how you manage it

- External links appear as text in the *Predecessors* and *Successors* columns of the task list (add them with the **+** in the table header, under *Relations*), with the name of the project and the task, and the type. A small triangle with *Source missing* shows that the source has not been read; hold your mouse over the link for the project (the *Project id* line shows the project name once it is known), the Task id, the anchor date and the source status.
- In the Gantt there is a grey ghost bar at the task. With a predecessor it ends on the anchor, with a successor it starts on it. A dashed border with the red label *outdated* means the source has not been read. With a manual link that is always the case.
- Right-click a link in the column for *Edit external relationship…* and *Delete relationship*. If the link has a source file, *Refresh source* is there as well.
- Choose *Link ▾ › Refresh all external relations* to read the source files again and update the anchors. That only works in the desktop app. If you only have manual links, the app says *No refreshable external sources (file path missing).* Press **Calculate** after a refresh.
- If you change the type or direction so that the anchor needs another side of the external task (start instead of finish, or the other way round), the app asks for a new anchor with a manual link: *Choose a new anchor: the relationship type now uses the other side of the source task.* With a link that has a source file, the app reads the anchor again itself.

## Pitfalls and what the app does

**The other project does not move along.** If the external task changes date, your schedule keeps calculating on the old anchor until you refresh it or change the anchor. With the manual route you change the anchor date yourself, by right-clicking the link and choosing *Edit external relationship…*.

**An external predecessor is a lower limit.** If your task starts later than the anchor demands because of its own predecessors, that relation wins. The anchor only pushes.

**An external successor is an upper limit.** If the anchor is too tight, you see that as negative float on your task and the tasks before it. No separate warning appears with it, so keep an eye on the *Total float* column.

**Only a fixed lag.** For an external relation you cannot give a lag in calendar days or percentages; the app says *External relationships only support a fixed lag in working days or working time.* The work days count in the calendar of your own task. A lag in hours only counts for a task that is planned in hours; for a task in days the calculation ignores it. Use work days then.

**The Project id of another file.** The Project id is not in a field or column, but is stored as `InternalProjectId` in the IFC of that project: open the project, go to the *IFC* tab and choose *Generate IFC*. The calculation only uses the anchor date; the id is not a mere label. When refreshing, the app first recognises a source file by its Project id (then by its file path). If you enter the same id with a manual link as that of a source file, the link is updated along when that file is refreshed. You find the *Task ID* of a task in the other project in that project's table, in the *Task ID* column under *Technical*.

## See also

- [Relations and lag](docs://uitleg-relaties): how the app calculates a relation and a lag.
- [Adding relations](docs://howto-relaties-leggen): relations between tasks in the same project.
- [Constraints and deadlines](docs://uitleg-constraints): date limits on a task, without another project.
