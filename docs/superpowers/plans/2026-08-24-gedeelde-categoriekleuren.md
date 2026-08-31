# Gedeelde categoriekleuren Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de eigen-taakkleurmodus door één globale balkkleurkeuze waarmee scherm en rapport automatisch per taak of volgens ieder veld uit Group kleuren.

**Architecture:** Eén gedeeld `BarColorSelection`-contract staat in de typenlaag en wordt via één globale instelling gehydrateerd en opgeslagen. Een pure categorieresolver vertaalt een `FieldRef` plus projectcontext naar sleutel, label, kleur en eventueel resourcegewicht; schermrenderer, printrenderer en legenda consumeren daarna dezelfde resolver en kleurengine. De bestaande Group-catalogus blijft de enige bron voor de selecteerbare categorievelden.

**Tech Stack:** TypeScript 5.5, React 19, Zustand 5, Canvas/Draw2D-renderers, i18next, esbuild-gebaseerde headless tests.

**Spec:** `docs/superpowers/specs/2026-08-14-rapport-export-opties-design.md`

## Global Constraints

- De zichtbare hoofdkeuzes zijn exact `critical`, `auto` en `category`; `task` en een losse `resource`-hoofdmodus verdwijnen.
- `category.field` gebruikt `FieldRef` en de veldlijst komt rechtstreeks uit `groupFieldList`/`fieldOptions`.
- View en Report lezen en schrijven dezelfde app-globale selectie.
- Een ontbrekend projectveld valt tijdelijk terug op Taaktype zonder de opgeslagen selectie te overschrijven.
- `Task.color` blijft als inert legacyveld bestaan, maar geen UI of renderer leest het.
- Activity-code- en resourcekleuren winnen van de automatische paletfallback; ontbrekende waarden zijn neutraal grijs.
- Resource-accent blijft onafhankelijk van de balkkleurselectie.
- Samenvattingsbalken en groepsbanden behouden hun bestaande structurele stijl.
- Iedere productiegedragswijziging volgt rood-groen-refactor; exitcodes zijn leidend.
- Stage en commit alleen de expliciet genoemde bestanden; `node_modules` en gebruikerswijzigingen blijven buiten commits.

---

### Task 1: Gedeeld selectiecontract en tolerante globale migratie

**Files:**
- Create: `src/types/barColor.ts`
- Create: `src/utils/barColorSettings.ts`
- Create: `tests/planning/check-bar-color-settings.ts`
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/slices/uiSlice.ts`
- Modify: `src/utils/settingsRegistry.ts`
- Modify: `src/utils/settingsStore.ts`
- Modify: `src/utils/reportSettings.ts`
- Modify: `tests/planning/run.sh`

**Interfaces:**
- Produces: `BarColorSelection`, `DEFAULT_BAR_COLOR_SELECTION`, `TASK_TYPE_BAR_COLOR_FIELD`, `parseBarColorSelection(raw)`, `migrateLegacyBarColorSelection(screenRaw, reportRaw)`, `loadBarColorSelection()`, `saveBarColorSelection(selection)`.
- Produces: `UIState.barColorSelection: BarColorSelection` als enige live bron voor scherm en rapport.
- Keeps temporarily: `UIState.screenBarColorMode`, `saveScreenBarColorMode` en
  `ReportSettings.barColorMode` blijven tot Task 4 bestaan voor compileerbare tussencommits, maar
  worden niet door de nieuwe migratietest als canonieke instelling beschouwd.

- [ ] **Step 1: Schrijf de falende contract- en migratietest**

Maak `tests/planning/check-bar-color-settings.ts` met een echte localStorage-shim via `./domStub` en letterlijke verwachtingen:

```ts
import './domStub';
import {
  DEFAULT_BAR_COLOR_SELECTION,
  TASK_TYPE_BAR_COLOR_FIELD,
} from '@/types/barColor';
import {
  loadBarColorSelection,
  migrateLegacyBarColorSelection,
  parseBarColorSelection,
  saveBarColorSelection,
} from '@/utils/barColorSettings';

const category = { mode: 'category', field: { src: 'activityCode', typeId: 'discipline' } } as const;
ok(deepEqual(parseBarColorSelection(category), category), 'geldige categorie blijft behouden');
ok(parseBarColorSelection({ mode: 'category', field: { src: 'activityCode' } }) === undefined,
  'categorie zonder typeId wordt geweigerd');
