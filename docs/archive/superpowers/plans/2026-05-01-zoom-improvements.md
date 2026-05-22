# Zoom Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timeline zooming feel like CAD — plain mouse wheel zooms toward the cursor, the header gracefully transitions from years down to quarter-hours, the existing low-zoom glitch is gone, horizontal scroll works, with all behavior configurable.

**Architecture:** A new `timelineTiers.ts` data table drives a rewritten `drawTimelineHeader`. A new `useGanttZoom` hook owns the wheel handler and cursor-anchored zoom math; `useZoomShortcuts` adds `+`/`-`/`0`/`Ctrl+0`. Settings live in `UIState` (the existing pattern — `uiTheme` already lives there).

**Tech Stack:** TypeScript, React 19, Zustand (with Immer), HTML5 Canvas 2D, Vite. No test framework installed — verification is via `tsc` (run as part of `npm run build`) plus manual checks in the running dev server.

---

## File Plan

**New files:**
- `src/engine/renderer/timelineTiers.ts` — pure tier data + `pickTiers(zoom, enableQuarterHour)` selector
- `src/hooks/useGanttZoom.ts` — wheel handler, cursor-anchored `zoomAt`, optional smooth animation
- `src/hooks/useZoomShortcuts.ts` — keyboard shortcuts wired to `useGanttZoom`

**Modified files:**
- `src/state/slices/types.ts` — extend `UIState` with new settings
- `src/state/appStore.ts` — defaults, dynamic clamp on `setZoom`, clamp on `enableQuarterHourZoom` toggle
- `src/utils/dateUtils.ts` — week-start-aware `getWeekNumber`, helper for week start
- `src/engine/renderer/GanttRenderer.ts` — rewrite `drawTimelineHeader` using tiers, pass `weekStartDay` through options
- `src/components/canvas/GanttCanvas.tsx` — replace inline wheel effect with hooks, fix horizontal scroll bug, pass `weekStartDay` to renderer
- `src/components/dialogs/SettingsDialog.tsx` — new "Tijdlijn / Zoomen" section
- `src/i18n/locales/{nl,en}/common.json` — translations for the new settings (other languages fall back to English via i18next default)

---

## Task 1: Add settings fields + dynamic zoom clamp to state

**Files:**
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/appStore.ts`

- [ ] **Step 1: Extend `UIState` interface**

In `src/state/slices/types.ts`, add the two new type aliases above `UIState`, then add four fields to `UIState` (after `uiTheme`):

```ts
export type MouseWheelMode = 'zoom' | 'scroll';
export type WeekStartDay = 'monday' | 'sunday';

export interface UIState {
  // ... keep all existing fields ...
  uiTheme: UITheme;
  mouseWheelMode: MouseWheelMode;
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  smoothZoom: boolean;
}
```

Do not delete or reorder existing fields — only append the four new ones at the bottom.

- [ ] **Step 2: Update default UI state**

In `src/state/appStore.ts`, locate `createDefaultUI()` (around line 181) and add the four defaults to the returned object. Place them right before the closing `}`:

```ts
    uiTheme: 'default',
    mouseWheelMode: 'zoom',
    enableQuarterHourZoom: false,
    weekStartDay: 'monday',
    smoothZoom: false,
  };
}
```

(Keep existing `uiTheme` line; only add the four new ones.)

- [ ] **Step 3: Make `setZoom` clamp dynamic**

In `src/state/appStore.ts`, replace the `setZoom` action (around line 535):

```ts
    setZoom: (zoom) =>
      set((s) => {
        const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
        s.view.zoom = Math.max(0.5, Math.min(max, zoom));
      }),
