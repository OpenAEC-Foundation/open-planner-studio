# Calendar dialog

The *Calendars* window manages the project's calendar library: which working days, working times and days off there are, and which calendar is the project calendar. The form next to the list is the same as in the *Resource calendar* window. This article says for each field what it does, what the default is and what you notice of it. How to make a calendar and give it to tasks is in [Making and assigning a calendar](docs://howto-kalender-maken-en-toewijzen); how the app counts working days is in [Calendars and working days](docs://uitleg-kalenders).

## Where to find it

- **Calendars** — *Planning › Calendar › Calendar* or *Settings › Calendar › Calendar*.
- **Calendar of a task** — the field *Calendar* in the *Edit task* window or the *Properties* panel. See [Task dialog and properties panel](docs://ref-taak-eigenschappen).
- **Resource calendar** — the *Resources* panel, column *Calendar*: pick a calendar, pick *+ Resource calendar* for a new one, or click the pencil (*Edit…*) for the chosen calendar. See [Resource panel](docs://ref-resourcepaneel).

## The library in the Calendars window

On the left is the list of calendars, on the right the form of the chosen calendar. The project calendar has a star. A calendar with invalid input has a red triangle (*This calendar contains invalid input*).

- **New calendar** (the plus) — adds a calendar named *New calendar* with the app's default content: Monday to Friday, 07:00 to 16:00, 8 net hours. If *Enable construction mode* is on (the default), Dutch holidays are in it too, without the construction break; if it is off, the list is empty. If you do not want those holidays, choose *Generate holidays…* and in it *No holidays*. (The names *Bouwkalender NL* and *Standaardkalender* stay Dutch in every language.)
- **Duplicate** — copies the chosen calendar under the name *{name} (duplicate)*.
- **Delete** (the bin) — deletes the chosen calendar. Disabled when only one calendar is left. If it was the project calendar, the first remaining calendar becomes the project calendar. Tasks and resources that used the calendar fall back to the project calendar.
- **Set as project default** — makes the chosen calendar the project calendar. On the calendar that already is it, *Project calendar* appears with a star. Effect: every task without its own calendar counts in this calendar, and so does a resource without its own calendar. A task that you gave a calendar yourself keeps it.
- **Apply** — writes all changes of the whole list to the project in one go, recalculates the schedule and closes the window. It does not recalculate if nothing changed on balance. Disabled while there is invalid input in one of the calendars. Enter in an ordinary text field does the same, but keeps the window open.
- **Cancel** — closes the window and throws away everything you changed since opening (or since the last Enter). Esc, the cross and clicking beside the window act as *Cancel*.

By default a project has the calendar *Bouwkalender NL* (construction mode on) or *Standaardkalender* (construction mode off), with Monday to Friday 07:00 to 16:00.

## The form

### Basics

- **Name** — the name in the list and in the drop-downs for tasks and resources.
- **Work days** — a button per weekday, from *Mon* to *Sun*; a pressed button is a working day. The order follows *Week starts on* (*Settings*, tab *Planning*). Default: *Mon* to *Fri*. Two quick buttons: *Mon–Fri* sets Mon–Fri, 07:00 to 16:00, 8 hours and removes a configured break; *Continuous (24/7)* sets all seven days, 00:00 to 24:00, 24 hours. Effect: a task only works on working days. The app cannot calculate a calendar without working days (*The calendar has no working days set*).
- **Start (hour)** and **End (hour)** — the start and end of the working day, as HH:MM in 24-hour notation. Default: 07:00 and 16:00. The arrows (or the arrow keys) adjust in steps of 15 minutes; the end may be 24:00, the start must be before the end. Effect: together with the break they determine the net hours per day. They do not count for the dates of a task in days; they do count for tasks in hours. These fields disappear when *Enable hour planning* is on and the calendar has working times per weekday: those then take precedence.
- **Break starts** and **Break duration (minutes)** — the start and length of the break, with the same 15-minute steps. Default: 12:00 and 60 minutes. If you set the duration to 0, the working day is continuous. The break must lie entirely within the working day and may not swallow all of it. Effect: net hours are end minus start minus break; for a task in hours no work is done in the break. The same fields disappear under the same condition as *Start (hour)*.
- **Net hours per day** — read-only: the derived length of a working day, with two decimals, for example *8.00 h*. Default: 8. Effect: this is the length of a day when converting between days and hours and for tasks in hours. See [Days and hours](docs://uitleg-dagen-en-uren).

### Working times

This block is only there when *Enable hour planning* is on (*Settings*, tab *Planning*). Here you set working times and shifts per weekday. See [Setting working times](docs://howto-werktijden-instellen).

- **Presets** — buttons that set the working times in one go: *Day shift* (Mon–Fri 08:00 to 16:00, an ordinary day calendar), *2 shifts* (Mon–Fri 06:00 to 22:00, 16 hours), *3 shifts* (Mon–Fri 06:00 to 06:00 next day, 24 hours), *Night shift* (Mon–Fri 22:00 to 06:00, 8 hours) and *24/7* (all days 00:00 to 24:00). Behind the built-in buttons are your own presets, with a cross to delete them.
- **Save as preset…** — saves the current working times as your own preset, on this device, so you can reuse them in any project. You give a name (*Name for your own preset*) and click *Save* or *Cancel*.
- **Set per weekday…** — turns a day calendar into an hour calendar: the current times become the working-time blocks of every working day, with the break as a gap. For an hour calendar the button is called *Hide working times* or *Show working times* and folds the editor in or out. For an hour calendar the editor is open by default.
- **The editor** — per weekday a list of blocks (*band*) with a start and end time. The tick *next day* lets a block run past midnight (a night shift). *Add band* (the plus) adds 08:00 to 16:00. *Copy to all workdays* (only on Mon–Fri) copies the blocks of that day to Monday through Friday. A day without blocks is called *Non-working*. At the bottom is *Derived hours/day:*, and as soon as a day has more than one block the hint *A gap between two bands is a break — adjust the times as needed.* Effect: the blocks take precedence. A weekday with blocks is a working day, and the fields *Start (hour)*, *End (hour)* and the break disappear.

### Holidays

- **Generate holidays…** — opens the generator. *Country* chooses *Netherlands*, *Germany*, *Belgium*, *France*, *United Kingdom*, *Austria*, *Switzerland* or *No holidays*. *Region* only appears if the country has regions; default *National*. *Construction holiday* only appears for the Netherlands and when *Enable construction mode* is on, with the choices *None* (default), *North*, *Central* and *South* and the hint *Advisory dates — verify with Bouwend Nederland*. A preview line says how many holidays will come (*… holidays, …–…*), expandable for the list. *Generate* puts the result in the calendar you are editing (it only counts after *Apply*), *Cancel* closes the generator. Effect: the whole *Holidays* list is replaced, including what you added yourself. The years the generator covers run from the year before the project start up to and including the year after the project end (without a project end: up to three years after the start). See [Generating holidays and the construction break](docs://howto-feestdagen-genereren).
- **Regenerate** — appears next to the button when the generated holidays no longer cover the project period, with the text *Holidays cover …–…; project runs to …. Regenerate?* A click generates the same choice (country, region, construction break) again for the new period. Without it, days outside the generated years are ordinary working days.
- **Holidays** — the list of days off: *Description*, *From* and *Until*, and a bin per line. *Add holiday* adds a line with today as *From* and an empty *Until*. An empty *Until* is one day. Without lines it says *No holidays yet.* Effect: all days in the period are non-working days in this calendar, for tasks on this calendar and for resources that use it. An invalid line gets a red border and a text (*Enter a valid start date.*, *Enter a valid end date, or leave it empty for a single day.* or *The end date is before the start date.*) and blocks *Apply*.

### Error messages and exceptions

Errors in the working times appear under the fields and block *Apply*: *Enter a valid start time as HH:MM.*, *Enter a valid end time as HH:MM.*, *Start time must be before end time.*, *Enter a valid break time as HH:MM.*, *Break duration must be a whole number of minutes of 0 or more.*, *The break must fall entirely within the configured working day.* and *The break cannot take up the whole working day.*

The calendar only knows days off as an exception. A calendar from an MS Project or Primavera file can also have working exceptions, an extra working day; the window does not show or edit those.

## The Resource calendar window

- **Resource calendar** — the form above, in a window with only *Apply* and *Cancel*. You edit one calendar in it: an existing one, or a new one that is linked to the resource after *Apply* (*Cancel* leaves nothing behind). If you open it in the *Library* view of the resource panel, it edits a calendar in the library; in the *Project* view it edits the calendar of the project, even if that came from the library. Effect: a resource calendar determines when the resource is available in the histogram, in overallocation and in leveling; it does not change the dates of a task. *Apply* does not recalculate. If the calendar is also on tasks or is the project calendar, the schedule does change: it is then marked out of date and *Calculate* recalculates it. See [Setting a resource calendar](docs://howto-resourcekalender-instellen).
