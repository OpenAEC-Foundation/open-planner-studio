---
paths:
  - "scripts/dev-*.mjs"
  - "scripts/tauri-dev.mjs"
  - "scripts/run-browser-tests.mjs"
  - "vite.config.ts"
  - "tests/dev-server/**"
  - "src-tauri/tauri.conf.json"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud ongewijzigd overgenomen; "hierboven"/"hieronder" verwijst naar de oude volgorde van CLAUDE.md. -->

# Dev-server en worktrees

`npm run dev` gaat via `scripts/dev-server.mjs`: dat wijst deze worktree via `scripts/dev-port.mjs` een **vaste** poort toe (verankerd aan de worktree-root, 3007–3106), claimt een guard-slot via `scripts/dev-lock.mjs` zodat een tweede start in dezelfde worktree wordt geweigerd in plaats van stilletjes een andere poort te pakken, stempelt `.claude/launch.json` met die poort (zodat `preview_start` meteen de juiste worktree opent), en spawnt dan pas Vite. `tauri:dev` (`scripts/tauri-dev.mjs`) doet hetzelfde en start `tauri dev` met een matchende `--config` `devUrl` plus `OPS_DEV_PORT`/`OPS_DEV_INSTANCE`/`OPS_DEV_GUARDED` in de env (de geneste `dev`-start slaat de toewijzing dan over). Zo kunnen **meerdere worktrees hun dev- en desktopbuild tegelijk draaien** — elk met een eigen poort (het venster laadt nooit de Vite van een andere worktree) en eigen `recovery.<slug>.*`-auto-save-bestanden (concurrent instanties overschrijven elkaar niet in de gedeelde `appDataDir`). `vite.config.ts` leest `OPS_DEV_PORT` met `strictPort` — dat is de harde backstop: twee worktrees op dezelfde poort geeft EADDRINUSE in plaats van een verkeerde build. `App.tsx` leest de slug via de `__OPS_DEV_INSTANCE__`-define. De regressietests hiervoor staan in `tests/dev-server/`.
