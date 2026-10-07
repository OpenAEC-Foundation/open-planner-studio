# Recovering after a crash

Goal: get your work back after the app or your browser stopped unexpectedly and you had not saved.

## When you need this

The laptop died, the app froze or the browser tab crashed, and you had not yet saved the last changes. As soon as there is a change anywhere, the app keeps recovery copies of all your open projects in the background, at most once every ten seconds. That copy is separate from your project file. What the difference is with saving and AutoSave, you read in [Files and formats](docs://uitleg-bestanden).

## Steps

1. Start the app again. In the browser you reload the same tab: the recovery copy belongs to that one tab.
2. If the app found copies, the window *Restore unsaved work* appears: *Open Planner Studio did not close normally. The following documents had unsaved changes that can be restored:* For each project it shows the name, the path of the file if the project has a file (in the browser only the file name), the number of tasks and the time of the copy, for example *21 tasks* and *Saved: Sep 29, 2026, 9:41 AM*. The window can also show projects that you had not changed.
3. Choose *Restore*. The app opens all projects in the list, each in a tab, with the state of the last copy. Enter does the same.
4. Check your projects and save them straight away with Ctrl+S.

If you do not want to restore, you have two options. *Don't restore* deletes the copies, and you cannot undo that. If you close the window with Escape, with the cross or by clicking next to it, the copies stay and the app asks again at the next start.

The question mark at the top right of the window opens this article without making a choice. While you read in Help, the window waits. When you go back, it is there again and you can still restore.

## Pitfalls and what the app does then

**You get the state of the last copy.** What you did in the last seconds before the crash may be missing. A project that had changes is marked *Unsaved* again. The *Undo* history is empty: you cannot undo steps from before the crash. Zoom, scroll position and selection are rebuilt.

**On the desktop a recovered project keeps its file, in the browser it does not.** On the desktop *Save* writes to the original file, with the recovered state. In the browser a recovered project is no longer linked to its file: *Save* asks where the file should go. The *AutoSave* switch is also grey then until you have saved the project once.

**A project in the view *Dates as recorded* stays in that view.** See [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

**On the desktop the window does not appear after every start.** The recovery copies are in the app's data folder, as IFC files with a name that starts with *recovery*. If you close the app in the normal way, it clears its own copies. So the window appears after an unexpected end, after a restart for an app update, or if you postponed the recovery at a previous start.

**In the browser the copy is kept per tab.** The copy is in the browser's storage. A new tab or window does not offer the copies of another tab. Copies of tabs that no longer exist are cleared after seven days, as soon as the app writes copies again.

**In the browser the window also appears after an ordinary reload.** That happens even if you had saved everything. If you saved just before reloading and changed nothing after that, you can safely choose *Don't restore*: your file is up to date.

**The window does not appear.** Then the app found no copy. That happens if you had not changed anything yet, if you use a new tab in the browser, if you threw the recovery away earlier with *Don't restore*, or if the crash came before the app kept the first copy: that can take up to about ten seconds after your first change.

**A copy is damaged.** The app reports *Recovered file could not be read*, with the reason, and offers the other projects. If you choose *Restore*, the app afterwards deletes all copies, including the unreadable one. If no copy at all is readable, the window does not appear and the copies are kept.

**Restoring fails.** The app reports *Restore failed* with the reason. The copies stay and the question comes back at the next start.

**Some of the projects cannot be loaded.** The app reports: *2 recovery files could not be loaded and were skipped.* For one file it says *1 recovery file could not be loaded and was skipped.* The other projects are restored. Because something was skipped, all copies stay and the window comes back at the next start with the same list. Then choose *Don't restore* if you have already got back everything that could be.

## See also

- [Files and formats](docs://uitleg-bestanden): saving, AutoSave and crash recovery side by side.
- [Turning on AutoSave](docs://howto-automatisch-opslaan): letting the app update your file itself.
- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): saving after recovering.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): what happens to a project in that view.
