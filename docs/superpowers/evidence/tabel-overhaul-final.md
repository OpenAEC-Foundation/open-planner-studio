# Tabel-overhaul — interactief eindbewijs

- **Datum:** 2026-08-26
- **Branch:** `codex/tabel-overhaul`
- **Geteste codebasis:** `4b9111d1fa14c7cd060ccbf38f04ccd8b749987f` plus de hieronder beschreven Task 22C-wijzigingen in deze commit
- **App:** Open Planner Studio v2026.8.1, draaiend uit deze worktree op `http://127.0.0.1:3008/`
- **Browseroppervlak:** Codex-webview, 1280 × 720 CSS-pixels

Dit document maakt bewust onderscheid tussen interactief bewijs en geautomatiseerde poorten. Beide
zijn afgerond; een groene headless check vervangt nergens de gevraagde echte gebruikershandeling.

## Tijdens de echte app-proef gevonden en gerepareerd

Een nieuwe rij die met `Insert` werd gemaakt, kreeg wel een editor maar verloor die editorfocus
direct weer. Twee renderovergangen liepen tegen elkaar in: de live Zustand-state bevatte de nieuwe
rij al, terwijl de gememoiseerde rij-index nog één render achterliep; tegelijk vroeg de nieuwe
actieve cel DOM-focus terug terwijl de editor net focus had gekregen.

De reparatie is klein en expliciet:

- `shouldCancelTaskGridEdit` houdt de editor alleen tijdens die aantoonbare live/index-overgang vast;
- `shouldRequestTaskGridCellFocus` laat een cel alleen in selectiemodus focus opeisen;
- Escape en een geldige Enter-commit vragen daarna zelf focus terug op de bedoelde cel.

De nieuwe regressiegevallen maken `check-task-grid-editors` 38/38 groen. In de echte app bleef een
ongeldige prioriteit `1001` open met `aria-invalid=true`, fouttekst via `aria-describedby` en de
live-regio; Escape bracht focus terug naar dezelfde cel. Een geldige waarde `600` werd met Enter
gecommit en focus ging naar dezelfde kolom van de volgende rij.

## Scenario's in de echte app

