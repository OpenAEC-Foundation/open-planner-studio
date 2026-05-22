# OpenAEC Stylebook Alignment — Design

**Datum:** 2026-05-04
**Status:** Concept, ter review
**Scope:** B (foundation + componenten) + hybride File-tab/Backstage

## 1. Context

Open Planner Studio (OPS) is een Tauri + React + Tailwind v4 desktop-app voor projectplanning. De OpenAEC Foundation publiceert een stylebook (`OpenAEC-style-book/brandbook/`) met tokens, componentspecs en layout-templates. OPS draait al gedeeltelijk op de juiste merkkleuren (Construction Amber + Deep Forge in het `default` thema), maar wijkt af op:

- Lettertypen (system stack i.p.v. Space Grotesk / Inter / JetBrains Mono).
- Onvolledige tokenset (secundaire en dashboard-tokens ontbreken).
- Inconsistente componentstijlen (radii, padding, focus states).
- Hardcoded kleuren op meerdere plekken (Ribbon primary groen `#22c55e`, StatusBar yellow, DebugTerminal grijs-paneel).
- 7 thema's waarvan 5 niet on-brand.
- Ontbrekende File-tab / Backstage view (Office-paradigma) — kleurtokens zijn voorbereid maar het component is nooit gebouwd.

Deze spec beschrijft een gerichte herziening die OPS visueel uniform maakt met de OpenAEC stylebook, zonder de Gantt-engine, CPM-logica of IFC-functionaliteit aan te raken.

## 2. Beslissingen

| Beslissing | Keuze |
|---|---|
| Scope | **B**: foundation (tokens + fonts) + componenten naar stylebook §3 specs, plus hybride File-tab/Backstage |
| Thema's | **3** behouden: Dark (default), Light, High Contrast — andere 4 vervallen |
| Lettertypen | **Zelf gehost** in `public/fonts/` (offline-werkend desktop) |
| File-tab | **Hybride**: amber File-tab opent volledig Backstage scherm; Start-tab houdt zijn bestaande Bestand-groep |

## 3. Out-of-scope (expliciet)

Het volgende valt buiten deze spec en is voor een latere ronde:

- OpenAEC-logo in TitleBar.
- Tauri app-icon vervangen (taakbalk, bureaublad, Start menu).
- Splash screen met `background-pattern-dark.svg`.
- Tone-of-voice / herschrijven van labels en foutteksten.
- Ribbon-paradigma vervangen door 40px-toolbar (CAD-stijl).
- Hero-illustraties of decoratieve elementen.
- Mobiele / responsive aanpassingen.
- Diepe accessibility-audit (ARIA, screen-reader). High Contrast thema is het minimum.
- Nieuwe vertalingen — backstage-teksten worden toegevoegd aan de bestaande 14 locale-bestanden.

## 4. Foundation

### 4.1 Design tokens

Alle tokens uit `OpenAEC-style-book/brandbook/DESIGN-SYSTEM.md` §2 worden in `src/styles/globals.css` opgenomen:

**Kleuren (11 brand + 13 dashboard):**
- Primary: `--amber #D97706`, `--deep-forge #36363E`
- Secondary: `--signal-orange #EA580C`, `--warm-gold #F59E0B`, `--scaffold-gray #A1A1AA`
- Backgrounds: `--blueprint-white #FAFAF9`, `--concrete #F5F5F4`, `--night-build #2A2A32`
- Semantic: `--success #16A34A`, `--error #DC2626`, `--info #2563EB`
- Dashboard tokens (dense UI): alle 13 uit §2.5 (`--dashboard-bg`, `--dashboard-surface`, `--dashboard-text`, etc.)

**Spacing schaal:** `--sp-1` (4px) t/m `--sp-24` (96px), op 4px increments.

**Border radius:** `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 12px`, `--radius-full 9999px`.

**Z-index schaal (8 niveaus):** dropdown(10) → sticky(20) → sidebar(30) → navbar(40) → modal-backdrop(50) → modal(60) → toast(70) → tooltip(80).

**Schaduwen:** `--shadow-sm`, `--shadow-md`, `--shadow-lg` per stylebook §2.6.

**Layout-grootte tokens** (per LAYOUTS.md §4.1) — om referentie consistent te houden en ad-hoc pixel-waardes te vermijden:

```
--titlebar-height:   32px
--toolbar-height:    40px
--statusbar-height:  24px
--sidebar-width:     260px
--inspector-width:   280px (default; resizable 220–400px)
```

### 4.2 Lettertypen

Drie open-source families in `public/fonts/`:

- **Space Grotesk** (700, 500) — kopjes, dialog-titels.
- **Inter** (400, 500, 600) — alle UI-tekst, knoppen, labels.
- **JetBrains Mono** (400, 500) — code, debug terminal, paden, kleine technische labels.

`@font-face` declaraties in `globals.css`. Geschatte bundlegrootte: ≈ 300 KB voor alle 6 `.woff2` bestanden.

### 4.3 Hardcoded kleuren wegwerken

| Locatie | Huidig | Wordt |
|---|---|---|
| `Ribbon.css` `.primary` | `#22c55e` (groen) | `--theme-accent` (amber) |
| `Ribbon.css` `.danger` hover | `#ef4444` | `--error` |
| `StatusBar.tsx` "niet opgeslagen" | `text-yellow-500` | `--warm-gold` token |
| `DebugTerminal.tsx` paneel + niveaus | `#111827`, `#9ca3af`, etc. | `--dashboard-bg`, `--dashboard-terminal`, `--dashboard-text-muted` |
| `globals.css` tooltip/toast | `#2e2e42`, `#3e3e55` fallback hexes | tokens, fallbacks weg |
| `tailwind.config.js` task colors | hardcoded hex | verplaatst naar CSS-vars; waardes blijven hetzelfde (functionele kleuren voor type-onderscheid, niet brand-bound) zodat thema's ze later kunnen overschrijven |

**Blijven hardcoded** (geen merk-binding):
- Close-button rood `#e81123` — Windows-conventie.
- Critical path / error-state rood — komt al uit stylebook (`--error #DC2626`), via token.

## 5. Componenten

Implementatie volgt `OpenAEC-style-book/brandbook/DESIGN-SYSTEM.md` §3 exact.

### 5.1 Knoppen — 5 varianten

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `--amber` | wit | geen | bg → `--signal-orange` |
| Secondary | transparant | `--deep-forge` | 2px `--deep-forge` | bg → `--deep-forge`, text → wit |
| Ghost | transparant | `--amber` | 2px `--amber` | bg → `--amber`, text → wit |
| Dark | `--deep-forge` | `--blueprint-white` | geen | bg → `#27272A` |
| Disabled | elke variant | — | — | opacity 0.4, cursor not-allowed |

Maten: small (8/16px padding), default (12/24px), large (16/32px). Alle: `border-radius: 8px`, `transition: all 0.15s ease`.

### 5.2 Inputs

- Padding 12/16px, border 1.5px `#D6D3D1`, radius 8px, font Inter 0.875rem.
- **Focus:** `border-color: --amber`, `box-shadow: 0 0 0 3px rgba(217,119,6,0.15)`.
- **Error:** `border-color: --error`, `box-shadow: 0 0 0 3px rgba(220,38,38,0.15)`.
- Label boven input: 0.875rem, weight 500, margin-bottom 8px.
- Hint-tekst onder: 0.75rem, `--scaffold-gray` (of `--error` bij fout).

### 5.3 Cards / dialogen

- Default: bg wit, border 1px `#E7E5E4`, radius 12px, padding 24px, shadow `--shadow-sm`.
- Featured: border 2px `--amber`.
- Dark: bg `--deep-forge`, border 1px `#27272A`, text `--blueprint-white`.

**Modal-maten:** 400px (klein), 560px (default), 720px (groot). TaskDialog 500→**560px**. SettingsDialog (520×420) verhuist naar Backstage > Instellingen.

**Modal-animaties** (per LAYOUTS.md §3.3):
- Backdrop: `fade-in 0.15s ease` van opacity 0 → 1, achtergrond `rgba(0,0,0,0.5)`.
- Modal-content: `scale-in 0.15s ease` vanaf 95% scale + opacity 0 → 100% scale + opacity 1.

**Modal-toetsenbord:**
- **Esc** sluit de modal (tenzij een input een eigen Esc-handler heeft).
- **Enter** activeert de primaire actie (alleen als de focus niet op een tekstveld ligt).
- **Tab** blijft binnen de modal (focus-trap; sluit niet via Tab door ander UI).

**Confirm-dialog variant** (klein modal, 400px breed) — voor ja/nee bevestigingen zoals "Niet-opgeslagen wijzigingen verloren laten gaan?":
- Cirkel-icoon 48px gecentreerd boven titel:
  - info → `--info` tint (`#EFF6FF`) + `--info` icoon
  - warning → `--amber` tint (`#FEF3C7`) + `--amber` icoon
  - danger → `--error` tint (`#FEE2E2`) + `--error` icoon