```

- [ ] **Step 4: Clamp existing zoom when QH-zoom is turned off**

Find `setUI` in `appStore.ts` (search for `setUI: (updates`). It currently is roughly `setUI: (updates) => set((s) => { Object.assign(s.ui, updates); })`. Replace its body so that after applying updates we re-clamp `view.zoom` if needed:

```ts
    setUI: (updates) =>
      set((s) => {
        Object.assign(s.ui, updates);
        const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
        if (s.view.zoom > max) s.view.zoom = max;
      }),
```

If the existing body is structured differently (e.g. spread instead of `Object.assign`), keep the existing update mechanism and only append the clamp lines.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: build succeeds. If it fails on `UIState` consumers (other places that destructure UIState exhaustively), update those — there are very few.

- [ ] **Step 6: Commit**

```bash
git add src/state/slices/types.ts src/state/appStore.ts
git commit -m "feat(zoom): add wheel/zoom settings to UI state"
```

---

## Task 2: Create the timeline tier table

**Files:**
- Create: `src/engine/renderer/timelineTiers.ts`

- [ ] **Step 1: Write the file**

Create `src/engine/renderer/timelineTiers.ts`:

```ts
import { addCalendarDays } from '@/utils/dateUtils';

export type TimelineTier =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'quarterHour';

export interface TierConfig {
  tier: TimelineTier;
  /** Minimum pixel width a label of this tier needs to be readable. Used as a defensive skip-rule. */
  minLabelWidth: number;
  /**
   * Step from one tick to the next, in fractional days.
   * For tiers larger than a day this is approximate (months/years vary); the renderer
   * uses the date-based "next boundary" function instead. For sub-day tiers it's exact.
   */
  stepDays: number;
}

export const TIER_CONFIG: Record<TimelineTier, TierConfig> = {
  year:        { tier: 'year',        minLabelWidth: 60, stepDays: 365 },
  quarter:     { tier: 'quarter',     minLabelWidth: 40, stepDays: 90 },
  month:       { tier: 'month',       minLabelWidth: 50, stepDays: 30 },
  week:        { tier: 'week',        minLabelWidth: 28, stepDays: 7 },
  day:         { tier: 'day',         minLabelWidth: 18, stepDays: 1 },
  hour:        { tier: 'hour',        minLabelWidth: 28, stepDays: 1 / 24 },
  quarterHour: { tier: 'quarterHour', minLabelWidth: 28, stepDays: 1 / 96 },
};

/**
 * Pick the {major, minor} tier pair for the given zoom (pixels per day).
 * QH-tier is only used when enableQuarterHour is true.
 */
export function pickTiers(
  zoom: number,
  enableQuarterHour: boolean
): { major: TimelineTier; minor: TimelineTier } {
  if (zoom < 4) return { major: 'year', minor: 'quarter' };
  if (zoom < 10) return { major: 'year', minor: 'month' };
  if (zoom < 25) return { major: 'month', minor: 'week' };
  if (zoom < 80) return { major: 'month', minor: 'day' };
  if (zoom < 400 || !enableQuarterHour) return { major: 'day', minor: 'hour' };
  return { major: 'hour', minor: 'quarterHour' };
}

/**
 * Given a starting date and a tier, return the date of the next tick boundary
 * (e.g. for 'month', the first of next month). For sub-day tiers, returns
 * `from + stepDays`.
 */
export function nextTickBoundary(from: Date, tier: TimelineTier): Date {
  switch (tier) {
    case 'year':
      return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
    case 'quarter': {
      const m = from.getUTCMonth();
      const nextQ = Math.floor(m / 3) * 3 + 3;
      if (nextQ >= 12) return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
      return new Date(Date.UTC(from.getUTCFullYear(), nextQ, 1));
    }
    case 'month': {
      const m = from.getUTCMonth();
      if (m === 11) return new Date(Date.UTC(from.getUTCFullYear() + 1, 0, 1));
      return new Date(Date.UTC(from.getUTCFullYear(), m + 1, 1));
    }
    case 'week':
      return addCalendarDays(from, 7);
    case 'day':
      return addCalendarDays(from, 1);
    case 'hour': {
      const r = new Date(from.getTime());
      r.setUTCHours(r.getUTCHours() + 1, 0, 0, 0);
      return r;
    }
    case 'quarterHour': {
      const r = new Date(from.getTime());
      r.setUTCMinutes(r.getUTCMinutes() + 15, 0, 0);
      return r;
    }
  }
}

/** Snap a date back to the start of its current tick (e.g. start of month). */
export function snapToTickStart(date: Date, tier: TimelineTier, weekStartDay: 'monday' | 'sunday' = 'monday'): Date {
  switch (tier) {
    case 'year':
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    case 'quarter': {
      const m = date.getUTCMonth();
      return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(m / 3) * 3, 1));
    }
    case 'month':
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    case 'week': {
      const r = new Date(date.getTime());
      const dow = r.getUTCDay();           // 0=Sun..6=Sat
      const offset = weekStartDay === 'sunday' ? dow : (dow === 0 ? 6 : dow - 1);
      r.setUTCDate(r.getUTCDate() - offset);
      r.setUTCHours(0, 0, 0, 0);
      return r;
    }
    case 'day': {
      const r = new Date(date.getTime());
      r.setUTCHours(0, 0, 0, 0);
      return r;
    }
    case 'hour': {
      const r = new Date(date.getTime());
      r.setUTCMinutes(0, 0, 0);
      return r;
    }
    case 'quarterHour': {
      const r = new Date(date.getTime());
      r.setUTCMinutes(Math.floor(r.getUTCMinutes() / 15) * 15, 0, 0);
      return r;
    }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds, no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/engine/renderer/timelineTiers.ts
git commit -m "feat(zoom): add timeline tier table and pickTiers selector"
```

---

## Task 3: Add week-start-aware week number helper

**Files:**
- Modify: `src/utils/dateUtils.ts`

- [ ] **Step 1: Add a Sunday-based week-start helper**

In `src/utils/dateUtils.ts`, add after `getWeekStart` (around line 42):

```ts
/** Get the Sunday of the week containing the given date (used when weekStartDay='sunday') */
export function getWeekStartSunday(d: Date): Date {
  const result = new Date(d.getTime());
  const dow = result.getUTCDay(); // 0=Sun..6=Sat
  result.setUTCDate(result.getUTCDate() - dow);
  return result;
}

/** Get the start of the week respecting the week-start-day preference */
export function getWeekStartFor(d: Date, startDay: 'monday' | 'sunday'): Date {
  return startDay === 'sunday' ? getWeekStartSunday(d) : getWeekStart(d);
}
```

- [ ] **Step 2: Add a Sunday-based week-number variant**

Append to the same file:

```ts
/** Get week number with configurable week start. ISO 8601 when 'monday', US-style when 'sunday'. */
export function getWeekNumberFor(d: Date, startDay: 'monday' | 'sunday' = 'monday'): number {
  if (startDay === 'monday') return getWeekNumber(d);
  // US-style: week 1 contains Jan 1; weeks start Sunday.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jan1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((target.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/utils/dateUtils.ts
git commit -m "feat(zoom): week-start-aware week-start and week-number helpers"
```

---

## Task 4: Rewrite `drawTimelineHeader` to use the tier system

**Files:**
- Modify: `src/engine/renderer/GanttRenderer.ts`

- [ ] **Step 1: Pass weekStartDay + enableQuarterHourZoom through render options**

Find the `GanttRenderOptions` interface near the top of `GanttRenderer.ts` (search for `export interface GanttRenderOptions`) and add two fields:

```ts
export interface GanttRenderOptions {
  // ... existing fields ...
  weekStartDay?: 'monday' | 'sunday';        // default 'monday'
  enableQuarterHourZoom?: boolean;            // default false
}
```

- [ ] **Step 2: Replace `drawTimelineHeader`**

Locate `private drawTimelineHeader(): void` (around line 205 — see spec). Replace the entire method body with the tier-driven version:

```ts
  private drawTimelineHeader(): void {
    const { canvasWidth, headerHeight, taskTableWidth, view, weekStartDay, enableQuarterHourZoom, localizedMonths } = this.opts;
    const ctx = this.ctx;

    // Header background + bottom border
    ctx.fillStyle = this.colors.headerBg;
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvasWidth, headerHeight);
    ctx.stroke();

    const wsd = weekStartDay ?? 'monday';
    const enableQH = enableQuarterHourZoom ?? false;
    const { major, minor } = pickTiers(view.zoom, enableQH);

    // Visible date range
    const startDate = addCalendarDays(this.viewStart, Math.floor(view.scrollX / view.zoom) - 1);
    const endDate = addCalendarDays(this.viewStart, Math.ceil((view.scrollX + canvasWidth) / view.zoom) + 1);

    // --- Top row: major tier ---
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = this.colors.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.drawTierLabels(major, startDate, endDate, taskTableWidth, headerHeight / 4, wsd, localizedMonths);

    // --- Bottom row: minor tier ---
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = this.colors.textSecondary;
    this.drawTierLabels(minor, startDate, endDate, taskTableWidth, headerHeight * 3 / 4, wsd, localizedMonths);
  }

  private drawTierLabels(
    tier: TimelineTier,
    startDate: Date,
    endDate: Date,
    taskTableWidth: number,
    yCenter: number,
    weekStartDay: 'monday' | 'sunday',
    localizedMonths?: string[]
  ): void {
    const { canvasWidth } = this.opts;
    const ctx = this.ctx;
    const cfg = TIER_CONFIG[tier];

    // Snap to the tick boundary at-or-before startDate
    let cursor = snapToTickStart(startDate, tier, weekStartDay);
    let lastDrawnRight = -Infinity;

    while (cursor.getTime() <= endDate.getTime()) {
      const next = nextTickBoundary(cursor, tier);
      const x1 = this.dateToXMs(cursor);
      const x2 = this.dateToXMs(next);
      const labelText = this.formatTierLabel(tier, cursor, weekStartDay, localizedMonths);

      // Skip tick entirely if it doesn't reach the visible task area
      if (x2 <= taskTableWidth) {
        cursor = next;
        continue;
      }
      // Stop once we're past the right edge
      if (x1 >= canvasWidth) break;

      const labelX = Math.max(x1 + 4, taskTableWidth + 4);
      const slotWidth = x2 - Math.max(x1, taskTableWidth);

      // Defensive skip: if slot is too narrow OR we'd overlap the previous label
      if (slotWidth >= cfg.minLabelWidth && labelX > lastDrawnRight + 4) {
        ctx.fillText(labelText, labelX, yCenter);
        const measured = ctx.measureText(labelText).width;
        lastDrawnRight = labelX + measured;
      }

      cursor = next;
    }
  }

  private formatTierLabel(
    tier: TimelineTier,
    d: Date,
    weekStartDay: 'monday' | 'sunday',
    localizedMonths?: string[]
  ): string {
    const months = localizedMonths || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => n.toString().padStart(2, '0');
    switch (tier) {
      case 'year':        return `${d.getUTCFullYear()}`;
      case 'quarter':     return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
      case 'month':       return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      case 'week':        return `W${getWeekNumberFor(d, weekStartDay)}`;
      case 'day':         return `${d.getUTCDate()}`;
      case 'hour':        return `${pad(d.getUTCHours())}:00`;
      case 'quarterHour': return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }
  }

  /** Convert a Date (with possible sub-day precision) to canvas X. */
  private dateToXMs(date: Date): number {
    const msPerDay = 86400000;
    const daysFromStart = (date.getTime() - this.viewStart.getTime()) / msPerDay;
    return this.opts.taskTableWidth + daysFromStart * this.opts.view.zoom - this.opts.view.scrollX;
  }
```

- [ ] **Step 3: Add the imports**

At the top of `GanttRenderer.ts`, add:

```ts
import { TimelineTier, TIER_CONFIG, pickTiers, nextTickBoundary, snapToTickStart } from './timelineTiers';
import { getWeekNumberFor } from '@/utils/dateUtils';
```

(Keep existing imports.)

- [ ] **Step 4: Remove the now-unused fixed weekday vertical-grid logic**

Inside the `render()` method (around line 168) the current code thickens the grid line on Mondays via `dayOfWeek === 1 ? 1 : 0.5`. Replace that single ternary so it respects week-start-day:

```ts
ctx.lineWidth = dayOfWeek === (this.opts.weekStartDay === 'sunday' ? 7 : 1) ? 1 : 0.5;
```

(`isoDayOfWeek` returns 7 for Sunday, 1 for Monday.)

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: success. If TS complains about new option fields being optional, add `weekStartDay: 'monday'` defaults at the call site (handled in Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderer/GanttRenderer.ts
git commit -m "feat(zoom): tier-driven timeline header with week-start support"
```

---

## Task 5: Wire renderer options + remove inline wheel handler in GanttCanvas

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`

- [ ] **Step 1: Read the new UI fields**

Near the existing `useAppStore` selectors (around line 73 — `const uiTheme = useAppStore(s => s.ui.uiTheme);`) add:

```ts
const weekStartDay = useAppStore(s => s.ui.weekStartDay);
const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
const mouseWheelMode = useAppStore(s => s.ui.mouseWheelMode);
const smoothZoom = useAppStore(s => s.ui.smoothZoom);
```

- [ ] **Step 2: Pass them through render options**

In the `render` callback (around line 138), include them in `opts`:

```ts
const opts: GanttRenderOptions = {
  // ... existing fields ...
  columnHeaders,
  weekStartDay,
  enableQuarterHourZoom,
};
```

Update the dependency array of the `useCallback` (line 157) to include `weekStartDay` and `enableQuarterHourZoom`.

- [ ] **Step 3: Delete the inline wheel handler effect**

Delete the entire effect block "Native wheel handler to prevent browser zoom on ctrl+scroll" (lines 177–197 of the file before this task; the block starts with the comment and ends with the empty line after `}, [view.zoom, view.scrollX, view.scrollY, setZoom, setScroll]);`).

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: success. The header will render via the new tier system; wheel behavior is temporarily broken until Task 6 wires the new hook.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/GanttCanvas.tsx
git commit -m "refactor(zoom): pass tier options to renderer, drop inline wheel effect"
```

