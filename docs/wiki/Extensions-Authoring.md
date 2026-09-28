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

The optional `apiVersion` field names the extension contract version the extension was built against
(current: `1.4.0`, readable via `require('open-planner-studio').apiVersion`). History: `1.1.0` —
read-only XER source route (`data.getImportSource*`); `1.2.0` — calculation profile
(`ExtProject.schedulingProfile`) + `getImportSourceIssue()`; `1.3.0` — task types (`ExtTask.workRule`,
`ExtProject.defaultWorkRule` and the optional work fields `plannedWorkMinutes`/`actualWorkMinutes`/
`remainingWorkMinutes` on an assignment); `1.4.0` — Help & guidance: the `help` permission and
`api.help.*` (register Help articles, open a bundled project file, guide panel) plus the generic
ribbon anchors.

### Permissions

| Permission | Enforcement | Meaning |
|---|---|---|
| `events` | **hard** — missing ⇒ `api.events.*` throws | Subscribe to / emit on the event bus. |
| `ribbon` | **hard** — missing ⇒ `api.ui.addRibbonButton` throws | Add a button to the ribbon. |
| `backstage` | **warn** — missing ⇒ `api.importers.*` still works, but logs a warning | Register an importer (appears under File → Import). |
| `pdf-fonts` | **hard** — missing ⇒ `api.pdfFonts.register` throws | Register a font provider for the vector PDF export (e.g. CJK glyph bytes). |
| `importSource` | **hard, default-deny** — missing ⇒ `api.data.getImportSourceInfo`/`getImportSourceIssue`/`getImportSourceChunk`/`getImportSourceCatalogPage` throw before a single byte is read | Read the **full original source bytes** of an imported file (today: XER), including fields the import layer deliberately never materializes into the project model. See the section below. |
| `help` | **hard** — missing ⇒ every `api.help.*` method throws (synchronously, `openBundledProject` too) | Register Help articles (tutorials), open a bundled project file as a new document and drive the guide panel. Since contract `1.4.0`; see *Help & guidance* below. |
| `filesystem` | informational | No API surface; a declared intent shown at install time — **no** sandbox guarantee. |
| `network` | informational | Likewise — declared intent, not a technical boundary. |

`data.*` is otherwise **core API** — except for the four `getImportSource*` methods above — same
as `settings.*`, `assets.*` and `ui.showNotification`: always available, no permission required.
Enforcement is centralized in `src/extensions/permissions.ts`. `minAppVersion` is also enforced: on
an older app the extension refuses to activate. A fresh install whose manifest lists an unknown
permission is rejected; only already-stored legacy installs have unknown permissions filtered out
with a warning.

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
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `getImportSourceInfo/getImportSourceIssue/getImportSourceChunk/getImportSourceCatalogPage` (permission `importSource`, see below), `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()`, `batch(fn)` |
| `api.events` | `on/off/emit` (permission `events`) |
| `api.ui` | `addRibbonButton(reg)` (permission `ribbon`), `showNotification(msg, type?)` |
| `api.settings` | `get(key, default)`, `set(key, value)` — prefixed per extension in localStorage |
| `api.assets` | `get(name)` — raw bytes of a bundled (non-`main`/`manifest`) ZIP file, or `undefined` |
| `api.pdfFonts` | `register(provider)` (permission `pdf-fonts`) — a font provider for the vector PDF export |
| `api.help` | `registerArticles(articles)`, `unregisterArticles()`, `openBundledProject(assetName)`, `startGuide(guide)`, `stopGuide()` (permission `help`, since `1.4.0`) — all cleaned up automatically on disable/remove |

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

### Help & guidance (permission `help`, since 1.4.0)

This is how an extension ships **tutorials**: articles that appear in Help under *Tutorials*, with
screenshots and project files from its own assets, and a **guide panel** in which the user works
through the tutorial step by step inside the app. Declare `"permissions": ["help"]` and
`"apiVersion": "1.4"`. The shapes live in `src/extensions/types.ts` (`ExtHelpArticle`, `ExtGuide`,
`ExtGuideStep`).

```ts
api.help.registerArticles(articles: ExtHelpArticle[]): void;   // throws on invalid input
api.help.unregisterArticles(): void;
api.help.openBundledProject(assetName: string): Promise<void>;
api.help.startGuide(guide: ExtGuide): void;                     // throws on invalid input
api.help.stopGuide(): void;

interface ExtHelpArticle { id: string; kind: 'tutorial'; order: number;
  title: { nl: string; en: string }; body: { nl: string; en: string } }
interface ExtGuide { id: string; title: { nl: string; en: string }; steps: ExtGuideStep[] }
interface ExtGuideStep {
  id: string;
  body: { nl: string; en: string };            // the task, then a '---' line, then the explanation
  anchor?: string;                             // data-tour-anchor, see below
  check?: (api) => boolean | Promise<boolean>; // is the step done?
  prepare?: (api) => void | Promise<void>;     // "Show me"
  resetAsset?: string;                         // "Start over": .ifc with the step's starting point
}
```

