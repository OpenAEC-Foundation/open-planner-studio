# Debug Terminal Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small debug overlay (terminal-style log feed) below the right-hand Properties panel that captures `console.*` output and explicit app-events, controlled by a settings toggle and a StatusBar button.

**Architecture:** A standalone `appLog` service (no React dep) holds a 500-entry ring buffer. It monkey-patches `console.log/info/warn/error` and listens for `window.error`/`unhandledrejection`. A `DebugTerminal` React component subscribes via `useSyncExternalStore`. Visibility is gated by `ui.debugTerminalEnabled` (persisted) ∧ `ui.debugTerminalOpen` (session) ∧ right-panel uitgeklapt ∧ Gantt-tab actief.

**Tech Stack:** React 19, Zustand + immer, Tauri 2, Vite 7, TypeScript, TailwindCSS 4, lucide-react. No test framework; verification is manual per task.

**Spec:** `docs/superpowers/specs/2026-05-01-debug-terminal-design.md`

**Conventions:**
- All UI strings in this feature are **English** (developer-facing). No i18n keys added.
- After each task: run `npm run build` to confirm types compile, then commit.
- Manual verification described per task is run inside `npm run tauri:dev` (or `npm run dev` in browser when Tauri-only paths aren't relevant).

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/services/debug/appLog.ts` | create | Ring buffer, `console` patch, error listeners, `emit/subscribe/snapshot/clear/init` |
| `src/components/panels/DebugTerminal.tsx` | create | UI: toolbar (filter chips, pause, clear, close) + scroll-feed |
| `src/state/slices/types.ts` | modify | Add `debugTerminalEnabled`, `debugTerminalOpen` to `UIState` |
| `src/state/appStore.ts` | modify | Defaults in `createDefaultUI()`; force `debugTerminalOpen=false` when `debugTerminalEnabled` flips to false in `setUI` |
| `src/utils/settingsStore.ts` | modify | `loadDebugTerminalEnabled` / `saveDebugTerminalEnabled` (localStorage `ops-debugTerminalEnabled`) |
| `src/main.tsx` | modify | `appLog.init()` before `createRoot(...).render(...)` |
| `src/App.tsx` | modify | Load persisted setting on mount; render `<DebugTerminal />` in right column when all gates pass |
| `src/components/dialogs/SettingsDialog.tsx` | modify | Toggle "Enable debug terminal" in General tab |
| `src/components/layout/StatusBar/StatusBar.tsx` | modify | Conditional terminal-icon button toggling `debugTerminalOpen` |

---

## Task 1: appLog service — buffer, emit, subscribe

**Files:**
- Create: `src/services/debug/appLog.ts`

- [ ] **Step 1: Create the file with types, buffer, emit/subscribe/snapshot/clear**

Write `src/services/debug/appLog.ts`:

```ts
export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'event';

export interface LogEntry {
  id: number;
  ts: number;            // Date.now()
  level: LogLevel;
  channel?: string;      // for level='event' or arbitrary tagging
  text: string;
}

const MAX_ENTRIES = 500;

let buffer: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<(entries: LogEntry[]) => void>();
let initialized = false;

function notify(): void {
  // Use slice() so subscribers get a stable reference snapshot.
  const snapshot = buffer.slice();
  for (const fn of listeners) {
    try { fn(snapshot); }
    catch (err) {
      // Swallow listener errors so one broken consumer can't kill the feed.
      // Use original console (post-init we'd recurse if patched).
      originalConsole.error?.('[appLog] listener threw:', err);
    }
  }
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) {
    const stack = (arg.stack ?? '').split('\n').slice(0, 4).join('\n');
    return `${arg.name}: ${arg.message}\n${stack}`;
  }
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  try { return JSON.stringify(arg); }
  catch { return '[unserializable]'; }
}

function formatArgs(args: unknown[]): string {
  return args.map(stringifyArg).join(' ');
}

// Hold references before patching, so internal logging never recurses.
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function push(level: LogLevel, channel: string | undefined, text: string): void {
  const entry: LogEntry = { id: nextId++, ts: Date.now(), level, channel, text };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  notify();
}