- Titel: gecentreerd, Space Grotesk 700, 1.25rem.
- Boodschap: gecentreerd, Inter 400, 0.875rem, `--scaffold-gray`.
- Knoppen: gecentreerd, gap `--sp-3`. Bij destructieve actie: primary knop in `--error` kleurschema.

### 5.4 Tabel (TableEditor)

- Wrapper: border 1px `#E7E5E4`, radius 8px, overflow-x auto.
- Header: bg `--concrete`, border-bottom 2px `#E7E5E4`. Cellen 0.75rem uppercase, letter-spacing 0.05em, color `#57534E`, weight 600.
- Lichaam: cellen padding 12/16px, border-bottom 1px `#F5F5F4`, font 0.875rem.
- Row hover: bg `#FAFAF9`.
- Sticky thead binnen scrollbare TableEditor.

### 5.5 Alerts / toasts — 4 varianten

Padding 16/24px, radius 8px, border-left 4px, font 0.875rem.

| Variant | Background | Border | Text |
|---|---|---|---|
| Info | `#EFF6FF` | `--info` | `#1E40AF` |
| Success | `#F0FDF4` | `--success` | `#166534` |
| Warning | `#FFFBEB` | `--amber` | `#92400E` |
| Error | `#FEF2F2` | `--error` | `#991B1B` |

Vervangt huidige solide rode toast (`gantt-toast`).

### 5.6 Badges — 5 varianten

Font 0.7rem, weight 600, uppercase, letter-spacing 0.05em, padding 0.2/0.6em, radius 9999px.

Varianten: amber, green, red, blue, gray (kleurspecs uit §3.6 stylebook). Te gebruiken voor taakstatus, prioriteit, type — overal waar nu kale tekst staat.

### 5.7 Tags

Font 0.75rem, weight 500, padding 4/12px, radius 9999px, border 1px `#E7E5E4`, color `#57534E`, bg wit. Lichtere variant van badges.

### 5.8 Voortgangsbalken

Track: 8px hoog, bg `#E7E5E4`, radius 9999px. Fill: default `--amber`, success `--success`, danger `--error`, transition `width 0.3s ease`.

### 5.9 Tooltip

Bestaande Gantt-tooltip behoudt structuur. Aanpassingen:
- Font op Inter (was system stack).
- Fallback-hexen weg, alleen tokens.
- Achtergrond `--theme-surface-elevated`, border `--theme-border`.

### 5.10 Code blocks

DebugTerminal en eventuele log-uitvoer:
- Inline code: bg `--concrete`, padding 0.15/0.4em, radius 4px.
- Block code: bg `--night-build`, color `--blueprint-white`, padding 24px, radius 8px, font JetBrains Mono.
- Syntax: comment `--scaffold-gray`, keyword `--warm-gold`, string `#34D399`, function `--amber`.

### 5.11 Ribbon-knoppen

Structuur blijft (icon-boven-label voor groot, horizontaal voor klein). Aanpassingen:
- Primary knop (CPM Calculate) → amber i.p.v. groen.
- Hoek-radii consistent op 4px.
- Hover/active gebruiken dashboard-tokens (`--dashboard-surface-hover`, `--dashboard-accent`).

### 5.12 Inspector panel (TaskPropertiesPanel)

Volgt LAYOUTS.md §3.2 — meer detail dan een gewone card.

- **Breedte:** 280px default, resizable 220–400px (`--inspector-width` token).
- **Achtergrond:** `--concrete` (light) of `--deep-forge` (dark).
- **Linker rand:** 1px solid `#E7E5E4` / `#27272A` (overgang naar canvas).
- **Resize-handle:** zie §6.6.

**Tab-bar bovenin** (tabs zoals "Eigenschappen", "Stijlen"):
- Padding `--sp-2 --sp-4`, font Inter 500, 0.75rem.
- Inactief: kleur `--scaffold-gray`, border-bottom 2px transparant.
- Hover: kleur `--deep-forge` (light) / wit (dark).
- Actief: kleur `--amber`, border-bottom 2px solid `--amber`.

**Sectie binnen panel** (bv. "Algemeen", "Tijd", "Resources"):
- Sectie-header: Inter 600, 0.75rem, uppercase, `--scaffold-gray`, letter-spacing 0.05em. Click-toggleable met 12px pijl.
- Padding `--sp-4`.