ok(deepEqual(migrateLegacyBarColorSelection('resource', undefined),
  { mode: 'category', field: { src: 'resource' } }), 'resource migreert naar categorie/resource');
ok(deepEqual(migrateLegacyBarColorSelection('task', undefined), DEFAULT_BAR_COLOR_SELECTION),
  'eigen taakkleur migreert naar kritiek pad');
ok(deepEqual(migrateLegacyBarColorSelection('critical', { barColorMode: 'auto' }), { mode: 'auto' }),
  'niet-standaard rapportkeuze wint van standaard schermkeuze');
ok(deepEqual(migrateLegacyBarColorSelection('auto', { barColorMode: 'resource' }), { mode: 'auto' }),
  'niet-standaard schermkeuze wint bij conflict');

await saveBarColorSelection(category);
ok(deepEqual(await loadBarColorSelection(), category), 'canonieke selectie round-tript');
localStorage.removeItem('ops-barColorSelection');
localStorage.setItem('ops-screenBarColorMode', 'resource');
ok(deepEqual(await loadBarColorSelection(), { mode: 'category', field: { src: 'resource' } }),
  'legacy instelling wordt geladen en canoniek teruggeschreven');
ok(localStorage.getItem('ops-barColorSelection') !== null, 'migratie schrijft de nieuwe sleutel');
ok(deepEqual(TASK_TYPE_BAR_COLOR_FIELD, { src: 'builtin', key: 'taskType' }), 'vaste terugval is taaktype');
```

Voeg de check als eigen `bundle_check` toe aan `tests/planning/run.sh`.

- [ ] **Step 2: Draai de nieuwe check en bevestig de juiste rode toestand**

Run: `npm run test:planning`

Expected: exit 1; esbuild meldt dat `@/types/barColor` en/of `@/utils/barColorSettings` ontbreken. De al bestaande batterijen moeten verder blijven draaien.

- [ ] **Step 3: Voeg het selectiecontract en de pure parsers toe**

Maak `src/types/barColor.ts`:

```ts
import type { FieldRef } from '@/types/view';

export type BarColorSelection =
  | { mode: 'critical' }
  | { mode: 'auto' }
  | { mode: 'category'; field: FieldRef };

export const TASK_TYPE_BAR_COLOR_FIELD: FieldRef = { src: 'builtin', key: 'taskType' };
export const DEFAULT_BAR_COLOR_SELECTION: BarColorSelection = { mode: 'critical' };
```

Maak `src/utils/barColorSettings.ts`. Valideer iedere `FieldRef`-variant op bron én verplichte id/key. Laat `loadBarColorSelection()` eerst `ops-barColorSelection` lezen; ontbreekt die, lees dan `ops-screenBarColorMode` en het oude `barColorMode` uit `ops-reportSettings`, migreer volgens de spec en schrijf de nieuwe sleutel. De conflictregel is: niet-standaard schermkeuze, anders niet-standaard rapportkeuze, anders `critical`.

- [ ] **Step 4: Sluit de globale store en rapportinstellingen op het contract aan**

Voeg `barColorSelection` toe aan `UIState` en `createUISlice` en hydrateer de nieuwe selectie
expliciet in `loadAllSettings()`. Laat de oude screen-/reportvelden in deze tussencommit nog staan,
zodat Task 1 geen UI-gedrag vooruitloopt op de falende UI-test van Task 4. De nieuwe selectie is wel
de canonieke opslagroute; Task 4 verwijdert de tijdelijke legacyvelden en hun writers.

- [ ] **Step 5: Draai rood naar groen en controleer de typen**

Run: `npm run test:planning && npm run typecheck`

Expected: beide exit 0; de nieuwe check meldt alle migratiegevallen groen. Bestaande callsites
blijven in deze tussencommit op de tijdelijk behouden legacyvelden en worden in Task 4 omgezet.

- [ ] **Step 6: Commit alleen contract, migratie en test**

```bash
git add src/types/barColor.ts src/utils/barColorSettings.ts \
  src/state/slices/types.ts src/state/slices/uiSlice.ts \
  src/utils/settingsRegistry.ts src/utils/settingsStore.ts src/utils/reportSettings.ts \
  tests/planning/check-bar-color-settings.ts tests/planning/run.sh
