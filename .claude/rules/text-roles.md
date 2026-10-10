---
paths:
  - "src/**/*.{tsx,css}"
  - "docs/recepten/tekstgrootte.md"
  - "scripts/*text-roles*"
  - "tests/browser/text-roles.spec.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### Tekstgroottes: zes rollen, één bron

De interface kent precies zes absolute tekstgroottes (plus relatieve afleidingen daarvan), gedefinieerd in het `@theme static`-blok van `src/styles/globals.css`: `caption` 9 · `small` 10 · `body` 11 · `large` 12 · `heading` 14 · `title` 20 (px × `--ui-font-scale`, dus elke rol volgt de instelling `ui.uiFontScale` vanzelf). In klassen schrijf je `text-body` (met `!` waar een `.input`/`.btn`-regel overstemd moet worden), in losse CSS `font-size: var(--text-body)`. `--text-*: initial` heeft Tailwinds eigen schaal verwijderd: `text-xs`/`text-sm`/… bestaan niet meer en zouden stil níéts doen. Een rol is alleen een grootte — regelhoogte zet je zelf met `leading-*` (de omgezette `text-xs`/`text-sm`-plekken dragen daarom `leading-4`/`leading-5`). De `13px` op `html` is geen rol maar de rem-basis waar Tailwinds spacing aan hangt; `body` erft `large`. Relatieve maten (`em`, `%`) mogen, want die erven van een rol — de enige in gebruik is `.help-inline-code` (`0.85em`, zodat inline code met kop of alinea meegroeit). `npm run verify:text-roles` (onderdeel van `verify`) keurt de gangbare schrijfwijzen van een absolute maat in `src/` af (CSS-`font-size` via een witte lijst, `font`-shorthand, `@apply`, `text-[…]`, Tailwinds eigen schaal, `fontSize`/`setProperty`/`cssText`); wat hij níét ziet — `fontSize: n` met een variabele, HTML-strings — vangt `tests/browser/text-roles.spec.ts` op de oppervlakken die die test bezoekt (computed font-size op 100% en 125%); PDF-/printtekst (`src/services/`) en SVG-`fontSize={n}` vallen erbuiten; schermcanvas (Gantt, histogram) schrijft rolnamen via `canvasFont` in `src/engine/renderer/textRoles.ts`, waarvan de poort `TEXT_ROLE_PX` gelijk houdt aan het `@theme`-blok, en een bewuste uitzondering krijgt op de regel zelf `text-roles: <reden>`. Een zevende rol toevoegen is een ontwerpbesluit, geen gemak: de poort kent de lijst en faalt op een onbekende `var(--text-…)`; het recept staat in `docs/recepten/tekstgrootte.md`.
