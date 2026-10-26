# Opening an MS Project file (.mpp)

Goal: open a schedule from Microsoft Project directly in the app, without exporting it first.

## When you need this

A contractor, consultant or client sends you their schedule as an `.mpp` file. You want to view it, calculate it or develop it further. The app reads `.mpp` files from MS Project 2010 up to and including 2021. It only reads: it does not write `.mpp` and never changes your file. From the file it takes the schedule itself: tasks with structure, duration and constraints, relations with lag, calendars, resources, assignments and progress. It also reads the dates and float that MS Project calculated itself, but it uses those only for the view *Dates as recorded*, never as input.

## Steps

1. Choose *Home › File › Open* or press Ctrl+O. Choose the `.mpp` file.
2. The project opens in a new tab, or in the current tab if it was still empty and unchanged. The project has no file: *Save* later writes a new IFC file. A window then briefly explains what the app took over from the file and how saving works; see [Opening and saving a file](docs://howto-bestand-openen-en-opslaan).
3. Read the message at the bottom: *This project calculates as Microsoft Project. Change it via File → Project settings → Calculation profile and options.* The app calculates this project with the calculation rules of MS Project: the calculation profile *Microsoft Project*. With *Open calculation profile* you go to the setting, *Read more* opens the Help about calculation profiles.
4. Check whether there is a bar under the ribbon: *You're viewing the dates as recorded in the file; recalculating would shift 4 tasks.* Then on those tasks the app's outcome differs from the dates that MS Project saved. Below the message from step 3 there is then also a line: *4 tasks show the dates as recorded in the file (not recalculated).* What that means and how you switch to the app's own calculation is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).
5. If it says *This file contains hour-based planning.* with the button *Enable hour planning*, the file contains data in hours. See [Turning on hour planning](docs://howto-urenplanning-aanzetten).

If the file contains tasks with splits, leveling or a resource-driven schedule, another message is added, such as *This MS Project file contains 3 tasks with a split, leveled, or resource-driven schedule. They are imported and shown as such.* For one task the message is in the singular.

## Pitfalls and what the app does then

**Not everything comes along.** After opening, the app tells you in one message what it did not take over: *Not everything in this MS Project file was imported.* Below it there is one line per item with the number, for example *2 baselines were not imported.* For an `.mpp` the sentence about the calculation profile from step 3 is then the first line of this message. The message stays until you click the cross. If nothing is lost, you do not get this message. A line can be about:

- inserted projects (subprojects): the app reads them as a normal task, without the link to the other file;
- external tasks from another project: the app reads them as a normal task;
- baselines: from an `.mpp` the app takes over no baseline, from MS Project XML only Baseline 0 of tasks, and of that only the dates and the duration (for a task in hours also the time; not the work and cost, and no baselines of resources and assignments);
- with MS Project XML: an assignment whose baseline has other dates than its task. The app keeps only the baseline of the task; if they are the same, nothing is lost and the app reports nothing. A different time on the same day also counts as a difference;
- custom fields with values, such as custom fields, values from a lookup table and outline codes (the app does not count yes/no fields in an `.mpp`);
- notes (also a note with only a picture) on resources and assignments, and from an `.mpp` also on tasks (from MS Project XML the note of a task comes along as its description);
- hyperlinks;
- the fixed costs of tasks;
- the rates of resources: from an `.mpp` no rate at all, from MS Project XML only the standard rate;
- only with MS Project XML: manually scheduled tasks (the app schedules them automatically), inactive tasks (they are included in the calculation) and the leveling delay.

The critical threshold from MS Project is imported as a project setting, for both `.mpp` and XML. It remains in effect after recalculation and saving as IFC.

A WBS code that you filled in yourself in MS Project is taken over; otherwise the app numbers the tasks according to the structure.

**A file from MS Project 2007 or older.** The app refuses it and reports: *This .mpp file uses an older format (Project 2007 or earlier). In MS Project, export it as XML (File → Save As → XML) and open that file.* Below the message the app adds a technical reason in English.

**A file with a password.** The app reports: *This .mpp file is password-protected. In MS Project, export it as XML (File → Save As → XML) and open that file.* Here too the message comes with a technical reason in English.

**A file that turns out not to be an `.mpp`.** You get *Failed to open file*, with a technical reason.

**The XML route calculates differently.** If you open the MS Project XML export instead of the `.mpp`, the app calculates with the calculation profile *Open Planner Studio* and you do not see the message about *Microsoft Project*. The dates can then come out differently than with the `.mpp` file. With the XML export too, the app tells you what it does not take over; see *Not everything comes along*.

**An edit lets go of MS Project's steering.** If you edit a task whose planning was driven by MS Project's date window, the app reports once per project: *MS Project's date window no longer drives 2 tasks after this edit; the hour distribution itself still applies and stays in the file.* For one task the message is in the singular.

**Saving never overwrites your `.mpp`.** The project has no file. *Save* asks where the new IFC file should go.

## See also

- [Files and formats](docs://uitleg-bestanden): why an `.mpp` is only read and what saving writes.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): the view of MS Project's own dates.
- [Turning on hour planning](docs://howto-urenplanning-aanzetten): if the file contains data in hours.
- [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen): the same for Primavera.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
- [Calculation profiles and conventions](docs://uitleg-rekenprofielen): why an MS Project file opens with its own calculation profile.