git commit -m "feat(view): deel balkkleurinstelling tussen scherm en rapport"
```

---

### Task 2: Pure categorieresolver en nieuwe kleurengine

**Files:**
- Create: `src/services/print/barColorCategories.ts`
- Modify: `src/services/print/barColors.ts`
- Modify: `tests/planning/check-bar-colors.ts`

**Interfaces:**
- Consumes: `BarColorSelection`, `FieldRef`, bestaande `paletteColorForId` en `resourceDisplayColor`.
- Produces: `BarColorContext`, `BarCategoryValue`, `isBarColorFieldAvailable(field, ctx)`, `effectiveBarColorSelection(selection, ctx)`, `resolveBarCategoryValues(task, field, ctx)`, `visibleBarColorCategories(tasks, field, ctx)`.
- Changes: `computeBarColors(task, selection, ctx, palette, barPx?)` en `BarPalette.uncategorized`.

- [ ] **Step 1: Vervang de oude modusgevallen in de test door categoriewaarden**

Breid de fixture uit met `wbsCode`, `taskType`, `activityCodes` en `customFields`. Gebruik deze context:

```ts
const CTX: BarColorContext = {
  activityCodeTypes: [{
    id: 'discipline', name: 'Discipline', values: [
      { id: 'elektra', code: 'E', description: 'Elektra', color: '#11AA55' },
      { id: 'bouw', code: 'B', description: 'Bouw' },
    ],
  }],
  customFieldDefs: [
    { id: 'zone', name: 'Zone', type: 'text' },
    { id: 'floor', name: 'Verdieping', type: 'integer' },
  ],
  resources: [mkRes('r1', '#111111'), mkRes('r2', '#222222')],
  assignments: [],
  taskTypeLabels: { CONSTRUCTION: 'Constructie', INSTALLATION: 'Installatie' },
  noneLabel: '(geen)',
};
```

Voeg afzonderlijke assertions toe voor:

```ts
computeBarColors(taskWithColor, { mode: 'critical' }, CTX, PAL).fill === PAL.normal;
resolveBarCategoryValues(task, { src: 'builtin', key: 'wbsCode' }, CTX)[0].label === '1.2';
resolveBarCategoryValues(task, { src: 'builtin', key: 'taskType' }, CTX)[0].label === 'Constructie';
resolveBarCategoryValues(task, { src: 'activityCode', typeId: 'discipline' }, CTX)[0].color === '#11AA55';
resolveBarCategoryValues(task, { src: 'customField', defId: 'floor' }, CTX)[0].label === '3';
resolveBarCategoryValues(taskWithoutValue, { src: 'customField', defId: 'zone' }, CTX)[0].isNone === true;
effectiveBarColorSelection(categoryForDeletedField, CTX).effective.field === TASK_TYPE_BAR_COLOR_FIELD;
```

Behoud en pas de bestaande assertions voor auto, resourcegewichten, smalbalken, mijlpalen en donkere-themazichtbaarheid aan. Voeg een mutatiecheck toe: twee identieke taken waarvan alleen `Task.color` verschilt moeten in `critical`, `auto` en dezelfde categorie exact dezelfde vulling krijgen.

- [ ] **Step 2: Draai alleen de balkkleurcheck en bevestig rood**

Run: `bash tests/planning/run.sh >/tmp/ops-category-red.log 2>&1; test $? -ne 0`

Expected: het shell-commando zelf exit 0 omdat de suite rood is; in `/tmp/ops-category-red.log` falen de nieuwe imports/signatures of categorie-assertions. Controleer met `rg -n "bar-colors|XX|error" /tmp/ops-category-red.log` dat het om de ontbrekende categorie-engine gaat.

- [ ] **Step 3: Bouw de pure resolver**

Maak `src/services/print/barColorCategories.ts` met:

```ts
export interface BarColorContext {
  activityCodeTypes: ReadonlyArray<ActivityCodeType>;
  customFieldDefs: ReadonlyArray<CustomFieldDef>;
  resources: ReadonlyArray<Resource>;
  assignments: ReadonlyArray<ResourceAssignment>;
  taskTypeLabels?: Readonly<Record<string, string>>;
  noneLabel: string;
}

