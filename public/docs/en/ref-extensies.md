# Managing and installing extensions

Extensions add features to the app, such as extra import formats or custom ribbon buttons. They are app-level: they belong to this installation on this device, not to a project file.

## Opening

**File** → **Extensions** (Backstage). At the top sit two tabs — **Installed** and **Browse** — next to the **ZIP** and **JS** buttons, with a search field below (**Search extensions...**).

## Installed

One card per extension with name, version, category, description and author, plus:

- **On/off toggle** — enables or disables the extension without removing it.
- **Remove** — click **Confirm** once more to remove permanently.

An extension that failed to load shows an error message on its card. Without extensions the tab reports: "No extensions installed yet."

## Browse (catalog)

The **Browse** tab fetches the online extension catalog (internet connection required). Each catalog entry is a card with **Install**; already-installed extensions show the **Installed** badge. If loading fails, an error message appears with **Retry**.

## Installing from a file

- **ZIP** — installs an extension ZIP (with `manifest.json` + `main.js`).
- **JS** — installs a single `.js` file with an embedded manifest.

After installation the extension is enabled immediately and any ribbon buttons appear right away.

## Importing through extensions

**File** → **Import** lists the import formats offered by installed extensions; click a format and pick a file. Without import extensions the page reports: "No import extensions installed. Add one via Extensions." The built-in import formats (CSV, MS Project, P6) are separate from this — see [Import/export](docs://gids-import-export).

## Writing your own extensions

The guide for extension authors (manifest, API, permissions) lives in the repository: `github.com/OpenAEC-Foundation/open-planner-studio`, file `docs/extensions.md`.
