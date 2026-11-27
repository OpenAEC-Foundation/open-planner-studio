# Files and formats

What is actually in the file you save? And what happens to your schedule when you export it to another package? In this article you read how the app deals with files: what the app saves, what an export carries, and how saving, AutoSave and crash recovery differ. The example at the end shows with numbers what an export does.

## The concept

By default the app saves a schedule in the **IFC format** (`.ifc`), an open exchange format for construction information. The app writes the IFC schema of the project, IFC 4.3 ADD2 by default (see [Choosing the IFC schema](docs://howto-ifc-schema-kiezen)). Want to see what goes into the file? The *IFC* tab is an editor that shows the IFC text of your project; *Generate IFC* refreshes that text and *Copy* puts it on the clipboard. If you change the text, *Apply* loads it as your project. That fully replaces the project in that tab.

With the experimental setting *Open and save IFCX* on, you can also save a schedule in the **IFCX format** (`.ifcx`), an exchange format for construction information that is still in development. To try it with a copy of your schedule, save the copy as IFCX and reopen it in Open Planner Studio. The building model or P6 source archive stays in the original file. To exchange files with another program, use the IFC format if that program reads IFC. A later version of the app may refuse an experimental IFCX file.

CSV, XML, MPP and XER are for exchanging data with other programs. The app reads CSV, MS Project XML, Primavera P6 XML, MS Project files (`.mpp`) and Primavera files (`.xer`). It writes CSV, MS Project XML, Primavera P6 XML, Primavera files (`.xer`) and two progress sheets. You cannot export to `.mpp`.

When you export to another package, the selected export format determines which data goes along. A CSV export, for example, contains the task list. The IFC format also keeps the schedule's logic, resources and calendars.

## How the app deals with files

### What opening does

The app picks the reader by the extension. With an `.xml` file it looks inside the file to see whether it is MS Project XML or Primavera P6 XML. For an unknown extension, the app tries to read the file as IFC. If that fails, the app reports *Failed to open file*, with the reason.

Every file opens in a tab of its own. The exception is a tab that is still empty and unchanged: that tab takes over the file. A single Primavera file can produce several tabs, one for each project that has tasks.

After opening, the app always recalculates. If the file comes from another package, the dates can differ from what the file said. That is described in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

An opened IFC file becomes the **save target**: the file that *Save* writes back to. A project from CSV, XML, `.mpp` or `.xer` has no file after opening; *Save* then asks where the new IFC file should go. That way pressing Ctrl+S never overwrites your original file with IFC text.

With the experimental setting *Open and save IFCX* on, a `.ifcx` schedule file opened in the app also becomes a save target. *Save* keeps the file type. To change the type, use [Save As in the desktop app](docs://howto-bestand-openen-en-opslaan).

### What saving writes

When saving in the IFC format, the app keeps data such as:

- tasks with structure, duration, dates and progress;
- relations with lag, constraints and deadlines;
- calendars, resources and assignments, including the curves;
- baselines, activity codes, custom fields and notes;
- external links to other projects;
- the project settings, such as the status date, the calculation profile and the calculation options;
- the link to a resource library.

What you set on the screen does not belong to the project and does not go along: zoom, scroll position, the selected task and collapsed phases. Your app settings, such as language and theme, are not in the file either. The app keeps those itself, in the app or in your browser.

An export to another format does not touch your project. After an export the project still has the same save target, and it is still marked *Unsaved* if it was before.

### What an export loses

Every adapter carries over what its format knows.

**MS Project XML** carries over tasks, relations, calendars, resources, assignments, constraints, deadlines and the status date. Of your baselines only the active one goes along. Activity codes, custom fields, notes and external links do not go along. A second constraint on a task does not go along. A constraint *Must start on (MSO)* or *Must finish on (MFO)* without the choice *Mandatory (pin logic)* comes back as *Start no earlier than (SNET)* or *Finish no earlier than (FNET)*. *Manually scheduled* and the *Leveling delay* of a task do not come back. A hammock becomes an ordinary task with calculated dates.

**Primavera P6 XML** carries over tasks, relations, calendars, resources, assignments, constraints and the status date. Baselines and deadlines do not go along, and neither do activity codes, custom fields, notes and external links. A hammock goes along as *Level of Effort*, as in an `.xer`. P6 has no lag in percentages: the app converts such a lag to a fixed number of days. A lag in calendar days becomes a lag in working days.

**CSV** is a task list. The file has these columns for each task: task id, WBS, level, name, duration, start, finish, predecessors, work category, the id of a custom work category (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float and description. Resources, assignments, calendars, constraints, deadlines, baselines and the status date are not in it. The column headings are always in English.

**An IFC export carries the calculation profile and all calculation options.** If you export to CSV or MS Project XML, the profile is not in the file; of the calculation options, MS Project XML writes at most the critical threshold. Such a file reopens as *Open Planner Studio*. An `.xer` and a Primavera P6 XML reopen as *Primavera P6*, with the scheduling settings of P6 that are in the file. If your project calculated with *Primavera P6* or *Microsoft Project*, for example because it came from an `.xer` or `.mpp`, the dates can shift because of that. What a calculation profile is, is explained in [Calculation profiles and conventions](docs://uitleg-rekenprofielen).

If your project comes from a Primavera file (`.xer`), even if you saved it as IFC in between, the app reports after an export to CSV, MS Project XML or P6 XML: *Exporting to CSV loses XER source information.* For MS Project XML it says *MSPDI* instead of *CSV*, for P6 XML it says *P6*. You do not get that message for IFC: the IFC file carries Primavera's source file along. See [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

Two more things the app does with an export. If the schedule is out of date, it recalculates first and exports afterwards. And it does not export a schedule with a circular dependency: you get a message containing the loop, for example *Circular dependency between tasks: Set up site → Demolish existing extension → Set up site*.

### Save, AutoSave and crash recovery

These are three different things. They look alike, but they write to a different place.

**Save** is something you do. The app writes your project to your file and removes the *Unsaved* marker.

**AutoSave** is off by default, and you turn it on yourself for each project. The app then writes, without a window, to the same file whenever there are changes, at most once every ten seconds. It only works if the project already has a file. See [Turning on AutoSave](docs://howto-automatisch-opslaan).

**Crash recovery** is always on. As soon as there is a change anywhere, the app keeps, also at most once every ten seconds, a recovery copy of all open projects, including projects you did not change yourself. That copy is not in your project file: on the desktop app it is in the app's data folder, in the browser it is in the browser's storage. At the next start the app offers that copy. You read about that in [Recovering after a crash](docs://howto-herstellen-na-een-crash). Crash recovery never writes to your project file.

Because a copy is kept at most once every ten seconds, you can lose the last seconds of work in a crash.

### Desktop and browser

The desktop app and the browser version do the same with your project, but they write files in a different way.

On the desktop the app works with real paths. *Save* writes straight to your file. Usually the app first writes to a temporary file next to it (`.ops-save.tmp`) and only then replaces your file, so a crash halfway through writing does not cut off your old file. If you close the app with changes, it asks for each project whether you want to save. On a clean exit it clears its recovery copies.

In a browser that can keep files wherever you want (such as Chrome and Edge) you get an ordinary open and save window. After that, *Save* writes straight to the file; for a file you opened, the browser asks for permission once. The *Recent* list works, with file names only.

In a browser without that ability (such as Firefox) the app opens a file through the file picker and saves through a download. With *Save*, the message *Saved as a download: 'name.ifc' is in your downloads folder. …* explains this once per session; with *Save As* and exports you see *Saved as a download: 'name.ifc' is now in your downloads folder. This environment does not let the app write directly to the location you picked.* If the browser can show a save window but cannot write back to the project's file, *Save* asks for a place again every time. A message explains that once per session as well. *File › Recent* is there, but opens an empty page, and AutoSave is not available. You get the same message in any environment that does not let the app write to the place you picked.

## Example: exporting the example project

Take the example *Refurbishment & Extension of a Family Home* (*File › Examples*). It has 20 tasks, of which 4 phases and 2 milestones, and 16 relations. There are 6 resources with 8 assignments, 1 baseline and a link to the *Demo resource library*. The task *Demolish existing extension* has the constraint *Start no earlier than (SNET)* on 14 May 2027, and *Handover inspection* has a deadline on 29 July 2027. The schedule ends on 7 July 2027.

This is how the project comes back from each format, measured after the export file is opened again:

- The IFC file gives everything back: 20 tasks, 16 relations, 6 resources, 8 assignments, the baseline, the constraint, the deadline and the library link. The schedule ends on 7 July 2027 again.
- The MS Project XML file also gives everything back, except the library link. The schedule ends on 7 July 2027.
- The P6 XML file gives back the tasks, relations, resources, assignments and the constraint. The baseline and the deadline are missing. The schedule still ends on 7 July 2027, because the constraint is still in it.
- The CSV file gives back 20 tasks and 16 relations. Resources, assignments, baseline, constraint and deadline are missing, and the project is called *CSV Import*. Without the constraint the work moves forward: the schedule ends on 2 July 2027, five calendar days earlier.

Without that constraint the example itself also ends on 2 July 2027. So the difference comes from the constraint that the CSV file does not carry.

## Consequences and misunderstandings

**Keeping your project.** Use *Save* to update the project file. The IFC format also keeps the archive from a P6 import. Use *Export* to make a copy for the program that will receive the schedule.

**Opening an export again does not always give the same schedule.** The app always recalculates on opening, with the calculation profile that belongs to the format. If logic is missing, like the constraint in the CSV example, or the profile calculates differently, the outcome changes.

**An export is also in Recent.** On the desktop and in browsers with file access, an export ends up in *Recent*, just like a saved project (the progress sheet does not). If you open it there, it opens as an import of that format.

**Saving is not the same as crash recovery.** Crash recovery helps after a crash, but does not replace saving. So save before you close a tab or the app.

## See also

- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): the steps for open, save and save as.
- [Exporting](docs://howto-exporteren): choosing a format and what you get.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): why an imported schedule can show other dates.
- [Task dialog and properties panel](docs://ref-taak-eigenschappen): what a constraint does, and so what disappears if it is missing.
- [Adding relations](docs://howto-relaties-leggen): what a lag is and how the app calculates it.
- [Creating a hammock](docs://howto-hammock): what a hammock is, which an export writes as an ordinary task.
- [Codes and custom fields](docs://howto-codes-en-velden): working with activity codes and custom fields.
- [External relations to another project](docs://howto-externe-relaties): links that MS Project XML and P6 XML do not carry.
- [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren): baselines, of which MS Project XML only carries the active one.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
