# OPS naar de OpenAEC Style Repo: iconen en thema's

Status: **in uitvoering**, gestart 2026-10-23 (opdracht eigenaar). Dit document is het *waarom* en de route;
de code en de poorten in CI zijn leidend zodra ze er zijn.

## Opdracht

Open Planner Studio krijgt de huisstijl 0.4 van de OpenAEC Foundation uit de
[Style Repo](https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo), de bron van waarheid voor alle
OpenAEC-apps (besluit in die repo, 2026-10-16). Volgorde van de eigenaar: **eerst alle iconen, dan de
thema's**. Randvoorwaarden:

- OPS blijft er goed uitzien en alles blijft werken zoals het hoort; `main` blijft releasebaar.
- Wat in de Style Repo vreemd is of niet werkt, gaat als issue of generieke PR naar de Style Repo;
  OPS-specifieke zaken komen daar nooit terecht.
- Geen Node op deze server: de generatoren zijn Python, de controle loopt in CI.

## Wat de Style Repo levert

| onderdeel | bron | vorm |
|---|---|---|
| Tokens 0.4 | `design/ontwerp-0.4/tokens-0.4.json` | gegenereerd `web/openaec-tokens.css`: `--oa-*`, `data-oa-theme`, vijf thema's (`light`, `dark`, `blueprint`, `high-contrast-dark`, `high-contrast-light`), instellingen `data-oa-workspace` (`theme`/`light`/`dark`) en `data-oa-statusbar` (`theme`/`dark`) |
| Componenten | `web/openaec-components.css` | o.a. `.oa-icon` (16 px, `--icon-accent: var(--oa-accent-text)`), `.oa-icon--24`, `.oa-icon--mono` |
| Iconen | `design/icon-set-b2/manifest.json` (B2-familie, revisie 106) | 945 iconen met een 16- en een 24 px-master; 262 zijn kandidaat voor Planner, 148 daarvan wijzen met `source_example` naar een concrete OPS-knop |
| Ontwerpbesluiten | `design/ontwerp-0.4/01-fundament.md`, `04-componenten.md` | lintknop groot 56×66 met icoon 22 px, klein 22 px hoog met icoon 16 px; icoonknop 28 px (20 in paneelkop) met icoon 16 px; één betekenis per icoon |

**Eén betekenis per icoon.** De B2-set is per *functie* getekend, niet per vorm. Een `Plus` uit lucide
is in OPS dus niet één icoon maar `task.add`, `resource.new`, `calendar.holiday-add`, `planning.code-type-add`
enzovoort. De koppeling gebeurt daarom per gebruiksplek (500 plekken in 85 bestanden), met de 148
bronvoorbeelden van de Style Repo als basis en de B2-`meaning` als toets voor de rest.

## Fase A: iconen

### Vorm van de iconen in OPS

De SVG-export van de Style Repo bestaat uit gesamplede, gevulde contouren (~15 KB per icoon, 7,8 MB voor
de 262 Planner-iconen per maat). Dat is onbruikbaar zwaar voor een webbundel. De `construction` in het
manifest is echter de echte bron: polylijnen met lijndikte (1,25 px bij 16, 1,75 bij 24), hoekafronding
(kwadratische bogen), cirkels en vlakken. Een stroke-gebaseerde SVG met ronde kappen en verbindingen is
daar meetkundig gelijk aan (de export is letterlijk `buffer(width/2, round, round)` van diezelfde lijnen)
en is ~50× kleiner.

- `scripts/style-icons.py` (Python 3, geen afhankelijkheden) leest een Style Repo-checkout op een
  vastgepinde commit, bouwt per icoon en maat de compacte paden en schrijft
  `src/components/icons/b2/icons.generated.ts` plus `b2.lock.json` (commit, B2-revisie, hashes).
  `--check` faalt als het gegenereerde bestand niet meer bij de gepinde bron hoort.
- Uitzonderingen die de stroke-vorm niet kan: `clear_primary` (halo rond het accent; in de Planner-set
  `file.save-as` en `annotate.clear-all`) en de vier `rounded_joint`-iconen (`edit.undo`, `edit.redo`,
  `nav.back`, `nav.forward`). Die krijgen de verliesvrije gevulde export, afgerond op twee decimalen.