**Property-rij** (label + waarde):
- Layout: `grid-template-columns: 90px 1fr`, gap `--sp-2`, align-items center.
- Label: Inter 400, 0.75rem, `--scaffold-gray`, ellipsis bij overlopen.
- Waarde-input: Inter 400, 0.75rem, padding `--sp-1 --sp-2`, transparant bg + border, hover border-color `#E7E5E4`, focus border-color `--amber` + bg wit.

**Speciale input-types:**
- **Getalveld (compact):** breedte 56px, text-align right. **Scrub-gebaar:** sleep horizontaal over het veld om waarde te wijzigen, cursor wordt `ew-resize`.
- **Kleurveld:** 16px×16px swatch + hex-tekst. Klik opent kleurkiezer-popover (z-index `--z-dropdown`).
- **Gekoppelde inputs** (x/y, w/h): ketting-icoon tussen velden — klik om proportioneel bewerken in/uit te schakelen.

**Lege staat** (geen taak geselecteerd):
- Gecentreerd, padding `--sp-8`.
- Icoon 32px, `--scaffold-gray` op 30% opacity.
- Tekst Inter 400, 0.8rem, `--scaffold-gray`: "Selecteer een taak om eigenschappen te zien."

## 6. Layout

### 6.1 File-tab

Nieuwe leftmost tab in Ribbon, geactiveerd via bestaande `--theme-file-tab-bg` en `--theme-file-tab-hover` tokens (per thema):

- Dark: `#D97706` bg, `#EA580C` hover.
- Light: `#D97706` bg, hover variant.
- High Contrast: `#FFFF00` bg, `#FFCC00` hover.

Witte tekst, weight 700, `border-radius: 3px 3px 0 0`. Visueel duidelijk anders dan reguliere tabs.

### 6.2 Backstage scherm

Activatie: klik op File-tab vervangt Ribbon-content + Canvas met een full-area Backstage view. Sluiten: klik op `← Terug`, druk Esc, of klik op een andere tab.

