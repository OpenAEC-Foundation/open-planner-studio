# New project and Project info

The fields of the *New project* window and of *Project info*: what each field does, what the default is and where it takes effect. They are two sides of the same form. *New project* creates a new project and has a few extra fields. *Project info* changes the project you have open.

## Opening

**New project** — *File › New*, Ctrl+N, or the plus to the right of the document tabs (*Start a project*, then *New project*). The window opens with the cursor in *Project name*.

**Project info** — *Settings › Project › Project info* opens the form as a window. *File › Project info* shows the same form in the *File* screen. The block *Calculation profile and options* is at the bottom in both places; what is in it is in [Calculation options and conventions](docs://ref-rekenopties-en-conventies).

## Create, Apply and cancel

**Create** (in *New project*) makes the project and opens it in a tab of its own. **Apply** (in *Project info*) writes your changes to the project.

- **Only at Apply.** You type into a draft. The project changes only when you click *Apply*. *Apply* writes only what you actually changed, in one step in *Undo*. If you click *Apply* without changing anything, nothing happens and no step is added.
- **Cancel, the cross and Esc** close the window without saving anything. A click next to the window does not close it: what you had typed stays.
- **Enter** does the same as *Create* or *Apply*, except in the *Description* field and in an open drop-down.
- **In the File screen** *Project info* shows *Changes not applied — click Apply to keep them.* at the bottom as long as your draft differs. If you then leave the screen, the app asks whether you want to apply, discard or cancel. See [The ribbon, tab by tab](docs://ref-lint).
- **A custom calculation profile without a name** blocks *Apply* and *Create*. Give it a name, or discard the change.

## Fields in both windows

**Project name** — the name of the project in the title bar, on the tab and in the file name when you save. Default: empty. An empty field is allowed: the project is then called *New schedule*, shown as grey text in the field. Where: the whole screen.

**Description** — free text. Default: empty. Effect: stored with the project, in the IFC file and in the export to Primavera P6 XML, and has no influence on the schedule.

**Author** — free text. Default: empty. Effect: goes into the IFC file and appears as *Author:* in the header of a report, where you cannot retype it.

**Resource library** — which resource library the project is linked to. Choose from *none (standalone project)*, your existing libraries and *+ New resource library…*. Default: in *New project* the default library, in *Project info* the current link. Effect: see [Using the resource library](docs://howto-resourcebibliotheek-gebruiken). With *+ New resource library…* you type a name in a field below; the library is only made at *Create* or *Apply*, so cancelling leaves nothing behind. A link in *Project info* is only changed if you touch this field yourself.

**Client/organization** — free text. Default: empty. Effect: goes into the IFC file and appears as *Company:* in the header of a report.

**Start date** — the start of the project. Default: in *New project* today. What the field does is below under *What the start date does*.

**End date** — the planned end of the project. Default: empty. Effect: a piece of information, not a requirement: the app does not plan towards this date. It appears in the header of a report and in exports, and determines up to which year the holidays are generated. Only for a Primavera file with the setting *Calculate float up to the project finish date* (see [Calculation options and conventions](docs://ref-rekenopties-en-conventies)) does the float calculation run up to this date.

**Default unit for new tasks** — only visible when *Enable hour planning* is on. Choose from *Days* and *Hours*. Default: *Days*. Effect and conditions: see [Turning on hour planning](docs://howto-urenplanning-aanzetten).

**Calculation profile and options** — in *Project info* the whole block, in *New project* only the drop-down *Calculation profile* with *Primavera P6*, *Microsoft Project* and *Open Planner Studio*. Default: *Open Planner Studio*. Choosing a profile also sets the default options of that profile. See [Calculation options and conventions](docs://ref-rekenopties-en-conventies).

## Only in the New project window

**Phasing template** — which phases the project starts with. Choose from *Empty*, *Residential construction* and *Commercial / renovation*. Default: *Empty*. Effect: *Empty* gives a project without tasks. The other two put eight phase tasks ready, each with 5 working days and without relations; you rename, move and extend them yourself. For *Residential construction* these are: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking and Oplevering. For *Commercial / renovation*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen and Oplevering. The names are data of your project and stay Dutch, also in another interface language. If *Enable construction mode* is off, only *Empty* exists. See [Settings](docs://ref-instellingen).

**Shift** — only visible when *Enable hour planning* is on. Choose from *Day shift*, *2 shifts*, *3 shifts* and *24/7*. Default: *Day shift*. Effect: *Day shift* leaves the standard calendar as it is, an ordinary day calendar from Monday to Friday. The other three put working-time blocks on the project's calendar, like the buttons with the same name in the *Calendars* window. Which times those are is in [Setting working times](docs://howto-werktijden-instellen). With *Day shift*, *Hours* cannot be chosen under *Default unit for new tasks*, because a day calendar has no work blocks.

**Holiday set** — which days off the project calendar gets. At *Country* you choose *Netherlands* (default), *Germany*, *Belgium*, *France*, *United Kingdom*, *Austria*, *Switzerland*, *No holidays* or *Custom…*. If the country has regions, a drop-down *Region* is added. For the Netherlands you also choose, if *Enable construction mode* is on, the *Construction holiday*: *None* (default), *North*, *Central* or *South*. Below it is a line like *36 holidays, 2025–2029*, which you expand for the list. The years run from the year before the start date to the year after the end date, or to three years after the start year if there is no end date. *Custom…* gives a calendar without holidays and opens the *Calendars* window straight after creating, so you can fill them in yourself. The project calendar is called *Bouwkalender NL*, or *Standaardkalender* if *Enable construction mode* is off; the choice is then also *No holidays*. How the generator works is in [Generating holidays and the construction holiday](docs://howto-feestdagen-genereren).

## What the start date does

The start date is the anchor of the project. Three rules:

- **New tasks begin on the start date.** A task you add gets the project start as its planned start.
- **A task with a predecessor never begins before the start date.** If the end of the predecessor is earlier, the task waits until the start date. A task *without* a predecessor keeps its own date, even if that lies before the start date. That is needed to show a schedule from MS Project or Primavera the way the source program shows it. A constraint *Must start on (MSO)* or *Must finish on (MFO)* breaks both rules: such a task sits on its date, even if that falls before the start date.
- **A later start date moves loose tasks along.** If you set the start date later in *Project info* and click *Apply*, tasks without a predecessor and without a constraint that would lie before the new date move to that date, in the same step in *Undo*. The app says how many tasks were moved. That only happens when you change the start date yourself, never when opening a file. Setting the start date later does not move the rest of the schedule: *Move project* does that, see [Moving a project](docs://howto-project-verplaatsen).

## See also

- [Calculation options and conventions](docs://ref-rekenopties-en-conventies): the block *Calculation profile and options*.
- [Calculation profiles and conventions](docs://uitleg-rekenprofielen): why a profile changes the outcome.
- [Moving a project](docs://howto-project-verplaatsen): the whole schedule to another start.
- [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen): starting on the first tasks.
- [Generating holidays and the construction holiday](docs://howto-feestdagen-genereren): the holiday set in detail.
