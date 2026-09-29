# Installing and managing an extension

Goal: install an extension, read the permission question, and later disable or remove the extension.

## When you need this

An extension adds something to the app without you having to wait for a new version. An extension can, for example, add an import format that appears in *File › Import*, put a button in the ribbon or supply a font for the PDF export. The official catalog divides them into categories: *Import/Export*, *Planning*, *Reporting*, *Utility*, *Fonts* and *Other*.

Think carefully before you install one. An extension is program code that runs with the same rights as the app itself, and the app cannot restrict that. That is why the app asks for permission at every installation. What you see in that question is explained below.

## Steps

### Install an extension from the catalog

1. Choose *File › Extensions*.
2. Choose the tab *Browse*. The app fetches the catalog while it says *Loading catalog...*. What is in the catalog is decided by the OpenAEC Foundation that maintains it, and that can change.
3. Search for an extension with the field *Search extensions...*. It searches in name, description, author and tags.
4. Each card shows name, version, category, description and author. Click *Install*.
5. The window *Install extension?* opens. Read it, see the next step.
6. Click *Install* to continue. With *Don't install* nothing happens. Esc or clicking beside the window also counts as declining, and the app then shows no error message.

After installation the extension is enabled straight away. On the card in *Browse* it now says *Installed*. What the extension adds, you see in the app itself: a new button in the ribbon, or an import format in *File › Import*. Some extensions also show a message. You recognize it by the prefix *Extension* followed by the name of the extension.

### Install an extension from a file

If you received an extension as a file, install it like this.

1. Choose *File › Extensions*.
2. At the top right, click *ZIP* for a ZIP file, or *JS* for a separate JavaScript file.
3. Choose the file. The window *Install extension?* opens, as above.

A ZIP file must contain a `manifest.json` and the main file of the extension. If you install an extension that is already installed, the new version replaces the old one. If the app cannot install the file, for example because a ZIP file is damaged, nothing happens: the app shows no error message for ZIP and JS, and the extension does not appear in the list.

### Read the permission question

The question shows what you need to decide.

- *Author* and *Repository* say who made the extension and where the source code is.
- *Origin* says where the file comes from: *From the online extension catalogue*, *From a ZIP file on this computer* or *From a JavaScript file on this computer*. Below it says whether the file has been checked. For the catalog it says *Download verified against the checksum from the catalogue.* If the catalog has no checksum, it says in red *The catalogue provides no checksum — this download has not been verified.* For a file of your own it says *You picked this file yourself; there is no external source to verify it against.*
- *What you are agreeing to* says: *An extension is program code that runs with the same rights as Open Planner Studio itself. Nothing confines it. Only install extensions whose author you trust.* Below it says what that means on your platform. In the desktop app it says *In the desktop app that includes: reading and writing files anywhere in your user folder, plus access to your projects, settings and clipboard.* In the browser it says *In the browser that means: access to your stored projects and settings, to the files you granted access to, and to the network.*
- *What this extension says it uses* shows the permissions that the author declared, as small labels. That is a declaration by the author and not a restriction: *This is the author's declaration, not a restriction — the code can do more regardless.* If there is no label, it says *Nothing declared.*

The labels mean this:

- *ribbon*: the extension puts buttons in the ribbon.
- *events*: the extension listens along with events in the app.
- *backstage*: the extension adds import formats to *File › Import*.
- *pdf-fonts*: the extension supplies a font for the PDF export.
- *importSource*: the extension may read the complete original bytes of every file you import, for example a raw Primavera file, including fields that do not end up in your project. The window explains this itself too.
- *help*: the extension may add Help articles, open bundled projects as a new document and show a guide that points at parts of the app. The window explains this itself too.
- *filesystem* and *network*: these are only indications of what the author intends. The app has no function for them.

### Disable, re-enable or remove an extension

1. Choose *File › Extensions* and the tab *Installed*. Each extension has a card with name, version, category, description and author.
2. With the switch on the card you disable the extension (*Disable*) or enable it again (*Enable*). When disabled, the buttons and import formats that the extension added disappear, but the extension stays installed. It also stays off after a restart of the app. An enabled extension starts by itself when the app starts.
3. Click *Remove*. The button changes into *Confirm*, with the explanation *Click again to remove permanently*. Click once more to remove the extension. The app also cleans up the settings that the extension stored.

## Pitfalls and what the app does then

**The catalog does not load.** It says *Could not load catalog:* with the technical reason after it, and the button *Retry*. That may be because you have no internet connection.

**It says *Installation failed.* under a card in the catalog.** The download or the installation failed, for example because the checksum did not match. Nothing has been installed then. That is different from declining the question: then there is no error message.

**It says *Skipped catalog entries: 1* above the list.** The catalog contained an item that the app cannot use. You can install the other extensions as usual.

**An extension does not start.** The card then shows an error message, for example *Vereist Open Planner Studio ≥ 2099.1.0 (huidige versie: 2026.9.0)* if the extension asks for a newer app (the app words this message in Dutch in every language), or the error that the extension itself gave. The extension is not active then. Update the app, or remove the extension.

**A card with *Quarantine*.** The app could not use the stored extension. Under the name it says *Reason:* with the cause. With *Remove from storage* you clean it up.

**An extension does not belong to a project.** Extensions are stored in the app on this computer and apply to all your projects. They are not part of your project file.

## See also

- [Updating the app](docs://howto-app-bijwerken): an extension can ask for a newer version of the app.
