# Opening and saving a file

Goal: open a project from a file and keep your changes.

## When you need this

You start the day with yesterday's project, you get a file from a colleague or from another package, or you want to capture an interim state before you change something big. What the app keeps in a file is explained in [Files and formats](docs://uitleg-bestanden).

## Steps

### Opening a file

1. Choose *Home › File › Open*, or *File › Open*, or press Ctrl+O (⌘+O on a Mac). The *File* group is also on the *Table* tab.
2. Choose the file. You open one file at a time. On the desktop and in browsers with file access, such as Chrome and Edge, the window shows a list of file types: *All Supported*, *IFC Files*, *CSV Files*, *XML Files*, *MS Project Files* and *Primavera XER Files*.
3. The project opens in a new tab. If the current tab was still empty and unchanged, the project opens in it.
4. For CSV, MS Project XML, Primavera P6 XML, `.mpp` and `.xer`, a window appears by default with a short explanation of that format. A green block says what the app took over, an amber block what was not included or only partly, and a blue block how saving and writing back work. *Read more* opens the guide for that format. Click *Got it* to close the window. First tick *Don't show again for …* if you no longer want to see this explanation for that format. You turn it back on in the app settings, in the [Notices](settings://formatNotices) group.

When you open an IFC file, the tab shows the file name without the extension. For an import, it shows the project name and, if available, the P6 project code.

