# Updater en afsluiten: keuzes die verrassen

`downloadAndInstall` in `src/services/updater/updaterService.ts` gebruikt niet de gecombineerde `downloadAndInstall`
van `@tauri-apps/plugin-updater`, maar roept `download()` en `install()` los aan. Op Windows sluit `install()` de app
af zodra het installatieprogramma gestart is (de documentatie van `install()` in
`@tauri-apps/plugin-updater/dist-js/index.d.ts`), dus wat na de installatie staat, komt daar niet aan de beurt. Daarom
gebeurt alles wat vóór het einde moet tussen de twee aanroepen: de afsluitfase nemen, de poort voor projectopslag
sluiten en de herstelronde afwachten (`flushRecoveryNow`; die schrijft niets als er niets te bewaren is), zodat bewerkingen van de laatste seconden na de update
via het herstel terugkomen.

## Gevolgen

- Een mislukte herstelronde houdt de installatie tegen: de fout valt in de gewone `catch` en gaat als `error` naar
  `onStatus`, en opnieuw proberen kan. Doorgaan zonder snapshot zou op Windows de app sluiten zonder de laatste
  bewerkingen in het herstel.
- `detectJustUpdated` (`releaseInfo.ts`) toont "Net bijgewerkt" niet bij de allereerste start (besluit eigenaar,
  28 september 2026). Zonder bewaarde versie beslist de welkomstvlag: was de welkomst al gezien, dan is het een
  gebruiker van vóór de sleutel `lastVersion` en verschijnt de dialoog zonder "van"-versie.
- De update-hoogtepunten (`releaseHighlights.ts`) eisen tekst in alle UI-talen vanaf `ALL_LOCALES_FROM_VERSION`
  (2026.10.0, besluit eigenaar 19 oktober 2026). Oudere versieblokken zijn uitgebracht met de veertien talen van
  `LEGACY_RELEASE_HIGHLIGHT_LOCALES` en blijven zo; `requiredHighlightLocales` eist voor die versies geen andere talen.
  Een taal zonder tekst toont Engels (`getReleaseHighlightsFromCatalog`).
- `watchFailures` in `src/services/appQuit/appQuitDependencies.ts` vergelijkt rode meldingen op objectidentiteit, niet
  op `id`. Een herhaalde melding met dezelfde `dedupeKey` muteert in `notify` (`uiSlice.ts`) de bestaande melding in de
  Immer-draft; daardoor is het een nieuw object met hetzelfde `id`. Op `id` vergelijken mist zo een tweede mislukte
  opslag met dezelfde melding. De grens van deze toets staat in knownbug 1817.
