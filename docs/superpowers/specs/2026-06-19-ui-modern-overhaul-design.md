# UI Modern Overhaul — Design Spec

**Datum:** 2026-06-19
**Branch/worktree:** `overhaul-ui-to-modern-look`
**Status:** goedgekeurd (richting + contrast-optie A), klaar voor implementatieplan.

## 1. Doel & niet-doelen

**Doel:** een volledige *visuele* overhaul zodat de echte app exact aanvoelt als prototype v2
(richting **"Polished Forge + Soft Depth"**, koele neutralen). Het moet de reactie oproepen:
"wauw, dit lijkt precies op de browser-prototypes."

**Harde niet-doelen (guardrails):**
- **Geen enkele knop, control of paneel verandert van plaats.** Geen herordening, geen
  verplaatsing, geen andere informatie-architectuur. Alleen *uiterlijk*: kleur, rand, ronding,
  schaduw, achtergrond, typografie, en — uitsluitend als onderdeel van het zwevende-kaarten-model —
  krappe kaartmarges/gaps. Layout-breedtes (bv. `rightPanelWidth`), collapse-gedrag, tab-volgorde,
  ribbon-groepen en hun knoppen blijven 1-op-1.
- **Alle 3 thema's blijven werken:** `light`, `dark`, `high-contrast`.
- **WCAG AA blijft intact (keuze A):** control-randen ≥3:1, tekst ≥4.5:1, accent-als-tekst AA,
  zichtbare focus-ring. (Eerder bewust in geïnvesteerd; niet weggeven.)
- **`tsc --noEmit` blijft groen.** Geen test-runner; build-typecheck is de enige statische gate.

**Referentie-artefacten** (in deze worktree, niet in git — `.superpowers/` is gitignored):
`.superpowers/brainstorm/44101-1781878753/content/prototype-v2.html` (3 schermen: hoofdvenster ·
Instellingen-dialoog · dark), plus `blend.html`, `calc-studio-aligned.html`, `contrast-options.html`.
Sibling-ijkpunt: **Open Calc Studio** (`OpenAEC-Foundation/open-calc-studio`, `src/styles/themes.css`)
— deelt dezelfde amber/forge-identiteit; wij voeren die even grondig uit.

## 2. Designprincipes

1. **Identiteit blijft amber/forge** (Construction Amber + Deep Forge), zoals Calc Studio.
2. **Koele neutralen** i.p.v. de huidige warme beige — werkruimte loopt naar slate-grijs.
3. **Soft Depth:** vaste lichte *chrome* bovenin (titelbalk + ribbon als één geheel), daaronder een
   licht **getinte werkruimte** waarop panelen als **zwevende witte kaarten** liggen met zachte
   schaduw en 12px hoeken.
4. **Schoon, geen rare gradients:** titelbalk/ribbon-gradients afvlakken naar effen vlakken.
5. **Consistente ronding:** kaarten 12px, controls 8px, pills 999px — geen vierkante uitschieters
   meer (o.a. Settings-dialoog rond maken).
6. **Echte fonts:** Inter (body) + Space Grotesk (koppen/labels) — al geladen via `@fontsource`.

## 3. Design tokens (bron: `src/styles/globals.css`)

Bestaande `--theme-*` namen blijven bestaan (canvas + CSS lezen ze); we hertunen hun *waarden* en
voegen een paar nieuwe toe. Tailwind `@theme`-mapping ongewijzigd laten.

### 3.1 Nieuwe primitives (`:root`)
```
--radius-sm: 6px;  --radius-md: 8px;  --radius-lg: 12px;  --radius-full: 9999px;
/* schaduwen per thema gedefinieerd: --shadow-card, --shadow-pop, --shadow-glow */
```
`--font-heading`/`--font-body`/`--sp-*` ongewijzigd. Voeg `@fontsource/inter/700.css` toe in
`main.tsx` (bold Inter ontbreekt nu).