| Scenario | Stand | Werkelijk waargenomen bewijs |
|---|---|---|
| Nul taken | **Bewezen** | Een nieuw leeg project toont de gedeelde Gantt-grid zonder taakrijen en zonder crash. Zie `01-zero-tasks-gantt-en-dark.jpg`. |
| Nul kolommen | **Bewezen** | Alle zichtbare Gantt-kolommen konden worden verwijderd; de lege-kolommenstatus en de plus bleven bruikbaar. Zie `02-zero-columns-gantt-en-dark.jpg`. |
| Kolomkiezer en MRU | **Bewezen** | De plus opende categorieën met de tien recent gebruikte velden bovenaan. De zoekinput kreeg focus. Zie `03-column-chooser-mru-en-dark.jpg`. |
| 10.000 taken | **Bewezen** | Een privacyvrije IFC-fixture met 10.000 taken, 11.700 relaties, 8 resources en 5.718 toewijzingen is via **File → Examples** geopend. De grid meldde `aria-rowcount=10001`, maar monteerde slechts 23 rijen en 88 cellen. |
| Virtuele sprong en focus | **Bewezen** | `Ctrl+End` bracht de actieve cel naar kolom 4, rij 10.001 bij `scrollTop=279621`; er bleven 23 rijen, 88 cellen en exact één `tabindex=0` gemount. Zie `05-gantt-10000-virtual-bottom-en-dark.jpg`. |
| Filter | **Bewezen** | Filter `Taak 0` bracht de absolute rijtelling van 10.001 naar 4 (kop, twee voorouders en de match); leegmaken herstelde 10.001. |
| Collapse/expand | **Bewezen** | Inklappen van de eerste samenvatting wijzigde 10.001 naar 9.986; uitklappen herstelde 10.001. |
| Volledige Tabel-weergave | **Bewezen** | De Tabel-tab rapporteerde eveneens 10.001 absolute rijen en monteerde 24 rijen. Zie `07` t/m `12`. |
| Mini-map en histogram | **Bewezen** | Beide zijn op de 10k-fixture ingeschakeld, visueel gecontroleerd en daarna weer uitgeschakeld. Zie `06-gantt-10000-minimap-histogram-en-dark.jpg`. |
| Gantt splitweergave | **Bewezen** | Rij/bar-uitlijning en de gescheiden taakgrid/tijdlijn bleven correct met histogram en resourcegedeelte. Zie `baseline-gantt-dark-split-histogram.jpg` en `baseline-gantt-light-split-histogram.jpg`. |
| Duplicate resourcegroepen | **Bewezen** | Gegroepeerd op resource groeide de De Vaart-fixture van 261 naar 328 rijen. `Walls, floor 1 — Tower A` verscheen onder `Steel fixers` én `Tower crane`; selectie van één voorkomen gaf beide dezelfde taakfocus, maar slechts één actieve cel. Zie `17-resource-groups-duplicate-task-en-dark.jpg`. |
| Spreadsheet/TSV copy-paste | **Bewezen** | Twee taaknaamcellen zijn met Shift+pijl geselecteerd, met `Ctrl+C` gekopieerd en met `Ctrl+V` op twee andere rijen geplakt. Beide doelwaarden veranderden in de juiste volgorde. Eén `Ctrl+Z` herstelde beide originele namen. Dit bewijst de spreadsheet-TSV-route, niet een apart gestart Microsoft Excel-proces. |
| Externe relatie zonder bron | **Bewezen** | Bij `Car park paving` (`8.16`) toonde de voorgangercel naast interne `8.15 FS Driving` ook `Site Works Subcontractor / Site ready for main contractor paving FS`, met waarschuwingicoon en toegankelijke titel `Source missing`. |
| Relatie-hoverpariteit | **Bewezen** | Hover op dezelfde taakrij toonde het bestaande Gantt-taakpaneel met naam, WBS, duur, start/einde, status, critical en total float. Zie `14-gantt-task-hover-en-dark.jpg`. |
| Voorgangertrace | **Bewezen** | De tabeltrace markeerde veertien bepalende voorgangers, de focustaak apart en vervaagde overige gemounte rijen. Zie `16-table-predecessor-trace-fade-en-dark.jpg`. |
| Pinned overflow | **Bewezen** | Met 992 px aan gepinde kolommen in een gridviewport van 954 px werd sticky voor het hele blok uitgeschakeld; alle koppen bleven in normale volgorde zonder overlap. De oorspronkelijke gebruikersvoorkeuren zijn daarna hersteld. Zie `13-table-pinned-overflow-en-dark.jpg`. |
| Keyboardresize | **Bewezen** | Op `Task name` gaf pijl-rechts 8 px en Shift+pijl-rechts 32 px: 220 → 228 → 260, exact 40 px. Daarna is 260 → 220 teruggezet. |
| Pointerresize | **Bewezen** | In een schone echte Chrome-instantie ontving de zichtbare WBS-greep `pointerdown → gotpointercapture → pointermove → pointerup → lostpointercapture`. De breedte veranderde exact van 60 naar 120 px. Een eerdere rode poging bleek het afdekkende welkomstscherm te raken; de gelogde eventtargets maakten dat onderscheid aantoonbaar. |
| Popoverfocus en Escape | **Bewezen** | De lintknop schakelde naar de ene gedeelde Tabel-kiezer; de zoekinput kreeg focus. Escape sloot de popover en bracht focus terug naar de bijbehorende `Add column`-trigger. |
| RTL-pijlnavigatie | **Bewezen** | In Arabisch ging pijl-rechts fysiek van kolom 2 (`x=305`) naar kolom 3 (`x=545`) en pijl-links terug naar kolom 2; exact één roving tabstop bleef bestaan. |
| Smalle én brede browserviewport | **Bewezen** | Dezelfde lokale build is in echte Chrome gerenderd op 1280 × 720 en 640 × 720. De smalle variant hield `body.scrollWidth=640`, dus veroorzaakte geen verborgen pagina-overflow. Zie `22` en `23`. |
| 200% browserzoom | **Bewezen** | Chrome is op 2× device- én paginaschaal gezet: `devicePixelRatio=2`, `visualViewport.scale=2`, CSS-viewport 640 × 360 en zichtbaar viewport 320 × 180. De interface bleef renderen. Zie `24-gantt-page-zoom-200-en-dark.jpg`. |

