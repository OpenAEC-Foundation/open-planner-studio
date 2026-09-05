# Writing extensions for Open Planner Studio

An extension is a ZIP file containing two files — or a single `.js` file with a `@manifest` comment
block. Extensions are entirely frontend; there is no Rust involved.

## manifest.json

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "minAppVersion": "2026.4.0",
  "author": "Your Name",
  "description": "What the extension does.",
  "category": "Import/Export",
  "main": "main.js",
  "permissions": ["ribbon", "events"],
  "icon": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
```

Categories: `Import/Export`, `Planning`, `Reporting`, `Utility`, `Fonts`, `Other`.

### Permissions

| Permission | Enforcement | Meaning |
|---|---|---|
| `events` | **hard** — missing ⇒ `api.events.*` throws | Subscribe to / emit on the event bus. |
| `ribbon` | **hard** — missing ⇒ `api.ui.addRibbonButton` throws | Add a button to the ribbon. |
| `backstage` | **warn** — missing ⇒ `api.importers.*` still works, but logs a warning | Register an importer (appears under File → Import). |
| `pdf-fonts` | **hard** — missing ⇒ `api.pdfFonts.register` throws | Register a font provider for the vector PDF export (e.g. CJK glyph bytes). |
| `importSource` | **hard, default-deny** — missing ⇒ `api.data.getImportSourceInfo`/`getImportSourceChunk`/`getImportSourceCatalogPage` throw before a single byte is read | Read the **full original source bytes** of an imported file (today: XER), including fields the import layer deliberately never materializes into the project model. See the section below. |
| `filesystem` | informational | No API surface; a declared intent shown at install time — **no** sandbox guarantee. |
| `network` | informational | Likewise — declared intent, not a technical boundary. |

`data.*` is otherwise **core API** — except for the three `getImportSource*` methods above — same
as `settings.*`, `assets.*` and `ui.showNotification`: always available, no permission required.
Enforcement is centralized in `src/extensions/permissions.ts`. `minAppVersion` is also enforced: on
an older app the extension refuses to activate. Unknown permissions are filtered out with a warning
in the debug terminal.

## main.js

A CommonJS module that exports `onLoad(api)` (and optionally `onUnload()`):

```js
module.exports = {
  onLoad(api) {
    // Importer: appears under File → Import
    api.importers.register({
      id: 'my-import',
      name: 'My Format',
      description: 'Reads .abc files',
      fileExtensions: ['.abc'],
      handler: async (file) => {
        const text = await file.text();
        // … parse text …
        return { project, calendar, tasks, sequences, resources, assignments };
      },
    });

    // Ribbon button (permission 'ribbon')
    api.ui.addRibbonButton({
      tab: 'start',
      group: 'My Group',
      label: 'Do something',
      onClick: () => api.ui.showNotification('Done!'),
    });
  },
  onUnload() {},
};
```

## API overview

| Area | Functions |
|---|---|
| `api.importers` | `register(def)`, `unregister(id)` |
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `getImportSourceInfo/getImportSourceChunk/getImportSourceCatalogPage` (permission `importSource`, see below), `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()`, `batch(fn)` |
| `api.events` | `on/off/emit` (permission `events`) |
| `api.ui` | `addRibbonButton(reg)` (permission `ribbon`), `showNotification(msg, type?)` |
| `api.settings` | `get(key, default)`, `set(key, value)` — prefixed per extension in localStorage |
| `api.assets` | `get(name)` — raw bytes of a bundled (non-`main`/`manifest`) ZIP file, or `undefined` |
| `api.pdfFonts` | `register(provider)` (permission `pdf-fonts`) — a font provider for the vector PDF export |

Important: after mutating tasks or relations yourself, call `api.data.recalculate()` — the schedule is
not recalculated reactively. `loadProject()` does this automatically.

### Binary assets & font providers

Files you place next to `manifest.json` and `main.js` in the install ZIP are kept as **assets** and can
be fetched by name with `api.assets.get(name)` (raw `Uint8Array`, or `undefined`). This is how you ship
binary data such as font bytes. A `.js`-only extension has no assets. Size limits: ≤ 24 MB per file,
≤ 48 MB combined.

With the `pdf-fonts` permission you register such bytes as a **font provider** for the vector PDF
export. A provider supplies raw glyph TTF bytes plus a codepoint coverage; the export subsets and
embeds it conditionally. The registration is undone automatically on disable.

```js
// manifest.json → "permissions": ["pdf-fonts"], and ship test.ttf in the ZIP.
module.exports = {
  onLoad(api) {
    api.pdfFonts.register({
      id: 'my-font',
      covers: (cp) => cp >= 0x4e00 && cp <= 0x9fff,   // e.g. CJK Unified Ideographs
      getRegularBytes: async () => api.assets.get('test.ttf'),
      // getBoldBytes: async () => api.assets.get('test-bold.ttf'),  // optional
    });
  },
};
```

### Read-only XER source route (permission `importSource`, `apiVersion` ≥ 1.1)

Besides the mapped `data.*` DTOs (derived, normalized, always available), an extension holding the
`importSource` permission can also reach the **original, unmodified source data** of the current
document — today only for an opened `.xer` file (Primavera P6). Without this permission all three
methods throw before a single byte is read; nothing leaks through a partial call or an error path.
These three methods exist since contract version `1.1.0` — declare `"apiVersion": "1.1"` or higher
if you rely on them; an older host simply doesn't have them.

**Why a separate permission instead of core API.** The rest of `api.data.*` exposes the internal
project model — tasks, calendar, relations — exactly what the importer made of it. The source route
returns the **full original bytes and tables**, including columns the import layer deliberately
never materializes into the project model (provenance fields such as `create_user`/`update_date`,
costs, review/location fields, unused UDFs, …). That is a materially larger exposure than "the app
reads this file" — every installed extension would otherwise be able to read and forward the raw
source text of every opened project, even without any other permission. Hence: default-deny,
explicitly declared in `manifest.json`.

```js
// manifest.json → "permissions": ["importSource"]
const info = api.data.getImportSourceInfo();     // null outside an XER document
if (info) {
  console.log(info.sourceFormat, info.archive.byteLength, info.catalogs.taskSourceRows.totalRows);
}
```

- **`getImportSourceInfo()`** → a small summary (source format, archive identity including
  `sha256`/`byteLength`/`chunkCount`, number formatting, diagnostics counts, the import report, the
  schedule-options provenance and catalog counts). No record contents. **`null`** when the active
  document has no retained XER source (any non-XER document).
- **`getImportSourceChunk(index)`** → a fresh copy of one piece of the original file bytes.
  Concatenate all chunks `0..chunkCount - 1` in order to reconstruct the **exact** original bytes —
  compare against the `sha256` from `getImportSourceInfo()` to confirm. An invalid index throws a
  `RangeError`; outside an XER document the method returns `null`.
- **`getImportSourceCatalogPage(collection, options?)`** → paginated, per-record-copied access to
  the retained source tables (task source rows, resource/role/rate/curve/assignment rows, activity
  codes, custom field definitions, UDF values, schedule-options source rows, …). `options.offset`
  (default 0) and `options.limit` (default 100, **maximum 500 per page**) drive pagination; an
  invalid value throws a `RangeError`. An `offset` past the end of the collection does not throw —
  it is canonicalized to `total`, yielding an empty but valid last page.

All three methods are bound to the **active document**: switching documents follows the source
route (or its absence) of the newly active document automatically. Every call returns a fresh,
independent copy — mutating a returned `info`, page item or chunk never touches the retained
archive.

**Document drift while paginating.** "Follows automatically" is convenient for a single call, but a
**risk when paginating**: pagination is inherently multiple calls over time, and there is no
per-document page session. If the user switches documents (`switchDocument`) between two
`getImportSourceCatalogPage` calls, the second call simply returns a page from the **new** active
document — possibly an empty page that a naive extension reads as "done", while it actually just
mixed two projects together. Pass `options.expectedSourceProjectId` with the `sourceProjectId` you
got from an earlier call: if the active source selector no longer matches (including when the
active document no longer has any XER source at all), the call throws an
`ExtImportSourceDriftError` instead of silently continuing. Without this option there is **no**
drift protection. The same risk applies, to a lesser extent, to fetching a sequence of
`getImportSourceChunk` indices to reconstruct the source bytes — compare `sourceProjectId` (or the
`sha256`) between chunks if you cannot guarantee the document won't switch.

### Data contract: the `Ext*` types

Everything crossing the extension boundary via `api.data.*`, importer handlers and `sdk.factory.*` uses
**stable extension types** (`ExtProject`, `ExtCalendar`, `ExtTask`, `ExtTaskTime`, `ExtSequence`,
`ExtResource`, `ExtAssignment`, `ExtImportResult`; defined in `src/extensions/extTypes.ts`). This is the
**public contract**, deliberately decoupled from the internal domain model so an internal refactor does
not break your extension.

- `api.data.getTasks()` (and the other `get*`) return **fresh, mutable copies**: you may mutate the
  returned object freely — it does not touch the store. Write back via `addTask`/`updateTask`/`addSequence`
  and call `recalculate()`.
- An importer handler returns an `ExtImportResult` (build it with `sdk.factory.emptyImportResult()`).

## Host SDK: `require('open-planner-studio')`

Besides the scoped `api` passed to `onLoad(api)`, you can fetch the **host SDK**. It is global and
stateless — version info, constants and pure helpers to build valid domain objects. You never mutate
through the SDK, only through `api.data.*`.

```js
const sdk = require('open-planner-studio');