### 3.2 LIGHT — koel + contrast-optie A
| token | waarde | rol |
|---|---|---|
| `--theme-bg` | `#E6EAF0` | **werkruimte-tint** (achter de kaarten) |
| `--theme-surface` | `#FFFFFF` | kaart/paneel/chrome |
| `--theme-surface-alt` | `#F6F8FB` | secundair vlak (ribbon-tabstrip, statusbalk, read-only velden) |
| `--theme-surface-elevated` | `#FFFFFF` | popovers/dropdowns |
| `--theme-border` | `#E2E7EE` | **zachte** kaart-/scheidingsrand |
| `--theme-border-light` | `#EDF0F5` | nog zachtere divider |
| `--theme-control-border` *(nieuw)* | `#8C94A2` | **rand van inputs/selects/knoppen (~3:1, AA)** |
| `--theme-accent` | `#B45309` | amber, AA-veilig als tekst én als bg-onder-witte-tekst |
| `--theme-accent-hover` | `#9A3412` | |
| `--theme-accent-on` | `#FFFFFF` | tekst op accent |
| `--theme-text` | `#333845` | primaire tekst (koeler dan forge) |
| `--theme-text-dim` | `#5B6472` | secundair |
| `--theme-text-muted` | `#6B7280` | labels (AA ~4.6:1) |
| `--theme-hover` | `rgba(99,110,130,0.10)` | neutrale hover |
| `--theme-active` / `--theme-active-border` | `#B45309` / `#9A3412` | |
| `--theme-warning-text` | `#946200` | (AA, ongewijzigd) |
| `--theme-grid-weekend` | `#EFF2F7` | koele weekendband |
| `--theme-bar-float` | `#059669` | float-balk (graphical ≥3:1) |
| `--theme-critical-text` | `#D12020` | (AA, ongewijzigd) |
| `--theme-input-bg` / `--theme-dropdown-bg` | `#FFFFFF` | |
| `--theme-scrollbar-track` / `--theme-scrollbar-thumb` | `#E6EAF0` / `#C2CAD6` | koel |
| `--theme-ribbon-bg` | `#FFFFFF` (effen) | gradient verwijderd |
| `--theme-ribbon-tab-bg` | `#F6F8FB` (effen) | |
| `--theme-ribbon-content-bg` | `#FFFFFF` | |
| `--theme-file-tab-bg` / `--theme-file-tab-hover` | `#B45309` / `#9A3412` | |
| `--theme-titlebar-bg` | `#FFFFFF` (effen) | gradient verwijderd; titelbalk licht |
| `--theme-titlebar-btn-hover` / `-active` | `rgba(99,110,130,0.10)` / `0.16` | |
| `--shadow-card` | `0 1px 2px rgba(40,48,64,.06), 0 6px 18px rgba(40,48,64,.08)` | kaarten |
| `--shadow-pop` | `0 8px 28px rgba(40,48,64,.18)` | dialogen/popovers |
| `--shadow-glow` | `0 2px 10px rgba(217,119,6,.40)` | primaire knop |

### 3.3 DARK — koeler charcoal (uit prototype)
`--theme-bg #1B1D22` · `--theme-surface #2E3239` · `--theme-surface-alt #23262D` ·
`--theme-surface-elevated #363B43` · `--theme-border #3A3F48` · `--theme-border-light #33373F` ·
`--theme-control-border #4A515C` · accent `#D97706`/`#EA580C` · `--theme-accent-on #FFFFFF` ·
text `#F1F3F5` / dim `#B6BCC6` / muted `#7C8492` · `--theme-hover rgba(255,255,255,0.06)` ·
`--theme-grid-weekend rgba(255,255,255,0.035)` · `--theme-bar-float #10B981` ·
`--theme-critical-text #F87171` · input-bg `#23262D` / dropdown `#2E3239` ·
scrollbar `#23262D`/`#454B55` · ribbon-bg `#2A2D34` (effen) / tab `#23262D` / content `#2A2D34` ·
file-tab `#D97706`/`#EA580C` · titlebar-bg `#2A2D34` (effen) · titlebar-btn-hover/active
`rgba(255,255,255,0.07)`/`0.12` · `--shadow-card 0 1px 2px rgba(0,0,0,.30), 0 6px 18px rgba(0,0,0,.35)` ·
`--shadow-pop 0 10px 30px rgba(0,0,0,.50)` · `--shadow-glow` zelfde amber.

### 3.4 HIGH-CONTRAST — ongewijzigd van karakter
Behoud zwart/geel + witte randen (AAA). Voeg alleen de nieuwe tokens toe zodat de structurele CSS
niet breekt: `--theme-bg #000000` (werkruimte) · `--theme-surface #0a0a0a` (kaart) ·
`--theme-control-border #ffffff` · `--shadow-card/pop none` (geen schaduw op zwart) · `--shadow-glow none`.

## 4. Het zwevende-kaarten-model (zonder iets te verplaatsen)

Huidige layout (`src/App.tsx`): root `flex flex-col` → `<TitleBar/>` → `<Ribbon/>` →
`<Backstage/>` (conditioneel) → `.brand-accent-strip` → `div.flex.flex-1.overflow-hidden`
(links contentgebied + `<GanttCanvas/>`; rechts collapse-toggle **of** paneel met header +
`<TaskPropertiesPanel/>` + `<DebugTerminal/>`) → `<StatusBar/>`.

**Aanpak:** de werkgebied-container (`flex flex-1`) krijgt `background: var(--theme-bg)` (tint) +
krappe padding/gap (≈10px). De **GanttCanvas-wrapper** en het **rechterpaneel** krijgen
kaart-chrome: `background: var(--theme-surface)`, `border-radius: var(--radius-lg)`,
`box-shadow: var(--shadow-card)`, zachte rand. Breedtes (`rightPanelWidth`, `minWidth`), de
collapse-knop en alle inhoud blijven exact. De linker WBS/Taaknaam/Duur-kolommen zitten ín de
canvas → Gantt + tabel = samen één kaart. De `brand-accent-strip` blijft (mag dunner/subtieler).

