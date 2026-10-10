# Import and export formats

Per file format: whether you can open, save and export it, what does and does not go along and which calculation profile it opens with. The why behind all this, and an example with numbers, is in [Files and formats](docs://uitleg-bestanden).

## At a glance

**Opening** works with IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` and `.xer`. A file with any other extension is treated by the app as IFC.

**Saving** always writes IFC. Only an opened IFC file becomes the save target; a project from another format has no file after opening, and *Save* then asks where the IFC file should go.

**Exporting** works to IFC 4x3, MS Project XML, Primavera P6 XML, CSV and two progress sheets (Excel and CSV). An export does not change your project.

**Read-only** are `.mpp` and `.xer`: the app can open them, not write them.

**PDF** only comes from a report (see [Report types](docs://ref-rapporttypes)). The app does not read PDF.

**Where.** Opening: *Home › File › Open*, *File › Open* or Ctrl+O. Exporting: *Home › File › Export* or *File › Export*. You read a filled-in progress sheet in via *File › Import*, or with the button *Update progress from a spreadsheet* in the ribbon group *Progress* on the *Planning*, *Table* and *Report* tabs.

**Calculation profile on opening.** Every format opens with a calculation profile; what that is, is in [Calculation options and conventions](docs://ref-rekenopties-en-conventies). `.xer` opens with *Primavera P6*, `.mpp` with *Microsoft Project*, and CSV, MS Project XML and P6 XML with *Open Planner Studio*. IFC keeps the profile stored in the file. For `.xer` and `.mpp` the app reports that the project calculates this way. Only IFC carries the calculation profile and the calculation options; of the calculation options, MS Project XML writes at most the critical threshold. A reopened export of another format calculates as *Open Planner Studio*.

## IFC

**Open** — yes, `.ifc`. The app reads IFC 4.3. Calculation profile: the one in the file.

**Save** — yes, and it is the only format that saves. *Save* writes your whole project as an IFC file. The file becomes the save target.

**Export** — yes, as *IFC 4x3* (described as *BuildingSMART standard. 4D link with BIM models.*). Default name: the project name with the extension `.ifc`. If your project is linked to a resource library, the checkbox *Save library file alongside* is below the cards in *File › Export*. Ticked, the app asks for a place for *projectname-bibliotheek.ifc* after the project. The checkbox is not in the list on the *Home* tab.

**What goes along** — everything that belongs to the project: tasks with structure, duration, dates and progress; relations with lag; constraints and deadlines; calendars; resources and assignments, including the hour distribution; baselines; activity codes and custom fields; notes; external links to other projects; interruptions; work rules and task types; the project settings such as the status date, the progress mode, the calculation profile and the calculation options; the link with a resource library. For a project from a `.xer`, the original source file goes along too. A custom task type is stored as the IFC type `USERDEFINED` with its name in the ObjectType field, so other IFC programs read the task normally; the app also keeps the fixed id of the type, so renaming does not break the link. If someone opens the file on another computer, the type appears there under *From this project*, not in their own *My task types*.

**What does not go along** — how you have set up the screen (zoom, scroll position, selected task, collapsed phases, chosen filter and grouping) and the app settings ([Settings](docs://ref-instellingen)). The *IFC* tab shows the IFC text of your project.

## MS Project XML (MSPDI)

**Open** — yes. The app recognises an `.xml` file as MS Project XML by the root element `Project` in the MS Project namespace (or without a namespace). Calculation profile: *Open Planner Studio*.

**Save** — no. Such a project gets no save target.

**Export** — yes, as *MS Project XML* (*Opens in Microsoft Project. Full WBS structure.*). Default name: the project name with `.xml`.

**What goes along** — tasks with structure (level and WBS), duration, dates and progress; relations with lag, also in hours or percentages; constraints, including the deadline; calendars, including task and resource calendars; resources and assignments, including the curve or hour distribution; the status date; the critical threshold, as a whole number of work days of 0 or more with *Total float ≤ threshold*; the description of a task (as a note); the work rule of a task (as the MS Project task type); a custom task type, in a free field (`ExtendedAttribute`) that the app reads back and that MS Project may ignore. Of your baselines only the active one goes along, as baseline 0. A task in hours keeps its unit, and a milestone its kind (start, finish or automatic).

**What does not go along** — notes (the checklist on a task), external links to other projects, activity codes and custom fields, a second constraint, the marking *Manually scheduled*, the leveling delay, the resume and stop point of an out-of-sequence task, the conventions *Remaining work resumes after the elapsed duration* and *Don't move unstarted tasks to the status date* of an MS Project profile, and the other calculation options. Interrupted tasks without an hour distribution go along without their interruptions.

**What changes on the way** — a constraint *Must start on (MSO)* or *Must finish on (MFO)* without the choice *Mandatory (pin logic)* becomes *Start no earlier than (SNET)* or *Finish no earlier than (FNET)*. A hammock becomes an ordinary task with calculated dates.

## MS Project file (`.mpp`)

**Open** — yes, from MS Project 2010 through 2021. Calculation profile: *Microsoft Project*. The app only reads the file: it never changes your `.mpp`. A file from MS Project 2007 or older, and a password-protected file, it refuses with a message that points to the XML export of MS Project.

**Save** — no, and there is no save target: *Save* writes a new IFC file.

**Export** — no.

**What goes along** — tasks with structure, duration and constraints; relations with lag; calendars; resources and assignments; progress; a WBS code that you filled in yourself in MS Project. The dates and float that MS Project calculated itself are read too, for the view *Dates as recorded*.

**What does not go along** — baselines, costs and rates, notes and the custom fields of MS Project. See [Opening an MS Project file (.mpp)](docs://howto-mpp-openen).

**Origin and license** — the `.mpp` reader was written for Open Planner Studio and is derived from the source code and structural knowledge of MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), a Java library under LGPL-2.1. Structure and field constants were ported to TypeScript. Open Planner Studio itself is open source under LGPL-3.0. The `.xer` reader is not a derivative: MPXJ was only consulted there as a source of understanding.

## Primavera P6 XML

**Open** — yes. The app recognises an `.xml` file as P6 XML by the root element `APIBusinessObjects`. Calculation profile: *Open Planner Studio*.

**Save** — no.

**Export** — yes, as *Primavera P6 XML* (*For Oracle Primavera P6.*). Default name: the project name with `.xml`, so the same name as an MS Project XML export: give them different names yourself.

**What goes along** — WBS structure and tasks with duration, dates and progress; relations with lag; constraints (also a second one, as a soft constraint); calendars; resources and assignments; the status date (as `DataDate`); a custom task type, in a field of its own, `OPS Custom Task Type`, that the app reads back and that P6 may ignore.

**What does not go along** — baselines and deadlines; activity codes, custom fields, notes and external links; the calculation options; a working calendar exception (an exception that makes a day a working day). P6 has no lag in percentages: the app converts it to a fixed number of days. A lag in calendar days becomes a lag in working time: 3 calendar days become 3 work days. A hammock becomes an ordinary task, a manually scheduled task an ordinary task with calculated dates, and a leveling delay of less than a day is dropped.

## Primavera file (`.xer`)

**Open** — yes. Calculation profile: *Primavera P6*. The app only reads the file: it does not write `.xer` and never changes your file. It opens one tab per project with tasks. A file without activities or with damaged tables it refuses with a message.

**Save** — no, and there is no save target: *Save* writes a new IFC file, with the original `.xer` inside.

**Export** — no. If you export a project from a `.xer` to CSV, MS Project XML or P6 XML, the app reports that XER source information is lost, even if you saved the project as IFC in between. To IFC nothing is lost.

**What goes along** — the WBS structure and activities with duration, dates, constraints and progress; relations with lag; calendars; resources with assignments; activity codes; custom fields (UDFs); notes; the scheduling settings of P6. An activity of the type *Level of Effort* becomes a hammock. A baseline project becomes the active baseline of the project that refers to it. A relation between two projects is kept by the app as source data.

**What does not go along** — a project without activities, and a relation between two projects as a real relation in your schedule. See [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

## CSV

**Open** — yes. The app reads `;` and `,` as separator. It recognises column headers in English and Dutch (for example `Name` or `Naam`, `Duration` or `Duur`, `Predecessors` or `Voorgangers`). Dates may be *yyyy-mm-dd*, *dd-mm-yyyy* or *dd/mm/yyyy*. You write a predecessor as WBS code, relation type and lag, for example `1.2FS+2d`. Calculation profile: *Open Planner Studio*. The project is called *CSV Import*. A `Task Type` that is none of the fixed codes (such as `CONSTRUCTION` or `INSTALLATION`, which the app writes itself) becomes a custom task type under *From this project*, not in *My task types*; with `OPS Custom Task Type ID` the id of a custom type is kept.

**Save** — no.

**Export** — yes, as *CSV (;)* (*Universal table export. All tasks with dates and durations.*), on the card *CSV (semicolon-separated)*. The file uses a semicolon as separator, is in UTF-8 with a BOM and has English column headers.

**What goes along** — per task these columns: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` and `Description`. Completion is in whole percentages.

**What does not go along** — resources, assignments, calendars, constraints, deadlines, baselines and the status date. If the dates are in the view *Dates as recorded*, the export leaves `Critical` and `Total Float` empty for tasks whose source file did not record that.

## Progress sheet (Excel and CSV)

**Open** — yes, via *File › Import* (*Update progress from a spreadsheet*) or via the button of that name in the ribbon group *Progress* on *Planning*, *Table* and *Report*. The app reads `.xlsx` and `.csv`, up to 16 MB and 50,000 rows. This does not open a project: it updates the progress of your open project. See [Importing progress from a spreadsheet](docs://howto-voortgang-importeren).

**Save** — no.

**Export** — yes, as *Progress sheet (Excel)* (*Progress (Excel)* in the list) and *Progress sheet (CSV)* (*Progress (CSV)*). Default name: *projectname-voortgang*. The button *Export progress sheet* in the same ribbon group makes the Excel sheet in one click. The Excel sheet has fixed column widths, locked fields and date checking; the CSV sheet is the same content as plain text.

**What goes along** — the columns `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` and `Actual Finish`. When reading it in, the app uses `Completion (%)`, `Actual Start` and `Actual Finish`; `Start` and `Finish` only serve to recognise the date notation and do not change your schedule. The app links rows to tasks by the `OPS Task ID`, or otherwise by a unique WBS code.

**What does not go along** — everything outside these columns: duration, relations, resources and the rest of your schedule. A summary task gets no progress from the sheet.

## PDF

**Open** — no.

**Save** — no.

**Export** — yes, from a report: on the *Report* tab the button *Export PDF*. The app does not send a report to a printer itself; the way to paper is via the PDF. The content depends on the report type: see [Report types](docs://ref-rapporttypes) and [Making and printing a report](docs://howto-rapport-maken-en-afdrukken).

## See also

- [Files and formats](docs://uitleg-bestanden): why IFC is the own format and what an export loses, with an example.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): the steps.
- [Exporting](docs://howto-exporteren): choosing a format and the messages after an export.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): why an opened file can show other dates.
- [Calculation options and conventions](docs://ref-rekenopties-en-conventies): the calculation profiles.
