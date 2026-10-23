# Opening a Primavera P6 file (.xer)

Goal: open a schedule from Primavera P6 directly in the app, without exporting it to XML first.

## When you need this

A client or main contractor works in Primavera and delivers their schedule as an `.xer` file. You want to view it, calculate it or add to it. The app only reads `.xer` files: it does not write `.xer` and never changes your file. From the file it takes the WBS structure and the activities with duration, dates, constraints and progress, the relations with lag, the calendars and the resources with their assignments, plus activity codes, custom fields (UDFs), notes and P6's scheduling settings. An activity of the type *Level of Effort* becomes a hammock.

## Steps

1. Choose *Home › File › Open* or press Ctrl+O. Choose the `.xer` file.
2. The app opens one tab for each project that has tasks. The project with the most tasks is the active tab. A tab is called *Project name (Project ID)* if the P6 project ID differs from the name. *Project settings* shows only the name. If you rename the project, the project ID stays after it. A window then briefly explains what the app took over from the file and how saving works; see [Opening and saving a file](docs://howto-bestand-openen-en-opslaan).
3. Read the message at the bottom. For a file with three projects it can look like this: *XER file opened: 3 project documents.* Below it are lines that explain what the app did. See the heading below.
4. Check whether there is a bar under the ribbon: *You're viewing the schedule as Primavera recorded it; recalculating would shift 1 task.* Primavera records its own calculated dates in the file. If the app's calculation differs from them, the app shows Primavera's dates as long as you change nothing. A task that has started or is complete always sits on its actual dates, as in Primavera. What that means and how you switch to the app's own calculation is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen). The message *This file contains hour-based planning.* can also appear, with the button *Enable hour planning*. See [Turning on hour planning](docs://howto-urenplanning-aanzetten).
5. Save your project with Ctrl+S. Because an `.xer` is never overwritten, the app asks where the new IFC file should go. It suggests *Project name (Project ID)* as the file name.

### The lines below the message

The first line of the message names the number of opened tabs. Below it are only the lines that apply. These deserve your attention:

- *This project calculates as Primavera P6. Change it via File → Project settings → Calculation profile and options.* The app calculates this project with Primavera's calculation rules. With *Open calculation profile* you go to the setting.
- *1 baseline project excluded.* and *1 baseline materialized.* If a project in P6 designates another project as its baseline, that other project does not open as a tab of its own. It becomes the active baseline of the project that refers to it.
- *A protective baseline fallback was used.* If designating baselines would mean that no project opens at all, if a project refers to itself or if projects refer to each other in a loop, the app simply opens all projects and makes no baselines.
- *1 external link preserved.* A relation between two projects. The app keeps it as source data, but does not turn it into a relation in your schedule.
- *12 tasks show the dates as Primavera recorded them (not recalculated).* The number of tasks for which the view *Dates as recorded* shows Primavera's dates: every task for which the file recorded dates, not only the ones that differ.

The other lines are diagnostics of the reading itself. They ask nothing of you:

- the number of projects found;
- a skipped empty project;
- an ignored dangling baseline reference;
- a text encoding other than plain UTF-8 (the notice names which one: for Arabic, Cyrillic or Greek text the app picks the matching Windows code page, otherwise Windows-1252);
- activities without a planned start (they start on the data date or the project start from the file);
- counters for findings in the tables, the calendars and the numbers, for unknown field values and for P6 scheduling settings that the app replaced by a safe choice.

*Read more* opens the Help about opening Primavera files.

## Pitfalls and what the app does then

**Not everything becomes a tab or a relation.** A project without activities does not open, a baseline project does not open as a tab of its own and a relation between two projects does not become a relation in your schedule. The app reports that in the lines below the message.

**Every tab is a project of its own.** If you save one, the IFC file keeps the complete original `.xer` along. If you reopen that IFC file later, the app still knows Primavera's dates. If that source archive is damaged, or another IFC program rewrote the file, the app reports: *The XER source archive in this file is unusable and was left out; the project itself opened in full.* The schedule, the calculation profile and all project data are complete. What is missing: the dates as Primavera stored them and the source provenance for MCP clients and extensions. Open the original `.xer` again to get the archive back.

**The IFC file gets bigger.** Because the IFC file carries the whole original `.xer`, it is bigger than an IFC file without an archive. With a large `.xer` you notice that in the file size and in the time saving takes. If an `.xer` opens several projects, every tab you save carries the whole `.xer`, not only its own project.

**An export to CSV, MS Project XML or P6 XML loses data.** The app warns: *Exporting to CSV loses XER source information.* IFC loses nothing.

**A free Saturday or Sunday that is not in the file.** The app can make such a weekend day free itself. The day is then called *Calendar exception (weekend reconstruction)* in the calendar. The pattern is in [Import and export formats](docs://ref-import-exportformaten).

**Float up to the project finish, without a finish date.** If the file has no finish date, the app turns off the option *Calculate float up to the project finish date*. That counts in the line *N P6 scheduling settings used safe fallbacks.* Details are in [Import and export formats](docs://ref-import-exportformaten).

**Completed activities on the data date.** A completed activity can show as a narrow bar on the data date in the view *Dates as recorded*. That is not a fault in your file. The explanation and the related convention are in [Import and export formats](docs://ref-import-exportformaten).

**Numbers with a comma as decimal separator.** If the app cannot determine the decimal separator reliably, it does not open the file. That way a schedule with wrongly read numbers never opens. Ask the sender for a new export.

**A file the app cannot read.** You get an error message, with the reason. A few examples:

- *This is not a valid or supported XER file.*
- *An XER table is missing required columns.*
- *The P6 project in this XER file contains no activities.*
- *The decimal notation in this XER file cannot be determined reliably.*

Nothing opens then. Check the file in P6, or ask the sender for a new export.

## See also

- [Files and formats](docs://uitleg-bestanden): why an `.xer` is only read and what an export loses.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): the view of Primavera's own dates.
- [Opening an MS Project file (.mpp)](docs://howto-mpp-openen): the same for MS Project.
- [Turning on hour planning](docs://howto-urenplanning-aanzetten): if the file contains data in hours.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
- [Calculation profiles and conventions](docs://uitleg-rekenprofielen): why a P6 file opens with its own calculation profile.
