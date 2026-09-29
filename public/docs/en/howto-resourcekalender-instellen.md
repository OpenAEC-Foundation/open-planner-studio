# Setting up a resource calendar

Goal: record on which days a resource is available, so that the histogram, the overallocation and the leveling calculate with it.

## When you need this

The bricklaying crew works only Monday to Thursday. The crane is on another project in the first two weeks of August. A subcontractor has four fixed work days. Without a calendar of its own the app assumes the resource works on the days of the project calendar.

A resource calendar changes no task date at all. It only determines when the resource is available. If a task works on a day on which the resource does not work, the capacity that day is 0 and the day counts as overallocated. If you want the task itself to run on other days, give the task a calendar of its own ([Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen)). The difference is covered in [Calendars and working days](docs://uitleg-kalenders).

## Steps

### Creating a new resource calendar

1. Choose *Resources › Manage › Resources*. The resource panel opens. If the resource does not exist yet, create it with *New resource in project*.
2. Find the resource's row. In the *Calendar* column the default is *Project calendar*: the resource then follows the project calendar.
3. In that list, choose *+ Resource calendar*. The *Resource calendar* window opens. It has the same fields as the calendar form: *Name*, *Work days*, the working times and the *Holidays*. The new calendar starts as a copy of the standard calendar and is called *Resource calendar*.
4. Give the calendar a name that fits the resource, for example *Crew Mon–Thu*, and set the work days: click Friday off under *Work days*. You put holidays or downtime in the *Holidays* list with *Add holiday*.
5. Click *Apply*. The calendar is now in the project's library and linked to the resource, in one step that you undo with *Undo*. With *Cancel* nothing has been created.

### Choosing or adjusting an existing calendar

In the *Calendar* column, choose a calendar from the list. *Project calendar* removes the calendar of its own again. If you want to adjust the chosen calendar, click the pencil next to the list (*Edit…*). The *Resource calendar* window opens with the current calendar.

### Looking at the outcome

1. If the status bar says *Out of date — recalculate (F5)*, press **Calculate** (F5).
2. Choose *Resources › Histogram › Histogram* and click the resource in the list to the left of the histogram. The days on which the resource does not work but is scheduled are red. If you hold the mouse over one, the bar reports, for example, *Does not work this day per calendar "Crew Mon–Thu"*.
3. Under *Resources › Overallocation* is the number of overallocated resources, and the status bar reports, for example, *1 resource(s) overallocated*.

## Pitfalls and what the app does then

**Only the days count, not the hours.** A resource calendar determines on which days the resource works. How many units are available that day follows from the resource's *Max units*, not from the working times in the calendar.

**Leveling does not always solve this.** If there is no window in which every day of the task falls on a work day of the resource, shifting does not help. Choose *Resources › Leveling › Level…* and click *Calculate*. The task is then under *Remaining conflicts*, with the reason *The resource does not work on all days this task needs — shifting cannot resolve this.* Then assign the task to another resource, or give it a calendar of its own.

**A shared calendar.** The list shows all the project's calendars, so also the project calendar and the calendars of tasks. If you adjust such a calendar with the pencil, the schedule of the tasks that use it changes too, and the status bar reports *Out of date — recalculate (F5)*. Rather make a calendar of its own for the resource.

**Overallocation is not always the calendar.** A resource that works every day can be overallocated too: the tooltip only mentions the calendar if the day is not a work day of the resource.

## See also

- [Calendars and working days](docs://uitleg-kalenders): why a resource calendar shifts no dates.
- [Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen): the fields of the calendar form.
- [Generating holidays and the construction holiday](docs://howto-feestdagen-genereren): putting holidays and downtime in the calendar.