export const appLog = {
  init(): void {
    if (initialized) return;
    initialized = true;

    console.log = (...args: unknown[]) => {
      try { push('log', undefined, formatArgs(args)); } catch {}
      originalConsole.log(...args);
    };
    console.info = (...args: unknown[]) => {
      try { push('info', undefined, formatArgs(args)); } catch {}
      originalConsole.info(...args);
    };
    console.warn = (...args: unknown[]) => {
      try { push('warn', undefined, formatArgs(args)); } catch {}
      originalConsole.warn(...args);
    };
    console.error = (...args: unknown[]) => {
      try { push('error', undefined, formatArgs(args)); } catch {}
      originalConsole.error(...args);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        try { push('error', 'window', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`); } catch {}
      });
      window.addEventListener('unhandledrejection', (e) => {
        try { push('error', 'promise', stringifyArg(e.reason)); } catch {}
      });
    }
  },

  emit(level: LogLevel, channel: string | undefined, ...args: unknown[]): void {
    push(level, channel, formatArgs(args));
  },

  subscribe(fn: (entries: LogEntry[]) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  snapshot(): LogEntry[] {
    return buffer.slice();
  },

  clear(): void {
    buffer = [];
    notify();
  },
};
```

- [ ] **Step 2: Verify types compile**

Run: `npm run build`
Expected: build succeeds with no TS errors. (Vite build, not Tauri build.)

- [ ] **Step 3: Commit**

```bash
git add src/services/debug/appLog.ts
git commit -m "feat(debug): add appLog ring buffer and console capture service"
```

---

## Task 2: Wire appLog.init() into main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Import and call init before render**

Replace the contents of `src/main.tsx` with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import { appLog } from '@/services/debug/appLog';
import App from './App';
import './styles/globals.css';

appLog.init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Verify build still passes**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Manual smoke check (browser dev mode)**

Run: `npm run dev`
Open the app in browser, open devtools, and run in the JS console:
```js
console.log('hello');
console.error('boom');
(await import('/src/services/debug/appLog.ts')).appLog.snapshot();
```
Expected: `snapshot()` returns at least the two entries (level `log` and `error`) plus any startup logs. Original console output also appears in devtools as normal.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(debug): initialize appLog before React render"
```

---

## Task 3: Add UI state fields

**Files:**
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/appStore.ts`

- [ ] **Step 1: Extend UIState in types.ts**

In `src/state/slices/types.ts`, add two fields at the bottom of the `UIState` interface (after `weekStartDay: WeekStartDay;`):

```ts
  debugTerminalEnabled: boolean;  // persisted
  debugTerminalOpen: boolean;     // session
```

- [ ] **Step 2: Add defaults in createDefaultUI()**

In `src/state/appStore.ts`, in `createDefaultUI()` (around line 181-201), add the two fields before the closing `};`:

```ts
    debugTerminalEnabled: false,
    debugTerminalOpen: false,
```

- [ ] **Step 3: Force open=false when enabled flips to false in setUI**

Replace the existing `setUI` action (around line 560-565) with:

```ts
    setUI: (updates) =>
      set((s) => {
        // If debugTerminalEnabled is being turned off, force-close the terminal.
        if (updates.debugTerminalEnabled === false) {
          (updates as Partial<UIState>).debugTerminalOpen = false;
        }
        Object.assign(s.ui, updates);
        const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
        if (s.view.zoom > max) s.view.zoom = max;
      }),
```

Add this import at the top of `src/state/appStore.ts` if not already present:

```ts
import { ViewState, UIState, TimeScale } from './slices/types';
```

(It already imports `UIState` — confirm and leave as-is.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: success. If TS complains that `UIState` isn't imported in scope where the cast happens, it already is — the file imports it on line 9.

- [ ] **Step 5: Commit**

```bash
git add src/state/slices/types.ts src/state/appStore.ts
git commit -m "feat(debug): add debugTerminalEnabled/Open UI state with auto-close on disable"
```

---

## Task 4: Persist debugTerminalEnabled

**Files:**
- Modify: `src/utils/settingsStore.ts`

- [ ] **Step 1: Add load/save helpers**

Append to `src/utils/settingsStore.ts`:

```ts
export async function loadDebugTerminalEnabled(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('debugTerminalEnabled');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveDebugTerminalEnabled(value: boolean): Promise<void> {
  await setSetting('debugTerminalEnabled', value);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/utils/settingsStore.ts
git commit -m "feat(debug): persist debugTerminalEnabled in localStorage"
```

---

## Task 5: Load persisted setting on app mount

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the loader and call it in the boot effect**

In `src/App.tsx`, update the existing import line for `settingsStore`:

```ts
import { initTheme, loadZoomSettings, loadDebugTerminalEnabled } from '@/utils/settingsStore';
```

Then extend the existing `useEffect` (currently around lines 39-47) to also load the debug-terminal setting:

```tsx
  useEffect(() => {
    initLocale();
    initTheme().then(theme => {
      setUI({ uiTheme: theme as any });
    });
    loadZoomSettings().then(zs => {
      if (Object.keys(zs).length > 0) setUI(zs);
    });
    loadDebugTerminalEnabled().then(v => {
      if (typeof v === 'boolean') setUI({ debugTerminalEnabled: v });
    });
  }, []);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(debug): load debugTerminalEnabled on app mount"
```

---

## Task 6: DebugTerminal component

**Files:**
- Create: `src/components/panels/DebugTerminal.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/panels/DebugTerminal.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play, Trash2, X } from 'lucide-react';
import { appLog, LogEntry, LogLevel } from '@/services/debug/appLog';
import { useAppStore } from '@/state/appStore';

const ALL_LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'event'];

const LEVEL_COLOR: Record<LogLevel, string> = {
  log:   '#9ca3af', // gray-400
  info:  '#60a5fa', // blue-400
  warn:  '#fbbf24', // amber-400
  error: '#f87171', // red-400
  event: '#22d3ee', // cyan-400
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// useSyncExternalStore wants a stable getSnapshot that returns the same
// reference until something changes. We cache the latest array.
let cachedSnapshot: LogEntry[] = appLog.snapshot();
appLog.subscribe((entries) => { cachedSnapshot = entries; });

function subscribe(onChange: () => void): () => void {
  return appLog.subscribe(() => onChange());
}
function getSnapshot(): LogEntry[] {
  return cachedSnapshot;
}

export function DebugTerminal() {
  const setUI = useAppStore(s => s.setUI);
  const entries = useSyncExternalStore(subscribe, getSnapshot);

  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(() => new Set(ALL_LEVELS));
  const [paused, setPaused] = useState(false);
  const [stickyBottom, setStickyBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number>(0);
  // Snapshot we render when paused — frozen until unpaused.
  const frozenRef = useRef<LogEntry[] | null>(null);

  // When pausing, freeze the current entries; on unpause, release.
  useEffect(() => {
    if (paused) frozenRef.current = entries;
    else frozenRef.current = null;
  }, [paused]); // intentionally only on paused-flip

  const visibleEntries = useMemo(() => {
    const source = paused && frozenRef.current ? frozenRef.current : entries;
    return source.filter(e => enabledLevels.has(e.level));
  }, [entries, paused, enabledLevels]);

  // Auto-scroll to bottom when sticky and not paused.
  useEffect(() => {
    if (!stickyBottom || paused) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (visibleEntries.length > 0) {
      lastSeenIdRef.current = visibleEntries[visibleEntries.length - 1].id;
    }
  }, [visibleEntries, stickyBottom, paused]);

  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickyBottom(distanceFromBottom < 40);
  }, []);

  const toggleLevel = (lvl: LogLevel) => {
    setEnabledLevels(prev => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl);
      return next;
    });
  };

  const newCount = useMemo(() => {
    if (stickyBottom) return 0;
    return visibleEntries.filter(e => e.id > lastSeenIdRef.current).length;
  }, [visibleEntries, stickyBottom]);

  const jumpToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickyBottom(true);
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-border"
      style={{
        height: 200,
        background: '#0b0b0d',
        color: '#e5e7eb',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-6 border-b" style={{ borderColor: '#1f2937', background: '#111827' }}>
        {ALL_LEVELS.map(lvl => {
          const on = enabledLevels.has(lvl);
          return (
            <button
              key={lvl}
              onClick={() => toggleLevel(lvl)}
              title={`Toggle ${lvl}`}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${on ? LEVEL_COLOR[lvl] : '#374151'}`,
                color: on ? LEVEL_COLOR[lvl] : '#6b7280',
                background: 'transparent',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {lvl}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setPaused(p => !p)}
          title={paused ? 'Resume' : 'Pause'}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2 }}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
        <button
          onClick={() => appLog.clear()}
          title="Clear"
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2 }}
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={() => setUI({ debugTerminalOpen: false })}
          title="Close"
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2 }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Feed */}
      <div
        ref={listRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '2px 6px', position: 'relative' }}
      >
        {newCount > 0 && (
          <button
            onClick={jumpToBottom}
            style={{
              position: 'sticky',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 10,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            ↓ {newCount} new
          </button>
        )}
        {visibleEntries.map(e => (
          <div key={e.id} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
            <span style={{ color: '#6b7280' }}>{formatTime(e.ts)}</span>{' '}
            <span style={{ color: LEVEL_COLOR[e.level] }}>
              [{e.level}{e.channel ? `/${e.channel}` : ''}]
            </span>{' '}
            <span>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/DebugTerminal.tsx
git commit -m "feat(debug): add DebugTerminal component"
```

---

## Task 7: Render DebugTerminal in App.tsx right column

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import**

In `src/App.tsx`, add near the other panel imports (around line 13-16):

```ts
import { DebugTerminal } from '@/components/panels/DebugTerminal';
```

- [ ] **Step 2: Read the new state fields**

Add inside `AppContent()`, near the other `useAppStore` selectors (around line 28-37):

```ts
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
```

- [ ] **Step 3: Render the terminal in the uitgeklapte right-column branch**

Replace the uitgeklapte branch (the `else` of `rightPanelCollapsed`, currently the second `<div>` block around lines 156-176) with:

```tsx
            <div
              className="border-l border-border bg-surface-alt flex flex-col"
              style={{ width: rightPanelWidth, minWidth: 200 }}
            >
              <div className="flex items-center justify-between h-8 px-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {t('properties')}
                </span>
                <button
                  onClick={() => setUI({ rightPanelCollapsed: true })}
                  className="p-0.5 hover:bg-surface-hover rounded text-text-secondary"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TaskPropertiesPanel />
              </div>
              {debugTerminalEnabled && debugTerminalOpen && <DebugTerminal />}
            </div>
```

Key change vs. the original: removed `overflow-y-auto` from the outer column (it now belongs to the inner properties wrapper, which already has it) so the terminal can sit as a sibling without being scrolled inside the same container.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Manual verification (after Task 8 lands you can also flip the toggle from settings; for now flip it from devtools)**

Run: `npm run tauri:dev`. In the app's devtools console:
```js
useAppStore = (await import('/src/state/appStore.ts')).useAppStore;
useAppStore.getState().setUI({ debugTerminalEnabled: true, debugTerminalOpen: true });
console.error('hello from terminal');
```
Expected: a dark 200px terminal panel appears below the Properties panel; the `console.error` line is rendered in red. Collapse the right column → terminal disappears. Switch to the Table tab → terminal disappears.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(debug): render DebugTerminal under properties panel"
```

---

## Task 8: SettingsDialog toggle

**Files:**
- Modify: `src/components/dialogs/SettingsDialog.tsx`

- [ ] **Step 1: Import the persistence helper**

Update the existing import line for `settingsStore` near the top of the file:

```ts
import { saveLocale, saveTheme, saveZoomSettings, saveDebugTerminalEnabled } from '@/utils/settingsStore';
```

- [ ] **Step 2: Read the current value from the store**

Inside `SettingsDialog()`, near the other `useAppStore` selectors:

```ts
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
```

- [ ] **Step 3: Add toggle in the General tab**

In the General-tab JSX (the block after `{activeTab === 'general' && (`), add a new `<div className="settings-section">` after the existing "default zoom" section and before the project-info button:

```tsx
                  <div className="settings-section">
                    <h3>Debug terminal</h3>
                    <label className="settings-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={debugTerminalEnabled}
                        onChange={e => {
                          const checked = e.target.checked;
                          setUI({ debugTerminalEnabled: checked });
                          void saveDebugTerminalEnabled(checked);
                        }}
                      />
                      <span>Enable debug terminal</span>
                    </label>
                  </div>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/dialogs/SettingsDialog.tsx
git commit -m "feat(debug): add settings toggle for debug terminal"
```

---

## Task 9: StatusBar toggle button

**Files:**
- Modify: `src/components/layout/StatusBar/StatusBar.tsx`

- [ ] **Step 1: Replace the file**

Replace the contents of `src/components/layout/StatusBar/StatusBar.tsx` with:

```tsx
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'lucide-react';

export function StatusBar() {
  const { t } = useTranslation('menu');
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const view = useAppStore(s => s.view);
  const isDirty = useAppStore(s => s.isDirty);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const debugTerminalOpen = useAppStore(s => s.ui.debugTerminalOpen);
  const setUI = useAppStore(s => s.setUI);

  const leafTasks = tasks.filter(t => t.childIds.length === 0);
  const milestones = tasks.filter(t => t.isMilestone);
  const criticalCount = cpmResult?.criticalPath.length || 0;

  return (
    <div className="flex items-center h-7 bg-surface-alt border-t border-border px-3 text-[11px] text-text-secondary select-none gap-4">
      <span>{t('status.tasks')} {leafTasks.length}</span>
      <span>{t('status.milestones')} {milestones.length}</span>
      {cpmResult && (
        <>
          <span className="text-critical">{t('status.criticalPath', { count: criticalCount, duration: cpmResult.projectDuration })}</span>
          <span>{t('status.end')} {cpmResult.projectEnd}</span>
        </>
      )}
      {selectedTaskIds.length > 0 && (
        <span>{t('status.selection', { count: selectedTaskIds.length })}</span>
      )}
      <div className="flex-1" />
      <span>{t('status.scale')} {view.timeScale}</span>
      <span>{t('status.zoom', { level: Math.round(view.zoom) })}</span>
      {isDirty && <span className="text-yellow-500">{t('status.unsaved')}</span>}
      {debugTerminalEnabled && (
        <button
          onClick={() => setUI({ debugTerminalOpen: !debugTerminalOpen })}
          title={debugTerminalOpen ? 'Hide debug terminal' : 'Show debug terminal'}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover ${debugTerminalOpen ? 'text-text-primary' : 'text-text-secondary'}`}
        >
          <Terminal size={12} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: End-to-end manual verification**

Run: `npm run tauri:dev`. Then:

1. Open Settings → General → check "Enable debug terminal" → OK. ✅ StatusBar shows a terminal-icon button on the right.
2. Click the StatusBar button. ✅ Dark terminal panel appears below Properties.
3. In devtools: `console.log('test'); console.warn('warn'); console.error('err')`. ✅ Three rows appear, gray/yellow/red.
4. Click toolbar's "WARN" chip. ✅ Yellow row hidden.
5. Click pause icon, then trigger more `console.log` calls in devtools. ✅ Feed frozen. Click play → catches up.
6. Click clear. ✅ Feed empties.
7. Switch to Table tab. ✅ Terminal disappears.
8. Switch back to Gantt. ✅ Terminal returns.
9. Collapse the right panel via the chevron. ✅ Terminal disappears.
10. Open Settings again, uncheck "Enable debug terminal" → OK. ✅ StatusBar button gone, terminal gone.
11. Reload the app (Ctrl+R). ✅ "Enable debug terminal" remains unchecked (persisted).
12. Re-enable, then reload. ✅ Setting persists, but the panel itself starts closed.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/StatusBar/StatusBar.tsx
git commit -m "feat(debug): add StatusBar toggle button for debug terminal"
```

---

## Self-review notes

- All four spec sections (layout & gedrag, UI, architectuur, data flow) are mapped to tasks 1, 3, 6, 7, 8, 9.
- `appLog.emit('event', channel, …)` exists from Task 1. The spec lists it as available for app-events; no caller is added in this plan since the spec also notes "no concrete events to wire yet" implicitly — feature is read-channel today, callers can be added incrementally without a plan change.
- Type names match: `LogEntry`, `LogLevel`, `appLog.{init,emit,subscribe,snapshot,clear}` are consistent across Tasks 1, 6, 9.
- No placeholders.
- 200px height, sticky-bottom 40px threshold, 500-entry cap, level color list — all explicit.
- `setUI` cascade (disable → close) covered in Task 3 step 3; verified in Task 9 manual step 10.
