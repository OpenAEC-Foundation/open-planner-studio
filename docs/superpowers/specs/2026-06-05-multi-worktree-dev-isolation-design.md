# Multi-worktree dev isolation — design

**Date:** 2026-06-05
**Status:** Implemented

## Problem

Running `npm run tauri:dev` from two git worktrees of this repo at once made the
second desktop window render the **first** worktree's frontend.

Root cause — two settings disagreed:

- `src-tauri/tauri.conf.json` pins `devUrl` to a fixed `http://localhost:3007`.
- `vite.config.ts` had `port: 3007, strictPort: false`, so when 3007 was taken,
  Vite silently drifted to 3008 — but the Tauri window still loaded 3007 (the
  other worktree's Vite). The failure was silent and looked like stale code.

A second, related collision: the 60s auto-save writes `recovery.ifc` into the
shared `appDataDir` (app-id `org.openaec.planner`, identical for every
worktree), so two running desktop builds clobber each other's recovery file.

## Goal

Let multiple worktrees run their desktop builds simultaneously, automatically,
with no manual per-worktree configuration.

## Design

A launcher chooses one self-consistent port per run and threads it (plus a
per-worktree slug) through Vite and Tauri via the environment.

1. **`scripts/tauri-dev.mjs`** (new) — find the first free port ≥ 3007, derive a
   stable instance slug from the worktree directory name (`basename(cwd)`), then
   spawn `tauri dev --config '{"build":{"devUrl":"http://localhost:<port>"}}'`
   with `OPS_DEV_PORT` and `OPS_DEV_INSTANCE` in the env. `package.json`
   `tauri:dev` → `node scripts/tauri-dev.mjs`.

2. **`vite.config.ts`** — `port: Number(process.env.OPS_DEV_PORT) || 3007` with
   `strictPort: true`. Tauri's `beforeDevCommand` (`npm run dev`) inherits the
   env, so Vite binds exactly the chosen port; `strictPort` turns any remaining
   clash into a loud, retryable error instead of a silent drift.

3. **Recovery isolation** — `vite.config.ts` exposes the slug to the frontend as
   the `__OPS_DEV_INSTANCE__` define; `src/App.tsx` names the file
   `recovery.<slug>.ifc` when set, else `recovery.ifc` (production). One helper
   constant feeds both the auto-save write and the startup read/remove so the
   two sites can't drift. The slug is stable per worktree, so crash recovery
   still works across restarts.

## Trade-offs / scope

- Plain `npm run dev` (browser, Tier-1 self-test harness) stays default 3007 but
  now fails loudly if taken; a second worktree overrides with
  `OPS_DEV_PORT=<n> npm run dev`. Documented in `docs/self-test-harness.md`.
- Out of scope: two *production* installs sharing `appDataDir` (inherent to the
  shared app-id; not the worktree workflow).
- The free-port probe has a negligible same-instant race; `strictPort` makes the
  loser fail loudly rather than load the wrong frontend.

## Verification

- `tsc --noEmit` clean.
- Free-port probe returns the first free port ≥ 3007 against live ports.
- `OPS_DEV_PORT=3011 npm run dev` → Vite binds 3011; `OPS_DEV_PORT=3008` (taken)
  → `Error: Port 3008 is already in use` (fail-loud).
- `tauri dev --config '{"build":{"devUrl":...}}'` makes the window load the
  chosen port (validated live).