export interface BarCategoryValue {
  key: string;
  label: string;
  color?: string;
  weight: number;
  isNone: boolean;
}
```

Gebruik voor WBS, taaktype en gebruikersvelden één waarde met sleutel `fieldIdentity + ':' + String(raw)`. Activity codes gebruiken waarde-id, label `code — description` en de optionele definitiekleur. Resource gebruikt alle geldige toewijzingen, de resourcenaam/kleur en `unitsPerDay`; zonder waarde levert iedere veldsoort één `(geen)`-waarde met `isNone: true`. `effectiveBarColorSelection` vergelijkt categorievelden via de bestaande `groupFieldList`/`fieldsEqual`-semantiek en retourneert `{ effective, missingField }`.

- [ ] **Step 4: Bouw de minimale kleurengine op het nieuwe contract**

Laat `computeBarColors`:

```ts
export function computeBarColors(
  task: Task,
  selection: BarColorSelection,
  context: BarColorContext,
  palette: BarPalette,
  barPx?: number,
): BarFill
```

`critical` gebruikt alleen milestone/critical/nearCritical/normal; `auto` hasht `task.id`; `category` resolveert de effectieve categorie. Eén waarde wordt solide, meerdere resourcewaarden worden gewogen segmenten, `(geen)` gebruikt `palette.uncategorized`, en iedere niet-kritieke selectie behoudt de rode outline-regel voor kritieke taken. `Task.color` wordt niet geraadpleegd.

- [ ] **Step 5: Draai de gerichte en volledige planningtests groen**

Run: `npm run test:planning`

Expected: exit 0; de balkkleurcheck bewijst alle Group-veldsoorten, de verwijderde-veldterugval en `Task.color`-inertie.

- [ ] **Step 6: Commit resolver en engine**

```bash
git add src/services/print/barColorCategories.ts src/services/print/barColors.ts \
  tests/planning/check-bar-colors.ts
git commit -m "feat(view): kleur balken op group-categorie"
```

---

### Task 3: Schermrenderer, printrenderer en categorielegenda

**Files:**
- Modify: `src/components/canvas/ganttRenderOptions.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/engine/renderer/GanttRenderer.ts`
- Modify: `src/engine/renderer/themePalette.ts`
- Modify: `src/services/print/printPreview.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`
- Modify: `tests/planning/check-resource-accent.ts`
- Modify: `tests/planning/check-print-report.ts`

**Interfaces:**
- Consumes: de Task 2-engine en `UIState.barColorSelection`.
- Changes: `GanttRenderOptions.barColorSelection?: BarColorSelection` plus activity-code-/custom-field-/labelcontext.
- Changes: `PrintOptions.barColorSelection?: BarColorSelection` plus dezelfde context.
- Produces: categorielegenda uit `visibleBarColorCategories` over uitsluitend zichtbare bladtaken.

- [ ] **Step 1: Schrijf falende renderer- en legendaverwachtingen**

Pas `check-gantt-render-options.ts` aan zodat `buildGanttRenderOptions` een letterlijke category-selectie en activity/custom context ongewijzigd doorgeeft. Pas `check-resource-accent.ts` aan zodat het accent bij `critical`, `auto` en `category/resource` dezelfde resourcekleurstrepen tekent.

Voeg in `check-print-report.ts` drie gedragsgevallen toe:

```ts
// Taaktype: twee CONSTRUCTION-taken krijgen dezelfde fill, INSTALLATION een andere.
// Activity code met expliciete kleur: de recording Draw2D ziet '#11AA55'.
// Legenda: alleen waarden van zichtbare bladtaken, maximaal acht, daarna '… en 1 meer'.
```

Gebruik vaste taken en letterlijke kleuren/labels; bereken verwachte kleuren niet met de resolver onder test.

- [ ] **Step 2: Draai de planningtests en bevestig rendererrood**

Run: `npm run test:planning`

Expected: exit 1; failures noemen de oude `barColorMode`-opties, ontbrekende context of ontbrekende categorielegenda.

- [ ] **Step 3: Sluit GanttCanvas en GanttRenderer aan**

Vervang `barColorMode` door `barColorSelection` in de options-builder en beide split-view-callpaths. Geef `activityCodeTypes`, `customFieldDefs`, `taskTypeLabels` en het vertaalde `(geen)`-label door. Voeg `uncategorized` toe aan `BarPalette` vanuit `GanttPalette.ghost` of een gelijkwaardige zichtbare neutrale grijstint. Laat alleen bladtaken/mijlpalen door de engine kleuren; summary-, group- en hammockpaden behouden hun bestaande tekenlogica. Laat `showResourceAccent` zonder conditie op de selectie doorlopen.

- [ ] **Step 4: Sluit print, preview en legenda aan**

Vervang `PrintOptions.barColorMode` door `barColorSelection`. Bouw één `BarColorContext` uit de doorgegeven projectdata en vertaalde labels. Gebruik `visibleBarColorCategories` voor de category-legenda, cap op acht, first-appearance-volgorde, en voeg daarna de kritieke-randverklaring toe. Behoud de bestaande critical-, milestone-, summary-, float- en relatiestijlitems.

- [ ] **Step 5: Draai de renderbatterijen groen**

Run: `npm run test:planning && npm run typecheck`

Expected: beide exit 0; geen oude `barColorMode`-rendererreferenties blijven over buiten expliciete legacy-migratietests.

- [ ] **Step 6: Commit renderintegratie**

```bash
git add src/components/canvas/ganttRenderOptions.ts src/components/canvas/GanttCanvas.tsx \
  src/engine/renderer/GanttRenderer.ts src/engine/renderer/themePalette.ts \
  src/services/print/printPreview.ts tests/planning/check-gantt-render-options.ts \
  tests/planning/check-resource-accent.ts tests/planning/check-print-report.ts
