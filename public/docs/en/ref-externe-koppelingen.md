# External links

The **External (cross-project) link** window records a dependency between a task in this project and a task in a different project file — for example a site-works project that must finish before your start.

## Opening

**Relations** tab → **External link…** button. Exactly one task must be selected; otherwise "Select a single task to add an external link." appears.

## The frozen anchor

An external link does not calculate live against the source project. When you add it, the relevant date of the source task (start or finish, depending on direction and relation type) is stored as a fixed **anchor date**; the calculation uses that date as a bound. If the source project changes afterwards, nothing shifts along until you **refresh** the link.

## Two routes

- **Source file** — pick a file under **Choose a recent file**; it is read in read-only ("The source file is read only — it is not opened as a document."). Then pick the **Source task** from the list; the anchor date is read from that task automatically and shown at the bottom. This route requires the desktop app and at least one recent file.
- **Manual (fallback)** — no file at hand (or the browser version): paste the external task's **Project id** and **Task id**, optionally a **Task name**, and enter the **Anchor date** yourself. A manual link is marked "outdated" until a refresh actually finds the source.

## Shared fields

- **Direction** — **Predecessor (external → me)**: the external task drives my task; or **Successor (me → external)**: my task drives the external one.
- **Relationship type** — FS, SS, FF or SF.
- **Lag (work days)** — waiting time (or negative: overlap) on top of the anchor.

**Add link** saves the link (disabled until the required fields are filled in); **Cancel** closes without adding.

## Management, refreshing and missing sources

Existing links are shown as tokens in the task grid's **Predecessors** and **Successors** columns:

- Per link: the source task, the type, the anchor, and an **outdated** badge once the source could not be loaded (anymore) — with the explanation "source not loaded — re-import to refresh".
- Right-click a token for **Edit external relation**, **Refresh source**, or **Delete relation**.
- **Relation → Refresh all external relations** in the ribbon re-reads all available source files and updates their anchors.
- Refreshing reads files and therefore only works in the desktop app; the browser version reports "Reading source files is desktop-only; use the manual fallback."

## Further reading

- [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) — how external links feed into the critical path.