## Thema, taal en beeldbewijs

Alle afbeeldingen zijn gemaakt uit een lege fixture, de lokaal gegenereerde 10k-fixture of het
meegeleverde fictieve De Vaart-voorbeeld. Ze bevatten geen gebruikersdata.

| Oppervlak | Variant | Bewijs |
|---|---|---|
| Gantt | donker, nul taken | [`01-zero-tasks-gantt-en-dark.jpg`](../../../artifacts/tabel-overhaul/01-zero-tasks-gantt-en-dark.jpg) |
| Gantt | donker, nul kolommen | [`02-zero-columns-gantt-en-dark.jpg`](../../../artifacts/tabel-overhaul/02-zero-columns-gantt-en-dark.jpg) |
| Gantt | kolomkiezer + MRU | [`03-column-chooser-mru-en-dark.jpg`](../../../artifacts/tabel-overhaul/03-column-chooser-mru-en-dark.jpg) |
| Gantt | ongeldige edit | [`04-invalid-priority-en-dark.jpg`](../../../artifacts/tabel-overhaul/04-invalid-priority-en-dark.jpg) |
| Gantt | 10k, virtuele bodem | [`05-gantt-10000-virtual-bottom-en-dark.jpg`](../../../artifacts/tabel-overhaul/05-gantt-10000-virtual-bottom-en-dark.jpg) |
| Gantt | 10k, mini-map + histogram | [`06-gantt-10000-minimap-histogram-en-dark.jpg`](../../../artifacts/tabel-overhaul/06-gantt-10000-minimap-histogram-en-dark.jpg) |
| Tabel | Engels, donker | [`07-table-10000-full-en-dark.jpg`](../../../artifacts/tabel-overhaul/07-table-10000-full-en-dark.jpg) |
| Tabel | Engels, licht | [`08-table-10000-full-en-light.jpg`](../../../artifacts/tabel-overhaul/08-table-10000-full-en-light.jpg) |
| Tabel | Engels, high-contrast | [`09-table-10000-full-en-high-contrast.jpg`](../../../artifacts/tabel-overhaul/09-table-10000-full-en-high-contrast.jpg) |
| Tabel | Nederlands, high-contrast | [`10-table-10000-full-nl-high-contrast.jpg`](../../../artifacts/tabel-overhaul/10-table-10000-full-nl-high-contrast.jpg) |
| Tabel | Duits (lange tekst), high-contrast | [`11-table-10000-full-de-long-high-contrast.jpg`](../../../artifacts/tabel-overhaul/11-table-10000-full-de-long-high-contrast.jpg) |
| Tabel | Arabisch RTL, high-contrast | [`12-table-10000-full-ar-rtl-high-contrast.jpg`](../../../artifacts/tabel-overhaul/12-table-10000-full-ar-rtl-high-contrast.jpg) |
| Tabel | pinned overflow | [`13-table-pinned-overflow-en-dark.jpg`](../../../artifacts/tabel-overhaul/13-table-pinned-overflow-en-dark.jpg) |
| Gantt | taak-hover | [`14-gantt-task-hover-en-dark.jpg`](../../../artifacts/tabel-overhaul/14-gantt-task-hover-en-dark.jpg) |
| Tabel | voorgangertrace en fade | [`16-table-predecessor-trace-fade-en-dark.jpg`](../../../artifacts/tabel-overhaul/16-table-predecessor-trace-fade-en-dark.jpg) |
| Gantt | dubbele taak in resourcegroepen | [`17-resource-groups-duplicate-task-en-dark.jpg`](../../../artifacts/tabel-overhaul/17-resource-groups-duplicate-task-en-dark.jpg) |
| Gantt | Nederlands, donker | [`18-gantt-nl-dark.jpg`](../../../artifacts/tabel-overhaul/18-gantt-nl-dark.jpg) |
| Gantt | Nederlands, high-contrast | [`19-gantt-nl-high-contrast.jpg`](../../../artifacts/tabel-overhaul/19-gantt-nl-high-contrast.jpg) |
| Gantt | Duits (lange tekst), high-contrast | [`20-gantt-de-long-high-contrast.jpg`](../../../artifacts/tabel-overhaul/20-gantt-de-long-high-contrast.jpg) |
| Gantt | Arabisch RTL, high-contrast | [`21-gantt-ar-rtl-high-contrast.jpg`](../../../artifacts/tabel-overhaul/21-gantt-ar-rtl-high-contrast.jpg) |
| Gantt | brede Chrome-viewport 1280 × 720 | [`22-gantt-wide-1280-en-dark.jpg`](../../../artifacts/tabel-overhaul/22-gantt-wide-1280-en-dark.jpg) |
| Gantt | smalle Chrome-viewport 640 × 720 | [`23-gantt-narrow-640-en-dark.jpg`](../../../artifacts/tabel-overhaul/23-gantt-narrow-640-en-dark.jpg) |
| Gantt | 200% Chrome-paginaweergave | [`24-gantt-page-zoom-200-en-dark.jpg`](../../../artifacts/tabel-overhaul/24-gantt-page-zoom-200-en-dark.jpg) |