git commit -m "feat(report): gebruik categoriekleuren in scherm en export"
```

---

### Task 4: Eén bediening voor View en Report

**Files:**
- Create: `src/components/viewControls/barColorFieldOptions.ts`
- Create: `tests/planning/check-bar-color-field-options.ts`
- Modify: `src/components/layout/Ribbon/ribbonWidgets.tsx`
- Modify: `src/components/panels/ReportPanel.tsx`
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/slices/uiSlice.ts`
- Modify: `src/utils/settingsRegistry.ts`
- Modify: `src/utils/settingsStore.ts`
- Modify: `src/utils/reportSettings.ts`
- Modify: `tests/planning/run.sh`

**Interfaces:**
- Consumes: `groupFieldList`, `fieldOptions`, `BarColorSelection`, `saveBarColorSelection`.
- Produces: `barColorFieldOptions(ctx)` en `effectiveBarColorControl(selection, ctx)` als pure, door beide UI’s gebruikte helpers.

- [ ] **Step 1: Schrijf de falende veldlijst- en terugvaltest**

Maak `check-bar-color-field-options.ts` met een context die WBS, taaktype, één activity code, twee custom fields en resource oplevert. Assert letterlijk dat `barColorFieldOptions(ctx).map(encodeFieldRef)` exact gelijk is aan `groupFieldList(ctx).map(encodeFieldRef)`. Assert daarnaast:

```ts
effectiveBarColorControl(
  { mode: 'category', field: { src: 'activityCode', typeId: 'verwijderd' } }, ctx,
).effective.field
// => { src: 'builtin', key: 'taskType' }
```

en dat `missingField` de oorspronkelijke reference bevat. Voeg de check aan `run.sh` toe.

- [ ] **Step 2: Draai planningtests en bevestig rood**

Run: `npm run test:planning`

Expected: exit 1 omdat `barColorFieldOptions.ts` nog niet bestaat.

- [ ] **Step 3: Bouw de gedeelde UI-helper**

Implementeer de helper als een dunne delegatie naar `groupFieldList`, `fieldOptions` en de Task 2-terugval. Kopieer geen veldlijsten en introduceer geen tweede categoriecatalogus.

- [ ] **Step 4: Bouw de View-popover om**

Laat `ScreenColorsPopoverButton` de drie hoofdkeuzes tonen. Bij `category` toont hij een `RibbonDropdown` of gelijkwaardige selector met `encodeFieldRef`/`decodeFieldRef`. Iedere hoofd- of veldkeuze doet exact:

