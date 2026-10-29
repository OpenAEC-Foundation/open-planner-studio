# Opening and saving a file

Goal: open a project from a file and keep your changes.

## When you need this

You start the day with yesterday's project, you get a file from a colleague or from another package, or you want to capture an interim state before you change something big. What the app keeps in a file, and why only IFC keeps your whole project, is explained in [Files and formats](docs://uitleg-bestanden).

## Steps

### Opening a file

1. Choose *Home › File › Open*, or *File › Open*, or press Ctrl+O (⌘+O on a Mac). The *File* group is also on the *Table* tab.
2. Choose the file. You open one file at a time. On the desktop and in browsers with file access, such as Chrome and Edge, the window shows a list of file types: *All Supported*, *IFC Files*, *CSV Files*, *XML Files*, *MS Project Files* and *Primavera XER Files*.
3. The project opens in a new tab. If the current tab was still empty and unchanged, the project opens in it.
4. If the file was not IFC, a window appears with a short explanation of that format. A green block says what the app took over, an amber block what was not included or only partly, and a blue block how saving and writing back work. *Read more* opens the guide for that format. Click *Got it* to close the window. First tick *Don't show again for …* if you no longer want to see this explanation for that format. You turn it back on in [App settings](docs://ref-instellingen), on the *Advanced* tab.

An IFC file gives its file name to the tab. A project from another format gets its project name.

The app opens `.ifc`, `.csv`, `.xml` (MS Project XML or Primavera P6 XML), `.mpp` and `.xer`. For the last two there are separate steps in [Opening an MS Project file (.mpp)](docs://howto-mpp-openen) and [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

### Opening a recent project

Choose *Home › File › Recent* and click a file in the list, or choose *File › Recent*. The list keeps the last ten files that you opened, saved or exported. Here too, a file that is not IFC is followed by the explanation of its format. The desktop app shows the path for each file, a browser only the name.

If the app can no longer read a file in the list, for example because you moved it, it disappears from the list without a message. In browsers without file access, such as Firefox, *Recent* stays empty.

### Opening an example

Choose *File › Examples* and click an example project. It opens in a tab, without a file: *Save* therefore asks where you want to keep it.

### Saving

Choose *Home › File › Save* or *File › Save*, or press Ctrl+S. What happens then depends on your project:

1. If the project already has a file, because you opened an IFC file or saved it before, the app writes to that file. No window appears, except at the first save of a file with an IFC schema other than IFC 4.3 ADD2. Then the app first asks *Which IFC schema to save in?* See [Choosing the IFC schema](docs://howto-ifc-schema-kiezen).
2. If the project has no file yet, the app asks where it should go. It suggests the project name with `.ifc`. After that, that file is the project's file.
3. If your browser only saves through a download (such as Firefox), the file lands in your downloads folder, and every save creates a new download. The first time in a session you see the message *Saved as a download: 'name.ifc' is in your downloads folder. This browser does not let the app write to a place of its own, so every save creates a new download. In Chrome, Edge or the desktop app, Save simply updates the same file.*
4. If limited file access prevents your browser from writing back to the project's file, the app asks again where to put the file every time you save. That looks like *Save As*, but it is a limit of the browser. The first time in a session the message *This browser does not let the app write back to 'name.ifc'.* explains this, with a link to [Files](docs://uitleg-bestanden).

After saving, the *Unsaved* marker disappears: the dot on the tab, the asterisk before the project name at the top and the text *Unsaved* at the bottom right of the status bar.

### Saving under another name

Choose *Home › File › Save As* or *File › Save As*, or press Ctrl+Shift+S. Choose a name and a place (in Firefox the app downloads a new file instead). After that the project works with this new file: the next *Save* writes there. The old file stays as it was the last time you saved.

### Closing a project

Click the cross on the tab, or choose *File › Close project*. If the project has changes that you did not save, the app asks: *Unsaved changes: 'name' has changes that haven't been saved yet.* You choose *Cancel* (the project stays open), *Don't save* (the project closes and your changes are gone) or *Save* (save first, then close). If you close the whole app on the desktop (with the close button, Alt+F4 or your operating system's menu), it asks this for every project with changes; *Cancel*, or a save that fails, stops the closing. After such a normal close the app cleans up the recovery copies of that session, so the recovery window only appears after a real crash. If a project has changes and you close the browser tab or window, the browser asks for confirmation.

## Pitfalls and what the app does then

**An opened IFC file is immediately your project's file.** *Save* overwrites that file, even if it comes from another program. If you want to keep the original, choose *Save As* first.

**Other formats are never overwritten.** A `.csv`, `.xml`, `.mpp` or `.xer` has no file after opening. *Save* writes a new IFC file and leaves the original alone.

**In Firefox every save makes a new file.** The app cannot write into your file there. It downloads a new file each time, with the project name as file name and not the name of the file you opened.

**Chrome and Edge ask for permission.** At the first *Save* of a file you opened, the browser asks whether the app may write to it. If you refuse, the app opens a window in which you choose a new file. In Chrome and Edge you also get that window if writing to the existing file fails, for example because the file disappeared or is locked.

**A message about duplicate ids or relations that do not count.** After opening, a message can stay on screen. If it says *Objects with a duplicate id in this file*, each duplicate object got its own id and references point to the first occurrence. Check relations and assignments then. If it says *relation(s) could not be included in the calculation*, the relation sat on a summary task and has no effect, for example a task linked to its own summary. The file itself stays unchanged. See [Relations](docs://uitleg-relaties) for what a relation on a summary task does.

**Saving can fail.** If saving gives an error, the app reports *Failed to save*, with the reason. In Chrome and Edge this error notification appears before the window in which you can choose another file. If you cancel that window, your project stays open and marked *Unsaved*. If saving to the other file succeeds, that marker disappears and your project uses that file from then on. Changes you made while saving remain marked *Unsaved*. The error notification about the earlier attempt stays until you close it. If the second attempt also fails, the same notification shows the latest reason.

## See also

- [Files and formats](docs://uitleg-bestanden): what is in an IFC file and how the app treats formats.
- [Turning on AutoSave](docs://howto-automatisch-opslaan): letting the app update your file itself.
- [Choosing the IFC schema](docs://howto-ifc-schema-kiezen): what the question *Which IFC schema to save in?* means.
- [Exporting](docs://howto-exporteren): making a copy in another format.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what you do if the app did not close cleanly.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