If the experimental setting *Open IFC with a building model* is on (see [App settings](docs://ref-instellingen)) and you open an IFC file that is already open in a tab, no second tab appears: the app goes to that tab. That tab keeps its content, including changes you have not saved yet. If the file has changed since that tab opened or saved it, for example because a colleague saved a new version, a strip appears above that tab: *kantoor.ifc was changed outside this tab. This tab still shows the earlier version. Close this tab and open the file again to see the new version.* The strip belongs to that tab and stays until you save the tab, export it as IFC over the same file or close it. If the tab has changes you have not saved and you want to keep them, choose *Save As* first, so they go into a new file. The app never loads a new version by itself. If the app does not know which version the tab has, for example because you opened it while the setting was off, the file opens in a new tab; only a double-click then goes to the open tab as always, without a message. In the desktop app, the app recognises the same file by exactly the same path text: through a shortcut or a path written differently, it gets a tab of its own. In the browser, the app has to recognise the file in time; if it does not, the file opens in a new tab. The same goes for dragging, *Recent* and a double-click. A file in another format, such as `.csv` or `.xer`, does open again in a tab of its own. So does a file from your computer in browsers that only download, such as Firefox. If the setting is off, an IFC file that is already open also opens in a new tab; only a double-click then goes to the open tab, without a message.

The app opens `.ifc`, `.csv`, `.xml` (MS Project XML or Primavera P6 XML), `.mpp` and `.xer`. For the last two there are separate steps in [Opening an MS Project file (.mpp)](docs://howto-mpp-openen) and [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen).

With the experimental setting *Open and save IFCX* on (see [App settings](docs://ref-instellingen)), the app also opens `.ifcx` schedules it wrote itself. A file picker with a list of file types then also lists *IFCX Files*. If the app refuses to open the file, see [Notices and warnings](docs://ref-meldingen) for the reason. If the `.ifcx` schedule is already open in a tab and the app recognises that it is the same file, no second tab appears: the app goes to that tab, also via *Recent* and when you drag the file, and also when *Open IFC with a building model* is off. That tab keeps its content. If the file has been changed outside that tab in the meantime, the same strip as for an IFC file appears above it and the tab still shows the earlier version. To see the new version, close that tab and open the file again; first keep changes you have not saved with *Save As* in a new file. Recognising the file has the same limits as described above for IFC: exactly the same path text in the desktop app, and recognising it in time in the browser. If the app does not recognise the file, as with a file from your computer in browsers that only download (Firefox), it opens in a new tab.

### Dragging a file into the app

1. Drag one or more files from your file manager or Finder onto the app window.
2. While you drag, a grey layer covers the window, with *Drop to open* and *Project file or import*.
3. Release the mouse button. The app opens the files in the order you dragged them. With the experimental setting *Open IFC with a building model* on, the app switches to the open tab if it recognises the IFC file and knows the version held by that tab. The same goes for an `.ifcx` schedule, also with that setting off: if the app recognises the file in an open tab, it goes there. The last file is then the active tab. If the current tab was empty and unchanged, the first file opens in it.
4. If a file shows the explanation of its format, the next file opens only after you close that explanation with *Got it*. This way each file gets its own explanation.

A project with changes stays in its own tab; dragging replaces nothing. A dragged IFC file then works like an opened file: *Save* writes to it, except in browsers that only download, such as Firefox.

A file in a format that the app does not know, such as a `.pdf`, does not open. You then see the message *Not opened: drawing.pdf.* The other files from the same drag open as usual.

If a dialog or question is open, dragging opens nothing. If you open a dialog while the app is still reading a large file, that file opens only when you close the dialog. In the browser, the mouse pointer then shows a no-entry sign. In the desktop app, the message *Not opened: plan.ifc. Close the open dialog first.* appears.

### Opening a file with a double-click (desktop app)

The installer does not associate `.ifc` with the app. To open a file with a double-click, associate the format yourself: on Windows, right-click the file, choose *Open with* and *Choose another app*. The app then opens the file as with *Open*, in its own tab. If the app is already running, the file opens in that window. If the file is already open in a tab there, the app goes to that tab. This also works from the command line, with the path as an argument.

If a dialog is open when the app starts, such as the welcome dialog, the file opens as soon as you close that dialog. If the file does not exist, or is in a format the app does not know, you see the usual message and the app stays open. The app cannot yet read a file outside your home folder this way; open it with *Open* instead.

### Opening a recent project

Choose *Home › File › Recent* and click a file in the list, or choose *File › Recent*. The list keeps up to ten files that the app can reopen. Downloads and exported progress sheets do not appear in it. Here too, an explanation appears by default for CSV, MS Project XML, Primavera P6 XML, `.mpp` and `.xer`. The desktop app shows the path for each file, a browser only the name.

If the app can no longer read a file in the list, for example because you moved it, it disappears from the list without a message. In browsers without file access, such as Firefox, *Recent* stays empty.

### Opening an example

Choose *File › Examples* and click an example project. It opens in a tab, without a file: *Save* therefore asks where you want to keep it.

### Saving

Choose *Home › File › Save* or *File › Save*, or press Ctrl+S. For an IFC schedule, saving works as follows.

1. If the app can update the project file, it writes back to that file. If you still need to choose an IFC schema, the app first asks *Which IFC schema to save in?* See [Choosing the IFC schema](docs://howto-ifc-schema-kiezen).
2. If a plain IFC schedule has no file yet, the app suggests a name ending in `.ifc`. On the desktop and in browsers with a save dialog, you choose where the file goes.
3. In Firefox, saving locally downloads a copy each time. The first time in a session you see the message *Saved as a download: 'name.ifc' is in your downloads folder. This browser does not let the app write to a place of its own, so every save creates a new download. In Chrome, Edge or the desktop app, Save simply updates the same file.*
4. If you deny write access to a plain IFC schedule in Chrome or Edge, you can choose another file in the save dialog. If the browser also blocks that dialog, the app downloads a copy. The first time this happens in a session, you get an explanation with a link to [Files](docs://uitleg-bestanden).

While saving, the status bar shows *Saving…* at the bottom right; you can keep working in the meantime. After saving, the *Unsaved* marker disappears: the dot on the tab and the asterisk before the project name at the top. The status bar then shows *Saved* with the time, for example *Saved 14:32*. Anything you changed while saving is not in the file: after that it shows *Unsaved* again.

With the experimental setting *Open and save IFCX* on, *Save* (Ctrl+S) keeps the file type. In Chrome or Edge, Ctrl+S updates an open IFCX schedule if you grant write access. Without a writable file, saving locally downloads a `.ifcx` copy, including when you deny write access. There is no schema prompt.

### Saving under another name

Choose *Home › File › Save As* or *File › Save As*, or press Ctrl+Shift+S. On the desktop, choose a name and location. You can also do this for a plain IFC schedule in Chrome and Edge. After you save to the chosen location, Ctrl+S writes to that file. In Firefox, saving locally downloads a copy each time.

With the experimental setting *Open IFC with a building model* on, if the IFC file contains a building model or data from other programs, using *Save As* locally downloads a copy in the browser. The tab stays linked to the original file if the app was granted access when you opened it.

With the experimental setting *Open and save IFCX* on, you can choose a different file type only in the desktop app's save dialog. On Windows, choose *IFC Files* or *IFCX Files* from the list of file types. The dialog adjusts the default extension to match your choice. On Linux and macOS, end the file name in `.ifc` or `.ifcx` for the type you want. On macOS there is no list of file types. The document keeps its file type in the browser and when saving on the site. When you use *Save As* for a local copy of an IFCX schedule, the browser downloads the copy, including in Chrome and Edge. The tab then has no writable file. The next Ctrl+S downloads another copy.

With the experimental setting *Open and save IFCX* on, converting an IFC file with a building model brings up the *Save as IFCX* dialog. Choose *Save schedule only* to continue working in the new IFCX file. The building model and data from other programs stay in the original IFC file. Choose *Cancel* to stop saving.

With the experimental setting *Open and save IFCX* on, converting a schedule from a XER import brings up the *Save as IFCX* dialog with the message *The P6 source archive is not included in IFCX.* Choose *Continue* to save the schedule without the source archive, or *Cancel* to stop saving.

### Closing a project

Click the cross on the tab, or choose *File › Close project*. If the project has changes that you did not save, the app asks: *Unsaved changes: 'name' has changes that haven't been saved yet.* You choose *Cancel* (the project stays open), *Don't save* (the project closes and your changes are gone) or *Save* (save first, then close). If a save is still running, closing waits for it: the screen shows *Still saving…*, and as soon as the save is done, closing continues. The same applies to quitting the app. Installing an update also waits until the save is done. If you close the whole app on the desktop (with the close button, Alt+F4 or your operating system's menu), it asks this for every project with changes; *Cancel*, or a save that fails, stops the closing. After such a normal close the app cleans up the recovery copies of that session, so the recovery window only appears after a real crash. If a project has changes and you close the browser tab or window, the browser asks for confirmation.

## Pitfalls and what the app does then

**Updating the IFC file you opened.** If the app has write access, *Save* can update the opened file, even if it came from another program. To keep the original, use *Save As* and save a copy.

**If someone else changed the file in the meantime, Save does not write over it.** This applies to local IFC files when the experimental setting *Open IFC with a building model* is on (see [App settings](docs://ref-instellingen)). If a colleague or another program replaces your file while you have it open, *Save* reports: *Not saved. The file was changed by another program in the meantime. Your changes are still in the app. Choose Save As to keep them in a new file.* Your project stays *Not saved*. If you do want to replace the other version on the desktop, choose *Save As* and the same file. For a schedule without a building model or data from another program, the app checks as long as this tab knows the version of its own file: after opening, after saving and after an export over that file. After a recovery from a crash, or if writing to the file itself failed in the desktop app, the tab does not know that version and *Save* simply writes over the file the next time. If the file has disappeared, *Save* in the desktop app simply writes it again. For a plain IFC schedule, this version check is off when *Open IFC with a building model* is off.

With the experimental setting *Open and save IFCX* on, *Save* also checks the known version of the local IFCX file. If someone has changed the file, saving stops. Use *Save As* to keep your changes in a copy.

**Deleting a task or resource that another program linked to.** With the experimental setting *Open IFC with a building model* on, another program may have linked something to a task or resource, such as a wall that belongs to a task. If you delete such a task or resource, the app tells you right away how many of those items will be adjusted or removed if you save the schedule like this. If you do not want that, click *Undo* in that message, or press Ctrl+Z. You can also do that after saving: as long as the file is open, the next save puts the link back, on the task or resource as it is now; once you close the file, it no longer can. The button stays for as long as the message, about 12 seconds; after that, use Ctrl+Z. That also applies when AutoSave has already updated the file: AutoSave waits until you have changed nothing for half a minute, and by then the message is usually gone. If three messages are already open, that message may not appear. If you save without undoing the deletion, only the link goes: the wall and the rest of the building model stay as they were. When you save, the app first asks whether it may and names the number of IFC items outside the schedule that will be adjusted or removed. If you choose *Cancel*, nothing is saved and you can still undo the deletion. If you tick *Don't ask again*, the app saves right away from then on and reports the number afterwards; you turn the question back on under *Settings › Project › App settings*, in the *Notices* group. AutoSave and an export to IFC do not ask: they report the number after saving, in an ordinary message that is gone after a reload or restart.

**Changing an assignment or place that another program recorded together with the building model.** With the same setting on, another program may have linked a crew and a wall to a task in one item, or put a task under its own schedule. If you delete that assignment, or move the task under another task, the app takes only the schedule out of that item when you save, and writes the new situation itself. The wall stays linked to the task. If you create a field of your own with the same name as a field of another program, that program's value is dropped. Whatever is adjusted or removed this way counts in the message after saving.

**Other formats are never overwritten.** A `.csv`, `.xml`, `.mpp` or `.xer` has no file after opening. *Save* writes a new IFC file and leaves the original alone.

**Saving a local file in Firefox.** Each time you press Ctrl+S, the app downloads a copy. It uses the project name to suggest a file name.

**Write permission in Chrome and Edge.** When you press Ctrl+S, the browser may ask for permission to update the local file you opened. If you deny permission for a plain IFC schedule, the app tries to open the save dialog.

**A message about duplicate ids or relations that do not count.** After opening, a message can stay on screen. If it says *Objects with a duplicate id in this file*, each duplicate object got its own id and references point to the first occurrence. Check relations and assignments then. If it says *relation(s) could not be included in the calculation*, the relation sat on a summary task and has no effect, for example a task linked to its own summary. The file itself stays unchanged. See [Adding relations](docs://howto-relaties-leggen) for what a relation on a summary task does.

**Saving can fail.** If saving gives an error, the app reports *Failed to save*, with the reason. If Chrome or Edge offers a save dialog for a plain IFC schedule, the error notification appears before that dialog. If you cancel that window, your project stays open and marked *Unsaved*. If saving to the other file succeeds, that marker disappears and your project uses that file from then on. Changes you made while saving remain marked *Unsaved*. The error notification about the earlier attempt stays until you close it. If the second attempt also fails, the same notification shows the latest reason.

## See also

- [Files and formats](docs://uitleg-bestanden): what the app keeps when you save and how the app treats formats.
- [Turning on AutoSave](docs://howto-automatisch-opslaan): letting the app update your file itself.
- [Choosing the IFC schema](docs://howto-ifc-schema-kiezen): what the question *Which IFC schema to save in?* means.
- [Exporting](docs://howto-exporteren): making a copy in another format.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what you do if the app did not close cleanly.
- [Import and export formats](docs://ref-import-exportformaten): per format what is carried over and what is not.
