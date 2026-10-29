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

**Tutorials.** The tutorials are an extension. If you see the button *Install tutorials* under *Tutorials* in *Help*, it opens *File › Extensions* on *Browse*. The question after the first tour also installs this extension. Both routes show the same permission question; you can decline it.

### Install an extension from a file

If you received an extension as a file, install it like this.

1. Choose *File › Extensions*.
2. At the top right, click *ZIP* for a ZIP file, or *JS* for a separate JavaScript file.
3. Choose the file. The window *Install extension?* opens, as above.

A ZIP file must contain a `manifest.json` and the main file of the extension. If you install an extension that is already installed, the new version replaces the old one.

If the app cannot install the ZIP or JS file, for example because a ZIP file is damaged, it shows the error message *The extension could not be installed. Check the file and try again.* If you cancel the file selection or decline the permission question, no error message appears.

Additional technical details are in the debug terminal. Turn it on with *Settings › Project › App settings*, tab *Advanced*, *Enable debug terminal*, and open it with the button *Show debug terminal* in the status bar. There it says, for example, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (this technical log entry is in Dutch).

### Read the permission question

The question shows what you need to decide.

- *Author* and *Repository* say who made the extension and where the source code is.
- *Origin* says where the file comes from and whether it has been checked. If it says in red that the download has not been verified, only install if you know the source.
- *What you are agreeing to* repeats that an extension is program code that runs with the same rights as the app itself, and what that means on your platform. Only install extensions whose author you trust.
- *What this extension says it uses* shows the permissions that the author declared, as small labels. That is a declaration and not a restriction. If it says *Nothing declared.*, the extension can still read and change the data of your schedule.

What each label means and the exact texts of the window are in [Extension permissions](docs://ref-extensiepermissies).

### Disable, re-enable or remove an extension

1. Choose *File › Extensions* and the tab *Installed*. Each extension has a card with name, version, category, description and author.
2. With the switch on the card you disable the extension (*Disable*) or enable it again (*Enable*). When disabled, the buttons and import formats that the extension added disappear, but the extension stays installed. It also stays off after a restart of the app. An enabled extension starts by itself when the app starts.
3. Click *Remove*. The button changes into *Confirm*, with the explanation *Click again to remove permanently*. Click once more to remove the extension. The app also cleans up the settings that the extension stored.

## Pitfalls and what the app does then

**The catalog does not load.** It says *Could not load catalog:* with the technical reason after it, and the button *Retry*. That may be because you have no internet connection.

**It says *Installation failed.* under a card in the catalog.** The download or the installation failed, for example because the checksum did not match. Nothing has been installed then. That is different from declining the question: then there is no error message.

**It says *Skipped catalog entries: 1* above the list.** The catalog contained an item that the app cannot use. You can install the other extensions as usual.

**An extension does not start.** The card then shows an error message, for example that the extension needs a newer version of Open Planner Studio, with your current version shown, or the error that the extension itself gave. The extension is not active then. Update the app, or remove the extension.

**A card with *Quarantine*.** The app could not use the stored extension. Under the name it says *Reason:* with the cause. With *Remove from storage* you clean it up.

**Writing an extension yourself.** The guide for extension authors (manifest, API, permissions) is in the repository `OpenAEC-Foundation/open-planner-studio` on GitHub, in the file `docs/extensions.md`.

**An extension does not belong to a project.** Extensions are stored in the app: in the desktop app on this computer, in the browser in that browser's storage. They apply to all your projects and are not part of your project file. If you clear the site data in the browser, the extensions are gone.

## See also

- [Updating the app](docs://howto-app-bijwerken): an extension can ask for a newer version of the app.
- [Extension permissions](docs://ref-extensiepermissies): what each permission in the installation question means.