- Tekenvolgorde volgt `paint_order` (achterste kleur eerst); `whole_icon_accent` zet `color` op het accent.
- De set in OPS = alle Planner-kandidaten plus de algemene iconen die OPS verder nodig heeft
  (`ui.close`, `status.info`, …), opgesomd in `src/components/icons/b2/extra-ids.json`.

### Component

`<Icon id="file.save" size={14} />` in `src/components/icons/Icon.tsx`:

- kiest de master zoals de Style Repo voorschrijft (≤ 18 px → 16, anders 24) en schaalt met `viewBox`;
- rendert `<svg class="oa-icon" data-icon="file.save" …>` met React-elementen (geen `innerHTML`);
- hoofdkleur `currentColor`, accent `var(--icon-accent)`; de thema-CSS zet `--icon-accent` op de
  accenttekstkleur van het thema (`.oa-icon--mono` schakelt het accent uit);
- `aria-hidden` standaard, `aria-label`/`title` maken er een `role="img"` van;
- `IconId` is de union van gegenereerde ids: een tikfout is een compileerfout.

Lint-, notice- en layoutconfiguraties die nu een lucide-component doorgeven (`icon: LucideIcon`,
`LAYOUT_ICONS`) gaan over op `IconId`. Browser-tests die op lucide-klassen selecteren
(`.lucide-zap`, `lucide-chevron-right`, …) selecteren op `[data-icon="…"]`.

### Koppeling en restpunten

- Elke gebruiksplek krijgt het icoon van zijn functie. Bestaat er voor een OPS-functie geen B2-icoon, dan
  kiezen we het dichtstbijzijnde algemene icoon uit de hele B2-set en noteren het ontbrekende icoon voor
  een issue op de Style Repo (lijst in `docs/superpowers/evidence/b2-ontbrekende-iconen.md`).
- `lucide-react` verdwijnt pas uit `package.json` én `package-lock.json` als er nul gebruiken over zijn;
  tot die tijd mag een restplek tijdelijk lucide houden, zichtbaar in die lijst.
- Licentie: de iconen staan in de Style Repo voorlopig onder LGPL-3.0-only (besluit over een eigen
  iconenlicentie is open, issue #15 daar). OPS is LGPL-3.0; de gegenereerde paden dragen de bron en de
  licentieverwijzing in de kop van het gegenereerde bestand.

## Fase B: thema's

- `web/openaec-tokens.css` komt byte-identiek in `src/styles/openaec-tokens.css`, met dezelfde
  pin-en-check-aanpak (`scripts/style-tokens.py --check`).
- `UI_THEMES` wordt de standaardset van vijf; opgeslagen `high-contrast` migreert naar
  `high-contrast-dark`; de schakelaar *Systeem* blijft en kiest `light`/`dark`.
- Nieuwe instellingen *Werkruimte* en *Statusbalk* uit tokens 0.4, als `data-oa-workspace` en
  `data-oa-statusbar` op `<html>`, gedeclareerd in `settingsRegistry.ts`.
- De 60 bestaande `--theme-*`-variabelen krijgen per thema één brugblok dat ze uit `--oa-*` afleidt,
  zodat alle bestaande CSS en de Canvas-renderers (via `src/utils/theme.ts`) blijven werken; daarna
  vervangen volgende PR's `--theme-*` stap voor stap door `--oa-*`.
- `<html>` draagt tijdelijk zowel `data-theme` als `data-oa-theme`; de pre-paint in `index.html` zet beide.

## Buiten deze PR

Lint- en componentvormgeving (variant B: licht en vlak), tegels in het Bestand-menu, lettergroottes
11/12/13/16/22 en de maten van de schil volgen in eigen PR's, telkens met de Style Repo als bron.

## Bijdragen aan de Style Repo

1. Issue + generieke PR: compacte webexport van de B2-iconen uit `construction` (open punt "de iconen als
   los webbestand" in `STAPPENPLAN.md` fase 4), per app een sprite, zodat geen app de 15 KB-contouren hoeft
   te vereenvoudigen.
2. Issue: ontbrekende iconen voor OPS-functies, met de concrete knoppen (zie de lijst hierboven).
3. Issue waar de kruistabel `design/planner-ribbon-crosswalk.json` niet meer bij de huidige OPS-code past.