---

## Task 6: Build the zoom hook with cursor anchoring

**Files:**
- Create: `src/hooks/useGanttZoom.ts`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useGanttZoom.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';

interface UseGanttZoomOpts {
  containerRef: React.RefObject<HTMLDivElement>;
  taskTableWidth: number;
}

const ZOOM_FACTOR_PER_TICK = 1.1;
const ANIM_DURATION_MS = 180;

export function useGanttZoom({ containerRef, taskTableWidth }: UseGanttZoomOpts) {
  const view = useAppStore(s => s.view);
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const mouseWheelMode = useAppStore(s => s.ui.mouseWheelMode);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const smoothZoom = useAppStore(s => s.ui.smoothZoom);

  // Latest values in a ref so the wheel handler doesn't re-attach every render
  const latest = useRef({ view, mouseWheelMode, enableQuarterHourZoom, smoothZoom });
  latest.current = { view, mouseWheelMode, enableQuarterHourZoom, smoothZoom };

  const animRef = useRef<number | null>(null);

  // Cursor-anchored zoom step. anchorX is canvas-X (pixels from canvas left edge).
  const zoomAt = (newZoom: number, anchorX: number) => {
    const { view: v, enableQuarterHourZoom: enableQH } = latest.current;
    const max = enableQH ? 1000 : 400;
    const clamped = Math.max(0.5, Math.min(max, newZoom));
    if (clamped === v.zoom) return;

    // Date under the cursor at current zoom (in fractional days from viewStart)
    const localX = anchorX - taskTableWidth + v.scrollX;
    const daysUnderCursor = localX / v.zoom;

    // New scrollX so the same fractional day stays under the cursor
    const newScrollX = Math.max(0, daysUnderCursor * clamped - (anchorX - taskTableWidth));

    if (latest.current.smoothZoom) {
      animateTo(clamped, newScrollX);
    } else {
      setZoom(clamped);
      setScroll(newScrollX, v.scrollY);
    }
  };

  const animateTo = (targetZoom: number, targetScrollX: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const startZoom = latest.current.view.zoom;
    const startScrollX = latest.current.view.scrollX;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / ANIM_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      const z = startZoom + (targetZoom - startZoom) * eased;
      const x = startScrollX + (targetScrollX - startScrollX) * eased;
      setZoom(z);
      setScroll(x, latest.current.view.scrollY);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  // Wheel handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const { mouseWheelMode: mode, view: v } = latest.current;

      const isZoomGesture =
        e.ctrlKey || e.metaKey ||
        (mode === 'zoom' && !e.shiftKey);

      if (isZoomGesture) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR_PER_TICK : ZOOM_FACTOR_PER_TICK;
        zoomAt(v.zoom * factor, anchorX);
        return;
      }

      // Scroll path
      if (mode === 'zoom' && e.shiftKey) {
        // Shift+wheel scrolls horizontally
        setScroll(v.scrollX + e.deltaY, v.scrollY);
      } else if (mode === 'scroll') {
        if (e.shiftKey) {
          setScroll(v.scrollX + e.deltaY, v.scrollY);
        } else {
          setScroll(v.scrollX + e.deltaX, v.scrollY + e.deltaY);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [containerRef, taskTableWidth, setZoom, setScroll]);

  return { zoomAt };
}
```

- [ ] **Step 2: Use the hook in `GanttCanvas`**

In `src/components/canvas/GanttCanvas.tsx`, near the other hooks (just below the `useAppStore` selectors), add:

```ts
import { useGanttZoom } from '@/hooks/useGanttZoom';

// ... inside the component, after other refs/selectors:
const { zoomAt } = useGanttZoom({ containerRef, taskTableWidth: TASK_TABLE_WIDTH });
```

- [ ] **Step 3: Type-check + smoke test in dev**

Run: `npm run build` (must pass)
Then: `./node_modules/.bin/vite --host` (or have dev server running) — open the app and verify:
1. Plain mouse wheel over the canvas zooms (not scrolls).
2. The point under the cursor stays under the cursor when you zoom.
3. Ctrl+wheel also zooms.
4. Shift+wheel scrolls horizontally.

If any of these fail, debug before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGanttZoom.ts src/components/canvas/GanttCanvas.tsx
git commit -m "feat(zoom): cursor-anchored zoom with smooth-zoom + wheel-mode support"
```

---

## Task 7: Fix horizontal scroll bug

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`

The bug: when zoom changes (or after `zoomAt`), the hidden hScroll element's `scrollLeft` becomes inconsistent with the new content width and the new `view.scrollX`. The existing sync effect (around line 200) only fires when `scrollX` changes, not when `zoom` (and therefore `totalContentWidth`) changes.

- [ ] **Step 1: Sync hScroll on both scrollX and zoom changes**

In `src/components/canvas/GanttCanvas.tsx`, find the effect "Sync horizontal scrollbar with canvas scrollX" (around line 200) and update its body and dependency array:

```ts
// Sync horizontal scrollbar with canvas scrollX (also re-sync after zoom changes)
useEffect(() => {
  const hScroll = hScrollRef.current;
  if (!hScroll) return;
  const desired = view.scrollX;
  if (Math.abs(hScroll.scrollLeft - desired) > 1) {
    hScroll.scrollLeft = desired;
  }
}, [view.scrollX, view.zoom]);
```

- [ ] **Step 2: Manually verify**

Run dev server. Reproduce the original bug:
1. Add some tasks if none exist.
2. Zoom in twice (wheel up over the canvas) — verify tasks remain visible and the header stays aligned.
3. Drag the horizontal scrollbar — verify tasks AND header move together.
4. Zoom in further while scrolled, then scroll back to start — verify everything still aligns.

If any step fails, investigate. Likely culprits: stale `viewStart` in the renderer (cached on construction), or `totalContentWidth` not recomputing because it doesn't depend on `scrollX`.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/GanttCanvas.tsx
git commit -m "fix(zoom): re-sync horizontal scrollbar after zoom changes"
```

---

## Task 8: Add keyboard shortcuts

**Files:**
- Create: `src/hooks/useZoomShortcuts.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useZoomShortcuts.ts`:

```ts
import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { parseDate, diffCalendarDays } from '@/utils/dateUtils';

interface UseZoomShortcutsOpts {
  zoomAt: (newZoom: number, anchorX: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  taskTableWidth: number;
}

const DEFAULT_ZOOM = 30;

export function useZoomShortcuts({ zoomAt, containerRef, taskTableWidth }: UseZoomShortcutsOpts) {
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const tasks = useAppStore(s => s.tasks);
  const view = useAppStore(s => s.view);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept while typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;

      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(view.zoom * 1.1, centerX);
      } else if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(view.zoom / 1.1, centerX);
      } else if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
        setScroll(0, view.scrollY);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Fit to project
        if (tasks.length === 0) {
          setZoom(DEFAULT_ZOOM);
          setScroll(0, view.scrollY);
          return;
        }
        let minStart: string | null = null;
        let maxFinish: string | null = null;
        for (const t of tasks) {
          const s = t.time.earlyStart || t.time.scheduleStart;
          const f = t.time.earlyFinish || t.time.scheduleFinish || s;
          if (s && (!minStart || s < minStart)) minStart = s;
          if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
        }
        if (!minStart || !maxFinish) return;
        const span = Math.max(1, diffCalendarDays(parseDate(minStart), parseDate(maxFinish)) + 1);
        const usable = rect.width - taskTableWidth;
        if (usable <= 0) return;
        const newZoom = Math.max(0.5, Math.min(400, usable / span));
        setZoom(newZoom);
        setViewStartDate(minStart);
        setScroll(0, view.scrollY);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomAt, containerRef, taskTableWidth, setZoom, setScroll, setViewStartDate, view.zoom, view.scrollY, tasks]);
}
```

- [ ] **Step 2: Use the hook**

In `src/components/canvas/GanttCanvas.tsx`, near the other hook calls:

```ts
import { useZoomShortcuts } from '@/hooks/useZoomShortcuts';

// ... after `const { zoomAt } = useGanttZoom(...)`:
useZoomShortcuts({ zoomAt, containerRef, taskTableWidth: TASK_TABLE_WIDTH });
```

- [ ] **Step 3: Manual verify**

Reload dev server. With the canvas focused (click anywhere on the gantt area first to give window focus):
1. Press `+` → zoom in.
2. Press `-` → zoom out.
3. Press `0` → resets to default zoom 30.
4. Press `Ctrl+0` → fits all tasks horizontally.
5. Type in the task-name dialog (TaskDialog open) → `+`/`-` should NOT zoom.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useZoomShortcuts.ts src/components/canvas/GanttCanvas.tsx
git commit -m "feat(zoom): keyboard shortcuts (+/-/0/Ctrl+0 fit-to-project)"
```

---

## Task 9: Add settings UI

**Files:**
- Modify: `src/components/dialogs/SettingsDialog.tsx`
- Modify: `src/i18n/locales/nl/common.json`
- Modify: `src/i18n/locales/en/common.json`

- [ ] **Step 1: Add translations (Dutch)**

In `src/i18n/locales/nl/common.json`, extend the `settings` block with new keys (place them right after `"theme": "Thema"` and before the closing brace):

```json
    "theme": "Thema",
    "timeline": "Tijdlijn / Zoomen",
    "mouseWheelMode": "Muiswiel-gedrag",
    "mouseWheelModeZoom": "Zoomen",
    "mouseWheelModeScroll": "Scrollen",
    "enableQuarterHourZoom": "Kwartieren tonen bij ver inzoomen",
    "weekStartDay": "Week begint op",
    "weekStartMonday": "Maandag",
    "weekStartSunday": "Zondag",
    "smoothZoom": "Vloeiende zoom-animatie"
  }
