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

## What the app does

The switch belongs to one project. Every tab has its own state. After opening a project it is always off, and the app does not remember it for a next time.

AutoSave only writes to the file the project already has. If you choose *Save As*, it writes to the new file from then on. The app only writes if there are changes.

If the writing itself fails, for example because the file has disappeared or is locked, the message *Auto-save failed* appears with the reason. In the browser that is often the text *Het bestaande projectbestand is niet schrijfbaar.* (this reason appears in Dutch: the existing project file is not writable). If the browser does not (or no longer) have permission to write, the app skips that round silently: it does not ask for it.

## Pitfalls and what the app does then

**The file also gets changes you would rather not keep.** AutoSave writes the state of your project as it is at that moment. If you undo something with Ctrl+Z, the file gets that undone state within ten seconds too. If you want to keep an older version, first make a copy with *Save As*.

**A crash still costs the last seconds.** The app writes at most once every ten seconds, so what you did in between is not in your file yet. Crash recovery has the same limit.

**After a recovery in the browser the switch is grey again.** A project that you get back in the browser after a crash is no longer linked to its file. Save it once, and the switch works again. See [Recovering after a crash](docs://howto-herstellen-na-een-crash).

**A project from another format has no file.** A CSV, XML, `.mpp` or `.xer` file only gets an IFC file when you save. After that you can turn on AutoSave.

## See also

- [Files and formats](docs://uitleg-bestanden): the difference between saving, AutoSave and crash recovery.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): save, save as and the *Unsaved* marker.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): what the app offers if it did not close cleanly.