Layout:
- Linker zijbalk 220px breed, bg `--dashboard-sidebar` (#222228 dark / wit light), bevat lijst met items.
- Hoofdgebied bg `--dashboard-surface`, padding 32/40px.

**Items in zijbalk:**

| Item | Type | Gedrag |
|---|---|---|
| Nieuw | actie | Maakt leeg project (bevestiging als huidige niet opgeslagen). Sluit Backstage. |
| Openen | actie | Triggert systeem file-picker. Sluit Backstage na keuze. |
| Recent | scherm | Lijst recente projecten met thumbnail, naam, metadata, pad. |
| Opslaan | actie | Slaat naar huidig pad. Bij geen pad → Opslaan als. Sluit Backstage. |
| Opslaan als | actie | Triggert systeem save-dialog. |
| **(separator)** | | |
| Exporteren | scherm | 4 keuzekaarten: CSV, MS Project XML, Primavera P6 XML, IFC 4x3. |
| Printen | scherm | Verplaatst van Beeld-tab. Print-preview met opties. |
| **(separator)** | | |
| Project info | scherm | Read-only metadata + "Bewerk"-knop. Vervangt huidige modal. |
| Instellingen | scherm | Thema, taal, zoom-instellingen. Vervangt huidige modal. |
| **(separator)** | | |
| Sluit project | actie | Sluit huidig project, app blijft open met leeg startscherm. |

### 6.3 Layout-correcties

- TitleBar: 30 → **32 px** (LAYOUTS.md §3.1).
- StatusBar: 28 → **24 px** (LAYOUTS.md §3.1).
- Min window size: 1024×600 (al on-spec).

### 6.4 Gradient strip

Een 2px-hoge horizontale streep direct onder de Ribbon-content (tussen Ribbon en Canvas), altijd zichtbaar — ook wanneer Backstage actief is, zodat de positie consistent blijft. Kleur: `linear-gradient(90deg, #D97706 0%, #F59E0B 40%, #EA580C 100%)`. Subtiel merk-accent dat in alle OpenAEC tools/documenten terugkomt.

### 6.5 Wat behouden blijft in layout

- Ribbon-structuur (tabs Start/Planning/Beeld/Instellingen/Table/IFC/Report).
- Start-tab Bestand-groep met Nieuw/Save/Open/SaveAs/Recent/Export — exact zoals nu.
- TitleBar quick-access toolbar met New/Open/Save/Undo/Redo/Settings.
- TableEditor / IFCPanel / ReportPanel waar ze zijn.
- TaskDialog blijft een modal (hoort bij canvas-workflow).

### 6.6 Resize-handle

Tussen het canvas en de Inspector-panel (en eventuele andere resizable boundaries):
- Breedte: 4px.
- Cursor: `col-resize`.
- Standaard: transparant.
- Hover: 2px-brede `--amber` strook gecentreerd in het 4px-gebied (subtiele indicatie).
- Active drag: dezelfde 2px amber-strook + body cursor blijft `col-resize`.

## 7. Thema's

### 7.1 Drie thema's

| Thema | Doel | Tokens |
|---|---|---|
| **Dark** (default) | Primair OpenAEC dashboard | bg `--night-build`, surface `--deep-forge`, text `--blueprint-white`, accent `--amber` |
| **Light** | Stylebook light variant | bg `--blueprint-white`, surface `#fff` / `--concrete`, text `--deep-forge`, accent `--amber` |
| **High Contrast** | Toegankelijkheid (WCAG AAA) | bg `#000`, text `#fff`, accent `#FFFF00`, borders `#fff` |

Themas worden geïmplementeerd via `data-theme="dark|light|high-contrast"` op `<html>` (bestaand mechanisme behouden, alleen waardes hernoemd).

### 7.2 Migratie

Bij eerste opstart na update wordt de opgeslagen thema-keuze éénmalig geconverteerd:

| Bestaand | Wordt |
|---|---|
| `default` | `dark` |
| `light` | `light` |
| `highContrast` | `high-contrast` |
| `dark` | `dark` (vorige magenta-versie verdwijnt) |
| `blue` | `dark` |
| `amber-navy` | `dark` |
| `warm-ember` | `dark` |

Gebruikers van een verdwenen thema krijgen optioneel een eenmalige melding: "Je thema is bijgewerkt naar Dark."

### 7.3 Theme picker

- Verplaatst van huidige modal naar **Backstage > Instellingen**.
- Drie kaarten naast elkaar met live-preview swatches.
- Klik wisselt direct (geen herstart). Opgeslagen via `@tauri-apps/plugin-store`.

## 8. Implementatieplan

7 fasen, sequentieel. Elke fase eindigt met een commit en een testbare app-staat.

| Fase | Inhoud | Schatting |
|---|---|---|
| 1 | Lettertypen + token-set in globals.css | ½ dag |
| 2 | Thema-reductie 7→3 + migratie | ½ dag |
| 3 | Hardcoded kleuren wegwerken | ½ dag |
| 4 | Componenten restylen (knoppen, inputs, dialogs, tabel, alerts, badges, tags, progress, tooltip) | 1 dag |
| 5 | Layout-correcties (titlebar/statusbar hoogtes, gradient strip) | ¼ dag |
| 6 | File-tab + Backstage scherm + sub-schermen | 1½ – 2 dagen |
| 7 | Polish: WCAG-contrastcheck, end-to-end doorloop, RTL-test | ½ dag |

**Totaal:** ≈ 5 dagen, ≈ 1500–2500 toegevoegde regels netto (waarvan ≈ 40% reuse, ≈ 30% CSS, ≈ 30% nieuwe componentcode).

## 9. Risico's en mitigatie

| Risico | Mitigatie |
|---|---|
| Bestaande functionaliteit (Gantt, CPM, IFC) breekt | Engine-code wordt niet aangeraakt. Alleen visuele lagen wijzigen. |
| Gebruiker raakt zijn thema-keuze kwijt | Migratie-mapping converteert eenmalig + optionele melding. |
| Onverwachte regressies in 14 locales | Backstage-teksten toegevoegd aan alle locale-bestanden tegelijk; bestaande keys onveranderd. |
| Layout-shifts door pixel-correcties (30→32px, 28→24px) | Klein verschil, getest in alle 3 thema's. |
| Performance van zelf-gehoste fonts | `.woff2` formaat, `font-display: swap`, totaal ≈ 300 KB. |
| Backstage opent bij verkeerde state (bv. tijdens drag-drop) | State-store beheert dit; backstage blokkeert niet, kan altijd dicht via Esc. |

## 10. Open vragen

Geen op moment van schrijven. Alle keuzes zijn vastgelegd in §2.

## 11. Referenties

- `OpenAEC-style-book/brandbook/DESIGN-SYSTEM.md` — token + componentspecs (§2, §3).
- `OpenAEC-style-book/brandbook/LAYOUTS.md` — desktop-app layouts (§3).
- `src/styles/globals.css` — huidige theme-tokens.
- `src/components/layout/Ribbon/Ribbon.tsx` + `Ribbon.css` — huidige Ribbon-implementatie.
- `src/components/dialogs/SettingsDialog.tsx` + `.css` — bestaande settings-modal die naar backstage verplaatst.
