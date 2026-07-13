# Bouwmodus-schakelaar (bouw-agnostische modus) — ontwerp

**Datum:** 2026-07-13
**Status:** goedgekeurd, in uitvoering

## Doel

Open Planner Studio is sterk bouwgericht. We voegen **één in-/uitschakelbare app-instelling**
toe waarmee de app "bouw-agnostisch" wordt, zodat gebruikers buiten de bouw hem ook prettig
kunnen gebruiken. Bij uitgeschakelde bouwmodus verdwijnen de bouw-specifieke defaults en het
bouwjargon (o.a. de bouwvak-vakanties).

Reikwijdte = **gemiddeld**: kalender + faseringssjablonen + taaktype-default + terminologie in
wizard/kalender. De app-chrome (IFC-tab, voorbeeldprojecten) en de IFC-kern blijven ongemoeid.

## De instelling

- **Naam/framing:** één checkbox **"Bouwmodus"**. Aan = huidige bouwgerichte app; uit =
  algemeen/agnostisch. **Default = AAN** (opt-in agnostisch, bestaande gebruikers merken niets).
- **Opslag:** `localStorage` via `src/utils/settingsStore.ts`, `ops-`-prefix, boolean —
  naar model van `loadAutoCalcCPM`/`saveAutoCalcCPM`. Nieuw paar `loadConstructionMode`/
  `saveConstructionMode` met default `true`.
- **State:** veld op de UI-slice (`ui.constructionMode: boolean`) in
  `src/state/slices/uiSlice.ts` + type in `src/state/slices/types.ts`; init-load bij opstart
  (in `App.tsx`, naast de andere settings-loads).
- **UI:** één nieuwe `settings-section` met checkbox in het gedeelde
  `src/components/settings/SettingsPanelContent.tsx` (tab `general`), met live-applier
  `applyConstructionMode = (v) => { setUI({ constructionMode: v }); void saveConstructionMode(v); }`.
  Verschijnt daardoor automatisch op alle **3 de plekken** (⚙-popup, Instellingen-ribbontab,
  Backstage → Instellingen) — 3-plekken-regel.
- **i18n:** labels + helptekst onder `settings.*` in **alle 14 locales** (`common`-namespace).
  NL is de canonieke bron; overige locales pragmatisch vertaald (Engels als veilige fallback
  waar nodig, maar liefst nette vertaling).

## Wat de schakelaar aanstuurt (bij bouwmodus UIT = agnostisch)

1. **Default-kalender** — `src/engine/calendar/defaultCalendar.ts` `createDefaultCalendar()`
   levert in agnostische modus een **neutrale** kalender: naam "Standaardkalender" (i18n-neutraal),
   ma-vr 07:00-16:00, feestdagen via `country: 'none'` (leeg) i.p.v. `NL_SET`. In bouwmodus
   ongewijzigd ("Bouwkalender NL", NL-feestdagen).
   - Consumers die deze kalender maken en dus de vlag moeten respecteren:
     `projectSlice` (`newProject`, `createNewProject`, slice-init), `documentSlice` (`newDocument`),
     `src/utils/projectTemplates.ts` `buildGeneratedCalendar()`.
2. **Bouwvak-UI** — `src/components/dialogs/CalendarGeneratorFields.tsx`: de bouwvak-radiorij
   (r99-122) wordt **verborgen** wanneer bouwmodus uit staat. De onderliggende generator-param
   valt terug op `bouwvak: 'geen'`.
3. **Faseringssjablonen** — `src/components/dialogs/ProjectInfoDialog.tsx`: in agnostische modus
   tonen we alleen "Leeg" (de bouwsjablonen woningbouw/utiliteit uit
   `src/utils/projectTemplates.ts` vervallen uit de keuzelijst). Default stond al op `empty`.
4. **Taaktype-default** — nieuwe taken krijgen in agnostische modus een neutraal type
   (`USERDEFINED`) i.p.v. `CONSTRUCTION`. De `TaskType`-enum blijft bestaan (round-tript via IFC);
   alleen de *default* bij aanmaken verandert. Betrokken plekken: `taskSlice` default,
   `createNewProject` (zet nu hardcoded `taskType: 'CONSTRUCTION'` op wizard-fasen).
   Importers (csv/ifc/p6/mspdi) blijven hun eigen mapping houden — die vertalen bestaande data,
   niet "nieuwe" taken, dus vallen buiten scope.
5. **Terminologie** — bouw-specifieke zichtbare teksten in wizard/kalender krijgen een neutrale
   variant afhankelijk van de vlag (default-kalendernaam via i18n; wizard-labels). Beperkt en
   gericht; geen globale term-sweep (dat is de "Volledige" reikwijdte, buiten scope).

## Reikwijdte & gedrag

- **App-wijd**, niet per project. Bepaalt (a) de UI-framing **live** en (b) de **defaults** voor
  nieuwe projecten/documenten.
- **Verandert géén bestaande projectdata.** Een al geladen bouwproject met bouwvak in z'n kalender
  behoudt dat (opgeslagen projectdata, round-tript via IFC). De schakelaar stript niet retroactief.
  Een eventuele "maak deze kalender bouwvak-vrij"-actie is een losse toekomstige toevoeging,
  buiten deze scope.
- **Geen IFC-round-trip-impact:** de instelling is app-niveau data (localStorage), geen projectdata.

## Niet in scope (YAGNI)

- IFC-tab/IFCPanel hernoemen of verbergen; voorbeeldprojecten anders presenteren (= "Volledig").
- Retroactief bestaande kalenders/taken herschrijven.
- Nieuwe generieke faseringssjablonen bedenken (alleen "Leeg" in agnostische modus).

## Verificatie

- `npm run build` (`tsc`) groen — strict mode, `noUnusedLocals`/`noUnusedParameters`.
- `bash tests/planning/run.sh` groen (draait de echte store + solver headless). In een worktree
  eerst de esbuild-symlink-workaround toepassen. Evt. een case toevoegen die bevestigt dat een
  agnostische default-kalender geen bouwvak/NL-feestdagen bevat.
- Self-test via browser dev build (`npm run dev`, port 3007) + `window.__OPS__`: aantonen dat
  (1) de toggle bestaat op alle 3 de plekken, (2) omzetten de default-kalender van een nieuw
  project neutraal maakt, en (3) de bouwvak-radiorij verdwijnt in de kalendergenerator.