> Dit is de enige plek waar "uiterlijk" een paar pixels spacing toevoegt. Het is de door de
> gebruiker goedgekeurde kaarten-look; géén control verschuift t.o.v. een andere.

## 5. Per-surface checklist (uitsluitend visueel)

1. **`globals.css`** — 3 thema-blokken hertunen (§3), nieuwe tokens, gradients→effen, radius,
   schaduw-tokens. Utility-classes `.btn`/`.input`/`.alert`/`.badge` op `--theme-control-border`
   + `--radius-md` + amber focus-ring (`box-shadow 0 0 0 3px rgba(217,119,6,.20)`). Scrollbars koel.
2. **`main.tsx`** — `@fontsource/inter/700.css` toevoegen.
3. **TitleBar** (`TitleBar.css`) — volgt tokens automatisch (licht in light). Quick-access knoppen
   `--radius-md`, koele hover. Close-knop houdt rood (`#e81123`).
4. **Ribbon** (`Ribbon.css`) — effen bg, zachte randen, file-tab amber (boven afgerond),
   ribbon-knoppen 8px + koele hover, **groepslabels** muted + Space Grotesk small-caps, actieve
   knop amber-tint. Knoppen/groepen/volgorde ongewijzigd.
5. **Werkgebied + GanttCanvas-wrapper** (`App.tsx`) — kaart-model §4. Geen structuurwijziging
   behalve kaart-chrome + tint + gap.
6. **GanttRenderer** (`src/engine/renderer/GanttRenderer.ts`) — `getThemeColors()` op nieuwe tokens:
   canvas-bg uit `--theme-surface` (wit, niet `--theme-bg`), koele rasterlijnen/weekendband,
   **afgeronde balk-rechthoeken** (~3–4px radius), behoud functionele kleuren (normaal `#2563EB`,
   kritiek `#DC2626`, mijlpaal `#7C3AED`, float `--theme-bar-float`, vandaag = amber gestreept).
   Balktekst wit blijft (contrast op gekleurde balken OK). Geen layout/hit-test-wijziging.
7. **Rechterpaneel / `TaskPropertiesPanel`** — kaart; inputs via nieuwe `.input`; "Toepassen" amber.
8. **`TableEditor` / `IFCPanel` / `ReportPanel`** — erven kaart + input-stijl; consistent koel.
9. **Dialogen** — `SettingsDialog.css` (rond maken: `border-radius var(--radius-lg)`, ronde tabs/
   knoppen/sluit-X, `--shadow-pop`), `Modal.css`, `TaskDialog`, `CalendarDialog`, `Select.css`:
   control-border + radius + focus-ring; ronde modals + pop-schaduw.
10. **Backstage** (`Backstage.css`) + **ExtensionManagerPanel.css** — koele tokens, zachte randen,
    afgeronde kaarten.
11. **StatusBar** — `--theme-surface-alt`, zachte bovenrand.
12. **DebugTerminal** + **toasts** (`globals.css`) — koele tokens, ronde toasts + pop-schaduw.

## 6. Uitrol-plan (subagents)

**Fase 1 — fundament (sequentieel, alleen dit raakt `globals.css`/`main.tsx`):** tokens + utility-
classes + font. Build + screenshot-check. Alles hangt hieraan → eerst, alleen.

**Fase 2 — parallelle subagents (elk eigen bestanden, geen overlap):**
- **A. Chrome:** Ribbon + TitleBar + StatusBar.
- **B. Werkgebied-kaarten:** `App.tsx` + GanttCanvas-wrapper + rechterpaneel-chrome.
- **C. Canvas:** `GanttRenderer.ts` (kleuren + afgeronde balken).
- **D. Dialogen:** SettingsDialog + Modal + TaskDialog + CalendarDialog + Select.
- **E. Backstage:** Backstage + ExtensionManagerPanel + DebugTerminal.
- **F. Panelen:** TaskPropertiesPanel + TableEditor + IFCPanel + ReportPanel.

Elke subagent krijgt: deze spec, "visueel-only, niets verplaatsen", en moet `tsc --noEmit` groen
houden. Bestands-eigenaarschap is disjunct → geen merge-conflicten. (Alleen `App.tsx` = agent B.)

**Fase 3 — integratie & QA (ik):** Playwright-screenshots van light + dark hoofdvenster,
Settings-dialoog en Backstage; vergelijken met `prototype-v2`-screenshots; naden bijwerken;
`npm run build` groen; visuele AA-check.

## 7. Verificatie (acceptatie)

- [ ] `npm run build` (tsc + vite) groen.
- [ ] Light hoofdvenster ≈ prototype v2 (koele tint, zwevende kaarten, amber, Space Grotesk-koppen).
- [ ] Dark hoofdvenster ≈ prototype dark.
- [ ] Settings-dialoog rond + modern (niet meer vierkant).
- [ ] High-contrast nog werkend.
- [ ] Geen control/knop verschoven t.o.v. `main` (visuele diff van posities).
- [ ] WCAG AA steekproef: control-randen ≥3:1, tekst ≥4.5:1, focus-ring zichtbaar.
