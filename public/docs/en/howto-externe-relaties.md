# External relations to another project

Goal: link a task in this project to a task in another project file, so your schedule takes account of work that is planned elsewhere.

## When you need this

Your extension can only start once the site has been made ready for building, and that work is in the contractor's project. Or the installer can only start once your structure is finished, and he plans in his own file. An ordinary relation only works between tasks in the same project. An **external relation** links a task to a task in another file.

An external relation does not calculate live with the other project. The app stores a fixed **anchor date**: a date of the external task at the moment you link it. With an external predecessor that is the planned date, with an external successor the latest date the other project allows. The calculation uses that date as a limit. If the other project changes, nothing moves in yours until you refresh the anchor.

## Steps

1. Select exactly one task in this project: the task that depends on the external task, or that the external task depends on.
2. Choose *Home › Tasks › Link ▾ › Add external relation…*. The same menu is on *Planning › Relations* and on *Table › Tasks*. The item is only available if exactly one task is selected.
3. In the window *External (cross-project) link* choose one of the two routes. With *Source file* you pick the project file under *Choose a recent file* and then the *Source task*; the app reads the file read-only, does not open it as a document, and takes over the anchor date itself. This route only works in the desktop app and only for a file in the list of recent files; otherwise the *Source file* button is disabled. With *Manual (fallback)* you fill in the *Project id* and *Task id* of the external task, optionally a *Task name (optional)*, and the *Anchor date*. In the browser version this is the only route.
4. Under *Direction* choose whether the external task is your predecessor or your successor: *Predecessor (external → me)* or *Successor (me → external)*.
5. Choose the *Relationship type* (FS, SS, FF or SF) and fill in a *Lag (work days)* if needed, for example `0d` or `2d`.
6. Click *Add link* and press **Calculate** (F5).

Which date you enter as the anchor for a manual link depends on the direction and the type:

- With an external **predecessor** the first letter of the type counts: F means the finish date of the external task, S the start date. With FS and FF you therefore enter the finish, with SS and SF the start.
- With an external **successor** the second letter counts: S is the start of the external task, F the finish. Enter the latest date the other project allows: with FS and SS the *Late start* of the external task, with FF and SF its *Late finish*.

If you plan in hours (a task on a calendar with working times), the *Anchor date* field also asks for a time.

Example: the site project finishes on Friday 18 June 2027. You link *Groundwork* with an external predecessor of type FS, anchor date 18 June 2027. After **Calculate** the groundwork starts on Monday 21 June, the first work day after the anchor. An external successor works the other way round: it limits how late your task may finish.

## What you see and how you manage it

- External links appear as text in the *Predecessors* and *Successors* columns of the task list (add them with the **+** in the table header, under *Relations*), with the name of the project and the task, and the type. A small triangle with *Source missing* shows that the source has not been read; hold your mouse over the link for the project (the *Project id* line shows the project name once it is known), the Task id, the anchor date and the source status.
- In the Gantt there is a grey ghost bar at the task. With a predecessor it ends on the anchor, with a successor it starts on it. A dashed border with the red label *outdated* means the source has not been read. With a manual link that is always the case.
- Right-click a link in the column for *Edit external relationship…* and *Delete relationship*. If the link has a source file, *Refresh source* is there as well.
- Choose *Link ▾ › Refresh all external relations* to read the source files again and update the anchors. That only works in the desktop app. If you only have manual links, the app says *No refreshable external sources (file path missing).* Press **Calculate** after a refresh.
- If a new version of a source file is saved, the desktop app notices it when you open the document and when you return to the window. If an anchor changes, a bar appears under the ribbon, for example *Installateur.ifc has a new version, saved on Nov 3, 2026 18:11 (author: Anna de Vries). 2 links change.* The author comes from the project details of the source. Click *Review*: the window shows the *Anchor now* and the anchor *After accepting* for each link, and what moves in your schedule, for example *Accepting moves 2 tasks.* and *The project finish moves from 30-03-2027 to 01-04-2027 (+2 working days).* The window compares with the schedule as you see it now, also in the view [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen). If you did not recalculate after a change, that change counts in what moves: *Accept* recalculates everything. With *Accept* the app takes over the new anchors and recalculates the schedule, as one step for *Undo*. With *Later* everything stays as it is; the bar only comes back with a next version of the source. The app never takes over a new version by itself. If no anchor changes, no bar appears.
- Hover over the link to see where the anchor comes from. The line *Anchor origin* shows the modification time of the source file and when the app read the anchor, for example *source file of Nov 2, 2026 14:05, read on Nov 2, 2026 14:10*. So you can see afterwards which version of the other project your schedule used. If you fill in the anchor yourself, it has no origin and the line is missing.
- If you change the type or direction so that the anchor needs another side of the external task (start instead of finish, or the other way round), the app asks for a new anchor with a manual link: *Choose a new anchor: the relationship type now uses the other side of the source task.* With a link that has a source file, the app reads the anchor again itself.

## Pitfalls and what the app does

**The other project does not move along.** If the external task changes date, your schedule keeps calculating on the old anchor until you accept the new version, refresh the anchor or change it. With the manual route you change the anchor date yourself, by right-clicking the link and choosing *Edit external relationship…*.

**An external predecessor is a lower limit.** If your task starts later than the anchor demands because of its own predecessors, that relation wins. The anchor only pushes.

**An external successor is an upper limit.** As the anchor the app takes the *Late start* or the *Late finish* of the external task, not the planned date. That way the float the external task has in its own project also counts in yours, as in Primavera P6 with both projects open. Example: *Installation* is planned for Monday 1 March 2027 and may start on Monday 15 March at the latest. Your structure has an external successor of type FS to *Installation*. Your structure then gets 10 working days of float, not 0. If the source file has no late dates, or that side of the external task has already happened (started or finished), the app takes the *Early start* or the *Early finish*. If you still want to hold on to the planned date, set a deadline or a constraint on your task. If the anchor is too tight, you see that as negative float on your task and the tasks before it. No separate warning appears with it, so keep an eye on the *Total float* column.

**Only a fixed lag.** For an external relation you cannot give a lag in calendar days or percentages; the app says *External relationships only support a fixed lag in working days or working time.* The lag counts in the project's *Lag calendar*, just like for an ordinary relation (see [Calculation options and conventions](docs://ref-rekenopties-en-conventies)). If you choose *24-hour* or *Project calendar* there, the lag counts in that calendar. If you choose *Predecessor* or *Successor* and that side is in the other project, the app does not know its calendar. The lag then counts in the calendar of your own task, and the *Warnings* panel says so at the task. A lag in hours counts for every task, also for a task in days: 2 hours after an anchor at 07:00 is 09:00. A fraction is allowed, for example `0.5d`.

**The Project id of another file.** The Project id is not in a field or column, but is stored as `InternalProjectId` in the IFC of that project: open the project, go to the *IFC* tab and choose *Generate IFC*. The calculation only uses the anchor date; the id is not a mere label. When refreshing, the app first recognises a source file by its Project id (then by its file path). If you enter the same id with a manual link as that of a source file, the link is updated along when that file is refreshed. You find the *Task ID* of a task in the other project in that project's table, in the *Task ID* column under *Technical*.

## See also

- [Adding relations](docs://howto-relaties-leggen): relations between tasks in the same project.
- [Setting a constraint or deadline](docs://howto-constraint-deadline-zetten): date limits on a task, without another project.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contains an external link on *Car park paving* (an external predecessor).
