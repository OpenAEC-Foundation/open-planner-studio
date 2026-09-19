# Layoutknoppen — ontwerp (issue #144)

Status: **gebouwd op `t3code/22f69e75`, wacht op eigenaarsreview.** Deel B (werkdagen in de bandkop)
is bewust NIET gebouwd — zie onderaan.

## Aanleiding

gfayat (#113, #144) wil het resourcediagram dat hij als afdrukrapport kreeg ook op het scherm, met
één klik, voor vergaderingen in presentatiemodus. Hij maakte daarvoor een opgeslagen filter per
resource. Zijn schets was een knop naast Histogram; manu varkey stelde een keuzelijst voor.

Het scherm kón dit al (`view.group = [{ field: { src: 'resource' } }]`), maar vier klikken diep achter
een icoon zonder label. Het gat was vindbaarheid, niet functie.

## Eigenaarsbesluiten (2026-09-19)

1. Niet oplossen met één losse knop maar breed: de **Layout**-functie wordt hét presetmechanisme.
2. De oude vorm (een `<select>` plus Opslaan als/Bijwerken/Beheren) verdwijnt. **Elke layout is een
   eigen lintknop met icoon en naam**, plus een plusknop.
3. Een layoutknop is een **schakelaar**: nogmaals klikken zet hem uit en brengt het beeld terug naar
   hoe het was vóór de klik.
4. **Relatielijnen tonen** wordt een schermoptie en een layoutdeel; het resourcediagram zet ze uit,
   zoals het afdrukrapport (een taak kan onder meerdere banden staan).
5. Een layout legt alleen de **aangevinkte** delen vast, met duidelijke info-tooltips.
6. Het Weergave-blok (Kolommen/Filter/Groeperen/Sorteren) gaat weg; de dialoog krijgt **Toepassen
   zonder opslaan**. Het oude blok blijft als instelling in een gemarkeerd blok **Legacy-functies**.
7. De losse opgeslagen filters (`SavedFilter`, issue #85) gaan op in de layouts.

## Het model

```ts
export interface Layout {
  id: string; name: string; icon?: string;
  columns?: TaskGridColumnPreference[];
  group?: GroupLevel[]; sort?: SortLevel[];
  filter?: FilterNode | null;        // aanwezig + null = "wis het filter"
  timeScale?: TimeScale;
  showRelations?: boolean;
}
```

Een **ontbrekende sleutel betekent: laat dat deel van het beeld met rust.** Layouts van vóór #144
dragen vijf delen en gedragen zich ongewijzigd. Pure kern in `src/engine/view/layoutPresets.ts`:
`layoutParts`, `applyLayoutParts`, `layoutMatchesView`, `pickLayoutParts`, `migrateSavedFilters` en
het schakelmodel hieronder.

### Schakelmodel (`LayoutSession` in `ViewState`, per document, sessie)

`{ layouts: Layout[]; restore: LayoutViewParts }` — de aanstaande layouts en het beeld van vóór de
eerste nog levende layoutklik.

- **Aan** (`switchLayoutOn`): knoppen die geen deel delen blijven aan (resourcediagram + filterknop);
  een knop die wél een deel deelt gaat uit en zijn overige delen keren terug naar `restore`.
- **Uit** (`switchLayoutOff`): alleen de delen van díé layout gaan terug naar `restore`. Een
  handmatige wijziging aan een niet-gedragen deel (bv. zoom) blijft dus staan.
- **Aan = het scherm klopt.** `liveSessionLayouts` filtert op `layoutMatchesView`: wijzigt de
  gebruiker met de hand een gedragen deel, dan staat de knop uit. De knop volgt het scherm, niet de
  laatste klik — ook na Ctrl+Z, want `layoutSession` en `showRelations` zitten in de undo-subset
  (`captureViewLayoutHistoryState`). Elke klik is één sessie-undo-event.
- `applyViewSettings` ("toepassen zonder opslaan") schrijft delen zonder een knop aan te zetten.

De store kent de layoutlijst niet; daarom bewaart de sessie de toegepaste layouts zelf.
`src/state/layoutView.ts` (bladmodule) levert `currentLayoutParts` en `activeLayoutIds`.

## Meegeleverde layout

`src/components/viewControls/builtinLayouts.ts`, in code en niet in de opslag (vertaalde naam, niet
bewerkbaar, wel te dupliceren), id-prefix `builtin:`. Eén stuks: **Resourcediagram** — groeperen op
resource, binnen de band op start, relatielijnen uit. Geen kolommen/filter/tijdschaal, zodat zoom,
kolommen en filter in een vergadering blijven staan. Een aparte "Gantt (WBS)" is niet nodig: uitzetten
keert terug. Latere weergaven (kritiek pad, mijlpalen) zijn een extra regel in die lijst.

## UI

- **Lintgroep Layout** (`LayoutGroupContent`): knop per layout (`layoutIcons.tsx`, vaste set van 13
  iconen; een layout bewaart alleen de sleutel), plusknop. Rechtsklik: Bewerken… / Dupliceren /
  Verwijderen (bevestiging via `ConfirmDialog`); meegeleverd: alleen Dupliceren.
- **Layoutdialoog** (`LayoutsDialog.tsx`, `ui.layoutDialogTargetId`): naam, icoon, zes delen met
  vinkje + info-tooltip; onder een aangevinkt deel de editor zelf — `GroupEditor` (filterboom, nu
  geëxporteerd uit `FilterDialog.tsx`), `LevelListEditor` (groeperen/sorteren, gedeeld met de
  klassieke popovers), tijdschaal-select, relatielijnen-vinkje. Kolommen: neemt de tabel over.
  Knoppen: Annuleren / Toepassen zonder opslaan / Opslaan. Opslaan past niet toe.
- **Relatielijnen**: kleine lintknop in Basislijnen & voortgang, in een eigen derde stapel (de twee
  bestaande zitten vol; `check-ribbon-overlays.ts` is daarop bijgewerkt en bewaakt nu max. drie per
  stapel). `GanttCanvas` geeft de renderer bij `showRelations === false` geen relaties; de
  pad-tracering blijft op alle relaties rekenen.
- **Legacy**: `ui.showClassicViewControls` (persisted, default uit) → `RibbonGroupSpec.useVisible` op
  de Weergave-groep; instelling in `SettingsPanelContent`, tab Geavanceerd, blok *Legacy-functies*.

## Migratie van opgeslagen filters

Eenmalig in `loadLayouts()`: elke `SavedFilter` wordt `{ id, name, filter }`, idempotent op id, met
vlag `ops-savedFiltersMigrated` (een daarna verwijderde filterknop komt niet terug). De oude sleutel
blijft staan als downgrade-vangnet. Bekende keerzijde: een oudere appversie verwerpt gedeeltelijke
layouts in haar validator — geen dataverlies, wel onzichtbaar. De klassieke filterknop en
`FilterDialog` lezen/schrijven nu filter-layouts.

## Tests

- `tests/planning/check-layout-presets.ts`: delen toepassen, match, schakelmodel (samen aan,
  vervangen, uit, handmatige wijziging), migratie, validator.
- `tests/browser/layout-presets.spec.ts`: resourcediagram aan/uit met behoud van zoom en filter en
  undo; gemigreerde filterknop samen aan met het resourcediagram; legacy-instelling; de dialoog
  (delen in de dialoog instellen, opslaan past niet toe, toepassen zonder opslaan, rechtsklikmenu).
- Bijgewerkt: `check-ribbon-overlays.ts`, `settings-tabs.spec.ts`, `check-task-grid-preferences.ts`.

## Docs

`ref-layouts.md` (nl + en) herschreven; `ref-filters`, `ref-kolommen`, `ref-instellingen` bijgewerkt.
De twaalf overige vertalingen van `ref-layouts.md` beschreven de verdwenen keuzelijst en zijn
verwijderd (de viewer valt terug op EN) — `verify:docs` eist gelijke kopstructuur, en een stale
vertaling van een verdwenen UI is erger dan een Engelse terugval. Ze volgen met de maandelijkse ronde.

## Niet gebouwd: werkdagen in de bandkop

gfayat vraagt het totaal aantal werkdagen per resource. Drie definities geven drie getallen (bezette
werkdagen / som van de duren / mandagen). Eigenaarsbesluit: **niet gokken**; de vraag staat uit bij
gfayat op #144 en dit deel wacht op zijn antwoord.
