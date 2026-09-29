# Opening an MS Project file (.mpp)

Goal: open a schedule from Microsoft Project directly in the app, without exporting it first.

## When you need this

A contractor, consultant or client sends you his schedule as an `.mpp` file. You want to view it, calculate it or develop it further. The app reads `.mpp` files from MS Project 2010 up to and including 2021. It only reads: it does not write `.mpp` and never changes your file.

## Steps

1. Choose *Home › File › Open* or press Ctrl+O. Choose the `.mpp` file.
2. The project opens in a new tab, or in the current tab if it was still empty and unchanged. The project has no file: *Save* later writes a new IFC file.
3. Read the message at the bottom: *This project calculates as Microsoft Project. Change it via File → Project info → Calculation profile and options.* The app calculates this project with the calculation rules of MS Project: the calculation profile *Microsoft Project*. With *Open calculation profile* you go to the setting, *Read more* opens the explanation.
4. Check whether there is a bar under the ribbon: *You're viewing the dates as recorded in the file; recalculating would shift 4 tasks.* Then on those tasks the app's outcome differs from the dates that MS Project saved. The message that comes with it is *4 tasks show the dates as recorded in the file (not recalculated).* What that means and how you switch to the app's own calculation is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).
5. If it says *This file contains hour-based planning.* with the button *Enable hour planning*, the file contains data in hours. See [Turning on hour planning](docs://howto-urenplanning-aanzetten).

If the file contains tasks with splits, leveling or a resource-driven schedule, another message is added, such as *This MS Project file contains 3 tasks with a split, leveled, or resource-driven schedule. They are imported and shown as such.* For one task the message is in the singular.

## What the app reads

The reader takes this data from the file:

- the project data: title, start date, status date, the number of hours per working day and the critical slack limit;
- the calendars of the project, of tasks and of resources;
- per task the name, the place in the structure, the duration, the start and finish, the progress with actual start and finish, the constraint with date, the deadline, the calendar, a leveling delay, manual scheduling and the task type;
- the relations with their type and lag;
- the resources, with name, type (labor or material), maximum availability and calendar;
- the assignments, with the time-phased distribution from which the app derives splits and hour distributions;
- the dates and float that MS Project calculated itself. The app uses those only for the view *Dates as recorded*, never as input.

What the reader does not read does not come along. Among other things that is baselines, costs and rates, notes and the custom fields of MS Project. A WBS code that you filled in yourself in MS Project is taken over by the app; otherwise it numbers the tasks according to the structure.

## Pitfalls and what the app does then

**A file from MS Project 2007 or older.** The app refuses it and reports: *This .mpp file uses an older format (Project 2007 or earlier). In MS Project, export it as XML (File → Save As → XML) and open that file.* Below the message the app adds the technical reason.

**A file with a password.** The app reports: *This .mpp file is password-protected. In MS Project, export it as XML (File → Save As → XML) and open that file.*

**A file that turns out not to be an `.mpp`.** You get *Failed to open file*, with a technical reason, such as *CFB: bestand te klein voor een geldige header (23 bytes, minimaal 512)* (this reason appears in Dutch).

**The XML route calculates differently.** If you open the MS Project XML export instead of the `.mpp`, the app calculates with the calculation profile *Open Planner Studio* and you do not see the message about *Microsoft Project*. The dates can then come out differently than with the `.mpp` file.

**An edit lets go of MS Project's steering.** If you edit a task whose planning was driven by MS Project's date window, the app reports once per project: *MS Project's date window no longer drives 2 tasks after this edit; the hour distribution itself still applies and stays in the file.* For one task the message is in the singular.

**Saving never overwrites your `.mpp`.** The project has no file. *Save* asks where the new IFC file should go.

## See also

- [Files and formats](docs://uitleg-bestanden): why an `.mpp` is only read and what saving writes.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): the view of MS Project's own dates.
- [Turning on hour planning](docs://howto-urenplanning-aanzetten): if the file contains data in hours.
- [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen): the same for Primavera.
