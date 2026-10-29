# Installation & downloads

Open Planner Studio runs on Windows, macOS and Linux as a desktop application, and directly in your
browser — no installation required.

## Browser version

Open **<https://open-planner-studio.open-aec.com>** in any modern browser. The web version is a full
build: it opens and saves IFC files (via the File System Access API on Chromium-based browsers, with a
download fallback elsewhere) and keeps an auto-save recovery copy. The in-app updater and the optional
AI-assistant bridge are desktop-only.

## Desktop downloads

Download the latest installer for your platform from the
**[Releases page](https://github.com/OpenAEC-Foundation/open-planner-studio/releases)**:

- **Windows** — the signed `.exe` installer.
- **macOS** — the universal `.dmg` (Apple Silicon and Intel).
- **Linux** — an AppImage, a `.deb`, an `.rpm`, or a `.snap` package. Arch Linux users can use the
  `open-planner-studio-bin` AUR package. AppImage launches add a menu entry and icon for your user.

For Claude Desktop, install the release's `.mcpb` extension and choose a working folder. It works with
the running app and without it. See [Connecting an MCP client](docs://howto-ai-assistent-koppelen).

## Automatic updates

The desktop app checks for updates on startup and can install them in place. Snap and AUR
installations use snapd and pacman respectively; the in-app updater steps aside for both. AppImage
and `.deb` installations use the in-app updater.

## Build from source

Prefer to build it yourself? See **[Contributing](Contributing)** for prerequisites and commands.
