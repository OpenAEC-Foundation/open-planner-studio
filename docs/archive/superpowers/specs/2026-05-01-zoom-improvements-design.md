# Zoom improvements — design

Date: 2026-05-01
Status: approved (pending implementation plan)

## Goal

Make timeline zooming feel like CAD: plain mouse wheel zooms toward the cursor, the header gracefully adapts from years down to quarter-hours, the existing glitch when zoomed out is gone, and horizontal scrolling actually works. Behavior is configurable in Settings.

## Scope

In scope:
- Mouse wheel zoom (configurable: zoom on plain wheel, or scroll on plain wheel)
- Zoom-toward-cursor (always on)
- Adaptive timeline header with discrete tiers (year / quarter / month / week / day / hour / quarter-hour)
- Optional quarter-hour tier (Settings toggle, default off)
- Configurable week start (Monday / Sunday)
- Bug fix: header glitches at low zoom levels
- Bug fix: horizontal scroll loses tasks and header doesn't follow
- Keyboard shortcuts: `+`, `-`, `0` (reset), `Ctrl+0` (fit to project)
- Optional smooth zoom animation (Settings toggle, default off)

Out of scope:
- Toolbar zoom buttons / current-zoom label (item a)
- Per-project saved zoom (item d)
- Touchpad pinch-to-zoom (item e)
- Floating zoom indicator (item f)
- Sub-day task scheduling — header may show hours but task durations remain whole-day for now

## Architecture

### New files

- `src/engine/renderer/timelineTiers.ts` — pure data: tier table with `{ tier, minLabelWidth, format(date) }` for `year`, `quarter`, `month`, `week`, `day`, `hour`, `quarterHour`. Plus a `pickTiers(zoom, enableQuarterHour) → { major, minor }` helper. The selection rule (below) decides which tiers are shown at which zoom; `minLabelWidth` is only used at render-time to skip labels that don't fit (defensive — should rarely trigger given pickTiers is conservative).
- `src/hooks/useGanttZoom.ts` — owns the wheel handler and the cursor-anchored zoom math. Reads `settings.mouseWheelMode`, `settings.enableQuarterHourZoom`, `settings.smoothZoom`. Exposes a `zoomAt(targetZoom, anchorX)` function used by both wheel and keyboard.
- `src/hooks/useZoomShortcuts.ts` — keyboard shortcuts (`+`, `-`, `0`, `Ctrl+0` fit-to-project). Calls into `useGanttZoom`.

### Changed files

- `src/engine/renderer/GanttRenderer.ts` — `drawTimelineHeader` rewritten to read from the tier table. Two-row header (major top, minor bottom). Labels are skipped when their pixel width drops below the tier's `minLabelWidth`.
- `src/components/canvas/GanttCanvas.tsx` — wheel effect removed; replaced by `useGanttZoom()` and `useZoomShortcuts()` calls. Horizontal scroll bug investigated and fixed (see "Bug 4b" below).
- `src/state/slices/types.ts` + `src/state/appStore.ts`:
  - Add to `settings`: `mouseWheelMode: 'zoom' | 'scroll'` (default `'zoom'`), `enableQuarterHourZoom: boolean` (default `false`), `weekStartDay: 'monday' | 'sunday'` (default `'monday'`), `smoothZoom: boolean` (default `false`).
  - `setZoom` clamp range becomes dynamic: max = 1000 if `enableQuarterHourZoom` else 400. Min stays at 0.5 (slightly below current 1 so jaar-niveau echt past).
  - When the user toggles `enableQuarterHourZoom` off while `view.zoom > 400`, clamp `view.zoom` to 400.
- `src/components/dialogs/SettingsDialog.tsx` — new section "Tijdlijn / Zoomen" with the four toggles.
- `src/utils/dateUtils.ts` — `getWeekNumber` and `isoDayOfWeek` already produce ISO-week (Monday-based). Add `getWeekNumber(date, startDay)` overload that returns Sunday-based week numbers when configured. Existing callers default to Monday.

## Tier table (concrete values)

```
{ tier: 'year',        minLabelWidth: 60,  format: d => `${year(d)}` }
{ tier: 'quarter',     minLabelWidth: 40,  format: d => `Q${quarter(d)} ${year(d)}` }
{ tier: 'month',       minLabelWidth: 50,  format: d => `${monthName(d)} ${year(d)}` }
{ tier: 'week',        minLabelWidth: 28,  format: d => `W${weekNum(d)}` }
{ tier: 'day',         minLabelWidth: 18,  format: d => `${day(d)}` }
{ tier: 'hour',        minLabelWidth: 28,  format: d => `${hh(d)}:00` }
{ tier: 'quarterHour', minLabelWidth: 28,  format: d => `${hh(d)}:${mm(d)}` }
```

`pickTiers(zoom, enableQH)` returns `{ major, minor }`:
- `zoom < 4`: `{ year, quarter }`
- `4 ≤ zoom < 10`: `{ year, month }`
- `10 ≤ zoom < 25`: `{ month, week }`
- `25 ≤ zoom < 80`: `{ month, day }`
- `80 ≤ zoom < 400` (or zoom ≥ 400 and enableQH off): `{ day, hour }`
- `zoom ≥ 400` and enableQH on: `{ hour, quarterHour }`

