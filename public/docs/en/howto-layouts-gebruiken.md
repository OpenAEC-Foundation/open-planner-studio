# Creating and using a layout

Goal: switch between views of your schedule with one click, for example only the critical tasks, the tasks per crew or a different sort order.

## When you need this

In the site meeting the client wants to see only the critical tasks. Then the site manager wants to look per crew at who is needed when. Then you want the whole schedule again. Setting filters, groups and sort orders again and again is cumbersome. A **layout** stores such a view as a button in the ribbon.

A layout can store six things: the filter, the grouping, the sorting, the columns of the task table next to the Gantt, the time scale, and the relationship lines and overlays (baseline, progress line, status date line, resource accent, float band and bar colors). Only what you tick changes when you click the button. The rest of your view stays as it is.

You filter, group and sort with a layout. The separate buttons *Filter…*, *Group…* and *Sort…* now only exist behind a hidden setting (see the pitfalls).

## Steps

### Using an existing layout

1. Choose the *View* tab. In the *Layout* group there is a button per layout. By default that is *Resource diagram*.
2. Click it. *Resource diagram* groups the tasks per resource, sorts within each group on start and turns the relationship lines off. A task with two resources appears under both.
3. Click again to turn the layout off. The view returns to what it was before your click.

Each click is one step for *Undo* (Ctrl+Z), both turning on and turning off.

### Making your own layout

1. In the *Layout* group, click *New layout*. The *New layout* window opens.
2. Type a *Name* and choose an *Icon*.
3. Under *What does this layout store?* are the six parts with a checkbox. A new window starts with all parts ticked and filled with what is on your screen now. Untick everything the layout must not change. If you only want a filter, leave only *Filter* on. *Take over the current view* fills all parts again with your screen.
4. Set up the parts.
5. Click *Save*.

The layout is now a button in the ribbon, but it is not applied yet. Click the button to turn it on.

### Setting up the filter

Under *Filter* you build rules. Click *+ rule*, choose a *Field*, an *Operator* and a value. If you only want the critical tasks: field *Critical*, operator *equals*, value *Yes*. The fields include *Task Name*, *Start*, *Finish*, *Total Float*, *Progress* and *Milestone*, plus your own activity codes and fields and *Resources*. The operators depend on the kind of field: for text you can choose *contains*, for numbers and dates *between*.

Which operators you get depends on the kind of field:

- Text (*Task Name*, *WBS*): *equals*, *not equals*, *contains*, *starts with* and *is empty*.
- Number and date (*Total Float*, *Start*, *Progress*): *equals*, *not equals*, *less than*, *less than or equal*, *greater than*, *greater than or equal*, *between* (with *From* and *To*) and *is empty*.
- Yes/no (*Critical*, *Milestone*, *Near Critical*): *equals* and *not equals*, with the value *Yes* or *No*.
- Choice (*Type*, an activity code): *equals*, *not equals*, *is one of* (with tick-box values) and *is empty*.
- *Resources*: *is one of* and *is empty*.

With the field *In progress* and the operator *between* and two dates you get all tasks that run at any moment in that period, such as everything active in June.

You combine several rules with the list at the top: *All of the following (AND)* shows tasks that meet all rules, *Any of the following (OR)* tasks that meet at least one rule. With *+ group* you add a subgroup with its own rules.

The filter looks at the tasks themselves. The phases (summary tasks) such a task falls under stay visible in grey, so you see where the task belongs. If you also group, those grey phases disappear.

### Grouping and sorting

Under *Group* you add a field with *+ level*. There are at most two grouping levels. Without grouping you see the WBS tree. Under *Sort* you add a field with *+ level* and choose *Ascending* or *Descending*. With two levels the second decides when values on the first are equal.

### Trying something quickly without a button

In the window click *Apply without saving*. The ticked parts go onto the screen, but no button is added. That is handy for a filter you only need once. Ctrl+Z reverses it.

### Changing, copying or removing a layout

Right-click the layout button. You choose *Edit…*, *Duplicate* or *Delete*. *Delete* asks for confirmation first. A copy is called *name (copy)*. A built-in layout, such as *Resource diagram*, you cannot edit or delete; you duplicate it to make your own version.

### More than one layout at a time

Layouts that do not store the same parts can be on together. If you have a layout that only stores the filter *Critical equals Yes* (call it, for example, *Only critical*) and you turn it on together with *Resource diagram* (grouping, sorting, relationship lines), you get the critical tasks per resource. If two layouts store the same part, for example both a filter, the second takes over and the first goes off. If you turn that second one off again, you return to the view from before your first click, not to the first layout.

## Pitfalls and what the app does

**You forget to untick parts.** A layout that also stores the columns, time scale and overlays puts those back to the saved state at every click. Your zoom then jumps away while you only wanted a filter. Check in the window that only the intended parts are ticked.

**An incomplete rule shows nothing.** If you choose no value for a yes/no field (it still says *—*) or leave the dates of *In progress* empty, no task matches and the list stays empty. Complete the rule.

**A manual change turns the layout off.** If you yourself change a part the layout stores, for example *Relationship lines* while *Resource diagram* is on, that layout drops out and the other parts go back to the view from before the layout. Zooming turns off a layout that stores the time scale, and making a column wider turns off a layout that stores the columns. The rest of the view then stays as it is. The Resource diagram does not store the time scale, so zooming does not affect it.

**Columns apply to the task table next to the Gantt.** The *Columns* part stores the columns of the table to the left of the timeline. The table on the *Table* tab keeps its own columns. How you choose columns is in [Adjusting table columns](docs://howto-tabelkolommen-aanpassen).

**Indent and outdent are off.** As long as a filter, grouping or sorting is on, the displayed order is not the order of the schedule. *Indent* and *Outdent* are then disabled with the tooltip *Not available while filtering/grouping/sorting*. Turn the layout off to adjust the structure again, as described in [Adjusting the structure](docs://howto-structuur-aanpassen).

**The status bar does not follow.** *Tasks:* in the status bar shows the number of tasks of the whole project, even if a filter shows only part of them.

**Layouts are on your device, not in the project.** The app keeps your layouts and the columns for all your projects on this device. The overlays from a layout (baseline, progress line and the rest) apply to all your projects. The filter, grouping and sorting that are on right now belong to the open project, but do not go into the project file: after saving and reopening the view is clean again. They also do not make the project "modified".

**The separate buttons are hidden.** *Columns…*, *Filter…*, *Group…* and *Sort…* as separate buttons on the *View* tab are an old view. You bring them back with *Show classic view buttons* under *Legacy features* on the *Advanced* tab of the settings window (⚙ in the title bar). Prefer layouts.

## See also

- [Adjusting table columns](docs://howto-tabelkolommen-aanpassen): choosing, moving and pinning the columns themselves.
- [Making and printing a report](docs://howto-rapport-maken-en-afdrukken): putting the view on paper with *Follow view*.
- [Adjusting the structure](docs://howto-structuur-aanpassen): why you cannot indent while filtering.
