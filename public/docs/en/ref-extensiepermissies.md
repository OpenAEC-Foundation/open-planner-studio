# Extension permissions

Every permission an extension can list in its manifest: what it allows, what happens when it is missing and what you see of it when you install an extension. How you manage and install extensions is under *File › Extensions*; the guide for authors is `docs/extensions.md` in the repository.

## What a permission is and is not

A permission is a **declaration by the author**: which parts of the app interface the extension wants to use. It is not a barrier. The code of an extension runs in the same environment as the app itself and can therefore do more than its permissions say: there is no sandbox. The app says so in the install window too. Only install extensions from authors you trust.

The app enforces a permission in one of three ways, and the difference matters:

**Hard enforced.** If the permission is missing, the corresponding method throws an error (in Dutch, for example *Extensie "…" mist permissie: ribbon*) before anything happens.

**Warning.** If the permission is missing, the method still works, but the app writes a warning to the log. In a future version it becomes a refusal.

**Informative only.** The permission has no part of the interface attached to it. The app shows it at install time and does nothing else with it.

What needs no permission is the basis of the extension interface: reading and changing the project and the schedule (tasks, relations, resources, assignments, calendar, loading a project, recalculating), keeping its own settings, reading its own bundled files and showing a notification.

**The manifest.** The permissions are in the manifest as a list. An extension that you install now, with a permission that this app version does not know, is refused. For an already stored older extension, the app drops unknown permissions and reports it in the log.

## How the app asks

On installing, from the catalogue (*File › Extensions › Browse › Install*) or from a file (*ZIP* or *JS*), the app shows the window *Install extension?*. The question comes once, at install time: not every time you switch the extension on.

The window shows the name, version, description, author and, if there is one, the repository. Under *Origin* it says where the extension comes from (*From the online extension catalogue*, *From a ZIP file on this computer* or *From a JavaScript file on this computer*) and whether the download has been verified: with the checksum from the catalogue, not verified because the catalogue gives none, or a file you picked yourself. Under *What you are agreeing to* it says that an extension is program code that runs with the same rights as the app, and what that means in practice: in the desktop app, among other things reading and writing files anywhere in your user folder, plus access to your projects, settings and clipboard; in the browser access to your stored projects and settings, to the files you granted access to and to the network.

Under *What this extension says it uses* are the permissions from the manifest, as short labels with the name as below. It says: *This is the author's declaration, not a restriction — the code can do more regardless.* If the extension has no permissions, it says *Nothing declared.* Two permissions get an explanation: *importSource* and *help*. The other six only get their label.

With *Install* you agree. *Don't install*, Esc and clicking outside the window refuse the installation.

## The permissions

**ribbon** — place a button in the ribbon. Effect: the extension may add a button to a group on a ribbon tab. An extension without this permission gets an error when it tries. The buttons appear at the end of the chosen tab, under a group label of the extension, and disappear when you switch the extension off or remove it. Enforcement: hard. Where you see it: on the tab the extension chose.

**events** — follow the events of the app and send events itself. Effect: the extension may subscribe to and unsubscribe from events and send events itself. The app itself sends three: a project is loaded (after importing, opening or loading by an extension), an empty project is created and the schedule is (re)calculated. Enforcement: hard. Where you see it: nowhere; the extension reacts to the event.

**backstage** — offer an import format. Effect: the extension may register an importer; it appears in *File › Import*, where you click a format and pick a file. The built-in formats are separate from this (see [Import and export formats](docs://ref-import-exportformaten)). Enforcement: warning. If the permission is missing, registering still works, with a warning in the log. That is a transitional arrangement, because existing extensions do not always list the permission. Where you see it: *File › Import*.

**pdf-fonts** — supply a font for the PDF export. Effect: the extension may register a font provider. The PDF export uses it for characters that the built-in fonts do not cover, such as Chinese, Japanese and Korean characters. Enforcement: hard. Where you see it: in the PDF of a report; in the install window there is only the label.

**importSource** — read the original bytes of an imported file. Effect: the extension may ask for the complete content of the source file of an imported project (for now: a Primavera file), including the fields the app deliberately does not take into your project, such as audit and provenance fields, costs, review and location fields. That is much broader than the rest of the interface and is therefore a separate permission. Without the permission the app reads not a single byte of the source file: every method then throws an error before anything is fetched. Enforcement: hard, denied by default. Where you see it: in the install window an explanation goes with it: *importSource — the complete original source bytes of every imported file (for example a raw Primavera file), including fields that never reach the project.*

**help** — add Help articles and guidance. Effect: the extension may register and withdraw Help articles (tutorials), open a bundled `.ifc` file as a new document and start and stop a guide that points at parts of the app. A bundled project never overwrites the document you are working in: it opens as a new document, or only takes over an empty, unchanged tab. Since contract version 1.4.0. Enforcement: hard. Where you see it: in the *Help* window (the articles), as a new tab (the project) and as a guide that points at buttons. In the install window an explanation goes with it: *help — may add Help articles, open bundled projects as a new document and show a guide that points at parts of the app.*

**filesystem** — the extension says it uses files. Effect: none; no part of the interface is attached to it, and the app cannot enforce it. Enforcement: informative only. Where you see it: as a label in the install window.

**network** — the extension says it uses the network. Effect: none; like *filesystem*. Enforcement: informative only. Where you see it: as a label in the install window.

## See also

- [Import and export formats](docs://ref-import-exportformaten): the formats the app knows itself, next to what extensions add under *File › Import*.