```ts
setUI({ barColorSelection: next });
void saveBarColorSelection(next);
```

Toon bij `missingField` de vertaalde melding dat Taaktype tijdelijk wordt gebruikt. De ribbonknop is actief voor `auto` en `category`.

- [ ] **Step 5: Bouw ReportPanel om naar dezelfde storewaarde**

Verwijder de lokale `barColorMode`-state, hydratatie, save-effectdependency en
`ReportSettings.barColorMode`. Verwijder tegelijk `UIState.screenBarColorMode`, de oude
settingsRegistry-descriptor en `saveScreenBarColorMode`; vanaf dit punt bestaat er nog maar één
live en persistente bron. Subscribe op `s.ui.barColorSelection`, gebruik dezelfde drie hoofdopties
en dezelfde veldoptiehelper, en schrijf via dezelfde setter/saver. Geef de actuele selectie en
categoriecontext door aan `PrintOptions`; daardoor reageert de preview meteen op een wijziging
vanuit View.

- [ ] **Step 6: Draai tests en typecheck groen**

Run: `npm run test:planning && npm run typecheck`

Expected: beide exit 0; `rg -n "screenBarColorMode|barColorMode" src` vindt geen live UI-/rendererreferenties, alleen expliciete legacy-migratievelden of historische documentatie die in Task 5 wordt bijgewerkt.

- [ ] **Step 7: Commit gedeelde bediening**

```bash
git add src/components/viewControls/barColorFieldOptions.ts \
  src/components/layout/Ribbon/ribbonWidgets.tsx src/components/panels/ReportPanel.tsx \
  tests/planning/check-bar-color-field-options.ts tests/planning/run.sh
git commit -m "feat(ui): deel categoriebediening voor balkkleuren"
```

---

### Task 5: Verwijder taakkleur-UI, rond ribbonindeling en teksten af

