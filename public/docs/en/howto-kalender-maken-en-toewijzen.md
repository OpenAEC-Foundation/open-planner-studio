# Creating and assigning a calendar

Goal: make a calendar of your own, for example a six-day work week, and give it to the tasks that must be calculated in it.

## When you need this

A subcontractor also works on Saturdays. A crew works only Monday to Thursday. A task falls in a period in which only that task stands still. The project calendar then has the wrong work days. With a calendar of your own, the app calculates those tasks on the right days, and the rest stays on the project calendar. What the app does with a calendar exactly, you can read in [Calendars and working days](docs://uitleg-kalenders).

## Steps

### Creating a calendar

1. Choose *Planning › Calendar › Calendar*. The same button is on *Settings › Calendar › Calendar*. The *Calendars* window opens. On the left are the project's calendars; the project calendar has a star.
2. Under the list, click the button with the plus sign (*New calendar*). The new calendar is a copy of the standard: Monday to Friday, 07:00 to 16:00 with an hour's break and, if *Construction mode* is on, the Dutch public holidays. If you want an existing calendar as a basis, pick it in the list and click the button with the two sheets under the list (*Duplicate*).
3. Give the calendar a name under *Name* that says who uses it, for example *Six-day week*.
4. Under *Work days*, click the weekdays on or off. *Mon–Fri* restores the standard week, with 07:00 to 16:00. *Continuous (24/7)* switches on all seven days, from 00:00 to 24:00.
5. Adjust the working times if needed: *Start (hour)*, *End (hour)*, *Break starts* and *Break duration (minutes)*. You type times as HH:MM; with the arrows you raise or lower them by a quarter of an hour. If you set the break duration to 0, the calendar works without a break. *Net hours per day* is worked out by the app itself. If hour planning is on and the calendar has working-time blocks per weekday, you do not see these fields; see [Setting working times](docs://howto-werktijden-instellen).
6. Adjust the holidays if needed. How that works is covered in [Generating holidays and the construction holiday](docs://howto-feestdagen-genereren).
7. Click *Apply*. The app recalculates the schedule right away and closes the window. With *Cancel* you throw the changes away. Enter in an input field saves in between and also recalculates, without closing the window; *Cancel* then only undoes what you changed after that.

### Giving a calendar to tasks

A new calendar only does something once a task uses it. There are two ways.

**Via the Properties panel**

1. Select the task. If you do not see the *Properties* panel, turn it on with *View › Panels › Properties*.
2. Under *Task*, choose the calendar in the *Calendar* list. The top choice, *Project calendar* with the name after it, means the task has no calendar of its own.

**Via the right-click menu**

1. Right-click the task, in the task list or on the bar in the Gantt.
2. Choose *Assign calendar* and then the calendar, or *Project calendar* to remove the calendar of its own again. The calendar that applies now has a tick.
3. If you want to give one calendar to several tasks at once, first select them with Ctrl (⌘ on a Mac) and right-click one of the selected tasks. The choice applies to all selected tasks. If you right-click a task that is not selected, it applies only to that task.

A new calendar choice does not make the schedule current yet: the status bar reports *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example via *Home › Schedule › Calculate*. If *Calculate automatically* is on (*Settings › Project › Settings*, tab *Planning*, heading *Calculation*), the app does this itself.

### Switching the project calendar

1. Open *Planning › Calendar › Calendar* and choose the calendar in the list.
2. Above the form, click *Set as project default*. The star moves to that calendar.
3. Click *Apply*.

Only the tasks without a calendar of their own move along.

### Deleting a calendar

1. Open the *Calendars* window and choose the calendar in the list.
2. Under the list, click the button with the bin (*Delete*). That button is disabled as long as there is only one calendar.
3. Click *Apply*. Tasks and resources that used the calendar fall back on the project calendar. If you delete the project calendar itself, the first calendar in the list becomes the project calendar.

## Pitfalls and what the app does then

**No work days.** If you switch off all weekdays, the app cannot calculate. When calculating it reports *The calendar has no working days set*.

**Invalid input.** A break outside the working day, a start time after the end time or a holiday with an incorrect date gets a red message at the field, and *Apply* is disabled until you fix it. For an invalid break or holiday there is also a warning sign next to the calendar in the list (*This calendar contains invalid input*).

**A calendar on a phase.** A phase always calculates on the project calendar, because its duration follows from its tasks. Give the calendar to the tasks themselves.

**The same calendar, two choices.** In the list the project calendar appears twice: as *Project calendar: name* and as an ordinary calendar with that name. If you choose the second, that is a choice of its own for that task. The task then does not move along when you later choose a different project calendar.

**Different hours per day.** If you change the working times or the break so that the *Net hours per day* of a calendar change, a task in days still counts the same number of days. For a task with resources and the work rule *Fixed work* or *Fixed units*, the duration does change with it, because the work stays the same. Forty hours of work is 5 days at 8 hours per day and 7 days at 6 hours per day. The app reports how many tasks got a different duration.

## See also

- [Calendars and working days](docs://uitleg-kalenders): how the app counts work days and which calendar wins.
- [Days and hours](docs://uitleg-dagen-en-uren): what the net hours per day do.
- [Setting up a resource calendar](docs://howto-resourcekalender-instellen): a calendar for a resource instead of a task.
- [Calendar windows](docs://ref-kalenders): all fields of the calendar windows.
