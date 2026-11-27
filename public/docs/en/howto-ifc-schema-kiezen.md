# Choosing the IFC schema

Goal: save your schedule in the IFC schema of the building model you want to merge it with.

## When you need this

By default, the app saves a project as IFC 4.3 ADD2. That is the name of IFC 4.3 in the files that IfcOpenShell and Bonsai create. If you want to merge the schedule with a building model into one 4D file, for example with the *MergeProjects* recipe of IfcOpenShell (ifcpatch), both files must have the same schema. If the building model is an IFC4 file, IfcOpenShell refuses to merge it with an IFC 4.3 schedule. Then choose the schema of the model here.

## Steps

1. Open *Project settings*: *Settings › Project › Project settings*, or *File › Project settings*.
2. Under *IFC schema when saving*, choose the schema of your building model.
3. Click *Apply*. The project is now *Unsaved*.
4. Save with *Save* (Ctrl+S) or *Save As*.

With the experimental setting *Open and save IFCX* on, *Project settings* shows the current *File type* above *IFC schema when saving*. Choose the schema here. To choose the file type, use [Save As in the desktop app](docs://howto-bestand-openen-en-opslaan). When you save an IFCX schedule as IFC, the app uses the selected IFC schema without asking. For an IFCX file, that schema applies only when you later save as IFC.

The three choices:

- *IFC 4.3 ADD2 (default)* writes `IFC4X3_ADD2` in the header of the file.
- *IFC 4.3* writes `IFC4X3`. That is how older versions of the app wrote IFC 4.3.
- *IFC4* writes `IFC4`, for a building model in IFC4.

## Pitfalls and what the app does

**Opening an IFC file with a building model.** Turn on *Open IFC with a building model* (see [App settings](docs://ref-instellingen)). If the schema field is locked, the app keeps the building model's schema when saving as IFC.

**The app asks first when an opened IFC file has another schema.** If you open, for example, an IFC4 file, or an IFC 4.3 file from an older version of the app, the app keeps the schema until you make a choice. The first time you use *Save* or *Save As*, it first asks whether you keep the schema of the file or go to IFC 4.3 ADD2. *Keep IFC4* (or *Keep IFC 4.3*) is the button that Enter chooses. If you close the question with Esc or the cross, the app saves nothing.

With the experimental setting *Open and save IFCX* on, a pending schema prompt can still appear before the save dialog, while your document is an IFC file. Choosing IFCX in the dialog brings up no new schema prompt for the conversion. There is no schema prompt when you save or reopen the IFCX file either.

**The app asks only once per file.** Your choice is stored in the file itself. If you open it again later, the app does not ask again. If you choose a schema yourself in *Project settings* and click *Apply*, the app does not ask either.

**A schema that the app cannot write**, such as IFC2X3, opens in the app for a schedule without a building model. An IFC2X3 file with a building model does not open. The first time you save, the question says so, and you choose one of the three schemas above.

**Auto-save and crash recovery ask nothing.** They write the schema of the file and keep the question for the first time you save yourself. For a schema that the app cannot write, *AutoSave* does not write to the file until you have answered the question.

**A new project asks nothing.** A new project, and a project from another format such as XER, MPP or CSV, starts at *IFC 4.3 ADD2 (default)*.

**The content of the file does not change.** The three schemas know the scheduling data that the app writes in the same way. Only the `FILE_SCHEMA` line in the header differs. So you lose nothing when you choose another schema.

**An IFC 4.3 model from IfcOpenShell or Bonsai** usually has `IFC4X3_ADD2` in the header, like the default of the app. IfcOpenShell does not merge a schedule with `IFC4X3` into it. If in doubt, look at the `FILE_SCHEMA` line at the top of the model file.

**Undo does not change the schema.** The schema belongs to the file, like the place where it is stored. A choice in *Project settings* and the answer to the question when saving are therefore not a step in *Undo*. To go back, choose the other schema in *Project settings*. That way *AutoSave* never silently writes another schema after you undo an edit.

## See also

- [New project and Project settings](docs://ref-projectinfo): all fields of the form.
- [Files and formats](docs://uitleg-bestanden): how the app saves schedules.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): save and save as.
