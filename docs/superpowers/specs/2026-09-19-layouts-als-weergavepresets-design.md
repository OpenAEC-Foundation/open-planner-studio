# Layouts als weergavepresets — ontwerp (issue #144)

Status: **concept, wacht op eigenaarsakkoord.** Nog niets gebouwd.

## Aanleiding

gfayat (#113, #144) wil het resourcediagram dat hij als afdrukrapport kreeg ook op het scherm, met
één klik, voor vergaderingen in presentatiemodus. Nu maakt hij daarvoor een opgeslagen filter per
resource. manu varkey stelde een keuzelijst *Gantt Chart / Resource Diagram* voor; gfayat stemde in.

Het scherm kán dit al: `view.group = [{ field: { src: 'resource' } }]` geeft dezelfde banden. Het zit
alleen vier klikken diep achter een icoon zonder label. Het gat is vindbaarheid, niet functie.

Eigenaarsbesluit 2026-09-19: niet oplossen met een losse knop, maar breed. De bestaande
**Layout**-functie wordt hét presetmechanisme; het resourcediagram is een meegeleverde layout; de
losse opgeslagen filters (`SavedFilter`, commit `ae100ee0`) gaan erin op.

## Wat er nu staat

| onderdeel | waar | gedrag |
|---|---|---|
| `Layout` | `src/types/view.ts`, opslag `settingsStore.loadLayouts/saveLayouts` | altijd ALLE vijf delen: kolommen, groepering, sortering, filter, tijdschaal |
| toepassen | `viewSlice.applyLayout` | zet alle vijf, één sessie-undo-event op basis van een diff |
| lint | `LayoutGroupContent` (`ribbonWidgets.tsx`) | `<select>` zonder label, "(geen)" doet niets, Opslaan als / Bijwerken / Beheren |
| `SavedFilter` | `src/types/view.ts`, `ops-`-sleutel via `loadSavedFilters` | alleen het filter; bewust los gehouden "zodat wisselen nooit kolommen, groepering, sortering of tijdschaal raakt" |
| filter-UI | `SavedFilterDropdown` (lint, groep Weergave) + beheer in `FilterDialog.tsx` | kiezen = `setFilter` |

Die laatste motivatie is de kern van het ontwerp: samenvoegen mag dat gedrag niet kosten.

## Het model: een layout legt alleen vast wat hij draagt

```ts
export interface Layout {
  id: string;
  name: string;
  columns?: TaskGridColumnPreference[];
  group?: GroupLevel[];
  sort?: SortLevel[];
  filter?: FilterNode | null;   // aanwezig + null = "wis het filter"
  timeScale?: TimeScale;
}
```

Een **ontbrekende sleutel betekent: laat dat deel van het beeld met rust.** Bestaande opgeslagen
layouts dragen alle vijf en gedragen zich dus exact als vandaag. Een opgeslagen filter is een layout
met alleen `filter`. Het resourcediagram is een layout met alleen `group` en `sort`.

Pure kern in `src/engine/view/layoutPresets.ts` (geen store, headless getest):

- `layoutParts(layout)` — welke delen draagt hij.
- `applyLayoutParts(view, columns, layout)` — het nieuwe beeld; ongedragen delen ongewijzigd.
- `layoutMatchesView(layout, view, columns)` — komen álle gedragen delen overeen met het scherm.
- `migrateSavedFilters(layouts, savedFilters)` — zie *Migratie*.

`viewSlice.applyLayout` roept `applyLayoutParts` aan. De bestaande undo-registratie werkt op een
diff van vóór/na en hoeft niet te veranderen: een gedeeltelijke layout geeft vanzelf een kleinere delta.

## Meegeleverde layouts

Gedefinieerd in code (`src/components/viewControls/builtinLayouts.ts`), **niet** in de opslag: de naam
komt uit een vertaalsleutel en schakelt dus mee met de taal; ze kunnen niet bewerkt, overschreven of
verwijderd worden, wel gedupliceerd naar een eigen layout. Id-prefix `builtin:`.

| id | draagt | inhoud |
|---|---|---|
| `builtin:gantt-wbs` | groepering, sortering | beide leeg → de WBS-boom |
| `builtin:resource-diagram` | groepering, sortering | groeperen op resource; binnen de band op start, zoals het rapport |

Bewust géén kolommen, filter of tijdschaal: wie midden in een vergadering wisselt houdt zijn zoom,
zijn kolommen en zijn filter. Heen en terug is elk één klik. De lijst is de plek voor latere
weergaven (kritiek pad, mijlpalen) — manu's punt 2 en 3.

## Migratie van opgeslagen filters

Eenmalig bij het laden van de layouts: elke `SavedFilter` wordt `{ id, name, filter }` als layout,
idempotent op id, daarna een vlag `ops-savedFiltersMigrated`. De oude sleutel wordt **niet gewist**:
wie terugvalt naar een oudere versie houdt zijn filters. Bekende keerzijde: een oudere versie
verwerpt gedeeltelijke layouts in haar validator en toont ze niet — geen dataverlies, wel onzichtbaar.

## UI

1. **Lint, groep Layout.** De keuzelijst krijgt een zichtbaar label. Inhoud in drie blokken
   (`<optgroup>`): *Meegeleverd*, *Eigen layouts*, *Filters* (layouts die alleen een filter dragen).
   De getoonde waarde is afgeleid: de laatst gekozen layout zolang `layoutMatchesView` klopt, anders
   "(aangepast)". Daarmee licht "Resourcediagram" alleen op als het scherm dat ook echt toont.
2. **Lint, groep Weergave.** `SavedFilterDropdown` vervalt; de filterknop (opent `FilterDialog`) blijft.
   Snel wisselen van filter blijft één klik, nu via de layoutlijst.
3. **Opslaan als… (`LayoutsDialog`).** Vinkjes *Wat legt deze layout vast*: kolommen, filter,
   groepering, sortering, tijdschaal — standaard alle vijf aan (huidig gedrag). De beheerlijst toont
   per layout welke delen hij draagt; meegeleverde layouts staan erbij als alleen-lezen met
   *Dupliceren*. **Bijwerken** ververst alleen de delen die de layout al draagt.
4. **`FilterDialog`.** Het eigen opslaan/laden/verwijderen verdwijnt. Ervoor in de plaats: *Opslaan
   als layout…* (maakt een layout met alleen het filter) en een laadlijst van layouts die een filter
   dragen — laden neemt alleen het filterdeel over in de editor.
5. Mededelingen in de dialogen staan in een gekleurd blok, niet als los bijschrift.

## Deel B — werkdagen in de bandkop (besluit open)

gfayat vraagt het totaal aantal werkdagen per resource. De bandkop toont nu naam + aantal taken.
Drie definities (voorbeeld: taak A ma–vr, taak B wo–di daarna met 2 man): bezette werkdagen 7, som
van de duren 10, mandagen 15. Voorstel: **bezette werkdagen**, uit `ResourceLoad.taskWorkDayIsos`
(dezelfde dagenlijst als het histogram), alleen op resourcebanden. De vraag staat uit bij gfayat op
het issue; de eigenaar beslist. Dit deel raakt de layouts niet en kan als laatste etappe.

## Raakvlakken

- `settingsStore.ts`: validator voor layouts accepteert gedeeltelijke layouts; migratie-aanroep.
- Alle lezers van `Layout.columns`/`.group`/… — de compiler wijst ze aan zodra de velden optioneel zijn.
- i18n: nieuwe sleutels in alle 14 locales (`common:view.layout.*`), vervallen sleutels opruimen.
- Gidsen nl + en: `ref-filters.md` (opslaan loopt nu via layouts), de layoutgids, en een alinea
  "Resourcediagram op het scherm" met verwijzing vanuit `gids-rapporten-printen.md`.
- Geen IFC-impact: layouts zijn app-globale voorkeuren, `view.group/sort/filter` reizen al mee.

## Tests

- `tests/planning/check-layout-presets.ts` (nieuw): gedeeltelijk toepassen laat ongedragen delen
  byte-gelijk; `filter: null` wist, ontbrekend filter niet; match-afleiding; migratie idempotent en
  de oude sleutel blijft staan; meegeleverde ids botsen nooit met gegenereerde ids.
- `check-saved-filters.ts` wordt de migratiecheck.
- Browser (`tests/browser/layout-presets.spec.ts`): één klik naar resourcediagram en één klik terug
  met behoud van zoom, kolommen en filter; filter-layout raakt de groepering niet; een
  vooraf gezette oude `savedFilters`-sleutel verschijnt als layout; Ctrl+Z draait het toepassen terug.

## Etappes (één PR — de etappes delen `ribbonWidgets.tsx`, `view.ts` en de locales)

1. Pure kern, type, validator, migratie + headless checks.
2. `applyLayout`, meegeleverde layouts, lintkeuzelijst met label en afgeleide waarde;
   `SavedFilterDropdown` weg. **Schermafbeelding naar de eigenaar.**
3. `LayoutsDialog` met delen, `FilterDialog`-integratie. **Schermafbeelding naar de eigenaar.**
4. Deel B, na het besluit.
5. Gidsen, 14 locales, browsertests, `npm run verify`.