**Files:**
- Modify: `src/components/task-sections/TaskBasicFields.tsx`
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx`
- Modify: `tests/planning/check-ribbon-overlays.ts`
- Modify: `tests/planning/run.sh`
- Modify: `src/i18n/locales/*/menu.json`
- Modify: `src/i18n/locales/*/report.json`
- Modify: `src/i18n/locales/*/task.json`
- Modify: `public/docs/nl/gids-rapporten-printen.md`
- Modify: `public/docs/en/gids-rapporten-printen.md`
- Modify: `public/docs/nl/gids-resourcebibliotheken.md`
- Modify: `public/docs/en/gids-resourcebibliotheken.md`

**Interfaces:**
- Consumes: de goedgekeurde ribbonopstelling met `overlaysStack` en `colorAccentStack`.
- Removes: de branch-eigen `<input type="color">` voor `Task.color` en alle zichtbare teksten voor eigen taakkleur.

- [ ] **Step 1: Maak de bestaande ribbonregressietest inhoudelijk exact**

Laat `check-ribbon-overlays.ts` bewaken dat:

```ts
overlaysStack === ['toggleBaselineOverlay', 'toggleProgressLine', 'toggleStatusDateLine'];
colorAccentStack === ['screenColors', 'toggleResourceAccent'];
```

Corrigeer het commentaar in `run.sh` zodat het twee verticale stacks beschrijft. Draai `npm run test:planning`; expected exit 0, omdat deze rood-groen-cyclus al vóór het categoriekleurontwerp is uitgevoerd en de productie-indeling reeds aanwezig is.

- [ ] **Step 2: Verwijder de branch-eigen taakkleurkiezer**

Verwijder uitsluitend het `Field`-blok met `<input type="color">` uit `TaskBasicFields.tsx`. Laat `Task.color` in typen, importers, exporters en extensioncontracten ongemoeid; regressietests uit Task 2 bewaken dat renderers het negeren.

- [ ] **Step 3: Werk alle vertalingen bij**

Vervang de oude vier moduslabels door drie hoofdlabels plus categoriekeuze, tijdelijk-Taaktype-melding en `(geen)`/legendateksten. Nederlands en Engels zijn de bronteksten; houd alle bestaande locales sleutelgelijk zodat `verify:i18n` slaagt. Verwijder alleen de branch-eigen `properties.color`-vertaling als `rg` aantoont dat geen andere bestaande UI die sleutel gebruikt.

- [ ] **Step 4: Werk de gebruikersgidsen bij**

Beschrijf in beide rapportgidsen het concrete voorbeeld: Taaktype geeft één kleur per constructie/installatie/sloop; Activity code Discipline geeft één kleur per discipline; scherm en rapport delen de keuze. Beschrijf Resource als veld onder **Op categorie** en behoud de uitleg over gesegmenteerde inzet en Resource-accent.

- [ ] **Step 5: Draai tekst-, docs- en planningpoorten**

Run: `npm run test:planning && npm run verify:i18n && npm run verify:docs && npm run typecheck`

Expected: alle vier exit 0. Run daarna `rg -n "Per taak.*eigen kleur|custom color|screenColors_task|barColorMode_task" src public/docs`; expected exit 1 (geen treffers).

- [ ] **Step 6: Commit alleen UI-opruiming, ribbon en documentatie**

```bash
git add src/components/task-sections/TaskBasicFields.tsx \
  src/components/layout/Ribbon/ribbonConfig.tsx tests/planning/check-ribbon-overlays.ts \
  tests/planning/run.sh src/i18n/locales public/docs/nl/gids-rapporten-printen.md \
  public/docs/en/gids-rapporten-printen.md public/docs/nl/gids-resourcebibliotheken.md \
  public/docs/en/gids-resourcebibliotheken.md
git commit -m "docs(ui): rond categoriekleuren en ribbon af"
```

---

### Task 6: Echte gebruikershandeling, visuele controle en volledige verificatie

**Files:**
- Modify only if evidence exposes a defect: the smallest file and its matching regression test.

**Interfaces:**
- Consumes: de volledig geïntegreerde gedeelde balkkleurselectie.
- Produces: bewijs voor scherm, rapportpreview, fallbackmelding, Resource-accent en alle automatische poorten.

- [ ] **Step 1: Meet branch, devserver en testvoorwaarden**

Run:

```bash
git branch --show-current
git status --short
curl -fsS http://localhost:3012/ >/dev/null
```

Expected: branch `claude/rapport-export-opties`; alleen bewust resterende bestanden in status; curl exit 0. Start anders `npm run dev -- --host 0.0.0.0 --port 3012` en bevestig de luisterende poort voordat de browser wordt gebruikt.

- [ ] **Step 2: Reproduceer de volledige schermhandeling**

Open View → Balkkleuren, kies **Op categorie → Taaktype** en controleer dat gelijke taaktypes dezelfde balkkleur krijgen, verschillende types andere kleuren, kritieke taken een rode rand houden en taken zonder waarde grijs worden waar zo’n fixture bestaat. Controleer daarna dat **Resource-accent** nog aan/uit schakelt zonder de categorievulling te wijzigen.

- [ ] **Step 3: Controleer de gedeelde rapportkeuze en legenda**

Open Report zonder de View-keuze terug te zetten. Controleer dat Balkkleuren al op **Op categorie → Taaktype** staat, dat de preview dezelfde categorie-indeling gebruikt en dat de legenda alleen zichtbare waarden toont. Wijzig in Report naar een activity code en controleer na terugkeer naar View dat dezelfde keuze actief is.

- [ ] **Step 4: Controleer de ontbrekend-veldterugval**

Selecteer een projectgebonden activity code, open of maak vervolgens een project zonder die code en controleer de melding plus tijdelijke Taaktype-kleuring. Keer terug naar het eerste project en controleer dat de oorspronkelijke activity-codekeuze terugkomt.

- [ ] **Step 5: Draai de volledige verificatiepoort**

Run: `npm run verify`

Expected: exit 0. Noteer afzonderlijk de exitcodes van typecheck, lint, planning, library, MCP, dev-server, examples, docs, i18n, cycles en audit uit de uitvoer; een vriendelijke samenvattingsregel zonder exit 0 telt niet.

- [ ] **Step 6: Controleer de uiteindelijke diff en commit eventuele bewijsfixes gericht**

Run:

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: geen whitespacefouten, geen `node_modules` in staging en uitsluitend verwachte branchbestanden. Als visuele QA een defect opleverde, voeg eerst een falende regressietest toe, herstel minimaal, draai de relevante poort groen en commit alleen die test plus fix.