## Cursor-anchored zoom

`zoomAt(newZoom, anchorX)`:

1. `dateUnderCursor = view.viewStartDate + (anchorX - taskTableWidth + view.scrollX) / view.zoom` (in fractional days).
2. Clamp `newZoom` to `[0.5, maxZoom]`.
3. Compute new `scrollX` so the same date stays under `anchorX`:
   `newScrollX = dateUnderCursor * newZoom - (anchorX - taskTableWidth)`
4. Apply both in a single store update so React re-renders once.

Wheel-tick zoom factor is 1.1 per tick (`newZoom = view.zoom * (deltaY > 0 ? 1/1.1 : 1.1)`).

For toolbar / keyboard "+" / "-": `anchorX = canvasWidth / 2 + taskTableWidth / 2` (visible area center).

For `Ctrl+0` fit-to-project: compute project span (earliest start → latest finish). If there are no tasks, behave as `0` (reset). Otherwise set `zoom = (canvasWidth - taskTableWidth) / spanInDays` clamped to `[0.5, maxZoom]`, `scrollX = 0`, `viewStartDate = earliestStart`.

For `0` reset: `zoom = 30` (default), `scrollX = 0`.

## Wheel handler behavior

```
mouseWheelMode = 'zoom':
  plain wheel:    zoom (anchored to cursor)
  Shift + wheel:  scroll horizontally
  Ctrl + wheel:   zoom (alias, anchored to cursor)

mouseWheelMode = 'scroll':
  plain wheel:    scroll vertically (deltaY) and horizontally (deltaX)
  Shift + wheel:  scroll horizontally (deltaY mapped to X)
  Ctrl + wheel:   zoom (anchored to cursor)
```

Zoom-toward-cursor is always on regardless of mode.

## Smooth zoom animation

When `settings.smoothZoom` is on: `zoomAt` interpolates `view.zoom` and `view.scrollX` over 180 ms with `ease-out-cubic`, using `requestAnimationFrame`. Multiple wheel-ticks while an animation is mid-flight cancel the previous animation and restart from the current interpolated values (no queueing).

When off: instant update (current behavior).

## Settings dialog

New section "Tijdlijn / Zoomen" with:

- Radio: **Muiswiel-gedrag** — Zoomen (default) / Scrollen
- Toggle: **Kwartieren tonen bij ver inzoomen** (default off)
- Radio: **Week begint op** — Maandag (default) / Zondag
- Toggle: **Vloeiende zoom-animatie** (default off)

## Keyboard shortcuts

Registered in `useZoomShortcuts` (active when canvas has focus or no input is focused):

- `+` / `=`: zoom in one step (factor 1.1, anchor = canvas center)
- `-`: zoom out one step (factor 1/1.1)
- `0`: reset zoom to 30 px/day, scrollX to 0
- `Ctrl+0`: fit to project (see above)

## Bug fixes

### Bug 4 — header glitch at low zoom

Root cause: at very low zoom the existing renderer draws a label every time `month !== lastMonth`, but consecutive months are < 30 px apart, so labels overlap and become unreadable.

Fix: handled by the tier system. Each tier has a `minLabelWidth`; `pickTiers` ensures the active tier always has enough room. When labels would still collide (e.g. very narrow window), the renderer skips a label if the previous label's right edge has not passed yet.

### Bug 4b — horizontal scroll breaks tasks/header

Investigation needed during implementation. Suspected cause: `totalContentWidth` (in `GanttCanvas.tsx`) recomputes on zoom but the hidden scroll-bar's `scrollLeft` is not re-clamped, so `view.scrollX` in the store stays stale relative to what the canvas paints. The renderer reads `scrollX` from the store, not from the scroll-bar element — but the scroll-bar's `onScroll` may not fire after a zoom change.

Fix plan:
1. Make the scroll-bar element the single source of truth for `scrollX`. After any zoom change, programmatically set `hScrollRef.current.scrollLeft = view.scrollX` and rely on `onScroll` to keep the store in sync.
2. Header rendering in `GanttRenderer.drawTimelineHeader` already uses `view.scrollX`; verify it isn't reading a stale closure value via the renderer instance.
3. Add a regression check: scroll horizontally to day 200, zoom in twice, scroll back — task bars and header should always stay aligned.

If investigation reveals a different cause, document the actual fix in the implementation plan.

## Testing

Manual verification (no automated tests for canvas rendering exist):

1. Plain wheel zooms toward cursor at every zoom level.
2. Switching `mouseWheelMode` to "Scrollen" makes plain wheel scroll, Ctrl+wheel zoom.
3. Header transitions smoothly at zoom thresholds 1.5, 4, 10, 25, 80, 400 (when QH enabled).
4. Zooming out to minimum doesn't produce overlapping labels (bug 4 gone).
5. Horizontal scroll keeps tasks and header aligned at any zoom (bug 4b gone).
6. `Ctrl+0` fits the entire project to the visible area.
7. Week-start setting flips weekday markers and week numbers correctly.
8. Smooth-zoom toggle visibly changes feel; instant when off.

## Open questions

None — decisions captured above.
