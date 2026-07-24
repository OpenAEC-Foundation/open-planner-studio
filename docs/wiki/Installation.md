# Installation & downloads

Open Planner Studio runs on Windows, macOS and Linux as a desktop application, and directly in your
browser — no installation required.

## Browser version

Open **<https://open-planner-studio.open-aec.com>** in any modern browser. The web version is a full
build: it opens and saves IFC files (via the File System Access API on Chromium-based browsers, with a
download fallback elsewhere) and keeps an auto-save recovery copy. The only desktop-only feature is the
in-app updater.

## Desktop downloads

Download the latest installer for your platform from the
**[Releases page](https://github.com/OpenAEC-Foundation/open-planner-studio/releases)**:

- **Windows** — the signed `.exe` installer.
- **macOS** — the universal `.dmg` (Apple Silicon and Intel).
- **Linux** — an AppImage or `.deb` package, or install from the Snap Store.

## Automatic updates

The desktop app checks for updates on startup and can install them in place. Snap and AppImage installs
manage their own updates, so the in-app updater steps aside for those.

## Build from source

Prefer to build it yourself? See **[Contributing](Contributing)** for prerequisites and commands.
