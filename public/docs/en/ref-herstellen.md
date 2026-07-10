# Recovering after a crash

The desktop app automatically keeps recovery snapshots of your work. If the app closes unexpectedly (crash, power failure), it offers to bring that work back on the next launch.

## How the auto-save works

- Shortly after every change (under a second) the app writes a snapshot per open document to its own data folder — for all open tabs, including documents that have never been saved.
- This is not a replacement for saving: your project file itself does not change. So keep saving your work with Ctrl+S.
- The snapshots are cleaned up as soon as you make a choice in the recovery window (**Restore** or **Don't restore**).
- **Desktop app only.** The browser version has no auto-save and no recovery — save regularly there yourself.

## The "Restore unsaved work" window

Appears at startup when snapshots are found: "Open Planner Studio did not close normally. The following documents had unsaved changes that can be restored:" For each document it shows:

- the **name** (file name or project name; unnamed: "Untitled project");
- the **file path**, if the document was ever saved;
- the **task count** in the snapshot;
- **Saved** — the time of the latest snapshot.

## The choices

- **Restore** (or **Enter**) — all listed documents come back as open tabs. They then count as unsaved: save them yourself.
- **Don't restore** — the snapshots are discarded; you start with an empty project.
- **Close cross**, **Esc** or a click outside the window — safely postpone: nothing is discarded and nothing is restored; the question reappears on the next launch.

## Further reading

- [Quick start](docs://quick-start) — saving and opening projects.
