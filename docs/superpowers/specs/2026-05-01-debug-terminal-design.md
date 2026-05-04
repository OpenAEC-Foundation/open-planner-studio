# Debug Terminal Overlay — Design

**Status:** Approved (brainstorm)
**Date:** 2026-05-01

## Doel

Een kleine debug-overlay onderaan de rechterkolom, onder het Eigenschappen-paneel, die `console.*` output én interne app-events in één feed laat zien. Bedoeld voor ontwikkelaars en gebruikers die incidenteel onder de motorkap willen kijken (bv. om te zien waarom auto-save faalt).

## Scope

In scope:
- Capturen van `console.log/info/warn/error` via monkey-patch.
- Capturen van `window.error` en `unhandledrejection`.
- Een `appLog.emit(level, channel, ...args)` helper voor expliciete app-events (bv. "task X gewijzigd", "IFC geladen").
- Read-only UI: feed weergeven, auto-scroll, level-filter, clear, pauze, sluiten.
- Settings-toggle om de hele feature uit te zetten (StatusBar-knop verdwijnt dan ook).

Out of scope (YAGNI):
- Interactieve REPL / commando-input.
- Persistente log-bestanden op disk.
- Externe transport (Sentry, remote logging).
- Resizable hoogte (vaste 200px).
- Floating overlay-modus.

## Layout & gedrag

- Vaste hoogte **200px**, onderaan de rechterkolom (onder `TaskPropertiesPanel`).
- Eigenschappen-paneel krimpt erboven mee (flex layout).
- Zichtbaarheid is product van vier voorwaarden — alleen rendering als **alle** waar zijn:
  1. `ui.debugTerminalEnabled` (gepersisteerde setting, default `false`).
  2. `ui.debugTerminalOpen` (sessie-state, default `false`, getoggeld via StatusBar-knop).
  3. `ui.rightPanelCollapsed === false` (rechterkolom uitgeklapt).
  4. `isFullPanel === false` (Gantt-view actief; bij Table/IFC/Report-tabs is er geen rechterkolom).
- Wanneer `debugTerminalEnabled` op `false` wordt gezet, wordt `debugTerminalOpen` ook geforceerd op `false` en verdwijnt de StatusBar-knop.

## UI

- Mono-font, donkere achtergrond ongeacht app-thema (klassieke terminal-look). Geen extra theming-werk.
- **Toolbar** bovenin (24–28px hoog):
  - Level-filter chips: `log` `info` `warn` `error` `event`. Klik = toggelen; alleen aangevinkte levels worden getoond.
  - Pauze-knop (stopt UI-updates; buffer blijft vullen).
  - Clear-knop (leegt buffer).
  - Close-knop (zet `debugTerminalOpen=false`).
- **Feed-lijst** onder de toolbar:
  - Eén regel per entry: `HH:MM:SS [level/channel] message`.
  - Kleuren: `log`=text-secondary, `info`=blauw, `warn`=geel, `error`=rood, `event`=cyaan.
  - Multi-arg console-calls worden samengevoegd zoals devtools dat doet (objects via `JSON.stringify` met fallback voor circulars; Errors tonen `.message` + eerste 3 stackframes).
  - Auto-scroll naar onder, tenzij user >40px naar boven heeft gescrolld (sticky-bottom heuristiek). Dan verschijnt een "↓ N nieuwe regels"-knop bovenaan de lijst.

## Architectuur

### `src/services/debug/appLog.ts` (nieuw)

Single source of truth voor de log-buffer. Geen React-afhankelijkheid.

```ts
type Level = 'log' | 'info' | 'warn' | 'error' | 'event';
interface LogEntry { id: number; ts: number; level: Level; channel?: string; text: string; }

export const appLog = {
  init(): void,                    // patcht console.*, window.error, unhandledrejection
  emit(level: Level, channel: string | undefined, ...args: unknown[]): void,
  subscribe(fn: (entries: LogEntry[]) => void): () => void,
  snapshot(): LogEntry[],
  clear(): void,
}
```

