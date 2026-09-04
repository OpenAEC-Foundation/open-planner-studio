# Recovering after a crash

The desktop app automatically keeps recovery snapshots of your work. If the app closes unexpectedly (crash, power failure), it offers to bring that work back on the next launch.

## Crash recovery and AutoSave

- About every ten seconds, the app writes a recovery snapshot for every changed open document — including documents that have never been saved. This crash recovery is always active in both the desktop app and the browser version.
- Crash recovery is not a replacement for saving: it does not change the project file itself.
- At the top, next to **Save**, the **AutoSave** switch is available. Deliberately turn it on for an existing IFC file to write changed content back to that file at the same safe interval.
- A new or unsaved project has no file that can safely be overwritten. The switch is disabled with an explanation. Use **Save** or **Save As** first; AutoSave can then be enabled.
- Turning the switch off stops only overwriting the project file. Crash recovery keeps creating snapshots.
- In a browser, the existing file must already have write permission. Grant that deliberately through a regular manual save; AutoSave never requests permission on its own.
- The snapshots are cleaned up as soon as you make a choice in the recovery window (**Restore** or **Don't restore**).

## The "Restore unsaved work" window

Appears at startup when snapshots are found: "Open Planner Studio did not close normally. The following documents had unsaved changes that can be restored:" For each document it shows:

- the **name** (file name or project name; unnamed: "Untitled project");
- the **file path**, if the document was ever saved;
- the **task count** in the snapshot;
- **Saved** — the time of the latest snapshot.

## The choices

- **Restore** (or **Enter**) — all listed documents come back as open tabs. They then count as unsaved: save them yourself. AutoSave deliberately starts off after recovery until you choose it again.
- **Don't restore** — the snapshots are discarded; you start with an empty project.
- **Close cross**, **Esc** or a click outside the window — safely postpone: nothing is discarded and nothing is restored; the question reappears on the next launch.

## Further reading

- [Quick start](docs://quick-start) — saving and opening projects.
