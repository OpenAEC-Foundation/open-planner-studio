# Choosing or building a calculation profile

Goal: decide which calculation rules a project uses. You choose a built-in profile, or you make a custom profile with your own conventions.

## When you need this

You open a project that must calculate as Primavera P6 or Microsoft Project, or you want to set one convention differently from what the profile does. What a profile is and why the dates can shift is in [Calculation profiles and conventions](docs://uitleg-rekenprofielen).

## Steps

### Choosing a profile for a new project

1. Choose *Home › File › New*. The *New project* window opens.
2. In the drop-down list *Calculation profile*, choose the profile: *Open Planner Studio*, *Primavera P6* or *Microsoft Project*.
3. Create the project. The app replaces the calculation options you had already filled in with the defaults of the profile.

### Switching the profile of an existing project

1. Choose *Settings › Project › Project settings*. You can also choose *File › Project settings*.
2. In the block *Calculation profile and options*, open the drop-down list *Calculation profile* and choose another profile.
3. Click **Apply**. The app recalculates the schedule straight away, even if *Calculate automatically* is off. If tasks moved, the app says how many.

Until you click *Apply*, the change exists only in the form. The whole switch is one step for *Undo*. Switching only changes the conventions; your calculation options stay as they are.

### Building a custom profile

1. In the block *Calculation profile and options*, click *New profile*, next to the drop-down list.
2. Enter a name. The app suggests *Copy of* the chosen profile, for example *Copy of Open Planner Studio*.
3. Click *Create*. The part *Conventions of this profile* expands.
4. Switch the conventions on or off with the checkboxes. The i icon after a line shows the explanation of that convention. A convention that differs from the base gets the label *back to base*.
5. Click **Apply**. Only then does the project calculate with the new profile.

The three built-in profiles cannot be changed. Their conventions are shown for information only.

### Keeping a custom profile as a template

1. If needed, give the custom profile another name in the field *Name of this custom profile*.
2. Click *Save as template*. The app reports that the template was saved, or why that failed.
3. In another project in the same app, the template is in the drop-down list *Calculation profile*.

If the profile later differs from the template, a yellow block says so. Then choose *Update template from this project* or *Update from template*.

You delete a template with *Delete template*. The app asks for confirmation first.

## Checking the result

- The block *Calculation profile and options* shows the chosen profile.
- After *Apply* the app reports moved tasks, for example *After applying, 4 tasks moved.*
- An orange block above the calculation options says that your calculation options differ from the default of the profile. That is often on purpose. If you want the default anyway, click *Use the … default settings*.

## Pitfalls and what the app does

**The dates shift.** Another profile can change real dates. Check the result. If you do not like it, choose *Undo*: profile and dates go back together.

**A yellow block after Undo.** If you press *Undo* or *Redo* while Project settings is open, the block follows the state of the project. If you had already changed something in the block yourself, your choice stays. A yellow block then says that *Apply* puts that choice back.

**There can be at most 100 templates.** If there are already 100, the app does not save the template and reports that. Delete a template first. A full or missing app storage also gives a message.

**Templates belong to the app, the profile to the project.** The project always carries its own copy of the profile. If you change the template later, the project does not change with it.

**Settings from a source file.** If you choose *Primavera P6* or *Microsoft Project* for a project that comes from another file, the settings from the source file stay. You cannot change them here.

## See also

- [Calculation profiles and conventions](docs://uitleg-rekenprofielen): what a profile is and what it does to dates.
- [Calculation options and conventions](docs://ref-rekenopties-en-conventies): all conventions and calculation options at a glance.
- [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen): Retained Logic or Progress Override, separate from the profile.
