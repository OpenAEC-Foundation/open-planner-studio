# Assigning resources with a curve

Goal: put a resource on a task, with units per day and a curve that decides how those units are spread over the days of the task.

## When you need this

As soon as you want to see who works where and when: the bricklayer on the outer cavity leaf, the crane on the hollow-core floor slabs. Without an assignment there is no load and so no histogram or overallocation.

Two terms. The **units** (in the app *Units/day*) are how much of the resource works on the task per work day: 1 is one bricklayer, 2 is two of them, 0.5 is half a day. The **curve** decides how the total, units times duration, is spread over the task's work days. Work is rarely even: on a wall the start is quiet, the middle busy and the end quiet again.

The outer cavity leaf takes 6 work days. With one bricklayer and the curve *Uniform* that is 1 unit on each of the 6 days, 6 together. With the curve *Bell shaped* it is still 6 units together, but the distribution becomes 0, 1, 2, 2, 1 and 0.

## Steps

You can assign a resource in two ways. The resource must already exist (see [Managing resources](docs://howto-resources-beheren)).

### Via the ribbon

1. Select one task in the task list. It must be an ordinary task, not a milestone and not a phase.
2. Choose *Resources › Assignment › Assign ▾*.
3. In the window, fill in the *Units/day* (default 1) and choose the *Curve* (default *Uniform*). They apply to the resource you pick now.
4. Click the resource. The window closes and the assignment is there.

For a second resource you open the window again. Resources that are already on the task are missing from the list.

### Via the Properties panel

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. In the *Assignments* block, right at the bottom, choose the resource at *Assign resource*. The assignment starts with units of 1 and the curve *Uniform*.
3. For each assignment, change the *Units/day* and choose another *Curve*.

That is also how you change an existing assignment. With the bin (*Remove*) next to the name you take the assignment off the task. The resource itself stays. With *Move to…* you move the assignment to another task.

### The curves

- *Uniform*: the same every day. This is the default and fits work that is equally heavy every day.
- *Front loaded*: the start is heavier than the end. Fits work that begins with heavy effort, such as setting out.
- *Back loaded*: the end is heavier than the start. Fits work that gets busier towards completion.
- *Bell shaped*: a peak in the middle, with a quiet start and end. Fits a wall that starts quietly, is in full swing in the middle and tails off.
- *Early peak*: a peak before the middle. Fits work that gets up to speed quickly.
- *Late peak*: a peak after the middle. Fits work whose busy period only comes late.
- *Double peak*: two peaks. Fits work with two busy moments.
- *Turtle*: a quiet start and end with a broad peak in the middle. Fits long work that builds up and winds down gradually.

The curve only changes the distribution. The duration, the dates and the total stay the same. You do not need to recalculate afterwards. The histogram adjusts straight away. Choose *Resources › Histogram › Histogram* to see it. If you select a task, the histogram shows only the load of that task.

## Pitfalls and what the app does then

**A curve can push the peak above your units.** With a whole number as units, the app rounds the value per day to whole units, and the total stays the same. A bricklayer with units of 1 on the outer cavity leaf and the curve *Bell shaped* gives 0, 1, 2, 2, 1, 0. On the two middle days that is 2 units against *Max units* of 1. The histogram colors those days red and the resource counts as overallocated. Choose another curve, or spread the hours yourself (see [Adjusting the hour distribution](docs://howto-urenverdeling-aanpassen)). With units such as 0.5 the app rounds to hundredths. On a short task with whole units the shape therefore becomes coarse: over 10 days *Turtle* with units of 1 gives the distribution 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, exactly the same as *Early peak*.

**No milestone or phase.** The *Assign* button is then disabled, and *Properties* says *Assignments are not possible on milestones.* or *Assignments are not possible on summary tasks.*

**A resource only once per task.** If the resource is already on the task, it is no longer in the list. If all resources are already on the task, the app says *All resources are already assigned.* If there is no resource yet, it says *Create resources first (Resources tab).*

**The units must be greater than 0.** The app does not accept a value of 0 or less.

**Material.** For a material resource the units are the quantity per day, in the resource's unit, for example m³. Material does not count towards the task's duration.

**A work rule can adjust the duration.** If the task is on *Fixed work* or *Fixed units*, a second resource changes the task's duration. The schedule is then out of date; press **Calculate** (F5). See [Work rules: duration, units and work](docs://uitleg-werkregels).

**A distribution of its own.** If the assignment already has an hour distribution of its own, the curve is disabled and shows *Contour*. Release that distribution first via *Hour distribution…*.

**Undoing.** You can undo creating, changing or removing an assignment with *Undo* (Ctrl+Z).

## See also

- [Adjusting the hour distribution](docs://howto-urenverdeling-aanpassen): setting the hours per day yourself.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do when a resource has too much to do on a day.
- [Work rules: duration, units and work](docs://uitleg-werkregels): what happens to the duration when you change the units.
- [Resource panel](docs://ref-resourcepaneel): all fields and buttons of the resource panel.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): all five resource types, all six curves and a tower crane with a capacity step from 30 August 2027.
