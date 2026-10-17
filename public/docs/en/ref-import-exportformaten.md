# Import and export formats

Per file format: whether you can open, save and export it, what does and does not go along and which calculation profile it opens with. The why behind all this, and an example with numbers, is in [Files and formats](docs://uitleg-bestanden).

## At a glance

**Opening** works with IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` and `.xer`. A file with any other extension is treated by the app as IFC.

**Saving** always writes IFC. Only an opened IFC file becomes the save target; a project from another format has no file after opening, and *Save* then asks where the IFC file should go.

**Exporting** works to IFC, MS Project XML, Primavera P6 XML, CSV and two progress sheets (Excel and CSV). An export does not change your project.

**Read-only** are `.mpp` and `.xer`: the app can open them, not write them.

**PDF** only comes from a report (see [Report types](docs://ref-rapporttypes)). The app does not read PDF.

**Where.** Opening: *Home › File › Open*, *File › Open* or Ctrl+O. Exporting: *Home › File › Export* or *File › Export*. You read a filled-in progress sheet in via *File › Import*, or with the button *Update progress from a spreadsheet* in the ribbon group *Progress* on the *Planning*, *Table* and *Report* tabs.

**Calculation profile on opening.** Every format opens with a calculation profile; what that is, is in [Calculation options and conventions](docs://ref-rekenopties-en-conventies). `.xer` opens with *Primavera P6*, `.mpp` with *Microsoft Project*, and CSV, MS Project XML and P6 XML with *Open Planner Studio*. IFC keeps the profile stored in the file. For `.xer` and `.mpp` the app reports that the project calculates this way. Only IFC carries the calculation profile and the calculation options; of the calculation options, MS Project XML writes at most the critical threshold. A reopened export of another format calculates as *Open Planner Studio*.

## IFC

**Open** — yes, `.ifc`. The app reads IFC4 and IFC 4.3 (also ADD2). Calculation profile: the one in the file.

**Save** — yes, and it is the only format that saves. *Save* writes your whole project as an IFC file. The file becomes the save target.

**Export** — yes, as *IFC*, in the IFC schema of the project (default IFC 4.3 ADD2). Default name: the project name with the extension `.ifc`. If your project is linked to a resource library, the checkbox *Save library file alongside* is below the cards in *File › Export*. Ticked, the app asks for a place for *projectname-bibliotheek.ifc* after the project. The checkbox is not in the list on the *Home* tab.

**What goes along** — everything that belongs to the project: tasks with structure, duration, dates and progress; relations with lag; constraints and deadlines; calendars; resources and assignments, including the hour distribution; baselines; activity codes and custom fields; notes; external links to other projects; interruptions; task types and custom work categories; the project settings such as the status date, the progress mode, the calculation profile and the calculation options; the link with a resource library. For a project from a `.xer`, the original source file goes along too. A custom work category is stored as the IFC type `USERDEFINED` with its name in the ObjectType field, so other IFC programs read the task normally; the app also keeps the fixed id of the work category, so renaming does not break the link. If someone opens the file on another computer, the work category appears there under *From this project*, not in their own *My work categories*.

**What does not go along** — how you have set up the screen (zoom, scroll position, selected task, collapsed phases, chosen filter and grouping) and the app settings ([App settings](docs://ref-instellingen)). The *IFC* tab shows the IFC text of your project.

## MS Project XML (MSPDI)

**Open** — yes. The app recognises an `.xml` file as MS Project XML by the root element `Project` in the MS Project namespace (or without a namespace). Calculation profile: *Open Planner Studio*.

**Save** — no. Such a project gets no save target.

**Export** — yes, as *MS Project XML* (*Opens in Microsoft Project. Full WBS structure.*). Default name: the project name with `.xml`.

**What goes along** — tasks with structure (level and WBS), duration, dates and progress; relations with lag, also in hours or percentages; constraints, including the deadline; calendars, including task and resource calendars; resources and assignments, including the curve or hour distribution; the status date; the critical threshold, as a whole number of work days of 0 or more with *Total float ≤ threshold*; the description of a task (as a note); the task type of a task (as the MS Project task type); a custom work category, in a free field (`ExtendedAttribute`) that the app reads back and that MS Project may ignore. Of your baselines only the active one goes along, as baseline 0. A task in hours keeps its unit, and a milestone its kind (start, finish or automatic).

**What does not go along** — notes (the checklist on a task), external links to other projects, activity codes and custom fields, a second constraint, the marking *Manually scheduled*, the leveling delay, the resume and stop point of an out-of-sequence task, the conventions *Remaining work resumes after the elapsed duration* and *Don't move unstarted tasks to the status date* of an MS Project profile, and the other calculation options. Interrupted tasks without an hour distribution go along without their interruptions.

**What changes on the way** — a constraint *Must start on (MSO)* or *Must finish on (MFO)* without the choice *Mandatory (pin logic)* becomes *Start no earlier than (SNET)* or *Finish no earlier than (FNET)*. A hammock becomes an ordinary task with calculated dates. MS Project XML stores the hours per day only for the project calendar. Another calendar with its own hours per day gets its working time as hours per day when you open the file: 8 hours per day with working times of 10 hours becomes 10. A task in days on such a calendar then gets shorter, for example 4 days instead of 5.

## MS Project file (`.mpp`)

**Open** — yes, from MS Project 2010 through 2021. Calculation profile: *Microsoft Project*. The app only reads the file: it never changes your `.mpp`. A file from MS Project 2007 or older, and a password-protected file, it refuses with a message that points to the XML export of MS Project.

**Save** — no, and there is no save target: *Save* writes a new IFC file.

**Export** — no.

**What goes along** — tasks with structure, duration and constraints; relations with lag; calendars; resources and assignments; progress; a WBS code that you filled in yourself in MS Project. The dates and float that MS Project calculated itself are read too, for the view *Dates as recorded*.

**What does not go along** — baselines, costs and rates, notes and the custom fields of MS Project. See [Opening an MS Project file (.mpp)](docs://howto-mpp-openen).

**Origin and license** — the `.mpp` reader was written for Open Planner Studio and is derived from the source code and structural knowledge of MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), a Java library under LGPL-2.1. Structure and field constants were ported to TypeScript. Open Planner Studio itself is open source under LGPL-3.0. The `.xer` reader is not a derivative: MPXJ was only consulted there as a source of understanding.

## Primavera P6 XML

**Open** — yes. The app recognises an `.xml` file as P6 XML by the root element `APIBusinessObjects`. Calculation profile: *Open Planner Studio*.

**Several projects in one file.** Each project with activities opens in its own tab, named *Project name (Project ID)*. The app skips a project without activities. The active tab is the project with the most activities. The app does not carry over a relation to another project, nor an activity that belongs to no project. After opening, the app reports how many projects it opened.

**Baselines.** A `<BaselineProject>` in the file becomes a baseline of its project. The baseline that P6 marks as active is also active in the app.

**Rate of an assignment.** If work remains, the remaining rate (`RemainingUnitsPerTime`) becomes the *Units/day*. Otherwise it is the planned rate (`PlannedUnitsPerTime`). For material the planned rate stays. The app recalculates nothing when it opens the file. On an export to P6 XML it writes the planned rate as `PlannedUnitsPerTime`. It writes the remaining rate as `RemainingUnitsPerTime` only when the assignment has a separate planned rate.

**No readable activities.** If the app finds no activity it can read, it does not open a tab. It reports this, with the reason when it is known. Examples: activities without an `ObjectId`, or XER column names in an XML file. Then export the project from P6 again as P6 XML, or open it as `.xer`.

**Save** — no.

**Export** — yes, as *Primavera P6 XML* (*For Oracle Primavera P6.*). Default name: the project name with `.xml`, with the project ID in brackets if the project has one. An MS Project XML export gets the same name: give them different names yourself.

**Project name and project ID.** The app keeps the project ID from P6 separate from the project name, as with an `.xer`. *Project settings* shows only the name, for example *Bid for Facility Extension*. The tab shows *Bid for Facility Extension (OZB-05)*. If you rename the project to *Hall extension*, the tab is called *Hall extension (OZB-05)*. An export to P6 XML writes *OZB-05* back as the project ID and *Hall extension* as the name. That way P6 recognises the project. A project from an `.xer` also takes its project ID along. The project ID stays when you save the project as IFC. Brackets in the name itself, such as *New build (phase 2)*, stay in the name. A project without a project ID gets a unique ID of its own from the app at export, starting with *OPS:*.

**What goes along** — WBS structure and tasks with duration, dates and progress; relations with lag; constraints (also a second one, as a soft constraint); calendars; resources and assignments; the status date (as `DataDate`); a custom work category, in a field of its own, `OPS Custom Task Type`, that the app reads back and that P6 may ignore.

**What does not go along** — baselines and deadlines; activity codes, custom fields, notes and external links; the calculation options; the names of holidays. P6 has no name per day off: after reopening, a holiday is called *Holiday* and a working exception *Working exception*. Consecutive days off come back as one range. The app shortens a name or code that is longer than P6 allows: an activity name to 120 characters, an activity ID or WBS code to 40, a WBS or project name to 100. It reports how many names and codes it shortened. P6 has no lag in percentages: the app converts it to a fixed number of days. A lag in calendar days becomes a lag in working time: 3 calendar days become 3 work days. A hammock becomes an ordinary task, a manually scheduled task an ordinary task with calculated dates, and a leveling delay of less than a day is dropped.

## Primavera file (`.xer`)

**Open** — yes. Calculation profile: *Primavera P6*. The app only reads the file: it does not write `.xer` and never changes your file. It opens one tab per project with tasks. A file without activities or with damaged tables it refuses with a message.

**Save** — no, and there is no save target: *Save* writes a new IFC file, with the original `.xer` inside.

**Export** — no. If you export a project from a `.xer` to CSV, MS Project XML or P6 XML, the app reports that XER source information is lost, even if you saved the project as IFC in between. To IFC nothing is lost.

**What goes along** — the WBS structure and activities with duration, dates, constraints and progress; relations with lag; calendars; resources with assignments; activity codes; custom fields (UDFs); notes; the scheduling settings of P6. An activity of the type *Level of Effort* becomes a hammock. A baseline project becomes the active baseline of the project that refers to it. A relation between two projects is kept by the app as source data.

**Rate of an assignment.** If work remains, the remaining rate (`remain_qty_per_hr`) becomes the *Units/day*. Otherwise it is the planned rate (`target_qty_per_hr`). The planned, actual and remaining work stay as in the file. For material the planned rate stays.

**What does not go along** — a project without activities, and a relation between two projects as a real relation in your schedule. See [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

## CSV

**Open** — yes. The app reads `;` and `,` as separator. It recognises column headers in English and Dutch (for example `Name` or `Naam`, `Duration` or `Duur`, `Predecessors` or `Voorgangers`). Dates may be *yyyy-mm-dd*, *dd-mm-yyyy* or *dd/mm/yyyy*. You write a predecessor as WBS code, relation type and lag, for example `1.2FS+2d`. Calculation profile: *Open Planner Studio*. The project is called *CSV Import*. The `Task Type` column holds the work category, not the task type; the app also reads the headers `Werksoort` and `Work category`. A `Task Type` that is none of the fixed codes (such as `CONSTRUCTION` or `INSTALLATION`, which the app writes itself) becomes a custom work category under *From this project*, not in *My work categories*; with `OPS Custom Task Type ID` the id of a custom work category is kept.

**Save** — no.

**Export** — yes, as *CSV (;)* (*Universal table export. All tasks with dates and durations.*), on the card *CSV (semicolon-separated)*. The file uses a semicolon as separator, is in UTF-8 with a BOM and has English column headers.

**What goes along** — per task these columns: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` and `Description`. The `Task Type` column holds the work category. Completion is in whole percentages.

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