```

- [ ] **Step 2: Add translations (English)**

In `src/i18n/locales/en/common.json`, extend the `settings` block analogously:

```json
    "theme": "Theme",
    "timeline": "Timeline / Zoom",
    "mouseWheelMode": "Mouse wheel behavior",
    "mouseWheelModeZoom": "Zoom",
    "mouseWheelModeScroll": "Scroll",
    "enableQuarterHourZoom": "Show quarter-hours when zoomed in far",
    "weekStartDay": "Week starts on",
    "weekStartMonday": "Monday",
    "weekStartSunday": "Sunday",
    "smoothZoom": "Smooth zoom animation"
  }
```

(Other languages will fall back to English via i18next.)

- [ ] **Step 3: Add a "Tijdlijn" tab + section to SettingsDialog**

In `src/components/dialogs/SettingsDialog.tsx`, extend the tab type:

```ts
type SettingsTab = 'general' | 'language' | 'timeline';
```

Add the new selectors near the top of the component:

```ts
const mouseWheelMode = useAppStore(s => s.ui.mouseWheelMode);
const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
const weekStartDay = useAppStore(s => s.ui.weekStartDay);
const smoothZoom = useAppStore(s => s.ui.smoothZoom);
```

Add a new tab button next to the existing two (around line 93):

```tsx
<button
  className={`settings-tab ${activeTab === 'timeline' ? 'active' : ''}`}
  onClick={() => setActiveTab('timeline')}
