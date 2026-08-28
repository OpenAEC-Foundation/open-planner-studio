# Task types

Task types classify a task. They do not change duration, calendars, progress, or scheduling.

## Built-in and personal types

Open the **Type** field in task properties or in the **Edit task** window. Fixed types such as **Construction** and **Installation** remain built in and follow the app language. They cannot be renamed or removed.

Your own types appear under **My task types**. Choose **+ New task type…** to add a type such as `Engineering` or `Permit`. A personal type is immediately available in every project on this installation.

## Managing types

Choose **Manage task types…** at the bottom of the same selector to rename or remove only personal types. Names are trimmed, cannot be empty, and are unique regardless of letter case.

A type found in an open project but not in your list appears under **From this project**. The manager lets you deliberately add it to **My task types**.

## Sharing and IFC

When you assign a personal type to a task, OPS also stores a project copy with its stable identity and name. The type therefore remains visible when someone opens the IFC file on another installation. It is not automatically added to that person's personal list.

For IFC software outside OPS, such a task remains valid as `USERDEFINED`; the readable name is stored in the standard ObjectType field. OPS additionally stores the stable identity in project metadata, so renaming never breaks existing task assignments.

## Import and export

IFC is the complete, recommended interchange and storage format for personal task types. CSV export writes a separate OPS id column alongside the readable type name, so a subsequent import keeps name and identity together. An unknown type name in an external CSV is imported as **From this project** and is not automatically added to **My task types**.

MS Project XML and P6 XML do not have an equivalent standard field for this OPS classification. OPS therefore writes an identifiable free-text field that other planners may ignore. A direct OPS export and import preserves the identity, but another application may remove that free field when editing or exporting the file again. Save the result as IFC when the classification must remain intact.

Native `.mpp` is import-only. An imported Microsoft Project task type is not the same thing as a personal OPS task type. You can assign a personal type after importing and save the result as IFC; OPS does not create `.mpp` exports containing personal task types.

Removing a type from **My task types** never deletes tasks or rewrites project files. Its project copy remains under **From this project** in an open project.
