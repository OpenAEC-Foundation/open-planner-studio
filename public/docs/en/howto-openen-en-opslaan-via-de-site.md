# Opening and saving through the site

Goal: open and save a schedule on the site where you use the planner, instead of on your own computer.

## When you need this

You use the planner inside the OpenAEC environment, on a site where you are already signed in. Your schedules are then stored on that site, with their versions. You do not see this in the desktop app or on the public website; there, opening and saving work as described in [Opening and saving a file](docs://howto-bestand-openen-en-opslaan).

## Steps

1. Choose *Home › File › Open* (Ctrl+O). The *Open from the site* window shows the schedules on the site.
2. Click a schedule. The latest version opens, and the schedule then appears in the recent files with the label *On the site*.
3. Work on the schedule and press Ctrl+S. The app stores a new version on the site, without a window.
4. To save a new project, press Ctrl+S or choose *Save As*. The *Save to the site* window asks for a name. Click *Save to site*. From then on, Ctrl+S stores a new version there.
5. To use a file from your own computer, click *From this computer…* in the open window, or *On this computer…* in the save window.

## Pitfalls and what the app does

**An older version opens as a copy.** Click *Show versions* next to a schedule, then *Open as copy* next to an older version. That copy has no place on the site. Saving it creates a new file, and the latest version stays as it was.

**Someone else saved in the meantime.** The app then does not save and reports: *Not saved: '…' was changed on the site by someone else in the meantime.* Your changes are still in the app. Choose *Save As* to keep them as a new file.

In the OpenAEC SuperCloud this works differently: there the site puts your work in a copy next to the file. The app reports the name of that copy. From then on, Ctrl+S saves to that copy. Your colleague's file stays as it was.

**The file is read-only.** Sometimes you may not change a file on the site, for example because someone else is editing it. The app still opens it and reports that it is read-only. You can view and edit it. Saving creates a new file: the app asks for a name first.

**The site cannot be reached.** You then see *Failed to save* with the reason from the site. Your changes stay in the app, and crash recovery keeps them too.

**A file in Recent is no longer on the site.** The app then reports *'…' is no longer on the site* and removes it from the recent files. With any other error, the file stays in the list.

**Exporting always goes to your own computer.** An export (CSV, Excel, MS Project, P6, PDF) arrives as a download or through the file picker, not on the site.

## See also

- [Opening and saving a file](docs://howto-bestand-openen-en-opslaan): opening and saving on your own computer.
- [Turning on AutoSave](docs://howto-automatisch-opslaan): off for a schedule on the site, where every save creates a new version.
- [Recovering after a crash](docs://howto-herstellen-na-een-crash): after recovery, Ctrl+S saves to the same place on the site again.