>
  {t('settings.timeline')}
</button>
```

Add the corresponding tab content block right after the `language` block (around line 142):

```tsx
{activeTab === 'timeline' && (
  <div className="settings-section-list">
    <div className="settings-section">
      <h3>{t('settings.mouseWheelMode')}</h3>
      <select
        className="settings-select"
        value={mouseWheelMode}
        onChange={e => setUI({ mouseWheelMode: e.target.value as 'zoom' | 'scroll' })}
      >
        <option value="zoom">{t('settings.mouseWheelModeZoom')}</option>
        <option value="scroll">{t('settings.mouseWheelModeScroll')}</option>
      </select>
    </div>
    <div className="settings-section">
      <h3>{t('settings.weekStartDay')}</h3>
      <select
        className="settings-select"
        value={weekStartDay}
        onChange={e => setUI({ weekStartDay: e.target.value as 'monday' | 'sunday' })}
      >
        <option value="monday">{t('settings.weekStartMonday')}</option>
        <option value="sunday">{t('settings.weekStartSunday')}</option>
      </select>
    </div>
    <div className="settings-section">
      <label className="settings-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={enableQuarterHourZoom}
          onChange={e => setUI({ enableQuarterHourZoom: e.target.checked })}
        />
        <span>{t('settings.enableQuarterHourZoom')}</span>
      </label>
    </div>
    <div className="settings-section">
      <label className="settings-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={smoothZoom}
          onChange={e => setUI({ smoothZoom: e.target.checked })}
        />
        <span>{t('settings.smoothZoom')}</span>
      </label>
    </div>
  </div>
)}
```

(`setUI` writes immediately to the store — no separate "save" needed for these settings; they take effect live.)

- [ ] **Step 4: Manual verify**

Reload dev server. Open Settings → "Tijdlijn / Zoomen":
1. All four controls render correctly with Dutch labels.
2. Toggling "Muiswiel-gedrag" to *Scrollen* makes plain wheel scroll instead of zoom (Ctrl+wheel still zooms).
3. Toggling "Kwartieren tonen…" on lets you zoom past 400 px/day and see HH:MM labels.
4. Toggling "Week begint op" to Sunday changes week numbers and the thicker grid line moves to Sunday.
5. Toggling "Vloeiende zoom-animatie" makes the zoom step animate (~180 ms).

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/dialogs/SettingsDialog.tsx src/i18n/locales/nl/common.json src/i18n/locales/en/common.json
git commit -m "feat(zoom): settings UI — wheel mode, QH zoom, week start, smooth zoom"
```

