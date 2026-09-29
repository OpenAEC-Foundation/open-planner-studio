# Managing resources

Goal: create, edit and delete resources (people, machines and material) in your project, so that you can assign them to tasks.

## When you need this

Before you put a bricklayer or a crane on a task, that person or machine has to exist as a resource. The resource records how much of it there is and on which days it works. With that the app works out whether you ask too much of it on one day. You edit a resource when the staffing changes, for example when a second bricklayer joins.

Two terms. **Max units** is the capacity per work day: 1 is one person or machine, 2 is two of them. An **assignment** is a resource on a task (see [Assigning resources with a curve](docs://howto-resource-toewijzen)).

## Steps

### Creating a resource

1. Choose *Resources › Manage › New resource*. The resource panel takes over the workspace and an empty row appears at the bottom of the table. You can also open the panel with *Resources › Manage › Resources* and then choose *New resource in project*.
2. Type the name, for example *Bricklayer*.
3. Choose the *Type*: *Labor* (the default), *Equipment*, *Material*, *Subcontractor* or *Crew*.
4. Fill in the other fields if needed. Everything has a default: *Max units* is 1 and *Calendar* is *Project calendar*. *Rate/hour* is empty. You can only fill in *Unit* for the type *Material*, for example m³.
5. Press Enter or click outside the row. The resource is in the table. With Enter, an empty row opens below it straight away for the next one. Press Esc when you are done.

The row only becomes a resource once it has a name. With Esc, or by clicking away without a name, the app creates nothing. The order in which you fill things in does not matter: you may choose the type first and then type the name.

### Editing a resource

Edit the fields in the row. The app stores the name, the rate and the unit when you leave the field, and the other fields straight away.

- *Max units* is only accepted by the app if the value is greater than 0. With 0 or less the field gets a red border and jumps back to the previous value.
- *Calendar* decides on which days the resource works. Choose *Project calendar* or a calendar of its own. With *+ Resource calendar* you create a new one, and the pencil (*Edit…*) opens the chosen calendar. If a task works on a day the resource is off according to its calendar, that day counts as overallocated. How to create a resource calendar is described in [Setting up a resource calendar](docs://howto-resourcekalender-instellen).
- *Rate/hour* and *Total*: *Total* is the loaded hours of that resource times the rate. A plasterer who is loaded for 32 hours with a rate of 50 per hour comes to 1,600.00. At the bottom of the table is the sum of all resources.
- *Crew* groups a resource under a resource of the type *Crew*. It is only a grouping: the app does not add up the capacity or the load of the members into the crew.
- The colored swatch on the left is the resource's color. It is display only and has no effect on the schedule.

### Capacity that changes over time

Does your second bricklayer only arrive on 19 July? Click the arrow next to *Max units*. Under *Time-phased capacity* choose *Add step*. Each step has a date (*From*) and a number (*Max units*). From that date that number applies. Without steps the flat value always applies.

A new step starts with today's date and 1 unit. Change both, because otherwise a capacity of 1 applies from today.

### Deleting a resource

1. Click the bin in the row.
2. If the resource has assignments, the app asks for confirmation, for example *'Bricklayer' has 4 assignment(s) — delete?* Click the tick to delete or the cross to cancel. Without assignments the resource disappears at once.

The resource's assignments go with it. If a task has a work rule other than *Fixed duration and units*, the app divides the work of the removed resource among the resources that remain. Depending on the rule, that changes their units or the task's duration. If the duration changes, the schedule is out of date.

You can undo creating, editing and deleting with *Undo* (Ctrl+Z).

### The small overview in the side column

*Resources › Manage › Resource dock* puts a compact overview in the right-hand column, next to *Properties*. There you see the name and color of each resource and a warning sign (*Overallocated*) next to a resource that is overallocated. You can only change *Max units* there. If you select one or more tasks, the overview shows only the resources of those tasks.

## Pitfalls and what the app does then

**Only the type *Material* makes a difference for the calculation.** Labor, Equipment, Subcontractor and Crew are treated the same. Material does not count towards a task's duration and is not leveled. In the histogram the *All resources* row does not count material either.

**No name, no resource.** An empty row disappears without a trace.

**A new step in the capacity.** If you forget to change the date and the number, the capacity is 1 from today.

**Removing a resource you still need.** If you remove it by accident, press Ctrl+Z straight away. The assignments come back too.

## See also

- [Assigning resources with a curve](docs://howto-resource-toewijzen): putting a resource on a task.
- [Setting up a resource calendar](docs://howto-resourcekalender-instellen): fixing the work days of one resource.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do when a resource has too much to do on a day.
