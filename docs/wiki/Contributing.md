# Contributing & building from source

Open Planner Studio is open source under the LGPL-3.0 license and part of the
[OpenAEC-Foundation](https://github.com/OpenAEC-Foundation) family of desktop apps. Contributions are
welcome.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript |
| Rendering | HTML5 Canvas 2D |
| State | Zustand + Immer |
| Styling | TailwindCSS 4 + component CSS |
| i18n | react-i18next (14 languages) |
| Build | Vite 7 |

The Rust shell is deliberately thin: all IFC parsing and serialization, scheduling and rendering live
in TypeScript. IFC 4.3 is the native file format — loading a project parses IFC, saving serializes the
whole app state back to IFC.

## Prerequisites

- **Node.js** (with npm)
- **Rust** plus the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your OS — only
  needed for the desktop build; the browser build needs Node alone.

## Getting started

```bash
# Install dependencies
npm install

# Start the browser dev server (http://localhost:3007)
npm run dev

# Build the production web bundle
npm run build

# Run the desktop app
npm run tauri:dev

# Build desktop installers
npm run tauri:build
```

## Tests

`tsc` (run via `npm run build`) is the main static check — TypeScript is in strict mode. The
behavioural suite covers CPM and calendar scheduling:

```bash
bash tests/planning/run.sh
```

Run it after changing scheduling code.

## Project layout

See the repository's `README.md` and `CLAUDE.md` for a tour of the source tree — the main areas are
`src/components` (React shell), `src/engine` (Canvas renderer and CPM scheduler), `src/services`
(IFC, import/export, print, updater), `src/state` (Zustand store) and `src/i18n` (14 languages).

## Extensions

To extend the app without modifying the core, write an extension — see
[Extensions Authoring](Extensions-Authoring).

## License

By contributing you agree that your contributions are licensed under the project's LGPL-3.0 license.