---

## Task 10: Final regression check + cleanup

- [ ] **Step 1: Full manual regression**

Reload dev server and walk through:

1. Default state: header shows month + day labels, plain wheel zooms toward cursor.
2. Zoom out fully (wheel down many ticks): header transitions to month/week, then year/month, then year/quarter — no overlapping labels at any point.
3. Zoom in past 80 px/day: header shows day + hour labels.
4. Toggle quarter-hour setting on, zoom further in: header shows hour + 15-minute labels at zoom > 400.
5. `Ctrl+0`: fits the project to screen.
6. Drag horizontal scrollbar: tasks and header move together at any zoom.
7. Switch to Sunday week start: weekday-grid emphasis moves, week numbers shift.
8. Settings dialog still saves theme + language correctly (regression of pre-existing behavior).

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: success, no TypeScript errors.

- [ ] **Step 3: Final commit (only if any cleanup was needed)**

If the regression revealed small fixes, commit them with a clear message. Otherwise skip.

```bash
# Only if there are pending changes:
git add -A
git commit -m "fix(zoom): regression cleanups from final pass"
```

---

## Notes / Known Gotchas

- The renderer's `viewStart` is captured when `GanttRenderer` is constructed (once per render call). Since `GanttCanvas`'s `render` callback creates a fresh renderer every frame, this is fine — but if anyone refactors to reuse a renderer instance, `viewStart` must be kept in sync with `view.viewStartDate`.
- `setZoom` clamps; consumers calling it with extreme values (e.g. during fit-to-project on a 50-year project) will silently get the clamp value. The fit-to-project code re-clamps explicitly for safety.
- i18next falls back to the English bundle when a key is missing in the active locale; the 12 untranslated locales will show English strings for the new settings until someone provides translations.
- During smooth-zoom animation, `zoomAt` writes many small store updates per frame. Zustand+Immer batches re-renders fine, but if performance suffers, switch the animation to update via a single ref + manual repaint instead.