**Articles.** `registerArticles` is a thin layer over the Help registry, with the extension id as the
source. Rules: `id` in lowercase letters, digits and dashes, unique across all sources; `kind` is
`'tutorial'`; `order` is a positive integer (the learning path); title and body in both `nl` and `en`,
non-empty. Invalid input registers **nothing** and throws with every problem in one message; calling
again replaces the previous set. The text uses the same Markdown subset as the built-in guides, plus:

- `![alt](img/{lang}/step-1.webp)` — the image comes from your **own assets** (the ZIP path), with
  `{lang}` replaced by `nl` or `en`, served as a blob URL that is revoked on disable. A missing asset
  shows the alt text in a placeholder.
- `[Open the starting project](project://start.ifc)` — opens that bundled `.ifc` as a new document. If
  that fails, the app reports that the extension's project file could not be opened; a double click
  opens one document.

**Bundled project.** `openBundledProject('start.ifc')` opens an `.ifc` from your assets as a **new
document**, exactly like an example from File → Examples: no save target or file handle, and the
active document is never overwritten — only an empty, unchanged tab is reused. The promise rejects
when the asset is missing, is not an `.ifc`, or cannot be read.

**Guide.** `startGuide` validates the whole guide first and starts nothing on any error. At most one
guide runs at a time. A new `startGuide` from your own extension replaces your previous guide; while a
guide of **another** extension runs, `startGuide` throws and that guide stays — only the user (Close)
or its owner (`stopGuide`) makes room. The panel is drawn by the **app** (theme, text
roles, RTL, translated buttons): title, "Step n of N", the task, and — once the step is done — the
explanation after `---`. Buttons: **Back**, **Show me** (with `prepare`), **Start over** (with
`resetAsset`), **Next** / **Finish** on the last step, and Close.

- The host calls `check(api)` when the step opens and then, batched (at most once per 150 ms), after
  every change in the app. Only `true` counts; the step then stays done until it starts again.
  A late async result from an earlier pass through the step is ignored — also for the same step after
  Start over or Back→Next. While Show me, Start over or a `project://` link is running, the buttons
  are disabled.
- **Without `check`** the panel shows the explanation straight away and a **Done, next** button.
- **Errors** in `check`/`prepare` are caught and reported through the app's notification channel; a
  throwing `check` is not called again and the step falls back to **Done, next**.
- `stopGuide()` only closes a guide of your own extension. Disabling or removing the extension closes
  the panel and removes the articles from Help; after that every `api.help.*` method throws
  (`openBundledProject` rejects), so a leftover timer cannot put anything back.

The panel floats bottom-right (bottom-left in `ar`/`fa`) above the status bar rather than in the right
rail, which does not exist in the full views (Table, IFC, Report, Resources) or in Backstage. If the
highlighted element lies under the panel and the other side is free, the panel moves there.

**Anchors.** `anchor` is the value of a `data-tour-anchor` attribute; the app outlines that element in
the tour style, but **non-modally** — the user can click it. Available anchors:

- `ribbon-tab:<tab>` — every ribbon tab, including `ribbon-tab:file`;
- `ribbon-group:<tab>:<groupId>` — every ribbon group;
- `ribbon:<tab>:<itemId>` — every ribbon button and widget, with the ids from
  `src/components/layout/Ribbon/ribbonConfig.tsx` (e.g. `ribbon:start:addTask`,
  `ribbon:planning:calendar`). When the button is on another tab, the app outlines
  `ribbon-tab:<tab>` instead. Buttons added by extensions have no anchor (yet);
- fixed anchors for the main panels: `ribbon-tabs`, `gantt-panel`, `properties-panel`,
  `rail:properties`, `rail:resources`, `rail:warnings`, `histogram-strip`, `report-panel`,
  `status-bar`, `backstage-examples`, `feedback-button`.

See `docs/extensions.md` in the repository for a complete example.

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
- **`getImportSourceIssue()`** (since contract version `1.2.0`) → `null`, unless the document **had**
  an XER source archive that turned out unusable when the file was opened and was left out (a
  corrupt archive, or one rewritten by other IFC software, no longer blocks the project from
  opening). Then `{ code }` with `code` ∈ `schema-version` | `hash-mismatch` | `truncated` |
  `bytes-missing` | `metadata-invalid` | `structure`. This tells "never an XER source" apart from
  "source lost on open"; `getImportSourceInfo()` is `null` in both cases.
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
  `pdf-fonts`/`importSource`/`help`, in warn mode for `backstage`, and are purely informational for
  `filesystem`/`network`. Only install extensions you trust.
- Objects from `api.data.get*()` are fresh, mutable `Ext*` copies — mutating them does not touch the
  store; write back via the mutating API functions.
- The `@manifest` comment block in a standalone `.js` file must be a flat JSON object (no nested objects).