sdk.version;            // app version, e.g. "2026.6.0"
sdk.categories;         // valid manifest categories
sdk.permissions;        // valid manifest permissions
sdk.hostEvents;         // { projectLoaded, projectNew, scheduleCalculated }

sdk.utils.generateId('seq');                 // id following the app convention
sdk.utils.formatDate(new Date());            // "YYYY-MM-DD"
sdk.utils.parseDate('2026-06-19');           // Date (UTC midnight)
sdk.utils.addBusinessDays(date, 5);          // add work days

sdk.factory.createProject({ name: '…' });    // full Project
sdk.factory.createCalendar();                // default WorkCalendar
sdk.factory.createTask({ name: 'Task' });    // full Task with defaults
sdk.factory.createTaskTime(start, 10);       // TaskTime with a duration in work days
sdk.factory.emptyImportResult();             // { project, calendar, tasks: [], … }
```

## Host events

The app emits lifecycle events on the same bus as `api.events`. Subscribe with `api.events.on(...)`
(permission `events`); the names live in `sdk.hostEvents`:

| Event (`sdk.hostEvents.…`) | Name | Data |
|---|---|---|
| `projectLoaded` | `host:project-loaded` | `{ tasks, sequences, resources }` |
| `projectNew` | `host:project-new` | — |
| `scheduleCalculated` | `host:schedule-calculated` | `{ hasError, error, criticalTasks }` |

```js
api.events.on(sdk.hostEvents.scheduleCalculated, (d) => {
  api.ui.showNotification(`Schedule calculated — critical: ${d.criticalTasks}`);
});
```

## Installing

File → Extensions → **ZIP** or **JS** (a local file), or via the **Browse** tab (catalog:
`OpenAEC-Foundation/open-planner-studio-extensions`).

For a standalone `.js` file the manifest may be a comment block at the top:

```js
/** @manifest { "id": "my-extension", "name": "My Extension", "version": "1.0.0", "minAppVersion": "0.0.0", "author": "Me", "description": "…", "category": "Utility", "main": "main.js", "permissions": [] } */
```

## Limitations

- The sandbox is light: extension code runs via `new Function(...)` and has access to `window`,
  `document` and `fetch`. Permissions are enforced hard (default-deny) for `ribbon`/`events`/
  `pdf-fonts`/`importSource`, in warn mode for `backstage`, and are purely informational for
  `filesystem`/`network`. Only install extensions you trust.
- Objects from `api.data.get*()` are fresh, mutable `Ext*` copies — mutating them does not touch the
  store; write back via the mutating API functions.
- The `@manifest` comment block in a standalone `.js` file must be a flat JSON object (no nested objects).
