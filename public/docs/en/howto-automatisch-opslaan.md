# Turning on AutoSave

Goal: have the app update your project file while you work, so you do not have to keep pressing Ctrl+S.

## When you need this

You work a long session on one schedule, or you keep forgetting to save, and you want the file on disk or in a shared folder to keep up. AutoSave does not replace crash recovery: that is always on and works separately from this. What the difference is, you read in [Files and formats](docs://uitleg-bestanden).

## Steps

1. If the project has no file yet, first save it once with *Home › File › Save As*. As long as there is no file, the switch is grey and the tooltip says: *Save this project first to use AutoSave.*
2. At the top left in the bar at the top, click the *AutoSave* switch. When it is on, the tooltip says: *AutoSave is on: changes are written to this file.*
3. Keep working. As soon as your project has changes, the app writes it to your file, without a window and at most once every ten seconds. The *Unsaved* marker then disappears by itself.
4. If you want to stop, click the switch once more. The tooltip then says: *AutoSave is off. Crash recovery remains active.*

Chrome and Edge first let you only read a file that you opened. The switch does nothing there until you have saved once with *Save* (Ctrl+S) and the browser has given permission to write. After that you can turn it on. In Firefox the switch stays grey: the app cannot write into your file there.

## Pitfalls and what the app does then

**The switch belongs to one project.** Every tab has its own state. After opening a project it is always off, and the app does not remember it for a next time.

**AutoSave only writes to the file the project already has.** If you choose *Save As*, it writes to the new file from then on. The app only writes if there are changes.

**The writing can fail.** If the file has disappeared or is locked, for example, the message *Auto-save failed* appears with the reason. If the browser does not (or no longer) have permission to write, the app skips that round silently: it does not ask for it.

**If someone else changed the file in the meantime, AutoSave stops.** This applies when the experimental setting *Open IFC with a building model* is on. Before every round the app checks whether the file is still what it wrote there itself. If it changed, the message *Auto-save has stopped: the file was changed, moved or deleted in the meantime. Your changes are still in the app. Choose Save As to keep them in a new file.* appears once. It starts again when you save with *Save As*.

**The file also gets changes you would rather not keep.** AutoSave writes the state of your project as it is at that moment. If you undo something with Ctrl+Z, the file gets that undone state too: within ten seconds, or for a file with a building model after the rest described below. If you want to keep an older version, first make a copy with *Save As*.

**A crash still costs the last seconds.** The app writes at most once every ten seconds (a file with a building model less often, see below), so what you did in between is not in your file yet. Crash recovery writes at most once every ten seconds, also with a building model.

**A file with a building model has its own rhythm.** This only applies when the experimental setting *Open IFC with a building model* is on (see [App settings](docs://ref-instellingen)). Such a file is large, so the app only writes it after you made no change for 30 seconds, and if you keep working without a pause, at most 5 minutes after your first change. Typing in a table cell also counts as working, even before you press Enter. If saving takes long, the app waits longer afterwards, so that saving takes at most a tenth of the time. If you press Ctrl+S, choose *Save As*, export, or close a tab or the app in the meantime, that goes first: auto-save then stops without writing anything and tries again after the next 30 seconds of rest. If the app was already replacing the file, it finishes that first and your action follows right after. Auto-save of your other open files waits in the meantime and follows right after that save; with a large model that can take up to about 20 seconds. If saving would make an anchor of a dependent project too tight, auto-save skips the file; Ctrl+S then asks you. If another program changed the file in the meantime, or the app cannot replace it safely in that location, one message says that auto-save has stopped; it starts again when you save yourself or choose another file.

**After a recovery in the browser the switch is grey again.** A project that you get back in the browser after a crash is no longer linked to its file. Save it once, and the switch works again. See [Recovering after a crash](docs://howto-herstellen-na-een-crash).

**A project from another format has no file.** A CSV, XML, `.mpp` or `.xer` file only gets an IFC file when you save. After that you can turn on AutoSave.

## See also

- [Files and formats](docs://uitleg-bestanden): the difference between saving, AutoSave and crash recovery.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): save, save as and the *Unsaved* marker.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what the app offers if it did not close cleanly.