- Ring buffer cap **500** entries; oudste valt eruit.
- Originele console-methodes blijven werken (de patch roept ze door, anders zien ontwikkelaars niets in echte devtools).
- `emit` met level `'event'` wordt gebruikt voor interne app-events; `channel` is een vrij string-label (`"ifc"`, `"autosave"`, …).
- Idempotent: `init()` mag meermaals aangeroepen worden (no-op na de eerste).

### `src/state/appStore.ts` — nieuwe UI-velden

```ts
ui: {
  …,
  debugTerminalEnabled: boolean;  // gepersisteerd
  debugTerminalOpen: boolean;     // sessie
}
```

Setter `setUI` werkt al generiek; geen aparte action nodig. Wanneer `debugTerminalEnabled` naar `false` gaat, moet `debugTerminalOpen` in dezelfde update naar `false` (afdwingen in een dunne wrapper of in `SettingsDialog`).

### `src/utils/settingsStore.ts` — persist nieuwe key

`debugTerminalEnabled` mee laten lopen in dezelfde Tauri store waar zoom/theme al in zitten. Default `false` als de key ontbreekt. Laadflow gelijk aan `loadZoomSettings()`.

### `src/components/panels/DebugTerminal.tsx` (nieuw)

- Subscribed op `appLog.subscribe` via `useSyncExternalStore` (geen onnodige Zustand-coupling — de log-buffer leeft buiten de store, want we willen 'm vóór React-init kunnen vullen).
- Eigen lokale state voor: filter-chips, paused-flag, sticky-bottom-flag, scroll-ref.
- Memoized filtered list.

### `src/components/dialogs/SettingsDialog.tsx`

Eén extra checkbox / toggle "Debug terminal inschakelen" onder een (eventueel nieuwe) "Geavanceerd"-sectie. Bindt aan `ui.debugTerminalEnabled` + persist-call.

### `src/components/layout/StatusBar/…`

Knopje (terminal-icoon uit `lucide-react`, bv. `Terminal`) rechts in de StatusBar, alleen gerenderd als `debugTerminalEnabled === true`. Klik toggelt `debugTerminalOpen`.

### `src/main.tsx`

`appLog.init()` aanroepen **vóór** `createRoot(...).render(...)` zodat vroege module-load-errors ook in de buffer landen.

### `src/App.tsx`

Render-conditie in de rechterkolom-tak (de uitgeklapte versie, regel ~157):

```tsx
<div className="flex-1 overflow-y-auto">
  <TaskPropertiesPanel />
</div>
{debugTerminalEnabled && debugTerminalOpen && <DebugTerminal />}
```

Met `DebugTerminal` zelf op `flex-shrink-0` + `height: 200`.

## Data flow

```
console.log(...)  ─┐
console.error(...) ├─► (monkey-patched)
window.onerror     │        │
unhandledrejection ┘        ▼
appLog.emit('event','ifc',…)► appLog buffer (ring 500)
                                  │
                                  ├─► subscribe (useSyncExternalStore) ─► DebugTerminal UI
                                  └─► snapshot() voor initial render
```

UI-state (open/enabled/filter) loopt los via Zustand zoals nu.

## Error handling

- `appLog.init()` mag nooit throw'en; bij faal valt de app terug op de echte console.
- Stringification met try/catch om circular refs op te vangen → fallback `[unserializable]`.
- `subscribe`-callbacks worden in een try/catch uitgevoerd zodat één kapotte listener niet de feed blokkeert.

## Testing

Geen test-suite in dit project op dit moment, dus visueel:
- Trigger `console.error('test')` vanuit de devtools → moet rood verschijnen in de terminal.
- Forceer een auto-save fout (recovery flow) → `console.error('Auto-save failed:', err)` moet zichtbaar zijn.
- Zet de toggle in settings uit → StatusBar-knop weg, paneel weg, daarna weer aan → knop terug, paneel staat dicht.
- Herstart de app → `debugTerminalEnabled` blijft, `debugTerminalOpen` reset naar `false`.

## Open punten

Geen.
