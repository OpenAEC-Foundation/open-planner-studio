# Assigning a fixed amount

Goal: put a fixed amount on a task, such as fees for a permit, an inspection or a rental price, without hours or units.

## When you need this

Not every cost is work. A building permit costs a fixed amount, even if nobody spends an hour on it. That is what the resource type *Cost* is for. A cost resource only has an amount per assignment. It has no rate, no *Max units*, no calendar, no unit and no crew.

A cost resource does not count for load, overallocation, the histogram or leveling. It never changes the duration of the task, not even under the task type *Fixed work*. Changing an amount does not make the schedule out of date: you do not need to recalculate.

Example: the task *Apply for permit* gets the cost resource *Municipal fees* with an amount of 1250.55. The milestone *Handover* gets the cost resource *Handover inspection* with 450. In the resource panel, the *Total* column shows the sum of the amounts per cost resource.

## Steps

### Creating the cost resource

1. Choose the *Resources* tab and create a new resource (see [Managing resources](docs://howto-resources-beheren)).
2. In the *Type* column, choose *Cost*. The fields that do not apply to cost show a dash (—).

### Assigning the amount

1. Select the task or the milestone.
2. In the *Properties* panel, block *Assignments*, choose the cost resource at *Assign resource*. You can also use *Resources › Assignment › Assign ▾*; for a cost resource the window asks for no units and no curve.
3. Type the amount in the *Units* column of that row and press Enter. For a cost resource that field is the amount.

An amount of 0 is valid. If you empty the field, the assignment no longer has an amount. The *Work (h)* column shows a dash: a cost resource has no work. If you click the name, you see no curve and no *Hour distribution…*; *Move to…* still works.

## Pitfalls and what the app does

**Switching the type with assignments.** If a resource has assignments, you cannot switch its type between *Cost* and another type. The choice is then disabled. Remove the assignments first.

**Resource library.** If the library wants to switch the type of a resource with assignments between *Cost* and another type, the type in the project stays as it is. The resource then shows as deviating from the library, and the app tells you why.

**Milestones.** On a milestone you can only assign a cost resource. You can make a task with only cost resources a milestone; with work or material on it you cannot.

**Exporting.** MS Project XML, Primavera XER and Primavera P6 XML get cost resources in a later version. For those exports the app leaves out the cost resources, with their assignments and amounts, and tells you how many. The IFC file keeps them.

**No currency.** The amount has no currency sign, just like the rate.

**Undo.** You can undo changing or clearing an amount with *Undo* (Ctrl+Z).

## See also

- [Managing resources](docs://howto-resources-beheren): creating resources and the types.
- [Assigning resources with a curve](docs://howto-resource-toewijzen): assigning work and material.
- [Resource panel](docs://ref-resourcepaneel): the *Total* column and the other fields.
