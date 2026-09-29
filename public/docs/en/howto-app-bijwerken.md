# Updating the app

Goal: know whether you have the latest version, update the app and read what is new in a version.

## When you need this

A new version of Open Planner Studio comes out regularly. You want to know whether you already have it, for example before you report an error or because an extension asks for a newer version. Or you have just updated and want to see what has changed.

Updating only works in the desktop app. The browser version has no updater.

## Steps

### Update when the app itself says there is a new version

1. Start the desktop app. At startup the app checks in the background whether there is a new version. If there is no new version, or the check fails, for example without internet, you notice nothing.
2. If there is a new version, the window *Software update* opens. It shows the *Current version*, the *New version*, the message *A new version is available* and, under *What's new*, the text that goes with the update.
3. Save your open projects.
4. Click *Download & install*. A progress bar shows *Downloading…*, and then the installation follows. You cannot close the window while it is downloading.
5. Wait until the app restarts itself. That is the new version.

Just before the update is installed, the app also takes a recovery snapshot of your open work.

### Check for a new version yourself

1. Choose *Settings › Project › Settings*. You can also choose *File › Settings*, or the gear at the top.
2. Choose the tab *Advanced*. Under *Version* is the number of your current version.
3. Click *Check for updates*. The window *Software update* opens and says *Checking…*. Afterwards it says *You're running the latest version* or the message that there is a new version, with the same button *Download & install*.

In the browser this button does nothing special: the window immediately says *You're running the latest version*, without the app checking anything.

### Read what is new

1. If you start the desktop app for the first time in a different version than last time, or after a fresh installation, a window opens by itself. In English it is called *You're up to date!*
2. At the top is the jump from the previous to the new version. After a fresh installation only the new version is shown.
3. If the app has a summary built in for this version, you see one main point and four smaller points. The main point may have a button *Read the guide*. Otherwise you only see the version jump and what is below.
4. With *See full release notes* you open the changelog on GitHub. If that does not work, it says *The release notes could not be opened.*
5. Under *This update in numbers* are the number of days since the previous release, the number of commits and the number of added lines of code. If the app can look up the difference in size of the installation package, that is shown too. Each figure is only shown if it is available.
6. Click *Got it* to close the window.

If you want to see this window once more later, choose *Settings › Project › Settings*, tab *Advanced*, and under *Version* the button *What's new*. The window then opens for your current version, without a previous version.

## Pitfalls and what the app does then

**The update fails.** The window shows *Something went wrong while updating* with the technical reason below it, and the button *Try again*.

**You installed the app as a .deb package and the installation fails.** The window explains: *Update manually by running this command in a terminal, or download the latest package.* Under *Installation command* is the command, with the button *Copy command* (afterwards it says *Copied*). With *Open downloads page* you go to the download page of the latest version.

**You have the app through the Snap Store.** The app then does not update itself and does not check at startup either. The Snap Store does that. In the window it says *This version is updated automatically via the Snap Store — you don't need to do anything.*

**Nothing shows up at startup.** That is normal if you already have the latest version. The startup check does not report errors. If you want to be sure you are up to date, check yourself, as above.

## See also

- [Giving feedback](docs://howto-feedback-geven): report an error in the latest version.
