# Exporting

Goal: hand over your schedule as a file in another format, for someone who does not read IFC or for another package.

## When you need this

The consultant works in MS Project, the client in Primavera, the subcontractor wants the tasks in Excel, or you send a schedule to a package that cannot handle IFC. An export is a copy in another format. If you want to keep your project itself, save it: that writes IFC and carries everything along. What each format does and does not carry is in [Files and formats](docs://uitleg-bestanden).

## Steps

1. Choose *Home › File › Export* and pick a format from the list, or choose *File › Export*. There every format is a card with a short description.
2. In the window choose a name and a place. The app suggests the project name, with the extension of the format. The progress sheets are called *projectname-voortgang* and open in your downloads folder where possible.
3. Confirm. No message appears if the export succeeds, apart from the messages below. From *File › Export* you afterwards return to the *Home* tab, even if you cancel the window. If you cancel the window for an export from the list on the *Home* tab, nothing happens.

If your browser only saves through a download (such as Firefox), the file is in your downloads folder right after step 1. You see the message *Saved as a download: 'name.xml' is now in your downloads folder. This environment does not let the app write directly to the location you picked.*

### Which format do you choose?

The list on the *Home* tab and the cards in *File › Export* offer the same formats:

- *Progress (Excel)* and *Progress (CSV)*, on the cards *Progress sheet (Excel)* and *Progress sheet (CSV)*: a slim sheet with id, WBS, name, dates and completion, to send round to whoever fills in the progress.
- *CSV (;)*, on the card *CSV (semicolon-separated)*: a task list that you open in a spreadsheet.
- *MS Project XML*: can be opened in Microsoft Project.
- *Primavera P6 XML*: for Oracle Primavera P6.
- *IFC 4x3*: the app's own format, with everything in it.

### An IFC export with a library file

If your project is linked to a resource library, the checkbox *Save library file alongside* is below the cards in *File › Export*. If you tick it and choose *IFC 4x3*, the app asks for a place twice: first for the project, then for *projectname-bibliotheek.ifc*. This checkbox is only in *File › Export*, not in the list on the *Home* tab.

### Restoring a progress sheet

You read a filled-in progress sheet back through *File › Import*. See [Importing progress from a spreadsheet](docs://howto-voortgang-importeren).

## Pitfalls and what the app does then

**Your project does not change.** Your project's file stays the same, and the *Unsaved* marker stays if it was there.

**An out-of-date schedule is recalculated first.** So you get the current dates, even if you forgot to press *Calculate*.

**An export is also in Recent.** That does not apply to the progress sheets. If you open an export there, it opens as an import of that format.

**An export does not carry everything.** A CSV file has no resources or constraints, P6 XML has no baselines and deadlines. The calculation profile does not go along either: a reopened export calculates as *Open Planner Studio*. Only IFC carries everything. You find an example with numbers in [Files and formats](docs://uitleg-bestanden).

**Two formats with the same extension.** MS Project XML and Primavera P6 XML both get the name *projectname.xml*. Give them different names yourself, otherwise you will not know later which file is which format.

**A schedule with a circular dependency is not exported.** The app calculates first and stops if there is a loop. On the *Home* tab you get the message *Schedule could not be calculated*, with below it for example *Circular dependency between tasks: Set up site → Demolish existing extension → Set up site*. In *File › Export* only that second text is on the page. Resolve the loop and export again.

**A project from Primavera loses source information.** If you export such a project to CSV, MS Project XML or P6 XML, the app reports: *Exporting to CSV loses XER source information.* For MS Project XML it says *MSPDI*, for P6 XML *P6*. See [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

**Split tasks lose their splits.** MS Project and Primavera only know a split as an hour distribution. If your project contains split tasks without an hour distribution, the app reports after an export to MS Project XML or P6 XML: *2 tasks with breaks were exported without their breaks: MS Project/P6 only know breaks as a work distribution.* For one task it says *1 task with breaks was exported without its breaks: MS Project/P6 only know breaks as a work distribution.* See [Splitting a task](docs://howto-taak-splitsen).

**A schedule in the view *Dates as recorded*.** If you export to CSV while you see the dates from the source file, the app leaves `Critical` and `Total Float` empty for tasks for which the source file did not record that. See [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

## See also

- [Files and formats](docs://uitleg-bestanden): what each format carries and what not.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): keeping your project itself as IFC.
- [Importing progress from a spreadsheet](docs://howto-voortgang-importeren): reading in a filled-in progress sheet.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