De full Table én Gantt hebben daarmee blijvend bewijs voor licht/donker/high-contrast, Nederlands,
een taal met lange labels en RTL. De vier laatste Gantt-opnamen zijn in schone, afzonderlijke
appinstanties gemaakt zodat het instellingendialoog zelf het raster niet afdekt. De gedeelde
userinstellingen zijn daarna teruggezet op Engels/donker.

## Geautomatiseerde poorten

Deze resultaten zijn na de Task 22C-focusfix opnieuw en met hun werkelijke procesexit vastgelegd:

| Commando | Resultaat | Relevante telling |
|---|---:|---|
| `npm run typecheck` | exit 0 | productie- en test-`tsconfig` zonder fouten |
| `npm run lint` | exit 0 | ESLint op `src` zonder fouten |
| `bash tests/planning/run.sh` | exit 0 | onder meer editors 38/38, ARIA 39/39, i18n 4299/4299, performance 23/23, volledige solvermatrix 560/560 en vijf groene tijdzones |
| `npm run verify` | exit 0 | typecheck, lint, alle testreeksen, voorbeelden, documentatie, 13 locales, importcycli en audit volledig groen; audit: 0 kwetsbaarheden |

De performancepoort mat in de volledige eindrun mediaan 193,11 ms voor de relation-index, 0,29 ms
voor navigatie, 0,45 ms voor selectie en 0,018 ms voor het virtuele venster. Dit is aanvullend op
het drie-runsbewijs in `tabel-overhaul-performance.md`.

Een eerdere volledige verify vond precies één inhoudelijke poortfout: 132 ontbrekende teksten voor
de nieuwe relatiedropdown, verdeeld over twaalf niet-Nederlandse locale-bestanden. Na aanvulling gaf
`verify:i18n` voor alle dertien locales nul ontbrekende sleutels; de daaropvolgende volledige verify
eindigde met exit 0.

De bestaande MPP-timingtest bleek onder het energiebesparingsprofiel en hoge lokale belasting
incidenteel over zijn tijdslimiet te gaan. Na isolatie waren zes opeenvolgende UTC-runs onder een
tijdelijk prestatieprofiel 112/112 groen. Ook de volledige eindrun draaide onder dat tijdelijke
profiel; een `EXIT`-herstel zette het systeem aantoonbaar terug op `balanced`.

## Herstel van tijdelijke bewijsinstellingen

Na de scenario's zijn filter, resourcegroepering, relatie-trace, extra voorganger-/opvolgerkolommen,
mini-map en histogram uitgezet. De Gantt-kolommen staan weer op WBS 140 px, Task name 220 px en
Duration 140 px; de volledige Tabel staat weer op zijn oorspronkelijke kolommen en alleen WBS is
gepind. Taal en thema staan weer op Engels/donker en het eigenschappenpaneel staat weer open.

## Resterende productrisico's

Er staan na de uitgevoerde interactieve scenario's en geautomatiseerde poorten geen bekende open
Task 22C-productrisico's in dit bewijs. Diffhygiëne, markeerwoordscan en stagecontrole worden direct
voor de commit apart uitgevoerd, omdat die de exacte commitinhoud beoordelen.
